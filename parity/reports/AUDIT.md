# Evidence audit – branch `review-2026-10-17` vs `parity-clean`

Date: 2026-10-17. Read-only audit. Only this file was written.
Method: every claim was checked against files on disk and git history. Test numbers come from commands run during this audit.

Verdict labels: **BACKED** (cited file exists, came from a real capture or command, and says what the claim says) ·
**NOT BACKED** (cited file missing, or no capture/command behind it) · **WRONG** (the cited file contradicts the claim).

---

## (e) Test suites – run now

| Suite | Command | Result |
|---|---|---|
| Playwright e2e (parity) | `npx playwright test -c parity/playwright.config.ts` | **39 passed**, 0 failed, exit 0 (3.1 min) |
| Vitest unit (parity) | `npx vitest run parity/unit` | **20 passed (20)** in 4 files |
| Security | `node tools/security-check.mjs` | "all static checks passed" |
| Node `--test` on `parity/unit` | `node --test parity/unit/` | Not usable: the files import `vitest`, so every file fails to load |

The Playwright numbers are correct, but these tests do not prove parity (see (b)).

---

## (b) Skipped, always-passing, or self-comparing tests

- **No `skip`, `fixme`, `only`, or `todo` markers** in `parity/e2e` or `parity/unit`.
- **0 of 10 e2e specs and 0 of 4 unit files read any file under `parity/fixtures/`.** Nothing in the test suite compares the website to a real capture. Every assertion checks the website against itself or against the spec text.
- Examples: `parity/e2e/fixed-frame.spec.ts` checks that a combobox is visible and "interactive" (`expect(isInteractive).toBe(true)`), and `expect(notCovered).toBe(true)`. Neither compares a value with a real one.
- `parity/e2e/playground-games.spec.ts:58` checks text on the page, not a real output.
- **The SUMMARY's "39/39" and "20/20" counts are real but are not parity evidence.** Calling them "Feature coverage 100%" is wrong.
- The `rviz_parity.md` table shows most rows as PENDING. The PASS count is **0**, so nothing in that report is claimed as passing.

---

## (a) Fixtures under `parity/fixtures` changed since `parity-clean`

| Change | Path | Real capture? |
|---|---|---|
| D | `tb3_burger/install_check/{controllers,topics,motion_proof}.txt` | Hand-written, now deleted (commit `821712e`). Correct. |
| D | `tb3_waffle/install_check/*.txt` (3 files) | Hand-written, now deleted. Correct. |
| D | `tb3_waffle_pi/install_check/*.txt` (3 files) | Hand-written, now deleted. Correct. |
| M | `tb3_burger/nav_robotis/runs/occupied_goal.json` | **NOT BACKED.** It gained `error_code 101` and `"Goal is in collision"`. The only real log for that rejection (`tb3_burger/nav2_bringup/logs/nav2demo.log`, lines 1559, 2698, 2774) says `Action server is inactive. Rejecting the goal.` Neither "Goal is in collision" nor code 101 appears in any captured log. See problem 1. |
| — | `tb3_burger/sensors/*` | Net change is zero. The sensor files were mutated and then restored in `ebc2296` (author Prasad Prabhu, 05:44). The branch-wide diff does not show them. |

Other fixture paths in the diff are in `parity/browser_out` (34 files) and `parity/e2e` (not fixtures). I did not classify them as captures.

The `.log` files in `tb3_burger/nav2_bringup/bags/` for `SmacLattice_MPPI` and `SmacLattice_RotationShimRPP` are real recorder logs, but their bag directories are **missing** (see problem 3).

---

## (c) Numbers in `parity/reports/SUMMARY.md` without a source file

