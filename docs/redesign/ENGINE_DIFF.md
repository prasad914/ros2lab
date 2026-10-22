# Practice terminals: lab.js vs the lesson engine (Prompt 3)

Two engines now run turtlesim commands on the site:

- **lab.js**: the home page's practice computer (`public/js/lab.js`).
- **Lesson engine**: `terminal-sim.js` + `ros-graph.js`, rendered by `lesson-render.js` as in a lesson.

**Neither engine was changed for this file.**

## How the outputs were made

Run on 21 Oct 2026: `node tests/engine-diff.mjs out.json` against the site on localhost:8080.

Both sides started the same way:

1. Terminal 1: `ros2 run turtlesim turtlesim_node`
2. Terminal 2: `ros2 run turtlesim turtle_teleop_key`
3. Terminal 3: the 16 commands below, one at a time

The lesson side used lesson IN1's terminal block. Each of its terminals first ran `source /opt/ros/jazzy/setup.bash`, because the lesson engine requires it. lab.js does not.

The "Real Jazzy" column comes only from captures in `parity/fixtures/lessons/`. Where no capture exists, it says **UNKNOWN**.

## Same output in both engines (7 of the 16 commands)

- `ros2 node list`
- `ros2 topic list -t`
- `ros2 param get /turtlesim background_r` → `Integer value is: 69`
- `ros2 service list -t`
- `ros2 action list -t`
- `ros2 topic info /turtle1/cmd_vel`
- `ros2 interface show turtlesim/srv/Spawn`

## Differences

| # | Command | Lesson engine | lab.js | Real Jazzy (evidence) |
|---|---|---|---|---|
| 1 | *(any `ros2` command in a new terminal)* | needs `source /opt/ros/jazzy/setup.bash` first | works straight away, as if `~/.bashrc` sources ROS 2 | depends on `~/.bashrc`: not a difference in output |
| 2 | `printenv \| grep ROS` | `ROS_DISTRO`, `ROS_PYTHON_VERSION`, `ROS_VERSION` (sorted) | `ROS_DISTRO`, `ROS_VERSION`, `ROS_PYTHON_VERSION` | `ROS_VERSION=2`, `ROS_PYTHON_VERSION=3`, `ROS_DOMAIN_ID=52`, `ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET`, `ROS_DISTRO=jazzy` (A7/term2_runner.txt:10-15). **Neither engine matches the order.** The capture also had `ROS_DOMAIN_ID` and `ROS_AUTOMATIC_DISCOVERY_RANGE` set; whether a default install sets the second is **UNKNOWN**. |
| 3 | `ros2 topic echo /turtle1/pose --once` | `x: 5.544445` (6 decimals) | `x: 5.544444561004639` | `x: 5.544444561004639` (D3/term1_runner.txt, D8/term2_runner.txt). **lab.js matches.** |
| 4 | `ros2 service call /spawn …` | adds `(A new turtle, turtle2, appeared. It brings its own topics: see ros2 topic list)` | ROS output only | ROS output only (the hint is the site's own teaching line) |
| 5 | `ros2 param set /turtlesim background_r 150` | adds `(The turtlesim window background is now rgb(150, 86, 255).)` | ROS output only | ROS output only (hint) |
| 6 | `ros2 node info /turtlesim` | no blank line after an empty section (`Service Clients:`, `Action Clients:`) | blank line after each empty section | a blank line after each empty section (F2/term1_runner.txt:310-316). **lab.js matches.** |
| 7 | `ros2 topic type /nope` | `WARNING: topic [/nope] does not appear to be published yet` + a hint line | prints nothing | **UNKNOWN** (no capture) |
| 8 | `ros2 node info` (no name) | `usage: ros2 node info <node_name>` | argparse usage line + `ros2 node info: error: the following arguments are required: node_name` | **UNKNOWN** (no capture). lab.js follows the argparse format. |
| 9 | `ros2 topic echo /turtle1/pose -1` | 3 messages, `^C`, then a note that the practice terminal stopped echo | treats `-1` as nothing and prints until Ctrl+C | **UNKNOWN** whether Jazzy's `topic echo` accepts `-1` (no capture) |
| 10 | `rqt_graph` | one line: `(Practice terminal: the rqt graph window would open here.)` | opens an rqt_graph window that draws the live graph; the terminal stays busy until the window closes or Ctrl+C | a window opens, the terminal stays busy (no capture of the window) |

Notes on the table:

- **Values that depend on timing are not differences.** The pose after the demo and turtle positions differ between runs; rows 3 and 9 compare the format only.
- **These match INVENTORY.md §3.** Row 6 is ros.md #17. Rows 7 and 8 are #11 and #12, but this kit has no capture for them, so they stay UNKNOWN here. Row 10 is "rqt_graph: hint text only".

## Not compared here

Both engines model these, but the run above did not exercise them (see INVENTORY.md §3):

- teleop banner case
- rotation keys
- live `rotate_absolute`
- `topic pub` streaming
- pipes other than `| grep`

## lab.js changes made for the site

These are display and safety changes only. They do not change any output above.

- **Escaping.** Names, topics and values the student can choose go through `esc()` before they are written to the terminal: node remaps, topic names from `topic pub`, spawned turtle names, `--field` values and the Tab completion list. They were inserted as HTML before.
- **Class names.** The command chips use `.lchip` instead of `.chip`, the tab bar `.ttabs` instead of `.tabs`, and the frame `.plab` instead of `.lab`, because app.css already styles those classes.
- **Debug handle.** `window.__lab` exists only with `?debug=1`.
