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

test("ls -l shows a binary file's real size (a saved map.pgm is not 31 bytes)", async ({ page }) => {
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => !!(window as any).__ros2lab?.term, null, { timeout: 60000 });
  await page.evaluate(() => { const sh = (window as any).__ros2lab.sh; sh.fs.set("/home/student/m.pgm", { type: "f", mode: "rw-r--r--", content: "(binary PGM image, 1234 bytes)", bytes: new Uint8Array(1234) }); });
  await run(page, "ls -l ~/m.pgm");
  await page.waitForTimeout(500);
  expect(after(await screen(page), "ls -l ~/m.pgm")).toMatch(/ 1234 .*m\.pgm/);
});
