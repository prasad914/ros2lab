import { open, pick } from "./lib.mjs";
const { b, p, errs } = await open(); await pick(p, process.argv[2] || "ur5e");
const R = async (c, w = 1200) => { await p.evaluate((c) => window.__ros2lab.term.runHere(c), c); await p.waitForTimeout(w); };
await R("cd ~/ros2_ws && colcon build", 2500); await R("code .", 3000);
await p.locator(".vsc").scrollIntoViewIfNeeded();
const path = (process.argv[3] || "src/ur5e_moveit_config/launch/demo.launch.py").split("/");
let from = 0;
for (const t of path) {
  const items = p.locator(".vsc [role=treeitem]");
  const n = await items.count(); let hit = null;
  for (let i = from; i < n; i++) { const txt = (await items.nth(i).innerText()).trim().replace(/^py\s*/, ""); if (txt === t || txt.endsWith(" " + t) || txt.replace(/\s+/g, "") .endsWith(t)) { hit = items.nth(i); from = i + 1; break; } }
  if (hit) { await hit.click(); await p.waitForTimeout(500); } else console.log("no item", t);
}
await p.waitForTimeout(800);
await p.screenshot({ path: process.env.OUT || "/tmp/claude-0/-home-claude/09d5e0b6-60f2-5e77-bc97-cd22ce95dfea/scratchpad/vsc2.png" });
console.log("ERRS", errs); await b.close();
