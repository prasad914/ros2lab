import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Phase 1 item 4: the /imu covariances come from the installed model.sdf noise (<stddev> 2e-4 / 1.7e-2): real ROS
// prints the float32 of stddev² on the diagonal (parity/fixtures/tb3_burger/sensors/samples/imu_runner.txt).
const FIXTURE = path.resolve(__dirname, "..", "fixtures", "tb3_burger", "sensors", "samples", "imu_runner.txt");
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
const screen = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n"));

// the nine values under each *_covariance key of one `ros2 topic echo /imu --once` message
function covariances(text: string) {
  const out: Record<string, string[]> = {};
  const lines = text.split("\n").map((l) => l.replace(/^\d+:/, ""));
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\w+_covariance):$/);
    if (m && !out[m[1]]) out[m[1]] = lines.slice(i + 1, i + 10).map((l) => l.replace(/^- /, "").trim());
  }
  return out;
}

test("tb3_burger /imu covariances match the real capture", async ({ page }) => {
  test.setTimeout(240000);
  const want = covariances(fs.readFileSync(FIXTURE, "utf8").split("\n---")[0]);
  expect(Object.keys(want)).toEqual(["orientation_covariance", "angular_velocity_covariance", "linear_acceleration_covariance"]);
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"]) await run(page, c);
  await page.waitForFunction(() => (window as any).__ros2lab.sh.graph.topics().has("/imu"), null, { timeout: 150000 });
  await page.evaluate(() => (window as any).__ros2lab.term.newTerminal());
  await run(page, "ros2 topic echo /imu --once");
  await page.waitForFunction(() => /linear_acceleration_covariance:(\n- .+){9}/.test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), null, { timeout: 30000 });
  const got = covariances((await screen(page)).split("ros2 topic echo /imu --once").pop() || "");
  expect(got).toEqual(want);
});
