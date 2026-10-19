# ROS2Lab Repository & Parity Site Map (P0 Report)

Date: 2026-10-15  
Reference Environment: Ubuntu 24.04 LTS · ROS 2 Jazzy (`/opt/ros/jazzy`) · Gazebo Harmonic 8.11.0  
Evaluation Target: ROS2Lab Browser Emulation Stack (`public/`)

---

## 1. Robots Offered by the Site

The site catalogs 34 distinct robot configurations defined in `public/robots/index.json` and companion configuration descriptors (`public/robots/*.json`):

### A. Mobile Robots
1. **tb3_burger**: TurtleBot3 Burger (ROBOTIS diff-drive mobile base; Lidar `hls_lfcd_lds`, IMU `tb3_imu`, no camera) [`public/robots/tb3_burger.json`].
2. **tb3_waffle**: TurtleBot3 Waffle (ROBOTIS diff-drive; Lidar, IMU, Intel RealSense RGB camera) [`public/robots/tb3_waffle.json`].
3. **tb3_waffle_pi**: TurtleBot3 Waffle Pi (ROBOTIS diff-drive; Lidar, IMU, Raspberry Pi Camera v2) [`public/robots/tb3_waffle_pi.json`].
4. **tb4**: TurtleBot4 (Clearpath Robotics diff-drive on iRobot Create 3 base; OAK-D RGB-D, 2D Lidar) [`public/robots/tb4.json`].
5. **scout**: AgileX Scout 2.0 (4WD skid-steer mobile base) [`public/robots/scout/`].
6. **chiku**: ROS2Lab educational differential-drive mobile robot [`public/robots/chiku/`].
7. **chiku_mesh**: Visual mesh variant of Chiku [`public/robots/chiku_description/`].
8. **ackermann**: Educational Ackermann steering car [`public/robots/ackermann/`].
9. **mecanum**: Educational 4-wheel omnidirectional mecanum drive robot [`public/robots/mecanum/`].

### B. Robot Arms / Manipulators
10. **ur5e**: Universal Robots UR5e 6-DOF industrial manipulator [`public/robots/ur_description/`].
11. **fr3**: Franka Robotics FR3 7-DOF research manipulator [`public/robots/franka_description/`].
12. **gen3**: Kinova Gen3 7-DOF manipulator with Robotiq 2F-85 gripper [`public/robots/kortex_description/`].
13. **xarm6**: UFACTORY xArm 6 6-DOF industrial robot [`public/robots/xarm_description/`].
14. **lite6**: UFACTORY Lite 6 6-DOF lightweight desktop arm [`public/robots/xarm_description/`].
15. **cr5**: Dobot CR5 6-DOF collaborative robot [`public/robots/dobot_description/`].
16. **magician**: Dobot Magician 4-DOF desktop educational arm [`public/robots/cra_description/`].
17. **so101**: The Robot Studio SO-ARM100 6-DOF open-source arm [`public/robots/so101_description/`].
18. **wx250s**: Interbotix WidowX 250 6-DOF arm [`public/robots/interbotix_xsarm_descriptions/`].
19. **irb120**: ABB IRB 120 6-DOF industrial robot [`public/robots/abb_irb120_support/`].
20. **kr6**: KUKA KR 6 R900 sixx 6-DOF industrial robot [`public/robots/kuka_kr6_support/`].
21. **lrmate**: FANUC LR Mate 200iD 6-DOF industrial arm [`public/robots/fanuc_lrmate200id_support/`].
22. **arm3**: Educational 3-DOF planar arm [`public/robots/arm3/`].
23. **arm6**: Educational 6-DOF articulated arm [`public/robots/arm6/`].

### C. Legged Robots & Humanoids
24. **go2**: Unitree Go2 quadruped robot [`public/robots/go2_description/`].
25. **g1**: Unitree G1 humanoid robot [`public/robots/g1_description/`].
26. **h1**: Unitree H1 humanoid robot [`public/robots/h1_description/`].
27. **spot**: Boston Dynamics Spot quadruped robot [`public/robots/spot_description/`].
28. **quadruped**: Educational 12-DOF quadruped robot [`public/robots/quadruped/`].
29. **hexapod**: Educational 18-DOF hexapod robot [`public/robots/hexapod/`].
30. **humanoid**: Educational bipedal humanoid robot [`public/robots/humanoid/`].

