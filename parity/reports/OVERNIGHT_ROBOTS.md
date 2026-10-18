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
