import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test("tb3_waffle_pi sensors browser observation", async ({ page }) => {
  const out = "/home/prasad/ros2lab-course/parity/browser_out/tb3_waffle_pi/sensors";
  fs.mkdirSync(out, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/rviz.html?robot=tb3_waffle_pi");
  await page.waitForFunction(() => !!window.__ros2lab?.topics && !!window.__ros2lab?.tf, { timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(out, "3d-view.png"), fullPage: true });
  const rvizLaunch = await page.evaluate(() => {
    const t = window.__ros2lab?.term;
    if (!t) return { launched: false, reason: "term hook unavailable" };
    t.run("ros2 run rviz2 rviz2");
    return { launched: true };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, "rviz-view.png"), fullPage: true });
  const state: any = await page.evaluate(() => {
    const r: any = window.__ros2lab;
    const safe = (fn: () => any) => { try { return fn(); } catch (e: any) { return { captureError: String(e) }; } };
    const plain = (value: any) => {
      try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
    };
    const topicList = r.topics ? Array.from(r.topics as any[]).map((t: any) => plain(t)) : undefined;
    const graph = r.sh?.graph;
    const publications = plain((window as any).__ros2labPub || {});
    const nav = r.nav2;
    const sensor = r.sensors;
    const views = (window as any).__rvizViewers || [];
    return {
      robot: r.robot,
      topics: topicList,
      qosByTopic: topicList?.map((t: any) => ({ topic: t.name, type: t.type, qos: t.qos ?? null })),
      tf: plain(r.tf),
      fixedFrame: plain(r.fixedFrame),
      params: plain(r.nodes?.map((n: any) => ({ node: n.full || n.name, params: n.params })) ?? null),
      lifecycleStates: plain(r.lifecycleStates),
      rvizStatus: plain(r.rvizStatus),
      logs: plain(r.logs), errors: plain(r.errors),
      nav2: nav ? {
        plan: plain(nav.plan), localPlan: plain(nav.localPlan),
        robotPoseHistory: plain(nav.robotPoseHistory), poseHistory: plain(nav.poseHistory),
        amclPoseHistory: plain(nav.amclPoseHistory), particleCount: nav.particleCount,
        globalCostmap: plain(nav.globalCostmap), localCostmap: plain(nav.localCostmap), costmaps: plain(nav.costmaps),
      } : undefined,
      sensors: sensor ? {
        cameraInfo: plain(sensor.cameraInfo), imageInfo: plain(sensor.imageInfo), pointCloud2: plain(sensor.pointCloud2), scan: plain(sensor.scan),
      } : undefined,
      busPublications: publications,
      rvizViewers: views.map((v: any) => safe(() => ({ fixedFrame: v.fixedFrame?.(), displays: plain(v.displays), status: plain(v.status) }))),
      graph: graph ? safe(() => ({ nodes: plain(graph.nodes), params: plain(graph.params) })) : undefined,
      visibleText: document.body.innerText,
      paneCanvases: Array.from(document.querySelectorAll("canvas")).map((c: HTMLCanvasElement, i) => ({ index: i, width: c.width, height: c.height, rect: (() => { const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })() })),
    };
  });
  fs.writeFileSync(path.join(out, "emulator-state.json"), JSON.stringify({ rvizLaunch, state }, null, 2));
  const required: Record<string, any> = {
    "topic list with types": state.topics,
    "QoS per topic": state.qosByTopic,
    "TF frames and edges with authority": state.tf,
    "Fixed Frame options and selected value": state.fixedFrame,
    "params": state.params,
    "lifecycle states": state.lifecycleStates,
    "Global Status and per-display status": state.rvizStatus,
    "user-visible logs/errors": state.logs && state.errors,
    "/plan, /local_plan, robot pose history, /amcl_pose history, particle count, costmaps": state.nav2,
    "camera_info/image/PointCloud2 samples": state.sensors,
  };
  const missing = Object.entries(required).filter(([, v]) => v === undefined || v === null).map(([k]) => `MISSING_HOOK: ${k}`);
  fs.writeFileSync(path.join(out, "notes.md"), [
    "Scenario: tb3_waffle_pi / sensors. Browser observation only; no parity conclusion.",
    "No interactions or RViz display-add actions were specified in the reference action_list.txt (empty). RViz was launched with the existing terminal hook.",
    "RViz control usability and expected bus-message checks: NOT RUN; no controls were named/touched by the scenario action list.",
    ...missing,
  ].join("\n") + "\n");
});
