// courses.html, plan.html and modelling.html (docs/redesign, step 4) at 1440, 1024 and 390 px, signed out and signed in.
// Signed in uses tests/fixtures/mock-fb.js in place of js/fb.js (no test account or emulator exists): one approved
// student with Weeks 1–2 done, two Week 3 lessons done, the Week 1 test passed and the Week 2 test not passed.
// Checks: the #wk anchors open and scroll to their week, the numbers match data/course-plan.json, the left menu and
// the register / progress box move under 960 px, no sideways scroll, no console errors, images load, the header search
// and the home page's course links land on these pages.
//   node tests/ui-courses.mjs            (site on localhost:8080; BASE=… to change)
//   SHOTS=docs/redesign/shots/step4 node tests/ui-courses.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const SHOTS = process.env.SHOTS ? path.resolve(root, process.env.SHOTS) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const PLAN = JSON.parse(readFileSync(path.join(root, "public/data/course-plan.json"), "utf8"));
const CORE = PLAN.modules.filter((m) => m.core), OPT = PLAN.modules.filter((m) => !m.core);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails.push(m); };
const browser = await chromium.launch();

async function open(w, file, { signedIn = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  if (signedIn) await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/${file}`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  if (file.startsWith("plan") || file.startsWith("modelling")) await p.waitForSelector(".wkcard", { timeout: 10000 });
  if (signedIn) await p.waitForFunction(() => document.getElementById("who").dataset.state === "in" && (!document.getElementById("plan-aside") || /Your progress/.test(document.getElementById("plan-aside").textContent)), null, { timeout: 10000 });
  await sleep(300);
  return { p, ctx, errors };
}
async function common(p, errors, label) {
  const r = await p.evaluate(async () => {
    for (const i of document.images) i.loading = "eager";
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, broken: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")) };
  });
  check(r.sw <= r.iw, `${label}: no horizontal scroll (scrollWidth ${r.sw}, innerWidth ${r.iw})`);
  check(!r.broken.length, `${label}: images load${r.broken.length ? `; broken: ${r.broken.join(", ")}` : ""}`);
  check(!errors.length, `${label}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
}
const shot = async (p, name, full = false) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full }); };
// where a week card's top is in the viewport, and whether it is open
const weekPos = (p, id) => p.evaluate((id) => { const d = document.getElementById(id); return d ? { open: d.open, top: Math.round(d.getBoundingClientRect().top), topH: document.querySelector("header.top").offsetHeight } : null; }, id);

