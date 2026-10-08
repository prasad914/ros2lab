# ROS2Lab update V18: controllers that load, sensors that update, MoveIt 2 for every arm, and real robots

This package contains **everything from V13 to V17** plus the changes below. Unzip it over your project folder, as before.

Everything below was tested twice:
- in the browser (the RViz page, driven by an automated browser);
- with the **real ROS 2 Jazzy, Gazebo Harmonic 8 and MoveIt 2**: the generated packages were built with `colcon`, launched, driven and planned with.

## What was wrong, and what changed

**1. Controllers that did not load, robots that did not move, sensors that stayed silent**

Running the packages from the RViz page on a real Ubuntu 24.04 + Jazzy computer showed three real bugs. They are fixed in the generated files, and the practice terminal now behaves the same way.

| Problem | Cause (seen in real Gazebo / ros2_control) | Fix |
|---|---|---|
| `diff_drive_controller` (or the arm controller) never loaded | `sim_control.launch.py` started two `spawner` processes at the same time. On Jazzy they compete for the spawner lock: *"Failed to acquire lock after multiple attempts"*, and one controller is never loaded. | One spawner loads all the controllers: `spawner joint_state_broadcaster diff_drive_controller --controller-manager-timeout 120` |
| Gazebo showed an empty world, no sensor published, no controller_manager started | The worlds `<include>`d *Sun* and *Ground Plane* from fuel.gazebosim.org. Without internet (robot computers, lab networks) the whole world failed to load (*"Error Code 14"*). | The sun and the ground are written into the world file. |
| The robot was invisible in Gazebo, and lidar/camera rays went through it | Gazebo could not find `model://<package>/meshes/...` | The launch files set `GZ_SIM_RESOURCE_PATH` (`AppendEnvironmentVariable` / `<set_env>`). |

**Other changes to driving:**
- **Robots stop at obstacles:** the robots now stop at walls and boxes, as Gazebo's physics would make them. Before, they drove through them.
- **The full `teleop_twist_keyboard` key map:** Shift + U I O J K L M < > strafe (for mecanum robots), and `t` / `b` go up and down (for drones). The keys are also shown as buttons.

**2. A simulation for every robot**

| Robot | Gazebo systems | Sensors |
|---|---|---|
| TurtleBot3 Burger / Waffle | DiffDrive, or ros2_control diff_drive_controller | LDS-01 lidar, IMU (Waffle: camera) |
| AgileX Scout V2 (new) | skid steering: DiffDrive with 2 wheels per side, or diff_drive_controller | IMU |
| Unitree Go2, G1, H1 | VelocityControl + OdometryPublisher | L1 / MID-360 lidar, cameras, IMU |
| Boston Dynamics Spot (new) | VelocityControl + OdometryPublisher | IMU, front depth camera |
| Bitcraze Crazyflie (new) | VelocityControl in 3-D (it flies: t / b); the URDF now has the real mass and inertia | IMU |
| Kinova Gen3 | JointPositionController, or joint_trajectory_controller | wrist RGB-D camera |
| The course robots without a hand-written simulation (Chiku, Chiku with meshes, mecanum, Ackermann, quadruped, hexapod, humanoid, quadcopter, mobile and legged manipulators) | read from their URDF: wheel joints → DiffDrive (or MecanumDrive / AckermannSteering), legs → walking body, propellers → flying body | links named lidar/laser/scan, camera and imu get a lidar (LDS-01-like), a camera and an IMU |

- **Scout's wheels:** the Scout's wheel joints are now `continuous`; in the generated description they were `fixed`.
- **Dobot Magician:** its URDF limits are corrected. The parallel-link mimic joints had `[0, 2π]` with multiplier −1, and the right jaw had `lower > upper`.
- **RViz:** the displays update while the robot drives (LaserScan, PointCloud2, Image, Imu, Odometry). This was checked with each robot.

