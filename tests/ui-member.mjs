// Step 5b pages in design v3, with the mock Firebase (tests/fixtures/mock-fb.js):
// test.html (intro, a question, the result), project.html (no project yet, a new brief, a marked resubmission),
// account.html, signin.html, register.html, certificate.html (lookup, a genuine certificate, a bad ID), resources,
// terms, privacy, 404 and admin.html, each at 1440, 1024 and 390 px: no sideways scroll, no console errors (the
// localhost heartbeat is ignored), screenshots to docs/redesign/shots/step5b/.
// The test page is also answered with the same answers using fix-v2's own js/test.js: the score and every answer sent
// to the server must be the same (skipped, and said so, when the fix-v2 branch is not in this clone).
//   node tests/ui-member.mjs            (site on localhost:8080; BASE=… to change; ONLY=test,project,… to pick pages)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const SHOTS = path.join(root, "docs/redesign/shots/step5b");
mkdirSync(SHOTS, { recursive: true });
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const fails = [];
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails.push(m); };
const want = (k) => !ONLY.length || ONLY.includes(k);
let oldTest = null;
try { oldTest = execFileSync("git", ["show", "fix-v2:public/js/test.js"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* no fix-v2 */ }

// mock documents (test-only): a project brief made by the server's own generator, and a certificate like the home page sample
const projects = createRequire(import.meta.url)(path.join(root, "functions/projects.js"));
const UID = "mockStudent0000000001", NOW = Date.now(), DAY = 86400000;
const brief = { uid: UID, ...projects.buildProject("ui-member-test-seed"), assignedAt: { __ms: NOW - 5 * DAY }, maxAttempts: 2, passPercent: 80 };
const PROJECT = {
  none: {},
  assigned: { [`projects/${UID}`]: { ...brief, status: "assigned", best: 0, attempts: [] } },
  resubmit: { [`projects/${UID}`]: { ...brief, status: "needs-resubmit", best: 72, attempts: [{ no: 1, language: "python", files: [{ name: "package.xml" }, { name: "setup.py" }],
    submittedAt: { __ms: NOW - 3 * DAY }, status: "graded", score: 72, scores: { works: 28, interfaces: 12, code: 14, launch: 8, report: 10 },
    feedback: "The patrol node works, but the launch file does not load the YAML parameters. Add them and explain the topics in the report." }] } },
};
const CERT_ID = "R2L-2026-MOCK000001";
const CERT = { [`certificates/${CERT_ID}`]: {
  certId: CERT_ID, name: "Test Student", about: "BE, Robotics and Artificial Intelligence, Mock College", registeredAt: { __ms: NOW - 50 * DAY },
  issuedAt: { __ms: NOW - 2 * DAY }, validUntil: { __ms: NOW + 700 * DAY }, course: "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes",
  modules: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"], tests: [[12, 15], [13, 15], [12, 15], [14, 15], [13, 15], [15, 16]].map(([b, m], i) => ({ title: `Week ${i + 1} test`, best: b, max: m, pct: (b / m) * 100 })),
  testAverage: 85, projectTitle: brief.title, projectScore: 88, instructor: "Robotics & ROS 2 Lab", instructorTitle: "Course team, ROS2Lab" } };

const browser = await chromium.launch();
async function open(w, url, { docs, signedOut, admin, testSource } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
  if (testSource) await ctx.route("**/js/test.js", (r) => r.fulfill({ body: testSource, contentType: "text/javascript" }));
  await ctx.addInitScript((o) => { if (o.docs) window.__MOCK_DOCS = o.docs; if (o.signedOut) window.__MOCK_SIGNED_OUT = true; if (o.admin) window.__MOCK_ADMIN = true; }, { docs, signedOut, admin });
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/${url}`, { waitUntil: "load" });
  return { p, ctx, errors };
}
const sw = (p) => p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
async function common(o, name, w) {
  const s = await sw(o.p);
  check(s[0] <= s[1], `${name} @${w}: no horizontal scroll (${s.join("/")})`);
  check(!o.errors.length, `${name} @${w}: no console errors${o.errors.length ? `: ${o.errors.join(" | ")}` : ""}`);
  await o.p.screenshot({ path: path.join(SHOTS, `${name}-${w}.png`), fullPage: true });
}

// Answers the 15 mock questions the same way every run: returns the score shown and the answers sent
async function takeTest(o, w, shoot) {
  const { p } = o;
  await p.waitForSelector("#agree", { timeout: 10000 });
  await p.check("#agree");
  await p.click("button:has-text('Start the test')");
  let expect = 0;
  for (let i = 0; i < 15; i++) {
    await p.waitForFunction((n) => (document.querySelector(".q-top span") || {}).textContent === `Question ${n} of 15`, i + 1, { timeout: 10000 });
    const good = i % 3 !== 2;   // two of every three answered correctly
    if (await p.locator(".opts").count()) await p.locator(".opt").nth(good ? 1 : 0).click();
    else if (await p.locator(".order-list").count()) { if (good) await p.locator(".order-list li").first().locator("button[aria-label='Move down']").click(); }
    else await p.locator(".text-answer input").fill(good ? (await p.locator("pre.code").count() ? "jazzy" : "printenv ROS_DISTRO") : "ros2 doctor");
    expect += good ? 1 : 0;
    if (i === 0 && shoot) {
      const stick = await p.evaluate(() => { const s = document.querySelector(".q-sticky"); return s ? getComputedStyle(s).position : null; });
      if (shoot === "v3") check(stick === "sticky", `test question @${w}: the timer bar is sticky under the header`);
      const s = await sw(p); check(s[0] <= s[1], `test question @${w}: no horizontal scroll (${s.join("/")})`);
      const box = await p.locator(".opt").first().boundingBox();
      if (shoot === "v3") check(box && box.height >= 44, `test question @${w}: answer targets at least 44 px high (${box && Math.round(box.height)})`);
      if (shoot === "v3") await p.screenshot({ path: path.join(SHOTS, `test-question-${w}.png`), fullPage: true });
    }
    await p.locator(".q-actions .btn").first().click();
  }
  await p.waitForFunction(() => /Test submitted/.test(document.querySelector("#main").innerText), null, { timeout: 10000 });
  const text = await p.locator("#main").innerText();
  const m = text.match(/Your score:\s*(\d+) out of (\d+)/);
  const sent = await p.evaluate(() => (window.__mockCalls || []).filter((c) => c.name === "submitAnswer").map((c) => c.data));
  return { score: m ? `${m[1]}/${m[2]}` : null, expect: `${expect}/15`, sent };
}

for (const w of [1440, 1024, 390]) {
  if (want("test")) {
    console.log(`test.html @${w}`);
    const o = await open(w, "test.html?id=testW1");
    await o.p.waitForSelector(".t-facts", { timeout: 10000 });
    const facts = await o.p.locator(".t-facts").innerText();
    check(/Questions\s*15/i.test(facts) && /Time limit\s*35 min/i.test(facts) && /Attempts left\s*2 of 2/i.test(facts) && /Pass mark\s*60%/i.test(facts) && /Score kept\s*Your best/i.test(facts), `test intro @${w}: 15 questions, 35 min, 2 of 2 attempts, 60%, best counts`);
    check(/^week 1$/i.test((await o.p.locator(".t-kicker").innerText()).trim()), `test intro @${w}: Week 1 from the module`);
    await common(o, "test-intro", w);
    const r = await takeTest(o, w, "v3");
    check(r.score === r.expect, `test result @${w}: score ${r.score} (answers were worth ${r.expect})`);
    check(await o.p.locator(".t-result").count() === 1, `test result @${w}: result box`);
    check(!o.errors.length, `test flow @${w}: no console errors${o.errors.length ? `: ${o.errors.join(" | ")}` : ""}`);
    await o.p.screenshot({ path: path.join(SHOTS, `test-result-${w}.png`), fullPage: true });
    if (w === 1440) {
      if (!oldTest) console.log("  SKIP comparison with fix-v2: branch fix-v2 not found");
      else {
        const old = await open(w, "test.html?id=testW1", { testSource: oldTest });
        const ref = await takeTest(old, w, null);
        check(ref.score === r.score, `same score as fix-v2's test.js for the same answers (${r.score} / ${ref.score})`);
        check(JSON.stringify(ref.sent) === JSON.stringify(r.sent) && r.sent.length === 15, `same 15 answers sent to submitAnswer as fix-v2`);
        check(!old.errors.length, "fix-v2 test.js ran without errors too");
        await old.ctx.close();
      }
    }
    await o.ctx.close();
  }
  if (want("project")) {
    for (const [sc, docs] of Object.entries(PROJECT)) {
      console.log(`project.html (${sc}) @${w}`);
      const o = await open(w, "project.html", { docs });
      await o.p.waitForSelector("#main .panel", { timeout: 10000 });
      const t = await o.p.locator("#main").innerText();
      if (sc === "none") check(/Give me my project/.test(t) && /at most 2 times/.test(t) && /at least 80%/.test(t), `project (none) @${w}: assign button, 2 submissions, 80%`);
      else {
        const rows = await o.p.$$eval("table.p-rubric tbody tr", (l) => l.map((r) => r.lastElementChild.textContent));
        check(JSON.stringify(rows) === JSON.stringify(["40", "15", "20", "10", "15"]) && /Total\s*100/.test(await o.p.locator("table.p-rubric tfoot").innerText()), `project (${sc}) @${w}: marking scheme 40/15/20/10/15, total 100`);
        check(/Pass mark\s*80%/i.test(t) && new RegExp(`Submissions\\s*${sc === "assigned" ? 0 : 1} of 2 used`, "i").test(t), `project (${sc}) @${w}: pass mark 80%, submissions used`);
        if (sc === "resubmit") check(/Score: 72 \/ 100/.test(t) && /Feedback: The patrol node works/.test(t) && /Best score\s*72%/i.test(t) && /Submit \(submission 2 of 2\)/.test(t), `project (resubmit) @${w}: marks, feedback, best 72%, submission 2 of 2`);
        else check(/Submit \(submission 1 of 2\)/.test(t), `project (assigned) @${w}: submit form, submission 1 of 2`);
      }
      await common(o, `project-${sc}`, w);
      await o.ctx.close();
    }
  }
  if (want("account")) {
    console.log(`account.html @${w}`);
    const o = await open(w, "account.html");
    await o.p.waitForSelector(".account-grid", { timeout: 10000 });
    await o.p.locator(".danger-zone summary").click();
    await o.p.locator(".danger-zone .btn-danger").click();
    check(await o.p.evaluate(() => { const e = document.querySelector(".danger-zone .notice.err"); return !!e && !e.hidden && e.closest(".form-row") === document.getElementById("del-confirm").closest(".form-row") && document.getElementById("del-confirm").getAttribute("aria-invalid") === "true"; }), `account @${w}: the DELETE error shows under its field`);
    await common(o, "account", w);
    await o.ctx.close();
  }
  if (want("auth")) {
    console.log(`signin.html @${w}`);
    let o = await open(w, "signin.html", { signedOut: true });
    await o.p.waitForSelector("#s-email", { timeout: 10000 });
    check(!/approv/i.test(await o.p.locator("#main").innerText()), `signin @${w}: no approval wording`);
    const h = await o.p.locator("#s-email").boundingBox(); check(h && h.height >= 44, `signin @${w}: inputs 44 px (${h && Math.round(h.height)})`);
    await o.p.locator(".linklike").click();
    check(await o.p.evaluate(() => { const e = document.querySelector(".notice.err"); return !!e && !e.hidden && e.closest(".form-row") === document.getElementById("s-email").closest(".form-row"); }), `signin @${w}: Forgot password without an email: the error shows under the email field`);
    await o.p.keyboard.press("Tab");
    await common(o, "signin", w);
    await o.ctx.close();
    console.log(`register.html @${w}`);
    o = await open(w, "register.html", { signedOut: true });
    await o.p.waitForSelector("#r-name", { timeout: 10000 });
    check(!/approv/i.test(await o.p.locator("#main").innerText()), `register @${w}: no approval wording`);
    await o.p.click("#main button[type=submit]");
    check(await o.p.evaluate(() => { const e = document.querySelector(".notice.err"); const n = document.getElementById("r-name"); return !!e && !e.hidden && e.closest(".form-row") === n.closest(".form-row") && n.getAttribute("aria-invalid") === "true"; }), `register @${w}: empty name: the error shows under the name field`);
    await o.p.fill("#r-name", "Test Student"); await o.p.fill("#r-email", "nope");
    await o.p.click("#main button[type=submit]");
    check(await o.p.evaluate(() => { const e = document.querySelector(".notice.err"); return e.closest(".form-row") === document.getElementById("r-email").closest(".form-row") && !document.getElementById("r-name").hasAttribute("aria-invalid"); }), `register @${w}: bad email: the error moves under the email field`);
    await common(o, "register", w);
    await o.ctx.close();
  }
  if (want("verify")) {
    for (const [sc, url] of [["lookup", "certificate.html"], ["genuine", `certificate.html?id=${CERT_ID}`], ["bad-id", "certificate.html?id=NOPE"]]) {
      console.log(`certificate.html (${sc}) @${w}`);
      const o = await open(w, url, { docs: CERT });
      await o.p.waitForSelector("#cid", { timeout: 10000 });
      const t = await o.p.locator("#main").innerText();
      check(/Verify a certificate/.test(t), `verify (${sc}) @${w}: page head with the ID field`);
      if (sc === "genuine") {
        await o.p.waitForSelector(".r2c", { timeout: 10000 });
        const btns = await o.p.$$eval("#actions .btn", (l) => l.map((b) => b.textContent));
        check(JSON.stringify(btns) === JSON.stringify(["Download PDF", "Add to LinkedIn", "Copy link"]) && /Genuine and valid\. Issued by ROS2Lab to Test Student/.test(t), `verify (genuine) @${w}: status box, Download PDF / Add to LinkedIn / Copy link`);
        check(await o.p.evaluate(() => /^https:\/\/www\.linkedin\.com\/profile\/add\?startTask=CERTIFICATION_NAME/.test(document.querySelector("#actions a").href)), `verify (genuine) @${w}: LinkedIn link unchanged`);
      }
      if (sc === "bad-id") check(/This does not look like a ROS2Lab certificate ID\./.test(t), `verify (bad-id) @${w}: same message as before`);
      await common(o, `verify-${sc}`, w);
      await o.ctx.close();
    }
  }
  if (want("docs")) {
    for (const f of ["resources", "terms", "privacy", "404"]) {
      console.log(`${f}.html @${w}`);
      const o = await open(w, `${f}.html`);
      await o.p.waitForSelector("main.v3doc h1", { timeout: 10000 });
      const col = await o.p.evaluate(() => Math.round(document.querySelector("main.v3doc p:not(.muted)")?.getBoundingClientRect().width || 0));
      check(col <= 722, `${f} @${w}: text column at most 720 px (${col})`);
      await common(o, f, w);
      await o.ctx.close();
    }
  }
  if (want("admin")) {
    console.log(`admin.html @${w}`);
    const o = await open(w, "admin.html", { admin: true });
    await o.p.waitForSelector(".v3admin .tabs button", { timeout: 10000 });
    await o.p.waitForTimeout(800);
    await common(o, "admin", w);
    await o.ctx.close();
  }
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall passed");
process.exit(fails.length ? 1 : 0);
