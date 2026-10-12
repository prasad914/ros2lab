// Command lines of the Gazebo programs a ROS 2 Jazzy launch starts, read exactly like the real programs read them:
//   gz sim [options] [file]                          (gz-sim 8 cmdsim.rb: -r -s -g -v [N] -z ... --force-version)
//   ros2 run ros_gz_sim create -world -file -param -string -topic -name -allow_renaming -x -y -z -R -P -Y   (gflags)
//   ros2 run ros_gz_bridge parameter_bridge <topic@ROS_type(@|[|])gz_type> ... | -p config_file:=bridge.yaml
// Pure functions: the coordinator's process adapter calls them with the launch runtime's onProcess(info).cmd.

// the launch runtime gives gz as one shell string ("ruby /usr/bin/gz sim -r -s -v2 world.sdf --force-version 8")
const words = (cmd) => (Array.isArray(cmd) ? (cmd.length === 1 ? splitShell(cmd[0]) : cmd.map(String)) : splitShell(String(cmd || "")));
export function splitShell(s) {
  const out = []; let cur = "", q = null, any = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; else if (c === "\\" && q === '"' && i + 1 < s.length) cur += s[++i]; else cur += c; continue; }
    if (c === "'" || c === '"') { q = c; any = true; continue; }
    if (c === "\\" && i + 1 < s.length) { cur += s[++i]; any = true; continue; }
    if (/\s/.test(c)) { if (cur || any) out.push(cur); cur = ""; any = false; continue; }
    cur += c;
  }
  if (cur || any) out.push(cur);
  return out;
}

const SIM_FLAGS = new Set(["-g", "-r", "-s", "--levels", "--record", "--record-resources", "--log-overwrite", "--log-compress", "--headless-rendering", "--version", "-h", "--help"]);
const SIM_ARGS = new Set(["--initial-sim-time", "--iterations", "--network-role", "--network-secondaries", "--record-path", "--record-topic", "--record-period", "--seed", "--playback", "--gui-config", "--physics-engine",
  "--render-engine", "--render-engine-api-backend", "--render-engine-gui", "--render-engine-gui-api-backend", "--render-engine-server", "--render-engine-server-api-backend", "-z", "--force-version", "--config"]);

/** gz sim argv -> { file, run, server, gui, verbose, iterations, initialSimTime, physicsEngine, renderEngine, renderEngineGui,
 *  renderEngineServer, updateRate, seed, forceVersion, record, playback, guiConfig, headless, levels, help, version, error } */
