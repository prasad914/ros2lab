// ROS2Lab launch worker: one Pyodide interpreter running the REAL ROS 2 Jazzy launch system (ros2/launch,
// launch_ros, ros2launch, xacro ... unpacked from /ros/launch-runtime/py.zip into /opt/ros/jazzy). No program is
// started: every process a launch file would start is reported to the page (type "process"), which runs its own
// model of that program and tells the launch system what the program prints and when it exits.
// One worker runs one `ros2 launch` at a time (a launch is a separate OS process on Ubuntu too: its own os.environ,
// pids, log directory and module state); launch-runtime.js starts more workers for concurrent launches.
// Protocol: see launch-runtime.js (the only user of this file).
const PYODIDE_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";
const PREFIX = "/opt/ros/jazzy";
const SITE = PREFIX + "/lib/python3.12/site-packages";
// programs that exist on an Ubuntu 24.04 + ros-jazzy-desktop-full + ros-jazzy-ros-gz machine and that launch files
// run directly (ExecuteProcess / FindExecutable); they are never executed here, they only have to be found
const BASE_BINS = [PREFIX + "/bin/ros2", PREFIX + "/bin/xacro", "/usr/bin/gz", "/usr/bin/ruby", "/usr/bin/python3",
  "/usr/bin/env", "/usr/bin/bash", "/usr/bin/sh", "/bin/sh", "/bin/bash", "/usr/bin/xterm"];

let py = null, R = null;
const pending = new Map();   // host request id -> resolve (answers to load_composable / lifecycle)
let reqSeq = 0;

const post = (m) => self.postMessage(m);
const status = (text, extra = {}) => post({ type: "status", text, ...extra });

function mkdirp(dir) { py.FS.mkdirTree(dir); }
function writeFile(path, data) {
  mkdirp(path.slice(0, path.lastIndexOf("/")) || "/");
  py.FS.writeFile(path, data);
}
function stub(path) {
  try { if (py.FS.analyzePath(path).exists) { py.FS.chmod(path, 0o755); return; } } catch { /* create */ }
  writeFile(path, "#!/bin/sh\n# ROS2Lab: this program is modelled by the website, it is not executed\n");
  py.FS.chmod(path, 0o755);
}

async function fetchWithProgress(url, label, expected) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || expected || 0;
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0, last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (got - last > 65536) { last = got; status(label, { loaded: got, total }); }
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  return buf;
}

// ---------------------------------------------------------------------------------------------- host (Python -> JS)
const HOST = {
  emit(job, stream, text) { post({ type: "out", job, stream, text }); },
  started(job, infoJson) { post({ type: "process", job, info: JSON.parse(infoJson) }); },
  signal(job, pid, signum) { post({ type: "signal", job, pid, signum }); },
  exited(job, pid, rc) { post({ type: "exit", job, pid, rc }); },
  done(job, code) { post({ type: "done", job, code }); },
  load_composable(job, reqJson) { return ask("loadComposable", job, reqJson); },
  lifecycle(job, reqJson) { return ask("lifecycle", job, reqJson); },
};
function ask(type, job, reqJson) {
  const reqId = ++reqSeq;
  return new Promise((resolve) => {
    pending.set(reqId, resolve);
    post({ type, job, reqId, request: JSON.parse(reqJson) });
  });
}

// ---------------------------------------------------------------------------------------------- boot
async function init({ zipUrl, zipBytes, pyodideUrl }) {
  const t0 = performance.now();
  status("Loading the ROS 2 launch system… (Python runtime)", { stage: "pyodide" });
  const base = pyodideUrl || PYODIDE_URL;
  const { loadPyodide } = await import(base + "pyodide.mjs");
  py = await loadPyodide({ indexURL: base });
  py.setStdout({ batched: (s) => console.log("[launch-worker]", s) });
  py.setStderr({ batched: (s) => console.warn("[launch-worker]", s) });
  const t1 = performance.now();
  const zip = await fetchWithProgress(zipUrl, "Loading the ROS 2 launch system…", zipBytes);
  mkdirp(PREFIX);
  py.unpackArchive(zip, "zip", { extractDir: PREFIX });
  for (const b of BASE_BINS) stub(b);
  mkdirp("/home/student"); mkdirp("/tmp");
  status("Starting the ROS 2 launch system…", { stage: "import" });
  const t2 = performance.now();
  py.runPython(`
import os, sys
sys.path.insert(0, ${JSON.stringify(SITE)})
os.environ.update({"AMENT_PREFIX_PATH": "${PREFIX}", "HOME": "/home/student", "ROS_DISTRO": "jazzy", "ROS_VERSION": "2",
                   "PATH": "${PREFIX}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"})
import r2l_launch
`);
  R = py.pyimport("r2l_launch");
  R.HOST = HOST;
  // warm up what every `ros2 launch` imports (keeps the first launch fast)
  py.runPython(`
import launch, launch_ros, launch_ros.actions, launch_xml, launch_yaml, ros2launch.command.launch, ros2cli.cli, xacro, yaml
from launch.frontend import Parser
Parser.load_launch_extensions()
`);
  const t3 = performance.now();
  let wasmMB = 0;
  try { wasmMB = Math.round(py._module.HEAPU8.buffer.byteLength / 1048576); } catch { /* private API */ }
  return { pyodideMs: Math.round(t1 - t0), zipMs: Math.round(t2 - t1), importMs: Math.round(t3 - t2), zipBytes: zip.length, wasmMB };
}

