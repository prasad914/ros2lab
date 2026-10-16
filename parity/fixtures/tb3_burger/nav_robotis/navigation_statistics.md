# TurtleBot3 Burger Nav2 (nav_robotis) 10-Trial Navigation & AMCL Benchmark

**Date:** 2026-10-16  
**Robot:** `tb3_burger` | **Map:** `turtlebot3_world.yaml` | **Trials:** 2  
**Controller:** DWB Local Planner (`FollowPath`) | **Planner:** NavFn (`GridBased`)  

## 1. Executive Summary

- **Total Goals Dispatched:** 10 (2 runs × 5 goals)
- **Overall Navigation Success Rate:** 100.0%
- **Average 5-Goal Circuit Duration:** 307.00s (± 3.93s)
- **Average Final Position Error:** 0.248 m
- **Average Final Yaw Error:** 17.4°

## 2. Benchmark Statistics Table

Benchmark table of (goal, mean_err_m, std_err_m, mean_yaw_err_deg, mean_duration_s) across trials:

| goal | mean_err_m | std_err_m | mean_yaw_err_deg | mean_duration_s | success_rate |
|---|---|---|---|---|---|
| **goal1** | 0.377 | 0.004 | 10.2° | 21.20s | 100.0% |
| **goal2** | 0.174 | 0.042 | 21.5° | 88.56s | 100.0% |
| **goal3** | 0.405 | 0.100 | 9.3° | 53.91s | 100.0% |
| **goal4** | 0.240 | 0.079 | 20.6° | 87.62s | 100.0% |
| **goal5** | 0.042 | 0.000 | 25.6° | 55.71s | 100.0% |
| **Overall / Circuit** | 0.248 | 0.147 | 17.4° | 307.00s | 100.0% |

## 3. AMCL Localization Performance & Covariance Statistics

Spec S4 initial covariance published at start: `cov_x = 0.250 m²`, `cov_y = 0.250 m²`, `cov_yaw = 0.0685 rad²`.

| Goal | Mean Pos Error (m) | Max Pos Error (m) | Settled Cov X (m²) | Settled Cov Y (m²) | Settled Cov Yaw (rad²) |
|---|---|---|---|---|---|
| **goal1** | 0.377 | 0.381 | 0.01558 | 0.05561 | 0.05804 |
| **goal2** | 0.174 | 0.216 | 0.08588 | 0.03105 | 0.06687 |
| **goal3** | 0.405 | 0.506 | 0.02844 | 0.08516 | 0.08619 |
| **goal4** | 0.240 | 0.319 | 0.10037 | 0.04047 | 0.09613 |
| **goal5** | 0.042 | 0.042 | 0.01635 | 0.01839 | 0.04046 |

## 4. Recorded Bag Manifest (MCAP)

| Run Label | Bag Format | Total Size (MB) | Goals Completed | Circuit Time (s) |
|---|---|---|---|---|
| `run1` | MCAP | 141.05 MB | 5 / 5 | 303.07s |
| `run2` | MCAP | 143.93 MB | 5 / 5 | 310.93s |

