// Native SDFormat (SDF 1.4 - 1.11) loading for the practice Gazebo, following what libsdformat 14 + gz-sim 8 do with a
// world or model file:
//   - <include><uri>model://name</uri> is looked up in GZ_SIM_RESOURCE_PATH (then IGN_GAZEBO_RESOURCE_PATH, SDF_PATH),
//     reading the model directory's model.config (<sdf version="..."> with the highest version wins);
//     package:// is looked up in the ament prefixes (share/<pkg>) and in the resource paths; Fuel URLs are offline:
//     only the models every TurtleBot3 / xArm world uses (Ground Plane, Sun, Table) are bundled here;
//   - frames: <pose relative_to>, <frame attached_to>, joint poses relative to the child link, axis <xyz expressed_in>,
//     nested models and <include> inside a model (scoped names model::link), merge includes;
//   - errors and warnings carry sdformat's own texts and Error Code numbers ("Unable to find uri[model://x]" is
//     Error Code 14, "A model must have at least one link." 17, unknown elements are copied with a warning ...).
// The result plugs into the existing practice Gazebo: worlds have the shape of gz-sdf.js parseWorld() (plus meshes,
// lights, systems), models become a URDF-like kinematic tree (urdf-core.js shape) with the same `gazebo`
// description (sensors, plugins) that urdfGazebo() gives for a URDF, so gz-sim.js / gz-physics.js / ros-gz.js run them.
//
// Pure functions. resolve(path) gives a file: { text } | { bytes } | null (or a Promise of it: use the async
// gzLoadWorld / gzLoadModel then). Paths handed to resolve are absolute Ubuntu paths (/opt/ros/jazzy/share/...,
// /home/student/ros2_ws/install/...), or Fuel URLs.
import { parseXML, qRPY, qMul, qRot, tMul, tInv, quatToRPY } from "./urdf-core.js";
import { SDF_SCHEMA } from "./gz-sdf-schema.js";

export const SDF_ERROR = { FILE_READ: 1, DUPLICATE_NAME: 2, RESERVED_NAME: 3, ATTRIBUTE_MISSING: 4, ATTRIBUTE_INVALID: 5, ELEMENT_MISSING: 8, ELEMENT_INVALID: 9, ELEMENT_INCORRECT_TYPE: 11, URI_INVALID: 13, URI_LOOKUP: 14,
  MODEL_CANONICAL_LINK_INVALID: 16, MODEL_WITHOUT_LINK: 17, LINK_INERTIA_INVALID: 19, JOINT_CHILD_LINK_INVALID: 20, JOINT_PARENT_LINK_INVALID: 21, JOINT_PARENT_SAME_AS_CHILD: 22, FRAME_ATTACHED_TO_INVALID: 23,
  POSE_RELATIVE_TO_INVALID: 26, POSE_RELATIVE_TO_CYCLE: 27, JOINT_AXIS_EXPRESSED_IN_INVALID: 38 };
const fmtErr = (code, msg, { xmlPath, file, line } = {}) => {
  let p = (xmlPath || "") + (file ? ":" + file : "") + (line ? ":L" + line : "");
  return `Error Code ${code}: ${p ? `[${p}]: ` : ""}Msg: ${msg}`;
};

// ---------------- Gazebo Fuel models the robot worlds include (offline copies of what Fuel serves) ----------------
const FUEL = {
  "ground plane": `<sdf version="1.6"><model name="ground_plane"><static>true</static><link name="link"><collision name="collision"><geometry><plane><normal>0 0 1</normal><size>100 100</size></plane></geometry><surface><friction><ode><mu>100</mu><mu2>50</mu2></ode></friction></surface></collision><visual name="visual"><cast_shadows>false</cast_shadows><geometry><plane><normal>0 0 1</normal><size>100 100</size></plane></geometry><material><ambient>0.8 0.8 0.8 1</ambient><diffuse>0.8 0.8 0.8 1</diffuse><specular>0.8 0.8 0.8 1</specular></material></visual></link></model></sdf>`,
  sun: `<sdf version="1.6"><light type="directional" name="sun"><cast_shadows>true</cast_shadows><pose>0 0 10 0 0 0</pose><diffuse>0.8 0.8 0.8 1</diffuse><specular>0.2 0.2 0.2 1</specular><attenuation><range>1000</range><constant>0.9</constant><linear>0.01</linear><quadratic>0.001</quadratic></attenuation><direction>-0.5 0.1 -0.9</direction></light></sdf>`,
  table: `<sdf version="1.6"><model name="table"><static>true</static><link name="link"><collision name="surface"><pose>0 0 1.0 0 0 0</pose><geometry><box><size>1.5 0.8 0.03</size></box></geometry><surface><friction><ode><mu>0.6</mu><mu2>0.6</mu2></ode></friction></surface></collision><visual name="visual1"><pose>0 0 1.0 0 0 0</pose><geometry><box><size>1.5 0.8 0.03</size></box></geometry><material><ambient>0.55 0.4 0.25 1</ambient><diffuse>0.55 0.4 0.25 1</diffuse></material></visual>`
    + [[0.68, 0.38], [0.68, -0.38], [-0.68, -0.38], [-0.68, 0.38]].map(([x, y], i) => `<collision name="leg${i}"><pose>${x} ${y} 0.5 0 0 0</pose><geometry><cylinder><radius>0.02</radius><length>1.0</length></cylinder></geometry></collision><visual name="leg${i}"><pose>${x} ${y} 0.5 0 0 0</pose><geometry><cylinder><radius>0.02</radius><length>1.0</length></cylinder></geometry><material><ambient>0.3 0.3 0.3 1</ambient><diffuse>0.3 0.3 0.3 1</diffuse></material></visual>`).join("") + `</link></model></sdf>`,
};
const fuelName = (uri) => { const m = String(uri).trim().match(/^https?:\/\/fuel\.(?:gazebosim|ignitionrobotics)\.org\/1\.0\/[^/]+\/models\/([^/]+)(?:\/(?:\d+|tip))?\/?$/i); return m ? decodeURIComponent(m[1]).toLowerCase() : null; };

// ---------------- small math ----------------
const T0 = () => ({ t: [0, 0, 0], q: [0, 0, 0, 1] });
const nums = (s, n, d) => { const v = String(s ?? "").trim().split(/\s+/).filter(Boolean).map(Number); if (v.length < n || v.slice(0, n).some((x) => !Number.isFinite(x))) return d; return v.slice(0, n); };
const T6 = (T) => [...T.t, ...quatToRPY(T.q)];
const toOrigin = (T) => ({ xyz: T.t.map((x) => (Math.abs(x) < 1e-12 ? 0 : x)), rpy: quatToRPY(T.q).map((x) => (Math.abs(x) < 1e-12 ? 0 : x)) });
const isIdent = (T) => Math.hypot(...T.t) < 1e-9 && Math.abs(Math.abs(T.q[3]) - 1) < 1e-9;

// ---------------- XML helpers on urdf-core's parseXML nodes ----------------
const kids = (n, tag) => (n ? n.children.filter((c) => c.tag === tag) : []);
const kid = (n, tag) => kids(n, tag)[0];
const text = (n) => (n ? n.children.filter((c) => c.tag === "#text").map((c) => c.text).join("").trim() : null);
const val = (n, tag, d = null) => { const k = kid(n, tag); const t = text(k); return t === null || t === "" ? d : t; };
const num = (n, tag, d) => { const v = val(n, tag); return v === null || !Number.isFinite(Number(v)) ? d : Number(v); };
const bool = (n, tag, d) => { const v = val(n, tag); return v === null ? d : /^(true|1)$/i.test(v); };
function poseOf(n) {   // { T, rel } of an element's own <pose>
  const p = kid(n, "pose"); if (!p) return { T: T0(), rel: "" };
  const v = String(text(p) || "").trim().split(/\s+/).filter(Boolean).map(Number);
  const deg = /^(true|1)$/i.test(p.attrs.degrees || ""), k = deg ? Math.PI / 180 : 1;
  let T;
  if ((p.attrs.rotation_format || "") === "quat_xyzw" && v.length >= 7) { const l = Math.hypot(v[3], v[4], v[5], v[6]) || 1; T = { t: v.slice(0, 3), q: [v[3] / l, v[4] / l, v[5] / l, v[6] / l] }; }
  else { const x = [0, 0, 0, 0, 0, 0].map((z, i) => (Number.isFinite(v[i]) ? v[i] : 0)); T = { t: x.slice(0, 3), q: qRPY(x[3] * k, x[4] * k, x[5] * k) }; }
  return { T, rel: p.attrs.relative_to ?? p.attrs.frame ?? "" };
}

