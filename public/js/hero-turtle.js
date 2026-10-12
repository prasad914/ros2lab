// The home page's TurtleSim: a terminal that speaks ROS 2 Jazzy to a turtlesim window, with the real behaviour of
// turtlesim (ros/ros_tutorials, jazzy): an 11.09 m square, cmd_vel that lasts one second, the wall warning, pens,
// several turtles, the RotateAbsolute action, parameters, teleop with the arrow keys, and ros2cli's own output.
// No downloads and no sign-in: it runs on this page only.
import { el } from "./dom.js";

const W = 11.088889, HOME = 5.544445, DT = 0.016;   // world size (m), centre, turtlesim's update period (62.5 Hz)
const STAR = { x: 9.2, y: 9.0 };                      // the mission target
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const f32 = (v) => String(Math.fround(v)).replace(/^(-?\d+)$/, "$1.0");   // a float32 as Python prints it
const py = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));           // a float64 as Python prints it
const stamp = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
const uuid = () => "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

// ---------- a small YAML flow parser that reads flow YAML the way PyYAML does: {linear: {x: 2.0}, angular: {z: 1.8}}.
// As in PyYAML, "x:2.0" (no space after the colon) is one plain scalar, and unbalanced braces raise a ParserError.
class PyFloat { constructor(v) { this.v = v; } valueOf() { return this.v; } }   // 2.0 stays a float, as in Python
const isMap = (v) => v !== null && typeof v === "object" && !(v instanceof PyFloat);
class YamlError extends Error { constructor(src, open, at, got) { super("yaml"); Object.assign(this, { src, open, at, got }); } }
function parseYaml(src) {
  let i = 0; let s = String(src).trim();
  if (s && !/^[{[]/.test(s) && /^[\w'"]+:\s/.test(s)) s = `{${s}}`;   // a one-line block mapping: linear: {x: 1.0}
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const endsPlain = (k) => /[,}\]]/.test(s[k]) || (s[k] === ":" && (k + 1 >= s.length || /[\s,}\]]/.test(s[k + 1])));
  const scalar = () => {
    ws();
    if (s[i] === "'" || s[i] === '"') { const q = s[i++]; let out = ""; while (i < s.length && s[i] !== q) out += s[i++]; i++; return out; }
    let out = ""; while (i < s.length && !endsPlain(i)) out += s[i++];
    out = out.trim();
    if (/^[-+]?\d+$/.test(out)) return Number(out);
    if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(out)) return new PyFloat(Number(out));   // PyYAML: a float needs its dot
    if (/^(yes|Yes|YES|true|True|TRUE|on|On|ON)$/.test(out)) return true;
    if (/^(no|No|NO|false|False|FALSE|off|Off|OFF)$/.test(out)) return false;
    if (/^(|~|null|Null|NULL)$/.test(out)) return null;
    return out;
  };
  const value = () => {
    ws(); if (s[i] === "{") return map();
    if (s[i] === "[") { const open = i++; const a = []; ws(); while (s[i] !== "]") { if (i >= s.length) throw new YamlError(s, open, i, "<stream end>"); a.push(value()); ws(); if (s[i] === ",") i++; else if (s[i] !== "]") throw new YamlError(s, open, i, i >= s.length ? "<stream end>" : s[i]); ws(); } i++; return a; }
    return scalar();
  };
  const map = () => {
    const open = i++; const o = {}; ws();
    while (s[i] !== "}") {
      if (i >= s.length) throw new YamlError(s, open, i, "<stream end>");
      let k = scalar(); ws();
      if (typeof k !== "string") k = `\u0000${pyType(k)}`;   // {off: 0}: PyYAML reads the key off as False
      if (s[i] === ":") { i++; o[k] = value(); } else o[k] = null;   // {a, b}: keys with no value
      ws();
      if (s[i] === ",") { i++; ws(); } else if (s[i] !== "}") throw new YamlError(s, open, i, i >= s.length ? "<stream end>" : s[i]);
    }
    i++; return o;
  };
  if (!s) return {};
  const v = value(); ws();
  if (i < s.length) throw new YamlError(s, 0, i, s[i]);
  return v;
}
// what ros2cli prints when yaml.safe_load fails: the end of a Python traceback
const yamlTrace = (e) => {
  const mark = (k) => `  in "<unicode string>", line 1, column ${k + 1}:\n    ${e.src}\n    ${" ".repeat(k)}^`;
  return `Traceback (most recent call last):\n  ...\nyaml.parser.ParserError: while parsing a flow mapping\n${mark(e.open)}\nexpected ',' or '}', but got '${e.got}'\n${mark(e.at)}`;
};
const pyType = (v) => (v === null ? "NoneType" : v instanceof PyFloat ? "float" : typeof v === "boolean" ? "bool" : typeof v === "number" ? (Number.isInteger(v) ? "int" : "float") : typeof v === "string" ? "str" : Array.isArray(v) ? "list" : "dict");
const pyRepr = (v) => (v === null ? "None" : v instanceof PyFloat ? py(v.v) : typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "number" ? (Number.isInteger(v) ? String(v) : String(v)) : String(v));
function split(line) {   // shell words, with quotes
  const out = []; let cur = "", q = null, any = false;
  for (const c of line) {
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === "'" || c === '"') { q = c; any = true; continue; }
    if (/\s/.test(c)) { if (cur || any) out.push(cur); cur = ""; any = false; continue; }
    cur += c;
  }
  if (cur || any) out.push(cur);
  return out;
}

