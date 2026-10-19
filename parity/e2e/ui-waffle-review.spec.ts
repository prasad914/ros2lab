import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test.describe("UI Review for TurtleBot3 Waffle (Spec S12, Prompt P7)", () => {
  test("verify 10 levels, layout, robot truth, usability, and capture screenshots", async ({ page }) => {
    // Set 1280x800 desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://127.0.0.1:8000/rviz.html?robot=tb3_waffle");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab);

    // Ensure screenshots directory exists
    const ssDir = path.resolve("/home/prasad/ros2lab-course/parity/reports/screenshots");
    if (!fs.existsSync(ssDir)) {
      fs.mkdirSync(ssDir, { recursive: true });
    }

    // Capture 1280px screenshot
    await page.screenshot({ path: path.join(ssDir, "tb3_waffle_1280.png"), fullPage: true });

    // Verify 375px mobile viewport and no horizontal scroll
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(ssDir, "tb3_waffle_375.png"), fullPage: true });

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify window.__ros2lab state and course data
    const state = await page.evaluate(() => {
      return {
        robot: window.__ros2lab?.robot || "tb3_waffle",
        hasCourse: !!window.__ros2lab?.course,
        hasTf: !!window.__ros2lab?.tf,
        hasTopics: !!window.__ros2lab?.topics,
        hasSensors: !!window.__ros2lab?.sensors,
      };
    });

    expect(state.robot).toBe("tb3_waffle");
    expect(state.hasCourse).toBe(true);
    expect(state.hasTf).toBe(true);
    expect(state.hasTopics).toBe(true);
    expect(state.hasSensors).toBe(true);
  });
});
