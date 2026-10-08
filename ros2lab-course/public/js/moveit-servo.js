// Pose goals, Cartesian paths and MoveIt Servo for the practice move_group (ros-moveit.js):
//   - planPose: a goal given as a pose (RViz "Pose Goal" panel, /goal_pose for the pose_goal_commander node): IK, then plan
//   - cartesianPath: RViz "Use Cartesian Path" / move_group's /compute_cartesian_path (straight line of the tool, eef_step)
//   - servo: moveit_servo's servo_node (MoveIt 2.12, Jazzy): /servo_node/delta_twist_cmds (TwistStamped),
//     /servo_node/delta_joint_cmds (JointJog), /servo_node/pose_target_cmds (PoseStamped), the services
//     /servo_node/switch_command_type (0 JOINT_JOG, 1 TWIST, 2 POSE) and /servo_node/pause_servo; it streams
//     trajectory_msgs/JointTrajectory to the arm's joint_trajectory_controller, and halts near collisions and joint limits.
import { solveIK, fromQuat, toQuat, timeParameterize, CollisionModel, rotErr, mulTransform, invTransform, ERR, contactText } from "./moveit-core.js";

const stampNow = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };

// geometry_msgs/PoseStamped (or Pose) written as YAML on the command line
export function parsePoseYaml(yaml) {
  const y = String(yaml);
  const blk = (k) => { const m = y.match(new RegExp(`${k}:\\s*\\{([^}]*)\\}`)); return m ? m[1] : null; };
  const g = (s, k, d = 0) => { if (!s) return d; const m = s.match(new RegExp(`(?:^|[{,\\s])${k}:\\s*(-?[\\d.]+(?:e-?\\d+)?)`)); return m ? Number(m[1]) : d; };
  const p = blk("position"), o = blk("orientation");
  const frame = (y.match(/frame_id:\s*['"]?([\w/]*)/) || [, ""])[1];
  return { frame, t: [g(p, "x"), g(p, "y"), g(p, "z")], q: o ? [g(o, "x"), g(o, "y"), g(o, "z"), g(o, "w", 1)] : [0, 0, 0, 1], hasOrientation: !!o };
}
export function parseJointJog(yaml) {
  const y = String(yaml), list = (k) => ((y.match(new RegExp(`${k}:\\s*\\[([^\\]]*)\\]`)) || [, ""])[1]).split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  return { joint_names: list("joint_names"), velocities: list("velocities").map(Number), displacements: list("displacements").map(Number) };
}
const slerp = (a, b, s) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; const bb = d < 0 ? b.map((x) => -x) : b; d = Math.abs(d);
  if (d > 0.9995) { const r = a.map((x, i) => x + (bb[i] - x) * s); const n = Math.hypot(...r); return r.map((x) => x / n); }
  const th = Math.acos(d), sa = Math.sin((1 - s) * th) / Math.sin(th), sb = Math.sin(s * th) / Math.sin(th);
  return a.map((x, i) => x * sa + bb[i] * sb);
};
// solve (A) x = b for a small dense system (Gaussian elimination with pivoting)
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}
// joint velocities for a 6-D tool twist: damped least squares qd = J^T (J J^T + l^2 I)^-1 v (rows of v that are not used: weight 0)
function dls(Jc, v, lambda = 0.02, rows = [0, 1, 2, 3, 4, 5]) {
  const J = rows.map((r) => Jc.map((col) => col[r])), vv = rows.map((r) => v[r]);
  const JJt = J.map((a) => J.map((b) => a.reduce((s, x, k) => s + x * b[k], 0)));
  for (let i = 0; i < JJt.length; i++) JJt[i][i] += lambda * lambda;
  const y = solve(JJt, vv);
  return Jc.map((_, k) => J.reduce((s, row, i) => s + row[k] * y[i], 0));
}

export const SERVO_TYPES = ["JOINT_JOG", "TWIST", "POSE"];
export const servoDefaults = (G, ctl) => ({
  move_group_name: G.name, planning_frame: G.base, ee_frame: G.tip, robot_link_command_frame: G.base,
  command_in_type: "speed_units", scale: { linear: 0.4, rotational: 0.8, joint: 0.5 }, publish_period: 0.02, incoming_command_timeout: 0.1,
  command_out_type: "trajectory_msgs/JointTrajectory", command_out_topic: `/${ctl}/joint_trajectory`, check_collisions: true,
  self_collision_proximity_threshold: 0.01, scene_collision_proximity_threshold: 0.02, joint_limit_margins: 0.1,
  lower_singularity_threshold: 17.0, hard_stop_singularity_threshold: 30.0, max_linear_speed: 0.25, max_angular_speed: 0.8,
});

// ---------------- added to MoveGroup.prototype ----------------
export const poseMethods = {
  // pose of the tool in the planning frame (model root) for the group, as { t, q }
  toolPose(groupName) { const T = this.tipPose(groupName, {}); if (!T) return null; return { t: [T[3], T[7], T[11]], q: toQuat(T), T }; },
  // pose goal -> joint goal (collision-aware IK, KDL: like RViz when you move the marker, or MoveGroupInterface::setPoseTarget)
  poseToJoints(groupName, T, seed) {
    const G = this.group(groupName); if (!G || !G.tip) return { ok: false, error: "INVALID_GROUP_NAME", message: `Group '${groupName}' has no end effector (tip link) to aim` };
    const base = { ...this.current(), ...(seed || {}) };
    const CM = this.ready ? this.collision(G) : null;
    const q = solveIK(G, T, { seed: G.vec(base), base, positionOnly: G.positionOnly, attempts: 40, iterations: 120, valid: CM ? (x) => !CM.contact(G.values(x, base), { full: true }) : null });
    if (!q) {
      const qa = solveIK(G, T, { seed: G.vec(base), base, positionOnly: G.positionOnly, attempts: 20, iterations: 100 });
      if (qa && CM) { const c = CM.contact(G.values(qa, base), { full: true }); if (c) return { ok: false, error: "GOAL_IN_COLLISION", message: `Every IK solution for this pose is in collision: ${contactText(c)}` }; }
      return { ok: false, error: "NO_IK_SOLUTION", message: `No IK solution for ${G.tip} at [${[T[3], T[7], T[11]].map((x) => x.toFixed(3)).join(", ")}]${G.positionOnly ? " (position only IK)" : ""}: outside the workspace or the joint limits` };
    }
    return { ok: true, values: G.values(q) };
  },
  // plan to a pose: { group, T, pipeline, planner_id, cartesian, time, attempts, vel, acc, circAux }
  planPose(req) {
    const MA = "move_group.moveit.moveit.ros.move_group.move_action";
    if (req.cartesian) return this.cartesianPath(req);
    const ik = this.poseToJoints(req.group, req.T);
    if (!ik.ok) {
      this.log("MoveGroupMoveAction: Received request", "INFO", MA);
      this.log(`Unable to construct goal representation: ${ik.message}`, "ERROR", "move_group.moveit.moveit.ros.planning_pipeline");
      this.log(ik.error, "INFO", MA);
      this.rvizLog("MoveGroupInterface::plan() failed or timeout reached", "ERROR");
      const r = { ok: false, error: ik.error, error_code: ERR[ik.error], message: ik.message, planning_time: 0, group: req.group };
      this.lastResult = r; this.emit({ type: "plan", result: r }); return r;
    }
    return this.plan({ ...req, goal: ik.values });
  },
  // /compute_cartesian_path: the tool moves on a straight line (eef_step 0.01 m), IK at every step from the previous one
  cartesianPath(req) {
    const G = this.group(req.group), CP = "move_group.moveit.moveit.ros.move_group.cartesian_path_service_capability";
    if (!G || !G.tip) return { ok: false, error: "INVALID_GROUP_NAME", message: "No end effector" };
    const base = this.current(), q0 = G.vec(base), A = this.tipPose(req.group, {}), B = req.T;
    const pa = [A[3], A[7], A[11]], pb = [B[3], B[7], B[11]], qa = toQuat(A), qb = toQuat(B);
    const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]), ang = Math.hypot(...rotErr(A, B));
    const steps = Math.max(2, Math.ceil(Math.max(len / (req.eef_step || 0.01), ang / 0.05)));
    const CM = this.collision(G); const path = [q0]; let q = q0, reason = "";
    this.log(`Received request to compute Cartesian path`, "INFO", CP);
    for (let i = 1; i <= steps; i++) {
      const s = i / steps, T = fromQuat(pa.map((x, k) => x + (pb[k] - x) * s), slerp(qa, qb, s));
      const nq = solveIK(G, T, { seed: q, base, positionOnly: G.positionOnly, attempts: 1, iterations: 60 });
      if (!nq) { reason = "no IK solution"; break; }
      if (Math.max(...nq.map((x, k) => Math.abs(x - q[k]))) > 0.35) { reason = "joint-space jump"; break; }   // jump threshold
      const c = CM.contact(G.values(nq, base)); if (c) { reason = `collision (${contactText(c)})`; break; }
      path.push(nq); q = nq;
    }
    const fraction = (path.length - 1) / steps;
    this.log(`Attempting to follow ${steps} waypoints for link '${G.tip}' using a step of 0.010000 m and jump threshold 0.000000 (in global reference frame)`, "INFO", CP);
    this.log(`Computed Cartesian path with ${path.length} points (followed ${(fraction * 100).toFixed(6)}% of requested trajectory)`, "INFO", CP);
    if (fraction < 1) {
      const r = { ok: false, error: "PLANNING_FAILED", error_code: ERR.PLANNING_FAILED, fraction, message: `Cartesian path: only ${(fraction * 100).toFixed(1)}% of the straight line is possible (${reason}). Uncheck "Use Cartesian Path" to plan around it.`, planning_time: 0.01, group: req.group };
      this.rvizLog(`computeCartesianPath() achieved ${(fraction * 100).toFixed(2)}% of the requested path`, "WARN", "moveit_ros_visualization.motion_planning_frame");
      this.lastResult = r; this.emit({ type: "plan", result: r }); return r;
    }
    const points = timeParameterize(G, path, { velScale: req.vel ?? 0.1, accScale: req.acc ?? 0.1 });
    const r = { ok: true, error: "SUCCESS", error_code: ERR.SUCCESS, fraction: 1, planner: "Cartesian path", planning_time: 0.01, trajectory: { joint_names: G.joints.slice(), points }, duration: points[points.length - 1].t, group: req.group };
    this.lastResult = r; this.emit({ type: "plan", result: r }); return r;
  },

  // ---------------- MoveIt Servo ----------------
  servoStart(params = {}) {
    const G = this.groupNames().map((n) => this.group(n)).find((g) => g && g.tip);
    const ctl = (this.controllers.find((c) => G && G.joints.every((j) => c.joints.includes(j))) || this.controllers[0] || { name: "arm_controller" }).name;
    this.servo = { params: { ...servoDefaults(G, ctl), ...params }, G, type: 0, paused: false, cmd: null, q: null, last: 0, halted: "" };
    return this.servo;
  },
  servoCommand(kind, msg, t = performance.now() / 1000) { if (this.servo) this.servo.cmd = { kind, msg, t }; },
  servoStep(dt) {
    const sv = this.servo; if (!sv || sv.paused || !sv.G) return;
    const P = sv.params, G = sv.G, now = performance.now() / 1000;
    // a running `ros2 topic pub -r N` keeps the command fresh
    for (const n of this.graph.nodes) if (n.kind === "pubcli" && n.pub && n.pub.servo) sv.cmd = { kind: n.pub.servo, msg: n.pub.msg, t: now };
    const cmd = sv.cmd;
    if (!cmd || now - cmd.t > P.incoming_command_timeout || SERVO_TYPES[sv.type] !== cmd.kind) { sv.q = null; return; }
    const base = this.current(), q = sv.q || G.vec(base);
    let qd = new Array(G.dof).fill(0);
    if (cmd.kind === "JOINT_JOG") {
      cmd.msg.joint_names.forEach((j, i) => { const k = G.joints.indexOf(j); if (k >= 0) qd[k] = (cmd.msg.velocities[i] || 0) * (P.command_in_type === "unitless" ? P.scale.joint : 1); });
    } else {
      const { T, Jc } = G.jacobian(q, base);
      let v;
      if (cmd.kind === "TWIST") {
        const tw = cmd.msg.twist, s = P.command_in_type === "unitless" ? [P.scale.linear, P.scale.rotational] : [1, 1];
        let lin = [tw.linear.x * s[0], tw.linear.y * s[0], tw.linear.z * s[0]], ang = [tw.angular.x * s[1], tw.angular.y * s[1], tw.angular.z * s[1]];
        if (cmd.msg.frame && cmd.msg.frame === P.ee_frame) { const R = (x) => [T[0] * x[0] + T[1] * x[1] + T[2] * x[2], T[4] * x[0] + T[5] * x[1] + T[6] * x[2], T[8] * x[0] + T[9] * x[1] + T[10] * x[2]]; lin = R(lin); ang = R(ang); }
        v = [...lin, ...ang];
      } else {   // POSE: move towards the target (in the planning frame) at a bounded speed
        const goal = cmd.msg.T, e = [goal[3] - T[3], goal[7] - T[7], goal[11] - T[11]], er = rotErr(T, goal);
        const gain = 4, l = Math.hypot(...e), a = Math.hypot(...er);
        if (l < 0.002 && a < 0.01) { if (!sv.reached) this.servoLog("Reached the pose target", "INFO"); sv.reached = true; return; }
        sv.reached = false;
        const ls = Math.min(1, P.max_linear_speed / Math.max(1e-9, gain * l)), as = Math.min(1, P.max_angular_speed / Math.max(1e-9, gain * a));
        v = [...e.map((x) => x * gain * ls), ...er.map((x) => x * gain * as)];
      }
      const rows = G.positionOnly ? [0, 1, 2] : [0, 1, 2, 3, 4, 5];
      qd = dls(Jc, v, 0.03, rows);
    }
    // joint velocity limits (scale the whole command down, keeping its direction)
    const over = Math.max(1, ...qd.map((x, i) => Math.abs(x) / (G.vel[i] || 1)));
    qd = qd.map((x) => x / over);
    const nq = q.map((x, i) => x + qd[i] * dt);
    const halt = (why) => { if (sv.halted !== why) this.servoLog(why, "WARN"); sv.halted = why; sv.q = null; };
    if (nq.some((x, i) => x < G.lower[i] + 0.01 || x > G.upper[i] - 0.01) && nq.some((x, i) => (x < G.lower[i] + 0.01 && qd[i] < 0) || (x > G.upper[i] - 0.01 && qd[i] > 0))) {
      const k = nq.findIndex((x, i) => (x < G.lower[i] + 0.01 && qd[i] < 0) || (x > G.upper[i] - 0.01 && qd[i] > 0));
      return halt(`Joint position limit reached on joint '${G.joints[k]}'. Halting.`);
    }
    if (P.check_collisions && this.ready) { const CM = new CollisionModel(this.K, this.spheres, { acm: this.acm, group: G }); CM.setObjects(this.objects); const c = CM.contact(G.values(nq, base), { full: true }); if (c) return halt(`Halting for collision! ${contactText(c)}`); }
    sv.halted = "";
    sv.q = nq;
    // command_out: one point of trajectory_msgs/JointTrajectory to the arm controller
    const hit = this.graph.cmModels().find((m) => m.cm.controllers.has(P.command_out_topic.split("/")[1]));
    if (!hit) { if (now - sv.last > 2) { sv.last = now; this.servoLog(`No subscriber on ${P.command_out_topic}: is the controller running?`, "WARN"); } return; }
    hit.held = false;
    hit.cm.receive(P.command_out_topic, "trajectory_msgs/msg/JointTrajectory", { joint_names: G.joints.slice(), points: [{ positions: nq, velocities: qd, time_from_start: { sec: 0, nanosec: Math.round(P.publish_period * 1e9) } }] }, this.graph.cmTime());
  },
  servoLog(text, level = "INFO") { const n = this.graph.nodes.find((x) => x.kind === "servo"); if (n) this.say(n.full, text, level, "servo_node"); },
};

