# TurtleBot3 focus, Night 2 report (2026-10-24)

Branch `tb3-night2`, made from master `13f61f2` because master already contained all of `tb3-focus`. Not pushed, not
merged into master. Nothing deployed; no sudo or apt; `content/course-content.json` and Firestore untouched; lesson-task
detection, test scoring and progress saving untouched. Real ROS 2 Jazzy + Gazebo Harmonic on this PC is the reference.
Real simulations ran one at a time, each on its own domain (61 Nav2 / world / cmd_vel / error captures, 50 physics, 62
RViz), each stopped with `parity/scripts/stop_reference.sh`. Progress log and resume commands: `docs/tb3/PROGRESS.md`.

## Headline finding: Fast DDS vs Cyclone DDS

This PC's `~/.bashrc` exports `RMW_IMPLEMENTATION=rmw_cyclonedds_cpp`. The old fixtures were captured with Fast DDS
(endpoint GIDs `01.0f...`, the eProsima vendor id), Night 1's captures with Cyclone DDS (`01.10...`). Under Cyclone,
`ros2 topic info -v` reports other QoS for some endpoints (published_footprint and the collision polygons VOLATILE
instead of TRANSIENT_LOCAL; several subscriptions RELIABLE instead of BEST_EFFORT). That, not the Nav2 version, caused
Night 1's 84 "stale fixture / version" items: after the owner's apt upgrade (same package versions as the old fixtures),
a Cyclone capture still disagreed on exactly those endpoints, and a Fast DDS capture equals the old burger fixture
topic for topic and endpoint for endpoint. `parity/scripts/env.sh` and `run_physics.sh` now pin
`RMW_IMPLEMENTATION=rmw_fastrtps_cpp` (Jazzy's default and the site's default; `REF_RMW=` overrides), and
`start_reference.sh` writes `rmw=` into every run_info.txt (commit b9e515e). Cyclone evidence:
`parity/fixtures/tb3_jazzy_v3/rmw_cyclonedds_evidence/`.

## Parts

| Part | State | Notes |
|---|---|---|
| 0 baseline and versions | **done** | versions re-recorded, diff in the fixtures README; baseline night2_before |
| 1 re-capture | **done** | 7 Nav2 / world captures, physics (10 cases x 3), SUMMARY, triage, TB3_MOTION_NIGHT2. First attempt was Cyclone DDS; stopped and redone with Fast DDS (above) |
| 2 Nav2 graph | **done** | 8 family commits; nav_robotis FAIL burger 56 -> 0, waffle 49 -> 0, waffle_pi 42 -> 0 |
| 3 cmd_vel chain, turtlebot3_drive | **done** | chain exact (endpoints, counts, 10 / 20 / 20 Hz, top speed 0.30 m/s); drive model as captured |
| 4 error codes | **done** (durations differ) | 4 cases captured and matched on status, error_code, error_msg, recovery sequence, log lines |
| 5 RViz | **done** | 3 configs captured with real rviz2 and matched item for item; screenshots side by side |
| 6 home strip, leftovers | **done** | strip = tb3_burger, tb3_waffle_pi, ur5e; 0 UNRESOLVED |
| 7 tests and report | **done** | suites below |

## Part 0: versions

`parity/fixtures/tb3_jazzy_v3/README.md` (Night 2 section), `versions.txt`, `version_diff_night1_vs_night2.txt` (556
`ros-jazzy-*` packages changed), `version_diff_vs_old_fixtures_night2.txt`.

| What | Night 1 | Night 2 | old fixtures |
|---|---|---|---|
| gz sim | 8.10.0 | **8.15.0** | 8.15.0 |
| nav2_* (all but bringup / route / docking) | 1.3.10 | **1.3.13** | 1.3.13 |
| ros_gz_bridge / sim / image | 1.0.18 / 1.0.16 / 1.0.16 | **1.0.24** | 1.0.24 |
| rclcpp / ros2cli / launch | 28.1.13 / 0.32.6 / 3.4.9 | 28.1.22 / 0.32.13 / 3.4.12 | same as Night 2 |
| turtlebot3 packages, slam_toolbox, cartographer | unchanged | unchanged | |

Every `ros-jazzy-*` package installed on both machines now has the old fixtures' version; the 94 remaining rows are
packages installed on only one machine (none TurtleBot3 / Nav2 / SLAM / Gazebo / ros_gz).

