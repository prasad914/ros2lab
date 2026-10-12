// Validates the robot workspaces (public/robots/ws/<wsid>/workspace.json) and /opt/ros/jazzy (public/ros/jazzy/*),
// and expands every gallery robot's top-level xacro with the REAL xacro against a temporary AMENT_PREFIX_PATH made
// from the workspace packages + share.zip (mkprefix.py). The URDFs are saved to public/robots/ws/<wsid>/generated/
// and compared (links/joints) with the URDF the site uses today (public/robots/index.json -> file).
//
// Run: node tests/workspaces.mjs          (exit code 1 on any failure)
// Env: R2L_PYTHONPATH (xacro + ament_index_python sources), R2L_MKPREFIX (path of mkprefix.py)

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { readZip, parsePackageXml } from "../tools/build-ros-share.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUB = path.join(ROOT, "public");
const WS = path.join(PUB, "robots/ws");
const PYPATH = process.env.R2L_PYTHONPATH || "/home/claude/v23/up/xacro:/home/claude/v23/up/ament_index/ament_index_python";
const MKPREFIX = process.env.R2L_MKPREFIX || "/home/claude/v23/notes/rt-prototype/mkprefix.py";
const RUNTIME_WS = "/home/student/ros2_ws/install"; // where the site mounts workspace packages (isolated colcon layout)

let failures = 0, checks = 0;
const fail = (msg) => { failures++; console.log("  FAIL " + msg); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); return cond; };
const isText = (buf) => { if (buf.includes(0)) return false; try { new TextDecoder("utf-8", { fatal: true }).decode(buf); return true; } catch { return false; } };

// ---- /opt/ros/jazzy -------------------------------------------------------------------------------------------
console.log("== /opt/ros/jazzy");
const index = JSON.parse(fs.readFileSync(path.join(PUB, "ros/jazzy/index.json"), "utf8"));
const sources = JSON.parse(fs.readFileSync(path.join(PUB, "ros/jazzy/SOURCES.json"), "utf8"));
const share = readZip(path.join(PUB, "ros/jazzy/share.zip"));
const opt = index.packages;
ok(index.distro === "jazzy", "index.distro");
for (const must of ["desktop_full", "desktop", "ros_base", "rviz2", "ros_gz_sim", "ros_gz_bridge", "navigation2", "nav2_bringup", "slam_toolbox",
  "cartographer_ros", "moveit", "moveit_ros_move_group", "moveit_configs_utils", "controller_manager", "joint_trajectory_controller",
  "gz_ros2_control", "teleop_twist_keyboard", "joint_state_publisher_gui", "xacro", "robot_state_publisher", "tf2_ros", "turtlesim"]) ok(opt[must], `index has ${must}`);
const exe = (p, e) => ok(opt[p] && opt[p].exes.includes(e), `index ${p} has executable ${e}`);
[["ros_gz_sim", "create"], ["ros_gz_bridge", "parameter_bridge"], ["controller_manager", "spawner"], ["controller_manager", "ros2_control_node"],
  ["robot_state_publisher", "robot_state_publisher"], ["rviz2", "rviz2"], ["nav2_map_server", "map_saver_cli"], ["nav2_amcl", "amcl"],
  ["nav2_bt_navigator", "bt_navigator"], ["nav2_lifecycle_manager", "lifecycle_manager"], ["slam_toolbox", "async_slam_toolbox_node"],
  ["cartographer_ros", "cartographer_node"], ["cartographer_ros", "cartographer_occupancy_grid_node"], ["moveit_ros_move_group", "move_group"],
  ["teleop_twist_keyboard", "teleop_twist_keyboard"], ["joint_state_publisher_gui", "joint_state_publisher_gui"], ["tf2_ros", "static_transform_publisher"],
  ["xacro", "xacro"], ["turtlesim", "turtlesim_node"]].forEach(([p, e]) => exe(p, e));
