// The real ROS 2 Jazzy interface definitions (.msg / .srv / .action), read from the official repositories
// (tools/build-ifaces.py -> robots/ros-ifaces.json). Used by `ros2 interface show / proto / list / package(s)`,
// by `ros2 topic pub`, `ros2 service call`, `ros2 action send_goal` to read and check the YAML a student types,
// and by Tab completion (message types and the YAML prototype after the type).
let DB = null, loading = null;
const cache = new Map();
const extra = new Map();   // interfaces of packages built in the student's workspace (custom .msg/.srv/.action)

export function loadIfaces(base = "") {
  if (DB) return Promise.resolve(DB);
  if (!loading) loading = fetch(`${base}/robots/ros-ifaces.json`).then((r) => (r.ok ? r.json() : {})).then((j) => (DB = j)).catch(() => (DB = {}));
  return loading;
}
export const ifacesReady = () => !!DB;
export function setIfaces(db) { DB = db; cache.clear(); }
export function addWorkspaceIfaces(map) { for (const [k, v] of Object.entries(map || {})) extra.set(k, v); }
const raw = (t) => (extra.has(t) ? extra.get(t) : DB ? DB[t] : undefined);

// geometry_msgs/Twist -> geometry_msgs/msg/Twist (ros2 CLI accepts both for messages)
export function normType(t, kind = "msg") {
  const s = String(t || "").trim();
  if (/^[\w]+\/(msg|srv|action)\/\w+$/.test(s)) return s;
  const m = s.match(/^(\w+)\/(\w+)$/);
  return m ? `${m[1]}/${kind}/${m[2]}` : s;
}
export const hasIface = (t) => raw(t) !== undefined;
export function allIfaces() { return [...new Set([...(DB ? Object.keys(DB) : []), ...extra.keys()])].sort(); }
export function ifacePackages() { return [...new Set(allIfaces().map((k) => k.split("/")[0]))].sort(); }
export function ifaceText(t) { return raw(t); }

// ---------- parsing a definition ----------
const PRIM = new Set(["bool", "byte", "char", "float32", "float64", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "string", "wstring"]);
function resolveType(pkg, t) {
  const base = t.replace(/<=\d+$/, "");
  if (PRIM.has(base)) return base;
  if (base === "Header") return "std_msgs/msg/Header";
  const m = base.match(/^(\w+)\/(\w+)$/);
  return m ? `${m[1]}/msg/${m[2]}` : `${pkg}/msg/${base}`;
}
// one section of a definition -> fields and constants
function parseSection(pkg, text) {
  const fields = [], consts = [];
  for (const line0 of String(text || "").split("\n")) {
    const line = line0.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([\w/]+(?:<=\d+)?)(\[(<=)?(\d*)\])?\s+(\w+)\s*(=)?\s*(.*)$/);
    if (!m) continue;
    const [, type, arr, bounded, n, name, eq, rest] = m;
    const f = { type: resolveType(pkg, type), rawType: type, name, array: !!arr, fixed: arr && !bounded && n ? +n : null, bound: bounded ? +n : null };
    if (eq) consts.push({ ...f, value: rest.trim() });
    else { if (rest.trim()) f.default = rest.trim(); fields.push(f); }
  }
  return { fields, consts };
}

export function definition(t) {
  if (cache.has(t)) return cache.get(t);
  const r = raw(t); if (r === undefined) return null;
  const pkg = t.split("/")[0], parts = r.split(/^---\s*$/m);
  const d = { type: t, kind: t.split("/")[1], sections: parts.map((p) => parseSection(pkg, p)) };
  cache.set(t, d);
  return d;
}
// the section types of a service / action, as message-like types: Spawn_Request, Fibonacci_Goal, ...
export function sectionType(t, which) {
  const d = definition(t); if (!d) return null;
  const idx = d.kind === "srv" ? { request: 0, response: 1 }[which] : { goal: 0, result: 1, feedback: 2 }[which];
  return d.sections[idx] ? { type: `${t}_${which}`, def: d.sections[idx] } : null;
}
const defOf = (t) => (typeof t === "object" ? t.def : (definition(t) || { sections: [{ fields: [], consts: [] }] }).sections[0]);
const nameOf = (t) => (typeof t === "object" ? t.type : t);

