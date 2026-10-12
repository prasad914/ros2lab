// Plays the six "ROS 2 basics" games (paths, radio, pizza, tsa, source, turtle) to the win at 1440 px and 390 px:
// one wrong move first, then the right ones, mostly with the keyboard. Checks: the win box appears, the badge is
// saved, "Start again" resets the game, no page errors, nothing in the game sticks out of the viewport.
// Run from the project root with the static server on :8080:  node tests/games-basics.mjs
import { chromium } from "@playwright/test";

const BASE = "http://localhost:8080/playground.html";
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };

async function open(browser, id, width) {
  const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 844 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}#${id}`);
  await page.evaluate(() => { try { localStorage.removeItem("ros2lab-badges"); } catch {} });
  await page.waitForSelector(`.game[data-game="${id}"] .game-stage > *`);
  return { page, errors, game: page.locator(`.game[data-game="${id}"]`) };
}
const overflow = (page) => page.evaluate(() => {
  const W = document.documentElement.clientWidth, game = document.querySelector(".game");
  const wide = [game, ...game.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > W + 1; }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`);
  return { wide, page: document.documentElement.scrollWidth - W };
});
const badge = (page, id) => page.evaluate((id) => { try { return !!JSON.parse(localStorage.getItem("ros2lab-badges") || "{}")[id]; } catch { return false; } }, id);
async function finish(tag, page, errors, game, id) {
  await game.locator(".game-win").waitFor({ state: "visible", timeout: 30000 });
  ok(true, `${tag} win box shown`);
  ok(await badge(page, id), `${tag} badge saved in localStorage`);
  ok(await page.locator(`.pg-tile[href="#${id}"].done`).count() === 1, `${tag} the game list marks it done`);
  const o = await overflow(page);
  ok(!o.wide.length && o.page <= 0, `${tag} fits the viewport ${o.wide.join(" ")} (page overflow ${o.page}px)`);
  await game.getByRole("button", { name: "Start again" }).click();
  ok(await game.locator(".game-win").isHidden(), `${tag} Start again hides the win box`);
  ok(!errors.length, `${tag} no page errors ${errors.join(" | ")}`);
  await page.close();
}
// type into a game's command box and press Enter (keyboard only)
const type = async (page, sel, text) => { await page.locator(sel).first().focus(); await page.keyboard.press("Control+A"); await page.keyboard.insertText(text); await page.keyboard.press("Enter"); };

async function paths(browser, w) {
  const tag = `[paths ${w}]`, { page, errors, game } = await open(browser, "paths", w);
  await type(page, ".pf-input", "cd documents");
  ok(/No such file or directory/.test(await game.locator(".game-fb").innerText()), `${tag} wrong case is refused`);
  for (const c of ["cd Documents", "cd ../ros2_ws/src", "cd ~", "cd /opt/ros/jazzy", "cd ~/ros2_ws/install"]) await type(page, ".pf-input", c);
  await finish(tag, page, errors, game, "paths");
}

async function radio(browser, w) {
  const tag = `[radio ${w}]`, { page, errors, game } = await open(browser, "radio", w);
  const subs = game.locator(".rd-sub");
  await subs.nth(0).getByRole("button", { name: /Next topic/ }).click(); await subs.nth(0).getByRole("button", { name: /Next topic/ }).click();
  ok(/is not/.test(await game.locator(".game-fb").innerText()), `${tag} a typo topic is explained`);
  await subs.nth(0).getByRole("button", { name: /Previous topic/ }).press("Enter");   // keyboard
  for (const [i, n] of [[1, 3], [2, 3], [3, 5]]) for (let k = 0; k < n; k++) await subs.nth(i).getByRole("button", { name: /Next topic/ }).click();
  await finish(tag, page, errors, game, "radio");
}

async function pizza(browser, w) {
  const tag = `[pizza ${w}]`, { page, errors, game } = await open(browser, "pizza", w);
  await game.getByRole("button", { name: "Order at the counter" }).click();
  ok(await game.getByRole("button", { name: /Wave/ }).isDisabled(), `${tag} you cannot wave during the service call`);
  await game.locator(".pz-missions li.done").first().waitFor({ timeout: 8000 });
  await game.getByRole("button", { name: /Send goal/ }).click();
  await game.getByRole("button", { name: /Wave/ }).click();
  await page.waitForFunction(() => document.querySelectorAll(".pz-missions li.done").length >= 2, null, { timeout: 15000 });
  await game.getByRole("button", { name: /Send goal/ }).click();
  await page.waitForTimeout(700);
  await game.getByRole("button", { name: "Cancel order" }).click();
  await finish(tag, page, errors, game, "pizza");
}

async function tsa(browser, w) {
  const tag = `[tsa ${w}]`, { page, errors, game } = await open(browser, "tsa", w);
  const answers = await page.evaluate(async () => Object.fromEntries((await import("./js/games/tsa.js")).CARDS.map(([t, a]) => [t, a])));
  for (let i = 0; i < 10; i++) {
    const text = (await game.locator(".ts-card").innerText()).trim();
    const right = answers[text]; ok(!!right, `${tag} situation ${i + 1} is a known card`);
    const pick = i === 0 ? ["topic", "service", "action"].find((k) => k !== right) : right;   // the first one wrong
    await game.locator(`.ts-opt[data-k="${pick}"]`).click();
    if (i === 0) ok(/Not this time/.test(await game.locator(".game-fb").innerText()), `${tag} a wrong pick names the right one`);
    await page.keyboard.press("Enter");   // the Next button has the focus
  }
  await finish(tag, page, errors, game, "tsa");
}

async function source(browser, w) {
  const tag = `[source ${w}]`, { page, errors, game } = await open(browser, "source", w);
  const chip = (t) => game.locator(".so-chip", { hasText: t }).first().click();
  await chip("ros2 run demo_nodes_py talker");
  ok(/command not found/.test(await game.locator(".so-screen").innerText()), `${tag} talker before source: command not found`);
  await chip("colcon build");
  ok(/ament_cmake/.test(await game.locator(".so-screen").innerText()), `${tag} colcon build before source: CMake cannot find ament_cmake`);
  for (const t of ["source /opt/ros/jazzy/setup.bash", "ros2 run demo_nodes_py talker", "colcon build", "source install/setup.bash", "ros2 run my_robot chiku_node", "echo"]) await chip(t);
  await game.getByRole("button", { name: "+ New terminal" }).click();
  await chip("ros2 run demo_nodes_py talker");
  await finish(tag, page, errors, game, "source");
}

async function turtle(browser, w) {
  const tag = `[turtle ${w}]`, { page, errors, game } = await open(browser, "turtle", w);
  const run = (c) => type(page, ".tt-term .pf-input", c);
  await run('ros2 topic pub --once /turtle/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 0.0}}"');
  ok(/no node subscribes/.test(await game.locator(".tt-out").innerText()), `${tag} a wrong topic name is explained`);
  await run('ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 0.0}}"');
  await run('ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.0}, angular: {z: 1.57}}"');
  await run('ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 4, \'off\': 0}"');
  await run('ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 2.0}, angular: {z: 0.0}}"');
  await run('ros2 service call /turtle1/teleport_absolute turtlesim/srv/TeleportAbsolute "{x: 1.5, y: 1.5, theta: 0.0}"');
  await run("ros2 param set /turtlesim background_r 150");
  await finish(tag, page, errors, game, "turtle");
}

const browser = await chromium.launch();
for (const w of [1440, 390]) for (const f of [paths, radio, pizza, tsa, source, turtle]) {
  try { await f(browser, w); } catch (e) { ok(false, `${f.name}@${w} threw ${String(e).split("\n")[0]}`); }
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
