# TurtleBot3 focus, Night 1 report (2026-10-23)

Branch `tb3-focus` (from master `213baa2`), not pushed, not merged into master. Nothing deployed; no sudo / apt;
`content/course-content.json` and Firestore untouched; lesson-task detection, test scoring and progress saving untouched.
Real ROS 2 Jazzy + Gazebo Harmonic on this PC is the reference. Real simulations ran one at a time (ROS_DOMAIN_ID 61 for
the Nav2 / world captures, 50 for physics), each stopped with `parity/scripts/stop_reference.sh` before the next.
Progress log and resume commands: `docs/tb3/PROGRESS.md`.

## Parts

| Part | State | Notes |
|---|---|---|
| 0 setup | **done** | fix-v2 not merged by git, content mostly in master (below). Versions recorded. Nothing missing from apt, so nothing built in `~/tb3_ws`. Data inventory written. |
| 1 under_test gating | **done** | references report, schema (A), UI (B), tests (C); red/green verified |
| 2 ground truth + triage | **done** | A, B (3 models, with and without initial pose), C, D, E; one deviation: world started headless (EGL), see 2.B |
| 3 dynamic TB3 motion | **done** (6 of 30 quantities APPROXIMATED) | captures had to be recorded through ros_gz_bridge (no gz-transport Python binding here) |
| 4 tests | **done** | lesson counts unchanged; one new parity failure found and fixed (9eb95b7) |
| 5 report | this file | |

## Part 0

- **fix-v2 vs master.** `git branch --merged master` does not list `fix-v2` (42 commits outside master's history;
  `git cherry master fix-v2`: 41 `+`). By content: 199 of the 205 files fix-v2 changed are byte-identical in master (the
  redesign squash `b4ae6bd` carried them). `git merge-tree master fix-v2` leaves 3 conflicts (`public/css/app.css`,
  `public/js/ros-graph.js`, `public/js/who.js`, deleted in master) where master has the newer version. Not merged.
- **This PC is not the machine that made the existing fixtures.** `parity/fixtures/tb3_jazzy_v3/README.md`,
  `versions.txt`, `version_diff_vs_old_fixtures.txt` (605 packages differ): here Nav2 1.3.10 (nav2_bringup, nav2_route,
  opennav_docking 1.3.13), gz-sim **8.10.0** (fixtures: 8.15.0), ros_gz 1.0.16/1.0.18 (fixtures 1.0.24), rclcpp 28.1.13,
  ros2cli 0.32.6. Upgrading needs `sudo apt upgrade` (instructor). New captures are true for this PC's versions; where they
  disagree with an old fixture the triage says so instead of picking a side.
- **Missing on this PC:** `ground-truth/` (legacy kit), all 76 bags of `bag_manifest.md` (1780 MiB), every gitignored
  `*.log` (e.g. `tb3_burger/nav_robotis/logs/nav2.log`), and `parity/browser_out/physics/site_cases.mjs` (the site-side
  physics runner of physics_parity.md). Re-captured / rewritten: the Nav2 graph (Part 2), the TB3 motion cases (Part 3), a
  tracked site runner `parity/compare/site_tb3_motion.mjs`. No bag was needed.

## Part 1: under_test gating

**COURSE_ROBOT_REFERENCES** (`parity/reports/COURSE_ROBOT_REFERENCES.md`, 305 references, scanner
`parity/scripts/tb3_v3/course_robot_refs.mjs`):

| id | how the course uses it | status now |
|---|---|---|
| tb3_burger | R4 (TURTLEBOT3_MODEL=burger, turtlebot3_gazebo), owner decision | active |
| tb3_waffle_pi | owner decision (no lesson names it) | active |
| tb3_waffle | RV2 tells students to choose **TurtleBot3 Waffle** on the Simulator page (`content/course-content.json:28383`) | active, **Legacy** label |
| ur5e | UR7 RViz block, owner decision | active |
| chiku | UR4, RV2, RV4 RViz blocks, owner decision | active |
| chiku_mesh | XT4 edits its file `/robots/chiku_description/urdf/chiku_mesh.urdf.xacro` | active |
| arm6 | UR7 RViz block | active |
| hexapod | XT3 RViz block | active |
| quadcopter | RV6 gallery block opens with it (student can pick any robot) | active, **owner to confirm** |
| the other 24 ids | no lesson use (home page strip links ur5e, fr3, go2, spot, g1, crazyflie, kr6, tb3_waffle) | under_test |

