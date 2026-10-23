// Robot simulator catalogue (rviz.html) and robot info page (robot.html) at 1440, 1024 and 390 px: every tab, the filter
// ("lidar", "ur5e"), five robot info pages and their "Open in the simulator" links (they load), the unknown-id page,
// no sideways scroll, no console errors (the localhost heartbeat is ignored).
//   node tests/ui-sim.mjs            (site on localhost:8080; BASE=… to change)
//   SHOTS=docs/redesign/shots/step4b node tests/ui-sim.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const SHOTS = process.env.SHOTS ? path.resolve(root, process.env.SHOTS) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const IGNORE = /cloudfunctions\.net\/heartbeat|Failed to load resource: net::ERR_FAILED|ERR_INTERNET/i;
const ROBOTS = JSON.parse(readFileSync(path.join(root, "public/robots/index.json"), "utf8"));
const CATS = { mobile: "Mobile robots", manipulator: "Manipulators", legged: "Legged robots & humanoids", drone: "Drones", hybrid: "Hybrid robots" };
const fails = [];
const check = (c, m) => { console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails.push(m); };
const browser = await chromium.launch();

for (const w of [1440, 1024, 390]) {
  console.log(`\n== ${w}px`);
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 900 : 844 }, ...(w <= 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push(String(e)));
  const noScroll = async (label) => check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: no horizontal scroll`);
  const visibleCards = () => p.$$eval(".cat-card:not([hidden]):not(.tbref):not(.cat-own):not(.fcard)", (l) => l.filter((c) => c.offsetParent).map((c) => c.dataset.id));

  await p.goto(`${BASE}/rviz.html`, { waitUntil: "load" });
  await p.evaluate(() => localStorage.removeItem("ros2lab.sim.tab"));
  await p.reload({ waitUntil: "load" });
  await p.waitForSelector(".cat-card", { state: "attached" });
  await p.evaluate(() => document.fonts.ready);
  check(/Robot simulator/.test(await p.textContent("h1")), "h1 is Robot simulator");
  check(await p.isVisible("#cat-q") && /Filter robots/.test(await p.textContent(".simq")), "the Filter robots box is visible");
  check((await p.$$("#cat-feat .fcard")).length === 3 && /COURSE ROBOT/i.test(await p.textContent("#cat-feat")), "featured TurtleBot3 panel: 3 robots, Course robot label");
  check(/Under test/.test(await p.textContent(".simtop")) && /TurtleBot3 Burger/.test(await p.textContent(".simtop")), "New here line explains Under test");
  check((await p.$$eval("#cat-tabs button", (b) => b.map((x) => x.textContent))).join("|") === [`All33`, ...Object.entries(CATS).map(([k, t]) => `${t}${ROBOTS.filter((r) => r.category === k).length}`)].join("|"), "tabs and counts: All / Mobile / Manipulators / Legged & humanoids / Drones / Hybrid");
  check(await p.$$eval(".cat-card:not(.tbref):not(.cat-own):not(.fcard)", (l) => l.length) === 30, "30 robot cards (33 minus the 3 TurtleBot3)");
  check(await p.$$eval(".tbref", (l) => l.length) === 1, "one TurtleBot3 pointer card in Mobile");
  check(await p.$eval("#cat-drone .cat-sec-head p", (e) => e.textContent) === "Multirotors with velocity control.", "Drones blurb");
  check(await p.$$eval(".cat-card[data-id] .cat-pic", (l) => l.length) === 30, "every card has a picture box");
  check((await p.$eval(".cat-card[data-id=ur5e]", (e) => e.getAttribute("href"))) === "robot.html?id=ur5e", "cards open robot.html?id=…");
  check((await p.$eval(".cat-own", (e) => e.getAttribute("href"))) === "rviz.html?robot=own", "Your own robot card");
  const ur = await p.$$eval(".cat-card[data-id=ur5e] .cat-facts li", (l) => l.map((x) => x.textContent));
  check(ur.join("|") === "Official Jazzy workspace|Universal Robots|MoveIt 2|Gazebo + ros2_control", `UR5e chips: ${ur.join(" | ")}`);
  const sc = await p.$$eval(".cat-card[data-id=scout] .cat-facts li", (l) => l.map((x) => x.textContent));
  check(!sc.some((x) => /Gazebo/.test(x)), `Scout has no Gazebo chip: ${sc.join(" | ")}`);
  check((await p.textContent(".cat-card[data-id=quadruped] .st")) === "Under test", "Under test badge on a non-course robot");
  await noScroll("catalogue");
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `catalogue-${w}.png`), fullPage: true });

  for (const [k, t] of Object.entries(CATS)) {
    await p.click(`#cat-tabs button[data-cat=${k}]`);
    const ids = await visibleCards();
    const want = ROBOTS.filter((r) => r.category === k && !/^tb3_/.test(r.id)).map((r) => r.id).sort();
    check(JSON.stringify(ids.sort()) === JSON.stringify(want), `tab ${t}: ${ids.length} cards`);
    check(await p.$eval(".cat-own", (e) => !e.offsetParent), `tab ${t}: Your own robot hidden`);
    await noScroll(`tab ${t}`);
  }
  await p.click("#cat-tabs button[data-cat=all]");
  await p.reload({ waitUntil: "load" }); await p.waitForSelector(".cat-card", { state: "attached" });
  check(await p.$eval("#cat-tabs button[data-cat=all]", (b) => b.getAttribute("aria-pressed")) === "true", "tab memory: All after reload");
  await p.click("#cat-tabs button[data-cat=drone]"); await p.reload({ waitUntil: "load" }); await p.waitForSelector(".cat-card", { state: "attached" });
  check(await p.$eval("#cat-tabs button[data-cat=drone]", (b) => b.getAttribute("aria-pressed")) === "true", "tab memory: Drones after reload");
  await p.click("#cat-tabs button[data-cat=all]");

  for (const [term, expect] of [["lidar", (r) => /lidar/i.test(JSON.stringify(r.sim?.sensors || []) + JSON.stringify(r.specs?.sensors || []) + r.about + r.title)], ["ur5e", (r) => r.id === "ur5e"]]) {
    await p.fill("#cat-q", term);
    const ids = await visibleCards();
    const want = ROBOTS.filter((r) => !/^tb3_/.test(r.id) && expect(r)).map((r) => r.id);
    check(ids.length > 0 && want.every((i) => ids.includes(i)), `filter "${term}": ${ids.length} cards, includes ${want.length ? want.join(", ") : "-"}`);
    if (term === "ur5e") check(ids.join() === "ur5e" && !(await p.isVisible("#cat-feat")), 'filter "ur5e": only UR5e, the TurtleBot3 panel hides');
    if (term === "lidar") check(await p.isVisible("#cat-feat"), 'filter "lidar": the TurtleBot3 panel stays');
    await noScroll(`filter ${term}`);
    if (SHOTS && w === 1440) await p.screenshot({ path: path.join(SHOTS, `filter-${term}-${w}.png`) });
  }
  await p.fill("#cat-q", "zzzz-no-robot");
  check((await visibleCards()).length === 0, "filter with no match: no robot cards");
  await p.fill("#cat-q", "");

  // five robot info pages and their Open in the simulator link
  for (const id of ["tb3_burger", "tb3_waffle_pi", "ur5e", "spot", "crazyflie"]) {
    const r = ROBOTS.find((x) => x.id === id);
    await p.goto(`${BASE}/robot.html?id=${id}`, { waitUntil: "load" });
    await p.waitForSelector(".rbdl");
    await p.evaluate(() => document.fonts.ready);
    check((await p.textContent(".rbinfo h1")) === r.title, `${id}: title`);
    check((await p.textContent("#rb-crumbs")).includes("Robot simulator") && (await p.textContent("#rb-crumbs")).includes(CATS[r.category].replace(" & ", " and ").replace("Legged robots and humanoids", "Legged robots and humanoids")), `${id}: breadcrumbs`);
    check(await p.$eval(".rbpic img, .rbpic .cat-pic-wait", (e) => !!e), `${id}: picture`);
    check((await p.textContent(".rbinfo")).includes(r.about), `${id}: full about text`);
    const dl = await p.textContent(".rbdl");
    check(/Type/.test(dl) && /Made by/.test(dl) && /Fixed frame/.test(dl) && /Gazebo/.test(dl) && /Source/.test(dl), `${id}: spec list`);
    check(await p.isVisible(".rbwarn") === (r.status !== "active" || r.legacy === true), `${id}: under-test notice ${r.status !== "active" ? "shown" : "hidden"}`);
    if (id === "tb3_waffle_pi") check(/\/scan/.test(dl) && /0\.26 m\/s, 1\.82 rad\/s/.test(dl) && /emanual\.robotis\.com/.test(dl), "tb3_waffle_pi: specs block (sensors with topics, speed, source)");
    if (r.real?.length) check(/Real robots like this/.test(await p.textContent(".rbinfo")), `${id}: Real robots like this`);
    check(await p.$eval(".rbact .btn-main", (e) => e.getAttribute("href")) === `rviz.html?robot=${id}`, `${id}: Open in the simulator link`);
    check(await p.$eval(".rbact .btn-sec", (e) => e.getAttribute("href")) === "rviz.html", `${id}: All robots link`);
    await noScroll(`${id} info page`);
    if (SHOTS && ["tb3_waffle_pi", "ur5e"].includes(id)) await p.screenshot({ path: path.join(SHOTS, `robot-${id}-${w}.png`), fullPage: true });
    await Promise.all([p.waitForURL(new RegExp(`rviz\\.html\\?robot=${id}$`)), p.click(".rbact .btn-main")]);
    await p.waitForSelector("#bench:not([hidden])");
    await p.waitForFunction(() => document.getElementById("bench-title").textContent.length > 0 && document.getElementById("bench-title").textContent !== "Robotic Models Simulator", null, { timeout: 15000 });
    check((await p.textContent("#bench-title")) === r.title, `${id}: Open in the simulator loads the workbench`);
  }
  await p.goto(`${BASE}/robot.html?id=nope`, { waitUntil: "load" });
  await p.waitForSelector(".rbinfo");
  check((await p.textContent(".rbinfo h1")) === "Robot not found" && (await p.$eval(".rbinfo .btn", (e) => e.getAttribute("href"))) === "rviz.html", "unknown id: Robot not found with a link back");
  await p.goto(`${BASE}/robot.html`, { waitUntil: "load" });
  await p.waitForSelector(".rbinfo");
  check((await p.textContent(".rbinfo h1")) === "Robot not found", "no id: Robot not found");
  await noScroll("not found page");
  check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 3).join(" || ") : ""}`);
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL OK");
process.exit(fails.length ? 1 : 0);
