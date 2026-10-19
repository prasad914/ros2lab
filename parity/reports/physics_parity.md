# Physics parity: real Gazebo Harmonic vs the ROS2Lab site (2026-10-20)

Auditor: read-only physics-parity audit. No site code, content or fixtures were changed. No real ROS 2 or Gazebo was started.

**REAL** means the measured baseline in `parity/fixtures/physics/` (gz sim 8.15.0, dartsim, 1 ms step; `SUMMARY.md`, `RESULTS_TABLE.txt`, `<case>/summary.json`).
**SITE** means the site's own modules, given the **same** `<case>/world.sdf`: `gz-sdformat.js` gzLoadWorld, then `ros-gz.js` gzSim/gzStep, then `gz-physics.js` (Rapier). The site is stepped the way the page steps it: `terminal-sim.js:1681-1686` gzTick runs every 50 ms and calls `gzStep(dt)` with the wall time since the last tick, capped at 0.1 s. Here dt is fixed at 0.05 s, so Rapier runs 50 × 1 ms substeps per call. The inputs are the same, at the same sim times. Each case ran 3 times; determinism ran 10 times. The site CSVs use the real fixture format, and the **real analysis script** (`parity/scripts/physics/analyze.py`, unchanged) measures both sides.

## Raw outputs (all under `parity/browser_out/physics/`)

| What | Path |
|---|---|
| Case runner (site modules in Node) | `site_cases.mjs` (modes: `page` = the site as students get it; `engine` = DIAGNOSTIC, see below; `pagestrip` = DIAGNOSTIC) |
| Analysis (imports the real `analyze.py`) | `analyze_site.py`, then `site_runs/<mode>/<case>/summary.json` |
| Side-by-side table, every key | `compare_table.txt` / `compare_table.json` (from `compare.py`) |
| Lidar from the same sensor worlds | `site_sensors.mjs`, then `site_runs/page/tb3_sensors_{empty,wall}/` |
| TB3 page in headless Chromium (rviz.html?robot=tb3_burger, official ROBOTIS ws, `empty_world.launch.py`) | `site_browser.mjs`, then `browser_tb3/ros_side_site.txt`, `browser_tb3/sensor_samples.json`, `browser_tb3/launch_screen.txt` |
| UR5e (`ur_sim_control.launch.py` processes from `tests/gz-fixtures/ur5e-1.json`) | `site_ur5e.mjs`, then `site_runs/page/ur5e/summary.json`, `traj_dt*.csv`, `step_r*_dt*.csv` |

The `engine` mode is a DIAGNOSTIC that students cannot reach. It removes the PosePublisher, JointStatePublisher and contact-sensor elements from the SDF, so the bodies take the site's Rapier dynamic path (`gz-physics.js` addWorldModel). The impulse is applied straight to the Rapier body (applyImpulse = F × 1 ms), because the site has no wrench input. It shows what the site's engine would do if the routing and input gaps below were fixed. **The verdicts use `page` mode only.**

## Site engine facts (measured)

| Fact | REAL | SITE | Verdict |
|---|---|---|---|
| Engine | dartsim plugin for every world (`<case>/run*/server_excerpt.txt` line 4) | Rapier (`gz-physics.js:1-10`); the world reports `engine: "dartsim"` (`gz-sdformat.js:614`) but simulates with Rapier | DIFFERS (informational) |
| Step size | 1 ms (`world.sdf` max_step_size) | Rapier substep `PH.dt` = 0.001 s (`run_meta.json`). Gravity on models, drive systems and joint dynamics are integrated once per page frame (0.05 s): `ros-gz.js:372-411` | DIFFERS (the rigid-body step matches; the model step is 50× coarser) |
| `<physics type="bullet">` | ignored; results equal `drop` | ignored; `drop_typebullet` = `drop` (`site_runs/page/drop_typebullet/summary.json`) | MATCH |
| Real-time factor | 1 | nominally 1 (wall-clock dt, `terminal-sim.js:1685`). Measured in headless Chromium while my sampler was polling: 4.05 sim s in 30 wall s, about 0.135 (`browser_tb3/sensor_samples.json`) | UNVERIFIED: headless and instrumentation load; no clean browser measurement |
| Determinism (10 runs) | bit-identical, max diff 0.0 (`determinism/summary.json`) | Node, fixed dt: bit-identical, max diff 0.0 (`site_runs/page/determinism/summary.json`). In the browser dt is wall-clock, so the runs are not reproducible by construction (`terminal-sim.js:1685`) | MATCH in Node; browser UNVERIFIED |

