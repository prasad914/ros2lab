# Third-party software and data in ROS2Lab

ROS2Lab ships, or shows inside the course workspace, the following work by others. Each keeps its own licence; the
licence texts are next to the files (`LICENSE` in each folder) and are shown in the workspace with the package.

## Libraries served to the browser

| What | Where | Licence |
|---|---|---|
| three.js r180 (renderer, OrbitControls, Collada / OBJ / STL / TGA loaders, RoomEnvironment) | `public/vendor/three/` | MIT |
| Rapier physics 0.19 (`@dimforge/rapier3d-compat`, WebAssembly inlined) | `public/vendor/rapier/` | Apache-2.0 (`public/vendor/rapier/LICENSE`) |
| CodeMirror 6 | `public/vendor/codemirror/` | MIT |

## ROS 2 interface definitions (`public/robots/ros-ifaces.json`)

The `.msg`, `.srv` and `.action` text of these ROS 2 Jazzy packages, built by `tools/build-ifaces.py` (only the
interface packages, not their code):

| Repository | Licence of the interface packages |
|---|---|
| ros2/common_interfaces, ros2/rcl_interfaces, ros2/example_interfaces, ros2/rosbag2 (rosbag2_interfaces) | Apache-2.0 |
| ros2/unique_identifier_msgs, ros2/geometry2 (tf2_msgs), ros/ros_tutorials (turtlesim) | BSD-3-Clause / Apache-2.0 |
| ros-controls/control_msgs, ros-controls/ros2_control (controller_manager_msgs) | BSD-3-Clause / Apache-2.0 |
| moveit/moveit_msgs, wg-perception/object_recognition_msgs, OctoMap/octomap_msgs, ros-planning/navigation_msgs (map_msgs), ros-geographic-info/geographic_info | BSD-3-Clause |
| ros-navigation/navigation2 (nav2_msgs), ros-perception/vision_msgs, ros-tooling/topic_tools | Apache-2.0 |
| IMRCLab/crazyswarm2 (crazyflie_interfaces) | MIT |

## Robot descriptions (`public/robots/*`)

URDF / xacro and meshes from the makers' or the community's repositories, with their licence files:

| Robot(s) | Source | Licence |
|---|---|---|
| UR5e | UniversalRobots/Universal_Robots_ROS2_Description | BSD-3-Clause |
| Franka FR3 | frankarobotics/franka_description | Apache-2.0 |
| Kinova Gen3 | Kinovarobotics/ros2_kortex | BSD-3-Clause |
| xArm6, Lite 6 | xArm-Developer/xarm_ros2 | BSD-3-Clause |
| Dobot CR5 | Dobot-Arm/DOBOT_6Axis_ROS2_V4 | MIT |
| Dobot Magician | jkaniuka/magician_ros2 | MIT |
| SO-101 | TheRobotStudio/SO-ARM100 | Apache-2.0 |
| WidowX 250 s | Interbotix/interbotix_ros_manipulators | BSD-3-Clause |
| ABB IRB 120 | ros-industrial/abb | Apache-2.0 |
| KUKA KR 6 | ros-industrial/kuka_experimental | Apache-2.0 |
| FANUC LR Mate 200iD | ros-industrial/fanuc | BSD-3-Clause |
| TurtleBot3 Burger / Waffle | ROBOTIS-GIT/turtlebot3 | Apache-2.0 |
| AgileX Scout | agilexrobotics/scout_ros2 | Apache-2.0 |
| Unitree Go2, G1, H1 | unitreerobotics/unitree_ros | BSD-3-Clause |
| Boston Dynamics Spot | bdaiinstitute/spot_description | MIT |
| Crazyflie | IMRCLab/crazyswarm2 | MIT |

The course's own robots (arm3, arm6, chiku, mecanum, ackermann, quadruped, hexapod, humanoid, quadcopter, mobile and
legged manipulators) and everything under `hardware/` are ROS2Lab's own work.

## Not shipped

The makers' robot drivers (`hardware/vendor.repos`, `hardware/humble.repos`) are only *listed*: students and staff
install them from the makers' repositories or apt, under the makers' licences.

## Robot workspaces for ROS 2 Jazzy (`public/robots/ws/*`, V23)

The makers' official ROS 2 Jazzy repositories, copied unmodified from the pinned commits below by
`tools/fetch-workspaces.mjs` (packages incl. their driver sources; only the meshes the shown robots and worlds use).
Every repository's `LICENSE` (and `NOTICE`) file is shipped in `public/robots/ws/<workspace>/src/<repository>/`.

