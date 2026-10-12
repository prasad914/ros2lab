#include <algorithm>
#include <functional>
#include <memory>
#include <thread>

#include "rclcpp/rclcpp.hpp"
#include "rclcpp_action/rclcpp_action.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "my_robot_interfaces/action/drive_distance.hpp"

using DriveDistance = my_robot_interfaces::action::DriveDistance;
using GoalHandle = rclcpp_action::ServerGoalHandle<DriveDistance>;

class DriveDistanceServer : public rclcpp::Node
{
public:
  DriveDistanceServer() : Node("drive_distance_server")
  {
    using namespace std::placeholders;
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    server_ = rclcpp_action::create_server<DriveDistance>(
      this, "chiku/drive_distance",
      std::bind(&DriveDistanceServer::handle_goal, this, _1, _2),
      std::bind(&DriveDistanceServer::handle_cancel, this, _1),
      std::bind(&DriveDistanceServer::handle_accepted, this, _1));
    RCLCPP_INFO(get_logger(), "Action server /chiku/drive_distance is ready");
  }

private:
  rclcpp_action::GoalResponse handle_goal(
    const rclcpp_action::GoalUUID &, std::shared_ptr<const DriveDistance::Goal> goal)
  {
    if (goal->distance <= 0.0 || goal->speed <= 0.0 || goal->speed > 2.0) {
      RCLCPP_WARN(get_logger(), "Rejected: distance must be > 0 and speed in (0, 2]");
      return rclcpp_action::GoalResponse::REJECT;
    }
    return rclcpp_action::GoalResponse::ACCEPT_AND_EXECUTE;
  }

  rclcpp_action::CancelResponse handle_cancel(const std::shared_ptr<GoalHandle>)
  {
    RCLCPP_INFO(get_logger(), "Cancel requested");
    return rclcpp_action::CancelResponse::ACCEPT;
  }

  void handle_accepted(const std::shared_ptr<GoalHandle> goal_handle)
  {
    // the job is long: run it in its own thread so this callback returns quickly
    std::thread{std::bind(&DriveDistanceServer::execute, this, goal_handle)}.detach();
  }

  void execute(const std::shared_ptr<GoalHandle> goal_handle)
  {
    const auto goal = goal_handle->get_goal();
    auto feedback = std::make_shared<DriveDistance::Feedback>();
    auto result = std::make_shared<DriveDistance::Result>();
    double driven = 0.0;
    rclcpp::Rate rate(10);                                   // 10 Hz
    while (driven < goal->distance && rclcpp::ok()) {
      if (goal_handle->is_canceling()) {
        pub_->publish(geometry_msgs::msg::Twist());          // stop the robot first
        result->distance_driven = driven;
        goal_handle->canceled(result);
        return;
      }
      geometry_msgs::msg::Twist cmd;
      cmd.linear.x = goal->speed;
      pub_->publish(cmd);
      rate.sleep();
      driven = std::min(goal->distance, driven + goal->speed * 0.1);
      feedback->remaining = goal->distance - driven;
      goal_handle->publish_feedback(feedback);
    }
    pub_->publish(geometry_msgs::msg::Twist());
    result->distance_driven = driven;
    goal_handle->succeed(result);
    RCLCPP_INFO(get_logger(), "Done: drove %.2f m", driven);
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp_action::Server<DriveDistance>::SharedPtr server_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<DriveDistanceServer>());
  rclcpp::shutdown();
  return 0;
}
