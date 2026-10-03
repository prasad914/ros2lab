// A pretend running ROS 2 system for the practice terminal: nodes, topics, services,
// parameters, actions, bags and workspace packages. Outputs follow the official ROS 2 Jazzy tutorials.
// Used by terminal-sim.js when a lesson's terminal block has "running": [...] (or "graph": true).

const HOME = "/home/student";
const fnum = (n) => (Number.isInteger(n) ? `${n}.0` : String(+n.toFixed(6)));
const hex = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const IFACES = {
  "geometry_msgs/msg/Twist": "# This expresses velocity in free space broken into its linear and angular parts.\n\nVector3  linear\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z\nVector3  angular\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z",
  "turtlesim/msg/Pose": "float32 x\nfloat32 y\nfloat32 theta\n\nfloat32 linear_velocity\nfloat32 angular_velocity",
  "turtlesim/msg/Color": "uint8 r\nuint8 g\nuint8 b",
  "std_msgs/msg/String": "# This was originally provided as an example message.\n# It is deprecated as of Foxy\n# It is recommended to create your own semantically meaningful message.\n# However if you would like to continue using this please use the equivalent in example_msgs.\n\nstring data",
  "turtlesim/srv/Spawn": "float32 x\nfloat32 y\nfloat32 theta\nstring name # Optional.  A unique name will be created and returned if this is empty\n---\nstring name",
  "turtlesim/srv/Kill": "string name\n---",
  "turtlesim/srv/SetPen": "uint8 r\nuint8 g\nuint8 b\nuint8 width\nuint8 off\n---",
  "turtlesim/srv/TeleportAbsolute": "float32 x\nfloat32 y\nfloat32 theta\n---",
  "turtlesim/srv/TeleportRelative": "float32 linear\nfloat32 angular\n---",
  "std_srvs/srv/Empty": "---",
  "example_interfaces/srv/AddTwoInts": "int64 a\nint64 b\n---\nint64 sum",
  "turtlesim/action/RotateAbsolute": "# The desired heading in radians\nfloat32 theta\n---\n# The angular displacement in radians to the starting position\nfloat32 delta\n---\n# The remaining rotation in radians\nfloat32 remaining",
  "rcl_interfaces/msg/Log": "##\n## Severity level constants\n##\nuint8 DEBUG=10\nuint8 INFO=20\nuint8 WARN=30\nuint8 ERROR=40\nuint8 FATAL=50\n\nbuiltin_interfaces/Time stamp\nuint8 level\nstring name\nstring msg\nstring file\nstring function\nuint32 line",
};
const PARAM_SRVS = [["describe_parameters", "DescribeParameters"], ["get_parameter_types", "GetParameterTypes"], ["get_parameters", "GetParameters"],
  ["list_parameters", "ListParameters"], ["set_parameters", "SetParameters"], ["set_parameters_atomically", "SetParametersAtomically"]];
const QOS = ["qos_overrides./parameter_events.publisher.depth", "qos_overrides./parameter_events.publisher.durability",
  "qos_overrides./parameter_events.publisher.history", "qos_overrides./parameter_events.publisher.reliability"];

// package + executable -> kind of node it starts
const EXES = {
  "turtlesim turtlesim_node": "turtlesim", "turtlesim turtle_teleop_key": "teleop",
  "demo_nodes_py talker": "talker", "demo_nodes_cpp talker": "talker", "demo_nodes_py listener": "listener", "demo_nodes_cpp listener": "listener",
  "demo_nodes_py add_two_ints_server": "adder", "demo_nodes_cpp add_two_ints_server": "adder",
  "turtlesim mimic": "mimic",
};
const DEFAULT_NAME = { turtlesim: "turtlesim", teleop: "teleop_turtle", talker: "talker", listener: "listener", adder: "add_two_ints_server", mimic: "mimic" };
const PKG_EXES = {
  turtlesim: ["draw_square", "mimic", "turtle_teleop_key", "turtlesim_node"],
  demo_nodes_py: ["add_two_ints_client", "add_two_ints_server", "listener", "listener_qos", "talker", "talker_qos"],
  demo_nodes_cpp: ["add_two_ints_client", "add_two_ints_server", "listener", "talker"],
};

const PEN = () => ({ r: 179, g: 184, b: 255, width: 3, off: 0 });
const newTurtle = (name, x, y, theta) => ({ name, x, y, theta, pen: PEN(), trail: [] });

export class RosGraph {
  constructor(sh, running = []) {
    this.sh = sh;
    this.nodes = [];
    this.bags = {};
    this.lastTwist = null;
    for (const r of running) {
      const kind = typeof r === "string" ? r : r.kind;
      this.add(kind, typeof r === "object" && r.name ? r.name : DEFAULT_NAME[kind], typeof r === "object" && r.ns ? r.ns : "");
    }
  }
  out(t, c) { return this.sh.out(t, c); } err(t) { return this.sh.err(t); } hint(t) { return this.sh.hint(t); }
  lines(text, cls) { return String(text).split("\n").map((t) => this.out(t, cls)); }

  add(kind, name, ns = "", params = {}, remaps = []) {
    const n = { kind, name, ns: ns && ns !== "/" ? "/" + ns.replace(/^\/+|\/+$/g, "") : "", params: {}, remaps };
    n.full = `${n.ns}/${name}`;
    if (kind === "turtlesim") { n.turtles = [newTurtle("turtle1", 5.544445, 5.544445, 0)]; n.params = { background_b: 255, background_g: 86, background_r: 69 }; }
    if (kind === "teleop") n.params = { scale_angular: 2.0, scale_linear: 2.0 };
    if (kind === "turtlesim" || kind === "teleop") QOS.forEach((q, i) => { n.params[q] = [1000, "volatile", "keep_last", "reliable"][i]; });
    n.params.use_sim_time = false;
    for (const [k, v] of Object.entries(params)) if (k in n.params || kind === "custom") n.params[k] = v;
    this.nodes = this.nodes.filter((x) => x.full !== n.full);
    this.nodes.push(n);
    return n;
  }
  node(full) { return this.nodes.find((n) => n.full === full || n.full === "/" + full); }
  has(full) { return !!this.node(full); }
  turtle(name) { for (const n of this.nodes) for (const t of n.turtles || []) if (`${n.ns}/${t.name}` === name || t.name === name) return { n, t }; return null; }

  // ---------- the ROS graph, computed from the running nodes ----------
  endpoints(n) {
    const p = (s) => `${n.ns}/${s}`;
    const e = { pubs: [["/parameter_events", "rcl_interfaces/msg/ParameterEvent"], ["/rosout", "rcl_interfaces/msg/Log"]], subs: [["/parameter_events", "rcl_interfaces/msg/ParameterEvent"]],
      srvs: PARAM_SRVS.map(([s, t]) => [`${n.full}/${s}`, `rcl_interfaces/srv/${t}`]), cli: [], acts: [], actc: [] };
    if (n.kind === "turtlesim") {
      e.srvs.push([p("clear"), "std_srvs/srv/Empty"], [p("kill"), "turtlesim/srv/Kill"], [p("reset"), "std_srvs/srv/Empty"], [p("spawn"), "turtlesim/srv/Spawn"]);
      for (const t of n.turtles) {
        e.subs.push([p(`${t.name}/cmd_vel`), "geometry_msgs/msg/Twist"]);
        e.pubs.push([p(`${t.name}/color_sensor`), "turtlesim/msg/Color"], [p(`${t.name}/pose`), "turtlesim/msg/Pose"]);
        e.srvs.push([p(`${t.name}/set_pen`), "turtlesim/srv/SetPen"], [p(`${t.name}/teleport_absolute`), "turtlesim/srv/TeleportAbsolute"], [p(`${t.name}/teleport_relative`), "turtlesim/srv/TeleportRelative"]);
        e.acts.push([p(`${t.name}/rotate_absolute`), "turtlesim/action/RotateAbsolute"]);
      }
    }
    if (n.kind === "teleop") { e.pubs.push([p("turtle1/cmd_vel"), "geometry_msgs/msg/Twist"]); e.actc.push([p("turtle1/rotate_absolute"), "turtlesim/action/RotateAbsolute"]); }
    if (n.kind === "talker") e.pubs.push([p("chatter"), "std_msgs/msg/String"]);
    if (n.kind === "listener") e.subs.push([p("chatter"), "std_msgs/msg/String"]);
    if (n.kind === "adder") e.srvs.push([p("add_two_ints"), "example_interfaces/srv/AddTwoInts"]);
    if (n.kind === "mimic") { e.subs.push([p("input/pose"), "turtlesim/msg/Pose"]); e.pubs.push([p("output/cmd_vel"), "geometry_msgs/msg/Twist"]); }
    if (n.remaps && n.remaps.length) {
      const res = (x) => (x.startsWith("/") ? x : `${n.ns}/${x}`);
      for (const k of Object.keys(e)) e[k] = e[k].map(([nm, t]) => { const r = n.remaps.find(([f]) => res(f) === nm); return [r ? res(r[1]) : nm, t]; });
    }
    for (const k of Object.keys(e)) e[k].sort((a, b) => a[0].localeCompare(b[0]));
    return e;
  }
  collect(kinds) {
    const m = new Map();
    for (const n of this.nodes) { const e = this.endpoints(n); for (const k of kinds) for (const [name, type] of e[k]) { if (!m.has(name)) m.set(name, { type, by: { pubs: [], subs: [], srvs: [], cli: [], acts: [], actc: [] } }); m.get(name).by[k].push(n.full); } }
    return new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }
  topics() { const t = this.collect(["pubs", "subs"]); if (this.lastPub && !t.has(this.lastPub.topic)) t.set(this.lastPub.topic, { type: this.lastPub.type, by: { pubs: [], subs: [] } }); return t; }

