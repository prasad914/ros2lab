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
