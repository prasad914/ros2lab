// ROS2Lab URDF core: a small XML reader, a xacro processor, a URDF parser with
// check_urdf-style validation, forward kinematics for TF, and a flow-YAML reader
// for `ros2 topic pub`. Plain JavaScript (no DOM), so it runs in the browser and in Node.

// ------------------------------------------------------------------ XML
export class XmlError extends Error {}
const lineAt = (s, i) => s.slice(0, i).split("\n").length;
export function parseXML(text) {
  const s = String(text);
  let i = 0;
  const root = { tag: "#doc", attrs: {}, children: [] };
  const stack = [root];
  const ent = (v) => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    const txt = s.slice(i, lt < 0 ? s.length : lt);
    if (txt.trim()) stack[stack.length - 1].children.push({ tag: "#text", text: ent(txt) });
    if (lt < 0) break;
    if (s.startsWith("<!--", lt)) { const e = s.indexOf("-->", lt); if (e < 0) throw new XmlError(`line ${lineAt(s, lt)}: a comment <!-- is never closed with -->`); i = e + 3; continue; }
    if (s.startsWith("<?", lt)) { const e = s.indexOf("?>", lt); i = e < 0 ? s.length : e + 2; continue; }
    if (s.startsWith("<!", lt)) { const e = s.indexOf(">", lt); i = e + 1; continue; }
    const gt = s.indexOf(">", lt);
    if (gt < 0) throw new XmlError(`line ${lineAt(s, lt)}: a tag is never closed with >`);
    const body = s.slice(lt + 1, gt);
    if (body.startsWith("/")) {
      const name = body.slice(1).trim();
      const open = stack.pop();
      if (!open || open.tag !== name) throw new XmlError(`line ${lineAt(s, lt)}: closing tag </${name}> does not match <${open ? open.tag : "?"}> (opened on line ${open ? open.line : "?"})`);
      i = gt + 1; continue;
    }
    const self = body.endsWith("/");
    const inner = self ? body.slice(0, -1) : body;
    const m = inner.match(/^\s*([\w:.-]+)/);
    if (!m) throw new XmlError(`line ${lineAt(s, lt)}: a tag has no name`);
    const node = { tag: m[1], attrs: {}, children: [], line: lineAt(s, lt) };
    const rest = inner.slice(m[0].length);
    const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a, used = 0;
    while ((a = re.exec(rest))) { node.attrs[a[1]] = ent(a[3] !== undefined ? a[3] : a[4]); used += a[0].length; }
    const leftover = rest.replace(re, "").trim();
    if (leftover) throw new XmlError(`line ${node.line}: in <${node.tag}> the text "${leftover.slice(0, 30)}" is not a valid attribute (attributes look like name="value")`);
    stack[stack.length - 1].children.push(node);
    if (!self) stack.push(node);
    i = gt + 1;
  }
  if (stack.length > 1) { const open = stack[stack.length - 1]; throw new XmlError(`line ${open.line}: <${open.tag}> is opened but never closed`); }
  const top = root.children.filter((c) => c.tag !== "#text");
  if (top.length !== 1) throw new XmlError(top.length ? "the file must have exactly one top-level element (<robot>)" : "the file is empty");
  return top[0];
}
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export function toXML(n, ind = "") {
  if (n.tag === "#text") return ind + n.text.trim();
  const at = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
  const kids = n.children.filter((c) => c.tag !== "#text" || c.text.trim());
  if (!kids.length) return `${ind}<${n.tag}${at}/>`;
  return `${ind}<${n.tag}${at}>\n${kids.map((c) => toXML(c, ind + "  ")).join("\n")}\n${ind}</${n.tag}>`;
}

// ------------------------------------------------------------------ safe expressions for ${...}
const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, sqrt: Math.sqrt,
  abs: Math.abs, pow: Math.pow, radians: (d) => (d * Math.PI) / 180, degrees: (r) => (r * 180) / Math.PI, floor: Math.floor, ceil: Math.ceil,
  min: Math.min, max: Math.max, round: Math.round, int: Math.trunc, float: Number, str: String };
