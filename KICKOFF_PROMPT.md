# Prompts for Claude Code – paste one at a time into `claude`, run in the website repo

Order matters. Review each prompt's report (and diff) before pasting the next. Every prompt relies on:
- `CLAUDE.md` (rules: real Jazzy is truth, no invented numbers, faithful error first)
- `docs/reference/nav2_jazzy_spec.md` (sections S1–S14 = everything the site must match)
- `docs/reference/concepts.md` (short concept texts) · `tests/mistakes.yaml` · `docs/parity/playground.md` · `docs/parity/thresholds.yaml`

Optional slash commands you mentioned (/deep-research, /paper-search, /engineering:code-review) are used only if they exist in your Claude Code setup (type `/` to see the list). The prompts work without them.

---

## P0 – Environment, installed facts, site map (no app edits)

```
Read CLAUDE.md and docs/reference/nav2_jazzy_spec.md.
1. Run `bash scripts/check_env.sh` and show me the result. If required packages are missing, stop and give me the exact install commands.
2. Run `bash scripts/capture_installed.sh` then `bash scripts/verify_facts.sh`. Read tests/fixtures/_installed/facts.md and, for every [VERIFY] item in the spec, write the answer from the installed files into docs/reference/verify_results.md (item, spec claim, installed evidence with file path, CONFIRMED / DIFFERENT / NOT FOUND). Where installed evidence differs, update the spec line and mark it "(from installed file)".
3. Map this repository without editing app code: every robot the site offers; each robot's course levels and pages; every RViz option, tool, panel and display implemented; how the Gazebo-like 3D view and the RViz 3D/2D views get their data (shared state or separate simulations?); where topics, TF, QoS, params and the Fixed Frame dropdown live; whether window.__ros2lab exists.
4. For each robot on the site, check whether its real Jazzy packages are installed (`ros2 pkg list`) and which reference launch applies (spec S13). Robots without a working real reference are listed as UNVERIFIED.
Write docs/parity/00-site-map.md with file:line references, a gap list against spec S1–S12, and the test hooks that are missing.
```

## P1 – Test hooks

```
Add or complete a read-only `window.__ros2lab` so tests can read: topic list with types and QoS; TF frames, edges and publishing authority; Fixed Frame options and selected value; params per emulated node; lifecycle states; Global Status and per-display status text; user-visible logs/errors; /plan, /local_plan, robot pose history, /amcl_pose history and particle count; global/local costmap grids; camera_info, image size/encoding and PointCloud2 fields when present; the current course level and lock state. No behaviour changes. Add a vitest test for the hook. Show me the diff before committing.
```

## P2 – Capture real ROS 2 ground truth (one real run at a time)

```
Use the ros-reference subagent, one run at a time, ROS_DOMAIN_ID 41, GZ_PARTITION ref41:
1. sensors for tb3_burger, tb3_waffle, tb3_waffle_pi (topic lists, QoS, TF, camera_info, image and scan samples).
2. tb3_burger slam: record a bag while driving a timed coverage route with TwistStamped /cmd_vel for 3 minutes; save the map with map_saver_cli to tests/fixtures/maps/turtlebot3_world. Also run the cartographer scenario once for comparison.
3. Create tests/fixtures/goals.yaml: one start pose and 5 goals in free cells spread over turtlebot3_world, plus 1 goal inside an obstacle.
4. tb3_burger nav_robotis with that map: record a bag while publishing the initial pose (spec S4 covariance) and sending the 5 goals; repeat 10 times (labels run1..run10) for AMCL/MPPI statistics.
5. nav2_bringup: for each installed planner (NavFn, Smac2D, ThetaStar, SmacHybrid, SmacLattice) and controller (MPPI, DWB, RPP, RotationShim+RPP, Graceful), switch via params and send goal 1; record each combination as its own bag label. Mark combinations that fail to configure as UNVERIFIED with the log.
6. If turtlebot4 packages are installed: tb4_nav2_bringup and tb4_slam_nav sensors + one goal.
Summarise what was captured and every UNVERIFIED item with its reason.
```

## P3 – Core architecture + Fixed Frame (spec S1–S3)

```
Implement spec S1–S3 in the existing code structure (adapt paths; no parallel duplicates):
a) TF registry (static + dynamic buffers, authority tracking, getAllFrameNames/canTransform/lookupTransform, framesChanged event); /tf_static replayed to late subscribers; TF tree from the robot's URDF as captured in tests/fixtures/<robot>/sensors/samples/robot_description.yaml.
b) ONE shared scene: the Gazebo-like view and the RViz views are cameras on it; RViz views Orbit, TopDownOrtho, XYOrbit, FPS, ThirdPersonFollower with Target Frame. Remove any second simulation used only by the 2D view.
c) Typed pub/sub bus with exact ROS names, types and QoS + DDS compatibility rules.
d) Robot capability manifests robots/<id>.json generated from the captured topic lists, and robots/<id>/nav2_params.json generated from the installed param files (header comment with source path and package version).
e) Fixed Frame: first write tests/e2e/fixed-frame.spec.ts that FAILS today (per robot: options include odom, base_footprint, base_link, base_scan, imu_link, camera frames where they exist, and map only after SLAM/AMCL; select works; free text works; unknown frame → Global Status error text from fixture; selection persists after reload; late-joining RViz still sees static frames; control is enabled and not covered by an overlay). Then diagnose with the 8 causes in spec S3, write docs/bugs/fixed-frame-rca.md, and fix with an editable combobox bound to rvizConfig.globalOptions.fixedFrame, all displays transforming via a FrameManager.
Acceptance: fixed-frame tests pass for every robot; Fixed Frame = odom and = base_link behave as spec S3 describes; vitest for TF registry; both centre views show the same pose.
```

