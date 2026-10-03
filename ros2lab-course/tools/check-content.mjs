// Checks content/course-content.json before you upload it:
//  - every practice-terminal task can be completed with its "sol" commands
//  - every Python exercise's solution reaches its goal (and the starting code does not)
//  - every game and animation id exists
// Run from the project folder:   node tools/check-content.mjs     (Python 3 needed for the Python part)
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = (p) => pathToFileURL(join(root, "public", "js", p)).href;
const { Shell } = await import(pub("terminal-sim.js"));
const { GAMES } = await import(pub("games/registry.js"));
const { ANIMS } = await import(pub("anims/registry.js"));
const course = JSON.parse(readFileSync(join(root, "content", "course-content.json"), "utf8").replace(/^﻿/, ""));

let problems = 0, terms = 0, pys = 0;
const bad = (where, msg) => { problems++; console.log(`  PROBLEM ${where}: ${msg}`); };
const norm = (s) => s.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();

// Python: the same practice rclpy the browser uses, run with your local python3
const worker = readFileSync(join(root, "public", "js", "py-worker.js"), "utf8");
const miniRos = worker.match(/const MINI_ROS = String\.raw`([\s\S]*?)`;/)[1];
const dir = mkdtempSync(join(tmpdir(), "ros2lab-"));
writeFileSync(join(dir, "mini_ros.py"), miniRos);
let python = null;
for (const p of ["python3", "python"]) { try { execFileSync(p, ["--version"]); python = p; break; } catch { /* try next */ } }
function runPy(code, inputs = [], params = {}, sim = 3) {
  const f = join(dir, "case.py");
  writeFileSync(f, code);
  const boot = `import sys, json, builtins\nsys.path.insert(0, ${JSON.stringify(dir)})\nexec(open(${JSON.stringify(join(dir, "mini_ros.py"))}).read())\nimport rclpy\nrclpy._world_overrides = json.loads(${JSON.stringify(JSON.stringify(params))})\n_inp = ${JSON.stringify(inputs)}\nbuiltins.input = lambda p='': (print(p + _inp[0]) if p else print(_inp[0])) or _inp.pop(0)\nrclpy._reset()\nrclpy._set_sim_seconds(${Number(sim) || 3})\ng = {'__name__': '__main__'}\nexec(compile(open(${JSON.stringify(f)}).read(), 'case.py', 'exec'), g)\n`;
  try { return { out: execFileSync(python, ["-c", boot], { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { out: e.stdout || "", err: (e.stderr || String(e)).trim().split("\n").pop() }; }
}
function goalMet(b, r) {
  if (r.err) return false;
  const o = norm(r.out);
  let ok = b.expect != null ? o === norm(b.expect) : [].concat(b.contains || []).every((c) => o.includes(c));
  if (b.notContains) ok = ok && ![].concat(b.notContains).some((c) => o.includes(c));
  return ok;
}

for (const m of course.modules) for (const l of m.lessons) for (const [i, b] of (l.blocks || []).entries()) {
  const where = `${l.id} block ${i + 1} (${b.t})`;
  if (b.t === "game" && !GAMES.some((g) => g.id === b.id)) bad(where, `unknown game id ${b.id}`);
  if (b.t === "anim" && !ANIMS.some((a) => a.id === b.id)) bad(where, `unknown animation id ${b.id}`);
  if (b.t === "term" && b.tasks && b.tasks.length) {
    terms++;
    const sh = new Shell(b);
    let step = 0, busy = false;
    const after = (cmd) => { while (step < b.tasks.length && sh.check(b.tasks[step].check, cmd)) step++; };
    for (const [k, t] of b.tasks.entries()) {
      for (const s of [].concat(t.sol || [])) {
        if (s && s.newTerminal) { sh.newTerminal(); if (b.sourced && !sh.sourced) sh.applySource(); busy = false; after(""); }
        else if (s && s.nano) {   // edit a file the way a student would in nano: replace text, save, exit
          const p = sh.abs(s.nano), n = sh.node(p) || { type: "f", mode: "rw-r--r--", content: "" };
          const [from, to] = s.replace || ["", ""];
          sh.fs.set(p, { ...n, content: (n.content || "").replace(from, to) });
          after(`nano ${s.nano}`);
        }
        else {
          if (busy) bad(where, `task ${k + 1}: "${s}" is typed in a terminal tab that is still busy running a node (add {newTerminal: true} first)`);
          sh.graph.lastStarted = null; const r = sh.run(s); if (sh.graph.lastStarted && sh.graph.lastStarted.length) busy = true; if (r.nano) { /* nano tasks are checked by hand */ } after(s);
        }
      }
      if (step <= k) { bad(where, `task ${k + 1} not completed by its solution: ${JSON.stringify(t.sol)}\n      last output: ${sh.lastOutput.split("\n").slice(0, 3).join(" | ")}`); break; }
    }
  }
  if (b.t === "py" && python && (b.expect != null || b.contains)) {
    pys++;
    if (!b.solution) { bad(where, "no solution"); continue; }
    const s = runPy(b.solution, b.inputs, b.params, b.simSeconds);
    if (!goalMet(b, s)) bad(where, `solution does not reach the goal. ${s.err ? "Error: " + s.err : "Output: " + norm(s.out).slice(0, 300)}`);
    if (b.mustInclude && ![].concat(b.mustInclude).every((c) => b.solution.includes(c))) bad(where, "solution lacks mustInclude text");
    const start = runPy(b.code, b.inputs, b.params, b.simSeconds);
    if (goalMet(b, start) && !(b.mustInclude && ![].concat(b.mustInclude).every((c) => b.code.includes(c)))) bad(where, "the starting code already reaches the goal");
  }
}
// Firestore limits: no list directly inside a list, documents under 1 MB
const fsProblem = (v, path, inList = false) => {
  if (Array.isArray(v)) {
    if (inList) return path;
    for (let i = 0; i < v.length; i++) { const r = fsProblem(v[i], `${path}[${i}]`, true); if (r) return r; }
  } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { const r = fsProblem(x, `${path}.${k}`); if (r) return r; }
  return null;
};
for (const m of course.modules) for (const l of m.lessons) {
  const at = fsProblem(l.blocks, "blocks");
  if (at) bad(l.id, `a list inside a list at ${at}: Firestore cannot store this, so the upload would fail`);
  if (JSON.stringify(l).length > 900000) bad(l.id, "lesson is too large for one Firestore document (1 MB)");
}
console.log(`Checked ${terms} practice terminals and ${pys} Python exercises${python ? "" : " (Python skipped: python3 not found)"}.`);
console.log(problems ? `${problems} problem(s) found.` : "All good.");
process.exit(problems ? 1 : 0);
