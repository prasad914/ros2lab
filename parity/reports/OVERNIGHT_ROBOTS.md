# Overnight robots run (P2b phase B, P2c, M1) – 2026-10-18, unattended

Branch `robots-p2b` from parity-fixes b80c0e4. Domains: P2b 46/ref46, P2c 47/ref47, M1 48/ref48. Decisions per robot
below; nothing in public/ is touched.

## Start
- Instructor's robots_sudo.sh steps recorded and checked in `parity/robots/P2B_PHASE_A.md`.

## ur5e – OFFICIAL-JAZZY (verified)
- Source: apt `ros-jazzy-ur-simulation-gz` 2.5.0-1noble.20261006.043651 (`parity/fixtures/ur5e/sim/run_info.txt`).
- Decision: `gazebo_gui:=false` (the launch file then starts `gz sim -s`, server only) and `launch_rviz:=false`.
- Evidence `parity/fixtures/ur5e/install_check/`: both controllers active; 21 topics; FollowJointTrajectory on
  scaled_joint_trajectory_controller moved shoulder_pan_joint 0.000000 -> 0.300000 rad, error_code 0.

## tb4 – OFFICIAL-JAZZY (verified)
- Source: apt `ros-jazzy-turtlebot4-gz-bringup` 2.0.2-1noble.20261006.045255.
- Attempt 1: `xvfb-run -a ros2 launch turtlebot4_gz_bringup turtlebot4_gz.launch.py rviz:=false`: controllers active
  but Gazebo real_time_factor 0.0049 (software rendering of lidar + OAK-D); kept in `fixtures/tb4/sim_attempt1_xvfb/`.
- Decision: `parity/scripts/launch/tb4_headless.launch.py` = the installed sim.launch.py environment and clock bridge,
  `gz sim -s --headless-rendering` (EGL) instead of the GUI, and the installed turtlebot4_spawn.launch.py unchanged.
  The TurtleBot4 HMI GUI plugins are therefore absent. real_time_factor 0.20.
- Evidence `parity/fixtures/tb4/install_check/`: diffdrive_controller + joint_state_broadcaster active; 53 topics
  (`/cmd_vel [geometry_msgs/msg/TwistStamped]`); 10 s of TwistStamped 0.2 m/s moved /odom x 0.000000 -> 0.042637 m.

## xarm6 – OFFICIAL-JAZZY (verified)
- Source: https://github.com/xArm-Developer/xarm_ros2 branch jazzy 3dc2b5e8 (earlier clone, clean), submodule
  xarm_sdk/cxx v1.18.1. README: "Ubuntu 24.04 + ROS Jazzy", "(2024-11-05) Support Jazzy version … Gazebo Harmonic is
  supported instead".
- Decision: the earlier attempt's `~/robots_ws/{build,install,log}` broke the build ("failed to create symbolic link …
  existing path cannot be removed: Is a directory"); moved to `~/robots_ws/_earlier_attempt_before_2026-10-18/`
  (COLCON_IGNORE, kept). Rebuild: `colcon build --symlink-install --packages-up-to xarm_gazebo xarm_moveit_config`
  → "Summary: 8 packages finished [11min 59s]" (deprecation warnings in xarm_controller).
- Decision: `load_controller:=true` (the launch file's own argument; default false loads no controllers – attempt 1).
- Evidence `parity/fixtures/xarm6/install_check/`: xarm6_traj_controller + joint_state_broadcaster active; 20 topics;
  joint1 0.000000 -> 0.299897 rad, error_code 0.

## lite6 – OFFICIAL-JAZZY (verified)
- Same source and build as xarm6. `lite6_beside_table_gazebo.launch.py load_controller:=true` under xvfb-run.
- Evidence `parity/fixtures/lite6/install_check/`: lite6_traj_controller + joint_state_broadcaster active; 20 topics;
  joint1 0.000000 -> 0.299897 rad, error_code 0.
- stop_reference.sh 46 reported one process left after KILL (pid 518673, already gone a moment later); a second
  stop_reference.sh run found the domain empty.

## cr5 – OFFICIAL-JAZZY (verified)
- Source: https://github.com/Dobot-Arm/DOBOT_6Axis_ROS2_V4 branch jazzy 89d47c66 (git ls-remote shows refs/heads/jazzy;
  README: "| ROS Version | ROS2 Jazzy |", "| Simulation | Gazebo Sim (Harmonic) |"). P2b rule 9 expected Humble only:
  a maker Jazzy branch exists now, so no port (OFFICIAL-JAZZY).
