import { test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const out = "/home/prasad/ros2lab-course/parity/browser_out/tb3_burger/sensors";

test("observe tb3_burger sensors scenario", async ({ page }) => {
  await fs.mkdir(out, { recursive: true });
  const browserErrors: string[] = [];
  page.on("pageerror", e => browserErrors.push(e.message));
  page.on("console", m => { if (m.type() === "error") browserErrors.push(m.text()); });

  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => !!window.__ros2lab?.term);
  await page.evaluate(() => window.__ros2lab.term.run("ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"));
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__ros2lab.term.run("ros2 run rviz2 rviz2"));
  await page.waitForFunction(() => !!window.__rvizViewers?.length, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const snapshot = await page.evaluate(() => {
    const r = window.__ros2lab;
    const required: Record<string, boolean> = {
      topics: Array.isArray(r?.topics),
      qos: Array.isArray(r?.topics) && r.topics.every((t: any) => !!t.qos),
      tf: !!r?.tf && Array.isArray(r.tf.frames) && Array.isArray(r.tf.edges),
      fixedFrame: !!r?.fixedFrame && Array.isArray(r.fixedFrame.options),
      params: Array.isArray(r?.nodes),
      lifecycleStates: Array.isArray(r?.lifecycleStates),
      rvizStatus: !!r?.rvizStatus,
      logs: Array.isArray(r?.logs), errors: Array.isArray(r?.errors),
      nav2: !!r?.nav2,
      sensors: !!r?.sensors,
    };
    const v = window.__rvizViewers?.[0];
    let rvizDisplays: any[] = [];
    try { rvizDisplays = v?.displays?.() || []; } catch {}
    let viewerPose: any = null;
    try {
      const s = v?.state?.();
      viewerPose = s?.robotPose || s?.pose || v?.robotPose?.() || null;
    } catch {}
    return {
      required,
      topics: r?.topics?.map((t: any) => ({ name: t.name, type: t.type, publishers: t.publishers, subscribers: t.subscribers, qos: t.qos })) ?? null,
      tf: r?.tf ?? null,
      fixedFrame: r?.fixedFrame ?? null,
      params: r?.nodes?.map((n: any) => ({ name: n.name, full: n.full, namespace: n.namespace, params: n.params })) ?? null,
      lifecycleStates: r?.lifecycleStates ?? null,
      rvizStatus: r?.rvizStatus ?? null,
      logs: r?.logs ?? null,
      errors: r?.errors ?? null,
      nav2: r?.nav2 ?? null,
      sensors: r?.sensors ?? null,
      viewer: { exists: !!v, fixedFrame: (() => { try { return v?.fixedFrame?.(); } catch { return null; } })(), displays: rvizDisplays.map((d: any) => ({ name: d.name, type: d.type, enabled: d.enabled, status: d.status })), pose: viewerPose },
      // Available in the current page, if exposed by its 3D simulator.
      simulator: { robotPose: r?.simulator?.robotPose ?? r?.gazebo?.robotPose ?? null },
      canvases: [...document.querySelectorAll("canvas")].map((c: any) => ({ width: c.width, height: c.height, className: c.className, id: c.id })),
    };
  });

  const missing = Object.entries(snapshot.required).filter(([, ok]) => !ok).map(([k]) => `MISSING_HOOK: ${k}`);
  const poseCompare = "Pose-state comparison could not be completed unless simulator and RViz pose hooks expose comparable values; see snapshot.json.";
  const notes = [
    "Scenario actions: open tb3_burger workbench; launch `ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py`; launch `ros2 run rviz2 rviz2`.",
    "No seeded stochastic repeats were run; sensors is not identified as stochastic in the scenario inputs.",
    ...missing,
    ...(snapshot.viewer.exists ? [] : ["RViz viewer did not become available; no RViz control checks could be made."]),
    poseCompare,
    "Screenshots are visual evidence only; emulator state was collected through window.__ros2lab.",
  ];
  await fs.writeFile(path.join(out, "snapshot.json"), JSON.stringify(snapshot, null, 2));
  await fs.writeFile(path.join(out, "notes.md"), notes.join("\n") + "\n");
  await fs.writeFile(path.join(out, "browser-errors.json"), JSON.stringify(browserErrors, null, 2));
  await page.screenshot({ path: path.join(out, "workbench.png"), fullPage: true });
  const canvases = page.locator("canvas");
  const count = await canvases.count();
  for (let i = 0; i < count; i++) {
    await canvases.nth(i).screenshot({ path: path.join(out, `canvas-${i}.png`) }).catch(() => {});
  }
});

declare global {
  interface Window { __ros2lab: any; __rvizViewers?: any[]; }
}
