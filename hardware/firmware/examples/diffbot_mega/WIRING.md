# diffbot: wiring (mega)

| Joint | Actuator | Output | Feedback |
|---|---|---|---|
| wheel_left_joint | DC motor + encoder (TB6612) | PWM 5, IN1 22, IN2 23 | encoder A 2, B 30 |
| wheel_right_joint | DC motor + encoder (TB6612) | PWM 6, IN1 24, IN2 25 | encoder A 3, B 31 |

I2C (SDA 20, SCL 21): IMU (MPU-6050 0x68 or BNO055 0x28).

Power: servos and motors from their own battery / regulator (never from the board's 5 V pin); connect all grounds.
Joint order = the order of the <ros2_control> block = the order in robot_config.h. Do not reorder one without the other.