## Totals (page mode, 114 verdicts in the tables below; "×3" rows count 3)

| Verdict | Rows |
|---|---|
| MATCH | 44 |
| DIFFERS | 51 |
| SITE CANNOT | 15 |
| UNVERIFIED | 4 |

## Root causes (site code paths)

1. **Every body in the baseline worlds becomes a kinematic "robot", so there is no rigid-body dynamics.** `gz-sdformat.js:587` sends any non-static model that has a joint, a plugin or a sensor to the robot path. Every baseline body carries a PosePublisher plugin (and `drop` also carries a contact sensor). Robot bodies get `ros-gz.js:473-496` gzGravity instead of physics:
   - they drop straight down at a hard-coded 9.81 m/s² (`ros-gz.js:487,492`; the world says 9.8);
   - they stop at the ground plane's rest height and ignore any other surface (ramps, other boxes);
   - they never bounce, slide, roll, tip or get pushed;
   - their Rapier body is kinematic (`gz-physics.js:174`).

   Any student world whose objects have a plugin or a sensor behaves like this.
2. **There is no external force input.** `/world/<w>/wrench` (ApplyLinkWrench) is not in `gzTopicList` (`ros-gz.js:313-345`), and the gz CLI has no `topic -p` (`ros-gz.js:648-660`). ApplyJointForce's `/model/<m>/joint/<j>/cmd_force` is listed (`ros-gz.js:336`), but nothing in `public/js` consumes kind `cmd_force`.
3. **Contact surfaces in the Rapier path are simplified.**
   - There is one `mu` and one restitution per model: the last collision that sets them wins (`gz-sdformat.js:469`).
   - mu2 and fdir1 are parsed (`gz-sdformat.js:251-252`) but never reach Rapier.
   - Friction and restitution use Rapier's default combine rule, AVERAGE (`gz-physics.js:79`, no `setFrictionCombineRule`). Real uses MIN for friction and PRODUCT for restitution.
   - mu is capped at 2.
4. **Joint springs are ignored.** `spring_stiffness` is read (`gz-sdformat.js:392`), but `sdfModelToTree` copies only damping and friction (`gz-sdformat.js:507`), and `stepJointDynamics` has no spring term (`gz-physics.js:337-366`).
5. **The DiffDrive is kinematic.** The base moves by exactly the commanded (limited) velocity (`ros-gz.js:498-517`), and odometry is integrated from wheel angles that the same code sets (`ros-gz.js:405-406,423-432`). So odom equals ground truth: there is no wheel slip and no spin-up lag. The speed limiter reaches the model's `max_linear_acceleration` exactly (`ros-gz.js:414-421`).
6. **The IMU in the browser** (`gz-sim.js:220-227`):
   - its noise is uniform ±0.002 on every axis (std 0.00115), whatever the model's `<noise>` says;
   - gravity is 9.80665;
   - orientation is the ideal link orientation;
   - samples are capped at 30 Hz (`terminal-sim.js:1703`).
7. **Lidar resolution is applied.** Both lidar paths round each noisy range to `<range><resolution>` (`ros-gz.js:567`, `gz-sim.js:172`). Real gpu_lidar does not.
8. **The gz_ros2_control gain is fixed.** `position_proportional_gain` is never read from the controllers yaml (`gz_ros_control.ros__parameters`) or the plugin. `ros2-control.js:99` builds `gzPlugin` without a gain, so `ros-gz.js:450` always uses 0.1.

## Differences a student would notice (top)

