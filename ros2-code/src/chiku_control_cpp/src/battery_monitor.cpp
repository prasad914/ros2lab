#include <algorithm>
#include <chrono>
#include <cmath>
#include <memory>

#include "rclcpp/rclcpp.hpp"
#include "turtlesim/msg/pose.hpp"
#include "std_srvs/srv/trigger.hpp"
#include "my_robot_interfaces/msg/battery_status.hpp"

using namespace std::chrono_literals;
using std::placeholders::_1;
using std::placeholders::_2;

// Mini-project: a pretend battery that empties as Chiku drives.
class BatteryMonitor : public rclcpp::Node
{
public:
  BatteryMonitor() : Node("battery_monitor")
  {
    declare_parameter("drain_per_metre", 2.0);    // percent used for every metre driven
    declare_parameter("low_level", 20.0);         // warn below this percentage
    pub_ = create_publisher<my_robot_interfaces::msg::BatteryStatus>("chiku/battery", 10);
    sub_ = create_subscription<turtlesim::msg::Pose>(
      "/turtle1/pose", 10, std::bind(&BatteryMonitor::on_pose, this, _1));
    srv_ = create_service<std_srvs::srv::Trigger>(
      "chiku/recharge", std::bind(&BatteryMonitor::on_recharge, this, _1, _2));
    timer_ = create_wall_timer(1s, std::bind(&BatteryMonitor::on_timer, this));
    RCLCPP_INFO(get_logger(), "Battery monitor ready: 100.0 %%");
  }

private:
  void on_pose(const turtlesim::msg::Pose & msg)
  {
    if (has_last_) {
      double metres = std::hypot(msg.x - last_.x, msg.y - last_.y);
      double drain = get_parameter("drain_per_metre").as_double();
      level_ = std::max(0.0, level_ - metres * drain);
    }
    last_ = msg;
    has_last_ = true;
  }

  void on_timer()
  {
    my_robot_interfaces::msg::BatteryStatus msg;
    msg.robot_name = "chiku";
    msg.percentage = level_;
    msg.voltage = 10.0 + 2.6 * level_ / 100.0;    // 10.0 V empty ... 12.6 V full
    msg.is_charging = false;
    pub_->publish(msg);
    double low = get_parameter("low_level").as_double();
    if (level_ < low && !warned_) {
      RCLCPP_WARN(get_logger(), "Battery low: %.1f %%. Please recharge!", level_);
      warned_ = true;
    }
  }

  void on_recharge(const std::shared_ptr<std_srvs::srv::Trigger::Request>/*request*/,
                   std::shared_ptr<std_srvs::srv::Trigger::Response> response)
  {
    level_ = 100.0;
    warned_ = false;
    response->success = true;
    response->message = "battery full again";
    RCLCPP_INFO(get_logger(), "Recharged to 100 %%");
  }

  double level_ = 100.0;
  bool has_last_ = false;
  bool warned_ = false;
  turtlesim::msg::Pose last_;
  rclcpp::Publisher<my_robot_interfaces::msg::BatteryStatus>::SharedPtr pub_;
  rclcpp::Subscription<turtlesim::msg::Pose>::SharedPtr sub_;
  rclcpp::Service<std_srvs::srv::Trigger>::SharedPtr srv_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<BatteryMonitor>());
  rclcpp::shutdown();
  return 0;
}
