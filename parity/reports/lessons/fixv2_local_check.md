# fix-v2 local site check – lessons XT5, RV1, D4, D13, F12, F15, N10, N18, N19, N23 (2026-10-20)

Read-only check of the site after the FIX_V2 content fixes. Branch `fix-v2` at 11c6012, dev server
http://127.0.0.1:8000 (`public/`), headless Chromium (Playwright).

- Driver: `parity/scripts/lessons/site_lesson_check.mjs` (same harness as `tools46/site_browser.mjs`: each practice
  terminal block is rendered alone with `public/js/lesson-render.js`; every `sol` is typed; `newTerminal` opens a
  tab; RViz GUI steps are clicks: Fixed Frame field, Add dialog (`rviz_default_plugins/<Type>` row, double-click),
  2D Goal Pose drag on the 3D view, File → Save Config As). A tick = the task's `li` has class `done`.
- Site output: `parity/browser_out/lessons/fixv2_local/site_check.json` (all blocks) and
  `N10_late_listener_30s.json` (N10 re-run with a 30 s window for `late_listener`).
- Real: `parity/fixtures/lessons/<id>/term<N>.json` (re-captured in FIX_V2 for every lesson here). Step numbers below
  are indices into that file's `steps`.
- Compared after masking log timestamps and PIDs. Site lines of class `hint` (beginner hints, rule 5) are not
  differences unless they replace real output; none here does.

## Result

All **66 tasks in 11 practice terminals tick**; every block shows "All steps done"; 0 page errors.

| Lesson | Block | Ticks |
|---|---|---|
| XT5 | term1 | 8/8 |
| RV1 | term1 | 9/9 |
| D4 | term1 · term2 | 5/5 · 6/6 |
| D13 | term1 | 5/5 |
| F12 | term1 | 5/5 |
| F15 | term1 | 6/6 |
| N10 | term1 | 5/5 |
| N18 | term1 | 7/7 |
| N19 | term1 | 5/5 |
| N23 | term1 | 5/5 |

- **N23 test count:** site `colcon test-result --all` → `build/chiku_control/pytest.xml: 6 tests`, `Test.xml: 1 test`,
  `test_control_math.gtest.xml: 5 tests`, `Summary: 12 tests, 0 errors, 0 failures, 0 skipped` = REAL
  `N23/term1.json` step 4 (only the `Testing/<date>` folder name differs).
- **Bare `off: 0` still succeeds on the site** (D4 term 2, extra tab): `ros2 service call /turtle1/set_pen
  turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 4, off: 0}"` → SITE `requester: making request:
  turtlesim.srv.SetPen_Request(r=255, g=0, b=0, width=4, off=0)` / `response:` / `turtlesim.srv.SetPen_Response()`.
  REAL `Failed to populate field: attribute name must be string, not 'bool'`, exit 1
  (`parity/fixtures/lessons/_investigations/setpen_off_forms.txt`). → AUDIT_V2 #40 (new).

## Differences per lesson

"AUDIT" = the AUDIT_V2.md §F row that already covers it; **new** = row added with this report.

### XT5 term1 (`parity/fixtures/lessons/XT5/term1.json`)

| Task / step | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 · step 0 `robot_state_publisher … -p robot_description:="$(xacro …)"` | 6 × `[INFO] [robot_state_publisher]: got segment <link>` (base_footprint … right_wheel_link) | `[INFO] [T] [robot_state_publisher]: Robot initialized` | #14 |
| 2 · step 2 `tf2_echo base_footprint lidar_link` | starts with `At time 1792488615.530999808` (wall time), 2 samples, `^C`, hint; RPY `[0.000, 0.000, 0.000]` | first `[INFO] [T] [tf2_echo]: Waiting for transform base_footprint ->  lidar_link: Invalid frame ID "base_footprint" … target_frame - frame does not exist`, then `At time 0.0` every second until Ctrl+C (71 lines in 8 s); RPY `[0.000, -0.000, 0.000]` | #27 |
| 3 · step 4 `tf2_echo base_footprint left_wheel_link` (no joint states yet) | one `Waiting … Invalid frame ID "left_wheel_link" passed to canTransform argument source_frame - frame does not exist`, then `^C` + hint | first the `"base_footprint" … target_frame` line, then the `"left_wheel_link" … source_frame` line repeated ~1/s | #27 |
| 4 · step 6 `joint_state_publisher_gui` | `[INFO] [joint_state_publisher_gui]: Centering` + hint | `[joint_state_publisher]: Waiting for robot_description to be published on the robot_description topic...`, `Centering`, `Got description, configuring robot`, `Centering` | #14 |
| 5 · step 8 `tf2_echo base_footprint left_wheel_link` | `Translation: [-0.100, 0.170, 0.080]` (same value); no Waiting line; 2 samples, `^C` | `Waiting … "base_footprint" …` line first, then samples until Ctrl+C | #27 |
| 6 · step 10 `view_frames` | all 4 log lines carry the same stamp `1792488650.562999963`; Result `frame_yaml="base_link: \n  parent: 'base_footprint' left_wheel_link: \n  parent: 'base_link' ...")` (shortened); extra lines `Created frames_….pdf and frames_….gv in this folder. The PDF shows this tree:` + tree | stamps 5 s apart (`…513.88` → `…518.94`); full `frame_yaml` per frame with `parent`, `broadcaster: 'default_authority'`, `rate: 10.200` / `10000.000`, `most_recent_transform`, `oldest_transform`, `buffer_length` | **new #43** |
| 7 · step 11 `rviz2` | `Stereo is NOT SUPPORTED`, `OpenGl version: 4.6 (GLSL 4.6)` | `Stereo is NOT SUPPORTED`, `OpenGl version: 4.5 (GLSL 4.5)`, `Stereo is NOT SUPPORTED` | #39 |
| all | log lines `[INFO] [node]: …` | `[INFO] [<stamp>] [node]: …` | #26 |
| 8 · step 12 (GUI) | Fixed Frame → `base_footprint`; RobotModel and TF added | PENDING in the fixture (GUI) | coverage gap |