export function parseGzSimArgs(cmd) {
  // ros_gz_sim's gz_sim.launch.py runs gz with shell=True: the pieces are joined and split by the shell
  let a = Array.isArray(cmd) && cmd.some((x) => /\s/.test(String(x))) ? splitShell(cmd.join(" ")) : words(cmd);
  // strip "ruby /usr/bin/gz sim" / "gz sim"
  const si = a.findIndex((x, i) => x === "sim" && i > 0 && /(^|\/)gz$/.test(a[i - 1]));
  if (si >= 0) a = a.slice(si + 1); else if (a[0] === "sim") a = a.slice(1);
  const o = { file: null, run: false, server: false, gui: false, verbose: 1, iterations: 0, initialSimTime: 0, physicsEngine: "gz-physics-dartsim-plugin", renderEngine: "ogre2", renderEngineGui: null, renderEngineServer: null,
    updateRate: null, seed: null, forceVersion: null, record: false, recordTopics: [], playback: null, guiConfig: null, headless: false, levels: false, help: false, version: false, error: null, unknown: [] };
  for (let i = 0; i < a.length; i++) {
    let x = a[i], v = null;
    const eq = x.match(/^(--[\w-]+)=(.*)$/); if (eq) { x = eq[1]; v = eq[2]; }
    if (x === "-r") o.run = true;
    else if (x === "-s") o.server = true;
    else if (x === "-g") o.gui = true;
    else if (/^-v\d$/.test(x)) o.verbose = Number(x.slice(2));
    else if (x === "-v" || x === "--verbose") { const n = v ?? a[i + 1]; if (n !== undefined && /^\d+$/.test(n)) { o.verbose = Number(n); if (v === null) i++; } else o.verbose = 3; }
    else if (SIM_FLAGS.has(x)) { if (x === "--levels") o.levels = true; else if (x === "--headless-rendering") o.headless = true; else if (x.startsWith("--record")) o.record = true; else if (x === "--version") o.version = true; else if (x === "-h" || x === "--help") o.help = true; }
    else if (SIM_ARGS.has(x)) {
      const n = v ?? a[++i];
      if (n === undefined) { o.error = `missing argument: ${x}`; break; }
      if (x === "--iterations") o.iterations = Number(n) || 0;
      else if (x === "--initial-sim-time") o.initialSimTime = Number(n) || 0;
      else if (x === "--physics-engine") o.physicsEngine = n;
      else if (x === "--render-engine") o.renderEngine = n;
      else if (x === "--render-engine-gui") o.renderEngineGui = n;
      else if (x === "--render-engine-server") o.renderEngineServer = n;
      else if (x === "-z") o.updateRate = Number(n);
      else if (x === "--seed") o.seed = Number(n);
      else if (x === "--force-version") o.forceVersion = n;
      else if (x === "--record-path") { o.record = true; o.recordPath = n; }
      else if (x === "--record-topic") { o.record = true; o.recordTopics.push(n); }
      else if (x === "--playback") o.playback = n;
      else if (x === "--gui-config") o.guiConfig = n;
    }
    else if (x.startsWith("-") && x !== "-") { o.error = `invalid option: ${x}`; o.unknown.push(x); break; }
    else if (!o.file) o.file = x;
  }
  if (o.server) o.gui = false;
  o.startsServer = !o.gui || o.server;          // -g alone: only the GUI (it waits for a server)
  o.startsGui = !o.server;
  if (o.gui && !o.server) o.startsServer = false;
  if (o.forceVersion && !/^8(\.|$)/.test(o.forceVersion)) o.error = o.error || `Version error: couldn't find version [${o.forceVersion}] for tool [sim].`;
  return o;
}

/** ros_gz_sim create argv -> { world, file, param, string, topic, name, allowRenaming, pose: {x,y,z,R,P,Y}, source, error, usage }.
 *  gflags rules: -flag value or -flag=value (also --flag); -allow_renaming takes true/false or nothing. ROS args removed. */
export const CREATE_USAGE = `Usage: create -world [arg] [-file FILE] [-param PARAM] [-topic TOPIC]
                       [-string STRING] [-name NAME] [-allow_renaming RENAMING] [-x X] [-y Y] [-z Z]
                       [-R ROLL] [-P PITCH] [-Y YAW]`;
export function parseCreateArgs(cmd) {
  let a = words(cmd);
  if (a.length && /(^|\/)create$/.test(a[0])) a = a.slice(1);
  const ra = a.indexOf("--ros-args"); const rosArgs = ra >= 0 ? a.slice(ra) : []; if (ra >= 0) a = a.slice(0, ra);
  const o = { world: "", file: "", param: "", string: "", topic: "", name: "", allowRenaming: false, pose: { x: 0, y: 0, z: 0, R: 0, P: 0, Y: 0 }, source: null, error: null, rosArgs, unknown: [] };
  const STR = ["world", "file", "param", "string", "topic", "name"], NUM = ["x", "y", "z", "R", "P", "Y"];
  for (let i = 0; i < a.length; i++) {
    const m = a[i].match(/^--?([A-Za-z_]+)(?:=([\s\S]*))?$/);
    if (!m) continue;   // gflags leaves positional arguments alone
    const k = m[1];
    let v = m[2];
    if (k === "allow_renaming") { if (v === undefined && /^(true|false|1|0)$/i.test(a[i + 1] || "")) v = a[++i]; o.allowRenaming = v === undefined ? true : /^(true|1)$/i.test(v); continue; }
    if (!STR.includes(k) && !NUM.includes(k)) { o.unknown.push(a[i]); o.error = `ERROR: unknown command line flag '${k}'`; continue; }
    if (v === undefined) { if (i + 1 >= a.length) { o.error = `ERROR: flag '${k}' is missing its argument; flag description: ${k}`; break; } v = a[++i]; }
    if (NUM.includes(k)) { const n = Number(v); if (!Number.isFinite(n) || String(v).trim() === "") { o.error = `ERROR: illegal value '${v}' specified for double flag '${k}'`; break; } o.pose[k] = n; }
    else o[k] = v;
  }
  // ROS 2 parameters (-p file:=..., or --params-file) take precedence in create.cpp
  for (let i = 0; i < rosArgs.length; i++) if (rosArgs[i] === "-p" && rosArgs[i + 1]) { const [k, v] = rosArgs[++i].split(":="); if (STR.includes(k)) o[k] = v; else if (NUM.includes(k)) o.pose[k] = Number(v) || o.pose[k]; else if (k === "allow_renaming") o.allowRenaming = /^(true|1)$/i.test(v); }
  o.source = o.file ? "file" : o.param ? "param" : o.string ? "string" : o.topic ? "topic" : null;
  if (!o.error && !o.source) o.error = a.length ? "Must specify either -file, -param, -string or -topic" : "Must specify either file, string or topic as ROS 2 parameters";
  return o;
}

