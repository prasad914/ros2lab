#!/usr/bin/env python3
"""Small probes for the Night-1 TurtleBot3 captures (real ROS 2, this PC). One sub-command per run:

  clock   --out f.csv [--secs N]        wall epoch and /clock sim time, every 0.5 s wall (to turn log stamps into sim time)
  pose    --x X --y Y [--yaw R] [--secs N]
                                        publish /initialpose (map frame) once a second until /amcl_pose arrives; prints it
  goal    --x X --y Y [--yaw R] --out d [--timeout S]
                                        NavigateToPose; writes d/result.json (status, error_code, error_msg, sim/wall times)
  rtf     [--secs N]                    sim seconds per wall second over N wall seconds
Uses use_sim_time. Prints one JSON line on stdout.
"""
import argparse
import csv
import json
import math
import os
import sys
import time

import rclpy
from action_msgs.msg import GoalStatus
from geometry_msgs.msg import PoseWithCovarianceStamped
from nav2_msgs.action import NavigateToPose
from rclpy.action import ActionClient
from rclpy.node import Node
from rclpy.parameter import Parameter
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
from rosgraph_msgs.msg import Clock

STATUS = {v: k[len('STATUS_'):] for k, v in vars(GoalStatus).items() if k.startswith('STATUS_')}


def yaw_q(yaw):
    return math.sin(yaw / 2.0), math.cos(yaw / 2.0)


class Probe(Node):
    def __init__(self):
        super().__init__('ros2lab_night1_probe', parameter_overrides=[Parameter('use_sim_time', Parameter.Type.BOOL, True)])
        self.sim = None
        self.create_subscription(Clock, '/clock', lambda m: self._on_clock(m), QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT))

    def _on_clock(self, m):
        self.sim = m.clock.sec + m.clock.nanosec * 1e-9

    def spin_for(self, wall):
        end = time.time() + wall
        while time.time() < end:
            rclpy.spin_once(self, timeout_sec=0.05)


def cmd_clock(n, a):
    with open(a.out, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['wall_epoch', 'sim'])
        end = time.time() + a.secs
        while time.time() < end:
            n.spin_for(0.5)
            if n.sim is not None:
                w.writerow([f'{time.time():.3f}', f'{n.sim:.3f}'])
                f.flush()
    return {'ok': True, 'out': a.out}


def cmd_rtf(n, a):
    n.spin_for(2.0)
    s0, w0 = n.sim, time.time()
    n.spin_for(a.secs)
    if s0 is None or n.sim is None:
        return {'ok': False, 'why': 'no /clock'}
    return {'ok': True, 'sim_s': round(n.sim - s0, 3), 'wall_s': round(time.time() - w0, 3), 'rtf': round((n.sim - s0) / (time.time() - w0), 3)}


def cmd_pose(n, a):
    got = {}
    qos_amcl = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL, reliability=ReliabilityPolicy.RELIABLE)
    n.create_subscription(PoseWithCovarianceStamped, '/amcl_pose', lambda m: got.setdefault('m', m), qos_amcl)
    pub = n.create_publisher(PoseWithCovarianceStamped, '/initialpose', 10)
    qz, qw = yaw_q(a.yaw)
    end, sent = time.time() + a.secs, 0
    while time.time() < end and 'm' not in got:
        m = PoseWithCovarianceStamped()
        m.header.frame_id = 'map'
        m.header.stamp = n.get_clock().now().to_msg()
        m.pose.pose.position.x, m.pose.pose.position.y = a.x, a.y
        m.pose.pose.orientation.z, m.pose.pose.orientation.w = qz, qw
        m.pose.covariance[0] = m.pose.covariance[7] = 0.25
        m.pose.covariance[35] = 0.06853891945200942
        pub.publish(m)
        sent += 1
        n.spin_for(1.0)
    m = got.get('m')
    return {'ok': m is not None, 'sent': sent, 'sim': n.sim, 'wall': time.time(),
            'amcl_pose': None if m is None else {'x': m.pose.pose.position.x, 'y': m.pose.pose.position.y,
                                                 'qz': m.pose.pose.orientation.z, 'qw': m.pose.pose.orientation.w}}


def cmd_goal(n, a):
    os.makedirs(a.out, exist_ok=True)
    ac = ActionClient(n, NavigateToPose, 'navigate_to_pose')
    if not ac.wait_for_server(timeout_sec=30.0):
        r = {'ok': False, 'why': 'navigate_to_pose server not available after 30 s wall'}
    else:
        g = NavigateToPose.Goal()
        g.pose.header.frame_id = 'map'
        g.pose.header.stamp = n.get_clock().now().to_msg()
        g.pose.pose.position.x, g.pose.pose.position.y = a.x, a.y
        qz, qw = yaw_q(a.yaw)
        g.pose.pose.orientation.z, g.pose.pose.orientation.w = qz, qw
        fut = ac.send_goal_async(g)
        rclpy.spin_until_future_complete(n, fut, timeout_sec=30.0)
        h = fut.result()
        r = {'goal': {'x': a.x, 'y': a.y, 'yaw': a.yaw}, 'accepted': bool(h and h.accepted), 'sim_accept': n.sim, 'wall_accept': time.time()}
        if h and h.accepted:
            rf = h.get_result_async()
            t0 = time.time()
            while not rf.done() and time.time() - t0 < a.timeout:
                rclpy.spin_once(n, timeout_sec=0.1)
            if rf.done():
                res = rf.result()
                r.update({'status': res.status, 'status_name': STATUS.get(res.status), 'error_code': int(res.result.error_code),
                          'error_msg': res.result.error_msg, 'sim_result': n.sim, 'wall_result': time.time()})
            else:
                r.update({'status': None, 'why': f'no result after {a.timeout} s wall'})
        r['ok'] = r.get('status') == GoalStatus.STATUS_SUCCEEDED
    with open(os.path.join(a.out, 'result.json'), 'w') as f:
        json.dump(r, f, indent=1)
    return r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    c = sp.add_parser('clock'); c.add_argument('--out', required=True); c.add_argument('--secs', type=float, default=600)
    c = sp.add_parser('rtf'); c.add_argument('--secs', type=float, default=10)
    for name in ('pose', 'goal'):
        c = sp.add_parser(name)
        c.add_argument('--x', type=float, required=True); c.add_argument('--y', type=float, required=True); c.add_argument('--yaw', type=float, default=0.0)
        if name == 'pose':
            c.add_argument('--secs', type=float, default=60)
        else:
            c.add_argument('--out', required=True); c.add_argument('--timeout', type=float, default=240)
    a = ap.parse_args()
    rclpy.init()
    n = Probe()
    try:
        r = {'clock': cmd_clock, 'rtf': cmd_rtf, 'pose': cmd_pose, 'goal': cmd_goal}[a.cmd](n, a)
    finally:
        n.destroy_node()
        rclpy.try_shutdown()
    print(json.dumps(r))
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
