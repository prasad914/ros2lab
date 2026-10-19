# Codebase Architecture & Component Inventory

This document maps every robot model, route, simulation loop, renderer, RViz panel, and data pipeline in the ROS2Lab codebase as of October 2026.

---

## 1. Robot Models and Workspace Mapping

All robot workspaces are structured under `public/robots/ws/<ws>/` containing pinned GitHub sources, `workspace.json`, and pre-compiled asset bundles:

| Robot ID | Name & Description | Workspace Dir | Type / Kinematics | Sensors & Hardware |
|---|---|---|---|---|
| `tb3_burger` | ROBOTIS TurtleBot3 Burger | `public/robots/ws/turtlebot3/` | 2-Wheel Differential Drive | LDS-01/02 2D LiDAR (`/scan`), 6-axis IMU (`/imu`), Wheel Encoders (`/odom`) |
| `tb3_waffle` | ROBOTIS TurtleBot3 Waffle | `public/robots/ws/turtlebot3/` | 2-Wheel Differential Drive | LDS LiDAR (`/scan`), Intel RealSense D435 RGB-D (`/camera/*`), IMU (`/imu`), Odometry (`/odom`) |
| `scout` | AgileX Scout v2 / Mini | `public/robots/ws/scout/` | 4-Wheel Skid-Steer Mobile Base | Wheel Encoders (`/odom`), `/cmd_vel` |
| `crazyflie` | Bitcraze Crazyflie 2.1 | `public/robots/ws/crazyswarm2/` | Quadrotor Micro Aerial Vehicle | Z-Ranger, Flow-deck, IMU, Odometry |
| `ur5e` | Universal Robots UR5e | `public/robots/ws/ur/` | 6-DoF Industrial Manipulator | Joint position/velocity interfaces, MoveIt 2 configs |
| `fr3` | Franka Emika Research 3 (FR3) | `public/robots/ws/franka/` | 7-DoF Manipulator + Franka Hand | Torque/effort interfaces, MoveIt 2 configs |
| `gen3` | Kinova Kortex Gen3 | `public/robots/ws/kortex/` | 7-DoF Manipulator + 2F-85 Gripper | Joint state controllers, MoveIt 2 configs |
| `xarm6` | UFACTORY xArm6 | `public/robots/ws/xarm/` | 6-DoF Manipulator + Gripper | Joint state broadcaster, MoveIt 2 configs |
| `lite6` | UFACTORY Lite 6 | `public/robots/ws/xarm/` | 6-DoF Lightweight Arm | Joint state broadcaster, MoveIt 2 configs |
| `wx250s` | Trossen / Interbotix WidowX 250s | `public/robots/ws/interbotix/` | 6-DoF Arm with DYNAMIXEL Servos | Joint state broadcaster, MoveIt 2 configs |
| `cr5` | Dobot CR5 | `public/robots/ws/dobot/` | 6-DoF Collaborative Manipulator | V4 Controller, MoveIt 2 configs |

---

## 2. Pages and Routing

| Route | Implementation File | Key Line Numbers | Description |
|---|---|---|---|
| `/rviz.html` | `public/rviz.html` | 1 - 120 | Main simulator workbench container. |
| `/rviz.html?robot=<id>` | `public/js/rviz-page.js` | 1 - 402 | Dynamic robot workbench loader, sources ROS 2 Jazzy, loads robot description, runs colcon build and launch files. |
| Robot Catalog | `public/js/sim-catalog.js` | 1 - 260 | Visual catalog grid of all supported robot models with launch entrypoints. |
| `/playground.html` | `public/playground.html` | 1 - 150 | Educational interactive ROS 2 concepts playground. |
| `/index.html` | `public/index.html` | 1 - 200 | ROS2Lab course landing page. |

---

## 3. Simulation Loop & Process Scheduling

The browser simulation executes a clock and event-driven update loop:

```
[Window rAF / Timer]
         │
         ├──► ros-graph.js (simNow(), /clock generation) [lines 120-160]
         │
         ├──► ros-gz.js (GzSim::step(dt)) [lines 120-160]
         │         ├── gz-physics.js (Rapier3D physics & differential drive kinematics) [lines 80-140]
         │         └── gz-sim.js (Raycasting for LiDAR, Pinhole Camera, IMU) [lines 50-130]
         │
         ├──► ros_gz_bridge (GZ to ROS message translation) [ros-gz.js:400-470]
         │
         └──► nav2-sim.js (Nav2System::tick(dt)) [lines 40-120]
                   ├── costmap.update(t) [nav2-sim.js:180-280]
                   ├── amcl.tick(t) [nav2-sim.js:390-470]
                   ├── planner.tick() [nav2-sim.js:480-520]
                   ├── controller.tick(t, dt) [nav2-sim.js:520-600]
                   └── bt.tick(t) [nav2-sim.js:700-840]
```

### File & Line Inventory:
- **`public/js/ros-graph.js`**:
  - `simNow()` clock generator: lines 120–160
  - Topic pub/sub dispatcher: lines 320–360
  - Topic publication interceptor & `nav2Topic` bridge: lines 455–485
  - Service dispatcher: lines 530–575
  - Action client/server dispatcher: lines 660–710
  - Process startup (`ros2 run` / `ros2 launch`): lines 788–860
  - TF tree computation (`tfEdges`): lines 1420–1455
- **`public/js/ros-gz.js`**:
  - Main simulation stepping loop `step(dt)`: lines 120–160
  - Model and link entity hierarchy: lines 250–320
  - Sensor bridge publishers (LaserScan, Camera, IMU): lines 400–470
- **`public/js/gz-sdformat.js`**:
  - SDF 1.11 parser, link frames, and joint limits: lines 1–681
