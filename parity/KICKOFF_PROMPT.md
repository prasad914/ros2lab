# Prompts for Claude Code – ROS2Lab parity kit v2

Run in the website repo (`~/ros2lab-course`), one prompt at a time. Before each prompt type `/clear`; then type
`Read parity/KICKOFF_PROMPT.md and run prompt Pn exactly as written.` Review the report and the diff, commit, then go on.

Every prompt relies on `parity/CLAUDE.md` (rules), `parity/reference/nav2_jazzy_spec.md` (S1–S14), `parity/reference/concepts.md`, `parity/mistakes.yaml`, `parity/playground.md` and `parity/thresholds.yaml`.
Optional slash commands (/deep-research, /paper-search, /engineering:code-review) are used only if they exist in this Claude Code setup.

Order: P0 → P1 → P2 (TurtleBot3 truth) → P2b (install other robots) → P2c (truth for other verified mobile robots) → P3 … P13.
Arms (UR5e, Franka FR3, xArm Lite 6, Interbotix WX250s, Dobot CR5) stop after P2b; manipulation prompts (M-series) come later.

---

## P0 – Environment, installed facts, site map (no app edits)

```
Read parity/CLAUDE.md and parity/reference/nav2_jazzy_spec.md.
1. Run `bash parity/scripts/check_env.sh` and show me the result. If required packages are missing, stop and tell me to run
   `bash parity/scripts/install_ros_extras.sh` myself (you must not run it).
2. Run `bash parity/scripts/capture_installed.sh` then `bash parity/scripts/verify_facts.sh`. Read parity/fixtures/_installed/facts.md and,
   for every [VERIFY] item in the spec, write parity/reference/verify_results.md (item, spec claim, installed evidence with file path,
   CONFIRMED / DIFFERENT / NOT FOUND). Where installed evidence differs, update the spec line and mark it "(from installed file)".
3. Map this repository without editing app code: every robot the site offers; each robot's course levels and pages; every RViz option,
   tool, panel and display implemented; how the Gazebo-like 3D view and the RViz 3D/2D views get their data (shared state or separate
   simulations?); where topics, TF, QoS, params and the Fixed Frame dropdown live; whether window.__ros2lab exists. Note the site's
   existing test setup (Playwright config, tests/ and test-results/ folders) and the existing ground-truth/ folder, and say whether any of
   it can be reused – do not modify them.
4. Create parity/robots/STATUS.md with one row per robot on the site, columns: Robot · Category (mobile/arm) · Source · Built · Verified ·
   Status · Launch command · Evidence. Fill only what is true now: TurtleBot3 models from the installed packages; every other robot
   NOT BUILT unless its Jazzy apt packages are installed (then Built = yes, Verified = no).
Write parity/reports/00-site-map.md with file:line references, a gap list against spec S1–S12, and the test hooks that are missing.
```

## P1 – Test hooks

```
Add or complete a read-only `window.__ros2lab` so tests can read: topic list with types and QoS; TF frames, edges and publishing
authority; Fixed Frame options and selected value; params per emulated node; lifecycle states; Global Status and per-display status text;
user-visible logs/errors; /plan, /local_plan, robot pose history, /amcl_pose history and particle count; global/local costmap grids;
camera_info, image size/encoding and PointCloud2 fields when present; the current course level and lock state. No behaviour changes.
Create parity/playwright.config.ts (testDir parity/e2e, baseURL http://127.0.0.1:8000, webServer `npm run dev` with reuseExistingServer)
so parity tests never mix with the site's own tests. Add a test for the hook. Show me the diff before committing.
```

## P2 – TurtleBot3 ground truth from real ROS 2 (one real run at a time)

