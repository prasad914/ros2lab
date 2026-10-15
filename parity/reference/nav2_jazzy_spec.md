# ROS2Lab target specification – what the browser must match (ROS 2 Jazzy)

Source: two earlier research reports (web sources, Oct 2026). Items marked **[VERIFY]** were not confirmed against the installed packages; `parity/scripts/verify_facts.sh` checks them on the real machine and writes `parity/fixtures/_installed/facts.md`. **When this file and an installed file or a captured fixture disagree, the installed file / fixture wins.** Update this file when that happens.

Reference platform: Ubuntu 24.04 · ROS 2 Jazzy · Gazebo Harmonic (ros_gz) · Nav2 · SLAM Toolbox · Cartographer (TB3 e-Manual default SLAM). Gazebo Classic is not the Jazzy path.

---

## S1. Architecture (fix before features)
- ONE scene graph. Gazebo-like 3D view and RViz-like view are cameras on the same scene. "2D" = RViz TopDownOrtho camera, not a second simulation. Views: Orbit, TopDownOrtho, XYOrbit, FPS, ThirdPersonFollower; each has a Target Frame.
- ONE message-typed pub/sub bus with exact ROS names, types and QoS (so it can later bind to rosbridge_suite + roslibjs or foxglove_bridge for an optional "Live ROS 2" mode). Do not use ros2-web-bridge (archived Nov 2025).
- ONE TF registry: static buffer (never expires) + dynamic buffer (~10 s per edge); `setTransform(t, authority, isStatic)`, `getAllFrameNames()`, `canTransform`, `lookupTransform`; tracks publisher authority (detects two publishers of one edge).
- Lifecycle state machine per Nav2 node: unconfigured → inactive → active, driven by lifecycle_manager (autostart).
- Robot capability manifest per robot (`robots/<id>.json`): sensors, topics, types, frame_ids, rates, QoS. Single source of truth for topic list, Add-by-topic dialog, bridge YAML view and `ros2 topic list`. Non-standard variants carry `nonstandard: true` and a visible badge.
- Nav2/AMCL/costmap parameters per robot in `robots/<id>/nav2_params.json`, generated from the INSTALLED `nav2_params.yaml` / `turtlebot3_navigation2` param files (header comment: source path + package version).

## S2. TF tree (REP-105)
- Single-parent tree: `map → odom → base_footprint → base_link → {base_scan, imu_link, wheel links, camera_* (waffle/waffle_pi)}`.
- `map→odom` is published ONLY by AMCL (after an initial pose, because `set_initial_pose: false`) or by SLAM. Before that, map is disconnected – emulate this state, it is a lesson.
- `odom→base_footprint` from odometry (or EKF if robot_localization level is on; then odometry must not also publish it).
- `/tf_static` is transient-local: late subscribers (including the UI) must receive the latched static transforms.
- Frame IDs never start with `/`. Namespaced robots use prefixes (e.g. `tb3_0/odom`) consistently.

## S3. RViz Fixed Frame (current bug)
Real behaviour: Global Options → Fixed Frame is an EDITABLE combobox (rviz `TfFrameProperty`) filled from all frames in the TF buffer and refreshed; default `map`; the user may type any name. Missing frame → Global Status error, e.g. "Frame [map] does not exist" / "No tf data. Actual error: Frame [map] does not exist" [VERIFY exact text from fixture]. Displays only render once a transform from their `header.frame_id` to the fixed frame exists.
Expected: Fixed Frame = `odom` → map drifts slightly, robot moves smoothly; Fixed Frame = `base_link` → robot fixed, world moves.

Likely causes to check, in order:
1. No frame registry, or built only from `/tf` (static frames never seen).
2. Options rendered once at mount, never refreshed.
3. Controlled component without working `onChange`, or store overwrites the value.
4. `disabled` / `readonly` / `pointer-events:none` from a loading wrapper.
5. Overlay (WebGL canvas, tooltip, resizer) intercepting clicks.
6. Plain `<select>` – no free text.
7. Name normalisation (`/map` vs `map`, namespaces).
8. Renderer ignores the selected value and always transforms to `"map"`.

