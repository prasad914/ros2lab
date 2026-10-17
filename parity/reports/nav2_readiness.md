# Nav2 readiness with turtlebot3_navigation2 – navigation lifecycle waits for the initial pose (2026-10-17)

Real ROS 2 Jazzy, tb3_burger, `nav_robotis` (`turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True`,
map `parity/fixtures/maps/turtlebot3_world.yaml`), domain 41, REF_RENDER=egl. No `/initialpose` was published.
Evidence: `parity/fixtures/tb3_burger/nav_robotis/readiness_deadlock_2026-10-17/excerpt.txt` (grep output with line
numbers) and `runner.txt` (every line of runner.log, from `log_excerpts.py`); the full `nav2.log`, `gazebo.log` and
`runner.log` beside them are gitignored and kept on this machine.

## What real ROS does

1. lifecycle_manager_localization brings map_server and amcl up; AMCL warns every few seconds
   `AMCL cannot publish a pose or update the transform. Please set the initial pose...` (nav2.log 305, 92 times).
2. lifecycle_manager_navigation configures all its nodes, activates controller_server and smoother_server,
   then `Activating planner_server` (311). The global costmap logs `Activating`, `Checking transform`, then every
   0.5 s: `Timed out waiting for transform from base_link to map to become available, tf error: Invalid frame ID "map"
   passed to canTransform argument target_frame - frame does not exist` (315 … 606, 197 lines).
   The `map` frame does not exist because AMCL publishes map -> odom only after an initial pose.
3. After about 98 s wall the bringup fails and is not retried:
   - `[ERROR] [global_costmap.global_costmap]: Failed to activate global_costmap because transform from base_link to map did not become available before timeout` (607)
   - `[ERROR] [lifecycle_manager_navigation]: Failed to change state for node: planner_server` (608)
   - `[ERROR] [lifecycle_manager_navigation]: Failed to bring up all requested nodes. Aborting bringup.` (609)
4. At 301 s wall: `lifecycle_manager_navigation` `is_active` is false; controller_server and smoother_server are
   active, planner_server, route_server, behavior_server, velocity_smoother, collision_monitor, bt_navigator,
   waypoint_follower and docking_server are inactive (`runner.txt` 10–11). The `navigate_to_pose` action server
   exists (`runner.txt` 8) although bt_navigator is inactive.

The timeout matches the global costmap's `initial_transform_timeout: 60.0` (captured params, 2026-10-15 snapshot;
not set in the installed `burger.yaml`, so the Nav2 default). rviz2 message stamps put the activation at about
sim 9 s and the failure at about sim 66 s. **UNVERIFIED:** whether the 60 s is counted in sim or wall time
(those stamps are approximate; not checked in the Nav2 source).

So: the initial pose must be set within that timeout after `Activating planner_server`. Otherwise the navigation
stack stays down until relaunch, and setting the pose later does not bring it up (that last point was not tested
separately: **PENDING**).

## What the website must do

- Same order and texts: AMCL "Please set the initial pose..." warnings; navigation lifecycle stops at planner_server
  with the global_costmap "Timed out waiting for transform from base_link to map" lines; navigation nodes not active
  before the initial pose.
- If no pose is given within the timeout: the three ERROR lines above and `Aborting bringup`; goals cannot run
  until relaunch.
- Beginner hint after the real text: "Set the robot's start pose first (RViz 2D Pose Estimate or /initialpose)."
- Website behaviour: **PENDING** (not checked in this step).

## Effect on the parity scripts

`run_nav_trials.sh` and `run_nav_session.sh` now wait for lifecycle_manager_localization, publish the start pose
until `/amcl_pose` arrives, and only then wait for lifecycle_manager_navigation (commit 2f5f1af).
