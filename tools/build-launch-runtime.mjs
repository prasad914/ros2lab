#!/usr/bin/env node
// Builds public/ros/launch-runtime/py.zip: the pure-Python ROS 2 Jazzy launch system (ros2/launch, launch_xml,
// launch_yaml, launch_ros, ros2launch, ament_index_python, ros2cli/ros2pkg, xacro, ...) plus the ROS2Lab glue
// (tools/launch-runtime-py/*.py). public/js/launch-worker.js unpacks it into /opt/ros/jazzy of the Pyodide file
// system: python modules under lib/python3.12/site-packages/ (where Ubuntu's ros-jazzy-* debs put them) and the
// share/ files colcon installs for these ROS packages (ament index markers, package.xml, launch's grammar.lark).
//
//   node tools/build-launch-runtime.mjs            # uses local clones (R2L_SRC dirs, /home/claude/v23/up) or clones
//   R2L_SRC=/path/a:/path/b node tools/build-launch-runtime.mjs
//
// Every upstream repository is pinned to a commit (SOURCES below). A local clone is used only when its HEAD is that
// commit; otherwise the commit is fetched from GitHub into a cache directory. Tests, docs, examples and __pycache__ are
// stripped; each distribution keeps its LICENSE inside <name>-<version>.dist-info/ together with METADATA and
// entry_points.txt (taken from the package's own setup.py), so importlib.metadata entry points work exactly as on
// Ubuntu (launch.frontend parsers for .launch.xml / .launch.yaml, launch_ros frontend extension, ros2cli commands).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public/ros/launch-runtime");
const GLUE_DIR = join(ROOT, "tools/launch-runtime-py");
const CACHE = process.env.R2L_CACHE || join(os.tmpdir(), "r2l-launch-runtime-src");
const SEARCH = [...(process.env.R2L_SRC || "").split(":").filter(Boolean), "/home/claude/v23/up", CACHE];

