# Ground Truth Bag Manifest and Unverified Items

Generated from real ROS 2 Jazzy executions on Ubuntu 24.04 (Gazebo Harmonic).

## 1. Recorded MCAP Rosbags

Total bags recorded: **23**

| Bag Path | Size (MiB) | Duration (s) | Messages | Status |
|---|---|---|---|---|
| `parity/fixtures/tb3_burger/nav2_bringup/bags/NavFn_DWB` | 4.94 | 18.31 | 17579 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/NavFn_Graceful` | 5.91 | 21.67 | 21130 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/NavFn_MPPI` | 5.46 | 21.14 | 20583 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/NavFn_RPP` | 5.08 | 19.08 | 18576 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/NavFn_RotationShimRPP` | 5.45 | 20.29 | 19761 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/Smac2D_DWB` | 4.84 | 17.45 | 16936 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/Smac2D_Graceful` | 5.23 | 20.22 | 19959 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/Smac2D_MPPI` | 5.06 | 18.97 | 18430 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/Smac2D_RPP` | 4.90 | 18.83 | 18327 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/Smac2D_RotationShimRPP` | 5.18 | 19.14 | 18631 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/SmacHybrid_DWB` | 5.15 | 19.11 | 18682 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/SmacHybrid_Graceful` | 6.17 | 22.55 | 22315 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/SmacHybrid_MPPI` | 5.21 | 21.02 | 20219 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/SmacHybrid_RPP` | 4.61 | 18.01 | 17438 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/SmacHybrid_RotationShimRPP` | 5.07 | 19.72 | 19256 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/ThetaStar_DWB` | 4.92 | 17.64 | 17155 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/ThetaStar_Graceful` | 5.98 | 22.56 | 22183 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/ThetaStar_MPPI` | 5.04 | 18.64 | 18037 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/ThetaStar_RPP` | 4.99 | 19.35 | 18773 | VERIFIED |
| `parity/fixtures/tb3_burger/nav2_bringup/bags/ThetaStar_RotationShimRPP` | 5.26 | 19.85 | 19321 | VERIFIED |
| `parity/fixtures/tb3_burger/nav_robotis/bags/run1` | 141.05 | 840.64 | 778075 | VERIFIED |
| `parity/fixtures/tb3_burger/nav_robotis/bags/run2` | 143.93 | 849.18 | 797145 | VERIFIED |
| `parity/fixtures/tb3_burger/slam/bags/run1` | 118.43 | 443.37 | 738132 | VERIFIED |

**Total Archive Size:** 507.88 MiB (532549895 bytes), **Total Messages:** 2696643

## 2. Unverified Items and Reasons

The following configurations could not be executed or verified in standard ROS 2 Jazzy, along with exact diagnostic rationale and preserved error logs:

### SmacPlannerLattice Matrix Combinations
- **Affected Pairs:**
  - `SmacLattice_MPPI`
  - `SmacLattice_DWB`
  - `SmacLattice_RPP`
  - `SmacLattice_RotationShimRPP`
  - `SmacLattice_Graceful`
- **Status:** `UNVERIFIED`
- **Reason:** `SmacPlannerLattice` (`nav2_smac_planner::SmacPlannerLattice`) requires a pre-generated graph lattice file (`lattice_filepath` parameter). No default lattice graph is distributed with standard ROS 2 Jazzy packages (`ros-jazzy-nav2-smac-planner`). When initialized without a valid lattice file path, `planner_server` throws a fatal plugin exception `Could not open lattice file!` and terminates configuration, aborting Nav2 lifecycle activation.
- **Evidence Logs:**
  - `parity/fixtures/tb3_burger/nav2_bringup/logs/SmacLattice_MPPI_unverified.log`
  - `parity/fixtures/tb3_burger/nav2_bringup/logs/SmacLattice_DWB_unverified.log`
  - `parity/fixtures/tb3_burger/nav2_bringup/logs/SmacLattice_RPP_unverified.log`
  - `parity/fixtures/tb3_burger/nav2_bringup/logs/SmacLattice_RotationShimRPP_unverified.log`
  - `parity/fixtures/tb3_burger/nav2_bringup/logs/SmacLattice_Graceful_unverified.log`

### Obstacle Goal Navigation
- **Target:** `obstacle_goal` at (2.25, 0.00)
- **Status:** `VERIFIED_FAILURE` (Expected failure test)
- **Rationale:** Tested to verify planner refusal/costmap collision behavior when a goal is placed directly on an obstacle (pixel [205, 160], occupied with value 100). Costmap inflation and global planner correctly identify the cell as non-traversable and reject path generation.
