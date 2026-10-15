# ROS2Lab Repository & Parity Site Map (P0)

Generated on 2026-10-15 based on installed Jazzy facts (`tests/fixtures/_installed/facts.md`).

## 1. Raw Installed Package Analysis
- **TurtleBot3 `cmd_vel` Type**: Confirmed `geometry_msgs/msg/TwistStamped` across all installed TurtleBot3 bridge YAML files (`turtlebot3_gazebo/params/*_bridge.yaml`), with `enable_stamped_cmd_vel: true` enabled in navigation parameter files (`turtlebot3_navigation2/param/*.yaml`).
- **Cameras per Model (`model.sdf`)**:
  - `tb3_burger`: IMU (`tb3_imu`, 200 Hz), GPU Lidar (`hls_lfcd_lds`, `scan`, 5 Hz). **No camera.**
  - `tb3_burger_cam`: IMU, GPU Lidar, plus wideanglecamera (`camera/image_raw`, 30 Hz, 320x240, hfov 3.183).
  - `tb3_waffle`: IMU, GPU Lidar (10 Hz), RGB camera (`camera/image_raw`, 30 Hz, 1920x1080, hfov 1.02974).
  - `tb3_waffle_pi`: IMU, GPU Lidar (10 Hz), Pi camera (`camera/image_raw`, 30 Hz, 640x480, hfov 1.085595).
- **Costmap Inflation & Parameters**: Inflation layers use exponential decay with `inflation_radius` and `cost_scaling_factor` as configured in `nav2_params.yaml`.
- **Optional Packages Status**:
  - **Present**: `nav2_route`, `opennav_docking`, `nav2_graceful_controller`, `nav2_rotation_shim_controller`, `nav2_mppi_controller`, `nav2_regulated_pure_pursuit_controller`, `nav2_theta_star_planner`, `nav2_smac_planner`, `nav2_collision_monitor`, `rosbridge_server`, `foxglove_bridge`, `robot_localization`, `cartographer_ros`.
  - **Absent**: `nav2_loopback_sim`, `turtlebot4_gz_bringup`.

## 2. [VERIFY] Items Status
| Item | Spec Claim | Installed Evidence / Fact | Status | Action / Correction |
|---|---|---|---|---|
| **Docking Server** (S5) | `opennav_docking` installed | Present in `ros2_pkg_list.txt` | CONFIRMED | None |
| **Route Server** (S5) | `nav2_route` installed | Present in `ros2_pkg_list.txt` | CONFIRMED | None |
| **Velocity Stamped Cmd** (S5) | `enable_stamped_cmd_vel: true` | Present in installed param & bridge files | CONFIRMED | None |
| **AMCL Initial Pose** (S7) | `set_initial_pose: false` | Default in nav2 bringup config | CONFIRMED | None |
| **Sensors per Robot** (S9) | Burger has scan/imu, Waffle has camera | Confirmed via model.sdf files | CONFIRMED | None |
| **RViz Frame Rate / Timeout** (S10) | Frame Rate 30, Timeout 15s | Confirmed in `nav2_default_view.rviz` | CONFIRMED | None |

## 3. Robots on the Site & Code Locations
- **Robots offered**: `tb3_burger`, `tb3_waffle`, `tb3_waffle_pi`, arms (UR5e, Franka FR3, Kinova Gen3, xArm6, Lite 6, WX250s, CR5, IRB120), mobile robots / quadcopters / quadrupeds (Scout, Crazyflie).
- **Fixed Frame dropdown**: Located in RViz global options (`public/js/rviz.js:1534`, `public/js/rviz.js:1856`).
- **TF Registry**: Implemented in `public/js/tf-buffer.js`.
- **3D Views (Gazebo-like)**: Implemented in `public/js/gz-sim.js`, `public/js/gz-window.js`.
- **2D/3D Views (RViz)**: Implemented in `public/js/rviz.js`, `public/js/rviz-sim.js`.

## 4. Gap List vs Spec S1–S12 & Missing Test Hooks
- **Gap List**:
  - Fixed Frame free-text combobox edge cases.
  - Full AMCL particle filter Web Worker integration.
  - Depth map and PointCloud2 field packing parity.
- **Missing Test Hooks**:
  - Complete read-only inspection surface on `window.__ros2lab` covering topic QoS, TF authority, node parameters, lifecycle states, status text, and navigation history.
