// ROS2Lab Nav2 models: the algorithms (no ROS graph here). Pure functions used by nav2-sim.js and slam-sim.js.
// These are the website's own JavaScript models of the Nav2 C++ servers (the real programs cannot run in a browser):
// they read the REAL parameters (nav2_params.yaml / turtlebot3 burger.yaml), the REAL map files (map.yaml + .pgm,
// nav2_map_server/map_io.cpp semantics) and follow the cost values, conversions and default values of the
// navigation2 jazzy sources (nav2_costmap_2d, nav2_navfn_planner, nav2_smac_planner, dwb_core, nav2_amcl ...).
// Simplifications are named where they are made.

// ---------------------------------------------------------------- YAML (ROS 2 parameter files, map.yaml)
// Block maps / sequences, flow sequences and maps ([a, b], {x: 1}), plain / quoted scalars, comments.
export function parseYaml(text) {
  const lines = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const s = stripComment(raw);
    if (!s.trim() || /^\s*(---|\.\.\.)\s*$/.test(s)) continue;
    lines.push({ ind: s.match(/^ */)[0].length, t: s.trim() });
  }
  let i = 0;
  const block = (ind) => {
    if (i >= lines.length) return null;
    if (lines[i].t === "-" || lines[i].t.startsWith("- ")) {
      const arr = [], my = lines[i].ind;
      while (i < lines.length && lines[i].ind === my && (lines[i].t === "-" || lines[i].t.startsWith("- "))) {
        const rest = lines[i].t.slice(1).trim();
        if (!rest) { i++; arr.push(i < lines.length && lines[i].ind > my ? block(lines[i].ind) : null); continue; }
        const kv = splitKey(rest);
        if (kv && !/^["'[{]/.test(rest)) {   // "- key: value" starts a map item
          lines[i] = { ind: my + 2, t: rest };
          arr.push(block(my + 2));
        } else { i++; arr.push(scalar(rest)); }
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length && lines[i].ind === ind) {
      const kv = splitKey(lines[i].t);
      if (!kv) { i++; continue; }
      const [k, v] = kv; i++;
      if (v === "" || v === "|" || v === ">" || v === "|-" || v === ">-") {
        if (v.startsWith("|") || v.startsWith(">")) {   // block scalar
          const out = []; while (i < lines.length && lines[i].ind > ind) out.push(lines[i++].t);
          obj[k] = out.join(v.startsWith("|") ? "\n" : " ");
        } else if (i < lines.length && (lines[i].ind > ind || (lines[i].ind === ind && lines[i].t.startsWith("- ")))) obj[k] = block(lines[i].ind);
        else obj[k] = null;
      } else obj[k] = scalar(v);
    }
    return obj;
  };
  return lines.length ? block(lines[0].ind) : null;
}
function stripComment(l) {
  let q = null;
  for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === "#" && (i === 0 || /\s/.test(l[i - 1]))) return l.slice(0, i); }
  return l;
}
function splitKey(t) {
  let q = null, depth = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { if (i === 0) q = c; continue; }
    if (c === "[" || c === "{") depth++; else if (c === "]" || c === "}") depth--;
    else if (c === ":" && depth === 0 && (i === t.length - 1 || t[i + 1] === " ")) { let k = t.slice(0, i).trim(); if (/^(["']).*\1$/.test(k)) k = k.slice(1, -1); return [k, t.slice(i + 1).trim()]; }
  }
  return null;
}
export function scalar(s) {
  s = String(s).trim();
  if (s.startsWith("[") && s.endsWith("]")) return splitFlow(s.slice(1, -1)).map(scalar);
  if (s.startsWith("{") && s.endsWith("}")) { const o = {}; for (const part of splitFlow(s.slice(1, -1))) { const kv = splitKey(part) || [part, null]; o[kv[0]] = kv[1] === null ? null : scalar(kv[1]); } return o; }
  if (/^".*"$/.test(s)) return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  if (s === "~" || s === "null" || s === "Null" || s === "NULL") return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s);
  if (/^[-+]?\.inf$/i.test(s)) return s.startsWith("-") ? -Infinity : Infinity;
  return s;
}
function splitFlow(s) {
  const out = []; let depth = 0, q = null, cur = "";
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "[" || c === "{") depth++; if (c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---------------------------------------------------------------- parameters of one node
// sources: parameter files (YAML text: "<name>: ros__parameters: ..." with namespaces, "/**", nested costmaps) and
// parameter dicts ({k: v} with dotted or nested keys, as the launch runtime hands them). Later sources win.
// Returns a nested object (dotted keys expanded): P.FollowPath.max_vel_x, P["inflation_layer"].inflation_radius ...
export function nodeParams(sources, name, ns = "") {
  const fqn = `${ns && ns !== "/" ? "/" + ns.replace(/^\/+|\/+$/g, "") : ""}/${name}`;
  const out = {};
  for (const src of [].concat(sources || [])) {
    if (src == null) continue;
    if (typeof src === "string") {
      let doc; try { doc = parseYaml(src); } catch { doc = null; }
      if (!doc || typeof doc !== "object") continue;
      for (const p of paramsInDoc(doc, fqn)) deepMerge(out, p);
    } else if (typeof src === "object") {
      for (const [k, v] of Object.entries(src)) setDotted(out, k, v);
    }
  }
  return out;
}
// every "ros__parameters" block of a YAML parameter document that applies to the node fqn ("/ns/name")
function paramsInDoc(doc, fqn) {
  const hits = [];
  const walk = (o, path) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return;
    for (const [k, v] of Object.entries(o)) {
      if (k === "ros__parameters") { if (matchNode(path, fqn)) hits.push({ p: v || {}, spec: path.length }); continue; }
      walk(v, [...path, k]);
    }
  };
  walk(doc, []);
  hits.sort((a, b) => a.spec - b.spec);   // wildcards first, then the exact name
  return hits.map((h) => h.p);
}
function matchNode(path, fqn) {
  const key = "/" + path.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
  if (key === "/**" || key === fqn) return true;
  const want = fqn.split("/").filter(Boolean), have = key.split("/").filter(Boolean);
  if (have[0] === "**") return want.slice(-(have.length - 1)).join("/") === have.slice(1).join("/");
  // a node without namespace in the file matches the node of any namespace (RewrittenYaml root_key / bare name)
  return have.join("/") === want.slice(-have.length).join("/") && have.length >= 1 && want.length - have.length <= 1 && want[want.length - 1] === have[have.length - 1];
}
function deepMerge(a, b) { for (const [k, v] of Object.entries(b || {})) { if (v && typeof v === "object" && !Array.isArray(v)) { if (!a[k] || typeof a[k] !== "object" || Array.isArray(a[k])) a[k] = {}; deepMerge(a[k], v); } else setDotted(a, k, v); } return a; }
function setDotted(o, k, v) {
  const parts = String(k).split(".");
  let cur = o;
  for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]] || typeof cur[parts[i]] !== "object" || Array.isArray(cur[parts[i]])) cur[parts[i]] = {}; cur = cur[parts[i]]; }
  const last = parts[parts.length - 1];
  if (v && typeof v === "object" && !Array.isArray(v)) { if (!cur[last] || typeof cur[last] !== "object") cur[last] = {}; deepMerge(cur[last], v); }
  else cur[last] = v;
}
// nested -> {"a.b.c": v} (what `ros2 param list/get` shows)
export function flatParams(o, pre = "", out = {}) {
  for (const [k, v] of Object.entries(o || {})) { const key = pre ? `${pre}.${k}` : k; if (v && typeof v === "object" && !Array.isArray(v)) flatParams(v, key, out); else out[key] = v; }
  return out;
}
export const num = (v, d) => { const n = typeof v === "string" ? Number(v) : v; return typeof n === "number" && Number.isFinite(n) ? n : d; };
export const bool = (v, d) => (v === true || v === "true" || v === "True" ? true : v === false || v === "false" || v === "False" ? false : d);