// ---------------- ros_gz_bridge ----------------
// ros_gz_bridge's type mappings (ros_gz_bridge/mappings.py, jazzy): ROS type -> Gazebo type(s)
const MAP = {
  builtin_interfaces: [["Time", "Time"]], actuator_msgs: [["Actuators", "Actuators"]],
  geometry_msgs: [["Point", "Vector3d"], ["Pose", "Pose"], ["PoseArray", "Pose_V"], ["PoseStamped", "Pose"], ["PoseWithCovariance", "PoseWithCovariance"], ["PoseWithCovarianceStamped", "PoseWithCovariance"], ["Quaternion", "Quaternion"], ["Transform", "Pose"], ["TransformStamped", "Pose"],
    ["Twist", "Twist"], ["TwistStamped", "Twist"], ["TwistWithCovariance", "TwistWithCovariance"], ["TwistWithCovarianceStamped", "TwistWithCovariance"], ["Wrench", "Wrench"], ["WrenchStamped", "Wrench"], ["Vector3", "Vector3d"]],
  gps_msgs: [["GPSFix", "NavSat"]], marine_acoustic_msgs: [["Dvl", "DVLVelocityTracking"]], nav_msgs: [["Odometry", "Odometry"], ["Odometry", "OdometryWithCovariance"]], rcl_interfaces: [["ParameterValue", "Any"]],
  ros_gz_interfaces: [["AirSpeed", "AirSpeed"], ["Altimeter", "Altimeter"], ["Contact", "Contact"], ["Contacts", "Contacts"], ["Dataframe", "Dataframe"], ["Entity", "Entity"], ["EntityFactory", "EntityFactory"], ["EntityWrench", "EntityWrench"], ["Float32Array", "Float_V"], ["GuiCamera", "GUICamera"], ["JointWrench", "JointWrench"], ["Light", "Light"], ["LogicalCameraImage", "LogicalCameraImage"], ["LogPlaybackStatistics", "LogPlaybackStatistics"], ["MaterialColor", "MaterialColor"], ["ParamVec", "Param"], ["ParamVec", "Param_V"], ["SensorNoise", "SensorNoise"], ["StringVec", "StringMsg_V"], ["TrackVisual", "TrackVisual"], ["VideoRecord", "VideoRecord"], ["WorldStatistics", "WorldStatistics"]],
  rosgraph_msgs: [["Clock", "Clock"]],
  sensor_msgs: [["BatteryState", "BatteryState"], ["CameraInfo", "CameraInfo"], ["FluidPressure", "FluidPressure"], ["Image", "Image"], ["Imu", "IMU"], ["JointState", "Model"], ["Joy", "Joy"], ["LaserScan", "LaserScan"], ["MagneticField", "Magnetometer"], ["NavSatFix", "NavSat"], ["PointCloud2", "PointCloudPacked"], ["Range", "LaserScan"]],
  std_msgs: [["Bool", "Boolean"], ["ColorRGBA", "Color"], ["Empty", "Empty"], ["Float32", "Float"], ["Float64", "Double"], ["Header", "Header"], ["Int32", "Int32"], ["UInt32", "UInt32"], ["String", "StringMsg"]],
  tf2_msgs: [["TFMessage", "Pose_V"]], trajectory_msgs: [["JointTrajectory", "JointTrajectory"]],
  vision_msgs: [["Detection2DArray", "AnnotatedAxisAligned2DBox_V"], ["Detection2D", "AnnotatedAxisAligned2DBox"], ["Detection3DArray", "AnnotatedOriented3DBox_V"], ["Detection3D", "AnnotatedOriented3DBox"]],
};
export const BRIDGE_PAIRS = Object.entries(MAP).flatMap(([pkg, l]) => l.map(([r, g]) => [`${pkg}/msg/${r}`, `gz.msgs.${g}`]));
const normRos = (t) => String(t || "").replace(/^([\w]+)\/(?!msg\/|srv\/)([\w]+)$/, "$1/msg/$2");
const normGz = (t) => String(t || "").replace(/^ignition\.msgs\./, "gz.msgs.").replace(/^ign\.msgs\./, "gz.msgs.");
/** Can ros_gz_bridge convert between these two types? (it accepts std_msgs/String as std_msgs/msg/String and ignition.msgs.X) */
export const bridgeTypesOk = (rosType, gzType) => BRIDGE_PAIRS.some(([r, g]) => r === normRos(rosType) && g === normGz(gzType));

