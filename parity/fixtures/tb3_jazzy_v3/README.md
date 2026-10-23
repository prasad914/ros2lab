# tb3_jazzy_v3: TurtleBot3 Jazzy ground truth, Night 1 (2026-10-23)

Captured on this PC (`hostname` prasad, Ubuntu 24.04.5, kernel 7.0.0-38-generic). Every file here was produced by a
command run on this PC; each capture has a `*.runner.txt` (or `runner.txt` in its folder) with the exact command.
Big raw files (bags, long logs) go under `ground-truth/tb3/` (gitignored), not here.

## Versions (Part 0.2)

Verbatim list: `versions.txt` (runner: `versions.runner.txt`, script `parity/scripts/tb3_v3/capture_versions.sh`).

| What | This PC |
|---|---|
| `gz sim --versions` | **8.10.0** (`ros-jazzy-gz-sim-vendor 0.0.9`, gz-sim8 8.10.0) |
| turtlebot3, turtlebot3_gazebo, turtlebot3_navigation2 | 2.3.6 / 2.3.7 / 2.3.6 (apt) |
| navigation2 (meta), nav2_bringup, nav2_route, opennav_docking | 1.3.13 |
| every other nav2_* package (amcl, bt_navigator, controller, costmap_2d, planner, msgs, …) | **1.3.10** |
| slam_toolbox | 2.8.5 |
| cartographer / cartographer_ros | 2.0.9004 / 2.0.9003 |
| ros_gz_bridge / ros_gz_sim / ros_gz_image | **1.0.18 / 1.0.16 / 1.0.16** (ros-gz meta 1.0.24) |
| `ros-jazzy-nav2-docking` | not a package (`dpkg-query: no packages found`); docking ships as `opennav_docking` 1.3.13 |

Every TurtleBot3 / Nav2 / SLAM package is installed from apt, so nothing was built in `~/tb3_ws` (it does not exist)
and nothing is BLOCKED. `ROBOTS_WS=~/robots_ws` is exported by `~/.bashrc` but the folder does not exist, so
`parity/scripts/env.sh` adds no overlay. `TURTLEBOT3_MODEL=burger` is exported by `~/.bashrc`; every capture sets it
explicitly.

### This PC is not the machine that made the existing fixtures

`version_diff_vs_old_fixtures.txt` joins `parity/fixtures/_installed/dpkg_versions.txt` (written when the existing
fixtures were captured, gz-sim **8.15.0**, `_installed/gz_version.txt`) with this PC's `dpkg -l 'ros-jazzy-*'`:
605 packages differ. The ones that matter for TurtleBot3 parity:

| Package | Existing fixtures | This PC |
|---|---|---|
| gz-sim (vendor) | 8.15.0 (0.0.13) | 8.10.0 (0.0.9) |
| gz-physics (vendor) | 0.0.9 | 0.0.7 |
| nav2_* (amcl, bt_navigator, controller, costmap_2d, behaviors, msgs, lifecycle_manager, …) | 1.3.13 | 1.3.10 |
| ros_gz_bridge / ros_gz_sim / ros_gz_image | 1.0.24 | 1.0.18 / 1.0.16 / 1.0.16 |
| rclcpp / rcl | 28.1.22 / 9.2.11 | 28.1.13 / 9.2.8 |
| ros2cli (ros2topic, ros2node, ros2lifecycle, …) | 0.32.13 | 0.32.6 |
| launch / ros2launch | 3.4.12 / 0.26.13 | 3.4.9 / 0.26.10 |
| ros2controlcli | 4.48.1 | 4.39.2 |

Upgrading needs `sudo apt` (not allowed). So: the new captures in this folder are true for **this PC's** versions.
Where a new capture disagrees with an existing fixture, the triage (`parity/reports/TB3_GRAPH_TRIAGE.md`) says so and
names the version difference as a possible cause instead of picking a side. The commands to bring this PC to the
same versions are in `parity/scripts/robots_sudo.sh` territory (instructor: `sudo apt update && sudo apt upgrade`).

## Ground-truth data on this PC (Part 0.3)

Tracked in git and present here: `parity/fixtures/{tb3_burger,tb3_waffle,tb3_waffle_pi}/` (install_check, sensors,
cartographer, slam, nav_robotis; burger also nav2_bringup), `maps/`, `goals.yaml`, `physics/` (27 cases incl.
`tb3_lin`, `tb3_lin_noacc`, `tb3_ang`, `tb3_ang_noacc`, `tb3_push`, `tb3_ros_side`, `tb3_sensors_{empty,wall}`, with
their CSVs), `rviz/`, `cli/`, `lessons/`, `_installed/`.

Missing on this PC (gitignored on the capture machine and not copied):

| Missing | Why it matters | Needed by Night 1? |
|---|---|---|
| `ground-truth/` (first-generation capture kit) | legacy | no |
| all 76 rosbags of `parity/fixtures/bag_manifest.md` (`**/bags/`, 1780 MiB): nav2_bringup matrix (30), nav_robotis run1-10, slam run1 | time series of the Nav2 runs | no: Part 2 re-captures the graph; Part 3 uses `physics/` CSVs. Re-capture only if a later step needs raw data |
| every `*.log` (gitignored): e.g. `tb3_burger/nav_robotis/logs/nav2.log` (cited by SIM_INVENTORY #4 and OVERNIGHT_2026-10-19), `tb3_burger/nav2_bringup/logs/nav2demo.log`, `tb3_burger/sensors/logs/gazebo.log`, `tb3_burger/nav_robotis/errors/bad_map_path/nav2_runner.log`, `tb3_burger/sensors/view_frames.log` | full launch logs | Part 2 keeps its own logs under `ground-truth/tb3/` and copies the needed excerpts here |
| `parity/browser_out/` (gitignored): the site-side physics runner `browser_out/physics/site_cases.mjs` used by `physics_parity.md` | the "24-case" site comparison | yes (Part 3.3): rewritten as a tracked script under `parity/compare/` |

What Part 2 / Part 3 re-capture is listed in `docs/tb3/PROGRESS.md` with the exact commands.
