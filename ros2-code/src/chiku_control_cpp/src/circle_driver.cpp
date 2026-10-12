#include <chrono>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"

using namespace std::chrono_literals;

class CircleDriver : public rclcpp::Node
{
public:
  CircleDriver() : Node("circle_driver")
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    timer_ = create_wall_timer(100ms, std::bind(&CircleDriver::on_timer, this));   // 10 Hz
    RCLCPP_INFO(get_logger(), "Driving in a circle. Press Ctrl+C to stop.");
  }

private:
  void on_timer()
  {
    geometry_msgs::msg::Twist msg;
    msg.linear.x = 1.0;      // forward, metres per second
    msg.angular.z = 0.5;     // turn left, radians per second
    pub_->publish(msg);
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CircleDriver>());
  rclcpp::shutdown();
  return 0;
}
