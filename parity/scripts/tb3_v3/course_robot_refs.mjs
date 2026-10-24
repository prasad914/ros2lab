// Lists every place the course (lessons weeks 1-9, practice terminals, tests, the home page strip) refers to a
// simulator robot id (public/robots/index.json) or to a workspace (public/robots/ws/index.json).
// Read-only. Usage: node parity/scripts/tb3_v3/course_robot_refs.mjs [--json out.json]
// Prints JSON { refs: [...], unresolved: [...], resolved: [...] } that parity/scripts/tb3_v3/write_course_refs_md.mjs turns into
// parity/reports/COURSE_ROBOT_REFERENCES.md and that tests/course-robot-status.test.mjs re-runs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "");
const read = (p) => readFileSync(`${root}/${p}`, "utf8").replace(/^﻿/, "");
const robots = JSON.parse(read("public/robots/index.json"));
const ws = JSON.parse(read("public/robots/ws/index.json")).workspaces;
const ids = robots.map((r) => r.id);
// workspace packages that only one robot family ships (a command naming one of them starts that workspace)
const PKG = [
  [/\bturtlebot3_(gazebo|navigation2|cartographer|bringup|teleop|fake_node|description)\b/, "turtlebot3"],
  [/\bur_(simulation_gz|robot_driver|description|moveit_config)\b/, "ur"],
  [/\bfranka_[a-z_]+\b/, "franka"], [/\bkortex_[a-z_]+\b/, "kortex"], [/\bxarm_[a-z_]+\b/, "xarm"],
  [/\binterbotix_[a-z_]+\b/, "interbotix"], [/\bdobot_[a-z_]+\b/, "dobot"], [/\bcrazyflie\b/, "crazyswarm2"], [/\bscout_[a-z_]+\b/, "scout"],
];
// names that point at a robot family without saying which model / id; each carries the owner's decision
// (2026-10-24, Night 2): the scanner never maps them itself
const AMBIGUOUS = [
  [/\bUR5\b(?!e)/, "UR5 (UR5 or UR5e?)", "ur5e: lesson UR7 uses ur_type:=ur5e"],
  [/\bPanda\b|panda_moveit/i, "Panda (moveit_resources Panda demo; not a site robot id, the site has fr3)", "mention only, no robot id, no change"],
  [/TurtleBot3(?! (Burger|Waffle))/, "TurtleBot3 without a model", "no robot id: the real missing-TURTLEBOT3_MODEL error (KeyError: 'TURTLEBOT3_MODEL') when no model is exported"],
];
const refs = [], unresolved = [], resolved = [];
function scanLines(file, lines, ctxOf) {
  lines.forEach((text, i) => {
    const line = i + 1, ctx = ctxOf ? ctxOf(i) : {};
    const key = (text.match(/^\s*"([A-Za-z_]+)":/) || [])[1] || "";
    // 1. "robot": "<id>" in an rviz block
    const rb = text.match(/^\s*"robot":\s*"([^"]+)"/);
    if (rb && ids.includes(rb[1])) refs.push({ id: rb[1], file, line, kind: ctx.gallery ? "GALLERY" : "VIEWER", lesson: ctx.lesson, text: text.trim() });
    // 2. TURTLEBOT3_MODEL=<model> / "TURTLEBOT3_MODEL": "<model>" / choose TurtleBot3 <Model> on the Simulator page
    for (const m of text.matchAll(/TURTLEBOT3_MODEL(?:=|"\s*:\s*")(burger|waffle_pi|waffle)\b/g)) refs.push({ id: `tb3_${m[1]}`, file, line, kind: "SIM", lesson: ctx.lesson, text: text.trim().slice(0, 220) });
    for (const m of text.matchAll(/choose \*\*TurtleBot3 (Burger|Waffle Pi|Waffle)\*\*/g)) refs.push({ id: `tb3_${m[1].toLowerCase().replace(" ", "_")}`, file, line, kind: "SIM", lesson: ctx.lesson, text: text.trim().slice(0, 220) });
    // 2b. "path": "/robots/<file>" where <file> is a gallery robot's own file (the lesson edits that robot's URDF)
    const fp = text.match(/^\s*"path":\s*"\/robots\/([^"]+)"/);
    if (fp) for (const g of robots) if (g.file === fp[1]) refs.push({ id: g.id, file, line, kind: "FILE", lesson: ctx.lesson, text: text.trim() });
    // 3. rviz.html?robot=<id> links
    for (const m of text.matchAll(/rviz\.html\?robot=([a-z0-9_]+)/g)) if (ids.includes(m[1])) refs.push({ id: m[1], file, line, kind: "LINK", lesson: ctx.lesson, text: text.trim().slice(0, 220) });
    // 4. workspace packages in commands
    for (const [re, w] of PKG) { const m = text.match(re); if (m) refs.push({ id: `ws:${w}`, file, line, kind: key === "cmd" || key === "sol" || /ros2 (launch|run)/.test(text) ? "SIM" : "MENTION", lesson: ctx.lesson, text: text.trim().slice(0, 220), match: m[0] }); }
    // 5. a robot id as a whole word in prose / code (MENTION), except the "robot" keys already counted
    if (!rb && !fp) for (const id of ids) { const re = new RegExp(`(^|[^A-Za-z0-9_])${id}([^A-Za-z0-9_]|$)`); if (re.test(text) && !/TURTLEBOT3_MODEL/.test(text)) refs.push({ id, file, line, kind: "MENTION", lesson: ctx.lesson, text: text.trim().slice(0, 220) }); }
    for (const [re, why, owner] of AMBIGUOUS) if (re.test(text)) (owner ? resolved : unresolved).push({ name: why, owner, file, line, lesson: ctx.lesson, text: text.trim().slice(0, 220) });
  });
}
// the course content: track which lesson and whether the current block is a gallery rviz block
{
  const file = "content/course-content.json", lines = read(file).split("\n");
  const ctx = []; let lesson = "", gallery = false, depth = 0, blockDepth = -1;
  lines.forEach((t, i) => {
    const lid = t.match(/^\s*"id":\s*"([A-Z][A-Z0-9]*[0-9][a-z]?)"/); if (lid) lesson = lid[1];
    if (/^\s*"t":\s*"/.test(t)) { blockDepth = depth; gallery = false; }
    if (/^\s*"gallery":\s*true/.test(t)) gallery = true;
    depth += (t.match(/[{[]/g) || []).length - (t.match(/[}\]]/g) || []).length;
    ctx[i] = { lesson, gallery };
  });
  // the gallery flag comes after "robot" in some blocks: look ahead to the end of the block
  lines.forEach((t, i) => { if (/^\s*"robot":/.test(t)) for (let k = i; k < Math.min(lines.length, i + 8) && !/^\s*}/.test(lines[k]); k++) if (/"gallery":\s*true/.test(lines[k])) ctx[i] = { ...ctx[i], gallery: true }; });
  scanLines(file, lines, (i) => ctx[i]);
}
// the home page robot strip and the home practice computer
for (const file of ["public/js/index.js", "public/js/lab.js", "public/index.html"]) {
  try { const lines = read(file).split("\n"); scanLines(file, lines, () => ({ lesson: "(home page)" }));
    lines.forEach((t, i) => { for (const m of t.matchAll(/\["([a-z0-9_]+)",\s*"[^"]+"\]/g)) if (ids.includes(m[1]) && /gz-robots|robot=/.test(lines.slice(Math.max(0, i - 3), i + 3).join("\n"))) refs.push({ id: m[1], file, line: i + 1, kind: "LINK", lesson: "(home page)", text: `home strip: ${m[0]}` }); }); }
  catch { /* file absent */ }
}
const out = { robots: ids, workspaces: Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, v.robots])), refs, unresolved, resolved };
process.stdout.write(JSON.stringify(out, null, 1));
