# RViz2 baseline (REAL rviz2 14.1.24, Jazzy, Xvfb :51, llvmpipe "OpenGl version: 4.5 (GLSL 4.5)")
Evidence: screenshots in fresh/ and property_trees/ (xctl.py: XTest clicks, Pillow screenshots), saved .rviz files.

## Fresh rviz2 (no config, empty HOME, nothing else running)
- Layout (fresh/default_layout.png): menus File | Panels | Help. Toolbar: Interact, Move Camera, Select, Focus Camera,
  Measure, 2D Pose Estimate, 2D Goal Pose, Publish Point, then "+" and "−" (add/remove tool). Left dock: Displays
  (Global Options: Fixed Frame `map`, Background Color `48; 48; 48`, Frame Rate `30`; Global Status; Grid), buttons Add |
  Duplicate | Remove | Rename. Right dock: Views (Type `Orbit (rviz_default_plugins)`, Zero; Current View Orbit (rviz):
  Near Clip Distance 0.01, Invert Z Axis off, Target Frame <Fixed Frame>, Distance 10, Focal Shape Size 0.05, Focal Shape
  Fixed Size on, Yaw 0.785398, Pitch 0.785398, Focal Point 0; 0; 0; buttons Save | Remove | Rename). Bottom: Time panel
  (ROS Time, ROS Elapsed, Wall Time, Wall Elapsed, Experimental checkbox), "Reset" button, status bar "RViz is ready.", fps.
  No Selection / Tool Properties panels visible by default (they are in Panels menu, unchecked).
- stdout: `[INFO] [T] [rviz2]: Stereo is NOT SUPPORTED`, `[INFO] [T] [rviz2]: OpenGl version: 4.5 (GLSL 4.5)`, `Stereo is NOT SUPPORTED` again (fresh/rviz2_stdout.txt).
- Global Status with no /tf at all: `Global Status: Warn` (orange) → child `Fixed Frame` = `No tf data.  Actual error: Frame [map] does not exist`
  (help pane shows "No tf data. Actual error: Frame [map] does not exist"; the binary string is "No tf data.  Actual error: " with TWO spaces,
  installed/status_strings_from_binaries.txt). Screenshot fresh/status_no_tf_selected.png.
- Ctrl+S on a fresh rviz2 writes ~/.rviz2/default.rviz (+ persistent_settings): fresh/default_saved_by_fresh_rviz2.rviz.
  It adds to the shipped default: Fixed Frame `map` (shipped file says `/map`), Frame Rate 30, Measure `Line color: 128; 128; 0`,
  2D Pose Estimate `Covariance x: 0.25`, `Covariance y: 0.25`, `Covariance yaw: 0.06853891909122467`, and for each tool topic
  `Depth: 5, Durability Policy: Volatile, History Policy: Keep Last, Reliability Policy: Reliable` with Value /initialpose, /goal_pose, /clicked_point.

## Add dialog ("Create visualization") – fresh/add_dialog_by_display_type*.png, fresh/add_dialog_by_display_type.txt
## Panels – menu (fresh/menu_panels*.png): Add New Panel, Delete Panel ▸, Fullscreen F11, then checkable panels (Tools, Displays, Selection, Tool Properties, Views, Time …).
  Add New Panel dialog (fresh/add_new_panel_dialog.png), group rviz_common: Displays, Help, Selection, Time, Tool Properties, Transformation, Views
  (+ nav2_rviz_plugins Docking, Navigation 2, Route Tool, Selector; rviz_visual_tools RvizVisualToolsGui; slam_toolbox SlamToolboxPlugin on this machine).
## Views types (fresh/views_type_dropdown_full.png): FPS, FrameAligned, Orbit (default), ThirdPersonFollower, TopDownOrtho, XYOrbit – each "(rviz_default_plugins)".

## Default property trees – property_trees/saved_all_default_displays.rviz (every rviz_default_plugins display loaded by class only, saved with Ctrl+S)
- Every topic-based display defaults to QoS Depth 5, Durability Volatile, History Keep Last, Reliability Reliable (Filter size 10 where present).
- TF: Filter (blacklist), Filter (whitelist) regex properties, Frame Timeout, Frames, Marker Scale, Show Arrows/Axes/Names, Tree, Update Interval.
- A display with no topic: status `Status: Error` → `Topic` = `Error subscribing: Empty topic name` (property_trees/accelstamped_status_selected.png).
- Camera and Image open their own dock panels; Image shows "No Image" (property_trees/loaded.png).

## With the TB3 burger world running (headless Gazebo, start_reference.sh tb3_burger sensors 51)
Config status_tb3/input_status_map.rviz (Fixed Frame map; LaserScan /scan, /no_such_topic, /be_scan; TF; RobotModel /robot_description).
- TF exists but no `map` frame: `Global Status: Error` (red) → `Fixed Frame` = `Frame [map] does not exist` (status_tb3/fixed_frame_map_missing_help.png).
  Without any /tf (fresh rviz2) the same case is a WARN "No tf data.  Actual error: Frame [map] does not exist".
- RobotModel: `Status: Error`; children `Topic` = `1 messages received at 1.3 hz.`, `URDF` = `URDF parsed OK`, one row per link
  `No transform from [<link>] to [map]` (base_footprint, base_link, base_scan, caster_back_link, imu_link, wheel_left_link, wheel_right_link) (status_tb3/tree_robotmodel_status.png, help_robotmodel_combined.png).
- LaserScan /scan with the fixed frame missing: `Status: Ok`, `Topic` = `OK`, `Points` = `Showing [0] points from [0] messages`; the scans are dropped,
  only logged in the terminal: `[INFO] [T] [rviz]: Message Filter dropping message: frame 'base_scan' at time 27.600 for reason 'discarding message because the queue is full'` (status_tb3/rviz2_stdout.txt).
