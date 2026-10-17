# Overnight run F/G (2026-10-17 → 18), unattended

Every decision made without the instructor is listed under its item. Branch at start: `review-2026-10-17` (HEAD 413a50f).

## Item 0 – bag_manifest.md vs matrix.md

**Cause.** Two things mixed in earlier manifests:
1. The hand-written manifest before 2b55084 (e.g. 2b9cefc) listed `nav_robotis/bags/run1…run10` with sizes and
   statuses ("run6 FAILED (timeout)", 141 MiB, 0.02 MiB …) that belong to the bags now in
   `nav_robotis/archive_2026-10-16_pre_upgrade/bags/`, and `nav2_bringup/bags/SmacLattice_*` "NAV FAILED" rows that
   belong to the earlier P2 matrix (`nav2_bringup/runs/<pair>.json`), not to the step E matrix
   (`nav2_bringup/matrix/<pair>/result.json`).
2. The generated manifest of 2b55084 linked a status only for `bags/matrix/<pair>`; all other bags (current
   nav_robotis runs, P2 leftovers, archive folders) showed `-` in one table, so current and old bags looked alike.

**Odd sizes.** Measured: the archived nav_robotis bags run7–run10 ended 27–50 s *before* their result file was
written ("Bag end - result" column: −27, −28, −50, −42 s), and archived run6 has 30 messages on 1 topic and no result
file. The old P2 SmacLattice bags are 0.98–2.71 MiB (4.6–15.5 s). These are the earlier, broken attempts; the
current bags are 38–44 MiB (nav_robotis) and 12.7–22.4 MiB (matrix).

**Fix.** `generate_bag_manifest.py` now links every bag to the result file written by the same run
(`matrix/<pair>/result.json`, `runs/<run>.json`, `<attempt>/runs/<run>.json` or `<attempt>/<run>.json`), adds a
"Bag end - result" timing check, and splits the table: *Current evidence* (36 bags) and *Archived and superseded
attempts* (35 bags, each labelled ARCHIVED attempt `<folder>` or SUPERSEDED by `bags/matrix/<pair>`).

**Check.** Scripted comparison: 25/25 matrix rows equal `parity/reports/matrix.md` §2 (20 SUCCEEDED, 5 ABORTED 104);
nav_robotis run1–run10 are all "5/5 goals SUCCEEDED", equal to `nav_robotis_step_d.md` (10/10 per goal).
One wrong line found and corrected: step D said the 10 bags are "422 MB"; on disk 441631011 bytes = 421.17 MiB.
`slam/bags/run1` has no result file (mapping run, no goals) and shows "no result file".

## Item 1 – DWB follow-up with installed kinematics

Found: `/opt/ros/jazzy/share/turtlebot3_navigation2/param/burger.yaml` lines 120–160 is a complete DWB
`FollowPath` block. Decision: add every key of it except `plugin` (37 keys, each with its line number in
`params.diff`); keep everything else as in step E (minimal diff). Added `run_matrix.py --dwb-burger` (separate
`matrix_dwb_burger/` and `bags/matrix_dwb_burger/`, so step E results stay untouched).
Result: 5/5 SUCCEEDED, error_code 0 (NavFn 4.00 s, Smac2D 3.77 s, ThetaStar 3.86 s, SmacHybrid 8.42 s, SmacLattice
4.66 s sim). Details: `parity/reports/matrix.md` §6. Caveat recorded there: nav2_bringup's
`tb3_simulation_launch.py` spawns the waffle model by default, so the burger limits ran on a waffle body.

## Item 2 – Step F fixture parity tests (in progress)

Decisions:
- Dev server: 127.0.0.1:8000 was not serving; started `npm run dev` in the background.
- Specs in `parity/e2e/fixtures/` (`lib.ts`, `nav.ts`, `sensors.spec.ts`, `mapping.spec.ts`, `nav_robotis.spec.ts`,
  `nav2_bringup.spec.ts`). They read the committed fixtures at run time (YAML via PyYAML, `ros2 topic list/info`,
  `view_frames` .gv, result.json, log excerpts) and drive the site like a student: build the official workspace,
  source, `export TURTLEBOT3_MODEL=<model>`, the same launch commands as `parity/scripts/start_reference.sh`.
- The fixture map (`parity/fixtures/maps/turtlebot3_world.*`) is copied onto the site's file system and passed as
  `map:=` (the reference runs used it; goals.yaml is in its frame).
- QoS compares the set of (endpoint kind, node full name, reliability/durability) per topic; capture tool nodes
  (ros2cli daemon, rosbag2 recorder) are left out; `launch_ros_<pid>` and `transform_listener_impl_<address>` are
  compared by role (their suffix changes every run). History depth is UNKNOWN in the fixtures, so not compared.
- Nav2 params: every key of the installed `<model>.yaml` for each node that the reference started; where the captured
  `ros2 param dump` has the key, its value wins (order of truth: fixture > installed). `use_sim_time` and
  `yaml_filename` are set by the launch file and skipped.
- Log texts: exact after normalising robot coordinates `(x, y)` (thresholds.yaml `error_text_match:
  exact_or_normalised`); level and logger must match.
- Numeric items (camera K, goal durations, bringup timeout seconds): thresholds.yaml has no key → PENDING-THRESHOLD
  with both values. Site goal durations are wall seconds (the site has no sim clock readout in the CLI output).
- Image width/height and camera_info width/height are compared exactly (integers that define the sensor).
- tb3_burger goals: one site session runs goal1–5, then obstacle_goal, cylinder_centre, outside_map (the reference
  ran these in three sessions); status/error_code/error_msg are compared, not positions.
