import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Point
from sensor_msgs.msg import JointState

from chiku_kinematics.kin_math import ik


def smoothstep(s):
    """0 -> 0, 1 -> 1, and zero speed at both ends: no jerk at start and stop."""
    return 3 * s * s - 2 * s * s * s


class TrajectoryNode(Node):
    """Moves the joints smoothly to the IK solution instead of jumping there."""

    def __init__(self):
        super().__init__('trajectory_node')
        self.l1 = self.declare_parameter('link1_length', 1.0).value
        self.l2 = self.declare_parameter('link2_length', 0.8).value
        self.max_speed = self.declare_parameter('max_joint_speed', 1.0).value   # rad/s
        self.q = [0.0, 0.0]
        self.start, self.goal, self.duration, self.t = None, None, 0.0, 0.0
        self.pub = self.create_publisher(JointState, 'joint_states', 10)
        self.create_subscription(Point, 'target_point', self.on_target, 10)
        self.dt = 0.02
        self.create_timer(self.dt, self.step)          # 50 Hz

    def on_target(self, msg):
        sol = ik(self.l1, self.l2, msg.x, msg.y)
        if sol is None:
            self.get_logger().warn('out of reach')
            return
        self.start, self.goal = list(self.q), list(sol)
        biggest = max(abs(g - s) for g, s in zip(self.goal, self.start))
        self.duration = max(1.5 * biggest / self.max_speed, 0.2)   # slow enough for the joint limit
        self.t = 0.0
        self.get_logger().info(f'moving in {self.duration:.2f} s')

    def step(self):
        if self.goal is not None:
            self.t = min(self.t + self.dt, self.duration)
            k = smoothstep(self.t / self.duration)
            self.q = [s + (g - s) * k for s, g in zip(self.start, self.goal)]
            if self.t >= self.duration:
                self.goal = None
                self.get_logger().info(
                    f'arrived: {math.degrees(self.q[0]):.1f} deg, {math.degrees(self.q[1]):.1f} deg')
        msg = JointState()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.name = ['shoulder_joint', 'elbow_joint']
        msg.position = self.q
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = TrajectoryNode()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
