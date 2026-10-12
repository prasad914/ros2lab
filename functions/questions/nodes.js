// Week 6 "Writing your own ROS 2 nodes" (Python and C++). Week 5 basics live in progfund.js.
const { pick, pickN, int } = require("./util");
const T = [];
const mcq = (id, topic, make) => T.push({ id, topic, type: "mcq", make });
const nums = (x, d) => { const s = x.toFixed(d), t = String(Number(s)); return [...new Set([s, t, t.includes(".") ? t : t + ".0"])]; };
const NODES = ["patrol", "go_to_goal", "battery_checker", "safety_filter", "pose_monitor", "status_publisher"];

// ======================= n6time: time, rates, logging and driving sequences =======================
mcq("N-LOGLEVEL", "n6time", (r) => {
  const lvl = pick(r, ["debug", "info", "warn", "error"]), hidden = { debug: [], info: ["debug"], warn: ["debug", "info"], error: ["debug", "info", "warn"] }[lvl];
  const shown = ["debug", "info", "warn", "error"].filter((x) => !hidden.includes(x));
  const good = hidden.length ? `${hidden.join(" and ").toUpperCase()} messages` : "none: every level is shown";
  return { prompt: `A node runs with --ros-args --log-level ${lvl}. Which messages are hidden?`, options: [good, ...pickN(r, ["ERROR messages", "WARN and ERROR messages", "INFO and WARN messages", "only FATAL messages", "none: every level is shown", "DEBUG messages", "DEBUG and INFO messages"].filter((x) => x !== good), 3)],
    correct: good, explain: `The order is DEBUG < INFO < WARN < ERROR < FATAL. At ${lvl.toUpperCase()}, the shown levels are ${shown.join(", ").toUpperCase()} and FATAL.` };
});
mcq("N-DURATION", "n6time", (r) => {
  const t0 = pick(r, [10.0, 12.5, 3.0, 100.25]), dt = pick(r, [0.5, 1.25, 3.5, 2.0]), now = +(t0 + dt).toFixed(2);
  return { prompt: `A node remembered start = get_clock().now() at ${t0} s. Now the clock says ${now} s. What is (now - start).nanoseconds / 1e9?`,
    options: [String(dt), String(now), String(dt * 1e9), String(t0)].filter((v, i, a) => a.indexOf(v) === i), correct: String(dt),
    explain: `Time minus Time is a Duration of ${dt} s = ${dt * 1e9} ns; dividing by 1e9 gives seconds.` };
});
mcq("N-CANCEL", "n6time", (r) => ({ prompt: "A countdown timer should ring 3 times and then never again. Which call stops it for good?", options: ["self.timer.cancel()", "time.sleep(1000)", "self.destroy_node()", "rclpy.shutdown()"], correct: "self.timer.cancel()",
  explain: "cancel() stops only that timer; the node keeps running. (C++: timer_->cancel().)" }));
T.push({ id: "N-SQUARETICKS", topic: "n6time", type: "fill", make(r) {
  const [secs, hz] = pick(r, [[2, 10], [1, 10], [3, 10], [2, 20], [1.5, 10]]), n = Math.round(secs * hz);
  return { prompt: `A state machine runs in a ${hz} Hz timer. The FORWARD state must last ${secs} s. After how many ticks does it switch to TURN?`, correct: String(n), accept: [String(n)],
    explain: `${hz} ticks per second x ${secs} s = ${n} ticks.` };
} });
mcq("N-SIMTIME", "n6time", (r) => ({ prompt: "Why do ROS 2 nodes ask the node's clock (get_clock().now()) instead of calling time.time()?", options: ["With use_sim_time the node's clock follows simulated time from /clock, so the same code works in simulation and on the robot", "time.time() is forbidden in Python", "The node's clock is always faster", "time.time() only works in C++"],
  correct: "With use_sim_time the node's clock follows simulated time from /clock, so the same code works in simulation and on the robot", explain: "use_sim_time = true: the clock follows /clock (a simulator or a rosbag); false: the computer's clock." }));
T.push({ id: "N-THROTTLE", topic: "n6time", type: "fill", make(r) {
  const ms = pick(r, [500, 1000, 2000, 250]);
  return { prompt: `Complete the C++ macro so the message prints at most once every ${ms / 1000} s: RCLCPP_INFO_THROTTLE(get_logger(), *get_clock(), ____, "battery low");`,
    correct: String(ms), accept: [String(ms)], explain: "The C++ throttle period is in milliseconds; Python uses throttle_duration_sec in seconds." };
} });

