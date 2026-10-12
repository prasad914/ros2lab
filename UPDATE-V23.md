# ROS2Lab update V23: the makers' real ROS 2 Jazzy workspaces, real launch files, Nav2, SLAM and MoveIt 2

V23 includes everything in V22 (security, admin visitor count, deleted accounts, playground). Lessons, tests and
`content/` are unchanged. If you have not deployed V22 yet, follow its steps too (`UPDATE-V22.md`: run
`tools/v22-remove-old-files.sh` and complete the Firebase console settings).

## What is new

### The makers' own workspaces, from GitHub

These robots now use their manufacturer's official ROS 2 Jazzy repositories, cloned at pinned commits. The packages
are unmodified. Each robot page lists the repositories with links to the exact commit.

| Robot | Repositories (branch) | What runs on the page |
|---|---|---|
| TurtleBot3 Burger / Waffle | ROBOTIS turtlebot3, turtlebot3_simulations, turtlebot3_msgs (jazzy), plus DynamixelSDK and lidar drivers | Gazebo worlds (TurtleBot3 World, House, empty), teleop_keyboard, Cartographer SLAM, map saver, Nav2 (AMCL, costmaps, planner, DWB controller, behavior tree navigator, recoveries), the RViz configs |
| UR5e | Universal_Robots_ROS2_Description, _GZ_Simulation, _Driver (jazzy) | Gazebo with gz_ros2_control (`ur_sim_control`), Gazebo + MoveIt 2 (`ur_sim_moveit`), `ur_control.launch.py use_mock_hardware:=true` (all of UR's controllers, active and inactive, as on Ubuntu), view_ur |
| Franka FR3 | franka_description, franka_ros2 (jazzy) | MoveIt 2 with fake hardware (plan and execute checked), robot view. The Gazebo example fails exactly as it does upstream (the URDF has two root links) |
| Kinova Gen3 | ros2_kortex (jazzy), ros2_robotiq_gripper | Gazebo + ros2_control, MoveIt 2 with fake hardware, MoveIt 2 for the Gazebo arm (start Gazebo first, as Kinova's README says), robot view. In Gazebo the gripper controller fails to activate, as upstream (the simulation URDF has no gripper) |
| UFACTORY xArm6 / Lite 6 | xarm_ros2 (jazzy) | Gazebo beside the table (add `load_controller:=true` to start the controllers, as on Ubuntu), MoveIt 2 fake and in Gazebo |
| Interbotix WX250s | interbotix_ros_manipulators / core / toolboxes (jazzy) | MoveIt 2 with fake hardware (controllers in the `/wx250s` namespace), robot view. There is no Gazebo launch for Jazzy upstream |
| Dobot CR5 | DOBOT_6Axis_ROS2_V4 (jazzy) | Gazebo, and Gazebo + MoveIt 2 with Dobot's own controller loader |
| Crazyflie | crazyswarm2 (main, built for Jazzy) | The launch starts, but crazyswarm2's own simulator is not modelled (there is no official Gazebo Harmonic path) |
| AgileX Scout | scout_ros2 (jazzy) | Robot description only. The upstream mesh paths are broken |

No official ROS 2 Jazzy repository exists for the other gallery robots (Unitree Go2 / G1 / H1, Spot, the ABB, KUKA
and FANUC arms, Dobot Magician, SO-101), so they keep their ROS2Lab practice packages. The catalog marks robots with
an official workspace "Official Jazzy workspace". The course robots (arm3, chiku and the rest) are unchanged.

### The real launch files run unmodified

`ros2 launch` and `ros2 run` for these robots go through the **real ROS 2 Jazzy `launch`, `launch_ros` and
`ros2launch` libraries**. They run in the browser with Pyodide, in a Web Worker.

- **What prints the output.** The launch libraries print it themselves, as on Ubuntu: `process started with pid`,
  `process has finished cleanly`, missing-argument errors and the Ctrl+C shutdown sequence.
- **The robot description.** xacro is the real xacro, and so is `MoveItConfigsBuilder`.
- **Launch features.** Event handlers (OnProcessExit chains), composition (Nav2's `component_container_isolated`),
  lifecycle nodes, XML and YAML launch files and `-s/--show-args` all work.
- **The programs themselves.** Each program the launch starts is handed to the website's model of that program:
  - Gazebo (`gz sim`, `ros_gz_sim create`, `ros_gz_bridge`)
  - `robot_state_publisher`, `rviz2 -d <file>`
  - `controller_manager` (`ros2_control_node`, spawner, gz_ros2_control)
  - Nav2, slam_toolbox / Cartographer and the map saver
  - MoveIt 2's `move_group`, which gets the real parameters
- **Programs with no model.** These say so in the terminal.
- **Drivers for real robots.** They print what the real driver prints when no robot is connected.

`/opt/ros/jazzy` on the practice computer holds the real installed files of the Jazzy packages the launch files use,
such as `nav2_bringup` params and behaviour trees, `ros_gz_sim` and `moveit_configs_utils`. `cat` and `ls` show
them. Their sources and commits are listed in `public/ros/jazzy/SOURCES.json`.

### The same code on Ubuntu

Each robot page has "The same workspace on your Ubuntu 24.04 computer": `vcs import` of the robot's `.repos` file
(the same pinned commits), `rosdep install`, `colcon build`, and the same `ros2 launch` commands. Students run on the
page exactly the commands they will run on Ubuntu, including the maker's own steps such as
`export TURTLEBOT3_MODEL=burger`.

### A separate real-hardware button

Repositories that include a driver for the real robot (TurtleBot3, UR, Franka, Kinova, xArm, Interbotix, Dobot,
Crazyflie) show a separate **Real hardware** button, for example `ros2 launch turtlebot3_bringup robot.launch.py` or
`ur_control.launch.py robot_ip:=...`.

- **The license gate.** These commands need the course administrator's hardware license (the V20 license system).
  Typed commands are checked the same way. Commands with `use_mock_hardware:=true`, `use_fake_hardware:=true`,
  `hardware_type:=fake` or `backend:=sim` count as simulation and need no license.
- **The robot itself.** A browser cannot reach a USB or Ethernet robot. With a license, run the command on the Ubuntu
  computer the robot is connected to and use "Connect to ROS 2 on your Ubuntu computer" to see it on the page.

### Gazebo (closer to Gazebo Harmonic)

- **Native SDF.** Worlds and models load natively (SDF 1.4–1.11): `<include>`, `model://` through
  `GZ_SIM_RESOURCE_PATH` (which the launch files set), `package://`, frames and nested models.
- **Real error and warning texts.** sdformat's Error Codes and gz-sim's own messages.
- **Mesh collisions.** The TurtleBot3 World pillars and hexagon wall are triangle meshes; moving parts use convex
  hulls.
- **More systems.** DiffDrive with its speed limits and wheel odometry, JointStatePublisher, OdometryPublisher, the
  real `ros_gz_bridge` YAML format (including TwistStamped ↔ gz.msgs.Twist), and gz_ros2_control with the makers'
  controllers files. Arms hold their pose under gravity with effort and velocity limits.
- **The command lines.** `gz sim`, `ros_gz_sim create` and the bridge read their arguments like the real ones.
- **Coverage.** `docs/GAZEBO-COVERAGE.md` lists every Gazebo Harmonic feature as Supported, Partly or Not
  supported. Not modelled: heightmaps, actors, and most GUI plugins.

### RViz2

- **Real configs.** The makers' `.rviz` files load as they are: `tb3_navigation2.rviz`, `nav2_default_view.rviz`,
  `tb3_cartographer.rviz` and the MoveIt configs. The toolbar and panels follow the file.
- **New displays.** Map (map, costmap and raw palettes), Path, PoseArray, Nav2's ParticleCloud, Polygon (footprints),
  Pose and PoseWithCovariance.
- **New tools and panel.** The Nav2 Goal tool and the Navigation 2 panel (status, Startup / Pause / Reset, waypoint
  mode).
- **Missing plugins.** A plugin that isn't installed shows RViz2's own error message.
- **Coverage.** `docs/RVIZ2-COVERAGE.md` lists what is Supported, Partly or Not.

### Nav2 and SLAM (Jazzy behaviour, from the real parameter files)

Nav2 and SLAM run as ROS2Lab models that read the real parameter files (`burger.yaml`, `waffle.yaml`,
`nav2_params.yaml`) and follow Jazzy's behaviour.

- **Bring-up.** The lifecycle manager prints the real bring-up lines. AMCL waits for `/initialpose` and then
  localizes with a particle filter.
- **Costmaps.** Static, obstacle and inflation layers.
- **Planning and control.** NavFn, Smac 2D or Theta* planners, and DWB or Regulated Pure Pursuit controllers.
- **Velocity chain.** The velocity smoother and collision monitor sit between the controller and Gazebo.
- **Actions.** The behavior-tree navigator serves `navigate_to_pose` / `navigate_through_poses` with real feedback,
  error codes and recoveries (spin, backup, wait), plus the waypoint follower.
- **SLAM.** slam_toolbox and Cartographer build the map from the simulated lidar. They use Gazebo's true motion plus
  a little noise, not real scan matching. `map_saver_cli` writes `~/map.yaml` and `~/map.pgm`.

### MoveIt 2 with the makers' configuration

`move_group` gets the real `MoveItConfigsBuilder` parameters: SRDF, kinematics, joint limits, planning pipelines and
controllers.

- **Executing plans.** Plans run on Gazebo's gz_ros2_control or on the mock / fake hardware the makers' launch files
  start.
- **Collision checking.** Collisions use spheres fitted to the meshes. Link pairs that only touch in that sphere model
  at the start pose are left out of the check, and the log says so.

## Files

- **New**
  - `public/js/real-launch.js` (workspace loading, colcon, program models), `public/js/launch-runtime.js`,
    `public/js/launch-worker.js`, `public/js/unzip.js`
  - `public/js/nav2-core.js`, `public/js/nav2-sim.js`, `public/js/slam-sim.js`
  - `public/js/gz-sdformat.js`, `public/js/gz-cli.js`, `public/js/gz-mesh.js`, `public/js/gz-sdf-schema.js`
  - `public/robots/ws/**` (the workspaces, about 114 MB, mostly the makers' original meshes)
  - `public/ros/jazzy/**` (the Jazzy package index and share files) and `public/ros/launch-runtime/**` (the Python
    launch system, 0.8 MB)
  - `docs/GAZEBO-COVERAGE.md`, `docs/RVIZ2-COVERAGE.md`
  - Tools: `tools/fetch-workspaces.mjs`, `tools/build-ros-share.mjs`, `tools/build-launch-runtime.mjs`,
    `tools/build-ws-bundles.mjs`, `tools/launch-runtime-py/`
  - Tests: `tests/real-*.mjs`, `tests/nav2*.mjs`, `tests/gz-real-*.mjs`, `tests/sdf-native.mjs`, `tests/gz-cli.mjs`,
    `tests/launch-runtime.mjs`, `tests/workspaces*.mjs`
- **Changed:** `rviz.html`, `rviz-page.js`, `terminal-sim.js`, `ros-graph.js`, `ros-gz.js`, `gz-physics.js`,
  `gz-sim.js`, `gz-sdf.js`, `ros2-control.js`, `ros-control-graph.js`, `ros-moveit.js`, `rviz.js`, `sim-catalog.js`,
  `css/sim.css`, `css/rviz.css`, `THIRD_PARTY.md`, `public/THIRD_PARTY.txt`.
- **Licences:** all the bundled repositories are Apache-2.0 or BSD-3-Clause. Each package keeps its LICENSE file, and
  the commits are in `THIRD_PARTY.md`, each `workspace.json` and the `.repos` files.

## Deploy

1. Copy the files of this update over the project (same paths). If you did not run V22's removal script, run
   `bash tools/v22-remove-old-files.sh`.
2. `firebase deploy --only hosting`. If V22 is not deployed yet, use
   `firebase deploy --only hosting,functions,firestore:rules,firestore:indexes,storage`.
3. The first launch on a robot page downloads about 7 MB (Pyodide from cdn.jsdelivr.net, which the CSP already
   allows, plus the launch system). Later launches reuse it.

## Checks I ran

All with the site on http://localhost:8080 in Chromium:

- `node tests/real-tb3.mjs`: colcon build of the 18 ROBOTIS packages, the real `turtlebot3_world.launch.py`, the robot
  spawned in the TurtleBot3 World, and `turtlebot3_teleop teleop_keyboard` (w/x/a/d) driving it.
- `node tests/real-tb3-nav.mjs`:
  - Cartographer: the map grows while driving; `map_saver_cli` writes `~/map.yaml` and `~/map.pgm`.
  - Nav2 through the real `navigation2.launch.py`, with composition: bring-up, AMCL localizes after `/initialpose`,
    and NavigateToPose around the pillars ends with SUCCEEDED, with feedback.
- `node tests/real-moveit.mjs <robot> "<launch>"`: MoveIt 2 plans a joint goal with the makers' configuration and
  executes it; the arm reaches the goal. All seven arms pass:
  - In Gazebo: UR5e (`ur_sim_moveit`), xArm Lite 6 (`lite6_moveit_gazebo`), Dobot CR5 (`dobot_gazebo sim`).
  - With fake hardware: Franka FR3, Kinova Gen3, xArm6, Interbotix WX250s.
- `node tests/real-sweep.mjs`: every simulation entry of every workspace (48). 45 run cleanly. The other 3 fail
  exactly as they do upstream: FR3's two Gazebo launches and Gen3's gripper controller in Gazebo.
- Unchanged and passing:
  - `node tests/sweep.mjs` (the 32 gallery robots)
  - the physics and Gazebo tests (`physics.test`, `gz-real-node`, `sdf-native`, `gz-cli`, `wall.mjs`)
  - `nav2-node`, `workspaces.mjs` (1209 checks), the launch-runtime tests
  - the game tests, `tools/security-check.mjs` and the Cloud Function tests

## Known limits

- The Python launch system runs Python 3.14 in the browser; Ubuntu 24.04 has 3.12. lxml is replaced by an
  xml.etree shim.
- Running two launches at once loads a second copy of the launch system (about 3 s). At most 6 at a time.
- Not modelled (the terminal says so):
  - turtlebot3_fake_node
  - crazyswarm2's simulator and joystick teleop
  - Interbotix `xs_sdk` in fake mode
  - Nav2's docking and route servers
- SLAM uses the simulated robot's true motion plus noise, not scan matching.
- MoveIt plans with OMPL, Pilz, CHOMP and STOMP; other pipelines are noted in the log.
