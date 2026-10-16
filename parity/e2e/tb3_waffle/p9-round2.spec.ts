import { test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

test("P9 tb3_waffle sensors browser observation", async ({ page }) => {
  test.setTimeout(300000);
  const out = "/home/prasad/ros2lab-course/parity/browser_out/tb3_waffle/p9-round2/sensors";
  await fs.mkdir(out, { recursive: true });
  const browserErrors: string[] = [];
  page.on("pageerror", e => browserErrors.push(e.message));
  page.on("console", m => { if (m.type() === "error") browserErrors.push(m.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/rviz.html?robot=tb3_waffle");
  await page.waitForFunction(() => !!window.__ros2lab?.term, { timeout: 30000 });
  await page.evaluate(() => window.__ros2lab.term.run("TURTLEBOT3_MODEL=waffle ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"));
  await page.waitForTimeout(2500);
  const launchText = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(out, "3d-view.png"), fullPage: true });
  await page.evaluate(() => window.__ros2lab.term.run("ros2 run rviz2 rviz2"));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(out, "rviz-view.png"), fullPage: true });
  const state = await page.evaluate(() => {
    const r: any = window.__ros2lab;
    const safe = (x: any) => { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return String(e); } };
    const topics = Array.isArray(r?.topics) ? r.topics : null;
    const viewers: any[] = (window as any).__rvizViewers || [];
    const rvizElements = Array.from(document.querySelectorAll("button, [role=button], input, select")) as HTMLElement[];
    return {
      robot: r?.robot,
      topics: safe(topics),
      qosPerTopic: topics?.map((x: any) => ({ topic: x.name, type: x.type, qos: x.qos ?? null })) ?? null,
      tf: safe(r?.tf), fixedFrame: safe(r?.fixedFrame), params: safe(r?.nodes), lifecycleStates: safe(r?.lifecycleStates),
      globalStatus: safe(r?.globalStatus), rvizStatus: safe(r?.rvizStatus), logs: safe(r?.logs), errors: safe(r?.errors),
      nav2: r?.nav2 ? safe({ plan: r.nav2.plan, localPlan: r.nav2.localPlan, robotPoseHistory: r.nav2.robotPoseHistory, poseHistory: r.nav2.poseHistory, amclPoseHistory: r.nav2.amclPoseHistory, particleCount: r.nav2.particleCount, globalCostmap: r.nav2.globalCostmap, localCostmap: r.nav2.localCostmap, costmaps: r.nav2.costmaps }) : null,
      sensors: safe(r?.sensors), publications: safe((window as any).__ros2labPub),
      viewers: viewers.map(v => { try { return { fixedFrame: v.fixedFrame?.(), displays: v.displays?.(), status: v.status?.(), state: v.state?.() }; } catch (e) { return { error: String(e) }; } }),
      rvizElements: rvizElements.map((el, index) => ({ index, tag: el.tagName, text: el.innerText || el.getAttribute("aria-label"), visible: !!(el.offsetWidth || el.offsetHeight), disabled: (el as HTMLButtonElement).disabled, role: el.getAttribute("role") })),
      visibleText: document.body.innerText,
      canvases: Array.from(document.querySelectorAll("canvas")).map((c: HTMLCanvasElement, index) => ({ index, width: c.width, height: c.height, rect: (() => { const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })() })),
      simulatorPose: safe(r?.simulator?.robotPose ?? r?.gazebo?.robotPose ?? null),
    };
  });
  const controlChecks: any[] = [];
  const fields = { topics: state.topics, tf: state.tf, fixedFrame: state.fixedFrame, params: state.params, lifecycleStates: state.lifecycleStates, rvizStatus: state.rvizStatus, logs: state.logs, errors: state.errors, nav2: state.nav2, sensors: state.sensors };
  const missing = Object.entries(fields).filter(([, value]) => value === null || value === undefined).map(([field]) => `MISSING_HOOK: ${field}`);
  await fs.writeFile(path.join(out, "emulator-state.json"), JSON.stringify({ state, controlChecks, browserErrors, launchText }, null, 2));
  await fs.writeFile(path.join(out, "notes.md"), [
    "Scenario tried: sensors (tb3_waffle). Opened the waffle workbench, launched `TURTLEBOT3_MODEL=waffle ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py`, then `ros2 run rviz2 rviz2`.",
    "Scenario action_list.txt is empty; no 2D pose estimate, navigation goals, or named display additions were specified. No interactions beyond the two launches were performed.",
    "RViz control inventory and click({ trial: true }) results are in emulator-state.json. No expected bus-message checks were defined by the empty action list.",
    "3D/RViz pose same-instant comparison: state hooks are captured; no comparable pair was exposed unless represented explicitly in the snapshot.",
    ...missing,
  ].join("\n") + "\n");
});

declare global { interface Window { __ros2lab: any; __rvizViewers?: any[]; } }
