import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
from std_msgs.msg import String


class LatchedStatus(Node):
    """Publishes ONE message. Thanks to TRANSIENT_LOCAL, late subscribers still get it."""

    def __init__(self):
        super().__init__('latched_status')
        qos = QoSProfile(depth=1,
                         reliability=ReliabilityPolicy.RELIABLE,
                         durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.pub = self.create_publisher(String, 'map_status', qos)
        msg = String()
        msg.data = 'map of the warehouse is ready'
        self.pub.publish(msg)
        self.get_logger().info('Published the map status once')


def main(args=None):
    rclpy.init(args=args)
    node = LatchedStatus()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