// ---------------- plugin filenames (gz-sim SystemLoader) ----------------
// "libgz-sim-diff-drive-system.so", "gz-sim8-diff-drive-system", "ignition-gazebo-diff-drive-system" -> "gz-sim-diff-drive-system"
export function normPluginFile(f) {
  let s = String(f || "").trim();
  s = s.replace(/^.*\//, "").replace(/^lib/, "").replace(/\.so(\.\d+)*$/, "");
  s = s.replace(/^ignition-gazebo\d*-/, "gz-sim-").replace(/^gz-sim\d+-/, "gz-sim-");
  return s;
}
// the systems gz-sim 8 ships (src/systems), as library names
export const GZ_SIM8_SYSTEMS = ["ackermann-steering", "acoustic-comms", "advanced-lift-drag", "air-pressure", "air-speed", "altimeter", "apply-joint-force", "apply-link-wrench", "battery-plugin", "breadcrumbs", "buoyancy", "buoyancy-engine",
  "camera-video-recorder", "collada-world-exporter", "comms-endpoint", "contact", "detachable-joint", "diff-drive", "dvl", "elevator", "entity-semantics", "environment-preload", "environmental-sensor", "follow-actor", "forcetorque",
  "hydrodynamics", "imu", "joint-controller", "joint-position-controller", "joint-state-publisher", "joint-trajectory-controller", "kinetic-energy-monitor", "label", "lens-flare", "lift-drag", "lighter-than-air-dynamics", "log",
  "log-video-recorder", "logical-audio-sensor-plugin", "logicalcamera", "magnetometer", "mecanum-drive", "model-photo-shoot", "multicopter-control", "multicopter-motor-model", "navsat", "odometry-publisher", "optical-tactile-plugin",
  "particle-emitter", "perfect-comms", "performer-detector", "physics", "pose-publisher", "python-system-loader", "rf-comms", "scene-broadcaster", "sensors", "shader-param", "spacecraft-thruster-model", "thermal", "thermal-sensor", "thruster", "touchplugin",
  "track-controller", "tracked-vehicle", "trajectory-follower", "triggered-publisher", "user-commands", "velocity-control", "wheel-slip", "wind-effects"].map((s) => `gz-sim-${s}-system`);
const KNOWN_OTHER = /^(gz_ros2_control-system|ign_ros2_control-system|gz-sim-.*)$/;

// what a model plugin does, in the shape gz-sdf.js urdfGazebo() uses (kind + parameters), from its SDF element
export function pluginFromSdf(filename, name, el) {
  const f = normPluginFile(filename), id = f + " " + (name || "");
  const all = (tag) => kids(el, tag).map((x) => text(x)).filter(Boolean);
  const s = (tag) => val(el, tag), n = (tag, d) => num(el, tag, d);
  const drive = () => ({ topic: s("topic"), odomTopic: s("odom_topic"), tfTopic: s("tf_topic"), frame: s("frame_id"), child: s("child_frame_id"), odomRate: n("odom_publisher_frequency", n("odom_publish_frequency", 50)) });
  const lim = () => ({ maxLinVel: n("max_linear_velocity", n("max_velocity", null)), maxAngVel: n("max_angular_velocity", n("max_velocity", null)), maxLinAcc: n("max_linear_acceleration", n("max_acceleration", null)), maxAngAcc: n("max_angular_acceleration", n("max_acceleration", null)), minLinVel: n("min_linear_velocity", n("min_velocity", null)), minAngVel: n("min_angular_velocity", n("min_velocity", null)) });
  const base = { file: f, filename, name: name || "" };
  if (/diff-drive-system|DiffDrive\b/.test(id)) return { ...base, kind: "diff_drive", left: all("left_joint"), right: all("right_joint"), separation: n("wheel_separation", 1.0), radius: n("wheel_radius", 0.2), ...drive(), ...lim() };
  if (/joint-state-publisher-system|JointStatePublisher/.test(id)) return { ...base, kind: "joint_states", topic: s("topic"), joints: all("joint_name"), rate: n("update_rate", 0) };
  if (/joint-position-controller-system|JointPositionController/.test(id)) return { ...base, kind: "joint_position", joint: all("joint_name")[0] || "", joints: all("joint_name"), index: n("joint_index", 0), topic: s("topic"), subTopic: s("sub_topic"), initial: n("initial_position", 0), p: n("p_gain", 1), i: n("i_gain", 0.1), d: n("d_gain", 0.01), cmdMax: n("cmd_max", 1000), cmdMin: n("cmd_min", -1000), useVelocity: bool(el, "use_velocity_commands", false) };
  if (/joint-controller-system|JointController\b/.test(id)) return { ...base, kind: "joint_velocity", joint: all("joint_name")[0] || "", joints: all("joint_name"), topic: s("topic"), subTopic: s("sub_topic"), initial: n("initial_velocity", 0), forceMode: bool(el, "use_force_commands", false) };
  if (/apply-joint-force-system|ApplyJointForce/.test(id)) return { ...base, kind: "apply_joint_force", joint: s("joint_name") || "" };
  if (/joint-trajectory-controller-system|JointTrajectoryController/.test(id)) return { ...base, kind: "joint_trajectory", joints: all("joint_name"), topic: s("topic"), initial: all("initial_position").map(Number), p: all("position_p_gain").map(Number), useHeaderStart: bool(el, "use_header_start_time", false) };
  if (/velocity-control-system|VelocityControl/.test(id) && !/Multicopter/.test(id)) return { ...base, kind: "velocity_control", topic: s("topic"), initialLinear: nums(s("initial_linear"), 3, [0, 0, 0]), initialAngular: nums(s("initial_angular"), 3, [0, 0, 0]) };
  if (/mecanum-drive-system|MecanumDrive/.test(id)) return { ...base, kind: "mecanum", fl: all("front_left_joint")[0] || "", fr: all("front_right_joint")[0] || "", rl: all("back_left_joint")[0] || "", rr: all("back_right_joint")[0] || "", separation: n("wheel_separation", 1.0), wheelbase: n("wheelbase", 1.0), radius: n("wheel_radius", 0.2), ...drive(), ...lim() };
  if (/ackermann-steering-system|AckermannSteering/.test(id)) return { ...base, kind: "ackermann", wheels: [...all("left_joint"), ...all("right_joint")], leftSteer: s("left_steering_joint") || "", rightSteer: s("right_steering_joint") || "", wheelbase: n("wheel_base", 1.0), separation: n("wheel_separation", 1.0), kingpin: n("kingpin_width", 0.8), radius: n("wheel_radius", 0.2), steerLimit: n("steering_limit", 0.5), steeringOnly: bool(el, "steering_only", false), ...drive() };
  if (/odometry-publisher-system|OdometryPublisher/.test(id)) return { ...base, kind: "odometry_publisher", odomTopic: s("odom_topic"), odomCovTopic: s("odom_covariance_topic"), tfTopic: s("tf_topic"), frame: s("odom_frame"), child: s("robot_base_frame"), odomRate: n("odom_publish_frequency", 50), dims: n("dimensions", 2), noise: n("gaussian_noise", 0) };
  if (/pose-publisher-system|PosePublisher/.test(id)) return { ...base, kind: "pose_publisher", topic: s("topic"), rate: n("update_frequency", -1), link: bool(el, "publish_link_pose", true), nested: bool(el, "publish_nested_model_pose", false), model: bool(el, "publish_model_pose", false), sensor: bool(el, "publish_sensor_pose", false), staticPub: bool(el, "static_publisher", false), poseV: bool(el, "use_pose_vector_msg", false) };
  if (/multicopter-motor-model|MulticopterMotorModel/.test(id)) return { ...base, kind: "multicopter_motor", joint: s("jointName"), motor: n("motorNumber", 0), dir: s("turningDirection"), speedTopic: s("commandSubTopic") };
  if (/multicopter-control|MulticopterVelocityControl/.test(id)) return { ...base, kind: "multicopter_control", topic: s("commandSubTopic") || "cmd_vel", enableTopic: s("enableSubTopic") || "enable" };
  if (/gz_ros2_control|ign_ros2_control|GazeboSimROS2ControlPlugin|IgnitionROS2ControlPlugin/.test(id)) return { ...base, kind: "gz_ros2_control", params: all("parameters")[0] || null, paramsAll: all("parameters"), cmName: s("controller_manager_name"), holdJoints: bool(el, "hold_joints", true), gain: n("position_proportional_gain", 0.1), ns: val(kid(el, "ros"), "namespace", ""), file: filename };
  if (/libgazebo_ros_/.test(filename)) return { ...base, kind: "classic" };
  return { ...base, kind: "other" };
}

// ---------------- the loader ----------------
class Ctx {
  constructor(opts = {}) {
    this.resolve = opts.resolve || (() => null);
    this.env = opts.env || {};
    this.cache = opts.cache || new Map();
    this.pending = [];
    this.errors = []; this.warnings = [];
    this.home = this.env.HOME || "/home/student";
    this.modelDirs = new Map();
  }
  read(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    let r; try { r = this.resolve(path); } catch { r = null; }
    if (r && typeof r.then === "function") { this.pending.push(r.then((v) => this.cache.set(path, v || null), () => this.cache.set(path, null))); return undefined; }
    this.cache.set(path, r || null);
    return r || null;
  }
  readText(path) { const r = this.read(path); if (!r) return r; if (r.text != null) return r.text; if (r.bytes) return new TextDecoder().decode(r.bytes); return null; }
  resourceDirs() {
    const sp = (k) => String(this.env[k] || "").split(":").filter(Boolean);
    return [...new Set([...sp("GZ_SIM_RESOURCE_PATH"), ...sp("IGN_GAZEBO_RESOURCE_PATH"), ...sp("SDF_PATH"), `${this.home}/.gz/fuel`])].map((d) => d.replace(/\/+$/, ""));
  }
  amentShares() { return String(this.env.AMENT_PREFIX_PATH || "/opt/ros/jazzy").split(":").filter(Boolean).map((p) => p.replace(/\/+$/, "") + "/share"); }
  // model://name -> the directory that has name/model.config (undefined: still fetching)
  modelDir(name) {
    if (this.modelDirs.has(name)) return this.modelDirs.get(name);
    let waiting = false;
    for (const d of this.resourceDirs()) { const t = this.readText(`${normPath(d)}/${name}/model.config`); if (t === undefined) { waiting = true; continue; } if (t) { const r = `${normPath(d)}/${name}`; this.modelDirs.set(name, r); return r; } }
    if (waiting) return undefined;
    this.modelDirs.set(name, null); return null;
  }
  // a mesh / file URI -> absolute path (or null); baseDir: directory of the SDF file it is written in
  uriPath(uri, baseDir) {
    const u = String(uri || "").trim();
    let m;
    if ((m = u.match(/^model:\/\/([^/]+)\/?(.*)$/))) { const d = this.modelDir(m[1]); if (d) return m[2] ? `${d}/${m[2]}` : d; if (d === undefined) return undefined;
      for (const s of this.amentShares()) if (this.readText(`${s}/${m[1]}/package.xml`)) return `${s}/${m[1]}/${m[2]}`;
      return null; }
    if ((m = u.match(/^package:\/\/([^/]+)\/(.*)$/))) {
      for (const s of this.amentShares()) { const t = this.readText(`${s}/${m[1]}/package.xml`); if (t) return `${s}/${m[1]}/${m[2]}`; }
      for (const d of this.resourceDirs()) if (this.read(`${d}/${m[1]}/${m[2]}`)) return `${d}/${m[1]}/${m[2]}`;
      return `/opt/ros/jazzy/share/${m[1]}/${m[2]}`;
    }
    if ((m = u.match(/^file:\/\/(.*)$/))) return normPath(m[1]);
    if (u.startsWith("/")) return normPath(u);
    if (/^https?:/.test(u)) return u;
    return baseDir ? normPath(`${baseDir}/${u}`) : u;
  }
}
const normPath = (p) => { const out = []; for (const s of String(p).split("/")) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); } return (String(p).startsWith("/") ? "/" : "") + out.join("/"); };
const dirOf = (p) => String(p || "").replace(/\/[^/]*$/, "");

