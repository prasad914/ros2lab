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

## Running / next
- Part 4 baseline: `bash parity/scripts/tb3_v3/run_suites.sh before` (summary `docs/tb3/tests/before.txt`, raw logs
  `parity/browser_out/tb3_night1/before/`). No site code changes until it finishes (the dev server serves this tree).
- Part 1.2-1.4 (schema, UI, tests), then Part 2 captures, Part 3, Part 4 after-run, Part 5 report.

## Resume commands
```bash
cd ~/ros2lab-course && git checkout tb3-focus
npm run dev   # if :8000 is not up
bash parity/scripts/tb3_v3/run_suites.sh before     # only if docs/tb3/tests/before.txt has no "finished" line
```
