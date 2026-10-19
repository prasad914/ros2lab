# ROS 2 Jazzy Specification Verification Results (P0)

Date: 2026-10-15 (re-checked after upgrade 2026-10-17)  
Reference Environment: Ubuntu 24.04 LTS, ROS 2 Jazzy (`/opt/ros/jazzy`), Gazebo Harmonic 8.15.0 (was 8.11.0 on 2026-10-15).  
Evidence Source: `parity/fixtures/_installed/facts.md` and installed package manifests.

---

## Upgrade re-check (2026-10-17)

After `sudo apt upgrade` (done by the instructor), `capture_installed.sh` and `verify_facts.sh` were re-run. 484 package versions changed (`dpkg_versions.txt`), including nav2 1.3.11 → 1.3.13, ros_gz 1.0.22/1.0.24 mixed → 1.0.24, rviz2 14.1.20 → 14.1.24, and Gazebo 8.11.0 → 8.15.0.

Every installed file cited in the table below was compared with the copy taken before the upgrade, and none changed: `nav2_bringup/params/nav2_params.yaml`, `nav2_bringup/rviz/nav2_default_view.rviz`, `turtlebot3_navigation2/param/burger.yaml`, `turtlebot3_gazebo/models/turtlebot3_waffle/model.sdf`, and the `rviz_default_plugins` XML. The results below therefore still stand. Items 13–15 are still PENDING, because they need a live run (P2).

`ros2_doctor.txt` was re-captured. Its non-warning lines (`""`, `All 5 checks passed`, `""`, `""`) are unchanged, so `parity/unit/doctor.test.mjs` still passes. Its UserWarning lines now name the new package versions.

## Summary Table