Fix: `FixedFrameCombobox` (ARIA combobox, free text, `data-testid="fixed-frame"`, refresh every 1 s and on `framesChanged`), bound to `rvizConfig.globalOptions.fixedFrame`, persisted to localStorage per robot/lesson and to the exported `.rviz` YAML; all displays transform via a FrameManager and set per-display status on failure.
DevTools checks: element exists/enabled; `getComputedStyle(el).pointerEvents`; `document.elementFromPoint` at its centre returns it; `window.__ros2lab.tf.getAllFrameNames()` returns the full list; store action fires on change.

## S4. RViz tools
| Tool | Must publish / do |
|---|---|
| 2D Pose Estimate | `/initialpose` `geometry_msgs/msg/PoseWithCovarianceStamped`, `frame_id` = fixed frame, yaw from drag, covariance x=0.25 [0], y=0.25 [7], yaw=0.06853891909122467 [35]. AMCL reinitialises particles (Gaussian) → publishes `/amcl_pose`, `/particle_cloud`, map→odom. In SLAM mapping mode it has no effect; in SLAM Toolbox localization mode it relocalises. |
| 2D Goal Pose | `/goal_pose` `geometry_msgs/msg/PoseStamped` → bt_navigator → NavigateToPose. Goal transformed to `map` before planning (works with Fixed Frame = odom). |
| Nav2 Goal (Nav2 panel tool) | calls `navigate_to_pose` action directly, shows feedback |
| Publish Point | `/clicked_point` `geometry_msgs/msg/PointStamped` |
| Interact, Move Camera, Select, Focus Camera, Measure | same behaviour as rviz2 |
Per-algorithm check: for each planner × controller pair, a goal must produce `/plan` from the SELECTED planner on the GLOBAL COSTMAP and motion from the SELECTED controller on the LOCAL COSTMAP. If `/plan` is identical for NavFn, Smac and Theta*, the selector is not wired.
Goal in a lethal/inscribed cell → planner fails ("GridBased: failed to create plan…" [VERIFY]) → BT recoveries run.

## S5. Nav2 stack (Jazzy)
Servers: map_server, amcl, planner_server, controller_server, smoother_server, behavior_server, bt_navigator (BT.CPP v4), waypoint_follower (incl. GPS), velocity_smoother, collision_monitor (+ collision_detector), docking_server (opennav_docking [VERIFY installed]), lifecycle_manager; route_server (`nav2_route`) [VERIFY – feature-flag OFF until installed]. Plugin names use `::` (e.g. `nav2_navfn_planner::NavfnPlanner`).
Actions: `navigate_to_pose`, `navigate_through_poses`, `follow_waypoints`, `follow_gps_waypoints`, `compute_path_to_pose`, `follow_path`, `smooth_path`, `spin`, `backup`, `wait`, `drive_on_heading`, `assisted_teleop`, `dock_robot`, `undock_robot`.
Velocity chain: controller → `cmd_vel_nav` → velocity_smoother → `cmd_vel_smoothed` → collision_monitor → `cmd_vel`. TB3 Jazzy uses `geometry_msgs/msg/TwistStamped` (`enable_stamped_cmd_vel: true`); plain Nav2 Jazzy default is false (TwistStamped default only from Kilted). [VERIFY in installed TB3 params + bridge YAML]
Defaults (Jazzy bringup) [VERIFY from installed nav2_params.yaml]: planner NavFn (`use_astar: false`); controller MPPI (`motion_model: DiffDrive`, `time_steps: 56`, `model_dt: 0.05`); AMCL min/max particles 500/2000.

