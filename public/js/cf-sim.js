// A JS model of Crazyswarm2's simulator node (crazyflie_sim/crazyflie_server.py, backend "np", visualization "rviz").
// What it reproduces: the node's ROS interface (per-drone services takeoff / land / go_to / start_trajectory /
// upload_trajectory / notify_setpoints_stop / emergency, the all/* services, the cmd_* subscriptions, /clock from the
// backend, <name>/robot_description (transient local) and the world -> <name> transforms the rviz visualization
// broadcasts), and the drones' motion under the firmware's high-level commander: takeoff, land and go_to follow the
// planner's smooth 7th-order polynomial (zero velocity, acceleration and jerk at both ends). What it does NOT run:
// the cffirmware bindings (Mellinger controller, Kalman estimator) and the numpy rigid-body physics; the drones track
// the planned setpoint exactly. The site never runs the real Python program. Installed on RosGraph.prototype.
const wall = () => Date.now() / 1000;
const smooth = (u) => { const s = Math.min(1, Math.max(0, u)); return s * s * s * s * (35 - 84 * s + 70 * s * s - 20 * s * s * s); };
const f6 = (x) => { const v = Math.abs(x) < 5e-7 ? 0 : Math.round(x * 1e6) / 1e6; return Number.isInteger(v) ? v.toFixed(1) : String(v); };
const stampTxt = (t) => { const ns = Math.round(t * 1e9); return `sec: ${Math.floor(ns / 1e9)}\n    nanosec: ${ns % 1e9}`; };

