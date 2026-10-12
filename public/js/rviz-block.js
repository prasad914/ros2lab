// Lesson block { t: "rviz" }: write or pick a URDF/xacro robot and see it in the practice RViz.
// Spec: { title, intro, robot: "<gallery id>", gallery: true, src: "<urdf/xacro text>", path, editable, goal, check, solution, hint,
//         gui, fixedFrame, displays, markers, imarkers, sensors: { demo: "room" } | {...}, addable }
import { el, rich } from "./dom.js";
import { xacro, parseURDF, checkUrdfText, movableJoints } from "./urdf-core.js";

const cache = new Map();
const fetchText = (url) => { if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${url} (${r.status})`); return r.text(); })); return cache.get(url); };
const norm = (p) => new URL(p, location.origin).pathname;
let galleryP = null;
export const gallery = () => (galleryP = galleryP || fetchText("/robots/index.json").then(JSON.parse));

// fetch every <xacro:include> (they are resolved relative to the top file) so xacro can run synchronously
async function prefetch(path, text, files, depth = 0) {
  for (const m of String(text).matchAll(/<xacro:include\s+filename="([^"]+)"/g)) {
    const url = norm(path.replace(/[^/]*$/, "") + m[1]);
    if (files.has(url)) continue;
    try { const t = await fetchText(url); files.set(url, t); if (depth < 4) await prefetch(path, t, files, depth + 1); } catch { /* reported by xacro */ }
  }
}
export async function buildRobot(text, path) {
  const files = new Map();
  await prefetch(path, text, files);
  const isXacro = /<xacro:|xmlns:xacro/.test(text);
  const urdf = isXacro ? xacro(text, { path, files: (p) => files.get(norm(p)) }) : text;
  return { urdf, model: parseURDF(urdf), isXacro };
}
const resolveMesh = (url) => { const m = String(url).match(/^package:\/\/([\w-]+)\/(.+)$/); return m ? `/robots/${m[1]}/${m[2]}` : (String(url).startsWith("/robots/") ? url : null); };

// Goals for auto-graded practice
export function checkModel(model, c) {
  const miss = [];
  if (!model) return { ok: false, miss: ["the robot must load without errors"] };
  const J = Object.values(model.joints), L = model.links;
  if (c.root && model.root !== c.root) miss.push(`the root link must be "${c.root}" (it is "${model.root}")`);
  if (c.links && Object.keys(L).length < c.links) miss.push(`at least ${c.links} links (you have ${Object.keys(L).length})`);
  for (const [t, n] of Object.entries(c.joints || {})) { const k = J.filter((j) => j.type === t).length; if (k < n) miss.push(`at least ${n} ${t} joint${n > 1 ? "s" : ""} (you have ${k})`); }
  if (c.movable && movableJoints(model).length < c.movable) miss.push(`at least ${c.movable} joints you can move with sliders (you have ${movableJoints(model).length})`);
  if (c.mimic && !J.some((j) => j.mimic)) miss.push("a joint with <mimic joint=\"...\"/>");
  for (const l of c.linkExists || []) if (!L[l]) miss.push(`a link named "${l}"`);
  for (const j of c.jointExists || []) if (!model.joints[j]) miss.push(`a joint named "${j}"`);
  const want = (x) => (x === "all" ? Object.values(L).filter((l) => l.visuals.length) : (x || []).map((n) => L[n]).filter(Boolean));
  for (const l of want(c.hasCollision)) if (!l.collisions.length) miss.push(`<collision> in link "${l.name}"`);
  for (const l of want(c.hasInertial)) if (!l.inertial) miss.push(`<inertial> in link "${l.name}"`);
  if (c.meshes && !Object.values(L).some((l) => l.visuals.some((v) => v.geom.type === "mesh"))) miss.push("at least one <mesh> visual");
  if (c.visuals) { const n = Object.values(L).reduce((a, l) => a + l.visuals.length, 0); if (n < c.visuals) miss.push(`at least ${c.visuals} <visual> shapes (you have ${n})`); }
  if (c.meshScale !== undefined) for (const l of Object.values(L)) for (const v of l.visuals) if (v.geom.type === "mesh" && v.geom.scale.some((x) => Math.abs(x - c.meshScale) > 1e-9)) { miss.push(`mesh scale ${c.meshScale} on every mesh (link "${l.name}" has ${v.geom.scale.join(" ")})`); break; }
  if (c.colors && !Object.values(L).filter((l) => l.visuals.length).every((l) => l.visuals.every((v) => v.rgba))) miss.push("a colour (material) on every visual");
  if (c.noWarnings && model.warnings.length) miss.push(`no warnings (${model.warnings[0]})`);
  if (c.xacro && !c.__isXacro) miss.push("use xacro (xmlns:xacro, a property or a macro)");
  return { ok: !miss.length, miss };
}

// Demo sensor data: a small room seen by Chiku's lidar, plus a cloud, a path, odometry and a map.
export function demoSensors(kind = "room") {
  const walls = (x, y) => { // distance along a ray from (0,0) to the walls of a 6 x 4 m room centred at (1, 0), plus a 0.6 m box
    let best = 30; const rays = [];
    const seg = [[-2, -2, 4, -2], [4, -2, 4, 2], [4, 2, -2, 2], [-2, 2, -2, -2], [1.5, 0.5, 2.1, 0.5], [2.1, 0.5, 2.1, 1.1], [2.1, 1.1, 1.5, 1.1], [1.5, 1.1, 1.5, 0.5]];
    for (const [x1, y1, x2, y2] of seg) { const dx = x2 - x1, dy = y2 - y1, den = x * dy - y * dx; if (Math.abs(den) < 1e-9) continue; const t = (x1 * dy - y1 * dx) / den, u = (x1 * y - y1 * x) / den; if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t); }
    return best;
  };
  const N = 360, ranges = [];
  for (let i = 0; i < N; i++) { const a = -Math.PI + (i * 2 * Math.PI) / N; ranges.push(Math.round((walls(Math.cos(a), Math.sin(a)) + 0.01 * Math.sin(i * 7)) * 1000) / 1000); }
  const cloud = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) for (const z of [0.05, 0.3, 0.55]) cloud.push([1.5 + i * 0.05, 0.5 + j * 0.05, z]);
  const path = []; for (let i = 0; i <= 30; i++) { const t = i / 30; path.push([t * 3, Math.sin(t * Math.PI) * 1.2, 0.02]); }
  const odom = []; for (let i = 0; i <= 6; i++) { const t = i / 6; odom.push([t * 3, Math.sin(t * Math.PI) * 1.2, Math.atan2(Math.cos(t * Math.PI) * 1.2 * Math.PI, 3)]); }
  const W = 60, H = 40, res = 0.1, data = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const x = -2 + c * res, y = -2 + r * res; const wall = r === 0 || c === 0 || r === H - 1 || c === W - 1, box = x >= 1.5 && x <= 2.1 && y >= 0.5 && y <= 1.1; data.push(wall || box ? 100 : c > 50 && r > 30 ? -1 : 0); }
  return { scan: { frame: "lidar_link", angle_min: -Math.PI, angle_increment: (2 * Math.PI) / N, ranges, range_max: 12, qos: kind === "room-best-effort" ? "Best Effort" : "Reliable" },
    cloud: { frame: "odom", points: cloud }, path: { frame: "odom", points: path }, odom: { frame: "odom", poses: odom }, map: { frame: "odom", width: W, height: H, resolution: res, origin: [-2, -2], data } };
}

export function mountRvizBlock(slot, b, { onComplete } = {}) {
  const out = el("pre", { class: "rvb-out", hidden: true });
  const view = el("div", { class: "rvb-view" });
  const goalBox = b.goal ? el("div", { class: "py-goal" }, el("b", { text: "Goal: " }), rich(b.goal)) : null;
  const pass = el("div", { class: "notice ok", hidden: true, text: "Goal reached. Well done!" });
  const about = el("div", { class: "rvb-about", hidden: true });
  const path = b.path || "/robots/user/urdf/my_robot.urdf.xacro";
  let srcText = b.src || "", viewer = null, done = false, currentPath = path;
  const ta = b.editable === false || !b.src ? null : el("textarea", { class: "py-code rvb-code", spellcheck: "false", rows: String(Math.min(26, Math.max(10, srcText.split("\n").length + 1))), "aria-label": "Robot description (URDF or xacro)" });
  if (ta) ta.value = srcText;
  const sel = b.gallery ? el("select", { class: "rvb-sel", "aria-label": "Choose a robot" }) : null;
  const runBtn = ta ? el("button", { type: "button", class: "btn btn-small", text: "Run (xacro + check_urdf + ros2 launch)" }) : null;
  const resetBtn = ta ? el("button", { type: "button", class: "btn btn-small btn-white", text: "Reset" }) : null;
  const solBtn = ta && b.solution ? el("button", { type: "button", class: "btn btn-small btn-white", text: "Show solution" }) : null;
  slot.append(el("section", { class: "rvb" },
    b.title ? el("h3", { class: "rvb-title", text: b.title }) : null,
    b.intro ? el("p", {}, rich(b.intro)) : null,
    sel ? el("label", { class: "rv-row" }, el("span", { text: "Robot: " }), sel) : null, about,
    goalBox, ta, ta ? el("div", { class: "q-actions" }, runBtn, resetBtn, solBtn) : null, out, pass, view));

  let jspWin = null;
  const rvizHolder = el("div", { class: "desk-rviz" });
  view.classList.add("rv-desk"); view.append(rvizHolder);
  const ensureViewer = async () => {
    if (viewer) return viewer;
    const { createRviz } = await import("./rviz.js");
    // the topics of "ros2 launch urdf_tutorial display.launch.py" plus this lesson's demo data (Add > By topic lists them)
    const T = [["/robot_description", "std_msgs/msg/String"], ["/joint_states", "sensor_msgs/msg/JointState"], ["/tf", "tf2_msgs/msg/TFMessage"], ["/tf_static", "tf2_msgs/msg/TFMessage"], ["/parameter_events", "rcl_interfaces/msg/ParameterEvent"], ["/rosout", "rcl_interfaces/msg/Log"],
      ...(b.sensors ? [["/scan", "sensor_msgs/msg/LaserScan"], ["/points", "sensor_msgs/msg/PointCloud2"], ["/plan", "nav_msgs/msg/Path"], ["/odom", "nav_msgs/msg/Odometry"], ["/map", "nav_msgs/msg/OccupancyGrid"]] : []),
      ...(b.markers ? [["/visualization_marker", "visualization_msgs/msg/Marker"]] : []), ...(b.imarkers ? [["/simple_marker/update", "visualization_msgs/msg/InteractiveMarkerUpdate"], ["/simple_marker/feedback", "visualization_msgs/msg/InteractiveMarkerFeedback"]] : [])];
    viewer = createRviz(rvizHolder, { fixedFrame: b.fixedFrame || "base_link", displays: b.displays || { Grid: true, RobotModel: true, TF: true }, resolve: resolveMesh, title: b.title || "", views: false, time: false, lesson: true,
      topics: () => T.map(([name, type]) => ({ name, type, pubs: 1 })), onLog: (t) => { out.hidden = false; out.textContent += `\n${t}`; } });
    return viewer;
  };
  const ensureJsp = async (model) => {
    if (b.gui === false) return;
    if (!jspWin) { const { createJspWindow } = await import("./jsp-window.js"); jspWin = createJspWindow(view, { model, onChange: (v) => viewer && viewer.setJoints(v, true) }); }
    else jspWin.setModel(model);
  };
  async function show(text, p) {
    out.hidden = false; out.className = "rvb-out";
    let res;
    try { res = await buildRobot(text, p); }
    catch (e) {
      out.className = "rvb-out err"; out.textContent = `${/xacro|name '|macro|property|substitution|Undefined/.test(e.message) && /<xacro:|xmlns:xacro/.test(text) ? "xacro: error: " : ""}${e.message}`;
      const v = await ensureViewer(); v.setModel(null, e.message.split("\n")[0]); return;
    }
    const lines = checkUrdfText(res.model);
    // then view it the conventional way: urdf_tutorial's display launch file runs xacro and starts the three nodes
    const file = res.isXacro ? "my_robot.urdf.xacro" : "my_robot.urdf", gui = b.gui !== false;
    const launch = [`$ ros2 launch urdf_tutorial display.launch.py model:=$PWD/${file}${gui ? "" : " gui:=false"}`, "[INFO] [launch]: Default logging verbosity is set to INFO",
      "[INFO] [robot_state_publisher-1]: process started with pid [4321]", `[INFO] [${gui ? "joint_state_publisher_gui" : "joint_state_publisher"}-2]: process started with pid [4322]`, "[INFO] [rviz2-3]: process started with pid [4323]"];
    out.textContent = (res.isXacro ? "$ xacro my_robot.urdf.xacro > my_robot.urdf\n" : "") + `$ check_urdf my_robot.urdf\n` + lines.join("\n") + (res.model.warnings.length ? "\n\nWarnings:\n- " + res.model.warnings.join("\n- ") : "") + "\n\n" + launch.join("\n");
    const v = await ensureViewer();
    if (!b.fixedFrame) v.setFixedFrame(res.model.root);
    v.setModel(res.model);
    const joints = {}; for (const j of movableJoints(res.model)) joints[j.name] = (await import("./rviz.js")).jspDefault(j);
    v.setJoints(joints, true);
    await ensureJsp(res.model);
    if (jspWin) jspWin.setValues(joints);
    if (b.markers) v.setMarkers(b.markers);
    if (b.imarkers) v.setIMarkers(b.imarkers);
    if (b.sensors) { v.setExtraEdges([{ parent: "odom", child: res.model.root, t: [0, 0, 0], q: [0, 0, 0, 1] }]); v.setSensors(b.sensors.demo ? demoSensors(b.sensors.demo) : b.sensors); }
    if (b.check) {
      const r = checkModel(res.model, { ...b.check, __isXacro: res.isXacro });
      if (r.ok) { pass.hidden = false; if (!done) { done = true; onComplete && onComplete(); } }
      else { pass.hidden = true; out.textContent += `\n\nNot yet. Still needed: ${r.miss.join("; ")}.${b.hint ? `\nHint: ${b.hint}` : ""}`; }
    }
  }
  if (runBtn) runBtn.addEventListener("click", () => show(ta.value, currentPath));
  if (resetBtn) resetBtn.addEventListener("click", () => { ta.value = srcText; show(ta.value, currentPath); });
  if (solBtn) solBtn.addEventListener("click", () => { if (confirm("Show the solution? Try a little longer first if you can.")) { ta.value = b.solution; show(ta.value, currentPath); } });
  (async () => {
    if (sel) {
      const list = await gallery();
      const groups = new Map(); for (const g of list) { const k = g.group || "Robots"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
      sel.replaceChildren(...[...groups].map(([k, items]) => { const og = el("optgroup"); og.label = k; og.append(...items.map((g) => el("option", { value: g.id, text: g.title }))); return og; }));
      const pick = async () => {
        const g = list.find((x) => x.id === sel.value); currentPath = `/robots/${g.file}`;
        const text = await fetchText(currentPath);
        about.hidden = false;
        about.replaceChildren(...[el("p", {}, rich(g.about)), el("p", { class: "small" }, el("b", { text: "File: " }), el("code", { text: `robots/${g.file}` }),
          " ", el("a", { href: currentPath, target: "_blank", rel: "noopener", text: /\.xacro$/.test(g.file) ? "open the xacro file" : "open the URDF file" })),
          g.real && g.real.length ? el("p", { class: "small" }, el("b", { text: "Real robots to explore: " }), ...g.real.flatMap((r, i) => [i ? " · " : "", el("a", { href: r.url, target: "_blank", rel: "noopener", text: r.title })])) : null,
          g.source ? el("p", { class: "small" }, el("b", { text: "Source: " }), el("a", { href: g.source.url, target: "_blank", rel: "noopener", text: g.source.url.replace(/^https:\/\/github.com\//, "") }), ` (${g.source.license})`) : null].filter(Boolean));
        await show(text, currentPath);
        if (viewer) viewer.setFixedFrame(g.fixedFrame);
      };
      sel.addEventListener("change", pick);
      if (b.robot) sel.value = b.robot;
      await pick();
    } else if (b.robot) {
      const list = await gallery(); const g = list.find((x) => x.id === b.robot);
      currentPath = `/robots/${g.file}`; const text = await fetchText(currentPath);
      if (ta) { ta.value = text; srcText = text; }
      await show(text, currentPath);
    } else if (srcText) await show(srcText, currentPath);
    else { const v = await ensureViewer(); if (b.markers) v.setMarkers(b.markers); if (b.sensors) v.setSensors(b.sensors.demo ? demoSensors(b.sensors.demo) : b.sensors); if (b.imarkers) v.setIMarkers(b.imarkers); }
  })().catch((e) => { view.replaceChildren(el("p", { class: "notice err", text: "The 3D viewer could not load: " + e.message })); });
}