### D. Aerial & Hybrids
31. **crazyflie**: Bitcraze Crazyflie 2.1 micro-quadcopter [`public/robots/crazyflie_description/`].
32. **quadcopter**: Educational quadcopter drone [`public/robots/quadcopter/`].
33. **mobile_manipulator**: Educational mobile base + arm hybrid [`public/robots/mobile_manipulator/`].
34. **legged_manipulator**: Educational quadruped + arm hybrid [`public/robots/legged_manipulator/`].

---

## 2. Course Levels and Site Pages

### A. Pages
- `public/index.html`: Homepage featuring hero interactive simulator demonstrations.
- `public/rviz.html`: Robotic Models Simulator main entry point with catalog picker (`#catalog`) and workbench (`#bench`).
- `public/course.html`: Student dashboard tracking core curriculum progression (`W1`, `W2`, `IN`, `W3`, `PF`, `NP`) and advanced modules (`UR`, `XT`, `RV`) [`public/js/course.js:11`].
- `public/lesson.html`: Structured lesson view with interactive panels, terminal simulator, and quiz components [`public/js/lesson.js:1-60`].
- `public/playground.html`: Interactive freeform simulation sandbox with ROS 2 games and challenges [`public/js/playground.js`].
- `public/project.html`: Capstone project workspace and validation harness.

### B. 10-Level Concept Hierarchy (Spec S12)
`public/js/rviz-page.js` implements a stepper component matching the 10-level hierarchy:
1. **Robot & URDF/TF**: RobotModel, TF tree inspector, Fixed Frame selector.
2. **Sensors**: LaserScan, IMU, Camera, 3D raycasting inspection.
3. **Teleop & Odometry**: `TwistStamped` on `/cmd_vel`, `/odom` topic, odometry drift toggle.
4. **Mapping**: SLAM Toolbox (online async, sync, lifelong, localization) and Cartographer.
5. **Localization**: AMCL particle filter, 2D Pose Estimate tool, particle count.
6. **Costmaps**: Global costmap (`map` frame) and local costmap (`odom` frame rolling window 3m × 3m), inflation and obstacle layers.
7. **Global Planning**: NavFn (`use_astar: false`), Smac2D, Theta*, Smac Hybrid-A*, Smac Lattice on `/plan`.
8. **Local Control**: MPPI (`DiffDrive`, 56 steps, 0.05 dt), DWB, Regulated Pure Pursuit on `/local_plan`.
9. **Behavior Trees & Recoveries**: ClearCostmap, Spin, BackUp, Wait, DriveOnHeading, AssistedTeleop.
10. **Missions & Navigation 2**: Waypoint follower, NavigateThroughPoses, docking, speed filters.

---

## 3. RViz Emulation Inventory

The browser RViz implementation lives primarily in `public/js/rviz.js`, `public/js/rviz-data.js`, `public/js/rviz-sim.js`, and `public/js/moveit-rviz.js`:

### A. Tools (`public/js/rviz.js:51-80`)
- **Interact** (`i`): Interactive marker manipulator / orbit fallback.
- **Move Camera** (`m`): 3D viewpoint translation and orbit control.
- **Select** (`s`): Screen bounding-box selection.
- **Focus Camera** (`c`): Re-centers camera onto clicked object.
- **Measure** (`n`): Distance measurement between two picked 3D points.
- **2D Pose Estimate** (`p`): Publishes `geometry_msgs/msg/PoseWithCovarianceStamped` on `/initialpose`.
- **2D Goal Pose** (`g`): Publishes `geometry_msgs/msg/PoseStamped` on `/goal_pose`.
- **Publish Point** (`u`): Publishes `geometry_msgs/msg/PointStamped` on `/clicked_point`.
- **Nav2 Goal** (`g`, plugin `nav2_rviz_plugins`): Integrates with Navigation 2 panel to trigger `navigate_to_pose`.

