# Lesson parity: Weeks 7–9 (UR, XT, RV): real ROS 2 Jazzy vs the ROS2Lab site

Date: 2026-10-19 · Branch: parity-v2 · Auditor: read-only lesson-parity agent

Ground truth comes from the fixtures that were **recaptured** after the ros2-daemon runner fix (`parity/fixtures/lessons/RECAPTURE_DONE` = 2026-10-19T22:12:45+05:30). Every real line quoted below is from those recaptured files.

| Side | How | Raw output |
|---|---|---|
| REAL | `parity/fixtures/lessons/<L>/term<N>.json`, `termcode1.json` (Ubuntu 24.04 + Jazzy, pty) | (fixtures) |
| SITE, Node | `public/js/terminal-sim.js` Shell, same loop as `tools/check-content.mjs`; GUI steps (viz/rvizGoal/rvizSave) applied the way check-content applies them | `parity/browser_out/lessons/<L>/term<N>.site.json`, `termcode1.site.json` |
| SITE, browser | Playwright, `lesson-render.js` on http://127.0.0.1:8000 (harness page), commands typed into the terminal, Ctrl+C button; GUI steps **not** driven | `parity/browser_out/lessons/<L>/term<N>.browser.json`, `termcode1.browser.json` |

Scripts: `parity/browser_out/lessons/tools79/` (`site_node.mjs`, `site_code.mjs`, `site_browser.mjs`, `site_browser_code.mjs`, `compare79.py`, `dump.py`, `appendix.py`); comparison output `tools79/compare79.site.json` and `compare79.browser.json`.

Normalisation: ROS log timestamps, the log-dir name, PIDs, UUID/hex ids, prasad↔student and the hostname are masked. Where a command was still running, the comparison covers only the lines printed inside the real capture window (8 s, or 15 s for `topic pub`). Site lines with cls `hint` are left out of the comparison and listed separately.

## Totals

7 practice terminals (UR5, XT3, XT5, XT6, XT7, RV1, RV3) plus 3 code-block captures (UR7, XT6, XT7 `termcode1`): **40 typed commands**.

| Verdict | Count | Notes |
|---|---|---|
| MATCH | 14 | check_urdf ×3, urdf_to_graphviz, xacro ×2, cat, colcon build ×2, source ×2, mkdir, cd, ls |
| DIFFERS | 24 | 13 are student-visible (wrong or missing real output); the rest are cosmetic or format-only |
| PENDING-dependent | 2 | RV1 `ros2 topic echo /goal_pose` and `cat ~/chiku.rviz`: their real result depends on an RViz click (rvizGoal / rvizSave) that is PENDING in the fixture |
| GUI steps (viz / rvizGoal / rvizSave) | 7 | PENDING in every fixture (UR5 1, XT5 1, RV1 4, RV3 1); the RViz GUI baseline is not captured yet |
| `rviz` editor blocks | 15 | **NO FIXTURE** (see the end of this report) |

After the recapture, **none of the remaining differences come from discovery** (the daemon problem). Every difference listed below is still there in the recaptured files.

Node Shell vs browser: every command produced the same lines in both, with three exceptions. (a) The browser does not drive GUI steps, so RV1 `cat ~/chiku.rviz` and RV3 `topic pub` behave as they do in the real run, where those clicks are PENDING. (b) Some "(Practice terminal: … keeps running in the background …)" hint lines show only in the Node pass. (c) The browser shows the site's Ctrl+C output (compared below).

## Student-visible differences (most important first)

