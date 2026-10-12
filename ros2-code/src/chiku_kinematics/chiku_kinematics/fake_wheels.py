import rclpy
from rclpy.node import Node
from rclpy.executors import ExternalShutdownException
from sensor_msgs.msg import JointState


class FakeWheels(Node):
    """Pretend motors with encoders: turn at the commanded speed, report wheel angles at 50 Hz."""

    def __init__(self):
        super().__init__('fake_wheels')
        self.slip = self.declare_parameter('slip', 0.0).value        # 0.02 = the right wheel slips 2 %
        self.cmd = [0.0, 0.0]
        self.pos = [0.0, 0.0]
        self.last_cmd_time = self.get_clock().now()
        self.pub = self.create_publisher(JointState, 'wheel_states', 10)
        self.create_subscription(JointState, 'wheel_commands', self.on_cmd, 10)
        self.dt = 0.02
        self.create_timer(self.dt, self.step)

    def on_cmd(self, msg):
        self.cmd = list(msg.velocity)
        self.last_cmd_time = self.get_clock().now()

    def step(self):
        if (self.get_clock().now() - self.last_cmd_time).nanoseconds > 5e8:   # no command for 0.5 s:
            self.cmd = [0.0, 0.0]                                               # stop (a safety habit)
        self.pos[0] += self.cmd[0] * self.dt
        self.pos[1] += self.cmd[1] * self.dt * (1.0 - self.slip)
        msg = JointState()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.name = ['left_wheel_joint', 'right_wheel_joint']
        msg.position = list(self.pos)
        msg.velocity = list(self.cmd)
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = FakeWheels()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
