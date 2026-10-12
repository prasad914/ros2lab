import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException


class Heartbeat(Node):
    def __init__(self):
        super().__init__('heartbeat')
        self.count = 0
        self.start = self.get_clock().now()
        self.timer = self.create_timer(0.5, self.on_timer)   # every 0.5 s = 2 Hz

    def on_timer(self):
        self.count += 1
        elapsed = (self.get_clock().now() - self.start).nanoseconds / 1e9
        self.get_logger().info(f'beat {self.count} after {elapsed:.1f} s')
        if self.count == 10:
            self.get_logger().info('10 beats done, stopping the timer')
            self.timer.cancel()


def main(args=None):
    rclpy.init(args=args)
    node = Heartbeat()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
