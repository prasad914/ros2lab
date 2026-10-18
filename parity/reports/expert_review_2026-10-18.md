# Expert review of the parity-fixes preview – 2026-10-18

Three independent reviewers (Nav2 expert, perception/SLAM expert, robotics educator) drove the `parity-fixes`
branch (commit b80c0e4) in a real browser (Playwright + Chromium) and compared it with the real-ROS fixtures in
`parity/fixtures/`. Items marked **EXPERT JUDGMENT** have no fixture behind them yet. Raw site output from the
review is not in the repo; every claim below names the fixture or site file to re-check it.

Coverage: navigation and SLAM were driven on **tb3_burger** only (waffle / waffle_pi checked for sensors, TF and the
page itself). RViz panel clicks were not covered. Simulation ran slowly (shared machine), so nothing timed in wall
seconds was judged.

## Verdict

| Reviewer | Verdict |
|---|---|
| Nav2 expert | yes, with caveats |
| Perception / SLAM expert | yes, with caveats |
| Robotics educator (student view) | **not yet** – must-fix list below |

**Overall: do not go live yet.** The ROS graph itself (topics, types, nodes, QoS, TF, the initial-pose trap,
outside-map error 204) is faithful. But there is one regression (waffle_pi page broken), two places that give
students fake rewards or fake results (placeholder mission games; obstacle goals), and several beginner mistakes
that real ROS catches but the site does not.

## Must fix before going live

1. **waffle_pi page is broken (regression).** Terminal shows `official workspace … could not load: Cannot read
   properties of undefined (reading 'replace')`; robot card reads `undefined`; command list empty; 404s for its
   picture and base mesh. Cause found: `tb3_waffle_pi` has no `about` field in `public/robots/index.json` (hand-edited
   in step G). Re-run the waffle_pi fixture tests after the fix.
2. **Mission games are a placeholder.** All 15 robot games load `paths.js` (the `cd` folder game). On burger, unlocked
   "TF Detective", "Mapping Race", "Kidnapped Robot" ask to "Type a cd command that takes Chiku to the station…", and
   award badges such as "Cartographer" without any SLAM. Lock them with "Not yet validated" until real games exist.
3. **Forgetting `export TURTLEBOT3_MODEL` does not fail.** Site still spawns the robot. Real launch reads
   `os.environ['TURTLEBOT3_MODEL']` (`parity/fixtures/_installed/turtlebot3_gazebo/launch/robot_state_publisher.launch.py:30`),
   so it aborts with a KeyError. Capture the real error text first, then reproduce it + a short hint.
4. **Goals on/next to an obstacle always fail on the site.** `obstacle_goal` (1.893, 0.43) and cylinder centre
   (2.0, 0.5) end ABORTED error_code 208 after the full recovery cycle. Real: SUCCEEDED, error_code 0
   (`tb3_burger/nav_robotis/session_obstacle_goal/goal_obstacle_goal/result.json`,
   `session_failure_cases/goal_cylinder_centre/result.json`). Cause: `public/js/nav2-core.js:292` returns 208 when the
   goal cell is inflated/lethal, before the planner's 0.5 m tolerance search. Also check the error text
   "GridBased: failed to create plan with tolerance of: 0.500000" against a real log (EXPERT JUDGMENT: real text has
   no "GridBased:" inside the quotes).
5. **Wrong `map:=` path → Nav2 launch hangs silently (>127 s, no output).** The page's own `map:=$HOME/map.yaml`
   button does this before a map is saved. Capture the real map_server error for a missing file, then reproduce it.
