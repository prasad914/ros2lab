import { openRobot, run } from "./real-lib.mjs";

const { b, p } = await openRobot("tb3_burger");

for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]) {
  await run(p, c);
}

await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_house.launch.py");
await p.waitForFunction(() => {
  const g = window.__ros2lab?.sh?.graph;
  return g && g.gz && g.gz.models && g.gz.models.has("burger");
}, { timeout: 30000 });
await p.waitForTimeout(3000);

const gzWin = await p.$(".gz-win");
if (gzWin) {
  await gzWin.screenshot({ path: "/tmp/gz_house_win.png" });
  console.log("Screenshot saved to /tmp/gz_house_win.png");
}

const houseInfo = await p.evaluate(() => {
  const sh = window.__ros2lab.sh;
  const g = sh.graph;
  return {
    world: g.gz.world.name,
    models: [...g.gz.models.keys()],
    worldModels: g.gz.world.models.map(m => m.name),
  };
});
console.log("House info:", JSON.stringify(houseInfo, null, 2));

await b.close();
process.exit(0);
