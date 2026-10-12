// Records what each robot's REAL Gazebo launch starts (cmd, env, --params-file contents) by running the launch file
// with the real ros2/launch + launch_ros libraries in CPython (same harness as tests/workspaces-launch.mjs), and
// writes tests/gz-fixtures/<robot>-<n>.json. These are exactly the onProcess(info) records the launch runtime hands
// to the coordinator's process adapter, so the gz-real-*.mjs tests drive the Gazebo model with real inputs.
// Run: node tests/gz-capture.mjs [wsid ...]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { readZip } from "../tools/build-ros-share.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUB = path.join(ROOT, "public");
const PYDIR = process.env.R2L_LAUNCH_PY || "/home/claude/v23/bundle/py";
const MKPREFIX = process.env.R2L_MKPREFIX || "/home/claude/v23/notes/rt-prototype/mkprefix.py";
const UP = process.env.R2L_UP || "/home/claude/v23/up";
const only = process.argv.slice(2);
const OUT = path.join(ROOT, "tests/gz-fixtures");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "r2l-gzcap-"));
const OPT = path.join(TMP, "opt/ros/jazzy");
const index = JSON.parse(fs.readFileSync(path.join(PUB, "ros/jazzy/index.json"), "utf8")).packages;
for (const [n, buf] of readZip(path.join(PUB, "ros/jazzy/share.zip"))) { const d = path.join(OPT, n); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, buf); }
const stubExe = (pfx, pkg, exe) => { const f = path.join(pfx, "lib", pkg, exe); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "#!/bin/sh\necho stub\n"); fs.chmodSync(f, 0o755); };
fs.mkdirSync(path.join(OPT, "share/ament_index/resource_index/packages"), { recursive: true });
for (const [pkg, e] of Object.entries(index)) { fs.writeFileSync(path.join(OPT, "share/ament_index/resource_index/packages", pkg), ""); fs.mkdirSync(path.join(OPT, "share", pkg), { recursive: true }); for (const x of e.exes) stubExe(OPT, pkg, x); }
const BIN = path.join(TMP, "bin"); fs.mkdirSync(BIN);
fs.writeFileSync(path.join(BIN, "xacro"), `#!/bin/sh\nexec python3 -c "import sys,xacro; sys.argv=['xacro']+sys.argv[1:]; xacro.main()" "$@"\n`);
for (const b of ["gz", "ruby", "rviz2"]) fs.writeFileSync(path.join(BIN, b), "#!/bin/sh\nexit 0\n");
for (const b of fs.readdirSync(BIN)) fs.chmodSync(path.join(BIN, b), 0o755);
const SITE = path.join(TMP, "site");
const distInfo = (name, eps) => { const d = path.join(SITE, `${name}-0.0.0.dist-info`); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "METADATA"), `Metadata-Version: 2.1\nName: ${name}\nVersion: 0.0.0\n`); fs.writeFileSync(path.join(d, "entry_points.txt"), eps); };
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
import re
class Host:
    def started(self, info):
        # temp files a launch file wrote itself (e.g. xarm's generated controllers yaml) referenced from the text
        blob = " ".join(info["cmd"]) + " ".join(info.get("files", {}).values())
        for path in set(re.findall(r"/tmp/(?:launch_params_|tmp)[\w.-]+", blob)):
            if path not in info["files"] and os.path.isfile(path):
                try: info["files"][path] = open(path).read()
                except Exception: pass
        started.append(info)
        exe = os.path.basename(info["cmd"][0])
        if exe in ONESHOT or (len(info["cmd"]) > 1 and os.path.basename(info["cmd"][1]) in ONESHOT):
            asyncio.get_event_loop().call_later(0.2, lambda: R.exit_process(info["pid"], 0))
