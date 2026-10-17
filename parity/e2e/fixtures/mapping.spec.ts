// Step F: slam (slam_toolbox online_async) and cartographer scenarios against parity/fixtures/<robot>/<scenario>/.
// Commands as in parity/scripts/start_reference.sh (slam / cartographer cases).
import { test } from "@playwright/test";
import path from "node:path";
import { FIX, ROBOTS, Recorder, compareGraph, framesFile, gvEdges, lastScreen, openWorld, prepTerm, run, siteState, topicList } from "./lib";

const SCEN: Record<string, string> = {
  slam: "ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True",
  cartographer: "ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True",
};

for (const scenario of Object.keys(SCEN)) {
  for (const robot of ROBOTS) {
    test(`${robot} ${scenario}: graph, QoS, TF`, async ({ page }) => {
      test.setTimeout(300000);
      const dir = path.join(FIX, robot, scenario), rec = new Recorder(robot, scenario);
      try {
        const up = await openWorld(page, robot);
        rec.exact("turtlebot3_world.launch.py spawns the robot", true, up, path.join(dir, "run_info.txt"), undefined, up ? undefined : `site terminal: ${lastScreen}`);
        await prepTerm(page, robot);
        await run(page, SCEN[scenario]);
        // the map frame exists once the SLAM node has processed scans (as when the reference snapshot was taken)
        await page.waitForFunction(() => (window as any).__ros2lab.tf.edges.some((e: any) => e.parent === "map" && e.child === "odom"), null, { timeout: 90000 }).catch(() => {});
        await page.waitForTimeout(5000);
        const site = await siteState(page);
        compareGraph(rec, site, dir);
        const gv = framesFile(dir);
        if (gv) rec.exact("TF edges", gvEdges(gv), site.edges, gv); else rec.pending("TF edges", "no frames_*.gv", dir);
        if (scenario === "slam") {
          const tl = path.join(dir, "topic_list.txt");
          rec.exact("/map_updates absent with slam_toolbox", topicList(tl).some((t) => t.name === "/map_updates"),
            site.topics.some((t) => t.name === "/map_updates"), tl);
        }
      } finally { rec.save(); }
    });
  }
}