UNRESOLVED (not mapped to an id): **Panda** (9 lines: R4 installs and launches `moveit_resources_panda_moveit_config
demo.launch.py`; the site has no `panda` id, `fr3` is another robot), **TurtleBot3 without a model** (25 lines; where
the same lesson sets TURTLEBOT3_MODEL the SIM row carries the model), **UR5** (1 line: it is the lesson id `UR5`).
turtlesim and the course's own packages run in the lesson terminals and are not simulator robots.

Commits: `c749c14` schema (`status` / `status_reason` / `status_since` on 33 robots, 9 workspaces and every page entry
with a command; `public/robots/course-required.json`; `tools/apply-robot-status.mjs`, re-applied by
`tools/fetch-workspaces.mjs`), `bb82a8a` UI (notice `#under-test-note` in the "Not yet validated" lock style, Launch
disabled, no workspace or package loaded so nothing can start; an under-test page entry keeps its button disabled;
robot.html says the simulation is switched off; Waffle "Legacy" badge), `d8d1722` tests (`tests/robot-status.test.mjs`
372 checks: schema, allow-list, course references need active ids; `parity/e2e/under-test.spec.ts` 5 tests: fr3 and arm3
start nothing, Waffle Legacy, an under-test entry is disabled, robot.html notices). Red/green: the 5 UI tests failed on the
old code and pass with it. Test suites that exercise under-test robots on purpose set `localStorage
ros2lab.dev.underTest=open` (parity playwright config storageState, `tests/lib.mjs`, `tests/real-lib.mjs`, `sweep.mjs`,
`gzsweep.mjs`); `tests/ui-sim.mjs` now reads `"active"` instead of the old `"course"` value. Not changed: the home page
robot strip still links under-test robots (their page now shows the notice); the in-lesson RViz blocks and the RV6
gallery are not gated (they only draw descriptions).

## Part 2: Jazzy ground truth and graph triage

Captures: `parity/fixtures/tb3_jazzy_v3/` (each folder has `runner.txt`; full logs in `ground-truth/tb3/`, gitignored);
one-page summary `parity/fixtures/tb3_jazzy_v3/SUMMARY.md`.

- **A.** `nav2_collision_monitor`, `nav2_route`, `opennav_docking` (+ `_bt`, `_core`) are installed; there is no
  `nav2_docking` package. `nav2_msgs/action/NavigateToPose` result has `uint16 error_code` and `string error_msg`.
- **B.** `navigation2.launch.py use_sim_time:=True` with the map turtlebot3_navigation2 ships (the site's nav#1 command;
  initial pose = the spawn pose (-2.0, -0.5, 0), the shipped map is centred on the world origin). All three models:
  `route_server`, `docking_server`, `smoother_server`, `collision_monitor` present, **`collision_detector` absent**;
  14 lifecycle nodes; before the initial pose 5 active (amcl, controller_server, local costmap, map_server, smoother_server)
  and the global costmap activating; after it all 14 active. bt_navigator `error_code_names` =
  `['follow_path_error_code', 'compute_path_error_code']`, `error_code_name_prefixes` = `['assisted_teleop', 'backup',
  'compute_path', 'dock_robot', 'drive_on_heading', 'follow_path', 'nav_thru_poses', 'nav_to_pose', 'spin', 'route',
  'undock_robot', 'wait']`. Without an initial pose the navigation bringup aborts ("Failed to bring up all requested
  nodes. Aborting bringup.") **60.3 / 60.2 / 60.1 s of sim time** after "Checking transform" (burger / waffle_pi / waffle;
  62.0 / 64.0 / 65.5 s wall at RTF 0.97 / 0.95 / 0.93), i.e. the timeout counts sim time. Deviation: the world ran
  headless with EGL (`parity/scripts/launch/tb3_world_headless.launch.py`: the installed launch files without the GUI
  client; `parity/reports/render_mode.md` showed the same graph as `turtlebot3_world.launch.py`), Nav2 ran unchanged
  under xvfb.