### RV1 term1 (`parity/fixtures/lessons/RV1/term1.json`)

| Task / step | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 · rsp | 6 × `got segment …` | `Robot initialized` | #14 |
| 2 · `joint_state_publisher` | nothing | `[joint_state_publisher]: Waiting for robot_description to be published on the robot_description topic...`, `Got description, configuring robot` | #14 |
| 3 · `rviz2` | `OpenGl version: 4.6`, Stereo line once | `4.5`, Stereo line twice | #39 |
| 4–6, 8 (GUI) | Fixed Frame `base_footprint`; RobotModel + TF added; 2D Goal Pose dragged; Save Config As `~/chiku.rviz` | PENDING (GUI) | coverage gap |
| 7 · step 9 `ros2 topic echo /goal_pose` | PoseStamped, `frame_id: base_footprint`, position x −0.278 y 0.087 | empty (the goal click is PENDING) | coverage gap (no real value) |
| 9 · `cat ~/chiku.rviz` | 158-line config (`Panels: - Class: rviz_common/Displays …`) | `cat: /home/student/chiku.rviz: No such file or directory`, exit 1 (save click PENDING) | coverage gap (no real value) |

### D4 term1 (`D4/term1.json`) · term2 (`D4/term2.json`)

| Task | SITE | REAL | AUDIT |
|---|---|---|---|
| term1 1, 2 (`topic type`, `interface show`) | same | same | – |
| term1 3, 5 · term2 2–5 `topic pub --once` | same 2 lines + hint `(The turtle moved …)` | same 2 lines | – (hint) |
| term1 4 `topic echo --once /turtle1/pose` | `x: 6.564407`, `y: 6.955775`, `theta: 1.8` | `x: 6.602816581726074`, `y: 6.938989639282227`, `theta: 1.8143999576568604` | #28 |
| term2 1 `SetPen … 'off': 0` | `requester: … off=0)`, `response:`, `SetPen_Response()` | `waiting for service to become available...` first, then the same 3 lines, exit 0 | **new #44** |
| term2 6 `topic echo --once /turtle1/pose` | `x: 7.546038`, `y: 7.544444`, `theta: 3.14` | `x: 7.536729335784912`, `y: 7.560305118560791`, `theta: -3.118065357208252` | #28 |
| bare `off: 0` probe | succeeds | `Failed to populate field: attribute name must be string, not 'bool'` (`_investigations/setpen_off_forms.txt`) | **new #40** |

### D13 term1 (`D13/term1.json`)

| Task | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 `Spawn raju`, 2 `SetPen 'off': 0` | no `waiting for service to become available...` line (+ hint after Spawn) | `waiting for service to become available...` first | **new #44** |
| 3, 4 `topic pub`, 5 `topic list` | same (+ hints) | same | – |

### F12 term1 (`F12/term1.json`)

| Task | SITE | REAL | AUDIT |
|---|---|---|---|
| 2 `colcon build --packages-select chiku_control_cpp` | `Finished <<< chiku_control_cpp [0.90s]`, `Summary: 1 package finished [1.27s]` | `[14.6s]`, `[15.4s]` | **new #45** |
| 3 `ros2 run chiku_control_cpp spawn_client` | `[INFO] [spawn_client]: turtlesim made a turtle called helper` | same with timestamp | #26 |
| 4 `SetPen 'off': 0`, 5 `topic pub` | same | same | – |

### F15 term1 (`F15/term1.json`)

| Task / step | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 colcon build | `[0.90s]` / `[1.27s]` | `[3.19s]` / `[3.58s]` | **new #45** |
| 3 · step 4 `ros2 param list /speed_driver` | `/speed_driver:` header, then `robot_name`, `speed`, `start_type_description_service`, `turn`, `use_sim_time` | the 5 names, no header | #32 |
| 2, 4, 5, 6 (`speed_driver` start, `param set 2.5`, echo `x: 2.5`, `fast` error, `param dump`) | same | same | – |

