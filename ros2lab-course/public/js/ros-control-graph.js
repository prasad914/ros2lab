// ros2_control inside the practice Gazebo: the gz_ros2_control plugin starts a controller_manager when a robot with
// <ros2_control> + the gz_ros2_control-system plugin is spawned; spawner loads/configures/activates controllers;
// `ros2 control ...` inspects them; commands on the controllers' topics move the simulated joints.
// Mixed into RosGraph.prototype (like gzMethods). The controller logic itself lives in ros2-control.js.
import { ControllerManager } from "./ros2-control.js";

const stampNow = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
const fmt = (l, tag) => (l.level === "HINT" ? null : `${tag ? `[${tag}] ` : ""}[${l.level}] [${stampNow()}] [${l.src}]: ${l.text}`);
const f6 = (x) => { const v = Number(x) || 0; return Number.isInteger(v) ? `${v}.0` : String(Math.round(v * 1e6) / 1e6); };
const qYaw = (y) => [0, 0, Math.sin(y / 2), Math.cos(y / 2)];

export const CONTROL_PKGS = ["controller_manager", "gz_ros2_control", "joint_state_broadcaster", "diff_drive_controller", "joint_trajectory_controller", "forward_command_controller", "position_controllers", "velocity_controllers", "ros2controlcli"];