Ways to plan (each must be selectable and visibly different):
| Layer | Option | Suits |
|---|---|---|
| Global planner | NavFn (Dijkstra; A* via `use_astar`) | circular diff/omni – default |
| | Smac 2D (A*, 4/8-connected) | circular diff/omni |
| | Theta* (any-angle) | circular diff/omni |
| | Smac Hybrid-A* (Dubins / Reeds-Shepp) | Ackermann, legged |
| | Smac State Lattice | non-circular footprints |
| Controller | MPPI | diff, omni, Ackermann, legged – default |
| | DWB | diff, omni |
| | Regulated Pure Pursuit | diff, Ackermann, legged |
| | Rotation Shim (wraps another) | diff/omni; pair with NavFn/Theta*/Smac2D |
| | Graceful | diff |
| | Vector Pursuit [VERIFY in Jazzy] | diff, Ackermann |
| Behaviours | Spin, BackUp, Wait, DriveOnHeading, AssistedTeleop, ClearCostmap | all |
| Modes | NavigateToPose, NavigateThroughPoses, FollowWaypoints (+ WaitAtWaypoint / PhotoAtWaypoint / InputAtWaypoint), Simple Commander API, keepout & speed filters, docking | all |

## S6. Costmaps
- Global costmap: `global_frame: map`, whole map, layers static + obstacle + inflation; used by planner.
- Local costmap: `global_frame: odom`, rolling window 3 m × 3 m at 0.05 m [VERIFY], layers voxel/obstacle + inflation; used by controller.
- Cost values: 0 free · 1–252 graded · 253 inscribed · 254 lethal · 255 unknown.
- Inflation: exponential decay to `inflation_radius` with `cost_scaling_factor`, using `robot_radius`/footprint. Plugin defaults 0.55 / 10.0; Jazzy bringup values differ between versions (reported 0.70/3.0 and 0.82/3.0, robot_radius 0.22) [VERIFY – read installed file].
- Other layers: range, denoise; filters: keepout, speed (`/keepout_filter_mask`, `/costmap_filter_info`).
- RViz: Map display, colour scheme `costmap`, topics `/global_costmap/costmap`, `/local_costmap/costmap`; footprints as Polygon.

## S7. AMCL
Particle filter (MCL, Fox/Thrun). `laser_model_type: likelihood_field` (or beam, likelihood_field_prob); `robot_model_type: nav2_amcl::DifferentialMotionModel` (or OmniMotionModel); alpha1–5 = 0.2; `base_frame_id: base_footprint`; `global_frame_id: map`; `set_initial_pose: false` [VERIFY].
Subscribes `scan`, `map`, `initialpose`; publishes `amcl_pose`, `particle_cloud` (`nav2_msgs/msg/ParticleCloud`, weighted, Best Effort – needs the nav2_rviz_plugins display, not PoseArray), map→odom. Services: `global_localization`, `set_initial_pose`, `request_nomotion_update`. Run in a Web Worker.

## S8. SLAM
SLAM Toolbox: online async (may drop scans), online sync, lifelong, localization, offline. `/map` (transient-local) + map→odom. Services `save_map` (image map for AMCL) and `serialize_map` (pose graph). RViz SlamToolboxPlugin panel: Save Map, Serialize Map, Deserialize (continue mapping / localize), interactive loop closure. With Nav2: SLAM replaces amcl + map_server (`navigation_launch.py` or `tb3_simulation_launch.py slam:=True`).
Cartographer: alternative (TB3 default); `/map`, `/submap_list`.
Saving: `ros2 run nav2_map_server map_saver_cli -f <path>` writes .yaml + .pgm.

