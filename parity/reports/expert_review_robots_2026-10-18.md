# Expert review: MoveIt / manipulators and the other robots (parity-fixes preview, 2026-10-18)

Three independent reviewers drove the `parity-fixes` branch (commit **b80c0e4**) served locally
(`python3 -m http.server 8000 --directory public`) in Playwright + Chromium, with Pyodide 314.0.7 served from
`node_modules/pyodide`:

- **[M]** a manipulation / MoveIt 2 expert (move_group, SRDF, OMPL, MoveItErrorCodes, ros2_control, RViz MotionPlanning)
- **[N]** a mobile-robot expert (TurtleBot4, AgileX Scout, Crazyflie: topics, TF, controllers, Nav2)
- **[E]** a robotics educator (student view: errors, hints, labels, locks, 375 px phone layout)

This review does **not** repeat the 2026-10-18 TurtleBot3 review (`expert_review_2026-10-18.md`).

**Ground truth.** There are no real-ROS fixtures for any robot in this review. Every "real ROS does X" claim cites
either a pinned maker file shipped in the site (`ws/...:line` = `public/robots/ws/...`) or an upstream Jazzy source
file on GitHub. Items with neither are marked **EXPERT JUDGMENT**. "From source" means the behaviour was read from
upstream code, not run on Ubuntu. No real output was invented. Each finding should be confirmed with a capture
before it is fixed. The ones that matter most are flagged **CAPTURE FIRST**.

**Spot-checked by the lead reviewer against upstream / site code** (all held up):
INVALID_LINK_NAME = -18 in `moveit_msgs` (`ros2` branch, MoveItErrorCodes.msg:30) vs -17 at `js/moveit-services.js:8`;
MoveIt clamps out-of-limit joint goals ("Assuming minimum/maximum bounds instead", `kinematic_constraint.cpp:249,258`);
OMPL "Cannot find planning configuration for group" (`planning_context_manager.cpp:524`);
Nav2 Jazzy `enable_stamped_cmd_vel` default `false` (`twist_publisher.hpp:63-64`);
the site reads only `planning_pipelines.pipeline_names` (`js/ros-moveit.js:459`);
wx250s launch uses Humble keys `planning_plugin` / `default_planner_request_adapters/...`
(`ws/interbotix/.../xsarm_moveit.launch.py:116-123`);
the hardware lock matches only the card's exact command (`js/terminal-sim.js:1186`, `R.realCmds.includes(...)`);
RViz FrameManager defaults to `"map"` (`js/rviz-page.js:19`).

**Coverage.** Full depth: ur5e, fr3, xarm6, gen3, scout, crazyflie, TB4 (via Nav2 demo launches), so101 (student
view). Medium: cr5, wx250s, lite6. Quick (load, launch, groups/joints): magician, irb120, kr6, lrmate, arm3, arm6,
go2, g1, h1, spot and the course robots. The license server was unreachable, so every real-hardware lock showed
its "cannot be reached" text. Shared 2-CPU machine: nothing was judged on wall-clock time.

---

## Verdict

| Reviewer | Verdict |
|---|---|
| MoveIt 2 expert | **not yet**: launches, controllers, SRDF data are faithful; pipeline loading, joint-list groups and error codes are not |
| Mobile-robot expert | **not yet** for TB4 (not simulated, fake fatal error); Scout and Crazyflie acceptable once labelled and the two High items are fixed |
| Robotics educator | **not yet**: lock bypass, no "Not yet validated" labels anywhere, wrong first RViz error on every MoveIt page |

**Overall: do not go live with the arm / Scout / Crazyflie pages presented as validated.** Every listed MoveIt
launch starts cleanly with no JS errors, and the maker data (SRDF groups, named states, controllers, joint names) is
read faithfully from the makers' files. But (1) students get *different planning results and error codes* from real
Jazzy MoveIt, including false successes; (2) the real-hardware license lock can be walked around with other
real-robot launch files; (3) nothing on any of these pages says "Not yet validated", although
`parity/robots/STATUS.md` lists every one of them as NOT VERIFIED / NOT BUILT; (4) TurtleBot4 has no page and its Nav2
demo is a non-functional shell with a fake fatal error.

---

## Must fix in the website's MoveIt emulation (ranked)

1. **Load planning pipelines the way Jazzy move_group does.** [M] Read the `planning_pipelines` string array; fall
   back to the `move_group` namespace (with the real deprecation warning) when it is missing; take
   `default_planning_pipeline` from the parameter; fail as Jazzy does when `<pipeline>.planning_plugins` is missing or
   the Humble key `planning_plugin` is used.
   Site: `js/ros-moveit.js:459` (reads `planning_pipelines.pipeline_names`, falls back to `["ompl"]`), `:465`, `:470-476`.
   Upstream: moveit2 jazzy `move_group.cpp:230-285`, `planning_pipeline.cpp:136-140`, `moveit_cpp.cpp:71-76`,
   `moveit_configs_builder.py:442-473`.
   Fixes: UR5e Pilz/CHOMP/STOMP refused (High), FR3 pipeline name (`move_group` not `ompl`), wx250s false start (High).
2. **Treat joint-list and link-list SRDF groups as MoveIt does.** [M] A `<link>` adds its parent joint; a joint list
   that forms a serial chain gets base/tip, so IK, the interactive marker and pose goals work.
   Site: `js/ros-moveit.js:40-45` (`jointListGroup` sets `tip=null`, ignores `grp.links`), `js/moveit-servo.js:66`,
   `js/moveit-services.js:30`. Fixes: no pose goals on xArm6, Lite6, wx250s; empty wx250s gripper group (all High).
