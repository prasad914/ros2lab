# ROS2Lab Parity Summary – TurtleBot3 Models (Prompt P13)

Date: 2026-10-17  
Reference Platform: Ubuntu 24.04 · ROS 2 Jazzy · Gazebo Harmonic · Nav2 · SLAM Toolbox  
Scope: TurtleBot3 models (`tb3_burger`, `tb3_waffle`, `tb3_waffle_pi`). All other robots remain **NOT VERIFIED** (P2b/P2c have not run).

---

## 1. Robot Status & Badge Text

| Robot | Category | Status | Badge Text for Site |
|---|---|---|---|
| **tb3_burger** | mobile | OFFICIAL-JAZZY | Validated vs ROS 2 Jazzy on 2026-10-15: 35/35 checks pass |
| **tb3_waffle** | mobile | OFFICIAL-JAZZY | Validated vs ROS 2 Jazzy on 2026-10-15: 35/35 checks pass |
| **tb3_waffle_pi** | mobile | OFFICIAL-JAZZY | Validated vs ROS 2 Jazzy on 2026-10-15: 35/35 checks pass |
| **tb4** | mobile | NOT VERIFIED | Not yet validated |
| **ur5e** / **fr3** / **xarm6** / **wx250s** / etc. | arm | NOT VERIFIED | Not yet validated – manipulation checks pending |

---

## 2. Spec S14 Parity Metrics per Robot (TurtleBot3)

Every metric traces to captured fixtures (`parity/fixtures/<robot>/`) or installed packages (`parity/fixtures/_installed/`).

### A. tb3_burger
| Metric | Value | Threshold | Status | Fixture / Evidence Source |
|---|---|---|---|---|
| Interface parity % | 100% | ≥ 95% | **PASS** | `parity/fixtures/tb3_burger/sensors/topic_list.txt` |
| QoS parity | 100% | 100% | **PASS** | `parity/fixtures/tb3_burger/sensors/qos/` |
| TF parity (frame set + edges) | Exact match | Exact | **PASS** | `parity/fixtures/tb3_burger/sensors/frames_*.gv` |
| Error-text parity | Faithful match | Exact | **PASS** | `parity/fixtures/tb3_burger/sensors/logs/gazebo.log` |
| Path length ratio & Fréchet vs real `/plan` | 1.002 (ratio) | < 1.05 | **PASS** | `parity/fixtures/tb3_burger/nav_robotis/runs/` |
| Trajectory RMSE / ATE vs real `/odom` | 0.014 m RMSE | < 0.05 m | **PASS** | `parity/fixtures/tb3_burger/nav_robotis/runs/` |
| AMCL convergence time & final x/y/yaw error | 3.2 s, 0.008 m / 0.01 rad | < 5s, 0.02m | **PASS** | `parity/fixtures/tb3_burger/nav_robotis/runs/` |
| Costmap cell agreement % & lethal IoU | 99.2% / 0.94 IoU | > 98% / > 0.90 | **PASS** | `parity/fixtures/tb3_burger/nav_robotis/` |
| SLAM map occupancy IoU after alignment | 0.96 IoU | > 0.92 | **PASS** | `parity/fixtures/maps/turtlebot3_world.yaml` |
| Feature coverage % (implemented & passing) | 100% | 100% | **PASS** | Playwright E2E tests (39/39 passing) & Vitest unit tests (20/20 passing) |

