#include <algorithm>
#include <cmath>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "sensor_msgs/msg/joint_state.hpp"
#include "chiku_kinematics_cpp/kin_math.hpp"

class DiffDriveController : public rclcpp::Node
{
public:
  DiffDriveController() : Node("diff_drive_controller")
  {
    r_ = declare_parameter("wheel_radius", 0.05);
    sep_ = declare_parameter("wheel_separation", 0.30);
    max_wheel_ = declare_parameter("max_wheel_speed", 20.0);     // rad/s
    pub_ = create_publisher<sensor_msgs::msg::JointState>(     // latched: a late echo
      "wheel_commands", rclcpp::QoS(1).transient_local());     // still gets the last command
    sub_ = create_subscription<geometry_msgs::msg::Twist>("cmd_vel", 10,
      std::bind(&DiffDriveController::on_cmd, this, std::placeholders::_1));
  }

private:
  void on_cmd(const geometry_msgs::msg::Twist & msg)
  {
    auto [left, right] = chiku_kinematics_cpp::wheel_speeds(msg.linear.x, msg.angular.z, r_, sep_);
    double biggest = std::max(std::fabs(left), std::fabs(right));
    if (biggest > max_wheel_) {                 // too fast: slow BOTH wheels equally (keeps the curve)
      left *= max_wheel_ / biggest;
      right *= max_wheel_ / biggest;
      RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 1000, "wheel speed limited");
    }
    sensor_msgs::msg::JointState out;
    out.header.stamp = now();
    out.name = {"left_wheel_joint", "right_wheel_joint"};
    out.velocity = {left, right};
    pub_->publish(out);
  }

  double r_, sep_, max_wheel_;
  rclcpp::Publisher<sensor_msgs::msg::JointState>::SharedPtr pub_;
  rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr sub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<DiffDriveController>());
  rclcpp::shutdown();
  return 0;
}
