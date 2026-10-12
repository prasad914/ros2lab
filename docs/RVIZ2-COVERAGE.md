# RViz2 (Jazzy) coverage of the practice RViz

The practice RViz (`public/js/rviz.js`, `rviz-data.js`, `css/rviz.css`) is the website's own browser copy of RViz2,
written with three.js. It does not run the real `rviz2` program. It reads real `.rviz` files and draws the data that
the simulator's models publish (Gazebo through `ros_gz_bridge`, `robot_state_publisher`, the Nav2 and SLAM models in
`nav2-sim.js` / `slam-sim.js`, MoveIt models).

**Supported** means it works as in RViz2 for the cases the course uses. **Partly** means it works, but some
properties or behaviours are missing (listed). **Not** means not implemented. When a display class cannot be loaded,
the practice RViz shows RViz2's own error: "The class required for this display, 'x', could not be loaded."

Last checked against `tests/nav2.mjs` (it loads the real `tb3_navigation2.rviz`, `nav2_default_view.rviz` and
`tb3_cartographer.rviz`).

## Displays

| Display (class) | Status | Notes |
|---|---|---|
| rviz_default_plugins/Grid | Supported | Cell size, count, colour, alpha, plane, offset. |
| rviz_default_plugins/Axes | Supported | |
| rviz_default_plugins/TF | Supported | Frames, names, axes, arrows, marker scale. Frames come from the URDF, `/tf` from Gazebo's DiffDrive and Nav2 / SLAM `map -> odom`. |
| rviz_default_plugins/RobotModel | Supported | Description topic or file. Visual / collision meshes (STL, DAE, OBJ), alpha, links. |
| rviz_default_plugins/LaserScan | Partly | Points / flat squares, size, colour transformers (Intensity, FlatColor, AxisColor). Decay Time is listed but only the newest scan is drawn. |
| rviz_default_plugins/PointCloud2 | Partly | Points with RGB / intensity / axis colours. Decay time, selectable and the full style list are not modelled. |
| rviz_default_plugins/Map | Supported | Colour schemes `map`, `costmap` and `raw` with RViz2's palettes. Alpha, Draw Behind, Resolution / Width / Height / Position read-outs. The texture is rebuilt only when the grid changes. Update Topic: the models always send full grids (`always_send_full_costmap`), so the update topic is accepted but not needed. |
| rviz_default_plugins/Path | Partly | Lines style, colour, alpha. Billboards line width, Pose Style (axes / arrows), Offset and Buffer Length are not drawn. |
| rviz_default_plugins/Odometry | Supported | Arrow / axes shapes, position and angle tolerance, Keep. The covariance ellipse is not drawn. |
| rviz_default_plugins/PoseArray | Supported | Arrow (Flat), Arrow (3D) and Axes, with their sizes and colour. |
| rviz_default_plugins/Polygon | Supported | Closed line in the message frame, colour, alpha (Nav2 footprints, collision monitor polygons). |
| rviz_default_plugins/Pose | Supported | Arrow or axes. |
| rviz_default_plugins/PoseWithCovariance | Partly | Arrow or axes plus the position covariance ellipse. The orientation covariance and its colour properties are not drawn. |
| rviz_default_plugins/Marker, MarkerArray | Supported | All marker types used in the course (arrows, cubes, spheres, cylinders, lines, points, text, meshes, triangle lists). |
| rviz_default_plugins/InteractiveMarkers | Partly | Move / rotate axis and plane controls, buttons and menus. 3D free-move controls are simplified. |
| rviz_default_plugins/Image | Supported | Image dock, normalisation for depth images. |
| rviz_default_plugins/Camera | Partly | Background / overlay rendering. Distortion is not applied. |
| rviz_default_plugins/Range, Temperature, Illuminance, FluidPressure, RelativeHumidity, Effort, Wrench, TwistStamped, AccelStamped, PointStamped, GridCells, PointCloud, DepthCloud | Partly | Listed with RViz2's properties and topic types. They subscribe and report status, but they draw nothing yet. |
| nav2_rviz_plugins/ParticleCloud | Supported | Needs the `nav2_rviz_plugins` package. Arrow length between Min and Max Arrow Length by weight, the three shapes, Best Effort QoS. |
| rviz_imu_plugin/Imu | Supported | Needs `rviz_imu_plugin`. Axes, box and acceleration arrow. |
| moveit_rviz_plugin/MotionPlanning | Partly | See the MoveIt notes. |
| Any other class | Not | Shown in red with RViz2's "could not be loaded" error. Its settings are kept when the config is saved again. |

## Tools