// dists: [importName, path of that dir in the repo, setup.py path (or null), version (or "package.xml"), dist name]
// ros: { <importName>: { xml: package.xml path, share: [[repo path, path under share/<pkg>/]] } } for ROS packages
const SOURCES = [
  { name: "launch", repo: "https://github.com/ros2/launch", ref: "jazzy", commit: "ba5f5b3ad457592364f442e0bdf61bf2f38fc5c6",
    license: "Apache-2.0", licenseFiles: ["LICENSE"],
    dists: [["launch", "launch/launch", "launch/setup.py"], ["launch_xml", "launch_xml/launch_xml", "launch_xml/setup.py"],
      ["launch_yaml", "launch_yaml/launch_yaml", "launch_yaml/setup.py"]],
    ros: { launch: { xml: "launch/package.xml", share: [["launch/share/launch/frontend/grammar.lark", "frontend/grammar.lark"]] },
      launch_xml: { xml: "launch_xml/package.xml" }, launch_yaml: { xml: "launch_yaml/package.xml" } } },
  { name: "launch_ros", repo: "https://github.com/ros2/launch_ros", ref: "jazzy", commit: "97b758478d8bf343a1e83ab419210d790da53d80",
    license: "Apache-2.0", licenseFiles: ["LICENSE"],
    dists: [["launch_ros", "launch_ros/launch_ros", "launch_ros/setup.py"], ["ros2launch", "ros2launch/ros2launch", "ros2launch/setup.py"]],
    ros: { launch_ros: { xml: "launch_ros/package.xml" }, ros2launch: { xml: "ros2launch/package.xml" } } },
  { name: "ament_index", repo: "https://github.com/ament/ament_index", ref: "jazzy", commit: "2ccdcb8fd19a364fc793273b5793459207a440b9",
    license: "Apache-2.0", licenseFiles: ["LICENSE"],
    dists: [["ament_index_python", "ament_index_python/ament_index_python", "ament_index_python/setup.py"]],
    ros: { ament_index_python: { xml: "ament_index_python/package.xml" } } },
  { name: "ros2cli", repo: "https://github.com/ros2/ros2cli", ref: "jazzy", commit: "9ac47fae6c09d230eca4644bd474a608382364e3",
    license: "Apache-2.0", licenseFiles: ["LICENSE"],
    // `ros2 daemon` and `ros2 pkg create` need rclpy / empy: not shipped (and removed from the entry points)
    exclude: ["ros2cli/command/daemon.py", "ros2cli/verb/daemon", "ros2cli/daemon", "ros2cli/node", "ros2cli/xmlrpc",
      "ros2pkg/api/create.py", "ros2pkg/verb/create.py", "ros2pkg/resource"],
    dropEntryPoints: ["daemon = ", "create = ", "ros2cli.daemon.verb", "_ros2_daemon", "start = ", "status = ", "stop = "],
    dists: [["ros2cli", "ros2cli/ros2cli", "ros2cli/setup.py"], ["ros2pkg", "ros2pkg/ros2pkg", "ros2pkg/setup.py"]],
    ros: { ros2cli: { xml: "ros2cli/package.xml" }, ros2pkg: { xml: "ros2pkg/package.xml" } } },
  { name: "xacro", repo: "https://github.com/ros/xacro", ref: "ros2", commit: "da4b3849f8320903d625250089f67f0632be86f2",
    license: "BSD-3-Clause", licenseFiles: ["LICENSE"], dists: [["xacro", "xacro", null, "package.xml"]],
    entryPoints: "[console_scripts]\nxacro = xacro:main\n", ros: { xacro: { xml: "package.xml" } } },
  { name: "osrf_pycommon", repo: "https://github.com/osrf/osrf_pycommon", ref: "2.1.6", commit: "d3acec6fa61ee078b583a38ecfc41f4075454544",
    license: "Apache-2.0", licenseFiles: ["LICENSE"], dists: [["osrf_pycommon", "osrf_pycommon", null, "2.1.6"]] },
  { name: "srdfdom", repo: "https://github.com/moveit/srdfdom", ref: "ros2", commit: "2c820aa46847fa4309e4dbfe432eaf7ebdbacd85",
    license: "BSD-3-Clause", licenseFiles: ["LICENSE.txt"], dists: [["srdfdom", "srdfdom", null, "package.xml"]],
    ros: { srdfdom: { xml: "package.xml" } } },
  { name: "urdf_parser_py", repo: "https://github.com/ros/urdf_parser_py", ref: "ros2", commit: "a0e5291577f1431fa6daafb236ffea34267cf704",
    license: "BSD-3-Clause", licenseFiles: ["LICENSE"], exclude: ["urdf_parser_py/display_urdf.py"],
    dists: [["urdf_parser_py", "src/urdf_parser_py", null, "package.xml"]], ros: { urdf_parser_py: { xml: "package.xml" } } },
  // catkin_pkg (+ pyparsing): ros_gz_sim's gz_sim.launch.py reads every package.xml with catkin_pkg.parse_package
  { name: "catkin_pkg", repo: "https://github.com/ros-infrastructure/catkin_pkg", ref: "1.1.1", commit: "de8b53fad247540f7c3112ff0c4478d847372c54",
    license: "BSD-3-Clause", licenseFiles: ["LICENSE"],
    exclude: ["catkin_pkg/cli", "catkin_pkg/templates", "catkin_pkg/changelog.py", "catkin_pkg/changelog_generator.py",
      "catkin_pkg/changelog_generator_vcs.py", "catkin_pkg/package_templates.py", "catkin_pkg/workspace_vcs.py"],
    dists: [["catkin_pkg", "src/catkin_pkg", null, "1.1.1"]] },
  { name: "pyparsing", repo: "https://github.com/pyparsing/pyparsing", ref: "3.2.0", commit: "36fc04b780bf4bc41b8ad60a2cfd89528545c38c",
    license: "MIT", licenseFiles: ["LICENSE"], exclude: ["pyparsing/diagram"], dists: [["pyparsing", "pyparsing", null, "3.2.0"]] },
  { name: "lark", repo: "https://github.com/lark-parser/lark", ref: "1.2.2", commit: "acfe33d943a1310f3ca26145eb2896bc5c4955c9",
    license: "MIT", licenseFiles: ["LICENSE"], exclude: ["lark/tools", "lark/__pyinstaller"],
    dists: [["lark", "lark", null, "1.2.2"]] },
  { name: "pyyaml", repo: "https://github.com/yaml/pyyaml", ref: "6.0.2", commit: "41309b0bcb4559edb1d691d47199035ef539d785",
    license: "MIT", licenseFiles: ["LICENSE"], dists: [["yaml", "lib/yaml", null, "6.0.2", "PyYAML"]] },
  { name: "packaging", repo: "https://github.com/pypa/packaging", ref: "24.2", commit: "d8e3b31b734926ebbcaff654279f6855a73e052f",
    license: "Apache-2.0 OR BSD-2-Clause", licenseFiles: ["LICENSE", "LICENSE.APACHE", "LICENSE.BSD"],
    dists: [["packaging", "src/packaging", null, "24.2"]] },
];
const SKIP_DIRS = new Set(["test", "tests", "doc", "docs", "examples", "__pycache__", ".git"]);
const KEEP_EXT = /\.(py|lark)$/;
const SKIP_FILES = new Set(["conftest.py"]);
// the zip is an overlay of /opt/ros/jazzy: python modules where Ubuntu's ros-jazzy-* debs put them, plus share/
const SITE = "lib/python3.12/site-packages/";

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

