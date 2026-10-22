# Lesson parity: Week 4 (W3, lessons D*), Week 5 (PF, lessons F*), Week 6 (NP, lessons N*)

Read-only audit, 2026-10-19, branch parity-v2. REAL = fixtures from a real Ubuntu 24.04 + ROS 2 Jazzy bash on a pty (`parity/fixtures/lessons/<lesson>/term<N>.json`, `termcode<k>.json`, made by `parity/scripts/lessons/run_lesson_terms.py`). SITE = the site's own `Shell` (public/js/terminal-sim.js) driven from Node like tools/check-content.mjs (`parity/browser_out/lessons/<lesson>/term<N>.site.json`) and the lesson renderer (public/js/lesson-render.js) driven in headless Chromium on http://127.0.0.1:8000 (`term<N>.browser.json`). Tools: `parity/browser_out/lessons/tools46/` (site_node.mjs, site_browser.mjs, site_code.mjs, compare46.py, gen_report.py).

Normalised before comparing: log timestamps, PIDs, UUID / 32-hex goal IDs, prasad↔student, host names, colcon timings, colcon's live status line (`[3.1s] [0/1 complete] …`, overwritten in place on a terminal), ls -l dates/sizes. MATCH-VALUES = same lines and number format, only timing-dependent values differ (counters, hz, poses). Site lines with class `hint` are excluded from the comparison and listed separately (rule 5); a hint is flagged only when it replaces real output. For a command real ROS left running (state 'still running after N s'), the real lines printed in that window are compared with the site's start-up lines; real lines of a kind the site never prints are counted as a difference.


**Node Shell pass:** 382 real commands compared in 62 blocks: MATCH 277, MATCH-VALUES 5, DIFFERS 100, PENDING 0, NOT-COMPARED 0.


**Browser pass:** 382 real commands compared in 62 blocks: MATCH 279, MATCH-VALUES 6, DIFFERS 97, PENDING 0, NOT-COMPARED 0.


Fixtures used: the re-captured set (all 62 W3/PF/NP fixture files rewritten 2026-10-19 22:12, `parity/fixtures/lessons/RECAPTURE_DONE`), so the shared-daemon cold-discovery artefacts of the first capture are gone. No real step in these lessons is PENDING (no sudo/apt/GUI steps).

Primary site capture = browser pass (the lesson renderer in Chromium, user nodes and turtle running in real time). The 33 code-block commands (`termcode*.json`) were compared against the Node Shell only (no browser pass for code blocks).

**Coverage:** 62 blocks = all 53 practice terminals with tasks (48 lessons) + 9 code-block fixtures (D6, D8, D11, F9, F15, N4, N8, N10, N19), i.e. 49 lessons. Lessons with every command MATCH or MATCH-VALUES: D1, D7, F1, F10, F11, N17b, N22. The other 42 lessons have at least one DIFFERS.

## Differences a student would notice first

Every line below is quoted from a fixture (REAL) or a site capture (SITE); file paths are in the per-command section further down.

