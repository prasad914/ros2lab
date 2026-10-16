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


## STEP: P5
- **Task**: Sensors (Image and PointCloud2 per robot, Spec S9) for TurtleBot3 models.
- **Commits made**: Added sensor E2E tests (`parity/e2e/sensors.spec.ts`) and unit tests (`parity/unit/sensors.test.mjs`).
- **Tests passed**: Playwright E2E tests: 25/25 passed; Vitest unit tests: 14/14 passed.
- **Tests failed**: 0.
- **Items still PENDING / UNVERIFIED / FAILED**: TurtleBot4 and other non-TurtleBot3 robots remain NOT VERIFIED per overnight instructions. `tb3_waffle_depth` variant skipped as optional.


## STEP: P6
- **Task**: Full autonomous-navigation stack emulation (Spec S5–S8, S10, S11) for TurtleBot3 models (`tb3_burger`, `tb3_waffle`, `tb3_waffle_pi`).
- **Commits made**: Updated `nav2_params.json` headers to installed source and package version; created `parity/reports/stack_status.md` and E2E test `parity/e2e/stack.spec.ts`.
- **Tests passed**: Playwright E2E tests: 28/28 passed; Vitest unit tests: 14/14 passed.
- **Tests failed**: 0.
- **Items still PENDING / UNVERIFIED / FAILED**: Non-TurtleBot3 robots remain NOT VERIFIED / out of scope per overnight instructions. Docking and Route Server are PENDING (not installed/active for TB3).



## Runner note – P2-audit: exit 0 at 21:57
    b2cbcf0 Update overnight report for STEP: P2-audit
    1a757ec Overnight run started on overnight-2026-10-16-2154
    9c9b815 Update overnight script to use model sonnet
    ec9dac0 Overnight run started on overnight-2026-10-16-2147
    d710c43 Complete P2-audit for TurtleBot3 models and update overnight report
    faa6844 Overnight run started on overnight-2026-10-16-2139
    9bee3e3 Commit remaining SmacLattice configs, runs, and navigation trial outputs for overnight run
    48a5837 Add overnight runner

## Runner note – P5: exit 0 at 22:08
    350ce4a Complete P5 sensor parity for TurtleBot3 models and update overnight report
    26a7754 Overnight runner log: P2-audit
    b2cbcf0 Update overnight report for STEP: P2-audit
    1a757ec Overnight run started on overnight-2026-10-16-2154
    9c9b815 Update overnight script to use model sonnet
    ec9dac0 Overnight run started on overnight-2026-10-16-2147
    d710c43 Complete P2-audit for TurtleBot3 models and update overnight report
    faa6844 Overnight run started on overnight-2026-10-16-2139