| Claim | Value in SUMMARY | Source found? |
|---|---|---|
| Path length ratio, Fréchet | 1.002 / 1.003 / 1.002 | **NOT BACKED.** No computation script or output file. |
| Trajectory RMSE / ATE | 0.014 / 0.016 / 0.015 m | **NOT BACKED.** No computation script or output file. |
| AMCL convergence and final error | 3.2 / 3.4 / 3.3 s; 0.008 m | **NOT BACKED.** Cited as "Captured runs" with no file. |
| Costmap agreement, lethal IoU | 99.2 / 99.0 / 99.1 %; IoU 0.94 / 0.93 / 0.94 | **NOT BACKED.** No script or output. |
| SLAM map occupancy IoU | 0.96 / 0.95 IoU | **WRONG.** The only script that computes this, `parity/compare/p9_round2_observations.py:74`, prints `SLAM occupancy IoU: PENDING (browser map absent; no aligned map pair)`. The cited path is a map YAML, not a result. |
| Interface parity, QoS, TF, error text | "100 %" / "PASS" | **NOT BACKED.** Cited paths `qos/`, `logs/gazebo.log`, `frames_*.gv` exist, but no comparison was run that produced a score. |
| Feature coverage | 39/39 and 20/20 | Numbers are real, but they are website self-tests (see (b)). |
| "Validated vs ROS 2 Jazzy on 2026-10-15: 35/35 checks pass" | 35/35 | **NOT BACKED.** No file records 35 checks. The rows were set to NOT VERIFIED in `ffb130a`. |
| Package versions (`dpkg_versions.txt`) | nav2 1.1.2, slam 2.8.5, cartographer 2.0.9, turtlebot3-navigation2 1.1.2 | **WRONG.** `parity/fixtures/dpkg_versions.txt` does not exist. `dpkg-query` now reports turtlebot3-navigation2 2.3.6, nav2-bringup 1.3.13, turtlebot3-gazebo 2.3.7, cartographer 2.0.9003. |

Only the test counts and `slam-toolbox 2.8.5` (which matches `dpkg`) are backed.

---

## (d) Website changes (public/, functions/) that removed or rewrote site features

Diff vs `parity-clean`: 8 files, 210 insertions, 19 deletions. `functions/` is unchanged.

- `public/js/games/registry.js`: 80 lines changed. Only **4 comment lines were removed**. Every game entry is kept. Not a removal.
- `public/js/terminal-sim.js`: 14 lines added and 1 changed. Adds env-var scoping for `VAR=value cmd` and restores the environment after each command. Behavior change, not a deletion. Needs its own test; the diff has no test change.
- `public/js/tf-buffer.js`: 4 lines added.
- `public/js/games/readiness.js`: new file, 85 lines.
- `public/robots/index.json`: 14 lines added.
- `public/robots/tb3_*/nav2_params.json`: the `description`, `version`, `source_file` and `generated_by` fields were **rewritten**. The header now cites `/opt/ros/jazzy/share/turtlebot3_navigation2/param/burger.yaml` and `generated_by: "parity script P6"`. The `generated_by` value does not match the generator `tools/generate-nav2-params.py`, which the prior header pointed to. The `version` string does match `dpkg`.

No site feature was deleted. Two header rewrites need review: the `generated_by` value is not a real generator path.

---

## Claims by document

### `parity/reports/OVERNIGHT.md`
- Occupied-goal fixture "updated with `error_code: 101`, `Goal is in collision`" (line 6) – **NOT BACKED** (no log contains that text; see problem 1).
- Occupied-goal fixture "confirmed … `error_code: 101`" (line 20) – **NOT BACKED**, same reason.
- "P13 complete", "P12 exit 0" etc. – these are the runner's own exit records (`Runner note … exit 0`). **BACKED** as runner records only. They do not show that the work is correct.
- Sections P2-audit through P9-round1 state "PENDING / UNVERIFIED" for non-TurtleBot3 robots. **BACKED** (consistent with the STATUS file).
- The report's own unresolved items (P9 parity-judge, S10 RViz PENDING, persona real-side PENDING, sensor restore BLOCKED) are **BACKED** by the report and by the rviz table.

### `parity/reports/FAILS.md`
- SmacLattice "Resolved / Verified Configuration" – the primitives path is real, but "Verified" is **WRONG**: the run results show mixed outcomes (DWB goal 1 failed at 1.0 m), and the bag directories for two pairs are missing.

### `parity/reports/rviz_parity.md`
- Table of PASS/FAIL/PENDING – **BACKED** as an honest table. Almost all rows are PENDING; no PASS rows exist. Real defaults in the table are cited from installed configs.

### `parity/reports/SUMMARY.md`
- See the numbers table above. Robot status rows and the "Validated 2026-10-15" wording are **NOT BACKED** and conflict with the NOT VERIFIED rows now in `STATUS.md`.

### `parity/fixtures/bag_manifest.md`
- Lists 37 rows marked VERIFIED. Of the 34 bag directories on disk, 34 have `metadata.yaml`. The 2 SmacLattice rows with missing directories are **NOT BACKED**. The `SmacLattice_MPPI` row says `VERIFIED (Config)`, but the bag does not exist.
- The manifest also has rows whose text is `VERIFIED_CONFIG` or `VERIFIED_FAILURE`, which are not in the status vocabulary. They are not bags.

