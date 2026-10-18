import { test, expect } from "@playwright/test";

// expert_review_2026-10-18 must-fix 1: the waffle_pi page loads its official workspace like burger and waffle.
test("tb3_waffle_pi page loads the official workspace, robot card and files", async ({ page }) => {
  const missing: string[] = [];
  page.on("response", (r) => { if (r.status() === 404 && r.url().startsWith("http://127.0.0.1:8000/")) missing.push(r.url()); });
  await page.goto("/rviz.html?robot=tb3_waffle_pi");
  await expect(page.locator("body")).toContainText("Loading the official ROS 2 Jazzy workspace of TurtleBot3 Waffle Pi", { timeout: 30000 });
  // either the official workspace card appears or the page reports that it could not load it
  await page.waitForFunction(() => !(document.getElementById("real-card") as HTMLElement)?.hidden || document.body.innerText.includes("could not load"), null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("could not load");
  expect(await page.locator("#pkg-about").innerText()).not.toMatch(/undefined/);
  expect(text).toContain("ros2 launch turtlebot3_gazebo");
  expect(missing).toEqual([]);
});
