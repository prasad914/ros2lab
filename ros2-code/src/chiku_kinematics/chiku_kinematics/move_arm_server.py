import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from sensor_msgs.msg import JointState
from my_robot_interfaces.srv import MoveArm

from chiku_kinematics.kin_math import ik


class MoveArmServer(Node):
    """IK as a service: the user asks 'can you reach (x, y)?' and gets the angles back."""

    def __init__(self):
        super().__init__('move_arm_server')
        self.l1 = self.declare_parameter('link1_length', 1.0).value
        self.l2 = self.declare_parameter('link2_length', 0.8).value
        self.q = [0.0, 0.0]
        self.pub = self.create_publisher(JointState, 'joint_states', 10)
        self.create_service(MoveArm, 'move_arm', self.on_move)
        self.create_timer(0.1, self.publish_joints)
        self.get_logger().info('Service /move_arm is ready')

    def on_move(self, request, response):
        sol = ik(self.l1, self.l2, request.x, request.y)
        if sol is None:
            response.success = False
            response.message = (f'({request.x:.2f}, {request.y:.2f}) is out of reach '
                                f'(reach {self.l1 + self.l2:.2f} m)')
        else:
            self.q = list(sol)
            response.success = True
            response.shoulder, response.elbow = sol
            response.message = (f'moving: shoulder {math.degrees(sol[0]):.1f} deg, '
                                f'elbow {math.degrees(sol[1]):.1f} deg')
        self.get_logger().info(response.message)
        return response

    def publish_joints(self):
        msg = JointState()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.name = ['shoulder_joint', 'elbow_joint']
        msg.position = self.q
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = MoveArmServer()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
