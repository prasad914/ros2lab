#include <algorithm>
#include <chrono>
#include <cmath>
#include <optional>
#include <utility>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/point.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "nav_msgs/msg/odometry.hpp"
#include "chiku_kinematics_cpp/kin_math.hpp"

using namespace std::chrono_literals;

class MmPlanner : public rclcpp::Node
{
public:
  MmPlanner() : Node("mm_planner")
  {
    double l1 = declare_parameter("link1_length", 1.0);
    double l2 = declare_parameter("link2_length", 0.8);
    stop_at_ = declare_parameter("approach_ratio", 0.7) * (l1 + l2);
    cmd_pub_ = create_publisher<geometry_msgs::msg::Twist>("cmd_vel", 10);
    arm_pub_ = create_publisher<geometry_msgs::msg::Point>("target_point", 10);
    odom_sub_ = create_subscription<nav_msgs::msg::Odometry>("odom", 10,
      [this](const nav_msgs::msg::Odometry & msg) {
        const auto & q = msg.pose.pose.orientation;
        base_x_ = msg.pose.pose.position.x;
        base_y_ = msg.pose.pose.position.y;
        base_th_ = 2.0 * std::atan2(q.z, q.w);
        have_odom_ = true;
      });
    goal_sub_ = create_subscription<geometry_msgs::msg::Point>("goal_point", 10,
      [this](const geometry_msgs::msg::Point & msg) {
        goal_ = std::make_pair(msg.x, msg.y);
        state_ = State::TURN;
        RCLCPP_INFO(get_logger(), "New goal (%.2f, %.2f)", msg.x, msg.y);
      });
    timer_ = create_wall_timer(100ms, std::bind(&MmPlanner::step, this));
    RCLCPP_INFO(get_logger(), "Mobile manipulator planner ready. Send a goal on /goal_point");
  }

private:
  enum class State { IDLE, TURN, DRIVE, REACH };

  void step()
  {
    if (!have_odom_ || !goal_) {
      return;
    }
    auto [lx, ly] = chiku_kinematics_cpp::world_to_base(goal_->first, goal_->second, base_x_, base_y_, base_th_);
    double distance = std::hypot(lx, ly), bearing = std::atan2(ly, lx);
    geometry_msgs::msg::Twist cmd;
    if (state_ == State::TURN) {
      if (distance <= stop_at_) {
        state_ = State::REACH;
      } else if (std::fabs(bearing) > 0.05) {
        cmd.angular.z = std::clamp(2.0 * bearing, -1.0, 1.0);
      } else {
        state_ = State::DRIVE;
        RCLCPP_INFO(get_logger(), "Facing the goal, driving %.2f m", distance - stop_at_);
      }
    } else if (state_ == State::DRIVE) {
      if (distance <= stop_at_) {
        state_ = State::REACH;
      } else {
        cmd.linear.x = std::min(0.5, distance - stop_at_ + 0.05);
        cmd.angular.z = 2.0 * bearing;
      }
    }
    if (state_ == State::REACH) {
      geometry_msgs::msg::Point p;
      p.x = lx;
      p.y = ly;
      arm_pub_->publish(p);
      RCLCPP_INFO(get_logger(), "Within reach: arm target in base_link = (%.2f, %.2f)", lx, ly);
      state_ = State::IDLE;
      goal_.reset();
    }
    cmd_pub_->publish(cmd);
  }

  double stop_at_, base_x_ = 0.0, base_y_ = 0.0, base_th_ = 0.0;
  bool have_odom_ = false;
  std::optional<std::pair<double, double>> goal_;
  State state_ = State::IDLE;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_pub_;
  rclcpp::Publisher<geometry_msgs::msg::Point>::SharedPtr arm_pub_;
  rclcpp::Subscription<nav_msgs::msg::Odometry>::SharedPtr odom_sub_;
  rclcpp::Subscription<geometry_msgs::msg::Point>::SharedPtr goal_sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MmPlanner>());
  rclcpp::shutdown();
  return 0;
}
