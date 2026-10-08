// Turns a robot (a gallery xacro, or the student's own files) into a ROS 2 description package laid out the
// conventional way, so the practice terminal can build and launch it exactly like on Ubuntu:
//   <pkg>/package.xml, CMakeLists.txt (install(DIRECTORY ...)), urdf/, meshes/, launch/display.launch.py,
//   launch/display.launch.xml, rviz/display.rviz
// Binary files (meshes) are stored as "@url:<address>" so RViz can fetch them; text files keep their text.

import { xacro, parseURDF, urdfEdges, framePoses, tMul, qRPY, qRot } from "./urdf-core.js";
import { simFiles, simFromUrdf, autoSimSpec } from "./rviz-sim.js";
import { urdfGazebo } from "./gz-sdf.js";
import { moveitModel, moveitConfigFiles, placeScene } from "./moveit-config.js";
import { meshPointsFrom } from "./moveit-core.js";
import { realFor, realLaunchPy, realReadme } from "./real-robot.js";

const fetchText = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url} (${r.status})`); return r.text(); });

export const packageXml = (pkg, desc = "Robot description: URDF/xacro, meshes, launch and RViz files", sim = false, license = "Apache-2.0") => `<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>${pkg}</name>
  <version>0.1.0</version>
  <description>${desc}</description>
  <maintainer email="student@ros2lab.com">student</maintainer>
  <license>${license}</license>

  <buildtool_depend>ament_cmake</buildtool_depend>

  <exec_depend>joint_state_publisher</exec_depend>
  <exec_depend>joint_state_publisher_gui</exec_depend>
  <exec_depend>robot_state_publisher</exec_depend>
  <exec_depend>rviz2</exec_depend>
  <exec_depend>xacro</exec_depend>
${sim ? "  <exec_depend>ros_gz_sim</exec_depend>\n  <exec_depend>ros_gz_bridge</exec_depend>\n  <exec_depend>rviz_imu_plugin</exec_depend>\n" : ""}${sim === "control" ? "  <exec_depend>gz_ros2_control</exec_depend>\n  <exec_depend>controller_manager</exec_depend>\n  <exec_depend>joint_state_broadcaster</exec_depend>\n  <exec_depend>diff_drive_controller</exec_depend>\n  <exec_depend>joint_trajectory_controller</exec_depend>\n" : ""}
  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
`;

export const cmakeLists = (pkg, dirs) => `cmake_minimum_required(VERSION 3.8)
project(${pkg})

find_package(ament_cmake REQUIRED)

# copy these folders to install/${pkg}/share/${pkg}/ so launch files, RViz and
# package://${pkg}/... mesh paths can find them after "colcon build"
install(
  DIRECTORY ${dirs.join(" ")}
  DESTINATION share/\${PROJECT_NAME}
)

ament_package()
`;

export const launchPy = (pkg, urdfFile) => `from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition, UnlessCondition
from launch.substitutions import Command, LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    pkg_share = FindPackageShare('${pkg}')
    default_model = PathJoinSubstitution([pkg_share, 'urdf', '${urdfFile}'])
    default_rviz = PathJoinSubstitution([pkg_share, 'rviz', 'display.rviz'])

    model = LaunchConfiguration('model')
    gui = LaunchConfiguration('gui')
    rviz_config = LaunchConfiguration('rvizconfig')

    # xacro turns the .urdf.xacro file into plain URDF text;
    # robot_state_publisher receives it as the string parameter robot_description
    robot_description = ParameterValue(Command(['xacro ', model]), value_type=str)

    return LaunchDescription([
        DeclareLaunchArgument('model', default_value=default_model,
                              description='Absolute path to the robot .urdf or .urdf.xacro file'),
        DeclareLaunchArgument('gui', default_value='true',
                              description='true: joint_state_publisher_gui (sliders), false: joint_state_publisher'),
        DeclareLaunchArgument('rvizconfig', default_value=default_rviz,
                              description='Absolute path to the RViz config file'),

        # publishes /robot_description, and /tf + /tf_static computed from /joint_states
        Node(package='robot_state_publisher', executable='robot_state_publisher',
             parameters=[{'robot_description': robot_description}]),

        # publishes /joint_states for every movable joint
        Node(package='joint_state_publisher_gui', executable='joint_state_publisher_gui',
             condition=IfCondition(gui)),
        Node(package='joint_state_publisher', executable='joint_state_publisher',
             condition=UnlessCondition(gui)),

        Node(package='rviz2', executable='rviz2', name='rviz2', output='screen',
             arguments=['-d', rviz_config]),
    ])