1. **`off: 0` in a SetPen call: real ROS 2 refuses it, the site accepts it** (D4 term2 step1, D13 term1 step2, F12 term1 step4; these are the lessons' own solutions). REAL (exit 1): `Failed to populate field: attribute name must be string, not 'bool'` (YAML reads the key `off` as a boolean). SITE: `requester: making request: turtlesim.srv.SetPen_Request(r=255, g=0, b=0, width=4, off=0)` … `turtlesim.srv.SetPen_Response()`. The site hides a real failure, and the lesson solution does not work on real Jazzy (a content issue too).
2. **`colcon test` (N23 step3): real fails, site passes.** REAL (exit 5): `--- stderr: chiku_control` / `Ran 0 tests in 0.000s` / `NO TESTS RAN` / `Failed   <<< chiku_control [0.74s, exited with code 5]` / `Summary: 1 package finished` / `1 package failed: chiku_control`. SITE: `Finished <<< chiku_control [1.10s]` … `Summary: 2 packages finished [2.6s]`. Next, `colcon test-result --all` REAL lists no `build/chiku_control/pytest.xml` and `Summary: 6 tests`; SITE invents `build/chiku_control/pytest.xml: 6 tests` and `Summary: 12 tests`. Why the Python tests do not run on real Jazzy is UNVERIFIED (the fixture only shows that they were not collected); it is probably a lesson-file issue as well.
3. **Wrong `--params-file` path: real crashes, the site runs** (F15 code block step8, `ros2 run chiku_control speed_driver --ros-args --params-file config/speed.yaml` from ~/ros2_ws). REAL (exit 1): `[ERROR] [rcl]: Failed to parse global arguments`, a Traceback, `rclpy._rclpy_pybind11.RCLError: failed to initialize rcl: Couldn't parse params file: '--params-file config/speed.yaml'. Error: Error opening YAML file …`, `[ros2run]: Process exited with failure 1`. SITE: `[WARN] [rcl.logging_rosout]: Publisher already registered for node name: 'speed_driver'.` plus a hint about duplicate names. The site does not check that the file exists. (Node Shell capture.)
4. **colcon builds a package before the package it depends on** (F7, F8, F13, F14, F19, F20, N24b step1, `colcon build --packages-select my_robot_interfaces <pkg>`). REAL: `Starting >>> my_robot_interfaces` / `Finished <<< my_robot_interfaces [20.0s]` / `Starting >>> chiku_control` / `Finished <<< chiku_control [3.31s]`. SITE: `Starting >>> chiku_control` / `Starting >>> my_robot_interfaces` / `Finished <<< chiku_control [0.90s]` / `Finished <<< my_robot_interfaces [1.27s]`. Real also prints `[Processing: my_robot_interfaces]` when the interface build takes more than 30 s (timing-dependent).
5. **`ros2 launch` shows almost none of the nodes' output, and none of it is prefixed** (D9, F17 step6, F18, F19, F20, N18, N20, N24b). REAL prints, within the same window, `[turtlesim_node-1] [INFO] [T] [sim]: Starting turtlesim with node name /sim`, `[speed_driver-2] [INFO] [T] [speed_driver]: chiku is ready to drive`, `[pose_monitor-3] [INFO] [T] [pose_monitor]: x=6.52 y=5.81 …`. SITE stops after `[INFO] [pose_monitor-3]: process started with pid [4321]`. When a launched node does print, the `[exe-N] ` prefix and the timestamp are missing: SITE `[INFO] [go_to_goal]: Goal reached: x=3.09 y=3.05` vs REAL `[go_to_goal-2] [INFO] [T] [go_to_goal]: Goal reached: x=3.08 y=3.05` (N18).
6. **Wrong node names**: D9 `ros2 node list` after `ros2 launch turtlesim multisim.launch.py`: REAL `/turtlesim1/turtlesim`, `/turtlesim2/turtlesim`; SITE `/turtlesim1/sim`, `/turtlesim2/sim`. Ctrl+C on that launch, SITE `[INFO] [sim-1]: process has finished cleanly` vs REAL `[turtlesim_node-1]`. D2 term2 with `__ns:=/robot2`: REAL logger `[robot2.turtlesim]`, SITE `[turtlesim]`. N19 `ros2 node info /turtle_tf_broadcaster`: SITE lists a subscriber `/: turtlesim/msg/Pose` and no `/tf` publisher. REAL: `/turtle1/pose: turtlesim/msg/Pose` and `/tf: tf2_msgs/msg/TFMessage`.
7. **Missing or wrong error text**: D3 `ros2 topic echo /turtle1/Pose` REAL `WARNING: topic [/turtle1/Pose] does not appear to be published yet` + `Could not determine the type for the passed topic` (exit 1). SITE prints the WARNING, then a hint *instead of* the error line, so the hint replaces real output (rule 5). F17 step3 REAL `file 'circle.launch.py' was not found in the share directory of package 'chiku_control' which is at '/home/student/ros2_ws/install/chiku_control/share/chiku_control'`, SITE `… package 'chiku_control' at '…'` (missing "which is"). The same code is in public/js/ros-graph.js:2054 and terminal-sim.js:1290/ros-graph.js:2294.
8. **User nodes' periodic output missing or values wrong**: in the browser, `ros2 run chiku_control pose_monitor` (F5, F6), `chiku_control_cpp heartbeat` (N2: 10 beats then `10 beats done, stopping the timer`) and `battery_checker` (N21: `battery: 93 % (ok=1)` …) print nothing in the window where real prints 3 to 11 lines. N4 `log_demo --log-level log_demo:=debug` SITE prints only `Battery watcher started` (REAL 43 lines: DEBUG/INFO/WARN mix). Values: `/chiku/status` `battery: 0.0` (F7, F8, N24b; REAL 97.6 / 97.4 / 100.0, N24b REAL `moving: true` vs SITE `false`). N21 `ros2 service call /chiku/battery` SITE `message=''` vs REAL `message='58 %'`. N4 `ros2 topic echo --once /rosout` SITE prints an all-empty Log (`stamp: 0`, `level: 0`, `name: ''` …), REAL a real record (`level: 20`, `name: log_demo`, `msg: battery 40 %`, `file: …/log_demo.py`, `function: on_timer`, `line: 17`).
9. **Log lines have no timestamp on the site**: all 74 node log lines in the browser captures look like `[INFO] [turtlesim]: Starting turtlesim …`. Real Jazzy prints `[INFO] [1792425529.829585991] [turtlesim]: …`. (This is hidden by the normalisation, so it is counted here once, not per command.) Exception: `view_frames` lines in the Node Shell carry a fixed stamp (`[1792428175.775000095]`, the same on every line).
10. **Ctrl+C text** (end of almost every block): SITE `^C[INFO] [rclcpp]: signal_handler(signum=2)`. REAL C++ nodes: `[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)`. REAL rclpy nodes (F1, F3, F5, F7, F9, F13, F15, N7b, N9, N10, N17b): no `signal_handler` line at all. Launch Ctrl+C: REAL `[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)` then `[turtlesim_node-1] [INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)` per process. SITE prints a bare `^C[INFO] [rclcpp]: signal_handler(signum=2)` *before* the launch WARNING.

Further student-visible ones:
- **teleop banner** (D2, N8 code): REAL `Use g|b|v|c|d|e|r|t keys … 'f' to cancel a rotation.` / `'q' to quit.`. SITE upper-case `G|B|V|C|D|E|R|T`, `'F'`, `'Q'` (public/js/ros-graph.js:920, hero-turtle.js:449).
- **`ros2 param list /<node>`** (D7b, F15, F16): SITE adds a `/teleop_turtle:` header line. Real prints no header when a node is given.
- **`ros2 param get /patrol waypoints`** (N24b): REAL `Double values are: [2.0, 2.0, 9.0, 2.0, 9.0, 9.0, 2.0, 9.0]`, SITE `Double array value is: array('d', [2.0, …])`.
- **`ros2 topic hz`** (D3, D12): the site stops by itself after 2 reports and prints `^C` plus a hint. Real keeps running until Ctrl+C (exit behaviour; the values match).
- **`ros2 bag record`** (D12): SITE misses `[WARN] [ros2bag]: Positional "topics" argument deprecated. Please use optional "--topics" argument instead.`, `Event publisher thread: Started`, `Starting recording to 'drive'`, `Topics discovery started.`, `Topics discovery stopped.` and prints the rest in a different order. `ros2 bag play` misses `Press CURSOR_RIGHT/UP/DOWN …` (3 lines). `ros2 bag info` misses the last `Service information: ` line.
- **`ros2 doctor`** (D12): REAL ends `UserWarning: Publisher without subscriber detected on /turtle1/color_sensor.` / `… on /turtle1/pose.` / `All 5 checks passed`. SITE only `All 5 checks passed`. (Real also prints 101 `UserWarning: <pkg> has been updated to a new version` lines; these come from this machine's apt state and are not expected on the site.)
- **`ros2 action send_goal --feedback`** (D8): real sends feedback at turtlesim's 62.5 Hz (195 `Feedback:` blocks, 596 lines, for `theta: -1.57`: `remaining: -3.122000217437744`, `-3.1059999465942383`, …). The site sends 4 (`-3.14`, `-2.198`, `-1.256`, `-0.314`). Results: REAL `delta: -1.5520000457763672`, SITE `delta: -1.572`. F13/F14 user action server: REAL 40 / 20 `Feedback:` blocks, SITE 4 / 4. `Sending goal: theta: 0.0` REAL vs `theta: 0` SITE (D8 t2 step2).
- **tf2_echo** (N19 code): REAL first prints `Waiting for transform world ->  turtle1: Invalid frame ID "world" …` and `RPY (radian) [0.000, -0.000, 0.000]`. SITE starts with `At time …` and prints `0.000` instead of `-0.000`. `view_frames` (D11, N19 code): the site's Result line shortens the YAML to `…'world' ...")`.
- **Latched topic** (N10 code, Node Shell): `ros2 topic echo /map_status --qos-durability transient_local …` REAL `data: map of the warehouse is ready`, SITE `data: 'Hello World: 0'`, `'Hello World: 1'` … (wrong data). `ros2 topic info /map_status --verbose` SITE `Durability: VOLATILE` (REAL `TRANSIENT_LOCAL`), `Topic type hash: RIHS01_…` (truncated), `Subscription count: 0` (REAL 1, the ros2cli echo node).
- **`ros2 pkg create`** (D10 term2): SITE misses the `[WARNING]: Unknown license 'TODO: License declaration'. …` block and its license list (13 lines).
- **`ros2 component types`** (N22b): SITE lists only `chiku_control_cpp::CircleComponent`. REAL lists every installed component package (209 lines on this machine; part of that list depends on what is installed here).
- **demo_nodes_py talker** (D12 term2): REAL `Publishing: "Hello World: 0"` (double quotes, starts at 0), SITE `Publishing: 'Hello World: 1'` (single quotes, starts at 1).

## Cosmetic / format-only

- **`ros2 node info`** (14 commands): real prints an empty line under each empty section (`Service Clients:` / *(blank)* / `Action Servers:` / *(blank)*). The site prints none. For rclpy nodes (F3, F5, F19, D12 /listener) the site adds `/parameter_events: rcl_interfaces/msg/ParameterEvent` under Subscribers. Real rclpy nodes do not subscribe to it.
- **Float printing** (18 `echo --once` commands): real prints float32 fields at full repr (`x: 5.544444561004639`, `theta: 1.8143999576568604`), the site rounds to 6 digits (`x: 5.544445`) and sometimes 1 to 2 (`theta: 1.8`, `3.14`). Pose values after motion also differ (timing; format is the finding).
- **`ros2 service call`**: real sometimes prints `waiting for service to become available...` first (5 commands after re-capture; it depends on discovery timing). The site never does for user/turtlesim services.
- **`ls dir1 dir2`** (D10): real separates the two listings with a blank line; the site does not.
- **`ros2 pkg create`** maintainer shows the real user (`prasad`), normalised.
- `ros2 topic echo --once /chatter` value (`Hello World: 18` vs `0`), `ros2 topic hz` numbers, `ros2 topic info /rosout` publisher count (N4: REAL 2, SITE 1): MATCH-VALUES.

## Content problems found on the way (not site-vs-real)

- `node tools/check-content.mjs` reports 3 lessons in scope whose solutions do not complete their own tasks, confirmed in the browser (tasks done after typing every solution): N10 2/5, N18 4/7, N19 3/5. Cause, the same on real ROS and on the site: the solution opens a new terminal and runs a workspace package without `source install/setup.bash`. REAL N10 step4 `Package 'chiku_control' not found`, N18 step6 `Package 'chiku_control' not found: "package 'chiku_control' not found, searching: ['/opt/ros/jazzy']"`, N19 step5 `Package 'chiku_control_cpp' not found`. The site prints the same error lines (MATCH) and adds a hint. The fix belongs in the lesson solutions (content/course-content.json), not in the simulator.
- The SetPen `off: 0` solutions (D4, D13, F12) and the N23 Python tests fail on real Jazzy (items 1 and 2 above).



## Per lesson

| Lesson | Block | Title | MATCH | MATCH-VALUES | DIFFERS | PENDING | Verdict |
|---|---|---|---|---|---|---|---|
| D1 | 1 | Practice: look at a live graph | 4 | 1 | 0 | 0 | MATCH |
| D2 | 1 | Practice: start and inspect nodes | 8 | 0 | 2 | 0 | DIFFERS |
| D2 | 2 | Practice: two robots side by side | 3 | 0 | 2 | 0 | DIFFERS |
| D3 | 1 | Practice: spy on turtlesim's topics | 3 | 1 | 2 | 0 | DIFFERS |
| D4 | 1 | Practice: drive the turtle by typing messages | 4 | 0 | 1 | 0 | DIFFERS |
| D4 | 2 | Practice: draw a red square | 4 | 0 | 2 | 0 | DIFFERS |
| D6 | 1 | Practice: create a second turtle | 4 | 0 | 1 | 0 | DIFFERS |
| D6 | code1 | Lesson code block commands: interface show Spawn | 1 | 0 | 0 | 0 | MATCH |
| D7 | 1 | Practice: turn turtlesim's knobs | 6 | 0 | 0 | 0 | MATCH |
| D7b | 1 | Practice: tune the keyboard driver | 3 | 0 | 1 | 0 | DIFFERS |
| D8 | 1 | Practice: give the turtle a long job | 2 | 0 | 2 | 0 | DIFFERS |
| D8 | 2 | Practice: point the turtle in every direction | 0 | 0 | 3 | 0 | DIFFERS |
| D8 | code1 | Lesson code block commands: interface show RotateAbsolute | 1 | 0 | 0 | 0 | MATCH |
| D9 | 1 | Practice: launch two simulators | 2 | 0 | 2 | 0 | DIFFERS |
| D10 | 1 | Practice: your first package | 7 | 0 | 0 | 0 | MATCH |
| D10 | 2 | Practice: a C++ package too | 4 | 0 | 2 | 0 | DIFFERS |
| D12 | 1 | Practice: record and replay a drive | 0 | 0 | 5 | 0 | DIFFERS |
| D12 | 2 | Debugging mission: why is the listener silent? | 2 | 1 | 2 | 0 | DIFFERS |
| D13 | 1 | Mission: two delivery robots | 4 | 0 | 1 | 0 | DIFFERS |
| F1 | 1 | Live terminal: create, write, register, build and run YOUR n | 8 | 0 | 0 | 0 | MATCH |
| F2 | 1 | Live terminal: your first C++ node | 6 | 0 | 1 | 0 | DIFFERS |
| F3 | 1 | Live terminal: your publisher drives the turtle | 5 | 0 | 1 | 0 | DIFFERS |
| F4 | 1 | Live terminal: change the C++ code, rebuild, drive | 4 | 0 | 1 | 0 | DIFFERS |
| F5 | 1 | Live terminal: your subscriber listens to turtlesim | 4 | 0 | 3 | 0 | DIFFERS |
| F6 | 1 | Live terminal: the C++ monitor | 4 | 0 | 2 | 0 | DIFFERS |
| F7 | 1 | Live terminal: make the message, build it, publish it | 8 | 0 | 2 | 0 | DIFFERS |
| F8 | 1 | Live terminal: the C++ status publisher | 6 | 0 | 2 | 0 | DIFFERS |
| F9 | 1 | Live terminal: switch the robot on and off | 5 | 0 | 2 | 0 | DIFFERS |
| F9 | code1 | Lesson code block commands: interface show SetBool | 1 | 0 | 0 | 0 | MATCH |
| F10 | 1 | Live terminal: the C++ safety switch | 7 | 0 | 0 | 0 | MATCH |
| F11 | 1 | Live terminal: your clients at work | 6 | 0 | 0 | 0 | MATCH |
| F12 | 1 | Live terminal: change the request, rebuild, spawn | 4 | 0 | 1 | 0 | DIFFERS |
| F13 | 1 | Live terminal: goals, feedback and cancel | 5 | 0 | 4 | 0 | DIFFERS |
| F14 | 1 | Live terminal: the C++ action server | 6 | 0 | 3 | 0 | DIFFERS |
| F15 | 1 | Live terminal: tune the robot without touching the code | 7 | 0 | 1 | 0 | DIFFERS |
| F15 | code1 | Lesson code block commands: speed_driver with -p and with -- | 7 | 0 | 1 | 0 | DIFFERS |
| F16 | 1 | Live terminal: C++ parameters | 6 | 0 | 1 | 0 | DIFFERS |
| F17 | 1 | Live terminal: install and launch | 6 | 0 | 2 | 0 | DIFFERS |
| F18 | 1 | Live terminal: install and launch the C++ nodes | 5 | 0 | 1 | 0 | DIFFERS |
| F19 | 1 | Live terminal: run the mission | 6 | 0 | 5 | 0 | DIFFERS |
| F20 | 1 | Live terminal: the C++ mission | 5 | 0 | 4 | 0 | DIFFERS |
| N2 | 1 | Live terminal: measure your timer's rate | 3 | 0 | 2 | 0 | DIFFERS |
| N4 | 1 | Live terminal: change the log level | 2 | 1 | 2 | 0 | DIFFERS |
| N4 | code1 | Lesson code block commands: log levels (chiku_control_cpp is | 5 | 0 | 1 | 0 | DIFFERS |
| N5 | 1 | Live terminal: watch YOUR state machine drive a square | 3 | 0 | 2 | 0 | DIFFERS |
| N7b | 1 | Live terminal: drive to goals you choose | 6 | 1 | 1 | 0 | DIFFERS |
| N8 | 1 | Live terminal: put the filter between you and the turtle | 6 | 0 | 1 | 0 | DIFFERS |
| N8 | code1 | Lesson code block commands: python safety_filter (not built  | 1 | 0 | 2 | 0 | DIFFERS |
| N9 | 1 | Live terminal: publish and inspect a JointState | 5 | 0 | 1 | 0 | DIFFERS |
| N10 | 1 | Live terminal: a latched topic | 6 | 0 | 0 | 0 | MATCH |
| N10 | code1 | Lesson code block commands: echo latched topic with QoS + in | 3 | 0 | 2 | 0 | DIFFERS |
| N17b | 1 | Live terminal: try to break the cruise control | 8 | 0 | 0 | 0 | MATCH |
| N18 | 1 | Live terminal: launch one robot, then two | 7 | 0 | 1 | 0 | DIFFERS |
| N19 | 1 | Live terminal: broadcast and inspect frames | 5 | 0 | 1 | 0 | DIFFERS |
| N19 | code1 | Lesson code block commands: tf2_echo world turtle1 + view_fr | 4 | 0 | 2 | 0 | DIFFERS |
| N20 | 1 | Live terminal: launch the chase | 4 | 0 | 2 | 0 | DIFFERS |
| N21 | 1 | Live terminal: a node that is server and client at once | 3 | 0 | 3 | 0 | DIFFERS |
| N22 | 1 | Live terminal: configure and activate by hand | 9 | 0 | 0 | 0 | MATCH |
| N22b | 1 | Live terminal: load a component into a container | 8 | 0 | 1 | 0 | DIFFERS |
| N23 | 1 | Live terminal: run the test suites | 2 | 1 | 2 | 0 | DIFFERS |
| N24b | 1 | Live terminal: run and operate the patrol robot | 5 | 0 | 5 | 0 | DIFFERS |
| D11 | code1 | Lesson code block commands: tf2_echo map base_link + view_fr | 1 | 0 | 1 | 0 | DIFFERS |

Lessons D5, D11 (practice block), N7, N17, N24 have no practice terminal with tasks (D11 has a code-block fixture, below).


## Differences, command by command (browser pass)


### D1 1: Practice: look at a live graph

Real: `parity/fixtures/lessons/D1/term1.json` · Site: `parity/browser_out/lessons/D1/term1.browser.json`

**Step 3 (task 3, terminal 1) MATCH-VALUES:** `ros2 topic echo --once /chatter`  (real exit 0, finished)

REAL:

    data: 'Hello World: 18'
    ---

SITE:

    data: 'Hello World: 0'
    ---


### D2 1: Practice: start and inspect nodes

Real: `parity/fixtures/lessons/D2/term1.json` · Site: `parity/browser_out/lessons/D2/term1.browser.json`

**Step 4 (task 3, terminal 2) DIFFERS:** `ros2 run turtlesim turtle_teleop_key`  (real exit None, still running after 8 s; running: first 5 line(s) compared (real 5, site 5))

REAL:

    Reading from keyboard
    ---------------------------
    Use arrow keys to move the turtle.
    Use g|b|v|c|d|e|r|t keys to rotate to absolute orientations. 'f' to cancel a rotation.
    'q' to quit.

SITE:

    Reading from keyboard
    ---------------------------
    Use arrow keys to move the turtle.
    Use G|B|V|C|D|E|R|T keys to rotate to absolute orientations. 'F' to cancel a rotation.
    'Q' to quit.

**Step 7 (task 5, terminal 3) DIFFERS:** `ros2 node info /turtlesim`  (real exit 0, finished)

REAL (from line 25):

      Service Clients:
    
      Action Servers:
        /turtle1/rotate_absolute: turtlesim/action/RotateAbsolute
      Action Clients:

SITE (from line 25):

      Service Clients:
      Action Servers:
        /turtle1/rotate_absolute: turtlesim/action/RotateAbsolute
      Action Clients:


### D2 2: Practice: two robots side by side

Real: `parity/fixtures/lessons/D2/term2.json` · Site: `parity/browser_out/lessons/D2/term2.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `ros2 run turtlesim turtlesim_node --ros-args --remap __ns:=/robot2`  (real exit None, still running after 8 s; running: first 2 line(s) compared (real 2, site 2))

REAL:

    [INFO] [1792425529.829585991] [robot2.turtlesim]: Starting turtlesim with node name /robot2/turtlesim
    [INFO] [1792425529.842380200] [robot2.turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]

SITE:

    [INFO] [turtlesim]: Starting turtlesim with node name /robot2/turtlesim
    [INFO] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]

**Step 4 (task 4, terminal 2) DIFFERS:** `ros2 node info /teleop_turtle`  (real exit 0, finished)

REAL (from line 16):

      Service Clients:
    
      Action Servers:
    
      Action Clients:
        /turtle1/rotate_absolute: turtlesim/action/RotateAbsolute

SITE (from line 16):

      Service Clients:
      Action Servers:
      Action Clients:
        /turtle1/rotate_absolute: turtlesim/action/RotateAbsolute


### D3 1: Practice: spy on turtlesim's topics

Real: `parity/fixtures/lessons/D3/term1.json` · Site: `parity/browser_out/lessons/D3/term1.browser.json`

**Step 4 (task 4, terminal 1) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 5.544444561004639
    y: 5.544444561004639
    theta: 0.0
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 5.544445
    y: 5.544445
    theta: 0.0
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

**Step 5 (task 5, terminal 1) MATCH-VALUES:** `ros2 topic hz /turtle1/pose`  (real exit None, still running after 8 s; running: first 4 line(s) compared (real 12, site 4))

REAL (from line 1):

    average rate: 62.533
    	min: 0.015s max: 0.017s std dev: 0.00038s window: 64
    average rate: 62.494
    	min: 0.015s max: 0.017s std dev: 0.00046s window: 127
    average rate: 62.504
    	min: 0.015s max: 0.017s std dev: 0.00044s window: 190
    average rate: 62.510
    	min: 0.015s max: 0.017s std dev: 0.00043s window: 253
    average rate: 62.512
    	min: 0.014s max: 0.018s std dev: 0.00043s window: 316
    average rate: 62.504
    	min: 0.014s max: 0.018s std dev: 0.00043s window: 379

SITE (from line 1):

    average rate: 62.498
    	min: 0.015s max: 0.017s std dev: 0.00041s window: 63
    average rate: 62.504
    	min: 0.015s max: 0.017s std dev: 0.00041s window: 125
    ^C
    About 62.5 messages per second. On a real computer it keeps measuring until you press Ctrl+C.   «hint»

**Step 6 (task 6, terminal 1) DIFFERS:** `ros2 topic echo /turtle1/Pose`  (real exit 1, finished)

REAL:

    WARNING: topic [/turtle1/Pose] does not appear to be published yet
    Could not determine the type for the passed topic

SITE:

    WARNING: topic [/turtle1/Pose] does not appear to be published yet
    Nobody uses /turtle1/Pose. Check the spelling (names are case-sensitive) with: ros2 topic list   «hint»


### D4 1: Practice: drive the turtle by typing messages

Real: `parity/fixtures/lessons/D4/term1.json` · Site: `parity/browser_out/lessons/D4/term1.browser.json`

**Step 4 (task 4, terminal 1) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 6.602816581726074
    y: 6.938989639282227
    theta: 1.8143999576568604
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 6.564407
    y: 6.955775
    theta: 1.8
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### D4 2: Practice: draw a red square

Real: `parity/fixtures/lessons/D4/term2.json` · Site: `parity/browser_out/lessons/D4/term2.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 4, off: 0}"`  (real exit 1, finished)

REAL:

    Failed to populate field: attribute name must be string, not 'bool'

SITE:

    requester: making request: turtlesim.srv.SetPen_Request(r=255, g=0, b=0, width=4, off=0)
    
    response:
    turtlesim.srv.SetPen_Response()
    

**Step 6 (task 6, terminal 1) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 7.536729335784912
    y: 7.560305118560791
    theta: -3.118065357208252
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 7.546038
    y: 7.544444
    theta: 3.14
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### D6 1: Practice: create a second turtle

Real: `parity/fixtures/lessons/D6/term1.json` · Site: `parity/browser_out/lessons/D6/term1.browser.json`

**Step 3 (task 3, terminal 1) DIFFERS:** `ros2 service call /spawn turtlesim/srv/Spawn "{x: 2, y: 2, theta: 0.2, name: ''}"`  (real exit 0, finished)

REAL:

    waiting for service to become available...
    requester: making request: turtlesim.srv.Spawn_Request(x=2.0, y=2.0, theta=0.2, name='')
    
    response:
    turtlesim.srv.Spawn_Response(name='turtle2')

SITE:

    requester: making request: turtlesim.srv.Spawn_Request(x=2.0, y=2.0, theta=0.2, name='')
    
    response:
    turtlesim.srv.Spawn_Response(name='turtle2')
    
    (A new turtle, turtle2, appeared. It brings its own topics: see ros2 topic list)   «hint»


### D7b 1: Practice: tune the keyboard driver

Real: `parity/fixtures/lessons/D7b/term1.json` · Site: `parity/browser_out/lessons/D7b/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `ros2 param list /teleop_turtle`  (real exit 0, finished)

REAL (from line 1):

      qos_overrides./parameter_events.publisher.depth
      qos_overrides./parameter_events.publisher.durability
      qos_overrides./parameter_events.publisher.history
      qos_overrides./parameter_events.publisher.reliability
      scale_angular
      scale_linear
      start_type_description_service
      use_sim_time

SITE (from line 1):

    /teleop_turtle:
      qos_overrides./parameter_events.publisher.depth
      qos_overrides./parameter_events.publisher.durability
      qos_overrides./parameter_events.publisher.history
      qos_overrides./parameter_events.publisher.reliability
      scale_angular
      scale_linear
      start_type_description_service
      use_sim_time


### D8 1: Practice: give the turtle a long job

Real: `parity/fixtures/lessons/D8/term1.json` · Site: `parity/browser_out/lessons/D8/term1.browser.json`

**Step 3 (task 3, terminal 1) DIFFERS:** `ros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: 1.57}"`  (real exit 0, finished)

REAL (from line 7):

    Result:
        delta: -1.5520000457763672
    
    Goal finished with status: SUCCEEDED

SITE (from line 7):

    Result:
        delta: -1.572
    
    Goal finished with status: SUCCEEDED

**Step 4 (task 4, terminal 1) DIFFERS:** `ros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: -1.57}" --feedback`  (real exit 0, finished)

REAL (from line 7):

    Feedback:
        remaining: -3.122000217437744
    
    Feedback:
        remaining: -3.1059999465942383
    
    Feedback:
        remaining: -3.0900001525878906
    
    Feedback:
        remaining: -3.0739998817443848
    
    Feedback:
        remaining: -3.058000087738037
    … (575 more lines)

SITE (from line 7):

    Feedback:
        remaining: -3.14
    
    Feedback:
        remaining: -2.198
    
    Feedback:
        remaining: -1.256
    
    Feedback:
        remaining: -0.314
    
    Result:
        delta: 3.142
    … (2 more lines)


### D8 2: Practice: point the turtle in every direction

Real: `parity/fixtures/lessons/D8/term2.json` · Site: `parity/browser_out/lessons/D8/term2.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `ros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: 3.14}" --feedback`  (real exit 0, finished)

REAL (from line 7):

    Feedback:
        remaining: 3.140000104904175
    
    Feedback:
        remaining: 3.124000072479248
    
    Feedback:
        remaining: 3.1080000400543213
    
    Feedback:
        remaining: 3.0920000076293945
    
    Feedback:
        remaining: 3.076000213623047
    … (581 more lines)

SITE (from line 7):

    Feedback:
        remaining: 3.14
    
    Feedback:
        remaining: 2.198
    
    Feedback:
        remaining: 1.256
    
    Feedback:
        remaining: 0.314
    
    Result:
        delta: -3.142
    … (2 more lines)

**Step 2 (task 2, terminal 1) DIFFERS:** `ros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: 0.0}"`  (real exit 0, finished)

REAL (from line 2):

    Sending goal:
         theta: 0.0
    
    Goal accepted with ID: 5b972d2ec4fe4af888881b512b5cb12e
    
    Result:
        delta: 3.119999885559082
    
    Goal finished with status: SUCCEEDED

SITE (from line 2):

    Sending goal:
         theta: 0
    
    Goal accepted with ID: 2a73f98418b55f64d6ea827812ed4976
    
    Result:
        delta: 3.142
    
    Goal finished with status: SUCCEEDED

**Step 3 (task 3, terminal 1) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 5.544444561004639
    y: 5.544444561004639
    theta: 0.01600000075995922
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 5.544445
    y: 5.544445
    theta: 0.0
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### D9 1: Practice: launch two simulators

Real: `parity/fixtures/lessons/D9/term1.json` · Site: `parity/browser_out/lessons/D9/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `ros2 launch turtlesim multisim.launch.py`  (real exit None, still running after 8 s; running: first 4 line(s) compared (real 8, site 4); 4 real line(s) of other kinds missing on site)

REAL:

    [INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-19-21-32-51-336905-prasad-1194268
    [INFO] [launch]: Default logging verbosity is set to INFO
    [INFO] [turtlesim_node-1]: process started with pid [1194271]
    [INFO] [turtlesim_node-2]: process started with pid [1194272]
    [turtlesim_node-2] [INFO] [1792425771.691207523] [turtlesim2.turtlesim]: Starting turtlesim with node name /turtlesim2/turtlesim
    [turtlesim_node-1] [INFO] [1792425771.695135719] [turtlesim1.turtlesim]: Starting turtlesim with node name /turtlesim1/turtlesim
    [turtlesim_node-2] [INFO] [1792425771.704897563] [turtlesim2.turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [turtlesim_node-1] [INFO] [1792425771.708667654] [turtlesim1.turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]

SITE:

    [INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-02-10-15-04-120000-ros2lab-4321
    [INFO] [launch]: Default logging verbosity is set to INFO
    [INFO] [turtlesim_node-1]: process started with pid [4330]
    [INFO] [turtlesim_node-2]: process started with pid [4332]

Real lines of a kind the site never printed:

    [turtlesim_node-2] [INFO] [1792425771.691207523] [turtlesim2.turtlesim]: Starting turtlesim with node name /turtlesim2/turtlesim
    [turtlesim_node-1] [INFO] [1792425771.695135719] [turtlesim1.turtlesim]: Starting turtlesim with node name /turtlesim1/turtlesim
    [turtlesim_node-2] [INFO] [1792425771.704897563] [turtlesim2.turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [turtlesim_node-1] [INFO] [1792425771.708667654] [turtlesim1.turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]

**Step 2 (task 2, terminal 2) DIFFERS:** `ros2 node list`  (real exit 0, finished)

REAL:

    /turtlesim1/turtlesim
    /turtlesim2/turtlesim

SITE:

    /turtlesim1/sim
    /turtlesim2/sim


### D10 2: Practice: a C++ package too

Real: `parity/fixtures/lessons/D10/term2.json` · Site: `parity/browser_out/lessons/D10/term2.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `ros2 pkg create --build-type ament_cmake --node-name hello chiku_cpp`  (real exit 0, finished)

REAL (from line 18):

    creating ./chiku_cpp/src/hello.cpp
    
    [WARNING]: Unknown license 'TODO: License declaration'.  This has been set in the package.xml, but no LICENSE file has been created.
    It is recommended to use one of the ament license identifiers:
    Apache-2.0
    BSL-1.0
    BSD-2.0
    BSD-2-Clause
    BSD-3-Clause
    GPL-3.0-only
    LGPL-3.0-only
    MIT
    MIT-0

SITE (from line 18):

    creating ./chiku_cpp/src/hello.cpp

**Step 2 (task 2, terminal 1) DIFFERS:** `ls chiku_cpp chiku_cpp/src`  (real exit 0, finished)

REAL:

    chiku_cpp:
    CMakeLists.txt  include  package.xml  src
    
    chiku_cpp/src:
    hello.cpp

SITE:

    chiku_cpp:
    CMakeLists.txt  include  package.xml  src
    chiku_cpp/src:
    hello.cpp


### D12 1: Practice: record and replay a drive

Real: `parity/fixtures/lessons/D12/term1.json` · Site: `parity/browser_out/lessons/D12/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `ros2 bag record -o drive /turtle1/cmd_vel /turtle1/pose`  (real exit None, still running after 8 s; running: first 6 line(s) compared (real 11, site 6); 2 real line(s) of other kinds missing on site)

REAL (from line 1):

    [WARN] [ros2bag]: Positional "topics" argument deprecated. Please use optional "--topics" argument instead.
    [INFO] [1792425827.839709521] [rosbag2_recorder]: Press SPACE for pausing/resuming
    [INFO] [1792425827.839745559] [rosbag2_recorder]: Event publisher thread: Started
    [INFO] [1792425827.845625074] [rosbag2_recorder]: Starting recording to 'drive'
    [INFO] [1792425827.848579021] [rosbag2_recorder]: Listening for topics...
    [INFO] [1792425827.848635444] [rosbag2_recorder]: Recording...
    [INFO] [1792425827.848744960] [rosbag2_recorder]: Topics discovery started.
    [INFO] [1792425827.950867156] [rosbag2_recorder]: Subscribed to topic '/turtle1/cmd_vel'
    [INFO] [1792425827.959852457] [rosbag2_recorder]: Subscribed to topic '/turtle1/pose'
    [INFO] [1792425827.959996285] [rosbag2_recorder]: All requested topics are subscribed. Stopping discovery...
    [INFO] [1792425827.960022391] [rosbag2_recorder]: Topics discovery stopped.

SITE (from line 1):

    [INFO] [rosbag2_recorder]: Press SPACE for pausing/resuming
    [INFO] [rosbag2_recorder]: Listening for topics...
    [INFO] [rosbag2_recorder]: Subscribed to topic '/turtle1/cmd_vel'
    [INFO] [rosbag2_recorder]: Subscribed to topic '/turtle1/pose'
    [INFO] [rosbag2_recorder]: Recording...
    [INFO] [rosbag2_recorder]: All requested topics are subscribed. Stopping discovery...
    ^C
    Practice terminal: recorded about 20 seconds, then stopped (on a real computer: Ctrl+C). The bag is the folder drive/   «hint»

Real lines of a kind the site never printed:

    [INFO] [1792425827.848744960] [rosbag2_recorder]: Topics discovery started.
    [INFO] [1792425827.960022391] [rosbag2_recorder]: Topics discovery stopped.

**Step 2 (task 2, terminal 1) DIFFERS:** `ros2 bag info drive`  (real exit 0, finished)

REAL (from line 1):

    Files:             drive_0.mcap
    Bag size:          37.4 KiB
    Storage id:        mcap
    ROS Distro:        jazzy
    Duration:          6.992515853s
    Start:             Oct 19 2026 21:33:47.973260163 (1792425827.973260163)
    End:               Oct 19 2026 21:33:54.965776016 (1792425834.965776016)
    Messages:          438
    Topic information: Topic: /turtle1/cmd_vel | Type: geometry_msgs/msg/Twist | Count: 0 | Serialization Format: cdr
                       Topic: /turtle1/pose | Type: turtlesim/msg/Pose | Count: 438 | Serialization Format: cdr
    Service:           0
    Service information: 

SITE (from line 1):

    Files:             drive_0.mcap
    Bag size:          48.3 KiB
    Storage id:        mcap
    ROS Distro:        jazzy
    Duration:          20.012s
    Start:             Oct  2 2026 10:15:04.120 (1790921104.120)
    End:               Oct  2 2026 10:15:24.132 (1790921124.132)
    Messages:          1259
    Topic information: Topic: /turtle1/cmd_vel | Type: geometry_msgs/msg/Twist | Count: 9 | Serialization Format: cdr
                       Topic: /turtle1/pose | Type: turtlesim/msg/Pose | Count: 1250 | Serialization Format: cdr
    Service:           0

**Step 3 (task 3, terminal 1) DIFFERS:** `ros2 bag play drive`  (real exit None, still running after 8 s; running: first 4 line(s) compared (real 7, site 4); 2 real line(s) of other kinds missing on site)

REAL:

    [INFO] [1792425837.975876941] [rosbag2_player]: Set rate to 1
    [INFO] [1792425837.988152427] [rosbag2_player]: Adding keyboard callbacks.
    [INFO] [1792425837.988208973] [rosbag2_player]: Press SPACE for Pause/Resume
    [INFO] [1792425837.988220203] [rosbag2_player]: Press CURSOR_RIGHT for Play Next Message
    [INFO] [1792425837.988233740] [rosbag2_player]: Press CURSOR_UP for Increase Rate 10%
    [INFO] [1792425837.988244513] [rosbag2_player]: Press CURSOR_DOWN for Decrease Rate 10%
    [INFO] [1792425837.989590866] [rosbag2_player]: Playback until timestamp: -1

SITE:

    [INFO] [rosbag2_player]: Set rate to 1
    [INFO] [rosbag2_player]: Adding keyboard callbacks.
    [INFO] [rosbag2_player]: Press SPACE for Pause/Resume
    [INFO] [rosbag2_player]: Playback until timestamp: -1
    (The recorded messages were published again, exactly as they happened. The turtle repeated the same drive!)   «hint»

Real lines of a kind the site never printed:

    [INFO] [1792425837.988233740] [rosbag2_player]: Press CURSOR_UP for Increase Rate 10%
    [INFO] [1792425837.988244513] [rosbag2_player]: Press CURSOR_DOWN for Decrease Rate 10%

**Step 4 (task 4, terminal 1) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 5.544444561004639
    y: 5.544444561004639
    theta: 0.0
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 4.712294
    y: 8.682635
    theta: -2.683185
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

**Step 5 (task 5, terminal 1) DIFFERS:** `ros2 doctor`  (real exit 0, finished)

REAL (from line 1):

    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: dwb_plugins has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_loopback_sim has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: range_sensor_broadcaster has been updated to a new version. local: 4.42.1 < latest: 4.43.0
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: controller_manager has been updated to a new version. local: 4.48.1 < latest: 4.49.0
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_behaviors has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_core has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: ros_gz_interfaces has been updated to a new version. local: 1.0.24 < latest: 1.0.25
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_voxel_grid has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: realsense2_description has been updated to a new version. local: 4.58.4 < latest: 4.59.1
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav_2d_utils has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: nav2_graceful_controller has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: opennav_docking_bt has been updated to a new version. local: 1.3.13 < latest: 1.3.14
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: position_controllers has been updated to a new version. local: 4.42.1 < latest: 4.43.0
    /opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/package.py: 122: UserWarning: tricycle_controller has been updated to a new version. local: 4.42.1 < latest: 4.43.0
    … (91 more lines)

SITE (from line 1):

    
    All 5 checks passed


### D12 2: Debugging mission: why is the listener silent?

Real: `parity/fixtures/lessons/D12/term2.json` · Site: `parity/browser_out/lessons/D12/term2.browser.json`

**Step 2 (task 2, terminal 1) DIFFERS:** `ros2 node info /listener`  (real exit 0, finished)

REAL (from line 3):

        /chatter: std_msgs/msg/String
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
      Service Servers:
        /listener/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /listener/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /listener/get_parameters: rcl_interfaces/srv/GetParameters
        /listener/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /listener/list_parameters: rcl_interfaces/srv/ListParameters
        /listener/set_parameters: rcl_interfaces/srv/SetParameters
        /listener/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
      Service Clients:
    
    … (3 more lines)

SITE (from line 3):

        /chatter: std_msgs/msg/String
        /parameter_events: rcl_interfaces/msg/ParameterEvent
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
      Service Servers:
        /listener/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /listener/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /listener/get_parameters: rcl_interfaces/srv/GetParameters
        /listener/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /listener/list_parameters: rcl_interfaces/srv/ListParameters
        /listener/set_parameters: rcl_interfaces/srv/SetParameters
        /listener/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
      Service Clients:
    … (2 more lines)

**Step 4 (task 4, terminal 1) DIFFERS:** `ros2 run demo_nodes_py talker`  (real exit None, still running after 8 s; running: first 6 line(s) compared (real 6, site 11))

REAL (from line 1):

    [INFO] [1792425943.759118433] [talker]: Publishing: "Hello World: 0"
    [INFO] [1792425944.704751375] [talker]: Publishing: "Hello World: 1"
    [INFO] [1792425945.704797174] [talker]: Publishing: "Hello World: 2"
    [INFO] [1792425946.706150472] [talker]: Publishing: "Hello World: 3"
    [INFO] [1792425947.704567057] [talker]: Publishing: "Hello World: 4"
    [INFO] [1792425948.703415166] [talker]: Publishing: "Hello World: 5"

SITE (from line 1):

    [INFO] [talker]: Publishing: 'Hello World: 1'
    [INFO] [talker]: Publishing: 'Hello World: 2'
    [INFO] [talker]: Publishing: 'Hello World: 3'
    [INFO] [talker]: Publishing: 'Hello World: 4'
    [INFO] [talker]: Publishing: 'Hello World: 5'
    [INFO] [talker]: Publishing: 'Hello World: 6'
    [INFO] [talker]: Publishing: 'Hello World: 7'
    [INFO] [talker]: Publishing: 'Hello World: 8'
    [INFO] [talker]: Publishing: 'Hello World: 9'
    [INFO] [talker]: Publishing: 'Hello World: 10'
    [INFO] [talker]: Publishing: 'Hello World: 11'

**Step 5 (task 5, terminal 2) MATCH-VALUES:** `ros2 topic hz /chatter`  (real exit None, still running after 8 s; running: first 4 line(s) compared (real 4, site 4))

REAL:

    average rate: 0.999
    	min: 1.000s max: 1.002s std dev: 0.00100s window: 3
    average rate: 1.000
    	min: 0.998s max: 1.002s std dev: 0.00119s window: 5

SITE:

    average rate: 0.998
    	min: 0.999s max: 1.001s std dev: 0.00041s window: 1
    average rate: 1.004
    	min: 0.999s max: 1.001s std dev: 0.00041s window: 2
    ^C
    About 1 messages per second. On a real computer it keeps measuring until you press Ctrl+C.   «hint»


### D13 1: Mission: two delivery robots

Real: `parity/fixtures/lessons/D13/term1.json` · Site: `parity/browser_out/lessons/D13/term1.browser.json`

**Step 2 (task 2, terminal 1) DIFFERS:** `ros2 service call /raju/set_pen turtlesim/srv/SetPen "{r: 0, g: 200, b: 0, width: 4, off: 0}"`  (real exit 1, finished)

REAL:

    Failed to populate field: attribute name must be string, not 'bool'

SITE:

    requester: making request: turtlesim.srv.SetPen_Request(r=0, g=200, b=0, width=4, off=0)
    
    response:
    turtlesim.srv.SetPen_Response()
    


### F2 1: Live terminal: your first C++ node

Real: `parity/fixtures/lessons/F2/term1.json` · Site: `parity/browser_out/lessons/F2/term1.browser.json`

**Step 7 (task 7, terminal 2) DIFFERS:** `ros2 node info /hello_node`  (real exit 0, finished)

REAL (from line 15):

      Service Clients:
    
      Action Servers:
    
      Action Clients:

SITE (from line 15):

      Service Clients:
      Action Servers:
      Action Clients:


### F3 1: Live terminal: your publisher drives the turtle

Real: `parity/fixtures/lessons/F3/term1.json` · Site: `parity/browser_out/lessons/F3/term1.browser.json`

**Step 6 (task 5, terminal 2) DIFFERS:** `ros2 node info /circle_driver`  (real exit 0, finished)

REAL (from line 2):

      Subscribers:
    
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
        /turtle1/cmd_vel: geometry_msgs/msg/Twist
      Service Servers:
        /circle_driver/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /circle_driver/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /circle_driver/get_parameters: rcl_interfaces/srv/GetParameters
        /circle_driver/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /circle_driver/list_parameters: rcl_interfaces/srv/ListParameters
        /circle_driver/set_parameters: rcl_interfaces/srv/SetParameters
        /circle_driver/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
    … (5 more lines)

SITE (from line 2):

      Subscribers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
        /turtle1/cmd_vel: geometry_msgs/msg/Twist
      Service Servers:
        /circle_driver/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /circle_driver/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /circle_driver/get_parameters: rcl_interfaces/srv/GetParameters
        /circle_driver/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /circle_driver/list_parameters: rcl_interfaces/srv/ListParameters
        /circle_driver/set_parameters: rcl_interfaces/srv/SetParameters
        /circle_driver/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
    … (3 more lines)


### F4 1: Live terminal: change the C++ code, rebuild, drive

Real: `parity/fixtures/lessons/F4/term1.json` · Site: `parity/browser_out/lessons/F4/term1.browser.json`

**Step 5 (task 5, terminal 2) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 6.430200576782227
    y: 6.095846652984619
    theta: 1.097629427909851
    linear_velocity: 1.0
    angular_velocity: 1.0
    ---

SITE:

    x: 4.954559
    y: 7.369533
    theta: -2.56637
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### F5 1: Live terminal: your subscriber listens to turtlesim

Real: `parity/fixtures/lessons/F5/term1.json` · Site: `parity/browser_out/lessons/F5/term1.browser.json`

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 run chiku_control pose_monitor`  (real exit None, still running after 8 s; running: first 0 line(s) compared (real 6, site 0); 6 real line(s) of other kinds missing on site)

REAL:

    [INFO] [1792426129.429266346] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426130.379254761] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426131.379523954] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426132.379428003] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426133.377734063] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426134.379407236] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m

