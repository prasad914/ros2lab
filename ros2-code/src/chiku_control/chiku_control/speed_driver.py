import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist


class SpeedDriver(Node):
    """Drives in a circle. The speeds are PARAMETERS, so you can change them without editing code."""

    def __init__(self):
        super().__init__('speed_driver')
        self.declare_parameter('robot_name', 'chiku')     # name, default value
        self.declare_parameter('speed', 1.0)              # forward speed, m/s
        self.declare_parameter('turn', 0.5)               # turn rate, rad/s
        name = self.get_parameter('robot_name').value
        self.pub = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.create_timer(0.1, self.on_timer)
        self.get_logger().info(f'{name} is ready to drive')

    def on_timer(self):
        speed = self.get_parameter('speed').value        # read the newest value every tick
        turn = self.get_parameter('turn').value
        msg = Twist()
        msg.linear.x = speed
        msg.angular.z = turn
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = SpeedDriver()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
