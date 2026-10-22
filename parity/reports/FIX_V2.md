# FIX_V2 – course content fixes from AUDIT_V2 (2026-10-20, branch fix-v2)

Branch `fix-v2` = `master` + `git merge --no-ff parity-v2` (no conflicts). Only the COURSE CONTENT items of
`AUDIT_V2.md` §F P1 were in scope. Every lesson was re-captured on real ROS 2 Jazzy (Ubuntu 24.04), domain 52,
with `parity/scripts/lessons/run_lesson_terms.py` (blocks from `dump_term_blocks.mjs`), Xvfb `:52` for GUI nodes.
Fixture paths below are under `parity/fixtures/lessons/`. `*_runner.txt` are the tracked excerpts of the logs.

## Fixed

| # | Item | Real evidence before | What changed in `content/course-content.json` | Real evidence after | Commit |
|---|---|---|---|---|---|
| 1 | XT5 / RV1: `robot_state_publisher --ros-args -p robot_description:="$(xacro chiku.urdf.xacro)"` aborts | `Couldn't parse parameter override rule`, `[ros2run]: Aborted` (old `XT5/term1`, `RV1/term1`); cause `_investigations/xt5_rsp_colon.txt` (works with the comment line removed) | Line 2 of `~/urdf/chiku.urdf.xacro` in XT5 and RV1 only: `Chiku, a 2-wheeled … (REP 105 frames, base_footprint …)` – no ": ". XT5 common mistakes: one line on ": " in the URDF text. XT3/XT7/UR5 keep the old comment (they do not pass the URDF with `-p`). | `XT5/term1_runner.txt`: `Robot initialized`; `tf2_echo base_footprint lidar_link` → `Translation: [0.100, 0.000, 0.250]`; left_wheel_link "does not exist" until joint_state_publisher_gui, then `Translation: [-0.100, 0.170, 0.080]`; view_frames writes `frames_….pdf`. `RV1/term1_runner.txt`: `Robot initialized` (RViz steps stay GUI/PENDING as before). | 5497e01 |
| 2 | D4 term 2, D13, F12: `SetPen "{…, off: 0}"` fails | `Failed to populate field: attribute name must be string, not 'bool'`, exit 1 (old `D4/term2`, `D13/term1`, `F12/term1`) | `'off': 0` (quoted) in the `do` and `sol` of the three tasks; hint says why. Forms tried first on real: `_investigations/setpen_off_forms.txt` (bare fails; `'off': 0` and no `off` both work). The site Shell also accepts `'off': 0` (checked in Node). | `D4/term2_runner.txt`, `D13/term1_runner.txt`, `F12/term1_runner.txt`: `SetPen_Request(… off=0)` → `response: turtlesim.srv.SetPen_Response()`, exit 0 | a081318 |
| 3 | F15 code block `--params-file config/speed.yaml` from ~/ros2_ws | `Couldn't parse params file … Error opening YAML file`, exit 1 (old `F15/termcode1`) | Code block: save the file as `src/chiku_control/config/speed.yaml` and pass that path; the YAML tab label and the "Tested on a real system" tip name the same path. | Blocks `parity/scripts/lessons/extra_blocks/F15_code.json`. `F15/termcode1_runner.txt` (-p part: speed 0.5, robot_name bolt). `F15/termcode2_runner.txt`: node starts, `param get` → `Double value is: 1.5`, `1.0`, `String value is: chiku` (= the tip). | 6865784 |
| 4 | N10, N18, N19: new terminal without `source install/setup.bash` | `Package 'chiku_control' not found` / `Package 'chiku_control_cpp' not found` (old `N10/term1`, `N18/term1`, `N19/term1`); `tools/check-content.mjs` PROBLEM on the same tasks | The task that opens the new terminal now says "load the workspace (`cd ~/ros2_ws`, `source install/setup.bash`)" and its `sol` includes both (N10 task 3, N18 task 4, N19 task 3). | `N10/term1_runner.txt`: late_listener `I joined late but still got: "map of the warehouse is ready"`. `N18/term1_runner.txt`: `Double value is: 3.0`, node list has `/robot2/sim`, `/robot2/go_to_goal goal_x` = 9.0. `N19/term1_runner.txt`: node info lists `/tf: tf2_msgs/msg/TFMessage`, `/broadcaster2 turtlename` = `turtle2`. check-content: no PROBLEM. | 5ebfa0d |
| 5 | N23 `colcon test`: chiku_control `NO TESTS RAN`, exit code 5 | old `N23/term1` | Cause found on real (`_investigations/n23_colcon_test_cause.txt`): colcon-core 0.21.3 uses its pytest step only if pytest is in setup.py `tests_require`/`extras_require`; otherwise `python -m unittest` runs, which finds no TestCase in pytest-style tests. `<test_depend>python3-pytest</test_depend>` alone: still 0 tests; with `extras_require={'test': ['pytest']}`: 6 tests. Lesson's `setup.py` gets `extras_require={'test': ['pytest']}` and `package.xml` the test_depend (as `ros2 pkg create` makes them); the common-mistake line now states this verified cause. | `N23/term1_runner.txt`: `colcon test` exit 0; `test-result --all` → `build/chiku_control/pytest.xml: 6 tests`, gtest.xml 5, Test.xml 1, `Summary: 12 tests, 0 errors, 0 failures, 0 skipped` (= the lesson's tip and checks) | 6c5bb21 |