- Build: `--packages-up-to dobot_gazebo dobot_moveit cr5_moveit` → "Summary: 6 packages finished [10min 8s]".
- Attempt 1 failed: `ros2 run dobot_gazebo controller_loader.py cr5` → "No executable found": upstream file mode is
  100644, and --symlink-install links the installed program to it. Decision: rebuilt dobot_gazebo alone without
  --symlink-install (install(PROGRAMS) copies it executable). No upstream change. Attempt 1 in fixtures/cr5/sim_attempt1_symlink_install.
- Scenario: README scenario 3, `DOBOT_TYPE=cr5`, launch file's own `gui:=false`.
- Evidence `parity/fixtures/cr5/install_check/`: cr5_group_controller + joint_state_broadcaster active; 21 topics;
  joint1 0.000000 -> 0.300000 rad, error_code 0.
- Note: the earlier "process left after KILL" (lite6) and this one were my own shell, which had ROS_DOMAIN_ID=46
  exported; stop_reference.sh is now run from a shell without it.

## fr3 – OFFICIAL-JAZZY (verified)
- Source: https://github.com/frankaemika/franka_ros2 jazzy 4acc05c0 (README: "franka_ros2 is built upon ROS 2 jazzy").
  Versions from its dependency.repos: libfranka 0.20.5 (the earlier clone was 0.14.0 with the common submodule not
  initialized; switched to tag 0.20.5 3cc708ca + submodule common 2e090a65), franka_description 2.9.0 (7aeeddc4).
  dependency.repos also lists gz_ros2_control / ros2_control jazzy from source: not cloned, the apt versions built.
- Build: `colcon build --symlink-install --packages-up-to franka_gazebo_bringup --cmake-args -DBUILD_TESTS=OFF
  -DBUILD_TESTING=OFF` → "Summary: 12 packages finished [6min 23s]" (libfranka built by colcon, no make install).
  Decision: tests off (not needed to run the simulation).
- Decision: motion proof with the maker's `joint_position_example_controller` (franka_gazebo_controllers.yaml has no
  joint trajectory controller for the arm); new `parity/scripts/joint_states_motion.py` samples /joint_states.
- Evidence `parity/fixtures/fr3/install_check/`: both controllers active; 18 topics; all 7 joints changed by
  ±0.005299 rad between stamps 9.832 and 10.975 (5 s wall; real_time_factor about 0.23).

## gen3 – OFFICIAL-JAZZY (verified)
- Source: https://github.com/Kinovarobotics/ros2_kortex jazzy 462dab9a (README: "For this branch, ROS2 Jazzy has to be installed
  on Ubuntu 24.04"); gripper https://github.com/PickNikRobotics/ros2_robotiq_gripper main a74d007d.
- Decision: README's simulation.jazzy.repos (ros_gz, gz_ros2_control from source) not imported: the apt packages are
  installed (P2b rule 3a); the build and the simulation worked with them.
- Build: `--packages-up-to kortex_bringup kinova_gen3_7dof_robotiq_2f_85_moveit_config --cmake-args -DBUILD_TESTING=OFF`
  → "Summary: 6 packages finished [1min 30s]".
- Scenario: README "Simulation" with sim_gazebo:=true, launch_rviz:=false, under xvfb-run (GUI always started).
- Evidence `parity/fixtures/gen3/install_check/`: joint_trajectory_controller + joint_state_broadcaster active
  (robotiq_gripper_controller, twist_controller, joint_group_velocity_controller inactive, as the launch leaves them);
  30 topics; joint_1 0.000000 -> 0.300000 rad, error_code 0.

## scout – ROS2LAB-PORT (verified)
- scout_ros2 origin/jazzy has only the hardware driver; the maker's simulation (ugv_gazebo_sim, humble only) is Gazebo
  Classic. Decision: port it (branch jazzy-ros2lab d5068ecc, 2 commits, `parity/robots/scout/PORTING.md`).
- Decision: DiffDrive wheel geometry from the xacro (the Classic plugin values did not match the model); /cmd_vel
  bridged as TwistStamped.
- Build: `--base-paths src/agilex/ugv_gazebo_sim/scout --packages-up-to scout_gazebo_sim` (duplicate package name
  scout_description in scout_ros2) → "Summary: 2 packages finished [12.2s]". Later builds of other robots use their
  own --base-paths for the same reason.
- Evidence `parity/fixtures/scout/install_check/`: controllers.txt = the DiffDrive system line (no controller_manager,
  as for TurtleBot3); 9 topics; TwistStamped 0.2 m/s for 5 s: /odom x 0.000000 -> 0.548800 m, Gazebo model pose x 0.551800.

