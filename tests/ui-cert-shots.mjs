// Step 8 screenshots (viewport only): home (top and the sample certificate), courses, certificate.html with no id,
// a wrong id and the sample (a mock certificate document with the home page sample's data, mock Firebase), at 1440 and
// 390, plus the print preview of the sample (A4 landscape, print media) as a PNG and a PDF. Also checks the seal and
// statement text, no sideways scroll and no console errors.
//   OUT=docs/redesign/shots/step8 node tests/ui-cert-shots.mjs      (site on localhost:8080; BASE=… to change)
import { chromium } from "@playwright/test";
import { tmpdir } from "node:os";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const OUT = process.env.OUT || path.join(tmpdir(), "ros2lab-shots");
mkdirSync(OUT, { recursive: true });
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const fails = [];
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails.push(m); };
const NOW = Date.now(), DAY = 86400000, ID = "R2L-2026-SAMPLE0001";
// the sample from js/index.js (signature left out: the mock document is only for the screenshots)
const SAMPLE = { [`certificates/${ID}`]: {
  certId: ID, name: "Your Name Here", about: "Your programme, department and college, or your designation and workplace",
  registeredAt: { __ms: NOW - 45 * DAY }, issuedAt: { __ms: NOW }, validUntil: { __ms: NOW + 730 * DAY }, course: "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes",
  modules: ["Week 1: Talk to the robot's computer", "Week 2: Build the robot's brain", "Week 3: Introduction to ROS", "Week 4: Speak ROS 2", "Week 5: ROS programming fundamentals", "Week 6: Writing your own ROS 2 nodes"],
  tests: [[16, 20], [13, 16], [12, 15], [14, 18], [13, 16], [15, 16]].map(([b, m], i) => ({ title: `Week ${i + 1} test`, best: b, max: m, pct: (b / m) * 100 })),
  testAverage: 82, projectTitle: "Your personal capstone project", projectScore: 88, instructor: "Robotics & ROS 2 Lab", instructorTitle: "Course team, ROS2Lab" } };
const SEAL = "ROBOTICS & ROS 2 LAB • ROS2LAB • ROS 2 JAZZY •";
const STMT = /offered by ROS2Lab from the Robotics & ROS 2 Lab YouTube channel, having passed every weekly test and an individually assigned capstone project\./;

const browser = await chromium.launch();
async function open(w, url, docs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
  await ctx.addInitScript((d) => { window.__MOCK_SIGNED_OUT = true; if (d) window.__MOCK_DOCS = d; }, docs || null);
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/${url}`, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  return { p, ctx, errors };
}
async function done(o, name, w) {
  const s = await o.p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(s[0] <= s[1], `${name} @${w}: no horizontal scroll (${s.join("/")})`);
  check(!o.errors.length, `${name} @${w}: no console errors${o.errors.length ? `: ${o.errors.join(" | ")}` : ""}`);
  await o.p.screenshot({ path: path.join(OUT, `${name}-${w}.png`) });
  await o.ctx.close();
}
const certText = (p) => p.evaluate(() => { const c = document.querySelector(".r2c, .cert-sheet, [class^=r2c]"); const root = c ? c.closest("section, main, div") : document.body; return [root.innerText, [...document.querySelectorAll(".r2c-seal textPath")].map((t) => t.textContent)]; });

for (const w of [1440, 390]) {
  let o = await open(w, "index.html");
  await done(o, "home", w);
  o = await open(w, "index.html");
  await o.p.locator("#cert-mini").scrollIntoViewIfNeeded();
  await o.p.waitForSelector("#cert-mini .r2c-seal", { timeout: 20000 }).catch(() => {});
  await o.p.waitForTimeout(1500);
  const [t, seal] = await certText(o.p);
  check(seal.includes(SEAL) && STMT.test(t) && /Robotics & ROS 2 Lab/.test(t) && /Course team, ROS2Lab/.test(t), `home sample @${w}: seal, statement and signer`);
  await done(o, "home-sample", w);
  o = await open(w, "courses.html");
  await done(o, "courses", w);
  o = await open(w, "certificate.html");
  await done(o, "verify-none", w);
  o = await open(w, "certificate.html?id=NOPE");
  check(/This does not look like a ROS2Lab certificate ID\./.test(await o.p.innerText("main")), `verify wrong id @${w}: message unchanged`);
  await done(o, "verify-wrong-id", w);
  o = await open(w, `certificate.html?id=${ID}`, SAMPLE);
  await o.p.waitForSelector(".r2c-seal", { timeout: 20000 }).catch(() => {});
  await o.p.waitForTimeout(1000);
  const [t2, seal2] = await certText(o.p);
  check(seal2.includes(SEAL) && STMT.test(t2), `verify sample @${w}: seal and statement`);
  await done(o, "verify-sample", w);
}
// print preview: A4 landscape (297 × 210 mm ≈ 1123 × 794 CSS px), print media
{
  const o = await open(1123, `certificate.html?id=${ID}`, SAMPLE);
  await o.p.setViewportSize({ width: 1123, height: 794 });
  await o.p.waitForSelector(".r2c-seal", { timeout: 20000 }).catch(() => {});
  await o.p.emulateMedia({ media: "print" });
  await o.p.waitForTimeout(800);
  await o.p.screenshot({ path: path.join(OUT, "print-a4-landscape.png") });
  await o.p.pdf({ path: path.join(OUT, "print-a4-landscape.pdf"), format: "A4", landscape: true, printBackground: true, preferCSSPageSize: true });
  check(!o.errors.length, `print preview: no console errors${o.errors.length ? `: ${o.errors.join(" | ")}` : ""}`);
  await o.ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
