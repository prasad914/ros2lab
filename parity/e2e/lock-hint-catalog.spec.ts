import { test, expect, Page } from "@playwright/test";

// expert_review_robots_2026-10-18 site-wide #4: the license-lock hint names the workspace's own sim / mock commands
// (not sim.launch.py / gazebo.launch.py / demo.launch.py, which most workspaces do not have); site-wide #7: the
// catalog says "Gazebo ..." only for robots whose page has a Gazebo simulation (not Scout, Crazyflie).
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
const screen = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n=====\n"));
for (const [robot, cmd, want] of [
  ["ur5e", "ros2 launch ur_robot_driver ur5e.launch.py robot_ip:=192.168.56.101", "ros2 launch ur_simulation_gz ur_sim_control.launch.py ur_type:=ur5e"],
  ["scout", "ros2 launch scout_base scout_mini_base.launch.py", "ros2 launch scout_description"],
]) {
  test(`lock hint on ${robot} names this page's commands`, async ({ page }) => {
    test.setTimeout(240000);
    await page.goto(`/rviz.html?robot=${robot}`);
    await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
    for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", cmd]) await run(page, c);
    await page.waitForFunction(() => /real hardware is locked/.test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), null, { timeout: 150000 });
    const s = await screen(page);
    expect(s).toContain(want);
    expect(s).not.toMatch(/sim\.launch\.py \/ gazebo\.launch\.py \/ demo\.launch\.py/);
  });
}
test("catalog: Gazebo badges only for robots whose page has Gazebo", async ({ page }) => {
  await page.goto("/rviz.html");
  await page.waitForFunction(() => document.querySelectorAll(".cat-card[data-id=scout] .cat-facts li").length > 0, null, { timeout: 60000 });
  const facts = (id: string) => page.$$eval(`.cat-card[data-id=${id}] .cat-facts li`, (l) => l.map((x) => x.textContent || ""));
  for (const id of ["scout", "crazyflie", "wx250s"]) expect((await facts(id)).filter((f) => /Gazebo/.test(f))).toEqual([]);
  expect(await facts("tb3_burger")).toContain("Gazebo sensors");
  expect(await facts("ur5e")).toContain("Gazebo + ros2_control");
  expect(await facts("gen3")).toContain("Gazebo + ros2_control");
});
// Phase 1 item 2: keyboard_velmux_launch.py includes crazyflie launch.py with the default backend cpp (the real
// Crazyradio, crazyflie/launch/launch.py:127), so the lock hint must not offer it, and its card button is a locked
// real-hardware button.
test("crazyflie: the lock hint does not offer keyboard_velmux_launch.py; its card button needs the real radio", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/rviz.html?robot=crazyflie");
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  const btn = page.locator("#real-card button", { hasText: "keyboard_velmux_launch.py" });
  await expect(btn).toHaveCount(1);
  await expect(btn).toHaveClass(/btn-hw/);
  await expect(btn).toContainText(/real radio \(cpp backend\)/);
  await expect(btn).toContainText(/locked/);
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "ros2 launch crazyflie_examples keyboard_velmux_launch.py"]) await run(page, c);
  await page.waitForFunction(() => /real hardware is locked/.test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), null, { timeout: 150000 });
  await page.waitForTimeout(1500);
  const hint = (await screen(page)).split("\n").filter((l) => /need no license/.test(l));
  expect(hint.length).toBeGreaterThan(0);
  for (const l of hint) { expect(l).not.toContain("keyboard_velmux_launch.py"); expect(l).toContain("backend:=sim"); }
  // the card button goes through the license gate like the other real-hardware buttons
  await btn.click();
  await expect(page.locator(".term-screen").last()).toContainText("(Real hardware:", { timeout: 5000 });
});
