#include <chrono>
#include <cmath>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "rcl_interfaces/msg/parameter_descriptor.hpp"
#include "rcl_interfaces/msg/set_parameters_result.hpp"

using namespace std::chrono_literals;

class CruiseControl : public rclcpp::Node
{
public:
  CruiseControl() : Node("cruise_control")
  {
    rcl_interfaces::msg::ParameterDescriptor name_desc;
    name_desc.description = "Name shown in logs";
    name_desc.read_only = true;
    declare_parameter("robot_name", "chiku", name_desc);

    rcl_interfaces::msg::ParameterDescriptor speed_desc;
    speed_desc.description = "Forward speed in m/s";
    rcl_interfaces::msg::FloatingPointRange range;
    range.from_value = 0.0;
    range.to_value = 2.0;
    speed_desc.floating_point_range.push_back(range);
    speed_ = declare_parameter("speed", 1.0, speed_desc);
    turn_ = declare_parameter("turn", 0.5);

    // the gatekeeper: runs BEFORE a new value is accepted
    callback_handle_ = add_on_set_parameters_callback(
      [this](const std::vector<rclcpp::Parameter> & params) {
        rcl_interfaces::msg::SetParametersResult result;
        result.successful = true;
        for (const auto & p : params) {
          if (p.get_name() == "turn" && std::fabs(p.as_double()) > 3.0) {
            result.successful = false;
            result.reason = "turn must be between -3 and 3";
            return result;
          }
        }
        for (const auto & p : params) {
          if (p.get_name() == "speed") { speed_ = p.as_double(); }
          if (p.get_name() == "turn") { turn_ = p.as_double(); }
          RCLCPP_INFO(get_logger(), "%s changed to %s", p.get_name().c_str(), p.value_to_string().c_str());
        }
        return result;
      });

    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    timer_ = create_wall_timer(100ms, [this]() {
        geometry_msgs::msg::Twist msg;
        msg.linear.x = speed_;
        msg.angular.z = turn_;
        pub_->publish(msg);
      });
    RCLCPP_INFO(get_logger(), "%s: speed=%.1f turn=%.1f",
      get_parameter("robot_name").as_string().c_str(), speed_, turn_);
  }

private:
  double speed_, turn_;
  OnSetParametersCallbackHandle::SharedPtr callback_handle_;   // keep it, or the callback is removed
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CruiseControl>());
  rclcpp::shutdown();
  return 0;
}