3. **Return the error codes and texts Jazzy returns.** [M]
   - Joint goal outside limits: real clamps with WARN "Joint %s is constrained to be above the maximum bounds.
     Assuming maximum bounds instead." and plans; site returns INVALID_GOAL_CONSTRAINTS -16 (`js/moveit-core.js:760`).
     This also wrongly rejects FR3's own `extended` named state.
   - Joint goal in collision: real OMPL/RRTConnect gives GOAL_STATE_INVALID -27 + "Invalid goal state" with 1 attempt,
     FAILURE 99999 with RViz's 10 attempts (`model_based_planning_context.cpp:898-989`, `RRTConnect.cpp:263-266`);
     site returns GOAL_IN_COLLISION -12 (`moveit-core.js:762`).
   - Unknown group in planning: real PLANNING_FAILED + "Cannot find planning configuration for group '…'" /
     "Failed to create PlanningContext…" (`planning_context_manager.cpp:519-526`, `planning_pipeline.cpp:305-313`);
     site returns -15 (`js/ros-moveit.js:139`). -15 is right only for an empty group name and for `/compute_ik`.
   - Unreachable pose goal in planning: real shows as no valid goal samples; site returns NO_IK_SOLUTION -31 with an
     invented "Unable to construct goal representation" line (`js/moveit-servo.js:82-86`). -31 is right for `/compute_ik` only.
4. **Fix INVALID_LINK_NAME: -17 → -18** (`js/moveit-services.js:8`; `MoveItErrorCodes.msg:29-30`). [M]
5. **`ros2 action send_goal /move_action …` must plan and print a Result + status, or refuse clearly.** It now prints
   "Goal accepted with ID" and nothing else: a fake success (`js/ros-graph.js:734`; `move_action_capability.cpp:111-125`). [M]
6. **Execution checks.** [M] Inactive JTC: model "Can't accept new action goals. Controller is not running." →
   "Goal was rejected by server" → CONTROL_FAILED, not "Action client not connected" (`js/ros-moveit.js:198-203`;
   ros2_controllers jazzy `joint_trajectory_controller.cpp:1456-1463`; `follow_joint_trajectory_controller_handle.cpp:94`).
   Check the action *type* (Gen3: MoveIt `GripperCommand` client vs `ParallelGripperCommand` server) before executing
   (`js/ros-moveit.js:213-224`).
7. **mock_components/GenericSystem must honour the command interface** and URDF `<mimic>`. [M] Only position commands
   move joints unless `calculate_dynamics` is set; the site moves FR3 under an *effort* JTC (`js/ros-moveit.js:304-306`;
   ros2_control jazzy `generic_system.cpp:494-503, 512-530, 544-560`). **CAPTURE FIRST.**
8. **"Plan: Success … motion 0.00 s" after a failed pose goal** (UR5e, SO-101, xArm6): the panel silently re-plans
   to the previous goal. [E] EXPERT JUDGMENT on what real RViz shows; at minimum do not report success for a goal the
   student did not set.
9. **Sphere collision model false positives.** [M] xArm6 reports `link_base`–`link4` contact 0.1 rad from home;
   every small Magician goal fails `magician_base_link`–`magician_link_4`. Check against mesh/FCL distance before
   reporting a collision (`js/ros-moveit.js:81-95`, `public/robots/moveit/*.json`). EXPERT JUDGMENT.
10. **RViz Fixed Frame.** [E] On every MoveIt launch Global Status reads `Frame [map] does not exist` while the
    maker's `moveit.rviz` uses `world` / `fr3_link0`, and the Fixed Frame box draws two names on top of each other.
    Take the fixed frame from the loaded .rviz (`js/rviz-page.js:19,226`; `ur_moveit_config/config/moveit.rviz:232`,
    `franka_fr3_moveit_config/rviz/moveit.rviz:316`, `xarm_moveit_config/rviz/moveit.rviz:328`).
11. **Fake-gripper / joint_states merge**: FR3 fingers should read 0.035 (`js/ros-control-graph.js:295`;
    `ws/franka/.../fake_gripper_state_publisher.py:41`). Gen3 Robotiq mimic joints stay 0. [M]
12. **Startup log text.** [M] "Successfully loaded planner 'OMPL'" (not 'OMPLPlanner'), "MoveGroup context using
    pipeline <name>" (not "planning plugin …"), the "Loading 'move_group/…'" lines and "MoveGroup using:" banner;
    suppress rviz2 stdout when the launch sets `output="log"` (`js/ros-moveit.js:396-400, 472-476`;
    `ompl_planner_manager.cpp:104-107`, `move_group_context.cpp:97`, `move_group.cpp:188,201-209`).
13. **Missing capabilities / nodes.** [M] `/get_urdf`, `/save_geometry_to_file`, `/load_geometry_from_file`,
    `/move_group_private_*`, `/moveit_simple_controller_manager`; `/query_planner_interface` returns an empty list
    (`js/ros-moveit.js:512-521`; `move_group.cpp:63-77`).
14. **UR MoveIt without the driver.** [E] `ur_moveit.launch.py` alone: the site's description waiter gives up after
    30 s, exits 0 and starts move_group + RViz anyway; upstream waits forever and move_group starts only on the
    waiter's exit (`js/real-launch.js:423`; `ws/ur/.../wait_for_robot_description:67`, `ur_moveit.launch.py:192-197`).
    Add the hint "start `ur_control.launch.py … use_mock_hardware:=true` first".
