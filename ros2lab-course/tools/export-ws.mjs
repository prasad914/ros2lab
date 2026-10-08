// Writes the ROS 2 Jazzy workspace that the RViz page builds in its practice terminal to a real folder, using the
// page's own generators (public/js/rviz-pkg.js ...), so the same packages can be built with colcon on Ubuntu 24.04:
//   node tools/export-ws.mjs <out_dir> [robot_id ...]      (no ids: every robot in public/robots/index.json)
//   node tools/export-ws.mjs --per-robot <out_dir> [ids]  one workspace per robot: <out_dir>/<id>_ws/src/...
// Mesh files are copied from public/robots/<pkg>/meshes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), pub = path.resolve(here, "../public");
globalThis.location = { origin: "http://localhost", href: "http://localhost/rviz.html" };
globalThis.fetch = async (url) => {
  const rel = decodeURIComponent(new URL(String(url), "http://localhost/").pathname);
  // ROS2LAB_PUBLIC: more folders to look in (the rest of the site, when only an update package is unpacked here)
  const p = [pub, ...(process.env.ROS2LAB_PUBLIC || "").split(path.delimiter).filter(Boolean)].map((r) => path.join(r, rel)).find((f) => fs.existsSync(f)) || path.join(pub, rel);
  if (!fs.existsSync(p)) return { ok: false, status: 404, text: async () => "" };
  return { ok: true, status: 200, text: async () => fs.readFileSync(p, "utf8"), arrayBuffer: async () => fs.readFileSync(p).buffer };
};
const { galleryPackage } = await import("../public/js/rviz-pkg.js");
const argv = process.argv.slice(2), perRobot = argv[0] === "--per-robot"; if (perRobot) argv.shift();
const [out = "ros2lab_ws", ...ids] = argv;
const list = JSON.parse(fs.readFileSync(path.join(pub, "robots/index.json"), "utf8"));
const want = ids.length ? list.filter((g) => ids.includes(g.id)) : list;
const done = new Map();
for (const g of want) {
  let p;
  try { p = await galleryPackage(g); } catch (e) { console.log(`${g.id}: skipped (${e.message}; run this in the full site folder, or set ROS2LAB_PUBLIC)`); continue; }
  const extra = p.extraPackages || [];
  const wsDir = perRobot ? path.join(out, `${g.id}_ws`) : out;
  if (perRobot) { fs.mkdirSync(wsDir, { recursive: true }); fs.writeFileSync(path.join(wsDir, "README.md"), wsReadme(g, [p, ...extra])); done.clear(); }
  for (const pk of [p, ...extra]) {
    const dir = path.join(wsDir, "src", pk.name);
    // several gallery robots share one package (ur5e/..., tb3 burger/waffle): merge their files
    for (const [rel, content] of Object.entries(pk.files)) {
      const f = path.join(dir, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      const m = String(content).match(/^@url:(.+)$/);
      if (m) { const from = [pub, ...(process.env.ROS2LAB_PUBLIC || "").split(path.delimiter).filter(Boolean)].map((r) => path.join(r, decodeURIComponent(m[1]))).find((x) => fs.existsSync(x)); if (from) fs.copyFileSync(from, f); else console.log(`  (missing on the site: ${m[1]})`); }
      else if (!(done.get(pk.name) && rel === "package.xml" && fs.existsSync(f))) fs.writeFileSync(f, content);
      if (/^scripts\//.test(rel) || /^#!/.test(String(content))) fs.chmodSync(f, 0o755);   // ros2 run needs executable scripts
    }
    done.set(pk.name, true);
  }
  console.log(`${g.id}: ${[p, ...extra].map((x) => x.name).join(", ")}`);
}

function wsReadme(g, pkgs) {
  const M = g.moveit ? pkgs.find((x) => /_moveit_config$/.test(x.name)) : null, d = pkgs[0];
  const has = (f) => Object.keys(d.files).includes(f);
  return `# ${g.title}: ROS 2 Jazzy workspace (from ROS2Lab)

Packages: ${pkgs.map((x) => x.name).join(", ")}

\`\`\`bash
# Ubuntu 24.04 + ROS 2 Jazzy: https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html
sudo apt install ros-jazzy-desktop ros-jazzy-xacro ros-jazzy-joint-state-publisher-gui ros-jazzy-ros-gz ros-jazzy-gz-ros2-control \\
  ros-jazzy-ros2-controllers ros-jazzy-teleop-twist-keyboard ros-jazzy-rviz-imu-plugin${M ? " \\\n  ros-jazzy-moveit ros-jazzy-moveit-planners-chomp ros-jazzy-moveit-planners-stomp ros-jazzy-pilz-industrial-motion-planner ros-jazzy-warehouse-ros-sqlite" : ""}
cd ${g.id}_ws && rosdep install --from-paths src --ignore-src -r -y
colcon build && source install/setup.bash
\`\`\`

| What | Command |
|---|---|
| The model in RViz (sliders) | \`ros2 launch ${d.name} display.launch.py\` |
${has("launch/sim.launch.py") ? `| Gazebo with sensors, drive with teleop | \`ros2 launch ${d.name} sim.launch.py\` then \`ros2 run teleop_twist_keyboard teleop_twist_keyboard\` |\n` : ""}${has("launch/sim_control.launch.py") ? `| Gazebo + ros2_control | \`ros2 launch ${d.name} sim_control.launch.py\` |\n` : ""}${M ? `| MoveIt 2, mock hardware | \`ros2 launch ${M.name} demo.launch.py\` (obstacles: \`ros2 run ${M.name} add_scene_objects.py\`) |\n| Gazebo + MoveIt 2 | \`ros2 launch ${M.name} gazebo.launch.py\` |\n| The real arm | \`src/${M.name}/README.md\`, then \`ros2 launch ${M.name} real.launch.py\` |\n` : ""}${has("launch/real.launch.py") ? `| The real robot | \`src/${d.name}/REAL_ROBOT.md\`, then \`ros2 launch ${d.name} real.launch.py\` |\n` : ""}`;
}
