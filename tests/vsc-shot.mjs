import { open, pick, run } from "./lib.mjs";
const r = process.argv[2] || "ur5e";
const { b, p, errs } = await open(); await pick(p, r);
await run(p, "cd ~/ros2_ws && colcon build", 2500); await run(p, "source install/setup.bash"); await run(p, "code ~/ros2_ws", 3000);
const vs = p.locator("text=src").first(); 
await p.screenshot({ path: process.env.OUT || "/tmp/claude-0/-home-claude/09d5e0b6-60f2-5e77-bc97-cd22ce95dfea/scratchpad/vsc.png" });
const html = await p.evaluate(() => { const v = document.querySelector("[class*=vsc]"); return v ? v.outerHTML.slice(0, 3000) : "none"; });
console.log(html); console.log(errs);
await b.close();
