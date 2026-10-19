import { test, expect, Page } from "@playwright/test";

// expert_review_robots_2026-10-18 TB4 #1-#3: nav2_bringup's TurtleBot 4 demo launches are not modelled. Instead of a
// made-up spawn failure ("unknown command line flag 'robot_namespace'", exit code 255) the terminal says so honestly
// and starts nothing (same rule as tb3_simulation_launch.py, expert_review_2026-10-18 must-fix 6).
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
const screen = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n=====\n"));
for (const cmd of ["ros2 launch nav2_bringup tb4_simulation_launch.py headless:=True", "ros2 launch nav2_bringup tb4_loopback_simulation.launch.py"]) {
  test(`honest note: ${cmd}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
    for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", cmd]) await run(page, c);
    await page.waitForFunction(() => /TB4 simulation is not modelled on ROS2Lab yet/.test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), null, { timeout: 90000 });
    await page.waitForTimeout(3000);
    const s = await screen(page);
    expect(s).not.toMatch(/unknown command line flag/);
    expect(s).not.toMatch(/exit code 255/);
    const nodes: string[] = await page.evaluate(() => (window as any).__ros2lab.sh.graph.nodes.map((n: any) => n.full));
    expect(nodes.filter((n) => /bt_navigator|controller_server|ros_gz_sim|loopback/.test(n))).toEqual([]);
  });
}
