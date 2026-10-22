// Step 10: home page at 1440 and 390: the Why ROS2Lab section has six cards whose images load (loading="lazy",
// width/height set) and its counts come from robots/index.json, games/registry.js and anims/registry.js; no sideways
// scroll, no console errors. Viewport screenshots of the main home sections.
//   node tests/ui-why.mjs docs/redesign/shots/step10      (site on localhost:8080)
import { chromium } from "@playwright/test";
import { tmpdir } from "node:os";
import { mkdirSync } from "node:fs";
import path from "node:path";
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const out = process.argv[2] || path.join(tmpdir(), "ros2lab-shots"); mkdirSync(out, { recursive: true }); const b = await chromium.launch(); let bad = 0;
for (const w of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const p = await ctx.newPage(); const errs = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errs.push(m.text()); }); p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("http://localhost:8080/index.html"); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/home-top-${w}.png` });
  const shots = [["why", "#why"], ["try", "#try"], ["join", ".joinlist"], ["gazebo", "#gazebo-live"], ["faq", "#faq"]];
  for (const [n, s] of shots) { await p.locator(s).first().evaluate((e) => e.scrollIntoView({ block: "start" })); await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/home-${n}-${w}.png` }); }
  await p.locator("#why").evaluate((e) => e.scrollIntoView()); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const imgs = [...document.querySelectorAll("#why .whyc img")];
    const lazy = imgs.every((i) => i.getAttribute("loading") === "lazy");
    for (const i of imgs) { i.loading = "eager";   // load every image now (read "lazy" above first)
      if (!i.complete) await new Promise((r) => { i.onload = i.onerror = r; }); }
    return { cards: document.querySelectorAll("#why .whyc").length, imgs: imgs.map((i) => [i.getAttribute("src"), i.getAttribute("width"), i.getAttribute("height"), i.naturalWidth > 0]),
      lazy, robots: document.getElementById("n-robots").textContent, play: document.getElementById("n-play").textContent, over: document.documentElement.scrollWidth - innerWidth };
  });
  console.log(w, JSON.stringify(r), "errors", errs);
  if (r.cards !== 6 || !r.lazy || r.imgs.some((x) => !x[3] || !x[1] || !x[2]) || r.over > 0 || errs.length) bad++;
  await ctx.close();
}
await b.close(); console.log(bad ? "FAILED" : "all passed"); process.exit(bad ? 1 : 0);
