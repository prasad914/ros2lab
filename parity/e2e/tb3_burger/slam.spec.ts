import { test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const out = path.resolve("parity/browser_out/tb3_burger/slam");

test("observe tb3_burger SLAM browser state", async ({ page }) => {
  await fs.mkdir(out, { recursive: true });
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => !!window.__ros2lab?.term);

  // Match the reference scenario's Gazebo world and SLAM launch sequence.
  await page.evaluate(() => window.__ros2lab.term.run("ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"));
  await page.waitForTimeout(15000);
  await page.evaluate(() => window.__ros2lab.term.run("ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True"));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__ros2lab.term.run("ros2 run rviz2 rviz2"));
  await page.waitForTimeout(1500);

  const observation = await page.evaluate(() => {
    const r: any = window.__ros2lab;
    const nav: any = r.nav2;
    const serial = (x: any) => {
      try { return JSON.parse(JSON.stringify(x)); } catch { return String(x); }
    };
    const missing: string[] = [];
    const val = (key: string, x: any) => { if (x === undefined) missing.push(key); return serial(x); };
    const topics = r.topics;
    const rviz = r.rvizStatus;
    const sensors = r.sensors;
    const fields: Record<string, any> = {
      topics: val("topics", topics),
      qosPerTopic: val("topics[].qos", topics?.map((t: any) => ({ name: t.name, type: t.type, qos: t.qos }))),
      tf: val("tf", r.tf),
      fixedFrame: val("fixedFrame", r.fixedFrame),
      params: val("nodes[].params", r.nodes?.map((n: any) => ({ name: n.full || n.name, params: n.params }))),
      lifecycleStates: val("lifecycleStates", r.lifecycleStates),
      rvizStatus: val("rvizStatus", rviz),
      logs: val("logs", r.logs),
      errors: val("errors", r.errors),
      nav2: nav ? {
        plan: val("nav2.plan", nav.plan), localPlan: val("nav2.localPlan", nav.localPlan),
        robotPoseHistory: val("nav2.robotPoseHistory", nav.robotPoseHistory),
        poseHistory: val("nav2.poseHistory", nav.poseHistory),
        amclPoseHistory: val("nav2.amclPoseHistory", nav.amclPoseHistory),
        particleCount: val("nav2.particleCount", nav.particleCount),
        particles: val("nav2.particles", nav.particles),
        globalCostmap: val("nav2.globalCostmap", nav.globalCostmap),
        localCostmap: val("nav2.localCostmap", nav.localCostmap),
        costmaps: val("nav2.costmaps", nav.costmaps),
      } : val("nav2", nav),
      sensors: sensors ? {
        cameraInfo: val("sensors.cameraInfo", sensors.cameraInfo), imageInfo: val("sensors.imageInfo", sensors.imageInfo),
        pointCloud2: val("sensors.pointCloud2", sensors.pointCloud2), scan: val("sensors.scan", sensors.scan),
      } : val("sensors", sensors),
      publishedMessages: val("publishedMessages", (window as any).__ros2labPub),
      rvizViewerCount: (window as any).__rvizViewers?.length ?? 0,
    };
    return { capturedAt: new Date().toISOString(), fields, missingHooks: missing };
  });
  await fs.writeFile(path.join(out, "state.json"), JSON.stringify(observation, null, 2));
  const panes = await page.locator("canvas").count();
  await page.screenshot({ path: path.join(out, "screenshot-full.png"), fullPage: true });
  if (panes > 0) await page.locator("canvas").first().screenshot({ path: path.join(out, "screenshot-3d.png") });
  await fs.writeFile(path.join(out, "notes.md"), [
    "Browser-side observation for reference scenario `slam`.",
    `Canvas elements found: ${panes}. RViz viewer instances: ${observation.fields.rvizViewerCount}.`,
    ...observation.missingHooks.map((x: string) => `MISSING_HOOK: ${x}`),
  ].join("\n") + "\n");
});