  // ---------- ros2 <sub> ... ----------
  run(args) {
    const [sub, a] = args;
    const rest = args.slice(2);
    switch (sub) {
      case "node": return this.cmdNode(a, rest);
      case "topic": return this.cmdTopic(a, rest);
      case "service": return this.cmdService(a, rest);
      case "param": return this.cmdParam(a, rest);
      case "action": return this.cmdAction(a, rest);
      case "interface": return this.cmdInterface(a, rest);
      case "bag": return this.cmdBag(a, rest);
      case "doctor": return [this.out("All 5 checks passed")];
      case "daemon": {
        if (a === "stop") { this.daemonOff = true; return [this.out("The daemon has been stopped")]; }
        if (a === "start") { const was = this.daemonOff; this.daemonOff = false; return [this.out(was ? "The daemon has been started" : "The daemon is already running")]; }
        if (a === "status") return [this.out(this.daemonOff ? "The daemon is not running" : "The daemon is running")];
        return [this.err("usage: ros2 daemon start | stop | status")];
      }
      default: return null;
    }
  }
  noNodes() { return [this.hint("(No nodes are running. Start one first, for example: ros2 run turtlesim turtlesim_node)")]; }

  cmdNode(a, rest) {
    if (a === "list") return this.nodes.length ? this.nodes.map((n) => n.full).sort().map((t) => this.out(t)) : this.noNodes();
    if (a === "info") {
      const n = this.node(rest[0] || "");
      if (!rest[0]) return [this.err("usage: ros2 node info <node_name>")];
      if (!n) return [this.err(`Unable to find node '${rest[0]}'`), this.hint("Node names start with /. See them with: ros2 node list")];
      const e = this.endpoints(n);
      const sec = (title, list) => [this.out(`  ${title}:`), ...list.map(([x, t]) => this.out(`    ${x}: ${t}`))];
      return [this.out(n.full), ...sec("Subscribers", e.subs), ...sec("Publishers", e.pubs), ...sec("Service Servers", e.srvs), ...sec("Service Clients", e.cli), ...sec("Action Servers", e.acts), ...sec("Action Clients", e.actc)];
    }
    return [this.err("usage: ros2 node list | ros2 node info <node_name>")];
  }

  cmdTopic(a, rest) {
    const T = this.topics();
    const flags = rest.filter((x) => x.startsWith("-"));
    const pos = rest.filter((x) => !x.startsWith("-"));
    const showT = flags.includes("-t") || rest.includes("--show-types");
    if (a === "list") return [...T.entries()].map(([k, v]) => this.out(showT ? `${k} [${v.type}]` : k));
    const name = pos[0];
    const need = () => (name ? null : [this.err(`usage: ros2 topic ${a} <topic_name>`)]);
    if (a === "find") { const hits = [...T.entries()].filter(([, v]) => v.type === name).map(([k]) => this.out(k)); return hits; }
    if (a === "pub") return this.topicPub(rest);
    const bad = need(); if (bad) return bad;
    const t = T.get(name);
    if (!t) return [this.out(`WARNING: topic [${name}] does not appear to be published yet`), this.hint(`Nobody uses ${name}. Check the spelling (names are case-sensitive) with: ros2 topic list`)];
    if (a === "type") return [this.out(t.type)];
    if (a === "info" && (flags.includes("-v") || flags.includes("--verbose"))) {
      const L = [`Type: ${t.type}`, "", `Publisher count: ${t.by.pubs.length}`, ""];
      const ep = (who, kind) => { const nm = who.split("/").pop(), ns = who.slice(0, who.length - nm.length - 1) || "/";
        L.push(`Node name: ${nm}`, `Node namespace: ${ns}`, `Topic type: ${t.type}`, "Topic type hash: RIHS01_…", `Endpoint type: ${kind}`, `GID: ${hex().match(/../g).slice(0, 16).join(".")}`,
          "QoS profile:", "  Reliability: RELIABLE", "  History (Depth): UNKNOWN", "  Durability: VOLATILE", "  Lifespan: Infinite", "  Deadline: Infinite", "  Liveliness: AUTOMATIC", "  Liveliness lease duration: Infinite", ""); };
      t.by.pubs.forEach((w) => ep(w, "PUBLISHER"));
      L.push(`Subscription count: ${t.by.subs.length}`, "");
      t.by.subs.forEach((w) => ep(w, "SUBSCRIPTION"));
      return L.map((x) => this.out(x));
    }
    if (a === "info") return [this.out(`Type: ${t.type}`), this.out(`Publisher count: ${t.by.pubs.length}`), this.out(`Subscription count: ${t.by.subs.length}`)];
    if (a === "hz") {
      if (!t.by.pubs.length) return [this.out(`WARNING: topic [${name}] does not appear to be published yet`)];
      const rate = /pose|color_sensor/.test(name) ? 62.5 : name.endsWith("chatter") ? 1 : null;
      if (!rate) return [this.hint(`(Nothing is published on ${name} right now, so there is no rate to measure.)`)];
      const lines = [0, 1].map((i) => `average rate: ${(rate + (i ? 0.004 : -0.002)).toFixed(3)}\n\tmin: ${(1 / rate - 0.001).toFixed(3)}s max: ${(1 / rate + 0.001).toFixed(3)}s std dev: 0.00041s window: ${Math.round(rate * (i + 1))}`).join("\n");
      return [...this.lines(lines), this.out("^C"), this.hint(`About ${rate} messages per second. On a real computer it keeps measuring until you press Ctrl+C.`)];
    }
    if (a === "echo") {
      const once = rest.includes("--once");
      const msgs = this.samples(name, t);
      if (!msgs) return [this.hint(`(Nobody is publishing on ${name} right now, so echo just waits. ${name.endsWith("cmd_vel") ? "Drive the turtle: press arrow keys in the teleop window, or publish with ros2 topic pub." : ""})`), this.out("^C")];
      const n = once ? 1 : msgs.length;
      return [...msgs.slice(0, n).flatMap((m) => this.lines(m + "\n---")), ...(once ? [] : [this.out("^C"), this.hint("Practice terminal stopped echo for you. On a real computer it keeps printing until you press Ctrl+C.")])];
    }
    return [this.err(`ros2 topic: unknown command '${a}'`), this.hint("Try: list, echo, info, type, hz, pub, find")];
  }
  samples(name, t) {
    if (t.type === "turtlesim/msg/Pose") { const hit = this.turtle(name.replace(/\/pose$/, "")); if (!hit) return null; const p = hit.t; return [0, 1, 2].map(() => `x: ${fnum(p.x)}\ny: ${fnum(p.y)}\ntheta: ${fnum(p.theta)}\nlinear_velocity: 0.0\nangular_velocity: 0.0`); }
    if (t.type === "turtlesim/msg/Color") { const hit = this.turtle(name.replace(/\/color_sensor$/, "")); const P = hit ? hit.n.params : { background_r: 69, background_g: 86, background_b: 255 }; return [0, 1, 2].map(() => `r: ${P.background_r}\ng: ${P.background_g}\nb: ${P.background_b}`); }
    if (t.type === "std_msgs/msg/String" && t.by.pubs.length) { this.chat = (this.chat || 0) + 3; return [3, 2, 1].map((k) => `data: 'Hello World: ${this.chat - k}'`); }
    if (t.type === "geometry_msgs/msg/Twist" && this.lastTwist && this.lastTwist.topic === name) { const v = this.lastTwist; return [0, 1, 2].map(() => `linear:\n  x: ${fnum(v.lx)}\n  y: 0.0\n  z: 0.0\nangular:\n  x: 0.0\n  y: 0.0\n  z: ${fnum(v.az)}`); }
    if (name === "/rosout" && this.nodes.length) return [`stamp:\n  sec: 1727860000\n  nanosec: 0\nlevel: 20\nname: ${this.nodes[0].name}\nmsg: Starting ${this.nodes[0].name}`];
    return null;
  }
  num(yaml, key, dflt = 0) { const m = String(yaml).match(new RegExp(`(?:^|[{,\\s])${key}:\\s*(-?[\\d.]+(?:e-?\\d+)?)`)); return m ? Number(m[1]) : dflt; }
  str(yaml, key) { const m = String(yaml).match(new RegExp(`${key}:\\s*['"]?([^'",}]*)['"]?`)); return m ? m[1].trim() : ""; }