const DIRS = { "@": "BIDIRECTIONAL", "[": "GZ_TO_ROS", "]": "ROS_TO_GZ" };
/** parameter_bridge arguments (topics given on the command line), parsed like parameter_bridge.cpp.
 *  Returns { entries: [{ ros, gz, rosType, gzType, dir, lazy }], services: [...], usage: bool (parameter_bridge printed its
 *  usage and exited with -1), params: { config_file, lazy, expand_gz_topic_names, ... } (from --ros-args -p) } */
export function parseBridgeArgs(cmd) {
  let a = words(cmd);
  if (a.length && /(^|\/)(parameter_bridge|static_bridge)$/.test(a[0])) a = a.slice(1);
  const params = {}, remaps = [];
  const ra = a.indexOf("--ros-args");
  const ros = ra >= 0 ? a.slice(ra) : [];
  for (let i = 0; i < ros.length; i++) {
    if (ros[i] === "-p" || ros[i] === "--param") { const [k, ...v] = String(ros[++i] || "").split(":="); params[k] = v.join(":="); }
    else if (ros[i] === "-r" || ros[i] === "--remap") remaps.push(String(ros[++i] || "").split(":="));
    else if (ros[i] === "--params-file") params.__params_file = ros[++i];
  }
  const args = (ra >= 0 ? a.slice(0, ra) : a).filter((x) => x !== "--");
  const entries = [], services = [];
  let usage = args.length === 0 && ra < 0;   // argc < 2
  const lazy = /^(true|1)$/i.test(params.lazy || "");
  for (const arg0 of args) {
    let arg = arg0, p = arg.indexOf("@");
    if (p <= 0) { usage = true; break; }
    const topic = arg.slice(0, p); arg = arg.slice(p + 1);
    let dir = "BIDIRECTIONAL"; p = arg.indexOf("@");
    if (p <= 0) { p = arg.indexOf("["); if (p <= 0) { p = arg.indexOf("]"); if (p === 0) { usage = true; break; } dir = p < 0 ? "NONE" : "ROS_TO_GZ"; } else dir = "GZ_TO_ROS"; }
    const rosType = p < 0 ? arg : arg.slice(0, p); arg = p < 0 ? "" : arg.slice(p + 1);
    if (rosType.includes("/srv/")) {
      if (dir === "ROS_TO_GZ" || dir === "GZ_TO_ROS") { usage = true; break; }
      let req = "", rep = "";
      if (dir === "BIDIRECTIONAL") { const q = arg.indexOf("@"); if (q <= 0) { usage = true; break; } req = arg.slice(0, q); rep = arg.slice(q + 1); }
      services.push({ service: topic, rosType, gzReq: req, gzRep: rep }); continue;
    }
    if (arg.includes("@") || !arg) { usage = true; break; }
    entries.push({ ros: topic, gz: topic, rosType, gzType: arg, dir, lazy });
  }
  return { entries: usage ? [] : entries, services: usage ? [] : services, usage, params, remaps };
}

