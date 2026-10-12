#!/usr/bin/env node
// Builds the site's model of an installed ROS 2 Jazzy (/opt/ros/jazzy):
//   public/ros/jazzy/index.json   { distro, packages: { <name>: { exes: [...], share: bool } } }
//   public/ros/jazzy/share.zip    REAL installed share/ files (launch, config, params, maps, rviz, urdf, worlds ...)
//                                 + python modules (python/<module>/...) that the robot workspaces' launch files use
//   public/ros/jazzy/SOURCES.json repo + commit (+ rosdistro release version) of every package listed
//
// Source of truth: ros/rosdistro jazzy/distribution.yaml (package -> repository + released version), ros2/variants
// (desktop_full ...), and each repository's package.xml / CMakeLists.txt / setup.py at the released tag on GitHub.
// Nothing is invented: executables come from the install() rules of CMakeLists.txt and from setup.py
// console_scripts; share files are copied the way `colcon build` + `make install` would install them.
//
// Usage: node tools/build-ros-share.mjs [--cache DIR] [--jobs N] [--offline]
//   needs: git, python3 (PyYAML) on PATH; network access to github.com.
// The module also exports the package scanners used by tools/fetch-workspaces.mjs.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");

// ----------------------------------------------------------------------------------------------------------------
// package.xml
// ----------------------------------------------------------------------------------------------------------------
const DEP_TAGS = ["depend", "build_depend", "build_export_depend", "buildtool_depend", "buildtool_export_depend",
  "exec_depend", "run_depend", "test_depend", "doc_depend"];

