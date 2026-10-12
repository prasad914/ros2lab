import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rclpy.qos import QoSProfile, DurabilityPolicy
from geometry_msgs.msg import Twist
from sensor_msgs.msg import JointState

from chiku_kinematics.kin_math import wheel_speeds


class DiffDriveController(Node):
    """/cmd_vel (how should the ROBOT move?) -> /wheel_commands (how fast should each WHEEL turn?)"""

    def __init__(self):
        super().__init__('diff_drive_controller')
        self.r = self.declare_parameter('wheel_radius', 0.05).value
        self.L = self.declare_parameter('wheel_separation', 0.30).value
        self.max_wheel = self.declare_parameter('max_wheel_speed', 20.0).value   # rad/s
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)   # keeps the last command
        self.pub = self.create_publisher(JointState, 'wheel_commands', latched)  # a late echo still gets it
        self.create_subscription(Twist, 'cmd_vel', self.on_cmd, 10)

    def on_cmd(self, msg):
        left, right = wheel_speeds(msg.linear.x, msg.angular.z, self.r, self.L)
        biggest = max(abs(left), abs(right))
        if biggest > self.max_wheel:                       # too fast: slow BOTH wheels equally,
            left, right = left * self.max_wheel / biggest, right * self.max_wheel / biggest
            self.get_logger().warn('wheel speed limited', throttle_duration_sec=1.0)   # keeps the curve
        out = JointState()
        out.header.stamp = self.get_clock().now().to_msg()
        out.name = ['left_wheel_joint', 'right_wheel_joint']
        out.velocity = [left, right]
        self.pub.publish(out)


def main(args=None):
    rclpy.init(args=args)
    node = DiffDriveController()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
