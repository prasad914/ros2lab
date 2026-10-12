#include <chrono>
#include <cmath>
#include <memory>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "tf2/exceptions.h"
#include "tf2_ros/buffer.h"
#include "tf2_ros/transform_listener.h"
#include "turtlesim/srv/spawn.hpp"

using namespace std::chrono_literals;

class TurtleFollower : public rclcpp::Node
{
public:
  TurtleFollower() : Node("turtle_follower")
  {
    buffer_ = std::make_unique<tf2_ros::Buffer>(get_clock());
    listener_ = std::make_shared<tf2_ros::TransformListener>(*buffer_);
    spawner_ = create_client<turtlesim::srv::Spawn>("/spawn");
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/turtle2/cmd_vel", 10);
    timer_ = create_wall_timer(100ms, std::bind(&TurtleFollower::on_timer, this));
  }

private:
  void on_timer()
  {
    if (!spawned_) {
      if (spawner_->service_is_ready()) {
        auto req = std::make_shared<turtlesim::srv::Spawn::Request>();
        req->x = 1.0; req->y = 1.0; req->theta = 0.0; req->name = "turtle2";
        spawner_->async_send_request(req);     // no need to wait for the answer
        spawned_ = true;
      }
      return;
    }
    geometry_msgs::msg::TransformStamped t;
    try {
      t = buffer_->lookupTransform("turtle2", "turtle1", tf2::TimePointZero);   // target, source, latest
    } catch (const tf2::TransformException & ex) {
      RCLCPP_INFO_THROTTLE(get_logger(), *get_clock(), 2000,
        "Could not transform turtle1 to turtle2: %s", ex.what());
      return;
    }
    double x = t.transform.translation.x, y = t.transform.translation.y;
    geometry_msgs::msg::Twist cmd;
    cmd.angular.z = 1.0 * std::atan2(y, x);
    cmd.linear.x = 0.5 * std::hypot(x, y);
    pub_->publish(cmd);
  }

  bool spawned_ = false;
  std::unique_ptr<tf2_ros::Buffer> buffer_;
  std::shared_ptr<tf2_ros::TransformListener> listener_;
  rclcpp::Client<turtlesim::srv::Spawn>::SharedPtr spawner_;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TurtleFollower>());
  rclcpp::shutdown();
  return 0;
}
