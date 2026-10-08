// MoveIt 2 in the practice ROS graph: what `ros2 launch <robot>_moveit_config demo.launch.py | gazebo.launch.py |
// real.launch.py` starts, read from the package's own files (SRDF, kinematics.yaml, joint_limits.yaml,
// moveit_controllers.yaml, ros2_controllers.yaml, the *_planning.yaml pipelines), and the move_group the RViz
// MotionPlanning panel talks to. Mixed into RosGraph.prototype (like gzMethods and rcMethods).
//   demo.launch.py     robot_state_publisher, move_group, rviz2, ros2_control_node (mock_components/GenericSystem), spawners
//   gazebo.launch.py   gz sim + ros_gz_sim create + gz_ros2_control (GazeboSimSystem) + spawner + move_group + rviz2 + scene objects
//   real.launch.py     move_group + rviz2; the maker's driver must provide the controller (here nothing does)
import { parseURDF } from "./urdf-core.js";
import { KinematicModel, JointGroup, CollisionModel, plan as planMotion, solveIK, fromRPY, fromQuat, linkPoints, linkSpheres, computeACM, meshPointsFrom, ERR, ERR_NAME, OMPL_PLANNERS } from "./moveit-core.js";
import { ControllerManager } from "./ros2-control.js";
import { armReach } from "./moveit-config.js";
import { blockYaml } from "./urdf-core.js";
import { poseMethods, servoGraphMethods } from "./moveit-servo.js";

const stampNow = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };
const attrs = (s) => Object.fromEntries([...String(s).matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));

// ---------------- SRDF ----------------
export function parseSrdf(text) {
  const t = String(text || "").replace(/<!--[\s\S]*?-->/g, "");
  const out = { name: (t.match(/<robot\b[^>]*name="([^"]+)"/) || [])[1] || "", groups: {}, states: {}, ee: [], disabled: [], virtual: [], passive: [] };
  for (const g of t.matchAll(/<group\s+name="([^"]+)"\s*>([\s\S]*?)<\/group>/g)) {
    const body = g[2], grp = { name: g[1], chain: null, joints: [], links: [], subgroups: [] };
    const ch = body.match(/<chain\b([^>]*)\/?>/); if (ch) { const a = attrs(ch[1]); grp.chain = { base: a.base_link, tip: a.tip_link }; }
    for (const j of body.matchAll(/<joint\b([^>]*)\/?>/g)) grp.joints.push(attrs(j[1]).name);
    for (const l of body.matchAll(/<link\b([^>]*)\/?>/g)) grp.links.push(attrs(l[1]).name);
    for (const s of body.matchAll(/<group\b([^>]*)\/?>/g)) grp.subgroups.push(attrs(s[1]).name);
    out.groups[g[1]] = grp;
  }
  for (const s of t.matchAll(/<group_state\b([^>]*)>([\s\S]*?)<\/group_state>/g)) {
    const a = attrs(s[1]); (out.states[a.group] = out.states[a.group] || {})[a.name] = Object.fromEntries([...s[2].matchAll(/<joint\b([^>]*)\/?>/g)].map((m) => { const b = attrs(m[1]); return [b.name, Number(b.value)]; }));
  }
  for (const e of t.matchAll(/<end_effector\b([^>]*)\/?>/g)) out.ee.push(attrs(e[1]));
  for (const d of t.matchAll(/<disable_collisions\b([^>]*)\/?>/g)) { const a = attrs(d[1]); out.disabled.push({ link1: a.link1, link2: a.link2, reason: a.reason }); }
  for (const v of t.matchAll(/<virtual_joint\b([^>]*)\/?>/g)) out.virtual.push(attrs(v[1]));
  for (const p of t.matchAll(/<passive_joint\b([^>]*)\/?>/g)) out.passive.push(attrs(p[1]).name);
  return out;
}
// a group given as a joint list (an SRDF <group> with <joint> entries, e.g. a gripper): same interface as JointGroup, no IK
function jointListGroup(K, name, joints, limits) {
  const G = Object.create(JointGroup.prototype);
  G.K = K; G.name = name; G.base = K.root; G.tip = null; G.chain = [];
  G.joints = joints.filter((n) => K.model.joints[n] && ["revolute", "continuous", "prismatic"].includes(K.model.joints[n].type) && !K.model.joints[n].mimic);
  const J = (n) => K.model.joints[n];
  G.lower = G.joints.map((n) => (J(n).limit && J(n).type !== "continuous" ? J(n).limit.lower : -Math.PI));
  G.upper = G.joints.map((n) => (J(n).limit && J(n).type !== "continuous" ? J(n).limit.upper : Math.PI));
  G.setLimits(limits);
  return G;
}
// moveit_controllers.yaml -> [{ name, joints, def }]
function readMoveitControllers(text) {
  const y = blockYaml(text || ""), m = y.moveit_simple_controller_manager || {};
  return (m.controller_names || []).map((c) => ({ name: c, joints: (m[c] && m[c].joints) || [], def: !!(m[c] && m[c].default), action: (m[c] && m[c].action_ns) || "follow_joint_trajectory" }));
}
function readJointLimits(text) { const y = blockYaml(text || ""); return y.joint_limits || {}; }