- **`public/js/gz-physics.js`**:
  - Rapier3D rigid body dynamics and kinematic drive updates: lines 1–371
- **`public/js/gz-sim.js`**:
  - Raycasted LiDAR scan generation: lines 40–90
  - Camera projection and canvas rasterization: lines 95–160
  - IMU linear acceleration & angular velocity calculation: lines 165–210
- **`public/js/nav2-sim.js`**:
  - `Nav2System` coordinator and lifecycle loop: lines 40–120
  - Costmap static, obstacle, and inflation layers: lines 180–390
  - `Amcl` particle filter & `map -> odom` transform broadcaster: lines 393–475
  - `PlannerServer` path planning on global costmap: lines 480–520
  - `ControllerServer` DWB trajectory evaluation & `/cmd_vel` output: lines 520–600
  - `BtNavigator` Behavior Tree execution & recoveries pipeline: lines 700–840
  - `LifecycleManager` state machine transitions: lines 880–937
  - `nav2Topic` entrypoint for `/initialpose` and `/goal_pose`: lines 969–990
  - `nav2Panel` backend for RViz2 Navigation 2 dock: lines 1098–1117
- **`public/js/nav2-core.js`**:
  - Math helpers (`compose`, `inverse`, `yawOfQ`, `qOfYaw`): lines 1–160
  - Costmap grid and inflation algorithm (`inflate`): lines 210–330
  - ParticleFilter implementation: lines 340–490
  - A* 2D path planner: lines 495–549
- **`public/js/slam-sim.js`**:
  - SLAM Toolbox and Cartographer simulation models: lines 1–189
- **`public/js/real-launch.js`**:
  - Web Worker Pyodide runtime executing real upstream ROS 2 Python/XML launch files: lines 1–614
- **`public/js/terminal-sim.js`**:
  - Interactive bash-like terminal, tab management, tool publication hook (`rvizPublished`): lines 1500–1515
  - RViz viewer integration and Nav2 panel bindings: lines 1530–1550

---

## 4. Renderers and 3D / 2D View Pipeline

The simulator renders via WebGL in Three.js:

- **Single Shared Scene Graph**:
  - `world` (`THREE.Group` in `public/js/rviz.js:370`): All objects (Grid, RobotModel URDF links, PointCloud2, LaserScan, TF axes, Costmap planes, Markers, Paths) live in a **single shared scene graph**.
- **Camera Controllers (Views)**:
  - `Orbit`: `THREE.PerspectiveCamera` orbiting around a focal point $(x, y, z)$.
  - `TopDownOrtho`: `THREE.OrthographicCamera` looking along $-Z$ onto the $XY$ ground plane.
  - `XYOrbit`: Perspective orbit constrained to $Z = 0$ ground plane.
  - `ThirdPersonFollower`: Perspective camera following robot `base_link` frame dynamically.
  - Switchable instantaneously via `setViewType("Orbit" | "TopDownOrtho")` and HUD overlay buttons (`rviz.js:290-360`).
  - **No duplicate simulation**: Switching camera views changes only the active camera projection and orbit controls, never duplicating or restarting simulation state.

---

## 5. RViz2 Panels and Interactive Tools

- **Main Component**: `public/js/rviz.js` (`createRviz()`):
  - **Displays Panel** (`rviz.js:195-205`, `1425-1490`): Property tree rendering with collapsible rows, checkboxes, and Fusion Qt editors.
  - **Views Panel** (`rviz.js:205-225`): Camera type selection (`Orbit`, `TopDownOrtho`, `XYOrbit`, `ThirdPersonFollower`).
  - **Time Panel** (`rviz.js:230-245`): Displays Wall Elapsed, ROS Time, ROS Elapsed.
  - **Tool Properties Panel** (`rviz.js:1400-1425`): Configuration for active tool topics.
  - **Navigation 2 Panel** (`rviz.js:1218-1243`): Provides Startup, Pause, Resume, Reset, Waypoint / Nav Through Poses mode, Start Waypoint Following, Cancel, and feedback telemetry (ETA, remaining distance, recoveries).
  - **SlamToolboxPlugin Panel** (`rviz.js:1212-1217`): Dock for Save Map, Serialize Map, Deserialize Map.
  - **MotionPlanning Panel** (`public/js/moveit-rviz.js`): MoveIt 2 interactive planning, planning group selection, OMPL/Pilz/CHOMP/STOMP pipelines.

- **Interactive RViz Tools**:
  - `rviz_default_plugins/Interact` (`rviz.js:64`): Default interactive manipulation tool.
  - `rviz_default_plugins/MoveCamera` (`rviz.js:64`): Camera panning and tumbling.
  - `rviz_default_plugins/Select` (`rviz.js:64`): Object picking and link inspection.
  - `rviz_default_plugins/FocusCamera` (`rviz.js:64`): Re-centers camera focal point on clicked 3D surface.
  - `rviz_default_plugins/Measure` (`rviz.js:64`): Two-point Euclidean distance ruler.
  - `rviz_default_plugins/SetInitialPose` (`rviz.js:64`, `1185-1192`): Publishes `geometry_msgs/msg/PoseWithCovarianceStamped` on `/initialpose`.
  - `rviz_default_plugins/SetGoal` (`rviz.js:64`, `1185-1192`): Publishes `geometry_msgs/msg/PoseStamped` on `/goal_pose`.
  - `rviz_default_plugins/PublishPoint` (`rviz.js:64`, `1247`): Publishes `geometry_msgs/msg/PointStamped` on `/clicked_point`.
  - `nav2_rviz_plugins/GoalTool` (`rviz.js:60-64`, `1196-1200`): Nav2 Goal tool that connects to Navigation 2 panel and `bt_navigator`.