// ---------------------------------------------------------------- geometry
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const yawOfQ = (q) => Math.atan2(2 * ((q.w ?? q[3]) * (q.z ?? q[2]) + (q.x ?? q[0]) * (q.y ?? q[1])), 1 - 2 * ((q.y ?? q[1]) ** 2 + (q.z ?? q[2]) ** 2));
export const qOfYaw = (y) => ({ x: 0, y: 0, z: Math.sin(y / 2), w: Math.cos(y / 2) });
// 2D rigid transforms {x, y, yaw}
export const compose = (a, b) => ({ x: a.x + Math.cos(a.yaw) * b.x - Math.sin(a.yaw) * b.y, y: a.y + Math.sin(a.yaw) * b.x + Math.cos(a.yaw) * b.y, yaw: wrap(a.yaw + b.yaw) });
export const inverse = (a) => ({ x: -Math.cos(a.yaw) * a.x - Math.sin(a.yaw) * a.y, y: Math.sin(a.yaw) * a.x - Math.cos(a.yaw) * a.y, yaw: -a.yaw });
export function gauss(rng = Math.random) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }

// ---------------------------------------------------------------- map files (nav2_map_server map_io.cpp)
// PGM (P5 binary / P2 ascii) -> { w, h, max, px: Uint8Array (row 0 = top) }
export function parsePgm(bytes) {
  if (typeof bytes === "string") bytes = new TextEncoder().encode(bytes);
  let i = 0;
  const tok = () => {
    for (;;) { while (i < bytes.length && /\s/.test(String.fromCharCode(bytes[i]))) i++; if (bytes[i] === 35) { while (i < bytes.length && bytes[i] !== 10) i++; } else break; }
    let s = ""; while (i < bytes.length && !/\s/.test(String.fromCharCode(bytes[i]))) s += String.fromCharCode(bytes[i++]);
    return s;
  };
  const magic = tok(); if (magic !== "P5" && magic !== "P2") throw new Error(`not a PGM image (${magic})`);
  const w = Number(tok()), h = Number(tok()), max = Number(tok());
  const px = new Uint8Array(w * h);
  if (magic === "P5") { i++; const step = max > 255 ? 2 : 1; for (let k = 0; k < w * h; k++) px[k] = step === 2 ? Math.round(((bytes[i + 2 * k] << 8) | bytes[i + 2 * k + 1]) * 255 / max) : Math.round(bytes[i + k] * 255 / max); }
  else for (let k = 0; k < w * h; k++) px[k] = Math.round(Number(tok()) * 255 / max);
  return { w, h, max, px };
}
export function encodePgm(w, h, px) {
  const head = new TextEncoder().encode(`P5\n${w} ${h}\n255\n`);
  const out = new Uint8Array(head.length + w * h); out.set(head, 0); out.set(px, head.length); return out;
}
const dirOf = (p) => String(p).replace(/\/[^/]*$/, "") || "/";
// map.yaml text (+ its path) -> { grid, info, logs: [[level, logger, text]], error }
// read(path) -> string | Uint8Array | null
export function loadMap(yamlText, yamlPath, read) {
  const logs = [], L = (lv, t) => logs.push([lv, "map_io", t]);
  L("INFO", `Loading yaml file: ${yamlPath}`);
  let y;
  try { y = parseYaml(yamlText); } catch (e) { y = null; }
  if (!y || typeof y !== "object") { L("ERROR", `Failed to parse map YAML loaded from file ${yamlPath} for reason: yaml-cpp: error at line 0, column 0: bad file`); return { logs, error: "parse" }; }
  for (const k of ["image", "resolution", "origin", "occupied_thresh", "free_thresh"]) if (y[k] === undefined || y[k] === null) { L("ERROR", `Failed to parse map YAML loaded from file ${yamlPath} for reason: The YAML file does not contain a ${k} tag or it is invalid.`); return { logs, error: "parse" }; }
  const mode = String(y.mode || "trinary"), negate = Number(y.negate || 0);
  const origin = [].concat(y.origin).map(Number);
  L("INFO", `resolution: ${y.resolution}`); L("INFO", `origin[0]: ${origin[0]}`); L("INFO", `origin[1]: ${origin[1]}`); L("INFO", `origin[2]: ${origin[2]}`);
  L("INFO", `free_thresh: ${y.free_thresh}`); L("INFO", `occupied_thresh: ${y.occupied_thresh}`); L("INFO", `mode: ${mode}`); L("INFO", `negate: ${negate}`);
  const img = String(y.image).startsWith("/") ? String(y.image) : `${dirOf(yamlPath)}/${y.image}`;
  L("INFO", `Loading image_file: ${img}`);
  const data = read(img);
  if (data == null) { L("ERROR", `Failed to load image file ${img} for reason: unable to open image \`${img}': No such file or directory @ error/blob.c/OpenBlob/3596`); return { logs, error: "image" }; }
  let pg; try { pg = parsePgm(data); } catch (e) { L("ERROR", `Failed to load image file ${img} for reason: ${e.message}`); return { logs, error: "image" }; }
  const W = pg.w, H = pg.h, out = new Int8Array(W * H), occ = Number(y.occupied_thresh), free = Number(y.free_thresh);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const g = pg.px[r * W + c], dst = (H - 1 - r) * W + c;   // image row 0 is the top: the grid's row 0 is the bottom
    if (mode === "raw") { out[dst] = g > 100 ? -1 : g; continue; }
    let n = g / 255; if (!negate) n = 1 - n;
    let v = -1; if (n >= occ) v = 100; else if (n <= free) v = 0; else if (mode === "scale") v = Math.round(((n - free) / (occ - free)) * 100);
    out[dst] = v;
  }
  L("INFO", `Read map ${img}: ${W} X ${H} map @ ${y.resolution} m/cell`);
  return { logs, grid: { width: W, height: H, resolution: Number(y.resolution), origin: [origin[0], origin[1], origin[2] || 0], data: out, frame: "map" }, image: img, mode, negate };
}
// OccupancyGrid -> PGM bytes + map.yaml text (map_saver, trinary: 0 occupied, 254 free, 205 unknown)
export function saveMap(grid, { free = 0.25, occ = 0.65, mode = "trinary", imageName = "map.pgm" } = {}) {
  const W = grid.width, H = grid.height, px = new Uint8Array(W * H), fi = Math.round(free * 100), oi = Math.round(occ * 100);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const v = grid.data[(H - 1 - r) * W + c];
    let p = 205;
    if (mode === "raw") p = v < 0 ? 255 : v;
    else if (mode === "scale") p = v < 0 ? 205 : Math.round(255 - (v / 100) * 255);
    else if (v >= 0 && v <= fi) p = 254; else if (v >= oi) p = 0;
    px[r * W + c] = p;
  }
  const f3 = (x) => String(+Number(x).toFixed(3));
  const yaw = grid.origin[2] || 0;
  const yaml = `image: ${imageName}\nmode: ${mode}\nresolution: ${f3(grid.resolution)}\norigin: [${f3(grid.origin[0])}, ${f3(grid.origin[1])}, ${yaw === 0 ? 0 : f3(yaw)}]\nnegate: 0\noccupied_thresh: ${mode === "trinary" ? 0.65 : f3(occ)}\nfree_thresh: ${mode === "trinary" ? 0.196 : f3(free)}`;
  return { pgm: encodePgm(W, H, px), yaml };
}

