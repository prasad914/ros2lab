# Step E: planner × controller matrix (tb3_burger, nav2_bringup)

Real ROS 2 Jazzy, `tb3_simulation_launch.py` via `parity/scripts/run_matrix.py`, domain 41, partition `ref41`,
`REF_RENDER=egl`, map `parity/fixtures/maps/turtlebot3_world.yaml`, goal `goal1` of `parity/fixtures/goals.yaml`
(map (0.20, 1.00)). Run 2026-10-17 20:29–21:27 +0530, unattended, one pair after another.
Every pair's `run_info.txt` records `git_commit=732b64d…` with `git_uncommitted_scripts=` empty.
Evidence root: `parity/fixtures/tb3_burger/nav2_bringup/` (below: `M/` = `matrix/`).

## 0. `/map_updates` QoS file

`parity/fixtures/tb3_{burger,waffle,waffle_pi}/slam/qos/map_updates.txt` all contain `Unknown topic '/map_updates'`.
It is the explicit query in `run_mapping_item.sh`, not a daemon gap. This was already written in
`parity/reports/mapping_recapture.md` ("`/map_updates` QoS file (step E.0)") and committed in d4311fb. Nothing new.

## 1. Frame check: VALID

`frame_check/frame_check.txt` (installed params, after localization):

| Quantity | Value |
|---|---|
| goals.yaml `start_pose` | (0.000, 0.000, yaw 0.000), frame `map` |
| `/amcl_pose` | (0.039, −0.005, yaw −0.010), frame `map` |
| TF map→base_footprint | (0.039, −0.005, yaw −0.010) |
| \|amcl − start_pose\| / \|TF − amcl\| | 0.039 m / 0.000 m |
| /scan endpoints within 2 cells of an occupied map pixel | 1795/1800 = 0.997 (5 scans) |
| control (robot shifted by the Gazebo spawn offset −2.0, −0.5) | 95/1800 = 0.053 |

The pass criterion was set before measuring: hit ≥ 0.8, |amcl − start| < 0.10 m, |TF − amcl| < 0.05 m. All three
pass, so goals.yaml positions are valid in this scenario's map frame and the matrix ran.
`frame_check/tf_map_base_footprint.txt` (tf2_echo) shows the same translation (0.039, −0.005).
The CLI cross-check `frame_check/amcl_pose_echo.txt` failed with `WARNING: topic [/amcl_pose] does not appear to be
published yet` (it was run without `--no-daemon`). Decision: frame_check.py subscribed directly and has the value, so
the CLI echo counts only as a failed secondary capture.

## 2. Matrix (goal1 result)

| Planner \ Controller | MPPI | DWB | RPP | RotationShimRPP | Graceful |
|---|---|---|---|---|---|
| NavFn | SUCCEEDED 9.42 s | **ABORTED 104** 16.55 s | SUCCEEDED 3.39 s | SUCCEEDED 5.97 s | SUCCEEDED 6.89 s |
| Smac2D | SUCCEEDED 5.29 s | **ABORTED 104** 16.59 s | SUCCEEDED 3.35 s | SUCCEEDED 6.24 s | SUCCEEDED 6.45 s |
| ThetaStar | SUCCEEDED 5.39 s | **ABORTED 104** 16.78 s | SUCCEEDED 3.65 s | SUCCEEDED 6.00 s | SUCCEEDED 6.70 s |
| SmacHybrid | SUCCEEDED 6.05 s | **ABORTED 104** 16.65 s | SUCCEEDED 4.71 s | SUCCEEDED 33.33 s ¹ | SUCCEEDED 7.44 s |
| SmacLattice | SUCCEEDED 5.52 s | **ABORTED 104** 17.85 s | SUCCEEDED 3.62 s | SUCCEEDED 3.63 s | SUCCEEDED 6.58 s |

Times are sim seconds from goal send to result (`duration_sim_s` in `M/<pair>/result.json`; the whole table is in
`M/matrix_results.json`). All 25 pairs configured and activated (`ready_navigation.txt`: `READY`), localized, and
goal1 was accepted. Every pair has `domain_check.txt` with "domain 41 empty" before start and after stop.
The previous REDO pairs (MPPI, RotationShimRPP) were run like the others and all completed.

