import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist
from std_srvs.srv import SetBool
from turtlesim.msg import Pose
from my_robot_interfaces.msg import RobotStatus

from chiku_control.control_math import p_control


class Patrol(Node):
    """Mini-project: visit waypoints forever. Pause with a service, report on a topic."""

    def __init__(self):
        super().__init__('patrol')
        self.declare_parameter('waypoints', [2.0, 2.0, 9.0, 2.0, 9.0, 9.0, 2.0, 9.0])  # x1, y1, x2, y2, ...
        self.declare_parameter('kv', 1.0)
        self.declare_parameter('kw', 4.0)
        flat = list(self.get_parameter('waypoints').value)
        self.points = list(zip(flat[0::2], flat[1::2]))
        self.index = 0
        self.paused = False
        self.pose = None
        self.cmd_pub = self.create_publisher(Twist, 'turtle1/cmd_vel', 10)
        self.status_pub = self.create_publisher(RobotStatus, 'chiku/status', 10)
        self.create_subscription(Pose, 'turtle1/pose', self.on_pose, 10)
        self.create_service(SetBool, 'patrol/pause', self.on_pause)
        self.create_timer(0.1, self.control)
        self.create_timer(1.0, self.report)
        self.get_logger().info(f'Patrolling {len(self.points)} waypoints')

    def on_pose(self, msg):
        self.pose = msg

    def on_pause(self, request, response):
        self.paused = request.data
        response.success = True
        response.message = 'paused' if self.paused else 'patrolling'
        return response

    def control(self):
        cmd = Twist()
        if self.pose is not None and not self.paused:
            gx, gy = self.points[self.index]
            if math.hypot(gx - self.pose.x, gy - self.pose.y) < 0.15:
                self.index = (self.index + 1) % len(self.points)
                self.get_logger().info(f'reached waypoint, next is {self.points[self.index]}')
            else:
                cmd.linear.x, cmd.angular.z = p_control(
                    self.pose.x, self.pose.y, self.pose.theta, gx, gy,
                    self.get_parameter('kv').value, self.get_parameter('kw').value)
        self.cmd_pub.publish(cmd)

    def report(self):
        if self.pose is None:
            return
        msg = RobotStatus()
        msg.name = 'chiku'
        msg.x, msg.y = self.pose.x, self.pose.y
        msg.battery = 100.0
        msg.moving = not self.paused
        self.status_pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = Patrol()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
