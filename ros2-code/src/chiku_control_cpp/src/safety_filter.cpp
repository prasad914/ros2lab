#include <algorithm>
#include <optional>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "turtlesim/msg/pose.hpp"

using geometry_msgs::msg::Twist;
using turtlesim::msg::Pose;

class SafetyFilter : public rclcpp::Node
{
public:
  SafetyFilter() : Node("safety_filter")
  {
    declare_parameter("max_speed", 1.5);
    declare_parameter("margin", 1.0);    // stay this far from the walls (m)
    pub_ = create_publisher<Twist>("cmd_vel_out", 10);
    cmd_sub_ = create_subscription<Twist>(
      "cmd_vel_in", 10, std::bind(&SafetyFilter::on_cmd, this, std::placeholders::_1));
    pose_sub_ = create_subscription<Pose>(
      "/turtle1/pose", 10, [this](const Pose & msg) { pose_ = msg; });
  }

private:
  bool near_wall() const
  {
    double m = get_parameter("margin").as_double();
    return pose_ && (pose_->x < m || pose_->y < m || pose_->x > 11.0 - m || pose_->y > 11.0 - m);
  }

  void on_cmd(const Twist & msg)
  {
    double limit = get_parameter("max_speed").as_double();
    Twist out;
    out.linear.x = std::clamp(msg.linear.x, -limit, limit);
    out.angular.z = msg.angular.z;
    if (near_wall() && out.linear.x > 0.0) {
      out.linear.x = 0.0;
      RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 1000,
        "Too close to a wall: only turning is allowed");
    }
    pub_->publish(out);
  }

  std::optional<Pose> pose_;
  rclcpp::Publisher<Twist>::SharedPtr pub_;
  rclcpp::Subscription<Twist>::SharedPtr cmd_sub_;
  rclcpp::Subscription<Pose>::SharedPtr pose_sub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SafetyFilter>());
  rclcpp::shutdown();
  return 0;
}
