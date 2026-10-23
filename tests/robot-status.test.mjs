// Robot / workspace / entry status (Night 1, Part 1): schema, allow-list and course references.
// node tests/robot-status.test.mjs  (no browser, no server)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const J = (p) => JSON.parse(readFileSync(`${root}/${p}`, "utf8").replace(/^﻿/, ""));
let fails = 0, oks = 0;
const check = (ok, what) => { if (ok) oks++; else { fails++; console.log("FAIL", what); } };
const STATUS = ["active", "under_test"], DATE = /^\d{4}-\d{2}-\d{2}$/;
const schema = (o, where) => {
  check(STATUS.includes(o.status), `${where}: status is "active" or "under_test" (got ${JSON.stringify(o.status)})`);
  check(typeof o.status_reason === "string" && o.status_reason.trim().length > 10, `${where}: status_reason set`);
  check(DATE.test(o.status_since || ""), `${where}: status_since is a date`);
};

// 1. schema: every robot, every workspace, every page entry with a command
const robots = J("public/robots/index.json");
for (const g of robots) { schema(g, `robot ${g.id}`); if ("legacy" in g) check(g.legacy === true && g.status === "active", `robot ${g.id}: legacy only on an active robot`); }
const wsIndex = J("public/robots/ws/index.json").workspaces;
for (const [id, w] of Object.entries(wsIndex)) {
  schema(w, `workspace ${id}`);
  check(w.status === (w.robots.some((r) => robots.find((g) => g.id === r)?.status === "active") ? "active" : "under_test"), `workspace ${id}: active exactly when one of its robots is`);
  const ws = J(`public/robots/ws/${id}/workspace.json`);
  for (const [kind, v] of Object.entries(ws.entry || {})) for (const [i, e] of (Array.isArray(v) ? v : [v]).entries()) {
    if (!e || typeof e !== "object" || !e.cmd) continue;
    schema(e, `${id} entry ${kind}#${i + 1}`);
    const rs = e.robot ? [e.robot] : ws.robots;
    if (e.status === "active") check(rs.some((r) => robots.find((g) => g.id === r)?.status === "active"), `${id} entry ${kind}#${i + 1}: active only for an active robot`);
  }
}
// every workspace folder is in the index
for (const d of readdirSync(`${root}/public/robots/ws`)) if (existsSync(`${root}/public/robots/ws/${d}/workspace.json`)) check(!!wsIndex[d], `workspace folder ${d} is in ws/index.json`);

// 2. allow-list: the active robots are exactly public/robots/course-required.json
const req = J("public/robots/course-required.json").robots;
const active = robots.filter((g) => g.status === "active").map((g) => g.id).sort();
check(JSON.stringify(active) === JSON.stringify(Object.keys(req).sort()), `active robots = COURSE_REQUIRED_ROBOTS (active: ${active.join(", ")})`);
for (const id of Object.keys(req)) check(robots.some((g) => g.id === id), `course-required ${id} exists in index.json`);
for (const [id, r] of Object.entries(req)) check(!!r.legacy === !!robots.find((g) => g.id === id)?.legacy, `${id}: legacy flag matches course-required.json`);
check(req.tb3_burger && req.tb3_waffle_pi, "the two course TurtleBot3 models are required");

// 3. course references: a lesson that uses a robot or workspace (SIM, VIEWER, FILE, GALLERY) needs it active
const scan = JSON.parse(execFileSync("node", [`${root}/parity/scripts/tb3_v3/course_robot_refs.mjs`], { encoding: "utf8", maxBuffer: 64 << 20 }));
const USE = ["SIM", "VIEWER", "FILE", "GALLERY"];
const uses = scan.refs.filter((r) => USE.includes(r.kind) && r.lesson !== "(home page)");
check(uses.length > 10, `the scan found lesson references (${uses.length})`);
for (const r of uses) {
  const st = r.id.startsWith("ws:") ? wsIndex[r.id.slice(3)]?.status : robots.find((g) => g.id === r.id)?.status;
  check(st === "active", `${r.lesson} (${r.file}:${r.line}) uses ${r.id} (${r.kind}), which is ${st || "missing"}`);
}
console.log(`robot-status: ${oks} ok, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
