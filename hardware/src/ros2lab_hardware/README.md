# ros2lab_hardware

The ros2_control driver for robots built with an ESP32 or Arduino Mega running the ROS2Lab bridge firmware.

| | |
|---|---|
| Plugin | `ros2lab_hardware/BridgeSystem` (hardware_interface::SystemInterface) |
| Joints | one command interface each: `position` (servos) or `velocity` (DC motors); state `position` (+ `velocity`) |
| Sensors | an IMU with the 10 state interfaces of `imu_sensor_broadcaster` (orientation, angular velocity, acceleration) |
| Link | USB serial (`transport: serial`, `device`, `baud`) or Wi-Fi UDP (`transport: udp`, `host`, `port`) |
| Safety | the board only drives the motors after ENABLE and stops them 500 ms after the last command |

## Files

| File | What it is |
|---|---|
| `config/bridge.ros2_control.xacro` | the macro `ros2lab_system`: one `<ros2_control>` block for `hardware_type:=mock`, `gz` or `real` |
| `launch/bridge.launch.py` | robot_state_publisher + ros2_control_node + spawner for any robot on the bridge |
| `scripts/ros2lab_robot_setup.py` | `ros2 run ros2lab_hardware ros2lab_robot_setup`: the ros2_control xacro, controllers.yaml, the firmware's robot_config.h and a wiring table, from the robot's URDF |
| `src/bridge_probe.cpp` | `ros2 run ros2lab_hardware bridge_probe serial /dev/ros2lab_mcu 921600`: talk to the board without ROS |
| `udev/99-ros2lab-mcu.rules` | a fixed name, `/dev/ros2lab_mcu`, for the usual USB-serial chips |
| `test/` | gtest: the protocol, and the plugin against a fake board on a pseudo-terminal |

## Use it

```bash
ros2 run ros2lab_hardware ros2lab_robot_setup --package chiku_description --type diff --board esp32 --imu --out ~/chiku_hw
ros2 launch ros2lab_hardware bridge.launch.py robot_xacro:=<robot with its ros2_control xacro> \
    controllers_file:=~/chiku_hw/controllers.yaml controllers:="joint_state_broadcaster diff_drive_controller" hardware_type:=real
```

The course robots' `<robot>_bringup` packages do this for you: `ros2 launch <robot>_bringup bringup.launch.py hardware_type:=real`.
On ROS2Lab, real hardware needs a hardware license from the course administrator.
