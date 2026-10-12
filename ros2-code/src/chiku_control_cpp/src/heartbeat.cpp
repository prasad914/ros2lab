#include <chrono>

#include "rclcpp/rclcpp.hpp"

using namespace std::chrono_literals;

class Heartbeat : public rclcpp::Node
{
public:
  Heartbeat() : Node("heartbeat"), start_(now())
  {
    timer_ = create_wall_timer(500ms, std::bind(&Heartbeat::on_timer, this));   // 2 Hz
  }

private:
  void on_timer()
  {
    count_++;
    double elapsed = (now() - start_).seconds();
    RCLCPP_INFO(get_logger(), "beat %d after %.1f s", count_, elapsed);
    if (count_ == 10) {
      RCLCPP_INFO(get_logger(), "10 beats done, stopping the timer");
      timer_->cancel();
    }
  }

  int count_ = 0;
  rclcpp::Time start_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<Heartbeat>());
  rclcpp::shutdown();
  return 0;
}