```
Use the ros-reference subagent, one run at a time, ROS_DOMAIN_ID 41, GZ_PARTITION ref41. Complete EVERY step; report each step's result.
1. sensors for tb3_burger, tb3_waffle, tb3_waffle_pi: topic lists, QoS, TF, camera_info, image and scan samples.
   TF check: in the sensors scenario no SLAM or AMCL runs, so a map frame must NOT exist. If one appears, find which node publishes it and
   re-capture. For each model list the exact frames and edges from the saved .gv (base_footprint, base_link, base_scan, imu_link, wheel and
   camera frames).
2. tb3_burger slam: record a bag while driving a timed coverage route with TwistStamped /cmd_vel for 3 minutes; save the map with
   map_saver_cli to parity/fixtures/maps/turtlebot3_world. Also run the cartographer scenario once for comparison.
3. Create parity/fixtures/goals.yaml and check it against reality, writing parity/fixtures/goals_check.md:
   - start pose = the spawn pose actually used by turtlebot3_world.launch.py (read x_pose/y_pose defaults from the installed launch file,
     confirm with the first /odom message and the map origin);
   - 5 goals in free cells spread over the world: convert each to a map pixel using the map yaml origin and resolution; each must be free
     and at least 0.4 m from any occupied pixel;
   - 1 goal on an occupied pixel (for planner-failure tests).
4. tb3_burger nav_robotis with the saved map: record a bag while publishing the initial pose (spec S4 covariance) and sending the 5 goals;
   repeat 10 times (labels run1..run10) for AMCL/MPPI statistics.
5. nav2_bringup: for each installed planner (NavFn, Smac2D, ThetaStar, SmacHybrid, SmacLattice) and controller (MPPI, DWB, RPP,
   RotationShim+RPP, Graceful), switch via params and send goal 1; one bag label per pair. Pairs that fail to configure: UNVERIFIED + log.
6. List every bag recorded (size, duration) and every UNVERIFIED item with its reason.
```

## P2b – Install, and where needed port, every other robot (simulation only, strict)

