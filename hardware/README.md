# ROS2Lab real hardware

This folder holds everything that runs on a **real robot**. The website only *shows* these files inside the course
workspace and never lets students download them. Course staff copy this folder to the robot's computer.

```
 Jetson (Ubuntu 24.04, ROS 2 Jazzy)                                  microcontroller board
 ┌─────────────────────────────────────────────┐   USB serial     ┌───────────────────────────────┐
 │ controller_manager                          │   or Wi-Fi UDP   │ ros2lab_bridge firmware        │
 │  ├ joint_trajectory / diff_drive / ...      │ ◄──────────────► │  servos (PWM / PCA9685 / STS)  │
 │  └ ros2lab_hardware/BridgeSystem  (C++)     │  bridge protocol │  DC motors + encoders (PID)    │
 │ MoveIt 2 · Nav2 · goal_pose_gui · sensors   │                  │  IMU (MPU-6050 / BNO055)       │
 └─────────────────────────────────────────────┘                  └───────────────────────────────┘
```

| Folder | What it is | Checked here |
|---|---|---|
| `src/ros2lab_hardware` | C++ ros2_control `SystemInterface` (`ros2lab_hardware/BridgeSystem`), serial and UDP transports, `bridge_probe` bench tool, `ros2lab_robot_setup` generator, udev rules, xacro macro (`hardware_type:=mock\|gz\|real`) | `colcon build` + `colcon test` against ROS 2 Jazzy sources (gtest: protocol, fake board on a pseudo-terminal, lost board, wrong joint count) |
| `src/goal_pose_gui` | The Goal Pose window and the pose follower (Python, rclpy, python_qt_binding) | `pytest` of the geometry and controller law; flake8 |
| `firmware/ros2lab_bridge` | Firmware for an ESP32 or an Arduino Mega 2560 | Mega: compiled with avr-gcc and the Arduino core (no errors, no warnings). ESP32: compiled against host stubs of the Arduino-ESP32 API only. Flash it once on a real board before you rely on it. Host test: firmware core ↔ Jetson protocol, byte for byte |
| `jetson/` | Jetson setup: ROS 2 Jazzy, udev, a systemd service that starts the robot at boot | shell scripts (review before running) |
| `vendor.repos`, `humble.repos` | The makers' official drivers for the commercial robots (UR, Franka, Kinova, xArm, FANUC, KUKA, ABB, TurtleBot3, Crazyflie, Unitree, Spot, ...) | pinned branches; check each repository before a build |
| `SPECS.md` | Parts, ratings, wiring and data-sheet links | values from the makers' data sheets; check your exact part |

## The course robots on real hardware (arm3, arm6, chiku, mecanum, ackermann, quadruped, hexapod, humanoid, mobile / legged manipulator)

1. **Jetson:** `jetson/setup_jetson.sh` (JetPack 7.x = Ubuntu 24.04: ROS 2 Jazzy natively; JetPack 6: a `ros:jazzy` container).
2. **Workspace:** copy `src/` to `~/ros2_ws/src/`, with the robot's own `<robot>_description` package, then
   `rosdep install --from-paths src -iy && colcon build --symlink-install`.
3. **Generate the robot's hardware files** from its URDF:
   ```bash
   ros2 run ros2lab_hardware ros2lab_robot_setup --package arm6_description --type arm --board esp32 --imu --out ~/arm6_hw
   ```
   You get `arm6.ros2_control.xacro`, `controllers.yaml`, `robot_config.h` and `WIRING.md`. Hobby servos go on a
   PCA9685 (ESP32) or the board's pins (Mega); for Feetech STS3215 bus servos add
   `--servo sts --sts-ids shoulder_pan=1,shoulder_lift=2,...`. Ready-made examples are in `firmware/examples/`.
4. **Wire** the board as `WIRING.md` says. Servos and motors run from their own supply, and all grounds are joined.
5. **Flash** `firmware/ros2lab_bridge/` with the generated `robot_config.h`: Arduino IDE 2, board *ESP32 Dev Module*
   (Arduino-ESP32 core 3.x) or *Arduino Mega or Mega 2560*, library *Servo* for the Mega.
6. **USB name:** `/dev/ros2lab_mcu` comes from `udev/99-ros2lab-mcu.rules` (installed by `setup_jetson.sh`). CH340,
   CH9102, ESP32 native USB and Arduino boards are found by their chip; a CP2102 or FTDI board needs its serial number
   in the rule (lidars use the same chips). The ESP32's Wi-Fi password is made new for each robot by the generator
   (`WIFI_PASS` in `robot_config.h`; `--wifi-pass` to choose one), and while the Jetson is connected the board ignores
   packets from other computers.
7. **Bench test without ROS:** `ros2 run ros2lab_hardware bridge_probe serial /dev/ros2lab_mcu 921600`
   (`bridge_probe udp 192.168.4.1 8888` over Wi-Fi). Add `move 0 0.2` to move joint 0 to 0.2 rad for 2 s.
8. **Run it:** `ros2 launch <robot>_bringup bringup.launch.py hardware_type:=real` (`mock` for fake hardware, `gz` for Gazebo).
   On ROS2Lab, connecting real hardware needs a **hardware license from the course administrator**.

## The commercial robots

Use the makers' maintained drivers, listed in `vendor.repos` (Jazzy) and `humble.repos` (Humble-only drivers, run in a
`ros:humble` container on the Jetson with the same `RMW_IMPLEMENTATION` and `ROS_DOMAIN_ID`, so the topics meet).
Do not rewrite them: they carry the makers' safety logic and controller options (UR External Control, Franka FCI,
KUKA RSI, ABB EGM).

## The quadcopter

Real multirotors fly with a flight controller (PX4 or ArduPilot), not with ros2_control. Use PX4 with the uXRCE-DDS
bridge (`MicroXRCEAgent serial --dev /dev/ttyACM0 -b 921600`) and offboard control from ROS 2 (`px4_msgs`,
`px4_ros_com`). Test in PX4 SITL with Gazebo Harmonic first, and fly with a safety pilot holding the RC kill switch.

## Safety

- Test every new program in Gazebo (`hardware_type:=gz`) or with fake hardware (`mock`) first.
- Keep the emergency stop (or the battery plug) within reach. The firmware stops the motors 500 ms after the last
  command, but that only covers a lost cable or a crashed program, not a wrong command.
- Lift wheeled robots off the ground for the first test. Start arms with `max_velocity_scaling_factor` at 0.1.
