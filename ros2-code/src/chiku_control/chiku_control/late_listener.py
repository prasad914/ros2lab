import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy, qos_profile_sensor_data
from std_msgs.msg import String
from turtlesim.msg import Pose


class LateListener(Node):
    def __init__(self):
        super().__init__('late_listener')
        latched = QoSProfile(depth=1,
                             reliability=ReliabilityPolicy.RELIABLE,
                             durability=DurabilityPolicy.TRANSIENT_LOCAL)   # must match the publisher
        self.create_subscription(String, 'map_status', self.on_status, latched)
        # sensor data: BEST_EFFORT, small queue. Newest value matters, old ones do not.
        self.create_subscription(Pose, '/turtle1/pose', self.on_pose, qos_profile_sensor_data)
        self.poses = 0

    def on_status(self, msg):
        self.get_logger().info(f'I joined late but still got: "{msg.data}"')

    def on_pose(self, msg):
        self.poses += 1
        if self.poses % 50 == 0:
            self.get_logger().info(f'{self.poses} poses received')


def main(args=None):
    rclpy.init(args=args)
    node = LateListener()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
