import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from turtlesim.msg import Pose
from my_robot_interfaces.msg import RobotStatus


class StatusPublisher(Node):
    def __init__(self):
        super().__init__('status_publisher')
        self.pose = Pose()
        self.battery = 100.0
        self.pub = self.create_publisher(RobotStatus, 'chiku/status', 10)
        self.create_subscription(Pose, '/turtle1/pose', self.on_pose, 10)
        self.create_timer(0.5, self.on_timer)        # 2 Hz

    def on_pose(self, msg):
        self.pose = msg

    def on_timer(self):
        self.battery = max(0.0, self.battery - 0.1)
        msg = RobotStatus()
        msg.name = 'chiku'
        msg.x = self.pose.x
        msg.y = self.pose.y
        msg.battery = self.battery
        msg.moving = abs(self.pose.linear_velocity) > 0.01 or abs(self.pose.angular_velocity) > 0.01
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = StatusPublisher()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
