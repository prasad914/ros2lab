import { test, expect, Page } from "@playwright/test";

// expert_review_2026-10-18 should-fix: view_frames file name was always frames_2026-10-12_09.30.00. Real
// (tb3_burger/sensors/view_frames.log): four stamped lines "Listening to tf data for 5.0 seconds...",
// "Generating graph...", "Result:...", "Exporting graph in frames_<local time>.pdf file...".
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
test("view_frames: file name from the local time, the real four log lines", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"]) await run(page, c);
  await page.waitForFunction(() => [...document.querySelectorAll(".term-screen")].some((x) => /\[create-\d+\]: process has finished cleanly/.test((x as HTMLElement).innerText)), null, { timeout: 120000 });
  await page.evaluate(() => (window as any).__ros2lab.term.newTerminal());
  const before = await page.evaluate(() => { const d = new Date(), z = (v: number) => String(v).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; });
  await run(page, "ros2 run tf2_tools view_frames");
  await page.waitForTimeout(8000);
  const s = (await page.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n"))).split("ros2 run tf2_tools view_frames").pop()!;
  const L = s.split("\n").filter((l) => /\[view_frames\]/.test(l));
  expect(L.map((l) => l.replace(/^\[INFO\] \[\d+\.\d{9}\] \[view_frames\]: /, "").replace(/^Result:.*/, "Result:").replace(/frames_\S+\.pdf/, "frames_X.pdf"))).toEqual(
    ["Listening to tf data for 5.0 seconds...", "Generating graph...", "Result:", "Exporting graph in frames_X.pdf file..."]);
  const name = (L[3].match(/frames_(\S+)\.pdf/) || [])[1] || "";
  expect(name).toMatch(new RegExp(`^${before}_\\d{2}\\.\\d{2}\\.\\d{2}$`));
  const files: string[] = await page.evaluate(() => [...(window as any).__ros2lab.sh.fs.keys()].filter((k: string) => /frames_.*\.gv$/.test(k)));
  expect(files.some((f) => f.endsWith(`frames_${name}.gv`))).toBe(true);
});
