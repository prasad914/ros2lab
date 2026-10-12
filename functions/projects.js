// Final-project bank. Every student gets ONE project, picked and filled in from a
// private random seed, so two students almost never get the same brief.
// Pure functions (no database), so they can be unit-tested (npm test).
const crypto = require("node:crypto");
const { pick, pickN, int, shuffle, ROBOT_NAMES } = require("./questions/util");

function makeRng(seedHex) {
  let state = crypto.createHash("sha256").update(String(seedHex)).digest();
  let i = 0;
  return () => {
    if (i + 4 > state.length) { state = crypto.createHash("sha256").update(state).digest(); i = 0; }
    const v = state.readUInt32BE(i); i += 4;
    return v / 4294967296;
  };
}
const step = (r, lo, hi, s) => +(lo + s * Math.floor(r() * (Math.round((hi - lo) / s) + 1))).toFixed(2);
const COLORS = [["red", 255, 0, 0], ["green", 0, 200, 0], ["blue", 0, 0, 255], ["orange", 255, 140, 0], ["purple", 160, 32, 240], ["yellow", 230, 210, 0]];

// How every project is marked (total 100). Shown to the student and used by the instructor.
const RUBRIC = [
  { id: "works", label: "Works as specified: every requirement in your brief", max: 40 },
  { id: "interfaces", label: "Uses exactly the names, message types and values in your brief", max: 15 },
  { id: "code", label: "Clean ROS 2 code: node class, timers/callbacks, logging, no busy loops", max: 20 },
  { id: "launch", label: "Launch file and YAML parameters start the whole project", max: 10 },
  { id: "report", label: "Report: explains the design and gives the exact commands to run it", max: 15 },
];

const DELIVERABLES = [
  "Every file of your package: node source files, launch file, YAML file, package.xml, and setup.py (Python) or CMakeLists.txt (C++). Include any .msg, .srv or .action file.",
  "A short report: how your nodes work together (which node publishes, subscribes or serves what) and the exact commands to build and run it.",
  "Optional but recommended: the terminal output of a real run, or a link to a short screen recording (unlisted YouTube or Google Drive).",
];