function locate(src) {
  for (const root of SEARCH) {
    for (const cand of [join(root, src.name), join(root, src.name + "-src")]) {
      if (!existsSync(join(cand, ".git"))) continue;
      try { if (sh("git", ["-C", cand, "rev-parse", "HEAD"]) === src.commit) return cand; } catch { /* not a repo */ }
    }
  }
  const dir = join(CACHE, src.name);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, ".git"))) sh("git", ["init", "-q", dir]);
  console.log(`  fetching ${src.repo} @ ${src.commit.slice(0, 10)} (${src.ref})`);
  sh("git", ["-C", dir, "fetch", "-q", "--depth", "1", src.repo, src.commit]);
  sh("git", ["-C", dir, "checkout", "-q", "--force", src.commit]);
  return dir;
}

function walk(dir, base, out, exclude) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const rel = relative(base, p).split("\\").join("/");
    if (exclude.some((e) => rel === e || rel.startsWith(e + "/"))) continue;
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p, base, out, exclude); }
    else if (KEEP_EXT.test(name) && !SKIP_FILES.has(name)) out.push(rel);
  }
}

// setup() kwargs of a ROS python package, read by running its setup.py against a stub setuptools
const SETUP_PROBE = `
import json, os, sys, types
cap = {}
st = types.ModuleType("setuptools")
st.setup = lambda **kw: cap.update(kw)
st.find_packages = lambda *a, **k: []
sys.modules["setuptools"] = st
os.chdir(os.path.dirname(os.path.abspath(sys.argv[1])))
sys.argv = ["setup.py"]
exec(compile(open("setup.py").read(), "setup.py", "exec"), {"__name__": "__main__", "__file__": "setup.py"})
ep = cap.get("entry_points") or {}
print(json.dumps({"name": cap.get("name"), "version": cap.get("version"), "description": cap.get("description"),
                  "license": cap.get("license"), "entry_points": ep}))
`;

function entryPointsTxt(ep, drop = []) {
  let txt = "";
  for (const [group, items] of Object.entries(ep)) {
    if (drop.some((d) => group === d)) continue;
    const lines = (Array.isArray(items) ? items : String(items).split("\n")).map((s) => s.trim()).filter(Boolean)
      .filter((l) => !drop.some((d) => l.startsWith(d)));
    if (lines.length) txt += `[${group}]\n${lines.join("\n")}\n\n`;
  }
  return txt;
}