| Workspace | Repository | Branch | Commit | Licence |
|---|---|---|---|---|
| crazyswarm2 | IMRCLab/crazyswarm2 | main | f1e09954f56c | MIT |
| dobot | Dobot-Arm/DOBOT_6Axis_ROS2_V4 | jazzy | 1b493da8d319 | MIT |
| franka | frankarobotics/franka_description | jazzy | 72baf5bf4e88 | Apache-2.0 |
| franka | frankarobotics/franka_ros2 | jazzy | 4acc05c01ebf | Apache-2.0 |
| interbotix | Interbotix/interbotix_ros_manipulators | jazzy | 01c557d65f78 | BSD-3-Clause |
| interbotix | Interbotix/interbotix_ros_core | jazzy | 41ca7357935b | BSD-3-Clause |
| interbotix | Interbotix/interbotix_ros_toolboxes | jazzy | 27f7628eb411 | BSD-3-Clause |
| kortex | Kinovarobotics/ros2_kortex | jazzy | 462dab9aa473 | BSD-3-Clause |
| kortex | PickNikRobotics/ros2_robotiq_gripper | main | a74d007d8f2f | BSD-3-Clause |
| scout | agilexrobotics/scout_ros2 | origin/jazzy | 48f70cbefa74 | Apache-2.0 (LICENSE file; package.xml says BSD) |
| turtlebot3 | ROBOTIS-GIT/turtlebot3 | jazzy | 0c0be84e3f5c | Apache-2.0 |
| turtlebot3 | ROBOTIS-GIT/turtlebot3_msgs | jazzy | 9209e01b4708 | Apache-2.0 |
| turtlebot3 | ROBOTIS-GIT/turtlebot3_simulations | jazzy | 45633014a14e | Apache-2.0 |
| turtlebot3 | ROBOTIS-GIT/DynamixelSDK | jazzy | 516ae8632c59 | Apache-2.0 |
| turtlebot3 | ROBOTIS-GIT/hls_lfcd_lds_driver | jazzy | 6a80b3f1535d | BSD-3-Clause |
| turtlebot3 | ROBOTIS-GIT/ld08_driver | jazzy | 00dba810a0fe | Apache-2.0 |
| turtlebot3 | ROBOTIS-GIT/coin_d4_driver | jazzy | 79d183324729 | Apache-2.0 |
| ur | UniversalRobots/Universal_Robots_ROS2_Description | jazzy | 6b639c2efd9f | BSD-3-Clause (ur15/ur18/ur20/ur30/ur8long meshes: UR Terms and Conditions for Use of Graphical Documentation) |
| ur | UniversalRobots/Universal_Robots_ROS2_GZ_Simulation | jazzy | 3600c68c5fd6 | BSD-3-Clause |
| ur | UniversalRobots/Universal_Robots_ROS2_Driver | jazzy | f6997bd4a0ee | BSD-3-Clause |
| xarm | xArm-Developer/xarm_ros2 | jazzy | 3dc2b5e82947 | BSD-3-Clause |

## ROS 2 Jazzy installed files (`public/ros/jazzy/share.zip`, V23)

Real `share/` files (launch, config, params, maps, rviz, urdf, worlds) and Python launch helpers of these released
ROS 2 Jazzy packages, taken from their release tags (ros/rosdistro jazzy, commit b152c7a53e33) by
`tools/build-ros-share.mjs`; `public/ros/jazzy/SOURCES.json` lists the repository, tag and commit of every package.

