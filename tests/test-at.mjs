import { openRobot, run } from "./real-lib.mjs";

const { b, p } = await openRobot("tb3_burger");

for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]) {
  await run(p, c);
}

const check = await p.evaluate(() => {
  const sh = window.__ros2lab.sh;
  const path = "/home/student/ros2_ws/install/turtlebot3_gazebo/share/turtlebot3_gazebo/models/turtlebot3_common/meshes/bases/burger_base.stl";
  const n = sh.node(path);
  const at = (c) => { const m = String(c ?? "").match(/^@url:(.+)$/); return m ? m[1] : null; };
  return {
    nodeFound: !!n,
    type: n?.type,
    content: n?.content,
    atVal: at(n?.content),
  };
});

console.log("Check:", JSON.stringify(check, null, 2));

await b.close();
process.exit(0);