- LaserScan on a topic nobody publishes (/no_such_topic): `Status: Ok`, Topic `OK`, Points `Showing [0] points from [0] messages` – no "No messages received" text.
- LaserScan (default Reliable) on a Best-Effort publisher (/be_scan): GUI the same as above (Status Ok, 0 points); terminal only:
  `[WARN] [T] [rviz]: New publisher discovered on topic '/be_scan', offering incompatible QoS. No messages will be sent to it. Last incompatible policy: RELIABILITY_QOS_POLICY`.
Config tools_tb3/input_tools_odom.rviz (Fixed Frame odom): `Global Status: Ok`, `Fixed Frame` = `OK` (tools_tb3/odom_view.png).
- Node: `/rviz` (log lines are under `[rviz2]` at startup, `[rviz]` afterwards). `ros2 node info /rviz` (tools_tb3/node_info_rviz.txt): publishers /clicked_point
  geometry_msgs/msg/PointStamped, /goal_pose geometry_msgs/msg/PoseStamped, /initialpose geometry_msgs/msg/PoseWithCovarianceStamped; service /rviz/reset_time std_srvs/srv/Empty.
- 2D Pose Estimate (press-drag-release) → /initialpose, frame_id = fixed frame (odom), covariance[0] = 0.25, [7] = 0.25, [35] = 0.06853891909122467, all others 0.0 (tools_tb3/echo_initialpose.txt).
- 2D Goal Pose → /goal_pose PoseStamped, frame_id odom, z 0.0 (echo_goal_pose.txt). Publish Point: hover status `Left-Click: Select this point. [x,y,z]`; click → /clicked_point PointStamped frame_id odom (echo_clicked_point.txt).
  Stamps are WALL time (rviz2 started without use_sim_time; ROS Time field shows wall time too).
- Measure: status bar `Click on two points to measure their distance. Right-click to reset.`, after two points `[Length: 0.908505m] Click on two points …` (tools_tb3/measure_statusbar.png).
- Add → By topic (tools_tb3/add_dialog_by_topic*.png): /be_scan LaserScan, /clicked_point PointStamped, /cmd_vel TwistStamped, /goal_pose Pose, /initialpose PoseWithCovariance,
  /joint_states Effort, /odom Odometry, /scan LaserScan; checkbox "Show unvisualizable topics" (off); field "Filter topics by name:". /imu, /tf, /tf_static, /robot_description, /clock are not listed.
- Reset button: ROS Elapsed and Wall Elapsed go back to ~0 (101.54 → 1.06) (tools_tb3/reset_before_after.png).

## MoveIt: ur_sim_moveit (ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e gazebo_gui:=false), domain 51
- Launched RViz (moveit_ur5e/moveit_layout.png): config /opt/ros/jazzy/share/ur_moveit_config/config/moveit.rviz (copy: installed_moveit.rviz),
  Fixed Frame `world`, `Global Status: Ok`, displays Grid + MotionPlanning, MotionPlanning dock panel.
- MotionPlanning tabs (moveit_layout.png + tabs_scrolled.png): Context | Planning | Joints | Scene Objects | Stored Scenes | Stored States | Status | Manipulation.
- Real node list (moveit_ur5e/node_list.txt) prints `WARNING: Be aware that there are nodes in the graph that share an exact name…`: two `/rviz2_moveit` nodes,
  plus /move_group, /move_group/moveit, /moveit_simple_controller_manager, /gz_ros_control, /interactive_marker_display_<n>, /moveit_<n>, /rviz2_moveit_private_<n>, transform listeners.
- Save Config As opens a Qt dialog that stayed hidden under the 2560-px main window on the WM-less Xvfb; the property tree was therefore saved from a second
  rviz2 started with a writable copy of the same moveit.rviz (Ctrl+S): moveit_ur5e/saved_moveit_motionplanning.rviz (339 lines vs 311 installed).
  That rviz2 had no kinematics.yaml parameters (log: "No active joints or end effectors found for group 'ur_manipulator'…"), which does not change the saved tree.
- MotionPlanning defaults in the saved tree: Acceleration/Velocity_Scaling_Factor 0.1, MoveIt_Planning_Attempts 10, MoveIt_Planning_Time 5, Workspace 2×2×2 at 0,
  Planned Path (Trajectory Topic /display_planned_path, State Display Time 0.05 s, Robot Alpha 0.5, Robot Color 150; 50; 150, Loop Animation False, Show Trail False),
  Planning Request (Planning Group ur_manipulator, Query Goal State True, Start State Color 0; 255; 0, Goal State Color 250; 128; 0, Interactive Marker Size 0),
  Planning Scene Topic monitored_planning_scene, Robot Description robot_description, Scene Geometry (Scene Alpha 0.9, Scene Color 50; 230; 50), Scene Robot.

## View type defaults (views/saved_views_defaults.rviz: each type loaded by Class only into Views › Saved, saved with Ctrl+S)
- Every type: Enable Stereo Rendering off (Stereo Eye Separation 0.06, Stereo Focal Distance 1, Swap Stereo Eyes off), Invert Z Axis off, Near Clip Distance 0.01, Target Frame <Fixed Frame>.
- FPS: Position 5, 5, 10; Yaw 0; Pitch 0. FrameAligned: Position 0, 0, 0; Point towards `-z axis`; Lock Camera off; Pitch 1.5698; Yaw 0.
- Orbit, ThirdPersonFollower, XYOrbit: Distance 10, Focal Point 0, 0, 0, Focal Shape Size 0.05, Focal Shape Fixed Size on, Yaw 0.785398, Pitch 0.785398.
- TopDownOrtho: Scale 10, Angle 0, X 0, Y 0.