## crazyflie – NOT BUILT (needs robots_sudo.sh)
- Source: https://github.com/IMRCLab/crazyswarm2 main f1e09954 (only branch).
- The software-in-the-loop sim (`crazyflie launch.py backend:=sim`) imports `cffirmware` in crazyflie_sim/crazyflie_sil.py;
  the bindings come from crazyflie-firmware 2025.02 built with swig (docs2/installation.rst step 6). swig is not
  installed (`apt-cache policy swig`: Candidate 4.2.0-2ubuntu1). `rowan` (step 2, pip) is not installed and has no apt
  package. transforms3d is installed (python3-transforms3d 0.4.1+ds-1).
- Decision: not built; `sudo apt-get install -y swig` added to robots_sudo.sh section 4 with the rowan note.

## P2c – scout (domain 47)
- Decision: scenario name `p2c_sensors` (scenarios/p2c_sensors.sh = sim.sh). `sensors` is a TurtleBot3 case inside
  start_reference.sh (it started the TB3 world and failed on TURTLEBOT3_MODEL; that run was discarded).
- Sensors snapshot `parity/fixtures/scout/p2c_sensors/` (capture_reference.sh, no daemon): 9 topics, 2 nodes, TF
  odom -> base_link -> 4 wheel links + inertial_link, /odom 29.412 Hz sim. The ported Scout V2 model has no lidar,
  camera or IMU (scout_v2.xacro has no sensor), so there are no sensor samples beyond robot_description.
- SLAM and Nav2: not captured – the maker provides neither for Scout on ROS 2 (scout_ros2 jazzy: driver only;
  ugv_gazebo_sim: simulation only). PENDING until a maker SLAM/Nav2 configuration exists.

## P2c – tb4 (domain 47)
- Sensors snapshot `parity/fixtures/tb4/p2c_sensors/` (headless launch, warehouse world): 52 topics, 44 nodes; /scan
  frame turtlebot4/rplidar_link/rplidar, angle ±3.1415927, range 0.164–12.0, 62.422 Hz sim; OAK-D preview image, depth,
  points, camera_info sample. (`samples/scan_meta.yaml` added by hand with ros2 topic echo, best-effort QoS.)
- SLAM (`run_mapping_item.sh` with DOMAIN=47 PARTITION=ref47 GOALS_YAML=none, scenario p2c_slam = the maker's
  slam.launch.py through turtlebot4_spawn slam:=true; coverage drive 180 sim s):
  - attempt 1: map_saver_cli "Failed to spin map subscription" 2 s after start (default save_map_timeout) →
    `fixtures/tb4/p2c_slam_attempt1_map_saver_timeout/`. Decision: MAP_SAVE_TIMEOUT=20.0 for attempt 2.
  - attempt 2 `fixtures/tb4/p2c_slam/`: map saved and reloaded by map_server (active), but it is 11 × 22 cells at
    0.05 m (0.55 × 1.10 m). The launch log has 23 lines "Message Filter dropping message: frame
    'turtlebot4/rplidar_link/rplidar' … discarding message because the queue is full" (`excerpts/slam_dropping.txt`)
    and 1 "Registering sensor"; tf2_echo map odom (6 s) saw no map frame, view_frames later showed map -> odom.
    A 12 m lidar would map more than this even standing still, so the cause is UNVERIFIED (not the 23 drops alone;
    whether the robot left its dock was not recorded).
  - Result: SLAM run captured, the map is NOT usable as a navigation map (two attempts). Navigation uses the maker's warehouse map instead.
- Goals: `parity/fixtures/tb4/goals.yaml` from `pick_goals.py` on the maker's warehouse map (start (0, 0), clearance
  ≥ 0.6 m, spacing ≥ 1.5 m, within 4 m – decision: 4 m keeps a goal short at real_time_factor 0.2), checked FREE by
  check_goals_on_map.py (`goals_check.md`, 6/6 FREE).
- Navigation run 1 (`run_nav_p2c.sh`, `fixtures/tb4/p2c_nav/run1/`): localization and navigation lifecycles active,
  AMCL localized at (-0.001, 0.005); frame_check.py VERDICT NO DATA ("0 valid ranges"); snapshot captured; /undock
  exit 0; goal1 (3.875, -0.985) ABORTED error_code 105 (FollowPath FAILED_TO_MAKE_PROGRESS) after 186.105 s sim,
  controller_server "Failed to make progress", then spin recovery "Exceeded time allowance" (`goal_goal1/nav2_goal_lines.txt`).
  Decision: run stopped after goal1.
