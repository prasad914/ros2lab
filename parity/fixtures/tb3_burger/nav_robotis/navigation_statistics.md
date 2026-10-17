# TurtleBot3 Burger Nav2 (nav_robotis) 10-Trial Navigation & AMCL Benchmark

**Date:** 2026-10-17 (from the run files' timestamps)  
**Robot:** `tb3_burger` | **Map:** `turtlebot3_world.yaml` | **Trials:** 10  
Durations are sim seconds (drive_goals.py, node clock with use_sim_time) from goal accepted to result.  

## 1. Executive Summary

- **Total Goals Dispatched:** 50 (10 runs × 5 goals)
- **Goals Succeeded:** 50 of 50
- **Average 5-Goal Circuit Duration:** 77.62s (± 5.14s)
- **Average Final Position Error:** 0.127 m
- **Average Final Yaw Error:** 10.1°

## 2. Benchmark Statistics Table

Benchmark table of (goal, mean_err_m, std_err_m, mean_yaw_err_deg, mean_duration_s) across trials:

| goal | mean_err_m | std_err_m | mean_yaw_err_deg | mean_duration_s | min_duration_s | max_duration_s | succeeded |
|---|---|---|---|---|---|---|---|
| **goal1** | 0.240 | 0.008 | 3.1° | 5.27s | 4.44s | 6.03s | 10 / 10 |
| **goal2** | 0.039 | 0.011 | 13.9° | 22.98s | 18.77s | 28.48s | 10 / 10 |
| **goal3** | 0.250 | 0.012 | 5.9° | 12.15s | 8.98s | 15.03s | 10 / 10 |
| **goal4** | 0.069 | 0.049 | 13.9° | 19.94s | 17.28s | 23.61s | 10 / 10 |
| **goal5** | 0.039 | 0.008 | 13.8° | 17.28s | 14.21s | 22.70s | 10 / 10 |
| **Overall / Circuit** | 0.127 | 0.099 | 10.1° | 77.62s | 68.73s | 83.80s | 50 / 50 |

## 3. AMCL Localization Performance & Covariance Statistics

Spec S4 initial covariance published at start: `cov_x = 0.250 m²`, `cov_y = 0.250 m²`, `cov_yaw = 0.0685 rad²`.

| Goal | Mean Pos Error (m) | Max Pos Error (m) | Settled Cov X (m²) | Settled Cov Y (m²) | Settled Cov Yaw (rad²) |
|---|---|---|---|---|---|
| **goal1** | 0.240 | 0.252 | 0.03923 | 0.07368 | 0.07220 |
| **goal2** | 0.039 | 0.049 | 0.07496 | 0.03054 | 0.06310 |
| **goal3** | 0.250 | 0.279 | 0.02699 | 0.08613 | 0.08770 |
| **goal4** | 0.069 | 0.212 | 0.12107 | 0.03845 | 0.09571 |
| **goal5** | 0.039 | 0.049 | 0.01880 | 0.02070 | 0.04696 |

## 4. Recorded Bag Manifest (MCAP)

| Run Label | Bag Format | Total Size (MB) | Goals Completed | Circuit Time (s) |
|---|---|---|---|---|
| `run1` | MCAP | 38.32 MB | 5 / 5 | 68.73s |
| `run2` | MCAP | 43.73 MB | 5 / 5 | 83.46s |
| `run3` | MCAP | 44.22 MB | 5 / 5 | 81.61s |
| `run4` | MCAP | 43.34 MB | 5 / 5 | 77.39s |
| `run5` | MCAP | 44.25 MB | 5 / 5 | 82.29s |
| `run6` | MCAP | 42.76 MB | 5 / 5 | 76.93s |
| `run7` | MCAP | 43.94 MB | 5 / 5 | 83.80s |
| `run8` | MCAP | 39.04 MB | 5 / 5 | 69.86s |
| `run9` | MCAP | 42.41 MB | 5 / 5 | 78.29s |
| `run10` | MCAP | 39.16 MB | 5 / 5 | 73.89s |

