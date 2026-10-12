import { open, pick, run, screen } from "./lib.mjs";
// usage: node scen.mjs robot "cmd1" "cmd2" "--new" "cmd3" ...   (--new opens a new terminal)
const [r, ...cmds] = process.argv.slice(2);
const { b, p, errs } = await open(); await pick(p, r);
for (const c of cmds) {
  if (c === "--new") { await p.click(".term-tab-add"); await p.waitForTimeout(500); continue; }
  if (c.startsWith("--wait=")) { await p.waitForTimeout(+c.slice(7)); continue; }
  if (c.startsWith("--scroll=")) { await p.locator(c.slice(9)).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(400); continue; }
  if (c.startsWith("--click=")) { await p.locator(c.slice(8)).first().click(); await p.waitForTimeout(500); continue; }
  if (c.startsWith("--fill=")) { const [sel, val] = c.slice(7).split("|"); await p.locator(sel).first().fill(val); continue; }
  if (c.startsWith("--eval=")) { await p.evaluate(c.slice(7)); continue; }
  if (c.startsWith("--shot=")) { await p.screenshot({ path: c.slice(7) }); continue; }
  await p.evaluate((c) => { const s = window.__ros2lab; s.term.runHere ? s.term.runHere(c) : s.term.run(c); }, c); await p.waitForTimeout(Number(process.env.W || 1200));
}
const s = await screen(p); console.log(s.split("\n").slice(-Number(process.env.N || 50)).join("\n")); if (errs.length) console.log("ERRS", errs);
await b.close();
