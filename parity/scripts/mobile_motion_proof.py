#!/usr/bin/env python3
"""
mobile_motion_proof.py - Motion proof for a mobile robot (P2b rule 7c): /odom before, a velocity command on the
command topic for --secs seconds at 10 Hz, /odom after, then a zero command. Prints measured values only.
The message type is taken from the running graph (the topic's type), so TwistStamped vs Twist is what the robot uses.
Usage: mobile_motion_proof.py [--cmd /cmd_vel] [--odom /odom] [--vx 0.2] [--wz 0.0] [--secs 3]
"""
import argparse
import math
import sys
import time

import rclpy
from geometry_msgs.msg import Twist, TwistStamped
from nav_msgs.msg import Odometry
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cmd", default="/cmd_vel")
    ap.add_argument("--odom", default="/odom")
    ap.add_argument("--vx", type=float, default=0.2)
    ap.add_argument("--wz", type=float, default=0.0)
    ap.add_argument("--secs", type=float, default=3.0)
    ap.add_argument("--timeout", type=float, default=60.0)
    a = ap.parse_args()
    rclpy.init()
    n = Node("parity_mobile_motion_proof")
    last = {}
    n.create_subscription(Odometry, a.odom, lambda m: last.update(m=m), qos_profile_sensor_data)
    t0 = time.time()
    types = []
    while time.time() - t0 < a.timeout:
        rclpy.spin_once(n, timeout_sec=0.1)
        types = [t for nm, ts in n.get_topic_names_and_types() if nm == a.cmd for t in ts]
        if "m" in last and types:
            break
    print(f"# {a.cmd} types in the graph: {types}")
    if "m" not in last:
        print(f"ERROR: no {a.odom} within {a.timeout} s")
        return 2
    stamped = "geometry_msgs/msg/TwistStamped" in types
    if not types:
        print(f"ERROR: {a.cmd} has no endpoint in the graph")
        return 2
    pub = n.create_publisher(TwistStamped if stamped else Twist, a.cmd, 10)

    def pose(m):
        p, q = m.pose.pose.position, m.pose.pose.orientation
        return p.x, p.y, math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
    b = pose(last["m"])
    print(f"# {a.odom} before: x={b[0]:.6f} y={b[1]:.6f} yaw={b[2]:.6f}")
    print(f"# publish {'TwistStamped' if stamped else 'Twist'} {a.cmd} linear.x={a.vx} angular.z={a.wz} at 10 Hz for {a.secs} s")
    end = time.time() + a.secs
    while time.time() < end:
        if stamped:
            m = TwistStamped()
            m.header.stamp = n.get_clock().now().to_msg()
            m.twist.linear.x, m.twist.angular.z = a.vx, a.wz
        else:
            m = Twist()
            m.linear.x, m.angular.z = a.vx, a.wz
        pub.publish(m)
        t1 = time.time()
        while time.time() - t1 < 0.1:
            rclpy.spin_once(n, timeout_sec=0.02)
    after = last["m"]
    a_ = pose(after)
    print(f"# {a.odom} after: x={a_[0]:.6f} y={a_[1]:.6f} yaw={a_[2]:.6f} twist.linear.x={after.twist.twist.linear.x:.6f}")
    print(f"# moved {math.hypot(a_[0] - b[0], a_[1] - b[1]):.6f} m, turned {a_[2] - b[2]:+.6f} rad")
    for _ in range(10):
        pub.publish(TwistStamped() if stamped else Twist())
        time.sleep(0.1)
    n.destroy_node()
    rclpy.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