| # | Case · quantity | REAL | SITE | Why |
|---|---|---|---|---|
| 1 | tb3_push · light box displacement | 1.161 m [1.159..1.162], first moves at 3.155 s (`tb3_push/summary.json`) | 0 m: the robot drives through the box (`site_runs/page/tb3_push/summary.json`) | cause 1 (the box has a PosePublisher). DIAGNOSTIC without it: 1.197 m, moves at 3.05 s (`site_runs/pagestrip/tb3_push/summary.json`) |
| 2 | tb3_ang · ground-truth yaw vs odom after 10 s | odom leads ground truth by 0.653 rad; ground truth reaches 90 % rate after 1.251 s | 0 rad; 90 % after one frame (0.05 s) | cause 5 |
| 3 | restitution · bounce e_eff (sphere 0.9 on ground 1.0) | 0.902 | 0 (no bounce at all, any e) | cause 1; DIAGNOSTIC engine: 0.950 (average rule, cause 3) |
| 4 | incline 30° · sphere / cylinder / frictionless box | roll or slide down the ramp, a/(g sinθ) = 0.714 / 0.667 / 1.000 | all three fall vertically THROUGH the ramp to the ground plane (z 4.88, then 0.1 within 1 s) | cause 1 |
| 5 | slide_mu*, slide_aniso, slide_combine, collision, noinertial · any push | box slides `v0²/(2µg)` (e.g. 0.127 m at µ 0.1) | SITE CANNOT: no wrench topic | cause 2 |
| 6 | tb3_lin · initial acceleration | 0.55 m/s² (90 % of 0.2 m/s after 0.267 s) | 1.0 m/s² (0.2 m/s after 0.20 s) | cause 5 |
| 7 | tb3_lin / tb3_push · odom vs ground truth | 0.026 m / 0.051 m apart after the run | 0.000 m | cause 5 |
| 8 | IMU noise (browser) | gyro std 2.0e-4 rad/s, accel std 0.017 m/s², ax mean 0.122 (tilted IMU link), qy −0.00623 | gyro std 0.00113 (5.6×), accel std 0.00116 (15× too small), ax mean 0.0000, qy 0 | cause 6 |
| 9 | pendulum with spring k = 10 | period 1.423 s | 2.045 s (the spring is ignored) | cause 4 |
| 10 | joint_limits · ApplyJointForce 5 N·m | moves: α 2.999 rad/s² (effort clamped), v 0.5, stops at 1.0 rad | does not move (0 rad) | cause 2 |
| 11 | lidar at wall 1 m · ray 0 | mean 1.013 m, 311 distinct values in 311 scans | mean 0.9996 m, 5 distinct values (quantized to 0.015) | cause 7; the +13 mm real offset is not reproduced |
| 12 | UR5e step, gain ≠ 0.1 (4 cases) | joint slews at ≈ π rad/s far past the target (final 19–27 × the step) | converges without overshoot: the gain cannot be set | cause 8 |
| 13 | determinism world · tilted box final pose | rests on base_box, z 0.29999 | z 0.1: falls through base_box to the ground | cause 1 |

Lidar inf vs range_max **MATCHES**: an empty world gives every range = +inf and none = range_max on both sides.

## All rows

Tolerances, since the real run-to-run spread is often 0:
- **times:** one site page frame, 0.05 s;
- **periods, distances and means:** 1 %;
- **decrements:** 2 %, because the site samples at 20 Hz;
- **noise std:** ±10 %;
- **anything outside these:** DIFFERS.

Real values are `mean [min..max]` from `parity/fixtures/physics/<case>/summary.json`. Site values come from `parity/browser_out/physics/site_runs/page/<case>/summary.json` unless another path is given.

### Rigid bodies