```
Robots: every non-TurtleBot3 robot in parity/robots/STATUS.md (at least TurtleBot4, AgileX Scout, UR5e, Franka FR3, xArm Lite 6,
Interbotix WX250s, Dobot CR5). Work in two phases.
PHASE A – sources and dependencies for ALL robots, then ONE stop:
  - Clone every robot's sources (rules 2–4, 9), including git submodules and any extra repos the maker's README lists.
  - Collect every missing system dependency for all of them in one pass: `rosdep check --from-paths ~/robots_ws/src --ignore-src`
    and `rosdep install --simulate --from-paths ~/robots_ws/src --ignore-src -y` (prints the apt commands without running them),
    plus anything the makers' READMEs list that rosdep misses (e.g. libasio-dev for AgileX ugv_sdk). Check names with `apt-cache policy`.
  - Write them all into ONE parity/scripts/robots_sudo.sh (apt install line + `rosdep install --from-paths ~/robots_ws/src --ignore-src -y`),
    show me the file and the per-robot reason for each package, then STOP and ask me to run it.
PHASE B – after I say "Done", build and verify ONE robot at a time in the order above. Stop after each robot and show its STATUS.md row
  and evidence. If a new dependency appears, add it to robots_sudo.sh, mark that robot NOT BUILT with the error, and go on to the next
  robot instead of waiting; list all such robots at the end.
Rules:
1. Never run sudo, apt or a plain `rosdep install` (it calls sudo). Only `rosdep check` and `rosdep install --simulate` are allowed.
2. Workspace ~/robots_ws/src, one folder per vendor. Never modify /opt/ros or the TurtleBot3 workspace. ROBOTS_WS=~/robots_ws.
   Repos already cloned there by an earlier attempt may be reused, but re-check their URL, branch and commit, and re-do steps 6–8:
   nothing from an earlier attempt counts as built or verified.
3. Source preference: (a) Jazzy apt packages; (b) the maker's official Jazzy branch/tag – prove it exists with
   `git ls-remote --heads <url>` and quote the README line; (c) the maker's official older branch (e.g. Humble) ported by you.
   Record URL, branch and commit hash. Never use this website's own models (public/…) as a source.
4. Simulation only: skip real-hardware drivers unless the simulation needs them. A hardware driver launch (e.g. scout_base base.launch.py)
   is NOT a simulation; find or port the maker's Gazebo simulation instead.
5. Porting: smallest changes on a branch jazzy-ros2lab in each cloned repo, one commit per change explaining why. Typical: Gazebo Classic
   (gazebo_ros, gazebo_ros2_control, classic plugins/.world) → Gazebo Harmonic (ros_gz_sim, gz_ros2_control, gz-sim systems,
   ros_gz_bridge YAML); ign/ignition → gz; Jazzy ros2_control/controller parameter changes (TwistStamped for diff_drive_controller);
   deprecated launch/ament APIs; MoveIt 2 config changes. List every change in parity/robots/<robot>/PORTING.md.
6. Build only what is needed: `colcon build --symlink-install --packages-up-to <bringup/sim packages>` in ~/robots_ws. Record the
   colcon summary line. Non-ROS C++ libraries a robot needs (e.g. libfranka for franka_ros2) are cloned at the exact version the
   maker requires, with submodules, into ~/robots_ws/src and built by colcon as plain CMake packages – never with sudo make install.
   Run long builds in the background and keep the log in parity/robots/<robot>/build.log.
7. Verify for real: write the launch command into parity/robots/<robot>/scenarios/sim.sh, start it with
   `bash parity/scripts/start_reference.sh <robot> sim 46 ref46`; save to parity/fixtures/<robot>/install_check/:
   (a) `ros2 control list_controllers` with controllers active, (b) `ros2 topic list -t`,
   (c) motion proof – mobile: /odom changes under TwistStamped /cmd_vel; arm: /joint_states changes after a joint trajectory or a MoveIt
   plan executes. A display-only launch (view_robot) is not enough. Stop with `bash parity/scripts/stop_reference.sh 46`.
8. STATUS.md: Built = yes only with a successful colcon summary (or apt install); Verified = yes only with (a), (b), (c) saved.
   Status OFFICIAL-JAZZY or ROS2LAB-PORT only when Built = yes AND Verified = yes; otherwise NOT BUILT, NOT VERIFIED or FAILED with the
   exact blocking error. Fill the Launch command and Evidence columns.
9. Known starting points (checked online on 15 Oct 2026; re-confirm, do not take as proof):
   - UR5e: Jazzy apt packages incl. ur_simulation_gz; verify with a headless ur_simulation_gz launch and a joint trajectory.
   - Franka FR3: franka_ros2 README says it is built on ROS 2 Jazzy; install steps clone the jazzy branch. It needs libfranka at the
     version franka_ros2 names (an earlier attempt failed with "Franka 0.19.0 not found"): build it in ~/robots_ws per rule 6.
   - xArm Lite 6: xarm_ros2 lists a jazzy branch (Jazzy support added 2024-11-05). An earlier attempt built 8 packages (deprecation
     warnings only) but never launched it.
   - Interbotix WX250s: no official Jazzy branch could be confirmed; prove one with git ls-remote for EVERY cloned Interbotix repo,
     otherwise treat it as a port of the official Humble branch. The arms need several repos (core, toolboxes, manipulators and the
     DYNAMIXEL SDK) – follow the maker's install instructions for the full set; check which simulator its sim package uses.
   - AgileX Scout build needs libasio-dev (ugv_sdk includes asio.hpp).
   - Dobot CR5: official source is Dobot-Arm/DOBOT_6Axis_ROS2_V4 (ROS 2 Humble only; has cr5_moveit and the description package);
     port it to Jazzy (label ROS2LAB-PORT) and verify with a controlled simulation, or mark FAILED.
   - AgileX Scout: scout_ros2 humble branch; scout_base base.launch.py is the hardware driver – find the maker's Gazebo simulation or port
     one, verify driving with TwistStamped /cmd_vel and /odom changing, otherwise FAILED for simulation.
```

## P2c – Ground truth for the other verified mobile robots

```
For every MOBILE robot with Verified = yes in parity/robots/STATUS.md (e.g. TurtleBot4, Scout), use the ros-reference subagent
(domain 47, partition ref47, one run at a time) to capture: sensors snapshot (topics, QoS, TF, sensor samples), a SLAM run with a saved
map, and a navigation run (initial pose + 5 checked goals, 10 runs) – the same as P2 steps 1–4, with goals checked against that robot's
map. Add the scenarios to start_reference.sh or the robot's scenarios/ folder. Report UNVERIFIED items with reasons.
```

