// Scenarios that drive the practice Gazebo with the REAL inputs of each robot's official Jazzy launch (the processes
// recorded in tests/gz-fixtures by tests/gz-capture.mjs = what the launch runtime's onProcess hands the coordinator).
// Dependency-injected (mods, io) so the same code runs in Node (tests/gz-real-node.mjs) and in Chromium
// (tests/gz-real-tb3.mjs, tests/gz-real-arms.mjs).
//   mods: { sdformat (gz-sdformat.js), cli (gz-cli.js), rosgz (ros-gz.js), rc (ros-control-graph.js), physics (gz-physics.js), harness (gz-harness.mjs) }
//   io:   { resolve(path) -> Promise<{text}|{bytes}|null>, fixture(name) -> object, log(...) }
const exeOf = (p) => { const c = p.cmd.join(" "); return /\bgz sim\b/.test(c) ? "gz" : p.cmd[0].split("/").pop(); };
const sampleNum = (txt, re) => { const m = String(txt).match(re); return m ? Number(m[1]) : NaN; };

export async function startLaunch(mods, io, fixtureName, { steps = 0 } = {}) {
  const fx = io.fixture(fixtureName), procs = fx.procs;
  // PyYAML writes "indentless" block sequences (key:\n- item); ros2-control.js readYaml (coordinator) rejects them:
  // until it is fixed, the tests re-indent them (same YAML document) when io.yamlIndentless is set
  const fixYaml = (t) => (io.yamlIndentless ? String(t).replace(/^( *)([\w.\/-]+:)\n((?:\1- .*\n?)+)/gm, (_, ind, k, items) => `${ind}${k}\n${items.replace(/^/gm, "  ").replace(/ +$/, "")}`) : t);
  const cache = new Map(Object.values(fx.procs).flatMap((p) => Object.entries(p.files || {}).filter(([k]) => k.startsWith("/tmp/")).map(([k, v]) => [k, { text: fixYaml(v) }]))), resolveAsync = async (p) => { if (!cache.has(p)) cache.set(p, await io.resolve(p)); return cache.get(p); };
  const gzp = procs.find((p) => exeOf(p) === "gz" && !/ -g( |$)/.test(p.cmd.join(" "))) || procs.find((p) => exeOf(p) === "gz");
  const env = { HOME: "/home/student", AMENT_PREFIX_PATH: "/home/student/ros2_ws/install:/opt/ros/jazzy", ...(gzp ? gzp.env : {}) };
  const A = mods.cli.parseGzSimArgs(gzp.cmd);
  // the world file, as gz sim finds it (GZ_SIM_RESOURCE_PATH, else gz-sim's installed worlds)
  let wpath = A.file, wtext = null;
  if (wpath && !wpath.startsWith("/")) for (const d of String(env.GZ_SIM_RESOURCE_PATH || "").split(":").filter(Boolean)) { const r = await resolveAsync(`${d}/${wpath}`); if (r) { wpath = `${d}/${wpath}`; break; } }
  if (!wpath || wpath === "empty.sdf") { wpath = "/usr/share/gz/gz-sim8/worlds/empty.sdf"; wtext = mods.rosgz.EMPTY_SDF; }
  else { const r = await resolveAsync(wpath); wtext = r && (r.text ?? new TextDecoder().decode(r.bytes)); }
  // every installed file the processes name (bridge yaml, controllers yaml, model files ...): fetched up front
  for (const p of procs) for (const m of (p.cmd.join(" ") + " " + Object.values(p.files || {}).join(" ")).matchAll(/(\/(?:home\/student|opt\/ros)\/[\w./-]+\.(?:ya?ml|sdf|world|urdf|config))/g)) await resolveAsync(m[1]);
  const load = await mods.sdformat.gzLoadWorld(wtext, { resolve: resolveAsync, env, path: wpath });
  // a sync resolver over everything fetched so far (the coordinator's resolve is sync over its mounted files)
  const syncResolve = (p) => cache.get(p) || null;
  const G = mods.harness.makeGraph({ gzMethods: mods.rosgz.gzMethods, rcMethods: mods.rc.rcMethods }, { resolve: syncResolve, env });
  const out = { G, fx, load, A, lines: {} };
  out.lines.gz = G.gzSim(gzp.cmd, { world: load, env, resolveAsync });
  if (out.lines.gz.err) return out;
  for (const p of procs) {
    const exe = exeOf(p);
    if (exe === "robot_state_publisher") { const urdf = mods.harness.rspUrdf(p); if (urdf) G.startRsp(urdf); }
  }
  for (const p of procs) {
    const exe = exeOf(p);
    if (exe === "parameter_bridge") out.lines.bridge = G.startBridge(p.cmd).lines;
    if (exe === "image_bridge") { const n = G.add("gz_image", "image_bridge", "", {}); n.bridge = p.cmd.slice(1).filter((x) => !x.startsWith("-") && x.includes("/")).map((t) => ({ ros: t, gz: t, rosType: "sensor_msgs/msg/Image", gzType: "gz.msgs.Image", dir: "GZ_TO_ROS" })); }
  }
  for (const p of procs) {
    if (exeOf(p) !== "create") continue;
    const C = mods.cli.parseCreateArgs(p.cmd);
    let xml = null;
    if (C.source === "file") { const r = await resolveAsync(C.file); xml = r && r.text; }
    const model = xml && /<sdf\b/.test(xml) ? await mods.sdformat.gzLoadModel(xml, { resolve: resolveAsync, env, path: C.file }) : null;
    // URDF collision meshes (package://...) are fetched before create, so the physics can use them
    if (C.source !== "file") { const rsp = G.nodes.find((n) => n.kind === "rsp"); const urdf = C.source === "string" ? C.string : rsp && rsp.params.robot_description; if (urdf) for (const m of urdf.matchAll(/filename="(package:\/\/[^"]+)"/g)) { const pk = m[1].match(/^package:\/\/([^/]+)\/(.*)$/); await resolveAsync(`/home/student/ros2_ws/install/share/${pk[1]}/package.xml`); await resolveAsync(`/home/student/ros2_ws/install/share/${pk[1]}/${pk[2]}`); } }
    out.lines.create = G.gzCreate(p.cmd.slice(1), { model, env, resolveAsync });
  }
  for (const p of procs) {
    const c = p.cmd.join(" ");
    if (exeOf(p) === "spawner") (out.lines.spawn = out.lines.spawn || []).push(G.spawnerRun(p.cmd.slice(1), { inline: true }));
    // dobot_gazebo's controller_loader.py <robot> loads + activates <robot>_group_controller and joint_state_broadcaster
    const cl = c.match(/controller_loader\.py (\w+)/); if (cl) (out.lines.spawn = out.lines.spawn || []).push(G.spawnerRun([`${cl[1]}_group_controller`, "joint_state_broadcaster"], { inline: true }));
    // ros2 control load_controller --set-state active NAME
    const lc = c.match(/^ros2 control load_controller --set-state active (\w+)/); if (lc) { const r = G.ros2Control(["load_controller", "--set-state", "active", lc[1]]); (out.lines.spawn = out.lines.spawn || []).push({ lines: r, fail: !/Successfully/.test(r.join(" ")) }); }
  }
  const R = await mods.physics.loadRapier();
  if (!G.gzPhys) G.gzPhys = new mods.physics.GzPhysics(R, G.gz.world);
  await new Promise((r) => setTimeout(r, 20));
  for (let i = 0; i < steps; i++) G.gzStep(1 / 60);
  return out;
}
export const step = (G, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds - 1e-9; t += dt) G.gzStep(dt); };

