// A JS model of ROBOTIS turtlebot3_fake_node (turtlebot3_simulations/turtlebot3_fake_node/src/turtlebot3_fake_node.cpp,
// jazzy branch): no physics, no sensors. Every 10 ms (wall timer) it integrates the wheel speeds commanded by the last
// geometry_msgs/msg/Twist on cmd_vel (zeroed when no command came for 1 s), and publishes nav_msgs/Odometry on odom,
// sensor_msgs/JointState (wheel_left_joint, wheel_right_joint) on joint_states and odom -> base_footprint on tf.
// The site does not run the compiled program; this reproduces what it computes. Installed on RosGraph.prototype.
const TIMEOUT = 1.0, PERIOD = 0.01;
const f6 = (x) => { const v = Math.abs(x) < 5e-7 ? 0 : Math.round(x * 1e6) / 1e6; return Number.isInteger(v) ? v.toFixed(1) : String(v); };
const wall = () => Date.now() / 1000;

export function fakeParams(params = {}, files = {}) {
  const text = Object.values(files || {}).join("\n");
  const pick = (k, re, d) => { if (params[k] !== undefined && params[k] !== "") return params[k]; const m = text.match(re); return m ? m[1].replace(/^["']|["']$/g, "") : d; };
  return {
    "wheels.separation": Number(pick("wheels.separation", /^\s+separation:\s*([\d.eE+-]+)/m, 0)),
    "wheels.radius": Number(pick("wheels.radius", /^\s+radius:\s*([\d.eE+-]+)/m, 0)),
    joint_states_frame: String(pick("joint_states_frame", /joint_states_frame:\s*(\S+)/, "base_footprint")),
    odom_frame: String(pick("odom_frame", /odom_frame:\s*(\S+)/, "odom")),
    base_frame: String(pick("base_frame", /base_frame:\s*(\S+)/, "base_footprint")),
  };
}

export const fakeMethods = {
  fakeBases() { return this.nodes.filter((n) => n.kind === "tb3_fake"); },
  fakeInit(n, params, files) {
    Object.assign(n.params, fakeParams(params, files));
    n.ptypes = { ...(n.ptypes || {}), "wheels.separation": "double", "wheels.radius": "double", joint_states_frame: "string", odom_frame: "string", base_frame: "string" };
    n.fake = { x: 0, y: 0, th: 0, l: 0, r: 0, wl: 0, wr: 0, v: 0, w: 0, cmdL: 0, cmdR: 0, lastCmd: -1e9, t: wall(), t0: wall() };
    return [`[INFO] [${n.fake.t.toFixed(9)}] [${n.name}]: Turtlebot3 fake node has been initialised`];
  },
  // a running `ros2 topic pub -r N` keeps sending the command; anything else times out after 1 s like the real node
  fakeFeed(n) {
    const topic = `${n.ns}/cmd_vel`;
    const pub = this.nodes.find((x) => x.kind === "pubcli" && x.pub && x.pub.topic === topic && x.pub.type === "geometry_msgs/msg/Twist" && x.pub.rate > 0);
    if (pub) { const m = pub.pub.msg || {}; this.fakeCmd(n, Number(m.linear && m.linear.x) || 0, Number(m.angular && m.angular.z) || 0, false); }
  },
  fakeCmd(n, lx, az, advance = true) {
    if (advance) this.fakeAdvance(n);
    const F = n.fake, L = n.params["wheels.separation"];
    F.cmdL = lx - (az * L) / 2; F.cmdR = lx + (az * L) / 2; F.lastCmd = wall();
  },
  // integrate from the last update to now in 10 ms steps (as the wall timer does), with the 1 s command timeout
  fakeAdvance(n) {
    const F = n.fake; if (!F) return;
    this.fakeFeed(n);
    const now = wall(), R = n.params["wheels.radius"], L = n.params["wheels.separation"];
    let steps = Math.floor((now - F.t) / PERIOD); if (steps <= 0) return;
    if (steps > 60000) { F.t = now - 60000 * PERIOD; steps = 60000; }
    for (let i = 0; i < steps; i++) {
      F.t += PERIOD;
      const on = F.t - F.lastCmd <= TIMEOUT, vl = on ? F.cmdL : 0, vr = on ? F.cmdR : 0;
      const wl = R ? vl / R : NaN, wr = R ? vr / R : NaN;   // w = v / r (NaN with radius 0, then skipped like the C++ isnan check)
      F.wl = wl; F.wr = wr;
      const dl = Number.isFinite(wl) ? wl * PERIOD : 0, dr = Number.isFinite(wr) ? wr * PERIOD : 0;
      F.l += dl; F.r += dr;
      const ds = (R * (dr + dl)) / 2, dth = L ? (R * (dr - dl)) / L : 0;
      F.x += ds * Math.cos(F.th + dth / 2); F.y += ds * Math.sin(F.th + dth / 2); F.th += dth;
      F.v = ds / PERIOD; F.w = dth / PERIOD;
    }
  },
  fakeTfEdges() {
    return this.fakeBases().filter((n) => !this.unseen || !this.unseen(n)).map((n) => { this.fakeAdvance(n); const F = n.fake; return { parent: n.params.odom_frame, child: n.params.base_frame, t: [F.x, F.y, 0], q: [0, 0, Math.sin(F.th / 2), Math.cos(F.th / 2)] }; });
  },
  fakeJoints() {
    const n = this.fakeBases()[0]; if (!n) return null;
    this.fakeAdvance(n); return { wheel_left_joint: n.fake.l, wheel_right_joint: n.fake.r };
  },
  fakeNodeFor(topic) {
    for (const n of this.fakeBases()) for (const k of ["odom", "joint_states", "tf"]) if ((k === "tf" ? "/tf" : `${n.ns}/${k}`) === topic) return [n, k];
    return null;
  },
  fakeRate(topic) { return this.fakeNodeFor(topic) ? 1 / PERIOD : null; },
  fakeSample(topic) {
    const hit = this.fakeNodeFor(topic); if (!hit) return null;
    const [n, k] = hit; this.fakeAdvance(n);
    const F = n.fake, ns = Math.round(F.t * 1e9), st = `stamp:\n    sec: ${Math.floor(ns / 1e9)}\n    nanosec: ${ns % 1e9}`;
    const qz = Math.sin(F.th / 2), qw = Math.cos(F.th / 2), cov = Array(36).fill("  - 0.0").join("\n");
    if (k === "joint_states") return [`header:\n  ${st}\n  frame_id: ${n.params.joint_states_frame}\nname:\n- wheel_left_joint\n- wheel_right_joint\nposition:\n- ${f6(F.l)}\n- ${f6(F.r)}\nvelocity:\n- ${f6(Number.isFinite(F.wl) ? F.wl : 0)}\n- ${f6(Number.isFinite(F.wr) ? F.wr : 0)}\neffort:\n- 0.0\n- 0.0`];
    if (k === "odom") return [`header:\n  ${st}\n  frame_id: ${n.params.odom_frame}\nchild_frame_id: ${n.params.base_frame}\npose:\n  pose:\n    position:\n      x: ${f6(F.x)}\n      y: ${f6(F.y)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${f6(qz)}\n      w: ${f6(qw)}\n  covariance:\n${cov}\ntwist:\n  twist:\n    linear:\n      x: ${f6(F.v)}\n      y: 0.0\n      z: 0.0\n    angular:\n      x: 0.0\n      y: 0.0\n      z: ${f6(F.w)}\n  covariance:\n${cov}`];
    return [`transforms:\n- header:\n    ${st.replace(/\n/g, "\n  ")}\n    frame_id: ${n.params.odom_frame}\n  child_frame_id: ${n.params.base_frame}\n  transform:\n    translation:\n      x: ${f6(F.x)}\n      y: ${f6(F.y)}\n      z: 0.0\n    rotation:\n      x: 0.0\n      y: 0.0\n      z: ${f6(qz)}\n      w: ${f6(qw)}`];
  },
  // a Twist on <ns>/cmd_vel drives every fake node there; returns their names
  fakeTwist(topic, v) {
    const hit = this.fakeBases().filter((n) => `${n.ns}/cmd_vel` === topic);
    for (const n of hit) this.fakeCmd(n, v.lx || 0, v.az || 0);
    return hit.map((n) => n.name);
  },
};
