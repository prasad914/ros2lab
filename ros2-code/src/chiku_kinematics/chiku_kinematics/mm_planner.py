import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Point, Twist
from nav_msgs.msg import Odometry

from chiku_kinematics.kin_math import quaternion_to_yaw, world_to_base


class MmPlanner(Node):
    """Mobile manipulator: drive the base until the goal is within reach, then hand it to the arm."""

    def __init__(self):
        super().__init__('mm_planner')
        l1 = self.declare_parameter('link1_length', 1.0).value
        l2 = self.declare_parameter('link2_length', 0.8).value
        self.stop_at = self.declare_parameter('approach_ratio', 0.7).value * (l1 + l2)
        self.base = None                  # (x, y, theta) from /odom
        self.goal = None                  # (x, y) in the odom frame
        self.state = 'IDLE'
        self.cmd_pub = self.create_publisher(Twist, 'cmd_vel', 10)
        self.arm_pub = self.create_publisher(Point, 'target_point', 10)
        self.create_subscription(Odometry, 'odom', self.on_odom, 10)
        self.create_subscription(Point, 'goal_point', self.on_goal, 10)
        self.create_timer(0.1, self.step)
        self.get_logger().info('Mobile manipulator planner ready. Send a goal on /goal_point')

    def on_odom(self, msg):
        p, q = msg.pose.pose.position, msg.pose.pose.orientation
        self.base = (p.x, p.y, quaternion_to_yaw(q.z, q.w))

    def on_goal(self, msg):
        self.goal = (msg.x, msg.y)
        self.state = 'TURN'
        self.get_logger().info(f'New goal ({msg.x:.2f}, {msg.y:.2f})')

    def step(self):
        if self.base is None or self.goal is None:
            return
        bx, by, bth = self.base
        lx, ly = world_to_base(self.goal[0], self.goal[1], bx, by, bth)   # goal seen from the robot
        distance, bearing = math.hypot(lx, ly), math.atan2(ly, lx)
        cmd = Twist()
        if self.state == 'TURN':
            if distance <= self.stop_at:
                self.state = 'REACH'
            elif abs(bearing) > 0.05:
                cmd.angular.z = max(-1.0, min(1.0, 2.0 * bearing))
            else:
                self.state = 'DRIVE'
                self.get_logger().info(f'Facing the goal, driving {distance - self.stop_at:.2f} m')
        elif self.state == 'DRIVE':
            if distance <= self.stop_at:
                self.state = 'REACH'
            else:
                cmd.linear.x = min(0.5, distance - self.stop_at + 0.05)
                cmd.angular.z = 2.0 * bearing
        if self.state == 'REACH':
            self.arm_pub.publish(Point(x=lx, y=ly, z=0.0))
            self.get_logger().info(f'Within reach: arm target in base_link = ({lx:.2f}, {ly:.2f})')
            self.state, self.goal = 'IDLE', None
        self.cmd_pub.publish(cmd)


def main(args=None):
    rclpy.init(args=args)
    node = MmPlanner()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