// ---------------------------------------------------------------- costmap_2d
export const FREE = 0, INSCRIBED = 253, LETHAL = 254, NO_INFO = 255;
export class Grid {
  constructor(w, h, res, ox, oy, fill = 0) { this.w = w; this.h = h; this.res = res; this.ox = ox; this.oy = oy; this.data = new Uint8Array(w * h).fill(fill); }
  toMap(x, y) { const mx = Math.floor((x - this.ox) / this.res), my = Math.floor((y - this.oy) / this.res); return mx >= 0 && my >= 0 && mx < this.w && my < this.h ? [mx, my] : null; }
  toWorld(mx, my) { return [this.ox + (mx + 0.5) * this.res, this.oy + (my + 0.5) * this.res]; }
  at(x, y) { const m = this.toMap(x, y); return m ? this.data[m[1] * this.w + m[0]] : NO_INFO; }
  clone() { const g = new Grid(this.w, this.h, this.res, this.ox, this.oy); g.data.set(this.data); return g; }
}
// nav2_costmap_2d::Costmap2DPublisher: cost -> OccupancyGrid value
const COST_TRANS = (() => { const t = new Int8Array(256); t[0] = 0; for (let i = 1; i < 253; i++) t[i] = 1 + Math.floor((97 * (i - 1)) / 251); t[253] = 99; t[254] = 100; t[255] = -1; return t; })();
export function costmapToGrid(g, frame) { const d = new Int8Array(g.w * g.h); for (let i = 0; i < d.length; i++) d[i] = COST_TRANS[g.data[i]]; return { width: g.w, height: g.h, resolution: g.res, origin: [g.ox, g.oy, 0], data: d, frame }; }
// StaticLayer (trinary_costmap true, lethal_cost_threshold 100, track_unknown_space)
export function staticFromGrid(grid, trackUnknown = true) {
  const g = new Grid(grid.width, grid.height, grid.resolution, grid.origin[0], grid.origin[1]);
  for (let i = 0; i < grid.data.length; i++) { const v = grid.data[i]; g.data[i] = v < 0 ? (trackUnknown ? NO_INFO : FREE) : v >= 100 ? LETHAL : FREE; }
  return g;
}
// InflationLayer: cost = 252 * exp(-cost_scaling_factor * (d - inscribed_radius)) for inscribed < d <= inflation_radius
export function inflate(g, inscribed, radius, factor, inflateUnknown = false) {
  const W = g.w, H = g.h, res = g.res, cells = Math.ceil(radius / res);
  const out = new Uint8Array(g.data);
  const table = [];   // cost by squared cell offset
  for (let dy = 0; dy <= cells; dy++) for (let dx = 0; dx <= cells; dx++) { const d = Math.hypot(dx, dy) * res; table[dy * (cells + 1) + dx] = d === 0 ? LETHAL : d <= inscribed ? INSCRIBED : d <= radius ? Math.floor(252 * Math.exp(-factor * (d - inscribed))) : 0; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g.data[y * W + x] !== LETHAL) continue;
    const y0 = Math.max(0, y - cells), y1 = Math.min(H - 1, y + cells), x0 = Math.max(0, x - cells), x1 = Math.min(W - 1, x + cells);
    for (let yy = y0; yy <= y1; yy++) { const ry = Math.abs(yy - y) * (cells + 1), row = yy * W; for (let xx = x0; xx <= x1; xx++) { const c = table[ry + Math.abs(xx - x)]; if (!c) continue; const i = row + xx, o = out[i]; if (o === NO_INFO) { if (inflateUnknown ? c > FREE : c >= INSCRIBED) out[i] = c; } else if (c > o) out[i] = c; } }
  }
  g.data.set(out);
  return g;
}
// Bresenham cells from (x0,y0) to (x1,y1), exclusive of the end cell
export function* line(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0); const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
  while (!(x0 === x1 && y0 === y1)) { yield [x0, y0]; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
// ObstacleLayer: clear along each ray (raytrace_max_range), mark the end points (obstacle_max_range)
export function markScan(g, sensor, points, { markMax = 2.5, clearMax = 3.0, clear = true, mark = true } = {}) {
  const s = g.toMap(sensor.x, sensor.y); if (!s) return;
  for (const [px, py, r] of points) {
    if (clear) {
      const cr = Math.min(r, clearMax), ex = sensor.x + ((px - sensor.x) * cr) / r, ey = sensor.y + ((py - sensor.y) * cr) / r;
      const e = [Math.floor((ex - g.ox) / g.res), Math.floor((ey - g.oy) / g.res)];
      for (const [cx, cy] of line(s[0], s[1], e[0], e[1])) if (cx >= 0 && cy >= 0 && cx < g.w && cy < g.h) g.data[cy * g.w + cx] = FREE;
    }
    if (mark && r <= markMax) { const m = g.toMap(px, py); if (m) g.data[m[1] * g.w + m[0]] = LETHAL; }
  }
}

// ---------------------------------------------------------------- global planners
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(); const n = k.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; } return top; }
}
// NavFn (Dijkstra or A*, cost = COST_NEUTRAL 50 + COST_FACTOR 0.8 * cost), Smac 2D (A* with cost_penalty), ThetaStar
// (A* + line of sight). Returns { path: [[x,y],...] } or { code, message } with nav2_msgs ComputePathToPose codes.
export function planPath(g, start, goal, opts = {}) {
  const { kind = "navfn", astar = false, tolerance = 0.5, allowUnknown = true, costPenalty = 2.0 } = opts;
  const W = g.w, H = g.h;
  const s = g.toMap(start.x, start.y);
  if (!s) return { code: 203, message: `Start Coordinates of(${start.x.toFixed(6)}, ${start.y.toFixed(6)}) was outside bounds` };
  const gm = g.toMap(goal.x, goal.y);
  if (!gm) return { code: 204, message: `Goal Coordinates of(${goal.x.toFixed(6)}, ${goal.y.toFixed(6)}) was outside bounds` };
  if (tolerance === 0 && g.data[gm[1] * W + gm[0]] === LETHAL) return { code: 206, message: `Goal Coordinates of(${goal.x.toFixed(6)}, ${goal.y.toFixed(6)}) was in lethal cost` };
  const passable = (c) => c < INSCRIBED || (c === NO_INFO && allowUnknown);
  const stepCost = (c) => {
    if (kind === "smac" || kind === "theta") return 1 + (c === NO_INFO ? 252 : c) / 252 * costPenalty;
    return (50 + 0.8 * (c === NO_INFO ? 253 : c)) / 50;
  };
  // goals: the goal cell, else any passable cell within tolerance (NavFn's search around the goal)
  const goalSet = new Set(); const tc = Math.round(tolerance / g.res);
  if (passable(g.data[gm[1] * W + gm[0]])) goalSet.add(gm[1] * W + gm[0]);
  else for (let dy = -tc; dy <= tc; dy++) for (let dx = -tc; dx <= tc; dx++) { const x = gm[0] + dx, y = gm[1] + dy; if (x < 0 || y < 0 || x >= W || y >= H || Math.hypot(dx, dy) > tc) continue; if (passable(g.data[y * W + x])) goalSet.add(y * W + x); }
  if (!goalSet.size) return { code: 208, message: `Failed to create plan with tolerance of: ${tolerance.toFixed(6)}` };
  const useH = astar || kind === "smac" || kind === "theta";
  const hfun = (i) => (useH ? Math.hypot((i % W) - gm[0], ((i / W) | 0) - gm[1]) : 0);
  const dist = new Float32Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1);
  const si = s[1] * W + s[0]; dist[si] = 0;
  const heap = new Heap(); heap.push(hfun(si), si);
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = -1, best = -1, bestD = Infinity;
  const done = new Uint8Array(W * H);
  while (heap.size) {
    const i = heap.pop(); if (done[i]) continue; done[i] = 1;
    if (goalSet.has(i)) { const d = Math.hypot((i % W) - gm[0], ((i / W) | 0) - gm[1]); if (d < 1e-9) { found = i; break; } if (d < bestD) { bestD = d; best = i; } if (!useH && goalSet.size === 1) { found = i; break; } }
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy, len] of N8) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx, c = g.data[j]; if (done[j] || !passable(c)) continue;
      const nd = dist[i] + len * stepCost(c);
      if (nd < dist[j]) { dist[j] = nd; prev[j] = i; heap.push(nd + hfun(j), j); }
    }
    if (best >= 0 && useH && heap.size && heap.k[0] > dist[best] + 4 * tc) break;
  }
  if (found < 0) found = best;
  if (found < 0) return { code: 208, message: `Failed to create plan with tolerance of: ${tolerance.toFixed(6)}` };
  let cells = []; for (let i = found; i >= 0; i = prev[i]) cells.push([i % W, (i / W) | 0]); cells.reverse();
  if ((kind === "theta" || kind === "smac") && cells.length > 2) {   // any-angle / shortcutting: keep only the corners with line of sight between them
    const los = (a, b) => { for (const [x, y] of line(a[0], a[1], b[0], b[1])) if (!passable(g.data[y * W + x]) || g.data[y * W + x] > 200) return false; return true; };
    const keep = [cells[0]]; let k = 0;
    for (let j = 2; j < cells.length; j++) if (!los(cells[k], cells[j])) { keep.push(cells[j - 1]); k = j - 1; }
    keep.push(cells[cells.length - 1]); cells = keep;
  }
  // world points; smoothed (NavFn follows the potential gradient, which removes the 8-connected staircase)
  let pts = cells.map(([x, y]) => g.toWorld(x, y));
  if (kind !== "theta" && pts.length > 4) for (let it = 0; it < 3; it++) pts = pts.map((p, j) => (j === 0 || j === pts.length - 1 ? p : [(pts[j - 1][0] + 2 * p[0] + pts[j + 1][0]) / 4, (pts[j - 1][1] + 2 * p[1] + pts[j + 1][1]) / 4]));
  pts[0] = [start.x, start.y];
  if (found === gm[1] * W + gm[0]) pts[pts.length - 1] = [goal.x, goal.y];
  // resample at the costmap resolution
  const out = [pts[0]];
  for (let j = 1; j < pts.length; j++) { const a = out[out.length - 1], b = pts[j], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d < 1e-9) continue; const n = Math.max(1, Math.round(d / g.res)); for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  return { path: out };
}
export const pathLength = (pts, from = 0) => { let d = 0; for (let i = Math.max(1, from + 1); i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return d; };
export function closestIndex(pts, x, y, from = 0) { let bi = from, bd = Infinity; for (let i = from; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - x, pts[i][1] - y); if (d < bd) { bd = d; bi = i; } } return bi; }