## P3 – Core architecture + Fixed Frame (spec S1–S3)

```
Implement spec S1–S3 in the existing code structure (adapt paths; no parallel duplicates):
a) TF registry (static + dynamic buffers, authority tracking, getAllFrameNames/canTransform/lookupTransform, framesChanged event); /tf_static replayed to late subscribers; TF tree from the robot's URDF as captured in parity/fixtures/<robot>/sensors/samples/robot_description.yaml.
b) ONE shared scene: the Gazebo-like view and the RViz views are cameras on it; RViz views Orbit, TopDownOrtho, XYOrbit, FPS, ThirdPersonFollower with Target Frame. Remove any second simulation used only by the 2D view.
c) Typed pub/sub bus with exact ROS names, types and QoS + DDS compatibility rules.
d) Robot capability manifests for the site (put them where the site keeps robot data, e.g. next to public/robots/<id>/ – adapt to the existing structure) generated from the captured topic lists, and a nav2_params.json per mobile robot generated from the installed param files (header comment with source path and package version).
e) Fixed Frame: first write parity/e2e/fixed-frame.spec.ts that FAILS today (per robot: options include odom, base_footprint, base_link, base_scan, imu_link, camera frames where they exist, and map only after SLAM/AMCL; select works; free text works; unknown frame → Global Status error text from fixture; selection persists after reload; late-joining RViz still sees static frames; control is enabled and not covered by an overlay). Then diagnose with the 8 causes in spec S3, write parity/reports/bugs/fixed-frame-rca.md, and fix with an editable combobox bound to rvizConfig.globalOptions.fixedFrame, all displays transforming via a FrameManager.
Acceptance: fixed-frame tests pass for every robot; Fixed Frame = odom and = base_link behave as spec S3 describes; vitest for TF registry; both centre views show the same pose.
```

## P4 – RViz tools: 2D Pose Estimate, 2D Goal Pose and per-algorithm wiring (spec S4)

```
Implement spec S4. Write failing tests first:
- 2D Pose Estimate publishes /initialpose PoseWithCovarianceStamped in the fixed frame with the RViz covariance; AMCL reinitialises; /amcl_pose, /particle_cloud and map→odom update; no effect while SLAM is mapping; relocalises in SLAM Toolbox localization mode.
- 2D Goal Pose publishes /goal_pose PoseStamped; goal transformed to map; NavigateToPose runs; works with Fixed Frame = odom.
- Nav2 Goal tool uses the action and shows feedback; Publish Point → /clicked_point.
- For every planner × controller combination captured in P2, the selected planner runs on the global costmap and the selected controller on the local costmap; /plan differs between NavFn, Smac2D and ThetaStar for the same goal; goal in an obstacle fails like the fixture and triggers recoveries.
Acceptance: tests pass for every mobile robot; record any planner/controller you could not match as a FAIL in parity/reports/FAILS.md.
```

## P5 – Sensors: Image and PointCloud2 per robot (spec S9)

```
Implement spec S9, using the captured fixtures and parity/fixtures/_installed model.sdf files as truth (not the spec table if they differ).
- Burger: no camera topics anywhere (topic list, Add-by-topic, bridge view); Image and PointCloud2 displays behave as in parity/mistakes.yaml (image_on_burger, pointcloud_on_burger, pointcloud_on_scan); a teaching note says Burger has no camera.
- Waffle / Waffle Pi: RGB camera rendered from an offscreen Three.js camera at the optical frame, size/encoding/rate and camera_info K matching the fixture; Image display (Transport Hint raw/compressed, Reliability), Camera display (needs CameraInfo + TF), QoS behaviour matching the captured publisher QoS.
- TB4 (if Verified in STATUS.md and captured): OAK-D topics as captured, PointCloud2 from depth raycast/texture with correct fields, frame_id, NaN for no return.
- Optional non-standard variant tb3_waffle_depth with a visible "Non-standard ROS2Lab variant" badge.
- DepthCloud display only if verify_results.md says it exists in installed rviz_default_plugins.
Tests: Playwright per robot (burger has no Image/PointCloud2 by topic; waffle image non-blank within 3 s; K matrix and PointCloud2 byte layout unit tests).
```

