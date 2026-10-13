# Ground truth: real ROS 2 vs the site

Records what real ROS 2 Jazzy does for a set of scenarios and what the site's simulator does for the same
scenarios, then lists every difference.

| File | What |
|---|---|
| `scenarios.txt` | the scenarios: workspace, robot, commands, settle time |
| `capture.sh` | real side, on Ubuntu 24.04 + ROS 2 Jazzy: builds the workspaces, runs each scenario, records it |
| `../../tests/sim-capture.mjs` | site side: the same scenarios in the browser (site on `localhost:8080`) |
| `compare.mjs` | writes `ground-truth/REPORT.md` |

Recordings go to `ground-truth/real/<id>/` and `ground-truth/site/<id>/` (git-ignored). Each has `commands.txt`,
`launch_<n>.log` (one per terminal), `nodes.txt`, `topics.txt`, `services.txt`, `actions.txt`, `controllers.txt`,
`hardware_interfaces.txt`, `tf_frames.gv` and, per topic, `topic/<name>.info.txt`, `.hz.txt` and `.echo.txt`.

## Use

```bash
bash tools/ground-truth/capture.sh tb3_burger_world   # one scenario first
bash tools/ground-truth/capture.sh                    # all of them
cd public && python3 -m http.server 8080 &            # the site
node tests/sim-capture.mjs                            # the site side (or: node tests/sim-capture.mjs <id> ...)
node tools/ground-truth/compare.mjs                   # -> ground-truth/REPORT.md
```

`capture.sh` builds each workspace once in `~/ros2lab-gt/<ws>` (set `GT_WS` to change it) from the pinned
`public/robots/ws/<ws>/<ws>.repos`, with the Ubuntu steps in that workspace's `workspace.json`. It does not run
steps that need sudo (apt, `rosdep init`, udev rules). If a build fails, read `~/ros2lab-gt/<ws>/build.log`,
install what is missing (usually `rosdep install --from-paths src --ignore-src -r -y` in that folder, which asks
for your password), delete nothing, and run `capture.sh` again: workspaces that built are skipped
(`~/ros2lab-gt/<ws>/.built`). The first full run takes 1-2 hours.

Gazebo and RViz windows open and close by themselves. Leave the computer alone while it runs: a busy CPU slows
Gazebo, and the recorded topic rates go down with it.

The recording uses `ROS_DOMAIN_ID=73` and `ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST`, so other ROS 2 programs on
the network do not end up in it.

## What compare.mjs checks

- node, topic (with type), service and action lists;
- controllers and their states, hardware interfaces;
- the TF tree (parent -> child edges from `view_frames`);
- the processes the launch started, and every WARN / ERROR / died line in the launch output (stamps and pids
  removed);
- per topic present on both: type, every publisher and subscriber with its QoS, the rate (more than 15 % apart
  counts), the message's field names and its frame ids.

## Expected differences

These are not bugs in the site. Each line is `<scenario id or *> <regex>`, matched against a REPORT line such as
`nodes: only real: /launch_ros_12345`. Add a line only with a reason in the comment above it.

```expected
# CLI and launch helper nodes with a pid or random suffix in the name
* ^nodes: only (real|site): /_ros2cli_\d+
* ^nodes: only (real|site): /launch_ros_\d+
* ^nodes: only (real|site): /transform_listener_impl_[0-9a-f]+
* ^topic \S+ endpoint: only (real|site): \S+ /_ros2cli_\d+
* ^topic \S+ endpoint: only (real|site): \S+ /transform_listener_impl_[0-9a-f]+
# MoveIt internal nodes with random names (moveit_<random>, move_group_private_<pointer>)
* ^nodes: only real: /moveit_[0-9a-f]+$
* ^nodes: only real: /move_group_private_\d+$
# /tf has several publishers (robot_state_publisher, the diff-drive plugin's bridge): `topic echo --once` shows
# whichever message comes first, so its frame ids differ between runs. /tf_static and the TF tree are still compared.
* ^topic /tf frame: only (real|site):
# the site's honest notes for programs it does not model (CLAUDE.md rule 2)
* ^launch log: only site: .*ROS2Lab:
# graphics-driver and desktop messages of the real Gazebo / RViz windows
* ^launch log: only real: .*(OpenGL|libEGL|MESA|QStandardPaths|Stereo is NOT SUPPORTED|XDG_RUNTIME_DIR|Wayland|\[QT\] .*Binding loop detected)
```
