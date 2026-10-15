import { openRobot, run } from "./real-lib.mjs";

const { b, p } = await openRobot("tb3_burger");

for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]) {
  await run(p, c);
}

await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
await p.waitForFunction(() => {
  const g = window.__ros2lab?.sh?.graph;
  return g && g.procInfos && g.procInfos["ros_gz_sim create"];
}, { timeout: 30000 });

const envs = await p.evaluate(() => {
  const g = window.__ros2lab.sh.graph;
  const createInfo = g.procInfos["ros_gz_sim create"];
  const gzInfo = Object.entries(g.procInfos).find(([k]) => k.includes("gz"));
  return {
    createInfoEnv: createInfo ? createInfo.env : null,
    createInfoCmd: createInfo ? createInfo.cmd : null,
    gzEnv: g.gz ? g.gz.env : null,
  };
});

console.log("Process envs:", JSON.stringify(envs, null, 2));

await b.close();
process.exit(0);
