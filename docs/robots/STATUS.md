# Robots Implementation & Porting Status (ROS 2 Jazzy)

| Robot | Category | Status | Source | Launch Command | Evidence / Notes |
|---|---|---|---|---|---|
| **TurtleBot4 (`tb4`)** | Mobile (Nav2/SLAM) | **OFFICIAL-JAZZY** | `ros-jazzy-turtlebot4-*` apt packages | `ros2 launch turtlebot4_gz_bringup turtlebot4_gz.launch.py slam:=true nav2:=true` | Captured in `tests/fixtures/tb4/tb4_slam_nav/` (topics, TF, control, odom) |
| **UR5e (`ur5e`)** | Manipulator (MoveIt 2) | **OFFICIAL-JAZZY** | `ros-jazzy-ur-*` apt packages | `ros2 launch ur_simulation_gz ur_sim_moveit.launch.py` | Official apt packages (`ur_simulation_gz`, `ur_moveit_config`) |
| **Franka FR3 (`fr3`)** | Manipulator (MoveIt 2) | **ROS2LAB-PORT** | [frankaemika/franka_ros2](https://github.com/frankaemika/franka_ros2) (`jazzy` branch, commit `4acc05c`) | `ros2 launch franka_bringup franka.launch.py robot_ip:=sim` | Upstream `jazzy` branch verified; workspace build pending approval |
| **xArm Lite 6 (`lite6`)** | Manipulator (MoveIt 2) | **OFFICIAL-JAZZY** | [xArm-Developer/xarm_ros2](https://github.com/xArm-Developer/xarm_ros2) (`jazzy` branch) | `ros2 launch lite6_moveit_config lite6_moveit_fake.launch.py` | Upstream `jazzy` branch; workspace build pending approval |
| **Interbotix WX250s (`wx250s`)** | Manipulator (MoveIt 2) | **OFFICIAL-JAZZY** | [Interbotix/interbotix_ros_manipulators](https://github.com/Interbotix/interbotix_ros_manipulators) (`jazzy` branch) | `ros2 launch interbotix_xs_moveit xs_moveit.launch.py robot_model:=wx250s` | Upstream `jazzy` branch; workspace build pending approval |
| **AgileX Scout (`scout`)** | Mobile (Nav2/SLAM) | **ROS2LAB-PORT** | [agilexrobotics/scout_ros2](https://github.com/agilexrobotics/scout_ros2) (`humble` branch, commit `bf0110f`) | `ros2 launch scout_base base.launch.py` | Ported from Humble branch; workspace build pending approval |
| **Dobot CR5 (`cr5`)** | Manipulator (MoveIt 2) | **ROS2LAB-PORT (approximate model)** | Local repository files (`public/robots/dobot_description`) | `ros2 launch dobot_description view_robot.launch.py` | Integrated locally; approximate model |
