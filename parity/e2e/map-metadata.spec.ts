import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FIX, openWorld, prepTerm, run, screens, topicInfo, waitText } from "./fixtures/lib";

// Phase 1 item 5: slam_toolbox publishes /map_metadata RELIABLE + TRANSIENT_LOCAL, and `ros2 topic echo
// /map_metadata --once` receives a message (parity/fixtures/tb3_burger/slam_map_metadata/, domain 41).
const DIR = path.join(FIX, "tb3_burger", "slam_map_metadata");

test("slam_toolbox: ros2 topic echo /map_metadata --once receives the latched message", async ({ page }) => {
  test.setTimeout(300000);
  const real = fs.readFileSync(path.join(DIR, "echo_map_metadata_once.txt"), "utf8");
  const info = topicInfo(path.join(DIR, "topic_info_map_metadata.txt"));
  const pub = info.endpoints.find((e) => e.kind === "PUBLISHER")!;
  expect(await openWorld(page, "tb3_burger")).toBe(true);
  await prepTerm(page, "tb3_burger");
  await run(page, "ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True");
  await page.waitForFunction(() => (window as any).__ros2lab.tf.edges.some((e: any) => e.parent === "map" && e.child === "odom"), null, { timeout: 90000 });
  await page.waitForTimeout(6000);   // past slam_toolbox's first map update (map_update_interval)
  await prepTerm(page, "tb3_burger");
  await run(page, "ros2 topic info /map_metadata -v");
  await waitText(page, /Durability: \w+[\s\S]*Subscription count/, 10000);
  const tinfo = (await screens(page)).split("ros2 topic info /map_metadata -v").pop() || "";
  expect(tinfo).toContain(`Node name: ${pub.node}`);
  expect(tinfo).toContain(`Reliability: ${pub.reliability}`);
  expect(tinfo).toContain(`Durability: ${pub.durability}`);
  await run(page, "ros2 topic echo /map_metadata --once");
  await waitText(page, /ros2 topic echo \/map_metadata --once[\s\S]*(---|Nobody is publishing)/, 30000);
  const echo = (await screens(page)).split("ros2 topic echo /map_metadata --once").pop() || "";
  expect(echo).not.toContain("Nobody is publishing");
  // same message fields as the real echo (the values depend on how much of the world has been mapped)
  const keys = (t: string) => t.split("\n").filter((l) => /^\s*\w+:/.test(l) && !/^#/.test(l)).map((l) => l.split(":")[0]);
  expect(keys(echo.split("\n---")[0])).toEqual(keys(real.split("\n---")[0]));
  const res = real.match(/^resolution: .+$/m)![0];   // slam_toolbox resolution 0.05 as a float32
  expect(echo.split("\n").map((l) => l.trim())).toContain(res);
});
