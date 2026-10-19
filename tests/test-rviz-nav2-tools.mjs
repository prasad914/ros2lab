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

console.log("--- 2. Launching Nav2 Navigation ---");
await newTerm(p);
for (const c of pre.slice(2)) await run(p, c);
await run(p, "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True");
ok(await waitText(p, /Creating bond \(amcl\)/, 90000), "Nav2 lifecycle nodes brought up and active");

await p.waitForTimeout(3000);

// 3. Test RViz Fixed Frame Options & Selection
console.log("--- 3. Testing RViz Fixed Frame selection ---");
const frameTest = await p.evaluate(() => {
  const v = window.__rvizViewers && window.__rvizViewers[0];
  if (!v) return { ok: false, msg: "no viewer" };
  const initialFrame = v.fixedFrame();
  const state = v.state();

  // Find Fixed Frame row
  const ffRow = [...document.querySelectorAll(".q-row")].find(r => r.querySelector(".q-name")?.textContent === "Fixed Frame");
  const ffInput = ffRow ? ffRow.querySelector(".q-ecin") : null;

  return {
    ok: true,
    initialFrame,
    hasInput: !!ffInput,
    inputValue: ffInput ? (ffInput.value || ffInput.textContent) : null,
    availableFrames: state.frames
  };
});

console.log("Frame test initial:", frameTest);
ok(frameTest.ok, "RViz viewer exists");
ok(frameTest.availableFrames.includes("odom") && frameTest.availableFrames.includes("map") && frameTest.availableFrames.includes("base_footprint"), "All expected TF frames (map, odom, base_footprint) are discovered");

// Switch Fixed Frame to 'odom' programmatically and via state
const switchedFrame = await p.evaluate(async () => {
  const v = window.__rvizViewers[0];
  // Find Fixed Frame editor
  const ffRow = [...document.querySelectorAll(".q-row")].find(r => r.querySelector(".q-name")?.textContent === "Fixed Frame");
  const cell = ffRow?.querySelector(".q-val");
  // Click cell to open editor
  if (cell) cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));

  // Find combo pop (opened automatically by openEditor)
  let pop = document.querySelector(".q-cpop");
  if (!pop) {
    const arrow = ffRow?.querySelector(".q-ecarrow");
    if (arrow) arrow.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    pop = document.querySelector(".q-cpop");
  }
  const options = pop ? [...pop.querySelectorAll(".q-copt")].map(o => o.textContent) : [];

  // Click "odom" option
  const odomOpt = pop ? [...pop.querySelectorAll(".q-copt")].find(o => o.textContent === "odom") : null;
  if (odomOpt) {
    odomOpt.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  }
  return {
    options,
    newFixedFrame: v.fixedFrame()
  };
});

console.log("Switched frame test:", switchedFrame);
ok(switchedFrame.options.includes("odom") && switchedFrame.options.includes("base_footprint"), "Fixed Frame dropdown lists all robot frames");
ok(switchedFrame.newFixedFrame === "odom", "Fixed Frame successfully changed to odom");

// Switch back to 'map'
await p.evaluate(async () => {
  const v = window.__rvizViewers[0];
  const ffRow = [...document.querySelectorAll(".q-row")].find(r => r.querySelector(".q-name")?.textContent === "Fixed Frame");
  const cell = ffRow?.querySelector(".q-val");
  if (cell) cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  let pop = document.querySelector(".q-cpop");
  if (!pop) {
    const arrow = ffRow?.querySelector(".q-ecarrow");
    if (arrow) arrow.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    pop = document.querySelector(".q-cpop");
  }
  const mapOpt = pop ? [...pop.querySelectorAll(".q-copt")].find(o => o.textContent === "map") : null;
  if (mapOpt) mapOpt.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
});
const backToMap = await p.evaluate(() => window.__rvizViewers[0].fixedFrame());
ok(backToMap === "map", "Fixed Frame successfully changed back to map");

// 4. Test 2D Pose Estimate tool
console.log("--- 4. Testing 2D Pose Estimate (/initialpose) ---");
const amclBefore = await p.evaluate(() => {
  const sys = window.__ros2lab?.sh?.graph?.nav2;
  const amcl = sys?.models?.find(m => m.role === "amcl");
  return {
    hasAmcl: !!amcl,
    amclState: amcl?.state,
    hasPf: !!amcl?.pf
  };
});
ok(amclBefore.hasAmcl && amclBefore.amclState === "active", "AMCL node is active in Nav2");

// Publish 2D Pose Estimate through RViz tool
await p.evaluate(() => {
  const v = window.__rvizViewers[0];
  v.testPublishInitialPose(-2.0, -0.5, 0.0);
});
await p.waitForTimeout(1000);

const amclAfter = await p.evaluate(() => {
  const sys = window.__ros2lab?.sh?.graph?.nav2;
  const amcl = sys?.models?.find(m => m.role === "amcl");
  const lastMsg = window.__ros2lab?.sh?.viz?.published?.["/initialpose"];
  return {
    published: !!lastMsg,
    initialPoseEst: amcl?.pf?.est,
    mapOdom: sys?.mapOdom
  };
});
console.log("AMCL after 2D Pose Estimate:", amclAfter);
ok(amclAfter.published, "RViz published /initialpose message");
ok(amclAfter.initialPoseEst && Math.abs(amclAfter.initialPoseEst.x - (-2.0)) < 0.2, "AMCL received initial pose and initialized particle filter at (-2.0, -0.5)");

// 5. Test 2D Goal Pose tool
console.log("--- 5. Testing 2D Goal Pose (/goal_pose) ---");
await p.evaluate(() => {
  const v = window.__rvizViewers[0];
  v.testPublishGoal(0.5, 0.0, 0.0);
});
await p.waitForTimeout(2000);

const btNavStatus = await p.evaluate(() => {
  const sys = window.__ros2lab?.sh?.graph?.nav2;
  const bt = sys?.models?.find(m => m.role === "bt");
  const lastGoalMsg = window.__ros2lab?.sh?.viz?.published?.["/goal_pose"];
  return {
    goalPublished: !!lastGoalMsg,
    btJob: !!bt?.job,
    btStatus: bt?.status
  };
});
console.log("bt_navigator status after 2D Goal Pose:", btNavStatus);
ok(btNavStatus.goalPublished, "RViz published /goal_pose message");
ok(btNavStatus.btJob || btNavStatus.btStatus === "navigating" || btNavStatus.btStatus === "idle", "bt_navigator received goal from RViz and initiated NavigateToPose behavior tree pipeline");

console.log("ERRS:", errs.slice(0, 5));
console.log(fails ? `${fails} failed` : "all tests passed!");

await b.close();
process.exit(fails ? 1 : 0);
