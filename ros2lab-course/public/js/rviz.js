// ROS2Lab practice RViz2: a browser copy of RViz2 (ROS 2 Jazzy, Ubuntu 24.04) built with three.js.
// Layout, texts, default values, colours, sizes, mouse handling and lighting follow the RViz2 jazzy
// sources (rviz_common, rviz_default_plugins, rviz_rendering). Icons are RViz's own (Public Domain).
// Used by the practice terminal, the "rviz" lesson block, the Python playground and the RViz page.
import { parseRvizYaml, rvizDisplays } from "./rviz-yaml.js";
import * as THREE from "../vendor/three/three.module.js";
import { STLLoader } from "../vendor/three/loaders/STLLoader.js";
import { urdfEdges, framePoses, movableJoints, normMarker, MARKER_TYPES, qRPY, quatToRPY } from "./urdf-core.js";
import { DESC, SCHEMA, HELP, HELP_COMMON, TOPIC_TYPES, DISPLAY_TYPES, ICONS } from "./rviz-data.js";

const IMG = new URL("../img/rviz/", import.meta.url).href;
// the Qt (Fusion) look lives in css/rviz.css; load it once for every page that shows RViz
export function loadRvizCss(doc = document) {
  if (doc.getElementById("rviz-css")) return;
  const l = doc.createElement("link"); l.id = "rviz-css"; l.rel = "stylesheet"; l.href = new URL("../css/rviz.css", import.meta.url).href; doc.head.append(l);
}
const ico = (f) => IMG + f;
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// QString::number(double): format 'g', 6 significant digits
export function qnum(v) {
  v = Number(v);
  if (!Number.isFinite(v)) return v > 0 ? "inf" : v < 0 ? "-inf" : "nan";
  if (v === 0) return "0";
  const ex = Math.floor(Math.log10(Math.abs(v)));
  const strip = (s) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
  if (ex < -4 || ex >= 6) { const [m, e] = v.toExponential(5).split("e"); const n = Number(e); return `${strip(m)}e${n < 0 ? "-" : "+"}${String(Math.abs(n)).padStart(2, "0")}`; }
  return strip(v.toFixed(Math.max(0, 5 - ex)));
}
const rgbOf = (s) => String(s).split(/[;,]\s*/).map((x) => Math.max(0, Math.min(255, Number(x) || 0)) / 255);
const vecOf = (s) => { const v = String(s).split(/[;,]\s*/).map(Number); return [v[0] || 0, v[1] || 0, v[2] || 0]; };
const IM_MODES = ["NONE", "MENU", "BUTTON", "MOVE_AXIS", "MOVE_PLANE", "ROTATE_AXIS", "MOVE_ROTATE", "MOVE_3D", "ROTATE_3D", "MOVE_ROTATE_3D"];
const ORBIT_STATUS = "<b>Left-Click:</b> Rotate.  <b>Middle-Click:</b> Move X/Y.  <b>Right-Click/Mouse Wheel:</b> Zoom.  <b>Shift:</b> More options.";
const ORBIT_SHIFT = "<b>Left-Click:</b> Move X/Y.  <b>Right-Click:</b> Move Z.  <b>Mouse Wheel:</b> Zoom.";
// RViz tools in the default order (rviz_common/default.rviz), with their shortcut keys and status texts
const TOOLS = [
  { id: "interact", name: "Interact", icon: "Interact.png", key: "i", status: ORBIT_STATUS },
  { id: "move", name: "Move Camera", icon: "MoveCamera.png", key: "m", status: ORBIT_STATUS },
  { id: "select", name: "Select", icon: "Select.png", key: "s", status: "Click and drag to select objects on the screen." },
  { id: "focus", name: "Focus Camera", icon: "FocusCamera.svg", key: "c", status: "<b>Left-Click:</b> Look in this direction." },
  { id: "measure", name: "Measure", icon: "Measure.svg", key: "n", status: "Click on two points to measure their distance. Right-click to reset." },
  { id: "pose", name: "2D Pose Estimate", icon: "SetInitialPose.png", key: "p", status: "Click and drag mouse to set position/orientation." },
  { id: "goal", name: "2D Goal Pose", icon: "SetGoal.png", key: "g", status: "Click and drag mouse to set position/orientation." },
  { id: "point", name: "Publish Point", icon: "PublishPoint.svg", key: "u", status: "Move over an object to select the target point." },
];
// Topics a display gets when it comes from a lesson or a saved .rviz file (a new display has empty topics, like RViz)
const CONFIGURED = { RobotModel: { "Description Topic": "/robot_description" }, Marker: { Topic: "/visualization_marker" }, MarkerArray: { Topic: "/visualization_marker_array" }, LaserScan: { Topic: "/scan" }, PointCloud2: { Topic: "/points" }, Path: { Topic: "/plan" }, Odometry: { Topic: "/odom" }, Map: { Topic: "/map", "Update Topic": "/map_updates" } };
const TYPE_FOR_MSG = Object.fromEntries(Object.entries(TOPIC_TYPES).filter(([t]) => !["Camera", "DepthCloud"].includes(t)).map(([t, m]) => [m, t]));
TYPE_FOR_MSG["std_msgs/msg/String"] = "RobotModel";
// message types each display plugin can show (rviz_default_plugins/plugins_description.xml <message_type>); used by Add > By topic
const MSG_TYPES = {"AccelStamped": ["geometry_msgs/msg/AccelStamped"], "Camera": ["sensor_msgs/msg/Image", "sensor_msgs/msg/CompressedImage"], "DepthCloud": ["sensor_msgs/msg/Image"], "Effort": ["sensor_msgs/msg/JointState"], "GridCells": ["nav_msgs/msg/GridCells"], "FluidPressure": ["sensor_msgs/msg/FluidPressure"], "Illuminance": ["sensor_msgs/msg/Illuminance"], "Image": ["sensor_msgs/msg/Image"], "InteractiveMarkers": ["visualization_msgs/msg/InteractiveMarkerUpdate"], "LaserScan": ["sensor_msgs/msg/LaserScan"], "Map": ["nav_msgs/msg/OccupancyGrid"], "PointCloud": ["sensor_msgs/msg/PointCloud"], "PointCloud2": ["sensor_msgs/msg/PointCloud2"], "Polygon": ["geometry_msgs/msg/PolygonStamped"], "Pose": ["geometry_msgs/msg/PoseStamped"], "PoseWithCovariance": ["geometry_msgs/msg/PoseWithCovarianceStamped"], "Range": ["sensor_msgs/msg/Range"], "RelativeHumidity": ["sensor_msgs/msg/RelativeHumidity"], "Temperature": ["sensor_msgs/msg/Temperature"], "TF": ["tf2_msgs/msg/TFMessage"], "TwistStamped": ["geometry_msgs/msg/TwistStamped"], "Marker": ["visualization_msgs/msg/Marker"], "MarkerArray": ["visualization_msgs/msg/MarkerArray"], "Odometry": ["nav_msgs/msg/Odometry"], "PoseArray": ["geometry_msgs/msg/PoseArray"], "Path": ["nav_msgs/msg/Path"], "PointStamped": ["geometry_msgs/msg/PointStamped"], "Wrench": ["geometry_msgs/msg/WrenchStamped"]};
MSG_TYPES.Imu = ["sensor_msgs/msg/Imu"];
// tool descriptions (rviz_default_plugins/plugins_description.xml)
const TOOL_DESC = { interact: "Interact with interactive markers. Mouse actions not on interactive markers fall back to moving the camera.", move: "Drag the mouse with left, middle, or right buttons to change your viewpoint.",
  select: "Drag with the left button to select objects in the 3D scene. Hold the Alt key to change viewpoint as in the Move tool.", focus: "Click onto any object to focus the camera there.",
  measure: "Click onto two locations to measure their distance.", pose: "Publish an initial pose for the robot. After one use, reverts to default tool.",
  goal: "Publish a goal pose for the robot. After one use, reverts to default tool.", point: "Allows you to click on a point and publish it as a PointStamped message." };
// widths Qt gives these tool buttons (Ubuntu Sans 9 pt): pinned so the toolbar lines up exactly
const QT_TOOL_W = { interact: 85, move: 116, select: 75, focus: 117, measure: 89, pose: 136, goal: 113, point: 113 };
const DAY_TOOLTIP = { interact: "Interact (I)", move: "Move Camera (M)", select: "Select (S)", focus: "Focus Camera (C)", measure: "Measure (N)", pose: "2D Pose Estimate (P)", goal: "2D Goal Pose (G)", point: "Publish Point (U)" };

// flat default property values from a display schema
// displays that rviz_default_plugins describes with more properties than rviz-data lists, and plugins from other packages
{
  const T = SCHEMA.Image[0];
  SCHEMA.Image = [T, ["Normalize Range", "bool", true], ["Min Value", "float", 0], ["Max Value", "float", 1], ["Median window", "int", 5]];
  SCHEMA.Camera = [T, ["Image Rendering", "enum", "background and overlay", ["background", "overlay", "background and overlay"]], ["Overlay Alpha", "float", 0.5], ["Zoom Factor", "float", 1], ["Far Plane Distance", "float", 100]];
  SCHEMA.Imu = [T, ["Box properties", "cat", null, [["Enable box", "bool", false], ["x_scale", "float", 1], ["y_scale", "float", 1], ["z_scale", "float", 1], ["Box color", "color", "255; 0; 0"], ["Box alpha", "float", 1]]],
    ["Axes properties", "cat", null, [["Enable axes", "bool", true], ["Axes scale", "float", 1]]],
    ["Acceleration properties", "cat", null, [["Enable acceleration", "bool", false], ["Derotate acceleration", "bool", true], ["Acc. vector scale", "float", 1], ["Acc. vector color", "color", "255; 0; 0"], ["Acc. vector alpha", "float", 1]]],
    ["fixed_frame_orientation", "bool", true]];
  if (!SCHEMA.LaserScan.some((p) => p[0] === "Use rainbow")) for (const t of ["LaserScan", "PointCloud2"]) SCHEMA[t].push(["Channel Name", "str", "intensity"], ["Use rainbow", "bool", true], ["Invert Rainbow", "bool", false], ["Autocompute Intensity Bounds", "bool", true], ["Axis", "enum", "Z", ["X", "Y", "Z"]], ["Color", "color", "255; 255; 255"]);
  DESC.Imu = { text: "Displays sensor_msgs/Imu messages (orientation as axes or a box, acceleration as an arrow). From the rviz_imu_plugin package (imu_tools).", url: "" };
  TOPIC_TYPES.Imu = "sensor_msgs/msg/Imu";
}
// display plugins that are not in rviz_default_plugins: present only when their package is installed
export const EXTRA_PLUGINS = { Imu: { pkg: "rviz_imu_plugin", msg: "sensor_msgs/msg/Imu", icon: "default_class_icon.png" } };
const pluginPkg = (type) => (type === "Group" ? "rviz_common" : EXTRA_PLUGINS[type] ? EXTRA_PLUGINS[type].pkg : "rviz_default_plugins");
function defaultsOf(type) {
  const out = {};
  const walk = (nodes) => { for (const [k, t, v, a, b] of nodes) { if (t !== "cat") out[k] = v; const kids = Array.isArray(a) && Array.isArray(a[0]) ? a : Array.isArray(b) ? b : null; if (kids) walk(kids); } };
  walk(SCHEMA[type] || []);
  return out;
}
export const PLUGINS = Object.fromEntries([...DISPLAY_TYPES, ...Object.keys(EXTRA_PLUGINS)].map((t) => [t, { desc: (DESC[t] || {}).text || "", props: defaultsOf(t), msg: TOPIC_TYPES[t] }]));

const setPose = (obj, T) => { obj.position.set(T.t[0], T.t[1], T.t[2]); obj.quaternion.set(T.q[0], T.q[1], T.q[2], T.q[3]); };
const meshCache = new Map();
let seq = 0;

export function jspDefault(j) {   // joint_state_publisher: 0, unless 0 is outside the limits (then the middle)
  if (j.limit && (j.limit.lower > 0 || j.limit.upper < 0)) return (j.limit.lower + j.limit.upper) / 2;
  return 0;
}

