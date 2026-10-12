import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from sensor_msgs.msg import JointState


class HeadJoints(Node):
    """Builds a JointState message by hand: header + stamp + lists."""

    def __init__(self):
        super().__init__('head_joints')
        self.pub = self.create_publisher(JointState, 'joint_states', 10)
        self.t = 0.0
        self.create_timer(0.05, self.on_timer)     # 20 Hz

    def on_timer(self):
        self.t += 0.05
        msg = JointState()
        msg.header.stamp = self.get_clock().now().to_msg()   # WHEN these values were true
        msg.header.frame_id = ''                             # joint states need no frame
        msg.name = ['head_pan', 'head_tilt']                 # lists: same order everywhere
        msg.position = [0.8 * math.sin(self.t), 0.3 * math.sin(2.0 * self.t)]
        msg.velocity = [0.8 * math.cos(self.t), 0.6 * math.cos(2.0 * self.t)]
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = HeadJoints()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
