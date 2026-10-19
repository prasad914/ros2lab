#!/usr/bin/env python3
"""
Timed coverage route publisher for TurtleBot3 in Gazebo.
Publishes geometry_msgs/msg/TwistStamped to /cmd_vel at 10 Hz (sim time) for 180 SIM seconds.
Uses reactive obstacle avoidance with wander pattern to cover the environment.
Runs with use_sim_time=True: the duration is counted from /clock, so a slow simulation drives the same
simulated time. A wall-clock safety limit (default 3600 s) stops the drive if /clock is slow or missing.
Usage: drive_coverage.py [sim_seconds=180] [wall_limit_seconds=3600]   (exit 1 if the wall limit is hit)
"""

import sys
import time
import math
import rclpy
from rclpy.node import Node
from rclpy.clock import Clock, ClockType
from rclpy.executors import ExternalShutdownException
from rclpy.parameter import Parameter
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy
from geometry_msgs.msg import TwistStamped
from sensor_msgs.msg import LaserScan


class CoverageDriver(Node):
    def __init__(self, duration_sec=180.0, wall_limit_sec=3600.0):
        super().__init__('coverage_driver',
                         parameter_overrides=[Parameter('use_sim_time', Parameter.Type.BOOL, True)])
        self.duration_sec = duration_sec
        self.wall_limit_sec = wall_limit_sec
        self.timed_out = False

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
        self.start_sim_time = None   # set on the first control step with /clock running
        self.state = 'FORWARD'
        self.turn_dir = 1.0
        self.turn_start_time = 0.0

        self.timer = self.create_timer(0.1, self.control_loop)  # 10 Hz of sim time
        # The safety check runs on a steady clock, so it fires even when /clock never arrives.
        self.wall_timer = self.create_timer(1.0, self.wall_check, clock=Clock(clock_type=ClockType.STEADY_TIME))
        self.get_logger().info(f'Coverage driver started for {duration_sec} sim seconds '
                               f'(wall limit {wall_limit_sec} s).')

    def sim_now(self):
        return self.get_clock().now().nanoseconds / 1e9

    def wall_check(self):
        wall = time.time() - self.start_wall_time
        if wall >= self.wall_limit_sec:
            sim = 0.0 if self.start_sim_time is None else self.sim_now() - self.start_sim_time
            self.get_logger().error(f'Wall-clock limit {self.wall_limit_sec} s reached after {sim:.1f} sim seconds; stopping.')
            self.timed_out = True
            self.stop_robot()
            rclpy.shutdown()

    def scan_callback(self, msg: LaserScan):
        self.latest_scan = msg

    def control_loop(self):
        now = self.sim_now()
        if now == 0.0:          # no /clock yet
            return
        if self.start_sim_time is None:
            self.start_sim_time = now
        elapsed = now - self.start_sim_time
        if elapsed >= self.duration_sec:
            self.stop_robot()
            self.get_logger().info(f'Completed {self.duration_sec} sim seconds coverage route '
                                   f'({time.time() - self.start_wall_time:.1f} wall seconds).')
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
                self.turn_start_time = now
                # Turn away from closer obstacle
                if left_dist > right_dist:
                    self.turn_dir = 1.0  # Turn left
                else:
                    self.turn_dir = -1.0  # Turn right
        elif self.state == 'TURN':
            # Continue turning until front is clear (> 0.75m) and at least 0.8s elapsed
            if min_front > 0.75 and (now - self.turn_start_time > 0.8):
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
    duration = float(sys.argv[1]) if len(sys.argv) > 1 else 180.0
    wall_limit = float(sys.argv[2]) if len(sys.argv) > 2 else 3600.0
    node = CoverageDriver(duration_sec=duration, wall_limit_sec=wall_limit)
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, SystemExit, ExternalShutdownException):
        pass
    finally:
        if rclpy.ok():
            node.stop_robot()
            node.destroy_node()
            rclpy.shutdown()
    sys.exit(1 if node.timed_out else 0)


if __name__ == '__main__':
    main()