1. **XT5 task 1 and RV1 task 1: `ros2 run robot_state_publisher robot_state_publisher --ros-args -p robot_description:="$(xacro chiku.urdf.xacro)"` crashes in real Jazzy, but works on the site.**
   - REAL (`fixtures/lessons/XT5/term1.json` step 0, the same in `RV1/term1.json` step 0), exit 250:
     `[rcutils|error_handling.c:65] an error string … will be truncated` / `[ERROR] [rcl]: Failed to parse global arguments` / `terminate called after throwing an instance of 'rclcpp::exceptions::RCLInvalidROSArgsError'` / `  what():  failed to initialize rcl: Couldn't parse parameter override rule: '-p robot_description:=<?xml version="1.0" ?>` … (the XML, cut short) … `<ma, at ./src/rcl/arguments.c:352` / `[ros2run]: Aborted`
   - SITE: six lines of `[INFO] [robot_state_publisher]: got segment …`, then the node keeps running.
   - Consequence: in real ROS every later step of XT5 and RV1 runs with **no** TF. Real tf2_echo waits for ever with `Invalid frame ID "base_footprint" … target_frame - frame does not exist`, view_frames gives `frame_yaml='[]'`, and joint_state_publisher stays at `Waiting for robot_description…`. On the site the tasks look successful. The lesson command itself fails on real Jazzy with this Chiku xacro. The likely cause is the generated XML comment `(REP 105: base_footprint …)`, whose `: ` the rcl YAML parser reads as a mapping, but that cause is **UNVERIFIED**. This is a course-content issue as well as a site gap; content changes are out of scope for this audit.
2. **robot_state_publisher startup lines (UR5 task 3, XT7 task 6, XT5/RV1 task 1).** REAL Jazzy prints exactly one line, `[robot_state_publisher-1] [INFO] [...] [robot_state_publisher]: Robot initialized` (`UR5/term1.json` step 2, `XT7/term1.json` step 6, `UR7/termcode1.json` step 0). SITE prints one `got segment <link>` line per link and never prints `Robot initialized`.
3. **joint_state_publisher(_gui) lines (UR5 t3, XT7 t6, XT5 t4, RV1 t2).** REAL, inside launch: `[joint_state_publisher]: Waiting for robot_description to be published on the robot_description topic...`, `Centering`, `Got description, configuring robot`, `Centering`. The logger name is `joint_state_publisher`, even for the _gui executable.
   - SITE `ros2 launch urdf_tutorial display.launch.py` (UR5) prints **no** joint_state_publisher lines.
   - SITE XT7 launch prints only `Waiting…`, with the logger name `[joint_state_publisher_gui]`.
   - SITE `ros2 run joint_state_publisher_gui joint_state_publisher_gui` (XT5) prints only `[INFO] [joint_state_publisher_gui]: Centering`.
   - SITE `ros2 run joint_state_publisher joint_state_publisher` (RV1) prints nothing, where REAL prints `Waiting for robot_description…`.
   - The real order inside a launch is rsp → rviz2 ×3 → jsp ×4. The site prints rsp, then jsp, then rviz2.
4. **XT7 task 3: `ros2 launch my_robot_description display.launch.py` before the urdf folder is installed (exit 1).**
   - REAL: `[ERROR] [launch]: Caught exception in launch (see debug for traceback): executed command failed. Command: xacro /home/student/ros2_ws/install/my_robot_description/share/my_robot_description/urdf/chiku.urdf.xacro`, then `Captured stderr output: Traceback …`. The chained tracebacks show `FileNotFoundError …`, `xacro.XacroException: No such file or directory: …`, and finally `AttributeError: module 'xml' has no attribute 'parsers'`, 34 lines in all.
   - SITE: one invented error line (cls `err`, not a hint): `Caught exception in launch …: file '…/chiku.urdf.xacro' not found. Is the urdf folder installed (install(DIRECTORY urdf ...) in CMakeLists.txt), and did you colcon build and source again?`
   - This breaks rule 5: the real error text must come first and the hint after it.
5. **XT6 code block (`termcode1`): `ros2 topic echo --once /tf_static` while static_transform_publisher runs in another tab.**
   - REAL prints the latched TFMessage: `transforms:`, `- header: stamp: sec/nanosec, frame_id: base_link`, `child_frame_id: camera_link`, `translation x: 0.2 y: 0.0 z: 0.1`, `rotation … z: 0.7071080798594735 w: 0.7071054825112363`, `---`, then exit 0.
   - SITE prints the hint `(Nobody is publishing on /tf_static right now, so echo just waits. )` and `^C`, even though the site's own `ros2 topic info /tf_static` reports `Publisher count: 1` (checked in the Node Shell).
