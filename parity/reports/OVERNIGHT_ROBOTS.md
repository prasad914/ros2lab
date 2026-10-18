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

## wx250s – ROS2LAB-PORT (verified, fake hardware)
- Before building: `git status` + `git diff --stat` of interbotix_ros_core saved to `parity/robots/wx250s/pre_build_state.txt`,
  then `git stash push -u -m pre-p2b-2026-10-18` (stash@{0}, recoverable, nothing discarded).
- Earlier non-git copies and the old build/install/log were moved aside to `~/robots_ws/_earlier_attempt_before_2026-10-18/` (COLCON_IGNORE).
- Build attempt 1/2 failed: `xs_hardware_interface.hpp:43:10: fatal error: hardware_interface/visibility_control.h: No such
  file or directory`. Decision: port it, because this is the maker's own jazzy branch and only Jazzy API drift
  breaks it. Two commits on interbotix_ros_toolboxes jazzy-ros2lab (drop the include; drop the `get_name() final` override)
  → "Summary: 13 packages finished [44.2s]".
- Launch attempt 1 (`parity/fixtures/wx250s/sim_attempt1_fake_components/`): `class fake_components/GenericSystem ...
  does not exist`, so the spawners failed. Fix: commit e8c748c on interbotix_ros_manipulators jazzy-ros2lab (mock_components).
  Attempt 2: all three controllers active.
- Decision: the comparison target is the maker's fake-hardware ros2_control launch, NOT a simulation. The maker's sim is
  Gazebo Classic (xsarm_gz_classic.launch.py). The Gazebo Harmonic port is PENDING (not started in this run).
- Evidence `parity/fixtures/wx250s/install_check/`: controllers.txt (namespace /wx250s), topics.txt, motion_proof.txt
  (FollowJointTrajectory on /wx250s/arm_controller: waist 0.000000 -> 0.300000, error_code 0). `arm_motion_proof.py`
  got a `--joint-states` option for the namespaced topic.

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

## M1 – lite6 (domain 48)
- Scenario `xvfb-run -a ros2 launch xarm_moveit_config lite6_moveit_gazebo.launch.py`; group lite6 (joint1–6), state
  home; 100 move_group parameters. home, joint goal, pose goal (link_eef −0.05 m z): SUCCESS; unreachable pose −6
  TIMED_OUT; joint outside limits (plan only): SUCCESS 30 points (clamped); goal-in-collision −10
  START_STATE_IN_COLLISION; wrong group −1 PLANNING_FAILED; controller inactive −4 CONTROL_FAILED.
  `parity/fixtures/lite6/moveit/`.

## M1 – cr5 (domain 48)
- Scenario `DOBOT_TYPE=cr5 xvfb-run -a ros2 launch dobot_gazebo sim.launch.py` (README scenario 4); group cr5_group
  (chain base_link -> Link6), state home; 150 move_group parameters. home, joint goal, pose goal (Link6 −0.05 m z):
  SUCCESS; unreachable pose −27 GOAL_STATE_INVALID; joint outside limits (plan only): SUCCESS 45 points (clamped);
  goal-in-collision −10 START_STATE_IN_COLLISION; wrong group −1 PLANNING_FAILED; controller inactive −4
  CONTROL_FAILED. `parity/fixtures/cr5/moveit/`, installed config `fixtures/_installed/cr5_moveit/`.

