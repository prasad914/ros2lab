#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/transform_stamped.hpp"
#include "nav_msgs/msg/odometry.hpp"
#include "sensor_msgs/msg/joint_state.hpp"
#include "tf2/LinearMath/Quaternion.h"
#include "tf2_ros/transform_broadcaster.h"
#include "chiku_kinematics_cpp/kin_math.hpp"

class WheelOdometry : public rclcpp::Node
{
public:
  WheelOdometry() : Node("wheel_odometry")
  {
    r_ = declare_parameter("wheel_radius", 0.05);
    sep_ = declare_parameter("wheel_separation", 0.30);
    odom_pub_ = create_publisher<nav_msgs::msg::Odometry>("odom", 10);
    tf_ = std::make_unique<tf2_ros::TransformBroadcaster>(*this);
    sub_ = create_subscription<sensor_msgs::msg::JointState>("wheel_states", 10,
      std::bind(&WheelOdometry::on_wheels, this, std::placeholders::_1));
  }

private:
  void on_wheels(const sensor_msgs::msg::JointState & msg)
  {
    std::map<std::string, double> pos;
    for (size_t i = 0; i < msg.name.size() && i < msg.position.size(); ++i) {
      pos[msg.name[i]] = msg.position[i];
    }
    std::pair<double, double> wheels{pos["left_wheel_joint"], pos["right_wheel_joint"]};
    rclcpp::Time stamp(msg.header.stamp);
    if (!last_) {
      last_ = wheels;
      last_time_ = stamp;
      return;
    }
    double d_left = wheels.first - last_->first, d_right = wheels.second - last_->second;
    double dt = (stamp - last_time_).seconds();
    last_ = wheels;
    last_time_ = stamp;
    auto [ds, dtheta] = chiku_kinematics_cpp::body_twist(d_left, d_right, r_, sep_);
    chiku_kinematics_cpp::integrate(x_, y_, theta_, ds, dtheta);

    tf2::Quaternion q;
    q.setRPY(0.0, 0.0, theta_);
    nav_msgs::msg::Odometry odom;
    odom.header.stamp = msg.header.stamp;
    odom.header.frame_id = "odom";
    odom.child_frame_id = "base_link";
    odom.pose.pose.position.x = x_;
    odom.pose.pose.position.y = y_;
    odom.pose.pose.orientation.x = q.x();
    odom.pose.pose.orientation.y = q.y();
    odom.pose.pose.orientation.z = q.z();
    odom.pose.pose.orientation.w = q.w();
    odom.twist.twist.linear.x = dt > 0 ? ds / dt : 0.0;     // in the ROBOT's frame
    odom.twist.twist.angular.z = dt > 0 ? dtheta / dt : 0.0;
    odom_pub_->publish(odom);

    geometry_msgs::msg::TransformStamped t;
    t.header = odom.header;
    t.child_frame_id = "base_link";
    t.transform.translation.x = x_;
    t.transform.translation.y = y_;
    t.transform.rotation = odom.pose.pose.orientation;
    tf_->sendTransform(t);
  }

  double r_, sep_, x_ = 0.0, y_ = 0.0, theta_ = 0.0;
  std::optional<std::pair<double, double>> last_;
  rclcpp::Time last_time_;
  rclcpp::Publisher<nav_msgs::msg::Odometry>::SharedPtr odom_pub_;
  std::unique_ptr<tf2_ros::TransformBroadcaster> tf_;
  rclcpp::Subscription<sensor_msgs::msg::JointState>::SharedPtr sub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<WheelOdometry>());
  rclcpp::shutdown();
  return 0;
}
