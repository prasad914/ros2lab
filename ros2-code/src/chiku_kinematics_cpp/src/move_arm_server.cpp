#include <chrono>
#include <cmath>
#include <cstdio>
#include <memory>
#include <string>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "sensor_msgs/msg/joint_state.hpp"
#include "my_robot_interfaces/srv/move_arm.hpp"
#include "chiku_kinematics_cpp/kin_math.hpp"

using namespace std::chrono_literals;
using my_robot_interfaces::srv::MoveArm;

class MoveArmServer : public rclcpp::Node
{
public:
  MoveArmServer() : Node("move_arm_server")
  {
    l1_ = declare_parameter("link1_length", 1.0);
    l2_ = declare_parameter("link2_length", 0.8);
    pub_ = create_publisher<sensor_msgs::msg::JointState>("joint_states", 10);
    srv_ = create_service<MoveArm>("move_arm",
      std::bind(&MoveArmServer::on_move, this, std::placeholders::_1, std::placeholders::_2));
    timer_ = create_wall_timer(100ms, [this]() {
        sensor_msgs::msg::JointState msg;
        msg.header.stamp = now();
        msg.name = {"shoulder_joint", "elbow_joint"};
        msg.position = q_;
        pub_->publish(msg);
      });
    RCLCPP_INFO(get_logger(), "Service /move_arm is ready");
  }

private:
  void on_move(const std::shared_ptr<MoveArm::Request> req, std::shared_ptr<MoveArm::Response> res)
  {
    auto sol = chiku_kinematics_cpp::ik(l1_, l2_, req->x, req->y);
    char text[96];                          // snprintf: printf-style formatting into a string
    if (!sol) {
      res->success = false;
      std::snprintf(text, sizeof(text), "(%.2f, %.2f) is out of reach (reach %.2f m)", req->x, req->y, l1_ + l2_);
    } else {
      q_ = {sol->first, sol->second};
      res->success = true;
      res->shoulder = sol->first;
      res->elbow = sol->second;
      std::snprintf(text, sizeof(text), "moving: shoulder %.1f deg, elbow %.1f deg",
        sol->first * 180.0 / M_PI, sol->second * 180.0 / M_PI);
    }
    res->message = text;
    RCLCPP_INFO(get_logger(), "%s", res->message.c_str());
  }

  double l1_, l2_;
  std::vector<double> q_{0.0, 0.0};
  rclcpp::Publisher<sensor_msgs::msg::JointState>::SharedPtr pub_;
  rclcpp::Service<MoveArm>::SharedPtr srv_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MoveArmServer>());
  rclcpp::shutdown();
  return 0;
}