SITE:

    (no output)

Real lines of a kind the site never printed:

    [INFO] [1792426129.429266346] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426130.379254761] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426131.379523954] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426132.379428003] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426133.377734063] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426134.379407236] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m

**Step 6 (task 5, terminal 2) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 7.560444355010986
    y: 5.544444561004639
    theta: 0.0
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 7.544445
    y: 5.544445
    theta: 0.0
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

**Step 7 (task 6, terminal 2) DIFFERS:** `ros2 node info /pose_monitor`  (real exit 0, finished)

REAL (from line 2):

      Subscribers:
        /turtle1/pose: turtlesim/msg/Pose
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
      Service Servers:
        /pose_monitor/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /pose_monitor/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /pose_monitor/get_parameters: rcl_interfaces/srv/GetParameters
        /pose_monitor/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /pose_monitor/list_parameters: rcl_interfaces/srv/ListParameters
        /pose_monitor/set_parameters: rcl_interfaces/srv/SetParameters
        /pose_monitor/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
      Service Clients:
    … (4 more lines)

SITE (from line 2):

      Subscribers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /turtle1/pose: turtlesim/msg/Pose
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
      Service Servers:
        /pose_monitor/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /pose_monitor/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /pose_monitor/get_parameters: rcl_interfaces/srv/GetParameters
        /pose_monitor/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /pose_monitor/list_parameters: rcl_interfaces/srv/ListParameters
        /pose_monitor/set_parameters: rcl_interfaces/srv/SetParameters
        /pose_monitor/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
    … (3 more lines)


### F6 1: Live terminal: the C++ monitor