## S9. Sensors per robot [VERIFY each from installed model.sdf + bridge YAML]
| Robot | /scan | /imu | /odom | RGB image | camera_info | depth | PointCloud2 |
|---|---|---|---|---|---|---|---|
| tb3_burger | ✅ base_scan | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| tb3_waffle | ✅ | ✅ | ✅ | ✅ `/camera/image_raw` (frame `camera_rgb_frame`, via ros_gz_image) | ✅ `/camera/camera_info` | ❌ | ❌ |
| tb3_waffle_pi | ✅ | ✅ | ✅ | ✅ (Pi camera) | ✅ | ❌ | ❌ |
| tb4 (sim) | ✅ | ✅ | ✅ | ✅ `/oakd/rgb/preview/image_raw` | ✅ | sim-dependent | ✅ (reported `/oakd/rgb/preview/depth/points`) |
| tb3_waffle_depth (ROS2Lab, NON-STANDARD) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ `/camera/depth/image_raw` | ✅ `/camera/depth/points` |
Behaviour that must match RViz:
- PointCloud2 on TB3 Burger/Waffle: no such topic → not in Add-by-topic; typed manually → warning, no data. Do not fake points.
- PointCloud2 on `/scan`: type mismatch (LaserScan ≠ PointCloud2) → error; teach LaserScan display.
- Image: "No Image" until data. Best-effort publisher + Reliable subscriber → no data + incompatible-QoS warning (DDS rules). Transport hint raw/compressed.
- Camera display needs CameraInfo + TF to camera frame; missing CameraInfo → status error.
- DepthCloud display: expose only if present in installed rviz_default_plugins [VERIFY].
Emulation: RGB = offscreen Three.js camera at the optical frame (z fwd, x right, y down) → WebGLRenderTarget → rgb8 at 10–30 Hz, throttled when hidden. CameraInfo K from HFOV: fx = w / (2·tan(hfov/2)), plumb_bob, D = 0. Depth/PointCloud2 (TB4 + non-standard variant): depth texture or BVH raycast → 32FC1 → PointCloud2 (x,y,z float32 [+rgb], `is_dense=false`, NaN for no return).

## S10. RViz displays and panels to match (each needs a test)
Global Options (Fixed Frame, Background Color, Frame Rate [VERIFY default 30]), Global Status, Grid (Reference Frame, Cell Count/Size, Plane), RobotModel (Description Source Topic/File), TF (Show Names/Axes/Arrows, Marker Scale, Frame Timeout [VERIFY 15 s], per-frame toggles), LaserScan (Style, Size, Color Transformer, Decay Time; "Message Filter dropping message: frame 'base_scan' … queue is full" when TF missing [VERIFY]), PointCloud2, Image, Camera, Map (Topic, Update Topic, Durability, Color Scheme map/costmap/raw, Alpha; Volatile on /map → "No map received" [VERIFY]), Path, Pose, PoseArray, PoseWithCovariance, ParticleCloud, Marker/MarkerArray, Polygon, Odometry (Keep, Shape, Covariance), Axes.
Views panel, Time, Selection, Tool Properties, Displays.
Add dialog: "By display type" and "By topic" (lists only existing, type-compatible topics).
Navigation 2 panel: Startup / Pause / Reset (lifecycle), Waypoint / Nav Through Poses mode, Start Waypoint Following, feedback (ETA, distance remaining, recoveries, navigation time), load/save/loop waypoints. Kilted-only panels (e.g. Docking panel) must NOT appear in Jazzy mode.
SlamToolboxPlugin panel as in S8.
Default display set to mirror: installed `nav2_default_view.rviz` and TB3's own .rviz files.

## S11. Autonomous-navigation tool inventory (each needs an emulation + lesson)
URDF/xacro + robot_state_publisher (`/robot_description` transient-local, `/tf`, `/tf_static`) · joint_state_publisher(_gui) (URDF-only lesson) · ros_gz_sim · ros_gz_bridge (virtual bridge table; topic not in YAML must not exist) · ros_gz_image · teleop (turtlebot3_teleop; teleop_twist_keyboard needs stamped option [VERIFY param name]) · robot_localization EKF (optional level) · slam_toolbox · Cartographer · nav2_map_server + map_saver · nav2_amcl · planner/controller/smoother/behavior servers · bt_navigator · waypoint_follower · velocity_smoother · collision_monitor · docking · costmap filters · lifecycle_manager · nav2_simple_commander (in-browser Python shim, e.g. Pyodide, exposing BasicNavigator) · rviz2 + nav2_rviz_plugins + SlamToolboxPlugin · tf2_tools view_frames · rqt_tf_tree / rqt_graph / rqt_image_view · depthimage_to_laserscan / pointcloud_to_laserscan (depth robots only) · image_transport · foxglove_bridge (optional) · rosbag2 (MCAP record/replay).
Reference for the minimum simulated contract: `nav2_loopback_sim` (publishes clock, odom, map→odom, odom→base_link, scan from the static map; accepts initialpose).

