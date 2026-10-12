#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/string.hpp"

class LatchedStatus : public rclcpp::Node
{
public:
  LatchedStatus() : Node("latched_status")
  {
    auto qos = rclcpp::QoS(1).reliable().transient_local();    // keep the last message for late joiners
    pub_ = create_publisher<std_msgs::msg::String>("map_status", qos);
    std_msgs::msg::String msg;
    msg.data = "map of the warehouse is ready";
    pub_->publish(msg);
    RCLCPP_INFO(get_logger(), "Published the map status once");
  }

private:
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr pub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<LatchedStatus>());
  rclcpp::shutdown();
  return 0;
}