for (const p of Object.keys(opt)) ok(sources.packages[p] && sources.packages[p].commit, `SOURCES has commit for ${p}`);
for (const f of ["share/ros_gz_sim/launch/gz_sim.launch.py", "share/ros_gz_bridge/launch/ros_gz_bridge.launch.py", "share/nav2_bringup/launch/bringup_launch.py",
  "share/nav2_bringup/params/nav2_params.yaml", "share/nav2_bringup/rviz/nav2_default_view.rviz", "share/slam_toolbox/config/mapper_params_online_async.yaml",
  "python/nav2_common/launch/__init__.py", "python/moveit_configs_utils/__init__.py", "python/launch_param_builder/__init__.py", "python/ros_gz_sim/__init__.py"]) ok(share.has(f), `share.zip has ${f}`);
const gzl = share.get("share/ros_gz_sim/launch/gz_sim.launch.py")?.toString() || "";
ok(gzl.includes("default_value='8'") && !gzl.includes("@GZ_SIM_VER@"), "gz_sim.launch.py configured with GZ_SIM_VER 8");
for (const n of share.keys()) { const m = n.match(/^share\/([^/]+)\//); if (m) ok(opt[m[1]] && opt[m[1]].share, `index marks ${m[1]} share:true`); }
console.log(`  ${Object.keys(opt).length} packages, ${Object.values(opt).reduce((s, p) => s + p.exes.length, 0)} executables, share.zip ${share.size} files`);

// temp /opt/ros/jazzy from share.zip
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "r2l-wstest-"));
const OPT = path.join(TMP, "opt/ros/jazzy");
for (const [n, buf] of share) { const dst = path.join(OPT, n); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, buf); }
const shareDirs = fs.readdirSync(path.join(OPT, "share")).map((d) => path.join(OPT, "share", d)).filter((d) => fs.existsSync(path.join(d, "package.xml")));

