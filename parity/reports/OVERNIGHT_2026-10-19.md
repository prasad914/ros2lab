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
