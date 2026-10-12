import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rclpy.action import ActionClient
from my_robot_interfaces.action import DriveDistance


class DriveDistanceClient(Node):
    def __init__(self):
        super().__init__('drive_distance_client')
        self.declare_parameter('distance', 2.0)
        self.declare_parameter('speed', 0.5)
        self.declare_parameter('cancel_after', 0.0)      # seconds; 0 = never cancel
        self.client = ActionClient(self, DriveDistance, 'chiku/drive_distance')
        self.goal_handle = None

    def send(self):
        self.client.wait_for_server()
        goal = DriveDistance.Goal()
        goal.distance = self.get_parameter('distance').value
        goal.speed = self.get_parameter('speed').value
        self.get_logger().info(f'Sending goal: {goal.distance} m at {goal.speed} m/s')
        future = self.client.send_goal_async(goal, feedback_callback=self.on_feedback)
        future.add_done_callback(self.on_goal_response)

    def on_goal_response(self, future):
        self.goal_handle = future.result()
        if not self.goal_handle.accepted:
            self.get_logger().warn('Goal rejected')
            rclpy.shutdown()
            return
        self.get_logger().info('Goal accepted')
        self.goal_handle.get_result_async().add_done_callback(self.on_result)
        wait = self.get_parameter('cancel_after').value
        if wait > 0.0:
            self.cancel_timer = self.create_timer(wait, self.cancel)

    def on_feedback(self, feedback_msg):
        self.get_logger().info(f'remaining: {feedback_msg.feedback.remaining:.2f} m')

    def cancel(self):
        self.cancel_timer.cancel()
        self.get_logger().info('Changed my mind: cancelling')
        self.goal_handle.cancel_goal_async()

    def on_result(self, future):
        res = future.result()
        self.get_logger().info(f'Result: drove {res.result.distance_driven:.2f} m (status {res.status})')
        rclpy.shutdown()


def main(args=None):
    rclpy.init(args=args)
    node = DriveDistanceClient()
    node.send()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
