// ROS2Lab Nav2 process models for the practice ROS graph (the website's own JavaScript models of the Nav2 servers:
// the real C++ programs cannot run in a browser). Each model reads the REAL parameters that the real launch files hand
// the real programs (nav2_bringup navigation_launch.py / localization_launch.py with turtlebot3_navigation2
// param/burger.yaml, or nav2_params.yaml), loads the REAL map files, prints the log lines of the jazzy sources, and
// offers the same topics / services / actions, so `ros2 node list`, `ros2 action list`, `ros2 topic echo /plan`,
// `ros2 lifecycle get /controller_server`, RViz2's Nav2 displays and tools work on it.
//
//   const model = startNav2Node(graph, { pkg, exe } | { package, plugin }, name, ns, params, remaps, pid, write, exit, fs })
//   graph: the practice RosGraph (ros-graph.js + ros-gz.js methods: gzModel, gzOdom, gzScan, gzSensorPose, gzTwist ...)
//   desc.params: parameter dicts and/or YAML texts (the --params-file contents / LoadNode parameters + parameter_files)
//   desc.fs: { read(path) -> string|Uint8Array|null, write(path, data) } (map files, map_saver output)
//   Returns the model ({ name, full, role, n (the graph node), stop() }) or null if the program is not a Nav2 one.
// The simulation advances with the Gazebo clock: nav2Step(graph, dt) after each graph.gzStep(dt) (installed
// automatically by wrapping graph.gzStep once). Hooks for the coordinator: nav2Topic, nav2ActionGoal, nav2Service,
// nav2Lifecycle, nav2Sample, nav2TopicData (RViz), nav2TfEdges, nav2Panel, stopNav2Node (see the exports at the end).
import * as C from "./nav2-core.js";
import { slamRole, startSlam } from "./slam-sim.js";

const { num, bool, wrap, compose, inverse, qOfYaw, yawOfQ } = C;
const ROLES = {
  "nav2_map_server/map_server": "map_server", "nav2_map_server::MapServer": "map_server",
  "nav2_map_server/map_saver_server": "map_saver", "nav2_map_server::MapSaver": "map_saver",
  "nav2_map_server/map_saver_cli": "map_saver_cli",
  "nav2_amcl/amcl": "amcl", "nav2_amcl::AmclNode": "amcl",
  "nav2_controller/controller_server": "controller", "nav2_controller::ControllerServer": "controller",
  "nav2_planner/planner_server": "planner", "nav2_planner::PlannerServer": "planner",
  "nav2_smoother/smoother_server": "smoother", "nav2_smoother::SmootherServer": "smoother",
  "nav2_behaviors/behavior_server": "behavior", "behavior_server::BehaviorServer": "behavior",
  "nav2_bt_navigator/bt_navigator": "bt", "nav2_bt_navigator::BtNavigator": "bt",
  "nav2_waypoint_follower/waypoint_follower": "waypoint", "nav2_waypoint_follower::WaypointFollower": "waypoint",
  "nav2_velocity_smoother/velocity_smoother": "velsmoother", "nav2_velocity_smoother::VelocitySmoother": "velsmoother",
  "nav2_collision_monitor/collision_monitor": "collision", "nav2_collision_monitor::CollisionMonitor": "collision",
  "nav2_lifecycle_manager/lifecycle_manager": "lifecycle", "nav2_lifecycle_manager::LifecycleManager": "lifecycle",
  "opennav_docking/opennav_docking": "docking", "opennav_docking::DockingServer": "docking", "nav2_docking/opennav_docking": "docking",
  "nav2_route/route_server": "route", "nav2_route::RouteServer": "route",
};
const DEFAULT_NAME = { map_server: "map_server", map_saver: "map_saver", map_saver_cli: "map_saver", amcl: "amcl", controller: "controller_server", planner: "planner_server", smoother: "smoother_server", behavior: "behavior_server", bt: "bt_navigator", waypoint: "waypoint_follower", velsmoother: "velocity_smoother", collision: "collision_monitor", lifecycle: "lifecycle_manager", docking: "docking_server", route: "route_server" };
export function nav2Role(desc) {
  const pkg = desc.pkg || desc.package, key = desc.plugin ? (ROLES[desc.plugin] ? desc.plugin : `${pkg}/${desc.plugin}`) : `${pkg}/${desc.exe || desc.executable}`;
  return ROLES[key] || ROLES[desc.plugin] || slamRole(desc);
}

// ---------------------------------------------------------------- small helpers
const LIFECYCLE = { configure: ["unconfigured", "inactive", 1], cleanup: ["inactive", "unconfigured", 2], activate: ["inactive", "active", 3], deactivate: ["active", "inactive", 4], shutdown: [null, "finalized", 5] };
const stamp = () => (Date.now() / 1000).toFixed(9);
export function pyFloat(x) {   // Python repr of a float (what ros2 topic echo / action send_goal print)
  x = Number(x); if (!Number.isFinite(x)) return Number.isNaN(x) ? ".nan" : x > 0 ? ".inf" : "-.inf";
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  let s = String(x); const m = s.match(/^(-?[\d.]+)e([-+])(\d+)$/); if (m) s = `${m[1]}e${m[2]}${m[3].padStart(2, "0")}`;
  return s;
}
const F = (x) => ({ __f: x }), F32 = (x) => ({ __f: Math.fround(x) });
// message_to_yaml (rosidl_runtime_py) for plain objects; F(x) marks float fields
export function toYaml(o, ind = "") {
  const out = [];
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object" && "__f" in v) out.push(`${ind}${k}: ${pyFloat(v.__f)}`);
    else if (Array.isArray(v)) { if (!v.length) out.push(`${ind}${k}: []`); else { out.push(`${ind}${k}:`); for (const it of v) { if (it && typeof it === "object" && !("__f" in it)) { const sub = toYaml(it, ind + "  ").split("\n"); sub[0] = `${ind}- ${sub[0].trimStart()}`; out.push(...sub); } else out.push(`${ind}- ${it && typeof it === "object" ? pyFloat(it.__f) : it}`); } } }
    else if (v && typeof v === "object") { out.push(`${ind}${k}:`); out.push(toYaml(v, ind + "  ")); }
    else out.push(`${ind}${k}: ${v === "" ? "''" : v}`);
  }
  return out.join("\n");
}
const stampObj = (t) => { const ns = Math.round(t * 1e9); return { sec: Math.floor(ns / 1e9), nanosec: ns % 1e9 }; };
const poseYaml = (p, frame, t) => ({ header: { stamp: stampObj(t), frame_id: frame }, pose: { position: { x: F(p.x), y: F(p.y), z: F(0) }, orientation: { x: F(0), y: F(0), z: F(Math.sin(p.yaw / 2)), w: F(Math.cos(p.yaw / 2)) } } });
const dur = (s) => ({ sec: Math.floor(Math.max(0, s)), nanosec: Math.round((Math.max(0, s) % 1) * 1e9) });
const hex32 = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const normRemaps = (r) => [].concat(r || []).map((x) => (Array.isArray(x) ? x : String(x).split(":="))).filter((x) => x.length === 2 && x[0]);

