// The gz-real scenarios (tests/gz-real-lib.mjs) in Chromium: the page imports the site's own modules from the static
// server (http://localhost:8080/js/...), files come from the workspace through an exposed resolver.
// Usage: node tests/gz-real-browser.mjs [tb3|waffle|ur5e|fr3|gen3|xarm6|lite6|cr5 ...]   (wrapped by gz-real-tb3.mjs / gz-real-arms.mjs)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { makeResolver, fixture } from "./gz-resolver.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE = process.env.R2L_BASE || "http://localhost:8080";
export async function runBrowser(which) {
  const resolve = await makeResolver();
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.route(`${BASE}/__gztests/**`, (route) => { const f = path.join(ROOT, "tests", new URL(route.request().url()).pathname.replace(/^\/__gztests\//, "")); route.fulfill({ status: fs.existsSync(f) ? 200 : 404, contentType: "text/javascript", body: fs.existsSync(f) ? fs.readFileSync(f) : "" }); });
  await page.exposeFunction("gzResolveFile", (p) => { const r = resolve(p); if (!r) return null; return r.text != null ? { text: r.text } : { b64: Buffer.from(r.bytes).toString("base64") }; });
  await page.exposeFunction("gzFixture", (n) => fixture(n));
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded" });
  const res = await page.evaluate(async (which) => {
    const J = "/js/";
    const mods = { sdformat: await import(J + "gz-sdformat.js"), cli: await import(J + "gz-cli.js"), rosgz: await import(J + "ros-gz.js"), rc: await import(J + "ros-control-graph.js"), physics: await import(J + "gz-physics.js"), harness: await import("/__gztests/gz-harness.mjs") };
    const lib = await import("/__gztests/gz-real-lib.mjs");
    const { CONTROLLER_TYPES } = await import(J + "ros2-control.js");
    Object.assign(CONTROLLER_TYPES, { "ur_controllers/ScaledJointTrajectoryController": "jtc", "ur_controllers/SpeedScalingStateBroadcaster": "other", "ur_controllers/GPIOController": "other", "franka_example_controllers/JointImpedanceExampleController": "other", "picknik_twist_controller/PicknikTwistController": "other", "picknik_reset_fault_controller/PicknikResetFaultController": "other" });
    const fx = {}; const fixtureSync = (n) => fx[n];
    const io = { resolve: async (p) => { const r = await window.gzResolveFile(p); if (!r) return null; if (r.text != null) return r; const b = atob(r.b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return { bytes: u }; }, fixture: fixtureSync, yamlIndentless: true };
    const ARMS = { ur5e: ["ur5e-1", { controller: "scaled_joint_trajectory_controller" }], fr3: ["fr3-2", { expectCreateFail: "two parents|Two root links" }], gen3: ["gen3-1", { controller: "joint_trajectory_controller", expectFail: ["robotiq_gripper_controller"] }],
      xarm6: ["xarm6-3", { controller: "xarm6_traj_controller" }], lite6: ["lite6-4", { controller: "lite6_traj_controller" }], cr5: ["cr5-1", { controller: "cr5_group_controller" }] };
    const out = [];
    for (const w of which) {
      const name = w === "tb3" ? "tb3_burger-1" : w === "waffle" ? "tb3_waffle-2" : ARMS[w][0];
      fx[name] = await window.gzFixture(name);
      const t0 = performance.now();
      const r = w === "tb3" ? await lib.tb3World(mods, io) : w === "waffle" ? await lib.tb3Waffle(mods, io) : await lib.armHoldAndFollow(mods, io, ARMS[w][0], ARMS[w][1]);
      out.push({ w, ms: Math.round(performance.now() - t0), pass: r.pass, checks: r.checks.map((c) => ({ name: c.name, ok: c.ok, info: c.ok ? null : JSON.stringify(c.info) })) });
    }
    return out;
  }, which);
  await browser.close();
  let failed = 0;
  for (const r of res) { for (const c of r.checks) console.log(`${c.ok ? "ok  " : "FAIL"} [chromium] ${r.w}: ${c.name}${c.ok ? "" : "  " + String(c.info).slice(-700)}`); console.log(`     ${r.w}: ${r.ms} ms`); if (!r.pass) failed++; }
  return failed;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const want = process.argv.slice(2);
  const failed = await runBrowser(want.length ? want : ["tb3", "waffle", "ur5e", "fr3", "gen3", "xarm6", "lite6", "cr5"]);
  console.log(failed ? `${failed} scenario(s) failed` : "all scenarios passed (chromium)");
  process.exit(failed ? 1 : 0);
}
