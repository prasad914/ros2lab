// Smoke test: every `ros2 launch` entry of every robot workspace is run with the REAL ros2/launch + launch_ros +
// ros2launch (jazzy) libraries in CPython, against a prefix made of the workspace packages + /opt/ros/jazzy
// (public/ros/jazzy/share.zip + index.json executables). No process is started: the runtime prototype
// (r2l_launch.py) fakes process execution and reports each process. One-shot programs (spawner, ros_gz_sim create)
// "exit 0" after 0.2 s; after 4 s the test presses Ctrl+C. A launch passes when the real library raised no error
// (no "Caught exception in launch") and at least one process was started.
//
// Run: node tests/workspaces-launch.mjs [wsid ...]
// Env: R2L_LAUNCH_PY (dir with launch, launch_ros, ros2launch, ament_index_python, osrf_pycommon, xacro, yaml, lark,
//      r2l_launch.py, r2l_stubs.py ...; default /home/claude/v23/bundle/py), R2L_MKPREFIX.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { readZip } from "../tools/build-ros-share.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUB = path.join(ROOT, "public");
const PYDIR = process.env.R2L_LAUNCH_PY || "/home/claude/v23/bundle/py";
const MKPREFIX = process.env.R2L_MKPREFIX || "/home/claude/v23/notes/rt-prototype/mkprefix.py";
const only = process.argv.slice(2);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "r2l-wslaunch-"));
const OPT = path.join(TMP, "opt/ros/jazzy");
const index = JSON.parse(fs.readFileSync(path.join(PUB, "ros/jazzy/index.json"), "utf8")).packages;
for (const [n, buf] of readZip(path.join(PUB, "ros/jazzy/share.zip"))) { const d = path.join(OPT, n); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, buf); }
const stubExe = (pfx, pkg, exe) => { const f = path.join(pfx, "lib", pkg, exe); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "#!/bin/sh\necho stub\n"); fs.chmodSync(f, 0o755); };
fs.mkdirSync(path.join(OPT, "share/ament_index/resource_index/packages"), { recursive: true });
for (const [pkg, e] of Object.entries(index)) {
  fs.writeFileSync(path.join(OPT, "share/ament_index/resource_index/packages", pkg), "");
  fs.mkdirSync(path.join(OPT, "share", pkg), { recursive: true });
  for (const x of e.exes) stubExe(OPT, pkg, x);
}
const BIN = path.join(TMP, "bin"); fs.mkdirSync(BIN);
fs.writeFileSync(path.join(BIN, "xacro"), `#!/bin/sh\nexec python3 -c "import sys,xacro; sys.argv=['xacro']+sys.argv[1:]; xacro.main()" "$@"\n`);
for (const b of ["gz", "ruby", "rviz2"]) fs.writeFileSync(path.join(BIN, b), "#!/bin/sh\nexit 0\n");
for (const b of fs.readdirSync(BIN)) fs.chmodSync(path.join(BIN, b), 0o755);

// launch_xml / launch_yaml (frontend parsers) + entry points (normally from the installed dist-info metadata)
const UP = process.env.R2L_UP || "/home/claude/v23/up";
const SITE = path.join(TMP, "site");
const distInfo = (name, eps) => { const d = path.join(SITE, `${name}-0.0.0.dist-info`); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "METADATA"), `Metadata-Version: 2.1\nName: ${name}\nVersion: 0.0.0\n`); fs.writeFileSync(path.join(d, "entry_points.txt"), eps); };
distInfo("launch_xml", "[launch.frontend.parser]\nxml = launch_xml:Parser\n");
distInfo("launch_yaml", "[launch.frontend.parser]\nyaml = launch_yaml:Parser\n");
distInfo("launch_ros", "[launch.frontend.launch_extension]\nlaunch_ros = launch_ros\n");
const EXTRA_PY = [SITE, path.join(UP, "launch/launch_xml"), path.join(UP, "launch/launch_yaml")];
const DRIVER = path.join(TMP, "drive.py");
fs.writeFileSync(DRIVER, String.raw`
import asyncio, os, sys, json
import r2l_launch as R
started = []
ONESHOT = ("spawner", "unspawner", "hardware_spawner", "create", "spawn_entity", "wait_for_robot_description")
class Host:
    def started(self, info):
        started.append(info["cmd"])
        print("  >> started", " ".join(info["cmd"])[:220], flush=True)
        exe = os.path.basename(info["cmd"][0])
        if exe in ONESHOT or (len(info["cmd"]) > 1 and os.path.basename(info["cmd"][1]) in ONESHOT):
            asyncio.get_event_loop().call_later(0.2, lambda: R.exit_process(info["pid"], 0))
R.HOST = Host()
async def main():
    t = asyncio.ensure_future(R.run(sys.argv[1:]))
    done, _ = await asyncio.wait([t], timeout=4.0)
    if not done:
        R.ctrl_c()
        try: rc = await asyncio.wait_for(t, 6.0)
        except asyncio.TimeoutError: rc = "timeout"
    else: rc = t.result()
    print("R2L-RESULT " + json.dumps({"rc": rc, "procs": len(started)}), flush=True)
asyncio.run(main())
`);

