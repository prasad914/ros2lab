# Overnight run 2026-10-18/19 (unattended)

Part A: branch `parity-fixes` in `~/ros2lab-course`. Part B: branch `robots-p2b` in the worktree `~/ros2lab-robots`.
Every decision below names its evidence (file, command output or commit).

## Start state
- 2026-10-18 22:02 IST. `parity-fixes` at 51df796, `robots-p2b` at ca2ed53. Dev servers already up on :8000 and :8080.
- Decision: no separate baseline gate run; the last full gate on 51df796 is recorded green in
  `expert_review_2026-10-18.md` ("Gate (final)"). Any failure later is compared with that.

## Part A

### A0 – review committed
- 0f11c41 `parity/reports/expert_review_robots_2026-10-18.md` (no fixtures behind it, says so in the commit).

## Part B (worktree ~/ros2lab-robots, branch robots-p2b)

### B1 – moveit_capture.py collision case (16d8d66)
- Start state checked with `/check_state_validity` (no box) before anything; box (0.08 m cube, was 0.2 m) placed
  around the EE pose of a joint goal only; kept only if the start state is still valid with the box AND the goal
  state is invalid with it, otherwise removed and the next first-joint offset tried (+0.4, +0.6, +0.8, -0.4, -0.6,
  -0.8 rad, inside the URDF limits). Goal planned with 1 and with 10 planning attempts
  (`fail_goal_in_collision_attempts1/10`). Box removed, `/get_planning_scene` (WORLD_OBJECT_NAMES) must not list it.
  All checks → `runs/collision_checks.json`. Decision: 0.08 m box (smaller box = less chance of touching the start
  pose; the validity checks decide, not the size).
- Mistake found and corrected: the B3 commit first picked up the staged ur5e rename from B2 (`git commit` takes the
  whole index); split with `git reset --soft` before anything else. From then on robots-p2b commits name their paths.