| Case · quantity | REAL | SITE | Diff | Verdict |
|---|---|---|---|---|
| drop · first contact t | 0.451 s | 0.45 s | −0.001 | MATCH (frame) |
| drop · bounce height | −1.1e-6 m (none) | 0 (none) | – | MATCH |
| drop · rest z | 0.09998 | 0.1 | +2e-5 | MATCH (1e-4) |
| drop · penetration | 1.6e-5 m | 0 | – | MATCH (1e-4) |
| drop · settle time | 3.639 s | 0.40 s | −3.24 s | DIFFERS (the site clamps to the rest height at once) |
| drop · contact sensor (4 points/msg, depth 3.1e-5) | 3728 msgs | no `/contact/box` topic: `gzTopicList` lists only imu/lidar/camera sensors (`ros-gz.js:319`) | – | SITE CANNOT |
| drop_typebullet · same 5 quantities | = drop | = site drop | – | MATCH (counted once as the engine row) |
| restitution g1.0 · e 0.0 | 0.0 | 0.0 | 0 | MATCH |
| restitution g1.0 · e 0.5 | 0.4992 | 0 | −0.50 | DIFFERS |
| restitution g1.0 · e 0.9 | 0.9017 | 0 | −0.90 | DIFFERS |
| restitution g1.0 · e 1.0 | 1.0022 | 0 | −1.00 | DIFFERS |
| restitution g0.5 · e 0.0 | 0.0 | 0.0 | 0 | MATCH |
| restitution g0.5 · e 0.5 | 0.2451 | 0 | −0.25 | DIFFERS |
| restitution g0.5 · e 0.9 | 0.4487 | 0 | −0.45 | DIFFERS |
| restitution g0.5 · e 1.0 | 0.4992 | 0 | −0.50 | DIFFERS |
| slide_mu0.01 · stop distance | 1.275 m | box never pushed | – | SITE CANNOT (engine diag: 1.064 m; it stops at 3.02 s instead of 5.09 s with decel 0.098 correct. The early stop is probably Rapier sleeping, no `setCanSleep(false)` in `gz-physics.js:173`: UNVERIFIED) |
| slide_mu0.1 · stop distance | 0.1273 m | never pushed | – | SITE CANNOT (engine diag 0.1276) |
| slide_mu0.5 · stop distance | 0.02526 m | never pushed | – | SITE CANNOT (engine diag 0.02554) |
| slide_mu1.0 · stop distance | 0.01251 m | never pushed | – | SITE CANNOT (engine diag 0.01275) |
| slide_aniso · mu_eff along x / y | 0.1 / 1.0 | never pushed | – | SITE CANNOT (engine diag 0.55 / 0.55: mu2/fdir1 dropped, average combine) |
| slide_combine · mu_eff box 0.1 / 1.0 on ground 0.5 | 0.1 / 0.5 (MIN) | never pushed | – | SITE CANNOT (engine diag 0.30 / 0.75: AVERAGE) |
| incline_10 · sphere a/(g sinθ) | 0.7143 | −0.507 (vertical fall through the ramp) | – | DIFFERS |
| incline_10 · cylinder | 0.6667 | −0.507 | – | DIFFERS |
| incline_10 · frictionless box | 0.9988 | −0.507 | – | DIFFERS (engine diag 0.0: stuck, because ramp mu 1 and box mu 0 average to 0.5) |
| incline_15 · sphere / cylinder / box | 0.7143 / 0.6667 / 1.001 | 0.034 each (vertical fall) | – | DIFFERS ×3 |
| incline_30 · sphere / cylinder / box | 0.7143 / 0.6667 / 1.000 | 0.592 each (vertical fall) | – | DIFFERS ×3 (engine diag 0.712 / 0.661 / 0.134) |
| incline_45 · sphere / cylinder / box | 0.7143 / 0.6667 / 1.001 | 0.749 each (vertical fall) | – | DIFFERS ×3 (engine diag 0.712 / 0.662 / 0.500) |
| collision · v_A / v_B after, e | 0.5 / 0.5, e 0 | A never pushed | – | SITE CANNOT (engine diag 0.4997 / 0.5002, e 0.0005) |
| noinertial · rest z before push (both boxes) | 0.1 / 0.1 | 0.1 / 0.1 | 0 | MATCH |
| noinertial · effective mass (1 N·s impulse) | 1.01 / 1.01 | never pushed | – | SITE CANNOT (engine diag 1.006 / 1.006) |
| noinertial · inertia of a link without `<inertial>` | 1, 1, 1 (`gz model -l`) | not inspectable: the site's `gz model` has only `--list` (`ros-gz.js:664`) | – | UNVERIFIED |
| determinism · bit-identical 10× | yes | yes (Node, fixed dt) | 0 | MATCH |
| determinism · final pose of tilted box | (0.0005, 0.0377, 0.29999) | (0.03, 0.02, 0.1), still at its start tilt | z −0.2 | DIFFERS (engine diag (−0.028, 0.194, 0.0987): it slides off base_box) |