### N10 term1 (`N10/term1.json`)

| Task / step | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 colcon build | `[0.90s]` / `[1.27s]` | `[2.95s]` / `[3.34s]` | **new #45** |
| 3 · step 6 `ros2 run chiku_control late_listener` (new tab, after `cd ~/ros2_ws` + `source`) | **nothing** in 8 s, and nothing in a 30 s re-run (`fixv2_local/N10_late_listener_30s.json`); the node exists (`topic info` shows 1 subscription) | `I joined late but still got: "map of the warehouse is ready"` at once, then `50 poses received`, `100 …` … `400 poses received` (~62.5 poses/s) | **new #41** |
| 4 `ros2 topic info /map_status` | same (`Publisher count: 1`, `Subscription count: 1`) | same | – |
| 5 · step 9 `ros2 node info /late_listener` | Subscribers add `/parameter_events: rcl_interfaces/msg/ParameterEvent`; no blank line under `Service Clients:` / `Action Servers:` / `Action Clients:` | no `/parameter_events` subscriber; one blank line under each empty section | **new #42**; blank lines #30 |

### N18 term1 (`N18/term1.json`)

| Task / step | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 colcon build | `[0.90s]` / `[1.27s]` | `[3.10s]` / `[3.44s]` | **new #45** |
| 3 · step 3 `ros2 launch … turtle_goal.launch.py goal_x:=3.0 goal_y:=3.0` | after the 2 `process started` lines only `[INFO] [go_to_goal]: Goal reached: x=3.09 y=3.05` | `[turtlesim_node-1] [INFO] [T] [sim]: Starting turtlesim with node name /sim`, `… Spawning turtle [turtle1] at x=[5.544445] …`, `[go_to_goal-2] [INFO] [T] [go_to_goal]: Goal reached: x=3.08 y=3.05` | #20 |
| 5 · step 8 `two_robots.launch.xml with_monitor:=false` | `[INFO] [go_to_goal]: Goal reached: …` ×2, no `[exe-N]` prefix, logger `go_to_goal` | 4 turtlesim lines with loggers `robot1.sim` / `robot2.sim`, `[go_to_goal-4] … [robot2.go_to_goal]: Goal reached: x=8.94 y=2.07`, `[go_to_goal-2] … [robot1.go_to_goal]: … x=2.08 y=8.95` | #20; namespaced logger #21 |
| 2, 4, 6, 7 (`--show-args`, `param get` 3.0, `node list`, 9.0) | same | same | – |

### N19 term1 (`N19/term1.json`)

| Task / step | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 colcon build | `[0.90s]` / `[1.27s]` | `[17.0s]` / `[17.3s]` | **new #45** |
| 3 · step 6 `ros2 node info /turtle_tf_broadcaster` | Subscribers `/: turtlesim/msg/Pose`; Publishers lack `/tf`; no blank lines under empty sections | Subscribers `/turtle1/pose: turtlesim/msg/Pose`; Publishers include `/tf: tf2_msgs/msg/TFMessage`; blank lines | #21; blank lines #30 |
| 2, 4, 5 (broadcaster, broadcaster2, `turtlename` = `turtle2`) | same | same | – |

### N23 term1 (`N23/term1.json`)

| Task / step | SITE | REAL | AUDIT |
|---|---|---|---|
| 1 colcon build (2 packages) | `chiku_control [0.90s]`, `chiku_control_cpp [1.27s]` | `[5.05s]`, `[17.1s]` | **new #45** |
| 3 `colcon test` | finishes `chiku_control [1.10s]` before `chiku_control_cpp [1.70s]` | `chiku_control_cpp [1.09s]` before `chiku_control [1.62s]`; exit 0 | **new #45** |
| 4 `colcon test-result --verbose` | `Summary: 12 tests, …` + hint `Only failures are listed one by one. …` | `Summary: 12 tests, 0 errors, 0 failures, 0 skipped` | – (hint) |
| 2, 5 (`cat` test file, `test-result --all` 6 + 1 + 5 = 12) | same | same | – |

## Limits

- The driver did not find an editor for RobotModel's `Description Topic` after double-clicking its value cell
  ("Description Topic editor not found"), so that property was not set to `/robot_description`. XT5 task 8 and RV1
  task 5 tick anyway because their check only needs the displays. Whether a student can set it on the site is
  UNVERIFIED by this check (driver selector, not shown to be a site fault).
- RViz GUI steps have no real lesson fixture (PENDING, AUDIT_V2 decision 4), so RV1 tasks 4–9 are site-only.
- Running commands are read after the real capture window (8 s; `late_listener` also 30 s). Pose values after motion
  depend on timing; only the format is a finding (#28).