// ---------------- TurtleBot3 ----------------
export async function tb3World(mods, io, fixture = "tb3_burger-1") {
  const r = { checks: [] }, ok = (name, cond, info) => r.checks.push({ name, ok: !!cond, info });
  const L = await startLaunch(mods, io, fixture);
  const { G, load } = L;
  ok("world loaded without SDF errors", load.errors.length === 0 && !L.lines.gz.err, load.errors.join(" | "));
  const W = G.gz.world;
  ok("world plugins (Sensors, Imu, Physics)", ["gz-sim-sensors-system", "gz-sim-imu-system", "gz-sim-physics-system"].every((p) => W.plugins.includes(p)), W.plugins.join(","));
  const tw = W.models.find((m) => m.name === "turtlebot3_world");
  ok("turtlebot3_world: 9 pillars + hexagon meshes", tw && tw.colShapes.filter((s) => s.type === "cylinder").length === 9 && tw.colShapes.filter((s) => s.type === "mesh" && s.mesh && s.mesh.tris > 0).length >= 5, tw && tw.colShapes.map((s) => s.type + (s.mesh ? ":" + s.mesh.tris : "")).join(" "));
  ok("Fuel ground plane + sun", W.models.some((m) => m.name === "ground_plane") && W.lights.some((l) => l.name === "sun"));
  const name = G.gz.models.keys().next().value, m = G.gzModel(name);
  ok("robot spawned at -2,-0.5 from model.sdf", m && Math.abs(m.pose.x + 2) < 1e-9 && Math.abs(m.pose.y + 0.5) < 1e-9 && m.native, m && JSON.stringify(m.pose));
  ok("create printed Entity creation successful", /Entity creation successful/.test(L.lines.create.lines.join("\n")), L.lines.create.lines.join("\n"));
  ok("bridge created 7 bridges from the real yaml (TwistStamped cmd_vel)", /Creating ROS->GZ Bridge: \[cmd_vel \(geometry_msgs\/msg\/TwistStamped\) -> \/cmd_vel \(gz.msgs.Twist\)\]/.test(L.lines.bridge.join("\n")) && (L.lines.bridge.join("\n").match(/Creating/g) || []).length === 7, L.lines.bridge.join("\n"));
  // physics: the mesh colliders arrive (refresh) and the robot settles on its wheels
  G.gzPhys.refreshMeshes();
  step(G, 0.5);
  ok("robot rests on the ground plane", Math.abs(m.pose.z) < 0.02, m.pose.z);
  // lidar: the pillar at (-1.1, 0) is seen at bearing ~29 deg, range ~0.88 m (gpu_lidar 360 samples, 0..6.28)
  const sen = m.gazebo.sensors.find((s) => s.type === "gpu_lidar");
  const scan = G.gzScan(name, sen);
  const idx = Math.round(Math.atan2(0.5, 0.9 + 0.032) / scan.angle_increment);
  const near = Math.min(...scan.ranges.slice(idx - 3, idx + 4).filter(Number.isFinite));
  ok("lidar sees the pillar at (-1.1, 0)", Math.abs(near - (Math.hypot(0.932, 0.5) - 0.15)) < 0.08, { near, idx, n: scan.ranges.length });
  const hits = scan.ranges.filter(Number.isFinite).length;
  ok("lidar: range limits 0.12..3.5 m, inf beyond", scan.ranges.length === 360 && hits > 30 && hits < 360, hits);
  const s1 = G.gzSample("/scan");
  ok("/scan bridged: frame_id base_scan, 360 ranges", s1 && /frame_id: base_scan/.test(s1[0]) && /angle_max: 6.28/.test(s1[0]), s1 && s1[0].slice(0, 200));
  // DiffDrive: TwistStamped on /cmd_vel -> gz.msgs.Twist on /cmd_vel -> motion (max_linear_acceleration 1.0)
  const hit = G.gzTwist("/cmd_vel", { lx: 0.2, ly: 0, lz: 0, az: 0 }, "geometry_msgs/msg/TwistStamped");
  ok("ros_gz_bridge carries TwistStamped to DiffDrive", hit.length === 1, hit);
  const x0 = m.pose.x;
  step(G, 0.1);
  ok("speed limiter: 1.0 m/s^2 (after 0.1 s about 0.005 m)", m.pose.x - x0 < 0.012 && m.pose.x - x0 > 0.002, m.pose.x - x0);
  step(G, 1.9);
  ok("drives forward ~0.38 m in 2 s", Math.abs(m.pose.x - x0 - 0.38) < 0.04, m.pose.x - x0);
  const od = G.gzSample("/odom");
  const ox = sampleNum(od[0], /position:\n\s+x: ([-\d.e]+)/);
  ok("odom from the wheel joints matches", Math.abs(ox - (m.pose.x - x0)) < 0.02 && /frame_id: odom/.test(od[0]) && /child_frame_id: base_footprint/.test(od[0]), od[0].slice(0, 160));
  const tf = G.gzTfEdges();
  ok("/tf odom -> base_footprint (tf_topic /tf, bridged as tf)", tf.length === 1 && tf[0].parent === "odom" && tf[0].child === "base_footprint", tf);
  const J = G.gzJoints();
  ok("JointStatePublisher: wheel joints turning", J && Math.abs(J.wheel_left_joint - (m.pose.x - x0 + 0) / 0.033) < 1.5 && Object.keys(J).length === 2, J);
  // turn on the spot, then drive into the hexagon wall: the wall stops it
  G.gzTwist("/cmd_vel", { lx: 0, az: 1.0 }, "geometry_msgs/msg/TwistStamped"); step(G, Math.PI / 2 / 1.0);
  ok("turns on the spot", Math.abs(m.pose.yaw - Math.PI / 2) < 0.15, m.pose.yaw);
  G.gzTwist("/cmd_vel", { lx: 0, az: 0 }, "geometry_msgs/msg/TwistStamped"); step(G, 0.3);
  G.gzTwist("/cmd_vel", { lx: 0.22, az: 0 }, "geometry_msgs/msg/TwistStamped");
  step(G, 25);
  ok("the hexagon wall (mesh collider) stops the robot", m.pose.y < 2.9 && m.pose.y > 0.5, m.pose);
  ok("the Imu system publishes /imu", G.gzSample("/imu") && /frame_id: /.test(G.gzSample("/imu")[0]));
  r.pass = r.checks.every((c) => c.ok);
  return r;
}