ros_gz_bridge mappings: Clock↔gz.msgs.Clock · JointState↔gz.msgs.Model · Odometry↔gz.msgs.Odometry · TFMessage↔gz.msgs.Pose_V · Twist/TwistStamped↔gz.msgs.Twist (ROS→GZ) · Imu↔gz.msgs.IMU · LaserScan↔gz.msgs.LaserScan · CameraInfo↔gz.msgs.CameraInfo · Image via ros_gz_image · PointCloud2↔gz.msgs.PointCloudPacked (not in stock TB3).

## S12. Per-robot page – concept hierarchy (same component for every robot)
Left-rail stepper; each level = one-sentence concept (max ~20 words, no long paragraphs) + "Try it" control + "What real ROS 2 shows" panel (topics/TF/commands) + "Check yourself" task. Levels lock until prerequisites exist (e.g. Navigation greyed until a map + localisation or SLAM is active).
1. Robot & URDF/TF – RobotModel, TF tree viewer, live Fixed Frame selector
2. Sensors – LaserScan, IMU, camera (only if the robot has one), rays visible in 3D
3. Teleop & odometry – `/cmd_vel` (TwistStamped), `/odom`, odom-drift toggle
4. Mapping – SLAM Toolbox (async/sync/localization) or Cartographer, Save / Serialize
5. Localization – AMCL, 2D Pose Estimate, particle cloud, global_localization button, alpha/particle sliders
6. Costmaps – global vs local toggle, layer checkboxes, inflation radius/scaling sliders, cost legend 0/253/254/255
7. Global planning – planner dropdown, `/plan` overlay, compare mode
8. Local control – controller dropdown (+ Rotation Shim), `/local_plan`, MPPI sample trajectories
9. Behaviour trees & recoveries – live BT node highlight, inject obstacle → spin/backup/clear costmap
10. Missions – waypoints, Nav Through Poses, keepout/speed zones, docking, Simple Commander code panel
Layout: top bar (robot · world · mode Mapping/Localization/Navigation) · left stepper · centre split (Gazebo-like 3D | RViz-like view with Orbit ↔ TopDownOrtho) · right Displays tree + Tool Properties · bottom RViz toolbar + topic/TF inspector. Responsive to phone width, keyboard accessible, RViz-like shortcuts where RViz defines them.
Robot-specific: only show what that robot really has (no camera lessons on Burger – show "Burger has no camera" as a teaching note instead).

## S13. Robot + package combinations to verify on the machine
| Robot | Reference launch | Notes |
|---|---|---|
| TB3 (ROBOTIS) | `turtlebot3_gazebo turtlebot3_world.launch.py`; `turtlebot3_cartographer cartographer.launch.py use_sim_time:=True`; `turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:=<yaml>`; `TURTLEBOT3_MODEL` set | ROBOTIS guide builds Jazzy from source; binaries also indexed |
| TB3 (Nav2 demo) | `nav2_bringup tb3_simulation_launch.py headless:=True` (`slam:=True` option) | uses nav2_minimal_tb3_sim model |
| TB4 | `turtlebot4_gz_bringup turtlebot4_gz.launch.py slam:=true nav2:=true` or `nav2_bringup tb4_simulation_launch.py` | known issues: turtlebot4 #597 (costmap not shown after initial pose, TF extrapolation), #676 |
| Clearpath, Husarion ROSbot, sam_bot, UR/Panda (MoveIt 2), ABB | UNVERIFIED – a subagent must confirm packages and launches on this machine before the site lists them as validated |

## S14. Accuracy / parity metrics (never invented)
Interface parity % · QoS parity · TF parity (frame set + edges) · error-text parity · path length ratio + discrete Fréchet/Hausdorff vs real `/plan` · trajectory RMSE / ATE vs real `/odom` · AMCL convergence time + final x/y/yaw error · costmap cell agreement % + lethal IoU · SLAM map occupancy IoU after alignment · feature coverage % (implemented AND passing). Stochastic parts (AMCL, MPPI): ≥ 10 seeded runs, mean ± sd. Every number traces to a fixture; otherwise PENDING. Each robot page shows "Validated vs Jazzy on <date>: X/Y checks pass" or "Not yet validated".
