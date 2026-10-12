// TurtleBot3 + SLAM (cartographer) + map saver + Nav2 with the REAL launch files of the ROBOTIS jazzy workspace.
import { openRobot, run, screens, newTerm, waitText } from "./real-lib.mjs";
const { b, p, errs } = await openRobot("tb3_burger");
let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const pre = ["cd ~/ros2_ws", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"];
for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", ...pre.slice(1)]) await run(p, c);
await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
ok(await waitText(p, /\[create-\d\]: process has finished cleanly/, 90000), "Gazebo + robot up");
const ONLY = process.env.ONLY || "slam,nav";
if (ONLY.includes("slam")) {
  await newTerm(p); for (const c of pre) await run(p, c);
  await run(p, "ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True");
  ok(await waitText(p, /cartographer_occupancy_grid_node-\d\]: process started/, 60000), "cartographer launch started its programs");
  await p.waitForTimeout(4000);
  const known = async () => p.evaluate(() => { const g = window.__ros2lab.sh.graph, m = g.nav2 && g.nav2.maps.get("/map"); if (!m) return -1; let k = 0; for (const v of m.grid.data) if (v >= 0) k++; return k; });
  const k0 = await known();
  // drive a little (turtlebot3 teleop equivalent: a TwistStamped through the bridge)
  await p.evaluate(() => { const g = window.__ros2lab.sh.graph; g.gzTwist("/cmd_vel", { lx: 0.2, ly: 0, lz: 0, ax: 0, ay: 0, az: 0.4 }, "geometry_msgs/msg/TwistStamped"); });
  await p.waitForTimeout(8000);
  await p.evaluate(() => { const g = window.__ros2lab.sh.graph; g.gzTwist("/cmd_vel", { lx: 0, ly: 0, lz: 0, ax: 0, ay: 0, az: 0 }, "geometry_msgs/msg/TwistStamped"); });
  const k1 = await known();
  console.log("known cells", k0, "->", k1);
  ok(k0 > 0 && k1 > k0, "the cartographer map grows while the robot drives");
  await newTerm(p); for (const c of pre) await run(p, c);
  await run(p, "ros2 run nav2_map_server map_saver_cli -f ~/map");
  ok(await waitText(p, /Map saved successfully/, 30000), "map_saver_cli saved the map");
  const files = await p.evaluate(() => ["/home/student/map.yaml", "/home/student/map.pgm"].map((f) => !!window.__ros2lab.sh.node(f)));
  ok(files.every(Boolean), "~/map.yaml and ~/map.pgm exist");
}
if (ONLY.includes("nav")) {
  if (ONLY.includes("slam")) {   // like on Ubuntu: stop cartographer (Ctrl+C) before Nav2, or both publish map -> odom
    await p.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((x) => /^Ctrl\+C/.test(x.textContent)); if (b[1]) b[1].click(); });
    await p.waitForTimeout(3000);
  }
  await newTerm(p); for (const c of pre) await run(p, c);
  await run(p, "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True");
  await p.waitForTimeout(Number(process.env.NAVWAIT || 45000));
  const s = (await screens(p)).slice(-1)[0];
  console.log(s.split("\n").filter((l) => !/^\s*$/.test(l)).slice(0, 60).join("\n"));
  ok(/Starting managed nodes bringup|process started with pid/.test(s), "Nav2 launch started");
  // localize, then a goal around the pillars
  await newTerm(p); for (const c of pre) await run(p, c);
  // the initial pose where the robot really is (after SLAM it has moved): what you click with 2D Pose Estimate
  const [ix, iy, iyaw] = await p.evaluate(() => { const m = [...window.__ros2lab.sh.graph.gz.models.values()][0]; return [m.pose.x, m.pose.y, m.pose.yaw]; });
  await run(p, `ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "{header: {frame_id: map}, pose: {pose: {position: {x: ${ix.toFixed(2)}, y: ${iy.toFixed(2)}, z: 0.0}, orientation: {z: ${Math.sin(iyaw / 2).toFixed(4)}, w: ${Math.cos(iyaw / 2).toFixed(4)}}}}}"`);
  let all = "";
  for (let i = 0; i < 120; i++) { all = (await screens(p)).join("\n=====\n"); if ((all.match(/Managed nodes are active/g) || []).length >= 2) break; await p.waitForTimeout(500); }
  ok((all.match(/Managed nodes are active/g) || []).length >= 2, "Nav2: localization and navigation managers active (after the initial pose)");
  await run(p, `ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose "{pose: {header: {frame_id: map}, pose: {position: {x: 1.65, y: 0.55, z: 0.0}, orientation: {w: 1.0}}}}" --feedback`);
  ok(await waitText(p, /Goal finished with status: (SUCCEEDED|ABORTED)/, 240000), "NavigateToPose finished");
  console.log("LAST SCREEN:\n" + (await screens(p)).slice(-1)[0].split("\n").slice(-25).join("\n"));
  all = (await screens(p)).join("\n=====\n");
  console.log(all.split("\n").filter((l) => /Goal|distance_remaining|status|error_code/.test(l)).slice(-8).join("\n"));
  ok(/Goal finished with status: SUCCEEDED/.test(all), "NavigateToPose SUCCEEDED");
  const pose = await p.evaluate(() => { const m = [...window.__ros2lab.sh.graph.gz.models.values()][0]; return [m.pose.x, m.pose.y]; });
  console.log("robot at", pose);
  ok(Math.hypot(pose[0] - 1.65, pose[1] - 0.55) < 0.4, "robot reached the goal area");
}
console.log("ERRS", errs.slice(0, 5));
console.log(fails ? `${fails} failed` : "all passed");
await b.close(); process.exit(fails ? 1 : 0);
