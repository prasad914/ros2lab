import { openRobot, run } from "./real-lib.mjs";

const { b, p } = await openRobot("tb3_burger");

for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]) {
  await run(p, c);
}

await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
await p.waitForFunction(() => {
  const g = window.__ros2lab?.sh?.graph;
  return g && g.gz && g.gz.models && g.gz.models.has("burger");
}, { timeout: 30000 });

const res = await p.evaluate(() => {
  const sh = window.__ros2lab.sh;
  const g = sh.graph;
  const uri = "model://turtlebot3_common/meshes/bases/burger_base.stl";
  
  // Let's test the env vars
  const gzEnv = g.gz.env;
  const shEnv = sh.env.GZ_SIM_RESOURCE_PATH;
  
  // Let's test sh.node lookup for burger_base.stl across all fs
  const matchingFsKeys = [...sh.fs.keys()].filter(k => k.includes("burger_base.stl"));

  return {
    gzEnv,
    shEnv,
    matchingFsKeys,
  };
});

console.log("Resolution test:", JSON.stringify(res, null, 2));

await b.close();
process.exit(0);
