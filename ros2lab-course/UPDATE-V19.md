# ROS2Lab update V19: real MoveIt errors, pose goals, MoveIt Servo, full robot workspaces, hardware license, no downloads

V19 contains everything from V18 plus the changes below. Every change was tested in the browser (an automated browser) and,
where it generates ROS files, with the real ROS 2 Jazzy + MoveIt 2 + Gazebo Harmonic. Five independent checking agents then
tested it again (shell, MoveIt on many arms, real Jazzy, mobile robots, code review). A second agent reproduced each problem
they found, and the confirmed problems are fixed below.

## MoveIt 2

- **Failures are reported the way real MoveIt reports them.** The terminal that runs `demo.launch.py` or `gazebo.launch.py` prints move_group's own lines, for example:
  - `[move_group-4] [ERROR] ... [move_group.moveit.moveit.ros.validate_solution]: Computed path is not valid ...`
  - `... Unable to sample any valid states for goal tree`, `No solution found after 5.000000 seconds`
  - `Invalid Trajectory: start point deviates ...`, `Action client not connected ...`, `CONTROL_FAILED`
  - `[rviz2-5] [ERROR] [move_group_interface]: MoveGroupInterface::plan() failed or timeout reached`

  Successful runs print the full sequence too, down to `Solution was found and executed.`

  In RViz the failure shows in red in the MotionPlanning panel and under the display in the Displays tree.
- **Pose Goal panel** on the right of RViz:
  - Type the tool's x, y, z (m) and roll, pitch, yaw (degrees) in any frame, or fill in the current or goal pose.
  - Choose the pipeline and planner, then Set Goal / Plan / Execute / Plan & Execute / Stop.
  - Tick "Cartesian path" for a straight line.
  - Pilz CIRC takes an interim point.
- **Use Cartesian Path** in the MotionPlanning panel now works (`/compute_cartesian_path`, 1 cm steps; a partial path is reported with its percentage).
- **MoveIt Servo** (`config/servo.yaml`, `launch/servo.launch.py` in every `<robot>_moveit_config`), verified on real Jazzy (UR5e, WidowX 250):
  ```bash
  ros2 launch <robot>_moveit_config servo.launch.py
  ros2 service call /servo_node/switch_command_type moveit_msgs/srv/ServoCommandType "{command_type: 1}"
  ros2 topic pub -r 30 /servo_node/delta_twist_cmds geometry_msgs/msg/TwistStamped "{header: {stamp: now, frame_id: <base link>}, twist: {linear: {z: 0.05}}}"
  ```
  - Joint jog: `command_type: 0` with `control_msgs/msg/JointJog` on `/servo_node/delta_joint_cmds`.
  - Pose: `command_type: 2` with `PoseStamped` on `/servo_node/pose_target_cmds`.
  - Commands need `stamp: now`: real Servo silently drops commands with an old stamp, and the practice terminal explains this.
  - Servo stops near collisions and joint limits.
  - `/servo_node/status` and `pause_servo` work.
  - For the real arm, pass `command_out_topic:=/<driver controller>/joint_trajectory`.
- **`pose_goal_commander.py`** (in every MoveIt config) plans and executes goals published on `/goal_pose` (geometry_msgs/PoseStamped), through `/move_action`:
  ```bash
  ros2 run <robot>_moveit_config pose_goal_commander.py [--ros-args -p pipeline:=pilz_industrial_motion_planner -p planner_id:=LIN | -p cartesian:=true]
  ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped "{header: {frame_id: <base>}, pose: {position: {x: 0.4, y: 0.1, z: 0.4}, orientation: {x: 1.0, w: 0.0}}}"
  ```
  This was verified with the real move_group (OMPL and Cartesian).
- `ros2 action send_goal /<controller>/follow_joint_trajectory control_msgs/action/FollowJointTrajectory "{trajectory: ...}"` moves the arm.
  - Like the real joint_trajectory_controller, it rejects goals that leave out joints.
- Fixes:
  - xArm 6 wrist collision pair (link4/link6 can never touch).
  - WidowX gripper joint marked passive, so the robot state is complete.
  - Servo singularity limits suited to small arms.
- `node tools/test-moveit.mjs` now labels every result:
  - **OK**;
  - **EXPECTED**, with the reason, for what real MoveIt also does (Pilz refusing to go through obstacles, LIN leaving the workspace, CHOMP/STOMP stuck at an obstacle, a direct move that would hit the arm itself);
  - **PROBLEM**, for a real fault.

## A complete workspace for every robot

Next to `<robot>_description` (and `<robot>_moveit_config` for arms), the RViz page now writes:
- **`<robot>_gazebo`**:
  - `gazebo.launch.py` runs the simulation with the same `/cmd_vel`, `/odom` and sensor topics as the real robot.
  - `gazebo_control.launch.py` runs the ros2_control version.
- **`<robot>_bringup`** (every robot sold commercially):
  - `real.launch.py`: the maker's driver (+ `use_moveit:=true` for arms). It needs a hardware license.
  - `sim.launch.py`: the same robot in Gazebo.
  - `config/hardware.yaml`: connection plus the maker's data-sheet values (payload, reach, speeds, weight, sensors).
  - udev rules.
  - `scripts/install_driver.sh`: source-built drivers go into their own underlay workspace, so they do not clash with the course packages.

VS Code (`code ~/ros2_ws`) shows all of them. The makers' drivers are pre-installed in the practice computer:
- `ros2 pkg list` shows them.
- `ros2 launch ur_robot_driver ...` is checked against the hardware license; with a license, the driver reports that no robot answers.