R.HOST = Host()
async def main():
    t = asyncio.ensure_future(R.run(sys.argv[1:]))
    done, _ = await asyncio.wait([t], timeout=4.0)
    if not done:
        R.ctrl_c()
        try: await asyncio.wait_for(t, 6.0)
        except asyncio.TimeoutError: pass
    with open(os.environ["R2L_CAPTURE"], "w") as f: json.dump(started, f)
asyncio.run(main())
`);
const WS = path.join(PUB, "robots/ws");
const strip = (s) => String(s).split(TMP).join("");   // temp prefixes -> Ubuntu-like paths
for (const wsid of fs.readdirSync(WS).sort()) {
  const wf = path.join(WS, wsid, "workspace.json");
  if (!fs.existsSync(wf) || (only.length && !only.includes(wsid))) continue;
  const ws = JSON.parse(fs.readFileSync(wf, "utf8")), wsdir = path.join(WS, wsid);
  const pfx = path.join(TMP, "home/student/ros2_ws/install");
  fs.rmSync(pfx, { recursive: true, force: true });
  execFileSync("python3", [MKPREFIX, pfx, ...ws.packages.map((p) => path.join(wsdir, p.path))]);
  for (const p of ws.packages) for (const x of p.exes || []) stubExe(pfx, p.name, x);
  const pyPaths = [...new Set(ws.packages.flatMap((p) => Object.values(p.py || {}).map((d) => path.dirname(path.join(wsdir, d)))))];
  const sims = [].concat(ws.entry && ws.entry.sim || []).concat(ws.entry && ws.entry.moveit || []).filter((e) => e && /gazebo|_gz|gz_|sim\.launch|sim_/.test(e.cmd));
  let n = 0;
  for (const e of sims) {
    for (const robot of e.robot ? [e.robot] : ws.robots) {
      const robotEnv = ws.env && ws.env[robot] ? ws.env[robot] : Object.fromEntries(Object.entries(ws.env || {}).filter(([, v]) => typeof v === "string"));
      const argv = e.cmd.replace(/^ros2 launch /, "").match(/(?:[^\s']+|'[^']*')+/g).map((a) => a.replace(/'/g, ""));
      const cap = path.join(TMP, "cap.json");
      const env = { ...process.env, ...robotEnv, HOME: path.join(TMP, "home/student"), ROS_DISTRO: "jazzy", ROS_VERSION: "2", PATH: `${BIN}:${process.env.PATH}`, AMENT_PREFIX_PATH: `${pfx}:${OPT}`,
        PYTHONPATH: [PYDIR, ...EXTRA_PY, path.join(OPT, "python"), ...pyPaths].join(":"), PYTHONDONTWRITEBYTECODE: "1", R2L_CAPTURE: cap };
      fs.mkdirSync(env.HOME, { recursive: true });
      spawnSync("python3", [DRIVER, ...argv], { env, encoding: "utf8", timeout: 40000, cwd: TMP, maxBuffer: 1 << 26 });
      if (!fs.existsSync(cap)) { console.log("FAIL", robot, e.cmd); continue; }
      const procs = JSON.parse(fs.readFileSync(cap, "utf8")).map((p) => ({ pid: p.pid, cmd: p.cmd.map(strip), env: Object.fromEntries(Object.entries(p.env || {}).filter(([k]) => /^(GZ_|IGN_|TURTLEBOT3|SDF_|AMENT_PREFIX)/.test(k)).map(([k, v]) => [k, strip(v)])),
        files: Object.fromEntries(Object.entries(p.files || {}).map(([k, v]) => [strip(k), strip(v)])) }));
      fs.rmSync(cap);
      const file = path.join(OUT, `${robot}-${++n}.json`);
      fs.writeFileSync(file, JSON.stringify({ wsid, robot, cmd: e.cmd, procs }, null, 1) + "\n");
      console.log("captured", path.basename(file), e.cmd, procs.length, "processes:", procs.map((p) => p.cmd.slice(0, 2).map((c) => c.split("/").pop()).join(" ")).join(" | "));
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
