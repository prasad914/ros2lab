#include <algorithm>
#include <chrono>
#include <cmath>

#include "rclcpp/rclcpp.hpp"
#include "turtlesim/msg/pose.hpp"
#include "my_robot_interfaces/msg/robot_status.hpp"

using namespace std::chrono_literals;
using my_robot_interfaces::msg::RobotStatus;

class StatusPublisher : public rclcpp::Node
{
public:
  StatusPublisher() : Node("status_publisher")
  {
    pub_ = create_publisher<RobotStatus>("chiku/status", 10);
    sub_ = create_subscription<turtlesim::msg::Pose>(
      "/turtle1/pose", 10, [this](const turtlesim::msg::Pose & msg) { pose_ = msg; });
    timer_ = create_wall_timer(500ms, std::bind(&StatusPublisher::on_timer, this));   // 2 Hz
  }

private:
  void on_timer()
  {
    battery_ = std::max(0.0f, battery_ - 0.1f);
    RobotStatus msg;
    msg.name = "chiku";
    msg.x = pose_.x;
    msg.y = pose_.y;
    msg.battery = battery_;
    msg.moving = std::fabs(pose_.linear_velocity) > 0.01 || std::fabs(pose_.angular_velocity) > 0.01;
    pub_->publish(msg);
  }

  turtlesim::msg::Pose pose_;
  float battery_ = 100.0f;
  rclcpp::Publisher<RobotStatus>::SharedPtr pub_;
  rclcpp::Subscription<turtlesim::msg::Pose>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<StatusPublisher>());
  rclcpp::shutdown();
  return 0;
}
