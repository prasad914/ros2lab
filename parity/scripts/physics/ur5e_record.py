#!/usr/bin/env python3
"""UR5e under gz_ros2_control (ur_simulation_gz): command and record joint states.

mode traj : FollowJointTrajectory goal to /joint_trajectory_controller (2 points), record /joint_states and
            /joint_trajectory_controller/controller_state (reference vs feedback) for --secs.
mode step : one Float64MultiArray on /forward_position_controller/commands = current positions with
            shoulder_pan_joint + 0.2 rad, record /joint_states for --secs.
Usage: ur5e_record.py <traj|step> <out dir> [--secs S]
"""
import argparse
import json
import os
import time

import rclpy
from control_msgs.action import FollowJointTrajectory
from control_msgs.msg import JointTrajectoryControllerState
from rclpy.action import ActionClient
from rclpy.node import Node
from sensor_msgs.msg import JointState
from std_msgs.msg import Float64MultiArray
from trajectory_msgs.msg import JointTrajectoryPoint

JOINTS = ['shoulder_pan_joint', 'shoulder_lift_joint', 'elbow_joint', 'wrist_1_joint', 'wrist_2_joint', 'wrist_3_joint']


def st(h):
    return h.stamp.sec + h.stamp.nanosec * 1e-9


class R(Node):
    def __init__(self, out):
        super().__init__('ros2lab_ur5e_recorder', parameter_overrides=[rclpy.parameter.Parameter('use_sim_time', value=True)])
        self.js = open(os.path.join(out, 'joint_states.csv'), 'w')
        self.js.write('stamp,' + ','.join(f'{j}_pos,{j}_vel,{j}_eff' for j in JOINTS) + '\n')
        self.cs = open(os.path.join(out, 'controller_state.csv'), 'w')
        self.cs.write('stamp,' + ','.join(f'{j}_ref,{j}_fb,{j}_err,{j}_out' for j in JOINTS) + '\n')
        self.last = None
        self.create_subscription(JointState, '/joint_states', self.on_js, 50)
        self.create_subscription(JointTrajectoryControllerState, '/joint_trajectory_controller/controller_state', self.on_cs, 50)

    def on_js(self, m):
        idx = {n: i for i, n in enumerate(m.name)}
        if not all(j in idx for j in JOINTS):
            return
        g = lambda arr, i: arr[i] if i < len(arr) else float('nan')
        self.last = [g(m.position, idx[j]) for j in JOINTS]
        self.js.write(f'{st(m.header):.6f},' + ','.join(
            f'{g(m.position, idx[j]):.9f},{g(m.velocity, idx[j]):.9f},{g(m.effort, idx[j]):.9f}' for j in JOINTS) + '\n')

    def on_cs(self, m):
        idx = {n: i for i, n in enumerate(m.joint_names)}
        g = lambda arr, j: arr[idx[j]] if j in idx and idx[j] < len(arr) else float('nan')
        self.cs.write(f'{st(m.header):.6f},' + ','.join(
            f'{g(m.reference.positions, j):.9f},{g(m.feedback.positions, j):.9f},{g(m.error.positions, j):.9f},'
            f'{g(m.output.positions, j):.9f}' for j in JOINTS) + '\n')


def spin_for(node, secs):
    t0 = time.time()
    while time.time() - t0 < secs:
        rclpy.spin_once(node, timeout_sec=0.05)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode')
    ap.add_argument('out')
    ap.add_argument('--secs', type=float, default=8.0)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rclpy.init()
    n = R(a.out)
    meta = dict(mode=a.mode)
    t0 = time.time()
    while n.last is None and time.time() - t0 < 120:
        rclpy.spin_once(n, timeout_sec=0.1)
    meta['start_positions'] = n.last
    spin_for(n, 1.0)
    if a.mode == 'traj':
        ac = ActionClient(n, FollowJointTrajectory, '/joint_trajectory_controller/follow_joint_trajectory')
        meta['server_ready'] = ac.wait_for_server(timeout_sec=60)
        g = FollowJointTrajectory.Goal()
        g.trajectory.joint_names = JOINTS
        p0 = list(n.last)
        p1 = list(p0); p1[0] += 0.5; p1[1] -= 0.3; p1[2] += 0.4
        for t, p in ((2.0, p1), (4.0, p0)):
            pt = JointTrajectoryPoint()
            pt.positions = p
            pt.time_from_start.sec = int(t)
            g.trajectory.points.append(pt)
        meta['goal_points'] = [dict(t=2.0, positions=p1), dict(t=4.0, positions=p0)]
        fut = ac.send_goal_async(g)
        while not fut.done():
            rclpy.spin_once(n, timeout_sec=0.05)
        gh = fut.result()
        meta['accepted'] = bool(gh and gh.accepted)
        rf = gh.get_result_async() if gh and gh.accepted else None
        t1 = time.time()
        while time.time() - t1 < a.secs:
            rclpy.spin_once(n, timeout_sec=0.05)
        if rf is not None and rf.done():
            r = rf.result()
            meta['result'] = dict(status=r.status, error_code=r.result.error_code, error_string=r.result.error_string)
    else:
        pub = n.create_publisher(Float64MultiArray, '/forward_position_controller/commands', 10)
        spin_for(n, 1.0)
        tgt = list(n.last); tgt[0] += 0.2
        meta['step_from'] = list(n.last)
        meta['step_to'] = tgt
        m = Float64MultiArray(); m.data = tgt
        meta['published_at_sim'] = n.get_clock().now().nanoseconds * 1e-9
        pub.publish(m)
        spin_for(n, a.secs)
    n.js.close(); n.cs.close()
    json.dump(meta, open(os.path.join(a.out, 'record_meta.json'), 'w'), indent=1)
    n.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
