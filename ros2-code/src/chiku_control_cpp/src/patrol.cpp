#include <chrono>
#include <cmath>
#include <memory>
#include <optional>
#include <utility>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "std_srvs/srv/set_bool.hpp"
#include "turtlesim/msg/pose.hpp"
#include "my_robot_interfaces/msg/robot_status.hpp"
#include "chiku_control_cpp/control_math.hpp"

using namespace std::chrono_literals;

class Patrol : public rclcpp::Node
{
public:
  Patrol() : Node("patrol")
  {
    auto flat = declare_parameter<std::vector<double>>(
      "waypoints", {2.0, 2.0, 9.0, 2.0, 9.0, 9.0, 2.0, 9.0});    // x1, y1, x2, y2, ...
    declare_parameter("kv", 1.0);
    declare_parameter("kw", 4.0);
    for (size_t i = 0; i + 1 < flat.size(); i += 2) {
      points_.emplace_back(flat[i], flat[i + 1]);
    }
    cmd_pub_ = create_publisher<geometry_msgs::msg::Twist>("turtle1/cmd_vel", 10);
    status_pub_ = create_publisher<my_robot_interfaces::msg::RobotStatus>("chiku/status", 10);
    pose_sub_ = create_subscription<turtlesim::msg::Pose>(
      "turtle1/pose", 10, [this](const turtlesim::msg::Pose & msg) { pose_ = msg; });
    pause_srv_ = create_service<std_srvs::srv::SetBool>("patrol/pause",
      [this](const std::shared_ptr<std_srvs::srv::SetBool::Request> req,
             std::shared_ptr<std_srvs::srv::SetBool::Response> res) {
        paused_ = req->data;
        res->success = true;
        res->message = paused_ ? "paused" : "patrolling";
      });
    control_timer_ = create_wall_timer(100ms, std::bind(&Patrol::control, this));
    report_timer_ = create_wall_timer(1s, std::bind(&Patrol::report, this));
    RCLCPP_INFO(get_logger(), "Patrolling %zu waypoints", points_.size());
  }

private:
  void control()
  {
    geometry_msgs::msg::Twist cmd;
    if (pose_ && !paused_ && !points_.empty()) {
      auto [gx, gy] = points_[index_];
      if (std::hypot(gx - pose_->x, gy - pose_->y) < 0.15) {
        index_ = (index_ + 1) % points_.size();
        RCLCPP_INFO(get_logger(), "reached waypoint, next is (%.1f, %.1f)",
          points_[index_].first, points_[index_].second);
      } else {
        auto [v, w] = chiku_control_cpp::p_control(pose_->x, pose_->y, pose_->theta, gx, gy,
          get_parameter("kv").as_double(), get_parameter("kw").as_double());
        cmd.linear.x = v;
        cmd.angular.z = w;
      }
    }
    cmd_pub_->publish(cmd);
  }

  void report()
  {
    if (!pose_) {
      return;
    }
    my_robot_interfaces::msg::RobotStatus msg;
    msg.name = "chiku";
    msg.x = pose_->x;
    msg.y = pose_->y;
    msg.battery = 100.0f;
    msg.moving = !paused_;
    status_pub_->publish(msg);
  }

  std::vector<std::pair<double, double>> points_;
  size_t index_ = 0;
  bool paused_ = false;
  std::optional<turtlesim::msg::Pose> pose_;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_pub_;
  rclcpp::Publisher<my_robot_interfaces::msg::RobotStatus>::SharedPtr status_pub_;
  rclcpp::Subscription<turtlesim::msg::Pose>::SharedPtr pose_sub_;
  rclcpp::Service<std_srvs::srv::SetBool>::SharedPtr pause_srv_;
  rclcpp::TimerBase::SharedPtr control_timer_, report_timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<Patrol>());
  rclcpp::shutdown();
  return 0;
}
