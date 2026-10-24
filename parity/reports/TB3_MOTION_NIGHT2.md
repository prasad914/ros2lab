# TurtleBot3 motion: real Gazebo Night 1 vs Night 2 vs the site (Night 2, Part 1)

REAL N1: the REAL column of `parity/reports/TB3_MOTION_NIGHT1.md` (Night 1 captures, gz-sim 8.10, Cyclone DDS). REAL N2:
`parity/fixtures/tb3_jazzy_v3/physics/<case>/` re-captured on Night 2 after the owner's apt upgrade (gz-sim 8.15.0, gz-physics
vendor 0.0.9, Fast DDS; `bash parity/scripts/tb3_v3/run_physics.sh`, 3 runs each, mean shown). SITE: `parity/compare/site_tb3_motion.mjs`
on the site as committed (the TurtleBot3 motion model `public/js/tb3-motion.js` is unchanged since Night 1). All three are
measured by `parity/compare/tb3_motion_fit.py`. Tolerances as in `tests/tb3-motion.test.mjs`. The verdict compares SITE
with REAL N2; rows outside the tolerance are **APPROXIMATED** with the difference. "N1 -> N2" applies the same tolerance to
the two real captures.

| Case | Quantity | REAL N1 | REAL N2 | N1 -> N2 | SITE | tolerance | SITE vs REAL N2 |
|---|---|---|---|---|---|---|---|
| tb3_lin | ground truth 50 % of 0.2 m/s (s after the command) | 0.2520 | 0.2520 | same | 0.2500 | ±0.05 | MATCH |
| tb3_lin | ground truth 90 % (s) | 0.2750 | 0.2750 | same | 0.3000 | ±0.1 | MATCH |
| tb3_lin | odom vx 90 % (s) | 0.2000 | 0.2000 | same | 0.2000 | ±0.05 | MATCH |
| tb3_lin | odom - ground truth after 10 s (m) | 0.0218 | 0.0218 | same | 0.0218 | ±0.01 | MATCH |
| tb3_lin | final ground-truth speed (m/s) | 0.1993 | 0.1993 | same | 0.2000 | ±0.005 | MATCH |
| tb3_ang | ground truth 50 % of 1 rad/s (s) | 0.5990 | 0.5993 [0.5990..0.6000] | same | 0.6500 | ±0.1 | MATCH |
| tb3_ang | ground truth 90 % (s) | 1.2500 | 1.2503 [1.2500..1.2510] | same | 1.3000 | ±0.15 | MATCH |
| tb3_ang | odom yaw - ground-truth yaw after 10 s (rad) | 0.6340 | 0.6341 [0.6340..0.6345] | same | 0.6469 | ±0.1 | MATCH |
| tb3_ang | position drift during the spin (m) | 0.0529 | 0.0529 [0.0529..0.0529] | same | 0.0000 | ±0.02 | APPROXIMATED (-0.0529) |
| tb3_stop | ground truth travels after the stop command (m) | 0.0179 | 0.0102 [0.0043..0.0179] | same | 0.0228 | ±0.01 | APPROXIMATED (+0.0127) |
| tb3_stop | odom travels after the stop command (m) | 0.0002 | 0.0003 [0.0002..0.0004] | same | 0.0000 | ±0.01 | MATCH |
| tb3_fast | 0.5 m/s command: final speed (no clamp in Gazebo) (m/s) | 0.4995 | 0.4995 [0.4995..0.4995] | same | 0.5000 | ±0.01 | MATCH |
| tb3_fast | 0.5 m/s: ground truth 90 % (s) | 0.4510 | 0.4537 [0.4510..0.4560] | same | 0.6000 | ±0.1 | APPROXIMATED (+0.1463) |
| tb3_fast | 0.5 m/s: odom - ground truth (m) | 0.0199 | 0.0263 [0.0199..0.0295] | same | 0.0545 | ±0.01 | APPROXIMATED (+0.0282) |
| tb3_spin_fast | 4 rad/s command: final yaw rate (rad/s) | 3.9999 | 3.9999 | same | 3.9311 | ±0.05 | APPROXIMATED (-0.0688) |
| tb3_spin_fast | 4 rad/s: ground truth 90 % (s) | 3.8510 | 3.8510 | same | 4.0500 | ±0.15 | APPROXIMATED (+0.1990) |
| tb3_spin_fast | 4 rad/s: odom - ground truth yaw after 5 s (rad) | 8.6264 | 8.6531 [8.6264..8.7064] | same | 9.0249 | ±0.1 + 5 % | MATCH |
| tb3_wall | wall 1.0 m ahead of the lidar: base_footprint x at rest (m) | 0.9300 | 0.9300 [0.9300..0.9300] | same | 0.9200 | ±0.02 | MATCH |
| tb3_wall | odom x after 10 s (wheels keep turning) (m) | 1.9742 | 1.9742 [1.9741..1.9743] | same | 1.9850 | ±0.05 + 5 % | MATCH |
| tb3_wall | odom vx while pushing the wall (m/s) | 0.2000 | 0.2000 | same | 0.2000 | ±0.01 | MATCH |
| tb3_push | light box (0.1 kg) displacement (m) | 1.1424 | 1.1413 [1.1391..1.1425] | same | 1.1751 | ±5 % | MATCH |
| tb3_push | box first moves (sim s) | 3.1490 | 3.1550 [3.1510..3.1630] | same | 3.1500 | ±0.05 | MATCH |
| tb3_push | robot ground-truth distance while pushing (m) | 1.5299 | 1.5288 [1.5266..1.5301] | same | 1.5632 | ±2 % | APPROXIMATED (+0.0344) |
| tb3wp_lin | Waffle Pi: ground truth 50 % of 0.2 m/s (s) | 0.1010 | 0.1013 [0.1010..0.1020] | same | 0.1500 | ±0.05 | MATCH |
| tb3wp_lin | Waffle Pi: 90 % (s) | 0.1810 | 0.1813 [0.1810..0.1820] | same | 0.2000 | ±0.1 | MATCH |
| tb3wp_lin | Waffle Pi: odom - ground truth (m) | 0.0011 | 0.0017 [0.0011..0.0029] | same | 0.0009 | ±0.01 | MATCH |
| tb3wp_ang | Waffle Pi: 50 % of 1 rad/s (s) | 0.2840 | 0.2843 [0.2840..0.2850] | same | 0.3500 | ±0.1 | MATCH |
| tb3wp_ang | Waffle Pi: 90 % (s) | 0.5140 | 0.5143 [0.5140..0.5150] | same | 0.6000 | ±0.15 | MATCH |
| tb3wp_ang | Waffle Pi: odom - ground-truth yaw after 10 s (rad) | 0.3029 | 0.3030 [0.3029..0.3031] | same | 0.3025 | ±0.1 | MATCH |
| tb3wp_stop | Waffle Pi: ground truth after the stop (m) | 0.0043 | 0.0048 [0.0043..0.0053] | same | 0.0066 | ±0.01 | MATCH |

Totals (SITE vs REAL N2): APPROXIMATED 7, MATCH 23. Real rows that moved between Night 1 and Night 2: 0 of 30.

tb3_push rows use the world's box without its PosePublisher plugin on the site side (`STRIP_POSEPUB=1`), as on Night 1.
