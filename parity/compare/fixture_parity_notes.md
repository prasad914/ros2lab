## Main causes of the FAILs left (after step G, branch `parity-fixes`)

Fixed in step G (see `parity/reports/OVERNIGHT_FG.md`): /rosout QoS, slam_toolbox and cartographer graphs, the TF hook
(map -> odom), Nav2 QoS, failed-goal log lines, RViz 2 subscriptions and QoS, tb3_waffle_pi's official workspace,
tf2 listener and launch_ros nodes. sensors, slam and cartographer now pass every item for all three models.

1. **nav2_bringup `tb3_simulation_launch.py`.** The site starts the Nav2 nodes but has no model of the Gazebo world and
   robot that launch file starts (`gz` prints "no model of what this program does"), so there is no odom, Nav2 never
   activates and the 25 + 5 matrix pairs cannot run.
2. **Nav2 topics and nodes not modelled (nav_robotis).** Costmap layer topics (`*_layer*`, `clearing_endpoints`,
   `voxel_grid`), docking_server and route_server topics, `/diagnostics`, behavior_server teleop topics, the RViz Nav2
   panel selector topics, the bt_navigator `*_rclcpp_node` nodes, `rviz_navigation_dialog_action_client`, and the tf2
   listener nodes of the Nav2 servers. They account for the QoS and "topics + types" FAILs of nav_robotis.
3. **Goals near obstacles (tb3_burger).** In one site session after goal1–5, obstacle_goal ended ABORTED 208 and
   cylinder_centre gave no result within 240 s; real both SUCCEEDED (the reference ran them in fresh sessions from the
   start pose). In an earlier site run of the same spec both SUCCEEDED, so the site result varies run to run.
4. **NOT-VALIDATED** rows of tb3_waffle / tb3_waffle_pi nav_robotis are capture gaps of the reference snapshot
   (`ros2 topic info` said "Unknown topic" through the daemon for topics its topic list has); they need a recapture.
