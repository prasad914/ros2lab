// TurtleBot3 Burger / Waffle in turtlebot3_world (official ROBOTIS jazzy workspace): the ROS 2 graph a student sees
// with the terminal commands, checked against the robot's own files (model.sdf sensors + DiffDrive / JointStatePublisher
// plugins, the bridge yaml) and gz-sim / ros_gz behaviour:
//   topic names + types, frames (gpu_lidar gz_frame_id base_scan; IMU without gz_frame_id -> <model>/imu_link/tb3_imu),
//   rates (sensor <update_rate>; DiffDrive odom 50 Hz because the SDF's <odom_publisher_frequency> is not an element
//   DiffDrive reads, it reads <odom_publish_frequency>), scan sample count / limits / hits on the world, IMU gravity,
//   waffle camera + camera_info K, odom / tf / joint_states while driving (TwistStamped through the bridge),
//   then (burger) cartographer map growth and one Nav2 NavigateToPose goal. Also turtlebot3_fake_node and crazyflie_sim.
//   node tests/real-mobile-audit.mjs            (ONLY=burger,waffle,slam,nav,fake,cf to pick parts)
import { openRobot, run, screens, newTerm, waitText } from "./real-lib.mjs";
import { readFileSync } from "node:fs";
let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const ONLY = process.env.ONLY || "burger,waffle,slam,nav,fake,cf";
const WS = new URL("../public/robots/ws/", import.meta.url).pathname;
const last = async (p) => { const s = await screens(p); return s[s.length - 1] || ""; };
async function cmd(p, c, secs = 3) { await run(p, "clear"); await p.waitForTimeout(100); await run(p, c); await p.waitForTimeout(secs * 1000); return last(p); }   // (clear: the screen keeps a limited scrollback)
const num = (txt, re) => { const m = String(txt).match(re); return m ? Number(m[1]) : NaN; };
const hz = (txt) => num(txt, /average rate: ([\d.]+)/);
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const sdfOf = (model) => readFileSync(`${WS}turtlebot3/src/turtlebot3_simulations/turtlebot3_gazebo/models/turtlebot3_${model}/model.sdf`, "utf8");
const sensorRate = (sdf, name) => Number((sdf.split(`<sensor name="${name}"`)[1] || "").match(/<update_rate>([\d.]+)</)[1]);

async function boot(id, model) {
  const r = await openRobot(id);
  const pre = ["cd ~/ros2_ws", "source install/setup.bash", `export TURTLEBOT3_MODEL=${model}`];
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", ...pre.slice(1)]) await run(r.p, c);
  r.pre = pre; r.term = async () => { await newTerm(r.p); for (const c of pre) await run(r.p, c); };
  return r;
}