// ---------------------------------------------------------------- local controllers
// dwb_core::DWBLocalPlanner: samples (vx, wz) reachable within acc limits over one control period, simulates sim_time,
// scores the critics of the parameter list with their scales (BaseObstacle, PathAlign, PathDist, GoalAlign, GoalDist,
// RotateToGoal, Oscillation, PreferForward, Twirling), the lowest total wins. Distances in cells, like dwb_critics.
export function dwbCommand(P, st) {
  const { pose, vel, path, cost, dt, goalPose, xyTol } = st;   // pose {x,y,yaw} in the costmap frame; cost(x,y) -> 0..255
  const crit = [].concat(P.critics || ["RotateToGoal", "Oscillation", "BaseObstacle", "GoalAlign", "PathAlign", "PathDist", "GoalDist"]);
  const sc = (n, d) => num((P[n] && P[n].scale) ?? P[`${n}.scale`], d);
  const maxV = num(P.max_vel_x, 0.26), minV = num(P.min_vel_x, 0), maxW = num(P.max_vel_theta, 1.0), accV = num(P.acc_lim_x, 2.5), decV = Math.abs(num(P.decel_lim_x, -2.5)), accW = num(P.acc_lim_theta, 3.2);
  const simT = num(P.sim_time, 1.7), nV = Math.max(1, num(P.vx_samples, 20)), nW = Math.max(1, num(P.vtheta_samples, 20)), gran = num(P.linear_granularity, 0.05);
  const res = st.res || 0.05;
  const gx = goalPose.x, gy = goalPose.y, dGoal = Math.hypot(gx - pose.x, gy - pose.y);
  // RotateToGoal: within xy_goal_tolerance only rotate (in place) towards the goal yaw
  if (crit.includes("RotateToGoal") && (dGoal <= xyTol || st.latched)) {
    const e = wrap(goalPose.yaw - pose.yaw), slow = num((P.RotateToGoal || {}).slowing_factor, 5);
    let w = Math.sign(e) * Math.min(maxW, Math.max(num(P.min_speed_theta, 0) || 0.2, Math.abs(e) * slow * 0.5));
    w = Math.max(vel.wz - accW * dt, Math.min(vel.wz + accW * dt, w));
    return { vx: 0, wz: w, rotating: true };
  }
  // local goal: the last path point inside the local costmap; forward point for the align critics
  const vLo = Math.max(minV, vel.vx - decV * dt), vHi = Math.min(maxV, vel.vx + accV * dt);
  const wLo = Math.max(-maxW, vel.wz - accW * dt), wHi = Math.min(maxW, vel.wz + accW * dt);
  const fwd = num((P.PathAlign || {}).forward_point_distance, 0.325);
  const local = st.localPath;   // path points inside the window, closest first
  const end = local[local.length - 1] || [gx, gy];
  // dwb_critics::MapGridCritic: distances (in cells) propagated through the local costmap from the path cells / from the
  // local goal cell; lethal, inscribed and unknown cells block the propagation (an unreachable cell scores high)
  const G = st.grid, far = G ? G.w + G.h : 0;
  const bfs = (seeds) => {
    const d = new Float32Array(G.w * G.h).fill(Infinity), q = [];
    for (const [x, y] of seeds) { const m = G.toMap(x, y); if (m && d[m[1] * G.w + m[0]] !== 0) { d[m[1] * G.w + m[0]] = 0; q.push(m[1] * G.w + m[0]); } }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % G.w, y = (i / G.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= G.w || ny >= G.h) continue; const j = ny * G.w + nx; if (d[j] !== Infinity) continue; const c = G.data[j]; if (c >= INSCRIBED) continue; d[j] = d[i] + 1; q.push(j); } }
    return d;
  };
  const pathD = G ? bfs(local) : null, goalD = G ? bfs([end]) : null;
  const look = (D, x, y, fallback) => { if (!D) return fallback(); const m = G.toMap(x, y); if (!m) return far; const v = D[m[1] * G.w + m[0]]; return Number.isFinite(v) ? v : far; };
  const dPath = (x, y) => look(pathD, x, y, () => { let b = Infinity; for (let i = 0; i < local.length; i += 2) { const d = (local[i][0] - x) ** 2 + (local[i][1] - y) ** 2; if (d < b) b = d; } return Math.sqrt(b) / res; });
  const dGoalCells = (x, y) => look(goalD, x, y, () => Math.hypot(end[0] - x, end[1] - y) / res);
  let best = null;
  for (let a = 0; a < nV; a++) {
    const vx = nV === 1 ? vHi : vLo + ((vHi - vLo) * a) / (nV - 1);
    for (let b = 0; b < nW; b++) {
      const wz = nW === 1 ? 0 : wLo + ((wHi - wLo) * b) / (nW - 1);
      if (Math.abs(vx) < num(P.min_speed_xy, 0) && Math.abs(wz) < num(P.min_speed_theta, 0)) continue;
      // simulate
      const steps = Math.max(2, Math.ceil(Math.max(Math.abs(vx) * simT / gran, Math.abs(wz) * simT / num(P.angular_granularity, 0.025), 4)));
      const h = simT / steps; let x = pose.x, y = pose.y, th = pose.yaw, obs = 0, bad = false;
      for (let k = 0; k < steps; k++) { th += wz * h; x += vx * Math.cos(th) * h; y += vx * Math.sin(th) * h; const c = cost(x, y); if (c >= INSCRIBED && c !== NO_INFO) { bad = true; break; } if (c !== NO_INFO) obs = Math.max(obs, c); }
      if (bad) { if (st.stats) st.stats.invalid++; continue; }
      if (st.stats) st.stats.valid++;
      let s = 0;
      if (crit.includes("BaseObstacle")) s += sc("BaseObstacle", 0.02) * obs;
      if (crit.includes("PathDist")) s += sc("PathDist", 32) * dPath(x, y);
      if (crit.includes("GoalDist")) s += sc("GoalDist", 24) * dGoalCells(x, y);
      const fx = x + fwd * Math.cos(th), fy = y + fwd * Math.sin(th);
      if (crit.includes("PathAlign") && dGoal > fwd * 2) s += sc("PathAlign", 32) * dPath(fx, fy);
      if (crit.includes("GoalAlign") && dGoal > fwd * 2) s += sc("GoalAlign", 24) * dGoalCells(fx, fy);
      if (crit.includes("PreferForward") && vx < 0) s += sc("PreferForward", 5) * 1;
      if (crit.includes("Twirling")) s += sc("Twirling", 0) * Math.abs(wz);
      if (crit.includes("Oscillation") && st.lastW !== undefined && Math.abs(vx) < 0.02 && Math.sign(wz) !== Math.sign(st.lastW) && Math.abs(st.lastW) > 0.05) s += 1e4;
      if (st.stats && (!st.stats.top || s < st.stats.top.s)) st.stats.top = { s, vx, wz, x, y, pd: dPath(x, y), gd: dGoalCells(x, y) };
      if (st.stats && Math.abs(vx - vHi) < 1e-9 && Math.abs(wz) < (wHi - wLo) / nW) st.stats.fast = { s, vx, wz, x, y, pd: dPath(x, y), gd: dGoalCells(x, y), obs };
      if (!best || s < best.s) best = { s, vx, wz };
    }
  }
  if (!best) return { vx: 0, wz: 0, noValid: true };
  return { vx: best.vx, wz: best.wz };
}
// nav2_regulated_pure_pursuit_controller (simplified): look-ahead carrot, curvature, regulation near obstacles / goal
export function rppCommand(P, st) {
  const { pose, vel, dt, goalPose, xyTol, cost } = st;
  const v0 = num(P.desired_linear_vel, 0.5), la = num(P.lookahead_dist, 0.6), minLa = num(P.min_lookahead_dist, 0.3), maxLa = num(P.max_lookahead_dist, 0.9);
  const useVel = bool(P.use_velocity_scaled_lookahead_dist, false), ltime = num(P.lookahead_time, 1.5);
  const dGoal = Math.hypot(goalPose.x - pose.x, goalPose.y - pose.y);
  if (dGoal <= xyTol || st.latched) { const e = wrap(goalPose.yaw - pose.yaw); return { vx: 0, wz: Math.sign(e) * Math.min(num(P.rotate_to_heading_angular_vel, 1.8), Math.abs(e) * 2), rotating: true }; }
  const L = useVel ? Math.min(maxLa, Math.max(minLa, Math.abs(vel.vx) * ltime)) : la;
  const local = st.localPath; let carrot = local[local.length - 1] || [goalPose.x, goalPose.y];
  for (const p of local) if (Math.hypot(p[0] - pose.x, p[1] - pose.y) >= L) { carrot = p; break; }
  const dx = carrot[0] - pose.x, dy = carrot[1] - pose.y, cx = Math.cos(-pose.yaw) * dx - Math.sin(-pose.yaw) * dy, cy = Math.sin(-pose.yaw) * dx + Math.cos(-pose.yaw) * dy;
  const ang = Math.atan2(cy, cx);
  if (bool(P.use_rotate_to_heading, true) && Math.abs(ang) > num(P.rotate_to_heading_min_angle, 0.785)) return { vx: 0, wz: Math.sign(ang) * num(P.rotate_to_heading_angular_vel, 1.8) };
  const d2 = cx * cx + cy * cy, curv = d2 > 1e-9 ? (2 * cy) / d2 : 0;
  let v = v0;
  if (bool(P.use_regulated_linear_velocity_scaling, true)) { const r = Math.abs(curv) > 1e-6 ? 1 / Math.abs(curv) : Infinity, rmin = num(P.regulated_linear_scaling_min_radius, 0.9); if (r < rmin) v *= r / rmin; }
  if (bool(P.use_cost_regulated_linear_velocity_scaling, true)) { const c = cost(pose.x, pose.y); if (c > 0 && c < INSCRIBED) v *= Math.max(0.3, 1 - c / 252); }
  const app = num(P.approach_velocity_scaling_dist, 0.6); if (dGoal < app) v *= Math.max(0.2, dGoal / app);
  v = Math.max(num(P.min_approach_linear_velocity, 0.05), v);
  v = Math.min(v, vel.vx + num(P.max_linear_accel, 2.5) * dt);
  // collision check ahead
  let x = pose.x, y = pose.y, th = pose.yaw; const w = v * curv;
  for (let k = 0; k < 10; k++) { th += w * 0.1; x += v * Math.cos(th) * 0.1; y += v * Math.sin(th) * 0.1; const c = cost(x, y); if (c >= INSCRIBED && c !== NO_INFO) return { vx: 0, wz: 0, noValid: true }; }
  return { vx: v, wz: Math.max(-num(P.max_angular_accel, 3.2) * 10, Math.min(num(P.max_angular_accel, 3.2) * 10, w)) };
}
// nav2_mppi_controller (Model Predictive Path Integral): sample trajectories, evaluate cost on costmap, softmax weights
export function mppiCommand(P, st) {
  const { pose, vel, path, cost, dt, goalPose, xyTol } = st;
  const dGoal = Math.hypot(goalPose.x - pose.x, goalPose.y - pose.y);
  const maxV = num(P.vx_max ?? P.max_vel_x, 0.5), minV = num(P.vx_min ?? P.min_vel_x, 0);
  const maxW = num(P.wz_max ?? P.max_vel_theta, 1.8);
  const batchSize = Math.max(8, num(P.batch_size, 32));
  const timeSteps = Math.max(6, num(P.time_steps, 15));
  const modelDt = num(P.model_dt, 0.05);
  const lambda = num(P.temperature, 0.3);

  if (dGoal <= xyTol || st.latched) {
    const e = wrap(goalPose.yaw - pose.yaw);
    return { vx: 0, wz: Math.sign(e) * Math.min(maxW, Math.abs(e) * 2.0), rotating: true };
  }
  const local = st.localPath;
  let target = local[local.length - 1] || [goalPose.x, goalPose.y];
  const lookahead = Math.min(1.2, Math.max(0.4, vel.vx * 1.5));
  for (const p of local) { if (Math.hypot(p[0] - pose.x, p[1] - pose.y) >= lookahead) { target = p; break; } }
  const dx = target[0] - pose.x, dy = target[1] - pose.y;
  const angleToTarget = wrap(Math.atan2(dy, dx) - pose.yaw);
  const nomV = Math.max(minV, Math.min(maxV, dGoal > 0.5 ? maxV : maxV * (dGoal / 0.5)));
  const nomW = Math.max(-maxW, Math.min(maxW, angleToTarget * 2.5));

  const trajectories = []; let minCost = Infinity;
  for (let i = 0; i < batchSize; i++) {
    const dv = (i === 0) ? 0 : ((Math.sin(i * 12.9898 + pose.x) * 43758.5453) % 1) * 0.4 - 0.2;
    const dw = (i === 0) ? 0 : ((Math.cos(i * 78.233 + pose.y) * 43758.5453) % 1) * 0.8 - 0.4;
    const vSample = Math.max(minV, Math.min(maxV, nomV + dv));
    const wSample = Math.max(-maxW, Math.min(maxW, nomW + dw));
    let x = pose.x, y = pose.y, th = pose.yaw, trajCost = 0, collision = false;
    for (let k = 0; k < timeSteps; k++) {
      th += wSample * modelDt; x += vSample * Math.cos(th) * modelDt; y += vSample * Math.sin(th) * modelDt;
      const c = cost(x, y);
      if (c >= INSCRIBED && c !== NO_INFO) { collision = true; break; }
      if (c > 0 && c < INSCRIBED) trajCost += c * 0.1;
      trajCost += Math.hypot(x - target[0], y - target[1]) * 2.0;
    }
    if (collision) trajCost = 1e6; else if (trajCost < minCost) minCost = trajCost;
    trajectories.push({ v: vSample, w: wSample, cost: trajCost, collision });
  }
  let sumWeight = 0, weightedV = 0, weightedW = 0;
  for (const tr of trajectories) {
    if (tr.collision) continue;
    const w = Math.exp(-(tr.cost - minCost) / lambda);
    sumWeight += w; weightedV += w * tr.v; weightedW += w * tr.w;
  }
  if (sumWeight <= 1e-6 || minCost >= 1e6) return { vx: 0, wz: 0, noValid: true };
  return { vx: weightedV / sumWeight, wz: weightedW / sumWeight };
}