### B3 – tb4 EGL /scan marked invalid (a388fb0)
- `parity/fixtures/tb4/p2c_sensors/README.md`, `parity/fixtures/tb4/p2c_nav/run1/README.md`. Evidence cited:
  `p2c_nav/run1/session.txt` lines 16-22 ("0 valid ranges"), line 51 ("lidar ranges all 0.164 = range_min under
  EGL"); contrast `p2c_scan_xvfb/scan_probe.txt` (440/640 finite under xvfb). The 640/640 rclpy probe was not saved
  as a file: stated as such. Captured files not edited.

### A1 – real-hardware lock by what a launch starts
- Probe first (`tests/_probe_hw.mjs`, scratch, not committed): what each review launch starts in the browser
  (`graph.procInfos`). ur5e.launch.py: ros2_control_node with `ur_robot_driver/URPositionHardwareInterface` +
  dashboard_client, urscript_interface, controller_stopper_node, robot_state_helper; with `use_mock_hardware:=true`
  the same launch starts only cm (mock_components/GenericSystem), rsp, rviz2, trajectory_until_node, spawners.
  xarm6_planner_realmove: plugin `uf_robot_hardware/UFRobotSystemHardware`; xarm6_driver: `xarm_api xarm_driver_node`;
  scout_mini_base: `scout_base scout_base_node`; keyboard_velmux: `crazyflie_server_cpp crazyflie_server` (backend cpp).
- Rule (real-launch.js): a process is real hardware if it is a known driver node (HW_NODES, each checked against the
  makers' launch files: `Node(package=..., executable=...)`) or ros2_control_node whose URDF `<hardware><plugin>` is
  declared by the workspace's pluginlib XML with a `hardware_interface::` base class and is not fake/mock/sim
  (declared: URPositionHardwareInterface, UFRobotSystemHardware, FrankaHardwareInterface, KortexMultiInterfaceHardware,
  RobotiqGripperHardwareInterface, XSHardwareInterface). Locked: the process is not started, the lock note is printed
  once, the launch is stopped like Ctrl+C. The command-string lock in terminal-sim.js is removed.
- The invented pluginlib "class ... does not exist" error for these declared plugins is gone: unlicensed → lock note;
  licensed → an honest "(ROS2Lab: <plugin> is the maker's driver …)" note.
- First fix missed fr3 `franka.launch.py`: in Franka's URDF `<param>`s come before `<plugin>` inside `<hardware>`
  (probe `tests/_probe_fr3.mjs`); regex widened.
- Failing test first: `parity/e2e/hw-lock.spec.ts` before the fix: 6 failed / 2 passed (the 2 mock/sim cases).
- Result: hw-lock.spec 17/17 after (6 review launches + 9 card commands locked, 2 mock/sim open); vitest 35/35;
  security check passed; tests/robot-hw.test.mjs "20 files identical". Commit a7c297f.
- Observed, not fixed (out of scope): the site shell runs nothing and prints nothing for
  `export LDS_MODEL=LDS-02 && ros2 launch …` (bash would export and launch). Owner list.

### A2 – "Not yet validated against real ROS 2" (9338382)
- Rule: a robot is validated only where `games/fixture-status.js` has a passing check. Only tb3_burger / waffle /
  waffle_pi have entries. Every other robot: label on the card, every launch button and every real-hardware button.
- TB3 per command (decision, from the fixture folders `parity/fixtures/tb3_*`: sensors, slam, cartographer,
  nav_robotis, teleop captures): turtlebot3_world → SENS+TF, cartographer → SLAM, map_saver_cli → SLAM,
  navigation2.launch.py (both cards) → NAV+AMCL, teleop_keyboard → SENS. Labelled: empty_world, house, rviz2.launch.py,
  fake node, real robot (no fixtures).
- workspace.json `honesty` shown under the repository list. Test: validation-labels.spec.ts 10/10 (10/10 failed before).
### A3 – "ROS2Lab-made config – not from the maker" (ccd1bbb)
- On the card of every robot without a maker workspace (so101, magician, irb120, kr6, lrmate, go2, g1, h1, spot,
  course robots). Separate commit from A2 (same spec).
### A4 – TB4 demo launches (6914094)
- `nav2_bringup tb4_simulation_launch.py` and `tb4_loopback_simulation.launch.py` → NOT_SIMULATED note
  "TB4 simulation is not modelled on ROS2Lab yet …", exit 1, nothing started. tb4-not-modelled.spec 2/2 (0/2 before).
- Full gate after A4: started 2026-10-18 ~23:00 while B2 real captures (domain 48) ran in parallel (CPU shared;
  recorded in case of timing flakes).
- Gate after A4 (`run_regression.sh`, log in scratch): parity e2e 73 passed / 3 failed — the 3 failures are the A6
  spec `lock-hint-catalog.spec.ts`, written first and not fixed yet (expected); vitest 35/35; security pass;
  real-tb3, real-tb3-nav, real-mobile-audit: 0 FAIL lines.

### A5 – enable_stamped_cmd_vel default false (587dfd1)
- The four Nav2 servers (controller, behavior, velocity_smoother, collision_monitor) default to false and declare the
  parameter (`ros2 param get` → false). Unit test failed before (nav2_params.yaml → TwistStamped), passes after.
- TB3 fixtures (decision: compare item tables, since these specs have baseline failures): nav_robotis burger
  99/160 PASS before (fixture_parity.md) and after (browser_out JSON); `/cmd_vel type (navigation2.launch.py)` PASS
  TwistStamped. nav2_bringup `/cmd_vel type (tb3_simulation_launch.py)` FAIL null before and after (that launch
  prints the honest not-simulated note). real-tb3-nav: all passed.

### A6 – lock hint and catalog badge (19c94f1, 5b99139)
- Hint: the card's non-real `ros2 launch` entries for this robot (max 3), else the workspace packages'
  sim/gazebo/demo/mock/display launch files. Badge: `gazebo` per workspace in ws/index.json (regex on the page
  commands: gazebo | gz | _sim_control); false for scout, crazyswarm2, interbotix (sim_note: Gazebo Classic only).
- lock-hint-catalog.spec 3/3 (failed 3/3 in the A4 gate, written first); hw-lock ur5e case still passes; vitest
  37/37; security pass. parity/browser_out restored with git checkout (not committed).

### B2 – M1 recapture, domain 48 / ref48, one arm at a time (domain empty before and after each: driver log)
Decision: each arm's existing `scenarios/moveit.sh` (Gazebo for ur5e/xarm6/lite6/cr5/gen3 as before; fr3 and
wx250s on fake hardware), so the new captures differ from the old ones only in the protocol. Earlier captures
renamed with `git mv` (kept, not edited). Collision results (`runs/fail_goal_in_collision_attempts{1,10}/result.json`,
`runs/collision_checks.json`; start state valid with the box in every used case; box gone afterwards in every case):

| Arm | Commit | Kept as | Collision 1 attempt | 10 attempts | Notes |
|---|---|---|---|---|---|
| ur5e | 02f518a | moveit_attempt2_collision_box_0.2m | -27 GOAL_STATE_INVALID | 99999 FAILURE | 184 move_group params this time |
| xarm6 | cea7588 | moveit_attempt2_collision_box_0.2m | -27 | 99999 | |
| lite6 | 73394bc, c82809b | attempt1_collision_box_0.2m, attempt2_collision_case_not_run | -6 TIMED_OUT | 99999 | first rerun: no joint1 offset freed the start (folded home) → script 4fbb6e8 tries the next joints; used joint3 +0.4 |
| cr5 | f8b64fe | moveit_attempt1_collision_box_0.2m | -27 | 99999 | |
| fr3 | f8000c5 | moveit_attempt2_collision_box_0.2m | -27 | 99999 | |
| gen3 | 7888b6a | attempt3_collision_box_0.2m, attempt4 (README only) | -26 START_STATE_INVALID | -26 | -26 also for every later run although the box is gone; cause UNVERIFIED (move_group --log-level fatal) |
| wx250s | 8ce04f4 | moveit_attempt3_collision_box_0.2m | -27 | 99999 | wrong-group case -26: CheckStartStateBounds, fingers 0 outside [0.015, 0.037] (move_group_lines.txt) |

- The reviewers' prediction for UR5e (-27 with 1 attempt, 99999 with RViz's 10) is now captured for ur5e, xarm6,
  cr5, fr3, wx250s.
