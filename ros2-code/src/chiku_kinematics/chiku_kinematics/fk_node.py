import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rclpy.qos import QoSProfile, DurabilityPolicy
from geometry_msgs.msg import Point
from sensor_msgs.msg import JointState

from chiku_kinematics.kin_math import fk


class FkNode(Node):
    """Forward kinematics: /joint_states in, /end_effector (where is the tip?) out."""

    def __init__(self):
        super().__init__('fk_node')
        self.l1 = self.declare_parameter('link1_length', 1.0).value
        self.l2 = self.declare_parameter('link2_length', 0.8).value
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)   # keeps the last answer
        self.pub = self.create_publisher(Point, 'end_effector', latched)  # a late echo still gets it
        self.create_subscription(JointState, 'joint_states', self.on_joints, 10)

    def on_joints(self, msg):
        joints = dict(zip(msg.name, msg.position))         # match by NAME, not by order
        if 'shoulder_joint' not in joints or 'elbow_joint' not in joints:
            return
        x, y = fk(self.l1, self.l2, joints['shoulder_joint'], joints['elbow_joint'])
        self.pub.publish(Point(x=x, y=y, z=0.0))
        self.get_logger().info(f'tip at x={x:.3f} y={y:.3f}', throttle_duration_sec=1.0)


def main(args=None):
    rclpy.init(args=args)
    node = FkNode()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
