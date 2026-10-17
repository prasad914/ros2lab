## Main causes (read from the FAIL rows below; step G works through them)

1. **tb3_waffle_pi has no official workspace on the site.** `rviz.html?robot=tb3_waffle_pi` opens a site-made
   workspace (`tb3_waffle_pi_gazebo`, `tb3_waffle_pi_bringup`, …); `ros2 launch turtlebot3_gazebo
   turtlebot3_world.launch.py` prints `Package 'turtlebot3_gazebo' not found`. The reference uses the ROBOTIS
   packages with `TURTLEBOT3_MODEL=waffle_pi`. Almost every tb3_waffle_pi FAIL follows from this.
2. **QoS profiles.** The site gives most endpoints RELIABLE/VOLATILE. Real: every node's `/rosout` publisher is
   TRANSIENT_LOCAL; `/map` (map_server, slam_toolbox, cartographer) and costmap publishers are TRANSIENT_LOCAL; sensor
   subscriptions (`/scan`, `/odom` in cartographer, Nav2) are BEST_EFFORT; `/amcl_pose` TRANSIENT_LOCAL,
   `/particle_cloud` BEST_EFFORT. Model endpoints in `ros-graph.js` also drop any QoS given by a model.
3. **Missing endpoints / topics.** Costmap layer topics (`*_layer`, `*_raw_updates`, `clearing_endpoints`,
   `voxel_*`), docking_server and route_server topics, `/diagnostics`, the RViz selector topics, tf listener
   subscriptions of the Nav2 nodes; slam_toolbox has extra `/initialpose` and `/bond`.
4. **TF hook.** `window.__ros2lab.tf` reads a buffer pre-filled with the robot tree; it never shows `map -> odom`,
   although the graph's own TF tree (`ros2 run tf2_tools view_frames`, `tf2_echo`) has it.
5. **nav2_bringup `tb3_simulation_launch.py`.** The site starts the Nav2 nodes but has no model of the Gazebo world
   that launch file starts (`gz` prints "no model of what this program does"), so no robot, no `odom`, Nav2 never
   activates, and the matrix cannot run.
6. **Goal failure texts.** For the outside-map goal the site ends with the right status and error_code 204, but prints
   `[INFO] [bt_navigator]: Goal failed` (real: ERROR) and no `[ActionServer] Aborting handle.` lines.
7. **Goal results near obstacles.** In the single site session obstacle_goal ended ABORTED 208 and cylinder_centre gave
   no result within 240 s; real both SUCCEEDED (the reference ran them in fresh sessions from the start pose).