for (const w of [1440, 1024, 390]) {
  // ---------- courses.html ----------
  {
    console.log(`courses.html @${w}`);
    const { p, ctx, errors } = await open(w, "courses.html");
    const r = await p.evaluate(() => {
      const cards = [...document.querySelectorAll(".prog2")].map((c) => ({ top: Math.round(c.getBoundingClientRect().top), h: c.querySelector("h2").textContent, links: [...c.querySelectorAll(".pact a")].map((a) => [a.getAttribute("href"), a.textContent]) }));
      const cols = [...document.querySelectorAll(".cmp tr")].map((tr) => [...tr.children].filter((c) => getComputedStyle(c).display !== "none").length);
      return { cards, cols, reg: [...document.querySelectorAll("main [data-reg]")].map((a) => [a.getAttribute("href"), a.textContent]), cur: document.querySelector('#nav a[aria-current="page"]').textContent };
    });
    check(r.cards.length === 2 && r.cards[0].h === "ROS 2 from zero" && r.cards[1].h === "Robot modelling & RViz", "two course cards");
    check(w > 960 ? r.cards[0].top === r.cards[1].top : r.cards[1].top > r.cards[0].top, `cards ${w > 960 ? "side by side" : "stacked"}`);
    check(JSON.stringify(r.cards[0].links) === JSON.stringify([["plan.html", "See the course plan"], ["certificate.html", "Sample certificate"]]) && JSON.stringify(r.cards[1].links) === JSON.stringify([["modelling.html", "See the module plan"]]), "card buttons link to plan.html, certificate.html, modelling.html");
    check(r.cols.every((n) => n === 3), `compare table keeps 3 columns (${r.cols.join(",")})`);
    check(r.reg.length === 1 && r.reg[0][0] === "register.html" && r.reg[0][1] === "Register free", "signed out: Register free");
    check(r.cur === "Courses", "header: Courses is the current page");
    await common(p, errors, "courses");
    await shot(p, `courses-${w}`, true);
    await ctx.close();
  }
  // ---------- plan.html / modelling.html, signed out ----------
  for (const [file, mods, first] of [["plan.html", CORE, 1], ["modelling.html", OPT, 7]]) {
    console.log(`${file} @${w}, signed out`);
    const { p, ctx, errors } = await open(w, file);
    const r = await p.evaluate(() => ({
      ids: [...document.querySelectorAll(".wkcard")].map((d) => d.id), open: [...document.querySelectorAll(".wkcard[open]")].map((d) => d.id),
      lessons: [...document.querySelectorAll(".wkcard li.les")].length,
      bad: [...document.querySelectorAll(".wkcard li.les a")].filter((a) => !/^lesson\.html\?id=[A-Za-z0-9_-]+$/.test(a.getAttribute("href"))).length,
      tests: [...document.querySelectorAll(".wkcard")].map((d) => [...d.querySelectorAll("li.test")].map((t) => t.textContent)),
      lede: document.getElementById("plan-lede").textContent, alert: (document.querySelector(".pagehead .alert") || {}).textContent || "",
      nav: getComputedStyle(document.getElementById("plan-nav")).display,
      asideFirst: document.getElementById("plan-aside").getBoundingClientRect().top < document.getElementById("plan-weeks").getBoundingClientRect().top,
      aside: document.getElementById("plan-aside").textContent, reg: [...document.querySelectorAll("main [data-reg]")].map((a) => a.textContent),
    }));
    check(JSON.stringify(r.ids) === JSON.stringify(mods.map((m) => `wk${m.week}`)), `week cards ${r.ids.join(" ")}`);
    check(r.open.length === 1 && r.open[0] === `wk${first}`, `only Week ${first} open at first (${r.open.join(",")})`);
    const nLessons = mods.reduce((s, m) => s + m.lessons.length, 0);
    const nHours = Math.round(mods.reduce((s, m) => s + m.lessons.reduce((t, l) => t + (l.minutes || 15), 0), 0) / 30) / 2;   // the lessons' own minutes
    check(r.lessons === nLessons && !r.bad, `${r.lessons} lessons (plan data: ${nLessons}), each links to lesson.html?id=…`);
    const wantTests = mods.map((m) => m.tests.map((t) => `${t.title}${t.questions} questions · ${t.minutes} min · ${t.maxAttempts} attempts${m.core ? `${PLAN.rules.passTestPercent}% to pass` : "Does not count"}`));
    check(JSON.stringify(r.tests) === JSON.stringify(wantTests), `each week's test row with its own questions and minutes (${r.tests.map((t) => t.join("").match(/(\d+) questions · (\d+) min/).slice(1).join("/")).join(", ")})`);
    check(file === "plan.html" ? r.lede === `Weeks 1–6 · ${nLessons} lessons (about ${nHours} hours) · 6 weekly tests · 1 project · certificate valid ${PLAN.rules.certValidYears} years` : r.lede === `Optional module · Weeks 7–9 · ${nLessons} lessons (about ${nHours} hours) · 3 optional tests` && /^Not part of the certificate\./.test(r.alert), `lede "${r.lede}"${r.alert ? `, note "${r.alert}"` : ""}`);
    check(w > 960 ? r.nav !== "none" : r.nav === "none", `left Weeks menu ${w > 960 ? "shown" : "hidden"}`);
    check(w < 960 ? r.asideFirst : !r.asideFirst || w <= 1080, `register box ${w < 960 ? "first" : "beside the plan"}`);
    check(/Register free/.test(r.aside) && r.reg.includes("Register free"), "signed out: Register free box");
    await common(p, errors, file);
    await shot(p, `${file.replace(".html", "")}-${w}`);
    if (w > 960) {   // the left menu opens and scrolls to a week
      const id = `wk${first + 2}`;
      await p.click(`#plan-nav a[href="#${id}"]`);
      await sleep(900);
      const pos = await weekPos(p, id);
      check(pos.open && Math.abs(pos.top - pos.topH) < 40, `menu link #${id}: open, top at ${pos.top} px (header ${pos.topH} px)`);
    }
    await ctx.close();
    // the anchor in the address: /plan.html#wk4 opens and scrolls to Week 4
    const id = `wk${first + 1 + (file === "plan.html" ? 2 : 0)}`;
    const a = await open(w, `${file}#${id}`);
    await sleep(300);
    const pos = await weekPos(a.p, id);
    const opened = await a.p.evaluate(() => [...document.querySelectorAll(".wkcard[open]")].map((d) => d.id));
    check(pos && pos.open && Math.abs(pos.top - pos.topH) < 40 && opened.length === 1, `${file}#${id}: open, top at ${pos && pos.top} px (header ${pos && pos.topH} px), open: ${opened.join(",")}`);
    await shot(a.p, `${file.replace(".html", "")}-${id}-${w}`);
    await a.ctx.close();
  }
  // ---------- signed in (mocked Firebase) ----------
  {
    console.log(`plan.html @${w}, signed in (mock)`);
    const { p, ctx, errors } = await open(w, "plan.html", { signedIn: true });
    const r = await p.evaluate(() => {
      const row = (id) => { const a = document.querySelector(`.wkcard a[href="lesson.html?id=${id}"]`); const li = a && a.closest("li"); return li ? [li.className, li.querySelector(".m").textContent] : null; };
      return {
        aside: document.getElementById("plan-aside").innerText, open: [...document.querySelectorAll(".wkcard[open]")].map((d) => d.id),
        current: [...document.querySelectorAll(".wkcard.current")].map((d) => d.id),
        badges: [...document.querySelectorAll(".wkcard summary .badge")].map((b) => b.textContent),
        rows: { A0: row("A0"), IN2: row("IN2"), IN3: row("IN3"), IN4: row("IN4") },
        tests: [...document.querySelectorAll(".wkcard li.test .m")].map((m) => m.textContent),
        nav: [...document.querySelectorAll("#plan-nav a")].map((a) => [a.textContent, a.className, a.getAttribute("aria-current")]),
        cont: (document.querySelector("#plan-aside .btn-main") || {}).textContent, contHref: (document.querySelector("#plan-aside .btn-main") || { getAttribute: () => null }).getAttribute("href"),
        reqOk: [...document.querySelectorAll(".reqs li")].map((li) => li.classList.contains("ok")),
      };
    });
    check(/33 of 95 lessons · 35%/.test(r.aside), "progress: 33 of 95 lessons · 35%");
    check(r.cont === "Continue Week 3" && r.contHref === "lesson.html?id=IN3", `Continue Week 3 → IN3 (${r.cont}, ${r.contHref})`);
    check(JSON.stringify(r.open) === '["wk3"]' && JSON.stringify(r.current) === '["wk3"]', "Week 3 is current and open");
    check(JSON.stringify(r.badges) === JSON.stringify(["✓ Done", "✓ Done", "2 of 11 done", "Not started", "Not started", "Not started"]), `week badges ${r.badges.join(" | ")}`);
    check(r.rows.A0[1] === "Done" && /done/.test(r.rows.A0[0]) && r.rows.IN3[1] === "Next" && /next/.test(r.rows.IN3[0]) && r.rows.IN4[1] === "30 min", `lesson rows: A0 ${r.rows.A0[1]}, IN3 ${r.rows.IN3[1]}, IN4 ${r.rows.IN4[1]}`);
    check(r.tests[0] === "Passed · best 80%" && r.tests[1] === "Best so far 53.3%" && r.tests[2] === "Not taken", `test results ${r.tests.slice(0, 3).join(" | ")}`);
    check(/Finish all lessons\s*33 of 95/.test(r.aside) && /1 of 6 open tests passed/.test(r.aside) && /Opens after the lessons/.test(r.aside) && r.reqOk.every((x) => !x), "certificate requirements: 33 of 95, 1 of 6 tests, project after the lessons");
    check(!/Register free/.test(r.aside), "no Register box when signed in");
    if (w > 960) check(r.nav[0][1] === "done" && r.nav[1][1] === "done" && r.nav[2][2] === "step" && /2\/11/.test(r.nav[2][0]), `menu: ${r.nav.slice(0, 3).map((x) => x.join("/")).join(", ")}`);
    await common(p, errors, "plan signed in");
    await shot(p, `plan-signedin-${w}`);
    await ctx.close();
    for (const file of ["modelling.html", "courses.html"]) {
      const s = await open(w, file, { signedIn: true });
      if (file === "modelling.html") {
        const t = await s.p.evaluate(() => document.getElementById("plan-aside").innerText);
        check(/0 of 22 lessons · 0%/.test(t) && /0 of 3 optional tests passed/.test(t), "modelling signed in: 0 of 22 lessons, 0 of 3 optional tests");
      } else {
        await s.p.waitForFunction(() => document.querySelector("main [data-reg]").textContent !== "Register free", null, { timeout: 5000 }).catch(() => {});
        const a = await s.p.evaluate(() => [document.querySelector("main [data-reg]").getAttribute("href"), document.querySelector("main [data-reg]").textContent]);
        check(a[0] === "course.html" && a[1] === "Continue the course", `courses signed in: ${a.join(" → ")}`);
      }
      await common(s.p, s.errors, `${file} signed in`);
      await shot(s.p, `${file.replace(".html", "")}-signedin-${w}`);
      await s.ctx.close();
    }
  }
}

