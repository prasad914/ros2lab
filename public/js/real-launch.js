// Official robot workspaces (public/robots/ws/<wsid>) on the practice computer, launched with the REAL launch files.
//
//   loadRealWorkspace(sh, wsid, robotId)   the maker's repositories into ~/ros2_ws/src (text files with their content,
//                                          meshes as links fetched when drawn), /opt/ros/jazzy share files into the
//                                          file system, and sh.realWs (what colcon build and ros2 launch need)
//   realColconBuild(sh, ws, rest)          colcon build of those packages (install/<pkg>/share/<pkg>/..., executables)
//   realOwns(sh, pkg)                      does `ros2 launch <pkg> ...` go through the real launch system?
//   startRealLaunch(sh, argv, ui)          ros2 launch with the real ros2/launch + launch_ros (launch-runtime.js); every
//                                          program the launch starts is handed to the website's model of it below.
//
// Honest limits: the website does not run the compiled programs (gz-sim, Nav2 servers, move_group, drivers). It runs
// the real launch files, URDF/xacro, SDF, YAML and .rviz files, and its own models of those programs.
import { getLaunchRuntime, DEFAULT_ENV } from "./launch-runtime.js";
import { unzip } from "./unzip.js";
import * as NAV2 from "./nav2-sim.js";
const { startNav2Node, stopNav2Node, nav2Lifecycle, nav2Role } = NAV2;

const HOME = "/home/student";
const WSDIR = `${HOME}/ros2_ws`;
const MESH = /\.(dae|stl|obj|ply|png|jpe?g|gif|bmp|tga|webp|glb|gltf|pgm)$/i;
const BINARY = /\.(png|jpe?g|gif|bmp|tga|webp|glb|pgm|so|a|bin|zip|pdf|ttf)$/i;

// ---------------------------------------------------------------- /opt/ros/jazzy (index + real share files)
let jazzyP = null;
export function loadJazzy() {
  if (!jazzyP) jazzyP = (async () => {
    const [index, zipBuf] = await Promise.all([fetch("/ros/jazzy/index.json").then((r) => r.json()), fetch("/ros/jazzy/share.zip").then((r) => r.arrayBuffer())]);
    const files = await unzip(zipBuf);
    return { index, files, zipBuf };
  })();
  jazzyP.catch(() => { jazzyP = null; });
  return jazzyP;
}
const dec = new TextDecoder();

