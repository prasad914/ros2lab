#include "rclcpp/rclcpp.hpp"

class HelloNode : public rclcpp::Node
{
public:
  HelloNode() : Node("hello_node")                  // give the node its name
  {
    RCLCPP_INFO(get_logger(), "Hello! Chiku is awake.");
  }
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);                         // 1. start ROS 2 in this program
  auto node = std::make_shared<HelloNode>();        // 2. create the node
  rclcpp::spin(node);                               // 3. keep it alive until Ctrl+C
  node.reset();                                     // 4. destroy the node
  rclcpp::shutdown();                               // 5. shut ROS 2 down
  return 0;
}
