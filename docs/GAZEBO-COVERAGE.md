# Practice Gazebo vs Gazebo Harmonic (gz-sim 8, libsdformat 14) — coverage

The website cannot run gz-sim (C++, DART, Ogre2). It reads the **real** world / model / URDF / YAML files of the
official Jazzy workspaces and runs its own JavaScript model of gz-sim: `gz-sdformat.js` (SDF loading),
`gz-cli.js` (command lines, bridge config), `ros-gz.js` (systems, bridge, topics), `gz-physics.js` (Rapier rigid
bodies + joint dynamics), `gz-sim.js` (three.js rendering and rendering sensors), `gz-mesh.js` (mesh files).
Status words: **Supported** = behaves like Gazebo for what ROS 2 users see (topics, frames, messages, errors);
**Partly** = present but simplified (notes say how); **No** = not modeled.

Verified with: `tests/gz-real-tb3.mjs`, `tests/gz-real-arms.mjs` (Chromium; `tests/gz-real-node.mjs` runs the same
scenarios in Node), `tests/sdf-native.mjs`, `tests/gz-cli.mjs`, plus the older `physics.test.mjs`, `sdfload.mjs`,
`urdf2sdf.test.mjs`, `wall.mjs`, `gzphys.mjs`, `sweep.mjs`. The scenarios use the processes each robot's real launch
starts (`tests/gz-fixtures/*.json`, recorded by `tests/gz-capture.mjs` with the real ros2/launch libraries).

## SDFormat

