// Every page at 1440, 1024 and 390 (public pages signed out; the Student portal, a lesson and a test with the mock
// Firebase): no sideways scroll, header links on one line (desktop) or behind the burger (under 960px), no console
// errors (the localhost heartbeat is ignored). On the Playground: one game is opened and played a step, and one
// concept animation is opened and its first button pressed. Viewport screenshots with OUT=<dir>.
//   OUT=docs/redesign/shots/step9 node tests/ui-pages.mjs        (site on localhost:8080; BASE=… to change)
import { chromium } from "@playwright/test";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const OUT = process.env.OUT || "";
if (OUT) mkdirSync(OUT, { recursive: true });
const WIDTHS = (process.env.WIDTHS || "1440,1024,390").split(",").map(Number);
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const course = JSON.parse(readFileSync(path.join(root, "content/course-content.json"), "utf8").replace(/^﻿/, ""));
let IN3; for (const m of course.modules) for (const l of m.lessons) if (l.id === "IN3") IN3 = { ...l, moduleId: m.id };
const PUBLIC = readdirSync(path.join(root, "public")).filter((f) => f.endsWith(".html")).sort().map((f) => [f, false]);
const MEMBER = [["course.html", true], ["lesson.html?id=IN3", true], ["test.html?id=testW1", true]];
const fails = [];
const check = (c, m) => { if (!c) { fails.push(m); console.log(`  FAIL ${m}`); } };
const browser = await chromium.launch();

async function open(w, url, mock) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  if (mock) {
    await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
    await ctx.addInitScript((L) => { window.__MOCK_LESSONS = L; }, { IN3 });
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/${url}`, { waitUntil: "load" });
  if (url.startsWith("lesson.html")) await p.waitForSelector(".lesson-body .tmr-pane input", { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  return { ctx, p, errors };
}
const layout = (p) => p.evaluate(() => {
  const links = [...document.querySelectorAll("#nav > ul > li > a")].filter((a) => a.getClientRects().length && getComputedStyle(document.getElementById("nav")).display !== "none");
  const wrapped = links.filter((a) => { const r = document.createRange(); r.selectNodeContents(a); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1; }).map((a) => a.textContent.trim());
  const burger = document.querySelector(".burger");
  return { over: document.documentElement.scrollWidth - innerWidth, rows: new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size, shown: links.length, wrapped,
    burger: !!burger && getComputedStyle(burger).display !== "none" };
});

for (const w of WIDTHS) for (const [file, mock] of [...PUBLIC, ...MEMBER]) {
  const o = await open(w, file, mock);
  const tag = `${file} @${w}${mock ? " (mock)" : ""}`;
  const r = await layout(o.p);
  check(r.over <= 0, `${tag}: page scrolls sideways by ${r.over}px`);
  if (w > 960) check(r.shown === 6 && r.rows === 1 && !r.wrapped.length && !r.burger, `${tag}: header links ${r.shown} on ${r.rows} row(s)${r.wrapped.length ? `, wrapped: ${r.wrapped.join(", ")}` : ""}${r.burger ? ", burger shown" : ""}`);
  else check(r.burger && r.shown === 0, `${tag}: under 960px the links are behind the burger (burger ${r.burger}, links shown ${r.shown})`);
  check(!o.errors.length, `${tag}: console errors: ${o.errors.slice(0, 3).join(" | ")}`);
  if (OUT) await o.p.screenshot({ path: path.join(OUT, `${file.replace(/\.html.*/, "")}-${w}.png`) });
  console.log(`${tag}: overflow ${r.over}, nav ${w > 960 ? `${r.shown} links / ${r.rows} row` : "burger"}, errors ${o.errors.length}`);
  await o.ctx.close();
}

// Playground: play a step of Path Finder (#paths) and open the "Topics" animation (#lab-pubsub)
for (const w of WIDTHS) {
  const o = await open(w, "playground.html#paths");
  await o.p.waitForSelector('.game[data-game="paths"] .game-stage > *', { timeout: 20000 });
  const tile = await o.p.locator('.pg-tile[href="#paths"].on').count();
  const input = o.p.locator('.game[data-game="paths"] input').first();
  let played = false;
  if (await input.count()) { await input.fill("cd ~"); await input.press("Enter"); await o.p.waitForTimeout(600); played = true; }
  else { const btn = o.p.locator('.game[data-game="paths"] .game-stage button:visible').first(); if (await btn.count()) { await btn.click(); played = true; } }
  check(tile === 1 && played, `playground @${w}: Path Finder opened from #paths (tile on: ${tile}) and played a step (${played})`);
  if (OUT) await o.p.screenshot({ path: path.join(OUT, `playground-game-${w}.png`) });
  await o.p.goto(`${BASE}/playground.html#lab-pubsub`);
  await o.p.waitForFunction(() => document.querySelector('#anim-pick a[data-id="pubsub"].on') && document.querySelector("#anim-stage").childElementCount > 0, null, { timeout: 15000 }).catch(() => {});
  const on = await o.p.locator('#anim-pick a[data-id="pubsub"].on').count();
  const btn = o.p.locator("#anim-stage button:visible").first();
  const before = await o.p.locator("#anim-stage").innerText();
  if (await btn.count()) { await btn.click(); await o.p.waitForTimeout(1500); }
  const after = await o.p.locator("#anim-stage").innerText();
  check(on === 1 && (await btn.count()) > 0, `playground @${w}: animation opened from #lab-pubsub (link on: ${on}), button pressed (text changed: ${before !== after})`);
  check(!o.errors.length, `playground game/animation @${w}: console errors: ${o.errors.slice(0, 3).join(" | ")}`);
  if (OUT) await o.p.screenshot({ path: path.join(OUT, `playground-anim-${w}.png`) });
  const r = await layout(o.p);
  check(r.over <= 0, `playground game/animation @${w}: page scrolls sideways by ${r.over}px`);
  await o.ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
