#include <chrono>

#include "rclcpp/rclcpp.hpp"
#include "rclcpp_components/register_node_macro.hpp"
#include "geometry_msgs/msg/twist.hpp"

using namespace std::chrono_literals;

namespace chiku_control_cpp
{

// A component: the same node, but built as a plugin (a shared library) with no main().
class CircleComponent : public rclcpp::Node
{
public:
  explicit CircleComponent(const rclcpp::NodeOptions & options)
  : Node("circle_component", options)
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    timer_ = create_wall_timer(100ms, [this]() {
        geometry_msgs::msg::Twist msg;
        msg.linear.x = 1.0;
        msg.angular.z = 0.5;
        pub_->publish(msg);
      });
    RCLCPP_INFO(get_logger(), "CircleComponent loaded");
  }

private:
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

}  // namespace chiku_control_cpp

RCLCPP_COMPONENTS_REGISTER_NODE(chiku_control_cpp::CircleComponent)
