// Dump every practice-terminal block of content/course-content.json with its starting files (from the site Shell).
// Usage: node dump_term_blocks.mjs <repo root> <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.argv[2], out = process.argv[3];
const { Shell } = await import(pathToFileURL(root + "/public/js/terminal-sim.js").href);
const course = JSON.parse(readFileSync(root + "/content/course-content.json", "utf8").replace(/^﻿/, ""));
const res = [];
for (const m of course.modules) for (const l of m.lessons) { let ti = 0; for (const [bi, b] of (l.blocks || []).entries()) {
  if (b.t !== "term" || !b.tasks || !b.tasks.length) continue; ti++;
  const sh = new Shell(b);
  const files = {};
  for (const [p, n] of sh.fs) if (p.startsWith("/home/student")) files[p] = n.type === "d" ? { d: 1, mode: n.mode } : { mode: n.mode, content: n.content };
  res.push({ week: m.id, lesson: l.id, term: ti, block: bi, title: b.title, sourced: !!b.sourced, running: b.running || [], start: b.start || null, fresh: !!b.fresh, bareRos: !!b.bareRos, cwd: sh.cwd, env: sh.env, tasks: b.tasks.map(t => ({ do: t.do, sol: t.sol })), files });
}}
writeFileSync(out, JSON.stringify(res, null, 1));
console.log(res.length, "blocks");
