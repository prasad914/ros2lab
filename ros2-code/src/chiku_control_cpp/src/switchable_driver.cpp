#include <chrono>
#include <memory>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "std_srvs/srv/set_bool.hpp"

using namespace std::chrono_literals;
using std_srvs::srv::SetBool;

class SwitchableDriver : public rclcpp::Node
{
public:
  SwitchableDriver() : Node("switchable_driver")
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    srv_ = create_service<SetBool>("chiku/enable",
      std::bind(&SwitchableDriver::on_enable, this, std::placeholders::_1, std::placeholders::_2));
    timer_ = create_wall_timer(100ms, std::bind(&SwitchableDriver::on_timer, this));
    RCLCPP_INFO(get_logger(), "Ready. Call /chiku/enable with data: true to start.");
  }

private:
  void on_enable(const std::shared_ptr<SetBool::Request> request,
                 std::shared_ptr<SetBool::Response> response)
  {
    enabled_ = request->data;
    response->success = true;
    response->message = enabled_ ? "driving" : "stopped";     // no return: C++ fills the response in place
    RCLCPP_INFO(get_logger(), "enable = %s", enabled_ ? "true" : "false");
  }

  void on_timer()
  {
    geometry_msgs::msg::Twist msg;
    if (enabled_) {
      msg.linear.x = 1.0;
      msg.angular.z = 0.8;
    }
    pub_->publish(msg);
  }

  bool enabled_ = false;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::Service<SetBool>::SharedPtr srv_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SwitchableDriver>());
  rclcpp::shutdown();
  return 0;
}