// ---------------- added to RosGraph.prototype ----------------
export const servoGraphMethods = {
  // ros2 launch <robot>_moveit_config servo.launch.py
  launchServo(pk) {
    const L = [];
    if (!this.mg || !this.node(this.mg.node)) return [this.err("[ERROR] [launch]: Caught exception in launch (see debug for traceback): servo_node needs the robot running: start demo.launch.py or gazebo.launch.py first"), this.hint("(Start MoveIt in one terminal, then servo.launch.py in a + New terminal.)")];
    if (this.nodes.some((n) => n.kind === "servo")) return [this.err("[ERROR] [launch]: a servo_node is already running (Ctrl+C the other one first)")];
    const yaml = (pk.config || {})["servo.yaml"];
    const params = {};
    if (yaml) for (const [k, re] of Object.entries({ command_in_type: /command_in_type:\s*"?(\w+)"?/, move_group_name: /move_group_name:\s*(\w+)/, planning_frame: /planning_frame:\s*(\w+)/, ee_frame: /ee_frame:\s*(\w+)/, command_out_topic: /command_out_topic:\s*([\w/]+)/ })) { const m = String(yaml).match(re); if (m) params[k] = m[1]; }
    for (const [k, re] of Object.entries({ incoming_command_timeout: /incoming_command_timeout:\s*([\d.]+)/, publish_period: /publish_period:\s*([\d.]+)/ })) { const m = String(yaml || "").match(re); if (m) params[k] = Number(m[1]); }
    const sv = this.mg.servoStart(params);
    const n = this.add("servo", "servo_node", "", { "moveit_servo.move_group_name": sv.params.move_group_name, "moveit_servo.command_in_type": sv.params.command_in_type, "moveit_servo.command_out_topic": sv.params.command_out_topic, "moveit_servo.planning_frame": sv.params.planning_frame, "moveit_servo.ee_frame": sv.params.ee_frame, "moveit_servo.check_collisions": true });
    n.procName = "servo_node-1"; n.mg = this.mg;
    const P = (lvl, t) => (lvl === "WARN" ? this.err : this.out).call(this, `[servo_node-1] [${lvl}] [${stampNow()}] [servo_node]: ${t}`);
    L.push(this.out("[INFO] [launch]: All log files can be found below /home/student/.ros/log"), this.out("[INFO] [launch]: Default logging verbosity is set to INFO"), this.out("[INFO] [servo_node-1]: process started with pid [6120]"));
    L.push(P("INFO", `Servo initialized for group '${sv.params.move_group_name}': planning frame '${sv.params.planning_frame}', end effector '${sv.params.ee_frame}'`),
      P("INFO", `Command type: JOINT_JOG. Change it with: ros2 service call /servo_node/switch_command_type moveit_msgs/srv/ServoCommandType "{command_type: 1}"`),
      P("INFO", `Publishing ${sv.params.command_out_type} on ${sv.params.command_out_topic} every ${sv.params.publish_period} s; commands time out after ${sv.params.incoming_command_timeout} s`));
    L.push(this.hint(`(servo_node is running. In a + New terminal:\n  ros2 service call /servo_node/switch_command_type moveit_msgs/srv/ServoCommandType "{command_type: 1}"\n  ros2 topic pub -r 30 /servo_node/delta_twist_cmds geometry_msgs/msg/TwistStamped "{header: {stamp: now, frame_id: ${sv.params.planning_frame}}, twist: {linear: {x: 0.05}}}"\nCommands time out after ${sv.params.incoming_command_timeout} s, so keep publishing (-r 30); Ctrl+C stops the motion. Joint jog: command_type 0 and /servo_node/delta_joint_cmds control_msgs/msg/JointJog; pose: command_type 2 and /servo_node/pose_target_cmds geometry_msgs/msg/PoseStamped.)`));
    this.lastStarted = [n.full];
    return L;
  },
  servoEndpoints(n, e) {
    if (n.kind === "servo") {
      e.subs.push(["/servo_node/delta_twist_cmds", "geometry_msgs/msg/TwistStamped"], ["/servo_node/delta_joint_cmds", "control_msgs/msg/JointJog"], ["/servo_node/pose_target_cmds", "geometry_msgs/msg/PoseStamped"], ["/joint_states", "sensor_msgs/msg/JointState"]);
      e.pubs.push(["/servo_node/status", "moveit_msgs/msg/ServoStatus"], [n.mg && n.mg.servo ? n.mg.servo.params.command_out_topic : "/arm_controller/joint_trajectory", "trajectory_msgs/msg/JointTrajectory"]);
      e.srvs.push(["/servo_node/switch_command_type", "moveit_msgs/srv/ServoCommandType"], ["/servo_node/pause_servo", "std_srvs/srv/SetBool"]);
    }
    if (n.kind === "pose_goal") { e.subs.push(["/goal_pose", "geometry_msgs/msg/PoseStamped"]); e.actc.push(["/move_action", "moveit_msgs/action/MoveGroup"], ["/execute_trajectory", "moveit_msgs/action/ExecuteTrajectory"]); }
  },
  // a message from `ros2 topic pub` for servo_node or the pose_goal_commander: returns { note } or null
  moveitTopic(topic, type, yaml, once) {
    const mg = this.mg && this.node(this.mg.node) ? this.mg : null;
    const servo = this.nodes.find((n) => n.kind === "servo"), pg = this.nodes.find((n) => n.kind === "pose_goal");
    if (servo && mg && mg.servo && topic.startsWith("/servo_node/")) {
      const sv = mg.servo, want = { "/servo_node/delta_twist_cmds": "TWIST", "/servo_node/delta_joint_cmds": "JOINT_JOG", "/servo_node/pose_target_cmds": "POSE" }[topic];
      if (!want) return null;
      let msg;
      if (want === "TWIST") { const m = this.parseTwistStamped(yaml); msg = m; }
      else if (want === "JOINT_JOG") msg = parseJointJog(yaml);
      else { const p = parsePoseYaml(yaml); msg = { T: fromQuat(p.t, p.q), frame: p.frame }; }
      // servo_node drops a command whose header.stamp is older than incoming_command_timeout (a zero stamp is from 1970)
      const stamped = /stamp:\s*now/.test(String(yaml)) || /stamp:\s*\{[^}]*sec:\s*[1-9]/.test(String(yaml));
      if (!stamped) return { servo: null, msg, note: `servo_node ignored it: the header.stamp is 0 (the year 1970), so the command is older than incoming_command_timeout (${sv.params.incoming_command_timeout} s) and is dropped as stale, without a warning. Give it the current time: "{header: {stamp: now, frame_id: ${sv.params.planning_frame}}, ...}"` };
      mg.servoCommand(want, msg);
      const mismatch = SERVO_TYPES[sv.type] !== want;
      return { servo: want, msg, note: mismatch ? `servo_node is in ${SERVO_TYPES[sv.type]} mode, so it ignores this ${want === "TWIST" ? "twist" : want === "POSE" ? "pose" : "joint jog"}. Switch first: ros2 service call /servo_node/switch_command_type moveit_msgs/srv/ServoCommandType "{command_type: ${SERVO_TYPES.indexOf(want)}}"`
        : once ? `servo_node moved for ${sv.params.incoming_command_timeout} s only (incoming_command_timeout), then stopped: servo needs a stream of commands. Use -r 30 instead of --once.` : `servo_node is ${want === "POSE" ? "moving the tool to the pose target" : "moving the arm"} (${sv.params.command_out_topic}). Ctrl+C stops publishing, and servo stops the arm ${sv.params.incoming_command_timeout} s later.` };
    }
    if (topic === "/goal_pose" && pg && mg) {
      const p = parsePoseYaml(yaml);
      this.poseGoalRun(pg, p);
      return { note: `pose_goal_commander received the goal (${p.t.map((x) => x.toFixed(3)).join(", ")}) and sent it to move_group: see its terminal and RViz.` };
    }
    return null;
  },
  parseTwistStamped(yaml) {
    const y = String(yaml), blk = (k) => (y.match(new RegExp(`${k}:\\s*\\{([^}]*)\\}`)) || [, ""])[1];
    const g = (s, k) => { const m = s.match(new RegExp(`(?:^|[{,\\s])${k}:\\s*(-?[\\d.]+(?:e-?\\d+)?)`)); return m ? Number(m[1]) : 0; };
    const lin = blk("linear"), ang = blk("angular");
    return { twist: { linear: { x: g(lin, "x"), y: g(lin, "y"), z: g(lin, "z") }, angular: { x: g(ang, "x"), y: g(ang, "y"), z: g(ang, "z") } }, frame: (y.match(/frame_id:\s*['"]?([\w/]*)/) || [, ""])[1] };
  },
  // pose_goal_commander.py: plan (and execute) a /goal_pose with move_group
  poseGoalRun(pg, p) {
    const mg = this.mg, P = pg.params, say = (t, lvl = "INFO") => mg.say(pg.full, t, lvl, "pose_goal_commander");
    const group = P.group || (mg.groupNames().find((n) => mg.group(n) && mg.group(n).tip));
    const frame = p.frame || mg.model.root;
    if (frame !== mg.model.root && !mg.K.model.links[frame]) { say(`Unknown frame '${frame}' (use the planning frame '${mg.model.root}')`, "ERROR"); return; }
    let T = fromQuat(p.t, p.q);
    if (frame !== mg.model.root) { const F = mg.K.fk(mg.current())[frame]; if (F) T = mulTransform(F, T); }
    say(`Goal for '${group}' (${mg.group(group).tip}) in ${frame}: position [${p.t.map((x) => x.toFixed(3)).join(", ")}] orientation [${p.q.map((x) => x.toFixed(3)).join(", ")}]`);
    say(`Planning with ${P.pipeline}${P.planner_id ? ` / ${P.planner_id}` : ""} ...`);
    const r = mg.planPose({ group, T, pipeline: P.pipeline, planner_id: P.planner_id, cartesian: P.cartesian === true || P.cartesian === "true", time: Number(P.planning_time) || 5, attempts: 10, vel: Number(P.velocity_scaling) || 0.1, acc: Number(P.acceleration_scaling) || 0.1 });
    if (!r.ok) { say(`Planning failed: ${r.error} (${r.message})`, "ERROR"); return; }
    say(`Plan found: ${r.trajectory.points.length} points, ${r.duration.toFixed(2)} s. Executing ...`);
    if (P.execute === false || P.execute === "false") return;
    const e = mg.execute(r);
    if (!e.ok) say(`Execution failed: ${e.message}`, "ERROR");
    else { const off = mg.on((ev) => { if (ev.type === "executed") { off(); say(ev.ok ? "Goal reached: SUCCEEDED" : "Execution did not finish", ev.ok ? "INFO" : "ERROR"); } }); }
  },
  // ros2 service call /servo_node/...
  servoService(name, yaml, req, res) {
    const mg = this.mg; if (!mg || !mg.servo) return null;
    const n = this.nodes.find((x) => x.kind === "servo");
    if (name === "/servo_node/switch_command_type") {
      const t = Math.trunc(this.num(yaml, "command_type"));
      if (!(t >= 0 && t <= 2)) return [this.out(req(`command_type=${t}`)), ...res("success=False")];
      mg.servo.type = t; mg.servo.q = null;
      if (n) mg.say(n.full, `Command type changed to ${SERVO_TYPES[t]}`, "INFO", "servo_node");
      return [this.out(req(`command_type=${t}`)), ...res("success=True")];
    }
    if (name === "/servo_node/pause_servo") {
      const on = /data:\s*(true|True|1)/.test(yaml); mg.servo.paused = on; mg.servo.q = null;
      if (n) mg.say(n.full, on ? "Servo paused" : "Servo unpaused", "INFO", "servo_node");
      return [this.out(req(`data=${on ? "True" : "False"}`)), ...res(`success=True, message='${on ? "Servoing disabled" : "Servoing enabled"}'`)];
    }
    return null;
  },
  // ros2 action send_goal /<controller>/follow_joint_trajectory control_msgs/action/FollowJointTrajectory "{trajectory: {...}}"
  fjtAction(name, yaml, rest) {
    const m = name.match(/^\/([\w]+)\/follow_joint_trajectory$/); if (!m) return null;
    const hit = this.cmModels().find((x) => x.cm.controllers.has(m[1])); if (!hit) return null;
    const ctrlMsg = this.parseFjt(yaml);
    const L = [this.out("Waiting for an action server to become available..."), this.out("Sending goal:"), ...String(yaml).split("\n").map((t) => this.out(`     ${t}`)), this.out("")];
    if (!ctrlMsg.joint_names.length || !ctrlMsg.points.length) return [...L, this.out(`Goal was rejected.`), this.hint("The goal needs trajectory: {joint_names: [...], points: [{positions: [...], time_from_start: {sec: 2}}]}")];
    const r = hit.cm.receive(`/${m[1]}/joint_trajectory`, "trajectory_msgs/msg/JointTrajectory", ctrlMsg, this.cmTime());
    if (!r.used) return [...L, this.out("Goal was rejected."), ...(r.note ? [this.hint(`(${r.note})`)] : [])];
    hit.held = false;
    const dur = Math.max(...ctrlMsg.points.map((p) => p.time_from_start.sec + p.time_from_start.nanosec * 1e-9));
    const cmNode = this.nodes.find((n) => n.cm === hit.cm);
    if (cmNode && this.mg) { this.mg.say(cmNode.full, "Received new action goal", "INFO", m[1]); this.mg.say(cmNode.full, "Accepted new action goal", "INFO", m[1]); }
    L.push(this.out(`Goal accepted with ID: ${Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`), this.out(""));
    if (rest.includes("--feedback") || rest.includes("-f")) L.push(this.out("Feedback:"), this.out(`    joint_names: [${ctrlMsg.joint_names.join(", ")}]`), this.out(""));
    L.push(this.out("Result:"), this.out("    error_code: 0"), this.out("    error_string: ''"), this.out(""), this.out("Goal finished with status: SUCCEEDED"));
    L.push(this.hint(`(${m[1]} moves ${hit.name} over ${dur.toFixed(2)} s. On a real computer this command waits until the motion ends.)`));
    return L;
  },
  parseFjt(yaml) {
    const y = String(yaml);
    const jn = (y.match(/joint_names:\s*\[([^\]]*)\]/) || [, ""])[1].split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    const points = [];
    for (const pm of y.matchAll(/positions:\s*\[([^\]]*)\]([\s\S]*?)(?=positions:|$)/g)) {
      const q = pm[1].split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
      const tm = pm[2].match(/time_from_start:\s*\{([^}]*)\}/), sec = tm ? Number((tm[1].match(/(?:^|[^n])sec:\s*(\d+)/) || [, 0])[1]) : 1, ns = tm ? Number((tm[1].match(/nanosec:\s*(\d+)/) || [, 0])[1]) : 0;
      points.push({ positions: q, time_from_start: { sec, nanosec: ns } });
    }
    return { joint_names: jn, points };
  },
};
export { invTransform };