## Part 1: re-capture

- `capture_queue.sh "tb3_burger:nav:pose tb3_burger:nav:nopose tb3_waffle_pi:nav:pose tb3_waffle_pi:nav:nopose tb3_waffle:nav:pose tb3_burger:world:- tb3_waffle_pi:world:-"` (Fast DDS, commit 26602b1). Not in the list and therefore still Night 1 / Cyclone:
  `tb3_waffle/nav_nopose`, `tb3_waffle/world`, `tb3_burger_cam/world` (SUMMARY.md has a provenance table).
- No-pose bring-up aborts after 60.1 s (burger) / 60.5 s (waffle_pi) of sim time, as on Night 1.
- **Stale items:** the 84 became 42; burger 16 -> **0**. The 42 left (waffle 27, waffle_pi 15) are capture gaps of the old
  `session_goal1/snapshot` (25 / 26 "Unknown topic" files): 40 endpoints the old snapshot lacks and 2 `_NODE_NAME_UNKNOWN_`
  discovery artifacts. The Night 2 captures are strict supersets of those snapshots.
- **Physics** (`run_physics.sh`, 399c5f6; `parity/reports/TB3_MOTION_NIGHT2.md`, 84b264c): 0 of 30 real quantities moved
  between gz-sim 8.10 and 8.15.0. Site vs real Night 2: 23 MATCH / 7 APPROXIMATED (Night 1: 24 / 6). The new
  APPROXIMATED row is tb3_stop's ground-truth stop distance: the three real runs now vary 0.004 - 0.018 m (mean 0.010),
  the site 0.023. Night 1's runs were bit-identical; Night 2's tb3_stop / tb3_fast / tb3_spin_fast runs are not.

## Part 2: Nav2 graph (TB3 navigation2.launch.py profile)

Triage before (`parity/reports/TB3_GRAPH_TRIAGE.md`, site before Part 2, Fast DDS REAL-NEW) and after
(`TB3_GRAPH_TRIAGE_AFTER.md`):

| | site-missing | site-extra | wrong type | stale fixture |
|---|---|---|---|---|
| before (all robots) | 341 | 25 | 0 | 42 |
| after Part 2 | 0 | 0 | 0 | 42 (old waffle snapshot gaps; the site equals the new capture on every one) |

Family commits, each followed by a burger nav_robotis run (FAIL rows):

