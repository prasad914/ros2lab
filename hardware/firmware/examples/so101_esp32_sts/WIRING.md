# so101: wiring (esp32)

| Joint | Actuator | Output | Feedback |
|---|---|---|---|
| gripper | Feetech STS3215 bus servo | bus ID 6 | position + speed (bus) |
| wrist_roll | Feetech STS3215 bus servo | bus ID 5 | position + speed (bus) |
| wrist_flex | Feetech STS3215 bus servo | bus ID 4 | position + speed (bus) |
| elbow_flex | Feetech STS3215 bus servo | bus ID 3 | position + speed (bus) |
| shoulder_lift | Feetech STS3215 bus servo | bus ID 2 | position + speed (bus) |
| shoulder_pan | Feetech STS3215 bus servo | bus ID 1 | position + speed (bus) |

Feetech bus: board Serial2 (RX 13, TX 14) to a half-duplex bus-servo adapter (Waveshare Bus Servo Adapter or the Feetech FE-URT-1 in TTL mode), 1 Mbit/s; servo supply 7.4 V (or 12 V for the 12 V STS3215). Give every servo its ID first (Feetech FD software, one servo on the bus at a time), then set each offset so that the URDF zero pose reads 0 rad.

Power: servos and motors from their own battery / regulator (never from the board's 5 V pin); connect all grounds.
Joint order = the order of the <ros2_control> block = the order in robot_config.h. Do not reorder one without the other.
