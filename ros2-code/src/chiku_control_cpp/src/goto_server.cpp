#include <algorithm>
#include <chrono>
#include <cmath>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "turtlesim/msg/pose.hpp"
#include "my_robot_interfaces/srv/go_to.hpp"

using namespace std::chrono_literals;
using my_robot_interfaces::srv::GoTo;

class GoToServer : public rclcpp::Node
{
public:
  GoToServer() : Node("goto_server")
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    sub_ = create_subscription<turtlesim::msg::Pose>(
      "/turtle1/pose", 10, [this](const turtlesim::msg::Pose & msg) { pose_ = msg; });
    srv_ = create_service<GoTo>("chiku/go_to",
      [this](const std::shared_ptr<GoTo::Request> req, std::shared_ptr<GoTo::Response> res) {
        if (req->x < 0.5 || req->x > 10.5 || req->y < 0.5 || req->y > 10.5) {
          res->success = false;
          res->message = "outside the safe area 0.5..10.5";
          return;
        }
        goal_ = std::make_pair(req->x, req->y);
        res->success = true;
        res->message = "driving to (" + std::to_string(req->x) + ", " + std::to_string(req->y) + ")";
        RCLCPP_INFO(get_logger(), "%s", res->message.c_str());
      });                                       // answer NOW; the timer does the driving
    timer_ = create_wall_timer(100ms, std::bind(&GoToServer::control, this));
  }

private:
  void control()
  {
    if (!pose_ || !goal_) {
      return;
    }
    double dx = goal_->first - pose_->x, dy = goal_->second - pose_->y;
    double distance = std::hypot(dx, dy);
    geometry_msgs::msg::Twist cmd;
    if (distance < 0.1) {
      RCLCPP_INFO(get_logger(), "arrived");
      goal_.reset();
    } else {
      double err = std::atan2(dy, dx) - pose_->theta;
      err = std::atan2(std::sin(err), std::cos(err));
      cmd.linear.x = std::min(1.0 * distance, 2.0);
      cmd.angular.z = 4.0 * err;
    }
    pub_->publish(cmd);
  }

  std::optional<turtlesim::msg::Pose> pose_;
  std::optional<std::pair<double, double>> goal_;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::Subscription<turtlesim::msg::Pose>::SharedPtr sub_;
  rclcpp::Service<GoTo>::SharedPtr srv_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<GoToServer>());
  rclcpp::shutdown();
  return 0;
}
