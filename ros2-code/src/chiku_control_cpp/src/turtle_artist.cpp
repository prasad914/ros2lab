#include <chrono>
#include <memory>
#include <utility>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "turtlesim/srv/spawn.hpp"
#include "turtlesim/srv/set_pen.hpp"
#include "turtlesim/srv/teleport_absolute.hpp"

using namespace std::chrono_literals;

// Send a request and wait for the answer. Only call this from main(), never inside a callback.
template<typename ServiceT>
typename ServiceT::Response::SharedPtr call(
  rclcpp::Node::SharedPtr node, typename rclcpp::Client<ServiceT>::SharedPtr client,
  typename ServiceT::Request::SharedPtr request)
{
  while (!client->wait_for_service(1s)) {
    RCLCPP_INFO(node->get_logger(), "waiting for %s ...", client->get_service_name());
  }
  auto future = client->async_send_request(request);
  rclcpp::spin_until_future_complete(node, future);
  return future.get();
}

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = rclcpp::Node::make_shared("turtle_artist");

  auto spawn = node->create_client<turtlesim::srv::Spawn>("/spawn");
  auto req = std::make_shared<turtlesim::srv::Spawn::Request>();
  req->x = 2.0; req->y = 2.0; req->theta = 0.0; req->name = "artist";
  auto res = call<turtlesim::srv::Spawn>(node, spawn, req);
  RCLCPP_INFO(node->get_logger(), "spawned %s", res->name.c_str());

  auto pen = node->create_client<turtlesim::srv::SetPen>("/artist/set_pen");
  auto pen_req = std::make_shared<turtlesim::srv::SetPen::Request>();
  pen_req->r = 255; pen_req->g = 200; pen_req->b = 0; pen_req->width = 4; pen_req->off = 0;
  call<turtlesim::srv::SetPen>(node, pen, pen_req);

  auto tele = node->create_client<turtlesim::srv::TeleportAbsolute>("/artist/teleport_absolute");
  std::vector<std::pair<float, float>> corners = {{8.0f, 2.0f}, {5.0f, 7.0f}, {2.0f, 2.0f}};
  for (const auto & [x, y] : corners) {
    auto t = std::make_shared<turtlesim::srv::TeleportAbsolute::Request>();
    t->x = x; t->y = y; t->theta = 0.0;
    call<turtlesim::srv::TeleportAbsolute>(node, tele, t);
    RCLCPP_INFO(node->get_logger(), "line to (%.1f, %.1f)", x, y);
  }
  rclcpp::shutdown();
  return 0;
}