## P4 – RViz tools: 2D Pose Estimate, 2D Goal Pose and per-algorithm wiring (spec S4)

```
Implement spec S4. Write failing tests first:
- 2D Pose Estimate publishes /initialpose PoseWithCovarianceStamped in the fixed frame with the RViz covariance; AMCL reinitialises; /amcl_pose, /particle_cloud and map→odom update; no effect while SLAM is mapping; relocalises in SLAM Toolbox localization mode.
- 2D Goal Pose publishes /goal_pose PoseStamped; goal transformed to map; NavigateToPose runs; works with Fixed Frame = odom.
- Nav2 Goal tool uses the action and shows feedback; Publish Point → /clicked_point.
- For every planner × controller combination captured in P2, the selected planner runs on the global costmap and the selected controller on the local costmap; /plan differs between NavFn, Smac2D and ThetaStar for the same goal; goal in an obstacle fails like the fixture and triggers recoveries.
Acceptance: tests pass for every mobile robot; record any planner/controller you could not match as a FAIL in docs/parity/FAILS.md.
```

## P5 – Sensors: Image and PointCloud2 per robot (spec S9)

```
Implement spec S9, using the captured fixtures and tests/fixtures/_installed model.sdf files as truth (not the spec table if they differ).
- Burger: no camera topics anywhere (topic list, Add-by-topic, bridge view); Image and PointCloud2 displays behave as in tests/mistakes.yaml (image_on_burger, pointcloud_on_burger, pointcloud_on_scan); a teaching note says Burger has no camera.
- Waffle / Waffle Pi: RGB camera rendered from an offscreen Three.js camera at the optical frame, size/encoding/rate and camera_info K matching the fixture; Image display (Transport Hint raw/compressed, Reliability), Camera display (needs CameraInfo + TF), QoS behaviour matching the captured publisher QoS.
- TB4 (if captured): OAK-D topics as captured, PointCloud2 from depth raycast/texture with correct fields, frame_id, NaN for no return.
- Optional non-standard variant tb3_waffle_depth with a visible "Non-standard ROS2Lab variant" badge.
- DepthCloud display only if verify_results.md says it exists in installed rviz_default_plugins.
Tests: Playwright per robot (burger has no Image/PointCloud2 by topic; waffle image non-blank within 3 s; K matrix and PointCloud2 byte layout unit tests).
```

## P6 – Full autonomous-navigation stack emulation (spec S5–S8, S10, S11)

```
Implement every tool in spec S11 that has an installed real counterpart (from P0), with lessons wired to it:
robot_state_publisher/URDF, joint_state_publisher (URDF lesson), virtual ros_gz bridge table (a topic not in the bridge YAML must not exist), teleop with TwistStamped, robot_localization EKF (optional level, disables odometry TF while active), SLAM Toolbox (async/sync/localization/lifelong, save_map, serialize/deserialize) and Cartographer, map_server + map_saver (downloadable .yaml/.pgm), AMCL in a Web Worker (spec S7), global and local costmaps with static/obstacle/voxel/inflation layers and keepout/speed filters (spec S6), planner/controller/smoother/behavior servers (spec S5 table), bt_navigator running the default Nav2 BT XML with recoveries, waypoint follower (+ wait/photo/input at waypoint), velocity_smoother → collision_monitor chain, docking (only if installed), route server (feature flag OFF unless installed), lifecycle manager, Simple Commander shim (in-browser Python exposing BasicNavigator), view_frames, rqt_graph/rqt_tf_tree/rqt_image_view panels, rosbag2 MCAP record/replay.
RViz (spec S10): every display with the listed properties, Add by display type / by topic, Navigation 2 panel (Startup/Pause/Reset, waypoint and through-poses modes, feedback, load/save/loop waypoints), SlamToolboxPlugin panel; default display set from the installed nav2_default_view.rviz and TB3 .rviz files; no Kilted-only panels in Jazzy mode.
Parameters must come from robots/<id>/nav2_params.json (installed values).
Acceptance: emulated `ros2 topic list -t`, node list and lifecycle states per scenario equal the fixtures (PENDING where no fixture); Playwright e2e teleop → SLAM → save map → AMCL → goal → waypoints per robot. Write tests/reports/stack_status.md listing VERIFIED / PENDING per tool.
```

## P7 – Robot pages: concept hierarchy and UI (spec S12)

