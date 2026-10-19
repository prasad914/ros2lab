import { test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const root = "/home/prasad/ros2lab-course/parity/browser_out/tb3_burger/p9-round2";
const scenarios = [
  { name: "sensors", commands: ["ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"] },
  { name: "slam", commands: ["ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py", "ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True"] },
  { name: "cartographer", commands: ["ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py", "ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True"] },
  { name: "nav_robotis", commands: ["ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py", "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True"] },
  { name: "nav2_bringup", commands: ["ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py", "ros2 launch nav2_bringup bringup_launch.py use_sim_time:=True"] },
];
test("P9 browser observations for tb3_burger scenarios", async ({ browser }) => {
  test.setTimeout(300000);
  for (const scenario of scenarios) {
    const out = path.join(root, scenario.name);
    await fs.mkdir(out, { recursive: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    let blocker: string | null = null;
    try {
      await page.goto("/rviz.html?robot=tb3_burger");
      await page.waitForFunction(() => !!window.__ros2lab?.term, { timeout: 12000 });
      for (const command of scenario.commands) {
        await page.evaluate((cmd) => window.__ros2lab.term.run(cmd), command);
        await page.waitForTimeout(3500);
      }
      await page.evaluate(() => window.__ros2lab.term.run("ros2 run rviz2 rviz2"));
      await page.waitForTimeout(2500);
    } catch (e) { blocker = e instanceof Error ? e.message : String(e); }
    const snapshot = await page.evaluate(() => {
      const r: any = window.__ros2lab;
      const safe = (x: any) => { try { return JSON.parse(JSON.stringify(x)); } catch { return x === undefined ? undefined : String(x); } };
      const viewer = (window as any).__rvizViewers?.[0];
      let displays: any[] = []; try { displays = viewer?.displays?.() || []; } catch {}
      const rvizElements = displays.map((d: any) => ({ name: d.name, type: d.type, enabled: d.enabled, status: d.status }));
      return {
        capturedAt: new Date().toISOString(),
        topics: safe(r?.topics), qosPerTopic: safe(r?.topics?.map((t: any) => ({ topic: t.name, type: t.type, qos: t.qos }))),
        tf: safe(r?.tf), fixedFrame: safe(r?.fixedFrame), params: safe(r?.nodes?.map((n: any) => ({ name: n.full || n.name, namespace: n.namespace, params: n.params }))),
        lifecycleStates: safe(r?.lifecycleStates), globalStatus: safe(r?.globalStatus), rvizStatus: safe(r?.rvizStatus), rvizElements,
        logs: safe(r?.logs), errors: safe(r?.errors), nav2: safe(r?.nav2), sensors: safe(r?.sensors),
        publishedMessages: safe((window as any).__ros2labPub), simulator: safe(r?.simulator),
        canvases: [...document.querySelectorAll("canvas")].map((c: any) => ({ width: c.width, height: c.height, id: c.id, className: c.className })),
        rvizViewerCount: (window as any).__rvizViewers?.length ?? 0,
      };
    }).catch(() => ({} as any));
    const missing = ["topics", "topics[].qos", "tf", "fixedFrame", "nodes[].params", "lifecycleStates", "globalStatus", "rvizStatus", "logs", "errors", "nav2.plan", "nav2.localPlan", "nav2.robotPoseHistory", "nav2.amclPoseHistory", "nav2.particleCount", "nav2.globalCostmap", "nav2.localCostmap", "sensors.cameraInfo", "sensors.imageInfo", "sensors.pointCloud2"]
      .filter(k => { const v = k.split(".").reduce((a: any, p) => a?.[p], snapshot); return v === undefined; });
    await fs.writeFile(path.join(out, "snapshot.json"), JSON.stringify({ blocker, ...snapshot }, null, 2));
    await fs.writeFile(path.join(out, "browser-errors.json"), JSON.stringify(errors, null, 2));
    await fs.writeFile(path.join(out, "notes.md"), [
      `Scenario: ${scenario.name}. Commands: ${scenario.commands.join("; ")}; then RViz launch.`,
      ...(blocker ? [`Browser launch blocker (observed): ${blocker}`] : []),
      ...missing.map(k => `MISSING_HOOK: ${k}`),
      `RViz viewer count: ${snapshot.rvizViewerCount ?? "unavailable"}. Controls touched by the scenario were not programmatically activated; element-level click-trial/message checks and pose-state comparison were unavailable in this capture.`,
    ].join("\n") + "\n");
    await page.screenshot({ path: path.join(out, "screenshot-full.png"), fullPage: true }).catch(() => {});
    const canvases = page.locator("canvas");
    for (let i = 0; i < await canvases.count(); i++) await canvases.nth(i).screenshot({ path: path.join(out, `pane-${i}.png`) }).catch(() => {});
    await page.close();
  }
});
declare global { interface Window { __ros2lab: any; } }
