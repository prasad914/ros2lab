// The Nav2 / SLAM scenarios (tests/nav2-lib.mjs) in Node: fast development loop. The Chromium run with the RViz
// screenshot is tests/nav2.mjs. Usage: node tests/nav2-node.mjs [nav|slam]
import { makeResolver, fixture } from "./gz-resolver.mjs";
import * as harness from "./gz-harness.mjs";
import * as lib from "./gz-real-lib.mjs";
import * as N from "./nav2-lib.mjs";
const P = "../public/js/";
const mods = { sdformat: await import(P + "gz-sdformat.js"), cli: await import(P + "gz-cli.js"), rosgz: await import(P + "ros-gz.js"), rc: await import(P + "ros-control-graph.js"), physics: await import(P + "gz-physics.js"), harness, lib, nav2: await import(P + "nav2-sim.js"), core: await import(P + "nav2-core.js") };
const resolve = await makeResolver();
const io = { resolve: async (p) => resolve(p), fixture, yamlIndentless: true };
const want = process.argv.slice(2).length ? process.argv.slice(2) : ["nav", "slam"];
let failed = 0;
for (const w of want) {
  const t0 = Date.now();
  const r = w === "nav" ? await N.nav2Scenario(mods, io) : await N.slamScenario(mods, io);
  for (const c of r.checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${w}: ${c.name}${c.ok ? "" : "  " + String(JSON.stringify(c.info)).slice(0, 1500)}`);
  console.log(`     ${w}: ${Date.now() - t0} ms`);
  if (!r.pass) failed++;
}
console.log(failed ? `${failed} scenario(s) failed` : "nav2-node: all passed");
process.exit(failed ? 1 : 0);
