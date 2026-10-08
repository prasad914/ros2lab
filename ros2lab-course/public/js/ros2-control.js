// ros2_control inside Gazebo (gz_ros2_control), as students meet it on ROS 2 Jazzy + Gazebo Harmonic.
// Pure logic, no DOM: the practice graph calls it and prints what it returns.
//
// What a robot needs before teleop can move it with ros2_control (and what this file checks, step by step):
//   1. a <ros2_control> tag in the URDF: hardware plugin gz_ros2_control/GazeboSimSystem + every joint with its
//      command interface (velocity for wheels, position for arm joints) and state interfaces (position, velocity)
//   2. the Gazebo plugin gz_ros2_control-system (gz_ros2_control::GazeboSimROS2ControlPlugin) with <parameters> = controllers.yaml
//   3. controllers.yaml: controller_manager.update_rate, each controller's type, and the controller's own parameters
//   4. spawner nodes for joint_state_broadcaster and the motion controller (after the robot is spawned)
//   5. commands on the controller's topic: /diff_drive_controller/cmd_vel takes geometry_msgs/msg/TwistStamped on Jazzy,
//      so teleop needs:  ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true -r cmd_vel:=/diff_drive_controller/cmd_vel

// ---------- tiny YAML reader (maps, inline lists, block lists, numbers, booleans, strings) ----------
export function readYaml(text) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  if (lines.some((l) => /^\s*\t/.test(l))) return { error: "found character '\\t' that cannot start any token (YAML allows spaces only)" };
  const val = (v) => {
    v = v.trim();
    if (v === "") return "";
    if (/^(true|True|TRUE)$/.test(v)) return true;
    if (/^(false|False|FALSE)$/.test(v)) return false;
    if (/^[-+]?\d+$/.test(v)) return Number(v);
    if (/^[-+]?(\d*\.\d+|\d+\.\d*)([eE][-+]?\d+)?$/.test(v) || /^[-+]?\d+[eE][-+]?\d+$/.test(v)) return Number(v);
    if (/^\[.*\]$/.test(v)) { const inner = v.slice(1, -1).trim(); return inner ? splitTop(inner).map(val) : []; }
    if (/^\{.*\}$/.test(v)) { const o = {}; for (const part of splitTop(v.slice(1, -1))) { const i = part.indexOf(":"); if (i > 0) o[part.slice(0, i).trim().replace(/^["']|["']$/g, "")] = val(part.slice(i + 1)); } return o; }
    return v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  };
  const splitTop = (s) => { const out = []; let d = 0, cur = "", q = null; for (const c of s) { if (q) { cur += c; if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; cur += c; continue; } if ("[{".includes(c)) d++; if ("]}".includes(c)) d--; if (c === "," && d === 0) { out.push(cur); cur = ""; } else cur += c; } if (cur.trim()) out.push(cur); return out; };
  const root = {}; const stack = [{ ind: -1, obj: root, key: null, parent: null }];
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li].replace(/(^|\s)#.*$/, "").replace(/\s+$/, "");
    if (!raw.trim()) continue;
    const ind = raw.length - raw.trimStart().length, t = raw.trim();
    while (stack.length > 1 && ind <= stack[stack.length - 1].ind) stack.pop();
    const top = stack[stack.length - 1];
    if (t.startsWith("- ") || t === "-") {
      // a block list item belongs to the key that opened this level
      if (!Array.isArray(top.obj)) {
        if (top.parent && top.key != null && top.obj && typeof top.obj === "object" && !Object.keys(top.obj).length) { top.obj = []; top.parent[top.key] = top.obj; }
        else return { error: `while parsing a block mapping, line ${li + 1}: expected <block end>, but found '-'` };
      }
      top.obj.push(val(t.slice(1)));
      continue;
    }
    const m = t.match(/^("[^"]*"|'[^']*'|[^:]+?)\s*:(\s+(.*)|)$/);
    if (!m) return { error: `mapping values are not allowed here, line ${li + 1}: ${t}` };
    const key = m[1].replace(/^["']|["']$/g, ""), rest = (m[3] || "").trim();
    if (Array.isArray(top.obj)) return { error: `line ${li + 1}: a key inside a list` };
    if (rest === "") { const o = {}; top.obj[key] = o; stack.push({ ind, obj: o, key, parent: top.obj }); }
    else top.obj[key] = val(rest);
  }
  return { data: root };
}

// ---------- the URDF side ----------
const attr = (s, n) => { const m = String(s).match(new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`)); return m ? m[1] : null; };
export function parseRos2Control(urdf) {
  const text = String(urdf || "").replace(/<!--[\s\S]*?-->/g, "");
  const systems = [];
  for (const m of text.matchAll(/<ros2_control\b([^>]*)>([\s\S]*?)<\/ros2_control>/g)) {
    const body = m[2];
    const plugin = ((body.match(/<hardware>[\s\S]*?<plugin>\s*([^<\s]+)\s*<\/plugin>/) || [])[1]) || null;
    const joints = [];
    for (const j of body.matchAll(/<joint\b([^>]*)>([\s\S]*?)<\/joint>/g)) {
      const jb = j[2], cmd = [], st = [];
      for (const c of jb.matchAll(/<command_interface\b([^>]*?)(?:\/>|>([\s\S]*?)<\/command_interface>)/g)) {
        const p = {}; for (const pm of String(c[2] || "").matchAll(/<param\s+name="([^"]+)"\s*>\s*([^<]*?)\s*<\/param>/g)) p[pm[1]] = Number(pm[2]);
        cmd.push({ name: attr(c[1], "name"), min: p.min, max: p.max });
      }
      for (const s of jb.matchAll(/<state_interface\b([^>]*?)(?:\/>|>([\s\S]*?)<\/state_interface>)/g)) {
        const init = (String(s[2] || "").match(/<param\s+name="initial_value"\s*>\s*([^<]*?)\s*<\/param>/) || [])[1];
        st.push({ name: attr(s[1], "name"), initial: init !== undefined ? Number(init) : undefined });
      }
      joints.push({ name: attr(j[1], "name"), command: cmd, state: st });
    }
    systems.push({ name: attr(m[1], "name") || "GazeboSimSystem", type: attr(m[1], "type") || "system", plugin, joints });
  }
  // the Gazebo plugin that starts controller_manager inside the simulator
  let gzPlugin = null;
  for (const g of text.matchAll(/<plugin\b([^>]*)>([\s\S]*?)<\/plugin>/g)) {
    const fn = attr(g[1], "filename") || "", nm = attr(g[1], "name") || "";
    if (/gz_ros2_control|ign_ros2_control|gazebo_ros2_control/.test(fn + nm)) {
      const params = [...g[2].matchAll(/<parameters>\s*([^<]+?)\s*<\/parameters>/g)].map((x) => x[1]);
      const ns = (g[2].match(/<ros>[\s\S]*?<namespace>\s*([^<]*?)\s*<\/namespace>/) || [])[1] || "";
      const remaps = [...g[2].matchAll(/<remapping>\s*([^<]+?)\s*<\/remapping>/g)].map((x) => x[1]);
      const cmName = (g[2].match(/<controller_manager_name>\s*([^<]+?)\s*<\/controller_manager_name>/) || [])[1] || "controller_manager";
      const hold = (g[2].match(/<hold_joints>\s*([^<]+?)\s*<\/hold_joints>/) || [])[1];
      gzPlugin = { filename: fn, name: nm, params, ns, remaps, cmName, holdJoints: hold === undefined ? true : /^(true|1)$/i.test(hold), classic: /gazebo_ros2_control/.test(fn) || /libgazebo_ros2_control/.test(fn), ignition: /ign_ros2_control/.test(fn + nm) };
    }
  }
  return { systems, gzPlugin };
}

// ---------- controllers ----------
export const CONTROLLER_TYPES = {
  "joint_state_broadcaster/JointStateBroadcaster": "jsb",
  "diff_drive_controller/DiffDriveController": "diff",
  "joint_trajectory_controller/JointTrajectoryController": "jtc",
  "forward_command_controller/ForwardCommandController": "fwd",
  "position_controllers/JointGroupPositionController": "fwd_pos",
  "velocity_controllers/JointGroupVelocityController": "fwd_vel",
  "effort_controllers/JointGroupEffortController": "fwd_eff",
  "imu_sensor_broadcaster/IMUSensorBroadcaster": "imu",
  "force_torque_sensor_broadcaster/ForceTorqueSensorBroadcaster": "ft",
  "tricycle_controller/TricycleController": "other",
  "ackermann_steering_controller/AckermannSteeringController": "other",
  "mecanum_drive_controller/MecanumDriveController": "other",
  "gripper_controllers/GripperActionController": "gripper",
  "parallel_gripper_action_controller/GripperActionController": "gripper",
  "pid_controller/PidController": "other",
  "admittance_controller/AdmittanceController": "other",
};
const TYPE_LIST = Object.keys(CONTROLLER_TYPES).map((x) => x.trim()).filter((x, i, a) => a.indexOf(x) === i);
const IFACE = { fwd_pos: "position", fwd_vel: "velocity", fwd_eff: "effort" };
const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const arr = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);

export class ControllerManager {
  /**
   * @param {object} o
   *   urdf: robot description text (xacro already expanded)
   *   yaml: { text, path } the controllers.yaml given to the Gazebo plugin (or null)
   *   name: controller manager node name (default controller_manager), ns: namespace
   *   joints: names of joints that exist in the simulated model
   */
  constructor(o) {
    this.urdf = o.urdf; this.ns = o.ns || ""; this.name = o.name || "controller_manager";
    const p = parseRos2Control(o.urdf);
    this.systems = p.systems; this.gzPlugin = p.gzPlugin;
    this.modelJoints = new Set(o.joints || []);
    this.yamlPath = o.yaml ? o.yaml.path : null;
    this.yamlError = null; this.params = {};
    if (o.yaml && o.yaml.text == null && o.yaml.path) this.yamlError = `parameter file ${o.yaml.path} does not exist (did colcon build install the config folder?)`;
    if (o.yaml && o.yaml.text != null) {
      const r = readYaml(o.yaml.text);
      if (r.error) this.yamlError = r.error;
      else for (const [k, body] of Object.entries(r.data || {})) { const key = k.replace(/^\//, ""); this.params[key] = body && typeof body === "object" ? body.ros__parameters : undefined; if (body && typeof body === "object" && !("ros__parameters" in body) && key !== "/**") this.params[key] = { __noRosParams: true }; }
    }
    const cmp = this.params[this.name] || {};
    this.updateRate = num(cmp.update_rate, 100);
    this.controllers = new Map();   // name -> { type, kind, state: unconfigured|inactive|active, params, claimed: [] }
    this.iface = new Map();         // "joint/iface" -> { kind: "command"|"state", value, claimedBy }
    for (const s of this.systems) for (const j of s.joints) {
      for (const c of j.command) this.iface.set(`${j.name}/${c.name}`, { kind: "command", joint: j.name, name: c.name, min: c.min, max: c.max, value: 0, claimedBy: null, system: s.name });
      for (const st of j.state) this.iface.set(`${j.name}/${st.name}:state`, { kind: "state", joint: j.name, name: st.name, value: st.initial || 0, system: s.name });
    }
    this.hwState = "active";
    this.odom = { x: 0, y: 0, th: 0, v: 0, w: 0 };
    this.lastCmd = null; this.lastCmdAt = -1e9;
    this.traj = new Map();   // controller -> {points, t0, joints}
  }
  get full() { return `${this.ns ? "/" + this.ns.replace(/^\/|\/$/g, "") : ""}/${this.name}`; }
  topicOf(ctrl, leaf) { return `${this.ns ? "/" + this.ns.replace(/^\/|\/$/g, "") : ""}/${ctrl}/${leaf}`; }

  // what the Gazebo window's terminal prints when the plugin starts (the [gazebo-1] lines of ros2 launch)
  startupLogs(modelJoints) {
    const L = [], I = (src, t) => L.push({ level: "INFO", src, text: t }), W = (src, t) => L.push({ level: "WARN", src, text: t }), E = (src, t) => L.push({ level: "ERROR", src, text: t });
    if (this.gzPlugin && this.gzPlugin.classic) { E("gazebo", "[Err] [SystemLoader.cc:92] Failed to load system plugin [libgazebo_ros2_control.so] : Could not find shared library."); L.push({ level: "HINT", text: "libgazebo_ros2_control.so is the plugin for Gazebo Classic. Gazebo Harmonic needs filename=\"gz_ros2_control-system\" name=\"gz_ros2_control::GazeboSimROS2ControlPlugin\"." }); this.dead = true; return L; }
    if (this.gzPlugin && this.gzPlugin.ignition) W("gazebo", "[ign_ros2_control] is the old name of this plugin. On Jazzy use filename=\"gz_ros2_control-system\" name=\"gz_ros2_control::GazeboSimROS2ControlPlugin\".");
    if (!this.systems.length) { E("gz_ros_control", "There are no <ros2_control> tags in the robot description, so there is nothing to control."); L.push({ level: "HINT", text: "Add a <ros2_control name=\"GazeboSimSystem\" type=\"system\"> block with <hardware><plugin>gz_ros2_control/GazeboSimSystem</plugin></hardware> and one <joint> per wheel/joint." }); this.dead = true; return L; }
    for (const s of this.systems) if (s.plugin !== "gz_ros2_control/GazeboSimSystem") { E("resource_manager", `The hardware plugin '${s.plugin}' is not for Gazebo. Inside Gazebo Harmonic use gz_ros2_control/GazeboSimSystem${s.plugin === "mock_components/GenericSystem" ? " (mock_components/GenericSystem is for running without a simulator)" : ""}.`); }
    if (!this.gzPlugin.params.length) { E("gz_ros_control", "No parameter file provided. Configuration might be wrong"); L.push({ level: "HINT", text: "Give the plugin your controllers file: <parameters>$(find my_pkg)/config/controllers.yaml</parameters>" }); }
    if (this.yamlError) { E("gz_ros_control", `Failed to parse parameter file ${this.yamlPath}: ${this.yamlError}`); this.dead = true; return L; }
    I("gz_ros_control", "[gz_ros2_control] Setting up controller for [" + (this.robotName || "robot") + "] (Entity=" + (8 + Math.floor(Math.random() * 30)) + ")].");
    I("gz_ros_control", "[gz_ros2_control] Create ResourceManager");
    I("gz_ros_control", "Loading controller_manager");
    I(this.name, "Using Steady (Monotonic) clock for triggering controller manager cycles.");
    I(this.name, "Subscribing to '/robot_description' topic for robot description.");
    I(this.name, "Received robot description from topic.");
    for (const s of this.systems) {
      for (const j of s.joints) {
        if (!this.modelJoints.has(j.name)) { W("gz_ros_control", `Skipping joint in the URDF named '${j.name}' which is not in the gazebo model.`); continue; }
        I("gz_ros_control", `Loading joint: ${j.name}`);
        I("gz_ros_control", "\tState:");
        for (const st of j.state) I("gz_ros_control", `\t\t ${st.name}`);
        I("gz_ros_control", "\tCommand:");
        for (const c of j.command) I("gz_ros_control", `\t\t ${c.name}`);
      }
      I("resource_manager", `Initialize hardware '${s.name}' `);
      I("resource_manager", `Successful initialization of hardware '${s.name}'`);
      I("resource_manager", `'configure' hardware '${s.name}' `);
      I("gz_ros_control", "System Successfully configured!");
      I("resource_manager", `Successful 'configure' of hardware '${s.name}'`);
      I("resource_manager", `'activate' hardware '${s.name}' `);
      I("resource_manager", `Successful 'activate' of hardware '${s.name}'`);
    }
    I(this.name, "Resource Manager has been successfully initialized. Starting Controller Manager services...");
    I(this.name, `update rate is ${this.updateRate} Hz`);
    return L;
  }

  // ---------- lifecycle ----------
  load(name) {
    const L = [];
    if (this.dead) return { ok: false, logs: L };
    if (this.controllers.has(name)) { L.push({ level: "WARN", src: this.name, text: `Controller already loaded, skipping load_controller` }); return { ok: true, logs: L }; }
    const cmp = this.params[this.name] || {};
    const decl = cmp[name];
    const type = typeof cmp[`${name}.type`] === "string" ? cmp[`${name}.type`] : decl && typeof decl === "object" ? decl.type : undefined;
    if (!type) { L.push({ level: "ERROR", src: this.name, text: `The 'type' param was not defined for '${name}'.` }); return { ok: false, logs: L, why: `controllers.yaml has no "${name}:" with "type:" under controller_manager → ros__parameters.` }; }
    const kind = CONTROLLER_TYPES[type];
    L.push({ level: "INFO", src: this.name, text: `Loading controller : '${name}' of type '${type}'` });
    if (!kind) { L.push({ level: "ERROR", src: this.name, text: `Loader for controller '${name}' (type '${type}') not found.` }); L.push({ level: "INFO", src: this.name, text: `Available classes:\n  ${TYPE_LIST.join("\n  ")}` }); return { ok: false, logs: L, why: `"${type}" is not a controller type that is installed. Check the spelling (package/ClassName).` }; }
    L.push({ level: "INFO", src: this.name, text: `Loading controller '${name}'` });
    if (this.yamlPath) L.push({ level: "INFO", src: this.name, text: `Controller '${name}' node arguments: --ros-args --params-file ${this.yamlPath} ` });
    const own = this.params[name];
    this.controllers.set(name, { name, type, kind, state: "unconfigured", params: own && !own.__noRosParams ? own : {}, noRosParams: !!(own && own.__noRosParams), claimed: [] });
    return { ok: true, logs: L };
  }
  configure(name) {
    const c = this.controllers.get(name), L = [];
    if (!c) return { ok: false, logs: [{ level: "ERROR", src: this.name, text: `Controller '${name}' not found` }] };
    L.push({ level: "INFO", src: this.name, text: `Configuring controller: '${name}'` });
    const P = c.params;
    if (c.noRosParams) L.push({ level: "WARN", src: name, text: `the parameters for '${name}' are not under 'ros__parameters' (two underscores), so they were not loaded` });
    const fail = (t) => { L.push({ level: "ERROR", src: name, text: t }); L.push({ level: "ERROR", src: this.name, text: `After configuring, controller '${name}' is in state 'unconfigured' , expected inactive.` }); return { ok: false, logs: L }; };
    if (c.kind === "diff") {
      const left = arr(P.left_wheel_names), right = arr(P.right_wheel_names);
      if (!left.length || !right.length) return fail("Wheel names parameters are empty!");
      if (left.length !== right.length) return fail(`The number of left wheels [${left.length}] and the number of right wheels [${right.length}] are different`);
      if (!(num(P.wheel_separation, 0) > 0)) return fail("Wheel separation parameter 'wheel_separation' must be set and greater than zero");
      if (!(num(P.wheel_radius, 0) > 0)) return fail("Wheel radius parameter 'wheel_radius' must be set and greater than zero");
      if (P.use_stamped_vel === false) L.push({ level: "WARN", src: name, text: "[Deprecated]: the use_stamped_vel parameter is deprecated. Jazzy subscribes to geometry_msgs/msg/TwistStamped only." });
    }
    if (["jtc", "fwd", "fwd_pos", "fwd_vel", "fwd_eff"].includes(c.kind)) {
      if (!arr(P.joints).length) return fail("'joints' parameter was empty");
      if (c.kind === "jtc" && (!arr(P.command_interfaces).length || !arr(P.state_interfaces).length)) return fail(`'${!arr(P.command_interfaces).length ? "command_interfaces" : "state_interfaces"}' parameter is empty.`);
      if (c.kind === "fwd" && !P.interface_name) return fail("'interface_name' parameter was empty");
    }
    c.state = "inactive";
    if (c.kind === "jtc") L.push({ level: "INFO", src: name, text: `Command interfaces are [${arr(P.command_interfaces).join(", ")}] and state interfaces are [${arr(P.state_interfaces).join(", ")}].` }, { level: "INFO", src: name, text: "Using 'splines' interpolation method." }, { level: "INFO", src: name, text: `Action status changes will be monitored at ${num(P.action_monitor_rate, 20).toFixed(2)} Hz.` });
    return { ok: true, logs: L };
  }
  needs(c) {   // command interfaces the controller claims
    const P = c.params;
    if (c.kind === "diff") return [...arr(P.left_wheel_names), ...arr(P.right_wheel_names)].map((j) => `${j}/velocity`);
    if (c.kind === "jtc") return arr(P.joints).flatMap((j) => arr(P.command_interfaces).map((i) => `${j}/${i}`));
    if (c.kind === "fwd") return arr(P.joints).map((j) => `${j}/${P.interface_name}`);
    if (IFACE[c.kind]) return arr(P.joints).map((j) => `${j}/${IFACE[c.kind]}`);
    if (c.kind === "gripper") return arr(P.joint || P.joints).map((j) => `${j}/position`);
    return [];
  }
  activate(names) {
    const L = [{ level: "INFO", src: this.name, text: `Activating controllers: [ ${names.join(" ")} ]` }];
    for (const n of names) {
      const c = this.controllers.get(n);
      if (!c || c.state === "unconfigured") { L.push({ level: "ERROR", src: this.name, text: `Can't activate controller '${n}': controller is not configured` }); return { ok: false, logs: L }; }
      const want = this.needs(c);
      for (const k of want) {
        const it = this.iface.get(k);
        if (!it) {
          L.push({ level: "ERROR", src: this.name, text: `Can't activate controller '${n}': Command interface with '${k}' does not exist` });
          if (c.kind === "diff") L.push({ level: "ERROR", src: n, text: `Unable to obtain joint command handle for ${k.split("/")[0]}` });
          return { ok: false, logs: L, why: `Your <ros2_control> tag has no joint "${k.split("/")[0]}" with <command_interface name="${k.split("/")[1]}"/>, or the name in controllers.yaml is spelled differently.` };
        }
        if (it.claimedBy && it.claimedBy !== n) { L.push({ level: "WARN", src: this.name, text: `Resource conflict for controller '${n}'. Command interface '${k}' is already claimed.` }); L.push({ level: "ERROR", src: this.name, text: `Could not switch controllers since prepare command mode switch was rejected.` }); return { ok: false, logs: L, why: `'${it.claimedBy}' already uses ${k}. Only one active controller may command a joint: deactivate the other one first.` }; }
      }
      for (const k of want) this.iface.get(k).claimedBy = n;
      c.claimed = want; c.state = "active";
      if (c.kind === "diff") { this.odom = { x: 0, y: 0, th: 0, v: 0, w: 0 }; this.lastCmd = null; }
    }
    return { ok: true, logs: L };
  }
  deactivate(names) {
    const L = [{ level: "INFO", src: this.name, text: `Deactivating controllers: [ ${names.join(" ")} ]` }];
    for (const n of names) { const c = this.controllers.get(n); if (!c) continue; for (const k of c.claimed) { const it = this.iface.get(k); if (it && it.claimedBy === n) it.claimedBy = null; } c.claimed = []; if (c.state === "active") c.state = "inactive"; }
    return { ok: true, logs: L };
  }
  unload(name) { const c = this.controllers.get(name); if (!c) return { ok: false, logs: [{ level: "ERROR", src: this.name, text: `Could not find controller '${name}' to unload` }] }; if (c.state === "active") return { ok: false, logs: [{ level: "ERROR", src: this.name, text: `Could not unload controller with name '${name}' because it is still active` }] }; this.controllers.delete(name); return { ok: true, logs: [{ level: "INFO", src: this.name, text: `Unloading controller: '${name}'` }] }; }

  // the spawner program: ros2 run controller_manager spawner NAME... [-c /controller_manager] [--param-file F] [--inactive]
  spawn(names, opt = {}) {
    const S = [], add = (lv, src, t) => S.push({ level: lv, src, text: t });
    const sp = `spawner_${names[0]}`;
    for (const n of names) {
      const r = this.load(n); r.logs.forEach((x) => S.push(x));
      if (!r.ok) { add("ERROR", sp, `Failed loading controller ${n}`); return { ok: false, logs: S, why: r.why }; }
      add("INFO", sp, `Loaded ${n}`);
    }
    for (const n of names) { const r = this.configure(n); r.logs.forEach((x) => S.push(x)); if (!r.ok) { add("ERROR", sp, `Failed to configure controller`); return { ok: false, logs: S }; } }
    if (opt.inactive) { add("INFO", sp, `Configured ${names.join(", ")}`); return { ok: true, logs: S }; }
    const a = this.activate(names); a.logs.forEach((x) => S.push(x));
    if (!a.ok) { add("ERROR", sp, `Failed to activate controller`); return { ok: false, logs: S, why: a.why }; }
    add("INFO", sp, `Configured and activated ${names.length > 1 ? names.join(", ") : names[0]}`);
    return { ok: true, logs: S };
  }

  // ---------- what `ros2 control ...` prints ----------
  listControllers(verbose) {
    const rows = [...this.controllers.values()];
    const w = Math.max(...rows.map((c) => c.name.length), 10), tw = Math.max(...rows.map((c) => c.type.length), 10);
    return rows.map((c) => {
      const line = `${c.name.padEnd(w)} ${c.type.padEnd(tw)} ${c.state}`;
      if (!verbose) return line;
      const ci = c.claimed.length ? `\n\tclaimed interfaces:\n${c.claimed.map((k) => `\t\t${k}`).join("\n")}` : "";
      return line + ci;
    });
  }
  listHardwareInterfaces() {
    const cmd = [...this.iface.entries()].filter(([, v]) => v.kind === "command").sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const st = [...this.iface.entries()].filter(([, v]) => v.kind === "state").sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return ["command interfaces", ...cmd.map(([k, v]) => `\t${k} [available] [${v.claimedBy ? "claimed" : "unclaimed"}]`), "state interfaces", ...st.map(([k]) => `\t${k.replace(/:state$/, "")}`)];
  }
  listHardwareComponents() {
    const out = [];
    this.systems.forEach((s, i) => {
      out.push(`Hardware Component ${i + 1}`, `\tname: ${s.name}`, `\ttype: ${s.type}`, `\tplugin name: ${s.plugin}`, `\tstate: id=3 label=${this.hwState}`, "\tcommand interfaces");
      for (const j of s.joints) for (const c of j.command) { const it = this.iface.get(`${j.name}/${c.name}`); out.push(`\t\t${j.name}/${c.name} [available] [${it && it.claimedBy ? "claimed" : "unclaimed"}]`); }
    });
    return out;
  }
  listControllerTypes() { return TYPE_LIST.map((t) => `${t.padEnd(62)} controller_interface::ControllerInterface`); }

  // ---------- topics, services, actions that the active controllers create ----------
  // the ROS interfaces of one controller (each controller is its own node), or of the controller_manager node (name null)
  endpointsFor(name) {
    if (name == null) return { pubs: [], subs: [["/robot_description", "std_msgs/msg/String"]], srvs: this.services(), acts: [] };
    const c = this.controllers.get(name); if (!c) return { pubs: [], subs: [], srvs: [], acts: [] };
    const e = this.endpoints(name);
    return { pubs: e.pubs, subs: e.subs, srvs: [], acts: e.actions };
  }
  endpoints(only) {
    const pubs = [], subs = [], actions = [];
    const jsb = [...this.controllers.values()].find((c) => c.kind === "jsb" && c.state !== "unconfigured" && (!only || c.name === only));
    if (jsb) pubs.push(["/joint_states", "sensor_msgs/msg/JointState"], ["/dynamic_joint_states", "control_msgs/msg/DynamicJointState"]);
    for (const c of this.controllers.values()) {
      if (c.state === "unconfigured" || (only && c.name !== only)) continue;
      if (c.kind === "diff") {
        subs.push([this.topicOf(c.name, "cmd_vel"), "geometry_msgs/msg/TwistStamped"]);
        pubs.push([this.topicOf(c.name, "odom"), "nav_msgs/msg/Odometry"]);
        if (c.params.enable_odom_tf !== false) pubs.push(["/tf", "tf2_msgs/msg/TFMessage"]);
        pubs.push([this.topicOf(c.name, "transition_event"), "lifecycle_msgs/msg/TransitionEvent"]);
      }
      if (c.kind === "jtc") {
        subs.push([this.topicOf(c.name, "joint_trajectory"), "trajectory_msgs/msg/JointTrajectory"]);
        pubs.push([this.topicOf(c.name, "controller_state"), "control_msgs/msg/JointTrajectoryControllerState"]);
        actions.push([this.topicOf(c.name, "follow_joint_trajectory"), "control_msgs/action/FollowJointTrajectory"]);
      }
      if (["fwd", "fwd_pos", "fwd_vel", "fwd_eff"].includes(c.kind)) subs.push([this.topicOf(c.name, "commands"), "std_msgs/msg/Float64MultiArray"]);
      if (c.kind === "gripper") actions.push([this.topicOf(c.name, "gripper_cmd"), "control_msgs/action/GripperCommand"]);
    }
    return { pubs, subs, actions };
  }
  services() {
    const b = this.full;
    return ["list_controllers", "list_controller_types", "list_hardware_components", "list_hardware_interfaces", "load_controller", "configure_controller", "reload_controller_libraries", "switch_controller", "unload_controller", "set_hardware_component_state"]
      .map((s) => [`${b}/${s}`, `controller_manager_msgs/srv/${s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("")}`]);
  }

  // A message arrived on a topic. Returns { used, note } so the graph can tell the student why nothing moved.
  receive(topic, type, msg, now) {
    for (const c of this.controllers.values()) {
      if (c.kind === "diff" && topic === this.topicOf(c.name, "cmd_vel")) {
        if (!/TwistStamped$/.test(type)) return { used: false, note: `${c.name} subscribes to ${topic} with geometry_msgs/msg/TwistStamped (ROS 2 Jazzy). A plain Twist is a different type, so the controller never receives it. Use teleop with -p stamped:=true, or publish a TwistStamped.` };
        if (c.state !== "active") return { used: false, note: `${c.name} is ${c.state}, not active, so it ignores commands.` };
        const tw = msg.twist || msg;
        this.lastCmd = { vx: num(tw.linear && tw.linear.x, 0), wz: num(tw.angular && tw.angular.z, 0) }; this.lastCmdAt = now;
        return { used: true, controller: c.name };
      }
      if (["fwd", "fwd_pos", "fwd_vel", "fwd_eff"].includes(c.kind) && topic === this.topicOf(c.name, "commands")) {
        if (c.state !== "active") return { used: false, note: `${c.name} is not active.` };
        const data = arr(msg.data).map(Number), joints = arr(c.params.joints);
        if (data.length !== joints.length) return { used: false, note: `[ERROR] [${c.name}]: command size (${data.length}) does not match number of interfaces (${joints.length})`, log: true };
        joints.forEach((j, i) => { const it = this.iface.get(this.needs(c)[i]); if (it) it.value = clampIf(data[i], it); });
        return { used: true, controller: c.name };
      }
      if (c.kind === "jtc" && topic === this.topicOf(c.name, "joint_trajectory")) {
        if (c.state !== "active") return { used: false, note: `${c.name} is not active.` };
        return this.trajectory(c, msg, now);
      }
    }
    return { used: false };
  }
  trajectory(c, msg, now) {
    const joints = arr(msg.joint_names), points = arr(msg.points);
    const want = arr(c.params.joints);
    if (!points.length) return { used: true, controller: c.name, note: "Empty trajectory: the controller holds the current position." };
    const missing = joints.filter((j) => !want.includes(j));
    if (missing.length) return { used: false, note: `[ERROR] [${c.name}]: Joints on incoming trajectory don't match the controller joints.`, log: true };
    if (joints.length !== want.length && !(c.params.allow_partial_joints_goal === true || c.params.allow_partial_joints_goal === "true")) return { used: false, note: `[ERROR] [${c.name}]: Joints on incoming trajectory don't match the controller joints (all ${want.length} joints are needed: ${want.join(", ")}; or set allow_partial_joints_goal: true).`, log: true };
    const pts = points.map((p) => ({ q: arr(p.positions).map(Number), t: num(p.time_from_start && (p.time_from_start.sec || 0) + (p.time_from_start.nanosec || 0) * 1e-9, 0) }));
    if (pts.some((p) => p.q.length !== joints.length)) return { used: false, note: `[ERROR] [${c.name}]: Mismatch between joint_names size (${joints.length}) and positions (${pts[0].q.length}) at point #0.`, log: true };
    const start = Object.fromEntries(want.map((j) => [j, this.jointPos(j)]));
    this.traj.set(c.name, { joints, pts, t0: now, start });
    return { used: true, controller: c.name };
  }
  jointPos(j) { const s = this.iface.get(`${j}/position:state`); return s ? s.value : 0; }

  // Advance one step: returns velocity commands per wheel joint and position targets per joint for the simulator.
  step(now, dt) {
    const out = { velocity: {}, position: {}, base: null };
    for (const c of this.controllers.values()) {
      if (c.state !== "active") continue;
      if (c.kind === "diff") {
        const P = c.params, timeout = num(P.cmd_vel_timeout, 0.5), r = num(P.wheel_radius, 0.033) * num(P.right_wheel_radius_multiplier, 1), sep = num(P.wheel_separation, 0.3) * num(P.wheel_separation_multiplier, 1);
        let vx = 0, wz = 0;
        if (this.lastCmd && now - this.lastCmdAt <= timeout) { vx = this.lastCmd.vx; wz = this.lastCmd.wz; }
        const lim = (v, k) => { const hv = P[`linear.x.max_velocity`] ?? (P.linear && P.linear.x && P.linear.x.max_velocity); return k === "v" && typeof hv === "number" && hv > 0 ? Math.max(-hv, Math.min(hv, v)) : v; };
        vx = lim(vx, "v");
        const wl = (vx - wz * sep / 2) / r, wr = (vx + wz * sep / 2) / r;
        for (const j of arr(P.left_wheel_names)) { out.velocity[j] = wl; const it = this.iface.get(`${j}/velocity`); if (it) it.value = wl; }
        for (const j of arr(P.right_wheel_names)) { out.velocity[j] = wr; const it = this.iface.get(`${j}/velocity`); if (it) it.value = wr; }
        this.odom.th += wz * dt; this.odom.x += vx * Math.cos(this.odom.th) * dt; this.odom.y += vx * Math.sin(this.odom.th) * dt; this.odom.v = vx; this.odom.w = wz;
        out.base = { vx, wz, controller: c.name, base: P.base_frame_id || "base_link", odomFrame: P.odom_frame_id || "odom", tf: P.enable_odom_tf !== false };
      }
      if (c.kind === "jtc") {
        const tr = this.traj.get(c.name);
        if (!tr) continue;
        const t = now - tr.t0, pts = tr.pts;
        let k = pts.findIndex((p) => p.t >= t);
        let q;
        if (k < 0) { q = pts[pts.length - 1].q; this.traj.delete(c.name); this.trajDone = { controller: c.name, at: now }; }
        else {
          const a = k === 0 ? { q: tr.joints.map((j) => tr.start[j]), t: 0 } : pts[k - 1], b = pts[k];
          const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1, s = f * f * (3 - 2 * f);
          q = b.q.map((v, i) => a.q[i] + (v - a.q[i]) * s);
        }
        tr.joints.forEach((j, i) => { out.position[j] = q[i]; const it = this.iface.get(`${j}/position`); if (it) it.value = q[i]; });
      }
      if (["fwd_pos", "fwd"].includes(c.kind) && (c.kind === "fwd_pos" || c.params.interface_name === "position")) for (const k of c.claimed) { const it = this.iface.get(k); if (it) out.position[it.joint] = it.value; }
      if (["fwd_vel"].includes(c.kind) || (c.kind === "fwd" && c.params.interface_name === "velocity")) for (const k of c.claimed) { const it = this.iface.get(k); if (it) out.velocity[it.joint] = it.value; }
    }
    return out;
  }
  // the simulator reports where the joints really are (feeds state interfaces, /joint_states, odometry)
  setState(joints) { for (const [j, s] of Object.entries(joints)) { const p = this.iface.get(`${j}/position:state`), v = this.iface.get(`${j}/velocity:state`); if (p && s.position != null) p.value = s.position; if (v && s.velocity != null) v.value = s.velocity; } }
  jointStates() {
    const names = [...new Set([...this.iface.values()].filter((v) => v.kind === "state").map((v) => v.joint))];
    return { name: names, position: names.map((j) => this.jointPos(j)), velocity: names.map((j) => { const v = this.iface.get(`${j}/velocity:state`); return v ? v.value : 0; }), effort: [] };
  }
  hasActive(kind) { return [...this.controllers.values()].some((c) => c.kind === kind && c.state === "active"); }
}
function clampIf(v, it) { if (typeof it.min === "number" && v < it.min) return it.min; if (typeof it.max === "number" && v > it.max) return it.max; return v; }

// ---------- files a student would write, generated for a robot (used by the RViz page's "simulation" package) ----------
export function ros2ControlXacro({ wheels, arm, ns }) {
  const L = ['  <ros2_control name="GazeboSimSystem" type="system">', "    <hardware>", "      <plugin>gz_ros2_control/GazeboSimSystem</plugin>", "    </hardware>"];
  for (const w of wheels || []) L.push(`    <joint name="${w}">`, '      <command_interface name="velocity">', '        <param name="min">-10</param>', '        <param name="max">10</param>', "      </command_interface>", '      <state_interface name="position"/>', '      <state_interface name="velocity"/>', "    </joint>");
  for (const j of arm || []) L.push(`    <joint name="${j.name}">`, '      <command_interface name="position"/>', `      <state_interface name="position">`, `        <param name="initial_value">${(j.initial || 0).toFixed(3)}</param>`, "      </state_interface>", '      <state_interface name="velocity"/>', "    </joint>");
  L.push("  </ros2_control>", "", "  <gazebo>", '    <plugin filename="gz_ros2_control-system" name="gz_ros2_control::GazeboSimROS2ControlPlugin">', `      <parameters>$(find ${ns || "my_robot_sim"})/config/controllers.yaml</parameters>`, "    </plugin>", "  </gazebo>");
  return L.join("\n");
}
export function controllersYaml({ wheels, separation, radius, base, arm, rate = 100, maxLinear = 0.26, maxAngular = 1.82 }) {
  const L = ["controller_manager:", "  ros__parameters:", `    update_rate: ${rate}  # Hz`, "", "    joint_state_broadcaster:", "      type: joint_state_broadcaster/JointStateBroadcaster", ""];
  if (wheels) L.push("    diff_drive_controller:", "      type: diff_drive_controller/DiffDriveController", "");
  if (arm && arm.length) L.push("    joint_trajectory_controller:", "      type: joint_trajectory_controller/JointTrajectoryController", "");
  if (wheels) L.push("diff_drive_controller:", "  ros__parameters:", `    left_wheel_names: ["${wheels.left.join('", "')}"]`, `    right_wheel_names: ["${wheels.right.join('", "')}"]`, `    wheel_separation: ${separation}`, `    wheel_radius: ${radius}`, `    base_frame_id: ${base || "base_footprint"}`, "    odom_frame_id: odom", "    publish_rate: 50.0", "    enable_odom_tf: true", "    cmd_vel_timeout: 0.5", `    linear.x.max_velocity: ${maxLinear}`, `    angular.z.max_velocity: ${maxAngular}`, "");
  if (arm && arm.length) L.push("joint_trajectory_controller:", "  ros__parameters:", "    joints:", ...arm.map((j) => `      - ${j.name}`), "    command_interfaces:", "      - position", "    state_interfaces:", "      - position", "      - velocity", "    allow_partial_joints_goal: true", "");
  return L.join("\n");
}
