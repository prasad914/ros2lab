# Robot Verification & Install Status

Reference: `parity/CLAUDE.md` and `parity/KICKOFF_PROMPT.md` P0 / P2b.  
Order of work: TurtleBot3 first (P3–P11), then other verified mobile robots.  
Arms wait for manipulation prompts (M-series).

Status definitions:
- **OFFICIAL-JAZZY**: from Jazzy apt packages or maker's official Jazzy branch; built and verified with motion proof in `parity/fixtures/<robot>/install_check/`.
- **ROS2LAB-PORT**: maker's older branch ported by us; built and verified; porting documented in `parity/robots/<robot>/PORTING.md`.
- **NOT BUILT / NOT VERIFIED**: work in progress; never tested for parity.
- **FAILED**: could not be made to work; exact blocking error recorded.

---

## Status Table

| Robot | Category | Source | Built | Verified | Status | Launch Command | Evidence |
|---|---|---|---|---|---|---|---|
| **tb3_burger** | mobile | apt: `ros-jazzy-turtlebot3-gazebo`, `ros-jazzy-turtlebot3-navigation2` | yes | yes | OFFICIAL-JAZZY | `ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | install_check/ 2026-10-17 (domain 41, sensors): `controllers.txt` (no controller_manager; installed model.sdf line 376: `gz::sim::systems::DiffDrive`), `topics.txt`, `motion_proof.txt` (/odom x moved under TwistStamped /cmd_vel) |
| **tb3_waffle** | mobile | apt: `ros-jazzy-turtlebot3-gazebo`, `ros-jazzy-turtlebot3-navigation2` | yes | yes | OFFICIAL-JAZZY | `TURTLEBOT3_MODEL=waffle ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | install_check/ 2026-10-17 (domain 41, sensors): `controllers.txt` (no controller_manager; installed model.sdf line 480: `gz::sim::systems::DiffDrive`), `topics.txt`, `motion_proof.txt` (/odom x moved under TwistStamped /cmd_vel) |
| **tb3_waffle_pi** | mobile | apt: `ros-jazzy-turtlebot3-gazebo`, `ros-jazzy-turtlebot3-navigation2` | yes | yes | OFFICIAL-JAZZY | `TURTLEBOT3_MODEL=waffle_pi ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | install_check/ 2026-10-17 (domain 41, sensors): `controllers.txt` (no controller_manager; installed model.sdf line 480: `gz::sim::systems::DiffDrive`), `topics.txt`, `motion_proof.txt` (/odom x moved under TwistStamped /cmd_vel) |
| **tb4** | mobile | apt: `ros-jazzy-turtlebot4-gz-bringup` 2.0.2-1noble.20261006.045255, `ros-jazzy-turtlebot4-navigation` | yes | yes | OFFICIAL-JAZZY | `ros2 launch parity/scripts/launch/tb4_headless.launch.py` (turtlebot4_gz.launch.py without the GUI client, EGL headless) | install_check/ 2026-10-18 (domain 46): `controllers.txt` (diffdrive_controller, joint_state_broadcaster active), `topics.txt`, `motion_proof.txt` (/odom x 0.0 -> 0.0426 m under TwistStamped /cmd_vel 0.2 m/s; real_time_factor about 0.2) |
| **ur5e** | arm | apt: `ros-jazzy-ur-simulation-gz` 2.5.0, `ros-jazzy-ur-moveit-config` | yes | yes | OFFICIAL-JAZZY | `ros2 launch ur_simulation_gz ur_sim_control.launch.py ur_type:=ur5e gazebo_gui:=false launch_rviz:=false` | install_check/ 2026-10-18 (domain 46): `controllers.txt` (scaled_joint_trajectory_controller, joint_state_broadcaster active), `topics.txt`, `motion_proof.txt` (shoulder_pan_joint 0.0 -> 0.3 rad, FollowJointTrajectory error_code 0) |
| **fr3** | arm | `https://github.com/frankaemika/franka_ros2` jazzy 4acc05c0 + franka_description 2.9.0 (7aeeddc4) + libfranka 0.20.5 (3cc708ca, built by colcon) | yes | yes | OFFICIAL-JAZZY | `ros2 launch franka_gazebo_bringup gazebo_franka_arm_example_controller.launch.py robot_type:=fr3 controller:=joint_position_example_controller gz_args:='-r -s empty.sdf' rviz:=false` | build: `parity/robots/fr3/build_summary.txt` (12 packages); install_check/ 2026-10-18 (domain 46): `controllers.txt` (joint_position_example_controller, joint_state_broadcaster active), `topics.txt`, `motion_proof.txt` (/joint_states: 7 joints moved ±0.0053 rad in 1.14 s sim under the maker's example controller) |
| **gen3** | arm | `https://github.com/Kinovarobotics/ros2_kortex` jazzy 462dab9a + `https://github.com/PickNikRobotics/ros2_robotiq_gripper` main a74d007d | yes | yes | OFFICIAL-JAZZY | `xvfb-run -a ros2 launch kortex_bringup kortex_sim_control.launch.py sim_gazebo:=true use_sim_time:=true launch_rviz:=false` | build: `parity/robots/gen3/build_summary.txt` (6 packages); install_check/ 2026-10-18 (domain 46): `controllers.txt` (joint_trajectory_controller, joint_state_broadcaster active; gripper, twist, velocity controllers inactive as launched), `topics.txt`, `motion_proof.txt` (joint_1 0.0 -> 0.3 rad, error_code 0) |
| **xarm6** | arm | `https://github.com/xArm-Developer/xarm_ros2` jazzy 3dc2b5e8 (submodule xarm_sdk/cxx v1.18.1 d84a2b7d) | yes | yes | OFFICIAL-JAZZY | `xvfb-run -a ros2 launch xarm_gazebo xarm6_beside_table_gazebo.launch.py load_controller:=true` | build: `parity/robots/xarm6/build_summary.txt` ("8 packages finished"); install_check/ 2026-10-18 (domain 46): `controllers.txt` (xarm6_traj_controller, joint_state_broadcaster active), `topics.txt`, `motion_proof.txt` (joint1 0.0 -> 0.299897 rad, error_code 0) |
| **lite6** | arm | `https://github.com/xArm-Developer/xarm_ros2` jazzy 3dc2b5e8 (same build as xarm6) | yes | yes | OFFICIAL-JAZZY | `xvfb-run -a ros2 launch xarm_gazebo lite6_beside_table_gazebo.launch.py load_controller:=true` | build: `parity/robots/xarm6/build_summary.txt`; install_check/ 2026-10-18 (domain 46): `controllers.txt` (lite6_traj_controller, joint_state_broadcaster active), `topics.txt`, `motion_proof.txt` (joint1 0.0 -> 0.299897 rad, error_code 0) |
| **cr5** | arm | `https://github.com/Dobot-Arm/DOBOT_6Axis_ROS2_V4` jazzy 89d47c66 | yes | yes | OFFICIAL-JAZZY | `DOBOT_TYPE=cr5 ros2 launch dobot_gazebo dobot_gazebo.launch.py gui:=false` | build: `parity/robots/cr5/build_summary.txt` (6 packages; dobot_gazebo rebuilt without --symlink-install); install_check/ 2026-10-18 (domain 46): `controllers.txt` (cr5_group_controller, joint_state_broadcaster active), `topics.txt`, `motion_proof.txt` (joint1 0.0 -> 0.3 rad, error_code 0) |
| **magician** | arm | Dobot Magician | no | no | NOT BUILT | - | - |
| **so101** | arm | The Robot Studio / SO-ARM100 | no | no | NOT BUILT | - | - |
| **wx250s** | arm | `https://github.com/Interbotix/interbotix_ros_manipulators` jazzy 01c557d6 + `interbotix_ros_toolboxes` jazzy 27f7628e + `interbotix_ros_core` jazzy 41ca7357, ported on jazzy-ros2lab (manipulators 86951bf, toolboxes 039e288; `parity/robots/wx250s/PORTING.md`) | yes | yes | ROS2LAB-PORT | Gazebo Harmonic (port): `ros2 launch interbotix_xsarm_sim xsarm_gz_harmonic.launch.py robot_model:=wx250s use_rviz:=false`; fake hardware: `ros2 launch interbotix_xsarm_ros_control xsarm_ros_control.launch.py robot_model:=wx250s hardware_type:=fake use_rviz:=false` | build: `parity/robots/wx250s/build_summary.txt` (13 packages); install_check/ 2026-10-18 (domain 46, fake hardware): `controllers.txt` (`-c /wx250s/controller_manager`: arm_controller, gripper_controller, joint_state_broadcaster active), `topics.txt`, `motion_proof.txt` (waist 0.0 -> 0.3 rad, error_code 0); Gazebo Harmonic: `parity/fixtures/wx250s/gz/install_check/` (3 controllers active, waist -0.003343 -> 0.293883 rad, error_code 0); M1 MoveIt on fake hardware | |
| **irb120** | arm | ABB IRB 120 | no | no | NOT BUILT | - | - |
| **kr6** | arm | KUKA KR 6 | no | no | NOT BUILT | - | - |
| **lrmate** | arm | FANUC LR Mate 200iD | no | no | NOT BUILT | - | - |
| **scout** | mobile | `https://github.com/agilexrobotics/ugv_gazebo_sim` humble 9d7888af ported on jazzy-ros2lab d5068ecc (`parity/robots/scout/PORTING.md`); driver repo scout_ros2 origin/jazzy 48f70cbe not used (hardware only) | yes | yes | ROS2LAB-PORT | `ros2 launch scout_gazebo_sim scout_v2_gz.launch.py` | build: `parity/robots/scout/build_summary.txt` (2 packages); install_check/ 2026-10-18 (domain 46): `controllers.txt` (no controller_manager; scout_v2.gazebo line 132 `gz-sim-diff-drive-system`), `topics.txt`, `motion_proof.txt` (/odom x 0.0 -> 0.5488 m under TwistStamped /cmd_vel, Gazebo pose x 0.5518) |
| **go2** | mobile | Unitree Go2 | no | no | NOT BUILT | - | - |
| **g1** | mobile | Unitree G1 | no | no | NOT BUILT | - | - |
| **h1** | mobile | Unitree H1 | no | no | NOT BUILT | - | - |
| **spot** | mobile | Boston Dynamics Spot | no | no | NOT BUILT | - | - |
| **crazyflie** | mobile | `https://github.com/IMRCLab/crazyswarm2` main f1e09954 | no | no | NOT BUILT | (would be `ros2 launch crazyflie launch.py backend:=sim`) | needs parity/scripts/robots_sudo.sh: swig (apt, for the cffirmware Python bindings of crazyflie-firmware 2025.02 that crazyflie_sim imports) and rowan (pip only) |
| **arm3** | arm | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **arm6** | arm | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **chiku** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **chiku_mesh** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **quadcopter** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **quadruped** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **hexapod** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **humanoid** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **mobile_manipulator** | mobile/arm | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **legged_manipulator** | mobile/arm | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **ackermann** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
| **mecanum** | mobile | ROS2Lab course robot | no | no | NOT BUILT | - | - |
