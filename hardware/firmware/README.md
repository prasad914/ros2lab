# ros2lab_bridge firmware

The program on the robot's microcontroller. It sits between the Jetson (ROS 2 Jazzy, `ros2_control`) and the
robot's servos, DC motors, encoders and IMU. The Jetson side is the C++ plugin `ros2lab_hardware/BridgeSystem`.

| Board | Link to the Jetson | Arduino IDE 2 board | Libraries |
|---|---|---|---|
| ESP32 DevKitC (ESP32-WROOM-32), ESP32-S3 | USB serial 921600 baud, and/or Wi-Fi UDP port 8888 | *ESP32 Dev Module* (Arduino-ESP32 core 3.x) | none |
| Arduino Mega 2560 | USB serial 500000 baud | *Arduino Mega or Mega 2560* | *Servo* (only for servos on board pins) |

## Files

| File | What it does |
|---|---|
| `ros2lab_bridge.ino` | serial and Wi-Fi links, the 200 Hz control loop |
| `bridge_core.h` | the board's logic: HELLO, COMMAND, STATE, ENABLE, PING, the 500 ms watchdog |
| `bridge_proto.h` | the frame format (same bytes as `ros2lab_hardware/protocol.hpp`) |
| `actuators.h`, `actuators.cpp` | hobby servos on pins or a PCA9685, Feetech STS3215 bus servos, DC motors with encoders and PID (TB6612FNG, L298N, BTS7960) |
| `imu.h` | MPU-6050 (complementary filter) and BNO055 (on-chip fusion) |
| `robot_config.h` | **your robot**: which joint is which actuator, on which pins. Not in this folder: generate it |
| `examples/` | generated configs: an SO-101 on the Feetech bus (ESP32), a two-wheel robot on a Mega, a PCA9685 arm over Wi-Fi |

## Build and flash

1. Generate the robot's files on the Jetson (or any ROS 2 computer):
   ```bash
   ros2 run ros2lab_hardware ros2lab_robot_setup --package <robot>_description --type <arm|diff|mecanum|ackermann|legged|...> \
       --board esp32 [--servo sts --sts-ids shoulder_pan=1,...] [--imu] [--wifi] --out ~/<robot>_hw
   ```
2. Copy `~/<robot>_hw/robot_config.h` into this folder (next to `ros2lab_bridge.ino`).
3. Open `ros2lab_bridge.ino` in the Arduino IDE, choose the board and port, and upload.
4. With the board on USB and nothing moving: `ros2 run ros2lab_hardware bridge_probe serial /dev/ros2lab_mcu 921600`
   prints the robot id, the joint count and live joint states.

## The protocol

Frames are `0xAA 0x55 type length payload CRC-16/CCITT-FALSE` (little-endian floats). The Jetson sends `HELLO`, then
`ENABLE 1`, then a `COMMAND` (one float per joint, in the joint order of the `<ros2_control>` block) every control
cycle; the board answers each command with a `STATE` (time, position and velocity per joint, optional IMU). If no
command arrives for 500 ms, the board switches the motors off and sends a `FAULT`; the next command switches them on
again. A `COMMAND` with the wrong joint count is refused with a `FAULT`.

## What was checked, and what was not

- Arduino Mega 2560: compiled with avr-gcc 7.3 and the Arduino AVR core 1.8.6 for a two-wheel robot (encoders, PID,
  IMU) and for a six-servo STS3215 arm: no errors, no warnings (about 14 to 19 KB of flash).
- ESP32: compiled only against small host stand-ins for the Arduino-ESP32 API (`test/stubs`), not with the real ESP32
  toolchain. Build it in the Arduino IDE once before you rely on it.
- `test/test_interop.cpp`: the firmware core and the Jetson's protocol code talk to each other byte for byte
  (handshake, enable, commands, the watchdog, noise on the line).
- `test/fake_board.cpp`: the firmware core with simulated joints on a pseudo-terminal. With it, the real ROS 2 Jazzy
  stack (controller_manager 4.49, ros2_controllers 4.43) ran `ros2lab_hardware/BridgeSystem` end to end:
  diff_drive_controller, mecanum_drive_controller and ackermann_steering_controller moved their joints and published
  odometry, and imu_sensor_broadcaster published the IMU.
  `./fake_board /tmp/ros2lab_mcu chiku vv imu`, then launch with `device:=/tmp/ros2lab_mcu`.
- Not tested on real hardware here. Start with the robot lifted or the arm clear of everything, at low speed.
