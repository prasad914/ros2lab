import { open, pick, screen } from "./lib.mjs";
const robot = process.argv[2] || "tb3_burger";
const { b, p, errs } = await open(); await pick(p, robot);
const R = async (c, w = 1200) => { await p.evaluate((c) => window.__ros2lab.term.runHere(c), c); await p.waitForTimeout(w); };
await R("cd ~/ros2_ws && colcon build", 2500); await R("source install/setup.bash"); await R(`ros2 launch ${robot}_gazebo gazebo.launch.py`, 5000);
const st = await p.evaluate(() => { const g = window.__ros2lab.sh.graph; return { phys: !!g.gzPhys, dyn: g.gz && g.gz.dyn, world: g.gz.world.models.map((m) => `${m.name}:${m.static ? "S" : "D" + m.mass}`) }; });
console.log(JSON.stringify(st));
// drive toward the cardboard box and into the wall
await p.evaluate(() => window.__ros2lab.term.newTerminal());
await R("ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.22}}'", 500);
await p.waitForTimeout(Number(process.env.WAIT || 25000));
const st2 = await p.evaluate(() => { const g = window.__ros2lab.sh.graph, m = [...g.gz.models.values()][0]; return { pose: m.pose, bumped: m.bumped, dyn: g.gz.dyn }; });
console.log(JSON.stringify(st2));
await p.locator(".gz-win").scrollIntoViewIfNeeded(); await p.screenshot({ path: "/tmp/claude-0/-home-claude/09d5e0b6-60f2-5e77-bc97-cd22ce95dfea/scratchpad/gz-hi.png" });
console.log("ERRS", errs); await b.close();
