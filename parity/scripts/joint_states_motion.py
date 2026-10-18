#!/usr/bin/env python3
"""
joint_states_motion.py - Motion proof for an arm whose running controller executes the maker's own joint motion
(e.g. franka_example_controllers/JointPositionExampleController): the first /joint_states message, then the last one
after --secs wall seconds, and the change per joint. Prints measured values only.
Usage: joint_states_motion.py [--secs 5] [--timeout 60]
"""
import argparse
import sys
import time

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import JointState


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--secs", type=float, default=5.0)
    ap.add_argument("--timeout", type=float, default=60.0)
    a = ap.parse_args()
    rclpy.init()
    n = Node("parity_joint_states_motion")
    msgs = []
    n.create_subscription(JointState, "/joint_states", lambda m: msgs.append(m), 10)
    t0 = time.time()
    while not msgs and time.time() - t0 < a.timeout:
        rclpy.spin_once(n, timeout_sec=0.1)
    if not msgs:
        print(f"ERROR: no /joint_states within {a.timeout} s")
        return 2
    first = msgs[0]
    t1 = time.time()
    while time.time() - t1 < a.secs:
        rclpy.spin_once(n, timeout_sec=0.1)
    last = msgs[-1]
    st = lambda m: m.header.stamp.sec + m.header.stamp.nanosec * 1e-9
    print(f"# /joint_states first (stamp {st(first):.3f}) and last after {a.secs} s wall (stamp {st(last):.3f}), {len(msgs)} messages")
    pos = dict(zip(last.name, last.position))
    for nm, p in zip(first.name, first.position):
        print(f"{nm}: {p:.6f} -> {pos.get(nm, float('nan')):.6f} ({pos.get(nm, float('nan')) - p:+.6f})")
    n.destroy_node()
    rclpy.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
