# ROS2Lab update V20: a real ROS 2 terminal, the Goal Pose window, physics in Gazebo, real-hardware packages, a new look

V20 contains everything from V19 plus the changes below. The course content (lessons, tests, `content/`) is unchanged.
Every change was tested in an automated browser and, where it makes ROS files or C++, against a ROS 2 Jazzy source
build (rclcpp, ros2_control 4.49, ros2_controllers 4.43, xacro, rclpy, nav2_msgs). An independent review agent then
checked the whole change set; the 16 problems it found are fixed (last section).

This copy of the project had no course robot files (arm3, arm6, chiku, ...), no `modes.js`, `playground.js`,
`project.js`, `engine.js`, `projects.js` or the real `fb.js` / `guard.js`. Those files are not in this update and are
not changed by it. The course robots were tested with stand-in URDFs; please run the checks in "After you deploy" on
the real ones.

## The terminal behaves like a ROS 2 Jazzy terminal

- `~/.bashrc` sources `/opt/ros/jazzy/setup.bash`, the colcon argcomplete hook and `~/ros2_ws/install/setup.bash` when
  it exists, and registers `register-python-argcomplete3 ros2`. `complete -p`, `alias`, `type`, `eval` work.
- **Tab and double Tab** complete like bash with argcomplete: verbs, packages, executables, launch files, launch
  arguments, topics, services, actions, nodes, interface types, and the YAML message template after a type
  (`ros2 topic pub /cmd_vel geometry_msgs/msg/Twist <Tab>`). colcon options and package names complete too.
  A second Tab lists the choices in columns, with the bell.
- **The real interface definitions** of Jazzy (543 messages, services and actions from common_interfaces,
  rcl_interfaces, geometry2, control_msgs, moveit_msgs, nav2_msgs, ros2_control, vision_msgs and others) drive
  `ros2 interface show/proto/list/package/packages`, the YAML checks of `topic pub`, `service call` and
  `action send_goal`, and the Python-style echo of what was published. Wrong fields fail with ros2cli's own message
  (`Failed to populate field: 'Vector3' object has no attribute 'q'`).
- `ros2 topic pub` moves every robot: `geometry_msgs/msg/Twist` on `/cmd_vel` (Gazebo DiffDrive, mecanum, legged,
  drones), `TwistStamped` on the ros2_control controllers. `-t/--times`, `--once`, `-r` work.
- MoveIt services from the terminal: `/compute_fk`, `/compute_ik`, `/check_state_validity`, `/get_planning_scene`,
  `/apply_planning_scene`, `/compute_cartesian_path`, and `/collision_object`.