// a small YAML reader for bridge config files (a top-level sequence of flat maps, block or flow style)
function yamlScalar(s) {
  s = String(s).trim();
  if (/^(['"])[\s\S]*\1$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  if (/^(true|True|TRUE|yes|on)$/.test(s)) return true;
  if (/^(false|False|FALSE|no|off)$/.test(s)) return false;
  if (/^[-+]?\d+$/.test(s)) return Number(s);
  if (/^[-+]?(\d*\.\d+|\d+\.\d*)([eE][-+]?\d+)?$/.test(s)) return Number(s);
  if (/^(~|null|Null|NULL)$/.test(s)) return null;
  return s;
}
const stripComment = (l) => { let q = null; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === q) q = null; } else if (c === "'" || c === '"') q = c; else if (c === "#" && (i === 0 || /\s/.test(l[i - 1]))) return l.slice(0, i); } return l; };
function flowMap(s) { const o = {}; for (const part of s.replace(/^\{|\}$/g, "").split(",")) { const m = part.match(/^\s*([\w]+)\s*:\s*(.*)$/); if (m) o[m[1]] = yamlScalar(m[2]); } return o; }

/** A ros_gz_bridge config file (bridge_config.cpp readFromYaml), exactly: top level must be a sequence; each entry a map
 *  with ros_topic_name / gz_topic_name / topic_name, ros_type_name, gz_type_name, direction, lazy, subscriber_queue,
 *  publisher_queue, qos_profile, frame_id; service entries (service_name, gz_req_type_name, gz_rep_type_name).
 *  Returns { entries: [{ ros, gz, rosType, gzType, dir, lazy, subscriberQueue, publisherQueue, qos, frameId }],
 *  services, errors: [ROS log lines the bridge prints, e.g. "[ERROR] [BridgeConfig]: Could not parse entry: ..."] }. */
