// ros2_control hardware for the ROS2Lab course robots: the Jetson talks to one microcontroller board (ESP32 or Arduino)
// over USB serial or Wi-Fi (UDP) with the bridge protocol (protocol.hpp). The board drives the servos and motors and reads
// the encoders and the IMU. Plugin name: ros2lab_hardware/BridgeSystem.
//
// <ros2_control name="arm6_system" type="system">
//   <hardware>
//     <plugin>ros2lab_hardware/BridgeSystem</plugin>
//     <param name="transport">serial</param>          serial | udp
//     <param name="device">/dev/ros2lab_mcu</param>   (serial)
//     <param name="baud">115200</param>               (serial)
//     <param name="host">192.168.4.1</param>          (udp: the ESP32's address)
//     <param name="port">8888</param>                 (udp)
//     <param name="robot_id">arm6</param>             checked against the firmware's ROBOT_ID (warning if different)
//     <param name="state_timeout_ms">250</param>      no state for this long = hardware error
//   </hardware>
//   <joint name="joint1"> <command_interface name="position"/> <state_interface name="position"/> <state_interface name="velocity"/> </joint>
//   <joint name="left_wheel_joint"> <command_interface name="velocity"/> ... </joint>
//   <joint name="front_left_wheel_joint"> <state_interface name="position"/> </joint>   passive: no command, not on the board
//   <sensor name="imu"> <state_interface name="orientation.x"/> ... <state_interface name="linear_acceleration.z"/> </sensor>
// </ros2_control>
#pragma once

#include <chrono>
#include <memory>
#include <string>
#include <vector>

#include "hardware_interface/handle.hpp"
#include "hardware_interface/hardware_info.hpp"
#include "hardware_interface/system_interface.hpp"
#include "hardware_interface/types/hardware_interface_return_values.hpp"
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_lifecycle/state.hpp"
#include "ros2lab_hardware/protocol.hpp"
#include "ros2lab_hardware/transport.hpp"

namespace ros2lab_hardware
{

class BridgeSystem : public hardware_interface::SystemInterface
{
public:
  RCLCPP_SHARED_PTR_DEFINITIONS(BridgeSystem)

  hardware_interface::CallbackReturn on_init(const hardware_interface::HardwareInfo & info) override;
  hardware_interface::CallbackReturn on_configure(const rclcpp_lifecycle::State & previous_state) override;
  hardware_interface::CallbackReturn on_cleanup(const rclcpp_lifecycle::State & previous_state) override;
  hardware_interface::CallbackReturn on_activate(const rclcpp_lifecycle::State & previous_state) override;
  hardware_interface::CallbackReturn on_deactivate(const rclcpp_lifecycle::State & previous_state) override;
  std::vector<hardware_interface::StateInterface> export_state_interfaces() override;
  std::vector<hardware_interface::CommandInterface> export_command_interfaces() override;
  hardware_interface::return_type read(const rclcpp::Time & time, const rclcpp::Duration & period) override;
  hardware_interface::return_type write(const rclcpp::Time & time, const rclcpp::Duration & period) override;

  // for tests and diagnostics
  const std::vector<double> & positions() const {return pos_;}
  const std::vector<double> & commands() const {return cmd_;}
  size_t frame_errors() const {return parser_.errors();}

private:
  enum class Mode { POSITION, VELOCITY, PASSIVE };
  bool exchange_hello(std::string & error);
  void drain(int timeout_ms);
  std::string param(const std::string & name, const std::string & def) const;

  rclcpp::Logger logger_ = rclcpp::get_logger("ros2lab_hardware");
  std::unique_ptr<Transport> transport_;
  ros2lab_bridge::Parser parser_;
  std::vector<uint8_t> rx_;
  std::vector<Mode> mode_;
  std::vector<size_t> board_;     // the joints the board drives, in protocol order (passive joints are left out)
  std::vector<double> cmd_, pos_, vel_;
  std::vector<double> imu_;       // orientation x y z w, angular_velocity x y z, linear_acceleration x y z
  std::string imu_name_;
  bool have_state_ = false;
  std::chrono::steady_clock::time_point last_state_;
  int state_timeout_ms_ = 250;
  rclcpp::Clock steady_{RCL_STEADY_TIME};
};

}  // namespace ros2lab_hardware
