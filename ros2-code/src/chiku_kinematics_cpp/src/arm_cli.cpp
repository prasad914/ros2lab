#include <chrono>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>

#include "rclcpp/rclcpp.hpp"
#include "my_robot_interfaces/srv/move_arm.hpp"

using namespace std::chrono_literals;
using my_robot_interfaces::srv::MoveArm;

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = rclcpp::Node::make_shared("arm_cli");
  auto client = node->create_client<MoveArm>("move_arm");
  while (!client->wait_for_service(1s)) {
    RCLCPP_INFO(node->get_logger(), "waiting for /move_arm ...");
  }
  std::cout << "Type a target like \"1.2 0.5\" (metres). Type q to quit." << std::endl;
  std::string line;
  while (rclcpp::ok() && std::getline(std::cin, line)) {     // one line per target
    if (line == "q" || line == "quit" || line == "exit") {
      break;
    }
    std::istringstream in(line);
    auto req = std::make_shared<MoveArm::Request>();
    if (!(in >> req->x >> req->y)) {
      std::cout << "Please type two numbers, for example: 1.2 0.5" << std::endl;
      continue;
    }
    auto future = client->async_send_request(req);
    rclcpp::spin_until_future_complete(node, future);
    auto res = future.get();
    std::cout << (res->success ? "OK: " : "NO: ") << res->message << std::endl;
  }
  rclcpp::shutdown();
  return 0;
}