| Tool (class) | Status | Notes |
|---|---|---|
| Interact, Move Camera, Select, Focus Camera, Measure | Supported | RViz2 shortcuts and status bar texts. |
| SetInitialPose (2D Pose Estimate) | Supported | Publishes `/initialpose` (PoseWithCovarianceStamped, RViz2's default covariance). AMCL uses it. |
| SetGoal (2D Goal Pose) | Supported | Publishes `/goal_pose`. `bt_navigator` subscribes to it, like the real one. |
| PublishPoint | Supported | Publishes `/clicked_point`. |
| nav2_rviz_plugins/GoalTool (Nav2 Goal) | Supported | Needs `nav2_rviz_plugins`. Like the real tool, the goal goes to the Navigation 2 panel, which sends it to bt_navigator's `navigate_to_pose`. In waypoint mode it collects poses. |
| Tool Properties panel (editing tool topics) | Partly | Tool topics are fixed to the defaults. |
| The Tools list of a loaded `.rviz` file | Supported | The tool bar shows the file's tools. A tool whose plugin is missing is left out and logged. |

## Panels

| Panel | Status | Notes |
|---|---|---|
| rviz_common/Displays, Views, Time, Selection, Tool Properties, Help | Supported / Partly | Displays and Views are complete. Time shows ROS / wall time (sim time with `use_sim_time`). Selection is basic. |
| nav2_rviz_plugins/Navigation 2 | Partly | Navigation / Localization status (from the lifecycle managers), Startup / Pause / Resume, Reset, Cancel, feedback (ETA, distance remaining, time taken, recoveries), Waypoint / Nav Through Poses mode with Start Waypoint Following / Start Nav Through Poses / Cancel Accumulation. Not modelled: loop count, Load / Save WPs, "Store initial_pose". |
| nav2_rviz_plugins/Selector, nav2_rviz_plugins/Docking | Not | Shown with a note that they are not modelled. |
| slam_toolbox/SlamToolboxPlugin | Not | Shown with a note. Use `ros2 service call /slam_toolbox/save_map ...` or `map_saver_cli` instead. |
| A panel whose package is not installed | Supported | RViz2's "The class required for this panel, 'x', could not be loaded." |

## Views

| View controller | Status | Notes |
|---|---|---|
| Orbit, XYOrbit | Supported | Mouse controls and the view properties of RViz2. |
| ThirdPersonFollower, FPS | Partly | In the Type list. They are not checked against RViz2 in detail. |
| TopDownOrtho | Supported | Scale, Angle, X, Y from the config (the Nav2 and Cartographer configs use it). |
| Saved views | Not | |

## Configuration files

| Feature | Status | Notes |
|---|---|---|
| Load `.rviz` (`-d`, File > Open Config) | Supported | Displays (inside Groups too), properties, Topic QoS, Global Options, the current view, Tools, plugin panels. |
| Save `.rviz` (File > Save Config) | Partly | Writes displays, global options and the current view. It writes a standard panel and tool list instead of the loaded ones. |
| Window Geometry, splitter ratios | Not | The layout is the practice RViz's own. |

## Command line flags of `rviz2`

| Flag | Status | Notes |
|---|---|---|
| `-d <config>` | Supported | `ros2 run rviz2 rviz2 -d file.rviz` and the real launch files' `arguments=['-d', ...]`. |
| `--ros-args -p use_sim_time:=true` | Supported | ROS Time follows the Gazebo clock when `/clock` is bridged. |
| `-f <fixed frame>` | Not | The fixed frame comes from the config or the Displays panel. |
| `-l`, `-s`, `--fullscreen`, `-o`, `--splash-screen`, `--display-title-format` | Not | |

## Nav2 / SLAM data drawn by the displays

| Topic | Display in the real configs | Source model |
|---|---|---|
| `/map` (transient local) | Map (scheme map) | `nav2_map_server` map_server (real map.yaml + pgm), slam_toolbox, cartographer_occupancy_grid_node |
| `/global_costmap/costmap`, `/local_costmap/costmap` | Map (scheme costmap) | planner_server / controller_server costmaps (static, obstacle, voxel as 2D, inflation layers) |
| `/global_costmap/published_footprint`, `/local_costmap/published_footprint` | Polygon | robot_radius or footprint from the params |
| `/plan`, `/local_plan` | Path | planner_server (NavFn / Smac 2D / Theta*), controller_server |
| `/particle_cloud` | nav2_rviz_plugins/ParticleCloud | amcl |
| `/amcl_pose` | PoseWithCovariance | amcl |
| `/polygon_*` | Polygon | collision_monitor (visualize: true) |
| `map -> odom` | TF | amcl, slam_toolbox, cartographer_node |