15. **Label every arm page "Not yet validated against real ROS 2"** until `parity/fixtures/<arm>/` exists, and model
    or remove `example_move.py` from the UR page. [M][E]

## Must fix site-wide for these robots (not MoveIt-specific)

1. **The real-hardware lock can be bypassed.** [E][N] Only the card's single command is locked
   (`js/terminal-sim.js:1186`: `R.realCmds.includes(\`${a} ${b}\`)`). These real-robot launches run unlocked:
   `ur_robot_driver ur5e.launch.py`, `franka_bringup franka.launch.py robot_type:=fr3`,
   `xarm_planner xarm6_planner_realmove.launch.py`, `xarm_api xarm6_driver.launch.py`,
   `scout_base scout_mini_base.launch.py`, `crazyflie_examples keyboard_velmux_launch.py` (upstream includes
   `crazyflie/launch.py` with default `backend=cpp`, the real radio driver: `keyboard_velmux_launch.py:12-20`,
   `crazyflie/launch/launch.py:127`). UR and xArm then print made-up "hardware class does not exist" errors although
   upstream declares the plugins (`ws/ur/.../ur_robot_driver/hardware_interface_plugin.xml:2`,
   `xarm_controller/uf_hardware_interface_plugins.xml:2`; site text `js/ros-control-graph.js:134`).
   Fix: lock by *what the launch starts* (a non-mock hardware plugin, a real driver node, cpp/cflib backend), not by
   command string. High.
2. **No "Not yet validated" label anywhere** on any robot page, launch button or real-hardware button, while the
   lead text says "the real launch files run". `workspace.json` has an `honesty` field no JS reads (e.g.
   `ws/ur/workspace.json`). High.
3. **ROS2Lab-generated packages shown under the maker's brand** (so101, magician, irb120, kr6, lrmate, go2, g1, h1,
   spot): `<id>_moveit_config`, `_gazebo`, `_bringup`, `real.launch.py`, maintainer `student`. The card names only
   the maker and source repo; the disclosure is in a collapsed section (`js/robot-packages.js:137,200,231`,
   `js/rviz-pkg.js:26`). The upstream SO-ARM100 README has no ROS content (spot-checked), which supports this.
   Put "ROS2Lab-made config – not from the maker" on the card. High.
4. **License-lock hint names files that do not exist** ("use sim.launch.py / gazebo.launch.py / demo.launch.py",
   `js/ros-graph.js:1958`). Use the workspace's own sim/mock commands from the card. Medium.
5. **"Install it with apt" for typos and unsourced workspace packages**, and no "did you source
   install/setup.bash?" hint after a build; Scout gets an apt hint though Jazzy has no Scout package. Medium. [E]
6. **"Start the Gazebo simulation first" hint for `ros2 control list_controllers`** on robots that never use
   ros2_control (CR5 demo, Scout, Crazyflie, TB4 nav2_minimal). Low. [M][N]
7. **Catalog badge "Gazebo sensors"** on Scout and Crazyflie, which have no Gazebo (`js/sim-catalog.js:37`). Medium. [N]

---

## Per robot

