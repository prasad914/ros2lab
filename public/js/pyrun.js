// Python playground: an editor + Run button. Code runs in py-worker.js.
import { el, rich } from "./dom.js";

let worker = null, nextId = 1;
const waiting = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./py-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => { const h = waiting.get(e.data.id); if (h) h(e.data); };
  worker.onerror = () => { for (const h of waiting.values()) h({ type: "error", text: "Python could not start. Check your internet connection and try again." }); };
  return worker;
}

// Plain-English help for the errors beginners meet most often.
const EXPLAIN = [
  [/IndentationError|TabError/, "Python expected the lines inside a def, if, for or class to be pushed right by 4 spaces (or they are pushed by a different amount)."],
  [/SyntaxError: expected ':'/, "A line that starts a block (def, if, else, for, class) must end with a colon :"],
  [/SyntaxError/, "Python could not read this line. Look for a missing colon :, bracket ( ), or quote mark near the line shown."],
  [/NameError: name '(\w+)' is not defined/, (m) => `Python does not know the name "${m[1]}". Check the spelling and capital letters, and make sure you created it before using it.`],
  [/AttributeError: '(\w+)' object has no attribute '(\w+)'/, (m) => `The ${m[1]} object has no "${m[2]}". Check the spelling. If it is your own attribute, create it in __init__ with self.${m[2]} = ...`],
  [/takes (\d+) positional arguments? but (\d+) (were|was) given/, "A method got one value more than it expects. In a class, every method needs self as its first parameter: def name(self, ...)."],
  [/missing (\d+) required positional argument/, "A function or method was called with too few values. Check the brackets when you call it."],
  [/ModuleNotFoundError/, "That module is not available here. This playground has Python's standard library plus a practice rclpy, std_msgs, geometry_msgs (Twist), example_interfaces and std_srvs."],
  [/ZeroDivisionError/, "The program tried to divide by zero."],
  [/EOFError/, "The program asked for more input() answers than this exercise provides. Remove the extra input() line."],
  [/ValueError: invalid literal for int\(\) with base 10: '([^']*)'/, (m) => `int() can only turn whole-number text into a number, but it got "${m[1]}". For decimals use float().`],
  [/ValueError: could not convert string to float: '([^']*)'/, (m) => `float() needs text that looks like a number, but it got "${m[1]}".`],
  [/RuntimeError: (.*)/, (m) => m[1]],
  [/TypeError: (.*)/, (m) => m[1]],
];
function explain(errText) {
  for (const [re, msg] of EXPLAIN) { const m = errText.match(re); if (m) return typeof msg === "function" ? msg(m) : msg; }
  return null;
}
const lastLine = (t) => t.trim().split("\n").filter((l) => l.trim()).pop() || t;
const normOut = (s) => s.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();

// Runs a program for the practice terminal (python3 FILE) and resolves with what it printed.
export function runPythonCode(code, { inputs = [], onStatus } = {}) {
  return new Promise((resolve) => {
    const id = nextId++; let text = "", err = "";
    const timer = setTimeout(() => { waiting.delete(id); if (worker) { worker.terminate(); worker = null; } resolve({ text, err: err + "\nKeyboardInterrupt (stopped after 10 seconds: is there a loop that never ends?)" }); }, 15000);
    waiting.set(id, (m) => {
      if (m.type === "status") { onStatus && onStatus(m.text || ""); return; }
      if (m.type === "out") { text += m.text; return; }
      if (m.type === "err") { err += m.text; return; }
      clearTimeout(timer); waiting.delete(id);
      if (m.type === "error") err += m.text;
      resolve({ text, err });
    });
    getWorker().postMessage({ id, code, inputs, params: {}, simSeconds: 3 });
  });
}

