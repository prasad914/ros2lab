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
| **tb3_burger** | mobile | apt: `ros-jazzy-turtlebot3-gazebo`, `ros-jazzy-turtlebot3-navigation2` | yes | no | NOT VERIFIED | `ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | none captured yet (install_check/ evidence removed) |
| **tb3_waffle** | mobile | apt: `ros-jazzy-turtlebot3-gazebo`, `ros-jazzy-turtlebot3-navigation2` | yes | no | NOT VERIFIED | `TURTLEBOT3_MODEL=waffle ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | none captured yet (install_check/ evidence removed) |
| **tb3_waffle_pi** | mobile | apt: `ros-jazzy-turtlebot3-gazebo`, `ros-jazzy-turtlebot3-navigation2` | yes | no | NOT VERIFIED | `TURTLEBOT3_MODEL=waffle_pi ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | none captured yet (install_check/ evidence removed) |
| **tb4** | mobile | apt: `ros-jazzy-turtlebot4-gz-bringup`, `ros-jazzy-turtlebot4-navigation` | yes | no | NOT VERIFIED | `ros2 launch turtlebot4_gz_bringup turtlebot4_gz.launch.py` | pending P2b/P2c |
| **ur5e** | arm | apt: `ros-jazzy-ur-simulation-gz`, `ros-jazzy-ur-moveit-config` | yes | no | NOT VERIFIED | `ros2 launch ur_simulation_gz ur_sim_control.launch.py ur_type:=ur5e` | pending P2b |
| **fr3** | arm | `https://github.com/frankaemika/franka_ros2` | no | no | NOT BUILT | - | - |
| **gen3** | arm | `https://github.com/Kinovarobotics/ros2_kortex` | no | no | NOT BUILT | - | - |
| **xarm6** | arm | `https://github.com/xArm-Developer/xarm_ros2` | no | no | NOT BUILT | - | - |
| **lite6** | arm | `https://github.com/xArm-Developer/xarm_ros2` | no | no | NOT BUILT | - | - |
| **cr5** | arm | `https://github.com/Dobot-Arm/DOBOT_6Axis_ROS2` | no | no | NOT BUILT | - | - |
| **magician** | arm | Dobot Magician | no | no | NOT BUILT | - | - |
| **so101** | arm | The Robot Studio / SO-ARM100 | no | no | NOT BUILT | - | - |
| **wx250s** | arm | `https://github.com/Interbotix/interbotix_ros_manipulators` | no | no | NOT BUILT | - | - |
| **irb120** | arm | ABB IRB 120 | no | no | NOT BUILT | - | - |
| **kr6** | arm | KUKA KR 6 | no | no | NOT BUILT | - | - |
| **lrmate** | arm | FANUC LR Mate 200iD | no | no | NOT BUILT | - | - |
| **scout** | mobile | `https://github.com/agilexrobotics/scout_ros2` | no | no | NOT BUILT | - | - |
| **go2** | mobile | Unitree Go2 | no | no | NOT BUILT | - | - |
| **g1** | mobile | Unitree G1 | no | no | NOT BUILT | - | - |
| **h1** | mobile | Unitree H1 | no | no | NOT BUILT | - | - |
| **spot** | mobile | Boston Dynamics Spot | no | no | NOT BUILT | - | - |
| **crazyflie** | mobile | Bitcraze Crazyflie | no | no | NOT BUILT | - | - |
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
