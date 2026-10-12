#include <chrono>
#include <cmath>
#include <string>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"

using namespace std::chrono_literals;

class SquareDriver : public rclcpp::Node
{
public:
  SquareDriver() : Node("square_driver")
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle1/cmd_vel", 10);
    timer_ = create_wall_timer(100ms, std::bind(&SquareDriver::on_timer, this));
  }

private:
  enum class State { FORWARD, TURN };

  void on_timer()
  {
    geometry_msgs::msg::Twist msg;
    ticks_++;
    if (state_ == State::FORWARD) {
      msg.linear.x = 1.0;
      if (ticks_ >= 20) { state_ = State::TURN; ticks_ = 0; }         // 2 s -> 2 m
    } else {
      msg.angular.z = M_PI / 2.0;                                     // 90 degrees per second
      if (ticks_ >= 10) {                                             // 1 s -> 90 degrees
        state_ = State::FORWARD; ticks_ = 0; sides_++;
        RCLCPP_INFO(get_logger(), "side %d done", sides_);
      }
    }
    if (sides_ == 4) {
      RCLCPP_INFO(get_logger(), "Square finished!");
      timer_->cancel();
      msg = geometry_msgs::msg::Twist();                              // all zeros = stop
    }
    pub_->publish(msg);
  }

  State state_ = State::FORWARD;
  int ticks_ = 0;
  int sides_ = 0;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SquareDriver>());
  rclcpp::shutdown();
  return 0;
}
