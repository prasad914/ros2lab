import rclpy
from rclpy.node import Node
from rclpy.callback_groups import MutuallyExclusiveCallbackGroup
from rclpy.executors import ExternalShutdownException, MultiThreadedExecutor
from std_srvs.srv import Trigger


class BatteryChecker(Node):
    """A timer that calls a service and WAITS for the answer, without freezing the node."""

    def __init__(self):
        super().__init__('battery_checker')
        self.level = 100
        self.create_service(Trigger, 'chiku/battery', self.on_battery)   # server (default group)
        self.client_group = MutuallyExclusiveCallbackGroup()             # the client gets its own group
        self.timer_group = MutuallyExclusiveCallbackGroup()              # and so does the timer
        self.client = self.create_client(Trigger, 'chiku/battery', callback_group=self.client_group)
        self.create_timer(2.0, self.on_timer, callback_group=self.timer_group)

    def on_battery(self, request, response):
        self.level -= 7
        response.success = self.level > 20
        response.message = f'{self.level} %'
        return response

    def on_timer(self):
        if not self.client.service_is_ready():
            return
        result = self.client.call(Trigger.Request())     # blocking call: OK here, see main()
        self.get_logger().info(f'battery: {result.message} (ok={result.success})')


def main(args=None):
    rclpy.init(args=args)
    node = BatteryChecker()
    executor = MultiThreadedExecutor()      # several threads: the answer can arrive while on_timer waits
    executor.add_node(node)
    try:
        executor.spin()
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
