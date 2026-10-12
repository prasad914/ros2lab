// Mesh files as Gazebo's physics sees them (gz-common's mesh loaders feed gz-physics): STL (binary and ASCII), OBJ and
// COLLADA (.dae) read into plain triangle arrays, in the file's own coordinates (a DAE's <unit meter> is applied and
// its node transforms too; up_axis is NOT applied, as gz-common does not apply it), then scaled by the SDF <scale>.
// Plain JavaScript without three.js, so the physics, the lidar and the tests can use it.
// Phones: big meshes are decimated (vertex clustering) to at most maxTris triangles before they become colliders.

const td = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
const asText = (src) => (typeof src === "string" ? src : td ? td.decode(src instanceof ArrayBuffer ? new Uint8Array(src) : src) : String.fromCharCode(...src));
const asBytes = (src) => (typeof src === "string" ? new TextEncoder().encode(src) : src instanceof ArrayBuffer ? new Uint8Array(src) : src);

/** Parse a mesh file. src: Uint8Array | ArrayBuffer | string. ext: "stl" | "obj" | "dae".
 *  Returns { positions: Float32Array (x,y,z per vertex), indices: Uint32Array (3 per triangle) } or throws. */
export function parseMesh(src, ext) {
  ext = String(ext || "").toLowerCase().replace(/^\./, "");
  if (ext === "stl") return parseStl(asBytes(src));
  if (ext === "obj") return parseObj(asText(src));
  if (ext === "dae") return parseDae(asText(src));
  throw new Error(`Unsupported mesh extension [${ext}]`);
}
export const meshExt = (path) => (String(path).match(/\.(\w+)(?:[?#].*)?$/) || [, ""])[1].toLowerCase();

function parseStl(b) {
  const head = td ? td.decode(b.subarray(0, Math.min(b.length, 512))) : "";
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const binN = b.length >= 84 ? dv.getUint32(80, true) : -1;
  const isBinary = binN >= 0 && 84 + binN * 50 === b.length || !/^\s*solid[\s\S]*facet/.test(head);
  if (isBinary && binN >= 0) {
    const pos = new Float32Array(binN * 9);
    for (let i = 0; i < binN; i++) { const o = 84 + i * 50 + 12; for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true); }
    return { positions: pos, indices: seq(binN * 3) };
  }
  const t = asText(b), out = [];
  for (const m of t.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)) out.push(+m[1], +m[2], +m[3]);
  return { positions: Float32Array.from(out), indices: seq(out.length / 3) };
}
const seq = (n) => { const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; return a; };

function parseObj(t) {
  const v = [], idx = [];
  for (const line of t.split(/\r?\n/)) {
    if (line.startsWith("v ")) { const p = line.trim().split(/\s+/); v.push(+p[1], +p[2], +p[3]); }
    else if (line.startsWith("f ")) {
      const f = line.trim().split(/\s+/).slice(1).map((s) => { const i = parseInt(s, 10); return i < 0 ? v.length / 3 + i : i - 1; });
      for (let k = 1; k + 1 < f.length; k++) idx.push(f[0], f[k], f[k + 1]);
    }
  }
  return { positions: Float32Array.from(v), indices: Uint32Array.from(idx) };
}

// ---------- COLLADA ----------
// a tiny XML reader good enough for COLLADA (elements, attributes, text)
function xmlTree(s) {
  const root = { tag: "#root", a: {}, c: [], t: "" }, st = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[6] !== undefined) { st[st.length - 1].t += m[6]; continue; }
    if (m[1] !== undefined) { st[st.length - 1].t += m[1]; continue; }
    if (!m[3]) continue;
    if (m[2]) { if (st.length > 1) st.pop(); continue; }
    const a = {}; for (const x of (m[4] || "").matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[x[1]] = x[2] ?? x[3];
    const n = { tag: m[3].replace(/^.*:/, ""), a, c: [], t: "" };
    st[st.length - 1].c.push(n);
    if (!m[5]) st.push(n);
  }
  return root;
}
const kid = (n, tag) => n && n.c.find((x) => x.tag === tag);
const kids = (n, tag) => (n ? n.c.filter((x) => x.tag === tag) : []);
const nums = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).map(Number);
function findAll(n, tag, out = []) { for (const c of n.c) { if (c.tag === tag) out.push(c); findAll(c, tag, out); } return out; }
const M4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mmul(A, B) { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[i * 4 + j] += A[i * 4 + k] * B[k * 4 + j]; return r; }
function nodeMatrix(n) {
  let M = M4();
  for (const c of n.c) {
    const v = nums(c.t);
    if (c.tag === "matrix" && v.length === 16) M = mmul(M, v);
    else if (c.tag === "translate") M = mmul(M, [1, 0, 0, v[0], 0, 1, 0, v[1], 0, 0, 1, v[2], 0, 0, 0, 1]);
    else if (c.tag === "scale") M = mmul(M, [v[0], 0, 0, 0, 0, v[1], 0, 0, 0, 0, v[2], 0, 0, 0, 0, 1]);
    else if (c.tag === "rotate") {
      const [x0, y0, z0] = v, l = Math.hypot(x0, y0, z0) || 1, x = x0 / l, y = y0 / l, z = z0 / l, a = (v[3] * Math.PI) / 180, C = Math.cos(a), S = Math.sin(a), t = 1 - C;
      M = mmul(M, [t * x * x + C, t * x * y - S * z, t * x * z + S * y, 0, t * x * y + S * z, t * y * y + C, t * y * z - S * x, 0, t * x * z - S * y, t * y * z + S * x, t * z * z + C, 0, 0, 0, 0, 1]);
    }
  }
  return M;
}
function parseDae(text) {
  const doc = xmlTree(text), C = kid(doc, "COLLADA") || doc;
  const asset = kid(C, "asset"), unit = asset && kid(asset, "unit"), meter = unit && unit.a.meter ? Number(unit.a.meter) || 1 : 1;
  const geoms = new Map();
  for (const g of findAll(C, "geometry")) {
    const mesh = kid(g, "mesh"); if (!mesh) continue;
    const sources = new Map(); for (const s of kids(mesh, "source")) { const fa = kid(s, "float_array"); const acc = findAll(s, "accessor")[0]; sources.set(s.a.id, { v: nums(fa && fa.t), stride: acc ? Number(acc.a.stride) || 3 : 3 }); }
    const vtx = kid(mesh, "vertices"), vIn = vtx ? kids(vtx, "input").find((i) => i.a.semantic === "POSITION") : null;
    const posSrc = (id) => sources.get(String(id).replace(/^#/, ""));
    const tris = [];
    for (const prim of mesh.c.filter((x) => ["triangles", "polylist", "polygons", "trifans", "tristrips"].includes(x.tag))) {
      const inputs = kids(prim, "input"), maxOff = Math.max(0, ...inputs.map((i) => Number(i.a.offset) || 0)) + 1;
      const vi = inputs.find((i) => i.a.semantic === "VERTEX" || i.a.semantic === "POSITION"); if (!vi) continue;
      const src = vi.a.semantic === "VERTEX" ? (vIn ? posSrc(vIn.a.source) : null) : posSrc(vi.a.source); if (!src) continue;
      const off = Number(vi.a.offset) || 0;
      const P = (i) => [src.v[i * src.stride], src.v[i * src.stride + 1], src.v[i * src.stride + 2]];
      const polys = [];
      if (prim.tag === "triangles") { const p = nums(kid(prim, "p") && kid(prim, "p").t); for (let i = 0; i + 3 * maxOff <= p.length; i += 3 * maxOff) polys.push([p[i + off], p[i + maxOff + off], p[i + 2 * maxOff + off]]); }
      else if (prim.tag === "polylist") { const p = nums(kid(prim, "p") && kid(prim, "p").t), vc = nums(kid(prim, "vcount") && kid(prim, "vcount").t); let k = 0; for (const n of vc) { const f = []; for (let j = 0; j < n; j++) f.push(p[(k + j) * maxOff + off]); k += n; polys.push(f); } }
      else for (const pe of kids(prim, "p")) { const p = nums(pe.t), f = []; for (let i = 0; i < p.length; i += maxOff) f.push(p[i + off]); if (prim.tag === "tristrips") { for (let i = 2; i < f.length; i++) polys.push(i % 2 ? [f[i - 1], f[i - 2], f[i]] : [f[i - 2], f[i - 1], f[i]]); } else polys.push(f); }
      for (const f of polys) for (let k = 1; k + 1 < f.length; k++) tris.push(P(f[0]), P(f[k]), P(f[k + 1]));
    }
    geoms.set(g.a.id, tris);
  }
  const out = [];
  const emit = (tris, M) => { for (const p of tris) out.push((M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3]) * meter, (M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7]) * meter, (M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]) * meter); };
  const lib = kid(C, "library_visual_scenes"), nodesLib = new Map(findAll(C, "node").filter((n) => n.a.id).map((n) => [n.a.id, n]));
  const scene = kid(C, "scene"), inst = scene && kid(scene, "instance_visual_scene");
  const vs = lib && (kids(lib, "visual_scene").find((v) => inst && "#" + v.a.id === inst.a.url) || kids(lib, "visual_scene")[0]);
  let used = false;
  const walk = (n, M, depth = 0) => {
    if (depth > 64) return;
    const W = mmul(M, nodeMatrix(n));
    for (const ig of kids(n, "instance_geometry")) { const t = geoms.get(String(ig.a.url).replace(/^#/, "")); if (t) { emit(t, W); used = true; } }
    for (const inn of kids(n, "instance_node")) { const r = nodesLib.get(String(inn.a.url).replace(/^#/, "")); if (r) walk(r, W, depth + 1); }
    for (const c of kids(n, "node")) walk(c, W, depth + 1);
  };
  if (vs) for (const n of kids(vs, "node")) walk(n, M4());
  if (!used) for (const t of geoms.values()) emit(t, M4());   // no scene: every geometry as it is
  return { positions: Float32Array.from(out), indices: seq(out.length / 3) };
}

/** Scale, weld duplicate vertices and decimate (vertex clustering on a grid) to at most maxTris triangles. */
export function prepareMesh(mesh, scale = [1, 1, 1], maxTris = 4000) {
  const P = mesh.positions, I = mesh.indices, n = P.length / 3;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const S = new Float32Array(P.length);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = P[i * 3 + k] * (scale[k] ?? 1); S[i * 3 + k] = v; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  if (!n) return { positions: S, indices: new Uint32Array(0), lo: [0, 0, 0], hi: [0, 0, 0], tris: 0 };
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
  const nt = I.length / 3;
  let cell = nt > maxTris ? diag / (2.2 * Math.sqrt(maxTris)) : diag * 1e-5, res;
  for (let pass = 0; pass < 24; pass++) {
    res = cluster(S, I, lo, cell);
    if (res.indices.length / 3 <= maxTris) break;
    cell *= 1.8;
  }
  return { positions: res.positions, indices: res.indices, lo, hi, tris: res.indices.length / 3 };
}
function cluster(S, I, lo, cell) {
  const map = new Map(), pos = [], idx = [], remap = new Int32Array(S.length / 3);
  for (let i = 0; i < S.length / 3; i++) {
    const key = Math.round((S[i * 3] - lo[0]) / cell) + Math.round((S[i * 3 + 1] - lo[1]) / cell) * 131072 + Math.round((S[i * 3 + 2] - lo[2]) / cell) * 17179869184;
    let j = map.get(key); if (j === undefined) { j = pos.length / 3; map.set(key, j); pos.push(S[i * 3], S[i * 3 + 1], S[i * 3 + 2]); }
    remap[i] = j;
  }
  const seen = new Set();
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = remap[I[t]], b = remap[I[t + 1]], c = remap[I[t + 2]];
    if (a === b || b === c || a === c) continue;
    const s3 = [a, b, c].sort((x, y) => x - y), k = s3[0] * 4294967296 + s3[1] * 65536 + s3[2];
    if (seen.has(k)) continue; seen.add(k); idx.push(a, b, c);
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}

/** Ray / triangle-mesh intersection (Möller–Trumbore), for the lidar without WebGL. Returns the distance or Infinity. */
export function rayMesh(o, d, mesh, maxD = Infinity) {
  const P = mesh.positions, I = mesh.indices; let best = maxD;
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv; if (dist > 1e-6 && dist < best) best = dist;
  }
  return best;
}
