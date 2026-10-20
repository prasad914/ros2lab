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