const entries = []; // [zipPath, absPath | {text}]
const record = [];
console.log("Assembling the ROS 2 launch runtime (py.zip)");
for (const src of SOURCES) {
  const dir = locate(src);
  const commit = sh("git", ["-C", dir, "rev-parse", "HEAD"]);
  if (commit !== src.commit) throw new Error(`${src.name}: expected ${src.commit}, got ${commit}`);
  const dists = [];
  for (const [mod, path, setupPy, ver, distName] of src.dists) {
    const files = [];
    const base = join(dir, dirname(path) === "." ? "" : dirname(path));
    walk(join(dir, path), base, files, src.exclude || []);
    for (const f of files) entries.push([SITE + f, join(base, f)]);
    const ros = src.ros?.[mod];
    if (ros) {   // what colcon installs for the ROS package: ament index marker, share/<pkg>/package.xml, data files
      entries.push([`share/ament_index/resource_index/packages/${mod}`, { text: "" }]);
      entries.push([`share/${mod}/package.xml`, join(dir, ros.xml)]);
      for (const [from, to] of ros.share || []) entries.push([`share/${mod}/${to}`, join(dir, from)]);
    }
    let meta = { name: distName || mod, version: ver, entry_points: {} };
    if (setupPy) meta = { ...meta, ...JSON.parse(sh("python3", ["-I", "-c", SETUP_PROBE, join(dir, setupPy)])) };
    if (ver === "package.xml") meta.version = /<version>\s*([^<\s]+)/.exec(readFileSync(join(dir, "package.xml"), "utf8"))[1];
    const di = `${meta.name.replace(/-/g, "_")}-${meta.version}.dist-info`;
    entries.push([`${SITE}${di}/METADATA`, { text: `Metadata-Version: 2.1\nName: ${meta.name}\nVersion: ${meta.version}\n` +
      `Summary: ${(meta.description || "").replace(/\s+/g, " ")}\nLicense: ${src.license}\nHome-page: ${src.repo}\n` }]);
    entries.push([`${SITE}${di}/top_level.txt`, { text: mod + "\n" }]);
    const ep = src.entryPoints || entryPointsTxt(meta.entry_points || {}, src.dropEntryPoints);
    if (ep) entries.push([`${SITE}${di}/entry_points.txt`, { text: ep }]);
    for (const lf of src.licenseFiles) entries.push([`${SITE}${di}/${lf}`, join(dir, lf)]);
    dists.push({ module: mod, dist: meta.name, version: meta.version, path, files: files.length });
  }
  record.push({ name: src.name, repo: src.repo, ref: src.ref, commit, license: src.license, licenseFiles: src.licenseFiles, dists });
  console.log(`  ${src.name.padEnd(15)} ${commit.slice(0, 10)} ${dists.map((d) => `${d.module}@${d.version}(${d.files})`).join(" ")}`);
}
for (const f of readdirSync(GLUE_DIR).filter((f) => f.endsWith(".py")).sort()) entries.push([SITE + f, join(GLUE_DIR, f)]);

// deterministic zip (fixed timestamps, sorted) written by python's zipfile
mkdirSync(OUT_DIR, { recursive: true });
const listFile = join(os.tmpdir(), `r2l-zip-list-${process.pid}.json`);
writeFileSync(listFile, JSON.stringify(entries.sort((a, b) => (a[0] < b[0] ? -1 : 1))));
const ZIPPER = `
import json, sys, zipfile
entries = json.load(open(sys.argv[1]))
with zipfile.ZipFile(sys.argv[2], "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, src in entries:
        data = src["text"].encode() if isinstance(src, dict) else open(src, "rb").read()
        zi = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        z.writestr(zi, data, compresslevel=9)
`;
const zipPath = join(OUT_DIR, "py.zip");
sh("python3", ["-I", "-c", ZIPPER, listFile, zipPath]);
const buf = readFileSync(zipPath);
const sha256 = createHash("sha256").update(buf).digest("hex");
const glue = readdirSync(GLUE_DIR).filter((f) => f.endsWith(".py")).sort();
writeFileSync(join(OUT_DIR, "SOURCES.json"), JSON.stringify({
  description: "Pure-Python ROS 2 Jazzy launch system run by public/js/launch-worker.js in Pyodide. Built by tools/build-launch-runtime.mjs.",
  pyodide: "314.0.7",
  zip: { file: "py.zip", bytes: buf.length, sha256, files: entries.length },
  glue: { dir: "tools/launch-runtime-py", files: glue, license: "same as the ROS2Lab site" },
  sources: record,
}, null, 2) + "\n");
console.log(`wrote ${relative(ROOT, zipPath)}: ${(buf.length / 1024).toFixed(0)} KB, ${entries.length} files, sha256 ${sha256.slice(0, 12)}`);
