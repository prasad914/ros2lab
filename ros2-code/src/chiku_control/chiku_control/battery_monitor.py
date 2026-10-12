import math

import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from turtlesim.msg import Pose
from std_srvs.srv import Trigger
from my_robot_interfaces.msg import BatteryStatus


class BatteryMonitor(Node):
    """Mini-project: a pretend battery that empties as Chiku drives."""

    def __init__(self):
        super().__init__('battery_monitor')
        self.declare_parameter('drain_per_metre', 2.0)    # percent used for every metre driven
        self.declare_parameter('low_level', 20.0)         # warn below this percentage
        self.level = 100.0
        self.last = None                                  # previous pose
        self.warned = False
        self.pub = self.create_publisher(BatteryStatus, 'chiku/battery', 10)
        self.create_subscription(Pose, '/turtle1/pose', self.on_pose, 10)
        self.create_service(Trigger, 'chiku/recharge', self.on_recharge)
        self.create_timer(1.0, self.on_timer)
        self.get_logger().info('Battery monitor ready: 100.0 %')

    def on_pose(self, msg):
        if self.last is not None:
            metres = math.hypot(msg.x - self.last.x, msg.y - self.last.y)
            drain = self.get_parameter('drain_per_metre').value
            self.level = max(0.0, self.level - metres * drain)
        self.last = msg

    def on_timer(self):
        msg = BatteryStatus()
        msg.robot_name = 'chiku'
        msg.percentage = self.level
        msg.voltage = 10.0 + 2.6 * self.level / 100.0       # 10.0 V empty ... 12.6 V full
        msg.is_charging = False
        self.pub.publish(msg)
        low = self.get_parameter('low_level').value
        if self.level < low and not self.warned:
            self.get_logger().warn(f'Battery low: {self.level:.1f} %. Please recharge!')
            self.warned = True

    def on_recharge(self, request, response):
        self.level = 100.0
        self.warned = False
        response.success = True
        response.message = 'battery full again'
        self.get_logger().info('Recharged to 100 %')
        return response


def main(args=None):
    rclpy.init(args=args)
    node = BatteryMonitor()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