// ---------------------------------------------------------------- the workspace
export async function loadRealWorkspace(sh, wsid, robotId, { onStatus } = {}) {
  const base = `/robots/ws/${wsid}`;
  onStatus && onStatus(`Downloading the ${wsid} workspace from the makers' repositories…`);
  const [ws, text, jazzy] = await Promise.all([fetch(`${base}/workspace.json`).then((r) => r.json()), fetch(`${base}/text.json`).then((r) => r.json()), loadJazzy()]);
  // the sources: ~/ros2_ws/src/<repo>/<pkg>/...
  const src = `${WSDIR}/src`;
  for (const k of [...sh.fs.keys()]) if (k.startsWith(src + "/")) sh.fs.delete(k);
  sh.mkdirP(src);
  const alias = ws.alias || {};
  const put = (path, content, exec) => { sh.mkdirP(path.replace(/\/[^/]*$/, "")); sh.fs.set(path, { type: "f", mode: exec ? "rwxr-xr-x" : "rw-r--r--", content }); };
  const listed = new Set([...(ws.files || []), ...Object.keys(alias)]);
  for (const rel of listed) {
    if (!rel.startsWith("src/")) continue;
    const path = `${WSDIR}/${rel}`;
    if (text[rel] !== undefined) put(path, text[rel], /^#!/.test(text[rel]));
    else put(path, `@url:${base}/${alias[rel] || rel}`);
  }
  // map images (.pgm / .png next to a map .yaml) are read by map_server as bytes: fetch them now
  const maps = [...listed].filter((rel) => /\.(pgm|png)$/i.test(rel) && /(^|\/)maps?\//.test(rel) && rel.startsWith("src/"));
  await Promise.all(maps.map(async (rel) => {
    try { const r = await fetch(`${base}/${alias[rel] || rel}`); if (!r.ok) return; const node = sh.fs.get(`${WSDIR}/${rel}`); if (node) node.bytes = new Uint8Array(await r.arrayBuffer()); } catch { /* drawn without it */ }
  }));
  // /opt/ros/jazzy/share/<pkg>/... : the real installed files (nav2_bringup params, maps, behavior trees, ros_gz_sim launch ...)
  for (const [rel, bytes] of jazzy.files) {
    if (!rel.startsWith("share/")) continue;
    const path = `/opt/ros/jazzy/${rel}`;
    if (sh.fs.has(path)) continue;
    put(path, BINARY.test(rel) ? `@bytes:${rel}` : dec.decode(bytes));
  }
  // the makers' controller classes (pluginlib XML) become known to the controller_manager model
  try { const { registerControllerTypes } = await import("./ros2-control.js"); for (const [rel, t] of Object.entries(text)) if (/\.xml$/.test(rel) && /controller_interface::/.test(t)) registerControllerTypes(t); } catch { /* the defaults */ }
  const env = { ...(ws.env && ws.env[robotId] ? ws.env[robotId] : ws.env && !Object.values(ws.env).some((v) => typeof v === "object") ? ws.env : {}) };
  const pkgs = new Map((ws.packages || []).map((p) => [p.name, { ...p, dir: `${WSDIR}/${p.path}` }]));
  sh.realWs = { id: wsid, json: ws, robot: robotId, base, env, pkgs, jazzy, built: new Map(), mounted: new Map(), jobs: new Set(),
    // what terminal-sim.js calls (it does not import this module: only robot pages with an official workspace load it)
    api: { owns: realOwns, colcon: realColconBuild, packagesIn: realPackagesIn, runnable: realRunnable, startLaunch: startRealLaunch, startRun: startRealRun } };
  for (const n of Object.keys(jazzy.index.packages || {})) sh.rosPkgs.add(n);   // apt packages the workspace needs are installed
  return sh.realWs;
}
// a /opt/ros/jazzy binary file (map .pgm ...) from share.zip
function jazzyBytes(sh, path) {
  const R = sh.realWs; if (!R) return null;
  const rel = path.replace(/^\/opt\/ros\/jazzy\//, "");
  return R.jazzy.files.get(rel) || null;
}

// ---------------------------------------------------------------- colcon build
// Real workspace packages: everything under the package folder except sources goes to install/<pkg>/share/<pkg>
// (what their install() rules copy: launch, config, params, urdf, meshes, models, worlds, rviz, maps ...), executables
// to install/<pkg>/lib/<pkg>, Python modules to install/<pkg>/lib/python3.12/site-packages.
const NOT_SHARED = /^(src|include|test|tests|scripts\/test|\.github|docs?|doc)\//;
export function realPackagesIn(sh, ws) {
  const R = sh.realWs; if (!R || ws !== WSDIR) return [];
  return [...R.pkgs.values()].filter((p) => sh.fs.has(`${p.dir}/package.xml`));
}
export function realColconBuild(sh, rest) {
  const R = sh.realWs; const all = realPackagesIn(sh, WSDIR);
  let pkgs = all;
  const sel = rest.indexOf("--packages-select"), upto = rest.indexOf("--packages-up-to");
  const names = (i) => rest.slice(i + 1).filter((x) => !x.startsWith("-"));
  if (sel >= 0) pkgs = all.filter((p) => names(sel).includes(p.name));
  if (upto >= 0) {   // the packages and their dependencies inside the workspace
    const want = new Set(names(upto)), byName = new Map(all.map((p) => [p.name, p]));
    const stack = [...want]; while (stack.length) { const n = stack.pop(); for (const d of (byName.get(n) || {}).deps || []) if (byName.has(d) && !want.has(d)) { want.add(d); stack.push(d); } }
    pkgs = all.filter((p) => want.has(p.name));
  }
  // dependency order (colcon's topological order)
  const order = [], seen = new Set(), byName = new Map(pkgs.map((p) => [p.name, p]));
  const visit = (p) => { if (seen.has(p.name)) return; seen.add(p.name); for (const d of p.deps || []) if (byName.has(d)) visit(byName.get(d)); order.push(p); };
  pkgs.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(visit);
  for (const p of order) {
    const inst = `${WSDIR}/install/${p.name}`;
    for (const k of [...sh.fs.keys()]) if (k.startsWith(inst + "/")) sh.fs.delete(k);
    const share = `${inst}/share/${p.name}`;
    sh.mkdirP(share);
    for (const [path, node] of [...sh.fs]) {
      if (node.type !== "f" || !path.startsWith(p.dir + "/")) continue;
      const rel = path.slice(p.dir.length + 1);
      if (NOT_SHARED.test(rel) && !/\.(launch\.py|launch\.xml|yaml|urdf|xacro)$/.test(rel)) continue;
      // a nested package (a repo folder holding packages) is not part of this one
      if ([...R.pkgs.values()].some((q) => q !== p && q.dir.startsWith(p.dir + "/") && path.startsWith(q.dir + "/"))) continue;
      sh.mkdirP(`${share}/${rel}`.replace(/\/[^/]*$/, ""));
      sh.fs.set(`${share}/${rel}`, { ...node });
    }
    for (const [mod, rel] of Object.entries(p.py || {})) {
      const from = `${WSDIR}/${rel}`, to = `${inst}/lib/python3.12/site-packages/${mod}`;
      for (const [path, node] of [...sh.fs]) if (node.type === "f" && path.startsWith(from + "/")) { const dst = `${to}/${path.slice(from.length + 1)}`; sh.mkdirP(dst.replace(/\/[^/]*$/, "")); sh.fs.set(dst, { ...node }); }
    }
    sh.mkdirP(`${inst}/lib/${p.name}`);
    for (const e of p.exes || []) sh.fs.set(`${inst}/lib/${p.name}/${e}`, { type: "f", mode: "rwxr-xr-x", content: `#!/usr/bin/env bash\n# ${p.name} ${e} (built by colcon)\n` });
    R.built.set(p.name, Date.now());
  }
  // colcon prints Starting/Finished; C++ packages take longer than Python / description-only ones
  const secs = (p) => { const n = (p.exes || []).length; return p.build_type === "ament_python" ? 0.8 + n * 0.1 : n ? 6 + n * 4.5 : 0.9; };
  const L = [];
  let tot = 0;
  for (const p of order) L.push({ t: `Starting >>> ${p.name}` });
  for (const p of order) { const s = secs(p); tot = Math.max(tot, s); L.push({ t: `Finished <<< ${p.name} [${s.toFixed(1)}s]` }); }
  return { lines: L, pkgs: order, total: tot + order.length * 0.15 };
}

// ---------------------------------------------------------------- which ros2 launch goes through the real launch system
export function realOwns(sh, pkg) {
  const R = sh.realWs; if (!R) return false;
  if (R.pkgs.has(pkg)) return true;   // built or not: the launch system itself says "package not found" if not built/sourced
  const j = R.jazzy.files; return [...j.keys()].some((k) => k.startsWith(`share/${pkg}/launch/`));
}

// does `ros2 run <pkg> <exe>` use the models of this module? (the workspace's programs, Nav2 / SLAM tools)
export function realRunnable(sh, pkg, exe) {
  const R = sh.realWs; if (!R) return false;
  if (R.pkgs.has(pkg)) return true;
  if (nav2Role({ pkg, exe })) return true;
  return ["turtlebot3_teleop teleop_keyboard"].includes(`${pkg} ${exe}`);
}

// ---------------------------------------------------------------- mounting files into the launch system
async function prepareRuntime(sh, onStatus) {
  const R = sh.realWs;
  const rt = await getLaunchRuntime({ onStatus });
  if (!R.jazzyMounted) {
    await rt.mountZip("/opt/ros/jazzy", R.jazzy.zipBuf.slice(0));
    await rt.registerPackages("/opt/ros/jazzy", R.jazzy.index.packages, { bins: ["/opt/ros/jazzy/bin/xacro", "/usr/bin/gz", "/usr/bin/ruby"] });
    // every installed package has share/<pkg>/package.xml (ros_gz_sim's gz_sim.launch.py reads them all for plugin paths)
    const extra = [];
    for (const [name, info] of Object.entries(R.jazzy.index.packages || {})) {
      if (R.jazzy.files.has(`share/${name}/package.xml`)) continue;
      extra.push([`share/${name}/package.xml`, `<?xml version="1.0"?>\n<package format="3">\n  <name>${name}</name>\n  <version>${(info && info.version) || "0.0.0"}</version>\n  <description>${name} (ROS 2 Jazzy)</description>\n  <maintainer email="ros@example.org">ROS 2 Jazzy</maintainer>\n  <license>Apache-2.0</license>\n  <export>\n    <build_type>ament_cmake</build_type>\n  </export>\n</package>\n`]);
    }
    await rt.mount("/opt/ros/jazzy", extra);
    R.jazzyMounted = true;
  }
  // the workspace's install/<pkg> prefixes (only the ones built since the last mount)
  for (const [name, stamp] of R.built) {
    if (R.mounted.get(name) === stamp) continue;
    const inst = `${WSDIR}/install/${name}`, files = [];
    for (const [path, node] of sh.fs) {
      if (node.type !== "f" || !path.startsWith(inst + "/")) continue;
      const c = String(node.content ?? "");
      if (c.startsWith("@url:") || c.startsWith("@bytes:")) continue;   // meshes are not needed by launch files
      files.push([path.slice(inst.length + 1), c]);
    }
    await rt.mount(inst, files);
    const p = R.pkgs.get(name);
    await rt.registerPackages(inst, { [name]: { exes: p ? p.exes || [] : [] } });
    R.mounted.set(name, stamp);
  }
  return rt;
}
// the environment of this terminal, as `source install/setup.bash` makes it. The workspace's own variables
// (R.env, e.g. TURTLEBOT3_MODEL) are only what the page's buttons export: a terminal without them launches without them.
function launchEnv(sh) {
  const R = sh.realWs, env = { ...DEFAULT_ENV };
  for (const [k, v] of Object.entries(sh.env || {})) if (typeof v === "string") env[k] = v;
  const sourcedWs = String(sh.env.COLCON_PREFIX_PATH || "").split(":").includes(`${WSDIR}/install`);
  const prefixes = sourcedWs ? [...R.built.keys()].map((n) => `${WSDIR}/install/${n}`) : [];
  env.AMENT_PREFIX_PATH = [...prefixes.reverse(), sh.sourced ? "/opt/ros/jazzy" : null].filter(Boolean).join(":");
  env.HOME = HOME; env.PWD = sh.cwd;
  return env;
}

// ---------------------------------------------------------------- file access for the models
function fsFor(sh) {
  return {
    home: HOME, cwd: sh.cwd,
    read: (p) => {
      const path = sh.abs(String(p).replace(/^~(?=\/|$)/, HOME));
      const n = sh.node(path); if (!n || n.type !== "f") return null;
      const c = n.content;
      if (n.bytes) return n.bytes;
      if (typeof c === "string" && c.startsWith("@bytes:")) return jazzyBytes(sh, path);
      if (typeof c === "string" && c.startsWith("@url:")) return null;
      return c;
    },
    write: (p, data) => {
      const path = sh.abs(String(p).replace(/^~(?=\/|$)/, HOME));
      sh.mkdirP(path.replace(/\/[^/]*$/, ""));
      sh.fs.set(path, { type: "f", mode: "rw-r--r--", content: data instanceof Uint8Array ? (/\.pgm$/.test(path) ? pgmText(data) : dec.decode(data)) : String(data), bytes: data instanceof Uint8Array ? data : undefined });
    },
  };
}
const pgmText = (u8) => `(binary PGM image, ${u8.length} bytes)`;   // `cat map.pgm` shows this; the bytes stay on the node
export function syncResolver(sh) {
  return (path) => {
    const n = sh.node(String(path)); if (!n || n.type !== "f") return null;
    const c = n.content;
    if (n.bytes) return { bytes: n.bytes };
    if (typeof c === "string" && c.startsWith("@bytes:")) { const b = jazzyBytes(sh, path); return b ? { bytes: b } : null; }
    if (typeof c === "string" && c.startsWith("@url:")) return null;
    return { text: String(c ?? "") };
  };
}
export function asyncResolver(sh) {
  const sync = syncResolver(sh);
  return async (path) => {
    const s = sync(path); if (s) return s;
    const n = sh.node(String(path)); const m = n && String(n.content || "").match(/^@url:(.+)$/);
    if (!m) return null;
    const r = await fetch(m[1]); if (!r.ok) return null;
    return { bytes: new Uint8Array(await r.arrayBuffer()) };
  };
}

// ---------------------------------------------------------------- ros2 launch / ros2 run
// ui: { print(text, cls), nodes(fulls), paint(), done(rc), status?(text) }   returns { ctrlC(), done: Promise<rc> }
export function startRealLaunch(sh, argv, ui) {
  const R = sh.realWs;
  let job = null, cancelled = false;
  const ctx = makeContext(sh, ui, () => job);
  const adapting = new Map();   // node fqn -> promise of its model being started (lifecycle requests wait for it)
  const ctl = { ctrlC: () => { if (job) job.ctrlC(); else cancelled = true; }, done: null };
  // a launch file read os.environ['X'] for a variable this workspace needs (KeyError): the real error, then a hint
  const envHint = (l) => {
    const m = l.match(/^\[ERROR\] \[launch\]: Caught exception in launch \(see debug for traceback\): '(\w+)'$/);
    if (m && R.env && R.env[m[1]] !== undefined) ctx.emit(`(The launch file reads ${m[1]} from the environment, and this terminal has not set it. Set it first, then launch again: export ${m[1]}=${R.env[m[1]]})`, "hint");
    // map_server could not read map:= (missing file): after the localization bring-up aborts, say what to do
    const bad = l.match(/\[map_io\]: Failed processing YAML file (\S+) at position \(-1:-1\) for reason: bad file:/);
    if (bad) badMap = bad[1];
    if (badMap && /\[lifecycle_manager_localization\]: Failed to bring up all requested nodes\. Aborting bringup\./.test(l)) {
      ctx.emit(`(The map file ${badMap} does not exist, so map_server cannot start and Nav2 waits for a map that never comes; this launch keeps running until you press Ctrl+C. Save a map first with ros2 run nav2_map_server map_saver_cli -f ~/map, or pass map:= the path of an existing map .yaml file.)`, "hint");
      badMap = null;
    }
  };
  let badMap = null;
  ctx.onLine = (l) => { if (/\[(map_io|lifecycle_manager_localization)\]/.test(l)) envHint(l); };   // nav2 models print to the terminal directly
  ctl.done = (async () => {
    let rt;
    try { rt = await prepareRuntime(sh, (s) => ui.status && ui.status(s && s.text ? s.text : String(s))); }
    catch (e) { ctx.emit(`[ERROR] [launch]: the launch system could not start in this browser: ${e.message}`, "err"); ui.done(1); return 1; }
    if (cancelled) { ui.done(130); return 130; }
    job = rt.launch(["ros2", "launch", ...argv], {
      env: launchEnv(sh), cwd: sh.cwd,
      onOutput: (text, stream) => { for (const l of String(text).replace(/\n$/, "").split("\n")) { const m = l.match(/^\[INFO\] \[launch\]: All log files can be found below \S*-(\d+)$/); if (m) ctx.launchPid = Number(m[1]); ctx.emit(l, stream === "err" ? "err" : ""); envHint(l); } },
      onProcess: (info) => { const a = ctx.adapt(info, { exit: (rc) => job.exit(info.pid, rc), prefix: true }).catch((e) => { ctx.emit(`(ROS2Lab could not model ${info.name || "a process"}: ${e.message})`, "hint"); console.error(e); }); if (info.ros && info.ros.fqn) adapting.set(info.ros.fqn, a); },
      onExit: (pid) => ctx.cleanup(pid),
      onLoadComposable: (req) => { ctx.launchNode(); return ctx.loadComposable(req); },
      onLifecycle: async (req) => {
        const full = `/${String(req.node || "").replace(/^\/+/, "")}`, a = adapting.get(full);
        if (a) await Promise.race([a, new Promise((r) => setTimeout(r, 5000))]);   // the node's model is being started
        ctx.launchNode(`${full}/transition_event`); return nav2Lifecycle(sh.graph, req.node, req.transition) || null;
      },
    });
    R.jobs.add(job);
    const rc = await job.done;
    R.jobs.delete(job);
    ctx.finish();
    ui.done(rc);
    return rc;
  })();
  return ctl;
}
// ros2 run <pkg> <exe> [args] [--ros-args ...] for the real workspace's and /opt/ros/jazzy's programs, with the same
// models as ros2 launch (no launch system: the program's own output, no [tag] prefix)
let runPid = 7300;
export function startRealRun(sh, pkg, exe, rest, ui) {
  const pid = runPid += 3, cmd = [`/opt/ros/jazzy/lib/${pkg}/${exe}`, ...rest];
  const R = sh.realWs;
  if (R && R.built.has(pkg)) cmd[0] = `${WSDIR}/install/${pkg}/lib/${pkg}/${exe}`;
  let done = false, resolveDone;
  const ctx = makeContext(sh, ui, () => null);
  const finish = (rc) => { if (done) return; done = true; ctx.cleanup(pid); ctx.finish(); ui.done(rc); resolveDone(rc); };
  const ros = { package: pkg, executable: exe, name: exe, namespace: "/" };
  const files = {}, ri = cmd.indexOf("--ros-args");
  for (let i = ri; ri >= 0 && i < cmd.length; i++) {
    if (cmd[i] === "-r" && /^__node:=/.test(cmd[i + 1] || "")) ros.name = cmd[i + 1].split(":=")[1];
    if (cmd[i] === "-r" && /^__ns:=/.test(cmd[i + 1] || "")) ros.namespace = cmd[i + 1].split(":=")[1];
    if (cmd[i] === "--params-file" && cmd[i + 1]) { const t = fsFor(sh).read(cmd[i + 1]); if (t != null) files[cmd[i + 1]] = String(t); }
  }
  ros.fqn = `${ros.namespace === "/" ? "" : ros.namespace}/${ros.name}`;
  const params = {};
  for (const t of Object.values(files)) Object.assign(params, paramsFromYaml(t, ros));
  for (let i = ri; ri >= 0 && i < cmd.length; i++) if (cmd[i] === "-p" && cmd[i + 1] && cmd[i + 1].includes(":=")) { const [k, v] = cmd[i + 1].split(":="); params[k] = scalar(v); }
  const p = new Promise((r) => { resolveDone = r; });
  ctx.adapt({ pid, cmd, env: launchEnv(sh), cwd: sh.cwd, name: exe, shell: false, files, ros, params }, { exit: finish, prefix: false })
    .catch((e) => { ctx.emit(`(ROS2Lab could not model ${pkg} ${exe}: ${e.message})`, "hint"); finish(1); });
  return { ctrlC: () => { ui.print("^C[INFO] [rclcpp]: signal_handler(signum=2)"); finish(0); }, done: p };
}
const scalar = (v) => (/^(true|false)$/i.test(v) ? v.toLowerCase() === "true" : /^-?\d+(\.\d*)?(e-?\d+)?$/i.test(v) ? Number(v) : v.replace(/^["']|["']$/g, ""));
// a params file's ros__parameters for this node (tiny reader: flat "key: value" lines under ros__parameters)
function paramsFromYaml(text, ros) {
  const out = {}; let inNode = false, inParams = false, base = -1;
  for (const raw of String(text).split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const ind = raw.length - raw.trimStart().length, line = raw.trim();
    if (ind === 0) { const k = line.replace(/:.*$/, "").replace(/^["']|["']$/g, ""); inNode = ["/**", "**", ros.name, ros.fqn, ros.fqn.replace(/^\//, "")].includes(k); inParams = false; continue; }
    if (inNode && /^ros__parameters:\s*$/.test(line)) { inParams = true; base = -1; continue; }
    if (inParams) { if (base < 0) base = ind; if (ind !== base) continue; const m = line.match(/^([\w.]+):\s*(.+)$/); if (m) out[m[1]] = scalar(m[2].trim()); }
  }
  return out;
}

function makeContext(sh, ui, getJob) {
  const R = sh.realWs, g = sh.graph;
  g.nav2Api = NAV2;   // ros-graph.js / terminal-sim.js reach the Nav2 models through this (they do not import nav2-sim.js)
  const fulls = new Set(), byPid = new Map(), fqnPid = new Map();
  let finished = false;
  const fs = fsFor(sh), resolve = syncResolver(sh), resolveAsync = asyncResolver(sh);
  g.gzResolve = resolve;
  const emit = (text, cls) => { ui.print(text, cls); if (ctx.onLine && cls !== "hint") ctx.onLine(String(text)); };
  const lines = (arr) => { for (const l of arr || []) { if (l == null) continue; if (typeof l === "string") emit(l, /\[(ERROR|FATAL)\]|\[Err\]/.test(l) ? "err" : /\[(WARN)\]|\[Wrn\]/.test(l) ? "warn" : ""); else emit(l.text, l.cls); } };
  const slot = (pid) => byPid.get(pid) || byPid.set(pid, { fulls: [], nav2: [] }).get(pid);
  const track = (pid, full) => { if (!full) return; fulls.add(full); slot(pid).fulls.push(full); ui.nodes([...fulls]); };
  const trackNav2 = (pid, full) => { slot(pid).nav2.push(full); fulls.add(full); ui.nodes([...fulls]); };
  const waitFor = async (pred, ms = 30000, step = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (finished) return false; if (pred()) return true; await new Promise((r) => setTimeout(r, step)); } return pred(); };
  const ctx = {
    emit,
    finish() { finished = true; for (const pid of [...byPid.keys()]) ctx.cleanup(pid); },
    // launch_ros creates its node (launch_ros_<pid of ros2 launch>, the number its log directory ends with) when it
    // first needs ROS: lifecycle transition events or loading composable nodes
    launchPid: null,
    launchNode(watch) {
      if (ctx.launchPid == null) return;
      const full = `/launch_ros_${ctx.launchPid}`;
      let n = g.node(full);
      if (!n) { n = g.add("launch_ros", full.slice(1), "", {}); n.watch = []; track(ctx.launchPid, full); }
      if (watch && !n.watch.includes(watch)) n.watch.push(watch);
    },
    cleanup(pid) {
      const b = byPid.get(pid); if (!b) return;
      byPid.delete(pid);
      for (const f of b.nav2) { stopNav2Node(g, f); fulls.delete(f); }
      for (const f of b.fulls) { if (g.node(f)) g.stop(f); fulls.delete(f); }
      ui.nodes([...fulls]); ui.paint();
    },
    async loadComposable(req) {
      const pid = fqnPid.get(req.container) ?? -1, results = [];
      for (const nd of req.nodes || []) {
        const m = startNav2Node(g, { ...nd, fs, write: (t, s) => emit(t, s === "err" ? "err" : "") });
        if (m) { trackNav2(pid, m.full); results.push({ success: true, full_node_name: m.full }); }
        else results.push({ success: true, full_node_name: `${String(nd.namespace || "").replace(/\/$/, "")}/${nd.name}` });
      }
      ui.paint();
      return results.length === 1 ? results[0] : results;
    },
    // files the launch wrote into ITS /tmp (e.g. xArm's generated controllers yaml named in the URDF's
    // <gz_ros2_control> <parameters>): copy them into the practice file system before a program needs them
    async pullTmp(text) {
      const paths = [...new Set(String(text || "").match(/\/tmp\/[\w.\-\/]+\.(?:ya?ml|json|urdf|xacro|sdf)\b|\/tmp\/launch_params_\w+/g) || [])].filter((q) => !sh.node(q));
      if (!paths.length) return;
      const job = getJob(); if (!job || !job.readFile) return;
      for (const q of paths) { try { const r = await Promise.race([job.readFile(q), new Promise((res) => setTimeout(() => res(null), 3000))]); const t = r && (r.text ?? r.content ?? (typeof r === "string" ? r : null)); if (t != null) { sh.mkdirP("/tmp"); sh.fs.set(q, { type: "f", mode: "rw-------", content: String(t) }); } } catch { /* not there */ } }
    },
    async adapt(info, { exit, prefix }) {
      const ros = info.ros || {}, pkg = ros.package, exe = ros.executable, tag = info.name || `${exe}`;
      const pid = info.pid, params = info.params || {};
      if (ros.fqn) fqnPid.set(ros.fqn, pid);
      const P = (t) => (prefix ? `[${tag}] ${t}` : t);
      const cmdline = info.cmd.join(" ");
      const ri = info.cmd.indexOf("--ros-args"), args = ri >= 0 ? info.cmd.slice(1, ri) : info.cmd.slice(1);
      const remaps = []; for (let i = 0; i < info.cmd.length; i++) if ((info.cmd[i] === "-r" || info.cmd[i] === "--remap") && info.cmd[i + 1] && !/^__/.test(info.cmd[i + 1])) { const [a, b] = info.cmd[i + 1].split(":="); remaps.push([a, b]); }
      const ns = ros.namespace && ros.namespace !== "/" ? ros.namespace : "";
      // the node name a program gives itself when the launch file sets none
      const DEFAULT_NODE = { ros2_control_node: "controller_manager", parameter_bridge: "ros_gz_bridge", image_bridge: "ros_gz_image", create: "ros_gz_sim", move_group: "move_group", rviz2: "rviz2" };
      const nodeRemap = ((info.cmd.find((x) => /^__node:=/.test(x)) || "").split(":=")[1]) || null;   // Node(name=...) is passed as -r __node:=<name>
      const nodeName = String((ros.name && ros.name !== exe ? ros.name : null) || nodeRemap || DEFAULT_NODE[exe] || ros.name || exe).split("/").pop();   // (Node(namespace='') reports "/rviz2")
      const T = prefix ? tag : undefined;
      // ---- Gazebo (gz sim, started through a shell by ros_gz_sim's gz_sim.launch.py)
      if (info.shell && /\bgz\b.*\bsim\b/.test(cmdline)) {
        const r = g.gzSim(info.cmd, { tag: T, env: info.env, resolve, resolveAsync });
        if (r.err) { lines(r.err); exit(255); return; }
        lines(r.lines);
        if (!r.guiOnly && r.node) { r.node.pid = pid; r.node.procName = tag; track(pid, r.node.full); }
        ui.paint(); return;
      }
      // ---- a ros2 CLI command run by the launch file (ExecuteProcess: ros2 control load_controller ..., ros2 param set ...)
      if (/(^|\/)ros2$/.test(info.cmd[0]) && !info.shell) {
        // Dobot's controller_loader.py (dobot_gazebo): waits for controller_manager, then loads and activates
        // <robot>_group_controller and joint_state_broadcaster (its workaround for the spawner)
        if (info.cmd[1] === "run" && /controller_loader\.py$/.test(info.cmd[3] || "")) {
          const robot = info.cmd[4] || "cr5", L = (lv, t) => emit(P(`[${lv}] [${stamp()}] [controller_loader]: ${t}`), lv === "ERROR" || lv === "FATAL" ? "err" : "");
          L("INFO", "Waiting for controller_manager...");
          const okCm = await waitFor(() => !!(g.cmFind && g.cmFind("/controller_manager")), 60000, 500);
          if (!okCm) { L("FATAL", "Timeout waiting for controller_manager"); exit(1); return; }
          L("INFO", "Controller manager ready"); L("INFO", "Waiting for hardware interfaces...");
          const names = [`${robot}_group_controller`, "joint_state_broadcaster"];
          L("INFO", `Loading (parallel): [${names.map((x) => `'${x}'`).join(", ")}]`);
          const r = g.spawnerRun(names, { tag: T, inline: true });
          if (r.gzLines && r.gzLines.length) lines(r.gzLines.map((t) => `[${(g.gz && (g.node(g.gz.node) || {}).procName) || "gazebo"}] ${t}`));
          L(r.fail ? "ERROR" : "INFO", r.fail ? `Could not activate: ${r.hint || "see controller_manager"}` : `All controllers active: [${names.map((x) => `'${x}'`).join(", ")}]`);
          ui.paint(); exit(r.fail ? 1 : 0); return;
        }
        if (info.cmd[1] === "run" && info.cmd[2] === "controller_manager" && info.cmd[3] === "spawner") {   // ros2 run ... spawner: waits for controller_manager like the program does
          const sargs = info.cmd.slice(4); let r = null;
          await waitFor(() => { r = g.spawnerRun(sargs, { tag: T, inline: true }); const first = r.lines[0]; return !r.fail || !/waiting for service/.test(String(first && (first.text || first))); }, 60000, 500);
          lines(r.lines);
          if (r.gzLines && r.gzLines.length) lines(r.gzLines.map((t) => `[${r.cmTag || (g.gz && (g.node(g.gz.node) || {}).procName) || "controller_manager"}] ${t}`));
          ui.paint(); exit(r.fail ? 1 : 0); return;
        }
        const r = sh.ros2(info.cmd.slice(1));
        const out = Array.isArray(r) ? r : (r && r.lines) || [];
        lines(out.map((l) => ({ text: P(l.text), cls: l.cls })));
        exit(out.some((l) => l.cls === "err") ? 1 : 0); return;
      }
      // ---- Nav2, SLAM, map saver
      const nav = startNav2Node(g, { pkg, exe, name: nodeName, ns, params, parameter_files: info.files, remaps, args, pid, fs,
        write: (t, s) => emit(P(t), s === "err" ? "err" : ""), exit });
      if (nav) { trackNav2(pid, nav.full); ui.paint(); return; }
      const key = `${pkg} ${exe}`;
      (g.procInfos || (g.procInfos = {}))[key] = info;   // what the launch system started (for debugging and tests)
      if (exe === "wait_for_robot_description") {   // ur_robot_driver/scripts/wait_for_robot_description: logs, waits for /robot_description, exits
        const topic = `${ns ? "/" + ns.replace(/^\/|\/$/g, "") : ""}/robot_description`;
        const n = g.add("custom", "wait_for_robot_description", ns, {}, remaps); n.pid = pid; n.procName = tag;
        n.info = { pubs: [], subs: [[topic, "std_msgs/msg/String"]], srvs: [], cli: [], acts: [], actc: [] };
        track(pid, n.full); ui.paint();
        const L = (t) => emit(P(`[INFO] [${stamp()}] [wait_for_robot_description]: ${t}`));
        L(`Waiting for message on ${topic}.`);
        const ok = await waitFor(() => g.nodes.some((x) => x.kind === "rsp" && x.params.robot_description), 30000, 300);
        if (ok) L(`Received message on ${topic}. Shutting down.`);
        exit(0); return;
      }
      if (key === "ur_robot_driver trajectory_until_node") {   // ur_robot_driver/src/trajectory_until_node.cpp: ~/execute server, client of <motion_controller>/follow_joint_trajectory
        const mc = String(params.motion_controller || "scaled_joint_trajectory_controller");
        const n = g.add("custom", nodeName, ns, { motion_controller: mc, ...params }, remaps); n.pid = pid; n.procName = tag; n.unmodelled = key;
        n.info = { pubs: [], subs: [], srvs: [], cli: [], acts: [["~/execute", "ur_msgs/action/FollowJointTrajectoryUntil"]], actc: [[`${ns ? "/" + ns.replace(/^\/|\/$/g, "") : ""}/${mc.replace(/^\//, "")}/follow_joint_trajectory`, "control_msgs/action/FollowJointTrajectory"]] };
        track(pid, n.full);
        emit(`(ROS2Lab: ${pkg}/${exe} is running and its action server and parameters are listed, but the practice computer has no model of how it handles goals.)`, "hint");
        ui.paint(); return;
      }
      const gzTag = () => (g.gz && (g.node(g.gz.node) || {}).procName) || "gazebo";
      switch (key) {
        case "ros_gz_sim create": {
          await ctx.pullTmp(info.cmd.join(" ") + (g.nodes.find((x) => x.kind === "rsp" && x.params.robot_description) || { params: {} }).params.robot_description);
          let r = null;   // create waits for Gazebo's create service, and for /robot_description with -topic
          await waitFor(() => { r = g.gzCreate(info.cmd.slice(1), { tag: T, env: info.env, resolve, resolveAsync }); return !r.fail || !(r.waiting || /Timed out when getting world names/.test(r.lines.join("\n"))); }, 30000, 400);
          lines(r.lines);
          if (r.gzErr && r.gzErr.length && g.gz) lines(r.gzErr.map((t) => `[${gzTag()}] ${t}`));
          if (r.gzInfo && r.gzInfo.length && g.gz) lines(r.gzInfo.map((t) => `[${gzTag()}] ${t}`));
          ui.paint(); exit(r.fail ? 255 : 0); return;
        }
        case "ros_gz_bridge parameter_bridge": {
          const n = g.add("gz_bridge", nodeName, ns, params, remaps);
          const br = g.bridgeEntries(args, { config_file: params.config_file });
          if (br.err) { emit(P(br.err), "err"); g.stop(n.full); exit(1); return; }
          n.bridge = br.entries; n.bridgeBad = br.bad; n.bridgeLog = br.L; n.pid = pid; n.procName = tag;
          lines(g.bridgeLines(n, T)); track(pid, n.full); ui.paint(); return;
        }
        case "ros_gz_image image_bridge": {
          const n = g.add("gz_image", nodeName, ns, params, remaps);
          n.bridge = args.filter((x) => !x.startsWith("-")).map((t) => ({ ros: t.startsWith("/") ? t : "/" + t, gz: t.startsWith("/") ? t : "/" + t, rosType: "sensor_msgs/msg/Image", gzType: "gz.msgs.Image", dir: "GZ_TO_ROS" }));
          n.pid = pid; n.procName = tag; track(pid, n.full); ui.paint(); return;
        }
        case "robot_state_publisher robot_state_publisher": {
          // robot_state_publisher <urdf file> (positional argument, still accepted on Jazzy) instead of the parameter
          const positional = !params.robot_description && !!args[0] && !args[0].startsWith("-");
          if (positional) { const t = fs.read(args[0]); if (t != null) params.robot_description = String(t); }
          const n = g.add("rsp", nodeName, ns, params, remaps);
          n.pid = pid; n.procName = tag;
          if (positional) lines([P(`[WARN] [${stamp()}] [${nodeName}]: No robot_description parameter, but command-line argument available.  Assuming argument is name of URDF file.  This backwards compatibility fallback will be removed in the future.`)]);
          if (!params.robot_description) lines([P(`[ERROR] [${stamp()}] [${nodeName}]: robot_description parameter must not be empty`)]);
          else lines(g.rspMessages(n).map((s) => P(s.replace(/^\[(INFO|WARN|ERROR)\] \[robot_state_publisher\]/, `[$1] [${stamp()}] [${nodeName}]`))));
          track(pid, n.full); ui.paint(); return;
        }
        case "joint_state_publisher joint_state_publisher": case "joint_state_publisher_gui joint_state_publisher_gui": {
          const n = g.add(exe === "joint_state_publisher" ? "jsp" : "jsp_gui", nodeName, ns, params, remaps);
          n.pid = pid; n.procName = tag; track(pid, n.full); ui.paint(); return;
        }
        case "tf2_ros static_transform_publisher": {
          const n = g.add("static_tf", nodeName, ns, params, remaps);
          const get = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : 0; };
          const { qRPY } = await import("./urdf-core.js");
          n.tf = { parent: get("frame-id"), child: get("child-frame-id"), t: [+get("x"), +get("y"), +get("z")], q: qRPY(+get("roll"), +get("pitch"), +get("yaw")) };
          n.pid = pid; n.procName = tag; track(pid, n.full); ui.paint(); return;
        }
        case "rviz2 rviz2": {
          const n = g.add("rviz", nodeName, ns, params, remaps);
          n.pid = pid; n.procName = tag; track(pid, n.full);
          const di = Math.max(args.indexOf("-d"), args.indexOf("--display-config"));
          const path = di >= 0 ? args[di + 1] : null;
          lines([P(`[INFO] [${stamp()}] [rviz2]: Stereo is NOT SUPPORTED`), P(`[INFO] [${stamp()}] [rviz2]: OpenGl version: 4.6 (GLSL 4.6)`), P(`[INFO] [${stamp()}] [rviz2]: Stereo is NOT SUPPORTED`)]);
          if (path) {
            const t = fs.read(path);
            if (t == null) emit(P(`[ERROR] [${stamp()}] [rviz2]: Could not load config file '${path}'`), "err");
            else { const rr = g.rvizConfig(path, String(t)); if (rr) lines(rr); if (sh.viz) sh.viz.configName = path; }
          } else g.rvizConfig(null, null);
          ui.paint(); return;
        }
        case "controller_manager spawner": {
          let r = null;
          await waitFor(() => { r = g.spawnerRun(args, { tag: T, inline: true }); const first = r.lines[0]; return !r.fail || !/waiting for service/.test(String(first && (first.text || first))); }, 30000, 500);
          lines(r.lines);
          if (r.gzLines && r.gzLines.length) lines(r.gzLines.map((t) => `[${r.cmTag || gzTag()}] ${t}`));
          ui.paint(); exit(r.fail ? 1 : 0); return;
        }
        case "controller_manager ros2_control_node": {
          // Jazzy's controller_manager waits for /robot_description (robot_state_publisher may start after it)
          await waitFor(() => g.nodes.some((x) => x.kind === "rsp" && x.params.robot_description), 30000, 200);
          await ctx.pullTmp(JSON.stringify(params) + (g.nodes.find((x) => x.kind === "rsp" && x.params.robot_description) || { params: {} }).params.robot_description);
          // every --params-file in order, as rcl reads them (later files add to and override earlier ones; repeated keys merge)
          const pf = []; for (let i = 0; i < info.cmd.length; i++) if (info.cmd[i] === "--params-file" && info.files && info.files[info.cmd[i + 1]] != null) pf.push([info.cmd[i + 1], info.files[info.cmd[i + 1]]]);
          const withCm = pf.filter(([, t]) => /^\s*\/?controller_manager:\s*$/m.test(t));
          const yamlText = withCm.length ? pf.filter(([, t]) => !/^\s*robot_description(_semantic)?:/m.test(t)).map(([, t]) => t.replace(/^---\s*$/m, "")).join("\n") : null;   // the URDF comes from /robot_description
          const res = g.cmNodeStart({ n: { name: nodeName, ns, files: [], remaps }, tag, yamlText, yamlPath: withCm.length ? withCm[withCm.length - 1][0] : undefined }, {}, []);
          lines(res.lines);
          const cmNode = g.nodes.find((x) => x.kind === "cm" && x.procName === tag);
          if (cmNode) { cmNode.pid = pid; track(pid, cmNode.full); }
          ui.paint(); if (res.died) exit(1); return;
        }
        case "moveit_ros_move_group move_group": {
          if (typeof g.moveGroupFromParams === "function") {
            // MoveIt (Jazzy) reads robot_description from the /robot_description topic when the parameter is not set
            const fromTopic = ["robot_description", "robot_description_semantic"].filter((k) => !params[k]);
            if (!params.robot_description) {
              await waitFor(() => g.nodes.some((x) => x.kind === "rsp" && x.params.robot_description), 30000, 300);
              const rsp = g.nodes.find((x) => x.kind === "rsp" && x.params.robot_description);
              if (rsp) params.robot_description = rsp.params.robot_description;
            }
            if (!params.robot_description_semantic) {   // ... and /robot_description_semantic
              const other = g.nodes.find((x) => x.params && x.params.robot_description_semantic);
              if (other) params.robot_description_semantic = other.params.robot_description_semantic;
            }
            const res = g.moveGroupFromParams({ name: nodeName, ns, params, tag: T, fromTopic });
            lines(res.lines); if (res.node) { res.node.pid = pid; track(pid, res.node.full); }
            ui.paint(); if (res.died) exit(1); return;
          }
          break;
        }
        case "moveit_configs_utils wait_for_robot_description": case "moveit_ros_move_group wait_for_robot_description": {
          await waitFor(() => g.nodes.some((x) => x.kind === "rsp" && x.params.robot_description), 30000, 300);
          exit(0); return;
        }
      }
      if (pkg === "rclcpp_components" && /^component_container/.test(exe)) {   // composition container (Nav2 loads its servers into it)
        const n = g.add("custom", nodeName, ns, params, remaps); n.pid = pid; n.procName = tag; n.container = true; track(pid, n.full); return;
      }
      if (key === "crazyflie_sim crazyflie_server") {   // Crazyswarm2's simulator node, modelled in cf-sim.js
        const n = g.add("cf_sim", nodeName, ns, {}, remaps);
        const names = g.cfInit(n, params, (t, s) => emit(P(t), s || ""));
        if (!names.length) lines([P(`[INFO] [${stamp()}] [${nodeName}]: no enabled Crazyflie in crazyflies.yaml`)]);
        emit(`(ROS2Lab: crazyflie_sim is modelled: ${names.join(", ")} take off, land and go_to along the high-level commander's planned trajectory and appear in RViz through /tf (world -> ${names[0] || "cf"}). The firmware bindings (cffirmware: controller, estimator) and the rigid-body physics are not run.)`, "hint");
        n.pid = pid; n.procName = tag; track(pid, n.full); ui.paint(); return;
      }
      if (key === "crazyflie_examples hello_world") {   // takeoff 1.0 m in 2.5 s, hover, land to 0.04 m in 2.5 s (hello_world.py)
        const n = g.add("custom", "CrazyflieAPI", ns, params, remaps); n.pid = pid; n.procName = tag; track(pid, n.full); ui.paint();
        await waitFor(() => g.cfSims().length > 0, 600000, 300);   // Crazyswarm() waits for all/emergency, all/takeoff, ...
        const srv = g.cfSims()[0]; if (!srv) { exit(1); return; }
        const cf = srv.cfNames[0]; if (!cf) { emit(P("IndexError: list index out of range"), "err"); exit(1); return; }
        const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
        g.cfCall(srv, cf, "takeoff", { height: 1.0, duration: { sec: 2, nanosec: 500000000 } }); ui.paint();
        await sleep(2.5 + 5.0);
        if (!g.node(srv.full)) { exit(1); return; }
        g.cfCall(srv, cf, "land", { height: 0.04, duration: { sec: 2, nanosec: 500000000 } }); ui.paint();
        await sleep(2.5);
        exit(0); return;
      }
      if (key === "turtlebot3_fake_node turtlebot3_fake_node") {   // modelled in tb3-fake.js (odom / joint_states / tf from cmd_vel)
        const n = g.add("tb3_fake", nodeName, ns, params, remaps);
        lines(g.fakeInit(n, params, info.files).map(P));
        n.pid = pid; n.procName = tag; track(pid, n.full); ui.paint(); return;
      }
      if (key === "turtlebot3_teleop teleop_keyboard" || key === "teleop_twist_keyboard teleop_twist_keyboard") {
        const n = g.add("teleop_twist", nodeName, ns, params, remaps); n.speed = 0.5; n.turn = 1.0; n.tb3 = key.startsWith("turtlebot3"); if (n.tb3) n.params.stamped = true;
        n.pid = pid; n.procName = tag; track(pid, n.full);
        if (key.startsWith("turtlebot3")) lines(TB3_TELEOP_BANNER.split("\n").map(P));
        ui.paint(); return;
      }
      if (key === "franka_gripper fake_gripper_state_publisher.py") {   // franka's fake gripper: ~/joint_states at 10 Hz, both fingers at 0.035
        const n = g.add("fake_gripper", nodeName, ns, params, remaps); n.pid = pid; n.procName = tag; track(pid, n.full); ui.paint(); return;
      }
      if (key === "dobot_moveit fake_demo_server") {   // dobot_moveit/fake_demo_server.py: /joint_states + <robot_type>_group_controller/follow_joint_trajectory, no ros2_control
        const r = g.fakeDemoInit(nodeName, ns, params, remaps);
        r.node.pid = pid; r.node.procName = tag;
        lines(r.lines.map(P)); track(pid, r.node.full); ui.paint(); return;
      }
      const driver = REAL_DRIVERS[key];
      if (driver) { lines(driver().map(P)); exit(1); return; }
      const n = g.add("custom", nodeName, ns, params, remaps); n.pid = pid; n.procName = tag; n.unmodelled = key;
      track(pid, n.full);
      emit(`(ROS2Lab: ${pkg ? `${pkg}/${exe}` : info.cmd[0]} is running, but the practice computer has no model of what this program does: it only appears in ros2 node list.)`, "hint");
      ui.paint();
    },
  };
  void R;
  return ctx;
}
const TB3_TELEOP_BANNER = `
Control Your TurtleBot3!
---------------------------
Moving around:
        w
   a    s    d
        x

w/x : increase/decrease linear velocity (Burger : ~ 0.22, Waffle and Waffle Pi : ~ 0.26)
a/d : increase/decrease angular velocity (Burger : ~ 2.84, Waffle and Waffle Pi : ~ 1.82)

space key, s : force stop

CTRL-C to quit
`;
const stamp = () => { const t = Date.now() / 1000; return `${Math.floor(t)}.${String(Math.floor((t % 1) * 1e9)).padStart(9, "0")}`; };

// What the makers' drivers print when the robot is not connected (the practice computer has no USB / Ethernet robot)
const REAL_DRIVERS = {
  "turtlebot3_node turtlebot3_ros": () => [`[INFO] [${stamp()}] [turtlebot3_node]: Init TurtleBot3 Node Main`, `[INFO] [${stamp()}] [turtlebot3_node]: Init DynamixelSDKWrapper`, `[ERROR] [${stamp()}] [DynamixelSDKWrapper]: Failed to open the port(/dev/ttyACM0)!`, `[ERROR] [${stamp()}] [DynamixelSDKWrapper]: Failed to init DynamixelSDKWrapper`],
  "hls_lfcd_lds_driver hlds_laser_publisher": () => [`terminate called after throwing an instance of 'boost::wrapexcept<boost::system::system_error>'`, `  what():  open: No such file or directory [system:2]`],
  "ld08_driver ld08_driver": () => [`[ERROR] [${stamp()}] [ld08_driver]: Failed to open port /dev/ttyUSB0`],
  "ur_robot_driver ur_ros2_control_node": () => [`[ERROR] [${stamp()}] [UR_Client_Library:]: Failed to connect to robot on IP 192.168.56.101. Please check that the robot is booted and reachable on 192.168.56.101.`],
  "kortex_driver kortex_driver": () => [`[ERROR] [${stamp()}] [KortexMultiInterfaceHardware]: Connection to the arm failed (192.168.1.10)`],
};

// the official workspace of a gallery robot, if it has one
let wsIndexP = null;
export async function workspaceFor(robotId) {
  if (!wsIndexP) wsIndexP = fetch("/robots/ws/index.json").then((r) => (r.ok ? r.json() : { workspaces: {} })).catch(() => ({ workspaces: {} }));
  const idx = await wsIndexP;
  for (const [id, w] of Object.entries(idx.workspaces || {})) if ((w.robots || []).includes(robotId)) return { id, ...w };
  return null;
}
