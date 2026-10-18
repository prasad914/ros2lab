# Real-ROS captures for expert_review_2026-10-18.md

Made 2026-10-18 on this machine (Ubuntu 24.04, Jazzy apt packages) with
`parity/scripts/capture_review_items.sh <a|b|c|d|e> 41` (ROS_DOMAIN_ID 41, GZ_PARTITION review_41). The script checks
the domain is empty before, stops with `stop_reference.sh 41` and checks it is empty after; all five runs printed
"domain 41 empty (after)". `*.log` files are gitignored; the tracked `.txt` next to each is an every-line excerpt
written by `parity/scripts/log_excerpts.py`. World runs: `run_info.txt` in the folder named below (it records
`model=burger`; the `TURTLEBOT3_MODEL=<unset>` in the header line of d/e is the capture shell, not the launch).

| Item | What | Files | Result |
|---|---|---|---|
| a | `turtlebot3_world.launch.py`, TURTLEBOT3_MODEL unset | `sensors/errors/no_tb3_model/launch_runner.txt` | `[ERROR] [launch]: Caught exception in launch (see debug for traceback): 'TURTLEBOT3_MODEL'`, exit code 1, no process started |
| b | `navigation2.launch.py map:=$HOME/map.yaml` (missing), `timeout 180` | `nav_robotis/errors/bad_map_path/nav2_runner.txt`, `lifecycle_after_runner.txt`, world `run_info.txt` | map_server fails configure about 5.6 s after start (lines 63-71); then 196 "Timed out waiting for transform from base_link to map" INFO lines, planner_server fails at +121 s (lines 586-588); the launch does not exit by itself: killed by timeout, exit 124 |
| c | `ros2 topic info /cmd_vel -v --no-daemon` while each teleop runs (TTY via `script -qc`) | `sensors/teleop/topic_info_cmd_vel_*_runner.txt`, `*_tty_runner.txt`, `world/run_info.txt` | plain `teleop_twist_keyboard`: publisher `geometry_msgs/msg/Twist`, Type list shows both types; `turtlebot3_teleop teleop_keyboard` and `teleop_twist_keyboard --ros-args -p stamped:=true`: TwistStamped |
| d | `ros2 topic hz /map --use-sim-time` under slam_toolbox, robot standing still | `slam/samples/map_hz_runner.txt`, `slam/review_map_hz/run_info.txt` | average rate 0.323 … 0.351, periods 2.683-3.451 s |
| e | one `/imu` sample + `topic info -v` | `sensors/samples/imu_runner.txt`, `sensors/review_imu/run_info.txt` | frame_id `burger/imu_link/tb3_imu`, orientation covariance all 0.0, angular velocity covariance 4e-08 diagonal, linear acceleration covariance 0.000289 diagonal |
| f | `/odom` position before / after 6 s of `ros2 topic pub -r 10 /cmd_vel` with Twist, then with TwistStamped (x 0.2) | `sensors/teleop/twist_vs_stamped_runner.txt`, `sensors/teleop/world_f/run_info.txt` | Twist: x 9.6e-09 -> 9.6e-09 (robot does not move); TwistStamped: x -> 1.234 |