- MISTAKE: gen3 attempt 4 (spawner lock, no controllers, KeyError in moveit_capture.py when /joint_states was empty)
  was overwritten by the rerun because its files were never committed (`git mv` failed silently in the driver). Its
  console output is preserved verbatim in `moveit_attempt4_spawner_lock_no_controllers/README.md`; nothing invented.

### A7 – remaining TB3-review items with a fixture
- collision_monitor setup lines (79dd44f): fixture `tb3_burger/nav_robotis/logs/nav2.log:147-282`; unit test failed
  before, 38/38 after. real-tb3-nav: one "cartographer map grows" FAIL under load (gen3 real capture running in
  parallel), immediate rerun all passed → recorded as flaky, not reverted.
- view_frames (fafab51): file name from local time, the four stamped lines of `tb3_burger/sensors/view_frames.log`;
  view-frames.spec failed before, passes after. Left: the .gv "Average rate / Buffer length / Most recent / Oldest"
  fields (need measured TF timing; inventing them is not allowed) and the full frame_yaml in the Result line.
- AMCL particle count: LEFT – no fixture of the /particle_cloud size (only max/min_particles params 2000/500 in
  `nav_robotis/params/amcl.yaml`); the real count depends on KLD sampling.
- `ros2 lifecycle nodes` order: LEFT – no fixture of that command's output (`lifecycle.txt` is the capture
  script's own sorted loop).
- collision_monitor "Robot to stop due to invalid source" (210 in nav2.log) / "timestamps differ on 0.2xx s":
  LEFT – driven by scan latency on the real machine; no threshold.
