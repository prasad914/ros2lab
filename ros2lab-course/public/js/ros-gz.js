// Gazebo Harmonic + ros_gz for the practice ROS 2 graph (no 3D here: gz-sim.js renders and senses in the browser).
// What it follows (gazebosim.org/docs/harmonic/ros2_integration, ros_gz README, ros_gz_sim create.cpp):
//   gz sim [-r] [-s] [-v N] world.sdf          the simulator (not a ROS node), paused until -r or the play button
//   ros2 run ros_gz_sim create -topic robot_description -name my_robot -z 0.1    spawns the URDF and exits
//   ros2 run ros_gz_bridge parameter_bridge /scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan   (or -p config_file:=...)
//   ROS only sees a Gazebo topic once a bridge maps it; frame_id comes from <gz_frame_id> (else model/link/sensor)
import { urdfGazebo, sensorTopics, sensorFrame, BUILTIN_WORLDS, parseWorld, worldHas, parseBridgeArg, parseBridgeYaml, BRIDGE_TYPES } from "./gz-sdf.js";
import { parseURDF, qRPY } from "./urdf-core.js";

const HOME = "/home/student";
const slash = (t) => (t ? (t.startsWith("/") ? t : "/" + t) : t);
const f6 = (x) => (Number.isInteger(x) ? `${x}.0` : String(+Number(x).toFixed(6)));
const ROS_FROM_GZ = Object.fromEntries(Object.entries(BRIDGE_TYPES).map(([r, g]) => [g, r]));

export const GZ_EXES = { "ros_gz_sim create": "gz_create", "ros_gz_bridge parameter_bridge": "gz_bridge", "ros_gz_image image_bridge": "gz_image", "teleop_twist_keyboard teleop_twist_keyboard": "teleop_twist" };
export const GZ_NAMES = { gz_create: "ros_gz_sim", gz_bridge: "ros_gz_bridge", gz_image: "image_bridge", teleop_twist: "teleop_twist_keyboard", gz_sim: "gz_sim" };
export const GZ_PKG_EXES = { ros_gz_sim: ["create", "gzserver", "remove"], ros_gz_bridge: ["parameter_bridge", "static_bridge"], ros_gz_image: ["image_bridge"], teleop_twist_keyboard: ["teleop_twist_keyboard"] };
export const TELEOP_BANNER = `This node takes keypresses from the keyboard and publishes them
as Twist/TwistStamped messages. It works best with a US keyboard layout.
---------------------------
Moving around:
   u    i    o
   j    k    l
   m    ,    .

For Holonomic mode (strafing), hold down the shift key:
---------------------------
   U    I    O
   J    K    L
   M    <    >

t : up (+z)
b : down (-z)

anything else : stop

q/z : increase/decrease max speeds by 10%
w/x : increase/decrease only linear speed by 10%
e/c : increase/decrease only angular speed by 10%

CTRL-C to quit

currently:\tspeed 0.5\tturn 1.0 `;
// teleop_twist_keyboard moveBindings (x, th)
export const TELEOP_KEYS = { i: [1, 0], o: [1, -1], j: [0, 1], l: [0, -1], u: [1, 1], ",": [-1, 0], ".": [-1, 1], m: [-1, -1], k: [0, 0] };

