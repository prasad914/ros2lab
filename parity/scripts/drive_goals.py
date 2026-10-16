#!/usr/bin/env python3
"""
drive_goals.py - Automated navigation test driver for Nav2 parity testing.
Reads parity/fixtures/goals.yaml, publishes /initialpose with spec S4 covariance,
waits for AMCL and Nav2 activation, and dispatches navigation goals via
the NavigateToPose Action Client.
Records AMCL localization metrics and navigation durations for statistics.
"""

import sys
import os
import time
import math
import argparse
import json
import yaml
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from rclpy.parameter import Parameter
from rcl_interfaces.srv import SetParameters
from geometry_msgs.msg import PoseWithCovarianceStamped, PoseStamped
from nav_msgs.msg import Odometry
from nav2_msgs.action import NavigateToPose
from action_msgs.msg import GoalStatus


def quat_to_yaw(q):
    siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
    cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
    return math.atan2(siny_cosp, cosy_cosp)


class Nav2GoalDriver(Node):
    def __init__(self, goals_yaml_path):
        super().__init__(
            'nav2_goal_driver',
            parameter_overrides=[
                Parameter('use_sim_time', Parameter.Type.BOOL, True)
            ]
        )
        with open(goals_yaml_path, 'r') as f:
            self.cfg = yaml.safe_load(f)

        self.amcl_pose_received = False
        self.latest_amcl_pose = None
        self.latest_odom = None

        self.initialpose_pub = self.create_publisher(
            PoseWithCovarianceStamped,
            '/initialpose',
            10
        )
        self.amcl_sub = self.create_subscription(
            PoseWithCovarianceStamped,
            '/amcl_pose',
            self._amcl_cb,
            10
        )
        self.odom_sub = self.create_subscription(
            Odometry,
            '/odom',
            self._odom_cb,
            10
        )
        self.nav_client = ActionClient(self, NavigateToPose, 'navigate_to_pose')

    def _amcl_cb(self, msg):
        self.amcl_pose_received = True
        self.latest_amcl_pose = msg

    def _odom_cb(self, msg):
        self.latest_odom = msg

    def configure_collision_monitor(self):
        client = self.create_client(SetParameters, '/collision_monitor/set_parameters')
        if client.wait_for_service(timeout_sec=5.0):
            req = SetParameters.Request()
            param = Parameter('scan.source_timeout', Parameter.Type.DOUBLE, 1.0)
            req.parameters = [param.to_parameter_msg()]
            future = client.call_async(req)
            rclpy.spin_until_future_complete(self, future, timeout_sec=3.0)
            self.get_logger().info("Set /collision_monitor scan.source_timeout to 1.0s")
        else:
            self.get_logger().warn("/collision_monitor set_parameters service not available, continuing")

    def publish_initial_pose(self, max_wait_sec=30.0):
        sp = self.cfg['start_pose']
        msg = PoseWithCovarianceStamped()
        msg.header.frame_id = sp.get('frame_id', 'map')
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.pose.pose.position.x = float(sp['position']['x'])
        msg.pose.pose.position.y = float(sp['position']['y'])
        msg.pose.pose.position.z = float(sp['position']['z'])
        msg.pose.pose.orientation.x = float(sp['orientation']['x'])
        msg.pose.pose.orientation.y = float(sp['orientation']['y'])
        msg.pose.pose.orientation.z = float(sp['orientation']['z'])
        msg.pose.pose.orientation.w = float(sp['orientation']['w'])
        msg.pose.covariance = [float(c) for c in sp['covariance']]

        self.get_logger().info(
            f"Publishing /initialpose at ({msg.pose.pose.position.x:.2f}, {msg.pose.pose.position.y:.2f}) with S4 covariance..."
        )

        start = time.time()
        while not self.amcl_pose_received and (time.time() - start < max_wait_sec):
            msg.header.stamp = self.get_clock().now().to_msg()
            self.initialpose_pub.publish(msg)
            rclpy.spin_once(self, timeout_sec=0.5)
            time.sleep(0.5)

        if self.amcl_pose_received:
            self.get_logger().info("Received /amcl_pose confirmation from AMCL!")
            return True
        else:
            self.get_logger().warn("Did not receive /amcl_pose before timeout, proceeding anyway.")
            return False

    def wait_for_server(self, timeout_sec=60.0):
        self.get_logger().info("Waiting for navigate_to_pose action server...")
        start = time.time()
        while not self.nav_client.wait_for_server(timeout_sec=2.0):
            rclpy.spin_once(self, timeout_sec=0.2)
            if time.time() - start > timeout_sec:
                self.get_logger().error("Timed out waiting for navigate_to_pose server!")
                return False
            self.get_logger().info("Still waiting for navigate_to_pose server...")
        self.get_logger().info("navigate_to_pose action server is ready!")
        return True

    def send_goal(self, goal_data, timeout_sec=180.0):
        # Flush incoming callbacks
        for _ in range(5):
            rclpy.spin_once(self, timeout_sec=0.05)

        goal_x = float(goal_data['position']['x'])
        goal_y = float(goal_data['position']['y'])

        goal_msg = NavigateToPose.Goal()
        goal_msg.pose.header.frame_id = goal_data.get('frame_id', 'map')
        goal_msg.pose.header.stamp = self.get_clock().now().to_msg()
        goal_msg.pose.pose.position.x = goal_x
        goal_msg.pose.pose.position.y = goal_y
        goal_msg.pose.pose.position.z = float(goal_data['position']['z'])
        goal_msg.pose.pose.orientation.x = float(goal_data['orientation']['x'])
        goal_msg.pose.pose.orientation.y = float(goal_data['orientation']['y'])
        goal_msg.pose.pose.orientation.z = float(goal_data['orientation']['z'])
        goal_msg.pose.pose.orientation.w = float(goal_data['orientation']['w'])

        self.get_logger().info(f"Sending goal to ({goal_x:.2f}, {goal_y:.2f})")

        send_future = self.nav_client.send_goal_async(goal_msg)
        rclpy.spin_until_future_complete(self, send_future, timeout_sec=10.0)
        if not send_future.done():
            self.get_logger().warn("send_goal_async timed out!")
            return {
                "success": False,
                "duration": 0.0,
                "wall_duration": 0.0,
                "status": "SEND_TIMEOUT",
                "goal_target": [goal_x, goal_y]
            }

        goal_handle = send_future.result()
        if not goal_handle.accepted:
            self.get_logger().warn("Goal was rejected by server!")
            return {
                "success": False,
                "duration": 0.0,
                "wall_duration": 0.0,
                "status": "REJECTED",
                "goal_target": [goal_x, goal_y]
            }

        self.get_logger().info("Goal accepted by server. Navigating...")
        start_sim = self.get_clock().now()
        start_wall = time.time()
        result_future = goal_handle.get_result_async()

        while not result_future.done():
            rclpy.spin_once(self, timeout_sec=0.2)
            elapsed_sim = (self.get_clock().now() - start_sim).nanoseconds / 1e9
            if elapsed_sim > timeout_sec:
                self.get_logger().warn(f"Goal timed out after {elapsed_sim:.1f}s sim time! Cancelling...")
                cancel_future = goal_handle.cancel_goal_async()
                rclpy.spin_until_future_complete(self, cancel_future, timeout_sec=5.0)
                return {
                    "success": False,
                    "duration": elapsed_sim,
                    "wall_duration": time.time() - start_wall,
                    "status": "TIMED_OUT",
                    "goal_target": [goal_x, goal_y]
                }

        result = result_future.result()
        elapsed_sim = (self.get_clock().now() - start_sim).nanoseconds / 1e9
        elapsed_wall = time.time() - start_wall
        success = (result.status == GoalStatus.STATUS_SUCCEEDED)

        # Gather final metrics
        final_amcl = None
        pos_error = None
        cov_x = None
        cov_y = None
        cov_yaw = None
        yaw_error_deg = None

        if self.latest_amcl_pose is not None:
            ap = self.latest_amcl_pose.pose.pose
            target_yaw = quat_to_yaw(goal_msg.pose.pose.orientation)
            amcl_yaw = quat_to_yaw(ap.orientation)
            final_amcl = [ap.position.x, ap.position.y, amcl_yaw]
            pos_error = math.hypot(ap.position.x - goal_x, ap.position.y - goal_y)
            diff_yaw = (amcl_yaw - target_yaw + math.pi) % (2 * math.pi) - math.pi
            yaw_error_deg = abs(diff_yaw) * 180.0 / math.pi
            cov = self.latest_amcl_pose.pose.covariance
            cov_x = cov[0]
            cov_y = cov[7]
            cov_yaw = cov[35]

        if success:
            self.get_logger().info(f"Goal reached successfully in {elapsed_sim:.2f}s sim time ({elapsed_wall:.2f}s wall)! (Pos error: {pos_error:.3f}m, Yaw error: {yaw_error_deg:.1f}deg)")
        else:
            self.get_logger().warn(f"Goal completed with status {result.status} in {elapsed_sim:.2f}s sim time")

        return {
            "success": success,
            "duration": elapsed_sim,
            "wall_duration": elapsed_wall,
            "status": "SUCCEEDED" if success else str(result.status),
            "goal_target": [goal_x, goal_y],
            "final_amcl_pose": final_amcl,
            "position_error_m": pos_error,
            "yaw_error_deg": yaw_error_deg,
            "amcl_cov_x": cov_x,
            "amcl_cov_y": cov_y,
            "amcl_cov_yaw": cov_yaw
        }