- MoveIt planning behaviour untouched (A7 rule).

### B4 – tb4 lidar, one attempt (6b73d44 on robots-p2b)
- `tb4_headless_ogre.launch.py` (gz server `--render-engine-server ogre`, headless EGL). `p2c_scan_ogre/scan_probe.txt`:
  3/3 scans with 640/640 ranges == range_min 0.164; `stats.txt` real_time_factor 0.430 then 0.072; OGRE 1 confirmed
  (`OgreGpuRays.cc` warning "Horizontal FOV for GPU rays is capped at 180 degrees"). FAILED → SLAM / nav not rerun.

### A8 – final gate and regeneration
- Final gate (`run_regression.sh`, after all Part A commits, no real simulation running): parity e2e 77/77,
  vitest 38/38, security pass, real-tb3 / real-tb3-nav / real-mobile-audit 0 FAIL lines, tb3-catalog exit 0.
- Full fixture suite: 14 passed / 6 failed = the 6 baseline specs (nav_robotis ×3, nav2_bringup graph, matrix,
  matrix_dwb_burger). Regenerated fixture_parity.md + fixture-status.js (29438de): totals unchanged.
- Fix summary appended to expert_review_robots_2026-10-18.md (c421978). parity/browser_out restored, not committed.
- Not reverted anything: no item produced a new gate failure.

## END
Domains at the end (pids): 41:[] 46:[] 47:[] 48:[] (empty = nothing running).

### git log --oneline -15 parity-fixes
```
c421978 Expert review (robots): fix summary (fixed / left / why)
29438de Regenerate fixture_parity.md and fixture-status.js after the overnight fixes
fafab51 view_frames: file name from the local time and the four real log lines (TB3 review should-fix, part)
79dd44f collision_monitor setup log lines as real Nav2 prints them (TB3 review should-fix)
5b99139 Catalog: "Gazebo" badges only for robots whose page has a Gazebo simulation (robots review site-wide #7)
19c94f1 License-lock hint names this page's own simulation / mock commands (robots review site-wide #4)
587dfd1 Nav2 enable_stamped_cmd_vel from the loaded params file, default false (robots review TB4 #4, TB3 review Low)
6914094 nav2_bringup tb4_simulation_launch.py / tb4_loopback_simulation.launch.py: honest "TB4 simulation is not modelled on ROS2Lab yet" note, nothing started (robots review TB4 #1-#3)
ccd1bbb "ROS2Lab-made config – not from the maker" on the card of robots without a maker workspace (robots review site-wide #3)
9338382 "Not yet validated against real ROS 2" on robot cards, launch and real-hardware buttons; honesty text on the card (robots review site-wide #2, TB3 review should-fix "RViz pages")
a7c297f Real-hardware lock by what a launch starts, not by the card's command string (robots review site-wide #1)
dc6828d OVERNIGHT_2026-10-19: start log
0f11c41 Expert review of the non-TB3 robot pages (MoveIt arms, Scout, Crazyflie, TB4), 2026-10-18
51df796 Expert review: fix summary (fixed / left / why)
40ed4d7 Regenerate fixture_parity.md and fixture-status.js after the expert-review fixes
```
### git log --oneline -15 robots-p2b
```
848765c _installed/interbotix_xsarm_moveit/SOURCE.txt as written by run_moveit_m1.sh for the wx250s recapture (source at port commit 86951bf; copied config files unchanged)
935c60c STATUS.md and OVERNIGHT_ROBOTS.md: overnight B1-B5 results (M1 recapture, tb4 lidar invalid under EGL, nav2_bringup tb4 demo)
ed896c8 B5 tb4: real nav2_bringup tb4_simulation_launch.py headless:=True (timeout 300): world not loaded (Fuel 502 for Depot), create waits, spawn UNVERIFIED
6b73d44 B4 tb4 lidar under headless EGL with the ogre (OGRE 1) engine: still invalid, every range = range_min
c82809b M1 lite6: recapture with the collision search over the group's joints (4fbb6e8); previous capture kept as moveit_attempt2_collision_case_not_run
7888b6a M1 gen3: recapture with the collision protocol (16d8d66, 4fbb6e8); earlier capture kept as moveit_attempt3_collision_box_0.2m
8ce04f4 M1 wx250s (ROS2LAB-PORT, fake hardware): recapture with the collision protocol (16d8d66, 4fbb6e8); earlier capture kept as moveit_attempt3_collision_box_0.2m
f8000c5 M1 fr3: recapture with the collision protocol (16d8d66, 4fbb6e8); earlier capture kept as moveit_attempt2_collision_box_0.2m
f8b64fe M1 cr5: recapture with the collision protocol (16d8d66, 4fbb6e8); earlier capture kept as moveit_attempt1_collision_box_0.2m
245844b B4 tools: tb4 headless launch with the ogre render engine for the server sensors, scenario p2c_scan_ogre, scan_probe.py
2a005bf capture_tb4_nav2_bringup.sh: real nav2_bringup tb4_simulation_launch.py headless:=True under timeout 300 (spawn, errors, lifecycle)
73394bc M1 lite6: recapture with the collision protocol of 16d8d66 (collision case not run); earlier capture kept as moveit_attempt1_collision_box_0.2m
4fbb6e8 moveit_capture.py collision case: try the next joints of the group when the first joint leaves the EE in the box
cea7588 M1 xarm6: recapture with the collision protocol of 16d8d66; earlier capture kept as moveit_attempt2_collision_box_0.2m
02f518a M1 ur5e: recapture with the collision protocol of 16d8d66; earlier capture kept as moveit_attempt2_collision_box_0.2m
```

