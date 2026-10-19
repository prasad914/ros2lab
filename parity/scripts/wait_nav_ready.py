#!/usr/bin/env python3
"""Wait until a Nav2 reference stack is ready, instead of a fixed sleep.

Checks, in order, each against the same wall-clock deadline (--limit):
  1. /clock is advancing (simulation running),
  2. the navigate_to_pose action server is available,
  3. every lifecycle manager in --managers answers is_active (std_srvs/Trigger) with success.
With --localize (where AMCL is used): publishes goals.yaml start_pose on /initialpose once a second until
/amcl_pose is received, with its own wall-clock deadline (--localize-limit).
On a timeout it prints "NOT READY: ..." with what was missing (and the lifecycle state of each managed node)
and exits 2 (clock / action / lifecycle) or 3 (not localized). Exit 0 = ready.
Usage: wait_nav_ready.py [--managers a,b] [--limit 300] [--localize] [--localize-limit 120] [--goals-yaml f]
"""
import argparse
import sys
import time

import rclpy
import yaml
from geometry_msgs.msg import PoseWithCovarianceStamped
from lifecycle_msgs.srv import GetState
from nav2_msgs.action import NavigateToPose
from rcl_interfaces.srv import GetParameters
from rclpy.action import ActionClient
from rclpy.node import Node
from rclpy.parameter import Parameter
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy, qos_profile_sensor_data
from rosgraph_msgs.msg import Clock
from std_srvs.srv import Trigger


class Waiter(Node):
    def __init__(self):
        super().__init__('wait_nav_ready',
                         parameter_overrides=[Parameter('use_sim_time', Parameter.Type.BOOL, True)])
        self.clock_stamps = []
        self.amcl_pose = None
        self.create_subscription(Clock, '/clock', self.on_clock, qos_profile_sensor_data)
        amcl_qos = QoSProfile(depth=1, reliability=ReliabilityPolicy.RELIABLE,
                              durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.create_subscription(PoseWithCovarianceStamped, '/amcl_pose', self.on_amcl, amcl_qos)
        self.initialpose_pub = self.create_publisher(PoseWithCovarianceStamped, '/initialpose', 10)
        self.nav_client = ActionClient(self, NavigateToPose, 'navigate_to_pose')

    def on_clock(self, msg):
        self.clock_stamps.append(msg.clock.sec + msg.clock.nanosec * 1e-9)
        del self.clock_stamps[:-2]

    def on_amcl(self, msg):
        self.amcl_pose = msg

    def spin_for(self, sec):
        end = time.monotonic() + sec
        while time.monotonic() < end:
            rclpy.spin_once(self, timeout_sec=min(0.1, max(0.0, end - time.monotonic())))

    def call(self, client, request, timeout):
        if not client.wait_for_service(timeout_sec=min(timeout, 1.0)):
            return None
        fut = client.call_async(request)
        end = time.monotonic() + timeout
        while not fut.done() and time.monotonic() < end:
            rclpy.spin_once(self, timeout_sec=0.1)
        return fut.result() if fut.done() else None

    def manager_active(self, mgr):
        res = self.call(self.create_client(Trigger, f'/{mgr}/is_active'), Trigger.Request(), 2.0)
        return res is not None and res.success

    def managed_states(self, mgr):
        """Lifecycle state of every node in the manager's node_names parameter (for the error message)."""
        req = GetParameters.Request(names=['node_names'])
        res = self.call(self.create_client(GetParameters, f'/{mgr}/get_parameters'), req, 2.0)
        if res is None or not res.values:
            return f'{mgr}: no answer from get_parameters'
        names = list(res.values[0].string_array_value)
        out = []
        for n in names:
            st = self.call(self.create_client(GetState, f'/{n.lstrip("/")}/get_state'), GetState.Request(), 2.0)
            out.append(f'{n}={st.current_state.label if st else "no answer"}')
        return f'{mgr}: ' + ', '.join(out)


def not_ready(what, code, t0, extra=''):
    print(f'NOT READY: {what} after {time.monotonic() - t0:.0f} s wall{extra}', flush=True)
    sys.exit(code)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--managers', default='lifecycle_manager_localization,lifecycle_manager_navigation')
    ap.add_argument('--limit', type=float, default=300.0, help='wall-clock seconds for clock/action/lifecycle')
    ap.add_argument('--localize', action='store_true', help='publish start_pose and wait for /amcl_pose')
    ap.add_argument('--localize-limit', type=float, default=120.0)
    ap.add_argument('--goals-yaml', default='parity/fixtures/goals.yaml')
    args = ap.parse_args()
    managers = [m for m in args.managers.split(',') if m]

    rclpy.init()
    w = Waiter()
    t0 = time.monotonic()
    deadline = t0 + args.limit
    left = lambda: deadline - time.monotonic()

    while not (len(w.clock_stamps) == 2 and w.clock_stamps[1] > w.clock_stamps[0]):
        if left() <= 0:
            not_ready('/clock not advancing', 2, t0)
        w.spin_for(0.2)
    print(f'ready: /clock advancing (sim {w.clock_stamps[1]:.1f} s)', flush=True)

    while not w.nav_client.wait_for_server(timeout_sec=1.0):
        if left() <= 0:
            not_ready('navigate_to_pose action server not available', 2, t0)
    print('ready: navigate_to_pose action server', flush=True)

    for mgr in managers:
        while not w.manager_active(mgr):
            if left() <= 0:
                not_ready(f'{mgr} is_active is not true', 2, t0, '\n  ' + w.managed_states(mgr))
            w.spin_for(1.0)
        print(f'ready: {mgr} is_active', flush=True)

    if args.localize:
        with open(args.goals_yaml) as f:
            sp = yaml.safe_load(f)['start_pose']
        msg = PoseWithCovarianceStamped()
        msg.header.frame_id = sp.get('frame_id', 'map')
        for k in ('x', 'y', 'z'):
            setattr(msg.pose.pose.position, k, float(sp['position'][k]))
        for k in ('x', 'y', 'z', 'w'):
            setattr(msg.pose.pose.orientation, k, float(sp['orientation'][k]))
        msg.pose.covariance = [float(c) for c in sp['covariance']]
        t1 = time.monotonic()
        while w.amcl_pose is None:
            if time.monotonic() - t1 > args.localize_limit:
                not_ready(f'no /amcl_pose after publishing start_pose on /initialpose', 3, t1)
            msg.header.stamp = w.get_clock().now().to_msg()
            w.initialpose_pub.publish(msg)
            w.spin_for(1.0)
        p = w.amcl_pose.pose.pose.position
        print(f'ready: localized, /amcl_pose ({p.x:.3f}, {p.y:.3f})', flush=True)

    print(f'READY after {time.monotonic() - t0:.1f} s wall', flush=True)
    w.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
