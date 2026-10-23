# TurtleBot3 focus: progress (Night 1, 2026-10-23)

Branch `tb3-focus` (from master `213baa2`). Never pushed, never merged into master. Report: `docs/tb3/NIGHT1_REPORT.md`.

## Done
- **Part 0** fix-v2 check (not merged by git; content in master except 3 files where master is newer), versions
  (`parity/fixtures/tb3_jazzy_v3/README.md`, this PC has Nav2 1.3.10 / gz-sim 8.10, older than the old fixtures), data
  inventory. Commit 819de3b.
- **Part 1** `parity/reports/COURSE_ROBOT_REFERENCES.md` (84487d6); schema c749c14, UI bb82a8a, tests d8d1722.
- **Part 2** captures a12e680 (Nav2), af3cbb2 (world, SUMMARY.md); triage c2f4f77 (`parity/reports/TB3_GRAPH_TRIAGE.md`).
- **Part 3** captures 93c574d, comparison tooling 6b75d80, model d342d64 (`public/js/tb3-motion.js`), report bf16837
  (`parity/reports/TB3_MOTION_NIGHT1.md`: after 24 MATCH / 6 APPROXIMATED).
- **Part 4** baseline 72afae8, after-run `docs/tb3/tests/after.txt` (one new failure, fixed in 9eb95b7).
- **Part 5** `docs/tb3/NIGHT1_REPORT.md`.

## Next (Night 2)
See "Night 2 should start with" in `docs/tb3/NIGHT1_REPORT.md`: Nav2 reference version decision, the Nav2 graph per
the triage, the /cmd_vel chain, Nav2 error codes, then RViz (tb3_navigation2.rviz, tb3_cartographer.rviz, model.rviz).

## Worktree
A worktree `/home/prasad/ros2lab-tb3wt` (branch `tb3-focus-p1`, dev server :8001) kept half-done code away from the
baseline run on :8000. Its commits are all on tb3-focus; the worktree and branch were removed at the end of Night 1.

## Resume commands
```bash
cd ~/ros2lab-course && git checkout tb3-focus
npm run dev                                                   # :8000 if not up
bash parity/scripts/tb3_v3/run_suites.sh after                # the regression gate (about 1 h 45 min)
node tests/robot-status.test.mjs && node tests/tb3-motion.test.mjs
# real captures (one at a time; stop with: bash parity/scripts/stop_reference.sh 61 / 50)
bash parity/scripts/tb3_v3/capture_queue.sh "tb3_burger:nav:pose tb3_burger:nav:nopose tb3_burger:world:-"
bash parity/scripts/tb3_v3/run_physics.sh tb3_lin tb3_ang          # domain 50, ros_case.py
python3 parity/scripts/tb3_v3/summarize_captures.py
python3 parity/compare/tb3_graph_triage.py                         # needs parity/browser_out/fixture_parity/ from a parity run
```
Use `pgrep -f "[p]attern"` (bracket trick) when killing captures: a plain `pkill -f pattern` matches the calling shell.
