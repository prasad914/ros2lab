#include <chrono>
#include <string>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"

using namespace std::chrono_literals;

// Drives in a circle. The speeds are PARAMETERS, so you can change them without editing code.
class SpeedDriver : public rclcpp::Node
{
public:
  SpeedDriver() : Node("speed_driver")
  {
    declare_parameter("robot_name", "chiku");     // name, default value
    declare_parameter("speed", 1.0);              // forward speed, m/s
    declare_parameter("turn", 0.5);               // turn rate, rad/s
    std::string name = get_parameter("robot_name").as_string();
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    timer_ = create_wall_timer(100ms, std::bind(&SpeedDriver::on_timer, this));
    RCLCPP_INFO(get_logger(), "%s is ready to drive", name.c_str());
  }

private:
  void on_timer()
  {
    double speed = get_parameter("speed").as_double();    // read the newest value every tick
    double turn = get_parameter("turn").as_double();
    geometry_msgs::msg::Twist msg;
    msg.linear.x = speed;
    msg.angular.z = turn;
    pub_->publish(msg);
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SpeedDriver>());
  rclcpp::shutdown();
  return 0;
}