### B. Displays (`public/js/rviz.js:81-124`)
- **`rviz_default_plugins`**:
  - `Grid`, `RobotModel`, `TF`, `LaserScan`, `PointCloud2`, `Map`, `Image`, `Camera`, `Path`, `Pose`, `PoseArray`, `PoseWithCovariance`, `Marker`, `MarkerArray`, `Polygon`, `Odometry`, `Axes`, `DepthCloud`, `AccelStamped`, `Effort`, `FluidPressure`, `Illuminance`, `InteractiveMarkers`, `Range`, `RelativeHumidity`, `Temperature`, `TwistStamped`, `Wrench`.
- **`rviz_common`**: `Group`.
- **External Package Plugins**:
  - `rviz_imu_plugin`: `Imu` (`sensor_msgs/msg/Imu`).
  - `moveit_rviz_plugin`: `MotionPlanning`, `PlanningScene`, `Trajectory`.
  - `nav2_rviz_plugins`: `ParticleCloud` (`nav2_msgs/msg/ParticleCloud`).

### C. Panels (`public/js/rviz.js:122-124`)
- Standard panels: `Displays`, `Views`, `Time`, `Selection`, `Tool Properties`.
- Plugin panels:
  - `nav2_rviz_plugins/Navigation 2`
  - `nav2_rviz_plugins/Docking`
  - `nav2_rviz_plugins/Selector`
  - `slam_toolbox/SlamToolboxPlugin`
  - `moveit_rviz_plugin` MotionPlanning Panel (`public/js/moveit-rviz.js`)

---

## 4. Simulation Architecture & Data Pipeline

### Shared State vs. Separate Simulations
The Gazebo-like 3D view (`GzSim` in `public/js/gz-sim.js`) and the RViz 2D/3D views (`viewer` in `public/js/rviz.js`) **share simulation state** coordinated by `sh.graph` (`RosGraph` in `public/js/ros-graph.js`):
1. **Clock & Physics Loop**: In `public/js/terminal-sim.js:1629-1642` (`gzTick()`), Gazebo physics steps at ~20 Hz (`g.gzStep(dt)`).
2. **Sensor Simulation**: `senseAll()` runs in `public/js/terminal-sim.js:1644-1655` using Three.js GPU raycasting and offscreen render targets for Lidar, camera, and IMU.
3. **Bridge & Topic Dispatch**: Outputs are packaged by `gzTopicData()` and dispatched to subscribers on the simulated ROS graph.
4. **RViz Visualization Update**: `terminal-sim.js:1640` calls `viewer.update({ edges: g.extraTfEdges(), joints: g.jointValues(), topicData: navTopicData(gzTopicData()), rosTime: rvizTime() })`.
Therefore, Gazebo functions as the physics/sensor backend and RViz operates as the subscriber/visualization frontend over the shared `RosGraph`.

### Core Data Structures and Locations
- **Topics & QoS**: `public/js/ros-graph.js:100-350` (`RosGraph.topics`, message routing, Reliability and Durability policy evaluation).
- **TF Buffer**: `public/js/tf-buffer.js:1-125` (`TfBuffer.setTransform`, `canTransform`, `lookupTransform`, frame tree, and publishing authority).
- **Node Parameters**: `public/js/ros-graph.js:250-320` (`declare_parameter`, `get_parameter`, `set_parameter`).
- **Fixed Frame Dropdown**: `public/js/rviz.js:1534,1856` (Global Options editable combobox).

---

## 5. Existing Test Setup & Ground Truth Analysis

### Site Tests
- **Node & Regression Test Suites**:
  - `tests/iface.test.mjs`: Tests ROS 2 IDL message closure and interface serialization.
  - `tests/physics.test.mjs`: Tests Gazebo Euler/Runge-Kutta physics integration.
  - `tests/tf-buffer.test.mjs`: Tests `TfBuffer` lookup, tree chaining, and exception handling.
  - `package.json` includes `@playwright/test ^1.64.1` and `npm run dev` script (`python3 -m http.server 8000 --directory public`).

### Existing `ground-truth/` Folder
- Contains 19 scenario directories in `ground-truth/real/` and `ground-truth/site/` (e.g. `tb3_burger_world`, `ur5e_sim_control`, `cr5_sim_moveit`) and `ground-truth/REPORT.md`.
- **Reusability Rule**: `parity/CLAUDE.md` explicitly mandates: *Do not move or overwrite the site's own docs/, scripts/, tests/, ground-truth/ or UPDATE-*.md files.* The parity kit v2 uses `parity/fixtures/` as the sole ground truth. Ground-truth files remain read-only reference material.

