# Simulation inventory: every robot and every workspace entry (2026-10-19)

Branch `parity-v2` (HEAD 1924402). This is a read-only audit: no code, content or fixtures were changed, and no real ROS 2 was run.
Real evidence comes from `parity/fixtures/` on this branch and from branch `origin/robots-p2b` (848765c, **not merged** into parity-v2). The arm, scout and tb4 install_check and MoveIt fixtures exist only on that branch. Read them with `git show origin/robots-p2b:<path>`.

## Totals

There are 56 simulation entries in the 9 official workspaces (12 robots) plus 21 gallery-only robots, so 33 robots in `public/robots/index.json`.

| Status | Rows |
|---|---|
| VERIFIED | **7**: tb3_burger / tb3_waffle / tb3_waffle_pi `sim#1` (turtlebot3_world) and `slam` (cartographer), xarm6 `sim#1` |
| DIFFERS | **17** (one of them, fr3 `sim#2`, is also BROKEN on site) |
| NO FIXTURE | **32** (two of them, fr3 `sim#1` and wx250s `fake`, are also BROKEN on site) |
| BROKEN on site (overlaps the rows above) | **3**: fr3 `sim#1`, fr3 `sim#2`, wx250s `fake` |
| Gallery-only, no real counterpart | **21**: all launch their ROS2Lab `display.launch.py` cleanly |
| Not run (hardware or interactive entries) | `real` ×9 workspaces, `teleop` (tb3, crazyflie), `map_save` (tb3), `example` (ur5e `ros2 run ur_robot_driver example_move.py`), and the `sim_note` text entries of interbotix, crazyswarm2 and scout |

No entry produced a page error (pageerror or console error) in this run.

## How this was run

- The entry list was read from `public/robots/ws/index.json` and each `public/robots/ws/<ws>/workspace.json` `entry`. I used the same filter as `tests/real-sweep.mjs`: `ros2 launch` commands only, without the `note|issues|real|map_save|teleop` kinds, and with per-robot entries (`e.robot`) respected. The result is `parity/browser_out/sim_inventory/_jobs.json` (56 jobs).
- Runner: a copy of the `tests/real-sweep.mjs` / `tests/real-entry.mjs` steps built on `tests/real-lib.mjs` `openRobot/run/screens`. The site was on http://localhost:8080 and Pyodide came from the CDN. For each entry the runner:
  1. opened `rviz.html?robot=<id>`;
  2. ran `cd ~/ros2_ws`, `colcon build --symlink-install`, `source install/setup.bash` and the page's `export` env;
  3. ran the entry command and waited **45 s** (`SECS=45`);
  4. saved the terminal, the graph state (`window.__ros2lab.sh.graph`: gz models, nodes, `topics()`, controllers) and `ros2 node list`, `ros2 topic list` and `ros2 control list_controllers` typed in new terminal tabs.

  It ran as 3 parallel shards (`SHARD=0..2 NSHARD=3`). The runner was a scratchpad script and is not in the repo.
- Raw output for each entry is in `parity/browser_out/sim_inventory/<robot>__<kind><n>.txt` (for example `tb3_burger__nav1.txt`). The progress log is `_progress.log`.
- Gallery robots: each `rviz.html?robot=<id>` page was opened and the default (`display`) commands shown in `#cmds` were run, followed by a 20 s wait. Output: `parity/browser_out/sim_inventory/<id>__gallery.txt`.
- Topic and node comparisons are set differences of names between the site's `ros2 topic list` / `ros2 node list` tab and the fixture list. The anonymous names `/transform_listener_impl_*`, `*_private_*`, `/interactive_marker_display_*`, `/moveit_<n>` and `/launch_ros_*` are ignored.
- Every entry was launched on its own in a fresh page. Cartographer and Nav2 therefore ran without Gazebo, while the real fixtures ran them with Gazebo. Comparisons only use facts that do not depend on that.

## Fixture map (what real evidence exists)