export const rcMethods = {
  cmModels() { return this.gzRunning() ? [...this.gz.models.values()].filter((m) => m.cm && !m.cm.dead) : []; },
  cmFind(full) { const f = "/" + String(full || "/controller_manager").replace(/^\/+/, ""); return this.cmModels().find((m) => m.cm.full === f) || null; },

  // the gz_ros2_control plugin of a robot that was just spawned: start its controller_manager (lines go to Gazebo's terminal)
  cmAttach(m) {
    const p = m.gazebo.plugins.find((x) => x.kind === "gz_ros2_control");
    if (!p) return null;
    if (!this.sh.rosPkgs.has("gz_ros2_control")) return { err: [`[Err] [SystemLoader.cc:92] Failed to load system plugin [gz_ros2_control-system] : couldn't find shared library.`], hint: "gz_ros2_control is not installed, so no controller_manager starts and no controller can move the robot. Install it: sudo apt install ros-jazzy-gz-ros2-control ros-jazzy-ros2-controllers" };
    const path = p.params ? String(p.params).trim() : null;
    const text = path ? this.shareText(path) : undefined;
    const shown = path ? this.sharePath(path).replace(/^\/home\/student\/ros2_ws\/src\/([\w-]+)\//, "/home/student/ros2_ws/install/$1/share/$1/") : null;
    const cm = new ControllerManager({ urdf: m.urdf, yaml: path ? { path: shown, text } : null, joints: Object.keys(m.joints), name: (p.cmName || "controller_manager") });
    cm.robotName = m.name;
    const logs = cm.startupLogs();
    m.cm = cm;
    const out = [], err = [];
    for (const l of logs) { const t = fmt(l); if (!t) continue; (/^\[(ERROR|WARN)\]/.test(t) || l.level === "ERROR" ? err : out).push(t); }
    const hint = logs.filter((l) => l.level === "HINT").map((l) => l.text).join(" ");
    if (!cm.dead) {
      const n = this.add("cm", cm.name, cm.ns || "", {}); Object.assign(n.params, { update_rate: cm.updateRate, use_sim_time: true }); n.ptypes = { update_rate: "integer", use_sim_time: "bool" };
      n.cm = cm; n.model = m.name;
      // hold_joints: until a controller claims them, Gazebo holds the joints where they are
      if (cm.gzPlugin && cm.gzPlugin.holdJoints) m.held = true;
    }
    return { out, err, hint: hint || null };
  },

  // ros2 run controller_manager spawner NAME... [-c CM] [-p FILE | --param-file FILE] [--inactive]
  spawnerRun(args, { tag, inline } = {}) {
    const names = [], opt = { cm: "/controller_manager", inactive: false, file: null };
    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]);
      if (a === "--ros-args") break;
      if (a === "-c" || a === "--controller-manager") opt.cm = args[++i];
      else if (a === "-p" || a === "--param-file") opt.file = args[++i];
      else if (a === "--inactive") opt.inactive = true;
      else if (a === "-t" || a === "--controller-type" || a === "--controller-manager-timeout" || a === "-n" || a === "--namespace") i++;
      else if (!a.startsWith("-")) names.push(a);
    }
    const sp = `spawner_${names[0] || "controller"}`, P = (lv, t) => `${tag ? `[${tag}] ` : ""}[${lv}] [${stampNow()}] [${sp}]: ${t}`;
    if (!names.length) return { lines: [this.err("usage: spawner [-h] [-c CONTROLLER_MANAGER] [-p PARAM_FILE] [--inactive] controller_names [controller_names ...]"), this.err("spawner: error: the following arguments are required: controller_names")], fail: true };
    const svc = `${"/" + String(opt.cm).replace(/^\/+/, "")}/list_controllers`;
    const hit = this.cmFind(opt.cm);
    if (!hit) {
      const why = !this.gzRunning() ? "Gazebo is not running" : !this.cmModels().length ? "no spawned robot has a <ros2_control> tag with the gz_ros2_control-system plugin, so no controller_manager is running" : `the controller_manager is called ${this.cmModels().map((m) => m.cm.full).join(", ")}, not ${opt.cm}`;
      return { lines: [this.out(P("INFO", `waiting for service ${svc} to become available...`)), this.err(P("WARN", `Could not contact service ${svc}`)), this.err(P("INFO", `waiting for service ${svc} to become available...`)), this.err(P("ERROR", "Controller manager not available"))],
        fail: true, hint: `Nothing answers ${svc}: ${why}. Start the simulation first (and check that the robot spawned), then run the spawner again.` };
    }
    const cm = hit.cm;
    if (opt.file) { const t = this.shareText(opt.file); if (t === undefined) return { lines: [this.err(P("ERROR", `Parameter file '${opt.file}' does not exist`))], fail: true }; }
    const r = cm.spawn(names, { inactive: opt.inactive });
    const lines = [], gzLines = [];
    for (const l of r.logs) { const t = fmt(l); if (!t) continue; if (String(l.src).startsWith("spawner_")) lines.push((l.level === "ERROR" ? this.err : this.out).call(this, `${tag ? `[${tag}] ` : ""}${t}`)); else gzLines.push(t); }
    // every loaded controller is a ROS node of its own
    for (const n of names) if (cm.controllers.has(n) && !this.nodes.some((x) => x.kind === "ctrl" && x.ctrl === n && x.cm === cm)) { const c = this.add("ctrl", n, cm.ns || "", {}); const { P, T } = this.ctrlParamsOf(cm, n); Object.assign(c.params, P); c.ptypes = T; c.cm = cm; c.ctrl = n; c.model = hit.name; }
    if (r.ok) { hit.held = false; hit.cmLog = (hit.cmLog || 0) + 1; }
    if (gzLines.length && this.gz && !inline) (this.notices = this.notices || []).push(...gzLines.map((t) => ({ node: this.gz.node, text: t, cls: /\[(ERROR|WARN)\]/.test(t) ? "warn-line" : "" })));
    return { lines, gzLines: inline ? gzLines : null, fail: !r.ok, hint: r.ok ? null : r.why || "The controller could not be started: read the [controller_manager] lines in the Gazebo terminal." };
  },

  // ros2 control <verb>
  ros2Control(args) {
    const [verb, ...rest] = args;
    if (!this.sh.rosPkgs.has("controller_manager")) return [this.err(`ros2: invalid choice: 'control' (choose from 'action', 'bag', 'component', 'daemon', 'doctor', 'interface', 'launch', 'lifecycle', 'multicast', 'node', 'param', 'pkg', 'run', 'security', 'service', 'topic', 'wtf')`), this.hint("ros2 control comes with ros2_control: sudo apt install ros-jazzy-ros2-control ros-jazzy-ros2-controllers")];
    const VERBS = ["list_controllers", "list_controller_types", "list_hardware_components", "list_hardware_interfaces", "load_controller", "reload_controller_libraries", "set_controller_state", "set_hardware_component_state", "switch_controllers", "unload_controller", "view_controller_chains"];
    if (!verb || verb === "-h" || verb === "--help") return ["usage: ros2 control <command> [-h]", "", "Various control related sub-commands", "", "Commands:", ...VERBS.map((v) => `  ${v}`), "", "  Call `ros2 control <command> -h` for more detailed usage."].map((t) => this.out(t));
    if (!VERBS.includes(verb)) return [this.err(`ros2 control: error: argument Call \`ros2 control <command> -h\` for more detailed usage.: invalid choice: '${verb}' (choose from ${VERBS.map((v) => `'${v}'`).join(", ")})`)];
    let cmName = "/controller_manager"; const ci = rest.findIndex((x) => x === "-c" || x === "--controller-manager"); if (ci >= 0) cmName = rest[ci + 1];
    const hit = this.cmFind(cmName);
    if (!hit) return [this.err(`Could not contact service ${"/" + String(cmName).replace(/^\/+/, "")}/${verb === "switch_controllers" ? "switch_controller" : verb === "set_controller_state" ? "switch_controller" : verb}`), this.hint(this.gzRunning() ? "(No controller_manager is running: the spawned robot needs a <ros2_control> tag and the gz_ros2_control-system plugin.)" : "(No controller_manager is running. Start the Gazebo simulation first.)")];
    const cm = hit.cm, pos = rest.filter((x, i) => !x.startsWith("-") && !(i > 0 && /^(-c|--controller-manager|--set-state)$/.test(rest[i - 1])));
    const L = (arr) => arr.map((t) => this.out(t));
    const gzSay = (logs) => { const ls = logs.map((l) => fmt(l)).filter(Boolean); if (ls.length && this.gz) (this.notices = this.notices || []).push(...ls.map((t) => ({ node: this.gz.node, text: t }))); };
    switch (verb) {
      case "list_controllers": return L(cm.listControllers(rest.includes("-v") || rest.includes("--verbose")));
      case "list_controller_types": return L(cm.listControllerTypes());
      case "list_hardware_components": return L(cm.listHardwareComponents());
      case "list_hardware_interfaces": return L(cm.listHardwareInterfaces());
      case "view_controller_chains": return [this.out("Successfully generated controller_diagram.gv and controller_diagram.gv.pdf")];
      case "reload_controller_libraries": return [this.out("Reload successful")];
      case "load_controller": {
        const name = pos[0]; if (!name) return [this.err("usage: ros2 control load_controller [-h] [--set-state {inactive,active}] controller_name [param_file]")];
        const r = cm.load(name); gzSay(r.logs);
        if (!r.ok) return [this.err(`Error loading controller ${name}, check controller_manager logs`), ...(r.why ? [this.hint(`(${r.why})`)] : [])];
        this.cmNode(hit, name);
        const si = rest.indexOf("--set-state"), st = si >= 0 ? rest[si + 1] : null;
        if (st) { const c = cm.configure(name); gzSay(c.logs); if (!c.ok) return [this.err(`Error configuring controller ${name}`)]; if (st === "active") { const a = cm.activate([name]); gzSay(a.logs); if (!a.ok) return [this.err(`Error activating controller ${name}, check controller_manager logs`), ...(a.why ? [this.hint(`(${a.why})`)] : [])]; hit.held = false; } }
        return [this.out(`Successfully loaded controller ${name}${st ? ` into state ${st}` : ""}`)];
      }
      case "set_controller_state": {
        const [name, st] = pos; const c = cm.controllers.get(name);
        if (!c) return [this.err(`controller ${name} does not seem to be loaded`)];
        if (st === "inactive") { if (c.state === "unconfigured") { const r = cm.configure(name); gzSay(r.logs); if (!r.ok) return [this.err(`Error configuring controller ${name}`)]; } else { gzSay(cm.deactivate([name]).logs); } return [this.out(`Successfully configured ${name}`)]; }
        if (st === "active") { if (c.state === "unconfigured") return [this.err(`cannot activate ${name} from its current state unconfigured: configure it first (set_controller_state ${name} inactive)`)]; const a = cm.activate([name]); gzSay(a.logs); if (!a.ok) return [this.err(`Error activating ${name}, check controller_manager logs`), ...(a.why ? [this.hint(`(${a.why})`)] : [])]; hit.held = false; return [this.out(`Successfully activated ${name}`)]; }
        return [this.err("usage: ros2 control set_controller_state [-h] controller_name {inactive,active}")];
      }
      case "switch_controllers": {
        const grab = (flag) => { const i = rest.indexOf(flag); if (i < 0) return []; const o = []; for (let k = i + 1; k < rest.length && !rest[k].startsWith("-"); k++) o.push(rest[k]); return o; };
        const off = grab("--deactivate"), on = grab("--activate");
        if (off.length) gzSay(cm.deactivate(off).logs);
        if (on.length) { const a = cm.activate(on); gzSay(a.logs); if (!a.ok) return [this.err("Error switching controllers, check controller_manager logs"), ...(a.why ? [this.hint(`(${a.why})`)] : [])]; hit.held = false; }
        return [this.out("Successfully switched controllers")];
      }
      case "unload_controller": {
        const r = cm.unload(pos[0]); gzSay(r.logs);
        if (!r.ok) return [this.err(`Error unloading controller ${pos[0]}, check controller_manager logs`)];
        this.nodes = this.nodes.filter((n) => !(n.kind === "ctrl" && n.ctrl === pos[0] && n.cm === cm));
        return [this.out(`Successfully unloaded controller ${pos[0]}`)];
      }
      case "set_hardware_component_state": return [this.out(`Successfully set ${pos[0]} to state ${pos[1]}`)];
    }
    return [];
  },
  // the parameters a controller node shows (ros2 param list / get): its controllers.yaml section, flattened
  ctrlParamsOf(cm, name) {
    const c = cm.controllers.get(name), P = { use_sim_time: true, type: c ? c.type : "" }, T = { use_sim_time: "bool", type: "string" };
    const walk = (o, pre) => { for (const [k, v] of Object.entries(o || {})) { const key = pre ? `${pre}.${k}` : k; if (v && typeof v === "object" && !Array.isArray(v)) walk(v, key); else { P[key] = v; T[key] = typeof v === "number" ? (key === "update_rate" ? "integer" : "double") : typeof v === "boolean" ? "bool" : Array.isArray(v) ? "string_array" : "string"; } } };
    if (c) walk(c.params, "");
    return { P, T };
  },
  cmNode(hit, name) { const cm = hit.cm; if (!this.nodes.some((x) => x.kind === "ctrl" && x.ctrl === name && x.cm === cm)) { const c = this.add("ctrl", name, cm.ns || "", {}); const { P, T } = this.ctrlParamsOf(cm, name); Object.assign(c.params, P); c.ptypes = T; c.cm = cm; c.ctrl = name; c.model = hit.name; } },

  // a message published on ROS: does a controller take it?  type: full ROS type, msg: parsed fields
  cmDeliver(topic, type, msg) {
    const out = [];
    for (const m of this.cmModels()) { const r = m.cm.receive(topic, type, msg, this.gz.time); if (r.used || r.note) out.push({ model: m, ...r }); }
    return out;
  },
  // one simulation step for robots driven by ros2_control
  cmStep(m, dt) {
    if (!m.cm || m.cm.dead) return;
    // teleop_twist_keyboard with -p repeat_rate:=N keeps re-sending its last command (so the 0.5 s cmd_vel_timeout never stops the robot)
    for (const n of this.nodes) if (n.kind === "teleop_twist" && n.lastV && Number(n.params.repeat_rate) > 0 && n.stampedOut) m.cm.receive(n.lastTopic, "geometry_msgs/msg/TwistStamped", { twist: { linear: { x: n.lastV.lx }, angular: { z: n.lastV.az } } }, this.gz.time);
    for (const n of this.nodes) if (n.kind === "pubcli" && n.pub) m.cm.receive(n.pub.topic, n.pub.type, n.pub.msg, this.gz.time);   // a running ros2 topic pub
    const o = m.cm.step(this.gz.time, dt);
    const vel = {};
    for (const [j, w] of Object.entries(o.velocity)) if (j in m.joints) { m.joints[j] += w * dt; vel[j] = w; }
    for (const [j, q] of Object.entries(o.position)) if (j in m.joints) { const d = q - m.joints[j]; vel[j] = d / dt; m.joints[j] = q; }
    if (o.base) { m.cmd = { vx: o.base.vx, wz: o.base.wz }; m.pose.yaw += o.base.wz * dt; m.pose.x += o.base.vx * Math.cos(m.pose.yaw) * dt; m.pose.y += o.base.vx * Math.sin(m.pose.yaw) * dt; m.cmBase = o.base; }
    m.cm.setState(Object.fromEntries(Object.keys(m.joints).map((j) => [j, { position: m.joints[j], velocity: vel[j] || 0 }])));
  },
  // TF from diff_drive_controller (odom -> base), published straight on /tf (no bridge involved)
  cmTfEdges() {
    const E = [];
    for (const m of this.cmModels()) {
      const c = [...m.cm.controllers.values()].find((x) => x.kind === "diff" && x.state === "active"); if (!c || c.params.enable_odom_tf === false) continue;
      const o = m.cm.odom;
      E.push({ parent: c.params.odom_frame_id || "odom", child: c.params.base_frame_id || "base_link", t: [o.x, o.y, 0], q: qYaw(o.th), gz: true });
    }
    return E;
  },
  cmJoints() {
    for (const m of this.cmModels()) if (m.cm.hasActive("jsb") || [...m.cm.controllers.values()].some((c) => c.kind === "jsb" && c.state !== "unconfigured")) return { ...m.joints };
    return null;
  },
  cmRate(topic) {
    for (const m of this.cmModels()) for (const c of m.cm.controllers.values()) {
      if (c.state !== "active") continue;
      if (c.kind === "jsb" && topic === "/joint_states") return m.cm.updateRate;
      if (c.kind === "diff" && topic === m.cm.topicOf(c.name, "odom")) return Number(c.params.publish_rate) || 50;
      if (c.kind === "jtc" && topic === m.cm.topicOf(c.name, "controller_state")) return Number(c.params.state_publish_rate) || m.cm.updateRate;
    }
    return null;
  },
  cmSample(topic) {
    if (!this.gzRunning()) return null;
    const t = this.gz.time, sec = Math.floor(t), nsec = Math.round((t - sec) * 1e9);
    for (const m of this.cmModels()) for (const c of m.cm.controllers.values()) {
      if (c.state !== "active") continue;
      if (c.kind === "jsb" && topic === "/joint_states") { const J = m.cm.jointStates(); const arr = (a) => a.map((x) => `- ${f6(x)}`).join("\n") || "[]"; return [`header:\n  stamp:\n    sec: ${sec}\n    nanosec: ${nsec}\n  frame_id: ''\nname:\n${J.name.map((x) => `- ${x}`).join("\n")}\nposition:\n${arr(J.position)}\nvelocity:\n${arr(J.velocity)}\neffort:\n${arr(J.name.map(() => 0))}`]; }
      if (c.kind === "diff" && topic === m.cm.topicOf(c.name, "odom")) { const o = m.cm.odom, q = qYaw(o.th); return [`header:\n  stamp:\n    sec: ${sec}\n    nanosec: ${nsec}\n  frame_id: ${c.params.odom_frame_id || "odom"}\nchild_frame_id: ${c.params.base_frame_id || "base_link"}\npose:\n  pose:\n    position:\n      x: ${f6(o.x)}\n      y: ${f6(o.y)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${f6(q[2])}\n      w: ${f6(q[3])}\ntwist:\n  twist:\n    linear:\n      x: ${f6(o.v)}\n      y: 0.0\n      z: 0.0\n    angular:\n      x: 0.0\n      y: 0.0\n      z: ${f6(o.w)}`]; }
    }
    return null;
  },
};

