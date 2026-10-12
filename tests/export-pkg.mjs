// Writes the workspace packages the browser made for a robot to a folder, to build and run them with real ROS 2.
//   node tests/export-pkg.mjs <robot> <out folder> [package ...]      (FIX=1: stand-in course robots)
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const [robot, out, ...only] = process.argv.slice(2);
const FIXDIR = new URL("./fixtures/robots/", import.meta.url).pathname;
const b = await chromium.launch(); const p = await b.newPage();
if (process.env.FIX) await p.route("**/robots/**", async (r) => { const rel = new URL(r.request().url()).pathname.replace(/^\/robots\//, ""); try { return r.fulfill({ body: readFileSync(FIXDIR + rel), contentType: "text/plain" }); } catch { return r.continue(); } });
await p.goto("http://localhost:8080/rviz.html"); await p.waitForTimeout(1200);
await p.goto(`http://localhost:8080/rviz.html?robot=${robot}`); await p.waitForTimeout(3000);
const files = await p.evaluate(() => [...window.__ros2lab.sh.fs.entries()].filter(([k, v]) => k.startsWith("/home/student/ros2_ws/src/") && v.type === "f").map(([k, v]) => [k.slice("/home/student/ros2_ws/src/".length), String(v.content)]));
let n = 0;
for (const [rel, text] of files) {
  if (only.length && !only.includes(rel.split("/")[0])) continue;
  if (text.startsWith("@url:")) continue;
  const f = join(out, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); n++;
}
console.log(`${n} files -> ${out}`);
await b.close();