- **C.** During a goal (all SUCCEEDED, error_code 0): `/cmd_vel_nav` TwistStamped, pub controller_server +
  behavior_server, sub velocity_smoother, ~10 Hz; `/cmd_vel_smoothed` pub velocity_smoother, sub collision_monitor,
  ~20 Hz; `/cmd_vel` pub collision_monitor + docking_server, sub ros_gz_bridge, ~20 Hz. `turtlebot3_teleop
  teleop_keyboard` publishes TwistStamped and the robot moves (0.33-0.34 m for w x5, Gazebo pose). `ros2 run
  turtlebot3_gazebo turtlebot3_drive` publishes **geometry_msgs/Twist**: `/cmd_vel` then has two types and the robot does
  **not** move (Gazebo pose unchanged; burger_cam drifted 0.016 m, the others 0.000). burger_cam: its model.sdf has a
  camera, so the bridge publishes camera_info (320x240) and image_bridge image_raw (~29 Hz).
- **D.** `/scan` 360 rays, 0..6.28 rad, increment 0.017493, range 0.12..3.5 m, frame base_scan (burger 4.9 Hz, waffle /
  waffle_pi 9.5-9.7 Hz wall at RTF ~0.95); /imu ~190-197 Hz, /odom ~47-49 Hz, /joint_states ~940-985 Hz (wall);
  waffle_pi camera 640x480 ~29 Hz, waffle camera 1920x1080 ~28 Hz; TF: odom->base_footprint 50.2 Hz, wheels 20.2 Hz,
  static edges (rates in SUMMARY.md).
- **E. TB3_GRAPH_TRIAGE** (`parity/reports/TB3_GRAPH_TRIAGE.md`). The Night-1 baseline re-ran the AUDIT_V2 checks on
  today's site with the same result (56 / 49 / 42 FAIL). Split into 441 items and checked against REAL-NEW:

  | | site-missing | site-extra | wrong type | stale fixture / version |
  |---|---|---|---|---|
  | burger | 120 | 9 | 0 | 16 |
  | waffle | 108 | 8 | 0 | 41 |
  | waffle_pi | 104 | 8 | 0 | 27 |

  By family: costmap layer topics and their QoS (134 site-missing), bt_navigator `*_rclcpp_node` endpoints (41), RViz
  Nav2 panel / rviz2 endpoints (38), docking_server (25), route_server (23), `/diagnostics` (9), collision_monitor (6),
  the /cmd_vel chain (3: docking_server publisher on /cmd_vel, behavior_server on /cmd_vel_teleop). Site-extra: the
  topics `/detected_dock_pose`, `/{global,local}_costmap/voxel_layer/voxel_grid`, and a few endpoints (behavior_server on
  the global costmap topics, a `nav2_container` publisher on /parameter_events, rviz2 on /marker). The 84 "stale fixture /
  version" items are endpoints where the old fixture (Nav2 1.3.13) and this PC (1.3.10) disagree, e.g.
  `published_footprint` TRANSIENT_LOCAL in the fixture and on the site but VOLATILE here, `/cmd_vel_teleop` and
  `/preempt_teleop` subscriptions BEST_EFFORT there and RELIABLE here; for waffle most are endpoints the old snapshot did
  not record. They need an owner decision on which Nav2 version is the reference (or `sudo apt upgrade` here).

## Part 3: dynamic TurtleBot3 motion

- **Captures** (`parity/fixtures/tb3_jazzy_v3/physics/`, 3 runs each, bit-identical): python3-gz-transport13 is not
  installed (the existing recorder needs it; installing needs sudo), so `parity/scripts/tb3_v3/ros_case.py` records the
  PosePublisher ground truth, /odom and /clock through ros_gz_bridge and sends the Twist through it. Re-run tb3_lin /
  tb3_ang / tb3_push (this PC gives the old 8.15 shape: burger 50 % / 90 % of 0.2 m/s at 0.252 / 0.275 s, spin
  0.599 / 1.250 s, odom leads by 0.634 rad after 10 s), new tb3_stop, tb3_fast (0.5 m/s: **Gazebo does not clamp**; the
  0.22 / 2.84 limits are in teleop and Nav2, not in the model), tb3_spin_fast (4 rad/s), tb3_wall (base stops at x
  0.930, the wheels keep turning and /odom keeps counting at 0.2 m/s), Waffle Pi lin / ang / stop (much less slip).
  The DiffDrive's 1.0 m/s² limit shows on /odom (90 % of 0.2 m/s after 0.200 s; 0.5 m/s after 0.46 s).