// ---------- header search suggestions and the home page's course links ----------
{
  console.log("search and home links");
  const { p, ctx, errors } = await open(1440, "index.html");
  const opts = await p.evaluate(() => [...document.querySelectorAll("#site-pages option")].map((o) => o.value));
  const want = ["All courses", ...CORE.concat(OPT).map((m) => `Week ${m.week}:`), "Robot simulator", "Playground", "Practice terminal"];
  check(want.every((x) => opts.some((o) => o.startsWith(x))), `suggestions include ${want.join(", ")}`);
  const src = readFileSync(path.join(root, "public/js/chrome.js"), "utf8");
  for (const m of CORE.concat(OPT)) check(src.includes(`["${m.title}", "${m.core ? "plan" : "modelling"}.html#wk${m.week}"]`), `search: "${m.title}" → ${m.core ? "plan" : "modelling"}.html#wk${m.week}`);
  check(src.includes('["Practice terminal", "index.html#try"]'), "search: Practice terminal → index.html#try");
  await p.fill("#site-q", "week 4");
  await p.press("#site-q", "Enter");
  await p.waitForURL(/plan\.html#wk4$/);
  await p.waitForSelector("#wk4[open]");
  check(true, "typing 'week 4' + Enter lands on plan.html#wk4 with Week 4 open");
  await p.goto(`${BASE}/index.html`);
  const links = await p.evaluate(() => [...new Set([...document.querySelectorAll('main a[href^="plan.html"], main a[href^="modelling.html"], main a[href^="courses.html"]')].map((a) => a.getAttribute("href")))]);
  for (const href of links) {
    await p.goto(`${BASE}/${href}`);
    const id = href.split("#")[1];
    const ok = await p.waitForSelector(id ? `#${id}[open]` : "main h1", { timeout: 8000 }).then(() => true, () => false);
    check(ok, `home link ${href} lands on a working page${id ? ` with #${id} open` : ""}`);
  }
  check(links.length >= 8, `${links.length} course links on the home page`);
  check(!errors.length, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAIL` : "\nall ok");
process.exit(fails.length ? 1 : 0);