6. **tf2_echo behaviour (XT5 t2/t3/t5, XT6 t2).**
   - (a) REAL keeps running and prints a sample about once a second until Ctrl+C (71 lines in 8 s in `XT6/term1.json` step 2). On Ctrl+C it prints `[INFO] [...] [rclcpp]: signal_handler(SIGINT/SIGTERM)`. SITE prints 2 samples (or 1 "Waiting…" line), then prints `^C` and returns to the prompt **without** the student pressing Ctrl+C.
   - (b) REAL prints a first line `[tf2_echo]: Waiting for transform base_link ->  camera_link: Invalid frame ID "base_link" passed to canTransform argument target_frame - frame does not exist` even when the static TF is already published. SITE leaves this line out.
   - (c) For a static transform REAL prints `At time 0.0`. SITE prints the wall time, `At time 1792424839.901999872`.
   - (d) REAL RPY shows `[0.000, -0.000, 1.571]` and `[0.000, -0.000, 90.000]` (negative zero pitch). SITE shows `0.000`. This one is cosmetic.
   - Translation, quaternion and matrix values match at 3 decimals.
7. **UR7 code block: `ros2 launch ur_description view_ur.launch.py ur_type:=ur5e`.**
   - REAL starts joint_state_publisher_gui-1, rviz2-2 and robot_state_publisher-3, then prints `Robot initialized`, the rviz2 lines and the jsp lines. `ros2 node list` then shows `/joint_state_publisher /robot_state_publisher /rviz /transform_listener_impl_…`. The `sudo apt install` line is PENDING because the package was already installed on the capture machine.
   - SITE, without apt: `Package 'ur_description' not found …` plus a hint.
   - SITE, after the code block's own `sudo apt install ros-jazzy-ur-description`, which the site "installs": `file 'view_ur.launch.py' was not found in the share directory of package 'ur_description' at '/opt/ros/jazzy/share/ur_description'`. So the documented command never works on the site (scratch check in Node, not saved as a fixture).
8. **Ctrl+C output (browser, every block).**
   - REAL for an rclcpp node: `[INFO] [<ts>] [rclcpp]: signal_handler(SIGINT/SIGTERM)` on its own line.
   - REAL for `ros2 run joint_state_publisher_gui`: `[ros2run]: Interrupt`, exit 254.
   - REAL for a Python `joint_state_publisher`: nothing.
   - REAL for a launch: `[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)`, then `[robot_state_publisher-1] [INFO] [...] [rclcpp]: signal_handler(SIGINT/SIGTERM)`, `[rviz2-3] … signal_handler(SIGINT/SIGTERM)`, `[ERROR] [joint_state_publisher_gui-2]: process has died [pid …, exit code -2, cmd '/opt/ros/jazzy/lib/joint_state_publisher_gui/joint_state_publisher_gui --ros-args'].`, and two `process has finished cleanly` lines (`UR5/term1.json` step 4).
   - SITE prints `^C[INFO] [rclcpp]: signal_handler(signum=2)` for every program, Python or launch. For a launch it then reports all three processes as `finished cleanly`. The real `[ERROR] … process has died … exit code -2` for jsp_gui and the per-node signal_handler lines are missing.
9. **RV3 tasks 3–4: `ros2 topic pub --once /visualization_marker …` with no subscriber** (browser pass; the Marker display click is PENDING in real). REAL repeats `Waiting for at least 1 matching subscription(s)...` about once a second (12–13 lines in 15 s; Ctrl+C gives exit 2). SITE prints it **once**, followed by a long hint. When the Marker display is added (Node pass), SITE prints `publisher: beginning loop` / `publishing #1: visualization_msgs.msg.Marker(… action=0, ...)`. That cannot be checked yet because the real GUI step is PENDING.
10. **XT7 code block: `ros2 pkg create my_robot_description --build-type ament_cmake`.** SITE leaves out the trailing real block: an empty line, then `[WARNING]: Unknown license 'TODO: License declaration'.  This has been set in the package.xml, but no LICENSE file has been created.`, `It is recommended to use one of the ament license identifiers:` and the 9 identifiers (Apache-2.0 … MIT-0). The `maintainer:` line differs only by user name (prasad vs student), which is expected.

