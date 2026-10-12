// The BridgeSystem against a fake board on a pseudo-terminal (the same bytes an ESP32 sends over USB).
#include <gtest/gtest.h>
#include <pty.h>
#include <unistd.h>

#include <atomic>
#include <cmath>
#include <mutex>
#include <thread>

#include "hardware_interface/component_parser.hpp"
#include "ros2lab_hardware/bridge_system.hpp"
#include "rclcpp_lifecycle/state.hpp"
#include "lifecycle_msgs/msg/state.hpp"

#pragma GCC diagnostic ignored "-Wdeprecated-declarations"

namespace pb = ros2lab_bridge;
using hardware_interface::CallbackReturn;
using hardware_interface::return_type;

// a board that answers HELLO, follows position commands exactly and reports velocities = commands for wheels
class FakeBoard
{
public:
  FakeBoard(uint8_t joints, bool imu) : joints_(joints), imu_(imu)
  {
    if (openpty(&master_, &slave_, name_, nullptr, nullptr) != 0) {throw std::runtime_error("openpty");}
    pos_.assign(joints, 0.25F);
    vel_.assign(joints, 0.F);
    th_ = std::thread([this] {run();});
  }
  ~FakeBoard()
  {
    stop_ = true;
    th_.join();
    ::close(master_);
    ::close(slave_);
  }
  std::string device() const {return name_;}
  std::atomic<bool> silent{false};
  std::atomic<bool> no_state{false};   // answers HELLO, never a STATE
  std::atomic<int> commands{0};
  std::atomic<bool> enabled{false};
  std::vector<float> last() {std::lock_guard<std::mutex> l(m_); return last_;}

private:
  void send(const std::vector<uint8_t> & b) {if (!silent) {(void)!::write(master_, b.data(), b.size());}}
  void run()
  {
    pb::Parser p;
    pb::Frame f;
    uint8_t buf[256];
    while (!stop_) {
      fd_set rs;
      FD_ZERO(&rs);
      FD_SET(master_, &rs);
      timeval tv{0, 20000};
      if (select(master_ + 1, &rs, nullptr, nullptr, &tv) <= 0) {continue;}
      const ssize_t n = ::read(master_, buf, sizeof(buf));
      for (ssize_t i = 0; i < n; ++i) {
        if (!p.push(buf[i], f)) {continue;}
        if (f.type == pb::MsgType::HELLO) {send(pb::make_hello_ack(joints_, imu_, "test_robot"));}
        if (f.type == pb::MsgType::ENABLE) {enabled = !f.payload.empty() && f.payload[0] == 1;}
        std::vector<float> c;
        if (pb::parse_command(f, c)) {
          ++commands;
          if (c.size() == joints_ && enabled) {std::lock_guard<std::mutex> l(m_); last_ = c; pos_ = c;}
          pb::State s;
          s.ms = 1000;
          s.position = pos_;
          s.velocity = vel_;
          s.has_imu = imu_;
          s.imu.accel = {0.F, 0.F, 9.81F};
          if (!no_state) {send(pb::make_state(s));}
        }
      }
    }
  }
  int master_ = -1, slave_ = -1;
  char name_[128] = {};
  uint8_t joints_;
  bool imu_;
  std::vector<float> pos_, vel_, last_;
  std::mutex m_;
  std::thread th_;
  std::atomic<bool> stop_{false};
};

static hardware_interface::HardwareInfo info_for(const std::string & device, int joints, bool imu, int passive = 0)
{
  std::string urdf = R"(<?xml version="1.0"?><robot name="test_robot"><link name="base_link"/>)";
  for (int i = 0; i < joints + passive; ++i) {
    urdf += "<link name=\"l" + std::to_string(i) + "\"/><joint name=\"j" + std::to_string(i) +
      "\" type=\"revolute\"><parent link=\"" + (i ? "l" + std::to_string(i - 1) : std::string("base_link")) + "\"/><child link=\"l" + std::to_string(i) +
      "\"/><axis xyz=\"0 0 1\"/><limit lower=\"-3\" upper=\"3\" effort=\"1\" velocity=\"1\"/></joint>";
  }
  urdf += R"(<ros2_control name="test_system" type="system"><hardware><plugin>ros2lab_hardware/BridgeSystem</plugin>)";
  urdf += "<param name=\"transport\">serial</param><param name=\"device\">" + device + "</param><param name=\"baud\">115200</param><param name=\"robot_id\">test_robot</param><param name=\"state_timeout_ms\">150</param></hardware>";
  for (int i = 0; i < joints; ++i) {
    urdf += "<joint name=\"j" + std::to_string(i) + "\"><command_interface name=\"position\"/><state_interface name=\"position\"/><state_interface name=\"velocity\"/></joint>";
  }
  for (int i = joints; i < joints + passive; ++i) {
    urdf += "<joint name=\"j" + std::to_string(i) + "\"><state_interface name=\"position\"/></joint>";
  }
  if (imu) {
    urdf += "<sensor name=\"imu\">";
    for (const char * n : {"orientation.x", "orientation.y", "orientation.z", "orientation.w", "angular_velocity.x", "angular_velocity.y", "angular_velocity.z", "linear_acceleration.x", "linear_acceleration.y", "linear_acceleration.z"}) {
      urdf += std::string("<state_interface name=\"") + n + "\"/>";
    }
    urdf += "</sensor>";
  }
  urdf += "</ros2_control></robot>";
  return hardware_interface::parse_control_resources_from_urdf(urdf).at(0);
}