  topicPub(rest) {
    const once = rest.some((x) => x === "--once" || x === "-1");
    const pos = [];
    for (let i = 0; i < rest.length; i++) { const x = rest[i]; if (/^(-r|--rate|-t|--times|-w|--wait-matching-subscriptions)$/.test(x)) { i++; continue; } if (!x.startsWith("-")) pos.push(x); }
    const [topic, type, yaml = "{}"] = pos;
    if (!topic || !type) return [this.err("usage: ros2 topic pub <topic_name> <message_type> '<values>'")];
    const full = type.includes("/msg/") ? type : type.replace("/", "/msg/");
    if (!IFACES[full] || !/msg/.test(full)) return [this.err(`The passed message type is invalid`), this.hint("Message types look like geometry_msgs/msg/Twist or std_msgs/msg/String.")];
    const T = this.topics().get(topic);
    if (T && T.type !== full) return [this.err(`Error: topic ${topic} has type ${T.type}, not ${full}`), this.hint(`Check the type with: ros2 topic type ${topic}`)];
    this.lastPub = { topic, type: full };
    let repr = "";
    if (full === "geometry_msgs/msg/Twist") {
      const lin = (String(yaml).match(/linear:\s*\{([^}]*)\}/) || [, ""])[1], ang = (String(yaml).match(/angular:\s*\{([^}]*)\}/) || [, ""])[1];
      const v = { lx: this.num(lin, "x"), ly: this.num(lin, "y"), az: this.num(ang, "z"), topic };
      this.lastTwist = v;
      repr = `geometry_msgs.msg.Twist(linear=geometry_msgs.msg.Vector3(x=${fnum(v.lx)}, y=${fnum(v.ly)}, z=0.0), angular=geometry_msgs.msg.Vector3(x=0.0, y=0.0, z=${fnum(v.az)}))`;
      const hit = this.turtle(topic.replace(/\/cmd_vel$/, ""));
      if (hit && topic.endsWith("/cmd_vel")) this.move(hit.t, v.lx, v.az, once ? 1 : 3);
    } else if (full === "std_msgs/msg/String") repr = `std_msgs.msg.String(data='${this.str(yaml, "data")}')`;
    else repr = `${full.replace(/\//g, ".")}()`;
    const L = [this.out("publisher: beginning loop")];
    for (let i = 1; i <= (once ? 1 : 3); i++) L.push(this.out(`publishing #${i}: ${repr}`), this.out(""));
    if (!once) L.push(this.out("^C"), this.hint("Practice terminal stopped after 3 messages. On a real computer, ros2 topic pub keeps publishing once per second until Ctrl+C. Use --once to send just one."));
    const hit = this.turtle(topic.replace(/\/cmd_vel$/, ""));
    if (hit) { const t = hit.t; L.push(this.hint(`(The turtle moved. ${t.name} is now at x=${t.x.toFixed(2)}, y=${t.y.toFixed(2)}, facing ${t.theta.toFixed(2)} rad. Check with: ros2 topic echo --once ${hit.n.ns}/${t.name}/pose)`)); }
    else if (T && !T.by.subs.length) L.push(this.hint(`(Nobody subscribes to ${topic}, so nobody hears these messages.)`));
    else if (!T) L.push(this.hint(`(${topic} is a brand-new topic that nobody listens to. Was that a typo?)`));
    return L;
  }
  // drawing: each segment remembers the pen it was drawn with
  draw(t, pts) {
    if (!t.pen || t.pen.off) return;
    t.trail = t.trail || [];
    t.trail.push({ pts, r: t.pen.r, g: t.pen.g, b: t.pen.b, width: t.pen.width || 3 });
    if (t.trail.length > 400) t.trail.shift();
    this.version = (this.version || 0) + 1;
  }
  move(t, v, w, secs) {
    const pts = [[t.x, t.y]];
    let hit = null;
    for (let s = 0; s < secs * 20; s++) {
      t.theta += w / 20; t.x += Math.cos(t.theta) * v / 20; t.y += Math.sin(t.theta) * v / 20;
      if (!hit && (t.x < 0 || t.y < 0 || t.x > 11.088889 || t.y > 11.088889)) hit = `[WARN] [turtlesim]: Oh no! I hit the wall! (Clamping from [x=${t.x.toFixed(6)}, y=${t.y.toFixed(6)}])`;
      t.x = Math.min(11.088889, Math.max(0, t.x)); t.y = Math.min(11.088889, Math.max(0, t.y));
      pts.push([t.x, t.y]);
    }
    if (hit) { const owner = this.nodes.find((n) => (n.turtles || []).includes(t)); (this.notices = this.notices || []).push({ node: owner ? owner.full : "", text: owner ? hit.replace("[turtlesim]", `[${owner.name}]`) : hit }); }
    if (v) this.draw(t, pts);
    this.version = (this.version || 0) + 1;
    t.x = +Math.min(11.088889, Math.max(0, t.x)).toFixed(6); t.y = +Math.min(11.088889, Math.max(0, t.y)).toFixed(6);
    t.theta = +Math.atan2(Math.sin(t.theta), Math.cos(t.theta)).toFixed(6);
  }

  cmdService(a, rest) {
    const S = this.collect(["srvs"]);
    const showT = rest.includes("-t") || rest.includes("--show-types");
    const pos = rest.filter((x) => !x.startsWith("-"));
    if (a === "list") return S.size ? [...S.entries()].map(([k, v]) => this.out(showT ? `${k} [${v.type}]` : k)) : this.noNodes();
    if (a === "find") return [...S.entries()].filter(([, v]) => v.type === pos[0]).map(([k]) => this.out(k));
    const name = pos[0];
    if (!name) return [this.err(`usage: ros2 service ${a || "list"} <service_name>`)];
    const s = S.get(name);
    if (a === "type") return s ? [this.out(s.type)] : [this.err(`Unable to find service '${name}'`)];
    if (a === "info") return s ? [this.out(`Type: ${s.type}`), this.out("Clients count: 0"), this.out(`Services count: ${s.by.srvs.length}`)] : [this.err(`Unable to find service '${name}'`)];
    if (a !== "call") return [this.err(`ros2 service: unknown command '${a}'`), this.hint("Try: list, type, find, info, call")];
    const type = pos[1], yaml = pos.slice(2).join(" ") || "{}";
    if (!type) return [this.err("usage: ros2 service call <service_name> <service_type> [values]"), this.hint(s ? `This service's type is ${s.type}` : "Find the type with: ros2 service type <service_name>")];
    if (!s) return [this.out("waiting for service to become available..."), this.out("^C"), this.hint(`Nobody offers ${name}, so the call waits forever. Check the name with: ros2 service list`)];
    if (s.type !== type) return [this.err(`The passed service type is invalid`), this.hint(`${name} has type ${s.type}`)];
    const owner = this.node(s.by.srvs[0]);
    const pyT = type.replace("/srv/", ".srv.").replace(/\//g, ".");
    const req = (fields) => `requester: making request: ${pyT}_Request(${fields})`;
    const res = (fields) => [this.out(""), this.out("response:"), this.out(`${pyT}_Response(${fields})`), this.out("")];
    const base = name.split("/").pop();
    if (base === "spawn") {
      const x = this.num(yaml, "x"), y = this.num(yaml, "y"), th = this.num(yaml, "theta");
      let nm = this.str(yaml, "name");
      if (nm && owner.turtles.some((t) => t.name === nm)) return [this.out(req(`x=${fnum(x)}, y=${fnum(y)}, theta=${fnum(th)}, name='${nm}'`)), this.err(`[ERROR] [${owner.name}]: A turtle named [${nm}] already exists`)];
      if (!nm) { let k = 2; while (owner.turtles.some((t) => t.name === `turtle${k}`)) k++; nm = `turtle${k}`; }
      owner.turtles.push(newTurtle(nm, x, y, th));
      return [this.out(req(`x=${fnum(x)}, y=${fnum(y)}, theta=${fnum(th)}, name='${this.str(yaml, "name")}'`)), ...res(`name='${nm}'`), this.hint(`(A new turtle, ${nm}, appeared. It brings its own topics: see ros2 topic list)`)];
    }
    if (base === "kill") { const nm = this.str(yaml, "name"); const i = owner.turtles.findIndex((t) => t.name === nm); if (i < 0) return [this.out(req(`name='${nm}'`)), this.err(`[ERROR] [${owner.name}]: Tried to kill turtle [${nm}], which does not exist`)]; owner.turtles.splice(i, 1); return [this.out(req(`name='${nm}'`)), ...res("")]; }
    if (base === "reset") { owner.turtles = [newTurtle("turtle1", 5.544445, 5.544445, 0)]; return [this.out(req("")), ...res(""), this.hint("(Every turtle was removed and turtle1 was put back in the middle.)")]; }
    if (base === "clear") { owner.turtles.forEach((t) => { t.trail = []; }); this.version = (this.version || 0) + 1; return [this.out(req("")), ...res(""), this.hint("(The turtle's drawn lines were wiped away.)")]; }
    if (base === "add_two_ints") { const A = Math.trunc(this.num(yaml, "a")), B = Math.trunc(this.num(yaml, "b")); return [this.out(req(`a=${A}, b=${B}`)), ...res(`sum=${A + B}`)]; }
    if (base === "teleport_absolute") { const hit = this.turtle(name.replace(/\/teleport_absolute$/, "")); const x = this.num(yaml, "x"), y = this.num(yaml, "y"), th = this.num(yaml, "theta"); this.draw(hit.t, [[hit.t.x, hit.t.y], [x, y]]); Object.assign(hit.t, { x, y, theta: th }); return [this.out(req(`x=${fnum(x)}, y=${fnum(y)}, theta=${fnum(th)}`)), ...res("")]; }
    if (base === "set_pen") {
      const hit = this.turtle(name.replace(/\/set_pen$/, ""));
      if (hit) hit.t.pen = { r: Math.trunc(this.num(yaml, "r")), g: Math.trunc(this.num(yaml, "g")), b: Math.trunc(this.num(yaml, "b")), width: Math.trunc(this.num(yaml, "width", 3)) || 1, off: Math.trunc(this.num(yaml, "off")) };
      const f = ["r", "g", "b", "width", "off"].map((k) => `${k}=${Math.trunc(this.num(yaml, k))}`).join(", "); return [this.out(req(f)), ...res("")]; }
    if (base.endsWith("parameters") || base.endsWith("parameter_types")) return [this.hint("(Parameter services are easier to use through ros2 param list / get / set.)")];
    return [this.out(req("")), ...res("")];
  }

  cmdParam(a, rest) {
    const pos = rest.filter((x) => !x.startsWith("--"));
    const fmtVal = (v) => (typeof v === "boolean" ? ["Boolean", v ? "True" : "False"] : typeof v === "string" ? ["String", v] : Number.isInteger(v) ? ["Integer", v] : ["Double", fnum(v)]);
    if (a === "list") {
      const list = pos[0] ? [this.node(pos[0])].filter(Boolean) : this.nodes.slice().sort((x, y) => x.full.localeCompare(y.full));
      if (pos[0] && !list.length) return [this.err(`Node not found`)];
      if (!list.length) return this.noNodes();
      return list.flatMap((n) => [this.out(`${n.full}:`), ...Object.keys(n.params).sort().map((k) => this.out(`  ${k}`))]);
    }
    const n = this.node(pos[0] || "");
    if (!pos[0]) return [this.err(`usage: ros2 param ${a || "list"} <node_name> ...`)];
    if (!n) return [this.err("Node not found"), this.hint("See the running nodes with: ros2 node list")];
    if (a === "get") {
      if (!pos[1]) return [this.err("usage: ros2 param get <node_name> <parameter_name>")];
      if (!(pos[1] in n.params)) return [this.out("Parameter not set.")];
      const v = n.params[pos[1]], isD = typeof v === "number" && ((n.kind === "teleop" && pos[1].startsWith("scale")) || (n.ptypes && n.ptypes[pos[1]] === "double"));
      const [t, s] = isD ? ["Double", fnum(v)] : fmtVal(v);
      return [this.out(`${t} value is: ${s}`)];
    }
    if (a === "set") {
      const [, k, raw] = pos;
      if (!k || raw == null) return [this.err("usage: ros2 param set <node_name> <parameter_name> <value>")];
      if (!(k in n.params)) return [this.out(`Set parameter failed: parameter '${k}' cannot be set because it was not declared`)];
      if (k.startsWith("qos_overrides")) return [this.out(`Set parameter failed: parameter '${k}' cannot be set because it is read-only`)];
      const old = n.params[k];
      if (n.ptypes && n.ptypes[k]) {
        const nv = raw === "true" || raw === "True" ? true : raw === "false" || raw === "False" ? false : /^-?\d+$/.test(raw) || /^-?\d*\.\d+$/.test(raw) || /^-?\d+\.\d*$/.test(raw) ? Number(raw) : raw;
        const nk = typeof nv === "boolean" ? "bool" : typeof nv === "string" ? "string" : /^-?\d+$/.test(raw) ? "integer" : "double";
        if (nk !== n.ptypes[k]) return [this.out(`Set parameter failed: Wrong parameter type, parameter {${k}} is of type {${n.ptypes[k]}}, setting it to {${nk}} is not allowed.`)];
        n.params[k] = nv; return [this.out("Set parameter successful")];
      }
      let v = raw === "true" || raw === "True" ? true : raw === "false" || raw === "False" ? false : /^-?\d+$/.test(raw) ? Number(raw) : /^-?\d*\.\d+$/.test(raw) ? Number(raw) : raw;
      const kind = (x) => (typeof x === "boolean" ? "bool" : typeof x === "string" ? "string" : Number.isInteger(x) && !(n.kind === "teleop") ? "integer" : "double");
      if (kind(old) !== kind(v) && !(kind(old) === "double" && typeof v === "number")) return [this.out(`Set parameter failed: Wrong parameter type, parameter {${k}} is of type {${kind(old)}}, setting it to {${kind(v)}} is not allowed.`)];
      if (k.startsWith("background_") && (v < 0 || v > 255)) return [this.out(`Set parameter failed: Parameter {${k}} doesn't comply with integer range.`)];
      n.params[k] = v;
      return [this.out("Set parameter successful"), ...(k.startsWith("background_") ? [this.hint(`(The turtlesim window background is now rgb(${n.params.background_r}, ${n.params.background_g}, ${n.params.background_b}).)`)] : [])];
    }
    if (a === "dump") {
      const P = n.params;
      const y = [`${n.full}:`, "  ros__parameters:"];
      for (const k of Object.keys(P).filter((k) => !k.startsWith("qos")).sort()) { if (k === "use_sim_time" && Object.keys(P).some((q) => q.startsWith("qos"))) y.push("    qos_overrides:", "      /parameter_events:", "        publisher:", "          depth: 1000", "          durability: volatile", "          history: keep_last", "          reliability: reliable"); y.push(`    ${k}: ${typeof P[k] === "boolean" ? P[k] : P[k]}`); }
      return y.map((t) => this.out(t));
    }
    if (a === "load") {
      const p = this.sh.abs(pos[1] || "");
      if (!this.sh.isFile(p)) return [this.err(`Error: file ${pos[1]} does not exist`)];
      const L = [];
      for (const m of (this.sh.node(p).content || "").matchAll(/^\s+(\w+):\s*([^\s:]+)\s*$/gm)) {
        if (m[1] in n.params && !m[1].startsWith("qos")) { const v = /^-?\d+$/.test(m[2]) ? Number(m[2]) : m[2] === "true" ? true : m[2] === "false" ? false : m[2]; n.params[m[1]] = v; L.push(this.out(`Set parameter ${m[1]} successful`)); }
      }
      return L.length ? L : [this.hint("(No matching parameters found in that file.)")];
    }
    return [this.err(`ros2 param: unknown command '${a}'`), this.hint("Try: list, get, set, dump, load")];
  }

  cmdAction(a, rest) {
    const A = this.collect(["acts", "actc"]);
    const showT = rest.includes("-t") || rest.includes("--show-types");
    const pos = rest.filter((x) => !x.startsWith("-"));
    const servers = [...A.entries()].filter(([, v]) => v.by.acts.length);
    if (a === "list") return servers.map(([k, v]) => this.out(showT ? `${k} [${v.type}]` : k));
    const name = pos[0], s = A.get(name || "");
    if (!name) return [this.err(`usage: ros2 action ${a || "list"} <action_name>`)];
    if (a === "type") return s ? [this.out(s.type)] : [this.err(`Unable to find action '${name}'`)];
    if (a === "info") return s ? [this.out(`Action: ${name}`), this.out(`Action clients: ${s.by.actc.length}`), ...s.by.actc.map((c) => this.out(`    ${c}`)), this.out(`Action servers: ${s.by.acts.length}`), ...s.by.acts.map((c) => this.out(`    ${c}`))] : [this.err(`Unable to find action '${name}'`)];
    if (a !== "send_goal") return [this.err(`ros2 action: unknown command '${a}'`), this.hint("Try: list, info, type, send_goal")];
    const type = pos[1], yaml = pos.slice(2).join(" ");
    if (!type || !yaml) return [this.err("usage: ros2 action send_goal <action_name> <action_type> <goal>")];
    if (!s || !s.by.acts.length) return [this.out("Waiting for an action server to become available..."), this.out("^C"), this.hint(`Nobody serves ${name}. Check with: ros2 action list`)];
    if (type !== s.type) return [this.err("The passed action type is invalid"), this.hint(`${name} has type ${s.type}`)];
    const hit = this.turtle(name.replace(/\/rotate_absolute$/, ""));
    const goal = this.num(yaml, "theta"), start = hit.t.theta, diff = goal - start;
    const L = [this.out("Waiting for an action server to become available..."), this.out("Sending goal:"), this.out(`     theta: ${goal}`), this.out(""), this.out(`Goal accepted with ID: ${hex()}`), this.out("")];
    if (rest.includes("--feedback") || rest.includes("-f")) for (let k = 0; k < 4; k++) L.push(this.out("Feedback:"), this.out(`    remaining: ${fnum(+(diff * (1 - k * 0.3)).toFixed(6))}`), this.out(""));
    hit.t.theta = +goal.toFixed(6);
    L.push(this.out("Result:"), this.out(`    delta: ${fnum(+(-diff + 0.002 * Math.sign(-diff || 1)).toFixed(6))}`), this.out(""), this.out("Goal finished with status: SUCCEEDED"));
    return L;
  }

  allIfaces() { const all = { ...IFACES }; for (const pk of this.sh.wsPkgs ? this.sh.wsPkgs.values() : []) Object.assign(all, pk.ifaces || {}); return all; }
  cmdInterface(a, rest) {
    const IF = this.allIfaces();
    if (a === "show") {
      const n = rest[0] || "";
      const full = IF[n] ? n : n.split("/").length === 2 ? Object.keys(IF).find((k) => k.replace(/\/(msg|srv|action)\//, "/") === n) : null;
      if (!full) {
        const pkg = n.split("/")[0];
        if (!Object.keys(IF).some((k) => k.startsWith(pkg + "/"))) return [this.err(`Unknown package '${pkg}'`), this.hint("Did you build it with colcon and run source install/setup.bash in this terminal?")];
        return [this.err(`Could not find the interface '${n}'`), this.hint("Interface names look like geometry_msgs/msg/Twist, turtlesim/srv/Spawn or turtlesim/action/RotateAbsolute.")];
      }
      return this.lines(IF[full]);
    }
    if (a === "package") {
      const keys = Object.keys(IF).filter((k) => k.startsWith((rest[0] || "") + "/"));
      return keys.length ? keys.map((k) => this.out(k)) : [this.err(`Unknown package '${rest[0] || ""}'`)];
    }
    if (a === "list") return ["Messages:", ...Object.keys(IFACES).filter((k) => k.includes("/msg/")).map((k) => "    " + k), "Services:", ...Object.keys(IFACES).filter((k) => k.includes("/srv/")).map((k) => "    " + k), "Actions:", ...Object.keys(IFACES).filter((k) => k.includes("/action/")).map((k) => "    " + k)].map((t) => this.out(t));
    return [this.err("usage: ros2 interface show <type>  |  ros2 interface list")];
  }

  cmdBag(a, rest) {
    const sh = this.sh;
    if (a === "record") {
      let name = null; const topics = [];
      for (let i = 0; i < rest.length; i++) { if (rest[i] === "-o" || rest[i] === "--output") { name = rest[++i]; continue; } if (!rest[i].startsWith("-")) topics.push(rest[i]); }
      const all = rest.includes("-a") || rest.includes("--all");
      const T = this.topics();
      const rec = all ? [...T.keys()] : topics;
      if (!rec.length) return [this.err("Need to specify one or more topics, or use -a to record all topics")];
      const d = new Date(), pad = (x) => String(x).padStart(2, "0");
      name = name || `rosbag2_${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}-${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
      const dir = sh.abs(name);
      if (sh.fs.has(dir)) return [this.err(`[ERROR] [rosbag2_storage]: Output folder '${name}' already exists.`), this.hint("Choose another name with -o, or delete the old folder.")];
      sh.mkdirP(dir);
      sh.fs.set(`${dir}/metadata.yaml`, { type: "f", mode: "rw-r--r--", content: "rosbag2_bagfile_information:\n  version: 9\n  storage_identifier: mcap\n" });
      sh.fs.set(`${dir}/${name}_0.mcap`, { type: "f", mode: "rw-r--r--", content: "(binary)" });
      this.bags[dir] = rec.map((t) => ({ t, type: (T.get(t) || { type: "geometry_msgs/msg/Twist" }).type, count: /pose|color/.test(t) ? 1250 : t.endsWith("cmd_vel") ? 9 : 20 }));
      return [this.out("[INFO] [rosbag2_recorder]: Press SPACE for pausing/resuming"), this.out("[INFO] [rosbag2_recorder]: Listening for topics..."),
        ...rec.map((t) => this.out(`[INFO] [rosbag2_recorder]: Subscribed to topic '${t}'`)), this.out("[INFO] [rosbag2_recorder]: Recording..."),
        this.out("[INFO] [rosbag2_recorder]: All requested topics are subscribed. Stopping discovery..."), this.out("^C"),
        this.hint(`Practice terminal: recorded about 20 seconds, then stopped (on a real computer: Ctrl+C). The bag is the folder ${name}/`)];
    }
    const name = rest.find((x) => !x.startsWith("-"));
    const dir = name ? sh.abs(name) : "";
    const bag = this.bags[dir];
    if ((a === "info" || a === "play") && !bag) return [this.err(`[ERROR] [ros2bag]: No storage could be initialized from the inputs: '${name || ""}'`), this.hint("Give the bag folder name. Record one first with: ros2 bag record -o my_bag /turtle1/cmd_vel")];
    if (a === "info") {
      const total = bag.reduce((s, b) => s + b.count, 0);
      return [`Files:             ${baseName(dir)}_0.mcap`, "Bag size:          48.3 KiB", "Storage id:        mcap", "ROS Distro:        jazzy", "Duration:          20.012s",
        "Start:             Oct  2 2026 10:15:04.120 (1790921104.120)", "End:               Oct  2 2026 10:15:24.132 (1790921124.132)", `Messages:          ${total}`,
        ...bag.map((b, i) => `${i ? "                   " : "Topic information: "}Topic: ${b.t} | Type: ${b.type} | Count: ${b.count} | Serialization Format: cdr`),
        "Service:           0"].map((t) => this.out(t));
    }
    if (a === "play") {
      const tw = bag.find((b) => b.t.endsWith("cmd_vel"));
      if (tw) { const hit = this.turtle(tw.t.replace(/\/cmd_vel$/, "")); if (hit) this.move(hit.t, 2, 1.2, 3); }
      return [this.out("[INFO] [rosbag2_player]: Set rate to 1"), this.out("[INFO] [rosbag2_player]: Adding keyboard callbacks."), this.out("[INFO] [rosbag2_player]: Press SPACE for Pause/Resume"),
        this.out("[INFO] [rosbag2_player]: Playback until timestamp: -1"), this.hint(`(The recorded messages were published again, exactly as they happened.${tw ? " The turtle repeated the same drive!" : ""})`)];
    }
    return [this.err("usage: ros2 bag record | info | play")];
  }

  // ros2 run in a terminal with a live graph: the node keeps running "in another terminal"
  start(pkg, exe, extra) {
    const kind = EXES[`${pkg} ${exe}`];
    if (!kind) return null;
    let name = DEFAULT_NAME[kind], ns = "", pfile = null;
    const params = {};
    for (let i = 0; i < extra.length; i++) {
      if (extra[i] === "-r" || extra[i] === "--remap") { const [k, v] = (extra[++i] || "").split(":="); if (k === "__node" || k === "__name") name = v; if (k === "__ns") ns = v; }
      if (extra[i] === "-p" || extra[i] === "--param") { const [k, v] = (extra[++i] || "").split(":="); params[k] = /^-?\d+$/.test(v) ? Number(v) : v; }
      if (extra[i] === "--params-file") pfile = extra[++i];
    }
    const pre = [];
    if (pfile !== null) {
      const fp = this.sh.abs(pfile || "");
      if (!this.sh.isFile(fp)) return [this.err(`[ERROR] [rcl]: Failed to parse global arguments: Couldn't parse params file: '--params-file ${pfile}'. Error: Error opening YAML file, at ./src/parse.c`), this.hint("Check the path to the YAML file (use ls).")];
      const y = parseParamsYaml(this.sh.node(fp).content || "");
      y.warn.forEach((w) => pre.push(this.hint(w)));
      const full = `${ns ? "/" + ns.replace(/^\//, "") : ""}/${name}`;
      for (const [key, body] of Object.entries(y.tree)) if (key === "/**" || key === full) for (const [k, v] of Object.entries(body)) params[k] = plainValue(v);
    }
    if (this.has(`${ns ? "/" + ns.replace(/^\//, "") : ""}/${name}`)) return [this.out(`[WARN] [rcl.logging_rosout]: Publisher already registered for node name: '${name}'. If this is due to multiple nodes with the same name then all logs for the logger named '${name}' will go out over the existing publisher. As soon as any node with that name is destructed it will unregister the publisher, preventing any further logs for that name from being published on the rosout topic.`), this.hint("Two nodes with the same name confuse ROS 2. Give the second one a new name with --ros-args --remap __node:=another_name")];
    const n = this.add(kind, name, ns, params);
    this.lastStarted = [n.full];
    const L = {
      turtlesim: [`[INFO] [${name}]: Starting turtlesim with node name ${n.full}`, `[INFO] [${name}]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]`],
      teleop: ["Reading from keyboard", "---------------------------", "Use arrow keys to move the turtle.", "Use G|B|V|C|D|E|R|T keys to rotate to absolute orientations. 'F' to cancel a rotation.", "'Q' to quit."],
      talker: [1, 2, 3].map((i) => `[INFO] [${name}]: Publishing: 'Hello World: ${i}'`),
      listener: this.has("/talker") ? [1, 2, 3].map((i) => `[INFO] [${name}]: I heard: [Hello World: ${i}]`) : [],
      adder: [],
    }[kind];
    return [...pre, ...L.map((t) => this.out(t)), this.hint(`(Practice terminal: ${n.full} now keeps running in the background, as if in its own terminal window. Keep typing ros2 commands here to look at it.)`)];
  }
  launch(pkg, file) {
    if (`${pkg} ${file}` !== "turtlesim multisim.launch.py") return null;
    this.add("turtlesim", "sim", "turtlesim1"); this.add("turtlesim", "sim", "turtlesim2");
    this.lastStarted = ["/turtlesim1/sim", "/turtlesim2/sim"];
    return [this.out("[INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-02-10-15-04-120000-ros2lab-4321"), this.out("[INFO] [launch]: Default logging verbosity is set to INFO"),
      this.out("[INFO] [turtlesim_node-1]: process started with pid [4330]"), this.out("[INFO] [turtlesim_node-2]: process started with pid [4332]"),
      this.hint("(Two turtlesim windows opened, in the namespaces /turtlesim1 and /turtlesim2. They keep running in the background. Try: ros2 node list)")];
  }
}

RosGraph.prototype.stop = function (full) {
  this.nodes = this.nodes.filter((n) => n.full !== full);
  this.version = (this.version || 0) + 1;
};
// One key press in turtle_teleop_key: publish one Twist on <ns>/turtle1/cmd_vel
RosGraph.prototype.teleopKey = function (teleFull, key) {
  const tele = this.node(teleFull);
  if (!tele) return null;
  const lin = Number(tele.params.scale_linear) || 2, ang = Number(tele.params.scale_angular) || 2;
  const v = { up: [lin, 0], down: [-lin, 0], left: [0, ang], right: [0, -ang] }[key];
  if (!v) return null;
  const topic = `${tele.ns}/turtle1/cmd_vel`;
  this.lastTwist = { lx: v[0], ly: 0, az: v[1], topic };
  const hit = this.turtle(`${tele.ns}/turtle1`);
  if (hit) this.move(hit.t, v[0], v[1], 1);
  return hit;
};
RosGraph.prototype.turtlesims = function () { return this.nodes.filter((n) => n.kind === "turtlesim"); };

const baseName = (p) => p.split("/").filter(Boolean).pop() || "/";
export const pkgExecutables = (pkg) => PKG_EXES[pkg] || null;

// ---------- ros2 pkg create (writes the real file layout into the practice file system) ----------
export function pkgCreate(sh, args) {
  let build = "ament_cmake", license = null, node = null; const deps = []; let name = null;
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === "--build-type") build = args[++i];
    else if (x === "--license") license = args[++i];
    else if (x === "--node-name") node = args[++i];
    else if (x === "--dependencies") { while (args[i + 1] && !args[i + 1].startsWith("--")) deps.push(args[++i]); }
    else if (!x.startsWith("-")) name = x;
  }
  if (!name) return [sh.err("usage: ros2 pkg create [--build-type ament_python] [--license Apache-2.0] [--node-name my_node] <package_name>")];
  if (!/^[a-z][a-z0-9_]*$/.test(name)) return [sh.err(`Package name '${name}' must start with a lower-case letter and contain only lower-case letters, numbers and underscores.`)];
  if (!["ament_cmake", "ament_python"].includes(build)) return [sh.err(`--build-type must be ament_cmake or ament_python`)];
  const base = sh.cwd === "/" ? "" : sh.cwd, dir = `${base}/${name}`;
  if (sh.fs.has(dir)) return [sh.err(`Aborted!\nThe directory already exists: ./${name}\nEither remove the directory or choose a different destination directory or package name`)];
  if (!sh.writable(dir, false)) return [sh.err(`[Errno 13] Permission denied: './${name}'`)];
  const f = (p, c = "") => { sh.mkdirP(p.replace(/\/[^/]+$/, "")); sh.fs.set(p, { type: "f", mode: "rw-r--r--", content: c }); };
  const L = ["going to create a new package", `package name: ${name}`, `destination directory: ${sh.cwd}`, "package format: 3", "version: 0.0.0",
    "description: TODO: Package description", "maintainer: ['student <student@todo.todo>']", `licenses: ['${license || "TODO: License declaration"}']`, `build type: ${build}`,
    `dependencies: [${deps.map((d) => `'${d}'`).join(", ")}]`, ...(node ? [`node_name: ${node}`] : []), `creating folder ./${name}`, `creating ./${name}/package.xml`];
  sh.mkdirP(dir);
  f(`${dir}/package.xml`, `<?xml version="1.0"?>\n<package format="3">\n  <name>${name}</name>\n  <version>0.0.0</version>\n  <description>TODO: Package description</description>\n  <maintainer email="student@todo.todo">student</maintainer>\n  <license>${license || "TODO: License declaration"}</license>\n${deps.map((d) => `  <depend>${d}</depend>\n`).join("")}  <export>\n    <build_type>${build}</build_type>\n  </export>\n</package>\n`);
  if (build === "ament_python") {
    L.push("creating source folder", `creating folder ./${name}/${name}`, `creating ./${name}/setup.py`, `creating ./${name}/setup.cfg`, `creating folder ./${name}/resource`, `creating ./${name}/resource/${name}`, `creating ./${name}/${name}/__init__.py`, `creating folder ./${name}/test`, `creating ./${name}/test/test_copyright.py`, `creating ./${name}/test/test_flake8.py`, `creating ./${name}/test/test_pep257.py`);
    f(`${dir}/setup.py`, `from setuptools import find_packages, setup\n\npackage_name = '${name}'\n\nsetup(\n    name=package_name,\n    version='0.0.0',\n    packages=find_packages(exclude=['test']),\n    entry_points={\n        'console_scripts': [\n${node ? `            '${node} = ${name}.${node}:main'\n` : ""}        ],\n    },\n)\n`);
    f(`${dir}/setup.cfg`, `[develop]\nscript_dir=$base/lib/${name}\n[install]\ninstall_scripts=$base/lib/${name}\n`);
    f(`${dir}/resource/${name}`); f(`${dir}/${name}/__init__.py`);
    ["test_copyright.py", "test_flake8.py", "test_pep257.py"].forEach((t) => f(`${dir}/test/${t}`, "# test\n"));
    if (node) { L.push(`creating ./${name}/${name}/${node}.py`); f(`${dir}/${name}/${node}.py`, `def main():\n    print('Hi from ${name}.')\n\n\nif __name__ == '__main__':\n    main()\n`); }
  } else {
    L.push("creating source and include folder", `creating folder ./${name}/src`, `creating folder ./${name}/include/${name}`, `creating ./${name}/CMakeLists.txt`);
    sh.mkdirP(`${dir}/src`); sh.mkdirP(`${dir}/include/${name}`); f(`${dir}/CMakeLists.txt`, `cmake_minimum_required(VERSION 3.8)\nproject(${name})\n`);
    if (node) { L.push(`creating ./${name}/src/${node}.cpp`); f(`${dir}/src/${node}.cpp`, `#include <cstdio>\n\nint main(int argc, char ** argv)\n{\n  (void) argc;\n  (void) argv;\n\n  printf("hello world ${name} package\\n");\n  return 0;\n}\n`); }
  }
  const out = L.map((t) => sh.out(t));
  if (!/\/src$/.test(sh.cwd)) out.push(sh.hint("Packages normally go inside the src folder of a workspace, for example ~/ros2_ws/src."));
  return out;
}

