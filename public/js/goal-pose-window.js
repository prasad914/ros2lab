// "Goal Pose" window: the goal_pose_gui node (ros2 run goal_pose_gui goal_pose_gui), a separate Qt-style window like
// joint_state_publisher_gui. It types goals for whatever robot runs:
//   arms     tool pose (x, y, z, roll, pitch, yaw) or joint values -> MoveIt move_group (pipeline, planner, Cartesian)
//            or, without MoveIt, joint values -> the joint_trajectory_controller
//   bases    goal x, y, yaw -> /navigate_to_pose (pose_follower or Nav2); velocity sliders -> cmd_vel
//   drones   goal x, y, z, yaw; Take off / Land; velocity sliders with z
//   legged   goal x, y, yaw (the body moves through the VelocityControl system); velocity sliders
import { loadRvizCss } from "./rviz.js";
import { fromRPY, toQuat } from "./moveit-core.js";
import { quatOfRPY, rpyOfQuat } from "./goal-pose.js";

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const fix = (x, n = 3) => (Number.isFinite(x) ? x.toFixed(n) : "-");

export function createGoalWindow(host, { graph, log = () => {}, title = "Goal Pose" } = {}) {
  loadRvizCss();
  const g = graph;
  const status = h("div", { class: "gp-status", role: "status", "aria-live": "polite" });
  const say = (t, cls = "") => { status.textContent = t; status.className = `gp-status ${cls}`; };
  const titleEl = h("span", { class: "rv-wtitle", text: title });
  const wb = (cls, label, fn) => h("button", { type: "button", class: `rv-wb ${cls}`, title: label, "aria-label": label, onclick: fn });
  const bar = h("div", { class: "rv-titlebar" }, h("span", { class: "rv-tbspace" }), titleEl, h("span", { class: "rv-wbtns" }, wb("min", "Minimise", () => win.classList.toggle("min")), wb("close", "Minimise (stop the node with Ctrl+C in its terminal)", () => win.classList.toggle("min"))));
  const main = h("div", { class: "gp-main" });
  const win = h("div", { class: "jsp-win gp-win", role: "dialog", "aria-label": title }, bar, main);
  host.append(win);

  // drag by the title bar, like the joint_state_publisher_gui window
  let drag = null;
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const r = win.getBoundingClientRect(), hr = host.getBoundingClientRect();
    if (!win.classList.contains("floating")) { win.classList.add("floating"); win.style.left = `${r.left - hr.left}px`; win.style.top = `${r.top - hr.top}px`; }
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", (e) => { if (!drag) return; const hr = host.getBoundingClientRect(); win.style.left = `${Math.max(0, Math.min(hr.width - 120, e.clientX - hr.left - drag.dx))}px`; win.style.top = `${Math.max(0, e.clientY - hr.top - drag.dy)}px`; });
  bar.addEventListener("pointerup", () => { drag = null; });

  // ---------- small Qt-like widgets ----------
  const spin = (label, step, val = 0, unit = "") => {
    const inp = h("input", { class: "q-line gp-spin", type: "number", step: String(step), value: String(val), "aria-label": `${label}${unit ? ` (${unit})` : ""}` });
    inp.addEventListener("keydown", (e) => e.stopPropagation());
    return { inp, row: h("label", { class: "gp-row" }, h("span", { class: "gp-lbl", text: label }), inp, h("span", { class: "gp-unit", text: unit })), get value() { return Number(inp.value) || 0; }, set value(v) { inp.value = String(+Number(v).toFixed(4)); } };
  };
  const combo = (items, value, label) => { const s = h("select", { class: "q-combo gp-combo", "aria-label": label }); for (const it of items) s.append(new Option(it.label || it, it.value || it)); if (value) s.value = value; return s; };
  const btn = (text, fn, cls = "") => h("button", { type: "button", class: `q-btn ${cls}`, text, onclick: fn });
  const check = (label, on = false) => { const c = h("input", { type: "checkbox", class: "q-check" }); c.checked = on; return { c, row: h("label", { class: "gp-row gp-chk" }, c, label) }; };
  const tabs = (names) => {
    const bar2 = h("div", { class: "q-tabs gp-tabs", role: "tablist" }), pages = {}, btns = {};
    for (const n of names) { pages[n] = h("div", { class: "gp-page", role: "tabpanel", hidden: true }); btns[n] = h("button", { type: "button", role: "tab", class: "q-tab", text: n, onclick: () => show(n) }); bar2.append(btns[n]); }
    const show = (n) => { for (const k of names) { pages[k].hidden = k !== n; btns[k].classList.toggle("on", k === n); btns[k].setAttribute("aria-selected", String(k === n)); } };
    show(names[0]);
    return { bar: bar2, pages, show };
  };

  let mode = null, built = null, velTimer = null;
  const vel = { vx: 0, vy: 0, vz: 0, wz: 0 };

  function robot() { return g.goalRobot(); }
  function build() {
    const r = robot(), key = `${r.kind}|${r.via}|${r.controller || ""}|${g.mg ? g.mg.node : ""}`;
    if (key === mode) return;
    mode = key; stopVel();
    main.replaceChildren();
    if (!r.kind) { main.append(h("p", { class: "gp-wait", text: "Waiting for a robot: start a MoveIt demo.launch.py, or a Gazebo simulation (gazebo.launch.py)." }), status); built = null; return; }
    built = r.kind === "arm" ? (g.mg && g.node(g.mg.node) ? buildMoveit() : buildJoints(r)) : buildBase(r);
    main.append(status);
  }

  // ---------- arms with MoveIt ----------
  function buildMoveit() {
    const mg = g.mg, groups = mg.groupNames().filter((n) => mg.group(n));
    const arm = groups.find((n) => mg.group(n).tip) || groups[0];
    const T = tabs(["Pose", "Joints", "Options"]);
    const groupSel = combo(groups, arm, "Planning group");
    const pipes = mg.pipelines(), pipeSel = combo(pipes.map((p) => p.id), pipes[0] && pipes[0].id, "Planning pipeline");
    const planSel = h("select", { class: "q-combo gp-combo", "aria-label": "Planner" });
    const fillPlanners = () => { const p = pipes.find((x) => x.id === pipeSel.value); planSel.replaceChildren(...(p ? p.planners : []).map((x) => new Option(x.replace(/kConfigDefault$/, ""), x))); if (p) planSel.value = p.def; };
    pipeSel.addEventListener("change", fillPlanners); fillPlanners();
    const velS = spin("Velocity scaling", 0.05, 0.5), accS = spin("Acceleration scaling", 0.05, 0.5), timeS = spin("Planning time", 0.5, 5, "s");
    const cart = check("Cartesian path (straight line)");
    T.pages.Options.append(h("div", { class: "gp-row" }, h("span", { class: "gp-lbl", text: "Group" }), groupSel), h("div", { class: "gp-row" }, h("span", { class: "gp-lbl", text: "Pipeline" }), pipeSel), h("div", { class: "gp-row" }, h("span", { class: "gp-lbl", text: "Planner" }), planSel), velS.row, accS.row, timeS.row, cart.row);
    // Pose tab: the tool's goal in the planning frame
    const P = { x: spin("x", 0.01, 0, "m"), y: spin("y", 0.01, 0, "m"), z: spin("z", 0.01, 0, "m"), roll: spin("roll", 5, 0, "deg"), pitch: spin("pitch", 5, 0, "deg"), yaw: spin("yaw", 5, 0, "deg") };
    const frameLbl = h("span", { class: "gp-note" });
    const fillCurrent = () => {
      const Tt = mg.tipPose(groupSel.value, {}); if (!Tt) { say("This group has no tool (tip link): use the Joints tab.", "err"); return; }
      const q = toQuat(Tt), [rr, pp, yy] = rpyOfQuat({ x: q[0], y: q[1], z: q[2], w: q[3] });
      P.x.value = Tt[3]; P.y.value = Tt[7]; P.z.value = Tt[11]; P.roll.value = rr * R2D; P.pitch.value = pp * R2D; P.yaw.value = yy * R2D;
    };
    const poseT = () => fromRPY([P.x.value, P.y.value, P.z.value], [P.roll.value * D2R, P.pitch.value * D2R, P.yaw.value * D2R]);
    let last = null;
    const req = () => ({ group: groupSel.value, pipeline: pipeSel.value, planner_id: /CHOMP|STOMP/.test(planSel.value) ? "" : planSel.value, cartesian: cart.c.checked, time: timeS.value || 5, attempts: 1, vel: velS.value || 0.1, acc: accS.value || 0.1 });
    const planPose = (exec) => {
      if (!mg.ready) { say("move_group is still loading the robot's collision model ...", "err"); return; }
      say("Planning ...");
      setTimeout(() => {
        const r = mg.planPose({ ...req(), T: poseT() }); last = r;
        if (r.ok) { say(`Plan: SUCCESS (${pipeSel.value}${r.planner ? ` / ${r.planner}` : ""}), ${fix(r.duration, 2)} s of motion.${exec ? " Executing ..." : " Press Execute."}`, "ok"); log(`[INFO] [goal_pose_gui]: Pose goal planned: [${fix(P.x.value)}, ${fix(P.y.value)}, ${fix(P.z.value)}] rpy [${fix(P.roll.value, 1)}, ${fix(P.pitch.value, 1)}, ${fix(P.yaw.value, 1)}] deg`); if (exec) execute(); }
        else { say(`Planning failed: ${r.error}. ${r.message || ""}`, "err"); log(`[ERROR] [goal_pose_gui]: Planning failed: ${r.error}`); }
      }, 20);
    };
    const execute = () => { if (!last || !last.ok) { say("Plan first.", "err"); return; } const e = mg.execute(last); say(e.ok ? `Executing on ${e.controller} ...` : `Execution failed: ${e.message}`, e.ok ? "" : "err"); last = null; };
    T.pages.Pose.append(h("p", { class: "gp-note", text: `Tool goal in the planning frame (${mg.model.root}).` }), P.x.row, P.y.row, P.z.row, P.roll.row, P.pitch.row, P.yaw.row, frameLbl,
      h("div", { class: "q-btnrow" }, btn("Use current", fillCurrent), btn("Plan", () => planPose(false))),
      h("div", { class: "q-btnrow" }, btn("Execute", execute), btn("Plan & Execute", () => planPose(true), "def")),
      h("div", { class: "q-btnrow" }, btn("Stop", () => { mg.stop(); say("Stopped."); })));
    // Joints tab: one slider per joint of the group, named states from the SRDF
    const jbox = h("div", { class: "gp-joints" });
    const named = h("select", { class: "q-combo gp-combo", "aria-label": "Named state" });
    let J = [];
    const fillJoints = () => {
      const G = mg.group(groupSel.value); J = []; jbox.replaceChildren(); if (!G) return;
      const cur = mg.current();
      G.joints.forEach((name, i) => {
        const lo = G.lower[i], hi = G.upper[i], unit = mg.model.joints[name] && mg.model.joints[name].type === "prismatic" ? "m" : "rad";
        const s = spin(name, unit === "m" ? 0.005 : 0.01, cur[name] || 0, unit);
        const rng = h("input", { type: "range", class: "gp-range", min: String(lo), max: String(hi), step: "0.001", value: String(cur[name] || 0), "aria-label": `${name} slider` });
        rng.addEventListener("input", () => { s.value = Number(rng.value); }); s.inp.addEventListener("change", () => { const v = Math.max(lo, Math.min(hi, s.value)); s.value = v; rng.value = String(v); });
        J.push({ name, s, rng }); jbox.append(h("div", { class: "gp-jw" }, s.row, rng));
      });
      named.replaceChildren(new Option("<current>", ""), ...Object.keys(mg.namedStates(groupSel.value)).map((n) => new Option(n, n)));
    };
    named.addEventListener("change", () => { const st = mg.namedStates(groupSel.value)[named.value]; if (st) for (const j of J) if (st[j.name] !== undefined) { j.s.value = st[j.name]; j.rng.value = String(st[j.name]); } });
    const planJoints = (exec) => {
      say("Planning ...");
      setTimeout(() => {
        const r = mg.plan({ ...req(), cartesian: false, goal: Object.fromEntries(J.map((j) => [j.name, j.s.value])) }); last = r;
        if (r.ok) { say(`Plan: SUCCESS, ${fix(r.duration, 2)} s of motion.${exec ? " Executing ..." : ""}`, "ok"); if (exec) execute(); } else say(`Planning failed: ${r.error}. ${r.message || ""}`, "err");
      }, 20);
    };
    T.pages.Joints.append(h("div", { class: "gp-row" }, h("span", { class: "gp-lbl", text: "Named state" }), named), jbox,
      h("div", { class: "q-btnrow" }, btn("Use current", fillJoints), btn("Plan", () => planJoints(false))), h("div", { class: "q-btnrow" }, btn("Plan & Execute", () => planJoints(true), "def")));
    groupSel.addEventListener("change", () => { fillJoints(); fillCurrent(); });
    main.append(T.bar, ...Object.values(T.pages));
    fillJoints(); fillCurrent();
    say(mg.ready ? "Type a goal, then Plan & Execute." : "move_group is loading ...");
    return { kind: "moveit", refresh: () => {} };
  }

  // ---------- arms without MoveIt: joint values straight to the joint_trajectory_controller ----------
  function buildJoints(r) {
    const model = g.robotModel(), names = (r.joints && r.joints.length ? r.joints : Object.values(model ? model.joints : {}).filter((j) => j.type !== "fixed" && !j.mimic).map((j) => j.name));
    const cur = g.jointValues(), J = [], box = h("div", { class: "gp-joints" });
    for (const name of names) {
      const jt = model && model.joints[name], lo = jt && jt.limit && jt.type !== "continuous" ? jt.limit.lower : -Math.PI, hi = jt && jt.limit && jt.type !== "continuous" ? jt.limit.upper : Math.PI;
      const s = spin(name, 0.01, cur[name] || 0, jt && jt.type === "prismatic" ? "m" : "rad");
      const rng = h("input", { type: "range", class: "gp-range", min: String(lo), max: String(hi), step: "0.001", value: String(cur[name] || 0), "aria-label": `${name} slider` });
      rng.addEventListener("input", () => { s.value = Number(rng.value); }); s.inp.addEventListener("change", () => { const v = Math.max(lo, Math.min(hi, s.value)); s.value = v; rng.value = String(v); });
      J.push({ name, s }); box.append(h("div", { class: "gp-jw" }, s.row, rng));
    }
    const dur = spin("Time", 0.5, 3, "s");
    const send = () => {
      const yaml = `{joint_names: [${J.map((j) => j.name).join(", ")}], points: [{positions: [${J.map((j) => j.s.value.toFixed(4)).join(", ")}], time_from_start: {sec: ${Math.floor(dur.value)}, nanosec: ${Math.round((dur.value % 1) * 1e9)}}}]}`;
      const out = g.topicPub([`/${r.controller}/joint_trajectory`, "trajectory_msgs/msg/JointTrajectory", yaml, "--once"]);
      const note = out.filter((l) => l.cls === "hint").map((l) => l.text).pop() || "";
      say(note.replace(/^\(|\)$/g, "") || "Sent.", /accepted|moves/.test(note) ? "ok" : "");
      log(`[INFO] [goal_pose_gui]: JointTrajectory sent to /${r.controller}/joint_trajectory`);
    };
    main.append(h("p", { class: "gp-note", text: `No MoveIt here: the joint values go to ${r.controller} (trajectory_msgs/JointTrajectory). For tool poses, start <robot>_moveit_config demo.launch.py or gazebo.launch.py.` }), box, dur.row, h("div", { class: "q-btnrow" }, btn("Send", send, "def")));
    return { kind: "joints" };
  }

  // ---------- mobile, legged and flying robots ----------
  function buildBase(r) {
    const fly = r.kind === "drone", holo = ["holonomic", "legged", "drone"].includes(r.kind);
    const T = tabs(["Goal", "Velocity"]);
    const G = { x: spin("x", 0.1, 0, "m"), y: spin("y", 0.1, 0, "m"), z: spin("z", 0.1, fly ? 1 : 0, "m"), yaw: spin("yaw", 5, 0, "deg") };
    const pos = h("p", { class: "gp-note gp-pose" });
    const go = () => {
      const res = g.goalStart({ x: G.x.value, y: G.y.value, z: fly ? G.z.value : 0, yaw: G.yaw.value * D2R, frame: "odom" }, "goal_pose_gui");
      if (res.ok) { say(`Goal sent to /navigate_to_pose: x=${fix(G.x.value, 2)}, y=${fix(G.y.value, 2)}${fly ? `, z=${fix(G.z.value, 2)}` : ""}, yaw=${fix(G.yaw.value, 0)} deg`, "ok"); log(`[INFO] [goal_pose_gui]: NavigateToPose goal sent (x=${G.x.value}, y=${G.y.value}, yaw=${G.yaw.value} deg)`); }
      else say(`${res.message}`, "err");
    };
    const here = () => { const o = g.goalOdom(robot()); if (o) { G.x.value = o.x; G.y.value = o.y; G.z.value = o.z; G.yaw.value = o.yaw * R2D; } };
    T.pages.Goal.append(h("p", { class: "gp-note", text: "Goal in the odom frame (where the robot started). Go sends it to /navigate_to_pose (nav2_msgs/action/NavigateToPose)." }), G.x.row, G.y.row, ...(fly ? [G.z.row] : []), G.yaw.row,
      h("div", { class: "q-btnrow" }, btn("Use current", here), btn("Go", go, "def")), h("div", { class: "q-btnrow" }, btn("Cancel goal", () => { if (g.goalCancel()) say("Goal canceled."); else say("No goal is running."); })),
      ...(fly ? [h("div", { class: "q-btnrow" }, btn("Take off", () => { here(); G.z.value = 1; go(); }), btn("Land", () => { here(); G.z.value = 0; go(); }))] : []), pos);
    // velocity sliders (rqt_robot_steering style): published at 10 Hz while "Publish" is on
    const lim = { lin: r.kind === "diff" ? 0.22 : 0.5, ang: 1.5 };
    const sl = (label, key, max) => {
      const val = h("span", { class: "gp-val", text: "0.00" });
      const rng = h("input", { type: "range", class: "gp-range", min: String(-max), max: String(max), step: "0.01", value: "0", "aria-label": label });
      rng.addEventListener("input", () => { vel[key] = Number(rng.value); val.textContent = vel[key].toFixed(2); });
      return { rng, val, row: h("div", { class: "gp-jw" }, h("div", { class: "gp-row" }, h("span", { class: "gp-lbl", text: label }), val), rng) };
    };
    const S = [sl("linear.x (m/s)", "vx", lim.lin), ...(holo ? [sl("linear.y (m/s)", "vy", lim.lin)] : []), ...(fly ? [sl("linear.z (m/s)", "vz", lim.lin)] : []), sl("angular.z (rad/s)", "wz", lim.ang)];
    const pub = check(`Publish on ${r.topic} (${r.stamped ? "TwistStamped" : "Twist"}, 10 Hz)`);
    pub.c.addEventListener("change", () => { if (pub.c.checked) startVel(); else stopVel(true); });
    T.pages.Velocity.append(...S.map((s) => s.row), pub.row, h("div", { class: "q-btnrow" }, btn("Stop (all zero)", () => { for (const s of S) { s.rng.value = "0"; s.val.textContent = "0.00"; } Object.assign(vel, { vx: 0, vy: 0, vz: 0, wz: 0 }); g.goalCommand(robot(), vel); say("Stopped: zero velocity published."); })));
    main.append(T.bar, ...Object.values(T.pages));
    say(g.followerNode() ? "pose_follower is running: type a goal and press Go." : "Go needs the follower: ros2 run goal_pose_gui pose_follower (or start Nav2). The Velocity tab works now.");
    return { kind: "base", refresh: () => { const o = g.goalOdom(robot()); pos.textContent = o ? `Robot (odom): x ${fix(o.x, 2)}  y ${fix(o.y, 2)}${fly ? `  z ${fix(o.z, 2)}` : ""}  yaw ${fix(o.yaw * R2D, 0)}°${g.follow ? `   goal: ${g.follow.status}` : ""}` : ""; } };
  }
  function startVel() { stopVel(); velTimer = setInterval(() => { const r = robot(); if (r.kind && r.kind !== "arm") g.goalCommand(r, vel); }, 100); say("Publishing the velocity at 10 Hz."); }
  function stopVel(zero) { if (velTimer) { clearInterval(velTimer); velTimer = null; } if (zero) { const r = robot(); if (r.kind && r.kind !== "arm") g.goalCommand(r, {}); say("Stopped publishing."); } }

  build();
  return {
    update() { build(); if (built && built.refresh) built.refresh(); },
    destroy() { stopVel(); win.remove(); },
    root: win,
  };
}
// a quaternion for a yaw (used by tests)
export const yawQuat = (yaw) => quatOfRPY(0, 0, yaw);
