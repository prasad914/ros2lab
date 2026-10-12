// Home page Gazebo teaser: loads under the site's CSP, drives itself without crossing walls or obstacles, can be taken
// over (keys and buttons), pauses off-screen, and falls back to its poster without WebGL or WebAssembly.
// Usage: node tests/home-gazebo.mjs [seconds of sim time, default 40]
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const CSP = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8")).hosting.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy").value;
const SIM = Number(process.argv[2] || 40);
const GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

async function page(args, csp = CSP, vp = { width: 1440, height: 900 }) {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: vp });
  const errs = [], foreign = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|ERR_NAME|gstatic|googleapis|ytimg/.test(m.text())) errs.push(m.text()); });
  p.on("request", (r) => { const u = new URL(r.url()); if (u.origin !== "http://localhost:8080" && !/^data:|^blob:/.test(r.url())) foreign.push(r.url()); });
  // every HTML page gets the site's real Content-Security-Policy header, as Firebase Hosting sends it
  await p.route("http://localhost:8080/index.html", async (r) => { const res = await r.fetch(); r.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": csp } }); });
  await p.addInitScript(() => { window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  await p.goto("http://localhost:8080/index.html");
  return { b, p, errs, foreign };
}
const state = (p) => p.evaluate(() => window.__homeGz && window.__homeGz.state && window.__homeGz.state());

// 1. desktop: starts on scroll, under the CSP, same-origin only
{
  const { b, p, errs, foreign } = await page(GL);
  await p.waitForTimeout(800);
  ok(!(await state(p)), "Gazebo does not load before its section is near the viewport");
  await p.evaluate(() => document.getElementById("gazebo-live").scrollIntoView());
  await p.waitForFunction(() => window.__homeGz && window.__homeGz.state().t > 0.5, null, { timeout: 60000 });
  const s0 = await state(p);
  ok(s0.physics, "physics engine (Rapier, WebAssembly) runs under the CSP");
  // drive: watch the pose. The walls' inner faces are at +-2.38 m; the Burger's collision box and wheels reach about
  // 0.04 m from base_footprint, so its origin may come to 2.34 m and no further
  const W = 2.38 - 0.03; let maxAbs = 0, last = null, moved = 0;
  const OBST = [{ x: -1.736, y: 0, hx: 0.124, hy: 0.496 }];   // the shelf (static, axis aligned)
  const CYL = [{ x: 0.744, y: -0.868, r: 0.124 }, { x: -0.992, y: -0.744, r: 0.186 }];   // green pillar, yellow drum
  let inside = 0;
  while ((await state(p)).t < SIM) {
    const s = await state(p);
    maxAbs = Math.max(maxAbs, Math.abs(s.x), Math.abs(s.y));
    if (OBST.some((o) => Math.abs(s.x - o.x) < o.hx + 0.03 && Math.abs(s.y - o.y) < o.hy + 0.03) || CYL.some((c) => Math.hypot(s.x - c.x, s.y - c.y) < c.r + 0.03)) inside++;
    if (last) moved += Math.hypot(s.x - last.x, s.y - last.y);
    last = s; await p.waitForTimeout(250); if (process.env.V) console.log("     t", s.t.toFixed(2), s.x.toFixed(2), s.y.toFixed(2), "lvl", s.level);
  }
  const s1 = await state(p);
  console.log(`     sim ${s1.t.toFixed(1)} s, quality level ${s1.level}, path ${moved.toFixed(2)} m, max |x|,|y| ${maxAbs.toFixed(3)} m`);
  ok(maxAbs < W, "auto-drive stays inside the walls");
  ok(inside === 0, "auto-drive never enters the shelf, pillar or drum");
  ok(moved > 0.5, "the robot actually drives around");
  const hud = await p.locator(".hg3-hud").innerText();
  ok(/linear\.x/.test(hud) && /range: (\d|inf)/.test(hud) && /auto-drive: on/.test(hud), "HUD shows /cmd_vel and /scan");
  // take over with the keyboard: drive straight into the nearest wall for a while
  await p.locator(".hg3-view").focus();
  const before = await state(p);
  for (let i = 0; i < 12; i++) { await p.keyboard.press("ArrowLeft"); }
  for (let i = 0; i < 400 && (await state(p)).t < before.t + 25; i++) { await p.keyboard.press("ArrowUp"); await p.waitForTimeout(60); const s = await state(p); maxAbs = Math.max(maxAbs, Math.abs(s.x), Math.abs(s.y)); }
  const s2 = await state(p);
  ok(!s2.auto, "arrow keys switch auto-drive off");
  ok(Math.hypot(s2.x - before.x, s2.y - before.y) > 0.05, "arrow keys move the robot");
  ok(maxAbs < W, `driving into a wall with the keys stops at the wall (max ${maxAbs.toFixed(3)} m)`);
  ok(/you are driving/.test(await p.locator(".hg3-hud").innerText()), "HUD says the visitor is driving");
  // buttons
  const b0 = await state(p);
  await p.locator('.hg3-pad button[aria-label="Back"]').dispatchEvent("pointerdown", { pointerId: 1 });
  await p.waitForTimeout(2500);
  await p.locator('.hg3-pad button[aria-label="Back"]').dispatchEvent("pointerup", { pointerId: 1 });
  const b1 = await state(p);
  ok(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 0.01, "the on-screen Back button moves the robot");
  await p.click(".hg3-auto"); ok((await state(p)).auto, "Auto-drive button gives the wheel back");
  // pause off-screen
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(3000);   // a software-rendered frame can take a second
  const o0 = await state(p); await p.waitForTimeout(1500); const o1 = await state(p);
  ok(o0.t === o1.t && !o1.running, "simulation pauses when scrolled out of view");
  await p.evaluate(() => document.getElementById("gazebo-live").scrollIntoView()); await p.waitForTimeout(2500);
  ok((await state(p)).t > o1.t, "and resumes when scrolled back");
  const csp = await p.evaluate(() => window.__csp);
  ok(csp.length === 0, "no CSP violations " + csp.join(", "));
  ok(foreign.filter((u) => !/fonts\.googleapis|gstatic|ytimg/.test(u)).length === 0, "Gazebo loads only same-origin files " + foreign.filter((u) => !/fonts\.googleapis|gstatic|ytimg/.test(u)).join(" "));
  ok(errs.length === 0, "no page errors " + errs.join(" | "));
  await b.close();
}
// 2. phone: waits for the button
{
  const { b, p, errs } = await page(GL, CSP, { width: 390, height: 844 });
  await p.evaluate(() => document.getElementById("gazebo-live").scrollIntoView()); await p.waitForTimeout(2000);
  ok(!(await state(p)), "phone: nothing loads until the button is pressed");
  await p.click("#gz-start");
  await p.waitForFunction(() => window.__homeGz && window.__homeGz.state().t > 0.2, null, { timeout: 60000 });
  ok(true, "phone: the button starts Gazebo");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone: no sideways scroll with Gazebo running");
  ok(errs.length === 0, "phone: no page errors " + errs.join(" | "));
  await b.close();
}
// 3. no WebGL: the poster stays, with a reason
{
  const { b, p } = await page(["--disable-webgl", "--disable-3d-apis"]);
  await p.evaluate(() => document.getElementById("gazebo-live").scrollIntoView()); await p.waitForTimeout(6000);
  const txt = await p.locator("#gz-status").innerText().catch(() => "");
  ok(await p.locator(".lp-gz-poster img").isVisible() && /WebGL/.test(txt), "without WebGL the poster stays and says why: " + txt);
  await b.close();
}
// 4. WebAssembly blocked by a CSP without 'wasm-unsafe-eval': it still runs, and the walls still stop the robot
{
  const { b, p } = await page(GL, CSP.replace("'wasm-unsafe-eval' ", "").replace("'unsafe-eval' ", ""));
  await p.evaluate(() => document.getElementById("gazebo-live").scrollIntoView());
  await p.waitForFunction(() => window.__homeGz && window.__homeGz.state().t > 0.5, null, { timeout: 60000 }).catch(() => {});
  const s = await state(p);
  ok(s && !s.physics, "without WebAssembly Gazebo still runs (no physics engine)");
  let maxAbs = 0;
  if (s) { while ((await state(p)).t < s.t + Math.min(SIM, 20)) { const q = await state(p); maxAbs = Math.max(maxAbs, Math.abs(q.x), Math.abs(q.y)); await p.waitForTimeout(250); } }
  ok(s && maxAbs < 2.38 - 0.03, `and the robot stays inside the walls (max ${maxAbs.toFixed(3)} m)`);
  await b.close();
}
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