### Joints

| Case · quantity | REAL | SITE | Diff | Verdict |
|---|---|---|---|---|
| pend_d0 · period | 2.040 | 2.045 | +0.25 % | MATCH (1 %; the site adds armature 0.005 to I, `gz-physics.js:349`) |
| pend_d0 · log decrement | −2.7e-7 | 4.0e-4 | +4e-4 | MATCH (abs 1e-3) |
| pend_d0 · amplitude at 10 s | 0.500 | 0.500 | 0 | MATCH |
| pend_d01 · period | 2.028 | 2.033 | +0.25 % | MATCH |
| pend_d01 · log decrement | 0.1025 | 0.1041 | +1.6 % | MATCH (2 %) |
| pend_d01 · amplitude at 10 s | 0.3305 [0.3279..0.3321] | 0.3323 | +0.5 % | MATCH |
| pend_d1 · period | 2.037 | 2.042 | +0.25 % | MATCH |
| pend_d1 · log decrement | 1.017 | 1.015 | −0.2 % | MATCH |
| pend_d1 · amplitude at 10 s | 0.008466 | 0.008546 | +0.9 % | MATCH |
| pend_spring · period | 1.423 | 2.045 | +44 % | DIFFERS (cause 4) |
| pend_spring · log decrement | 0.00716 | 0.00040 | – | DIFFERS |
| pend_spring · amplitude at 10 s | 0.479 | 0.500 | +4 % | DIFFERS |
| joint_limits · initial α (5 N·m, effort limit 1) | 2.999 rad/s² | 0, no motion; `cmd_force` not consumed (`commands_sent.json`) | – | SITE CANNOT |
| joint_limits · max velocity (limit 0.5) | 0.5 | 0 | – | SITE CANNOT (also, `stepJointDynamics` effort mode does not clamp to the velocity limit, `gz-physics.js:362`) |
| joint_limits · final position (limit 1.0) | 1.0 | 0 | – | SITE CANNOT |

### TurtleBot3 burger (installed model, DiffDrive)

The command is the gz Twist on `/cmd_vel` at t = 1 s, set the same way `ros-gz.js` gzTwist does. The site's odom row rate in my CSVs is my 20 Hz recording; the published rate is the `gzTopicList` value.

| Case · quantity | REAL | SITE | Diff | Verdict |
|---|---|---|---|---|
| tb3_lin · gt initial acceleration | 0.5485 m/s² | 1.0 m/s² (speed 0.05 / 0.10 / 0.15 / 0.20 at +0.05 s steps, `model__burger__pose.csv`) | +82 % | DIFFERS |
| tb3_lin · gt time to 90 % | 0.267 s | 0.20 s | −0.067 | DIFFERS |
| tb3_lin · odom vx time to 90 % | 0.200 s | 0.20 s | 0 | MATCH |
| tb3_lin · gt distance (10 s) | 1.979 [1.978..1.982] m | 1.985 m | +0.3 % | MATCH (1 %) |
| tb3_lin · odom distance | 2.005 [2.004..2.008] m | 1.985 m | −1.0 % | DIFFERS |
| tb3_lin · odom−gt position error | 0.0260 m | 0.0000 | – | DIFFERS |
| tb3_lin · final speed gt / odom vx | 0.2001 / 0.2 | 0.2 / 0.2 | 0 | MATCH |
| tb3_lin_noacc · gt time to 90 % | 0.0203 s | 0.05 s (one frame) | – | MATCH (frame) |
| tb3_lin_noacc · gt / odom distance | 2.008 / 2.022 | 2.000 / 2.000 | −0.4 % / −1.1 % | MATCH / DIFFERS |
| tb3_lin_noacc · position error | 0.0143 m | 0.0000 | – | DIFFERS |
| tb3_ang · odom wz | 1.0 | 1.0 | 0 | MATCH |
| tb3_ang · gt yaw rate time to 90 % | 1.251 s | 0.05 s | −1.20 s | DIFFERS |
| tb3_ang · yaw error odom−gt (10 s) | 0.653 rad | 0.0 | – | DIFFERS |
| tb3_ang · position error | 0.0523 m | 0.0 | – | DIFFERS |
| tb3_ang_noacc · same three | 1.251 s / 0.6535 / 0.0523 | 0.05 / 0 / 0 | – | DIFFERS (counted once) |
| tb3_push · box displacement | 1.161 m | 0 | – | DIFFERS |
| tb3_push · box first moved | 3.155 s | never | – | DIFFERS |
| tb3_push · robot gt distance | 1.546 m | 1.585 m | +2.5 % | DIFFERS |
| tb3_push · odom distance | 1.597 m | 1.585 m | −0.8 % | MATCH (1 %) |
| odom frame_id / child_frame_id | odom / base_footprint | odom / base_footprint | – | MATCH |
| odom publish rate (per sim s) | 50 (model says 30) | 50 (`gzTopicList`; the parser misses `odom_publisher_frequency`, default 50; `site_runs/page/tb3_sensors_wall/run1/run_meta.json`) | 0 | MATCH |

