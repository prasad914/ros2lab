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