| # | Spec Section & Item | Spec Claim | Installed Evidence & File Path | Status |
|---|---|---|---|---|
| 1 | **S5: Docking Server** | `opennav_docking` installed | `facts.md`: `INSTALLED: opennav_docking`. `nav2_bringup/params/nav2_params.yaml:422`: `opennav_docking::SimpleChargingDock`. | **CONFIRMED** |
| 2 | **S5: Route Server** | `nav2_route` installed (flag OFF until installed) | `facts.md`: `INSTALLED: nav2_route`. `nav2_bringup/params/nav2_params.yaml:347`: `nav2_route::ReroutingService`. | **CONFIRMED** |
| 3 | **S5: cmd_vel Type & Stamped Flag** | TB3 Jazzy uses `TwistStamped` (`enable_stamped_cmd_vel: true`) | `turtlebot3_gazebo/params/*_bridge.yaml`: `ros_type_name: geometry_msgs/msg/TwistStamped`. `turtlebot3_navigation2/param/*.yaml`: `enable_stamped_cmd_vel: true`. | **CONFIRMED** |
| 4 | **S5: Nav2 Bringup Defaults** | Planner: NavFn (`use_astar: false`), Controller: MPPI (`DiffDrive`, `time_steps: 56`, `model_dt: 0.05`), AMCL min/max: 500/2000 | `nav2_bringup/params/nav2_params.yaml`: NavfnPlanner (`use_astar: false`, l.284, 286), MPPIController (`DiffDrive`, 56, 0.05, l.98-100, 119), AMCL 500/2000 (l.20-21). | **CONFIRMED** |
| 5 | **S5: Vector Pursuit Controller** | Vector Pursuit in Jazzy | `facts.md`: `no package with 'vector' in its name (Vector Pursuit not installed)`. Available controllers: MPPI, DWB, RPP, Graceful, RotationShim. | **NOT FOUND** |
| 6 | **S6: Local Costmap Dimensions** | `global_frame: odom`, rolling window 3 m × 3 m at 0.05 m resolution | `nav2_bringup/params/nav2_params.yaml:193-198`: `width: 3`, `height: 3`, `resolution: 0.05`, `rolling_window: true`, `global_frame: odom`. | **CONFIRMED** |
| 7 | **S6: Costmap Inflation Parameters** | Exponential decay to `inflation_radius` with `cost_scaling_factor`; check version values | `nav2_bringup/params/nav2_params.yaml`: `inflation_radius: 0.70`, `cost_scaling_factor: 3.0`, `robot_radius: 0.22`. TB3 bringup: `inflation_radius: 0.5`, `cost_scaling_factor: 5.0`, `robot_radius: 0.1` (burger) / `0.15` (waffle). | **CONFIRMED** |
| 8 | **S7: AMCL Parameter Defaults** | `laser_model_type: likelihood_field`, `robot_model_type: nav2_amcl::DifferentialMotionModel`, alpha1-5 = 0.2, `set_initial_pose: false` | `nav2_bringup/params/nav2_params.yaml:3-28`: `alpha1-5: 0.2`, `laser_model_type: likelihood_field`, `robot_model_type: nav2_amcl::DifferentialMotionModel`, `set_initial_pose: false`. | **CONFIRMED** |
| 9 | **S9: Sensors per Robot** | Burger: scan/imu, no camera; Waffle: scan/imu/RGB camera; Waffle Pi: scan/imu/Pi camera | `turtlebot3_gazebo/models/turtlebot3_burger/model.sdf`: imu (200 Hz), gpu_lidar (5 Hz). `turtlebot3_waffle/model.sdf`: gpu_lidar (10 Hz), imu (200 Hz), camera (1080p 30 Hz). `turtlebot3_waffle_pi/model.sdf`: gpu_lidar (10 Hz), imu (200 Hz), camera (480p 30 Hz). | **CONFIRMED** |
| 10 | **S10: DepthCloud Display Plugin** | Expose DepthCloud only if present in installed `rviz_default_plugins` | `facts.md:405` confirms `name="rviz_default_plugins/DepthCloud"` in `/opt/ros/jazzy/share/rviz_default_plugins/plugins_description.xml`. | **CONFIRMED** |
| 11 | **S10: RViz Defaults** | Frame Rate default 30, TF Frame Timeout default 15 s | `nav2_bringup/rviz/nav2_default_view.rviz`: `Frame Rate: 30` (l.531), `Frame Timeout: 15` (l.81). | **CONFIRMED** |
| 12 | **S11: teleop_twist_keyboard Stamped Option** | teleop_twist_keyboard stamped param name | `/opt/ros/jazzy/lib/python3.12/site-packages/teleop_twist_keyboard.py`: `stamped` (boolean, default `False`) and `frame_id` (string, default `''`). | **CONFIRMED** |
| 13 | **S3: Fixed Frame Error Text** | Exact error string when fixed frame is missing | Rviz runtime status message: requires active headless ROS session in P2 to record exact byte string. | **PENDING** (P2 fixture) |
| 14 | **S4: Planner Lethal Goal Error** | Exact planner failure message on lethal cell | NavFn / BT recovery runtime log string: requires active Nav2 run in P2. | **PENDING** (P2 fixture) |
| 15 | **S10: Message Filter Dropping Text** | Exact LaserScan / Map queue error strings | RViz console / display status string: requires active RViz session in P2. | **PENDING** (P2 fixture) |

---

## Detailed Notes & Spec Synchronizations

### 1. Vector Pursuit Controller (S5)
- **Spec Status**: Updated in `parity/reference/nav2_jazzy_spec.md` line 71.
- **Fact**: Vector Pursuit is not packaged into `ros-jazzy-*` on Ubuntu 24.04 Noble. The controllers installed are `nav2_mppi_controller`, `dwb_core`, `nav2_regulated_pure_pursuit_controller`, `nav2_graceful_controller`, and `nav2_rotation_shim_controller`.

### 2. Costmap Inflation Parameters (S6)
- **Spec Status**: Updated in `parity/reference/nav2_jazzy_spec.md` line 79.
- **Fact**: `nav2_bringup` defaults to `robot_radius: 0.22`, `inflation_radius: 0.70`, and `cost_scaling_factor: 3.0`. TurtleBot3 navigation2 params customize this to `inflation_radius: 0.5`, `cost_scaling_factor: 5.0` with `robot_radius: 0.1` (Burger) and `0.15` (Waffle / Waffle Pi).

### 3. teleop_twist_keyboard Parameter Name (S11)
- **Spec Status**: Updated in `parity/reference/nav2_jazzy_spec.md` line 117.
- **Fact**: The node declares `stamped: bool` (default `false`) and `frame_id: string` (default `""`). If `frame_id` is supplied without `stamped=true`, the node raises an error.

### 4. DepthCloud Display (S10)
- **Spec Status**: Updated in `parity/reference/nav2_jazzy_spec.md` line 105.
- **Fact**: `rviz_default_plugins/DepthCloud` is present in the installed `rviz_default_plugins` plugin export XML.
