# ROS2Lab Repository & Parity Site Map (P0)

Generated on 2026-10-15.

## 1. Robots Offered by the Site
- `tb3_burger` (TurtleBot3 Burger - mobile robot with LDS lidar, IMU, diff drive)
- `tb3_waffle` / `tb3_waffle_pi` (TurtleBot3 Waffle / Waffle Pi - mobile robot with LDS lidar, IMU, RGB camera, diff drive)
- Arms: UR5e, Franka FR3, Kinova Gen3, UFACTORY xArm6 / Lite 6, Interbotix WX250s, Dobot CR5, ABB IRB120, etc.
- Other mobile robots & quadcopters / quadrupeds (Scout, Crazyflie, etc.)

## 2. Course Levels & Pages
- Course entry point: `public/course.html`, `public/lesson.html`, `public/rviz.html`, `public/project.html`, `public/playground.html`.
- Left-rail stepper / lesson structure in `public/js/lesson.js`, `public/js/rviz-page.js`, `public/js/course.js`.

## 3. RViz Displays, Tools, Panels & Displays Implemented
- **Displays**: Grid, RobotModel, TF, LaserScan, PointCloud2, Image, Camera, Map, Path, Pose, PoseArray, Marker, Odometry, etc. (implemented in `public/js/rviz.js`, `public/js/rviz-sim.js`, `public/js/rviz-data.js`).
- **Tools**: 2D Pose Estimate, 2D Goal Pose, Nav2 Goal, Publish Point, Interact, Move Camera, Select, Measure (`public/js/rviz.js`).
- **Panels**: Navigation 2 panel, SlamToolboxPlugin panel, MotionPlanning panel (`moveit-rviz.js`).

## 4. Architecture & Data Flow (Spec S1)
- **3D Views**: Gazebo-like 3D view (`gz-sim.js`, `gz-window.js`) and RViz 3D/2D views (`rviz.js`) render from shared ROS graph / topic / TF state (`ros-graph.js`, `ros-iface.js`).
- **TF Registry**: `public/js/tf-buffer.js` (static + dynamic buffers, transform lookups).
- **Pub/Sub Bus**: `public/js/ros-graph.js` (topics, types, QoS).
- **Fixed Frame dropdown**: Located in RViz global options (`rviz.js` / `rviz-page.js`), currently a dropdown or combobox.

## 5. Robot Package Verification & Reference Launch (Spec S13)
| Robot | Real Jazzy Packages Installed (`ros2 pkg list`) | Reference Launch (S13) | Status |
|---|---|---|---|
| `tb3_burger` | `turtlebot3_gazebo`, `turtlebot3_navigation2`, `slam_toolbox`, `nav2_bringup`, etc. | `turtlebot3_gazebo turtlebot3_world.launch.py` / `nav2_bringup tb3_simulation_launch.py` | VERIFIED |
| `tb3_waffle` | Installed | `turtlebot3_gazebo` / `nav2_bringup` | VERIFIED |
| `tb3_waffle_pi` | Installed | `turtlebot3_gazebo` / `nav2_bringup` | VERIFIED |
| Other robots | Partial or unverified | Various | UNVERIFIED |

## 6. Gap List vs Spec S1–S12 & Missing Test Hooks
- **Test Hooks**: `window.__ros2lab` needs complete coverage for all required runtime queries (topic lists with QoS, TF frames and authority, Fixed Frame options/value, parameters per emulated node, lifecycle states, Global Status, robot pose history, costmap grids, camera info/encoding, course level lock state).
- **Gaps**: Exact parity on Fixed Frame free-text combobox edge cases, full AMCL worker parity, and specific depth/pointcloud conversions.
