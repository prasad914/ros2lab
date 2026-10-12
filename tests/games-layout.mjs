// Opens every game and every Concept-lab animation on the Playground at 1440x900 and 390x844 and checks:
// no page errors, no sideways scroll, nothing in the game sticking out of the viewport, every game control
// reachable with Tab, and every animation's buttons clickable without errors (the animations are also used by
// lessons, so their mount(container, meta) API must keep working).
// Run from the project root with the static server on :8080:  node tests/games-layout.mjs [shotDir]
import { chromium } from "@playwright/test";

const BASE = "http://localhost:8080/playground.html";
const SHOTS = process.argv[2] || "";
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) failures++; };
const sizes = [[1440, 900], [390, 844]];

const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE);
  await page.waitForSelector(".game .game-stage > *");
  const { games, anims } = await page.evaluate(async () => ({
    games: (await import("./js/games/registry.js")).GAMES.map((g) => g.id),
    anims: (await import("./js/anims/registry.js")).ANIMS.map((a) => a.id),
  }));
  ok(games.length === 6 && ["paths", "radio", "pizza", "tsa", "source", "turtle"].every((id) => games.includes(id)), `[${w}] the six ROS 2 basics games are in the registry (${games.join(", ")})`);
  const tiles = await page.locator(".pg-pick .pg-tile").count();
  ok(tiles === games.length, `[${w}] one tile per game in the list (${tiles})`);
  if (SHOTS) {
    await page.locator(".pg-main").screenshot({ path: `${SHOTS}/playground-list-${w}.png` });
    await page.screenshot({ path: `${SHOTS}/playground-top-${w}.png` });
  }

  for (const id of games) {
    const before = errors.length;
    await page.goto(`${BASE}#${id}`);
    await page.waitForSelector(`.game[data-game="${id}"] .game-stage > *`);
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const W = document.documentElement.clientWidth, game = document.querySelector(".game");
      const clipped = (e) => { for (let a = e.parentElement; a && a !== game; a = a.parentElement) if (/auto|scroll|hidden/.test(getComputedStyle(a).overflowX)) return true; return false; };   // inside a scroll box: fine
      const wide = [game, ...game.querySelectorAll("*")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > W + 1 && !clipped(e); }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`);
      const ctrls = [...game.querySelectorAll("button, input, select, textarea, a[href], summary, [tabindex]")].filter((e) => !e.disabled && e.offsetParent !== null && e.tabIndex >= 0);
      return { wide, page: document.documentElement.scrollWidth - W, ctrls: ctrls.length };
    });
    ok(!r.wide.length && r.page <= 0, `[${w}] ${id}: fits (${r.wide.join(" ") || "nothing sticks out"}, page overflow ${r.page}px)`);
    // Tab from the game's title: focus must reach controls inside the game
    await page.locator(".game-head .btn").focus();
    let inside = 0;
    for (let k = 0; k < 8; k++) { await page.keyboard.press("Tab"); if (await page.evaluate(() => !!document.activeElement.closest(".game-stage"))) inside++; }
    ok(r.ctrls > 0 && inside > 0, `[${w}] ${id}: ${r.ctrls} controls, Tab reaches the game stage`);
    ok(errors.length === before, `[${w}] ${id}: no page errors ${errors.slice(before).join(" | ")}`);
    if (SHOTS) await page.locator(".game").screenshot({ path: `${SHOTS}/game-${id}-${w}.png` });
  }

  for (const id of anims) {
    const before = errors.length;
    await page.goto(`${BASE}#lab-${id}`);
    await page.waitForFunction((id) => document.querySelector(`#anim-pick a[data-id="${id}"].on`) && document.querySelector("#anim-stage").childElementCount > 0, id, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(150);
    const btns = page.locator("#anim-stage button:visible");
    const n = Math.min(await btns.count(), 10);
    for (let k = 0; k < n; k++) { const b = btns.nth(k); if (await b.isEnabled().catch(() => false)) await b.click({ timeout: 2000 }).catch(() => {}); }
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => { const W = document.documentElement.clientWidth, s = document.querySelector("#anim-stage"); return { kids: s.childElementCount, page: document.documentElement.scrollWidth - W, wide: [...s.querySelectorAll("*")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > W + 1; }).length }; });
    ok(r.kids > 0 && errors.length === before && r.page <= 0 && !r.wide, `[${w}] anim ${id}: loads, ${n} buttons pressed, no errors, fits ${errors.slice(before).join(" | ")} ${r.wide ? `(${r.wide} elements stick out)` : ""}`);
  }
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
