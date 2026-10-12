// Records what the WEBSITE's simulator does for each ground-truth scenario (tools/ground-truth/scenarios.txt), with
// the same file names that tools/ground-truth/capture.sh writes on a real Ubuntu + ROS 2 Jazzy computer.
//   python3 -m http.server 8080 --directory public &      (the site must be served on localhost:8080)
//   node tests/sim-capture.mjs                            every scenario  -> ground-truth/site/<id>/
//   node tests/sim-capture.mjs tb3_burger_world ur5e_mock only these
// Then:  node tools/ground-truth/compare.mjs
import { openRobot, run, screens, newTerm } from "./real-lib.mjs";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "ground-truth", "site");
const want = process.argv.slice(2);
const SPEED = +(process.env.SETTLE_SCALE || 1);   // scale the settle/sleep times (e.g. 0.5 on a fast machine)

const scenarios = readFileSync(join(ROOT, "tools/ground-truth/scenarios.txt"), "utf8").split("\n")
  .filter((l) => l.trim() && !l.trim().startsWith("#"))
  .map((l) => { const [id, ws, robot, env, steps, settle] = l.split("|").map((s) => s.trim()); return { id, ws, robot, env: env === "-" ? [] : env.split(",").map((s) => s.trim()), steps: steps.split(" ;; ").map((s) => s.trim()), settle: +settle || 20 }; })
  .filter((s) => !want.length || want.includes(s.id));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// one command through the page's shell, without the terminal UI: the text lines it prints (hints are the site's
// teaching notes, not ROS output, so they are left out)
const sh = (p, cmd) => p.evaluate((c) => { const r = window.__ros2lab.sh.run(c); return (r.lines || []).filter((l) => l.cls !== "hint").map((l) => l.text).join("\n"); }, cmd);
const fileName = (t) => t.replace(/^\//, "").replace(/\//g, "__");

for (const s of scenarios) {
  console.log(`\n==================== ${s.id} (${s.robot})`);
  const o = join(OUT, s.id); rmSync(o, { recursive: true, force: true }); mkdirSync(join(o, "topic"), { recursive: true });
  const { b, p, errs } = await openRobot(s.robot);
  try {
    const wsEnv = await p.evaluate(() => Object.entries(window.__ros2lab.sh.realWs.env || {}).map(([k, v]) => `export ${k}=${v}`));
    const pre = ["cd ~/ros2_ws", "source install/setup.bash", ...wsEnv, ...s.env.map((e) => `export ${e}`)];
    for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install"]) await run(p, c);
    const cmds = []; let first = true, k = 0;
    for (const step of s.steps) {
      if (step.startsWith("sleep:")) { await sleep(+step.slice(6) * 1000 * SPEED); continue; }
      const cmd = step.replace(/^(bg|fg):/, "");
      cmds.push("$ " + cmd);
      if (!first) await newTerm(p);
      first = false; k++;
      for (const c of pre) await run(p, c);
      await run(p, cmd);
      if (step.startsWith("fg:")) {   // wait as long as the command runs on Ubuntu (ros2 topic pub -t N -r R: N/R s), at most 30 s
        const tN = +(cmd.match(/\s-t\s+(\d+)/) || [])[1], rR = +(cmd.match(/\s-r\s+([\d.]+)/) || [])[1] || 1;
        await sleep(Math.min(30, tN ? tN / rR + 1 : 3) * 1000);
      }
    }
    await sleep(s.settle * 1000 * SPEED);
    writeFileSync(join(o, "commands.txt"), cmds.join("\n") + "\n");
    (await screens(p)).forEach((t, i) => writeFileSync(join(o, `launch_${i + 1}.log`), t));
    // the same introspection capture.sh does
    const nodes = await sh(p, "ros2 node list");
    writeFileSync(join(o, "nodes.txt"), nodes + "\n");
    const topics = await sh(p, "ros2 topic list -t");
    writeFileSync(join(o, "topics.txt"), topics + "\n");
    writeFileSync(join(o, "services.txt"), await sh(p, "ros2 service list -t") + "\n");
    writeFileSync(join(o, "actions.txt"), await sh(p, "ros2 action list -t") + "\n");
    let ctl = "", hw = "";
    for (const cm of nodes.split("\n").filter((n) => /(^|\/)controller_manager$/.test(n))) {
      ctl += `## ${cm}\n${await sh(p, `ros2 control list_controllers -c ${cm}`)}\n`;
      hw += `## ${cm}\n${await sh(p, `ros2 control list_hardware_interfaces -c ${cm}`)}\n`;
    }
    writeFileSync(join(o, "controllers.txt"), ctl); writeFileSync(join(o, "hardware_interfaces.txt"), hw);
    // the TF tree: run view_frames in the page and take the .gv file it writes
    const gv = await p.evaluate(() => { const S = window.__ros2lab.sh; S.run("ros2 run tf2_tools view_frames");
      const f = [...S.fs.keys()].filter((k) => k.startsWith(S.cwd + "/frames_") && k.endsWith(".gv")).pop(); return f ? S.fs.get(f).content : ""; });
    writeFileSync(join(o, "tf_frames.gv"), gv);
    for (const line of topics.split("\n")) {
      const t = line.replace(/ \[.*/, "").trim();
      if (!t || t === "/parameter_events" || t === "/rosout") continue;
      const n = fileName(t);
      writeFileSync(join(o, "topic", `${n}.info.txt`), await sh(p, `ros2 topic info -v ${t}`) + "\n");
      writeFileSync(join(o, "topic", `${n}.hz.txt`), await sh(p, `ros2 topic hz ${t}`) + "\n");
      writeFileSync(join(o, "topic", `${n}.echo.txt`), (await sh(p, `ros2 topic echo --once ${t}`)).slice(0, 8000) + "\n");
    }
    writeFileSync(join(o, "page_errors.txt"), errs.join("\n") + "\n");
    console.log(`   recorded: ${topics.split("\n").filter(Boolean).length} topics, ${nodes.split("\n").filter(Boolean).length} nodes -> ${o}`);
  } catch (e) {
    console.log("   FAILED:", e.message);
    writeFileSync(join(o, "capture_error.txt"), String(e.stack || e));
  }
  await b.close();
}
console.log("\nDone. Compare with:  node tools/ground-truth/compare.mjs");