// ---------------------------------------------------------------- the Nav2 system attached to a graph
class Nav2System {
  constructor(G) {
    this.G = G; this.models = []; this.logs = []; this.maps = new Map(); this.cmd = new Map(); this.mapOdom = null; this.mapOdomBy = null;
    this.scanCache = null; this.goals = new Map(); this.wall0 = Date.now();
    if (typeof G.gzStep === "function" && !G.gzStep.__nav2) {   // the Nav2 models run on Gazebo's clock
      const orig = G.gzStep, sys = this;
      G.gzStep = function (dt) { const r = orig.call(this, dt); if (r) sys.tick(dt); return r; };
      G.gzStep.__nav2 = true;
    }
    if (typeof setInterval === "function" && !G.nav2NoTimer) this.timer = setInterval(() => { try { this.pump(); } catch (e) { console.error(e); } }, 100);
  }
  now() { return this.G.gz && typeof this.G.gz.time === "number" ? this.G.gz.time : (Date.now() - this.wall0) / 1000; }
  wall() { return (Date.now() - this.wall0) / 1000; }
  model(role) { return this.models.find((m) => m.role === role && !m.dead); }
  byName(full) { return this.models.find((m) => !m.dead && (m.full === full || m.full === "/" + full || m.name === full)); }
  // ------------- the simulated robot (Gazebo)
  robot() {
    const G = this.G; if (!G.gz || !G.gz.models) return null;
    for (const m of G.gz.models.values()) if (m.gazebo && (m.gazebo.plugins || []).some((p) => /diff_drive|mecanum|ackermann/.test(p.kind))) return m;
    return null;
  }
  odom() { const m = this.robot(); if (!m || !this.G.gzOdom) return null; const o = this.G.gzOdom(m); return { x: o.x, y: o.y, yaw: o.yaw, vx: o.vx || 0, wz: o.wz || 0 }; }
  truePose() { const m = this.robot(); return m ? { x: m.pose.x, y: m.pose.y, yaw: m.pose.yaw } : null; }
  // the newest LaserScan (cached for the sensor's update period); offset = laser pose in the base frame
  scan() {
    const m = this.robot(), G = this.G; if (!m || !G.gzScan) return null;
    const sen = (m.gazebo.sensors || []).find((s) => s.lidar); if (!sen) return null;
    const period = 1 / (num(sen.rate, 0) > 0 ? num(sen.rate, 5) : 10), t = this.now();
    if (this.scanCache && this.scanCache.model === m.name && t - this.scanCache.t < period - 1e-9) return this.scanCache;
    const s = G.gzScan(m.name, sen); if (!s) return null;
    let offset = { x: 0, y: 0, yaw: 0 };
    try { const T = G.gzSensorPose(m, sen); if (T) { const sy = yawOfQ(T.q); offset = compose(inverse({ x: m.pose.x, y: m.pose.y, yaw: m.pose.yaw }), { x: T.t[0], y: T.t[1], yaw: sy }); } } catch { /* keep identity */ }
    this.scanCache = { ...s, t, model: m.name, offset, frame: sen.frame || sen.link || "base_scan", seq: (this.scanCache ? this.scanCache.seq : 0) + 1 };
    return this.scanCache;
  }
  // scan end points ([x, y, range]) for a base pose in some frame; keeps finite readings inside the sensor's limits
  scanPoints(scan, base, maxBeams = 0) {
    const S = compose(base, scan.offset), out = [], n = scan.ranges.length, step = maxBeams > 0 ? Math.max(1, Math.floor(n / maxBeams)) : 1;
    for (let i = 0; i < n; i += step) { const r = scan.ranges[i]; if (!Number.isFinite(r) || r < scan.range_min || r > scan.range_max) continue; const a = S.yaw + scan.angle_min + i * scan.angle_increment; out.push([S.x + r * Math.cos(a), S.y + r * Math.sin(a), r]); }
    return { sensor: S, points: out };
  }
  // pose of the base in "map" (through map->odom) or "odom"; null without the transform
  basePose(frame) { const o = this.odom(); if (!o) return null; if (frame === "odom" || frame === this.odomFrame()) return o; if (!this.mapOdom) return null; return compose(this.mapOdom, o); }
  odomFrame() { const m = this.robot(); const dd = m && m.gazebo.plugins.find((p) => /diff_drive/.test(p.kind)); return (dd && dd.frame) || "odom"; }
  // ------------- velocity commands: controller / behaviors -> velocity_smoother -> collision_monitor -> Gazebo bridge
  publishTwist(topic, v, stamped, from) {
    this.cmd.set(topic, { v: { vx: v.vx, wz: v.wz }, stamped, t: this.now(), from });
    let taken = false;
    for (const m of this.models) if (!m.dead && m.onTwist && m.cmdIn && m.cmdIn() === topic) { m.onTwist(v, stamped); taken = true; }
    if (!taken && this.G.gzTwist) this.G.gzTwist(topic, { lx: v.vx, ly: 0, lz: 0, az: v.wz }, stamped ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist");
  }
  // ------------- maps (transient local topics)
  setMap(topic, grid, by) { this.maps.set(topic, { grid, by, t: this.now(), ver: (this.maps.get(topic)?.ver || 0) + 1 }); for (const m of this.models) if (!m.dead && m.onMap) m.onMap(topic, grid); }
  setMapOdom(T, by) { this.mapOdom = T; this.mapOdomBy = by; }
  // ------------- logging: [LEVEL] [time] [logger]: text, written to the process that runs the node
  log(model, level, text, logger) {
    const line = `[${level}] [${stamp()}] [${logger || model.logName}]: ${text}`;
    this.logs.push({ node: model.full, level, text, logger: logger || model.logName, line, t: this.now() });
    if (this.logs.length > 4000) this.logs.splice(0, 1000);
    if (model.write) model.write(line + "\n", "err");
    else if (this.G.note && model.n) this.G.note(model.n, line, level === "ERROR" || level === "WARN" ? "warn-line" : "");
  }
  tick(dt) {
    for (const m of this.models) if (!m.dead && m.tick) { try { m.tick(this.now(), dt); } catch (e) { console.error(`[nav2] ${m.full}:`, e); } }
    this.pump();
  }
  pump() { for (const m of this.models) if (!m.dead && m.pump) m.pump(); for (const [id, h] of this.goals) if (h.done) this.goals.delete(id); }
  dispose() { if (this.timer) clearInterval(this.timer); }
}
export function nav2System(G) { if (!G.nav2) G.nav2 = new Nav2System(G); return G.nav2; }

// ---------------------------------------------------------------- base node model
class NavNode {
  constructor(sys, role, desc, opts = {}) {
    this.sys = sys; this.role = role; this.G = sys.G;
    this.name = desc.name || DEFAULT_NAME[role] || role;
    const ns = desc.ns ?? desc.namespace ?? ""; this.ns = ns && ns !== "/" ? "/" + String(ns).replace(/^\/+|\/+$/g, "") : "";
    this.full = `${this.ns}/${this.name}`; this.logName = opts.logName || (this.ns ? `${this.ns.slice(1).replace(/\//g, ".")}.${this.name}` : this.name);
    this.remaps = normRemaps(desc.remaps ?? desc.remappings);
    this.fs = desc.fs || null; this.write = desc.write || null; this.exitFn = desc.exit || null; this.pid = desc.pid;
    this.sources = [].concat(desc.params ?? desc.parameters ?? []);
    for (const t of Object.values(desc.parameter_files || desc.files || {})) if (typeof t === "string" && /ros__parameters/.test(t)) this.sources.unshift(t);
    this.P = C.nodeParams(this.sources, opts.paramName || this.name, opts.paramNs ?? this.ns);
    this.state = "unconfigured"; this.lifecycleNode = opts.lifecycle !== false; this.n = null;
  }
  attach() {
    const n = this.G.add("nav2", this.name, this.ns.replace(/^\//, ""), {}, this.remaps);
    n.params = { ...(n.params || {}), ...C.flatParams(this.P) };
    if (n.params.use_sim_time === undefined) n.params.use_sim_time = false;
    n.remaps = this.remaps; n.nav2 = this; n.lstate = this.lifecycleNode ? this.state : undefined;
    n.info = { pubs: [], subs: [], srvs: [], cli: [], acts: [], actc: [], lifecycle: this.lifecycleNode, lcLogs: {} };
    this.n = n; this.refreshEndpoints();
  }
  refreshEndpoints() {
    if (!this.n) return;
    const e = this.endpoints(), I = this.n.info;
    I.pubs = e.pubs || []; I.subs = e.subs || []; I.srvs = e.srvs || []; I.cli = e.cli || []; I.acts = e.acts || []; I.actc = e.actc || [];
    if (this.lifecycleNode) {
      I.srvs.push(["~/change_state", "lifecycle_msgs/srv/ChangeState"], ["~/get_state", "lifecycle_msgs/srv/GetState"], ["~/get_available_states", "lifecycle_msgs/srv/GetAvailableStates"], ["~/get_available_transitions", "lifecycle_msgs/srv/GetAvailableTransitions"], ["~/get_transition_graph", "lifecycle_msgs/srv/GetAvailableTransitions"]);
      I.pubs.push(["~/transition_event", "lifecycle_msgs/msg/TransitionEvent"]);
      if (this.state === "active" && this.bonded) { I.pubs.push(["/bond", "bond/msg/Status"]); I.subs.push(["/bond", "bond/msg/Status"]); }
    }
  }
  endpoints() { return {}; }
  log(level, text, logger) { this.sys.log(this, level, text, logger); }
  info(t, lg) { this.log("INFO", t, lg); } warn(t, lg) { this.log("WARN", t, lg); } error(t, lg) { this.log("ERROR", t, lg); }
  // a topic name of this node, resolved with its namespace and remappings (rcl rules for the plain cases)
  resolve(name) {
    const abs = (x) => (x.startsWith("/") ? x : x.startsWith("~/") ? `${this.full}/${x.slice(2)}` : `${this.ns}/${x}`);
    const r = abs(name); const hit = this.remaps.find(([f]) => abs(f) === r);
    return hit ? abs(hit[1]) : r;
  }
  setState(s) { this.state = s; if (this.n) this.n.lstate = s; this.refreshEndpoints(); }
  // lifecycle transitions; returns true / false, or "pending" (activation still waiting, e.g. for a transform)
  transition(t) {
    const L = LIFECYCLE[t]; if (!L) return false;
    if (L[0] && this.state !== L[0]) return false;
    if (t === "shutdown" && this.state === "finalized") return false;
    let ok = true;
    if (t === "configure") { this.info("Configuring"); ok = this.onConfigure() !== false; }
    if (t === "activate") { const r = this.onActivate(); if (r === "pending") return "pending"; ok = r !== false; if (ok && this.lifecycleNode && !this.noBond) { this.info(`Creating bond (${this.name}) to lifecycle manager.`); this.bonded = true; } }
    if (t === "deactivate") { this.info("Deactivating"); this.onDeactivate(); if (this.bonded) { this.info(`Destroying bond (${this.name}) to lifecycle manager.`); this.bonded = false; } }
    if (t === "cleanup") { this.info("Cleaning up"); this.onCleanup(); }
    if (t === "shutdown") { this.info("Shutting down"); this.onCleanup(); }
    if (!ok) return false;
    this.setState(L[1]);
    return true;
  }
  onConfigure() { return true; } onActivate() { this.info("Activating"); return true; } onDeactivate() {} onCleanup() {}
  announce(creating = "Creating") { if (this.lifecycleNode) this.info(`\n\t${this.name} lifecycle node launched. \n\tWaiting on external lifecycle transitions to activate\n\tSee https://design.ros2.org/articles/node_lifecycle.html for more information.`); if (creating) this.info(creating); }
  stop(rc = 0) {
    if (this.dead) return; this.dead = true;
    if (this.n) this.G.nodes = this.G.nodes.filter((x) => x !== this.n);
    for (const k of this.extraNodes || []) this.G.nodes = this.G.nodes.filter((x) => x !== k);
    if (this.exitFn) this.exitFn(rc);
  }
}

// ---------------------------------------------------------------- map_server / map_saver
class MapServer extends NavNode {
  constructor(sys, desc) { super(sys, "map_server", desc); this.announce(); }
  endpoints() { return { pubs: [["map", "nav_msgs/msg/OccupancyGrid"]], srvs: [["~/map", "nav_msgs/srv/GetMap"], ["~/load_map", "nav2_msgs/srv/LoadMap"]] }; }
  onConfigure() {
    const f = String(this.P.yaml_filename || "");
    if (!f) { this.warn(`yaml-filename parameter is empty, set map through '${this.full.slice(1)}/load_map'-service`); return true; }
    return this.load(f);
  }
  load(path) {
    const home = (this.fs && this.fs.home) || "/home/student";
    const p = path.startsWith("~/") ? home + path.slice(1) : path;
    const read = (x) => (this.fs ? this.fs.read(x) : null);
    const y = read(p);
    if (y == null) { this.info(`Loading yaml file: ${p}`, "map_io"); this.error(`Failed processing YAML file ${p} at position (0:0) for reason: bad file: ${p}`, "map_io"); this.error(`Caught exception in configure: Failed to load map yaml file: ${p}`); return false; }
    const r = C.loadMap(typeof y === "string" ? y : new TextDecoder().decode(y), p, read);
    for (const [lv, lg, t] of r.logs) this.log(lv, t, lg);
    if (r.error) return false;
    this.grid = r.grid; this.grid.frame = String(this.P.frame_id || "map");
    return true;
  }
  onActivate() { this.info("Activating"); if (this.grid) this.sys.setMap(this.resolve("map"), this.grid, this.full); return true; }
  onDeactivate() {}
}
class MapSaver extends NavNode {
  constructor(sys, desc, cli = false) { super(sys, cli ? "map_saver_cli" : "map_saver", { ...desc, name: desc.name || "map_saver" }); this.cli = cli; this.announce(); }
  endpoints() { return this.cli ? { subs: [["map", "nav_msgs/msg/OccupancyGrid"]] } : { srvs: [["~/save_map", "nav2_msgs/srv/SaveMap"]] }; }
  // nav2_map_server::MapSaver::saveMapTopicToFile; returns true on success
  save(topic, file, { free, occ, mode = "trinary", fmt = "" } = {}) {
    const home = (this.fs && this.fs.home) || "/home/student";
    let mapTopic = topic || "";
    file = String(file || "");
    this.info(`Saving map from '${mapTopic || "map"}' topic to '${file || "map"}' file`);
    if (!mapTopic) { mapTopic = "map"; this.warn(`Map topic unspecified. Map messages will be read from '${mapTopic}' topic`); }
    if (free === undefined) { free = num(this.P.free_thresh_default, 0.25); this.warn(`Free threshold unspecified. Setting it to default value: ${free.toFixed(6)}`); }
    if (occ === undefined) { occ = num(this.P.occupied_thresh_default, 0.65); this.warn(`Occupied threshold unspecified. Setting it to default value: ${occ.toFixed(6)}`); }
    if (!fmt) { fmt = "pgm"; this.warn(`Image format unspecified. Setting it to: ${fmt}`, "map_io"); }
    const t = mapTopic.startsWith("/") ? mapTopic : `/${mapTopic}`, m = this.sys.maps.get(t);
    if (!m) { this.error("Failed to spin map subscription"); return false; }
    if (!file) { file = "map"; this.warn(`Map file unspecified. Map will be saved to ${file} file`, "map_io"); }
    let base = file.startsWith("~/") ? home + file.slice(1) : file; if (!base.startsWith("/")) base = `${(this.fs && this.fs.cwd) || home}/${base}`;
    const g = m.grid; this.info(`Received a ${g.width} X ${g.height} map @ ${g.resolution} m/pix`, "map_io");
    const imgName = `${base.split("/").pop()}.${fmt}`, out = C.saveMap(g, { free, occ, mode, imageName: imgName });
    this.info(`Writing map occupancy data to ${base}.${fmt}`, "map_io");
    if (this.fs && this.fs.write) this.fs.write(`${base}.${fmt}`, out.pgm);
    this.info(`Writing map metadata to ${base}.yaml`, "map_io");
    if (this.fs && this.fs.write) this.fs.write(`${base}.yaml`, out.yaml + "\n");
    this.info("Map saved", "map_io");
    this.info("Map saved successfully");
    return true;
  }
}
// ros2 run nav2_map_server map_saver_cli [-f name] [--occ x] [--free x] [--fmt pgm] [--mode trinary] [-t topic]
function runMapSaverCli(sys, desc) {
  const argv = [].concat(desc.args || desc.argv || []), ri = argv.indexOf("--ros-args"), args = ri >= 0 ? argv.slice(0, ri) : argv;
  const o = { topic: "map", file: "" };
  const m = new MapSaver(sys, { ...desc, name: "map_saver" }, true);
  const bad = (t) => { m.log("ERROR", t, "map_saver_cli"); m.stop(255); return m; };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") { if (m.write) m.write("Usage:\n  map_saver_cli [arguments] [--ros-args ROS remapping args]\n\nArguments:\n  -h/--help\n  -t <map_topic>\n  -f <mapname>\n  --occ <threshold_occupied>\n  --free <threshold_free>\n  --fmt <image_format>\n  --mode trinary(default)/scale/raw\n\nNOTE: --ros-args should be passed at the end of command line\n", "out"); m.stop(0); return m; }
    const key = { "-t": "topic", "-f": "file", "--occ": "occ", "--free": "free", "--fmt": "fmt", "--mode": "mode" }[a];
    if (!key) return bad(`Wrong argument: ${a}`);
    if (i + 1 >= args.length) return bad(`Wrong argument: ${a} should be followed by a value.`);
    let v = args[++i];
    if (key === "occ" || key === "free") v = Number(v);
    if (key === "mode" && !["trinary", "scale", "raw"].includes(v)) { m.log("WARN", `Map mode parameter not recognized: ${v}, using default value (trinary)`, "map_saver_cli"); v = "trinary"; }
    o[key] = v;
  }
  m.info("Configuring");
  const run = () => { const ok = m.save(o.topic, o.file, { free: o.free, occ: o.occ, mode: o.mode, fmt: o.fmt }); if (!ok) m.error("Failed to save the map"); m.info("Destroying"); m.stop(ok ? 0 : 1); };
  // the map is transient local: an existing map arrives at once; else it waits save_map_timeout (2 s by default)
  const t0 = Date.now(), timeout = 1000 * num(m.P.save_map_timeout, 2.0);
  const poll = () => { if (m.dead) return; const t = o.topic.startsWith("/") ? o.topic : `/${o.topic}`; if (sys.maps.has(t) || Date.now() - t0 >= timeout) run(); else setTimeout(poll, 100); };
  if (desc.sync) run(); else setTimeout(poll, 0);
  return m;
}

// ---------------------------------------------------------------- costmap_2d (a node of its own inside planner / controller server)
class Costmap extends NavNode {
  constructor(sys, owner, which, desc) {
    super(sys, `${which}`, { ...desc, name: which, ns: `${owner.ns}/${which}`, remaps: owner.remaps }, { logName: `${which}.${which}`, paramName: which, paramNs: `${owner.ns}/${which}` });
    this.owner = owner; this.which = which; this.global = which === "global_costmap"; this.noBond = true;   // managed by its server, not bonded to the lifecycle manager
    const P = this.P;
    this.layers = [].concat(P.plugins || (this.global ? ["static_layer", "obstacle_layer", "inflation_layer"] : ["voxel_layer", "inflation_layer"]));
    this.frame = String(P.global_frame || (this.global ? "map" : "odom")); this.baseFrame = String(P.robot_base_frame || "base_link");
    this.rolling = bool(P.rolling_window, !this.global); this.res = num(P.resolution, 0.05);
    this.wm = num(P.width, 5); this.hm = num(P.height, 5);
    this.trackUnknown = bool(P.track_unknown_space, false);
    this.footprint = this.parseFootprint();
    this.obs = new Set();
    this.announce("Creating Costmap");
  }
  parseFootprint() {
    const P = this.P; let pts = null;
    if (P.footprint && P.footprint !== "[]") { try { const v = typeof P.footprint === "string" ? C.scalar(P.footprint) : P.footprint; if (Array.isArray(v) && v.length >= 3) pts = v.map((p) => [Number(p[0]), Number(p[1])]); } catch { pts = null; } if (!pts) this.error(`The footprint parameter is invalid: "${P.footprint}", using radius (${num(P.robot_radius, 0.1)}) instead`); }
    const r = num(P.robot_radius, 0.1);
    if (!pts) { pts = Array.from({ length: 16 }, (_, i) => [r * Math.cos((2 * Math.PI * i) / 16), r * Math.sin((2 * Math.PI * i) / 16)]); return { pts, inscribed: r, circumscribed: r, radius: r }; }
    let ins = Infinity, circ = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; ins = Math.min(ins, Math.abs(a[0] * dy - a[1] * dx) / L); circ = Math.max(circ, Math.hypot(a[0], a[1])); }
    return { pts, inscribed: ins, circumscribed: circ };
  }
  layerP(name) { return this.P[name] || {}; }
  layerType(name) { const p = String(this.layerP(name).plugin || ""); return /Static/.test(p) ? "static" : /Voxel/.test(p) ? "voxel" : /Obstacle/.test(p) ? "obstacle" : /Inflation/.test(p) ? "inflation" : /Range/.test(p) ? "range" : name.includes("static") ? "static" : name.includes("inflation") ? "inflation" : name.includes("voxel") ? "voxel" : "obstacle"; }
  endpoints() {
    const e = { pubs: [["costmap", "nav_msgs/msg/OccupancyGrid"], ["costmap_raw", "nav2_msgs/msg/Costmap"], ["costmap_updates", "map_msgs/msg/OccupancyGridUpdate"], ["costmap_raw_updates", "nav2_msgs/msg/CostmapUpdate"], ["published_footprint", "geometry_msgs/msg/PolygonStamped"]], subs: [["footprint", "geometry_msgs/msg/Polygon"]],
      srvs: [[`clear_entirely_${this.which}`, "nav2_msgs/srv/ClearEntireCostmap"], [`clear_around_${this.which}`, "nav2_msgs/srv/ClearCostmapAroundRobot"], [`clear_except_${this.which}`, "nav2_msgs/srv/ClearCostmapExceptRegion"], [`get_cost_${this.which}`, "nav2_msgs/srv/GetCosts"]] };
    for (const l of this.layers) {
      const t = this.layerType(l);
      if (t === "static") e.subs.push(["/map", "nav_msgs/msg/OccupancyGrid"]);
      if (t === "obstacle" || t === "voxel") { const lp = this.layerP(l); for (const src of String(lp.observation_sources || "").split(/\s+/).filter(Boolean)) { const sp = lp[src] || {}; e.subs.push([String(sp.topic || src).startsWith("/") ? String(sp.topic || src) : `/${sp.topic || src}`, sp.data_type === "PointCloud2" ? "sensor_msgs/msg/PointCloud2" : "sensor_msgs/msg/LaserScan"]); } if (t === "voxel" && bool(lp.publish_voxel_map, false)) e.pubs.push([`${l}/voxel_grid`, "nav2_msgs/msg/VoxelGrid"]); }
    }
    return e;
  }
  onConfigure() {
    for (const l of this.layers) {
      this.info(`Using plugin "${l}"`);
      const t = this.layerType(l), lp = this.layerP(l);
      if (t === "static") this.info(`Subscribing to the map topic (/map) with ${bool(lp.map_subscribe_transient_local, true) ? "transient local" : "volatile"} durability`);
      if (t === "obstacle" || t === "voxel") this.info(`Subscribed to Topics: ${String(lp.observation_sources || "").trim()}`);
      this.info(`Initialized plugin "${l}"`);
    }
    const m = this.sys.maps.get("/map"); if (m) this.onMap("/map", m.grid);   // the static layer's map topic is transient local
    return true;
  }
  onActivate() {
    if (!this.actLogged) { this.info("Activating"); this.actLogged = true; }
    // Costmap2DROS::on_activate waits for global_frame <- robot_base_frame (2 Hz, initial_transform_timeout 60 s)
    if (!this.sys.basePose(this.frame)) {
      const w = this.sys.wall();
      if (this.tfWait === undefined) { this.tfWait = w; this.info("Checking transform"); this.tfLast = -1; }
      if (w - this.tfLast >= 0.5) { this.tfLast = w; this.info(`Timed out waiting for transform from ${this.baseFrame} to ${this.frame} to become available, tf error: Invalid frame ID "${this.frame}" passed to canTransform argument target_frame - frame does not exist`); }
      if (w - this.tfWait > num(this.P.initial_transform_timeout, 60)) { this.error(`Failed to activate ${this.which} because transform from ${this.baseFrame} to ${this.frame} did not become available before timeout`); this.tfWait = undefined; this.actLogged = false; return false; }
      return "pending";
    }
    if (this.tfWait === undefined) this.info("Checking transform");
    this.tfWait = undefined; this.actLogged = false; this.lastUpd = -1e9; this.lastPub = -1e9;
    return true;
  }
  onMap(topic, grid) {
    if (!this.layers.some((l) => this.layerType(l) === "static") || topic !== "/map") return;
    if (!this.staticGrid || this.staticGrid.w !== grid.width || this.staticGrid.h !== grid.height) this.info(`StaticLayer: Resizing costmap to ${grid.width} X ${grid.height} at ${grid.resolution.toFixed(6)} m/pix`);
    this.staticGrid = C.staticFromGrid(grid, this.trackUnknown);
  }
  clear() { this.obs.clear(); this.lastUpd = -1e9; }
  key(ix, iy) { return (ix + 100000) * 1000000 + (iy + 100000); }
  update(t, force = false) {
    if (this.state !== "active") return;
    if (!force && t - this.lastUpd < 1 / Math.max(0.1, num(this.P.update_frequency, this.global ? 1 : 5))) return;
    const pose = this.sys.basePose(this.frame); if (!pose) return;
    this.lastUpd = t; this.pose = pose;
    // obstacle / voxel layers: clear along the rays, mark the hits (2D: the voxel layer's columns projected)
    const obsLayer = this.layers.find((l) => ["obstacle", "voxel"].includes(this.layerType(l)));
    const scan = obsLayer ? this.sys.scan() : null;
    if (scan) {
      const lp = this.layerP(obsLayer), src = lp[String(lp.observation_sources || "scan").split(/\s+/)[0]] || {};
      const markMax = num(src.obstacle_max_range, 2.5), clearMax = num(src.raytrace_max_range, 3.0);
      const { sensor, points } = this.sys.scanPoints(scan, pose);
      const r = this.res, sc = [Math.floor(sensor.x / r), Math.floor(sensor.y / r)];
      for (const [px, py, rr] of points) {
        if (bool(src.clearing, true)) { const cr = Math.min(rr, clearMax), ex = sensor.x + ((px - sensor.x) * cr) / rr, ey = sensor.y + ((py - sensor.y) * cr) / rr; for (const [cx, cy] of C.line(sc[0], sc[1], Math.floor(ex / r), Math.floor(ey / r))) this.obs.delete(this.key(cx, cy)); }
        if (bool(src.marking, true) && rr <= markMax) this.obs.add(this.key(Math.floor(px / r), Math.floor(py / r)));
      }
    }
    // the master grid: static layer (or the rolling window), obstacles, inflation
    let g;
    if (this.rolling || !this.staticGrid) {
      const w = Math.round(this.wm / this.res), h = Math.round(this.hm / this.res);
      const ox = this.rolling ? Math.floor((pose.x - this.wm / 2) / this.res) * this.res : this.staticGrid ? this.staticGrid.ox : -this.wm / 2;
      const oy = this.rolling ? Math.floor((pose.y - this.hm / 2) / this.res) * this.res : this.staticGrid ? this.staticGrid.oy : -this.hm / 2;
      g = new C.Grid(w, h, this.res, ox, oy, this.trackUnknown ? C.NO_INFO : C.FREE);
      if (this.staticGrid) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [wx, wy] = g.toWorld(x, y); g.data[y * w + x] = this.staticGrid.at(wx, wy); }
    } else g = this.staticGrid.clone();
    const r = this.res;
    for (const k of this.obs) { const ix = Math.floor(k / 1000000) - 100000, iy = (k % 1000000) - 100000; const m = g.toMap((ix + 0.5) * r, (iy + 0.5) * r); if (m) g.data[m[1] * g.w + m[0]] = C.LETHAL; }
    const inf = this.layers.find((l) => this.layerType(l) === "inflation");
    if (inf) { const ip = this.layerP(inf); C.inflate(g, this.footprint.inscribed, num(ip.inflation_radius, 0.55), num(ip.cost_scaling_factor, 10), bool(ip.inflate_unknown, false)); }
    this.grid = g; this.ver = (this.ver || 0) + 1;
  }
  cost(x, y) { return this.grid ? this.grid.at(x, y) : C.NO_INFO; }
  footprintAt(pose) { return this.footprint.pts.map(([x, y]) => [pose.x + Math.cos(pose.yaw) * x - Math.sin(pose.yaw) * y, pose.y + Math.sin(pose.yaw) * x + Math.cos(pose.yaw) * y]); }
}

