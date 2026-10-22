// Expert-review checks (docs/redesign/reviews, Prompt 7) on every public page at 1440 and 390 px:
// no sideways scroll, no console errors, one h1 and no skipped heading levels, at most 2 font families outside the
// practice computer, font sizes from the six-token scale, one sign-in state, and lazy images below the fold.
//   node tests/ui-review.mjs                (site on localhost:8080; BASE=… to change)
//   SHOTS=docs/redesign/shots/step7 node tests/ui-review.mjs     REPORT=1 prints every page's details
// The member pages are checked a second time signed in, with the mock Firebase (tests/fixtures/mock-fb.js).
import { chromium } from "@playwright/test";
import { readdirSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const SHOTS = process.env.SHOTS ? path.resolve(root, process.env.SHOTS) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const pages = (process.env.PAGES ? process.env.PAGES.split(",") : readdirSync(path.join(root, "public")).filter((f) => f.endsWith(".html"))).sort();
const course = JSON.parse(readFileSync(path.join(root, "content/course-content.json"), "utf8").replace(/^\uFEFF/, ""));
const LESSON_IN3 = (() => { for (const m of course.modules) for (const l of m.lessons) if (l.id === "IN3") return { ...l, moduleId: m.id }; })();
const MEMBER = ["index.html", "courses.html", "plan.html", "modelling.html", "rviz.html", "robot.html?id=tb3_burger", "playground.html", "course.html", "lesson.html?id=IN3", "test.html?id=testW1", "project.html", "account.html"];
const WIDTHS = [1440, 390];
// noise that is not from the page (as in tests/ui-chrome.mjs): Firebase network messages and the localhost heartbeat
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
// the type scale per checked width (theme.css --fs-*, step A0): xs, sm, base, lg, xl, 2xl, hero; anything else is reported
const SCALE = { 1440: [13, 15, 18, 21, 26, 36, 48], 390: [13, 15, 17, 19, 23, 29, 34] };
// the practice computer, the certificate drawing, the simulator workbench, games and code blocks (15/14px, step A0)
// keep their own type
const OWN_TYPE = ".plab, .cert-sheet, .certmini, #cert-mini, #bench, .term, .tmr, .game, .pg-stage, #anim-stage, .anim, .lp-gz-view, .hg3-hud, .vsc, svg, pre.code";

const browser = await chromium.launch();
const fails = [];
const fail = (m) => { fails.push(m); console.log(`  FAIL ${m}`); };

for (const [w, signedIn] of WIDTHS.flatMap((w) => [[w, false], [w, true]])) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  if (signedIn) await ctx.addInitScript((L) => { window.__MOCK_LESSONS = L; }, { IN3: LESSON_IN3 });
  if (signedIn) await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
  for (const file of signedIn ? MEMBER : pages) {
    const p = await ctx.newPage();
    const errors = [];
    p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(`${BASE}/${file}`, { waitUntil: "load" });
    if (file.startsWith("lesson.html")) await p.waitForSelector(".lesson-body .tmr-pane input", { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const at = new URL(p.url()).pathname.replace(/^\//, "") || "index.html";
    if (at !== file.split("?")[0]) { console.log(`${file} @${w}: redirected to ${at}, checked there`); if (!signedIn) { await p.close(); continue; } }
    const r = await p.evaluate(([OWN, scale]) => {
      const vis = (n) => { const s = getComputedStyle(n); return s.display !== "none" && s.visibility !== "hidden" && n.getClientRects().length; };
      const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => vis(h) && !h.closest(OWN));
      const levels = hs.map((h) => Number(h.tagName[1]));
      const skips = []; let prev = 0;
      levels.forEach((l, i) => { if (prev && l > prev + 1) skips.push(`h${prev}→h${l} "${hs[i].textContent.trim().slice(0, 40)}"`); prev = l; });
      const fams = new Set(), sizes = new Map();
      for (const n of document.querySelectorAll("body *")) {
        if (n.closest(OWN) || !vis(n)) continue;
        const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (!own && !((/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName) && !/^(checkbox|radio)$/.test(n.type)) || (n.tagName === "BUTTON" && n.textContent.trim()))) continue;
        const s = getComputedStyle(n);
        fams.add(s.fontFamily.split(",")[0].replace(/["']/g, "").trim());
        const px = Math.round(parseFloat(s.fontSize) * 100) / 100;
        if (!scale.includes(px)) { const e = sizes.get(px) || [0, `${n.parentElement.className.split(" ")[0] || n.parentElement.tagName.toLowerCase()} > ${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${n.classList[0] ? `.${n.classList[0]}` : ""}`]; e[0]++; sizes.set(px, e); }
      }
      const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, ""));
      const below = [...document.images].filter((i) => i.getBoundingClientRect().top > innerHeight * 1.5 && !i.closest(OWN));
      return {
        overflow: document.documentElement.scrollWidth - innerWidth, h1: levels.filter((l) => l === 1).length, skips, order: levels.join(""),
        fams: [...fams], loadedFams: [...new Set(loaded)], offScale: [...sizes].sort((a, b) => b[1][0] - a[1][0]),
        whoState: (() => { const who = document.getElementById("who"); return who ? (who.querySelector("a[href$='signin.html']") ? "signed-out" : who.querySelector(".acct") ? "signed-in" : "other") : "none"; })(),
        authLinks: [...document.querySelectorAll("main a[href$='signin.html'], main a[href$='register.html'], .mcta a[href$='register.html']")].filter(vis).map((a) => a.textContent.trim()),
        eagerBelow: below.filter((i) => i.loading !== "lazy").map((i) => i.getAttribute("src")),
        noSize: [...document.images].filter((i) => !i.closest(OWN) && (!i.getAttribute("width") || !i.getAttribute("height"))).map((i) => i.getAttribute("src")),
      };
    }, [OWN_TYPE, SCALE[w]]);
    const tag = `${file} @${w}${signedIn ? " signed in" : ""}`;
    if (signedIn && r.whoState !== "signed-in") fail(`${tag}: header is not in the signed-in state (${r.whoState})`);
    if (signedIn && r.authLinks.length) fail(`${tag}: signed in, but the page still offers: ${r.authLinks.join(", ")}`);
    if (!signedIn && r.whoState !== "signed-out") fail(`${tag}: header is not in the signed-out state (${r.whoState})`);
    if (r.overflow > 0) fail(`${tag}: page scrolls sideways by ${r.overflow}px`);
    if (errors.length) fail(`${tag}: console errors: ${errors.slice(0, 3).join(" | ")}`);
    if (r.h1 !== 1) fail(`${tag}: ${r.h1} h1 elements (order ${r.order})`);
    if (r.skips.length) fail(`${tag}: skipped heading levels: ${r.skips.join("; ")}`);
    if (r.fams.length > 2) fail(`${tag}: ${r.fams.length} font families in use: ${r.fams.join(", ")}`);
    if (r.offScale.length) fail(`${tag}: font sizes off the scale: ${r.offScale.map(([s, [n, el]]) => `${s}px×${n} (${el})`).join(", ")}`);
    if (r.eagerBelow.length) fail(`${tag}: images below the fold without loading=lazy: ${r.eagerBelow.join(", ")}`);
    if (r.noSize.length) fail(`${tag}: images without width/height: ${r.noSize.join(", ")}`);
    if (process.env.REPORT) console.log(`${tag}: headings ${r.order} · families ${r.fams.join(", ")} · loaded fonts ${r.loadedFams.join(", ")} · #who ${r.whoState} · log-in/register links in main ${r.authLinks.length}`);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${file.replace(/\.html.*/, "")}-${w}${signedIn ? "-in" : ""}.png`), fullPage: true });
    await p.close();
  }
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
