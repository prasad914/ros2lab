// Step F: nav_robotis scenario (turtlebot3_navigation2 navigation2.launch.py, map = parity/fixtures/maps) against
// parity/fixtures/<robot>/nav_robotis/. tb3_burger has the full step D evidence; tb3_waffle / tb3_waffle_pi have one
// session each (session_goal1/). The fixture map is copied onto the site first, like map:=<path> on the reference.
import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FIX, MODEL, ROBOTS, Recorder, compareGraph, exists, flatten, framesFile, gvEdges, lastScreen, openWorld, prepTerm, putFile, run, screens, siteState, text, topicInfo, topicList, waitText, yaml } from "./lib";
import { GOALS, SITE_MAP, checkLines, logLines, paramsByNode, sameValue, sendGoal, setInitialPose, stamp } from "./nav";

const NAV = `ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:=${SITE_MAP}`;
const MAPS = path.join(FIX, "maps");
const count = (s: string, re: RegExp) => (s.match(re) || []).length;

async function startNav(page: any, robot: string, rec: Recorder, runInfo: string) {
  const up = await openWorld(page, robot);
  rec.exact("turtlebot3_world.launch.py spawns the robot", true, up, runInfo, undefined, up ? undefined : `site terminal: ${lastScreen}`);
  await putFile(page, SITE_MAP, path.join(MAPS, "turtlebot3_world.yaml"));
  await putFile(page, SITE_MAP.replace(/\.yaml$/, ".pgm"), path.join(MAPS, "turtlebot3_world.pgm"));
  await prepTerm(page, robot);
  await run(page, NAV);
  return waitText(page, /Activating planner_server/, 180000);
}

