# ROS2Lab update V24: ground-truth parity, SDF odometry rates, and Jazzy controller manager activity

V24 builds on V23 with rigorous ground-truth parity fixes against real ROS 2 Jazzy on Ubuntu 24.04, verified across all supported mobile robots and arms.

## What is new

### Ground-truth parity and simulator fidelity

- **SDF Diff-Drive Odometry Rate:** Parsed `odom_publisher_frequency` (30 Hz) directly from upstream SDF plugin configurations (`gz-sdf.js` and `gz-sdformat.js`), aligning simulated mobile robot odometry rates with real Jazzy behaviour.
- **Controller Manager Activity:** Modelled and published `/controller_manager/activity` (`controller_manager_msgs/msg/ControllerManagerActivity`) from the `controller_manager` node with `RELIABLE/TRANSIENT_LOCAL` QoS matching real Jazzy introspection.
- **Dobot CR5 Fake Demo & Actions:** Fixed parameter propagation in `fake_demo_server` (`ros-graph.js`) so that `robot_type` correctly configures action names (`/cr5_group_controller/follow_joint_trajectory`).
- **Waffle Camera Image Transport:** Exported and bridged `image_transport` topics (`compressed`, `theora`, `zstd`) from `ros_gz_image` in `ros-gz.js` and `ros-graph.js`.
- **xArm6 Collision Pairs:** Updated xArm6 SRDF collision pairs (`public/robots/moveit/xarm6.json`) to match upstream arm definitions.

## Files

- **Changed:** `public/js/gz-sdf.js`, `public/js/gz-sdformat.js`, `public/js/ros-graph.js`, `public/js/ros-control-graph.js`, `public/js/ros-gz.js`, `public/robots/moveit/xarm6.json`, `tools/ground-truth/scenarios.txt`, `tests/real-mobile-audit.mjs`.

## Deploy

1. Copy the files of this update over the project (same paths).
2. `firebase deploy --only hosting`

## Checks I ran

All with the site on http://localhost:8080 in Chromium:

- `node tests/real-tb3.mjs`: TurtleBot3 Gazebo launch and teleop.
- `node tests/real-tb3-nav.mjs`: Cartographer SLAM, map saver, and Nav2 goal execution.
- `node tests/real-mobile-audit.mjs`: Sensor audit (scan, imu, odom, camera), SLAM, Nav2, fake node, and Crazyflie.
- `node tests/real-arms-audit.mjs`: Complete arm audit across UR5e, Franka FR3, Kinova Gen3, uArm xArm6, Lite 6, Interbotix WX250s, and Dobot CR5.
- `node tools/ground-truth/compare.mjs`: Validated ground-truth reports against real Jazzy recordings (`ground-truth/REPORT.md`).
- `node tools/security-check.mjs`: Verified all static security rules.
