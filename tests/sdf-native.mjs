// Native SDFormat loading (gz-sdformat.js) against libsdformat 14 / gz-sim 8 behaviour, with the real robot files.
// Run: node tests/sdf-native.mjs
import assert from "node:assert/strict";
import { gzWorldFromSdf, gzModelFromSdf, gzLoadWorld, normPluginFile } from "../public/js/gz-sdformat.js";
import { makeResolver, ENV } from "./gz-resolver.mjs";
const resolve = await makeResolver();
const env = ENV({ GZ_SIM_RESOURCE_PATH: ":/home/student/ros2_ws/install/share/turtlebot3_gazebo/models" });
let n = 0; const ok = async (name, f) => { await f(); n++; console.log("ok", name); };
const W = (body, v = "1.9") => `<?xml version="1.0"?><sdf version="${v}"><world name="w">${body}</world></sdf>`;
const box = (n, extra = "") => `<link name="${n}">${extra}<collision name="c"><geometry><box><size>1 1 1</size></box></geometry></collision><visual name="v"><geometry><box><size>1 1 1</size></box></geometry></visual></link>`;

await ok("missing model URI: Error Code 14, gz refuses the world", () => {
  const r = gzWorldFromSdf(W(`<include><uri>model://nope</uri></include>`), { resolve, env, path: "/tmp/w.sdf" });
  assert.equal(r.errors[0], `Error Code 14: [/sdf/world[@name="w"]/include[1]/uri:/tmp/w.sdf:L1]: Msg: Unable to find uri[model://nope]`);
  assert.match(r.lines[0], /^\[Err\] \[Server.cc:93\] Error Code 14/);
});
await ok("Fuel: Ground Plane / Sun / Table bundled, other Fuel models are not", () => {
  const r = gzWorldFromSdf(W(`<include><uri>https://fuel.gazebosim.org/1.0/OpenRobotics/models/Ground Plane</uri></include><include><uri>https://fuel.gazebosim.org/1.0/OpenRobotics/models/Sun</uri></include><include><uri>https://fuel.gazebosim.org/1.0/OpenRobotics/models/Table</uri><name>table</name><pose>0 -0.84 0 0 0 0</pose></include>`), { resolve, env });
  assert.deepEqual(r.errors, []); assert.deepEqual(r.world.models.map((m) => m.name), ["ground_plane", "table"]); assert.equal(r.world.lights[0].name, "sun");
  assert.deepEqual(r.world.models[1].pose.slice(0, 3), [0, -0.84, 0]);
  assert.match(gzWorldFromSdf(W(`<include><uri>https://fuel.gazebosim.org/1.0/OpenRobotics/models/Pine Tree</uri></include>`), { resolve, env }).errors[0], /Unable to find uri\[https:\/\/fuel/);
});
await ok("a world without plugins gets the server.config defaults (xarm table_gz.world); <gravity> in <physics> is copied with a warning", () => {
  const p = "/home/student/ros2_ws/install/share/xarm_gazebo/worlds/table_gz.world";
  const r = gzWorldFromSdf(resolve(p).text, { resolve, env, path: p });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.world.plugins, ["gz-sim-physics-system", "gz-sim-user-commands-system", "gz-sim-scene-broadcaster-system"]);
  assert.ok(r.warnings.some((w) => /XML Element\[gravity\], child of element\[physics\], not defined in SDF/.test(w)));
  assert.deepEqual(r.world.gravity, [0, 0, -9.8]);   // the world's gravity stays the default
});
await ok("model.config picks the highest SDF version; nested include in a static model (turtlebot3_world)", () => {
  const p = "/home/student/ros2_ws/install/share/turtlebot3_gazebo/worlds/turtlebot3_world.world";
  const r = gzWorldFromSdf(resolve(p).text, { resolve, env, path: p });
  const m = r.world.models.find((x) => x.name === "turtlebot3_world");
  assert.equal(m.static, true); assert.equal(m.colShapes.length, 15); assert.equal(m.colShapes.filter((s) => s.type === "mesh").length, 6);
  assert.match(m.colShapes.find((s) => s.type === "mesh").path, /turtlebot3_gazebo\/models\/turtlebot3_world\/meshes\/(hexagon|wall)\.dae$/);
});
await ok("house world: 34 links, meshes decimated, loads", async () => {
  const p = "/home/student/ros2_ws/install/share/turtlebot3_gazebo/worlds/turtlebot3_house.world";
  const r = await gzLoadWorld(resolve(p).text, { resolve: async (x) => resolve(x), env, path: p });
  assert.deepEqual(r.errors, []);
  const h = r.world.models.find((x) => x.name === "turtlebot3_house");
  assert.ok(h.colShapes.length > 50 && h.colShapes.filter((s) => s.mesh).every((s) => s.mesh.tris <= 3000));
});
await ok("frames: pose relative_to, <frame attached_to>, joint pose in the child frame, axis expressed_in", () => {
  const sdf = `<sdf version="1.9"><model name="m"><frame name="F"><pose>1 0 0 0 0 1.5707963</pose></frame>
    ${box("a")}<link name="b"><pose relative_to="F">0 1 0 0 0 0</pose><inertial><mass>1</mass></inertial></link>
    <joint name="j" type="revolute"><parent>a</parent><child>b</child><pose>0 0 0.5 0 0 0</pose><axis><xyz expressed_in="__model__">1 0 0</xyz><limit><lower>-1</lower><upper>1</upper></limit></axis></joint>
    <plugin filename="libgz-sim-joint-state-publisher-system.so" name="gz::sim::systems::JointStatePublisher"/></model></sdf>`;
  const r = gzModelFromSdf(sdf, {});
  assert.deepEqual(r.errors, []);
  const j = r.model.joints.j;
  // b is at F*(0 1 0) = (0, 0, 0) rotated...: F at x=1 yaw 90deg, so b = (1-1, 0, 0) = (0,0,0) with yaw 90; joint frame z+0.5 in b
  assert.ok(Math.abs(j.origin.xyz[0]) < 1e-6 && Math.abs(j.origin.xyz[2] - 0.5) < 1e-6 && Math.abs(j.origin.rpy[2] - Math.PI / 2) < 1e-6, JSON.stringify(j.origin));
  // model x axis expressed in the joint frame (yaw 90): (0, -1, 0)
  assert.ok(Math.abs(j.axis[1] + 1) < 1e-6, JSON.stringify(j.axis));
  assert.equal(r.gazebo.plugins[0].kind, "joint_states");
});
await ok("joint child / parent not found, duplicate link, model without link (sdformat texts)", () => {
  const r = gzModelFromSdf(`<sdf version="1.9"><model name="m">${box("a")}${box("a")}<joint name="j" type="fixed"><parent>a</parent><child>zz</child></joint></model></sdf>`, {});
  assert.ok(r.errors.some((e) => /^Error Code 2: .*Msg: link with name\[a\] already exists\.$/.test(e)), r.errors.join("\n"));
  assert.ok(r.errors.some((e) => /Error Code 20: .*Child frame with name\[zz\] specified by joint with name\[j\] not found in model with name\[m\]\./.test(e)));
  assert.ok(gzModelFromSdf(`<sdf version="1.9"><model name="e"></model></sdf>`, {}).errors.some((e) => e === "Error Code 17: Msg: A model must have at least one link."));
  assert.match(gzModelFromSdf(`<sdf version="1.9"><model name="e"><link name="a"></model></sdf>`, {}).errors[0], /^Error Code 1: Msg: Error parsing XML from string/);
  assert.match(gzModelFromSdf(`<sdf version="1.9"><light name="l" type="point"/></sdf>`, {}).lines[0], /Expected exactly one top-level <model>, <light> or <actor> on SDF/);
});
await ok("plugins: filenames and deprecated ignition names; unknown plugin cannot be loaded", () => {
  assert.equal(normPluginFile("libignition-gazebo-diff-drive-system.so"), "gz-sim-diff-drive-system");
  assert.equal(normPluginFile("gz-sim8-imu-system"), "gz-sim-imu-system");
  const r = gzWorldFromSdf(W(`<plugin filename="ignition-gazebo-sensors-system" name="ignition::gazebo::systems::Sensors"/><plugin filename="libgazebo_ros_init.so" name="x"/>`), {});
  assert.ok(r.lines.includes("[Wrn] [SystemLoader.cc:75] Trying to load deprecated plugin [ignition-gazebo-sensors-system]. Using [gz-sim-sensors-system] instead."));
  assert.ok(r.lines.includes("[Err] [SystemLoader.cc:92] Failed to load system plugin [libgazebo_ros_init.so] : Could not find shared library."));
});
await ok("TurtleBot3 burger model.sdf: DiffDrive defaults vs given, wheels continuous, lidar from SDF", () => {
  const p = "/home/student/ros2_ws/install/share/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf";
  const r = gzModelFromSdf(resolve(p).text, { resolve, env, path: p });
  const dd = r.gazebo.plugins.find((x) => x.kind === "diff_drive");
  assert.deepEqual([dd.separation, dd.radius, dd.topic, dd.odomTopic, dd.tfTopic, dd.frame, dd.child, dd.odomRate, dd.maxLinAcc], [0.16, 0.033, "cmd_vel", "odom", "/tf", "odom", "base_footprint", 50, 1]);   // <odom_publisher_frequency> is not DiffDrive's parameter: 50 Hz default
  assert.equal(r.model.joints.wheel_left_joint.type, "continuous");
  const l = r.gazebo.sensors.find((s) => s.type === "gpu_lidar").lidar;
  assert.deepEqual([l.hSamples, l.hMin, l.hMax, l.min, l.max, l.noise], [360, 0, 6.28, 0.12, 3.5, 0.01]);
  assert.ok(r.warnings.some((w) => /XML Element\[gz_frame_id\], child of element\[sensor\]/.test(w)));
});
await ok("a robot declared inside the world file is simulated (joints + plugin)", () => {
  const r = gzWorldFromSdf(W(`<model name="bot"><pose>1 2 0 0 0 0</pose>${box("base", "<inertial><mass>2</mass></inertial>")}${box("wheel", "<inertial><mass>0.1</mass></inertial>")}<joint name="wj" type="continuous"><parent>base</parent><child>wheel</child></joint><plugin filename="gz-sim-diff-drive-system" name="gz::sim::systems::DiffDrive"><left_joint>wj</left_joint><right_joint>wj</right_joint></plugin></model>`), {});
  assert.equal(r.world.robots.length, 1); assert.deepEqual(r.world.robots[0].pose.slice(0, 2), [1, 2]);
  const dd = r.world.robots[0].gazebo.plugins[0];
  assert.deepEqual([dd.separation, dd.radius], [1.0, 0.2]);   // gz-sim 8 DiffDrive defaults
});
console.log(`${n} passed`);
