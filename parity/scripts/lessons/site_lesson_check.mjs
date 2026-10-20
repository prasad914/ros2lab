// Read-only: renders each practice-terminal block with public/js/lesson-render.js on the local dev server (like
// parity/browser_out/lessons/tools46/site_browser.mjs), types every solution, drives RViz GUI steps by clicks,
// and records per task whether the page ticked it, the site lines and the real fixture step (term<N>.json).
// D4 term 2 also gets the bare `off: 0` SetPen probe in a new tab.
// Usage: node parity/scripts/lessons/site_lesson_check.mjs <out.json> [XT5,RV1,...]
//   BASE=http://127.0.0.1:8000 (dev server), RUN_SECS=<n> overrides the wait after commands that real left running.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const BASE = process.env.BASE || "http://127.0.0.1:8000", OUT = process.argv[2], RUN_SECS = Number(process.env.RUN_SECS || 0);
const LESSONS = (process.argv[3] || "XT5,RV1,D4,D13,F12,F15,N10,N18,N19,N23").split(",");
const course = JSON.parse(readFileSync(root + "/content/course-content.json", "utf8").replace(/^\uFEFF/, ""));
const blocks = [];
for (const m of course.modules) for (const l of m.lessons) { let ti = 0; for (const b of l.blocks || []) {
  if (b.t !== "term" || !b.tasks || !b.tasks.length) continue; ti++; if (LESSONS.includes(l.id)) blocks.push({ lesson: l.id, term: ti, b }); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const results = [];
for (const { lesson, term, b } of blocks) {
  const fx = `${root}/parity/fixtures/lessons/${lesson}/term${term}.json`;
  const real = existsSync(fx) ? JSON.parse(readFileSync(fx, "utf8")) : null;
  const realCmds = real ? real.steps.filter((s) => s.kind === "cmd") : [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(BASE + "/__lesson_harness.html", (route) => route.fulfill({ contentType: "text/html", body:
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/app.css"></head><body><main id="main"></main>
     <script type="module">import { renderLesson } from "./js/lesson-render.js"; const L = JSON.parse(document.getElementById("L").textContent);
     renderLesson(document.getElementById("main"), L); window.__harnessReady = true;</script>
     <script type="application/json" id="L">${JSON.stringify({ id: lesson, blocks: [b] }).replace(/</g, "\\u003c")}</script></body></html>` }));
  await page.goto(BASE + "/__lesson_harness.html");
  await page.waitForFunction(() => window.__harnessReady && document.querySelector(".tmr-pane input"), null, { timeout: 30000 });
  await sleep(500);
  const readPane = (id) => page.evaluate((id) => { const p = document.querySelector(`.tmr-pane[data-term="${id}"]`); return p ? [...p.querySelectorAll(".term-screen .line")].map((n) => n.textContent) : []; }, id);
  const busy = (id) => page.evaluate((id) => { const p = document.querySelector(`.tmr-pane[data-term="${id}"]`); const bar = p && p.querySelector(".term-proc"); return !!(bar && !bar.hidden && bar.isConnected); }, id);
  const ticks = () => page.evaluate(() => [...document.querySelectorAll(".term-tasks li")].map((li) => li.className === "done"));
  const viz = page.locator(".term-viz");
  async function gui(s) {
    const log = [];
    if (s.viz && s.viz.fixedFrame) { const f = viz.locator('[data-testid="fixed-frame"]').first(); await f.click(); await f.fill(s.viz.fixedFrame); await f.press("Enter"); await sleep(600); log.push(`Fixed Frame -> ${await f.inputValue()}`); }
    if (s.viz && s.viz.displays) for (const [name, on] of Object.entries(s.viz.displays)) {
      if (!on || name === "Grid") continue;
      await viz.locator("button.q-btn", { hasText: /^Add$/ }).first().click(); await sleep(400);
      const row = page.locator(`.q-modal .q-row[data-path="rviz_default_plugins/${name}"]`).first();
      if (!(await row.count())) { log.push(`Add ${name}: type not in dialog`); await page.keyboard.press("Escape"); continue; }
      await row.dblclick(); await sleep(600);
      log.push(`Add ${name}: ${await viz.locator(".q-row", { hasText: new RegExp(`^${name}`) }).count() ? "added" : "NOT added"}`);
      if (name === "RobotModel") {   // the lesson: click the empty Description Topic value, choose /robot_description
        const r = viz.locator(".q-row", { hasText: "Description Topic" }).last();
        if (await r.count()) { await r.locator(".q-c1").dblclick(); await sleep(300);
          const inp = viz.locator("input.q-ecin:not(.fixed-frame-input)").last();
          if (await inp.count()) { const opt = page.locator(".q-copt", { hasText: "/robot_description" }).first(); if (await opt.count()) await opt.click(); else { await inp.fill("/robot_description"); await inp.press("Enter"); } await sleep(500); log.push(`Description Topic -> ${(await r.textContent()).replace(/\s+/g, " ").trim()}`); }
          else { const sel = viz.locator("select.q-editor, .q-editor select").last(); if (await sel.count()) { await sel.selectOption("/robot_description"); await sleep(500); log.push("Description Topic -> /robot_description (select)"); } else log.push("Description Topic editor not found"); } }
        else log.push("Description Topic row not found");
      }
    }
    if (s.rvizGoal) {
      await viz.locator('button.q-tool[title^="2D Goal Pose"]').click(); await sleep(200);
      const c = viz.locator("canvas").first(); const bb = await c.boundingBox();
      const x = bb.x + bb.width * 0.6, y = bb.y + bb.height * 0.5;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y - 20, { steps: 5 }); await page.mouse.up(); await sleep(800);
      log.push("2D Goal Pose drag on the 3D view");
    }
    if (s.rvizSave) {
      await viz.locator("button.q-mitem", { hasText: "File" }).click(); await sleep(200);
      await page.locator(".q-menu").getByText(/Save Config As/).click(); await sleep(300);
      const i = page.locator(".q-modal input.q-line").first(); await i.fill(s.rvizSave);
      await page.locator(".q-modal button", { hasText: "Save" }).click(); await sleep(600);
      log.push(`Save Config As ${s.rvizSave}`);
    }
    return log;
  }
  let pane = 1; const tasks = []; let ci = 0;
  for (const [k, t] of b.tasks.entries()) {
    const steps = [];
    for (const s of [].concat(t.sol || [])) {
      if (s && s.newTerminal) { await page.click(".term-tab-add"); await sleep(400);
        pane = await page.evaluate(() => Math.max(...[...document.querySelectorAll(".tmr-pane")].map((p) => Number(p.dataset.term)))); steps.push({ kind: "newTerminal", term: pane }); continue; }
      if (s && s.nano) {
        const inp = page.locator(`.tmr-pane[data-term="${pane}"] .term-input-row input`);
        await inp.fill(`nano ${s.nano}`); await inp.press("Enter"); await sleep(400);
        const ok = await page.evaluate(([from, to]) => { const ta = document.querySelector(".nano textarea"); if (!ta) return false; ta.value = ta.value.replace(from, to); return true; }, s.replace || ["", ""]);
        if (ok) { await page.locator(".nano textarea").press("Control+o"); await page.locator(".nano textarea").press("Control+x"); }
        await sleep(300); steps.push({ kind: "nano", file: s.nano, opened: ok }); continue; }
      if (s && typeof s === "object") { let log; try { log = await gui(s); } catch (e) { log = [`GUI ERROR ${e.message.split("\n")[0]}`]; } steps.push({ kind: "gui", sol: s, log }); continue; }
      let interrupted = null;
      if (await busy(pane)) { const before = (await readPane(pane)).length;
        await page.locator(`.tmr-pane[data-term="${pane}"] .term-proc button`).filter({ hasText: "Ctrl+C" }).first().click(); await sleep(1500);
        interrupted = (await readPane(pane)).slice(before); }
      const prev = (await readPane(pane)).length;
      const inp = page.locator(`.tmr-pane[data-term="${pane}"] .term-input-row input`);
      await inp.fill(s); await inp.press("Enter");
      const rc = realCmds.find((x, i) => i >= ci && x.cmd === s); if (rc) ci = realCmds.indexOf(rc) + 1;
      const running = rc && rc.state && rc.state !== "finished";
      await sleep(running ? (RUN_SECS || Math.min(25, rc.secs || 8)) * 1000 : 1500);
      for (let w = 0; w < 30 && !running && !(await busy(pane)) && await page.evaluate((id) => { const p = document.querySelector(`.tmr-pane[data-term="${id}"] .term-input-row`); return p && p.hidden; }, pane); w++) await sleep(1000);
      const lines = (await readPane(pane)).slice(prev + 1);
      steps.push({ kind: "cmd", term: pane, cmd: s, interrupted, site: lines, siteRunning: await busy(pane), real: rc ? { out: rc.out, exit: rc.exit, state: rc.state } : null });
    }
    await sleep(500);
    tasks.push({ task: k + 1, do: t.do, tick: (await ticks())[k], steps });
  }
  // extra probe in D4 term 2: the old bare `off: 0` form, typed in a free terminal
  let bareOff = null;
  if (lesson === "D4" && term === 2) {
    await page.click(".term-tab-add"); await sleep(400);
    const p2 = await page.evaluate(() => Math.max(...[...document.querySelectorAll(".tmr-pane")].map((p) => Number(p.dataset.term))));
    const prev = (await readPane(p2)).length; const inp = page.locator(`.tmr-pane[data-term="${p2}"] .term-input-row input`);
    const c = `ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 4, off: 0}"`;
    await inp.fill(c); await inp.press("Enter"); await sleep(2500);
    bareOff = { cmd: c, site: (await readPane(p2)).slice(prev + 1) };
  }
  const allDone = await page.evaluate(() => { const d = document.querySelector(".term-done"); return !!d && !d.hidden; });
  results.push({ lesson, term, title: b.title, tasks, allDone, pageErrors: errors, bareOff });
  console.log(lesson, term, (await ticks()).map((x) => (x ? "Y" : "n")).join(""), allDone ? "ALL DONE" : "", errors.length ? `pageErrors ${errors.length}` : "");
  writeFileSync(OUT, JSON.stringify(results, null, 1));
  await page.close();
}
await browser.close();