### Totals (parity/reports/fixture_parity.md, TB3 fixture suites)
PASS 500 · FAIL 180 · PENDING (PENDING-THRESHOLD) 10 · NOT-VALIDATED 53 — unchanged by tonight's fixes.
Site-wide: every non-TB3 robot is now labelled "Not yet validated against real ROS 2" (no fixture suite).

### Owner must do
1. Review and push both branches (nothing was pushed or deployed). Deploy the site with
   `firebase deploy --only hosting` when satisfied (rviz-page.js, real-launch.js, ros-graph.js, nav2-sim.js,
   sim-catalog.js, ws/index.json changed).
2. gen3 M1: cause of -26 START_STATE_INVALID from the collision case on is UNVERIFIED; it needs move_group logs
   (the maker's sim.launch.py sets --log-level fatal). Decide whether a capture with a higher log level is allowed.
3. tb4: no rendering mode here gives a valid lidar at a usable speed (EGL ogre2 and ogre: all range_min; xvfb: RTF
   0.0049). Options: a GPU / another machine, or accept xvfb runs of several hours. SLAM / nav ground truth BLOCKED.
4. B5: rerun `parity/scripts/capture_tb4_nav2_bringup.sh 47 ref47 <out>` when fuel.gazebosim.org serves the Depot
   model (HTTP 502 tonight), or pre-fill the Fuel cache, to answer whether create spawns the TB4.
5. Site shell: `export X=1 && ros2 launch ...` ran and printed nothing (bash exports and launches). **FIXED** in 3b6b724 (2026-10-19, follow-up session): the && / ; chain now hands the launch job on. Evidence: parity/e2e/shell-chain-launch.spec.ts 5/5 passed (export &&, source &&, cd &&, cd /nonexistent && gives the cd error and starts nothing, export ;); vitest 38/38; tests/real-tb3.mjs 7 ok, 0 FAIL.
6. Earlier open decision still open: initial-pose timeout on sim time (expert_review_2026-10-18 "Left").
7. moveit_capture.py crashes (KeyError) when /joint_states is empty; harmless tonight, fix before the next M-run.
8. Instructor: MoveIt must-fix list (M2) now has real error-code fixtures for 7 arms on robots-p2b.