- **ros2_control without Gazebo:** a launch file with `controller_manager ros2_control_node` now runs. With
  `mock_components/GenericSystem` the controllers really work: `diff_drive_controller`, `mecanum_drive_controller`,
  `ackermann_steering_controller` (Jazzy's `traction_joints_names` / `steering_joints_names`),
  `joint_trajectory_controller`, `joint_state_broadcaster`, `imu_sensor_broadcaster`; odometry, `/tf`
  (with `--controller-ros-args "-r ~/tf_odometry:=/tf"`), `ros2 control list_*`. With a real driver plugin and no
  robot attached it fails exactly like Jazzy does (`Failed to 'configure' hardware`, then
  `terminate called ... Failed to set the initial state of the component`). The log lines were copied from a real run.
- The makers' mock switches (`use_mock_hardware:=true`, `use_fake_hardware:=true`) run without a hardware license.
- xacro in the browser: block parameters (`*block`, `**block`, `<xacro:insert_block>`), Python's `a if c else b` and
  `not`, with Python's precedence.

## The Goal Pose window (`goal_pose_gui`, like joint_state_publisher_gui)

`ros2 run goal_pose_gui goal_pose_gui` opens a separate window for any robot:

- Arms with MoveIt: a pose (x y z, roll pitch yaw), joint values, pipeline and planner, Plan / Execute / Stop.
- Arms without MoveIt: joint values sent as a `JointTrajectory`.
- Mobile, legged and flying robots: a goal (x, y, yaw, and z for drones) and velocity sliders (10 Hz), Take off / Land.
- `ros2 run goal_pose_gui pose_follower` drives the robot to `/goal_pose` or to a `nav2_msgs/action/NavigateToPose`
  goal: differential, holonomic, legged, flying, and car-like robots (a car rolls while it steers and never turns on
  the spot).

It is a real ROS 2 package (`hardware/src/goal_pose_gui`: rclpy, python_qt_binding), the same files in every robot's
workspace. Verified on real Jazzy: the follower drove the mock chiku to a NavigateToPose goal (`SUCCEEDED`).

## VS Code

Shows every package of the workspace (description, gazebo, bringup, moveit_config, goal_pose_gui, ros2lab_hardware),
with a maximize button, a working minimap, and a faint watermark with the signed-in student's email.

## Gazebo

- **Physics:** the Rapier engine (Apache-2.0, `public/vendor/rapier`): gravity, collisions, robots stopped by walls,
  loose objects (the orange ball, a new cardboard box) pushed by the robot, mass, friction and restitution from the
  SDF. It is not Gazebo's DART engine; contacts differ in detail.
- **Rendering:** physically based materials, soft shadows, image-based light, ACES tone mapping, and a
  "Graphics: High / Standard" switch for slow computers.

## Every robot: fake hardware, Gazebo and the real robot from one argument

`ros2 launch <robot>_bringup bringup.launch.py hardware_type:=mock|gz|real` (only the choices the robot has).

- Arms: `mock` runs the MoveIt demo (mock_components).
- TurtleBot3, Scout, Go2, Spot, G1, H1: new `mock.launch.py` with a mock `<ros2_control>` block and controllers
  (their makers' drivers have no mock mode). Verified on real Jazzy (Scout, Go2, TurtleBot3, mecanum).
- **The course robots** get a `<robot>_bringup` package for the robot the student builds: an ESP32 or Arduino Mega
  board with the ROS2Lab bridge firmware, and a Jetson running ros2_control with `ros2lab_hardware/BridgeSystem`.
  It contains the ros2_control xacro (`hardware_type:=mock|gz|real`), controllers, `mock.launch.py`,
  `real.launch.py` (USB or Wi-Fi), the firmware sketch with this robot's `robot_config.h`, and the wiring table.
  `real` needs the hardware license, as before.

## Real hardware (`hardware/`, for course staff; not served to students)

- `src/ros2lab_hardware`: the C++ ros2_control driver (serial and UDP transports, a CRC-checked framed protocol,
  joint position/velocity commands, passive joints, IMU), the `bridge_probe` bench tool, the
  `ros2lab_robot_setup` generator (URDF → ros2_control xacro, controllers, `robot_config.h`, wiring), udev rules,
  `bridge.launch.py`. **Built and tested on Jazzy:** 13 gtests, and end to end against the real firmware core on a
  pseudo-terminal: diff drive, mecanum and Ackermann (with passive front wheels) moved and published odometry; IMU
  published; no board / wrong joint count / lost board refused correctly.
- `firmware/ros2lab_bridge`: ESP32 (USB and Wi-Fi) and Arduino Mega 2560 (USB, 500000 baud): hobby servos on pins or
  PCA9685 boards, Feetech STS3215 bus servos, DC motors with encoders and PID (TB6612FNG, L298N, BTS7960), MPU-6050
  and BNO055, a 500 ms watchdog. The Mega build compiles with avr-gcc with no warnings; the ESP32 build was checked
  only against host stand-ins; flash one board before relying on it.
- `jetson/`: `setup_jetson.sh` (JetPack 7 = Ubuntu 24.04, ROS 2 Jazzy from apt, Cyclone DDS, udev, dialout),
  `jazzy_container.sh` (JetPack 6), `ros2lab-bringup.service` (start at boot).
- `vendor.repos` / `humble.repos`: the makers' drivers for the commercial robots (branches checked on 2026-10-09).
- `README.md`, `SPECS.md` (parts and ratings), `THIRD_PARTY.md`.

## Downloads and the hardware license

- Nothing for students is downloadable (unchanged from V19), copy/cut/drag stay blocked, and the editor carries the
  student's email as a watermark.
- **The driver and firmware source are no longer in the public website.** The new Cloud Function
  `getHardwareSources` sends them only to approved course members with an approved, unexpired hardware license (or
  instructors), stamped with their email and logged in `auditLog`. Others see a short note in those files.
- `SECURITY.md` says what this protects and what no website can.

## A new look (the course text is unchanged)

Ubuntu Sans and Ubuntu Sans Mono (the type of the system the course teaches), a quiet paper instead of the graph-paper
grid, hairline frames instead of hard drop shadows, key-cap buttons, and the TF axis colours (x red, y green, z blue)
for structure. The RViz page is arranged as a workbench: robot and launch choices side by side, the long explanation
folded under "Gazebo, MoveIt 2 and the real robot on this page", and the workspace files grouped per package and
folded. No page scrolls sideways at 375 px.

## Fixed after the independent review

Hobby servo angles (pulses now follow the servo's own travel; 0 rad = centre); the Mega's Servo pulse range and baud
rate; Ackermann front wheels missing from TF (now passive joints); a car-like follower; a random Wi-Fi password per
robot and a board that ignores other computers while the Jetson is connected; udev rules that could catch a lidar
(CP210x / FTDI now by serial number, group dialout); xacro `not` / `if-else` precedence; missing package
dependencies; the hardware selector offering Gazebo where there is none; IMU frame now the robot's base link;
licensed students seeing the locked notes on a slow sign-in; the watermark waiting for sign-in; refusing to
activate without a first joint state; documentation wording.

## Deploy

1. Copy the files of this update over the project (same paths). Nothing is deleted.
2. `firebase deploy --only hosting,functions` (the new function `getHardwareSources` and `functions/hw-sources.json`).
3. If `firebase.json` sets a Content-Security-Policy header: allow `'wasm-unsafe-eval'` in `script-src` (the physics
   engine is WebAssembly) and `https://fonts.googleapis.com` / `https://fonts.gstatic.com` for the fonts.
4. After editing anything under `hardware/`, run `node tools/embed-packages.mjs` and deploy hosting and functions again.

## After you deploy (on the real site, with the course robots)

- RViz page: pick arm3, chiku, mecanum, ackermann, quadruped: `colcon build`, `source`, then
  `ros2 launch <robot>_bringup bringup.launch.py hardware_type:=mock` (the arms open the MoveIt demo).
- As an instructor: the workspace's `ros2lab_hardware/src/*.cpp` should show the source with your email on top; as a
  student without a license, the short note.
- Developer checks (need `npm i -D @playwright/test http-server` and the site on http://localhost:8080):
  `node tests/sweep.mjs`, `node tests/robot-hw.test.mjs`, `node tests/physics.test.mjs`, `node tests/overflow.mjs`.