// Finds packages (folders with package.xml) under <ws>/src, for colcon build.
export function findPackages(sh, ws) {
  const src = `${ws === "/" ? "" : ws}/src`;
  const pk = [];
  for (const [p, n] of sh.fs) {
    if (n.type !== "f" || !p.startsWith(src + "/") || !p.endsWith("/package.xml")) continue;
    const dir = p.slice(0, -"/package.xml".length);
    const xml = n.content || "";
    const name = (xml.match(/<name>([^<]+)<\/name>/) || [, baseName(dir)])[1];
    const type = /ament_python/.test(xml) ? "ament_python" : "ament_cmake";
    const exes = {};
    if (type === "ament_python") {
      const setup = (sh.fs.get(`${dir}/setup.py`) || {}).content || "";
      for (const m of setup.matchAll(/'(\w+)\s*=\s*([\w.]+):main'/g)) {
        const file = `${dir}/${m[2].replace(/\./g, "/")}.py`;
        const code = (sh.fs.get(file) || {}).content || "";
        exes[m[1]] = [...code.matchAll(/print\(\s*(["'])(.*?)\1\s*\)/g)].map((x) => x[2]);
      }
    } else {
      for (const [q, f] of sh.fs) if (q.startsWith(`${dir}/src/`) && q.endsWith(".cpp")) { const m = (f.content || "").match(/printf\("([^"\\]*)/); exes[baseName(q).replace(/\.cpp$/, "")] = m ? [m[1]] : []; }
    }
    pk.push({ name, type, exes, dir, ...packageExtras(sh, dir, name, type, xml) });
  }
  return pk.sort((a, b) => a.name.localeCompare(b.name));
}

// =====================================================================================
// Week 5 additions: custom interfaces (rosidl), installed launch/config files, YAML
// parameter files, user launch files (XML and Python) with namespaces, remaps, params.
// =====================================================================================
const PRIM = ["bool", "byte", "char", "float32", "float64", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "string", "wstring"];
const KNOWN_MSG_PKGS = ["std_msgs", "geometry_msgs", "sensor_msgs", "builtin_interfaces", "nav_msgs", "action_msgs", "turtlesim"];
const FIELD_RE = /^(?!.*__)(?!.*_$)[a-z][a-z0-9_]*$/;
const near = (t) => PRIM.find((p) => p !== t && p.length === t.length && [...p].sort().join("") === [...t].sort().join(""));

function checkIfaceText(text, kind, pkg, localTypes, file) {
  const errs = [];
  const parts = text.split(/^---[ \t]*$/m);
  const want = { msg: 1, srv: 2, action: 3 }[kind];
  if (parts.length !== want) errs.push(`${file}: a .${kind} file needs exactly ${want - 1} line(s) with --- (found ${parts.length - 1})`);
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (!line || line === "---") return;
    const m = line.match(/^(\S+)\s+([^\s=]+)\s*(=\s*.+|\s+.+)?$/);
    if (!m) { errs.push(`${file}:${i + 1}: invalid line '${raw.trim()}' (expected: type name)`); return; }
    const [, type, name, rest] = m;
    const base = type.replace(/\[[^\]]*\]$/, "").replace(/<=\d+$/, "");
    const known = PRIM.includes(base) || localTypes.includes(base) ||
      (/^[a-z][a-z0-9_]*\/(msg\/)?[A-Z]\w*$/.test(base) && (KNOWN_MSG_PKGS.includes(base.split("/")[0]) || base.split("/")[0] === pkg));
    if (!known) errs.push(`${file}:${i + 1}: '${base}' is not a known type${near(base) ? ` (did you mean '${near(base)}'?)` : ""}`);
    if (rest && rest.trim().startsWith("=")) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) errs.push(`${file}:${i + 1}: constant '${name}' must be UPPER_CASE`);
    } else if (!FIELD_RE.test(name)) {
      errs.push(`rosidl_adapter.parser.InvalidResourceName: '${name}' is an invalid field name. It should have the pattern '^(?!.*__)(?!.*_$)[a-z][a-z0-9_]*$'`);
    }
  });
  return errs;
}

