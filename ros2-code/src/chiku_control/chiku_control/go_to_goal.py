import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist
from turtlesim.msg import Pose


class GoToGoal(Node):
    """Closed loop: read the pose, compute the error, publish a Twist. Repeat 10 times a second."""

    def __init__(self):
        super().__init__('go_to_goal')
        self.declare_parameter('goal_x', 8.0)
        self.declare_parameter('goal_y', 8.0)
        self.declare_parameter('kv', 1.0)       # speed gain
        self.declare_parameter('kw', 4.0)       # turning gain
        self.pose = None
        self.reached = None                     # the last goal we reached
        # relative names (no leading /) so a launch file can add a namespace
        self.pub = self.create_publisher(Twist, 'turtle1/cmd_vel', 10)
        self.create_subscription(Pose, 'turtle1/pose', self.on_pose, 10)
        self.create_timer(0.1, self.control)

    def on_pose(self, msg):
        self.pose = msg

    def control(self):
        if self.pose is None:
            return
        gx = self.get_parameter('goal_x').value
        gy = self.get_parameter('goal_y').value
        dx, dy = gx - self.pose.x, gy - self.pose.y
        distance = math.hypot(dx, dy)
        heading_error = math.atan2(dy, dx) - self.pose.theta
        heading_error = math.atan2(math.sin(heading_error), math.cos(heading_error))  # keep in -pi..pi
        cmd = Twist()
        if distance < 0.1:
            if self.reached != (gx, gy):            # say it once per goal
                self.reached = (gx, gy)
                self.get_logger().info(f'Goal reached: x={self.pose.x:.2f} y={self.pose.y:.2f}')
        else:
            cmd.linear.x = min(self.get_parameter('kv').value * distance, 2.0)
            cmd.angular.z = self.get_parameter('kw').value * heading_error
        self.pub.publish(cmd)


def main(args=None):
    rclpy.init(args=args)
    node = GoToGoal()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
