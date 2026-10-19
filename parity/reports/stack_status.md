# Stack Status Report (Prompt P6) – TurtleBot3 Models

Date: 2026-10-16
Robots: `tb3_burger`, `tb3_waffle`, `tb3_waffle_pi`
Reference: ROS 2 Jazzy installed on Ubuntu 24.04

## Tool and Component Status (Spec S11)

| Tool / Component | Status | Notes / Evidence |
|---|---|---|
| `robot_state_publisher` / URDF | **VERIFIED** | Loaded from official URDF/xacro, TF tree published correctly |
| `joint_state_publisher` | **VERIFIED** | Joint states published and rendered |
| Virtual `ros_gz` bridge table | **VERIFIED** | Matches bridge YAML configuration |
| Teleop (`TwistStamped` / `/cmd_vel`) | **VERIFIED** | Drives robot, updates odometry and sensors |
| `robot_localization` EKF | **PENDING** | Not part of default TB3 bringup (uses AMCL + odom) |
| SLAM Toolbox (async/sync/localization/lifelong, `save_map`, serialize/deserialize) | **VERIFIED** | SLAM mapping and map saving verified against fixtures |
| Cartographer | **VERIFIED** | Captured and compared against fixture |
| `map_server` + `map_saver` | **VERIFIED** | YAML/PGM map loading and saving verified |
| AMCL (Web Worker) | **VERIFIED** | Particle cloud updates, reinitialisation, lifecycle |
| Global and local costmaps (static, obstacle, voxel, inflation, keepout/speed filters) | **VERIFIED** | Costmap grids generated per nav2_params.json |
| Planner / Controller / Smoother / Behavior servers | **VERIFIED** | NavFn, Smac2D, MPPI, DWB, RPP verified across trial matrix |
| `bt_navigator` (Nav2 BT XML with recoveries) | **VERIFIED** | Behavior tree navigation and recovery execution verified |
| Waypoint Follower (+ wait/input at waypoint) | **VERIFIED** | Waypoint sequence execution and feedback verified |
| `velocity_smoother` → `collision_monitor` chain | **VERIFIED** | Velocity command processing and safety checks active |
| Docking | **PENDING** | Not installed for TurtleBot3 package set |
| Route Server | **PENDING** | Feature flag OFF (not required for TB3) |
| Lifecycle Manager | **VERIFIED** | Node lifecycle state transitions (configure/activate) verified |
| Simple Commander shim (Python BasicNavigator) | **VERIFIED** | In-browser Python environment executes navigation API |
| `view_frames` | **VERIFIED** | TF frame tree export and visualization |
| `rqt_graph` / `rqt_tf_tree` / `rqt_image_view` panels | **VERIFIED** | Panels render ROS graph, TF tree, and image streams |
| `rosbag2` MCAP record / replay | **VERIFIED** | MCAP recording and replay of topics and TF |

## RViz Displays & Panels (Spec S10)
- **Displays**: Global Status, Axes, Grid, TF, LaserScan, Map, Path, RobotModel, Odometry, Image, PointCloud2 (Waffle/Waffle Pi).
- **Panels**: Navigation 2, SlamToolboxPlugin, Views, Tool Properties, Selection, Time.
- **Default Config**: Loaded from installed `nav2_default_view.rviz` and TB3 rviz configs.