// ---------- ros2 interface show ----------
export function showLines(t, { noComments = false, allComments = false } = {}) {
  const r = raw(t); if (r === undefined) return null;
  const pkg = t.split("/")[0], out = [];
  const nested = (type, depth, seen) => {
    const sub = raw(type); if (sub === undefined) return;
    for (const l of sub.split("\n")) {
      const code = l.replace(/#.*$/, "").replace(/\s+$/, "");
      if (!code.trim()) { if (allComments && l.trim()) out.push("\t".repeat(depth) + l.trim()); continue; }
      out.push("\t".repeat(depth) + (allComments ? l.trim() : code.trim()));
      const m = code.trim().match(/^([\w/]+)(\[[^\]]*\])?\s+\w+\s*(?!=)/);
      if (m && !/=/.test(code)) { const ft = resolveType(type.split("/")[0], m[1]); if (!PRIM.has(ft) && !seen.has(ft)) nested(ft, depth + 1, new Set([...seen, ft])); }
    }
  };
  for (const l of r.split("\n")) {
    const code = l.replace(/#.*$/, "").replace(/\s+$/, "");
    if (noComments && !code.trim()) { if (/^---/.test(l)) out.push("---"); continue; }
    out.push(noComments ? code : l.replace(/\s+$/, ""));
    if (/^---/.test(l.trim())) continue;
    const m = code.trim().match(/^([\w/]+)(\[[^\]]*\])?\s+\w+/);
    if (m && !/=/.test(code)) { const ft = resolveType(pkg, m[1].replace(/<=\d+$/, "")); if (!PRIM.has(ft)) nested(ft, 1, new Set([ft])); }
  }
  return out;
}

