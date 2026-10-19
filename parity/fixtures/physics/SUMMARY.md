# Gazebo physics baseline (REAL) – parity/fixtures/physics/

Machine: Ubuntu 24.04, ROS 2 Jazzy, `gz sim --versions` 8.15.0 (ros-jazzy-gz-sim-vendor 0.0.13), gz-physics 7.8 (ENVIRONMENT.txt).
Worlds: parity/scripts/physics/gen_worlds.py → worlds/*.sdf (copied as <case>/world.sdf). 1 ms step, RTF 1, gravity 9.8.
Runs: run_case.py (3 runs per case, determinism 10), ur5e_case.sh, tb3_ros_side.sh. Numbers: <case>/summary.json (analyze.py),
all cases side by side in RESULTS_TABLE.txt. "mean [min..max]" over runs. Time base: header stamp, else world clock at arrival (±1 ms).

## Engine
- Physics system loads `gz::physics::dartsim::Plugin` (libgz-physics-dartsim-plugin.so) for every world (run*/server_excerpt.txt line 4).
- `<physics type="bullet">` is IGNORED: drop_typebullet loads dartsim too, and its results equal drop's (drop_typebullet/run*/server_excerpt.txt).
- Installed engine plugins: dartsim, bullet, bullet-featherstone, tpe (ENVIRONMENT.txt).
- Determinism: determinism world 10× → 3000 pose rows per run, max |diff| vs run 1 = 0.0 in all 10 runs (bit-identical).

## Rigid bodies
| Case | Measured (real) | Analytic |
|---|---|---|
| Box drop 1 m (0.2 m cube, 1 kg) | first contact 0.451 s; no bounce (max z after contact 0.099999); rest z 0.09998 → penetration 1.6e-5 m (3 runs 1.3–2.1e-5); 4 contact points per message at rest; mean contact depth 3.1e-5 m; settles (|z−rest|<1e-4) at 3.64 s | fall time 0.4518 s |
| Restitution, ground e = 1 | sphere e 0 / 0.5 / 0.9 / 1.0 → e_eff 0.0 / 0.4992 / 0.9017 / 1.0022 | combine rule = product |
| Restitution, ground e = 0.5 | sphere e 0 / 0.5 / 0.9 / 1.0 → e_eff 0.0 / 0.2451 / 0.4487 / 0.4992 | product: 0 / 0.25 / 0.45 / 0.5 |
| Sliding, same mu on box and ground, v0 0.5 m/s | mu 0.01: stop 1.275 m in 5.09 s; mu 0.1: 0.1273 m; mu 0.5: 0.0253 m; mu 1.0: 0.0125 m; fitted decel = mu·g exactly (0.098 / 0.98 / 4.9 / 9.8) | v0²/(2µg): 1.275 / 0.1271 / 0.0250 / 0.0123 (with the measured v0) |
| mu 0.1 / mu2 1.0, fdir1 = x, on ground mu 1 | push along x: mu_eff 0.1 (2.04 m from 2 m/s); along y: mu_eff 1.0 (0.203 m) | fdir1/mu2 honoured; box mu wins over ground mu 1 |
| Friction combine: ground 0.5, boxes 0.1 and 1.0 | mu_eff 0.1 and 0.5 | rule = MIN of the two |
| Incline 10/15/30/45°, mu 1 | sphere a/(g sinθ) = 0.7143, cylinder 0.6667, frictionless box 0.999–1.001 | 5/7 = 0.7143, 2/3, 1 |
| Two-box collision, frictionless, default surfaces | A 1.0 → 0.5 m/s, B 0 → 0.5 m/s: e = 0 (perfectly inelastic), momentum ratio 1.0 | – |
| Link with NO `<inertial>` | `gz model -l`: Mass 1.000000 kg, inertia diag 1, 1, 1 (kg·m²); 1 N·s impulse → 0.990 m/s, same as a declared 1 kg box | SDF default mass 1, I = identity |
| Pendulum L 1 m, 1 kg, θ0 0.5 rad | period 2.040 s (damping 0), 2.028 (0.1), 2.037 (1.0); log decrement 0 / 0.1025 / 1.017; amplitude after 10 s 0.500 / 0.33 / 0.0085 | small-angle 2.008 s; with 0.5 rad amplitude ≈ 2.04 s |
| Pendulum + spring k = 10 N·m/rad | period 1.423 s, log decrement 0.0072 | 1.413 s (small angle) – spring honoured |
| Joint limits (effort 1 N·m, velocity 0.5 rad/s, ±1 rad), 5 N·m commanded | initial α 2.999 rad/s² (= 1 N·m / I, effort CLAMPED), max velocity 0.5 (CLAMPED), stops at 1.0 rad (position limit) | – |