// ---------- message types (fields, in order, with their Python types)
const TYPES = {
  "geometry_msgs/msg/Twist": { name: "geometry_msgs.msg.Twist", fields: { linear: "geometry_msgs/msg/Vector3", angular: "geometry_msgs/msg/Vector3" } },
  "geometry_msgs/msg/Vector3": { name: "geometry_msgs.msg.Vector3", fields: { x: "float64", y: "float64", z: "float64" } },
  "turtlesim/srv/Spawn": { req: { x: "float32", y: "float32", theta: "float32", name: "string" }, res: { name: "string" } },
  "turtlesim/srv/Kill": { req: { name: "string" }, res: {} },
  "turtlesim/srv/SetPen": { req: { r: "uint8", g: "uint8", b: "uint8", width: "uint8", off: "uint8" }, res: {} },
  "turtlesim/srv/TeleportAbsolute": { req: { x: "float32", y: "float32", theta: "float32" }, res: {} },
  "turtlesim/srv/TeleportRelative": { req: { linear: "float32", angular: "float32" }, res: {} },
  "std_srvs/srv/Empty": { req: {}, res: {} },
};
const IFACE = {
  "geometry_msgs/msg/Twist": "# This expresses velocity in free space broken into its linear and angular parts.\n\nVector3  linear\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z\nVector3  angular\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z",
  "turtlesim/msg/Pose": "float32 x\nfloat32 y\nfloat32 theta\n\nfloat32 linear_velocity\nfloat32 angular_velocity",
  "turtlesim/msg/Color": "uint8 r\nuint8 g\nuint8 b",
  "turtlesim/srv/Spawn": "float32 x\nfloat32 y\nfloat32 theta\nstring name # Optional.  A unique name will be created and returned if this is empty\n---\nstring name",
  "turtlesim/srv/Kill": "string name\n---",
  "turtlesim/srv/SetPen": "uint8 r\nuint8 g\nuint8 b\nuint8 width\nuint8 off\n---",
  "turtlesim/srv/TeleportAbsolute": "float32 x\nfloat32 y\nfloat32 theta\n---",
  "turtlesim/srv/TeleportRelative": "float32 linear\nfloat32 angular\n---",
  "std_srvs/srv/Empty": "---",
  "turtlesim/action/RotateAbsolute": "# The desired heading in radians\nfloat32 theta\n---\n# The angular displacement in radians to the starting position\nfloat32 delta\n---\n# The remaining rotation in radians\nfloat32 remaining",
};
// packages that exist on a ROS 2 Jazzy desktop install, with the interfaces of the ones this terminal knows fully
const PKGS = { turtlesim: ["msg/Color", "msg/Pose", "srv/Kill", "srv/SetPen", "srv/Spawn", "srv/TeleportAbsolute", "srv/TeleportRelative", "action/RotateAbsolute"], std_srvs: ["srv/Empty", "srv/SetBool", "srv/Trigger"] };
const OTHER_PKGS = ["geometry_msgs", "std_msgs", "sensor_msgs", "nav_msgs", "rcl_interfaces", "action_msgs", "builtin_interfaces", "example_interfaces", "tf2_msgs", "visualization_msgs", "trajectory_msgs", "diagnostic_msgs", "shape_msgs", "stereo_msgs", "unique_identifier_msgs", "lifecycle_msgs", "statistics_msgs", "type_description_interfaces"];
const pyVal = (t, v) => (t === "string" ? `'${v}'` : /float/.test(t) ? py(Number(v) || 0) : String(Math.trunc(Number(v) || 0)));
const reqRepr = (type, kind, vals) => { const [pkg, , n] = type.split("/"); const F = TYPES[type][kind]; return `${pkg}.srv.${n}_${kind === "req" ? "Request" : "Response"}(${Object.entries(F).map(([k, t]) => `${k}=${pyVal(t, vals[k] ?? (t === "string" ? "" : 0))}`).join(", ")})`; };
// rosidl_runtime_py's set_message_fields, with Python's own error texts (ros2cli prefixes "Failed to populate field: ")
const MSG = { "geometry_msgs/msg/Twist": { linear: "geometry_msgs/msg/Vector3", angular: "geometry_msgs/msg/Vector3" }, "geometry_msgs/msg/Vector3": { x: "float64", y: "float64", z: "float64" } };
function populate(cls, fields, vals) {
  if (!isMap(vals) || Array.isArray(vals)) throw new Error(`Value '${pyRepr(vals)}' is expected to be a dictionary but is a ${pyType(vals)}`);
  const out = {};
  for (const [k, t] of Object.entries(fields)) out[k] = MSG[t] ? populate(t.split("/").pop(), MSG[t], {}) : t === "string" ? "" : 0;
  for (const [k, v] of Object.entries(vals)) {
    const t = fields[k];
    if (k[0] === "\u0000") throw new Error(`attribute name must be string, not '${k.slice(1)}'`);
    if (!t) throw new Error(`'${cls}' object has no attribute '${k}'`);
    if (MSG[t]) { out[k] = populate(t.split("/").pop(), MSG[t], v); continue; }
    if (t === "string") { out[k] = pyRepr(v); continue; }
    if (/float/.test(t)) {
      if (v === null || isMap(v)) throw new Error(`Value '${pyRepr(v)}' is expected to be a dictionary but is a ${pyType(v)}`);
      const n = typeof v === "boolean" ? Number(v) : v instanceof PyFloat ? v.v : Number(String(v).trim());
      if (typeof v === "string" && (!String(v).trim() || Number.isNaN(n))) throw new Error(`could not convert string to float: '${v}'`);
      out[k] = n; continue;
    }
    // uint8
    if (v === null || isMap(v)) throw new Error(`Value '${pyRepr(v)}' is expected to be a dictionary but is a ${pyType(v)}`);
    if (typeof v === "string" && !/^\s*[-+]?\d+\s*$/.test(v)) throw new Error(`invalid literal for int() with base 10: '${v}'`);
    const n = Math.trunc(Number(v));
    if (n < 0 || n > 255) throw new Error(`The '${k}' field must be an unsigned integer in [0, 255]`);
    out[k] = n;
  }
  return out;
}
const twistFrom = (y) => populate("Twist", MSG["geometry_msgs/msg/Twist"], y);
const twistRepr = (t) => `geometry_msgs.msg.Twist(linear=geometry_msgs.msg.Vector3(x=${py(t.linear.x)}, y=${py(t.linear.y)}, z=${py(t.linear.z)}), angular=geometry_msgs.msg.Vector3(x=${py(t.angular.x)}, y=${py(t.angular.y)}, z=${py(t.angular.z)}))`;