// model.config -> the SDF file with the highest version (sdformat getBestSupportedModelVersion)
function bestModelFile(cfg) {
  let best = null, bestV = -1;
  for (const m of String(cfg).matchAll(/<sdf\b[^>]*?(?:version\s*=\s*["']([\d.]+)["'])?[^>]*>\s*([^<\s]+)\s*<\/sdf>/g)) { const v = Number(m[1] || 0); if (v <= 1.11 + 1e-9 && v >= bestV) { bestV = v; best = m[2]; } }
  return best;
}

// parse the XML of an SDF document; returns the <sdf> node or null (errors recorded)
function parseDoc(ctx, textIn, file) {
  let root;
  try { root = parseXML(String(textIn)); }
  catch (e) { ctx.errors.push(fmtErr(SDF_ERROR.FILE_READ, file ? `Error parsing XML in file [${file}]: ${e.message}` : `Error parsing XML from string: ${e.message}`)); return null; }
  if (root.tag === "robot") return { urdf: true, root };
  if (root.tag !== "sdf") { ctx.errors.push(fmtErr(SDF_ERROR.ELEMENT_INVALID, `Root element is not <sdf>, but <${root.tag}>`, { file })); return null; }
  if (!root.attrs.version) ctx.errors.push(fmtErr(SDF_ERROR.ATTRIBUTE_MISSING, "Required attribute[version] in element[sdf] is not specified in SDF.", { xmlPath: "/sdf", file, line: root.line }));
  return root;
}

// sdformat copies elements it does not know, with a warning (Utils.cc:132 format, as gz sim prints it)
const LEGACY_OK = new Set(["use_parent_model_frame", "gz_frame_id", "ignition:frame_id"]);
function checkUnknown(ctx, el, defKey, xmlPath, file) {
  const allowed = SDF_SCHEMA[defKey];
  if (!allowed || allowed[0] === "*") return;
  for (const c of el.children) {
    if (c.tag === "#text" || c.tag.includes(":")) continue;
    const childKey = SDF_SCHEMA[`${defKey}/${c.tag}`] ? `${defKey}/${c.tag}` : c.tag;
    const cp = `${xmlPath}/${c.tag}${c.attrs.name ? `[@name="${c.attrs.name}"]` : ""}`;
    if (!allowed.includes(c.tag)) {
      if (LEGACY_OK.has(c.tag) && c.tag !== "gz_frame_id") continue;
      ctx.warnings.push(`Warning [Utils.cc:132] [${cp}:${file || "data-string"}:L${c.line || 0}]: XML Element[${c.tag}], child of element[${el.tag}], not defined in SDF. Copying[${c.tag}] as children of [${el.tag}].`);
      continue;
    }
    if (["link", "joint", "model", "world", "include"].includes(c.tag)) continue;   // checked where they are read
    checkUnknown(ctx, c, childKey, cp, file);
  }
}

// ---------------- geometry / material ----------------
const SCRIPT_COLORS = { "Gazebo/Grey": [0.7, 0.7, 0.7, 1], "Gazebo/DarkGrey": [0.175, 0.175, 0.175, 1], "Gazebo/White": [1, 1, 1, 1], "Gazebo/Black": [0, 0, 0, 1], "Gazebo/Red": [1, 0, 0, 1], "Gazebo/Green": [0, 1, 0, 1], "Gazebo/Blue": [0, 0, 1, 1],
  "Gazebo/Yellow": [1, 1, 0, 1], "Gazebo/Orange": [1, 0.5088, 0.0468, 1], "Gazebo/Wood": [0.6, 0.4, 0.2, 1], "Gazebo/WoodFloor": [0.55, 0.42, 0.28, 1], "Gazebo/Bricks": [0.6, 0.3, 0.25, 1], "Gazebo/FlatBlack": [0.1, 0.1, 0.1, 1], "Gazebo/Gold": [0.8, 0.65, 0.2, 1] };
function colorOf(mat) {
  if (!mat) return null;
  const d = val(mat, "diffuse") || val(mat, "ambient");
  if (d) { const v = nums(d, 3, null); if (v) { const a = String(d).trim().split(/\s+/).map(Number); return [v[0], v[1], v[2], Number.isFinite(a[3]) ? a[3] : 1]; } }
  const sc = val(kid(mat, "script"), "name"); if (sc && SCRIPT_COLORS[sc]) return SCRIPT_COLORS[sc];
  return null;
}
function geometryOf(ctx, g, baseDir, where) {
  if (!g) return null;
  const s = g.children.find((c) => c.tag !== "#text");
  if (!s) return { type: "empty" };
  switch (s.tag) {
    case "box": return { type: "box", size: nums(val(s, "size"), 3, [1, 1, 1]) };
    case "cylinder": return { type: "cylinder", radius: num(s, "radius", 0.5), length: num(s, "length", 1) };
    case "sphere": return { type: "sphere", radius: num(s, "radius", 1) };
    case "capsule": return { type: "capsule", radius: num(s, "radius", 0.5), length: num(s, "length", 1) };
    case "cone": return { type: "cone", radius: num(s, "radius", 0.5), length: num(s, "length", 1) };
    case "ellipsoid": return { type: "ellipsoid", radii: nums(val(s, "radii"), 3, [1, 1, 1]) };
    case "plane": return { type: "plane", size: nums(val(s, "size"), 2, [1, 1]), normal: nums(val(s, "normal"), 3, [0, 0, 1]) };
    case "mesh": {
      const uri = val(s, "uri") || "", path = ctx.uriPath(uri, baseDir);
      const sub = kid(s, "submesh");
      return { type: "mesh", uri, filename: path || uri, path: path || null, scale: nums(val(s, "scale"), 3, [1, 1, 1]), submesh: sub ? val(sub, "name") : null };
    }
    case "heightmap": { ctx.warnings.push(`[Wrn] [practice Gazebo] heightmap in ${where} is not simulated here (shown as a flat box of its <size>).`); const sz = nums(val(s, "size"), 3, [1, 1, 0.01]); return { type: "box", size: [sz[0], sz[1], Math.max(0.01, sz[2] * 0.02)], heightmap: val(s, "uri") }; }
    case "polyline": return { type: "box", size: [0.01, 0.01, num(s, "height", 1)], polyline: true };
    default: return { type: "empty" };
  }
}
function surfaceOf(c) {
  const sf = kid(c, "surface"); if (!sf) return {};
  const fr = kid(sf, "friction"), ode = kid(fr, "ode"), bounce = kid(sf, "bounce");
  return { mu: ode ? num(ode, "mu", undefined) : undefined, mu2: ode ? num(ode, "mu2", undefined) : undefined, restitution: bounce ? num(bounce, "restitution_coefficient", undefined) : undefined,
    collideBitmask: num(kid(sf, "contact"), "collide_bitmask", undefined) };
}

// ---------------- sensors (the shape gz-sdf.js urdfGazebo() gives) ----------------
const SENSOR_ALIAS = { gpu_ray: "gpu_lidar", depth: "depth_camera", rgbd: "rgbd_camera", ray: "lidar", force_torque: "force_torque", gps: "navsat" };
function sensorOf(ctx, s, link, poseT, file) {
  const type0 = (s.attrs.type || "").trim(), type = SENSOR_ALIAS[type0] && type0 !== "ray" ? SENSOR_ALIAS[type0] : type0;
  const sen = { name: s.attrs.name || type, type, link, topic: val(s, "topic"), frame: val(s, "gz_frame_id") || val(s, "frame_id") || val(s, "ignition:frame_id"), optical: null,
    rate: num(s, "update_rate", 0), alwaysOn: bool(s, "always_on", false), visualize: bool(s, "visualize", false), enableMetrics: bool(s, "enable_metrics", false), pose: T6(poseT), sdfType: type0 };
  const ray = kid(s, "lidar") || kid(s, "ray");
  if (ray) {
    const sc = kid(ray, "scan"), hz = kid(sc, "horizontal"), vt = kid(sc, "vertical"), rg = kid(ray, "range"), nz = kid(ray, "noise");
    sen.lidar = { hSamples: num(hz, "samples", 640), hRes: num(hz, "resolution", 1), hMin: num(hz, "min_angle", 0), hMax: num(hz, "max_angle", 0), vSamples: vt ? num(vt, "samples", 1) : 1, vMin: vt ? num(vt, "min_angle", 0) : 0, vMax: vt ? num(vt, "max_angle", 0) : 0,
      min: num(rg, "min", 0), max: num(rg, "max", 0), resolution: num(rg, "resolution", 0), noise: nz ? num(nz, "stddev", 0) : 0, noiseMean: nz ? num(nz, "mean", 0) : 0 };
    const vk = kid(ray, "visibility_mask"); if (vk) sen.lidar.visibilityMask = text(vk);
  }
  const cam = kid(s, "camera");
  if (cam) {
    const img = kid(cam, "image"), clip = kid(cam, "clip"), nz = kid(cam, "noise"), dc = kid(cam, "depth_camera");
    sen.camera = { name: cam.attrs.name || null, hfov: num(cam, "horizontal_fov", 1.047), width: num(img, "width", 320), height: num(img, "height", 240), format: val(img, "format", "R8G8B8"), near: num(clip, "near", 0.1), far: num(clip, "far", 10),
      noise: nz ? num(nz, "stddev", 0) : 0, infoTopic: val(cam, "camera_info_topic"), depthNear: dc ? num(kid(dc, "clip"), "near", null) : null, depthFar: dc ? num(kid(dc, "clip"), "far", null) : null };
    sen.optical = val(cam, "optical_frame_id");
  }
  const imu = kid(s, "imu");
  if (imu) {
    const sd = (grp, ax) => num(kid(kid(kid(imu, grp), ax), "noise"), "stddev", 0);
    sen.imu = { gyroNoise: [sd("angular_velocity", "x"), sd("angular_velocity", "y"), sd("angular_velocity", "z")], accNoise: [sd("linear_acceleration", "x"), sd("linear_acceleration", "y"), sd("linear_acceleration", "z")],
      localization: val(kid(imu, "orientation_reference_frame"), "localization", "ENU") };
  }
  const ct = kid(s, "contact"); if (ct) sen.contact = { collision: val(ct, "collision"), topic: val(ct, "topic") };
  const ns = kid(s, "navsat") || kid(s, "gps"); if (ns) sen.navsat = {};
  const ft = kid(s, "force_torque"); if (ft) sen.forceTorque = { frame: val(ft, "frame", "child"), direction: val(ft, "measure_direction", "child_to_parent") };
  for (const p of kids(s, "plugin")) if (/libgazebo_ros_/.test(p.attrs.filename || "")) (sen.classic = sen.classic || []).push(p.attrs.filename);
  if (type0 === "ray" || type0 === "lidar") ctx.warnings.push("[Err] [Sensors.cc] Sensor type LIDAR not supported yet. Try using a GPU LIDAR instead.");
  return sen;
}

// ---------------- models ----------------
// Read one <model> (or an included one) into a flat description in the model's own frame:
//   links: Map(scopedName -> { X (pose in model frame), visuals, collisions, inertial, sensors, gravity, kinematic })
//   joints: [{ name, type, parent, child, X (joint frame in model frame), axis (in joint frame), limit, ... }]
function readModel(ctx, el, { file, xmlPath, nameOverride, staticOverride, depth = 0 } = {}) {
  const name = nameOverride || el.attrs.name;
  const baseDir = dirOf(file);
  if (!el.attrs.name && !nameOverride) ctx.errors.push(fmtErr(SDF_ERROR.ATTRIBUTE_MISSING, "Required attribute[name] in element[model] is not specified in SDF.", { xmlPath, file, line: el.line }));
  const M = { name: name || "__default__", static: staticOverride ?? bool(el, "static", false), selfCollide: bool(el, "self_collide", false), links: new Map(), joints: [], plugins: [], frames: new Map(), nested: [], canonical: el.attrs.canonical_link || null, file, lights: [] };
  checkUnknown(ctx, el, "model", xmlPath, file);
  // frame graph entries in this model's scope: name -> { rel, T, kind, attached }
  const F = new Map();
  const dup = (kind, n) => { if (F.has(n)) { ctx.errors.push(fmtErr(SDF_ERROR.DUPLICATE_NAME, `${kind} with name[${n}] already exists.`, { xmlPath, file })); return true; } return false; };
  for (const l of kids(el, "link")) {
    const ln = l.attrs.name; if (!ln) { ctx.errors.push(fmtErr(SDF_ERROR.ATTRIBUTE_MISSING, "Required attribute[name] in element[link] is not specified in SDF.", { xmlPath: `${xmlPath}/link`, file, line: l.line })); continue; }
    if (dup("link", ln)) continue;
    const p = poseOf(l); F.set(ln, { rel: p.rel || "__model__", T: p.T, kind: "link", el: l });
  }
  for (const fr of kids(el, "frame")) {
    const fnm = fr.attrs.name; if (!fnm || dup("frame", fnm)) continue;
    const p = poseOf(fr); const att = fr.attrs.attached_to || "__model__";
    F.set(fnm, { rel: p.rel || att, T: p.T, kind: "frame", attached: att });
  }
  for (const j of kids(el, "joint")) {
    const jn = j.attrs.name; if (!jn) { ctx.errors.push(fmtErr(SDF_ERROR.ATTRIBUTE_MISSING, "Required attribute[name] in element[joint] is not specified in SDF.", { xmlPath: `${xmlPath}/joint`, file, line: j.line })); continue; }
    if (dup("joint", jn)) continue;
    const p = poseOf(j); F.set(jn, { rel: p.rel || val(j, "child") || "__model__", T: p.T, kind: "joint", el: j });
  }
  // nested models and includes: resolved in their own scope, then placed in ours
  const nestedEls = [...kids(el, "model").map((m) => ({ m, inc: null })), ...kids(el, "include").map((inc) => ({ m: null, inc }))];
  nestedEls.forEach(({ m, inc }, i) => {
    let sub, poseEl = m, merge = false;
    if (inc) {
      const r = includeModel(ctx, inc, { file, xmlPath: `${xmlPath}/include[${i + 1}]`, depth, parentStatic: M.static });
      if (!r || !r.model) return; sub = r.model; poseEl = inc; merge = /^(true|1)$/i.test(inc.attrs.merge || "");
    } else sub = readModel(ctx, m, { file, xmlPath: `${xmlPath}/model[@name="${m.attrs.name}"]`, staticOverride: M.static ? true : undefined, depth: depth + 1 });
    if (!sub) return;
    const p = poseOf(poseEl);
    if (merge) {   // <include merge="true">: the included model's links/joints join this model (no scope)
      for (const [ln, L] of sub.links) { F.set(ln, { rel: "__model__", T: tMul(p.T, L.X), kind: "link", pre: L }); }
      for (const jt of sub.joints) M.joints.push({ ...jt, X: tMul(p.T, jt.X) });
      M.plugins.push(...sub.plugins); return;
    }
    if (dup("model", sub.name)) return;
    F.set(sub.name, { rel: p.rel || "__model__", T: p.T, kind: "model", sub });
  });
  // resolve every frame of this scope into the model frame
  const X = new Map([["__model__", T0()]]), busy = new Set();
  const resolveF = (n, who) => {
    if (X.has(n)) return X.get(n);
    const e = F.get(n);
    if (!e) { ctx.errors.push(fmtErr(SDF_ERROR.POSE_RELATIVE_TO_INVALID, `relative_to name[${n}] specified by ${who} does not match a nested model, link, joint, or frame name in model with name[${M.name}].`, { xmlPath, file })); X.set(n, T0()); return X.get(n); }
    if (busy.has(n)) { ctx.errors.push(fmtErr(SDF_ERROR.POSE_RELATIVE_TO_CYCLE, `PoseRelativeToGraph cycle detected, already visited vertex [${M.name}::${n}].`, { xmlPath, file })); return T0(); }
    busy.add(n);
    const base = e.rel === n ? T0() : resolveF(e.rel, `${e.kind} name[${n}]`);
    const T = tMul(base, e.T); X.set(n, T); busy.delete(n); return T;
  };
  for (const n of F.keys()) resolveF(n, n);
  // links of this model
  for (const [ln, e] of F) {
    if (e.kind !== "link") continue;
    if (e.pre) { M.links.set(ln, { ...e.pre, X: X.get(ln) }); continue; }
    M.links.set(ln, readLink(ctx, e.el, ln, X.get(ln), { file, baseDir, xmlPath: `${xmlPath}/link[@name="${ln}"]` }));
  }
  // nested models: their links and joints with scoped names, in our frame
  for (const [mn, e] of F) {
    if (e.kind !== "model") continue;
    const XN = X.get(mn), sub = e.sub;
    for (const [ln, L] of sub.links) M.links.set(`${mn}::${ln}`, { ...L, X: tMul(XN, L.X), scoped: `${mn}::${ln}` });
    for (const jt of sub.joints) M.joints.push({ ...jt, name: `${mn}::${jt.name}`, parent: jt.parent === "world" ? "world" : `${mn}::${jt.parent}`, child: `${mn}::${jt.child}`, X: tMul(XN, jt.X) });
    for (const pl of sub.plugins) M.plugins.push({ ...pl, scope: mn + (pl.scope ? "::" + pl.scope : "") });
    M.nested.push({ name: mn, X: XN, static: sub.static, model: sub });
  }
  // joints of this model
  const frameLink = (n) => { let e = F.get(n), g = 0; while (e && e.kind === "frame" && g++ < 32) { n = e.attached; e = F.get(n); } return e && e.kind === "joint" ? frameLink(val(e.el, "child")) : n; };
  for (const [jn, e] of F) {
    if (e.kind !== "joint") continue;
    const j = e.el, type = (j.attrs.type || "").trim();
    let parent = val(j, "parent") || "", child = val(j, "child") || "";
    const where = { xmlPath: `${xmlPath}/joint[@name="${jn}"]`, file, line: j.line };
    if (!type) ctx.errors.push(fmtErr(SDF_ERROR.ATTRIBUTE_MISSING, "Required attribute[type] in element[joint] is not specified in SDF.", where));
    const exists = (n) => n === "world" || F.has(n) || [...F.values()].some((x) => x.kind === "model" && n.startsWith(x.sub.name + "::") && x.sub.links.has(n.slice(x.sub.name.length + 2)));
    if (child === "world" || !exists(child)) { ctx.errors.push(fmtErr(SDF_ERROR.JOINT_CHILD_LINK_INVALID, `Child frame with name[${child}] specified by joint with name[${jn}] not found in model with name[${M.name}].`, where)); continue; }
    if (!exists(parent)) { ctx.errors.push(fmtErr(SDF_ERROR.JOINT_PARENT_LINK_INVALID, `Parent frame with name[${parent}] specified by joint with name[${jn}] not found in model with name[${M.name}].`, where)); continue; }
    if (parent === child) { ctx.errors.push(fmtErr(SDF_ERROR.JOINT_PARENT_SAME_AS_CHILD, `Joint with name[${jn}] must specify different frame names for parent and child, while [${child}] was specified for both.`, where)); continue; }
    parent = parent === "world" ? "world" : frameLink(parent); child = frameLink(child);
    const XJ = X.get(jn);
    const ax = kid(j, "axis"), ax2 = kid(j, "axis2");
    let axis = [0, 0, 1];
    if (ax) {
      const xe = kid(ax, "xyz"); axis = nums(text(xe), 3, [0, 0, 1]);
      const expr = xe && xe.attrs.expressed_in, upm = /^(true|1)$/i.test(val(ax, "use_parent_model_frame") || "");
      if (expr || upm) {
        const E = upm || expr === "__model__" ? T0() : X.get(expr);
        if (!E) ctx.errors.push(fmtErr(SDF_ERROR.JOINT_AXIS_EXPRESSED_IN_INVALID, `Joint axis expressed-in frame [${expr}] not found.`, where));
        else axis = qRot([-XJ.q[0], -XJ.q[1], -XJ.q[2], XJ.q[3]], qRot(E.q, axis));
      }
      const L = Math.hypot(...axis); if (L > 1e-9) axis = axis.map((v) => v / L);
    }
    const lim = kid(ax, "limit"), dyn = kid(ax, "dynamics"), mim = kid(ax, "mimic");
    const limit = { lower: num(lim, "lower", -1e16), upper: num(lim, "upper", 1e16), effort: num(lim, "effort", -1), velocity: num(lim, "velocity", -1) };
    M.joints.push({ name: jn, type, parent, child, X: XJ, axis, axis2: ax2 ? nums(val(ax2, "xyz"), 3, [0, 1, 0]) : null, limit,
      damping: num(dyn, "damping", 0), friction: num(dyn, "friction", 0), springRef: num(dyn, "spring_reference", 0), springK: num(dyn, "spring_stiffness", 0),
      mimic: mim ? { joint: mim.attrs.joint, multiplier: num(mim, "multiplier", 1), offset: num(mim, "offset", 0) } : null, sensors: kids(j, "sensor").map((s) => sensorOf(ctx, s, child, tMul(tInv(X.get(child) || T0()), tMul(XJ, poseOf(s).T)), file)) });
  }
  for (const p of kids(el, "plugin")) M.plugins.push({ filename: p.attrs.filename || "", name: p.attrs.name || "", el: p, line: p.line, file });
  M.frames = X;
  return M;
}

function readLink(ctx, l, ln, XL, { file, baseDir, xmlPath }) {
  checkUnknown(ctx, l, "link", xmlPath, file);
  const L = { name: ln, X: XL, visuals: [], collisions: [], inertial: null, sensors: [], gravity: bool(l, "gravity", true), kinematic: bool(l, "kinematic", false), lights: [] };
  const local = (n) => poseOf(n).T;   // visual / collision / sensor poses: relative to the link (relative_to other frames is rare here)
  for (const v of kids(l, "visual")) { const g = geometryOf(ctx, kid(v, "geometry"), baseDir, `visual[${v.attrs.name}] of link[${ln}]`); if (g && g.type !== "empty") L.visuals.push({ name: v.attrs.name, T: local(v), geom: g, rgba: colorOf(kid(v, "material")), transparency: num(v, "transparency", 0), castShadows: bool(v, "cast_shadows", true) }); }
  for (const c of kids(l, "collision")) { const g = geometryOf(ctx, kid(c, "geometry"), baseDir, `collision[${c.attrs.name}] of link[${ln}]`); if (g && g.type !== "empty") L.collisions.push({ name: c.attrs.name, T: local(c), geom: g, surface: surfaceOf(c) }); }
  const inr = kid(l, "inertial");
  if (inr) {
    const I = kid(inr, "inertia");
    L.inertial = { mass: num(inr, "mass", 1), T: local(inr), inertia: ["ixx", "ixy", "ixz", "iyy", "iyz", "izz"].map((k, i) => num(I, k, i === 0 || i === 3 || i === 5 ? 1 : 0)), auto: /^(true|1)$/i.test(inr.attrs.auto || "") };
  }
  for (const s of kids(l, "sensor")) L.sensors.push(sensorOf(ctx, s, ln, local(s), file));
  for (const lt of kids(l, "light")) L.lights.push(lightOf(lt));
  return L;
}

function lightOf(lt) {
  const att = kid(lt, "attenuation"), p = poseOf(lt);
  return { name: lt.attrs.name || "light", type: lt.attrs.type || "point", pose: T6(p.T), castShadows: bool(lt, "cast_shadows", false), diffuse: nums(val(lt, "diffuse"), 3, [1, 1, 1]), specular: nums(val(lt, "specular"), 3, [0.1, 0.1, 0.1]),
    direction: nums(val(lt, "direction"), 3, [0, 0, -1]), intensity: num(lt, "intensity", 1), range: num(att, "range", 10) };
}

// an <include>: find the file, read its model (or light), apply <name> <static> <pose> <plugin> overrides
function includeModel(ctx, inc, { file, xmlPath, depth = 0, parentStatic = false }) {
  if (depth > 16) { ctx.errors.push(fmtErr(SDF_ERROR.ELEMENT_INVALID, "Include recursion too deep", { xmlPath, file })); return null; }
  const uriEl = kid(inc, "uri"), uri = (text(uriEl) || "").trim();
  const where = { xmlPath: `${xmlPath}/uri`, file, line: uriEl ? uriEl.line : inc.line };
  if (!uri) { ctx.errors.push(fmtErr(SDF_ERROR.ELEMENT_MISSING, "<include> element missing 'uri' attribute", { xmlPath, file, line: inc.line })); return null; }
  let sdfText = null, sdfFile = null;
  const fuel = fuelName(uri);
  if (fuel) {
    if (FUEL[fuel]) { sdfText = FUEL[fuel]; sdfFile = `${ctx.home}/.gz/fuel/fuel.gazebosim.org/openrobotics/models/${fuel.replace(/ /g, "%20")}/1/model.sdf`; }
    else { ctx.errors.push(fmtErr(SDF_ERROR.URI_LOOKUP, `Unable to find uri[${uri}]`, where)); ctx.fuelMissing = (ctx.fuelMissing || []).concat(uri); return null; }
  } else {
    let dir = null;
    const m = uri.match(/^model:\/\/(.+?)\/?$/);
    if (m) { const parts = m[1].split("/"); const d = ctx.modelDir(parts[0]); if (d === undefined) return null; dir = d ? [d, ...parts.slice(1)].join("/") : null; }
    else { const p = ctx.uriPath(uri, dirOf(file)); if (p === undefined) return null; dir = p; }
    if (dir) {
      if (/\.(sdf|world|urdf)$/.test(dir)) { sdfFile = dir; sdfText = ctx.readText(dir); }
      else { const cfg = ctx.readText(`${dir}/model.config`); if (cfg === undefined) return null; const best = cfg ? bestModelFile(cfg) : "model.sdf"; sdfFile = `${dir}/${best || "model.sdf"}`; sdfText = ctx.readText(sdfFile);
        if (cfg && !best) { ctx.errors.push(fmtErr(SDF_ERROR.URI_LOOKUP, `Unable to resolve uri[${uri}] to model path [${dir}] since it does not contain a model.config file.`, where)); return null; } }
      if (sdfText === undefined) return null;
    }
    if (!dir || sdfText == null) { ctx.errors.push(fmtErr(SDF_ERROR.URI_LOOKUP, `Unable to find uri[${uri}]`, where)); return null; }
  }
  const root = parseDoc(ctx, sdfText, sdfFile); if (!root || root.urdf) return null;
  const lt = kid(root, "light");
  if (lt && !kid(root, "model")) { const L = lightOf(lt); const p = poseOf(inc); if (kid(inc, "pose")) L.pose = T6(p.T); if (val(inc, "name")) L.name = val(inc, "name"); return { light: L }; }
  const mEl = kid(root, "model");
  if (!mEl) { ctx.errors.push(fmtErr(SDF_ERROR.ELEMENT_MISSING, `Expected exactly one top-level <model>, <light> or <actor> in [${sdfFile}].`, { file: sdfFile })); return null; }
  const st = val(inc, "static");
  const model = readModel(ctx, mEl, { file: sdfFile, xmlPath: `/sdf/model[@name="${mEl.attrs.name}"]`, nameOverride: val(inc, "name") || undefined, staticOverride: st !== null ? /^(true|1)$/i.test(st) : parentStatic ? true : undefined, depth: depth + 1 });
  // the model's own <pose> moves it within the include frame
  const own = poseOf(mEl);
  if (!isIdent(own.T)) { for (const L of model.links.values()) L.X = tMul(own.T, L.X); for (const j of model.joints) j.X = tMul(own.T, j.X); }
  for (const p of kids(inc, "plugin")) model.plugins.push({ filename: p.attrs.filename || "", name: p.attrs.name || "", el: p, line: p.line, file });
  model.uri = uri; model.sdfFile = sdfFile;
  return { model };
}

// ---------------- model -> the practice Gazebo's shapes ----------------
const shape6 = (geom, T, extra) => ({ ...geom, pose: T6(T), linkPose: [0, 0, 0, 0, 0, 0], ...extra });
// a static (or jointless) model as a world model of gz-sdf.js parseWorld(): shapes in the model frame
function worldModelOf(M, poseT, { isStatic }) {
  const shapes = [], colShapes = [];
  let mass = 0, mu = 1, restitution = 0;
  for (const L of M.links.values()) {
    for (const v of L.visuals) shapes.push(shape6(v.geom, tMul(L.X, v.T), { linkPose: [0, 0, 0, 0, 0, 0], color: v.rgba || [0.7, 0.7, 0.7, 1], link: L.name, plane: v.geom.type === "plane" }));
    for (const c of L.collisions) { colShapes.push(shape6(c.geom, tMul(L.X, c.T), { link: L.name })); if (c.surface.mu !== undefined) mu = c.surface.mu; if (c.surface.restitution !== undefined) restitution = c.surface.restitution; }
    if (L.inertial) mass += L.inertial.mass;
  }
  return { name: M.name, static: isStatic, pose: T6(poseT), shapes, colShapes, mass: isStatic ? 0 : mass || 1, mu, restitution, sdf: true, uri: M.uri || null };
}

/** A model (from readModel) as the URDF-like tree the practice Gazebo simulates (urdf-core.js parseURDF shape).
 *  The tree frame of a link joined by a joint is its joint frame (so revolute/prismatic motion is exact); the link's
 *  real frame offset is folded into its visuals, collisions, inertial and sensors. */
export function sdfModelToTree(M, ctx = new Ctx()) {
  const links = {}, joints = {}, F = {};
  const childOf = new Map(M.joints.map((j) => [j.child, j]));
  const linkNames = [...M.links.keys()];
  let root = M.canonical && M.links.has(M.canonical) ? M.canonical : linkNames.find((n) => !childOf.has(n)) || linkNames[0];
  if (M.canonical && !M.links.has(M.canonical)) ctx.errors.push(fmtErr(SDF_ERROR.MODEL_CANONICAL_LINK_INVALID, `canonical_link with name[${M.canonical}] not found in model with name[${M.name}].`, { file: M.file }));
  const worldJ = M.joints.filter((j) => j.parent === "world");
  // tree frames: the root's is the model frame (the model pose places it); a jointed link's is its joint frame
  const hasWorld = worldJ.length > 0;
  for (const n of linkNames) { const j = childOf.get(n); F[n] = j ? j.X : M.links.get(n).X; }
  if (hasWorld) { links.world = { name: "world", visuals: [], collisions: [], inertial: null }; F.world = T0(); }
  else F[root] = T0();
  const rel = (n) => tMul(tInv(n === "world" ? T0() : F[n]), M.links.get(n).X);   // link frame in its tree frame
  for (const n of linkNames) {
    const L = M.links.get(n), O = rel(n);
    links[n] = { name: n, sdf: true,
      visuals: L.visuals.map((v) => ({ origin: toOrigin(tMul(O, v.T)), geom: v.geom, rgba: v.rgba, name: v.name })),
      collisions: L.collisions.map((c) => ({ origin: toOrigin(tMul(O, c.T)), geom: c.geom, name: c.name, surface: c.surface })),
      inertial: L.inertial ? { mass: L.inertial.mass, origin: toOrigin(tMul(O, L.inertial.T)), inertia: L.inertial.inertia } : null,
      gravity: L.gravity, frameOffset: toOrigin(O) };
  }
  const MAP = { revolute: "revolute", continuous: "continuous", prismatic: "prismatic", fixed: "fixed", ball: "floating", universal: "floating", revolute2: "floating", screw: "prismatic", gearbox: "revolute" };
  for (const j of M.joints) {
    let type = MAP[j.type] || "fixed";
    if (j.type === "revolute" && !(j.limit.lower > -1e15 && j.limit.upper < 1e15)) type = "continuous";
    if (["universal", "revolute2", "gearbox", "screw"].includes(j.type)) ctx.warnings.push(`[Wrn] [practice Gazebo] joint [${j.name}] of type ${j.type} is simulated as ${type === "floating" ? "a passive (unactuated) joint" : type}.`);
    const parentF = j.parent === "world" ? T0() : F[j.parent];
    joints[j.name] = { name: j.name, type, sdfType: j.type, parent: j.parent, child: j.child, origin: toOrigin(tMul(tInv(parentF), j.X)), axis: j.axis,
      limit: type === "revolute" || type === "prismatic" ? { lower: j.limit.lower, upper: j.limit.upper, effort: j.limit.effort < 0 ? Infinity : j.limit.effort, velocity: j.limit.velocity < 0 ? Infinity : j.limit.velocity } : { lower: -Infinity, upper: Infinity, effort: j.limit.effort < 0 ? Infinity : j.limit.effort, velocity: j.limit.velocity < 0 ? Infinity : j.limit.velocity },
      mimic: j.mimic, damping: j.damping, friction: j.friction };
  }
  // links not reached by any joint float freely in Gazebo
  const treeRoot = hasWorld ? "world" : root;
  for (const n of linkNames) if (n !== treeRoot && !childOf.has(n)) {
    joints[`__free_${n}`] = { name: `__free_${n}`, type: "floating", parent: treeRoot, child: n, origin: toOrigin(tMul(tInv(F[treeRoot] || T0()), F[n])), axis: [1, 0, 0], limit: null, mimic: null, free: true };
    ctx.warnings.push(`[Wrn] [practice Gazebo] link [${n}] of model [${M.name}] has no joint: in Gazebo it is a free body; here it moves with the model.`);
  }
  const parentOf = {}, childJoints = {};
  for (const j of Object.values(joints)) { parentOf[j.child] = j; (childJoints[j.parent] = childJoints[j.parent] || []).push(j); }
  return { name: M.name, links, joints, materials: {}, root: treeRoot, childJoints, parentOf, warnings: [], sdf: true };
}

// sensors + plugins in the shape of urdfGazebo(), with sensor poses in the tree frames
function gazeboOf(ctx, M, tree) {
  const sensors = [], plugins = [], classic = [], warnings = [];
  for (const [n, L] of M.links) {
    const off = tree.links[n] && tree.links[n].frameOffset ? { t: tree.links[n].frameOffset.xyz, q: qRPY(...tree.links[n].frameOffset.rpy) } : T0();
    for (const s of L.sensors) { const S = { ...s, link: n, pose: T6(tMul(off, { t: s.pose.slice(0, 3), q: qRPY(...s.pose.slice(3)) })) }; sensors.push(S); if (s.classic) classic.push(...s.classic.map((f) => ({ sensor: s.name, file: f }))); }
  }
  for (const pl of M.plugins) {
    const p = pluginFromSdf(pl.filename, pl.name, pl.el);
    if (p.kind === "classic") { classic.push({ sensor: null, file: pl.filename }); continue; }
    if (pl.scope) p.scope = pl.scope;
    plugins.push(p);
  }
  { const vc = plugins.find((x) => x.kind === "velocity_control"), op = plugins.find((x) => x.kind === "odometry_publisher"); if (vc && op && op.dims === 3) vc.flying = true; }
  if (classic.length) warnings.push(`[Wrn] [SDFormat] Gazebo Classic plugin${classic.length > 1 ? "s" : ""} ${[...new Set(classic.map((c) => c.file))].join(", ")} ignored: gz sim (Harmonic) does not load libgazebo_ros_*.so plugins. Use <topic>, <gz_frame_id> and ros_gz_bridge instead.`);
  return { robot: M.name, sensors, plugins, classic, warnings };
}

// gz-sim SystemLoader messages for plugins that do not exist / deprecated names
function pluginLoadLines(list) {
  const out = [];
  for (const p of list) {
    const f = String(p.filename || "");
    if (/ignition-gazebo/.test(f)) out.push(`[Wrn] [SystemLoader.cc:75] Trying to load deprecated plugin [${f}]. Using [${f.replace("ignition-gazebo", "gz-sim")}] instead.`);
    if (/ignition::gazebo/.test(p.name || "")) out.push(`[Wrn] [SystemLoader.cc:136] Trying to load deprecated plugin name [${p.name}]. Using [${p.name.replace("ignition::gazebo", "gz::sim")}] instead.`);
    const n = normPluginFile(f);
    if (/libgazebo_ros_/.test(f) || !(GZ_SIM8_SYSTEMS.includes(n) || KNOWN_OTHER.test(n) && !/^gz-sim-/.test(n))) out.push(`[Err] [SystemLoader.cc:92] Failed to load system plugin [${f}] : Could not find shared library.`);
  }
  return out;
}

function modelResult(ctx, M, pose = T0()) {
  if (!M.links.size) { ctx.errors.push(fmtErr(SDF_ERROR.MODEL_WITHOUT_LINK, "A model must have at least one link.", { file: M.file })); return null; }
  const tree = sdfModelToTree(M, ctx);
  const gazebo = gazeboOf(ctx, M, tree);
  const collisions = [...M.links.values()].reduce((a, L) => a + L.collisions.length, 0);
  const mass = [...M.links.values()].reduce((a, L) => a + (L.inertial ? L.inertial.mass : 0), 0);
  const sdf = { model: tree, warnings: [], dropped: new Set(), collisions, mass, sdfLinks: [...M.links.keys()], native: true };
  return { name: M.name, model: tree, gazebo, sdf, static: M.static, pose: T6(pose), uri: M.uri || null, file: M.sdfFile || M.file, pluginLines: pluginLoadLines(M.plugins), selfCollide: M.selfCollide };
}

// ---------------- public API ----------------
const finish = (ctx, extra) => ({ ...extra, errors: ctx.errors, warnings: ctx.warnings, pending: ctx.pending.length > 0 });

/** Load an SDF world (text of a .sdf / .world file). opts: { resolve, env, path (the file's absolute path), cache }.
 *  Returns { world, errors[], warnings[], lines[] (what gz sim prints, [Err]/[Wrn] prefixed) }.
 *  world: { name, plugins (normalized library names), systems, models (static / simple world models with shapes,
 *  colShapes), robots (articulated models: { name, model, gazebo, sdf, pose }), lights, scene, gravity, physics,
 *  magneticField, sdfVersion, file, defaultPlugins }. A file holding only a <model> gives the world "default" with it. */
export function gzWorldFromSdf(sdfText, opts = {}) {
  const ctx = opts.ctx || new Ctx(opts), file = opts.path || null;
  const root = parseDoc(ctx, sdfText, file);
  if (!root) return finish(ctx, { world: null, lines: ctx.errors.map((e) => `[Err] [Server.cc:93] ${e}`) });
  if (root.urdf) { ctx.errors.push(fmtErr(SDF_ERROR.ELEMENT_INVALID, "A URDF file is not a world (spawn it with ros_gz_sim create)")); return finish(ctx, { world: null, lines: [] }); }
  let w = kid(root, "world");
  const onlyModel = !w && kid(root, "model");
  if (!w && !onlyModel) { ctx.errors.push(fmtErr(SDF_ERROR.ELEMENT_MISSING, "Unable to find a <world> element", { file })); return finish(ctx, { world: null, lines: ctx.errors.map((e) => `[Err] [Server.cc:93] ${e}`) }); }
  const wname = w ? w.attrs.name || "default" : "default";
  const xp = `/sdf/world[@name="${wname}"]`;
  if (w) checkUnknown(ctx, w, "world", xp, file);
  const plugins = w ? kids(w, "plugin").map((p) => ({ filename: p.attrs.filename || "", name: p.attrs.name || "", el: p })) : [];
  const defaultPlugins = !plugins.length;
  const sysList = defaultPlugins ? ["gz-sim-physics-system", "gz-sim-user-commands-system", "gz-sim-scene-broadcaster-system"].map((f) => ({ filename: f, name: "", el: null })) : plugins;
  const systems = sysList.map((p) => ({ file: normPluginFile(p.filename), filename: p.filename, name: p.name, renderEngine: p.el ? val(p.el, "render_engine") : null, cfg: p.el }));
  const models = [], robots = [], lights = [];
  const addModel = (M, poseT) => {
    const hasJoints = M.joints.some((j) => j.type !== "fixed"), hasPlugins = M.plugins.length > 0, hasSensors = [...M.links.values()].some((L) => L.sensors.length);
    if (!M.static && (hasJoints || hasPlugins || hasSensors)) { const r = modelResult(ctx, M, poseT); if (r) robots.push(r); return; }
    if (!M.links.size) { ctx.errors.push(fmtErr(SDF_ERROR.MODEL_WITHOUT_LINK, "A model must have at least one link.", { file: M.file })); return; }
    if (!M.static && M.links.size > 1) { for (const [ln, L] of M.links) { const sub = { ...M, name: `${M.name}::${ln}`, links: new Map([[ln, { ...L, X: T0() }]]) }; models.push(worldModelOf(sub, tMul(poseT, L.X), { isStatic: false })); } return; }
    models.push(worldModelOf(M, poseT, { isStatic: M.static }));
    for (const L of M.links.values()) for (const lt of L.lights) lights.push(lt);
  };
  const names = new Set();
  const uniq = (n, line) => { if (names.has(n)) { ctx.errors.push(fmtErr(SDF_ERROR.DUPLICATE_NAME, `model with name[${n}] already exists.`, { xmlPath: xp, file, line })); return false; } names.add(n); return true; };
  if (onlyModel) { const M = readModel(ctx, onlyModel, { file, xmlPath: `/sdf/model[@name="${onlyModel.attrs.name}"]` }); if (uniq(M.name)) addModel(M, poseOf(onlyModel).T); }
  if (w) {
    let incN = 0;
    for (const c of w.children) {
      if (c.tag === "model") { const M = readModel(ctx, c, { file, xmlPath: `${xp}/model[@name="${c.attrs.name}"]` }); if (uniq(M.name, c.line)) addModel(M, poseOf(c).T); }
      else if (c.tag === "include") {
        incN++;
        const r = includeModel(ctx, c, { file, xmlPath: `${xp}/include[${incN}]` });
        if (!r) continue;
        if (r.light) { lights.push(r.light); continue; }
        if (uniq(r.model.name, c.line)) addModel(r.model, poseOf(c).T);
      } else if (c.tag === "light") lights.push(lightOf(c));
    }
  }
  const ph = w ? kid(w, "physics") : null, sc = w ? kid(w, "scene") : null;
  const gv = w ? nums(val(w, "gravity"), 3, [0, 0, -9.8]) : [0, 0, -9.8];
  const world = {
    name: wname, plugins: systems.map((s) => s.file), systems, defaultPlugins, models, robots, lights,
    gravity: gv, magneticField: w ? nums(val(w, "magnetic_field"), 3, [5.5645e-6, 22.8758e-6, -42.3884e-6]) : [5.5645e-6, 22.8758e-6, -42.3884e-6],
    physics: { step: num(ph, "max_step_size", 0.001), rtf: num(ph, "real_time_factor", 1), updateRate: num(ph, "real_time_update_rate", 1000), type: ph ? ph.attrs.type || "ode" : "ode", name: ph ? ph.attrs.name || "default_physics" : "default_physics", engine: "dartsim" },
    scene: sc ? { ambient: nums(val(sc, "ambient"), 4, null), background: nums(val(sc, "background"), 3, null), shadows: bool(sc, "shadows", true), grid: bool(sc, "grid", true) } : { ambient: null, background: null, shadows: true, grid: true },
    sdfVersion: root.attrs.version || null, file, native: true,
  };
  const lines = [...ctx.errors.map((e) => `[Err] [Server.cc:93] ${e}`), ...ctx.warnings, ...pluginLoadLines(plugins), ...robots.flatMap((r) => r.pluginLines)];
  return finish(ctx, { world, lines });
}

/** Load a model for `ros_gz_sim create -file/-string` (SDF; a URDF gives { urdf: true }). opts: { resolve, env, path, name }.
 *  Returns { name, model (URDF-like tree), gazebo (sensors, plugins), sdf, static, pose, errors[], warnings[], lines[] }
 *  or { errors } when gz-sim would refuse it ("Expected exactly one top-level <model>, <light> or <actor> on SDF."). */
export function gzModelFromSdf(sdfText, opts = {}) {
  const ctx = opts.ctx || new Ctx(opts), file = opts.path || null;
  const root = parseDoc(ctx, sdfText, file);
  if (!root) return finish(ctx, { model: null, lines: ctx.errors.map((e) => `[Err] [UserCommands.cc:927] ${e}`) });
  if (root.urdf) return finish(ctx, { urdf: true, model: null, lines: [] });
  const mEl = kid(root, "model");
  if (!mEl) { const lines = ["[Err] [UserCommands.cc:956] Expected exactly one top-level <model>, <light> or <actor> on SDF."]; return finish(ctx, { model: null, lines }); }
  const M = readModel(ctx, mEl, { file, xmlPath: `/sdf/model[@name="${mEl.attrs.name}"]`, nameOverride: opts.name || undefined });
  const r = modelResult(ctx, M, poseOf(mEl).T);
  if (ctx.errors.length) return finish(ctx, { ...(r || {}), model: r ? r.model : null, lines: ctx.errors.map((e) => `[Err] [UserCommands.cc:927] ${e}`).concat(ctx.warnings), failed: true });
  return finish(ctx, { ...r, lines: [...ctx.warnings, ...r.pluginLines] });
}

// async variants: resolve may return Promises; includes are fetched and the file is read again until complete
async function loop(fn, text, opts) {
  const cache = opts.cache || new Map();
  for (let i = 0; i < 12; i++) {
    const ctx = new Ctx({ ...opts, cache });
    const r = fn(text, { ...opts, ctx });
    if (!ctx.pending.length) return r;
    await Promise.all(ctx.pending);
  }
  return fn(text, { ...opts, ctx: new Ctx({ ...opts, cache }) });
}
/** gzWorldFromSdf with an async resolve; also loads the mesh colliders (see gzLoadMeshes). */
export async function gzLoadWorld(text, opts = {}) {
  const r = await loop(gzWorldFromSdf, text, opts);
  if (r.world && opts.meshes !== false) await gzLoadMeshes(r.world, opts);
  return r;
}
export async function gzLoadModel(text, opts = {}) {
  const r = await loop(gzModelFromSdf, text, opts);
  if (r.model && opts.meshes !== false) await gzLoadMeshes({ models: [], robots: [r] }, opts);
  return r;
}

/** Read the mesh files of a world's collisions (and the robots' mesh collisions) into triangle arrays for the
 *  physics engine and the lidar: shape.mesh = { positions, indices, lo, hi, tris } (scaled, decimated to maxTris). */
export async function gzLoadMeshes(world, { resolve, maxTris = 3000, maxRobotTris = 600 } = {}) {
  const { parseMesh, prepareMesh, meshExt } = await import("./gz-mesh.js");
  const raw = new Map();
  const load = async (geom, cap) => {
    if (!geom || geom.type !== "mesh" || geom.mesh || !geom.path || !resolve) return;
    const key = geom.path;
    if (!raw.has(key)) raw.set(key, (async () => { try { const f = await resolve(key); if (!f) return null; return parseMesh(f.bytes || f.text, meshExt(key)); } catch (e) { return { error: e.message }; } })());
    const m = await raw.get(key);
    if (!m || m.error) { geom.meshError = m ? m.error : `Unable to find file [${key}]`; return; }
    geom.mesh = prepareMesh(m, geom.scale || [1, 1, 1], cap);
  };
  const jobs = [];
  for (const m of world.models || []) for (const s of [...(m.colShapes || []), ...(m.shapes || [])]) jobs.push(load(s, maxTris));
  for (const r of world.robots || []) for (const l of Object.values(r.model ? r.model.links : {})) for (const c of l.collisions || []) jobs.push(load(c.geom, maxRobotTris));
  await Promise.all(jobs);
  return world;
}

export const _internal = { Ctx, readModel, fuelName, bestModelFile, FUEL };
