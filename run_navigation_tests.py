import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseWithCovarianceStamped
from nav2_msgs.action import NavigateToPose
from action_msgs.msg import GoalStatus
from rclpy.action import ActionClient
import yaml
import time
import subprocess
import os

class NavTestRunner(Node):
    def __init__(self):
        super().__init__('nav_test_runner')
        self.initial_pose_pub = self.create_publisher(PoseWithCovarianceStamped, '/initialpose', 10)
        self.nav_client = ActionClient(self, NavigateToPose, 'navigate_to_pose')

    def publish_initial_pose(self):
        msg = PoseWithCovarianceStamped()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'map'
        msg.pose.pose.position.x = 0.0
        msg.pose.pose.position.y = 0.0
        msg.pose.pose.position.z = 0.0
        msg.pose.pose.orientation.w = 1.0
        # Spec S4 covariance matrix (36 elements): variance in x, y, yaw
        cov = [0.0] * 36
        cov[0] = 0.25  # x covariance
        cov[7] = 0.25  # y covariance
        cov[35] = 0.0683 # yaw covariance
        msg.pose.covariance = cov

        self.get_logger().info("Publishing initial pose...")
        self.initial_pose_pub.publish(msg)
        time.sleep(1.0)

    def send_goal(self, goal_pose):
        if not self.nav_client.wait_for_server(timeout_sec=10.0):
            self.get_logger().error("Action server /navigate_to_pose not available!")
            return False

        goal_msg = NavigateToPose.Goal()
        goal_msg.pose.header.stamp = self.get_clock().now().to_msg()
        goal_msg.pose.header.frame_id = 'map'
        goal_msg.pose.pose = goal_pose

        self.get_logger().info(f"Sending goal: x={goal_pose.position.x}, y={goal_pose.position.y}")
        send_goal_future = self.nav_client.send_goal_async(goal_msg)

        rclpy.spin_until_future_complete(self, send_goal_future, timeout_sec=5.0)
        goal_handle = send_goal_future.result()
        if not goal_handle or not goal_handle.accepted:
            self.get_logger().error("Goal rejected!")
            return False

        get_result_future = goal_handle.get_result_async()
        rclpy.spin_until_future_complete(self, get_result_future, timeout_sec=60.0)
        result = get_result_future.result()
        if result and result.status == GoalStatus.STATUS_SUCCEEDED:
            self.get_logger().info("Goal succeeded!")
            return True
        else:
            self.get_logger().warn(f"Goal finished with status: {result.status if result else 'unknown'}")
            return False

def main():
    with open('tests/fixtures/goals.yaml', 'r') as f:
        data = yaml.safe_load(f)

    goals = data['goals']

    rclpy.init()
    runner = NavTestRunner()

    for run_idx in range(1, 11):
        run_label = f"run{run_idx}"
        print(f"=== Starting {run_label} ===")

        # Start bag recording via subprocess
        bag_proc = subprocess.run(['./scripts/record_bag.sh', 'start', 'tb3_burger', 'nav_robotis', '41', run_label])
        time.sleep(3.0)

        # Publish initial pose
        runner.publish_initial_pose()
        time.sleep(2.0)

        # Send each of the 5 goals
        for g in goals:
            p = g['pose']
            from geometry_msgs.msg import Pose
            pose = Pose()
            pose.position.x = p['position']['x']
            pose.position.y = p['position']['y']
            pose.position.z = p['position']['z']
            pose.orientation.x = p['orientation']['x']
            pose.orientation.y = p['orientation']['y']
            pose.orientation.z = p['orientation']['z']
            pose.orientation.w = p['orientation']['w']

            runner.send_goal(pose)
            time.sleep(2.0)

        # Stop bag recording
        subprocess.run(['./scripts/record_bag.sh', 'stop', '41'])
        time.sleep(2.0)

    runner.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
