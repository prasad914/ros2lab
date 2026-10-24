// Night 2, Part 3: the Nav2 velocity chain of the TurtleBot3 profile against the real capture
// parity/fixtures/tb3_jazzy_v3/tb3_burger/nav_cmdvel/ (capture_cmdvel.sh: navigation2.launch.py with the shipped map, initial
// pose (-2.0, -0.5), goal (0.5, 1.45)): controller_server + behavior_server -> /cmd_vel_nav -> velocity_smoother ->
// /cmd_vel_smoothed -> collision_monitor -> /cmd_vel (+ docking_server) -> ros_gz_bridge, all TwistStamped.
// Checks `ros2 topic info -v` of the three topics (types, publisher / subscriber nodes and counts, QoS), the publish
// rates during the goal (real: 10.00 / 20.00 / 19.40 Hz wall, chain.csv; site: per second of its simulation clock) and the top speed (real: 0.300 m/s on all three
// topics, DWB max_vel_x, not the smoother's 0.5). Site numbers: parity/browser_out/tb3_night2/cmdvel_chain.json.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FIX, ROOT, openWorld, prepTerm, run, screens, text, topicInfo, waitText } from "./fixtures/lib";
import { sendGoal } from "./fixtures/nav";

const robot = "tb3_burger";
const DIR = path.join(FIX, "tb3_jazzy_v3", robot, "nav_cmdvel");
const TOPICS = ["/cmd_vel_nav", "/cmd_vel_smoothed", "/cmd_vel"];
// real numbers from chain.csv (moving phase: messages with a non-zero command)
function realChain() {
  const rows = text(path.join(DIR, "chain.csv")).trim().split("\n").slice(1).map((l) => l.split(","));
  const out: Record<string, { rate: number; top: number }> = {};
  for (const t of TOPICS) {
    const r = rows.filter((x) => x[2] === t && (Math.abs(Number(x[4])) > 1e-6 || Math.abs(Number(x[5])) > 1e-6));
    const w0 = Number(r[0][0]), w1 = Number(r[r.length - 1][0]);
    out[t] = { rate: (r.length - 1) / (w1 - w0), top: Math.max(...r.map((x) => Number(x[4]))) };
  }
  return out;
}

test(`${robot}: Nav2 velocity chain (topics, QoS, rates, top speed) during the captured goal`, async ({ page }) => {
  test.setTimeout(900000);
  expect(await openWorld(page, robot)).toBe(true);
  await prepTerm(page, robot);
  await run(page, "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True");
  expect(await waitText(page, /Activating planner_server/, 180000)).toBe(true);
  await page.waitForTimeout(3000);
  await prepTerm(page, robot);
  await run(page, `ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "{header: {frame_id: map}, pose: {pose: {position: {x: -2.0, y: -0.5, z: 0.0}, orientation: {z: 0.0, w: 1.0}}, covariance: [0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.06853891945200942]}}"`);
  let all = "";
  for (let i = 0; i < 240; i++) { all = await screens(page); if ((all.match(/Managed nodes are active/g) || []).length >= 2) break; await page.waitForTimeout(500); }
  await page.waitForTimeout(5000);

  // ros2 topic info -v: node lists, types, counts
  const info: Record<string, string> = {};
  for (const t of TOPICS) {
    await prepTerm(page, robot);
    await run(page, `ros2 topic info -v ${t}`);
    await page.waitForTimeout(2000);
    info[t] = (await screens(page)).split("\n=====\n").pop() || "";
    const real = text(path.join(DIR, `topic_info_v_${t.slice(1)}.txt`)), ri = topicInfo(path.join(DIR, `topic_info_v_${t.slice(1)}.txt`));
    const nodes = (s: string, kind: string) => [...s.matchAll(/Node name: (\S+)[\s\S]*?Endpoint type: (\w+)[\s\S]*?Reliability: (\w+)[\s\S]*?Durability: (\w+)/g)].filter((m) => m[2] === kind).map((m) => `${m[1]} ${m[3]}/${m[4]}`).sort();
    for (const k of ["PUBLISHER", "SUBSCRIPTION"]) expect.soft(nodes(info[t], k), `${t} ${k} endpoints`).toEqual(nodes(real, k));
    expect.soft(info[t], `${t} type`).toContain(`Type: ${ri.type}`);
    for (const c of ["Publisher count", "Subscription count"]) expect.soft(info[t], `${t} ${c}`).toContain(`${c}: ${(real.match(new RegExp(`${c}: (\\d+)`)) || [])[1]}`);
  }

  // rates and top speed during the goal: every publish on the three topics (the Nav2 models' publishTwist), with wall
  // and sim time, and the robot's odom speed
  await page.evaluate((T) => {
    const w = window as any, G = w.__ros2lab.sh.graph, sys = G.nav2, S: any = { t: {}, top: {}, odomTop: 0 };
    for (const t of T) { S.t[t] = []; S.top[t] = -1e9; }
    w.__chain = S;
    const orig = sys.publishTwist.bind(sys);
    sys.publishTwist = (topic: string, v: any, stamped: boolean, from: string) => { if (S.t[topic]) { S.t[topic].push({ sim: sys.now(), wall: Date.now() / 1000, vx: v.vx, wz: v.wz }); S.top[topic] = Math.max(S.top[topic], v.vx); } return orig(topic, v, stamped, from); };
    S.restore = () => { sys.publishTwist = orig; };
    S.timer = setInterval(() => { const o = sys.odom(); if (o) S.odomTop = Math.max(S.odomTop, o.vx); }, 20);
  }, TOPICS);
  const r = await sendGoal(page, robot, { x: 0.5, y: 1.45 }, 300000);
  const site = await page.evaluate((T) => {
    const S = (window as any).__chain; clearInterval(S.timer); S.restore();
    const out: any = { odomTop: S.odomTop };
    for (const t of T) { const L = S.t[t].filter((x: any) => Math.abs(x.vx) > 1e-6 || Math.abs(x.wz) > 1e-6); out[t] = { n: L.length, rate: L.length > 1 ? (L.length - 1) / (L[L.length - 1].wall - L[0].wall) : 0, rateSim: L.length > 1 ? (L.length - 1) / (L[L.length - 1].sim - L[0].sim) : 0, top: S.top[t] }; }
    return out;
  }, TOPICS);
  const real = realChain();
  fs.mkdirSync(path.join(ROOT, "parity", "browser_out", "tb3_night2"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "parity", "browser_out", "tb3_night2", "cmdvel_chain.json"), JSON.stringify({ goal: r.status, real, site }, null, 1));
  expect(r.status).toBe("SUCCEEDED");
  for (const t of TOPICS) {
    expect.soft(Math.abs(site[t].top - real[t].top), `${t} top speed site ${site[t].top} real ${real[t].top}`).toBeLessThanOrEqual(0.01);
    // the real controller / smoother are wall timers (10.00 / 20.00 Hz wall at RTF 0.83); the site's run on its simulation
    // clock, which follows the wall clock when the page keeps up (headless test runs reach RTF ~0.3): compare per sim second
    expect.soft(Math.abs(site[t].rateSim - real[t].rate), `${t} rate site ${site[t].rateSim.toFixed(2)} Hz (sim) real ${real[t].rate.toFixed(2)} Hz (wall)`).toBeLessThanOrEqual(1.5);
  }
});