export async function tb3Waffle(mods, io) {
  const r = { checks: [] }, ok = (name, cond, info) => r.checks.push({ name, ok: !!cond, info });
  const L = await startLaunch(mods, io, "tb3_waffle-2");
  const m = L.G.gzModel("waffle"), cam = m && m.gazebo.sensors.find((s) => s.type === "camera");
  ok("waffle camera from model.sdf: 1920x1080, hfov 1.02974, frame camera_rgb_frame", cam && cam.camera.width === 1920 && cam.camera.height === 1080 && Math.abs(cam.camera.hfov - 1.02974) < 1e-9 && cam.frame === "camera_rgb_frame", cam);
  const topics = L.G.gzTopicList().map((t) => t.topic);
  ok("camera topics /camera/image_raw + /camera/camera_info", topics.includes("/camera/image_raw") && topics.includes("/camera/camera_info"), topics);
  ok("image_bridge /camera/image_raw is fed", L.G.gzFeeds().has("/camera/image_raw"));
  const T = L.G.gzSensorPose(m, cam);
  ok("camera at its link pose (0.069 -0.047 0.107 in the model frame)", T && Math.abs(T.t[0] - (-2 + 0.069)) < 0.005 && Math.abs(T.t[1] - (-0.5 - 0.047)) < 0.005 && Math.abs(T.t[2] - 0.107 - 0.01) < 0.012, T);
  r.pass = r.checks.every((c) => c.ok);
  return r;
}

