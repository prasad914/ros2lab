// ROS2Lab SLAM process models (the website's own JavaScript models; the real slam_toolbox / cartographer programs
// cannot run in a browser): slam_toolbox (sync / async / localization nodes, Jazzy lifecycle node) and cartographer_ros
// (cartographer_node + cartographer_occupancy_grid_node). They read the REAL configuration (mapper_params_online_*.yaml,
// turtlebot3_lds_2d.lua, the -resolution / -publish_period_sec arguments), build an occupancy grid from the simulated
// /scan, publish /map (transient local) and map -> odom, and offer the same services (slam_toolbox/save_map,
// serialize_map, ...). Started through startNav2Node (nav2-sim.js), which dispatches here.
//
// Modelling note (honest): scan matching is not re-implemented. The models take the robot's motion since the start
// from Gazebo's true pose (plus a little noise), which is what a well-tuned scan matcher recovers on a clean
// simulated world; the map frame starts at the odom frame, like slam_toolbox and cartographer do.

export function slamRole(desc) {
  const pkg = desc.pkg || desc.package, exe = desc.exe || desc.executable || "", plugin = desc.plugin || "";
  if (pkg === "slam_toolbox") {
    if (/sync_slam_toolbox_node$/.test(exe) && !/async/.test(exe) || /SynchronousSlamToolbox/.test(plugin)) return "slam:toolbox_sync";
    if (/async_slam_toolbox_node$/.test(exe) || /AsynchronousSlamToolbox/.test(plugin)) return "slam:toolbox_async";
    if (/localization_slam_toolbox_node$/.test(exe) || /LocalizationSlamToolbox/.test(plugin)) return "slam:toolbox_localization";
    if (/lifelong_slam_toolbox_node$/.test(exe) || /LifelongSlamToolbox/.test(plugin)) return "slam:toolbox_lifelong";
    return null;
  }
  if (pkg === "cartographer_ros") {
    if (exe === "cartographer_node") return "slam:carto";
    if (exe === "cartographer_occupancy_grid_node") return "slam:carto_grid";
  }
  return null;
}
const argOf = (args, flag, d) => { const i = args.indexOf(flag); if (i >= 0 && i + 1 < args.length) return args[i + 1]; const eq = args.find((a) => a.startsWith(flag + "=")); return eq ? eq.slice(flag.length + 1) : d; };
const glogStamp = () => { const d = new Date(), p = (n, k = 2) => String(n).padStart(k, "0"); return `I${p(d.getMonth() + 1)}${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}000`; };

