// Night 2, Part 3: `ros2 run turtlebot3_gazebo turtlebot3_drive` in turtlebot3_world, against the real capture
// parity/fixtures/tb3_jazzy_v3/<robot>/world/motion/ (capture_world.sh): the node publishes geometry_msgs/msg/Twist on
// /cmd_vel, the bridge subscribes TwistStamped, so `ros2 topic info -v /cmd_vel` lists both types and the robot does not
// move (Gazebo pose unchanged: burger 0.000 m); Ctrl+C prints the node's "terminated" line.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { FIX, exists, openWorld, prepTerm, run, screens, text, topicInfo, waitText } from "./fixtures/lib";

const robot = "tb3_burger";
const dir = path.join(FIX, "tb3_jazzy_v3", robot, "world", "motion");
const pose = (p: any) => p.evaluate(() => { const m = [...(window as any).__ros2lab.sh.graph.gz.models.values()][0]; return { x: m.pose.x, y: m.pose.y, yaw: m.pose.yaw }; });

test(`${robot}: turtlebot3_drive publishes Twist, the TwistStamped bridge ignores it, the robot stays`, async ({ page }) => {
  test.setTimeout(300000);
  expect(await openWorld(page, robot)).toBe(true);
  await page.waitForTimeout(3000);
  const before = await pose(page);
  await prepTerm(page, robot);
  await run(page, "ros2 run turtlebot3_gazebo turtlebot3_drive");
  expect(await waitText(page, /\[turtlebot3_drive_node\]: Turtlebot3 simulation node has been initialised/, 30000)).toBe(true);
  await page.waitForTimeout(8000);
  const after = await pose(page);
  // real: drive_pose_before.txt / drive_pose_after.txt identical (moved 0.000 m)
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.005);

  // ros2 topic info -v /cmd_vel while it runs (drive_cmd_vel_info_v.txt)
  await prepTerm(page, robot);
  await run(page, "ros2 topic info -v /cmd_vel");
  await page.waitForTimeout(2500);
  const s = await screens(page), last = s.split("\n=====\n").pop() || "";
  const f = path.join(dir, "drive_cmd_vel_info_v.txt");
  expect(exists(f)).toBe(true);
  const real = text(f), typeLine = real.split("\n")[0];
  expect(last).toContain(typeLine);   // Type: ['geometry_msgs/msg/Twist', 'geometry_msgs/msg/TwistStamped']
  const info = topicInfo(f);
  for (const e of info.endpoints) {
    expect(last).toContain(`Node name: ${e.node}`);
    expect(last).toContain(`Endpoint type: ${e.kind}`);
  }
  for (const ty of real.matchAll(/^Topic type: (.+)$/gm)) expect(last).toContain(`Topic type: ${ty[1]}`);
  expect(last).toMatch(/Publisher count: 1/);
  expect(last).toMatch(/Subscription count: 1/);

  // Ctrl+C in the drive terminal (drive_terminal.txt: signal_handler, then "terminated")
  await page.evaluate(() => (window as any).__ros2lab.term.select && (window as any).__ros2lab.term.select(1));
  const term = page.locator(".term-screen").nth(1);
  await term.click();
  await page.keyboard.press("Control+c");
  expect(await waitText(page, /\[turtlebot3_drive_node\]: Turtlebot3 simulation node has been terminated/, 10000)).toBe(true);
});