export function evalExpr(src, lookup) {
  const toks = [];
  const re = /\s*(\d+\.\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?|\d+(?:[eE][-+]?\d+)?|[A-Za-z_]\w*|\*\*|==|!=|<=|>=|'[^']*'|"[^"]*"|[-+*/%(),<>.\[\]])/y;
  let m, k = 0;
  while (k < src.length) {
    re.lastIndex = k; m = re.exec(src);
    if (!m) { if (!src.slice(k).trim()) break; throw new Error(`cannot read "${src.slice(k).trim()}" in \${${src}}`); }
    toks.push(m[1]); k = re.lastIndex;
  }
  let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  const expect = (t) => { if (next() !== t) throw new Error(`expected "${t}" in \${${src}}`); };
  const primary = () => {
    const t = next();
    if (t === undefined) throw new Error(`\${${src}} ends too early`);
    if (t === "(") { const v = or(); expect(")"); return v; }
    if (t === "-") return -unary();
    if (t === "+") return +unary();
    if (/^\d|^\./.test(t)) return Number(t);
    if (/^['"]/.test(t)) return t.slice(1, -1);
    if (t === "pi") return Math.PI;
    if (t === "e" && peek() !== "(") return Math.E;
    if (t === "True" || t === "true") return true;
    if (t === "False" || t === "false") return false;
    if (t === "not") return !unary();
    if (peek() === "(") {
      next(); const args = [];
      if (peek() !== ")") { args.push(or()); while (peek() === ",") { next(); args.push(or()); } }
      expect(")");
      if (!FUN[t]) throw new Error(`name '${t}' is not defined (unknown function)`);
      return FUN[t](...args);
    }
    const v = lookup(t);
    if (v === undefined) throw new Error(`name '${t}' is not defined`);
    return v;
  };
  // attribute access and subscripts: xacro.load_yaml(file)['key'], dict['k']['j'], list[0]
  const postfix = () => {
    let v = primary();
    for (;;) {
      if (peek() === "[") { next(); const k = or(); expect("]"); if (v === null || v === undefined || !(k in Object(v))) throw new Error(`KeyError: ${JSON.stringify(k)} in \${${src}}`); v = v[k]; continue; }
      if (peek() === ".") {
        next(); const name = next(); let f = v == null ? undefined : v[name];
        if (peek() === "(") { next(); const args = []; if (peek() !== ")") { args.push(or()); while (peek() === ",") { next(); args.push(or()); } } expect(")"); if (typeof f !== "function") throw new Error(`'${name}' is not a function in \${${src}}`); v = f(...args); continue; }
        if (f === undefined) throw new Error(`no attribute '${name}' in \${${src}}`); v = f; continue;
      }
      return v;
    }
  };
  const unary = () => postfix();
  const power = () => { let v = unary(); while (peek() === "**") { next(); v = Math.pow(v, unary()); } return v; };
  const term = () => { let v = power(); while (["*", "/", "%"].includes(peek())) { const o = next(), r = power(); v = o === "*" ? v * r : o === "/" ? v / r : v % r; } return v; };
  const sum = () => { let v = term(); while (["+", "-"].includes(peek())) { const o = next(), r = term(); v = o === "+" ? (typeof v === "string" || typeof r === "string" ? `${v}${r}` : v + r) : v - r; } return v; };
  const cmp = () => { let v = sum(); while (["<", ">", "<=", ">=", "==", "!="].includes(peek())) { const o = next(), r = sum(); v = { "<": v < r, ">": v > r, "<=": v <= r, ">=": v >= r, "==": v == r, "!=": v != r }[o]; } return v; };
  const and = () => { let v = cmp(); while (peek() === "and") { next(); const r = cmp(); v = v && r; } return v; };
  const or = () => { let v = and(); while (peek() === "or") { next(); const r = and(); v = v || r; } return v; };
  const v = or();
  if (p < toks.length) throw new Error(`unexpected "${toks[p]}" in \${${src}}`);
  return v;
}
const numStr = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)))) : typeof v === "boolean" ? (v ? "true" : "false") : String(v));
const asValue = (s) => { const t = String(s).trim(); return /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) ? Number(t) : t === "true" || t === "True" ? true : t === "false" || t === "False" ? false : s; };

