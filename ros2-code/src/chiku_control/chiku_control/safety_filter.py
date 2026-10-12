import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from geometry_msgs.msg import Twist
from turtlesim.msg import Pose


class SafetyFilter(Node):
    """Sits between a driver and the robot: limits speed and stops before the walls."""

    def __init__(self):
        super().__init__('safety_filter')
        self.declare_parameter('max_speed', 1.5)
        self.declare_parameter('margin', 1.0)       # stay this far from the walls (m)
        self.pose = None
        self.pub = self.create_publisher(Twist, 'cmd_vel_out', 10)
        self.create_subscription(Twist, 'cmd_vel_in', self.on_cmd, 10)
        self.create_subscription(Pose, '/turtle1/pose', self.on_pose, 10)

    def on_pose(self, msg):
        self.pose = msg

    def near_wall(self):
        m = self.get_parameter('margin').value
        p = self.pose
        return p is not None and (p.x < m or p.y < m or p.x > 11.0 - m or p.y > 11.0 - m)

    def on_cmd(self, msg):
        limit = self.get_parameter('max_speed').value
        out = Twist()
        out.linear.x = max(-limit, min(limit, msg.linear.x))   # clamp
        out.angular.z = msg.angular.z
        if self.near_wall() and out.linear.x > 0.0:
            out.linear.x = 0.0
            self.get_logger().warn('Too close to a wall: only turning is allowed',
                                   throttle_duration_sec=1.0)
        self.pub.publish(out)


def main(args=None):
    rclpy.init(args=args)
    node = SafetyFilter()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
