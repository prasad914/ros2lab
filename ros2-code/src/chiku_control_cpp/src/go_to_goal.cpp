#include <algorithm>
#include <chrono>
#include <cmath>
#include <optional>
#include <utility>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "turtlesim/msg/pose.hpp"

using namespace std::chrono_literals;
using geometry_msgs::msg::Twist;
using turtlesim::msg::Pose;

class GoToGoal : public rclcpp::Node
{
public:
  GoToGoal() : Node("go_to_goal")
  {
    declare_parameter("goal_x", 8.0);
    declare_parameter("goal_y", 8.0);
    declare_parameter("kv", 1.0);      // speed gain
    declare_parameter("kw", 4.0);      // turning gain
    // relative names (no leading /) so a launch file can add a namespace
    pub_ = create_publisher<Twist>("turtle1/cmd_vel", 10);
    sub_ = create_subscription<Pose>(
      "turtle1/pose", 10, [this](const Pose & msg) { pose_ = msg; });
    timer_ = create_wall_timer(100ms, std::bind(&GoToGoal::control, this));
  }

private:
  void control()
  {
    if (!pose_) {
      return;
    }
    double gx = get_parameter("goal_x").as_double();
    double gy = get_parameter("goal_y").as_double();
    double dx = gx - pose_->x, dy = gy - pose_->y;
    double distance = std::hypot(dx, dy);
    double heading_error = std::atan2(dy, dx) - pose_->theta;
    heading_error = std::atan2(std::sin(heading_error), std::cos(heading_error));   // -pi..pi
    Twist cmd;
    if (distance < 0.1) {
      if (reached_ != std::make_pair(gx, gy)) {      // say it once per goal
        reached_ = std::make_pair(gx, gy);
        RCLCPP_INFO(get_logger(), "Goal reached: x=%.2f y=%.2f", pose_->x, pose_->y);
      }
    } else {
      cmd.linear.x = std::min(get_parameter("kv").as_double() * distance, 2.0);
      cmd.angular.z = get_parameter("kw").as_double() * heading_error;
    }
    pub_->publish(cmd);
  }

  std::optional<Pose> pose_;
  std::optional<std::pair<double, double>> reached_;   // the last goal we reached
  rclcpp::Publisher<Twist>::SharedPtr pub_;
  rclcpp::Subscription<Pose>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<GoToGoal>());
  rclcpp::shutdown();
  return 0;
}
