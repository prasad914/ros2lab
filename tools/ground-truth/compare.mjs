// Compares real ROS 2 (ground-truth/real/<id>/, from capture.sh) with the site (ground-truth/site/<id>/, from
// tests/sim-capture.mjs) and writes ground-truth/REPORT.md with every difference.
//   node tools/ground-truth/compare.mjs [id ...]
// Differences that are expected (random node names, things the site does not model on purpose) are listed in the
// ```expected block of tools/ground-truth/README.md; they are reported separately and do not count.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GT = join(ROOT, "ground-truth");
const want = process.argv.slice(2);

const scenarios = readFileSync(join(ROOT, "tools/ground-truth/scenarios.txt"), "utf8").split("\n")
  .filter((l) => l.trim() && !l.trim().startsWith("#")).map((l) => l.split("|")[0].trim())
  .filter((id) => !want.length || want.includes(id));
// expected differences: "<scenario id or *> <regex>" per line, matched against "<category>: <text>"
const readme = readFileSync(join(ROOT, "tools/ground-truth/README.md"), "utf8");
const expected = ((readme.match(/```expected\n([\s\S]*?)```/) || [])[1] || "").split("\n")
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf(" "); return { scope: l.slice(0, i), re: new RegExp(l.slice(i + 1).trim()) }; });

const read = (d, f) => (existsSync(join(d, f)) ? readFileSync(join(d, f), "utf8").replace(/\x1b\[[0-9;]*m/g, "") : null);
const lines = (t) => (t || "").split("\n").map((l) => l.trim()).filter(Boolean);
function setDiff(cat, a, b, out) {   // a = real, b = site
  const A = new Set(a), B = new Set(b);
  for (const x of A) if (!B.has(x)) out.push(`${cat}: only real: ${x}`);
  for (const x of B) if (!A.has(x)) out.push(`${cat}: only site: ${x}`);
}
const tfEdges = (gv) => [...(gv || "").matchAll(/"([^"]+)"\s*->\s*"([^"]+)"/g)].map((m) => `${m[1]} -> ${m[2]}`);
const ctlRows = (t) => lines(t).filter((l) => !l.startsWith("##")).map((l) => l.split(/\s+/).join(" "));
// ros2 topic info -v: the type, and per endpoint "PUBLISHER /ns/node RELIABLE/VOLATILE"
function infoOf(t) {
  const type = ((t || "").match(/^Type: (.*)$/m) || [])[1] || "?";
  const eps = (t || "").split(/\n(?=Node name:)/).slice(1).map((b) => {
    const g = (k) => ((b.match(new RegExp(`^\\s*${k}: (.*)$`, "m")) || [])[1] || "").trim();
    const ns = g("Node namespace"), name = g("Node name");
    return `${g("Endpoint type")} ${(ns === "/" ? "" : ns) + "/" + name} ${g("Reliability")}/${g("Durability")}`;
  });
  return { type, eps };
}
const hzOf = (t) => { const m = (t || "").match(/average rate: ([\d.]+)/); return m ? +m[1] : null; };
// a message's shape: the field names with their depth, and the frame ids
function echoOf(t) {
  const keys = new Set(), frames = [];
  for (const l of (t || "").split("\n")) {
    if (l.startsWith("---")) break;
    const m = l.match(/^(\s*)(?:-\s+)?([A-Za-z_]\w*):(.*)$/); if (!m) continue;
    keys.add(`${m[1].length}:${m[2]}`);
    if (/frame_id$/.test(m[2])) frames.push(`${m[2]}=${m[3].trim()}`);
  }
  return { keys: [...keys], frames };
}
// launch output: which processes started, and every warning / error / died line, without stamps and pids
function launchOf(dir) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^launch_\d+\.log$/.test(f)) : [];
  const text = files.map((f) => read(dir, f)).join("\n");
  const procs = [...text.matchAll(/\[INFO\] \[([^\]]+?)-\d+\]: process started with pid/g)].map((m) => m[1]);
  const issues = text.split("\n").filter((l) => /\[(WARN|ERROR|FATAL)\]|process has died|\[Err\]|\[Wrn\]/.test(l))
    .map((l) => l.replace(/\[\d+\.\d+\]/g, "").replace(/\[pid \d+/g, "[pid N").replace(/-\d+\]/g, "-N]")
      .replace(/0x[0-9a-f]+/gi, "0x…").replace(/\s+/g, " ").trim().slice(0, 300));
  return { procs: [...new Set(procs)], issues: [...new Set(issues)] };
}

