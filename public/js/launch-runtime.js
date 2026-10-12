// ROS2Lab launch runtime (main thread API).
//
// Runs REAL ROS 2 Jazzy launch files unmodified (Python / XML / YAML) with the real ros2/launch, launch_ros and
// ros2launch libraries inside Pyodide workers (launch-worker.js). The launch system starts no programs: every process
// it would start is handed to the page (onProcess), which runs the website's own model of that program (Gazebo,
// robot_state_publisher, ros2_control, Nav2, MoveIt ...) and decides what it prints (job.write) and when it exits
// (job.exit). Everything `ros2 launch` itself prints comes from the real libraries.
//
//   const rt = await getLaunchRuntime({ onStatus: (s) => show(s.text) });
//   await rt.mountZip("/opt/ros/jazzy", "/ros/jazzy/share.zip");
//   await rt.registerPackages("/opt/ros/jazzy", index.packages);
//   const job = rt.launch(["turtlebot3_gazebo", "turtlebot3_world.launch.py"], { env, onOutput, onProcess });
//   job.exit(pid, 0); job.ctrlC(); const code = await job.done;
//
// Concurrency: one worker runs one launch at a time (on Ubuntu each `ros2 launch` is its own process with its own
// environment, pids and log directory; launch keeps those in process-global state). A second concurrent launch gets
// a new worker, which replays every mount/registerPackages done so far. xacro()/run() use an idle worker if any.

const WORKER_URL = new URL("./launch-worker.js", import.meta.url);
const RUNTIME_DIR = new URL("../ros/launch-runtime/", import.meta.url);
const PYODIDE_TRANSFER_MB = 6;   // pyodide.asm.wasm + python_stdlib.zip + pyodide.asm.mjs as served (compressed)

export const DEFAULT_ENV = Object.freeze({
  AMENT_PREFIX_PATH: "/opt/ros/jazzy",
  CMAKE_PREFIX_PATH: "/opt/ros/jazzy",
  COLCON_PREFIX_PATH: "",
  HOME: "/home/student",
  HOSTNAME: "ros2lab",
  LANG: "en_US.UTF-8",
  LD_LIBRARY_PATH: "/opt/ros/jazzy/lib/x86_64-linux-gnu:/opt/ros/jazzy/lib",
  PATH: "/opt/ros/jazzy/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  PYTHONPATH: "/opt/ros/jazzy/lib/python3.12/site-packages",
  ROS_AUTOMATIC_DISCOVERY_RANGE: "SUBNET",
  ROS_DISTRO: "jazzy",
  ROS_PYTHON_VERSION: "3",
  ROS_VERSION: "2",
  SHELL: "/bin/bash",
  TERM: "xterm-256color",
  USER: "student",
});

let singleton = null;

/** The shared runtime (one per page). The first call starts the first worker (downloads Pyodide + py.zip). */
export function getLaunchRuntime(opts = {}) {
  if (!singleton) {
    const rt = singleton = new LaunchRuntime(opts);
    rt.ready.catch(() => { if (singleton === rt) singleton = null; });   // a later call retries
  } else if (opts.onStatus) singleton.on("status", opts.onStatus);
  const rt = singleton;
  return rt.ready.then(() => rt);
}

class Emitter {
  constructor() { this._ev = new Map(); }
  on(type, fn) { if (!this._ev.has(type)) this._ev.set(type, new Set()); this._ev.get(type).add(fn); return () => this.off(type, fn); }
  off(type, fn) { this._ev.get(type)?.delete(fn); }
  emit(type, ...a) { for (const fn of [...(this._ev.get(type) || [])]) { try { fn(...a); } catch (e) { console.error(e); } } }
}

