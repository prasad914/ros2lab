# P10 careless persona — tb3_waffle

**Outcome: PARTIAL / real side PENDING.** The browser run completed for a limited simulator workflow, but did not reproduce all assigned mistakes. No real ROS was run. No application code or fixtures were edited.

## Evidence and constraints

- Browser evidence: `/home/prasad/ros2lab-course/parity/browser_out/tb3_waffle/p10-careless/browser-evidence.json`; run notes: `/home/prasad/ros2lab-course/parity/browser_out/tb3_waffle/p10-careless/notes.md`; screenshots: `3d-before.png`, `3d-after.png` in the same directory.
- A browser scenario spec was also written at `/home/prasad/ros2lab-course/parity/e2e/tb3_waffle/p10-careless.spec.ts`.
- The initial attempt to access course lessons through the unauthenticated browser dashboard was blocked; the accessible browser session exposed the simulator workflow, not course levels. Consequently course level text was not reviewed and no course-prevention claim is made.
- No real behavior was requested or attempted. No matching error fixture text exists in `/home/prasad/ros2lab-course/parity/fixtures/tb3_waffle/**/errors/`; real behavior is PENDING. No reported-real hints are represented as facts.
- Mistake list below is from `/home/prasad/ros2lab-course/parity/mistakes.yaml`, for careless persona levels <= 10. Robot-specific Burger-only mistakes do not apply. Browser actions in this run covered only three navigation items; other matching IDs remain unattempted.

## Applicable mistakes

| ID / level | Real behavior (copied fixture text) | Browser behavior (copied text / observed state) | Verdict | Faithful error first, helpful hint second? | Would course text have prevented it? / clarity |
|---|---|---|---|---|---|
| `fixed_frame_typed_unknown` / 1 | PENDING — no real run or matching error fixture. | Not attempted in this run. The captured state instead has Fixed Frame `map` and status `Fixed Frame [map] does not exist`; no arbitrary unknown frame was typed. | PENDING | PENDING | PENDING — course levels were not accessed. |
| `pointcloud_on_scan` / 2 | PENDING — no real run or matching error fixture. | Not attempted; no display controls were inspected. | PENDING | PENDING | PENDING — course levels were not accessed. |
| `domain_id_mismatch` / 3 | PENDING — no real run or matching error fixture. | Not attempted. | PENDING | PENDING | PENDING — course levels were not accessed. |
| `gazebo_paused` / 3 | PENDING — no real run or matching error fixture. | Not attempted. | PENDING | PENDING | PENDING — course levels were not accessed. |
| `duplicate_node_names` / 3 | PENDING — no real run or matching error fixture. | Not attempted. | PENDING | PENDING | PENDING — course levels were not accessed. |
| `map_not_saved` / 4 | PENDING — no real run or matching error fixture. | Not attempted; no map was created/saved in this run. | PENDING | PENDING | PENDING — course levels were not accessed. |
| `goal_before_initial_pose` / 5 | PENDING — no real run or matching error fixture. | Goal publication was not attempted: `"attempted": false` (browser-evidence.json). No viewer publish hook was available; no goal outcome was captured. | PENDING | PENDING | PENDING — course levels were not accessed. |
| `bad_map_path` / 5 | PENDING — no real run or matching error fixture. | Exact browser text: `file 'navigation_launch.py' was not found in the share directory of package 'nav2_bringup' at '/opt/ros/jazzy/share/nav2_bringup'`. The command failed because it selected the wrong launch package/file, before the invalid map path could be exercised. The browser showed a follow-on helpful note: `(TurtleBot3 Waffle: the makers' packages are in ~/ros2_ws/src. Build with colcon build, source install/setup.bash, export TURTLEBOT3_MODEL=waffle, then launch. Pick a command above, or type it.)` | NO-FIXTURE — intended bad-map behavior not reached; real side is PENDING. | The launch-file error precedes the note, but this is not the faithful bad-map error; cannot assess fidelity for the intended mistake. | PENDING — course levels were not accessed. The simulator page does list the robot-specific launch command; the scenario's generic `nav2_bringup navigation_launch.py` command was not the listed Waffle command. |
| `teleop_during_nav` / 8 | PENDING — no real run or matching error fixture. | Nav2 did not start. Captured `/cmd_vel` had one publisher, `/teleop_twist_keyboard`, type `geometry_msgs/msg/TwistStamped`; no second publisher or Nav2 motion was present. | NO-FIXTURE — competing-publisher condition was not established; real side is PENDING. | PENDING — no Nav2 conflict/error or hint was produced. | PENDING — course levels were not accessed. |

## Course / run issues

- The browser course dashboard required access unavailable in this session, so the course levels could not be read. The simulator page was accessible; its visible instructions list `ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True` for Waffle navigation, while the attempted invalid-map command used `nav2_bringup navigation_launch.py`. The mistaken command therefore tested launch-file lookup, not a bad map path.
- The viewer publish hook was unavailable, so the early-goal action was not sent. To test this mistake, the run needs a supported 2D Goal Pose action or a known publish hook.
- Teleop started, but the failed navigation launch left Nav2 absent, preventing a genuine teleop-vs-Nav2 competition test.
- Fixed Frame state was captured as selected `map` with `Fixed Frame [map] does not exist`, but the careless typed-unknown-frame action was not performed. Per-display status was not captured.
