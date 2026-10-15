import { openRobot, run } from "./real-lib.mjs";

const { b, p, errs } = await openRobot("tb3_burger");

for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]) {
  await run(p, c);
}

await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
await p.waitForFunction(() => {
  const g = window.__ros2lab?.sh?.graph;
  return g && g.gz && g.gz.models && g.gz.models.has("burger");
}, { timeout: 30000 });
await p.waitForTimeout(3000);

const inspect = await p.evaluate(() => {
  const sh = window.__ros2lab.sh;
  const g = sh.graph;
  const burger = g.gz.models.get("burger");
  
  // Let's find gzs
  // How is gzs exposed or can we inspect the Three.js scene?
  // Let's look at window.__ros2lab
  const gzWin = document.querySelector(".gz-win");
  
  return {
    burgerModel: {
      name: burger.name,
      pose: burger.pose,
      modelKeys: Object.keys(burger.model),
      links: Object.keys(burger.model.links).map(lk => {
        const l = burger.model.links[lk];
        return {
          name: lk,
          visuals: l.visuals.map(v => ({
            geom: v.geom,
            origin: v.origin,
            material: v.material
          }))
        };
      })
    }
  };
});

console.log("Burger inspection:", JSON.stringify(inspect, null, 2));

await b.close();
process.exit(0);