// Each template returns { title, summary, requirements[], interfaces[] }.
const TEMPLATES = [
  {
    id: "polygon", make(r) {
      const robot = pick(r, ROBOT_NAMES), sides = int(r, 3, 8), len = step(r, 1.5, 3.0, 0.5), hz = pick(r, [10, 20, 25]);
      const lin = step(r, 0.8, 1.6, 0.2), ang = step(r, 0.6, 1.2, 0.2), pkg = `${robot.toLowerCase()}_polygon`;
      return {
        title: `${robot} draws a ${sides}-sided polygon`,
        summary: `Make the TurtleSim turtle draw a regular polygon with ${sides} sides, each ${len} m long, using a timer-driven state machine (no sleep loops).`,
        requirements: [
          `Package name: ${pkg}. Node name: polygon_driver.`,
          `Declare the parameters sides (default ${sides}), side_length (default ${len}), linear_speed (${lin} m/s) and angular_speed (${ang} rad/s), loaded from config/polygon.yaml.`,
          `A timer running at ${hz} Hz publishes geometry_msgs/msg/Twist on /turtle1/cmd_vel. States: FORWARD, TURN, DONE.`,
          `Subscribe to /turtle1/pose (turtlesim/msg/Pose) and use the pose, not elapsed time, to decide when a side or a turn of ${(360 / sides).toFixed(1)}° is finished.`,
          `When all ${sides} sides are drawn, stop the turtle and publish the text "done" once on /${robot.toLowerCase()}/status (std_msgs/msg/String).`,
          `A launch file launch/polygon.launch.py starts turtlesim_node and polygon_driver with the YAML file.`,
        ],
        interfaces: [`/turtle1/cmd_vel (Twist, publish)`, `/turtle1/pose (Pose, subscribe)`, `/${robot.toLowerCase()}/status (String, publish)`],
      };
    },
  },
  {
    id: "patrol", make(r) {
      const robot = pick(r, ROBOT_NAMES), k = int(r, 3, 5), kp = step(r, 1.0, 2.5, 0.5), tol = pick(r, [0.1, 0.15, 0.2]), loops = int(r, 2, 3);
      const pts = Array.from({ length: k }, () => `(${step(r, 1.5, 9.5, 0.5)}, ${step(r, 1.5, 9.5, 0.5)})`);
      const pkg = `${robot.toLowerCase()}_patrol`;
      return {
        title: `${robot} patrols ${k} waypoints`,
        summary: `A closed-loop go-to-goal controller drives the turtle through the waypoints ${pts.join(" → ")}, ${loops} times.`,
        requirements: [
          `Package name: ${pkg}. Node name: patrol_node.`,
          `Waypoints, in this order: ${pts.join(", ")}. Store them in config/patrol.yaml as two lists, waypoints_x and waypoints_y.`,
          `Proportional control: angular speed = ${kp} × heading error (wrap the error to −π…π); linear speed = 1.0 × distance, limited to 2.0 m/s. Turn first when the heading error is larger than 0.5 rad.`,
          `A waypoint is reached when the distance is below ${tol} m. Log "Reached waypoint i" with the INFO level.`,
          `After ${loops} complete rounds, stop the turtle and log "Patrol finished".`,
          `Publish the index of the current waypoint on /${robot.toLowerCase()}/waypoint (std_msgs/msg/Int32) every time it changes.`,
          `A launch file launch/patrol.launch.py starts turtlesim_node and patrol_node with the YAML file.`,
        ],
        interfaces: [`/turtle1/cmd_vel (Twist, publish)`, `/turtle1/pose (Pose, subscribe)`, `/${robot.toLowerCase()}/waypoint (Int32, publish)`],
      };
    },
  },
  {
    id: "battery", make(r) {
      const robot = pick(r, ROBOT_NAMES), drain = step(r, 0.5, 2.0, 0.5), thr = int(r, 15, 35), hz = pick(r, [1, 2, 5]);
      const [cname, cr, cg, cb] = pick(r, COLORS), pkg = `${robot.toLowerCase()}_battery`;
      return {
        title: `${robot}'s battery guard`,
        summary: `Two nodes: a pretend battery that drains while the turtle moves, and a guard that stops the robot and changes its pen colour when the battery is low.`,
        requirements: [
          `Package name: ${pkg}. Node names: battery_sim and battery_guard.`,
          `battery_sim starts at 100 %, publishes std_msgs/msg/Float32 on /${robot.toLowerCase()}/battery at ${hz} Hz, and loses ${drain} % per second only while the turtle is moving (linear speed in /turtle1/cmd_vel is not zero).`,
          `battery_guard subscribes to /${robot.toLowerCase()}/battery. When the level first drops below ${thr} %, it publishes a zero Twist on /turtle1/cmd_vel and calls the /turtle1/set_pen service with the colour ${cname} (r=${cr}, g=${cg}, b=${cb}, width=4).`,
          `The threshold ${thr} is a parameter named low_level, loaded from config/battery.yaml.`,
          `Log a WARN message once when the battery is low, not on every message.`,
          `A launch file launch/battery.launch.py starts turtlesim_node, battery_sim and battery_guard. Drive the turtle with turtle_teleop_key in a second terminal.`,
        ],
        interfaces: [`/${robot.toLowerCase()}/battery (Float32)`, `/turtle1/cmd_vel (Twist)`, `/turtle1/set_pen (turtlesim/srv/SetPen, client)`],
      };
    },
  },
  {
    id: "switch", make(r) {
      const robot = pick(r, ROBOT_NAMES), radius = step(r, 1.0, 2.5, 0.5), v = step(r, 0.8, 2.0, 0.4), every = int(r, 4, 9), pkg = `${robot.toLowerCase()}_switch`;
      return {
        title: `Switch ${robot} on and off with a service`,
        summary: `A service server turns circle-driving on and off, and a client node toggles it every ${every} seconds.`,
        requirements: [
          `Package name: ${pkg}. Node names: circle_server and toggle_client.`,
          `circle_server offers the service /${robot.toLowerCase()}/enable of type std_srvs/srv/SetBool. The response message must say "${robot} enabled" or "${robot} disabled".`,
          `When enabled, circle_server publishes a Twist on /turtle1/cmd_vel at 10 Hz so the turtle drives a circle of radius ${radius} m at ${v} m/s (angular speed = speed / radius). When disabled, it publishes zero speed once and stops publishing.`,
          `toggle_client waits for the service, then flips it every ${every} seconds with an asynchronous call (call_async / async_send_request), and logs each response.`,
          `radius and speed are parameters loaded from config/circle.yaml.`,
          `A launch file launch/switch.launch.py starts turtlesim_node, circle_server and toggle_client.`,
        ],
        interfaces: [`/${robot.toLowerCase()}/enable (SetBool, server + client)`, `/turtle1/cmd_vel (Twist, publish)`],
      };
    },
  },
  {
    id: "spawner", make(r) {
      const robot = pick(r, ROBOT_NAMES), n = int(r, 3, 6), rad = step(r, 2.0, 4.0, 0.5), prefix = robot.toLowerCase(), pkg = `${prefix}_spawner`;
      return {
        title: `${robot}'s turtle family on a circle`,
        summary: `A client node spawns ${n} turtles evenly on a circle of radius ${rad} m around the centre (5.5, 5.5), all facing the centre, then makes them spin.`,
        requirements: [
          `Package name: ${pkg}. Node name: family_spawner.`,
          `Call the /spawn service (turtlesim/srv/Spawn) ${n} times. Turtle i is placed at angle i × ${(360 / n).toFixed(1)}° on the circle and named ${prefix}_1 … ${prefix}_${n}.`,
          `Each new turtle must face the centre (theta = angle + π).`,
          `Wait for each response before the next call, without blocking the executor (use a callback or a small state machine).`,
          `After all turtles exist, publish a Twist with angular.z = 1.0 on /${prefix}_i/cmd_vel for every turtle at 5 Hz.`,
          `The count ${n} and radius ${rad} are parameters loaded from config/family.yaml.`,
          `A launch file launch/family.launch.py starts turtlesim_node and family_spawner.`,
        ],
        interfaces: [`/spawn (turtlesim/srv/Spawn, client)`, `/${prefix}_i/cmd_vel (Twist, publish)`],
      };
    },
  },
  {
    id: "safety", make(r) {
      const robot = pick(r, ROBOT_NAMES), vmax = step(r, 1.0, 2.0, 0.5), wmax = step(r, 1.0, 2.5, 0.5), margin = step(r, 0.5, 1.5, 0.5), pkg = `${robot.toLowerCase()}_safety`;
      const raw = `/${robot.toLowerCase()}/cmd_vel_raw`;
      return {
        title: `A safety filter for ${robot}`,
        summary: `Chain two nodes: a driver sends risky speeds on ${raw}, and a safety filter limits them and stops the turtle before it hits a wall.`,
        requirements: [
          `Package name: ${pkg}. Node names: risky_driver and safety_filter.`,
          `risky_driver publishes geometry_msgs/msg/Twist on ${raw} at 10 Hz with linear.x = 3.0 and angular.z changing every 3 s between −3.0 and 3.0.`,
          `safety_filter subscribes to ${raw} and /turtle1/pose, limits linear.x to ±${vmax} m/s and angular.z to ±${wmax} rad/s, and publishes the result on /turtle1/cmd_vel.`,
          `If the turtle is closer than ${margin} m to any wall (the window is 0 … 11.09 m) and moving towards it, safety_filter sends linear.x = 0 but keeps the angular speed, so the turtle can turn away.`,
          `vmax, wmax and margin are parameters with ranges (ParameterDescriptor), loaded from config/safety.yaml.`,
          `Log a WARN message (throttled to at most once per second) whenever a command is changed.`,
          `A launch file launch/safety.launch.py starts turtlesim_node, risky_driver and safety_filter.`,
        ],
        interfaces: [`${raw} (Twist)`, `/turtle1/pose (Pose, subscribe)`, `/turtle1/cmd_vel (Twist, publish)`],
      };
    },
  },
  {
    id: "healthmsg", make(r) {
      const robot = pick(r, ROBOT_NAMES), msg = `${robot}Health`, win = int(r, 5, 12), tmax = int(r, 55, 75), hz = pick(r, [2, 4, 5]);
      const extra = pick(r, [["uint8", "battery_percent"], ["float32", "motor_current"], ["uint16", "error_count"]]);
      const pkg = `${robot.toLowerCase()}_health`, ipkg = `${robot.toLowerCase()}_interfaces`;
      return {
        title: `${robot}'s own health message`,
        summary: `Define a custom message, publish pretend sensor readings with it, and watch them with a moving average.`,
        requirements: [
          `Interface package ${ipkg} with msg/${msg}.msg containing: float32 temperature, ${extra[0]} ${extra[1]}, string mode, builtin_interfaces/Time stamp.`,
          `Node package ${pkg} with the nodes health_publisher and health_watcher.`,
          `health_publisher publishes ${ipkg}/msg/${msg} on /${robot.toLowerCase()}/health at ${hz} Hz. temperature rises slowly from 40 °C with small random noise; mode is "RUN" below ${tmax} °C and "HOT" above.`,
          `health_watcher keeps a moving average of the last ${win} temperatures and logs a WARN message when the average goes above ${tmax} °C (once per crossing, not every message).`,
          `The window ${win} and limit ${tmax} are parameters loaded from config/health.yaml.`,
          `A launch file launch/health.launch.py starts both nodes.`,
        ],
        interfaces: [`${ipkg}/msg/${msg}`, `/${robot.toLowerCase()}/health (${msg}, publish + subscribe)`],
      };
    },
  },
  {
    id: "action", make(r) {
      const robot = pick(r, ROBOT_NAMES), dist = step(r, 2.0, 4.5, 0.5), v = step(r, 0.5, 1.5, 0.25), fb = pick(r, [2, 4, 5]), cancelAt = step(r, 0.4, 0.7, 0.1);
      const pkg = `${robot.toLowerCase()}_drive`, ipkg = `${robot.toLowerCase()}_interfaces`;
      return {
        title: `${robot} drives a distance with an action`,
        summary: `An action server drives the turtle straight for a requested distance, with progress feedback and cancel support.`,
        requirements: [
          `Interface package ${ipkg} with action/DriveDistance.action: goal float32 distance; result float32 travelled; feedback float32 remaining.`,
          `Node package ${pkg} with the nodes drive_server and drive_client.`,
          `drive_server offers the action /${robot.toLowerCase()}/drive_distance. It drives at ${v} m/s on /turtle1/cmd_vel, measures the travelled distance from /turtle1/pose, and sends feedback at ${fb} Hz.`,
          `It rejects goals that are not positive or longer than 6.0 m, and stops the turtle on success or cancel.`,
          `drive_client sends a goal of ${dist} m and prints every feedback message. Run it twice: once to the end, and once cancelling the goal when ${Math.round(cancelAt * 100)} % of the distance is done (choose with a parameter cancel_at).`,
          `A launch file launch/drive.launch.py starts turtlesim_node and drive_server.`,
        ],
        interfaces: [`${ipkg}/action/DriveDistance`, `/${robot.toLowerCase()}/drive_distance (action)`, `/turtle1/cmd_vel`, `/turtle1/pose`],
      };
    },
  },
  {
    id: "follower", make(r) {
      const robot = pick(r, ROBOT_NAMES), gap = step(r, 1.0, 2.0, 0.5), kp = step(r, 0.8, 2.0, 0.4), x = step(r, 1.5, 4.0, 0.5), y = step(r, 1.5, 4.0, 0.5);
      const name = `${robot.toLowerCase()}_follower`, pkg = `${robot.toLowerCase()}_follow`;
      return {
        title: `${robot} follows the leader`,
        summary: `Spawn a second turtle that follows turtle1 at a safe distance while you drive turtle1 with the keyboard.`,
        requirements: [
          `Package name: ${pkg}. Node name: follow_node.`,
          `At start-up, call /spawn to create a turtle named ${name} at (${x}, ${y}).`,
          `Subscribe to /turtle1/pose and /${name}/pose. Publish on /${name}/cmd_vel at 20 Hz so the follower keeps a distance of ${gap} m behind turtle1.`,
          `Control: linear speed = ${kp} × (distance − ${gap}), never negative and at most 2.5 m/s; angular speed = 4.0 × heading error (wrapped to −π…π).`,
          `If the follower is within 0.2 m of the wanted distance, it stops and logs "In position" (at most once per second).`,
          `gap and kp are parameters loaded from config/follow.yaml.`,
          `A launch file launch/follow.launch.py starts turtlesim_node and follow_node (run turtle_teleop_key yourself in another terminal).`,
        ],
        interfaces: [`/spawn (client)`, `/turtle1/pose`, `/${name}/pose`, `/${name}/cmd_vel`],
      };
    },
  },
  {
    id: "spiral", make(r) {
      const robot = pick(r, ROBOT_NAMES), w = step(r, 1.5, 3.0, 0.5), grow = step(r, 0.05, 0.25, 0.05), vmax = step(r, 2.0, 4.0, 0.5), pkg = `${robot.toLowerCase()}_spiral`;
      return {
        title: `${robot}'s safe-parameter spiral`,
        summary: `Draw an outward spiral whose speeds can be changed while the node runs, with parameters that refuse unsafe values.`,
        requirements: [
          `Package name: ${pkg}. Node name: spiral_node.`,
          `A 10 Hz timer publishes a Twist on /turtle1/cmd_vel with angular.z = ${w} rad/s and linear.x growing by ${grow} m/s every second, starting from 0.5.`,
          `Declare the parameters angular_speed (${w}), growth (${grow}) and max_speed (${vmax}) with ParameterDescriptor ranges: angular_speed 0.5…4.0, growth 0.01…0.5, max_speed 0.5…5.0.`,
          `Add a parameter callback that rejects any change outside these ranges with a clear reason, and applies valid changes immediately (ros2 param set while it runs).`,
          `When linear.x would pass max_speed or the turtle comes within 0.5 m of a wall, stop and log "Spiral finished".`,
          `Load the parameters from config/spiral.yaml; a launch file launch/spiral.launch.py starts turtlesim_node and spiral_node.`,
          `In your report, show one ros2 param set that is accepted and one that is rejected.`,
        ],
        interfaces: [`/turtle1/cmd_vel (Twist, publish)`, `/turtle1/pose (Pose, subscribe)`, `parameters: angular_speed, growth, max_speed`],
      };
    },
  },
];

// Pick and fill in a project from a seed. `avoid` = template ids to skip (e.g. the previous one).
function buildProject(seed, avoid = []) {
  const r = makeRng(seed);
  const pool = TEMPLATES.filter((t) => !avoid.includes(t.id));
  const tpl = shuffle(pool.length ? pool : TEMPLATES, r)[0];
  const p = tpl.make(r);
  return {
    templateId: tpl.id, title: p.title, summary: p.summary,
    requirements: p.requirements, interfaces: p.interfaces,
    deliverables: DELIVERABLES, rubric: RUBRIC,
  };
}

module.exports = { TEMPLATES, RUBRIC, DELIVERABLES, buildProject, makeRng, pickN };