// ---------------------------------------------------------------- AMCL (nav2_amcl: likelihood field + differential motion model)
// distance (m) from every cell to the nearest occupied cell, capped at maxDist (map_t's likelihood field)
export function distanceField(grid, maxDist) {
  const W = grid.width, H = grid.height, res = grid.resolution, cap = Math.ceil(maxDist / res);
  const d = new Float32Array(W * H).fill(maxDist), q = [], src = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) if (grid.data[i] >= 65) { d[i] = 0; src[i] = i; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0, s = src[i], sx = s % W, sy = (s / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx, cd = Math.hypot(nx - sx, ny - sy); if (cd > cap) continue;
      if (cd * res < d[j] - 1e-6) { d[j] = cd * res; src[j] = s; q.push(j); }
    }
  }
  return d;
}
export class ParticleFilter {
  constructor(P, grid, rng = Math.random) {
    this.P = P; this.grid = grid; this.rng = rng;
    this.min = Math.max(1, num(P.min_particles, 500)); this.max = Math.max(this.min, num(P.max_particles, 2000));
    this.field = distanceField(grid, num(P.laser_likelihood_max_dist, 2.0));
    this.ps = [];
  }
  init(mean, cov) {   // pf_init with the pose's covariance (x, y, yaw variances)
    const sx = Math.sqrt(Math.max(cov[0], 1e-6)), sy = Math.sqrt(Math.max(cov[7], 1e-6)), sa = Math.sqrt(Math.max(cov[35], 1e-6));
    this.ps = Array.from({ length: this.max }, () => ({ x: mean.x + gauss(this.rng) * sx, y: mean.y + gauss(this.rng) * sy, yaw: wrap(mean.yaw + gauss(this.rng) * sa), w: 1 / this.max }));
    this.est = { ...mean }; this.cov = cov.slice();
  }
  motion(d0, d1) {   // nav2_amcl::DifferentialMotionModel (alpha1..alpha4)
    const P = this.P, a1 = num(P.alpha1, 0.2), a2 = num(P.alpha2, 0.2), a3 = num(P.alpha3, 0.2), a4 = num(P.alpha4, 0.2);
    const dx = d1.x - d0.x, dy = d1.y - d0.y, trans = Math.hypot(dx, dy);
    const rot1 = trans < 0.01 ? 0 : wrap(Math.atan2(dy, dx) - d0.yaw), rot2 = wrap(d1.yaw - d0.yaw - rot1);
    const r1n = Math.min(Math.abs(wrap(rot1)), Math.abs(wrap(rot1 - Math.PI))), r2n = Math.min(Math.abs(wrap(rot2)), Math.abs(wrap(rot2 - Math.PI)));
    for (const p of this.ps) {
      const r1 = rot1 - gauss(this.rng) * Math.sqrt(a1 * r1n * r1n + a2 * trans * trans), t = trans - gauss(this.rng) * Math.sqrt(a3 * trans * trans + a4 * (r1n * r1n + r2n * r2n)), r2 = rot2 - gauss(this.rng) * Math.sqrt(a1 * r2n * r2n + a2 * trans * trans);
      p.x += t * Math.cos(p.yaw + r1); p.y += t * Math.sin(p.yaw + r1); p.yaw = wrap(p.yaw + r1 + r2);
    }
  }
  sensor(beams, laserOffset) {   // beams: [[range, angle (laser frame)], ...]; likelihood_field model
    const P = this.P, zh = num(P.z_hit, 0.5), zr = num(P.z_rand, 0.5), sig = num(P.sigma_hit, 0.2), rmax = beams.rangeMax || 3.5, g = this.grid, W = g.width, H = g.height, res = g.resolution, maxD = num(P.laser_likelihood_max_dist, 2.0);
    let total = 0;
    for (const p of this.ps) {
      const lx = p.x + Math.cos(p.yaw) * laserOffset.x - Math.sin(p.yaw) * laserOffset.y, ly = p.y + Math.sin(p.yaw) * laserOffset.x + Math.cos(p.yaw) * laserOffset.y, la = p.yaw + laserOffset.yaw;
      let w = 1;
      for (const [r, a] of beams) {
        if (!(r < rmax)) continue;
        const ex = lx + r * Math.cos(la + a), ey = ly + r * Math.sin(la + a);
        const mx = Math.floor((ex - g.origin[0]) / res), my = Math.floor((ey - g.origin[1]) / res);
        const z = mx < 0 || my < 0 || mx >= W || my >= H ? maxD : this.field[my * W + mx];
        const pz = zh * Math.exp(-(z * z) / (2 * sig * sig)) + zr / rmax;
        w += pz * pz * pz;
      }
      p.w *= w; total += p.w;
    }
    if (total > 0) for (const p of this.ps) p.w /= total;
    this.estimate();
  }
  estimate() {
    let sx = 0, sy = 0, sc = 0, ss = 0, sw = 0;
    for (const p of this.ps) { sx += p.w * p.x; sy += p.w * p.y; sc += p.w * Math.cos(p.yaw); ss += p.w * Math.sin(p.yaw); sw += p.w; }
    if (!(sw > 0)) return;
    const m = { x: sx / sw, y: sy / sw, yaw: Math.atan2(ss, sc) };
    let vx = 0, vy = 0, vxy = 0; for (const p of this.ps) { vx += p.w * (p.x - m.x) ** 2; vy += p.w * (p.y - m.y) ** 2; vxy += p.w * (p.x - m.x) * (p.y - m.y); }
    const R = Math.sqrt(sc * sc + ss * ss) / sw;
    const cov = Array(36).fill(0); cov[0] = vx / sw; cov[7] = vy / sw; cov[1] = cov[6] = vxy / sw; cov[35] = -2 * Math.log(Math.max(1e-9, Math.min(1, R)));
    this.est = m; this.cov = cov;
  }
  resample() {   // low-variance resampling; the set shrinks towards min_particles as it converges (KLD-like)
    const spread = Math.sqrt(this.cov[0] + this.cov[7]);
    const n = Math.round(Math.max(this.min, Math.min(this.max, this.min + (this.max - this.min) * Math.min(1, spread / 0.5))));
    const out = [], step = 1 / n; let r = this.rng() * step, c = this.ps[0].w, i = 0;
    for (let m = 0; m < n; m++) { const u = r + m * step; while (u > c && i < this.ps.length - 1) { i++; c += this.ps[i].w; } const p = this.ps[i]; out.push({ x: p.x, y: p.y, yaw: p.yaw, w: 1 / n }); }
    this.ps = out;
  }
}