| Package | Release repository and tag | Licence |
|---|---|---|
| cartographer_ros | ros2-gbp/cartographer_ros-release `release/jazzy/cartographer_ros/2.0.9003-2` | Apache 2.0 |
| controller_manager | ros2-gbp/ros2_control-release `release/jazzy/controller_manager/4.49.0-1` | Apache License 2.0 |
| joint_state_publisher | ros2-gbp/joint_state_publisher-release `release/jazzy/joint_state_publisher/2.4.3-1` | BSD |
| joint_state_publisher_gui | ros2-gbp/joint_state_publisher-release `release/jazzy/joint_state_publisher_gui/2.4.3-1` | BSD |
| launch | ros2-gbp/launch-release `release/jazzy/launch/3.4.12-1` | Apache License 2.0 |
| launch_param_builder | ros2-gbp/launch_param_builder-release `release/jazzy/launch_param_builder/0.1.1-4` | BSD |
| launch_testing | ros2-gbp/launch-release `release/jazzy/launch_testing/3.4.12-1` | Apache License 2.0 |
| launch_testing_ros | ros2-gbp/launch_ros-release `release/jazzy/launch_testing_ros/0.26.13-1` | Apache License 2.0 |
| moveit_configs_utils | ros2-gbp/moveit2-release `release/jazzy/moveit_configs_utils/2.12.4-1` | BSD-3-Clause |
| nav2_bringup | SteveMacenski/navigation2-release `release/jazzy/nav2_bringup/1.3.13-1` | Apache-2.0 |
| nav2_bt_navigator | SteveMacenski/navigation2-release `release/jazzy/nav2_bt_navigator/1.3.13-1` | Apache-2.0 |
| nav2_common | SteveMacenski/navigation2-release `release/jazzy/nav2_common/1.3.13-1` | Apache-2.0 |
| nav2_loopback_sim | SteveMacenski/navigation2-release `release/jazzy/nav2_loopback_sim/1.3.13-1` | Apache-2.0 |
| nav2_minimal_tb3_sim | ros2-gbp/nav2_minimal_turtlebot_simulation-release `release/jazzy/nav2_minimal_tb3_sim/1.0.1-1` | Apache 2.0 |
| nav2_minimal_tb4_description | ros2-gbp/nav2_minimal_turtlebot_simulation-release `release/jazzy/nav2_minimal_tb4_description/1.0.1-1` | Apache 2.0 |
| nav2_minimal_tb4_sim | ros2-gbp/nav2_minimal_turtlebot_simulation-release `release/jazzy/nav2_minimal_tb4_sim/1.0.1-1` | Apache 2.0 |
| nav2_simple_commander | SteveMacenski/navigation2-release `release/jazzy/nav2_simple_commander/1.3.13-1` | Apache-2.0 |
| python_qt_binding | ros2-gbp/python_qt_binding-release `release/jazzy/python_qt_binding/2.2.2-1` | BSD |
| realsense2_camera | ros2-gbp/realsense-ros-release `release/jazzy/realsense2_camera/4.58.4-1` | Apache License 2.0 |
| realsense2_description | ros2-gbp/realsense-ros-release `release/jazzy/realsense2_description/4.58.4-1` | Apache License 2.0 |
| robot_state_publisher | ros2-gbp/robot_state_publisher-release `release/jazzy/robot_state_publisher/3.3.4-1` | BSD |
| ros2node | ros2-gbp/ros2cli-release `release/jazzy/ros2node/0.32.13-1` | Apache License 2.0 |
| ros2param | ros2-gbp/ros2cli-release `release/jazzy/ros2param/0.32.13-1` | Apache License 2.0 |
| ros_gz_bridge | ros2-gbp/ros_ign-release `release/jazzy/ros_gz_bridge/1.0.24-1` | Apache 2.0 |
| ros_gz_sim | ros2-gbp/ros_ign-release `release/jazzy/ros_gz_sim/1.0.24-1` | Apache 2.0 |
| rosidl_parser | ros2-gbp/rosidl-release `release/jazzy/rosidl_parser/4.6.9-1` | Apache License 2.0 |
| rosidl_pycommon | ros2-gbp/rosidl-release `release/jazzy/rosidl_pycommon/4.6.9-1` | Apache License 2.0 |
| rpyutils | ros2-gbp/rpyutils-release `release/jazzy/rpyutils/0.4.2-1` | Apache License 2.0 |
| rviz2 | ros2-gbp/rviz-release `release/jazzy/rviz2/14.1.24-1` | BSD |
| rviz_common | ros2-gbp/rviz-release `release/jazzy/rviz_common/14.1.24-1` | BSD |
| sick_safetyscanners2 | ros2-gbp/sick_safetyscanners2-release `release/jazzy/sick_safetyscanners2/1.0.5-1` | ALv2 |
| slam_toolbox | SteveMacenski/slam_toolbox-release `release/jazzy/slam_toolbox/2.8.5-1` | LGPL |
| srdfdom | ros2-gbp/srdfdom-release `release/jazzy/srdfdom/2.0.7-1` | BSD |
| tf2_py | ros2-gbp/geometry2-release `release/jazzy/tf2_py/0.36.23-1` | BSD |
| tf2_ros_py | ros2-gbp/geometry2-release `release/jazzy/tf2_ros_py/0.36.23-1` | BSD |
| tf_transformations | ros2-gbp/tf_transformations_release `release/jazzy/tf_transformations/1.1.1-1` | BSD |
| ur_client_library | ros2-gbp/Universal_Robots_Client_Library-release `release/jazzy/ur_client_library/2.15.2-1` | Apache-2.0, BSD-2-Clause, Zlib, MIT, MIT |
| urdfdom_py | ros2-gbp/urdfdom_py-release `release/jazzy/urdfdom_py/1.2.1-3` | BSD |
| zed_description | ros2-gbp/zed-ros2-description-release `release/jazzy/zed_description/0.2.0-1` | Apache License 2.0 |

`public/ros/jazzy/index.json` only lists package and program names of the other packages (no code is shipped).