// ---------------- the move_group the RViz MotionPlanning panel talks to ----------------
export class MoveGroup {
  constructor(graph, o) {
    Object.assign(this, o);   // { pkg, robot, mode, urdf, model, srdf, config, controllers, limits, kinematics, cart }
    this.graph = graph;
    this.K = new KinematicModel(this.model);
    this.objects = [];          // planning scene world objects: { id, type, dims, pose(3x4), color }
    this.ready = false; this.status = "Loading the robot's collision model ..."; this.listeners = new Set();
    this.acm = new Set(this.srdf.disabled.map((d) => `${d.link1}|${d.link2}`));
    this.groupCache = new Map();
    this.lastResult = null; this.executing = null; this.sceneVersion = 0;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { for (const f of this.listeners) try { f(ev); } catch { /* a closed panel */ } }
  // a log line of the move_group process (or of rviz2), printed in the terminal that launched it, as `ros2 launch` shows it:
  // [move_group-4] [ERROR] [1760000000.123456789] [move_group.moveit.moveit.ros.move_group.move_action]: ...
  log(text, level = "INFO", logger = "move_group") { this.say(this.node, text, level, logger); this.emit({ type: "log", text, level, logger }); }
  rvizLog(text, level = "INFO", logger = "move_group_interface") { const rz = this.graph.nodes.find((n) => n.kind === "rviz"); if (rz) this.say(rz.full, text, level, logger); }
  say(full, text, level, logger) {
    if (level === "DEBUG") return;   // move_group logs at INFO by default
    const g = this.graph, n = g.node(full), tag = n && n.procName ? `[${n.procName}] ` : "";
    (g.notices = g.notices || []).push({ node: full, text: `${tag}[${level}] [${stampNow()}] [${logger}]: ${text}`, cls: level === "INFO" ? "" : "warn-line" });
    if (g.onNotice) g.onNotice();
  }
  async init(readMesh, pre) {
    try {
      this.spheres = pre && pre.spheres ? pre.spheres : linkSpheres(await linkPoints(this.model, readMesh));
      const g = this.groupNames().map((n) => this.group(n)).find((x) => x && x.tip); this.reach = g ? armReach(this.K, g) : 1;
      this.ready = true; this.status = "";
      this.emit({ type: "ready" });
    } catch (e) { this.status = `Could not build the collision model: ${e.message}`; this.emit({ type: "error", text: this.status }); }
  }
  groupNames() { return Object.keys(this.srdf.groups); }
  group(name) {
    if (this.groupCache.has(name)) return this.groupCache.get(name);
    const g = this.srdf.groups[name]; if (!g) return null;
    let G;
    if (g.chain) { G = new JointGroup(this.K, name, g.chain.base, g.chain.tip, this.limits); }
    else G = jointListGroup(this.K, name, g.joints, this.limits);
    const kin = this.kinematics[name] || {};
    G.positionOnly = !!kin.position_only_ik || (G.tip && G.dof < 6);
    G.solver = kin.kinematics_solver || null;
    this.groupCache.set(name, G);
    return G;
  }
  collision(G) {
    const CM = new CollisionModel(this.K, this.spheres || {}, { acm: this.acm, group: G });
    CM.setObjects(this.objects);
    return CM;
  }
  // the robot's current joint values (what /joint_states says)
  current() { return { ...this.graph.jointValues() }; }
  namedStates(group) { return (this.srdf.states[group] || {}); }
  pipelines() {
    const has = (f) => this.config[f] !== undefined;
    const out = [];
    if (has("ompl_planning.yaml")) out.push({ id: "ompl", planners: OMPL_PLANNERS.map((p) => `${p}kConfigDefault`), def: "RRTConnectkConfigDefault" });
    if (has("pilz_industrial_motion_planner_planning.yaml")) out.push({ id: "pilz_industrial_motion_planner", planners: ["PTP", "LIN", "CIRC"], def: "PTP" });
    if (has("chomp_planning.yaml")) out.push({ id: "chomp", planners: ["CHOMP"], def: "CHOMP" });
    if (has("stomp_planning.yaml")) out.push({ id: "stomp", planners: ["STOMP"], def: "STOMP" });
    return out;
  }
  pipelineParams(id) {
    const y = blockYaml(this.config[`${id}_planning.yaml`] || "");
    return id === "stomp" ? y.stomp_moveit || {} : y;
  }
  // a MotionPlanRequest from the panel: { group, start (values), goal (values), pipeline, planner_id, time, attempts, vel, acc }
  plan(req) {
    if (!this.ready) return { ok: false, error: "FAILURE", message: this.status || "move_group is not ready" };
    const G = this.group(req.group); if (!G) return { ok: false, error: "INVALID_GROUP_NAME", error_code: ERR.INVALID_GROUP_NAME, message: `No group named '${req.group}'` };
    const base = { ...this.current(), ...(req.startValues || {}) };
    const start = G.vec(base), goal = G.vec({ ...base, ...req.goal });
    const MA = "move_group.moveit.moveit.ros.move_group.move_action", PP = "move_group.moveit.moveit.ros.planning_pipeline";
    this.log("MoveGroupMoveAction: Received request", "INFO", MA);
    this.log("executing..", "INFO", MA);
    this.log("Planning request received for MoveGroup action. Forwarding to planning pipeline.", "INFO", MA);
    const pipes = this.pipelines().map((p) => p.id);
    if (!pipes.includes(req.pipeline)) {
      this.log(`Couldn't find requested planning pipeline '${req.pipeline}'`, "ERROR", "move_group.moveit.moveit.ros.planning_pipeline_interfaces");
      const r = { ok: false, error: "FAILURE", error_code: ERR.FAILURE, message: `Pipeline '${req.pipeline}' is not loaded (planning_pipelines: ${pipes.join(", ")})`, planning_time: 0 };
      this.log("FAILURE", "INFO", MA); this.rvizLog("MoveGroupInterface::plan() failed or timeout reached", "ERROR"); r.group = req.group; this.lastResult = r; this.emit({ type: "plan", result: r }); return r;
    }
    const pl = String(req.planner_id || "").replace(/kConfigDefault$/, "");
    if (req.pipeline === "ompl") this.log(`Planner configuration '${req.group}' will use planner 'geometric::${pl || "RRTConnect"}'. Additional configuration parameters will be set when the planner is constructed.`, "INFO", "move_group.moveit.moveit.planners.ompl.model_based_planning_context");
    if (req.pipeline === "pilz_industrial_motion_planner") this.log(`Using planning pipeline 'pilz_industrial_motion_planner' with planner '${pl || "PTP"}'`, "INFO", "move_group.moveit.moveit.planners.pilz.command_planner");
    if (req.pipeline === "stomp") this.log("Using STOMP planner", "INFO", "move_group.moveit.moveit.planners.stomp");
    const r = planMotion({ pipeline: req.pipeline, planner_id: req.planner_id, group: G, start, goal, base, CM: this.collision(G), allowed_planning_time: req.time, num_planning_attempts: req.attempts,
      max_velocity_scaling_factor: req.vel, max_acceleration_scaling_factor: req.acc, cartesianLimits: this.cart, positionOnly: G.positionOnly, params: this.pipelineParams(req.pipeline), circAux: req.circAux });
    if (r.ok) {
      if (req.pipeline === "ompl") { this.log(`${req.group}/${req.group}: Starting planning with 1 states already in datastructure`); this.log(`${req.group}/${req.group}: Created ${r.states || 2} states (1 start + ${Math.max(1, (r.states || 2) - 1)} goal)`); this.log(`Solution found in ${r.planning_time.toFixed(6)} seconds`); this.log(`SimpleSetup: Path simplification took ${(r.planning_time / 4).toFixed(6)} seconds and changed from ${r.states || 2} to ${r.simplified || 2} states`); }
      if (req.pipeline === "chomp") this.log(`Optimization core finished in ${r.iterations || 1} iterations`, "INFO", "move_group.moveit.moveit.planners.chomp.optimizer");
      if (req.pipeline === "stomp") this.log(`STOMP found a valid path after ${r.iterations || 1} iterations`, "INFO", "move_group.moveit.moveit.planners.stomp");
      this.log("Motion plan was computed successfully.", "INFO", MA);
    } else {
      // what move_group prints for each failure (moveit_ros_planning / ompl_interface / pilz / chomp / stomp)
      const E = r.error, planner = req.pipeline === "pilz_industrial_motion_planner" ? "move_group.moveit.moveit.planners.pilz.trajectory_generator" : req.pipeline === "chomp" ? "move_group.moveit.moveit.planners.chomp.planner" : req.pipeline === "stomp" ? "move_group.moveit.moveit.planners.stomp" : PP;
      if (E === "START_STATE_IN_COLLISION") { this.log(`Start state appears to be in collision with respect to group ${req.group}`, "ERROR", "move_group.moveit.moveit.ros.fix_start_state_collision"); this.log("Unable to find a valid state nearby the start state (using jiggle fraction of 0.050000 and 100 sampling attempts). Passing the original planning request to the planner.", "WARN", "move_group.moveit.moveit.ros.fix_start_state_collision"); }
      else if (E === "START_STATE_INVALID") this.log("Start state is out of the joint limits", "ERROR", "move_group.moveit.moveit.ros.fix_start_state_bounds");
      else if (E === "GOAL_IN_COLLISION") { if (req.pipeline === "ompl") this.log(`${req.group}/${req.group}: Unable to sample any valid states for goal tree`, "ERROR"); }
      else if (E === "TIMED_OUT") { this.log(`${req.group}/${req.group}: Starting planning with 1 states already in datastructure`); this.log(`No solution found after ${(req.time || 5).toFixed(6)} seconds`); this.log("Unable to solve the planning problem", "INFO", "move_group.moveit.moveit.planners.ompl.model_based_planning_context"); }
      this.log(r.message, "ERROR", E === "INVALID_MOTION_PLAN" || (E === "FAILURE" && /not valid/.test(r.message)) ? "move_group.moveit.moveit.ros.validate_solution" : planner);
      this.log(E, "INFO", MA);
      this.rvizLog("MoveGroupInterface::plan() failed or timeout reached", "ERROR");
    }
    r.group = req.group;
    this.lastResult = r;
    this.emit({ type: "plan", result: r });
    return r;
  }
  // execute: hand the trajectory to the controller that owns its joints (moveit_simple_controller_manager)
  execute(r) {
    const TEM = "move_group.moveit.moveit.ros.trajectory_execution_manager", MA = "move_group.moveit.moveit.ros.move_group.move_action", FJT = "move_group.moveit.moveit.simple_controller_manager.follow_joint_trajectory_controller_handle";
    const fail = (message) => { this.log("CONTROL_FAILED", "INFO", MA); this.rvizLog("Plan and Execute request aborted", "INFO"); this.rvizLog("MoveGroupInterface::execute() failed or timeout reached", "ERROR"); this.emit({ type: "executed", ok: false, message }); return { ok: false, message }; };
    if (!r || !r.ok) { this.rvizLog("No motion plan to execute: press Plan first", "WARN", "moveit_ros_visualization.motion_planning_frame"); return { ok: false, message: "No motion plan to execute (press Plan first)" }; }
    const joints = r.trajectory.joint_names;
    const ctl = this.controllers.find((c) => joints.every((j) => c.joints.includes(j))) || this.controllers.find((c) => joints.some((j) => c.joints.includes(j)));
    if (!ctl) {
      this.log(`Unable to identify any set of controllers that can actuate the specified joints: [ ${joints.join(" ")} ]`, "ERROR", TEM);
      this.log("Known controllers and their joints:", "ERROR", TEM);
      for (const c of this.controllers) this.log(`${c.name}: ${c.joints.join(" ")}`, "ERROR", TEM);
      this.log("Apparently trajectory initialization failed", "ERROR", "move_group.moveit.moveit.ros.plan_execution");
      return fail("No controller for these joints (moveit_controllers.yaml)");
    }
    const g = this.graph, hit = g.cmModels().find((m) => m.cm.controllers.has(ctl.name));
    const c = hit && hit.cm.controllers.get(ctl.name);
    if (!c || c.state !== "active") {
      this.log(`Action client not connected to action server: ${ctl.name}/${ctl.action}`, "ERROR", "move_group.moveit.moveit.simple_controller_manager.ActionBasedController");
      this.log(`Failed to send trajectory part 1 of 1 to controller ${ctl.name}`, "ERROR", TEM);
      this.log("Completed trajectory execution with status ABORTED ...", "INFO", TEM);
      return fail(this.mode === "real" ? `No /${ctl.name}/${ctl.action} action server: start the robot's driver first (see the README of this package).` : `${ctl.name} is not active.`);
    }
    const cur = this.current(), pts = r.trajectory.points;
    this.log("Validating trajectory with allowed_start_tolerance 0.01", "INFO", TEM);
    const dev = joints.map((j, i) => [j, Math.abs((cur[j] ?? 0) - pts[0].positions[i])]).find(([, d]) => d > 0.01);
    if (dev) {
      this.log(`Invalid Trajectory: start point deviates from current robot state more than 0.01 at joint '${dev[0]}'.`, "ERROR", TEM);
      this.log("Enable DEBUG for detailed state info.", "ERROR", TEM);
      return fail("The robot is not at the plan's start state any more: plan again.");
    }
    const msg = { joint_names: joints, points: pts.map((p) => ({ positions: p.positions, velocities: p.velocities, time_from_start: { sec: Math.floor(p.t), nanosec: Math.round((p.t % 1) * 1e9) } })) };
    const t = g.cmTime();
    const rr = hit.cm.receive(`/${ctl.name}/joint_trajectory`, "trajectory_msgs/msg/JointTrajectory", msg, t);
    if (!rr.used) { this.log(`Goal was rejected by server: ${rr.note || "rejected"}`, "ERROR", FJT); return fail(rr.note || "rejected"); }
    hit.held = false;
    this.executing = { ctl: ctl.name, cm: hit.cm, until: t + r.duration, result: r };
    this.log("Starting trajectory execution ...", "INFO", TEM);
    this.log(`sending trajectory to ${ctl.name}`, "INFO", FJT);
    this.log(`${ctl.name} started execution`, "INFO", FJT);
    this.log("Goal request accepted!", "INFO", FJT);
    const cmNode = g.nodes.find((n) => n.cm === hit.cm);
    if (cmNode) { this.say(cmNode.full, "Received new action goal", "INFO", ctl.name); this.say(cmNode.full, "Accepted new action goal", "INFO", ctl.name); }
    this.emit({ type: "execute", result: r });
    return { ok: true, controller: ctl.name };
  }
  poll() {   // called by the ticker: execution finished?
    const e = this.executing; if (!e) return;
    if (!e.cm.traj.has(e.ctl)) {
      this.executing = null;
      const cmNode = this.graph.nodes.find((n) => n.cm === e.cm); if (cmNode) this.say(cmNode.full, "Goal reached, success!", "INFO", e.ctl);
      this.log(`Controller '${e.ctl}' successfully finished`, "INFO", "move_group.moveit.moveit.simple_controller_manager.follow_joint_trajectory_controller_handle");
      this.log("Completed trajectory execution with status SUCCEEDED ...", "INFO", "move_group.moveit.moveit.ros.trajectory_execution_manager");
      this.log("Solution was found and executed.", "INFO", "move_group.moveit.moveit.ros.move_group.move_action");
      this.emit({ type: "executed", ok: true });
    }
  }
  stop() {
    const e = this.executing; if (!e) return;
    e.cm.traj.delete(e.ctl); this.executing = null;
    this.log("Stopping execution because the path to execute became invalid or was preempted", "INFO", "move_group.moveit.moveit.ros.trajectory_execution_manager");
    this.log(`${e.ctl} cancelling execution`, "INFO", "move_group.moveit.moveit.simple_controller_manager.follow_joint_trajectory_controller_handle");
    this.log("Completed trajectory execution with status PREEMPTED ...", "INFO", "move_group.moveit.moveit.ros.trajectory_execution_manager");
    this.log("PREEMPTED", "INFO", "move_group.moveit.moveit.ros.move_group.move_action");
    this.emit({ type: "executed", ok: false, preempted: true });
  }
  // planning scene
  addObject(o) { this.objects = this.objects.filter((x) => x.id !== o.id).concat([o]); this.sceneVersion++; this.emit({ type: "scene" }); }
  removeObject(id) { this.objects = this.objects.filter((x) => x.id !== id); this.sceneVersion++; this.emit({ type: "scene" }); }
  ik(groupName, poseT, seedValues) {
    const G = this.group(groupName); if (!G || !G.tip) return null;
    const base = { ...this.current(), ...(seedValues || {}) };
    const CM = this.ready ? this.collision(G) : null;
    return solveIK(G, poseT, { seed: G.vec(base), base, positionOnly: G.positionOnly, attempts: 12, iterations: 80, valid: CM ? (q) => !CM.contact(G.values(q, base), { full: true }) : null });
  }
  tipPose(groupName, values) { const G = this.group(groupName); if (!G || !G.tip) return null; const P = this.K.fk({ ...this.current(), ...values }); return P[G.tip]; }
  stateValid(values) { if (!this.ready) return true; const CM = new CollisionModel(this.K, this.spheres, { acm: this.acm, group: null }); CM.setObjects(this.objects); return CM.contact(values, { full: true }); }
}

Object.assign(MoveGroup.prototype, poseMethods);

// ---------------- launch ----------------
export const moveitMethods = {
  ...servoGraphMethods,
  // ros2 run <robot>_moveit_config pose_goal_commander.py [--ros-args -p pipeline:=... -p planner_id:=... -p cartesian:=true]
  mgPoseGoalNode(pk, extra = []) {
    if (!this.mg || !this.node(this.mg.node)) return [this.out(`[INFO] [${stampNow()}] [pose_goal_commander]: Waiting for the move_group action server (/move_action) ...`), this.hint("(Nothing serves /move_action: start MoveIt first (demo.launch.py or gazebo.launch.py), then run this again. Press Ctrl+C to stop waiting.)")];
    const params = { pipeline: "ompl", planner_id: "RRTConnectkConfigDefault", group: "", cartesian: false, execute: true, planning_time: 5.0, velocity_scaling: 0.1, acceleration_scaling: 0.1 };
    let custom = false;
    for (let i = 0; i < extra.length; i++) if (extra[i] === "-p" && extra[i + 1]) { const [k, v] = extra[i + 1].split(":="); if (k in params) { params[k] = v === "true" ? true : v === "false" ? false : v !== "" && Number.isFinite(Number(v)) ? Number(v) : v; if (k === "planner_id") custom = true; } i++; }
    if (params.pipeline !== "ompl" && !custom) params.planner_id = { pilz_industrial_motion_planner: "PTP" }[params.pipeline] || "";
    const n = this.add("pose_goal", "pose_goal_commander", "", params);
    n.params = { ...n.params, ...params };
    const grp = params.group || this.mg.groupNames().find((g) => this.mg.group(g) && this.mg.group(g).tip);
    const R = this.mg.reach || 0.8;
    this.lastStarted = [n.full];
    return [this.out(`[INFO] [${stampNow()}] [pose_goal_commander]: Connected to move_group. Group '${grp}', pipeline '${params.pipeline}'${params.planner_id ? `, planner '${params.planner_id}'` : ""}${params.cartesian ? ", Cartesian path" : ""}`),
      this.out(`[INFO] [${stampNow()}] [pose_goal_commander]: Listening for geometry_msgs/msg/PoseStamped goals on /goal_pose`),
      this.hint(`(In a + New terminal, send a goal:\n  ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped "{header: {frame_id: ${this.mg.model.root}}, pose: {position: {x: ${(0.45 * R).toFixed(2)}, y: ${(0.15 * R).toFixed(2)}, z: ${(0.45 * R).toFixed(2)}}, orientation: {x: 1.0, y: 0.0, z: 0.0, w: 0.0}}}"\nThe RViz "Pose Goal" panel on the right sends the same kind of goal with numbers.)`)];
  },
  isMoveitLaunch(text) { return /moveit_configs_utils/.test(String(text)); },
  cmTime() { return this.gzRunning() ? this.gz.time : (this.mockTime || 0); },
  mockModelList() { return this.mockModels ? [...this.mockModels.values()].filter((m) => this.node(m.cmNode)) : []; },
  // one step of the ros2_control_node with mock hardware (demo.launch.py): the joints follow the commands exactly
  mockStep(dt) {
    const list = this.mockModelList(); if (!list.length) return false;
    this.mockTime = (this.mockTime || 0) + dt;
    for (const m of list) {
      const o = m.cm.step(this.mockTime, dt);
      for (const [j, q] of Object.entries(o.position)) if (j in m.joints) m.joints[j] = q;
      m.cm.setState(Object.fromEntries(Object.keys(m.joints).map((j) => [j, { position: m.joints[j], velocity: 0 }])));
    }
    if (this.mg) { this.mg.poll(); this.mg.servoStep(dt); }
    return true;
  },
  launchMoveit(pk, file, cli, text) {
    const sh = this.sh, L = [], post = [], fulls = [];
    let count = 0; const started = (tag) => { count++; const pid = 5100 + count * 9; L.push(this.out(`[INFO] [${tag}-${count}]: process started with pid [${pid}]`)); return `${tag}-${count}`; };
    const robot = (text.match(/MoveItConfigsBuilder\(\s*["']([\w-]+)["']/) || [])[1];
    const say = (tag, lvl, src, t) => post.push((lvl === "ERROR" || lvl === "WARN" ? this.err : this.out).call(this, `[${tag}] [${lvl}] [${stampNow()}] [${src}]: ${t}`));
    L.push(this.out(`[INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-12-09-30-00-000000-ros2lab-5100`), this.out("[INFO] [launch]: Default logging verbosity is set to INFO"));
    const fail = (t, hint) => [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): ${t}`), ...(hint ? [this.hint(hint)] : [])];
    if (!robot) return fail("MoveItConfigsBuilder: could not find the robot name");
    if (!sh.rosPkgs.has("moveit_ros_move_group")) return fail("\"package 'moveit_configs_utils' not found, searching: ['/opt/ros/jazzy']\"", "Install MoveIt 2: sudo apt install ros-jazzy-moveit");
    const cfg = pk.config || {};
    const need = [`${robot}.srdf`, "kinematics.yaml", "joint_limits.yaml", "moveit_controllers.yaml", "ros2_controllers.yaml"];
    for (const f of need) if (cfg[f] === undefined) return fail(`file not found: ${sh.wsPkgs ? `/home/student/ros2_ws/install/${pk.name}/share/${pk.name}/config/${f}` : f}`, "Is the config folder installed (install(DIRECTORY ... config ...) in CMakeLists.txt), and did you colcon build and source install/setup.bash?");
    if (/servo/.test(file)) return this.launchServo(pk, Object.entries(cli).map(([k, v]) => `${k}:=${v}`));
    const mode = /gazebo/.test(file) ? "gazebo" : /real/.test(file) ? "real" : /demo/.test(file) ? "demo" : file.replace(/\.launch\.py$/, "");
    if (!["gazebo", "real", "demo", "move_group", "moveit_rviz"].includes(mode)) return fail(`the practice terminal starts demo.launch.py, gazebo.launch.py, real.launch.py, move_group.launch.py and moveit_rviz.launch.py of a MoveIt config (not ${file})`);
    if (this.mg && this.node(this.mg.node)) return fail("a move_group is already running (stop the other launch with Ctrl+C first)");
    // robot_description: xacro of config/<robot>.urdf.xacro with the hardware this launch file uses
    const hardware = mode === "gazebo" ? "gazebo" : "mock";
    const x = this.expandXacroFile(`${pk.dir}/config/${robot}.urdf.xacro`, { hardware, ...(cli.usb_port ? { usb_port: cli.usb_port } : {}) });
    if (x.err) return fail(x.err);
    let model; try { model = parseURDF(x.text); } catch (e) { return fail(`Unable to parse the URDF: ${e.message}`); }
    const srdf = parseSrdf(cfg[`${robot}.srdf`]);
    if (!Object.keys(srdf.groups).length) return fail(`The SRDF config/${robot}.srdf has no planning groups`);
    const controllers = readMoveitControllers(mode === "real" && cfg["moveit_controllers_real.yaml"] !== undefined ? cfg["moveit_controllers_real.yaml"] : cfg["moveit_controllers.yaml"]);
    const kin = blockYaml(cfg["kinematics.yaml"]);
    const cart = (blockYaml(cfg["pilz_cartesian_limits.yaml"] || "").cartesian_limits) || null;
    const limits = readJointLimits(cfg["joint_limits.yaml"]);
    const ctrlNames = blockYaml(cfg["ros2_controllers.yaml"]).controller_manager;
    const spawnList = ["joint_state_broadcaster", ...controllers.map((c) => c.name).filter((c) => ctrlNames && ctrlNames.ros__parameters && ctrlNames.ros__parameters[c])];
    // ---- Gazebo (gazebo.launch.py)
    if (mode === "gazebo") {
      if (!sh.rosPkgs.has("ros_gz_sim")) return fail("\"package 'ros_gz_sim' not found, searching: ['/opt/ros/jazzy']\"", "Install Gazebo for ROS 2: sudo apt install ros-jazzy-ros-gz ros-jazzy-gz-ros2-control");
      const tag = "ruby $(which gz) sim-1";
      const g = this.gzSim(["-r", "-v", "1", `$FINDSHARE:${pk.name}/worlds/${robot}_moveit.sdf`], { tag });
      if (g.err) return [...L, ...g.err.map((t) => this.err(t))];
      count++; g.node.pid = 5100 + count * 9; g.node.procName = tag; fulls.push(g.node.full); L.push(this.out(`[INFO] [${tag}]: process started with pid [${g.node.pid}]`));
      const br = this.add("gz_bridge", "ros_gz_bridge", "", { use_sim_time: true }); br.bridge = this.bridgeEntries(["/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock"]).entries; br.procName = started("parameter_bridge"); fulls.push(br.full);
      post.push(...this.bridgeLines(br, br.procName).map((t) => this.out(t)));
    }
    // ---- robot_state_publisher
    if (mode !== "move_group" && mode !== "moveit_rviz") {
      const rsp = this.add("rsp", "robot_state_publisher", "", { robot_description: x.text, ...(mode === "gazebo" ? { use_sim_time: true } : {}) });
      const t = started("robot_state_publisher"); rsp.procName = t; fulls.push(rsp.full);
      post.push(...this.rspMessages(rsp).map((s) => this.out(`[${t}] ${s.replace(/^\[(INFO|WARN|ERROR)\] \[robot_state_publisher\]/, `[$1] [${stampNow()}] [robot_state_publisher]`)}`)));
    }
    // ---- ros2_control: mock hardware (demo) or gz_ros2_control (gazebo)
    if (mode === "demo") {
      const cm = new ControllerManager({ urdf: x.text, yaml: { path: `/home/student/ros2_ws/install/${pk.name}/share/${pk.name}/config/ros2_controllers.yaml`, text: cfg["ros2_controllers.yaml"] }, joints: Object.values(model.joints).filter((j) => !["fixed", "floating", "planar"].includes(j.type) && !j.mimic).map((j) => j.name), name: "controller_manager" });
      const n = this.add("cm", "controller_manager", "", { update_rate: cm.updateRate }); n.ptypes = { update_rate: "integer" }; n.cm = cm; n.model = robot;
      const t = started("ros2_control_node"); n.procName = t; fulls.push(n.full);
      const joints = {}; for (const j of cm.modelJoints) joints[j] = cm.jointPos(j);
      this.mockModels = this.mockModels || new Map();
      this.mockModels.set(robot, { name: robot, urdf: x.text, model, joints, cm, mock: true, cmNode: n.full });
      say(t, "INFO", "resource_manager", "Loading hardware 'mock_components/GenericSystem'");
      say(t, "INFO", "resource_manager", `Initialize hardware '${robot}_system'`);
      say(t, "INFO", "resource_manager", `Successful 'activate' of hardware '${robot}_system'`);
      say(t, "INFO", "controller_manager", `update rate is ${cm.updateRate} Hz`);
    }
    if (mode === "gazebo") {
      const ct = started("create");
      const cr = this.gzCreate(["-topic", "robot_description", "-name", robot, "-z", "0.0"], { tag: ct });
      post.push(...cr.lines.map((t) => (/\[ERROR\]/.test(t) ? this.err(t) : this.out(t))));
      if (cr.gzErr) post.push(...cr.gzErr.map((t) => this.err(`[ruby $(which gz) sim-1] ${t}`)));
      if (cr.gzInfo) post.push(...cr.gzInfo.map((t) => this.out(`[ruby $(which gz) sim-1] ${t}`)));
      post.push(cr.fail ? this.err(`[ERROR] [${ct}]: process has died`) : this.out(`[INFO] [${ct}]: process has finished cleanly`));
      if (cr.fail) return [...L, ...post];
    }
    if (mode === "demo" || mode === "gazebo") {
      const st = started("spawner");
      const sr = this.spawnerRun([...spawnList, "--controller-manager", "/controller_manager"], { tag: st, inline: true });
      post.push(...sr.lines);
      if (sr.gzLines) post.push(...sr.gzLines.map((t) => (/\[(ERROR|WARN)\]/.test(t) ? this.err : this.out).call(this, `[${mode === "gazebo" ? "ruby $(which gz) sim-1" : "ros2_control_node-3"}] ${t}`)));
      post.push(sr.fail ? this.err(`[ERROR] [${st}]: process has died [exit code 1]`) : this.out(`[INFO] [${st}]: process has finished cleanly`));
      if (sr.hint) post.push(this.hint(`(${sr.hint})`));
    }
    // ---- move_group
    let mg = null;
    if (mode !== "moveit_rviz") {
      const n = this.add("move_group", "move_group", "", { use_sim_time: mode === "gazebo", "planning_pipelines.pipeline_names": this.mgPipelineNames(cfg), default_planning_pipeline: "ompl", "robot_description_semantic": cfg[`${robot}.srdf`] });
      const t = started("move_group"); n.procName = t; fulls.push(n.full);
      mg = new MoveGroup(this, { pkg: pk.name, robot, mode, urdf: x.text, model, srdf, config: cfg, controllers, limits, kinematics: kin, cart, node: n.full });
      this.mg = mg; n.mg = mg;
      for (const p of mg.pipelines()) {
        const plugin = { ompl: "ompl_interface/OMPLPlanner", pilz_industrial_motion_planner: "pilz_industrial_motion_planner/CommandPlanner", chomp: "chomp_interface/CHOMPPlanner", stomp: "stomp_moveit/StompPlanner" }[p.id];
        say(t, "INFO", "move_group.moveit.moveit.ros.planning_pipeline", `Successfully loaded planner '${plugin.split("/").pop()}'`);
        say(t, "INFO", "move_group", `Using planning interface '${{ ompl: "OMPL", pilz_industrial_motion_planner: "Pilz Industrial Motion Planner", chomp: "CHOMP", stomp: "STOMP" }[p.id]}'`);
      }
      for (const c of controllers) say(t, "INFO", "move_group.moveit.moveit.plugins.simple_controller_manager", `Added FollowJointTrajectory controller for ${c.name}`);
      say(t, "INFO", "move_group.moveit.moveit.ros.move_group.context", `MoveGroup context using planning plugin ompl_interface/OMPLPlanner`);
      say(t, "INFO", "move_group.moveit.moveit.ros.move_group.context", "MoveGroup context initialization complete");
      post.push(this.out(`[${t}] `), this.out(`[${t}] You can start planning now!`), this.out(`[${t}] `));
      if (mode === "real") post.push(this.hint(`(real.launch.py: MoveIt plans for the real robot. Its controller (${controllers.map((c) => "/" + c.name + "/" + c.action).join(", ")}) is run by the maker's driver, which is not running here, so Execute fails with "Action client not connected", exactly as on Ubuntu without the robot. Start the driver first; the commands are in this package's README.md.)`));
      // the collision model: saved spheres for a gallery arm, otherwise fitted to the meshes now
      const readMesh = async (fn) => {
        const m = String(fn).match(/^package:\/\/([\w-]+)\/(.+)$/); const pkk = m && sh.wsPkgs && sh.wsPkgs.get(m[1]);
        const parts = m ? m[2].split("/") : [], dir = parts.shift(), c = pkk && pkk[dir] ? pkk[dir][parts.join("/")] : null, u = c && String(c).match(/^@url:(.+)$/);
        if (!u) return [];
        const r = await fetch(u[1]); if (!r.ok) return [];
        const ext = String(fn).split(".").pop().toLowerCase(); return meshPointsFrom(ext === "stl" ? await r.arrayBuffer() : await r.text(), ext);
      };
      (async () => { let pre = null; try { const r = await fetch(`/robots/moveit/${robot}.json`); if (r.ok) pre = JSON.parse(await r.text()); } catch { pre = null; } await mg.init(readMesh, pre); })();
    }
    // ---- RViz with the MotionPlanning display
    if (mode !== "move_group") {
      const rz = this.add("rviz", "rviz2", "", mode === "gazebo" ? { use_sim_time: true } : {});
      const t = started("rviz2"); rz.procName = t; fulls.push(rz.full);
      const content = cfg["moveit.rviz"], full = `/home/student/ros2_ws/install/${pk.name}/share/${pk.name}/config/moveit.rviz`;
      if (this.sh.viz) { this.sh.viz.displays = { Grid: true }; this.sh.viz.fixedFrame = "map"; }
      post.push(this.out(`[${t}] [INFO] [${stampNow()}] [rviz2]: Stereo is NOT SUPPORTED`), this.out(`[${t}] [INFO] [${stampNow()}] [rviz2]: OpenGl version: 4.6 (GLSL 4.6)`));
      if (content !== undefined) { const rr = this.rvizConfig(null, content); if (rr) post.push(...rr); if (this.sh.viz) this.sh.viz.configName = full; }
      post.push(this.out(`[${t}] [INFO] [${stampNow()}] [moveit_rviz_plugin]: MoveGroup namespace changed: / -> . Reloading params.`), this.out(`[${t}] [INFO] [${stampNow()}] [moveit_ros_visualization.motion_planning_frame]: MoveGroup context initialization complete`));
    }
    // ---- gazebo.launch.py also adds the work cell's obstacles to the planning scene
    if (mode === "gazebo" && mg) {
      const t = started("add_scene_objects.py");
      post.push(...this.mgSceneScript(pk, t));
      post.push(this.out(`[INFO] [${t}]: process has finished cleanly`));
    }
    if (mode === "demo") post.push(this.hint(`(MoveIt is running with mock hardware. In RViz, drag the interactive marker at the tool, choose the planning pipeline in the Context tab, then Plan and Execute in the Planning tab. To add the work cell's obstacles (table, box, post), run in a + New terminal: cd ~/ros2_ws && source install/setup.bash && ros2 run ${pk.name} add_scene_objects.py)`));
    L.push(...post);
    this.lastStarted = fulls;
    return L;
  },
  mgPipelineNames(cfg) { return ["ompl", "pilz_industrial_motion_planner", "chomp", "stomp"].filter((p) => cfg[`${p}_planning.yaml`] !== undefined); },
  // scripts/add_scene_objects.py: read its OBJECTS list and apply it to move_group's planning scene
  mgSceneScript(pk, tag) {
    const sh = this.sh, now = stampNow();
    const P = (lvl, t) => (lvl === "ERROR" ? this.err : this.out).call(this, `${tag ? `[${tag}] ` : ""}[${lvl}] [${now}] [add_scene_objects]: ${t}`);
    const src = sh.node(`${pk.dir}/scripts/add_scene_objects.py`);
    if (!src) return [this.err(`No executable found`)];
    if (!this.mg || !this.node(this.mg.node)) return [P("INFO", "waiting for move_group (/apply_planning_scene) ..."), this.hint("(Nothing answers /apply_planning_scene: start MoveIt first (demo.launch.py or gazebo.launch.py), then run this again. Press Ctrl+C to stop waiting.)")];
    const objs = [];
    for (const m of String(src.content).matchAll(/\(\s*'([\w-]+)'\s*,\s*SolidPrimitive\.(BOX|CYLINDER|SPHERE)\s*,\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]\s*\)/g)) {
      const dims = m[3].split(",").map(Number), xyz = m[4].split(",").map(Number);
      objs.push({ id: m[1], type: m[2].toLowerCase(), dims, pose: fromRPY(xyz, [0, 0, 0]), xyz });
    }
    for (const o of objs) this.mg.addObject(o);
    this.mg.log(`Planning scene: added ${objs.map((o) => o.id).join(", ")} (apply_planning_scene)`);
    return [P("INFO", `planning scene: added ${objs.map((o) => o.id).join(", ")}`)];
  },
  mgEndpoints(n, e) {
    this.servoEndpoints(n, e);
    if (n.kind !== "move_group") return;
    e.pubs.push(["/display_planned_path", "moveit_msgs/msg/DisplayTrajectory"], ["/monitored_planning_scene", "moveit_msgs/msg/PlanningScene"], ["/display_contacts", "visualization_msgs/msg/MarkerArray"], ["/motion_plan_request", "moveit_msgs/msg/MotionPlanRequest"]);
    e.subs.push(["/joint_states", "sensor_msgs/msg/JointState"], ["/planning_scene", "moveit_msgs/msg/PlanningScene"], ["/collision_object", "moveit_msgs/msg/CollisionObject"], ["/attached_collision_object", "moveit_msgs/msg/AttachedCollisionObject"], ["/trajectory_execution_event", "std_msgs/msg/String"], ["/tf", "tf2_msgs/msg/TFMessage"], ["/tf_static", "tf2_msgs/msg/TFMessage"]);
    e.srvs.push(["/apply_planning_scene", "moveit_msgs/srv/ApplyPlanningScene"], ["/get_planning_scene", "moveit_msgs/srv/GetPlanningScene"], ["/compute_ik", "moveit_msgs/srv/GetPositionIK"], ["/compute_fk", "moveit_msgs/srv/GetPositionFK"], ["/plan_kinematic_path", "moveit_msgs/srv/GetMotionPlan"], ["/compute_cartesian_path", "moveit_msgs/srv/GetCartesianPath"], ["/check_state_validity", "moveit_msgs/srv/GetStateValidity"], ["/query_planner_interface", "moveit_msgs/srv/QueryPlannerInterfaces"], ["/clear_octomap", "std_srvs/srv/Empty"]);
    e.acts.push(["/move_action", "moveit_msgs/action/MoveGroup"], ["/execute_trajectory", "moveit_msgs/action/ExecuteTrajectory"]);
    if (n.mg) for (const c of n.mg.controllers) e.actc.push([`/${c.name}/${c.action}`, "control_msgs/action/FollowJointTrajectory"]);
    if (n.mg && n.mg.pipelines().some((p) => p.id === "pilz_industrial_motion_planner")) { e.acts.push(["/sequence_move_group", "moveit_msgs/action/MoveGroupSequence"]); e.srvs.push(["/plan_sequence_path", "moveit_msgs/srv/GetMotionSequence"]); }
  },
};
export { fromQuat, ERR_NAME };