¹ Succeeded after recoveries; see section 4.

## 3. `/cmd_vel` type

In all 25 pairs, `ros2 topic info /cmd_vel -v --no-daemon --spin-time 5` (`M/<pair>/cmd_vel_info.txt`, taken once
Nav2 was active, before the goal) shows **one type, `geometry_msgs/msg/Twist`**. Publishers are `collision_monitor`
and `docking_server`; subscribers are `ros_gz_bridge` and `rosbag2_recorder`.
`enable_stamped_cmd_vel` is `False` on controller_server, velocity_smoother, collision_monitor, behavior_server and
docking_server (`M/<pair>/cmd_vel_params.txt`). `topic_list.txt` lists `/cmd_vel`, `/cmd_vel_nav`,
`/cmd_vel_smoothed` and `/cmd_vel_teleop`, all `geometry_msgs/msg/Twist`.
Every bag's `metadata.yaml` records `/cmd_vel` as `geometry_msgs/msg/Twist` (86–577 messages).
None of the 25 recorder logs (`bags/matrix/<pair>.log`, gitignored) has a WARN or ERROR line or "more than one type".
No `nav2demo.log` in this run contains `TwistStamped`.

**No second type appeared in this run, so there was no source to trace.** The earlier recorder error
`Topic '/cmd_vel' has more than one type associated` (`parity/reports/FAILS.md`, matrix bullet) came from an earlier
matrix run and did not happen again here. Its source stays UNVERIFIED.
(nav_robotis is a different scenario. Its `/cmd_vel` is TwistStamped; see `nav_robotis_step_d.md`.)

## 4. Failures, exact errors

### DWB column: 5/5 ABORTED, error_code 104

`result.json`: `"status": "ABORTED"`, `"error_code": 104`, `"error_msg": ""` for every planner.
104 = `PATIENCE_EXCEEDED` (`/opt/ros/jazzy/share/nav2_msgs/action/FollowPath.action:16`).
Log lines (`M/<planner>_DWB/goal_goal1/nav2_goal_lines.txt`; numbers are lines of the gitignored
`logs/nav2demo.log`, e.g. NavFn_DWB):

```
415: [controller_server]: Could not find a legal trajectory: No valid trajectories out of 0!
423: [ERROR] [controller_server]: Controller patience exceeded
582: [bt_navigator]: [navigate_to_pose] [ActionServer] Aborting handle.
583: [ERROR] [bt_navigator]: Goal failed
```

| Pair | "out of 0" lines | "Controller patience exceeded" (logs/nav2_errors.txt) |
|---|---|---|
| NavFn_DWB | 95 | 14 |
| Smac2D_DWB | 93 | 14 |
| ThetaStar_DWB | 93 | 14 |
| SmacHybrid_DWB | 81 | 12 |
| SmacLattice_DWB | 87 | 14 |

Measured cause: `M/<planner>_DWB/params_effective/controller_server.yaml` lines 63–65 show
`max_speed_xy: 0.0`, `max_vel_theta: 0.0`, `max_vel_x: 0.0` (and `acc_lim_x: 0.0`) in every DWB pair.
The installed `nav2_params.yaml` FollowPath block is an MPPI block with no DWB kinematic keys, so DWB keeps its
defaults of 0 and generates no trajectories.
Decision (unattended): step 2 allows only plugin names plus params the plugin cannot load without. DWB configures and
activates without the kinematic keys (`ready_navigation.txt`: READY), so they were not added. The DWB column is
the real result of the minimal-diff config. It is **not** evidence that DWB cannot drive the burger.
A DWB run with the kinematic keys added is a separate, not-yet-run config: PENDING.

### SmacHybrid_RotationShimRPP: SUCCEEDED after recoveries (33.33 s sim)

`M/SmacHybrid_RotationShimRPP/goal_goal1/nav2_goal_lines.txt`: 30 × `RegulatedPurePursuitController detected
collision ahead!` (first at line 402), 4 × `Controller patience exceeded` (409, 422, 436, 449), then
`GridBased plugin failed to plan from (1.06, 0.03) to (0.20, 1.00): "no valid path found"` (454),
`… "Start occupied"` (457) and two more "no valid path found" (461, 464). The goal then succeeded
(`error_code 0`). The other 19 non-DWB pairs have no `[ERROR]`/`[FATAL]` line (`logs/nav2_errors.txt`).
Why this pair drove toward (1.06, 0.03) was not analysed: UNVERIFIED.