Columns: issue · evidence (command → short site output) · source or EXPERT JUDGMENT · student impact.
Reviewer tag in brackets. Items covered by the MoveIt must-fix list above are referenced by number (MF#), not repeated.

### Universal Robots UR5e (`ur5e`) – full depth
Works: `colcon build` → `source install/setup.bash` → `ros2 launch ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e`;
JSB + `scaled_joint_trajectory_controller` active; initial joint_states `[0,-1.57,0,-1.57,0,0]` match
`ws/ur/.../config/initial_positions.yaml`; panel Plan + Execute succeed.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | Only OMPL usable though `/move_group` lists 4 pipelines (MF1) [M] | `ros2 param get /move_group planning_pipelines` → `['chomp','ompl','pilz_industrial_motion_planner','stomp']`; Pilz LIN → `Pipeline 'pilz_industrial_motion_planner' is not loaded (planning_pipelines: ompl)` | `move_group.cpp:230-245`; `ws/ur/.../ur_moveit_config/config/*_planning.yaml` | High |
| 2 | Real-hardware lock bypassed via `ur_robot_driver ur5e.launch.py robot_ip:=…`; then fake "class … URPositionHardwareInterface does not exist" + process died [E] | site-wide #1 | `ws/ur/.../hardware_interface_plugin.xml:2`; `ur5e.launch.py:93` | High |
| 3 | Wrong error codes: collision → -12, out-of-limits → -16, unknown group → -15, unreachable pose → -31 (MF3) [M] | `elbow_joint:3.0` → `GOAL_IN_COLLISION -12`; `shoulder_pan_joint:9.0` → `INVALID_GOAL_CONSTRAINTS -16` | see MF3 | High |
| 4 | RViz Global Status `Frame [map] does not exist`, Fixed Frame combo shows `world` over `base_link` (MF10) [E] | `frameManager.fixedFrame = "map"` | `ur_moveit_config/config/moveit.rviz:232` | High |
| 5 | `ur_moveit.launch.py` without driver: waiter times out after 30 s, move_group starts anyway; no hint (MF14) [E] | `Waiting for message on /robot_description.` → `process has finished cleanly`; error only at Ctrl+C | `wait_for_robot_description:67`; `ur_moveit.launch.py:192-197` | High |
| 6 | No "Not yet validated" label (STATUS: NOT VERIFIED) [E] | page text | `parity/robots/STATUS.md` | High |
| 7 | `send_goal /move_action` prints "Goal accepted" and nothing else (MF5) [M] | `Goal accepted with ID: c557e7…` | `move_action_capability.cpp:111-125` | Medium |
| 8 | `/compute_fk` bad link → val=-17 (MF4) [M] | `fk_link_names: [nolink]` → `val=-17` | `MoveItErrorCodes.msg:30` | Medium |
| 9 | Inactive controller → "Action client not connected" instead of goal rejection (MF6) [M] | after `switch_controllers --deactivate …` → `…is not active.` | `joint_trajectory_controller.cpp:1456-1463` | Medium |
| 10 | "Example trajectory" button (`ros2 run ur_robot_driver example_move.py`) does nothing; button doesn't say so [M][E] | `(ROS2Lab: … no model of what this program does…)` | `ws/ur/.../scripts/example_move.py:81-106` | Medium |
| 11 | "Plan: Success … 0.00 s" after a failed pose goal (MF8) [E] | panel | EXPERT JUDGMENT | Medium |
| 12 | Same launch twice runs silently, no duplicate nodes / gz conflict [E] | two terminals, `ros2 node list` | EXPERT JUDGMENT | Medium |
| 13 | Unsourced workspace → `Package … not found` with no source hint; typo → "Install it with apt" [E] | `ur_simulaton_gz` | EXPERT JUDGMENT | Medium |
| 14 | License hint names `sim.launch.py / gazebo.launch.py / demo.launch.py` – none exist in the UR workspace [E] | gate text | `js/ros-graph.js:1958` | Medium |
| 15 | Startup log text wrong; capability lines/banner missing (MF12); rviz2 stdout shown despite `output="log"` [M] | `Successfully loaded planner 'OMPLPlanner'` | `ur_moveit.launch.py:177`; see MF12 | Low |
| 16 | Missing services/nodes; empty `/query_planner_interface` (MF13) [M] | `ros2 service list` | `move_group.cpp:63-77` | Low |

### Franka Research 3 (`fr3`) – full depth
Works: `ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=dont-care use_fake_hardware:=true`; groups
`fr3_arm`/`fr3_hand`, EE, virtual joint match `ws/franka/.../franka_arm.srdf.xacro:7-10`, `group_definition.xacro:5-26`;
`fr3_arm_controller` (effort) + JSB and GPIO interfaces match `fr3_ros_controllers.yaml:10-34`,
`franka_arm.ros2_control.xacro:88-106`.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | Arm moves on mock hardware although the JTC commands *effort* (MF7) [M] **CAPTURE FIRST** | +0.2 rad plan+execute → all joints +0.2 in `/joint_states` | `generic_system.cpp:494-503,512-530`; `franka_arm.ros2_control.xacro:26-29` (from source) | High |
| 2 | Real-hardware lock bypassed: `franka_bringup franka.launch.py robot_type:=fr3 robot_ip:=172.16.0.2` runs unlocked [E] | ends "Controller manager not available" | `franka_bringup/launch/franka.launch.py:35` | High |
| 3 | Fixed Frame `map` vs `fr3_link0`, overlapping text (MF10) [E] | `shots/fr3_fixedframe.png` | `franka_fr3_moveit_config/rviz/moveit.rviz:316` | High |
| 4 | No "Not yet validated" label (NOT BUILT) [E] | page | STATUS.md | High |
| 5 | Pipeline called `ompl`; real Jazzy falls back to `move_group` namespace with a deprecation warning (MF1) [M] | `ros2 param get /move_group default_planning_pipeline` → `ompl` | `moveit.launch.py:124-145`; `move_group.cpp:268-285` | Medium |
| 6 | Maker's own `extended` named state rejected (joint4 -0.1 > limit -0.1169) (MF3) [M] | `INVALID_GOAL_CONSTRAINTS -16` | `group_definition.xacro:18-26`; `joint_limits.yaml:33-37`; `kinematic_constraint.cpp:252-259` | Medium |
| 7 | Finger joints 0.0 in `/joint_states` (real fake gripper: 0.035) (MF11) [M] | `ros2 topic echo --once /joint_states` | `fake_gripper_state_publisher.py:41`; `moveit.launch.py:237-244` | Medium |
| 8 | MotionPlanning display unticked after launch (faithful), but no hint to tick it, so the card's planning promise looks broken [E] | `shots/fr3_mp.png` | `moveit.rviz:231-232` `Enabled: false` | Medium |
| 9 | Hand execute panel text "franka_gripper is not active." (log line itself is right) [M] | `mg.execute(hand plan)` | `follow_joint_trajectory_controller_handle.cpp:53` | Low |
| 10 | `use_fake_hardware:=true` without `robot_ip` – real-style error but no hint that any value works; no-`robot_type` path `robots//.urdf.xacro` faithful but unhinted [E] | | `franka.launch.py:221-222`; EXPERT JUDGMENT for hint | Low |

### UFACTORY xArm 6 (`xarm6`) – full depth
Works: `ros2 launch xarm_moveit_config xarm6_moveit_fake.launch.py`; `UFRobotFakeSystemHardware`, `xarm6_traj_controller`,
group `xarm6`, states `home`/`hold-up` match `ws/xarm/.../_xarm6_macro.srdf.xacro:14-57`; only ompl, which is correct
for xArm (`uf_ros_lib/moveit_configs_builder.py:654-660`). Note: the pinned workspace is `public/robots/ws/xarm/`
(shared with lite6).

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | No pose goals / IK for group `xarm6` (joint list treated as tip-less) (MF2) [M][E] | dock: `The group xarm6 has no tool link: use the Joints tab`; `/compute_ik` → -15 | `config/xarm6/kinematics.yaml:1-2`; site `js/ros-moveit.js:40-45` | High |
| 2 | Real-hardware lock bypassed: `xarm_planner xarm6_planner_realmove.launch.py`, `xarm_api xarm6_driver.launch.py`; fake "Failed to load hardware component 'uf_robot_hardware/UFRobotSystemHardware'" [E] | | `xarm_controller/uf_hardware_interface_plugins.xml:2` | High |
| 3 | Fixed Frame `map` vs `world` (MF10) [E] | `shots/xarm6_globalstatus.png` | `xarm_moveit_config/rviz/moveit.rviz:328` | High |
| 4 | No "Not yet validated" label [E] | page | STATUS.md | High |
| 5 | Likely false self-collision near home: +0.1 rad on every joint → `link_base`–`link4` (MF9) [M] | `mg.stateValid(...)`; +0.2 goal → `GOAL_IN_COLLISION -12` | EXPERT JUDGMENT (`_xarm6_macro.srdf.xacro:199-211` does not disable the pair) | Medium |
| 6 | "Plan Success 0.00 s" after the pose dock fails (MF8) [E] | | EXPERT JUDGMENT | Medium |
| 7 | `effort: .nan` in `/joint_states` (plausible, not checked) [M] | | – | Low |
| 8 | Launch-file typo error is real-style, but no list of valid `xarm6_*` files [E] | `xarm_moveit_fake.launch.py` | EXPERT JUDGMENT | Low |

### Kinova Gen3 7-DoF + Robotiq 2F-85 (`gen3`) – full depth
Works very well: `ros2 launch kinova_gen3_7dof_robotiq_2f_85_moveit_config robot.launch.py robot_ip:=yyy.yyy.yyy.yyy use_fake_hardware:=true`;
active `joint_trajectory_controller`, `robotiq_gripper_controller`, JSB; `twist_controller` inactive; no
`fault_controller` with fake hardware (`launch/robot.launch.py:110-131`); groups/states match `config/gen3.srdf:12-49`.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | Gripper executes although MoveIt's `GripperCommand` client can't talk to the `ParallelGripperCommand` server (MF6) [M] | `ros2 action list -t` → `…/gripper_cmd [control_msgs/action/ParallelGripperCommand]`; execute → ok | `moveit_controllers.yaml:22-26`; `ros2_controllers.yaml:14-15` (from source) | Medium |
| 2 | Robotiq mimic joints stay 0 while left knuckle = 0.79 (MF11) [M] | `/joint_states` | `generic_system.cpp:544-560`; `robotiq_2f_85_macro.urdf.xacro:261-308` | Low |
| 3 | Card text ends in garbage `…(dof:=7 vision:=true).0}".` [M][E] | page text | site regex `js/rviz-page.js:635`; `public/robots/index.json:335` | Low |
| 4 | No "Not yet validated" label; error codes / log text as UR5e [M][E] | | STATUS.md; MF3, MF12 | High / – |

### Dobot CR5 (`cr5`) – medium
Works: `ros2 launch dobot_moveit moveit_demo.launch.py` with `fake_demo_server` (no ros2_control, as the maker intends:
`ws/dobot/.../moveit_demo.launch.py:74-92`); group `cr5_group`, state `home` match `cr5_robot.srdf:12-23`.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | `ros2 control list_controllers` → hint "Start the Gazebo simulation first" (no controller_manager in this demo by design) [M] | CLI | `moveit_demo.launch.py:74-92` | Low |
| 2 | No "Not yet validated" label; error codes / log text as UR5e | | STATUS.md; MF3, MF12 | High / – |

### Trossen WidowX 250 6DOF (`wx250s`) – medium
Launch: `ros2 launch interbotix_xsarm_moveit xsarm_moveit.launch.py robot_model:=wx250s hardware_type:=fake` (`/wx250s/` namespace, arm + gripper JTCs).

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | Site prints "You can start planning now!"; from source, Jazzy move_group would fail to load any pipeline (Humble keys) (MF1) [M] **CAPTURE FIRST** | `Successfully loaded planner 'OMPLPlanner'` | `xsarm_moveit.launch.py:116-123` (verified); `planning_pipeline.cpp:136-140`; `moveit_cpp.cpp:71-76` | High |
| 2 | Gripper group `interbotix_gripper` (defined by `<link>`s) has no joints: Grasping/Released/Home can't be planned (MF2) [M] | probe: `interbotix_gripper: {joints: []}` | `wx250s.srdf.xacro:9,31-34` | High |
| 3 | No pose goals for `interbotix_arm` (joint list, LMA solver) (MF2) [M] | `…has no end effector…` | `wx250s.srdf.xacro:19-30`; `kinematics.yaml:5` | High |

### UFACTORY Lite 6 (`lite6`) – medium
Works: `ros2 launch xarm_moveit_config lite6_moveit_fake.launch.py`; group `lite6`, state `home`, `lite6_traj_controller`
match `_lite6_macro.srdf.xacro:14-40`, `config/lite6/fake_controllers.yaml`; joint planning + execute work.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | No pose goals / IK – joint-list group (MF2) [M] | `…no end effector…` | `_lite6_macro.srdf.xacro:14-36` | High |

### Quick checks: magician, so101, irb120, kr6, lrmate, arm3, arm6
All run `ros2 launch <id>_moveit_config demo.launch.py` cleanly with 4 pipelines, arm/gripper groups and home/ready
(open/close) states; joint names match each maker's URDF. These `_moveit_config` packages are **ROS2Lab-generated**
(the makers ship no Jazzy MoveIt config), so groups and states are ROS2Lab's choices.

| Robot | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| so101 + magician, irb120, kr6, lrmate (and go2, g1, h1, spot) | Generated packages (incl. `real.launch.py`, maintainer `student`) shown under the maker's brand (site-wide #3) [E] | card: "The Robot Studio / Hugging Face … Source: TheRobotStudio/SO-ARM100" | `js/robot-packages.js:137,200,231` | High |
| magician | Every small (+0.2 rad) goal fails `GOAL_IN_COLLISION` base–link_4 in every pipeline (MF9) [M] | probe | EXPERT JUDGMENT (sphere model on the parallel-link chain) | Medium |
| so101 | Unreachable pose → clear `NO_IK_SOLUTION … (position only IK)`, then "Plan Success 0.00 s" (MF8) [E] | | EXPERT JUDGMENT | Medium |
| arm3, arm6 | 404 `/robots/moveit/<id>.json` on every load (spheres fitted at runtime; planning works) [M][E] | network log | – | Low |
| all | Error codes as UR5e (MF3); no "Not yet validated" label | | | – |

Good on so101: `real.launch.py` and `bringup.launch.py hardware_type:=real` are locked, `hardware_type:=mock` works;
the README's `feetech_ros2_driver` exists in Jazzy (`rosdistro jazzy/distribution.yaml:3147`).

### TurtleBot 4 – no robot page
**What a student can and cannot do.** `/rviz.html?robot=tb4` shows "Robot not found" plus an empty, clickable
"Launch it" card; there is no catalog entry, page or button, and tab completion offers only tb3. TB4 exists only as
Nav2's demo packages (`nav2_minimal_tb4_description`, `nav2_minimal_tb4_sim`; `js/terminal-sim.js:68`), reachable from
any robot page's terminal with `ros2 launch nav2_bringup tb4_simulation_launch.py` or
`tb4_loopback_simulation.launch.py`. There the real TB4 URDF/TF tree, the depot map (604×307, 0.05 m) and the Nav2
node/topic lists are right. The robot never spawns or drives: no /odom, /scan or odom TF, `bt_navigator` stays
inactive, every goal is rejected. `parity/robots/STATUS.md` says tb4 "Built: yes"; nothing on the site matches that.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | Fake fatal spawn error [N] **CAPTURE FIRST** | `tb4_simulation_launch.py` → `[ros_gz_sim]: ERROR: unknown command line flag 'robot_namespace'` / `[create-5]: process has died … exit code 255` | ros_gz 1.0.24 `create.cpp:112` (`gflags::AllowCommandLineReparsing()`, so unknown flags are ignored); gflags v2.2.2 `gflags.cc:1250-1253`; `nav2_minimal_tb4_sim` 1.0.1-1 `spawn_tb4.launch.py:114,117`; site `js/gz-cli.js:91` | High |
| 2 | Gazebo not simulated for TB4 and not labelled: gz "running, but … no model"; local_costmap "Timed out waiting for transform from base_link to odom" forever; goals `Goal was rejected.` [N] | `ros2 lifecycle get /bt_navigator` → `inactive [2]` | `tb4_bridge.yaml:19-44`; `create3.urdf.xacro:98-104` | High |
| 3 | Loopback simulator is a dead node: nothing subscribes to `/initialpose` or `/cmd_vel`, no odom/TF/scan [N] | `topic pub --once /initialpose …` → `(Nobody subscribes to /initialpose…)` | navigation2 jazzy `nav2_loopback_sim/loopback_simulator.py:124-145` | High |
| 4 | `enable_stamped_cmd_vel` defaults to `true` on the site → `/cmd_vel_nav`, `/cmd_vel_smoothed` (and loopback `/cmd_vel`) show TwistStamped. (New effect of the TB3 review's Low item.) [N] | `ros2 topic list -t` → `/cmd_vel_nav [geometry_msgs/msg/TwistStamped]` | `twist_publisher.hpp:62-65` (default false, verified); pinned `nav2_params.yaml` has no key; site `js/nav2-sim.js:530,615,664,686` | Medium |
| 5 | apt says official TB4 packages don't exist [N] | `sudo apt install ros-jazzy-turtlebot4-simulator` → `E: Unable to locate package`; `turtlebot4_gz_bringup` → `Package … not found` | rosdistro `jazzy/distribution.yaml` (`turtlebot4_simulator`, `turtlebot4`) | Medium |
| 6 | Stray `/undefined` node in `ros2 node list` [N] | `… /undefined /velocity_smoother` | EXPERT JUDGMENT (an unnamed ExecuteProcess) | Medium |
| 7 | Not discoverable (no catalog entry; tab completion tb3 only) [N][E] | `js/ros2-complete.js:45`; `index.json` | – | Medium |
| 8 | `list_controllers` hint "Start the Gazebo simulation first" while gz is running (TB4 uses gz DiffDrive, no controller_manager) [N] | | `create3.urdf.xacro:98-104` | Low |

Decide: either add a `tb4` page backed by `turtlebot4_gz_bringup` with a "Not yet validated" label, or make the
nav2_bringup tb4 launches print an honest "TB4 simulation is not modelled on ROS2Lab yet" note (same rule as TB3
review must-fix #6) and fix STATUS.md.

### AgileX Scout V2 (`scout`, scout_ros2 @ 48f70cbe jazzy)
Faithful: `colcon build`/`source`; `scout_base_description.launch.py` runs the real launch file incl. `LogInfo`; TF
offsets match the URDF (`tf2_echo base_link front_left_wheel_link` → `[0.249, 0.292, -0.070]`, `scout.urdf:93`);
fixed wheel joints (no /joint_states); no odom TF without scout_base (`scout_messenger.hpp:255-269`); /cmd_vel is
Twist (`scout_messenger.hpp:52-53`); upstream mesh-path bug and lack of Gazebo stated honestly.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | Real-hardware lock bypassed: `scout_base scout_mini_base.launch.py` starts `scout_base_node` unlocked [E] | | `scout_base/launch/scout_mini_base.launch.py` | High |
| 2 | No "Not yet validated" label (NOT BUILT) [N][E] | lead text "the real launch files run…" | STATUS.md | High |
| 3 | Catalog card "Gazebo sensors" though the page has no simulation; unused `sim` block in index.json [N] | catalog text | `js/sim-catalog.js:37` | Medium |
| 4 | `scout_msgs` unknown after build+source (all 5 types) [N] | `ros2 interface show scout_msgs/msg/ScoutStatus` → `Unknown package 'scout_msgs'` | `src/scout_ros2/scout_msgs/msg/`; missing from `public/robots/ros-ifaces.json` | Medium |
| 5 | `colcon build` succeeds without `ugv_sdk` (scout_base `find_package(ugv_sdk REQUIRED)`; not in workspace or Jazzy rosdistro) [N] | `Summary: 3 packages finished` | `scout_base/CMakeLists.txt:32,60`, `package.xml:22`; `ws/scout/scout.repos` | Medium |
| 6 | License hint suggests `sim.launch.py / gazebo.launch.py / demo.launch.py` (none exist); no note that `simulated_robot:=true` still needs CAN [N][E] | `scout_base.launch.py simulated_robot:=true port_name:=vcan0` | `scout_base_ros.cpp:64-118`; `js/ros-graph.js:1958` | Medium |
| 7 | `scout/nav2_params.json` titled "AgileX Scout v2 Navigation 2 Parameters" is TB3-sized nav2_bringup defaults (robot_radius 0.22, /scan); Scout is 0.925×0.38 m with no lidar; duplicates in `scout_v2/`, `scout_description/` [N] | `_header.source_file: share/nav2_bringup/params/nav2_params.yaml` | `tools/generate-nav2-params.py:48-56`; `ws/scout/generated/scout.urdf:8-27` | Medium |
| 8 | `ros2 launch scout_gazebo_sim …` → "Install it with apt" (no Scout package in Jazzy) [E] | | rosdistro jazzy (no `scout*`) | Medium |
| 9 | `teleop_twist_keyboard` with only the description: hint doesn't say nothing subscribes to /cmd_vel [E] | | EXPERT JUDGMENT | Low |
| 10 | `list_controllers` "Start the Gazebo simulation first" (no ros2_control on Scout) [N] | | `scout_messenger.hpp:44-61` | Low |

### Bitcraze Crazyflie 2.1 (`crazyflie`, crazyswarm2 @ f1e09954 main)
Faithful: `launch.py backend:=sim rviz:=True` starts crazyflie_server (sim), teleop, joy_node, rviz2 incl. the real
LaunchConfigurationEquals deprecation warning; topics/services/types match `crazyflie_server.py:132-207`;
world→cf231 TF; `go_to` before takeoff gives the exact upstream error ("goTo from low-level modes not yet
supported", `crazyflie_sil.py:132-134`); takeoff/go_to/land work; `hello_world` log values match; no /scan /odom in
sim (correct); default `backend=cpp` launch locked; `/cf231/takeoff` with nothing running gives an excellent hint.

| # | Issue | Evidence | Source | Impact |
|---|---|---|---|---|
| 1 | "Keyboard velocity control (needs crazyflie launch running)" button is wrong: upstream starts its own server with `backend=cpp` (real radio) → second server, lock bypassed; `vel_mux` unmodelled, so the drone can't be flown from a keyboard [N][E] | `keyboard_velmux_launch.py` → `(ROS2Lab: crazyflie_server_cpp/crazyflie_server is running, but … no model …)` | `keyboard_velmux_launch.py:12-20`; `crazyflie/launch/launch.py:80-84,127`; `vel_mux.py:51-66` | High |
| 2 | `multiranger_nav2_launch.py` reports success with Humble plugin names; real Jazzy planner_server would print "Failed to create global planner" and abort [N] **CAPTURE FIRST** | `Created global planner plugin GridBased of type nav2_navfn_planner/NavfnPlanner` | `crazyflie_examples/config/nav2_params.yaml:191,200-211`; navigation2 jazzy `nav2_navfn_planner/global_planner_plugin.xml` (no `name=`); `planner_server.cpp:120-125` | High |
| 3 | No "Not yet validated" label (NOT BUILT) [N][E] | page | STATUS.md | High |
| 4 | Ignored velocity commands not logged (real: "cmd_vel_legacy not yet implemented", same for cmd_hover) [N] | `topic pub --once /cf231/cmd_vel_legacy …` → no line | `crazyflie_sim/crazyflie_server.py:387-401` | Medium |
| 5 | Catalog "Gazebo sensors" and index.json note describing a Gazebo VelocityControl teleop – neither exists [N] | | `js/sim-catalog.js:37` | Medium |
| 6 | `ros2 run crazyflie_examples hello_world` returns at once in one run, hangs silently in another [E] | | upstream `hello_world.py` hovers ~10 s | Medium |
| 7 | Plain `teleop_twist_keyboard` advertises "t up, b down (drones)" but publishes /cmd_vel, which the sim doesn't subscribe to [E] | | EXPERT JUDGMENT | Low |
| 8 | behavior_server logs "of type spin" (real logs `nav2_behaviors::Spin`) [N] | | `behavior_server.cpp:28-31,110-113` | Low |
| 9 | `/tf` and `/clock` exactly 2000 Hz; real `max_dt: 0` is machine-dependent [N] | `ros2 topic hz /tf` → `1999.998` | `server.yaml:17`; EXPERT JUDGMENT for rate | Low |
| 10 | `index.json` fixedFrame `cf`, sim frame is `cf231` [N] | `view_frames` | `crazyflie_server.py:139-140` | Low |
| 11 | `list_controllers` "Start the Gazebo simulation first" (no ros2_control) [N] | | `crazyflie/launch/launch.py` | Low |

---

## Phone (375 × 812) [E]

| Page | Overflow | Findings | Impact |
|---|---|---|---|
| ur5e (and every MoveIt page) | none (375) | **MotionPlanning effectively unreachable:** below 560 px both RViz docks start hidden (`js/rviz.js:1897-1899`); the only toggles are unlabeled 16 × 361 px strips. Opened, Displays is ~140 px wide (labels cut to "G..", "F..."; Add/Remove clipped); Plan/Execute 136 × 27 px. RViz toolbar scrolls sideways (942 px in 321 px), hiding tools. Sticky site header (~145 px, nav wraps to 2 rows) covers the RViz title (`css/app.css:58`). Terminal wraps well; Ctrl+C 132 × 34; split/new-tab icons 30 × 28. | Medium–High |
| scout | none | Terminal and cards readable; summary row 27 px tall; icons 30 × 28 | Low |
| crazyflie | none | Same RViz toolbar/dock issues as ur5e | Medium |

---

## Confirmed faithful

- **All arm launches listed on the pages start** with no JS errors or hangs. [M]
- **Maker data:** SRDF groups, named states, end effectors, virtual/passive joints read from the makers' SRDFs (UR,
  Franka, xArm, Kortex, Dobot, Interbotix); `robot_description_semantic` shows the xacro-expanded SRDF. [M]
- **Controllers / hardware interfaces / joint names** match the makers' yaml/URDF for UR sim (JSB +
  `scaled_joint_trajectory_controller` only, `ur_sim_control.launch.py:115-141,262-276`), FR3, xArm6/Lite6, Gen3,
  wx250s; CR5 uses its fake server without ros2_control. [M]
- **Error-code table** in `js/moveit-core.js:15-17` matches MoveItErrorCodes (except INVALID_LINK_NAME);
  `/compute_ik` gives -31 unreachable, -15 unknown group, correctly. [M]
- **Kinematics solvers** from kinematics.yaml (KDL for UR/FR3/xArm/Gen3, LMA for Interbotix); real
  MoveItConfigsBuilder "Cannot infer URDF/SRDF" warnings on UR; trajectory-execution and simple-controller-manager log
  strings exist upstream (`trajectory_execution_manager.cpp:933,996,1161,1325,1354`). [M]
- **Site-made lines are labelled** "(ROS2Lab)" / "(ROS2Lab: … no model …)". [M][E]
- **Student errors done well:** invalid `ur_type` lists valid choices; missing required args (`ur_type`, `robot_ip`,
  `controller_names`); launch file not in share directory; package not found before build; post-build "source
  install/setup.bash" hint; Execute disabled until a plan; clear NO_IK_SOLUTION text; realistic Ctrl+C shutdown; card
  real-hardware buttons amber + locked while mock/fake/sim variants stay open; upstream gaps stated honestly (Scout
  no Gazebo + mesh bug, wx250s Gazebo Classic only, Crazyflie no Jazzy Gazebo, Gen3 xacro). [E]
- **TB4 (nav2_minimal):** URDF, TF tree (base_footprint child of base_link, `turtlebot4.urdf.xacro:50-55`), bridge
  config incl. Twist `cmd_vel`, depot map, Nav2 node set incl. route_server/docking_server. [N]
- **Scout and Crazyflie** items listed at the top of their sections. [N]
- No TurtleBot text left on non-TB3 pages; no page errors on any robot page; robot games are all TB3-only (nothing new
  in the playground); no course lesson points to missing UI for these robots. [E]

## Not covered

- Gazebo + MoveIt for anything except UR (xArm, Gen3 sim, Lite6, CR5, generated arms); MoveIt Servo; Pilz LIN/CIRC,
  CHOMP, STOMP correctness; Cartesian path numbers; attached objects; pick and place.
- Real RViz interactive-marker drags (planning was driven through the panel's test hooks and pose dock).
- RViz 2D Goal / Pose tools on Scout and Crazyflie; Crazyflie trajectories and multi-drone; TB4 warehouse world and
  `namespace:=` / `use_composition:=False` variants.
- What a logged-in student sees at the license lock, and the licensed hardware path.
- gen3, lite6, cr5, wx250s, magician and legged/humanoid robots beyond the checks listed.
- Wall-clock timing.
- Real-ROS captures for any robot here. Capture these first, because the fix depends on them:
  1. TB4: does `create` 1.0.24 spawn with `-entity` / `-robot_namespace`? (TB4 #1)
  2. Crazyflie `multiranger_nav2_launch.py` on Jazzy (Crazyflie #2)
  3. wx250s `xsarm_moveit.launch.py hardware_type:=fake` on Jazzy (wx250s #1)
  4. FR3 fake hardware: does the arm move under the effort JTC? (FR3 #1)
  5. Error codes for UR5e: joint goal in collision (1 and 10 attempts), out-of-limit joint goal, unknown group,
     unreachable pose goal, inactive controller (MF3, MF6)
  6. What RViz MotionPlanning shows when Plan is pressed after a failed pose goal (MF8)