export function createRviz(container, opts = {}) {
  loadRvizCss();
  THREE.ColorManagement.enabled = false;   // Ogre has no sRGB conversion: colours go to the screen as they are
  const S = {
    model: null, modelError: null, joints: {}, haveStates: false, extraEdges: [], externalTf: !!opts.externalTf, fixedFrame: opts.fixedFrame || "map",
    background: "48; 48; 48", frameRate: 30,
    displays: [], markers: new Map(), imarkers: [], sensors: {}, title: opts.title || "", configName: opts.configName || "", dirty: false,
    tool: "interact", tools: TOOLS.map((t) => t.id), panels: { displays: true, views: opts.views !== false, time: opts.time !== false, tool: false, selection: false, help: false }, toolbar: true,
    open: new Set(["g", "gs"]), sel: null, vsel: null, tsel: null, tfOff: new Set(), linkOff: new Set(), savedViews: [],
    view: { type: "Orbit", distance: 10, yaw: 0.785398, pitch: 0.785398, focal: [0, 0, 0], near: 0.01, invertZ: false, focalSize: 0.05, focalFixed: true, scale: 10, angle: 0, x: 0, y: 0 },
  };
  const onChange = opts.onChange || (() => {});
  // plugin packages are found when RViz starts (pluginlib): a package installed later needs an RViz restart
  const installed = new Set(opts.plugins ? opts.plugins() : []);
  const availTypes = () => [...DISPLAY_TYPES, ...Object.keys(EXTRA_PLUGINS).filter((t) => installed.has(EXTRA_PLUGINS[t].pkg))];
  const resolve = opts.resolve || ((url) => url);
  const mkDisplay = (type, name, enabled = true, props = {}, configured = false) => ({ id: ++seq, type, name: name || type, enabled, props: { ...defaultsOf(type), ...(configured ? CONFIGURED[type] || {} : {}), ...props }, status: [], autoNs: configured && type === "InteractiveMarkers", autoTopic: configured && (type === "Marker" || type === "MarkerArray") });
  const asMap = () => { const m = {}; for (const d of S.displays) m[d.type] = m[d.type] || d.enabled; return m; };
  const enabled = (type) => S.displays.filter((d) => d.type === type && d.enabled);
  const first = (type) => enabled(type)[0];
  const applyDisplayMap = (map) => {
    for (const [type, on] of Object.entries(map || {})) {
      if (!PLUGINS[type]) continue;
      const d = S.displays.find((x) => x.type === type);
      if (d) d.enabled = on !== false; else S.displays.push(mkDisplay(type, type, on !== false, {}, true));
    }
  };
  applyDisplayMap({ Grid: true, ...(opts.displays || {}) });
  const changed = (what = {}) => { S.dirty = true; renderTitle(); onChange({ displays: asMap(), ...what }); };

  // ================= window: Ubuntu title bar + Qt (Fusion) main window =================
  const titleEl = h("span", { class: "rv-wtitle" });
  const wbtn = (cls, label, fn) => h("button", { type: "button", class: `rv-wb ${cls}`, title: label, "aria-label": label, onclick: fn });
  const menuBar = h("div", { class: "q-menubar", role: "menubar" });
  const toolBar = h("div", { class: "q-toolbar", role: "toolbar", "aria-label": "Tools" });
  const canvasWrap = h("div", { class: "rv-view", tabindex: "0", "aria-label": "3D view" });
  const statusHint = h("span", { class: "q-statustext" });
  const fpsEl = h("span", { class: "q-fps" });
  const status = h("div", { class: "rv-status", role: "status" });   // flat status list (screen readers and tests)
  const dialog = h("div", { class: "q-modal", hidden: true });
  const menuPop = h("div", { class: "q-menu", hidden: true, role: "menu" });
  const dock = (name, body, cls) => h("section", { class: `q-dock ${cls}` }, h("div", { class: "q-docktitle" }, h("span", { text: name }), h("button", { type: "button", class: "q-dockclose", title: "Close", "aria-label": `Close ${name}`, onclick: () => { const k = { Displays: "displays", Views: "views", Time: "time", "Tool Properties": "tool", Selection: "selection", Help: "help" }[name]; S.panels[k] = false; layout(); } }, h("img", { src: ico("close.png"), alt: "", width: "10", height: "10" }))), body);
  // Displays panel: property tree + help + buttons
  const dTree = h("div", { class: "q-tree", role: "tree", tabindex: "0", "aria-label": "Displays" });
  const dHelp = h("div", { class: "q-help" });
  const btnAdd = h("button", { type: "button", class: "q-btn", text: "Add", onclick: () => addDialog() });
  const btnDup = h("button", { type: "button", class: "q-btn", text: "Duplicate", disabled: true, onclick: () => { const d = selDisplay(); if (d) { const c = mkDisplay(d.type, d.name); c.props = { ...d.props }; c.enabled = d.enabled; S.displays.splice(S.displays.indexOf(d) + 1, 0, c); S.sel = `d${c.id}`; changed(); refresh(); } } });
  const btnRem = h("button", { type: "button", class: "q-btn", text: "Remove", disabled: true, onclick: () => { const d = selDisplay(); if (d) { S.displays.splice(S.displays.indexOf(d), 1); S.sel = null; changed(); refresh(); } } });
  const btnRen = h("button", { type: "button", class: "q-btn", text: "Rename", disabled: true, onclick: () => { const d = selDisplay(); if (d) renameDialog(d); } });
  const dispDock = dock("Displays", h("div", { class: "q-dockbody" }, h("div", { class: "q-treewrap" }, dTree, h("div", { class: "q-hsplit", "aria-hidden": "true" }), dHelp), h("div", { class: "q-btnrow" }, btnAdd, btnDup, btnRem, btnRen)), "rv-ddock");
  // Views panel
  const vType = h("select", { class: "q-combo", "aria-label": "View type" }, ...["Orbit", "XYOrbit", "TopDownOrtho"].map((t) => h("option", { value: t, text: `${t} (rviz_default_plugins)` })));
  const vTree = h("div", { class: "q-tree", role: "tree", tabindex: "0", "aria-label": "Views" });
  const vSave = h("button", { type: "button", class: "q-btn", text: "Save", onclick: () => { S.savedViews.push({ name: S.view.type, view: JSON.parse(JSON.stringify(S.view)) }); renderViews(); } });
  const vRemove = h("button", { type: "button", class: "q-btn", text: "Remove", onclick: () => { if (S.vsel != null) { S.savedViews.splice(S.vsel, 1); S.vsel = null; renderViews(); } } });
  const vRename = h("button", { type: "button", class: "q-btn", text: "Rename", onclick: () => { const v = S.savedViews[S.vsel]; if (v) textDialog("Rename View", "New Name?", v.name, (n) => { v.name = n; renderViews(); }); } });
  const viewsDock = dock("Views", h("div", { class: "q-dockbody" }, h("div", { class: "q-vtop" }, h("label", { text: "Type:" }), vType, h("button", { type: "button", class: "q-btn", text: "Zero", onclick: () => { zeroView(); } })), vTree, h("div", { class: "q-btnrow" }, vSave, vRemove, vRename)), "rv-vdock");
  // Tool Properties, Selection and Help panels (hidden at start, like RViz)
  const tTree = h("div", { class: "q-tree", role: "tree", tabindex: "0", "aria-label": "Tool Properties" });
  const toolDock = dock("Tool Properties", h("div", { class: "q-dockbody" }, tTree), "rv-tdock");
  const selTree = h("div", { class: "q-tree", role: "tree", tabindex: "0", "aria-label": "Selection" });
  const selDock = dock("Selection", h("div", { class: "q-dockbody" }, selTree), "rv-sdock");
  const helpDock = dock("Help", h("div", { class: "q-dockbody q-helpdoc", html: "<p><b>RViz</b> shows 3D data from ROS 2: robot models, TF frames, sensor data and markers.</p><p>Use <b>Add</b> to create displays, the toolbar to pick a tool, and the mouse in the 3D view to move the camera.</p>" }), "rv-hdock");
  // Time panel
  const timeFields = {};
  const tfield = (k) => (timeFields[k] = h("input", { class: "q-line", readonly: true, "aria-label": k }));
  const expCb = h("input", { type: "checkbox", class: "q-check", id: `rv-exp-${seq}` });
  const expRow = h("span", { class: "q-exp", hidden: true }, h("button", { type: "button", class: "q-btn", text: "Pause" }), h("label", { text: "Synchronization:" }), h("select", { class: "q-combo" }, ...["Off", "Exact", "Approximate"].map((x) => h("option", { text: x }))), h("label", { text: "Source:" }), h("select", { class: "q-combo" }));
  expCb.addEventListener("change", () => { expRow.hidden = !expCb.checked; });
  const timeDock = dock("Time", h("div", { class: "q-dockbody q-timebody" }, expRow, h("label", { text: "ROS Time:" }), tfield("ROS Time"), h("span", { class: "q-told" }, h("label", { text: "ROS Elapsed:" }), tfield("ROS Elapsed"), h("label", { text: "Wall Time:" }), tfield("Wall Time"), h("label", { text: "Wall Elapsed:" }), tfield("Wall Elapsed")), h("span", { class: "q-stretch" }), h("label", { class: "q-cbl", for: expCb.id }, expCb, "Experimental")), "rv-timedock");
  const left = h("div", { class: "q-dockarea q-left" }, dispDock, toolDock, selDock);
  const right = h("div", { class: "q-dockarea q-right" }, viewsDock, helpDock);
  // VisualizationFrame: left docks | dock splitter | hide-left button | render panel | hide-right button | dock splitter | right docks
  const hideL = h("button", { type: "button", class: "q-hide l", title: "Hide the left dock", "aria-label": "Hide the left dock", "aria-pressed": "false" });
  const hideR = h("button", { type: "button", class: "q-hide r", title: "Hide the right dock", "aria-label": "Hide the right dock", "aria-pressed": "false" });
  const sepL = h("div", { class: "q-sep l", "aria-hidden": "true" }), sepR = h("div", { class: "q-sep r", "aria-hidden": "true" });
  const main = h("div", { class: "q-central" }, left, sepL, hideL, canvasWrap, hideR, sepR, right);
  const statusBar = h("div", { class: "q-statusbar" }, h("button", { type: "button", class: "q-btn", text: "Reset", onclick: () => { S.markers.clear(); refresh(); opts.onReset && opts.onReset(); } }), statusHint, fpsEl);
  const root = h("div", { class: "rviz rv-win" },
    h("div", { class: "rv-titlebar" }, h("span", { class: "rv-tbspace" }), titleEl,
      h("span", { class: "rv-wbtns" },
        wbtn("min", "Minimise", () => root.classList.toggle("rv-min")),
        wbtn("max", "Maximise", () => { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen(); }),
        wbtn("close", "Close", () => msgDialog("RViz", "This practice RViz cannot be closed: it is part of the page."))),
    ),
    h("div", { class: "q-window" }, menuBar, toolBar, main, timeDock, statusBar),
    status, dialog, menuPop);
  container.replaceChildren(root);
  function renderTitle() {
    // VisualizationFrame::setDisplayConfigFile: "RViz[*]" for the default config, "<path>[*] - RViz" otherwise
    titleEl.textContent = S.configName ? `${S.configName}${S.dirty ? "*" : ""} - RViz` : `RViz${S.dirty ? "*" : ""}`;
    root.dataset.title = S.title || "";
  }

  // ================= menus (rviz_common/visualization_frame.cpp) =================
  const download = (name, blob) => { const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); };
  const MENUS = {
    File: () => [
      { t: "&Open Config", k: "Ctrl+O", fn: () => opts.onOpenConfig ? opts.onOpenConfig() : msgDialog("Open Config", "Opening .rviz files is available on the RViz page of ROS2Lab.") },
      { t: "&Save Config", k: "Ctrl+S", fn: () => (opts.onSave ? (opts.onSave(S.configName || opts.savePath || "~/my_config.rviz", configText()), S.dirty = false, renderTitle()) : download("default.rviz", new Blob([configText()], { type: "text/yaml" }))) },
      { t: "Save Config &As", k: "Ctrl+Shift+S", fn: () => saveAsDialog() },
      { t: "&Recent Configs", sub: S.configName ? [{ t: S.configName, fn: () => {} }] : [] },
      { t: "Save &Image", fn: () => { draw(true); renderer && renderer.domElement.toBlob((b) => b && download("rviz_screenshot.png", b)); } },
      { sep: true },
      { t: "&Quit", k: "Ctrl+Q", fn: () => msgDialog("RViz", "This practice RViz cannot be closed: it is part of the page.") },
    ],
    Panels: () => [
      { t: "Add &New Panel", fn: () => addPanelDialog() },
      { t: "&Delete Panel", sub: [], disabled: true },
      { t: "&Fullscreen", k: "F11", check: !!document.fullscreenElement, fn: () => { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen(); } },
      { sep: true },
      { t: "Tools", check: S.toolbar, fn: () => { S.toolbar = !S.toolbar; layout(); } },
      ...[["Displays", "displays"], ["Selection", "selection"], ["Tool Properties", "tool"], ["Views", "views"], ["Time", "time"], ...(S.panels.help || helpDock.dataset.used ? [["Help", "help"]] : [])].map(([t, k]) => ({ t, check: S.panels[k], fn: () => { S.panels[k] = !S.panels[k]; layout(); } })),
    ],
    Help: () => [
      { t: "Show &Help panel", fn: () => { S.panels.help = true; helpDock.dataset.used = "1"; layout(); } },
      { sep: true },
      { t: "&About", fn: () => msgDialog("About", "This is RViz version 14.1.24 (jazzy).\n\nCompiled against Qt version 5.15.13.\nCompiled against OGRE version 1.12.10 (Rhagorthua).\n\n(ROS2Lab practice copy for the browser. RViz icons are Public Domain; RViz is BSD licensed.)") },
    ],
  };
  for (const name of Object.keys(MENUS)) menuBar.append(h("button", { type: "button", class: "q-mitem", role: "menuitem", text: name, onclick: (e) => openMenu(e.currentTarget, MENUS[name](), name) }));
  function openMenu(anchor, items, key, at) {
    if (!menuPop.hidden && menuPop.dataset.for === key) { closeMenu(); return; }
    menuPop.dataset.for = key;
    // QMenu (Fusion): check column, label with its &mnemonic underlined, shortcut column, submenu arrow
    const label = (t) => { const i = t.indexOf("&"); return i < 0 ? [t] : [t.slice(0, i), h("u", { text: t[i + 1] }), t.slice(i + 2)]; };
    const hasKeys = items.some((it) => it.k);
    const build = (list) => list.map((it) => it.sep ? h("div", { class: "q-msep" }) : h("button", { type: "button", class: `q-mi${it.disabled ? " dis" : ""}`, role: "menuitem", disabled: it.disabled, "aria-label": it.t.replace("&", ""),
      onclick: (e) => { if (it.sub) { e.stopPropagation(); return; } closeMenu(); it.fn && it.fn(); } },
      h("span", { class: "q-mchk" }, it.check !== undefined ? h("span", { class: `q-checkbox${it.check ? " on" : ""}` }) : null), h("span", { class: "q-mt" }, label(it.t)), h("span", { class: "q-mk", text: it.k || "" }), h("span", { class: `q-msub${it.sub ? " on" : ""}` })));
    menuPop.classList.toggle("keys", hasKeys);
    menuPop.replaceChildren(...build(items));
    const R = root.getBoundingClientRect();
    if (at) { menuPop.style.left = `${at[0] - R.left}px`; menuPop.style.top = `${at[1] - R.top}px`; }
    else { const r = anchor.getBoundingClientRect(); menuPop.style.left = `${r.left - R.left}px`; menuPop.style.top = `${r.bottom - R.top}px`; }
    menuPop.hidden = false;
    menuBar.querySelectorAll(".q-mitem").forEach((b) => b.classList.toggle("open", b === anchor));
  }
  function closeMenu() { menuPop.hidden = true; menuPop.dataset.for = ""; menuBar.querySelectorAll(".q-mitem").forEach((b) => b.classList.remove("open")); }
  const outside = (e) => { if (!menuPop.contains(e.target) && !menuBar.contains(e.target) && !e.target.closest?.(".q-tbmenu")) closeMenu(); };
  document.addEventListener("pointerdown", outside, true);

  // ================= toolbar (TextBesideIcon, 0.9x font) =================
  function renderToolbar() {
    const btns = S.tools.map((id) => { const t = TOOLS.find((x) => x.id === id); const svg = t.icon.endsWith(".svg");   // Qt draws PNG icons at their own 16 px and scales SVG icons to the 24 px toolbar size
      return h("button", { type: "button", class: `q-tool${svg ? " i24" : ""}${S.tool === id ? " on" : ""}`, "data-tool": id, style: `width:${QT_TOOL_W[id]}px`, title: DAY_TOOLTIP[id], "aria-pressed": String(S.tool === id), onclick: () => setTool(id) }, h("img", { src: ico(t.icon), alt: "", width: svg ? "24" : "16", height: svg ? "24" : "16" }), h("span", { text: t.name })); });
    const plus = h("button", { type: "button", class: "q-tool q-plus", title: "Add a new tool", "aria-label": "Add a new tool", onclick: () => addToolDialog() }, h("img", { src: ico("plus.png"), alt: "", width: "16", height: "16" }));
    const minus = h("button", { type: "button", class: "q-tool q-tbmenu", title: "Remove a tool from the toolbar", "aria-label": "Remove a tool from the toolbar", onclick: (e) => openMenu(e.currentTarget, S.tools.map((id) => ({ t: TOOLS.find((x) => x.id === id).name, fn: () => { S.tools = S.tools.filter((x) => x !== id); if (S.tool === id) setTool(S.tools[0] || "interact"); renderToolbar(); } })), "minus") }, h("img", { src: ico("minus.png"), alt: "", width: "16", height: "16" }), h("span", { class: "q-ddarrow", "aria-hidden": "true" }));
    toolBar.replaceChildren(h("span", { class: "q-grip", "aria-hidden": "true" }), ...btns, plus, minus);
  }
  function setTool(id) {
    S.tool = id; measureStart = null; measureLine.visible = false;
    renderToolbar();
    setStatus(TOOLS.find((t) => t.id === id).status);
    renderToolProps();
  }
  const setStatus = (html) => { statusHint.innerHTML = html; };
  canvasWrap.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = TOOLS.find((x) => x.key === e.key.toLowerCase() && S.tools.includes(x.id)); if (t) { setTool(t.id); e.preventDefault(); }
  });
  root.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); MENUS.File()[1].fn(); }
    else if ((e.ctrlKey || e.metaKey) && k === "o") { e.preventDefault(); MENUS.File()[0].fn(); }
    else if (e.key === "F11") { e.preventDefault(); MENUS.Panels()[2].fn(); }
    else if (e.key === "Escape") { closeMenu(); if (!dialog.hidden) close(); }
  });

  // ================= 3D scene (Z up, like ROS) =================
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false }); renderer.outputColorSpace = THREE.LinearSRGBColorSpace; }
  catch { canvasWrap.append(h("p", { class: "rv-nogl", text: "3D graphics (WebGL) are not available in this browser, so the viewer cannot draw. Try Chrome or Firefox, or another device." })); }
  const scene = new THREE.Scene();
  const bg = () => { const c = rgbOf(S.background); scene.background = new THREE.Color(c[0], c[1], c[2]); };
  bg();
  const persp = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);   // Ogre default vertical FOV: 45 degrees
  persp.up.set(0, 0, 1);
  const ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, -1000, 1000);
  let camera = persp;
  // One white directional light that always shines along the camera's view direction, no ambient light
  // (rviz_rendering/ogre_render_window_impl.cpp + VisualizationManager::onUpdate)
  const light = new THREE.DirectionalLight(0xffffff, Math.PI);
  scene.add(light, light.target);
  const world = new THREE.Group(); scene.add(world);
  const gridG = new THREE.Group(), robotG = new THREE.Group(), tfG = new THREE.Group(), markerG = new THREE.Group(), imG = new THREE.Group(), sensorG = new THREE.Group(), axesG = new THREE.Group(), toolG = new THREE.Group();
  world.add(gridG, robotG, tfG, markerG, imG, sensorG, axesG, toolG);
  // focal point: yellow sphere, alpha 0.5, flattened to 1/5 in z, shown while dragging (orbit_view_controller.cpp)
  const focal = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshLambertMaterial({ color: new THREE.Color(1, 1, 0), transparent: true, opacity: 0.5, depthWrite: false }));
  focal.visible = false; scene.add(focal);
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    canvasWrap.append(renderer.domElement);
    renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  const viewSize = () => { const w = canvasWrap.clientWidth || 600, hh = canvasWrap.clientHeight || 400; return [w, hh]; };
  const resize = () => {
    if (!renderer) return;
    const [w, hh] = viewSize();
    renderer.setSize(w, hh, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
    if (S.autoFit) fitView(); else applyView();   // keep the robot framed until the student moves the camera
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; if (ro) ro.observe(canvasWrap);
  let pending = false, frames_ = 0, lastFps = performance.now();
  function draw(now = false) {
    if (!renderer) return;
    const go = () => {
      pending = false;
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      light.position.copy(camera.position); light.target.position.copy(camera.position).add(dir);
      renderer.render(scene, camera); frames_++;
      const t = performance.now(); if (t - lastFps > 1000) { fpsEl.textContent = `${Math.round((frames_ * 1000) / (t - lastFps))} fps`; frames_ = 0; lastFps = t; }
    };
    if (now) { go(); return; }
    if (pending) return; pending = true; requestAnimationFrame(go);
  }
  let onScreen = true;
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((en) => { onScreen = en.some((x) => x.isIntersecting); }) : null; if (io) io.observe(root);
  const ticker = setInterval(() => { if (root.isConnected && onScreen && !document.hidden && renderer) draw(); }, 1000 / 30);   // Frame Rate 30, like Global Options

  // ================= view controllers (Orbit / XYOrbit / TopDownOrtho), RViz's own arithmetic =================
  function applyView() {
    const V = S.view, [w, hh] = viewSize();
    if (V.type === "TopDownOrtho") {
      camera = ortho;
      const sx = w / 2 / V.scale, sy = hh / 2 / V.scale;
      ortho.left = -sx; ortho.right = sx; ortho.top = sy; ortho.bottom = -sy;
      ortho.position.set(V.x, V.y, 500); ortho.up.set(-Math.sin(V.angle), Math.cos(V.angle), 0); ortho.lookAt(V.x, V.y, 0);
      ortho.updateProjectionMatrix();
    } else {
      camera = persp;
      persp.near = Math.max(1e-4, V.near); persp.aspect = w / Math.max(1, hh); persp.updateProjectionMatrix();
      let yaw = V.yaw, pitch = V.pitch; const up = new THREE.Vector3(0, 0, 1);
      if (V.invertZ) { yaw = -yaw; pitch = -pitch; up.set(0, 0, -1); }
      const f = V.focal;
      persp.position.set(V.distance * Math.cos(yaw) * Math.cos(pitch) + f[0], V.distance * Math.sin(yaw) * Math.cos(pitch) + f[1], V.distance * Math.sin(pitch) + f[2]);
      persp.up.copy(up); persp.lookAt(f[0], f[1], f[2]);
      const s = V.focalSize * (V.focalFixed ? 1 : V.distance); focal.scale.set(s, s, s / 5); focal.position.set(...f);
    }
    draw(); renderViewValues();
  }
  const mapAngle = (a) => { a %= 2 * Math.PI; return a < 0 ? a + 2 * Math.PI : a; };
  function moveFocal(x, y, z) {   // like OrbitViewController::move: in camera coordinates
    const q = persp.quaternion, v = new THREE.Vector3(x, y, z).applyQuaternion(q);
    S.view.focal = [S.view.focal[0] + v.x, S.view.focal[1] + v.y, S.view.focal[2] + v.z];
    if (S.view.type === "XYOrbit") S.view.focal[2] = 0;
  }
  function zeroView() { S.autoFit = false; Object.assign(S.view, { distance: 10, yaw: 0.785398, pitch: 0.785398, focal: [0, 0, 0], scale: 10, angle: 0, x: 0, y: 0 }); applyView(); }
  vType.addEventListener("change", () => { S.view.type = vType.value; if (vType.value === "XYOrbit") S.view.focal[2] = 0; applyView(); renderViews(); });
  // mouse handling on the 3D view
  let drag = null, lastTouch = null;
  const vp = (ev) => { const r = renderer.domElement.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top, r.width, r.height]; };
  function viewDrag(dx, dy, btn, shift) {
    S.autoFit = false;
    const V = S.view, [w, hh] = viewSize();
    if (V.type === "TopDownOrtho") {
      if (btn === 0 && !shift) V.angle -= dx * 0.005;
      else if (btn === 1 || (btn === 0 && shift)) { const c = Math.cos(V.angle), s = Math.sin(V.angle), mx = -dx / V.scale, my = dy / V.scale; V.x += c * mx - s * my; V.y += s * mx + c * my; }
      else if (btn === 2) V.scale *= 1 - dy * 0.01;
      V.scale = Math.max(1e-3, V.scale);
    } else if (btn === 0 && !shift) { V.yaw = mapAngle(V.yaw - dx * 0.005); V.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, V.pitch + dy * 0.005)); }
    else if (btn === 1 || (btn === 0 && shift)) {
      const fovY = THREE.MathUtils.degToRad(persp.fov), fovX = 2 * Math.atan(Math.tan(fovY / 2) * persp.aspect);
      moveFocal(-(dx / w) * V.distance * Math.tan(fovX / 2) * 2, (dy / hh) * V.distance * Math.tan(fovY / 2) * 2, 0);
    } else if (btn === 2) {
      if (shift) moveFocal(0, 0, dy * 0.1 * (V.distance / 10));
      else V.distance = Math.max(0.001, V.distance + dy * 0.1 * (V.distance / 10));
    }
    applyView();
  }
  const camTools = () => ["interact", "move", "select", "focus", "measure"].includes(S.tool);
  if (renderer) {
    const el = renderer.domElement;
    el.addEventListener("pointerdown", (ev) => {
      canvasWrap.focus({ preventScroll: true }); closeMenu();
      if (ev.pointerType === "touch") return;
      if (S.tool === "interact" && ev.button === 0 && imDown(ev)) return;
      if (S.tool === "interact" && ev.button === 2 && imMenu(ev)) return;
      if ((S.tool === "pose" || S.tool === "goal") && ev.button === 0) { const p = ground(ev); if (p) { poseStart = p; el.setPointerCapture(ev.pointerId); } return; }
      if (S.tool === "measure" && ev.button === 2) { measureStart = null; measureLine.visible = false; lastLength = 0; setStatus(TOOLS[4].status); draw(); return; }
      if (!camTools() && ev.button === 0) return;
      if (S.tool === "select" && ev.button === 0) { selStart = vp(ev); el.setPointerCapture(ev.pointerId); return; }
      drag = { x: ev.clientX, y: ev.clientY, btn: ev.button, moved: false };
      if (S.view.type !== "TopDownOrtho") focal.visible = true;
      el.setPointerCapture(ev.pointerId); draw();
    });
    el.addEventListener("pointermove", (ev) => {
      if (ev.pointerType === "touch") return;
      if (imDrag) { imMove(ev); return; }
      if (drag) { const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY; if (dx || dy) drag.moved = true; setStatus(ev.shiftKey ? ORBIT_SHIFT : ORBIT_STATUS); viewDrag(dx, dy, drag.btn, ev.shiftKey); return; }
      if (selStart) { const p = vp(ev); selBox.hidden = false; Object.assign(selBox.style, { left: `${Math.min(p[0], selStart[0])}px`, top: `${Math.min(p[1], selStart[1])}px`, width: `${Math.abs(p[0] - selStart[0])}px`, height: `${Math.abs(p[1] - selStart[1])}px` }); return; }
      toolHover(ev);
    });
    el.addEventListener("pointerup", (ev) => {
      if (ev.pointerType === "touch") return;
      if (imDrag) { imUp(ev); return; }
      if (drag) { const wasClick = !drag.moved; drag = null; focal.visible = false; draw(); if (wasClick && ev.button === 0) toolClick(ev); return; }
      if (selStart) { selBox.hidden = true; doSelect(ev); selStart = null; return; }
      if (poseStart) { poseUp(ev); return; }
      if (ev.button === 0) toolClick(ev);
    });
    el.addEventListener("wheel", (ev) => {
      ev.preventDefault(); S.autoFit = false;
      const V = S.view, d = -Math.sign(ev.deltaY) * 120 * Math.min(3, Math.max(1, Math.abs(ev.deltaY) / 100));
      if (V.type === "TopDownOrtho") V.scale = Math.max(1e-3, V.scale * (1 + d * 0.001));
      else if (ev.shiftKey) moveFocal(0, 0, -d * 0.001 * V.distance);
      else V.distance = Math.max(0.001, V.distance - d * 0.001 * V.distance);
      applyView();
    }, { passive: false });
    // touch: one finger rotates, two fingers move and zoom
    el.addEventListener("touchstart", (e) => { lastTouch = [...e.touches].map((t) => [t.clientX, t.clientY]); if (S.view.type !== "TopDownOrtho") focal.visible = true; }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const now = [...e.touches].map((t) => [t.clientX, t.clientY]);
      if (lastTouch && now.length === 1 && lastTouch.length >= 1) viewDrag(now[0][0] - lastTouch[0][0], now[0][1] - lastTouch[0][1], 0, false);
      else if (lastTouch && now.length >= 2 && lastTouch.length >= 2) {
        const mid = (p) => [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2], dist = (p) => Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
        const m0 = mid(lastTouch), m1 = mid(now); viewDrag(m1[0] - m0[0], m1[1] - m0[1], 1, false);
        const r = dist(lastTouch) / Math.max(1, dist(now));
        if (S.view.type === "TopDownOrtho") S.view.scale /= r; else S.view.distance = Math.max(0.001, S.view.distance * r);
        applyView();
      }
      lastTouch = now;
    }, { passive: false });
    el.addEventListener("touchend", () => { lastTouch = null; focal.visible = false; draw(); });
  }
  const selBox = h("div", { class: "rv-selbox", hidden: true }); canvasWrap.append(selBox);

  let fitTimer = null;
  const scheduleFit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (S.autoFit) fitView(); draw(); }, 120); };   // meshes arrive one by one: frame the whole robot once they are in
  function fitView() {
    S.autoFit = true;
    world.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const g of [robotG, markerG, sensorG, imG]) g.traverseVisible((o) => { if (o.isMesh || o.isPoints || o.isInstancedMesh) box.expandByObject(o); });
    if (box.isEmpty()) { applyView(); return; }
    const size = Math.max(0.4, box.getSize(new THREE.Vector3()).length()), c = box.getCenter(new THREE.Vector3());
    if (S.view.type === "TopDownOrtho") { S.view.x = c.x; S.view.y = c.y; S.view.scale = Math.min(viewSize()[0], viewSize()[1]) / (size * 1.4); }
    else {   // frame the robot like a tutorial .rviz config: the whole model inside the narrower field of view
      const [w, hh] = viewSize(), fy = THREE.MathUtils.degToRad(persp.fov), fx = 2 * Math.atan(Math.tan(fy / 2) * Math.max(0.5, w / Math.max(1, hh)));   // a squeezed view never zooms out to infinity
      S.view.focal = [c.x, c.y, S.view.type === "XYOrbit" ? 0 : c.z]; S.view.distance = Math.max(S.model ? 0.5 : 3, (size * 0.85) / Math.tan(Math.min(fx, fy) / 2));   // markers only: not closer than 3 m
    }
    applyView();
  }

  // ================= materials, meshes, helpers =================
  // Ogre fixed-function look: Lambert, ambient term unused (scene ambient is black)
  const matCache = new Map();
  const mat = (rgba, extraAlpha = 1, wire = false) => {
    const a = (rgba ? rgba[3] : 1) * extraAlpha, key = `${rgba ? rgba.join(",") : "red"}|${a}|${wire}`;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color: new THREE.Color(rgba ? rgba[0] : 1, rgba ? rgba[1] : 0, rgba ? rgba[2] : 0), transparent: a < 1, opacity: a, wireframe: wire, depthWrite: a >= 1 }));
    return matCache.get(key);
  };
  const loadMesh = (url, ext) => {
    const key = `${ext}|${url}`;
    if (!meshCache.has(key)) meshCache.set(key, (async () => {
      if (ext === "stl") return { geo: await new Promise((res, rej) => new STLLoader().load(url, res, undefined, rej)) };
      if (ext === "dae") { const { ColladaLoader } = await import("../vendor/three/loaders/ColladaLoader.js"); const r = await new Promise((res, rej) => new ColladaLoader().load(url, res, undefined, rej)); return { scene: r.scene, own: true }; }
      if (ext === "obj") {   // assimp (RViz2) reads the OBJ's mtllib: its materials (colours, textures) are the mesh's own
        const { OBJLoader } = await import("../vendor/three/loaders/OBJLoader.js");
        const res = await fetch(url); if (!res.ok) throw new Error(`Unable to open file (${res.status})`);
        const txt = await res.text(), lib = (txt.match(/^mtllib\s+(.+?)\s*$/m) || [])[1], loader = new OBJLoader();
        let own = false;
        if (lib) { try { const { MTLLoader } = await import("../vendor/three/loaders/MTLLoader.js"); const mats = await new MTLLoader().loadAsync(new URL(lib, new URL(url, location.href)).href); mats.preload(); loader.setMaterials(mats); own = true; } catch { /* no .mtl: the link colour (or ShadedRed) is used */ } }
        return { scene: loader.parse(txt), own };
      }
      throw new Error(`unsupported mesh type .${ext}`);
    })());
    return meshCache.get(key);
  };
  const cyl = (seg = 20) => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, seg); return g; };   // rviz_cylinder.mesh: diameter 1, height 1
  const CYL = cyl(), CONE = new THREE.ConeGeometry(0.5, 1, 20);
  CYL.userData.shared = CONE.userData.shared = true;   // reused by every arrow and axes: never disposed with a display
  const geomMesh = (g, material, onErr, alpha = 1, force = false) => {   // force: the URDF visual has a <material> (robot_link.cpp: it replaces the mesh's own)
    if (g.type === "box") return new THREE.Mesh(new THREE.BoxGeometry(...g.size), material);
    if (g.type === "sphere") return new THREE.Mesh(new THREE.SphereGeometry(g.radius, 24, 16), material);
    if (g.type === "cylinder") { const geo = new THREE.CylinderGeometry(g.radius, g.radius, g.length, 24); geo.rotateX(Math.PI / 2); return new THREE.Mesh(geo, material); }
    if (g.type === "mesh") {
      const holder = new THREE.Group(); holder.scale.set(...g.scale);
      const url = resolve(g.filename);
      const ext = String(g.filename).split(".").pop().toLowerCase();
      if (!url) { onErr(`Could not load resource [${g.filename}]: Unable to open file "${g.filename}".`, "Mesh"); return holder; }
      loadMesh(url, ext).then((r) => {
        if (r.geo) holder.add(new THREE.Mesh(r.geo, material));
        else {
          const sc = r.scene.clone(true);
          const wrap = new THREE.Group(); if (ext === "dae") wrap.rotation.x = Math.PI / 2;   // three.js turns Collada to Y-up; ROS is Z-up
          if (!r.own || force) sc.traverse((o) => { if (o.isMesh) o.material = material; });
          else sc.traverse((o) => { if (o.isMesh) { const ms = (Array.isArray(o.material) ? o.material : [o.material]).map((m0) => { const m = new THREE.MeshLambertMaterial({ color: m0.color ? m0.color.clone() : new THREE.Color(1, 1, 1), map: m0.map || null, transparent: alpha < 1, opacity: alpha }); return m; }); o.material = Array.isArray(o.material) ? ms : ms[0]; } });
          wrap.add(sc); holder.add(wrap);
        }
        if (S.autoFit) scheduleFit(); else draw();
      }, (e) => onErr(`Could not load resource [${g.filename}]: ${e && e.message ? e.message : "Unable to open file"}`, "Mesh"));
      return holder;
    }
    return new THREE.Group();
  };
  // MovableText-like label: a camera-facing sprite, character height in metres
  const textSprite = (txt, height, rgba = [1, 1, 1, 1], below = false) => {
    const c = document.createElement("canvas"), ctx = c.getContext("2d"), fs = 64, font = `${fs}px "Liberation Sans", "RViz Liberation Sans", Arimo, Arial, sans-serif`;
    ctx.font = font; const w = Math.ceil(ctx.measureText(txt).width) + 8;
    c.width = w; c.height = Math.round(fs * 1.25); ctx.font = font; ctx.fillStyle = `rgba(${rgba[0] * 255},${rgba[1] * 255},${rgba[2] * 255},${rgba[3]})`; ctx.textBaseline = "top"; ctx.fillText(txt, 4, Math.round(fs * 0.1));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    const H = height * 1.25; sp.scale.set((H * c.width) / c.height, H, 1);
    if (below) sp.center.set(0.5, 1);
    return sp;
  };
  const rod = (a, b, d, material) => {   // cylinder of diameter d between two points
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const m = new THREE.Mesh(CYL, material); m.scale.set(d, Math.max(len, 1e-6), d);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    if (len > 1e-9) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    return m;
  };
  // rviz_rendering::Arrow(shaft_length, shaft_diameter, head_length, head_diameter), pointing along +y of its node
  const rvArrow = (shaftL, shaftD, headL, headD, shaftMat, headMat) => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(CYL, shaftMat); s.scale.set(shaftD, Math.max(shaftL, 1e-6), shaftD); s.position.y = shaftL / 2;
    const c = new THREE.Mesh(CONE, headMat || shaftMat); c.scale.set(headD, Math.max(headL, 1e-6), headD); c.position.y = shaftL + headL / 2;
    g.add(s, c); return g;
  };
  const arrowBetween = (from, to, shaftD, headD, material, headL) => {
    const A = new THREE.Vector3(...from), B = new THREE.Vector3(...to), len = A.distanceTo(B);
    const g = new THREE.Group(); if (len < 1e-9) return g;
    const hl = Math.min(len, headL ?? Math.min(len * 0.3, Math.max(headD, 1e-3) * 1.5));
    const a = rvArrow(len - hl, shaftD, hl, headD, material); a.position.copy(A); a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    g.add(a); return g;
  };
  const axesObj = (L, D, alpha = 1) => {   // rviz_rendering::Axes(length, radius): x red, y green, z blue
    const g = new THREE.Group();
    const x = new THREE.Mesh(CYL, mat([1, 0, 0, 1], alpha)); x.scale.set(D, L, D); x.position.x = L / 2; x.rotation.z = -Math.PI / 2;
    const y = new THREE.Mesh(CYL, mat([0, 1, 0, 1], alpha)); y.scale.set(D, L, D); y.position.y = L / 2;
    const z = new THREE.Mesh(CYL, mat([0, 0, 1, 1], alpha)); z.scale.set(D, L, D); z.position.z = L / 2; z.rotation.x = Math.PI / 2;
    g.add(x, y, z); return g;
  };

  // ================= frames =================
  let poses = {}, frameErr = null, frames = [];
  const edges = () => [...(S.model && !S.externalTf ? urdfEdges(S.model, S.joints, S.haveStates) : []), ...S.extraEdges];
  function computeFrames() {
    const r = framePoses(edges(), S.fixedFrame);
    poses = r.poses; frameErr = r.err || null; frames = r.frames || [];
    if (frameErr && (!opts.topics || opts.lesson) && S.model && S.fixedFrame === S.model.root && !edges().length) { frameErr = null; frames = [S.model.root]; }
    if (!poses[S.fixedFrame]) poses[S.fixedFrame] = { t: [0, 0, 0], q: [0, 0, 0, 1] };
  }
  const refFrame = (v) => (v === "<Fixed Frame>" || !v ? S.fixedFrame : v);
  const st = (level, text, key) => [level, text, key];

  // ================= Grid and Axes =================
  function buildGrid() {
    gridG.clear(); axesG.clear();
    for (const d of enabled("Grid")) {
      const p = d.props, n = Math.max(1, Math.round(p["Plane Cell Count"])), cs = Number(p["Cell Size"]) || 1, nz = Math.max(0, Math.round(p["Normal Cell Count"] || 0));
      const c = rgbOf(p.Color), pts = [], half = (n * cs) / 2;
      for (let k = 0; k <= nz; k++) {
        const z = (k - nz / 2) * cs * (nz ? 1 : 0);
        for (let i = 0; i <= n; i++) { const v = -half + i * cs; pts.push(v, -half, z, v, half, z, -half, v, z, half, v, z); }
      }
      if (nz) for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const x = -half + i * cs, y = -half + j * cs; pts.push(x, y, (-nz / 2) * cs, x, y, (nz / 2) * cs); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(...c), transparent: true, opacity: Number(p.Alpha), depthWrite: false }));
      if (p.Plane === "XZ") lines.rotation.x = Math.PI / 2; else if (p.Plane === "YZ") lines.rotation.y = Math.PI / 2;
      lines.position.set(...vecOf(p.Offset));
      const T = poses[refFrame(p["Reference Frame"])]; const hold = new THREE.Group(); if (T) setPose(hold, T); hold.add(lines); gridG.add(hold);
      d.status = T ? [] : [st("error", `Frame [${refFrame(p["Reference Frame"])}] does not exist`, "Transform")];
    }
    for (const d of enabled("Axes")) {
      const p = d.props, T = poses[refFrame(p["Reference Frame"])];
      d.status = T ? [] : [st("error", `Could not transform from [${refFrame(p["Reference Frame"])}] to Fixed Frame [${S.fixedFrame}]`, "Transform")];
      if (!T) continue;
      const hold = new THREE.Group(); setPose(hold, T); hold.add(axesObj(Number(p.Length), Number(p.Radius), Number(p.Alpha ?? 1))); axesG.add(hold);
    }
  }

  // ================= RobotModel =================
  const linkObjs = new Map(); let robotMsgs = [];
  const robotDisplay = () => S.displays.find((x) => x.type === "RobotModel");
  const topicOk = (v, want) => !want || [want, "/" + want].includes(v) || [v, "/" + v].includes(want);
  // with a ROS graph (terminal, rosbridge): the description topic must exist and have a publisher (robot_state_publisher)
  const descPublished = (v) => { const list = opts.topics ? opts.topics() : []; if (!opts.topics || !list.length) return topicOk(v, "/robot_description"); const name = v.startsWith("/") ? v : "/" + v; const t = list.find((x) => x.name === name); return !!t && t.type === "std_msgs/msg/String" && t.pubs !== 0; };
  function buildRobot() {
    robotG.clear(); linkObjs.clear(); robotMsgs = [];
    if (!S.model) return;
    const d = robotDisplay(), alpha = d ? Number(d.props.Alpha) : 1;
    const err = (e, key) => { if (!robotMsgs.some((m) => m[1] === e)) robotMsgs.push(st("error", e, key || "URDF")); refresh(true); };
    for (const l of Object.values(S.model.links)) {
      const g = new THREE.Group(), vis = new THREE.Group(), col = new THREE.Group();
      const linkRgba = (l.visuals.find((v) => v.rgba) || {}).rgba || null;   // RViz: no <material> means RVIZ/ShadedRed
      for (const v of l.visuals) { const m0 = mat(v.rgba || linkRgba || [1, 0, 0, 1], alpha); const m = geomMesh(v.geom, m0, err, alpha, !!(v.rgba || linkRgba)); setPose(m, { t: v.origin.xyz, q: qRPY(...v.origin.rpy) }); vis.add(m); }
      for (const c of l.collisions) { const m0 = mat(linkRgba || [1, 0, 0, 1], alpha); const m = geomMesh(c.geom, m0, err, alpha, true); setPose(m, { t: c.origin.xyz, q: qRPY(...c.origin.rpy) }); col.add(m); }
      const ax = axesObj(0.1, 0.01); ax.visible = false;
      g.add(vis, col, ax); g.userData = { vis, col, ax, link: l.name }; robotG.add(g); linkObjs.set(l.name, g);
    }
  }
  function placeRobot() {
    const d = first("RobotModel"), missing = [];
    const show = d && d.props["Description Source"] === "Topic" && d.props["Description Topic"] && descPublished(d.props["Description Topic"]) && S.model;
    for (const [name, g] of linkObjs) {
      const T = poses[name];
      g.visible = !!T && !!show && !S.linkOff.has(name);
      if (T) setPose(g, T); else missing.push(name);
      g.userData.vis.visible = !d || d.props["Visual Enabled"] !== false; g.userData.col.visible = !!d && !!d.props["Collision Enabled"];
      g.userData.ax.visible = !!(d && d.props[`link:${name}:Show Axes`]);
    }
    for (const dd of S.displays.filter((x) => x.type === "RobotModel")) {
      const s = [];
      if (dd.props["Description Source"] === "File") s.push(st("error", "No URDF file was selected. Choose Description Source: Topic and the /robot_description topic.", "URDF"));
      else if (!dd.props["Description Topic"]) s.push(st("error", "Error subscribing: Empty topic name", "Topic"));
      else if (opts.topics && !descPublished(dd.props["Description Topic"])) s.push(st("ok", "OK", "Topic"));   // subscribed, nothing published on it (yet)
      else if (!opts.topics && !topicOk(dd.props["Description Topic"], "/robot_description")) s.push(st("warn", `No messages received on ${dd.props["Description Topic"]}`, "Topic"));
      else if (S.modelError) s.push(st("error", "URDF failed Model parse", "URDF"));
      else if (!S.model) s.push(st("warn", "No robot description received (is robot_state_publisher running?)", "URDF"));
      else {
        if (opts.topics) s.push(st("ok", `1 messages received at ${(1 / Math.max(1, (Date.now() - (dd.subAt || (dd.subAt = Date.now()))) / 1000)).toFixed(1)} hz.`, "Topic"));
        s.push(st("ok", "URDF parsed OK", "URDF"));
        if (missing.length) s.push(st("error", `No transform from [${missing[0]}] to [${S.fixedFrame}]${missing.length > 1 ? ` (and ${missing.length - 1} more links)` : ""}${!S.haveStates && missing.some((l) => Object.values(S.model.joints).some((j) => j.child === l && !["fixed", "floating", "planar"].includes(j.type))) ? ". Moving joints need /joint_states: start joint_state_publisher(_gui)." : ""}`, "Transform"));
      }
      s.push(...robotMsgs);
      (S.model && dd.props["Description Topic"] ? S.model.warnings.filter((w) => !/mass|ixx|inertia/i.test(w)) : []).forEach((w) => s.push(st("warn", w, "URDF")));
      dd.status = s;
    }
    return missing;
  }

  // ================= TF display (tf_display.cpp, frame_info.cpp) =================
  const ARROW_HEAD = mat([1.0, 0.1, 0.6, 1]), ARROW_SHAFT = mat([0.8, 0.8, 0.3, 1]);
  const labelCache = new Map();
  function tfFrameVisible(d, f) {
    if (S.tfOff.has(f)) return false;
    try { if (d.props["Filter (whitelist)"] && !new RegExp(d.props["Filter (whitelist)"]).test(f)) return false; if (d.props["Filter (blacklist)"] && new RegExp(d.props["Filter (blacklist)"]).test(f)) return false; } catch { /* bad regex: show all */ }
    return true;
  }
  function buildTF() {
    tfG.clear();
    const d = first("TF"); if (!d) return;
    d.status = [];
    if (frameErr) return;
    const sc = Number(d.props["Marker Scale"]) || 1;
    for (const f of Object.keys(poses)) {
      if (!tfFrameVisible(d, f)) continue;
      const P = poses[f];
      if (d.props["Show Axes"]) { const g = axesObj(0.2 * sc, 0.02 * sc); setPose(g, P); tfG.add(g); }
      if (d.props["Show Names"]) {
        const key = `${f}|${sc}`; if (!labelCache.has(key)) labelCache.set(key, textSprite(f, 0.1 * sc, [1, 1, 1, 1], true));
        const sp = labelCache.get(key).clone(); sp.position.set(...P.t); tfG.add(sp);
      }
    }
    if (d.props["Show Arrows"]) {
      for (const e of edges()) {
        const c = poses[e.child], p = poses[e.parent];
        if (!c || !p || !tfFrameVisible(d, e.child) || !tfFrameVisible(d, e.parent)) continue;
        const A = new THREE.Vector3(...c.t), B = new THREE.Vector3(...p.t), dist = A.distanceTo(B);
        if (dist <= 1e-6) continue;
        const headL = dist < 0.1 * sc ? 0.1 * sc * dist : 0.1 * sc;
        const a = rvArrow(dist - headL, 0.01 * sc, headL, 0.04 * sc, ARROW_SHAFT, ARROW_HEAD);
        a.position.copy(A); a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
        tfG.add(a);
      }
    }
  }

  // ================= markers =================
  let markerMsgs = [];
  function markerObject(m) {
    const material = mat(m.c);
    const g = new THREE.Group();
    const P = m.points;
    switch (MARKER_TYPES[m.type]) {
      case "ARROW":
        if (P.length >= 2) g.add(arrowBetween(P[0], P[1], m.s[0], m.s[1], material, m.s[2] || undefined));
        else { const a = rvArrow(m.s[0] * 0.77, m.s[1], m.s[0] * 0.23, m.s[2], material); a.rotation.z = -Math.PI / 2; g.add(a); }
        break;
      case "CUBE": g.add(new THREE.Mesh(new THREE.BoxGeometry(...m.s), material)); break;
      case "SPHERE": { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), material); s.scale.set(...m.s); g.add(s); break; }
      case "CYLINDER": { const c = new THREE.Mesh(CYL, material); c.rotation.x = Math.PI / 2; c.scale.set(m.s[0], m.s[2], m.s[1]); g.add(c); break; }
      case "LINE_STRIP": for (let i = 1; i < P.length; i++) g.add(rod(P[i - 1], P[i], m.s[0], material)); break;
      case "LINE_LIST": for (let i = 1; i < P.length; i += 2) g.add(rod(P[i - 1], P[i], m.s[0], material)); break;
      case "CUBE_LIST": case "SPHERE_LIST": {
        const geo = MARKER_TYPES[m.type] === "CUBE_LIST" ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(0.5, 14, 10);
        const im = new THREE.InstancedMesh(geo, material, Math.max(1, P.length)); const M = new THREE.Matrix4();
        P.forEach((p, i) => { M.compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(...m.s)); im.setMatrixAt(i, M); });
        g.add(im); break;
      }
      case "POINTS": { const geo = new THREE.BufferGeometry().setFromPoints(P.map((p) => new THREE.Vector3(...p))); g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: m.s[0], color: material.color, transparent: m.c[3] < 1, opacity: m.c[3] }))); break; }
      case "TEXT_VIEW_FACING": { const sp = textSprite(m.text || " ", m.s[2], m.c); sp.center.set(0.5, 0.5); g.add(sp); break; }
      case "MESH_RESOURCE": g.add(geomMesh({ type: "mesh", filename: m.mesh_resource || m.text || "", scale: m.s }, material, (e) => markerMsgs.push(st("warn", e, "Mesh")))); break;
      case "TRIANGLE_LIST": {
        const n = P.length - (P.length % 3), geo = new THREE.BufferGeometry().setFromPoints(P.slice(0, n).map((p) => new THREE.Vector3(p[0] * m.s[0], p[1] * m.s[1], p[2] * m.s[2])));
        geo.computeVertexNormals();
        const opt = { color: material.color, side: THREE.DoubleSide, transparent: m.c[3] < 1, opacity: m.c[3], depthWrite: m.c[3] >= 1 };
        if (m.colors && m.colors.length) { const col = []; for (let i = 0; i < n; i++) { const c = m.colors[m.colors.length === n ? i : Math.floor(i / 3)] || m.c; col.push(c[0], c[1], c[2]); } geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); opt.vertexColors = true; opt.color = new THREE.Color(1, 1, 1); }
        g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial(opt))); break;
      }
      case "ARROW_STRIP": for (let i = 1; i < P.length; i++) g.add(arrowBetween(P[i - 1], P[i], m.s[0], m.s[1], material, m.s[2] || undefined)); break;
      default: break;
    }
    return g;
  }
  // a Marker display subscribes to <Topic> and <Topic>_array (marker_display.cpp); a MarkerArray display to <Topic>
  function markerShownBy(m) {
    const ds = [...enabled("Marker"), ...enabled("MarkerArray")].filter((d) => d.props.Topic);
    if (!m.topic) return ds[0] || null;
    return ds.find((d) => topicOk(d.props.Topic, m.topic) || (d.type === "Marker" && topicOk(d.props.Topic + "_array", m.topic))) || null;
  }
  function buildMarkers() {
    markerG.clear(); markerMsgs = [];
    // a preset (lesson config) Marker/MarkerArray display follows the topic the program actually publishes
    if (opts.topics) for (const d of S.displays) if (d.autoTopic) {
      const want = MSG_TYPES[d.type][0], ts = opts.topics().filter((x) => x.type === want && x.pubs !== 0).map((x) => x.name);
      if (ts.length && !ts.some((t) => topicOk(d.props.Topic, t))) d.props.Topic = ts[0];
    }
    for (const d of S.displays) if (d.type === "Marker" || d.type === "MarkerArray") { d.got = 0; d.status = d.props.Topic ? [] : [st("error", "Error subscribing: Empty topic name", "Topic")]; }
    for (const [key, { marker: m, problems, topic }] of S.markers) {
      const d = markerShownBy({ topic });
      if (!d) continue;
      const add = (k, t, n) => { d.status.push(st(k, t, n)); markerMsgs.push(st(k, t, n)); };
      problems.forEach((p) => add("warn", p, key));
      const T = poses[m.frame];
      if (!T) { add("error", `Could not transform from [${m.frame}] to [${S.fixedFrame}]`, key); continue; }
      if (m.c[3] <= 0) continue;
      d.got = (d.got || 0) + 1;
      const holder = new THREE.Group(); setPose(holder, T);
      const o = markerObject(m); setPose(o, { t: m.p, q: m.q }); o.userData.marker = key; holder.add(o); markerG.add(holder);
    }
    for (const d of S.displays) if ((d.type === "Marker" || d.type === "MarkerArray") && d.props.Topic && d.enabled) d.status.unshift(st("ok", d.got ? `${d.got} messages received` : "OK", "Topic"));
  }

  // ================= interactive markers (RViz look; controls auto-completed like interactive_markers::autoComplete) =================
  let imMsgs = [], imDrag = null, imHover = null;
  const defaultColor = (q) => {   // interactive_markers tools.cpp assignDefaultColor
    const v = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(...q));
    const x = Math.abs(v.x), y = Math.abs(v.y), z = Math.abs(v.z), m = Math.max(x, y, z) || 1;
    return [x / m, y / m, z / m, 0.5];
  };
  function autoMarkers(c, scale) {
    const col = defaultColor(c.q), out = [];
    if (c.mode === "MOVE_AXIS") for (const dir of [1, -1]) out.push({ type: 0, p: [0, 0, 0], q: c.q, s: [scale * 0.15, scale * 0.25, scale * 0.2], c: col, points: [[dir * scale * 0.5, 0, 0], [dir * scale * 0.9, 0, 0]] });
    if (["MOVE_PLANE", "ROTATE_AXIS", "MOVE_ROTATE"].includes(c.mode)) {
      const steps = 36, width = 0.3, c1 = [], c2 = [];
      for (let i = 0; i < steps; i++) { const a = (i / steps) * Math.PI * 2, y = 0.5 * Math.cos(a), z = 0.5 * Math.sin(a); c1.push([0, y, z]); c2.push([0, (1 + width) * y, (1 + width) * z]); }
      const pts = [], cols = [];
      for (let i = 0; i < steps; i++) {
        const i2 = (i + 1) % steps, i3 = (i + 2) % steps;
        if (c.mode === "ROTATE_AXIS") { pts.push(c1[i], c2[i2], c1[i2], c1[i2], c2[i2], c2[i3]); const t = 0.6 + 0.4 * (i % 2); cols.push([col[0] * t, col[1] * t, col[2] * t, 1], [col[0] * t, col[1] * t, col[2] * t, 1]); }
        else pts.push(c1[i], c2[i], c1[i2], c2[i], c2[i2], c1[i2]);
      }
      out.push({ type: 11, p: [0, 0, 0], q: c.q, s: [scale, scale, scale], c: col, points: pts, colors: cols.length ? cols.flatMap((cc) => [cc, cc, cc]) : null });
    }
    return out;
  }
  function buildIMarkers() {
    imG.clear(); imMsgs = [];
    const d = first("InteractiveMarkers");
    if (!d) return;
    d.status = [];
    // interactive_marker_display.cpp: it connects to ONE server namespace; an empty one is an error
    const nsOf = (x) => "/" + String(x || "").replace(/^\/+|\/+$/g, "");
    if (d.autoNs && !d.props["Interactive Markers Namespace"]) { const n = S.imarkers.find((im) => im.ns); if (n) d.props["Interactive Markers Namespace"] = n.ns; }
    const ns = d.props["Interactive Markers Namespace"];
    if (opts.topics && !ns) { d.status.push(st("error", "Error connecting: empty namespace", "Interactive Marker Client")); return; }
    for (const im of S.imarkers.filter((x) => !opts.topics || !x.ns || nsOf(x.ns) === nsOf(ns))) {
      const T = poses[im.frame];
      if (!T) { const s = st("error", `Could not transform from [${im.frame}] to [${S.fixedFrame}]`, im.name); d.status.push(s); imMsgs.push(s); continue; }
      const holder = new THREE.Group(); setPose(holder, T); imG.add(holder);
      const obj = new THREE.Group(); setPose(obj, { t: im.p, q: im.q }); obj.userData.im = im; holder.add(obj);
      for (const c of im.controls) {
        const list = (c.markers || []).length ? c.markers : autoMarkers(c, im.scale);
        for (const mk of list) {
          const o = markerObject({ ...mk, c: d.props["Enable Transparency"] === false ? [mk.c[0], mk.c[1], mk.c[2], 1] : mk.c, points: mk.points || [], s: mk.s, type: mk.type });
          setPose(o, { t: mk.p || [0, 0, 0], q: mk.q || [0, 0, 0, 1] });
          o.traverse((x) => { if (x.isMesh) { x.material = x.material.clone(); x.userData.control = c; x.userData.imObj = obj; } });
          obj.add(o);
        }
      }
      if (im.description && d.props["Show Descriptions"]) { const sp = textSprite(im.description, 0.1 * im.scale); sp.center.set(0.5, 0); sp.position.set(0, 0, im.scale * 0.6); obj.add(sp); }
      if (d.props["Show Axes"]) obj.add(axesObj(0.5 * im.scale, 0.05 * im.scale));
    }
  }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const pick = (ev) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); };
  const imHit = (ev) => { pick(ev); return ray.intersectObjects(imG.children, true).find((x) => x.object.userData.control) || null; };
  function imDown(ev) {
    const hit = imHit(ev); if (!hit) return false;
    const c = hit.object.userData.control, obj = hit.object.userData.imObj, im = obj.userData.im;
    if (c.mode === "MENU") { imMenu(ev, true); return true; }
    const wq = obj.getWorldQuaternion(new THREE.Quaternion()), axis = new THREE.Vector3(1, 0, 0).applyQuaternion(wq.clone().multiply(new THREE.Quaternion(...c.q))).normalize();
    imDrag = { c, obj, im, start: hit.point.clone(), pos0: obj.position.clone(), q0: obj.quaternion.clone(), axis, center: obj.getWorldPosition(new THREE.Vector3()), x: ev.clientX, y: ev.clientY, moved: false, last: 0, shift: ev.shiftKey };
    renderer.domElement.setPointerCapture(ev.pointerId);
    feedback(im, obj, "MOUSE_DOWN");
    return true;
  }
  function imMove(ev) {
    const D = imDrag; pick(ev); D.moved = true;
    const parentInv = D.obj.parent.matrixWorld.clone().invert();
    const toLocalDelta = (wd) => wd.clone().transformDirection(parentInv).multiplyScalar(wd.length());
    const planeHit = (n, p) => { const out = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, p), out) ? out : null; };
    const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
    let mode = D.c.mode;
    if (mode === "MOVE_ROTATE") mode = D.shift ? "ROTATE_AXIS" : "MOVE_PLANE";
    if (mode === "MOVE_ROTATE_3D") mode = D.shift ? "ROTATE_3D" : "MOVE_3D";
    if (mode === "MOVE_AXIS") {
      // closest point on the axis line to the mouse ray
      const w0 = D.start.clone().sub(ray.ray.origin), a = D.axis, b = ray.ray.direction, ab = a.dot(b), den = 1 - ab * ab;
      if (Math.abs(den) < 1e-6) return;
      const t = (ab * w0.dot(b) - w0.dot(a)) / den;
      const dl = toLocalDelta(a.clone().multiplyScalar(t)); D.obj.position.copy(D.pos0).add(dl);
    } else if (mode === "MOVE_PLANE" || mode === "MOVE_3D") {
      const n = mode === "MOVE_PLANE" ? D.axis : camDir.clone().negate();
      const p = planeHit(n, D.start); if (!p) return;
      D.obj.position.copy(D.pos0).add(toLocalDelta(p.sub(D.start)));
    } else if (mode === "ROTATE_AXIS") {
      const p = planeHit(D.axis, D.center); if (!p) return;
      const v0 = D.start.clone().sub(D.center).projectOnPlane(D.axis), v1 = p.sub(D.center);
      if (v0.lengthSq() < 1e-12 || v1.lengthSq() < 1e-12) return;
      const ang = Math.atan2(v0.clone().cross(v1).dot(D.axis), v0.dot(v1));
      const axisLocal = new THREE.Vector3(1, 0, 0).applyQuaternion(D.q0.clone().multiply(new THREE.Quaternion(...D.c.q)));
      D.obj.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(axisLocal.normalize(), ang).multiply(D.q0));
    } else if (mode === "ROTATE_3D") {
      const dx = ev.clientX - D.x, dy = ev.clientY - D.y;
      const up = camera.up.clone(), right = camDir.clone().cross(up).normalize();
      D.obj.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(up, dx * 0.01).multiply(new THREE.Quaternion().setFromAxisAngle(right, dy * 0.01)).multiply(D.q0));
    } else return;
    draw();
    const now = performance.now(); if (now - D.last > 33) { D.last = now; feedback(D.im, D.obj, "POSE_UPDATE"); }
  }
  function imUp() {
    const D = imDrag; imDrag = null;
    if (D.moved && D.c.mode !== "BUTTON") feedback(D.im, D.obj, "POSE_UPDATE");
    feedback(D.im, D.obj, "MOUSE_UP");
    if (D.c.mode === "BUTTON" && !D.moved) feedback(D.im, D.obj, "BUTTON_CLICK");
  }
  function imMenu(ev, left = false) {
    pick(ev);
    const hit = ray.intersectObjects(imG.children, true).find((x) => x.object.userData.imObj); if (!hit) return false;
    const obj = hit.object.userData.imObj, im = obj.userData.im;
    if (!im.menu || !im.menu.length) return left;
    openMenu(null, im.menu.map((e) => ({ t: e.title, fn: () => feedback(im, obj, "MENU_SELECT", { menu_entry_id: e.id, title: e.title }) })), `im-${im.name}`, [ev.clientX, ev.clientY]);
    return true;
  }
  function feedback(im, obj, event, extra = {}) {
    const p = obj.position, q = obj.quaternion;
    im.p = [p.x, p.y, p.z]; im.q = [q.x, q.y, q.z, q.w];
    if (opts.onFeedback) opts.onFeedback({ name: im.name, event, frame: im.frame, pose: { position: { x: p.x, y: p.y, z: p.z }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w } }, ...extra });
  }

  // ================= sensor displays (data by topic, like RViz subscribing) =================
  // S.td: topic -> { type, frame, count, rate, ... } from the practice terminal (Gazebo + ros_gz_bridge) or a lesson.
  // Legacy lesson data (S.sensors.scan/cloud/path/odom/map) is read as the topics /scan, /points, /plan, /odom, /map.
  let sensorMsgs = [];
  const LEGACY = { scan: ["/scan", "sensor_msgs/msg/LaserScan"], cloud: ["/points", "sensor_msgs/msg/PointCloud2"], path: ["/plan", "nav_msgs/msg/Path"], odom: ["/odom", "nav_msgs/msg/Odometry"], map: ["/map", "nav_msgs/msg/OccupancyGrid"] };
  function topicData() {
    const m = new Map(S.td || []);
    for (const [k, [t, type]] of Object.entries(LEGACY)) { const x = S.sensors[k]; if (x) { const name = x.topic ? (x.topic.startsWith("/") ? x.topic : "/" + x.topic) : t; if (!m.has(name)) m.set(name, { type, count: 1, rate: 0, legacy: true, ...x }); } }
    return m;
  }
  const disposeTree = (g) => g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.own) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  const ramp = (v) => { const c = new THREE.Color().setHSL(0.8 * (1 - Math.min(1, Math.max(0, v))), 1, 0.5); return [c.r, c.g, c.b]; };
  const odomHist = new Map();   // display id -> accumulated poses (Keep)
  const qosLogged = new Set();
  const docks = new Map();      // display id -> image / camera dock
  function buildSensors() {
    disposeTree(sensorG); sensorG.clear(); sensorMsgs = [];
    const TD = topicData(), abs = (t) => (t && !t.startsWith("/") ? "/" + t : t);
    const place = (frame, d) => { const T = poses[frame]; if (!T) { d.status.push(st("error", `Could not transform from [${frame}] to [${S.fixedFrame}]`, "Transform")); return null; } const g = new THREE.Group(); setPose(g, T); sensorG.add(g); return g; };
    // MessageFilterDisplay / RosTopicDisplay status: "OK" once subscribed, "N messages received at X hz." with data
    const ready = (d) => {
      d.status = [];
      if (!d.props.Topic) { d.status.push(st("error", "Error subscribing: Empty topic name", "Topic")); return null; }
      const x = TD.get(abs(d.props.Topic));
      const want = MSG_TYPES[d.type] || [TOPIC_TYPES[d.type]];
      if (!x || (x.type && !want.includes(x.type))) { d.status.push(st("ok", "OK", "Topic")); return null; }
      if (x.qos === "Best Effort" && d.props["Reliability Policy"] === "Reliable") {   // no match: rclcpp only logs it in the terminal that runs rviz2
        d.status.push(st("ok", "OK", "Topic"));
        const key = `${d.id}|${d.props.Topic}`; if (!qosLogged.has(key)) { qosLogged.add(key); if (opts.onLog) opts.onLog(`[WARN] [${(Date.now() / 1000).toFixed(9)}] [rviz2]: New publisher discovered on topic '${abs(d.props.Topic)}', offering incompatible QoS. No messages will be sent to it. Last incompatible policy: RELIABILITY_QOS_POLICY`); }
        return null;
      }
      d.status.push(st("ok", `${x.count || 1} messages received${x.rate ? ` at ${Number(x.rate).toFixed(1)} hz.` : ""}`, "Topic"));
      return x;
    };
    const ptsMaterial = (d, size, vertexColors, color) => { const m = new THREE.PointsMaterial({ size: d.props.Style === "Points" ? Number(d.props["Size (Pixels)"]) || 3 : size, sizeAttenuation: d.props.Style !== "Points", vertexColors, color: color ? new THREE.Color(...color) : undefined, transparent: Number(d.props.Alpha) < 1, opacity: Number(d.props.Alpha) }); m.userData.own = true; return m; };
    const colorize = (d, P, intens, rgb) => {   // the Color Transformer of point_cloud_common
      const ct = d.props["Color Transformer"], col = [];
      if (ct === "RGB8" && rgb) { rgb.forEach((c) => col.push(c[0], c[1], c[2])); return col; }
      if (ct === "FlatColor") { const c = rgbOf(d.props.Color || "255; 255; 255"); P.forEach(() => col.push(...c)); return col; }
      if (ct === "AxisColor" || (ct === "RGB8" && !rgb)) { const ax = { X: 0, Y: 1, Z: 2 }[d.props.Axis || "Z"] ?? 2, v = P.map((p) => p[ax]), lo = Math.min(...v), hi = Math.max(...v); v.forEach((x) => col.push(...ramp((x - lo) / ((hi - lo) || 1)))); return col; }
      const I = intens || P.map(() => 0), lo = Math.min(...I), hi = Math.max(...I);   // Intensity: uniform intensity draws red, like a Gazebo scan in RViz
      I.forEach((x) => col.push(...(hi - lo < 1e-9 ? [1, 0, 0] : ramp(1 - (x - lo) / (hi - lo)))));
      return col;
    };
    const cloud = (g, d, P, intens, rgb) => {
      const pos = new Float32Array(P.length * 3); P.forEach((p, i) => pos.set(p, i * 3));
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(colorize(d, P, intens, rgb), 3));
      g.add(new THREE.Points(geo, ptsMaterial(d, Number(d.props["Size (m)"]) || 0.01, true)));
    };
    for (const d of enabled("LaserScan")) {
      const x = ready(d); if (!x) continue;
      const g = place(x.frame, d); if (!g) continue;
      const P = []; (x.ranges || []).forEach((r, i) => { if (Number.isFinite(r) && r >= (x.range_min || 0) && r <= x.range_max) { const a = x.angle_min + i * x.angle_increment; P.push([r * Math.cos(a), r * Math.sin(a), 0]); } });
      d.status.push(st("ok", `Showing [${P.length}] points from [1] messages`, "Points")); d.status.push(st("ok", "Ok", "Transform"));
      cloud(g, d, P, x.intensities);
    }
    for (const d of enabled("PointCloud2")) {
      const x = ready(d); if (!x) continue;
      const g = place(x.frame, d); if (!g) continue;
      const P = x.points || [];
      d.status.push(st("ok", `Showing [${P.length}] points from [1] messages`, "Points")); d.status.push(st("ok", "Ok", "Transform"));
      if (P.length) cloud(g, d, P, x.intensities, x.colors);
    }
    for (const d of enabled("Path")) { const x = ready(d); if (!x) continue; const g = place(x.frame, d); if (!g) continue; const c = rgbOf(d.props.Color); const geo = new THREE.BufferGeometry().setFromPoints(x.points.map((p) => new THREE.Vector3(...p))); const m = new THREE.LineBasicMaterial({ color: new THREE.Color(...c), transparent: Number(d.props.Alpha) < 1, opacity: Number(d.props.Alpha) }); m.userData.own = true; g.add(new THREE.Line(geo, m)); }
    for (const d of enabled("Odometry")) {
      const x = ready(d); if (!x) { odomHist.delete(d.id); continue; }
      const g = place(x.frame, d); if (!g) continue;
      // keep a pose only after the robot moved Position Tolerance (m) or turned Angle Tolerance (rad), at most Keep poses
      let H = odomHist.get(d.id) || [];
      const add = x.poses ? x.poses : x.pose ? [x.pose] : [];
      for (const p of add) { const last = H[H.length - 1]; if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= Number(d.props["Position Tolerance"]) || Math.abs(Math.atan2(Math.sin(p[2] - last[2]), Math.cos(p[2] - last[2]))) >= Number(d.props["Angle Tolerance"])) H.push(p); }
      if (x.legacy) H = add.slice();
      const keep = Number(d.props.Keep || 100); if (keep > 0 && H.length > keep) H = H.slice(-keep);
      odomHist.set(d.id, H);
      const m = mat([...rgbOf(d.props.Color), Number(d.props.Alpha)]), sl = Number(d.props["Shaft Length"]), sr = Number(d.props["Shaft Radius"]), hl = Number(d.props["Head Length"]), hr = Number(d.props["Head Radius"]);
      H.forEach(([px, py, th]) => { const a = d.props.Shape === "Axes" ? axesObj(1, 0.1) : rvArrow(sl, sr * 2, hl, hr * 2, m); a.position.set(px, py, 0); if (d.props.Shape === "Axes") a.rotation.z = th; else a.quaternion.setFromEuler(new THREE.Euler(0, 0, th - Math.PI / 2)); g.add(a); });
    }
    for (const d of enabled("Map")) {
      const x = ready(d); if (!x) continue; const g = place(x.frame, d); if (!g) continue;
      const { width: W, height: H, resolution: res, origin: o, data } = x; const px = new Uint8Array(W * H * 4), alpha = Math.round(255 * Number(d.props.Alpha));
      data.forEach((v, i) => { const c = v < 0 ? 128 : Math.round(255 - 2.55 * v); px.set([c, c, c, alpha], i * 4); });
      const tex = new THREE.DataTexture(px, W, H); tex.needsUpdate = true; tex.magFilter = THREE.NearestFilter;
      const mm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: !d.props["Draw Behind"] }); mm.userData.own = true;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(W * res, H * res), mm); plane.position.set(o[0] + (W * res) / 2, o[1] + (H * res) / 2, -0.005); g.add(plane);
      Object.assign(d.props, { Resolution: qnum(res), Width: String(W), Height: String(H), Position: `${qnum(o[0])}; ${qnum(o[1])}; 0` });
    }
    for (const d of enabled("Imu")) {   // rviz_imu_plugin: axes (and an optional box / acceleration arrow) at the IMU frame
      const x = ready(d); if (!x) continue;
      const T = poses[x.frame]; if (!T) { d.status.push(st("error", `Could not transform from [${x.frame}] to [${S.fixedFrame}]`, "Transform")); continue; }
      const g = new THREE.Group(); g.position.set(...T.t);
      const qi = new THREE.Quaternion(...x.orientation);
      if (d.props.fixed_frame_orientation === false || d.props.fixed_frame_orientation === "false") g.quaternion.set(...T.q).multiply(qi); else g.quaternion.copy(qi);
      if (d.props["Enable axes"] !== false) { const L = Number(d.props["Axes scale"]) || 0.1; g.add(axesObj(L, L * 0.1)); }
      if (d.props["Enable box"] === true) { const bm = mat([...rgbOf(d.props["Box color"]), Number(d.props["Box alpha"])]); const b = new THREE.Mesh(new THREE.BoxGeometry(Number(d.props.x_scale) * 0.1, Number(d.props.y_scale) * 0.1, Number(d.props.z_scale) * 0.1), bm); g.add(b); }
      if (d.props["Enable acceleration"] === true) { const k = Number(d.props["Acc. vector scale"]) || 0.05, a = x.linear_acceleration.map((v) => v * k); const arr = arrowBetween([0, 0, 0], a, 0.01, 0.03, mat([...rgbOf(d.props["Acc. vector color"]), Number(d.props["Acc. vector alpha"])])); g.add(arr); }
      sensorG.add(g); d.status.push(st("ok", "Ok", "Transform"));
    }
    // Image and Camera: their own render windows (docked under Displays, like RViz2)
    const live = new Set();
    for (const d of S.displays.filter((x) => x.enabled && (x.type === "Image" || x.type === "Camera"))) {
      live.add(d.id);
      const x = ready(d), k = dockFor(d);
      if (x && d.type === "Image") drawImage(k, x, d);
      if (d.type === "Camera") drawCamera(k, x, d, TD);
      if (!x) k.ctx.clearRect(0, 0, k.img.width, k.img.height);
    }
    for (const [id, k] of docks) if (!live.has(id)) { k.el.remove(); if (k.r) { k.r.dispose(); k.r.forceContextLoss && k.r.forceContextLoss(); } docks.delete(id); }
    for (const d of S.displays.filter((x) => x.enabled && x.failed)) d.status = [st("error", `The class required for this display, '${d.failed}', could not be loaded.`, "Plugin")];
    for (const d of S.displays.filter((x) => x.enabled && !x.failed && !["Grid", "Axes", "RobotModel", "TF", "Marker", "MarkerArray", "InteractiveMarkers", "LaserScan", "PointCloud2", "Path", "Odometry", "Map", "Group", "Image", "Camera", "Imu"].includes(x.type))) {
      d.status = d.props.Topic ? [st("ok", "OK", "Topic")] : [st("error", "Error subscribing: Empty topic name", "Topic")];
    }
  }
  function dockFor(d) {
    let k = docks.get(d.id);
    if (!k) {
      const img = h("canvas", { class: "q-imgcv", width: "320", height: "240" });
      const body = h("div", { class: "q-imgbody" }, img);
      const el = h("section", { class: "q-dock rv-imgdock" }, h("div", { class: "q-docktitle" }, h("span", { text: d.name }), h("button", { type: "button", class: "q-dockclose", title: "Close", "aria-label": `Close ${d.name}`, onclick: () => { d.enabled = false; changed(); refresh(); } }, h("img", { src: ico("close.png"), alt: "", width: "10", height: "10" }))), body);
      left.append(el);
      k = { el, body, img, ctx: img.getContext("2d") };
      docks.set(d.id, k);
    }
    k.el.querySelector(".q-docktitle span").textContent = d.name;
    return k;
  }
  function fitCanvas(k, w, h_) { if (k.img.width !== w || k.img.height !== h_) { k.img.width = w; k.img.height = h_; } }
  function drawImage(k, x, d) {
    if (x.canvas) { fitCanvas(k, x.canvas.width, x.canvas.height); k.ctx.drawImage(x.canvas, 0, 0); return; }
    if (x.depth) {   // 32FC1: Normalize Range (median of min / max) or Min Value / Max Value
      const W = x.depthW, H = x.depthH; fitCanvas(k, W, H);
      const fin = x.depth.filter(Number.isFinite), norm = d.props["Normalize Range"] !== false;
      const lo = norm ? Math.min(...fin) : Number(d.props["Min Value"]), hi = norm ? Math.max(...fin) : Number(d.props["Max Value"]);
      const im = k.ctx.createImageData(W, H);
      x.depth.forEach((v, i) => { const c = Number.isFinite(v) ? Math.round(255 * Math.min(1, Math.max(0, (v - lo) / ((hi - lo) || 1)))) : 0; im.data.set([c, c, c, 255], i * 4); });
      k.ctx.putImageData(im, 0, 0);
    }
  }
  function drawCamera(k, x, d, TD) {
    const topic = d.props.Topic ? (d.props.Topic.startsWith("/") ? d.props.Topic : "/" + d.props.Topic) : "";
    const infoTopic = topic.replace(/\/[^/]*$/, "") + "/camera_info", info = TD.get(infoTopic);
    if (!x) return;
    if (!info) { d.status.push(st("warn", `No CameraInfo received on [${infoTopic}]. Topic may not exist.`, "Camera Info")); drawImage(k, x, d); return; }
    d.status.push(st("ok", "OK", "Camera Info"));
    const T = poses[x.frame];
    if (!T) { d.status.push(st("error", `Could not transform from [${x.frame}] to [${S.fixedFrame}]`, "Transform")); drawImage(k, x, d); return; }
    const W = x.canvas ? x.canvas.width : 320, H = x.canvas ? x.canvas.height : 240;
    fitCanvas(k, W, H);
    if (!k.r) { try { k.cv = h("canvas", { class: "q-camgl", width: String(W), height: String(H) }); k.r = new THREE.WebGLRenderer({ canvas: k.cv, alpha: true, antialias: true }); k.r.outputColorSpace = THREE.LinearSRGBColorSpace; k.over = h("canvas", { class: "q-camover", width: String(W), height: String(H) }); k.body.append(k.cv, k.over); } catch { k.r = null; } }
    if (!k.r) { drawImage(k, x, d); return; }
    const mode = d.props["Image Rendering"] || "background and overlay", alpha = Number(d.props["Overlay Alpha"] ?? 0.5), zoom = Number(d.props["Zoom Factor"]) || 1;
    k.ctx.clearRect(0, 0, W, H);
    if (mode !== "overlay" && x.canvas) k.ctx.drawImage(x.canvas, 0, 0);   // background
    const fy = info.K ? info.K[4] : (info.width / 2) / Math.tan((info.hfov || 1) / 2), ih = info.height || H;
    const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2 * Math.atan(ih / 2 / fy / zoom)), W / H, 0.01, Number(d.props["Far Plane Distance"]) || 100);
    cam.position.set(...T.t); cam.quaternion.set(...T.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));   // optical frame (z forward, y down) -> three.js camera (-z forward, y up)
    cam.updateMatrixWorld(true);
    k.cv.width = W; k.cv.height = H; k.r.setSize(W, H, false);
    const bgc = scene.background; scene.background = null; k.r.setClearColor(0x000000, mode === "overlay" ? 1 : 0); k.r.render(scene, cam); scene.background = bgc;
    const o = k.over.getContext("2d"); k.over.width = W; k.over.height = H; o.clearRect(0, 0, W, H);
    if (mode !== "background" && x.canvas) { o.globalAlpha = alpha; o.drawImage(x.canvas, 0, 0); }
  }

  // ================= pointer tools =================
  const ground = (ev) => { pick(ev); const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p) ? p : null; };
  const hitObject = (ev) => { pick(ev); return ray.intersectObjects([robotG, markerG, imG, sensorG], true).find((x) => x.object.visible) || null; };
  const hitPoint = (ev) => { const hit = hitObject(ev); return hit ? hit.point : ground(ev); };
  let measureStart = null, lastLength = 0, poseStart = null, poseArrow = null, selStart = null;
  const measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: new THREE.Color(128 / 255, 128 / 255, 0) }));   // Qt::darkYellow
  measureLine.visible = false; toolG.add(measureLine);
  const yawQuat = (yaw) => ({ x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) });
  const stamp = () => { const t = Date.now() / 1000; return { sec: Math.floor(t), nanosec: Math.floor((t % 1) * 1e9) }; };
  const fmtP = (p) => `[${Number(p.x.toPrecision(3))},${Number(p.y.toPrecision(3))},${Number(p.z.toPrecision(3))}]`;
  function publish(topic, type, msg) { if (opts.onPublish) opts.onPublish(topic, type, msg); }
  function toolHover(ev) {
    if (!renderer) return;
    if (S.tool === "interact") {
      const hit = imHit(ev), c = hit ? hit.object : null;
      if (imHover !== c) { if (imHover) imHover.traverse((x) => x.material && x.material.emissive && x.material.emissive.setScalar(0)); imHover = c; if (c) c.material.emissive && c.material.emissive.setScalar(0.3); draw(); }
      setStatus(ev.shiftKey ? ORBIT_SHIFT : ORBIT_STATUS);
    } else if (S.tool === "move") setStatus(ev.shiftKey ? ORBIT_SHIFT : ORBIT_STATUS);
    else if (S.tool === "focus") { const p = hitPoint(ev); setStatus(p ? `<b>Left-Click:</b> Focus on this point. ${fmtP(p)}` : TOOLS[3].status); }
    else if (S.tool === "point") { const p = hitPoint(ev); setStatus(p ? `<b>Left-Click:</b> Select this point. ${fmtP(p)}` : TOOLS[7].status); }
    else if (S.tool === "measure") {
      const p = hitPoint(ev);
      if (measureStart && p) { measureLine.geometry.setFromPoints([measureStart, p]); measureLine.visible = true; lastLength = measureStart.distanceTo(p); draw(); }
      setStatus(`${lastLength > 0 ? `[Length: ${Number(lastLength.toPrecision(6))}m] ` : ""}Click on two points to measure their distance. Right-click to reset.`);
    } else if ((S.tool === "pose" || S.tool === "goal") && poseStart) {
      const p = ground(ev); if (!p) return;
      const yaw = Math.atan2(p.y - poseStart.y, p.x - poseStart.x);
      if (!poseArrow) { poseArrow = rvArrow(2.0, 0.2, 0.5, 0.35, mat([0, 1, 0, 1])); toolG.add(poseArrow); }   // PoseTool: Arrow(2.0, 0.2, 0.5, 0.35), green
      poseArrow.position.copy(poseStart); poseArrow.quaternion.setFromEuler(new THREE.Euler(0, 0, yaw - Math.PI / 2)); poseArrow.visible = true; draw();
    }
  }
  function poseUp(ev) {
    const p = ground(ev) || poseStart, yaw = p.distanceTo(poseStart) < 1e-3 ? 0 : Math.atan2(p.y - poseStart.y, p.x - poseStart.x);
    const pose = { position: { x: poseStart.x, y: poseStart.y, z: 0 }, orientation: yawQuat(yaw) };
    if (S.tool === "goal") publish("/goal_pose", "geometry_msgs/msg/PoseStamped", { header: { stamp: stamp(), frame_id: S.fixedFrame }, pose });
    else publish("/initialpose", "geometry_msgs/msg/PoseWithCovarianceStamped", { header: { stamp: stamp(), frame_id: S.fixedFrame }, pose: { pose, covariance: [0.25, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.06853891909122467] } });
    poseStart = null; if (poseArrow) poseArrow.visible = false; draw();
    setTool("interact");   // the pose tools finish after one use and RViz goes back to the default tool
  }
  function toolClick(ev) {
    closeMenu();
    if (S.tool === "point") { const p = hitPoint(ev); if (p) { const q = world.worldToLocal(p.clone()); publish("/clicked_point", "geometry_msgs/msg/PointStamped", { header: { stamp: stamp(), frame_id: S.fixedFrame }, point: { x: q.x, y: q.y, z: q.z } }); setTool("interact"); } return; }
    if (S.tool === "focus") { const p = hitPoint(ev); if (p && S.view.type !== "TopDownOrtho") { const pos = persp.position.clone(), dir = p.clone().sub(pos); S.view.distance = dir.length(); S.view.focal = p.toArray(); S.view.pitch = Math.asin(Math.max(-1, Math.min(1, -dir.z / S.view.distance))); S.view.yaw = mapAngle(Math.atan2(-dir.y, -dir.x)); applyView(); } setTool("interact"); return; }
    if (S.tool === "measure") {
      const p = hitPoint(ev); if (!p) return;
      if (!measureStart) { measureStart = p.clone(); lastLength = 0; measureLine.visible = false; }
      else { measureLine.geometry.setFromPoints([measureStart, p]); measureLine.visible = true; lastLength = measureStart.distanceTo(p); measureStart = null; draw(); }
      setStatus(`${lastLength > 0 ? `[Length: ${Number(lastLength.toPrecision(6))}m] ` : ""}Click on two points to measure their distance. Right-click to reset.`);
    }
  }
  function doSelect(ev) {
    const hit = hitObject(ev); let o = hit && hit.object, name = "";
    while (o && !name) { name = (o.userData && (o.userData.link ? `Link ${o.userData.link}` : o.userData.marker ? `Marker ${o.userData.marker}` : o.userData.im ? `Interactive marker ${o.userData.im.name}` : "")) || ""; o = o.parent; }
    S.selection = name ? { name, point: hit.point.clone() } : null;
    renderSelection();
  }

  // ================= property trees (rviz_common/properties) =================
  // Rows: { path, depth, name, cls, icon, value: {k:"text"|"check"|"color"|"edit"...}, kids, help, helpTitle }
  // RosTopicProperty::fillTopicList: every topic in the graph whose type is the display's message type, sorted
  function topicChoices(d, k) {
    const want = d.type === "RobotModel" || k === "Description Topic" ? ["std_msgs/msg/String"] : k === "Update Topic" ? ["map_msgs/msg/OccupancyGridUpdate", "visualization_msgs/msg/InteractiveMarkerUpdate"] : (MSG_TYPES[d.type] || (TOPIC_TYPES[d.type] ? [TOPIC_TYPES[d.type]] : []));
    return (opts.topics ? opts.topics() : []).filter((x) => !want.length || want.includes(x.type)).map((x) => x.name).sort();
  }
  function tree(el, rows, { sel, onSel, open, ratio = 0.5 }) {
    if (comboPop && el.querySelector(".q-ecombo")) closeCombo();
    el.style.setProperty("--ratio", String(ratio));   // SplitterHandle: first column = ratio x width
    el.classList.toggle("tall", !!(rows[0] && rows[0].icon));
    let sel_ = sel; sel = sel_;
    const vis = []; const hiddenUnder = [];
    for (const r of rows) { while (hiddenUnder.length && r.depth <= hiddenUnder[hiddenUnder.length - 1]) hiddenUnder.pop(); if (hiddenUnder.length) continue; vis.push(r); if (r.kids && !open.has(r.path)) hiddenUnder.push(r.depth); }
    el.replaceChildren(...vis.map((r) => {
      const arrow = h("span", { class: `q-arrow${r.kids ? (open.has(r.path) ? " open" : " closed") : ""}`, onclick: (e) => { e.stopPropagation(); if (!r.kids) return; if (open.has(r.path)) open.delete(r.path); else open.add(r.path); onSel(sel, true); } });
      const name = h("span", { class: `q-name ${r.cls || ""}` }, r.icon ? h("img", { src: r.icon, alt: "", width: "16", height: "16" }) : null, h("span", { class: "q-ntext", text: r.name }));
      const val = valueCell(r);
      const row = h("div", { class: `q-row${sel === r.path ? " sel" : ""}${r.disabled ? " dis" : ""}${r.rowBold ? " bold" : ""}${r.icon ? " ic" : ""}`, role: "treeitem", "aria-expanded": r.kids ? String(open.has(r.path)) : null, "aria-selected": String(sel === r.path), "data-path": r.path },
        h("span", { class: "q-c0", style: `padding-left:${r.depth * 20}px` }, arrow, name), val);
      row.addEventListener("click", (e) => { if (e.target.closest(".q-checkbox, .q-editor, .q-arrow")) return; if (sel !== r.path) { sel = r.path; el.querySelectorAll(".q-row.sel").forEach((x) => { x.classList.remove("sel"); x.setAttribute("aria-selected", "false"); }); row.classList.add("sel"); row.setAttribute("aria-selected", "true"); onSel(r.path, false, true); } });
      row.addEventListener("dblclick", (e) => { if (r.kids && !e.target.closest(".q-c1")) { if (open.has(r.path)) open.delete(r.path); else open.add(r.path); onSel(r.path, true); } });
      return row;
    }));
    // keyboard, like QTreeView: Up/Down select, Right/Left expand/collapse (or go to child/parent),
    // Space toggles a check box, Enter/F2 edits the value
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
    el.onkeydown = (e) => {
      if (e.target.closest(".q-editor")) return;
      const idx = vis.findIndex((r) => r.path === sel), cur = vis[idx];
      const rowEl = (r) => el.querySelector(`.q-row[data-path="${CSS.escape(r.path)}"]`);
      const pick = (r) => { if (!r) return; sel = r.path; onSel(r.path, false, true); const x = rowEl(r); if (x) { el.querySelectorAll(".q-row.sel").forEach((y) => { y.classList.remove("sel"); y.setAttribute("aria-selected", "false"); }); x.classList.add("sel"); x.setAttribute("aria-selected", "true"); x.scrollIntoView({ block: "nearest" }); } };
      const toggleOpen = (on) => { if (on) open.add(cur.path); else open.delete(cur.path); onSel(cur.path, true); };
      let handled = true;
      if (e.key === "ArrowDown") pick(idx < 0 ? vis[0] : vis[idx + 1]);
      else if (e.key === "ArrowUp") pick(idx < 0 ? vis[0] : vis[idx - 1]);
      else if (e.key === "Home") pick(vis[0]);
      else if (e.key === "End") pick(vis[vis.length - 1]);
      else if (!cur) handled = false;
      else if (e.key === "ArrowRight") { if (cur.kids && !open.has(cur.path)) toggleOpen(true); else if (cur.kids) pick(vis[idx + 1]); }
      else if (e.key === "ArrowLeft") { if (cur.kids && open.has(cur.path)) toggleOpen(false); else { for (let i = idx - 1; i >= 0; i--) if (vis[i].depth < cur.depth) { pick(vis[i]); break; } } }
      else if (e.key === " " && cur.value && cur.value.k === "check" && !cur.disabled) cur.value.set(!cur.value.checked);
      else if ((e.key === "Enter" || e.key === "F2") && cur.value && cur.value.edit && !cur.disabled) { const x = rowEl(cur); const c = x && x.querySelector(".q-c1"); if (c) openEditor(c, cur.value); }
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); if (!el.contains(document.activeElement) || document.activeElement === document.body) el.focus(); }
    };
  }
  function valueCell(r) {
    const v = r.value || { k: "text", text: "" };
    const cell = h("span", { class: `q-c1 ${v.cls || ""}` });
    if (v.k === "check") {
      const box = h("span", { class: `q-checkbox${v.checked ? " on" : ""}${r.disabled ? " dis" : ""}`, role: "checkbox", "aria-checked": String(!!v.checked), "aria-label": r.name, tabindex: "0" });
      const toggle = (e) => { e.stopPropagation(); if (!r.disabled) v.set(!v.checked); };
      box.addEventListener("click", toggle); box.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") toggle(e); });
      cell.append(box);
    } else if (v.k === "color") { cell.append(h("span", { class: "q-swatch", style: `background:rgb(${rgbOf(v.text).map((x) => Math.round(x * 255)).join(",")})` }), h("span", { class: "q-vt", text: v.text })); }
    else cell.append(h("span", { class: "q-vt", text: v.text ?? "" }));
    if (v.edit && !r.disabled) cell.addEventListener("click", (e) => { if (e.target.closest(".q-editor, .q-ecombo, .q-colored")) return; setTimeout(() => openEditor(cell, v)); });
    return cell;
  }
  // ----- property editors (rviz_common/properties): EnumProperty -> QComboBox, EditableEnumProperty / TfFrameProperty /
  // RosTopicProperty -> editable QComboBox, ColorProperty -> line edit + "..." (QColorDialog), others -> QLineEdit
  let comboPop = null;
  function closeCombo() { if (comboPop) { comboPop.remove(); comboPop = null; } }
  function comboEditor(cell, v, editable) {
    const opts_ = (typeof v.edit.options === "function" ? v.edit.options() : v.edit.options) || [];
    let done = false, hi = -1;
    const commit = (x) => { if (done) return; done = true; closeCombo(); v.edit.commit(x); };
    const cancel = () => { if (done) return; done = true; closeCombo(); refresh(); };
    const field = editable ? h("input", { class: "q-ecin", value: v.edit.raw ?? v.text ?? "", spellcheck: "false", "aria-label": "Value", "aria-autocomplete": "list" })
      : h("span", { class: "q-ecin", tabindex: "0", role: "combobox", "aria-expanded": "false", text: v.text ?? "" });
    const arrow = h("span", { class: "q-ecarrow", "aria-hidden": "true" });
    const wrap = h("span", { class: `q-ecombo${editable ? "" : " enum"}` }, field, arrow);
    const paintHi = () => { if (!comboPop) return; comboPop.querySelectorAll(".q-copt").forEach((o, i) => o.classList.toggle("hi", i === hi)); const x = comboPop.children[hi]; if (x) x.scrollIntoView({ block: "nearest" }); };
    const open = () => {
      closeCombo();
      const cur = editable ? field.value : v.text;
      hi = opts_.indexOf(cur); if (hi < 0 && !editable) hi = 0;
      comboPop = h("div", { class: `q-cpop${editable ? "" : " enum"}`, role: "listbox" }, ...opts_.map((o, i) => h("div", { class: "q-copt", role: "option", text: o,
        onpointerdown: (e) => { e.preventDefault(); commit(o); }, onpointerenter: () => { hi = i; paintHi(); } })));
      if (!opts_.length) comboPop.append(h("div", { class: "q-copt empty", text: "" }));
      root.append(comboPop);
      const R = root.getBoundingClientRect(), r = wrap.getBoundingClientRect();
      comboPop.style.left = `${r.left - R.left}px`; comboPop.style.minWidth = `${r.width}px`;
      // Fusion: an editable combo drops its list below the box; a plain combo puts the current item over the box
      const top = editable ? r.bottom - R.top - 1 : r.top - R.top - Math.max(0, hi) * 27 - 1;
      comboPop.style.top = `${Math.max(0, top)}px`;
      if (editable) comboPop.style.width = `${r.width}px`;
      field.setAttribute("aria-expanded", "true"); paintHi();
    };
    arrow.addEventListener("pointerdown", (e) => { e.preventDefault(); if (comboPop) closeCombo(); else open(); field.focus(); });
    if (!editable) field.addEventListener("pointerdown", (e) => { e.preventDefault(); if (comboPop) closeCombo(); else open(); field.focus(); });
    field.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!comboPop) { open(); return; } hi = Math.max(0, Math.min(opts_.length - 1, hi + (e.key === "ArrowDown" ? 1 : -1))); paintHi(); if (editable && opts_[hi] !== undefined) field.value = opts_[hi]; }
      else if (e.key === "Enter") { e.preventDefault(); commit(editable ? field.value : (opts_[hi] ?? v.text)); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      else if (e.key === " " && !editable) { e.preventDefault(); open(); }
    });
    field.addEventListener("blur", () => setTimeout(() => { if (!done && document.activeElement !== field) { if (editable) commit(field.value); else cancel(); } }, 0));
    cell.replaceChildren(wrap); field.focus(); if (editable) field.select();
    open();
  }
  function colorEditor(cell, v) {
    let done = false;
    const commit = (x) => { if (done) return; done = true; v.edit.commit(x); };
    const ed = h("input", { class: "q-ecin", value: v.text ?? "", spellcheck: "false", "aria-label": "Color (red; green; blue)" });
    const pick = h("input", { type: "color", class: "q-colorpick", tabindex: "-1", "aria-hidden": "true", value: `#${rgbOf(v.text).map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}` });
    const dots = h("button", { type: "button", class: "q-cdots", text: "...", title: "Choose a color", onpointerdown: (e) => { e.preventDefault(); pick.click(); } });
    pick.addEventListener("input", () => { const n = parseInt(pick.value.slice(1), 16); ed.value = [n >> 16, (n >> 8) & 255, n & 255].join("; "); });
    pick.addEventListener("change", () => { const n = parseInt(pick.value.slice(1), 16); commit([n >> 16, (n >> 8) & 255, n & 255].join("; ")); });
    ed.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") commit(ed.value); else if (e.key === "Escape") { done = true; refresh(); } });
    ed.addEventListener("blur", () => setTimeout(() => { if (!done && document.activeElement !== ed && document.activeElement !== pick) commit(ed.value); }, 200));
    cell.replaceChildren(h("span", { class: "q-colored" }, h("span", { class: "q-swatch", style: `background:rgb(${rgbOf(v.text).map((x) => Math.round(x * 255)).join(",")})` }), ed, dots, pick));
    ed.focus(); ed.select();
  }
  function openEditor(cell, v) {
    let ed;
    if (v.edit.type === "enum") return comboEditor(cell, v, false);
    if (v.edit.options) return comboEditor(cell, v, true);
    if (v.edit.color) return colorEditor(cell, v);
    {
      ed = h("input", { class: "q-editor", value: v.edit.raw ?? v.text ?? "", spellcheck: "false" });
      if (v.edit.options) { const id = `rvdl${++seq}`; ed.setAttribute("list", id); cell.append(h("datalist", { id }, ...v.edit.options.map((o) => h("option", { value: o })))); }
      let done = false; const commit = () => { if (done) return; done = true; v.edit.commit(ed.value); };
      ed.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") { done = true; refresh(); } e.stopPropagation(); });
      ed.addEventListener("blur", commit);
    }
    cell.replaceChildren(ed); ed.focus(); if (ed.select) ed.select();
  }
  const parseVal = (old, s) => (typeof old === "number" ? (Number.isFinite(Number(s)) ? Number(s) : old) : s);
  const fmtVal = (v) => (typeof v === "number" ? qnum(v) : typeof v === "boolean" ? "" : String(v ?? ""));
  const helpFor = (d, k) => (HELP[d.type] || {})[k] || HELP_COMMON[k] || "";

  // ----- Displays tree
  const selDisplay = () => { const m = /^d(\d+)/.exec(S.sel || ""); return m ? S.displays.find((d) => d.id === Number(m[1])) : null; };
  const worst = (s) => (s.some((x) => x[0] === "error") ? "error" : s.some((x) => x[0] === "warn") ? "warn" : "ok");
  const statusIcon = (k) => ico(k === "error" ? "error.png" : k === "warn" ? "warning.png" : "ok.png");
  const WORD = { ok: "Ok", warn: "Warn", error: "Error" };
  function propRows(d, nodes, depth, base, dis) {
    const rows = [];
    for (const [k, t, , a, b] of nodes) {
      const kids = Array.isArray(a) && Array.isArray(a[0]) ? a : Array.isArray(b) ? b : null, options = Array.isArray(a) && !Array.isArray(a[0]) ? a : null;
      const path = `${base}/${k}`, cur = d.props[k];
      const set = (x) => { d.props[k] = x; if (d.type === "RobotModel" && k === "Alpha") buildRobot(); changed(); refresh(); };
      let value;
      if (t === "cat") value = { k: "text", text: "" };
      else if (t === "bool") value = { k: "check", checked: !!cur, set };
      else if (t === "color") value = { k: "color", text: cur, edit: { color: true, commit: (s) => set(rgbOf(s).map((x) => Math.round(x * 255)).join("; ")) } };
      else if (t === "enum") value = { k: "text", text: cur, edit: { type: "enum", options, commit: (s) => set(s) } };
      else if (t === "tf") value = { k: "text", text: cur, edit: { options: ["<Fixed Frame>", ...frames], commit: (s) => set(s.trim() || "<Fixed Frame>") } };
      else if (t === "topic") value = { k: "text", text: cur, edit: { options: () => topicChoices(d, k), commit: (s) => { d.autoTopic = false; set(s.trim()); } } };
      else if (t === "ro") value = { k: "text", text: cur };
      else if (t === "vec3") value = { k: "text", text: vecOf(cur).map(qnum).join("; "), edit: { raw: vecOf(cur).map(qnum).join("; "), commit: (s) => set(vecOf(s).map(qnum).join("; ")) } };
      else if (k === "Interactive Markers Namespace") value = { k: "text", text: fmtVal(cur), edit: { options: () => (opts.topics ? opts.topics() : []).filter((x) => x.type === "visualization_msgs/msg/InteractiveMarkerUpdate" && /\/update$/.test(x.name)).map((x) => x.name.replace(/\/update$/, "")).sort(), commit: (s) => { d.autoNs = false; set(s.trim()); } } };   // InteractiveMarkerNamespaceProperty
      else value = { k: "text", text: fmtVal(cur), edit: { commit: (s) => set(t === "int" ? Math.round(Number(s)) || 0 : parseVal(cur, s)) } };
      rows.push({ path, depth, name: k, value, kids: !!kids || t === "vec3", help: helpFor(d, k), disabled: dis });
      if (t === "vec3") ["X", "Y", "Z"].forEach((ax, i) => rows.push({ path: `${path}/${ax}`, depth: depth + 1, name: ax, disabled: dis, value: { k: "text", text: qnum(vecOf(cur)[i]), edit: { commit: (s) => { const v = vecOf(cur); v[i] = Number(s) || 0; set(v.map(qnum).join("; ")); } } } }));
      if (kids) rows.push(...propRows(d, kids, depth + 1, path, dis));
    }
    return rows;
  }
  function displayRows(d) {
    const base = `d${d.id}`, s = d.enabled ? d.status || [] : [], k = worst(s), dis = !d.enabled;
    const cls = d.enabled ? `bold ${s.length && k !== "ok" ? k : "blue"}` : "";
    const rows = [{ path: base, depth: 0, name: d.name, cls, icon: d.enabled && s.length && k !== "ok" ? statusIcon(k) : ico(ICONS[d.type] || "default_class_icon.png"), kids: true, help: null, display: d,
      value: { k: "check", checked: d.enabled, set: (x) => { d.enabled = x; changed(); refresh(); } } }];
    if (s.length) {
      rows.push({ path: `${base}/Status`, depth: 1, name: `Status: ${WORD[k]}`, cls: k === "ok" ? "" : k, icon: statusIcon(k), kids: true, disabled: dis, help: "" });
      const seen = new Map(); for (const [lv, text, key] of s) { const n = key || "Status"; seen.set(n, [lv, text]); }
      for (const [n, [lv, text]] of seen) rows.push({ path: `${base}/Status/${n}`, depth: 2, name: n, cls: lv === "ok" ? "" : lv, icon: statusIcon(lv), value: { k: "text", text }, disabled: dis, help: "" });
    }
    rows.push(...propRows(d, SCHEMA[d.type] || [], 1, base, dis));
    if (d.type === "TF") {
      rows.push({ path: `${base}/Frames`, depth: 1, name: "Frames", kids: true, disabled: dis, help: "The list of all frames." });
      rows.push({ path: `${base}/Frames/All Enabled`, depth: 2, name: "All Enabled", disabled: dis, help: "Whether all the frames should be enabled or not.", value: { k: "check", checked: S.tfOff.size === 0, set: (x) => { if (x) S.tfOff.clear(); else Object.keys(poses).forEach((f) => S.tfOff.add(f)); refresh(); } } });
      const parentOf = Object.fromEntries(edges().map((e) => [e.child, e.parent]));
      for (const f of Object.keys(poses).sort()) {
        const P = poses[f], rpy = P.q;
        rows.push({ path: `${base}/Frames/${f}`, depth: 2, name: f, kids: true, disabled: dis, help: "Enable or disable this individual frame.", value: { k: "check", checked: !S.tfOff.has(f), set: (x) => { if (x) S.tfOff.delete(f); else S.tfOff.add(f); refresh(); } } });
        rows.push({ path: `${base}/Frames/${f}/Parent`, depth: 3, name: "Parent", disabled: dis, value: { k: "text", text: parentOf[f] || "" }, help: "Parent of this frame.  (Not editable)" });
        rows.push({ path: `${base}/Frames/${f}/Position`, depth: 3, name: "Position", disabled: dis, value: { k: "text", text: P.t.map(qnum).join("; ") }, help: "Position of this frame, in the current Fixed Frame.  (Not editable)" });
        rows.push({ path: `${base}/Frames/${f}/Orientation`, depth: 3, name: "Orientation", disabled: dis, value: { k: "text", text: rpy.map(qnum).join("; ") }, help: "Orientation of this frame, in the current Fixed Frame.  (Not editable)" });
      }
      rows.push({ path: `${base}/Tree`, depth: 1, name: "Tree", kids: Object.keys(poses).length > 0, disabled: dis, help: "A tree-view of the frames, showing the parent/child relationships." });
      const kidsOf = {}; for (const e of edges()) (kidsOf[e.parent] = kidsOf[e.parent] || []).push(e.child);
      const walk = (f, dep, p) => { const path = `${p}/${f}`; rows.push({ path, depth: dep, name: f, kids: !!(kidsOf[f] || []).length, disabled: dis, value: { k: "text", text: "" } }); (kidsOf[f] || []).forEach((c) => walk(c, dep + 1, path)); };
      const rootsT = Object.keys(poses).filter((f) => !parentOf[f]); rootsT.forEach((r) => walk(r, 2, `${base}/Tree`));
    }
    if (d.type === "RobotModel" && S.model) {
      rows.push({ path: `${base}/Links`, depth: 1, name: "Links", kids: true, disabled: dis, help: "" });
      rows.push({ path: `${base}/Links/All Links Enabled`, depth: 2, name: "All Links Enabled", disabled: dis, value: { k: "check", checked: S.linkOff.size === 0, set: (x) => { if (x) S.linkOff.clear(); else Object.keys(S.model.links).forEach((l) => S.linkOff.add(l)); refresh(); } } });
      for (const [lab, def] of [["Expand Joint Details", false], ["Expand Link Details", false], ["Expand Tree", false]]) rows.push({ path: `${base}/Links/${lab}`, depth: 2, name: lab, disabled: dis, value: { k: "check", checked: !!d.props[`links:${lab}`] ?? def, set: (x) => { d.props[`links:${lab}`] = x; refresh(); } } });
      rows.push({ path: `${base}/Links/Link Tree Style`, depth: 2, name: "Link Tree Style", disabled: dis, value: { k: "text", text: "Links in Alphabetic Order" } });
      for (const l of Object.keys(S.model.links).sort()) {
        const g = linkObjs.get(l), hasGeom = S.model.links[l].visuals.length + S.model.links[l].collisions.length > 0;
        rows.push({ path: `${base}/Links/${l}`, depth: 2, name: l, icon: ico(hasGeom ? "RobotLink.png" : "RobotLinkNoGeom.png"), kids: true, disabled: dis, value: hasGeom ? { k: "check", checked: !S.linkOff.has(l), set: (x) => { if (x) S.linkOff.delete(l); else S.linkOff.add(l); refresh(); } } : { k: "text", text: "" } });
        rows.push({ path: `${base}/Links/${l}/Alpha`, depth: 3, name: "Alpha", disabled: dis, value: { k: "text", text: "1" } });
        rows.push({ path: `${base}/Links/${l}/Show Axes`, depth: 3, name: "Show Axes", disabled: dis, value: { k: "check", checked: !!d.props[`link:${l}:Show Axes`], set: (x) => { d.props[`link:${l}:Show Axes`] = x; refresh(); } } });
        rows.push({ path: `${base}/Links/${l}/Show Trail`, depth: 3, name: "Show Trail", disabled: dis, value: { k: "check", checked: false, set: () => {} } });
        if (g === undefined) continue;
      }
    }
    return rows;
  }
  function globalRows() {
    const gs = frameErr ? (edges().length ? ["error", `Fixed Frame [${S.fixedFrame}] does not exist`] : ["warn", `No tf data.  Actual error: Frame [${S.fixedFrame}] does not exist`]) : ["ok", "OK"];
    return [
      { path: "g", depth: 0, name: "Global Options", icon: ico("options.png"), kids: true, help: "" },
      { path: "g/Fixed Frame", depth: 1, name: "Fixed Frame", help: "Frame into which all data is transformed before being displayed.", value: { k: "text", text: S.fixedFrame, edit: { options: [...frames].sort(), commit: (s) => { const f = s.trim().replace(/^\//, ""); if (f && f !== S.fixedFrame) { S.fixedFrame = f; changed({ fixedFrame: f }); } refresh(); } } } },
      { path: "g/Background Color", depth: 1, name: "Background Color", help: "Background color for the 3D view.", value: { k: "color", text: S.background, edit: { color: true, commit: (s) => { S.background = rgbOf(s).map((x) => Math.round(x * 255)).join("; "); bg(); changed(); refresh(); } } } },
      { path: "g/Frame Rate", depth: 1, name: "Frame Rate", help: "RViz will try to render this many frames per second.", value: { k: "text", text: String(S.frameRate), edit: { commit: (s) => { S.frameRate = Math.max(1, Math.round(Number(s)) || 30); refresh(); } } } },
      { path: "gs", depth: 0, name: `Global Status: ${WORD[gs[0]]}`, cls: gs[0] === "ok" ? "" : gs[0], icon: statusIcon(gs[0]), kids: true, help: "" },
      { path: "gs/Fixed Frame", depth: 1, name: "Fixed Frame", cls: gs[0] === "ok" ? "" : gs[0], icon: statusIcon(gs[0]), value: { k: "text", text: gs[1] }, help: "" },
    ];
  }
  let lastStatus = [];
  function renderTree() {
    const rows = [...globalRows(), ...S.displays.flatMap(displayRows)];
    tree(dTree, rows, { sel: S.sel, open: S.open, onSel: (p, keep, soft) => { S.sel = p; if (soft) updateHelp(rows); else renderTree(); } });
    updateHelp(rows);
    const gsRow = rows.find((x) => x.path === "gs/Fixed Frame");
    const flat = [[gsRow.cls || "ok", `Fixed Frame: ${gsRow.value.text}`], ...S.displays.filter((x) => x.enabled).flatMap((x) => (x.status || []).map(([kk, t]) => [kk, `${x.name}: ${t}`])), ...sensorMsgs.map(([kk, t]) => [kk, t])];
    lastStatus = flat;
    status.replaceChildren(...flat.map(([kk, t]) => h("div", { class: `rv-st ${kk}`, text: t })));
  }
  function updateHelp(rows) {
    const r = rows.find((x) => x.path === S.sel);
    if (r && r.display && r.display.failed) { dHelp.innerHTML = `The class required for this display, '${esc(r.display.failed)}', could not be loaded.<br><b>Error:</b><br>According to the loaded plugin descriptions the class ${esc(r.display.failed)} with base class type rviz_common::Display does not exist. Declared types are  ${availTypes().map((t) => `${pluginPkg(t)}/${t}`).join(" ")}`; return; }
    if (r && r.display) { const de = DESC[r.display.type] || { text: "" }; dHelp.innerHTML = `<strong>${esc(r.display.type)}</strong><br>${esc(de.text)}${de.url ? ` <a href="${esc(de.url)}" target="_blank" rel="noopener">More Information</a>.` : ""}`; }
    else if (r) dHelp.innerHTML = `<strong>${esc(r.name)}</strong><br>${esc(r.help || "")}`;
    else dHelp.innerHTML = "";
    const d = selDisplay(); btnDup.disabled = btnRem.disabled = btnRen.disabled = !d;
  }

  // ----- Views tree
  function renderViewValues() { if (S.panels.views && vTree.isConnected) renderViews(); }
  function renderViews() {
    if (!S.panels.views) return;
    vType.value = S.view.type;
    const V = S.view, set = (k, f = Number) => (s) => { const x = f(s); if (x === x) { S.autoFit = false; V[k] = x; applyView(); } };
    const base = "cv", rows = [{ path: base, depth: 0, name: "Current View", cls: "bold", rowBold: true, kids: true, value: { k: "text", text: `${V.type} (rviz_default_plugins)` } }];
    if (V.type === "TopDownOrtho") {
      rows.push({ path: `${base}/Near Clip Distance`, depth: 1, name: "Near Clip Distance", value: { k: "text", text: qnum(V.near), edit: { commit: set("near") } } },
        { path: `${base}/Invert Z Axis`, depth: 1, name: "Invert Z Axis", value: { k: "check", checked: V.invertZ, set: (x) => { V.invertZ = x; applyView(); } } },
        { path: `${base}/Target Frame`, depth: 1, name: "Target Frame", value: { k: "text", text: "<Fixed Frame>" } },
        { path: `${base}/Scale`, depth: 1, name: "Scale", value: { k: "text", text: qnum(V.scale), edit: { commit: set("scale") } } },
        { path: `${base}/Angle`, depth: 1, name: "Angle", value: { k: "text", text: qnum(V.angle), edit: { commit: set("angle") } } },
        { path: `${base}/X`, depth: 1, name: "X", value: { k: "text", text: qnum(V.x), edit: { commit: set("x") } } },
        { path: `${base}/Y`, depth: 1, name: "Y", value: { k: "text", text: qnum(V.y), edit: { commit: set("y") } } });
    } else {
      rows.push({ path: `${base}/Near Clip Distance`, depth: 1, name: "Near Clip Distance", value: { k: "text", text: qnum(V.near), edit: { commit: set("near") } } },
        { path: `${base}/Invert Z Axis`, depth: 1, name: "Invert Z Axis", value: { k: "check", checked: V.invertZ, set: (x) => { V.invertZ = x; applyView(); } } },
        { path: `${base}/Target Frame`, depth: 1, name: "Target Frame", value: { k: "text", text: "<Fixed Frame>" } },
        { path: `${base}/Distance`, depth: 1, name: "Distance", value: { k: "text", text: qnum(V.distance), edit: { commit: set("distance") } } },
        { path: `${base}/Focal Shape Size`, depth: 1, name: "Focal Shape Size", value: { k: "text", text: qnum(V.focalSize), edit: { commit: set("focalSize") } } },
        { path: `${base}/Focal Shape Fixed Size`, depth: 1, name: "Focal Shape Fixed Size", value: { k: "check", checked: V.focalFixed, set: (x) => { V.focalFixed = x; applyView(); } } },
        { path: `${base}/Yaw`, depth: 1, name: "Yaw", value: { k: "text", text: qnum(V.yaw), edit: { commit: set("yaw") } } },
        { path: `${base}/Pitch`, depth: 1, name: "Pitch", value: { k: "text", text: qnum(V.pitch), edit: { commit: set("pitch") } } },
        { path: `${base}/Focal Point`, depth: 1, name: "Focal Point", kids: true, value: { k: "text", text: V.focal.map(qnum).join("; "), edit: { commit: (s) => { V.focal = vecOf(s); applyView(); } } } },
        ...["X", "Y", "Z"].map((a, i) => ({ path: `${base}/Focal Point/${a}`, depth: 2, name: a, value: { k: "text", text: qnum(V.focal[i]), edit: { commit: (s) => { V.focal[i] = Number(s) || 0; applyView(); } } } })));
    }
    S.savedViews.forEach((sv, i) => rows.push({ path: `sv${i}`, depth: 0, name: sv.name, kids: false, value: { k: "text", text: `${sv.view.type} (rviz_default_plugins)` } }));
    tree(vTree, rows, { sel: S.vsel != null ? `sv${S.vsel}` : S.vselPath, open: S.vopen || (S.vopen = new Set(["cv"])), onSel: (p, keep, soft) => { const m = /^sv(\d+)$/.exec(p || ""); S.vsel = m ? Number(m[1]) : null; S.vselPath = p; if (!soft) renderViews(); } });
    vTree.querySelectorAll(".q-row").forEach((r) => { const m = /^sv(\d+)$/.exec(r.dataset.path); if (m) r.addEventListener("dblclick", () => { Object.assign(S.view, JSON.parse(JSON.stringify(S.savedViews[Number(m[1])].view))); applyView(); renderViews(); }); });
  }
  // ----- Tool Properties and Selection trees
  function renderToolProps() {
    if (!S.panels.tool) return;
    const T = S.toolProps || (S.toolProps = { "Interact/Hide Inactive Objects": true, "Measure/Line color": "128; 128; 0", "2D Pose Estimate/Topic": "/initialpose", "2D Pose Estimate/Covariance x": 0.25, "2D Pose Estimate/Covariance y": 0.25, "2D Pose Estimate/Covariance yaw": 0.0685389, "2D Goal Pose/Topic": "/goal_pose", "Publish Point/Single click": true, "Publish Point/Topic": "/clicked_point" });
    const rows = [];
    for (const tool of ["Interact", "Move Camera", "Select", "Focus Camera", "Measure", "2D Pose Estimate", "2D Goal Pose", "Publish Point"]) {
      const keys = Object.keys(T).filter((k) => k.startsWith(tool + "/"));
      rows.push({ path: tool, depth: 0, name: tool, kids: keys.length > 0 });
      for (const k of keys) { const n = k.slice(tool.length + 1), v = T[k]; rows.push({ path: k, depth: 1, name: n, value: typeof v === "boolean" ? { k: "check", checked: v, set: (x) => { T[k] = x; renderToolProps(); } } : n === "Line color" ? { k: "color", text: v } : { k: "text", text: fmtVal(v) } }); if (n === "Topic") ["Depth", "History Policy", "Reliability Policy", "Durability Policy"].forEach((q, i) => rows.push({ path: `${k}/${q}`, depth: 2, name: q, value: { k: "text", text: ["5", "Keep Last", "Reliable", "Volatile"][i] } })); }
    }
    tree(tTree, rows, { sel: S.tsel, open: S.topen || (S.topen = new Set(["2D Goal Pose", "Publish Point"])), onSel: (p, keep, soft) => { S.tsel = p; if (!soft) renderToolProps(); }, ratio: 0.588679 });
  }
  function renderSelection() {
    if (!S.panels.selection) return;
    const sl = S.selection;
    tree(selTree, sl ? [{ path: "s", depth: 0, name: sl.name, kids: true }, { path: "s/Position", depth: 1, name: "Position", value: { k: "text", text: sl.point.toArray().map(qnum).join("; ") } }] : [], { sel: null, open: new Set(["s"]), onSel: () => {} });
  }

  // ================= dialogs (QDialog look) =================
  function modal(title, body, buttons, cls = "") {
    dialog.replaceChildren(h("div", { class: `q-dlg ${cls}`, role: "dialog", "aria-label": title }, h("div", { class: "rv-titlebar q-dlgtitle" }, h("span", { class: "rv-tbspace" }), h("span", { class: "rv-wtitle", text: title }), h("span", { class: "rv-wbtns" }, wbtn("close", "Close", () => close()))), h("div", { class: "q-dlgbody" }, body, h("div", { class: "q-dlgbtns" }, ...buttons))));
    dialog.hidden = false;
    const f = dialog.querySelector("input, select, .q-tree"); if (f) f.focus();
  }
  const close = () => { dialog.hidden = true; };
  // QPushButton; dialog buttons (QDialogButtonBox) carry the icon theme's icons on Ubuntu (Yaru)
  const qbtn = (text, fn, extra = {}) => {
    const i = text.indexOf("&"), kids = i < 0 ? [text] : [text.slice(0, i), h("u", { text: text[i + 1] }), text.slice(i + 2)];
    const icon = extra.icon; delete extra.icon;
    return h("button", { type: "button", class: `q-btn${icon ? " q-ibtn" : ""}`, onclick: fn, "aria-label": text.replace("&", ""), ...extra }, icon ? h("span", { class: `q-bicon ${icon}`, "aria-hidden": "true" }) : null, h("span", {}, kids));
  };
  const okBtn_ = (fn, extra = {}) => qbtn("&OK", fn, { icon: "ok", ...extra });
  const cancelBtn_ = () => qbtn("&Cancel", close, { icon: "cancel" });
  function msgDialog(title, text) { modal(title, h("div", { class: "q-msg" }, h("img", { src: ico("package.png"), alt: "", width: "48", height: "48" }), h("p", { text })), [okBtn_(close)], "q-small"); }
  function textDialog(title, label, value, ok) { const i = h("input", { class: "q-line wide", value }); modal(title, h("div", {}, h("p", { class: "q-lbl", text: label }), i), [cancelBtn_(), okBtn_(() => { const v = i.value.trim(); if (v) ok(v); close(); })], "q-small"); i.select(); }
  function renameDialog(d) { textDialog("Rename Display", "New Name?", d.name, (n) => { d.name = n; changed(); refresh(); }); }
  function saveAsDialog() {
    const i = h("input", { class: "q-line wide", value: S.configName || opts.savePath || "~/my_config.rviz" });
    modal("Choose a file to save to", h("div", {}, h("p", { class: "q-lbl", text: "File name:" }), i), [cancelBtn_(), qbtn("&Save", () => { const p = i.value.trim(); close(); S.configName = p; S.dirty = false; renderTitle(); if (opts.onSave) opts.onSave(p, configText()); else download(p.split("/").pop() || "my_config.rviz", new Blob([configText()], { type: "text/yaml" })); })], "q-small");
  }
  function pickTree(items, onPick, onDbl, ratio = 1) {   // a QTreeWidget with package groups and class icons
    const el = h("div", { class: "q-tree q-picktree", role: "tree", tabindex: "0" });
    let sel = null, open = new Set(items.filter((r) => r.kids && !r.collapsed).map((r) => r.path));
    const can = (r) => r && !r.kids && !r.disabled && (r.type || r.tool || r.key);
    const paint = () => { tree(el, items, { ratio, sel, open, onSel: (p, keep, soft) => { sel = p; if (!soft) paint(); const r = items.find((x) => x.path === p); if (can(r)) onPick(r); else if (onPick.none) onPick.none(); } }); el.querySelectorAll(".q-row").forEach((row) => { const r = items.find((x) => x.path === row.dataset.path); if (can(r)) row.addEventListener("dblclick", () => onDbl(r)); }); };
    el.setItems = (next) => { const keep = open; items = next; open = new Set(items.filter((r) => r.kids && (keep.has(r.path) || !r.collapsed)).map((r) => r.path)); if (!items.some((r) => r.path === sel)) sel = null; paint(); };
    requestAnimationFrame(paint); paint();
    return el;
  }
  // TopicDisplayWidget::fill (add_display_dialog.cpp): every topic in the graph, grouped by base topic, with the display
  // plugins that can show its message type; topics with no plugin are "unvisualizable" (greyed, hidden unless asked)
  function topicTreeItems(showHidden, filter) {
    const all = (opts.topics ? opts.topics() : []).slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const plugins = (type) => availTypes().filter((t) => (MSG_TYPES[t] || []).includes(type)).sort();
    const isSub = (base, t) => { let q = t; while (q && q !== "/") { if (q === base) return true; q = q.slice(0, q.lastIndexOf("/")); } return false; };
    const groups = [], unvis = [];
    for (const t of all) {
      const ps = plugins(t.type);
      if (!ps.length) { unvis.push(t.name); continue; }
      if (!groups.length || !isSub(groups[groups.length - 1].base, t.name)) groups.push({ base: t.name, plugins: new Map() });
      const g = groups[groups.length - 1];
      for (const pl of ps) { if (!g.plugins.has(pl)) g.plugins.set(pl, []); g.plugins.get(pl).push({ suffix: t.name === g.base ? "raw" : t.name.slice(g.base.length + 1), type: t.type }); }
    }
    // a real tree (QTreeWidgetItems keep insertion order under their parent), flattened depth-first afterwards
    const rootN = { kids: [] }, byPath = new Map();
    const insert = (topic, disabled) => {   // insertItem: one row per name part ("/robot", "/scan"); the first two levels start expanded
      let cur = rootN, path = "";
      topic.split("/").slice(1).forEach((part, i) => {
        path += "/" + part;
        let n = cur.kids.find((k) => k.r.path === path && !k.r.type);
        if (!n) { n = { r: { path, depth: i, name: "/" + part, disabled, collapsed: i + 1 >= 3, topicPath: path }, kids: [] }; cur.kids.push(n); byPath.set(path, n); }
        cur = n;
      });
      return cur;
    };
    for (const g of groups) {
      const n = insert(g.base, false);
      for (const [pl, infos] of [...g.plugins].sort((a, b) => (a[0] < b[0] ? -1 : 1))) n.kids.push({ r: { path: `${g.base}#${pl}`, depth: n.r.depth + 1, name: pl, type: pl, topic: infos[0].suffix === "raw" ? g.base : `${g.base}/${infos[0].suffix}`, icon: ico(ICONS[pl] || "default_class_icon.png"), topicPath: g.base }, kids: [] });
    }
    for (const u of unvis) insert(u, true);
    // applyFilter: a row is shown if its topic path contains the filter text, or one of its children is shown
    const f = (filter || "").trim().toLowerCase();
    const items = [];
    const walk = (n) => {
      const shownKids = []; for (const k of n.kids) { const sub = walk(k); if (sub.length) shownKids.push(...sub); }
      if (!n.r) return shownKids;
      const self = (!f || n.r.topicPath.toLowerCase().includes(f)) && (showHidden || !n.r.disabled);
      if (!self && !shownKids.length) return [];
      n.r.kids = shownKids.length > 0;
      return [n.r, ...shownKids];
    };
    items.push(...walk(rootN));
    return items;
  }
  // QGroupBox (title above a Fusion frame) used by AddDisplayDialog and NewObjectDialog
  const group = (title, ...content) => h("div", { class: "q-group" }, h("div", { class: "q-gtitle", text: title }), h("div", { class: "q-gframe" }, ...content));
  const descHtml = (el, html) => { el.innerHTML = html; };
  // AddDisplayDialog (add_display_dialog.cpp): "Create visualization" with the two tabs and Description, "Display Name", OK/Cancel
  function addDialog() {
    let pick = null;
    const nameIn = h("input", { class: "q-line wide", "aria-label": "Display Name" });
    const desc = h("div", { class: "q-descbox" });
    const okBtn = okBtn_(() => { if (!pick) return; const d = mkDisplay(pick.type, nameIn.value.trim() || pick.type); if (pick.topic) { if (pick.type === "RobotModel") d.props["Description Topic"] = pick.topic; else if (pick.type === "InteractiveMarkers") d.props["Interactive Markers Namespace"] = pick.topic.slice(0, pick.topic.indexOf("/", 1) > 0 ? pick.topic.indexOf("/", 1) : undefined); else if ("Topic" in d.props) d.props.Topic = pick.topic; } S.displays.push(d); S.sel = `d${d.id}`; S.open.add(`d${d.id}`); close(); changed(); refresh(); }, { disabled: true });
    const choose = (r) => { pick = r; nameIn.value = r.name || r.type; const de = DESC[r.type] || { text: "" }; descHtml(desc, `${esc(de.text)}${de.url ? ` <a href="${esc(de.url)}" target="_blank" rel="noopener">More Information</a>.` : ""}`); okBtn.disabled = false; };
    const typeItems = [{ path: "rviz_common", depth: 0, name: "rviz_common", icon: ico("default_package_icon.png"), kids: true }, { path: "rviz_common/Group", depth: 1, name: "Group", type: "Group", icon: ico("Group.png") },
      { path: "rviz_default_plugins", depth: 0, name: "rviz_default_plugins", icon: ico("default_package_icon.png"), kids: true }, ...DISPLAY_TYPES.map((t) => ({ path: `rviz_default_plugins/${t}`, depth: 1, name: t, type: t, icon: ico(ICONS[t]) })),
      ...[...new Set(Object.values(EXTRA_PLUGINS).map((x) => x.pkg))].filter((pk) => installed.has(pk)).sort().flatMap((pk) => [{ path: pk, depth: 0, name: pk, icon: ico("default_package_icon.png"), kids: true }, ...Object.keys(EXTRA_PLUGINS).filter((t) => EXTRA_PLUGINS[t].pkg === pk).map((t) => ({ path: `${pk}/${t}`, depth: 1, name: t, type: t, icon: ico(EXTRA_PLUGINS[t].icon) }))])];
    const finish = (r) => { choose(r); okBtn.click(); };
    const none = () => { pick = null; okBtn.disabled = true; descHtml(desc, ""); };
    choose.none = none;
    const hiddenCb = h("input", { type: "checkbox", class: "q-check", id: `rvhid${++seq}` }), filterIn = h("input", { class: "q-line wide", "aria-label": "Filter topics by name" });
    const byType = pickTree(typeItems, choose, finish), topicTree = pickTree(topicTreeItems(false, ""), choose, finish, 1);
    topicTree.classList.add("q-topictree");
    const refill = () => topicTree.setItems(topicTreeItems(hiddenCb.checked, filterIn.value));
    hiddenCb.addEventListener("change", refill); filterIn.addEventListener("input", refill);
    const byTopic = h("div", { class: "q-bytopic", hidden: true }, topicTree, h("label", { class: "q-cbl", for: hiddenCb.id }, hiddenCb, "Show unvisualizable topics"), h("div", { class: "q-lbl", text: "Filter topics by name:" }), filterIn);
    // onTabChanged: the selection (and so OK) follows the visible tab
    const tab = (label, on, show) => h("button", { type: "button", role: "tab", class: `q-tab${on ? " on" : ""}`, text: label, onclick: (e) => { byType.hidden = !show; byTopic.hidden = show; none(); nameIn.value = ""; e.currentTarget.parentElement.querySelectorAll(".q-tab").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); } });
    modal("rviz2", h("div", { class: "q-adddlg" },
      group("Create visualization", h("div", { class: "q-tabs", role: "tablist" }, tab("By display type", true, true), tab("By topic", false, false)), h("div", { class: "q-tabpane" }, byType, byTopic),
        h("div", { class: "q-lbl", text: "Description:" }), desc),
      group("Display Name", nameIn)), [cancelBtn_(), okBtn], "q-add");
  }
  // NewObjectDialog (new_object_dialog.cpp): "<Type> Type" tree + Description, optional "<Type> Name"
  function newObjectDialog(kind, items, onOk, withName) {
    let pick = null;
    const desc = h("div", { class: "q-descbox" }), nameIn = withName ? h("input", { class: "q-line wide", "aria-label": `${kind} Name` }) : null;
    const okBtn = okBtn_(() => { if (pick) onOk(pick, nameIn ? nameIn.value.trim() : ""); close(); }, { disabled: true });
    const tree_ = pickTree(items, (r) => { pick = r; descHtml(desc, esc(r.desc || "")); if (nameIn) nameIn.value = r.name; okBtn.disabled = false; }, () => okBtn.click());
    modal("rviz2", h("div", { class: "q-adddlg" }, group(`${kind} Type`, tree_, h("div", { class: "q-lbl", text: "Description:" }), desc), withName ? group(`${kind} Name`, nameIn) : null), [cancelBtn_(), okBtn], withName ? "q-add" : "q-add q-noname");
  }
  function addToolDialog() {
    const missing = TOOLS.filter((t) => !S.tools.includes(t.id));
    const items = [{ path: "rviz_default_plugins", depth: 0, name: "rviz_default_plugins", icon: ico("default_package_icon.png"), kids: true }, ...missing.map((t) => ({ path: t.id, depth: 1, name: t.name, tool: t, icon: ico(t.icon), desc: TOOL_DESC[t.id] }))];
    newObjectDialog("Tool", items, (r) => { S.tools.push(r.tool.id); S.tools.sort((a, b) => TOOLS.findIndex((t) => t.id === a) - TOOLS.findIndex((t) => t.id === b)); renderToolbar(); }, false);
  }
  function addPanelDialog() {
    const P = [["Displays", "displays", "Show and edit the list of Displays"], ["Help", "help", "Show the key and mouse bindings"], ["Selection", "selection", "Show properties of selected objects"], ["Time", "time", "Show the current time"], ["Tool Properties", "tool", "Show and edit properties of tools"], ["Views", "views", "Show and edit viewpoints"]];
    const items = [{ path: "rviz_common", depth: 0, name: "rviz_common", icon: ico("default_package_icon.png"), kids: true }, ...P.map(([n, k, dsc]) => ({ path: k, depth: 1, name: n, key: k, icon: ico("default_class_icon.png"), desc: dsc }))];
    newObjectDialog("Panel", items, (r) => { S.panels[r.key] = true; if (r.key === "help") helpDock.dataset.used = "1"; layout(); }, true);
  }

  // ================= Time panel =================
  const t0 = Date.now();
  const timer = setInterval(() => {
    if (!S.panels.time || !root.isConnected) return;
    const now = Date.now() / 1000, el = (Date.now() - t0) / 1000;
    const sim = S.rosTime !== undefined && S.rosTime !== null;   // use_sim_time: the /clock from Gazebo
    timeFields["ROS Time"].value = (sim ? S.rosTime : now).toFixed(2); timeFields["ROS Elapsed"].value = (sim ? S.rosTime - (S.rosTime0 || 0) : el).toFixed(2); timeFields["Wall Time"].value = now.toFixed(2); timeFields["Wall Elapsed"].value = el.toFixed(2);
  }, 100);
  // hide-dock buttons (hideLeftDock / hideRightDock) and dock splitters (drag to resize)
  // Like a small QMainWindow: when the window is too narrow for both docks and a usable 3D view, the docks start
  // hidden (the student can still open them with the arrow buttons). Measured on the window itself, so it also
  // works inside narrow lesson columns, not only on narrow screens.
  // Below 900px only the right dock (Views) starts hidden; below 560px both do.
  const narrowNow = () => { const w = root.clientWidth || (typeof innerWidth !== "undefined" ? innerWidth : 1200); return w <= 560 ? 2 : w <= 900 ? 1 : 0; };
  const applyNarrow = (n) => { S.hideL = n >= 2; S.hideR = n >= 1; };
  let wasNarrow = narrowNow(); applyNarrow(wasNarrow); S.userDock = false;
  hideL.addEventListener("click", () => { S.userDock = true; S.hideL = !S.hideL; layout(); });
  hideR.addEventListener("click", () => { S.userDock = true; S.hideR = !S.hideR; layout(); });
  const ro2 = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
    const n = narrowNow(); if (n === wasNarrow || S.userDock) { wasNarrow = n; return; }
    wasNarrow = n; applyNarrow(n); layout();
  });
  if (ro2) ro2.observe(root);
  for (const [sep, side] of [[sepL, "left"], [sepR, "right"]]) {
    sep.addEventListener("pointerdown", (e) => {
      const start = e.clientX, w0 = (side === "left" ? left : right).getBoundingClientRect().width; sep.setPointerCapture(e.pointerId);
      const mv = (ev) => { const w = Math.max(120, Math.min(root.clientWidth - 200, w0 + (side === "left" ? 1 : -1) * (ev.clientX - start))); root.style.setProperty(`--rv-${side}`, `${w}px`); };
      const up = () => { sep.removeEventListener("pointermove", mv); sep.removeEventListener("pointerup", up); layout(); };
      sep.addEventListener("pointermove", mv); sep.addEventListener("pointerup", up);
    });
  }
  function layout() {
    dispDock.hidden = !S.panels.displays; viewsDock.hidden = !S.panels.views; toolDock.hidden = !S.panels.tool; selDock.hidden = !S.panels.selection; helpDock.hidden = !S.panels.help; timeDock.hidden = !S.panels.time; toolBar.hidden = !S.toolbar;
    const L = (S.panels.displays || S.panels.tool || S.panels.selection) && !S.hideL, Rt = (S.panels.views || S.panels.help) && !S.hideR;
    root.classList.toggle("no-left", !L); root.classList.toggle("no-right", !Rt);
    hideL.classList.toggle("flip", !!S.hideL); hideR.classList.toggle("flip", !!S.hideR);
    hideL.setAttribute("aria-pressed", String(!!S.hideL)); hideR.setAttribute("aria-pressed", String(!!S.hideR));
    hideL.title = S.hideL ? "Show the left dock" : "Hide the left dock"; hideR.title = S.hideR ? "Show the right dock" : "Hide the right dock";
    renderViews(); renderToolProps(); renderSelection(); renderTree(); resize();
  }

  // ================= refresh =================
  function refresh(light_ = false) {
    computeFrames();
    buildGrid();
    placeRobot();
    buildTF();
    buildMarkers();
    if (!light_) { buildIMarkers(); buildSensors(); }
    renderTree();
    if (S.needFit && ([...linkObjs.values()].some((g) => g.visible) || markerG.children.length || sensorG.children.length || imG.children.length)) { S.needFit = false; fitView(); }
    draw();
  }
  function configText() {   // a .rviz file (YAML), like File -> Save Config
    const val = (v) => (typeof v === "string" && (v === "" || /[:#<>]/.test(v)) ? `"${v}"` : String(v));
    const ds = S.displays.map((d) => [`    - Class: ${d.failed ? d.failed : `${pluginPkg(d.type)}/${d.type}`}`, `      Enabled: ${d.enabled}`, `      Name: ${d.name}`,
      ...Object.entries(d.props).filter(([k]) => !k.includes(":")).map(([k, v]) => (k === "Topic" || k === "Description Topic" ? `      ${k}:\n        Depth: ${d.props.Depth ?? 5}\n        Durability Policy: ${d.props["Durability Policy"] || "Volatile"}\n        History Policy: ${d.props["History Policy"] || "Keep Last"}\n        Reliability Policy: ${d.props["Reliability Policy"] || "Reliable"}\n        Value: ${v}` : ["Depth", "Durability Policy", "History Policy", "Reliability Policy"].includes(k) ? null : `      ${k}: ${val(v)}`)).filter(Boolean), `      Value: ${d.enabled}`].join("\n")).join("\n");
    const V = S.view;
    return `Panels:\n  - Class: rviz_common/Displays\n    Help Height: 78\n    Name: Displays\n    Property Tree Widget:\n      Expanded:\n        - /Global Options1\n        - /Status1\n      Splitter Ratio: 0.5\n    Tree Height: 555\n  - Class: rviz_common/Selection\n    Name: Selection\n  - Class: rviz_common/Tool Properties\n    Expanded:\n      - /2D Goal Pose1\n      - /Publish Point1\n    Name: Tool Properties\n    Splitter Ratio: 0.5886790156364441\n  - Class: rviz_common/Views\n    Expanded:\n      - /Current View1\n    Name: Views\n    Splitter Ratio: 0.5\n  - Class: rviz_common/Time\n    Experimental: false\n    Name: Time\n    SyncMode: 0\n    SyncSource: ""\nVisualization Manager:\n  Class: ""\n  Displays:\n${ds}\n  Enabled: true\n  Global Options:\n    Background Color: ${S.background}\n    Fixed Frame: ${S.fixedFrame}\n    Frame Rate: ${S.frameRate}\n  Name: root\n  Tools:\n    - Class: rviz_default_plugins/Interact\n      Hide Inactive Objects: true\n    - Class: rviz_default_plugins/MoveCamera\n    - Class: rviz_default_plugins/Select\n    - Class: rviz_default_plugins/FocusCamera\n    - Class: rviz_default_plugins/Measure\n      Line color: 128; 128; 0\n    - Class: rviz_default_plugins/SetInitialPose\n      Covariance x: 0.25\n      Covariance y: 0.25\n      Covariance yaw: 0.06853891909122467\n      Topic:\n        Depth: 5\n        Durability Policy: Volatile\n        History Policy: Keep Last\n        Reliability Policy: Reliable\n        Value: /initialpose\n    - Class: rviz_default_plugins/SetGoal\n      Topic:\n        Depth: 5\n        Durability Policy: Volatile\n        History Policy: Keep Last\n        Reliability Policy: Reliable\n        Value: /goal_pose\n    - Class: rviz_default_plugins/PublishPoint\n      Single click: true\n      Topic:\n        Depth: 5\n        Durability Policy: Volatile\n        History Policy: Keep Last\n        Reliability Policy: Reliable\n        Value: /clicked_point\n  Transformation:\n    Current:\n      Class: rviz_default_plugins/TF\n  Value: true\n  Views:\n    Current:\n      Class: rviz_default_plugins/${V.type}\n      Distance: ${qnum(V.distance)}\n      Enable Stereo Rendering:\n        Stereo Eye Separation: 0.05999999865889549\n        Stereo Focal Distance: 1\n        Swap Stereo Eyes: false\n        Value: false\n      Focal Point:\n        X: ${qnum(V.focal[0])}\n        Y: ${qnum(V.focal[1])}\n        Z: ${qnum(V.focal[2])}\n      Focal Shape Fixed Size: ${V.focalFixed}\n      Focal Shape Size: ${qnum(V.focalSize)}\n      Invert Z Axis: ${V.invertZ}\n      Name: Current View\n      Near Clip Distance: 0.009999999776482582\n      Pitch: ${qnum(V.pitch)}\n      Target Frame: <Fixed Frame>\n      Value: ${V.type} (rviz_default_plugins)\n      Yaw: ${qnum(V.yaw)}\n    Saved: ~\nWindow Geometry:\n  Displays:\n    collapsed: false\n  Height: 846\n  Hide Left Dock: false\n  Hide Right Dock: false\n  Selection:\n    collapsed: false\n  Time:\n    collapsed: false\n  Tool Properties:\n    collapsed: false\n  Views:\n    collapsed: false\n  Width: 1200\n  X: 60\n  Y: 60\n`;
  }
  // read a .rviz file: displays (with Topic and properties), Fixed Frame, background and the view
  function loadConfig(text, name) {
    const cfg = parseRvizYaml(text), vm = (cfg && cfg["Visualization Manager"]) || {};
    const go = vm["Global Options"] || {};
    const META = new Set(["Class", "Name", "Enabled", "Value"]);
    const ds = [];
    for (const { cls, item } of rvizDisplays(cfg)) {
      const type = cls.split("/").pop(), pkg = cls.split("/")[0];
      const ok = type === "Group" || (PLUGINS[type] && SCHEMA[type] && pkg === pluginPkg(type) && (!EXTRA_PLUGINS[type] || installed.has(pkg)));
      if (!ok) {   // pluginlib could not find the class: RViz keeps the display (red) with its saved settings
        ds.push({ id: ++seq, type: cls, name: String(item.Name ?? type), enabled: (item.Enabled ?? item.Value) !== false, props: {}, status: [], failed: cls, saved: item });
        continue;
      }
      // first the display's own keys (a nested map's "Value", or X/Y/Z), then nested sub-properties (Line Width, the
      // Topic's QoS...) without overwriting anything; per-link / per-frame maps (Links, Frames, Tree) are not properties
      const flat = {}, SKIP = new Set(["Links", "Frames", "Tree", "Namespaces", "Enabled Links"]);
      const own = (k, v) => { if (v && typeof v === "object" && !Array.isArray(v)) return "Value" in v ? v.Value : ("X" in v && "Y" in v && "Z" in v ? `${v.X}; ${v.Y}; ${v.Z}` : undefined); return v; };
      for (const [k, v] of Object.entries(item)) { if (META.has(k)) continue; const x = own(k, v); if (x !== undefined) flat[k] = x; }
      const deep = (obj) => { for (const [k, v] of Object.entries(obj)) { if (SKIP.has(k) || META.has(k)) continue; if (v && typeof v === "object" && !Array.isArray(v)) { const x = own(k, v); if (x !== undefined && !(k in flat)) flat[k] = x; deep(v); } else if (!(k in flat)) flat[k] = v; } };
      for (const [k, v] of Object.entries(item)) if (!SKIP.has(k) && v && typeof v === "object" && !Array.isArray(v)) deep(v);
      const d = mkDisplay(type, String(item.Name ?? type), (item.Enabled ?? item.Value) !== false);
      for (const k of Object.keys(d.props)) {
        if (!(k in flat) || flat[k] === null || (typeof flat[k] === "object")) continue;
        const v = flat[k], was = d.props[k];
        d.props[k] = typeof was === "boolean" ? v === true || v === "true" : typeof was === "number" ? (Number.isFinite(Number(v)) ? Number(v) : was) : String(v);
      }
      ds.push(d);
    }
    if (ds.length) S.displays = ds;
    if (go["Fixed Frame"]) S.fixedFrame = String(go["Fixed Frame"]).replace(/^\//, "");
    if (go["Background Color"]) { S.background = String(go["Background Color"]).trim(); bg(); }
    if (Number.isFinite(Number(go["Frame Rate"]))) S.frameRate = Number(go["Frame Rate"]);
    const cur = vm.Views && vm.Views.Current;
    if (cur && typeof cur === "object") {
      const vt = String(cur.Class || "").split("/").pop(); if (["Orbit", "XYOrbit", "TopDownOrtho"].includes(vt)) S.view.type = vt;
      for (const [k, p] of [["Distance", "distance"], ["Yaw", "yaw"], ["Pitch", "pitch"], ["Scale", "scale"], ["Angle", "angle"], ["X", "x"], ["Y", "y"]]) if (Number.isFinite(Number(cur[k])) && cur[k] !== null && cur[k] !== "") S.view[p] = Number(cur[k]);
      const fp = cur["Focal Point"]; if (fp && typeof fp === "object") S.view.focal = [Number(fp.X) || 0, Number(fp.Y) || 0, Number(fp.Z) || 0];
      S.autoFit = false; S.needFit = false; S.fitOnJoints = false; S.viewFromConfig = true;   // the config's saved view wins over auto-framing
    }
    S.configName = name || S.configName; S.dirty = false; renderTitle(); applyView(); refresh();
  }

  // ================= public API (unchanged for the terminal, lessons, playground and RViz page) =================
  let dead = false;
  const api = {
    // the topics this RViz subscribes to: the TF listener, plus each enabled display's topic
    subscriptions() {
      const out = [["/tf", "tf2_msgs/msg/TFMessage"], ["/tf_static", "tf2_msgs/msg/TFMessage"]], abs = (t) => (t.startsWith("/") ? t : "/" + t);
      for (const d of S.displays) {
        if (!d.enabled) continue;
        if (d.type === "RobotModel") { if (d.props["Description Source"] === "Topic" && d.props["Description Topic"]) out.push([abs(d.props["Description Topic"]), "std_msgs/msg/String"]); continue; }
        const type = (MSG_TYPES[d.type] || [TOPIC_TYPES[d.type]])[0];
        if (d.props.Topic && type && d.type !== "TF") out.push([abs(d.props.Topic), type]);
      }
      return out;
    },
    setModel(model, error = null) { S.model = model; S.modelError = error; S.needFit = !S.viewFromConfig; S.fitOnJoints = !S.viewFromConfig; buildRobot(); refresh(); },
    setJoints(values, have = true) {
      S.joints = { ...S.joints, ...values }; S.haveStates = have; refresh(true);
      if (S.fitOnJoints && have) { S.fitOnJoints = false; if (S.autoFit !== false) fitView(); }   // all links placed now: frame the whole robot once
    },
    setStatesAvailable(have) { S.haveStates = have; refresh(true); },
    setGui() { /* joint_state_publisher_gui is its own window (jsp-window.js) */ },
    setExtraEdges(list) { S.extraEdges = list || []; refresh(true); },
    setExternalTf(on) { S.externalTf = !!on; refresh(); },
    setFixedFrame(f) { if (f && f !== S.fixedFrame) { S.fixedFrame = f; refresh(); } },
    setDisplays(map) { applyDisplayMap(map); refresh(); },
    loadConfig, configText,
    setMarkers(list) { if (!S.markers.size && (list || []).length && !S.model) S.needFit = true; S.markers.clear(); api.addMarkers(list); },
    addMarkers(list) {
      for (const raw of list || []) {
        const r = normMarker(raw); const key = `${r.marker.ns || "''"}/${r.marker.id}`;
        if (raw.mesh_resource) r.marker.mesh_resource = raw.mesh_resource;
        if (raw.colors) r.marker.colors = raw.colors.map((c) => [c.r ?? c[0], c.g ?? c[1], c.b ?? c[2], c.a ?? c[3] ?? 1]);
        r.topic = raw.__topic;
        if (r.marker.action === 3) { S.markers.clear(); continue; }
        if (r.marker.action === 2) { S.markers.delete(key); continue; }
        S.markers.set(key, r);
      }
      refresh(true);
    },
    setIMarkers(list) {
      S.imarkers = (list || []).map((im) => ({ name: im.name, description: im.description || "", frame: (im.header && im.header.frame_id) || "map", scale: Number(im.scale || 1),
        p: [im.pose?.position?.x || 0, im.pose?.position?.y || 0, im.pose?.position?.z || 0], q: (() => { const o = im.pose?.orientation || {}; const q = [o.x || 0, o.y || 0, o.z || 0, o.w ?? 1]; const n = Math.hypot(...q) || 1; return q.map((v) => v / n); })(),
        controls: (im.controls || []).map((c) => { const o = c.orientation || {}; const q = [o.x || 0, o.y || 0, o.z || 0, o.w ?? 1]; const n = Math.hypot(...q) || 1; return { mode: typeof c.interaction_mode === "number" ? IM_MODES[c.interaction_mode] : c.interaction_mode, q: q.map((v) => v / n), markers: (c.markers || []).map((m) => normMarker(m).marker) }; }),
        menu: im.menu || [], ns: im.__ns || "" }));
      if (S.imarkers.length && !first("InteractiveMarkers")) applyDisplayMap({ InteractiveMarkers: true });
      refresh();
    },
    setSensors(s) { S.sensors = s || {}; refresh(); },
    // live data by topic (the practice terminal: Gazebo through ros_gz_bridge); one light pass per call
    update({ edges, joints, have, topicData, rosTime } = {}) {
      if (rosTime !== undefined) { if (rosTime !== null && S.rosTime0 === undefined) S.rosTime0 = rosTime; S.rosTime = rosTime; }
      if (edges) S.extraEdges = edges;
      if (joints) S.joints = { ...S.joints, ...joints };
      if (have !== undefined) S.haveStates = have;
      if (topicData) S.td = topicData;
      computeFrames(); placeRobot(); buildTF(); buildMarkers(); buildSensors();
      const now = performance.now(); if (now - (S.treeAt || 0) > 400) { S.treeAt = now; renderTree(); }
      draw();
    },
    setTitle(t) { S.title = t || ""; renderTitle(); },
    state: () => ({ fixedFrame: S.fixedFrame, displays: asMap(), displayList: S.displays.map((d) => ({ type: d.type, name: d.name, enabled: d.enabled, props: { ...d.props } })), joints: { ...S.joints }, status: lastStatus.map((x) => x.join(": ")), frames: Object.keys(poses), tool: S.tool, view: { ...S.view } }),
    fitView, setTool,
    // used by automated tests: the same feedback a real drag or menu click would send
    testFeedback(name, event, xyz, extra = {}) { const o = imG.children.flatMap((hh) => hh.children).find((c) => c.userData.im && c.userData.im.name === name); if (!o) return false; if (xyz) o.position.set(...xyz); feedback(o.userData.im, o, event, extra); return true; },
    testPublishGoal(x, y, yaw) { publish("/goal_pose", "geometry_msgs/msg/PoseStamped", { header: { stamp: stamp(), frame_id: S.fixedFrame }, pose: { position: { x, y, z: 0 }, orientation: yawQuat(yaw) } }); },
    destroy() {
      dead = true; clearInterval(timer); clearInterval(ticker); clearTimeout(fitTimer); document.removeEventListener("pointerdown", outside, true);
      for (const k of docks.values()) if (k.r) { k.r.dispose(); if (k.r.forceContextLoss) k.r.forceContextLoss(); }
      docks.clear();
      if (ro) ro.disconnect(); if (ro2) ro2.disconnect(); if (io) io.disconnect();
      if (renderer) { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); }
      if (typeof window !== "undefined" && window.__rvizViewers) window.__rvizViewers = window.__rvizViewers.filter((x) => x !== api);
      container.replaceChildren();
    },
    root,
  };
  if (document.fonts && document.fonts.load) document.fonts.load('64px "Liberation Sans"').then(() => { if (dead) return; labelCache.clear(); refresh(true); }).catch(() => {});
  renderTitle(); renderToolbar(); setTool("interact"); layout(); refresh(); applyView();
  if (typeof window !== "undefined") (window.__rvizViewers = window.__rvizViewers || []).push(api);
  return api;
}
export { quatToRPY, movableJoints };