// ---------------------------------------------------------------- amcl
class Amcl extends NavNode {
  constructor(sys, desc) { super(sys, "amcl", desc); this.announce(); }
  endpoints() { return { subs: [["map", "nav_msgs/msg/OccupancyGrid"], [String(this.P.scan_topic || "scan"), "sensor_msgs/msg/LaserScan"], ["initialpose", "geometry_msgs/msg/PoseWithCovarianceStamped"]], pubs: [["amcl_pose", "geometry_msgs/msg/PoseWithCovarianceStamped"], ["particle_cloud", "nav2_msgs/msg/ParticleCloud"], ...(bool(this.P.tf_broadcast, true) && this.pf && this.pf.ps.length && this.state === "active" ? [["/tf", "tf2_msgs/msg/TFMessage"]] : [])], srvs: [["reinitialize_global_localization", "std_srvs/srv/Empty"], ["request_nomotion_update", "std_srvs/srv/Empty"], ["set_initial_pose", "nav2_msgs/srv/SetInitialPose"]] }; }
  onConfigure() {
    const P = this.P;
    if (num(P.max_particles, 2000) < num(P.min_particles, 500)) this.warn("You've set min_particles to be greater than max particles, this isn't allowed so max_particles will be set to min_particles.");
    this.globalFrame = String(P.global_frame_id || "map"); this.odomFrameId = String(P.odom_frame_id || "odom"); this.baseFrame = String(P.base_frame_id || "base_footprint");
    return true;
  }
  onActivate() {
    this.info("Activating");
    const m = this.sys.maps.get(this.resolve(String(this.P.map_topic || "map")));
    if (m) this.onMap(this.resolve(String(this.P.map_topic || "map")), m.grid);
    if (bool(this.P.set_initial_pose, false)) { const ip = this.P.initial_pose || {}; this.setPose({ x: num(ip.x, 0), y: num(ip.y, 0), yaw: num(ip.yaw, 0) }, null); }
    this.lastWarn = -1e9;
    return true;
  }
  onDeactivate() { if (this.sys.mapOdomBy === this.full) this.sys.setMapOdom(null, null); }
  onMap(topic, grid) {
    if (topic !== this.resolve(String(this.P.map_topic || "map")) || this.state !== "active" && this.state !== "inactive") return;
    if (this.mapGrid === grid) return;
    if (this.mapGrid && bool(this.P.first_map_only, false)) return;
    this.mapGrid = grid; this.info(`Received a ${grid.width} X ${grid.height} map @ ${grid.resolution.toFixed(3)} m/pix`);
    const keep = this.pf; this.pf = new C.ParticleFilter(this.P, grid);
    if (keep && keep.ps.length) { this.pf.ps = keep.ps; this.pf.est = keep.est; this.pf.cov = keep.cov; }
  }
  // /initialpose (RViz "2D Pose Estimate") or set_initial_pose: AMCL takes it in the global frame
  initialPose(msg) {
    this.info("initialPoseReceived");
    if (this.state !== "active") { this.warn("Received initial pose request, but AMCL is not yet in the active state"); return false; }
    const frame = (msg.header && msg.header.frame_id) || "";
    if (frame !== this.globalFrame) { this.warn(`Ignoring initial pose in frame "${frame}"; initial poses must be in the global frame, "${this.globalFrame}"`); return false; }
    const p = msg.pose.pose, cov = (msg.pose.covariance && msg.pose.covariance.length === 36) ? msg.pose.covariance.map(Number) : null;
    const pose = { x: p.position.x, y: p.position.y, yaw: yawOfQ(p.orientation) };
    if (this.mapGrid) { const g = this.mapGrid, mx = Math.floor((pose.x - g.origin[0]) / g.resolution), my = Math.floor((pose.y - g.origin[1]) / g.resolution); if (mx < 0 || my < 0 || mx >= g.width || my >= g.height) { this.error("Received initialpose from message is out of the size of map. Rejecting."); return false; } }
    this.setPose(pose, cov);
    return true;
  }
  setPose(pose, cov) {
    if (!this.pf) { if (!this.mapGrid) { this.pending = { pose, cov }; return; } this.pf = new C.ParticleFilter(this.P, this.mapGrid); }
    const c = cov || (() => { const a = Array(36).fill(0); a[0] = 0.25; a[7] = 0.25; a[35] = 0.06853891945200942; return a; })();
    this.info(`Setting pose (${this.sys.now().toFixed(6)}): ${pose.x.toFixed(3)} ${pose.y.toFixed(3)} ${pose.yaw.toFixed(3)}`);
    this.pf.init(pose, c);
    const o = this.sys.odom(); this.lastOdom = o; this.odomAtFilter = o; this.updates = 0; this.forceUpdate = true;
    if (o) this.sys.setMapOdom(compose(pose, inverse(o)), this.full);
    this.pubT = this.sys.now(); this.refreshEndpoints();
  }
  tick(t) {
    if (this.state !== "active") return;
    if (this.pending && this.mapGrid) { const p = this.pending; this.pending = null; this.setPose(p.pose, p.cov); }
    const scan = this.sys.scan(); if (!scan) return;
    if (scan.seq === this.lastScanSeq) return; this.lastScanSeq = scan.seq;
    if (!this.mapGrid) return;
    if (!this.pf || !this.pf.ps.length || !this.odomAtFilter) {
      if (t - this.lastWarn >= 2) { this.lastWarn = t; this.warn("AMCL cannot publish a pose or update the transform. Please set the initial pose..."); }
      return;
    }
    const o = this.sys.odom(); if (!o) return;
    const d = Math.hypot(o.x - this.odomAtFilter.x, o.y - this.odomAtFilter.y), a = Math.abs(wrap(o.yaw - this.odomAtFilter.yaw));
    if (this.forceUpdate || d >= num(this.P.update_min_d, 0.25) || a >= num(this.P.update_min_a, 0.2)) {
      this.pf.motion(this.odomAtFilter, o);
      // the laser model: max_beams beams of the scan, in the laser frame
      const n = scan.ranges.length, step = Math.max(1, Math.floor(n / Math.max(2, num(this.P.max_beams, 60)))), beams = [];
      const rmax = Math.min(scan.range_max, num(this.P.laser_max_range, 100) > 0 ? num(this.P.laser_max_range, 100) : scan.range_max);
      for (let i = 0; i < n; i += step) { const r = scan.ranges[i]; beams.push([Number.isFinite(r) && r >= scan.range_min ? r : rmax, scan.angle_min + i * scan.angle_increment]); }
      beams.rangeMax = rmax;
      this.pf.sensor(beams, scan.offset);
      this.updates++;
      if (this.updates % Math.max(1, num(this.P.resample_interval, 1)) === 0) this.pf.resample();
      this.odomAtFilter = o; this.forceUpdate = false;
      this.sys.setMapOdom(compose(this.pf.est, inverse(o)), this.full);
      this.pubT = t; this.pubCount = (this.pubCount || 0) + 1;
    }
  }
  pose() { return this.pf && this.pf.ps.length ? this.pf.est : null; }
}

