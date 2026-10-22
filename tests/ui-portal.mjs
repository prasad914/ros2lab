// course.html (the Student portal) with the mock Firebase (tests/fixtures/mock-fb.js), after the course-data.js refactor.
// 1. It renders: header numbers, the four tabs, lesson rows, test rows, certificate steps, no console errors.
// 2. It behaves as on fix-v2: the same page is loaded with fix-v2's own js/course.js (its inline loader) and the text of
//    every tab must be identical (skipped, and said so, when the fix-v2 branch is not in this clone).
//   node tests/ui-portal.mjs            (site on localhost:8080; BASE=… to change)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const fails = [];
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails.push(m); };
let old = null;
try { old = execFileSync("git", ["show", "fix-v2:public/js/course.js"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* no fix-v2 */ }
const browser = await chromium.launch();

async function load(w, source, scenario) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
  if (scenario) await ctx.addInitScript((sc) => { window.__MOCK_SCENARIO = sc; }, scenario);
  if (source) await ctx.route("**/js/course.js", (r) => r.fulfill({ body: source, contentType: "text/javascript" }));
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/course.html`, { waitUntil: "load" });
  await p.waitForSelector(".dash-tabs button", { timeout: 10000 });
  // The layout was redone in v3, so what is compared with fix-v2 is the data, not the page text: the stat cards, the next
  // lesson, the milestones and access card, every lesson title and its Done state, and the Tests and Project tabs word for word.
  const norm = (t) => t.replace(/\s+/g, " ").replace(/\d{1,2}:\d{2} [ap]m/g, "hh:mm").trim().toLowerCase();   // lower case: v3 headings are upper-cased by CSS; the clock time can roll over between two loads
  const tabs = {};
  for (const t of ["overview", "lessons", "tests", "certificate"]) {
    await p.click(`#tab-${t}`);
    tabs[t] = norm(await p.locator("#tabpanel").innerText());
    if (t === "overview") {
      tabs.milestones = norm(await p.locator("#tabpanel .timeline").innerText());
      tabs.access = norm(await p.locator("#tabpanel .access-card").innerText());
      tabs.next = await p.evaluate(() => document.querySelector(".welcome .btn, .next-step .btn").getAttribute("href"));
    }
    if (t === "lessons") {
      tabs.lessonTitles = await p.locator("#tabpanel").evaluate((n) => [...n.querySelectorAll(".lesson-row .t, .wkcard li.les > span > a")].map((x) => x.textContent.trim()));
      tabs.lessonDone = await p.locator("#tabpanel").evaluate((n) => n.querySelectorAll(".lesson-row.is-done, .wkcard li.les.done").length);
      tabs.lessonNext = await p.locator("#tabpanel").evaluate((n) => (n.querySelector(".lesson-row.is-next, .wkcard li.les.next a") || n.querySelector(".wkcard li.les.next")).textContent.trim().slice(0, 40));
    }
  }
  tabs.stats = norm(await p.locator(".stats").innerText().catch(() => ""));
  tabs.hello = await p.locator("h1").first().innerText();
  tabs.top = `${tabs.hello} ${tabs.stats}`;

  tabs.sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  return { p, ctx, errors, tabs };
}

for (const w of [1440, 390]) {
  console.log(`course.html @${w} (mock)`);
  const cur = await load(w);
  const t = cur.tabs;
  check(/hello, test/i.test(t.top) && /33\/95\s*lessons done/i.test(t.top) && /1\/6\s*tests passed/i.test(t.top) && /40\s*days left/i.test(t.top), "header and stat cards: 33/95 lessons, 1/6 tests, 40 days left");
  check(t.next === "lesson.html?id=IN3", `Continue → ${t.next}`);
  check(/Continue where you left off Week 3, Day \d+: The parts of ROS/i.test(t.overview) && /Milestones/i.test(t.overview), "overview: next lesson IN3 with week and day, milestones");
  check(/week 7 describe a robot with urdf/i.test(t.lessons) && /week 9/i.test(t.lessons) && /2 of 11 done/i.test(t.lessons) && t.lessonDone === 33 && t.lessonNext.startsWith("The parts of ROS"), "lessons tab: all 9 weeks, 2 of 11 in Week 3, 33 lessons Done, IN3 is Next");
  check(/Week 1 test[\s\S]*Passed[\s\S]*12\/15[\s\S]*80%/i.test(t.tests) && /Week 2 test[\s\S]*Not taken[\s\S]*8\/15[\s\S]*53\.3%/i.test(t.tests) && /1 of 6 passed/i.test(t.tests), "tests tab: Week 1 passed 12/15 80%, Week 2 below 60% (8/15, 53.3%)");
  check(/Your path to the certificate/i.test(t.certificate) && /33 of 95 lessons done/i.test(t.certificate) && /Opens when you finish all lessons/i.test(t.certificate), "certificate tab: 33 of 95, project locked until the lessons are done");
  check(t.sw[0] <= t.sw[1], `no horizontal scroll (${t.sw.join("/")})`);
  check(!cur.errors.length, `no console errors${cur.errors.length ? `: ${cur.errors.join(" | ")}` : ""}`);
  if (w === 1440) {
    if (!old) console.log("  SKIP comparison with fix-v2: branch fix-v2 not found");
    else {
      const ref = await load(w, old);
      for (const k of ["top", "next", "milestones", "access", "lessonTitles", "lessonDone", "tests", "certificate"]) check(JSON.stringify(t[k]) === JSON.stringify(ref.tabs[k]), `same as fix-v2: ${k}`);
      check(!ref.errors.length, "fix-v2 copy ran without errors too");
      await ref.ctx.close();
    }
  }
  await cur.ctx.close();
}
// the same comparison for other students: every tab, with a project, attempts, an application, a certificate, lifetime access
const SCENARIOS = ["fresh", "all-done", "tests-failed", "optional-started", "project-assigned", "project-submitted", "project-resubmit", "applied", "certified", "lifetime", "low-days"];
if (old) {
  console.log("course.html: fix-v2 vs now, other students (mock scenarios)");
  for (const sc of SCENARIOS) {
    const [cur, ref] = [await load(1280, null, sc), await load(1280, old, sc)];
    const DATA = ["top", "next", "milestones", "access", "lessonTitles", "lessonDone", "tests", "certificate"];
    const diff = DATA.filter((k) => JSON.stringify(cur.tabs[k]) !== JSON.stringify(ref.tabs[k]));
    check(!diff.length && !cur.errors.length && !ref.errors.length, `${sc}: same data as fix-v2 (${DATA.join(", ")})${diff.length ? `; DIFFERS: ${diff.join(", ")}` : ""}${cur.errors.length + ref.errors.length ? `; errors: ${[...cur.errors, ...ref.errors].join(" | ")}` : ""}`);
    if (sc === "certified") check(/Certificate earned/i.test(cur.tabs.certificate) && /Lifetime access/i.test(cur.tabs.top), "certified: certificate earned, lifetime access shown");
    if (sc === "project-resubmit") check(/Scored 72%/i.test(cur.tabs.certificate), "project-resubmit: shows 72%");
    if (sc === "applied") check(/Applied\./i.test(cur.tabs.certificate), "applied: waiting for signature");
    if (sc === "low-days") check(/3\s*days left/.test(cur.tabs.top), "low-days: 3 days left");
    await cur.ctx.close(); await ref.ctx.close();
  }
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAIL` : "\nall ok");
process.exit(fails.length ? 1 : 0);