## M1 – fr3 (domain 48)
- Scenario `xvfb-run -a ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=dont-care use_fake_hardware:=true`
  (the maker's fake hardware; franka_gazebo_controllers.yaml has no trajectory controller for MoveIt). Built
  `franka_fr3_moveit_config` up-to: "Summary: 19 packages finished [2min 33s]" (`parity/robots/fr3/build_moveit.log`, gitignored).
- Attempt 1 (`moveit_attempt1_finger_joints/`): joint goals also constrained the finger joints (chain group joints were
  taken from /joint_states). Decision: chain groups resolve to the URDF joints base -> tip (applies to fr3 attempt 2
  and gen3; ur5e was captured with its 6 arm joints from /joint_states, joint goal on elbow_joint).
- Attempt 2 `parity/fixtures/fr3/moveit/`: group fr3_arm (fr3_joint1–7), states ready, extended (+ hand states open,
  close); 100 move_group parameters. ready, extended, joint goal, pose goal (fr3_link8 −0.05 m z): SUCCESS;
  unreachable pose −27; joint outside limits (plan only): SUCCESS 31 points (clamped); goal-in-collision −10
  START_STATE_IN_COLLISION; wrong group −1 PLANNING_FAILED; controller inactive −4 CONTROL_FAILED.

## M1 – gen3 (domain 48)
- Scenario `parity/robots/gen3/scenarios/moveit.sh`: kortex_sim_control.launch.py (Gazebo) then
  kinova_gen3_7dof_robotiq_2f_85_moveit_config sim.launch.py use_sim_time:=true (README), both under xvfb-run.
- Log text: the maker's sim.launch.py starts move_group with `--ros-args --log-level fatal` and `output="log"`
  (comment in the file: "MoveIt is spamming the log because of unknown '*_mimic' joints"), so real move_group logs
  nothing for these runs – no move_group lines in the launch log, its ~/.ros/log file (0 lines) or /rosout.
  Attempts 1 and 2 (`moveit_attempt1_no_move_group_log/`, `moveit_attempt2_no_move_group_log/`, with
  RCUTILS_LOGGING_BUFFERED_STREAM=0) and attempt 3 (/rosout recorder) gave the same codes.
- `parity/fixtures/gen3/moveit/` (attempt 3): group manipulator (joint_1–7; chain base_link -> end_effector_link),
  states Home, Retract, Vertical (+ gripper Open, Close); 151 move_group parameters. Home, Retract, Vertical, joint
  goal, pose goal: SUCCESS; unreachable pose −27; joint outside limits: not run (joint_1 is continuous, no upper limit
  in the URDF); goal-in-collision −26 START_STATE_INVALID, and every later run (reset to Home, wrong group,
  controller inactive) −26 START_STATE_INVALID in all three attempts. Cause UNVERIFIED (no log text); the box is
  removed with a REMOVE CollisionObject after the collision case, success not checked.

## M1 – wx250s (domain 48, ROS2LAB-PORT, fake hardware)
- Scenario `parity/robots/wx250s/scenarios/moveit.sh`: `ros2 launch interbotix_xsarm_moveit xsarm_moveit.launch.py
  robot_model:=wx250s hardware_type:=fake use_moveit_rviz:=false`. Capture: group interbotix_arm, ee wx250s/ee_gripper_link,
  arm_controller on /wx250s/controller_manager. New options `--joint-states` / `--controller-manager` (moveit_capture.py)
  and `CM=` (run_moveit_m1.sh) handle the /wx250s namespace.
- Attempt 1 (`fixtures/wx250s/moveit_attempt1_move_group_crash/`): move_group died at start with `rclcpp::ParameterTypeException
  ... expected [string_array] got [string]`, and the LMA kinematics plugin is not in Jazzy. /move_action never appeared.
  Decision: port fixes 4 and 5 (PORTING.md).
- Attempt 2 (`moveit_attempt2_no_joint_states/`): plans were made, but every execution ended CONTROL_FAILED because move_group
  received no robot state. Decision: port fix 6 (remap /joint_states).
- Attempt 3 `fixtures/wx250s/moveit/` (installed configs: `_installed/interbotix_xsarm_moveit/`, 0.3.0, git e5087da):
  - Home: SUCCESS, 1 point, last time_from_start 0.0.
  - Upright: SUCCESS, 18 points, 1.629 s.
  - Sleep: SUCCESS, 28 points, 2.616 s.
  - joint_goal (waist +0.3): SUCCESS, 8 points, 0.693 s.
  - pose_goal (ee 0.05 m lower, orientation kept): −27 GOAL_STATE_INVALID, "Unable to sample any valid states for goal tree"
    (KDL IK, 6 joints). Measured, not explained further.
  - fail_unreachable_pose: −27 GOAL_STATE_INVALID.
  - fail_joint_outside_limits (plan only): 1 SUCCESS, 26 points, after "Joint waist is constrained to be above the maximum
    bounds. Assuming maximum bounds instead." This is the same clamping seen on the other arms.
  - fail_goal_in_collision: −27 GOAL_STATE_INVALID.
  - fail_wrong_group: −26 START_STATE_INVALID, because CheckStartStateBounds rejects the start: "Joint 'left_finger' from
    the starting state is outside bounds by: [0 ] should be in the range [0.015 ], [0.037 ]" (and the same for
    right_finger). The mock hardware starts the fingers at 0.
  - fail_controller_inactive: −4 CONTROL_FAILED; arm_controller reactivated: True.
  - Domain 48 empty after stop.

