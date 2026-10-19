import { test, expect, Page } from "@playwright/test";

// bash runs `a && ros2 launch …` / `a ; ros2 launch …` as: a, then the launch (the launch only if a worked with &&).
// The site shell ran a and then dropped the launch without a word (OVERNIGHT_2026-10-19 owner list).
const LAUNCH = "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py";
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
const screen = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n=====\n"));
const started = (p: Page) => p.waitForFunction(() => /\[INFO\] \[launch\]: All log files can be found below/.test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), null, { timeout: 90000 });
async function open(page: Page, setup: string[]) {
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", ...setup]) await run(page, c);
}
const env = (p: Page, k: string) => p.evaluate((k) => (window as any).__ros2lab.sh.env[k], k);

test("export X && ros2 launch: the model is exported and the launch starts", async ({ page }) => {
  test.setTimeout(180000);
  await open(page, ["source install/setup.bash", "unset TURTLEBOT3_MODEL"]);
  await run(page, `export TURTLEBOT3_MODEL=burger && ${LAUNCH}`);
  await started(page);
  expect(await env(page, "TURTLEBOT3_MODEL")).toBe("burger");
});

test("source install/setup.bash && ros2 launch: the launch starts", async ({ page }) => {
  test.setTimeout(180000);
  await open(page, ["export TURTLEBOT3_MODEL=burger"]);
  await run(page, `source install/setup.bash && ${LAUNCH}`);
  await started(page);
});

test("cd ~/ros2_ws && ros2 launch: cd happens and the launch starts", async ({ page }) => {
  test.setTimeout(180000);
  await open(page, ["source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "cd ~"]);
  await run(page, `cd ~/ros2_ws && ${LAUNCH}`);
  await started(page);
  expect(await page.evaluate(() => (window as any).__ros2lab.sh.cwd)).toBe("/home/student/ros2_ws");
});

test("cd /nonexistent && ros2 launch: the cd error, nothing started", async ({ page }) => {
  test.setTimeout(180000);
  await open(page, ["source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]);
  await run(page, `cd /nonexistent && ${LAUNCH}`);
  await page.waitForTimeout(5000);
  const s = await screen(page);
  expect(s).toContain("bash: cd: /nonexistent: No such file or directory");
  expect(s).not.toMatch(/\[INFO\] \[launch\]/);
  expect(await page.evaluate(() => (window as any).__ros2lab.sh.graph.nodes.map((n: any) => n.full))).not.toContain("/robot_state_publisher");
});

test("export A=1 ; ros2 launch: A is exported and the launch starts", async ({ page }) => {
  test.setTimeout(180000);
  await open(page, ["source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]);
  await run(page, `export A=1 ; ${LAUNCH}`);
  await started(page);
  expect(await env(page, "A")).toBe("1");
});