## Cosmetic / format-only

- rviz2 startup (UR5, XT5 t7, XT7, RV1 t3, RV3 t1). REAL prints three lines: `Stereo is NOT SUPPORTED`, `OpenGl version: 4.5 (GLSL 4.5)`, `Stereo is NOT SUPPORTED`. A bare `rviz2` or `ros2 run rviz2 rviz2` on the SITE prints only the first two, and the version reads `4.6 (GLSL 4.6)`. The OpenGL version depends on the machine; the missing second Stereo line is the real difference. Inside a launch the SITE prints all three.
- static_transform_publisher node name. REAL uses a 16-character random suffix `static_transform_publisher_bSu8kh1vd98CK4nb`; SITE uses 8 hex characters, `static_transform_publisher_44553dab`. All other lines match, including `translation: ('0.200000', …)`, `rotation: (… '0.707108', '0.707105')` and `from 'base_link' to 'camera_link'`.
- Old-style static_transform_publisher (XT6 t3). REAL prints `[WARN] [<ts>] []: Old-style arguments are deprecated; …` with an **empty** logger name; SITE writes `[static_transform_publisher_xxxx]` as the logger.
- view_frames (XT5 t6). The 4-line format matches. In REAL the Result is `frame_yaml='[]'`, because of the rsp crash in item 1. The SITE Result `frame_yaml="base_link: \n  parent: 'base_footprint' left_wheel_link: … ..."` ends in a truncated `...`, which is **UNVERIFIED**: there is no real capture with a non-empty TF tree in these lessons.
- Launch log line: the log-dir name and PIDs are masked; the format matches.
- tf2_echo in XT5 t3: SITE `Invalid frame ID "left_wheel_link" passed to canTransform argument source_frame` vs REAL `"base_footprint" … target_frame`. These cannot be compared, because in REAL no TF exists at all (item 1).

## Hints (allowed beginner hints, rule 5)

These are fine: "(chiku.urdf opened in RViz below the terminal …)", "(Practice terminal: /x now keeps running in the background …)", "(The RViz2 window opened below the terminal.)", "(tf2_echo prints … once per second until Ctrl+C.)", "tf2_echo waits until both frames exist …", "Careful: the old order is x y z YAW PITCH ROLL …", the view_frames tree drawing, "Look at RViz below." and the RV3 Marker-display hint.

These hints **replace or contradict real output** and should be flagged:

- XT6 code `/tf_static`: "Nobody is publishing …", where real prints the message (item 5).
- UR7 `ros2 node list`: "(No nodes are running …)", because the launch failed on the site (item 7).
- XT7 t3: the invented error text is cls `err`, not a hint (item 4).

## Per lesson

