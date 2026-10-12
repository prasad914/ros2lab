# Parts for the course robots

Typical, widely available parts that the firmware supports. The ratings are the makers' published figures for the
common versions. **Check the data sheet of the exact part you buy** (servo and motor clones vary a lot).

## Computers

| Part | Key figures | Notes |
|---|---|---|
| NVIDIA Jetson Orin Nano Super Developer Kit | 6-core Arm Cortex-A78AE, 8 GB, up to 67 TOPS (INT8) | JetPack 7.x is Ubuntu 24.04, so ROS 2 Jazzy installs from apt. On JetPack 6 (Ubuntu 22.04), run Jazzy in a `ros:jazzy` container |
| NVIDIA Jetson Orin NX 16 GB / AGX Orin 64 GB | up to 157 / 275 TOPS | for depth cameras + SLAM + MoveIt on one board |
| ESP32-WROOM-32 DevKitC | 2 x 240 MHz, 520 KB SRAM, Wi-Fi 2.4 GHz, **3.3 V I/O (not 5 V tolerant)** | USB-serial chip CP2102 / CH340 / CH9102 (udev rule included; a CP2102 board is matched by its serial number, because lidars use the same chip) |
| Arduino Mega 2560 | 16 MHz, 256 KB flash, 8 KB SRAM, 5 V I/O, 15 PWM pins, 6 external interrupts (2, 3, 18, 19, 20, 21); the bridge runs at 500000 baud (exact at 16 MHz) | encoders: channel A on 2, 3, 18, 19; I2C uses 20 and 21 |

## Actuators

| Part | Supply | Rating (maker's data) | Interface | Firmware class |
|---|---|---|---|---|
| TowerPro MG996R servo | 4.8 to 6.6 V | about 9.4 kg·cm (4.8 V), 0.17 s / 60° | PWM 50 Hz, about 500 to 2500 µs over 180°, 1500 µs = centre | `ServoPwm` / `ServoPca9685` (travel π, the generator's default) |
| DS3218 servo (270° version) | 4.8 to 6.8 V | about 20 kg·cm (6.8 V) | PWM 500 to 2500 µs over 270° | same; set the travel to 4.712 (3π/2) in `robot_config.h` |
| SG90 micro servo | 4.8 to 6 V | about 1.8 kg·cm | PWM | grippers, small joints |
| Feetech STS3215 bus servo | 6 to 7.4 V (12 V version available) | about 19.5 kg·cm at 7.4 V (7.4 V version); 4096 steps per turn; position, speed, load feedback | half-duplex TTL serial, 1 Mbit/s | `StsServo` |
| ROBOTIS DYNAMIXEL XL430-W250-T | 6.5 to 12 V | about 1.4 N·m stall at 11.1 V | TTL, U2D2 adapter on USB | use the official `dynamixel_hardware_interface` instead of this bridge |
| 12 V DC gear motor with Hall encoder (e.g. JGB37-520, 1:30) | 12 V | encoder 11 lines x 2 edges x 30 = 660 counts per output turn (x2 decoding) | encoder A/B to interrupt pins | `DcMotor` (`counts_per_rev` in `robot_config.h`) |

## Drivers and interface boards

| Part | Rating | Notes |
|---|---|---|
| PCA9685 16-channel PWM board | 12-bit, I2C address 0x40 (to 0x7F with jumpers), logic 2.3 to 5.5 V, servo supply on V+ (separate) | two boards (0x40 and 0x41) for up to 32 servos (hexapod: 18) |
| TB6612FNG dual motor driver | motor supply up to 13.5 V, 1.2 A continuous / 3.2 A peak per channel, logic 2.7 to 5.5 V | small robots (chiku, mecanum with two boards) |
| L298N dual H-bridge | up to 46 V, 2 A per channel; drops about 2 V | wire it as `Driver::L298N` (ENA = PWM, IN1, IN2) |
| BTS7960 (IBT-2) half-bridge pair | 5.5 to 27 V, high current (tens of A) | big wheels; `Driver::BTS7960` (RPWM, LPWM) |

## Sensors

| Part | Figures | Interface | ROS 2 |
|---|---|---|---|
| MPU-6050 (GY-521) | ±250 to ±2000 °/s, ±2 to ±16 g | I2C 0x68 | via the bridge (`--imu`), `imu_sensor_broadcaster` |
| Bosch BNO055 | on-chip 9-axis fusion (absolute orientation) | I2C 0x28 | via the bridge (`bridge::Bno055` in `robot_config.h`) |
| Slamtec RPLIDAR A1 / C1 | 12 m range, 5.5 Hz (A1) / 10 Hz (C1) | USB serial (115200 / 460800 baud) | `sllidar_ros2` → `/scan` |
| LDROBOT LD19 (LD06) | 12 m, 10 Hz | UART 230400 baud | `ldlidar_stl_ros2` → `/scan` |
| Intel RealSense D435i | depth up to 1280 x 720, IMU (BMI055) | USB 3 | `realsense2_camera` |
| Luxonis OAK-D | stereo depth + on-board AI | USB 3 | `depthai_ros_driver` |

## Wiring rules

- The ESP32 runs at 3.3 V: power Hall encoders from 3.3 V, or use a level shifter for 5 V encoder outputs.
- Never power servos or motors from the board's 5 V pin. Give them their own battery or BEC, and join the grounds.
- A 1000 µF capacitor across the servo supply near the PCA9685 stops brown-outs when many servos start together.
- Fuse the battery. Add an emergency-stop switch that cuts motor power, not only the logic.
