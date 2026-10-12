# V24 handoff: where the work stands

Read this together with `CLAUDE.md`. The beginner steps for Claude Code are in `CLAUDE-CODE-GUIDE.md`.

## Goal

Every robot in the Robotic Models Simulator must work exactly as its official GitHub workspace works on Ubuntu 24.04
with ROS 2 Jazzy, in Gazebo and RViz:

- the same launch output, with no errors real ROS 2 would not print;
- the same nodes, topics, services, actions, controllers and TF;
- sensors with the right type, frame, rate and content;
- the robot's tasks work: teleop, SLAM and Nav2 for mobile robots; trajectories, MoveIt 2 and grippers for arms.

## Done in V24 so far

**Mobile robots** (mobile audit finished; tested):

- **TurtleBot3 Burger and Waffle:**
  - bridge topics are resolved in the node namespace, so `hz`/`echo`/`info` of /scan, /odom and /imu work;
  - stamps never show `nanosec: 1000000000`;
  - wheel velocities appear in /joint_states;
  - a `TwistStamped` published from the CLI drives the robot;
  - tf2_echo uses the sim time;
  - ros_gz_bridge and robot_state_publisher declare the parameters the real nodes have;
  - map→odom is in the TF tree (tf2_echo, view_frames);
  - RViz Map displays subscribe to `_updates`.
- **Checked against the upstream source and correct:** /odom at 50 Hz (gz-sim8 ignores the SDF's
  `odom_publisher_frequency`), the IMU frame `burger/imu_link/tb3_imu`, and the `gz_frame_id` warning.
- **turtlebot3_fake_node:** now modelled (`public/js/tb3-fake.js`).
- **Crazyflie `backend:=sim`:** the sim server is now modelled (`public/js/cf-sim.js`). takeoff, land and go_to work,
  hello_world flies, and the RViz view works.
- **`tests/real-tb3-nav.mjs`:** fixed. It now stops cartographer before Nav2, as you would on Ubuntu. It passes.

**Arms** (audit started, NOT finished; it was cut off by a usage limit):

- Partial fixes in `ros2-control.js`, `ros-control-graph.js`, `ros-moveit.js`, `moveit-rviz.js`, `moveit-servo.js`,
  `rviz.js`, `real-launch.js`, `ros-graph.js` and `terminal-sim.js`.
- New test `tests/real-arms-audit.mjs`. For every arm it checks:
  - controllers and their states;
  - the topics, actions and services the real stack has;
  - /joint_states;
  - a `ros2 action send_goal .../follow_joint_trajectory` from the terminal moves the arm;
  - the MotionPlanning panel buttons plan and execute;
  - gripper actions.
- After these partial changes, `real-moveit.mjs ur5e`, `real-tb3.mjs` and `security-check.mjs` still pass.
- Latest run of `ONLY=ur5e_mock,xarm6_moveit_fake,wx250s node tests/real-arms-audit.mjs`: ur5e_mock 25/25 and
  wx250s 28/28 pass. xarm6_moveit_fake passes 22/23. **Open bug:** after the terminal `send_goal` test, the
  MotionPlanning Plan button to "home" fails with `START_STATE_IN_COLLISION` between `link_base` and `link6`.
  The likely cause is that the sphere approximation of the collision meshes is too coarse; the real MoveIt uses the
  meshes and finds no collision there. Start item 1 below with this bug.
- Not yet run with the new test: fr3, gen3, lite6, cr5, ur5e_sim_control and ur5e_sim_moveit.

**Ground-truth kit** (new): `tools/ground-truth/`. On Ubuntu, `capture.sh` records real ROS 2; `tests/sim-capture.mjs`
records the site; `compare.mjs` writes `ground-truth/REPORT.md`.

## What is left (paste these prompts into Claude Code, one at a time)

**1. Finish the arm audit:**

```
Use the arm-robot-auditor subagent. Run ONLY=<one robot at a time> node tests/real-arms-audit.mjs for ur5e, fr3,
gen3, xarm6, lite6, wx250s and cr5. For each failure find the cause in the simulator and fix it (CLAUDE.md rules).
Also run node tests/real-moveit.mjs for each arm with its launch command from tests/real-sweep.mjs. Report a table:
robot → check → status → fix.
```

**2. Record real ROS 2 on this PC** (in a normal terminal, takes 1-2 hours the first time):

```bash
bash tools/ground-truth/capture.sh
```

**3. Compare and fix:**

```
The local site runs on localhost:8080. Run node tests/sim-capture.mjs, then node tools/ground-truth/compare.mjs.
Then use the mobile-robot-auditor and arm-robot-auditor subagents in parallel to fix every difference in
ground-truth/REPORT.md that is not listed as expected in tools/ground-truth/README.md. Re-capture and compare again
until only expected differences remain.
```

**4. Full regression:**

```
Run every test listed in CLAUDE.md, one after another, and fix anything that fails. Then use the parity-reviewer
subagent to review all changes since the first commit ("V24 start").
```

**5. Release notes and upload:**

```
Write UPDATE-V24.md in the style of UPDATE-V23.md, describing what changed since V23. Then tell me the exact
firebase deploy commands I need, based on which folders changed.
```

## Known remaining gaps (honest, from upstream or by design)

- **FR3 Gazebo launches** fail as they do upstream: the URDF has two root links.
- **Gen3 in Gazebo:** the robotiq gripper controller fails to activate, as upstream (no gripper in the simulation URDF).
- **Interbotix:** the `xs_sdk` fake driver's internals are not modelled, and there is no Gazebo launch for Jazzy upstream.
- **Crazyflie:** the firmware controller and physics are not run, so the drone follows the plan exactly. The terminal
  says so.
- **Scout:** description only; the upstream Jazzy branch has no Gazebo package.
- **Nav2:** the docking and route servers are lifecycle-only.
- **Simulation speed:** on a weak computer the browser Gazebo runs slower than real time, as real Gazebo does when
  the CPU can't keep up.
