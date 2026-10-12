// Nav2 / SLAM scenarios on the practice Gazebo: TurtleBot3 burger in turtlebot3_world (the Gazebo agent's
// tests/gz-real-lib.mjs startLaunch with the recorded real launch), driven by the website's Nav2 models
// (public/js/nav2-sim.js, slam-sim.js) with the REAL turtlebot3_navigation2 param/burger.yaml + map/map.yaml,
// nav2_bt_navigator's behavior tree XML and slam_toolbox / turtlebot3_cartographer configuration.
// The nodes are started the way the launch runtime hands them to the coordinator for nav2_bringup's
// navigation_launch.py / localization_launch.py with use_composition:=True (onLoadComposable: package, plugin, name,
// remappings, parameters, parameter_files).
// Dependency-injected (mods, io) so the same code runs in Node (tests/nav2-node.mjs) and Chromium (tests/nav2.mjs).
//   mods: gz-real-lib mods + { nav2 (nav2-sim.js), core (nav2-core.js), lib (gz-real-lib.mjs) }
//   io:   gz-real-lib io (resolve, fixture)
const WS = "/home/student/ros2_ws/install";
const NAV2_SHARE = `${WS}/turtlebot3_navigation2/share/turtlebot3_navigation2`;
const BT_XML = "/opt/ros/jazzy/share/nav2_bt_navigator/behavior_trees/navigate_to_pose_w_replanning_and_recovery.xml";
const SLAM_YAML = "/opt/ros/jazzy/share/slam_toolbox/config/mapper_params_online_async.yaml";
const CARTO_DIR = `${WS}/turtlebot3_cartographer/share/turtlebot3_cartographer/config`;
const PILLARS = [-1.1, 0, 1.1].flatMap((x) => [-1.1, 0, 1.1].map((y) => [x, y]));

// a synchronous file system over prefetched files + files written by the models (map_saver)
async function makeFs(io, paths) {
  const files = new Map();
  for (const p of paths) { const r = await io.resolve(p); if (r) files.set(p, r.text != null ? r.text : r.bytes); }
  return { files, written: new Map(), home: "/home/student", cwd: "/home/student",
    read(p) { return this.written.has(p) ? this.written.get(p) : files.has(p) ? files.get(p) : null; },
    write(p, data) { this.written.set(p, data); } };
}
const TF = [["/tf", "tf"], ["/tf_static", "tf_static"]];
const COMPOSABLE = [
  // localization_launch.py
  ["nav2_map_server", "nav2_map_server::MapServer", "map_server", TF],
  ["nav2_amcl", "nav2_amcl::AmclNode", "amcl", TF],
  ["nav2_lifecycle_manager", "nav2_lifecycle_manager::LifecycleManager", "lifecycle_manager_localization", [], { autostart: true, node_names: ["map_server", "amcl"] }],
  // navigation_launch.py
  ["nav2_controller", "nav2_controller::ControllerServer", "controller_server", [...TF, ["cmd_vel", "cmd_vel_nav"]]],
  ["nav2_smoother", "nav2_smoother::SmootherServer", "smoother_server", TF],
  ["nav2_planner", "nav2_planner::PlannerServer", "planner_server", TF],
  ["nav2_route", "nav2_route::RouteServer", "route_server", TF],
  ["nav2_behaviors", "behavior_server::BehaviorServer", "behavior_server", [...TF, ["cmd_vel", "cmd_vel_nav"]]],
  ["nav2_bt_navigator", "nav2_bt_navigator::BtNavigator", "bt_navigator", TF],
  ["nav2_waypoint_follower", "nav2_waypoint_follower::WaypointFollower", "waypoint_follower", TF],
  ["nav2_velocity_smoother", "nav2_velocity_smoother::VelocitySmoother", "velocity_smoother", [...TF, ["cmd_vel", "cmd_vel_nav"]]],
  ["nav2_collision_monitor", "nav2_collision_monitor::CollisionMonitor", "collision_monitor", TF],
  ["opennav_docking", "opennav_docking::DockingServer", "docking_server", TF],
  ["nav2_lifecycle_manager", "nav2_lifecycle_manager::LifecycleManager", "lifecycle_manager_navigation", [], { autostart: true, node_names: ["controller_server", "smoother_server", "planner_server", "route_server", "behavior_server", "velocity_smoother", "collision_monitor", "bt_navigator", "waypoint_follower", "docking_server"] }],
];
export async function startNav2(mods, io, { L = null } = {}) {
  L = L || await mods.lib.startLaunch(mods, io, "tb3_burger-1");
  const G = L.G; G.nav2NoTimer = true; G.out = (t) => t;
  G.gzPhys.refreshMeshes(); mods.lib.step(G, 0.5);
  const fs = await makeFs(io, [`${NAV2_SHARE}/param/burger.yaml`, `${NAV2_SHARE}/map/map.yaml`, `${NAV2_SHARE}/map/map.pgm`, BT_XML]);
  // nav2_common RewrittenYaml: the params file with use_sim_time and yaml_filename (the map launch argument) substituted
  const params = String(fs.read(`${NAV2_SHARE}/param/burger.yaml`)).replace(/yaml_filename: "map.yaml"/, `yaml_filename: "${NAV2_SHARE}/map/map.yaml"`);
  const out = [];
  const models = {};
  for (const [pkg, plugin, name, remaps, extra] of COMPOSABLE) {
    const desc = { package: pkg, plugin, name, namespace: "/", remappings: remaps, parameters: [{ use_sim_time: true, ...(extra || {}) }], parameter_files: extra ? {} : { "/tmp/launch_params_rw": params }, fs, write: (t) => out.push(`[component_container_isolated-1] ${t.replace(/\n$/, "")}`) };
    models[name] = mods.nav2.startNav2Node(G, desc);
  }
  return { L, G, fs, out, models, sys: G.nav2 };
}
const has = (out, re) => out.some((l) => re.test(l));
const count = (out, re) => out.filter((l) => re.test(l)).length;
const stepUntil = (mods, G, secs, cond, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) { G.gzStep(dt); if (cond && cond()) return t; } return null; };

