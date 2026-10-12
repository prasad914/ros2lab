#include <memory>
#include <string>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/transform_stamped.hpp"
#include "tf2/LinearMath/Quaternion.h"
#include "tf2_ros/transform_broadcaster.h"
#include "turtlesim/msg/pose.hpp"

class TurtleTfBroadcaster : public rclcpp::Node
{
public:
  TurtleTfBroadcaster() : Node("turtle_tf_broadcaster")
  {
    turtle_ = declare_parameter<std::string>("turtlename", "turtle1");
    br_ = std::make_unique<tf2_ros::TransformBroadcaster>(*this);
    sub_ = create_subscription<turtlesim::msg::Pose>("/" + turtle_ + "/pose", 10,
      std::bind(&TurtleTfBroadcaster::on_pose, this, std::placeholders::_1));
  }

private:
  void on_pose(const turtlesim::msg::Pose & msg)
  {
    geometry_msgs::msg::TransformStamped t;
    t.header.stamp = now();
    t.header.frame_id = "world";          // parent frame
    t.child_frame_id = turtle_;           // child frame
    t.transform.translation.x = msg.x;
    t.transform.translation.y = msg.y;
    t.transform.translation.z = 0.0;
    tf2::Quaternion q;
    q.setRPY(0, 0, msg.theta);            // roll, pitch, yaw
    t.transform.rotation.x = q.x();
    t.transform.rotation.y = q.y();
    t.transform.rotation.z = q.z();
    t.transform.rotation.w = q.w();
    br_->sendTransform(t);
  }

  std::string turtle_;
  std::unique_ptr<tf2_ros::TransformBroadcaster> br_;
  rclcpp::Subscription<turtlesim::msg::Pose>::SharedPtr sub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TurtleTfBroadcaster>());
  rclcpp::shutdown();
  return 0;
}
