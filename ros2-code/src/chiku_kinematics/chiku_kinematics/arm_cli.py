import sys

import rclpy
from rclpy.node import Node
from my_robot_interfaces.srv import MoveArm


class ArmCli(Node):
    """The human side: type a point, the robot answers."""

    def __init__(self):
        super().__init__('arm_cli')
        self.client = self.create_client(MoveArm, 'move_arm')
        while not self.client.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('waiting for /move_arm ...')

    def move(self, x, y):
        future = self.client.call_async(MoveArm.Request(x=x, y=y))
        rclpy.spin_until_future_complete(self, future)
        return future.result()


def main(args=None):
    rclpy.init(args=args)
    node = ArmCli()
    print('Type a target like "1.2 0.5" (metres). Type q to quit.')
    for line in sys.stdin:                      # one line per target
        line = line.strip()
        if line in ('q', 'quit', 'exit'):
            break
        try:
            x, y = (float(v) for v in line.split())
        except ValueError:
            print('Please type two numbers, for example: 1.2 0.5')
            continue
        res = node.move(x, y)
        print(('OK: ' if res.success else 'NO: ') + res.message)
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
