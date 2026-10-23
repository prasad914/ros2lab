// Writes "status" ("active" | "under_test"), "status_reason" and "status_since" on every robot in
// public/robots/index.json, every workspace in public/robots/ws/index.json and every page entry (an entry with a
// cmd) in public/robots/ws/<ws>/workspace.json, from public/robots/course-required.json.
// A robot is active when course-required.json lists it; every other robot is under_test. A workspace is active when
// one of its robots is. An entry is active when the robot(s) it runs for are active; a reason or status already set
// on an entry by hand ("status_lock": true) is kept.
// Edits the files as text (they are hand-formatted), so only the status lines change. Usage: node tools/apply-robot-status.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const P = (p) => `${root}/${p}`;
const req = JSON.parse(readFileSync(P("public/robots/course-required.json"), "utf8"));
const SINCE = req.since;
const UNDER = "Not used by the course lessons; its simulation is being checked against real ROS 2 Jazzy (owner decision 2026-10-23).";
const robotStatus = (id) => (req.robots[id] ? { status: "active", status_reason: req.robots[id].why } : { status: "under_test", status_reason: UNDER });
const q = (s) => JSON.stringify(s);

// 1. public/robots/index.json: replace the "status" line that follows each robot's "id" line
{
  const f = P("public/robots/index.json"); let t = readFileSync(f, "utf8");
  const ids = JSON.parse(t).map((r) => r.id);
  for (const id of ids) {
    const s = robotStatus(id);
    const re = new RegExp(`("id": ${q(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},\\n)(\\s*)"status": "[^"]*",\\n(?:\\s*"status_reason": .*,\\n)?(?:\\s*"status_since": .*,\\n)?(?:\\s*"legacy": .*,\\n)?`);
    if (!re.test(t)) throw new Error(`index.json: no status line after the id of ${id}`);
    t = t.replace(re, (_, a, ind) => `${a}${ind}"status": ${q(s.status)},\n${ind}"status_reason": ${q(s.status_reason)},\n${ind}"status_since": ${q(SINCE)},\n${req.robots[id] && req.robots[id].legacy ? `${ind}"legacy": true,\n` : ""}`);
  }
  JSON.parse(t); writeFileSync(f, t);
}
// the files are big and partly hand-formatted: replace only the text of the top-level "entry" value
function spliceEntry(text, entry) {
  const start = text.indexOf('\n "entry": '); if (start < 0) throw new Error("no top-level entry");
  const v0 = start + '\n "entry": '.length; let depth = 0, i = v0, inStr = false;
  for (; i < text.length; i++) { const c = text[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === "{" || c === "[") depth++; else if (c === "}" || c === "]") { depth--; if (!depth) { i++; break; } } }
  const ser = (x) => JSON.stringify(x, null, 1).replace(/\n/g, "\n ");
  return text.slice(0, v0) + ser(entry) + text.slice(i);
}
// 2. workspace.json page entries and 3. ws/index.json
{
  const fi = P("public/robots/ws/index.json"), index = JSON.parse(readFileSync(fi, "utf8"));
  for (const [wsid, w] of Object.entries(index.workspaces)) {
    const active = w.robots.filter((r) => req.robots[r]);
    Object.assign(w, active.length ? { status: "active", status_reason: `Course robot(s): ${active.join(", ")}.`, status_since: SINCE } : { status: "under_test", status_reason: UNDER, status_since: SINCE });
    const f = P(`public/robots/ws/${wsid}/workspace.json`), ws = JSON.parse(readFileSync(f, "utf8"));
    for (const [kind, v] of Object.entries(ws.entry || {})) for (const e of Array.isArray(v) ? v : [v]) {
      if (!e || typeof e !== "object" || !e.cmd || e.status_lock) continue;
      const robots = e.robot ? [e.robot] : ws.robots, on = robots.filter((r) => req.robots[r]);
      const real = kind === "real";
      Object.assign(e, on.length
        ? { status: "active", status_reason: real ? "Real-hardware entry of a course robot (behind the hardware license lock)." : `Entry of course robot(s) ${on.join(", ")}.`, status_since: SINCE }
        : { status: "under_test", status_reason: UNDER, status_since: SINCE });
    }
    writeFileSync(f, spliceEntry(readFileSync(f, "utf8"), ws.entry));
  }
  writeFileSync(fi, JSON.stringify(index, null, 1) + "\n");
}
console.log("status written");
