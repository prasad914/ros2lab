import rclpy
from rclpy.node import Node
from geometry_msgs.msg import TwistStamped
import time

class RobotDriver(Node):
    def __init__(self):
        super().__init__('robot_driver')
        self.publisher = self.create_publisher(TwistStamped, '/cmd_vel', 10)
        self.timer = self.create_timer(0.1, self.timer_callback)
        self.start_time = time.time()
        self.duration = 90.0 # 90 seconds coverage route

    def timer_callback(self):
        elapsed = time.time() - self.start_time
        if elapsed > self.duration:
            self.get_logger().info("Finished driving sequence.")
            rclpy.shutdown()
            return

        msg = TwistStamped()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = 'base_link'

        if elapsed < 20:
            msg.twist.linear.x = 0.15
            msg.twist.angular.z = 0.0
        elif elapsed < 35:
            msg.twist.linear.x = 0.05
            msg.twist.angular.z = 0.6
        elif elapsed < 60:
            msg.twist.linear.x = 0.15
            msg.twist.angular.z = 0.15
        elif elapsed < 75:
            msg.twist.linear.x = -0.1
            msg.twist.angular.z = -0.4
        else:
            msg.twist.linear.x = 0.1
            msg.twist.angular.z = 0.0

        self.publisher.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    driver = RobotDriver()
    try:
        rclpy.spin(driver)
    except KeyboardInterrupt:
        pass
    driver.destroy_node()
    if rclpy.ok():
        rclpy.shutdown()

if __name__ == '__main__':
    main()
