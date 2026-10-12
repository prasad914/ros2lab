import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from rcl_interfaces.msg import ParameterDescriptor, FloatingPointRange, SetParametersResult
from geometry_msgs.msg import Twist


class CruiseControl(Node):
    def __init__(self):
        super().__init__('cruise_control')
        self.declare_parameter('robot_name', 'chiku',
                               ParameterDescriptor(description='Name shown in logs', read_only=True))
        self.declare_parameter('speed', 1.0, ParameterDescriptor(
            description='Forward speed in m/s',
            floating_point_range=[FloatingPointRange(from_value=0.0, to_value=2.0, step=0.0)]))
        self.declare_parameter('turn', 0.5, ParameterDescriptor(description='Turn rate in rad/s'))
        self.speed = self.get_parameter('speed').value
        self.turn = self.get_parameter('turn').value
        self.add_on_set_parameters_callback(self.on_params)    # the gatekeeper
        self.pub = self.create_publisher(Twist, '/turtle1/cmd_vel', 10)
        self.create_timer(0.1, self.on_timer)
        name = self.get_parameter('robot_name').value
        self.get_logger().info(f'{name}: speed={self.speed} turn={self.turn}')

    def on_params(self, params):
        for p in params:
            if p.name == 'turn' and abs(p.value) > 3.0:
                return SetParametersResult(successful=False, reason='turn must be between -3 and 3')
        for p in params:                       # all values are fine: use them
            if p.name == 'speed':
                self.speed = p.value
            if p.name == 'turn':
                self.turn = p.value
            self.get_logger().info(f'{p.name} changed to {p.value}')
        return SetParametersResult(successful=True)

    def on_timer(self):
        msg = Twist()
        msg.linear.x = self.speed
        msg.angular.z = self.turn
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = CruiseControl()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
