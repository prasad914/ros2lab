import { test, expect } from "@playwright/test";

// RViz property tree: one plain mouse click on a value opens its editor, and the editor stays open. Before the fix the
// pointerdown and the click that follows both opened an editor; the second replaced the first, whose blur committed and
// repainted the tree, so the editor vanished (XT5 task 8 / RV1 task 5 ask the student to click the empty Description
// Topic value of a RobotModel and choose /robot_description; parity/reports/FIX_V2.md part 2).
test("a single click on an RViz property value keeps its editor open", async ({ page }) => {
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => typeof window !== "undefined" && !!(window as any).__ros2lab?.term);
  await page.evaluate(() => (window as any).__ros2lab.term.run("ros2 run rviz2 rviz2"));
  const cell = page.locator('.q-row[data-path="g/Frame Rate"] .q-c1').first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await cell.click();
  await page.waitForTimeout(500);
  await expect(page.locator('.q-row[data-path="g/Frame Rate"] .q-c1 input.q-editor').first()).toBeVisible();
});
