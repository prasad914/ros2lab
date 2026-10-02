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

export function mountPython(container, spec, { onComplete } = {}) {
  const ta = el("textarea", { spellcheck: "false", autocapitalize: "off", "aria-label": "Python code editor" });
  ta.value = spec.code || "";
  ta.rows = Math.min(40, Math.max(6, (spec.code || "").split("\n").length + 1));
  const out = el("div", { class: "py-out", role: "log", "aria-live": "polite" }, el("span", { class: "info", text: "Press Run to see the output here." }));
  const help = el("div", { class: "py-help", hidden: true });
  const pass = el("div", { class: "py-pass", hidden: true, text: "Goal reached. Well done!" });
  const solBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "Show me a solution", hidden: true });
  let misses = 0;
  const runBtn = el("button", { class: "btn btn-small", type: "button", text: "Run" });
  const resetBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "Reset code" });
  const goal = spec.goal ? el("div", { class: "py-goal" }, el("b", { text: "Goal: " }), rich(spec.goal)) : null;
  const typed = spec.inputs && spec.inputs.length ? el("div", { class: "py-goal small" }, el("b", { text: "When the program asks, it types: " }), spec.inputs.map((v, i) => [i ? ", " : "", el("code", { text: v })])) : null;
  const box = el("div", { class: "py" },
    el("div", { class: "py-head" }, el("b", { text: spec.title || "Python playground" }), el("span", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, solBtn, resetBtn, runBtn)),
    goal, typed, ta, out, help, pass);
  container.append(box);
  let done = false;

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
  resetBtn.addEventListener("click", () => { ta.value = spec.code || ""; ta.focus(); });
  solBtn.addEventListener("click", () => {
    ta.value = spec.solution; solBtn.hidden = true;
    help.replaceChildren(el("b", { text: "Solution loaded. " }), document.createTextNode("Read it line by line, compare it with your version, then press Run."));
    help.hidden = false;
  });
  runBtn.addEventListener("click", run);

  function run() {
    const id = nextId++;
    let text = "", errText = "";
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
      waiting.delete(id);
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
      checkGoal(text, errText);
    }
    getWorker().postMessage({ id, code: ta.value, inputs: spec.inputs || [], params: spec.params || {} });
  }

  function checkGoal(text, errText) {
    if (done) return;
    if (errText) { misses++; if (spec.solution && misses >= 2) solBtn.hidden = false; return; }
    const o = normOut(text);
    let ok = false;
    if (spec.expect != null) ok = o === normOut(spec.expect);
    else if (spec.contains) ok = [].concat(spec.contains).every((c) => o.includes(c));
    else return;
    if (spec.mustInclude) ok = ok && [].concat(spec.mustInclude).every((c) => ta.value.includes(c));
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
