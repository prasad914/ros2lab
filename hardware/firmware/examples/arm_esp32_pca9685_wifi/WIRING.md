# arm_pca9685: wiring (esp32)

| Joint | Actuator | Output | Feedback |
|---|---|---|---|
| gripper | servo | PCA9685 0x40 channel 0 | - |
| wrist_roll | servo | PCA9685 0x40 channel 1 | - |
| wrist_flex | servo | PCA9685 0x40 channel 2 | - |
| elbow_flex | servo | PCA9685 0x40 channel 3 | - |
| shoulder_lift | servo | PCA9685 0x40 channel 4 | - |
| shoulder_pan | servo | PCA9685 0x40 channel 5 | - |

I2C (SDA 21, SCL 22): PCA9685 servo board(s) (0x40, 0x41), IMU (MPU-6050 0x68 or BNO055 0x28).

Power: servos and motors from their own battery / regulator (never from the board's 5 V pin); connect all grounds.
Joint order = the order of the <ros2_control> block = the order in robot_config.h. Do not reorder one without the other.
