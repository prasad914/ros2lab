import time

import rclpy
from rclpy.node import Node
from rclpy.action import ActionServer, CancelResponse, GoalResponse
from rclpy.executors import ExternalShutdownException, MultiThreadedExecutor
from geometry_msgs.msg import Twist
from my_robot_interfaces.action import DriveDistance


class DriveDistanceServer(Node):
    def __init__(self):
        super().__init__('drive_distance_server')
        self.pub = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.server = ActionServer(
            self, DriveDistance, 'chiku/drive_distance',
            execute_callback=self.execute,
            goal_callback=self.on_goal,
            cancel_callback=self.on_cancel)
        self.get_logger().info('Action server /chiku/drive_distance is ready')

    def on_goal(self, goal_request):
        if goal_request.distance <= 0.0 or not 0.0 < goal_request.speed <= 2.0:
            self.get_logger().warn('Rejected: distance must be > 0 and speed in (0, 2]')
            return GoalResponse.REJECT
        return GoalResponse.ACCEPT

    def on_cancel(self, goal_handle):
        self.get_logger().info('Cancel requested')
        return CancelResponse.ACCEPT

    def execute(self, goal_handle):
        goal = goal_handle.request
        driven = 0.0
        feedback = DriveDistance.Feedback()
        result = DriveDistance.Result()
        while driven < goal.distance:
            if goal_handle.is_cancel_requested:
                self.pub.publish(Twist())              # stop the robot first
                goal_handle.canceled()
                result.distance_driven = driven
                return result
            cmd = Twist()
            cmd.linear.x = goal.speed
            self.pub.publish(cmd)
            time.sleep(0.1)                            # 10 Hz
            driven = min(goal.distance, driven + goal.speed * 0.1)
            feedback.remaining = goal.distance - driven
            goal_handle.publish_feedback(feedback)
        self.pub.publish(Twist())
        goal_handle.succeed()
        result.distance_driven = driven
        self.get_logger().info(f'Done: drove {driven:.2f} m')
        return result


def main(args=None):
    rclpy.init(args=args)
    node = DriveDistanceServer()
    executor = MultiThreadedExecutor()     # so cancel requests are handled while execute() runs
    executor.add_node(node)
    try:
        executor.spin()
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