| Commit | Family | burger FAIL |
|---|---|---|
| baseline | | 56 |
| f809c99 | costmap layer topics (`<layer>`, `_raw`, `_updates`, `_raw_updates`; `voxel_grid` and `clearing_endpoints` on the costmap namespace) and costmap subscribers | 27 |
| c685b95 | docking_server (cmd_vel, docking_trajectory; dock_pose, filtered_dock_pose, staging_pose; battery_state / detected_dock_pose from the dock plugin's parameters) | 23 |
| bc3be34 | route_server (plan, route_graph, speed_limit) | 20 |
| 97f0d70 | bt_navigator `*_rclcpp_node` nodes (behavior_tree_log, selectors) | 19 |
| bc5ddef | tf2 listeners on amcl, behavior_server, bt_navigator, collision_monitor, docking_server, route_server, smoother_server | 17 |
| b18377a | RViz Nav2 panels (Selector -> 5 selector topics; Navigation 2 -> rviz_navigation_dialog_action_client) and disabled displays stay disabled | 7 |
| 898f761 | lifecycle managers (/diagnostics, /bond) | 5 |
| c7ba542 | others (assisted_teleop subscriptions, collision_points_marker, component container) | 0 |

Per-family counts were measured for burger, as the task asked. After the families: waffle 5, waffle_pi 6 FAIL rows
against the old snapshots, all old-snapshot gaps (triage after). Commit 2cbcb7f compares waffle / waffle_pi's graph with
the complete Night 2 capture (same versions, same RMW) and treats the capture's own probe node as a tool node:
**nav_robotis FAIL burger 0, waffle 0, waffle_pi 0** (Night 1: 56 / 49 / 42). The stock nav2_bringup profile was not
changed separately; its fixtures and spec stay as they were (shared Nav2 models, see the suites below).

## Part 3: /cmd_vel chain and turtlebot3_drive

Real capture `parity/fixtures/tb3_jazzy_v3/tb3_burger/nav_cmdvel/` (goal (0.5, 1.45), RTF 0.834):
- /cmd_vel_nav: controller_server + **5 behavior_server publishers** (one per behavior plugin), sub velocity_smoother;
  /cmd_vel_smoothed: velocity_smoother -> collision_monitor; /cmd_vel: collision_monitor + docking_server -> ros_gz_bridge;
  all TwistStamped, RELIABLE / VOLATILE.
- Rates 10.00 / 20.00 / 19.40 Hz **wall** at RTF 0.834: controller and smoother are wall timers.
- Top speed 0.300 m/s on all three topics (DWB `max_vel_x 0.3`, not the smoother's 0.5); odom peaks 0.301.

Site (spec `parity/e2e/tb3-cmdvel-chain.spec.ts`, f44d837): endpoints, types and counts equal the capture; 10.00 / 20.00 /
20.00 Hz per second of the site's simulation clock; top speed 0.300 on all three, odom 0.300. Before the fix the smoother
dropped to 10 Hz when the page stepped 0.1 s and /cmd_vel_nav showed 2 publishers (red run kept in the commit message).
Headless test pages run at RTF ~0.3, so the spec compares per sim second; the site's timers follow the sim clock.

turtlebot3_drive (0366042, spec `tb3-drive.spec.ts`): node `turtlebot3_drive_node`, upstream state machine (10 ms wall
timer, scan at 0 / 30 / 330 deg, odom yaw), publishes `geometry_msgs/msg/Twist`; the TurtleBot3 bridge takes
TwistStamped, so the robot does not move (real: 0.000 m; site < 0.005 m); `ros2 topic info -v /cmd_vel` prints
`Type: ['geometry_msgs/msg/Twist', 'geometry_msgs/msg/TwistStamped']` with the same nodes; Ctrl+C prints the
"terminated" line. Red without the model, green with it.

## Part 4: Nav2 result error codes (burger, TB3 profile)

Capture `parity/fixtures/tb3_jazzy_v3/tb3_burger/nav_errors/` (`capture_errors.sh`, `ros2 action send_goal`, a goal back
to the spawn pose between cases), `error_code_names = ['follow_path_error_code', 'compute_path_error_code']`:

| Case | Real | Site (nav-errors.spec.ts) | Real sim s | Site sim s |
|---|---|---|---|---|
| outside the map (12, 12) | ABORTED, 204, `''`; "Goal Coordinates of(12.000000, 12.000000) was outside bounds", no recovery | same | 0.96 | 0.6 |
| inside the central cylinder (0, 0) | SUCCEEDED, 0 (NavFn tolerance 0.5) | same | 21.4 | 12.0 |
| unreachable, outside the wall (3.5, 0) | ABORTED, 208, `''`; recoveries clear, spin, wait, backup, clear, spin | same | 18.5 | 11.3 |
| blocked (static box ring around the robot) | ABORTED, 208, `''`; clear, spin, wait, backup "Collision Ahead - Exiting DriveOnHeading" / "backup failed" / "[backup] [ActionServer] Aborting handle.", clear, spin, wait | same | 24.7 | 14.4 |

Status, error_code, error_msg, the recovery sequence and the set of bt_navigator / planner_server / controller_server /
behavior_server log lines match in all four cases. Fixes: 2c9fb59 (a static model spawned with `create` is a fixed world
object; before, the box ring was a kinematic "robot" the lidar could not see and the goal SUCCEEDED), 48d4074 (recovery
round-robin restarts per goal; failed behaviors print the action server abort; behaviors check the footprint cost; NavFn
falls back to the closest reachable point within tolerance). **Durations differ** (site 35 - 45 % shorter in sim time);
they are recorded in `parity/browser_out/tb3_night2/nav_errors.json` and stay "Not yet validated" (no threshold exists).
Not captured, so not validated: controller failures (follow_path error codes), spin / drive_on_heading failures,
NavigateThroughPoses.

## Part 5: RViz for TurtleBot3

Real: `parity/fixtures/tb3_jazzy_v3/rviz/<name>/` (`capture_rviz_configs.sh`: rviz2 on Xvfb, screenshot, Ctrl+S saved
config, stdout). tb3_navigation2.rviz needs Nav2 running: its Selector panel blocks the window while controller_server /
planner_server / smoother_server do not answer (`rviz2_stdout_alone.txt`); it also places its window at X 2630.

| Config | items (real) | site before | site after (1ae83fe) |
|---|---|---|---|
| tb3_navigation2.rviz | 250 | 18 missing / 2 extra after the first structural fixes; before them groups flattened, RobotModel forced on, Odometry/Grid flattened | 0 / 0 |
| tb3_cartographer.rviz | 194 | RobotModel added (not in the file), groups flattened, Map update QoS missing | 0 / 0 |
| model.rviz | 66 | default tools and view name instead of the file's, Odometry colour from Covariance | 0 / 0 |

Items: global options, every display (group path, class, name, enabled, topic and QoS, key properties), tools (class,
topic), panels (class, name), current view (class, value, scalars). Visible fixes (ca26ffb): RobotModel unchecked / absent
as in the file, no Realsense image panel (its group is disabled), no Time panel when the file has none, Odometry arrows in
their configured colour. Screenshots: `parity/browser_out/tb3_night2/rviz/*.site.png` next to the real ones. The Selector
and Docking panels show the site's honest "not modelled" note.

## Part 6: home strip and leftovers

Home strip = tb3_burger, tb3_waffle_pi, ur5e (9502794); `tests/robot-status.test.mjs` checks every strip link is active
(376 ok; 6 FAIL on the old strip). COURSE_ROBOT_REFERENCES re-generated with the owner decisions (bee0b84): 0 UNRESOLVED,
34 lines resolved (UR5 = ur5e, Panda a mention, TurtleBot3 without a model = the missing-TURTLEBOT3_MODEL error),
quadcopter active. ui-home all ok.

## Part 7: tests

`bash parity/scripts/tb3_v3/run_suites.sh night2_after` (git 741dfc9, 10:04 - 11:26). Summary files:
`docs/tb3/tests/night2_before.txt`, `night2_after.txt`; per-test lists `night2_{before,after}_parity_{pass,fail}.txt`;
logs `parity/browser_out/tb3_night1/night2_{before,after}/`.

| Suite | night2_before (10e1739) | night2_after (741dfc9) |
|---|---|---|
| security | pass | pass |
| lessons66 | 66 of 66 tasks ticked | 66 of 66 tasks ticked |
| lessons45 (turtlesim) | 282 of 282 | 282 of 282 |
| ui-chrome | all checks passed | all checks passed |
| ui-home | all ok | all ok |
| ui-sim | ALL OK | ALL OK |
| ui-portal | all ok (the 1 "FAIL-line" is the passing check `ok tests-failed: ...`) | all ok (same line) |
| ui-student | all ok | all ok |
| ui-member | all passed | all passed |
| ui-review | all passed | all passed |
| ui-widths | all passed | all passed |
| parity | 126 passed / 6 failed | **135 passed / 3 failed** |

Lesson counts did not drop. Every parity test that passed in night2_before passes in night2_after (the one name
missing from the after list, "no initial pose -> navigation bringup aborts", is the same test moved from line 137 to 143
of nav_robotis.spec.ts; it passes).

**New passes (10):** nav_robotis initial pose / graph / params / cmd_vel / goals for tb3_burger, tb3_waffle,
tb3_waffle_pi (Part 2); tb3-drive (Part 3); tb3-cmdvel-chain (Part 3); nav-errors (Part 4); tb3-rviz-configs x3
(tb3_navigation2.rviz, tb3_cartographer.rviz, model.rviz; Part 5).

**New failures: none.** The 3 still failing were failing before with exactly the same 33 check lines (diffed):
`nav2_bringup` graph (tb3_simulation_launch.py: both lifecycle managers active, topics + types, /cmd_vel type),
`nav2_bringup matrix` (25 planner x controller goal1 statuses) and `matrix_dwb_burger` (5). They are the stock
nav2_bringup profile, not worked on tonight (Night 3 item 3).

Outside the gate: `tests/nav2-node.mjs` "no collision" fails, and it fails on master 13f61f2 too (checked out and run
before any Night 2 change); not caused or fixed tonight.

### Commits (master..tb3-night2, oldest first)

- `10e1739` tb3 night 2 part 0: versions after the owner's apt upgrade (Nav2 1.3.13, gz-sim 8.15.0, ros_gz 1.0.24: same as the old fixtures)
- `4d4cbf3` tb3 night 2 part 0: baseline before any site change (lessons 66/66, turtlesim lessons 282/282, UI suites and security pass, parity 126 passed / 6 known fails; nav_robotis FAIL 56/49/42)
- `9502794` Home page robot strip: only the active course robots (tb3_burger, tb3_waffle_pi, ur5e), owner decision; robot-status test checks every strip link is active
- `bee0b84` tb3 night 2 part 6: COURSE_ROBOT_REFERENCES with the owner's decisions (UR5 = ur5e, Panda a mention, TurtleBot3 without a model = the missing-TURTLEBOT3_MODEL error, quadcopter active): 0 UNRESOLVED
- `b9e515e` Reference scripts: pin RMW_IMPLEMENTATION=rmw_fastrtps_cpp (Jazzy default; this PC's ~/.bashrc exports Cyclone DDS, which made Night 1's QoS captures disagree with the old Fast DDS fixtures); run_info records the RMW
- `6e96f78` tb3 night 2 tooling: cmd_vel chain and Nav2 error-code capture scripts, node-centric endpoint and FAIL-row listers, triage script takes the FAIL-row folder and explains the RMW finding
- `26602b1` tb3 night 2 part 1: real captures with the upgraded packages and Fast DDS (navigation2.launch.py burger / waffle_pi / waffle with and without initial pose, world: burger, waffle_pi); Cyclone DDS burger capture kept as evidence
- `bb6581a` tb3 night 2 part 1: SUMMARY.md (capture provenance with RMW) and TB3_GRAPH_TRIAGE against the Fast DDS re-capture: stale fixture 84 -> 42 (burger 16 -> 0; the 42 left are capture gaps of the old waffle / waffle_pi snapshots)
- `f809c99` Nav2 graph, costmap family: every static / obstacle / voxel layer publishes <layer>, _raw, _updates, _raw_updates; voxel_grid and clearing_endpoints on the costmap namespace (not <layer>/voxel_grid); costmap subscribers as captured (behavior_server local only, smoother_server and route_server global, docking_server local, with _updates) (nav_robotis tb3_burger FAIL: 27)
- `c685b95` Nav2 graph, docking_server: cmd_vel and docking_trajectory; SimpleChargingDock dock_pose, filtered_dock_pose, staging_pose, battery_state (use_battery_status), detected_dock_pose only with use_external_detection_pose (nav_robotis tb3_burger FAIL: 23)
- `bc3be34` Nav2 graph, route_server: publishes plan, route_graph (transient local) and speed_limit (nav_robotis tb3_burger FAIL: 20)
- `97f0d70` Nav2 graph, bt_navigator: the two <navigator>_rclcpp_node nodes made on configure publish behavior_tree_log and subscribe controller_selector / planner_selector (transient local) (nav_robotis tb3_burger FAIL: 19)
- `bc5ddef` Nav2 graph, tf2 listeners: amcl, behavior_server, bt_navigator, collision_monitor, docking_server, route_server, smoother_server subscribe /tf and /tf_static on the node itself (nav_robotis tb3_burger FAIL: 17)
- `b18377a` RViz Nav2 panels: the Selector panel makes rviz2 publish the five *_selector topics, the Navigation 2 panel adds rviz_navigation_dialog_action_client (/waypoints); a type-level display switch no longer enables a .rviz display that the file disables (Trajectories /marker, global Polygon) (nav_robotis tb3_burger FAIL: 7)
- `898f761` Nav2 graph, lifecycle managers: /diagnostics from the start, /bond published and subscribed while they hold bonds (nav_robotis tb3_burger FAIL: 5)
- `c7ba542` Nav2 graph, others: behavior_server's AssistedTeleop subscribes cmd_vel_teleop / preempt_teleop (best effort), collision_monitor publishes ~/collision_points_marker, the component container has no parameter services or parameter-event publisher (nav_robotis tb3_burger FAIL: 0)
- `399c5f6` tb3 night 2 part 1: TurtleBot3 motion re-captured with gz-sim 8.15.0 and Fast DDS (run_physics.sh, 10 cases x 3 runs)
- `84b264c` tb3 night 2 part 1: TB3_MOTION_NIGHT2 (real Night 1 vs Night 2 vs site: 0 of 30 real quantities moved; site 23 MATCH / 7 APPROXIMATED, tb3_stop new: the real runs now vary 0.004-0.018 m)
- `0a8ac8c` tb3 night 2 parts 3/4: real captures of the Nav2 velocity chain during a goal (values, rates, top speed 0.30 m/s) and of Nav2 result error codes (outside the map 204, in the central cylinder SUCCEEDED, unreachable 208, blocked 208)
- `1d0fe5f` tb3 night 2 part 5: real rviz2 with tb3_navigation2.rviz (Nav2 running), tb3_cartographer.rviz, model.rviz: screenshots, saved configs, stdout (the Selector panel blocks the window while Nav2 is not running)
- `0366042` turtlebot3_drive model: turtlebot3_drive_node runs the upstream state machine and publishes Twist on cmd_vel; the Jazzy TurtleBot3 bridge takes TwistStamped, so the robot stays (as captured); topic info -v shows both types; Ctrl+C prints the terminated line. Spec tb3-drive.spec.ts (red before, green after)
- `2cbcb7f` nav_robotis spec: tb3_waffle / tb3_waffle_pi graph against the complete Night 2 capture (the old session_goal1 snapshots miss 25 / 26 topics; TB3_GRAPH_TRIAGE_AFTER: their 42 remaining items are all old-snapshot gaps where the site equals the new capture); capture probe nodes are tool nodes. nav_robotis FAIL: burger 0, waffle 0, waffle_pi 0
- `f44d837` Nav2 velocity chain as captured: one cmd_vel publisher per behavior plugin (/cmd_vel_nav has 6 publishers), ros2 node info lists a topic once, velocity_smoother keeps its fixed 20 Hz schedule when a page step is 0.1 s; spec tb3-cmdvel-chain.spec.ts (endpoints, counts, 10/20/20 Hz, top speed 0.300 m/s; red before, green after)
- `bfb2b3a` docs: tb3 night 2 progress (parts 0-3, 6)
- `2c9fb59` ros_gz_sim create: a static SDF model without joints, plugins or sensors becomes a fixed world object (lidar, costmaps and robots meet it, the 3D view shows it), as Gazebo treats it; it used to become a kinematic robot nothing could see
- `48d4074` Nav2 failures as captured: recovery round-robin restarts per goal, a failed behavior aborts its action goal, behaviors check the footprint cost (Collision Ahead), NavFn falls back to the closest reachable point within tolerance when the goal is unreachable (nav_errors: outside map 204, in obstacle SUCCEEDED, unreachable 208, blocked 208)
- `727d699` Spec nav-errors.spec.ts: Nav2 result error codes against the real capture (status, error_code, error_msg, recovery sequence, Nav2 log lines; durations recorded)
- `ca26ffb` RViz loads and saves the TurtleBot3 configs like rviz2: no RobotModel added or enabled beyond the file, displays in a disabled Group draw nothing, the Time panel only when the file lists it, nested properties read first (Odometry arrow colour from Shape, not Covariance), Save Config keeps Group nesting, the file's Tools, Panels and view name, nested Line Style / Shape maps and the Map Update Topic QoS; Path has Line Width
- `1ae83fe` Spec tb3-rviz-configs.spec.ts: tb3_navigation2.rviz, tb3_cartographer.rviz, model.rviz on the site against real rviz2's saved configs (displays, groups, topics and QoS, key properties, tools, panels, view, fixed frame; red before, green after)
- `741dfc9` docs: tb3 night 2 progress (parts 3-5)
- (this commit) docs: tb3 night 2 report

## Night 3 should start with

1. **Nav2 timing**: goal and failure durations (error cases 35 - 45 % shorter on the site; the 5-goal suite timing), then
   AMCL and costmap behaviour (convergence, update rates, clearing), SLAM map growth (Cartographer, slam_toolbox).
2. Then the Nav2 extensions: MPPI, RPP, Smac, collision monitor (polygons, approach), waypoint follower.
3. Re-capture what is still Night 1 / Cyclone: `tb3_waffle/nav_nopose`, `tb3_waffle/world`, `tb3_burger_cam/world`; the
   stock nav2_bringup profile with Fast DDS and its triage.
4. tb3_stop: the real runs are no longer bit-identical (0.004 - 0.018 m); decide the tolerance from the spread.
5. Spawned models: a dynamic plugin-less SDF model is still a kinematic "robot" on the site (only static ones became world
   objects tonight); `tests/nav2-node.mjs` "no collision" fails on master already (burger brushes a pillar).