- **Model** (`public/js/tb3-motion.js`, commit `d342d64`): for the turtlebot3_gazebo models only, the body follows the
  SpeedLimiter output (= what odom integrates) through a fitted delay / lag / acceleration limit; constants and the capture
  each comes from are in the code comments. Rigid contact stays with the existing Rapier path; against a wall the wheels now
  keep turning. Other robots are untouched.
- **Before / after** (`parity/reports/TB3_MOTION_NIGHT1.md`, 30 quantities): before 13 MATCH / 17 DIFFERS; after
  **24 MATCH / 6 APPROXIMATED**: tb3_fast 90 % time +0.149 s and odom-gt +0.035 m, tb3_spin_fast final rate -0.069 rad/s
  and 90 % time +0.199 s (both outside the course's speed range), the 0.053 m drift of the base during a spin (not
  modelled), robot distance while pushing the box +0.033 m (+2.2 %). The push rows use the box without its PosePublisher
  on the site side: with it the site turns the box into a kinematic robot (physics_parity cause 1, unchanged) and nothing
  moves. The other 21 world cases of the physics baseline produce byte-identical site output before and after
  (`parity/browser_out/tb3_night1/phys24/`), so their physics_parity.md verdicts stand; `tb3_lin_noacc` /
  `tb3_ang_noacc` use a physics-kit copy of the model and stay kinematic by design.
- **nav_robotis burger goal suite** (`parity/e2e/fixtures/nav_robotis.spec.ts`): before and after the change all 7 goal-status rows PASS (goal1-5, obstacle_goal,
  cylinder_centre: SUCCEEDED, error_code 0); the spec's overall FAIL count is unchanged (burger 56, waffle 49, waffle_pi 42:
  the graph items of the triage). Goal durations stay PENDING-THRESHOLD (site wall time; no limit in thresholds.yaml).

## Part 4: tests

BASE=http://localhost:8000 (`bash parity/scripts/tb3_v3/run_suites.sh <label>`; summaries `docs/tb3/tests/before.txt`,
`after.txt`; raw logs `parity/browser_out/tb3_night1/<label>/`).

| Suite | Before (git 213baa2) | After (git af3cbb2, + fix 9eb95b7) |
|---|---|---|
| security check | pass | pass |
| lesson check (`site_lesson_check.mjs`, default set) | 66 of 66 | 66 of 66 |
| 45 turtlesim lessons | 282 of 282 | 282 of 282 |
| ui-chrome, ui-home, ui-sim, ui-portal, ui-student, ui-member, ui-review, ui-widths | all pass | all pass |
| parity suite (`npx playwright test -c parity/playwright.config.ts`) | 121 passed / 6 failed (127) | 125 passed / 7 failed (132) in the after-run; with the fix: the 7th passes (below) |

Parity, test by test (`docs/tb3/tests/{before,after}_parity_{pass,fail}.txt`):
- **New passes (5):** the 5 tests of `parity/e2e/under-test.spec.ts`.
- **New failure (1), fixed:** `lock-hint-catalog.spec.ts` crazyflie. Cause: the crazyflie real-radio page entry is
  `under_test` and stayed disabled although the spec opens the page with the test switch on; `btn.click()` waited until
  the 4 min timeout. Commit `9eb95b7` lets the switch open entries too; re-run: `lock-hint-catalog.spec.ts` +
  `under-test.spec.ts` 9 passed. The full parity suite was not re-run after this one-line fix.
- **Still failing, same as before (6):** nav_robotis x3 (graph, see triage), nav2_bringup graph, matrix,
  matrix_dwb_burger. Every test that passed before passes after.

