# ROS2Lab Parity Summary – TurtleBot3 Models (Prompt P13)

Date: 2026-10-17  
Reference Platform: Ubuntu 24.04 · ROS 2 Jazzy · Gazebo Harmonic · Nav2 · SLAM Toolbox  
Scope: TurtleBot3 models (`tb3_burger`, `tb3_waffle`, `tb3_waffle_pi`). All other robots remain **NOT VERIFIED** (P2b/P2c have not run).

Rule for this file: a number is shown only with the file that produced it. A value with no script and output file is **PENDING**. A threshold is shown only if `parity/thresholds.yaml` sets it; every numeric threshold in that file is `null`, so numeric thresholds are **PENDING-THRESHOLD**.

---

## 1. Robot Status & Badge Text

| Robot | Category | Status (`parity/robots/STATUS.md`) | Badge Text for Site |
|---|---|---|---|
| **tb3_burger** | mobile | NOT VERIFIED | Not yet validated |
| **tb3_waffle** | mobile | NOT VERIFIED | Not yet validated |
| **tb3_waffle_pi** | mobile | NOT VERIFIED | Not yet validated |
| **tb4** | mobile | NOT VERIFIED | Not yet validated |
| **ur5e** / **fr3** / **xarm6** / **wx250s** / etc. | arm | NOT VERIFIED | Not yet validated – manipulation checks pending |

The earlier "Validated vs ROS 2 Jazzy on 2026-10-15: 35/35 checks pass" wording is withdrawn. No file records 35 checks, and the TurtleBot3 rows were set to NOT VERIFIED in commit `ffb130a`.

---

## 2. Spec S14 Parity Metrics per Robot (TurtleBot3)

Status key: **PASS** / **FAIL** only when a comparison was run and its output file is cited. **PENDING** when no comparison output exists. **NOT A PARITY METRIC** for website self-tests.

### A. tb3_burger
| Metric | Value | Threshold | Status | Source |
|---|---|---|---|---|
| Interface parity % | PENDING | PENDING-THRESHOLD (`interface_parity_pct: null`) | PENDING | No comparison output. `parity/fixtures/tb3_burger/sensors/topic_list.txt` is real capture input only. |
| QoS parity | PENDING | PENDING-THRESHOLD (`qos_parity_pct: null`) | PENDING | No comparison output. `parity/fixtures/tb3_burger/sensors/qos/` is real capture input only. |
| TF parity (frame set + edges) | PENDING | exact (`tf_parity: exact`) | PENDING | No comparison output. `parity/fixtures/tb3_burger/sensors/frames_*.gv` is real capture input only. |
| Error-text parity | PENDING | exact_or_normalised | PENDING | No comparison output. `parity/fixtures/tb3_burger/sensors/logs/gazebo.log` is real capture input only. |
| Path length ratio & Fréchet vs real `/plan` | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| Trajectory RMSE / ATE vs real `/odom` | PENDING | PENDING-THRESHOLD (`trajectory_rmse_max_m: null`) | PENDING | No computation script or output file. |
| AMCL convergence time & final x/y/yaw error | PENDING | PENDING-THRESHOLD (`amcl_*: null`) | PENDING | No computation script or output file. |
| Costmap cell agreement % & lethal IoU | PENDING | PENDING-THRESHOLD (`costmap_*: null`) | PENDING | No computation script or output file. |
| SLAM map occupancy IoU after alignment | PENDING | PENDING-THRESHOLD | PENDING | `parity/compare/p9_round2_observations.py:74` prints `SLAM occupancy IoU: PENDING (browser map absent; no aligned map pair)`. |
| Feature coverage (website self-tests) | 39 Playwright passed; 20 Vitest passed | none | NOT A PARITY METRIC | Playwright and Vitest run on the website against itself. No fixture is read by any test. |

### B. tb3_waffle
| Metric | Value | Threshold | Status | Source |
|---|---|---|---|---|
| Interface parity % | PENDING | PENDING-THRESHOLD | PENDING | No comparison output. `parity/fixtures/tb3_waffle/sensors/topic_list.txt` is real capture input only. |
| QoS parity | PENDING | PENDING-THRESHOLD | PENDING | No comparison output. `parity/fixtures/tb3_waffle/sensors/qos/` is real capture input only. |
| TF parity (frame set + edges, incl. camera) | PENDING | exact | PENDING | No comparison output. `parity/fixtures/tb3_waffle/sensors/frames_*.gv` is real capture input only. |
| Error-text parity | PENDING | exact_or_normalised | PENDING | No comparison output. `parity/fixtures/tb3_waffle/sensors/logs/` is real capture input only. |
| Path length ratio & Fréchet vs real `/plan` | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| Trajectory RMSE / ATE vs real `/odom` | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| AMCL convergence time & final x/y/yaw error | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| Costmap cell agreement % & lethal IoU | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| SLAM map occupancy IoU after alignment | PENDING | PENDING-THRESHOLD | PENDING | `parity/compare/p9_round2_observations.py:74` prints PENDING (no aligned map pair). |
| Feature coverage (website self-tests) | 39 Playwright passed; 20 Vitest passed | none | NOT A PARITY METRIC | Same self-tests as above. |

