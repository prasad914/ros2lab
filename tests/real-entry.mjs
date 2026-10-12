// Run one entry of an official workspace through the real launch system and print what happened.
//   node tests/real-entry.mjs <robot> "<command>" [seconds]
import { openRobot, run, screens } from "./real-lib.mjs";
const [robot, cmd, secs = "40"] = process.argv.slice(2);
const { b, p, errs } = await openRobot(robot);
const env = await p.evaluate(() => Object.entries(window.__ros2lab.sh.realWs.env).map(([k, v]) => `export ${k}=${v}`));
for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", ...env]) await run(p, c);
await run(p, cmd);
await p.waitForTimeout(Number(secs) * 1000);
const s = (await screens(p)).join("\n=====\n");
console.log(s.split("\n").filter((l) => !/^\s*$/.test(l) && !/^(Starting|Finished) [<>]{3}/.test(l)).slice(-Number(process.env.LINES || 80)).join("\n"));
const st = await p.evaluate(() => { const g = window.__ros2lab.sh.graph; return { gz: g.gz && g.gz.world && g.gz.world.name, models: g.gz ? [...g.gz.models.keys()] : [], nodes: g.nodes.map((n) => `${n.full}(${n.kind})`), ctrls: g.cmModels ? g.cmModels().flatMap((m) => [...m.cm.controllers.values()].map((c) => `${c.name}:${c.state}`)) : [], mg: !!g.mg }; });
console.log(JSON.stringify(st, null, 1)); if (process.env.INFO) console.log(await p.evaluate((k) => { const i = (window.__ros2lab.sh.graph.procInfos || {})[k]; return i ? JSON.stringify({ params: Object.keys(i.params || {}), files: Object.fromEntries(Object.entries(i.files || {}).map(([a, b]) => [a, b.slice(0, 300)])), cmd: i.cmd }, null, 1) : "no info"; }, process.env.INFO));
console.log("ERRS", errs.slice(0, 8));
await b.close();