const results = [];
const WS = path.join(PUB, "robots/ws");
for (const wsid of fs.readdirSync(WS).sort()) {
  const wf = path.join(WS, wsid, "workspace.json");
  if (!fs.existsSync(wf) || (only.length && !only.includes(wsid))) continue;
  const ws = JSON.parse(fs.readFileSync(wf, "utf8"));
  const wsdir = path.join(WS, wsid);
  const pfx = path.join(TMP, "ws-" + wsid);
  execFileSync("python3", [MKPREFIX, pfx, ...ws.packages.map((p) => path.join(wsdir, p.path))]);
  for (const p of ws.packages) for (const x of p.exes || []) stubExe(pfx, p.name, x);
  const pyPaths = [...new Set(ws.packages.flatMap((p) => Object.values(p.py || {}).map((d) => path.dirname(path.join(wsdir, d)))))];
  const entries = [];
  for (const [kind, v] of Object.entries(ws.entry || {})) for (const e of Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []) for (const cmd of [e.cmd, e.then].filter(Boolean)) if (cmd.startsWith("ros2 launch ")) entries.push({ kind, e, cmd });
  for (const { kind, e, cmd } of entries) {
    const robots = e.robot ? [e.robot] : ws.robots;
    for (const robot of robots.slice(0, Object.keys(ws.env || {}).some((k) => ws.robots.includes(k)) ? robots.length : 1)) {
      const robotEnv = ws.env && ws.env[robot] ? ws.env[robot] : Object.fromEntries(Object.entries(ws.env || {}).filter(([, v]) => typeof v === "string"));
      const argv = cmd.replace(/^ros2 launch /, "").replace(/\$HOME/g, os.homedir()).match(/(?:[^\s']+|'[^']*')+/g).map((a) => a.replace(/'/g, ""));
      const env = { ...process.env, DISPLAY: ":0", ...robotEnv, ...(e.env || {}), HOME: TMP, ROS_DISTRO: "jazzy", ROS_VERSION: "2", ROS_PYTHON_VERSION: "3",
        PATH: `${BIN}:${process.env.PATH}`, AMENT_PREFIX_PATH: `${pfx}:${OPT}`,
        PYTHONPATH: [PYDIR, ...EXTRA_PY, path.join(OPT, "python"), ...pyPaths].join(":"), PYTHONDONTWRITEBYTECODE: "1" };
      const r = spawnSync("python3", [DRIVER, ...argv], { env: { ...env, R2L_DEBUG: "1" }, encoding: "utf8", timeout: 30000, cwd: TMP, maxBuffer: 1 << 26 });
      if (process.env.R2L_DEBUG) console.log(r.stdout, r.stderr);
      const out = (r.stdout || "") + (r.stderr || "");
      const m = out.match(/R2L-RESULT (\{.*\})/);
      const res = m ? JSON.parse(m[1]) : { rc: "crash", procs: 0 };
      const err = out.match(/Caught exception in launch[^\n]*|\[ERROR\] \[launch\][^\n]*/) || (m ? null : out.match(/Traceback[\s\S]{0,600}/));
      // LoadComposableNodes needs rclpy + the composition service: a limitation of the stubbed CPython test, not of the workspace
      const runtimeLimit = !!err && /launch_ros\/actions\/load_composable_nodes\.py/.test(out);
      const pass = !err && res.procs > 0;
      const status = pass ? "PASS" : runtimeLimit ? "LIMIT" : "FAIL";
      results.push({ wsid, robot, kind, cmd, status, procs: res.procs, rc: res.rc, error: err ? err[0].slice(0, 400) : null });
      console.log(`${status} ${wsid}/${robot} ${kind}: ${cmd}  (${res.procs} processes)${err ? "\n     " + err[0].slice(0, 400).replace(/\n/g, "\n     ") + (runtimeLimit ? "  [in launch_ros LoadComposableNodes: needs rclpy/composition support of the launch runtime]" : "") : ""}`);
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
const failed = results.filter((r) => r.status === "FAIL");
fs.writeFileSync(path.join(WS, "launch-report.json"), JSON.stringify({ generated: new Date().toISOString(), results }, null, 1) + "\n");
console.log(`\n${results.length} launches: ${results.filter((r) => r.status === "PASS").length} passed, ${results.filter((r) => r.status === "LIMIT").length} need runtime composition support, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
