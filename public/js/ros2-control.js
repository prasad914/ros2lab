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
    // PyYAML's indentless block list: "key:" then "- a" at the key's own indentation
    const last = stack[stack.length - 1];
    if ((t.startsWith("- ") || t === "-") && stack.length > 1 && last.ind === ind && last.key != null && (last.indentless || (last.obj && typeof last.obj === "object" && !Array.isArray(last.obj) && !Object.keys(last.obj).length))) {
      if (!last.indentless) { last.obj = []; last.parent[last.key] = last.obj; last.indentless = true; }
      last.obj.push(val(t.slice(1)));
      continue;
    }
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
    if (rest === "") { const prev = top.obj[key], o = prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}; top.obj[key] = o; stack.push({ ind, obj: o, key, parent: top.obj }); }   // a repeated key merges, as rcl's parameter parser does
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
    const joints = [], sensors = [], gpios = [];
    for (const j of body.matchAll(/<(joint|sensor|gpio)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const jb = j[3], cmd = [], st = [];
      for (const c of jb.matchAll(/<command_interface\b([^>]*?)(?:\/>|>([\s\S]*?)<\/command_interface>)/g)) {
        const p = {}; for (const pm of String(c[2] || "").matchAll(/<param\s+name="([^"]+)"\s*>\s*([^<]*?)\s*<\/param>/g)) p[pm[1]] = Number(pm[2]);
        cmd.push({ name: attr(c[1], "name"), min: p.min, max: p.max });
      }
      for (const s of jb.matchAll(/<state_interface\b([^>]*?)(?:\/>|>([\s\S]*?)<\/state_interface>)/g)) {
        const init = (String(s[2] || "").match(/<param\s+name="initial_value"\s*>\s*([^<]*?)\s*<\/param>/) || [])[1];
        st.push({ name: attr(s[1], "name"), initial: init !== undefined ? Number(init) : undefined });
      }
      // <sensor> (force-torque, IMU) and <gpio> blocks of a ros2_control tag export interfaces too
      ({ joint: joints, sensor: sensors, gpio: gpios })[j[1]].push({ name: attr(j[2], "name"), command: cmd, state: st, component: j[1] });
    }
    // <ros2_control rw_rate=".." is_async=".."> and GenericSystem's mock_*_commands flags (list_hardware_components shows them)
    const hwFlag = (n) => /^(true|1)$/i.test(((body.match(new RegExp(`<hardware>[\\s\\S]*?<param\\s+name="${n}"\\s*>\\s*([^<]*?)\\s*<\\/param>`)) || [])[1]) || "");
    systems.push({ name: attr(m[1], "name") || "GazeboSimSystem", type: attr(m[1], "type") || "system", plugin, joints, sensors, gpios,
      rwRate: Number(attr(m[1], "rw_rate")) || 0, isAsync: /^(true|1)$/i.test(attr(m[1], "is_async") || ""), mockSensorCommands: hwFlag("mock_sensor_commands"), mockGpioCommands: hwFlag("mock_gpio_commands") });
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
  "ackermann_steering_controller/AckermannSteeringController": "ackermann",
  "mecanum_drive_controller/MecanumDriveController": "mecanum",
  "gripper_controllers/GripperActionController": "gripper",
  "parallel_gripper_action_controller/GripperActionController": "gripper",
  // the makers' own controllers (official workspaces): UR's scaled JTC behaves like a JTC at 100 % speed scaling
  "ur_controllers/ScaledJointTrajectoryController": "jtc",
  "ur_controllers/SpeedScalingStateBroadcaster": "other",
  "ur_controllers/GPIOController": "other",
  "ur_controllers/PassthroughTrajectoryController": "other",
  "ur_controllers/ForceModeController": "other",
  "ur_controllers/FreedriveModeController": "other",
  "ur_controllers/ToolContactController": "other",
  "ur_controllers/URConfigurationController": "other",
  "ur_controllers/TrajectoryUntilController": "other",
  "franka_robot_state_broadcaster/FrankaRobotStateBroadcaster": "other",
  "franka_example_controllers/GravityCompensationExampleController": "other",
  "franka_example_controllers/JointImpedanceExampleController": "other",
  "franka_example_controllers/JointPositionExampleController": "other",
  "franka_example_controllers/JointVelocityExampleController": "other",
  "franka_example_controllers/MoveToStartExampleController": "other",
  "robotiq_controllers/RobotiqActivationController": "other",
  "picknik_twist_controller/PicknikTwistController": "other",
  "picknik_reset_fault_controller/PicknikResetFaultController": "other",
  "pose_broadcaster/PoseBroadcaster": "other",
  "range_sensor_broadcaster/RangeSensorBroadcaster": "other",
  "pid_controller/PidController": "other",
  "admittance_controller/AdmittanceController": "other",
};
const MEC_WHEELS = ["front_left", "front_right", "rear_left", "rear_right"];
const ackJoints = (P) => ({ tr: (Array.isArray(P.traction_joints_names) && P.traction_joints_names.length ? P.traction_joints_names : Array.isArray(P.rear_wheels_names) ? P.rear_wheels_names : []), st: (Array.isArray(P.steering_joints_names) && P.steering_joints_names.length ? P.steering_joints_names : Array.isArray(P.front_wheels_names) ? P.front_wheels_names : []) });
const TYPE_LIST = Object.keys(CONTROLLER_TYPES).map((x) => x.trim()).filter((x, i, a) => a.indexOf(x) === i);
// controller classes a workspace's pluginlib XML declares (<class name="pkg/Class" base_class_type=
// "controller_interface::ControllerInterface">): loadable once built; those not modelled behave as "other"
export function registerControllerTypes(xmlText) {
  let n = 0;
  for (const m of String(xmlText).matchAll(/<class\b[^>]*\bname="([\w]+\/[\w]+)"[^>]*base_class_type="controller_interface::(?:Chainable)?ControllerInterface"/g)) {
    if (!(m[1] in CONTROLLER_TYPES)) { CONTROLLER_TYPES[m[1]] = "other"; TYPE_LIST.push(m[1]); n++; }
  }
  return n;
}
const IFACE = { fwd_pos: "position", fwd_vel: "velocity", fwd_eff: "effort" };
// ros2_controllers (Jazzy): gripper_controllers serves control_msgs/action/GripperCommand, the newer
// parallel_gripper_action_controller serves control_msgs/action/ParallelGripperCommand (both on ~/gripper_cmd)
const gripperAction = (type) => (/^parallel_gripper_action_controller\//.test(type) ? "control_msgs/action/ParallelGripperCommand" : "control_msgs/action/GripperCommand");
// the ROS interfaces the makers' controllers create (read from their sources: ur_controllers/src/*.cpp)
const UR = "ur_controllers/";
const MAKER_ENDPOINTS = {
  [UR + "SpeedScalingStateBroadcaster"]: [["pub", "speed_scaling", "std_msgs/msg/Float64"]],
  [UR + "GPIOController"]: [["pub", "io_states", "ur_msgs/msg/IOStates"], ["pub", "tool_data", "ur_msgs/msg/ToolDataMsg"], ["pub", "robot_mode", "ur_dashboard_msgs/msg/RobotMode"], ["pub", "safety_mode", "ur_dashboard_msgs/msg/SafetyMode"], ["pub", "robot_program_running", "std_msgs/msg/Bool"],
    ["srv", "set_io", "ur_msgs/srv/SetIO"], ["srv", "set_analog_output", "ur_msgs/srv/SetAnalogOutput"], ["srv", "set_speed_slider", "ur_msgs/srv/SetSpeedSliderFraction"], ["srv", "resend_robot_program", "std_srvs/srv/Trigger"], ["srv", "hand_back_control", "std_srvs/srv/Trigger"], ["srv", "set_payload", "ur_msgs/srv/SetPayload"], ["srv", "zero_ftsensor", "std_srvs/srv/Trigger"]],
  [UR + "ForceModeController"]: [["srv", "start_force_mode", "ur_msgs/srv/SetForceMode"], ["srv", "stop_force_mode", "std_srvs/srv/Trigger"]],
  [UR + "FreedriveModeController"]: [["sub", "enable_freedrive_mode", "std_msgs/msg/Bool"]],
  [UR + "FrictionModelController"]: [["srv", "set_friction_model_parameters", "ur_msgs/srv/SetFrictionModelParameters"]],
  [UR + "GravityUpdateController"]: [["srv", "set_gravity", "ur_msgs/srv/SetGravity"]],
  [UR + "PassthroughTrajectoryController"]: [["act", "follow_joint_trajectory", "control_msgs/action/FollowJointTrajectory"]],
  [UR + "ToolContactController"]: [["act", "detect_tool_contact", "ur_msgs/action/ToolContact"]],
  [UR + "TwistController"]: [["sub", "twist", "geometry_msgs/msg/TwistStamped"]],
  [UR + "URConfigurationController"]: [["srv", "get_robot_software_version", "ur_msgs/srv/GetRobotSoftwareVersion"]],
};
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
      // node names nested under a namespace wildcard ("/**:" then "controller_manager:", as franka_ros2 writes them)
      // ... or under the node's namespace ("/wx250s:" then "controller_manager:", as interbotix writes them)
      if (!r.error && r.data) for (const w of Object.keys(r.data)) { const inner = r.data[w]; if ((w === "**" || w.startsWith("/")) && inner && typeof inner === "object" && !("ros__parameters" in inner) && Object.values(inner).some((v) => v && typeof v === "object" && "ros__parameters" in v)) { delete r.data[w]; Object.assign(r.data, inner); } }
      if (r.error) this.yamlError = r.error;
      else for (const [k, body] of Object.entries(r.data || {})) { const key = k.replace(/^\//, ""); this.params[key] = body && typeof body === "object" ? body.ros__parameters : undefined; if (body && typeof body === "object" && !("ros__parameters" in body) && key !== "/**") this.params[key] = { __noRosParams: true }; }
    }
    const cmp = this.params[this.name] || {};
    this.updateRate = num(cmp.update_rate, 100);
    this.controllers = new Map();   // name -> { type, kind, state: unconfigured|inactive|active, params, claimed: [] }
    this.iface = new Map();         // "joint/iface" -> { kind: "command"|"state", value, claimedBy }
    for (const s of this.systems) for (const j of [...s.joints, ...(s.sensors || []), ...(s.gpios || [])]) {
      for (const c of j.command) this.iface.set(`${j.name}/${c.name}`, { kind: "command", joint: j.name, name: c.name, min: c.min, max: c.max, value: 0, claimedBy: null, system: s.name });
      for (const st of j.state) this.iface.set(`${j.name}/${st.name}:state`, { kind: "state", joint: j.name, name: st.name, value: st.initial || 0, system: s.name });
    }
    this.hwState = "active";
    this.odom = { x: 0, y: 0, th: 0, v: 0, w: 0 };
    this.lastCmd = null; this.lastCmdAt = -1e9;
    this.traj = new Map();   // controller -> {points, t0, joints}
    this.tfRemaps = new Set();   // controllers' ~/tf_odometry topics remapped to /tf (spawner --controller-ros-args)
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
    if (this.controllers.has(name)) { L.push({ level: "WARN", src: `spawner_${name}`, text: `Controller already loaded, skipping load_controller` }); return { ok: true, logs: L, already: true }; }
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
    if (c.kind === "mecanum") {
      const w = MEC_WHEELS.map((k) => P[`${k}_wheel_command_joint_name`]);
      if (w.some((x) => !x)) return fail(`Parameter '${MEC_WHEELS[w.findIndex((x) => !x)]}_wheel_command_joint_name' has invalid value '': parameter must not be empty`);
      const K = P.kinematics || {};
      if (!(num(K.wheels_radius, 0) > 0)) return fail("Parameter 'kinematics.wheels_radius' must be set and greater than zero");
    }
    if (c.kind === "ackermann") {
      const tr = arr(P.traction_joints_names).length ? arr(P.traction_joints_names) : arr(P.rear_wheels_names), st = arr(P.steering_joints_names).length ? arr(P.steering_joints_names) : arr(P.front_wheels_names);
      if (!tr.length || !st.length) return fail("Wrong number of traction or steering joints: traction_joints_names and steering_joints_names must be set");
      if (!(num(P.wheelbase, 0) > 0)) return fail("Parameter 'wheelbase' must be greater than zero");
      if (P.rear_wheels_names !== undefined || P.front_wheels_names !== undefined) L.push({ level: "WARN", src: name, text: "[Deprecated]: 'rear_wheels_names' / 'front_wheels_names' are deprecated: use 'traction_joints_names' and 'steering_joints_names'" });
    }
    if (["jtc", "fwd", "fwd_pos", "fwd_vel", "fwd_eff"].includes(c.kind)) {
      if (!arr(P.joints).length) return fail("'joints' parameter was empty");
      if (c.kind === "jtc" && (!arr(P.command_interfaces).length || !arr(P.state_interfaces).length)) return fail(`'${!arr(P.command_interfaces).length ? "command_interfaces" : "state_interfaces"}' parameter is empty.`);
      if (c.kind === "fwd" && !P.interface_name) return fail("'interface_name' parameter was empty");
    }
    c.state = "inactive";
    if (c.kind === "jsb") L.push({ level: "INFO", src: name, text: !arr(P.joints).length || !arr(P.interfaces).length ? "'joints' or 'interfaces' parameter is empty. All available state interfaces will be published" : "Publishing state interfaces defined in 'joints' and 'interfaces' parameters." });
    if (c.kind === "jtc") L.push({ level: "INFO", src: name, text: `Command interfaces are [${arr(P.command_interfaces).join(", ")}] and state interfaces are [${arr(P.state_interfaces).join(", ")}].` }, { level: "INFO", src: name, text: "Using 'splines' interpolation method." }, { level: "INFO", src: name, text: `Action status changes will be monitored at ${num(P.action_monitor_rate, 20).toFixed(2)} Hz.` });
    return { ok: true, logs: L };
  }
  needs(c) {   // command interfaces the controller claims
    const P = c.params;
    if (c.kind === "diff") return [...arr(P.left_wheel_names), ...arr(P.right_wheel_names)].map((j) => `${j}/velocity`);
    if (c.kind === "mecanum") return MEC_WHEELS.map((k) => `${P[`${k}_wheel_command_joint_name`]}/velocity`);
    if (c.kind === "ackermann") { const { tr, st } = ackJoints(P); return [...tr.map((j) => `${j}/velocity`), ...st.map((j) => `${j}/position`)]; }
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
          // real controller_manager (ground-truth/real/gen3_sim_control): WARN "Unable to activate ... is not available."
          // then the spawner's "Failed to activate controller : <name>"
          if (c.kind === "gripper") { L.push({ level: "WARN", src: this.name, text: `Unable to activate controller '${n}' since the command interface '${k}' is not available.` }); L.push({ level: "ERROR", src: `spawner_${n}`, text: `Failed to activate controller : ${n}` }); return { ok: false, logs: L, why: `"${k}" is not a command interface of the hardware.` }; }
          L.push({ level: "ERROR", src: this.name, text: `Can't activate controller '${n}': Command interface with '${k}' does not exist` });
          if (c.kind === "diff") L.push({ level: "ERROR", src: n, text: `Unable to obtain joint command handle for ${k.split("/")[0]}` });
          return { ok: false, logs: L, why: `Your <ros2_control> tag has no joint "${k.split("/")[0]}" with <command_interface name="${k.split("/")[1]}"/>, or the name in controllers.yaml is spelled differently.` };
        }
        if (it.claimedBy && it.claimedBy !== n) { L.push({ level: "WARN", src: this.name, text: `Resource conflict for controller '${n}'. Command interface '${k}' is already claimed.` }); L.push({ level: "ERROR", src: this.name, text: `Could not switch controllers since prepare command mode switch was rejected.` }); return { ok: false, logs: L, why: `'${it.claimedBy}' already uses ${k}. Only one active controller may command a joint: deactivate the other one first.` }; }
      }
      for (const k of want) this.iface.get(k).claimedBy = n;
      c.claimed = want; c.state = "active";
      if (["diff", "mecanum", "ackermann"].includes(c.kind)) { this.odom = { x: 0, y: 0, th: 0, v: 0, w: 0 }; this.lastCmd = null; }
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
    // controller_manager/spawner.py (Jazzy): per controller load -> "Loaded X", configure, then (unless --inactive)
    // switch_controllers -> "Configured and activated X"; --activate-as-group activates them together at the end
    for (const n of names) {
      const r = this.load(n); r.logs.forEach((x) => S.push(x));
      if (!r.ok) { add("FATAL", sp, `Failed loading controller ${n}`); return { ok: false, logs: S, why: r.why }; }
      if (!r.already) add("INFO", sp, `Loaded ${n}`);
      const cf = this.configure(n); cf.logs.forEach((x) => S.push(x));
      if (!cf.ok) { add("ERROR", sp, "Failed to configure controller"); return { ok: false, logs: S }; }
      if (opt.inactive || opt.group) continue;
      const a = this.activate([n]); a.logs.forEach((x) => S.push(x));
      if (!a.ok) { add("ERROR", sp, `Failed to activate controller : ${n}`); return { ok: false, logs: S, why: a.why }; }
      add("INFO", sp, `Configured and activated ${n}`);
    }
    if (opt.group && !opt.inactive) {
      const a = this.activate(names); a.logs.forEach((x) => S.push(x));
      if (!a.ok) { add("ERROR", sp, `Failed to activate the parsed controllers list : [${names.map((x) => `'${x}'`).join(", ")}]`); return { ok: false, logs: S, why: a.why }; }
      add("INFO", sp, `Configured and activated all the parsed controllers list : [${names.map((x) => `'${x}'`).join(", ")}]!`);
    }
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
  // ros2controlcli 4.49 list_hardware_components: rw_rate 0 (or above update_rate) is clamped to the controller_manager
  // update_rate (resource_manager.cpp); command interfaces are every exported one (joints, gpios, and with GenericSystem
  // mock_sensor_commands / mock_gpio_commands the sensor / gpio states too); -v adds data types and the state interfaces
  listHardwareComponents(verbose = false) {
    const out = [];
    this.systems.forEach((s, i) => {
      const rw = !s.rwRate || s.rwRate > this.updateRate ? this.updateRate : s.rwRate;
      out.push(`Hardware Component ${i + 1}`, `\tname: ${s.name}`, `\ttype: ${s.type}`, `\tplugin name: ${s.plugin}`, `\tstate: id=3 label=${this.hwState}`, `\tread/write rate: ${rw} Hz`, `\tis_async: ${s.isAsync ? "True" : "False"}`, "\tcommand interfaces");
      const dt = verbose ? " [double]" : "";
      const cmds = [];
      if (s.mockSensorCommands) for (const j of s.sensors || []) for (const c of j.state) cmds.push(`${j.name}/${c.name}`);
      if (s.mockGpioCommands) for (const j of s.gpios || []) for (const c of j.state) cmds.push(`${j.name}/${c.name}`);
      for (const j of [...s.joints, ...(s.gpios || [])]) for (const c of j.command) if (!cmds.includes(`${j.name}/${c.name}`)) cmds.push(`${j.name}/${c.name}`);
      for (const k of cmds) { const it = this.iface.get(k); out.push(`\t\t${k}${dt} [available] [${it && it.claimedBy ? "claimed" : "unclaimed"}]`); }
      if (verbose) { out.push("\tstate interfaces"); for (const j of [...s.joints, ...(s.sensors || []), ...(s.gpios || [])]) for (const c of j.state) out.push(`\t\t${j.name}/${c.name} [double] [available]`); }
    });
    return out;
  }
  listControllerTypes() { return TYPE_LIST.map((t) => `${t.padEnd(62)} controller_interface::ControllerInterface`); }

  // ---------- topics, services, actions that the active controllers create ----------
  // the ROS interfaces of one controller (each controller is its own node), or of the controller_manager node (name null)
  endpointsFor(name) {
    // Jazzy's controller_manager subscribes to the relative "robot_description" topic and reports controller and
    // hardware activity on /diagnostics (diagnostic_updater)
    if (name == null) return { pubs: [["/diagnostics", "diagnostic_msgs/msg/DiagnosticArray"]], subs: [[this.resolve("robot_description"), "std_msgs/msg/String"]], srvs: this.services(), acts: [] };
    const c = this.controllers.get(name); if (!c) return { pubs: [], subs: [], srvs: [], acts: [] };
    const e = this.endpoints(name);
    return { pubs: e.pubs, subs: e.subs, srvs: e.srvs, acts: e.actions };
  }
  // a topic name as the controller_manager's process resolves it: relative names get the node namespace, then the
  // process-wide remappings of ros2_control_node (e.g. franka's joint_states:=franka/joint_states) apply to every
  // controller of that process
  resolve(rel) {
    const ns = this.ns ? "/" + this.ns.replace(/^\/|\/$/g, "") : "";
    const abs = (x) => (x.startsWith("/") ? x : `${ns}/${x}`);
    const r = (this.remaps || []).find(([f]) => abs(f) === abs(rel));
    return abs(r ? r[1] : rel);
  }
  jsbTopic(leaf = "joint_states") { return this.resolve(leaf); }
  endpoints(only) {
    const pubs = [], subs = [], actions = [], srvs = [];
    const jsb = [...this.controllers.values()].find((c) => c.kind === "jsb" && c.state !== "unconfigured" && (!only || c.name === only));
    if (jsb) pubs.push([this.jsbTopic("joint_states"), "sensor_msgs/msg/JointState"], [this.jsbTopic("dynamic_joint_states"), "control_msgs/msg/DynamicJointState"]);
    for (const c of this.controllers.values()) {
      if (only && c.name !== only) continue;
      // every controller is a lifecycle node (from load on): it publishes ~/transition_event
      pubs.push([this.topicOf(c.name, "transition_event"), "lifecycle_msgs/msg/TransitionEvent"]);
      if (c.state === "unconfigured") continue;
      if (c.kind === "diff") {
        subs.push([this.topicOf(c.name, "cmd_vel"), "geometry_msgs/msg/TwistStamped"]);
        pubs.push([this.topicOf(c.name, "odom"), "nav_msgs/msg/Odometry"]);
        if (c.params.enable_odom_tf !== false) pubs.push(["/tf", "tf2_msgs/msg/TFMessage"]);
      }
      if (c.kind === "ft") pubs.push([this.topicOf(c.name, "wrench"), "geometry_msgs/msg/WrenchStamped"]);
      // the makers' own controllers: the interfaces their sources create in on_configure (ur_controllers/src/*.cpp)
      const own = MAKER_ENDPOINTS[c.type];
      if (own) {
        for (const [k, leaf, t] of own) {
          const full = this.topicOf(c.name, leaf);
          if (k === "pub") pubs.push([full, t]); else if (k === "sub") subs.push([full, t]); else if (k === "srv") srvs.push([full, t]); else actions.push([full, t]);
        }
      }
      if (c.kind === "imu") pubs.push([this.topicOf(c.name, "imu"), "sensor_msgs/msg/Imu"]);
      if (c.kind === "mecanum" || c.kind === "ackermann") {   // Jazzy: ~/reference (TwistStamped), odometry on ~/odometry and ~/tf_odometry
        subs.push([this.topicOf(c.name, "reference"), "geometry_msgs/msg/TwistStamped"]);
        pubs.push([this.topicOf(c.name, "odometry"), "nav_msgs/msg/Odometry"], [this.topicOf(c.name, "controller_state"), c.kind === "mecanum" ? "control_msgs/msg/MecanumDriveControllerState" : "control_msgs/msg/SteeringControllerStatus"]);
        pubs.push(this.tfRemaps.has(this.topicOf(c.name, "tf_odometry")) ? ["/tf", "tf2_msgs/msg/TFMessage"] : [this.topicOf(c.name, "tf_odometry"), "tf2_msgs/msg/TFMessage"]);
      }
      if (c.kind === "jtc") {
        subs.push([this.topicOf(c.name, "joint_trajectory"), "trajectory_msgs/msg/JointTrajectory"]);
        pubs.push([this.topicOf(c.name, "controller_state"), "control_msgs/msg/JointTrajectoryControllerState"]);
        actions.push([this.topicOf(c.name, "follow_joint_trajectory"), "control_msgs/action/FollowJointTrajectory"]);
        srvs.push([this.topicOf(c.name, "query_state"), "control_msgs/srv/QueryTrajectoryState"]);
      }
      if (["fwd", "fwd_pos", "fwd_vel", "fwd_eff"].includes(c.kind)) subs.push([this.topicOf(c.name, "commands"), "std_msgs/msg/Float64MultiArray"]);
      if (c.kind === "gripper") actions.push([this.topicOf(c.name, "gripper_cmd"), gripperAction(c.type)]);
    }
    return { pubs, subs, actions, srvs };
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
      if ((c.kind === "mecanum" || c.kind === "ackermann") && topic === this.topicOf(c.name, "reference")) {
        if (!/TwistStamped$/.test(type)) return { used: false, note: `${c.name} subscribes to ${topic} with geometry_msgs/msg/TwistStamped (ROS 2 Jazzy). Publish a TwistStamped.` };
        if (c.state !== "active") return { used: false, note: `${c.name} is ${c.state}, not active, so it ignores commands.` };
        const tw = msg.twist || msg;
        this.lastCmd = { vx: num(tw.linear && tw.linear.x, 0), vy: c.kind === "mecanum" ? num(tw.linear && tw.linear.y, 0) : 0, wz: num(tw.angular && tw.angular.z, 0) }; this.lastCmdAt = now;
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
      if (c.kind === "mecanum") {   // mecanum_drive_controller inverse kinematics (45° rollers)
        const P = c.params, K = P.kinematics || {}, r = num(K.wheels_radius, 0.04), lxy = num(K.sum_of_robot_center_projection_on_X_Y_axis, 0.3);
        const fresh = this.lastCmd && now - this.lastCmdAt <= num(P.reference_timeout, 0.5);
        const vx = fresh ? this.lastCmd.vx : 0, vy = fresh ? this.lastCmd.vy || 0 : 0, wz = fresh ? this.lastCmd.wz : 0;
        const w = { front_left: (vx - vy - lxy * wz) / r, front_right: (vx + vy + lxy * wz) / r, rear_left: (vx + vy - lxy * wz) / r, rear_right: (vx - vy + lxy * wz) / r };
        for (const k of MEC_WHEELS) { const j = P[`${k}_wheel_command_joint_name`]; out.velocity[j] = w[k]; const it = this.iface.get(`${j}/velocity`); if (it) it.value = w[k]; }
        const th = this.odom.th; this.odom.th += wz * dt; this.odom.x += (vx * Math.cos(th) - vy * Math.sin(th)) * dt; this.odom.y += (vx * Math.sin(th) + vy * Math.cos(th)) * dt; this.odom.v = vx; this.odom.w = wz;
        out.base = { vx, vy, wz, controller: c.name, base: P.base_frame_id || "base_link", odomFrame: P.odom_frame_id || "odom", tf: this.tfRemaps.has(this.topicOf(c.name, "tf_odometry")) };
      }
      if (c.kind === "ackermann") {   // steering_controllers_library, Ackermann: bicycle model at the axle centre
        const P = c.params, { tr, st } = ackJoints(P), L = num(P.wheelbase, 0.3), r = num(P.traction_wheels_radius, num(P.rear_wheels_radius, 0.05));
        const trk = num(P.steering_track_width, num(P.front_wheel_track, 0.2)), ttr = num(P.traction_track_width, num(P.rear_wheel_track, 0.2));
        const fresh = this.lastCmd && now - this.lastCmdAt <= num(P.reference_timeout, 0.5);
        const vx = fresh ? this.lastCmd.vx : 0, wz = fresh && Math.abs(vx) > 1e-6 ? this.lastCmd.wz : 0;
        const R = Math.abs(wz) > 1e-9 ? vx / wz : Infinity;   // turning radius (signed)
        const steer = (y) => (Number.isFinite(R) ? Math.atan(L / (R - y)) : 0), speed = (y) => (Number.isFinite(R) ? wz * (R - y) : vx) / r;
        // two joints: right first, then left (Jazzy); one joint: the centre
        const ys = (n, track) => (n === 2 ? [-track / 2, track / 2] : [0]);
        tr.forEach((j, i) => { const v = speed(ys(tr.length, ttr)[i] || 0); out.velocity[j] = v; const it = this.iface.get(`${j}/velocity`); if (it) it.value = v; });
        st.forEach((j, i) => { const a = steer(ys(st.length, trk)[i] || 0); out.position[j] = a; const it = this.iface.get(`${j}/position`); if (it) it.value = a; });
        this.odom.th += wz * dt; this.odom.x += vx * Math.cos(this.odom.th) * dt; this.odom.y += vx * Math.sin(this.odom.th) * dt; this.odom.v = vx; this.odom.w = wz;
        out.base = { vx, wz, controller: c.name, base: P.base_frame_id || "base_link", odomFrame: P.odom_frame_id || "odom", tf: this.tfRemaps.has(this.topicOf(c.name, "tf_odometry")) };
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
      if (c.kind === "gripper" && this.grip && this.grip.has(c.name)) {
        const g = this.grip.get(c.name), f = Math.min(1, Math.max(0, (now - g.t0) / g.dur)), q = g.q0 + (g.q1 - g.q0) * f * f * (3 - 2 * f);
        out.position[g.joint] = q; const it = this.iface.get(`${g.joint}/position`); if (it) it.value = q;
        if (f >= 1) { this.grip.delete(c.name); this.gripDone = { controller: c.name, at: now }; }
      }
      if (["fwd_pos", "fwd"].includes(c.kind) && (c.kind === "fwd_pos" || c.params.interface_name === "position")) for (const k of c.claimed) { const it = this.iface.get(k); if (it) out.position[it.joint] = it.value; }
      if (["fwd_vel"].includes(c.kind) || (c.kind === "fwd" && c.params.interface_name === "velocity")) for (const k of c.claimed) { const it = this.iface.get(k); if (it) out.velocity[it.joint] = it.value; }
    }
    return out;
  }
  // the simulator reports where the joints really are (feeds state interfaces, /joint_states, odometry)
  setState(joints) { for (const [j, s] of Object.entries(joints)) { const p = this.iface.get(`${j}/position:state`), v = this.iface.get(`${j}/velocity:state`); if (p && s.position != null) p.value = s.position; if (v && s.velocity != null) v.value = s.velocity; } }
  // joint_state_broadcaster: one entry per joint with state interfaces; a joint without a position, velocity or
  // effort state interface gets NaN there (kUninitializedValue), as JSB fills its arrays
  jointStates() {
    const jsb = [...this.controllers.values()].find((c) => c.kind === "jsb" && c.state !== "unconfigured");
    const only = jsb && arr(jsb.params.joints).length && arr(jsb.params.interfaces).length ? arr(jsb.params.joints) : null;   // JSB publishes just these when both are set
    const names = only || [...new Set([...this.iface.values()].filter((v) => v.kind === "state" && ["position", "velocity", "effort"].includes(v.name)).map((v) => v.joint))];
    const val = (j, k) => { const v = this.iface.get(`${j}/${k}:state`); return v ? v.value : NaN; };
    return { name: names, position: names.map((j) => val(j, "position")), velocity: names.map((j) => val(j, "velocity")), effort: names.map((j) => { const v = this.iface.get(`${j}/effort:state`); return v ? (Number.isFinite(v.value) ? v.value : 0) : NaN; }) };
  }
  // the interfaces JSB puts on /dynamic_joint_states: every state interface of every joint, in declaration order
  dynamicJointStates() {
    const names = [...new Set([...this.iface.values()].filter((v) => v.kind === "state").map((v) => v.joint))];
    return { joint_names: names, interface_values: names.map((j) => { const its = [...this.iface.values()].filter((v) => v.kind === "state" && v.joint === j); return { interface_names: its.map((v) => v.name), values: its.map((v) => (Number.isFinite(v.value) ? v.value : 0)) }; }) };
  }
  // JTC ~/controller_state: reference (the trajectory set point), feedback (state interfaces), error, output (command)
  jtcState(name) {
    const c = this.controllers.get(name); if (!c || c.kind !== "jtc") return null;
    const joints = arr(c.params.joints), si = arr(c.params.state_interfaces);
    const fb = joints.map((j) => this.jointPos(j)), vel = joints.map((j) => { const v = this.iface.get(`${j}/velocity:state`); return v ? v.value : 0; });
    const cmd = joints.map((j) => { const it = this.iface.get(`${j}/position`); return it && it.claimedBy === name ? it.value : fb[joints.indexOf(j)]; });
    const ref = this.traj.has(name) ? cmd : fb;
    const pt = (pos, v) => ({ positions: pos, velocities: si.includes("velocity") ? v : [], accelerations: si.includes("acceleration") ? pos.map(() => 0) : [], effort: [], time_from_start: { sec: 0, nanosec: 0 } });
    return { joint_names: joints, reference: pt(ref, ref.map(() => 0)), feedback: pt(fb, vel), error: pt(ref.map((x, i) => x - fb[i]), vel.map((x) => -x)), output: { positions: arr(c.params.command_interfaces).includes("position") ? cmd : [], velocities: [], accelerations: [], effort: [], time_from_start: { sec: 0, nanosec: 0 } }, speed_scaling_factor: 1.0 };
  }
  // a GripperCommand / ParallelGripperCommand goal: the gripper joint moves to the position
  gripperGoal(name, position, now) {
    const c = this.controllers.get(name); if (!c || c.kind !== "gripper") return { ok: false, why: `${name} is not a gripper controller` };
    if (c.state !== "active") return { ok: false, why: `${name} is ${c.state}, not active` };
    const j = arr(c.params.joint || c.params.joints)[0]; if (!j) return { ok: false, why: "no joint" };
    const it = this.iface.get(`${j}/position`); const q0 = this.jointPos(j), q1 = clampIf(Number(position) || 0, it || {});
    const v = Math.abs(num(c.params.max_velocity, 0)) || 0.5;   // parallel_gripper_action_controller: max_velocity; else ~0.5 rad/s
    this.grip = this.grip || new Map();
    this.grip.set(name, { joint: j, q0, q1, t0: now, dur: Math.max(0.2, Math.abs(q1 - q0) / v) });
    return { ok: true, joint: j, target: q1, dur: Math.max(0.2, Math.abs(q1 - q0) / v) };
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