Also run after the change: `tests/real-tb3.mjs` all passed, `ONLY=burger,waffle,fake,cf tests/real-mobile-audit.mjs`
all passed, `tests/physics.test.mjs` all passed, `tests/robot-status.test.mjs` 372 ok, `tests/tb3-motion.test.mjs` 24 ok,
`tools/security-check.mjs` pass.

## Commits (git log --oneline master..tb3-focus)

```
9eb95b7 Under-test page entries: the test switch (ros2lab.dev.underTest) opens them too, like the robot-level gate
af3cbb2 tb3 night 1 part 2.C/2.D: world captures (teleop, turtlebot3_drive, sensors, TF, burger_cam) and SUMMARY.md
bf16837 tb3 night 1 part 3.3: TB3_MOTION_NIGHT1 (30 quantities, before 13 MATCH / 17 DIFFERS, after 24 MATCH / 6 APPROXIMATED)
d342d64 TurtleBot3 base motion: the body lags the wheels (wheel slip) as in Gazebo, odom keeps the wheel kinematics
6b75d80 tb3 motion comparison: measure the site's 50 ms samples with the speed over the last frame; before/after report generator
93c574d tb3 night 1 part 3.1: real TurtleBot3 motion captures on this PC (gz-sim 8.10), recorded through ros_gz_bridge
d8d1722 Tests: robot status schema, COURSE_REQUIRED allow-list, course references need active robots, under-test launch never starts a sim
bb82a8a Under-test robots: ROS2Lab notice, Launch disabled, no workspace loaded; "Legacy" label for the TurtleBot3 Waffle
c749c14 Robot status schema: "active" | "under_test" with status_reason and status_since on every robot, workspace and page entry; COURSE_REQUIRED_ROBOTS list
72afae8 tb3 night 1 part 4: baseline before any site change (lessons 66/66, turtlesim lessons 282/282, UI suites and security pass, parity 121 passed / 6 known fails)
c2f4f77 tb3 night 1 part 2.E: TB3_GRAPH_TRIAGE (AUDIT_V2 Nav2 graph FAILs 56/49/42 split into 441 items: 332 site-missing, 25 site-extra, 84 stale fixture / version, 0 wrong type)
a12e680 tb3 night 1 part 2: real Jazzy captures of navigation2.launch.py (burger, waffle_pi, waffle) on this PC
84487d6 tb3 night 1 part 1.1: COURSE_ROBOT_REFERENCES (lesson, file, line for every robot / workspace id; UNRESOLVED names)
819de3b tb3 night 1 part 0: versions on this PC, version diff vs the old fixtures, data inventory, suite runner
```
(plus the commit of this report)

## Night 2 should start with

1. **Decide the Nav2 reference version** (1.3.10 here vs 1.3.13 in the old fixtures): `sudo apt update && sudo apt
   upgrade` on this PC (instructor), then re-run `capture_nav.sh` for the three models (15 min) so the 84 "stale fixture
   / version" items resolve.
2. **Fix the TB3 Nav2 graph per the triage**, largest first: costmap layer topics (obstacle / voxel / static layer,
   `_raw`, `_updates`, clearing_endpoints) and their QoS; bt_navigator `*_rclcpp_node` endpoints; RViz Nav2 panel topics;
   docking_server and route_server topics; /diagnostics; remove the site-extra topics.
3. **The exact /cmd_vel chain**: controller_server + behavior_server -> /cmd_vel_nav (10 Hz) -> velocity_smoother ->
   /cmd_vel_smoothed (20 Hz) -> collision_monitor -> /cmd_vel (20 Hz, + docking_server publisher) -> ros_gz_bridge
   (TwistStamped); `turtlebot3_drive` publishes Twist and does not move the robot (site should show the two-type topic).
4. **Nav2 error codes**: bt_navigator `error_code_names` / `error_code_name_prefixes` as captured; NavigateToPose
   `error_msg`.
5. **RViz** for `tb3_navigation2.rviz`, `tb3_cartographer.rviz`, `model.rviz`.
6. Owner decisions pending: quadcopter (RV6 gallery default) active or under_test; whether the home page strip should
   link only active robots.