### TurtleBot3 sensors

The lidar comes from the same worlds, through the Node `gzScan` path (`site_runs/page/tb3_sensors_*`). The IMU comes from the browser page (`browser_tb3/sensor_samples.json`, 41 samples, `empty_world.launch.py`).

| Case · quantity | REAL | SITE | Diff | Verdict |
|---|---|---|---|---|
| empty · ranges = +inf | 111 800 of 111 800 | 111 960 of 111 960 | – | MATCH |
| empty · ranges = range_max / NaN | 0 / 0 | 0 / 0 | – | MATCH |
| browser empty world · inf per scan | (as above) | 360 of 360 inf, 0 at 3.5 (17 scans, gz-sim.js path) | – | MATCH |
| scan meta (360 rays, 0..6.28, step 0.017493036, 0.12..3.5) | as listed | identical | – | MATCH |
| scan frame_id | base_scan | base_scan | – | MATCH |
| scan rate per sim s | 5 | 5 (claimed and Node); browser measured 4.05 | – | MATCH (claimed); browser UNVERIFIED (headless RTF) |
| wall · ray 0 mean | 1.013 m | 0.9996 m | −13 mm | DIFFERS |
| wall · ray 0 std | 0.01115 | 0.0108 | −3 % | MATCH (10 %) |
| wall · ray 0 distinct values | 310.7 | 5 | – | DIFFERS (cause 7) |
| wall · ±10° perpendicular mean | 1.013 | 0.9994 | −14 mm | DIFFERS |
| wall · finite / inf counts | 39 470 / 72 490 | 39 810 / 72 150 | +0.9 % finite | MATCH (1 %) |
| IMU · gyro std | 2.0e-4 rad/s | 1.13e-3 | ×5.6 | DIFFERS |
| IMU · accel std | 0.0169–0.0172 | 0.00116 | ×0.07 | DIFFERS |
| IMU · ax mean (tilted link) | 0.122 m/s² | 0.0000 | −0.122 | DIFFERS |
| IMU · az mean | 9.799 | 9.807 (uses 9.80665, `gz-sim.js:223`) | +0.008 | DIFFERS |
| IMU · orientation qy | −0.00623, std 0 | 0, std 0 | – | DIFFERS |
| IMU · rate per sim s | 200 | 200 claimed (`gzFeeds`); samples refresh at most 30 Hz (`terminal-sim.js:1703`); measured 9.9 in headless | – | DIFFERS (data refresh) |

### ROS side

REAL is `tb3_ros_side/ros_side.txt` and `imu_bridged.csv`. SITE is `browser_tb3/ros_side_site.txt`.