## wx250s – Gazebo Harmonic port (domain 46, done after M1)
- Decision: time remained, so the maker's Gazebo Classic launch was ported to Harmonic. These are commits 7–9 in
  `parity/robots/wx250s/PORTING.md`, on the jazzy-ros2lab branches. Only wx250s.urdf.xacro was changed; the other xsarm
  models were not touched.
- Scenario `parity/robots/wx250s/scenarios/gz.sh`: `ros2 launch interbotix_xsarm_sim xsarm_gz_harmonic.launch.py
  robot_model:=wx250s use_rviz:=false`. The first launch activated joint_state_broadcaster, arm_controller and
  gripper_controller.
- Evidence `parity/fixtures/wx250s/gz/install_check/`:
  - controllers.txt: three controllers active;
  - topics.txt: 25 topics;
  - motion_proof.txt: waist −0.003343 → 0.293883 rad, +0.297226 for a commanded +0.3, error_code 0;
  - gz_world.txt: models ground_plane and wx250s, real_time_factor 0.388 / 0.398.
- The M1 MoveIt ground truth above stays on the fake hardware: xsarm_moveit.launch.py has no gz_harmonic mode, and adding
  one was not done. Domain 46 empty after stop.

## Final summary (2026-10-18)
Simulations: `stop_reference.sh` 46, 47 and 48 each reported "nothing running"; `domain_pids` empty for all three; no gz
processes left.

### Per robot (STATUS.md rows updated)
| Robot | Built | Verified | Status | Evidence |
|---|---|---|---|---|
| ur5e | yes | yes | OFFICIAL-JAZZY | `parity/fixtures/ur5e/install_check/`, M1 `parity/fixtures/ur5e/moveit/` |
| tb4 | yes | yes | OFFICIAL-JAZZY | `parity/fixtures/tb4/install_check/`; P2c `tb4/p2c_sensors`, `p2c_slam` (map too small), `p2c_nav/run1` (goal1 ABORTED 105), `p2c_scan_xvfb` |
| xarm6 | yes | yes | OFFICIAL-JAZZY | `parity/fixtures/xarm6/install_check/`, M1 `xarm6/moveit/` |
| lite6 | yes | yes | OFFICIAL-JAZZY | `parity/fixtures/lite6/install_check/`, M1 `lite6/moveit/` |
| cr5 | yes | yes | OFFICIAL-JAZZY | `parity/fixtures/cr5/install_check/`, M1 `cr5/moveit/` |
| fr3 | yes | yes | OFFICIAL-JAZZY | `parity/fixtures/fr3/install_check/`, M1 `fr3/moveit/` (fake hardware) |
| gen3 | yes | yes | OFFICIAL-JAZZY | `parity/fixtures/gen3/install_check/`, M1 `gen3/moveit/` |
| scout | yes | yes | ROS2LAB-PORT | `parity/fixtures/scout/install_check/`, P2c `scout/p2c_sensors`; `parity/robots/scout/PORTING.md` |
| crazyflie | no | no | NOT BUILT | needs swig (apt) + rowan (pip): `parity/scripts/robots_sudo.sh` section 4 |
| wx250s | yes | yes | ROS2LAB-PORT | fake hardware `parity/fixtures/wx250s/install_check/`, Gazebo Harmonic `wx250s/gz/install_check/`, M1 `wx250s/moveit/`; `parity/robots/wx250s/PORTING.md` |