// ---------------------------------------------------------------- planner_server
const plannerKind = (plugin) => (/Smac/.test(plugin) ? "smac" : /ThetaStar/.test(plugin) ? "theta" : "navfn");
class PlannerServer extends NavNode {
  constructor(sys, desc) {
    super(sys, "planner", desc); this.announce();
    this.costmap = new Costmap(sys, this, "global_costmap", desc); this.costmap.attach(); this.extraNodes = [this.costmap.n];
  }
  get ids() { return [].concat(this.P.planner_plugins || ["GridBased"]); }
  endpoints() { return { pubs: [["plan", "nav_msgs/msg/Path"]], acts: [["compute_path_to_pose", "nav2_msgs/action/ComputePathToPose"], ["compute_path_through_poses", "nav2_msgs/action/ComputePathThroughPoses"]], srvs: [["~/is_path_valid", "nav2_msgs/srv/IsPathValid"]] }; }
  onConfigure() {
    this.costmap.transition("configure");
    if (this.costmap.staticGrid) this.info(`Costmap size: ${this.costmap.staticGrid.w},${this.costmap.staticGrid.h}`);
    for (const id of this.ids) { const pl = String((this.P[id] || {}).plugin || "nav2_navfn_planner::NavfnPlanner"); this.info(`Created global planner plugin ${id} of type ${pl}`); if (plannerKind(pl) === "navfn") this.info(`Configuring plugin ${id} of type NavfnPlanner`); }
    this.info(`Planner Server has ${this.ids.join(" ")}  planners available.`);
    const f = num(this.P.expected_planner_frequency, 1.0); if (f <= 0) this.warn(`The expected planner frequency parameter is ${f.toFixed(4)} Hz. The value should to be greater than 0.0 to turn on duration overrrun warning messages`);
    return true;
  }
  onActivate() {
    if (!this.actStarted) { this.info("Activating"); this.actStarted = true; }
    const r = this.costmap.state === "active" ? true : this.costmap.transition("activate");
    if (r === "pending") return "pending";
    this.actStarted = false;
    if (r === false) return false;
    for (const id of this.ids) if (plannerKind(String((this.P[id] || {}).plugin || "")) === "navfn") this.info(`Activating plugin ${id} of type NavfnPlanner`);
    return true;
  }
  onDeactivate() { this.costmap.transition("deactivate"); }
  onMap(topic, grid) { this.costmap.onMap(topic, grid); }
  tick(t) { this.costmap.update(t); }
  // ComputePathToPose: { path } or { code, message }
  compute(goal, plannerId) {
    if (this.state !== "active") return { code: 200, message: "Action server is inactive" };
    const id = plannerId || this.ids[0], pp = this.P[id];
    if (!pp && plannerId) { this.error(`planner ${plannerId} is not a valid planner. Planner names are: ${this.ids.join(" ")}`); return { code: 201, message: "invalid planner" }; }
    const start = this.sys.basePose(this.costmap.frame);
    if (!start) return { code: 202, message: "Could not transform the start or goal pose in the costmap frame" };
    this.costmap.update(this.sys.now(), !this.costmap.grid);
    if (!this.costmap.grid) return { code: 200, message: "no costmap" };
    const plugin = String((pp || {}).plugin || "nav2_navfn_planner::NavfnPlanner"), kind = plannerKind(plugin);
    const r = C.planPath(this.costmap.grid, start, goal, { kind, astar: bool((pp || {}).use_astar, false), tolerance: num((pp || {}).tolerance, kind === "navfn" ? 0.5 : 0.25), allowUnknown: bool((pp || {}).allow_unknown, true), costPenalty: num((pp || {}).cost_penalty, 2.0) });
    if (r.code) { this.warn(`${id} plugin failed to plan from (${start.x.toFixed(2)}, ${start.y.toFixed(2)}) to (${goal.x.toFixed(2)}, ${goal.y.toFixed(2)}): "${r.message}"`); return r; }
    const path = r.path.map(([x, y], i, a) => { const n = a[Math.min(i + 1, a.length - 1)], p = a[Math.max(0, i - 1)]; return { x, y, yaw: i === a.length - 1 ? goal.yaw : Math.atan2(n[1] - p[1], n[0] - p[0]) }; });
    this.plan = { poses: path, frame: this.costmap.frame, t: this.sys.now(), count: (this.plan ? this.plan.count : 0) + 1 };
    return { path };
  }
}

