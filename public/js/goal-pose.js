// The goal_pose_gui package in the practice ROS graph (mixed into RosGraph.prototype, like gzMethods):
//   ros2 run goal_pose_gui goal_pose_gui      a separate window (like joint_state_publisher_gui) to type goals for any robot
//   ros2 run goal_pose_gui pose_follower      drives a mobile / legged / flying robot to a goal pose:
//       subscribes /goal_pose (geometry_msgs/PoseStamped) and /odom, offers the /navigate_to_pose action
//       (nav2_msgs/action/NavigateToPose, the same interface as Nav2), publishes /cmd_vel
// The same nodes exist as a real ROS 2 package (hardware/src/goal_pose_gui, and in every robot workspace).

const fnum = (n) => (Number.isInteger(n) ? `${n}.0` : String(+Number(n).toFixed(6)));
const hex = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const yawOfQuat = (q) => Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
export function quatOfRPY(r, p, y) {
  const cr = Math.cos(r / 2), sr = Math.sin(r / 2), cp = Math.cos(p / 2), sp = Math.sin(p / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2);
  return { x: sr * cp * cy - cr * sp * sy, y: cr * sp * cy + sr * cp * sy, z: cr * cp * sy - sr * sp * cy, w: cr * cp * cy + sr * sp * sy };
}
export function rpyOfQuat(q) {
  const r = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y));
  const s = 2 * (q.w * q.y - q.z * q.x), p = Math.abs(s) >= 1 ? Math.sign(s) * Math.PI / 2 : Math.asin(s);
  return [r, p, yawOfQuat(q)];
}

// Default limits per kind of base (the follower's parameters; the real node reads the same names)
const LIMITS = { diff: { max_linear: 0.22, max_angular: 1.5, holonomic: false, fly: false }, ackermann: { max_linear: 0.6, max_angular: 0.8, holonomic: false, fly: false, car: true, min_radius: 0.6 },
  holonomic: { max_linear: 0.4, max_angular: 1.2, holonomic: true, fly: false }, legged: { max_linear: 0.5, max_angular: 1.0, holonomic: true, fly: false }, drone: { max_linear: 0.5, max_angular: 1.0, holonomic: true, fly: true } };