class WorkerSlot {
  constructor(rt, index) {
    this.rt = rt;
    this.index = index;
    this.job = null;             // the launch job running here (null: idle)
    this.seq = 0;
    this.calls = new Map();
    this.w = new Worker(WORKER_URL, { type: "module" });
    this.w.onmessage = (e) => this.onMessage(e.data);
    this.w.onerror = (e) => {   // the worker died (e.g. out of memory): its launch ends like a killed process
      const msg = e.message || "worker error";
      console.error("[launch-runtime] worker error", msg);
      this.failAll(msg);
      this.rt.slots = this.rt.slots.filter((s) => s !== this);
      if (this.job) { this.job._output(`[launch-runtime] the launch process stopped: ${msg}\n`, "err"); this.job._finish(137); }
      this.w.terminate();
    };
  }
  call(type, payload = {}, transfer) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.calls.set(id, { resolve, reject });
      this.w.postMessage({ ...payload, type, id }, transfer || []);
    });
  }
  send(type, payload = {}) { this.w.postMessage({ ...payload, type }); }
  failAll(msg) { for (const c of this.calls.values()) c.reject(new Error(msg)); this.calls.clear(); }
  onMessage(m) {
    if (m.type === "reply") {
      const c = this.calls.get(m.id);
      if (!c) return;
      this.calls.delete(m.id);
      m.ok ? c.resolve(m.result) : c.reject(new Error(m.error));
      return;
    }
    if (m.type === "status") { this.rt._status(m, this); return; }
    const job = this.rt.jobs.get(m.job);
    if (!job) return;
    job._message(m, this);
  }
  terminate() { this.w.terminate(); this.failAll("terminated"); }
}

export class LaunchRuntime extends Emitter {
  constructor({ onStatus, zipUrl, pyodideUrl, maxWorkers = 6 } = {}) {
    super();
    if (onStatus) this.on("status", onStatus);
    this.zipUrl = zipUrl || new URL("py.zip", RUNTIME_DIR).href;
    this.pyodideUrl = pyodideUrl;
    this.maxWorkers = maxWorkers;
    this.slots = [];
    this.ops = [];               // mount / mountZip / registerPackages, replayed into every new worker
    this.jobs = new Map();
    this.jobSeq = 0;
    this.nextPid = 4300 + Math.floor(Math.random() * 200);
    this.stats = { firstLoadMs: 0, zipBytes: 0, workers: 0 };
    this._opChain = Promise.resolve();
    this._acquire = Promise.resolve();
    this.ready = this._boot();
  }

  async _boot() {
    const t0 = performance.now();
    let sources = null;
    try { sources = await (await fetch(new URL("SOURCES.json", RUNTIME_DIR))).json(); } catch { /* optional */ }
    if (sources?.zip?.sha256) this.zipUrl += (this.zipUrl.includes("?") ? "&" : "?") + "v=" + sources.zip.sha256.slice(0, 12);
    this.zipBytes = sources?.zip?.bytes || 0;
    const mb = (PYODIDE_TRANSFER_MB + this.zipBytes / 1048576).toFixed(0);
    this._status({ text: `Loading the ROS 2 launch system… ${mb} MB`, stage: "start" });
    const slot = await this._newSlot();
    this.stats.firstLoadMs = Math.round(performance.now() - t0);
    this._status({ text: "ROS 2 launch system ready", stage: "ready", ms: this.stats.firstLoadMs });
    return slot;
  }

  _status(m, slot) {
    let text = m.text;
    if (m.total && m.loaded != null) text = `${m.text} ${(m.loaded / 1048576).toFixed(1)} / ${(m.total / 1048576).toFixed(1)} MB`;
    this.emit("status", { ...m, text, worker: slot ? slot.index : 0 });
  }

  async _newSlot() {
    if (this.slots.length >= this.maxWorkers) throw new Error(`too many concurrent launches (max ${this.maxWorkers})`);
    const slot = new WorkerSlot(this, this.slots.length);
    this.slots.push(slot);
    slot.ready = (async () => {
      const r = await slot.call("init", { zipUrl: this.zipUrl, zipBytes: this.zipBytes, pyodideUrl: this.pyodideUrl });
      slot.timings = r;
      this.stats.zipBytes = r.zipBytes;
      this.stats.workers = this.slots.length;
      for (const op of this.ops) await slot.call(op.type, op.payload);   // live array: picks up ops added meanwhile
      slot.replayed = true;
      return slot;
    })();
    slot.ready.catch((e) => { this.slots = this.slots.filter((s) => s !== slot); slot.terminate(); this._status({ text: "ROS 2 launch system failed to load: " + e.message, stage: "error" }); });
    return slot.ready;
  }

  // file-system operations go to every worker (and are remembered for workers started later)
  _op(type, payload) {
    this.ops.push({ type, payload });
    const p = this._opChain.then(() => this.ready).then(() =>
      Promise.all(this.slots.map((s) => (s.replayed ? s.call(type, payload) : s.ready.then(() => null)))));
    this._opChain = p.catch(() => {});
    return p.then((r) => r.find((x) => x != null) ?? null);
  }