// ---------------------------------------------------------------- occupancy grid mapping (slam_toolbox / cartographer models)
// log-odds grid that grows as scans arrive: a scan in the map frame (sensor pose + end points) updates hits / misses
export class MappingGrid {
  constructor(res, size = 8) { this.res = res; this.w = Math.round(size / res); this.h = this.w; this.ox = -size / 2; this.oy = -size / 2; this.lo = new Float32Array(this.w * this.h); this.seen = new Uint8Array(this.w * this.h); }
  ensure(x, y) {
    const pad = 1.0;
    let { ox, oy, w, h } = this, nx0 = ox, ny0 = oy, nx1 = ox + w * this.res, ny1 = oy + h * this.res;
    if (x - pad < nx0) nx0 = Math.floor((x - pad - 2) / this.res) * this.res; if (y - pad < ny0) ny0 = Math.floor((y - pad - 2) / this.res) * this.res;
    if (x + pad > nx1) nx1 = Math.ceil((x + pad + 2) / this.res) * this.res; if (y + pad > ny1) ny1 = Math.ceil((y + pad + 2) / this.res) * this.res;
    if (nx0 === ox && ny0 === oy && nx1 === ox + w * this.res && ny1 === oy + h * this.res) return;
    const W2 = Math.round((nx1 - nx0) / this.res), H2 = Math.round((ny1 - ny0) / this.res), lo = new Float32Array(W2 * H2), seen = new Uint8Array(W2 * H2);
    const dx = Math.round((ox - nx0) / this.res), dy = Math.round((oy - ny0) / this.res);
    for (let r = 0; r < h; r++) { lo.set(this.lo.subarray(r * w, r * w + w), (r + dy) * W2 + dx); seen.set(this.seen.subarray(r * w, r * w + w), (r + dy) * W2 + dx); }
    Object.assign(this, { ox: nx0, oy: ny0, w: W2, h: H2, lo, seen });
  }
  insert(sensor, points, maxRange, missRay = null) {
    this.ensure(sensor.x, sensor.y);
    for (const [px, py, r] of points) { const rr = Math.min(r, maxRange); this.ensure(sensor.x + ((px - sensor.x) * rr) / r, sensor.y + ((py - sensor.y) * rr) / r); }
    const cell = (x, y) => [Math.floor((x - this.ox) / this.res), Math.floor((y - this.oy) / this.res)];
    const s = cell(sensor.x, sensor.y);
    const upd = (cx, cy, d) => { if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return; const i = cy * this.w + cx; this.lo[i] = Math.max(-4, Math.min(4, this.lo[i] + d)); this.seen[i] = 1; };
    for (const [px, py, r] of points) {
      const hit = r <= maxRange, rr = hit ? r : missRay ?? maxRange;
      const ex = sensor.x + ((px - sensor.x) * rr) / r, ey = sensor.y + ((py - sensor.y) * rr) / r, e = cell(ex, ey);
      for (const [cx, cy] of line(s[0], s[1], e[0], e[1])) upd(cx, cy, -0.4);
      if (hit) upd(e[0], e[1], 0.9);
    }
  }
  toGrid(frame = "map") {
    const d = new Int8Array(this.w * this.h);
    for (let i = 0; i < d.length; i++) d[i] = !this.seen[i] ? -1 : this.lo[i] >= 0.5 ? 100 : 0;   // trinary, like slam_toolbox / cartographer_occupancy_grid_node
    return { width: this.w, height: this.h, resolution: this.res, origin: [this.ox, this.oy, 0], data: d, frame };
  }
  known() { let n = 0; for (const s of this.seen) n += s; return n; }
}