// ======================= n6loop: control loops, chaining nodes, messages, QoS =======================
mcq("F-REMAP", "n6loop", (r) => {
  const to = pick(r, ["/robot1/cmd_vel", "/announcements", "/chiku/scan"]);
  return { prompt: `Which XML line inside a <node> makes the topic "chatter" become "${to}"?`, options: [`<remap from="chatter" to="${to}"/>`, `<param name="chatter" value="${to}"/>`, `<arg name="chatter" default="${to}"/>`, `<topic chatter="${to}"/>`],
    correct: `<remap from="chatter" to="${to}"/>`, explain: "Remapping renames a node's topic without changing its code." };
});

T.push({ id: "N-DIST", topic: "n6loop", type: "fill", make(r) {
  const [dx, dy, d] = pick(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [0.6, 0.8, 1], [1.5, 2, 2.5]]);
  const x = int(r, 1, 3), y = int(r, 1, 3);
  return { prompt: `The robot is at (${x}, ${y}) and the goal at (${x + dx}, ${y + dy}). What distance does go_to_goal compute with math.hypot(dx, dy)? (metres)`,
    correct: String(d), accept: nums(d, 1).concat(nums(d, 2)), explain: `dx = ${dx}, dy = ${dy}: sqrt(dx^2 + dy^2) = ${d}.` };
} });
mcq("N-HEADING", "n6loop", (r) => {
  const [g, dir, ang] = pick(r, [["(1, 4)", "turn left", "+1.57"], ["(1, -2)", "turn right", "-1.57"], ["(4, 1)", "go straight (no turning)", "0.00"], ["(-2, 1)", "turn around", "3.14"]]);
  return { prompt: `The robot is at (1, 1) facing 0 rad. The goal is at ${g}. With angular.z = kw * heading_error, what does the robot do first?`,
    options: [dir, ...["turn left", "turn right", "go straight (no turning)", "turn around"].filter((x) => x !== dir).slice(0, 3)], correct: dir,
    explain: `heading_error = atan2(dy, dx) - theta = ${ang} rad. Positive turns left, negative turns right.` };
});
mcq("N-CLOSED", "n6loop", (r) => ({ prompt: "What makes a controller CLOSED-loop?", options: ["It measures the result (for example the pose) and corrects its command every cycle", "It drives in a closed shape", "It stops when the program closes", "It uses a private topic"],
  correct: "It measures the result (for example the pose) and corrects its command every cycle", explain: "Open loop: command and hope. Closed loop: command, measure, correct." }));
mcq("N-WRAP", "n6loop", (r) => {
  const good = "math.atan2(math.sin(e), math.cos(e))";
  return { prompt: "Which expression keeps a heading error e between -pi and pi, so the robot always turns the short way?", options: [good, "e % (2 * math.pi)", "abs(e)", "math.degrees(e)"], correct: good,
    explain: "atan2(sin e, cos e) wraps any angle into -pi..pi; e % 2pi gives 0..2pi, which makes the robot turn the long way." };
});
mcq("N-QOS", "n6loop", (r) => {
  const [what, good] = pick(r, [["a 40 Hz laser scan", "BEST_EFFORT (sensor data)"], ["the map, published once at start-up", "RELIABLE + TRANSIENT_LOCAL (latched)"], ["navigation goals", "RELIABLE + VOLATILE"], ["a camera stream", "BEST_EFFORT (sensor data)"]]);
  return { prompt: `Which QoS fits ${what}?`, options: [good, ...["BEST_EFFORT (sensor data)", "RELIABLE + TRANSIENT_LOCAL (latched)", "RELIABLE + VOLATILE", "no QoS at all"].filter((x) => x !== good).slice(0, 3)], correct: good,
    explain: "Losing one sensor sample is fine; late joiners need a one-time status; commands must arrive." };
});
mcq("N-JOINTS", "n6loop", (r) => {
  const n = int(r, 2, 4);
  return { prompt: `A JointState lists ${n} names. How many positions must it have?`, options: [String(n), String(n - 1), String(n + 1), "any number"], correct: String(n),
    explain: "name[], position[] (and velocity[], effort[] if used) must have the same length and order." };
});


// ======================= n6struct: safe parameters, launch for several robots, tf2, executors, lifecycle, tests =======================
mcq("F-CBRET", "n6struct", (r) => ({ prompt: "In Python, what must an on-set parameters callback (add_on_set_parameters_callback) return?",
  options: ["SetParametersResult(successful=True or False, reason=...)", "Nothing", "The new value", "A Parameter object"], correct: "SetParametersResult(successful=True or False, reason=...)",
  explain: "Returning successful=False rejects the change, and the reason is shown to whoever tried to set it." }));