- nav2_bringup matrix: each pair in a fresh page with the pair's committed `params.yaml` as `params_file:=`; if the
  first pair cannot become ready, the rest are recorded FAIL "not run" with that reason (no 25 identical waits).
- Spec bugs found and fixed while writing (not site bugs): terminal cap (`MAX_TABS = 6`) made goals run in an old
  terminal → one goal terminal with an `echo` marker per goal; `ros2 topic info` node names must include the namespace.
- vitest is not installed in node_modules: unit tests run with `npx --yes vitest@3.2.4 run parity/unit`
  (baseline 22/22 passed).

Result (full run 2026-10-17 22:14–23:14 +0530, waffle nav_robotis rerun after the capture-gap fix): 16 tests,
15 failed, 1 passed (the no-initial-pose bringup abort test). Items: 279 PASS, 427 FAIL, 10 PENDING-THRESHOLD,
27 NOT-VALIDATED. Report: `parity/reports/fixture_parity.md` (main causes listed at its top).

## Item 3 – Step G fixes on branch `parity-fixes` (from b79f45a… ff7cb5e)

Decisions:
- Gate after every fix: `parity/scripts/run_regression.sh` = every parity Playwright spec outside
  `parity/e2e/fixtures` (39 tests), `npx --yes vitest@3.2.4 run parity/unit` (22), `node tools/security-check.mjs`,
  and the site's TurtleBot3 tests `tests/real-tb3.mjs`, `tests/real-tb3-nav.mjs`,
  `ONLY=burger,waffle,slam,nav,fake tests/real-mobile-audit.mjs` (the site has no single test command; these are the
  CLAUDE.md tests for TB3). Baseline before any fix: all passed. The fixture spec(s) of the fix are run before and
  after each change; the whole fixture suite (~1 h) runs once at the end, not after every fix (run time).
- A fix is one concern (one FAIL class) per commit; the commit message names the fixture items it turns to PASS.
- One gate run (after G2) had `real-mobile-audit` "[nav] NavigateToPose SUCCEEDED" FAIL; the nav part was rerun twice
  with the change and passed both times, so it was recorded as a flaky goal, not reverted.

Fixes so far (all gates green):
- G1 01c6186 `/rosout` publisher QoS TRANSIENT_LOCAL (sensors fully PASS for burger and waffle).
- G2 d44a05c slam_toolbox endpoints and QoS; model endpoints keep their QoS.
- G3 7829ea1 cartographer endpoints and QoS (no /imu with use_imu_data = false).
- G4 dd299d2 `window.__ros2lab.tf` from the graph's TF tree (map -> odom).
- G5 a5e0efa Nav2 endpoint QoS (latched maps/costmaps/footprints, best-effort sensor and pose inputs); velocity_smoother
  odometry only with CLOSED_LOOP.
- G6 b43e601 failed-goal log lines (`[ActionServer] Aborting handle.`, ERROR `Goal failed`).
- G8 bd6b9d9 nav2_params.json headers: source file + version 2.3.6 (+ deb version); values checked against the installed
  `<model>.yaml` (tb3_waffle_pi already used waffle_pi.yaml). New fixture unit test `parity/unit/nav2-params-header.test.mjs`.
- G7 5ce42e7 RViz 2 graph: disabled Groups do not subscribe, topic QoS from the .rviz file, absolute tool topics, a
  RobotModel the file lacks/disables is drawn but not subscribed.
- G10 a commit after 5ce42e7 ("tb3_waffle_pi opens the official ROBOTIS workspace"): page entries robots/env in
  workspace.json and index.json; the pruned mesh `waffle_pi_base.stl` restored unmodified from the pinned commit
  (sha256 equal to the installed copy). Decision: did not rerun `tools/fetch-workspaces.mjs` (it would drop the
  hand-made page entries of workspace.json); its config now lists waffle_pi for a later regeneration.
- G9 1a4e99c readiness locks from fixture results (`public/js/games/fixture-status.js`, generated by
  `parity/compare/readiness_from_fixtures.py`); registry lock message without innerHTML. Decision: the unit test
  `parity/unit/readiness.test.mjs` and `parity/e2e/playground-games.spec.ts` asserted unlocks without evidence
  (e.g. waffle CAM true); they now expect what fixture-status.js says. Recorded as a deliberate test change, not a
  regression. CAM stays locked while camera K is PENDING-THRESHOLD (no threshold in thresholds.yaml).
- G11 (after G9) tf2 listener nodes + launch_ros_<pid> node.
- Pre-existing flake: `real-mobile-audit` "[nav] NavigateToPose SUCCEEDED" failed in 3 of 11 gate runs; the full audit
  on the pre-fix baseline b79f45a (served from a temporary worktree on :8080) failed it in 1 of 2 runs too; the nav
  part alone passed 8/8 with the fixes. Not reverted.
- Not touched: branches d33bd28, af2de7b.

## Item 4 – P2b PHASE A

Done: `parity/robots/P2B_PHASE_A.md`, `parity/scripts/robots_sudo.sh` (not run), raw rosdep output in
`parity/robots/p2b_rosdep/`. Cloned (makers' Jazzy branches, checked with git ls-remote): ros2_kortex, ros2_robotiq_gripper,
DOBOT_6Axis_ROS2_V4, crazyswarm2 (main only), franka_description; scout_ros2 switched from humble to origin/jazzy.
Blocking finding: apt cannot read its sources (duplicate packages.ros.org entries with different Signed-By), so the
10 apt names rosdep resolved could not be confirmed with apt-cache; robots_sudo.sh fixes the source list first.
