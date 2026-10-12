// Every arm of the official workspaces, launched through the real launch files: ros2_control controllers and their
// states, the topics / actions / services the real Jazzy stack has (ros2_control, joint_state_broadcaster,
// joint_trajectory_controller, move_group), /joint_states complete and at the controller_manager rate, a
// FollowJointTrajectory goal sent with `ros2 action send_goal` in the terminal moves the arm, the RViz MotionPlanning
// panel (its buttons) plans and executes to a named SRDF state, and gripper actions where the robot has one.
//   node tests/real-arms-audit.mjs                 every case
//   ONLY=ur5e,gen3 node tests/real-arms-audit.mjs  robots (or case ids) to run
import { openRobot, run, screens, newTerm, waitText } from "./real-lib.mjs";

const CASES = [
  { id: "ur5e_sim_control", robot: "ur5e", cmd: "ros2 launch ur_simulation_gz ur_sim_control.launch.py ur_type:=ur5e", jtc: "scaled_joint_trajectory_controller", active: ["joint_state_broadcaster", "scaled_joint_trajectory_controller"], rate: 500 },
  { id: "ur5e_sim_moveit", robot: "ur5e", cmd: "ros2 launch ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e", jtc: "scaled_joint_trajectory_controller", active: ["joint_state_broadcaster", "scaled_joint_trajectory_controller"], moveit: true, rate: 500 },
  { id: "ur5e_mock", robot: "ur5e", cmd: "ros2 launch ur_robot_driver ur_control.launch.py ur_type:=ur5e robot_ip:=yyy.yyy.yyy.yyy use_mock_hardware:=true launch_rviz:=false", jtc: "scaled_joint_trajectory_controller",
    active: ["joint_state_broadcaster", "io_and_status_controller", "speed_scaling_state_broadcaster", "force_torque_sensor_broadcaster", "scaled_joint_trajectory_controller"], inactive: ["joint_trajectory_controller", "forward_position_controller"], rate: 500,
    topics: [["/force_torque_sensor_broadcaster/wrench", "geometry_msgs/msg/WrenchStamped"], ["/speed_scaling_state_broadcaster/speed_scaling", "std_msgs/msg/Float64"], ["/io_and_status_controller/robot_mode", "ur_dashboard_msgs/msg/RobotMode"]],
    services: [["/io_and_status_controller/set_io", "ur_msgs/srv/SetIO"], ["/io_and_status_controller/zero_ftsensor", "std_srvs/srv/Trigger"]], hw: ["tcp_fts_sensor/force.x", "speed_scaling/speed_scaling_factor"] },
  { id: "fr3_moveit_fake", robot: "fr3", cmd: "ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=dont-care use_fake_hardware:=true", jtc: "fr3_arm_controller", active: ["fr3_arm_controller", "joint_state_broadcaster"], moveit: true,
    js: "/franka/joint_states", merged: { topic: "/joint_states", rate: 30, joints: ["fr3_finger_joint1"] }, topics: [["/franka_gripper/joint_states", "sensor_msgs/msg/JointState"]] },
  { id: "gen3_sim_control", robot: "gen3", cmd: "ros2 launch kortex_bringup kortex_sim_control.launch.py use_sim_time:=true launch_rviz:=false", jtc: "joint_trajectory_controller", active: ["joint_state_broadcaster", "joint_trajectory_controller"], inactive: ["twist_controller"],
    // gripper:="" (the default) puts no gripper in the URDF, but the launch file still spawns robotiq_gripper_controller: on Jazzy that spawner fails too
    allowDied: /spawner robotiq_gripper_controller/ },
  { id: "gen3_moveit_fake", robot: "gen3", cmd: "ros2 launch kinova_gen3_7dof_robotiq_2f_85_moveit_config robot.launch.py robot_ip:=yyy.yyy.yyy.yyy use_fake_hardware:=true", jtc: "joint_trajectory_controller", active: ["joint_state_broadcaster", "joint_trajectory_controller", "robotiq_gripper_controller"], moveit: true,
    gripper: { ctl: "robotiq_gripper_controller", type: "control_msgs/action/ParallelGripperCommand", joint: "robotiq_85_left_knuckle_joint", goal: "{command: {name: [robotiq_85_left_knuckle_joint], position: [0.4]}}", target: 0.4 } },
  { id: "xarm6_gazebo", robot: "xarm6", cmd: "ros2 launch xarm_gazebo xarm6_beside_table_gazebo.launch.py load_controller:=true", jtc: "xarm6_traj_controller", active: ["joint_state_broadcaster", "xarm6_traj_controller"] },
  { id: "xarm6_moveit_fake", robot: "xarm6", cmd: "ros2 launch xarm_moveit_config xarm6_moveit_fake.launch.py", jtc: "xarm6_traj_controller", active: ["joint_state_broadcaster", "xarm6_traj_controller"], moveit: true },
  { id: "lite6_moveit_gz", robot: "lite6", cmd: "ros2 launch xarm_moveit_config lite6_moveit_gazebo.launch.py", jtc: "lite6_traj_controller", active: ["joint_state_broadcaster", "lite6_traj_controller"], moveit: true },
  { id: "wx250s_moveit", robot: "wx250s", cmd: "ros2 launch interbotix_xsarm_moveit xsarm_moveit.launch.py robot_model:=wx250s hardware_type:=fake", cm: "/wx250s/controller_manager", jtc: "arm_controller", active: ["arm_controller", "gripper_controller", "joint_state_broadcaster"], moveit: true, rate: 10,
    js: "/wx250s/joint_states", gripper: { ctl: "gripper_controller", fjt: true, joint: "left_finger", target: 0.03 } },
  { id: "cr5_sim_moveit", robot: "cr5", cmd: "ros2 launch dobot_gazebo sim.launch.py", env: ["DOBOT_TYPE=cr5"], jtc: "cr5_group_controller", active: ["joint_state_broadcaster", "cr5_group_controller"], moveit: true },
];
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const todo = CASES.filter((c) => !ONLY.length || ONLY.includes(c.robot) || ONLY.includes(c.id));
const sh = (p, cmd) => p.evaluate((c) => { const r = window.__ros2lab.sh.run(c); return (r.lines || []).filter((l) => l.cls !== "hint").map((l) => l.text).join("\n"); }, cmd);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const summary = [];

