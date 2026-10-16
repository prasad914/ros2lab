import { test } from "@playwright/test";
import * as fs from "node:fs/promises";
import path from "node:path";

test("P9-round2 tb3_waffle_pi sensors browser observation", async ({ page }) => {
  const out = "/home/prasad/ros2lab-course/parity/browser_out/tb3_waffle_pi/p9-round2/sensors";
  await fs.mkdir(out, { recursive: true });
  const browserErrors: string[] = [];
  page.on("pageerror", e => browserErrors.push(e.message));
  page.on("console", m => { if (m.type() === "error") browserErrors.push(m.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/rviz.html?robot=tb3_waffle_pi");
  await page.waitForTimeout(1000);
  const launchState = await page.evaluate(() => {
    const r: any = window.__ros2lab;
    return { robot: r?.robot, termHook: !!r?.term, visibleText: document.body.innerText };
  });
  const commandResult = await page.evaluate(() => {
    const t = (window as any).__ros2lab?.term;
    if (!t) return { attempted: false, reason: "term hook unavailable" };
    t.run("TURTLEBOT3_MODEL=waffle_pi ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
    return { attempted: true };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, "3d-view.png"), fullPage: true });
  const launchText = await page.locator("body").innerText();
  const rvizResult = await page.evaluate(() => {
    const t = (window as any).__ros2lab?.term;
    if (!t) return { attempted: false, reason: "term hook unavailable" };
    t.run("ros2 run rviz2 rviz2");
    return { attempted: true };
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, "rviz-view.png"), fullPage: true });
  const snapshot: any = await page.evaluate(() => {
    const r: any = window.__ros2lab;
    const plain = (v: any) => { try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); } };
    const topics = Array.isArray(r?.topics) ? r.topics.map(plain) : r?.topics;
    return {
      robot: r?.robot, topics, qosByTopic: topics?.map((t: any) => ({ topic: t.name, type: t.type, qos: t.qos ?? null })),
      tfFramesEdgesAuthority: plain(r?.tf), fixedFrame: plain(r?.fixedFrame), params: plain(r?.nodes?.map((n: any) => ({ name: n.name, full: n.full, params: n.params })) ?? null),
      lifecycleStates: plain(r?.lifecycleStates), globalAndDisplayStatus: plain(r?.rvizStatus), logs: plain(r?.logs), errors: plain(r?.errors),
      nav: r?.nav2 ? { plan: plain(r.nav2.plan), localPlan: plain(r.nav2.localPlan), robotPoseHistory: plain(r.nav2.robotPoseHistory), amclPoseHistory: plain(r.nav2.amclPoseHistory), particleCount: plain(r.nav2.particleCount), globalCostmap: plain(r.nav2.globalCostmap), localCostmap: plain(r.nav2.localCostmap) } : null,
      sensors: plain(r?.sensors), rvizViewers: plain((window as any).__rvizViewers ?? null), simulatorPose: plain(r?.simulator?.robotPose ?? r?.gazebo?.robotPose ?? null),
      canvases: [...document.querySelectorAll("canvas")].map((c: any) => ({ width: c.width, height: c.height })), visibleText: document.body.innerText,
    };
  });
  const missing = [
    ["topic list with types", snapshot.topics], ["QoS per topic", snapshot.qosByTopic], ["TF frames/edges/publisher authority", snapshot.tfFramesEdgesAuthority],
    ["Fixed Frame options and selected value", snapshot.fixedFrame], ["params", snapshot.params], ["lifecycle states", snapshot.lifecycleStates],
    ["Global Status/per-display status", snapshot.globalAndDisplayStatus], ["user-visible logs/errors", snapshot.logs ?? snapshot.errors],
    ["/plan, /local_plan, pose histories, particle count and costmaps", snapshot.nav], ["camera_info/image dimensions/PointCloud2 fields", snapshot.sensors],
  ].filter(([, v]) => v == null).map(([k]) => `MISSING_HOOK: ${k}`);
  const details = ["Scenario tried: tb3_waffle_pi / sensors; the only scenario with fixtures in this robot folder.", "The fixture action_list.txt is empty; no pose estimate, goal, planner/controller choice, or RViz display-add action is listed.", `World launch attempted: ${JSON.stringify(commandResult)}.`, `Observed after launch attempt: ${launchText}`, `RViz launch attempted: ${JSON.stringify(rvizResult)}.`, "Exact blocker displayed by browser: There is no robot \"tb3_waffle_pi\" in the catalog. Go back to the Robotic Models Simulator and pick one.", "Also displayed for launch command: TURTLEBOT3_MODEL=waffle_pi: command not found.", "No simulator launch completed; no RViz element interaction or expected bus-message assertion was available. Pose agreement was not assessed.", ...missing].join("\n");
  await fs.writeFile(path.join(out, "emulator-state.json"), JSON.stringify({ launchState, commandResult, rvizResult, state: snapshot, browserErrors }, null, 2));
  await fs.writeFile(path.join(out, "notes.md"), details + "\n");
  await fs.writeFile(path.join(out, "browser-errors.json"), JSON.stringify(browserErrors, null, 2));
});

declare global { interface Window { __ros2lab: any; __rvizViewers?: any[]; } }