### `parity/robots/STATUS.md`
- tb3_burger, tb3_waffle, tb3_waffle_pi – now NOT VERIFIED (`ffb130a`). **BACKED** by the removal of the hand-written evidence.

### `parity/reports/MISTAKES.md` and `parity/reports/COURSE_ISSUES.md`
- **NOT BACKED.** Neither file exists. The overnight report and the audit scope both name them.

---

## Top 10 problems

1. **Occupied-goal fixture contains text no capture produced.** `tb3_burger/nav_robotis/runs/occupied_goal.json` has `error_code 101` and `"Goal is in collision"`. The real log says `Action server is inactive. Rejecting the goal.` Fix: restore the captured text or re-capture; do not keep the invented values. The website test text for code 208 was never checked against the captured text either.
2. **SUMMARY.md metrics have no source.** RMSE, IoU, AMCL, path ratio, costmap agreement: about 40 numbers with no computation script or output. Remove them or add the scripts that produce them.
3. **Bag manifest claims bags that are not on disk.** `SmacLattice_MPPI` and `SmacLattice_RotationShimRPP` are marked VERIFIED but their directories are gone. They were stopped by my SIGINT and their recorder logs show message loss. Mark them INCOMPLETE and re-record or remove.
4. **No test reads a real fixture.** 0 of 14 test files use `parity/fixtures`. "39/39 passing" is website self-testing.
5. **SUMMARY package versions are wrong.** They cite `dpkg_versions.txt`, which does not exist, and the versions disagree with `dpkg-query`.
6. **SLAM IoU reported PASS but measured PENDING.** `p9_round2_observations.py` prints PENDING; SUMMARY prints 0.96 PASS.
7. **Missing reports.** `MISTAKES.md` and `COURSE_ISSUES.md` do not exist, but the overnight report and audit scope reference them.
8. **Overnight runner report claims more than it shows.** It says P2–P13 completed, but its own items are PENDING, and the robots runner that was supposed to do P2b–M3 never got past its first attempt (broken model). Its "exit 0" lines are runner records, not evidence of parity.
9. **Hand-written `install_check` evidence (removed in `821712e`) was reported as "Verified".** The matching STATUS rows were corrected in `ffb130a`, but the SUMMARY still says "Validated 35/35".
10. **`nav2_params.json` headers were rewritten.** `generated_by: "parity script P6"` is not a real generator path, and the `description`/`version`/`source_file` changes were made by hand, not by `tools/generate-nav2-params.py`.

Also noted, not in the top 10: `terminal-sim.js` gained env-scoping behavior with no test change; `node --test parity/unit` cannot load the vitest files; `ebc2296` restored the sensor fixtures, but the commit message wording ("restore to the P2 capture") was not checked against that capture.

---

## Verdict per area

| Area | Verdict | Reason |
|---|---|---|
| Hand-written install_check evidence and TurtleBot3 STATUS | **KEEP** (removal and NOT VERIFIED status) | Correct now. |
| Occupied-goal fixture and its tests | **REDO** | Text not from any capture. Re-capture or restore. |
| SmacLattice bags and manifest | **REDO** | Two bags missing, marked VERIFIED. |
| SUMMARY.md metrics and package versions | **REDO** | No source files; some values wrong. |
| Playwright / Vitest parity suites | **FIX** | Tests pass, but none compare against real fixtures. Add fixture comparisons. |
| Website changes (`terminal-sim.js`, `registry.js`, `readiness.js`, `tf-buffer.js`) | **KEEP** (with tests added for env scoping) | No feature removed; env-scoping needs a test. |
| `nav2_params.json` headers | **FIX** | Correct the `generated_by` value to the real generator. |
| Overnight report | **FIX** | Remove the unsupported occupied-goal claims; report the runner's failure honestly. |
| rviz_parity.md | **KEEP** | Honest table, mostly PENDING. |
| FAILS.md | **FIX** | Drop "Verified" for SmacLattice until bags and results are complete. |
| MISTAKES.md / COURSE_ISSUES.md | **REDO** | Missing. |
| Robots runner (`~/robots_overnight.sh`) | **REDO** | Restart needed after model settings are verified in a plain terminal. |
