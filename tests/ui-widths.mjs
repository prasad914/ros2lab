// Desktop layout (docs/redesign, step 7a): the site uses the screen on laptops and desktops and stays as it was on
// phones. At each width, on the public pages and the member pages (mock Firebase, tests/fixtures/mock-fb.js):
// no sideways scroll, no console errors (the localhost heartbeat is ignored), the main container is at least
// 1360px wide at 1920 (1600px on the wide pages; sign-in, registration and the test keep a form-sized card), and from
// 1024px no line of running text is longer than about 90 characters (--read-max 70ch since step A; 82 before).
//   node tests/ui-widths.mjs                       (site on localhost:8080; BASE=… to change)
//   SHOTS=docs/redesign/shots/step7a/after PAGES=index.html,… WIDTHS=1280,1440 node tests/ui-widths.mjs
//   MEASURE=1 only prints the container and text widths (no pass/fail), e.g. for a before/after table
import { chromium } from "@playwright/test";
import { readdirSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const SHOTS = process.env.SHOTS ? path.resolve(root, process.env.SHOTS) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const MEASURE = !!process.env.MEASURE;
const WIDTHS = (process.env.WIDTHS || "390,768,1024,1280,1440,1920,2560").split(",").map(Number);
const PUBLIC = readdirSync(path.join(root, "public")).filter((f) => f.endsWith(".html")).sort();
const MEMBER = ["course.html", "lesson.html?id=IN3", "test.html?id=testW1", "project.html", "account.html", "admin.html"];
const PAGES = process.env.PAGES ? process.env.PAGES.split(",") : [...PUBLIC.map((f) => [f, false]), ...MEMBER.map((f) => [f, true])].map(([f, m]) => (m ? `${f}#mock` : f));
const WIDE = /^(rviz|course|admin)\.html/;
const FORM = /^(signin|register|test)\.html/;   // form pages keep a form-sized card: sign-in, registration, the test
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const course = JSON.parse(readFileSync(path.join(root, "content/course-content.json"), "utf8").replace(/^﻿/, ""));
const LESSON_IN3 = (() => { for (const m of course.modules) for (const l of m.lessons) if (l.id === "IN3") return { ...l, moduleId: m.id }; })();

const browser = await chromium.launch();
const fails = [];
const fail = (m) => { fails.push(m); console.log(`  FAIL ${m}`); };
for (const w of WIDTHS) {
  for (const mockMode of [false, true]) {
    const list = PAGES.filter((p) => p.endsWith("#mock") === mockMode);   // "course.html#mock": signed in with the mock
    if (!list.length) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: w >= 1024 ? 900 : w > 600 ? 1024 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    if (mockMode) {
      await ctx.addInitScript((L) => { window.__MOCK_LESSONS = L; if (location.pathname.endsWith("/admin.html")) window.__MOCK_ADMIN = true; }, { IN3: LESSON_IN3 });
      await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
    }
    for (const entry of list) {
      const file = entry.replace(/#mock$/, "");
      const p = await ctx.newPage();
      const errors = [];
      p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
      p.on("pageerror", (e) => errors.push(String(e)));
      await p.goto(`${BASE}/${file}`, { waitUntil: "load" });
      if (file.startsWith("lesson.html")) await p.waitForSelector(".lesson-body .tmr-pane input", { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(1500);
      const r = await p.evaluate(() => {
        const vis = (n) => { const s = getComputedStyle(n); return s.display !== "none" && s.visibility !== "hidden" && n.getClientRects().length; };
        // the main container: the widest visible .wrap (or the main column) inside <main>
        const boxes = [...document.querySelectorAll("main .wrap, main.wrap, main .narrow, main .layout")].filter((n) => vis(n) && !n.querySelector(".wrap")).map((n) => {
          const s = getComputedStyle(n), b = n.getBoundingClientRect();
          return b.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
        });
        const container = boxes.length ? Math.round(Math.max(...boxes)) : null;
        // running text: paragraphs and list items of 200+ characters outside terminals, code, tables and card grids;
        // the characters on each rendered line are counted with a Range per character
        let longest = 0, where = "";
        for (const n of document.querySelectorAll("main p, main li, main dd")) {
          if (!vis(n) || n.textContent.trim().length < 200 || n.closest("pre, table, .term, .tmr, .plab, nav, .cat-grid, .pgrid")) continue;
          const perLine = new Map(), w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), r = document.createRange();
          for (let t = w.nextNode(); t; t = w.nextNode()) for (let i = 0; i < t.length; i++) {
            r.setStart(t, i); r.setEnd(t, i + 1); const q = r.getClientRects()[0]; if (!q) continue;
            const k = Math.round(q.bottom); perLine.set(k, (perLine.get(k) || 0) + 1);
          }
          const m = Math.max(0, ...perLine.values());
          if (m > longest) { longest = m; where = `${n.tagName.toLowerCase()}.${n.className || ""} "${n.textContent.trim().slice(0, 30)}"`; }
        }
        return { overflow: document.documentElement.scrollWidth - innerWidth, container, longest: Math.round(longest), where, at: location.pathname };
      });
      const tag = `${file} @${w}${mockMode ? " (mock)" : ""}`;
      if (MEASURE) console.log(`${tag}: container ${r.container}px · longest text line ~${r.longest} ch (${r.where})${r.at !== "/" + file.split("?")[0] ? ` · (at ${r.at})` : ""}`);
      else {
        if (r.overflow > 0) fail(`${tag}: page scrolls sideways by ${r.overflow}px`);
        if (errors.length) fail(`${tag}: console errors: ${errors.slice(0, 3).join(" | ")}`);
        const need = WIDE.test(file) ? 1600 : 1360;
        // form pages keep a form-sized card: sign-in, registration and the test (one question at a time)
        if (w === 1920 && r.at === "/" + file.split("?")[0] && !FORM.test(r.at.slice(1)) && r.container != null && r.container < need) fail(`${tag}: main container ${r.container}px, needs ${need}px`);
        // from 1024px (phones and tablets keep their earlier layout, step 7a rule 7)
        if (w >= 1024 && r.longest > 90) fail(`${tag}: running text line ~${r.longest} characters (${r.where})`);
      }
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${file.replace(/\.html.*/, "")}${file.includes("id=") ? "-" + file.split("id=")[1] : ""}-${w}.png`), fullPage: true });
      await p.close();
    }
    await ctx.close();
  }
}
await browser.close();
if (!MEASURE) { console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed"); process.exit(fails.length ? 1 : 0); }
