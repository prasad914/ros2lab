import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist
from std_srvs.srv import SetBool


class SwitchableDriver(Node):
    """Drives in a circle, but only while enabled. A service turns it on and off."""

    def __init__(self):
        super().__init__('switchable_driver')
        self.enabled = False
        self.pub = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.srv = self.create_service(SetBool, 'chiku/enable', self.on_enable)
        self.create_timer(0.1, self.on_timer)
        self.get_logger().info('Ready. Call /chiku/enable with data: true to start.')

    def on_enable(self, request, response):
        self.enabled = request.data
        response.success = True
        response.message = 'driving' if self.enabled else 'stopped'
        self.get_logger().info(f'enable = {self.enabled}')
        return response                                   # never forget this line

    def on_timer(self):
        msg = Twist()
        if self.enabled:
            msg.linear.x = 1.0
            msg.angular.z = 0.8
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = SwitchableDriver()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