export const cfMethods = {
  cfSims() { return this.nodes.filter((n) => n.kind === "cf_sim"); },
  // params: the flattened ROS parameters launch.py gives the node (crazyflies.yaml + server.yaml + robot_description)
  cfInit(n, params, log) {
    const P = params || {}, names = [];
    const fileversion = Number(P.fileversion) || 0;
    const robots = new Set(Object.keys(P).map((k) => (k.match(/^robots\.([^.]+)\.enabled$/) || [])[1]).filter(Boolean));
    const S = { t0: wall(), cfs: new Map(), log: log || (() => {}) };
    for (const name of robots) {
      if (!(P[`robots.${name}.enabled`] === true || P[`robots.${name}.enabled`] === "true")) continue;
      const type = P[`robots.${name}.type`];
      if ((P[`robot_types.${type}.connection`] || "crazyflie") !== "crazyflie") continue;   // virtual objects are skipped
      let frame = "world";
      if (fileversion >= 3) frame = P[`robots.${name}.reference_frame`] || P[`robot_types.${type}.reference_frame`] || P["all.reference_frame"] || "world";
      const p0 = [].concat(P[`robots.${name}.initial_position`] || [0, 0, 0]).map(Number);
      names.push(name);
      S.cfs.set(name, { name, frame, pos: p0.slice(0, 3), yaw: 0, plan: null, mode: "idle" });
    }
    S.urdf = String(P.robot_description || "");
    S.backend = P["sim.backend"] || "np"; S.controller = P["sim.controller"] || "mellinger";
    n.cf = S; n.cfNames = names;
    n.params = { ...n.params, ...P };
    return names;
  },
  cfTime(n) { return wall() - n.cf.t0; },   // backend time (dt 0.0005 per step); here it advances with the wall clock
  cfState(n, name) {
    const c = n.cf.cfs.get(name), t = this.cfTime(n);
    if (c.plan) {
      const p = c.plan, u = smooth((t - p.t0) / Math.max(1e-6, p.dur));
      c.pos = p.from.map((a, i) => a + (p.to[i] - a) * u); c.yaw = p.yaw0 + (p.yaw1 - p.yaw0) * u;
      if (t >= p.t0 + p.dur) c.plan = null;
    }
    return c;
  },
  cfPlan(n, name, to, yaw, dur) { const c = this.cfState(n, name); c.plan = { t0: this.cfTime(n), dur: Math.max(0, dur), from: c.pos.slice(), to, yaw0: c.yaw, yaw1: yaw }; c.mode = "high_poly"; },
  // a service request (the server's callbacks): logs like the real node, then moves the drones
  cfCall(n, who, what, rq) {
    const S = n.cf, dur = (Number(rq.duration && rq.duration.sec) || 0) + (Number(rq.duration && rq.duration.nanosec) || 0) / 1e9, gm = Number(rq.group_mask) || 0;
    const list = who === "all" ? [...S.cfs.keys()] : S.cfs.has(who) ? [who] : [];
    const pyd = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
    const L = (lv, t) => S.log(`[${lv}] [${(Date.now() / 1000).toFixed(9)}] [${n.name}]: ${t}`, lv === "ERROR" ? "err" : "");
    const pyf = (x) => { const v = Math.fround(Number(x) || 0); return Number.isInteger(v) ? v.toFixed(1) : String(v); };   // float32 field printed by Python (repr of the double)
    if (what === "takeoff") { L("INFO", `[${who}] takeoff(height=${pyf(rq.height)} m,duration=${pyd(dur)} s,group_mask=${gm})`); for (const nm of list) { const c = this.cfState(n, nm); this.cfPlan(n, nm, [c.pos[0], c.pos[1], Number(rq.height) || 0], 0, dur); } }
    else if (what === "land") { L("INFO", `[${who}] land(height=${pyf(rq.height)} m,duration=${pyd(dur)} s,group_mask=${gm})`); for (const nm of list) { const c = this.cfState(n, nm); this.cfPlan(n, nm, [c.pos[0], c.pos[1], Number(rq.height) || 0], 0, dur); } }
    else if (what === "go_to") {
      const g = rq.goal || {}, goal = [Number(g.x) || 0, Number(g.y) || 0, Number(g.z) || 0], rel = rq.relative === true || rq.relative === "true";
      L("INFO", `[${who}] go_to(position=${goal.map((x) => x.toFixed(6)).join(",")} m,\n                 yaw=${(Number(rq.yaw) || 0).toFixed(6)} rad,\n                 duration=${dur.toFixed(6)} s,\n                 relative=${rel ? 1 : 0},\n                 group_mask=${gm})`);
      for (const nm of list) {
        const c = this.cfState(n, nm);
        if (c.mode !== "high_poly") { L("ERROR", `[${who}] 'go_to' service call failed, ignoring request: goTo from low-level modes not yet supported.`); continue; }
        this.cfPlan(n, nm, rel ? c.pos.map((a, i) => a + goal[i]) : goal, (rel ? c.yaw : 0) + (Number(rq.yaw) || 0), dur);
      }
    } else if (what === "emergency") L("INFO", `[${who}] emergency not yet implemented`);
    else if (what === "notify_setpoints_stop") L("INFO", `[${who}] Notify setpoint stop not yet implemented`);
    else if (what === "upload_trajectory") L("INFO", `[${who}] Upload trajectory(id=${Number(rq.trajectory_id) || 0})`);
    else if (what === "start_trajectory") L("INFO", `[${who}] start_trajectory(id=${Number(rq.trajectory_id) || 0}, timescale=${(Number(rq.timescale) || 0).toFixed(6)}, reverse=${rq.reversed ? 1 : 0}, relative=${rq.relative ? 1 : 0}, group_mask=${gm})`);
  },
  cfEndpoints(n, e) {
    e.pubs.push(["/clock", "rosgraph_msgs/msg/Clock"], ["/tf", "tf2_msgs/msg/TFMessage"]);
    const I = "crazyflie_interfaces/srv/";
    for (const nm of n.cfNames || []) {
      e.pubs.push([`/${nm}/robot_description`, "std_msgs/msg/String"]);
      e.subs.push([`/${nm}/cmd_vel_legacy`, "geometry_msgs/msg/Twist"], [`/${nm}/cmd_hover`, "crazyflie_interfaces/msg/Hover"], [`/${nm}/cmd_full_state`, "crazyflie_interfaces/msg/FullState"]);
      e.srvs.push([`/${nm}/emergency`, "std_srvs/srv/Empty"], [`/${nm}/takeoff`, I + "Takeoff"], [`/${nm}/land`, I + "Land"], [`/${nm}/go_to`, I + "GoTo"], [`/${nm}/start_trajectory`, I + "StartTrajectory"], [`/${nm}/upload_trajectory`, I + "UploadTrajectory"], [`/${nm}/notify_setpoints_stop`, I + "NotifySetpointsStop"]);
    }
    e.srvs.push(["/all/takeoff", I + "Takeoff"], ["/all/land", I + "Land"], ["/all/go_to", I + "GoTo"], ["/all/start_trajectory", I + "StartTrajectory"], ["/all/emergency", "std_srvs/srv/Empty"]);
  },
  cfTfEdges() {
    const E = [];
    for (const n of this.cfSims()) for (const nm of n.cfNames) { const c = this.cfState(n, nm); E.push({ parent: c.frame, child: nm, t: c.pos.slice(), q: [0, 0, Math.sin(c.yaw / 2), Math.cos(c.yaw / 2)] }); }
    return E;
  },
  // the drone's URDF (robot_description with $NAME replaced) for RViz's RobotModel display (Description Topic /<name>/robot_description)
  cfUrdf() { const n = this.cfSims()[0]; return n && n.cf.urdf && n.cfNames[0] ? n.cf.urdf.split("$NAME").join(n.cfNames[0]) : null; },
  cfRate(topic) { return this.cfSims().length && (topic === "/clock" || topic === "/tf") ? 2000 : null; },   // one message per backend step (dt 0.0005 s) at real time
  cfSample(topic) {
    const n = this.cfSims()[0]; if (!n) return null;
    const t = this.cfTime(n);
    if (topic === "/clock") return [`clock:\n  ${stampTxt(t).replace("\n    ", "\n  ")}`];
    if (topic === "/tf") return [`transforms:\n${n.cfNames.map((nm) => { const c = this.cfState(n, nm); return `- header:\n    stamp:\n      ${stampTxt(t).replace("\n    ", "\n      ")}\n    frame_id: ${c.frame}\n  child_frame_id: ${nm}\n  transform:\n    translation:\n      x: ${f6(c.pos[0])}\n      y: ${f6(c.pos[1])}\n      z: ${f6(c.pos[2])}\n    rotation:\n      x: 0.0\n      y: 0.0\n      z: ${f6(Math.sin(c.yaw / 2))}\n      w: ${f6(Math.cos(c.yaw / 2))}`; }).join("\n")}`];
    const m = topic.match(/^\/([^/]+)\/robot_description$/);
    if (m && n.cfNames.includes(m[1])) return [`data: '${n.cf.urdf.split("$NAME").join(m[1]).replace(/\n/g, "\\n").slice(0, 400)}...'`];
    return null;
  },
  // ros2 service call /<name>/takeoff ... (request fields read from the YAML text)
  cfServiceHook(name, yaml) {
    const n = this.cfSims().find((x) => (x.cfNames || []).concat("all").some((nm) => name.startsWith(`/${nm}/`))); if (!n) return false;
    const [, who, what] = name.match(/^\/([^/]+)\/(.+)$/) || [];
    const num = (k) => { const mm = String(yaml).match(new RegExp(`(?:^|[{,\\s])${k}:\\s*(-?[\\d.eE+-]+)`)); return mm ? Number(mm[1]) : 0; };
    const durM = String(yaml).match(/duration:\s*\{([^}]*)\}/), dsec = durM ? Number((durM[1].match(/(?:^|[^n])sec:\s*([\d.]+)/) || [, 0])[1]) : 0, dns = durM ? Number((durM[1].match(/nanosec:\s*(\d+)/) || [, 0])[1]) : 0;
    const goalM = String(yaml).match(/goal:\s*\{([^}]*)\}/), gnum = (k) => { const mm = goalM && goalM[1].match(new RegExp(`${k}:\\s*(-?[\\d.eE+-]+)`)); return mm ? Number(mm[1]) : 0; };
    this.cfCall(n, who, what, { height: num("height"), duration: { sec: dsec, nanosec: dns }, group_mask: num("group_mask"), goal: { x: gnum("x"), y: gnum("y"), z: gnum("z") }, yaw: num("yaw"), relative: /relative:\s*(true|True)/.test(String(yaml)), trajectory_id: num("trajectory_id"), timescale: num("timescale") });
    return true;
  },
};
