// Step F: sensors scenario (turtlebot3_world.launch.py only) against parity/fixtures/<robot>/sensors/.
import { test } from "@playwright/test";
import path from "node:path";
import { FIX, ROBOTS, Recorder, compareGraph, exists, framesFile, gvEdges, lastScreen, openWorld, siteState, topicList, yaml } from "./lib";

for (const robot of ROBOTS) {
  test(`${robot} sensors: graph, QoS, TF, sensors, camera`, async ({ page }) => {
    test.setTimeout(240000);
    const dir = path.join(FIX, robot, "sensors"), rec = new Recorder(robot, "sensors");
    try {
      const up = await openWorld(page, robot);
      rec.exact("turtlebot3_world.launch.py spawns the robot", true, up, path.join(dir, "run_info.txt"), undefined, up ? undefined : `site terminal: ${lastScreen}`);
      await page.waitForTimeout(3000);
      const site = await siteState(page);
      compareGraph(rec, site, dir);

      const gv = framesFile(dir);
      if (gv) {
        const exp = gvEdges(gv), act = site.edges;
        rec.exact("TF edges", exp, act, gv);
      } else rec.pending("TF edges", "no frames_*.gv", dir);

      // which sensors the model has: from the fixture's topic list
      const tl = path.join(dir, "topic_list.txt"), names = topicList(tl).map((t) => t.name);
      const siteNames = site.topics.map((t) => t.name);
      for (const [sensor, topic] of [["lidar", "/scan"], ["IMU", "/imu"], ["camera", "/camera/image_raw"], ["camera_info", "/camera/camera_info"]]) {
        rec.exact(`${sensor} present (${topic})`, names.includes(topic), siteNames.includes(topic), tl);
      }

      const ci = path.join(dir, "samples", "camera_info.yaml"), ih = path.join(dir, "samples", "image_raw_header.yaml");
      if (exists(ci)) {
        const c = yaml(ci), s = site.sensors.cameraInfo;
        rec.exact("camera_info width x height", [c.width, c.height], s ? [s.width, s.height] : null, ci);
        rec.exact("camera_info frame_id", c.header.frame_id, s ? s.frame : null, ci);
        rec.numeric("camera_info K", c.k, s ? s.K : null, ci);
      } else if (!names.includes("/camera/camera_info")) {
        rec.exact("no camera_info (model has no camera)", null, site.sensors.cameraInfo, tl);
      }
      if (exists(ih)) {
        const h = yaml(ih), s = site.sensors.imageInfo;
        rec.exact("image_raw width x height", [h.width, h.height], s ? [s.width, s.height] : null, ih);
        rec.exact("image_raw encoding", h.encoding, s ? s.encoding : null, ih);
        rec.exact("image_raw frame_id", h.header.frame_id, s ? s.frame : null, ih);
      }
    } finally { rec.save(); }
  });
}
