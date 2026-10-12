// Checks every robot of public/robots/index.json the way Gazebo Harmonic (libsdformat 14) will load it: links without
// an <inertial> mass are left out of the simulation with everything below them, and links without a <collision> touch
// nothing. Run it after adding or changing a robot:
//   node tools/check-gazebo.mjs [robot-id ...]
// Exit code 1 when a robot would lose links in Gazebo. (The practice Gazebo on the website applies the same rules,
// and prints the same urdf2sdf warnings as Ubuntu does.)
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { xacro, parseURDF } from "../public/js/urdf-core.js";
import { urdfToSdf } from "../public/js/urdf2sdf.js";
import { addInertials } from "../public/js/moveit-config.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../public/robots");
const index = JSON.parse(readFileSync(join(ROOT, "index.json"), "utf8"));
const robots = Array.isArray(index) ? index : index.robots;
const want = process.argv.slice(2);
const EXTRA = process.env.ROBOTS_EXTRA ? resolve(process.env.ROBOTS_EXTRA) : null;   // another folder with robot files (tests)
const where = (f) => (existsSync(join(ROOT, f)) ? join(ROOT, f) : EXTRA && existsSync(join(EXTRA, f)) ? join(EXTRA, f) : null);

// the robot's files as the website loads them: relative <xacro:include>s become $(find pkg)/urdf/<name>
function sources(g) {
  const top = g.file.split("/")[0], pkg = g.pkg || (/_description$/.test(top) ? top : `${g.id}_description`), main = g.file.split("/").pop();
  const files = {}, seen = new Set();
  const take = (path, name) => {
    if (seen.has(path)) return; seen.add(path);
    let text = readFileSync(path, "utf8");
    for (const m of [...text.matchAll(/<xacro:include\s+filename="([^"]+)"/g)]) {
      const inc = m[1]; if (/^\$\(find /.test(inc)) continue;
      text = text.split(`filename="${inc}"`).join(`filename="$(find ${pkg})/urdf/${inc.split("/").pop()}"`);
      take(resolve(dirname(path), inc), inc.split("/").pop());
    }
    files[`urdf/${name}`] = text;
  };
  take(where(g.file), main);
  const t = files[`urdf/${main}`];
  return /<xacro:|xmlns:xacro/.test(t) ? xacro(t, { path: `/${pkg}/urdf/${main}`, files: (p) => files[String(p).replace(new RegExp(`^/${pkg}/`), "")], find: (q) => (q === pkg ? `/${pkg}` : undefined) }) : t;
}

// gz-math MassMatrix3::IsValid: mass > 0, the principal moments (eigenvalues of the inertia matrix) positive and
// satisfying the triangle inequality (Ixx + Iyy >= Izz ...). Gazebo / DART misbehave with invalid inertias.
function principal([xx, xy, xz, yy, yz, zz]) {   // eigenvalues of a symmetric 3x3 matrix (closed form)
  const p1 = xy * xy + xz * xz + yz * yz, q = (xx + yy + zz) / 3;
  if (p1 < 1e-30) return [xx, yy, zz].sort((a, b) => a - b);
  const p2 = (xx - q) ** 2 + (yy - q) ** 2 + (zz - q) ** 2 + 2 * p1, p = Math.sqrt(p2 / 6);
  const B = [[xx - q, xy, xz], [xy, yy - q, yz], [xz, yz, zz - q]].map((r) => r.map((v) => v / p));
  const det = B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) - B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0]) + B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0]);
  const phi = Math.acos(Math.max(-1, Math.min(1, det / 2))) / 3;
  const e1 = q + 2 * p * Math.cos(phi), e3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  return [e3, 3 * q - e1 - e3, e1];
}
export function badInertials(model, only) {   // only: the links Gazebo simulates (after fixed-joint lumping)
  const out = [];
  for (const l of Object.values(model.links)) {
    if (only && !only.includes(l.name)) continue;
    if (!l.inertial || !(l.inertial.mass > 0)) continue;
    const [a, b, c] = principal(l.inertial.inertia), tol = 1e-6 * Math.max(Math.abs(c), 1e-12);
    if (!(a > 0)) out.push(`${l.name} (principal moment ${a.toExponential(2)} <= 0)`);
    else if (a + b < c - tol) out.push(`${l.name} (triangle inequality: ${a.toExponential(2)} + ${b.toExponential(2)} < ${c.toExponential(2)})`);
  }
  return out;
}

let bad = 0;
for (const g of robots) {
  if (want.length && !want.includes(g.id)) continue;
  if (!where(g.file)) { console.log(`--   ${g.id}: ${g.file} is not in this copy`); continue; }
  let urdf;
  try { urdf = sources(g); } catch (e) { console.log(`ERR  ${g.id}: ${e.message}`); bad++; continue; }
  const model = parseURDF(urdf);
  const plain = urdfToSdf(model, urdf);
  // arms whose maker's URDF has no masses get estimated ones in their MoveIt config (index.json "inertials")
  const fixed = g.inertials ? urdfToSdf(parseURDF(addInertials(urdf, g.inertials, "x")), addInertials(urdf, g.inertials, "x")) : null;
  const r = fixed || plain;
  const noColl = Object.values(model.links).filter((l) => !(l.collisions || []).length && ((l.visuals || []).length)).map((l) => l.name);
  const badI = badInertials(fixed ? parseURDF(addInertials(urdf, g.inertials, "x")) : model, r.sdfLinks);
  const ok = r.model && !r.dropped.size && r.collisions > 0;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "BAD "} ${g.id}: ${r.model ? `${r.sdfLinks.length} SDF links, ${r.mass.toFixed(2)} kg, ${r.collisions} collisions` : "no SDF model (the root link has no mass)"}${fixed ? " (with the estimated inertials)" : ""}`);
  if (r.dropped.size) console.log(`       left out of Gazebo: ${[...r.dropped].join(", ")}`);
  if (badI.length) console.log(`       WARNING invalid inertia (gz-math MassMatrix3 is not valid; the physics engine can misbehave, unless the link is welded to the world): ${badI.join(", ")}`);
  if (!r.collisions) console.log("       no <collision> at all: the robot falls through the floor in Gazebo");
  if (noColl.length) console.log(`       visible links without <collision> (they touch nothing in Gazebo): ${noColl.join(", ")}`);
  if (!ok) for (const w of r.warnings.filter((x) => /urdf2sdf/.test(x)).slice(0, 6)) console.log(`       ${w}`);
}
console.log(bad ? `${bad} robot(s) would not load completely in Gazebo` : "every robot loads completely in Gazebo");
process.exit(bad ? 1 : 0);