Real: `parity/fixtures/lessons/F6/term1.json` · Site: `parity/browser_out/lessons/F6/term1.browser.json`

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 run chiku_control_cpp pose_monitor`  (real exit None, still running after 8 s; running: first 0 line(s) compared (real 7, site 0); 7 real line(s) of other kinds missing on site)

REAL:

    [INFO] [1792426181.468796218] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426182.468891426] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426183.468776476] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426184.468883452] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426185.468775908] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426186.468912712] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426187.468871453] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m

SITE:

    (no output)

Real lines of a kind the site never printed:

    [INFO] [1792426181.468796218] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426182.468891426] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426183.468776476] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426184.468883452] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426185.468775908] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426186.468912712] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m
    [INFO] [1792426187.468871453] [pose_monitor]: x=5.54 y=5.54 theta=0.00 travelled=0.00 m

**Step 5 (task 4, terminal 2) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 5.544444561004639
    y: 5.544444561004639
    theta: 1.5119999647140503
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 5.544445
    y: 5.544445
    theta: 1.5
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### F7 1: Live terminal: make the message, build it, publish it

Real: `parity/fixtures/lessons/F7/term1.json` · Site: `parity/browser_out/lessons/F7/term1.browser.json`

**Step 4 (task 5, terminal 1) DIFFERS:** `colcon build --packages-select my_robot_interfaces chiku_control`  (real exit 0, finished)

REAL (from line 1):

    Starting >>> my_robot_interfaces
    Finished <<< my_robot_interfaces [20.0s]
    Starting >>> chiku_control
    Finished <<< chiku_control [3.31s]
    
    Summary: 2 packages finished [23.7s]

SITE (from line 1):

    Starting >>> chiku_control
    Starting >>> my_robot_interfaces
    Finished <<< chiku_control [0.90s]
    Finished <<< my_robot_interfaces [1.27s]
    
    Summary: 2 packages finished [1.64s]
    Built. Now load the workspace in this terminal: source install/setup.bash   «hint»

**Step 10 (task 7, terminal 2) DIFFERS:** `ros2 topic echo --once /chiku/status`  (real exit 0, finished)

REAL:

    name: chiku
    x: 5.544444561004639
    y: 5.544444561004639
    battery: 97.5999984741211
    moving: false
    ---

SITE:

    name: chiku
    x: 5.544445
    y: 5.544445
    battery: 0.0
    moving: false
    ---


### F8 1: Live terminal: the C++ status publisher

Real: `parity/fixtures/lessons/F8/term1.json` · Site: `parity/browser_out/lessons/F8/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `colcon build --packages-select my_robot_interfaces chiku_control_cpp`  (real exit 0, finished)

REAL (from line 1):

    Starting >>> my_robot_interfaces
    [Processing: my_robot_interfaces]
    Finished <<< my_robot_interfaces [32.4s]
    Starting >>> chiku_control_cpp
    Finished <<< chiku_control_cpp [21.9s]
    
    Summary: 2 packages finished [54.7s]

SITE (from line 1):

    Starting >>> chiku_control_cpp
    Starting >>> my_robot_interfaces
    Finished <<< chiku_control_cpp [0.90s]
    Finished <<< my_robot_interfaces [1.27s]
    
    Summary: 2 packages finished [1.64s]
    Built. Now load the workspace in this terminal: source install/setup.bash   «hint»

**Step 6 (task 3, terminal 2) DIFFERS:** `ros2 topic echo --once /chiku/status`  (real exit 0, finished)

REAL:

    name: chiku
    x: 5.544444561004639
    y: 5.544444561004639
    battery: 97.40003967285156
    moving: false
    ---

SITE:

    name: chiku
    x: 5.544445
    y: 5.544445
    battery: 0.0
    moving: false
    ---


### F9 1: Live terminal: switch the robot on and off

Real: `parity/fixtures/lessons/F9/term1.json` · Site: `parity/browser_out/lessons/F9/term1.browser.json`

**Step 6 (task 5, terminal 2) DIFFERS:** `ros2 service call /chiku/enable std_srvs/srv/SetBool "{data: false}"`  (real exit 0, finished)

REAL:

    waiting for service to become available...
    requester: making request: std_srvs.srv.SetBool_Request(data=False)
    
    response:
    std_srvs.srv.SetBool_Response(success=True, message='stopped')

SITE:

    requester: making request: std_srvs.srv.SetBool_Request(data=False)
    
    response:
    std_srvs.srv.SetBool_Response(success=True, message='stopped')
    

**Step 7 (task 6, terminal 2) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 6.708248138427734
    y: 7.229625701904297
    theta: 1.9199999570846558
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

SITE:

    x: 6.768015
    y: 6.855762
    theta: 1.6
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### F12 1: Live terminal: change the request, rebuild, spawn

Real: `parity/fixtures/lessons/F12/term1.json` · Site: `parity/browser_out/lessons/F12/term1.browser.json`

**Step 4 (task 4, terminal 1) DIFFERS:** `ros2 service call /helper/set_pen turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 5, off: 0}"`  (real exit 1, finished)

REAL:

    Failed to populate field: attribute name must be string, not 'bool'

SITE:

    requester: making request: turtlesim.srv.SetPen_Request(r=255, g=0, b=0, width=5, off=0)
    
    response:
    turtlesim.srv.SetPen_Response()
    


### F13 1: Live terminal: goals, feedback and cancel

Real: `parity/fixtures/lessons/F13/term1.json` · Site: `parity/browser_out/lessons/F13/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `colcon build --packages-select my_robot_interfaces chiku_control`  (real exit 0, finished)

REAL (from line 1):

    Starting >>> my_robot_interfaces
    [Processing: my_robot_interfaces]
    Finished <<< my_robot_interfaces [32.2s]
    Starting >>> chiku_control
    Finished <<< chiku_control [3.41s]
    
    Summary: 2 packages finished [36.0s]

SITE (from line 1):

    Starting >>> chiku_control
    Starting >>> my_robot_interfaces
    Finished <<< chiku_control [0.90s]
    Finished <<< my_robot_interfaces [1.27s]
    
    Summary: 2 packages finished [1.64s]
    Built. Now load the workspace in this terminal: source install/setup.bash   «hint»

**Step 7 (task 4, terminal 2) DIFFERS:** `ros2 action send_goal --feedback /chiku/drive_distance my_robot_interfaces/action/DriveDistance "{distance: 2.0, speed: 0.5}"`  (real exit 0, finished)

REAL (from line 8):

    Feedback:
        remaining: 1.95
    
    Feedback:
        remaining: 1.9
    
    Feedback:
        remaining: 1.85
    
    Feedback:
        remaining: 1.8
    
    Feedback:
        remaining: 1.75
    … (110 more lines)

SITE (from line 8):

    Feedback:
        remaining: 1.5
    
    Feedback:
        remaining: 1.0
    
    Feedback:
        remaining: 0.5
    
    Feedback:
        remaining: 0.0
    
    Result:
        distance_driven: 2.0
    … (3 more lines)

**Step 8 (task 5, terminal 2) DIFFERS:** `ros2 run chiku_control drive_distance_client`  (real exit 0, finished)

REAL (from line 2):

    [INFO] [1792426547.924698588] [drive_distance_client]: Goal accepted
    [INFO] [1792426548.008171826] [drive_distance_client]: remaining: 1.95 m
    [INFO] [1792426548.109520553] [drive_distance_client]: remaining: 1.90 m
    [INFO] [1792426548.210510505] [drive_distance_client]: remaining: 1.85 m
    [INFO] [1792426548.311884943] [drive_distance_client]: remaining: 1.80 m
    [INFO] [1792426548.413001761] [drive_distance_client]: remaining: 1.75 m
    [INFO] [1792426548.514208214] [drive_distance_client]: remaining: 1.70 m
    [INFO] [1792426548.615763770] [drive_distance_client]: remaining: 1.65 m
    [INFO] [1792426548.716717370] [drive_distance_client]: remaining: 1.60 m
    [INFO] [1792426548.818171992] [drive_distance_client]: remaining: 1.55 m
    [INFO] [1792426548.919490003] [drive_distance_client]: remaining: 1.50 m
    [INFO] [1792426549.020742034] [drive_distance_client]: remaining: 1.45 m
    [INFO] [1792426549.121889242] [drive_distance_client]: remaining: 1.40 m
    [INFO] [1792426549.224519806] [drive_distance_client]: remaining: 1.35 m
    … (28 more lines)

SITE (from line 2):

    [INFO] [drive_distance_client]: Goal accepted
    [INFO] [drive_distance_client]: remaining: 1.65 m
    [INFO] [drive_distance_client]: remaining: 1.30 m
    [INFO] [drive_distance_client]: remaining: 0.95 m
    [INFO] [drive_distance_client]: remaining: 0.60 m
    [INFO] [drive_distance_client]: remaining: 0.25 m
    [INFO] [drive_distance_client]: remaining: 0.00 m
    [INFO] [drive_distance_client]: Result: drove 2.00 m (status 4)

**Step 9 (task 6, terminal 2) DIFFERS:** `ros2 run chiku_control drive_distance_client --ros-args -p distance:=3.0 -p cancel_after:=1.5`  (real exit 0, finished)

REAL (from line 2):

    [INFO] [1792426554.313629102] [drive_distance_client]: Goal accepted
    [INFO] [1792426554.416785511] [drive_distance_client]: remaining: 2.95 m
    [INFO] [1792426554.517609677] [drive_distance_client]: remaining: 2.90 m
    [INFO] [1792426554.618444240] [drive_distance_client]: remaining: 2.85 m
    [INFO] [1792426554.719931756] [drive_distance_client]: remaining: 2.80 m
    [INFO] [1792426554.820793490] [drive_distance_client]: remaining: 2.75 m
    [INFO] [1792426554.921986006] [drive_distance_client]: remaining: 2.70 m
    [INFO] [1792426555.022579859] [drive_distance_client]: remaining: 2.65 m
    [INFO] [1792426555.123590750] [drive_distance_client]: remaining: 2.60 m
    [INFO] [1792426555.225819125] [drive_distance_client]: remaining: 2.55 m
    [INFO] [1792426555.326860209] [drive_distance_client]: remaining: 2.50 m
    [INFO] [1792426555.427773036] [drive_distance_client]: remaining: 2.45 m
    [INFO] [1792426555.528654156] [drive_distance_client]: remaining: 2.40 m
    [INFO] [1792426555.628298054] [drive_distance_client]: remaining: 2.35 m
    … (4 more lines)

SITE (from line 2):

    [INFO] [drive_distance_client]: Goal accepted
    [INFO] [drive_distance_client]: remaining: 2.50 m
    [INFO] [drive_distance_client]: remaining: 2.20 m
    [INFO] [drive_distance_client]: Changed my mind: cancelling
    [INFO] [drive_distance_client]: Result: drove 0.80 m (status 5)


### F14 1: Live terminal: the C++ action server

Real: `parity/fixtures/lessons/F14/term1.json` · Site: `parity/browser_out/lessons/F14/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `colcon build --packages-select my_robot_interfaces chiku_control_cpp`  (real exit 0, finished)

REAL (from line 1):

    Starting >>> my_robot_interfaces
    [Processing: my_robot_interfaces]
    Finished <<< my_robot_interfaces [32.2s]
    Starting >>> chiku_control_cpp
    Finished <<< chiku_control_cpp [18.0s]
    
    Summary: 2 packages finished [50.8s]

SITE (from line 1):

    Starting >>> chiku_control_cpp
    Starting >>> my_robot_interfaces
    Finished <<< chiku_control_cpp [0.90s]
    Finished <<< my_robot_interfaces [1.27s]
    
    Summary: 2 packages finished [1.64s]
    Built. Now load the workspace in this terminal: source install/setup.bash   «hint»

**Step 8 (task 5, terminal 2) DIFFERS:** `ros2 action send_goal --feedback /chiku/drive_distance my_robot_interfaces/action/DriveDistance "{distance: 2.0, speed: 1.0}"`  (real exit 0, finished)

REAL (from line 8):

    Feedback:
        remaining: 1.9
    
    Feedback:
        remaining: 1.8
    
    Feedback:
        remaining: 1.7
    
    Feedback:
        remaining: 1.6
    
    Feedback:
        remaining: 1.5
    … (50 more lines)

SITE (from line 8):

    Feedback:
        remaining: 1.5
    
    Feedback:
        remaining: 1.0
    
    Feedback:
        remaining: 0.5
    
    Feedback:
        remaining: 0.0
    
    Result:
        distance_driven: 2.0
    … (3 more lines)

**Step 9 (task 6, terminal 2) DIFFERS:** `ros2 run chiku_control_cpp drive_distance_client --ros-args -p distance:=3.0 -p cancel_after:=1.5`  (real exit 0, finished)

REAL (from line 2):

    [INFO] [1792426640.884938546] [drive_distance_client]: Goal accepted
    [INFO] [1792426640.918358245] [drive_distance_client]: remaining: 2.95 m
    [INFO] [1792426641.018242198] [drive_distance_client]: remaining: 2.90 m
    [INFO] [1792426641.118529371] [drive_distance_client]: remaining: 2.85 m
    [INFO] [1792426641.218483158] [drive_distance_client]: remaining: 2.80 m
    [INFO] [1792426641.318372492] [drive_distance_client]: remaining: 2.75 m
    [INFO] [1792426641.418367207] [drive_distance_client]: remaining: 2.70 m
    [INFO] [1792426641.518377279] [drive_distance_client]: remaining: 2.65 m
    [INFO] [1792426641.618477281] [drive_distance_client]: remaining: 2.60 m
    [INFO] [1792426641.718328369] [drive_distance_client]: remaining: 2.55 m
    [INFO] [1792426641.818497141] [drive_distance_client]: remaining: 2.50 m
    [INFO] [1792426641.918459154] [drive_distance_client]: remaining: 2.45 m
    [INFO] [1792426642.018270077] [drive_distance_client]: remaining: 2.40 m
    [INFO] [1792426642.118472867] [drive_distance_client]: remaining: 2.35 m
    … (5 more lines)

SITE (from line 2):

    [INFO] [drive_distance_client]: Goal accepted
    [INFO] [drive_distance_client]: remaining: 2.50 m
    [INFO] [drive_distance_client]: remaining: 2.20 m
    [INFO] [drive_distance_client]: Changed my mind: cancelling
    [INFO] [drive_distance_client]: Result: drove 0.80 m (code 5)


### F15 1: Live terminal: tune the robot without touching the code

Real: `parity/fixtures/lessons/F15/term1.json` · Site: `parity/browser_out/lessons/F15/term1.browser.json`

**Step 4 (task 3, terminal 2) DIFFERS:** `ros2 param list /speed_driver`  (real exit 0, finished)

REAL:

      robot_name
      speed
      start_type_description_service
      turn
      use_sim_time

SITE:

    /speed_driver:
      robot_name
      speed
      start_type_description_service
      turn
      use_sim_time


### F15 code1: Lesson code block commands: speed_driver with -p and with --params-file config/speed.yaml from ~/ros2_ws

Real: `parity/fixtures/lessons/F15/termcode1.json` · Site: `parity/browser_out/lessons/F15/termcode1.site.json`

**Step 8 (task 1, terminal 2) DIFFERS:** `ros2 run chiku_control speed_driver --ros-args --params-file config/speed.yaml`  (real exit 1, finished)