export function parseBridgeConfigYaml(text, { file = null } = {}) {
  const errors = [], entries = [], services = [];
  const src = String(text ?? "");
  if (file !== null && !src.length) return { entries, services, errors: [`[ERROR] [readFromYamlFile]: Could not parse config: file empty [${file}]`] };
  const lines = src.split(/\r?\n/).map(stripComment);
  const items = []; let cur = null, seqIndent = -1, topScalar = false;
  const flowSeq = src.trim().match(/^\[([\s\S]*)\]$/);
  if (flowSeq) for (const m of flowSeq[1].matchAll(/\{[^}]*\}/g)) items.push(flowMap(m[0]));
  else for (const raw of lines) {
    if (!raw.trim() || /^\s*(---|\.\.\.)\s*$/.test(raw)) continue;
    const ind = raw.match(/^\s*/)[0].length;
    const it = raw.match(/^(\s*)-\s*(.*)$/);
    if (it && (seqIndent < 0 || ind === seqIndent)) {
      seqIndent = ind; cur = {}; items.push(cur);
      const rest = it[2].trim();
      if (!rest) continue;
      if (rest.startsWith("{")) { Object.assign(cur, flowMap(rest)); continue; }
      const kv = rest.match(/^([\w]+)\s*:\s*(.*)$/); if (kv) cur[kv[1]] = yamlScalar(kv[2]); else items[items.length - 1] = { __scalar: yamlScalar(rest) };
      continue;
    }
    const kv = raw.match(/^\s*([\w]+)\s*:\s*(.*)$/);
    if (kv && cur && ind > seqIndent) { cur[kv[1]] = yamlScalar(kv[2]); continue; }
    if (seqIndent < 0) topScalar = true;
  }
  if (topScalar || (!items.length && src.trim())) { errors.push("[ERROR] [readFromYaml]: Could not parse config: top level must be a YAML sequence"); return { entries, services, errors }; }
  const E = (msg) => errors.push(`[ERROR] [BridgeConfig]: Could not parse entry: ${msg}`);
  const QOS = ["CLOCK", "SENSOR_DATA", "PARAMETERS", "SERVICES", "PARAMETER_EVENTS", "ROSOUT", "SYSTEM_DEFAULT", "BEST_AVAILABLE"];
  for (const y of items) {
    if (!y || typeof y !== "object" || "__scalar" in y) { E("entry must be a YAML map"); continue; }
    const g = (k) => (y[k] === undefined || y[k] === null ? "" : String(y[k]));
    const topic = g("topic_name"), rt = g("ros_topic_name"), gt = g("gz_topic_name"), svc = g("service_name");
    if (topic && rt) { E("topic_name and ros_topic_name are mutually exclusive"); continue; }
    if (topic && gt) { E("topic_name and gz_topic_name are mutually exclusive"); continue; }
    if (!svc && (!g("ros_type_name") || !g("gz_type_name"))) { E("both ros_type_name and gz_type_name must be set"); continue; }
    if (svc && (!g("gz_req_type_name") || !g("gz_rep_type_name"))) { E("both gz_req_type_name and gz_rep_type_name must be set"); continue; }
    let dir = "BIDIRECTIONAL";
    if (y.direction !== undefined) { dir = g("direction"); if (!["BIDIRECTIONAL", "GZ_TO_ROS", "ROS_TO_GZ"].includes(dir)) { E(`invalid direction [${dir}]`); continue; } }
    if (svc) { services.push({ service: svc, rosType: g("ros_type_name"), gzReq: g("gz_req_type_name"), gzRep: g("gz_rep_type_name") }); continue; }
    const ros = topic || rt || gt, gz = topic || gt || rt;
    const e = { ros, gz, rosType: g("ros_type_name"), gzType: g("gz_type_name"), dir, lazy: y.lazy === true || y.lazy === "true", subscriberQueue: 10, publisherQueue: 10, qos: null, frameId: y.frame_id !== undefined ? g("frame_id") : null };
    if (y.qos_profile !== undefined && g("qos_profile")) { if (!QOS.includes(g("qos_profile"))) { E(`Invalid QoS profile '${g("qos_profile")}'`); continue; } e.qos = g("qos_profile"); }
    if (y.publisher_queue !== undefined && Number(y.publisher_queue) >= 0) e.publisherQueue = Number(y.publisher_queue);
    if (y.subscriber_queue !== undefined && Number(y.subscriber_queue) >= 0) e.subscriberQueue = Number(y.subscriber_queue);
    entries.push(e);
  }
  return { entries, services, errors };
}

/** The lines RosGzBridge::add_bridge prints for each entry (node name ros_gz_bridge), and which entries work. */
export function bridgeCreateLines(entries, { node = "ros_gz_bridge" } = {}) {
  const lines = [], ok = [];
  for (const e of entries) {
    if (!bridgeTypesOk(e.rosType, e.gzType)) { lines.push({ level: "WARN", node, text: `Failed to create a bridge for topic [${e.ros}] with ROS2 type [${e.rosType}] to topic [${e.gz}] with Gazebo Transport type [${e.gzType}]: No template specialization for the pair` }); continue; }
    if (e.dir !== "ROS_TO_GZ") lines.push({ level: "INFO", node, text: `Creating GZ->ROS Bridge: [${e.gz} (${e.gzType}) -> ${e.ros} (${e.rosType})] (Lazy ${e.lazy ? 1 : 0})` });
    if (e.dir !== "GZ_TO_ROS") lines.push({ level: "INFO", node, text: `Creating ROS->GZ Bridge: [${e.ros} (${e.rosType}) -> ${e.gz} (${e.gzType})] (Lazy ${e.lazy ? 1 : 0})` });
    ok.push(e);
  }
  return { lines, ok };
}

// gz-transport topic names: a relative name is made absolute ("tf" == "/tf")
export const gzTopic = (t) => (t ? "/" + String(t).replace(/^\/+/, "") : t);