### What failed and why
- crazyflie: not built. The SIL backend needs the cffirmware bindings (swig is not installed) and rowan (pip; the system
  Python is EXTERNALLY-MANAGED). No sudo was allowed in this run.
- tb4 SLAM / navigation: BLOCKED. Under the EGL headless launch every /scan range is range_min (0.164). Under xvfb the
  ranges are valid but real_time_factor is 0.0049. The SLAM map is 0.55 × 1.10 m; nav goal1 ABORTED 105.
- gen3 M1: move_group runs at `--log-level fatal` in the maker's launch, so there are no planner log excerpts. The −26
  cascade after the collision case is UNVERIFIED.
- wx250s needed nine port commits (PORTING.md). Without them it fails on Jazzy at three points:
  - build: hardware_interface API;
  - launch: fake_components;
  - MoveIt: pipeline parameter types, the LMA plugin and the joint_states topic.
  wx250s pose_goal: −27 GOAL_STATE_INVALID with KDL IK (measured; not investigated further).

### What the instructor must do next
1. Run `parity/scripts/robots_sudo.sh` section 4 (swig) and install rowan (pip, in a venv or `--user`
   `--break-system-packages` as you prefer), then rebuild crazyswarm2 and verify crazyflie.
2. TB4 lidar under EGL: check the GPU / EGL driver (or a software EGL such as llvmpipe) so the gpu_lidar returns real
   ranges at a usable speed. Then rerun P2c SLAM and nav for tb4 (`run_mapping_item.sh`, `run_nav_p2c.sh`).
3. Review the ports before parity reports rely on them: scout (ugv_gazebo_sim jazzy-ros2lab d5068ec) and wx250s
   (interbotix_ros_toolboxes jazzy-ros2lab 039e288, interbotix_ros_manipulators jazzy-ros2lab 86951bf).
4. Review the stash `pre-p2b-2026-10-18` in ~/robots_ws/src/interbotix/interbotix_ros_core. It holds the earlier working
   tree (see `parity/robots/wx250s/pre_build_state.txt`); pop or drop it as you decide.
5. Old build trees were moved aside to ~/robots_ws/_earlier_attempt_before_2026-10-18/ (COLCON_IGNORE); delete them
   when no longer needed.
6. Nothing was pushed or deployed. Branch robots-p2b; public/ was not touched.

