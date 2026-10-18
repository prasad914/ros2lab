# Overnight run 2026-10-18/19 (unattended)

Part A: branch `parity-fixes` in `~/ros2lab-course`. Part B: branch `robots-p2b` in the worktree `~/ros2lab-robots`.
Every decision below names its evidence (file, command output or commit).

## Start state
- 2026-10-18 22:02 IST. `parity-fixes` at 51df796, `robots-p2b` at ca2ed53. Dev servers already up on :8000 and :8080.
- Decision: no separate baseline gate run; the last full gate on 51df796 is recorded green in
  `expert_review_2026-10-18.md` ("Gate (final)"). Any failure later is compared with that.

## Part A

### A0 – review committed
- 0f11c41 `parity/reports/expert_review_robots_2026-10-18.md` (no fixtures behind it, says so in the commit).

## Part B (worktree ~/ros2lab-robots, branch robots-p2b)

### B1 – moveit_capture.py collision case (16d8d66)
- Start state checked with `/check_state_validity` (no box) before anything; box (0.08 m cube, was 0.2 m) placed
  around the EE pose of a joint goal only; kept only if the start state is still valid with the box AND the goal
  state is invalid with it, otherwise removed and the next first-joint offset tried (+0.4, +0.6, +0.8, -0.4, -0.6,
  -0.8 rad, inside the URDF limits). Goal planned with 1 and with 10 planning attempts
  (`fail_goal_in_collision_attempts1/10`). Box removed, `/get_planning_scene` (WORLD_OBJECT_NAMES) must not list it.
  All checks → `runs/collision_checks.json`. Decision: 0.08 m box (smaller box = less chance of touching the start
  pose; the validity checks decide, not the size).
- Mistake found and corrected: the B3 commit first picked up the staged ur5e rename from B2 (`git commit` takes the
  whole index); split with `git reset --soft` before anything else. From then on robots-p2b commits name their paths.

### B3 – tb4 EGL /scan marked invalid (a388fb0)
- `parity/fixtures/tb4/p2c_sensors/README.md`, `parity/fixtures/tb4/p2c_nav/run1/README.md`. Evidence cited:
  `p2c_nav/run1/session.txt` lines 16-22 ("0 valid ranges"), line 51 ("lidar ranges all 0.164 = range_min under
  EGL"); contrast `p2c_scan_xvfb/scan_probe.txt` (440/640 finite under xvfb). The 640/640 rclpy probe was not saved
  as a file: stated as such. Captured files not edited.

### A1 – real-hardware lock by what a launch starts
- Probe first (`tests/_probe_hw.mjs`, scratch, not committed): what each review launch starts in the browser
  (`graph.procInfos`). ur5e.launch.py: ros2_control_node with `ur_robot_driver/URPositionHardwareInterface` +
  dashboard_client, urscript_interface, controller_stopper_node, robot_state_helper; with `use_mock_hardware:=true`
  the same launch starts only cm (mock_components/GenericSystem), rsp, rviz2, trajectory_until_node, spawners.
  xarm6_planner_realmove: plugin `uf_robot_hardware/UFRobotSystemHardware`; xarm6_driver: `xarm_api xarm_driver_node`;
  scout_mini_base: `scout_base scout_base_node`; keyboard_velmux: `crazyflie_server_cpp crazyflie_server` (backend cpp).
- Rule (real-launch.js): a process is real hardware if it is a known driver node (HW_NODES, each checked against the
  makers' launch files: `Node(package=..., executable=...)`) or ros2_control_node whose URDF `<hardware><plugin>` is
  declared by the workspace's pluginlib XML with a `hardware_interface::` base class and is not fake/mock/sim
  (declared: URPositionHardwareInterface, UFRobotSystemHardware, FrankaHardwareInterface, KortexMultiInterfaceHardware,
  RobotiqGripperHardwareInterface, XSHardwareInterface). Locked: the process is not started, the lock note is printed
  once, the launch is stopped like Ctrl+C. The command-string lock in terminal-sim.js is removed.
- The invented pluginlib "class ... does not exist" error for these declared plugins is gone: unlicensed → lock note;
  licensed → an honest "(ROS2Lab: <plugin> is the maker's driver …)" note.
- First fix missed fr3 `franka.launch.py`: in Franka's URDF `<param>`s come before `<plugin>` inside `<hardware>`
  (probe `tests/_probe_fr3.mjs`); regex widened.
- Failing test first: `parity/e2e/hw-lock.spec.ts` before the fix: 6 failed / 2 passed (the 2 mock/sim cases).
