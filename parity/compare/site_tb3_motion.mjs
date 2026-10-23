// The SITE side of the TurtleBot3 physics cases: the site's own Gazebo model (public/js/ros-graph.js + ros-gz.js +
// gz-physics.js, Rapier) loads the same parity/scripts/physics/worlds/<world>.sdf with the TurtleBot3 model files the
// site ships (public/robots/ws/turtlebot3/text.json), is stepped like the page steps it (terminal-sim.js gzTick: one
// gzStep(0.05) per 50 ms frame), gets the case's commands as the gz Twist on /cmd_vel would set them (gzTwist: m.cmd)
// at their sim time, and writes the real recorder's CSV formats (model__<m>__pose.csv.gz, odom.csv) into
// <out>/<case>/run1, so parity/compare/tb3_motion_fit.py measures both sides the same way. Deterministic: one run.
// Usage: node parity/compare/site_tb3_motion.mjs <public dir of the site> <out dir> <case dir> [<case dir> ...]
//   e.g. node parity/compare/site_tb3_motion.mjs public parity/browser_out/tb3_night1/physics_after parity/fixtures/physics/tb3_lin
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve as res, basename } from "node:path";
import { pathToFileURL } from "node:url";
const [PUB, OUT, ...CASES] = process.argv.slice(2);
const pub = res(PUB), worlds = res("parity/scripts/physics/worlds");
const { RosGraph } = await import(pathToFileURL(`${pub}/js/ros-graph.js`).href);
const { loadRapier } = await import(pathToFileURL(`${pub}/js/gz-physics.js`).href);
const bundle = JSON.parse(readFileSync(`${pub}/robots/ws/turtlebot3/text.json`, "utf8"));
const MODELS = "src/turtlebot3_simulations/turtlebot3_gazebo/models/";
// model://turtlebot3_* from the site's bundle; the physics kit's own model copies (turtlebot3_burger_noacc) from disk
const resolver = (p) => {
  const m = String(p).match(/(?:model:\/\/|\/models\/)(.+)$/);
  if (m && bundle[MODELS + m[1]] !== undefined) return { text: bundle[MODELS + m[1]] };
  if (m && existsSync(`parity/scripts/physics/models/${m[1]}`)) return { text: readFileSync(`parity/scripts/physics/models/${m[1]}`, "utf8") };
  if (existsSync(p)) return { text: readFileSync(p, "utf8") };
  return null;
};
const rapier = await loadRapier();
const f9 = (x) => Number(x).toFixed(9);
for (const dir of CASES) {
  const c = JSON.parse(readFileSync(`${dir}/case.json`, "utf8")), name = basename(dir);
  const g = new RosGraph();
  // STRIP_POSEPUB=1: the world's own objects (not the TurtleBot3) without their PosePublisher plugin, i.e. plain rigid
  // bodies like a box a student spawns. The site turns any model with a plugin into a kinematic "robot"
  // (gz-sdformat.js addModel), so the real recorder's PosePublisher would otherwise make the box immovable.
  let wtext = readFileSync(`${worlds}/${c.world}.sdf`, "utf8");
  if (process.env.STRIP_POSEPUB) wtext = wtext.replace(/(<model name="(?!burger|waffle_pi)[^"]+">[\s\S]*?)<plugin[^>]*pose-publisher[\s\S]*?<\/plugin>/g, "$1");
  const wfile = `/worlds/${c.world}.sdf`;
  const r = g.gzSim(["-r", "-s", wfile], { resolve: (p) => (p === wfile ? { text: wtext } : resolver(p)), env: { GZ_SIM_RESOURCE_PATH: "/models" } });
  if (!r.world) { console.log(name, "world did not load", r.err); continue; }
  for (let i = 0; i < 50 && !g.gzPhys; i++) await new Promise((ok) => setTimeout(ok, 20));   // Rapier attaches asynchronously
  const subs = (c.subs || []).filter((s) => s.endsWith(":pose_v")).map((s) => s.split("/")[2]);
  const cmds = (c.cmds || []).map((x) => JSON.parse(x)).filter((x) => x.type === "Twist").map((x) => ({ step: Math.round(x.t / 0.05), vx: Number((x.msg.match(/linear \{ x: ([-\d.e]+)/) || [0, 0])[1]), wz: Number((x.msg.match(/angular \{ z: ([-\d.e]+)/) || [0, 0])[1]) }));
  const robot = [...g.gz.models.values()].find((m) => m.gazebo.plugins.some((p) => p.kind === "diff_drive"));
  const pose = { }, odom = [];
  for (const s of subs) pose[s] = ["rx_sim_t,sim_t,name,x,y,z,qx,qy,qz,qw"];
  const steps = Math.round(c.until / 0.05);
  for (let k = 0; k <= steps; k++) {
    if (k) g.gzStep(0.05);   // sim time (k-1)*0.05 -> k*0.05
    const t = (k * 0.05).toFixed(6);
    for (const s of subs) {
      const m = g.gz.models.get(s), d = g.gz.dyn && g.gz.dyn[s];
      let x, y, z, q;
      if (m) { x = m.pose.x; y = m.pose.y; z = m.pose.z; const cy = Math.cos((m.pose.yaw || 0) / 2), sy = Math.sin((m.pose.yaw || 0) / 2); q = [0, 0, sy, cy]; }
      else if (d) { ({ x, y, z } = d); q = d.q; }
      else continue;
      pose[s].push([t, t, s, f9(x), f9(y), f9(z), ...q.map(f9)].join(","));
    }
    if (robot) {
      const o = g.gzOdom(robot), cy = Math.cos(o.yaw / 2), sy = Math.sin(o.yaw / 2);
      odom.push([t, t, "odom", "base_footprint", f9(o.x), f9(o.y), f9(0), f9(0), f9(0), f9(sy), f9(cy), f9(o.vx), f9(0), f9(0), f9(0), f9(0), f9(o.wz)].join(","));
    }
    for (const cm of cmds) if (cm.step === k && robot) robot.cmd = { vx: cm.vx, vy: 0, vz: 0, wz: cm.wz };   // acts from sim time k*0.05
  }
  const run = `${OUT}/${name}/run1`; mkdirSync(run, { recursive: true });
  copyFileSync(`${dir}/case.json`, `${OUT}/${name}/case.json`);
  for (const [s, rows] of Object.entries(pose)) writeFileSync(`${run}/model__${s}__pose.csv.gz`, gzipSync(rows.join("\n") + "\n"));
  writeFileSync(`${run}/odom.csv`, ["rx_sim_t,sim_t,frame_id,child_frame_id,x,y,z,qx,qy,qz,qw,vx,vy,vz,wx,wy,wz", ...odom].join("\n") + "\n");
  writeFileSync(`${run}/run_meta.json`, JSON.stringify({ site_public: pub, strip_posepub: !!process.env.STRIP_POSEPUB, dt: 0.05, steps, rapier: !!g.gzPhys, robot: robot && robot.name, tb3: robot ? (robot.tb3 ? "dynamic (tb3-motion.js)" : "kinematic") : null }, null, 1));
  console.log(name, "ok", robot && robot.name, robot && robot.tb3 ? "tb3-motion" : "kinematic");
}
void rapier;
