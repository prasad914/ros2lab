# Phase P2 Ground Truth & Parity Report (ROS 2 Jazzy)

**Date**: 2026-10-15  
**Reference Platform**: Ubuntu 24.04 · ROS 2 Jazzy · Gazebo Harmonic 8.11.0 · Nav2 1.3.13 · SLAM Toolbox 2.8.5 · TurtleBot3 Gazebo 2.3.7  

---

## 1. TF Tree Analysis (Sensors Scenario)
- **Observation**: The sensors-scenario TF tree (`tests/fixtures/<robot>/sensors/`) contains `odom -> base_footprint -> base_link -> {base_scan, imu_link, camera frames, wheel links}`, but **no `map` frame**.
- **Reason**: In the `sensors` scenario (`start_reference.sh <robot> sensors ...`), only Gazebo simulation, robot state publisher, and sensor bridge nodes are running. SLAM Toolbox and AMCL are **not** running in this scenario, so there is no node publishing the `map -> odom` transform.
- **TF Frames & Edges per Model**:
  - **`tb3_burger`**:
    - Frames: `odom`, `base_footprint`, `base_link`, `caster_back_link`, `imu_link`, `base_scan`, `wheel_left_link`, `wheel_right_link`
    - Edges: `odom -> base_footprint`, `base_footprint -> base_link`, `base_link -> caster_back_link`, `base_link -> imu_link`, `base_link -> base_scan`, `base_link -> wheel_left_link`, `base_link -> wheel_right_link`.
  - **`tb3_waffle`**:
    - Frames: `odom`, `base_footprint`, `base_link`, `caster_back_left_link`, `caster_back_right_link`, `imu_link`, `base_scan`, `camera_link`, `camera_depth_frame`, `camera_depth_optical_frame`, `camera_rgb_frame`, `camera_rgb_optical_frame`, `wheel_left_link`, `wheel_right_link`
    - Edges: `odom -> base_footprint`, `base_footprint -> base_link`, `base_link -> camera_link`, `camera_link -> camera_depth_frame`, `camera_depth_frame -> camera_depth_optical_frame`, `camera_link -> camera_rgb_frame`, `camera_rgb_frame -> camera_rgb_optical_frame`, `base_link -> caster_back_left_link`, `base_link -> caster_back_right_link`, `base_link -> imu_link`, `base_link -> base_scan`, `base_link -> wheel_left_link`, `base_link -> wheel_right_link`.
  - **`tb3_waffle_pi`**:
    - Frames: `odom`, `base_footprint`, `base_link`, `caster_back_left_link`, `caster_back_right_link`, `imu_link`, `base_scan`, `camera_link`, `camera_rgb_frame`, `camera_rgb_optical_frame`, `wheel_left_link`, `wheel_right_link`
    - Edges: Same hierarchical tree as waffle with Pi camera optical frames.

---

## 2. Navigation Goals Validation (`tests/fixtures/goals.yaml` & `goals_check.md`)
- **Start Pose**: Set to `x: -2.0, y: -0.5`, matching the default spawn pose in `/opt/ros/jazzy/share/turtlebot3_gazebo/launch/turtlebot3_world.launch.py`.
- **Map Origin & Resolution**: Origin `[-2.652, -2.347, 0]`, Resolution `0.05 m/pixel` (`tests/fixtures/maps/turtlebot3_world.yaml`).
- **Free Goals Check**: All 5 goals (`goal_1` to `goal_5`) were converted to PGM pixel coordinates and verified to be in free space (`value > 200`) and at least `0.4 m` away from any obstacle pixel (`min_dist >= 0.40m`).
- **Obstacle Goal Check**: `obstacle_goal_invalid` was verified to lie on an occupied obstacle pixel (`value = 0`).
- **Reference Document**: Detailed pixel coordinates, map values, and distance metrics are logged in `tests/fixtures/goals_check.md`.

---

## 3. Recorded Rosbags Inventory (Phase P2)

| Robot | Scenario | Label | Size | Duration | Messages |
|---|---|---|---|---|---|
| `tb3_burger` | `slam` | `run1` | 312.62 MiB | 2271.05s | 1,310,274 |
| `tb3_burger` | `nav_robotis` | `run1` | 33.27 MiB | 586.97s | 153,610 |
| `tb3_burger` | `nav_robotis` | `run2` | 28.26 MiB | 519.10s | 130,880 |
| `tb3_burger` | `nav_robotis` | `run3` | 25.91 MiB | 486.73s | 120,070 |
| `tb3_burger` | `nav_robotis` | `run4` | 22.62 MiB | 439.89s | 105,334 |
| `tb3_burger` | `nav_robotis` | `run5` | 20.22 MiB | 408.83s | 98,654 |
| `tb3_burger` | `nav_robotis` | `run6` | 18.62 MiB | 358.78s | 87,481 |
| `tb3_burger` | `nav_robotis` | `run7` | 16.98 MiB | 322.05s | 80,473 |
| `tb3_burger` | `nav_robotis` | `run8` | 15.37 MiB | 283.43s | 73,119 |
| `tb3_burger` | `nav_robotis` | `run9` | 13.76 MiB | 248.08s | 65,705 |
| `tb3_burger` | `nav_robotis` | `run10` | 11.34 MiB | 197.88s | 54,404 |

---

## 4. Nav2 Bringup Planner × Controller Matrix (`nav2_bringup`)
Tested 25 planner × controller combinations on `goal_1`:
- **Planners (5)**: NavFn (`nav2_navfn_planner::NavfnPlanner`), Smac2D (`nav2_smac_planner::SmacPlanner2D`), ThetaStar (`nav2_theta_star_planner::ThetaStarPlanner`), SmacHybrid (`nav2_smac_planner::SmacPlannerHybrid`), SmacLattice (`nav2_smac_planner::SmacPlannerLattice`).
- **Controllers (5)**: MPPI (`nav2_mppi_controller::MPPIController`), DWB (`dwb_core::DWBLocalPlanner`), RPP (`nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController`), RotationShim+RPP (`nav2_rotation_shim_controller::RotationShimController`), Graceful (`nav2_graceful_controller::GracefulController`).
- **Status**: 
  - Standard grid/global planners (NavFn, Smac2D, ThetaStar) and local controllers (DWB, MPPI, RPP) successfully configure and reach `goal_1`.
  - Advanced hybrid/lattice planners (SmacHybrid, SmacLattice) and shim/graceful controllers require specialized SE2/kinematic footprint configurations; combinations lacking custom turning radius parameters in `turtlebot3_burger` profile are marked **UNVERIFIED** with corresponding lifecycle transition timeout logs.
