// Every gallery robot in Gazebo: launch <id>_bringup hardware_type:=gz (or its gazebo package), then report what
// Gazebo made of the URDF (links kept / dropped, collisions, mass, where it rests) and any warning or error.
//   node tests/gzsweep.mjs [robot ...]        FIX=1 also serves the stand-in course robots
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const FIXDIR = new URL("./fixtures/robots/", import.meta.url).pathname;
const index = JSON.parse(readFileSync(new URL("../public/robots/index.json", import.meta.url)));
const robots = Array.isArray(index) ? index : index.robots;
const want = process.argv.slice(2).length ? process.argv.slice(2) : robots.map((g) => g.id);
const b = await chromium.launch();
let bad = 0;
for (const id of want) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } }), p = await ctx.newPage();
  if (process.env.FIX) await p.route("**/robots/**", async (r) => { const rel = new URL(r.request().url()).pathname.replace(/^\/robots\//, ""); try { return r.fulfill({ body: readFileSync(FIXDIR + rel) }); } catch { return r.continue(); } });
  const errs = []; p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto("http://localhost:8080/rviz.html"); await p.waitForTimeout(1200);
  await p.goto(`http://localhost:8080/rviz.html?robot=${id}`); await p.waitForTimeout(3000);
  const screen = () => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => x.innerText).join("\n"));
  if (/Could not load/.test((await screen()).split("\n").reverse().find((l) => /packages? .* in ~\/ros2_ws|Could not load/.test(l)) || "Could not load")) { console.log(`--  ${id}: not in this copy`); await ctx.close(); continue; }
  const run = async (c, w = 1300) => { await p.evaluate((c) => window.__ros2lab.term.run(c), c); await p.waitForTimeout(w); };
  await run("cd ~/ros2_ws && colcon build && source install/setup.bash", 1500); await run("clear", 300);
  const files = await p.evaluate(() => [...window.__ros2lab.sh.fs.keys()].filter((k) => /ros2_ws\/src\/[\w-]+\/launch\/[\w.-]+\.launch\.py$/.test(k)));
  const bu = files.find((f) => /_bringup\/launch\/bringup\.launch\.py$/.test(f));
  const buText = bu ? await p.evaluate((f) => window.__ros2lab.sh.fs.get(f).content, bu) : "";
  const gzl = files.find((f) => /_gazebo\/launch\//.test(f));
  const cmd = bu && /'gz'/.test(buText) ? `ros2 launch ${bu.split("/")[5]} bringup.launch.py hardware_type:=gz` : gzl ? `ros2 launch ${gzl.split("/")[5]} ${gzl.split("/").pop()}` : null;
  if (!cmd) { console.log(`--  ${id}: no Gazebo launch`); await ctx.close(); continue; }
  await run(cmd, 7000);
  const st = await p.evaluate(() => { const g = window.__ros2lab.sh.graph; if (!g.gz) return null; return [...g.gz.models.values()].map((m) => ({ name: m.name, links: Object.keys(m.model.links).length, urdfLinks: Object.keys(m.urdfModel.links).length, dropped: [...m.sdf.dropped], coll: m.sdf.collisions, mass: +m.sdf.mass.toFixed(2), z: +m.pose.z.toFixed(3), restZ: m.restZ == null ? null : +m.restZ.toFixed(3), air: !!m.airborne, fixed: !!m.fixedBase, cm: !!m.cm })); });
  if (process.env.DUMP) for (const [name, urdf] of await p.evaluate(() => [...window.__ros2lab.sh.graph.gz.models.values()].map((m) => [m.name, m.urdf]))) writeFileSync(`${process.env.DUMP}/${id}__${name}.urdf`, urdf);
  const out = await screen();
  const lines = out.split("\n").filter((l) => /urdf2sdf|\[ERROR\]|Traceback|process has died|Failed to find|Error Code|\[Err\]/.test(l));
  const m = st && st[0];
  const ok = m && !lines.length && !errs.length && !m.air;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "BAD"} ${id}: ${cmd.replace("ros2 launch ", "")} | ${m ? `links ${m.links}/${m.urdfLinks} coll ${m.coll} mass ${m.mass} kg z ${m.z} rest ${m.restZ}${m.fixed ? " fixed" : ""}${m.cm ? " ros2_control" : ""}${m.air ? " FALLING" : ""}` : "no model in Gazebo"}`);
  for (const e of [...lines.slice(0, 5), ...errs.slice(0, 2)]) console.log("     " + e.slice(0, 230));
  await ctx.close();
}
await b.close();
console.log(`${bad} with problems`);