// ---- workspaces ------------------------------------------------------------------------------------------------
const gallery = JSON.parse(fs.readFileSync(path.join(PUB, "robots/index.json"), "utf8"));
const galleryById = Object.fromEntries(gallery.map((r) => [r.id, r]));
const urdfCounts = (text) => {
  const body = text.replace(/<!--[\s\S]*?-->/g, "");
  const robot = body.match(/<robot\b[\s\S]*<\/robot>/)?.[0] || "";
  // top-level <link>/<joint> only (ros2_control/transmission blocks also contain <joint name=...>)
  const stripped = robot.replace(/<(ros2_control|transmission|gazebo)\b[\s\S]*?<\/\1>/g, "");
  const links = [...stripped.matchAll(/<link\s+name="([^"]+)"/g)].map((m) => m[1]);
  const joints = [...stripped.matchAll(/<joint\s+name="([^"]+)"[^>]*type="([^"]+)"/g)].map((m) => m[1]);
  return { links, joints, name: robot.match(/<robot\s+[^>]*name="([^"]*)"/)?.[1] };
};
const report = {};
for (const wsid of fs.readdirSync(WS).sort()) {
  const wsFile = path.join(WS, wsid, "workspace.json");
  if (!fs.existsSync(wsFile)) continue;
  console.log(`== ${wsid}`);
  const ws = JSON.parse(fs.readFileSync(wsFile, "utf8"));
  const dir = path.join(WS, wsid);
  // files / text
  const fileSet = new Set(ws.files);
  let missing = 0, badText = 0, unlistedText = 0;
  for (const f of ws.files) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) { missing++; if (missing < 5) fail(`${wsid}: missing ${f}`); continue; }
    const t = isText(fs.readFileSync(p));
    if (t && !ws.text.includes(f)) unlistedText++;
  }
  for (const f of ws.text) if (!fileSet.has(f)) { badText++; if (badText < 5) fail(`${wsid}: text entry not in files: ${f}`); }
  ok(missing === 0, `${wsid}: all ${ws.files.length} files exist (${missing} missing)`);
  ok(badText === 0 && unlistedText === 0, `${wsid}: text[] is exactly the UTF-8 subset of files (${unlistedText} unlisted)`);
  for (const [a, t] of Object.entries(ws.alias || {})) ok(fileSet.has(t) && !fileSet.has(a), `${wsid}: alias ${a} -> ${t}`);
  // every shipped file under src/ (no strays)
  const onDisk = [];
  (function rec(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) rec(p); else onDisk.push(path.relative(dir, p)); } })(path.join(dir, "src"));
  ok(onDisk.every((f) => fileSet.has(f)), `${wsid}: no unlisted files under src/`);
  // licences
  for (const r of ws.repos) ok(ws.files.some((f) => f.startsWith(r.path + "/") && /\/(licen[cs]e|copying)(\.[a-z]+)?$/i.test(f)), `${wsid}: LICENSE shipped for ${r.name}`);
  // packages
  const pk = Object.fromEntries(ws.packages.map((p) => [p.name, p]));
  for (const p of ws.packages) ok(fileSet.has(path.join(p.path, "package.xml")), `${wsid}: ${p.name}/package.xml shipped`);
  // repos file
  try {
    const y = JSON.parse(execFileSync("python3", ["-I", "-c", "import sys,json,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1]))))", path.join(dir, ws.ubuntu.repos_file)], { encoding: "utf8" }));
    const names = Object.keys(y.repositories || {});
    ok(ws.repos.every((r) => names.includes(r.name) && y.repositories[r.name].version === r.commit && y.repositories[r.name].type === "git"), `${wsid}: ${ws.ubuntu.repos_file} lists every repo at its pinned commit`);
  } catch (e) { fail(`${wsid}: repos file does not parse: ${e.message}`); }
  // entries
  const allEntries = [];
  for (const [k, v] of Object.entries(ws.entry || {})) for (const e of Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []) allEntries.push([k, e]);
  for (const [kind, e] of allEntries) {
    for (const cmd of [e.cmd, e.then].filter(Boolean)) {
      let m = cmd.match(/^ros2 launch (\S+) (\S+)/);
      if (m) {
        const [, pkg, file] = m;
        if (pk[pkg]) ok(ws.files.some((f) => f.startsWith(pk[pkg].path + "/") && path.basename(f) === file), `${wsid}: ${kind}: ${pkg}/${file} exists`);
        else ok(share.has(`share/${pkg}/launch/${file}`), `${wsid}: ${kind}: ${pkg} ${file} in workspace or share.zip`);
        continue;
      }
      m = cmd.match(/^ros2 run (\S+) (\S+)/);
      if (m) {
        const [, pkg, ex] = m;
        ok((pk[pkg] && pk[pkg].exes.includes(ex)) || (opt[pkg] && opt[pkg].exes.includes(ex)), `${wsid}: ${kind}: executable ${pkg}/${ex} known`);
        continue;
      }
      fail(`${wsid}: unrecognised command ${cmd}`);
    }
    if (e.robot) ok(ws.robots.includes(e.robot), `${wsid}: entry robot ${e.robot} is in robots[]`);
  }
  // xacro
  const pfx = path.join(TMP, "ws-" + wsid);
  const pkgDirs = ws.packages.map((p) => path.join(dir, p.path));
  execFileSync("python3", [MKPREFIX, pfx, ...pkgDirs, ...shareDirs.filter((d) => !pk[path.basename(d)])]);
  fs.mkdirSync(path.join(dir, "generated"), { recursive: true });
  report[wsid] = {};
  for (const [robot, g] of Object.entries(ws.gallery || {})) {
    if (g.error) { fail(`${wsid}/${robot}: fetch reported xacro error`); continue; }
    const env = { ...process.env, PYTHONPATH: PYPATH, AMENT_PREFIX_PATH: pfx, ...(ws.env?.[robot] || (typeof Object.values(ws.env || {})[0] === "string" ? ws.env : {})) };
    const src = path.join(pfx, "share", g.package, g.file);
    let urdf;
    try {
      urdf = execFileSync("python3", ["-c", "import sys,xacro; sys.argv=['xacro']+sys.argv[1:]; xacro.main()", src, ...g.args], { encoding: "utf8", env, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { fail(`${wsid}/${robot}: xacro failed: ${String(e.stderr).slice(-400)}`); continue; }
    // $(find pkg) expands to the temporary prefix: write the path the site runtime would produce instead
    urdf = urdf.split(pfx + "/share/").join("@@SHARE@@").replace(/@@SHARE@@([A-Za-z0-9_]+)\//g, (m, p) => `${RUNTIME_WS}/${p}/share/${p}/`);
    urdf = urdf.replace(/(This document was autogenerated by xacro from )\S+/, `$1${g.cmd.replace(/^xacro /, "")}`);
    ok(!urdf.includes(TMP), `${wsid}/${robot}: no temp paths in URDF`);
    fs.writeFileSync(path.join(dir, g.urdf), urdf);
    const now = urdfCounts(urdf);
    // mesh references resolve to shipped files
    let unresolved = [];
    for (const m of urdf.matchAll(/<mesh\s+filename="([^"]+)"/g)) {
      const u = m[1]; let rel = null;
      let mm = u.match(/^package:\/\/([^/]+)\/(.*)$/); if (mm && pk[mm[1]]) rel = path.join(pk[mm[1]].path, mm[2]);
      mm = u.match(/^file:\/\/\/home\/student\/ros2_ws\/install\/([^/]+)\/share\/\1\/(.*)$/); if (mm && pk[mm[1]]) rel = path.join(pk[mm[1]].path, mm[2]);
      if (!rel || !(fileSet.has(rel) || (ws.alias || {})[rel])) unresolved.push(u);
    }
    const known = (ws.known_issues || []).join(" ");
    const unknownMissing = unresolved.filter((u) => !known.includes(u.replace(/^package:\/\/[^/]+\//, "").replace(/\/[^/]+$/, "/")));
    if (unresolved.length && !unknownMissing.length) console.log(`  WARN ${wsid}/${robot}: ${new Set(unresolved).size} mesh references missing upstream (listed in known_issues)`);
    ok(unknownMissing.length === 0, `${wsid}/${robot}: all ${[...urdf.matchAll(/<mesh\s+filename="/g)].length} mesh references are shipped${unknownMissing.length ? " (missing: " + [...new Set(unknownMissing)].slice(0, 3).join(", ") + ")" : ""}`);
    const gal = galleryById[robot];
    let old = null;
    if (gal && gal.file && fs.existsSync(path.join(PUB, "robots", gal.file))) old = urdfCounts(fs.readFileSync(path.join(PUB, "robots", gal.file), "utf8"));
    const r = { cmd: g.cmd, urdf: `robots/ws/${wsid}/${g.urdf}`, robot_name: now.name, links: now.links.length, joints: now.joints.length };
    if (old) {
      r.site = { file: `robots/${gal.file}`, links: old.links.length, joints: old.joints.length };
      r.links_only_in_ws = now.links.filter((l) => !old.links.includes(l));
      r.links_only_on_site = old.links.filter((l) => !now.links.includes(l));
      r.joints_only_in_ws = now.joints.filter((l) => !old.joints.includes(l));
      r.joints_only_on_site = old.joints.filter((l) => !now.joints.includes(l));
    }
    report[wsid][robot] = r;
    console.log(`  ${robot}: xacro OK  links ${r.links} joints ${r.joints}` + (old ? `  | site ${old.links.length}/${old.joints.length}` +
      (r.links_only_in_ws.length + r.links_only_on_site.length + r.joints_only_in_ws.length + r.joints_only_on_site.length
        ? `  +links[${r.links_only_in_ws.join(",")}] -links[${r.links_only_on_site.join(",")}] +joints[${r.joints_only_in_ws.join(",")}] -joints[${r.joints_only_on_site.join(",")}]` : "  identical names") : ""));
  }
  fs.writeFileSync(path.join(dir, "generated/report.json"), JSON.stringify(report[wsid], null, 1) + "\n");
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
