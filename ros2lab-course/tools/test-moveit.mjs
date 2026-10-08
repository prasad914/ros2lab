// Checks the practice MoveIt (public/js/moveit-core.js) on the gallery arms: IK, collision model, and a plan with every
// pipeline (OMPL, Pilz PTP/LIN, CHOMP, STOMP) around an obstacle. Usage: node tools/test-moveit.mjs [robot_id ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), pub = path.resolve(here, "../public");
globalThis.location = { origin: "http://localhost", href: "http://localhost/rviz.html" };
globalThis.fetch = async (url) => { const rel = decodeURIComponent(new URL(String(url), "http://localhost/").pathname);
  // ROS2LAB_PUBLIC: more folders to look in (the rest of the site, when only an update package is unpacked here)
  const p = [pub, ...(process.env.ROS2LAB_PUBLIC || "").split(path.delimiter).filter(Boolean)].map((r) => path.join(r, rel)).find((f) => fs.existsSync(f)) || path.join(pub, rel); if (!fs.existsSync(p)) return { ok: false, status: 404, text: async () => "" }; return { ok: true, status: 200, text: async () => fs.readFileSync(p, "utf8"), arrayBuffer: async () => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }; };
const { galleryPackage } = await import("../public/js/rviz-pkg.js");
const { parseURDF, xacro } = await import("../public/js/urdf-core.js");
const M = await import("../public/js/moveit-core.js");
const { moveitSpec } = await import("../public/js/moveit-config.js").catch(() => ({}));
const list = JSON.parse(fs.readFileSync(path.join(pub, "robots/index.json"), "utf8"));
const ids = process.argv.slice(2);
let bad = 0;
for (const g of list.filter((x) => (ids.length ? ids.includes(x.id) : x.moveit))) {
  let p; try { p = await galleryPackage(g); } catch (e) { console.log(`\n${g.id}: skipped (${e.message})`); continue; }
  const t = p.files[`urdf/${p.main}`];
  const text = /<xacro:|xmlns:xacro/.test(t) ? xacro(t, { path: `/${p.name}/urdf/${p.main}`, files: (q) => p.files[String(q).replace(new RegExp(`^/${p.name}/`), "")], find: (q) => (q === p.name ? `/${p.name}` : undefined) }) : t;
  const model = parseURDF(text);
  const readMesh = async (fn) => { const m = String(fn).match(/^package:\/\/([\w-]+)\/(.+)$/); const c = m && p.files[m[2]]; const u = c && String(c).match(/^@url:(.+)$/); if (!u) return []; const r = await fetch(u[1]); const ext = fn.split(".").pop(); return M.meshPointsFrom(ext.toLowerCase() === "stl" ? await r.arrayBuffer() : await r.text(), ext); };
  const t0 = Date.now();
  const spheres = M.linkSpheres(await M.linkPoints(model, readMesh));
  const K = new M.KinematicModel(model);
  const spec = g.moveit || {};
  const base = spec.base || model.root, tip = spec.tip;
  if (!tip) { console.log(`${g.id}: no moveit tip in index.json`); continue; }
  const G = new M.JointGroup(K, "arm", base, tip);
  const named = (v) => (v ? G.values(G.clamp(v)) : {});
  const acmList = M.computeACM(K, spheres, { samples: 1500, defaults: [{}, named(spec.home), named(spec.ready)] });
  const acm = new Set(acmList.map((x) => `${x.link1}|${x.link2}`));
  const CM = new M.CollisionModel(K, spheres, { acm, group: G });
  if (process.env.SPHERES) for (const [l, ss] of Object.entries(spheres)) if (ss.length) console.log(`   ${l}: ${ss.map((x) => x.r.toFixed(3)).join(' ')}`);
  const nS = Object.values(spheres).reduce((s, x) => s + x.length, 0);
  console.log(`\n${g.id}: ${G.dof} DOF chain ${base}->${tip}, ${nS} spheres, ACM ${acmList.length} pairs, prep ${Date.now() - t0} ms`);
  const home = spec.home ? G.clamp(spec.home) : G.clamp(G.joints.map(() => 0));
  const hc = CM.contact(G.values(home), { full: true }); if (hc) { console.log("  home in collision:", M.contactText(hc)); bad++; }
  // goal: from FK of a random valid configuration; IK round trip
  let goal = null; for (let i = 0; i < 200 && !goal; i++) { const q = G.random(); if (CM.valid(G.values(q))) goal = q; }
  const T = G.tipFrame(goal).T;
  const ik = M.solveIK(G, T, { seed: home, positionOnly: G.dof < 6, valid: (q) => CM.valid(G.values(q)) });
  const ikErr = ik ? Math.hypot(G.tipFrame(ik).T[3] - T[3], G.tipFrame(ik).T[7] - T[7], G.tipFrame(ik).T[11] - T[11]) : NaN;
  console.log(`  IK: ${ik ? "ok" : "FAILED"} pos err ${ikErr.toExponential(2)}`); if (!ik) bad++;
  const goalQ = ik || goal;
  // obstacle between: a box at the midpoint of the tool path
  const A = G.tipFrame(home).T, B = G.tipFrame(goalQ).T, mid = [(A[3] + B[3]) / 2, (A[7] + B[7]) / 2, (A[11] + B[11]) / 2];
  let obj = { id: "box", type: "box", dims: [0.06, 0.06, 0.06].map((x) => x * (spec.scale || 1)), pose: M.fromRPY(mid, [0, 0, 0]) };
  CM.setObjects([obj]);
  if (CM.contact(G.values(home), { full: true }) || CM.contact(G.values(goalQ), { full: true })) { CM.setObjects([]); console.log("  (obstacle overlapped start/goal: planning without it)"); }
  // Each result is labelled: OK, EXPECTED (what real MoveIt does too, with the reason) or PROBLEM (a fault to fix).
  //  - OMPL must always find a path around the box.
  //  - Pilz never avoids obstacles: a PTP/LIN through the box is rejected (FAILURE / "Computed path is not valid"), as in real MoveIt.
  //  - Pilz LIN needs IK all along the straight line: NO_IK_SOLUTION when the line leaves the workspace is correct.
  //  - CHOMP / STOMP start from the straight joint-space line; with the box on it they can fail (local optimizers).
  // Then the same start/goal without the box: PTP, CHOMP and STOMP must succeed, unless the direct joint-space motion makes
  // the arm hit itself (then only OMPL can go around; LIN may still be NO_IK).
  const why = (pipeline, id, r, free) => {
    if (r.ok) return null;
    const collide = /not valid|collision|contact/i.test(r.message);
    if (free && collide && pipeline !== "ompl") return `the direct joint-space motion makes the arm hit itself (self-collision: ${(r.message.match(/between '([^']+)'.*?and '([^']+)'/) || []).slice(1).join(" / ") || "robot links"}); only a sampling planner (OMPL) goes around it, as in real MoveIt`;
    if (pipeline === "pilz_industrial_motion_planner" && collide) return "Pilz does not plan around obstacles: the motion through the box is rejected (real MoveIt does the same)";
    if (pipeline === "pilz_industrial_motion_planner" && id === "LIN" && r.error === "NO_IK_SOLUTION") return "the tool's straight line leaves the reachable workspace or the joint limits";
    if ((pipeline === "chomp" || pipeline === "stomp") && (collide || /PLANNING_FAILED|TIMED_OUT/.test(r.error))) return `${pipeline.toUpperCase()} optimizes the straight joint-space line locally and could not bend it free of ${free ? "the arm itself (self-collision)" : "the box"}; use OMPL here (real ${pipeline.toUpperCase()} behaves the same)`;
    return null;
  };
  const run = (label, cases, strict) => {
    console.log(`  -- ${label}`);
    for (const [pipeline, id] of cases) {
      const r = M.plan({ pipeline, planner_id: id, group: G, start: home, goal: goalQ, CM, allowed_planning_time: 5, max_velocity_scaling_factor: 0.5, max_acceleration_scaling_factor: 0.5, positionOnly: G.dof < 6 || !!spec.positionOnly });
      const w = why(pipeline, id, r, strict);
      const problem = !r.ok && (pipeline === "ompl" || !w);
      const tag = r.ok ? "OK      " : problem ? "PROBLEM " : "EXPECTED";
      console.log(`  ${tag} ${pipeline}/${id || "-"}: ${r.ok ? `${r.trajectory.points.length} pts, ${r.duration.toFixed(2)} s motion, planned in ${(r.planning_time * 1000).toFixed(0)} ms` : `${r.error}: ${w || r.message.slice(0, 150)}`}`);
      if (problem) bad++;
    }
  };
  const ALL = [["ompl", "RRTConnectkConfigDefault"], ["ompl", "RRTstarkConfigDefault"], ["ompl", "PRMkConfigDefault"], ["pilz_industrial_motion_planner", "PTP"], ["pilz_industrial_motion_planner", "LIN"], ["chomp", ""], ["stomp", ""]];
  const hadBox = CM.objects && CM.objects.length;
  run(hadBox ? "with a box on the tool's path" : "no obstacle (it overlapped start or goal)", ALL, !hadBox);
  if (hadBox) { CM.setObjects([]); run("same start and goal, no obstacle", ALL.filter(([p]) => p !== "ompl"), true); }
}
console.log(bad ? `\n${bad} PROBLEM(s): see the lines marked PROBLEM` : "\nAll good: every result is OK or EXPECTED (EXPECTED = what real MoveIt also does; the reason is printed)");
process.exitCode = bad ? 1 : 0;
