#include <chrono>
#include <cmath>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/point.hpp"
#include "sensor_msgs/msg/joint_state.hpp"
#include "chiku_kinematics_cpp/kin_math.hpp"

using namespace std::chrono_literals;

class IkNode : public rclcpp::Node
{
public:
  IkNode() : Node("ik_node")
  {
    declare_parameter("link1_length", 1.0);
    declare_parameter("link2_length", 0.8);
    declare_parameter("elbow_up", false);
    pub_ = create_publisher<sensor_msgs::msg::JointState>("joint_states", 10);
    sub_ = create_subscription<geometry_msgs::msg::Point>("target_point", 10,
      std::bind(&IkNode::on_target, this, std::placeholders::_1));
    timer_ = create_wall_timer(100ms, std::bind(&IkNode::publish_joints, this));
    RCLCPP_INFO(get_logger(), "2-link arm IK node ready: reach=%.2f m",
      get_parameter("link1_length").as_double() + get_parameter("link2_length").as_double());
  }

private:
  void on_target(const geometry_msgs::msg::Point & msg)
  {
    double l1 = get_parameter("link1_length").as_double();
    double l2 = get_parameter("link2_length").as_double();
    auto sol = chiku_kinematics_cpp::ik(l1, l2, msg.x, msg.y, get_parameter("elbow_up").as_bool());
    if (!sol) {
      RCLCPP_WARN(get_logger(), "Target (%.2f, %.2f) is out of reach: distance %.2f m, reach %.2f m",
        msg.x, msg.y, std::hypot(msg.x, msg.y), l1 + l2);
      return;
    }
    q_ = {sol->first, sol->second};
    RCLCPP_INFO(get_logger(), "IK solution: shoulder=%.3f rad (%.1f deg), elbow=%.3f rad (%.1f deg)",
      q_[0], q_[0] * 180.0 / M_PI, q_[1], q_[1] * 180.0 / M_PI);
    publish_joints();
  }

  void publish_joints()
  {
    sensor_msgs::msg::JointState msg;
    msg.header.stamp = now();
    msg.name = {"shoulder_joint", "elbow_joint"};
    msg.position = q_;
    pub_->publish(msg);
  }

  std::vector<double> q_{0.0, 0.0};
  rclcpp::Publisher<sensor_msgs::msg::JointState>::SharedPtr pub_;
  rclcpp::Subscription<geometry_msgs::msg::Point>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<IkNode>());
  rclcpp::shutdown();
  return 0;
}
