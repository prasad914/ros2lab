import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from turtlesim.msg import Pose


class PoseMonitor(Node):
    def __init__(self):
        super().__init__('pose_monitor')
        self.last = None            # the previous pose we received
        self.distance = 0.0         # metres travelled so far
        self.sub = self.create_subscription(Pose, '/turtle1/pose', self.on_pose, 10)
        self.create_timer(1.0, self.report)

    def on_pose(self, msg):
        if self.last is not None:
            self.distance += math.hypot(msg.x - self.last.x, msg.y - self.last.y)
        self.last = msg

    def report(self):
        if self.last is None:
            self.get_logger().warn('No pose yet. Is turtlesim running?')
            return
        p = self.last
        self.get_logger().info(
            f'x={p.x:.2f} y={p.y:.2f} theta={p.theta:.2f} travelled={self.distance:.2f} m')


def main(args=None):
    rclpy.init(args=args)
    node = PoseMonitor()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
