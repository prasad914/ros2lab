# ROS2Lab update V17: robots that move, Terminator terminal, VS Code editor

This package contains **everything from V13 to V16** plus the changes below. Unzip it over your project folder, as before.

## What changed

**1. Teleop moves the robots (the main fix)**

- **Why the robots did not move before:**
  - When a node such as teleop_twist_keyboard started, the terminal hid its input line, and the keyboard focus fell out of the terminal. The keys you pressed reached nothing.
  - Now the busy terminal keeps the focus: i, j, l, k and the other keys go to teleop straight away, and Ctrl+C stops it.
  - Teleop now also sends a zero command when it exits, and any key outside the drive keys stops the robot, as the real teleop_twist_keyboard does.
- **Every simulated robot can now be driven.** In real ROS 2 Jazzy + Gazebo Harmonic, there are two standard ways to turn teleop's velocity into wheel motion, and the RViz page now has both:

| Launch choice (step 3 of the RViz page) | How the robot is driven | Teleop command |
|---|---|---|
| **Gazebo simulation (sim)** | Gazebo's DiffDrive system (TurtleBot3) or VelocityControl system (Go2, G1, H1), plus a `ros_gz_bridge` entry for `/cmd_vel` | `ros2 run teleop_twist_keyboard teleop_twist_keyboard` |
| **Gazebo + ros2_control (sim_control)** | `<ros2_control>` with `gz_ros2_control/GazeboSimSystem`, the `gz_ros2_control-system` plugin, `config/controllers.yaml`, and spawners for `joint_state_broadcaster` + `diff_drive_controller` (TurtleBot3) or `joint_trajectory_controller` (Kinova Gen3) | `ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true -r cmd_vel:=/diff_drive_controller/cmd_vel` |

- **The page shows the right command:** a hint under the commands says how to drive or move the robot you chose.
- **ros2_control behaves as on Ubuntu:**
  - The launch prints the controller_manager start-up and the spawner lines ("Loaded …", "Configured and activated …").
  - `ros2 control list_controllers`, `list_hardware_interfaces` (with [claimed]), `list_hardware_components`, `load_controller`, `set_controller_state`, `switch_controllers` and `unload_controller` work.
  - `ros2 param get /diff_drive_controller cmd_vel_timeout` shows the values from controllers.yaml.
  - On Jazzy, diff_drive_controller takes **TwistStamped** on `/diff_drive_controller/cmd_vel`. A plain teleop moves nothing, and the terminal explains why.
  - It stops the wheels 0.5 s after the last command (`cmd_vel_timeout`), so students learn to hold the key or use `-p repeat_rate:=10.0`.
  - `ros2 topic pub --rate 10 …` to a controller keeps publishing until Ctrl+C.
  - Real mistakes give the real messages:
    - a spawner with no simulation: "Could not contact service /controller_manager/list_controllers"
    - a misspelled joint in controllers.yaml: "Can't activate controller …: Command interface with '…/velocity' does not exist"
    - gz_ros2_control not installed: "Failed to load system plugin"
    - a missing `ros__parameters`
- **Legged robots and humanoids:** Unitree robots walk with Unitree's own controllers, which are not part of the course. Their simulation uses Gazebo's VelocityControl and OdometryPublisher systems so students can drive them and test their lidars. The generated xacro explains this.
- **Lesson RV2** has a new section, "Making the robot move: two ways in ROS 2 Jazzy", with the common reasons a Gazebo robot does not move.

**2. Sensors with their datasheet values**

| Robot | Sensor | Simulated as |
|---|---|---|
| TurtleBot3 Burger / Waffle | ROBOTIS LDS-01 lidar | 360 samples, 5 Hz, 0.12–3.5 m, noise σ 0.01 m, 0.015 m resolution (ROBOTIS model.sdf) |
| TurtleBot3 | IMU | 200 Hz, gyro noise 2e-4, accel noise 1.7e-2 |
| Unitree Go2 | Unitree 4D LiDAR L1 | 360° × 90°, 11 Hz, 0.05–30 m, about 1,980 points per frame (21,600 points/s), PointCloud2 on `/utlidar/cloud` |
| Unitree G1 / H1 | Livox MID-360 | 360° × (−7°…52°), 10 Hz, 0.1–40 m, PointCloud2 on `/livox/lidar` |
| Unitree G1 / H1 | RealSense D435 | colour FOV 69°, depth from 0.105 m to 10 m |
| Kinova Gen3 | wrist vision module | colour 60° diagonal (1280×720 class), depth from 0.18 m |

- **Lidar noise:** lidars now add Gaussian noise and range resolution, as gz-sensors does.
- **RViz QoS:** sensor displays in the generated RViz configs use **Best Effort** reliability, which works with both real drivers and the bridge.

**3. Terminator-style terminal (every practice terminal)**

- **Look:**
  - The terminal looks like Terminator on Ubuntu: black panes, and a red title bar on the pane you type in (grey on the others).
  - The title bar shows `student@ros2lab: ~/folder`, and the Ubuntu prompt colours are used.
