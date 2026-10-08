// RViz's MotionPlanning display and panel (moveit_ros_visualization / moveit_rviz_plugin), for the practice RViz:
//   - the scene robot (current state from /joint_states), the planning scene objects (green), the goal state (orange)
//     with a 6-DOF interactive marker at the group's tip: dragging it runs IK, like MoveIt's robot interaction
//   - the planned path (purple, animated; Loop Animation and Show Trail)
//   - the panel: Context (planning pipeline + planner), Planning (Plan, Execute, Plan & Execute, Stop, Clear; start and
//     goal state; planning time, attempts, velocity and acceleration scaling), Joints, Scene Objects, Status
// It talks to the practice move_group (ros-moveit.js), which plans with OMPL, Pilz, CHOMP or STOMP (moveit-core.js)
// and executes through the ros2_control trajectory controller (mock hardware or Gazebo).
import * as THREE from "../vendor/three/three.module.js";
import { fromQuat, poseOf, sampleTrajectory } from "./moveit-core.js";

const h = (tag, a = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(a)) { if (v === null || v === undefined || v === false) continue; if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "class") e.className = v; else e.setAttribute(k, v === true ? "" : v); } for (const c of kids.flat()) if (c != null) e.append(c); return e; };
const rgb = (s) => String(s || "").split(/[;,]\s*/).map((x) => Math.max(0, Math.min(255, Number(x) || 0)) / 255);
const fmt = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "-");
const AX = { x: [0.7071068, 0, 0, 0.7071068], y: [0, 0, 0.7071068, 0.7071068], z: [0, 0.7071068, 0, 0.7071068] };

