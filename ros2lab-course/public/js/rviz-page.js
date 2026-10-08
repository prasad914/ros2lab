// The RViz page. RViz is started the conventional ROS 2 way, in the practice terminal:
//   colcon build -> source install/setup.bash -> ros2 launch <pkg> display.launch.py (or .launch.xml)
// The launch file runs xacro, starts robot_state_publisher, joint_state_publisher_gui and rviz2 -d display.rviz.
// Section "Connect" shows a real ROS 2 system through rosbridge instead.
import { mountTerminal } from "./terminal-sim.js";
import { gallery } from "./rviz-block.js";
import { galleryPackage, folderPackage } from "./rviz-pkg.js";
import { parseURDF, xacro } from "./urdf-core.js";
import { Rosbridge } from "./rosbridge.js";
import { convert, LIVE_TYPES, THROTTLE } from "./ros-msgs.js";
import { licenseStatus, cachedLicense, licensed, licenseMessage, requestLicense } from "./hw-license.js";

const $ = (id) => document.getElementById(id);
const WS = "~/ros2_ws";

// ---------------- the practice terminal (ROS 2 Jazzy is sourced in ~/.bashrc, like a set-up Ubuntu machine)
const term = mountTerminal($("term"), {
  title: "Terminal: ~/ros2_ws",
  intro: "",
  sourced: true, start: WS, cmds: ["colcon", "tree", "gz"], newTerminal: true, ide: true, rvizSave: "~/ros2_ws/my_config.rviz",
  // real hardware (a *_bringup or real.launch.py launch) needs the course administrator's hardware license
  hardwareGate: (robot) => { const st = cachedLicense(); return licensed(st, robot) ? { ok: true } : { ok: false, message: licenseMessage(st || { status: "unavailable" }, robot) }; },
  // a ROS 2 Jazzy desktop with Gazebo (ros-jazzy-ros-gz), teleop_twist_keyboard and the RViz IMU plugin installed
  // ... and ros2_control for Gazebo (ros-jazzy-gz-ros2-control, ros-jazzy-ros2-controllers)
  rosPkgs: ["ros_gz_sim", "ros_gz_bridge", "ros_gz_image", "teleop_twist_keyboard", "rviz_imu_plugin", "controller_manager", "gz_ros2_control", "ros2controlcli", "hardware_interface", "joint_state_broadcaster", "diff_drive_controller", "joint_trajectory_controller", "forward_command_controller", "position_controllers", "velocity_controllers",
    // MoveIt 2 (ros-jazzy-moveit + the CHOMP / STOMP / Pilz planners) and the extra ros2_controllers the robots use
    "moveit_ros_move_group", "moveit_configs_utils", "moveit_rviz_plugin", "moveit_ros_visualization", "moveit_planners_ompl", "moveit_planners_chomp", "moveit_planners_stomp", "pilz_industrial_motion_planner", "moveit_simple_controller_manager", "moveit_kinematics", "mock_components",
    "mecanum_drive_controller", "ackermann_steering_controller", "tricycle_controller",
    // MoveIt Servo, pose goals, and the tools a robot workspace uses
    "moveit_servo", "moveit_msgs", "moveit_py", "launch_param_builder", "control_msgs", "shape_msgs", "rosbridge_server", "rqt_joint_trajectory_controller", "rqt_controller_manager", "plotjuggler_ros", "nav2_bringup", "slam_toolbox",
    // the makers' drivers for the real robots (pre-installed here; real.launch.py needs a hardware license)
    "ur_robot_driver", "ur_client_library", "ur_moveit_config", "kortex_bringup", "kortex_driver", "franka_bringup", "franka_hardware", "xarm_controller", "xarm_api", "dobot_bringup_v4", "dobot_bringup", "feetech_ros2_driver",
    "interbotix_xsarm_control", "abb_bringup", "abb_hardware_interface", "kuka_rsi_driver", "fanuc_hardware_interface", "turtlebot3_bringup", "turtlebot3_node", "hls_lfcd_lds_driver", "ld08_driver", "scout_base", "spot_driver", "crazyflie", "crazyflie_examples", "unitree_api", "livox_ros_driver2"],
  fs: { dirs: [`${WS}/src`], files: {} },
});
const sh = term.shell;
window.__ros2lab = { term, sh };   // for automated checks (tools/) and the browser console
let current = null;   // { name, files, main, launches }

