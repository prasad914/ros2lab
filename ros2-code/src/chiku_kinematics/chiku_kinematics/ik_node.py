import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Point
from sensor_msgs.msg import JointState

from chiku_kinematics.kin_math import ik


class IkNode(Node):
    """Inverse kinematics: /target_point (where should the tip go?) in, /joint_states out."""

    def __init__(self):
        super().__init__('ik_node')
        self.declare_parameter('link1_length', 1.0)
        self.declare_parameter('link2_length', 0.8)
        self.declare_parameter('elbow_up', False)
        self.q = [0.0, 0.0]
        self.pub = self.create_publisher(JointState, 'joint_states', 10)
        self.create_subscription(Point, 'target_point', self.on_target, 10)
        self.create_timer(0.1, self.publish_joints)    # keep publishing, so others always know the angles
        l1 = self.get_parameter('link1_length').value
        l2 = self.get_parameter('link2_length').value
        self.get_logger().info(f'2-link arm IK node ready: link1={l1} m, link2={l2} m, reach={l1 + l2} m')

    def lengths(self):
        return self.get_parameter('link1_length').value, self.get_parameter('link2_length').value

    def on_target(self, msg):
        l1, l2 = self.lengths()
        sol = ik(l1, l2, msg.x, msg.y, self.get_parameter('elbow_up').value)
        if sol is None:
            self.get_logger().warn(
                f'Target ({msg.x:.2f}, {msg.y:.2f}) is out of reach: distance '
                f'{math.hypot(msg.x, msg.y):.2f} m, reach {l1 + l2:.2f} m')
            return
        self.q = list(sol)
        self.get_logger().info(
            f'IK solution: shoulder={sol[0]:.3f} rad ({math.degrees(sol[0]):.1f} deg), '
            f'elbow={sol[1]:.3f} rad ({math.degrees(sol[1]):.1f} deg)')
        self.publish_joints()

    def publish_joints(self):
        msg = JointState()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.name = ['shoulder_joint', 'elbow_joint']
        msg.position = self.q
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = IkNode()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