## P6 – Full autonomous-navigation stack emulation (spec S5–S8, S10, S11)

```
Implement every tool in spec S11 that has an installed real counterpart (from P0), with lessons wired to it:
robot_state_publisher/URDF, joint_state_publisher (URDF lesson), virtual ros_gz bridge table (a topic not in the bridge YAML must not exist), teleop with TwistStamped, robot_localization EKF (optional level, disables odometry TF while active), SLAM Toolbox (async/sync/localization/lifelong, save_map, serialize/deserialize) and Cartographer, map_server + map_saver (downloadable .yaml/.pgm), AMCL in a Web Worker (spec S7), global and local costmaps with static/obstacle/voxel/inflation layers and keepout/speed filters (spec S6), planner/controller/smoother/behavior servers (spec S5 table), bt_navigator running the default Nav2 BT XML with recoveries, waypoint follower (+ wait/photo/input at waypoint), velocity_smoother → collision_monitor chain, docking (only if installed), route server (feature flag OFF unless installed), lifecycle manager, Simple Commander shim (in-browser Python exposing BasicNavigator), view_frames, rqt_graph/rqt_tf_tree/rqt_image_view panels, rosbag2 MCAP record/replay.
RViz (spec S10): every display with the listed properties, Add by display type / by topic, Navigation 2 panel (Startup/Pause/Reset, waypoint and through-poses modes, feedback, load/save/loop waypoints), SlamToolboxPlugin panel; default display set from the installed nav2_default_view.rviz and TB3 .rviz files; no Kilted-only panels in Jazzy mode.
Parameters must come from each robot's nav2_params.json (installed values, see P3 d).
Acceptance: emulated `ros2 topic list -t`, node list and lifecycle states per scenario equal the fixtures (PENDING where no fixture); Playwright e2e teleop → SLAM → save map → AMCL → goal → waypoints per robot. Write parity/reports/stack_status.md listing VERIFIED / PENDING per tool.
```

## P7 – Robot pages: concept hierarchy and UI (spec S12)

```
Restructure every robot page into the single shared component described in spec S12: 10-level left stepper; per level one short concept text from parity/reference/concepts.md (edit for accuracy, keep it short – no long paragraphs), a "Try it" control, a "What real ROS 2 shows" panel (topics, TF, the real commands a student would type), and a "Check yourself" task; levels locked until prerequisites exist with the reason shown; top bar robot/world/mode; centre split 3D | RViz (Orbit ↔ TopDownOrtho); right Displays + Tool Properties; bottom toolbar + topic/TF inspector. Neat, consistent, interactive, keyboard accessible, usable from 375 px to 1280 px. Show only what each robot really has.
Then run the course-ui-reviewer subagent for each robot (up to 3 in parallel) and fix its FAIL items.
```

## P8 – RViz option-by-option parity audit (spec S10)

```
Create parity/reports/rviz_parity.md with one row per RViz element and property in spec S10 (element, property, real default from parity/fixtures/_installed rviz files or captured logs, ROS2Lab value, PASS/FAIL/PENDING, evidence). Write parity/e2e/rviz/<element>.spec.ts for each row, checking the element individually: visible, enabled, clickable, correct effect, correct published message/topic/frame, correct status text. Real defaults and status strings come only from installed files or fixtures; otherwise PENDING. Add an `npm run parity:report` script that regenerates the table from test results.
```

## P9 – Parity runs for every robot and scenario (parallel)

```
For each mobile robot with Verified = yes in parity/robots/STATUS.md and each of its scenarios with fixtures, run the web-tester subagent, then the parity-judge subagent (at most 3 web-testers at once). Merge every FAIL into parity/reports/FAILS.md grouped by: TF/Fixed Frame, views, sensors, tools, SLAM, AMCL, costmaps, planners, controllers, BT/recoveries, panels, params, error text, UI. Do not fix anything yet.
```