export const goalMethods = {
  // ---------- which robot is there, and how it is driven ----------
  // returns { kind: "arm" | "diff" | "ackermann" | "holonomic" | "legged" | "drone" | null, model, via: "gz" | "cm" | null, topic, stamped }
  goalRobot() {
    const out = { kind: null, model: null, via: null, topic: "/cmd_vel", stamped: false, joints: [], controller: null };
    if (this.mg && this.node(this.mg.node)) { out.kind = "arm"; return out; }
    for (const m of this.cmModels ? this.cmModels() : []) {
      const ctl = [...m.cm.controllers.values()].filter((c) => c.state === "active");
      const diff = ctl.find((c) => c.kind === "diff");
      if (diff) return { ...out, kind: "diff", model: m, via: "cm", topic: m.cm.topicOf(diff.name, "cmd_vel"), stamped: true, controller: diff.name };
      const base = ctl.find((c) => c.kind === "mecanum" || c.kind === "ackermann");   // Jazzy: TwistStamped on ~/reference
      if (base) return { ...out, kind: base.kind === "mecanum" ? "holonomic" : "ackermann", model: m, via: "cm", topic: m.cm.topicOf(base.name, "reference"), stamped: true, controller: base.name };
      const jtc = ctl.find((c) => c.kind === "jtc");
      if (jtc) return { ...out, kind: "arm", model: m, via: "cm", controller: jtc.name, joints: jtc.joints || (jtc.params && jtc.params.joints) || [] };
    }
    if (this.gzRunning && this.gzRunning()) {
      for (const m of this.gz.models.values()) {
        const P = (m.gazebo && m.gazebo.plugins) || [];
        const vc = P.find((p) => p.kind === "velocity_control"), dd = P.find((p) => p.kind === "diff_drive"), mc = P.find((p) => p.kind === "mecanum"), ak = P.find((p) => p.kind === "ackermann");
        if (!vc && !dd && !mc && !ak) continue;
        const bridge = this.bridges().find((b) => b.dir !== "GZ_TO_ROS" && b.rosType === "geometry_msgs/msg/Twist" && this.gzTopicList().some((t) => t.kind === "cmd_vel" && t.model === m.name && t.topic === b.gz));
        const kind = vc && vc.flying ? "drone" : vc ? (this.isLegged(m) ? "legged" : "holonomic") : mc ? "holonomic" : ak ? "ackermann" : "diff";
        return { ...out, kind, model: m, via: "gz", topic: bridge ? bridge.ros : "/cmd_vel" };
      }
    }
    return out;
  },
  isLegged(m) {
    const J = Object.values((m.model && m.model.joints) || {});
    return J.filter((j) => /hip|thigh|calf|knee|ankle|haa|hfe|kfe/i.test(j.name)).length >= 6;
  },
  // the robot base pose in odom (where it started) and its world pose
  goalOdom(r) {
    const m = r.model; if (!m || !m.pose) return null;
    const s = m.start || { x: 0, y: 0, z: 0, yaw: 0 }, c = Math.cos(-s.yaw), sn = Math.sin(-s.yaw), dx = m.pose.x - s.x, dy = m.pose.y - s.y;
    return { x: c * dx - sn * dy, y: sn * dx + c * dy, z: (m.pose.z || 0) - (s.z || 0), yaw: wrap(m.pose.yaw - s.yaw) };
  },
  // a velocity command for the robot, the way a ROS node would publish it on its cmd_vel
  goalCommand(r, v) {
    const tw = { lx: v.vx || 0, ly: v.vy || 0, lz: v.vz || 0, ax: 0, ay: 0, az: v.wz || 0, topic: r.topic };
    if (r.via === "cm") {
      const msg = { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "" }, frame: "", twist: { linear: { x: tw.lx, y: tw.ly, z: tw.lz }, angular: { x: 0, y: 0, z: tw.az } } };
      this.cmDeliver(r.topic, "geometry_msgs/msg/TwistStamped", msg);
    } else if (r.via === "gz") this.gzTwist(r.topic, tw);
    this.lastTwist = tw;
  },

  // ---------- the pose follower (P controller; the real node is goal_pose_gui/pose_follower.py) ----------
  followerNode() { return this.nodes.find((n) => n.kind === "pose_follower" && !this.unseen(n)); },
  goalStart(goal, source) {   // goal: { x, y, z, yaw, frame }
    const r = this.goalRobot(), n = this.followerNode();
    if (!n) return { ok: false, message: "No pose_follower is running. Start it: ros2 run goal_pose_gui pose_follower" };
    if (!r.kind || r.kind === "arm") return { ok: false, message: "pose_follower drives a mobile, legged or flying robot. Start its simulation first (gazebo.launch.py)." };
    const lim = { ...LIMITS[r.kind], ...this.followerParams(n) };
    if (this.follow && this.follow.active) this.follow.status = "ABORTED";
    this.follow = { goal: { x: +goal.x || 0, y: +goal.y || 0, z: +goal.z || 0, yaw: +goal.yaw || 0, frame: goal.frame || "odom" }, active: true, id: hex(), start: this.cmTime ? this.cmTime() : 0, lim, robot: r, status: "EXECUTING", source, aligning: false };
    this.note(n, `[INFO] [${n.name}]: New goal from ${source}: x=${(+goal.x).toFixed(2)}, y=${(+goal.y).toFixed(2)}${lim.fly ? `, z=${(+goal.z).toFixed(2)}` : ""}, yaw=${(+goal.yaw).toFixed(2)} rad (frame ${goal.frame || "odom"})`);
    return { ok: true, id: this.follow.id, r };
  },
  followerParams(n) {
    const p = n.params || {}, num = (k) => (typeof p[k] === "number" ? p[k] : undefined);
    const out = {}; for (const k of ["max_linear", "max_angular", "xy_tolerance", "yaw_tolerance", "k_linear", "k_angular"]) if (num(k) !== undefined) out[k] = num(k);
    return out;
  },
  goalCancel(reason = "CANCELED") {
    if (!this.follow || !this.follow.active) return false;
    this.follow.active = false; this.follow.status = reason;
    this.goalCommand(this.follow.robot, {});
    const n = this.followerNode(); if (n) this.note(n, `[INFO] [${n.name}]: Goal ${reason.toLowerCase()}`);
    return true;
  },
  // one control step (called by the simulation clock)
  goalStep() {
    const F = this.follow; if (!F || !F.active) return;
    if (!this.followerNode()) { F.active = false; F.status = "ABORTED"; return; }
    const r = this.goalRobot(); if (!r.model) { F.active = false; F.status = "ABORTED"; return; }
    F.robot = r;
    const o = this.goalOdom(r); if (!o) return;
    const L = { xy_tolerance: 0.05, yaw_tolerance: 0.05, k_linear: 0.8, k_angular: 2.0, ...F.lim };
    const dx = F.goal.x - o.x, dy = F.goal.y - o.y, dist = Math.hypot(dx, dy), dz = L.fly ? F.goal.z - o.z : 0;
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    let cmd = { vx: 0, vy: 0, vz: 0, wz: 0 };
    F.remaining = Math.hypot(dist, dz);
    if (L.car) {   // a car rolls while it steers (forwards, or backwards for a goal behind it); the goal yaw is not enforced
      if (dist > L.xy_tolerance) {
        const head = wrap(Math.atan2(dy, dx) - o.yaw), dir = Math.abs(head) > Math.PI / 2 ? -1 : 1, e = dir < 0 ? wrap(head + Math.PI) : head;
        const speed = Math.max(0.3 * L.max_linear, Math.min(L.max_linear, L.k_linear * dist));
        cmd.vx = dir * speed; cmd.wz = clamp(L.k_angular * e, Math.min(L.max_angular, speed / L.min_radius));
      }
    } else if (dist > L.xy_tolerance && !F.aligning) {
      if (L.holonomic) {   // strafe straight to the goal, turn towards the goal yaw on the way
        const c = Math.cos(-o.yaw), s = Math.sin(-o.yaw), bx = c * dx - s * dy, by = s * dx + c * dy, k = Math.min(1, (L.k_linear * dist) / L.max_linear);
        cmd.vx = (bx / dist) * L.max_linear * k; cmd.vy = (by / dist) * L.max_linear * k; cmd.wz = clamp(L.k_angular * wrap(F.goal.yaw - o.yaw), L.max_angular);
      } else {             // turn towards the goal, then drive (and keep correcting the heading)
        const head = wrap(Math.atan2(dy, dx) - o.yaw), back = Math.abs(head) > 2.4 && dist < 0.4;   // a short way back: reverse
        const e = back ? wrap(head + Math.PI) : head;
        cmd.wz = clamp(L.k_angular * e, L.max_angular);
        cmd.vx = Math.abs(e) > 0.5 ? 0 : clamp(L.k_linear * dist, L.max_linear) * Math.cos(e) * (back ? -1 : 1);
      }
    } else {
      F.aligning = true;
      const ey = wrap(F.goal.yaw - o.yaw);
      if (Math.abs(ey) > L.yaw_tolerance) cmd.wz = clamp(L.k_angular * ey, L.max_angular);
      if (dist > L.xy_tolerance * 3) F.aligning = false;
    }
    if (L.fly) cmd.vz = Math.abs(dz) > 0.03 ? clamp(L.k_linear * dz, L.max_linear) : 0;
    const done = dist <= L.xy_tolerance * 1.5 && (L.car || Math.abs(wrap(F.goal.yaw - o.yaw)) <= L.yaw_tolerance) && (!L.fly || Math.abs(dz) <= 0.04);
    if (done) {
      F.active = false; F.status = "SUCCEEDED"; this.goalCommand(r, {});
      const n = this.followerNode(); if (n) { this.note(n, `[INFO] [${n.name}]: Goal reached: x=${o.x.toFixed(2)}, y=${o.y.toFixed(2)}, yaw=${o.yaw.toFixed(2)} rad`); if (this.onNotice) this.onNotice(); }
      return;
    }
    if (r.model && r.model.bumped && (this.cmTime ? this.cmTime() : 0) - F.start > 1) { F.blocked = (F.blocked || 0) + 1; if (F.blocked > 60) { this.goalCancel("ABORTED"); const n = this.followerNode(); if (n) this.note(n, `[WARN] [${n.name}]: The robot is blocked by an obstacle: goal aborted`, "warn-line"); return; } } else F.blocked = 0;
    this.goalCommand(r, cmd);
  },

  // the Gazebo system that turns a Twist into motion for this model, and what the command does for it
  gzDriveSystem(name) {
    const m = this.gzModel && this.gzModel(name), P = (m && m.gazebo && m.gazebo.plugins) || [];
    return P.some((p) => p.kind === "velocity_control") ? "VelocityControl" : P.some((p) => p.kind === "mecanum") ? "MecanumDrive" : P.some((p) => p.kind === "ackermann") ? "AckermannSteering" : "DiffDrive";
  },
  twistText(v, name) {
    const m = this.gzModel && this.gzModel(name), P = (m && m.gazebo && m.gazebo.plugins) || [];
    const vc = P.find((p) => p.kind === "velocity_control"), holo = !!vc || P.some((p) => p.kind === "mecanum"), fly = !!(vc && vc.flying);
    const parts = [`${fnum(v.lx)} m/s forward`];
    if (holo && v.ly) parts.push(`${fnum(v.ly)} m/s sideways`);
    if (fly && v.lz) parts.push(`${fnum(v.lz)} m/s up`);
    parts.push(`${fnum(v.az)} rad/s turning`);
    const ignored = [!holo && v.ly ? "linear.y" : null, !fly && v.lz ? "linear.z" : null, v.ax ? "angular.x" : null, v.ay ? "angular.y" : null].filter(Boolean);
    return parts.join(", ") + (ignored.length ? ` (${ignored.join(", ")} ${ignored.length > 1 ? "are" : "is"} ignored by this system)` : "");
  },

  // ---------- topics and actions the CLI reaches (hooks called by RosGraph.topicPub / cmdAction) ----------
  pubOther(topic, type, msg) {
    const mv = this.mgTopic ? this.mgTopic(topic, type, msg) : null; if (mv) return mv;
    if (topic === "/goal_pose" && type === "geometry_msgs/msg/PoseStamped" && this.followerNode()) {
      const p = msg.pose.position, yaw = yawOfQuat(msg.pose.orientation);
      const r = this.goalStart({ x: p.x, y: p.y, z: p.z, yaw, frame: msg.header.frame_id || "odom" }, "/goal_pose");
      return { note: r.ok ? `(pose_follower took the goal and drives ${r.r.model ? r.r.model.name : "the robot"} to x=${fnum(p.x)}, y=${fnum(p.y)}, yaw=${yaw.toFixed(2)} rad. Watch Gazebo and RViz; ros2 topic echo /odom shows where it is.)` : `(${r.message})` };
    }
    return null;
  },
  actionOther(name, type, goal, rest) {
    if (type !== "nav2_msgs/action/NavigateToPose" || name !== "/navigate_to_pose") return null;
    const p = goal.pose.pose.position, yaw = yawOfQuat(goal.pose.pose.orientation);
    const r = this.goalStart({ x: p.x, y: p.y, z: p.z, yaw, frame: goal.pose.header.frame_id || "odom" }, "/navigate_to_pose");
    const L = [this.out("Waiting for an action server to become available..."), this.out("Sending goal:"), ...[`     pose:`, `       header:`, `         stamp:`, `           sec: ${goal.pose.header.stamp.sec}`, `           nanosec: ${goal.pose.header.stamp.nanosec}`, `         frame_id: ${goal.pose.header.frame_id || "''"}`, `       pose:`, `         position:`, `           x: ${fnum(p.x)}`, `           y: ${fnum(p.y)}`, `           z: ${fnum(p.z)}`, `         orientation:`, ...["x", "y", "z", "w"].map((k) => `           ${k}: ${fnum(goal.pose.pose.orientation[k])}`), `     behavior_tree: '${goal.behavior_tree || ""}'`].map((t) => this.out(t)), this.out("")];
    if (!r.ok) return [...L, this.out(`Goal was rejected.`), this.hint(`(${r.message})`)];
    L.push(this.out(`Goal accepted with ID: ${r.id}`), this.out(""));
    const o = this.goalOdom(r.r), d = o ? Math.hypot(p.x - o.x, p.y - o.y) : 0, v = LIMITS[r.r.kind].max_linear;
    if (rest.includes("--feedback") || rest.includes("-f")) for (const k of [0, 0.5]) L.push(this.out("Feedback:"), ...[`    current_pose:`, `      header:`, `        frame_id: odom`, `      pose:`, `        position:`, `          x: ${fnum(+(o.x + (p.x - o.x) * k).toFixed(3))}`, `          y: ${fnum(+(o.y + (p.y - o.y) * k).toFixed(3))}`, `    navigation_time:`, `      sec: ${Math.round((k * d) / v)}`, `    estimated_time_remaining:`, `      sec: ${Math.round(((1 - k) * d) / v)}`, `    number_of_recoveries: 0`, `    distance_remaining: ${fnum(+((1 - k) * d).toFixed(3))}`].map((t) => this.out(t)), this.out(""));
    L.push(this.hint(`(The robot is on its way: about ${Math.max(1, Math.round(d / v + 2))} s for ${d.toFixed(2)} m. On a real computer the command waits here and then prints the Result and "Goal finished with status: SUCCEEDED". Cancel with Ctrl+C, or ros2 run goal_pose_gui goal_pose_gui → Stop.)`));
    return L;
  },
  followerEndpoints(n, e) {
    if (n.kind === "pose_follower") {
      const r = this.goalRobot();
      e.subs.push(["/goal_pose", "geometry_msgs/msg/PoseStamped"], ["/odom", "nav_msgs/msg/Odometry"]);
      e.pubs.push([r.topic || "/cmd_vel", r.stamped ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist"]);
      e.acts.push(["/navigate_to_pose", "nav2_msgs/action/NavigateToPose"]);
    }
    if (n.kind === "goal_gui") {
      const r = this.goalRobot();
      e.pubs.push(["/goal_pose", "geometry_msgs/msg/PoseStamped"]);
      if (r.kind && r.kind !== "arm") e.pubs.push([r.topic || "/cmd_vel", r.stamped ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist"]);
      e.actc.push(["/navigate_to_pose", "nav2_msgs/action/NavigateToPose"]);
      if (r.kind === "arm") e.actc.push(["/move_action", "moveit_msgs/action/MoveGroup"]);
      if (r.controller && r.kind === "arm") e.actc.push([`/${r.controller}/follow_joint_trajectory`, "control_msgs/action/FollowJointTrajectory"]);
      e.subs.push(["/robot_description", "std_msgs/msg/String"], ["/joint_states", "sensor_msgs/msg/JointState"]);
    }
  },
  // ros2 run goal_pose_gui ... (the package is in the robot's workspace)
  startGoalNode(exe, extra = []) {
    const args = extra.join(" "), param = (k) => (args.match(new RegExp(`-p\\s+${k}:=([^\\s]+)`)) || [])[1];
    if (exe === "goal_pose_gui") {
      const old = this.nodes.find((n) => n.kind === "goal_gui"); if (old) return [this.err("[ERROR] [goal_pose_gui]: a goal_pose_gui window is already open (one is enough)")];
      const n = this.add("goal_gui", "goal_pose_gui", "", {});
      n.params = { ...n.params, robot_type: param("robot_type") || "auto", frame_id: param("frame_id") || "", cmd_vel_topic: param("cmd_vel_topic") || "", stamped: param("stamped") === "true" };
      this.lastStarted = [n.full];
      const r = this.goalRobot();
      return [this.out(`[INFO] [${Date.now() / 1000}] [goal_pose_gui]: Goal Pose GUI started for ${r.kind ? (r.kind === "arm" ? "a robot arm (MoveIt / joint trajectory)" : `a ${r.kind} robot`) : "no robot yet"}`),
        this.hint(`(The "Goal Pose" window opened, like joint_state_publisher_gui. ${r.kind === "arm" ? "Type the tool's x, y, z and roll, pitch, yaw, then Plan & Execute." : r.kind ? "Type a goal x, y, yaw (and z for a drone) and press Go, or drive with the velocity sliders. Go needs the follower: ros2 run goal_pose_gui pose_follower" : "Start a robot first: a MoveIt demo.launch.py, or a gazebo.launch.py"})`)];
    }
    if (exe === "pose_follower") {
      if (this.followerNode()) return [this.err("[ERROR] [pose_follower]: a pose_follower is already running")];
      const n = this.add("pose_follower", "pose_follower", "", {});
      for (const k of ["max_linear", "max_angular", "xy_tolerance", "yaw_tolerance", "k_linear", "k_angular"]) { const v = param(k); if (v !== undefined && Number.isFinite(Number(v))) n.params[k] = Number(v); }
      n.ptypes = { max_linear: "double", max_angular: "double", xy_tolerance: "double", yaw_tolerance: "double", k_linear: "double", k_angular: "double" };
      const r = this.goalRobot();
      Object.assign(n.params, { ...Object.fromEntries(Object.entries(LIMITS[r.kind && r.kind !== "arm" ? r.kind : "diff"]).filter(([k]) => k.startsWith("max"))), xy_tolerance: 0.05, yaw_tolerance: 0.05, k_linear: 0.8, k_angular: 2.0, ...n.params });
      this.lastStarted = [n.full];
      return [this.out(`[INFO] [${(Date.now() / 1000).toFixed(9)}] [pose_follower]: pose_follower ready: /goal_pose and the /navigate_to_pose action -> ${r.topic || "/cmd_vel"} (${r.stamped ? "TwistStamped" : "Twist"})`),
        ...(r.kind && r.kind !== "arm" ? [] : [this.hint("(No mobile, legged or flying robot is simulated yet. Start one with its gazebo.launch.py: the follower then drives it.)")])];
    }
    return null;
  },
};