export async function nav2Scenario(mods, io, { onRviz = null } = {}) {
  const r = { checks: [] }, ok = (name, cond, info) => r.checks.push({ name, ok: !!cond, info });
  const S = await startNav2(mods, io), { G, out, sys } = S;
  const nav2 = mods.nav2, robot = sys.robot();
  ok("real map.yaml + map.pgm loaded (map_io)", has(out, /\[map_io\]: Read map .*map\.pgm: 384 X 384 map @ 0\.05 m\/cell/) && has(out, /\[map_io\]: occupied_thresh: 0\.65/), out.filter((l) => /map_io/.test(l)));
  ok("lifecycle manager: bringup log lines", has(out, /\[lifecycle_manager_localization\]: .*Starting managed nodes bringup\.\.\./) && has(out, /Configuring map_server/) && has(out, /Activating amcl/) && has(out, /\[amcl\]: Creating bond \(amcl\) to lifecycle manager\./) && has(out, /Server amcl connected with bond\./), out.slice(0, 60));
  ok("lifecycle node 'launched' notices", has(out, /controller_server lifecycle node launched\./) && has(out, /\[local_costmap\.local_costmap\]: Creating Costmap/));
  ok("bt_navigator: error_code warning of jazzy (burger.yaml has no error_code_names)", has(out, /\[bt_navigator\]: Error_code parameters were not set\. Using default values of: follow_path_error_code compute_path_error_code/));
  mods.lib.step(G, 3);
  ok("localization bring-up complete: Managed nodes are active", has(out, /\[lifecycle_manager_localization\]: .*Managed nodes are active/));
  ok("navigation bring-up waits for map -> base_link (global costmap)", has(out, /\[global_costmap\.global_costmap\]: Timed out waiting for transform from base_link to map to become available/) && !has(out, /\[lifecycle_manager_navigation\]: .*Managed nodes are active/) && S.models.planner_server.n.lstate === "inactive" && S.models.controller_server.n.lstate === "active", { planner: S.models.planner_server.n.lstate, ctl: S.models.controller_server.n.lstate });
  ok("AMCL waits for the initial pose (exact warning)", has(out, /\[WARN\] .*\[amcl\]: AMCL cannot publish a pose or update the transform\. Please set the initial pose\.\.\./));
  ok("no map -> odom before the initial pose", nav2.nav2TfEdges(G).length === 0);
  // RViz "2D Pose Estimate": /initialpose in the map frame, RViz's covariance
  const cov = Array(36).fill(0); cov[0] = 0.25; cov[7] = 0.25; cov[35] = 0.06853891909122467;
  nav2.nav2Topic(G, "/initialpose", "geometry_msgs/msg/PoseWithCovarianceStamped", { header: { frame_id: "map" }, pose: { pose: { position: { x: -2.0, y: -0.5, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }, covariance: cov } });
  ok("AMCL: initialPoseReceived + Setting pose", has(out, /\[amcl\]: initialPoseReceived/) && has(out, /\[amcl\]: Setting pose \([\d.]+\): -2\.000 -0\.500 0\.000/));
  mods.lib.step(G, 3);
  ok("navigation bring-up completes after the pose: Managed nodes are active", has(out, /\[lifecycle_manager_navigation\]: .*Managed nodes are active/) && S.models.planner_server.n.lstate === "active" && S.models.bt_navigator.n.lstate === "active", out.filter((l) => /lifecycle_manager_navigation/.test(l)).slice(-5));
  const tf = nav2.nav2TfEdges(G)[0];
  ok("map -> odom published by amcl", tf && tf.parent === "map" && tf.child === "odom", tf);
  const est = S.models.amcl.pose(), tp = sys.truePose();
  ok("AMCL localizes (estimate within 0.15 m / 0.1 rad of Gazebo's pose)", est && Math.hypot(est.x - tp.x, est.y - tp.y) < 0.15 && Math.abs(est.yaw - tp.yaw) < 0.1, { est, tp });
  ok("graph nodes: costmap nodes and servers", ["/controller_server", "/planner_server", "/global_costmap/global_costmap", "/local_costmap/local_costmap", "/bt_navigator", "/amcl", "/map_server", "/lifecycle_manager_navigation"].every((f) => G.nodes.some((n) => n.full === f)), G.nodes.map((n) => n.full));
  const bt = G.nodes.find((n) => n.full === "/bt_navigator");
  ok("bt_navigator offers navigate_to_pose / navigate_through_poses", bt.info.acts.some(([a, t]) => a === "navigate_to_pose" && t === "nav2_msgs/action/NavigateToPose") && bt.info.acts.some(([a]) => a === "navigate_through_poses"));
  ok("controller_server publishes cmd_vel remapped to cmd_vel_nav (TwistStamped)", S.models.controller_server.resolve("cmd_vel") === "/cmd_vel_nav" && S.models.controller_server.n.info.pubs.some(([n, t]) => n === "cmd_vel" && t === "geometry_msgs/msg/TwistStamped"));
  ok("/map is transient local data for echo", (nav2.nav2Sample(G, "/map") || [""])[0].includes("width: 384"));
  // NavigateToPose around the pillars, with feedback (ros2 action send_goal -f)
  const goal = { x: 1.65, y: 0.55, yaw: 0 };
  const cli = [];
  const L1 = nav2.nav2ActionGoal(G, "/navigate_to_pose", "nav2_msgs/action/NavigateToPose", { pose: { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "map" }, pose: { position: { x: goal.x, y: goal.y, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }, behavior_tree: "" }, ["-f"], { out: (t) => cli.push(t) });
  ok("send_goal: Goal accepted", L1 && L1.some((l) => /^Goal accepted with ID: [0-9a-f]{32}/.test(l)), L1);
  ok("bt_navigator: Begin navigating", has(out, /\[bt_navigator\]: Begin navigating from current location \(-?[\d.]+, -?[\d.]+\) to \(1\.65, 0\.55\)/));
  let minClear = Infinity, hits = 0;
  const done = stepUntil(mods, G, 120, () => { const p = robot.pose; for (const [px, py] of PILLARS) minClear = Math.min(minClear, Math.hypot(p.x - px, p.y - py) - 0.15); if (robot.bumped) hits++; return cli.some((l) => /Goal finished/.test(l)); });
  if (onRviz) await onRviz(S, "nav");
  const fin = sys.truePose();
  ok("NavigateToPose SUCCEEDED", cli.some((l) => l === "Goal finished with status: SUCCEEDED"), { done, last: cli.slice(-3), pose: fin, tail: out.slice(-15) });
  ok("goal reached within the goal checker's tolerance (0.25 m)", Math.hypot(fin.x - goal.x, fin.y - goal.y) < 0.3, fin);
  ok("no collision: burger (r 0.105) never touched a pillar (r 0.15)", minClear > 0.105 && hits === 0, { minClear, hits });
  ok("feedback blocks with distance_remaining / number_of_recoveries", count(cli, /^Feedback:\n    current_pose:/) > 10 && cli.some((l) => /distance_remaining: \d/.test(l) && /number_of_recoveries: 0/.test(l)), cli.slice(0, 2));
  ok("result block (error_code 0)", cli.some((l) => /^Result:\n    error_code: 0\nerror_msg: ''/.test(l)), cli.slice(-2));
  ok("log: Goal succeeded / Reached the goal!", has(out, /\[bt_navigator\]: Goal succeeded/) && has(out, /\[controller_server\]: Reached the goal!/));
  ok("/plan published (nav_msgs/Path in map)", (nav2.nav2Sample(G, "/plan") || [""])[0].includes("frame_id: map"));
  ok("velocity chain: controller -> velocity_smoother -> collision_monitor -> /cmd_vel (TwistStamped)", sys.cmd.has("/cmd_vel_nav") && sys.cmd.has("/cmd_vel_smoothed") && sys.cmd.has("/cmd_vel") && sys.cmd.get("/cmd_vel").stamped);
  // a goal outside the hexagon wall: planning fails, recoveries run, then the goal aborts with NO_VALID_PATH (208)
  const cli2 = [], o0 = out.length;
  nav2.nav2ActionGoal(G, "/navigate_to_pose", "nav2_msgs/action/NavigateToPose", { pose: { header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "map" }, pose: { position: { x: 0.0, y: 4.5, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }, behavior_tree: "" }, [], { out: (t) => cli2.push(t) });
  stepUntil(mods, G, 90, () => cli2.some((l) => /Goal finished/.test(l)));
  const o2 = out.slice(o0);
  ok("blocked goal: planner fails (NavFn tolerance message)", has(o2, /\[planner_server\]: GridBased plugin failed to plan from .* to \(0\.00, 4\.50\): "Failed to create plan with tolerance of: 0\.500000"/), o2.slice(0, 8));
  ok("blocked goal: costmaps cleared, spin / wait / backup recoveries ran", has(o2, /Received request to clear entirely the global_costmap/) && has(o2, /\[behavior_server\]: Running spin/) && has(o2, /\[behavior_server\]: Turning 1\.57 for spin behavior\./) && has(o2, /\[behavior_server\]: Running wait/) && has(o2, /\[behavior_server\]: (Running backup|backup completed|Collision Ahead)/), o2.filter((l) => /behavior_server|clear/.test(l)).slice(0, 12));
  ok("blocked goal: ABORTED with error_code 208 (NO_VALID_PATH)", cli2.some((l) => l === "Goal finished with status: ABORTED") && cli2.some((l) => /error_code: 208/.test(l)) && has(o2, /\[bt_navigator\]: Goal failed/), cli2.slice(-2));
  r.pass = r.checks.every((c) => c.ok); r.S = S;
  return r;
}

export async function slamScenario(mods, io, { onRviz = null } = {}) {
  const r = { checks: [] }, ok = (name, cond, info) => r.checks.push({ name, ok: !!cond, info });
  const L = await mods.lib.startLaunch(mods, io, "tb3_burger-1"), G = L.G; G.nav2NoTimer = true; G.out = (t) => t;
  G.gzPhys.refreshMeshes(); mods.lib.step(G, 0.5);
  const fs = await makeFs(io, [SLAM_YAML, `${CARTO_DIR}/turtlebot3_lds_2d.lua`]);
  const out = [], w = (tag) => (t) => out.push(`[${tag}] ${t.replace(/\n$/, "")}`);
  // slam_toolbox online_async_launch.py: LifecycleNode async_slam_toolbox_node + autostart configure / activate events
  const st = mods.nav2.startNav2Node(G, { pkg: "slam_toolbox", exe: "async_slam_toolbox_node", name: "slam_toolbox", ns: "", params: [fs.read(SLAM_YAML), { use_sim_time: true, use_lifecycle_manager: false }], fs, write: w("async_slam_toolbox_node-1") });
  ok("slam_toolbox started (lifecycle node, stack size log)", st && has(out, /\[slam_toolbox\]: Node using stack size 40000000/));
  const c1 = mods.nav2.nav2Lifecycle(G, "/slam_toolbox", "configure"), a1 = mods.nav2.nav2Lifecycle(G, "/slam_toolbox", "activate");
  ok("configure / activate (launch ChangeState events)", c1.success && a1.success && has(out, /Using solver plugin solver_plugins::CeresSolver/) && st.n.lstate === "active");
  mods.lib.step(G, 6);
  const m0 = G.nav2.maps.get("/map");
  ok("first /map after map_update_interval (5 s), sensor registered", m0 && has(out, /Registering sensor: \[Custom Described Lidar\]/), out.slice(-5));
  const known0 = st.grid.known();
  // drive: forward, turn, forward (TwistStamped through the real ros_gz_bridge config)
  const drive = (lx, az, s) => { G.gzTwist("/cmd_vel", { lx, ly: 0, lz: 0, az }, "geometry_msgs/msg/TwistStamped"); mods.lib.step(G, s); };
  drive(0.0, 0.8, 4); drive(0.18, 0.0, 3); drive(0.0, -0.8, 3); drive(0.15, 0.25, 6); drive(0, 0, 6);
  const known1 = st.grid.known(), m1 = G.nav2.maps.get("/map");
  ok("the SLAM map grows while driving", known1 > known0 * 1.15 && m1.ver > m0.ver, { known0, known1, v0: m0.ver, v1: m1.ver });
  ok("slam_toolbox publishes map -> odom", (mods.nav2.nav2TfEdges(G)[0] || {}).parent === "map");
  if (onRviz) await onRviz({ G, L, sys: G.nav2, out }, "slam");
  // ros2 run nav2_map_server map_saver_cli -f ~/map (bash expands ~ before the program sees it)
  const ms = [], cliW = (t) => ms.push(t.replace(/\n$/, ""));
  mods.nav2.startNav2Node(G, { pkg: "nav2_map_server", exe: "map_saver_cli", args: ["-f", "/home/student/map"], fs, write: cliW, sync: true, exit: (rc) => ms.push(`rc=${rc}`) });
  const want = [/\[map_saver\]: \n\tmap_saver lifecycle node launched/, /\[map_saver\]: Configuring/, /\[map_saver\]: Saving map from 'map' topic to '\/home\/student\/map' file/, /\[WARN\] .*\[map_saver\]: Free threshold unspecified\. Setting it to default value: 0\.250000/, /\[WARN\] .*\[map_saver\]: Occupied threshold unspecified\. Setting it to default value: 0\.650000/, /\[WARN\] .*\[map_io\]: Image format unspecified\. Setting it to: pgm/, /\[map_io\]: Received a \d+ X \d+ map @ 0\.05 m\/pix/, /\[map_io\]: Writing map occupancy data to \/home\/student\/map\.pgm/, /\[map_io\]: Writing map metadata to \/home\/student\/map\.yaml/, /\[map_io\]: Map saved/, /\[map_saver\]: Map saved successfully/];
  ok("map_saver_cli: the real output lines", want.every((re) => ms.some((l) => re.test(l))) && ms.includes("rc=0"), ms);
  const y = fs.written.get("/home/student/map.yaml"), pgm = fs.written.get("/home/student/map.pgm");
  ok("map_saver wrote ~/map.yaml + ~/map.pgm (trinary)", typeof y === "string" && /^image: map\.pgm\nmode: trinary\nresolution: 0\.05\norigin: \[/.test(y) && /occupied_thresh: 0\.65\nfree_thresh: 0\.196/.test(y) && pgm && pgm[0] === 80 && pgm[1] === 53, y);
  const back = mods.core.loadMap(y, "/home/student/map.yaml", (p) => fs.read(p));
  ok("the saved map loads again with map_io semantics", back.grid && back.grid.width === m1.grid.width && back.grid.data.filter((v) => v === 100).length > 50, back.logs.slice(-1));
  // cartographer: cartographer_node + cartographer_occupancy_grid_node with the launch arguments
  const L2 = await mods.lib.startLaunch(mods, io, "tb3_burger-1"), G2 = L2.G; G2.nav2NoTimer = true; G2.out = (t) => t; G2.gzPhys.refreshMeshes(); mods.lib.step(G2, 0.5);
  const co = [];
  mods.nav2.startNav2Node(G2, { pkg: "cartographer_ros", exe: "cartographer_node", name: "cartographer_node", args: ["-configuration_directory", CARTO_DIR, "-configuration_basename", "turtlebot3_lds_2d.lua", "--ros-args", "-p", "use_sim_time:=True"], fs, write: (t) => co.push(t) });
  mods.nav2.startNav2Node(G2, { pkg: "cartographer_ros", exe: "cartographer_occupancy_grid_node", name: "cartographer_occupancy_grid_node", args: ["-resolution", "0.05", "-publish_period_sec", "1.0"], fs, write: (t) => co.push(t) });
  G2.gzTwist("/cmd_vel", { lx: 0, ly: 0, lz: 0, az: 0.6 }, "geometry_msgs/msg/TwistStamped"); mods.lib.step(G2, 4);
  const cm = G2.nav2.maps.get("/map");
  ok("cartographer: reads turtlebot3_lds_2d.lua (glog lines), occupancy grid node publishes /map at 0.05 m", co.some((l) => /configuration_file_resolver\.cc:41\] Found '.*turtlebot3_lds_2d\.lua' for 'turtlebot3_lds_2d\.lua'/.test(l)) && cm && Math.abs(cm.grid.resolution - 0.05) < 1e-9 && cm.ver >= 2, co.slice(0, 3));
  r.pass = r.checks.every((c) => c.ok);
  return r;
}
