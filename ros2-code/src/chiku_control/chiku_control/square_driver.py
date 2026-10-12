import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist


class SquareDriver(Node):
    """Open loop: drive 2 s forward, turn 90 degrees, repeat 4 times."""

    def __init__(self):
        super().__init__('square_driver')
        self.pub = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.state = 'FORWARD'      # the state machine: FORWARD -> TURN -> FORWARD ...
        self.ticks = 0              # how many 0.1 s ticks we spent in this state
        self.sides = 0
        self.timer = self.create_timer(0.1, self.on_timer)

    def on_timer(self):
        msg = Twist()
        self.ticks += 1
        if self.state == 'FORWARD':
            msg.linear.x = 1.0
            if self.ticks >= 20:                    # 20 ticks x 0.1 s = 2 s -> 2 m
                self.state, self.ticks = 'TURN', 0
        elif self.state == 'TURN':
            msg.angular.z = math.pi / 2             # 90 degrees per second
            if self.ticks >= 10:                    # 1 s -> 90 degrees
                self.state, self.ticks = 'FORWARD', 0
                self.sides += 1
                self.get_logger().info(f'side {self.sides} done')
        if self.sides == 4:
            self.get_logger().info('Square finished!')
            self.timer.cancel()
            msg = Twist()                           # all zeros = stop
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = SquareDriver()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