## TurtleBot3 burger (installed model, DiffDrive system)
| Case | Measured |
|---|---|
| 0.2 m/s step (max_linear_acceleration 1.0) | ground truth 90 % of speed 0.267 s after command, initial accel 0.55 m/s² (below the 1.0 limit); odom vx 90 % after 0.200 s; after 10 s: ground truth 1.979 m, odom 2.005 m, position error 0.026 m |
| same without max_linear_acceleration (model copy) | 90 % after 0.020 s; ground truth 2.008 m, odom 2.022 m |
| 1.0 rad/s step | odom wz = 1.0 at once; ground truth yaw rate reaches 90 % after 1.25 s (wheel slip at spin-up) → odom yaw LEADS ground truth by 0.653 rad after 10 s; position error 0.052 m. Same with/without max_linear_acceleration (it limits linear only) |
| Odom | frame_id `odom`, child_frame_id `base_footprint`; 50 messages per sim second although the model says `<odom_publisher_frequency>30</odom_publisher_frequency>` |
| Pushing a 0.1 kg box 0.5 m ahead | box starts moving at 3.155 s sim (2.155 s after the command); robot keeps 0.2 m/s; box displaced 1.16 m by 9 s; odom 1.597 m vs ground truth 1.546 m |
| IMU (200 Hz/sim s, frame `burger::imu_link::tb3_imu` on the gz side) | angular velocity std 2.0e-4 rad/s (model stddev 2e-4); linear acceleration std 0.0166–0.0176 m/s² (model 1.7e-2); ax mean 0.122 m/s² (the IMU link is tilted: orientation qy −0.00623); orientation not noisy (std 0) |
| Lidar empty world | 360 rays, 0 … 6.28 rad, step 0.017493 rad, range_min 0.12, range_max 3.5; EVERY range = +inf (111 800 values, none = range_max, no NaN); 5 scans per sim s; frame `base_scan` |
| Lidar, wall 1.0 m ahead | ray 0: mean 1.013 m, std 0.0112 m (model stddev 0.01, resolution 0.015), min 0.976, max 1.047, 311 scans; ±10° rays (perpendicular-corrected) mean 1.013, std 0.0109 |
| ROS side (bridge with installed turtlebot3_burger_bridge.yaml), tb3_ros_side/ros_side.txt | /cmd_vel is geometry_msgs/msg/TwistStamped; /scan, /imu, /odom from node `ros_gz_bridge`, QoS RELIABLE / VOLATILE; /imu covariances all 0.0 (imu_bridged.csv); rates measured in WALL time with the rendering world at RTF ≈ 0.62 (imu 125 Hz, odom 30 Hz, scan 3.1 Hz, joint_states 597 Hz) |

## UR5e under gz_ros2_control (ur_simulation_gz, installed)
| Case | Measured |
|---|---|
| Trajectory (joint_trajectory_controller, 2 points over 4 s) | result status 4 (SUCCEEDED), error_code 0; max |reference − feedback| 0.0047 (shoulder_pan), 0.0028 (shoulder_lift), 0.0037 rad (elbow); /joint_states and controller_state at 500 Hz (update_rate 500) |
| Position step +0.2 rad on shoulder_pan (forward_position_controller) | update_rate 100, gain 0.1: first-order, τ(63 %) 0.100 s, 95 % at 0.29 s, no overshoot. update_rate 1000, gain 1.0: τ 0.041 s, overshoot 7.7 %. update_rate 100 gain 0.5 / 1.0 and update_rate 1000 gain 0.1 / 0.5: the joint slews at ≈ π rad/s (the UR5e velocity limit) far PAST the target (up to ~6 rad, 30× the step) and swings back – same in all 3 runs of each. Cause not established (UNVERIFIED). The gain is applied: log "The position_proportional_gain has been set to: <g>", `ros2 param get /gz_ros_control position_proportional_gain` |
