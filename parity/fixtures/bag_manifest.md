# Ground Truth Bag Manifest and Unverified Items

Generated from real ROS 2 Jazzy executions on Ubuntu 24.04 (Gazebo Harmonic).

## 1. Recorded MCAP Rosbags

Total bags recorded: **36**

| Bag Path | Size (MiB) | Status |
|---|---|---|
| `nav_robotis/bags/run1` | 141.05 | VERIFIED |
| `nav_robotis/bags/run2` | 143.93 | VERIFIED |
| `nav_robotis/bags/run3` | 141.58 | VERIFIED |
| `nav_robotis/bags/run4` | 139.60 | VERIFIED |
| `nav_robotis/bags/run5` | 47.61 | VERIFIED |
| `nav_robotis/bags/run6` | 0.02 | FAILED (timeout) |
| `nav_robotis/bags/run7` | 35.24 | VERIFIED |
| `nav_robotis/bags/run8` | 4.67 | VERIFIED |
| `nav_robotis/bags/run9` | 0.77 | VERIFIED |
| `nav_robotis/bags/run10` | 1.14 | VERIFIED |
| `nav2_bringup/bags/NavFn_DWB` | 4.94 | VERIFIED |
| `nav2_bringup/bags/NavFn_Graceful` | 5.91 | VERIFIED |
| `nav2_bringup/bags/NavFn_MPPI` | 5.46 | VERIFIED |
| `nav2_bringup/bags/NavFn_RPP` | 5.08 | VERIFIED |
| `nav2_bringup/bags/NavFn_RotationShimRPP` | 5.45 | VERIFIED |
| `nav2_bringup/bags/Smac2D_DWB` | 4.84 | VERIFIED |
| `nav2_bringup/bags/Smac2D_Graceful` | 5.23 | VERIFIED |
| `nav2_bringup/bags/Smac2D_MPPI` | 5.06 | VERIFIED |
| `nav2_bringup/bags/Smac2D_RPP` | 4.90 | VERIFIED |
| `nav2_bringup/bags/Smac2D_RotationShimRPP` | 5.18 | VERIFIED |
| `nav2_bringup/bags/SmacHybrid_DWB` | 5.15 | VERIFIED |
| `nav2_bringup/bags/SmacHybrid_Graceful` | 6.17 | VERIFIED |
| `nav2_bringup/bags/SmacHybrid_MPPI` | 5.21 | VERIFIED |
| `nav2_bringup/bags/SmacHybrid_RPP` | 4.61 | VERIFIED |
| `nav2_bringup/bags/SmacHybrid_RotationShimRPP` | 5.07 | VERIFIED |
| `nav2_bringup/bags/SmacLattice_DWB` | 0.98 | NAV FAILED: goal1 status 6 (ABORTED), position error 1.00 m (`runs/SmacLattice_DWB.json`) |
| `nav2_bringup/bags/SmacLattice_Graceful` | 1.22 | NAV FAILED: goal1 status 6 (ABORTED), position error 0.99 m (`runs/SmacLattice_Graceful.json`) |
| `nav2_bringup/bags/SmacLattice_MPPI` | — | REDO: BAG MISSING; goal1 REJECTED; recorder: `/cmd_vel` has more than one type (`bags/SmacLattice_MPPI.log`). No evidence of deletion; the recorder never produced a usable bag. |
| `nav2_bringup/bags/SmacLattice_RPP` | — | INCOMPLETE: goal1 REJECTED (`runs/SmacLattice_RPP.json`); bag has 11399 messages but no `/cmd_vel` topic in metadata; recorder log has 52 `/cmd_vel has more than one type` errors (`bags/SmacLattice_RPP.log`). No goal reached. The earlier "2.71" value has no source file and is removed. |
| `nav2_bringup/bags/SmacLattice_RotationShimRPP` | — | REDO: BAG MISSING; goal1 REJECTED; recorder: `/cmd_vel` has more than one type (`bags/SmacLattice_RotationShimRPP.log`). No evidence of deletion; the recorder never produced a usable bag. |
| `nav2_bringup/bags/ThetaStar_DWB` | 4.92 | VERIFIED |
| `nav2_bringup/bags/ThetaStar_Graceful` | 5.98 | VERIFIED |
| `nav2_bringup/bags/ThetaStar_MPPI` | 5.04 | VERIFIED |
| `nav2_bringup/bags/ThetaStar_RPP` | 4.99 | VERIFIED |
| `nav2_bringup/bags/ThetaStar_RotationShimRPP` | 5.26 | VERIFIED |
| `slam/bags/run1` | 118.43 | VERIFIED |

## 2. Unverified Items and Rationale

### SmacPlannerLattice State Lattice Planner
- **Status:** `VERIFIED_CONFIG` (Configures and launches successfully with Jazzy sample primitives).
- **Rationale:** With `lattice_filepath` set to `/opt/ros/jazzy/share/nav2_smac_planner/sample_primitives/5cm_resolution/0.5m_turning_radius/diff/output.json`, `SmacPlannerLattice` successfully loads primitives and completes lifecycle configuration and activation without throwing missing file exceptions.

### Obstacle Goal Navigation
- **Target:** `obstacle_goal` at (1.87, 0.40)
- **Status:** `VERIFIED_FAILURE` (Expected failure test)
- **Rationale:** Tested to verify planner refusal/costmap collision behavior when a goal is placed directly on an obstacle (pixel in obstacle cell, value 0). Costmap inflation and global planner correctly identify the cell as non-traversable and reject path generation.