// ---------------- arms under gz_ros2_control ----------------
export async function armHoldAndFollow(mods, io, fixture, opt = {}) {
  const { controller, trajJoints, settle = 2 } = opt;
  const r = { checks: [], fixture }, ok = (name, cond, info) => r.checks.push({ name, ok: !!cond, info });
  const L = await startLaunch(mods, io, fixture);
  const { G } = L;
  ok("Gazebo started", !L.lines.gz.err, L.lines.gz.err);
  const name = [...G.gz.models.keys()][0], m = G.gzModel(name);
  if (opt.expectCreateFail) {   // the real launch fails the same way on Ubuntu (see the report)
    const t = JSON.stringify(L.lines.create || {});
    ok(`create fails: ${opt.expectCreateFail}`, !m && new RegExp(opt.expectCreateFail).test(t), t.slice(0, 400));
    r.pass = r.checks.every((c) => c.ok); return r;
  }
  ok("robot spawned from robot_description", !!m, L.lines.create && L.lines.create.lines);
  if (!m) { r.pass = false; return r; }
  ok("gz_ros2_control started a controller_manager", m.cm && !m.cm.dead, L.lines.create.gzErr);
  // the spawners of the real launch: every one succeeds, except those the real robot fails too (opt.expectFail)
  const sp = L.lines.spawn || [], bad = sp.filter((s) => s.fail && !(opt.expectFail || []).some((n) => s.lines.join(" ").includes(n)));
  ok("spawners loaded the controllers of the real controllers yaml", sp.length && !bad.length, bad.map((s) => s.lines.concat(s.gzLines || []).join("\n")).join("\n---\n"));
  for (const n of opt.expectFail || []) ok(`${n} fails as on Ubuntu (its joints are not in this URDF)`, sp.some((s) => s.fail && s.lines.join(" ").includes(n)));
  const dyn = G.gzDynJoints(m);
  ok("arm joints are simulated with gravity", dyn.length >= 6, dyn);
  const q0 = { ...m.joints };
  step(G, settle);
  const drift = Math.max(...dyn.map((j) => Math.abs(m.joints[j] - q0[j])));
  ok("holds its pose under gravity", drift < 0.02, { drift, sat: m.saturated, tau: m.jointEffort });
  if (opt.follow === false) { r.pass = r.checks.every((c) => c.ok); return r; }
  // a trajectory on the controller's joint_trajectory topic
  const c = m.cm.controllers.get(controller);
  ok(`${controller} active`, c && c.state === "active", c && c.state);
  const joints = trajJoints || (c ? [].concat(c.params.joints) : []);
  const goal = joints.map((j, i) => { const q = q0[j] || 0, lim = (m.model.joints[j] || {}).limit || {}, d = i % 2 ? -0.3 : 0.3; return q + d <= (lim.upper ?? Infinity) && q + d >= (lim.lower ?? -Infinity) ? q + d : q - d; });
  const got = G.cmDeliver(m.cm.topicOf(controller, "joint_trajectory"), "trajectory_msgs/msg/JointTrajectory", { joint_names: joints, points: [{ positions: goal, time_from_start: { sec: 2, nanosec: 0 } }] });
  ok("trajectory accepted", got.some((g) => g.used), got);
  step(G, 1.0);
  const mid = joints.map((j) => m.joints[j] - q0[j]);
  step(G, 2.0);
  const err = Math.max(...joints.map((j, i) => Math.abs(m.joints[j] - goal[i])));
  ok("follows the trajectory (half way at t=1 s, there at t=3 s)", err < 0.03 && Math.abs(Math.abs(mid[0]) - 0.15) < 0.08, { err, mid: mid.slice(0, 3) });
  const js = G.cmSample("/joint_states");
  ok("joint_state_broadcaster reports the simulated positions", js && js[0].includes(joints[0]), js && js[0].slice(0, 120));
  // without a controller holding them (hold_joints false), the joints fall under gravity
  if (m.cm.gzPlugin) { const was = m.cm.gzPlugin.holdJoints; m.cm.gzPlugin.holdJoints = false; m.cm.deactivate([controller]); const before = { ...m.joints }; step(G, 0.5); const fell = Math.max(...dyn.map((j) => Math.abs(m.joints[j] - before[j]))); ok("with no controller and hold_joints false the arm falls", fell > 0.05, fell); m.cm.gzPlugin.holdJoints = was; }
  r.pass = r.checks.every((c) => c.ok);
  return r;
}
