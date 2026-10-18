#!/usr/bin/env python3
"""
arm_motion_proof.py - Motion proof for an arm (P2b rule 7c): /joint_states before, one FollowJointTrajectory goal to a
running joint trajectory controller, /joint_states after.

The controller's joints come from its own `joints` parameter; the goal moves ONE joint by --delta rad from where it is
now (all others hold their position), reached at --duration s. Everything printed is measured; nothing is assumed.
Usage: arm_motion_proof.py --controller <name> [--joint-index 0] [--delta 0.2] [--duration 3] [--action <name>]
       (run with ROS 2 sourced and ROS_DOMAIN_ID set; prints a text report to stdout)
"""
import argparse
import sys
import time

import rclpy
from control_msgs.action import FollowJointTrajectory
from rcl_interfaces.srv import GetParameters
from rclpy.action import ActionClient
from rclpy.node import Node
from sensor_msgs.msg import JointState
from trajectory_msgs.msg import JointTrajectoryPoint


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--controller", required=True)
    ap.add_argument("--action", default=None, help="default /<controller>/follow_joint_trajectory")
    ap.add_argument("--joint-index", type=int, default=0)
    ap.add_argument("--delta", type=float, default=0.2)
    ap.add_argument("--duration", type=float, default=3.0)
    ap.add_argument("--timeout", type=float, default=60.0)
    ap.add_argument("--joint-states", default="/joint_states", help="joint states topic (e.g. /wx250s/joint_states)")
    a = ap.parse_args()
    rclpy.init()
    n = Node("parity_arm_motion_proof")
    last = {}

    def on_js(m):
        for nm, p in zip(m.name, m.position):
            last[nm] = p
        last["_stamp"] = m.header.stamp.sec + m.header.stamp.nanosec * 1e-9
    n.create_subscription(JointState, a.joint_states, on_js, 10)

    def spin_until(pred, secs):
        t0 = time.time()
        while time.time() - t0 < secs:
            rclpy.spin_once(n, timeout_sec=0.1)
            if pred():
                return True
        return pred()

    cli = n.create_client(GetParameters, f"/{a.controller}/get_parameters")
    if not cli.wait_for_service(timeout_sec=a.timeout):
        print(f"ERROR: /{a.controller}/get_parameters not available within {a.timeout} s")
        return 2
    fut = cli.call_async(GetParameters.Request(names=["joints"]))
    spin_until(fut.done, a.timeout)
    joints = list(fut.result().values[0].string_array_value) if fut.done() and fut.result() else []
    print(f"# controller {a.controller} joints parameter: {joints}")
    if not joints:
        return 2
    if not spin_until(lambda: all(j in last for j in joints), a.timeout):
        print(f"ERROR: /joint_states did not contain {joints} within {a.timeout} s; got {sorted(k for k in last if k != '_stamp')}")
        return 2
    before = {j: last[j] for j in joints}
    print(f"# /joint_states before (stamp {last['_stamp']:.3f})")
    for j in joints:
        print(f"{j}: {before[j]:.6f}")
    target = dict(before)
    jm = joints[a.joint_index]
    target[jm] = before[jm] + a.delta
    act = a.action or f"/{a.controller}/follow_joint_trajectory"
    ac = ActionClient(n, FollowJointTrajectory, act)
    if not ac.wait_for_server(timeout_sec=a.timeout):
        print(f"ERROR: action server {act} not available within {a.timeout} s")
        return 2
    goal = FollowJointTrajectory.Goal()
    goal.trajectory.joint_names = joints
    pt = JointTrajectoryPoint(positions=[target[j] for j in joints])
    pt.time_from_start.sec = int(a.duration)
    pt.time_from_start.nanosec = int((a.duration % 1) * 1e9)
    goal.trajectory.points = [pt]
    print(f"# FollowJointTrajectory {act}: {jm} {before[jm]:.6f} -> {target[jm]:.6f} in {a.duration} s")
    gf = ac.send_goal_async(goal)
    spin_until(gf.done, a.timeout)
    gh = gf.result()
    print(f"accepted: {bool(gh and gh.accepted)}")
    if not gh or not gh.accepted:
        return 1
    rf = gh.get_result_async()
    spin_until(rf.done, a.timeout + a.duration)
    if not rf.done():
        print("ERROR: no result")
        return 1
    r = rf.result()
    print(f"status: {r.status} error_code: {r.result.error_code} error_string: '{r.result.error_string}'")
    t_end = time.time()
    spin_until(lambda: last.get("_stamp", 0) > 0 and time.time() - t_end > 1.0, 3.0)
    print(f"# /joint_states after (stamp {last['_stamp']:.3f})")
    for j in joints:
        print(f"{j}: {last[j]:.6f}")
    print(f"# moved {jm}: {last[jm] - before[jm]:+.6f} rad (commanded {a.delta:+.6f})")
    n.destroy_node()
    rclpy.shutdown()
    return 0 if r.status == 4 else 1


if __name__ == "__main__":
    sys.exit(main())
