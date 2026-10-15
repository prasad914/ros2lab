# Playground games (unlock per robot only when the listed readiness checks PASS)

Readiness checks (src/playground/readiness.ts): TF = full TF tree and Fixed Frame selectable · SENS = required sensor topics per manifest · TEL = teleop + odom · SLAM · AMCL · NAV = Nav2 lifecycle active + selected planner/controller wired · CAM = camera image works · FILT = keepout/speed filters · CM = collision monitor · DOCK = docking server · BT = behaviour tree view/editing · NS = namespaces / multi-robot.
Every game: world, robot whitelist, required levels, win condition, scoring formula, local leaderboard, deterministic seed, and a Playwright test where a scripted bot wins it.

| # | Game | Learning goal | Levels | Checks | Win condition / scoring | Difficulty |
|---|---|---|---|---|---|---|
| 1 | Teleop Time Trial | cmd_vel (TwistStamped), odom | 1–3 | TF, TEL | finish the cone course; score = time + collision penalty | ★ |
| 2 | TF Detective | TF tree, Fixed Frame | 1–3 | TF | answer 5 transform lookups (e.g. map→base_scan) within ±1 cm | ★ |
| 3 | Mapping Race | SLAM Toolbox | 4 | TF, SENS, SLAM | reach a map-coverage % vs ground truth within N minutes; map must be saved | ★★ |
| 4 | Kidnapped Robot | AMCL, 2D Pose Estimate, global localisation | 5 | AMCL | relocalise after a teleport; covariance below a limit in least time | ★★ |
| 5 | Treasure Hunt | waypoints / Simple Commander | 7–10 | NAV | visit 5 waypoints; score = time + path length | ★★ |
| 6 | Planner Showdown | NavFn vs Smac vs Theta* | 7 | NAV (all three planners wired) | predict shortest/smoothest path before running; points for correct predictions | ★★ |
| 7 | Narrow Doorway | inflation radius, footprint, costmaps | 6–8 | NAV | robot passes the door without collision; fewest parameter edits wins | ★★★ |
| 8 | Keepout Delivery | keepout + speed filters | 10 | NAV, FILT | deliver without entering the mask; speed-zone compliance | ★★★ |
| 9 | Dynamic Dodge | collision monitor, local costmap | 8–9 | NAV, CM | survive moving obstacles with zero contacts | ★★★ |
| 10 | Colour Finder | image topic + simple CV | 2 + camera | CAM (waffle, waffle_pi, tb4 only) | stop in front of the red box; centroid error | ★★ |
| 11 | Line Follower (AutoRace-inspired) | camera pipeline, control | camera | CAM | lap without leaving the line | ★★★ |
| 12 | Dock It | docking server | 10 | DOCK (only if installed) | dock within pose tolerance | ★★★ |
| 13 | BT Builder | behaviour trees (BT.CPP v4) | 9 | NAV, BT | build a BT that recovers from a blocked path | ★★★★ |
| 14 | Debugging Escape Room | QoS, TF, use_sim_time, lifecycle | all | all used by the chosen faults | fix 5 faults from tests/mistakes.yaml; hints cost points; errors must match fixtures | ★★★★ |
| 15 | Hospital Escort / Multi-robot Relay | namespaces, multi-robot | 10 | NS, NAV | hand-off between two robots; total delivery time | ★★★★ |

Camera games must be unavailable for tb3_burger (it has no camera).
Inspiration: ROBOTIS TurtleBot3 AutoRace and Home Service challenges, Nav2 tutorials (keepout zones, speed limits, docking, collision monitor, dynamic object following, Groot), Unibotics gamification.
