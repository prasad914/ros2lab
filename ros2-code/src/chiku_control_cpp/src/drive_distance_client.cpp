#include <chrono>
#include <memory>

#include "rclcpp/rclcpp.hpp"
#include "rclcpp_action/rclcpp_action.hpp"
#include "my_robot_interfaces/action/drive_distance.hpp"

using namespace std::chrono_literals;
using DriveDistance = my_robot_interfaces::action::DriveDistance;
using GoalHandle = rclcpp_action::ClientGoalHandle<DriveDistance>;

class DriveDistanceClient : public rclcpp::Node
{
public:
  DriveDistanceClient() : Node("drive_distance_client")
  {
    declare_parameter("distance", 2.0);
    declare_parameter("speed", 0.5);
    declare_parameter("cancel_after", 0.0);      // seconds; 0 = never cancel
    client_ = rclcpp_action::create_client<DriveDistance>(this, "chiku/drive_distance");
  }

  void send()
  {
    client_->wait_for_action_server();
    DriveDistance::Goal goal;
    goal.distance = get_parameter("distance").as_double();
    goal.speed = get_parameter("speed").as_double();
    RCLCPP_INFO(get_logger(), "Sending goal: %.1f m at %.1f m/s", goal.distance, goal.speed);

    rclcpp_action::Client<DriveDistance>::SendGoalOptions options;
    options.goal_response_callback = [this](const GoalHandle::SharedPtr & handle) {
        if (!handle) {
          RCLCPP_WARN(get_logger(), "Goal rejected");
          rclcpp::shutdown();
          return;
        }
        RCLCPP_INFO(get_logger(), "Goal accepted");
        handle_ = handle;
        double wait = get_parameter("cancel_after").as_double();
        if (wait > 0.0) {
          cancel_timer_ = create_wall_timer(std::chrono::duration<double>(wait), [this]() {
              cancel_timer_->cancel();
              RCLCPP_INFO(get_logger(), "Changed my mind: cancelling");
              client_->async_cancel_goal(handle_);
            });
        }
      };
    options.feedback_callback = [this](GoalHandle::SharedPtr,
        const std::shared_ptr<const DriveDistance::Feedback> feedback) {
        RCLCPP_INFO(get_logger(), "remaining: %.2f m", feedback->remaining);
      };
    options.result_callback = [this](const GoalHandle::WrappedResult & result) {
        RCLCPP_INFO(get_logger(), "Result: drove %.2f m (code %d)",
          result.result->distance_driven, static_cast<int>(result.code));
        rclcpp::shutdown();
      };
    client_->async_send_goal(goal, options);
  }

private:
  rclcpp_action::Client<DriveDistance>::SharedPtr client_;
  GoalHandle::SharedPtr handle_;
  rclcpp::TimerBase::SharedPtr cancel_timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<DriveDistanceClient>();
  node->send();
  rclcpp::spin(node);
  return 0;
}
