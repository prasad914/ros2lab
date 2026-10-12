import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist


class CircleDriver(Node):
    def __init__(self):
        super().__init__('circle_driver')
        self.pub = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.timer = self.create_timer(0.1, self.on_timer)    # 10 Hz, like a real robot
        self.get_logger().info('Driving in a circle. Press Ctrl+C to stop.')

    def on_timer(self):
        msg = Twist()
        msg.linear.x = 1.0      # forward, metres per second
        msg.angular.z = 0.5     # turn left, radians per second
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = CircleDriver()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
