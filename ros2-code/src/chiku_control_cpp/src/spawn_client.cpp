#include <chrono>
#include <memory>

#include "rclcpp/rclcpp.hpp"
#include "turtlesim/srv/spawn.hpp"

using namespace std::chrono_literals;
using turtlesim::srv::Spawn;

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = rclcpp::Node::make_shared("spawn_client");     // a plain node: no class of our own needed
  auto client = node->create_client<Spawn>("/spawn");         // 1. make a client for the /spawn service
  while (!client->wait_for_service(1s)) {                     // 2. wait until turtlesim offers it
    RCLCPP_INFO(node->get_logger(), "waiting for /spawn ... is turtlesim running?");
  }
  auto request = std::make_shared<Spawn::Request>();          // 3. fill in the request
  request->x = 2.0;
  request->y = 8.0;
  request->theta = 0.0;
  request->name = "chiku2";
  auto future = client->async_send_request(request);          // 4. send it (do not wait here)
  if (rclcpp::spin_until_future_complete(node, future) ==     // 5. now wait for the answer
    rclcpp::FutureReturnCode::SUCCESS)
  {
    RCLCPP_INFO(node->get_logger(), "turtlesim made a turtle called %s", future.get()->name.c_str());
  } else {
    RCLCPP_ERROR(node->get_logger(), "the call to /spawn failed");
  }
  rclcpp::shutdown();
  return 0;
}