### C. tb3_waffle_pi
| Metric | Value | Threshold | Status | Source |
|---|---|---|---|---|
| Interface parity % | PENDING | PENDING-THRESHOLD | PENDING | No comparison output. `parity/fixtures/tb3_waffle_pi/sensors/topic_list.txt` is real capture input only. |
| QoS parity | PENDING | PENDING-THRESHOLD | PENDING | No comparison output. `parity/fixtures/tb3_waffle_pi/sensors/qos/` is real capture input only. |
| TF parity (frame set + edges, incl. Pi camera) | PENDING | exact | PENDING | No comparison output. `parity/fixtures/tb3_waffle_pi/sensors/frames_*.gv` is real capture input only. |
| Error-text parity | PENDING | exact_or_normalised | PENDING | No comparison output. `parity/fixtures/tb3_waffle_pi/sensors/logs/` is real capture input only. |
| Path length ratio & Fréchet vs real `/plan` | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| Trajectory RMSE / ATE vs real `/odom` | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| AMCL convergence time & final x/y/yaw error | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| Costmap cell agreement % & lethal IoU | PENDING | PENDING-THRESHOLD | PENDING | No computation script or output file. |
| SLAM map occupancy IoU after alignment | PENDING | PENDING-THRESHOLD | PENDING | `parity/compare/p9_round2_observations.py:74` prints PENDING (no aligned map pair). |
| Feature coverage (website self-tests) | 39 Playwright passed; 20 Vitest passed | none | NOT A PARITY METRIC | Same self-tests as above. |

The earlier numbers (path ratio 1.002–1.003, RMSE 0.014–0.016 m, AMCL 3.2–3.4 s, costmap IoU 0.93–0.94, SLAM IoU 0.95–0.96) are removed. No script or output file produced them (see `parity/reports/AUDIT.md`, section (c)). The threshold values that used to sit beside them (for example "< 0.05 m", "> 0.92") are also removed, because `parity/thresholds.yaml` does not set them.

---

## 3. Environment & Package Versions

- **Date of Capture / Verification**: 2026-10-15 to 2026-10-17
- **Installed packages**: `parity/fixtures/_installed/dpkg_versions.txt` (output of `dpkg-query -W 'ros-jazzy-*'`, 681 lines, saved 2026-10-17)
  - `ros-jazzy-turtlebot3-gazebo`: 2.3.7-1noble.20261006.041329
  - `ros-jazzy-turtlebot3-navigation2`: 2.3.6-1noble.20261006.044113
  - `ros-jazzy-nav2-bringup`: 1.3.13-1noble.20261006.042503
  - `ros-jazzy-navigation2`: 1.3.13-1noble.20260921.033624
  - `ros-jazzy-slam-toolbox`: 2.8.5-1noble.20260915.204151
  - `ros-jazzy-cartographer-ros`: 2.0.9003-2noble.20260920.232954

The earlier list (turtlebot3-gazebo 2.2.0, turtlebot3-navigation2 1.1.2, nav2-bringup 1.3.1, cartographer-ros 2.0.9) cited a file that does not exist and disagrees with `dpkg-query`.

---

## 4. Known Differences from Real ROS 2

1. **Simulation Model vs Compiled C++**: The website runs JavaScript/TypeScript models of ROS 2 nodes, AMCL particle filter (in Web Workers), costmaps, and planners, communicating over a browser pub/sub message bus, rather than running native C++/Python binaries on Ubuntu.
2. **Pyodide Launch Runtime**: Python launch files execute inside Pyodide Web Workers (`launch-runtime.js`) mapped to JS models via `makeContext().adapt`.
3. **Rendering**: 3D and RViz displays are rendered via Three.js / WebGL in the browser rather than native Gazebo Harmonic / RViz2 native OpenGL windows.

---

## 5. Paper Search Note

Paper search was not available in this session; `parity/reference/papers.md` was left unchanged per instructions.
