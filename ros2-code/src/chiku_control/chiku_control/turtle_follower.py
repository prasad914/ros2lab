import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rclpy.time import Time
from geometry_msgs.msg import Twist
from tf2_ros import TransformException
from tf2_ros.buffer import Buffer
from tf2_ros.transform_listener import TransformListener
from turtlesim.srv import Spawn


class TurtleFollower(Node):
    """turtle2 chases turtle1, using tf2 to ask: where is turtle1, seen from turtle2?"""

    def __init__(self):
        super().__init__('turtle_follower')
        self.buffer = Buffer()
        self.listener = TransformListener(self.buffer, self)
        self.spawner = self.create_client(Spawn, '/spawn')
        self.spawned = False
        self.pub = self.create_publisher(Twist, '/turtle2/cmd_vel', 10)
        self.create_timer(0.1, self.on_timer)

    def on_timer(self):
        if not self.spawned:
            if self.spawner.service_is_ready():
                self.spawner.call_async(Spawn.Request(x=1.0, y=1.0, theta=0.0, name='turtle2'))
                self.spawned = True
            return
        try:
            t = self.buffer.lookup_transform('turtle2', 'turtle1', Time())   # target, source, latest
        except TransformException as ex:
            self.get_logger().info(f'Could not transform turtle1 to turtle2: {ex}',
                                   throttle_duration_sec=2.0)
            return
        x, y = t.transform.translation.x, t.transform.translation.y      # turtle1 in turtle2's frame
        cmd = Twist()
        cmd.angular.z = 1.0 * math.atan2(y, x)
        cmd.linear.x = 0.5 * math.hypot(x, y)
        self.pub.publish(cmd)


def main(args=None):
    rclpy.init(args=args)
    node = TurtleFollower()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
