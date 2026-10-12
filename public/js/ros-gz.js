// Gazebo Harmonic + ros_gz for the practice ROS 2 graph (no 3D here: gz-sim.js renders and senses in the browser).
// What it follows (gazebosim.org/docs/harmonic/ros2_integration, ros_gz README, ros_gz_sim create.cpp):
//   gz sim [-r] [-s] [-v N] world.sdf          the simulator (not a ROS node), paused until -r or the play button
//   ros2 run ros_gz_sim create -topic robot_description -name my_robot -z 0.1    spawns the URDF and exits
//   ros2 run ros_gz_bridge parameter_bridge /scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan   (or -p config_file:=...)
//   ROS only sees a Gazebo topic once a bridge maps it; frame_id comes from <gz_frame_id> (else model/link/sensor)
import { urdfGazebo, sensorTopics, sensorFrame, BUILTIN_WORLDS, parseWorld, worldHas, parseBridgeArg, parseBridgeYaml, BRIDGE_TYPES } from "./gz-sdf.js";
import { parseURDF, qRPY, urdfEdges, framePoses, tMul, qRot } from "./urdf-core.js";
import { urdfToSdf } from "./urdf2sdf.js";
import { GzPhysics, loadRapier, driveWheels, stepJointDynamics } from "./gz-physics.js";
import { gzWorldFromSdf, gzModelFromSdf, gzLoadMeshes } from "./gz-sdformat.js";
import { parseGzSimArgs, parseCreateArgs, parseBridgeConfigYaml, bridgeTypesOk, gzTopic } from "./gz-cli.js";