// ---------------------------------------------------------------- controller_server (+ goal checker, progress checker)
class ControllerServer extends NavNode {
  constructor(sys, desc) {
    super(sys, "controller", desc); this.announce("Creating controller server");
    this.costmap = new Costmap(sys, this, "local_costmap", desc); this.costmap.attach(); this.extraNodes = [this.costmap.n];
    this.vel = { vx: 0, wz: 0 };
  }
  get ids() { return [].concat(this.P.controller_plugins || ["FollowPath"]); }
  stamped() { return bool(this.P.enable_stamped_cmd_vel, true); }
  endpoints() { return { subs: [["odom", "nav_msgs/msg/Odometry"], ["speed_limit", "nav2_msgs/msg/SpeedLimit"]], pubs: [["cmd_vel", this.stamped() ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist"], ["local_plan", "nav_msgs/msg/Path"], ["received_global_plan", "nav_msgs/msg/Path"], ["transformed_global_plan", "nav_msgs/msg/Path"], ["evaluation", "dwb_msgs/msg/LocalPlanEvaluation"], ["marker", "visualization_msgs/msg/MarkerArray"], ["cost_cloud", "sensor_msgs/msg/PointCloud2"]], acts: [["follow_path", "nav2_msgs/action/FollowPath"]] }; }
  onConfigure() {
    const P = this.P;
    this.info("Configuring controller interface");
    this.info("getting progress checker plugins..");
    this.info("getting goal checker plugins..");
    this.info(`Controller frequency set to ${num(P.controller_frequency, 20).toFixed(4)}Hz`);
    this.costmap.transition("configure");
    const pcs = [].concat(P.progress_checker_plugins || ["progress_checker"]), gcs = [].concat(P.goal_checker_plugins || ["goal_checker"]);
    for (const p of pcs) this.info(`Created progress_checker : ${p} of type ${(P[p] || {}).plugin || "nav2_controller::SimpleProgressChecker"}`);
    this.info(`Controller Server has ${pcs.join(" ")}  progress checkers available.`);
    for (const g of gcs) this.info(`Created goal checker : ${g} of type ${(P[g] || {}).plugin || "nav2_controller::SimpleGoalChecker"}`);
    this.info(`Controller Server has ${gcs.join(" ")}  goal checkers available.`);
    for (const id of this.ids) {
      const cp = P[id] || {}, pl = String(cp.plugin || "dwb_core::DWBLocalPlanner");
      this.info(`Created controller : ${id} of type ${pl}`);
      if (/DWB/.test(pl)) { this.info(`Setting transform_tolerance to ${num(cp.transform_tolerance, 0.1).toFixed(6)}`); for (const c of [].concat(cp.critics || [])) { this.info(`Using critic "${c}" (dwb_critics::${c}Critic)`); this.info("Critic plugin initialized"); } }
    }
    this.info(`Controller Server has ${this.ids.join(" ")}  controllers available.`);
    this.pc = P[pcs[0]] || {}; this.gc = P[gcs[0]] || {};
    return true;
  }
  onActivate() {
    if (!this.actStarted) { this.info("Activating"); this.actStarted = true; }
    const r = this.costmap.state === "active" ? true : this.costmap.transition("activate");
    if (r === "pending") return "pending";
    this.actStarted = false; return r !== false;
  }
  onDeactivate() { this.costmap.transition("deactivate"); this.cancel(); }
  onMap(topic, grid) { this.costmap.onMap(topic, grid); }
  cmdTopic() { return this.resolve("cmd_vel"); }
  // FollowPath: path in the global frame; onDone(code) (0 = reached)
  follow(path, frame, controllerId, onDone) {
    if (this.state !== "active") { onDone(100); return; }
    const id = controllerId || this.ids[0];
    if (controllerId && !this.P[controllerId] && this.ids.length && !this.ids.includes(controllerId)) { this.error(`FollowPath called with controller name ${controllerId}, which does not exist. Available controllers are: ${this.ids.join(" ")}.`); onDone(101); return; }
    if (!this.job) { this.info("Received a goal, begin computing control effort."); this.job = { id, onDone, start: this.sys.now(), lastCtl: -1e9, latched: false, pcPose: null, pcT: this.sys.now(), failT: null }; }
    else this.info("Passing new path to controller.");
    this.job.path = path; this.job.frame = frame; this.job.onDone = onDone;
  }
  cancel() { if (this.job) { this.job = null; this.publish({ vx: 0, wz: 0 }); } }
  publish(v) { this.vel = v; this.sys.publishTwist(this.cmdTopic(), v, this.stamped(), this.full); }
  tick(t, dt) {
    this.costmap.update(t);
    const J = this.job; if (!J || this.state !== "active") return;
    const period = 1 / Math.max(1, num(this.P.controller_frequency, 20)); if (t - J.lastCtl < period - 1e-9) return;
    const cdt = Math.min(0.5, t - J.lastCtl); J.lastCtl = t;
    const finish = (code) => { this.job = null; this.publish({ vx: 0, wz: 0 }); if (code === 0) this.info("Reached the goal!"); J.onDone(code); };
    // the path into the controller's frame (local costmap: odom); robot pose there
    const pose = this.sys.basePose(this.costmap.frame), toLocal = J.frame === this.costmap.frame ? { x: 0, y: 0, yaw: 0 } : this.sys.mapOdom ? inverse(this.sys.mapOdom) : null;
    if (!pose || !toLocal) { finish(102); return; }
    const pts = J.path.map((p) => compose(toLocal, p)), goalPose = pts[pts.length - 1];
    // goal checker (SimpleGoalChecker, stateful)
    const xyTol = num(this.gc.xy_goal_tolerance, 0.25), yawTol = num(this.gc.yaw_goal_tolerance, 0.25), dGoal = Math.hypot(goalPose.x - pose.x, goalPose.y - pose.y);
    if (dGoal <= xyTol && bool(this.gc.stateful, true)) J.latched = true;
    if ((dGoal <= xyTol || J.latched) && Math.abs(wrap(goalPose.yaw - pose.yaw)) <= yawTol) { finish(0); return; }
    // progress checker (SimpleProgressChecker)
    if (!J.pcPose || Math.hypot(pose.x - J.pcPose.x, pose.y - J.pcPose.y) > num(this.pc.required_movement_radius, 0.5)) { J.pcPose = pose; J.pcT = t; }
    else if (!J.latched && t - J.pcT > num(this.pc.movement_time_allowance, 10)) { this.error("Failed to make progress"); finish(105); return; }
    // local plan: the pruned path inside the local costmap
    const ci = C.closestIndex(pts.map((p) => [p.x, p.y]), pose.x, pose.y, J.ci || 0); J.ci = ci;
    const half = Math.min(this.costmap.wm, this.costmap.hm) / 2;
    const cg = this.costmap.grid, inGrid = (p) => { if (!cg) return Math.abs(p.x - pose.x) <= half && Math.abs(p.y - pose.y) <= half; const m = cg.toMap(p.x, p.y); return m && m[0] > 0 && m[1] > 0 && m[0] < cg.w - 1 && m[1] < cg.h - 1; };
    const local = []; for (let i = ci; i < pts.length; i++) { const p = pts[i]; if (!inGrid(p)) break; local.push([p.x, p.y]); }
    const cp = this.P[J.id] || {}, pl = String(cp.plugin || "dwb_core::DWBLocalPlanner");
    const st = { pose, vel: this.vel, path: pts, localPath: local.length ? local : [[goalPose.x, goalPose.y]], cost: (x, y) => this.costmap.cost(x, y), dt: cdt, goalPose, xyTol, latched: J.latched, res: this.costmap.res, lastW: this.vel.wz, grid: this.costmap.grid, stats: this.debug ? { valid: 0, invalid: 0 } : null };
    const v = /RegulatedPurePursuit/.test(pl) ? C.rppCommand(cp, st) : C.dwbCommand(cp, st);
    if (this.debug) this.lastDebug = { v, stats: st.stats, vel: { ...this.vel }, cdt, local: local.length, pose };
    if (v.noValid) {
      if (J.failT === null) J.failT = t;
      this.publish({ vx: 0, wz: 0 });
      if (t - J.failT >= num(this.P.failure_tolerance, 0)) { this.error(/RegulatedPurePursuit/.test(pl) ? "RegulatedPurePursuitController detected collision ahead!" : `No valid trajectories out of ${num(cp.vx_samples, 20) * num(cp.vtheta_samples, 20)}! `); finish(/RegulatedPurePursuit/.test(pl) ? 106 : 106); }
      return;
    }
    J.failT = null;
    this.local = { poses: local.map(([x, y]) => ({ x, y, yaw: 0 })), frame: this.costmap.frame, t };
    this.publish({ vx: v.vx, wz: v.wz });
  }
}

// ---------------------------------------------------------------- behavior_server (spin, backup, drive_on_heading, wait)
class BehaviorServer extends NavNode {
  constructor(sys, desc) { super(sys, "behavior", desc); this.announce(); }
  get ids() { return [].concat(this.P.behavior_plugins || ["spin", "backup", "drive_on_heading", "wait"]); }
  stamped() { return bool(this.P.enable_stamped_cmd_vel, true); }
  actionType(id) { const pl = String((this.P[id] || {}).plugin || id); const t = pl.split(/::|\//).pop(); return `nav2_msgs/action/${{ Spin: "Spin", BackUp: "BackUp", DriveOnHeading: "DriveOnHeading", Wait: "Wait", AssistedTeleop: "AssistedTeleop" }[t] || t}`; }
  endpoints() { return { pubs: [["cmd_vel", this.stamped() ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist"]], subs: [[String(this.P.local_costmap_topic || "local_costmap/costmap_raw"), "nav2_msgs/msg/Costmap"], [String(this.P.local_footprint_topic || "local_costmap/published_footprint"), "geometry_msgs/msg/PolygonStamped"], [String(this.P.global_costmap_topic || "global_costmap/costmap_raw"), "nav2_msgs/msg/Costmap"], [String(this.P.global_footprint_topic || "global_costmap/published_footprint"), "geometry_msgs/msg/PolygonStamped"]], acts: this.ids.map((id) => [id, this.actionType(id)]) }; }
  onConfigure() { for (const id of this.ids) this.info(`Creating behavior plugin ${id} of type ${(this.P[id] || {}).plugin || id}`); for (const id of this.ids) this.info(`Configuring ${id}`); return true; }
  onActivate() { this.info("Activating"); for (const id of this.ids) this.info(`Activating ${id}`); return true; }
  // run a behavior; onDone(code) 0 = success
  run(kind, args, onDone) {
    const id = this.ids.find((x) => this.actionType(x).endsWith("/" + kind)) || this.ids.find((x) => x === kind.toLowerCase()) || kind.toLowerCase();
    if (this.state !== "active") { this.warn("Called while inactive, ignoring request."); onDone(1); return; }
    const o = this.sys.odom(); if (!o) { this.error("Current robot pose is not available."); onDone(kind === "Spin" ? 702 : 712); return; }
    this.info(`Running ${id}`);
    if (kind === "Spin") this.info(`Turning ${num(args.target_yaw, 1.57).toFixed(2)} for spin behavior.`);
    this.job = { id, kind, args, onDone, t0: this.sys.now(), o0: o, last: o, turned: 0 };
  }
  cancel() { if (this.job) { this.info(`Canceling ${this.job.id}`); this.job = null; this.sys.publishTwist(this.resolve("cmd_vel"), { vx: 0, wz: 0 }, this.stamped(), this.full); } }
  tick(t) {
    const J = this.job; if (!J) return;
    if (t - (J.lastCyc || -1e9) < 1 / num(this.P.cycle_frequency, 10) - 1e-9) return; J.lastCyc = t;
    const o = this.sys.odom(), pub = (vx, wz) => this.sys.publishTwist(this.resolve("cmd_vel"), { vx, wz }, this.stamped(), this.full);
    const done = (code, msg) => { this.job = null; pub(0, 0); if (msg) this.warn(msg); if (code === 0) this.info(`${J.id} completed successfully`); else this.warn(`${J.id} failed`); J.onDone(code); };
    const allow = num(J.args.time_allowance, 10);
    if (J.kind === "Wait") { if (t - J.t0 >= num(J.args.time, 5)) done(0); return; }
    if (t - J.t0 > allow) { done(J.kind === "Spin" ? 701 : 711, J.kind === "Spin" ? "Exceeded time allowance before reaching the Spin goal - Exiting Spin" : `Exceeded time allowance before reaching the ${J.kind === "BackUp" ? "DriveOnHeading" : J.kind} goal - Exiting ${J.kind === "BackUp" ? "DriveOnHeading" : J.kind}`); return; }
    const local = this.sys.model("controller") && this.sys.model("controller").costmap;
    if (J.kind === "Spin") {
      J.turned += Math.abs(wrap(o.yaw - J.last.yaw)); J.last = o;
      const target = Math.abs(num(J.args.target_yaw, 1.57)), rem = target - J.turned;
      if (rem <= 0.02) { done(0); return; }
      const maxW = num(this.P.max_rotational_vel, 1.0), minW = num(this.P.min_rotational_vel, 0.4), acc = num(this.P.rotational_acc_lim, 3.2);
      const w = Math.max(minW, Math.min(maxW, Math.sqrt(2 * acc * rem)));
      pub(0, Math.sign(num(J.args.target_yaw, 1.57)) * w);
      return;
    }
    // BackUp / DriveOnHeading: distance along the heading, collision check simulate_ahead_time on the local costmap
    const dist = num(J.args.target ? J.args.target.x : J.args.dist, J.kind === "BackUp" ? -0.3 : 0.3), speed = num(J.args.speed, J.kind === "BackUp" ? -0.15 : 0.15);
    const moved = Math.hypot(o.x - J.o0.x, o.y - J.o0.y);
    if (moved >= Math.abs(dist)) { done(0); return; }
    if (local && local.grid) {
      const lp = this.sys.basePose(local.frame), ahead = num(this.P.simulate_ahead_time, 2.0), sgn = Math.sign(speed || dist);
      const remain = Math.abs(dist) - moved;
      for (let k = 1; k <= 10; k++) { const s = Math.min(Math.abs(speed) * ahead, remain) * k / 10; const px = lp.x + sgn * s * Math.cos(lp.yaw), py = lp.y + sgn * s * Math.sin(lp.yaw); if (local.cost(px, py) === C.LETHAL) { done(J.kind === "Spin" ? 703 : 714, "Collision Ahead - Exiting DriveOnHeading"); return; } }
    }
    pub(Math.sign(speed || dist) * Math.abs(speed), 0);
  }
}

// ---------------------------------------------------------------- velocity_smoother / collision_monitor
class VelocitySmoother extends NavNode {
  constructor(sys, desc) { super(sys, "velsmoother", desc); this.announce(); this.out = { vx: 0, wz: 0 }; this.target = null; }
  stamped() { return bool(this.P.enable_stamped_cmd_vel, true); }
  endpoints() { const T = this.stamped() ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist"; return { subs: [["cmd_vel", T], [String(this.P.odom_topic || "odom"), "nav_msgs/msg/Odometry"]], pubs: [["cmd_vel_smoothed", T]] }; }
  onConfigure() { this.info("Configuring velocity smoother"); const fb = String(this.P.feedback || "OPEN_LOOP"); if (!["OPEN_LOOP", "CLOSED_LOOP"].includes(fb)) { this.error("Invalid feedback_type, options are OPEN_LOOP and CLOSED_LOOP."); return false; } return true; }
  cmdIn() { return this.state === "active" ? this.resolve("cmd_vel") : null; }
  onTwist(v) { this.target = { ...v }; this.lastIn = this.sys.now(); }
  tick(t) {
    if (this.state !== "active" || !this.target) return;
    const f = num(this.P.smoothing_frequency, 20); if (t - (this.lastOut || -1e9) < 1 / f - 1e-9) return;
    const dt = Math.min(0.5, t - (this.lastOut ?? t - 1 / f)); this.lastOut = t;
    const mx = [].concat(this.P.max_velocity || [0.5, 0, 2.5]).map(Number), mn = [].concat(this.P.min_velocity || [-0.5, 0, -2.5]).map(Number), acc = [].concat(this.P.max_accel || [2.5, 0, 3.2]).map(Number), dec = [].concat(this.P.max_decel || [-2.5, 0, -3.2]).map(Number);
    let target = this.target;
    if (t - this.lastIn > num(this.P.velocity_timeout, 1.0)) { if (this.out.vx === 0 && this.out.wz === 0) { this.target = null; return; } target = { vx: 0, wz: 0 }; }
    const step = (cur, tg, a, d) => { const dv = tg - cur, lim = (Math.abs(tg) >= Math.abs(cur) && Math.sign(tg) * Math.sign(cur) >= 0 ? a : -d) * dt; return cur + Math.max(-lim, Math.min(lim, dv)); };
    let vx = Math.max(mn[0], Math.min(mx[0], target.vx)), wz = Math.max(mn[2], Math.min(mx[2], target.wz));
    vx = step(this.out.vx, vx, acc[0], dec[0]); wz = step(this.out.wz, wz, acc[2], dec[2]);
    if (bool(this.P.scale_velocities, false)) { /* the same limits per axis here */ }
    this.out = { vx, wz };
    this.sys.publishTwist(this.resolve("cmd_vel_smoothed"), this.out, this.stamped(), this.full);
  }
}
class CollisionMonitor extends NavNode {
  constructor(sys, desc) { super(sys, "collision", desc); this.announce(); this.stateTxt = ""; }
  stamped() { return bool(this.P.enable_stamped_cmd_vel, true); }
  endpoints() {
    const T = this.stamped() ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist", e = { subs: [[String(this.P.cmd_vel_in_topic || "cmd_vel_smoothed"), T]], pubs: [[String(this.P.cmd_vel_out_topic || "cmd_vel"), T], [String(this.P.state_topic || "collision_monitor_state"), "nav2_msgs/msg/CollisionMonitorState"]] };
    for (const s of [].concat(this.P.observation_sources || [])) { const sp = this.P[s] || {}; e.subs.push([String(sp.topic || "/scan"), sp.type === "pointcloud" ? "sensor_msgs/msg/PointCloud2" : sp.type === "range" ? "sensor_msgs/msg/Range" : "sensor_msgs/msg/LaserScan"]); }
    for (const p of this.polygons()) { if (p.visualize) e.pubs.push([p.pubTopic, "geometry_msgs/msg/PolygonStamped"]); if (p.footprintTopic) e.subs.push([p.footprintTopic, "geometry_msgs/msg/PolygonStamped"]); }
    return e;
  }
  polygons() {
    return [].concat(this.P.polygons || []).map((name) => {
      const p = this.P[name] || {}; let pts = null;
      if (p.points) { try { pts = (typeof p.points === "string" ? C.scalar(p.points) : p.points).map((q) => [Number(q[0]), Number(q[1])]); } catch { pts = null; } }
      return { name, type: String(p.type || "polygon"), action: String(p.action_type || "stop"), radius: num(p.radius, 0), pts, min: num(p.min_points, 4), slow: num(p.slowdown_ratio, 0.5), lin: num(p.linear_limit, 0.5), ang: num(p.angular_limit, 0.5), tbc: num(p.time_before_collision, 2.0), step: num(p.simulation_time_step, 0.1), enabled: bool(p.enabled, true), visualize: bool(p.visualize, false), pubTopic: String(p.polygon_pub_topic || name), footprintTopic: p.footprint_topic ? String(p.footprint_topic) : null };
    }).filter((p) => p.enabled);
  }
  onConfigure() { this.polys = this.polygons(); return true; }
  cmdIn() { return this.state === "active" ? this.resolve(String(this.P.cmd_vel_in_topic || "cmd_vel_smoothed")) : null; }
  onTwist(v) {
    let out = { ...v }, why = "Robot to continue normal operation";
    const scan = this.sys.scan();
    if (scan && (out.vx || out.wz)) {
      const pts = this.sys.scanPoints(scan, { x: 0, y: 0, yaw: 0 }).points;   // the base frame
      const inside = (p, x, y) => { if (p.type === "circle") return Math.hypot(x, y) <= p.radius; if (!p.pts) return false; let c = false; for (let i = 0, j = p.pts.length - 1; i < p.pts.length; j = i++) { const a = p.pts[i], b = p.pts[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const fp = this.sys.model("controller") ? this.sys.model("controller").costmap.footprint : { pts: null, radius: 0.1 };
      for (const p of this.polys || []) {
        if (p.action === "approach") {   // simulate the motion; slow down so the robot stays time_before_collision away
          const R = fp.circumscribed || 0.1; let hitT = null;
          for (let tt = 0; tt <= p.tbc + 1e-9 && hitT === null; tt += Math.max(0.02, p.step)) { const th = out.wz * tt, x = Math.abs(out.wz) > 1e-6 ? (out.vx / out.wz) * Math.sin(th) : out.vx * tt, y = Math.abs(out.wz) > 1e-6 ? (out.vx / out.wz) * (1 - Math.cos(th)) : 0; let n = 0; for (const [px, py] of pts) if (Math.hypot(px - x, py - y) <= R) n++; if (n >= p.min) hitT = tt; }
          if (hitT !== null) { const k = Math.max(0, hitT / p.tbc); out = { vx: out.vx * k, wz: out.wz * k }; why = `Robot to approach for ${hitT.toFixed(6)} seconds away from collision`; }
          continue;
        }
        const n = pts.filter(([x, y]) => inside(p, x, y)).length; if (n < p.min) continue;
        if (p.action === "stop") { out = { vx: 0, wz: 0 }; why = `Robot to stop due to ${p.name} polygon`; break; }
        if (p.action === "slowdown") { out = { vx: out.vx * p.slow, wz: out.wz * p.slow }; why = `Robot to slowdown for ${(p.slow * 100).toFixed(6)} percents due to ${p.name} polygon`; }
        if (p.action === "limit") { out = { vx: Math.sign(out.vx) * Math.min(Math.abs(out.vx), p.lin), wz: Math.sign(out.wz) * Math.min(Math.abs(out.wz), p.ang) }; why = `Robot to limit speed due to ${p.name} polygon`; }
      }
    }
    const kind = why.replace(/[\d.]+ seconds/, "").replace(/[\d.]+ percents/, "");
    if (kind !== this.stateKind) { this.stateKind = kind; this.info(why); }
    this.sys.publishTwist(this.resolve(String(this.P.cmd_vel_out_topic || "cmd_vel")), out, this.stamped(), this.full);
  }
}

// ---------------------------------------------------------------- bt_navigator (navigate_to_pose_w_replanning_and_recovery.xml)
const DEFAULT_BT = { retries: 6, hz: 1.0, plannerRetries: 1, controllerRetries: 1, spin: 1.57, wait: 5.0, backup: 0.3, backupSpeed: 0.15, recoveries: ["clear", "spin", "wait", "backup"] };
function readBt(xml) {   // the parameters of the real behavior tree file (RecoveryNode retries, RateController hz, the recoveries)
  if (!xml) return { ...DEFAULT_BT, from: null };
  const b = { ...DEFAULT_BT, recoveries: [] }, at = (re) => { const m = xml.match(re); return m ? Number(m[1]) : null; };
  b.retries = at(/<RecoveryNode[^>]*number_of_retries="(\d+)"[^>]*name="NavigateRecovery"/) ?? at(/<RecoveryNode[^>]*name="NavigateRecovery"[^>]*number_of_retries="(\d+)"/) ?? DEFAULT_BT.retries;
  b.hz = at(/<RateController[^>]*hz="([\d.]+)"/) ?? 1.0;
  b.spin = at(/<Spin[^>]*spin_dist="([-\d.]+)"/) ?? 1.57; b.wait = at(/<Wait[^>]*wait_duration="([\d.]+)"/) ?? 5.0; b.backup = at(/<BackUp[^>]*backup_dist="([-\d.]+)"/) ?? 0.3; b.backupSpeed = at(/<BackUp[^>]*backup_speed="([-\d.]+)"/) ?? 0.15;
  const rr = xml.match(/<RoundRobin[^>]*>([\s\S]*?)<\/RoundRobin>/);
  if (rr) { const body = rr[1].replace(/<Sequence[^>]*name="ClearingActions"[\s\S]*?<\/Sequence>/, "<Clear/>"); for (const m of body.matchAll(/<(Clear|Spin|Wait|BackUp|DriveOnHeading)\b/g)) b.recoveries.push({ Clear: "clear", Spin: "spin", Wait: "wait", BackUp: "backup", DriveOnHeading: "drive" }[m[1]]); }
  if (!b.recoveries.length) b.recoveries = DEFAULT_BT.recoveries.slice();
  b.from = "xml";
  return b;
}
class BtNavigator extends NavNode {
  constructor(sys, desc) { super(sys, "bt", desc); this.announce(); this.rr = 0; }
  endpoints() { return { subs: [["goal_pose", "geometry_msgs/msg/PoseStamped"], [String(this.P.odom_topic || "odom"), "nav_msgs/msg/Odometry"]], pubs: [["behavior_tree_log", "nav2_msgs/msg/BehaviorTreeLog"]], acts: [["navigate_to_pose", "nav2_msgs/action/NavigateToPose"], ["navigate_through_poses", "nav2_msgs/action/NavigateThroughPoses"]], actc: [["compute_path_to_pose", "nav2_msgs/action/ComputePathToPose"], ["compute_path_through_poses", "nav2_msgs/action/ComputePathThroughPoses"], ["follow_path", "nav2_msgs/action/FollowPath"], ["spin", "nav2_msgs/action/Spin"], ["backup", "nav2_msgs/action/BackUp"], ["wait", "nav2_msgs/action/Wait"], ["drive_on_heading", "nav2_msgs/action/DriveOnHeading"], ["smooth_path", "nav2_msgs/action/SmoothPath"]] }; }
  onConfigure() {
    const navs = [].concat(this.P.navigators || ["navigate_to_pose", "navigate_through_poses"]);
    for (const id of navs) {
      this.info(`Creating navigator id ${id} of type ${(this.P[id] || {}).plugin || (id === "navigate_to_pose" ? "nav2_bt_navigator::NavigateToPoseNavigator" : "nav2_bt_navigator::NavigateThroughPosesNavigator")}`);
      if (this.P.error_code_names) this.info(`Error_code parameters were set to: ${[].concat(this.P.error_code_names).join(" ")}`);
      else this.warn("Error_code parameters were not set. Using default values of: follow_path_error_code compute_path_error_code\nMake sure these match your BT and there are not other sources of error codes youreported to your application");
    }
    const xmlPath = String(this.P.default_nav_to_pose_bt_xml || "").replace(/\$\(find-pkg-share ([\w-]+)\)/, "/opt/ros/jazzy/share/$1") || "/opt/ros/jazzy/share/nav2_bt_navigator/behavior_trees/navigate_to_pose_w_replanning_and_recovery.xml";
    let xml = null; try { xml = this.fs ? this.fs.read(xmlPath) : null; if (xml && typeof xml !== "string") xml = new TextDecoder().decode(xml); } catch { xml = null; }
    this.bt = readBt(xml); this.btPath = xmlPath;
    this.errorNames = [].concat(this.P.error_code_names || ["follow_path_error_code", "compute_path_error_code"]);
    return true;
  }
  // NavigateToPose / NavigateThroughPoses goal; cb: { feedback(fb), done(status, result) }
  navigate(goals, cb, kind = "pose") {
    if (this.state !== "active") return { rejected: "Action server is inactive. Rejecting the goal." };
    const start = this.sys.basePose(String(this.P.global_frame || "map"));
    if (!start) { this.error(kind === "pose" ? "Initial robot pose is not available." : "Robot pose is not available."); return { rejected: "Robot pose is not available." }; }
    if (this.job) { this.info("Received goal preemption request"); this.finish("CANCELED", 0, true); }
    const g = goals[goals.length - 1];
    if (kind === "pose") this.info(`Begin navigating from current location (${start.x.toFixed(2)}, ${start.y.toFixed(2)}) to (${g.x.toFixed(2)}, ${g.y.toFixed(2)})`);
    else this.info(`Begin navigating from current location through ${goals.length} poses to (${g.x.toFixed(2)}, ${g.y.toFixed(2)})`);
    this.job = { goals, idx: 0, cb, kind, t0: this.sys.now(), phase: "pipeline", lastPlan: -1e9, recoveries: 0, retries: 0, cpErr: 0, fpErr: 0, cpRetried: false, fpRetried: false, following: false, lastFb: -1e9 };
    this.status = "navigating";
    return { id: hex32() };
  }
  cancel() { if (this.job) { this.finish("CANCELED", 0); return true; } return false; }
  finish(status, code, quiet = false) {
    const J = this.job; if (!J) return;
    this.job = null;
    const ctl = this.sys.model("controller"), beh = this.sys.model("behavior");
    if (ctl) ctl.cancel(); if (beh && beh.job) beh.cancel();
    if (!quiet) this.info(status === "SUCCEEDED" ? "Goal succeeded" : status === "CANCELED" ? "Goal canceled" : "Goal failed");
    this.status = status === "SUCCEEDED" ? "succeeded" : status === "CANCELED" ? "canceled" : "aborted";
    J.cb.done && J.cb.done(status, { error_code: code, error_msg: "" });
  }
  feedback(t) {
    const J = this.job; const pose = this.sys.basePose(String(this.P.global_frame || "map")); if (!pose || !J) return;
    const pl = this.sys.model("planner"), path = pl && pl.plan ? pl.plan.poses : null, o = this.sys.odom();
    let remaining = Math.hypot(J.goals[J.goals.length - 1].x - pose.x, J.goals[J.goals.length - 1].y - pose.y);
    if (path && path.length > 1) { const pts = path.map((p) => [p.x, p.y]); remaining = C.pathLength(pts, C.closestIndex(pts, pose.x, pose.y)); }
    const speed = o ? Math.abs(o.vx) : 0;
    const fb = { current_pose: poseYaml(pose, String(this.P.global_frame || "map"), t), navigation_time: dur(t - J.t0), estimated_time_remaining: dur(speed > 0.01 ? remaining / speed : 0), number_of_recoveries: J.recoveries, distance_remaining: F32(remaining) };
    if (J.kind === "poses") { fb.number_of_poses_remaining = J.goals.length - J.idx; }
    this.lastFeedback = { ...fb, remaining, recoveries: J.recoveries, t: t - J.t0 };
    J.cb.feedback && J.cb.feedback(fb);
  }
  tick(t) {
    const J = this.job; if (!J || this.state !== "active") return;
    const pl = this.sys.model("planner"), ctl = this.sys.model("controller"), beh = this.sys.model("behavior");
    if (t - J.lastFb >= 0.2) { J.lastFb = t; this.feedback(t); }
    if (J.phase === "recovery") return;   // a recovery action is running (its callback continues the tree)
    // RateController: ComputePathToPose at hz (RecoveryNode: clear the global costmap and retry once)
    if (t - J.lastPlan >= 1 / this.bt.hz - 1e-9) {
      J.lastPlan = t;
      const goal = J.goals[J.goals.length - 1];
      let r = pl ? pl.compute(goal) : { code: 200 };
      if (r.code && !J.cpRetried && [200, 207, 208].includes(r.code) && pl) { J.cpRetried = true; pl.costmap.info(`Received request to clear entirely the ${pl.costmap.which}`); pl.costmap.clear(); r = pl.compute(goal); }
      if (r.code) { J.cpErr = r.code; return this.pipelineFailed(t); }
      J.cpErr = 0; J.cpRetried = false;
      if (ctl) ctl.follow(r.path, pl.costmap.frame, null, (code) => this.followDone(code));
      J.following = true;
    }
  }
  followDone(code) {
    const J = this.job; if (!J) return;
    J.following = false;
    if (code === 0) { J.fpErr = 0; this.finish("SUCCEEDED", 0); return; }
    J.fpErr = code;
    const ctl = this.sys.model("controller");
    if (!J.fpRetried && ctl) { J.fpRetried = true; ctl.costmap.info(`Received request to clear entirely the ${ctl.costmap.which}`); ctl.costmap.clear(); J.lastPlan = -1e9; return; }
    this.pipelineFailed(this.sys.now());
  }
  pipelineFailed(t) {
    const J = this.job; if (!J) return;
    const ctl = this.sys.model("controller"); if (ctl) ctl.cancel();
    const plannerHelps = [200, 207, 208].includes(J.cpErr), controllerHelps = [100, 104, 105, 106].includes(J.fpErr);
    const codeNow = () => { const c = [J.fpErr, J.cpErr].filter((x) => x); return c.length ? Math.min(...c) : 0; };
    if (J.retries >= this.bt.retries || !(plannerHelps || controllerHelps)) { this.finish("ABORTED", codeNow()); return; }
    this.runRecovery(t, 0);
  }
  runRecovery(t, tried) {
    const J = this.job; if (!J) return;
    const list = this.bt.recoveries; if (tried >= list.length) { this.finish("ABORTED", Math.min(...[J.fpErr, J.cpErr].filter((x) => x).concat([0]).filter((x) => x)) || 0); return; }
    const kind = list[this.rr % list.length]; this.rr++;
    const beh = this.sys.model("behavior"), pl = this.sys.model("planner"), ctl = this.sys.model("controller");
    const ok = () => { if (!this.job || this.job !== J) return; J.recoveries++; J.retries++; J.phase = "pipeline"; J.cpRetried = false; J.fpRetried = false; J.lastPlan = -1e9; };
    const fail = () => { if (!this.job || this.job !== J) return; this.runRecovery(this.sys.now(), tried + 1); };
    J.phase = "recovery";
    if (kind === "clear") { for (const cm of [ctl && ctl.costmap, pl && pl.costmap]) if (cm) { cm.info(`Received request to clear entirely the ${cm.which}`); cm.clear(); } ok(); return; }
    if (!beh) { fail(); return; }
    const args = kind === "spin" ? { target_yaw: this.bt.spin, time_allowance: 10 } : kind === "wait" ? { time: this.bt.wait } : kind === "backup" ? { target: { x: -Math.abs(this.bt.backup) }, speed: -Math.abs(this.bt.backupSpeed), time_allowance: 10 } : { target: { x: 0.3 }, speed: 0.15 };
    beh.run({ spin: "Spin", wait: "Wait", backup: "BackUp", drive: "DriveOnHeading" }[kind], args, (code) => (code === 0 ? ok() : fail()));
  }
}

// ---------------------------------------------------------------- waypoint_follower
class WaypointFollower extends NavNode {
  constructor(sys, desc) { super(sys, "waypoint", desc); this.announce(); }
  endpoints() { return { acts: [["follow_waypoints", "nav2_msgs/action/FollowWaypoints"], ["follow_gps_waypoints", "nav2_msgs/action/FollowGPSWaypoints"]], actc: [["navigate_to_pose", "nav2_msgs/action/NavigateToPose"]] }; }
  onConfigure() { const ex = String(this.P.waypoint_task_executor_plugin || "wait_at_waypoint"); this.info(`Created waypoint_task_executor : ${ex} of type ${(this.P[ex] || {}).plugin || "nav2_waypoint_follower::WaitAtWaypoint"}`); return true; }
  follow(poses, cb) {
    if (this.state !== "active") return { rejected: "inactive" };
    this.info(`Received follow waypoint request with ${poses.length} waypoints.`);
    const J = this.job = { poses, i: 0, cb, missed: [] };
    const ex = this.P[String(this.P.waypoint_task_executor_plugin || "wait_at_waypoint")] || {}, pause = num(ex.waypoint_pause_duration, 0) / 1000;
    const next = () => {
      if (this.job !== J) return;
      if (J.i >= poses.length) { this.info(`Completed all ${poses.length} waypoints requested.`); this.job = null; cb.done("SUCCEEDED", { missed_waypoints: J.missed, error_code: 0, error_msg: "" }); return; }
      cb.feedback && cb.feedback({ current_waypoint: J.i });
      const bt = this.sys.model("bt");
      const r = bt ? bt.navigate([poses[J.i]], { done: (st, res) => {
        if (this.job !== J) return;
        if (st === "SUCCEEDED") { this.info(`Succeeded processing waypoint ${J.i}, processing waypoint task execution`); const at = this.sys.now(); const wait = () => { if (this.job !== J) return; if (this.sys.now() - at >= pause) { this.info(`Task execution at waypoint ${J.i} succeeded`); this.info(`Handled task execution on waypoint ${J.i}, moving to next.`); J.i++; next(); } else setTimeout(wait, 50); }; wait(); }
        else { J.missed.push({ index: J.i, goal: poses[J.i], error_code: res.error_code }); if (bool(this.P.stop_on_failure, true)) { this.warn(`Failed to process waypoint ${J.i} in waypoint list and stop on failure is enabled. Terminating action.`); this.job = null; cb.done("ABORTED", { missed_waypoints: J.missed, error_code: 600, error_msg: "" }); } else { this.warn(`Failed to process waypoint ${J.i}, moving to next.`); J.i++; next(); } }
      } }) : { rejected: "no bt_navigator" };
      if (r.rejected) { this.error("navigate_to_pose action client failed to send goal to server."); this.job = null; cb.done("ABORTED", { missed_waypoints: J.missed, error_code: 600, error_msg: "" }); }
    };
    next();
    return { id: hex32() };
  }
}

// ---------------------------------------------------------------- servers present in the bring-up but modelled only as nodes
class SimpleServer extends NavNode {
  constructor(sys, role, desc) { super(sys, role, desc); this.announce(); }
  endpoints() {
    if (this.role === "smoother") return { pubs: [["plan_smoothed", "nav_msgs/msg/Path"]], acts: [["smooth_path", "nav2_msgs/action/SmoothPath"]] };
    if (this.role === "docking") return { acts: [["dock_robot", "nav2_msgs/action/DockRobot"], ["undock_robot", "nav2_msgs/action/UndockRobot"]], pubs: [["dock_pose", "geometry_msgs/msg/PoseStamped"], ["filtered_dock_pose", "geometry_msgs/msg/PoseStamped"]], subs: [["detected_dock_pose", "geometry_msgs/msg/PoseStamped"]] };
    if (this.role === "route") return { acts: [["compute_route", "nav2_msgs/action/ComputeRoute"], ["compute_and_track_route", "nav2_msgs/action/ComputeAndTrackRoute"]], srvs: [["~/set_route_graph", "nav2_msgs/srv/SetRouteGraph"]] };
    return {};
  }
  onConfigure() {
    if (this.role === "smoother") { for (const id of [].concat(this.P.smoother_plugins || ["simple_smoother"])) this.info(`Created smoother : ${id} of type ${(this.P[id] || {}).plugin || "nav2_smoother::SimpleSmoother"}`); }
    if (this.role === "docking") this.warn("(ROS2Lab) Docking is not modelled in the practice simulator: docking_server takes part in the lifecycle bring-up and offers dock_robot / undock_robot, but rejects their goals.");
    if (this.role === "route") this.warn("(ROS2Lab) The route server is not modelled in the practice simulator: it takes part in the lifecycle bring-up only.");
    return true;
  }
}

// ---------------------------------------------------------------- lifecycle_manager
class LifecycleManager extends NavNode {
  constructor(sys, desc) {
    super(sys, "lifecycle", desc, { lifecycle: false });
    this.names = [].concat(this.P.node_names || []); this.queue = []; this.active = false; this.attach();
    this.info("Creating");
    this.info("Creating and initializing lifecycle service clients");
    if (bool(this.P.autostart, false)) this.startup();
  }
  endpoints() { return { srvs: [["~/manage_nodes", "nav2_msgs/srv/ManageLifecycleNodes"], ["~/is_active", "std_srvs/srv/Trigger"]], cli: (this.names || []).flatMap((n) => [[`/${n}/change_state`, "lifecycle_msgs/srv/ChangeState"], [`/${n}/get_state`, "lifecycle_msgs/srv/GetState"]]) }; }
  msg(t) { this.info(`\u001b[34m\u001b[1m${t}\u001b[0m\u001b[0m`); }   // LifecycleManager::message: bold blue
  target(name) { const full = name.startsWith("/") ? name : `${this.ns}/${name}`; return this.sys.byName(full) || this.sys.byName(`/${name}`); }
  startup() { this.msg("Starting managed nodes bringup..."); this.plan(["configure", "activate"], "Managed nodes are active", "Failed to bring up all requested nodes. Aborting bringup.", () => { this.active = true; this.status = "active"; this.msg("Creating bond timer..."); }); }
  plan(steps, okMsg, failMsg, onOk) {
    this.queue = steps.flatMap((s) => (s === "deactivate" || s === "cleanup" || s === "shutdown" ? this.names.slice().reverse() : this.names).map((n) => ({ t: s, n })));
    this.okMsg = okMsg; this.failMsg = failMsg; this.onOk = onOk; this.waitStart = this.sys.wall(); this.pump();
  }
  pump() {
    if (this.dead || !this.queue.length || this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const step = this.queue[0], m = this.target(step.n);
        if (!m) {   // the managed node's services are not there (yet): rclcpp waits for them
          if (this.sys.wall() - this.waitStart > 10 && !step.warned) { step.warned = true; this.info(`Waiting for service ${step.n}/get_state...`); }
          return;
        }
        if (!step.announced) { step.announced = true; this.msg(`${{ configure: "Configuring", activate: "Activating", deactivate: "Deactivating", cleanup: "Cleaning up", shutdown: "Shutting down" }[step.t]} ${step.n}`); }
        const want = { configure: "inactive", activate: "active", deactivate: "inactive", cleanup: "unconfigured", shutdown: "finalized" }[step.t];
        const r = m.state === want ? true : m.transition(step.t);
        if (r === "pending") return;
        if (r === false) { this.error(`Failed to change state for node: ${step.n}`); this.error(this.failMsg); this.queue = []; this.status = "failed"; return; }
        if (step.t === "activate") this.info(`Server ${step.n} connected with bond.`);
        this.queue.shift();
      }
      this.msg(this.okMsg); if (this.onOk) this.onOk();
    } finally { this.busy = false; }
  }
  // nav2_msgs/srv/ManageLifecycleNodes: 0 STARTUP, 1 PAUSE, 2 RESUME, 3 RESET, 4 SHUTDOWN, 5 CONFIGURE, 6 CLEANUP
  manage(cmd) {
    if (cmd === 0) { this.startup(); return true; }
    if (cmd === 1) { this.msg("Pausing managed nodes..."); this.plan(["deactivate"], "Managed nodes have been paused", "Failed to pause nodes: aborting pause", () => { this.active = false; this.status = "paused"; }); return true; }
    if (cmd === 2) { this.msg("Resuming managed nodes..."); this.plan(["activate"], "Managed nodes are active", "Failed to resume nodes: aborting resume", () => { this.active = true; this.status = "active"; }); return true; }
    if (cmd === 3) { this.msg("Resetting managed nodes..."); this.plan(["deactivate", "cleanup"], "Managed nodes have been reset", "Failed to reset nodes: aborting reset", () => { this.active = false; this.status = "reset"; }); return true; }
    if (cmd === 4) { this.msg("Shutting down managed nodes..."); this.plan(["deactivate", "cleanup", "shutdown"], "Managed nodes have been shut down", "Failed to shutdown nodes", () => { this.active = false; this.status = "shutdown"; }); return true; }
    if (cmd === 5) { this.msg("Configuring managed nodes..."); this.plan(["configure"], "Managed nodes are now configured", "Failed to configure all requested nodes. Aborting bringup.", () => { this.status = "configured"; }); return true; }
    if (cmd === 6) { this.msg("Cleaning up managed nodes..."); this.plan(["cleanup"], "Managed nodes have been cleaned up", "Failed to cleanup all requested nodes. Aborting cleanup.", () => { this.status = "cleaned"; }); return true; }
    return false;
  }
  // a managed server died (its process ended): the bond breaks
  bondBroken(name) {
    if (!this.active || !this.names.includes(name)) return;
    this.msg(`Have not received a heartbeat from ${name}.`);
    this.error(`CRITICAL FAILURE: SERVER ${name} IS DOWN after not receiving a heartbeat for ${Math.round(num(this.P.bond_timeout, 4.0) * 1000)} ms. Shutting down related nodes.`);
    this.active = false; this.status = "failed";
    for (const n of this.names.slice().reverse()) { const m = this.target(n); if (m && m.state === "active") m.transition("deactivate"); }
  }
}

// ---------------------------------------------------------------- public API
const CTORS = { map_server: MapServer, map_saver: (s, d) => new MapSaver(s, d), amcl: Amcl, planner: PlannerServer, controller: ControllerServer, behavior: BehaviorServer, bt: BtNavigator, waypoint: WaypointFollower, velsmoother: VelocitySmoother, collision: CollisionMonitor, lifecycle: LifecycleManager };
export function startNav2Node(graph, desc) {
  const role = nav2Role(desc); if (!role) return null;
  const sys = nav2System(graph);
  const d = { ...desc, fs: desc.fs || sys.fs || null };
  if (desc.fs && !sys.fs) sys.fs = desc.fs;
  let m;
  if (role === "map_saver_cli") m = runMapSaverCli(sys, d);
  else if (role.startsWith("slam:")) m = startSlam(sys, role.slice(5), d, { NavNode, C });
  else if (CTORS[role]) m = CTORS[role].prototype ? new CTORS[role](sys, d) : CTORS[role](sys, d);
  else m = new SimpleServer(sys, role, d);
  if (!m) return null;
  if (!m.n && !m.dead) m.attach();
  sys.models.push(m);
  sys.pump();
  return m;
}
// the process / component ended (Ctrl+C, job.exit, unload): remove the node, break the bonds
export function stopNav2Node(graph, full) {
  const sys = graph.nav2; if (!sys) return false;
  const m = sys.byName(full); if (!m) return false;
  m.stop();
  if (sys.mapOdomBy === m.full) sys.setMapOdom(null, null);
  for (const x of sys.models) if (x instanceof LifecycleManager && !x.dead) x.bondBroken(m.name);
  return true;
}
export function nav2Step(graph, dt) { if (graph.nav2) graph.nav2.tick(dt); }

// a message published on a ROS topic (RViz tools, ros2 topic pub, goal_pose_gui): /initialpose, /goal_pose
export function nav2Topic(graph, topic, type, msg) {
  const sys = graph.nav2; if (!sys) return null;
  if (type === "geometry_msgs/msg/PoseWithCovarianceStamped") {
    const a = sys.models.find((m) => m.role === "amcl" && !m.dead && m.resolve("initialpose") === topic);
    if (a) { a.initialPose(msg); return { note: "amcl" }; }
    const s = sys.models.find((m) => m.role && m.role.startsWith("slam") && !m.dead && m.onInitialPose);
    if (s) { s.onInitialPose(msg); return { note: "slam" }; }
  }
  if (type === "geometry_msgs/msg/PoseStamped") {
    const bt = sys.models.find((m) => m.role === "bt" && !m.dead && m.resolve("goal_pose") === topic);
    if (bt) { const p = msg.pose; const r = bt.navigate([{ x: p.position.x, y: p.position.y, yaw: yawOfQ(p.orientation) }], { feedback() {}, done() {} }); return { note: r.rejected ? `bt_navigator rejected the goal: ${r.rejected}` : "bt_navigator" }; }
  }
  return null;
}

// ros2 action send_goal <name> <type> <goal>: returns the lines printed at once, or null (not a Nav2 action).
// out(text) prints later lines (feedback with -f, the result) to the terminal that ran the command.
// The returned array has .handle = { cancel(), done: Promise<status> } so Ctrl+C can cancel the goal.
export function nav2ActionGoal(graph, name, type, goal, rest = [], { out = null } = {}) {
  const sys = graph.nav2; if (!sys) return null;
  const owner = sys.models.find((m) => !m.dead && m.n && m.n.info.acts.some(([a]) => m.resolve(a) === name));
  if (!owner) return null;
  const fb = rest.includes("-f") || rest.includes("--feedback");
  const goalYaml = (() => { try { return toYaml(goalToYaml(goal)); } catch { return ""; } })();
  const head = ["Waiting for an action server to become available...", `Sending goal:\n     ${goalYaml}`, ""];
  const emit = (t) => { if (out) out(t); };
  let resolveDone; const done = new Promise((r) => (resolveDone = r));
  const cbs = { feedback: (f) => { if (fb) emit(`Feedback:\n    ${toYaml(f)}\n`); }, done: (status, res) => { emit(`Result:\n    ${toYaml(resultYaml(type, res))}\n`); emit(`Goal finished with status: ${status}`); resolveDone(status); } };
  const toPose = (ps) => ({ x: ps.pose.position.x, y: ps.pose.position.y, yaw: yawOfQ(ps.pose.orientation) });
  let r = null, cancel = () => false;
  if (owner.role === "bt" && /NavigateToPose$/.test(type)) { r = owner.navigate([toPose(goal.pose)], cbs, "pose"); cancel = () => owner.cancel(); }
  else if (owner.role === "bt" && /NavigateThroughPoses$/.test(type)) { r = owner.navigate((goal.poses || []).map(toPose), cbs, "poses"); cancel = () => owner.cancel(); }
  else if (owner.role === "waypoint" && /FollowWaypoints$/.test(type)) { r = owner.follow((goal.poses || []).map(toPose), { feedback: (f) => fb && emit(`Feedback:\n    current_waypoint: ${f.current_waypoint}\n`), done: cbs.done }); cancel = () => { if (owner.job) { owner.job = null; const bt = sys.model("bt"); if (bt) bt.cancel(); cbs.done("CANCELED", { missed_waypoints: [], error_code: 0, error_msg: "" }); return true; } return false; }; }
  else if (owner.role === "behavior") { const kind = type.split("/").pop(); r = { id: hex32() }; owner.run(kind, kind === "Spin" ? { target_yaw: goal.target_yaw, time_allowance: num(goal.time_allowance && goal.time_allowance.sec, 10) } : kind === "Wait" ? { time: num(goal.time && goal.time.sec, 0) + num(goal.time && goal.time.nanosec, 0) / 1e9 } : { target: goal.target, speed: goal.speed, time_allowance: num(goal.time_allowance && goal.time_allowance.sec, 10) }, (code) => cbs.done(code === 0 ? "SUCCEEDED" : "ABORTED", { error_code: code, error_msg: "" })); cancel = () => { owner.cancel(); return true; }; }
  else if (owner.role === "planner" && /ComputePathToPose$/.test(type)) { const res = owner.compute(toPose(goal.goal), goal.planner_id || null); r = { id: hex32() }; setTimeout(() => cbs.done(res.code ? "ABORTED" : "SUCCEEDED", res.code ? { error_code: res.code, error_msg: res.message } : { path: res.path, error_code: 0, error_msg: "" }), 0); }
  else return [...head.map((t) => graph.out(t)), graph.out("Goal was rejected.")];
  if (r && r.rejected) return [...head.map((t) => graph.out(t)), graph.out("Goal was rejected.")];
  const L = [...head, `Goal accepted with ID: ${r.id}\n`].map((t) => graph.out(t));
  L.handle = { cancel, done };
  return L;
}
function goalToYaml(g) {
  const conv = (v) => (typeof v === "number" ? (Number.isInteger(v) ? v : F(v)) : Array.isArray(v) ? v.map(conv) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /^(x|y|z|w|target_yaw|speed|disable_collision_checks)$/.test(k) && typeof x === "number" ? F(x) : conv(x)])) : v);
  return conv(g);
}
function resultYaml(type, res) {
  if (/ComputePathToPose$/.test(type) && res.path) return { path: { header: { stamp: stampObj(0), frame_id: "map" }, poses: `<${res.path.length} poses>` }, planning_time: { sec: 0, nanosec: 0 }, error_code: res.error_code, error_msg: res.error_msg || "" };
  if (/FollowWaypoints$/.test(type)) return { missed_waypoints: res.missed_waypoints || [], error_code: res.error_code || 0, error_msg: res.error_msg || "" };
  if (/(Spin|BackUp|DriveOnHeading|Wait)$/.test(type)) return { total_elapsed_time: { sec: 0, nanosec: 0 }, error_code: res.error_code || 0, error_msg: "" };
  return { error_code: res.error_code || 0, error_msg: res.error_msg || "" };
}

// ros2 service call for Nav2 services; returns printed lines or null
export function nav2Service(graph, name, type, req = {}) {
  const sys = graph.nav2; if (!sys) return null;
  const reqLine = (t) => graph.out(`requester: making request: ${t}`), resp = (t) => [graph.out(""), graph.out("response:"), graph.out(t), graph.out("")];
  for (const m of sys.models) {
    if (m.dead) continue;
    if (m instanceof LifecycleManager && name === m.resolve("~/manage_nodes")) { const ok = m.manage(Number(req.command || 0)); return [graph.out("waiting for service to become available..."), reqLine(`nav2_msgs.srv.ManageLifecycleNodes_Request(command=${Number(req.command || 0)})`), ...resp(`nav2_msgs.srv.ManageLifecycleNodes_Response(success=${ok ? "True" : "False"})`)]; }
    if (m instanceof LifecycleManager && name === m.resolve("~/is_active")) return [graph.out("waiting for service to become available..."), reqLine("std_srvs.srv.Trigger_Request()"), ...resp(`std_srvs.srv.Trigger_Response(success=${m.active ? "True" : "False"}, message='')`)];
    for (const cm of [m.costmap].filter(Boolean)) if (name === cm.resolve(`clear_entirely_${cm.which}`)) { cm.info(`Received request to clear entirely the ${cm.which}`); cm.clear(); return [graph.out("waiting for service to become available..."), reqLine("nav2_msgs.srv.ClearEntireCostmap_Request(request=std_msgs.msg.Empty())"), ...resp("nav2_msgs.srv.ClearEntireCostmap_Response(response=std_msgs.msg.Empty())")]; }
    if (m instanceof MapSaver && name === m.resolve("~/save_map")) { const ok = m.save(req.map_topic || "", req.map_url || "", { free: req.free_thresh || undefined, occ: req.occupied_thresh || undefined, mode: req.map_mode || "trinary", fmt: req.image_format || "" }); return [graph.out("waiting for service to become available..."), reqLine(`nav2_msgs.srv.SaveMap_Request(map_topic='${req.map_topic || ""}', map_url='${req.map_url || ""}', image_format='${req.image_format || ""}', map_mode='${req.map_mode || ""}', free_thresh=${pyFloat(req.free_thresh || 0)}, occupied_thresh=${pyFloat(req.occupied_thresh || 0)})`), ...resp(`nav2_msgs.srv.SaveMap_Response(result=${ok ? "True" : "False"})`)]; }
    if (m instanceof MapServer && name === m.resolve("~/load_map")) { const ok = m.state === "active" && m.load(String(req.map_url || "")); if (ok) sys.setMap(m.resolve("map"), m.grid, m.full); return [graph.out("waiting for service to become available..."), reqLine(`nav2_msgs.srv.LoadMap_Request(map_url='${req.map_url || ""}')`), ...resp(`nav2_msgs.srv.LoadMap_Response(map=nav_msgs.msg.OccupancyGrid(...), result=${ok ? 0 : 1})`)]; }
    if (m instanceof Amcl && name === m.resolve("set_initial_pose")) { const ok = m.initialPose({ header: { frame_id: (req.pose && req.pose.header && req.pose.header.frame_id) || "map" }, pose: (req.pose && req.pose.pose) || { pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } } }); return [graph.out("waiting for service to become available..."), reqLine("nav2_msgs.srv.SetInitialPose_Request(pose=...)"), ...resp(`nav2_msgs.srv.SetInitialPose_Response()${ok ? "" : ""}`)]; }
    if (m.onService) { const r = m.onService(name, type, req, graph); if (r) return r; }
  }
  return null;
}
// ros2 lifecycle set <node> <transition> (and the launch runtime's lifecycle requests): { success } or null
export function nav2Lifecycle(graph, full, transition) {
  const sys = graph.nav2; if (!sys) return null;
  const m = sys.byName(full); if (!m || !m.lifecycleNode) return null;
  let r = m.transition(transition);
  if (r === "pending") { const t0 = Date.now(); while (r === "pending" && Date.now() - t0 < 50) r = m.transition(transition); }
  return { success: r === true, pending: r === "pending" };
}

// ros2 topic echo of the topics the Nav2 models publish; returns [text, ...] or null
const arr = (a, f = String) => { const v = Array.from(a.slice(0, 128), (x) => `- ${f(x)}`); if (a.length > 128) v.push("- '...'"); return v.join("\n"); };
export function nav2Sample(graph, topic) {
  const sys = graph.nav2; if (!sys) return null;
  const t = sys.now(), st = stampObj(t), hdr = (frame) => `header:\n  stamp:\n    sec: ${st.sec}\n    nanosec: ${st.nanosec}\n  frame_id: ${frame}`;
  const gridMsg = (g) => `${hdr(g.frame || "map")}\ninfo:\n  map_load_time:\n    sec: ${st.sec}\n    nanosec: 0\n  resolution: ${pyFloat(Math.fround(g.resolution))}\n  width: ${g.width}\n  height: ${g.height}\n  origin:\n    position:\n      x: ${pyFloat(g.origin[0])}\n      y: ${pyFloat(g.origin[1])}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: 0.0\n      w: 1.0\ndata:\n${arr(g.data)}`;
  const m = sys.maps.get(topic); if (m) return [gridMsg(m.grid)];
  for (const x of sys.models) {
    if (x.dead) continue;
    if (x.costmap && x.costmap.grid && topic === x.costmap.resolve("costmap")) return [gridMsg(C.costmapToGrid(x.costmap.grid, x.costmap.frame))];
    if (x.costmap && topic === x.costmap.resolve("published_footprint")) { const p = x.costmap.pose || sys.basePose(x.costmap.frame); if (!p) return null; return [`${hdr(x.costmap.frame)}\npolygon:\n  points:\n${x.costmap.footprintAt(p).map(([a, b]) => `  - x: ${pyFloat(Math.fround(a))}\n    y: ${pyFloat(Math.fround(b))}\n    z: 0.0`).join("\n")}`]; }
    if (x.role === "planner" && x.plan && topic === x.resolve("plan")) return [`${hdr(x.plan.frame)}\nposes:\n${x.plan.poses.slice(0, 40).map((p) => `- header:\n    stamp:\n      sec: ${st.sec}\n      nanosec: ${st.nanosec}\n    frame_id: ${x.plan.frame}\n  pose:\n    position:\n      x: ${pyFloat(p.x)}\n      y: ${pyFloat(p.y)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${pyFloat(Math.sin(p.yaw / 2))}\n      w: ${pyFloat(Math.cos(p.yaw / 2))}`).join("\n")}${x.plan.poses.length > 40 ? "\n- '...'" : ""}`];
    if (x.role === "amcl" && x.pose() && topic === x.resolve("amcl_pose")) { const p = x.pose(), c = x.pf.cov; return [`${hdr("map")}\npose:\n  pose:\n    position:\n      x: ${pyFloat(p.x)}\n      y: ${pyFloat(p.y)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${pyFloat(Math.sin(p.yaw / 2))}\n      w: ${pyFloat(Math.cos(p.yaw / 2))}\n  covariance:\n${c.map((v) => `  - ${pyFloat(v)}`).join("\n")}`]; }
    if (x.role === "amcl" && x.pose() && topic === x.resolve("particle_cloud")) return [`${hdr("map")}\nparticles:\n${x.pf.ps.slice(0, 20).map((p) => `- pose:\n    position:\n      x: ${pyFloat(p.x)}\n      y: ${pyFloat(p.y)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${pyFloat(Math.sin(p.yaw / 2))}\n      w: ${pyFloat(Math.cos(p.yaw / 2))}\n  weight: ${pyFloat(p.w)}`).join("\n")}\n- '...'`];
    if (x.sample) { const r = x.sample(topic, hdr); if (r) return r; }
  }
  const c = sys.cmd.get(topic);
  if (c && t - c.t < 1.5) { const body = `linear:\n  x: ${pyFloat(c.v.vx)}\n  y: 0.0\n  z: 0.0\nangular:\n  x: 0.0\n  y: 0.0\n  z: ${pyFloat(c.v.wz)}`; return [c.stamped ? `${hdr("")}\ntwist:\n${body.replace(/^/gm, "  ")}` : body]; }
  return null;
}

// RViz2 data (rviz.js update({ topicData })): topic -> { type, frame, count, rate, ... } as rviz.js reads it
export function nav2TopicData(graph, into = new Map()) {
  const sys = graph.nav2; if (!sys) return into;
  const grid = (g, ver) => ({ width: g.width, height: g.height, resolution: g.resolution, origin: g.origin, data: g.data, frame: g.frame || "map", ver });
  for (const [topic, m] of sys.maps) into.set(topic, { type: "nav_msgs/msg/OccupancyGrid", count: m.ver, rate: 0, qos: "Transient Local", ...grid(m.grid, `${topic}#${m.ver}`) });
  for (const x of sys.models) {
    if (x.dead) continue;
    const cm = x.costmap;
    if (cm && cm.grid) {
      into.set(cm.resolve("costmap"), { type: "nav_msgs/msg/OccupancyGrid", count: cm.ver, rate: num(cm.P.publish_frequency, 1), ...grid(C.costmapToGrid(cm.grid, cm.frame), `${cm.full}#${cm.ver}`) });
      const p = cm.pose; if (p) into.set(cm.resolve("published_footprint"), { type: "geometry_msgs/msg/PolygonStamped", count: cm.ver, rate: num(cm.P.publish_frequency, 1), frame: cm.frame, points: cm.footprintAt(p).map(([a, b]) => [a, b, 0]) });
    }
    if (x.role === "planner" && x.plan) into.set(x.resolve("plan"), { type: "nav_msgs/msg/Path", count: x.plan.count, rate: 1, frame: x.plan.frame, points: x.plan.poses.map((q) => [q.x, q.y, 0]), poses: x.plan.poses.map((q) => [q.x, q.y, q.yaw]) });
    if (x.role === "controller" && x.local) into.set(x.resolve("local_plan"), { type: "nav_msgs/msg/Path", count: 1, rate: num(x.P.controller_frequency, 20), frame: x.local.frame, points: x.local.poses.map((q) => [q.x, q.y, 0]) });
    if (x.role === "amcl" && x.pose()) {
      into.set(x.resolve("particle_cloud"), { type: "nav2_msgs/msg/ParticleCloud", count: x.pubCount || 1, rate: 5, qos: "Best Effort", frame: "map", poses: x.pf.ps.map((p) => [p.x, p.y, p.yaw, p.w]) });
      const p = x.pose(); into.set(x.resolve("amcl_pose"), { type: "geometry_msgs/msg/PoseWithCovarianceStamped", count: x.pubCount || 1, rate: 0, frame: "map", pose: [p.x, p.y, p.yaw], covariance: x.pf.cov.slice() });
    }
    if (x.role === "collision") for (const pg of x.polys || []) if (pg.visualize) { const pts = pg.type === "circle" ? Array.from({ length: 24 }, (_, i) => [pg.radius * Math.cos(i * Math.PI / 12), pg.radius * Math.sin(i * Math.PI / 12), 0]) : (pg.pts || []).map(([a, b]) => [a, b, 0]); into.set(x.resolve(pg.pubTopic), { type: "geometry_msgs/msg/PolygonStamped", count: 1, rate: 10, frame: String(x.P.base_frame_id || "base_footprint"), points: pts }); }
    if (x.topicData) x.topicData(into);
  }
  return into;
}
// TF edges the Nav2 / SLAM models broadcast (map -> odom), for the graph's tf tree and RViz
export function nav2TfEdges(graph) {
  const sys = graph.nav2; if (!sys || !sys.mapOdom) return [];
  const T = sys.mapOdom, m = sys.byName(sys.mapOdomBy);
  return [{ parent: (m && (m.mapFrame || (m.P && m.P.global_frame_id))) || "map", child: sys.odomFrame(), t: [T.x, T.y, 0], q: [0, 0, Math.sin(T.yaw / 2), Math.cos(T.yaw / 2)], by: sys.mapOdomBy }];
}
// the backend of RViz2's "Navigation 2" panel (nav2_rviz_plugins/Navigation)
export function nav2Panel(graph) {
  return {
    state() {
      const sys = graph.nav2; if (!sys) return { navigation: "unknown", localization: "unknown", feedback: null };
      const mgr = (re) => sys.models.find((m) => m instanceof LifecycleManager && !m.dead && re.test(m.name));
      const st = (m) => (!m ? "unknown" : m.active ? "active" : m.status === "paused" ? "inactive" : m.queue && m.queue.length ? "unknown" : "inactive");
      const bt = sys.model("bt"), f = bt && bt.job ? bt.lastFeedback : null;
      return { navigation: st(mgr(/navigation/)), localization: st(mgr(/localization/)), goal: bt ? bt.status || "idle" : "idle", feedback: f ? { eta: f.estimated_time_remaining.sec, remaining: f.remaining, time: f.t, recoveries: f.recoveries } : null };
    },
    command(cmd) {   // "startup" | "pause" | "resume" | "reset" | "cancel"
      const sys = graph.nav2; if (!sys) return false;
      const code = { startup: 0, pause: 1, resume: 2, reset: 3, shutdown: 4 }[cmd];
      if (cmd === "cancel") { const bt = sys.model("bt"); return bt ? bt.cancel() : false; }
      let any = false; for (const m of sys.models) if (m instanceof LifecycleManager && !m.dead) any = m.manage(code) || any;
      return any;
    },
    goal(poses, through = false) { const sys = graph.nav2, bt = sys && sys.model("bt"); if (!bt) return false; const r = bt.navigate(poses, { feedback() {}, done() {} }, through && poses.length > 1 ? "poses" : "pose"); return !r.rejected; },
    waypoints(poses) { const sys = graph.nav2, wf = sys && sys.model("waypoint"); if (!wf) return false; const r = wf.follow(poses, { done() {} }); return !r.rejected; },
  };
}
export { Nav2System, NavNode };
