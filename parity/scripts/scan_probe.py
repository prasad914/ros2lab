#!/usr/bin/env python3
"""scan_probe.py - N /scan messages (sensor-data QoS): stamp, number of ranges, finite, == range_min, min, max.
Usage: scan_probe.py [--topic /scan] [--count 3] [--timeout 120]"""
import argparse
import math
import time

import rclpy
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import LaserScan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--topic', default='/scan')
    ap.add_argument('--count', type=int, default=3)
    ap.add_argument('--timeout', type=float, default=120.0)
    a = ap.parse_args()
    rclpy.init()
    n = rclpy.create_node('parity_scan_probe')
    got = []
    n.create_subscription(LaserScan, a.topic, got.append, qos_profile_sensor_data)
    t0 = time.time()
    while len(got) < a.count and time.time() - t0 < a.timeout:
        rclpy.spin_once(n, timeout_sec=0.1)
    print(f'# {a.topic} probe (rclpy, sensor-data QoS), {len(got)} message(s) in {time.time() - t0:.1f} s wall')
    for m in got[:a.count]:
        fin = [r for r in m.ranges if math.isfinite(r)]
        eq = sum(1 for r in m.ranges if r == m.range_min)
        print(f'stamp {m.header.stamp.sec}.{m.header.stamp.nanosec:09d} ranges {len(m.ranges)} finite {len(fin)} '
              f'==range_min {eq} min {min(fin) if fin else "n/a"} max {max(fin) if fin else "n/a"}')
    n.destroy_node()
    rclpy.shutdown()
    return 0 if got else 1


if __name__ == '__main__':
    raise SystemExit(main())
