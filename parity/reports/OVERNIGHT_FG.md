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

## End of run (2026-10-18)

Simulations: `parity/scripts/stop_reference.sh 41` → "nothing running for domain 41"; domain_pids 41 empty. Dev
servers on :8000 and :8080 left running (not simulations).

Corrections to the hashes above: G10 = 25fc516, G11 = fdebe44.

### Commits made this run

```
05f9550 fixture_parity.md final step G run: 495 PASS, 185 FAIL, 10 PENDING-THRESHOLD, 53 NOT-VALIDATED; readiness: SLAM now passes
25cb5d2 OVERNIGHT_FG: step G fixes G5-G11, item 4
fdebe44 Model the tf2 listener nodes and launch_ros's node, as in the Jazzy graph
1a4e99c Playground readiness locks follow the fixture parity tests (locked until their tests pass)
cf9b61f fixture_parity.md after step G fixes G1-G8, G10: 465 PASS, 215 FAIL (was 279 / 427)
977cd18 FAILS.md: step G fixture FAILs left and why
4427cce P2b phase A: sources and rosdep for the non-TB3 robots, robots_sudo.sh (not run)
25fc516 tb3_waffle_pi opens the official ROBOTIS workspace with TURTLEBOT3_MODEL=waffle_pi
5ce42e7 Fix RViz 2 graph: displays in a disabled Group do not subscribe, topic QoS from the .rviz file, absolute tool topics
bd6b9d9 nav2_params.json headers: installed source file, package version 2.3.6 (deb 2.3.6-1noble.20261006.044113), values checked
b43e601 Fix failed-goal log lines: [ActionServer] Aborting handle. (planner, controller, bt_navigator) and ERROR Goal failed
69e8fc2 nav_robotis.spec.ts: NAV_GOALS=<names> runs only those goals (default all)
a5e0efa Fix Nav2 endpoint QoS as on Jazzy: latched map/costmaps/footprints transient_local, sensor and pose inputs best effort
8684436 OVERNIGHT_FG: step G decisions and fixes G1-G4; readiness_from_fixtures.py (not yet wired)
dd299d2 Fix window.__ros2lab.tf: the TF tree the running programs broadcast (RosGraph.tfTree), incl. map -> odom
7829ea1 Fix cartographer graph: SensorDataQoS scan/odom, imu only with use_imu_data, /map transient_local
d44a05c Fix slam_toolbox graph: QoS as on Jazzy, /map self-subscription, no /initialpose (mapping mode), no bond
01c6186 Fix /rosout publisher QoS: RELIABLE/TRANSIENT_LOCAL like Jazzy (fixtures */sensors/qos/rosout.txt)
aadea3f Add run_regression.sh: parity e2e (non-fixture), parity unit, security check, site TB3 tests
ff7cb5e fixture_parity: site goal results near obstacles vary between runs; OVERNIGHT_FG item 2 result
b79f45a Step F: parity/reports/fixture_parity.md (279 PASS, 427 FAIL, 10 PENDING-THRESHOLD, 27 NOT-VALIDATED), capture-gap handling
0f9cc6d Step F specs: namespace-qualified QoS node names, one goal terminal with markers, captured param dump wins; OVERNIGHT_FG item 2 decisions
0c3e20b Step F: fixture parity specs (sensors, slam, cartographer, nav_robotis, nav2_bringup) and report generator
145a489 matrix.md, OVERNIGHT_FG.md: 37 burger.yaml DWB keys (count from params.diff)
b83b923 tb3_burger nav2_bringup DWB with installed burger.yaml FollowPath keys: 5/5 SUCCEEDED (was ABORTED 104 without them)
9097a3f run_matrix.py --dwb-burger: 5 planners x DWB with the installed burger.yaml FollowPath keys (source line per key)
e3b2dfb bag manifest: status from each bag's own result file, archived/superseded attempts listed separately
```

Branches: items 0–2 on `review-2026-10-17` (up to ff7cb5e); item 3 and later commits on `parity-fixes` (created from
ff7cb5e). Item 4 (P2b phase A) was committed on `parity-fixes` as well (it is parity-only, no site code).

### Test numbers from the final runs (branch parity-fixes)

- Fixture suite `parity/e2e/fixtures` (2026-10-18 04:22–05:01 IST): 16 tests, **10 passed, 6 failed**.
  Items: **495 PASS, 185 FAIL, 10 PENDING-THRESHOLD, 53 NOT-VALIDATED** (start of step F: 279 / 427 / 10 / 27).
  Report: `parity/reports/fixture_parity.md`.
- Regression gate after the last change (`run_regression.sh`): parity e2e (non-fixture) **39 passed / 0 failed**,
  vitest **26 passed / 0 failed**, security check passed, `real-tb3` all passed, `real-tb3-nav` all passed,
  `real-mobile-audit` (burger, waffle, slam, nav, fake) all passed.

### FAILs fixed (fixture items FAIL → PASS)

/rosout QoS (all scenarios); slam_toolbox graph and QoS; cartographer graph and QoS; TF hook map -> odom; Nav2 QoS of
maps, costmaps, footprints, polygons, /amcl_pose, /odom, /scan, /initialpose, /goal_pose, /particle_cloud; failed-goal
log lines and ERROR level; RViz 2 subscriptions, QoS and tool topics; tb3_waffle_pi official workspace (all its sensors,
slam and cartographer items, nav goal1, params, lifecycle); tf2 listener and launch_ros nodes (slam, cartographer);
nav2_params.json headers (unit test). Readiness locks now follow fixture results: TF, SENS, SLAM, AMCL pass for all
three; NAV passes for waffle and waffle_pi.

### FAILs left (reasons in parity/reports/FAILS.md, "Step G")

nav2_bringup tb3_simulation_launch.py world not modelled (graph, matrix 25 + 5); Nav2 topics/nodes not modelled
(nav_robotis QoS and topic list); burger obstacle_goal / cylinder_centre goal results vary on the site; numeric items
without thresholds; the pre-existing real-mobile-audit nav flake.

### What you must do in the morning

1. Review and merge branch `parity-fixes` (not pushed, not deployed). If you agree with the test changes in 1a4e99c
   (readiness unit test and playground spec now follow fixture-status.js), keep them; otherwise say so.
2. Run `bash parity/scripts/robots_sudo.sh` (fixes the duplicate ROS apt source, then installs 10 packages) and tell me
   "Done" for P2b phase B. Check `parity/robots/P2B_PHASE_A.md` first (interbotix_ros_core has 37 uncommitted changes
   from an earlier attempt; I left them untouched).
3. Decide thresholds in `parity/thresholds.yaml` for camera K, goal durations and the bringup timeout (they keep CAM
   locked and stay PENDING-THRESHOLD until then).
4. Recapture the tb3_waffle / tb3_waffle_pi nav_robotis snapshot QoS without the daemon (53 NOT-VALIDATED rows are
   "Unknown topic" capture gaps).
5. Decide whether the site should model nav2_bringup's `tb3_simulation_launch.py` world (largest remaining FAIL block).
