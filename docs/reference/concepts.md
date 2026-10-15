# Short concept cards for robot pages (student-facing)

Rule for the site: one or two short lines per idea, no long paragraphs. Use these as the starting text; the instructor may edit.

| Concept | Card text |
|---|---|
| TF | A tree of coordinate frames. Every sensor reading says which frame it is in; TF converts between them. |
| map / odom / base_link | `map` = fixed world. `odom` = smooth but drifts. `base_link` = the robot itself. |
| Fixed Frame | The frame RViz draws everything in. Pick `odom` before you have a map, `map` after SLAM or AMCL. |
| URDF | The robot's body description: links, joints, sensors. |
| LaserScan | One ring of distances from the LiDAR, drawn as points. |
| Camera image | Waffle and Waffle Pi have an RGB camera. Burger has none. |
| PointCloud2 | 3D points from a depth camera. Standard TurtleBot3 models do not publish one. |
| cmd_vel | Velocity command to the robot. In Jazzy TurtleBot3 it is TwistStamped. |
| Odometry | Where the wheels think the robot is. Good short-term, drifts over time. |
| SLAM | Build a map while finding yourself in it. Save the map before you stop. |
| Global map | The saved map of the whole world, in the `map` frame. |
| Local map | A small window around the robot, in `odom`, updated from live sensors. |
| Costmap | A grid of "how risky is this cell": 0 free, 253 inscribed, 254 lethal, 255 unknown. |
| Inflation | Cost spreads out from obstacles so paths keep a safe distance. |
| Global costmap | Built on the global map; the planner uses it. |
| Local costmap | Rolling window around the robot; the controller uses it to dodge obstacles. |
| AMCL | Many guesses (particles) of where the robot is; scans that match the map keep their guesses alive. |
| 2D Pose Estimate | Tell AMCL roughly where the robot starts. Until then the `map` frame is not connected. |
| 2D Goal Pose | Send the robot a target position and heading. |
| Global planner | Finds a path on the global costmap (NavFn, Smac, Theta*). |
| Controller | Follows the path and avoids nearby obstacles (MPPI, DWB, Pure Pursuit). |
| Behaviour tree | The decision logic: plan, follow, and recover (spin, back up, wait) when stuck. |
| Recovery | What Nav2 tries when it cannot make progress. |
| Lifecycle | Nav2 nodes start inactive and must be activated before they work. |
| Waypoints | A list of goals visited in order. |
| Keepout zone | An area the robot must never enter. |
| Speed zone | An area where the robot must slow down. |
| Collision monitor | Last safety check: stops or slows the robot if something is too close. |
| QoS | Delivery rules for a topic. Reliable vs best effort, and whether late joiners get the last message. |
| use_sim_time | In simulation every node must use Gazebo's clock, or TF timestamps disagree. |