---

## 6. Gap Analysis Against Spec S1–S12

| Spec Area | Requirement | Current Status in Browser Code | Parity Gap |
|---|---|---|---|
| **S1: Architecture** | Single ROS graph, isolated per tab, lifecycle node states | `RosGraph` in `ros-graph.js` manages topics, TF, and parameters | Lifecycle state transitions for Nav2 servers need full manager binding |
| **S2: Clock & Sim Time** | `/clock` driven by simulation, `use_sim_time:=True` semantics | Clock advances in `gzTick()` (`terminal-sim.js:1633`) | Clock jitter and pause state must synchronize strictly with RViz Time panel |
| **S3: Fixed Frame** | Editable combobox, error string if missing frame | `rviz.js:1534,1856` provides dropdown | Needs free-text editing support and exact error string parity on missing frame |
| **S4: Goal Pose** | Nav2 goal tool, 2D goal pose, lethal cell failure handling | `rviz.js:58,61` implements goal tools | Lethal/inscribed cell planning rejection log string needs exact match |
| **S5: Nav2 Stack** | MPPI default, NavFn, Smac, Theta*, TwistStamped velocity chain | `nav2-core.js`, `nav2-sim.js` implement path planners and controllers | RotationShim wrapper and MPPI trajectory tensor evaluation details |
| **S6: Costmaps** | 3m × 3m local rolling costmap, inflation decay parameters | `nav2-core.js` computes costmaps | Needs parameter alignment with verified values (0.70/3.0 vs 0.5/5.0) |
| **S7: AMCL** | Likelihood field, particle cloud publishing, Web Worker | `nav2-sim.js` has basic particle filter | Full Web Worker isolation and weighted `ParticleCloud` display parity |
| **S8: SLAM** | SLAM Toolbox async/sync modes, map serialization | `slam-sim.js` provides mapping emulation | Serialization service and interactive loop closure buttons in panel |
| **S9: Sensors** | Model-accurate sensors (Burger no cam, Waffle cam, etc.) | `gz-sim.js` renders rays and cameras | Strict topic filtering (must not expose camera topics on Burger) |
| **S10: RViz UI** | 30 FPS default, 15s frame timeout, exact display properties | `rviz.js` implements schemas and tree | Exact status string messages when frames or topics are missing |
| **S11: Tool Inventory** | teleop stamped support, map_saver_cli emulation | `terminal-sim.js` simulates CLI commands | Ensure `teleop_twist_keyboard` supports `stamped:=true` argument |
| **S12: Course Page** | 10-level concept hierarchy, responsive left rail | `rviz-page.js` provides level structure | Verify all 10 levels have functional check-yourself tasks |

---

## 7. Missing Test Hooks on `window.__ros2lab` (P1 Scope)

In baseline 002e901, `public/js/rviz-page.js:42` defines only a minimal handle `window.__ros2lab = { term, sh };`. The full test hook suite required by P1 must be implemented, including:
1. **Topic QoS Details**: `window.__ros2lab.topics` must expose complete QoS profiles (reliability, durability, depth, history) per topic and subscription, not just topic names.
2. **TF Publishing Authority**: `window.__ros2lab.tf.authority` needs to record the publishing node for every frame edge to detect rogue `map` frame publishers.
3. **Node Parameter Inspection**: `window.__ros2lab.nodes` should provide direct access to declared parameters and values per active node.
4. **RViz Display Status Text**: `window.__ros2lab.rvizStatus.displays` must expose full status messages (OK, Warning, Error) and detailed error descriptions per display plugin.
5. **Costmap Grids**: `window.__ros2lab.nav2.globalCostmap` and `localCostmap` must expose full cost grid arrays, resolutions, and origins for test assertions.
6. **Particle History & Cloud**: `window.__ros2lab.nav2.particleCount` and particle poses must reflect active AMCL state.
7. **Namespace & Catalog Conflict Fix**: `public/js/sim-catalog.js:121` must merge into `window.__ros2lab` without clobbering existing accessors.