static const rclcpp_lifecycle::State UNCONFIGURED(lifecycle_msgs::msg::State::PRIMARY_STATE_UNCONFIGURED, "unconfigured");
static const rclcpp_lifecycle::State INACTIVE(lifecycle_msgs::msg::State::PRIMARY_STATE_INACTIVE, "inactive");

TEST(BridgeSystem, ConnectsCommandsAndReads)
{
  FakeBoard board(3, true);
  ros2lab_hardware::BridgeSystem hw;
  ASSERT_EQ(hw.on_init(info_for(board.device(), 3, true)), CallbackReturn::SUCCESS);
  auto states = hw.export_state_interfaces();
  auto cmds = hw.export_command_interfaces();
  EXPECT_EQ(states.size(), 3u * 2u + 10u);
  ASSERT_EQ(cmds.size(), 3u);
  ASSERT_EQ(hw.on_configure(UNCONFIGURED), CallbackReturn::SUCCESS);
  EXPECT_NEAR(hw.positions()[0], 0.25, 1e-6);           // the board's first state
  ASSERT_EQ(hw.on_activate(INACTIVE), CallbackReturn::SUCCESS);
  EXPECT_NEAR(hw.commands()[1], 0.25, 1e-6);            // activation holds the current position
  for (int i = 0; i < 3; ++i) {(void)cmds[static_cast<size_t>(i)].set_value(0.1 * (i + 1));}
  const rclcpp::Time t(0, 0);
  const rclcpp::Duration d(0, 10000000);
  ASSERT_EQ(hw.write(t, d), return_type::OK);
  usleep(60000);
  ASSERT_EQ(hw.read(t, d), return_type::OK);
  EXPECT_NEAR(hw.positions()[2], 0.3, 1e-5);
  EXPECT_TRUE(board.enabled);
  double az = 0;
  for (auto & s : states) {if (s.get_name() == "imu/linear_acceleration.z") {az = s.get_value();}}
  EXPECT_NEAR(az, 9.81, 1e-4);
  ASSERT_EQ(hw.on_deactivate(INACTIVE), CallbackReturn::SUCCESS);
  usleep(40000);
  EXPECT_FALSE(board.enabled);
}

TEST(BridgeSystem, WrongJointCountIsRefused)
{
  FakeBoard board(2, false);
  ros2lab_hardware::BridgeSystem hw;
  ASSERT_EQ(hw.on_init(info_for(board.device(), 3, false)), CallbackReturn::SUCCESS);
  EXPECT_EQ(hw.on_configure(UNCONFIGURED), CallbackReturn::ERROR);
}

TEST(BridgeSystem, LostBoardIsAnError)
{
  FakeBoard board(1, false);
  ros2lab_hardware::BridgeSystem hw;
  ASSERT_EQ(hw.on_init(info_for(board.device(), 1, false)), CallbackReturn::SUCCESS);
  (void)hw.export_state_interfaces();
  (void)hw.export_command_interfaces();
  ASSERT_EQ(hw.on_configure(UNCONFIGURED), CallbackReturn::SUCCESS);
  ASSERT_EQ(hw.on_activate(INACTIVE), CallbackReturn::SUCCESS);
  board.silent = true;
  usleep(250000);
  const rclcpp::Time t(0, 0);
  const rclcpp::Duration d(0, 10000000);
  EXPECT_EQ(hw.read(t, d), return_type::ERROR);
}

TEST(BridgeSystem, BadTransportFailsInInit)
{
  ros2lab_hardware::BridgeSystem hw;
  auto info = info_for("/dev/does_not_exist", 1, false);
  ASSERT_EQ(hw.on_init(info), CallbackReturn::SUCCESS);
  EXPECT_EQ(hw.on_configure(UNCONFIGURED), CallbackReturn::ERROR);
}

TEST(BridgeSystem, PassiveJointsStayOffTheBoard)
{
  FakeBoard board(2, false);   // the board drives 2 joints; the URDF has a third, passive one (no command interface)
  ros2lab_hardware::BridgeSystem hw;
  ASSERT_EQ(hw.on_init(info_for(board.device(), 2, false, 1)), CallbackReturn::SUCCESS);
  auto states = hw.export_state_interfaces();
  auto cmds = hw.export_command_interfaces();
  EXPECT_EQ(states.size(), 2u * 2u + 1u);
  ASSERT_EQ(cmds.size(), 2u);
  ASSERT_EQ(hw.on_configure(UNCONFIGURED), CallbackReturn::SUCCESS);
  ASSERT_EQ(hw.on_activate(INACTIVE), CallbackReturn::SUCCESS);
  (void)cmds[0].set_value(0.5);
  (void)cmds[1].set_value(-0.5);
  const rclcpp::Time t(0, 0);
  const rclcpp::Duration d(0, 10000000);
  ASSERT_EQ(hw.write(t, d), return_type::OK);
  usleep(60000);
  ASSERT_EQ(hw.read(t, d), return_type::OK);
  EXPECT_EQ(board.last().size(), 2u);
  EXPECT_NEAR(hw.positions()[1], -0.5, 1e-5);
  EXPECT_NEAR(hw.positions()[2], 0.0, 1e-9);   // passive: stays at its initial value
}

TEST(BridgeSystem, NoStateMeansNoActivation)
{
  FakeBoard board(1, false);
  board.no_state = true;
  ros2lab_hardware::BridgeSystem hw;
  ASSERT_EQ(hw.on_init(info_for(board.device(), 1, false)), CallbackReturn::SUCCESS);
  EXPECT_EQ(hw.on_configure(UNCONFIGURED), CallbackReturn::ERROR);
}