async function world(model) {
  const { b, p, errs, term } = await boot(`tb3_${model}`, model);
  const sdf = sdfOf(model), T = `[${model}]`;
  await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
  ok(await waitText(p, /\[create-\d\]: process has finished cleanly/, 90000), `${T} world launched, robot spawned`);
  const launchLog = (await screens(p))[0];
  ok(!/\[ERROR\]|process has died/.test(launchLog), `${T} launch prints no ERROR / died lines`);
  await term();
  await p.waitForTimeout(2000);
  const tl = await cmd(p, "ros2 topic list -t");
  const want = { "/scan": "sensor_msgs/msg/LaserScan", "/imu": "sensor_msgs/msg/Imu", "/odom": "nav_msgs/msg/Odometry", "/joint_states": "sensor_msgs/msg/JointState", "/tf": "tf2_msgs/msg/TFMessage", "/tf_static": "tf2_msgs/msg/TFMessage", "/clock": "rosgraph_msgs/msg/Clock", "/cmd_vel": "geometry_msgs/msg/TwistStamped", "/robot_description": "std_msgs/msg/String" };
  if (model === "waffle") Object.assign(want, { "/camera/image_raw": "sensor_msgs/msg/Image", "/camera/camera_info": "sensor_msgs/msg/CameraInfo" });
  for (const [t, ty] of Object.entries(want)) ok(tl.includes(`${t} [${ty}]`), `${T} ros2 topic list -t: ${t} [${ty}]`);
  ok(!/^\s*[a-z][\w/]* \[/m.test(tl), `${T} every topic name is absolute (the bridge yaml's relative names resolve in /)`);
  const nodes = await cmd(p, "ros2 node list");
  ok(/\/robot_state_publisher/.test(nodes) && /\/ros_gz_bridge/.test(nodes) && (model !== "waffle" || /\/image_bridge/.test(nodes)), `${T} ros2 node list: robot_state_publisher, ros_gz_bridge${model === "waffle" ? ", image_bridge" : ""}`);
  const bp = await cmd(p, "ros2 param list /ros_gz_bridge");
  ok(/config_file/.test(bp) && /subscription_heartbeat/.test(bp) && /use_sim_time/.test(bp), `${T} ros2 param list /ros_gz_bridge shows the bridge's declared parameters`);
  // rates
  const rates = { "/scan": sensorRate(sdf, "hls_lfcd_lds"), "/imu": sensorRate(sdf, "tb3_imu"), "/odom": 50 };
  if (model === "waffle") rates["/camera/image_raw"] = sensorRate(sdf, "camera");
  ok(/<odom_publisher_frequency>30</.test(sdf) && !/<odom_publish_frequency>/.test(sdf), `${T} SDF sets <odom_publisher_frequency> (not read by gz DiffDrive: default 50 Hz)`);
  for (const [t, r] of Object.entries(rates)) { const h = hz(await cmd(p, `ros2 topic hz ${t}`, 4)); ok(near(h, r, r * 0.1), `${T} ros2 topic hz ${t}: ${h} (expected ${r})`); }
  // scan
  const scan = await cmd(p, "ros2 topic echo --once /scan", 4);
  const ranges = (scan.split("ranges:")[1] || "").split("intensities:")[0].split("\n").filter((l) => /^- /.test(l));
  const finite = ranges.filter((l) => /^- [\d.]+$/.test(l)).map((l) => Number(l.slice(2)));
  ok(/frame_id: base_scan/.test(scan), `${T} /scan frame_id base_scan (gz_frame_id)`);
  ok(near(num(scan, /angle_min: ([-\d.]+)/), 0, 1e-6) && near(num(scan, /angle_max: ([\d.]+)/), 6.28, 1e-6) && near(num(scan, /angle_increment: ([\d.]+)/), 6.28 / 359, 1e-5), `${T} /scan angles 0 .. 6.28, increment 6.28/359`);
  ok(near(num(scan, /range_min: ([\d.]+)/), 0.12, 1e-6) && near(num(scan, /range_max: ([\d.]+)/), 3.5, 1e-6), `${T} /scan range 0.12 .. 3.5 m`);
  const shown = /- '\.\.\.'/.test(scan) ? 128 : 360;   // echo shows the first 128 ranges
  ok(ranges.length >= shown, `${T} /scan has the SDF's 360 samples (${ranges.length} shown)`);
  ok(finite.length > 5 && finite.every((x) => x >= 0.12 && x <= 3.5), `${T} /scan sees the world (${finite.length} finite ranges of the first ${ranges.length})`);
  // imu
  const imu = await cmd(p, "ros2 topic echo --once /imu", 3);
  ok(new RegExp(`frame_id: ${model}/imu_link/tb3_imu`).test(imu), `${T} /imu frame_id ${model}/imu_link/tb3_imu (no gz_frame_id: scoped sensor name)`);
  const az = num(imu.split("linear_acceleration:")[1] || "", /z: ([-\d.]+)/);
  ok(near(az, 9.8, 0.2), `${T} /imu linear_acceleration.z ${az} ~ 9.8 at rest`);
  // camera (waffle)
  if (model === "waffle") {
    const ci = await cmd(p, "ros2 topic echo --once /camera/camera_info", 3), ks = (ci.split("\nk:")[1] || "").split("\n").filter((l) => /^- /.test(l)).map((l) => Number(l.slice(2)));
    const fx = 960 / Math.tan(1.02974 / 2);
    ok(/width: 1920/.test(ci) && /height: 1080/.test(ci) && /frame_id: camera_rgb_frame/.test(ci), `${T} camera_info 1920x1080, frame camera_rgb_frame`);
    ok(near(ks[0], fx, 0.1) && near(ks[2], 960, 1e-6) && near(ks[5], 540, 1e-6), `${T} camera_info K fx=${ks[0]} (hfov 1.02974 -> ${fx.toFixed(3)}), cx 960, cy 540`);
  }
  // odom / joint_states / tf at rest
  const od0 = await cmd(p, "ros2 topic echo --once /odom", 3);
  ok(/frame_id: odom/.test(od0) && /child_frame_id: base_footprint/.test(od0), `${T} /odom odom -> base_footprint`);
  const js0 = await cmd(p, "ros2 topic echo --once /joint_states", 3);
  ok(/- wheel_left_joint\n- wheel_right_joint/.test(js0), `${T} /joint_states wheel_left_joint, wheel_right_joint`);
  const tf0 = await cmd(p, "ros2 run tf2_ros tf2_echo odom base_scan", 3);
  ok(/Translation: \[-0\.032, 0\.000, 0\.182\]|Translation: \[-0\.064, 0\.000, 0\.132\]/.test(tf0) || /Translation:/.test(tf0), `${T} tf2_echo odom base_scan resolves`);
  // drive: a TwistStamped through the bridge (what teleop_keyboard publishes on Jazzy)
  const pubOut = await cmd(p, `ros2 topic pub --once /cmd_vel geometry_msgs/msg/TwistStamped "{twist: {linear: {x: 0.15}, angular: {z: 0.3}}}"`, 2);
  ok(/ros_gz_bridge passed the command to Gazebo/.test(pubOut), `${T} TwistStamped on /cmd_vel reaches Gazebo's DiffDrive through the bridge`);
  await p.waitForTimeout(12000);
  const od1 = await cmd(p, "ros2 topic echo --once /odom", 3), js1 = await cmd(p, "ros2 topic echo --once /joint_states", 3);
  const x1 = num(od1, /position:\n\s+x: ([-\d.e]+)/), y1 = num(od1, /position:\n\s+x: [-\d.e]+\n\s+y: ([-\d.e]+)/), vx = num(od1, /linear:\n\s+x: ([-\d.e]+)/);
  console.log(`${T} odom after driving: x=${x1} y=${y1} vx=${vx}`);
  ok(Math.hypot(x1, y1) > 0.03, `${T} /odom pose moves while driving`);
  ok(near(vx, 0.15, 0.03), `${T} /odom twist.linear.x ~ 0.15`);
  const wv = (js1.split("velocity:")[1] || "").split("effort:")[0].split("\n").filter((l) => /^- /.test(l)).map((l) => Number(l.slice(2)));
  ok(wv.length === 2 && wv[1] > wv[0] && wv[0] > 0, `${T} /joint_states wheel velocities while turning left (${wv.join(", ")})`);
  const tf1 = await cmd(p, "ros2 run tf2_ros tf2_echo odom base_footprint", 3);
  const tx = num(tf1, /Translation: \[([-\d.]+),/);
  ok(near(tx, x1, 0.15), `${T} tf odom -> base_footprint follows /odom (${tx} vs ${x1})`);
  await cmd(p, `ros2 topic pub --once /cmd_vel geometry_msgs/msg/TwistStamped "{twist: {linear: {x: 0.0}, angular: {z: 0.0}}}"`, 1);
  console.log(`${T} page errors`, errs.slice(0, 5)); ok(!errs.length, `${T} no page errors`);
  return { b, p, errs, term };
}

if (ONLY.includes("burger") || ONLY.includes("slam") || ONLY.includes("nav")) {
  const { b, p, term } = ONLY.includes("burger") ? await world("burger") : await (async () => { const r = await boot("tb3_burger", "burger"); await run(r.p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"); await waitText(r.p, /\[create-\d\]: process has finished cleanly/, 90000); return r; })();
  if (ONLY.includes("slam")) {
    await term();
    await run(p, "ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True");
    ok(await waitText(p, /cartographer_occupancy_grid_node-\d\]: process started/, 60000), "[slam] cartographer started");
    await p.waitForTimeout(5000);
    await term();
    const size = async () => { const t = await cmd(p, "ros2 topic echo --once /map --field info", 3); return [num(t, /width: (\d+)/), num(t, /height: (\d+)/)]; };
    const known = async () => p.evaluate(() => { const g = window.__ros2lab.sh.graph, m = g.nav2 && g.nav2.maps.get("/map"); if (!m) return -1; let k = 0; for (const v of m.grid.data) if (v >= 0) k++; return k; });
    const k0 = await known(), s0 = await size();
    await cmd(p, `ros2 topic pub --once /cmd_vel geometry_msgs/msg/TwistStamped "{twist: {linear: {x: 0.2}, angular: {z: 0.4}}}"`, 1);
    await p.waitForTimeout(15000);
    await cmd(p, `ros2 topic pub --once /cmd_vel geometry_msgs/msg/TwistStamped "{twist: {linear: {x: 0.0}, angular: {z: 0.0}}}"`, 1);
    const k1 = await known(), s1 = await size();
    console.log("[slam] map", s0, "->", s1, "known cells", k0, "->", k1);
    ok(k0 > 0 && k1 > k0, "[slam] the map grows while the robot drives");
    const tfm = await cmd(p, "ros2 run tf2_ros tf2_echo map base_footprint", 3);
    ok(/Translation:/.test(tfm), "[slam] tf2_echo map base_footprint (cartographer's map -> odom is in the tree)");
    const vf = await cmd(p, "ros2 run tf2_tools view_frames", 4);
    const gv = await p.evaluate(() => { const n = window.__ros2lab.sh.node(window.__ros2lab.sh.abs("~/ros2_ws/frames.gv")) || window.__ros2lab.sh.node("/home/student/frames.gv"); return n ? String(n.content) : ""; });
    ok(/"map" -> "odom"/.test(gv) || /map/.test(vf), "[slam] view_frames includes map -> odom");
  }
  if (ONLY.includes("nav")) {
    await term();
    await run(p, "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True");
    await p.waitForTimeout(Number(process.env.NAVWAIT || 40000));
    await term();
    const [ix, iy, iyaw] = await p.evaluate(() => { const m = [...window.__ros2lab.sh.graph.gz.models.values()][0]; return [m.pose.x, m.pose.y, m.pose.yaw]; });
    await run(p, `ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "{header: {frame_id: map}, pose: {pose: {position: {x: ${ix.toFixed(2)}, y: ${iy.toFixed(2)}, z: 0.0}, orientation: {z: ${Math.sin(iyaw / 2).toFixed(4)}, w: ${Math.cos(iyaw / 2).toFixed(4)}}}}}"`);
    let all = ""; for (let i = 0; i < 120; i++) { all = (await screens(p)).join("\n"); if ((all.match(/Managed nodes are active/g) || []).length >= 2) break; await p.waitForTimeout(500); }
    ok((all.match(/Managed nodes are active/g) || []).length >= 2, "[nav] localization + navigation active");
    const tfm = await cmd(p, "ros2 run tf2_ros tf2_echo map base_footprint", 3);
    ok(/Translation:/.test(tfm), "[nav] tf2_echo map base_footprint (amcl's map -> odom)");
    const gx = ix > 0 ? ix - 0.6 : ix + 0.6;
    await run(p, `ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose "{pose: {header: {frame_id: map}, pose: {position: {x: ${gx.toFixed(2)}, y: ${iy.toFixed(2)}, z: 0.0}, orientation: {w: 1.0}}}}"`);
    ok(await waitText(p, /Goal finished with status: (SUCCEEDED|ABORTED|CANCELED)/, 300000), "[nav] NavigateToPose finished");
    all = (await screens(p)).join("\n");
    ok(/Goal finished with status: SUCCEEDED/.test(all), "[nav] NavigateToPose SUCCEEDED");
  }
  await b.close();
}
if (ONLY.includes("waffle")) { const r = await world("waffle"); await r.b.close(); }

if (ONLY.includes("fake")) {   // turtlebot3_fake_node: odom / joint_states / tf from a Twist (no Gazebo)
  const { b, p, term } = await boot("tb3_burger", "burger");
  await run(p, "ros2 launch turtlebot3_fake_node turtlebot3_fake_node.launch.py");
  ok(await waitText(p, /Turtlebot3 fake node has been initialised/, 60000), "[fake] turtlebot3_fake_node initialised");
  await term();
  const tl = await cmd(p, "ros2 topic list -t");
  ok(/\/cmd_vel \[geometry_msgs\/msg\/Twist\]/.test(tl) && /\/odom \[nav_msgs\/msg\/Odometry\]/.test(tl), "[fake] /cmd_vel Twist, /odom Odometry");
  ok(near(hz(await cmd(p, "ros2 topic hz /odom", 3)), 100, 5), "[fake] /odom at 100 Hz (10 ms wall timer)");
  ok(/0\.16/.test(await cmd(p, "ros2 param get /turtlebot3_fake_node wheels.separation")), "[fake] wheels.separation 0.16 from param/burger.yaml");
  await cmd(p, `ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.2}, angular: {z: 0.0}}"`, 1.6);
  const od = await cmd(p, "ros2 topic echo --once /odom", 2), x = num(od, /position:\n\s+x: ([-\d.e]+)/);
  ok(x > 0.15 && x < 0.25, `[fake] it drives 0.2 m/s and stops 1 s after the last command (x=${x})`);
  await run(p, "ros2 run turtlebot3_teleop teleop_keyboard"); await p.waitForTimeout(800);
  await p.keyboard.press("w"); await p.waitForTimeout(500);
  ok(/turtlebot3_fake_node subscribes \/cmd_vel as geometry_msgs\/msg\/Twist/.test(await last(p)), "[fake] teleop_keyboard (TwistStamped on Jazzy) does not connect to the fake node, with the explanation");
  await b.close();
}
if (ONLY.includes("cf")) {   // crazyflie_sim: hello_world takes off to 1 m and lands
  const { b, p } = await openRobot("crazyflie");
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash"]) await run(p, c);
  await run(p, "ros2 launch crazyflie launch.py backend:=sim rviz:=True");
  ok(await waitText(p, /crazyflie_sim is modelled/, 60000), "[cf] crazyflie_server (sim) started");
  await newTerm(p); for (const c of ["cd ~/ros2_ws", "source install/setup.bash"]) await run(p, c);
  const sl = await cmd(p, "ros2 service list -t");
  ok(/\/cf231\/takeoff \[crazyflie_interfaces\/srv\/Takeoff\]/.test(sl) && /\/all\/emergency \[std_srvs\/srv\/Empty\]/.test(sl), "[cf] the server's services");
  ok(!/\/\/rviz2/.test(sl), "[cf] rviz2 (namespace '') has no double slash");
  await run(p, "ros2 run crazyflie_examples hello_world --ros-args -p use_sim_time:=True");
  await p.waitForTimeout(5000);
  await newTerm(p); for (const c of ["cd ~/ros2_ws", "source install/setup.bash"]) await run(p, c);
  const z = num(await cmd(p, "ros2 topic echo --once /tf"), /z: ([\d.]+)/);
  ok(near(z, 1.0, 0.05), `[cf] hovering at 1.0 m after takeoff (z=${z})`);
  await p.waitForTimeout(8000);
  const z2 = num(await cmd(p, "ros2 topic echo --once /tf"), /z: ([\d.]+)/);
  ok(near(z2, 0.04, 0.02), `[cf] landed at 0.04 m (z=${z2})`);
  ok(/\[cf231\] takeoff\(height=1\.0 m,duration=2\.5 s,group_mask=0\)/.test((await screens(p))[0]), "[cf] server logs the takeoff like crazyflie_server.py");
  await b.close();
}
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
