#include "ros2lab_hardware/bridge_system.hpp"

#include <cmath>
#include <limits>
#include <thread>

#include "hardware_interface/types/hardware_interface_type_values.hpp"

// The classic export_*_interfaces() API works on every ROS 2 Jazzy ros2_control release; recent releases mark it
// deprecated in favour of on_export_*_interfaces(), so the warning is silenced here on purpose.
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"

namespace ros2lab_hardware
{

using hardware_interface::CallbackReturn;
using hardware_interface::return_type;
namespace hi = hardware_interface;
namespace pb = ros2lab_bridge;

static const char * IMU_FIELDS[10] = {
  "orientation.x", "orientation.y", "orientation.z", "orientation.w",
  "angular_velocity.x", "angular_velocity.y", "angular_velocity.z",
  "linear_acceleration.x", "linear_acceleration.y", "linear_acceleration.z"};

std::string BridgeSystem::param(const std::string & name, const std::string & def) const
{
  const auto it = info_.hardware_parameters.find(name);
  return it == info_.hardware_parameters.end() ? def : it->second;
}

CallbackReturn BridgeSystem::on_init(const hi::HardwareInfo & info)
{
  if (hi::SystemInterface::on_init(info) != CallbackReturn::SUCCESS) {return CallbackReturn::ERROR;}
  logger_ = rclcpp::get_logger("ros2lab_hardware." + info_.name);
  for (size_t i = 0; i < info_.joints.size(); ++i) {
    const auto & j = info_.joints[i];
    // a joint without a command interface is passive (e.g. the free-rolling front wheels of a car): it is not on the
    // board, and its state stays at its initial value so that robot_state_publisher still has a TF for it
    if (j.command_interfaces.size() > 1) {
      RCLCPP_FATAL(logger_, "Joint '%s' needs one command interface (position or velocity), or none for a passive joint; it has %zu", j.name.c_str(), j.command_interfaces.size());
      return CallbackReturn::ERROR;
    }
    if (j.command_interfaces.empty()) {
      mode_.push_back(Mode::PASSIVE);
    } else {
      const auto & c = j.command_interfaces[0].name;
      if (c != hi::HW_IF_POSITION && c != hi::HW_IF_VELOCITY) {
        RCLCPP_FATAL(logger_, "Joint '%s': command interface '%s' is not supported (position or velocity)", j.name.c_str(), c.c_str());
        return CallbackReturn::ERROR;
      }
      mode_.push_back(c == hi::HW_IF_POSITION ? Mode::POSITION : Mode::VELOCITY);
      board_.push_back(i);
    }
    bool has_pos = false;
    for (const auto & s : j.state_interfaces) {
      if (s.name == hi::HW_IF_POSITION) {has_pos = true;}
      else if (s.name != hi::HW_IF_VELOCITY) {
        RCLCPP_FATAL(logger_, "Joint '%s': state interface '%s' is not supported (position, velocity)", j.name.c_str(), s.name.c_str());
        return CallbackReturn::ERROR;
      }
    }
    if (!has_pos) {
      RCLCPP_FATAL(logger_, "Joint '%s' needs a position state interface", j.name.c_str());
      return CallbackReturn::ERROR;
    }
  }
  if (board_.size() > pb::MAX_JOINTS) {
    RCLCPP_FATAL(logger_, "%zu driven joints: one board drives at most %zu (use a second <ros2_control> block and board)", board_.size(), pb::MAX_JOINTS);
    return CallbackReturn::ERROR;
  }
  const size_t n = info_.joints.size();
  cmd_.assign(n, std::numeric_limits<double>::quiet_NaN());
  pos_.assign(n, 0.0);
  vel_.assign(n, 0.0);
  for (const auto & s : info_.sensors) {
    if (s.state_interfaces.size() == 10) {imu_name_ = s.name; imu_.assign(10, 0.0); imu_[3] = 1.0;}
    else {RCLCPP_WARN(logger_, "Sensor '%s' ignored: an IMU needs the 10 state interfaces orientation.xyzw, angular_velocity.xyz, linear_acceleration.xyz", s.name.c_str());}
  }
  // initial positions from <state_interface name="position"><param name="initial_value">
  for (size_t i = 0; i < n; ++i) {
    for (const auto & s : info_.joints[i].state_interfaces) {
      if (s.name == hi::HW_IF_POSITION && !s.initial_value.empty()) {
        try {pos_[i] = std::stod(s.initial_value);} catch (...) {}
      }
    }
  }
  try {state_timeout_ms_ = std::stoi(param("state_timeout_ms", "250"));} catch (...) {state_timeout_ms_ = 250;}
  if (board_.size() == n) {RCLCPP_INFO(logger_, "%zu joints%s, transport %s", n, imu_name_.empty() ? "" : " + IMU", param("transport", "serial").c_str());}
  else {RCLCPP_INFO(logger_, "%zu joints (%zu passive)%s, transport %s", n, n - board_.size(), imu_name_.empty() ? "" : " + IMU", param("transport", "serial").c_str());}
  return CallbackReturn::SUCCESS;
}

bool BridgeSystem::exchange_hello(std::string & error)
{
  rx_.clear();
  for (int attempt = 0; attempt < 10; ++attempt) {   // about 2 s: an ESP32 / Arduino resets when the port opens
    if (!transport_->write(pb::make_hello())) {error = "cannot write to " + transport_->describe(); return false;}
    const auto until = std::chrono::steady_clock::now() + std::chrono::milliseconds(200);
    while (std::chrono::steady_clock::now() < until) {
      std::vector<uint8_t> buf;
      if (transport_->read(buf, 50) < 0) {error = "the connection to " + transport_->describe() + " was lost"; return false;}
      pb::Frame f;
      for (uint8_t b : buf) {
        if (!parser_.push(b, f)) {continue;}
        pb::Hello h;
        if (!pb::parse_hello_ack(f, h)) {continue;}
        if (h.version != pb::VERSION) {error = "firmware speaks protocol " + std::to_string(h.version) + ", this driver " + std::to_string(pb::VERSION) + ": flash the firmware from this package's version"; return false;}
        if (h.joints != board_.size()) {
          error = "the firmware drives " + std::to_string(h.joints) + " joints, the URDF <ros2_control> has " + std::to_string(board_.size()) +
            ": flash the firmware with the robot_config.h generated for this robot (ros2lab_robot_setup)";
          return false;
        }
        const std::string want = param("robot_id", "");
        if (!want.empty() && h.robot != want) {RCLCPP_WARN(logger_, "Firmware ROBOT_ID is '%s', expected '%s'", h.robot.c_str(), want.c_str());}
        if (!imu_name_.empty() && !h.has_imu) {RCLCPP_WARN(logger_, "The URDF declares an IMU, but the firmware has none: the IMU values stay at zero");}
        RCLCPP_INFO(logger_, "Connected to '%s' on %s (protocol %d, %d joints%s)", h.robot.c_str(), transport_->describe().c_str(), h.version, h.joints, h.has_imu ? ", IMU" : "");
        return true;
      }
    }
  }
  error = "no answer from the board on " + transport_->describe() + " (is the ROS2Lab bridge firmware flashed? right port / IP? powered?)";
  return false;
}

CallbackReturn BridgeSystem::on_configure(const rclcpp_lifecycle::State &)
{
  std::string error;
  int baud = 115200, port = 8888;
  try {baud = std::stoi(param("baud", "115200")); port = std::stoi(param("port", "8888"));} catch (...) {}
  transport_ = make_transport(param("transport", "serial"), param("device", "/dev/ros2lab_mcu"), baud, param("host", "192.168.4.1"), port, error);
  if (!transport_ || !transport_->open(error) || !exchange_hello(error)) {
    RCLCPP_ERROR(logger_, "%s", error.c_str());
    transport_.reset();
    return CallbackReturn::ERROR;
  }
  // first state: the joints' real positions
  have_state_ = false;
  for (int i = 0; i < 20 && !have_state_; ++i) {
    transport_->write(pb::make_command({}));   // an empty command asks for a state without moving anything
    drain(50);
  }
  if (!have_state_) {
    // without the real positions, activating would drive the servos to the URDF's initial values: refuse
    RCLCPP_ERROR(logger_, "The board answered HELLO but sent no joint state within 1 s: not activating");
    transport_.reset();
    return CallbackReturn::ERROR;
  }
  return CallbackReturn::SUCCESS;
}

CallbackReturn BridgeSystem::on_cleanup(const rclcpp_lifecycle::State &)
{
  if (transport_) {transport_->write(pb::make_enable(false)); transport_->close();}
  transport_.reset();
  return CallbackReturn::SUCCESS;
}

CallbackReturn BridgeSystem::on_activate(const rclcpp_lifecycle::State &)
{
  if (!transport_) {return CallbackReturn::ERROR;}
  // start where the robot is: position joints hold their current position, velocity joints stand still
  for (size_t i = 0; i < cmd_.size(); ++i) {cmd_[i] = mode_[i] == Mode::POSITION ? pos_[i] : 0.0;}   // passive: unused
  if (!transport_->write(pb::make_enable(true))) {return CallbackReturn::ERROR;}
  last_state_ = std::chrono::steady_clock::now();
  RCLCPP_INFO(logger_, "Motors enabled");
  return CallbackReturn::SUCCESS;
}

CallbackReturn BridgeSystem::on_deactivate(const rclcpp_lifecycle::State &)
{
  if (transport_) {
    std::vector<float> stop(board_.size());
    for (size_t k = 0; k < board_.size(); ++k) {const size_t i = board_[k]; stop[k] = mode_[i] == Mode::POSITION ? static_cast<float>(pos_[i]) : 0.F;}
    transport_->write(pb::make_command(stop));
    transport_->write(pb::make_enable(false));
  }
  RCLCPP_INFO(logger_, "Motors disabled");
  return CallbackReturn::SUCCESS;
}

std::vector<hi::StateInterface> BridgeSystem::export_state_interfaces()
{
  std::vector<hi::StateInterface> out;
  for (size_t i = 0; i < info_.joints.size(); ++i) {
    for (const auto & s : info_.joints[i].state_interfaces) {
      out.emplace_back(info_.joints[i].name, s.name, s.name == hi::HW_IF_POSITION ? &pos_[i] : &vel_[i]);
    }
  }
  if (!imu_name_.empty()) {
    for (int k = 0; k < 10; ++k) {out.emplace_back(imu_name_, IMU_FIELDS[k], &imu_[static_cast<size_t>(k)]);}
  }
  return out;
}

std::vector<hi::CommandInterface> BridgeSystem::export_command_interfaces()
{
  std::vector<hi::CommandInterface> out;
  for (size_t i : board_) {
    out.emplace_back(info_.joints[i].name, info_.joints[i].command_interfaces[0].name, &cmd_[i]);
  }
  return out;
}

void BridgeSystem::drain(int timeout_ms)
{
  if (!transport_) {return;}
  rx_.clear();
  if (transport_->read(rx_, timeout_ms) < 0) {return;}
  pb::Frame f;
  for (uint8_t b : rx_) {
    if (!parser_.push(b, f)) {continue;}
    if (f.type == pb::MsgType::STATE) {
      pb::State s;
      if (!pb::parse_state(f, s) || s.position.size() != board_.size()) {continue;}
      for (size_t k = 0; k < board_.size(); ++k) {pos_[board_[k]] = s.position[k]; vel_[board_[k]] = s.velocity[k];}
      if (s.has_imu && !imu_.empty()) {
        for (int k = 0; k < 4; ++k) {imu_[static_cast<size_t>(k)] = s.imu.q[static_cast<size_t>(k)];}
        for (int k = 0; k < 3; ++k) {imu_[static_cast<size_t>(4 + k)] = s.imu.gyro[static_cast<size_t>(k)]; imu_[static_cast<size_t>(7 + k)] = s.imu.accel[static_cast<size_t>(k)];}
      }
      have_state_ = true;
      last_state_ = std::chrono::steady_clock::now();
    } else if (f.type == pb::MsgType::FAULT && !f.payload.empty()) {
      const std::string text(f.payload.begin() + 1, f.payload.end());
      RCLCPP_ERROR_THROTTLE(logger_, steady_, 1000, "Board fault %d: %s", f.payload[0], text.c_str());
    }
  }
}

return_type BridgeSystem::read(const rclcpp::Time &, const rclcpp::Duration &)
{
  if (!transport_) {return return_type::ERROR;}
  drain(0);
  const auto age = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - last_state_).count();
  if (age > state_timeout_ms_) {
    RCLCPP_ERROR(logger_, "No joint state from the board for %ld ms (cable? Wi-Fi? power?)", static_cast<long>(age));
    return return_type::ERROR;
  }
  return return_type::OK;
}

return_type BridgeSystem::write(const rclcpp::Time &, const rclcpp::Duration &)
{
  if (!transport_) {return return_type::ERROR;}
  std::vector<float> out(board_.size());
  for (size_t k = 0; k < board_.size(); ++k) {
    const size_t i = board_[k];
    const double c = cmd_[i];
    // no command yet (NaN): hold position / stand still
    out[k] = static_cast<float>(std::isfinite(c) ? c : (mode_[i] == Mode::POSITION ? pos_[i] : 0.0));
  }
  return transport_->write(pb::make_command(out)) ? return_type::OK : return_type::ERROR;
}

}  // namespace ros2lab_hardware

#pragma GCC diagnostic pop

#include "pluginlib/class_list_macros.hpp"
PLUGINLIB_EXPORT_CLASS(ros2lab_hardware::BridgeSystem, hardware_interface::SystemInterface)