## A real ROS 2 Jazzy terminal

- **Sourcing:**
  - `. install/setup.bash` and every colcon script (`setup.sh`, `local_setup.*`; `setup.zsh` errors in bash as it really does).
  - `AMENT_PREFIX_PATH` and `COLCON_PREFIX_PATH` are set.
  - Each terminal sees only what it sourced: a new terminal must `source install/setup.bash` again, and the hint says so.
- **Middleware and network:**
  - `RMW_IMPLEMENTATION` with Fast DDS (default), **Cyclone DDS** (`rmw_cyclonedds_cpp`) or Zenoh; a wrong name gives the real rcl error.
  - `ROS_DOMAIN_ID` isolates terminals the way DDS discovery does.
  - `ros2 doctor` and `ros2 doctor --report`.
- **Package tools:** `ros2 pkg prefix / xml / executables`, `colcon list`, and `/opt/ros/jazzy/share/<pkg>/package.xml` for every installed package.
- **Bash:**
  - globs (`ls src/*/launch`);
  - `grep -E -v -c -n -r -A -B -C --include`;
  - `ls` one name per line in pipes, `ls -d`;
  - background jobs (`cmd &`, `jobs`, `kill %1`, `fg`);
  - `which`, `export -p`, `bash FILE`.
- Spawners wait up to 30 s for controller activation (`--switch-timeout 30`), so slow PCs do not fail with "Switch controller timed out".
- Speed limits:
  - TurtleBot3 Burger: 0.22 m/s, 2.84 rad/s.
  - Waffle: 0.26 m/s, 1.82 rad/s.
  - Scout: 1.5 m/s.

## Nothing leaves ROS2Lab, and real hardware needs a license

- **Removed:**
  - the "Download this workspace (.zip)" button and `zip.js`;
  - the release zips in the repository;
  - downloads from RViz Save Config / Save Image and from the rosbridge RViz.
- **Copying is blocked:** copying or dragging text out of the terminal, VS Code, RViz or the file list does not work, including Ctrl+A then Ctrl+C on the page.
- **Hardware license:**
  - Connecting a real robot needs a license from the course administrator. This covers the rosbridge **Connect** button, and any `real.launch.py`, `<robot>_bringup` real launch, or maker driver launch.
  - Students ask on the RViz page (robot + purpose).
  - The administrator approves (robots or "all", 1 to 365 days), refuses or revokes in the new **Hardware licenses** tab of the instructor dashboard.
  - Server side:
    - Cloud Functions `requestHardwareLicense` and `adminDecideHardwareLicense`.
    - Firestore `hardwareLicenses/{uid}`, which only the server writes and the student can read.
    - Every decision goes to `auditLog`.
  - Simulation never needs a license.

## Publish

1. Copy the changed files over your project folder (the list is below).
2. Deploy both the site and the server code, because the license needs the new functions and rules:
   ```
   firebase deploy --only hosting,functions,firestore:rules
   ```
3. Optional checks:
   - `node tools\test-moveit.mjs`: every line OK or EXPECTED, then "All good".
   - `node tools\check-content.mjs`.
4. Open www.ros2lab.com/rviz.html, press **Ctrl + F5**, and try:
   - **UR5e → MoveIt 2 (mock hardware)**: use the Pose Goal panel, then `servo.launch.py`.
   - **TurtleBot3 → ros2 launch tb3_burger_bringup sim.launch.py**.
5. To give yourself or a student a license, open the instructor dashboard → **Hardware licenses**.

## Known limits

- **Shared description packages:** `<robot>_description` packages are trimmed copies of the makers' description packages and use the same names (`ur_description`, `franka_description`, …). For the real robot, `install_driver.sh` builds the driver in its own workspace; if a driver needs files from its own description package, the script explains how to stop the course copy from shadowing it (`COLCON_IGNORE`).
- **FR3 with MoveIt on the real arm:** Franka's driver uses its own controller set. For MoveIt with the real FR3, use Franka's `franka_fr3_moveit_config`.
- **Copy and download blocking:** the blocking stops students inside ROS2Lab's pages. The robot files are still loaded by the browser, as every website's files are.

## New and changed files

| File | What it is |
|---|---|
| `public/js/moveit-servo.js` (new) | Pose goals, Cartesian paths, MoveIt Servo, pose_goal_commander, FollowJointTrajectory action |
| `public/js/robot-packages.js` (new) | `<robot>_gazebo` and `<robot>_bringup` packages, data-sheet values, udev rules |
| `public/js/hw-license.js` (new) | The hardware license on the page |
| `public/js/ros-moveit.js`, `moveit-rviz.js`, `moveit-config.js`, `moveit-core.js`, `ros2-control.js` | MoveIt logs, panel, Servo files |
| `public/js/terminal-sim.js`, `ros-graph.js`, `ros-control-graph.js`, `vscode.js`, `rviz.js`, `rviz-page.js`, `rviz-pkg.js`, `rviz-sim.js`, `real-robot.js`, `admin.js` | Terminal, packages, license, no downloads |
| `public/rviz.html`, `public/css/rviz.css`, `public/robots/index.json`, `public/robots/moveit/xarm6.json` | Page, styles, robot data |
| `functions/index.js`, `firestore.rules` | License functions and rules (deploy them) |
| `tools/test-moveit.mjs` | OK / EXPECTED / PROBLEM labels |
| `public/js/zip.js` | **Deleted** (downloads removed) |