  /** Write files under `prefix` (mkdir -p). files: Array<[relPath, string|Uint8Array]> (absolute paths allowed). */
  mount(prefix, files) { return this._op("mount", { prefix, files: [...files] }); }

  /** Unpack a zip (ArrayBuffer/Uint8Array or URL) into `prefix`, e.g. /ros/jazzy/share.zip into /opt/ros/jazzy. */
  async mountZip(prefix, zip) {
    if (typeof zip === "string" || zip instanceof URL) {
      const res = await fetch(zip);
      if (!res.ok) throw new Error(`${zip}: HTTP ${res.status}`);
      zip = await res.arrayBuffer();
    }
    return this._op("mountZip", { prefix, zip: zip instanceof Uint8Array ? zip : new Uint8Array(zip) });
  }

  /** Ament index entries + executable stubs: packages = { name: { exes: [...], share?: bool } }; opts.bins: extra
   *  program paths (absolute, or relative to prefix) that must exist, e.g. ["bin/my_tool"]. */
  registerPackages(prefix, packages, opts = {}) { return this._op("registerPackages", { prefix, packages, bins: opts.bins || [] }); }

  /** Programs that must be found on PATH (FindExecutable, ExecuteProcess) - absolute paths. */
  addExecutables(paths) { return this._op("registerPackages", { prefix: "/", packages: {}, bins: [...paths] }); }

  async _idleSlot() {
    await this.ready;
    await this._opChain;
    const idle = this.slots.find((s) => !s.job);
    return idle ? idle.ready : this.slots[0].ready;
  }

  /** The real xacro: { urdf, stderr } or { error, stderr, code }. $(find pkg) uses the mounted prefixes. */
  async xacro(path, argv = [], opts = {}) {
    const slot = await this._idleSlot();
    return slot.call("xacro", { path, argv: [...argv], env: envOf(opts.env) });
  }

  /** One-shot commands that do not start a launch: ["ros2","launch",pkg,file,"-s"], ["ros2","pkg","prefix",pkg],
   *  ["ros2","pkg","executables",pkg], ["ros2","pkg","list"], ["xacro", file, "a:=b"] -> { code, stdout, stderr }. */
  async run(argv, opts = {}) {
    const slot = await this._idleSlot();
    return slot.call("run", { argv: [...argv], env: envOf(opts.env) });
  }

  /** Read a file of the runtime's file system (e.g. a params file a launch wrote). */
  async readFile(path) { const slot = await this._idleSlot(); return slot.call("readFile", { path }); }

  /** Start `ros2 launch <argv...>` (argv may also start with "ros2"). Returns a LaunchJob immediately. */
  launch(argv, opts = {}) {
    const full = argv[0] === "ros2" ? [...argv] : ["ros2", "launch", ...argv];
    const pid = opts.pid ?? this.nextPid;
    this.nextPid = Math.max(this.nextPid, pid) + 512;
    const job = new LaunchJob(this, ++this.jobSeq, full, pid, opts);
    this.jobs.set(job.id, job);
    job._start();
    return job;
  }

  _slotForJob(job) {
    // serialized, so two launches started at the same time never pick the same idle worker
    const p = this._acquire.then(async () => {
      await this.ready;
      await this._opChain;
      let slot = this.slots.find((s) => !s.job);
      if (!slot) {
        this._status({ text: "Starting another ROS 2 launch process…", stage: "worker" });
        slot = await this._newSlot();
      }
      slot.job = job;
      return slot;
    });
    this._acquire = p.catch(() => {});
    return p.then((s) => s.ready);
  }

  /** Start an extra idle worker in the background, so the next concurrent launch does not wait for Pyodide. */
  prewarm() {
    return this.ready.then(() => (this.slots.some((s) => !s.job) && this.slots.length > 1 ? null : this._newSlot().then(() => null)));
  }

  /** Stop every worker (all running launches end abruptly). */
  dispose() {
    for (const s of this.slots) if (s.terminate) s.terminate();
    this.slots = [];
    for (const j of this.jobs.values()) j._finish(130);
    if (singleton === this) singleton = null;
  }
}

