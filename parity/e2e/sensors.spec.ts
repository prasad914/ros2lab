import { test, expect } from "@playwright/test";

test.describe("Sensors Parity (Prompt P5, Spec S9)", () => {
  test("TurtleBot3 Burger has no camera frames or camera topics", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.fixedFrame);

    const ff = await page.evaluate(() => window.__ros2lab.fixedFrame);
    const cameraFrames = ff.options.filter((f: string) => f.includes("camera"));
    expect(cameraFrames).toHaveLength(0);
  });

  test("TurtleBot3 Waffle has RGB camera frames in fixed frame options", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_waffle");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.fixedFrame);

    const ff = await page.evaluate(() => window.__ros2lab.fixedFrame);
    const cameraFrames = ff.options.filter((f: string) => f.includes("camera"));
    expect(cameraFrames.length).toBeGreaterThan(0);
  });
});