| Feature | Status | Notes |
|---|---|---|
| SDF 1.4 – 1.11 documents, `<sdf version>` | Supported | One reader for all versions; old forms read too (`<pose frame>`, `use_parent_model_frame`, `<ray>`). No version conversion messages. |
| `<world>`, `<model>`, `<link>`, `<joint>`, `<frame>` | Supported | Scoped names (`nested::link`) for nested models. |
| `<include>` `uri name pose static plugin`, `merge="true"` | Supported | |
| `model://` via `GZ_SIM_RESOURCE_PATH` (+ `IGN_GAZEBO_RESOURCE_PATH`, `SDF_PATH`, `~/.gz/fuel`) | Supported | `model.config`: highest `<sdf version>` ≤ 1.11 wins. |
| `package://`, `file://`, relative paths | Supported | package:// via the ament prefixes' `share/<pkg>` and the resource paths. |
| Gazebo Fuel URLs | Partly | Offline. Bundled: *Ground Plane*, *Sun*, *Table* (the ones the TB3 / xArm worlds use). Others → `Error Code 14 … Unable to find uri[...]`. |
| `<pose relative_to>`, `degrees`, `rotation_format="quat_xyzw"` | Supported | Cycles and unknown frames give sdformat's Error Codes 26/27. |
| Joint pose in the child frame, `<axis><xyz expressed_in>` | Supported | |
| Joint types revolute, continuous, prismatic, fixed | Supported | revolute without limits = continuous (TB3 wheels). |
| ball, universal, revolute2, screw, gearbox | Partly | ball/universal/revolute2 are passive (unactuated) joints; screw → prismatic, gearbox → revolute (warning printed). |
| `<limit>` lower/upper/effort/velocity, `<dynamics>` damping, `<mimic>` | Supported | Effort and velocity limits are used by the joint dynamics. friction/spring: read, not used. |
| `<inertial>` mass, pose, inertia | Supported | Used for gravity torques, robot mass, dynamic world objects. `auto="true"` inertia: No. |
| Geometry box, cylinder, sphere, plane | Supported | |
| capsule, ellipsoid, cone | Supported | Physics: Rapier capsule/cone, ellipsoid as a convex hull. |
| mesh `.dae` `.stl` `.obj` with `<scale>` | Supported | Parsed in JS (`gz-mesh.js`: DAE unit + node transforms, binary/ASCII STL, OBJ). Static meshes collide as triangle meshes, moving ones as convex hulls; decimated to ≤ 3000 (world) / 600 (robot link) triangles for phones. `<submesh>`: No. |
| heightmap, polyline, image geometry | No | heightmap → flat box of its size (warning). |
| `<material>` ambient/diffuse, `<script>` Gazebo/* names | Partly | Colours only; PBR/texture maps of SDF materials: No (DAE/OBJ embedded materials are used by the renderer). |
| `<surface>` friction mu, restitution | Partly | One friction / bounce per model (Rapier). Contact parameters (kp, kd, soft_cfm), slip, torsional: No. |
| `<static>`, `<self_collide>`, `<gravity>` (link) | Partly | static: Supported. self_collide read; robot self-collision: No. |
| `<light>` (world, link, Fuel Sun) | Partly | Parsed into `world.lights`; the renderer keeps its own sun + ambient. |
| `<scene>` ambient/background/shadows/grid | Partly | Parsed; renderer uses Gazebo's default grey sky. |
| `<physics>` max_step_size, real_time_factor, real_time_update_rate | Supported | Step size used by the physics. Engine-specific blocks (`<ode>`, `<bullet>`, `<dart>`): read, not used. |
| `<gravity>`, `<magnetic_field>` (world) | Supported | |
| `<spherical_coordinates>`, `<atmosphere>`, `<wind>`, `<actor>`, `<population>`, `<road>`, `<state>` | No | |
| Unknown elements | Supported | `Warning [Utils.cc:132] [...]: XML Element[x], child of element[y], not defined in SDF. Copying[x] as children of [y].` from the SDF 1.11 schema (e.g. `<gz_frame_id>` in TB3 sensors, `<gravity>` inside `<physics>` in xarm's table_gz.world). |
| Errors | Supported | sdformat texts + codes: 1 (XML), 2 (duplicate name), 4 (required attribute), 14 (uri), 16, 17 (model without link), 20/21/22 (joint child/parent), 26/27, 38. gz-sim refuses a world with SDF errors (EXIT_IMMEDIATELY), as gz-sim 8 does. |
| URDF → SDF (create -topic/-string/-file with a URDF) | Supported | `urdf2sdf.js`: fixed-joint lumping, massless links dropped with urdf2sdf's Error Code 19 warnings. |
| World without plugins | Supported | gets server.config's Physics, UserCommands, SceneBroadcaster (no Sensors: cameras/lidars stay silent). |

## Systems (plugins)

| System | Status | Notes |
|---|---|---|
| Physics (`gz-sim-physics-system`) | Partly | Rapier: static/dynamic world bodies, robot base as kinematic character controller (walls stop it, light objects get pushed), arm links as kinematic bodies. Arm joints: each joint integrated with the exact static gravity torque of its subtree, subtree inertia about its axis, effort/velocity limits, damping, joint limits (no coupling between joints, no contact forces on the arm). `--physics-engine` is accepted and reported. |
| UserCommands (create / remove / set_pose) | Partly | create (with `allow_renaming`: name_0, name_1 …, UserCommands' warnings); remove/set_pose services listed only. |
| SceneBroadcaster | Partly | `/world/<w>/pose/info`, `/scene/info` listed; the GUI is fed directly. |
| Sensors (render_engine ogre/ogre2) | Supported | Required for camera / depth / rgbd / gpu_lidar, as in gz-sim. |
| Imu, Contact, NavSat, ForceTorque, Magnetometer, Altimeter, AirPressure | Partly | Imu: orientation, angular velocity, gravity + noise. Others: topics exist (names/types right), data simplified or empty. |
| DiffDrive | Supported | topic / odom_topic / tf_topic / frame_id / child_frame_id defaults (`/model/<m>/cmd_vel`, `/model/<m>/odometry`, `/model/<m>/tf`, `<m>/odom`, `<m>/<canonical link>`), wheel_separation 1.0 / wheel_radius 0.2 defaults, odom_publish_frequency, SpeedLimiter (min/max velocity and acceleration; jerk: No), odometry integrated from the wheel joint angles (gz::math::DiffDriveOdometry), missing joints warning. Keeps the last command (no timeout), as gz-sim. |
| MecanumDrive, AckermannSteering, VelocityControl | Partly | Kinematics + odometry; Ackermann steering joints follow the bicycle model. |
| JointStatePublisher | Supported | topic default `/world/<w>/model/<m>/joint_state`, `<joint_name>` list, update_rate. |
| OdometryPublisher | Partly | odom/tf topics and frames, 2D/3D; noise: No. |
| PosePublisher | Partly | Topics (`/model/<m>/pose`, `_static`); message content: model pose only. |
| JointPositionController | Partly | topic `/model/<m>/joint/<j>/<index>/cmd_pos` (or topic / sub_topic), PID force with p/d/cmd_max (i: No), `use_velocity_commands`. |
| JointController (velocity), ApplyJointForce, JointTrajectoryController (gz) | Partly | Topics parsed and listed; JointTrajectoryController follows `initial_position`; their command messages need the coordinator's routing. |
| gz_ros2_control (`gz_ros2_control-system`) | Supported | `<parameters>` controllers yaml, `controller_manager_name`, `hold_joints` (default true), `position_proportional_gain` (0.1): position commands become joint velocity commands `gain × update_rate × (q_cmd − q)` limited by the joint effort, as `gz_system.cpp`. Controllers: see ros2-control.js (JTC, JSB, diff drive, forward command, gripper …). |
| MulticopterMotorModel / MulticopterVelocityControl | Partly | The existing flyer model (VelocityControl in 3D). |
| Gazebo Classic plugins (`libgazebo_ros_*.so`) | Supported (as failure) | Not loaded: `Failed to load system plugin [...] : Could not find shared library.` + hint. |
| Any other gz-sim 8 system | No | Accepted without error when its library name is a gz-sim 8 system; does nothing. Unknown libraries print SystemLoader's error. |

## Sensors

| Sensor | Status | Notes |
|---|---|---|
| gpu_lidar (`gpu_ray`) | Supported | samples, min/max angle, vertical rings, range min/max/resolution, gaussian noise; `inf`/`-inf` outside the range. GUI: three.js raycasts on visuals; headless: Rapier rays on collisions (`gzScan`). LaserScan + PointCloudPacked topics. |
| lidar / ray (CPU) | Supported (as failure) | `Sensor type LIDAR not supported yet. Try using a GPU LIDAR instead.` |
| camera | Supported | width/height/hfov/clip/format; `camera_info_topic`; `gz_frame_id` / `optical_frame_id`. Rendered by three.js (not Ogre2). Image noise: No. |
| depth_camera, rgbd_camera | Partly | Depth by ray grid (64 columns), points, image. |
| imu | Supported | needs the Imu system. |
| contact, navsat, force_torque, magnetometer, altimeter, air_pressure | Partly | Topics and types; data simplified/empty. |
| logical_camera, thermal, segmentation, boundingbox, wide-angle camera, DVL | No | |
| `<always_on>`, `<update_rate>`, `<visualize>`, `<topic>`, `<enable_metrics>` | Partly | update_rate drives `ros2 topic hz`; visualize: lidar rays drawn by the GUI; always_on assumed. |

## Command line

| Command | Status | Notes |
|---|---|---|
| `gz sim [-r] [-s] [-g] [-v [N]] [file]` | Supported | Also `--iterations --initial-sim-time --physics-engine --render-engine[-gui/-server] -z --seed --record* --playback --gui-config --headless-rendering --levels --force-version 8`; invalid option / wrong version errors. World lookup: path, `GZ_SIM_RESOURCE_PATH`, gz-sim's worlds (only `empty.sdf` and `shapes.sdf` are bundled). |
| `gz topic -l / -i -t / -e -t` | Partly | Topic list and types are accurate; `-e` prints a header and the type (not the full message). `-p` (publish): No. |
| `gz service -l` | Partly | create/remove/set_pose/control, `/gazebo/worlds`. `-s ... --req`: No. |
| `gz model --list` | Partly | `-m NAME -p/-l/-j`: No. |
| `gz sdf -k / -p / --inertial-stats` | Partly | `-k` checks (URDF: urdf2sdf warnings twice, "Valid."); `-p`, `--inertial-stats` explained only. |
| `gz log`, `gz fuel`, `gz plugin`, `gz msg` | No | |
| `ros2 run ros_gz_sim create` | Supported | gflags flags (`-world -file -param -string -topic -name -allow_renaming -x -y -z -R -P -Y`, `-flag=value`), ROS parameters (`-p file:=`), create.cpp's messages ("Requesting list of world names.", "Waiting messages on topic […]", "Entity creation successful.", "Must specify either -file, -param, -string or -topic"). SDF and URDF. |
| `ros2 run ros_gz_bridge parameter_bridge` | Supported | `topic@ros_type(@|[|])gz_type`, services, usage on bad arguments, `-p config_file:=`, `-p lazy:=`. Config YAML exactly as bridge_config.cpp (topic_name / ros_topic_name / gz_topic_name, direction, lazy, queues, qos_profile, frame_id, service entries, its error texts). Type pairs from ros_gz_bridge's mappings.py (e.g. TwistStamped ↔ gz.msgs.Twist). |
| `ros2 run ros_gz_image image_bridge` | Partly | Image topics. |
| `ros2 launch ros_gz_sim gz_sim.launch.py` / `ros_gz_spawn_model.launch.py` | Supported | through the real launch files (launch runtime). |

## GUI (gz-gui plugins)

| Plugin | Status | Notes |
|---|---|---|
| 3D scene, play/pause/step, sim/real time, RTF, iterations | Supported | `gz-window.js`. |
| Entity tree | Partly | Names only (no component inspector). |
| Component inspector, transform/translate tools, insert shapes, model/resource spawner, image display, teleop, plotting, world stats panel, video recorder, visualize lidar/contacts/frames/COM/inertia/joints | No | |

## Per robot (official Jazzy workspaces)

| Robot | Launch | What works | Gaps |
|---|---|---|---|
| TurtleBot3 Burger | turtlebot3_world / house / empty | World with mesh collisions (hexagon, walls, house furniture), model.sdf spawned at (-2, -0.5), real bridge yaml (TwistStamped cmd_vel), DiffDrive with acceleration limit, wheel odometry, /tf, JointStatePublisher, IMU, LDS lidar hitting the pillars, walls stop it. | Lidar on visuals in the GUI vs collisions headless (same for these worlds). |
| TurtleBot3 Waffle | same | + camera 1920×1080 (rendered smaller), image_bridge. | |
| UR5e | ur_sim_control.launch.py | `create -string` URDF, gz_ros2_control with ur_controllers.yaml, holds under gravity, scaled_joint_trajectory_controller follows trajectories. | needs `ur_controllers/ScaledJointTrajectoryController` registered (coordinator). |
| Kinova Gen3 | kortex_sim_control.launch.py | create -string, gz-sim-sensors-system in the URDF, JTC, holds pose. `robotiq_gripper_controller` fails as on Ubuntu (this URDF has no gripper). | picknik twist / fault controllers not modeled. |
| xArm6 / Lite 6 | *_beside_table_gazebo, *_moveit_gazebo | table_gz.world (Fuel Table, no plugins → defaults), spawn at the table, launch-generated controllers yaml, JTC. | ros2-control.js readYaml rejects PyYAML's indentless lists (coordinator fix pending; tests re-indent). |
| Dobot CR5 | dobot_gazebo.launch.py | create -topic, cr5_group_controller (JTC) via controller_loader.py, holds pose. | controller_loader.py needs a coordinator model (tests emulate it). |
| Franka FR3 | gazebo_franka_arm_example_controller / visualize | Reproduces the failure: with the pinned franka_ros2 + franka_description commits the URDF has two root links (`world`, `base`), which urdfdom rejects; visualize launch has no gz_ros2_control. | franka_example_controllers not modeled. |
