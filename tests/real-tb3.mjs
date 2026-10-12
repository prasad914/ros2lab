// TurtleBot3 Burger from the official ROBOTIS jazzy workspace: colcon build, the REAL turtlebot3_world.launch.py
// through the real launch system, Gazebo world + model.sdf, bridge, then driving with turtlebot3_teleop.
import { openRobot, run, screens, newTerm, waitText } from "./real-lib.mjs";
const { b, p, errs } = await openRobot("tb3_burger");
let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"]) await run(p, c);
let s = (await screens(p)).join("\n");
ok(/Finished <<< turtlebot3_gazebo/.test(s), "colcon build built turtlebot3_gazebo");
await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
ok(await waitText(p, /\[create-\d\]: process has finished cleanly/, 90000), "create spawned the robot and exited");
s = (await screens(p)).join("\n");
console.log(s.split("\n").filter((l) => /launch|process|ros_gz|Creating|ERROR|Err|create|parameter_bridge/.test(l)).slice(0, 40).join("\n"));
const st = await p.evaluate(() => { const g = window.__ros2lab.sh.graph; return { gz: !!g.gz, world: g.gz && g.gz.world.name, models: g.gz ? [...g.gz.models.keys()] : [], nodes: g.nodes.map((n) => n.full), pose: g.gz && [...g.gz.models.values()][0] && [...g.gz.models.values()][0].pose }; });
console.log(JSON.stringify(st));
ok(st.world === "default" || !!st.world, "Gazebo runs the world");
ok(st.models.includes("burger"), "the burger model is in Gazebo");
// drive: turtlebot3_teleop in a new terminal
await newTerm(p);
for (const c of ["cd ~/ros2_ws", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger", "ros2 run turtlebot3_teleop teleop_keyboard"]) await run(p, c);
await p.waitForTimeout(800);
const x0 = await p.evaluate(() => [...window.__ros2lab.sh.graph.gz.models.values()][0].pose.x);
await p.keyboard.press("w"); for (let i = 0; i < 15; i++) await p.keyboard.press("w");
await p.waitForTimeout(4000);
const x1 = await p.evaluate(() => [...window.__ros2lab.sh.graph.gz.models.values()][0].pose.x);
console.log("x", x0, "->", x1);
ok(x1 > x0 + 0.1, "teleop_keyboard (w) drives the burger forward");
s = (await screens(p)).join("\n=====\n");
ok(/Control Your TurtleBot3!/.test(s), "teleop banner");
ok(/currently:\tlinear velocity 0.1/.test(s) || /currently:/.test(s), "teleop prints the velocity");
console.log("ERRS", errs.slice(0, 5));
console.log(fails ? `${fails} failed` : "all passed");
await b.close();
process.exit(fails ? 1 : 0);
