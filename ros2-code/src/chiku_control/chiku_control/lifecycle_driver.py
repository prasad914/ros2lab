import rclpy
from rclpy.lifecycle import LifecycleNode, State, TransitionCallbackReturn
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist


class LifecycleDriver(LifecycleNode):
    """A managed node: it only drives after someone configures AND activates it."""

    def __init__(self):
        super().__init__('lifecycle_driver')
        self.pub = None
        self.timer = None

    def on_configure(self, state: State) -> TransitionCallbackReturn:
        self.pub = self.create_lifecycle_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.get_logger().info('configured: publisher created, not driving yet')
        return TransitionCallbackReturn.SUCCESS

    def on_activate(self, state: State) -> TransitionCallbackReturn:
        self.timer = self.create_timer(0.1, self.on_timer)
        self.get_logger().info('activated: driving')
        return super().on_activate(state)          # also activates the lifecycle publisher

    def on_deactivate(self, state: State) -> TransitionCallbackReturn:
        self.destroy_timer(self.timer)
        self.get_logger().info('deactivated: stopped')
        return super().on_deactivate(state)

    def on_cleanup(self, state: State) -> TransitionCallbackReturn:
        self.destroy_publisher(self.pub)
        self.get_logger().info('cleaned up')
        return TransitionCallbackReturn.SUCCESS

    def on_timer(self):
        msg = Twist()
        msg.linear.x = 1.0
        msg.angular.z = 1.0
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = LifecycleDriver()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