// The YAML of a `ros2 topic pub` for the controller message types -> plain objects
export function parseCtrlMsg(type, yaml) {
  const y = String(yaml);
  const num = (re) => { const m = y.match(re); return m ? Number(m[1]) : 0; };
  if (/TwistStamped$/.test(type) || /\/Twist$/.test(type)) {
    const lin = (y.match(/linear:\s*\{([^}]*)\}/) || [, ""])[1], ang = (y.match(/angular:\s*\{([^}]*)\}/) || [, ""])[1];
    const g = (s, k) => { const m = s.match(new RegExp(`(?:^|[{,\\s])${k}:\\s*(-?[\\d.]+(?:e-?\\d+)?)`)); return m ? Number(m[1]) : 0; };
    return { twist: { linear: { x: g(lin, "x"), y: g(lin, "y"), z: g(lin, "z") }, angular: { x: g(ang, "x"), y: g(ang, "y"), z: g(ang, "z") } }, frame: (y.match(/frame_id:\s*['"]?([\w/]*)/) || [, ""])[1] };
  }
  if (/Float64MultiArray$/.test(type)) { const m = y.match(/data:\s*\[([^\]]*)\]/); return { data: m ? m[1].split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x)) : [] }; }
  if (/JointTrajectory$/.test(type)) {
    const jn = (y.match(/joint_names:\s*\[([^\]]*)\]/) || [, ""])[1].split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    const points = [];
    for (const pm of y.matchAll(/positions:\s*\[([^\]]*)\]([\s\S]*?)(?=positions:|$)/g)) {
      const q = pm[1].split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
      const tm = pm[2].match(/time_from_start:\s*\{([^}]*)\}/), sec = tm ? Number((tm[1].match(/sec:\s*(\d+)/) || [, 0])[1]) : 0, ns = tm ? Number((tm[1].match(/nanosec:\s*(\d+)/) || [, 0])[1]) : 0;
      points.push({ positions: q, time_from_start: { sec, nanosec: ns } });
    }
    return { joint_names: jn, points };
  }
  return {};
}