function evalCondition(cond) {
  if (!cond) return true;
  let s = cond.replace(/\$ROS_VERSION\b/g, "2").replace(/\$ROS_DISTRO\b/g, "jazzy")
    .replace(/\$ROS_PYTHON_VERSION\b/g, "3").replace(/\$[A-Z_]+/g, "");
  // tokenise: words / quoted / operators / parens
  const toks = s.match(/"[^"]*"|'[^']*'|==|!=|>=|<=|>|<|\(|\)|[^\s()=!<>]+/g) || [];
  let i = 0;
  const val = (t) => t.replace(/^["']|["']$/g, "");
  function atom() {
    const t = toks[i++];
    if (t === "(") { const v = orE(); i++; return v; }
    const a = val(t || "");
    const op = toks[i];
    if (["==", "!=", ">=", "<=", ">", "<"].includes(op)) {
      i++; const b = val(toks[i++] || "");
      const na = Number(a), nb = Number(b), num = !isNaN(na) && !isNaN(nb);
      const A = num ? na : a, B = num ? nb : b;
      return op === "==" ? A === B : op === "!=" ? A !== B : op === ">=" ? A >= B : op === "<=" ? A <= B : op === ">" ? A > B : A < B;
    }
    return !!a;
  }
  function andE() { let v = atom(); while (toks[i] === "and") { i++; const w = atom(); v = v && w; } return v; }
  function orE() { let v = andE(); while (toks[i] === "or") { i++; const w = andE(); v = v || w; } return v; }
  try { return orE(); } catch { return true; }
}

export function parsePackageXml(text) {
  const strip = text.replace(/<!--[\s\S]*?-->/g, "");
  const one = (tag) => { const m = strip.match(new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*([^<]*?)\\s*</${tag}>`)); return m ? m[1] : null; };
  const deps = {};
  for (const tag of DEP_TAGS) {
    const re = new RegExp(`<${tag}(\\s[^>]*)?>\\s*([^<\\s]+)\\s*</${tag}>`, "g");
    let m;
    while ((m = re.exec(strip))) {
      const cond = (m[1] || "").match(/condition\s*=\s*"([^"]*)"/);
      if (cond && !evalCondition(cond[1])) continue;
      (deps[tag] = deps[tag] || []).push(m[2]);
    }
  }
  const exportBlock = (strip.match(/<export>([\s\S]*?)<\/export>/) || [])[1] || "";
  const bt = exportBlock.match(/<build_type(?:\s[^>]*)?>\s*([^<\s]+)\s*<\/build_type>/);
  const licenses = [...strip.matchAll(/<license(?:\s[^>]*)?>\s*([^<]*?)\s*<\/license>/g)].map((m) => m[1]);
  return {
    name: one("name"), version: one("version"), licenses,
    build_type: bt ? bt[1] : "ament_cmake",
    metapackage: /<metapackage\s*\/>/.test(exportBlock),
    deps,
  };
}

/** Run-time dependencies (what `apt install ros-jazzy-<pkg>` pulls in). */
export function runDeps(pkg) {
  const d = pkg.deps;
  return [...new Set([...(d.depend || []), ...(d.exec_depend || []), ...(d.run_depend || []),
    ...(d.build_export_depend || []), ...(d.buildtool_export_depend || [])])];
}
export function allDeps(pkg) {
  const d = pkg.deps;
  return [...new Set(DEP_TAGS.filter((t) => t !== "doc_depend" && t !== "test_depend").flatMap((t) => d[t] || []))];
}

// ----------------------------------------------------------------------------------------------------------------
// CMakeLists.txt (a small interpreter: set/list/foreach/if-all-branches, add_executable, install, ...)
// ----------------------------------------------------------------------------------------------------------------
export function cmakeCommands(text) {
  text = text.replace(/#\[(=*)\[[\s\S]*?\]\1\]/g, "");
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "#") { while (i < n && text[i] !== "\n") i++; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < n && /[A-Za-z0-9_]/.test(text[j])) j++;
      const name = text.slice(i, j);
      let k = j; while (k < n && /[ \t]/.test(text[k])) k++;
      if (text[k] !== "(") { i = j; continue; }
      // parse arguments
      k++;
      const args = []; let depth = 0; let cur = null;
      const push = () => { if (cur !== null) { args.push(cur); cur = null; } };
      while (k < n) {
        const ch = text[k];
        if (ch === '"') {
          let s = ""; k++;
          while (k < n && text[k] !== '"') { if (text[k] === "\\" && k + 1 < n) { s += text[k + 1]; k += 2; continue; } s += text[k++]; }
          k++; cur = (cur || "") + s; args.quoted = true; continue;
        }
        if (ch === "#") { while (k < n && text[k] !== "\n") k++; continue; }
        if (ch === "(") { depth++; cur = (cur || "") + ch; k++; continue; }
        if (ch === ")") { if (depth === 0) { push(); k++; break; } depth--; cur = (cur || "") + ch; k++; continue; }
        if (/\s/.test(ch)) { push(); k++; continue; }
        cur = (cur || "") + ch; k++;
      }
      out.push({ cmd: name.toLowerCase(), args });
      i = k; continue;
    }
    i++;
  }
  return out;
}

/**
 * Interpret a CMakeLists.txt enough to know what `make install` puts where.
 * @param {string} text
 * @param {string} pkgName
 * @param {(rel:string)=>string[]} listFiles  files (relative to the package) under a directory, recursive
 * @param {object} extraVars
 */
export function cmakeInstallInfo(text, pkgName, listFiles = () => [], extraVars = {}) {
  const cmds = cmakeCommands(text);
  const vars = { PROJECT_NAME: pkgName, CMAKE_CURRENT_SOURCE_DIR: ".", CMAKE_SOURCE_DIR: ".", PROJECT_SOURCE_DIR: ".",
    CMAKE_CURRENT_BINARY_DIR: "@BINARY@", CMAKE_BINARY_DIR: "@BINARY@", CMAKE_INSTALL_PREFIX: "@PREFIX@", ...extraVars };
  const exeTargets = new Set();
  const libExes = new Set(), binExes = new Set();
  const shareInstalls = [];   // {kind:"dir"|"files", srcs:[...], dest:"share/<pkg>/...", patterns?:[], rename?}
  const pyModules = [];       // {module, dir}
  const configured = {};      // out (binary rel) -> in (source rel)
  const userCmds = {}; let callDepth = 0;
  let pyScriptsToLib = false;
  const expand = (s, depth = 0) => {
    if (depth > 8) return s;
    const r = s.replace(/\$\{([A-Za-z0-9_\-]+)\}/g, (_, v) => (vars[v] !== undefined ? vars[v] : ""));
    return r.includes("${") ? expand(r, depth + 1) : r;
  };
  const expandList = (args) => args.flatMap((a) => expand(a).split(";")).filter((a) => a !== "");
  const isLibDest = (d) => d.replace(/\/+$/, "") === `lib/${pkgName}`;
  const KW = new Set(["DESTINATION", "PERMISSIONS", "CONFIGURATIONS", "COMPONENT", "RENAME", "OPTIONAL", "EXCLUDE_FROM_ALL",
    "FILES_MATCHING", "PATTERN", "REGEX", "EXCLUDE", "USE_SOURCE_PERMISSIONS", "FILE_PERMISSIONS", "DIRECTORY_PERMISSIONS",
    "MESSAGE_NEVER", "ARCHIVE", "LIBRARY", "RUNTIME", "OBJECTS", "FRAMEWORK", "BUNDLE", "PRIVATE_HEADER", "PUBLIC_HEADER",
    "RESOURCE", "INCLUDES", "EXPORT", "NAMELINK_ONLY", "NAMELINK_SKIP", "TYPE", "FILE_SET", "CXX_MODULES_BMI"]);

  function run(list) {
    for (let idx = 0; idx < list.length; idx++) {
      const { cmd, args } = list[idx];
      if (cmd === "function" || cmd === "macro") {
        const end = cmd === "function" ? "endfunction" : "endmacro"; let d = 1; const body = [];
        while (++idx < list.length) { if (list[idx].cmd === cmd) d++; if (list[idx].cmd === end && --d === 0) break; body.push(list[idx]); }
        if (args[0]) userCmds[args[0].toLowerCase()] = { params: args.slice(1), body };
        continue;
      }
      if (userCmds[cmd] && callDepth < 6) {
        const def = userCmds[cmd]; const a = expandList(args); const saved = { ...vars };
        def.params.forEach((pn, k) => { vars[pn] = a[k] !== undefined ? a[k] : ""; });
        vars.ARGN = a.slice(def.params.length).join(";"); vars.ARGV = a.join(";"); vars.ARGC = String(a.length);
        a.forEach((v, k) => { vars[`ARGV${k}`] = v; });
        callDepth++; run(def.body); callDepth--;
        const keepProject = vars.PROJECT_NAME; Object.keys(vars).forEach((k) => delete vars[k]); Object.assign(vars, saved, { PROJECT_NAME: keepProject });
        continue;
      }
      if (cmd === "cmake_parse_arguments") {
        let a = expandList(args); if (a[0] === "PARSE_ARGV") a = [a[2], a[3] || "", a[4] || "", a[5] || "", ...(vars.ARGN || "").split(";")];
        const [prefix, o, s1, m] = [a[0], (args[1] ? expand(args[1]) : "").split(";"), (args[2] ? expand(args[2]) : "").split(";"), (args[3] ? expand(args[3]) : "").split(";")];
        const rest = a.slice(4); const kw = new Set([...o, ...s1, ...m].filter(Boolean)); const un = [];
        for (const k of kw) vars[`${prefix}_${k}`] = o.includes(k) ? "FALSE" : "";
        for (let q = 0; q < rest.length; q++) {
          const t = rest[q];
          if (o.includes(t)) vars[`${prefix}_${t}`] = "TRUE";
          else if (s1.includes(t)) vars[`${prefix}_${t}`] = rest[++q] || "";
          else if (m.includes(t)) { const vals = []; while (q + 1 < rest.length && !kw.has(rest[q + 1])) vals.push(rest[++q]); vars[`${prefix}_${t}`] = vals.join(";"); }
          else un.push(t);
        }
        vars[`${prefix}_UNPARSED_ARGUMENTS`] = un.join(";");
        continue;
      }
      if (cmd === "if") {
        // split into branches; the ROS buildfarm builds debs with -DBUILD_TESTING=OFF, other conditions: all branches
        const branches = [{ cond: args, body: [] }]; let d = 1;
        while (++idx < list.length) {
          const c = list[idx].cmd;
          if (c === "if") d++;
          if (c === "endif" && --d === 0) break;
          if (d === 1 && (c === "elseif" || c === "else")) { branches.push({ cond: list[idx].args, body: [], isElse: c === "else" }); continue; }
          branches[branches.length - 1].body.push(list[idx]);
        }
        const testing = (a) => a.includes("BUILD_TESTING");
        const negated = (a) => a.includes("NOT") && testing(a);
        if (testing(args) && !negated(args) && args.length <= 2) { for (const b of branches.slice(1)) run(b.body); }
        else if (negated(args) && args.length <= 2) run(branches[0].body);
        else for (const b of branches) run(b.body);
        continue;
      }
      if (cmd === "foreach") {
        let d = 1; const body = [];
        while (++idx < list.length) {
          if (list[idx].cmd === "foreach") d++;
          if (list[idx].cmd === "endforeach" && --d === 0) break;
          body.push(list[idx]);
        }
        const a = args.map((x) => x);
        const v = a[0]; let items;
        if (a[1] === "IN") {
          items = [];
          for (let q = 2; q < a.length; q++) {
            if (a[q] === "LISTS") { q++; for (; q < a.length && a[q] !== "ITEMS"; q++) items.push(...expand(`\${${a[q]}}`).split(";")); q--; }
            else if (a[q] === "ITEMS") { q++; for (; q < a.length && a[q] !== "LISTS"; q++) items.push(...expand(a[q]).split(";")); q--; }
          }
        } else if (a[1] === "RANGE") items = [];
        else items = expandList(a.slice(1));
        for (const it of items.filter(Boolean)) { const old = vars[v]; vars[v] = it; run(body); vars[v] = old; }
        continue;
      }
      if (cmd === "project") { if (args[0]) vars.PROJECT_NAME = expand(args[0]); continue; }
      if (cmd === "set") {
        const a = args.slice(1); const cut = a.findIndex((x) => x === "CACHE" || x === "PARENT_SCOPE");
        vars[expand(args[0])] = expandList(cut >= 0 ? a.slice(0, cut) : a).join(";");
        continue;
      }
      if (cmd === "list" && (args[0] === "APPEND" || args[0] === "PREPEND")) {
        const v = expand(args[1]); const cur = vars[v] ? vars[v].split(";") : []; const add = expandList(args.slice(2));
        vars[v] = (args[0] === "APPEND" ? [...cur, ...add] : [...add, ...cur]).filter(Boolean).join(";");
        continue;
      }
      if (cmd === "add_executable") {
        const a = expandList(args); if (a.includes("IMPORTED") || a.includes("ALIAS")) continue;
        exeTargets.add(a[0]); continue;
      }
      if (cmd === "ament_auto_add_executable") { const a = expandList(args); libExes.add(a[0]); continue; }
      if (cmd === "rclcpp_components_register_node") {
        const a = expandList(args); const k = a.indexOf("EXECUTABLE"); if (k >= 0 && a[k + 1]) libExes.add(a[k + 1]);
        continue;
      }
      if (cmd === "ament_python_install_package") {
        const a = expandList(args); const k = a.indexOf("PACKAGE_DIR");
        pyModules.push({ module: a[0], dir: k >= 0 ? a[k + 1].replace(/^\.\//, "") : a[0] });
        const sd = a.indexOf("SCRIPTS_DESTINATION"); if (sd >= 0 && isLibDest(a[sd + 1] || "")) pyScriptsToLib = true;
        continue;
      }
      if (cmd === "configure_file") {
        const a = expandList(args); if (a.length >= 2) {
          const out = a[1].replace(/^@BINARY@\/?/, "");
          configured[out] = a[0].replace(/^\.\//, "");
        }
        continue;
      }
      if (cmd === "install") {
        const a = expandList(args);
        const mode = a[0];
        const dests = []; for (let q = 0; q < a.length; q++) if (a[q] === "DESTINATION" && a[q + 1]) dests.push(a[q + 1].replace(/^@PREFIX@\/?/, ""));
        const items = []; for (let q = 1; q < a.length && !KW.has(a[q]); q++) items.push(a[q]);
        const renameIdx = a.indexOf("RENAME");
        const rename = renameIdx >= 0 ? a[renameIdx + 1] : null;
        if (mode === "TARGETS") {
          for (const t of items) if (exeTargets.has(t)) {
            if (dests.some(isLibDest)) libExes.add(t); else if (dests.some((d) => d === "bin")) binExes.add(t);
          }
        } else if (mode === "PROGRAMS") {
          for (const f of items) { const b = rename || path.basename(f); if (dests.some(isLibDest)) libExes.add(b); else if (dests.includes("bin")) binExes.add(b); }
        } else if (mode === "DIRECTORY") {
          const dest = dests[0] || "";
          if (isLibDest(dest)) {
            for (const d of items) {
              const rel = d.replace(/^\.\//, "").replace(/\/+$/, "");
              for (const f of listFiles(rel)) {
                const inner = d.endsWith("/") ? f.slice(rel.length + 1) : path.join(path.basename(rel), f.slice(rel.length + 1));
                if (!inner.includes("/")) libExes.add(inner);
              }
            }
          }
          if (dest.startsWith("share/")) {
            const pats = []; for (let q = 0; q < a.length; q++) if (a[q] === "PATTERN" || a[q] === "REGEX") pats.push({ kind: a[q], p: a[q + 1], exclude: a[q + 2] === "EXCLUDE" });
            shareInstalls.push({ kind: "dir", srcs: items, dest, patterns: pats, filesMatching: a.includes("FILES_MATCHING") });
          }
        } else if (mode === "FILES") {
          const dest = dests[0] || "";
          if (dest.startsWith("share/")) shareInstalls.push({ kind: "files", srcs: items, dest, rename });
        }
        continue;
      }
    }
  }
  run(cmds);
  return { libExes: [...libExes], binExes: [...binExes], shareInstalls, pyModules, configured, vars, pyScriptsToLib };
}

// ----------------------------------------------------------------------------------------------------------------
// setup.py (ament_python): run it with a stand-in setuptools.setup() that records its arguments
// ----------------------------------------------------------------------------------------------------------------
const SETUP_CAPTURE_PY = String.raw`
import sys, os, json, types, fnmatch, glob as _glob
captured = {}
def setup(**kw): captured.update(kw)
def find_packages(where='.', exclude=(), include=('*',)):
    out = []
    for root, dirs, files in os.walk(where):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        if root == where: continue
        if '__init__.py' in files:
            name = os.path.relpath(root, where).replace(os.sep, '.')
            if any(fnmatch.fnmatch(name, p) for p in exclude): continue
            if not any(fnmatch.fnmatch(name, p) for p in include): continue
            out.append(name)
    return out
st = types.ModuleType('setuptools'); st.setup = setup; st.find_packages = find_packages
st.find_namespace_packages = find_packages
class _Cmd: pass
st.Command = _Cmd
sys.modules['setuptools'] = st
cmd = types.ModuleType('setuptools.command'); sys.modules['setuptools.command'] = cmd
for sub in ('build_py', 'develop', 'install', 'egg_info', 'sdist', 'install_scripts'):
    m = types.ModuleType('setuptools.command.' + sub); setattr(m, sub, _Cmd); sys.modules['setuptools.command.' + sub] = m
du = types.ModuleType('distutils.core'); du.setup = setup; sys.modules['distutils.core'] = du
os.chdir(sys.argv[1]); sys.argv = ['setup.py']; sys.path.insert(0, '.')
try:
    exec(compile(open('setup.py').read(), 'setup.py', 'exec'), {'__name__': '__main__', '__file__': os.path.abspath('setup.py')})
except SystemExit: pass
def norm(x):
    if isinstance(x, dict): return {str(k): norm(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, set)): return [norm(v) for v in x]
    if isinstance(x, (str, int, float, bool)) or x is None: return x
    return str(x)
keep = {k: captured.get(k) for k in ('name', 'packages', 'package_dir', 'py_modules', 'data_files', 'entry_points', 'scripts')}
print(json.dumps(norm(keep)))
`;
export function setupPyInfo(pkgDir) {
  if (!fs.existsSync(path.join(pkgDir, "setup.py"))) return null;
  try {
    const out = execFileSync("python3", ["-I", "-c", SETUP_CAPTURE_PY, pkgDir], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 });
    const info = JSON.parse(out.trim().split("\n").pop());
    let ep = info.entry_points || {};
    if (typeof ep === "string") { // ini-style string
      const o = {}; let sec = null;
      for (const line of ep.split("\n")) { const s = line.trim(); const m = s.match(/^\[(.+)\]$/); if (m) { sec = m[1]; o[sec] = []; } else if (s && sec) o[sec].push(s); }
      ep = o;
    }
    const cs = (ep.console_scripts || []).map((s) => s.split("=")[0].trim()).filter(Boolean);
    let scriptsDir = "bin";
    const cfgPath = path.join(pkgDir, "setup.cfg");
    if (fs.existsSync(cfgPath)) {
      const cfg = fs.readFileSync(cfgPath, "utf8");
      const m = cfg.match(/install[_-]scripts\s*=\s*\$base\/(\S+)/);
      if (m) scriptsDir = m[1];
    }
    return { ...info, consoleScripts: cs, scriptsDir };
  } catch (e) {
    return { error: String(e.stderr || e.message).slice(-400) };
  }
}

/** Executables (lib/<pkg>/*), python modules and share-install rules of one package directory. */
export function scanPackage(pkgDir, { listFiles, extraVars } = {}) {
  const px = parsePackageXml(fs.readFileSync(path.join(pkgDir, "package.xml"), "utf8"));
  const lf = listFiles || ((rel) => walk(path.join(pkgDir, rel)).map((f) => path.join(rel, f)));
  const res = { ...px, exes: [], bin: [], py: {}, shareInstalls: [], dataFiles: null, configured: {} };
  const cm = path.join(pkgDir, "CMakeLists.txt");
  if (fs.existsSync(cm) && px.build_type !== "ament_python") {
    const info = cmakeInstallInfo(fs.readFileSync(cm, "utf8"), px.name, lf, extraVars);
    res.exes.push(...info.libExes); res.bin.push(...info.binExes);
    res.shareInstalls = info.shareInstalls; res.configured = info.configured;
    for (const m of info.pyModules) res.py[m.module] = m.dir;
    // ament_python_install_package(<pkg> SCRIPTS_DESTINATION lib/<pkg>): console_scripts of setup.cfg go to lib/<pkg>
    const cfgPath = path.join(pkgDir, "setup.cfg");
    if (info.pyScriptsToLib && fs.existsSync(cfgPath)) {
      const cfg = fs.readFileSync(cfgPath, "utf8");
      const m = cfg.match(/console_scripts\s*=\s*\n((?:[ \t]+\S.*\n?)+)/);
      if (m) for (const line of m[1].split("\n")) { const n = line.split("=")[0].trim(); if (n) res.exes.push(n); }
    }
  }
  if (px.build_type === "ament_python" || (!fs.existsSync(cm) && fs.existsSync(path.join(pkgDir, "setup.py")))) {
    const sp = setupPyInfo(pkgDir);
    if (sp && !sp.error) {
      if (sp.scriptsDir === `lib/${px.name}`) res.exes.push(...sp.consoleScripts, ...(sp.scripts || []).map((s) => path.basename(s)));
      else res.bin.push(...sp.consoleScripts);
      const pd = sp.package_dir || {};
      for (const p of sp.packages || []) {
        if (p.includes(".")) continue;
        const base = pd[p] || (pd[""] ? path.join(pd[""], p) : p);
        res.py[p] = base;
      }
      for (const m of sp.py_modules || []) res.py[m] = (pd[""] ? path.join(pd[""], m) : m) + ".py";
      res.dataFiles = sp.data_files || [];
    } else if (sp && sp.error) res.setupError = sp.error;
  }
  res.exes = [...new Set(res.exes)].sort(); res.bin = [...new Set(res.bin)].sort();
  return res;
}

export function walk(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else if (e.isFile() || e.isSymbolicLink()) out.push(path.relative(base, p));
  }
  return out.sort();
}

/** Files that `make install` places under share/<pkg> (CMake install rules / setup.py data_files). */
export function shareFiles(pkgDir, scan, { configureVars = {} } = {}) {
  const out = new Map(); // dest (relative to share/<pkg>) -> {src?:abs, text?:string}
  const pkg = scan.name;
  const shareRoot = `share/${pkg}`;
  const add = (dest, src) => { if (dest === shareRoot || dest.startsWith(shareRoot + "/")) out.set(dest.slice(shareRoot.length + 1), src); };
  const globToRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  for (const ins of scan.shareInstalls) {
    if (ins.kind === "dir") {
      for (const s0 of ins.srcs) {
        const s = s0.replace(/^\.\//, "");
        if (s.startsWith("@BINARY@")) continue;
        const abs = path.join(pkgDir, s.replace(/\/+$/, ""));
        if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
        for (const f of walk(abs)) {
          const bn = path.basename(f);
          let ok = !ins.filesMatching;
          for (const p of ins.patterns) {
            const m = p.kind === "PATTERN" ? (globToRe(p.p).test(bn) || f.split("/").some((seg) => globToRe(p.p).test(seg))) : new RegExp(p.p).test(f);
            if (m) ok = !p.exclude;
          }
          if (!ok) continue;
          const rel = s0.endsWith("/") ? f : path.join(path.basename(abs), f);
          add(path.join(ins.dest, rel), { src: path.join(abs, f) });
        }
      }
    } else {
      for (const s0 of ins.srcs) {
        if (s0.startsWith("@BINARY@")) {
          const outRel = s0.replace(/^@BINARY@\/?/, "");
          const inRel = scan.configured[outRel] || scan.configured[outRel + ".configured"] ||
            Object.entries(scan.configured).find(([o]) => o.replace(/\.configured$/, "") === outRel)?.[1];
          if (!inRel) continue;
          let t = fs.readFileSync(path.join(pkgDir, inRel), "utf8");
          t = t.replace(/@([A-Za-z_][A-Za-z0-9_]*)@/g, (m, v) => (configureVars[v] !== undefined ? configureVars[v] : m));
          add(path.join(ins.dest, ins.rename || path.basename(outRel)), { text: t, configuredFrom: inRel });
          continue;
        }
        const abs = path.join(pkgDir, s0.replace(/^\.\//, ""));
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) add(path.join(ins.dest, ins.rename || path.basename(s0)), { src: abs });
      }
    }
  }
  for (const entry of scan.dataFiles || []) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [dest, files] = entry;
    for (const f of files || []) {
      const abs = path.join(pkgDir, f);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) add(path.join(dest, path.basename(f)), { src: abs });
    }
  }
  return out;
}

// ----------------------------------------------------------------------------------------------------------------
// zip writer (deflate, no dependencies)
// ----------------------------------------------------------------------------------------------------------------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function writeZip(file, entries /* [[name, Buffer, mode?]] */) {
  const chunks = []; const central = []; let offset = 0;
  const dosTime = (1 << 11) | (0 << 5); const dosDate = ((2024 - 1980) << 9) | (5 << 5) | 23; // fixed timestamp: reproducible
  for (const [name, data0, mode] of entries) {
    const data = Buffer.isBuffer(data0) ? data0 : Buffer.from(data0);
    const nameBuf = Buffer.from(name, "utf8");
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const useStore = comp.length >= data.length;
    const body = useStore ? data : comp;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(useStore ? 0 : 8, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    chunks.push(lh, nameBuf, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE((3 << 8) | 20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(useStore ? 0 : 8, 10); ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE((((mode || 0o100644) & 0xffff) << 16) >>> 0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + body.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(file, Buffer.concat([...chunks, ...central, end]));
}
export function readZip(file) {
  const buf = fs.readFileSync(file); const out = new Map();
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  const count = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28),
      xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const lnl = buf.readUInt16LE(lho + 26), lxl = buf.readUInt16LE(lho + 28);
    const data = buf.subarray(lho + 30 + lnl + lxl, lho + 30 + lnl + lxl + csize);
    out.set(name, method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data));
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// ----------------------------------------------------------------------------------------------------------------
// git helpers
// ----------------------------------------------------------------------------------------------------------------
export function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28, ...opts }).trim();
}
export function gitAsync(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`git ${args.join(" ")}: ${err.trim()}`))));
  });
}
export async function pool(items, n, fn) {
  const res = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}
export function sha1(buf) { return crypto.createHash("sha1").update(buf).digest("hex"); }

// ================================================================================================================
// main: /opt/ros/jazzy
// ================================================================================================================
const ROSDISTRO = { url: "https://github.com/ros/rosdistro.git", commit: "b152c7a53e33e6407b4c99063eda3b587bf175e6" };
// apt metapackages / repositories whose packages are all "installed"
const SEED_PACKAGES = ["desktop_full", "ros_gz", "navigation2", "nav2_bringup", "slam_toolbox", "cartographer_ros", "cartographer_rviz",
  "moveit", "teleop_twist_keyboard", "joint_state_publisher", "joint_state_publisher_gui", "xacro", "gz_ros2_control",
  "ros2_control", "ros2_controllers", "motion_capture_tracking", "nav2_minimal_tb3_sim", "nav2_minimal_tb4_sim", "rqt_robot_steering", "topic_tools", "tf_transformations"];
const SEED_REPOS = ["moveit", "ros2_control", "ros2_controllers", "gz_ros2_control", "navigation2", "control_msgs", "moveit_msgs",
  "srdfdom", "realtime_tools", "control_toolbox", "kinematics_interface", "ros_gz", "joint_state_publisher", "moveit_visual_tools",
  "warehouse_ros", "launch_param_builder"];
// share/ content that the robot workspaces' launch files include (more are found by scanning, see below)
const SHARE_SEEDS = ["ros_gz_sim", "ros_gz_bridge", "nav2_bringup", "nav2_common", "nav2_bt_navigator", "slam_toolbox", "cartographer_ros",
  "moveit_configs_utils", "launch_param_builder", "robot_state_publisher", "joint_state_publisher", "joint_state_publisher_gui",
  "rviz_common", "rviz2", "controller_manager", "launch" /* share/launch/frontend/grammar.lark (python module: vendored) */];
// python packages the launch runtime vendors itself (do not put them in share.zip)
const VENDORED_PY = new Set(["launch", "launch_ros", "launch_xml", "launch_yaml", "ament_index_python", "osrf_pycommon", "xacro",
  "ros2launch", "ros2cli", "ros2pkg", "rclpy", "yaml", "lark", "catkin_pkg", "packaging", "pyparsing"]);
// configure_file() values used by the Jazzy binaries (gz-sim 8 = Gazebo Harmonic)
const CONFIGURE_VARS = { GZ_SIM_VER: "8", GZ_VERSION: "harmonic" };
const SHARE_EXCLUDE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".bmp", ".tga", ".ttf", ".otf", ".pdf",
  ".dsv", ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmake", ".in", ".so", ".a", ".bag", ".db3", ".mcap", ".qrc", ".ui", ".mesh", ".material", ".program", ".glsl", ".cg", ".hlsl", ".frag", ".vert", ".qml"]);

function yamlToJson(file) {
  return JSON.parse(execFileSync("python3", ["-I", "-c", "import sys,json,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1]))))", file], { encoding: "utf8", maxBuffer: 1 << 28 }));
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const CACHE = path.resolve(opt("--cache", process.env.R2L_ROS_CACHE || path.join(os.tmpdir(), "ros2lab-ros-cache")));
  const JOBS = Number(opt("--jobs", "8"));
  const OUTDIR = path.join(ROOT, "public/ros/jazzy");
  fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUTDIR, { recursive: true });

  // 1. rosdistro
  const rdDir = path.join(CACHE, "rosdistro");
  if (!fs.existsSync(path.join(rdDir, "jazzy/distribution.yaml")) || git(["-C", rdDir, "rev-parse", "HEAD"]) !== ROSDISTRO.commit) {
    fs.rmSync(rdDir, { recursive: true, force: true }); fs.mkdirSync(rdDir, { recursive: true });
    git(["-C", rdDir, "init", "-q"]); git(["-C", rdDir, "remote", "add", "origin", ROSDISTRO.url]);
    git(["-C", rdDir, "config", "core.sparseCheckout", "true"]);
    fs.writeFileSync(path.join(rdDir, ".git/info/sparse-checkout"), "/jazzy/distribution.yaml\n");
    git(["-C", rdDir, "fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", ROSDISTRO.commit]);
    git(["-C", rdDir, "checkout", "-q", "FETCH_HEAD"]);
  }
  const distro = yamlToJson(path.join(rdDir, "jazzy/distribution.yaml"));
  const pkgIndex = {}; // pkg -> {repo, version, release_url, tag, source_url, source_branch}
  for (const [repo, r] of Object.entries(distro.repositories)) {
    if (!r.release || !r.release.version) continue;
    const pk = r.release.packages || [repo];
    for (const p of pk) pkgIndex[p] = {
      repo, version: r.release.version, release_url: r.release.url,
      tag: (r.release.tags?.release || "release/jazzy/{package}/{version}").replace("{package}", p).replace("{version}", r.release.version),
      source_url: r.source?.url || r.doc?.url || null, source_branch: r.source?.version || r.doc?.version || null,
    };
  }
  console.log(`rosdistro jazzy: ${Object.keys(pkgIndex).length} released packages`);

  // 2. workspace packages and their dependencies
  const wsRoot = path.join(ROOT, "public/robots/ws");
  const wsPkgs = new Set(); const wsDeps = new Set(); const wsLaunchFiles = [];
  for (const id of fs.existsSync(wsRoot) ? fs.readdirSync(wsRoot) : []) {
    const f = path.join(wsRoot, id, "workspace.json"); if (!fs.existsSync(f)) continue;
    const ws = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const p of ws.packages) { wsPkgs.add(p.name); for (const d of p.deps || []) wsDeps.add(d); }
    for (const t of ws.text) if (/(launch|\.launch\.py$|\.launch\.xml$|\.xacro$|\.urdf$)/.test(t)) wsLaunchFiles.push(path.join(wsRoot, id, t));
  }
  const seeds = new Set(SEED_PACKAGES);
  for (const r of SEED_REPOS) for (const [p, v] of Object.entries(pkgIndex)) if (v.repo === r) seeds.add(p);
  for (const d of wsDeps) if (!wsPkgs.has(d) && pkgIndex[d]) seeds.add(d);
  const notReleased = [...wsDeps].filter((d) => !wsPkgs.has(d) && !pkgIndex[d]).sort();

  // 3. closure over run dependencies, one sparse clone of the release tag per package
  const pkgs = {}; // name -> {dir, px, commit, ...}
  const fetchPkg = async (name) => {
    const ix = pkgIndex[name];
    const dir = path.join(CACHE, "pkgs", `${name}@${ix.version}`);
    let commit;
    try {
      if (!fs.existsSync(path.join(dir, ".git"))) {
        fs.mkdirSync(dir, { recursive: true });
        await gitAsync(["-C", dir, "init", "-q"]);
        await gitAsync(["-C", dir, "remote", "add", "origin", ix.release_url]);
        await gitAsync(["-C", dir, "config", "core.sparseCheckout", "true"]);
        fs.writeFileSync(path.join(dir, ".git/info/sparse-checkout"), "/package.xml\n/CMakeLists.txt\n/setup.py\n/setup.cfg\n");
        await gitAsync(["-C", dir, "fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", `refs/tags/${ix.tag}:refs/tags/${ix.tag}`]);
        await gitAsync(["-C", dir, "checkout", "-q", `tags/${ix.tag}`]);
      }
      commit = await gitAsync(["-C", dir, "rev-parse", "HEAD"]);
    } catch (e) {
      fs.rmSync(dir, { recursive: true, force: true });
      return { name, error: String(e.message).slice(0, 300) };
    }
    const px = parsePackageXml(fs.readFileSync(path.join(dir, "package.xml"), "utf8"));
    return { name, dir, commit, px };
  };
  const want = new Set(seeds); let frontier = [...seeds]; const errors = {};
  while (frontier.length) {
    const batch = frontier.filter((p) => pkgIndex[p] && !pkgs[p] && !errors[p]);
    frontier = [];
    const res = await pool(batch, JOBS, fetchPkg);
    for (const r of res) {
      if (r.error) { errors[r.name] = r.error; continue; }
      pkgs[r.name] = r;
      for (const d of runDeps(r.px)) if (pkgIndex[d] && !want.has(d)) { want.add(d); frontier.push(d); }
    }
    process.stdout.write(`\r  closure: ${Object.keys(pkgs).length} packages fetched`);
  }
  console.log(Object.keys(errors).length ? `\n  fetch errors: ${JSON.stringify(errors).slice(0, 1500)}` : "");

  // full checkout where files are needed: python packages (setup.py runs find_packages) and share.zip candidates
  const full = async (name) => {
    const p = pkgs[name]; if (!p || p.full) return;
    fs.writeFileSync(path.join(p.dir, ".git/info/sparse-checkout"), "/*\n");
    await gitAsync(["-C", p.dir, "read-tree", "-mu", "HEAD"]);
    p.full = true;
  };
  await pool(Object.keys(pkgs).filter((n) => pkgs[n].px.build_type === "ament_python"), JOBS, full);

  // 4. scan every package: executables, python modules, share install rules
  const lsTree = {};
  for (const [name, p] of Object.entries(pkgs)) {
    lsTree[name] = git(["-C", p.dir, "ls-tree", "-r", "--name-only", "HEAD"]).split("\n");
    const listFiles = (rel) => lsTree[name].filter((f) => f.startsWith(rel.replace(/\/+$/, "") + "/"));
    p.scan = scanPackage(p.dir, { listFiles, extraVars: { "gz-sim_VERSION_MAJOR": "8" } });
  }
  // python module -> package
  const pyOwner = {};
  for (const [name, p] of Object.entries(pkgs)) for (const m of Object.keys(p.scan.py)) if (!pyOwner[m]) pyOwner[m] = name;

  // 5. share.zip selection: seeds + every package the workspaces' launch/xacro files refer to, recursively
  const REF_RES = [
    /(?:FindPackageShare|get_package_share_directory|get_package_share_path|FindPackagePrefix|get_package_prefix)\(\s*(?:package(?:_name)?\s*=\s*)?['"]([A-Za-z0-9_]+)['"]/g,
    /\$\((?:find-pkg-share|find|find-pkg-prefix)\s+([A-Za-z0-9_]+)\)/g,
    /package:\/\/([A-Za-z0-9_]+)\//g,
  ];
  const IMPORT_RE = /^\s*(?:from\s+([A-Za-z0-9_]+)[.\w]*\s+import|import\s+([A-Za-z0-9_]+))/gm;
  const sharePkgs = new Set(SHARE_SEEDS.filter((p) => pkgs[p]));
  const pyMods = new Set();
  const refsFrom = (text) => {
    const out = new Set();
    for (const re of REF_RES) for (const m of text.matchAll(re)) out.add(m[1]);
    for (const m of text.matchAll(IMPORT_RE)) { const mod = m[1] || m[2]; if (!VENDORED_PY.has(mod) && pyOwner[mod] && !wsPkgs.has(pyOwner[mod])) { pyMods.add(mod); out.add(pyOwner[mod]); } }
    return out;
  };
  for (const f of wsLaunchFiles) for (const r of refsFrom(fs.readFileSync(f, "utf8"))) if (pkgs[r] && !wsPkgs.has(r)) sharePkgs.add(r);
  const scanned = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const name of [...sharePkgs]) {
      if (scanned.has(name)) continue; scanned.add(name); grew = true;
      await full(name);
      const p = pkgs[name];
      p.scan = scanPackage(p.dir, { listFiles: (rel) => lsTree[name].filter((f) => f.startsWith(rel.replace(/\/+$/, "") + "/")), extraVars: { "gz-sim_VERSION_MAJOR": "8" } });
      p.share = shareFiles(p.dir, p.scan, { configureVars: CONFIGURE_VARS });
      for (const m of Object.keys(p.scan.py)) pyMods.add(m);
      for (const [rel, src] of p.share) {
        if (!/(^|\/)launch\/|\.launch\.(py|xml)$|_launch\.py$/.test(rel)) continue;
        const t = src.text ?? fs.readFileSync(src.src, "utf8");
        for (const r of refsFrom(t)) if (pkgs[r] && !wsPkgs.has(r) && !sharePkgs.has(r)) sharePkgs.add(r);
      }
      for (const mod of Object.keys(p.scan.py)) { // python modules of share packages may import more
        const base = path.join(p.dir, p.scan.py[mod]);
        const files = fs.existsSync(base) && fs.statSync(base).isDirectory() ? walk(base).filter((f) => f.endsWith(".py")).map((f) => path.join(base, f)) : fs.existsSync(base) ? [base] : [];
        for (const f of files) for (const r of refsFrom(fs.readFileSync(f, "utf8"))) if (pkgs[r] && !wsPkgs.has(r) && !sharePkgs.has(r)) sharePkgs.add(r);
      }
    }
  }
  // 6. write share.zip
  const entries = []; const shareSummary = {};
  for (const name of [...sharePkgs].sort()) {
    const p = pkgs[name]; let n = 0, bytes = 0;
    for (const [rel, src] of [...p.share].sort((a, b) => a[0].localeCompare(b[0]))) {
      const ext = path.extname(rel).toLowerCase();
      if (/(^|\/)(cmake|environment|hook)\//.test(rel) || /^local_setup\.|^package\.(sh|bash|zsh|ps1|dsv)$/.test(rel)) continue;
      if (SHARE_EXCLUDE_EXT.has(ext)) continue;
      const buf = src.text !== undefined ? Buffer.from(src.text) : fs.readFileSync(src.src);
      if (buf.length > 3e6) continue;
      if (buf.includes(0) && ext !== ".pgm") continue;
      entries.push([`share/${name}/${rel}`, buf, 0o100644]); n++; bytes += buf.length;
    }
    if (!p.share.has("package.xml")) { const b = fs.readFileSync(path.join(p.dir, "package.xml")); entries.push([`share/${name}/package.xml`, b, 0o100644]); n++; bytes += b.length; }
    shareSummary[name] = { files: n, bytes };
  }
  const pyWritten = {};
  for (const mod of [...pyMods].sort()) {
    const owner = pyOwner[mod]; if (!owner || !sharePkgs.has(owner) || VENDORED_PY.has(mod)) continue;
    const p = pkgs[owner]; const base = path.join(p.dir, p.scan.py[mod]);
    if (!fs.existsSync(base)) continue;
    if (fs.statSync(base).isDirectory()) {
      for (const f of walk(base)) if (/\.(py|yaml|yml|json|xml|txt|typed|j2|jinja2?)$/.test(f) && !/(^|\/)test/.test(f)) entries.push([`python/${mod}/${f}`, fs.readFileSync(path.join(base, f)), 0o100644]);
    } else entries.push([`python/${path.basename(base)}`, fs.readFileSync(base), 0o100644]);
    pyWritten[mod] = owner;
  }
  writeZip(path.join(OUTDIR, "share.zip"), entries);
  const zipSize = fs.statSync(path.join(OUTDIR, "share.zip")).size;

  // 7. index.json + SOURCES.json
  const index = { distro: "jazzy", generated: new Date().toISOString().slice(0, 10),
    note: "Packages of an Ubuntu 24.04 /opt/ros/jazzy with ros-jazzy-desktop-full, ros-gz, navigation2, nav2-bringup, slam-toolbox, cartographer-ros, moveit, ros2-control, ros2-controllers, gz-ros2-control, teleop-twist-keyboard, joint-state-publisher(-gui), xacro and the robot workspaces' apt dependencies. exes = programs installed in lib/<package>/ (from CMakeLists.txt install() rules and setup.py console_scripts of the released sources); bin = programs in bin/; share = true when share.zip has this package's real share/ files.",
    packages: {} };
  const sources = { distro: "jazzy", rosdistro: { url: ROSDISTRO.url.replace(/\.git$/, ""), commit: ROSDISTRO.commit, file: "jazzy/distribution.yaml" },
    configure_vars: CONFIGURE_VARS, packages: {}, python_modules_in_share_zip: pyWritten };
  for (const name of Object.keys(pkgs).sort()) {
    const p = pkgs[name]; const s = p.scan;
    const e = { exes: s.exes, share: sharePkgs.has(name) };
    if (s.bin.length) e.bin = s.bin;
    const mods = Object.keys(s.py).filter((m) => pyWritten[m] === name); if (mods.length) e.py = mods;
    index.packages[name] = e;
    const ix = pkgIndex[name];
    sources.packages[name] = { version: ix.version, release_repo: ix.release_url.replace(/\.git$/, ""), tag: ix.tag, commit: p.commit,
      source_repo: ix.source_url ? ix.source_url.replace(/\.git$/, "") : null, source_branch: ix.source_branch, license: s.licenses.join(", "),
      ...(s.setupError ? { setup_py_error: s.setupError.slice(0, 200) } : {}),
      ...(sharePkgs.has(name) ? { share_files: shareSummary[name].files } : {}) };
  }
  sources.not_released_dependencies = notReleased;
  sources.fetch_errors = errors;
  fs.writeFileSync(path.join(OUTDIR, "index.json"), JSON.stringify(index, null, 0).replace(/\},"/g, '},\n"') + "\n");
  fs.writeFileSync(path.join(OUTDIR, "SOURCES.json"), JSON.stringify(sources, null, 1) + "\n");
  const exeCount = Object.values(index.packages).reduce((s, p) => s + p.exes.length, 0);
  console.log(`index.json: ${Object.keys(index.packages).length} packages, ${exeCount} executables`);
  console.log(`share.zip: ${entries.length} files, ${(zipSize / 1e6).toFixed(2)} MB, packages: ${[...sharePkgs].sort().join(" ")}`);
  console.log(`python modules: ${Object.keys(pyWritten).join(" ")}`);
  console.log(`workspace deps not in rosdistro (system/pip or source-only): ${notReleased.join(" ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
