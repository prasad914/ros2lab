#include <chrono>
#include <memory>
#include <string>

#include "rclcpp/rclcpp.hpp"
#include "std_srvs/srv/trigger.hpp"

using namespace std::chrono_literals;
using std_srvs::srv::Trigger;

class BatteryChecker : public rclcpp::Node
{
public:
  BatteryChecker() : Node("battery_checker")
  {
    server_ = create_service<Trigger>("chiku/battery",
      [this](const std::shared_ptr<Trigger::Request>, std::shared_ptr<Trigger::Response> res) {
        level_ -= 7;
        res->success = level_ > 20;
        res->message = std::to_string(level_) + " %";
      });
    client_group_ = create_callback_group(rclcpp::CallbackGroupType::MutuallyExclusive);
    timer_group_ = create_callback_group(rclcpp::CallbackGroupType::MutuallyExclusive);
    client_ = create_client<Trigger>("chiku/battery", rclcpp::ServicesQoS(), client_group_);
    timer_ = create_wall_timer(2s, std::bind(&BatteryChecker::on_timer, this), timer_group_);
  }

private:
  void on_timer()
  {
    if (!client_->service_is_ready()) {
      return;
    }
    auto future = client_->async_send_request(std::make_shared<Trigger::Request>());
    // waiting here is OK: the answer is handled by another thread (MultiThreadedExecutor)
    if (future.wait_for(1s) == std::future_status::ready) {
      auto res = future.get();
      RCLCPP_INFO(get_logger(), "battery: %s (ok=%d)", res->message.c_str(), res->success);
    } else {
      RCLCPP_WARN(get_logger(), "no answer within 1 s");
    }
  }

  int level_ = 100;
  rclcpp::Service<Trigger>::SharedPtr server_;
  rclcpp::CallbackGroup::SharedPtr client_group_, timer_group_;
  rclcpp::Client<Trigger>::SharedPtr client_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<BatteryChecker>();
  rclcpp::executors::MultiThreadedExecutor executor;    // several threads
  executor.add_node(node);
  executor.spin();
  rclcpp::shutdown();
  return 0;
}