// ---------- default values and prototypes ----------
function primDefault(type) { return type === "bool" ? false : /^(string|wstring)$/.test(type) ? "" : /^float/.test(type) ? 0.0 : 0; }
function parseLiteral(type, s) {
  if (s === undefined) return primDefault(type);
  if (type === "bool") return /^(true|1)$/i.test(s);
  if (/string/.test(type)) return s.replace(/^["']|["']$/g, "");
  return Number(s);
}
export function defaultValue(t) {
  const d = defOf(t), o = {};
  for (const f of d.fields) {
    if (f.array) {
      if (f.default) { try { o[f.name] = JSON.parse(f.default.replace(/'/g, '"')); } catch { o[f.name] = []; } }
      else o[f.name] = f.fixed ? Array.from({ length: f.fixed }, () => (PRIM.has(f.type) ? primDefault(f.type) : defaultValue(f.type))) : [];
    } else o[f.name] = PRIM.has(f.type) ? parseLiteral(f.type, f.default) : defaultValue(f.type);
  }
  return o;
}
const isFloatT = (t) => /^float/.test(t);
function scalarYaml(type, v) {
  if (typeof v === "string") return /string/.test(type) ? `'${v}'` : v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (isFloatT(type)) return Number.isInteger(v) ? `${v}.0` : String(v);
  return String(v);
}
// ros2 interface proto: block-style YAML in double quotes
export function protoBlock(t) {
  const lines = [];
  const walk = (tt, v, ind) => {
    for (const f of defOf(tt).fields) {
      const val = v[f.name];
      if (f.array) lines.push(`${ind}${f.name}: ${Array.isArray(val) && val.length ? `[${val.map((x) => scalarYaml(f.type, x)).join(", ")}]` : "[]"}`);
      else if (PRIM.has(f.type)) lines.push(`${ind}${f.name}: ${scalarYaml(f.type, val)}`);
      else { lines.push(`${ind}${f.name}:`); walk(f.type, val, ind + "  "); }
    }
  };
  walk(t, defaultValue(t), "");
  return lines;
}
// one-line flow style, handy on a single command line: "{linear: {x: 0.0, ...}, angular: {...}}"
export function protoFlow(t) {
  const walk = (tt, v) => `{${defOf(tt).fields.map((f) => {
    const val = v[f.name];
    if (f.array) return `${f.name}: [${(val || []).map((x) => (PRIM.has(f.type) ? scalarYaml(f.type, x) : walk(f.type, x))).join(", ")}]`;
    return `${f.name}: ${PRIM.has(f.type) ? scalarYaml(f.type, val) : walk(f.type, val)}`;
  }).join(", ")}}`;
  return walk(t, defaultValue(t));
}

// ---------- the YAML a student types after the type ----------
// A small YAML reader for what the ros2 CLI accepts: flow mappings / sequences, plain scalars, and simple block style.
export function parseYaml(src) {
  const s = String(src ?? "").trim();
  if (!s) return {};
  if (/\n/.test(s) && !/^[{[]/.test(s)) return parseBlock(s.split("\n"));
  if (!/^[{[]/.test(s) && /^\w[\w ]*:\s/.test(s) && !/[{[]/.test(s.split(":")[0])) return parseFlow(`{${s}}`);
  return parseFlow(s);
}
function scalar(tok) {
  const t = tok.trim();
  if (/^(['"]).*\1$/.test(t)) return t.slice(1, -1);
  if (/^(true|True|TRUE)$/.test(t)) return true;
  if (/^(false|False|FALSE)$/.test(t)) return false;
  if (/^(null|~|Null|NULL)$/.test(t)) return null;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return Number(t);
  if (/^[-+]?\.(inf|Inf|INF)$/.test(t)) return t.startsWith("-") ? -Infinity : Infinity;
  return t;
}
function parseFlow(s) {
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const err = (m) => { throw new Error(`${m} at character ${i}`); };
  function value() {
    ws();
    if (s[i] === "{") { i++; const o = {}; ws(); if (s[i] === "}") { i++; return o; }
      for (;;) { ws(); const k = key(); ws(); if (s[i] !== ":") err("expected ':'"); i++; o[k] = value(); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "}") { i++; return o; } err("expected ',' or '}'"); } }
    if (s[i] === "[") { i++; const a = []; ws(); if (s[i] === "]") { i++; return a; }
      for (;;) { a.push(value()); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "]") { i++; return a; } err("expected ',' or ']'"); } }
    if (s[i] === "'" || s[i] === '"') { const q = s[i++]; let out = ""; while (i < s.length && s[i] !== q) out += s[i++]; if (s[i] !== q) err("unclosed quote"); i++; return out; }
    let tok = ""; while (i < s.length && !/[,}\]]/.test(s[i])) tok += s[i++];
    return scalar(tok);
  }
  function key() { let k = ""; if (s[i] === "'" || s[i] === '"') { const q = s[i++]; while (i < s.length && s[i] !== q) k += s[i++]; i++; return k; } while (i < s.length && !/[:,}]/.test(s[i])) k += s[i++]; return k.trim(); }
  const v = value(); ws(); if (i < s.length) err("unexpected text");
  return v;
}
function parseBlock(lines) {
  const L = lines.filter((l) => l.trim() && !/^\s*#/.test(l)).map((l) => ({ ind: l.match(/^ */)[0].length, t: l.trim() }));
  let i = 0;
  function block(ind) {
    if (i < L.length && L[i].t.startsWith("- ")) { const a = []; while (i < L.length && L[i].ind === ind && L[i].t.startsWith("- ")) { const t = L[i].t.slice(2); i++; a.push(/^[{[]/.test(t) ? parseFlow(t) : scalar(t)); } return a; }
    const o = {};
    while (i < L.length && L[i].ind === ind) {
      const m = L[i].t.match(/^([^:]+):\s*(.*)$/); if (!m) throw new Error(`cannot read "${L[i].t}"`);
      i++;
      if (m[2]) o[m[1].trim()] = /^[{[]/.test(m[2]) ? parseFlow(m[2]) : scalar(m[2]);
      else o[m[1].trim()] = i < L.length && L[i].ind > ind ? block(L[i].ind) : null;
    }
    return o;
  }
  return block(L.length ? L[0].ind : 0);
}

// ---------- filling a message from YAML, the way rosidl_runtime_py.set_message_fields does ----------
const INT_RANGE = { int8: [-128, 127], uint8: [0, 255], byte: [0, 255], char: [0, 255], int16: [-32768, 32767], uint16: [0, 65535], int32: [-2147483648, 2147483647], uint32: [0, 4294967295], int64: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], uint64: [0, Number.MAX_SAFE_INTEGER] };
const shortName = (t) => nameOf(t).split("/").pop();
export function buildMessage(t, value, { now = () => ({ sec: 0, nanosec: 0 }) } = {}) {
  const fill = (tt, v, path) => {
    const base = defaultValue(tt);
    if (v === null || v === undefined || v === "") return base;
    if (typeof v !== "object" || Array.isArray(v)) throw new Error(`Failed to populate field: Value '${Array.isArray(v) ? `[${v}]` : v}' is not a dictionary${path ? ` (field '${path}')` : ""}`);
    const d = defOf(tt);
    if (nameOf(tt) === "std_msgs/msg/Header" || nameOf(tt) === "builtin_interfaces/msg/Time") { /* handled below */ }
    for (const [k, val] of Object.entries(v)) {
      const f = d.fields.find((x) => x.name === k);
      if (!f) throw new Error(`Failed to populate field: '${shortName(tt)}' object has no attribute '${k}'`);
      if (f.type === "builtin_interfaces/msg/Time" && val === "now") { base[k] = now(); continue; }
      if (f.type === "std_msgs/msg/Header" && val === "auto") { base[k] = { stamp: now(), frame_id: "" }; continue; }
      if (f.array) {
        if (!Array.isArray(val)) throw new Error(`Failed to populate field: The '${k}' field must be a sequence`);
        if (f.fixed && val.length !== f.fixed) throw new Error(`Failed to populate field: The '${k}' field must be a sequence with length ${f.fixed}`);
        if (f.bound && val.length > f.bound) throw new Error(`Failed to populate field: The '${k}' field must be a sequence with length <= ${f.bound}`);
        base[k] = val.map((x) => (PRIM.has(f.type) ? prim(f.type, x, k) : fill(f.type, x, k)));
      } else base[k] = PRIM.has(f.type) ? prim(f.type, val, k) : fill(f.type, val, k);
    }
    return base;
  };
  const prim = (type, v, k) => {
    if (type === "bool") { if (typeof v === "boolean") return v; if (v === 0 || v === 1) return !!v; throw new Error(`Failed to populate field: The '${k}' field must be of type 'bool'`); }
    if (/string/.test(type)) return typeof v === "string" ? v : String(v);
    if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`Failed to populate field: The '${k}' field must be of type '${isFloatT(type) ? "float" : "int"}'`);
    if (!isFloatT(type)) {
      if (!Number.isInteger(v)) throw new Error(`Failed to populate field: The '${k}' field must be of type 'int'`);
      const r = INT_RANGE[type]; if (r && (v < r[0] || v > r[1])) throw new Error(`Failed to populate field: The '${k}' field must be an integer in [${r[0]}, ${r[1]}]`);
    }
    return v;
  };
  return fill(t, value, "");
}

// geometry_msgs.msg.Twist(linear=geometry_msgs.msg.Vector3(x=0.2, y=0.0, z=0.0), ...), as ros2 topic pub prints it
export function pyRepr(t, v) {
  const fmtNum = (type, x) => (isFloatT(type) ? (Number.isInteger(x) ? `${x}.0` : String(x)) : String(x));
  const one = (type, x) => (type === "bool" ? (x ? "True" : "False") : /string/.test(type) ? `'${x}'` : fmtNum(type, x));
  const walk = (tt, o) => {
    const nm = nameOf(tt), pyName = /_(request|response|goal|result|feedback)$/.test(nm) ? nm.replace(/\/(srv|action)\/(\w+)_(\w+)$/, (_, k, n, s) => `.${k}.${n}_${s[0].toUpperCase()}${s.slice(1)}`).replace(/\//g, ".") : nm.replace(/\//g, ".");
    return `${pyName}(${defOf(tt).fields.map((f) => {
      const x = o[f.name];
      if (f.array) return `${f.name}=${PRIM.has(f.type) && f.type !== "string" ? (f.fixed ? `array([${x.map((y) => one(f.type, y)).join(", ")}])` : x.length ? `array('${isFloatT(f.type) ? "d" : "i"}', [${x.map((y) => one(f.type, y)).join(", ")}])` : "[]") : `[${x.map((y) => (PRIM.has(f.type) ? one(f.type, y) : walk(f.type, y))).join(", ")}]`}`;
      return `${f.name}=${PRIM.has(f.type) ? one(f.type, x) : walk(f.type, x)}`;
    }).join(", ")})`;
  };
  return walk(t, v);
}

// ros2 topic echo style (block YAML)
export function echoLines(t, v) {
  const out = [];
  const num = (type, x) => (isFloatT(type) ? (Number.isInteger(x) ? `${x}.0` : String(x)) : String(x));
  const walk = (tt, o, ind) => {
    for (const f of defOf(tt).fields) {
      const x = o[f.name];
      if (f.array) {
        if (!x.length) { out.push(`${ind}${f.name}: []`); continue; }
        out.push(`${ind}${f.name}:`);
        for (const y of x) {
          if (PRIM.has(f.type)) out.push(`${ind}- ${/string/.test(f.type) ? y : f.type === "bool" ? String(y) : num(f.type, y)}`);
          else { const start = out.length; walk(f.type, y, ind + "  "); if (out[start]) out[start] = `${ind}- ${out[start].slice(ind.length + 2)}`; }
        }
      } else if (PRIM.has(f.type)) out.push(`${ind}${f.name}: ${/string/.test(f.type) ? (x === "" ? "''" : x) : f.type === "bool" ? String(x) : num(f.type, x)}`);
      else { out.push(`${ind}${f.name}:`); walk(f.type, x, ind + "  "); }
    }
  };
  walk(t, v, "");
  return out;
}

// ros2 topic echo --no-arr: rosidl_runtime_py's message_to_ordereddict(no_arr=True) prints every array / sequence
// field as '<sequence type: T, length: N>' or '<array type: T[N]>', with T the IDL type name (float32 -> float,
// float64 -> double, bool -> boolean, byte -> octet, messages pkg/msg/Name). Works on the block-YAML text of a
// message; the length of a sequence the sample truncated ("- '...'", truncate_length 128) comes from the message's
// own size fields where the type has them.
const IDL = { float32: "float", float64: "double", bool: "boolean", byte: "octet", char: "uint8" };
const SIZE = {
  "sensor_msgs/msg/Image": { data: (v) => v.step * v.height },
  "sensor_msgs/msg/CompressedImage": {},
  "sensor_msgs/msg/PointCloud2": { data: (v) => v.row_step * v.height },
  "sensor_msgs/msg/LaserScan": { ranges: (v) => Math.round((v.angle_max - v.angle_min) / v.angle_increment) + 1 },
  "nav_msgs/msg/OccupancyGrid": { data: (v) => v["info.width"] * v["info.height"] },
  "map_msgs/msg/OccupancyGridUpdate": { data: (v) => v.width * v.height },
};
export function noArrYaml(t, text) {
  const lines = String(text).split("\n"), out = [];
  const typeName = (f) => (PRIM.has(f.type) ? (/string/.test(f.type) ? f.type : IDL[f.type] || f.type) : f.type);
  const walk = (tt, from, to, ind, path, vals) => {   // lines [from, to) are the fields of one message at indent ind
    const d = definition(tt); if (!d) { out.push(...lines.slice(from, to)); return; }
    const fields = d.sections[0].fields;
    for (let i = from; i < to;) {
      const l = lines[i], m = l.startsWith(ind) ? l.slice(ind.length).match(/^(\w+):(?: (.*))?$/) : null;
      let j = i + 1; while (j < to && (lines[j].startsWith(ind + " ") || lines[j].startsWith(ind + "- "))) j++;
      const f = m && fields.find((x) => x.name === m[1]);
      if (!f) { out.push(...lines.slice(i, j)); i = j; continue; }
      if (!f.array) {
        if (m[2] !== undefined) { vals[path + f.name] = Number(m[2]); out.push(l); }
        else { out.push(l); const sub = {}; walk(f.type, i + 1, j, ind + "  ", "", sub); for (const [k, v] of Object.entries(sub)) vals[`${f.name}.${k}`] = v; }
        i = j; continue;
      }
      let n;
      if (m[2] !== undefined) { const s = m[2].trim(); n = s === "[]" ? 0 : s.startsWith("[") ? s.slice(1, -1).split(",").length : 1; }
      else {
        const items = lines.slice(i + 1, j).filter((x) => x.startsWith(ind + "- "));
        const cut = items.length && items[items.length - 1] === `${ind}- '...'`;
        n = items.length - (cut ? 1 : 0);
        if (cut) { const g = (SIZE[tt] || {})[f.name] || (f.name === "intensities" && SIZE[tt] && SIZE[tt].ranges); const v = g ? g(vals) : NaN; if (Number.isFinite(v)) n = v; }
      }
      out.push(`${ind}${f.name}: '${f.fixed ? `<array type: ${typeName(f)}[${f.fixed}]>` : `<sequence type: ${typeName(f)}, length: ${n}>`}'`);
      i = j;
    }
  };
  walk(t, 0, lines.length, "", "", {});
  return out.join("\n");
}