| Lesson | Block | Verdict |
|---|---|---|
| UR1–UR4, UR6, UR8 | rviz blocks only | NO FIXTURE |
| UR5 | term1 (4 tasks) | check_urdf and urdf_to_graphviz MATCH. The display.launch.py launch DIFFERS (items 2, 3, 8). The GUI step is PENDING. |
| UR7 | code1 | DIFFERS (item 7); 2 rviz blocks have NO FIXTURE |
| XT1, XT2, XT4 | rviz blocks only | NO FIXTURE |
| XT3 | term1 (5 tasks) | **All 5 MATCH**: xacro, xacro with `use_lidar:=false`, check_urdf ×2, cat. The rviz block has NO FIXTURE. |
| XT5 | term1 (8 tasks) | 7/7 DIFFERS (items 1, 2, 3, 6, 8, plus rviz2 and view_frames). The GUI step is PENDING. |
| XT6 | term1 (3 tasks) + code1 | 5/5 DIFFERS. Values match; the format and run behaviour differ (items 5, 6, 8, plus the cosmetic node-name items). |
| XT7 | term1 (6 tasks) + code1 | colcon ×2, source ×2, mkdir, cd and ls MATCH. Launch ×2 and pkg create DIFFER (items 2, 3, 4, 10). |
| RV1 | term1 (9 tasks) | rsp, jsp and rviz2 DIFFER (items 1, 3, rviz2). `echo /goal_pose` and `cat ~/chiku.rviz` are PENDING-dependent (rvizGoal/rvizSave clicks). 4 GUI steps are PENDING. |
| RV2, RV6, RV7 | rviz blocks only | NO FIXTURE |
| RV3 | term1 (4 tasks) | rviz2 is cosmetic. Both topic pub commands DIFFER (item 9). 1 GUI step is PENDING. |
| RV4, RV5 | no terminal or rviz block | none |

### Every command

