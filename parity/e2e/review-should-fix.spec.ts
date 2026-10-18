import { test, expect, Page } from "@playwright/test";

// expert_review_2026-10-18 should-fix items that need the page (bash behaviour and teaching notes)
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
const screen = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n=====\n"));
const after = (s: string, cmd: string) => s.split(cmd).pop() || "";

test("shell: ; separates commands like bash", async ({ page }) => {
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => !!(window as any).__ros2lab?.term, null, { timeout: 60000 });
  await run(page, "echo a ; echo b");
  await page.waitForTimeout(500);
  const out = after(await screen(page), "echo a ; echo b").split("\n").map((l) => l.trim()).filter(Boolean);
  expect(out.slice(0, 2)).toEqual(["a", "b"]);
  await run(page, "false ; echo still");      // unlike &&, ; runs the next command after a failure
  await run(page, "echo 'x ; y'");            // quoted ; is text
  await page.waitForTimeout(500);
  const s = await screen(page);
  expect(after(s, "false ; echo still")).toContain("still");
  expect(after(s, "echo 'x ; y'").split("\n").map((l) => l.trim()).filter(Boolean)[0]).toBe("x ; y");
});

test("tb3_burger: echo of a camera topic says the Burger has no camera", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"]) await run(page, c);
  await page.waitForFunction(() => [...document.querySelectorAll(".term-screen")].some((x) => /\[create-\d+\]: process has finished cleanly/.test((x as HTMLElement).innerText)), null, { timeout: 120000 });
  await page.evaluate(() => (window as any).__ros2lab.term.newTerminal());
  await run(page, "ros2 topic echo /camera/image_raw");
  await page.waitForTimeout(1500);
  const s = after(await screen(page), "ros2 topic echo /camera/image_raw");
  expect(s).toContain("WARNING: topic [/camera/image_raw] does not appear to be published yet");
  expect(s).toMatch(/Burger has no camera/);
  expect(s).not.toMatch(/Check the spelling/);
});

// slam/samples/map_hz_runner.txt: real `ros2 topic hz /map --use-sim-time` under slam_toolbox prints average rate
// lines from window 2 (0.323 .. 0.351 there; the value depends on the real-time factor, no threshold yet)
test("tb3_burger slam_toolbox: ros2 topic hz /map reports a rate", async ({ page }) => {
  test.setTimeout(300000);
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"]) await run(page, c);
  await page.waitForFunction(() => [...document.querySelectorAll(".term-screen")].some((x) => /\[create-\d+\]: process has finished cleanly/.test((x as HTMLElement).innerText)), null, { timeout: 120000 });
  await page.evaluate(() => (window as any).__ros2lab.term.newTerminal());
  await run(page, "ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True");
  await page.waitForFunction(() => (window as any).__ros2lab.tf.edges.some((e: any) => e.parent === "map" && e.child === "odom"), null, { timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => (window as any).__ros2lab.term.newTerminal());
  await run(page, "ros2 topic hz /map --use-sim-time");
  await page.waitForTimeout(2000);
  const s = after(await screen(page), "ros2 topic hz /map --use-sim-time");
  expect(s).toMatch(/^average rate: \d+\.\d{3}$/m);
  expect(s).toMatch(/window: 2$/m);
});

// nav_robotis/readiness_deadlock_2026-10-17/excerpt.txt: without an initial pose, global_costmap gives up after
// initial_transform_timeout (60 s) of sim time (~57.6 s sim, 98 s wall there). With the simulation paused, sim time
// stops, so 70 wall seconds must not end the wait.
test("tb3_burger nav2: the initial transform timeout counts sim time, not wall time", async ({ page }) => {
  test.setTimeout(400000);
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"]) await run(page, c);
  await page.waitForFunction(() => [...document.querySelectorAll(".term-screen")].some((x) => /\[create-\d+\]: process has finished cleanly/.test((x as HTMLElement).innerText)), null, { timeout: 120000 });
  await page.evaluate(() => (window as any).__ros2lab.term.newTerminal());
  for (const c of ["cd ~/ros2_ws", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True"]) await run(page, c);
  await page.waitForFunction(() => [...document.querySelectorAll(".term-screen")].some((x) => /\[global_costmap\.global_costmap\]: Checking transform/.test((x as HTMLElement).innerText)), null, { timeout: 180000 });
  await page.evaluate(() => { (window as any).__ros2lab.sh.graph.gz.paused = true; });
  await page.waitForTimeout(70000);
  expect(await screen(page)).not.toMatch(/Failed to activate global_costmap/);
});