6. **`nav2_bringup tb3_simulation_launch.py` shows a fake Nav2 failure** ("Failed to activate local_costmap … base_link
   to odom", "Aborting bringup") while real reached READY in all 25 matrix runs. Until it is modelled, print an honest
   "this launch is not simulated on ROS2Lab yet" note and lock/label it – never a fake real-looking error.
7. **Course teleop instructions don't work on Jazzy TurtleBot3.** Week 2 (Day 10) and Week 9 tell students to run plain
   `teleop_twist_keyboard`; `/cmd_vel` is `geometry_msgs/msg/TwistStamped`
   (`tb3_burger/sensors/topic_list.txt`). Week 9 also mentions UI that no longer exists ("Gazebo simulation", "Type
   these commands for me", `sim.launch.py`). Capture what the real teleop commands publish, then fix the text.
   Related: `ros2 topic info /cmd_vel -v` on the site lists plain teleop as TwistStamped although its `stamped`
   parameter is False – it hides exactly the mismatch students should discover.

## Should fix (Medium)

- **Initial-pose timeout runs on the wall clock** (`public/js/nav2-sim.js:343-346`); real counts sim time
  (≈57.6 s sim / 98 s wall, `readiness_deadlock_2026-10-17/excerpt.txt`). On slow laptops students get only 60 wall s.
- **Saved SLAM map is fake:** fixed 8×8 m grid at (-4, -4) → 210×201 for both mappers; real
  `tb3_burger/slam/samples/map.yaml` 112×103 at (-0.945, -2.084), Cartographer (-1.227, -2.421). Saved `map.pgm` is a
  31-byte placeholder. Fix, or label "map contents are illustrative".
- **slam_toolbox parameter types:** site prints `Integer value is: 20` / `5`; real `max_laser_range: 20.0`,
  `map_update_interval: 5.0` (doubles) – `tb3_burger/slam/params/slam_toolbox.yaml`.
- **`/scan` ranges rounded to 0.015 m steps;** real values are continuous (`tb3_burger/sensors/samples/scan.yaml`).
  First `/scan` after spawn is all `.inf` for ~3 s. `--full-length` is ignored.
- **`ros2 topic hz /map` under slam_toolbox reports nothing** while `echo --once /map` returns a map
  (EXPERT JUDGMENT; capture real `hz` to confirm).
- **view_frames .gv lacks** Average rate / Buffer length / Most recent transform; file name always
  `frames_2026-10-12_09.30.00`.
- **AMCL `/particle_cloud` cut to 128 particles** (`nav2-sim.js:1068`); real max_particles 2000, min 500.
- **collision_monitor logs missing:** real prints 121–210 "Robot to stop due to invalid source" per run plus setup lines.
- **Playground locks:** no lock icons / "Not yet validated" text; intro still says "Six small games"; Teleop Time Trial
  locked on NAV (doesn't need it); Kidnapped Robot / Mapping Race unlock on lifecycle+graph checks only; waffle NAV
  passes with no goal results.
- **RViz pages:** no "Not yet validated" labels on house/empty worlds, Nav2 or real-hardware commands.
- **Camera hint on burger** says "Check the spelling" – should say burger has no camera.
- **Shell:** `;` does not separate commands (`echo a ; echo b` prints `a ; echo b`).

## Low

docking_server missing as 2nd `/cmd_vel` publisher; voxel topic name `/global_costmap/voxel_layer/voxel_grid` vs
real `/global_costmap/voxel_grid`; topic sort order and shortened type hash; missing one-time controller warnings; stray
`amcl` line after `topic pub --once`; `ros2 lifecycle nodes` not sorted; Cartographer map→odom z = 0 (real -0.078);
`map_load_time` 4 s (real 0); a few missing services/params (`get_interactive_markers`, `/tf2_frames`,
`/rviz2/reset_time`, `qos_overrides`); made-up cartographer lifecycle error (real ros2cli: "Node not found");
`enable_stamped_cmd_vel` "Parameter not set." (real "Boolean value is: False"); phone: playground/resources 8 px too
wide, header covers terminal title, split panes ~150 px, some buttons < 44 px.

## Confirmed faithful (matches fixtures)

Topics/types, nodes and sensor QoS for all three models; burger has no camera; waffle/waffle_pi camera size, K and
frame; `/scan` frame, angles, 360 samples; TF trees incl. waffle depth frames, no `map` before SLAM; slam_toolbox
`/map` + `/map_metadata` TRANSIENT_LOCAL and no `/map_updates`; Cartographer `/map_updates` with 0 publishers;
no-initial-pose abort (same three ERROR lines, all 10 node states); map→odom within 2 cm after localization; goal1 and
goal3 SUCCEEDED with real-like time and error; outside-map goal ABORTED 204, empty error_msg, same four log lines and
levels; `/cmd_vel` TwistStamped (navigation2.launch.py) vs Twist (nav2_bringup); package/launch typos and
not-sourcing give real-style errors with good hints; publishing Twist on `/cmd_vel` gives an excellent mismatch hint;
no page errors on main pages.

## Not covered

RViz panel clicks; Nav2 on waffle / waffle_pi; IMU `frame_id` (`burger/imu_link/tb3_imu` on the site – plausible, but
no `imu.yaml` fixture; capture one).
