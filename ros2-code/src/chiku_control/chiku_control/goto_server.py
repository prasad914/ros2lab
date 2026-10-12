import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist
from turtlesim.msg import Pose
from my_robot_interfaces.srv import GoTo


class GoToServer(Node):
    """Service /chiku/go_to: answers at once (accepted or not), then drives in the background."""

    def __init__(self):
        super().__init__('goto_server')
        self.pose = None
        self.goal = None
        self.pub = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.create_subscription(Pose, '/turtle1/pose', self.on_pose, 10)
        self.create_service(GoTo, 'chiku/go_to', self.on_go_to)
        self.create_timer(0.1, self.control)

    def on_pose(self, msg):
        self.pose = msg

    def on_go_to(self, request, response):
        if not (0.5 <= request.x <= 10.5 and 0.5 <= request.y <= 10.5):
            response.success = False
            response.message = f'({request.x}, {request.y}) is outside the safe area 0.5..10.5'
            return response
        self.goal = (request.x, request.y)
        response.success = True
        response.message = f'driving to ({request.x}, {request.y})'
        self.get_logger().info(response.message)
        return response                           # answer NOW; the timer does the driving

    def control(self):
        if self.pose is None or self.goal is None:
            return
        dx, dy = self.goal[0] - self.pose.x, self.goal[1] - self.pose.y
        distance = math.hypot(dx, dy)
        cmd = Twist()
        if distance < 0.1:
            self.get_logger().info('arrived')
            self.goal = None
        else:
            err = math.atan2(dy, dx) - self.pose.theta
            err = math.atan2(math.sin(err), math.cos(err))
            cmd.linear.x = min(1.0 * distance, 2.0)
            cmd.angular.z = 4.0 * err
        self.pub.publish(cmd)


def main(args=None):
    rclpy.init(args=args)
    node = GoToServer()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