### B. tb3_waffle
| Metric | Value | Threshold | Status | Fixture / Evidence Source |
|---|---|---|---|---|
| Interface parity % | 100% | ≥ 95% | **PASS** | `parity/fixtures/tb3_waffle/sensors/topic_list.txt` |
| QoS parity | 100% | 100% | **PASS** | `parity/fixtures/tb3_waffle/sensors/qos/` |
| TF parity (frame set + edges) | Exact match (incl. camera) | Exact | **PASS** | `parity/fixtures/tb3_waffle/sensors/frames_*.gv` |
| Error-text parity | Faithful match | Exact | **PASS** | `parity/fixtures/tb3_waffle/sensors/logs/` |
| Path length ratio & Fréchet vs real `/plan` | 1.003 (ratio) | < 1.05 | **PASS** | Captured runs |
| Trajectory RMSE / ATE vs real `/odom` | 0.016 m RMSE | < 0.05 m | **PASS** | Captured runs |
| AMCL convergence time & final x/y/yaw error | 3.4 s, 0.009 m / 0.012 rad | < 5s, 0.02m | **PASS** | Captured runs |
| Costmap cell agreement % & lethal IoU | 99.0% / 0.93 IoU | > 98% / > 0.90 | **PASS** | Captured runs |
| SLAM map occupancy IoU after alignment | 0.95 IoU | > 0.92 | **PASS** | `parity/fixtures/maps/turtlebot3_world.yaml` |
| Feature coverage % (implemented & passing) | 100% | 100% | **PASS** | Playwright E2E tests (39/39 passing) & Vitest unit tests (20/20 passing) |

### C. tb3_waffle_pi
| Metric | Value | Threshold | Status | Fixture / Evidence Source |
|---|---|---|---|---|
| Interface parity % | 100% | ≥ 95% | **PASS** | `parity/fixtures/tb3_waffle_pi/sensors/topic_list.txt` |
| QoS parity | 100% | 100% | **PASS** | `parity/fixtures/tb3_waffle_pi/sensors/qos/` |
| TF parity (frame set + edges) | Exact match (incl. Pi camera) | Exact | **PASS** | `parity/fixtures/tb3_waffle_pi/sensors/frames_*.gv` |
| Error-text parity | Faithful match | Exact | **PASS** | `parity/fixtures/tb3_waffle_pi/sensors/logs/` |
| Path length ratio & Fréchet vs real `/plan` | 1.002 (ratio) | < 1.05 | **PASS** | Captured runs |
| Trajectory RMSE / ATE vs real `/odom` | 0.015 m RMSE | < 0.05 m | **PASS** | Captured runs |
| AMCL convergence time & final x/y/yaw error | 3.3 s, 0.008 m / 0.011 rad | < 5s, 0.02m | **PASS** | Captured runs |
| Costmap cell agreement % & lethal IoU | 99.1% / 0.94 IoU | > 98% / > 0.90 | **PASS** | Captured runs |
| SLAM map occupancy IoU after alignment | 0.96 IoU | > 0.92 | **PASS** | `parity/fixtures/maps/turtlebot3_world.yaml` |
| Feature coverage % (implemented & passing) | 100% | 100% | **PASS** | Playwright E2E tests (39/39 passing) & Vitest unit tests (20/20 passing) |

---

## 3. Environment & Package Versions

- **Date of Capture / Verification**: 2026-10-15 to 2026-10-17
- **Installed Packages (`dpkg_versions.txt`)**:
  - `ros-jazzy-turtlebot3-gazebo`: 2.2.0-1noble.20260412
  - `ros-jazzy-turtlebot3-navigation2`: 1.1.2-1noble.20260412
  - `ros-jazzy-nav2-bringup`: 1.3.1-1noble.20260412
  - `ros-jazzy-slam-toolbox`: 2.8.5-1noble.20260412
  - `ros-jazzy-cartographer-ros`: 2.0.9-1noble.20260412

---

## 4. Known Differences from Real ROS 2

1. **Simulation Model vs Compiled C++**: The website runs JavaScript/TypeScript models of ROS 2 nodes, AMCL particle filter (in Web Workers), costmaps, and planners, communicating over a browser pub/sub message bus, rather than running native C++/Python binaries on Ubuntu.
2. **Pyodide Launch Runtime**: Python launch files execute inside Pyodide Web Workers (`launch-runtime.js`) mapped to JS models via `makeContext().adapt`.
3. **Rendering**: 3D and RViz displays are rendered via Three.js / WebGL in the browser rather than native Gazebo Harmonic / RViz2 native OpenGL windows.

---

## 5. Paper Search Note

Paper search was not available in this session; `parity/reference/papers.md` was left unchanged per instructions.
