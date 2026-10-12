// Drive robots in Gazebo the way a student does: launch from the in-page terminal, open a second terminal and type
// the real `ros2 topic pub -r 10 ...` command. Then check that walls, the static boxes and the pillar stop the robot
// (no tunneling even at 2 m/s, no climbing, no jitter) and that the loose box / ball get pushed.
//   node tests/wall-term.mjs [robot[:mode] ...]      mode: sim | control | bringup   (default: the robot's modes)
//   SCEN=fwd,fast node tests/wall-term.mjs chiku:control      PAR=4 (parallel windows)
// The simulation is advanced with the graph's own gzStep (the same call the 50 ms Gazebo tick makes), only faster.
import { chromium } from "@playwright/test";
const SCEN = {   // name: [x, y, yaw, linear.x, angular.z, seconds]   (null pose = where the robot was spawned)
  fwd: [null, null, null, 0.3, 0, 30], fast: [null, null, null, 2.0, 0, 8], back: [null, null, null, -0.3, 0, 30],
  angle: [0, 0, 0.6, 0.5, 0, 20], turn: [2.6, -2.6, 0, 0.5, 0.6, 20], redbox: [0.3, 0.6, 0, 0.5, 0, 10],
  pillar: [0, -1.4, 0, 0.5, 0, 10], cardboard: [0.9, 0.9, Math.PI / 2, 0.3, 0, 12], ball: [1.2, -0.4, 0, 0.3, 0, 15],
  fastangle: [0, 0, -0.5, 2.0, 0, 6],
};
const DEFAULT = ["chiku:sim", "chiku:control", "chiku:bringup", "chiku_mesh:control", "chiku_mesh:sim", "mecanum:sim", "mecanum:bringup", "ackermann:sim", "ackermann:bringup", "tb3_burger:sim", "tb3_waffle:sim", "scout:sim", "mobile_manipulator:control", "mobile_manipulator:sim"];
const cases = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT).map((s) => { const [robot, mode = "control"] = s.split(":"); return { robot, mode }; });
const scen = (process.env.SCEN || Object.keys(SCEN).join(",")).split(",");
const b = await chromium.launch();
let fails = 0;
async function one({ robot, mode }) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }), p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`http://localhost:8080/rviz.html?robot=${robot}`); await p.waitForTimeout(3000);
  for (let i = 0; i < 20 && !(await p.evaluate(() => [...window.__ros2lab.sh.fs.keys()].some((k) => /ros2_ws\/src\/.*\.launch\.py$/.test(k)))); i++) await p.waitForTimeout(500);
  const run = async (c, w = 1200) => { await p.evaluate((c) => window.__ros2lab.term.run(c), c); await p.waitForTimeout(w); };
  const files = await p.evaluate(() => [...window.__ros2lab.sh.fs.keys()].filter((k) => /ros2_ws\/src\/[\w-]+\/launch\/[\w.-]+\.launch\.py$/.test(k)).map((k) => k.split("/").slice(5).join("/")));
  const pick = (re) => files.find((f) => re.test(f));
  const lf = mode === "bringup" ? pick(/_bringup\/launch\/bringup\.launch\.py$/) : mode === "control" ? pick(/\/launch\/sim_control\.launch\.py$/) || pick(/_gazebo\/launch\/.*control.*\.launch\.py$/) : pick(/_description\/launch\/sim\.launch\.py$/) || pick(/_gazebo\/launch\/(gazebo|sim)\.launch\.py$/);
  const out = [];
  if (!lf) { out.push(`--   ${robot}:${mode}: no launch file (${files.join(" ")})`); await ctx.close(); return out; }
  await run("cd ~/ros2_ws && colcon build && source install/setup.bash", 2000);
  const launch = `ros2 launch ${lf.split("/")[0]} ${lf.split("/").pop()}${mode === "bringup" ? " hardware_type:=gz" : ""}`;
  await run(launch, 6000);
  for (let i = 0; i < 40 && !(await p.evaluate(() => { const g = window.__ros2lab.sh.graph; return !!(g.gzRunning() && g.gzPhys && g.gz.models.size); })); i++) await p.waitForTimeout(500);
  const info = await p.evaluate(() => {
    const g = window.__ros2lab.sh.graph; if (!g.gzRunning() || !g.gz.models.size) return null;
    const m = [...g.gz.models.values()][0];
    const cm = g.cmModels ? g.cmModels() : [];
    const subs = cm.flatMap((x) => x.cm.endpoints().subs).filter(([, t]) => t === "geometry_msgs/msg/TwistStamped").map(([n]) => n);
    const tw = g.bridges().filter((e) => e.dir !== "GZ_TO_ROS" && e.rosType === "geometry_msgs/msg/Twist").map((e) => e.ros);
    return { name: m.name, cm: !!m.cm, subs, tw, start: { ...m.pose } };
  });
  if (!info) { out.push(`FAIL ${robot}:${mode}: Gazebo has no robot after \`${launch}\``); fails++; await ctx.close(); return out; }
  for (const s of scen) {
    const [x0, y0, yaw0, lx, az, secs] = SCEN[s];
    // reset: stop, then put the robot where the scenario starts (as `gz service ... set_pose` would) and the loose objects back
    const ok0 = await p.evaluate(({ x0, y0, yaw0, start }) => {
      const g = window.__ros2lab.sh.graph, m = [...g.gz.models.values()][0], PH = g.gzPhys;
      for (const n of g.nodes.filter((n) => n.kind === "pubcli")) g.kill ? g.kill(n.full) : (g.nodes = g.nodes.filter((k) => k !== n));
      m.cmd = { vx: 0, vy: 0, vz: 0, wz: 0 };
      for (let i = 0; i < 20; i++) { g.gzStep(0.05); m.cmd = { vx: 0, vy: 0, vz: 0, wz: 0 }; }   // let the controller time out (cmd_vel_timeout)
      m.pose.x = x0 ?? start.x; m.pose.y = y0 ?? start.y; m.pose.yaw = yaw0 ?? start.yaw;
      PH.syncLinks(m, true);
      for (const w of g.gz.world.models) { const b = PH.dyn.get(w.name); if (b) { b.setTranslation({ x: +w.pose[0], y: +w.pose[1], z: +w.pose[2] }, true); b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); } }
      for (let i = 0; i < 20; i++) g.gzStep(0.05);
      return true;
    }, { x0, y0, yaw0, start: info.start });
    await p.evaluate(() => window.__ros2lab.term.newTerminal()); await p.waitForTimeout(300);
    const cmd = info.cm && info.subs.length
      ? `ros2 topic pub -r 10 ${info.subs[0]} geometry_msgs/msg/TwistStamped "{twist: {linear: {x: ${lx}}, angular: {z: ${az}}}}"`
      : `ros2 topic pub -r 10 ${info.tw[0] || "/cmd_vel"} geometry_msgs/msg/Twist "{linear: {x: ${lx}}, angular: {z: ${az}}}"`;
    await run(cmd, 400);
    const r = await p.evaluate(({ secs }) => {
      const g = window.__ros2lab.sh.graph, m = [...g.gz.models.values()][0], PH = g.gzPhys, R = PH.R, rb = PH.robots.get(m.name);
      const dyn0 = JSON.parse(JSON.stringify(g.gz.dyn || {}));
      let pen = 0, maxZ = -1, minZ = 9, jit = 0, prev = null, track = [];
      const sh = rb.collider.shape;
      // the chassis, 2 cm smaller on each side: if it overlaps a fixed body the robot is inside a wall / box
      const small = sh.halfExtents ? new R.Cuboid(Math.max(0.005, sh.halfExtents.x - 0.02), Math.max(0.005, sh.halfExtents.y - 0.02), Math.max(0.005, sh.halfExtents.z - 0.02)) : new R.Cylinder(Math.max(0.005, sh.halfHeight - 0.02), Math.max(0.005, sh.radius - 0.02));
      const hits = new Set();
      for (let t = 0; t < secs; t += 0.05) {
        g.gzStep(0.05);
        const c = rb.collider.translation(), q = rb.collider.rotation();
        PH.world.intersectionsWithShape(c, q, small, (col) => { const pb = col.parent(); if (pb && pb.isFixed()) { pen++; hits.add(`${pb.translation().x.toFixed(1)},${pb.translation().y.toFixed(1)}`); } return true; }, R.QueryFilterFlags.EXCLUDE_SENSORS, 0x00010001, undefined, rb.base);
        maxZ = Math.max(maxZ, m.pose.z); minZ = Math.min(minZ, m.pose.z);
        if (prev && m.bumped && Math.hypot(m.pose.x - prev.x, m.pose.y - prev.y) > 0.05) jit++;   // a blocked robot that still jumps around
        prev = { x: m.pose.x, y: m.pose.y };
        if (Math.round(t * 20) % 40 === 0) track.push(`${m.pose.x.toFixed(2)},${m.pose.y.toFixed(2)}${m.bumped ? "*" : ""}`);
      }
      const dyn1 = g.gz.dyn || {}, pushed = Object.keys(dyn1).filter((k) => dyn0[k] && Math.hypot(dyn1[k].x - dyn0[k].x, dyn1[k].y - dyn0[k].y) > 0.1).map((k) => `${k}->${dyn1[k].x.toFixed(2)},${dyn1[k].y.toFixed(2)}`);
      const flying = Object.values(dyn1).some((d) => d.z > 1.5 || d.z < -0.5);
      return { x: m.pose.x, y: m.pose.y, yaw: m.pose.yaw, z0: minZ, z1: maxZ, restZ: m.restZ, pen, hits: [...hits], jit, track: track.join(" "), pushed, flying, out: Math.abs(m.pose.x) > 3.95 || Math.abs(m.pose.y) > 3.95 };
    }, { secs });
    const bad = [];
    if (r.pen) bad.push(`inside a fixed body ${r.pen}x (${r.hits.join(" ")})`);
    if (r.out) bad.push("left the walled area");
    if (r.restZ != null && r.z1 > r.restZ + 0.05) bad.push(`climbed to z=${r.z1.toFixed(3)}`);
    if (r.jit > 2) bad.push(`jitter ${r.jit}`);
    if (r.flying) bad.push("an object flew away");
    if (s === "cardboard" && !r.pushed.some((k) => k.startsWith("cardboard"))) bad.push("did not push the cardboard box");
    if (s === "ball" && !r.pushed.some((k) => k.startsWith("orange"))) bad.push("did not push the ball");
    if (bad.length) fails++;
    out.push(`${bad.length ? "FAIL" : "ok  "} ${robot}:${mode} ${s.padEnd(9)} end ${r.x.toFixed(2)},${r.y.toFixed(2)} yaw ${r.yaw.toFixed(2)} z ${r.z0.toFixed(3)}..${r.z1.toFixed(3)}${r.pushed.length ? " pushed " + r.pushed.join(" ") : ""}${bad.length ? "  <-- " + bad.join("; ") : ""}${process.env.V ? "\n      " + r.track : ""}`);
    await p.evaluate(() => window.__ros2lab.term.run("\x03")).catch(() => {});
  }
  if (errs.length) { out.push(`     page errors: ${errs.slice(0, 3).join(" | ")}`); fails++; }
  out.push(`     (${info.name}: ${info.cm ? "ros2_control " + info.subs.join(",") : "Gazebo system " + info.tw.join(",")})`);
  await ctx.close();
  return out;
}
const PAR = Number(process.env.PAR || 3), queue = [...cases];
await Promise.all(Array.from({ length: PAR }, async () => { while (queue.length) { const c = queue.shift(); try { console.log((await one(c)).join("\n")); } catch (e) { fails++; console.log(`FAIL ${c.robot}:${c.mode}: ${e.message.split("\n")[0]}`); } } }));
await b.close();
console.log(fails ? `${fails} FAILED` : "all wall checks passed");
process.exit(fails ? 1 : 0);
