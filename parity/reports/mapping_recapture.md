# Mapping recapture – TurtleBot3 burger / waffle / waffle_pi (2026-10-17)

Step C, domain 41, partition ref41, one simulation at a time, `use_sim_time:=True` on the launches.
Runner: `parity/scripts/run_mapping_item.sh <robot> <slam|cartographer>`.
Fixtures: `parity/fixtures/<robot>/<slam|cartographer>/` (map in `map/`).
Installed versions (all six `run_info.txt`): slam_toolbox 2.8.5-1noble.20260915.204151,
cartographer 2.0.9004-1noble.20260225.051215, cartographer_ros 2.0.9003-2noble.20260920.232954,
nav2 1.3.13 (nav2_map_server 1.3.13-1noble.20260921.024942).

## Coverage

Cell counts are from each saved `map/map.pgm` (pixel 0 = occupied, >= 250 = free, 205 = unknown).
Drive duration is from `logs/drive_coverage.log` (start and "Completed" lines, wall-clock stamps).
Sim time is the "Most recent transform" of map -> odom in `frames_*.gv`, written when view_frames ran;
wall time is from the run's pid-file timestamp (Gazebo start) to the `frames_*.gv` file name. Both are approximate.
Rates are from `qos/<topic>_hz.txt`, measured during the capture snapshot after the drive.

| robot | mapper | occupied | free | unknown | drive (wall) | wall s to view_frames | sim s at view_frames | sim / wall | /odom Hz | /scan Hz |
|---|---|---|---|---|---|---|---|---|---|---|
| tb3_burger | slam | 671 | 7406 | 3459 | 180.0 s | 341 | 226.2 | 0.66 | 34.5 | 3.44 |
| tb3_burger | cartographer | 832 | 7884 | 5784 | 180.0 s | 365 | 214.6 | 0.59 | 27.6 | 3.10 |
| tb3_waffle | slam | 208 | 2028 | 7760 | 180.0 s | 384 | 32.1 | 0.08 | 4.55 | 0.89 |
| tb3_waffle | cartographer | 541 | 7198 | 6397 | 180.0 s | 406 | 29.6 | 0.07 | 3.85 | 0.78 |
| tb3_waffle_pi | slam | 335 | 3698 | 7400 | 180.0 s | 379 | 74.9 | 0.20 | 11.1 | 2.05 |
| tb3_waffle_pi | cartographer | 648 | 7412 | 6440 | 180.0 s | 394 | 71.0 | 0.18 | 9.4 | 1.78 |

Path length and final pose of each drive: **PENDING** – no /odom time series was recorded in these runs
(no bag; `drive_coverage.log` has only the start and finish lines). Needs a `record_bag.sh` run around the drive.

## Reading

- The SLAM Toolbox maps of waffle and waffle_pi are partial (goal2–goal5 UNKNOWN on waffle, goal2–goal3 on
  waffle_pi). Looking at the maps: walls are straight and cylinder arcs sharp, no doubled or smeared walls,
  so the scans look right; the waffle map is a fan of rays around the start area, i.e. the robot covered little ground.
- The simulation ran far slower than real time for the camera models on this headless machine
  (sim/wall about 0.08 waffle, 0.20 waffle_pi, 0.66 burger). `drive_coverage.py` times its 180 s with
  `time.time()` (wall clock, lines 41/53), so the waffle drove for only about 15 s of simulated time.
  This explains the low coverage; it is not shown that the robot got stuck (no odom series to check, see PENDING).
- `drive_coverage.py` does not set `use_sim_time` and uses wall time, against the "use_sim_time:=True everywhere" rule.
- The low rates above (/scan 0.8–3.4 Hz) are this machine's headless performance, not a target for the website.

## Goals check

All 7 poses of `parity/fixtures/goals.yaml` on all 6 maps: `check_goals_on_map.py` (resolution rounded to float32)
agrees with nav2_map_server's /map in 42 of 42 cases (`map/goals_check.md`, `map/goals_check_mapserver.txt`).
`obstacle_goal` (1.87, 0.40) is FREE on both burger maps, OCCUPIED on the waffle and waffle_pi SLAM maps,
and UNKNOWN on the waffle and waffle_pi Cartographer maps. goals.yaml is unchanged.
