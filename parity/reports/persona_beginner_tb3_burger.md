# P10 beginner persona — tb3_burger

**Outcome: PARTIAL / PENDING.** Browser observations are available, but fresh real-ROS evidence could not be captured. No real-vs-browser parity verdicts are claimed.

## Environment and evidence constraints

- Required real environment: `ROS_DOMAIN_ID=42`, `GZ_PARTITION=ref42`, headless/background, one simulation at a time, and stop with `bash parity/scripts/stop_reference.sh 42`.
- `ros-reference` attempted `bash /home/prasad/ros2lab-course/parity/scripts/check_env.sh`; permission to run Bash was denied. It stopped without starting a simulation or trying another route. No fresh real fixtures were generated, and simulation status could not be verified. Existing baseline snapshots are not substitutes.
- Browser artifacts are in `/home/prasad/ros2lab-course/parity/browser_out/tb3_burger/p10-beginner/`. Available files include JSON and screenshots for `no_tb3_model`, `wrong_fixed_frame`, `pose_estimate_during_slam`, `goal_before_initial_pose`, `goal_in_obstacle`, and `bad_map_path`, plus `control-attempts.json` and `notes.md`.
- The browser run was not independently rerun/verified. A later attempt to start a dev server failed with `OSError: [Errno 98] Address already in use`; the next Bash call to check the server and Playwright was denied. Existing artifacts are treated as observations, not a newly verified run.
- `notes.md` says the RViz viewer controls for 2D Pose Estimate and 2D Goal Pose were unavailable; Image and PointCloud2 display flows were not operated; robot pose history, `/amcl_pose` history, and costmap grids were missing.

## Per-mistake results

Browser text below is copied from the available JSON artifacts. Matching real captures are absent, so all verdicts remain pending. No `reported_real` hint is presented as fixture output.

| ID / level | Real behavior (fixture text) | Browser behavior (copied text) | Verdict | Faithful error first, helpful hint second? | Would course text have prevented it? / clarity |
|---|---|---|---|---|---|
| `no_tb3_model` / 1 | NO FIXTURE — real command not run after Bash permission denial. | `no_tb3_model.json`: `student@ros2lab:~/ros2_ws$ unset TURTLEBOT3_MODEL; ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py`; then `(Loading the official ROS 2 Jazzy workspace of TurtleBot3 Burger…)`. `errors` is empty. | PENDING | No error/hint pair observed; no verdict. | The artifact does not establish whether course text would have prevented this mistake. |
| `wrong_fixed_frame` / 1 | NO FIXTURE — real RViz reproduction not run. | `wrong_fixed_frame.json` contains error `bash: export: \`turtlebot3_world.launch.py\`: not a valid identifier`; another browser agent reports RViz status `Fixed Frame [map] does not exist` in this artifact. | PENDING | No faithful-error/hint sequence verified against real ROS. | Clarify that the environment-variable export and `ros2 launch` are separate commands. |
| `pointcloud_on_burger` / 2 | NO FIXTURE — real RViz reproduction not run. | Not operated; `notes.md` says the requested PointCloud2 display flow was not operated. | PENDING | PENDING | Course prevention not established. |
| `image_on_burger` / 2 | NO FIXTURE — real RViz reproduction not run. | Not operated; `notes.md` says the Image display flow was not operated. | PENDING | PENDING | Course prevention not established. |
| `pose_estimate_during_slam` / 4 | NO FIXTURE — real SLAM/initial-pose reproduction not run. | `pose_estimate_during_slam.json` includes `student@ros2lab:~/ros2_ws$ ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True`; the 2D Pose Estimate action was unavailable. | PENDING — injected action not observed. | PENDING | Course prevention not established. |
| `goal_before_initial_pose` / 5 | NO FIXTURE — real Nav2 reproduction not run. | `goal_before_initial_pose.json` includes `student@ros2lab:~/ros2_ws$ ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True`; the 2D Goal Pose action was unavailable. | PENDING — injected action not observed. | PENDING | Course prevention not established. |
| `bad_map_path` / 5 | NO FIXTURE — real map-server reproduction not run. | `bad_map_path.json` includes `student@ros2lab:~/ros2_ws$ ros2 launch nav2_bringup navigation_launch.py use_sim_time:=True map:=/tmp/ros2lab-nonexistent-map.yaml`; no map-server failure text appears in its captured `logs`/`errors`. | PENDING | No lifecycle error/hint pair observed. | Course prevention not established; clarify launch ordering and map argument format. |
| `goal_in_obstacle` / 7 | NO FIXTURE — real planner reproduction not run. | `goal_in_obstacle.json` includes launch setup through `student@ros2lab:~/ros2_ws$ ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True`; the obstacle goal action was unavailable. | PENDING — injected action not observed. | PENDING | Course prevention not established. |

## Course issues

- `no_tb3_model.json` records the unset-model command followed only by `(Loading the official ROS 2 Jazzy workspace of TurtleBot3 Burger…)`, with an empty `errors` array. This is browser output only; there is no real capture for comparison.
- Browser logs repeatedly show `bash: export: \`turtlebot3_world.launch.py\`: not a valid identifier`. Separate `export TURTLEBOT3_MODEL=burger` from `ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` in the interaction guidance.
- The `wrong_fixed_frame` browser artifact reportedly includes RViz status `Fixed Frame [map] does not exist`; this was not independently confirmed and has no matching real fixture.
- Viewer-dependent pose-estimation and goal-placement steps could not be completed because the RViz controls were unavailable. PointCloud2 and Image display steps were not attempted. These are completion limitations, not course-content parity judgments.