// ------------------------------------------------------------------ xacro
export class XacroError extends Error {}
// a small block-style YAML reader (nested maps, "- item" lists, scalars, [flow, lists]) for xacro.load_yaml
export function blockYaml(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.replace(/\s+#.*$/, "").replace(/^#.*$/, "")).filter((l) => l.trim());
  const scalar = (v) => { const t = v.trim(); if (/^\[.*\]$/.test(t)) return t.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map(scalar); if (/^['"].*['"]$/.test(t)) return t.slice(1, -1); return asValue(t); };
  let i = 0;
  const block = (ind) => {
    let obj = null;
    while (i < lines.length) {
      const l = lines[i], d = l.length - l.trimStart().length; if (d < ind) break;
      const t = l.trim();
      if (t.startsWith("- ")) { obj = obj || []; i++; obj.push(scalar(t.slice(2))); continue; }
      const m = t.match(/^([^:]+):\s*(.*)$/); if (!m) { i++; continue; }
      obj = obj || {}; i++;
      if (m[2] !== "") obj[m[1].trim().replace(/^['"]|['"]$/g, "")] = scalar(m[2]);
      else { const nd = i < lines.length ? lines[i].length - lines[i].trimStart().length : 0; obj[m[1].trim()] = nd > d ? block(nd) : null; }
    }
    return obj;
  };
  return block(0) || {};
}
// files(path) -> text or undefined ; find(pkg) -> share dir path ; args: {name: value}
export function xacro(text, { args = {}, files = () => undefined, find = () => undefined, path = "" } = {}) {
  const XA = "xacro:";
  const argv = { ...args };
  // the xacro module as expressions see it: xacro.load_yaml(file) (MoveIt configs read initial_positions.yaml this way)
  const xacroMod = { load_yaml: (f) => { const t = files(String(f)); if (t === undefined) throw new XacroError(`No such file or directory: ${f}`); return blockYaml(t); } };
  const scopeLookup = (scope) => (name) => { for (let s = scope; s; s = s.__parent) if (Object.prototype.hasOwnProperty.call(s, name)) return s[name]; return name === "xacro" ? xacroMod : undefined; };
  const subst = (str, scope, where) => {
    let out = String(str);
    out = out.replace(/\$\(\s*(arg|find|env)\s+([^)\s]+)\s*\)/g, (_, kind, a) => {
      if (kind === "arg") { if (!(a in argv)) throw new XacroError(`${where}: Undefined substitution argument ${a} (declare it with <xacro:arg name="${a}" default="..."/>)`); return String(argv[a]); }
      if (kind === "find") { const d = find(a); if (!d) throw new XacroError(`${where}: package not found: ${a} (did you build it and source install/setup.bash?)`); return d; }
      return "";
    });
    const whole = out.match(/^\$\{([^}]*)\}$/);
    if (whole) { try { return { value: evalExpr(whole[1], scopeLookup(scope)) }; } catch (e) { throw new XacroError(`${where}: ${e.message}`); } }
    out = out.replace(/\$\{([^}]*)\}/g, (_, ex) => { try { return numStr(evalExpr(ex, scopeLookup(scope))); } catch (e) { throw new XacroError(`${where}: ${e.message}`); } });
    return { value: out };
  };
  const str = (v, scope, where) => { const r = subst(v, scope, where); return numStr(r.value); };
  const macros = {};
  const truthy = (v) => v === true || v === 1 || v === "1" || v === "true" || v === "True";
  const expand = (nodes, scope, out, depth = 0) => {
    if (depth > 60) throw new XacroError("macros call each other too deeply (more than 60 levels)");
    for (const n of nodes) {
      if (n.tag === "#text") { out.push({ tag: "#text", text: str(n.text, scope, "text") }); continue; }
      const where = `line ${n.line} <${n.tag}>`;
      if (n.tag === XA + "property") {
        if (!n.attrs.name) throw new XacroError(`${where}: property needs a name`);
        const raw = n.attrs.value !== undefined ? subst(n.attrs.value, scope, where).value : "";
        scope[n.attrs.name] = typeof raw === "string" ? asValue(raw) : raw;
        continue;
      }
      if (n.tag === XA + "arg") { if (!(n.attrs.name in argv)) argv[n.attrs.name] = n.attrs.default !== undefined ? str(n.attrs.default, scope, where) : undefined; if (argv[n.attrs.name] === undefined) delete argv[n.attrs.name]; continue; }
      if (n.tag === XA + "macro") {
        const params = [...String(n.attrs.params || "").matchAll(/(\*{0,2}[\w]+)(?::=('[^']*'|"[^"]*"|\S+))?/g)].map((m) => (m[2] !== undefined ? `${m[1]}:=${m[2].replace(/^['"]|['"]$/g, "")}` : m[1]));
        macros[n.attrs.name] = { params, body: n.children, scope }; continue;
      }
      if (n.tag === XA + "include") {
        const fn = str(n.attrs.filename || "", scope, where);
        const full = fn.startsWith("/") ? fn : (path ? path.replace(/[^/]*$/, "") : "") + fn;
        const t = files(full);
        if (t === undefined) throw new XacroError(`${where}: No such file or directory: ${fn}`);
        let doc;
        try { doc = parseXML(t); } catch (e) { throw new XacroError(`${fn}: ${e.message}`); }
        expand(doc.children, scope, out, depth + 1);
        continue;
      }
      if (n.tag === XA + "if" || n.tag === XA + "unless") {
        const r = subst(n.attrs.value === undefined ? "" : n.attrs.value, scope, where).value;
        let v = truthy(r) || (typeof r === "number" && r !== 0);
        if (!(r === true || r === false || r === 0 || r === 1 || ["true", "false", "True", "False", "0", "1"].includes(String(r)))) throw new XacroError(`${where}: Xacro conditional "${n.attrs.value}" evaluated to "${r}", which is not a boolean expression.`);
        if (n.tag === XA + "unless") v = !v;
        if (v) expand(n.children, scope, out, depth + 1);
        continue;
      }
      if (n.tag.startsWith(XA)) {
        const name = n.tag.slice(XA.length);
        const mac = macros[name];
        if (!mac) throw new XacroError(`${where}: unknown macro name: ${n.tag} (is the macro defined above this line, or is the name spelled differently?)`);
        const local = { __parent: mac.scope };
        for (const pdef of mac.params) {
          const cut = pdef.indexOf(":="), pn = cut < 0 ? pdef : pdef.slice(0, cut), def = cut < 0 ? undefined : pdef.slice(cut + 2);
          const clean = pn.replace(/^\*+/, "");
          if (n.attrs[clean] !== undefined) { const r = subst(n.attrs[clean], scope, where).value; local[clean] = typeof r === "string" ? asValue(r) : r; }
          else if (def !== undefined) { const r = subst(def.replace(/^\^\|?/, ""), mac.scope, where).value; local[clean] = typeof r === "string" ? asValue(r) : r; }
          else throw new XacroError(`${where}: Undefined parameters [${clean}] (give it like <xacro:${name} ${clean}="..."/>)`);
        }
        const extra = Object.keys(n.attrs).filter((a) => !mac.params.some((p) => p.split(":=")[0].replace(/^\*+/, "") === a));
        if (extra.length) throw new XacroError(`${where}: Invalid parameters [${extra.join(", ")}] for macro ${name}`);
        expand(mac.body, local, out, depth + 1);
        continue;
      }
      const copy = { tag: n.tag, attrs: {}, children: [], line: n.line };
      for (const [k, v] of Object.entries(n.attrs)) if (!k.startsWith("xmlns:")) copy.attrs[k] = str(v, scope, where);
      expand(n.children, scope, copy.children, depth);
      out.push(copy);
    }
  };
  let doc;
  try { doc = parseXML(text); } catch (e) { throw new XacroError(e.message); }
  const scope = { __parent: null };
  const top = { tag: doc.tag, attrs: {}, children: [] };
  for (const [k, v] of Object.entries(doc.attrs)) if (!k.startsWith("xmlns:")) top.attrs[k] = v;
  expand(doc.children, scope, top.children);
  return `<?xml version="1.0" ?>\n` + toXML(top) + "\n";
}

// ------------------------------------------------------------------ URDF
const nums = (s, n, def) => { if (s === undefined) return def.slice(); const v = String(s).trim().split(/\s+/).map(Number); return v.length === n && v.every((x) => Number.isFinite(x)) ? v : null; };
export class UrdfError extends Error {}
export function parseURDF(text) {
  let doc;
  try { doc = parseXML(text); } catch (e) { throw new UrdfError(`Error parsing XML: ${e.message}`); }
  if (doc.tag !== "robot") throw new UrdfError(`Error: Could not find the 'robot' element in the xml file (found <${doc.tag}>)`);
  if (!doc.attrs.name) throw new UrdfError("Error: No name given for the robot.");
  const warnings = [];
  const kids = (n, tag) => n.children.filter((c) => c.tag === tag);
  const one = (n, tag) => kids(n, tag)[0];
  const origin = (n, where) => {
    const o = one(n, "origin");
    if (!o) return { xyz: [0, 0, 0], rpy: [0, 0, 0] };
    const xyz = nums(o.attrs.xyz, 3, [0, 0, 0]), rpy = nums(o.attrs.rpy, 3, [0, 0, 0]);
    if (!xyz) throw new UrdfError(`Error: ${where}: origin xyz="${o.attrs.xyz}" must be three numbers like "0 0 0.1"`);
    if (!rpy) throw new UrdfError(`Error: ${where}: origin rpy="${o.attrs.rpy}" must be three numbers (radians) like "0 0 1.5708"`);
    if (rpy.some((v) => Math.abs(v) > 6.3)) warnings.push(`${where}: rpy="${o.attrs.rpy}" is very large. URDF angles are in RADIANS (90 degrees = 1.5708).`);
    return { xyz, rpy };
  };
  const materials = {};
  const color = (m) => { const c = m && one(m, "color"); const v = c ? nums(c.attrs.rgba, 4, [0.8, 0.8, 0.8, 1]) : null; return v; };
  for (const m of kids(doc, "material")) materials[m.attrs.name] = { color: color(m) || [0.8, 0.8, 0.8, 1] };
  const geometry = (g, where) => {
    if (!g) throw new UrdfError(`Error: ${where}: missing <geometry>`);
    const s = g.children.find((c) => c.tag !== "#text");
    if (!s) throw new UrdfError(`Error: ${where}: <geometry> is empty (use box, cylinder, sphere or mesh)`);
    if (s.tag === "box") { const size = nums(s.attrs.size, 3, null); if (!size) throw new UrdfError(`Error: ${where}: box needs size="x y z"`); return { type: "box", size }; }
    if (s.tag === "cylinder") { const r = Number(s.attrs.radius), l = Number(s.attrs.length); if (!(r > 0) || !(l > 0)) throw new UrdfError(`Error: ${where}: cylinder needs radius and length (both > 0)`); return { type: "cylinder", radius: r, length: l }; }
    if (s.tag === "sphere") { const r = Number(s.attrs.radius); if (!(r > 0)) throw new UrdfError(`Error: ${where}: sphere needs radius > 0`); return { type: "sphere", radius: r }; }
    if (s.tag === "mesh") { if (!s.attrs.filename) throw new UrdfError(`Error: ${where}: mesh needs filename`); return { type: "mesh", filename: s.attrs.filename, scale: nums(s.attrs.scale, 3, [1, 1, 1]) || [1, 1, 1] }; }
    throw new UrdfError(`Error: ${where}: unknown geometry <${s.tag}> (use box, cylinder, sphere or mesh)`);
  };
  const links = {}, joints = {};
  for (const l of kids(doc, "link")) {
    const name = l.attrs.name;
    if (!name) throw new UrdfError("Error: No name given for the link.");
    if (links[name]) throw new UrdfError(`Error: link '${name}' is not unique.`);
    const visuals = kids(l, "visual").map((v, i) => {
      const mat = one(v, "material");
      let rgba = null;
      if (mat) { rgba = color(mat) || (materials[mat.attrs.name] ? materials[mat.attrs.name].color : null); if (!rgba && mat.attrs.name) warnings.push(`link '${name}': material '${mat.attrs.name}' is not defined, so it is shown grey`); }
      return { origin: origin(v, `link '${name}' visual`), geom: geometry(one(v, "geometry"), `link '${name}' visual ${i + 1}`), rgba };
    });
    const collisions = kids(l, "collision").map((c, i) => ({ origin: origin(c, `link '${name}' collision`), geom: geometry(one(c, "geometry"), `link '${name}' collision ${i + 1}`) }));
    let inertial = null;
    const inn = one(l, "inertial");
    if (inn) {
      const m = one(inn, "mass"), I = one(inn, "inertia");
      // urdfdom (what RViz and robot_state_publisher use) needs a numeric <mass value>; zero is accepted (Gazebo then ignores the link's dynamics)
      if (!m || m.attrs.value === undefined || !Number.isFinite(Number(m.attrs.value))) throw new UrdfError(`Error: link '${name}': <inertial> needs <mass value="..."/>`);
      if (!(Number(m.attrs.value) > 0)) warnings.push(`link '${name}': mass is ${m.attrs.value}; physics engines need a mass greater than 0`);
      if (!I) throw new UrdfError(`Error: link '${name}': <inertial> needs <inertia ixx=... iyy=... izz=.../>`);
      const iv = ["ixx", "ixy", "ixz", "iyy", "iyz", "izz"].map((k) => Number(I.attrs[k] || 0));
      if (iv[0] <= 0 || iv[3] <= 0 || iv[5] <= 0) warnings.push(`link '${name}': ixx, iyy and izz should all be greater than 0`);
      inertial = { mass: Number(m.attrs.value), origin: origin(inn, `link '${name}' inertial`), inertia: iv };
    }
    links[name] = { name, visuals, collisions, inertial };
  }
  if (!Object.keys(links).length) throw new UrdfError("Error: No link elements found in urdf file");
  const TYPES = ["fixed", "revolute", "continuous", "prismatic", "floating", "planar"];
  for (const j of kids(doc, "joint")) {
    const name = j.attrs.name, type = j.attrs.type;
    if (!name) throw new UrdfError("Error: unnamed joint found");
    if (joints[name]) throw new UrdfError(`Error: joint '${name}' is not unique.`);
    if (!TYPES.includes(type)) throw new UrdfError(`Error: Joint [${name}] has no known type [${type}] (use fixed, revolute, continuous, prismatic, floating or planar)`);
    const par = one(j, "parent"), ch = one(j, "child");
    if (!par || !par.attrs.link) throw new UrdfError(`Error: Joint [${name}] is missing a parent link specification.`);
    if (!ch || !ch.attrs.link) throw new UrdfError(`Error: Joint [${name}] is missing a child link specification.`);
    if (!links[par.attrs.link]) throw new UrdfError(`Error: parent link [${par.attrs.link}] of joint [${name}] not found. This is not valid according to the URDF spec. Every link you refer to from a joint needs to be explicitly defined in the robot description.`);
    if (!links[ch.attrs.link]) throw new UrdfError(`Error: child link [${ch.attrs.link}] of joint [${name}] not found. This is not valid according to the URDF spec. Every link you refer to from a joint needs to be explicitly defined in the robot description.`);
    const ax = one(j, "axis");
    let axis = ax ? nums(ax.attrs.xyz, 3, null) : [1, 0, 0];
    if (!axis) throw new UrdfError(`Error: Joint [${name}]: axis xyz="${ax.attrs.xyz}" must be three numbers`);
    const len = Math.hypot(...axis);
    if (["revolute", "continuous", "prismatic", "planar"].includes(type) && len < 1e-9) throw new UrdfError(`Error: Joint [${name}]: axis cannot be 0 0 0`);
    if (len > 1e-9) axis = axis.map((v) => v / len);
    const lim = one(j, "limit");
    let limit = null;
    if (type === "revolute" || type === "prismatic") {
      if (!lim) throw new UrdfError(`Error: Joint [${name}] is of type REVOLUTE or PRISMATIC but it does not specify limits`);
      if (lim.attrs.effort === undefined || lim.attrs.velocity === undefined) throw new UrdfError(`Error: Joint [${name}]: <limit> needs effort="..." and velocity="..." as well as lower and upper`);
      limit = { lower: Number(lim.attrs.lower || 0), upper: Number(lim.attrs.upper || 0), effort: Number(lim.attrs.effort), velocity: Number(lim.attrs.velocity) };
      if (limit.lower > limit.upper) warnings.push(`joint '${name}': lower limit (${limit.lower}) is greater than upper limit (${limit.upper})`);   // urdfdom accepts it; the joint cannot move
    }
    const mim = one(j, "mimic");
    joints[name] = { name, type, parent: par.attrs.link, child: ch.attrs.link, origin: origin(j, `joint '${name}'`), axis, limit,
      mimic: mim ? { joint: mim.attrs.joint, multiplier: Number(mim.attrs.multiplier ?? 1), offset: Number(mim.attrs.offset ?? 0) } : null };
  }
  for (const j of Object.values(joints)) if (j.mimic && !joints[j.mimic.joint]) throw new UrdfError(`Error: Joint [${j.name}] mimics joint [${j.mimic.joint}], which does not exist`);
  const parentOf = {};
  for (const j of Object.values(joints)) {
    if (parentOf[j.child]) throw new UrdfError(`Error: link '${j.child}' has two parents: joints '${parentOf[j.child].name}' and '${j.name}'. A link can only have one parent.`);
    parentOf[j.child] = j;
  }
  const roots = Object.keys(links).filter((l) => !parentOf[l]);
  if (roots.length > 1) throw new UrdfError(`Error: Failed to find root link: Two root links found: [${roots[0]}] and [${roots[1]}]${roots.length > 2 ? ` (and ${roots.length - 2} more)` : ""}. Connect them with a joint.`);
  if (!roots.length) throw new UrdfError("Error: Failed to find root link: there is a loop (every link has a parent). URDF must be a tree.");
  const childJoints = {};
  for (const j of Object.values(joints)) (childJoints[j.parent] = childJoints[j.parent] || []).push(j);
  const reached = new Set(); const walk = (l) => { reached.add(l); for (const j of childJoints[l] || []) walk(j.child); }; walk(roots[0]);
  if (reached.size !== Object.keys(links).length) throw new UrdfError("Error: the links do not form a single tree (there is a loop).");
  return { name: doc.attrs.name, links, joints, materials, root: roots[0], childJoints, parentOf, warnings };
}
export const movableJoints = (model) => Object.values(model.joints).filter((j) => !["fixed", "floating", "planar"].includes(j.type) && !j.mimic);   // joint_state_publisher skips fixed, floating and planar joints

export function checkUrdfText(model) {
  const L = [`robot name is: ${model.name}`, "---------- Successfully Parsed XML ---------------", ];
  const kids = (l) => (model.childJoints[l] || []).map((j) => j.child).sort();
  L.push(`root Link: ${model.root} has ${kids(model.root).length} child(ren)`);
  const rec = (l, ind) => kids(l).forEach((c, i) => { L.push(`${ind}child(${i + 1}):  ${c}`); rec(c, ind + "    "); });
  rec(model.root, "    ");
  return L;
}
export function graphviz(model) {
  const L = ["digraph G {", 'node [shape=box];'];
  for (const l of Object.keys(model.links)) L.push(`"${l}" [label="${l}"];`);
  L.push('node [shape=ellipse, color=blue, fontcolor=blue];');
  for (const j of Object.values(model.joints)) L.push(`"${j.parent}" -> "${j.name}" [label="xyz: ${j.origin.xyz.join(" ")} \\nrpy: ${j.origin.rpy.join(" ")}"]`, `"${j.name}" -> "${j.child}"`);
  L.push("}");
  return L.join("\n") + "\n";
}

// ------------------------------------------------------------------ math + forward kinematics
export function qRPY(r, p, y) { const cr = Math.cos(r / 2), sr = Math.sin(r / 2), cp = Math.cos(p / 2), sp = Math.sin(p / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2); return [sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy, cr * cp * cy + sr * sp * sy]; }
export function qMul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
export function qRot(q, v) { const p = qMul(qMul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [p[0], p[1], p[2]]; }
export const qAxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
export const tMul = (A, B) => { const r = qRot(A.q, B.t); return { t: [A.t[0] + r[0], A.t[1] + r[1], A.t[2] + r[2]], q: qMul(A.q, B.q) }; };
export const tInv = (A) => { const qi = [-A.q[0], -A.q[1], -A.q[2], A.q[3]], r = qRot(qi, A.t); return { t: [-r[0], -r[1], -r[2]], q: qi }; };
export const IDENT = { t: [0, 0, 0], q: [0, 0, 0, 1] };
export function quatToRPY(q) { const [x, y, z, w] = q; return [Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)), Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))), Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))]; }

// joint value with mimic
export function jointValue(model, values, j) { if (j.mimic) return (Number(values[j.mimic.joint]) || 0) * j.mimic.multiplier + j.mimic.offset; return Number(values[j.name]) || 0; }
// Transform of each joint (parent link frame -> child link frame) for given joint values.
export function jointTransform(model, j, values) {
  const base = { t: j.origin.xyz.slice(), q: qRPY(...j.origin.rpy) };
  const v = jointValue(model, values, j);
  if (j.type === "revolute" || j.type === "continuous") return tMul(base, { t: [0, 0, 0], q: qAxis(j.axis, v) });
  if (j.type === "prismatic") return tMul(base, { t: j.axis.map((a) => a * v), q: [0, 0, 0, 1] });
  return base;
}
// Edges for TF: fixed joints -> /tf_static; moving joints -> /tf only when joint states are published.
export function urdfEdges(model, values, haveStates) {
  const E = [];
  for (const j of Object.values(model.joints)) {
    // robot_state_publisher (kdl_parser) turns floating and planar joints into fixed ones: /tf_static at their origin
    const moving = j.type !== "fixed" && j.type !== "floating" && j.type !== "planar";
    if (moving && !haveStates) continue;
    const T = jointTransform(model, j, values);
    E.push({ parent: j.parent, child: j.child, t: T.t, q: T.q, static: !moving });
  }
  return E;
}
// Pose of every frame relative to a chosen fixed frame, from TF edges. Returns {poses, missing, err}
export function framePoses(edges, fixed) {
  const childMap = {}, parentEdge = {};
  for (const e of edges) { (childMap[e.parent] = childMap[e.parent] || []).push(e); parentEdge[e.child] = e; }
  const frames = new Set(); edges.forEach((e) => { frames.add(e.parent); frames.add(e.child); });
  if (!frames.has(fixed)) return { poses: { [fixed]: IDENT }, err: `Frame [${fixed}] does not exist`, frames: [...frames] };
  const root = (f) => { let c = f, g = 0; while (parentEdge[c] && g++ < 200) c = parentEdge[c].parent; return c; };
  const world = {};
  const walk = (f, T) => { world[f] = T; for (const e of childMap[f] || []) walk(e.child, tMul(T, { t: e.t, q: e.q })); };
  for (const f of frames) if (!parentEdge[f]) walk(f, IDENT);
  const r = root(fixed), inv = tInv(world[fixed]);
  const poses = {};
  for (const f of frames) if (root(f) === r) poses[f] = tMul(inv, world[f]);
  return { poses, frames: [...frames] };
}

// ------------------------------------------------------------------ flow YAML ({a: 1, b: [1, 2], c: {d: 'x'}})
export function parseFlowYaml(src) {
  const s = String(src).trim(); let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const val = () => {
    ws();
    if (s[i] === "{") { i++; const o = {}; ws(); if (s[i] === "}") { i++; return o; }
      for (;;) { ws(); const k = key(); ws(); if (s[i] !== ":") throw new Error(`expected ':' after ${k}`); i++; o[k] = val(); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "}") { i++; return o; } throw new Error("expected ',' or '}'"); } }
    if (s[i] === "[") { i++; const a = []; ws(); if (s[i] === "]") { i++; return a; }
      for (;;) { a.push(val()); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "]") { i++; return a; } throw new Error("expected ',' or ']'"); } }
    if (s[i] === "'" || s[i] === '"') { const q = s[i++]; const j = s.indexOf(q, i); const t = s.slice(i, j); i = j + 1; return t; }
    const m = s.slice(i).match(/^[^,}\]]+/); const t = m ? m[0].trim() : ""; i += m ? m[0].length : 0;
    return asValue(t);
  };
  const key = () => { ws(); if (s[i] === "'" || s[i] === '"') { const q = s[i++]; const j = s.indexOf(q, i); const t = s.slice(i, j); i = j + 1; return t; } const m = s.slice(i).match(/^[\w.]+/); if (!m) throw new Error("expected a field name"); i += m[0].length; return m[0]; };
  const v = val(); ws(); if (i < s.length) throw new Error(`unexpected text "${s.slice(i, i + 15)}"`);
  return v;
}

// ------------------------------------------------------------------ markers
export const MARKER_TYPES = ["ARROW", "CUBE", "SPHERE", "CYLINDER", "LINE_STRIP", "LINE_LIST", "CUBE_LIST", "SPHERE_LIST", "POINTS", "TEXT_VIEW_FACING", "MESH_RESOURCE", "TRIANGLE_LIST", "ARROW_STRIP"];
// Normalise a (partial) visualization_msgs/Marker dict and list the problems RViz would show.
export function normMarker(m) {
  const g = (o, k, d) => (o && o[k] !== undefined ? o[k] : d);
  const pose = g(m, "pose", {}), pos = g(pose, "position", {}), ori = g(pose, "orientation", {}), sc = g(m, "scale", {}), col = g(m, "color", {});
  const out = { frame: g(g(m, "header", {}), "frame_id", ""), ns: g(m, "ns", ""), id: Number(g(m, "id", 0)), type: Number(g(m, "type", 0)), action: Number(g(m, "action", 0)),
    p: [Number(g(pos, "x", 0)), Number(g(pos, "y", 0)), Number(g(pos, "z", 0))], q: [Number(g(ori, "x", 0)), Number(g(ori, "y", 0)), Number(g(ori, "z", 0)), Number(g(ori, "w", 0))],
    s: [Number(g(sc, "x", 0)), Number(g(sc, "y", 0)), Number(g(sc, "z", 0))], c: [Number(g(col, "r", 0)), Number(g(col, "g", 0)), Number(g(col, "b", 0)), Number(g(col, "a", 0))],
    points: (g(m, "points", []) || []).map((p) => [Number(g(p, "x", 0)), Number(g(p, "y", 0)), Number(g(p, "z", 0))]), text: String(g(m, "text", "")) };
  const problems = [];
  if (!out.frame) problems.push("header.frame_id is empty");
  if (!(out.type >= 0 && out.type <= 12)) problems.push(`unknown marker type ${out.type}`);
  const qn = Math.hypot(...out.q);
  if (qn < 1e-9) { problems.push("orientation is all zero; using w = 1 (set pose.orientation.w: 1.0)"); out.q = [0, 0, 0, 1]; } else out.q = out.q.map((v) => v / qn);
  if (out.c[3] <= 0) problems.push("color.a (alpha) is 0, so the marker is invisible");
  const needS = [4, 5].includes(out.type) ? [0] : out.type === 9 ? [2] : out.type === 8 || ((out.type === 0 || out.type === 12) && out.points.length) ? [0, 1] : [0, 1, 2];
  if (out.action === 0 && needS.some((k) => !(out.s[k] > 0))) problems.push(`scale ${needS.map((k) => "xyz"[k]).join("/")} must be greater than 0`);
  if ([4, 5, 6, 7, 8, 11, 12].includes(out.type) && out.action === 0 && !out.points.length) problems.push("this marker type needs points");
  return { marker: out, problems };
}
