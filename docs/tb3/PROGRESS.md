# TurtleBot3 focus: progress (Night 2, 2026-10-24)

Branch `tb3-night2` (from master `13f61f2`, which already contained all of tb3-focus). Never pushed, never merged into
master. Night 1: `docs/tb3/NIGHT1_REPORT.md`. Night 2 report: `docs/tb3/NIGHT2_REPORT.md` (written in Part 7).

## Done
- **Part 0** versions after the owner's `sudo apt upgrade` (Nav2 1.3.13, gz-sim 8.15.0, ros_gz 1.0.24: now the same as
  the old fixtures; `parity/fixtures/tb3_jazzy_v3/README.md`), commit 10e1739. Baseline `night2_before` (4d4cbf3):
  lessons 66/66, turtlesim lessons 282/282, UI suites and security pass, parity 126 passed / 6 known fails
  (nav_robotis x3, nav2_bringup graph, matrix, matrix_dwb_burger); Night 1's fix 9eb95b7 holds in the full run.
- **Finding (Part 1):** this PC's `~/.bashrc` exports `RMW_IMPLEMENTATION=rmw_cyclonedds_cpp`. The old fixtures were
  Fast DDS (GIDs `01.0f...`), Night 1's captures Cyclone (`01.10...`). Under Cyclone, `ros2 topic info -v` reports other
  QoS for some endpoints; that, not the Nav2 version, made the 84 "stale fixture / version" items. `parity/scripts/env.sh`
  (and `run_physics.sh`) now pin `RMW_IMPLEMENTATION=rmw_fastrtps_cpp` (Jazzy's default, the site's default; `REF_RMW`
  overrides); `start_reference.sh` records `rmw=` in run_info.txt. With Fast DDS the new burger Nav2 capture is identical
  to the old fixture (every topic, every endpoint QoS). Cyclone evidence kept in
  `parity/fixtures/tb3_jazzy_v3/rmw_cyclonedds_evidence/`.
- **Part 6** home strip (9502794), COURSE_ROBOT_REFERENCES with the owner decisions, 0 UNRESOLVED (bee0b84);
  robot-status 376 ok, ui-home all ok.

- **Part 1** re-captures with Fast DDS (26602b1), physics (399c5f6), SUMMARY + triage before (bb6581a): stale fixture
  84 -> 42 (burger 0; the 42 are gaps of the old waffle snapshots), TB3_MOTION_NIGHT2 (84b264c): 0 of 30 real quantities
  moved from gz-sim 8.10 to 8.15.0, site 23 MATCH / 7 APPROXIMATED.
- **Part 2** eight family commits f809c99 .. c7ba542 (burger FAIL 56 -> 27 -> 23 -> 20 -> 19 -> 17 -> 7 -> 5 -> 0);
  2cbcb7f spec: waffle / waffle_pi graph against the complete Night 2 capture -> nav_robotis FAIL 0 / 0 / 0.
- **Part 3** turtlebot3_drive model (0366042), velocity chain (f44d837); captures 0a8ac8c.

- **Part 3 (cont.)** velocity chain f44d837 (one cmd_vel publisher per behavior plugin, node info dedupe, smoother fixed
  20 Hz schedule; spec tb3-cmdvel-chain).
- **Part 4** 2c9fb59 (static spawned model = world object), 48d4074 (recovery round-robin per goal, failed behavior aborts,
  footprint collision check, NavFn tolerance fallback), 727d699 spec nav-errors: all 4 cases match status / error_code /
  error_msg / recovery sequence / log lines; durations differ (recorded).
- **Part 5** captures 1d0fe5f, ca26ffb (RViz config fidelity), 1ae83fe spec tb3-rviz-configs: 3 configs match real rviz2.

- **Part 7** regression gate `night2_after` (git 741dfc9): lessons 66/66, turtlesim lessons 282/282, UI suites and
  security pass, parity 135 passed / 3 failed (was 126 / 6). No test that passed before fails now; 10 new passes
  (nav_robotis x3, tb3-drive, tb3-cmdvel-chain, nav-errors, tb3-rviz-configs x3). The 3 left (nav2_bringup graph,
  matrix, matrix_dwb_burger) fail with the same 33 check lines as before. Report: `docs/tb3/NIGHT2_REPORT.md`.

## Night 2 finished
Next: Night 3 list at the end of `docs/tb3/NIGHT2_REPORT.md` (Nav2 timing, AMCL / costmap, SLAM growth, then MPPI, RPP,
Smac, collision monitor, waypoints).

## Resume commands
```bash
cd ~/ros2lab-course && git checkout tb3-night2
npm run dev                                                   # :8000 if not up
bash parity/scripts/tb3_v3/capture_queue.sh "tb3_burger:nav:pose tb3_burger:nav:nopose tb3_waffle_pi:nav:pose tb3_waffle_pi:nav:nopose tb3_waffle:nav:pose tb3_burger:world:- tb3_waffle_pi:world:-"
bash parity/scripts/tb3_v3/run_physics.sh                      # domain 50
bash parity/scripts/tb3_v3/capture_cmdvel.sh tb3_burger 61     # Part 3 (chain values during a goal)
bash parity/scripts/tb3_v3/capture_errors.sh tb3_burger 61     # Part 4 (error codes)
python3 parity/compare/nav_fail_rows.py                        # nav_robotis FAIL rows after a spec run
npx playwright test -c parity/playwright.config.ts parity/e2e/fixtures/nav_robotis.spec.ts -g tb3_burger
bash parity/scripts/tb3_v3/run_suites.sh night2_after          # the regression gate (about 1 h 15 min)
```
Stop real simulations with `bash parity/scripts/stop_reference.sh <domain>`; kill with `pgrep -f "[p]attern"`.
