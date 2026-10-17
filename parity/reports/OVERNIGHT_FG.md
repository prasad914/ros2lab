# Overnight run F/G (2026-10-17 → 18), unattended

Every decision made without the instructor is listed under its item. Branch at start: `review-2026-10-17` (HEAD 413a50f).

## Item 0 – bag_manifest.md vs matrix.md

**Cause.** Two things mixed in earlier manifests:
1. The hand-written manifest before 2b55084 (e.g. 2b9cefc) listed `nav_robotis/bags/run1…run10` with sizes and
   statuses ("run6 FAILED (timeout)", 141 MiB, 0.02 MiB …) that belong to the bags now in
   `nav_robotis/archive_2026-10-16_pre_upgrade/bags/`, and `nav2_bringup/bags/SmacLattice_*` "NAV FAILED" rows that
   belong to the earlier P2 matrix (`nav2_bringup/runs/<pair>.json`), not to the step E matrix
   (`nav2_bringup/matrix/<pair>/result.json`).
2. The generated manifest of 2b55084 linked a status only for `bags/matrix/<pair>`; all other bags (current
   nav_robotis runs, P2 leftovers, archive folders) showed `-` in one table, so current and old bags looked alike.

**Odd sizes.** Measured: the archived nav_robotis bags run7–run10 ended 27–50 s *before* their result file was
written ("Bag end - result" column: −27, −28, −50, −42 s), and archived run6 has 30 messages on 1 topic and no result
file. The old P2 SmacLattice bags are 0.98–2.71 MiB (4.6–15.5 s). These are the earlier, broken attempts; the
current bags are 38–44 MiB (nav_robotis) and 12.7–22.4 MiB (matrix).

**Fix.** `generate_bag_manifest.py` now links every bag to the result file written by the same run
(`matrix/<pair>/result.json`, `runs/<run>.json`, `<attempt>/runs/<run>.json` or `<attempt>/<run>.json`), adds a
"Bag end - result" timing check, and splits the table: *Current evidence* (36 bags) and *Archived and superseded
attempts* (35 bags, each labelled ARCHIVED attempt `<folder>` or SUPERSEDED by `bags/matrix/<pair>`).

**Check.** Scripted comparison: 25/25 matrix rows equal `parity/reports/matrix.md` §2 (20 SUCCEEDED, 5 ABORTED 104);
nav_robotis run1–run10 are all "5/5 goals SUCCEEDED", equal to `nav_robotis_step_d.md` (10/10 per goal).
One wrong line found and corrected: step D said the 10 bags are "422 MB"; on disk 441631011 bytes = 421.17 MiB.
`slam/bags/run1` has no result file (mapping run, no goals) and shows "no result file".

## Item 1 – DWB follow-up with installed kinematics

Found: `/opt/ros/jazzy/share/turtlebot3_navigation2/param/burger.yaml` lines 120–160 is a complete DWB
`FollowPath` block. Decision: add every key of it except `plugin` (37 keys, each with its line number in
`params.diff`); keep everything else as in step E (minimal diff). Added `run_matrix.py --dwb-burger` (separate
`matrix_dwb_burger/` and `bags/matrix_dwb_burger/`, so step E results stay untouched).
Result: 5/5 SUCCEEDED, error_code 0 (NavFn 4.00 s, Smac2D 3.77 s, ThetaStar 3.86 s, SmacHybrid 8.42 s, SmacLattice
4.66 s sim). Details: `parity/reports/matrix.md` §6. Caveat recorded there: nav2_bringup's
`tb3_simulation_launch.py` spawns the waffle model by default, so the burger limits ran on a waffle body.
