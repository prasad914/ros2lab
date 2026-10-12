#include <map>
#include <string>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/point.hpp"
#include "sensor_msgs/msg/joint_state.hpp"
#include "chiku_kinematics_cpp/kin_math.hpp"

class FkNode : public rclcpp::Node
{
public:
  FkNode() : Node("fk_node")
  {
    l1_ = declare_parameter("link1_length", 1.0);
    l2_ = declare_parameter("link2_length", 0.8);
    pub_ = create_publisher<geometry_msgs::msg::Point>(          // latched: a late echo
      "end_effector", rclcpp::QoS(1).transient_local());       // still gets the last answer
    sub_ = create_subscription<sensor_msgs::msg::JointState>("joint_states", 10,
      std::bind(&FkNode::on_joints, this, std::placeholders::_1));
  }

private:
  void on_joints(const sensor_msgs::msg::JointState & msg)
  {
    std::map<std::string, double> joints;                 // match by NAME, not by order
    for (size_t i = 0; i < msg.name.size() && i < msg.position.size(); ++i) {
      joints[msg.name[i]] = msg.position[i];
    }
    if (!joints.count("shoulder_joint") || !joints.count("elbow_joint")) {
      return;
    }
    auto [x, y] = chiku_kinematics_cpp::fk(l1_, l2_, joints["shoulder_joint"], joints["elbow_joint"]);
    geometry_msgs::msg::Point p;
    p.x = x;
    p.y = y;
    pub_->publish(p);
    RCLCPP_INFO_THROTTLE(get_logger(), *get_clock(), 1000, "tip at x=%.3f y=%.3f", x, y);
  }

  double l1_, l2_;
  rclcpp::Publisher<geometry_msgs::msg::Point>::SharedPtr pub_;
  rclcpp::Subscription<sensor_msgs::msg::JointState>::SharedPtr sub_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<FkNode>());
  rclcpp::shutdown();
  return 0;
}