export const gzMethods = {
  // ---------------- files: $FINDSHARE:pkg/dir/file, absolute paths, Gazebo's own example worlds ----------------
  shareText(path) {
    const sh = this.sh, s = String(path || "");
    const m = s.match(/^\$FINDSHARE:([\w-]+)\/([\w-]+)\/(.+)$/) || s.match(new RegExp(`^${HOME}/ros2_ws/install/([\\w-]+)/share/[\\w-]+/([\\w-]+)/(.+)$`));
    if (m) { const pk = sh.wsPkgs && sh.wsPkgs.get(m[1]); return pk && pk[m[2]] ? pk[m[2]][m[3]] : undefined; }
    const n = sh.node(sh.abs(s)); return n && n.type === "f" ? n.content || "" : undefined;
  },
  sharePath(path) { return String(path || "").replace(/^\$FINDSHARE:([\w-]+)/, `${HOME}/ros2_ws/install/$1/share/$1`); },

  // ---------------- gz sim ----------------
  gzSim(argv, { tag } = {}) {
    const a = argv.map(String);
    let verbose = 1, run = false, serverOnly = false, file = null;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (x === "-r") run = true; else if (x === "-s") serverOnly = true; else if (x === "-g") continue;
      else if (x === "-v" || x === "--verbose") verbose = Number(a[++i]) || 1; else if (/^-v\d$/.test(x)) verbose = Number(x.slice(2));
      else if (x === "--render-engine" || x === "--physics-engine" || x === "--iterations" || x === "-z") i++;
      else if (!x.startsWith("-")) file = x;
    }
    file = file || "empty.sdf";
    const P = (t) => (tag ? `[${tag}] ${t}` : t);
    const base = file.split("/").pop();
    let world;
    if (!file.includes("/") && BUILTIN_WORLDS[base]) world = BUILTIN_WORLDS[base]();
    else {
      const text = this.shareText(file);
      if (text === undefined) return { err: [P(`[Err] [Server.cc:182] Unable to find or download file`), P(`[Err] [Server.cc:...] Failed to load SDF file [${this.sharePath(file)}]`)] };
      world = parseWorld(text);
      if (world.error) return { err: [P(`[Err] [Server.cc:...] Error Code 13: Msg: ${world.error} in [${this.sharePath(file)}]`)] };
    }
    const n = this.add("gz_sim", "gz_sim", "", {});
    n.hidden = true;
    this.gz = { world, file: this.sharePath(file), paused: !run, time: 0, models: new Map(), gui: !serverOnly, node: n.full, verbose, version: 1 };
    const L = [];
    if (verbose >= 3) {
      L.push(`[Msg] Gazebo Sim Server v8.9.0`, `[Msg] Loading SDF world file[${this.gz.file.startsWith("/") ? this.gz.file : `/usr/share/gz/gz-sim8/worlds/${base}`}].`, `[Msg] Serving entity system service on [/entity/system/add]`,
        `[Msg] Create service on [/world/${world.name}/create]`, `[Msg] Remove service on [/world/${world.name}/remove]`, `[Msg] Pose service on [/world/${world.name}/set_pose]`, `[Msg] Loaded level [3]`, `[Msg] Serving world controls on [/world/${world.name}/control], [/world/${world.name}/control/state] and [/world/${world.name}/playback/control]`,
        `[Msg] Serving GUI information on [/world/${world.name}/gui/info]`, `[Msg] World [${world.name}] initialized with [default_physics] physics profile.`, `[Msg] Serving world SDF generation service on [/world/${world.name}/generate_world_sdf]`);
      if (!serverOnly) L.push(`[GUI] [Msg] Gazebo Sim GUI    v8.9.0`, `[GUI] [Msg] Loading config [/home/student/.gz/sim/8/gui.config]`, `[GUI] [Msg] Requesting world names...`, `[GUI] [Msg] Loaded plugin [EntityTree] from path [/usr/lib/x86_64-linux-gnu/gz-gui-8/plugins/libEntityTree.so]`);
    }
    for (const m of world.models.filter((x) => x.missing)) L.push(`[Err] [SystemPaths.cc:...] Unable to find file with URI [${m.missing}]`);
    return { lines: L.map(P), node: n };
  },
  gzRunning() { return !!(this.gz && this.node(this.gz.node)); },

  // ---------------- ros_gz_sim create ----------------
  gzCreate(argv, { tag, pid } = {}) {
    const a = argv.map(String), opt = {};
    for (let i = 0; i < a.length; i++) if (/^-\w+$/.test(a[i]) && i + 1 < a.length && !/^-[a-zA-Z]/.test(a[i + 1])) opt[a[i].slice(1)] = a[++i]; else if (/^-\w+$/.test(a[i])) opt[a[i].slice(1)] = "";
    const now = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
    const I = (t) => `${tag ? `[${tag}] ` : ""}[INFO] [${now()}] [ros_gz_sim]: ${t}`, E = (t) => `${tag ? `[${tag}] ` : ""}[ERROR] [${now()}] [ros_gz_sim]: ${t}`;
    const out = [I("Requesting list of world names.")];
    if (!this.gzRunning()) return { lines: [...out, E("Timed out when getting world names.")], fail: true, hint: "No Gazebo is running. Start it first (gz sim -r empty.sdf, or include gz_sim.launch.py in your launch file)." };
    if (opt.world && opt.world !== this.gz.world.name) return { lines: [...out, E(`World [${opt.world}] not found. Available world: [${this.gz.world.name}]`)], fail: true };
    let urdf = null;
    if ("topic" in opt) {
      const topic = slash(opt.topic || "robot_description");
      out.push(I(`Waiting messages on topic [${opt.topic}].`));
      const rsp = this.nodes.find((n) => n.kind === "rsp" && `${n.ns}/robot_description` === topic && n.params.robot_description);
      if (!rsp) return { lines: out, fail: true, waiting: true, hint: `Nobody publishes ${topic} yet, so create keeps waiting. Start robot_state_publisher with the robot's URDF first.` };
      urdf = String(rsp.params.robot_description);
    } else if ("file" in opt) { urdf = this.shareText(opt.file); if (urdf === undefined) return { lines: [...out, E(`Unable to read file: [${opt.file}]`)], fail: true }; }
    else if ("string" in opt) urdf = opt.string;
    else return { lines: [...out, E("Must specify either -file, -param, -string or -topic")], fail: true };
    let model; try { model = parseURDF(urdf); } catch (e) { return { lines: [...out, E("Entity creation failed.")], fail: true, gzErr: [`[Err] [UserCommands.cc:...] Failed to parse URDF: ${e.message}`] }; }
    const gz = urdfGazebo(urdf), name = opt.name || model.name;
    const gzLines = [];
    if (this.gz.models.has(name)) { gzLines.push(`[Err] [UserCommands.cc:1145] Entity named [${name}] already exists. Use 'allow_renaming' to rename the new entity.`); return { lines: [...out, E("Entity creation failed.")], fail: true, gzErr: gzLines }; }
    const num = (k) => Number(opt[k]) || 0;
    const pose = { x: num("x"), y: num("y"), z: num("z"), roll: num("R"), pitch: num("P"), yaw: num("Y") };
    const m = { name, urdf, model, gazebo: gz, pose: { ...pose }, start: { ...pose }, cmd: { vx: 0, wz: 0 }, joints: {} };
    for (const j of Object.values(model.joints)) if (!["fixed", "floating", "planar"].includes(j.type) && !j.mimic) m.joints[j.name] = 0;
    m.targets = {};
    for (const p of gz.plugins) if (p.kind === "joint_position" && p.joint in m.joints) { m.joints[p.joint] = p.initial; m.targets[p.joint] = p.initial; }
    this.gz.models.set(name, m); this.gz.version++;
    gzLines.push(...gz.warnings);
    if (!worldHas(this.gz.world, "sensors-system") && gz.sensors.some((s) => /camera|lidar|gpu|depth|rgbd/.test(s.type))) gzLines.push(...(this.gz.verbose >= 2 ? [`[Wrn] [...] The world has no gz-sim-sensors-system plugin: camera and lidar sensors of [${name}] will not publish.`] : []));
    const rc = this.cmAttach(m);   // gz_ros2_control: a controller_manager starts inside Gazebo
    if (rc) gzLines.push(...rc.err);
    return { lines: [...out, I("Entity creation successful.")], model: m, gzErr: gzLines, gzInfo: rc ? rc.out : null, cmHint: rc ? rc.hint : null };
  },

  // ---------------- ros_gz_bridge ----------------
  bridgeEntries(args, params) {
    const L = [], entries = [], bad = [];
    for (const x of args) { if (String(x).startsWith("-")) continue; const e = parseBridgeArg(x); if (e) entries.push(e); else if (/@/.test(x)) bad.push(x); }
    if (params && params.config_file) {
      const text = this.shareText(params.config_file);
      if (text === undefined) return { err: `[ERROR] [ros_gz_bridge]: Could not parse config file [${this.sharePath(params.config_file)}]: bad file: ${this.sharePath(params.config_file)}` };
      entries.push(...parseBridgeYaml(text));
    }
    return { entries, bad, L };
  },
  bridgeLines(n, tag) {
    const now = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
    const P = (lvl, t) => `${tag ? `[${tag}] ` : ""}[${lvl}] [${now()}] [${n.name}]: ${t}`;
    const L = [];
    for (const x of n.bridgeBad || []) L.push(P("ERROR", `Failed to parse argument [${x}]. Expected <topic>@<ros_type>[<gz_type> (or ] or @)`));
    for (const e of n.bridge) {
      if (BRIDGE_TYPES[e.rosType] !== e.gzType) { L.push(P("ERROR", `Failed to create a bridge for topic [${e.ros}] with ROS2 type [${e.rosType}] to topic [${e.gz}] with Gazebo Transport type [${e.gzType}]`)); e.broken = true; continue; }
      if (e.dir !== "ROS_TO_GZ") L.push(P("INFO", `Creating GZ->ROS Bridge: [${e.gz} (${e.gzType}) -> ${e.ros} (${e.rosType})] (Lazy 0)`));
      if (e.dir !== "GZ_TO_ROS") L.push(P("INFO", `Creating ROS->GZ Bridge: [${e.ros} (${e.rosType}) -> ${e.gz} (${e.gzType})] (Lazy 0)`));
    }
    if (!n.bridge.length && !(n.bridgeBad || []).length) L.push(P("WARN", "No bridges were created: give topics as arguments (/scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan) or -p config_file:=bridge.yaml"));
    return L;
  },
  bridges() {   // every working bridge entry, its ROS topic resolved through the node's remappings
    return this.nodes.filter((n) => n.kind === "gz_bridge" || n.kind === "gz_image").flatMap((n) => (n.bridge || []).filter((e) => !e.broken).map((e) => {
      const res = (x) => (x.startsWith("/") ? x : `${n.ns}/${x}`), r = (n.remaps || []).find(([f]) => res(f) === e.ros);
      return r ? { ...e, ros: res(r[1]) } : e;
    }));
  },

  // ---------------- what Gazebo publishes, and what ROS gets through the bridges ----------------
  gzTopicList() {
    if (!this.gzRunning()) return [];
    const w = this.gz.world.name, out = [{ topic: "/clock", type: "gz.msgs.Clock", kind: "clock" }, { topic: "/stats", type: "gz.msgs.WorldStatistics" }, { topic: `/world/${w}/clock`, type: "gz.msgs.Clock", kind: "clock" },
      { topic: `/world/${w}/stats`, type: "gz.msgs.WorldStatistics" }, { topic: `/world/${w}/pose/info`, type: "gz.msgs.Pose_V" }, { topic: `/world/${w}/scene/info`, type: "gz.msgs.Scene" }, { topic: "/gazebo/resource_paths", type: "gz.msgs.StringMsg_V" }];
    for (const m of this.gz.models.values()) {
      for (const sen of m.gazebo.sensors) {
        const can = sen.type === "imu" ? worldHas(this.gz.world, "imu-system") : ["gpu_lidar", "gpu_ray", "camera", "depth_camera", "depth", "rgbd_camera", "rgbd"].includes(sen.type) && worldHas(this.gz.world, "sensors-system");
        if (!can) continue;
        for (const [topic, type, kind] of sensorTopics(sen, w, m.name)) out.push({ topic, type, kind, model: m.name, sensor: sen, frame: sensorFrame(sen, m.name), rate: sen.rate || 0 });
      }
      for (const p of m.gazebo.plugins) {
        if (p.kind === "diff_drive") out.push({ topic: slash(p.odomTopic) || `/model/${m.name}/odometry`, type: "gz.msgs.Odometry", kind: "odom", model: m.name, plugin: p, rate: p.odomRate || 50 },
          { topic: slash(p.tfTopic) || `/model/${m.name}/tf`, type: "gz.msgs.Pose_V", kind: "tf", model: m.name, plugin: p, rate: p.odomRate || 50 },
          { topic: slash(p.topic) || `/model/${m.name}/cmd_vel`, type: "gz.msgs.Twist", kind: "cmd_vel", model: m.name, plugin: p, sub: true });
        if (p.kind === "mecanum" || p.kind === "ackermann") out.push({ topic: slash(p.odomTopic) || `/model/${m.name}/odometry`, type: "gz.msgs.Odometry", kind: "odom", model: m.name, plugin: p, rate: p.odomRate || 50 },
          { topic: slash(p.tfTopic) || `/model/${m.name}/tf`, type: "gz.msgs.Pose_V", kind: "tf", model: m.name, plugin: p, rate: p.odomRate || 50 },
          { topic: slash(p.topic) || `/model/${m.name}/cmd_vel`, type: "gz.msgs.Twist", kind: "cmd_vel", model: m.name, plugin: p, sub: true });
        if (p.kind === "velocity_control") out.push({ topic: slash(p.topic) || `/model/${m.name}/cmd_vel`, type: "gz.msgs.Twist", kind: "cmd_vel", model: m.name, plugin: p, sub: true });
        if (p.kind === "odometry_publisher") out.push({ topic: slash(p.odomTopic) || `/model/${m.name}/odometry`, type: "gz.msgs.Odometry", kind: "odom", model: m.name, plugin: p, rate: p.odomRate || 50 },
          { topic: slash(p.tfTopic) || `/model/${m.name}/pose`, type: "gz.msgs.Pose_V", kind: "tf", model: m.name, plugin: p, rate: p.odomRate || 50 });
        if (p.kind === "joint_position") out.push({ topic: slash(p.topic) || `/model/${m.name}/joint/${p.joint}/0/cmd_pos`, type: "gz.msgs.Double", kind: "cmd_pos", model: m.name, plugin: p, sub: true });
        if (p.kind === "joint_states") out.push({ topic: slash(p.topic) || `/world/${w}/model/${m.name}/joint_state`, type: "gz.msgs.Model", kind: "joints", model: m.name, rate: 50 });
      }
    }
    return out;
  },
  // ROS topic -> { rosType, src (gz topic entry) } for every working GZ->ROS bridge
  gzFeeds() {
    const G = new Map(this.gzTopicList().filter((t) => !t.sub).map((t) => [t.topic, t])), out = new Map();
    for (const e of this.bridges()) { if (e.dir === "ROS_TO_GZ") continue; const src = G.get(e.gz); if (src && src.type === e.gzType) out.set(e.ros, { rosType: e.rosType, src }); }
    return out;
  },
  gzModel(name) { return this.gz && this.gz.models.get(name); },
  // a Twist published on ROS: every ROS->GZ bridge carries it to Gazebo; a DiffDrive listening there drives
  gzTwist(topic, v) {
    if (!this.gzRunning()) return [];
    const hit = [];
    for (const e of this.bridges()) {
      if (e.dir === "GZ_TO_ROS" || e.ros !== topic || e.rosType !== "geometry_msgs/msg/Twist") continue;
      for (const t of this.gzTopicList()) if (t.kind === "cmd_vel" && t.topic === e.gz) { const m = this.gzModel(t.model); m.cmd = { vx: v.lx, vy: v.ly || 0, vz: v.lz || 0, wz: v.az }; hit.push(m.name); }
    }
    return hit;
  },
  // a Float64 published on ROS: a ROS->GZ bridge carries it to a JointPositionController's topic
  gzFloat(topic, value) {
    if (!this.gzRunning()) return [];
    const hit = [];
    for (const e of this.bridges()) {
      if (e.dir === "GZ_TO_ROS" || e.ros !== topic || e.rosType !== "std_msgs/msg/Float64") continue;
      for (const t of this.gzTopicList()) if (t.kind === "cmd_pos" && t.topic === e.gz) { const m = this.gzModel(t.model), j = m.model.joints[t.plugin.joint]; let v = Number(value); if (j && j.limit && j.type === "revolute") v = Math.min(j.limit.upper, Math.max(j.limit.lower, v)); m.targets[t.plugin.joint] = v; hit.push(`${t.plugin.joint} of ${m.name}`); }
    }
    return hit;
  },
  gzStep(dt) {
    if (!this.gzRunning() || this.gz.paused) return false;
    this.gz.time += dt;
    for (const m of this.gz.models.values()) {
      for (const [j, goal] of Object.entries(m.targets || {})) { const d = goal - m.joints[j], stepMax = 1.2 * dt; m.joints[j] += Math.abs(d) < stepMax ? d : Math.sign(d) * stepMax; }   // the PID moves the joint to the goal (about 1.2 rad/s here)
      if (m.cm) { this.cmStep(m, dt); continue; }   // ros2_control: the controllers command the joints
      const dd = m.gazebo.plugins.find((p) => p.kind === "diff_drive"), vc = m.gazebo.plugins.find((p) => p.kind === "velocity_control"), mc = m.gazebo.plugins.find((p) => p.kind === "mecanum"), ak = m.gazebo.plugins.find((p) => p.kind === "ackermann");
      if (!dd && !vc && !mc && !ak) continue;
      let { vx = 0, vy = 0, vz = 0, wz = 0 } = m.cmd;
      if (dd || ak) { vy = 0; vz = 0; }   // wheels cannot strafe or fly
      if (mc) vz = 0;
      const flying = !!(vc && vc.flying);
      if (vc && !flying) vz = 0;
      if (ak) { const steer = Math.atan2(wz * ak.wheelbase, Math.abs(vx) > 1e-6 ? vx : 1e-6), lim = ak.steerLimit || 0.6; const st = Math.max(-lim, Math.min(lim, steer)); wz = Math.abs(vx) > 1e-6 ? (vx * Math.tan(st)) / ak.wheelbase : 0; for (const j of [ak.leftSteer, ak.rightSteer]) if (j in m.joints) m.joints[j] = st; }
      if (!vx && !vy && !vz && !wz) continue;
      const yaw = m.pose.yaw + wz * dt, nx = m.pose.x + (vx * Math.cos(yaw) - vy * Math.sin(yaw)) * dt, ny = m.pose.y + (vx * Math.sin(yaw) + vy * Math.cos(yaw)) * dt;
      // the world's static objects stop the robot (Gazebo's physics would: no driving through walls and boxes)
      const blocked = this.gzBlocked(m, nx, ny, m.pose.z + vz * dt);
      m.pose.yaw = yaw;
      if (!blocked) { m.pose.x = nx; m.pose.y = ny; m.pose.z = Math.max(flying ? 0.02 : m.pose.z, m.pose.z + vz * dt); }
      m.bumped = blocked;
      const wheel = (j, v, r) => { if (j in m.joints) m.joints[j] += (v / r) * dt; };
      if (dd && !blocked) { for (const j of dd.left) wheel(j, vx - (wz * dd.separation) / 2, dd.radius); for (const j of dd.right) wheel(j, vx + (wz * dd.separation) / 2, dd.radius); }
      if (mc && !blocked) { const k = (mc.separation + mc.wheelbase) / 2; wheel(mc.fl, vx - vy - k * wz, mc.radius); wheel(mc.fr, vx + vy + k * wz, mc.radius); wheel(mc.rl, vx + vy - k * wz, mc.radius); wheel(mc.rr, vx - vy + k * wz, mc.radius); }
      if (ak && !blocked) { for (const j of ak.wheels) wheel(j, vx, ak.radius); }
      if (flying) for (const j of (vc.spin = vc.spin || Object.keys(m.joints).filter((n) => /prop|rotor/i.test(n)))) m.joints[j] += 60 * dt;   // propellers spin while it flies
    }
    return true;
  },
  gzOdom(m) {   // DiffDrive odometry: relative to where the robot was spawned
    const c = Math.cos(-m.start.yaw), s = Math.sin(-m.start.yaw), dx = m.pose.x - m.start.x, dy = m.pose.y - m.start.y;
    const flying = m.gazebo.plugins.some((p) => p.kind === "odometry_publisher" && p.dims === 3);
    return { x: c * dx - s * dy, y: s * dx + c * dy, z: flying ? m.pose.z - m.start.z : 0, yaw: m.pose.yaw - m.start.yaw, vx: m.bumped ? 0 : m.cmd.vx, vy: m.bumped ? 0 : m.cmd.vy || 0, wz: m.cmd.wz };
  },
  // would the robot's footprint (a circle around its base, at its height) hit a static world object at (x, y, z)?
  gzBlocked(m, x, y, z) {
    if (!m.footprint) {
      let r = 0.1, top = 0.3;
      try { for (const l of Object.values(m.model.links)) for (const c of [...l.collisions, ...l.visuals]) { const g = c.geom, o = c.origin.xyz; const e = g.type === "box" ? Math.hypot(g.size[0], g.size[1]) / 2 : g.type === "cylinder" || g.type === "sphere" ? g.radius : 0.05; r = Math.max(r, Math.min(1.2, Math.hypot(o[0], o[1]) + e)); top = Math.max(top, o[2] + (g.type === "box" ? g.size[2] / 2 : g.type === "cylinder" ? g.length / 2 : 0.1)); } } catch { /* keep the default */ }
      for (const j of Object.values(m.model.joints)) r = Math.max(r, Math.min(1.2, Math.hypot(j.origin.xyz[0], j.origin.xyz[1]) * 0.9));
      m.footprint = { r: Math.min(r, 0.9) * 0.85, top };
    }
    const F = m.footprint, zlo = z, zhi = z + F.top;
    for (const w of this.gz.world.models) {
      if (!w.static || /ground/i.test(w.name)) continue;
      for (const sh of w.shapes || []) {
        if (sh.type === "plane") continue;
        const p = w.pose || [0, 0, 0, 0, 0, 0], lp = sh.linkPose || [0, 0, 0, 0, 0, 0], sp = sh.pose || [0, 0, 0, 0, 0, 0];
        const cx = p[0] + lp[0] + sp[0], cy = p[1] + lp[1] + sp[1], cz = p[2] + lp[2] + sp[2], yaw = (p[5] || 0) + (lp[5] || 0) + (sp[5] || 0);
        const hz = sh.type === "box" ? sh.size[2] / 2 : sh.type === "cylinder" ? sh.length / 2 : sh.radius;
        if (cz + hz < zlo + 0.02 || cz - hz > zhi) continue;   // above or below the robot
        const dx = x - cx, dy = y - cy;
        if (sh.type === "box") { const c = Math.cos(-yaw), s = Math.sin(-yaw), lx = c * dx - s * dy, ly = s * dx + c * dy; const qx = Math.max(Math.abs(lx) - sh.size[0] / 2, 0), qy = Math.max(Math.abs(ly) - sh.size[1] / 2, 0); if (Math.hypot(qx, qy) < F.r) return w.name; }
        else if (Math.hypot(dx, dy) < (sh.radius || 0) + F.r) return w.name;
      }
    }
    return null;
  },
  // TF edges arriving on ROS /tf from bridged DiffDrive tf topics
  gzTfEdges() {
    const E = [];
    for (const [ros, f] of this.gzFeeds()) {
      if (f.src.kind !== "tf" || !/^\/?tf$/.test(ros.replace(/^\//, "")) && ros !== "/tf") continue;
      const m = this.gzModel(f.src.model), p = f.src.plugin, o = this.gzOdom(m);
      E.push({ parent: p.frame || `${m.name}/odom`, child: p.child || `${m.name}/${m.model.root}`, t: [o.x, o.y, o.z || 0], q: qRPY(0, 0, o.yaw), gz: true });
    }
    return E;
  },
  // joint positions arriving on /joint_states from Gazebo's JointStatePublisher system
  gzJoints() {
    for (const [ros, f] of this.gzFeeds()) if (f.src.kind === "joints" && /joint_states$/.test(ros)) { const m = this.gzModel(f.src.model); return { ...m.joints }; }
    return this.cmJoints();
  },
  gzRate(ros) { const f = this.gzFeeds().get(ros); return f ? f.src.rate || (f.src.kind === "clock" ? 1000 : 0) : null; },

  // ---------------- ros2 topic echo of a bridged topic ----------------
  gzSample(ros) {
    const f = this.gzFeeds().get(ros); if (!f) return null;
    const s = f.src, t = this.gz.time, sec = Math.floor(t), nsec = Math.round((t - sec) * 1e9);
    const stamp = `header:\n  stamp:\n    sec: ${sec}\n    nanosec: ${nsec}\n  frame_id: ${s.kind === "odom" ? (s.plugin.frame || `${s.model}/odom`) : s.kind === "joints" ? "" : s.frame}`;
    const arr = (a) => { const v = a.slice(0, 128).map((x) => `- ${Number.isFinite(x) ? f6(x) : x > 0 ? ".inf" : "-.inf"}`); if (a.length > 128) v.push("- '...'"); return v.join("\n"); };
    if (s.sensor && this.gz.paused) return null;   // a paused simulation renders no sensor data: echo just waits
    const probe = this.sh.gzProbe ? this.sh.gzProbe(s) : null;
    const m = s.model ? this.gzModel(s.model) : null;
    if (s.kind === "clock") return [`clock:\n  sec: ${sec}\n  nanosec: ${nsec}`];
    if (s.kind === "scan") {
      const L = s.sensor.lidar, n = Math.max(1, L.hSamples), inc = probe && probe.angle_increment !== undefined ? probe.angle_increment : n > 1 ? (L.hMax - L.hMin) / (n - 1) : 0;
      const ranges = probe && probe.ranges ? probe.ranges : Array(n).fill(Infinity);
      return [`${stamp}\nangle_min: ${f6(L.hMin)}\nangle_max: ${f6(L.hMax)}\nangle_increment: ${f6(inc)}\ntime_increment: 0.0\nscan_time: 0.0\nrange_min: ${f6(L.min)}\nrange_max: ${f6(L.max)}\nranges:\n${arr(ranges)}\nintensities:\n${arr(ranges.map(() => 0))}`];
    }
    if (s.kind === "imu") {
      const d = probe || { orientation: [0, 0, 0, 1], angular_velocity: [0, 0, 0], linear_acceleration: [0, 0, 9.8] };
      const v3 = (k, a) => `${k}:\n  x: ${f6(a[0])}\n  y: ${f6(a[1])}\n  z: ${f6(a[2])}`, cov = "\n" + Array(9).fill("- 0.0").join("\n");
      return [`${stamp}\norientation:\n  x: ${f6(d.orientation[0])}\n  y: ${f6(d.orientation[1])}\n  z: ${f6(d.orientation[2])}\n  w: ${f6(d.orientation[3])}\norientation_covariance:${cov}\n${v3("angular_velocity", d.angular_velocity)}\nangular_velocity_covariance:${cov}\n${v3("linear_acceleration", d.linear_acceleration)}\nlinear_acceleration_covariance:${cov}`];
    }
    if (s.kind === "odom") {
      const o = this.gzOdom(m), q = qRPY(0, 0, o.yaw);
      return [`${stamp}\nchild_frame_id: ${s.plugin.child || `${m.name}/${m.model.root}`}\npose:\n  pose:\n    position:\n      x: ${f6(o.x)}\n      y: ${f6(o.y)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${f6(q[2])}\n      w: ${f6(q[3])}\n  covariance:\n${Array(36).fill("  - 0.0").join("\n")}\ntwist:\n  twist:\n    linear:\n      x: ${f6(o.vx)}\n      y: 0.0\n      z: 0.0\n    angular:\n      x: 0.0\n      y: 0.0\n      z: ${f6(o.wz)}\n  covariance:\n${Array(36).fill("  - 0.0").join("\n")}`];
    }
    if (s.kind === "tf") { const e = this.gzTfEdges()[0]; if (!e) return null; return [`transforms:\n- header:\n    stamp:\n      sec: ${sec}\n      nanosec: ${nsec}\n    frame_id: ${e.parent}\n  child_frame_id: ${e.child}\n  transform:\n    translation:\n      x: ${f6(e.t[0])}\n      y: ${f6(e.t[1])}\n      z: 0.0\n    rotation:\n      x: 0.0\n      y: 0.0\n      z: ${f6(e.q[2])}\n      w: ${f6(e.q[3])}`]; }
    if (s.kind === "joints") { const J = m.joints, k = Object.keys(J); return [`${stamp}\nname:\n${k.map((x) => `- ${x}`).join("\n")}\nposition:\n${arr(k.map((x) => J[x]))}\nvelocity:\n${arr(k.map(() => 0))}\neffort:\n${arr(k.map(() => 0))}`]; }
    if (s.kind === "info") { const C = s.sensor.camera, fx = C.width / 2 / Math.tan(C.hfov / 2); return [`${stamp.replace(/frame_id: .*/, `frame_id: ${s.sensor.optical || s.frame}`)}\nheight: ${C.height}\nwidth: ${C.width}\ndistortion_model: plumb_bob\nd:\n- 0.0\n- 0.0\n- 0.0\n- 0.0\n- 0.0\nk:\n- ${f6(fx)}\n- 0.0\n- ${f6(C.width / 2)}\n- 0.0\n- ${f6(fx)}\n- ${f6(C.height / 2)}\n- 0.0\n- 0.0\n- 1.0\nr:\n- 1.0\n- 0.0\n- 0.0\n- 0.0\n- 1.0\n- 0.0\n- 0.0\n- 0.0\n- 1.0\np:\n- ${f6(fx)}\n- 0.0\n- ${f6(C.width / 2)}\n- -0.0\n- 0.0\n- ${f6(fx)}\n- ${f6(C.height / 2)}\n- 0.0\n- 0.0\n- 0.0\n- 1.0\n- 0.0\nbinning_x: 0\nbinning_y: 0\nroi:\n  x_offset: 0\n  y_offset: 0\n  height: 0\n  width: 0\n  do_rectify: false`]; }
    if (s.kind === "image" || s.kind === "depth") {
      const C = s.sensor.camera, depth = s.kind === "depth", px = probe && probe.bytes ? probe.bytes : [];
      return [`${stamp.replace(/frame_id: .*/, `frame_id: ${s.sensor.optical || s.frame}`)}\nheight: ${C.height}\nwidth: ${C.width}\nencoding: ${depth ? "32FC1" : "rgb8"}\nis_bigendian: 0\nstep: ${C.width * (depth ? 4 : 3)}\ndata:\n${px.slice(0, 128).map((x) => `- ${x}`).join("\n") || "- 0"}\n- '...'`];
    }
    if (s.kind === "points") { const n = probe && probe.count != null ? probe.count : 0; return [`${stamp}\nheight: 1\nwidth: ${n}\nfields:\n- name: x\n  offset: 0\n  datatype: 7\n  count: 1\n- name: y\n  offset: 4\n  datatype: 7\n  count: 1\n- name: z\n  offset: 8\n  datatype: 7\n  count: 1\n- name: intensity\n  offset: 16\n  datatype: 7\n  count: 1\n- name: ring\n  offset: 20\n  datatype: 4\n  count: 1\nis_bigendian: false\npoint_step: 32\nrow_step: ${n * 32}\ndata:\n- 0\n- '...'\nis_dense: false`]; }
    return null;
  },

  // ---------------- the gz command line ----------------
  gzCli(plain) {
    const [sub, ...rest] = plain;
    if (sub === "topic") {
      if (!this.gzRunning()) return { lines: [this.hint("(No Gazebo is running, so there are no Gazebo topics. Start one: gz sim -r empty.sdf)")] };
      const T = this.gzTopicList(), ti = rest.indexOf("-t"), topic = ti >= 0 ? rest[ti + 1] : null;
      if (rest.includes("-l")) return { lines: [...new Set(T.map((t) => t.topic))].sort().map((t) => this.out(t)) };
      if (rest.includes("-i")) { const t = T.find((x) => x.topic === topic); return { lines: t ? [this.out("Publishers [Address, Message Type]:"), this.out(`  tcp://172.17.0.2:39245, ${t.type}`)] : [this.out("No publishers on topic [" + (topic || "") + "]")] }; }
      if (rest.includes("-e")) {
        const t = T.find((x) => x.topic === topic);
        if (!t) return { lines: [this.hint(`(Nothing is published on ${topic || "?"} in Gazebo, so echo just waits. List the topics with: gz topic -l)`)] };
        if (this.gz.paused) return { lines: [this.hint("(The simulation is paused, so sensors do not publish. Press ▶ in the Gazebo window, or start Gazebo with -r.)")] };
        const ros = ROS_FROM_GZ[t.type];
        return { lines: [this.out(`header {\n  stamp {\n    sec: ${Math.floor(this.gz.time)}\n    nsec: ${Math.round((this.gz.time % 1) * 1e9)}\n  }\n  data {\n    key: "frame_id"\n    value: "${t.frame || ""}"\n  }\n}`), this.out("..."), this.hint(`(A ${t.type} message. ROS 2 cannot read it until ros_gz_bridge maps it: ${t.topic}@${ros || "<ros_type>"}[${t.type})`)] };
      }
      return { lines: [this.err("usage: gz topic -l | -i -t <topic> | -e -t <topic>")] };
    }
    if (sub === "sim") return null;   // started by the terminal (it keeps the terminal busy)
    if (sub === "service" && rest.includes("-l")) return { lines: this.gzRunning() ? [`/world/${this.gz.world.name}/control`, `/world/${this.gz.world.name}/create`, `/world/${this.gz.world.name}/remove`, `/world/${this.gz.world.name}/set_pose`, "/gazebo/worlds"].map((t) => this.out(t)) : [] };
    if (sub === "model" && rest.includes("--list")) return { lines: this.gzRunning() ? [this.out(""), this.out(`Requesting state for world [${this.gz.world.name}]...`), this.out(""), this.out("Available models:"), ...this.gz.world.models.concat([...this.gz.models.values()]).map((m) => this.out(`    - ${m.name}`))] : [this.err("Timed out waiting for the world names.")] };
    if (!sub || sub === "--help" || sub === "help") return { lines: ["The 'gz' command provides a command line interface to the Gazebo Tools.", "", "  gz <command> [options]", "", "List of available commands:", "", "  help:          Print this help text.", "  sim:           Run and manage the Gazebo Simulator.", "  topic:         Print information about topics.", "  service:       Print information about services.", "  model:         Print information about models."].map((t) => this.out(t)) };
    return { lines: [this.err(`I don't know about command [${sub}].`)] };
  },

  // ---------------- a robot's details: links, joints, sensors, plugins (the RViz page panel) ----------------
  robotDetails(urdf) {
    try {
      const model = parseURDF(urdf), gz = urdfGazebo(urdf);
      const tr = [...String(urdf).matchAll(/<transmission\b[\s\S]*?<\/transmission>/g)].map((m) => ((m[0].match(/<joint\s+name="([^"]+)"/) || [])[1])).filter(Boolean);
      const rc = (String(urdf).match(/<ros2_control\b[\s\S]*?<\/ros2_control>/g) || []).map((b) => ({ name: (b.match(/name="([^"]+)"/) || [])[1], plugin: (b.match(/<plugin>\s*([^<]+?)\s*<\/plugin>/) || [])[1], joints: [...b.matchAll(/<joint\s+name="([^"]+)"[\s\S]*?<\/joint>/g)].map((j) => ({ name: j[1], cmd: [...j[0].matchAll(/<command_interface\s+name="([^"]+)"/g)].map((x) => x[1]), state: [...j[0].matchAll(/<state_interface\s+name="([^"]+)"/g)].map((x) => x[1]) })) }));
      return { model, gz, transmissions: tr, ros2_control: rc };
    } catch (e) { return { error: e.message }; }
  },
};

// readers for the Gazebo parts of launch files (Python and XML)
// IncludeLaunchDescription(... ros_gz_sim ... gz_sim.launch.py ..., launch_arguments={'gz_args': ...}.items())
export const stripPyComments = (text) => String(text).split("\n").map((l) => { let q = null; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === q) q = null; } else if (c === "'" || c === '"') q = c; else if (c === "#") return l.slice(0, i); } return l; }).join("\n");
export function gzIncludePy(text0, vals) {
  const text = stripPyComments(text0);
  // only an IncludeLaunchDescription(...) of ros_gz_sim's gz_sim.launch.py starts Gazebo; gz_args is read inside it
  for (const m of text.matchAll(/IncludeLaunchDescription\s*\(/g)) {
    const open = m.index + m[0].length - 1, body = takeExpr(text, open).slice(1, -1);
    if (!/gz_sim\.launch\.py/.test(body)) continue;
    const a = body.match(/['"]gz_args['"]\s*[:,]\s*/);
    if (!a) return { args: "" };
    return { args: pyEval(takeExpr(body, a.index + a[0].length), text, vals) };
  }
  return null;
}
// the expression starting at i: up to a top-level comma or closing bracket (or, with stopNl, the end of the line);
// starting on an opening bracket, the whole bracketed expression
export function takeExpr(text, i, stopNl = false) {
  let d = 0, j = i, q = null;
  for (; j < text.length; j++) {
    const c = text[j];
    if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if ("([{".includes(c)) d++;
    else if (")]}".includes(c)) { if (d === 0) break; d--; if (d === 0 && "([{".includes(text[i])) { j++; break; } }
    else if (c === "," && d === 0) break;
    else if (c === "\n" && d === 0 && stopNl) break;
  }
  return text.slice(i, j).trim();
}
// a tiny evaluator for the launch-file expressions people write for paths and argument strings
export function pyEval(expr, text, vals, depth = 0) {
  expr = String(expr || "").trim();
  if (depth > 6) return "";
  if (/^-?\d+(\.\d*)?(e-?\d+)?$/i.test(expr) || /^(True|False)$/.test(expr)) return expr === "True" ? "true" : expr === "False" ? "false" : expr;
  if (expr.includes("+")) { const parts = splitTop(expr, "+"); if (parts.length > 1) return parts.map((x) => pyEval(x, text, vals, depth + 1)).join(""); }
  let m;
  if ((m = expr.match(/^f?(['"])([\s\S]*)\1$/))) return m[2].replace(/\{(\w+)\}/g, (_, v) => pyEval(v, text, vals, depth + 1));
  if ((m = expr.match(/^\[([\s\S]*)\]$/))) return splitTop(m[1]).map((x) => pyEval(x, text, vals, depth + 1)).join("");
  if ((m = expr.match(/^(?:os\.path\.join|PathJoinSubstitution)\(\s*\[?([\s\S]*?)\]?\s*\)$/))) return splitTop(m[1]).map((x) => pyEval(x, text, vals, depth + 1)).join("/");
  if ((m = expr.match(/^(?:FindPackageShare|get_package_share_directory)\(\s*(?:package\s*=\s*)?['"]([\w-]+)['"]\s*\)(?:\.find\([^)]*\))?$/))) return `$FINDSHARE:${m[1]}`;
  if ((m = expr.match(/^LaunchConfiguration\(\s*['"]([\w-]+)['"]\s*\)$/))) return vals[m[1]] ?? "";
  if ((m = expr.match(/^TextSubstitution\(\s*text\s*=\s*['"]([^'"]*)['"]\s*\)$/))) return m[1];
  if ((m = expr.match(/^str\(([\s\S]*)\)$/))) return pyEval(m[1], text, vals, depth + 1);
  if (/^\w+$/.test(expr)) {
    const a = text.match(new RegExp(`^[ \\t]*${expr}[ \\t]*=[ \\t]*`, "m"));
    if (a) return pyEval(takeExpr(text, a.index + a[0].length, true), text, vals, depth + 1);
    return vals[expr] ?? "";
  }
  return "";
}
function splitTop(s, sep = ",") {
  const out = []; let d = 0, q = null, cur = "";
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if ("([{".includes(c)) d++; else if (")]}".includes(c)) d--;
    if (c === sep && d === 0) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// Node(...) arguments=[...] with variables and LaunchConfigurations resolved
export function nodeArgsPy(body, text, vals) {
  const i = body.search(/arguments\s*=\s*\[/); if (i < 0) return null;
  const j = body.indexOf("[", i);
  const inner = takeExpr(body, j).replace(/^\[|\]$/g, "");
  return splitTop(inner).map((x) => pyEval(x, text, vals));
}
export function gzIncludeXml(text, sub) {
  const m = text.match(/<include\b[^>]*file="[^"]*gz_sim\.launch\.py"[^>]*?(?:\/>|>([\s\S]*?)<\/include>)/);
  if (!m) return null;
  const a = (m[1] || "").match(/<arg\b[^>]*name="gz_args"[^>]*value="([^"]*)"/);
  return { args: a ? sub(a[1]) : "" };
}
export const gzArgv = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);