### Commits on robots-p2b (git log --oneline parity-fixes..HEAD, before this report commit)
```
f29dd57 wx250s: Gazebo Harmonic ROS2LAB-PORT (gz_ros2_control, xsarm_gz_harmonic.launch.py), verified: controllers active, motion proof
4375587 M1 wx250s: MoveIt ground truth on fake hardware after three Jazzy MoveIt port fixes (pipeline params, KDL, joint_states remap)
725b154 M1 tools: --joint-states / --controller-manager (moveit_capture.py) and CM= (run_moveit_m1.sh) for namespaced arms
487cfc7 P2b wx250s: ROS2LAB-PORT build/launch fixes on the maker's jazzy branches, verified on fake hardware
347df77 M1 gen3: MoveIt ground truth (move_group runs at --log-level fatal by the maker's launch; START_STATE_INVALID after the collision case UNVERIFIED)
46dc31e moveit_capture.py: record move_group /rosout per run (rosout_lines.txt); gen3 scenario unbuffered logging
a196a21 M1 fr3: MoveIt ground truth (fake hardware)
4b7e37d moveit_capture.py: joints of an SRDF chain group from the URDF path base -> tip
1aabd71 M1 cr5: MoveIt ground truth
d09e7f3 M1 lite6: MoveIt ground truth
115f94b M1 xarm6: MoveIt ground truth (attempt 2 with reset runs)
f18fac1 moveit_capture.py: out-of-limits goal plan only, return to the first named state before later failure cases, rclpy dump of /move_group parameters
c72bb5d M1 ur5e: MoveIt ground truth (5 successful runs, 5 failure runs with MoveItErrorCodes and log excerpts)
dcf6122 M1 tools: SRDF/URDF from move_group's latched topics if its parameters are empty; wait for move_group parameters
3339bbd P2c tb4 nav: run 1 goal1 ABORTED 105; EGL headless gives /scan all range_min, xvfb gives valid ranges at RTF 0.0049: SLAM/nav blocked
48e2607 frame_check.py: report labels use --base-frame
ba74188 P2c nav tools: run_nav_p2c.sh, frame_check.py --base-frame; tb4 goals.yaml picked on the warehouse map and checked
3e8c8f6 OVERNIGHT_ROBOTS: tb4 SLAM wording (23 drop lines, cause UNVERIFIED)
d0e6a8a P2c tb4 SLAM: two attempts; map saved on attempt 2 but only 0.55 x 1.10 m (slam_toolbox dropped scans)
8966c6d M1 tools: moveit_capture.py, run_moveit_m1.sh, moveit scenarios for the six arms
6da5276 run_mapping_item.sh: optional MAP_SAVE_TIMEOUT (map_saver_cli save_map_timeout)
0498a26 pick_goals.py (deterministic goal proposals on a robot's map); installed turtlebot4_navigation warehouse map copied with its source
b5ccc71 run_mapping_item.sh: DOMAIN, PARTITION, GOALS_YAML overridable (defaults unchanged)
6456dc7 P2c tb4: sensors snapshot (warehouse, headless)
e121e39 tb4_headless.launch.py: pass slam/localization/nav2 to turtlebot4_spawn; P2c scenarios for tb4
1c0732c P2c scout: sensors snapshot (no sensors on the model; maker has no SLAM/Nav2 for Scout)
5c6b97e robots_sudo.sh: cite the EXTERNALLY-MANAGED marker for the rowan note
b2ed1b6 crazyflie: NOT BUILT, the sim needs swig (apt) for the cffirmware bindings and rowan (pip); robots_sudo.sh section 4
7018318 scout: ROS2LAB-PORT of ugv_gazebo_sim (Gazebo Classic -> Harmonic), built and verified (/odom moves under TwistStamped)
abe3e53 gen3: OFFICIAL-JAZZY, built and verified in Gazebo Harmonic (joint_trajectory_controller active, motion proof)
1287daf fr3: OFFICIAL-JAZZY, libfranka 0.20.5 built by colcon, verified in Gazebo Harmonic (example controller moves the joints)
ef3a400 cr5: OFFICIAL-JAZZY (maker jazzy branch), built and verified in Gazebo Harmonic (group controller active, motion proof)
1654964 lite6: OFFICIAL-JAZZY, verified in Gazebo Harmonic (traj controller active, motion proof)
07422d2 xarm6: OFFICIAL-JAZZY, built (8 packages) and verified in Gazebo Harmonic (traj controller active, motion proof)
ff41703 tb4: OFFICIAL-JAZZY, verified headless (EGL) in Gazebo Harmonic: diffdrive active, topics, /odom moves under TwistStamped
b307219 ur5e: OFFICIAL-JAZZY, verified in Gazebo Harmonic (controllers active, topics, FollowJointTrajectory motion proof)
93535c4 Add arm_motion_proof.py and mobile_motion_proof.py (P2b rule 7c evidence)
799a910 P2B_PHASE_A: instructor ran the sudo steps; checked (apt sources, 10 packages, rosdep check); OVERNIGHT_ROBOTS.md started
```
