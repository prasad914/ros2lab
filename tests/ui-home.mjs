// The v3 home page (docs/redesign, Prompt 3) at 1440, 1024 and 390 px: the practice computer's demo runs, then the
// commands a student types work (typed into a new Terminator pane, like a student, without the debug handle);
// no sideways scroll, no console errors, every image loads, window.__lab only with ?debug=1, and screenshots.
//   node tests/ui-home.mjs            (site on localhost:8080; BASE=… to change)
//   SHOTS=docs/redesign/shots/step3 node tests/ui-home.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const SHOTS = process.env.SHOTS ? path.resolve(root, process.env.SHOTS) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
// noise that is not from the page (as in tests/ui-chrome.mjs): Firebase in a headless run and the visitor heartbeat,
// which the function's CORS rule blocks for localhost
const IGNORE = /firestore|firebase|googleapis|gstatic|recaptcha|ERR_INTERNET|net::ERR|Failed to load resource|cloudfunctions\.net\/heartbeat/i;
const COMMANDS = [
  ["ros2 node list", (o) => /^\/teleop_turtle$/m.test(o) && /^\/turtlesim$/m.test(o)],
  ["ros2 topic list -t", (o) => o.includes("/turtle1/cmd_vel [geometry_msgs/msg/Twist]") && o.includes("/turtle1/pose [turtlesim/msg/Pose]")],
  ["printenv | grep ROS", (o) => /ROS_DISTRO=jazzy/.test(o) && /ROS_VERSION=2/.test(o)],
  ["ros2 param get /turtlesim background_r", (o) => /Integer value is: 69/.test(o)],
  ["ros2 topic echo /turtle1/pose --once", (o) => /^x: [\d.]+$/m.test(o) && /^theta: /m.test(o) && /^---$/m.test(o)],
  ["ros2 service call /spawn turtlesim/srv/Spawn \"{x: 2, y: 2, theta: 0.2, name: ''}\"", (o) => o.includes("turtlesim.srv.Spawn_Response(name='turtle2')")],
  ["rqt_graph", null],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails.push(m); };

for (const w of [1440, 1024, 390]) {
  console.log(`index.html @${w}`);
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  check(await p.evaluate(() => typeof window.__lab === "undefined"), "no window.__lab without ?debug=1");
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `home-top-${w}.png`) });

  // the practice computer: the demo starts when it scrolls into view
  await p.evaluate((block) => document.getElementById("desk").scrollIntoView({ block }), w > 600 ? "center" : "start");
  await sleep(16000);
  const demo = await p.evaluate(() => ({
    sim: !document.getElementById("w-sim").hidden, panes: document.querySelectorAll("#lab .tpane").length,
    teleop: !document.getElementById("pad").hidden, text: document.getElementById("lab").textContent,
  }));
  check(demo.sim && demo.panes === 2 && demo.teleop && demo.text.includes("Reading from keyboard"), `demo after 16 s: turtlesim open, 2 terminals, teleop running (${JSON.stringify({ ...demo, text: undefined })})`);

  // a new terminal, then the commands, typed
  await p.click("#split-v");
  await sleep(400);
  for (const [cmd, ok] of COMMANDS) {
    const before = await p.evaluate(() => document.querySelector("#lab .tpane.focus .tout").textContent.length);
    await p.keyboard.type(cmd, { delay: 5 });
    await p.keyboard.press("Enter");
    await sleep(cmd.startsWith("ros2 service call") ? 1500 : 900);
    const out = await p.evaluate((n) => document.querySelector("#lab .tpane.focus .tout").textContent.slice(n), before);
    const body = out.split("\n").slice(1).join("\n");   // the first line is the prompt and the command
    if (ok) check(ok(body), `${cmd}\n${body.replace(/^/gm, "         | ").replace(/\s+$/, "")}`);
    else {
      const rqt = await p.evaluate(() => ({ open: !document.getElementById("w-rqt").hidden, nodes: [...document.querySelectorAll("#rqt-svg text")].map((t) => t.textContent) }));
      check(rqt.open && rqt.nodes.includes("/turtlesim") && rqt.nodes.includes("/turtle1/cmd_vel"), `${cmd}: window open, graph ${rqt.nodes.join(", ")}`);
    }
  }
  if (SHOTS) await p.locator("#lab").screenshot({ path: path.join(SHOTS, `home-lab-${w}.png`) });

  // scroll through the page so every lazy image loads, then check them
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 600) { await p.evaluate((y) => scrollTo(0, y), y); await sleep(120); }
  await sleep(2500);
  const r = await p.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    broken: [...document.images].filter((i) => !i.closest(".r2c") && (!i.complete || !i.naturalWidth)).map((i) => i.getAttribute("src")),
    imgs: document.images.length, lazyNoSize: [...document.querySelectorAll("main img[loading=lazy]")].filter((i) => !i.getAttribute("width") || !i.getAttribute("height")).map((i) => i.getAttribute("src")),
    cert: !!document.querySelector("#cert-mini .r2c"), faq: !!document.getElementById("faq"),
    mcta: (() => { const m = document.querySelector(".mcta"); return m ? getComputedStyle(m).display : null; })(),
    heroimg: getComputedStyle(document.querySelector(".heroimg")).display,
    counts: [document.querySelector("#why .whyc:nth-child(3) h3").textContent, document.getElementById("n-play").textContent],
  }));
  check(r.sw <= r.iw, `no horizontal scroll (scrollWidth ${r.sw}, innerWidth ${r.iw})`);
  check(!r.broken.length, `${r.imgs} images load${r.broken.length ? `; broken: ${r.broken.join(", ")}` : ""}`);
  check(!r.lazyNoSize.length, `lazy images have width and height${r.lazyNoSize.length ? `: ${r.lazyNoSize.join(", ")}` : ""}`);
  check(r.cert, "sample certificate drawn by cert-render.js");
  check(r.faq, "#faq anchor (the header's Help link) exists");
  check(w <= 640 ? r.mcta === "flex" : r.mcta === "none", `sticky Register bar ${w <= 640 ? "shown" : "hidden"} (${r.mcta})`);
  check(w < 960 ? r.heroimg === "none" : r.heroimg !== "none", `hero image ${w < 960 ? "hidden" : "shown"}`);
  check(/^\d+ robots to explore$/.test(r.counts[0]) && /^\d+ short games with badges and \d+ animations/.test(r.counts[1]), `counts from the data: "${r.counts[0]}", "${r.counts[1]}"`);
  check(!errors.length, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  // one screenshot per section (a full-page capture of a page this tall wraps around in Chromium)
  if (SHOTS) {
    const parts = p.locator("main#main > section, main#main > .facts-strip, footer.site-foot");
    for (let i = 0, n = await parts.count(); i < n; i++) {
      const id = (await parts.nth(i).getAttribute("id")) || (await parts.nth(i).getAttribute("class")).split(" ").pop();
      await parts.nth(i).screenshot({ path: path.join(SHOTS, `home-${w}-${String(i + 1).padStart(2, "0")}-${id}.png`) });
    }
  }
  await ctx.close();
}

// the debug handle, only with ?debug=1
{
  const p = await browser.newPage();
  await p.goto(`${BASE}/index.html?debug=1`, { waitUntil: "load" });
  check(await p.evaluate(() => typeof window.__lab === "object" && typeof window.__lab.run === "function"), "window.__lab with ?debug=1");
  await p.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAIL` : "\nall ok");
process.exit(fails.length ? 1 : 0);
