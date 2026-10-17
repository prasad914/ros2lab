# Gazebo render mode for the TurtleBot3 reference runs (2026-10-17)

`start_reference.sh` starts the TB3 world in one of two ways (`REF_RENDER`, recorded as `render=` in `run_info.txt`):

| REF_RENDER | command | rendering |
|---|---|---|
| `egl` (default since this report) | `ros2 launch parity/scripts/launch/tb3_world_headless.launch.py` | gz server only, `-r -s --headless-rendering -v2`; EGL picks the NVIDIA GeForce RTX 4050 Laptop GPU (eglinfo, device #0) |
| `xvfb` | `xvfb-run -a ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` | ROBOTIS launch file with its GUI client, on Xvfb: Mesa llvmpipe (software) |

`tb3_world_headless.launch.py` includes the installed `ros_gz_sim/gz_sim.launch.py`, `turtlebot3_gazebo/spawn_turtlebot3.launch.py`
(x_pose -2.0, y_pose -0.5) and `robot_state_publisher.launch.py` (use_sim_time true) unchanged, and sets the same
`GZ_SIM_RESOURCE_PATH` as `turtlebot3_world.launch.py`; only the GUI client is left out and `--headless-rendering` added.
Only the Gazebo world changes: the cartographer and nav_robotis scenarios still start rviz2 under `xvfb-run`.

## Same ROS graph in both modes

The sensors scenario was captured with `REF_RENDER=egl OUT_DIR=<scratch>` for each model, one at a time on domain 41 / ref41
(domain empty before and after), and compared with the committed sensors fixtures (`parity/fixtures/<robot>/sensors/`,
captured 2026-10-17 13:48–13:57 with the xvfb launch) using `parity/compare/diff_sensors_capture.py`.
Compared: node list, topic list with types, service and action lists, QoS of every endpoint (reliability, history/depth,
durability, lifespan, deadline, liveliness, lease, node, type, type hash, publisher/subscriber counts), TF frames and edges
(frames_*.gv), and every parameter name and value (params/*.yaml). Ignored: stamps, GIDs, rates (*_hz.txt), and the
run-specific suffixes of `launch_ros_<pid>`, `transform_listener_impl_<id>` and the CLI daemon `_ros2cli_daemon_<domain>_<id>`.

| robot | nodes | topics | services | QoS files identical | TF frames / edges | param files (entries) | result |
|---|---|---|---|---|---|---|---|
| tb3_burger | 2 | 11 | 14 | 11 / 11 | 8 / 7 | 2 (24, 52) | IDENTICAL |
| tb3_waffle | 3 | 17 | 21 | 17 / 17 | 14 / 13 | 3 (24, 58, 35) | IDENTICAL |
| tb3_waffle_pi | 3 | 17 | 21 | 17 / 17 | 12 / 11 | 3 (24, 58, 35) | IDENTICAL |

Not compared: sensor data samples (`samples/`), rates, and the slam / cartographer / nav scenarios in egl mode.
A first waffle_pi egl capture was incomplete (no TF, no params) because `capture_reference.sh` was edited while it ran;
it was discarded and repeated with the committed script.

## Real-time factor (tb3_waffle, sensors world, 60 s wall each, domain 41)

Measured from /clock with a scratch probe; the egl run used a scratch copy of the installed launch file with the same two
changes as `tb3_world_headless.launch.py`.

| mode | sim / wall | /scan per sim s (configured 10) | camera per sim s (configured 30) | GPU use |
|---|---|---|---|---|
| xvfb (llvmpipe) | 0.101 | 10.1 | 21.2 | 0 %, Xorg 4 MiB only |
| egl (NVIDIA) | 0.443 | 10.0 | 10.9 | 27 %, gz server 362 MiB |

Neither mode runs at real time on this machine (load average about 6.6 on 12 CPUs during the runs). The camera does not
reach its configured 30 Hz of sim time in either mode; the cause is not yet known (PENDING).