def main():
    parser = argparse.ArgumentParser(description="Drive Nav2 goals from goals.yaml")
    parser.add_argument("--goals-yaml", default="parity/fixtures/goals.yaml")
    parser.add_argument("--goal-name", default=None, help="Specific goal to send (e.g. goal1, obstacle_goal)")
    parser.add_argument("--all-goals", action="store_true", help="Send all 5 goals sequentially")
    parser.add_argument("--skip-init-pose", action="store_true", help="Skip publishing initial pose")
    parser.add_argument("--timeout", type=float, default=180.0, help="Per-goal simulation timeout in seconds")
    parser.add_argument("--run-label", default="run1", help="Label for this run (e.g. run1)")
    parser.add_argument("--out-dir", default="parity/fixtures/tb3_burger/nav_robotis/runs")
    args = parser.parse_args()

    rclpy.init()
    driver = Nav2GoalDriver(args.goals_yaml)

    if not args.skip_init_pose:
        driver.publish_initial_pose()
        time.sleep(2.0)

    if not driver.wait_for_server(timeout_sec=60.0):
        rclpy.shutdown()
        sys.exit(1)

    driver.configure_collision_monitor()
    time.sleep(1.0)

    results = {}
    if args.goal_name:
        if args.goal_name == "obstacle_goal":
            g_data = driver.cfg["obstacle_goal"]
        else:
            g_data = driver.cfg["goals"][args.goal_name]
        res = driver.send_goal(g_data, timeout_sec=args.timeout)
        results[args.goal_name] = res
    elif args.all_goals:
        for g_name, g_data in driver.cfg["goals"].items():
            res = driver.send_goal(g_data, timeout_sec=args.timeout)
            results[g_name] = res
            time.sleep(1.0)

    print(f"\n--- Navigation Results Summary ({args.run_label}) ---")
    for g, r in results.items():
        status_str = "PASS" if r["success"] else "FAIL"
        err_str = f" err={r['position_error_m']:.3f}m" if r.get('position_error_m') is not None else ""
        print(f"  {g}: {status_str} ({r['duration']:.2f}s sim, {r.get('wall_duration', 0.0):.2f}s wall){err_str}")

    os.makedirs(args.out_dir, exist_ok=True)
    out_file = os.path.join(args.out_dir, f"{args.run_label}.json")
    with open(out_file, "w") as f:
        json.dump({
            "run_label": args.run_label,
            "timestamp": time.time(),
            "results": results
        }, f, indent=2)
    print(f"Saved run summary to {out_file}")

    driver.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
