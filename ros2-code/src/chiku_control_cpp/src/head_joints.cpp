#include <chrono>
#include <cmath>

#include "rclcpp/rclcpp.hpp"
#include "sensor_msgs/msg/joint_state.hpp"

using namespace std::chrono_literals;

class HeadJoints : public rclcpp::Node
{
public:
  HeadJoints() : Node("head_joints")
  {
    pub_ = create_publisher<sensor_msgs::msg::JointState>("joint_states", 10);
    timer_ = create_wall_timer(50ms, std::bind(&HeadJoints::on_timer, this));   // 20 Hz
  }

private:
  void on_timer()
  {
    t_ += 0.05;
    sensor_msgs::msg::JointState msg;
    msg.header.stamp = now();                       // WHEN these values were true
    msg.name = {"head_pan", "head_tilt"};           // std::vector: same order everywhere
    msg.position = {0.8 * std::sin(t_), 0.3 * std::sin(2.0 * t_)};
    msg.velocity = {0.8 * std::cos(t_), 0.6 * std::cos(2.0 * t_)};
    pub_->publish(msg);
  }

  double t_ = 0.0;
  rclcpp::Publisher<sensor_msgs::msg::JointState>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<HeadJoints>());
  rclcpp::shutdown();
  return 0;
}
