# TurtleBot3 motion: real Gazebo vs the site, before and after the dynamic model (Night 1, Part 3)

REAL: `parity/fixtures/tb3_jazzy_v3/physics/<case>/` (this PC, gz-sim 8.10, installed turtlebot3_gazebo 2.3.7 models, 3 runs
each, bit-identical; mean shown). SITE: `parity/compare/site_tb3_motion.mjs` runs the site's own Gazebo model on the same
world files with the TurtleBot3 files the site ships, stepped like the page (50 ms frames) - BEFORE = branch tb3-focus
before the change, AFTER = with `public/js/tb3-motion.js`. Both sides are measured by `parity/compare/tb3_motion_fit.py`
(real at 1 kHz with central differences, the site at its 50 ms frames with the speed over the last frame).
Tolerances (same as `tests/tb3-motion.test.mjs`): times one page frame (0.05 s) or more where noted, distances as listed.
Rows outside the tolerance after the change are **APPROXIMATED** with the measured difference.

| Case | Quantity | REAL | SITE before | SITE after | tolerance | before | after |
|---|---|---|---|---|---|---|---|
| tb3_lin | ground truth 50 % of 0.2 m/s (s after the command) | 0.2520 | 0.1500 | 0.2500 | ±0.05 | DIFFERS (-0.1020) | MATCH |
| tb3_lin | ground truth 90 % (s) | 0.2750 | 0.2000 | 0.3000 | ±0.1 | MATCH | MATCH |
| tb3_lin | odom vx 90 % (s) | 0.2000 | 0.2000 | 0.2000 | ±0.05 | MATCH | MATCH |
| tb3_lin | odom - ground truth after 10 s (m) | 0.0218 | 0.0000 | 0.0218 | ±0.01 | DIFFERS (-0.0218) | MATCH |
| tb3_lin | final ground-truth speed (m/s) | 0.1993 | 0.2000 | 0.2000 | ±0.005 | MATCH | MATCH |
| tb3_ang | ground truth 50 % of 1 rad/s (s) | 0.5990 | 0.0500 | 0.6500 | ±0.1 | DIFFERS (-0.5490) | MATCH |
| tb3_ang | ground truth 90 % (s) | 1.2500 | 0.0500 | 1.3000 | ±0.15 | DIFFERS (-1.2000) | MATCH |
| tb3_ang | odom yaw - ground-truth yaw after 10 s (rad) | 0.6340 | 0.0000 | 0.6469 | ±0.1 | DIFFERS (-0.6340) | MATCH |
| tb3_ang | position drift during the spin (m) | 0.0529 | 0.0000 | 0.0000 | ±0.02 | DIFFERS (-0.0529) | APPROXIMATED (-0.0529) |
| tb3_stop | ground truth travels after the stop command (m) | 0.0179 | 0.0000 | 0.0228 | ±0.01 | DIFFERS (-0.0179) | MATCH |
| tb3_stop | odom travels after the stop command (m) | 0.0002 | 0.0000 | 0.0000 | ±0.01 | MATCH | MATCH |
| tb3_fast | 0.5 m/s command: final speed (no clamp in Gazebo) (m/s) | 0.4995 | 0.5000 | 0.5000 | ±0.01 | MATCH | MATCH |
| tb3_fast | 0.5 m/s: ground truth 90 % (s) | 0.4510 | 0.4500 | 0.6000 | ±0.1 | MATCH | APPROXIMATED (+0.1490) |
| tb3_fast | 0.5 m/s: odom - ground truth (m) | 0.0199 | 0.0000 | 0.0545 | ±0.01 | DIFFERS (-0.0199) | APPROXIMATED (+0.0346) |
| tb3_spin_fast | 4 rad/s command: final yaw rate (rad/s) | 3.9999 | 4.0000 | 3.9311 | ±0.05 | MATCH | APPROXIMATED (-0.0688) |
| tb3_spin_fast | 4 rad/s: ground truth 90 % (s) | 3.8510 | 0.0500 | 4.0500 | ±0.15 | DIFFERS (-3.8010) | APPROXIMATED (+0.1990) |
| tb3_spin_fast | 4 rad/s: odom - ground truth yaw after 5 s (rad) | 8.6264 | 0.0000 | 9.0249 | ±0.1 + 5 % | DIFFERS (-8.6264) | MATCH |
| tb3_wall | wall 1.0 m ahead of the lidar: base_footprint x at rest (m) | 0.9300 [0.9299..0.9300] | 0.9200 | 0.9200 | ±0.02 | MATCH | MATCH |
| tb3_wall | odom x after 10 s (wheels keep turning) (m) | 1.9742 [1.9741..1.9743] | 0.9250 | 1.9850 | ±0.05 + 5 % | DIFFERS (-1.0492) | MATCH |
| tb3_wall | odom vx while pushing the wall (m/s) | 0.2000 | 0.0000 | 0.2000 | ±0.01 | DIFFERS (-0.2000) | MATCH |
| tb3_push | light box (0.1 kg) displacement (m) | 1.1424 | 1.1969 | 1.1751 | ±5 % | MATCH | MATCH |
| tb3_push | box first moves (sim s) | 3.1490 | 3.0500 | 3.1500 | ±0.05 | DIFFERS (-0.0990) | MATCH |
| tb3_push | robot ground-truth distance while pushing (m) | 1.5299 | 1.5850 | 1.5632 | ±2 % | DIFFERS (+0.0551) | APPROXIMATED (+0.0333) |
| tb3wp_lin | Waffle Pi: ground truth 50 % of 0.2 m/s (s) | 0.1010 | 0.1500 | 0.1500 | ±0.05 | MATCH | MATCH |
| tb3wp_lin | Waffle Pi: 90 % (s) | 0.1810 | 0.2000 | 0.2000 | ±0.1 | MATCH | MATCH |
| tb3wp_lin | Waffle Pi: odom - ground truth (m) | 0.0011 | 0.0000 | 0.0009 | ±0.01 | MATCH | MATCH |
| tb3wp_ang | Waffle Pi: 50 % of 1 rad/s (s) | 0.2840 | 0.0500 | 0.3500 | ±0.1 | DIFFERS (-0.2340) | MATCH |
| tb3wp_ang | Waffle Pi: 90 % (s) | 0.5140 | 0.0500 | 0.6000 | ±0.15 | DIFFERS (-0.4640) | MATCH |
| tb3wp_ang | Waffle Pi: odom - ground-truth yaw after 10 s (rad) | 0.3029 | 0.0000 | 0.3025 | ±0.1 | DIFFERS (-0.3029) | MATCH |
| tb3wp_stop | Waffle Pi: ground truth after the stop (m) | 0.0043 | 0.0000 | 0.0066 | ±0.01 | MATCH | MATCH |

Totals: before DIFFERS 17, MATCH 13; after APPROXIMATED 6, MATCH 24.

tb3_push rows use the world's box without its PosePublisher plugin on the site side (`STRIP_POSEPUB=1`), i.e. a plain
rigid box like one a student spawns: the site turns any model with a plugin into a kinematic robot (gz-sdformat.js
addModel; physics_parity.md cause 1, not changed on Night 1), so with the recorder's PosePublisher the box cannot move
on the site at all (page mode: displacement 0.0000 m after, 0.0000 m before).