**3. MoveIt 2 for every arm (UR5e, Franka FR3, Kinova Gen3, xArm 6, Lite 6, Dobot CR5, Dobot Magician, SO-101, WidowX 250 6DOF, ABB IRB 120, KUKA KR 6, FANUC LR Mate, and the course's 3-DOF and 6-DOF arms)**

Each arm gets a second package next to its description: **`<robot>_moveit_config`**. It is laid out exactly like the MoveIt Setup Assistant output, so it runs unchanged with `ros-jazzy-moveit`:
- `config/<robot>.srdf`:
  - the planning group (a chain to the tool) and the gripper group;
  - the named states `home` and `ready` (plus `open` and `close` for grippers);
  - the end effector;
  - the self-collision matrix, computed like the Setup Assistant does it (adjacent links, links touching at the named poses, and links never in collision in 3,000 random poses of the robot's real meshes).
- `config/kinematics.yaml` (KDL; arms with fewer than 6 joints use `position_only_ik`).
- `config/joint_limits.yaml` (velocity **and acceleration**: Pilz and the time parameterization need both). `config/pilz_cartesian_limits.yaml`.
- **Four planning pipelines:** `ompl_planning.yaml` (RRTConnect by default, and every OMPL planner), `pilz_industrial_motion_planner_planning.yaml` (PTP, LIN, CIRC), `chomp_planning.yaml`, `stomp_planning.yaml`. The keys are the ones in `moveit_configs_utils/default_configs` of Jazzy.
- **ros2_control:**
  - `config/<robot>.ros2_control.xacro` with `hardware:=mock | gazebo` (SO-101 also `feetech`).
  - `config/ros2_controllers.yaml`: the `arm_controller` / `gripper_controller` joint trajectory controllers.
  - `config/moveit_controllers.yaml`.
- `config/moveit.rviz`: RViz with the **MotionPlanning** display.
- **Launch files:**
  - `launch/demo.launch.py` (mock hardware) and the standard MoveIt launch files.
  - `launch/gazebo.launch.py`: Gazebo + gz_ros2_control + MoveIt, in a work cell.
  - `launch/real.launch.py`: the real robot.
- **The work cell:**
  - `worlds/<robot>_moveit.sdf` holds a table, a box on it and a post, sized to the arm's reach and kept clear of its home pose.
  - `scripts/add_scene_objects.py` puts the same obstacles into MoveIt's planning scene.

**In the browser (RViz page → step 3 → "MoveIt 2, mock hardware" or "Gazebo + MoveIt 2"):**
- `ros2 launch <robot>_moveit_config demo.launch.py` starts robot_state_publisher, move_group, ros2_control_node and the spawner, and opens RViz with the **MotionPlanning panel**:
  - **Context:** choose the planning pipeline (ompl, pilz_industrial_motion_planner, chomp, stomp) and the planner (RRTConnect, RRTstar, PRM … / PTP, LIN, CIRC).
  - **Planning:** Plan, Execute, Plan & Execute, Stop, Clear; the start and goal states (current, random valid, home, ready …); planning time, attempts, velocity and acceleration scaling.
  - **Joints:** the goal state's joint sliders.
  - **Scene Objects:** add or remove boxes, spheres and cylinders.
  - **Status:** the move_group log.
- **The goal:** drag the orange **interactive marker** at the tool. Inverse kinematics moves the orange goal robot, and colliding links turn red.
- **The planned path** is animated in purple (Loop Animation, Show Trail).
- **Execute:** the trajectory goes to `arm_controller` (mock hardware or Gazebo) and the robot moves.
- **The planners and the scene objects:**
  - OMPL and STOMP go around them.
  - CHOMP usually goes around them too. When the obstacle is close to the start, it can fail with *"Chomp path is not collision free!"*, as the real CHOMP does. Then use OMPL.
  - Pilz does not avoid obstacles, as in real MoveIt: a PTP or LIN motion that would hit something is rejected (FAILURE, *"Found a contact between …"*).
- **Results checked with the real move_group** for all 12 vendor arms (mock hardware, obstacles added; home ↔ ready with OMPL RRTConnect and RRTstar, Pilz PTP, CHOMP, STOMP, executed on the controller): see "Verification" below.

**4. Real robots over USB, Ethernet, CAN or Wi-Fi**

- **Arms:** `ros2 launch <robot>_moveit_config real.launch.py` runs MoveIt with the controller of the maker's driver (`moveit_controllers_real.yaml`). The package README lists the driver, the install command, the connection and the command:

| Arm | Driver (Jazzy) | Connection | MoveIt sends to |
|---|---|---|---|
| UR5e | ur_robot_driver (`sudo apt install ros-jazzy-ur`) | Ethernet + External Control URCap | scaled_joint_trajectory_controller |
| Franka FR3 | franka_ros2 (jazzy, source) | Ethernet, FCI, RT kernel | fr3_arm_controller |
| Kinova Gen3 | kortex_bringup (`ros-jazzy-kortex-bringup`) | Ethernet 192.168.1.10 | joint_trajectory_controller |
| xArm 6 / Lite 6 | xarm_ros2 (jazzy, source) | Ethernet | xarm6_traj_controller / lite6_traj_controller |
| Dobot CR5 | DOBOT_6Axis_ROS2_V4 (jazzy) | Ethernet 192.168.5.1 | cr5_group_controller |
| SO-101 | feetech_ros2_driver (`ros-jazzy-feetech-ros2-driver`) | USB /dev/ttyACM0 | arm_controller (this package runs ros2_control: `real.launch.py usb_port:=/dev/ttyACM0`) |
| WidowX 250s | interbotix (jazzy branches, source) | USB U2D2 /dev/ttyDXL | wx250s/arm_controller |
| ABB IRB 120 | abb_ros2 (source) | Ethernet, EGM | joint_trajectory_controller |
| KUKA KR 6 | kuka_drivers (`ros-jazzy-kuka-drivers`) | Ethernet RSI | joint_trajectory_controller |
| FANUC LR Mate 200iD | fanuc_driver (source) | Ethernet | joint_trajectory_controller |
| Dobot Magician | magician_ros2 (Humble upstream) | USB /dev/ttyUSB0 | (no FollowJointTrajectory: MoveIt plans only) |

- **Mobile robots, legged robots and drones:** `ros2 launch <description> real.launch.py` starts the maker's driver and RViz with the simulation's displays. `REAL_ROBOT.md` in the package gives:
  - the install command, the connection, the udev or network setup, and the teleop command;
  - for TurtleBot3, the Jazzy detail: `/cmd_vel` is a TwistStamped.
- **New button "Download this workspace (.zip)":**
  - It saves `~/ros2_ws/src` as it is in the practice terminal: your edits from the practice VS Code, the meshes, and executable scripts.
  - The zip includes a README.
  - On Ubuntu 24.04 + Jazzy: `rosdep install --from-paths src --ignore-src -r -y && colcon build`.
- **`tools/export-ws.mjs --per-robot <folder>`** writes one ready-to-build workspace per gallery robot, with the same files the page generates.

## Verification (what was run)

- **Real ROS 2 Jazzy:**
  - `colcon build` of all 30 generated packages: OK.
  - `xacro` + `check_urdf` of all 58 description variants (display, sim, sim_control, MoveIt mock and Gazebo): OK.
  - TurtleBot3 `sim_control.launch.py` in Gazebo Harmonic 8.10: both controllers active, LDS-01 360 ranges, IMU about 9.81 m/s², the robot drives on `/diff_drive_controller/cmd_vel`, and `odom → base_footprint` follows.
  - Scout `sim.launch.py`: drives, 4 wheels turn, IMU publishes.
  - MoveIt (move_group with the generated configs, `demo.launch.py`):
    - All four pipelines plan.
    - Plans execute on `arm_controller`.
    - The scene objects are added.
    - A goal inside the table is rejected (`GOAL_STATE_INVALID`), and Pilz motions through obstacles are rejected (`INVALID_MOTION_PLAN`).
  - UR5e `gazebo.launch.py`: gz_ros2_control + MoveIt in Gazebo, trajectories executed in Gazebo.
- **Browser:**
  - Teleop and sensors: TurtleBot3, Scout, Go2, G1, H1, Spot, Crazyflie and Chiku in `sim` and `sim_control`.
  - MoveIt: the 12 vendor arms in `demo` and `gazebo`.
- **An independent check** (a separate test run on both the browser and the real ROS 2 install) confirmed:
  - teleop and RViz sensor data for TurtleBot3, Scout, Go2, Spot and Crazyflie;
  - MoveIt plan + execute with all four pipelines in the browser and with the real move_group;
  - interactive-marker dragging with the mouse.

  The problems it found are fixed in this package:
  - the Odometry display in ros2_control mode;
  - STOMP near small obstacles;
  - the Pilz result code;
  - Pilz trajectories with too many points;
  - the CMake version warning;
  - KR 6 and LR Mate ready poses that were too close to home.
- **Real move_group, all 12 vendor arms:** OMPL RRTConnect and RRTstar, Pilz PTP, CHOMP and STOMP plan and execute home ↔ ready with the work cell's obstacles in the scene.
  - Pilz LIN also succeeds where the straight tool path is reachable. Elsewhere it fails, as it should.
  - This run found, and V18 fixes:
    - an integer joint limit that crashed move_group;
    - the Dobot Magician URDF's mimic and jaw limits, which made every start state invalid;
    - the Crazyflie URDF without inertia, which Gazebo drops.
- **Lessons:** `node tools/check-content.mjs` gives the same result as V17. No lesson changed behaviour.
- **Known limits:**
  - The Unitree robots and Spot move their body with VelocityControl; their legs do not step.
  - Physics is simplified in the browser: robots stop at obstacles, but they do not fall.

## Publish

1. Unzip the package over your project folder (`C:\ros2lab-course`) and say **Yes** to replace files.
2. Optional checks:
   - `node tools\check-content.mjs`
   - `node tools\test-moveit.mjs`: plans with every pipeline for every arm, without a browser.
3. `firebase deploy --only hosting`
4. Open www.ros2lab.com/rviz.html, press **Ctrl + F5**, and try:
   1. **TurtleBot3 Burger** → **Gazebo + ros2_control** → **Type these commands for me**. Then in **+ New terminal**: `ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true -r cmd_vel:=/diff_drive_controller/cmd_vel`.
   2. **Universal Robots UR5e** → **Gazebo + MoveIt 2** → **Type these commands for me**. In RViz, drag the orange marker, choose a pipeline in **Context**, then **Plan & Execute**.

## New and changed files

| File | What it is |
|---|---|
| `public/js/moveit-core.js` | Kinematics, KDL-style IK, collision spheres from the meshes, SRDF collision matrix, OMPL / Pilz / CHOMP / STOMP planners, time parameterization |
| `public/js/moveit-config.js` | Writes the `<robot>_moveit_config` package |
| `public/js/ros-moveit.js` | move_group, mock ros2_control and the MoveIt launch files in the practice terminal |
| `public/js/moveit-rviz.js` | RViz's MotionPlanning display and panel |
| `public/js/real-robot.js` | `real.launch.py` and `REAL_ROBOT.md` for the mobile, legged and flying robots |
| `public/js/zip.js` | The workspace download |
| `public/robots/moveit/<robot>.json` | Each arm's collision spheres and collision matrix (from `tools/moveit-precompute.mjs`) |
| `tools/export-ws.mjs`, `tools/test-moveit.mjs`, `tools/moveit-precompute.mjs` | Export the workspaces; test and prepare MoveIt |
| `public/js/rviz-sim.js`, `ros-gz.js`, `gz-sdf.js`, `ros-graph.js`, `ros-control-graph.js`, `rviz.js`, `rviz-pkg.js`, `rviz-page.js`, `terminal-sim.js`, `urdf-core.js`, `rviz.html`, `css/rviz.css`, `robots/index.json`, `robots/scout_description/urdf/scout_v2.urdf` | The fixes and features above |