T.push({ id: "F-NSNAME", topic: "n6struct", type: "predict", make(r) {
  const ns = pick(r, ["robot1", "left", "bench4"]), topic = pick(r, ["chatter", "battery", "cmd_vel"]);
  return { prompt: `A launch file starts a node with namespace="${ns}". The node publishes on the relative topic name "${topic}". What is the full topic name? (Type it.)`,
    correct: `/${ns}/${topic}`, explain: "Relative names get the namespace in front. Names starting with / are absolute and are not changed." };
} });

mcq("N-PARAMFAIL", "n6struct", (r) => {
  const [cmd, why] = pick(r, [["ros2 param set /cruise_control speed 2", "speed is a double; 2 is an integer (write 2.0)"], ["ros2 param set /cruise_control speed 5.0", "5.0 is outside the floating point range 0..2"], ["ros2 param set /cruise_control robot_name bob", "robot_name is read-only"]]);
  return { prompt: `Why does this fail? ${cmd}`, options: [why, ...["speed is a double; 2 is an integer (write 2.0)", "5.0 is outside the floating point range 0..2", "robot_name is read-only", "parameters cannot be changed while a node runs"].filter((x) => x !== why).slice(0, 3)], correct: why,
    explain: "ROS 2 checks the type, then the descriptor (range, read_only), then your on-set callback." };
});
mcq("N-YAML", "n6struct", (r) => {
  const n = pick(r, NODES), ns = pick(r, ["robot1", "robot2", "chiku"]);
  const good = `/${ns}/${n}:\n  ros__parameters:\n    kv: 1.2`;
  return { prompt: `Which YAML block sets kv for the node ${n} running in the namespace /${ns}?`, options: [good, `${n}:\n  ros__parameters:\n    /${ns}/kv: 1.2`, `/${ns}/${n}:\n  ros_parameters:\n    kv: 1.2`, `/${ns}/${n}:\n  ros__parameters:\n  kv: 1.2`], correct: good,
    explain: "Full node name with namespace, then ros__parameters (two underscores), then the values indented under it." };
});
mcq("N-LAUNCHARG", "n6struct", (r) => {
  const a = pick(r, ["goal_x", "with_monitor", "robot_name", "speed"]);
  return { prompt: `In an XML launch file, how do you use the value of the launch argument ${a}?`, options: [`$(var ${a})`, `LaunchConfiguration('${a}')`, `\${${a}}`, `$(arg ${a})`], correct: `$(var ${a})`,
    explain: "XML: $(var name). Python: LaunchConfiguration('name'). ($(arg ...) is ROS 1.)" };
});
mcq("N-LOOKUP", "n6struct", (r) => {
  const [a, b] = pick(r, [["turtle2", "turtle1"], ["base_link", "camera"], ["map", "base_link"], ["world", "robot"]]);
  return { prompt: `buffer.lookup_transform('${a}', '${b}', Time()) returns...`, options: [`where ${b} is, expressed in the ${a} frame`, `where ${a} is, expressed in the ${b} frame`, `the distance between ${a} and ${b} only`, "nothing until a service is called"], correct: `where ${b} is, expressed in the ${a} frame`,
    explain: "lookup_transform(target_frame, source_frame, time): the source frame seen from the target frame." };
});
mcq("N-LIFECYCLE", "n6struct", (r) => {
  const [state, next] = pick(r, [["unconfigured", "configure"], ["inactive", "activate"], ["active", "deactivate"]]);
  return { prompt: `A lifecycle node is ${state}. Which transition is allowed next?`, options: [next, ...["configure", "activate", "deactivate", "spin"].filter((x) => x !== next).slice(0, 3)], correct: next,
    explain: "unconfigured -configure-> inactive -activate-> active; deactivate goes back to inactive." };
});
mcq("N-EXEC", "n6struct", (r) => ({ prompt: "A timer calls client.call() and waits. Which setup makes this safe?", options: ["Give the client and the timer different callback groups and spin a MultiThreadedExecutor", "Use a ReentrantCallbackGroup for nothing and the default executor", "Increase the timer period", "Call rclpy.spin() twice"],
  correct: "Give the client and the timer different callback groups and spin a MultiThreadedExecutor", explain: "Another thread can then deliver the response while the timer callback waits." }));
mcq("N-TEST", "n6struct", (r) => ({ prompt: "Why compare floats with pytest.approx or EXPECT_NEAR instead of ==?", options: ["Floating point maths has tiny rounding errors", "== does not work on numbers", "It is faster", "colcon requires it"],
  correct: "Floating point maths has tiny rounding errors", explain: "0.1 + 0.2 == 0.30000000000000004 in Python." }));

module.exports = T;
