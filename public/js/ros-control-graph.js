// ros2_control inside the practice Gazebo: the gz_ros2_control plugin starts a controller_manager when a robot with
// <ros2_control> + the gz_ros2_control-system plugin is spawned; spawner loads/configures/activates controllers;
// `ros2 control ...` inspects them; commands on the controllers' topics move the simulated joints.
// Mixed into RosGraph.prototype (like gzMethods). The controller logic itself lives in ros2-control.js.
import { ControllerManager } from "./ros2-control.js";
import { parseURDF } from "./urdf-core.js";
import { ifacesReady, buildMessage, echoLines } from "./ros-iface.js";

const stampNow = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
const fmt = (l, tag) => (l.level === "HINT" ? null : `${tag ? `[${tag}] ` : ""}[${l.level}] [${stampNow()}] [${l.src}]: ${l.text}`);
const f6 = (x) => { if (Number.isNaN(Number(x)) && x !== undefined && x !== null) return ".nan"; const v = Number(x) || 0; return Number.isInteger(v) ? `${v}.0` : String(Math.round(v * 1e6) / 1e6); };
const qYaw = (y) => [0, 0, Math.sin(y / 2), Math.cos(y / 2)];

export const CONTROL_PKGS = ["controller_manager", "gz_ros2_control", "joint_state_broadcaster", "diff_drive_controller", "joint_trajectory_controller", "forward_command_controller", "position_controllers", "velocity_controllers", "ros2controlcli"];