// Called by findPackages for every package: generated interfaces, installed launch and config files.
export function packageExtras(sh, dir, name, type, xml) {
  const files = (sub, ext) => [...sh.fs].filter(([p, n]) => n.type === "f" && p.startsWith(`${dir}/${sub}/`) && (!ext || p.endsWith(ext)) && !p.slice(dir.length + sub.length + 2).includes("/"));
  const out = { ifaces: {}, errors: [], launch: {}, config: {} };
  const cm = type === "ament_cmake" ? ((sh.fs.get(`${dir}/CMakeLists.txt`) || {}).content || "") : "";
  const setup = type === "ament_python" ? ((sh.fs.get(`${dir}/setup.py`) || {}).content || "") : "";
  // ---- interfaces ----
  const all = ["msg", "srv", "action"].flatMap((k) => files(k, "." + k).map(([p, n]) => ({ k, p, rel: p.slice(dir.length + 1), text: n.content || "" })));
  const gen = cm.match(/rosidl_generate_interfaces\s*\(([\s\S]*?)\)/);
  if (type === "ament_cmake" && gen) {
    if (!/find_package\s*\(\s*rosidl_default_generators\s+REQUIRED\s*\)/.test(cm)) {
      const ln = cm.slice(0, gen.index).split("\n").length;
      out.errors.push(`CMake Error at CMakeLists.txt:${ln} (rosidl_generate_interfaces):`, `  Unknown CMake command "rosidl_generate_interfaces".`);
      return out;
    }
    if (!/<member_of_group>\s*rosidl_interface_packages\s*<\/member_of_group>/.test(xml)) {
      out.errors.push("CMake Error: Packages installing interfaces must include '<member_of_group>rosidl_interface_packages</member_of_group>' in their package.xml");
      return out;
    }
    const listed = [...gen[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((x) => /\.(msg|srv|action)$/.test(x));
    const localTypes = all.map((f) => f.rel.split("/").pop().replace(/\.\w+$/, ""));
    for (const rel of listed) {
      const f = all.find((x) => x.rel === rel);
      if (!f) { out.errors.push(`CMake Error: rosidl_generate_interfaces() the passed file '${rel}' doesn't exist`); continue; }
      const short = rel.split("/").pop().replace(/\.\w+$/, "");
      if (!/^[A-Z][A-Za-z0-9]*$/.test(short)) { out.errors.push(`rosidl_adapter.parser.InvalidResourceName: '${short}' is an invalid ${f.k} name. It should have the pattern '^[A-Z][A-Za-z0-9]*$' (CamelCase, no underscores)`); continue; }
      const e = checkIfaceText(f.text, f.k, name, localTypes, rel);
      if (e.length) out.errors.push(...e); else out.ifaces[`${name}/${f.k}/${short}`] = f.text.replace(/\s+$/, "");
    }
  }
  // ---- launch and config files (only if an install rule copies them) ----
  for (const sub of ["launch", "config"]) {
    const installed = type === "ament_cmake"
      ? new RegExp(`install\\s*\\(\\s*DIRECTORY[^)]*\\b${sub}\\b[^)]*DESTINATION\\s+share/\\$\\{PROJECT_NAME\\}`).test(cm)
      : new RegExp(`glob\\(\\s*['"]${sub}/\\*`).test(setup);
    if (installed) for (const [p, n] of files(sub)) out[sub][p.split("/").pop()] = n.content || "";
  }
  return out;
}

// Tiny YAML reader for ROS 2 parameter files: { "node_or_/**": { param: value } }
export function parseParamsYaml(text) {
  const warn = [];
  if (/\t/.test(text)) return { tree: {}, warn: ["YAML error: the file contains a Tab. YAML only allows spaces."] };
  const root = {}; const stack = [{ ind: -1, obj: root }];
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const ind = line.length - line.trimStart().length;
    const m = line.trim().match(/^("?[^":]+"?|'[^']+'):\s*(.*)$/);
    if (!m) continue;
    while (stack.length > 1 && ind <= stack[stack.length - 1].ind) stack.pop();
    const key = m[1].replace(/^["']|["']$/g, ""), v = m[2];
    const parent = stack[stack.length - 1].obj;
    if (v === "") { parent[key] = {}; stack.push({ ind, obj: parent[key] }); }
    else parent[key] = yamlValue(v);
  }
  const tree = {};
  for (const [k, body] of Object.entries(root)) {
    if (!body || typeof body !== "object" || !("ros__parameters" in body)) { warn.push(`(practice) '${k}' has no 'ros__parameters' key, so these values are not used as parameters. It needs TWO underscores: ros__parameters`); continue; }
    tree[k === "/**" ? "/**" : "/" + k.replace(/^\//, "")] = body.ros__parameters;
  }
  return { tree, warn };
}
export function yamlValue(v) {
  v = String(v).trim();
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+(e-?\d+)?$/i.test(v) || /^-?\d+\.\d*$/.test(v)) return { __double: Number(v) };
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map((x) => yamlValue(x)).filter((x) => x !== "");
  return v.replace(/^["']|["']$/g, "");
}
export const plainValue = (v) => (v && typeof v === "object" && "__double" in v ? v.__double : v);

// ---------- launch file readers ----------
function attrs(s) { const o = {}; for (const m of String(s).matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) o[m[1]] = m[2]; return o; }
export function readLaunchXml(text, cli) {
  if (!/<launch\b[^>]*>[\s\S]*<\/launch>/.test(text)) return { error: "Caught exception when trying to load file of format [xml]: the file must start with <launch> and end with </launch>" };
  const vals = {};
  for (const m of text.matchAll(/<arg\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1]); if (!a.name) continue;
    if (a.name in cli) vals[a.name] = cli[a.name];
    else if ("default" in a) vals[a.name] = a.default;
    else return { error: `Required launch argument "${a.name}" (description: "no description given") was not provided` };
  }
  let bad = null;
  const sub = (s) => String(s ?? "").replace(/\$\(var ([\w-]+)\)/g, (_, k) => (k in vals ? vals[k] : (bad = bad || `launch configuration '${k}' does not exist`, ""))).replace(/\$\(find-pkg-share ([\w-]+)\)/g, "$FINDSHARE:$1");
  const nodes = [];
  for (const m of text.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const a = attrs(m[1]); const body = m[2] || "";
    const n = { pkg: sub(a.pkg), exec: sub(a.exec), name: sub(a.name), ns: sub(a.namespace), params: {}, files: [], remaps: [] };
    for (const p of body.matchAll(/<param\b([^>]*?)\/?>/g)) { const pa = attrs(p[1]); if (pa.from) n.files.push(sub(pa.from)); else if (pa.name) n.params[pa.name] = yamlValue(sub(pa.value)); }
    for (const r of body.matchAll(/<remap\b([^>]*?)\/?>/g)) { const ra = attrs(r[1]); n.remaps.push([sub(ra.from), sub(ra.to)]); }
    nodes.push(n);
  }
  return bad ? { error: bad } : { nodes, vals };
}
export function readLaunchPy(text, cli) {
  if (!/def\s+generate_launch_description\s*\(/.test(text)) return { error: "InvalidPythonLaunchFileError: launch file does not contain the required function 'generate_launch_description()'" };
  const vals = {};
  for (const m of text.matchAll(/DeclareLaunchArgument\(\s*['"]([\w-]+)['"](?:\s*,\s*default_value\s*=\s*['"]([^'"]*)['"])?/g)) {
    if (m[1] in cli) vals[m[1]] = cli[m[1]]; else if (m[2] !== undefined) vals[m[1]] = m[2];
    else return { error: `Required launch argument "${m[1]}" (description: "no description given") was not provided` };
  }
  const str = (s) => { if (!s) return ""; const q = s.match(/^['"]([^'"]*)['"]$/); if (q) return q[1]; const lc = s.match(/LaunchConfiguration\(\s*['"]([\w-]+)['"]\s*\)/); return lc ? vals[lc[1]] ?? "" : s.trim(); };
  const nodes = [];
  let i = 0;
  while ((i = text.indexOf("Node(", i)) >= 0) {
    if (/\w/.test(text[i - 1] || "")) { i += 5; continue; }
    let d = 0, j = i + 4;
    for (; j < text.length; j++) { if (text[j] === "(") d++; else if (text[j] === ")" && --d === 0) break; }
    const body = text.slice(i + 5, j); i = j;
    const kw = (k) => { const m = body.match(new RegExp(`\\b${k}\\s*=\\s*('[^']*'|"[^"]*"|LaunchConfiguration\\([^)]*\\))`)); return m ? str(m[1]) : ""; };
    const n = { pkg: kw("package"), exec: kw("executable"), name: kw("name"), ns: kw("namespace"), params: {}, files: [], remaps: [] };
    const pm = body.match(/parameters\s*=\s*\[([\s\S]*?)\]\s*(,|$)/);
    if (pm) for (const e of pm[1].matchAll(/['"]([\w.]+)['"]\s*:\s*('[^']*'|"[^"]*"|LaunchConfiguration\([^)]*\)|[-\w.]+)/g)) n.params[e[1]] = yamlValue(str(e[2]) === "" ? e[2] : /^['"]/.test(e[2]) || /^Launch/.test(e[2]) ? str(e[2]) : e[2]);
    const rm = body.match(/remappings\s*=\s*\[([\s\S]*?)\]\s*(,|$)/);
    if (rm) for (const r of rm[1].matchAll(/\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g)) n.remaps.push([r[1], r[2]]);
    nodes.push(n);
  }
  return { nodes, vals };
}

// ros2 launch <workspace package> <file> [arg:=value ...]
RosGraph.prototype.launchUser = function (pk, file, extra = []) {
  const sh = this.sh, share = `${HOME}/ros2_ws/install/${pk.name}/share/${pk.name}`;
  const text = (pk.launch || {})[file];
  if (text === undefined) {
    const inSrc = [...sh.fs.keys()].some((p) => p === `${pk.dir}/launch/${file}`);
    return [this.err(`file '${file}' was not found in the share directory of package '${pk.name}' at '${share}'`),
      this.hint(inSrc ? "The file exists in src, but it was never INSTALLED. Add the install rule (CMakeLists.txt: install(DIRECTORY launch ...) or setup.py: data_files), then colcon build and source again." : "Check the file name, and that it is inside the package's launch folder.")];
  }
  const cli = {}; for (const x of extra) { const m = String(x).match(/^([\w-]+):=(.*)$/); if (m) cli[m[1]] = m[2]; }
  const kindOf = /\.py$/.test(file) ? "py" : /\.xml$/.test(file) ? "xml" : null;
  if (extra.includes("--show-args")) {
    const decl = kindOf === "xml" ? [...text.matchAll(/<arg\b([^>]*?)\/?>/g)].map((m) => attrs(m[1])) : [...text.matchAll(/DeclareLaunchArgument\(\s*['"]([\w-]+)['"](?:\s*,\s*default_value\s*=\s*['"]([^'"]*)['"])?/g)].map((m) => ({ name: m[1], default: m[2] }));
    return decl.length ? ["Arguments (pass arguments as '<name>:=<value>'):", ""].concat(...decl.map((a) => [`    '${a.name}':`, "        no description given", a.default !== undefined ? `        (default: '${a.default}')` : "", ""])).filter((x, i, arr) => x !== "" || arr[i - 1] !== "").map((t) => this.out(t)) : [this.out("No arguments.")];
  }
  const r = kindOf === "py" ? readLaunchPy(text, cli) : kindOf === "xml" ? readLaunchXml(text, cli) : { error: "the practice terminal reads .launch.xml and .launch.py files" };
  const L = [this.out(`[INFO] [launch]: All log files can be found below ${HOME}/.ros/log/2026-10-12-09-30-00-000000-ros2lab-4300`), this.out("[INFO] [launch]: Default logging verbosity is set to INFO")];
  if (r.error) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): ${r.error}`)];
  let count = 0;
  for (const n of r.nodes) {
    const ws = sh.wsPkgs && sh.wsPkgs.get(n.pkg);
    const kind = EXES[`${n.pkg} ${n.exec}`] || (ws && n.exec in ws.exes ? "custom" : null);
    if (!kind) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): executable '${n.exec}' not found on the libexec directory '/opt/ros/jazzy/lib/${n.pkg}'`)];
    const name = n.name || DEFAULT_NAME[kind] || n.exec;
    const ns = n.ns ? "/" + n.ns.replace(/^\/+|\/+$/g, "") : "";
    const full = `${ns}/${name}`, params = {};
    for (const f of n.files) {
      const m = f.match(/^\$FINDSHARE:([\w-]+)\/config\/(.+)$/);
      const content = m ? (sh.wsPkgs.get(m[1]) ? (sh.wsPkgs.get(m[1]).config || {})[m[2]] : undefined) : (sh.node(sh.abs(f)) || {}).content;
      if (content === undefined) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): parameter file '${f.replace(/^\$FINDSHARE:([\w-]+)/, `${HOME}/ros2_ws/install/$1/share/$1`)}' was not found (was the config folder installed?)`)];
      const y = parseParamsYaml(content); y.warn.forEach((w) => L.push(this.hint(w)));
      for (const [key, body] of Object.entries(y.tree)) if (key === "/**" || key === full) Object.assign(params, body);
    }
    Object.assign(params, n.params);
    const node = this.add(kind, name, ns, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, plainValue(v)])), n.remaps);
    if (kind === "custom") node.ptypes = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v && typeof v === "object" ? "double" : typeof v === "boolean" ? "bool" : typeof v === "string" ? "string" : "integer"]));
    count++;
    L.push(this.out(`[INFO] [${n.exec}-${count}]: process started with pid [${4300 + count * 7}]`));
  }
  L.push(this.hint(`(${count} node${count === 1 ? "" : "s"} started and keep running in the background. Look at them with: ros2 node list)`));
  return L;
};
