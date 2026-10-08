// Gazebo (Harmonic, gz sim 8) as ROS 2 Jazzy uses it: what a robot's URDF/xacro and a world SDF declare,
// and what ros_gz_bridge connects. Pure parsing (no 3D): used by the practice terminal and the content checker.
//
// Real behaviour this follows (gazebosim.org "ROS 2 integration" and "Migrating ROS 2 packages that use Gazebo Classic"):
//  - sensors are <gazebo reference="link"><sensor name type> blocks; type gpu_lidar / camera / depth_camera / rgbd_camera / imu
//  - they publish on Gazebo (gz-transport) topics: <topic>, or /world/<world>/model/<model>/link/<link>/sensor/<name>/<kind>
//  - the header frame is <gz_frame_id> (or <optical_frame_id> for cameras), else the scoped name model/link/sensor
//  - rendering sensors need the world plugin gz-sim-sensors-system; the IMU needs gz-sim-imu-system
//  - ROS sees nothing until ros_gz_bridge maps a gz topic to a ROS topic (GZ_TO_ROS), with matching types
//  - Gazebo Classic plugins (libgazebo_ros_*.so) do nothing in gz sim; sensor type "ray" is not supported (use gpu_lidar)

function attrs(s) { const o = {}; for (const m of String(s || "").matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) o[m[1]] = m[2]; return o; }
const tag = (xml, name) => { const m = String(xml).match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`)); return m ? m[1].trim() : null; };
const num = (xml, name, d) => { const v = tag(xml, name); return v === null || v === "" || !Number.isFinite(Number(v)) ? d : Number(v); };
const blocks = (xml, name) => { const out = []; const re = new RegExp(`<${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${name}>)`, "g"); for (const m of String(xml).matchAll(re)) out.push({ a: attrs(m[1]), body: m[2] || "", raw: m[0] }); return out; };

// ---------------- sensors and model plugins declared in a URDF ----------------
export function urdfGazebo(urdfText) {
  const text = String(urdfText || "").replace(/<!--[\s\S]*?-->/g, "");
  const robot = (text.match(/<robot\b[^>]*\bname\s*=\s*"([^"]*)"/) || [])[1] || "robot";
  const sensors = [], plugins = [], classic = [], warnings = [];
  for (const g of blocks(text, "gazebo")) {
    const link = g.a.reference || null;
    for (const s of blocks(g.body, "sensor")) {
      const type = (s.a.type || "").trim(), b = s.body;
      const sen = { name: s.a.name || type, type, link, topic: tag(b, "topic"), frame: tag(b, "gz_frame_id") || tag(b, "frame_id"), optical: tag(b, "optical_frame_id"),
        rate: num(b, "update_rate", 0), alwaysOn: /<always_on>\s*(true|1)\s*</.test(b), visualize: /<visualize>\s*(true|1)\s*</.test(b) };
      const pose = tag(b, "pose"); sen.pose = pose ? pose.split(/\s+/).map(Number).concat([0, 0, 0, 0, 0, 0]).slice(0, 6) : [0, 0, 0, 0, 0, 0];
      const ray = tag(b, "lidar") || tag(b, "ray");
      if (ray) {
        const hz = tag(ray, "horizontal") || "", vt = tag(ray, "vertical") || "";
        sen.lidar = { hSamples: num(hz, "samples", 640), hMin: num(hz, "min_angle", 0), hMax: num(hz, "max_angle", 0), vSamples: num(vt, "samples", 1), vMin: num(vt, "min_angle", 0), vMax: num(vt, "max_angle", 0),
          min: num(tag(ray, "range") || "", "min", 0.1), max: num(tag(ray, "range") || "", "max", 10), resolution: num(tag(ray, "range") || "", "resolution", 0.01), noise: num(tag(ray, "noise") || "", "stddev", 0) };
      }
      const cam = tag(b, "camera");
      if (cam) {
        const img = tag(cam, "image") || "", clip = tag(cam, "clip") || "";
        sen.camera = { hfov: num(cam, "horizontal_fov", 1.047), width: num(img, "width", 320), height: num(img, "height", 240), format: tag(img, "format") || "R8G8B8", near: num(clip, "near", 0.1), far: num(clip, "far", 100) };
      }
      for (const p of blocks(b, "plugin")) {
        const f = p.a.filename || "";
        if (/libgazebo_ros_/.test(f)) {   // Gazebo Classic: the ROS topic was set by the plugin
          const rm = (p.body.match(/<remapping>\s*~\/out\s*:=\s*([^<\s]+)\s*<\/remapping>/) || [])[1];
          classic.push({ sensor: sen.name, file: f, topic: rm || tag(p.body, "topicName") || null, frame: tag(p.body, "frame_name") || tag(p.body, "frameName") });
        }
      }
      if (type === "ray" || type === "lidar") warnings.push(`[Err] [Sensors.cc] Sensor type ${type === "ray" ? "LIDAR" : "LIDAR"} not supported yet. Try using a GPU LIDAR instead.`);
      sensors.push(sen);
    }
    for (const p of blocks(g.body.replace(/<sensor\b[\s\S]*?<\/sensor>/g, ""), "plugin")) {   // model plugins (a sensor's own plugins were read above)
      const f = p.a.filename || "", body = p.body;
      if (/diff-drive-system|DiffDrive/.test(f + (p.a.name || ""))) plugins.push({ kind: "diff_drive", left: blocks(body, "left_joint").map((x) => x.body.trim()), right: blocks(body, "right_joint").map((x) => x.body.trim()),
        separation: num(body, "wheel_separation", 0.3), radius: num(body, "wheel_radius", 0.05), topic: tag(body, "topic"), odomTopic: tag(body, "odom_topic"), tfTopic: tag(body, "tf_topic"),
        frame: tag(body, "frame_id"), child: tag(body, "child_frame_id"), odomRate: num(body, "odom_publish_frequency", 50) });
      else if (/joint-state-publisher-system|JointStatePublisher/.test(f + (p.a.name || ""))) plugins.push({ kind: "joint_states", topic: tag(body, "topic") });
      else if (/joint-position-controller-system|JointPositionController/.test(f + (p.a.name || ""))) plugins.push({ kind: "joint_position", joint: (tag(body, "joint_name") || "").trim(), topic: tag(body, "topic"), initial: num(body, "initial_position", 0), p: num(body, "p_gain", 1) });
      else if (/velocity-control-system|VelocityControl/.test(f + (p.a.name || "")) && !/Multicopter/.test(f + (p.a.name || ""))) plugins.push({ kind: "velocity_control", topic: tag(body, "topic") });
      else if (/odometry-publisher-system|OdometryPublisher/.test(f + (p.a.name || ""))) plugins.push({ kind: "odometry_publisher", odomTopic: tag(body, "odom_topic"), tfTopic: tag(body, "tf_topic"), frame: tag(body, "odom_frame"), child: tag(body, "robot_base_frame"), odomRate: num(body, "odom_publish_frequency", 50), dims: num(body, "dimensions", 2) });
      else if (/gz_ros2_control|ign_ros2_control/.test(f)) plugins.push({ kind: "gz_ros2_control", params: tag(body, "parameters"), cmName: tag(body, "controller_manager_name"), file: f });
      else if (/libgazebo_ros_/.test(f)) classic.push({ sensor: null, file: f, topic: tag(body, "topicName") || null });
      else if (f) plugins.push({ kind: "other", file: f, name: p.a.name || "" });
    }
  }
  if (classic.length) warnings.push(`[Wrn] [SDFormat] Gazebo Classic plugin${classic.length > 1 ? "s" : ""} ${[...new Set(classic.map((c) => c.file))].join(", ")} ignored: gz sim (Harmonic) does not load libgazebo_ros_*.so plugins. Use <topic>, <gz_frame_id> and ros_gz_bridge instead.`);
  return { robot, sensors, plugins, classic, warnings };
}

// gz topics a sensor publishes, with their gz message types
export function sensorTopics(sen, world, model) {
  const scoped = `/world/${world}/model/${model}/link/${sen.link}/sensor/${sen.name}`;
  const base = sen.topic ? (sen.topic.startsWith("/") ? sen.topic : "/" + sen.topic) : null;
  const t = (suffixDefault, suffixWithTopic = "") => (base ? base + suffixWithTopic : `${scoped}/${suffixDefault}`);
  switch (sen.type) {
    case "gpu_lidar": case "gpu_ray": return [[t("scan"), "gz.msgs.LaserScan", "scan"], [t("scan/points", "/points"), "gz.msgs.PointCloudPacked", "points"]];
    case "camera": return [[t("image"), "gz.msgs.Image", "image"], [base ? base.replace(/\/[^/]*$/, "") + "/camera_info" : `${scoped}/camera_info`, "gz.msgs.CameraInfo", "info"]];
    case "depth_camera": case "depth": return [[t("depth_image"), "gz.msgs.Image", "depth"], [t("depth_image/points", "/points"), "gz.msgs.PointCloudPacked", "points"], [base ? base.replace(/\/[^/]*$/, "") + "/camera_info" : `${scoped}/camera_info`, "gz.msgs.CameraInfo", "info"]];
    case "rgbd_camera": case "rgbd": return [[t("image", "/image"), "gz.msgs.Image", "image"], [t("depth_image", "/depth_image"), "gz.msgs.Image", "depth"], [t("points", "/points"), "gz.msgs.PointCloudPacked", "points"], [t("camera_info", "/camera_info"), "gz.msgs.CameraInfo", "info"]];
    case "imu": return [[t("imu"), "gz.msgs.IMU", "imu"]];
    default: return [];
  }
}
export const sensorFrame = (sen, model) => sen.frame || `${model}/${sen.link}/${sen.name}`;

// ---------------- worlds ----------------
const GROUND = { name: "ground_plane", static: true, pose: [0, 0, 0, 0, 0, 0], shapes: [{ type: "plane", size: [100, 100], color: [0.8, 0.8, 0.8, 1] }] };
export const BUILTIN_WORLDS = {
  // gz-sim's own examples (they do NOT load the Sensors / Imu systems: sensors there stay silent)
  "empty.sdf": () => ({ name: "empty", plugins: ["gz-sim-physics-system", "gz-sim-user-commands-system", "gz-sim-scene-broadcaster-system", "gz-sim-contact-system"], models: [GROUND] }),
  "shapes.sdf": () => ({ name: "shapes", plugins: ["gz-sim-physics-system", "gz-sim-user-commands-system", "gz-sim-scene-broadcaster-system"],
    models: [GROUND, { name: "box", pose: [0, 0, 0.5, 0, 0, 0], shapes: [{ type: "box", size: [1, 1, 1], color: [1, 0, 0, 1] }] }, { name: "cylinder", pose: [0, -1.5, 0.5, 0, 0, 0], shapes: [{ type: "cylinder", radius: 0.5, length: 1, color: [0, 1, 0, 1] }] },
      { name: "sphere", pose: [0, 1.5, 0.5, 0, 0, 0], shapes: [{ type: "sphere", radius: 0.5, color: [0, 0, 1, 1] }] }] }),
};
const colorOf = (mat) => { const d = tag(mat || "", "diffuse") || tag(mat || "", "ambient"); return d ? d.split(/\s+/).map(Number).concat([1, 1, 1, 1]).slice(0, 4) : [0.7, 0.7, 0.7, 1]; };
function geometryOf(g) {
  if (!g) return null;
  let m;
  if ((m = tag(g, "box"))) return { type: "box", size: (tag(m, "size") || "1 1 1").split(/\s+/).map(Number) };
  if ((m = tag(g, "cylinder"))) return { type: "cylinder", radius: num(m, "radius", 0.5), length: num(m, "length", 1) };
  if ((m = tag(g, "sphere"))) return { type: "sphere", radius: num(m, "radius", 0.5) };
  if ((m = tag(g, "plane"))) return { type: "plane", size: (tag(m, "size") || "100 100").split(/\s+/).map(Number) };
  if ((m = tag(g, "capsule"))) return { type: "cylinder", radius: num(m, "radius", 0.2), length: num(m, "length", 1) };
  if ((m = tag(g, "mesh"))) return { type: "mesh", uri: tag(m, "uri") };
  return null;
}
// the <pose> that belongs to this element itself, not one of a nested link / visual / collision / sensor
const ownPose = (body, nested) => { let b = String(body); for (const n of nested) b = b.replace(new RegExp(`<${n}\\b[\\s\\S]*?</${n}>`, "g"), ""); return (tag(b, "pose") || "0 0 0 0 0 0").split(/\s+/).map(Number).concat([0, 0, 0, 0, 0, 0]).slice(0, 6); };
export function parseWorld(sdfText) {
  const text = String(sdfText || "").replace(/<!--[\s\S]*?-->/g, "");
  const w = blocks(text, "world")[0];
  if (!w) return { error: "Unable to find a <world> element" };
  const plugins = blocks(w.body, "plugin").map((p) => p.a.filename || "").filter(Boolean);
  const models = [];
  for (const inc of blocks(w.body, "include")) {
    const uri = tag(inc.body, "uri") || "";
    if (/ground[_ ]?plane/i.test(uri)) models.push({ ...GROUND });
    else if (/sun/i.test(uri)) continue;
    else models.push({ name: tag(inc.body, "name") || uri, missing: uri, shapes: [] });
  }
  for (const m of blocks(w.body, "model")) {
    const pose = ownPose(m.body, ["link", "joint", "plugin"]);
    const shapes = [];
    for (const l of blocks(m.body, "link")) {
      const lp = ownPose(l.body, ["visual", "collision", "sensor", "inertial"]);
      const vis = blocks(l.body, "visual"), cols = blocks(l.body, "collision");
      for (const v of vis.length ? vis : cols) {
        const g = geometryOf(tag(v.body, "geometry")); if (!g) continue;
        const vp = (tag(v.body, "pose") || "0 0 0 0 0 0").split(/\s+/).map(Number).concat([0, 0, 0, 0, 0, 0]).slice(0, 6);
        shapes.push({ ...g, linkPose: lp, pose: vp, color: colorOf(tag(v.body, "material")) });
      }
    }
    models.push({ name: m.a.name || "model", static: /<static>\s*(true|1)\s*</.test(m.body), pose, shapes });
  }
  return { name: w.a.name || "default", plugins, models };
}
export const worldHas = (world, sys) => world.plugins.some((p) => p.includes(sys));

// ---------------- ros_gz_bridge ----------------
const DIR = { "@": "BIDIRECTIONAL", "[": "GZ_TO_ROS", "]": "ROS_TO_GZ" };
export function parseBridgeArg(arg) {   // /scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan   (or  ros_topic@ros_type@gz_type)
  const m = String(arg).match(/^([^@\s]+)@([\w/]+)([@[\]])([\w.]+)$/);
  if (!m) return null;
  return { ros: m[1].startsWith("/") ? m[1] : "/" + m[1], gz: m[1].startsWith("/") ? m[1] : "/" + m[1], rosType: m[2], gzType: m[4], dir: DIR[m[3]] };
}
export function parseBridgeYaml(text) {
  const out = []; let cur = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "");
    if (!line.trim()) continue;
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item) { cur = {}; out.push(cur); if (!item[1].trim()) continue; }
    const kv = (item ? item[1] : line).match(/^\s*([\w]+)\s*:\s*(["']?)(.*?)\2\s*$/);
    if (kv && cur) cur[kv[1]] = kv[3];
  }
  return out.map((e) => ({ ros: "/" + String(e.ros_topic_name || e.topic_name || "").replace(/^\//, ""), gz: "/" + String(e.gz_topic_name || e.topic_name || "").replace(/^\//, ""),
    rosType: e.ros_type_name || "", gzType: e.gz_type_name || "", dir: (e.direction || "BIDIRECTIONAL").toUpperCase(), lazy: e.lazy === "true" })).filter((e) => e.ros !== "/" && e.rosType && e.gzType);
}
// ROS <-> gz message types ros_gz_bridge knows (the ones a robot simulation needs)
export const BRIDGE_TYPES = {
  "sensor_msgs/msg/LaserScan": "gz.msgs.LaserScan", "sensor_msgs/msg/PointCloud2": "gz.msgs.PointCloudPacked", "sensor_msgs/msg/Image": "gz.msgs.Image", "sensor_msgs/msg/CameraInfo": "gz.msgs.CameraInfo",
  "sensor_msgs/msg/Imu": "gz.msgs.IMU", "rosgraph_msgs/msg/Clock": "gz.msgs.Clock", "geometry_msgs/msg/Twist": "gz.msgs.Twist", "nav_msgs/msg/Odometry": "gz.msgs.Odometry",
  "tf2_msgs/msg/TFMessage": "gz.msgs.Pose_V", "sensor_msgs/msg/JointState": "gz.msgs.Model", "std_msgs/msg/Float64": "gz.msgs.Double",
};
