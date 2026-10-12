import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rclpy.time import Time
from geometry_msgs.msg import TransformStamped
from nav_msgs.msg import Odometry
from sensor_msgs.msg import JointState
from tf2_ros import TransformBroadcaster

from chiku_kinematics.kin_math import body_twist, integrate, yaw_to_quaternion


class WheelOdometry(Node):
    """Wheel angles in -> where the robot is (odom -> base_link) out, as a topic AND as TF."""

    def __init__(self):
        super().__init__('wheel_odometry')
        self.r = self.declare_parameter('wheel_radius', 0.05).value
        self.L = self.declare_parameter('wheel_separation', 0.30).value
        self.x = self.y = self.theta = 0.0
        self.last = None                 # previous wheel angles
        self.last_time = None
        self.odom_pub = self.create_publisher(Odometry, 'odom', 10)
        self.tf = TransformBroadcaster(self)
        self.create_subscription(JointState, 'wheel_states', self.on_wheels, 10)

    def on_wheels(self, msg):
        pos = dict(zip(msg.name, msg.position))
        now = Time.from_msg(msg.header.stamp)
        wheels = (pos['left_wheel_joint'], pos['right_wheel_joint'])
        if self.last is None:
            self.last, self.last_time = wheels, now
            return
        d_left, d_right = wheels[0] - self.last[0], wheels[1] - self.last[1]   # how much each wheel turned
        dt = (now - self.last_time).nanoseconds / 1e9
        self.last, self.last_time = wheels, now
        ds, dtheta = body_twist(d_left, d_right, self.r, self.L)
        self.x, self.y, self.theta = integrate(self.x, self.y, self.theta, ds, dtheta)
        self.publish(msg.header.stamp, ds / dt if dt > 0 else 0.0, dtheta / dt if dt > 0 else 0.0)

    def publish(self, stamp, v, w):
        qx, qy, qz, qw = yaw_to_quaternion(self.theta)
        odom = Odometry()
        odom.header.stamp = stamp
        odom.header.frame_id = 'odom'
        odom.child_frame_id = 'base_link'
        odom.pose.pose.position.x = self.x
        odom.pose.pose.position.y = self.y
        odom.pose.pose.orientation.z = qz
        odom.pose.pose.orientation.w = qw
        odom.twist.twist.linear.x = v           # speeds are in the ROBOT's frame (child_frame_id)
        odom.twist.twist.angular.z = w
        self.odom_pub.publish(odom)
        t = TransformStamped()
        t.header = odom.header
        t.child_frame_id = 'base_link'
        t.transform.translation.x = self.x
        t.transform.translation.y = self.y
        t.transform.rotation.x, t.transform.rotation.y = qx, qy
        t.transform.rotation.z, t.transform.rotation.w = qz, qw
        self.tf.sendTransform(t)


def main(args=None):
    rclpy.init(args=args)
    node = WheelOdometry()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
