# TurtleBot3 focus: progress (Night 1, 2026-10-23)

Branch `tb3-focus` (from master `213baa2`). Never pushed, never merged into master.

## Done
- **Part 0.1** fix-v2 vs master: `git branch --merged master` does **not** list fix-v2 (42 commits not in master's
  history; `git cherry master fix-v2` = 41 `+`). Content check: 199 of 205 files fix-v2 changed are byte-identical in
  master (the redesign squash `b4ae6bd` carried them); `git merge-tree master fix-v2` leaves 3 conflicts
  (`public/css/app.css`, `public/js/ros-graph.js`, `public/js/who.js` deleted in master) where master has the newer
  version. Not merged (as instructed).
- **Part 0.2** versions: `parity/fixtures/tb3_jazzy_v3/versions.txt`, README. All TB3/Nav2 from apt, nothing built.
  This PC has older Nav2 (1.3.10), gz-sim (8.10.0) and ros_gz (1.0.16/18) than the machine that made the existing
  fixtures (`version_diff_vs_old_fixtures.txt`).
- **Part 0.3** data inventory: README section "Ground-truth data on this PC".
- **Part 1.1** `parity/reports/COURSE_ROBOT_REFERENCES.md` (`node parity/scripts/tb3_v3/write_course_refs_md.mjs`).

- **Part 1.2-1.4** committed on branch `tb3-focus-p1` (worktree `/home/prasad/ros2lab-tb3wt`, dev server :8001):
  6c2278d schema, a0e39ec UI, 58e5fd2 tests. To be fast-forwarded into `tb3-focus` after the baseline run.
  `node tests/robot-status.test.mjs` 372 ok; `parity/e2e/under-test.spec.ts` 5 passed on :8001.
- **Part 2.A** `parity/fixtures/tb3_jazzy_v3/A/` (nav2_route, opennav_docking, collision_monitor present; no
  nav2_docking; NavigateToPose result has `error_msg`).
- **Part 2.B** burger no-initial-pose: `parity/fixtures/tb3_jazzy_v3/tb3_burger/nav_nopose/` (timing.txt: 62.0 s wall,
  60.3 s sim from "Checking transform" to "Aborting bringup", RTF 0.97).

- **Part 2.B** captures so far: burger nopose + pose (goal SUCCEEDED, /cmd_vel_nav 10 Hz, /cmd_vel_smoothed and /cmd_vel
  20 Hz), waffle_pi pose. waffle_pi nopose must be re-run (wait regex matched the localization manager; fixed after the
  queue); waffle pose/nopose and the four world captures are queued (`capture_queue.sh`, log /tmp/claude-1000/queue1.log).
- **Part 3** code started on `tb3-focus-p1`: `public/js/tb3-motion.js` (slip model) + hook in `ros-gz.js` gzStep;
  site runner `parity/compare/site_tb3_motion.mjs`, analysis `parity/compare/tb3_motion_fit.py`; real captures next
  with `bash parity/scripts/tb3_v3/run_physics.sh` (domain 50, after the Nav2 queue).

- **Part 2** committed: a12e680 (Nav2 captures, 3 models, pose + nopose), c2f4f77 (`parity/reports/TB3_GRAPH_TRIAGE.md`:
  441 items = 332 site-missing, 25 site-extra, 84 stale fixture / version, 0 wrong type). World captures (teleop,
  turtlebot3_drive, sensors, burger_cam) are being re-run with `--full-length` scan echo (queue3), then committed with
  `SUMMARY.md` (`python3 parity/scripts/tb3_v3/summarize_captures.py`).
- Part 1 red/green: `parity/e2e/under-test.spec.ts` 5 failed on the old code (:8000), 5 passed with Part 1 (:8001).

## Running / next
- Part 4 baseline: `bash parity/scripts/tb3_v3/run_suites.sh before` (summary `docs/tb3/tests/before.txt`, raw logs
  `parity/browser_out/tb3_night1/before/`). No site code changes until it finishes (the dev server serves this tree).
- Part 1.2-1.4 (schema, UI, tests), then Part 2 captures, Part 3, Part 4 after-run, Part 5 report.

Real captures (one at a time, ROS_DOMAIN_ID 61, GZ_PARTITION ref61; stop with `bash parity/scripts/stop_reference.sh 61`):
```bash
bash parity/scripts/tb3_v3/capture_nav.sh <tb3_burger|tb3_waffle_pi|tb3_waffle> 61 <nopose|pose>
python3 parity/scripts/tb3_v3/nopose_timing.py parity/fixtures/tb3_jazzy_v3/<robot>/nav_nopose ground-truth/tb3/<robot>/nav_nopose
bash parity/scripts/tb3_v3/capture_world.sh <tb3_burger|tb3_waffle_pi|tb3_waffle|tb3_burger_cam> 61
```

## Resume commands
```bash
cd ~/ros2lab-course && git checkout tb3-focus
npm run dev   # if :8000 is not up
bash parity/scripts/tb3_v3/run_suites.sh before     # only if docs/tb3/tests/before.txt has no "finished" line
```