for (const robot of ROBOTS) {
  const base = path.join(FIX, robot, "nav_robotis");
  const snap = robot === "tb3_burger" ? base : path.join(base, "session_goal1", "snapshot");

  test(`${robot} nav_robotis: initial pose, graph, params, /cmd_vel, goals`, async ({ page }) => {
    test.setTimeout(1500000);
    const rec = new Recorder(robot, "nav_robotis");
    try {
      const runInfo = robot === "tb3_burger" ? path.join(base, "run_info.txt") : path.join(base, "session_goal1", "run_info.txt");
      const activating = await startNav(page, robot, rec, runInfo);
      rec.exact("navigation lifecycle reaches 'Activating planner_server'", true, activating, runInfo);
      await page.waitForTimeout(5000);

      // before the initial pose (tb3_burger readiness evidence)
      const ex = path.join(base, "readiness_deadlock_2026-10-17", "excerpt.txt");
      if (exists(ex)) {
        const s = await screens(page), L = logLines(ex);
        checkLines(rec, s, ex, [L.find((l) => l.logger === "amcl" && l.level === "WARN")!, L.find((l) => /Timed out waiting for transform/.test(l.msg))!], "before initial pose");
        const st = await siteState(page), bt = st.lifecycle.find((l) => l.node === "/bt_navigator");
        const rt = path.join(base, "readiness_deadlock_2026-10-17", "runner.txt");
        const realBt = (text(rt).match(/bt_navigator=(\w+)/) || [])[1];
        rec.exact("bt_navigator state before the initial pose", realBt, bt ? bt.state : null, rt);
      } else rec.pending("readiness before the initial pose", "no readiness capture for this robot", ex);

      await setInitialPose(page, robot);
      let all = "";
      for (let i = 0; i < 240; i++) { all = await screens(page); if (count(all, /Managed nodes are active/g) >= 2) break; await page.waitForTimeout(500); }
      rec.exact("both lifecycle managers active after the initial pose", true, count(all, /Managed nodes are active/g) >= 2, runInfo);
      await page.waitForTimeout(5000);

      // graph, TF, lifecycle, params, /cmd_vel
      const site = await siteState(page);
      // the graph: tb3_waffle / tb3_waffle_pi's old session_goal1 snapshot is incomplete (25 / 26 "Unknown topic" files);
      // the Night 2 capture of the same moment (same Nav2 / ros_gz / gz-sim versions, Fast DDS) is a superset of it
      // (parity/reports/TB3_GRAPH_TRIAGE_AFTER.md), so those two compare against it; tb3_burger keeps its snapshot,
      // which the Night 2 capture equals endpoint for endpoint
      const n2 = path.join(FIX, "tb3_jazzy_v3", robot, "nav_pose", "after_pose");
      if (robot !== "tb3_burger" && exists(path.join(n2, "qos"))) compareGraph(rec, site, n2, { topicFile: path.join(n2, "topic_list_t.txt") });
      else compareGraph(rec, site, snap);
      const gv = framesFile(snap);
      if (gv) rec.exact("TF edges", gvEdges(gv), site.edges, gv); else rec.pending("TF edges", "no frames_*.gv", snap);
      const lc = path.join(snap, "lifecycle.txt");
      if (exists(lc)) {
        for (const m of text(lc).matchAll(/^(\/\S+): (\w+) \[\d+\]$/gm)) {
          const s = site.lifecycle.find((l) => l.node === m[1]);
          rec.exact(`lifecycle ${m[1]}`, m[2], s ? s.state : null, lc);
        }
      }
      const cmdFile = robot === "tb3_burger" ? path.join(base, "session_obstacle_goal", "cmd_vel_info_no_daemon.txt") : path.join(snap, "qos", "cmd_vel.txt");
      const cmdInfo = topicInfo(cmdFile), tlFile = path.join(snap, "topic_list.txt");
      const cmdType = cmdInfo.unknown ? topicList(tlFile).find((t) => t.name === "/cmd_vel")?.type ?? "" : cmdInfo.type;
      rec.exact("/cmd_vel type (navigation2.launch.py)", cmdType, site.topics.find((t) => t.name === "/cmd_vel")?.type ?? null, cmdInfo.unknown ? tlFile : cmdFile);

      const pf = path.join(FIX, "_installed", "turtlebot3_navigation2", "param", `${MODEL[robot]}.yaml`);
      const realNodes = text(path.join(snap, "node_list.txt")).split("\n").map((s) => s.trim());
      for (const [node, params] of Object.entries(paramsByNode(pf))) {
        if (!realNodes.includes(node)) continue;   // not started by navigation2.launch.py on the reference
        const sn = site.nodes.find((n) => n.full === node);
        // set by the launch file, not by the params file: use_sim_time (use_sim_time:=True), yaml_filename (map:=)
        const keys = Object.keys(params).filter((k) => k !== "use_sim_time" && k !== "yaml_filename");
        // the captured `ros2 param dump` (fixture) wins over the installed file where it has the key (substitutions)
        const dumpFile = path.join(snap, "params", node.replace(/^\//, "").replace(/\//g, "__") + ".yaml");
        const dump: Record<string, any> = exists(dumpFile) ? flatten((Object.values<any>(yaml(dumpFile) || {})[0] || {}).ros__parameters) : {};
        const want = (k: string) => (k in dump ? dump[k] : params[k]);
        const bad = keys.filter((k) => !sn || !sameValue(want(k), sn.params[k]));
        rec.exact(`params ${node} = ${MODEL[robot]}.yaml`, `${keys.length} keys as installed`, bad.length ? `${bad.length} differ` : `${keys.length} keys as installed`, pf,
          !bad.length, bad.length ? (sn ? bad.slice(0, 12).map((k) => `${k}: ${JSON.stringify(want(k))} vs ${JSON.stringify(sn.params[k])}`).join("; ") : "node not on site") : undefined);
      }
      const P = paramsByNode(pf);
      for (const n of ["/local_costmap/local_costmap", "/global_costmap/global_costmap"]) {
        const sn = site.nodes.find((x) => x.full === n);
        rec.exact(`${n} robot_radius (${MODEL[robot]}.yaml)`, P[n]?.robot_radius, sn?.params?.robot_radius ?? null, pf);
      }

      // goals: the 5 free goals (tb3_burger: every run's status) or goal1 (waffle, waffle_pi)
      // NAV_GOALS=<name,...> runs only those goals / failure cases (for checking one fix); default: all
      const only = process.env.NAV_GOALS ? process.env.NAV_GOALS.split(",") : null, want = (n: string) => !only || only.includes(n);
      const goals = (robot === "tb3_burger" ? ["goal1", "goal2", "goal3", "goal4", "goal5"] : ["goal1"]).filter(want);
      for (const g of goals) {
        let expStatus: string, fx: string, expDur: any;
        if (robot === "tb3_burger") {
          const runs = fs.readdirSync(path.join(base, "runs")).filter((f) => /^run\d+\.json$/.test(f)).map((f) => path.join(base, "runs", f));
          const st = [...new Set(runs.map((f) => JSON.parse(text(f)).results[g].status))];
          expStatus = st.length === 1 ? st[0] : st.join("|"); fx = path.join(base, "runs");
          expDur = runs.map((f) => JSON.parse(text(f)).results[g].duration);
        } else {
          fx = path.join(base, "session_goal1", "goal_goal1", "result.json");
          const r = JSON.parse(text(fx)); expStatus = r.status_name; expDur = r.duration_sim_s;
        }
        const G = GOALS.goals[g], t0 = Date.now();
        const r = await sendGoal(page, robot, { x: G.position.x, y: G.position.y, z: G.orientation.z, w: G.orientation.w });
        rec.exact(`${g} (${G.position.x}, ${G.position.y}) status`, expStatus, r.status, fx);
        rec.numeric(`${g} duration (s)`, expDur, r.status ? (Date.now() - t0) / 1000 + " wall" : null, fx, undefined, undefined, "site duration is wall time from send to result; real is sim time");
      }

      if (robot === "tb3_burger") {
        // goal results near and outside obstacles (step D failure cases)
        const cases = [
          path.join(base, "session_obstacle_goal", "goal_obstacle_goal"),
          path.join(base, "session_failure_cases", "goal_cylinder_centre"),
          path.join(base, "session_failure_cases", "goal_outside_map"),
        ];
        for (const dir of cases) {
          const fx = path.join(dir, "result.json"), R = JSON.parse(text(fx)), gp = R.goal_yaml.position, go = R.goal_yaml.orientation;
          if (!want(R.goal_name)) continue;
          const r = await sendGoal(page, robot, { x: gp.x, y: gp.y, z: go.z, w: go.w });
          rec.exact(`${R.goal_name} (${gp.x}, ${gp.y}) status`, R.status_name, r.status, fx);
          rec.exact(`${R.goal_name} error_code`, R.result.error_code, r.error_code, fx);
          rec.exact(`${R.goal_name} error_msg`, R.result.error_msg, r.error_msg, fx);
          if (R.status_name !== "SUCCEEDED") {
            const gl = path.join(dir, "nav2_goal_lines.txt");
            checkLines(rec, await screens(page), gl, logLines(gl), `${R.goal_name} log`);
          }
        }
      }
    } finally { rec.save(); }
  });
}

test("tb3_burger nav_robotis: no initial pose -> navigation bringup aborts after the transform timeout", async ({ page }) => {
  // initial_transform_timeout counts sim time (real: ~57.6 s sim); headless Chromium runs Gazebo at ~0.18x, so the
  // abort comes ~340 s wall after the activation (Phase 1 item 7 probe: 60.2 s sim at 337 s wall)
  test.setTimeout(1000000);
  const robot = "tb3_burger", dir = path.join(FIX, robot, "nav_robotis", "readiness_deadlock_2026-10-17");
  const rec = new Recorder(robot, "nav_robotis_no_initial_pose");
  try {
    const ex = path.join(dir, "excerpt.txt"), rt = path.join(dir, "runner.txt"), L = logLines(ex);
    const activating = await startNav(page, robot, rec, path.join(dir, "run_info.txt"));
    rec.exact("navigation lifecycle reaches 'Activating planner_server'", true, activating, ex);
    const t0 = Date.now();
    const aborted = await waitText(page, /Aborting bringup/, 720000);
    rec.exact("ROS2Lab note to set the initial pose on screen while Nav2 waits (site only)", true, /\(ROS2Lab: Nav2 is waiting for the map -> base_link transform\./.test(await screens(page)), ex);
    const wall = (Date.now() - t0) / 1000;
    const errs = L.filter((l) => l.level === "ERROR");
    checkLines(rec, await screens(page), ex, errs, "no initial pose");
    const act = L.find((l) => /Activating planner_server/.test(l.msg))!, fail = errs[0];
    rec.numeric("time from 'Activating planner_server' to the first ERROR (s)", +(stamp(ex, fail.src) - stamp(ex, act.src)).toFixed(3) + " wall",
      aborted ? +wall.toFixed(1) + " wall (from the moment the site printed it)" : null, ex);
    const st = await siteState(page);
    const line = (text(rt).match(/lifecycle_manager_navigation: (.*)$/m) || [])[1] || "";
    for (const m of line.matchAll(/(\w+)=(\w+)/g)) {
      const s = st.lifecycle.find((l) => l.node === `/${m[1]}`);
      rec.exact(`after the abort: ${m[1]}`, m[2], s ? s.state : null, rt);
    }
  } finally { rec.save(); }
});