REAL (from line 1):

    [ERROR] [1792427978.423784676] [rcl]: Failed to parse global arguments
    Traceback (most recent call last):
      File "/home/student/ros2_ws/install/chiku_control/lib/chiku_control/speed_driver", line 33, in <module>
        sys.exit(load_entry_point('chiku-control==0.1.0', 'console_scripts', 'speed_driver')())
                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      File "/home/student/ros2_ws/install/chiku_control/lib/python3.12/site-packages/chiku_control/speed_driver.py", line 30, in main
        rclpy.init(args=args)
      File "/opt/ros/jazzy/lib/python3.12/site-packages/rclpy/__init__.py", line 88, in init
        context.init(args, domain_id=domain_id)
      File "/opt/ros/jazzy/lib/python3.12/site-packages/rclpy/context.py", line 99, in init
        self.__context = _rclpy.Context(
                         ^^^^^^^^^^^^^^^
    rclpy._rclpy_pybind11.RCLError: failed to initialize rcl: Couldn't parse params file: '--params-file config/speed.yaml'. Error: Error opening YAML file, at ./src/parser.c:271, at ./src/rcl/arguments.c:415
    [ros2run]: Process exited with failure 1

SITE (from line 1):

    [WARN] [rcl.logging_rosout]: Publisher already registered for node name: 'speed_driver'.
    Two nodes with the same name confuse ROS 2. Give the second one a new name with --ros-args --remap __node:=another_name   «hint»


### F16 1: Live terminal: C++ parameters

Real: `parity/fixtures/lessons/F16/term1.json` · Site: `parity/browser_out/lessons/F16/term1.browser.json`

**Step 5 (task 4, terminal 2) DIFFERS:** `ros2 param list /speed_driver`  (real exit 0, finished)

REAL (from line 1):

      qos_overrides./parameter_events.publisher.depth
      qos_overrides./parameter_events.publisher.durability
      qos_overrides./parameter_events.publisher.history
      qos_overrides./parameter_events.publisher.reliability
      robot_name
      speed
      start_type_description_service
      turn
      use_sim_time

SITE (from line 1):

    /speed_driver:
      qos_overrides./parameter_events.publisher.depth
      qos_overrides./parameter_events.publisher.durability
      qos_overrides./parameter_events.publisher.history
      qos_overrides./parameter_events.publisher.reliability
      robot_name
      speed
      start_type_description_service
      turn
      use_sim_time


### F17 1: Live terminal: install and launch

Real: `parity/fixtures/lessons/F17/term1.json` · Site: `parity/browser_out/lessons/F17/term1.browser.json`

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 launch chiku_control circle.launch.py`  (real exit 1, finished)

REAL:

    file 'circle.launch.py' was not found in the share directory of package 'chiku_control' which is at '/home/student/ros2_ws/install/chiku_control/share/chiku_control'

SITE:

    file 'circle.launch.py' was not found in the share directory of package 'chiku_control' at '/home/student/ros2_ws/install/chiku_control/share/chiku_control'   «err»
    The file exists in src, but it was never INSTALLED. Add the install rule (CMakeLists.txt: install(DIRECTORY launch ...) or setup.py: data_files), then colcon build and source again.   «hint»

**Step 6 (task 4, terminal 1) DIFFERS:** `ros2 launch chiku_control circle.launch.py`  (real exit None, still running after 8 s; running: first 5 line(s) compared (real 14, site 5); 9 real line(s) of other kinds missing on site)

REAL (from line 5):

    [INFO] [pose_monitor-3]: process started with pid [1202934]
    [turtlesim_node-1] [INFO] [1792426751.617084713] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426751.629663086] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [speed_driver-2] [INFO] [1792426752.420440618] [speed_driver]: chiku is ready to drive
    [pose_monitor-3] [INFO] [1792426753.361408235] [pose_monitor]: x=6.52 y=5.81 theta=0.51 travelled=1.02 m
    [pose_monitor-3] [INFO] [1792426754.309489067] [pose_monitor]: x=7.53 y=7.43 theta=1.50 travelled=3.01 m
    [pose_monitor-3] [INFO] [1792426755.309120777] [pose_monitor]: x=6.69 y=9.17 theta=2.51 travelled=5.02 m
    [pose_monitor-3] [INFO] [1792426756.311361023] [pose_monitor]: x=4.80 y=9.41 theta=-2.78 travelled=7.01 m
    [pose_monitor-3] [INFO] [1792426757.307682272] [pose_monitor]: x=3.57 y=7.93 theta=-1.77 travelled=9.02 m
    [pose_monitor-3] [INFO] [1792426758.309165953] [pose_monitor]: x=4.13 y=6.11 theta=-0.78 travelled=11.01 m

SITE (from line 5):

    [INFO] [pose_monitor-3]: process started with pid [4321]

Real lines of a kind the site never printed:

    [turtlesim_node-1] [INFO] [1792426751.617084713] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426751.629663086] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [speed_driver-2] [INFO] [1792426752.420440618] [speed_driver]: chiku is ready to drive
    [pose_monitor-3] [INFO] [1792426753.361408235] [pose_monitor]: x=6.52 y=5.81 theta=0.51 travelled=1.02 m
    [pose_monitor-3] [INFO] [1792426754.309489067] [pose_monitor]: x=7.53 y=7.43 theta=1.50 travelled=3.01 m
    [pose_monitor-3] [INFO] [1792426755.309120777] [pose_monitor]: x=6.69 y=9.17 theta=2.51 travelled=5.02 m
    [pose_monitor-3] [INFO] [1792426756.311361023] [pose_monitor]: x=4.80 y=9.41 theta=-2.78 travelled=7.01 m
    [pose_monitor-3] [INFO] [1792426757.307682272] [pose_monitor]: x=3.57 y=7.93 theta=-1.77 travelled=9.02 m


### F18 1: Live terminal: install and launch the C++ nodes

Real: `parity/fixtures/lessons/F18/term1.json` · Site: `parity/browser_out/lessons/F18/term1.browser.json`

**Step 3 (task 3, terminal 1) DIFFERS:** `ros2 launch chiku_control_cpp circle.launch.xml`  (real exit None, still running after 8 s; running: first 5 line(s) compared (real 14, site 5); 9 real line(s) of other kinds missing on site)

REAL (from line 5):

    [INFO] [pose_monitor-3]: process started with pid [1203276]
    [speed_driver-2] [INFO] [1792426793.122466706] [speed_driver]: chiku is ready to drive
    [turtlesim_node-1] [INFO] [1792426793.217376149] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426793.229222894] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [pose_monitor-3] [INFO] [1792426794.133695899] [pose_monitor]: x=6.91 y=6.09 theta=0.75 travelled=1.50 m
    [pose_monitor-3] [INFO] [1792426795.133743223] [pose_monitor]: x=7.49 y=7.94 theta=1.76 travelled=3.52 m
    [pose_monitor-3] [INFO] [1792426796.133726149] [pose_monitor]: x=6.27 y=9.40 theta=2.75 travelled=5.50 m
    [pose_monitor-3] [INFO] [1792426797.133712538] [pose_monitor]: x=4.36 y=9.16 theta=-2.52 travelled=7.52 m
    [pose_monitor-3] [INFO] [1792426798.133807558] [pose_monitor]: x=3.53 y=7.45 theta=-1.53 travelled=9.50 m
    [pose_monitor-3] [INFO] [1792426799.133732039] [pose_monitor]: x=4.54 y=5.80 theta=-0.52 travelled=11.52 m

SITE (from line 5):

    [INFO] [pose_monitor-3]: process started with pid [4321]

Real lines of a kind the site never printed:

    [speed_driver-2] [INFO] [1792426793.122466706] [speed_driver]: chiku is ready to drive
    [turtlesim_node-1] [INFO] [1792426793.217376149] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426793.229222894] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [pose_monitor-3] [INFO] [1792426794.133695899] [pose_monitor]: x=6.91 y=6.09 theta=0.75 travelled=1.50 m
    [pose_monitor-3] [INFO] [1792426795.133743223] [pose_monitor]: x=7.49 y=7.94 theta=1.76 travelled=3.52 m
    [pose_monitor-3] [INFO] [1792426796.133726149] [pose_monitor]: x=6.27 y=9.40 theta=2.75 travelled=5.50 m
    [pose_monitor-3] [INFO] [1792426797.133712538] [pose_monitor]: x=4.36 y=9.16 theta=-2.52 travelled=7.52 m
    [pose_monitor-3] [INFO] [1792426798.133807558] [pose_monitor]: x=3.53 y=7.45 theta=-1.53 travelled=9.50 m


### F19 1: Live terminal: run the mission

Real: `parity/fixtures/lessons/F19/term1.json` · Site: `parity/browser_out/lessons/F19/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `colcon build --packages-select my_robot_interfaces chiku_control`  (real exit 0, finished)

REAL (from line 1):

    Starting >>> my_robot_interfaces
    [Processing: my_robot_interfaces]
    Finished <<< my_robot_interfaces [33.1s]
    Starting >>> chiku_control
    Finished <<< chiku_control [3.22s]
    
    Summary: 2 packages finished [36.7s]

SITE (from line 1):

    Starting >>> chiku_control
    Starting >>> my_robot_interfaces
    Finished <<< chiku_control [0.90s]
    Finished <<< my_robot_interfaces [1.27s]
    
    Summary: 2 packages finished [1.64s]
    Built. Now load the workspace in this terminal: source install/setup.bash   «hint»

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 launch chiku_control mission.launch.py`  (real exit None, still running after 8 s; running: first 5 line(s) compared (real 9, site 5); 4 real line(s) of other kinds missing on site)

REAL (from line 5):

    [INFO] [battery_monitor-3]: process started with pid [1204418]
    [turtlesim_node-1] [INFO] [1792426851.989663782] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426852.000842520] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [battery_monitor-3] [INFO] [1792426852.747135952] [battery_monitor]: Battery monitor ready: 100.0 %
    [speed_driver-2] [INFO] [1792426852.796345992] [speed_driver]: chiku is ready to drive

SITE (from line 5):

    [INFO] [battery_monitor-3]: process started with pid [4321]

Real lines of a kind the site never printed:

    [turtlesim_node-1] [INFO] [1792426851.989663782] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426852.000842520] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [battery_monitor-3] [INFO] [1792426852.747135952] [battery_monitor]: Battery monitor ready: 100.0 %
    [speed_driver-2] [INFO] [1792426852.796345992] [speed_driver]: chiku is ready to drive

**Step 6 (task 3, terminal 2) DIFFERS:** `ros2 topic echo --once /chiku/battery`  (real exit 0, finished)

REAL:

    robot_name: chiku
    voltage: 11.368639945983887
    percentage: 52.63999938964844
    is_charging: false
    ---

SITE:

    robot_name: chiku
    voltage: 11.50296
    percentage: 57.806161
    is_charging: false
    ---

**Step 10 (task 6, terminal 2) DIFFERS:** `ros2 service call /chiku/recharge std_srvs/srv/Trigger`  (real exit 0, finished)

REAL:

    waiting for service to become available...
    requester: making request: std_srvs.srv.Trigger_Request()
    
    response:
    std_srvs.srv.Trigger_Response(success=True, message='battery full again')

SITE:

    requester: making request: std_srvs.srv.Trigger_Request()
    
    response:
    std_srvs.srv.Trigger_Response(success=True, message='battery full again')
    

**Step 11 (task 7, terminal 2) DIFFERS:** `ros2 node info /battery_monitor`  (real exit 0, finished)

REAL (from line 2):

      Subscribers:
        /turtle1/pose: turtlesim/msg/Pose
      Publishers:
        /chiku/battery: my_robot_interfaces/msg/BatteryStatus
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
      Service Servers:
        /battery_monitor/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /battery_monitor/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /battery_monitor/get_parameters: rcl_interfaces/srv/GetParameters
        /battery_monitor/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /battery_monitor/list_parameters: rcl_interfaces/srv/ListParameters
        /battery_monitor/set_parameters: rcl_interfaces/srv/SetParameters
        /battery_monitor/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
    … (6 more lines)

SITE (from line 2):

      Subscribers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /turtle1/pose: turtlesim/msg/Pose
      Publishers:
        /chiku/battery: my_robot_interfaces/msg/BatteryStatus
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
      Service Servers:
        /battery_monitor/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /battery_monitor/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /battery_monitor/get_parameters: rcl_interfaces/srv/GetParameters
        /battery_monitor/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /battery_monitor/list_parameters: rcl_interfaces/srv/ListParameters
        /battery_monitor/set_parameters: rcl_interfaces/srv/SetParameters
    … (5 more lines)


### F20 1: Live terminal: the C++ mission

Real: `parity/fixtures/lessons/F20/term1.json` · Site: `parity/browser_out/lessons/F20/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `colcon build --packages-select my_robot_interfaces chiku_control_cpp`  (real exit 0, finished)

REAL (from line 1):

    Starting >>> my_robot_interfaces
    [Processing: my_robot_interfaces]
    Finished <<< my_robot_interfaces [33.6s]
    Starting >>> chiku_control_cpp
    Finished <<< chiku_control_cpp [24.4s]
    
    Summary: 2 packages finished [58.4s]

SITE (from line 1):

    Starting >>> chiku_control_cpp
    Starting >>> my_robot_interfaces
    Finished <<< chiku_control_cpp [0.90s]
    Finished <<< my_robot_interfaces [1.27s]
    
    Summary: 2 packages finished [1.64s]
    Built. Now load the workspace in this terminal: source install/setup.bash   «hint»

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 launch chiku_control_cpp mission.launch.py`  (real exit None, still running after 8 s; running: first 5 line(s) compared (real 9, site 5); 4 real line(s) of other kinds missing on site)

REAL (from line 5):

    [INFO] [battery_monitor-3]: process started with pid [1205730]
    [speed_driver-2] [INFO] [1792426941.907842113] [speed_driver]: chiku is ready to drive
    [battery_monitor-3] [INFO] [1792426941.913690083] [battery_monitor]: Battery monitor ready: 100.0 %
    [turtlesim_node-1] [INFO] [1792426942.025505899] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426942.044031720] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]

SITE (from line 5):

    [INFO] [battery_monitor-3]: process started with pid [4321]

Real lines of a kind the site never printed:

    [speed_driver-2] [INFO] [1792426941.907842113] [speed_driver]: chiku is ready to drive
    [battery_monitor-3] [INFO] [1792426941.913690083] [battery_monitor]: Battery monitor ready: 100.0 %
    [turtlesim_node-1] [INFO] [1792426942.025505899] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792426942.044031720] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]

**Step 6 (task 3, terminal 2) DIFFERS:** `ros2 topic echo --once /chiku/battery`  (real exit 0, finished)

REAL:

    robot_name: chiku
    voltage: 11.275456428527832
    percentage: 49.055999755859375
    is_charging: false
    ---

SITE:

    robot_name: chiku
    voltage: 11.602691
    percentage: 61.641964
    is_charging: false
    ---

**Step 9 (task 6, terminal 2) DIFFERS:** `ros2 node info /battery_monitor`  (real exit 0, finished)

REAL (from line 18):

      Service Clients:
    
      Action Servers:
    
      Action Clients:

SITE (from line 18):

      Service Clients:
      Action Servers:
      Action Clients:


### N2 1: Live terminal: measure your timer's rate

Real: `parity/fixtures/lessons/N2/term1.json` · Site: `parity/browser_out/lessons/N2/term1.browser.json`

**Step 3 (task 3, terminal 1) DIFFERS:** `ros2 run chiku_control_cpp heartbeat`  (real exit None, still running after 8 s; running: first 0 line(s) compared (real 11, site 0); 11 real line(s) of other kinds missing on site)

REAL:

    [INFO] [1792426979.443085420] [heartbeat]: beat 1 after 0.5 s
    [INFO] [1792426979.943087168] [heartbeat]: beat 2 after 1.0 s
    [INFO] [1792426980.443094120] [heartbeat]: beat 3 after 1.5 s
    [INFO] [1792426980.943085956] [heartbeat]: beat 4 after 2.0 s
    [INFO] [1792426981.443208332] [heartbeat]: beat 5 after 2.5 s
    [INFO] [1792426981.943127727] [heartbeat]: beat 6 after 3.0 s
    [INFO] [1792426982.443140551] [heartbeat]: beat 7 after 3.5 s
    [INFO] [1792426982.943174099] [heartbeat]: beat 8 after 4.0 s
    [INFO] [1792426983.443149870] [heartbeat]: beat 9 after 4.5 s
    [INFO] [1792426983.943132685] [heartbeat]: beat 10 after 5.0 s
    [INFO] [1792426983.943360143] [heartbeat]: 10 beats done, stopping the timer

SITE:

    (no output)

Real lines of a kind the site never printed:

    [INFO] [1792426979.443085420] [heartbeat]: beat 1 after 0.5 s
    [INFO] [1792426979.943087168] [heartbeat]: beat 2 after 1.0 s
    [INFO] [1792426980.443094120] [heartbeat]: beat 3 after 1.5 s
    [INFO] [1792426980.943085956] [heartbeat]: beat 4 after 2.0 s
    [INFO] [1792426981.443208332] [heartbeat]: beat 5 after 2.5 s
    [INFO] [1792426981.943127727] [heartbeat]: beat 6 after 3.0 s
    [INFO] [1792426982.443140551] [heartbeat]: beat 7 after 3.5 s
    [INFO] [1792426982.943174099] [heartbeat]: beat 8 after 4.0 s

**Step 4 (task 4, terminal 2) DIFFERS:** `ros2 node info /heartbeat`  (real exit 0, finished)

REAL (from line 15):

      Service Clients:
    
      Action Servers:
    
      Action Clients:

SITE (from line 15):

      Service Clients:
      Action Servers:
      Action Clients:


### N4 1: Live terminal: change the log level

Real: `parity/fixtures/lessons/N4/term1.json` · Site: `parity/browser_out/lessons/N4/term1.browser.json`

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 run chiku_control log_demo --ros-args --log-level log_demo:=debug`  (real exit None, still running after 8 s; running: first 1 line(s) compared (real 43, site 1); 42 real line(s) of other kinds missing on site)

REAL (from line 1):

    [INFO] [1792427001.961176971] [log_demo]: Battery watcher started
    [DEBUG] [1792427002.144212415] [log_demo]: raw battery value: 98.5
    [INFO] [1792427002.145823427] [log_demo]: battery 98 %
    [DEBUG] [1792427002.344348161] [log_demo]: raw battery value: 97.0
    [DEBUG] [1792427002.545073660] [log_demo]: raw battery value: 95.5
    [DEBUG] [1792427002.744326430] [log_demo]: raw battery value: 94.0
    [DEBUG] [1792427002.944135296] [log_demo]: raw battery value: 92.5
    [DEBUG] [1792427003.144309122] [log_demo]: raw battery value: 91.0
    [INFO] [1792427003.145911179] [log_demo]: battery 91 %
    [DEBUG] [1792427003.344285050] [log_demo]: raw battery value: 89.5
    [DEBUG] [1792427003.544280367] [log_demo]: raw battery value: 88.0
    [DEBUG] [1792427003.744230703] [log_demo]: raw battery value: 86.5
    [DEBUG] [1792427003.944157048] [log_demo]: raw battery value: 85.0
    [DEBUG] [1792427004.144298754] [log_demo]: raw battery value: 83.5
    … (29 more lines)

SITE (from line 1):

    [INFO] [log_demo]: Battery watcher started

Real lines of a kind the site never printed:

    [DEBUG] [1792427002.144212415] [log_demo]: raw battery value: 98.5
    [INFO] [1792427002.145823427] [log_demo]: battery 98 %
    [DEBUG] [1792427002.344348161] [log_demo]: raw battery value: 97.0
    [DEBUG] [1792427002.545073660] [log_demo]: raw battery value: 95.5
    [DEBUG] [1792427002.744326430] [log_demo]: raw battery value: 94.0
    [DEBUG] [1792427002.944135296] [log_demo]: raw battery value: 92.5
    [DEBUG] [1792427003.144309122] [log_demo]: raw battery value: 91.0
    [INFO] [1792427003.145911179] [log_demo]: battery 91 %

**Step 4 (task 3, terminal 2) DIFFERS:** `ros2 topic echo --once /rosout`  (real exit 0, finished)

REAL (from line 1):

    stamp:
      sec: 1792427009
      nanosec: 945645750
    level: 20
    name: log_demo
    msg: battery 40 %
    file: /home/student/ros2_ws/install/chiku_control/lib/python3.12/site-packages/chiku_control/log_demo.py
    function: on_timer
    line: 17
    ---

SITE (from line 1):

    stamp: 0
    level: 0
    name: ''
    msg: ''
    file: ''
    function: ''
    line: 0
    ---

**Step 5 (task 4, terminal 2) MATCH-VALUES:** `ros2 topic info /rosout`  (real exit 0, finished)

REAL:

    Type: rcl_interfaces/msg/Log
    Publisher count: 2
    Subscription count: 0

SITE:

    Type: rcl_interfaces/msg/Log
    Publisher count: 1
    Subscription count: 0


### N4 code1: Lesson code block commands: log levels (chiku_control_cpp is not in this lesson workspace)

Real: `parity/fixtures/lessons/N4/termcode1.json` · Site: `parity/browser_out/lessons/N4/termcode1.site.json`

**Step 3 (task 1, terminal 1) DIFFERS:** `ros2 run chiku_control log_demo --ros-args --log-level debug`  (real exit None, still running after 8 s; running: first 1 line(s) compared (real 195, site 1); 193 real line(s) of other kinds missing on site)

REAL (from line 1):

    [DEBUG] [1792427990.054501220] [rcl]: Initializing node 'log_demo' in namespace ''
    [DEBUG] [1792427990.054572279] [rcl]: Using domain ID of '52'
    [DEBUG] [1792427990.069684553] [rcl]: Node initialized
    [DEBUG] [1792427990.069744414] [rcl]: Initializing publisher for topic name '/rosout'
    [DEBUG] [1792427990.069763717] [rcl]: Expanded and remapped topic name '/rosout'
    [DEBUG] [1792427990.073114851] [rcl]: Publisher initialized
    [DEBUG] [1792427990.135893649] [rcl]: Initializing publisher for topic name '/parameter_events'
    [DEBUG] [1792427990.135941697] [rcl]: Expanded and remapped topic name '/parameter_events'
    [DEBUG] [1792427990.136911016] [rcl]: Publisher initialized
    [DEBUG] [1792427990.143457031] [rcl]: Initializing service for service name 'log_demo/describe_parameters'
    [DEBUG] [1792427990.143505427] [rcl]: Expanded and remapped service name '/log_demo/describe_parameters'
    [DEBUG] [1792427990.144118586] [rmw_fastrtps_cpp]: ************ Service Details *********
    [DEBUG] [1792427990.144135285] [rmw_fastrtps_cpp]: Sub Topic rq/log_demo/describe_parametersRequest
    [DEBUG] [1792427990.144140879] [rmw_fastrtps_cpp]: Pub Topic rr/log_demo/describe_parametersReply
    … (181 more lines)

SITE (from line 1):

    [INFO] [log_demo]: Battery watcher started
    (Practice terminal: your node /log_demo now keeps running. Open a new terminal tab and look at it with ros2 node info /log_demo)   «hint»

Real lines of a kind the site never printed:

    [DEBUG] [1792427990.054572279] [rcl]: Using domain ID of '52'
    [DEBUG] [1792427990.069684553] [rcl]: Node initialized
    [DEBUG] [1792427990.069744414] [rcl]: Initializing publisher for topic name '/rosout'
    [DEBUG] [1792427990.069763717] [rcl]: Expanded and remapped topic name '/rosout'
    [DEBUG] [1792427990.073114851] [rcl]: Publisher initialized
    [DEBUG] [1792427990.135893649] [rcl]: Initializing publisher for topic name '/parameter_events'
    [DEBUG] [1792427990.135941697] [rcl]: Expanded and remapped topic name '/parameter_events'
    [DEBUG] [1792427990.136911016] [rcl]: Publisher initialized


### N5 1: Live terminal: watch YOUR state machine drive a square

Real: `parity/fixtures/lessons/N5/term1.json` · Site: `parity/browser_out/lessons/N5/term1.browser.json`

**Step 4 (task 3, terminal 2) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 5.4466352462768555
    y: 5.6884331703186035
    theta: -1.558229923248291
    linear_velocity: 1.0
    angular_velocity: 0.0
    ---

SITE:

    x: 5.544445
    y: 7.544425
    theta: -1.570786
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---

**Step 5 (task 4, terminal 2) DIFFERS:** `ros2 node info /square_driver`  (real exit 0, finished)

REAL (from line 16):

      Service Clients:
    
      Action Servers:
    
      Action Clients:

SITE (from line 16):

      Service Clients:
      Action Servers:
      Action Clients:


### N7b 1: Live terminal: drive to goals you choose

Real: `parity/fixtures/lessons/N7b/term1.json` · Site: `parity/browser_out/lessons/N7b/term1.browser.json`

**Step 3 (task 2, terminal 1) MATCH-VALUES:** `ros2 run chiku_control go_to_goal --ros-args -p goal_x:=2.0 -p goal_y:=9.0`  (real exit None, still running after 8 s; running: first 1 line(s) compared (real 1, site 1))

REAL:

    [INFO] [1792427079.327441447] [go_to_goal]: Goal reached: x=2.07 y=8.95

SITE:

    [INFO] [go_to_goal]: Goal reached: x=2.08 y=8.95

**Step 8 (task 6, terminal 2) DIFFERS:** `ros2 topic echo --once /turtle1/pose`  (real exit 0, finished)

REAL:

    x: 9.669705390930176
    y: 3.9761455059051514
    theta: -1.8385125398635864
    linear_velocity: 2.0
    angular_velocity: -0.08935455977916718
    ---

SITE:

    x: 9.216234
    y: 5.836164
    theta: -1.515822
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### N8 1: Live terminal: put the filter between you and the turtle

Real: `parity/fixtures/lessons/N8/term1.json` · Site: `parity/browser_out/lessons/N8/term1.browser.json`

**Step 4 (task 3, terminal 2) DIFFERS:** `ros2 node info /safety_filter`  (real exit 0, finished)

REAL (from line 18):

      Service Clients:
    
      Action Servers:
    
      Action Clients:

SITE (from line 18):

      Service Clients:
      Action Servers:
      Action Clients:


### N8 code1: Lesson code block commands: python safety_filter (not built in this lesson ws) and teleop remapped

Real: `parity/fixtures/lessons/N8/termcode1.json` · Site: `parity/browser_out/lessons/N8/termcode1.site.json`

**Step 2 (task 1, terminal 2) DIFFERS:** `ros2 run turtlesim turtle_teleop_key --ros-args -r /turtle1/cmd_vel:=/cmd_vel_in`  (real exit None, still running after 8 s; running: first 5 line(s) compared (real 5, site 5))

REAL:

    Reading from keyboard
    ---------------------------
    Use arrow keys to move the turtle.
    Use g|b|v|c|d|e|r|t keys to rotate to absolute orientations. 'f' to cancel a rotation.
    'q' to quit.

SITE:

    Reading from keyboard
    ---------------------------
    Use arrow keys to move the turtle.
    Use G|B|V|C|D|E|R|T keys to rotate to absolute orientations. 'F' to cancel a rotation.
    'Q' to quit.
    (Practice terminal: /teleop_turtle now keeps running in the background, as if in its own terminal window. Keep typing ros2 commands here to look at it.)   «hint»

**Step 3 (task 1, terminal 3) DIFFERS:** `ros2 node info /teleop_turtle`  (real exit 0, finished)

REAL (from line 16):

      Service Clients:
    
      Action Servers:
    
      Action Clients:
        /turtle1/rotate_absolute: turtlesim/action/RotateAbsolute

SITE (from line 16):

      Service Clients:
      Action Servers:
      Action Clients:
        /turtle1/rotate_absolute: turtlesim/action/RotateAbsolute


### N9 1: Live terminal: publish and inspect a JointState

Real: `parity/fixtures/lessons/N9/term1.json` · Site: `parity/browser_out/lessons/N9/term1.browser.json`

**Step 5 (task 4, terminal 2) DIFFERS:** `ros2 topic echo --once /joint_states`  (real exit 0, finished)

REAL (from line 2):

      stamp:
        sec: 1792427180
        nanosec: 827335927
      frame_id: ''
    name:
    - head_pan
    - head_tilt
    position:
    - -0.6582628759749534
    - -0.2805629745583681
    velocity:
    - 0.45463170381439877
    - -0.21245627603778147
    effort: []
    … (1 more lines)

SITE (from line 2):

      stamp:
        sec: 1790921104
        nanosec: 120000000
      frame_id: ''
    name:
    - head_pan
    - head_tilt
    position:
    - 0.0
    - 0.0
    velocity:
    - 0.0
    - 0.0
    effort: []
    … (1 more lines)


### N10 code1: Lesson code block commands: echo latched topic with QoS + info --verbose

Real: `parity/fixtures/lessons/N10/termcode1.json` · Site: `parity/browser_out/lessons/N10/termcode1.site.json`

**Step 4 (task 1, terminal 2) DIFFERS:** `ros2 topic echo /map_status --qos-durability transient_local --qos-reliability reliable`  (real exit None, still running after 8 s; running: first 2 line(s) compared (real 2, site 6))

REAL:

    data: map of the warehouse is ready
    ---

SITE:

    data: 'Hello World: 0'
    ---
    data: 'Hello World: 1'
    ---
    data: 'Hello World: 2'
    ---
    ^C
    Practice terminal stopped echo for you. On a real computer it keeps printing until you press Ctrl+C.   «hint»

**Step 5 (task 1, terminal 3) DIFFERS:** `ros2 topic info /map_status --verbose`  (real exit 0, finished)

REAL (from line 7):

    Topic type: std_msgs/msg/String
    Topic type hash: RIHS01_df668c740482bbd48fb39d76a70dfd4bd59db1288021743503259e948f6b1a18
    Endpoint type: PUBLISHER
    GID: 01.0f.17.2e.b7.84.d2.fb.00.00.00.00.00.00.13.03
    QoS profile:
      Reliability: RELIABLE
      History (Depth): UNKNOWN
      Durability: TRANSIENT_LOCAL
      Lifespan: Infinite
      Deadline: Infinite
      Liveliness: AUTOMATIC
      Liveliness lease duration: Infinite
    
    Subscription count: 1
    … (15 more lines)

SITE (from line 7):

    Topic type: std_msgs/msg/String
    Topic type hash: RIHS01_…
    Endpoint type: PUBLISHER
    GID: ac.00.81.c8.97.88.d5.0e.82.55.4f.dd.37.6b.41.97
    QoS profile:
      Reliability: RELIABLE
      History (Depth): UNKNOWN
      Durability: VOLATILE
      Lifespan: Infinite
      Deadline: Infinite
      Liveliness: AUTOMATIC
      Liveliness lease duration: Infinite
    
    Subscription count: 0
    … (1 more lines)


### N18 1: Live terminal: launch one robot, then two

Real: `parity/fixtures/lessons/N18/term1.json` · Site: `parity/browser_out/lessons/N18/term1.browser.json`

**Step 4 (task 3, terminal 1) DIFFERS:** `ros2 launch chiku_control turtle_goal.launch.py goal_x:=3.0 goal_y:=3.0`  (real exit None, still running after 8 s; running: first 5 line(s) compared (real 7, site 5); 2 real line(s) of other kinds missing on site)

REAL:

    [INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-19-21-57-47-666853-prasad-1207883
    [INFO] [launch]: Default logging verbosity is set to INFO
    [INFO] [turtlesim_node-1]: process started with pid [1207888]
    [INFO] [go_to_goal-2]: process started with pid [1207889]
    [turtlesim_node-1] [INFO] [1792427268.016823174] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792427268.033228800] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [go_to_goal-2] [INFO] [1792427273.353975423] [go_to_goal]: Goal reached: x=3.08 y=3.05

SITE:

    [INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-12-09-30-00-000000-ros2lab-4300
    [INFO] [launch]: Default logging verbosity is set to INFO
    [INFO] [turtlesim_node-1]: process started with pid [4307]
    [INFO] [go_to_goal-2]: process started with pid [4314]
    [INFO] [go_to_goal]: Goal reached: x=3.09 y=3.05

Real lines of a kind the site never printed:

    [turtlesim_node-1] [INFO] [1792427268.033228800] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [go_to_goal-2] [INFO] [1792427273.353975423] [go_to_goal]: Goal reached: x=3.08 y=3.05


### N19 1: Live terminal: broadcast and inspect frames

Real: `parity/fixtures/lessons/N19/term1.json` · Site: `parity/browser_out/lessons/N19/term1.browser.json`

**Step 4 (task 3, terminal 2) DIFFERS:** `ros2 node info /turtle_tf_broadcaster`  (real exit 0, finished)

REAL (from line 2):

      Subscribers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /turtle1/pose: turtlesim/msg/Pose
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
        /tf: tf2_msgs/msg/TFMessage
      Service Servers:
        /turtle_tf_broadcaster/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /turtle_tf_broadcaster/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /turtle_tf_broadcaster/get_parameters: rcl_interfaces/srv/GetParameters
        /turtle_tf_broadcaster/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /turtle_tf_broadcaster/list_parameters: rcl_interfaces/srv/ListParameters
        /turtle_tf_broadcaster/set_parameters: rcl_interfaces/srv/SetParameters
    … (6 more lines)

SITE (from line 2):

      Subscribers:
        /: turtlesim/msg/Pose
        /parameter_events: rcl_interfaces/msg/ParameterEvent
      Publishers:
        /parameter_events: rcl_interfaces/msg/ParameterEvent
        /rosout: rcl_interfaces/msg/Log
      Service Servers:
        /turtle_tf_broadcaster/describe_parameters: rcl_interfaces/srv/DescribeParameters
        /turtle_tf_broadcaster/get_parameter_types: rcl_interfaces/srv/GetParameterTypes
        /turtle_tf_broadcaster/get_parameters: rcl_interfaces/srv/GetParameters
        /turtle_tf_broadcaster/get_type_description: type_description_interfaces/srv/GetTypeDescription
        /turtle_tf_broadcaster/list_parameters: rcl_interfaces/srv/ListParameters
        /turtle_tf_broadcaster/set_parameters: rcl_interfaces/srv/SetParameters
        /turtle_tf_broadcaster/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically
    … (3 more lines)


### N19 code1: Lesson code block commands: tf2_echo world turtle1 + view_frames with broadcaster running

Real: `parity/fixtures/lessons/N19/termcode1.json` · Site: `parity/browser_out/lessons/N19/termcode1.site.json`

**Step 4 (task 1, terminal 2) DIFFERS:** `ros2 run tf2_ros tf2_echo world turtle1`  (real exit None, still running after 8 s; running: first 20 line(s) compared (real 71, site 20))

REAL (from line 1):

    [INFO] [1792428109.965209172] [tf2_echo]: Waiting for transform world ->  turtle1: Invalid frame ID "world" passed to canTransform argument target_frame - frame does not exist
    At time 1792428110.898299689
    - Translation: [5.544, 5.544, 0.000]
    - Rotation: in Quaternion (xyzw) [0.000, 0.000, 0.000, 1.000]
    - Rotation: in RPY (radian) [0.000, -0.000, 0.000]
    - Rotation: in RPY (degree) [0.000, -0.000, 0.000]
    - Matrix:
      1.000  0.000  0.000  5.544
      0.000  1.000  0.000  5.544
      0.000  0.000  1.000  0.000
      0.000  0.000  0.000  1.000
    At time 1792428111.906495856
    - Translation: [5.544, 5.544, 0.000]
    - Rotation: in Quaternion (xyzw) [0.000, 0.000, 0.000, 1.000]
    … (57 more lines)

SITE (from line 1):

    At time 1792428175.773999872
    - Translation: [5.544, 5.544, 0.000]
    - Rotation: in Quaternion (xyzw) [0.000, 0.000, 0.000, 1.000]
    - Rotation: in RPY (radian) [0.000, 0.000, 0.000]
    - Rotation: in RPY (degree) [0.000, 0.000, 0.000]
    - Matrix:
      1.000  0.000  0.000  5.544
      0.000  1.000  0.000  5.544
      0.000  0.000  1.000  0.000
      0.000  0.000  0.000  1.000
    At time 1792428176.773999872
    - Translation: [5.544, 5.544, 0.000]
    - Rotation: in Quaternion (xyzw) [0.000, 0.000, 0.000, 1.000]
    - Rotation: in RPY (radian) [0.000, 0.000, 0.000]
    … (8 more lines)

**Step 6 (task 1, terminal 3) DIFFERS:** `ros2 run tf2_tools view_frames`  (real exit 0, finished)

REAL:

    [INFO] [1792428121.628101606] [view_frames]: Listening to tf data for 5.0 seconds...
    [INFO] [1792428126.630484324] [view_frames]: Generating graph...
    [INFO] [1792428126.638796592] [view_frames]: Result:tf2_msgs.srv.FrameGraph_Response(frame_yaml="turtle1: \n  parent: 'world'\n  broadcaster: 'default_authority'\n  rate: 62.691\n  most_recent_transform: 1792428126.625988\n  oldest_transform: 1792428121.601379\n  buffer_length: 5.025\n")
    [INFO] [1792428126.645602454] [view_frames]: Exporting graph in frames_2026-10-19_22.12.06.pdf file...

SITE:

    [INFO] [1792428175.775000095] [view_frames]: Listening to tf data for 5.0 seconds...
    [INFO] [1792428175.775000095] [view_frames]: Generating graph...
    [INFO] [1792428175.775000095] [view_frames]: Result:tf2_msgs.srv.FrameGraph_Response(frame_yaml="turtle1: \n  parent: 'world' ...")
    [INFO] [1792428175.775000095] [view_frames]: Exporting graph in frames_2026-10-19_22.12.55.pdf file...
    Created frames_2026-10-19_22.12.55.pdf and frames_2026-10-19_22.12.55.gv in this folder. The PDF shows this tree:   «hint»
      world   «hint»
      └─ turtle1   «hint»


### N20 1: Live terminal: launch the chase

Real: `parity/fixtures/lessons/N20/term1.json` · Site: `parity/browser_out/lessons/N20/term1.browser.json`

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 launch chiku_control follow.launch.py`  (real exit None, still running after 8 s; running: first 7 line(s) compared (real 9, site 7); 2 real line(s) of other kinds missing on site)

REAL (from line 6):

    [INFO] [turtle_follower-4]: process started with pid [1208425]
    [turtlesim_node-1] [INFO] [1792427350.511189190] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792427350.528852396] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [turtlesim_node-1] [INFO] [1792427352.165080515] [sim]: Spawning turtle [turtle2] at x=[1.000000], y=[1.000000], theta=[0.000000]

SITE (from line 6):

    [INFO] [turtle_follower-4]: process started with pid [4328]
    [INFO] [sim]: Spawning turtle [turtle2] at x=[1.000000], y=[1.000000], theta=[0.000000]

Real lines of a kind the site never printed:

    [turtlesim_node-1] [INFO] [1792427350.528852396] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [turtlesim_node-1] [INFO] [1792427352.165080515] [sim]: Spawning turtle [turtle2] at x=[1.000000], y=[1.000000], theta=[0.000000]

**Step 6 (task 5, terminal 2) DIFFERS:** `ros2 topic echo --once /turtle2/pose`  (real exit 0, finished)

REAL:

    x: 6.683959007263184
    y: 8.910350799560547
    theta: 2.2630183696746826
    linear_velocity: 0.5665929913520813
    angular_velocity: 0.2947848439216614
    ---

SITE:

    x: 5.705643
    y: 8.052552
    theta: 1.537738
    linear_velocity: 0.0
    angular_velocity: 0.0
    ---


### N21 1: Live terminal: a node that is server and client at once

Real: `parity/fixtures/lessons/N21/term1.json` · Site: `parity/browser_out/lessons/N21/term1.browser.json`

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 run chiku_control_cpp battery_checker`  (real exit None, still running after 8 s; running: first 0 line(s) compared (real 3, site 0); 3 real line(s) of other kinds missing on site)

REAL:

    [INFO] [1792427390.941385845] [battery_checker]: battery: 93 % (ok=1)
    [INFO] [1792427392.942088595] [battery_checker]: battery: 86 % (ok=1)
    [INFO] [1792427394.942553457] [battery_checker]: battery: 79 % (ok=1)

SITE:

    (no output)

Real lines of a kind the site never printed:

    [INFO] [1792427390.941385845] [battery_checker]: battery: 93 % (ok=1)
    [INFO] [1792427392.942088595] [battery_checker]: battery: 86 % (ok=1)
    [INFO] [1792427394.942553457] [battery_checker]: battery: 79 % (ok=1)

**Step 4 (task 3, terminal 2) DIFFERS:** `ros2 node info /battery_checker`  (real exit 0, finished)

REAL (from line 18):

      Action Servers:
    
      Action Clients:

SITE (from line 18):

      Action Servers:
      Action Clients:

**Step 5 (task 4, terminal 2) DIFFERS:** `ros2 service call /chiku/battery std_srvs/srv/Trigger`  (real exit 0, finished)

REAL:

    waiting for service to become available...
    requester: making request: std_srvs.srv.Trigger_Request()
    
    response:
    std_srvs.srv.Trigger_Response(success=True, message='58 %')

SITE:

    requester: making request: std_srvs.srv.Trigger_Request()
    
    response:
    std_srvs.srv.Trigger_Response(success=True, message='')
    


### N22b 1: Live terminal: load a component into a container

Real: `parity/fixtures/lessons/N22b/term1.json` · Site: `parity/browser_out/lessons/N22b/term1.browser.json`

**Step 6 (task 3, terminal 2) DIFFERS:** `ros2 component types`  (real exit 0, finished)

REAL (from line 2):

      chiku_control_cpp::CircleComponent
    irobot_create_nodes
      irobot_create_nodes::HazardsVectorPublisher
      irobot_create_nodes::IrIntensityVectorPublisher
      irobot_create_nodes::MotionControlNode
      irobot_create_nodes::WheelsPublisher
      irobot_create_nodes::RobotState
      irobot_create_nodes::UIMgr
      irobot_create_nodes::MockPublisher
      irobot_create_nodes::KidnapEstimator
    moveit_servo
      moveit_servo::ServoNode
    quality_of_service_demo_cpp
      quality_of_service_demo::MessageLostListener
    … (194 more lines)

SITE (from line 2):

      chiku_control_cpp::CircleComponent


### N23 1: Live terminal: run the test suites

Real: `parity/fixtures/lessons/N23/term1.json` · Site: `parity/browser_out/lessons/N23/term1.browser.json`

**Step 3 (task 3, terminal 1) DIFFERS:** `colcon test --packages-select chiku_control chiku_control_cpp`  (real exit 5, finished)

REAL (from line 2):

    Starting >>> chiku_control_cpp
    --- stderr: chiku_control
    
    ----------------------------------------------------------------------
    Ran 0 tests in 0.000s
    
    NO TESTS RAN
    ---
    Failed   <<< chiku_control [0.74s, exited with code 5]
    Finished <<< chiku_control_cpp [0.82s]
    
    Summary: 1 package finished [1.23s]
      1 package failed: chiku_control
      1 package had stderr output: chiku_control

SITE (from line 2):

    Starting >>> chiku_control_cpp
    Finished <<< chiku_control [1.10s]
    Finished <<< chiku_control_cpp [1.70s]
    
    Summary: 2 packages finished [2.6s]

**Step 4 (task 4, terminal 1) MATCH-VALUES:** `colcon test-result --verbose`  (real exit 0, finished)

REAL:

    Summary: 6 tests, 0 errors, 0 failures, 0 skipped

SITE:

    Summary: 12 tests, 0 errors, 0 failures, 0 skipped
    Only failures are listed one by one. Add --all to see every result file.   «hint»

**Step 5 (task 5, terminal 1) DIFFERS:** `colcon test-result --all`  (real exit 0, finished)

REAL:

    build/chiku_control_cpp/Testing/20261019-1632/Test.xml: 1 test, 0 errors, 0 failures, 0 skipped
    build/chiku_control_cpp/test_results/chiku_control_cpp/test_control_math.gtest.xml: 5 tests, 0 errors, 0 failures, 0 skipped
    
    Summary: 6 tests, 0 errors, 0 failures, 0 skipped

SITE:

    build/chiku_control/pytest.xml: 6 tests, 0 errors, 0 failures, 0 skipped
    build/chiku_control_cpp/Testing/20261012-0930/Test.xml: 1 test, 0 errors, 0 failures, 0 skipped
    build/chiku_control_cpp/test_results/chiku_control_cpp/test_control_math.gtest.xml: 5 tests, 0 errors, 0 failures, 0 skipped
    
    Summary: 12 tests, 0 errors, 0 failures, 0 skipped


### N24b 1: Live terminal: run and operate the patrol robot

Real: `parity/fixtures/lessons/N24b/term1.json` · Site: `parity/browser_out/lessons/N24b/term1.browser.json`

**Step 1 (task 1, terminal 1) DIFFERS:** `colcon build --packages-select my_robot_interfaces chiku_control`  (real exit 0, finished)

REAL (from line 1):

    Starting >>> my_robot_interfaces
    [Processing: my_robot_interfaces]
    Finished <<< my_robot_interfaces [34.1s]
    Starting >>> chiku_control
    Finished <<< chiku_control [3.38s]
    
    Summary: 2 packages finished [38.1s]

SITE (from line 1):

    Starting >>> chiku_control
    Starting >>> my_robot_interfaces
    Finished <<< chiku_control [0.90s]
    Finished <<< my_robot_interfaces [1.27s]
    
    Summary: 2 packages finished [1.64s]
    Built. Now load the workspace in this terminal: source install/setup.bash   «hint»

**Step 3 (task 2, terminal 1) DIFFERS:** `ros2 launch chiku_control patrol.launch.py`  (real exit None, still running after 8 s; running: first 6 line(s) compared (real 9, site 6); 3 real line(s) of other kinds missing on site)

REAL (from line 5):

    [INFO] [turtle_tf_broadcaster-3]: process started with pid [1210922]
    [turtlesim_node-1] [INFO] [1792427576.980901242] [sim]: Starting turtlesim with node name /sim
    [turtlesim_node-1] [INFO] [1792427576.992646421] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [patrol-2] [INFO] [1792427577.970080380] [patrol]: Patrolling 4 waypoints
    [patrol-2] [INFO] [1792427581.843261084] [patrol]: reached waypoint, next is (9.0, 2.0)

SITE (from line 5):

    [INFO] [turtle_tf_broadcaster-3]: process started with pid [4321]
    [INFO] [patrol]: reached waypoint, next is (9.0, 2.0)

Real lines of a kind the site never printed:

    [turtlesim_node-1] [INFO] [1792427576.992646421] [sim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]
    [patrol-2] [INFO] [1792427577.970080380] [patrol]: Patrolling 4 waypoints
    [patrol-2] [INFO] [1792427581.843261084] [patrol]: reached waypoint, next is (9.0, 2.0)

**Step 6 (task 3, terminal 2) DIFFERS:** `ros2 param get /patrol waypoints`  (real exit 0, finished)

REAL:

    Double values are: [2.0, 2.0, 9.0, 2.0, 9.0, 9.0, 2.0, 9.0]

SITE:

    Double array value is: array('d', [2.0, 2.0, 9.0, 2.0, 9.0, 9.0, 2.0, 9.0])

**Step 7 (task 4, terminal 2) DIFFERS:** `ros2 topic echo --once /chiku/status`  (real exit 0, finished)

REAL:

    name: chiku
    x: 8.356465339660645
    y: 9.221511840820312
    battery: 100.0
    moving: true
    ---

SITE:

    name: chiku
    x: 9.01504
    y: 8.649104
    battery: 0.0
    moving: false
    ---

**Step 9 (task 6, terminal 2) DIFFERS:** `ros2 service call /patrol/pause std_srvs/srv/SetBool "{data: false}"`  (real exit 0, finished)

REAL:

    waiting for service to become available...
    requester: making request: std_srvs.srv.SetBool_Request(data=False)
    
    response:
    std_srvs.srv.SetBool_Response(success=True, message='patrolling')

SITE:

    requester: making request: std_srvs.srv.SetBool_Request(data=False)
    
    response:
    std_srvs.srv.SetBool_Response(success=True, message='patrolling')
    


### D11 code1: Lesson code block commands: tf2_echo map base_link + view_frames with NO robot running (lesson shows them for a running robot)

Real: `parity/fixtures/lessons/D11/termcode1.json` · Site: `parity/browser_out/lessons/D11/termcode1.site.json`

**Step 2 (task 1, terminal 1) DIFFERS:** `ros2 run tf2_tools view_frames`  (real exit 0, finished)

REAL:

    [INFO] [1792427927.133727830] [view_frames]: Listening to tf data for 5.0 seconds...
    [INFO] [1792427932.177989576] [view_frames]: Generating graph...
    [INFO] [1792427932.185241023] [view_frames]: Result:tf2_msgs.srv.FrameGraph_Response(frame_yaml='[]')
    [INFO] [1792427932.188209223] [view_frames]: Exporting graph in frames_2026-10-19_22.08.52.pdf file...

SITE:

    [INFO] [1792428175.778000116] [view_frames]: Listening to tf data for 5.0 seconds...
    [INFO] [1792428175.778000116] [view_frames]: Generating graph...
    [INFO] [view_frames]: Result:tf2_msgs.srv.FrameGraph_Response(frame_yaml='[]')
    No TF frames are being published. Start robot_state_publisher (and joint_state_publisher) or a static_transform_publisher first.   «hint»


## Site hints (class `hint`)

Allowed beginner hints shown after the real-looking output. Listed once per text.

- D1 1 step 5 `rqt_graph`: “(Practice terminal: the rqt graph window would open here.)”
- D3 1 step 5 `ros2 topic hz /turtle1/pose`: “About 62.5 messages per second. On a real computer it keeps measuring until you press Ctrl+C.”
- D3 1 step 6 `ros2 topic echo /turtle1/Pose`: “Nobody uses /turtle1/Pose. Check the spelling (names are case-sensitive) with: ros2 topic list”
- D4 1 step 3 `ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 1.8}}"`: “(The turtle moved. turtle1 is now at x=6.56, y=6.96, facing 1.80 rad. Check with: ros2 topic echo --once /turtle1/pose)”
- D4 1 step 5 `ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.0}, angular: {z: 3.0}}"`: “(The turtle moved. turtle1 is now at x=6.56, y=6.96, facing -1.48 rad. Check with: ros2 topic echo --once /turtle1/pose)”
- D6 1 step 3 `ros2 service call /spawn turtlesim/srv/Spawn "{x: 2, y: 2, theta: 0.2, name: ''}"`: “(A new turtle, turtle2, appeared. It brings its own topics: see ros2 topic list)”
- D6 1 step 5 `ros2 service call /spawn turtlesim/srv/Spawn "{x: 8, y: 3, theta: 0.0, name: 'chiku'}"`: “(A new turtle, chiku, appeared. It brings its own topics: see ros2 topic list)”
- D7 1 step 3 `ros2 param set /turtlesim background_r 150`: “(The turtlesim window background is now rgb(150, 86, 255).)”
- D9 1 step 4 `ros2 topic pub --once /turtlesim1/turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 1.8}}"`: “(The turtle moved. turtle1 is now at x=6.56, y=6.96, facing 1.80 rad. Check with: ros2 topic echo --once /turtlesim1/turtle1/pose)”
- D10 1 step 5 `colcon build`: “Built. Now load the workspace in this terminal: source install/setup.bash”
- D12 1 step 1 `ros2 bag record -o drive /turtle1/cmd_vel /turtle1/pose`: “Practice terminal: recorded about 20 seconds, then stopped (on a real computer: Ctrl+C). The bag is the folder drive/”
- D12 1 step 3 `ros2 bag play drive`: “(The recorded messages were published again, exactly as they happened. The turtle repeated the same drive!)”
- D13 1 step 1 `ros2 service call /spawn turtlesim/srv/Spawn "{x: 2, y: 8, theta: 0.0, name: 'raju'}"`: “(A new turtle, raju, appeared. It brings its own topics: see ros2 topic list)”
- D13 1 step 3 `ros2 topic pub --once /raju/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 3.0}}"`: “(The turtle moved. raju is now at x=5.00, y=8.00, facing 0.00 rad. Check with: ros2 topic echo --once /raju/pose)”
- F11 1 step 3 `ros2 run chiku_control spawn_client`: “(Your client program asked turtlesim for a turtle called chiku2, printed the answer and ended. Look at the TurtleSim window and at: ros2 service list)”
- F11 1 step 4 `ros2 run chiku_control spawn_client`: “(turtlesim refused: that name is already taken, so the answer's name is empty. Its own terminal shows an ERROR line. Change request.name and build again.)”
- F11 1 step 5 `ros2 run chiku_control turtle_artist`: “(Your client program asked turtlesim for a turtle called artist, printed the answer and ended. Look at the TurtleSim window and at: ros2 service list)”
- F12 1 step 3 `ros2 run chiku_control_cpp spawn_client`: “(Your client program asked turtlesim for a turtle called helper, printed the answer and ended. Look at the TurtleSim window and at: ros2 service list)”
- F12 1 step 5 `ros2 topic pub --once /helper/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}}"`: “(The turtle moved. helper is now at x=4.00, y=8.00, facing 0.00 rad. Check with: ros2 topic echo --once /helper/pose)”
- F13 1 step 7 `ros2 action send_goal --feedback /chiku/drive_distance my_robot_interfaces/action/DriveDistance "{distance: 2.0, speed: 0.5}"`: “(turtle1 drove 2.0 m and is now at x=7.54, y=5.54.)”
- F15 code1 step 3 `ros2 run chiku_control speed_driver --ros-args -p speed:=0.5 -p robot_name:=bolt`: “(Practice terminal: your node /speed_driver now keeps running. Open a new terminal tab and look at it with ros2 node info /speed_driver)”
- F15 code1 step 8 `ros2 run chiku_control speed_driver --ros-args --params-file config/speed.yaml`: “Two nodes with the same name confuse ROS 2. Give the second one a new name with --ros-args --remap __node:=another_name”
- F17 1 step 3 `ros2 launch chiku_control circle.launch.py`: “The file exists in src, but it was never INSTALLED. Add the install rule (CMakeLists.txt: install(DIRECTORY launch ...) or setup.py: data_files), then colcon build and source again.”
- N4 code1 step 3 `ros2 run chiku_control log_demo --ros-args --log-level debug`: “(Practice terminal: your node /log_demo now keeps running. Open a new terminal tab and look at it with ros2 node info /log_demo)”
- N4 code1 step 6 `ros2 run chiku_control_cpp log_demo --ros-args --log-level warn`: “Is it installed (sudo apt install ros-jazzy-...)? Is the name spelled with _ underscores?”
- N8 1 step 5 `ros2 topic pub --once /cmd_vel_in geometry_msgs/msg/Twist "{linear: {x: 3.0}}"`: “(Your safety_filter node passed the command on, limited to linear.x=1.0. turtle1 is now at x=6.54, y=5.54.)”
- N8 1 step 7 `ros2 topic pub --once /cmd_vel_in geometry_msgs/msg/Twist "{angular: {z: 3.14}}"`: “(Your safety_filter node passed the command on. turtle1 is now at x=9.54, y=5.54.)”
- N8 code1 step 2 `ros2 run turtlesim turtle_teleop_key --ros-args -r /turtle1/cmd_vel:=/cmd_vel_in`: “(Practice terminal: /teleop_turtle now keeps running in the background, as if in its own terminal window. Keep typing ros2 commands here to look at it.)”
- N10 1 step 4 `ros2 run chiku_control late_listener`: “It is built in your workspace, but THIS terminal has not loaded it: source install/setup.bash (in ~/ros2_ws). Every new terminal needs it, unless ~/.bashrc does it.”
- N10 1 step 6 `ros2 node info /late_listener`: “Node names start with /. See them with: ros2 node list”
- N10 code1 step 3 `ros2 run chiku_control latched_status`: “(Practice terminal: your node /latched_status now keeps running. Open a new terminal tab and look at it with ros2 node info /latched_status)”
- N10 code1 step 4 `ros2 topic echo /map_status --qos-durability transient_local --qos-reliability reliable`: “Practice terminal stopped echo for you. On a real computer it keeps printing until you press Ctrl+C.”
- N18 1 step 6 `ros2 launch chiku_control two_robots.launch.xml with_monitor:=false`: “It is built in your workspace, but THIS terminal has not loaded it: cd ~/ros2_ws && source install/setup.bash (every new terminal needs it).”
- N18 1 step 8 `ros2 param get /robot2/go_to_goal goal_x`: “See the running nodes with: ros2 node list”
- N19 code1 step 3 `ros2 run chiku_control_cpp turtle_tf_broadcaster`: “(Practice terminal: your node /turtle_tf_broadcaster now keeps running. Open a new terminal tab and look at it with ros2 node info /turtle_tf_broadcaster)”
- N19 code1 step 4 `ros2 run tf2_ros tf2_echo world turtle1`: “(tf2_echo prints turtle1 as seen from world once per second until Ctrl+C.)”
- N19 code1 step 6 `ros2 run tf2_tools view_frames`: “Created frames_2026-10-19_22.12.55.pdf and frames_2026-10-19_22.12.55.gv in this folder. The PDF shows this tree:”
- N19 code1 step 6 `ros2 run tf2_tools view_frames`: “  world”
- N19 code1 step 6 `ros2 run tf2_tools view_frames`: “  └─ turtle1”
- N23 1 step 4 `colcon test-result --verbose`: “Only failures are listed one by one. Add --all to see every result file.”
- D11 code1 step 1 `ros2 run tf2_ros tf2_echo map base_link`: “tf2_echo waits until both frames exist. Start the node that broadcasts them.”
- D11 code1 step 2 `ros2 run tf2_tools view_frames`: “No TF frames are being published. Start robot_state_publisher (and joint_state_publisher) or a static_transform_publisher first.”

## Node Shell vs browser terminal

Same command, same block: where the lines the browser terminal showed differ from what the Node Shell returned (normalised, hint lines left out). The browser runs user nodes and the turtle in real time, so it is the primary site capture; most differences below are the Node Shell not running user code or not moving the turtle.

- D12 2 step 4 `ros2 run demo_nodes_py talker`: Node 3 line(s) [DIFFERS], browser 11 line(s) [DIFFERS]. Node first: “[INFO] [talker]: Publishing: 'Hello World: 1'”; browser first: “[INFO] [talker]: Publishing: 'Hello World: 1'”
- F4 1 step 5 `ros2 topic echo --once /turtle1/pose`: Node 6 line(s) [DIFFERS], browser 6 line(s) [DIFFERS]. Node first: “x: 5.544445”; browser first: “x: 4.954559”
- F9 1 step 7 `ros2 topic echo --once /turtle1/pose`: Node 6 line(s) [DIFFERS], browser 6 line(s) [DIFFERS]. Node first: “x: 5.544445”; browser first: “x: 6.768015”
- F19 1 step 6 `ros2 topic echo --once /chiku/battery`: Node 5 line(s) [DIFFERS], browser 5 line(s) [DIFFERS]. Node first: “robot_name: chiku”; browser first: “robot_name: chiku”
- F20 1 step 6 `ros2 topic echo --once /chiku/battery`: Node 5 line(s) [DIFFERS], browser 5 line(s) [DIFFERS]. Node first: “robot_name: chiku”; browser first: “robot_name: chiku”
- N5 1 step 3 `ros2 run chiku_control_cpp square_driver`: Node 0 line(s) [DIFFERS], browser 2 line(s) [MATCH]; browser first: “[INFO] [square_driver]: side 1 done”
- N5 1 step 4 `ros2 topic echo --once /turtle1/pose`: Node 6 line(s) [DIFFERS], browser 6 line(s) [DIFFERS]. Node first: “x: 5.544445”; browser first: “x: 5.544445”
- N7b 1 step 3 `ros2 run chiku_control go_to_goal --ros-args -p goal_x:=2.0 -p goal_y:=9.0`: Node 0 line(s) [DIFFERS], browser 1 line(s) [MATCH-VALUES]; browser first: “[INFO] [go_to_goal]: Goal reached: x=2.08 y=8.95”
- N7b 1 step 8 `ros2 topic echo --once /turtle1/pose`: Node 6 line(s) [DIFFERS], browser 6 line(s) [DIFFERS]. Node first: “x: 5.544445”; browser first: “x: 9.216234”
- N9 1 step 4 `ros2 interface show sensor_msgs/msg/JointState`: Node 6 line(s) [DIFFERS], browser 27 line(s) [MATCH]. Node first: “# This is a message that holds data to describe the state of a set of torque controlled jo”; browser first: “# This is a message that holds data to describe the state of a set of torque controlled jo”
- N18 1 step 4 `ros2 launch chiku_control turtle_goal.launch.py goal_x:=3.0 goal_y:=3.0`: Node 4 line(s) [DIFFERS], browser 5 line(s) [DIFFERS]. Node first: “[INFO] [launch]: All log files can be found below /home/<U>/.ros/log/<LOGDIR>”; browser first: “[INFO] [launch]: All log files can be found below /home/<U>/.ros/log/<LOGDIR>”
- N20 1 step 3 `ros2 launch chiku_control follow.launch.py`: Node 6 line(s) [DIFFERS], browser 7 line(s) [DIFFERS]. Node first: “[INFO] [launch]: All log files can be found below /home/<U>/.ros/log/<LOGDIR>”; browser first: “[INFO] [launch]: All log files can be found below /home/<U>/.ros/log/<LOGDIR>”
- N20 1 step 6 `ros2 topic echo --once /turtle2/pose`: Node 1 line(s) [DIFFERS], browser 6 line(s) [DIFFERS]. Node first: “WARNING: topic [/turtle2/pose] does not appear to be published yet”; browser first: “x: 5.705643”
- N24b 1 step 3 `ros2 launch chiku_control patrol.launch.py`: Node 5 line(s) [DIFFERS], browser 6 line(s) [DIFFERS]. Node first: “[INFO] [launch]: All log files can be found below /home/<U>/.ros/log/<LOGDIR>”; browser first: “[INFO] [launch]: All log files can be found below /home/<U>/.ros/log/<LOGDIR>”
- N24b 1 step 7 `ros2 topic echo --once /chiku/status`: Node 6 line(s) [DIFFERS], browser 6 line(s) [DIFFERS]. Node first: “name: chiku”; browser first: “name: chiku”

- N10 1: browser shows 2/5 tasks done after typing every solution
- N18 1: browser shows 4/7 tasks done after typing every solution
- N19 1: browser shows 3/5 tasks done after typing every solution

## What Ctrl+C prints (real interrupt steps vs the browser's Ctrl+C button at the end of the block)

Last lines of each real interrupt step (periodic node output left out) and the last lines the browser terminal printed after its Ctrl+C button.

- **D1 1** REAL: `rqt_graph` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: (no Ctrl+C needed)
- **D2 1** REAL: `ros2 run turtlesim turtlesim_node` → “[INFO] [T] [turtlesim]: Starting turtlesim with node name /turtlesim” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”; `ros2 run turtlesim turtle_teleop_key` → “Use arrow keys to move the turtle.” / “Use g|b|v|c|d|e|r|t keys to rotate to absolute orientations. 'f' to cancel a rotation.” / “'q' to quit.”; `ros2 run turtlesim turtlesim_node --ros-args --remap __node:=my_turtle` → “[INFO] [T] [my_turtle]: Starting turtlesim with node name /my_turtle” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”; “^C[INFO] [rclcpp]: signal_handler(signum=2)”; “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **D2 2** REAL: `ros2 run turtlesim turtlesim_node --ros-args --remap __ns:=/robot2` → “[INFO] [T] [robot2.turtlesim]: Starting turtlesim with node name /robot2/turtlesim” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **D3 1** REAL: `ros2 topic hz /turtle1/pose` → (nothing)  
  SITE: (no Ctrl+C needed)
- **D9 1** REAL: `ros2 launch turtlesim multisim.launch.py` → “[turtlesim_node-2] [INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 1194271]” / “[INFO] [turtlesim_node-2]: process has finished cleanly [pid 1194272]”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)” / “[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)” / “[INFO] [sim-1]: process has finished cleanly [pid 4321]” / “[INFO] [sim-2]: process has finished cleanly [pid 4322]”
- **D12 1** REAL: `ros2 bag record -o drive /turtle1/cmd_vel /turtle1/pose` → “[INFO] [T] [rosbag2_recorder]: Pausing recording.” / “[INFO] [T] [rosbag2_recorder]: Recording stopped” / “[INFO] [T] [rosbag2_recorder]: Event publisher thread: Exited”; `ros2 bag play drive` → “[INFO] [T] [rosbag2_player]: Press CURSOR_UP for Increase Rate 10%” / “[INFO] [T] [rosbag2_player]: Press CURSOR_DOWN for Decrease Rate 10%” / “[INFO] [T] [rosbag2_player]: Playback until timestamp: -1”  
  SITE: (no Ctrl+C needed)
- **D12 2** REAL: `ros2 run demo_nodes_py talker` → (nothing); `ros2 topic hz /chatter` → (nothing)  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F1 1** REAL: `ros2 run chiku_py hello_node` → (nothing)  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F2 1** REAL: `ros2 run chiku_cpp hello_node` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F3 1** REAL: `ros2 run chiku_control circle_driver` → “[INFO] [T] [circle_driver]: Driving in a circle. Press Ctrl+C to stop.”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F4 1** REAL: `ros2 run chiku_control_cpp circle_driver` → “[INFO] [T] [circle_driver]: Driving in a circle. Press Ctrl+C to stop.” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F5 1** REAL: `ros2 run chiku_control pose_monitor` → (nothing)  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F6 1** REAL: `ros2 run chiku_control_cpp pose_monitor` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F7 1** REAL: `ros2 run chiku_control status_publisher` → (nothing)  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F8 1** REAL: `ros2 run chiku_control_cpp status_publisher` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F9 1** REAL: `ros2 run chiku_control switchable_driver` → “[INFO] [T] [switchable_driver]: Ready. Call /chiku/enable with data: true to start.”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F10 1** REAL: `ros2 run chiku_control_cpp switchable_driver` → “[INFO] [T] [switchable_driver]: Ready. Call /chiku/enable with data: true to start.” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F13 1** REAL: `ros2 run chiku_control drive_distance_server` → “[INFO] [T] [drive_distance_server]: Action server /chiku/drive_distance is ready”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F14 1** REAL: `ros2 run chiku_control_cpp drive_distance_server` → “[INFO] [T] [drive_distance_server]: Action server /chiku/drive_distance is ready” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F15 1** REAL: `ros2 run chiku_control speed_driver` → “[INFO] [T] [speed_driver]: chiku is ready to drive”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F16 1** REAL: `ros2 run chiku_control_cpp speed_driver --ros-args --params-file src/chiku_control_cpp/config/speed.yaml` → “[INFO] [T] [speed_driver]: chiku is ready to drive” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **F17 1** REAL: `ros2 launch chiku_control circle.launch.py` → “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 1202932]” / “[INFO] [pose_monitor-3]: process has finished cleanly [pid 1202934]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 1202933]”  
  SITE: “[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 4307]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 4314]” / “[INFO] [pose_monitor-3]: process has finished cleanly [pid 4321]”
