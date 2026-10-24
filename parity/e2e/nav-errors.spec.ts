// Night 2, Part 4: Nav2 result error codes on the site against the real capture
// parity/fixtures/tb3_jazzy_v3/tb3_burger/nav_errors/ (capture_errors.sh: navigation2.launch.py with the shipped map,
// initial pose at the spawn pose (-2.0, -0.5), goals sent with `ros2 action send_goal`, a goal back to the spawn pose
// between cases). Per case: status, error_code and error_msg of the CLI result; the distinct bt_navigator / planner_server
// / controller_server / behavior_server log lines (coordinates normalised); the recovery sequence. Sim durations are
// recorded (parity/browser_out/tb3_night2/nav_errors.json); thresholds.yaml has no limit for them.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FIX, ROOT, openWorld, prepTerm, run, screens, text, waitText } from "./fixtures/lib";
import { normalise, sendGoal } from "./fixtures/nav";

const robot = "tb3_burger";
const DIR = path.join(FIX, "tb3_jazzy_v3", robot, "nav_errors");
const CASES: [string, number, number][] = [["outside_map", 12.0, 12.0], ["in_obstacle", 0.0, 0.0], ["unreachable", 3.5, 0.0], ["blocked", 0.5, 1.45]];
const LOGGERS = /\[(bt_navigator|planner_server|controller_server|behavior_server)\]: (.*)$/;
// "[LEVEL] [stamp] [logger]: msg" -> "LEVEL logger: msg" with coordinates normalised; consecutive repeats collapsed
function events(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const m = l.match(/\[(INFO|WARN|ERROR)\] \[[\d.]+\] \[(\w+)\]: (.*)$/); if (!m || !LOGGERS.test(l)) continue;
    if (/Passing new path to controller/.test(m[3])) continue;   // once per replanning tick, wall-clock dependent
    const e = `${m[1]} ${m[2]}: ${normalise(m[3])}`;
    if (out[out.length - 1] !== e) out.push(e);
  }
  return out;
}
const realResult = (c: string) => {
  const t = text(path.join(DIR, c, "send_goal.txt"));
  return { status: (t.match(/Goal finished with status: (\w+)/) || [])[1], error_code: Number((t.match(/error_code: (\d+)/) || [])[1]), error_msg: (t.match(/error_msg: '?([^'\n]*)'?/) || [])[1] };
};
const realSim = (c: string) => Number((text(path.join(DIR, c, "timing.txt")).match(/sim_s=([\d.]+)/) || [])[1]);
const recoveries = (ev: string[]) => ev.filter((e) => /behavior_server: Running (\w+)/.test(e)).map((e) => e.match(/Running (\w+)/)![1]);
const simTime = (p: any) => p.evaluate(() => (window as any).__ros2lab.sh.graph.gz.time as number);

test(`${robot}: Nav2 result error codes (outside the map, in an obstacle, unreachable, blocked)`, async ({ page }) => {
  test.setTimeout(1800000);
  expect(await openWorld(page, robot)).toBe(true);
  await prepTerm(page, robot);
  await run(page, "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True");
  expect(await waitText(page, /Activating planner_server/, 180000)).toBe(true);
  await page.waitForTimeout(3000);
  await prepTerm(page, robot);
  await run(page, `ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "{header: {frame_id: map}, pose: {pose: {position: {x: -2.0, y: -0.5, z: 0.0}, orientation: {z: 0.0, w: 1.0}}, covariance: [0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.06853891945200942]}}"`);
  let all = "";
  for (let i = 0; i < 240; i++) { all = await screens(page); if ((all.match(/Managed nodes are active/g) || []).length >= 2) break; await page.waitForTimeout(500); }
  expect((all.match(/Managed nodes are active/g) || []).length).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(5000);
  // the Nav2 nodes' log lines from the site's log store (graph.nav2.logs, every line the models print, with sim time)
  const navLogs = (from: number) => page.evaluate((f) => (window as any).__ros2lab.sh.graph.nav2.logs.filter((l: any) => l.t >= f).map((l: any) => l.line), from);
  const out: Record<string, any> = {};
  for (const [c, x, y] of CASES) {
    if (c === "blocked") {   // the capture's static box ring around the robot (blocker.sdf), at the robot's Gazebo pose
      const sdf = text(path.join(DIR, "blocked", "blocker.sdf")).trim();
      const p = await page.evaluate(() => { const m = [...(window as any).__ros2lab.sh.graph.gz.models.values()][0]; return { x: m.pose.x, y: m.pose.y }; });
      await prepTerm(page, robot);
      await run(page, `ros2 run ros_gz_sim create -world default -name blocker -string "${sdf}" -x ${p.x.toFixed(3)} -y ${p.y.toFixed(3)} -z 0.0`);
      await page.waitForTimeout(6000);
    }
    const t0 = await simTime(page);
    const r = await sendGoal(page, robot, { x, y }, 600000);
    const t1 = await simTime(page);
    await page.waitForTimeout(2000);
    const ev = events(await navLogs(t0));
    const realEv = events(text(path.join(DIR, c, "nav2_log_during_goal.txt")).split("\n"));
    const real = realResult(c);
    out[c] = { real, site: { status: r.status, error_code: r.error_code, error_msg: r.error_msg }, real_sim_s: realSim(c), site_sim_s: Number((t1 - t0).toFixed(3)),
      real_recoveries: recoveries(realEv), site_recoveries: recoveries(ev),
      missing_lines: [...new Set(realEv)].filter((e) => !ev.includes(e)), extra_lines: [...new Set(ev)].filter((e) => !realEv.includes(e)) };
    if (c !== "blocked") await sendGoal(page, robot, { x: -2.0, y: -0.5 }, 300000);   // back to the spawn pose, like the capture
  }
  fs.mkdirSync(path.join(ROOT, "parity", "browser_out", "tb3_night2"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "parity", "browser_out", "tb3_night2", "nav_errors.json"), JSON.stringify(out, null, 1));
  for (const [c] of CASES) {
    const o = out[c];
    expect.soft(o.site.status, `${c} status`).toBe(o.real.status);
    expect.soft(o.site.error_code, `${c} error_code`).toBe(o.real.error_code);
    expect.soft(o.site.error_msg, `${c} error_msg`).toBe(o.real.error_msg);
    expect.soft(o.site_recoveries, `${c} recovery sequence`).toEqual(o.real_recoveries);
    expect.soft(o.missing_lines, `${c} log lines missing on the site`).toEqual([]);
    expect.soft(o.extra_lines, `${c} log lines only on the site`).toEqual([]);
  }
});