export const rcMethods = {
  cmModels() { return [...(this.gzRunning() ? [...this.gz.models.values()].filter((m) => m.cm && !m.cm.dead) : []), ...(this.mockModelList ? this.mockModelList() : [])]; },
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
    // gz_ros2_control starts each joint at its <state_interface name="position"><param name="initial_value">
    for (const j of Object.keys(m.joints)) { const v = cm.jointPos(j); if (v) m.joints[j] = v; }
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
    const names = [], opt = { cm: "/controller_manager", inactive: false, file: null, rosArgs: [] };
    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]);
      if (a === "--ros-args") break;
      if (a === "-c" || a === "--controller-manager") opt.cm = args[++i];
      else if (a === "-p" || a === "--param-file") opt.file = args[++i];
      else if (a === "--inactive") opt.inactive = true;
      else if (a === "--activate-as-group") opt.group = true;
      else if (a === "--controller-ros-args") {   // one value "-r a:=b" (split or not by the launch file reader)
        const v = String(args[++i] || "");
        opt.rosArgs.push(...v.split(/\s+/).filter(Boolean));
        if (/^(-r|--remap)$/.test(v) && args[i + 1] !== undefined) opt.rosArgs.push(String(args[++i]));
      }
      else if (a === "-t" || a === "--controller-type" || a === "--controller-manager-timeout" || a === "--switch-timeout" || a === "--service-call-timeout" || a === "-n" || a === "--namespace") i++;
      else if (!a.startsWith("-")) names.push(a);
    }
    const sp = `spawner_${names[0] || "controller"}`, P = (lv, t) => `${tag ? `[${tag}] ` : ""}[${lv}] [${stampNow()}] [${sp}]: ${t}`;
    if (!names.length) return { lines: [this.err("usage: spawner [-h] [-c CONTROLLER_MANAGER] [-p PARAM_FILE] [--inactive] controller_names [controller_names ...]"), this.err("spawner: error: the following arguments are required: controller_names")], fail: true };
    const svc = `${"/" + String(opt.cm).replace(/^\/+/, "")}/list_controllers`;
    const hit = this.cmFind(opt.cm);
    if (!hit) {
      const why = !this.gzRunning() && !this.cmModels().length ? "no controller_manager is running (Gazebo with gz_ros2_control starts one; so does controller_manager's ros2_control_node)" : !this.cmModels().length ? "no spawned robot has a <ros2_control> tag with the gz_ros2_control-system plugin, so no controller_manager is running" : `the controller_manager is called ${this.cmModels().map((m) => m.cm.full).join(", ")}, not ${opt.cm}`;
      return { lines: [this.out(P("INFO", `waiting for service ${svc} to become available...`)), this.err(P("WARN", `Could not contact service ${svc}`)), this.err(P("INFO", `waiting for service ${svc} to become available...`)), this.err(P("ERROR", "Controller manager not available"))],
        fail: true, hint: `Nothing answers ${svc}: ${why}. Start the simulation first (and check that the robot spawned), then run the spawner again.` };
    }
    const cm = hit.cm;
    if (opt.file) { const t = this.shareText(opt.file); if (t === undefined) return { lines: [this.err(P("ERROR", `Parameter file '${opt.file}' does not exist`))], fail: true }; }
    for (let k = 0; k < opt.rosArgs.length; k++) {   // --controller-ros-args "-r ~/tf_odometry:=/tf": the controllers' remappings
      if (opt.rosArgs[k] !== "-r" && opt.rosArgs[k] !== "--remap") continue;
      const [from, to] = String(opt.rosArgs[++k] || "").split(":=");
      if (to === "/tf") for (const nm of names) cm.tfRemaps.add(from.startsWith("~/") ? `/${nm}/${from.slice(2)}` : "/" + from.replace(/^\/+/, ""));
    }
    const r = cm.spawn(names, { inactive: opt.inactive, group: opt.group });
    const lines = [], gzLines = [];
    for (const l of r.logs) { const t = fmt(l); if (!t) continue; if (String(l.src).startsWith("spawner_")) lines.push((l.level === "ERROR" || l.level === "FATAL" ? this.err : this.out).call(this, `${tag ? `[${tag}] ` : ""}${t}`)); else gzLines.push(t); }
    // every loaded controller is a ROS node of its own
    for (const n of names) if (cm.controllers.has(n) && !this.nodes.some((x) => x.kind === "ctrl" && x.ctrl === n && x.cm === cm)) { const c = this.add("ctrl", n, cm.ns || "", {}); const { P, T } = this.ctrlParamsOf(cm, n); Object.assign(c.params, P); c.ptypes = T; c.cm = cm; c.ctrl = n; c.model = hit.name; }
    if (r.ok) { hit.held = false; hit.cmLog = (hit.cmLog || 0) + 1; }
    if (gzLines.length && this.gz && !inline) (this.notices = this.notices || []).push(...gzLines.map((t) => ({ node: this.gz.node, text: t, cls: /\[(ERROR|WARN)\]/.test(t) ? "warn-line" : "" })));
    return { lines, gzLines: inline ? gzLines : null, cmTag: hit.cmTag || null, fail: !r.ok, hint: r.ok ? null : r.why || "The controller could not be started: read the [controller_manager] lines in the Gazebo terminal." };
  },

  // controller_manager ros2_control_node started by a launch file (not Gazebo): it reads /robot_description from
  // robot_state_publisher, loads the <ros2_control> hardware plugin and serves the controllers. mock_components runs
  // here; a real driver plugin (ros2lab_hardware/BridgeSystem) fails the way it does with no board connected.
  cmNodeStart({ n, tag, yamlText, yamlPath }, cli, fulls) {
    const sh = this.sh, lines = [], P = (lv, src, t) => lines.push((lv === "ERROR" || lv === "WARN" || lv === "FATAL" ? this.err : this.out).call(this, `[${tag}] [${lv}] [${stampNow()}] [${src}]: ${t}`));
    const name = n.name || "controller_manager", ns = n.ns || "";
    const rdTopic = `${ns ? "/" + ns.replace(/^\/|\/$/g, "") : ""}/robot_description`;   // Jazzy subscribes the relative "robot_description"
    const rsp = this.nodes.find((x) => x.kind === "rsp" && x.params.robot_description && fulls.includes(x.full)) || this.nodes.find((x) => x.kind === "rsp" && x.params.robot_description);
    // the parameter file (controllers.yaml)
    let yaml = null;
    for (const f of n.files || []) {
      const m = f.match(/^\$FINDSHARE:([\w-]+)\/(\w+)\/(.+)$/); if (!m) continue;
      const pk = sh.wsPkgs && sh.wsPkgs.get(m[1]);
      yaml = { path: `/home/student/ros2_ws/install/${m[1]}/share/${m[1]}/${m[2]}/${m[3]}`, text: pk && pk[m[2]] ? pk[m[2]][m[3]] : undefined };
    }
    if (yamlText != null) yaml = { path: yamlPath || "/tmp/launch_params", text: yamlText };   // the real launch system's --params-file
    if (yaml && yaml.text === undefined) return { lines: [this.err(`[${tag}] [ERROR] [${stampNow()}] [rcl]: Failed to parse global arguments`), this.err(`[${tag}] terminate called after throwing an instance of 'rclcpp::exceptions::RCLInvalidROSArgsError'`), this.err(`[${tag}]   what():  failed to initialize rcl: Couldn't parse params file: '--params-file ${yaml.path}'. Error: Error opening YAML file`)], died: true, hint: "The parameter file is not installed: install(DIRECTORY config ...) in CMakeLists.txt, then colcon build and source again." };
    const node = this.add("cm", name, ns, { update_rate: 100 }); node.ptypes = { update_rate: "integer" }; node.procName = tag; fulls.push(node.full);
    P("INFO", name, "Using Steady (Monotonic) clock for triggering controller manager cycles.");
    P("INFO", name, `Subscribing to '${rdTopic}' topic for robot description.`);
    if (!rsp) { P("INFO", name, "update rate is 100 Hz"); }
    if (!rsp) { P("WARN", name, "Waiting for data on 'robot_description' topic to finish initialization"); return { lines, hint: "Nothing publishes /robot_description: start robot_state_publisher with the robot's URDF (with its <ros2_control> block)." }; }
    const urdf = String(rsp.params.robot_description);
    let model; try { model = parseURDF(urdf); } catch (e) { P("ERROR", name, `The published robot description file (urdf) seems not to be genuine. The following error was caught: ${e.message}`); return { lines }; }
    const joints = Object.values(model.joints).filter((j) => !["fixed", "floating", "planar"].includes(j.type)).map((j) => j.name);
    const cm = new ControllerManager({ urdf, yaml, joints, name, ns });
    cm.remaps = n.remaps || [];   // ros2_control_node's -r rules apply to every controller in its process
    node.params.update_rate = cm.updateRate; node.cm = cm;
    P("INFO", name, `update rate is ${cm.updateRate} Hz`);
    P("INFO", name, "Received robot description from topic.");
    if (cm.yamlError) { P("ERROR", name, `Failed to parse ${yaml.path}: ${cm.yamlError}`); return { lines, died: true }; }
    if (!cm.systems.length) { P("ERROR", name, "The published robot description file (urdf) seems not to be genuine. The following error was caught:<ros2_control> tag not found in the URDF."); return { lines, hint: "This URDF has no <ros2_control> block, so there is no hardware to load. Include the robot's ros2_control xacro (and pass hardware_type to xacro)." }; }
    const crash = (sys) => {   // Jazzy: a component that cannot reach its initial state stops ros2_control_node
      lines.push(this.err(`[${tag}] terminate called after throwing an instance of 'std::runtime_error'`), this.err(`[${tag}]   what():  Failed to set the initial state of the component : ${sys.name} to active`));
      this.nodes = this.nodes.filter((x) => x !== node); const i = fulls.indexOf(node.full); if (i >= 0) fulls.splice(i, 1);
      return { lines, died: true };
    };
    for (const sys of cm.systems) {
      P("INFO", name, `Loading hardware '${sys.name}' `);
      // the makers' fake / mock hardware plugins (official workspaces) behave like mock_components/GenericSystem
      const FAKE = ["mock_components/GenericSystem", "fake_components/GenericSystem", "uf_robot_hardware/UFRobotFakeSystemHardware", "interbotix_xs_ros_control/XSHardwareInterface/fake", "dobot_ros2_control/DobotFakeHardware"];
      const known = FAKE.includes(sys.plugin) || sys.plugin === "ros2lab_hardware/BridgeSystem";
      if (!sys.plugin || !known) {
        const gz = /^gz_ros2_control\/|^ign_ros2_control\/|gazebo_ros2_control/.test(sys.plugin || "");
        P("ERROR", "resource_manager", `Caught exception of type : N9pluginlib20LibraryLoadExceptionE while loading hardware: According to the loaded plugin descriptions the class ${sys.plugin || "''"} with base class type hardware_interface::SystemInterface does not exist. Declared types are  mock_components/GenericSystem ros2lab_hardware/BridgeSystem`);
        lines.push(this.err(`[${tag}] terminate called after throwing an instance of 'std::runtime_error'`), this.err(`[${tag}]   what():  Failed to load hardware component '${sys.name}'`));
        this.nodes = this.nodes.filter((x) => x !== node); const i = fulls.indexOf(node.full); if (i >= 0) fulls.splice(i, 1);
        return { lines, died: true, hint: gz ? `${sys.plugin} runs only inside Gazebo (the gz_ros2_control-system plugin starts its own controller_manager). For ros2_control_node use hardware_type:=mock or the real driver.` : null };
      }
      P("INFO", name, `Loaded hardware '${sys.name}' from plugin '${sys.plugin}'`);
      P("INFO", name, `Initialize hardware '${sys.name}' `);
      const hwParam = (k, d) => { const m = urdf.match(new RegExp(`<ros2_control\\b[^>]*name="${sys.name}"[\\s\\S]*?<param\\s+name="${k}"\\s*>\\s*([^<]*?)\\s*<\\/param>`)); return m ? m[1] : d; };
      const real = sys.plugin === "ros2lab_hardware/BridgeSystem", lg = `ros2lab_hardware.${sys.name}`;
      if (real) P("INFO", lg, `${sys.joints.length} joints${sys.joints.some((j) => !j.command.length) ? ` (${sys.joints.filter((j) => !j.command.length).length} passive)` : ""}${/<sensor\b[\s\S]*?linear_acceleration\.z/.test(urdf) ? " + IMU" : ""}, transport ${hwParam("transport", "serial")}`);
      P("INFO", name, `Successful initialization of hardware '${sys.name}'`);
      P("INFO", name, `Activating component '${sys.name}'.`);
      P("INFO", "resource_manager", `'configure' hardware '${sys.name}' `);
      if (real) {
        const transport = hwParam("transport", "serial");
        P("ERROR", lg, transport === "udp" ? `no answer from the board on udp://${hwParam("host", "192.168.4.1")}:${hwParam("port", "8888")} (is the ROS2Lab bridge firmware flashed? right port / IP? powered?)` : `cannot open ${hwParam("device", "/dev/ros2lab_mcu")}: No such file or directory (is the board plugged in? ls /dev/ttyUSB* /dev/ttyACM*)`);
        P("ERROR", "resource_manager", `Failed to 'configure' hardware '${sys.name}'`);
        const r = crash(sys);
        r.hint = `ros2lab_hardware/BridgeSystem looked for the robot's board, and none is connected to this practice computer. On the Jetson, with the board on USB (or on Wi-Fi: transport:=udp host:=<board IP>), it prints "Connected to '${hwParam("robot_id", sys.name)}' on ..." and "Motors enabled" here, and the controllers start. Test the board alone with: ros2 run ros2lab_hardware bridge_probe serial /dev/ros2lab_mcu`;
        return r;
      }
      for (const st of ["configure", "activate"]) { if (st !== "configure") P("INFO", "resource_manager", `'${st}' hardware '${sys.name}' `); P("INFO", "resource_manager", `Successful '${st}' of hardware '${sys.name}'`); }
      P("INFO", name, `Registering statistics for : ${sys.name}`);
    }
    P("INFO", name, "Resource Manager has been successfully initialized. Starting Controller Manager services...");
    const robot = model.name || "robot";
    const mj = {}; for (const j of joints) mj[j] = cm.jointPos(j);
    this.mockModels = this.mockModels || new Map();
    this.mockModels.set(robot, { name: robot, urdf, model, joints: mj, cm, mock: true, cmNode: node.full, cmTag: tag, pose: { x: 0, y: 0, yaw: 0 } });
    return { lines };
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
    for (const m of this.cmModels()) { const r = m.cm.receive(topic, type, msg, this.cmTime()); if (r.used || r.note) out.push({ model: m, ...r }); }
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
    // the wheels turn as commanded; where the base really goes is up to the physics (a wall stops it, the wheels slip,
    // and diff_drive_controller's odometry keeps counting: the odometry drift students see on real robots)
    if (o.base) { m.cmd = { vx: o.base.vx, vy: o.base.vy || 0, wz: o.base.wz }; this.gzDrive(m, o.base.vx, o.base.vy || 0, 0, o.base.wz, dt); m.cmBase = o.base; }
    m.cm.setState(Object.fromEntries(Object.keys(m.joints).map((j) => [j, { position: m.joints[j], velocity: vel[j] || 0 }])));
  },
  // TF from diff_drive_controller (odom -> base), published straight on /tf (no bridge involved)
  cmTfEdges() {
    const E = [];
    for (const m of this.cmModels()) {
      const c = [...m.cm.controllers.values()].find((x) => x.state === "active" && (x.kind === "diff" ? x.params.enable_odom_tf !== false : (x.kind === "mecanum" || x.kind === "ackermann") && m.cm.tfRemaps.has(m.cm.topicOf(x.name, "tf_odometry"))));
      if (!c) continue;
      const o = m.cm.odom;
      E.push({ parent: c.params.odom_frame_id || "odom", child: c.params.base_frame_id || "base_link", t: [o.x, o.y, 0], q: qYaw(o.th), gz: true });
    }
    return E;
  },
  cmJoints() {
    for (const m of this.cmModels()) if (m.cm.hasActive("jsb") || [...m.cm.controllers.values()].some((c) => c.kind === "jsb" && c.state !== "unconfigured")) {
      const J = { ...m.joints };
      for (const fg of this.nodes.filter((n) => n.kind === "fake_gripper")) for (const j of this.fakeGripperJoints(fg)) J[j] = 0.035;   // franka's fake gripper (merged by joint_state_publisher)
      return J;
    }
    return null;
  },
  fakeGripperJoints(n) { const v = n.params.joint_names; return Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.replace(/[[\]'"\s]/g, "").split(",").filter(Boolean) : []; },
  // ROS interfaces of programs modelled here that are not controller_manager nodes
  rcEndpoints(n, e) {
    if (n.kind === "fake_gripper") e.pubs.push([`${n.full}/joint_states`, "sensor_msgs/msg/JointState"]);
    if (n.kind === "jsp" && Array.isArray(n.params.source_list)) for (const s of n.params.source_list) e.subs.push([String(s).startsWith("/") ? String(s) : `${n.ns || ""}/${s}`, "sensor_msgs/msg/JointState"]);
  },
  cmRate(topic) {
    for (const m of this.cmModels()) for (const c of m.cm.controllers.values()) {
      if (c.state !== "active") continue;
      if (c.kind === "jsb" && (topic === m.cm.jsbTopic("joint_states") || topic === m.cm.jsbTopic("dynamic_joint_states"))) return m.cm.updateRate;
      if (c.kind === "diff" && topic === m.cm.topicOf(c.name, "odom")) return Number(c.params.publish_rate) || 50;
      if ((c.kind === "mecanum" || c.kind === "ackermann") && topic === m.cm.topicOf(c.name, "odometry")) return m.cm.updateRate;
      if (c.kind === "imu" && topic === m.cm.topicOf(c.name, "imu")) return m.cm.updateRate;
      if (c.kind === "jtc" && topic === m.cm.topicOf(c.name, "controller_state")) return Number(c.params.state_publish_rate) || m.cm.updateRate;
      if (c.kind === "ft" && topic === m.cm.topicOf(c.name, "wrench")) return m.cm.updateRate;
      if (c.type === "ur_controllers/SpeedScalingStateBroadcaster" && topic === m.cm.topicOf(c.name, "speed_scaling")) return Number(c.params.state_publish_rate) || 100;
    }
    // joint_state_publisher merging source_list topics (franka): it publishes at its "rate" parameter
    const jsp = this.nodes.find((n) => n.kind === "jsp" && Array.isArray(n.params.source_list) && n.params.source_list.length && `${n.ns || ""}/joint_states` === topic);
    if (jsp) return Number(jsp.params.rate) || 10;
    const fg = this.nodes.find((n) => n.kind === "fake_gripper" && `${n.full}/joint_states` === topic);
    if (fg) return 10;
    // robot_state_publisher sends /tf for the moving joints on every /joint_states message it gets (arms: no
    // odometry TF from a drive controller)
    if (topic === "/tf" && !this.cmModels().some((m) => [...m.cm.controllers.values()].some((c) => c.state === "active" && ["diff", "mecanum", "ackermann"].includes(c.kind)))) {
      const rsp = this.nodes.find((n) => n.kind === "rsp" && n.params.robot_description);
      if (rsp) { const rm = (rsp.remaps || []).find(([f]) => f === "joint_states" || f === `${rsp.ns || ""}/joint_states`); const js = rm ? (rm[1].startsWith("/") ? rm[1] : `${rsp.ns || ""}/${rm[1]}`) : `${rsp.ns || ""}/joint_states`; if (js !== topic) { const r = this.cmRate(js); if (r) return r; } }
    }
    return null;
  },
  cmSample(topic) {
    if (!this.cmModels().length) return null;
    const t = this.cmTime(), tn = Math.round(t * 1e9), sec = Math.floor(tn / 1e9), nsec = tn - sec * 1e9;
    const stamp = { sec, nanosec: nsec }, yaml = (type, v) => { if (!ifacesReady()) return null; try { return echoLines(type, buildMessage(type, v)).join("\n"); } catch (e) { return null; } };
    const jsLines = (J) => { const arr = (a) => a.map((x) => `- ${f6(x)}`).join("\n") || "[]"; return `header:\n  stamp:\n    sec: ${sec}\n    nanosec: ${nsec}\n  frame_id: ''\nname:\n${J.name.map((x) => `- ${x}`).join("\n")}\nposition:\n${arr(J.position)}\nvelocity:\n${arr(J.velocity)}\neffort:\n${arr(J.effort)}`; };
    // franka's fake gripper node: ~/joint_states with both fingers at 0.035 m (fake_gripper_state_publisher.py)
    const fg = this.nodes.find((n) => n.kind === "fake_gripper" && `${n.full}/joint_states` === topic);
    if (fg) { const jn = this.fakeGripperJoints(fg); return [jsLines({ name: jn, position: jn.map(() => 0.035), velocity: jn.map(() => 0), effort: jn.map(() => 0) })]; }
    // joint_state_publisher with source_list (franka): /joint_states = every movable URDF joint, values from the sources
    const jsp = this.nodes.find((n) => n.kind === "jsp" && Array.isArray(n.params.source_list) && n.params.source_list.length && `${n.ns || ""}/joint_states` === topic);
    if (jsp) {
      const J = this.cmJoints() || {}, model = this.robotModel && this.robotModel();
      const names = model ? Object.values(model.joints).filter((j) => !["fixed", "floating", "planar"].includes(j.type)).map((j) => j.name) : Object.keys(J);
      return [jsLines({ name: names, position: names.map((j) => J[j] || 0), velocity: names.map(() => 0), effort: names.map(() => 0) })];
    }
    for (const m of this.cmModels()) for (const c of m.cm.controllers.values()) {
      if (c.state !== "active") continue;
      if (c.kind === "jsb" && topic === m.cm.jsbTopic("joint_states")) return [jsLines(m.cm.jointStates())];
      if (c.kind === "jsb" && topic === m.cm.jsbTopic("dynamic_joint_states")) { const y = yaml("control_msgs/msg/DynamicJointState", { header: { stamp, frame_id: "" }, ...m.cm.dynamicJointStates() }); if (y) return [y]; }
      if (c.kind === "jtc" && topic === m.cm.topicOf(c.name, "controller_state")) { const y = yaml("control_msgs/msg/JointTrajectoryControllerState", { header: { stamp, frame_id: "" }, ...m.cm.jtcState(c.name) }); if (y) return [y]; }
      if (c.kind === "ft" && topic === m.cm.topicOf(c.name, "wrench")) { const y = yaml("geometry_msgs/msg/WrenchStamped", { header: { stamp, frame_id: c.params.frame_id || "" } }); if (y) return [y]; }   // mock / simulated sensor: no load on the tool
      if (c.type === "ur_controllers/SpeedScalingStateBroadcaster" && topic === m.cm.topicOf(c.name, "speed_scaling")) return ["data: 100.0"];   // ur_controllers publishes the speed scaling in percent
      if ((c.kind === "mecanum" || c.kind === "ackermann") && topic === m.cm.topicOf(c.name, "odometry")) {
        const o = m.cm.odom, q = qYaw(o.th), vy = m.cm.lastCmd && c.kind === "mecanum" ? m.cm.lastCmd.vy || 0 : 0;
        return [`header:\n  stamp:\n    sec: ${sec}\n    nanosec: ${nsec}\n  frame_id: ${c.params.odom_frame_id || "odom"}\nchild_frame_id: ${c.params.base_frame_id || "base_link"}\npose:\n  pose:\n    position:\n      x: ${f6(o.x)}\n      y: ${f6(o.y)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${f6(q[2])}\n      w: ${f6(q[3])}\ntwist:\n  twist:\n    linear:\n      x: ${f6(o.v)}\n      y: ${f6(o.v || o.w ? vy : 0)}\n      z: 0.0\n    angular:\n      x: 0.0\n      y: 0.0\n      z: ${f6(o.w)}`];
      }
      if (c.kind === "imu" && topic === m.cm.topicOf(c.name, "imu")) {   // mock hardware: the IMU state interfaces keep their initial values (0)
        const real = !m.mock, q = real ? qYaw(m.cm.odom.th) : [0, 0, 0, 0], g = real ? 9.81 : 0;
        return [`header:\n  stamp:\n    sec: ${sec}\n    nanosec: ${nsec}\n  frame_id: ${c.params.frame_id || "imu_link"}\norientation:\n  x: ${f6(q[0])}\n  y: ${f6(q[1])}\n  z: ${f6(q[2])}\n  w: ${f6(q[3])}\norientation_covariance:\n${Array(9).fill("- 0.0").join("\n")}\nangular_velocity:\n  x: 0.0\n  y: 0.0\n  z: 0.0\nangular_velocity_covariance:\n${Array(9).fill("- 0.0").join("\n")}\nlinear_acceleration:\n  x: 0.0\n  y: 0.0\n  z: ${f6(g)}\nlinear_acceleration_covariance:\n${Array(9).fill("- 0.0").join("\n")}`];
      }
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