| Quantity | REAL | SITE | Verdict |
|---|---|---|---|
| topic types: /cmd_vel TwistStamped, /scan LaserScan, /imu Imu, /odom Odometry, /tf TFMessage, /clock, /joint_states | as listed | identical | MATCH |
| topic list extras | none (bare gz + bridge) | `/robot_description`, `/tf_static` (from the launch's robot_state_publisher) | UNVERIFIED (different setup: launch vs bare bridge) |
| publisher node of /scan /imu /odom | ros_gz_bridge | ros_gz_bridge | MATCH |
| QoS /scan /imu /odom /tf /cmd_vel | RELIABLE / VOLATILE | RELIABLE / VOLATILE | MATCH |
| /imu frame_id | burger/imu_link/tb3_imu | burger/imu_link/tb3_imu | MATCH |
| /imu covariances (orientation / angular / linear diagonals) | 0 / 3.999999975690116e-08 / 0.00028899998869746923 | identical | MATCH |

`SUMMARY.md` says "/imu covariances all 0.0", but the real echo and CSV show 4e-8 and 2.89e-4 on the angular and linear diagonals. Only the orientation covariance is 0, so that summary line is inaccurate.

### UR5e under gz_ros2_control

SITE values come from `site_runs/page/ur5e/summary.json`. The REAL run activated `joint_trajectory_controller` (`ur5e_traj/run*/controllers.txt`). The site launch fixture activates the default `scaled_joint_trajectory_controller`, which the site models as the same JTC.

| Case · quantity | REAL | SITE | Verdict |
|---|---|---|---|
| ur5e_traj · /joint_states rate | 500 Hz | 500 (claimed, `cmRate`; the page emits once per 50 ms frame) | MATCH (claimed) |
| ur5e_traj · controller_state rate | 500 Hz (although the yaml says state_publish_rate 100) | 100 (`ros-control-graph.js:325` uses state_publish_rate) | DIFFERS |
| ur5e_traj · max \|ref−fb\| shoulder_pan / lift / elbow | 0.00467 / 0.00280 / 0.00374 rad | 0.00145 / 0.00120 / 0.00123 (page dt 0.05); 0.00675 / 0.00405 / 0.00540 (dt 0.002) | DIFFERS (factor 0.3–1.8 depending on frame rate) |
| ur5e_traj · final error, result status 4 | 0, SUCCEEDED | final error ≤ 6e-6 (page) / 2.3e-4 (2 ms); action result not measured in Node | UNVERIFIED (result) |
| step r100 g0.1 · τ63 / t95 / overshoot | 0.0997 / 0.29 / 0 | 0.100 / 0.30 (0.298 at 2 ms) / 0 | MATCH |
| step r1000 g1.0 · τ63 / t95 / overshoot | 0.041 / 0.062 / 7.7 % | 0.050 / 0.10 page; 0.042 / 0.066 at 2 ms; overshoot 0 (gain stuck at 0.1) | DIFFERS |
| step r1000 g0.1 · final fraction | 19.4 (runaway) | 1.0 | DIFFERS |
| step r100 g0.5, r100 g1.0, r1000 g0.5 · gain applied | gain applied (log + `ros2 param get` = 0.5 / 1.0), runaway to 25–27× | gain cannot be set: always 0.1 | SITE CANNOT ×3 |
| step · joint_states rate r100 / r1000 | 100 / 985–1000 | 100 / 1000 (claimed) | MATCH |

A side observation, not compared with real: `ros2 control switch_controllers --deactivate scaled_joint_trajectory_controller --activate forward_position_controller` returned "Error switching controllers, check controller_manager logs" on the site, so `load_controller --set-state active` was used instead (`site_runs/page/ur5e/summary.json`, "switch").

## Not done / limits

- **IMU statistics come from only 41 browser samples** (headless, RTF about 0.135 while polling). The uniform ±0.002 noise follows from the code (`gz-sim.js:225`, std 0.004/√12 = 0.00115), and the 41 samples agree with it.
- **The wall-case lidar was measured on the Node `gzScan` path**, not the browser `gz-sim.js` path. The two use the same noise and resolution code; the browser path also clamps noisy values into [min, max] (`gz-sim.js:173`).
- **TB3 IMU timestamps and odom per-sim-second rates in the browser** were not isolated from the headless RTF.
- **In the engine diagnostic, pendulum and joint_limits stay on the robot path** (they have joints), so those diagnostic results equal page mode and are not reported separately.
