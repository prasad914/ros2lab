import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import TransformStamped
from tf2_ros import TransformBroadcaster
from turtlesim.msg import Pose


def yaw_to_quaternion(yaw):
    """A robot on the floor only turns around z: roll = pitch = 0."""
    return 0.0, 0.0, math.sin(yaw / 2.0), math.cos(yaw / 2.0)


class TurtleTfBroadcaster(Node):
    def __init__(self):
        super().__init__('turtle_tf_broadcaster')
        self.turtle = self.declare_parameter('turtlename', 'turtle1').value
        self.br = TransformBroadcaster(self)
        self.create_subscription(Pose, f'/{self.turtle}/pose', self.on_pose, 10)

    def on_pose(self, msg):
        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'world'            # parent frame
        t.child_frame_id = self.turtle         # child frame
        t.transform.translation.x = msg.x
        t.transform.translation.y = msg.y
        t.transform.translation.z = 0.0
        qx, qy, qz, qw = yaw_to_quaternion(msg.theta)
        t.transform.rotation.x = qx
        t.transform.rotation.y = qy
        t.transform.rotation.z = qz
        t.transform.rotation.w = qw
        self.br.sendTransform(t)


def main(args=None):
    rclpy.init(args=args)
    node = TurtleTfBroadcaster()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
