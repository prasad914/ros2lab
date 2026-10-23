// Night 1, Part 2.E: the SITE side of the TurtleBot3 Nav2 graph, captured the same way as capture_nav.sh pose mode:
// turtlebot3_world.launch.py, then navigation2.launch.py use_sim_time:=True (the shipped map), a snapshot before the
// initial pose, the initial pose at (-2.0, -0.5, 0) in the map frame, a snapshot once both lifecycle managers are active.
// Each snapshot types the same commands in a new terminal, like a student; QoS comes from the page's test hook
// (window.__ros2lab.topics). Writes parity/browser_out/tb3_night1/site_nav/<robot>/{before_pose,after_pose}/.
// Usage: BASE=http://localhost:8000 node parity/scripts/tb3_v3/site_nav_graph.mjs <tb3_burger|tb3_waffle_pi|tb3_waffle>
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const BASE = process.env.BASE || "http://localhost:8000", ROBOT = process.argv[2] || "tb3_burger", MODEL = ROBOT.replace(/^tb3_/, "");
const OUT = `${root}/parity/browser_out/tb3_night1/site_nav/${ROBOT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
const run = (c) => p.evaluate((c) => window.__ros2lab.term.run(c), c);
const screens = () => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => x.innerText));
async function waitText(re, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test((await screens()).join("\n"))) return true; await sleep(500); } return false; }
// one command in a new terminal; its output is that terminal's text once it stops changing
async function cmd(c, ms = 20000) {
  await p.evaluate(() => window.__ros2lab.term.newTerminal()); await sleep(300);
  for (const pre of ["cd ~/ros2_ws", "source install/setup.bash", `export TURTLEBOT3_MODEL=${MODEL}`]) await run(pre);
  const n0 = (await screens()).length - 1, before = (await screens())[n0];
  await run(c);
  let last = "", same = 0; const t0 = Date.now();
  while (Date.now() - t0 < ms) { await sleep(500); const s = (await screens())[n0]; if (s === last) { if (++same >= 3) break; } else { same = 0; last = s; } }
  const lines = last.slice(before.length).split("\n"); const i = lines.findIndex((l) => l.includes(c)); return lines.slice(i + 1).filter((l) => !/^\S*@\S*:.*\$\s*$/.test(l)).join("\n").trim();
}
async function snap(label) {
  const d = `${OUT}/${label}`; mkdirSync(d, { recursive: true });
  const w = (f, t) => writeFileSync(`${d}/${f}`, t + "\n");
  w("node_list.txt", await cmd("ros2 node list"));
  w("topic_list_t.txt", await cmd("ros2 topic list -t"));
  w("service_list_t.txt", await cmd("ros2 service list -t", 30000));
  w("action_list_t.txt", await cmd("ros2 action list -t"));
  const lc = await cmd("ros2 lifecycle nodes"); w("lifecycle_nodes.txt", lc);
  const st = [];
  for (const n of lc.split("\n").filter((l) => l.startsWith("/"))) st.push(`${n}: ${(await cmd(`ros2 lifecycle get ${n}`, 10000)).replace(/\n/g, " ")}`);
  w("lifecycle_states.txt", st.join("\n"));
  for (const k of ["error_code_names", "error_code_name_prefixes"]) w(`bt_navigator_${k}.txt`, await cmd(`ros2 param get /bt_navigator ${k}`, 10000));
  const qos = await p.evaluate(() => window.__ros2lab.topics.map((t) => ({ name: t.name, type: t.type,
    endpoints: [...t.publishers, ...t.subscribers].map((e) => ({ node: String(e.node), kind: e.endpoint_type, qos: String(e.qos && e.qos.raw) })) })));
  w("qos_hook.json", JSON.stringify(qos, null, 1));
  w("when.txt", `wall=${new Date().toISOString()} pageErrors=${errs.length}`);
}
await p.goto(`${BASE}/rviz.html?robot=${ROBOT}`);
await p.waitForFunction(() => window.__ros2lab?.sh?.realWs && window.__ros2lab.term, null, { timeout: 90000 });
for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", `export TURTLEBOT3_MODEL=${MODEL}`, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"]) await run(c);
console.log("world", await waitText(/\[create-\d+\]: process has finished cleanly/, 180000));
await p.evaluate(() => window.__ros2lab.term.newTerminal());
for (const c of ["cd ~/ros2_ws", "source install/setup.bash", `export TURTLEBOT3_MODEL=${MODEL}`, "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True"]) await run(c);
console.log("activating", await waitText(/Activating planner_server/, 240000));
await snap("before_pose");
await cmd(`ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "{header: {frame_id: map}, pose: {pose: {position: {x: -2.0, y: -0.5, z: 0.0}, orientation: {w: 1.0}}, covariance: [0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0685]}}"`, 10000);
let ok = false; for (let i = 0; i < 360 && !ok; i++) { ok = ((await screens()).join("\n").match(/Managed nodes are active/g) || []).length >= 2; if (!ok) await sleep(500); }
console.log("both managers active", ok);
await sleep(3000);
await snap("after_pose");
writeFileSync(`${OUT}/run.txt`, `BASE=${BASE} robot=${ROBOT} both_active=${ok} pageErrors=${JSON.stringify(errs)}\n`);
await b.close();