## 5. Bags

25 MCAP bags in `bags/matrix/<pair>/`, 13.4–23.5 MB each (`result.json` `bag_bytes`).
`parity/fixtures/bag_manifest.md` was rebuilt from disk: 71 bags in total, 1796962577 bytes, below the 8 GB limit.
The PC did not restart during the run, so no pair was redone.

## Decisions recorded

1. Step 0 was already done (d4311fb); no new commit.
2. The failed CLI `/amcl_pose` echo in the frame check is a secondary capture only; frame_check.py's direct value stands.
3. DWB kinematic params were not added (minimal-diff rule); the cause is documented from the effective params.
4. Leftover partial dirs `M/NavFn_{MPPI,DWB,RPP,RotationShimRPP}` from an earlier aborted start held only gitignored
   logs; `run_pair` deletes partial dirs before each run, so they were overwritten, not reused.
5. No script was changed in this session, so there is no scripts commit (the run used 732b64d, which is the
   frame-check fixture commit on top of the script commit 8e98d2b).

## 6. DWB follow-up: DWB with the installed burger.yaml kinematics (2026-10-17 21:39–21:49)

Source of the keys: `/opt/ros/jazzy/share/turtlebot3_navigation2/param/burger.yaml` lines 122–160
(`controller_server.FollowPath`, `plugin: "dwb_core::DWBLocalPlanner"` on line 121), package
`ros-jazzy-turtlebot3-navigation2 2.3.6-1noble.20261006.044113`. Every key of that block except `plugin` was added
to the step E DWB pair (36 keys: velocity/acceleration limits, `vx_samples` 20, `vtheta_samples` 40, `sim_time` 1.5,
granularities, `xy_goal_tolerance` 0.05, `trans_stopped_velocity` 0.25, critics and critic scales); each key and its
source line is listed in `M_dwb/<pair>/params.diff` (`M_dwb/` = `matrix_dwb_burger/`). Nothing else changed:
`enable_stamped_cmd_vel` (burger.yaml 99/161) is a server key, not DWB kinematics, and stays as installed (false).
Run: `run_matrix.py --dwb-burger` at 9097a3f (`run_info.txt`: `git_uncommitted_scripts=` empty).
Searched and not used: `nav2_bringup/params/nav2_params.yaml` (FollowPath is MPPI), `nav2_multirobot_params_*.yaml`
(DWB with no robot-specific limits beyond the critic list already used in section 2).

| Planner | DWB_burger result | sim s |
|---|---|---|
| NavFn | SUCCEEDED (error_code 0) | 4.00 |
| Smac2D | SUCCEEDED (error_code 0) | 3.77 |
| ThetaStar | SUCCEEDED (error_code 0) | 3.86 |
| SmacHybrid | SUCCEEDED (error_code 0) | 8.42 |
| SmacLattice | SUCCEEDED (error_code 0) | 4.66 |

`M_dwb/<pair>/result.json`, `M_dwb/matrix_results.json`. `params_effective/controller_server.yaml` confirms the values
in effect (e.g. NavFn: `acc_lim_x: 3.0`, `max_vel_x: 0.3`, `sim_time: 1.5`, `vtheta_samples: 40`). Logs:
`controller_server` "Reached the goal!", `bt_navigator` "Goal succeeded" (`goal_goal1/nav2_goal_lines.txt`); no
"Could not find a legal trajectory" line. /cmd_vel stayed `geometry_msgs/msg/Twist`. Domain 41 empty after every pair.
So the ABORTED 104 of section 4 comes from running DWB without any kinematics keys (DWB defaults), not from the
planners. Caveat: `tb3_simulation_launch.py` spawns `turtlebot3_waffle` by default (installed launch file lines 158,
163: `robot_name` `turtlebot3_waffle`, `gz_waffle.sdf.xacro`), so this "tb3_burger" nav2_bringup matrix drives the
waffle body with burger limits; the instruction asked for burger.yaml, and it was followed.
