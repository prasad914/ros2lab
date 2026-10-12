#include <chrono>
#include <memory>

#include "rclcpp/rclcpp.hpp"
#include "rclcpp_lifecycle/lifecycle_node.hpp"
#include "geometry_msgs/msg/twist.hpp"

using namespace std::chrono_literals;
using CallbackReturn = rclcpp_lifecycle::node_interfaces::LifecycleNodeInterface::CallbackReturn;

class LifecycleDriver : public rclcpp_lifecycle::LifecycleNode
{
public:
  LifecycleDriver() : LifecycleNode("lifecycle_driver") {}

  CallbackReturn on_configure(const rclcpp_lifecycle::State &) override
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    RCLCPP_INFO(get_logger(), "configured: publisher created, not driving yet");
    return CallbackReturn::SUCCESS;
  }

  CallbackReturn on_activate(const rclcpp_lifecycle::State & state) override
  {
    LifecycleNode::on_activate(state);             // activates the lifecycle publisher
    timer_ = create_wall_timer(100ms, [this]() {
        geometry_msgs::msg::Twist msg;
        msg.linear.x = 1.0;
        msg.angular.z = 1.0;
        pub_->publish(msg);
      });
    RCLCPP_INFO(get_logger(), "activated: driving");
    return CallbackReturn::SUCCESS;
  }

  CallbackReturn on_deactivate(const rclcpp_lifecycle::State & state) override
  {
    timer_.reset();
    LifecycleNode::on_deactivate(state);
    RCLCPP_INFO(get_logger(), "deactivated: stopped");
    return CallbackReturn::SUCCESS;
  }

  CallbackReturn on_cleanup(const rclcpp_lifecycle::State &) override
  {
    pub_.reset();
    RCLCPP_INFO(get_logger(), "cleaned up");
    return CallbackReturn::SUCCESS;
  }

private:
  rclcpp_lifecycle::LifecyclePublisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<LifecycleDriver>();
  rclcpp::spin(node->get_node_base_interface());      // lifecycle nodes spin through this interface
  rclcpp::shutdown();
  return 0;
}
