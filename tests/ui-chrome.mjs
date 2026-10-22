// The shared v3 header and footer on every page, at 1440, 1024 and 390 px (docs/redesign, Prompt 2):
// no sideways scroll, no console errors, nav labels on one line, skip link first, burger menu by keyboard
// (Enter opens, Escape closes and returns focus), the signed-in account menu, and screenshots.
//   node tests/ui-chrome.mjs            (site on localhost:8080; BASE=… to change)
//   SHOTS=docs/redesign/shots/step2 node tests/ui-chrome.mjs
import { chromium } from "@playwright/test";
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const SHOTS = process.env.SHOTS ? path.resolve(root, process.env.SHOTS) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const pages = readdirSync(path.join(root, "public")).filter((f) => f.endsWith(".html")).sort();
const WIDTHS = [1440, 1024, 390];
// noise that is not from the page: Firebase network messages in a headless run, and the visitor heartbeat
// (fb.js → cloudfunctions.net/heartbeat), which the function's CORS rule blocks for localhost (also on fix-v2)
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;

const browser = await chromium.launch();
const fails = [];
const fail = (m) => { fails.push(m); console.log(`  FAIL ${m}`); };

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  for (const file of pages) {
    const p = await ctx.newPage();
    const errors = [];
    p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(`${BASE}/${file}`, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(1200);
    const at = new URL(p.url()).pathname.replace(/^\//, "") || "index.html";
    const tag = `${file}@${w}${at !== file ? ` (→ ${at})` : ""}`;
    const r = await p.evaluate(() => {
      const top = document.querySelector("header.top"), nav = document.getElementById("nav");
      const links = [...document.querySelectorAll("#nav > ul > li > a")].filter((a) => a.offsetParent);
      return {
        sw: document.documentElement.scrollWidth, iw: innerWidth,
        top: !!top, topH: top ? Math.round(top.getBoundingClientRect().height) : 0,
        first: document.body.firstElementChild && document.body.firstElementChild.className,
        main: document.querySelectorAll("main#main").length,
        foot: document.querySelectorAll("footer.site-foot").length,
        fh: document.querySelectorAll("footer.site-foot h2.fh").length,
        wrapped: links.filter((a) => a.getClientRects().length > 1 || a.scrollWidth > a.clientWidth + 1).map((a) => a.textContent),
        navShown: nav ? getComputedStyle(nav).display !== "none" : false,
        login: (() => { const a = document.querySelector("#who a[href$='signin.html']"); if (!a) return null; const b = a.getBoundingClientRect(); return { w: b.width, h: b.height }; })(),
      };
    });
    console.log(`${tag}: header ${r.topH}px, scrollWidth ${r.sw}/${r.iw}${errors.length ? `, ${errors.length} console error(s)` : ""}`);
    if (r.sw > r.iw) fail(`${tag}: horizontal scroll (${r.sw} > ${r.iw})`);
    for (const e of errors) fail(`${tag}: console: ${e.slice(0, 200)}`);
    if (!r.top) fail(`${tag}: no header.top`);
    if (r.first !== "skip") fail(`${tag}: first element is "${r.first}", not the skip link`);
    if (r.main !== 1) fail(`${tag}: ${r.main} main#main`);
    if (r.foot !== 1 || r.fh < 4) fail(`${tag}: footer ${r.foot}, h2.fh ${r.fh}`);
    if (r.topH > 66) fail(`${tag}: header is ${r.topH}px tall (wrapped?)`);
    if (r.wrapped.length) fail(`${tag}: nav labels wrap: ${r.wrapped.join(", ")}`);
    if (r.login && (r.login.w < 44 || r.login.h < 44)) fail(`${tag}: Log in is ${r.login.w}×${r.login.h}`);

    if (SHOTS) {
      await p.evaluate(() => scrollTo(0, 0));
      await p.screenshot({ path: path.join(SHOTS, `${file.replace(".html", "")}-${w}.png`) });
      if (file === "terms.html") await p.locator("footer.site-foot").screenshot({ path: path.join(SHOTS, `footer-${w}.png`) });
    }
    // keyboard: the first Tab lands on the skip link (a page that focuses a form field itself: the skip link is still
    // the first focusable element)
    const autofocus = await p.evaluate(() => document.activeElement !== document.body);
    if (autofocus) {
      if ((await p.evaluate(() => document.querySelector("a[href], button, input, select, textarea, [tabindex]").className)) !== "skip") fail(`${tag}: skip link is not the first focusable element`);
    } else {
      await p.keyboard.press("Tab");
      if ((await p.evaluate(() => document.activeElement.className)) !== "skip") fail(`${tag}: first Tab is not the skip link`);
    }
    if (w <= 960) {
      await p.focus(".top .burger");
      await p.keyboard.press("Enter");
      const open = await p.evaluate(() => ({ open: document.getElementById("nav").classList.contains("open"), exp: document.querySelector(".top .burger").getAttribute("aria-expanded"), focus: document.activeElement.closest("#nav") !== null }));
      if (!open.open || open.exp !== "true" || !open.focus) fail(`${tag}: burger Enter → ${JSON.stringify(open)}`);
      if (SHOTS && ["index.html", "rviz.html"].includes(file)) await p.screenshot({ path: path.join(SHOTS, `${file.replace(".html", "")}-${w}-menu.png`) });
      await p.keyboard.press("Escape");
      const shut = await p.evaluate(() => ({ open: document.getElementById("nav").classList.contains("open"), focusBurger: document.activeElement === document.querySelector(".top .burger") }));
      if (shut.open || !shut.focusBurger) fail(`${tag}: Escape → ${JSON.stringify(shut)}`);
    } else if (!r.navShown) fail(`${tag}: nav hidden at ${w}`);
    await p.close();
  }

  // signed-in header: paint the account menu as common.js / chrome.js do, then open and close it by keyboard
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/playground.html`);
  await p.evaluate(async () => { const m = await import("/js/chrome.js"); m.paintWho({ name: "Riya Sharma", email: "riya@example.com", stage: "approved", admin: false, signOut: () => {} }); });
  await p.focus(".acct-btn");
  await p.keyboard.press("Enter");
  const m = await p.evaluate(() => ({ open: !document.querySelector(".acct-menu").hidden, items: [...document.querySelectorAll(".acct-menu a, .acct-menu button")].map((x) => x.textContent), sw: document.documentElement.scrollWidth, iw: innerWidth }));
  if (!m.open || m.items.join("|") !== "My course|My account|Log out") fail(`signed-in@${w}: menu ${JSON.stringify(m)}`);
  if (m.sw > m.iw) fail(`signed-in@${w}: horizontal scroll`);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `signed-in-${w}.png`) });
  await p.keyboard.press("Escape");
  if (!(await p.evaluate(() => document.querySelector(".acct-menu").hidden && document.activeElement.classList.contains("acct-btn")))) fail(`signed-in@${w}: Escape did not close the menu`);
  for (const e of errors) fail(`signed-in@${w}: ${e}`);
  await ctx.close();
}

// search: "week 4" goes to plan.html#wk4, "simulator" to rviz.html
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/terms.html`);
  for (const [q, want] of [["week 4", "/plan.html#wk4"], ["simulator", "/rviz.html"], ["Verify a certificate", "/certificate.html"]]) {
    await p.fill("#site-q", q);
    await Promise.all([p.waitForURL(`**${want}`, { timeout: 5000 }).catch(() => {}), p.press("#site-q", "Enter")]);
    const u = new URL(p.url());
    if (u.pathname + u.hash !== want) fail(`search "${q}" → ${u.pathname}${u.hash}, want ${want}`);
    await p.goto(`${BASE}/terms.html`);
  }
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} failure(s)` : "\nui-chrome: all checks passed");
process.exit(fails.length ? 1 : 0);