export function mountPython(container, spec, { onComplete } = {}) {
  const ta = el("textarea", { spellcheck: "false", autocapitalize: "off", "aria-label": "Python code editor" });
  ta.value = spec.code || "";
  ta.rows = Math.min(40, Math.max(6, (spec.code || "").split("\n").length + 1));
  const out = el("div", { class: "py-out", role: "log", "aria-live": "polite" }, el("span", { class: "info", text: "Press Run to see the output here." }));
  const help = el("div", { class: "py-help", hidden: true });
  const viz = el("div", { class: "py-viz" });
  const viz3 = el("div", { class: "py-viz3", hidden: true });
  let viewer3 = null, pyTopics = [];
  // the graph RViz sees while the program runs: its publishers, plus RViz's own tool topics and the usual two
  const robotTopics = spec.robot ? [["/robot_description", "std_msgs/msg/String"], ["/tf", "tf2_msgs/msg/TFMessage"], ["/tf_static", "tf2_msgs/msg/TFMessage"]] : [];   // robot_state_publisher of the lesson's robot
  const graphTopics = () => [...pyTopics, ...robotTopics, ["/clicked_point", "geometry_msgs/msg/PointStamped"], ["/goal_pose", "geometry_msgs/msg/PoseStamped"], ["/initialpose", "geometry_msgs/msg/PoseWithCovarianceStamped"],
    ["/parameter_events", "rcl_interfaces/msg/ParameterEvent"], ["/rosout", "rcl_interfaces/msg/Log"]].map(([name, type]) => ({ name, type, pubs: 1 }));
  // 3D: markers and interactive markers from the program, shown in the practice RViz
  // the lesson's saved RViz setup: the displays this kind of program needs (a Marker / MarkerArray / InteractiveMarkers display)
  const presetDisplays = (d) => {
    const types = Object.values(d.topics || {});
    const out = { Grid: true };
    if (types.includes("visualization_msgs/msg/Marker") || !types.length) out.Marker = true;
    if (types.includes("visualization_msgs/msg/MarkerArray")) out.MarkerArray = true;
    if (types.includes("visualization_msgs/msg/InteractiveMarkerUpdate")) out.InteractiveMarkers = true;
    return out;
  };
  async function render3D(d) {
    viz3.hidden = false;
    pyTopics = Object.entries(d.topics || {});
    if (!viewer3) {
      const { createRviz } = await import("./rviz.js");
      const frame = spec.fixedFrame || ((d.markers || [])[0] && d.markers[0].header.frame_id) || ((d.imarkers || [])[0] && d.imarkers[0].header.frame_id) || "map";
      viewer3 = createRviz(viz3, { fixedFrame: frame, displays: presetDisplays(d), title: "markers from your program", onFeedback: sendFeedback, topics: graphTopics });
      if (spec.robot) {
        const { gallery, buildRobot } = await import("./rviz-block.js");
        const g = (await gallery()).find((x) => x.id === spec.robot);
        if (g) { const txt = await (await fetch(`/robots/${g.file}`)).text(); const r = await buildRobot(txt, `/robots/${g.file}`); viewer3.setModel(r.model); viewer3.setExtraEdges([{ parent: frame, child: r.model.root, t: [0, 0, 0], q: [0, 0, 0, 1] }]); viewer3.setDisplays({ RobotModel: true }); }
      }
    }
    else viewer3.setDisplays(presetDisplays(d));   // a later run may publish another kind of marker: its display is added (enabled), others stay as the student left them
    viewer3.setMarkers(d.markers || []);
    viewer3.setIMarkers(d.imarkers || []);
  }
  function sendFeedback(fb) {
    const id = nextId++; let t = "";
    waiting.set(id, (m) => {
      if (m.type === "out" || m.type === "err") { t += m.text; return; }
      if (m.type === "status") return;
      waiting.delete(id);
      const lines = t.split("\n"), vz = lines.filter((l) => l.startsWith("@@VIZ ")), plain = lines.filter((l) => !l.startsWith("@@VIZ ")).join("\n").trim();
      if (plain) { out.append(el("span", { text: (out.textContent ? "\n" : "") + plain })); checkGoal(out.textContent, ""); }
      if (m.type === "error") out.append(el("span", { class: "err", text: "\n" + lastLine(m.text) }));
      for (const l of vz) { try { const d = JSON.parse(l.slice(6)); if (d.markers || d.imarkers) render3D(d); } catch { /* ignore */ } }
    });
    getWorker().postMessage({ id, type: "imfb", fb });
  }
  const pass = el("div", { class: "py-pass", hidden: true, text: "Goal reached. Well done!" });
  const solBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "Show me a solution", hidden: true });
  let misses = 0;
  const runBtn = el("button", { class: "btn btn-small", type: "button", text: "Run" });
  const resetBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "Reset code" });
  const goal = spec.goal ? el("div", { class: "py-goal" }, el("b", { text: "Goal: " }), rich(spec.goal)) : null;
  const typed = spec.inputs && spec.inputs.length ? el("div", { class: "py-goal small" }, el("b", { text: "When the program asks, it types: " }), spec.inputs.flatMap((v, i) => [i ? ", " : "", el("code", { text: v })])) : null;
  const edSlot = el("div", { class: "py-edslot" }, ta, out);
  const box = el("div", { class: "py" },
    el("div", { class: "py-head" }, el("b", { text: spec.title || "Python playground" }), el("span", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, solBtn, resetBtn, runBtn)),
    goal, typed, edSlot, viz, viz3, help, pass);
  container.append(box);
  let done = false;
  // the code lives in VS Code once it has loaded; the plain box is the fallback (and what you see for a moment first)
  let ide = null;
  const code = () => (ide ? ide.text(file) : ta.value);
  const setCode = (v) => { if (ide) ide.setText(v, file); else ta.value = v; };
  const dir = "/home/student/python_practice";
  const file = `${dir}/${spec.file || (String(spec.title || "exercise").toLowerCase().replace(/^python\s*\d*\s*:?\s*/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").split("_").reduce((acc, w) => (acc.length + w.length < 40 ? (acc ? acc + "_" : "") + w : acc), "") || "exercise")}.py`.replace(/\/\.py$/, "/exercise.py");
  const prompt = () => el("div", { class: "py-prompt" }, el("span", { class: "u", text: "student@ros2lab" }), ":", el("span", { class: "d", text: "~/python_practice" }), "$ ");
  const termBox = el("div", { class: "py-term" });
  (async () => {
    try {
      const { createVsCode } = await import("./vscode.js");
      const mem = new Map([[file, ta.value]]), dirs = new Set([dir]);
      const memFs = {
        list: (d) => { const names = new Map(); for (const k of [...mem.keys(), ...dirs]) if (k !== d && k.startsWith(d + "/")) { const rest = k.slice(d.length + 1), nm = rest.split("/")[0]; names.set(nm, names.get(nm) || rest.includes("/") || dirs.has(`${d}/${nm}`)); } return [...names].map(([name, isDir]) => ({ name, dir: isDir })); },
        read: (q) => (mem.has(q) ? mem.get(q) : null), isFile: (q) => mem.has(q), isDir: (q) => dirs.has(q),
        write: (q, t) => { mem.set(q, t); return null; }, mkdir: (q) => { dirs.add(q); return null; },
        remove: (q) => { if (q === file || file.startsWith(q + "/")) return "This exercise needs its main file, so it cannot be deleted. Use Reset code to start over."; for (const k of [...mem.keys()]) if (k === q || k.startsWith(q + "/")) mem.delete(k); for (const d of [...dirs]) if (d === q || d.startsWith(q + "/")) dirs.delete(d); return null; },
        rename: (a, b) => {
          if (a === file || file.startsWith(a + "/")) return "Keep the exercise file's name and folder: the Run button runs this file.";
          if (mem.has(b) || dirs.has(b)) return `A file or folder ${b.split("/").pop()} already exists at this location.`;
          for (const k of [...mem.keys()]) if (k === a || k.startsWith(a + "/")) { mem.set(b + k.slice(a.length), mem.get(k)); mem.delete(k); }
          for (const d of [...dirs]) if (d === a || d.startsWith(a + "/")) { dirs.add(b + d.slice(a.length)); dirs.delete(d); }
          return null;
        },
      };
      const lines = (spec.code || "").split("\n").length;
      const host = el("div", { class: "py-vsc" });
      host.style.setProperty("--vsc-h", Math.max(400, Math.min(680, lines * 19 + 290)) + "px");
      termBox.replaceChildren(prompt(), out);
      out.classList.add("in-vsc");
      ide = await createVsCode(host, { fs: memFs, root: dir, rootLabel: "python_practice", open: [file], terminal: termBox, narrow: edSlot.clientWidth > 0 && edSlot.clientWidth < 600, allowPaste: !!spec.allowPaste, onRun: () => run() });
      ide.setText(ta.value, file); ide.save(file);
      edSlot.replaceChildren(host);
    } catch (e) { console.warn("VS Code editor could not load, using the plain editor", e); }
  })();

  // Friendly editing: Tab = 4 spaces, Enter keeps indentation (+4 after a colon)
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab") { e.preventDefault(); ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end"); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const before = ta.value.slice(0, ta.selectionStart);
      const line = before.split("\n").pop();
      const indent = (line.match(/^\s*/) || [""])[0] + (/:\s*$/.test(line) ? "    " : "");
      ta.setRangeText("\n" + indent, ta.selectionStart, ta.selectionEnd, "end");
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
  });
  resetBtn.addEventListener("click", () => { setCode(spec.code || ""); if (ide) ide.focus(); else ta.focus(); });
  solBtn.addEventListener("click", () => {
    setCode(spec.solution); solBtn.hidden = true;
    help.replaceChildren(el("b", { text: "Solution loaded. " }), document.createTextNode("Read it line by line, compare it with your version, then press Run."));
    help.hidden = false;
  });
  runBtn.addEventListener("click", run);

  let running = false;
  function run() {
    if (running) return;   // one run at a time (the Run button and VS Code's ▷ both call this)
    running = true;
    const id = nextId++;
    let text = "", errText = "";
    if (ide) { ide.showPanel("TERMINAL"); termBox.replaceChildren(prompt(), el("span", { text: `python3 ${file.split("/").pop()}` }), out); }
    out.replaceChildren(el("span", { class: "info", text: "Running…" }));
    help.hidden = true;
    runBtn.disabled = true;
    const timer = setTimeout(() => finish({ type: "error", text: "TimeoutError: the program ran for more than 10 seconds and was stopped. Is there a loop that never ends?" }, true), 10000);
    waiting.set(id, (m) => {
      if (m.type === "status") { out.replaceChildren(el("span", { class: "info", text: m.text || "Running…" })); return; }
      if (m.type === "out") { text += m.text; return; }
      if (m.type === "err") { errText += m.text; return; }
      clearTimeout(timer);
      finish(m, false);
    });
    function finish(m, killed) {
      running = false;
      waiting.delete(id);
      const vizLines = text.split("\n").filter((l) => l.startsWith("@@VIZ "));
      text = text.split("\n").filter((l) => !l.startsWith("@@VIZ ")).join("\n");
      viz.replaceChildren();
      for (const l of vizLines) { try { const d = JSON.parse(l.slice(6)); if (d.markers || d.imarkers) render3D(d).catch((e) => { viz3.hidden = false; viz3.textContent = "The 3D viewer could not load: " + e.message; }); else drawViz(viz, d); } catch { /* ignore a broken drawing */ } }
      runBtn.disabled = false;
      if (killed && worker) { worker.terminate(); worker = null; }
      if (m.type === "error") errText += m.text;
      out.replaceChildren();
      if (text) out.append(el("span", { text }));
      if (errText) {
        const short = lastLine(errText);
        out.append(el("span", { class: "err", text: (text ? "\n" : "") + short }));
        const why = explain(errText);
        if (why) { help.replaceChildren(el("b", { text: "What this means: " }), document.createTextNode(why)); help.hidden = false; }
      }
      if (!text && !errText) out.append(el("span", { class: "info", text: "(The program finished without printing anything.)" }));
      if (ide) { termBox.append(prompt()); termBox.scrollTop = termBox.scrollHeight; }
      checkGoal(text, errText);
    }
    getWorker().postMessage({ id, code: code(), inputs: spec.inputs || [], params: spec.params || {}, simSeconds: spec.simSeconds || 3 });
  }

  function checkGoal(text, errText) {
    if (done) return;
    if (errText) { misses++; if (spec.solution && misses >= 2) solBtn.hidden = false; return; }
    const o = normOut(text);
    let ok = false;
    if (spec.expect != null) ok = o === normOut(spec.expect);
    else if (spec.contains) ok = [].concat(spec.contains).every((c) => o.includes(c));
    else return;
    if (spec.mustInclude) ok = ok && [].concat(spec.mustInclude).every((c) => code().includes(c));
    if (spec.notContains) ok = ok && ![].concat(spec.notContains).some((c) => o.includes(c));
    if (ok) { done = true; pass.hidden = false; solBtn.hidden = true; onComplete && onComplete(); }
    else if (spec.expect != null || spec.contains) {
      misses++;
      if (spec.solution && misses >= 2) solBtn.hidden = false;
      help.replaceChildren(el("b", { text: "Not yet: " }), document.createTextNode(spec.retryHint || "The output doesn't match the goal yet. Read the goal again and compare.")); help.hidden = false;
    }
  }
  return { isDone: () => done };
}


