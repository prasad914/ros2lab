#!/usr/bin/env python3
"""Night 2, Part 3: record the Nav2 velocity chain during a goal (real ROS 2, this PC).

  cmdvel_probe.py --out f.csv [--secs N]
Subscribes /cmd_vel_nav, /cmd_vel_smoothed, /cmd_vel (geometry_msgs/TwistStamped, the TurtleBot3 profile's
enable_stamped_cmd_vel: true) and /odom; one CSV row per message: wall epoch, /clock sim time, topic, header stamp,
linear.x, angular.z. Stops after N wall seconds or on SIGINT. Uses use_sim_time.
"""
import argparse
import csv
import signal
import time

import rclpy
from geometry_msgs.msg import TwistStamped
from nav_msgs.msg import Odometry
from rclpy.node import Node
from rclpy.parameter import Parameter
from rclpy.qos import QoSProfile, ReliabilityPolicy
from rosgraph_msgs.msg import Clock


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--secs', type=float, default=300)
    a = ap.parse_args()
    rclpy.init()
    n = Node('ros2lab_night2_cmdvel_probe', parameter_overrides=[Parameter('use_sim_time', Parameter.Type.BOOL, True)])
    sim = [None]
    f = open(a.out, 'w', newline='')
    w = csv.writer(f)
    w.writerow(['wall_epoch', 'sim', 'topic', 'stamp', 'vx', 'wz'])
    be = QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT)
    n.create_subscription(Clock, '/clock', lambda m: sim.__setitem__(0, m.clock.sec + m.clock.nanosec * 1e-9), be)

    def row(topic, stamp, vx, wz):
        w.writerow([f'{time.time():.4f}', '' if sim[0] is None else f'{sim[0]:.4f}', topic,
                    f'{stamp.sec + stamp.nanosec * 1e-9:.4f}', f'{vx:.6f}', f'{wz:.6f}'])

    for t in ('/cmd_vel_nav', '/cmd_vel_smoothed', '/cmd_vel'):
        n.create_subscription(TwistStamped, t, lambda m, t=t: row(t, m.header.stamp, m.twist.linear.x, m.twist.angular.z), 10)
    n.create_subscription(Odometry, '/odom', lambda m: row('/odom', m.header.stamp, m.twist.twist.linear.x, m.twist.twist.angular.z), be)
    stop = [False]
    signal.signal(signal.SIGINT, lambda *_: stop.__setitem__(0, True))
    signal.signal(signal.SIGTERM, lambda *_: stop.__setitem__(0, True))
    end = time.time() + a.secs
    while not stop[0] and time.time() < end:
        rclpy.spin_once(n, timeout_sec=0.05)
    f.close()
    n.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