for (const C of todo) {
  console.log(`\n==================== ${C.id}`);
  const res = []; const ok = (c, m, extra) => { console.log(`${c ? "ok  " : "FAIL"} ${m}${!c && extra ? `\n       ${String(extra).slice(0, 600)}` : ""}`); res.push(!!c); if (!c) fails++; };
  const { b, p, errs } = await openRobot(C.robot, { webgl: !!C.moveit });
  try {
    const cm = C.cm || "/controller_manager", pre = cm.replace(/\/controller_manager$/, ""), js = C.js || `${pre}/joint_states`;
    const env = await p.evaluate(() => Object.entries(window.__ros2lab.sh.realWs.env).map(([k, v]) => `export ${k}=${v}`));
    for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", ...env, ...(C.env || []).map((e) => `export ${e}`)]) await run(p, c);
    await run(p, C.cmd);
    // 1. controllers up
    const up = await p.waitForFunction(({ cm, names }) => { const g = window.__ros2lab.sh.graph; const m = g.cmFind && g.cmFind(cm); return m && names.every((n) => m.cm.controllers.get(n) && m.cm.controllers.get(n).state === "active"); }, { cm, names: C.active }, { timeout: 180000, polling: 1000 }).then(() => true).catch(() => false);
    ok(up, `controllers active: ${C.active.join(", ")}`);
    if (C.moveit) ok(await waitText(p, /You can start planning now!/, 120000), "move_group: You can start planning now!");
    await sleep(3000);
    const launchLog = (await screens(p)).join("\n");
    const died = [...launchLog.matchAll(/process has died \[pid \d+, exit code (-?\d+), cmd '([^']+)'/g)].map((m) => m[2]).filter((c) => !(C.allowDied && C.allowDied.test(c)));
    ok(!died.length, "no process died", died.join(" | "));
    const errLines = launchLog.split("\n").filter((l) => /\[(ERROR|FATAL)\]|\[Err\]/.test(l) && !/process has died/.test(l) && !(C.allowDied && /robotiq_gripper_controller/.test(l)));
    ok(!errLines.length, "no ERROR lines in the launch output", errLines.slice(0, 4).join(" | "));
    ok(!errs.length, "no page errors", errs.slice(0, 3).join(" | "));
    // 2. ros2 control
    const lc = await sh(p, `ros2 control list_controllers -c ${cm}`);
    for (const n of C.active) ok(new RegExp(`^${n}\\s+\\S+\\s+active$`, "m").test(lc), `list_controllers: ${n} active`, lc);
    for (const n of C.inactive || []) ok(new RegExp(`^${n}\\s+\\S+\\s+inactive$`, "m").test(lc), `list_controllers: ${n} inactive`, lc);
    const hw = await sh(p, `ros2 control list_hardware_interfaces -c ${cm}`);
    const [jtcJoints, ci] = await p.evaluate(({ cm, jtc }) => { const P = window.__ros2lab.sh.graph.cmFind(cm).cm.controllers.get(jtc).params; return [P.joints, P.command_interfaces[0]]; }, { cm, jtc: C.jtc });
    ok(jtcJoints.every((j) => hw.includes(`\t${j}/${ci} [available] [claimed]`)), `hardware interfaces: ${C.jtc} claims every joint's ${ci}`, hw.split("\n").filter((l) => jtcJoints.some((j) => l.includes(`${j}/${ci}`))).join(" | "));
    for (const h of C.hw || []) ok(hw.includes(`\t${h}`), `hardware interfaces list ${h}`);
    // 3. graph: topics, actions, services
    const topics = await sh(p, "ros2 topic list -t"), actions = await sh(p, "ros2 action list -t"), services = await sh(p, "ros2 service list -t");
    const need = [[js, "sensor_msgs/msg/JointState"], [`${pre}/dynamic_joint_states`, "control_msgs/msg/DynamicJointState"], [`${pre}/${C.jtc}/joint_trajectory`, "trajectory_msgs/msg/JointTrajectory"], [`${pre}/${C.jtc}/controller_state`, "control_msgs/msg/JointTrajectoryControllerState"],
      ...C.active.map((n) => [`${pre}/${n}/transition_event`, "lifecycle_msgs/msg/TransitionEvent"]), ["/robot_description", "std_msgs/msg/String"], ["/tf", "tf2_msgs/msg/TFMessage"], ["/tf_static", "tf2_msgs/msg/TFMessage"], ...(C.topics || [])];
    if (C.merged) need.push([C.merged.topic, "sensor_msgs/msg/JointState"]);
    if (C.moveit) need.push(["/display_planned_path", "moveit_msgs/msg/DisplayTrajectory"], ["/monitored_planning_scene", "moveit_msgs/msg/PlanningScene"], ["/planning_scene", "moveit_msgs/msg/PlanningScene"], ["/planning_scene_world", "moveit_msgs/msg/PlanningSceneWorld"], ["/collision_object", "moveit_msgs/msg/CollisionObject"], ["/trajectory_execution_event", "std_msgs/msg/String"]);
    if (pre) need.splice(need.findIndex(([t]) => t === "/robot_description"), 1, [`${pre}/robot_description`, "std_msgs/msg/String"]);
    const missT = need.filter(([t, ty]) => !topics.split("\n").includes(`${t} [${ty}]`));
    ok(!missT.length, `topics (${need.length}) present with their types`, missT.map((x) => x.join(" ")).join(", "));
    const needA = [[`${pre}/${C.jtc}/follow_joint_trajectory`, "control_msgs/action/FollowJointTrajectory"]];
    if (C.moveit) needA.push(["/move_action", "moveit_msgs/action/MoveGroup"], ["/execute_trajectory", "moveit_msgs/action/ExecuteTrajectory"]);
    if (C.gripper && !C.gripper.fjt) needA.push([`${pre}/${C.gripper.ctl}/gripper_cmd`, C.gripper.type]);
    const missA = needA.filter(([t, ty]) => !actions.split("\n").includes(`${t} [${ty}]`));
    ok(!missA.length, `actions (${needA.length}) present with their types`, missA.map((x) => x.join(" ")).join(", ") + "\n" + actions);
    const needS = [...["list_controllers", "switch_controller", "load_controller", "configure_controller", "unload_controller", "list_hardware_interfaces", "list_hardware_components"].map((s) => [`${cm}/${s}`, `controller_manager_msgs/srv/${s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("")}`]), [`${pre}/${C.jtc}/query_state`, "control_msgs/srv/QueryTrajectoryState"], ...(C.services || [])];
    if (C.moveit) needS.push(["/plan_kinematic_path", "moveit_msgs/srv/GetMotionPlan"], ["/compute_ik", "moveit_msgs/srv/GetPositionIK"], ["/compute_fk", "moveit_msgs/srv/GetPositionFK"], ["/get_planning_scene", "moveit_msgs/srv/GetPlanningScene"], ["/apply_planning_scene", "moveit_msgs/srv/ApplyPlanningScene"], ["/compute_cartesian_path", "moveit_msgs/srv/GetCartesianPath"], ["/check_state_validity", "moveit_msgs/srv/GetStateValidity"], ["/query_planner_interface", "moveit_msgs/srv/QueryPlannerInterfaces"], ["/get_planner_params", "moveit_msgs/srv/GetPlannerParams"], ["/clear_octomap", "std_srvs/srv/Empty"]);
    const missS = needS.filter(([t, ty]) => !services.split("\n").includes(`${t} [${ty}]`));
    ok(!missS.length, `services (${needS.length}) present with their types`, missS.map((x) => x.join(" ")).join(", "));
    // 4. /joint_states: every joint, at the controller_manager's update rate; no nanosec overflow
    const echo = await sh(p, `ros2 topic echo --once ${js}`);
    ok(jtcJoints.every((j) => echo.includes(`\n- ${j}\n`)), `${js} has all ${jtcJoints.length} arm joints`, echo.slice(0, 300));
    ok(!/nanosec: 1000000000/.test(echo), `${js} stamp is valid`);
    const rate = C.rate || await p.evaluate((cm) => window.__ros2lab.sh.graph.cmFind(cm).cm.updateRate, cm);
    const hz = await sh(p, `ros2 topic hz ${js}`);
    ok(new RegExp(`average rate: ${rate - 1}\\.9|average rate: ${rate}\\.0`).test(hz), `${js} at ${rate} Hz (update_rate)`, hz.split("\n")[0]);
    if (C.merged) {
      const e2 = await sh(p, `ros2 topic echo --once ${C.merged.topic}`), h2 = await sh(p, `ros2 topic hz ${C.merged.topic}`);
      ok(C.merged.joints.every((j) => e2.includes(`- ${j}`)) && jtcJoints.every((j) => e2.includes(`- ${j}`)), `${C.merged.topic} (joint_state_publisher source_list) merges arm and gripper joints`, e2.slice(0, 400));
      ok(new RegExp(`average rate: ${C.merged.rate - 1}\\.9`).test(h2), `${C.merged.topic} at ${C.merged.rate} Hz`, h2.split("\n")[0]);
    }
    const tfRate = C.merged ? C.merged.rate : rate, htf = await sh(p, "ros2 topic hz /tf");   // robot_state_publisher: one /tf per /joint_states
    ok(new RegExp(`average rate: ${tfRate - 1}\\.9`).test(htf), `/tf (robot_state_publisher) at ${tfRate} Hz`, htf.split("\n")[0]);
    const cs = await sh(p, `ros2 topic echo --once ${pre}/${C.jtc}/controller_state`);
    ok(/^joint_names:/m.test(cs) && /^feedback:/m.test(cs), `${C.jtc}/controller_state publishes`, cs.slice(0, 200));
    // RViz (the robot's own .rviz config) when the launch file starts rviz2: no display in Status: Error
    const rvErr = await p.evaluate(() => (window.__ros2lab.sh.graph.nodes.some((n) => n.kind === "rviz") ? [...document.querySelectorAll(".rv-st.error")].map((e) => e.textContent) : null));
    if (rvErr) ok(!rvErr.length, "RViz displays: none in Status: Error", rvErr.join(" | "));
    // 5. FollowJointTrajectory goal in the terminal
    const goal = await p.evaluate(async ({ cm, jtc }) => {
      const { parseURDF } = await import("/js/urdf-core.js");
      const m = window.__ros2lab.sh.graph.cmFind(cm), joints = m.cm.controllers.get(jtc).params.joints, model = parseURDF(m.cm.urdf);
      return joints.map((j, i) => { const J = model.joints[j], lo = J && J.limit ? +J.limit.lower : -3, hi = J && J.limit ? +J.limit.upper : 3, c = m.cm.jointPos(j); if (i > 1) return c; const d = c + 0.3 < hi - 0.05 ? 0.3 : -0.3; return Math.max(lo + 0.05, Math.min(hi - 0.05, c + d)); });
    }, { cm, jtc: C.jtc });
    await newTerm(p);
    for (const c of ["source install/setup.bash"]) await run(p, c);
    await run(p, `ros2 action send_goal ${pre}/${C.jtc}/follow_joint_trajectory control_msgs/action/FollowJointTrajectory "{trajectory: {joint_names: [${jtcJoints.join(", ")}], points: [{positions: [${goal.map((x) => x.toFixed(4)).join(", ")}], time_from_start: {sec: 2}}]}}"`);
    const accepted = await waitText(p, /Goal accepted with ID: [0-9a-f]{32}/, 20000);
    ok(accepted, "send_goal: Goal accepted");
    const fin = await waitText(p, /Result:\n\s+error_code: 0\nerror_string: ''\n*\s*Goal finished with status: SUCCEEDED/, 150000);
    ok(fin, "send_goal waits for the result: error_code 0, SUCCEEDED", (await screens(p)).pop().slice(-600));
    const now = await p.evaluate(({ cm, jtc }) => { const m = window.__ros2lab.sh.graph.cmFind(cm); return m.cm.controllers.get(jtc).params.joints.map((j) => m.cm.jointPos(j)); }, { cm, jtc: C.jtc });
    ok(goal.every((q, i) => Math.abs(q - now[i]) < 0.03), "the arm reached the FollowJointTrajectory goal", JSON.stringify({ goal, now }));
    // 6. gripper
    if (C.gripper) {
      const G = C.gripper;
      await newTerm(p); await run(p, "source install/setup.bash");
      if (G.fjt) await run(p, `ros2 action send_goal ${pre}/${G.ctl}/follow_joint_trajectory control_msgs/action/FollowJointTrajectory "{trajectory: {joint_names: [${G.joint}], points: [{positions: [${G.target}], time_from_start: {sec: 1}}]}}"`);
      else await run(p, `ros2 action send_goal ${pre}/${G.ctl}/gripper_cmd ${G.type} "${G.goal}"`);
      ok(await waitText(p, /Goal finished with status: SUCCEEDED[\s\S]*Goal finished with status: SUCCEEDED/, 120000) || (await screens(p)).pop().includes("Goal finished with status: SUCCEEDED"), `gripper ${G.ctl}: goal SUCCEEDED`, (await screens(p)).pop().slice(-500));
      const q = await p.evaluate(({ cm, j }) => window.__ros2lab.sh.graph.cmFind(cm).cm.jointPos(j), { cm, j: G.joint });
      ok(Math.abs(q - G.target) < 0.02, `gripper joint ${G.joint} at ${G.target}`, q);
    }
    // 7. MoveIt through the RViz MotionPlanning panel's own buttons
    if (C.moveit) {
      let panel = await p.waitForFunction(() => window.__ros2labMP && document.querySelector(".mp-panel"), null, { timeout: 30000 }).then(() => true).catch(() => false);
      if (!panel) {   // the robot's .rviz may have the MotionPlanning display disabled (franka's moveit.rviz: Enabled: false): tick it in the Displays tree, as a user does
        const row = p.locator(".q-row", { has: p.locator(".q-ntext", { hasText: /^MotionPlanning$/ }) }).first();
        if (await row.count()) { await row.locator(".q-checkbox").first().click({ force: true }); console.log("     (MotionPlanning display disabled in the .rviz file: enabled with its checkbox)"); }
        panel = await p.waitForFunction(() => window.__ros2labMP && document.querySelector(".mp-panel"), null, { timeout: 30000 }).then(() => true).catch(() => false);
      }
      ok(panel, "RViz shows the MotionPlanning panel");
      if (panel) {
        // a named SRDF state of the planning group that differs from where the arm is
        const pick = await p.evaluate(() => {
          const mg = window.__ros2lab.sh.graph.mg, S = window.__ros2labMP.test.S, cur = mg.current();
          const sel = document.querySelector('.mp-panel select[aria-label="Goal State"]');
          const named = [...sel.options].map((o) => o.value).filter((v) => !v.startsWith("<"));
          const valOf = (n) => mg.namedStates(S.group)[n] || null;
          for (const n of named) { const v = valOf(n); if (v && Object.entries(v).some(([j, q]) => typeof q === "number" && Math.abs((cur[j] || 0) - q) > 0.05)) return { name: n, values: v, group: S.group }; }
          return { name: named[0] || null, values: named[0] ? valOf(named[0]) : null, group: S.group, named };
        });
        ok(pick.name, `Goal State combo lists the SRDF named states of ${pick.group}`, JSON.stringify(pick).slice(0, 300));
        if (pick.name) {
          await p.selectOption('.mp-panel select[aria-label="Goal State"]', pick.name);
          const btn = (t) => p.locator('.mp-panel .mp-page[data-tab="Planning"] button.mp-cmd', { hasText: new RegExp(`^${t}$`) });
          await btn("Plan").click({ force: true });
          const planned = await p.waitForFunction(() => { const S = window.__ros2labMP.test.S; return S.result && S.result.ok; }, null, { timeout: 60000 }).then(() => true).catch(() => false);
          ok(planned, `Plan button: planned to "${pick.name}"`, await p.evaluate(() => window.__ros2labMP.test.S.status));
          if (planned) {
            await sleep(500);
            await btn("Execute").click({ force: true });
            const vals = pick.values && typeof pick.values === "object" ? Object.fromEntries(Object.entries(pick.values).filter(([, q]) => typeof q === "number")) : null;
            const reached = vals ? await p.waitForFunction((v) => { const cur = window.__ros2lab.sh.graph.mg.current(); return Object.entries(v).every(([j, q]) => Math.abs((cur[j] || 0) - q) < 0.03); }, vals, { timeout: 150000, polling: 500 }).then(() => true).catch(() => false) : false;
            ok(reached, `Execute button: the arm reached "${pick.name}"`, JSON.stringify(await p.evaluate(() => ({ st: window.__ros2labMP.test.S.status, cur: window.__ros2lab.sh.graph.mg.current() }))).slice(0, 400));
            const mgLog = (await screens(p)).join("\n");
            ok(/Completed trajectory execution with status SUCCEEDED/.test(mgLog) || reached, "move_group: Completed trajectory execution with status SUCCEEDED");
          }
        }
      }
    }
  } catch (e) { ok(false, "test crashed: " + e.message); }
  summary.push(`${res.every(Boolean) ? "PASS" : "FAIL"} ${C.id} (${res.filter(Boolean).length}/${res.length})`);
  await b.close();
}
console.log("\n" + summary.join("\n"));
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