## Left (not changed here) and why

- **Site side of these items** (not content): the site Shell still accepts bare `off: 0` (real fails); the site's `colcon test` / `test-result` does not depend on the package's test dependency. These are emulator fixes (golden rule: faithful error first) – left for an emulator-fix task.
- **N4 / N8 code blocks naming packages not in the lesson workspace** (AUDIT_V2 decision 1): not in this task's list.
- All other AUDIT_V2 §F items (P2+, launch output, node names, physics, RViz): not course content.
- XT3, XT7, UR5 keep the "Chiku: …" comment: they do not pass the URDF through `-p`, so the crash does not apply; not re-captured.

## Tests (step 2)

`node tools/check-content.mjs`: `Checked 92 practice terminals, 15 RViz editor blocks and 65 Python exercises. All good.`
(before this work it reported PROBLEM for N10, N18, N19).

Site suites, all exit 0: `tools/security-check.mjs`, `tests/{iface,physics,robot-hw,tb3-catalog,tf-buffer,urdf2sdf}.test.mjs`,
`sweep.mjs` (345 s), `gz-real-node.mjs`, `nav2-node.mjs`, `games-basics.mjs`, `real-tb3.mjs`, `real-tb3-nav.mjs`,
`real-mobile-audit.mjs`, `real-arms-audit.mjs`.