// ---------- drawings after a run: turtlesim paths, planar arms, odometry paths ----------
function drawViz(box, v) {
  const panel = (title, w = 300, h = 300) => {
    const c = el("canvas", { width: w * 2, height: h * 2, role: "img", "aria-label": title });
    c.style.width = w + "px"; c.style.height = h + "px";
    box.append(el("figure", { class: "py-viz-fig" }, el("figcaption", { text: title }), c));
    const ctx = c.getContext("2d"); ctx.scale(2, 2); return ctx;
  };
  if (v.turtles) {
    const W = 11.088889, S = 300, k = S / W, X = (x) => x * k, Y = (y) => S - y * k;
    const ctx = panel("TurtleSim after the run");
    ctx.fillStyle = "rgb(69,86,255)"; ctx.fillRect(0, 0, S, S);
    for (const t of v.turtles) {
      ctx.strokeStyle = `rgb(${t.pen.join(",")})`; ctx.lineWidth = 2; ctx.lineJoin = "round";
      for (const seg of t.path) { ctx.beginPath(); seg.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); }
    }
    for (const t of v.turtles) {
      ctx.save(); ctx.translate(X(t.x), Y(t.y)); ctx.rotate(-t.theta);
      ctx.fillStyle = "#7cc36b"; ctx.strokeStyle = "#1f3d1c"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(11, 0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.font = "11px sans-serif"; ctx.fillText(t.name, X(t.x) + 12, Y(t.y) - 10);
    }
  }
  for (const a of v.arms || []) {
    const reach = a.l.reduce((s, x) => s + x, 0), base = a.base || [0, 0, 0];
    const span = reach * 1.25 + Math.max(Math.abs(base[0]), Math.abs(base[1]));
    const S = 300, k = S / (2 * span), X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k;
    const ctx = panel(a.label || "Arm after the run");
    ctx.fillStyle = "#F7FAFF"; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "#DCE6F3"; ctx.lineWidth = 1;
    for (let g = -Math.ceil(span); g <= Math.ceil(span); g += 0.5) { ctx.beginPath(); ctx.moveTo(X(g), 0); ctx.lineTo(X(g), S); ctx.moveTo(0, Y(g)); ctx.lineTo(S, Y(g)); ctx.stroke(); }
    ctx.strokeStyle = "#9AA6C2"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(X(base[0]), Y(base[1]), reach * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (a.base) { ctx.save(); ctx.translate(X(base[0]), Y(base[1])); ctx.rotate(-base[2]); ctx.fillStyle = "#FFC83D"; ctx.strokeStyle = "#1D2B53"; ctx.lineWidth = 2; ctx.fillRect(-0.25 * k, -0.18 * k, 0.5 * k, 0.36 * k); ctx.strokeRect(-0.25 * k, -0.18 * k, 0.5 * k, 0.36 * k); ctx.restore(); }
    let x = base[0], y = base[1], th = base[2];
    const pts = [[x, y]];
    a.l.forEach((L, i) => { th += a.q[i] || 0; x += L * Math.cos(th); y += L * Math.sin(th); pts.push([x, y]); });
    ctx.strokeStyle = "#6C4FE0"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py)))); ctx.stroke();
    ctx.fillStyle = "#1D2B53"; pts.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(X(px), Y(py), 5, 0, Math.PI * 2); ctx.fill(); });
    if (a.target) { ctx.strokeStyle = "#D93E5F"; ctx.lineWidth = 2.5; const [tx, ty] = a.target; ctx.beginPath(); ctx.moveTo(X(tx) - 7, Y(ty) - 7); ctx.lineTo(X(tx) + 7, Y(ty) + 7); ctx.moveTo(X(tx) + 7, Y(ty) - 7); ctx.lineTo(X(tx) - 7, Y(ty) + 7); ctx.stroke(); }
    ctx.fillStyle = "#1D2B53"; ctx.font = "11px sans-serif";
    ctx.fillText(`end effector: (${x.toFixed(2)}, ${y.toFixed(2)})`, 8, S - 10);
  }
  for (const p of v.paths || []) {
    if (!p.pts.length) continue;
    const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
    const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 0), minY = Math.min(...ys, 0), maxY = Math.max(...ys, 0);
    const span = Math.max(maxX - minX, maxY - minY, 0.5) * 1.2, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const S = 300, k = S / span, X = (x) => S / 2 + (x - cx) * k, Y = (y) => S / 2 - (y - cy) * k;
    const ctx = panel(p.label || "Path");
    ctx.fillStyle = "#F7FAFF"; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "#9AA6C2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), S); ctx.moveTo(0, Y(0)); ctx.lineTo(S, Y(0)); ctx.stroke();
    ctx.strokeStyle = "#0E9F95"; ctx.lineWidth = 3; ctx.beginPath(); p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
    const [ex, ey] = p.pts[p.pts.length - 1];
    ctx.fillStyle = "#D93E5F"; ctx.beginPath(); ctx.arc(X(ex), Y(ey), 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1D2B53"; ctx.font = "11px sans-serif"; ctx.fillText(`end: (${ex.toFixed(2)}, ${ey.toFixed(2)})`, 8, S - 10);
  }
}
