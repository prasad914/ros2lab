// Saves each gallery arm's collision spheres and SRDF collision matrix to public/robots/moveit/<id>.json, so the
// generated <robot>_moveit_config/config/<robot>.srdf is the same every time (MoveIt Setup Assistant samples once too).
//   node tools/moveit-precompute.mjs [robot_id ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), pub = path.resolve(here, "../public");
globalThis.location = { origin: "http://localhost", href: "http://localhost/rviz.html" };
const find = (rel) => [pub, ...(process.env.ROS2LAB_PUBLIC || "").split(path.delimiter).filter(Boolean)].map((r) => path.join(r, rel)).find((f) => fs.existsSync(f));
globalThis.fetch = async (url) => { const f = find(decodeURIComponent(new URL(String(url), "http://localhost/").pathname)); if (!f) return { ok: false, status: 404 }; const b = fs.readFileSync(f); return { ok: true, status: 200, text: async () => b.toString("utf8"), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const { parseURDF } = await import("../public/js/urdf-core.js");
const { meshPointsFrom } = await import("../public/js/moveit-core.js");
const { moveitModel } = await import("../public/js/moveit-config.js");
const { galleryUrdf } = await import("../public/js/rviz-pkg.js");
const list = JSON.parse(fs.readFileSync(path.join(pub, "robots/index.json"), "utf8"));
const ids = process.argv.slice(2);
fs.mkdirSync(path.join(pub, "robots/moveit"), { recursive: true });
let seed = 12345; const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
Math.random = rng;   // deterministic sampling: the same SRDF on every run
for (const g of list.filter((x) => x.moveit && (ids.length ? ids.includes(x.id) : x.source))) {
  const { urdf, readMesh } = await galleryUrdf(g, meshPointsFrom);
  const m = await moveitModel(parseURDF(urdf), g.moveit, { readMesh, samples: 3000 });
  const r6 = (x) => Math.round(x * 1e5) / 1e5;
  const out = { robot: g.id, note: "collision spheres (link frame) and SRDF disable_collisions, from tools/moveit-precompute.mjs", spheres: Object.fromEntries(Object.entries(m.spheres).filter(([, s]) => s.length).map(([l, s]) => [l, s.map((x) => ({ c: x.c.map(r6), r: r6(x.r) }))])), acm: m.acm };
  fs.writeFileSync(path.join(pub, `robots/moveit/${g.id}.json`), JSON.stringify(out));
  console.log(`${g.id}: ${Object.values(out.spheres).flat().length} spheres, ${m.acm.length} disabled pairs`);
}
