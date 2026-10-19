import { openRobot, run, newTerm, waitText } from "./real-lib.mjs";

const { b, p, errs } = await openRobot("tb3_burger");
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? "ok  " : "FAIL"} ${m}`);
  if (!c) fails++;
};

const pre = ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", "export TURTLEBOT3_MODEL=burger"];
for (const c of pre) await run(p, c);

console.log("--- 1. Launching Gazebo turtlebot3_world ---");
await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
ok(await waitText(p, /\[create-\d\]: process has finished cleanly/, 90000), "Gazebo spawned turtlebot3 burger in world");

const gzModels = await p.evaluate(() => {
  const gz = window.__ros2lab?.sh?.graph?.gz;
  return gz ? [...gz.models.keys()] : [];
});
ok(gzModels.includes("burger"), "burger model registered in Gazebo simulation");

console.log("--- 2. Launching Cartographer SLAM ---");
await newTerm(p);
for (const c of pre.slice(2)) await run(p, c);
await run(p, "ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True");
ok(await waitText(p, /cartographer_occupancy_grid_node-\d\]: process started/, 60000), "Cartographer started");

await p.waitForTimeout(4000);

// Check RViz displays and robot visibility
const rvizState = await p.evaluate(() => {
  const viewers = window.__rvizViewers || [];
  const v = viewers[0];
  if (!v) return { hasViewer: false };
  const st = v.state();
  const hudButtons = [...document.querySelectorAll(".rv-hud-btn")].map(b => ({
    text: b.textContent,
    active: b.classList.contains("active")
  }));
  return {
    hasViewer: true,
    viewType: v.viewType(),
    displays: st.displayList.map(d => ({ type: d.type, name: d.name, enabled: d.enabled })),
    hudButtons
  };
});

console.log("RViz State during SLAM:", JSON.stringify(rvizState, null, 2));
ok(rvizState.hasViewer, "RViz viewer instance active");
ok(rvizState.displays.some(d => d.type === "RobotModel" && d.enabled), "RobotModel display is present and enabled during Cartographer SLAM");

// Test switching camera view via HUD
console.log("--- 3. Testing 3D Orbit / 2D Top View HUD ---");
const initialView = await p.evaluate(() => window.__rvizViewers[0]?.viewType());
console.log("Initial view type:", initialView);

// Click 3D Orbit button
await p.evaluate(() => {
  const btn3d = [...document.querySelectorAll(".rv-hud-btn")].find(b => b.textContent.includes("3D"));
  if (btn3d) btn3d.click();
});
await p.waitForTimeout(500);

const viewAfter3D = await p.evaluate(() => window.__rvizViewers[0]?.viewType());
console.log("View after clicking 3D:", viewAfter3D);
ok(viewAfter3D === "Orbit", "HUD successfully switched RViz camera to 3D Orbit");

// Click 2D Top button
await p.evaluate(() => {
  const btn2d = [...document.querySelectorAll(".rv-hud-btn")].find(b => b.textContent.includes("2D"));
  if (btn2d) btn2d.click();
});
await p.waitForTimeout(500);

const viewAfter2D = await p.evaluate(() => window.__rvizViewers[0]?.viewType());
console.log("View after clicking 2D:", viewAfter2D);
ok(viewAfter2D === "TopDownOrtho", "HUD successfully switched RViz camera to 2D TopDownOrtho");

console.log("ERRS:", errs.slice(0, 5));
console.log(fails ? `${fails} failed` : "all tests passed!");

await b.close();
process.exit(fails ? 1 : 0);