function writePackage(p) {
  for (const x of p.extraPackages || []) writePackage(x);   // e.g. <robot>_moveit_config next to the description
  const dir = sh.abs(`${WS}/src/${p.name}`);
  for (const k of [...sh.fs.keys()]) if (k === dir || k.startsWith(dir + "/")) sh.fs.delete(k);   // a fresh copy of the package sources
  sh.mkdirP(dir);
  for (const [rel, content] of Object.entries(p.files)) {
    const path = `${dir}/${rel}`;
    sh.mkdirP(path.replace(/\/[^/]*$/, ""));
    sh.fs.set(path, { type: "f", mode: /^#!/.test(String(content)) ? "rwxrwxr-x" : "rw-r--r--", content });
  }
}
function launchFile() {
  const want = document.querySelector("input[name=lf]:checked").value, what = document.querySelector("input[name=what]:checked").value;
  const l = (current.launches || []).filter((f) => (what === "control" ? /control/i.test(f) : what === "sim" ? /sim|gazebo|gz/i.test(f) && !/control/i.test(f) : !/sim|gazebo|gz|control/i.test(f)));
  const pool = l.length ? l : current.launches || [];
  return pool.find((f) => (want === "xml" ? /\.xml$/ : /\.py$/).test(f)) || pool[0] || null;
}
function commands() {
  if (!current) return [];
  const what = document.querySelector("input[name=what]:checked").value;
  if ((what === "moveit" || what === "moveit_gz") && current.moveit) {
    const M = current.moveit.pkg;
    return ["cd ~/ros2_ws", `colcon build --packages-select ${[current.name, ...(current.extraPackages || []).map((x) => x.name)].join(" ")}`, "source install/setup.bash", `ros2 launch ${M} ${what === "moveit" ? "demo.launch.py" : "gazebo.launch.py"}`];
  }
  const lf = launchFile();
  return ["cd ~/ros2_ws", `colcon build --packages-select ${[current.name, ...(current.extraPackages || []).map((x) => x.name)].join(" ")}`, "source install/setup.bash",
    lf ? `ros2 launch ${current.name} ${lf}` : current.mainPath ? `ros2 launch urdf_tutorial display.launch.py model:=$PWD/src/${current.name}/${current.mainPath}` : "# no robot file (.urdf / .urdf.xacro) was found in this package"];
}
function paintCommands() {
  $("cmds").textContent = commands().map((c) => `$ ${c}`).join("\n");
  const lf = launchFile(), xmlRadio = document.querySelector("input[name=lf][value=xml]"), pyRadio = document.querySelector("input[name=lf][value=py]");
  xmlRadio.disabled = !(current && current.launches.some((f) => /\.xml$/.test(f))); pyRadio.disabled = !(current && current.launches.some((f) => /\.py$/.test(f)));
  const simRadio = document.querySelector("input[name=what][value=sim]"), hasSim = !!(current && current.launches.some((f) => /sim|gazebo|gz/i.test(f)));
  simRadio.disabled = !hasSim; if (!hasSim && simRadio.checked) document.querySelector("input[name=what][value=display]").checked = true;
  const ctlRadio = document.querySelector("input[name=what][value=control]"), hasCtl = !!(current && current.launches.some((f) => /control/i.test(f)));
  if (ctlRadio) { ctlRadio.disabled = !hasCtl; ctlRadio.closest("label").hidden = !hasCtl; if (!hasCtl && ctlRadio.checked) document.querySelector("input[name=what][value=display]").checked = true; }
  for (const v of ["moveit", "moveit_gz"]) { const r = document.querySelector(`input[name=what][value=${v}]`); if (!r) continue; const on = !!(current && current.moveit); r.disabled = !on; r.closest("label").hidden = !on; if (!on && r.checked) document.querySelector("input[name=what][value=display]").checked = true; }
  // how to drive / move this robot once it runs (what a real Jazzy setup needs)
  const tip = $("drive-tip"), what = document.querySelector("input[name=what]:checked").value, S = current && current.sim;
  let t = "";
  if (S && what === "sim") t = S.drive || S.velocity || S.mecanum || S.ackermann ? "Drive it from a + New terminal: ros2 run teleop_twist_keyboard teleop_twist_keyboard  (Twist on /cmd_vel; ros_gz_bridge carries it to Gazebo's " + (S.drive ? "DiffDrive" : S.mecanum ? "MecanumDrive" : S.ackermann ? "AckermannSteering" : "VelocityControl") + " system)." + (S.mecanum ? " Hold Shift to strafe (U I O J K L M < >)." : "") + (S.velocity && S.velocity.fly ? " t climbs, b descends." : "")
    : S.positions && S.positions.length ? `Move a joint from a + New terminal: ros2 topic pub --once /${S.positions[0].joint}/cmd_pos std_msgs/msg/Float64 "{data: 1.0}"  (Gazebo's JointPositionController moves it).` : "";
  if (S && what === "control" && S.control) t = S.control.controller === "diff_drive_controller" ? "Drive it from a + New terminal (Jazzy's diff_drive_controller takes TwistStamped on its own topic): ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true -r cmd_vel:=/diff_drive_controller/cmd_vel   Check the controllers with: ros2 control list_controllers"
    : `Move the arm from a + New terminal: ros2 topic pub --once /joint_trajectory_controller/joint_trajectory trajectory_msgs/msg/JointTrajectory "{joint_names: [${S.control.arm.map((j) => j.name).join(", ")}], points: [{positions: [${S.control.arm.map((j, i) => (i % 2 ? 0.6 : 0.3).toFixed(1)).join(", ")}], time_from_start: {sec: 3}}]}"   Check the controllers with: ros2 control list_controllers`;
  if (current && current.moveit && (what === "moveit" || what === "moveit_gz")) {
    const M = current.moveit;
    t = `In RViz's MotionPlanning panel: drag the orange marker at ${M.tip} (goal state), pick the pipeline in the Context tab (ompl, pilz_industrial_motion_planner, chomp, stomp) and the planner, then Plan and Execute in the Planning tab.${what === "moveit" ? ` The work cell's obstacles: in a + New terminal, cd ~/ros2_ws && source install/setup.bash && ros2 run ${M.pkg} add_scene_objects.py` : " The table, box and post are already in the Gazebo world and the planning scene."}${M.real ? `  Real robot: ${M.real.connection}; see src/${M.pkg}/README.md.` : ""}`;
  }
  if (current && current.moveit && (what === "moveit" || what === "moveit_gz")) {
    const M = current.moveit;
    t += ` Type a goal instead: the Pose Goal panel on the right of RViz (x, y, z, roll, pitch, yaw), or ros2 run ${M.pkg} pose_goal_commander.py and publish geometry_msgs/msg/PoseStamped on /goal_pose. Jog it live with MoveIt Servo: ros2 launch ${M.pkg} servo.launch.py. Failed plans print move_group's errors in the launch terminal.`;
  }
  const bu = current && (current.extraPackages || []).find((x) => /_bringup$/.test(x.name));
  if (bu && t) t += ` The real robot: ros2 launch ${bu.name} real.launch.py (needs a hardware license from your course administrator).`;
  if (tip) { tip.textContent = t; tip.hidden = !t; }
  // the package's files: click one to see it with cat (like on Ubuntu)
  const tree = $("tree"); tree.replaceChildren();
  if (!current) return;
  const head = document.createElement("span"); head.textContent = `~/ros2_ws/src/${current.name}/  `; tree.append(head);
  const shown = Object.keys(current.files).filter((p) => !String(current.files[p]).startsWith("@url:")).sort((a, b) => (a.split("/").length - b.split("/").length) || a.localeCompare(b));
  for (const rel of shown) {
    const b = document.createElement("button"); b.type = "button"; b.className = "rvp-file"; b.textContent = rel;
    b.title = `Show it in the terminal: cat src/${current.name}/${rel}`;
    b.addEventListener("click", () => { if (term.busy()) term.say("(A launch is running in this tab. Open a + New terminal to look at files while it runs, or stop it with Ctrl+C.)"); else { term.run(`cat ~/ros2_ws/src/${current.name}/${rel}`); } });
    tree.append(b);
  }
  if (lf) { const n = document.createElement("span"); n.className = "muted"; n.textContent = `  Launch file: launch/${lf}`; tree.append(n); }
  for (const x of current.extraPackages || []) {   // the MoveIt config package
    const head2 = document.createElement("div"); head2.textContent = `~/ros2_ws/src/${x.name}/  `; tree.append(head2);
    for (const rel of Object.keys(x.files).filter((r) => !String(x.files[r]).startsWith("@url:")).sort((a, b) => (a.split("/").length - b.split("/").length) || a.localeCompare(b))) {
      const b = document.createElement("button"); b.type = "button"; b.className = "rvp-file"; b.textContent = rel; b.title = `Show it in the terminal: cat src/${x.name}/${rel}`;
      b.addEventListener("click", () => { if (term.busy()) term.say("(A launch is running in this tab. Open a + New terminal to look at files while it runs, or stop it with Ctrl+C.)"); else term.run(`cat ~/ros2_ws/src/${x.name}/${rel}`); });
      tree.append(b);
    }
  }
}
async function usePackage(p, label) {
  current = p;
  writePackage(p);
  paintCommands();
  paintDetails(p);
  const all = [p.name, ...(p.extraPackages || []).map((x) => x.name)];
  term.say(`(${label}: ${all.length > 1 ? `the packages ${all.join(", ")} are` : `the package ${p.name} is`} in ~/ros2_ws/src. Build, source the workspace and launch: the commands are above the terminal. code ~/ros2_ws opens them all in VS Code.)`);
  for (const n of p.notes || []) term.say(`(${n})`);
}

// ---------------- the robot's details, as RViz and Gazebo will see them
function paintDetails(p) {
  const box = $("details"); box.replaceChildren();
  const files = p.files || {}, main = p.sim ? `urdf/${p.sim.model}_sim.urdf.xacro` : p.mainPath || (p.main ? `urdf/${p.main}` : null);
  let urdf = null;
  try { urdf = expandIn(files, p.name, main); } catch (e) { box.textContent = `Could not read the robot: ${e.message}`; return; }
  if (!urdf) { box.textContent = "No robot file found."; return; }
  const d = sh.graph.robotDetails(urdf);
  if (d.error) { box.textContent = `The URDF does not parse: ${d.error}`; return; }
  const M = d.model, J = Object.values(M.joints), mov = J.filter((j) => j.type !== "fixed");
  const sec = (title, rows) => { const s = document.createElement("div"); s.className = "rvp-dsec"; const h = document.createElement("h3"); h.textContent = title; s.append(h); const ul = document.createElement("ul"); for (const r of rows) { const li = document.createElement("li"); li.textContent = r; ul.append(li); } if (!rows.length) { const li = document.createElement("li"); li.textContent = "none"; ul.append(li); } s.append(ul); return s; };
  const lim = (j) => (j.limit && j.type !== "continuous" ? ` [${(+j.limit.lower).toFixed(2)}, ${(+j.limit.upper).toFixed(2)}]${j.type === "prismatic" ? " m" : " rad"}` : "");
  const senLine = (s) => `${s.name} (${s.type}) on ${s.link}: ${s.topic ? `Gazebo topic /${s.topic.replace(/^\//, "")}` : "default Gazebo topic"}, ${s.rate || "?"} Hz, frame ${s.optical || s.frame || "(model/link/sensor)"}${s.lidar ? `, ${s.lidar.hSamples}x${s.lidar.vSamples} rays, ${s.lidar.min}-${s.lidar.max} m` : ""}${s.camera ? `, ${s.camera.width}x${s.camera.height}, hfov ${(+s.camera.hfov).toFixed(2)} rad` : ""}`;
  box.append(
    Object.assign(document.createElement("p"), { textContent: `Robot "${M.name}": root link ${M.root}, ${Object.keys(M.links).length} links, ${J.length} joints (${mov.length} that move). This is what the launch file's xacro produces, the same text robot_state_publisher publishes on /robot_description.` }),
    sec("Moving joints (actuators)", mov.map((j) => `${j.name}: ${j.type}${j.mimic ? ` (mimics ${j.mimic.joint})` : ""}${lim(j)}, ${j.parent} → ${j.child}`)),
    sec("Gazebo sensors (<gazebo reference> <sensor>)", d.gz.sensors.map(senLine)),
    sec("Gazebo systems (model plugins)", d.gz.plugins.map((x) => x.kind === "diff_drive" ? `DiffDrive: left ${x.left.join(", ")}, right ${x.right.join(", ")}, separation ${x.separation} m, radius ${x.radius} m, cmd ${x.topic || "/model/<name>/cmd_vel"}` : x.kind === "joint_states" ? `JointStatePublisher: ${x.topic || "/world/<world>/model/<name>/joint_state"}` : x.kind === "gz_ros2_control" ? "gz_ros2_control (ros2_control inside Gazebo)" : `${x.file}`)),
    ...(d.gz.classic.length ? [sec("Gazebo Classic plugins (ignored by Gazebo Harmonic)", d.gz.classic.map((c) => `${c.file}${c.topic ? ` (ROS topic ${c.topic})` : ""}`))] : []),
    ...(d.ros2_control.length ? [sec("ros2_control", d.ros2_control.flatMap((r) => [`${r.name}: ${r.plugin || ""}`, ...r.joints.map((j) => `  ${j.name}: command ${j.cmd.join(", ") || "-"}; state ${j.state.join(", ") || "-"}`)]))] : []),
    ...(d.transmissions.length ? [sec("Transmissions", d.transmissions)] : []),
    sec("Links", Object.values(M.links).map((l) => `${l.name}${l.visuals.length ? ` (${l.visuals.map((v) => v.geom.type).join(", ")})` : ""}${l.inertial ? `, ${(+l.inertial.mass).toFixed(3)} kg` : ""}`)));
}
function expandIn(files, pkg, rel) {
  if (!rel || files[rel] === undefined) return null;
  const t = files[rel];
  if (!/<xacro:|xmlns:xacro/.test(t)) return t;
  return xacro(t, { path: `/${pkg}/${rel}`, files: (p) => files[String(p).replace(new RegExp(`^/${pkg}/`), "")], find: (q) => (q === pkg ? `/${pkg}` : undefined) });
}

// ---------------- 1. gallery robot packages
gallery().then(async (list) => {
  const sel = $("gal");
  const groups = new Map(); for (const g of list) { const k = g.group || "Robots"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
  for (const [k, items] of groups) { const og = document.createElement("optgroup"); og.label = k; og.append(...items.map((g) => new Option(g.vendor ? `${g.title}` : g.title, g.id))); sel.append(og); }
  const pick = async () => {
    const g = list.find((x) => x.id === sel.value); if (!g) return;
    const about = $("pkg-about"); about.replaceChildren(document.createTextNode(g.about + " "));
    if (g.source) { const a = document.createElement("a"); a.href = g.source.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = `Source: ${g.source.url.replace(/^https:\/\/github.com\//, "")} (${g.source.license})`; about.append(a); }
    try { const p = await galleryPackage(g); p.mainPath = `urdf/${p.main}`; await usePackage(p, g.title); }
    catch (e) { term.say(`(Could not load ${g.title}: ${e.message})`); }
  };
  sel.addEventListener("change", pick);
  sel.value = "arm3";
  await pick();
});

// ---------------- 2. the student's own package or files
async function openOwn(files) {
  if (!files.length) return;
  const p = await folderPackage(files);
  if (p.error) { term.say(`(${p.error})`); return; }
  await usePackage(p, "Your robot");
}
$("folder").addEventListener("change", (e) => openOwn([...e.target.files]));
$("files").addEventListener("change", (e) => openOwn([...e.target.files]));

// ---------------- 3. launch
document.querySelectorAll("input[name=lf], input[name=what]").forEach((r) => r.addEventListener("change", paintCommands));
$("go").addEventListener("click", () => {
  if (!current) return;
  term.stopAll();
  for (const c of commands()) term.run(c);
  const v = document.querySelector("#term .term-viz"); if (v) setTimeout(() => v.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
});

// ---------------- a live ROS 2 system through rosbridge (its own RViz and slider windows)
let live = null;   // { viewer, jsp }
const out = $("out"), desk = $("desk");
const say = (t, err = false) => { out.hidden = false; out.className = `rvb-out${err ? " err" : ""}`; out.textContent = t; };
let rb = null, topics = [], model = null;
async function ensureLive() {
  if (live) return live;
  const [{ createRviz }, { createJspWindow }] = await Promise.all([import("./rviz.js"), import("./jsp-window.js")]);
  desk.hidden = false;
  const holder = document.createElement("div"); desk.append(holder);
  const viewer = createRviz(holder, {
    fixedFrame: "base_link", displays: { Grid: true, RobotModel: true, TF: true }, resolve: () => null, topics: () => topics, title: "", externalTf: true, plugins: () => ["rviz_imu_plugin"],
    onSave: (path) => say(`${path} is kept in this page only: ROS2Lab does not download files to your device.`),
    onOpenConfig: () => { const i = document.createElement("input"); i.type = "file"; i.accept = ".rviz,.yaml"; i.onchange = async () => { const f = i.files[0]; if (f) viewer.loadConfig(await f.text(), f.name); }; i.click(); },
    onPublish: (topic, type, msg) => { if (rb) { rb.publish(topic, type, msg); say(`Published a ${type} on ${topic} through rosbridge.`); } },
  });
  const jsp = createJspWindow(desk, { title: "Joint State Publisher", onChange: (v) => { if (rb && $("pubjs").checked) publishJointStates(v); } });
  live = { viewer, jsp };
  return live;
}
const tfEdges = new Map(); let tfPending = false, sensors = {}, topicTimer = null;
function onTF(msg, isStatic) {
  for (const tr of msg.transforms || []) {
    const t = tr.transform.translation, q = tr.transform.rotation, parent = tr.header.frame_id.replace(/^\//, ""), child = tr.child_frame_id.replace(/^\//, "");
    tfEdges.set(child, { parent, child, t: [t.x, t.y, t.z], q: [q.x, q.y, q.z, q.w], static: isStatic });
  }
  if (!tfPending && live) { tfPending = true; requestAnimationFrame(() => { tfPending = false; live.viewer.setExtraEdges([...tfEdges.values()]); }); }
}
function onDescription(text) {
  try { const m = parseURDF(text); model = m; live.viewer.setModel(m); live.jsp.setModel(m); if (!tfEdges.size) live.viewer.setFixedFrame(m.root); say(`Received robot_description: ${m.name} (${Object.keys(m.links).length} links, ${Object.keys(m.joints).length} joints).`); }
  catch (e) { say(`robot_description could not be read: ${e.message}`, true); }
}
function publishJointStates(v) {
  const t = Date.now() / 1000;
  rb.publish("/joint_states", "sensor_msgs/msg/JointState", { header: { stamp: { sec: Math.floor(t), nanosec: Math.floor((t % 1) * 1e9) }, frame_id: "" }, name: Object.keys(v), position: Object.values(v).map(Number), velocity: [], effort: [] });
}
function disconnect() {
  if (rb) { rb.onclose = null; rb.close(); rb = null; }
  clearInterval(topicTimer); tfEdges.clear(); sensors = {}; topics = [];
  if (live) { live.viewer.setExtraEdges([]); live.viewer.setSensors({}); live.viewer.setMarkers([]); live.viewer.update({ topicData: new Map() }); }
  $("connect").textContent = "Connect";
}
// ---------------- the hardware license (real robots only; simulation needs none)
licenseStatus().then(paintLicense);
function paintLicense(st) {
  const box = $("hwlic"); if (!box) return;
  const ok = licensed(st);
  box.className = `notice ${ok ? "ok" : ""}`;
  box.replaceChildren();
  const p = document.createElement("p"); p.style.margin = "0 0 6px";
  p.textContent = ok ? `Hardware license active${st.admin ? " (instructor)" : ""}: ${(st.robots || []).join(", ")}${st.validUntil ? `, until ${new Date(st.validUntil).toLocaleDateString()}` : ""}.` : licenseMessage(st);
  box.append(p);
  if (!ok && ["none", "rejected", "expired", "revoked"].includes(st.status)) {
    const robot = document.createElement("input"); robot.value = current && current.robotId ? current.robotId : ($("gal") && $("gal").value) || ""; robot.size = 14; robot.setAttribute("aria-label", "Robot id");
    const why = document.createElement("textarea"); why.rows = 2; why.style.width = "100%"; why.placeholder = "Which robot (model, serial if known), where it is, and what you will do with it"; why.setAttribute("aria-label", "Purpose");
    const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-small"; b.textContent = "Ask for a hardware license";
    b.onclick = async () => { b.disabled = true; try { await requestLicense([robot.value.trim()], why.value.trim()); paintLicense(await licenseStatus(true)); } catch (e) { b.disabled = false; p.textContent = String(e.message || e).replace(/^.*?:\s*/, ""); } };
    const row = document.createElement("div"); row.className = "rvp-row"; row.append("Robot: ", robot, b);
    box.append(why, row);
  }
}
$("connect").addEventListener("click", async () => {
  if (rb) { disconnect(); say("Disconnected."); return; }
  const st = await licenseStatus(true); paintLicense(st);
  if (!licensed(st)) { say(`${licenseMessage(st)} (Simulation in the terminal above needs no license.)`, true); return; }
  const url = $("url").value.trim();
  say(`Connecting to ${url} …`);
  try {
    const c = new Rosbridge(url); await c.connect();
    await ensureLive();
    rb = c; $("connect").textContent = "Disconnect";
    rb.onclose = () => { say("The connection to rosbridge closed.", true); rb = null; $("connect").textContent = "Connect"; };
    live.viewer.setExternalTf(true); live.viewer.setModel(null); model = null;
    rb.subscribe("/tf", "tf2_msgs/msg/TFMessage", (m) => onTF(m, false));
    rb.subscribe("/tf_static", "tf2_msgs/msg/TFMessage", (m) => onTF(m, true));
    rb.subscribe("/robot_description", "std_msgs/msg/String", (m) => onDescription(m.data));
    rb.subscribe("/visualization_marker", "visualization_msgs/msg/Marker", (m) => live.viewer.addMarkers([{ ...m, __topic: "/visualization_marker" }]));
    rb.subscribe("/visualization_marker_array", "visualization_msgs/msg/MarkerArray", (m) => live.viewer.addMarkers((m.markers || []).map((x) => ({ ...x, __topic: "/visualization_marker_array" }))));
    // every display's topic (and a camera's camera_info), subscribed like RViz does when a display is added
    const liveData = new Map(), counts = new Map(), started = performance.now();
    const follow = () => {
      if (!rb || !live) return;
      const want = live.viewer.subscriptions().filter(([, t]) => LIVE_TYPES.includes(t));
      for (const [topic, type] of want) {
        const extra = type === "sensor_msgs/msg/Image" ? [[topic.replace(/\/[^/]*$/, "") + "/camera_info", "sensor_msgs/msg/CameraInfo"]] : [];
        for (const [tp, ty] of [[topic, type], ...extra]) {
          if (rb.subs.has(tp)) continue;
          rb.subscribe(tp, ty, (m) => { const d = convert(ty, m); if (!d) return; const n = (counts.get(tp) || 0) + 1; counts.set(tp, n); liveData.set(tp, { ...d, type: ty, count: n, rate: n / ((performance.now() - started) / 1000) }); }, THROTTLE[ty] ? { throttle_rate: THROTTLE[ty] } : {});
        }
      }
    };
    follow();
    const liveTimer = setInterval(() => { if (!rb) { clearInterval(liveTimer); return; } follow(); live.viewer.update({ topicData: liveData }); }, 200);
    // robot_description is also a parameter of robot_state_publisher (works even if the topic message was missed)
    rb.call("/robot_state_publisher/get_parameters", "rcl_interfaces/srv/GetParameters", { names: ["robot_description"] }).then((v) => { const s = v && v.values && v.values[0] && v.values[0].string_value; if (s && !model) onDescription(s); }).catch(() => {});
    const loadTopics = () => rb && rb.call("/rosapi/topics", "rosapi_msgs/srv/Topics").then((v) => { topics = (v.topics || []).map((n, i) => ({ name: n, type: (v.types || [])[i] || "" })); if (live) live.viewer.setExtraEdges([...tfEdges.values()]); }).catch(() => {});
    loadTopics(); topicTimer = setInterval(loadTopics, 5000);
    live.viewer.setTitle(url);
    say(`Connected to ${url}. Waiting for /robot_description and /tf … (launch your robot on Ubuntu if nothing appears)`);
  } catch (e) {
    say(`Could not connect to ${url}: ${e.message}.\nOn Ubuntu, run: ros2 launch rosbridge_server rosbridge_websocket_launch.xml\nThen open this page on the same computer (the address must be localhost).`, true);
  }
});