export function startSlam(sys, kind, desc, { NavNode, C, pyFloat }) {
  const { num, bool, compose, inverse, gauss } = C;
  // the robot's pose in the map frame: odom pose at the start, then the true motion since the start (+ noise)
  class SlamBase extends NavNode {
    initFrames() {
      const T = sys.truePose(), O = sys.odom(); if (!T || !O) return false;
      this.T0 = T; this.O0 = O; return true;
    }
    mapPose() {
      if (!this.T0 && !this.initFrames()) return null;
      const T = sys.truePose(), rel = compose(inverse(this.T0), T), p = compose(this.O0, rel);
      return { x: p.x + gauss() * 0.003, y: p.y + gauss() * 0.003, yaw: p.yaw + gauss() * 0.002 };
    }
    insertScan(maxRange, missRay) {
      const scan = sys.scan(), pose = this.mapPose(); if (!scan || !pose) return false;
      if (scan.seq === this.lastSeq) return false; this.lastSeq = scan.seq;
      const S = compose(pose, scan.offset), pts = [];
      for (let i = 0; i < scan.ranges.length; i++) {
        let r = scan.ranges[i]; if (r === -Infinity || r < scan.range_min) continue;
        const hit = Number.isFinite(r) && r <= Math.min(scan.range_max, maxRange);
        if (!hit) r = Math.min(scan.range_max, maxRange) + 1e-3;
        const a = S.yaw + scan.angle_min + i * scan.angle_increment; pts.push([S.x + r * Math.cos(a), S.y + r * Math.sin(a), r]);
      }
      this.grid.insert(S, pts, Math.min(scan.range_max, maxRange), missRay);
      const o = sys.odom(); if (o) sys.setMapOdom(compose(pose, inverse(o)), this.full);
      this.pose = pose; this.scans = (this.scans || 0) + 1;
      return true;
    }
    publish(topic) { const g = this.grid.toGrid(this.mapFrame || "map"); sys.setMap(this.resolve(topic || "map"), g, this.full); this.mapCount = (this.mapCount || 0) + 1; }
  }

  // ------------------------------------------------ slam_toolbox
  class SlamToolbox extends SlamBase {
    constructor(desc) {
      super(sys, `slam_${kind}`, { ...desc, name: desc.name || "slam_toolbox" });
      this.mode = kind; this.mapFrame = String(this.P.map_frame || "map"); this.noBond = true;
      this.announce(null);
      this.info(`Node using stack size ${num(this.P.stack_size_to_use, 40000000)}`);
      if (kind === "toolbox_lifelong") this.warn("(ROS2Lab) lifelong mapping is modelled like online mapping in the practice simulator.");
    }
    endpoints() {
      const S = "slam_toolbox/";
      // real (async mapping): /scan best effort, /map and /map_metadata transient_local, slam_toolbox also subscribes its
      // own /map; /initialpose only in localization mode (parity/fixtures/*/slam/qos, topic_list.txt)
      return { subs: [[String(this.P.scan_topic || "/scan"), "sensor_msgs/msg/LaserScan", "BEST_EFFORT/VOLATILE"], ["map", "nav_msgs/msg/OccupancyGrid"], ...(kind === "toolbox_localization" ? [["initialpose", "geometry_msgs/msg/PoseWithCovarianceStamped"]] : []), ["slam_toolbox/feedback", "visualization_msgs/msg/InteractiveMarkerFeedback"]],
        pubs: [["map", "nav_msgs/msg/OccupancyGrid", "RELIABLE/TRANSIENT_LOCAL"], ["map_metadata", "nav_msgs/msg/MapMetaData", "RELIABLE/TRANSIENT_LOCAL"], ["pose", "geometry_msgs/msg/PoseWithCovarianceStamped"], ["/tf", "tf2_msgs/msg/TFMessage"], ["slam_toolbox/graph_visualization", "visualization_msgs/msg/MarkerArray"], ["slam_toolbox/scan_visualization", "sensor_msgs/msg/LaserScan"], ["slam_toolbox/update", "visualization_msgs/msg/InteractiveMarkerUpdate"]],
        srvs: [[S + "dynamic_map", "nav_msgs/srv/GetMap"], [S + "pause_new_measurements", "slam_toolbox/srv/Pause"], [S + "serialize_map", "slam_toolbox/srv/SerializePoseGraph"], [S + "deserialize_map", "slam_toolbox/srv/DeserializePoseGraph"], [S + "reset", "slam_toolbox/srv/Reset"], [S + "save_map", "slam_toolbox/srv/SaveMap"], [S + "clear_changes", "slam_toolbox/srv/Clear"], [S + "manual_loop_closure", "slam_toolbox/srv/LoopClosure"], [S + "toggle_interactive_mode", "slam_toolbox/srv/ToggleInteractive"], [S + "clear_queue", "slam_toolbox/srv/ClearQueue"]] };
    }
    onConfigure() {
      const P = this.P;
      if (num(P.resolution, 0.05) <= 0) { this.warn("You've set resolution of map to be zero or negative, this isn't allowed so it will be set to default value 0.05."); P.resolution = 0.05; }
      this.info(`Using solver plugin ${P.solver_plugin || "solver_plugins::CeresSolver"}`);
      this.grid = new C.MappingGrid(num(P.resolution, 0.05));
      if (kind === "toolbox_localization") this.warn("(ROS2Lab) localization mode: the pose graph file is not deserialized in the practice simulator; it maps like online mode.");
      return true;
    }
    onActivate() { this.info("Activating"); this.lastMap = -1e9; this.lastNode = null; this.lastT = -1e9; return true; }
    onDeactivate() { if (sys.mapOdomBy === this.full) sys.setMapOdom(null, null); }
    tick(t) {
      if (this.state !== "active" || this.paused) return;
      const pose = this.mapPose(); if (!pose) return;
      // a new node in the pose graph after minimum_travel_distance / minimum_travel_heading (and minimum_time_interval)
      const L = this.lastNode, moved = !L || Math.hypot(pose.x - L.x, pose.y - L.y) >= num(this.P.minimum_travel_distance, 0.5) || Math.abs(C.wrap(pose.yaw - L.yaw)) >= num(this.P.minimum_travel_heading, 0.5);
      if (moved && t - this.lastT >= num(this.P.minimum_time_interval, 0.5)) {
        if (this.insertScan(num(this.P.max_laser_range, 20), null)) {
          if (!L && this.write) this.write("Registering sensor: [Custom Described Lidar]\n", "out");
          this.lastNode = pose; this.lastT = t; (this.nodes = this.nodes || []).push(pose);
        }
      } else { const o = sys.odom(); if (o) sys.setMapOdom(compose(pose, inverse(o)), this.full); this.pose = pose; }
      if (this.nodes && t - this.lastMap >= num(this.P.map_update_interval, 5.0)) { this.lastMap = t; this.publish("map"); }
    }
    onInitialPose() { this.warn("(ROS2Lab) /initialpose is only used by slam_toolbox in localization mode."); }
    onService(name, type, req, graph) {
      const S = (s) => this.resolve(`slam_toolbox/${s}`), out = (t) => graph.out(t), ok = (reqTxt, respTxt) => [out("waiting for service to become available..."), out(`requester: making request: ${reqTxt}`), out(""), out("response:"), out(respTxt), out("")];
      if (name === S("save_map")) {
        const file = (req.name && (req.name.data ?? req.name)) || "";
        // slam_toolbox's SaveMap runs `ros2 run nav2_map_server map_saver_cli -f <name> --ros-args -p map_subscribe_transient_local:=true`
        const ms = { P: {}, fs: this.fs, sys, info: (t, lg) => this.info(t, lg || "map_saver"), warn: (t, lg) => this.warn(t, lg || "map_saver"), error: (t, lg) => this.error(t, lg || "map_saver") };
        const m = sys.maps.get(this.resolve("map")); let r = 1;
        if (m && file) { const g = m.grid, home = (this.fs && this.fs.home) || "/home/student"; let base = String(file).startsWith("~/") ? home + String(file).slice(1) : String(file); if (!base.startsWith("/")) base = `${(this.fs && this.fs.cwd) || home}/${base}`; const s = C.saveMap(g, { imageName: `${base.split("/").pop()}.pgm` }); if (this.fs && this.fs.write) { this.fs.write(`${base}.pgm`, s.pgm); this.fs.write(`${base}.yaml`, s.yaml + "\n"); } ms.info(`Map saved successfully`); r = 0; }
        return ok(`slam_toolbox.srv.SaveMap_Request(name=std_msgs.msg.String(data='${file}'))`, `slam_toolbox.srv.SaveMap_Response(result=${r})`);
      }
      if (name === S("serialize_map")) {
        const file = req.filename || ""; const home = (this.fs && this.fs.home) || "/home/student"; let base = file.startsWith("~/") ? home + file.slice(1) : file; if (base && !base.startsWith("/")) base = `${(this.fs && this.fs.cwd) || home}/${base}`;
        const g = this.grid ? this.grid.toGrid() : null;
        if (base && g && this.fs && this.fs.write) {
          // not the real boost archive: a readable JSON record of the practice pose graph and grid, for deserialize_map here
          this.fs.write(`${base}.posegraph`, JSON.stringify({ format: "ROS2Lab practice slam_toolbox pose graph (not the boost serialization of the real program)", nodes: this.nodes || [] }));
          this.fs.write(`${base}.data`, JSON.stringify({ resolution: g.resolution, width: g.width, height: g.height, origin: g.origin, lo: Array.from(this.grid.lo), seen: Array.from(this.grid.seen) }));
        }
        return ok(`slam_toolbox.srv.SerializePoseGraph_Request(filename='${file}')`, `slam_toolbox.srv.SerializePoseGraph_Response(result=${base && g ? 0 : 255})`);
      }
      if (name === S("pause_new_measurements")) { this.paused = !this.paused; this.info(`SlamToolbox: Toggled to ${this.paused ? "pause taking new measurements." : "actively taking measurements."}`); return ok("slam_toolbox.srv.Pause_Request()", "slam_toolbox.srv.Pause_Response(status=True)"); }
      if (name === S("reset")) { this.grid = new C.MappingGrid(num(this.P.resolution, 0.05)); this.nodes = []; this.lastNode = null; this.T0 = null; return ok("slam_toolbox.srv.Reset_Request(pause_new_measurements=False)", "slam_toolbox.srv.Reset_Response(result=0)"); }
      return null;
    }
    sample(topic, hdr) {
      // /map_metadata: the info of the last /map, transient local like /map; map_load_time stays 0
      // (parity/fixtures/tb3_burger/slam_map_metadata/echo_map_metadata_once.txt)
      if (topic === this.resolve("map_metadata")) {
        const m = sys.maps.get(this.resolve("map")); if (!m) return null; const g = m.grid;
        return [`map_load_time:\n  sec: 0\n  nanosec: 0\nresolution: ${pyFloat(Math.fround(g.resolution))}\nwidth: ${g.width}\nheight: ${g.height}\norigin:\n  position:\n    x: ${pyFloat(g.origin[0])}\n    y: ${pyFloat(g.origin[1])}\n    z: 0.0\n  orientation:\n    x: 0.0\n    y: 0.0\n    z: 0.0\n    w: 1.0`];
      }
      if (topic === this.resolve("pose") && this.pose) { const p = this.pose; return [`${hdr(this.mapFrame)}\npose:\n  pose:\n    position:\n      x: ${p.x}\n      y: ${p.y}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${Math.sin(p.yaw / 2)}\n      w: ${Math.cos(p.yaw / 2)}\n  covariance:\n${Array(36).fill("  - 0.0").join("\n")}`]; }
      return null;
    }
  }

  // ------------------------------------------------ cartographer_ros
  class Cartographer extends SlamBase {
    constructor(desc) {
      super(sys, "slam_carto", { ...desc, name: desc.name || "cartographer_node" }, { lifecycle: false });
      const args = [].concat(desc.args || (desc.cmd ? desc.cmd.slice(1) : []));
      this.cfgDir = argOf(args, "-configuration_directory", ""); this.cfgBase = argOf(args, "-configuration_basename", "");
      const lua = this.readLua();
      this.opts = lua;
      this.mapFrame = lua.map_frame || "map";
      this.minRange = num(lua["TRAJECTORY_BUILDER_2D.min_range"], 0); this.maxRange = num(lua["TRAJECTORY_BUILDER_2D.max_range"], 30); this.missRay = num(lua["TRAJECTORY_BUILDER_2D.missing_data_ray_length"], 5);
      this.grid = new C.MappingGrid(0.05);
      this.state = "active"; this.started = sys.now();
    }
    glog(file, line, text) { this.info(`${glogStamp()} ${1000 + (this.pid || 0) % 9000} ${file}:${line}] ${text}`, "cartographer logger"); }
    readLua() {
      const out = {}; if (!this.cfgBase) { this.error("F" + glogStamp().slice(1) + " configuration_file_resolver.cc:55] File '' was not found.", "cartographer logger"); return out; }
      const p = `${this.cfgDir}/${this.cfgBase}`; let text = this.fs ? this.fs.read(p) : null; if (text && typeof text !== "string") text = new TextDecoder().decode(text);
      if (!text) { this.error(`F${glogStamp().slice(1)} configuration_file_resolver.cc:55] File '${this.cfgBase}' was not found.`, "cartographer logger"); return out; }
      this.glog("configuration_file_resolver.cc", 41, `Found '${p}' for '${this.cfgBase}'.`);
      for (const m of text.matchAll(/include "([\w.]+)"/g)) this.glog("configuration_file_resolver.cc", 41, `Found '/opt/ros/jazzy/share/cartographer/configuration_files/${m[1]}' for '${m[1]}'.`);
      for (const m of text.matchAll(/^\s*([\w.]+)\s*=\s*("[^"]*"|[-\w.]+(?:\([^)]*\))?)\s*,?\s*$/gm)) {
        let v = m[2]; if (/^"/.test(v)) v = v.slice(1, -1); else if (/^math\.rad\(([-\d.]+)\)$/.test(v)) v = Number(v.match(/[-\d.]+/)[0]) * Math.PI / 180; else if (v === "true" || v === "false") v = v === "true"; else if (/^[-\d.]+(e-?\d+)?$/.test(v)) v = Number(v);
        out[m[1].replace(/^options\./, "")] = v;
      }
      return out;
    }
    endpoints() { const o = this.opts || {}, BE = "BEST_EFFORT/VOLATILE"; return { subs: [["scan", "sensor_msgs/msg/LaserScan", BE], ...(o.use_odometry === true ? [["odom", "nav_msgs/msg/Odometry", BE]] : []), ...(o["TRAJECTORY_BUILDER_2D.use_imu_data"] === false ? [] : [["imu", "sensor_msgs/msg/Imu", BE]])], pubs: [["submap_list", "cartographer_ros_msgs/msg/SubmapList"], ["trajectory_node_list", "visualization_msgs/msg/MarkerArray"], ["landmark_poses_list", "visualization_msgs/msg/MarkerArray"], ["constraint_list", "visualization_msgs/msg/MarkerArray"], ["scan_matched_points2", "sensor_msgs/msg/PointCloud2"], ["/tf", "tf2_msgs/msg/TFMessage"]], srvs: [["submap_query", "cartographer_ros_msgs/srv/SubmapQuery"], ["trajectory_query", "cartographer_ros_msgs/srv/TrajectoryQuery"], ["start_trajectory", "cartographer_ros_msgs/srv/StartTrajectory"], ["finish_trajectory", "cartographer_ros_msgs/srv/FinishTrajectory"], ["write_state", "cartographer_ros_msgs/srv/WriteState"], ["get_trajectory_states", "cartographer_ros_msgs/srv/GetTrajectoryStates"], ["read_metrics", "cartographer_ros_msgs/srv/ReadMetrics"]] }; }
    tick() {
      if (!this.announced) { this.announced = true; this.glog("map_builder_bridge.cc", 79, "Added trajectory with ID '0'."); }
      if (this.insertScan(this.maxRange, this.missRay)) { const k = Math.floor(this.scans / 90); if (k > (this.submaps || 0) - 1) { this.submaps = k + 1; } }
    }
    finishTrajectory() { if (!this.finished) { this.finished = true; this.glog("map_builder_bridge.cc", 140, "Finishing trajectory with ID '0'..."); } }
  }
  class CartoGrid extends NavNode {
    constructor(desc) {
      super(sys, "slam_carto_grid", { ...desc, name: desc.name || "cartographer_occupancy_grid_node" }, { lifecycle: false });
      const args = [].concat(desc.args || (desc.cmd ? desc.cmd.slice(1) : []));
      this.res = num(argOf(args, "-resolution", "0.05"), 0.05); this.period = num(argOf(args, "-publish_period_sec", "1.0"), 1.0);
      this.state = "active"; this.last = -1e9;
    }
    endpoints() { return { subs: [["submap_list", "cartographer_ros_msgs/msg/SubmapList"]], pubs: [["map", "nav_msgs/msg/OccupancyGrid", "RELIABLE/TRANSIENT_LOCAL"]], cli: [["submap_query", "cartographer_ros_msgs/srv/SubmapQuery"]] }; }
    tick(t) {
      const c = sys.models.find((m) => m.role === "slam_carto" && !m.dead); if (!c || !c.scans || t - this.last < this.period) return;
      this.last = t;
      let g = c.grid.toGrid(c.mapFrame);
      if (Math.abs(this.res - g.resolution) > 1e-9) g = resample(g, this.res);
      sys.setMap(this.resolve("map"), g, this.full); this.count = (this.count || 0) + 1;
    }
  }
  function resample(g, res) {   // the occupancy grid node paints the submaps at -resolution
    const k = g.resolution / res, W = Math.max(1, Math.round(g.width * k)), H = Math.max(1, Math.round(g.height * k)), d = new Int8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.min(g.width - 1, Math.floor(x / k)), sy = Math.min(g.height - 1, Math.floor(y / k)); d[y * W + x] = g.data[sy * g.width + sx]; }
    return { ...g, width: W, height: H, resolution: res, data: d };
  }

  if (kind.startsWith("toolbox")) return new SlamToolbox(desc);
  if (kind === "carto") return new Cartographer(desc);
  if (kind === "carto_grid") return new CartoGrid(desc);
  return null;
}
