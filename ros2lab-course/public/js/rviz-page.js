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

const $ = (id) => document.getElementById(id);
const WS = "~/ros2_ws";

// ---------------- the practice terminal (ROS 2 Jazzy is sourced in ~/.bashrc, like a set-up Ubuntu machine)
const term = mountTerminal($("term"), {
  title: "Terminal: ~/ros2_ws",
  intro: "",
  sourced: true, start: WS, cmds: ["colcon", "tree", "gz"], newTerminal: true, ide: true, rvizSave: "~/ros2_ws/my_config.rviz",
  // a ROS 2 Jazzy desktop with Gazebo (ros-jazzy-ros-gz), teleop_twist_keyboard and the RViz IMU plugin installed
  // ... and ros2_control for Gazebo (ros-jazzy-gz-ros2-control, ros-jazzy-ros2-controllers)
  rosPkgs: ["ros_gz_sim", "ros_gz_bridge", "ros_gz_image", "teleop_twist_keyboard", "rviz_imu_plugin", "controller_manager", "gz_ros2_control", "ros2controlcli", "hardware_interface", "joint_state_broadcaster", "diff_drive_controller", "joint_trajectory_controller", "forward_command_controller", "position_controllers", "velocity_controllers"],
  fs: { dirs: [`${WS}/src`], files: {} },
});
const sh = term.shell;
let current = null;   // { name, files, main, launches }

function writePackage(p) {
  const dir = sh.abs(`${WS}/src/${p.name}`);
  for (const k of [...sh.fs.keys()]) if (k === dir || k.startsWith(dir + "/")) sh.fs.delete(k);   // a fresh copy of the package sources
  sh.mkdirP(dir);
  for (const [rel, content] of Object.entries(p.files)) {
    const path = `${dir}/${rel}`;
    sh.mkdirP(path.replace(/\/[^/]*$/, ""));
    sh.fs.set(path, { type: "f", mode: "rw-r--r--", content });
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
  const lf = launchFile();
  return ["cd ~/ros2_ws", `colcon build --packages-select ${current.name}`, "source install/setup.bash",
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
  // how to drive / move this robot once it runs (what a real Jazzy setup needs)
  const tip = $("drive-tip"), what = document.querySelector("input[name=what]:checked").value, S = current && current.sim;
  let t = "";
  if (S && what === "sim") t = S.drive || S.velocity ? "Drive it from a + New terminal: ros2 run teleop_twist_keyboard teleop_twist_keyboard  (Twist on /cmd_vel; ros_gz_bridge carries it to Gazebo's " + (S.drive ? "DiffDrive" : "VelocityControl") + " system)."
    : S.positions && S.positions.length ? `Move a joint from a + New terminal: ros2 topic pub --once /${S.positions[0].joint}/cmd_pos std_msgs/msg/Float64 "{data: 1.0}"  (Gazebo's JointPositionController moves it).` : "";
  if (S && what === "control" && S.control) t = S.control.controller === "diff_drive_controller" ? "Drive it from a + New terminal (Jazzy's diff_drive_controller takes TwistStamped on its own topic): ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true -r cmd_vel:=/diff_drive_controller/cmd_vel   Check the controllers with: ros2 control list_controllers"
    : `Move the arm from a + New terminal: ros2 topic pub --once /joint_trajectory_controller/joint_trajectory trajectory_msgs/msg/JointTrajectory "{joint_names: [${S.control.arm.map((j) => j.name).join(", ")}], points: [{positions: [${S.control.arm.map((j, i) => (i % 2 ? 0.6 : 0.3).toFixed(1)).join(", ")}], time_from_start: {sec: 3}}]}"   Check the controllers with: ros2 control list_controllers`;
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
}
async function usePackage(p, label) {
  current = p;
  writePackage(p);
  paintCommands();
  paintDetails(p);
  term.say(`(${label}: the package ${p.name} is in ~/ros2_ws/src/${p.name}. Build it, source the workspace and launch it: the commands are above the terminal.)`);
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
    onSave: (path, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/yaml" })); a.download = path.split("/").pop() || "my_config.rviz"; a.click(); },
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
$("connect").addEventListener("click", async () => {
  if (rb) { disconnect(); say("Disconnected."); return; }
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