- Cause found: under the EGL headless launch every /scan range is 0.164 m = range_min (640/640, rclpy probe during
  run 1). With the maker's GUI launch under xvfb-run the same lidar gives 440 finite ranges, min 1.337 m
  (`fixtures/tb4/p2c_scan_xvfb/scan_probe.txt`; check_goals_on_map.py puts the nearest occupied cell 1.315 m from the
  start). So the headless EGL rendering breaks the TurtleBot4 gpu_lidar on this machine (TB3's lidar works under EGL),
  while xvfb runs at real_time_factor 0.0049.
- Result: tb4 SLAM and navigation ground truth BLOCKED (UNVERIFIED): no rendering mode on this machine gives both a
  valid lidar and a usable speed. The P2b verification (diffdrive, /odom under TwistStamped) is not affected. The
  sensors snapshot's /scan data under EGL is not valid lidar data.

## M1 – ur5e (domain 48)
- Scenario `parity/robots/ur5e/scenarios/moveit.sh`: `xvfb-run -a ros2 launch ur_simulation_gz ur_sim_moveit.launch.py
  ur_type:=ur5e` (the launch file starts RViz and the Gazebo GUI itself). Tools: run_moveit_m1.sh + moveit_capture.py.
- Attempt 1 stopped at "ERROR: /move_group has no robot_description_semantic / robot_description parameter"
  (`ros2 param dump /move_group` = `ros__parameters: {}`); decision: read SRDF and URDF from move_group's latched
  topics /robot_description_semantic and /robot_description. `ros2 param dump /move_group` stayed `{}` for 300 s on
  attempt 2 as well: move_group parameters UNVERIFIED (the param list is captured from the next arm on).
- `parity/fixtures/ur5e/moveit/`: lists, view_frames .gv, controllers (both active), srdf_summary.yaml (group
  ur_manipulator, chain base_link -> tool0, states home, up, test_configuration), urdf_joint_limits.yaml; installed
  ur_moveit_config 3.9.0 files in `fixtures/_installed/ur_moveit_config/`.
- Runs (`runs/<name>/result.json`, `move_group_lines.txt`), velocity/acceleration scaling 0.5, OMPL default pipeline:
  home, up, test_configuration, joint goal, pose goal (tool0 −0.05 m z): 1 SUCCESS; unreachable pose −27
  GOAL_STATE_INVALID; joint outside limits −27 GOAL_STATE_INVALID ("Joint elbow_joint is constrained to be above the
  maximum bounds. Assuming maximum bounds instead."); goal in collision with a 0.2 m box −27 GOAL_STATE_INVALID;
  wrong group −1 PLANNING_FAILED ("Cannot find planning configuration for group 'parity_no_such_group'");
  controller inactive −4 CONTROL_FAILED ("Goal was rejected by server", "Failed to send trajectory part 1 of 1 to
  controller scaled_joint_trajectory_controller"); the controller was reactivated afterwards.

## M1 – xarm6 (domain 48)
- Scenario `xvfb-run -a ros2 launch xarm_moveit_config xarm6_moveit_gazebo.launch.py` (README 5.8).
- Attempt 1 (`fixtures/xarm6/moveit_attempt1_start_state_after_limit/`): the out-of-limits joint goal (joint1 = upper +
  0.5) was clamped and executed (SUCCESS, 30 points); every later failure run then got −26 START_STATE_INVALID.
  Decision (applies to the next arms; ur5e was captured before): that case is plan-only, and the arm returns to the
  first named state before the collision, wrong-group and controller-inactive cases (`reset_*` runs).
- `parity/fixtures/xarm6/moveit/` (attempt 2): group xarm6 (joints joint1–6), states home, hold-up; 100 move_group
  parameters (`move_group_params_rclpy.yaml`; `ros2 param dump` again `{}`, `ros2 param list` works).
  home, hold-up, joint goal: SUCCESS; pose goal (link_eef −0.05 m z): −27 GOAL_STATE_INVALID; unreachable pose −27;
  joint outside limits (plan only): SUCCESS 30 points (clamped to the bound, as on attempt 1); goal-in-collision
  (0.2 m box at the goal's link_eef pose): −10 START_STATE_IN_COLLISION; wrong group −1 PLANNING_FAILED;
  controller inactive −4 CONTROL_FAILED. Installed config: `fixtures/_installed/xarm_moveit_config/` (source repo, see SOURCE.txt).
