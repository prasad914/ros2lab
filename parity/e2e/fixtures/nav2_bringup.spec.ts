// Step F: nav2_bringup scenario (Nav2's own TB3 demo, tb3_simulation_launch.py) against
// parity/fixtures/tb3_burger/nav2_bringup/: graph with the installed params (NavFn_MPPI = installed nav2_params.yaml),
// /cmd_vel type, and the planner x controller matrix (step E) plus the DWB_burger follow-up, goal1 each.
// Command as in start_reference.sh (nav2_bringup): headless:=True use_rviz:=False params_file:=<pair> map:=<map>.
import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FIX, Recorder, compareGraph, prepTerm, putFile, run, screens, siteState, text, topicInfo, waitText } from "./lib";
import { GOALS, SITE_MAP, checkLines, logLines, sendGoal, setInitialPose } from "./nav";

const robot = "tb3_burger", BASE = path.join(FIX, robot, "nav2_bringup");
const MAPS = path.join(FIX, "maps");
const count = (s: string, re: RegExp) => (s.match(re) || []).length;
const pairs = (sub: string) => fs.readdirSync(path.join(BASE, sub)).filter((d) => fs.existsSync(path.join(BASE, sub, d, "result.json"))).sort();

/** Open the page, copy the map and the pair's params, launch, set the start pose; returns why it is not ready, or "". */
async function bringup(page: any, sub: string, pair: string): Promise<string> {
  await page.goto(`/rviz.html?robot=${robot}`);
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs, null, { timeout: 90000 });
  await run(page, "cd ~/ros2_ws");
  await run(page, "colcon build --symlink-install");
  await prepTerm(page, robot, false);
  await putFile(page, SITE_MAP, path.join(MAPS, "turtlebot3_world.yaml"));
  await putFile(page, SITE_MAP.replace(/\.yaml$/, ".pgm"), path.join(MAPS, "turtlebot3_world.pgm"));
  const params = `/home/student/parity_params/${pair}.yaml`;
  await putFile(page, params, path.join(BASE, sub, pair, "params.yaml"));
  await run(page, `ros2 launch nav2_bringup tb3_simulation_launch.py headless:=True use_rviz:=False params_file:=${params} map:=${SITE_MAP}`);
  if (!(await waitText(page, /Managed nodes are active/, 180000))) return "localization lifecycle not active within 180 s";
  await setInitialPose(page, robot);
  let all = "";
  for (let i = 0; i < 240; i++) { all = await screens(page); if (count(all, /Managed nodes are active/g) >= 2) return ""; await page.waitForTimeout(500); }
  const odom = await page.evaluate(() => (window as any).__ros2lab.tf.edges.some((e: any) => e.parent === "odom"));
  return `navigation lifecycle not active within 120 s after the initial pose${odom ? "" : " (no odom frame on the site)"}`;
}

test("tb3_burger nav2_bringup: graph with the installed params, /cmd_vel type", async ({ page }) => {
  test.setTimeout(600000);
  const rec = new Recorder(robot, "nav2_bringup");
  const dir = path.join(BASE, "matrix", "NavFn_MPPI");   // the installed nav2_params.yaml unchanged (params.diff: none)
  try {
    const why = await bringup(page, "matrix", "NavFn_MPPI");
    rec.exact("tb3_simulation_launch.py: both lifecycle managers active after the initial pose", true, !why, path.join(dir, "ready_navigation.txt"), undefined, why || undefined);
    const site = await siteState(page);
    compareGraph(rec, site, dir);
    const cv = path.join(dir, "cmd_vel_info.txt");
    rec.exact("/cmd_vel type (tb3_simulation_launch.py)", topicInfo(cv).type, site.topics.find((t) => t.name === "/cmd_vel")?.type ?? null, cv);
    rec.exact("/parameter_events publishers have node names", 0, site.topics.find((t) => t.name === "/parameter_events")?.endpoints.filter((e: any) => /undefined/.test(e.node)).length ?? 0,
      path.join(dir, "topic_list.txt"), undefined, "a node named 'undefined' would be a website bug; no real node has that name");
  } finally { rec.save(); }
});

for (const sub of ["matrix", "matrix_dwb_burger"]) {
  test(`tb3_burger nav2_bringup ${sub}: goal1 result per planner x controller`, async ({ browser }) => {
    test.setTimeout(3600000);
    const rec = new Recorder(robot, `nav2_bringup_${sub}`);
    let blocked = "";
    try {
      for (const pair of pairs(sub)) {
        const fx = path.join(BASE, sub, pair, "result.json"), R = JSON.parse(text(fx));
        if (blocked) { rec.exact(`${pair} goal1 status`, R.status, null, fx, false, `not run: ${blocked}`); continue; }
        const page = await browser.newPage();
        try {
          const why = await bringup(page, sub, pair);
          if (why) {
            rec.exact(`${pair} goal1 status`, R.status, null, fx, false, why);
            if (pair === pairs(sub)[0]) blocked = `the first pair (${pair}) did not become ready: ${why}`;
            continue;
          }
          const G = GOALS.goals.goal1;
          const r = await sendGoal(page, robot, { x: G.position.x, y: G.position.y, z: G.orientation.z, w: G.orientation.w });
          rec.exact(`${pair} goal1 status`, R.status, r.status, fx);
          rec.exact(`${pair} goal1 error_code`, R.error_code, r.error_code, fx);
          if (R.status !== "SUCCEEDED") {
            const gl = path.join(BASE, sub, pair, "goal_goal1", "nav2_goal_lines.txt");
            checkLines(rec, await screens(page), gl, logLines(gl).filter((l) => /legal trajectory|patience exceeded|Aborting handle|Goal failed/.test(l.msg)), `${pair} log`);
          }
        } finally { await page.close(); }
      }
    } finally { rec.save(); }
  });
}
