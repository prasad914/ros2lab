# ROS2Lab update V24: Ground-truth parity, arm audits, and ROS 2 Jazzy simulator fidelity

V24 builds on V23 with comprehensive ground-truth parity against real ROS 2 Jazzy on Ubuntu 24.04, verified across all supported mobile robots and manipulator arms. All 11 arm audit scenarios, 7 MoveIt planning pipelines, mobile navigation/SLAM workflows, and 32 gallery robots pass verification tests.

## What is new

### Ground-truth verification kit (`tools/ground-truth/`)

A new automated test harness directly measures parity between the website simulator and real ROS 2 Jazzy on Ubuntu 24.04.

- **`capture.sh`**: Runs scenarios on native Ubuntu 24.04 + Jazzy, capturing nodes, topics, rates, QoS profiles, message schemas, services, actions, controllers, and TF trees.
- **`tests/sim-capture.mjs`**: Captures the identical scenarios from the browser simulator.
- **`compare.mjs`**: Generates a detailed structural diff in `ground-truth/REPORT.md`, identifying differences in topics, rates, publishers/subscribers, and lifecycle events.

### Robotic arm audits & MoveIt 2 parity (`tests/real-arms-audit.mjs`, `tests/real-moveit.mjs`)

Every official arm workspace has been audited against real Jazzy controllers, hardware interfaces, trajectory actions, and MoveIt 2 MotionPlanning panel controls:

- **Universal Robots UR5e**: Verified `ur_sim_control`, `ur_sim_moveit`, and `ur_control.launch.py use_mock_hardware:=true`. All controllers (`joint_state_broadcaster`, `scaled_joint_trajectory_controller`, `io_and_status_controller`, `speed_scaling_state_broadcaster`, `force_torque_sensor_broadcaster`) match real hardware mock states.
- **Franka FR3**: Verified `fr3_moveit_fake` with `fr3_arm_controller`. Handled RViz default display activation for MotionPlanning and verified joint state merging between arm and finger joints at 30 Hz.
- **Kinova Gen3**: Verified `gen3_sim_control` and `gen3_moveit_fake`. Maintained Picknik controller types for inactive twist controllers, and verified the Robotiq 2F-85 parallel gripper action (`control_msgs/action/ParallelGripperCommand`) reaching knuckle target positions.
- **UFACTORY xArm6 & Lite 6**: Resolved `START_STATE_IN_COLLISION` on "home" by adopting upstream disabled collision pairs from `_xarm6_macro.srdf.xacro`. Both `xarm6_moveit_fake` and `lite6_moveit_gazebo` successfully plan and execute trajectories.
- **Interbotix WX250s**: Validated namespaced controller manager (`/wx250s/controller_manager`), 10 Hz joint state updates, and finger gripper trajectory execution.
- **Dobot CR5**: Propagated `robot_type` in `fake_demo_server` to configure `/cr5_group_controller/follow_joint_trajectory`. Verified planning and trajectory execution through `cr5_group_controller`.

### Mobile robot parity & sensor fidelity (`tests/real-mobile-audit.mjs`)

- **Diff-Drive & Odometry**: Preserved upstream Gazebo `DiffDrive` parameter handling (`odom_publish_frequency`, default 50 Hz) matching upstream `gz-sim8` C++ source behavior.
- **TurtleBot3 Waffle Camera**: Exported and bridged `image_transport` topics (`compressed`, `compressedDepth`, `theora`, `zstd`) from `ros_gz_image` with proper QoS profiles.
- **Navigation & SLAM**: Validated Cartographer map generation, `map_saver_cli` YAML/PGM exports, and Nav2 `NavigateToPose` action goal execution.
- **TurtleBot3 Fake Node & Crazyflie**: Verified `tb3-fake.js` and `cf-sim.js` simulation servers for lightweight local execution.

### ros2_control & introspection

- **Controller Manager Activity**: Published `/controller_manager/activity` (`controller_manager_msgs/msg/ControllerManagerActivity`) with `RELIABLE/TRANSIENT_LOCAL` QoS matching real Jazzy controller manager introspection.
- **Lifecycle & Transitions**: Ensured controller transitions correctly reflect active and inactive states in `ros2 control list_controllers`.

---

## Files

- **Changed in simulator core:**
  - `public/js/gz-sdf.js`, `public/js/gz-sdformat.js` (Gazebo SDF plugin parsing and odometry rates)
  - `public/js/ros-graph.js`, `public/js/ros-control-graph.js` (controller manager activity, fake demo server actions)
  - `public/js/ros-gz.js` (image transport bridging)
  - `public/js/ros2-control.js` (Picknik controller support, activation diagnostics)
  - `public/js/moveit-core.js`, `public/js/ros-moveit.js`, `public/js/moveit-rviz.js` (trajectory execution and planning)
  - `public/robots/moveit/xarm6.json` (upstream collision pair definitions)
- **New tools & ground truth:**
  - `tools/ground-truth/capture.sh`
  - `tools/ground-truth/compare.mjs`
  - `tools/ground-truth/scenarios.txt`
  - `tools/ground-truth/README.md`
  - `tests/real-arms-audit.mjs`
- **Updated test suites:**
  - `tests/real-mobile-audit.mjs`, `tests/real-moveit.mjs`

---

## Checks run

All executed against `http://localhost:8080` in Chromium:

- `node tests/real-tb3.mjs`: TurtleBot3 Gazebo launch and teleop (PASSED)
- `node tests/real-tb3-nav.mjs`: Cartographer SLAM, map saver, and Nav2 goal execution (PASSED)
- `node tests/real-mobile-audit.mjs`: Sensor audit (scan, imu, odom, camera), SLAM, Nav2, fake node, Crazyflie (PASSED)
- `node tests/real-arms-audit.mjs`: 11 scenarios across UR5e, FR3, Gen3, xArm6, Lite6, WX250s, CR5 (254/254 checks PASSED)
- `node tests/real-moveit.mjs`: Standalone MoveIt plan & execute for all 7 arms (PASSED)
- `node tests/sweep.mjs`: 32 gallery robots loaded and verified (PASSED)
- `node tests/physics.test.mjs`, `node tests/gz-real-node.mjs`, `node tests/nav2-node.mjs`, `node tests/games-basics.mjs`: Regression suites (PASSED)
- `node tools/security-check.mjs`: All static security checks (PASSED)

---

## Deploy

Only files under `public/` and documentation/tests changed; `functions/`, `firestore.rules`, and `storage.rules` are untouched.

```bash
firebase deploy --only hosting
```
