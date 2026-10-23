import { test, expect, Page } from "@playwright/test";

// Night 1, Part 1: a robot that is under test (public/robots/index.json "status") never starts a simulation on the
// site. The other specs open under-test robots on purpose (playwright.config.ts storageState); this one does not.
test.use({ storageState: { cookies: [], origins: [] } });

const nodes = (page: Page) => page.evaluate(() => { const g = (window as any).__ros2lab?.sh?.graph; return g && Array.isArray(g.nodes) ? g.nodes.map((n: any) => n.full) : []; });
const screen = (page: Page) => page.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n"));
const gzOn = (page: Page) => page.evaluate(() => { const g = (window as any).__ros2lab?.sh?.graph; return !!(g && typeof g.gzRunning === "function" && g.gzRunning()); });

for (const [id, cmd] of [
  ["fr3", "ros2 launch franka_gazebo_bringup visualize_franka_robot.launch.py"],   // an official workspace
  ["arm3", "ros2 launch arm3_description display.launch.py"],                      // a ROS2Lab gallery package
] as const) {
  test(`${id} (under test): ROS2Lab notice, Launch disabled, no simulation starts`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`/rviz.html?robot=${id}`);
    const note = page.locator("#under-test-note");
    await expect(note).toBeVisible({ timeout: 30000 });
    await expect(note).toHaveText(/^ROS2Lab: .+ is under test\. Its simulation is switched off/);
    await expect(note).toHaveClass(/rvp-unval/);                                      // the "Not yet validated" lock style
    expect(await note.evaluate((n) => !!n.closest(".term-screen"))).toBe(false);     // a page message, not terminal output
    await expect(page.locator("#go")).toBeDisabled();
    await expect(page.locator("#real-entries button:enabled")).toHaveCount(0);
    await expect(page.locator("[data-badges]")).toContainText("Under test");
    // the terminal says it in ROS2Lab's own (parenthesised) words, never as a ROS log line
    await expect.poll(() => screen(page), { timeout: 15000 }).toMatch(/\(ROS2Lab: .+ is under test/);
    expect(await screen(page)).not.toMatch(/\[(INFO|WARN|ERROR)\][^\n]*under test/);
    // nothing to launch: the workspace is not loaded, and typing the launch starts nothing
    expect(await page.evaluate(() => !!(window as any).__ros2lab?.sh?.realWs)).toBe(false);
    await page.locator("#go").click({ force: true }).catch(() => {});
    await page.evaluate((c) => (window as any).__ros2lab.term.run(c), cmd);
    await page.waitForTimeout(6000);
    expect(await gzOn(page)).toBe(false);
    expect(await nodes(page)).toEqual([]);
    expect(await screen(page)).not.toMatch(/process started with pid/);
  });
}

test("tb3_waffle (active, legacy): Legacy label, launch buttons enabled", async ({ page }) => {
  await page.goto("/rviz.html?robot=tb3_waffle");
  await expect(page.locator("[data-badges]")).toContainText("Legacy", { timeout: 30000 });
  await expect(page.locator("#under-test-note")).toHaveCount(0);
  await expect(page.locator("#real-entries button").first()).toBeEnabled();
});

test("an entry under test (workspace.json status): its button is disabled and starts nothing", async ({ page }) => {
  test.setTimeout(90000);
  await page.route("**/robots/ws/turtlebot3/workspace.json", async (route) => {
    const r = await route.fetch(); const ws = await r.json();
    ws.entry.sim[1].status = "under_test"; ws.entry.sim[1].status_reason = "test";   // Gazebo: empty world
    await route.fulfill({ response: r, json: ws });
  });
  await page.goto("/rviz.html?robot=tb3_burger");
  const b = page.locator("#real-entries button", { hasText: "empty_world.launch.py" });
  await expect(b).toBeDisabled({ timeout: 30000 });
  await expect(b).toContainText("Under test: launching is switched off");
  await expect(page.locator("#real-entries button", { hasText: "turtlebot3_world.launch.py" })).toBeEnabled();
  await b.click({ force: true }).catch(() => {});
  await page.waitForTimeout(4000);
  expect(await screen(page)).not.toMatch(/empty_world\.launch\.py/);
  expect(await gzOn(page)).toBe(false);
});

test("robot.html: under-test and legacy notices", async ({ page }) => {
  await page.goto("/robot.html?id=spot");
  await expect(page.locator(".rbwarn")).toContainText("switched off");
  await expect(page.locator(".rbinfo .st-test")).toHaveText("Under test");
  await page.goto("/robot.html?id=tb3_waffle");
  await expect(page.locator(".rbinfo .st-legacy")).toHaveText("Legacy");
  await page.goto("/robot.html?id=tb3_burger");
  await expect(page.locator(".rbinfo .st-ok")).toHaveText("Course robot");
  await expect(page.locator(".rbwarn")).toHaveCount(0);
});