// gz-sim 8's examples/worlds/empty.sdf (the world most robot launches start with: gz_args "-r empty.sdf")
export const EMPTY_SDF = `<?xml version="1.0" ?>
<sdf version="1.6">
  <world name="empty">
    <physics name="1ms" type="ignored">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
    </physics>
    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"></plugin>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"></plugin>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"></plugin>
    <plugin filename="gz-sim-contact-system" name="gz::sim::systems::Contact"></plugin>
    <light type="directional" name="sun">
      <cast_shadows>true</cast_shadows>
      <pose>0 0 10 0 0 0</pose>
      <diffuse>0.8 0.8 0.8 1</diffuse>
      <specular>0.2 0.2 0.2 1</specular>
      <attenuation><range>1000</range><constant>0.9</constant><linear>0.01</linear><quadratic>0.001</quadratic></attenuation>
      <direction>-0.5 0.1 -0.9</direction>
    </light>
    <model name="ground_plane">
      <static>true</static>
      <link name="link">
        <collision name="collision"><geometry><plane><normal>0 0 1</normal><size>100 100</size></plane></geometry></collision>
        <visual name="visual"><geometry><plane><normal>0 0 1</normal><size>100 100</size></plane></geometry>
          <material><ambient>0.8 0.8 0.8 1</ambient><diffuse>0.8 0.8 0.8 1</diffuse><specular>0.8 0.8 0.8 1</specular></material></visual>
      </link>
    </model>
  </world>
</sdf>`;
export const GZ_WORLDS_DIR = "/usr/share/gz/gz-sim8/worlds";

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
    if (this.gzResolve && s.startsWith("/")) { const r = this.gzResolve(s); if (r && typeof r.then !== "function") { if (r.text != null) return r.text; if (r.bytes) return new TextDecoder().decode(r.bytes); } }
    const m = s.match(/^\$FINDSHARE:([\w-]+)\/([\w-]+)\/(.+)$/) || s.match(new RegExp(`^${HOME}/ros2_ws/install/([\\w-]+)/share/[\\w-]+/([\\w-]+)/(.+)$`));
    if (m) { const pk = sh.wsPkgs && sh.wsPkgs.get(m[1]); return pk && pk[m[2]] ? pk[m[2]][m[3]] : undefined; }
    const n = sh.node(sh.abs(s)); return n && n.type === "f" ? n.content || "" : undefined;
  },
  sharePath(path) { return String(path || "").replace(/^\$FINDSHARE:([\w-]+)/, `${HOME}/ros2_ws/install/$1/share/$1`); },

  // ---------------- gz sim ----------------
  // a sync resolver for the SDF loader: the coordinator's (graph.gzResolve / opts.resolve) or the practice file system
  gzResolver(opts = {}) {
    const r = opts.resolve || this.gzResolve;
    return (path) => {
      if (path === `${GZ_WORLDS_DIR}/empty.sdf`) return { text: EMPTY_SDF };
      if (r) { const v = r(path); if (v) return v; }
      if (!this.sh) return null;
      const t = this.shareText(path); return t === undefined ? null : { text: t };
    };
  },
  gzEnvOf(opts = {}) { return { HOME, AMENT_PREFIX_PATH: "/opt/ros/jazzy", ...(this.gzEnv || {}), ...(opts.env || {}) }; },
  // gz sim [options] [file]: argv as the launch runtime gives it (["ruby /usr/bin/gz sim -r -s -v2 x.world --force-version 8"]),
  // or the words after "gz sim". opts: { tag, resolve, env (the process env: GZ_SIM_RESOURCE_PATH ...), world (a gzLoadWorld result) }
  gzSim(argv, opts = {}) {
    const { tag } = opts;
    const A = parseGzSimArgs(argv.some((x) => /(^|\/)gz( |$)/.test(String(x))) ? argv : ["gz", "sim", ...argv.map(String)]);
    const P = (t) => (tag ? `[${tag}] ` : "") + t;
    if (A.error) return { err: [P(A.error)] };
    const verbose = A.verbose, run = A.run, serverOnly = A.server;
    if (!A.startsServer) {   // gz sim -g: only the GUI; it shows the server's world
      if (this.gz) this.gz.gui = true; else this.gzGuiWaiting = true;
      const L = verbose >= 3 ? [`[GUI] [Msg] Gazebo Sim GUI    v8.9.0`, `[GUI] [Msg] Loading config [${HOME}/.gz/sim/8/gui.config]`, `[GUI] [Msg] Requesting world names...`] : [];
      return { lines: L.map(P), guiOnly: true, node: null };
    }
    let file = A.file || "empty.sdf";
    const env = this.gzEnvOf(opts), resolve = this.gzResolver(opts);
    let world, res = opts.world || null, path = null;
    if (!res) {
      // resolveSdfWorldFile: a path as given, else GZ_SIM_RESOURCE_PATH, else gz-sim's installed worlds
      const cands = file.startsWith("/") ? [file] : file.includes("/") ? [file] : [...String(env.GZ_SIM_RESOURCE_PATH || "").split(":").filter(Boolean).map((d) => `${d}/${file}`), `${GZ_WORLDS_DIR}/${file}`];
      let text = null;
      for (const c of cands) { const r = resolve(c); if (r) { text = r.text != null ? r.text : new TextDecoder().decode(r.bytes); path = c; break; } }
      if (text == null && !file.includes("/") && BUILTIN_WORLDS[file]) { world = BUILTIN_WORLDS[file](); }
      else if (text == null) return { err: [P(`[Err] [Server.cc:93] Failed to find world [${file}]`)] };
      else res = gzWorldFromSdf(text, { resolve, env, path });
    }
    const lines = [];
    if (res) {
      if (res.errors.length || !res.world) return { err: res.lines.map(P), errors: res.errors };   // ServerConfig EXIT_IMMEDIATELY on SDF errors
      world = res.world; path = path || res.world.file;
      for (const t of res.lines) if (!/^\[Wrn\]/.test(t) || verbose >= 2) lines.push(t);
    }
    const n = this.add("gz_sim", "gz_sim", "", {});
    n.hidden = true;
    this.gz = { world, file: path || this.sharePath(file), paused: !run, time: 0, models: new Map(), gui: !serverOnly || !!this.gzGuiWaiting, node: n.full, verbose, version: 1, dyn: {}, args: A };
    this.gzGuiWaiting = false;
    // the physics engine (Rapier) loads in the background; until it is ready, the robots move without it
    loadRapier().then((R) => { if (this.gz && this.gz.world === world && !this.gzPhys) this.gzPhys = new GzPhysics(R, world); }).catch(() => {});
    if (world.native) gzLoadMeshes(world, { resolve: opts.resolveAsync || ((p) => resolve(p)), env }).then(() => { if (this.gzPhys && this.gzPhys.worldDef === world) this.gzPhys.refreshMeshes(); this.gz && this.gz.version++; }).catch(() => {});
    const L = [];
    if (verbose >= 3) {
      L.push(`[Msg] Gazebo Sim Server v8.9.0`, `[Msg] Loading SDF world file[${path || `${GZ_WORLDS_DIR}/${file}`}].`, `[Msg] Serving entity system service on [/entity/system/add]`,
        `[Msg] Create service on [/world/${world.name}/create]`, `[Msg] Remove service on [/world/${world.name}/remove]`, `[Msg] Pose service on [/world/${world.name}/set_pose]`, `[Msg] Loaded level [3]`, `[Msg] Serving world controls on [/world/${world.name}/control], [/world/${world.name}/control/state] and [/world/${world.name}/playback/control]`,
        `[Msg] Serving GUI information on [/world/${world.name}/gui/info]`, `[Msg] World [${world.name}] initialized with [${(world.physics && world.physics.name) || "default_physics"}] physics profile.`, `[Msg] Serving world SDF generation service on [/world/${world.name}/generate_world_sdf]`);
      if (A.physicsEngine !== "gz-physics-dartsim-plugin") L.push(`[Msg] Loaded physics engine [${A.physicsEngine}] (the practice Gazebo simulates with its own engine)`);
      if (!serverOnly) L.push(`[GUI] [Msg] Gazebo Sim GUI    v8.9.0`, `[GUI] [Msg] Loading config [${HOME}/.gz/sim/8/gui.config]`, `[GUI] [Msg] Requesting world names...`, `[GUI] [Msg] Loaded plugin [EntityTree] from path [/usr/lib/x86_64-linux-gnu/gz-gui-8/plugins/libEntityTree.so]`);
    }
    for (const m of (world.models || []).filter((x) => x.missing)) L.push(`[Err] [SystemPaths.cc:...] Unable to find file with URI [${m.missing}]`);
    // models of the world file with joints / plugins / sensors are simulated like spawned robots
    for (const r of world.robots || []) { const pose = r.pose || [0, 0, 0, 0, 0, 0]; const add = this.gzAddModel({ ...r, name: r.name, urdf: null }, { x: pose[0], y: pose[1], z: pose[2], roll: pose[3], pitch: pose[4], yaw: pose[5] }); L.push(...add.gzLines); }
    return { lines: [...lines, ...L].map(P), node: n, world };
  },
  gzRunning() { return !!(this.gz && this.node(this.gz.node)); },

  // ---------------- ros_gz_sim create ----------------
  // argv: the words after create (or the runtime's cmd). opts: { tag, pid, resolve, env, xml (text read by the adapter, e.g.
  // from -param), model (a gzLoadModel result for -file, with mesh colliders) }
  gzCreate(argv, opts = {}) {
    const { tag } = opts;
    const C = parseCreateArgs(argv.map(String));
    const now = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
    const I = (t) => `${tag ? `[${tag}] ` : ""}[INFO] [${now()}] [ros_gz_sim]: ${t}`, E = (t) => `${tag ? `[${tag}] ` : ""}[ERROR] [${now()}] [ros_gz_sim]: ${t}`, Wn = (t) => `${tag ? `[${tag}] ` : ""}[WARN] [${now()}] [ros_gz_sim]: ${t}`;
    const out = [];
    if (C.error && /flag/.test(C.error)) return { lines: [E(C.error)], fail: true };
    if (!C.world) {
      out.push(I("Requesting list of world names."));
      if (!this.gzRunning()) return { lines: [...out, I("Timed out when getting world names.")], fail: true, hint: "No Gazebo is running. Start it first (gz sim -r empty.sdf, or include gz_sim.launch.py in your launch file)." };
    } else if (!this.gzRunning() || C.world !== this.gz.world.name) return { lines: [...out, Wn(`Waiting for service [/world/${C.world}/create] to become available ...`)], fail: true, waiting: true, hint: this.gzRunning() ? `Gazebo's world is called [${this.gz.world.name}], not [${C.world}]: create waits for /world/${C.world}/create forever.` : "No Gazebo is running yet." };
    let xml = opts.xml || null, file = null;
    if (C.source === "topic") {
      const topic = slash(C.topic || "robot_description");
      out.push(I(`Waiting messages on topic [${C.topic}].`));
      if (!xml) {
        const rsp = this.nodes.find((n) => n.kind === "rsp" && `${n.ns}/robot_description` === topic && n.params.robot_description);
        if (!rsp) return { lines: out, fail: true, waiting: true, hint: `Nobody publishes ${topic} yet, so create keeps waiting. Start robot_state_publisher with the robot's URDF first.` };
        xml = String(rsp.params.robot_description);
      }
    } else if (C.source === "file") { file = C.file; }
    else if (C.source === "string") xml = C.string;
    else if (C.source === "param") { if (!xml) return { lines: [...out, E(`Failed to get XML from param [${C.param}].`)], fail: true }; }
    else return { lines: [...out, E(C.error || "Must specify either -file, -param, -string or -topic")], fail: true };
    const fail = (gzErr, hint) => ({ lines: [...out, E("Entity creation failed.")], fail: true, gzErr, hint });
    const resolve = this.gzResolver(opts), env = this.gzEnvOf(opts);
    if (file) {
      const r = resolve(file.startsWith("/") ? file : this.sharePath(file));
      if (!r) return fail([`[Err] [UserCommands.cc:927] Error Code 1: Msg: File [${file}] doesn't exist.`]);
      xml = r.text != null ? r.text : new TextDecoder().decode(r.bytes);
    }
    const pose = { x: C.pose.x, y: C.pose.y, z: C.pose.z, roll: C.pose.R, pitch: C.pose.P, yaw: C.pose.Y };
    // SDF (a model file, or an SDF string): libsdformat reads it natively
    if (/<sdf\b/.test(xml)) {
      const r = opts.model || gzModelFromSdf(xml, { resolve, env, path: file && file.startsWith("/") ? file : null });
      if (!r.model) return fail(r.lines && r.lines.length ? r.lines : ["[Err] [UserCommands.cc:956] Expected exactly one top-level <model>, <light> or <actor> on SDF."]);
      if (r.failed) return fail(r.lines);
      const name = this.gzUniqueName(C.name || r.name, C.allowRenaming);
      if (!name) return fail([`[Wrn] [UserCommands.cc:997] Entity named [${C.name || r.name}] already exists and [allow_renaming] is false. Entity not spawned.`]);
      const res = this.gzAddModel({ ...r, name, urdf: null, sdfText: xml }, pose);
      if (!opts.model && r.model) gzLoadMeshes({ models: [], robots: [r] }, { resolve, env }).catch(() => {});
      return { lines: [...out, I("Entity creation successful.")], model: res.m, gzErr: [...r.lines, ...res.gzLines], gzInfo: res.info, cmHint: res.cmHint, hint: res.hint };
    }
    let model; try { model = parseURDF(xml); } catch (e) { return fail([`[Err] [UserCommands.cc:927] Error Code 1: Msg: Error parsing XML from string: ${e.message}`]); }
    const gz = urdfGazebo(xml);
    const name = this.gzUniqueName(C.name || model.name, C.allowRenaming);
    if (!name) return fail([`[Wrn] [UserCommands.cc:997] Entity named [${C.name || model.name}] already exists and [allow_renaming] is false. Entity not spawned.`]);
    // Gazebo turns the URDF into SDF first (libsdformat): fixed joints are lumped, links without mass are left out
    // together with everything below them, and only what is left is simulated (RViz still shows the whole URDF)
    const sdf = urdfToSdf(model, xml);
    const gzLines = [...sdf.warnings];
    if (!sdf.model || !Object.keys(sdf.model.links).length) {
      gzLines.push("[Err] [UserCommands.cc:...] Error Code 17: Msg: A model must have at least one link.");
      return fail(gzLines, `Gazebo dropped every link of ${model.name}: the root link [${model.root}] has no <inertial> with a mass > 0. Give each link an <inertial> block (mass and inertia), as Gazebo needs them; RViz does not.`);
    }
    const sdfHint = [];
    if (sdf.dropped.size) {
      const roots = [...sdf.dropped].filter((l) => { const j = Object.values(model.joints).find((x) => x.child === l); return !j || !sdf.dropped.has(j.parent); });
      const below = sdf.dropped.size - roots.length;
      sdfHint.push(`${roots.join(", ")} ${roots.length > 1 ? "have" : "has"} no <inertial> with a mass > 0, so Gazebo left ${roots.length > 1 ? "them" : "it"} out${below ? ` with the ${below} link${below > 1 ? "s" : ""} below` : ""} and the joints to ${roots.length > 1 || below ? "them" : "it"} (see the urdf2sdf warnings). RViz still shows the whole URDF; Gazebo does not. Add an <inertial> block to every link that moves`);
    }
    if (!sdf.collisions) sdfHint.push(`no link of ${model.name} has a <collision>, so nothing touches the ground plane or the walls: in Gazebo the robot falls through the floor. Add <collision> blocks (the same shapes as the visuals are fine)`);
    const res = this.gzAddModel({ name, urdf: xml, model: sdf.model, urdfModel: model, sdf, gazebo: gz }, pose);
    // collision meshes of the URDF (package://...) for the physics engine, when the coordinator gave a resolver
    if (opts.resolve || this.gzResolve) gzLoadMeshes({ models: [], robots: [{ model: sdf.model }] }, { resolve: opts.resolveAsync || resolve, env }).catch(() => {});
    gzLines.push(...res.gzLines);
    const hint = [...sdfHint, ...(res.hint ? [res.hint] : [])].join("; ");
    return { lines: [...out, I("Entity creation successful.")], model: res.m, gzErr: gzLines, gzInfo: res.info, cmHint: res.cmHint, hint: hint ? hint + "." : null };
  },
  // UserCommands: a top-level name in use is refused, or renamed name_0, name_1 ... with allow_renaming
  gzUniqueName(name, allow) {
    const used = (n) => this.gz.models.has(n) || (this.gz.world.models || []).some((w) => w.name === n);
    if (!used(name)) return name;
    if (!allow) return null;
    for (let i = 0; ; i++) if (!used(`${name}_${i}`)) return `${name}_${i}`;
  },
  // put a model (URDF via urdf2sdf, or native SDF) into the running world: the systems look up their joints, the
  // gz_ros2_control plugin starts a controller_manager
  gzAddModel(r, pose) {
    const name = r.name, model = r.model, gz = r.gazebo, gzLines = [];
    const m = { name, urdf: r.urdf, sdfText: r.sdfText || null, model, urdfModel: r.urdfModel || model, sdf: r.sdf, gazebo: gz, pose: { ...pose }, start: { ...pose }, cmd: { vx: 0, wz: 0 }, joints: {}, qd: {}, vFall: 0, native: !r.urdf, targets: {} };
    for (const j of Object.values(model.joints)) if (!["fixed", "floating", "planar"].includes(j.type) && !j.mimic) m.joints[j.name] = 0;
    for (const p of gz.plugins) if (p.kind === "joint_position" && p.joint in m.joints) { m.joints[p.joint] = p.initial; m.targets[p.joint] = p.initial; }
    for (const p of gz.plugins) if (p.kind === "joint_trajectory") p.joints.forEach((j, i) => { if (j in m.joints && Number.isFinite(p.initial[i])) { m.joints[j] = p.initial[i]; m.targets[j] = p.initial[i]; } });
    // the Gazebo drive systems look their joints up in the model: a joint that is not there is reported once, and a
    // side with no joint at all stops the system (no wheel commands, no odometry)
    for (const p of gz.plugins) {
      const sides = p.kind === "diff_drive" ? { left: p.left || [], right: p.right || [] } : p.kind === "mecanum" ? { front_left: [p.fl], front_right: [p.fr], back_left: [p.rl], back_right: [p.rr] } : p.kind === "ackermann" ? { wheel: p.wheels || [], "left steering": [p.leftSteer], "right steering": [p.rightSteer] } : {};
      const file = { diff_drive: "DiffDrive", mecanum: "MecanumDrive", ackermann: "AckermannSteering" }[p.kind];
      for (const [side, js] of Object.entries(sides)) for (const j of js) if (j && !(j in model.joints)) gzLines.push(`[Wrn] [${file}.cc:421] Failed to find ${side.replace("_", " ")} joint [${j}] for model [${name}]`);
      if (Object.values(sides).some((js) => js.length && !js.some((j) => j && j in model.joints))) p.stalled = true;
      if (p.kind === "diff_drive" && this.gz.verbose >= 3) gzLines.push(`[Msg] DiffDrive subscribing to twist messages on [${gzTopic(p.topic) || `/model/${name}/cmd_vel`}]`);
      if (p.kind === "joint_states" && p.joints && p.joints.length) for (const j of p.joints) if (!(j in model.joints) && !Object.values(model.joints).some((x) => x.name === j)) gzLines.push(`[Err] [JointStatePublisher.cc:80] Joint with name[${j}] not found. The JointStatePublisher will not publish this joint.`);
    }
    this.gz.models.set(name, m); this.gz.version++;
    gzLines.push(...gz.warnings);
    if (!worldHas(this.gz.world, "sensors-system") && gz.sensors.some((s) => /camera|lidar|gpu|depth|rgbd/.test(s.type))) gzLines.push(...(this.gz.verbose >= 2 ? [`[Wrn] [...] The world has no gz-sim-sensors-system plugin: camera and lidar sensors of [${name}] will not publish.`] : []));
    const rc = m.urdf ? this.cmAttach(m) : null;   // gz_ros2_control: a controller_manager starts inside Gazebo
    if (rc) gzLines.push(...rc.err);
    return { m, gzLines, info: rc ? rc.out : null, cmHint: rc ? rc.hint : null, hint: null };
  },

  // ---------------- ros_gz_bridge ----------------
  bridgeEntries(args, params) {
    const L = [], entries = [], bad = [];
    for (const x of args) { if (String(x).startsWith("-")) continue; const e = parseBridgeArg(x); if (e) entries.push(e); else if (/@/.test(x)) bad.push(x); }
    if (params && params.config_file) {
      const text = this.shareText(params.config_file);
      if (text === undefined) return { err: `[ERROR] [readFromYamlFile]: Could not parse config: failed to open file [${this.sharePath(params.config_file)}]`, entries, bad, L };
      const y = parseBridgeConfigYaml(text, { file: this.sharePath(params.config_file) });
      L.push(...y.errors);
      // gz-transport makes relative topic names absolute ("odom" is /odom); the ROS name is resolved in the node's namespace
      entries.push(...y.entries.map((e) => ({ ...e, gz: gzTopic(e.gz) })));
    }
    return { entries, bad, L };
  },
  bridgeLines(n, tag) {
    const now = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
    const P = (lvl, t) => `${tag ? `[${tag}] ` : ""}[${lvl}] [${now()}] [${n.name}]: ${t}`;
    const L = [...(n.bridgeLog || [])].map((t) => (tag ? `[${tag}] ${t}` : t));
    for (const x of n.bridgeBad || []) L.push(P("ERROR", `Failed to parse argument [${x}]. Expected <topic>@<ros_type>[<gz_type> (or ] or @)`));
    for (const e of n.bridge) {
      if (!bridgeTypesOk(e.rosType, e.gzType)) { L.push(P("WARN", `Failed to create a bridge for topic [${e.ros}] with ROS2 type [${e.rosType}] to topic [${e.gz}] with Gazebo Transport type [${e.gzType}]: No template specialization for the pair`)); e.broken = true; continue; }
      if (e.dir !== "ROS_TO_GZ") L.push(P("INFO", `Creating GZ->ROS Bridge: [${e.gz} (${e.gzType}) -> ${e.ros} (${e.rosType})] (Lazy ${e.lazy ? 1 : 0})`));
      if (e.dir !== "GZ_TO_ROS") L.push(P("INFO", `Creating ROS->GZ Bridge: [${e.ros} (${e.rosType}) -> ${e.gz} (${e.gzType})] (Lazy ${e.lazy ? 1 : 0})`));
    }
    if (!n.bridge.length && !(n.bridgeBad || []).length) L.push(P("WARN", "No bridges were created: give topics as arguments (/scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan) or -p config_file:=bridge.yaml"));
    return L;
  },
  bridges() {   // every working bridge entry, its ROS topic resolved through the node's remappings
    return this.nodes.filter((n) => n.kind === "gz_bridge" || n.kind === "gz_image").flatMap((n) => (n.bridge || []).filter((e) => !e.broken).map((e) => {
      // the ROS name resolved in the bridge node's namespace ("odom" -> /odom), then through its remappings
      const res = (x) => (x.startsWith("/") ? x : `${n.ns}/${x}`), ros = res(e.ros), r = (n.remaps || []).find(([f]) => res(f) === ros);
      return r ? { ...e, ros: res(r[1]) } : ros === e.ros ? e : { ...e, ros };
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
        if (p.kind === "joint_position") out.push({ topic: slash(p.topic) || (p.subTopic ? `/model/${m.name}/${p.subTopic}` : `/model/${m.name}/joint/${p.joint}/${p.index || 0}/cmd_pos`), type: "gz.msgs.Double", kind: "cmd_pos", model: m.name, plugin: p, sub: true });
        if (p.kind === "joint_states") out.push({ topic: slash(p.topic) || `/world/${w}/model/${m.name}/joint_state`, type: "gz.msgs.Model", kind: "joints", model: m.name, plugin: p, rate: p.rate > 0 ? p.rate : 1000 });
        if (p.kind === "joint_velocity") out.push({ topic: slash(p.topic) || `/model/${m.name}/joint/${p.joint}/cmd_vel`, type: "gz.msgs.Double", kind: "cmd_jvel", model: m.name, plugin: p, sub: true });
        if (p.kind === "apply_joint_force") out.push({ topic: `/model/${m.name}/joint/${p.joint}/cmd_force`, type: "gz.msgs.Double", kind: "cmd_force", model: m.name, plugin: p, sub: true });
        if (p.kind === "joint_trajectory") out.push({ topic: slash(p.topic) || `/model/${m.name}/joint_trajectory`, type: "gz.msgs.JointTrajectory", kind: "joint_trajectory", model: m.name, plugin: p, sub: true },
          { topic: `${slash(p.topic) || `/model/${m.name}/joint_trajectory`}_progress`, type: "gz.msgs.Float", kind: "traj_progress", model: m.name, plugin: p });
        if (p.kind === "pose_publisher") out.push({ topic: slash(p.topic) || `/model/${m.name}/pose`, type: p.poseV ? "gz.msgs.Pose_V" : "gz.msgs.Pose", kind: "pose", model: m.name, plugin: p, rate: p.rate > 0 ? p.rate : 1000 },
          ...(p.staticPub ? [{ topic: `${slash(p.topic) || `/model/${m.name}/pose`}_static`, type: p.poseV ? "gz.msgs.Pose_V" : "gz.msgs.Pose", kind: "pose_static", model: m.name, plugin: p }] : []));
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
  gzTwist(topic, v, rosType = "geometry_msgs/msg/Twist") {
    if (!this.gzRunning()) return [];
    const hit = [];
    for (const e of this.bridges()) {
      if (e.dir === "GZ_TO_ROS" || e.ros !== topic || e.rosType !== rosType || !/^geometry_msgs\/msg\/Twist(Stamped)?$/.test(e.rosType)) continue;
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
    if (this.gzPhys && (!this.gz || this.gzPhys.worldDef !== this.gz.world)) { this.gzPhys.destroy(); this.gzPhys = null; }
    if (!this.gzRunning() || this.gz.paused) return false;
    this.gz.time += dt;
    const PH = this.gzPhys;
    if (PH) for (const name of [...PH.robots.keys()]) if (!this.gz.models.has(name)) PH.removeRobot(name);
    for (const m of this.gz.models.values()) {
      const dynJ = this.gzDynJoints(m);
      for (const [j, goal] of Object.entries(m.targets || {})) { if (dynJ.includes(j)) continue; const d = goal - m.joints[j], stepMax = 1.2 * dt; m.joints[j] += Math.abs(d) < stepMax ? d : Math.sign(d) * stepMax; }   // the PID moves the joint to the goal (about 1.2 rad/s here)
      this.gzGravity(m, dt);
      if (m.cm) {   // ros2_control: the controllers command the joints
        const q0 = { ...m.joints };
        this.cmStep(m, dt);
        if (dynJ.length && !m.cm.dead) this.gzArmStep(m, dynJ, q0, dt);
        continue;
      }
      if (dynJ.length) this.gzArmStep(m, dynJ, null, dt);
      const dd = m.gazebo.plugins.find((p) => p.kind === "diff_drive"), vc = m.gazebo.plugins.find((p) => p.kind === "velocity_control"), mc = m.gazebo.plugins.find((p) => p.kind === "mecanum"), ak = m.gazebo.plugins.find((p) => p.kind === "ackermann");
      if (!dd && !vc && !mc && !ak) continue;
      if ([dd, mc, ak].some((p) => p && p.stalled)) continue;   // the drive system did not find its joints
      let { vx = 0, vy = 0, vz = 0, wz = 0 } = m.cmd;
      if (dd || mc) ({ vx, wz } = this.gzLimit(dd || mc, vx, wz, dt));   // gz::math::SpeedLimiter (<max_linear_acceleration> ...)
      if (dd || ak) { vy = 0; vz = 0; }   // wheels cannot strafe or fly
      if (mc) vz = 0;
      const flying = !!(vc && vc.flying);
      if (vc && !flying) vz = 0;
      if (ak) { const steer = Math.atan((wz * ak.wheelbase) / (Math.abs(vx) > 1e-6 ? vx : 1e-6)), lim = ak.steerLimit || 0.6; const st = Math.max(-lim, Math.min(lim, steer)); wz = Math.abs(vx) > 1e-6 ? (vx * Math.tan(st)) / ak.wheelbase : 0; for (const j of [ak.leftSteer, ak.rightSteer]) if (j in m.joints) m.joints[j] = st; }
      if (m.jv) for (const j in m.jv) m.jv[j] = 0;   // wheel joint velocities (JointStatePublisher), set again below while it drives
      if (!vx && !vy && !vz && !wz) { if (dd) this.gzWheelOdom(m, dd, dt); continue; }
      const blocked = this.gzDrive(m, vx, vy, vz, wz, dt, flying);
      const wheel = (j, v, r) => { if (j in m.joints) { m.joints[j] += (v / r) * dt; (m.jv || (m.jv = {}))[j] = v / r; } };
      if (dd && !blocked) { for (const j of dd.left) wheel(j, vx - (wz * dd.separation) / 2, dd.radius); for (const j of dd.right) wheel(j, vx + (wz * dd.separation) / 2, dd.radius); }
      if (dd) this.gzWheelOdom(m, dd, dt);
      if (mc && !blocked) { const k = (mc.separation + mc.wheelbase) / 2; wheel(mc.fl, vx - vy - k * wz, mc.radius); wheel(mc.fr, vx + vy + k * wz, mc.radius); wheel(mc.rl, vx + vy - k * wz, mc.radius); wheel(mc.rr, vx - vy + k * wz, mc.radius); }
      if (ak && !blocked) { for (const j of ak.wheels) wheel(j, vx, ak.radius); }
      if (flying) for (const j of (vc.spin = vc.spin || Object.keys(m.joints).filter((n) => /prop|rotor/i.test(n)))) m.joints[j] += 60 * dt;   // propellers spin while it flies
    }
    // the physics world: links follow the joints, then the world steps (falling, pushed objects)
    if (PH) { for (const m of this.gz.models.values()) PH.syncLinks(m); PH.step(dt); this.gz.dyn = PH.dynPoses(); }
    return true;
  },
  // gz::math::SpeedLimiter of DiffDrive / MecanumDrive: velocity limits, then acceleration limits (per step)
  gzLimit(p, vx, wz, dt) {
    const st = p.lim || (p.lim = { v: 0, w: 0 });
    const clamp = (x, lo, hi) => Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, x));
    let v = clamp(vx, p.minLinVel, p.maxLinVel), w = clamp(wz, p.minAngVel, p.maxAngVel);
    if (p.maxLinAcc != null || p.minLinAcc != null) v = st.v + clamp(v - st.v, p.minLinAcc != null ? p.minLinAcc * dt : -Infinity, p.maxLinAcc != null ? p.maxLinAcc * dt : Infinity);
    if (p.maxAngAcc != null || p.minAngAcc != null) w = st.w + clamp(w - st.w, p.minAngAcc != null ? p.minAngAcc * dt : -Infinity, p.maxAngAcc != null ? p.maxAngAcc * dt : Infinity);
    st.v = v; st.w = w; return { vx: v, wz: w };
  },
  // gz::math::DiffDriveOdometry: the pose integrated from the wheel joint angles (it drifts if the wheels slip)
  gzWheelOdom(m, dd, dt) {
    const L = dd.left.filter((j) => j in m.joints), R = dd.right.filter((j) => j in m.joints); if (!L.length || !R.length) return;
    const l = m.joints[L[0]], r = m.joints[R[0]], o = m.wheelOdom || (m.wheelOdom = { x: 0, y: 0, th: 0, l, r, v: 0, w: 0 });
    const dl = (l - o.l) * dd.radius, dr = (r - o.r) * dd.radius; o.l = l; o.r = r;
    const lin = (dl + dr) / 2, ang = (dr - dl) / dd.separation;
    if (Math.abs(ang) < 1e-6) { const d = o.th + ang * 0.5; o.x += lin * Math.cos(d); o.y += lin * Math.sin(d); }   // Runge-Kutta 2
    else { const th0 = o.th, R0 = lin / ang; o.x += R0 * (Math.sin(th0 + ang) - Math.sin(th0)); o.y -= R0 * (Math.cos(th0 + ang) - Math.cos(th0)); }
    o.th += ang; o.v = dt > 0 ? lin / dt : 0; o.w = dt > 0 ? ang / dt : 0;
  },
  // the joints whose motion the physics integrates (arms): revolute / prismatic / continuous joints that are not wheels
  // of a drive system or of a diff_drive / mecanum controller, in a model whose links have mass
  gzDynJoints(m) {
    if (m.dynJ) return m.dynJ;
    const md = m.model, wheels = driveWheels(m) || new Set();
    if (m.cm) for (const c of m.cm.controllers ? m.cm.controllers.values() : []) for (const k of ["left_wheel_names", "right_wheel_names"]) for (const j of [].concat(c.params && c.params[k] || [])) wheels.add(j);
    if (m.cm && m.cm.params) for (const P of Object.values(m.cm.params)) if (P && typeof P === "object") for (const k of ["left_wheel_names", "right_wheel_names", "traction_joints_names", "rear_wheels_names"]) for (const j of [].concat(P[k] || [])) wheels.add(j);
    const massive = Object.values(md.links).filter((l) => l.inertial && l.inertial.mass > 0).length >= 2;
    const fixed = !!md.links.world || Object.values(md.joints).some((j) => j.parent === "world");
    const out = massive && (fixed || m.native) ? Object.values(md.joints).filter((j) => ["revolute", "prismatic"].includes(j.type) || (j.type === "continuous" && fixed)).filter((j) => !j.mimic && !wheels.has(j.name) && j.name in m.joints).map((j) => j.name) : [];
    m.dynJ = out; return out;
  },
  // one step of the arm joints: what commands each joint (gz_ros2_control interfaces claimed by active controllers,
  // hold_joints, JointPositionController / JointTrajectoryController systems), then gravity + effort limits decide
  gzArmStep(m, dynJ, q0, dt) {
    const modes = {}, tgt = { ...m.joints };
    if (q0) for (const j of dynJ) m.joints[j] = q0[j];
    if (!m.holdQ) m.holdQ = { ...m.joints };
    const cm = m.cm, plugin = cm && cm.gzPlugin, gain = (plugin && plugin.gain) || 0.1, rate = (cm && cm.updateRate) || 100;
    const jpc = Object.fromEntries((m.gazebo.plugins || []).filter((p) => p.kind === "joint_position").map((p) => [p.joint, p]));
    for (const j of dynJ) {
      if (cm) {
        const own = (iface) => { const it = cm.iface.get(`${j}/${iface}`); return it && it.claimedBy && cm.controllers.get(it.claimedBy) && cm.controllers.get(it.claimedBy).state === "active"; };
        if (own("position")) modes[j] = { mode: "position", value: tgt[j], gain: gain * rate };
        else if (own("velocity")) modes[j] = { mode: "velocity", value: (tgt[j] - m.joints[j]) / dt };
        else if (own("effort")) modes[j] = { mode: "effort", value: (cm.iface.get(`${j}/effort`) || {}).value || 0 };
        else modes[j] = !plugin || plugin.holdJoints !== false ? { mode: "hold", value: m.holdQ[j] } : { mode: "free" };
        if (modes[j].mode !== "hold") m.holdQ[j] = tgt[j];
      } else if (jpc[j]) { const p = jpc[j], goal = m.targets[j] ?? p.initial; modes[j] = p.useVelocity ? { mode: "position", value: goal, gain: p.p } : { mode: "pid", value: goal, p: p.p, d: p.d, cmdMax: p.cmdMax, cmdMin: p.cmdMin }; }
      else if (j in (m.targets || {})) modes[j] = { mode: "position", value: m.targets[j], gain: 10 };
      else modes[j] = { mode: "free" };
    }
    const B = { t: [m.pose.x, m.pose.y, m.pose.z], q: qRPY(m.pose.roll || 0, m.pose.pitch || 0, m.pose.yaw || 0) };
    const r = stepJointDynamics(m.model, { q: m.joints, qd: m.qd || (m.qd = {}) }, modes, dt, { gravity: this.gz.world.gravity || [0, 0, -9.8], base: B });
    m.saturated = r.saturated; m.jointEffort = r.tau;
    if (cm) cm.setState(Object.fromEntries(Object.keys(m.joints).map((j) => [j, { position: m.joints[j], velocity: (m.qd && m.qd[j]) || 0 }])));
  },
  // gravity on the robot, as Gazebo's physics applies it: a robot spawned above the ground drops onto its wheels, a
  // robot spawned into the ground is pushed out, and a robot with no <collision> at all (or a world with no ground
  // plane) keeps falling. Robots fixed to "world" (arms), flying robots and robots whose chassis is made of meshes
  // (their size is not known here) stay where they are.
  gzGravity(m, dt) {
    if (m.fixedBase === undefined) {
      const md = m.model;
      m.fixedBase = !!md.links.world || Object.values(md.joints).some((j) => j.parent === "world");
      m.flyer = m.gazebo.plugins.some((p) => p.kind === "velocity_control" && p.flying);
      const wheeled = m.gazebo.plugins.some((p) => ["diff_drive", "mecanum", "ackermann"].includes(p.kind)) || Object.values(md.joints).some((j) => j.type === "continuous");
      const C = GzPhysics.prototype.chassis.call(null, md, driveWheels(m));
      // wheeled: it rests on its chassis' lowest point (the wheels); legged and others: on their lowest collision
      // (the feet, legs straight), so a robot spawned into the ground is pushed out of it
      m.restZ = !C ? null : wheeled ? (C.meshOnly ? null : Math.max(0, -C.lo[2])) : C.lowAll == null ? null : Math.max(0, -C.lowAll);
    }
    if (m.fixedBase || m.flyer) return;
    const ground = this.gz.world.models.some((w) => (w.shapes || []).some((sh) => sh.type === "plane"));
    if (!(m.sdf && m.sdf.collisions) || !ground) {
      if (m.pose.z > -50) { m.vFall = (m.vFall || 0) - 9.81 * dt; m.pose.z += m.vFall * dt; }
      m.airborne = true; return;
    }
    if (m.restZ === null) { m.airborne = false; return; }
    if (m.pose.z < m.restZ - 1e-4) { m.pose.z = m.restZ; m.vFall = 0; }
    else if (m.pose.z > m.restZ + 1e-4) { m.vFall = (m.vFall || 0) - 9.81 * dt; m.pose.z = Math.max(m.restZ, m.pose.z + m.vFall * dt); if (m.pose.z === m.restZ) m.vFall = 0; }
    m.airborne = m.pose.z > m.restZ + 0.005;
  },
  // move a robot base with a body velocity (vx, vy, vz, wz): the physics engine decides how far it really gets
  // (walls and fixed objects stop it, it slides along them, light objects get pushed). Used by the Gazebo drive
  // systems and by gz_ros2_control's controllers alike, as both end in the same physics world in Gazebo.
  gzDrive(m, vx, vy, vz, wz, dt, flying = false) {
    const PH = this.gzPhys;
    // wheels and feet only move the robot while they touch the ground (not while it falls, nor without collisions)
    if (!flying && m.airborne) { m.bumped = false; return false; }
    const yaw = m.pose.yaw + wz * dt, nx = m.pose.x + (vx * Math.cos(yaw) - vy * Math.sin(yaw)) * dt, ny = m.pose.y + (vx * Math.sin(yaw) + vy * Math.cos(yaw)) * dt;
    let blocked;
    if (PH) {
      // only robots that can move sideways (mecanum, flying, legged) slide along walls; wheels on a diff drive or an
      // Ackermann car do not slip sideways, so against a wall at an angle they stop
      const holo = flying || m.gazebo.plugins.some((p) => p.kind === "mecanum" || p.kind === "velocity_control") || (m.cm && [...m.cm.controllers.values()].some((c) => c.kind === "mecanum" && c.state === "active")) || !Object.values(m.model.joints).some((j) => j.type === "continuous");
      const nz = Math.max(flying ? 0.02 : m.pose.z, m.pose.z + vz * dt), mv = PH.moveBase(m, nx - m.pose.x, ny - m.pose.y, nz - m.pose.z, yaw, holo);
      m.pose.yaw = mv.yaw; m.pose.x += mv.dx; m.pose.y += mv.dy; m.pose.z = Math.max(flying ? 0.02 : 0, m.pose.z + mv.dz); blocked = mv.blocked;
    } else {
      // without the physics engine: the world's static objects stop the robot
      blocked = this.gzBlocked(m, nx, ny, m.pose.z + vz * dt);
      m.pose.yaw = yaw;
      if (!blocked) { m.pose.x = nx; m.pose.y = ny; m.pose.z = Math.max(flying ? 0.02 : m.pose.z, m.pose.z + vz * dt); }
    }
    m.bumped = blocked;
    return blocked;
  },
  gzOdom(m) {   // DiffDrive odometry: integrated from the wheel joints (gz::math::DiffDriveOdometry), else relative to the spawn pose
    if (m.wheelOdom) { const o = m.wheelOdom; return { x: o.x, y: o.y, z: 0, yaw: o.th, vx: m.bumped ? 0 : o.v, vy: 0, wz: o.w }; }
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
  // world pose of a sensor of a simulated model: { t, q }
  gzSensorPose(m, sen) {
    let P; try { P = framePoses(urdfEdges(m.model, m.joints, true), m.model.root).poses; } catch { return null; }
    const L = P[sen.link]; if (!L) return null;
    const B = { t: [m.pose.x, m.pose.y, m.pose.z], q: qRPY(m.pose.roll || 0, m.pose.pitch || 0, m.pose.yaw || 0) }, p = sen.pose || [0, 0, 0, 0, 0, 0];
    return tMul(tMul(B, L), { t: p.slice(0, 3), q: qRPY(p[3] || 0, p[4] || 0, p[5] || 0) });
  },
  // gpu_lidar without WebGL: rays against the physics world's colliders (the 3D page renders with gz-sim.js instead).
  // LaserScan of the middle ring, with <range> limits, <noise> (gaussian) and <resolution> as gz-sensors applies them
  gzScan(modelName, sen) {
    const m = this.gzModel(modelName), PH = this.gzPhys; if (!m || !PH || !sen || !sen.lidar) return null;
    const T = this.gzSensorPose(m, sen); if (!T) return null;
    const L = sen.lidar, n = Math.max(1, Math.min(L.hSamples, 2000)), inc = n > 1 ? (L.hMax - L.hMin) / (n - 1) : 0, e = (L.vMin + L.vMax) / 2;
    const dirs = []; for (let i = 0; i < n; i++) { const a = L.hMin + i * inc; dirs.push(qRot(T.q, [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)])); }
    const d = PH.castRays(T.t, dirs, Math.max(L.min, 1e-3), L.max);
    const ranges = d.map((x) => {
      if (!Number.isFinite(x)) return Infinity;
      if (L.noise > 0) { const g = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()); x += (L.noiseMean || 0) + g * L.noise; }
      if (L.resolution > 0) x = Math.round(x / L.resolution) * L.resolution;
      return x > L.max ? Infinity : x < L.min ? -Infinity : x;
    });
    return { ranges, angle_increment: inc, angle_min: L.hMin, angle_max: L.hMax, range_min: L.min, range_max: L.max };
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
    const s = f.src, t = this.gz.time, tn = Math.round(t * 1e9), sec = Math.floor(tn / 1e9), nsec = tn % 1e9;
    const stamp = `header:\n  stamp:\n    sec: ${sec}\n    nanosec: ${nsec}\n  frame_id: ${s.kind === "odom" ? (s.plugin.frame || `${s.model}/odom`) : s.kind === "joints" ? "" : s.frame}`;
    const arr = (a) => { const v = a.slice(0, 128).map((x) => `- ${Number.isFinite(x) ? f6(x) : x > 0 ? ".inf" : "-.inf"}`); if (a.length > 128) v.push("- '...'"); return v.join("\n"); };
    if (s.sensor && this.gz.paused) return null;   // a paused simulation renders no sensor data: echo just waits
    const probe = this.sh.gzProbe ? this.sh.gzProbe(s) : s.kind === "scan" ? this.gzScan(s.model, s.sensor) : null;
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
    if (s.kind === "joints") { const J = m.joints, k = Object.keys(J); return [`${stamp}\nname:\n${k.map((x) => `- ${x}`).join("\n")}\nposition:\n${arr(k.map((x) => J[x]))}\nvelocity:\n${arr(k.map((x) => (m.jv && m.jv[x]) || (m.qd && m.qd[x]) || 0))}\neffort:\n${arr(k.map(() => 0))}`]; }
    if (s.kind === "info") { const C = s.sensor.camera, fx = C.width / 2 / Math.tan(C.hfov / 2); return [`${stamp.replace(/frame_id: .*/, `frame_id: ${s.sensor.optical || s.frame}`)}\nheight: ${C.height}\nwidth: ${C.width}\ndistortion_model: plumb_bob\nd:\n- 0.0\n- 0.0\n- 0.0\n- 0.0\n- 0.0\nk:\n- ${f6(fx)}\n- 0.0\n- ${f6(C.width / 2)}\n- 0.0\n- ${f6(fx)}\n- ${f6(C.height / 2)}\n- 0.0\n- 0.0\n- 1.0\nr:\n- 1.0\n- 0.0\n- 0.0\n- 0.0\n- 1.0\n- 0.0\n- 0.0\n- 0.0\n- 1.0\np:\n- ${f6(fx)}\n- 0.0\n- ${f6(C.width / 2)}\n- -0.0\n- 0.0\n- ${f6(fx)}\n- ${f6(C.height / 2)}\n- 0.0\n- 0.0\n- 0.0\n- 1.0\n- 0.0\nbinning_x: 0\nbinning_y: 0\nroi:\n  x_offset: 0\n  y_offset: 0\n  height: 0\n  width: 0\n  do_rectify: false`]; }
    if (s.kind === "image" || s.kind === "depth") {
      const C = s.sensor.camera, depth = s.kind === "depth", px = probe && probe.bytes ? probe.bytes : [];
      return [`${stamp.replace(/frame_id: .*/, `frame_id: ${s.sensor.optical || s.frame}`)}\nheight: ${C.height}\nwidth: ${C.width}\nencoding: ${depth ? "32FC1" : "rgb8"}\nis_bigendian: 0\nstep: ${C.width * (depth ? 4 : 3)}\ndata:\n${px.slice(0, 128).map((x) => `- ${x}`).join("\n") || "- 0"}\n- '...'`];
    }
    if (s.kind === "points") { const n = probe && probe.count != null ? probe.count : 0; return [`${stamp}\nheight: 1\nwidth: ${n}\nfields:\n- name: x\n  offset: 0\n  datatype: 7\n  count: 1\n- name: y\n  offset: 4\n  datatype: 7\n  count: 1\n- name: z\n  offset: 8\n  datatype: 7\n  count: 1\n- name: intensity\n  offset: 16\n  datatype: 7\n  count: 1\n- name: ring\n  offset: 20\n  datatype: 4\n  count: 1\nis_bigendian: false\npoint_step: 32\nrow_step: ${n * 32}\ndata:\n- 0\n- '...'\nis_dense: false`]; }
    return null;
  },

  // ---------------- the gz command line ----------------
  // gz sdf -k FILE: libsdformat loads the file twice (sdf::Root::Load, then sdf::readFile), so a URDF's urdf2sdf
  // warnings come out twice before "Valid." (copied from gz sdf -k with libsdformat 14.9)
  gzSdfCli(rest) {
    const flag = rest[0], file = rest[1];
    if (!flag || flag === "-h" || flag === "--help" || !["-k", "--check", "-p", "--print", "--inertial-stats"].includes(flag)) return { lines: ["Usage:  gz sdf [options]", "", "Options:", "  -k [ --check ] arg                Check if an SDFormat file is valid.", "  -p [ --print ] arg                Print converted arg. Note the quotes are needed to", "                                    print a model or world from a URDF file.", "  --inertial-stats arg              Prints moment of inertia, centre of mass, and total", "                                    mass from a model sdf file."].map((t) => this.out(t)) };
    if (!file) return { lines: [this.err(`missing argument: ${flag}`)] };
    const text = this.shareText(file);
    if (text === undefined) return { lines: [this.err(`Error: File [${file}] does not exist.`)] };
    if (flag === "-p" || flag === "--print" || flag === "--inertial-stats") return { lines: [this.hint(`(The practice terminal checks files with gz sdf -k ${file}; printing the converted SDF needs Gazebo on Ubuntu.)`)] };
    if (/<sdf\b/.test(text)) { try { parseWorld(text); return { lines: [this.out("Valid.")] }; } catch (e) { return { lines: [this.err("Error: SDF parsing the xml failed."), this.hint(`(${e.message})`)] }; } }
    if (/<xacro:|xmlns:xacro/.test(text)) return { lines: [this.err("Error: SDF parsing the xml failed.")].concat([this.hint(`(${file} is a xacro file: run xacro first, then check the URDF: xacro ${file} > /tmp/robot.urdf && gz sdf -k /tmp/robot.urdf)`)]) };
    let model; try { model = parseURDF(text); } catch (e) { return { lines: [this.err("Error: SDF parsing the xml failed."), this.hint(`(${e.message})`)] }; }
    const r = urdfToSdf(model, text);
    const once = r.warnings.map((w) => w.replace(/:data-string:L0\]/, `:${this.sh.abs(file)}:L0]`));
    if (!r.model) return { lines: [...once, "Error Code 17: Msg: A model must have at least one link.", "Error Code 17: Msg: A model must have at least one link."].map((t) => this.err(t)) };
    // "is not modeled in sdf." has no newline: what follows it goes on the same line
    const join = (a, b) => (a.length && b.length && /is not modeled in sdf\.$/.test(a[a.length - 1]) ? [...a.slice(0, -1), a[a.length - 1] + b[0], ...b.slice(1)] : [...a, ...b]);
    const twice = join(join(once, once), ["Valid."]);
    return { lines: twice.map((t) => (/^Valid\.$/.test(t) ? this.out(t) : this.err(t))) };
  },
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
    if (sub === "sdf") return this.gzSdfCli(rest);
    if (!sub || sub === "--help" || sub === "help") return { lines: ["The 'gz' command provides a command line interface to the Gazebo Tools.", "", "  gz <command> [options]", "", "List of available commands:", "", "  help:          Print this help text.", "  sim:           Run and manage the Gazebo Simulator.", "  topic:         Print information about topics.", "  service:       Print information about services.", "  model:         Print information about models.", "  sdf:           Utilities for SDF files."].map((t) => this.out(t)) };
    return { lines: [this.err(`I don't know about command [${sub}].`)] };
  },

  // ---------------- a robot's details: links, joints, sensors, plugins (the Robotic Models Simulator page panel) ----------------
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