| Lesson | Block | # | Command | Real exit/state | Node Shell | Browser |
|---|---|---|---|---|---|---|
| UR5 | term1 | 1 | `check_urdf chiku.urdf` | 0 / finished | MATCH | MATCH |
| UR5 | term1 | 2 | `urdf_to_graphviz chiku.urdf chiku` | 0 / finished | MATCH | MATCH |
| UR5 | term1 | 3 | `ros2 launch urdf_tutorial display.launch.py model:=$PWD/chiku.urdf` | running | DIFFERS | DIFFERS |
| XT3 | term1 | 1 | `xacro chiku.urdf.xacro > chiku.urdf` | 0 | MATCH | MATCH |
| XT3 | term1 | 2 | `check_urdf chiku.urdf` | 0 | MATCH | MATCH |
| XT3 | term1 | 3 | `xacro chiku.urdf.xacro use_lidar:=false > nolidar.urdf` | 0 | MATCH | MATCH |
| XT3 | term1 | 4 | `check_urdf nolidar.urdf` | 0 | MATCH | MATCH |
| XT3 | term1 | 5 | `cat macros.xacro` | 0 | MATCH | MATCH |
| XT5 | term1 | 1 | `ros2 run robot_state_publisher … -p robot_description:="$(xacro …)"` | 250 / finished (crash) | DIFFERS | DIFFERS |
| XT5 | term1 | 2 | `ros2 run tf2_ros tf2_echo base_footprint lidar_link` | running | DIFFERS | DIFFERS |
| XT5 | term1 | 3 | `ros2 run tf2_ros tf2_echo base_footprint left_wheel_link` | running | DIFFERS | DIFFERS |
| XT5 | term1 | 4 | `ros2 run joint_state_publisher_gui joint_state_publisher_gui` | running | DIFFERS | DIFFERS |
| XT5 | term1 | 5 | `ros2 run tf2_ros tf2_echo base_footprint left_wheel_link` | running | DIFFERS | DIFFERS |
| XT5 | term1 | 6 | `ros2 run tf2_tools view_frames` | 0 | DIFFERS | DIFFERS |
| XT5 | term1 | 7 | `ros2 run rviz2 rviz2` | running | DIFFERS (cosmetic) | DIFFERS (cosmetic) |
| XT6 | term1 | 1 | `static_transform_publisher --x 0.2 --z 0.1 --yaw 1.5708 …` | running | DIFFERS (cosmetic: node name) | same |
| XT6 | term1 | 2 | `ros2 run tf2_ros tf2_echo base_link camera_link` | running | DIFFERS | DIFFERS |
| XT6 | term1 | 3 | `static_transform_publisher 0 0 0.3 0 0 0 base_link imu_link` | running | DIFFERS (cosmetic: logger names) | same |
| XT6 | code1 | 1 | `static_transform_publisher --x 0.2 … camera_link` | running | DIFFERS (cosmetic) | same |
| XT6 | code1 | 2 | `ros2 topic echo --once /tf_static` | 0 | DIFFERS | DIFFERS |
| XT7 | term1 | 1 | `colcon build --packages-select my_robot_description` | 0 | MATCH | MATCH |
| XT7 | term1 | 2 | `source install/setup.bash` | 0 | MATCH | MATCH |
| XT7 | term1 | 3 | `ros2 launch my_robot_description display.launch.py` | 1 | DIFFERS | DIFFERS |
| XT7 | term1 | 4 | `colcon build --packages-select my_robot_description` | 0 | MATCH | MATCH |
| XT7 | term1 | 5 | `source install/setup.bash` | 0 | MATCH | MATCH |
| XT7 | term1 | 6 | `ros2 launch my_robot_description display.launch.py` | running | DIFFERS | DIFFERS |
| XT7 | code1 | 1 | `mkdir -p ~/ros2_ws/src` | 0 | MATCH | MATCH |
| XT7 | code1 | 2 | `cd ~/ros2_ws/src` | 0 | MATCH | MATCH |
| XT7 | code1 | 3 | `ros2 pkg create my_robot_description --build-type ament_cmake` | 0 | DIFFERS | DIFFERS |
| XT7 | code1 | 4 | `ls my_robot_description` | 0 | MATCH | MATCH |
| RV1 | term1 | 1 | `ros2 run robot_state_publisher … -p robot_description:="$(xacro …)"` | 250 / finished (crash) | DIFFERS | DIFFERS |
| RV1 | term1 | 2 | `ros2 run joint_state_publisher joint_state_publisher` | running | DIFFERS | DIFFERS |
| RV1 | term1 | 3 | `rviz2` | running | DIFFERS (cosmetic) | DIFFERS (cosmetic) |
| RV1 | term1 | 4 | `ros2 topic echo /goal_pose` | running (empty; rvizGoal PENDING) | PENDING-dependent | (empty = empty) |
| RV1 | term1 | 5 | `cat ~/chiku.rviz` | 1 (rvizSave PENDING) | PENDING-dependent (site saved the file) | MATCH (no click, no file) |
| RV3 | term1 | 1 | `rviz2` | running | DIFFERS (cosmetic) | DIFFERS (cosmetic) |
| RV3 | term1 | 2 | `ros2 topic pub --once /visualization_marker … id: 0 …` | running, "Waiting…" ×12 | PENDING-dependent (Marker display click) | DIFFERS ("Waiting…" once) |
| RV3 | term1 | 3 | `ros2 topic pub --once /visualization_marker … id: 1 …` | running, "Waiting…" ×13 | PENDING-dependent | DIFFERS |
| UR7 | code1 | 1 | `ros2 launch ur_description view_ur.launch.py ur_type:=ur5e` | running | DIFFERS | DIFFERS |
| UR7 | code1 | 2 | `ros2 node list` | 0 | DIFFERS | DIFFERS |

The automatic `compare79.browser.json` marks RV3 #2/#3 as MATCH because a still-running command is compared only on the first line. Judged by hand, they are DIFFERS (the real line repeats every second; the site line does not).

## RViz editor blocks (t:"rviz"): NO FIXTURE

All 15 course rviz blocks are in these modules. None has real evidence yet; the RViz GUI baseline under `parity/fixtures/rviz/` is not available.

UR1 "Try it: colour Chiku's body" · UR2 "Try it: one link, three shapes" · UR3 "Try it: a pan-tilt camera head" · UR4 "See the frames of Chiku" · UR6 "Build it: finish the arm" · UR7 "Explore a 6-DOF arm" · UR7 "The real UR5e" · UR8 "Add physics to the pan-tilt head" · XT1 "Try it: finish Chiku in xacro" · XT2 "Build it: a 4-legged robot from one macro" · XT3 "Explore: the hexapod" · XT4 "Fix it: Chiku is 1000 times too big" · RV2 "Explore: Chiku in a room" · RV6 "The ROS2Lab robot gallery" · RV7 "Project: build Chiku the mobile manipulator".
