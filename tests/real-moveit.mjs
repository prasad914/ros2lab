// An arm from its official workspace: Gazebo + MoveIt through the REAL launch file, then plan and execute a joint goal.
//   node tests/real-moveit.mjs [robot] ["launch command"] [group]
import { openRobot, run, screens, waitText } from "./real-lib.mjs";
const [robot = "ur5e", cmd = "ros2 launch ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e", group = ""] = process.argv.slice(2);
const { b, p, errs } = await openRobot(robot);
let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const env = await p.evaluate(() => Object.entries(window.__ros2lab.sh.realWs.env).map(([k, v]) => `export ${k}=${v}`));
for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", ...env]) await run(p, c);
await run(p, cmd);
ok(await waitText(p, /You can start planning now!/, 120000), "move_group: You can start planning now!");
await p.waitForFunction(() => { const g = window.__ros2lab.sh.graph; return g.mg && g.mg.ready; }, null, { timeout: 90000 }).catch(() => {});
// the controllers MoveIt sends to may come up after move_group (spawners wait for Gazebo / ros2_control_node)
await p.waitForFunction(() => { const g = window.__ros2lab.sh.graph, mg = g.mg; const c = mg && mg.controllers.find((x) => x.def) || (mg && mg.controllers[0]); return c && g.cmModels().some((m) => m.cm.controllers.get(c.name) && m.cm.controllers.get(c.name).state === "active"); }, null, { timeout: 60000 }).catch(() => {});
const r = await p.evaluate(async (want) => {
  const g = window.__ros2lab.sh.graph, mg = g.mg;
  const grp = want || Object.keys(mg.srdf.groups)[0];
  const G = mg.group(grp); if (!G) return { err: "no group " + grp, groups: Object.keys(mg.srdf.groups) };
  const cur = mg.current(), goal = {};
  // move three joints part of the way toward the middle of their limits (always inside them)
  G.joints.slice(0, 3).forEach((j, i) => { const J = mg.model.joints[j], lo = J && J.limit ? +J.limit.lower : -3, hi = J && J.limit ? +J.limit.upper : 3, c = cur[j] || 0, mid = (lo + hi) / 2, d = [0.4, -0.3, 0.3][i]; let v = c + (Math.abs(mid - c) > 0.05 ? Math.sign(mid - c) * Math.min(Math.abs(d), Math.abs(mid - c)) : d); goal[j] = Math.max(lo + 0.05, Math.min(hi - 0.05, v)); });
  const pl = mg.plan({ group: grp, goal, pipeline: mg.pipelines()[0].id, planner_id: mg.pipelines()[0].def, time: 5, attempts: 1, vel: 0.5, acc: 0.5 });
  if (!pl.ok) return { err: "plan failed", pl: { error: pl.error, message: pl.message } };
  const ex = mg.execute(pl); const exr = JSON.stringify(ex || null).slice(0, 300); const ctl = g.cmModels().flatMap((m) => [...m.cm.controllers.values()].map((c) => c.name + ":" + c.state));
  await new Promise((res) => setTimeout(res, 16000));
  const now = mg.current();
  return { grp, goal, now: Object.fromEntries(Object.keys(goal).map((j) => [j, now[j]])), ex: ex && (ex.ok !== undefined ? ex.ok : true), exr, ctl, mgc: mg.controllers };
}, group);
console.log(JSON.stringify(r));
ok(!r.err, "planned with " + (r.grp || "?"));
if (!r.err) ok(Object.keys(r.goal).every((j) => Math.abs(r.goal[j] - r.now[j]) < 0.05), "the arm in Gazebo reached the planned goal");
console.log("ERRS", errs.slice(0, 5)); console.log(fails ? `${fails} failed` : "all passed");
await b.close(); process.exit(fails ? 1 : 0);
