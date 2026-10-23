// Every gallery robot, each in a fresh browser page: load it, build the workspace, launch its display, and its
// <id>_bringup with hardware_type:=mock when it has one; report [ERROR] lines and page errors.
//   node tests/sweep.mjs [robot ...]        FIX=1 also serves the stand-in course robots from tests/fixtures
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const FIXDIR = new URL("./fixtures/robots/", import.meta.url).pathname;
const index = JSON.parse(readFileSync(new URL("../public/robots/index.json", import.meta.url)));
const robots = Array.isArray(index) ? index : index.robots;
const want = process.argv.slice(2).length ? process.argv.slice(2) : robots.map((g) => g.id);
const b = await chromium.launch();
let bad = 0, skipped = 0;
for (const id of want) {
  const g = robots.find((x) => x.id === id);
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } }), p = await ctx.newPage();
  await ctx.addInitScript(() => { try { localStorage.setItem("ros2lab.dev.underTest", "open"); } catch { /* no storage */ } });   // under-test robots too (robot-info.js)
  if (process.env.FIX) await p.route("**/robots/**", async (r) => { const rel = new URL(r.request().url()).pathname.replace(/^\/robots\//, ""); try { return r.fulfill({ body: readFileSync(FIXDIR + rel), contentType: "text/plain" }); } catch { return r.continue(); } });
  const errs = []; p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await p.goto("http://localhost:8080/rviz.html"); await p.waitForTimeout(1200);
  await p.goto(`http://localhost:8080/rviz.html?robot=${id}`); await p.waitForTimeout(Number(process.env.PW || 3000));
  const screen = () => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => x.innerText).join("\n=====\n"));
  const intro = await screen();
  const line = intro.split("\n").reverse().find((l) => l.includes(g.title));
  if (!line || /Could not load/.test(line)) { console.log(`--  ${id}: not in this copy`); skipped++; await ctx.close(); continue; }
  const pkgs = (line.match(/packages? ([\w, ]+?) (?:are|is) in/) || [, ""])[1].split(/,\s*/).filter(Boolean);
  const run = async (c, w = 1300) => { await p.evaluate((c) => window.__ros2lab.term.run(c), c); await p.waitForTimeout(w); };
  await run("cd ~/ros2_ws && colcon build && source install/setup.bash", 1500);
  const desc = pkgs.find((x) => /_description$|_support$/.test(x)) || pkgs[0];
  await run(`ros2 launch ${desc} display.launch.py`, 1500);
  const disp = await screen();
  await p.evaluate(() => window.__ros2lab.term.stopAll());
  const bu = pkgs.find((x) => /_bringup$/.test(x));
  let buOut = "", buState = "";
  if (bu) {
    await run("clear");
    const sel = await p.evaluate(async (bu) => { const f = window.__ros2lab.sh.fs.get(`/home/student/ros2_ws/src/${bu}/launch/bringup.launch.py`); return f ? f.content : ""; }, bu);
    const mode = /'mock'/.test(sel) ? "mock" : "gz";
    if (mode === "mock") { await run(`ros2 launch ${bu} bringup.launch.py hardware_type:=mock`, 2000); buOut = await screen(); buState = /process has died|\[ERROR\]/.test(buOut) ? "FAILED" : /is running in this terminal/.test(buOut) ? "mock running" : "?"; }
    else buState = "no mock (gz/real only)";
    await p.evaluate(() => window.__ros2lab.term.stopAll());
  }
  const errors = (disp + "\n" + buOut).split("\n").filter((l) => /\[ERROR\]|Traceback|xacro: error|process has died/.test(l));
  const ok = !errors.length && !errs.length;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "BAD"} ${id}: ${pkgs.join(" ")}${bu ? ` | ${buState}` : ""}`);
  for (const e of [...errors.slice(0, 4), ...errs.slice(0, 2)]) console.log("     " + e.slice(0, 220));
  await ctx.close();
}
await b.close();
console.log(`${want.length - bad - skipped} ok, ${bad} with errors, ${skipped} not in this copy`);
process.exit(bad ? 1 : 0);
