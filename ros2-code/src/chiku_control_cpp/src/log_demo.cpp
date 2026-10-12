#include <chrono>

#include "rclcpp/rclcpp.hpp"

using namespace std::chrono_literals;

class LogDemo : public rclcpp::Node
{
public:
  LogDemo() : Node("log_demo")
  {
    timer_ = create_wall_timer(200ms, [this]() { on_timer(); });   // 5 times per second
    RCLCPP_INFO_ONCE(get_logger(), "Battery watcher started");
  }

private:
  void on_timer()
  {
    battery_ -= 1.5;
    RCLCPP_DEBUG(get_logger(), "raw battery value: %.1f", battery_);   // hidden unless debug
    RCLCPP_INFO_THROTTLE(get_logger(), *get_clock(), 1000, "battery %.0f %%", battery_);  // 1000 ms
    if (battery_ < 80.0) {
      RCLCPP_WARN_ONCE(get_logger(), "battery below 80 %%");
    }
    if (battery_ < 70.0) {
      RCLCPP_ERROR_THROTTLE(get_logger(), *get_clock(), 2000, "battery low, going home!");
    }
  }

  double battery_ = 100.0;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<LogDemo>());
  rclcpp::shutdown();
  return 0;
}
