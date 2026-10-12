import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException


class LogDemo(Node):
    def __init__(self):
        super().__init__('log_demo')
        self.battery = 100.0
        self.create_timer(0.2, self.on_timer)                 # 5 times per second
        self.get_logger().info('Battery watcher started', once=True)

    def on_timer(self):
        self.battery -= 1.5
        log = self.get_logger()
        log.debug(f'raw battery value: {self.battery:.1f}')          # hidden unless --log-level debug
        log.info(f'battery {self.battery:.0f} %', throttle_duration_sec=1.0)   # at most once per second
        if self.battery < 80.0:
            log.warn('battery below 80 %', once=True)                # only the first time
        if self.battery < 70.0:
            log.error('battery low, going home!', throttle_duration_sec=2.0)


def main(args=None):
    rclpy.init(args=args)
    node = LogDemo()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