- **F18 1** REAL: `ros2 launch chiku_control_cpp circle.launch.xml` → “[INFO] [pose_monitor-3]: process has finished cleanly [pid 1203276]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 1203275]” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 1203274]”  
  SITE: “[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 4307]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 4314]” / “[INFO] [pose_monitor-3]: process has finished cleanly [pid 4321]”
- **F19 1** REAL: `ros2 launch chiku_control mission.launch.py` → “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 1204416]” / “[INFO] [battery_monitor-3]: process has finished cleanly [pid 1204418]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 1204417]”  
  SITE: “[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 4307]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 4314]” / “[INFO] [battery_monitor-3]: process has finished cleanly [pid 4321]”
- **F20 1** REAL: `ros2 launch chiku_control_cpp mission.launch.py` → “[INFO] [battery_monitor-3]: process has finished cleanly [pid 1205730]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 1205729]” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 1205728]”  
  SITE: “[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 4307]” / “[INFO] [speed_driver-2]: process has finished cleanly [pid 4314]” / “[INFO] [battery_monitor-3]: process has finished cleanly [pid 4321]”
- **N2 1** REAL: `ros2 run chiku_control_cpp heartbeat` → “[INFO] [T] [heartbeat]: 10 beats done, stopping the timer” / “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N4 1** REAL: `ros2 run chiku_control log_demo --ros-args --log-level log_demo:=debug` → “[DEBUG] [T] [log_demo]: raw battery value: 52.0” / “[ERROR] [T] [log_demo]: battery low, going home!” / “[DEBUG] [T] [log_demo]: raw battery value: 50.5”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N5 1** REAL: `ros2 run chiku_control_cpp square_driver` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N7b 1** REAL: `ros2 run chiku_control go_to_goal --ros-args -p goal_x:=2.0 -p goal_y:=9.0` → (nothing)  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N8 1** REAL: `ros2 run chiku_control_cpp safety_filter --ros-args -r cmd_vel_out:=/turtle1/cmd_vel -p max_speed:=1.0` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N9 1** REAL: `ros2 run chiku_control head_joints` → (nothing)  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N10 1** REAL: `ros2 run chiku_control latched_status` → “[INFO] [T] [latched_status]: Published the map status once”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N17b 1** REAL: `ros2 run chiku_control cruise_control` → “[INFO] [T] [cruise_control]: chiku: speed=1.0 turn=0.5”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N18 1** REAL: `ros2 launch chiku_control turtle_goal.launch.py goal_x:=3.0 goal_y:=3.0` → “[turtlesim_node-1] [INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 1207888]” / “[INFO] [go_to_goal-2]: process has finished cleanly [pid 1207889]”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)” / “[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 4307]” / “[INFO] [go_to_goal-2]: process has finished cleanly [pid 4314]”
- **N19 1** REAL: `ros2 run chiku_control_cpp turtle_tf_broadcaster` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N20 1** REAL: `ros2 launch chiku_control follow.launch.py` → “[INFO] [turtle_follower-4]: process has finished cleanly [pid 1208425]” / “[INFO] [turtle_tf_broadcaster-2]: process has finished cleanly [pid 1208423]” / “[INFO] [turtle_tf_broadcaster-3]: process has finished cleanly [pid 1208424]”  
  SITE: “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 4307]” / “[INFO] [turtle_tf_broadcaster-2]: process has finished cleanly [pid 4314]” / “[INFO] [turtle_tf_broadcaster-3]: process has finished cleanly [pid 4321]” / “[INFO] [turtle_follower-4]: process has finished cleanly [pid 4328]”
- **N21 1** REAL: `ros2 run chiku_control_cpp battery_checker` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N22 1** REAL: `ros2 run chiku_control_cpp lifecycle_driver` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N22b 1** REAL: `ros2 run rclcpp_components component_container` → “[INFO] [T] [rclcpp]: signal_handler(SIGINT/SIGTERM)”  
  SITE: “^C[INFO] [rclcpp]: signal_handler(signum=2)”
- **N24b 1** REAL: `ros2 launch chiku_control patrol.launch.py` → “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 1210920]” / “[INFO] [patrol-2]: process has finished cleanly [pid 1210921]” / “[INFO] [turtle_tf_broadcaster-3]: process has finished cleanly [pid 1210922]”  
  SITE: “[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)” / “[INFO] [turtlesim_node-1]: process has finished cleanly [pid 4307]” / “[INFO] [patrol-2]: process has finished cleanly [pid 4314]” / “[INFO] [turtle_tf_broadcaster-3]: process has finished cleanly [pid 4321]”