// ---------------------------------------------------------------------------------------------- file system
function mount({ prefix, files }) {
  let n = 0;
  for (const [rel, data] of files) {
    const path = rel.startsWith("/") ? rel : `${prefix.replace(/\/$/, "")}/${rel}`;
    writeFile(path, typeof data === "string" ? data : new Uint8Array(data.buffer || data, data.byteOffset || 0, data.byteLength));
    n++;
  }
  return { files: n };
}
function mountZip({ prefix, zip }) {
  mkdirp(prefix);
  py.unpackArchive(zip instanceof Uint8Array ? zip : new Uint8Array(zip), "zip", { extractDir: prefix });
  return { bytes: zip.byteLength };
}
// ament resource index entries + libexec stubs (what colcon/apt install puts in <prefix>), so ros2 launch, ros2 pkg
// and launch_ros' ExecutableInPackage find packages and executables exactly as on Ubuntu
function registerPackages({ prefix, packages, bins }) {
  const p = prefix.replace(/\/$/, "");
  const idx = `${p}/share/ament_index/resource_index/packages`;
  if (Object.keys(packages || {}).length) mkdirp(idx);
  let pk = 0, ex = 0;
  for (const [name, meta] of Object.entries(packages || {})) {
    const marker = `${idx}/${name}`;
    if (!py.FS.analyzePath(marker).exists) writeFile(marker, "");
    if (!meta || meta.share !== false) mkdirp(`${p}/share/${name}`);
    for (const exe of (meta && meta.exes) || []) { stub(`${p}/lib/${name}/${exe}`); ex++; }
    pk++;
  }
  for (const b of bins || []) { stub(b.startsWith("/") ? b : `${p}/${b}`); ex++; }
  return { packages: pk, executables: ex };
}
function readFile({ path }) {
  return py.FS.readFile(path, { encoding: "utf8" });
}

// ---------------------------------------------------------------------------------------------- messages
const handlers = {
  init, mount, mountZip, registerPackages, readFile,
  launch({ job, argv, env, cwd, pid, tty, hostSignals }) {
    const a = py.toPy(argv), e = py.toPy(env);
    const task = R.start_job(job, a, e, cwd || undefined, pid, tty !== false, !!hostSignals);
    task.destroy(); a.destroy(); e.destroy();   // Python keeps the task alive until the job ends
    return { job };
  },
  write({ job, pid, text, stream }) { return R.write(job, pid, text, stream || "out"); },
  exit({ job, pid, rc }) { return R.exit_process(job, pid, rc | 0); },
  signal({ job, signum }) { return R.signal_job(job, signum || 2); },
  lifecycleEvent({ job, node, transition, start, goal }) { return R.lifecycle_event(job, node, transition, start, goal); },
  run({ argv, env }) { return JSON.parse(R.run_json(py.toPy(argv), env ? py.toPy(env) : undefined)); },
  xacro({ path, argv, env }) { return JSON.parse(R.xacro_json(path, py.toPy(argv || []), env ? py.toPy(env) : undefined)); },
  hostReply({ reqId, result }) {
    const r = pending.get(reqId);
    if (r) { pending.delete(reqId); r(result == null ? "" : JSON.stringify(result)); }
    return true;
  },
};

self.onmessage = async (e) => {
  const m = e.data || {};
  const fn = handlers[m.type];
  if (!fn) { if (m.id) post({ type: "reply", id: m.id, ok: false, error: `unknown message ${m.type}` }); return; }
  try {
    if (m.type !== "init" && !py) throw new Error("launch worker not initialised");
    const result = await fn(m);
    if (m.id) post({ type: "reply", id: m.id, ok: true, result });
  } catch (err) {
    const msg = err && err.type ? `${err.type}: ${err.message}` : String((err && err.message) || err);
    if (m.id) post({ type: "reply", id: m.id, ok: false, error: msg });
    else console.error("[launch-worker]", msg);
  }
};