`real-sweep.mjs`: all 56 launch entries ran (the full run was cut by my 40-min cap after crazyflie; scout run
separately: ok). 53 ok, 3 BAD. The script always exits 0, and all three were already in the parity-v2 reports.
None comes from this work: these commits change only `content/` and `parity/`, nothing in `public/`, `tools/` or `tests/`:
- fr3 `visualize_franka_robot.launch.py`: `died: ros2 (1)` – SIM_INVENTORY #3 (real behaviour UNVERIFIED).
- fr3 `gazebo_franka_arm_example_controller.launch.py`: `link 'fr3_link0' has two parents` – SIM_INVENTORY #1, AUDIT_V2 F#23.
- gen3 `kortex_sim_control.launch.py`: spawner `Failed to activate controller : robotiq_gripper_controller` – SIM_INVENTORY
  sim row: same error as real; only printed twice instead of once (SIM_INVENTORY #12).
These are open site bugs, not content, so they are not fixed here.

## End state

Domain 52: no processes left; Xvfb `:52` stopped. Nothing pushed or deployed.

---

# FIX_V2 part 2 (2026-10-20, branch fix-v2): housekeeping, N4/N8, site terminal differences

## Step 0 – checks and baseline gate

- `git status` clean on fix-v2 at ab869ee. `domain_pids 50 51 52` (parity/scripts/domain_procs.sh): all empty. Worktree
  `/home/prasad/ros2lab-robots` (robots-p2b, 848765c): clean, no process running in it.
- Baseline gate on ab869ee, two lanes in parallel (lane A every suite below except real-sweep, lane B real-sweep);
  site on localhost:8080 and 127.0.0.1:8000:

| Suite | Baseline |
|---|---|
| `tools/check-content.mjs` | exit 0, "All good" (92 terminals, 15 RViz blocks, 65 Python) |
| `tools/security-check.mjs` | exit 0 |
| `tests/{iface,physics,robot-hw,tb3-catalog,tf-buffer,urdf2sdf}.test.mjs` | exit 0 each |
| `tests/gz-real-node.mjs`, `nav2-node.mjs`, `games-basics.mjs` | exit 0 |
| `tests/real-tb3.mjs`, `real-tb3-nav.mjs`, `real-mobile-audit.mjs` (all parts) | exit 0, "all passed", 0 FAIL lines |
| `tests/real-arms-audit.mjs` | exit 0, "all passed" |
| `tests/sweep.mjs` | exit 0, 33 ok, 0 with errors |
| `parity/scripts/lessons/site_lesson_check.mjs` (XT5,RV1,D4,D13,F12,F15,N10,N18,N19,N23) | every task ticks, ALL DONE |
| `tests/real-sweep.mjs` (full, 7071 s) | exit 0; 56 entries: 53 ok, 3 BAD – the 3 known ones: fr3 `visualize_franka_robot.launch.py` (`died: ros2 (1)`, SIM_INVENTORY #3), fr3 `gazebo_franka_arm_example_controller.launch.py` (`link 'fr3_link0' has two parents`, SIM_INVENTORY #1), gen3 `kortex_sim_control.launch.py` (spawner `Failed to activate controller : robotiq_gripper_controller` twice, SIM_INVENTORY #12) |

real-mobile-audit took 5249 s in this run because real-sweep ran in parallel (no failure).


## Step 1 – housekeeping

| Item | Change | Evidence | Commit |
|---|---|---|---|
| a | AUDIT_V2 P1 row 3 no longer says the N23 cause is UNVERIFIED; owner decision 1 no longer says the content was "not touched" | this file, part 1 | 3cdc8a9 |
| b | `tests/real-sweep.mjs` exits 1 when an entry is BAD and not in its known list (fr3 sim#1 = SIM_INVENTORY #3, fr3 sim#2 = #1, gen3 gripper = #12); each BAD line names its finding; summary line `N entries: … ok, … BAD known, … BAD unknown` | `node tests/real-sweep.mjs fr3 gen3`: 6 ok, 3 BAD known, exit 0; the same fr3 run with the list emptied: 2 BAD unknown, exit 1 | 6fee181 |
| c | N4 code block: the warn example runs `chiku_control log_demo` (was `chiku_control_cpp`); N8 code block: `chiku_control_cpp safety_filter` (was `chiku_control`) – the packages in those lessons' workspaces | Real re-capture, domain 52 (Xvfb :52 for turtlesim), blocks `parity/scripts/lessons/extra_blocks/N4_code.json`, `N8_code.json`: `lessons/N4/termcode1.json` (debug → rcl DEBUG lines; `log_demo:=debug` → `raw battery value` DEBUG + `battery 98 %` INFO; warn → only `battery below 80 %` WARN and `battery low, going home!` ERROR); `lessons/N8/termcode1.json` (`/safety_filter` subscribes `/cmd_vel_in`, publishes `/turtle1/cmd_vel`; teleop publishes `/cmd_vel_in`). Before: `Package 'chiku_control_cpp' not found` / `Package 'chiku_control' not found`. | 38f6eb6 |

## Step 2 – site terminal differences

Every item has a test written from the real fixture first (it failed on the old code), in
`parity/unit/lesson-terminal.test.mjs` (vitest; runs each lesson's own solution commands in the site Shell and
compares with `parity/fixtures/lessons/<id>/term<N>.json`, timestamps masked, AUDIT_V2 #26). Browser check
afterwards with `parity/scripts/lessons/site_lesson_check.mjs`; output in `parity/browser_out/lessons/fixv2_part2/`.

| # | Difference | Real evidence | Fix | Site after (browser) | Commit |
|---|---|---|---|---|---|
| 41 | N10 `late_listener` printed nothing | `lessons/N10/term1.json` step 6: `I joined late but still got: "map of the warehouse is ready"` | `parseNodeCode` reads rclpy `QoSProfile` durability, the String a node publishes once in its constructor, and the first log line of each subscription callback; a TRANSIENT_LOCAL subscriber gets a running TRANSIENT_LOCAL publisher's message at start. `topic info --verbose /map_status` now shows TRANSIENT_LOCAL on both ends (AUDIT_V2 #18, N10 part) | `default_lessons.json` N10: the same line | 82248bf |
| 40 | bare `off: 0` accepted | `_investigations/setpen_off_forms.txt` (exit 1, `Failed to populate field: attribute name must be string, not 'bool'`); new `_investigations/yaml_nonstring_keys.txt` (installed `yaml.safe_load` + `set_message_fields`: off/Off/OFF/yes/on → bool, null/~ → NoneType, 1 → int, 1.5 → float, also for a Twist) | `ros-iface.js` marks such plain keys like `hero-turtle.js` does; `service call` (before waiting for the service, as ros2service call.py) and `topic pub` print the real error, then a one-line hint | `default_lessons.json` D4 bareOff: the real error + hint | a16d8e6 |
| N19 row (#21) | `node info /turtle_tf_broadcaster`: subscriber `/: turtlesim/msg/Pose`, no `/tf` | `lessons/N19/term1.json` step 6: `/turtle1/pose`, publisher `/tf` | C++ topic built from a parameter (`"/" + turtle_ + "/pose"` → `/{turtlename}/pose`, filled from the node's parameter); a TransformBroadcaster publishes `/tf` | `default_lessons.json` N19: equal to real | f00f97f |
| #14 rsp | one `got segment` line per link | `lessons/XT5/term1.json`, `RV1/term1.json` step 0: only `Robot initialized`; all real fixtures: 156 × `Robot initialized`, 0 × `got segment`; root-inertia kdl WARN first (`lessons/R4/term1_runner.log:215`) | `rspMessages`: the kdl root-inertia warning when the root link has `<inertial>`, then `Robot initialized` (ros2 run and launch) | unit test equal to real | ad58ea6 |
| #14 jsp | jsp: nothing; jsp_gui: `[joint_state_publisher_gui]: Centering` only; WARN waiting line; launch: waiting line only | `lessons/RV1/term1.json` step 2, `XT5/term1.json` step 6, `XT7/term1.json` last launch, UR5 launch log: Waiting… / (Centering) / Got description, configuring robot / (Centering), INFO, logger `[joint_state_publisher]` | real lines and logger in ros2 run and launch; without robot_state_publisher only the waiting line | unit tests equal to real (XT5, RV1, XT7) | 56af711 |
| 42 | `/parameter_events` subscriber on every node | all 16 node info outputs in the lesson fixtures: rclpy (N10, F3, F5, F19, D12 demo_nodes_py listener) none; rclcpp (N19, N8, N5, F20, turtlesim, teleop) yes | left out for a student's Python node, demo_nodes_py programs and a block's pre-running `listener` (demo_nodes_py, as `run_lesson_terms.py` starts it) | `default_lessons.json` N10: equal to real | f86a41b |
| XT5 t8 / RV1 t5 check | tasks ticked with an empty Description Topic | browser probe (Description Topic click skipped): XT5 8/8, RV1 9/9 ticked (`XT5_RV1_no_description_topic_old_check.json`) | content: check also needs `viz.subscribed /robot_description`; sol records the topic for check-content; hint names the step | with the topic set: all tick (`XT5_RV1.json`); without it: XT5 task 8 and RV1 task 5 do not tick (`XT5_RV1_no_description_topic.json`) | b6245b8 |
| RViz editor (found by the item above) | a single mouse click on an RViz property value opened its editor and closed it again (pointerdown and click both opened one; the second replaced the first, whose blur repainted the tree). The lesson's own step (click the Description Topic, pick `/robot_description`) could not be done; the old harness double-click never set the topic either (`Description Topic editor not found`, also in the fix-v2 local site check) | site behaviour, not a ROS output (RViz2 opens the editor on a click and keeps it) | `rviz.js`: open an editor only if the cell has none; `site_lesson_check.mjs` clicks once, as the lesson says | `parity/e2e/rviz-property-click.spec.ts` fails on the old rviz.js, passes now; old rviz.js + one click: `XT5_old_rviz_js.json` still "editor not found" | 65ea3d7, f72793c |

### Left, and why

- **#44 `waiting for service to become available...`**: not changed. Real prints it in 8 of 16 successful
  `ros2 service call`s in the lesson fixtures (D13 ×2, D4, D6 first, F19, F9 second, N21, N24b second: yes; D6 second,
  F10 ×2, F12, F20, F9 first, IN3, N24b first: no), even differently for the same command in one lesson. It depends on
  `cli.service_is_ready()` right after the client is created (`ros2service/verb/call.py`). No fixed site output matches;
  owner decision whether the site should print it (it would then match about half of the real runs).
- #41 rest: the periodic `50 poses received` lines of late_listener (every 0.8 s on real) are not modelled.
- #18 XT6 part (`/tf_static` echo), #21 D9/D2 node names: not in this task's list.
- UR5 task 4 (move a joint_state_publisher_gui slider) does not tick in `site_lesson_check.mjs` because the harness
  does not drive sliders; the same on the baseline code (`UR5_baseline_code.json`, served from ab869ee). Not a site change.
- jsp_gui node name (`/joint_state_publisher_gui` on the site): no real `node list` with jsp_gui in the fixtures, so not changed.

## Step 3 – full gate after the changes (fix-v2 at f72793c)

Same suites and lanes as step 0, plus the RViz Playwright specs (`fixed-frame`, `fixed-frame-render`, `rviz-tools`,
`view-frames`, `validation-labels`, `review-should-fix`, `rviz-property-click`) and `npx vitest run parity/unit`.

| Suite | Baseline | After |
|---|---|---|
| check-content, security, 6 unit tests, gz-real-node, nav2-node, games-basics | exit 0 | exit 0 |
| real-tb3, real-tb3-nav, real-mobile-audit, real-arms-audit | all passed | all passed |
| sweep | 33 ok | 33 ok |
| site_lesson_check (10 default lessons) | all tick (XT5/RV1 with an empty Description Topic) | all tick, Description Topic set (`fixv2_part2/default_lessons.json`) |
| real-sweep | 53 ok, 3 known BAD, exit 0 (could not fail) | 53 ok, 3 BAD known, 0 unknown, exit 0; same status per entry |
| parity/unit (vitest) | – | 13 files, 58 tests passed |
| RViz e2e specs | – | 42 passed |

Affected lessons in the browser (`fixv2_part2/affected_lessons_before_rviz_fix.json`, then `XT5_RV1.json`): D4, D12,
D13, F3, F5, F12, F19, F20, N4, N5, N8, N10, N19, XT5, XT7, RV1 all tasks tick; UR5 task 4 as on the baseline.

## End state (part 2)

Domains 50, 51, 52: no processes; Xvfb :52 stopped; scratch worktrees removed. Nothing pushed or deployed.