## P10 – Student personas with mistake injection

```
Run four student-persona subagents (beginner, careless, intermediate, advanced) for tb3_burger and tb3_waffle, then every other mobile robot with Verified = yes in parity/robots/STATUS.md, covering levels 1–10 and every mistake in parity/mistakes.yaml that fits each persona. Real-ROS reproductions run one at a time: beginner domain 42/ref42, careless 43/ref43, intermediate 44/ref44, advanced 45/ref45. Browser runs may overlap.
Merge into parity/reports/MISTAKES.md: per mistake MATCH / MISMATCH / NO-FIXTURE, and whether faithful error came first and a hint second. Add course-text problems the personas found to parity/reports/COURSE_ISSUES.md.
```

## P11 – Fix loop

```
Order the items in parity/reports/FAILS.md, MISTAKES.md (MISMATCH only), COURSE_ISSUES.md and the ui_<robot>.md reports: TF/Fixed Frame and views first, then tools, sensors, error text, SLAM/AMCL/costmaps, planners/controllers, panels, then UI/course text. For each, spawn an emulator-fixer subagent (one item each, at most 3 at a time). After each batch, re-run web-tester + parity-judge (or course-ui-reviewer) for the affected robot/scenario; merge a worktree only if its item now passes and no other test regressed.
Stop after 10 fixes and summarise what changed and what still fails. I will tell you to continue.
```

## P12 – Playground games (only after the stack passes)

```
Create <site playground code>/readiness.ts (adapt path) with per-robot checks: TF tree complete, Fixed Frame selectable, required sensor topics per manifest, SLAM works, AMCL works, Nav2 lifecycle active, each planner/controller wired, camera works (for camera games). Use the latest parity/reports results; a check with PENDING or FAIL keeps the game locked and the lock shows which check is missing.
Implement the games in parity/playground.md for robots whose required checks pass: each with config (world, robot whitelist, required levels), win condition, scoring formula, local leaderboard, deterministic seed. Camera games unavailable for tb3_burger. The Debugging Escape Room draws its faults from parity/mistakes.yaml and must show the same faithful errors as the fixtures.
Tests: Playwright plays each game with a scripted bot to its win condition; unit tests for scoring.
```

## P13 – Code review, accuracy summary, papers

```
1. Review all changes: run /engineering:code-review if it exists; otherwise review the full diff yourself for correctness against fixtures and spec, frame handling, QoS rules, numerical stability, performance (target 60 fps, workers for AMCL/planning, throttled camera rendering), accessibility and test coverage. Fix the critical findings via emulator-fixer.
2. Write parity/reports/SUMMARY.md: per robot, every metric (spec S14) with value, threshold, PASS/FAIL/PENDING and the fixture file it came from; feature coverage %; date and installed package versions from run_info.txt and dpkg_versions.txt; list of known differences from real ROS 2; each robot's STATUS label, and robots that remain NOT VERIFIED or FAILED. Every number must trace to a file; nothing estimated.
3. Generate the per-robot badge text for the site: "Validated vs ROS 2 Jazzy on <date>: X/Y checks pass" (add "(ROS2Lab port)" for ROS2LAB-PORT robots), or "Not yet validated". Arms: "Not yet validated – manipulation checks pending".
4. If /paper-search (or another paper search) is available, re-check every entry in parity/reference/papers.md (DOI resolves, authors/venue correct) and search for the two "not yet found" topics; write the results into parity/reference/papers.md with the date. Do not add a paper you could not verify.
```

## Re-running later

After the site changes or packages update: P0 (facts), P2 / P2c for affected robots, P9, P10, P13. The SUMMARY then shows the new state with dates.
After installing or porting another robot: P2b for that robot only, then P2c if it is mobile.

## Not in this kit yet

M-series prompts for the arms (MoveIt 2 planning, joint trajectories, collision checking, RViz MotionPlanning panel) – to be added once
their STATUS.md rows are Verified = yes.
