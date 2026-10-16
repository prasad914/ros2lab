# P9-round2 parity observations

Date: 2026-10-16  
Scope: `tb3_burger`, `tb3_waffle`, `tb3_waffle_pi` only. Other robots are skipped because P2b/P2c have not run and remain NOT VERIFIED (`parity/robots/STATUS.md`).

Comparisons use real ROS 2 Jazzy fixtures under `parity/fixtures/<robot>/<scenario>/` and matching browser captures under `parity/browser_out/<robot>/p9-round2/<scenario>/`. The comparator is `parity/compare/p9_round2_observations.py`. The reported topic and TF results are raw comparisons, not tolerance-based checks; thresholds are not inferred. No application or fixture changes were made.

## Scenario results

| Robot / scenario | Result | Evidence and observation |
|---|---|---|
| `tb3_burger/sensors` | FAIL (observed interface parity) | 6/26 real topic name/type pairs match exactly; 20 fixture topics are absent in the browser graph. TF edge set matches 7/7. Real fixture: `parity/fixtures/tb3_burger/sensors/topic_list.txt`, `frames_2026-10-15_20.59.05.gv`; browser: `parity/browser_out/tb3_burger/p9-round2/sensors/snapshot.json`. Launch blocker shown in browser: `Package 'turtlebot3_gazebo' not found: "package 'turtlebot3_gazebo' not found, searching: ['/opt/ros/jazzy']"` (`browser-errors.json`). The world did not launch, so this is not a completed simulation comparison. |
| `tb3_burger/slam` | FAIL (observed interface parity); map metric PENDING | 4/20 topic pairs match exactly; real `map → odom` edge absent in browser. Browser map capture unavailable, so occupancy comparison is PENDING. Evidence: `parity/fixtures/tb3_burger/slam/topic_list.txt`, `frames_2026-10-15_21.37.49.gv`, `parity/browser_out/tb3_burger/p9-round2/slam/snapshot.json`. Same Gazebo package blocker was observed. |
| `tb3_burger/cartographer` | FAIL (observed interface parity); map metric PENDING | 6/21 topic pairs match exactly; real `map → odom` edge absent in browser. Browser map capture unavailable, so occupancy comparison is PENDING. Evidence: `parity/fixtures/tb3_burger/cartographer/topic_list.txt`, `frames_2026-10-15_21.48.01.gv`, `parity/browser_out/tb3_burger/p9-round2/cartographer/snapshot.json`. Same Gazebo package blocker was observed. |
| `tb3_burger/nav_robotis` | FAIL (observed interface parity); navigation metrics PENDING | 7/105 topic pairs match exactly; real `map → odom` edge absent in browser. Plan, trajectory, costmap and AMCL metric comparisons are PENDING because the browser capture has no comparable data. Evidence: `parity/fixtures/tb3_burger/nav_robotis/topic_list.txt`, `frames_2026-10-15_23.00.37.gv`, `parity/browser_out/tb3_burger/p9-round2/nav_robotis/snapshot.json`. Same Gazebo package blocker was observed. |
| `tb3_waffle/sensors` | FAIL (observed interface parity) | 4/17 topic pairs match exactly; 13 fixture topics (including camera, IMU, lidar and odometry topics) are absent in the browser graph. Two real TF edges, `base_link → caster_back_left_link` and `base_link → caster_back_right_link`, are absent. Evidence: `parity/fixtures/tb3_waffle/sensors/topic_list.txt`, `frames_2026-10-15_21.09.50.gv`, `parity/browser_out/tb3_waffle/p9-round2/sensors/emulator-state.json`. Browser terminal showed `TURTLEBOT3_MODEL=waffle: command not found` (`notes.md`); the observation timed out before controls and bus-message checks completed. |
| `tb3_waffle_pi/sensors` | FAIL (observed interface parity) | 4/17 topic pairs match exactly; 13 fixture topics are absent. The same two caster TF edges are missing. Evidence: `parity/fixtures/tb3_waffle_pi/sensors/topic_list.txt`, `frames_2026-10-15_21.19.37.gv`, `parity/browser_out/tb3_waffle_pi/p9-round2/sensors/emulator-state.json`. Browser reports `There is no robot "tb3_waffle_pi" in the catalog. Go back to the Robotic Models Simulator and pick one.` and `TURTLEBOT3_MODEL=waffle_pi: command not found` (`notes.md`); no simulation launch completed. |

The Burger browser observations also lacked runtime simulation: its world launch was blocked by the missing package. RViz opened in captures, but RViz control effects and same-instant 3D/RViz pose comparisons were not exercised (`parity/browser_out/tb3_burger/p9-round2/*/notes.md`).

## PENDING / UNVERIFIED

- QoS, actions/services, parameter parity, sensor message dimensions/encoding/CameraInfo K/PointCloud2 fields and faithful error-text comparison remain PENDING: the browser captures do not establish comparable values, and the corresponding real scenario error folders do not contain captured error evidence.
- Burger SLAM occupancy, navigation path/trajectory/costmap/localisation metrics, RViz element effects/message publications, and same-instant pose agreement remain PENDING because comparable browser measurements were not captured.
- `tb3_waffle` browser observation test timed out during the first full-suite run; the observation files were still written, but controls/message checks did not complete. A timeout extension was applied to that test and is included for the final suite run.
- No real simulation was started in this step. Other robots (`tb4`, Scout, arms, and all remaining catalog entries) were skipped as explicitly scoped and remain NOT VERIFIED; see `parity/robots/STATUS.md`.
