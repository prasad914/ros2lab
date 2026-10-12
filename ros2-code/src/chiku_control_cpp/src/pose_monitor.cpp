#include <chrono>
#include <cmath>
#include <optional>

#include "rclcpp/rclcpp.hpp"
#include "turtlesim/msg/pose.hpp"

using namespace std::chrono_literals;
using turtlesim::msg::Pose;

class PoseMonitor : public rclcpp::Node
{
public:
  PoseMonitor() : Node("pose_monitor")
  {
    sub_ = create_subscription<Pose>(
      "/turtle1/pose", 10, std::bind(&PoseMonitor::on_pose, this, std::placeholders::_1));
    timer_ = create_wall_timer(1s, std::bind(&PoseMonitor::report, this));
  }

private:
  void on_pose(const Pose & msg)
  {
    if (last_) {
      distance_ += std::hypot(msg.x - last_->x, msg.y - last_->y);
    }
    last_ = msg;
  }

  void report()
  {
    if (!last_) {
      RCLCPP_WARN(get_logger(), "No pose yet. Is turtlesim running?");
      return;
    }
    RCLCPP_INFO(get_logger(), "x=%.2f y=%.2f theta=%.2f travelled=%.2f m",
      last_->x, last_->y, last_->theta, distance_);
  }

  std::optional<Pose> last_;      // empty until the first message arrives
  double distance_ = 0.0;
  rclcpp::Subscription<Pose>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<PoseMonitor>());
  rclcpp::shutdown();
  return 0;
}
