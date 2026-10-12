import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException


class HelloNode(Node):
    def __init__(self):
        super().__init__('hello_node')          # give the node its name
        self.get_logger().info('Hello! Chiku is awake.')


def main(args=None):
    rclpy.init(args=args)                       # 1. start ROS 2 in this program
    node = HelloNode()                          # 2. create the node
    try:
        rclpy.spin(node)                        # 3. keep it alive, run callbacks
    except (KeyboardInterrupt, ExternalShutdownException):   # Ctrl+C lands here
        pass
    node.destroy_node()                         # 4. destroy the node
    rclpy.try_shutdown()                        # 5. shut ROS 2 down


if __name__ == '__main__':
    main()
