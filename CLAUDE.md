# ROS2Lab website (www.ros2lab.com)

A ROS 2 Jazzy course website on Firebase. Students learn in the browser: a practice Ubuntu terminal, Gazebo, RViz 2,
MoveIt 2, Nav2 and the **Robotic Models Simulator** (rviz.html), which runs the makers' official ROS 2 Jazzy
workspaces from GitHub.

## Golden rules

1. **The simulator must behave like real ROS 2 Jazzy on Ubuntu 24.04.** Same commands, same output, same topics,
   frames, rates, controllers and errors as when the robot's GitHub workspace is built and launched on Ubuntu.
   When unsure what real ROS 2 prints, read the upstream source (it is in `public/robots/ws/<ws>/src/` and
   `public/ros/jazzy/share.zip`) or compare with a recording (`ground-truth/real/`, see below). Never guess.
2. **Honesty.** The site runs the real launch files and configs, and JavaScript *models* of the programs. Never claim
   it runs the compiled programs. A program with no model prints an honest note in the terminal.
3. **Don't modify upstream robot packages** in `public/robots/ws/<ws>/src/`. They are pinned commits from GitHub.
   Fix the simulator instead. The only edits allowed are the page entries in `workspace.json`.
4. **Security** (see `SECURITY.md`): no `innerHTML` with data (use `textContent` / `replaceChildren`), no secrets in
   `public/`, no tokens in localStorage, no new external script hosts (CSP in `firebase.json`), server-side checks
   in `firestore.rules` / `storage.rules` / `functions/`. Run `node tools/security-check.mjs` after changes.
5. Small, surgical changes. Keep every existing test passing.

## Layout

| Path | What |
|---|---|
| `public/` | the static site (Firebase Hosting serves this folder) |
| `public/js/` | vanilla ES modules, no build step |
| `public/robots/ws/<ws>/` | official robot workspaces: `workspace.json` (page entries), `src/`, `text.json` (bundle), `<ws>.repos` (pinned commits) |
| `public/ros/jazzy/` | real installed files of Jazzy packages (`share.zip`, `index.json`, `SOURCES.json`) |
| `public/ros/launch-runtime/py.zip` | the real ros2/launch Python libraries for Pyodide (built by `tools/build-launch-runtime.mjs`) |
| `functions/` | Cloud Functions v2 (Node 22): admin, registration approval, visitor count |
| `content/` | course lessons |
| `tests/` | Playwright browser tests and Node unit tests |
| `tools/` | build scripts, `security-check.mjs`, `ground-truth/` (real-vs-site comparison) |

## How the simulator works

- **Terminal:** `terminal-sim.js` (the Shell, tabs, `ros2` CLI routing). `ros-graph.js` holds the ROS graph: nodes,
  topics, services, actions, params, TF, and the `ros2 topic/node/service/param/action` commands.
- **Real launch:** `real-launch.js` runs `ros2 launch` / `ros2 run` for official workspaces with the real launch
  libraries in Pyodide Web Workers (`launch-runtime.js`, `launch-worker.js`, `tools/launch-runtime-py/`).
  Each started process is handed to `makeContext().adapt`, which maps it to a JS model.
- **Models of programs:**
  - Gazebo: `ros-gz.js` (gz sim, bridge, create, systems), `gz-sdformat.js`, `gz-physics.js` (Rapier), `gz-sim.js` (rendering sensors: lidar, camera, IMU)
  - ros2_control: `ros2-control.js` (YAML, controller types), `ros-control-graph.js` (controller_manager, spawner)
  - MoveIt 2: `ros-moveit.js` (move_group from the real MoveItConfigsBuilder params), `moveit-*.js`
  - Nav2 / SLAM: `nav2-sim.js`, `nav2-core.js`, `slam-sim.js`
  - TurtleBot3 fake node: `tb3-fake.js`; Crazyflie sim server: `cf-sim.js`
- **RViz 2:** `rviz.js`, `rviz-data.js`, `moveit-rviz.js` (MotionPlanning panel). Page: `rviz-page.js` + `rviz.html`.
- Debug handle in the browser console: `window.__ros2lab.sh` (shell; `.graph` is the ROS graph) and `window.__ros2lab.term`.

## Running locally

```bash
cd public && python3 -m http.server 8080        # then open http://localhost:8080/rviz.html?robot=tb3_burger
```

Tests need Playwright once: `npm install --no-save @playwright/test && npx playwright install chromium`.
The browser tests expect the site on `localhost:8080`.

## Tests (run the relevant ones after every change)

| Test | Checks |
|---|---|
| `node tests/real-tb3.mjs` | TurtleBot3 Gazebo launch + teleop |
| `node tests/real-tb3-nav.mjs` | Cartographer SLAM, map saver, Nav2 goal |
| `node tests/real-mobile-audit.mjs` | TB3 sensors (scan/imu/odom/camera), SLAM, Nav2, fake node, Crazyflie (`ONLY=burger,waffle,slam,nav,fake,cf`) |
| `node tests/real-moveit.mjs <robot> "<launch cmd>"` | an arm: MoveIt plan + execute |
| `node tests/real-arms-audit.mjs` | every arm: controllers, trajectories, MoveIt, sensors |
| `node tests/real-sweep.mjs` | every workspace entry launches without unexpected errors |
| `LINES=80 node tests/real-entry.mjs <robot> "<cmd>" <secs>` | prints the terminal after one command (debugging) |
| `node tests/sweep.mjs`, `node tests/physics.test.mjs`, `node tests/gz-real-node.mjs`, `node tests/nav2-node.mjs`, `node tests/games-basics.mjs` | older regression suites |
| `node tools/security-check.mjs` | security rules |

## Real ROS 2 comparison (ground truth)

`tools/ground-truth/README.md`. On Ubuntu 24.04 + Jazzy: `bash tools/ground-truth/capture.sh` records what real
ROS 2 does; `node tests/sim-capture.mjs` records the site; `node tools/ground-truth/compare.mjs` writes
`ground-truth/REPORT.md` with every difference. Fixing the differences in that report is the main way to make the
simulator match real ROS 2.

## Deploying

Use the Firebase CLI from the project root: `firebase deploy --only hosting` for site changes;
`firebase deploy --only functions,firestore:rules,storage` when those changed. Project id: `ros2lab`.
After editing files under `public/robots/ws/<ws>/src/` (not normally allowed), rebuild bundles with
`node tools/build-ws-bundles.mjs`.
@parity/CLAUDE.md
