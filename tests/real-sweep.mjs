// Every simulation entry (sim / moveit / nav / slam / rviz / fake) of every official workspace, through the real
// launch system: what started, what died, which programs ROS2Lab does not model, page errors.
//   node tests/real-sweep.mjs [robot ...]      (writes tests/out/real-sweep.json)
import { openRobot, run, screens } from "./real-lib.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const idx = JSON.parse(readFileSync(new URL("../public/robots/ws/index.json", import.meta.url)));
const want = process.argv.slice(2);
const results = [];
for (const [wsid, w] of Object.entries(idx.workspaces)) {
  const ws = JSON.parse(readFileSync(new URL(`../public/robots/ws/${wsid}/workspace.json`, import.meta.url)));
  for (const robot of w.robots) {
    if (want.length && !want.includes(robot)) continue;
    const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const entries = Object.entries(ws.entry || {}).filter(([k]) => !/note|issues|real|map_save|teleop/.test(k)).flatMap(([k, v]) => list(v).filter((e) => e && e.cmd && /^ros2 launch/.test(e.cmd) && (!e.robot || e.robot === robot)).map((e) => ({ kind: k, ...e })));
    for (const e of entries) {
      const { b, p, errs } = await openRobot(robot);
      const env = await p.evaluate(() => Object.entries(window.__ros2lab.sh.realWs.env).map(([k, v]) => `export ${k}=${v}`));
      for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", ...env]) await run(p, c);
      await run(p, e.cmd);
      await p.waitForTimeout(Number(process.env.SECS || 40) * 1000);
      const s = (await screens(p)).join("\n");
      const st = await p.evaluate(() => { const g = window.__ros2lab.sh.graph; return { gz: !!g.gz, models: g.gz ? [...g.gz.models.keys()] : [], nodes: g.nodes.length, ctrls: g.cmModels ? g.cmModels().flatMap((m) => [...m.cm.controllers.values()].map((c) => `${c.name}:${c.state}`)) : [], mg: !!g.mg, nav2: !!g.nav2 }; });
      const died = [...s.matchAll(/process has died \[pid \d+, exit code (-?\d+), cmd '([^']+)'/g)].map((m) => `${m[2].split(" ")[0].split("/").slice(-2).join("/")} (${m[1]})`);
      const unmod = [...s.matchAll(/ROS2Lab: ([^ ]+) is running, but/g)].map((m) => m[1]);
      const launchErr = [...s.matchAll(/\[ERROR\] \[launch\]: (.*)/g)].map((m) => m[1].slice(0, 200));
      const errors = s.split("\n").filter((l) => /\[ERROR\]|\[Err\]/.test(l) && !/process has died/.test(l)).slice(0, 6).map((l) => l.slice(0, 220));
      const r = { robot, kind: e.kind, cmd: e.cmd, ...st, died, unmod, launchErr, errors, pageErrors: errs.slice(0, 3) };
      results.push(r);
      console.log(`${died.length || launchErr.length || errs.length ? "BAD " : "ok  "} ${robot} ${e.cmd}\n     gz=${st.gz} models=${st.models.join(",")} ctrls=${st.ctrls.join(",")} mg=${st.mg} nav2=${st.nav2}${died.length ? `\n     died: ${died.join("; ")}` : ""}${unmod.length ? `\n     unmodelled: ${unmod.join(", ")}` : ""}${launchErr.length ? `\n     launch: ${launchErr.join(" | ")}` : ""}${errors.length ? `\n     errors: ${errors.join("\n             ")}` : ""}${errs.length ? `\n     page: ${errs.join(" | ")}` : ""}`);
      await b.close();
    }
  }
}
mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
writeFileSync(new URL("./out/real-sweep.json", import.meta.url), JSON.stringify(results, null, 1));