export function rotationShimCommand(P, st) {
  const { pose, goalPose, xyTol } = st;
  const dGoal = Math.hypot(goalPose.x - pose.x, goalPose.y - pose.y);
  if (dGoal <= xyTol || st.latched) return dwbCommand(P, st);
  const local = st.localPath;
  const target = local[Math.min(2, local.length - 1)] || [goalPose.x, goalPose.y];
  const ang = wrap(Math.atan2(target[1] - pose.y, target[0] - pose.x) - pose.yaw);
  const minAngle = num(P.rotate_to_heading_min_angle, 0.785);
  if (Math.abs(ang) > minAngle) {
    return { vx: 0, wz: Math.sign(ang) * num(P.rotate_to_heading_angular_vel, 1.8), rotating: true };
  }
  const prim = P.primary_controller || "DWB";
  return prim === "RPP" ? rppCommand(P, st) : dwbCommand(P, st);
}

export function gracefulCommand(P, st) {
  const { pose, goalPose, xyTol } = st;
  const dGoal = Math.hypot(goalPose.x - pose.x, goalPose.y - pose.y);
  if (dGoal <= xyTol || st.latched) return { vx: 0, wz: 0 };
  const local = st.localPath;
  const target = local[Math.min(3, local.length - 1)] || [goalPose.x, goalPose.y];
  const dx = target[0] - pose.x, dy = target[1] - pose.y;
  const r = Math.hypot(dx, dy);
  const alpha = wrap(Math.atan2(dy, dx) - pose.yaw);
  const kPhi = num(P.k_phi, 1.0), kDelta = num(P.k_delta, 1.0), beta = num(P.beta, 0.4), lambda = num(P.lambda, 2.0);
  const kappa = (1 / Math.max(0.01, r)) * (-kDelta * (alpha - Math.atan(-kPhi * alpha)) + (1 + kPhi / (1 + (kPhi * alpha) ** 2)) * Math.sin(alpha));
  const vMax = num(P.max_vel_x, 0.26), wMax = num(P.max_vel_theta, 1.0);
  const v = Math.max(0.05, vMax * Math.min(1.0, r / 0.6) / (1 + beta * Math.abs(kappa) ** lambda));
  const w = Math.max(-wMax, Math.min(wMax, v * kappa));
  return { vx: v, wz: w };
}