// ---------- drawing the turtle (a green sea turtle, seen from above, facing +x)
function drawTurtle(g, size, hue = 0) {
  const s = size / 46;
  g.save(); g.scale(s, s);
  const shell = `hsl(${96 + hue} 42% 44%)`, shellDark = `hsl(${96 + hue} 45% 28%)`, skin = `hsl(${78 + hue} 48% 62%)`, skinDark = `hsl(${78 + hue} 40% 38%)`;
  g.lineWidth = 1.4; g.strokeStyle = skinDark; g.fillStyle = skin;
  for (const [x, y, r] of [[10, 13, -0.5], [10, -13, 0.5], [-10, 12, 0.6], [-10, -12, -0.6]]) { g.save(); g.translate(x, y); g.rotate(r); g.beginPath(); g.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
  g.beginPath(); g.ellipse(19, 0, 6.5, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke();                      // head
  g.fillStyle = "#1b1f14"; g.beginPath(); g.arc(22, 2.4, 1.1, 0, 7); g.arc(22, -2.4, 1.1, 0, 7); g.fill();  // eyes
  g.fillStyle = skin; g.beginPath(); g.moveTo(-16, 0); g.lineTo(-23, 2.5); g.lineTo(-23, -2.5); g.closePath(); g.fill(); g.stroke();   // tail
  g.fillStyle = shell; g.strokeStyle = shellDark; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.lineWidth = 1.3; g.beginPath();                                                                   // the plates
  const hx = [[0, 0, 5.2]], ring = [[9, 0], [4.5, 7.6], [-4.5, 7.6], [-9, 0], [-4.5, -7.6], [4.5, -7.6]];
  for (const [x, y, r] of hx) for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; const px = x + r * Math.cos(a), py2 = y + r * Math.sin(a); k ? g.lineTo(px, py2) : g.moveTo(px, py2); }
  for (const [x, y] of ring) { g.moveTo(x * 0.58, y * 0.58); g.lineTo(x * 1.2, y * 1.2); }
  g.stroke();
  g.restore();
}

export function mountHeroTurtle(host) {
  if (!host) return;
  // ---------------- state
  let bg = [69, 86, 255];
  const turtles = new Map();
  const newTurtle = (name, x, y, th) => ({ name, x, y, th, lin: [0, 0], ang: 0, last: -9, pen: { c: [179, 184, 255], w: 3, off: false }, hue: turtles.size ? (turtles.size * 37) % 120 - 50 : 0, rot: null });
  let idCounter = 0;   // turtlesim names unnamed turtles turtle<++id_counter_>; /reset starts it again
  const reset = () => { turtles.clear(); idCounter = 1; turtles.set("turtle1", newTurtle("turtle1", HOME, HOME, 0)); clearTrail(); };
  let simT = 0, seq = 1;
  const missions = { move: false, circle: false, spawn: false, star: false };
  let turnAcc = 0;

  // ---------------- DOM
  const canvas = el("canvas", { class: "ht2-canvas", width: "500", height: "500", role: "img", "aria-label": "TurtleSim window: a turtle on a blue square" });
  const trail = document.createElement("canvas"); trail.width = 1000; trail.height = 1000;   // the pen layer (turtlesim draws on a 500 px window: 2x here)
  const tctx = trail.getContext("2d"), ctx = canvas.getContext("2d");
  const out = el("div", { class: "ht2-out", role: "log", "aria-live": "polite", "aria-label": "Terminal output" });
  const input = el("input", { class: "ht2-input", type: "text", spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-label": "Type a ros2 command", placeholder: "type help, or tap a button below" });
  const ps = el("span", { class: "ht2-ps", "aria-hidden": "true" }, el("b", { text: "student@ros2lab" }), ":", el("i", { text: "~" }), "$");
  const form = el("form", { class: "ht2-line" }, ps, input);
  const termTitle = el("span", { text: "student@ros2lab: ~" });
  const simWin = el("div", { class: "ht2-win ht2-sim" }, el("div", { class: "ht2-bar" }, el("span", { class: "ht2-title", text: "TurtleSim" }), el("span", { class: "ht2-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i"))), canvas);
  const termWin = el("div", { class: "ht2-win ht2-term" }, el("div", { class: "ht2-bar" }, termTitle, el("span", { class: "ht2-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i"))), out, form);
  const missionList = el("ol", { class: "ht2-missions" });
  const MISSIONS = [["move", "Move the turtle", "publish on a topic"], ["circle", "Draw a full circle", "one unbroken turn"], ["spawn", "Spawn a second turtle", "call a service"], ["star", "Drive to the ★", "drive there, no teleporting"]];
  const count = el("span", { class: "ht2-mcount" });
  const doneCta = el("p", { class: "ht2-mdone", hidden: true }, "All four done: a topic, a service and an action, as in Week 4. ", el("a", { href: "register.html", text: "Register free and keep going" }));
  const paintMissions = () => {
    const n = MISSIONS.filter(([k]) => missions[k]).length;
    count.textContent = `${n} of 4`;
    missionList.replaceChildren(...MISSIONS.map(([k, t, hint]) => el("li", { class: missions[k] ? "done" : "" }, el("b", { text: t }), el("span", { text: hint }), el("span", { class: "sr-only", text: missions[k] ? " (done)" : "" }))));
    doneCta.hidden = n < 4;
  };
  const missionBox = el("section", { class: "ht2-mbox", "aria-label": "Missions" }, el("h2", { class: "ht2-mhead" }, "Missions ", count), missionList, doneCta);
  paintMissions();
  const chips = el("div", { class: "ht2-chips", role: "group", "aria-label": "Try a command" });
  host.replaceChildren(el("div", { class: "ht2" }, simWin, termWin, missionBox, chips));

  // ---------------- the terminal
  const MAXL = 90;
  const line = (t, cls = "") => { out.append(el("div", { class: `ht2-l ${cls}`, text: t })); while (out.childElementCount > MAXL) out.firstElementChild.remove(); out.scrollTop = out.scrollHeight; };
  const lines = (t, cls) => String(t).split("\n").forEach((x) => line(x, cls));
  const log = (lvl, t) => line(`[${lvl}] [${stamp()}] [turtlesim]: ${t}`, lvl === "WARN" ? "warn" : "dim");
  let fg = null;   // the running foreground job: { stop(), keys? }
  const stopFg = (show = true) => { if (!fg) return; const f = fg; fg = null; f.stop(); if (show) line("^C", "cmd"); input.placeholder = "type help, or tap a button below"; termTitle.textContent = "student@ros2lab: ~"; };
  const startFg = (job, title) => { fg = job; input.placeholder = "running: Ctrl+C (or Esc) stops it"; termTitle.textContent = title; };
  const history = []; let hpos = 0;

  const TOPICS = () => ["/parameter_events", "/rosout", ...[...turtles.keys()].flatMap((n) => [`/${n}/cmd_vel`, `/${n}/color_sensor`, `/${n}/pose`])];
  const TOPIC_T = (t) => (/cmd_vel$/.test(t) ? "geometry_msgs/msg/Twist" : /pose$/.test(t) ? "turtlesim/msg/Pose" : /color_sensor$/.test(t) ? "turtlesim/msg/Color" : t === "/rosout" ? "rcl_interfaces/msg/Log" : "rcl_interfaces/msg/ParameterEvent");
  const SERVICES = () => ["/clear", "/kill", "/reset", "/spawn", ...[...turtles.keys()].flatMap((n) => [`/${n}/set_pen`, `/${n}/teleport_absolute`, `/${n}/teleport_relative`]),
    "/turtlesim/describe_parameters", "/turtlesim/get_parameter_types", "/turtlesim/get_parameters", "/turtlesim/get_type_description", "/turtlesim/list_parameters", "/turtlesim/set_parameters", "/turtlesim/set_parameters_atomically"];
  const SRV_T = (s) => (/clear$|reset$/.test(s) ? "std_srvs/srv/Empty" : /spawn$/.test(s) ? "turtlesim/srv/Spawn" : /kill$/.test(s) ? "turtlesim/srv/Kill" : /set_pen$/.test(s) ? "turtlesim/srv/SetPen" : /teleport_absolute$/.test(s) ? "turtlesim/srv/TeleportAbsolute" : /teleport_relative$/.test(s) ? "turtlesim/srv/TeleportRelative" : "rcl_interfaces/srv/" + s.split("/").pop().replace(/(^|_)(\w)/g, (m, a, b) => b.toUpperCase()));
  let holonomic = false, useSimTime = false;
  const PARAMS = () => ({ background_b: bg[2], background_g: bg[1], background_r: bg[0], holonomic, start_type_description_service: true, use_sim_time: useSimTime });

  function drive(name, tw) {
    const t = turtles.get(name); if (!t) return false;
    if (t.rot && t.rot.client) { log("WARN", "Rotation goal aborted"); const r = t.rot; t.rot = null; r.done(false); }   // turtlesim aborts the action on a cmd_vel
    t.rot = null;
    // the circle mission counts one unbroken turn: a straight command, a spin on the spot or a change of direction starts it again
    const sign = Math.sign(tw.angular.z);
    if (name === "turtle1" && (!tw.linear.x || !sign || sign !== Math.sign(turnAcc || sign))) turnAcc = 0;
    t.lin = [tw.linear.x, holonomic ? tw.linear.y : 0]; t.ang = tw.angular.z; t.last = simT;
    if (tw.linear.x || tw.linear.y || tw.angular.z) missions.move = true;
    wake();
    return true;
  }
  const HELP = `ROS 2 Jazzy, with turtlesim running in the window on the left. Try:
  ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 1.8}}"
  ros2 topic pub -r 1 /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 1.0}, angular: {z: 1.0}}"
  ros2 topic echo /turtle1/pose --once        ros2 topic hz /turtle1/pose
  ros2 service call /spawn turtlesim/srv/Spawn "{x: 2, y: 2, theta: 0.0, name: 'turtle2'}"
  ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 60, b: 60, width: 5, 'off': 0}"
  ros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: 1.57}" --feedback
  ros2 run turtlesim turtle_teleop_key        ros2 param set /turtlesim background_r 150
  ros2 node list | topic list -t | service list | node info /turtlesim | param dump /turtlesim
  ros2 interface show turtlesim/srv/Spawn
Up/Down: history. Tab: complete. Ctrl+C: stop. clear: clear the screen.`;

  // argparse, as ros2cli uses it (Python 3.12 wording)
  const USAGE = "usage: ros2 [-h] [--use-python-default-buffering] Call `ros2 <command> -h` for more detailed usage. ...";
  const VERBS = ["action", "bag", "component", "daemon", "doctor", "extension_points", "extensions", "interface", "launch", "lifecycle", "multicast", "node", "param", "pkg", "run", "security", "service", "topic", "wtf"];
  const SUBS = { action: ["info", "list", "send_goal"], interface: ["list", "package", "packages", "proto", "show"], node: ["info", "list"], param: ["delete", "describe", "dump", "get", "list", "load", "set"], service: ["call", "echo", "find", "info", "list", "type"], topic: ["bw", "delay", "echo", "find", "hz", "info", "list", "pub", "type"] };
  const choose = (xs) => xs.map((x) => `'${x}'`).join(", ");
  const badChoice = (verb, got) => {
    if (!verb) { line(USAGE, "warn"); line(`ros2: error: argument Call \`ros2 <command> -h\` for more detailed usage.: invalid choice: '${got}' (choose from ${choose(VERBS)})`, "warn"); return; }
    line(`usage: ros2 ${verb} [-h] Call \`ros2 ${verb} <command> -h\` for more detailed usage. ...`, "warn");
    line(`ros2 ${verb}: error: argument Call \`ros2 ${verb} <command> -h\` for more detailed usage.: invalid choice: '${got}' (choose from ${choose(SUBS[verb])})`, "warn");
  };
  const unrecognized = (extra) => { line(USAGE, "warn"); line(`ros2: error: unrecognized arguments: ${extra.join(" ")}`, "warn"); };
  // a command that blocks until Ctrl+C, printing a line now and then (or never)
  const wait = (title, text, every = 0) => { if (text) line(text); const id = every ? setInterval(() => line(text), every) : 0; startFg({ stop: () => clearInterval(id) }, title); };
  const PARAM_T = (v) => (v instanceof PyFloat ? "double" : typeof v === "boolean" ? "boolean" : Number.isInteger(v) ? "integer" : typeof v === "number" ? "double" : "string");
  const yamlScalar = (x) => { try { const v = parseYaml(x); return v === null ? x : v; } catch { return x; } };

  function run(cmdline) {
    const raw = cmdline.trim(); if (!raw) return;
    const a = split(raw);
    if (a[0] === "clear") { out.replaceChildren(); return; }
    if (a[0] === "help" || a[0] === "?") { lines(HELP, "dim"); return; }
    if (a[0] === "source") return;
    if (a[0] === "ls") { line("ros2_ws"); return; }
    if (a[0] === "pwd") { line("/home/student"); return; }
    if (a[0] === "echo") { line(a.slice(1).join(" ").replace(/\$ROS_DISTRO/g, "jazzy")); return; }
    if (a[0] !== "ros2") { line(`${a[0]}: command not found`, "warn"); line("(This mini terminal only knows ros2 commands. The course's practice terminal is a whole Ubuntu.)", "dim"); return; }
    const [, verb, sub, ...rest] = a;
    const flag = (f) => rest.includes(f);
    if (!verb || verb === "-h" || verb === "--help") { lines(`${USAGE}\n\nros2 is an extensible command-line tool for ROS 2.\n\noptions:\n  -h, --help            show this help message and exit\n\nCommands:\n  action     Various action related sub-commands\n  interface  Show information about ROS interfaces\n  node       Various node related sub-commands\n  param      Various param related sub-commands\n  run        Run a package specific executable\n  service    Various service related sub-commands\n  topic      Various topic related sub-commands\n  (and bag, component, daemon, doctor, launch, lifecycle, pkg, ...)\n\n  Call \`ros2 <command> -h\` for more detailed usage.`); return; }
    if (!VERBS.includes(verb)) { badChoice(null, verb); return; }
    if (SUBS[verb] && !sub) { lines(`usage: ros2 ${verb} [-h] Call \`ros2 ${verb} <command> -h\` for more detailed usage. ...\n\nCommands:\n${SUBS[verb].map((x) => `  ${x}`).join("\n")}\n\n  Call \`ros2 ${verb} <command> -h\` for more detailed usage.`); return; }
    if (SUBS[verb] && !SUBS[verb].includes(sub)) { badChoice(verb, sub); return; }
    const pos = rest.filter((x) => !x.startsWith("-"));

    if (verb === "node") {
      const nodes = ["/turtlesim", ...(fg && fg.teleop ? ["/teleop_turtle"] : [])];
      if (sub === "list") { lines(nodes.join("\n")); return; }
      if (sub === "info") {
        if (!pos[0]) { line("usage: ros2 node info [-h] [--spin-time SPIN_TIME] [--include-hidden] node_name", "warn"); line("ros2 node info: error: the following arguments are required: node_name", "warn"); return; }
        if (pos[0] === "/teleop_turtle" && nodes.includes(pos[0])) { lines("/teleop_turtle\n  Subscribers:\n    /parameter_events: rcl_interfaces/msg/ParameterEvent\n  Publishers:\n    /parameter_events: rcl_interfaces/msg/ParameterEvent\n    /rosout: rcl_interfaces/msg/Log\n    /turtle1/cmd_vel: geometry_msgs/msg/Twist\n  Service Servers:\n    /teleop_turtle/describe_parameters: rcl_interfaces/srv/DescribeParameters\n    /teleop_turtle/get_parameter_types: rcl_interfaces/srv/GetParameterTypes\n    /teleop_turtle/get_parameters: rcl_interfaces/srv/GetParameters\n    /teleop_turtle/get_type_description: type_description_interfaces/srv/GetTypeDescription\n    /teleop_turtle/list_parameters: rcl_interfaces/srv/ListParameters\n    /teleop_turtle/set_parameters: rcl_interfaces/srv/SetParameters\n    /teleop_turtle/set_parameters_atomically: rcl_interfaces/srv/SetParametersAtomically\n  Service Clients:\n\n  Action Servers:\n\n  Action Clients:\n    /turtle1/rotate_absolute: turtlesim/action/RotateAbsolute\n"); return; }
        if (pos[0] !== "/turtlesim") { line(`Unable to find node '${pos[0]}'`, "warn"); return; }
        const names = [...turtles.keys()];
        lines(["/turtlesim", "  Subscribers:", "    /parameter_events: rcl_interfaces/msg/ParameterEvent", ...names.map((n) => `    /${n}/cmd_vel: geometry_msgs/msg/Twist`), "  Publishers:", "    /parameter_events: rcl_interfaces/msg/ParameterEvent", "    /rosout: rcl_interfaces/msg/Log",
          ...names.flatMap((n) => [`    /${n}/color_sensor: turtlesim/msg/Color`, `    /${n}/pose: turtlesim/msg/Pose`]), "  Service Servers:", ...SERVICES().map((s) => `    ${s}: ${SRV_T(s)}`), "  Service Clients:", "", "  Action Servers:", ...names.map((n) => `    /${n}/rotate_absolute: turtlesim/action/RotateAbsolute`), "  Action Clients:", ""].join("\n"));
        return;
      }
    }
    if (verb === "topic") {
      if (sub === "list") { lines(TOPICS().sort().map((t) => (flag("-t") || flag("--show-types") ? `${t} [${TOPIC_T(t)}]` : t)).join("\n")); return; }
      if (sub === "type") { const t = pos[0]; if (TOPICS().includes(t)) line(TOPIC_T(t)); else line(`Unknown topic '${t || ""}'`, "warn"); return; }
      if (sub === "info") { const t = pos[0]; if (!TOPICS().includes(t)) { line(`Unknown topic '${t || ""}'`, "warn"); return; } lines(`Type: ${TOPIC_T(t)}\nPublisher count: ${/cmd_vel/.test(t) ? (fg && fg.teleop ? 1 : 0) : 1}\nSubscription count: ${/cmd_vel/.test(t) ? 1 : 0}`); return; }
      if (sub === "echo") {
        const t = pos[0];
        const m = t && t.match(/^\/(\w+)\/pose$/);
        if (t && /^\/(\w+)\/cmd_vel$/.test(t) && turtles.has(t.split("/")[1])) { wait(`ros2 topic echo ${t}`, ""); line("(It prints each Twist as it arrives. Publish from a second terminal on Ubuntu to see them here.)", "dim"); return; }
        if (!m || !turtles.has(m[1])) { line(`WARNING: topic [${t || ""}] does not appear to be published yet`, "warn"); line("Could not determine the type for the passed topic", "warn"); return; }
        const show = () => { const p = turtles.get(m[1]); if (!p) return; const moving = simT - p.last < 1; lines(`x: ${f32(p.x)}\ny: ${f32(p.y)}\ntheta: ${f32(p.th)}\nlinear_velocity: ${f32(moving ? Math.hypot(p.lin[0], p.lin[1]) : 0)}\nangular_velocity: ${f32(moving ? p.ang : p.rot ? Math.sign(norm(p.rot.goal - p.th)) : 0)}\n---`); };
        show();
        if (flag("--once")) return;
        // the real echo prints every message (62.5 per second); here every 0.4 s so it can be read
        const id = setInterval(show, 400);
        startFg({ stop: () => clearInterval(id) }, `ros2 topic echo ${t}`);
        return;
      }
      if (sub === "hz") {
        const t = pos[0];
        if (!t) { line("ros2 topic hz: error: the following arguments are required: topic_name", "warn"); return; }
        if (!/\/pose$/.test(t) || !turtles.has(t.split("/")[1])) { wait(`ros2 topic hz ${t}`, `WARNING: topic [${t}] does not appear to be published yet`); return; }
        let n = 0;
        const id = setInterval(() => { n++; lines(`average rate: ${(62.5 + (Math.random() - 0.5) * 0.02).toFixed(3)}\n\tmin: 0.015s max: 0.017s std dev: 0.00031s window: ${Math.min(10000, Math.round(62.5 * n) + 1)}`); }, 1000);
        startFg({ stop: () => clearInterval(id) }, `ros2 topic hz ${t}`);
        return;
      }
      if (sub === "pub") {
        let times = 0, rate = 1; const args = [];
        for (let i = 0; i < rest.length; i++) { const x = rest[i]; if (x === "--once" || x === "-1") times = 1; else if (x === "-r" || x === "--rate") rate = Number(rest[++i]) || 1; else if (x === "-t" || x === "--times") times = Math.max(1, Number(rest[++i]) || 1); else if (x === "-w" || x === "--wait-matching-subscriptions" || x === "--qos-profile" || x === "-p" || x === "--print") i++; else if (x === "--keep-alive" || x.startsWith("--qos")) { if (x !== "--keep-alive") i++; } else args.push(x); }
        const [topic, type, yaml = "{}", ...extra] = args;
        if (!topic || !type) { line("usage: ros2 topic pub [-h] [-r N] [-p N] [-1] [-t TIMES] [-w WAIT_MATCHING_SUBSCRIPTIONS] [--keep-alive N] topic_name message_type [values]", "warn"); line(`ros2 topic pub: error: the following arguments are required: ${topic ? "message_type" : "topic_name, message_type"}`, "warn"); return; }
        if (extra.length) { unrecognized(extra); line("(Put the message in quotes: \"{linear: {x: 2.0}}\". Without them, the shell splits it at every space.)", "dim"); return; }
        if (!/^\w+\/msg\/\w+$/.test(type) || type !== "geometry_msgs/msg/Twist") {
          if (!/^(geometry_msgs\/msg\/(Twist|TwistStamped|Vector3|Pose|Point)|std_msgs\/msg\/(String|Int32|Float64|Bool|Empty)|turtlesim\/msg\/(Pose|Color))$/.test(type)) { line("The passed message type is invalid", "warn"); return; }
          line(`(${type} is a real type, but turtlesim listens for geometry_msgs/msg/Twist on /turtle1/cmd_vel. This mini terminal publishes only Twist.)`, "dim"); return;
        }
        let y; try { y = parseYaml(yaml); } catch (e) { if (e instanceof YamlError) { line("The passed value needs to be in YAML string or a dictionary", "warn"); return; } throw e; }
        if (!isMap(y) || Array.isArray(y)) { line("The passed value needs to be a dictionary in YAML format", "warn"); return; }
        let tw; try { tw = twistFrom(y); } catch (e) { line(`Failed to populate field: ${e.message}`, "warn"); return; }
        const m = topic.match(/^\/(\w+)\/cmd_vel$/), heard = !!(m && turtles.has(m[1]));
        const send = (k) => { line(`publishing #${k}: ${twistRepr(tw)}`); line(""); if (heard) drive(m[1], tw); };
        if (times && !heard) {   // --once and --times wait for a subscriber first (default -w 1)
          wait(`ros2 topic pub ${topic}`, "Waiting for at least 1 matching subscription(s)...", 1000);
          line(`(Nothing subscribes to ${topic}. turtlesim's turtles listen on ${[...turtles.keys()].map((n) => `/${n}/cmd_vel`).join(", ")}. Ctrl+C stops the wait.)`, "dim");
          return;
        }
        line("publisher: beginning loop");
        let k = 1; send(k);
        if (times === 1) return;
        const id = setInterval(() => { k++; send(k); if (times && k >= times) stopFg(false); }, 1000 / Math.max(0.1, Math.min(rate, 20)));
        startFg({ stop: () => clearInterval(id) }, `ros2 topic pub ${topic}`);
        return;
      }
      line(`(ros2 topic ${sub}: not in this mini terminal. Type help for what it knows.)`, "dim"); return;
    }
    if (verb === "service") {
      if (sub === "list") { lines(SERVICES().sort().map((s) => (flag("-t") || flag("--show-types") ? `${s} [${SRV_T(s)}]` : s)).join("\n")); return; }
      if (sub === "type") { const s = pos[0]; if (SERVICES().includes(s)) line(SRV_T(s)); else line(`Unknown service '${s || ""}'`, "warn"); return; }
      if (sub === "call") {
        const [srv, type, yaml = "{}", ...extra] = pos;
        if (!srv || !type) { line("usage: ros2 service call [-h] [-r N] service_name service_type [values]", "warn"); line(`ros2 service call: error: the following arguments are required: ${srv ? "service_type" : "service_name, service_type"}`, "warn"); return; }
        if (extra.length) { unrecognized(extra); line("(Put the request in quotes: \"{x: 2.0, y: 2.0}\". Without them, the shell splits it at every space.)", "dim"); return; }
        const T = TYPES[type];
        if (!T && !/^(rcl_interfaces|std_srvs|example_interfaces|type_description_interfaces)\/srv\/\w+$/.test(type)) { line("The passed service type is invalid", "warn"); return; }
        if (!SERVICES().includes(srv) || SRV_T(srv) !== type) {   // the client waits for a server with that name AND type
          wait(`ros2 service call ${srv}`, "waiting for service to become available...");
          line(SERVICES().includes(srv) ? `(${srv} has the type ${SRV_T(srv)}, not ${type}, so the call waits forever. Ctrl+C stops it.)` : `(No service called ${srv}: ros2 service list shows them. Ctrl+C stops the wait.)`, "dim");
          return;
        }
        if (!T) { line(`(${type} is not callable from this mini terminal.)`, "dim"); return; }
        let y; try { y = parseYaml(yaml); } catch (e) { if (e instanceof YamlError) { lines(yamlTrace(e), "warn"); return; } throw e; }
        if (y === null) y = {};
        let req; try { req = populate(`${type.split("/").pop()}_Request`, T.req, y); } catch (e) { line(`Failed to populate field: ${e.message}`, "warn"); return; }
        line(`requester: making request: ${reqRepr(type, "req", req)}`); line("");
        const respond = (vals = {}) => { line("response:"); line(reqRepr(type, "res", vals)); line(""); };
        const tn = (srv.match(/^\/(\w+)\//) || [])[1];
        if (srv === "/spawn") {
          let name = req.name;
          if (!name) { do { name = `turtle${++idCounter}`; } while (turtles.has(name)); }
          else if (turtles.has(name)) { log("ERROR", `A turtle named [${name}] already exists`); respond({ name: "" }); return; }
          const t = newTurtle(name, req.x, req.y, req.theta); turtles.set(name, t); if (turtles.size > 1) missions.spawn = true;
          log("INFO", `Spawning turtle [${name}] at x=[${(+t.x).toFixed(6)}], y=[${(+t.y).toFixed(6)}], theta=[${(+t.th).toFixed(6)}]`);
          respond({ name });
        } else if (srv === "/kill") {
          if (!turtles.has(req.name)) { log("ERROR", `Tried to kill turtle [${req.name}], which does not exist`); respond(); return; }
          turtles.delete(req.name); respond();
        } else if (srv === "/clear") { log("INFO", "Clearing turtlesim."); clearTrail(); respond(); }
        else if (srv === "/reset") { log("INFO", "Resetting turtlesim."); reset(); log("INFO", `Spawning turtle [turtle1] at x=[${HOME.toFixed(6)}], y=[${HOME.toFixed(6)}], theta=[0.000000]`); respond(); }
        else if (/set_pen$/.test(srv)) { const t = turtles.get(tn); t.pen = { c: [req.r, req.g, req.b], w: req.width, off: !!req.off }; respond(); }
        else if (/teleport_absolute$/.test(srv)) { const t = turtles.get(tn); move(t, req.x, req.y); t.th = norm(req.theta); respond(); }
        else if (/teleport_relative$/.test(srv)) { const t = turtles.get(tn); t.th = norm(t.th + req.angular); move(t, t.x + Math.cos(t.th) * req.linear, t.y + Math.sin(t.th) * req.linear); respond(); }
        else respond();
        return;
      }
      line(`(ros2 service ${sub}: not in this mini terminal. Type help for what it knows.)`, "dim"); return;
    }
    if (verb === "interface") {
      if (sub !== "show") { line(`(ros2 interface ${sub}: not in this mini terminal. Try ros2 interface show turtlesim/srv/Spawn.)`, "dim"); return; }
      const t = pos[0];
      if (!t) { line("ros2 interface show: error: the following arguments are required: type", "warn"); return; }
      if (IFACE[t]) { lines(IFACE[t]); return; }
      const parts = t.split("/");
      if (parts.length !== 3) { line(`Invalid name '${t}'. Expected three parts separated by '/'`, "warn"); return; }
      const [pkg, kind, name] = parts;
      if (PKGS[pkg]) { if (PKGS[pkg].includes(`${kind}/${name}`)) line(`(${t} is real, but this mini terminal does not hold its text.)`, "dim"); else line(`Interface '${kind}/${name}' not found in package '${pkg}'`, "warn"); return; }
      if (OTHER_PKGS.includes(pkg)) { line(`(${pkg} is installed with ROS 2, but this mini terminal only holds turtlesim's interfaces and geometry_msgs/msg/Twist.)`, "dim"); return; }
      line(`Unknown package '${pkg}'`, "warn"); return;
    }
    if (verb === "param") {
      const P = PARAMS();
      const node = pos[0], name = pos[1];
      if (sub === "list") {
        if (node && node !== "/turtlesim") { line("Node not found", "warn"); return; }
        lines(["/turtlesim:", ...["background_b", "background_g", "background_r", "holonomic", "qos_overrides./parameter_events.publisher.depth", "qos_overrides./parameter_events.publisher.durability", "qos_overrides./parameter_events.publisher.history", "qos_overrides./parameter_events.publisher.reliability", "start_type_description_service", "use_sim_time"].map((p) => `  ${p}`)].join("\n")); return;
      }
      if (node !== "/turtlesim") { line("Node not found", "warn"); return; }
      if (sub === "dump") { lines(`/turtlesim:\n  ros__parameters:\n    background_b: ${P.background_b}\n    background_g: ${P.background_g}\n    background_r: ${P.background_r}\n    holonomic: ${P.holonomic}\n    qos_overrides:\n      /parameter_events:\n        publisher:\n          depth: 1000\n          durability: volatile\n          history: keep_last\n          reliability: reliable\n    start_type_description_service: ${P.start_type_description_service}\n    use_sim_time: ${P.use_sim_time}\n`); return; }
      if (sub === "get") { if (!(name in P)) { line("Parameter not set.", "warn"); return; } line(typeof P[name] === "boolean" ? `Boolean value is: ${P[name] ? "True" : "False"}` : `Integer value is: ${P[name]}`); return; }
      if (sub === "set") {
        if (pos.length < 3) { line(`ros2 param set: error: the following arguments are required: ${["node_name", "parameter_name", "value"].slice(pos.length).join(", ")}`, "warn"); return; }
        const v = yamlScalar(pos[2]);
        if (!(name in P) && !/^qos_overrides\./.test(name)) { line(`Setting parameter failed: parameter '${name}' cannot be set because it was not declared`, "warn"); return; }
        if (name === "start_type_description_service" || /^qos_overrides\./.test(name)) { line(`Setting parameter failed: parameter '${name}' cannot be set because it is read-only`, "warn"); return; }
        if (PARAM_T(v) !== PARAM_T(P[name])) { line(`Setting parameter failed: Wrong parameter type, parameter {${name}} is of type {${PARAM_T(P[name])}}, setting it to {${PARAM_T(v)}} is not allowed.`, "warn"); return; }
        const k = ["background_r", "background_g", "background_b"].indexOf(name);
        if (k >= 0) {
          if (v < 0 || v > 255) { line(`Setting parameter failed: Parameter {${name}} doesn't comply with integer range.`, "warn"); return; }
          bg = bg.slice(); bg[k] = v; clearTrail();
        } else if (name === "holonomic") holonomic = v; else if (name === "use_sim_time") useSimTime = v;
        line("Set parameter successful"); return;
      }
      line(`(ros2 param ${sub}: not in this mini terminal. Type help for what it knows.)`, "dim"); return;
    }
    if (verb === "action") {
      const acts = () => [...turtles.keys()].map((n) => `/${n}/rotate_absolute`);
      if (sub === "list") { lines(acts().map((x) => (flag("-t") || flag("--show-types") ? `${x} [turtlesim/action/RotateAbsolute]` : x)).join("\n")); return; }
      if (sub === "info") {
        const x = pos[0];
        if (!x) { line("ros2 action info: error: the following arguments are required: action_name", "warn"); return; }
        const teleop = !!(fg && fg.teleop) && x === "/turtle1/rotate_absolute";
        if (!acts().includes(x)) { lines(`Action: ${x}\nAction clients: 0\nAction servers: 0`); return; }
        lines(`Action: ${x}\nAction clients: ${teleop ? 1 : 0}${teleop ? "\n    /teleop_turtle" : ""}\nAction servers: 1\n    /turtlesim`); return;
      }
      if (sub === "send_goal") {
        const [act, type, yaml = "{}", ...extra] = pos;
        if (!act || !type) { line(`ros2 action send_goal: error: the following arguments are required: ${act ? "action_type, goal" : "action_name, action_type, goal"}`, "warn"); return; }
        if (extra.length) { unrecognized(extra); return; }
        if (type !== "turtlesim/action/RotateAbsolute") { line(/^\w+\/action\/\w+$/.test(type) && /^(example_interfaces|action_tutorials_interfaces|nav2_msgs|control_msgs)\//.test(type) ? "(That action type is real, but turtlesim serves turtlesim/action/RotateAbsolute.)" : "The passed action type is invalid", "warn"); return; }
        const m = act.match(/^\/(\w+)\/rotate_absolute$/);
        if (!m || !turtles.has(m[1])) { wait(`ros2 action send_goal ${act}`, "Waiting for an action server to become available..."); line("(No action server by that name: ros2 action list shows them. Ctrl+C stops the wait.)", "dim"); return; }
        let y; try { y = parseYaml(yaml); } catch (e) { if (e instanceof YamlError) { lines(yamlTrace(e), "warn"); return; } throw e; }
        let goalV; try { goalV = populate("RotateAbsolute_Goal", { theta: "float32" }, y === null ? {} : y).theta; } catch (e) { line(`Failed to populate message fields: ${/has no attribute/.test(e.message) ? "AttributeError" : /convert|literal|dictionary|must be/.test(e.message) ? "ValueError" : "TypeError"}(${JSON.stringify(e.message)})`, "warn"); return; }
        const t = turtles.get(m[1]), goal = norm(goalV), fb = flag("--feedback") || flag("-f");
        line("Waiting for an action server to become available..."); line("Sending goal:"); line(`     theta: ${py(goalV)}`); line(""); line(`Goal accepted with ID: ${uuid()}`); line("");
        if (t.rot && t.rot.client) { log("WARN", "Rotation goal received before a previous goal finished. Aborting previous goal"); const r = t.rot; t.rot = null; r.done(false); }
        const start = t.th;
        t.rot = { goal, fb, start, lastFb: -1, client: true, done: (ok) => { line("Result:"); line(`    delta: ${ok ? f32(norm(start - t.th)) : "0.0"}`); line(""); line(`Goal finished with status: ${ok ? "SUCCEEDED" : "ABORTED"}`); if (fg && fg.goalOf === t) stopFg(false); } };
        startFg({ goalOf: t, stop: () => { if (t.rot && t.rot.client) { t.rot = null; line("Canceling goal..."); line("Goal canceled."); } } }, `ros2 action send_goal ${act}`);
        return;
      }
      line(`(ros2 action ${sub}: not in this mini terminal. Type help for what it knows.)`, "dim"); return;
    }
    if (verb === "run") {
      if (!sub || !rest[0]) { line("usage: ros2 run [-h] [--prefix PREFIX] package_name executable_name ...", "warn"); line(`ros2 run: error: the following arguments are required: ${sub ? "executable_name" : "package_name, executable_name"}`, "warn"); return; }
      if (!["turtlesim", "demo_nodes_cpp", "demo_nodes_py", "rqt_graph", "rviz2", "teleop_twist_keyboard", "examples_rclpy_minimal_publisher", "examples_rclcpp_minimal_publisher"].includes(sub)) { line(`Package '${sub}' not found`, "warn"); return; }
      if (sub === "turtlesim" && rest[0] === "turtle_teleop_key") {
        lines("Reading from keyboard\n---------------------------\nUse arrow keys to move the turtle.\nUse G|B|V|C|D|E|R|T keys to rotate to absolute orientations. 'F' to cancel a rotation.\n'Q' to quit.");
        line("(Keep this terminal selected and press the arrow keys. Ctrl+C or Q stops it.)", "dim");
        const KEYS = { ArrowUp: [2, 0], ArrowDown: [-2, 0], ArrowLeft: [0, 2], ArrowRight: [0, -2] }, ABS = { g: 0, t: 0.7854, r: 1.5708, e: 2.3562, d: 3.1416, c: -2.3562, v: -1.5708, b: -0.7854 };
        startFg({ teleop: true, stop: () => {}, keys: (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return false;   // Ctrl+C is the shell's, not a teleop key
          const k = e.key;
          if (KEYS[k]) { e.preventDefault(); drive("turtle1", { linear: { x: KEYS[k][0], y: 0, z: 0 }, angular: { x: 0, y: 0, z: KEYS[k][1] } }); return true; }
          const lk = k.toLowerCase();
          if (lk === "q") { e.preventDefault(); stopFg(false); return true; }
          if (lk in ABS && turtles.has("turtle1")) { e.preventDefault(); const t = turtles.get("turtle1"); t.rot = { goal: ABS[lk], fb: false, start: t.th, lastFb: -1, done: () => {} }; return true; }
          if (lk === "f") { e.preventDefault(); const t = turtles.get("turtle1"); if (t) t.rot = null; return true; }
          if (k.length === 1) { e.preventDefault(); return true; }   // other keys do nothing in teleop
          return false;
        } }, "ros2 run turtlesim turtle_teleop_key");
        return;
      }
      if (sub === "turtlesim" && rest[0] === "turtlesim_node") { line("(turtlesim is already running: it is the window on the left. A second one would open a second window, also called /turtlesim.)", "dim"); return; }
      if (sub === "turtlesim" && ["draw_square", "mimic", "turtlesim_node"].includes(rest[0])) { line(`(${rest[0]} is real, but this mini terminal runs only turtlesim_node and turtle_teleop_key.)`, "dim"); return; }
      if (sub === "turtlesim") { line("No executable found", "warn"); return; }
      line(`(ros2 run ${sub}: not in this mini terminal. The course's practice terminal runs it.)`, "dim"); return;
    }
    line(`(ros2 ${[verb, sub].filter(Boolean).join(" ")}: not in this mini terminal. Type help for what it knows.)`, "dim");
  }
  const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------------- simulation (turtlesim's Turtle::update)
  function clearTrail() { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.fillStyle = `rgb(${bg.join(",")})`; tctx.fillRect(0, 0, trail.width, trail.height); }
  const px = (x) => (x / W) * trail.width, pyc = (y) => trail.height - (y / W) * trail.height;
  function move(t, nx, ny) {
    let cx = nx, cy = ny, hit = false;
    if (cx < 0 || cx > W || cy < 0 || cy > W) { hit = true; cx = Math.max(0, Math.min(W, cx)); cy = Math.max(0, Math.min(W, cy)); }
    if (!t.pen.off) { tctx.strokeStyle = `rgb(${t.pen.c.join(",")})`; tctx.lineWidth = t.pen.w * (trail.width / 500); tctx.lineCap = "round"; tctx.beginPath(); tctx.moveTo(px(t.x), pyc(t.y)); tctx.lineTo(px(cx), pyc(cy)); tctx.stroke(); }
    t.x = cx; t.y = cy;
    if (hit && !t.wallWarned) { log("WARN", `Oh no! I hit the wall! (Clamping from [x=${nx.toFixed(6)}, y=${ny.toFixed(6)}])`); t.wallWarned = true; }
    if (!hit) t.wallWarned = false;
  }
  function step() {
    simT += DT;
    for (const t of turtles.values()) {
      if (t.rot) {   // RotateAbsolute: turn at 1 rad/s towards the goal (turtlesim's action server)
        const rem = norm(t.rot.goal - t.th);
        if (t.rot.fb && simT - t.rot.lastFb > 0.5) { t.rot.lastFb = simT; line("Feedback:"); line(`    remaining: ${f32(rem)}`); line(""); }
        if (Math.abs(rem) < 0.02) { t.th = norm(t.rot.goal); const r = t.rot; t.rot = null; r.done(true); }
        else t.th = norm(t.th + Math.sign(rem) * Math.min(Math.abs(rem), 1.0 * DT));
        continue;
      }
      if (simT - t.last > 1.0) continue;   // turtlesim stops a turtle 1 s after its last cmd_vel
      const th = t.th + t.ang * DT;
      const nx = t.x + Math.cos(th) * t.lin[0] * DT - Math.sin(th) * t.lin[1] * DT, ny = t.y + Math.sin(th) * t.lin[0] * DT + Math.cos(th) * t.lin[1] * DT;
      if (t.name === "turtle1" && t.lin[0]) { turnAcc += t.ang * DT; if (Math.abs(turnAcc) >= Math.PI * 2 - 0.05) missions.circle = true; }
      t.th = norm(th); move(t, nx, ny);
      // the star counts only when a turtle drives onto it (cmd_vel or teleop), not when it is teleported or spawned there
      if (!missions.star && Math.hypot(t.x - STAR.x, t.y - STAR.y) < 0.6) missions.star = true;
    }
  }
  let lastKey = "";
  function draw() {
    const S = canvas.width; ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(trail, 0, 0, S, S);
    const k = S / W;
    if (!missions.star) {   // the mission star
      ctx.save(); ctx.translate(STAR.x * k, S - STAR.y * k); if (!still) ctx.rotate(simT * 0.6);
      ctx.fillStyle = "#FFD44D"; ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = S / 400; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = (i % 2 ? 0.16 : 0.38) * k, a = (i / 10) * Math.PI * 2 - Math.PI / 2; i ? ctx.lineTo(r * Math.cos(a), r * Math.sin(a)) : ctx.moveTo(r * Math.cos(a), r * Math.sin(a)); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    for (const t of turtles.values()) { ctx.save(); ctx.translate(t.x * k, S - t.y * k); ctx.rotate(-t.th); drawTurtle(ctx, 1.1 * k, t.hue); ctx.restore(); }
    const key = Object.entries(missions).map(([a, b]) => a + b).join();
    if (key !== lastKey) { lastKey = key; paintMissions(); if (Object.values(missions).every(Boolean)) line("All four missions done: you used a topic, a service and an action, as in Week 4 of the course.", "ok"); }
  }
  let acc = 0, prev = 0, visible = true, raf = 0, still = reduced();
  if (typeof matchMedia === "function") matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", (e) => { still = e.matches; wake(); });
  function frame(now) {
    raf = 0;
    if (!prev) prev = now;
    acc += Math.min(0.1, (now - prev) / 1000); prev = now;
    while (acc >= DT) { step(); acc -= DT; }
    draw();
    // with reduced motion the star stands still, so an idle turtlesim needs no frames until something moves
    const busy = !still || [...turtles.values()].some((t) => t.rot || simT - t.last <= 1.05);
    if (visible && busy) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && visible) { prev = 0; raf = requestAnimationFrame(frame); } };
  // a sharp canvas on every screen
  const fit = () => { const d = Math.min(2, window.devicePixelRatio || 1), w = Math.round((canvas.clientWidth || 300) * d); if (w > 40 && canvas.width !== w) { canvas.width = canvas.height = w; } draw(); };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(fit).observe(canvas);
  reset(); log("INFO", "Starting turtlesim with node name /turtlesim"); log("INFO", `Spawning turtle [turtle1] at x=[${HOME.toFixed(6)}], y=[${HOME.toFixed(6)}], theta=[0.000000]`);
  line("Type help, or tap a button. Everything you type here works the same on Ubuntu with ROS 2 Jazzy.", "dim");
  fit();
  if (typeof IntersectionObserver !== "undefined") new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) wake(); }, { threshold: 0.01 }).observe(host);
  wake();

  // ---------------- typing, history, completion
  let typing = Promise.resolve(), touched = false;
  const type = (cmd) => (typing = typing.then(() => new Promise((res) => {
    stopFg(false);
    if (reduced()) { input.value = cmd; return res(); }
    input.value = ""; let i = 0;
    const tick = () => { i = Math.min(cmd.length, i + 3); input.value = cmd.slice(0, i); if (i < cmd.length) setTimeout(tick, 12); else setTimeout(res, 120); };
    tick();
  })).then(() => submit()));
  function submit() {
    const v = input.value; input.value = "";
    line(`student@ros2lab:~$ ${v}`, "cmd");
    if (v.trim()) { history.push(v); hpos = history.length; }
    try { run(v); } catch (e) { line(String(e.message || e), "warn"); }
    wake();
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); touched = true; if (fg) { if (input.value.trim()) line("(A command is still running. Ctrl+C or Esc stops it first.)", "dim"); input.value = ""; return; } submit(); });
  const WORDS = () => ["ros2", "topic", "service", "node", "param", "action", "interface", "run", "list", "info", "echo", "pub", "hz", "call", "send_goal", "show", "get", "set", "dump", "type", "turtlesim", "turtle_teleop_key", "--once", "--feedback", "geometry_msgs/msg/Twist", "turtlesim/srv/Spawn", "turtlesim/srv/SetPen", "turtlesim/srv/Kill", "turtlesim/srv/TeleportAbsolute", "std_srvs/srv/Empty", "turtlesim/action/RotateAbsolute", "turtlesim/msg/Pose", "/turtlesim", "background_r", "background_g", "background_b", ...TOPICS(), ...SERVICES(), ...[...turtles.keys()].map((n) => `/${n}/rotate_absolute`)];
  input.addEventListener("focus", () => { touched = true; });
  input.addEventListener("keydown", (e) => {
    touched = true;
    if (fg && fg.keys && fg.keys(e)) return;
    if ((e.key === "c" && e.ctrlKey) || e.key === "Escape") { if (fg) { e.preventDefault(); stopFg(true); } return; }
    if (e.key === "ArrowUp" && !fg) { if (hpos > 0) { hpos--; input.value = history[hpos]; } e.preventDefault(); }
    else if (e.key === "ArrowDown" && !fg) { if (hpos < history.length) hpos++; input.value = history[hpos] || ""; e.preventDefault(); }
    else if (e.key === "Tab") {
      e.preventDefault();
      const v = input.value, m = v.match(/(\S*)$/), part = m[1], opts = [...new Set(WORDS())].filter((w) => w.startsWith(part) && w !== part);
      if (opts.length === 1) input.value = v.slice(0, v.length - part.length) + opts[0] + " ";
      else if (opts.length > 1) { let p = opts[0]; for (const o of opts) while (!o.startsWith(p)) p = p.slice(0, -1); if (p.length > part.length) input.value = v.slice(0, v.length - part.length) + p; else lines(opts.slice(0, 24).join("   "), "dim"); }
    }
  });

  // ---------------- buttons
  const PUB = (x, z, n = "turtle1") => `ros2 topic pub --once /${n}/cmd_vel geometry_msgs/msg/Twist "{linear: {x: ${py(x)}}, angular: {z: ${py(z)}}}"`;
  const DEMOS = [
    ["Drive forward", [PUB(2, 0)]],
    ["Draw a circle", [PUB(2, 1.8), PUB(2, 1.8), PUB(2, 1.8), PUB(2, 1.8)]],
    ["Draw a square", [PUB(2, 0), PUB(0, 1.5708), PUB(2, 0), PUB(0, 1.5708), PUB(2, 0), PUB(0, 1.5708), PUB(2, 0), PUB(0, 1.5708)]],
    ["Spawn turtle2", [`ros2 service call /spawn turtlesim/srv/Spawn "{x: 2.0, y: 2.0, theta: 0.0, name: 'turtle2'}"`]],
    ["Red pen", [`ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 230, g: 60, b: 70, width: 5, 'off': 0}"`]],
    ["Turn with an action", [`ros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute "{theta: 1.57}" --feedback`]],
    ["Drive with arrow keys", ["ros2 run turtlesim turtle_teleop_key"]],
    ["Where is it?", ["ros2 topic echo /turtle1/pose --once"]],
    ["Reset", ["ros2 service call /reset std_srvs/srv/Empty"]],
  ];
  const queue = (cmds) => { touched = true; for (const c of cmds) { type(c); typing = typing.then(() => new Promise((r) => setTimeout(r, /cmd_vel/.test(c) ? 1050 : 150))); } typing.then(() => input.focus({ preventScroll: true })); };
  chips.replaceChildren(...DEMOS.map(([label, cmds]) => el("button", { type: "button", class: "ht2-chip", text: label, onclick: () => queue(cmds) })));
  // when the hero is first seen and nobody has touched it yet: one circle, typed out
  if (typeof IntersectionObserver !== "undefined" && !reduced()) {
    const io = new IntersectionObserver((e) => { if (!e[0].isIntersecting || e[0].intersectionRatio < 0.4) return; io.disconnect(); setTimeout(() => { if (!touched) queue(DEMOS[1][1].slice(0, 2)); }, 900); }, { threshold: [0, 0.4] });
    io.observe(host);
  }
  return { run: (c) => type(c), turtles, missions };
}