function compare(id) {
  const R = join(GT, "real", id), S = join(GT, "site", id), out = [];
  if (!existsSync(R)) return { missing: "no real recording (run capture.sh)" };
  if (!existsSync(S)) return { missing: "no site recording (run tests/sim-capture.mjs)" };
  if (existsSync(join(S, "capture_error.txt"))) out.push(`capture: site capture failed: ${lines(read(S, "capture_error.txt"))[0]}`);
  for (const f of ["nodes", "topics", "services", "actions"]) setDiff(f, lines(read(R, `${f}.txt`)), lines(read(S, `${f}.txt`)), out);
  setDiff("controllers", ctlRows(read(R, "controllers.txt")), ctlRows(read(S, "controllers.txt")), out);
  setDiff("hardware_interfaces", ctlRows(read(R, "hardware_interfaces.txt")), ctlRows(read(S, "hardware_interfaces.txt")), out);
  setDiff("tf", tfEdges(read(R, "tf_frames.gv")), tfEdges(read(S, "tf_frames.gv")), out);
  const LR = launchOf(R), LS = launchOf(S);
  setDiff("processes", LR.procs, LS.procs, out);
  setDiff("launch log", LR.issues, LS.issues, out);
  const topicsR = new Set(lines(read(R, "topics.txt")).map((l) => l.replace(/ \[.*/, "")));
  for (const t of lines(read(S, "topics.txt")).map((l) => l.replace(/ \[.*/, ""))) {
    if (!topicsR.has(t) || t === "/parameter_events" || t === "/rosout") continue;
    const f = t.replace(/^\//, "").replace(/\//g, "__");
    const iR = infoOf(read(R, `topic/${f}.info.txt`)), iS = infoOf(read(S, `topic/${f}.info.txt`));
    if (iR.type !== iS.type) out.push(`topic ${t}: type real ${iR.type}, site ${iS.type}`);
    setDiff(`topic ${t} endpoint`, iR.eps, iS.eps, out);
    const hR = hzOf(read(R, `topic/${f}.hz.txt`)), hS = hzOf(read(S, `topic/${f}.hz.txt`));
    if ((hR === null) !== (hS === null)) out.push(`topic ${t} hz: real ${hR ?? "no messages"}, site ${hS ?? "no messages"}`);
    else if (hR && Math.abs(hR - hS) / hR > 0.15) out.push(`topic ${t} hz: real ${hR}, site ${hS}`);
    const eR = echoOf(read(R, `topic/${f}.echo.txt`)), eS = echoOf(read(S, `topic/${f}.echo.txt`));
    if (eR.keys.length && eS.keys.length) setDiff(`topic ${t} field`, eR.keys, eS.keys, out);
    else if (eR.keys.length !== eS.keys.length) out.push(`topic ${t} echo: real ${eR.keys.length ? "got a message" : "no message"}, site ${eS.keys.length ? "got a message" : "no message"}`);
    setDiff(`topic ${t} frame`, eR.frames, eS.frames, out);
  }
  const isExp = (d) => expected.some((e) => (e.scope === "*" || e.scope === id) && e.re.test(d));
  return { unexpected: out.filter((d) => !isExp(d)), expected: out.filter(isExp) };
}

const res = scenarios.map((id) => ({ id, ...compare(id) }));
const md = ["# Real ROS 2 vs ROS2Lab site", "",
  `Generated by \`node tools/ground-truth/compare.mjs\` on ${new Date().toISOString()}.`,
  "Real: `ground-truth/real/` (capture.sh). Site: `ground-truth/site/` (tests/sim-capture.mjs).",
  "Expected differences are listed in `tools/ground-truth/README.md`.", "",
  "| Scenario | Unexpected | Expected |", "|---|---|---|",
  ...res.map((r) => `| ${r.id} | ${r.missing ? r.missing : r.unexpected.length} | ${r.missing ? "" : r.expected.length} |`), ""];
for (const r of res.filter((x) => !x.missing)) {
  md.push(`## ${r.id}`, "");
  md.push(r.unexpected.length ? r.unexpected.map((d) => `- ${d.replace(/\|/g, "\\|")}`).join("\n") : "No unexpected differences.", "");
  if (r.expected.length) md.push("<details><summary>Expected differences (" + r.expected.length + ")</summary>", "", r.expected.map((d) => `- ${d}`).join("\n"), "", "</details>", "");
}
mkdirSync(GT, { recursive: true }); writeFileSync(join(GT, "REPORT.md"), md.join("\n"));
for (const r of res) console.log(`${r.id.padEnd(20)} ${r.missing || `${r.unexpected.length} unexpected, ${r.expected.length} expected`}`);
console.log("\nWrote ground-truth/REPORT.md");
