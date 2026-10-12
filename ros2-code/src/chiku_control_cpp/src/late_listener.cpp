#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/string.hpp"
#include "turtlesim/msg/pose.hpp"

class LateListener : public rclcpp::Node
{
public:
  LateListener() : Node("late_listener")
  {
    auto latched = rclcpp::QoS(1).reliable().transient_local();     // must match the publisher
    status_sub_ = create_subscription<std_msgs::msg::String>("map_status", latched,
      [this](const std_msgs::msg::String & msg) {
        RCLCPP_INFO(get_logger(), "I joined late but still got: \"%s\"", msg.data.c_str());
      });
    // sensor data: BEST_EFFORT, small queue
    pose_sub_ = create_subscription<turtlesim::msg::Pose>("/turtle1/pose", rclcpp::SensorDataQoS(),
      [this](const turtlesim::msg::Pose &) {
        if (++poses_ % 50 == 0) {
          RCLCPP_INFO(get_logger(), "%d poses received", poses_);
        }
      });
  }

private:
  int poses_ = 0;
  rclcpp::Subscription<std_msgs::msg::String>::SharedPtr status_sub_;
  rclcpp::Subscription<turtlesim::msg::Pose>::SharedPtr pose_sub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<LateListener>());
  rclcpp::shutdown();
  return 0;
}