```
Restructure every robot page into the single shared component described in spec S12: 10-level left stepper; per level one short concept text from docs/reference/concepts.md (edit for accuracy, keep it short – no long paragraphs), a "Try it" control, a "What real ROS 2 shows" panel (topics, TF, the real commands a student would type), and a "Check yourself" task; levels locked until prerequisites exist with the reason shown; top bar robot/world/mode; centre split 3D | RViz (Orbit ↔ TopDownOrtho); right Displays + Tool Properties; bottom toolbar + topic/TF inspector. Neat, consistent, interactive, keyboard accessible, usable from 375 px to 1280 px. Show only what each robot really has.
Then run the course-ui-reviewer subagent for each robot (up to 3 in parallel) and fix its FAIL items.
```

## P8 – RViz option-by-option parity audit (spec S10)

```
Create docs/parity/rviz_parity.md with one row per RViz element and property in spec S10 (element, property, real default from tests/fixtures/_installed rviz files or captured logs, ROS2Lab value, PASS/FAIL/PENDING, evidence). Write tests/e2e/rviz/<element>.spec.ts for each row, checking the element individually: visible, enabled, clickable, correct effect, correct published message/topic/frame, correct status text. Real defaults and status strings come only from installed files or fixtures; otherwise PENDING. Add an `npm run parity:report` script that regenerates the table from test results.
```

## P9 – Parity runs for every robot and scenario (parallel)

```
For each robot/scenario with fixtures, run the web-tester subagent, then the parity-judge subagent (at most 3 web-testers at once). Merge every FAIL into docs/parity/FAILS.md grouped by: TF/Fixed Frame, views, sensors, tools, SLAM, AMCL, costmaps, planners, controllers, BT/recoveries, panels, params, error text, UI. Do not fix anything yet.
```

## P10 – Student personas with mistake injection

```
Run four student-persona subagents (beginner, careless, intermediate, advanced) for tb3_burger and tb3_waffle (and tb4 if captured), covering levels 1–10 and every mistake in tests/mistakes.yaml that fits each persona. Real-ROS reproductions run one at a time: beginner domain 42/ref42, careless 43/ref43, intermediate 44/ref44, advanced 45/ref45. Browser runs may overlap.
Merge into docs/parity/MISTAKES.md: per mistake MATCH / MISMATCH / NO-FIXTURE, and whether faithful error came first and a hint second. Add course-text problems the personas found to docs/parity/COURSE_ISSUES.md.
```

## P11 – Fix loop

```
Order the items in docs/parity/FAILS.md, MISTAKES.md (MISMATCH only), COURSE_ISSUES.md and the ui_<robot>.md reports: TF/Fixed Frame and views first, then tools, sensors, error text, SLAM/AMCL/costmaps, planners/controllers, panels, then UI/course text. For each, spawn an emulator-fixer subagent (one item each, at most 3 at a time). After each batch, re-run web-tester + parity-judge (or course-ui-reviewer) for the affected robot/scenario; merge a worktree only if its item now passes and no other test regressed.
Stop after 10 fixes and summarise what changed and what still fails. I will tell you to continue.
```

## P12 – Playground games (only after the stack passes)

```
Create src/playground/readiness.ts (adapt path) with per-robot checks: TF tree complete, Fixed Frame selectable, required sensor topics per manifest, SLAM works, AMCL works, Nav2 lifecycle active, each planner/controller wired, camera works (for camera games). Use the latest docs/parity results; a check with PENDING or FAIL keeps the game locked and the lock shows which check is missing.
Implement the games in docs/parity/playground.md for robots whose required checks pass: each with config (world, robot whitelist, required levels), win condition, scoring formula, local leaderboard, deterministic seed. Camera games unavailable for tb3_burger. The Debugging Escape Room draws its faults from tests/mistakes.yaml and must show the same faithful errors as the fixtures.
Tests: Playwright plays each game with a scripted bot to its win condition; unit tests for scoring.
```

## P13 – Code review, accuracy summary, papers

```
1. Review all changes: run /engineering:code-review if it exists; otherwise review the full diff yourself for correctness against fixtures and spec, frame handling, QoS rules, numerical stability, performance (target 60 fps, workers for AMCL/planning, throttled camera rendering), accessibility and test coverage. Fix the critical findings via emulator-fixer.
2. Write docs/parity/SUMMARY.md: per robot, every metric (spec S14) with value, threshold, PASS/FAIL/PENDING and the fixture file it came from; feature coverage %; date and installed package versions from run_info.txt and dpkg_versions.txt; list of known differences from real ROS 2; robots that remain UNVERIFIED. Every number must trace to a file; nothing estimated.
3. Generate the per-robot badge text for the site: "Validated vs ROS 2 Jazzy on <date>: X/Y checks pass" or "Not yet validated".
4. If /paper-search (or another paper search) is available, re-check every entry in docs/reference/papers.md (DOI resolves, authors/venue correct) and search for the two "not yet found" topics; write the results into docs/reference/papers.md with the date. Do not add a paper you could not verify.
```

## Re-running later

After the site changes or packages update: P0 (facts), P2 for affected robots, P9, P10, P13. The SUMMARY then shows the new state with dates.