export function attachMotionPlanning(viewer, mg, { onClose } = {}) {
  const groups = mg.groupNames();
  const disp = () => viewer.displays("MotionPlanning").find((d) => d.enabled) || null;
  const prop = (k, def) => { const d = disp(); return d && d.props[k] !== undefined ? d.props[k] : def; };
  const pipelines = mg.pipelines();
  const S = {
    group: (() => { const want = prop("Planning Group", ""); return groups.includes(want) ? want : groups.find((g) => mg.srdf.groups[g].chain) || groups[0]; })(),
    pipeline: pipelines[0] ? pipelines[0].id : "ompl", planner: {}, time: Number(prop("MoveIt_Planning_Time", 5)) || 5, attempts: 10, vel: 0.1, acc: 0.1,
    goal: null, start: null, result: null, anim: 0, status: "", colliding: null, ikFail: false, trailOn: false,
  };
  for (const p of pipelines) S.planner[p.id] = p.def;
  const G = () => mg.group(S.group);
  const current = () => mg.current();
  S.goal = { ...current() };
  // ---------------- 3D: scene robot, goal ghost, planned path, scene objects ----------------
  const sceneRobot = viewer.ghost({ own: true }), goalGhost = viewer.ghost(), startGhost = viewer.ghost(), pathGhost = viewer.ghost();
  const trail = []; const objG = new THREE.Group();
  const ext = { group: objG, update: () => paint3d(), imarkers: () => markers() };
  let objVersion = -1;
  function paintObjects() {
    const show = prop("Show Scene Geometry", true);
    objG.visible = !!show;
    if (objVersion === mg.sceneVersion && objG.children.length === mg.objects.length) { placeObjects(); return; }
    objVersion = mg.sceneVersion;
    for (const c of objG.children) { c.geometry && c.geometry.dispose(); }
    objG.clear();
    const col = rgb(prop("Scene Color", "50; 230; 50")), alpha = Number(prop("Scene Alpha", 0.9));
    for (const o of mg.objects) {
      let geo;
      if (o.type === "box") geo = new THREE.BoxGeometry(o.dims[0], o.dims[1], o.dims[2]);
      else if (o.type === "cylinder") { geo = new THREE.CylinderGeometry(o.dims[1], o.dims[1], o.dims[0], 32); geo.rotateX(Math.PI / 2); }
      else geo = new THREE.SphereGeometry(o.dims[0], 24, 16);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(col[0], col[1], col[2]), transparent: alpha < 1, opacity: alpha }));
      m.userData.obj = o; objG.add(m);
    }
    placeObjects();
  }
  function placeObjects() {
    const F = viewer.poseOf(mg.model.root); if (!F) { objG.visible = false; return; }
    const B = new THREE.Matrix4().compose(new THREE.Vector3(...F.t), new THREE.Quaternion(...F.q), new THREE.Vector3(1, 1, 1));
    for (const m of objG.children) { const T = m.userData.obj.pose; const M = new THREE.Matrix4().set(T[0], T[1], T[2], T[3], T[4], T[5], T[6], T[7], T[8], T[9], T[10], T[11], 0, 0, 0, 1); m.matrixAutoUpdate = false; m.matrix.copy(B).multiply(M); }
  }
  function paint3d() {
    if (!disp()) { for (const g of [sceneRobot, goalGhost, startGhost, pathGhost]) g.hide(); objG.visible = false; trail.forEach((t) => t.hide()); return; }
    const cur = current();
    sceneRobot.set(cur, { visible: prop("Show Robot Visual", true), alpha: Number(prop("Robot Alpha", 1)) });
    const gcol = rgb(prop("Goal State Color", "250; 128; 0")), bad = rgb(prop("Colliding Link Color", "255; 0; 0"));
    const linkColors = S.colliding ? Object.fromEntries(S.colliding.map((l) => [l, bad])) : null;
    goalGhost.set({ ...cur, ...S.goal }, { visible: prop("Query Goal State", true), color: gcol, alpha: Math.min(0.85, Number(prop("Goal State Alpha", 1))), linkColors });
    startGhost.set({ ...cur, ...(S.start || {}) }, { visible: !!prop("Query Start State", false) && !!S.start, color: rgb(prop("Start State Color", "0; 255; 0")), alpha: 0.6 });
    // planned path: animate the trajectory (State Display Time "3x" = 3 times faster than real time... MoveIt's "REALTIME" scaled)
    const r = S.result;
    if (r && r.ok && S.animating) {
      const pts = r.trajectory.points, T = pts[pts.length - 1].t, speed = /x$/.test(String(prop("State Display Time", "3x"))) ? Number(String(prop("State Display Time", "3x")).replace("x", "")) || 1 : 1;
      let t = ((performance.now() - S.anim) / 1000) * speed;
      if (t > T) { if (prop("Loop Animation", false)) { S.anim = performance.now(); t = 0; } else { t = T; S.animating = false; } }
      const q = sampleTrajectory(pts, t);
      pathGhost.set(G().values(q, cur), { color: [150 / 255, 50 / 255, 150 / 255], alpha: 0.5 });
    } else if (r && r.ok) { pathGhost.set(G().values(r.trajectory.points[r.trajectory.points.length - 1].positions, cur), { color: [150 / 255, 50 / 255, 150 / 255], alpha: 0.35, visible: !S.executed }); }
    else pathGhost.hide();
    // Show Trail: a robot every few states of the plan
    const want = r && r.ok && prop("Show Trail", false) ? Math.min(12, r.trajectory.points.length) : 0;
    while (trail.length < want) trail.push(viewer.ghost());
    trail.forEach((tg, i) => { if (i >= want) { tg.hide(); return; } const pts = r.trajectory.points, k = Math.round((i / Math.max(1, want - 1)) * (pts.length - 1)); tg.set(G().values(pts[k].positions, cur), { color: [150 / 255, 50 / 255, 150 / 255], alpha: 0.15 }); });
    paintObjects();
    viewer.setDisplayStatus("MotionPlanning", [mg.ready ? ["ok", "Planning Scene: OK", "Planning Scene"] : ["warn", mg.status || "Waiting for move_group ...", "Planning Scene"], ["ok", `Robot State: ${mg.model.name}`, "Robot State"], ...(S.ikFail ? [["warn", "No IK solution for the marker pose: the goal state was not changed", "Interactive Marker"]] : [])]);
  }
  // ---------------- interactive marker at the tip of the planning group (goal state) ----------------
  let im = null, imKey = "";
  function markers() {
    const g = G();
    if (!disp() || !prop("Query Goal State", true) || !g || !g.tip) return [];
    const T = mg.tipPose(S.group, S.goal); if (!T) return [];
    const P = poseOf(T), size = Number(prop("Interactive Marker Size", 0)) || Math.max(0.08, 0.22 * (mg.reach || 0.8));
    const key = `${S.group}|${P.t.map((x) => x.toFixed(4))}|${P.q.map((x) => x.toFixed(4))}|${size}`;
    if (im && key === imKey) return [im];
    imKey = key;
    const ctl = (mode, ax) => ({ mode, q: AX[ax], markers: [] });
    im = { name: `EE:goal_${g.tip}`, description: "", frame: mg.model.root, scale: size, p: P.t, q: P.q, own: true, menu: [],
      controls: g.positionOnly ? [ctl("MOVE_AXIS", "x"), ctl("MOVE_AXIS", "y"), ctl("MOVE_AXIS", "z")] : [ctl("MOVE_AXIS", "x"), ctl("ROTATE_AXIS", "x"), ctl("MOVE_AXIS", "y"), ctl("ROTATE_AXIS", "y"), ctl("MOVE_AXIS", "z"), ctl("ROTATE_AXIS", "z")],
      onFeedback: (fb) => onMarker(fb) };
    return [im];
  }
  let lastIK = 0;
  function onMarker(fb) {
    if (fb.event !== "POSE_UPDATE" && fb.event !== "MOUSE_UP") return;
    const now = performance.now(); if (fb.event === "POSE_UPDATE" && now - lastIK < 40) return; lastIK = now;
    const T = fromQuat(fb.p, fb.q);
    const q = mg.ik(S.group, T, S.goal);
    if (q) { S.goal = { ...S.goal, ...G().values(q) }; S.ikFail = false; checkGoal(); }
    else S.ikFail = true;
    if (fb.event === "MOUSE_UP") { im = null; viewer.rebuildIMarkers(); }
    paint3d(); viewer.draw(); paintJoints();
  }
  function checkGoal() { const c = mg.stateValid({ ...current(), ...S.goal }); S.colliding = c ? [c.a, c.typeB === "Robot link" ? c.b : null].filter(Boolean) : null; }
  // ---------------- the panel ----------------
  const tabs = ["Context", "Planning", "Joints", "Scene Objects", "Stored Scenes", "Stored States", "Status", "Manipulation"];
  const tabBar = h("div", { class: "mp-tabs", role: "tablist" });
  const pages = {};
  const pane = h("div", { class: "mp-pages" });
  let shown = "Planning";
  for (const t of tabs) { pages[t] = h("div", { class: "mp-page", role: "tabpanel", "data-tab": t }); pane.append(pages[t]); }
  function showTab(t) { shown = t; for (const b of tabBar.children) b.classList.toggle("on", b.dataset.tab === t); for (const [k, p] of Object.entries(pages)) p.hidden = k !== t; if (t === "Joints") paintJoints(); if (t === "Scene Objects") paintScene(); if (t === "Status") paintStatus(); }
  for (const t of tabs) tabBar.append(h("button", { type: "button", class: "mp-tab", "data-tab": t, role: "tab", text: t, onclick: () => showTab(t) }));
  const combo = (opts, val, onch, label) => { const c = h("select", { class: "q-combo", "aria-label": label || "" }); for (const o of opts) c.append(new Option(o, o)); c.value = val; c.addEventListener("change", () => onch(c.value)); return c; };
  const spin = (val, step, min, max, onch, label) => { const i = h("input", { class: "q-line mp-spin", type: "number", step: String(step), min: String(min), max: String(max), value: String(val), "aria-label": label }); i.addEventListener("change", () => { const v = Math.min(max, Math.max(min, Number(i.value) || min)); i.value = String(v); onch(v); }); return i; };
  const group = (title, ...kids) => h("fieldset", { class: "mp-group" }, h("legend", { text: title }), ...kids);
  // Context
  const pipeCombo = combo(pipelines.map((p) => p.id), S.pipeline, (v) => { S.pipeline = v; fillPlanners(); }, "Planning pipeline");
  const plannerCombo = h("select", { class: "q-combo", "aria-label": "Planner" });
  plannerCombo.addEventListener("change", () => { S.planner[S.pipeline] = plannerCombo.value; });
  function fillPlanners() { const p = pipelines.find((x) => x.id === S.pipeline); plannerCombo.replaceChildren(...(p ? p.planners : []).map((x) => new Option(x === p.def && S.pipeline === "ompl" ? `${x}` : x, x))); plannerCombo.value = S.planner[S.pipeline]; pipeCombo.value = S.pipeline; ctxNote.textContent = NOTES[S.pipeline] || ""; }
  const NOTES = { ompl: "OMPL: sampling-based planners (RRTConnect by default). They search for a collision-free path around obstacles; the path is then shortened and smoothed.",
    pilz_industrial_motion_planner: "Pilz: PTP (joint space), LIN (straight line of the tool), CIRC (arc, needs an interim or center point). Deterministic, with trapezoidal speed profiles; it does NOT avoid obstacles: a motion that would collide is rejected.",
    chomp: "CHOMP: optimizes a smooth trajectory away from obstacles by gradient descent (initialized from a straight line in joint space).",
    stomp: "STOMP: optimizes the trajectory with noisy rollouts (no gradients needed); good for smooth paths near obstacles." };
  const ctxNote = h("p", { class: "mp-note" });
  pages.Context.append(group("Planning Library", h("div", { class: "mp-row" }, pipeCombo), h("div", { class: "mp-row" }, h("label", { text: "Planner: " }), plannerCombo), ctxNote),
    group("Warehouse", h("div", { class: "mp-row" }, h("label", { text: "Host: " }), h("input", { class: "q-line", value: "127.0.0.1", "aria-label": "Warehouse host" }), h("label", { text: " Port: " }), h("input", { class: "q-line mp-spin", value: "33829", "aria-label": "Warehouse port" }), h("button", { type: "button", class: "q-btn", text: "Connect", onclick: () => say("Warehouse: no database is running (ros2 launch ... warehouse_db.launch.py). Stored scenes and states need it.") }))),
    group("Kinematics", h("label", { class: "mp-cb" }, h("input", { type: "checkbox", checked: true, "aria-label": "Use Collision-Aware IK" }), " Use Collision-Aware IK"), h("label", { class: "mp-cb" }, h("input", { type: "checkbox", "aria-label": "Allow Approximate IK Solutions" }), " Allow Approximate IK Solutions")));
  fillPlanners();
  // Planning
  const statusLbl = h("div", { class: "mp-status", role: "status" });
  const say = (t, cls = "") => { S.status = t; statusLbl.textContent = t; statusLbl.className = `mp-status ${cls}`; };
  const named = () => Object.keys(mg.namedStates(S.group));
  const startCombo = combo(["<current>", "<random valid>", "<random>", ...named()], "<current>", (v) => setState("start", v), "Start State");
  const goalCombo = combo(["<current>", "<random valid>", "<random>", "<same as start>", ...named()], "<current>", (v) => setState("goal", v), "Goal State");
  const groupCombo = combo(groups, S.group, (v) => { S.group = v; S.goal = { ...current(), ...S.goal }; im = null; refillStates(); viewer.rebuildIMarkers(); paint3d(); viewer.draw(); paintJoints(); }, "Planning Group");
  function refillStates() { startCombo.replaceChildren(...["<current>", "<random valid>", "<random>", ...named()].map((x) => new Option(x, x))); goalCombo.replaceChildren(...["<current>", "<random valid>", "<random>", "<same as start>", ...named()].map((x) => new Option(x, x))); }
  function randomValid() { const g = G(); for (let i = 0; i < 200; i++) { const q = g.random(); const v = g.values(q, current()); if (!mg.stateValid(v)) return g.values(q); } return null; }
  function setState(which, v) {
    const g = G(); let vals = null;
    if (v === "<current>") vals = Object.fromEntries(g.joints.map((j) => [j, current()[j] ?? 0]));
    else if (v === "<random valid>") { vals = randomValid(); if (!vals) say("Could not find a valid random state", "err"); }
    else if (v === "<random>") vals = g.values(g.random());
    else if (v === "<same as start>") vals = { ...(S.start || current()) };
    else vals = { ...mg.namedStates(S.group)[v] };
    if (!vals) return;
    if (which === "goal") { S.goal = { ...S.goal, ...vals }; checkGoal(); im = null; viewer.rebuildIMarkers(); }
    else S.start = v === "<current>" ? null : { ...current(), ...vals };
    paint3d(); viewer.draw(); paintJoints();
  }
  const btn = (t, fn) => h("button", { type: "button", class: "q-btn mp-cmd", text: t, onclick: fn });
  const bPlan = btn("Plan", () => doPlan(false)), bExec = btn("Execute", () => doExecute()), bPE = btn("Plan & Execute", () => doPlan(true)), bStop = btn("Stop", () => { mg.stop(); say("Execution stopped"); }), bClear = btn("Clear", () => { S.result = null; S.animating = false; paint3d(); viewer.draw(); say(""); });
  bExec.disabled = true;
  pages.Planning.append(h("div", { class: "mp-cols" },
    group("Commands", bPlan, bExec, bPE, bStop, bClear),
    group("Query", h("div", { class: "mp-row" }, h("label", { text: "Planning Group:" })), groupCombo, h("div", { class: "mp-row" }, h("label", { text: "Start State:" })), startCombo, h("div", { class: "mp-row" }, h("label", { text: "Goal State:" })), goalCombo),
    group("Options", h("div", { class: "mp-grid" },
      h("label", { text: "Planning Time (s):" }), spin(S.time, 0.5, 0.5, 60, (v) => { S.time = v; }, "Planning Time"),
      h("label", { text: "Planning Attempts:" }), spin(S.attempts, 1, 1, 100, (v) => { S.attempts = v; }, "Planning Attempts"),
      h("label", { text: "Velocity Scaling:" }), spin(S.vel, 0.05, 0.01, 1, (v) => { S.vel = v; }, "Velocity Scaling"),
      h("label", { text: "Accel. Scaling:" }), spin(S.acc, 0.05, 0.01, 1, (v) => { S.acc = v; }, "Acceleration Scaling")),
      h("label", { class: "mp-cb" }, h("input", { type: "checkbox", "aria-label": "Use Cartesian Path" }), " Use Cartesian Path"),
      h("label", { class: "mp-cb" }, h("input", { type: "checkbox", checked: true, "aria-label": "Collision-aware IK" }), " Collision-aware IK"),
      h("label", { class: "mp-cb" }, h("input", { type: "checkbox", "aria-label": "Replanning" }), " Replanning"))),
    h("div", { class: "mp-row" }, h("label", { text: "Path Constraints: " }), combo(["None"], "None", () => {}, "Path Constraints")), statusLbl);
  // Joints: the goal state's joint values of the group
  const jointsBox = h("div", { class: "mp-joints" });
  pages.Joints.append(h("p", { class: "mp-note", text: "The goal state of the planning group. Moving a slider moves the orange goal robot (Query Goal State)." }), jointsBox);
  function paintJoints() {
    if (shown !== "Joints") return;
    const g = G(); if (!g) return;
    jointsBox.replaceChildren(...g.joints.map((j, i) => {
      const v = S.goal[j] ?? 0, r = h("input", { type: "range", min: String(g.lower[i]), max: String(g.upper[i]), step: "0.001", value: String(v), "aria-label": j });
      const out = h("span", { class: "mp-val", text: fmt(v) });
      r.addEventListener("input", () => { S.goal = { ...S.goal, [j]: Number(r.value) }; out.textContent = fmt(Number(r.value)); checkGoal(); im = null; viewer.rebuildIMarkers(); paint3d(); viewer.draw(); });
      return h("div", { class: "mp-jrow" }, h("label", { text: j }), r, out);
    }));
  }
  // Scene Objects
  const sceneList = h("ul", { class: "mp-scene" });
  const shapeCombo = combo(["Box", "Sphere", "Cylinder"], "Box", () => {}, "Shape");
  const sizeIn = h("input", { class: "q-line mp-spin", type: "number", step: "0.01", value: "0.1", "aria-label": "Size" });
  const posIn = ["x", "y", "z"].map((a, i) => h("input", { class: "q-line mp-spin", type: "number", step: "0.05", value: String([0.4, 0.2, 0.3][i] * (mg.reach || 1)), "aria-label": `Position ${a}` }));
  let addN = 0;
  pages["Scene Objects"].append(h("p", { class: "mp-note", text: "World objects in the planning scene (moveit_msgs/CollisionObject). The planners avoid them. Add your own, or run scripts/add_scene_objects.py." }), sceneList,
    group("Add a primitive", h("div", { class: "mp-row" }, shapeCombo, h("label", { text: " size " }), sizeIn), h("div", { class: "mp-row" }, h("label", { text: "x y z " }), ...posIn),
      h("button", { type: "button", class: "q-btn", text: "Add", onclick: () => { const sz = Number(sizeIn.value) || 0.1, xyz = posIn.map((i) => Number(i.value) || 0), t = shapeCombo.value.toLowerCase(); mg.addObject({ id: `${t}_${++addN}`, type: t, dims: t === "box" ? [sz, sz, sz] : t === "cylinder" ? [sz * 2, sz / 2] : [sz / 2], pose: [1, 0, 0, xyz[0], 0, 1, 0, xyz[1], 0, 0, 1, xyz[2]] }); paintScene(); paint3d(); viewer.draw(); } })));
  function paintScene() {
    if (shown !== "Scene Objects") return;
    sceneList.replaceChildren(...(mg.objects.length ? mg.objects.map((o) => h("li", {}, h("span", { text: `${o.id} (${o.type} ${o.dims.map((d) => fmt(d, 2)).join(" × ")}) at ${[o.pose[3], o.pose[7], o.pose[11]].map((x) => fmt(x, 2)).join(", ")}` }), h("button", { type: "button", class: "q-btn", text: "Remove", onclick: () => { mg.removeObject(o.id); paintScene(); paint3d(); viewer.draw(); } }))) : [h("li", { class: "mp-note", text: "(the planning scene is empty)" })]));
  }
  pages["Stored Scenes"].append(h("p", { class: "mp-note", text: "Not connected to a database. Connect to a warehouse (Context tab) to store and load scenes." }));
  pages["Stored States"].append(h("p", { class: "mp-note", text: "Not connected to a database. Connect to a warehouse (Context tab) to store and load robot states." }));
  pages.Manipulation.append(h("p", { class: "mp-note", text: "Object detection and grasping need a perception pipeline (not part of this setup)." }));
  const logBox = h("pre", { class: "mp-log" });
  pages.Status.append(logBox);
  const logs = [];
  function paintStatus() { if (shown === "Status") logBox.textContent = logs.slice(-200).join("\n"); }
  const off = mg.on((ev) => {
    if (ev.type === "log") { logs.push(`[${ev.level}] ${ev.text}`); paintStatus(); }
    if (ev.type === "ready") { checkGoal(); say("move_group is ready: drag the orange marker, then Plan."); paint3d(); viewer.draw(); }
    if (ev.type === "scene") { checkGoal(); paintScene(); paint3d(); viewer.draw(); }
    if (ev.type === "executed") { say(ev.ok ? `Execution completed: SUCCEEDED` : ev.preempted ? "Execution: PREEMPTED" : "Execution failed", ev.ok ? "ok" : "err"); S.executed = ev.ok; bExec.disabled = true; startCombo.value = "<current>"; paint3d(); viewer.draw(); }
  });
  function doPlan(andExecute) {
    const g = G(); if (!g) return;
    say("Planning request sent ...");
    setTimeout(() => {   // let the label paint first: planning can take a moment
      const goal = Object.fromEntries(g.joints.map((j) => [j, S.goal[j] ?? current()[j] ?? 0]));
      const r = mg.plan({ group: S.group, startValues: S.start || null, goal, pipeline: S.pipeline, planner_id: S.planner[S.pipeline] === "CHOMP" || S.planner[S.pipeline] === "STOMP" ? "" : S.planner[S.pipeline], time: S.time, attempts: S.attempts, vel: S.vel, acc: S.acc });
      S.result = r; S.executed = false;
      if (r.ok) { S.animating = true; S.anim = performance.now(); bExec.disabled = !!S.start; say(`Plan: Success (${S.pipeline}${r.planner ? ` / ${r.planner}` : ""}). Planning time ${fmt(r.planning_time)} s, motion ${fmt(r.duration, 2)} s${S.start ? " (start state is not the current state: Execute is disabled)" : ""}`, "ok"); }
      else { S.animating = false; bExec.disabled = true; say(`Plan: FAILED: ${r.error} — ${r.message}`, "err"); }
      paint3d(); viewer.draw();
      if (andExecute && r.ok && !S.start) doExecute();
    }, 20);
  }
  function doExecute() {
    const r = S.result; if (!r || !r.ok) return;
    const e = mg.execute(r);
    if (e.ok) { say(`Executing on ${e.controller} ...`); bExec.disabled = true; S.animating = false; }
    else say(`Execution failed: ${e.message}`, "err");
    paint3d(); viewer.draw();
  }
  const body = h("div", { class: "mp-panel" }, tabBar, pane);
  const removeDock = viewer.addDock("MotionPlanning", body);
  const removeExt = viewer.addExtension(ext);
  showTab("Planning");
  if (!mg.ready) say(mg.status || "Waiting for move_group ...");
  let raf = 0;
  const loop = () => { raf = requestAnimationFrame(loop); if (S.animating) { paint3d(); viewer.draw(); } };
  loop();
  return {
    tick() { paint3d(); },
    destroy() { cancelAnimationFrame(raf); off(); removeExt(); removeDock(); for (const g of [sceneRobot, goalGhost, startGhost, pathGhost, ...trail]) g.dispose(); if (onClose) onClose(); },
    // used by automated tests
    test: { S, setGoalPose: (t, q) => onMarker({ event: "MOUSE_UP", p: t, q }), setState, plan: () => doPlan(false), execute: () => doExecute(), planExecute: () => doPlan(true), select: (pipe, planner) => { S.pipeline = pipe; if (planner) S.planner[pipe] = planner; fillPlanners(); }, status: () => S.status },
  };
}
