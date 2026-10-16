#!/usr/bin/env python3
"""
Timed coverage route publisher for TurtleBot3 in Gazebo.
Publishes geometry_msgs/msg/TwistStamped to /cmd_vel at 10 Hz for 180 seconds.
Uses reactive obstacle avoidance with wander pattern to cover the environment.
"""

import sys
import time
import math
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy
from geometry_msgs.msg import TwistStamped
from sensor_msgs.msg import LaserScan


class CoverageDriver(Node):
    def __init__(self, duration_sec=180.0):
        super().__init__('coverage_driver')
        self.duration_sec = duration_sec

        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.VOLATILE,
            depth=10
        )
        self.cmd_pub = self.create_publisher(TwistStamped, '/cmd_vel', qos)

        # tb3 scan is reliable volatile
        scan_qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.VOLATILE,
            depth=10
        )
        self.scan_sub = self.create_subscription(
            LaserScan, '/scan', self.scan_callback, scan_qos
        )

        self.latest_scan = None
        self.start_wall_time = time.time()
        self.state = 'FORWARD'
        self.turn_dir = 1.0
        self.turn_start_time = 0.0

        self.timer = self.create_timer(0.1, self.control_loop)  # 10 Hz
        self.get_logger().info(f'Coverage driver started for {duration_sec} seconds.')

    def scan_callback(self, msg: LaserScan):
        self.latest_scan = msg

    def control_loop(self):
        elapsed = time.time() - self.start_wall_time
        if elapsed >= self.duration_sec:
            self.stop_robot()
            self.get_logger().info('Completed 180 seconds coverage route.')
            rclpy.shutdown()
            return

        twist_msg = TwistStamped()
        twist_msg.header.stamp = self.get_clock().now().to_msg()
        twist_msg.header.frame_id = 'base_footprint'

        # Analyze laser scan if available
        min_front = 999.0
        left_dist = 999.0
        right_dist = 999.0

        if self.latest_scan is not None:
            scan = self.latest_scan
            num_readings = len(scan.ranges)
            for i, r in enumerate(scan.ranges):
                if math.isnan(r) or math.isinf(r) or r < scan.range_min or r > scan.range_max:
                    continue
                angle = scan.angle_min + i * scan.angle_increment
                # Normalize angle to [-pi, pi]
                angle = math.atan2(math.sin(angle), math.cos(angle))

                # Front sector: -40 to +40 deg (~0.7 rad)
                if abs(angle) < 0.7:
                    if r < min_front:
                        min_front = r
                # Left sector: +20 to +90 deg
                if 0.35 < angle < 1.57:
                    if r < left_dist:
                        left_dist = r
                # Right sector: -90 to -20 deg
                if -1.57 < angle < -0.35:
                    if r < right_dist:
                        right_dist = r

        # State machine
        # Front obstacle threshold: 0.42 m
        if min_front < 0.42:
            if self.state != 'TURN':
                self.state = 'TURN'
                self.turn_start_time = time.time()
                # Turn away from closer obstacle
                if left_dist > right_dist:
                    self.turn_dir = 1.0  # Turn left
                else:
                    self.turn_dir = -1.0  # Turn right
        elif self.state == 'TURN':
            # Continue turning until front is clear (> 0.75m) and at least 0.8s elapsed
            if min_front > 0.75 and (time.time() - self.turn_start_time > 0.8):
                self.state = 'FORWARD'

        if self.state == 'TURN':
            twist_msg.twist.linear.x = -0.02 if min_front < 0.25 else 0.0
            twist_msg.twist.angular.z = self.turn_dir * 0.45
        else:
            # Forward with slight sinusoidal wandering to sweep and cover area
            twist_msg.twist.linear.x = 0.16
            twist_msg.twist.angular.z = 0.15 * math.sin(elapsed * 0.25)

        self.cmd_pub.publish(twist_msg)

    def stop_robot(self):
        twist_msg = TwistStamped()
        twist_msg.header.stamp = self.get_clock().now().to_msg()
        twist_msg.header.frame_id = 'base_footprint'
        twist_msg.twist.linear.x = 0.0
        twist_msg.twist.angular.z = 0.0
        self.cmd_pub.publish(twist_msg)


def main():
    rclpy.init()
    duration = 180.0
    if len(sys.argv) > 1:
        duration = float(sys.argv[1])
    node = CoverageDriver(duration_sec=duration)
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        if rclpy.ok():
            node.stop_robot()
            node.destroy_node()
            rclpy.shutdown()


if __name__ == '__main__':
    main()