| Robot | Real install status (STATUS.md) | Fixture dirs | Branch |
|---|---|---|---|
| tb3_burger / tb3_waffle / tb3_waffle_pi | OFFICIAL-JAZZY, verified (both branches) | `install_check/`, `sensors/` (= turtlebot3_world), `cartographer/`, `slam/` (slam_toolbox, not a site entry), `nav_robotis/` (navigation2.launch.py with `map:=parity/fixtures/maps/turtlebot3_world.yaml` + Gazebo); burger only: `nav2_bringup/`, `nav_robotis/errors/bad_map_path/` | parity-v2 and p2b |
| ur5e | p2b: OFFICIAL-JAZZY verified; parity-v2: NOT VERIFIED | `install_check/`, `sim/`, `moveit/` | p2b |
| fr3 | p2b: OFFICIAL-JAZZY (franka_description **7aeeddc4** / 2.9.0); parity-v2: NOT BUILT | `install_check/`, `sim/`, `moveit/` | p2b |
| gen3 | p2b: OFFICIAL-JAZZY; parity-v2: NOT BUILT | `install_check/`, `sim/`, `moveit/` | p2b |
| xarm6 | p2b: OFFICIAL-JAZZY; parity-v2: NOT BUILT | `install_check/`, `sim/`, `sim_attempt1_no_controllers/`, `moveit/` | p2b (logs `*.log` are gitignored, present in this working tree only) |
| lite6 | p2b: OFFICIAL-JAZZY; parity-v2: NOT BUILT | `install_check/`, `sim/`, `moveit/` | p2b |
| cr5 | p2b: OFFICIAL-JAZZY; parity-v2: NOT BUILT | `install_check/`, `sim/`, `moveit/` | p2b |
| wx250s | p2b: **ROS2LAB-PORT** (jazzy-ros2lab branch); parity-v2: NOT BUILT | `install_check/` (xsarm_ros_control fake), `gz/` (port's Gazebo Harmonic launch), `moveit/` | p2b |
| scout | p2b: **ROS2LAB-PORT** (ugv_gazebo_sim humble → jazzy-ros2lab); parity-v2: NOT BUILT | `install_check/`, `sim/`, `p2c_sensors/` — all for `scout_gazebo_sim scout_v2_gz.launch.py`, which **is not a site entry** | p2b |
| crazyflie | NOT BUILT on both branches (needs swig + rowan via `robots_sudo.sh`) | none | – |
| tb4 | p2b: OFFICIAL-JAZZY | many (`install_check/`, `p2c_*`) | p2b. **tb4 has no page on the site** (not in index.json) |
| 21 gallery robots | NOT BUILT (ROS2Lab course robots or description-only) | none | – |

The real launch commands of the arm fixtures come from `origin/robots-p2b:parity/robots/<robot>/scenarios/{sim,moveit}.sh`. Where these differ from the site entry, the row says so.

## Inventory: official workspaces

"Clean" means: no `[ERROR]`, no Traceback, no "has died", no "no model" note, and no page error, apart from errors that are expected and the same in real ROS.

### turtlebot3 (tb3_burger, tb3_waffle, tb3_waffle_pi)

| Robot | Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|---|
| tb3_burger | sim#1 | `ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | `parity/fixtures/tb3_burger/install_check/topics.txt`, `sensors/node_list.txt` | clean | **VERIFIED**: the topic list is identical (11 names: /clock /cmd_vel /imu /joint_states /odom /parameter_events /robot_description /rosout /scan /tf /tf_static) and the nodes are identical (/robot_state_publisher, /ros_gz_bridge). Site output: `tb3_burger__sim1.txt`. `parity/reports/fixture_parity.md` sensors: 19 PASS / 0 FAIL |
| tb3_waffle | sim#1 | same | `parity/fixtures/tb3_waffle/install_check/topics.txt`, `sensors/node_list.txt` | clean | **VERIFIED**: 17 topics identical (adds the /camera/* set), 3 nodes identical (+/ros_gz_image). `tb3_waffle__sim1.txt`. fixture_parity sensors 29 PASS / 0 FAIL / 1 PENDING-THRESHOLD |
| tb3_waffle_pi | sim#1 | same | `parity/fixtures/tb3_waffle_pi/install_check/topics.txt`, `sensors/node_list.txt` | clean | **VERIFIED**: 17 topics and 3 nodes identical. `tb3_waffle_pi__sim1.txt`. fixture_parity sensors 29/0/1 |
| all 3 | sim#2 | `ros2 launch turtlebot3_gazebo empty_world.launch.py` | none | clean (same 11/17 topics as sim#1) | NO FIXTURE |
| all 3 | sim#3 | `ros2 launch turtlebot3_gazebo turtlebot3_house.launch.py` | none | clean | NO FIXTURE |
| all 3 | slam | `ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True` | `parity/fixtures/<robot>/cartographer/` | clean (standalone: cartographer_node, cartographer_occupancy_grid_node, rviz2) | **VERIFIED** (from the existing report): fixture_parity cartographer burger 24 PASS / 0 FAIL, waffle 30/0, waffle_pi 30/0 (captured 2026-10-18, after the merged parity-fixes). Node names in `tb3_*__slam1.txt` match `cartographer/node_list.txt`, apart from the Gazebo nodes this standalone run did not start |
| tb3_burger | nav#1 | `ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True` | `parity/fixtures/tb3_burger/nav_robotis/` (ran with `map:=…/turtlebot3_world.yaml` + Gazebo) | launches (only the expected "Timed out waiting for transform" INFO, because there was no Gazebo) | **DIFFERS**: fixture_parity nav_robotis 99 PASS / **56 FAIL** (topics 105 real vs 71 site: costmap layer topics, /diagnostics, docking/route topics, `bt_navigator_*_rclcpp_node` nodes, QoS). This run also found that every log line from the Nav2 container lacks the process prefix. Real (`nav_robotis/logs/nav2.log`): `[component_container_isolated-1] [INFO] [...] [amcl]: Creating`. Site (`tb3_burger__nav1.txt`): `[INFO] [...] [amcl]: Creating` (0 prefixed lines on the site) |
| tb3_waffle | nav#1 | same | `tb3_waffle/nav_robotis/` | launches | **DIFFERS**: fixture_parity 67 PASS / 49 FAIL / 26 NOT-VALIDATED; the container prefix is missing too (`tb3_waffle__nav1.txt`) |
| tb3_waffle_pi | nav#1 | same | `tb3_waffle_pi/nav_robotis/` | launches | **DIFFERS**: fixture_parity 73 PASS / 42 FAIL / 27 NOT-VALIDATED; same prefix difference |
| tb3_burger | nav#2 | `… navigation2.launch.py use_sim_time:=True map:=$HOME/map.yaml` (no map saved yet) | `parity/fixtures/tb3_burger/nav_robotis/errors/bad_map_path/nav2_runner.log` | expected error | **DIFFERS** (small): the 7 error lines match word for word: `[map_io]: Failed processing YAML file … bad file`, `Caught exception in callback for transition 10`, `Original error: Failed to load map yaml file`, `Callback returned ERROR during the transition: configure`, `[FATAL] … does not have error state implemented`, `Failed to change state for node: map_server`, `Failed to bring up all requested nodes. Aborting bringup.` The difference is again the missing `[component_container_isolated-1]` prefix. A ROS2Lab hint follows the errors. `tb3_burger__nav2.txt` |
| tb3_waffle, tb3_waffle_pi | nav#2 | same | none (the bad-map fixture is burger only) | expected error, same text as burger | NO FIXTURE |
| all 3 | rviz | `ros2 launch turtlebot3_bringup rviz2.launch.py` | none | clean | NO FIXTURE |
| all 3 | fake | `ros2 launch turtlebot3_fake_node turtlebot3_fake_node.launch.py` | none | clean (fake node, rsp, rviz2) | NO FIXTURE |

### ur (ur5e)

| Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|
| sim | `ros2 launch ur_simulation_gz ur_sim_control.launch.py ur_type:=ur5e` | `origin/robots-p2b:parity/fixtures/ur5e/install_check/{controllers,topics}.txt` (real used `gazebo_gui:=false launch_rviz:=false`) | clean | **DIFFERS**: the controllers match (scaled_joint_trajectory_controller and joint_state_broadcaster active on both). Topics present only in real: `/controller_manager/introspection_data/{full,names,values}`, `/controller_manager/statistics/{full,names,values}`, `/scaled_joint_trajectory_controller/speed_scaling_input`. The site's /clicked_point, /goal_pose and /initialpose come from RViz, which the real capture turned off. `ur5e__sim1.txt` |
| moveit#1 | `ros2 launch ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e` | `…/ur5e/moveit/{node_list,topic_list,controllers}.txt` (same command, under xvfb) | clean. The `Cannot infer URDF/SRDF … using config/ur.urdf` WARNING also appears in the real `moveit/logs/moveit.log` | **DIFFERS**: controllers match. Nodes present only in real: /gz_ros_control, /move_group/moveit, /moveit_simple_controller_manager. Topics present only in real: the 6 controller_manager introspection/statistics topics, /pipeline_state, /recognized_object_array, `/rviz_moveit_motion_planning_display/robot_interaction_interactive_marker_topic/{feedback,update}`, /scaled_joint_trajectory_controller/speed_scaling_input. Topic present only on the site: /motion_plan_request. `ur5e__moveit1.txt` |
| moveit#2 | `ros2 launch ur_robot_driver ur_control.launch.py ur_type:=ur5e robot_ip:=yyy.yyy.yyy.yyy use_mock_hardware:=true launch_rviz:=false` | none | launches. 17 controllers (8 active). Honest note: `trajectory_until_node … has no model of how it handles goals` | NO FIXTURE |
| rviz | `ros2 launch ur_description view_ur.launch.py ur_type:=ur5e` | none | clean | NO FIXTURE |

### franka (fr3)

| Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|
| sim#1 | `ros2 launch franka_gazebo_bringup visualize_franka_robot.launch.py` | none | **errors**: `[ros2-7] Could not contact service /controller_manager/load_controller`, then `[ERROR] [ros2-7]: process has died [… 'ros2 control load_controller --set-state active joint_state_broadcaster']`. The robot spawns, but there is no controller_manager. `fr3__sim1.txt` | **NO FIXTURE + BROKEN on site**. UNVERIFIED whether real Jazzy fails the same way: no real run of this launch file exists |
| sim#2 | `ros2 launch franka_gazebo_bringup gazebo_franka_arm_example_controller.launch.py load_gripper:=true franka_hand:='franka_hand' controller:='joint_impedance_example_controller'` | `…/fr3/install_check/` for the **same launch file with other args** (`robot_type:=fr3 controller:=joint_position_example_controller gz_args:='-r -s empty.sdf' rviz:=false`, load_gripper left at its default false) | **errors**: `[robot_state_publisher]: link 'fr3_link0' has two parents: joints 'world_joint' and 'fr3_base_joint'`, `[ros_gz_sim]: Entity creation failed`, create died (255), spawner died (`Controller manager not available`). No model in Gazebo and 0 controllers. `fr3__sim2.txt` | **DIFFERS + BROKEN on site**: real had joint_position_example_controller and joint_state_broadcaster active and the arm moved (`install_check/motion_proof.txt`); the site has nothing spawned. The site's `public/robots/ws/franka/franka.repos` pins franka_description **72baf5bf**, but the real build used **7aeeddc4** (2.9.0, STATUS.md p2b). UNVERIFIED whether real fails with the site's exact args (load_gripper:=true was never run for real) |
| moveit | `ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=dont-care use_fake_hardware:=true` | `…/fr3/moveit/` (same command) | clean | **DIFFERS**: controllers match (fr3_arm_controller and joint_state_broadcaster active). Nodes present only in real: /frankahardwareinterface, /moveit, /moveit_simple_controller_manager. Topics present only in real: the 6 controller_manager introspection/statistics topics, /pipeline_state, /recognized_object_array. Topic present only on the site: **/clock** (fake hardware with no simulator; real has no /clock) and /motion_plan_request. `fr3__moveit1.txt` |
| rviz | `ros2 launch franka_description visualize_franka.launch.py robot_type:=fr3` | none | clean | NO FIXTURE |

### kortex (gen3)

| Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|
| sim | `ros2 launch kortex_bringup kortex_sim_control.launch.py use_sim_time:=true launch_rviz:=false` | `…/gen3/install_check/`, `parity/fixtures/gen3/sim/logs/sim.log` (real added `sim_gazebo:=true`) | launches. The gripper spawner error is **the same as real**: `Unable to activate controller 'robotiq_gripper_controller' since the command interface 'robotiq_85_left_knuckle_joint/position' is not available` and `spawner-7 … process has died`, in the real log too | **DIFFERS**: all 5 controllers and their states match (jtc and jsb active; twist, joint_group_velocity and robotiq_gripper inactive). Topics present only in real: the 6 controller_manager introspection/statistics topics, /joint_trajectory_controller/speed_scaling_input, /twist_controller/commands. The site prints `Failed to activate controller` twice; real prints it once. `gen3__sim1.txt` |
| moveit#1 | `ros2 launch kinova_gen3_7dof_robotiq_2f_85_moveit_config sim.launch.py use_sim_time:=true` | `…/gen3/moveit/` (real started kortex_sim_control **and** this file) | clean. Starts move_group and rviz2 only, as the upstream sim.launch.py does | **DIFFERS** (partly comparable): /move_group/moveit and /moveit_simple_controller_manager are missing, as for every arm. The other real nodes come from the separate kortex_sim_control launch. A student who runs only this entry gets MoveIt with no robot or controllers. `gen3__moveit1.txt` |
| moveit#2 | `… robot.launch.py robot_ip:=yyy.yyy.yyy.yyy use_fake_hardware:=true` | none | clean | NO FIXTURE |
| rviz | `ros2 launch kortex_description view_robot.launch.py` | none | clean | NO FIXTURE |
| fake | `ros2 launch kortex_bringup gen3.launch.py robot_ip:=yyy.yyy.yyy.yyy use_fake_hardware:=true` | none | clean | NO FIXTURE |

### xarm (xarm6, lite6)

| Robot | Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|---|
| xarm6 | sim#1 | `ros2 launch xarm_gazebo xarm6_beside_table_gazebo.launch.py` | `…/xarm6/sim_attempt1_no_controllers/` (log: `parity/fixtures/xarm6/sim_attempt1_no_controllers/logs/sim.log`, gitignored, local only) | clean, no controllers loaded (load_controller defaults to false) | **VERIFIED** (limited): the same 4 processes in the same order on both (robot_state_publisher-1, parameter_bridge-2, create-3, gazebo-4), and no spawners on either side. `xarm6__sim1.txt` |
| xarm6 | sim#2 | `… xarm6_beside_table_gazebo.launch.py load_controller:=true show_rviz:=true` | `…/xarm6/install_check/` (real without show_rviz) | clean | **DIFFERS**: controllers match (xarm6_traj_controller and jsb active). Topics present only in real: the 6 controller_manager introspection/statistics topics. `xarm6__sim2.txt` |
| xarm6 | moveit#1 | `ros2 launch xarm_moveit_config xarm6_moveit_fake.launch.py` | none | clean | NO FIXTURE |
| xarm6 | moveit#2 | `ros2 launch xarm_moveit_config xarm6_moveit_gazebo.launch.py` | `…/xarm6/moveit/` (same command) | clean | **DIFFERS**: nodes present only in real: /gz_ros_control, /move_group/moveit, /moveit_simple_controller_manager. Real has 44 topics, the site 26. Missing on the site: the RViz MotionPlanning topics `/rviz/moveit/{execute,plan,stop,select_planning_group,update_goal_state,update_start_state,update_custom_goal_state,update_custom_start_state,move_marker/goal_link_eef}`, /pipeline_state, /recognized_object_array and the controller_manager introspection topics. `xarm6__moveit2.txt` |
| xarm6 | rviz | `ros2 launch xarm_description xarm6_rviz_display.launch.py` | none | clean | NO FIXTURE |
| lite6 | sim#1 | `ros2 launch xarm_gazebo lite6_beside_table_gazebo.launch.py` | none | clean, no controllers | NO FIXTURE |
| lite6 | sim#2 | `… lite6_beside_table_gazebo.launch.py load_controller:=true show_rviz:=true` | `…/lite6/install_check/` | clean | **DIFFERS**: controllers match (lite6_traj_controller and jsb active). The 6 controller_manager introspection/statistics topics are missing. `lite6__sim2.txt` |
| lite6 | moveit#1 | `ros2 launch xarm_moveit_config lite6_moveit_fake.launch.py` | none | clean | NO FIXTURE |
| lite6 | moveit#2 | `ros2 launch xarm_moveit_config lite6_moveit_gazebo.launch.py` | `…/lite6/moveit/` (same command) | clean | **DIFFERS**: nodes present only in real: /gz_ros_control, /move_group/moveit, /moveit_simple_controller_manager. `lite6__moveit2.txt` |
| lite6 | rviz | `ros2 launch xarm_description lite6_rviz_display.launch.py` | none | clean | NO FIXTURE |

### interbotix (wx250s); the reference is a ROS2LAB-PORT

| Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|
| sim_note | (text) "jazzy branch only has a Gazebo Classic launch" | (port has `gz/`, not a site entry) | – | not an entry |
| moveit | `ros2 launch interbotix_xsarm_moveit xsarm_moveit.launch.py robot_model:=wx250s hardware_type:=fake` | `…/wx250s/moveit/` (port; real used `use_moveit_rviz:=false`) | clean; 3 controllers active, as in real | **DIFFERS**: the site publishes **un-namespaced** `/controller_manager/activity` and `/joint_states`, where real has only `/wx250s/controller_manager/activity` and `/wx250s/joint_states`. The site also has /clock and /display_contacts, which real lacks. Missing on the site: node /wx250s/xshardwareinterface, the `/wx250s/controller_manager/{introspection_data,statistics}/*` topics, and `/wx250s/{arm,gripper}_controller/speed_scaling_input`. Compared against our port, not upstream. `wx250s__moveit1.txt` |
| rviz | `ros2 launch interbotix_xsarm_descriptions xsarm_description.launch.py robot_model:=wx250s use_joint_pub_gui:=true` | none | clean | NO FIXTURE |
| fake | `ros2 launch interbotix_xsarm_control xsarm_control.launch.py robot_model:=wx250s hardware_type:=fake` | none (real install_check used the **other** launch file `interbotix_xsarm_ros_control xsarm_ros_control.launch.py`) | **blocked**: `[ERROR] [ros2lab_hardware_license]: real hardware is locked: this launch starts interbotix_xs_sdk/xs_sdk …`, and no process starts. The page's own hint then lists this same command under "Simulation and mock hardware need no license" | **NO FIXTURE + BROKEN on site**: the page offers it as a "fake" entry and then blocks it. Upstream `xsarm_control.launch.py` line 88–89 starts `xs_sdk` `UnlessCondition(use_sim)` (use_sim defaults to false), and `hardware_type` does not affect that choice. So the entry command, not the lock, is what is wrong. A mock would need `use_sim:=true` (xs_sdk_sim.py, line 106–110). `wx250s__fake1.txt` |

### dobot (cr5)

| Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|
| sim | `ros2 launch dobot_gazebo dobot_gazebo.launch.py` | `…/cr5/install_check/` (real with `gui:=false`) | clean | **DIFFERS**: controllers match (cr5_group_controller and jsb active). Topics present only in real: the 6 controller_manager introspection/statistics topics and /cr5_group_controller/speed_scaling_input. `cr5__sim1.txt` |
| moveit#1 | `ros2 launch dobot_gazebo sim.launch.py` | `…/cr5/moveit/` (same command) | clean | **DIFFERS**: the RViz node is `/rviz` in real and `/rviz2` on the site. Nodes present only in real: /gz_ros_control, /move_group/moveit, /moveit_simple_controller_manager. Topics present only in real: the 6 controller_manager introspection/statistics topics, /cr5_group_controller/speed_scaling_input, /pipeline_state, /recognized_object_array and the RViz interactive marker topics. Topic present only on the site: /motion_plan_request. `cr5__moveit1.txt` |
| moveit#2 | `ros2 launch dobot_moveit moveit_demo.launch.py` | none | launches. The graph lists `cr5_group_controller:active` but there is **no /controller_manager node**, so this needs a check | NO FIXTURE |
| rviz | `ros2 launch dobot_rviz dobot_rviz.launch.py` | none | clean | NO FIXTURE |

### crazyswarm2 (crazyflie) and scout

| Robot | Entry | Command | Real fixture | Site launch | Status |
|---|---|---|---|---|---|
| crazyflie | sim | `ros2 launch crazyflie launch.py backend:=sim rviz:=True` | none (NOT BUILT: swig + rowan need sudo) | launches. Honest notes: `crazyflie/teleop is running, but the practice computer has no model` and the same for `joy/joy_node` | NO FIXTURE |
| scout | rviz | `ros2 launch scout_description scout_base_description.launch.py` | none. The p2b fixtures are for the port's `scout_gazebo_sim scout_v2_gz.launch.py`, which the site does not offer | clean. Only /robot_state_publisher starts, as in the upstream launch file (one Node) | NO FIXTURE |

## Gallery-only robots (no official workspace, no real counterpart)

These are ROS2Lab-made packages or description-only robots. There is no maker workspace to compare against, so parity cannot apply. Each page offers `display / sim / control / moveit / moveit_gz`; only the default `display` was run.

| Robots | Page command run | Site launch |
|---|---|---|
| arm3, arm6, quadcopter, chiku, chiku_mesh, quadruped, hexapod, humanoid, mobile_manipulator, legged_manipulator, ackermann, mecanum, magician, so101, irb120, kr6, lrmate, go2, g1, h1, spot (21) | `colcon build --packages-select <pkg>_description …`, `source install/setup.bash`, `ros2 launch <pkg>_description display.launch.py` | all clean, 0 page errors, 4 nodes each (/robot_state_publisher, /joint_state_publisher_gui, /rviz2, tf listener). Output: `<id>__gallery.txt`. The sim / control / moveit options were not exercised (UNVERIFIED) |

tb4 has real fixtures on p2b but no page on the site.

## Problems, most important first (student impact first)

1. **fr3 `sim#2` (Gazebo + example controller) is broken.** The URDF fails (`link 'fr3_link0' has two parents`), Gazebo spawns nothing and the spawner dies, so a student gets an empty world. Real with the maker's args worked (`install_check/motion_proof.txt`). The site pins franka_description 72baf5bf, but the verified real build is 7aeeddc4. Rebuild the bundle at the verified commit, or check the xacro handling of `load_gripper:=true`.
2. **wx250s `fake` entry is offered as mock hardware and then blocked by the hardware-license lock.** The page's hint lists the same command as license-free. Upstream, that command starts the real `xs_sdk` unless `use_sim:=true`, so the workspace page entry should change (to `use_sim:=true`, or to the moveit entry). The lock itself is right.
3. **fr3 `sim#1` (visualize_franka_robot) ends with a dead `ros2 control load_controller` process.** No controller_manager runs. Real behaviour UNVERIFIED; this needs a real capture before anything is changed.
4. **Nav2 container log lines have no `[component_container_isolated-1]` prefix** (all three TB3 models, nav#1 and nav#2). This is the most-used course flow, and real error text is supposed to be shown verbatim (rule 5).
5. **Nav2 graph gaps** (existing report, still open): tb3_burger nav_robotis 56 FAIL, waffle 49, waffle_pi 42 (`parity/reports/fixture_parity.md`). The missing pieces are costmap layer topics, /diagnostics, docking and route topics, the bt_navigator rclcpp nodes, and QoS.
6. **wx250s MoveIt: un-namespaced `/joint_states` and `/controller_manager/activity`**, where real has only the `/wx250s/` versions. A student who echoes `/joint_states` sees data on the site, but real has nothing on that topic.
7. **fr3 MoveIt with fake hardware publishes `/clock`**, which real does not. This can hide use_sim_time mistakes.
8. **Every ros2_control robot lacks the controller_manager introspection and statistics topics** (6 topics) and the JTC `speed_scaling_input` topic (ur5e, gen3, cr5, wx250s). This affects every `ros2 topic list` on the arms.
9. **Every MoveIt launch lacks the `/move_group/moveit` and `/moveit_simple_controller_manager` nodes** and the `/pipeline_state` and `/recognized_object_array` topics, and adds `/motion_plan_request`. On xarm6/lite6 the `/rviz/moveit/*` panel topics are missing too. cr5's RViz node is `/rviz` in real and `/rviz2` on the site.
10. **gen3 `moveit#1` run on its own gives MoveIt with no robot**, which matches the upstream file. The page should say that `kortex_sim_control` must be started first, as in the real scenario.
11. **cr5 `moveit#2` (moveit_demo)** reports an active controller with no `/controller_manager` node. This is unverified and needs a check.
12. **Smaller items:** gen3 prints `Failed to activate controller` twice where real prints it once. crazyflie `teleop` and `joy_node` have no model (with an honest note).
13. **Coverage gaps.** 32 of 56 entries have no real fixture: TB3 empty/house worlds, rviz and fake node; every arm's `rviz`, mock-hardware and `*_fake` MoveIt entry; crazyflie (needs sudo); scout (the site offers only the description). The arm fixtures live only on the unmerged `origin/robots-p2b` branch, and parity-v2's STATUS.md still lists those arms as NOT BUILT.