function envOf(env) {
  const e = { ...DEFAULT_ENV, ...(env || {}) };
  for (const k of Object.keys(e)) e[k] = String(e[k]);
  return e;
}

export class LaunchJob extends Emitter {
  constructor(rt, id, argv, pid, opts) {
    super();
    this.rt = rt;
    this.id = id;
    this.argv = argv;
    this.pid = pid;              // pid of the `ros2 launch` process; its children get pid+1, pid+2, ...
    this.opts = opts;
    this.processes = new Map();  // pid -> info of processes that are running
    this.exitCode = null;
    this._queue = [];
    this._slot = null;
    this.done = new Promise((res) => { this._resolveDone = res; });
  }

  async _start() {
    const o = this.opts;
    try {
      const slot = await this.rt._slotForJob(this);
      this._slot = slot;
      slot.send("launch", { job: this.id, argv: this.argv, env: envOf(o.env), cwd: o.cwd || null, pid: this.pid,
        tty: o.tty !== false, hostSignals: typeof o.onSignal === "function" });
      for (const [t, p] of this._queue) slot.send(t, p);
      this._queue = [];
    } catch (e) {
      this._output(`[launch-runtime] ${e.message}\n`, "err");
      this._finish(1);
    }
  }

  /** A file in THIS launch's file system (what the launch file wrote, e.g. a generated /tmp params file). */
  readFile(path) { return this._slot ? this._slot.call("readFile", { path }).catch(() => null) : Promise.resolve(null); }

  _send(type, payload) {
    if (this.exitCode !== null) return false;
    const p = { ...payload, job: this.id };
    if (this._slot) this._slot.send(type, p); else this._queue.push([type, p]);
    return true;
  }

  _output(text, stream) {
    this.opts.onOutput?.(text, stream);
    this.emit("output", text, stream);
  }

  async _message(m, slot) {
    const o = this.opts;
    switch (m.type) {
      case "out": this._output(m.text, m.stream); break;
      case "process":
        this.processes.set(m.info.pid, m.info);
        o.onProcess?.(m.info);
        this.emit("process", m.info);
        break;
      case "signal":
        o.onSignal?.(m.pid, m.signum);
        this.emit("signal", m.pid, m.signum);
        break;
      case "exit":   // a process ended, whatever the cause (job.exit, default SIGINT handling, SIGKILL, launch ended)
        this.processes.delete(m.pid);
        o.onExit?.(m.pid, m.rc);
        this.emit("exit", m.pid, m.rc);
        break;
      case "loadComposable":
      case "lifecycle": {
        const cb = m.type === "loadComposable" ? o.onLoadComposable : o.onLifecycle;
        this.emit(m.type, m.request);
        let result = null;
        try { result = cb ? await cb(m.request) : null; } catch (e) { result = { success: false, error_message: String(e.message || e) }; }
        if (Array.isArray(result)) result = { results: result };
        slot.send("hostReply", { reqId: m.reqId, result: result ?? null });
        break;
      }
      case "done": this._finish(m.code); break;
    }
  }

  _finish(code) {
    if (this.exitCode !== null) return;
    this.exitCode = code;
    if (this._slot && this._slot.job === this) this._slot.job = null;
    for (const pid of this.processes.keys()) this.opts.onExit?.(pid, -9);   // worker died / disposed
    this.rt.jobs.delete(this.id);
    this.processes.clear();
    this.emit("done", code);
    this._resolveDone(code);
  }

  /** Text a process printed (the launch system adds the "[name-N] " prefix). */
  write(pid, text, stream = "out") { return this._send("write", { pid, text: String(text).endsWith("\n") ? String(text) : text + "\n", stream }); }
  /** The process `pid` exited with return code rc (0: "process has finished cleanly"). */
  exit(pid, rc = 0) { return this._send("exit", { pid, rc }); }
  /** Ctrl+C in the terminal running ros2 launch (SIGINT to the launch process and all its processes). */
  ctrlC() { return this._send("signal", { signum: 2 }); }
  /** Another signal for the whole foreground process group: 3 (Ctrl+\), 15 (kill). */
  signal(signum) { return this._send("signal", { signum }); }
  /** A lifecycle node changed state (TransitionEvent): OnStateTransition handlers in the launch file react. */
  lifecycleEvent(node, transition, start, goal) { return this._send("lifecycleEvent", { node, transition, start, goal }); }
}
