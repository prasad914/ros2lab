#include <algorithm>
#include <chrono>
#include <cmath>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/point.hpp"
#include "sensor_msgs/msg/joint_state.hpp"
#include "chiku_kinematics_cpp/kin_math.hpp"

using namespace std::chrono_literals;

// 0 -> 0, 1 -> 1, and zero speed at both ends: no jerk at start and stop
static double smoothstep(double s) { return 3 * s * s - 2 * s * s * s; }

class TrajectoryNode : public rclcpp::Node
{
public:
  TrajectoryNode() : Node("trajectory_node")
  {
    l1_ = declare_parameter("link1_length", 1.0);
    l2_ = declare_parameter("link2_length", 0.8);
    max_speed_ = declare_parameter("max_joint_speed", 1.0);   // rad/s
    pub_ = create_publisher<sensor_msgs::msg::JointState>("joint_states", 10);
    sub_ = create_subscription<geometry_msgs::msg::Point>("target_point", 10,
      std::bind(&TrajectoryNode::on_target, this, std::placeholders::_1));
    timer_ = create_wall_timer(20ms, std::bind(&TrajectoryNode::step, this));   // 50 Hz
  }

private:
  void on_target(const geometry_msgs::msg::Point & msg)
  {
    auto sol = chiku_kinematics_cpp::ik(l1_, l2_, msg.x, msg.y);
    if (!sol) {
      RCLCPP_WARN(get_logger(), "out of reach");
      return;
    }
    start_ = q_;
    goal_ = {sol->first, sol->second};
    double biggest = std::max(std::fabs(goal_[0] - start_[0]), std::fabs(goal_[1] - start_[1]));
    duration_ = std::max(1.5 * biggest / max_speed_, 0.2);
    t_ = 0.0;
    moving_ = true;
    RCLCPP_INFO(get_logger(), "moving in %.2f s", duration_);
  }

  void step()
  {
    if (moving_) {
      t_ = std::min(t_ + 0.02, duration_);
      double k = smoothstep(t_ / duration_);
      for (size_t i = 0; i < 2; ++i) {
        q_[i] = start_[i] + (goal_[i] - start_[i]) * k;
      }
      if (t_ >= duration_) {
        moving_ = false;
        RCLCPP_INFO(get_logger(), "arrived: %.1f deg, %.1f deg", q_[0] * 180 / M_PI, q_[1] * 180 / M_PI);
      }
    }
    sensor_msgs::msg::JointState msg;
    msg.header.stamp = now();
    msg.name = {"shoulder_joint", "elbow_joint"};
    msg.position = q_;
    pub_->publish(msg);
  }

  double l1_, l2_, max_speed_, duration_ = 0.0, t_ = 0.0;
  bool moving_ = false;
  std::vector<double> q_{0.0, 0.0}, start_{0.0, 0.0}, goal_{0.0, 0.0};
  rclcpp::Publisher<sensor_msgs::msg::JointState>::SharedPtr pub_;
  rclcpp::Subscription<geometry_msgs::msg::Point>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TrajectoryNode>());
  rclcpp::shutdown();
  return 0;
}
