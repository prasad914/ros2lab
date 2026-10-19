# Parity Failures / Unverified Configurations

Reference: `parity/CLAUDE.md` and `parity/reference/nav2_jazzy_spec.md` S4.

## Smac State Lattice Planner (`nav2_smac_planner::SmacPlannerLattice`)

- **Status:** FAIL for goal 1 in all 5 planner × controller pairs. Not verified.
- **Rationale:** The earlier failure ("Could not open lattice file!") was resolved by supplying the Jazzy sample primitives path: `/opt/ros/jazzy/share/nav2_smac_planner/sample_primitives/5cm_resolution/0.5m_turning_radius/diff/output.json` matching the map resolution (`0.05`). The lifecycle nodes load and configure, but no pair reached goal 1:
  - `SmacLattice_DWB`: goal 1 status 6 (ABORTED), position error 1.0009 m (`runs/SmacLattice_DWB.json`)
  - `SmacLattice_Graceful`: goal 1 status 6 (ABORTED), position error 0.9897 m (`runs/SmacLattice_Graceful.json`)
  - `SmacLattice_RPP`: goal 1 REJECTED; bag incomplete, no `/cmd_vel` topic recorded (`bags/SmacLattice_RPP.log`)
  - `SmacLattice_MPPI`: REDO. Goal 1 REJECTED; bag directory absent (no evidence it was deleted; the recorder never produced a usable bag) (`runs/SmacLattice_MPPI.json`, `bags/SmacLattice_MPPI.log`)
  - `SmacLattice_RotationShimRPP`: REDO. Goal 1 REJECTED; bag directory absent (no evidence it was deleted; the recorder never produced a usable bag) (`runs/SmacLattice_RotationShimRPP.json`, `bags/SmacLattice_RotationShimRPP.log`)
- **Recorder error (3 pairs, RPP, MPPI, RotationShimRPP):** `Topic '/cmd_vel' has more than one type associated`. The recorder log does not name the second type. Every complete bag records `/cmd_vel` as `geometry_msgs/msg/Twist`. The only `TwistStamped` in the captured logs is a `controller_server` publisher error on `rt/cmd_vel_nav` (`logs/nav2demo.log:1513`). That error does not show which node published the second `/cmd_vel` type, so the source is **UNVERIFIED**.
- **Not claimed:** no SmacLattice bag has been checked for path or RMSE values. Those numbers have no source.

## Step G (2026-10-18): fixture FAILs left on branch `parity-fixes`, and why

Source of every item: `parity/reports/fixture_parity.md` (generated from `parity/e2e/fixtures/*.spec.ts`).
(The SmacLattice section above describes the earlier P2 runs; the step E matrix, `parity/reports/matrix.md` §2, has
SmacLattice SUCCEEDED with MPPI, RPP, RotationShimRPP and Graceful and ABORTED 104 only with DWB.)

- **nav2_bringup `tb3_simulation_launch.py`** (graph, `/cmd_vel` type, the 25-pair matrix and the 5 DWB_burger pairs):
  the site starts the Nav2 nodes but has no model of the Gazebo world/robot of `nav2_minimal_tb3_sim`
  ("gz is running, but the practice computer has no model of what this program does"), so there is no odom, Nav2 does
  not activate and no goal can run. Faithful fix = model that launch file's `gz sim` + spawn + bridge
  (`nav2_minimal_tb3_sim` waffle SDF, its bridge yaml) in ros-gz.js; too large for an unattended night. Not fixed.
- **Nodes the site does not model (nav_robotis):** `bt_navigator_navigate_*_rclcpp_node`,
  `rviz_navigation_dialog_action_client`, and the tf2 listener nodes of the Nav2 servers. (The tf2 listener nodes of
  rviz2, slam_toolbox, cartographer_node and `launch_ros_<pid>` were added in fdebe44; slam and cartographer now pass.)
  Their endpoints make QoS items for `/rosout`, `/parameter_events`, `/tf`, `/tf_static`, `/clock`,
  `/behavior_tree_log`, `/waypoints` FAIL in nav_robotis. Not fixed: the owners of the four real listener nodes in the
  nav capture are not identifiable from the fixture (random names), so adding them would be a guess.
- **Nav2 topics and endpoints not modelled:** costmap layer topics (`*/obstacle_layer*`, `*/static_layer*`,
  `*/voxel_layer*`, `clearing_endpoints`, `voxel_grid`), docking_server (`/battery_state`, `/staging_pose`,
  `/docking_trajectory`, `/cmd_vel`), route_server (`/route_graph`, `/plan`, `/speed_limit`), `/diagnostics`,
  behavior_server teleop topics, the RViz Nav2 panel selector topics. Not fixed in this run (many endpoints; each needs
  its source line in the Nav2 Jazzy code before it is added).
- **Goals near obstacles (tb3_burger):** in one site session after goal1–5, obstacle_goal ended ABORTED 208 and
  cylinder_centre gave no result within 240 s; in an earlier site run both SUCCEEDED (real: SUCCEEDED). The site result
  varies; the cause (planner tolerance vs. start position) was not isolated. Not fixed.
- **Numeric items** (camera K, goal durations, bringup timeout seconds) stay PENDING-THRESHOLD: `parity/thresholds.yaml`
  has no limit for them.
- **Site test flake (pre-existing):** `tests/real-mobile-audit.mjs` "[nav] NavigateToPose SUCCEEDED" fails in about
  half of the full runs, also on the pre-fix baseline b79f45a (1 of 2 runs); the nav part alone passed 8/8.
