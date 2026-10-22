# ROS 2 / Terminator realism review

**Verdict:** The emulator is very good. `service call`, `topic pub/echo/hz` (62.5 Hz), `param get/set/describe/dump`, `node info` and `action send_goal` match Jazzy almost character for character. The Terminator colours (#c80003, #c0bebf, #aaaaaa on black) match the defaults.
Three commonly taught paths are broken: `-t`/`--show-types`, `--ros-args` remaps and parameters, and the turtle physics around walls, rotation goals and background parameters.
One Reset bug leaves an orphaned turtlesim running. Fix the six "Must" items before students use the page.

Checked against ros2cli, turtlesim and rosidl_runtime_py sources (jazzy branch). Test scripts: `reviews/ros_t1.mjs`–`ros_t5.mjs`.

## Must

1. **`-t` does nothing.** `ros2 topic list -t` (also `service list -t` and `action list -t`, which are chips) prints names only.
   - Real: `/turtle1/pose [turtlesim/msg/Pose]`.
   - Fix: in `flags()`, `'t'` is in the list of flags that take a value, so it swallows the next argument. Only treat `-t` as `--times` for `topic pub`.

2. **Remaps and `-p` are ignored.** `ros2 run turtlesim turtle_teleop_key --ros-args --remap turtle1/cmd_vel:=turtle2/cmd_vel`: `node info /teleop_turtle` still shows `/turtle1/cmd_vel`. `ros2 run turtlesim turtlesim_node --ros-args -p background_r:=255`: `param get` still gives `Integer value is: 69`. Both are in the official turtlesim tutorial.
   - Fix: `nodeRemap()` only handles `__node`. Parse `-r/--remap from:=to` and `-p name:=value` in `rosRun()`, then pass them to `startTeleop()` (topic and action names) and `startSim()` (params).

3. **Reset during the demo orphans turtlesim.** Click Play demo, then Reset: `__lab.sim()` is still running, its pane is not in `panes()`, and the TurtleSim window stays open. Ctrl+C cannot reach it, and `ros2 run turtlesim turtlesim_node` answers "already running in another terminal".
   - Fix: `stopDemo()`/`resetLab()` must `clearInterval(typing)`, and `typeInto()` must not call `enter()` on a pane that has been removed.

4. **An idle turtle at the wall warns forever.** After driving into the right wall and stopping, the warning count went from 7 to 15 in 4 s with `lin=0` (`Clamping from [x=11.088889, y=5.544445]`).
   - Real: it only warns while the turtle is pushing out.
   - Fix: in `tick()`, the turtle is clamped to `Math.fround(W)`, which is greater than `W`. Clamp to `W`, or compare in float32.

5. **`param set background_r 150` wipes the drawing.** The canvas pixel on the trail changed from 179,184,255 to 150,86,255.
   - Real (Jazzy): the background is painted under a transparent path image, so trails stay.
   - Fix: in `SIM.node.onParam`, repaint the background under the paths instead of calling `clearPaths()`. That needs a separate background layer.

6. **`cmd_vel` during `rotate_absolute` is lost.** Send a goal of theta 3.0, then `pub --once {angular: {z: 1.0}}`: theta went from 0.727 to 0.848 in 1.5 s.
   - Real: the turtle turns about +1 rad and turtlesim logs `[WARN] ... Velocity command received during rotation goal. Aborting goal`. The ABORTED result also carries the running delta; ours prints `delta: 0.0`.
   - Fix: the subscriber in `spawnTurtle()` calls `abortRot()`, which zeroes `t.ang`. Keep the new command, log the WARN, and pass the current delta.

## Should

7. **Rotation logs come from the wrong node.** The teleop pane prints `[teleop_turtle]: Rotation goal completed successfully` and `... Rotation goal canceled`.
   - Real: both are logged by `[turtlesim]` in the turtlesim terminal. Teleop prints nothing. Pressing `c` then `v` should make turtlesim log WARN `Rotation goal received before a previous goal finished. Aborting previous goal`.
   - Fix: `startTeleop()` key handler and `simRotate()`.

8. **Teleop banner case.** Ours: `Use G|B|V|C|D|E|R|T keys ... 'F' to cancel a rotation.` / `'Q' to quit.`
   - Real: `Use g|b|v|c|d|e|r|t keys to rotate to absolute orientations. 'f' to cancel a rotation.` / `'q' to quit.`
   - Fix: `startTeleop()`.

9. **`ros2 topic pub -1 ...` fails.** Ours: `The passed message type is invalid`. Real: `-1` means `--once`.
   - Fix: `flags()` treats anything matching `/^-\d/` as a positional argument. Special-case `-1`.

10. **Field coercion is too strict.**
    - `SetPen "{r: 255.0, ...}"` gives `Failed to populate field: The 'r' field must be of type 'int'`. `Spawn "{name: 5}"` gives `... must be of type 'str'`.
    - Real: `set_message_fields` calls `int(255.0)` and `str(5)`, so both calls succeed.
    - Fix: `fill()`.

11. **`ros2 topic type /foo` and `ros2 service type /foo` print an error.** Ours: `Unknown topic '/foo'` / `Unknown service '/foo'`. Real: no output (exit code 1).
    - Fix: `rosTopic()`/`rosService()` `type` branch.

12. **Missing-argument errors.** `ros2 node info` (same for `topic echo`, `param get`, ...) gives `ros2: error: the following arguments are required`.
    - Real: `ros2 node info: error: the following arguments are required: node_name`.
    - Fix: pass the program name and the argument names to `needArgs()`.

13. **`printenv | grep ROS` prints nothing.** It is taught in the "Configuring environment" tutorial.
    - Real: `ROS_VERSION=2`, `ROS_PYTHON_VERSION=3`, `ROS_DISTRO=jazzy`.
    - Fix: support `| grep [-i] X` in `splitChain()`/`execOne()`.

14. **Terminator shortcuts are missing.** Ctrl+Shift+T (new tab), Ctrl+Shift+W (close pane), Ctrl+Shift+X (zoom pane), Ctrl+Shift+Q and Ctrl+Tab did nothing: pane count stayed at 5 and no tab bar appeared. Ctrl+Shift+O/E work.
    - Fix: add them to `onKey()`. The functions already exist (`newTab`, `closePane`).

15. **Simulator, Waffle Pi entry is incomplete.** No sensors and no max speed. The description file is shown as `ws/turtlebot3/src/turtlebot3/turtlebot3_description/urdf/turtlebot3_waffle_pi.urdf`, which is inconsistent with the other two TurtleBot3s. The featured card falls back to "lidar, IMU", which leaves out the Pi camera.
    - Real: 0.26 m/s, 1.82 rad/s; lidar, Raspberry Pi camera, IMU.
    - Fix: `robots.json`.

16. **Simulator, the "Gazebo sensors" tag is wrong on robots without sensors.** It appears on Chiku, Ackermann, Mecanum, the 4-legged robot, the humanoid, the quadcopter and both hybrids, all with `sensors: []`.
    - Fix: in `facts()` (sim.js), say "Gazebo" unless `r.sensors.length`.

## Could

17. **`ros2 node info` spacing.** Ours prints `Service Clients:` directly followed by `Action Servers:`.
    - Real: `print(*[], sep='\n')` prints an empty line after every empty section.
    - Fix: `blk()`.

18. **Simulator inconsistencies.**
    - The Drones blurb says "Multirotors that fly in Gazebo", but Crazyflie shows "Gazebo: Not in this simulator".
    - The Go2 source link `unitreerobotics/unitree_ros` is a ROS 1 (catkin) repository.
    - The Waffle's "RGB camera" is a RealSense R200 on the real robot.
    - Fix: `CATS`/`robots.json`.

19. **Two elements have `id="lab"`** (the section and the inner div). `document.querySelectorAll('[id=lab]').length` gives 2.
    - Fix: rename one in the page HTML. `lab.js` reads the first one.
