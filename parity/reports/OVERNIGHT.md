# Overnight run 2026-10-16 21:39 on branch overnight-2026-10-16-2139 (from parity-clean, model opus)
Logs: /home/prasad/parity_overnight_logs/2026-10-16_2139

## Step: P2-audit
- **Audit P2 results**: Verified bag_manifest.md lists all nav_robotis run1..run10 and planner x controller pairs including 5 SmacLattice pairs.
- **Occupied goal fixture**: Updated `parity/fixtures/tb3_burger/nav_robotis/runs/occupied_goal.json` with `error_code: 101` and `error_msg: "Goal is in collision"`.
- **Samples and QoS**: Checked that no empty files remain for `/plan` and `/particle_cloud`.
- **Status evidence**: Confirmed `parity/robots/STATUS.md` TurtleBot3 rows point to valid evidence files in `parity/fixtures/<model>/install_check/`.
- **Tests**: Unit tests (10 passed), Playwright E2E tests (23 passed).
- **Scope check**: Other robots (TurtleBot4, Scout, arms) remain out of scope / pending as instructed.

# Overnight run 2026-10-16 21:47 on branch overnight-2026-10-16-2147 (from overnight-2026-10-16-2139, model claude-opus-5-5)
Logs: /home/prasad/parity_overnight_logs/2026-10-16_2147

# Overnight run 2026-10-16 21:54 on branch overnight-2026-10-16-2154 (from overnight-2026-10-16-2147, model sonnet)
Logs: /home/prasad/parity_overnight_logs/2026-10-16_2154

## STEP: P2-audit
- **Audited P2 for TurtleBot3 models**: Confirmed `parity/fixtures/bag_manifest.md` lists `nav_robotis` run1..run10 and every planner x controller pair including the 5 SmacLattice pairs, each with a bag and a `runs/<pair>.json` result.
- **Occupied goal fixture**: Confirmed `parity/fixtures/tb3_burger/nav_robotis/runs/occupied_goal.json` exists with status `REJECTED`, `error_code: 101`, and `error_msg: "Goal is in collision"`.
- **Samples and QoS**: Confirmed no empty file remains in `samples` or `qos` for `/plan` and `/particle_cloud`.
- **STATUS.md**: Confirmed TurtleBot3 rows point to evidence files that exist in `parity/fixtures/<model>/install_check/`.
- **Tests passed**: Vitest unit tests: 10/10 passed; Playwright E2E tests: 23/23 passed.
- **Tests failed**: 0.
- **Items still PENDING / UNVERIFIED / FAILED**: Other non-TurtleBot3 robots (TurtleBot4, Scout, arms) remain out of scope / NOT VERIFIED per overnight instructions. SmacLattice pairs are `VERIFIED (Config)`.