- **Splitting and moving between panes:**
  - **+ New terminal**, the split buttons, **Ctrl+Shift+E** (split right) or **Ctrl+Shift+O** (split below) open a pane next to the current one.
  - **Alt+Arrow** moves between panes. Drag the grey line, or use **Ctrl+Shift+Arrow**, to resize.
- **Pane controls:**
  - **Right-click** opens the Terminator menu: Copy, Paste, Split Horizontally/Vertically, Open Tab, Close, Zoom, Maximise, Show scrollbar.
  - **Ctrl+Shift+X / Z** maximise or zoom a pane, and **×** closes it.
- **Shared and separate state:** each pane keeps its own folder, history and sourcing. Files and running nodes are shared.
- **Up to 6 terminals** per practice terminal.
- **Browser shortcuts:** the browser keeps Ctrl+Shift+T and Ctrl+Shift+W for itself, so Open Tab and Close are in the menu and buttons.
- **Lesson text:** steps that said "new terminal tab" now say "new terminal (+ New terminal or Ctrl+Shift+E)". The first terminal lesson (A1) has a tip about Terminator.

**4. VS Code editor (practice copy, Dark Modern theme)**

- **Opening it:**
  - Type `code .` or `code <file>` in any terminal, or press **Open VS Code** in workspace lessons (Weeks 3–6, packages, Weeks 7–9 and the RViz page).
  - VS Code opens above the terminal.
- **Workspace features:**
  - Explorer with the whole workspace: src, packages, setup.py, package.xml, launch, config, and after colcon build also build, install and log.
  - Tabs, Python/C++/XML/YAML highlighting, line numbers, bracket matching, find, and Ctrl+P quick open.
  - Search in files, a Problems panel (unclosed brackets, missing ":", bad XML), and New File / New Folder / Rename / Delete.
  - Menus and status bar as in VS Code.
- **Saving:**
  - **Ctrl+S** saves into the same workspace the terminal, colcon and ros2 run use, so lesson checklists tick when the file is right.
  - Closing with unsaved changes asks to save.
- **Terminal and Run:**
  - The **TERMINAL** panel is a real terminal in the workspace folder.
  - The ▷ button runs `python3 <file>`.
  - Ordinary Python now really runs in the terminal (with real tracebacks). A file with a ROS 2 node starts as a node.
- **Install command:** `sudo snap install code --classic` works in the practice terminals of a fresh Ubuntu.
- **Python exercises:** all 65 exercises now open in VS Code. Run and the ▷ button show the output in VS Code's TERMINAL panel.
- **Lesson text:** package lessons now say "`code <file>` (VS Code) or `nano <file>`" and "save with Ctrl+S". F1 and D10 have a tip about VS Code.
- **Offline:** the editor is CodeMirror 6 (MIT licence), bundled in `public/vendor/codemirror/`, so it works without any CDN.

**5. Other fixes found by the test runs**
- The joint_state_publisher_gui boxes show the values it publishes (joints whose limits exclude 0).
- `ros2 topic echo --field a.b.c` works.
- `ros2 topic list` with nothing running shows /parameter_events and /rosout.
- Lesson text: *single asterisks* now show as italics, and `code` inside **bold** shows correctly.
- B3 exercise 3 names the right error (AttributeError).
- The Gazebo clock no longer shows 4 decimals.

## Publish

1. Unzip the package over your project folder (`C:\ros2lab-course`). Say **Yes** to replace files.
2. Open a Command Prompt in the project folder:
   ```
   cd C:\ros2lab-course
   ```
3. Optional check of the lessons (should end with "All good"):
   ```
   node tools\check-content.mjs
   ```
4. Publish the website:
   ```
   firebase deploy --only hosting
   ```
5. Upload the updated lesson text:
   1. Open www.ros2lab.com and press **Ctrl + F5**.
   2. Go to **Instructor → Course content** and upload `content\course-content.json`.
6. Try it:
   1. Open www.ros2lab.com/rviz.html and press **Ctrl + F5**.
   2. Choose **TurtleBot3 Burger** and **Gazebo + ros2_control (sim_control)**, then press **Type these commands for me**.
   3. Press **+ New terminal** and type the teleop command shown under the commands. Press `i`, `j`, `l`, `k`.
   4. Type `code ~/ros2_ws` to see the package in VS Code.

## New files

| File | What it is |
|---|---|
| `public/js/vscode.js`, `public/css/vscode.css` | The practice VS Code |
| `public/vendor/codemirror/codemirror.js` + `LICENSE` | CodeMirror 6 editor (MIT), bundled for offline use |
| `public/js/ros2-control.js` | ros2_control logic: `<ros2_control>` parsing, controllers.yaml, controller_manager, diff_drive_controller, joint_trajectory_controller, forward command controllers |
| `public/js/ros-control-graph.js` | Connects ros2_control to the practice Gazebo, spawner and `ros2 control` |
| `public/js/sensor-specs.js` | Datasheet values of the robots' sensors |
