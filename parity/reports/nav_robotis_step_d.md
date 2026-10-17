# Nav2 ground truth, nav_robotis (installed turtlebot3_navigation2) – step D (2026-10-17)

Real ROS 2 Jazzy, domain 41, partition ref41, REF_RENDER=egl, `use_sim_time:=True`, map
`parity/fixtures/maps/turtlebot3_world.yaml`, one simulation at a time. Installed config, no parameter changed at runtime
(collision_monitor `scan.source_timeout` stays at burger.yaml's 0.2; instructor decision). All paths below are under
`parity/fixtures/`. Bags (MCAP) are gitignored: `tb3_burger/nav_robotis/bags/run1` … `run10`, 422 MB in total.

## tb3_burger, 10 runs × goal1–goal5 (`run_nav_trials.sh`, `analyze_nav_trials.py`)

Source: `tb3_burger/nav_robotis/navigation_statistics.md`, `runs/run<N>.json`, `runs/run<N>_runner.txt`,
`runs/run<N>_logs/run_info.txt` (git_commit: f511fe2 for runs 1, 3–5, 7–10; bdabda8 run6; 7017023 run2; no
uncommitted scripts in any run). Durations: sim seconds from goal accepted to result (drive_goals.py node clock).

| goal | succeeded | mean | min | max |
|---|---|---|---|---|
| goal1 | 10 / 10 | 5.27 s | 4.44 s | 6.03 s |
| goal2 | 10 / 10 | 22.98 s | 18.77 s | 28.48 s |
| goal3 | 10 / 10 | 12.15 s | 8.98 s | 15.03 s |
| goal4 | 10 / 10 | 19.94 s | 17.28 s | 23.61 s |
| goal5 | 10 / 10 | 17.28 s | 14.21 s | 22.70 s |
| circuit | 50 / 50 | 77.62 s | 68.73 s | 83.80 s |

- Cross-check (`tb3_burger/nav_robotis/bag_goal_durations.txt`, `parity/scripts/bag_goal_durations.py`): in each bag
  the bt_navigator `NavigateRecovery` RUNNING -> SUCCESS span (bag receive time, sim) is 0.48–0.79 s longer than the
  drive_goals.py duration, for goal1–goal4 of all 10 runs. goal5: **PENDING** – its SUCCESS event is not in the bags
  (recording stops right after the driver exits).
- collision_monitor with the installed `scan.source_timeout: 0.2` and /scan at 5.000 Hz sim: "Robot to stop due to
  invalid source" after "[scan]: Latest source and current collision monitor node timestamps differ on 0.201000
  seconds. Ignoring the source.", each followed by "Robot to continue normal operation"; 121, 210, 155, 152, 139, 151,
  176, 132, 151, 122 stops in runs 1–10 (`runs/run<N>_logs/collision_monitor.txt`). All goals still succeeded.
- Repeated runs (failed attempts kept): run6 attempt 1 and run2 attempt 2 – `record_bag.sh start`: "none of the parity
  topics exist yet" (`runs/run6_attempt1_runner.txt`, `run2_attempt1_clock_bug/run2_attempt2_runner.txt`); run2
  attempt 1 – goal1 timed against a node clock still at 0: 29.24 s "sim" in 6.95 s wall
  (`run2_attempt1_clock_bug/run2_runner.txt`). Fixed in bdabda8 / 7017023 and 0f42e7c.
- Smoke run with the earlier runtime override `scan.source_timeout` 1.0 and the stale /amcl_pose error metric:
  `smoke_2026-10-17_source_timeout_override/` – not part of the statistics.

## /cmd_vel and the action interface (tb3_burger, `tb3_burger/nav_robotis/session_obstacle_goal/`)

- `ros2 topic info /cmd_vel -v --no-daemon --spin-time 5` before and after the goal (`cmd_vel_info_no_daemon.txt`,
  `cmd_vel_info_no_daemon_after_goal.txt`): type `geometry_msgs/msg/TwistStamped`; publishers `collision_monitor` and
  `docking_server`, subscriber `ros_gz_bridge`; all endpoints TwistStamped, RELIABLE, VOLATILE.
- No second /cmd_vel type was seen: not in these captures, not in `topic_list_no_daemon.txt`, and not in any
  committed `topic_list.txt` (all list `/cmd_vel [geometry_msgs/msg/TwistStamped]`).
- Through the ROS 2 daemon the same command gave 0 subscribers here (`cmd_vel_info.txt`) and 0 publishers in the first
  session (`session_obstacle_goal_attempt1/cmd_vel_info.txt`): the daemon's graph was incomplete. Capture scripts now
  list without the daemon (6517dd3, 7017023).
- `NavigateToPose_interface.txt`: result `uint16 NONE=0`, `uint16 error_code`, `string error_msg`; feedback
  `current_pose`, `navigation_time`, `estimated_time_remaining`, `number_of_recoveries`, `distance_remaining`.

## obstacle_goal (1.893, 0.430), an OCCUPIED cell of the nav map

`session_obstacle_goal/goal_obstacle_goal/` (`result.json`, `feedback.jsonl`, `nav2_goal_lines.txt`):
status 4 SUCCEEDED, `error_code` 0, `error_msg` "", 19.48 s sim. Last feedback: pose (1.771, 0.287), 0.188 m from the
goal point, `distance_remaining` 0.035, 0 recoveries. Log: bt_navigator "Begin navigating from current location (0.05,
0.00) to (1.89, 0.43)", controller_server "Reached the goal!", bt_navigator "Goal succeeded"; no planner_server line.
The first session gave the same result (SUCCEEDED, error_code 0, 14.47 s; `session_obstacle_goal_attempt1/`).

## tb3_waffle and tb3_waffle_pi, one session each (`<robot>/nav_robotis/session_goal1/`)

- goal1: SUCCEEDED, error_code 0 – waffle 3.63 s sim, waffle_pi 3.60 s sim (`goal_goal1/result.json`).
- Params file (`params_file.txt`): navigation2.launch.py lines 40–55 use `param/<TURTLEBOT3_MODEL>.yaml` when ROS_DISTRO
  is not humble; the launch processes have TURTLEBOT3_MODEL=waffle / waffle_pi, so `waffle.yaml` / `waffle_pi.yaml`;
  both files have the same sha256 (5610a118…); robot_radius 0.15 on both costmaps (burger.yaml: 0.1).
  tb3_burger: `model=burger` (`runs/run<N>_logs/run_info.txt`), so `burger.yaml`.
- Snapshot (`snapshot/`): 111 topics, 31 nodes on both. Parameter services timed out for `/nav2_container` and four
  `transform_listener_impl_*` nodes on both. Lifecycle: the two `bt_navigator_*_rclcpp_node` are not lifecycle nodes
  ("Node not found"); `waypoint_follower` (waffle) and `planner_server` (waffle_pi) gave no answer within 5 s:
  **PENDING**. The first snapshots (`session_goal1_attempt1/`) were taken through the daemon; the waffle one lists 3 nodes.

## Not covered here

Readiness (navigation lifecycle needs the initial pose): `parity/reports/nav2_readiness.md`.
