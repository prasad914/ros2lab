// Student portal (course.html, four tabs) and the lesson page, at 1440 / 1024 / 390, with the mock Firebase.
//  - no horizontal scroll, no console errors (the localhost heartbeat is ignored)
//  - three lessons: a Week 1 terminal lesson (A1), IN3 "The parts of ROS" (Week 3) and a Week 5 code lesson (F3):
//    the first task ticks (className "done") when its command is typed; the Next reason shows and is linked by aria-describedby
//  - sticky bars sit under the header (--top-h); the phone Previous / Next bar is one row
//   node tests/ui-student.mjs            (site on localhost:8080; BASE=… to change; SHOTS=<dir> saves screenshots)
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const SHOTS = process.env.SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const fails = [];
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails.push(m); };
const course = JSON.parse(readFileSync(path.join(root, "content/course-content.json"), "utf8").replace(/^﻿/, ""));
const LESSONS = {};
for (const m of course.modules) for (const l of m.lessons) LESSONS[l.id] = { ...l, moduleId: m.id };
const LESSON_IDS = [["A1", "Week 1 terminal lesson"], ["IN3", "IN3 The parts of ROS (Week 3)"], ["F3", "Week 5 code lesson"]];
const browser = await chromium.launch();

async function open(w, url, lessons) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
  if (lessons) await ctx.addInitScript((L) => { window.__MOCK_LESSONS = L; }, lessons);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/${url}`, { waitUntil: "load" });
  return { ctx, page, errors };
}
const hscroll = (p) => p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
const shot = (p, name) => SHOTS ? p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }) : null;

for (const w of [1440, 1024, 390]) {
  console.log(`course.html @${w}`);
  const { ctx, page, errors } = await open(w, "course.html");
  await page.waitForSelector(".dash-tabs button", { timeout: 15000 });
  for (const t of ["overview", "lessons", "tests", "certificate"]) {
    await page.click(`#tab-${t}`);
    await page.waitForTimeout(150);
    const sw = await hscroll(page);
    check(sw[0] <= sw[1], `${t}: no horizontal scroll (${sw.join("/")})`);
    await shot(page, `portal-${t}-${w}`);
  }
  await page.click("#tab-overview");
  const ov = await page.locator("#tabpanel").innerText();
  check(await page.locator(".welcome a.btn").getAttribute("href") === "lesson.html?id=IN3", "overview: Continue → IN3");
  check(/Week 3, Day \d+: The parts of ROS/.test(ov), "overview: next lesson with its week and day");
  check(/Tests:\s*Week 1\s*80% ✓/.test(ov) && /Week 2\s*best so far 53\.3%/.test(ov), "overview: tests line from the data (Week 1 80% ✓, Week 2 best so far 53.3%)");
  check(/Certificate course/.test(ov) && /Robot modelling & RViz/.test(ov) && /Notices/.test(ov) && /Useful links/.test(ov), "overview: My courses, Notices, Useful links");
  check(await page.locator('.cards a[href="plan.html"]').count() === 1 && await page.locator('.cards a[href="modelling.html"]').count() === 1, "overview: course cards link to plan.html and modelling.html");
  const lum = await page.locator("#tabpanel .arcade").evaluate((n) => { const c = getComputedStyle(n).backgroundColor.match(/\d+/g).map(Number); return (c[0] + c[1] + c[2]) / 3; });
  check(lum > 200, `overview: Playground box is a light card (background brightness ${Math.round(lum)})`);
  await page.click("#tab-lessons");
  check(await page.locator(".wkcard").count() === 9 && await page.locator(".wkcard.current").count() === 1, "lessons: 9 week cards, the current one open");
  check(await page.locator(".wkcard li.les.done").count() > 0 && await page.locator(".wkcard li.les.next").count() === 1, "lessons: Done and Next states");
  check(!errors.length, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}

for (const w of [1440, 1024, 390]) for (const [id, label] of LESSON_IDS) {
  console.log(`lesson.html?id=${id} @${w}: ${label}`);
  const { ctx, page, errors } = await open(w, `lesson.html?id=${id}`, { [id]: LESSONS[id] });
  await page.waitForSelector(".lesson-body .tmr-pane input", { timeout: 30000 });
  await page.waitForTimeout(600);
  const sw = await hscroll(page);
  check(sw[0] <= sw[1], `no horizontal scroll (${sw.join("/")})`);
  const g = await page.evaluate(() => {
    const top = document.querySelector(".lesson-top").getBoundingClientRect(), hd = document.querySelector("header.top").getBoundingClientRect();
    const nav = document.querySelector("p.navlabel"), pager = document.querySelector(".pager").getBoundingClientRect();
    return { hdBottom: hd.bottom, top: top.top, navShown: !!(nav && nav.offsetParent), pagerBottom: pager.bottom, vh: innerHeight, crumbs: document.querySelector(".crumbs").textContent };
  });
  check(Math.abs(g.top - g.hdBottom) < 1.5 || g.top >= g.hdBottom - 1, `.lesson-top sits under the header (${g.top} vs ${g.hdBottom})`);
  check(g.navShown === (w > 960), `lesson list ${w > 960 ? "shown" : "hidden"} at ${w}`);
  check(/^Home › .*Week \d+ › /.test(g.crumbs), `breadcrumbs: ${g.crumbs}`);
  check(Math.abs(g.pagerBottom - g.vh) < 2, "Previous / Next bar sticks to the bottom");
  const why = await page.locator("#nextwhy").innerText();
  check(/^Finish \d+ more tasks? to complete this lesson$/.test(why), `Next reason: "${why}"`);
  check(await page.locator('.pager a[aria-describedby="nextwhy"]').count() === 1, "Next is linked to the reason (aria-describedby)");
  if (w === 390) {
    const r = await page.evaluate(() => [...document.querySelectorAll(".pager .lprev, .pager .btn")].map((n) => Math.round(n.getBoundingClientRect().top + n.getBoundingClientRect().height / 2)));
    check(r.length === 2 ? Math.abs(r[0] - r[1]) < 6 : r.length === 1, `phone: Previous and Next on one row (${r.join(",")})`);
  }
  const pane = page.locator(".lesson-body .tmr-pane").first();
  const dt = await pane.getAttribute("data-term");
  const task = LESSONS[id].blocks.find((b) => b.t === "term" && b.tasks && b.tasks.length).tasks[0];
  for (const c of [].concat(task.sol || []).filter((x) => typeof x === "string")) {
    const inp = page.locator(`.lesson-body .tmr-pane[data-term="${dt}"] .term-input-row input`).first();
    await inp.fill(c); await inp.press("Enter"); await page.waitForTimeout(1500);
  }
  const ticks = await page.evaluate(() => [...document.querySelectorAll(".term-tasks li")].map((li) => li.className === "done"));
  check(ticks[0] === true, `task 1 ticks when "${[].concat(task.sol).filter((x) => typeof x === "string").join(" ; ")}" is typed`);
  const why2 = await page.locator("#nextwhy").innerText();
  check(/more tasks? to complete/.test(why2) || /All tasks done/.test(why2), `Next reason after typing: "${why2}"`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `lesson-${id}-${w}`);
  check(!errors.length, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAIL` : "\nall ok");
process.exit(fails.length ? 1 : 0);