`;

export const launchXml = (pkg, urdfFile) => `<launch>
  <arg name="model" default="$(find-pkg-share ${pkg})/urdf/${urdfFile}"/>
  <arg name="gui" default="true"/>
  <arg name="rvizconfig" default="$(find-pkg-share ${pkg})/rviz/display.rviz"/>

  <!-- publishes /robot_description, and /tf + /tf_static computed from /joint_states -->
  <node pkg="robot_state_publisher" exec="robot_state_publisher">
    <param name="robot_description" value="$(command 'xacro $(var model)')" type="str"/>
  </node>

  <!-- publishes /joint_states for every movable joint -->
  <node pkg="joint_state_publisher_gui" exec="joint_state_publisher_gui" if="$(var gui)"/>
  <node pkg="joint_state_publisher" exec="joint_state_publisher" unless="$(var gui)"/>

  <node pkg="rviz2" exec="rviz2" name="rviz2" output="screen" args="-d $(var rvizconfig)"/>
</launch>
`;

const qos = (topic, durability = "Volatile") => `        Depth: 5
        Durability Policy: ${durability}
        History Policy: Keep Last
        Reliability Policy: Reliable
        Value: ${topic}`;
export const rvizConfig = (fixedFrame, view = { distance: 2, focal: [0, 0, 0], yaw: 0.785398006439209, pitch: 0.5 }, extra = "") => `Panels:
  - Class: rviz_common/Displays
    Help Height: 78
    Name: Displays
    Property Tree Widget:
      Expanded:
        - /Global Options1
        - /Status1
      Splitter Ratio: 0.5
    Tree Height: 555
  - Class: rviz_common/Views
    Expanded:
      - /Current View1
    Name: Views
    Splitter Ratio: 0.5
Visualization Manager:
  Class: ""
  Displays:
    - Alpha: 0.5
      Cell Size: 1
      Class: rviz_default_plugins/Grid
      Color: 160; 160; 164
      Enabled: true
      Line Style:
        Line Width: 0.029999999329447746
        Value: Lines
      Name: Grid
      Normal Cell Count: 0
      Offset:
        X: 0
        Y: 0
        Z: 0
      Plane: XY
      Plane Cell Count: 10
      Reference Frame: <Fixed Frame>
      Value: true
    - Alpha: 1
      Class: rviz_default_plugins/RobotModel
      Collision Enabled: false
      Description File: ""
      Description Source: Topic
      Description Topic:
${qos("/robot_description", "Volatile")}
      Enabled: true
      Name: RobotModel
      TF Prefix: ""
      Update Interval: 0
      Value: true
      Visual Enabled: true
    - Class: rviz_default_plugins/TF
      Enabled: true
      Frame Timeout: 15
      Marker Scale: 1
      Name: TF
      Show Arrows: true
      Show Axes: true
      Show Names: false
      Update Interval: 0
      Value: true
${extra ? extra + "\n" : ""}  Enabled: true
  Global Options:
    Background Color: 48; 48; 48
    Fixed Frame: ${fixedFrame}
    Frame Rate: 30
  Name: root
  Tools:
    - Class: rviz_default_plugins/Interact
      Hide Inactive Objects: true
    - Class: rviz_default_plugins/MoveCamera
    - Class: rviz_default_plugins/Select
    - Class: rviz_default_plugins/FocusCamera
    - Class: rviz_default_plugins/Measure
      Line color: 128; 128; 0
    - Class: rviz_default_plugins/SetInitialPose
      Topic:
${qos("/initialpose")}
    - Class: rviz_default_plugins/SetGoal
      Topic:
${qos("/goal_pose")}
    - Class: rviz_default_plugins/PublishPoint
      Single click: true
      Topic:
${qos("/clicked_point")}
  Transformation:
    Current:
      Class: rviz_default_plugins/TF
  Value: true
  Views:
    Current:
      Class: rviz_default_plugins/Orbit
      Distance: ${num(view.distance)}
      Focal Point:
        X: ${num(view.focal[0])}
        Y: ${num(view.focal[1])}
        Z: ${num(view.focal[2])}
      Focal Shape Fixed Size: true
      Focal Shape Size: 0.05000000074505806
      Invert Z Axis: false
      Name: Current View
      Near Clip Distance: 0.009999999776482582
      Pitch: ${num(view.pitch)}
      Target Frame: <Fixed Frame>
      Value: Orbit (rviz_default_plugins)
      Yaw: ${num(view.yaw)}
    Saved: ~
Window Geometry:
  Height: 846
  Hide Left Dock: false
  Hide Right Dock: false
  Width: 1200
`;

const num = (v) => String(Math.round(v * 1e4) / 1e4);
// A saved camera view that shows the whole robot (as someone would save it in RViz with File > Save Config):
// the bounding box of every link's shapes with the joints at zero, looked at from yaw 45 deg, pitch ~23 deg
export function viewFor(urdfText) {
  try {
    const m = parseURDF(urdfText), poses = framePoses(urdfEdges(m, {}, true), m.root).poses;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const add = (p) => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } };
    for (const l of Object.values(m.links)) {
      const T = poses[l.name]; if (!T) continue; add(T.t);
      for (const v of l.visuals) {
        const g = v.geom, e = g.type === "box" ? g.size.map((x) => x / 2) : g.type === "cylinder" ? [g.radius, g.radius, g.length / 2] : g.type === "sphere" ? [g.radius, g.radius, g.radius] : [0.25, 0.25, 0.15];   // a mesh: its size is unknown until it is loaded, so allow a typical robot part
        const c = tMul(T, { t: v.origin.xyz, q: qRPY(...v.origin.rpy) });
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const r = qRot(c.q, [sx * e[0], sy * e[1], sz * e[2]]); add([c.t[0] + r[0], c.t[1] + r[1], c.t[2] + r[2]]); }
      }
    }
    if (!Number.isFinite(lo[0])) return undefined;
    const size = Math.max(0.3, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]));
    return { distance: Math.max(0.6, size * 1.9), focal: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], yaw: 0.785398006439209, pitch: 0.4 };
  } catch { return undefined; }
}
const rootLinkOf = (urdfText) => { const kids = new Set([...String(urdfText).matchAll(/<child\s+link="([^"]+)"/g)].map((m) => m[1])); return [...String(urdfText).matchAll(/<link\s+name="([^"]+)"/g)].map((m) => m[1]).find((l) => !kids.has(l)) || "base_link"; };

// xacro of a package's main file, from the package's own files map ($(find pkg)/urdf/x -> files["urdf/x"])
function expand(files, pkg, main) {
  try { const t = files[`urdf/${main}`]; return /<xacro:|xmlns:xacro/.test(t) ? xacro(t, { path: `/${pkg}/urdf/${main}`, files: (p) => files[String(p).replace(new RegExp(`^/${pkg}/`), "")], find: (q) => (q === pkg ? `/${pkg}` : undefined) }) : t; }
  catch { return ""; }
}
// A gallery robot (public/robots/...) as a package. "../../common/urdf/x.xacro" includes become $(find pkg)/urdf/x.xacro.
async function gallerySources(g) {
  const top = g.file.split("/")[0];
  const pkg = g.pkg || (/_description$/.test(top) ? top : `${g.id}_description`);
  const main = g.file.split("/").pop();
  const files = {};
  const seen = new Set();
  async function take(url, name) {
    if (seen.has(url)) return; seen.add(url);
    let text = await fetchText(url);
    const incs = [...text.matchAll(/<xacro:include\s+filename="([^"]+)"/g)].map((m) => m[1]);
    for (const inc of incs) {
      if (/^\$\(find /.test(inc)) continue;
      const incUrl = new URL(inc, location.origin + url).pathname, incName = inc.split("/").pop();
      text = text.split(`filename="${inc}"`).join(`filename="$(find ${pkg})/urdf/${incName}"`);
      await take(incUrl, incName);
    }
    files[`urdf/${name}`] = text;
  }
  await take(`/robots/${g.file}`, main);
  const meshes = new Set();
  for (const t of Object.values(files)) for (const m of t.matchAll(/package:\/\/([\w-]+)\/meshes\/([^"']+)/g)) if (m[1] === pkg) meshes.add(m[2]);
  for (const m of meshes) files[`meshes/${m}`] = `@url:/robots/${pkg}/meshes/${m}`;
  return { pkg, main, files, meshes };
}
// the plain URDF of a gallery robot, and a reader for its mesh files (package://pkg/meshes/... -> points)
export async function galleryUrdf(g, meshPointsFrom) {
  const { pkg, main, files } = await gallerySources(g);
  const readMesh = async (fn) => {
    const m = String(fn).match(/^package:\/\/([\w-]+)\/(.+)$/), c = m && m[1] === pkg ? files[m[2]] : null, u = c && String(c).match(/^@url:(.+)$/);
    if (!u) return [];
    const r = await fetch(u[1]); if (!r.ok) return [];
    const ext = String(fn).split(".").pop().toLowerCase();
    return meshPointsFrom(ext === "stl" ? await r.arrayBuffer() : await r.text(), ext);
  };
  return { pkg, main, files, urdf: expand(files, pkg, main), readMesh };
}
export async function galleryPackage(g) {
  const { pkg, main, files, meshes } = await gallerySources(g);
  const plain = expand(files, pkg, main), view = viewFor(plain);
  let sim = null;
  // robots without a hand-written "sim" entry (and that are not arms): a simulation read from their URDF
  let simSpec = g.sim || null;
  if (!simSpec && !g.moveit) { try { simSpec = autoSimSpec(parseURDF(plain), plain); } catch { simSpec = null; } }
  if (simSpec) sim = simFiles(pkg, main, simSpec, plain, view);
  const dirs = ["launch", "urdf", ...(meshes.size ? ["meshes"] : []), "rviz", ...(sim ? ["worlds", "config"] : [])];
  if (g.source && g.source.url) { try { const lic = await fetchText(`/robots/${pkg}/LICENSE`); files.LICENSE = lic; } catch { /* no licence file */ } }
  Object.assign(files, {
    "package.xml": packageXml(pkg, `${g.title}: URDF/xacro description, launch and RViz files${sim ? ", and a Gazebo simulation with its sensors" : ""}${sim && sim.control ? " (also driven by ros2_control)" : ""}`, sim && sim.control ? "control" : !!sim, (g.source && g.source.license) || "Apache-2.0"),
    "CMakeLists.txt": cmakeLists(pkg, dirs),
    "launch/display.launch.py": launchPy(pkg, main),
    "launch/display.launch.xml": launchXml(pkg, main),
    "rviz/display.rviz": rvizConfig(g.fixedFrame || "base_link", view),
  });
  if (sim) { Object.assign(files, sim.files); files["rviz/sim.rviz"] = rvizConfig(sim.fixedFrame || g.fixedFrame || "base_link", sim.fixedFrame === "odom" ? { ...view, distance: Math.max(view ? view.distance : 2, 3), focal: [0, 0, 0] } : view, sim.displays).replace("      Marker Scale: 1\n", "      Marker Scale: 0.3\n"); }
  if (sim && sim.control) { Object.assign(files, sim.control.files); const ff = sim.control.fixedFrame || g.fixedFrame || "base_link"; files["rviz/sim_control.rviz"] = rvizConfig(ff, ff === "odom" ? { ...view, distance: Math.max(view ? view.distance : 2, 3), focal: [0, 0, 0] } : view, sim.control.displays).replace("      Marker Scale: 1\n", "      Marker Scale: 0.3\n"); }
  // the purchased robot: launch/real.launch.py (the maker's driver + RViz) and REAL_ROBOT.md
  const real = realFor(g);
  if (real) { files["launch/real.launch.py"] = realLaunchPy(pkg, g, real, main, files["rviz/sim.rviz"] ? "sim.rviz" : "display.rviz"); files["REAL_ROBOT.md"] = realReadme(pkg, g, real); }
  const launches = ["display.launch.py", "display.launch.xml", ...(sim ? ["sim.launch.py", "sim.launch.xml"] : []), ...(sim && sim.control ? ["sim_control.launch.py", "sim_control.launch.xml"] : [])];
  // arms: a <robot>_moveit_config package next to the description (MoveIt 2 with OMPL, Pilz, CHOMP, STOMP)
  let moveit = null;
  if (g.moveit) { try { moveit = await galleryMoveit(g, pkg, main, plain, view); } catch (e) { moveit = { error: e.message }; } }
  return { name: pkg, files, main, launches, sim: sim ? { ...sim.sim, control: sim.control ? { controller: sim.control.controller, arm: sim.control.arm } : null } : null,
    moveit: moveit && !moveit.error ? moveit.info : null, extraPackages: moveit && moveit.pkg ? [moveit.pkg] : [], notes: moveit && moveit.error ? [`MoveIt config could not be made: ${moveit.error}`] : [] };
}

// The student's own files: a package folder (with package.xml) is used as it is; loose .urdf/.xacro files
// (and their meshes) are wrapped in a new package named after the package:// / $(find ...) paths they use.
const blobs = [];
export async function folderPackage(list) {
  const norm = (p) => String(p).replace(/\\/g, "/").replace(/^\/+/, "");
  const entries = list.map((f) => ({ f, rel: norm(f.webkitRelativePath || f.name) }));
  const isText = (n) => /\.(urdf|xacro|xml|launch\.py|py|rviz|yaml|yml|txt|cmake|md|srdf|sdf|gazebo|trans)$/i.test(n) || /CMakeLists\.txt$/.test(n);
  const pkgXml = entries.filter((e) => /(^|\/)package\.xml$/.test(e.rel)).sort((a, b) => a.rel.length - b.rel.length)[0];
  const files = {};
  for (const u of blobs.splice(0)) URL.revokeObjectURL(u);   // the previous upload's files are not needed any more
  const blob = (f) => { const u = URL.createObjectURL(f); blobs.push(u); return `@url:${u}`; };
  let name, notes = [];
  if (pkgXml) {
    const base = pkgXml.rel.replace(/package\.xml$/, "");
    name = ((await pkgXml.f.text()).match(/<name>\s*([\w-]+)\s*<\/name>/) || [])[1] || base.split("/").filter(Boolean).pop() || "my_robot_description";
    for (const e of entries) { if (!e.rel.startsWith(base)) continue; const rel = e.rel.slice(base.length); if (!rel || /(^|\/)(build|install|log|\.git)\//.test(rel)) continue; files[rel] = isText(e.rel) ? await e.f.text() : blob(e.f); }
  } else {
    const texts = {};
    for (const e of entries) if (isText(e.rel)) texts[e.rel] = await e.f.text();
    const refs = new Set(); for (const t of Object.values(texts)) for (const m of t.matchAll(/(?:package:\/\/|\$\(find\s+)([\w-]+)/g)) refs.add(m[1]);
    name = refs.size === 1 ? [...refs][0] : "my_robot_description";
    const robots = Object.keys(texts).filter((p) => /\.(urdf|xacro)$/i.test(p) && /<robot\b/.test(texts[p]));
    if (!robots.length) return { error: "No robot file found. Choose a .urdf or .urdf.xacro file (its top tag is <robot name=\"...\">), or a package folder." };
    for (const e of entries) {
      const short = e.rel.split("/").slice(1).join("/") || e.rel;   // drop the chosen folder's own name
      const inUrdf = /\.(urdf|xacro)$/i.test(e.rel), inMesh = /\.(stl|dae|obj|mtl|png|jpg|jpeg)$/i.test(e.rel);
      const rel = /^(urdf|meshes|launch|rviz|config)\//.test(short) ? short : inUrdf ? `urdf/${e.rel.split("/").pop()}` : inMesh ? `meshes/${short.replace(/^meshes\//, "")}` : null;
      if (rel) files[rel] = isText(e.rel) ? texts[e.rel] : blob(e.f);
    }
    // every robot file now sits in urdf/: point relative <xacro:include> paths at the copies there
    for (const p of Object.keys(files)) if (/^urdf\//.test(p) && typeof files[p] === "string" && !files[p].startsWith("@url:")) files[p] = files[p].replace(/(<xacro:include\s+filename=")([^"$][^"]*)"/g, (all, a, inc) => (files[`urdf/${inc.split("/").pop()}`] !== undefined ? `${a}${inc.split("/").pop()}"` : all));
    notes.push(`Your files were put into a new package, ${name}, laid out the standard way (package.xml, CMakeLists.txt, urdf/, meshes/, launch/, rviz/).`);
  }
  const urdfFiles = Object.keys(files).filter((p) => /^urdf\/.+\.(urdf|xacro)$/i.test(p) && /<robot\b/.test(files[p]));
  const mainPath = urdfFiles.sort((a, b) => (/\.urdf\.xacro$/.test(b) - /\.urdf\.xacro$/.test(a)) || a.length - b.length)[0] || Object.keys(files).find((p) => /\.(urdf|xacro)$/i.test(p) && /<robot\b/.test(files[p]));
  const main = mainPath ? mainPath.replace(/^urdf\//, "") : null;
  let launches = Object.keys(files).filter((p) => /^launch\/[^/]+\.launch\.(py|xml)$|^launch\/[^/]+\.(py|xml)$/.test(p)).map((p) => p.replace(/^launch\//, ""));
  if (!launches.length && main && /^urdf\//.test(mainPath)) {
    files["launch/display.launch.py"] = launchPy(name, main);
    files["launch/display.launch.xml"] = launchXml(name, main);
    if (!files["rviz/display.rviz"]) { const u = expand(files, name, main); files["rviz/display.rviz"] = rvizConfig(u ? rootLinkOf(u) : rootLinkOf(files[mainPath]), viewFor(u)); }
    launches = ["display.launch.py", "display.launch.xml"];
    if (pkgXml) notes.push(`${name} had no launch file, so launch/display.launch.py, launch/display.launch.xml and rviz/display.rviz were added. If its CMakeLists.txt does not install them yet, add: install(DIRECTORY launch urdf meshes rviz DESTINATION share/\${PROJECT_NAME})`);
  }
  if (!pkgXml) {
    const dirs = ["launch", "urdf", "meshes", "rviz", "config"].filter((d) => Object.keys(files).some((p) => p.startsWith(d + "/")));
    files["package.xml"] = packageXml(name);
    files["CMakeLists.txt"] = cmakeLists(name, dirs);
  }
  // Gazebo: the URDF's <gazebo> sensors and systems need a world, a bridge and a launch file to show up in RViz
  let sim = null;
  if (main && /^urdf\//.test(mainPath) && !Object.entries(files).some(([p, t]) => /^launch\//.test(p) && typeof t === "string" && /gz_sim\.launch|ros_gz_sim/.test(t))) {
    const u = expand(files, name, main), gz = u ? urdfGazebo(u) : null;
    if (gz && (gz.sensors.length || gz.plugins.length || gz.classic.length)) {
      let model = null; try { model = parseURDF(u); } catch { /* reported when launched */ }
      if (model) {
        sim = simFromUrdf(name, main, gz, model, u);
        Object.assign(files, sim.files);
        files["rviz/sim.rviz"] = rvizConfig(sim.fixedFrame, viewFor(u), sim.displays);
        launches.push("sim.launch.py", "sim.launch.xml");
        notes.push(`${model.name} declares ${gz.sensors.length} Gazebo sensor${gz.sensors.length === 1 ? "" : "s"}${gz.sensors.length ? ` (${gz.sensors.map((x) => `${x.name}: ${x.type}`).join(", ")})` : ""}. Added for Gazebo: worlds/${sim.files ? Object.keys(sim.files).find((k) => k.startsWith("worlds/")).slice(7) : ""}, config/gz_bridge.yaml, launch/sim.launch.py (.xml) and rviz/sim.rviz. Choose "Gazebo simulation" to see the sensor data in RViz.`);
        for (const sn of gz.sensors.filter((x) => !x.frame && !x.optical)) notes.push(`Sensor ${sn.name} has no <gz_frame_id>, so its messages carry the frame "${model.name}/${sn.link}/${sn.name}", which is not in TF: RViz will say "Could not transform". Add <gz_frame_id>${sn.link}</gz_frame_id> inside the <sensor>.`);
        if (Object.values(model.joints).some((j) => !["fixed", "floating", "planar"].includes(j.type) && !j.mimic) && !gz.plugins.some((x) => x.kind === "joint_states")) notes.push("There is no JointStatePublisher system, so robot_state_publisher gets no /joint_states from Gazebo and the moving links (wheels, arm links) have no TF. Add <gazebo><plugin filename=\"gz-sim-joint-state-publisher-system\" name=\"gz::sim::systems::JointStatePublisher\"/></gazebo> (the bridge then needs the joint_state topic too).");
        if (gz.classic.length) notes.push(`It also uses Gazebo Classic plugins (${[...new Set(gz.classic.map((c) => c.file))].join(", ")}). Gazebo Harmonic (ROS 2 Jazzy) does not load them: give each <sensor> a <topic> and <gz_frame_id>, use type gpu_lidar instead of ray, and let ros_gz_bridge publish to ROS 2.`);
        if (pkgXml) { const cm = files["CMakeLists.txt"] || ""; if (!/\bworlds\b/.test(cm) || !/\bconfig\b/.test(cm)) notes.push("Its CMakeLists.txt must also install the new folders: install(DIRECTORY launch urdf meshes rviz worlds config DESTINATION share/${PROJECT_NAME})"); }
      }
    }
  }
  if (!pkgXml) {
    const dirs = ["launch", "urdf", "meshes", "rviz", "config", "worlds"].filter((d) => Object.keys(files).some((p) => p.startsWith(d + "/")));
    files["CMakeLists.txt"] = cmakeLists(name, dirs);
    if (sim) files["package.xml"] = packageXml(name, undefined, true);
  }
  launches.sort((a, b) => (/display/.test(b) - /display/.test(a)) || (/\.py$/.test(b) - /\.py$/.test(a)));
  return { name, files, main, mainPath, launches, notes };
}

// The MoveIt config package of a gallery arm. The collision spheres and the SRDF collision matrix come from
// public/robots/moveit/<id>.json when it exists (tools/moveit-precompute.mjs), else they are computed from the meshes.
async function galleryMoveit(g, descPkg, descFile, urdfText, view) {
  let pre = null;
  try { const r = await fetch(`/robots/moveit/${g.id}.json`); if (r.ok) pre = JSON.parse(await r.text()); } catch { pre = null; }
  const model = parseURDF(urdfText);
  const readMesh = pre ? undefined : (await galleryUrdf(g, meshPointsFrom)).readMesh;
  const mm = await moveitModel(model, g.moveit, { pre, readMesh });
  const objects = placeScene(mm, g.moveit);
  const cfg = moveitConfigFiles(g.moveit, { id: g.id, title: g.title, descPkg, descFile, model, urdfText, acm: mm.acm, G: mm.G, objects, view: view && { ...view, focal: [0.35 * mm.reach, 0, 0.3 * mm.reach], distance: Math.max(1, 3.2 * mm.reach) } });
  return { pkg: { name: cfg.name, files: cfg.files, launches: ["demo.launch.py", "gazebo.launch.py", "real.launch.py"] },
    info: { pkg: cfg.name, group: cfg.group, gripperGroup: cfg.gripperGroup, arm: cfg.arm, grip: cfg.grip, home: cfg.home, ready: cfg.ready, init: cfg.init, armCtl: cfg.armCtl, gripCtl: cfg.gripCtl,
      objects, base: mm.G.base, tip: mm.G.tip, spheres: mm.spheres, acm: mm.acm, positionOnly: mm.G.dof < 6 || !!g.moveit.positionOnly, real: g.moveit.real || null, reach: mm.reach } };
}
