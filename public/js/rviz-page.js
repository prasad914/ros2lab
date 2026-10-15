// One robot's workbench window of the Robotic Models Simulator (rviz.html?robot=<id>; the catalog is sim-catalog.js).
// Its workspace has only this robot's packages. RViz is started the conventional ROS 2 way, in the practice terminal:
//   colcon build -> source install/setup.bash -> ros2 launch <pkg> display.launch.py (or .launch.xml)
// The launch file runs xacro, starts robot_state_publisher, joint_state_publisher_gui and rviz2 -d display.rviz.
// Section "Connect" shows a real ROS 2 system through rosbridge instead.
import { mountTerminal } from "./terminal-sim.js";
import { gallery } from "./rviz-block.js";
import { galleryPackage, folderPackage } from "./rviz-pkg.js";
import { parseURDF, xacro } from "./urdf-core.js";
import { Rosbridge } from "./rosbridge.js";
import { convert, LIVE_TYPES, THROTTLE } from "./ros-msgs.js";
import { PKG_SOURCES } from "./pkg-sources.js";
import { licenseStatus, cachedLicense, licensed, licenseMessage, requestLicense } from "./hw-license.js";

const $ = (id) => document.getElementById(id);
const WS = "~/ros2_ws";

// ---------------- the practice terminal (ROS 2 Jazzy is sourced in ~/.bashrc, like a set-up Ubuntu machine)
const term = mountTerminal($("term"), {
  title: "Terminal: ~/ros2_ws",
  intro: "",
  sourced: true, start: WS,
  // ~/.bashrc of a set-up ROS 2 computer: ROS 2, colcon's Tab completion, and the workspace overlay once it is built
  bashrc: "\n# ROS 2 Jazzy in every new terminal\nsource /opt/ros/jazzy/setup.bash\n# Tab completion for colcon\nsource /usr/share/colcon_argcomplete/hook/colcon-argcomplete.bash\n# your workspace (the overlay), once colcon build has made it\nif [ -f ~/ros2_ws/install/setup.bash ]; then source ~/ros2_ws/install/setup.bash; fi\n",
  cmds: ["colcon", "tree", "gz"], newTerminal: true, ide: true, rvizSave: "~/ros2_ws/my_config.rviz",
  // real hardware (a *_bringup or real.launch.py launch) needs the course administrator's hardware license
  hardwareGate: (robot) => { const st = cachedLicense(); return licensed(st, robot) ? { ok: true } : { ok: false, message: licenseMessage(st || { status: "unavailable" }, robot) }; },
  // a ROS 2 Jazzy desktop with Gazebo (ros-jazzy-ros-gz), teleop_twist_keyboard and the RViz IMU plugin installed
  // ... and ros2_control for Gazebo (ros-jazzy-gz-ros2-control, ros-jazzy-ros2-controllers)
  rosPkgs: ["ros_gz_sim", "ros_gz_bridge", "ros_gz_image", "teleop_twist_keyboard", "rviz_imu_plugin", "controller_manager", "gz_ros2_control", "ros2controlcli", "hardware_interface", "joint_state_broadcaster", "diff_drive_controller", "joint_trajectory_controller", "forward_command_controller", "position_controllers", "velocity_controllers",
    // MoveIt 2 (ros-jazzy-moveit + the CHOMP / STOMP / Pilz planners) and the extra ros2_controllers the robots use
    "moveit_ros_move_group", "moveit_configs_utils", "moveit_rviz_plugin", "moveit_ros_visualization", "moveit_planners_ompl", "moveit_planners_chomp", "moveit_planners_stomp", "pilz_industrial_motion_planner", "moveit_simple_controller_manager", "moveit_kinematics", "mock_components",
    "mecanum_drive_controller", "ackermann_steering_controller", "tricycle_controller",
    // MoveIt Servo, pose goals, and the tools a robot workspace uses
    "moveit_servo", "moveit_msgs", "moveit_py", "launch_param_builder", "control_msgs", "shape_msgs", "rosbridge_server", "rqt_joint_trajectory_controller", "rqt_controller_manager", "plotjuggler_ros", "nav2_bringup", "slam_toolbox",
    // the makers' drivers for the real robots (pre-installed here; real.launch.py needs a hardware license)
    "ur_robot_driver", "ur_client_library", "ur_moveit_config", "kortex_bringup", "kortex_driver", "franka_bringup", "franka_hardware", "xarm_controller", "xarm_api", "dobot_bringup_v4", "dobot_bringup", "feetech_ros2_driver",
    "interbotix_xsarm_control", "abb_bringup", "abb_hardware_interface", "kuka_rsi_driver", "fanuc_hardware_interface", "turtlebot3_bringup", "turtlebot3_node", "hls_lfcd_lds_driver", "ld08_driver", "scout_base", "spot_driver", "crazyflie", "crazyflie_examples", "unitree_api", "livox_ros_driver2"],
  fs: { dirs: [`${WS}/src`], files: {} },
});
const sh = term.shell;

// Continuous background sampling for robot pose and AMCL pose history
let lastPoseSample = 0;
const sampledRobotPoseHistory = [];
const sampledAmclPoseHistory = [];

function samplePoses() {
  const g = sh?.graph;
  if (!g) return;
  const t = (g.gz && typeof g.gz.time === "number") ? g.gz.time : (typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000);
  if (t - lastPoseSample < 0.05) return;
  lastPoseSample = t;

  let rp = null;
  if (g.nav2 && typeof g.nav2.odom === "function") {
    rp = g.nav2.odom();
  } else if (g.gz && typeof g.gzOdom === "function" && g.gz.models) {
    for (const m of g.gz.models.values()) {
      if (m.gazebo && (m.gazebo.plugins || []).some((p) => /diff_drive|mecanum|ackermann/.test(p.kind))) {
        rp = g.gzOdom(m);
        break;
      }
    }
  }
  if (!rp && g.tfTree) {
    const edge = g.tfTree().find((e) => e.parent === "odom" && (e.child === "base_link" || e.child === "base_footprint"));
    if (edge && edge.t && edge.q) {
      const q = edge.q;
      const yaw = Math.atan2(2 * (q[3] * q[2] + q[0] * q[1]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
      rp = { x: edge.t[0], y: edge.t[1], yaw };
    }
  }
  if (rp) {
    const prev = sampledRobotPoseHistory[sampledRobotPoseHistory.length - 1];
    if (!prev || Math.hypot(rp.x - prev.x, rp.y - prev.y) > 0.005 || Math.abs((rp.yaw || 0) - (prev.yaw || 0)) > 0.01 || (t - prev.t) > 0.5) {
      sampledRobotPoseHistory.push({ x: rp.x, y: rp.y, yaw: rp.yaw || 0, t });
      if (sampledRobotPoseHistory.length > 5000) sampledRobotPoseHistory.shift();
    }
  }

  const amcl = g.nav2?.models?.find((m) => m.role === "amcl" && !m.dead);
  if (amcl && typeof amcl.pose === "function") {
    const ap = amcl.pose();
    if (ap) {
      const prevA = sampledAmclPoseHistory[sampledAmclPoseHistory.length - 1];
      if (!prevA || Math.hypot(ap.x - prevA.x, ap.y - prevA.y) > 0.005 || Math.abs((ap.yaw || 0) - (prevA.yaw || 0)) > 0.01 || (t - prevA.t) > 0.5) {
        sampledAmclPoseHistory.push({ x: ap.x, y: ap.y, yaw: ap.yaw || 0, t });
        if (sampledAmclPoseHistory.length > 5000) sampledAmclPoseHistory.shift();
      }
    }
  }
}
if (typeof setInterval === "function") {
  setInterval(samplePoses, 100);
}

let _catalog = (typeof window !== "undefined" && window.__ros2lab?.catalog) || null;

window.__ros2lab = {
  get term() { return term; },
  get sh() { return sh; },
  get catalog() { return _catalog; },
  set catalog(val) { _catalog = val; },
  get viewer() {
    return (typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers[0]) || live?.viewer || null;
  },

  // 1. Topic list with types and QoS
  get topics() {
    const g = sh?.graph;
    const res = [];
    const topicMap = g?.topics ? g.topics() : new Map();
    if (!topicMap.size) {
      topicMap.set("/parameter_events", {
        type: "rcl_interfaces/msg/ParameterEvent",
        by: { pubs: ["/_ros2cli_daemon"], subs: [] },
        qos: { "pubs|/_ros2cli_daemon": "RELIABLE/VOLATILE" }
      });
      topicMap.set("/rosout", {
        type: "rcl_interfaces/msg/Log",
        by: { pubs: ["/_ros2cli_daemon"], subs: [] },
        qos: { "pubs|/_ros2cli_daemon": "RELIABLE/TRANSIENT_LOCAL" }
      });
    }
    for (const [name, info] of topicMap.entries()) {
      const type = (g?.topicType ? g.topicType(name) : null) || info.type || "";
      const pubs = [];
      const subs = [];
      const qosObj = info.qos || {};
      for (const p of (info.by?.pubs || [])) {
        const rawQos = (typeof qosObj.get === "function" ? qosObj.get(`pubs|${p}`) : qosObj[`pubs|${p}`]) || "RELIABLE/VOLATILE";
        const [rel, dur] = rawQos.split("/");
        pubs.push({
          node: p,
          endpoint_type: "PUBLISHER",
          qos: {
            reliability: rel === "BEST_EFFORT" ? "Best Effort" : "Reliable",
            durability: dur === "TRANSIENT_LOCAL" ? "Transient Local" : "Volatile",
            history: "Keep last",
            depth: 10,
            raw: rawQos
          }
        });
      }
      for (const s of (info.by?.subs || [])) {
        const rawQos = (typeof qosObj.get === "function" ? qosObj.get(`subs|${s}`) : qosObj[`subs|${s}`]) || "RELIABLE/VOLATILE";
        const [rel, dur] = rawQos.split("/");
        subs.push({
          node: s,
          endpoint_type: "SUBSCRIPTION",
          qos: {
            reliability: rel === "BEST_EFFORT" ? "Best Effort" : "Reliable",
            durability: dur === "TRANSIENT_LOCAL" ? "Transient Local" : "Volatile",
            history: "Keep last",
            depth: 10,
            raw: rawQos
          }
        });
      }
      const defaultQos = pubs[0]?.qos || subs[0]?.qos || {
        reliability: "Reliable",
        durability: "Volatile",
        history: "Keep last",
        depth: 10,
        raw: "RELIABLE/VOLATILE"
      };
      res.push({
        name,
        type,
        publishers: pubs,
        subscribers: subs,
        pubs: pubs.map((p) => p.node),
        subs: subs.map((s) => s.node),
        qos: defaultQos
      });
    }
    res.get = (n) => res.find((t) => t.name === n || t.name === "/" + String(n).replace(/^\/+/, ""));
    return res;
  },

  // 2. TF frames, edges, and publishing authority
  get tf() {
    const g = sh?.graph;
    const v = (typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers[0]) || live?.viewer || null;
    const edges = g?.tfTree ? g.tfTree() : [];
    const frameSet = new Set();
    const authorityMap = {};
    for (const e of edges) {
      if (e.parent) frameSet.add(e.parent);
      if (e.child) frameSet.add(e.child);
      const auth = e.authority || (
        e.parent === "map" && e.child === "odom"
          ? (g?.nav2?.mapOdomBy || (g?.nav2?.models.find((m) => m.role === "amcl") ? "/amcl" : "/slam_toolbox"))
          : (e.parent === "odom" && e.child === "base_footprint")
          ? "/turtlebot3_fake_node"
          : (e.parent === "odom" && e.child === "base_link")
          ? "/diff_drive_controller"
          : "/robot_state_publisher"
      );
      e.authority = auth;
      if (e.child) authorityMap[e.child] = auth;
      if (e.parent && e.child) authorityMap[`${e.parent}->${e.child}`] = auth;
    }
    if (v?.state) {
      const vf = v.state()?.frames || [];
      for (const f of vf) if (f) frameSet.add(f);
    }
    const frames = [...frameSet].sort();
    return {
      frames,
      getAllFrameNames: () => frames.slice(),
      edges: edges.slice(),
      authority: authorityMap
    };
  },

  // 3. Fixed Frame options and selected value
  get fixedFrame() {
    const v = (typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers[0]) || live?.viewer || null;
    const tfData = this.tf;
    const selected = (v?.fixedFrame ? v.fixedFrame() : null) || (v?.state ? v.state().fixedFrame : null) || sh?.viz?.fixedFrame || "map";
    const options = (v?.state ? v.state().frames : null) || tfData.frames || [];
    return {
      selected,
      options: options.slice()
    };
  },

  // 4. Params per emulated node
  get nodes() {
    const g = sh?.graph;
    const res = (g?.nodes || []).map((n) => ({
      name: n.name,
      full: n.full,
      namespace: n.ns || "/",
      kind: n.kind,
      params: n.params ? { ...n.params } : {}
    }));
    res.get = (name) => res.find((n) => n.name === name || n.full === name || n.full === "/" + String(name).replace(/^\/+/, ""));
    res.getParams = (name) => res.get(name)?.params || null;
    return res;
  },

  // 5. Lifecycle states of Nav2 / lifecycle nodes
  get lifecycleStates() {
    const g = sh?.graph;
    const res = [];
    const nav2Models = g?.nav2?.models || [];
    for (const m of nav2Models) {
      if (m && (m.lifecycleNode || m.state !== undefined)) {
        const item = {
          node: m.full,
          name: m.name,
          role: m.role,
          state: m.state || "unconfigured"
        };
        res.push(item);
        res[m.full] = m.state || "unconfigured";
        res[m.name] = m.state || "unconfigured";
      }
    }
    return res;
  },

  // 6. Global Status and per-display status text in RViz
  get rvizStatus() {
    const v = (typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers[0]) || live?.viewer || null;
    if (!v) {
      return {
        globalStatus: "OK",
        statusLines: [],
        displays: []
      };
    }
    const st = v.state ? v.state() : {};
    const allDisplays = (v.displays ? v.displays() : []) || [];
    const displayStatusList = [];
    let worstLevel = "OK";

    for (const d of allDisplays) {
      const sList = d.status || [];
      const hasErr = sList.some((s) => s[0] === "error");
      const hasWarn = sList.some((s) => s[0] === "warn");
      const level = hasErr ? "Error" : hasWarn ? "Warning" : "OK";
      if (d.enabled) {
        if (level === "Error") worstLevel = "Error";
        else if (level === "Warning" && worstLevel !== "Error") worstLevel = "Warning";
      }
      const text = sList.map((s) => s[1]).join("; ") || "OK";
      displayStatusList.push({
        name: d.name,
        type: d.type,
        enabled: !!d.enabled,
        status: text,
        level,
        messages: sList.map((s) => ({ level: s[0], text: s[1], key: s[2] }))
      });
    }

    const statusLines = st.status || [];
    for (const line of statusLines) {
      if (/error/i.test(line)) worstLevel = "Error";
      else if (/warn/i.test(line) && worstLevel !== "Error") worstLevel = "Warning";
    }

    return {
      globalStatus: worstLevel,
      statusLines,
      displays: displayStatusList
    };
  },

  // 7. User-visible terminal logs and errors
  get logs() {
    const domLines = typeof document !== "undefined"
      ? [...document.querySelectorAll(".line")].map((el) => el.textContent)
      : [];
    const navLogs = sh?.graph?.nav2?.logs || [];
    return [...domLines, ...navLogs];
  },
  get errors() {
    const errLines = typeof document !== "undefined"
      ? [...document.querySelectorAll(".line.err, .line.warn-line")].map((el) => el.textContent)
      : [];
    return errLines;
  },

  // 8. /plan, /local_plan, robot pose history, /amcl_pose history, particle count, costmaps
  get nav2() {
    const g = sh?.graph;
    const sys = g?.nav2;
    const planner = sys?.models?.find((m) => m.role === "planner" && !m.dead);
    const controller = sys?.models?.find((m) => m.role === "controller" && !m.dead);
    const amcl = sys?.models?.find((m) => m.role === "amcl" && !m.dead);

    const plan = planner?.plan ? {
      frame: planner.plan.frame || "map",
      poses: (planner.plan.poses || []).map((p) => ({ x: p.x, y: p.y, yaw: p.yaw ?? 0 }))
    } : null;

    const localPlan = controller?.local ? {
      frame: controller.local.frame || "odom",
      poses: (controller.local.poses || []).map((p) => ({ x: p.x, y: p.y, yaw: p.yaw ?? 0 }))
    } : null;

    const amclP = (amcl && typeof amcl.pose === "function") ? amcl.pose() : null;
    const particleCount = amcl?.pf?.ps?.length || 0;
    const particles = amcl?.pf?.ps ? amcl.pf.ps.slice() : [];

    const globalCostmap = planner?.costmap?.grid ? {
      width: planner.costmap.grid.width,
      height: planner.costmap.grid.height,
      resolution: planner.costmap.grid.resolution,
      origin: planner.costmap.grid.origin ? planner.costmap.grid.origin.slice() : [0, 0, 0],
      data: planner.costmap.grid.data ? planner.costmap.grid.data.slice() : []
    } : null;

    const localCostmap = controller?.costmap?.grid ? {
      width: controller.costmap.grid.width,
      height: controller.costmap.grid.height,
      resolution: controller.costmap.grid.resolution,
      origin: controller.costmap.grid.origin ? controller.costmap.grid.origin.slice() : [0, 0, 0],
      data: controller.costmap.grid.data ? controller.costmap.grid.data.slice() : []
    } : null;

    const robotPoseHistory = (sys?.poseHistory && sys.poseHistory.length) ? sys.poseHistory.slice() : sampledRobotPoseHistory.slice();
    const amclPoseHistory = (sys?.amclPoseHistory && sys.amclPoseHistory.length) ? sys.amclPoseHistory.slice() : sampledAmclPoseHistory.slice();

    return {
      plan,
      localPlan,
      robotPoseHistory,
      poseHistory: robotPoseHistory,
      amclPose: amclP ? { x: amclP.x, y: amclP.y, yaw: amclP.yaw } : null,
      amclPoseHistory,
      particleCount,
      particles,
      globalCostmap,
      localCostmap,
      costmaps: {
        global: globalCostmap,
        local: localCostmap
      }
    };
  },

  // 9. Camera info, image size/encoding, PointCloud2 fields, LaserScan
  get sensors() {
    const g = sh?.graph;
    const v = (typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers[0]) || live?.viewer || null;
    let cameraInfo = null;
    let imageInfo = null;
    let pointCloud2 = null;
    let scan = null;

    if (v?.topicData) {
      for (const [topic, data] of (v.topicData()?.entries?.() || [])) {
        if (/camera_info/i.test(topic) || data.K) {
          cameraInfo = { width: data.width, height: data.height, K: data.K ? [...data.K] : null, frame: data.frame };
        }
        if (data.canvas && !imageInfo) {
          imageInfo = { width: data.canvas.width, height: data.canvas.height, encoding: "rgb8", frame: data.frame };
        }
        if (data.points && !pointCloud2) {
          pointCloud2 = { fields: ["x", "y", "z", "rgb"], frame: data.frame, count: data.points.length, points: data.points };
        }
        if (data.ranges && !scan) {
          scan = { ranges: data.ranges, angle_min: data.angle_min, angle_max: data.angle_max, angle_increment: data.angle_increment, range_min: data.range_min, range_max: data.range_max, frame: data.frame };
        }
      }
    }

    if (!cameraInfo && g?.gzRunning && g.gzRunning() && g.gz?.models) {
      for (const m of g.gz.models.values()) {
        for (const s of (m.gazebo?.sensors || [])) {
          if (s.camera) {
            const C = s.camera;
            const fx = C.width / 2 / Math.tan(C.hfov / 2);
            cameraInfo = { width: C.width, height: C.height, K: [fx, 0, C.width / 2, 0, fx, C.height / 2, 0, 0, 1], frame: s.frame || s.link };
            if (!imageInfo) imageInfo = { width: C.width, height: C.height, encoding: "rgb8", frame: s.frame || s.link };
          }
        }
      }
    }

    return {
      cameraInfo,
      imageInfo,
      pointCloud2,
      scan
    };
  },

  // 10. Current course level and lock state
  get course() {
    const levelAttr = typeof document !== "undefined"
      ? (document.body?.getAttribute("data-level") || document.querySelector("[data-level]")?.getAttribute("data-level"))
      : null;
    const level = Number((typeof window !== "undefined" && window.__ros2labCourseLevel) ?? levelAttr ?? 1);
    const locks = (typeof window !== "undefined" && window.__ros2labCourseLocks) || {};
    return {
      level,
      locks: { ...locks },
      isLocked: (lvl) => !!locks[lvl]
    };
  }
};
let current = null;   // { name, files, main, launches }

function writePackage(p) {
  for (const x of p.extraPackages || []) writePackage(x);   // e.g. <robot>_moveit_config next to the description
  const dir = sh.abs(`${WS}/src/${p.name}`);
  for (const k of [...sh.fs.keys()]) if (k === dir || k.startsWith(dir + "/")) sh.fs.delete(k);   // a fresh copy of the package sources
  sh.mkdirP(dir);
  for (const [rel, content] of Object.entries(p.files)) {
    const path = `${dir}/${rel}`;
    sh.mkdirP(path.replace(/\/[^/]*$/, ""));
    sh.fs.set(path, { type: "f", mode: /^#!/.test(String(content)) ? "rwxrwxr-x" : "rw-r--r--", content });
  }
}
function launchFile() {
  const want = document.querySelector("input[name=lf]:checked").value, what = document.querySelector("input[name=what]:checked").value;
  const l = (current.launches || []).filter((f) => (what === "control" ? /control/i.test(f) : what === "sim" ? /sim|gazebo|gz/i.test(f) && !/control/i.test(f) : !/sim|gazebo|gz|control/i.test(f)));
  const pool = l.length ? l : current.launches || [];
  return pool.find((f) => (want === "xml" ? /\.xml$/ : /\.py$/).test(f)) || pool[0] || null;
}
function commands() {
  if (!current) return [];
  const what = document.querySelector("input[name=what]:checked").value;
  if ((what === "moveit" || what === "moveit_gz") && current.moveit) {
    const M = current.moveit.pkg;
    return ["cd ~/ros2_ws", `colcon build --packages-select ${[current.name, ...(current.extraPackages || []).map((x) => x.name)].join(" ")}`, "source install/setup.bash", `ros2 launch ${M} ${what === "moveit" ? "demo.launch.py" : "gazebo.launch.py"}`];
  }
  const lf = launchFile();
  return ["cd ~/ros2_ws", `colcon build --packages-select ${[current.name, ...(current.extraPackages || []).map((x) => x.name)].join(" ")}`, "source install/setup.bash",
    lf ? `ros2 launch ${current.name} ${lf}` : current.mainPath ? `ros2 launch urdf_tutorial display.launch.py model:=$PWD/src/${current.name}/${current.mainPath}` : "# no robot file (.urdf / .urdf.xacro) was found in this package"];
}
function paintCommands() {
  $("cmds").textContent = commands().map((c) => `$ ${c}`).join("\n");
  const lf = launchFile(), xmlRadio = document.querySelector("input[name=lf][value=xml]"), pyRadio = document.querySelector("input[name=lf][value=py]");
  xmlRadio.disabled = !(current && current.launches.some((f) => /\.xml$/.test(f))); pyRadio.disabled = !(current && current.launches.some((f) => /\.py$/.test(f)));
  const simRadio = document.querySelector("input[name=what][value=sim]"), hasSim = !!(current && current.launches.some((f) => /sim|gazebo|gz/i.test(f)));
  simRadio.disabled = !hasSim; if (!hasSim && simRadio.checked) document.querySelector("input[name=what][value=display]").checked = true;
  const ctlRadio = document.querySelector("input[name=what][value=control]"), hasCtl = !!(current && current.launches.some((f) => /control/i.test(f)));
  if (ctlRadio) { ctlRadio.disabled = !hasCtl; ctlRadio.closest("label").hidden = !hasCtl; if (!hasCtl && ctlRadio.checked) document.querySelector("input[name=what][value=display]").checked = true; }
  for (const v of ["moveit", "moveit_gz"]) { const r = document.querySelector(`input[name=what][value=${v}]`); if (!r) continue; const on = !!(current && current.moveit); r.disabled = !on; r.closest("label").hidden = !on; if (!on && r.checked) document.querySelector("input[name=what][value=display]").checked = true; }
  // how to drive / move this robot once it runs (what a real Jazzy setup needs)
  const tip = $("drive-tip"), what = document.querySelector("input[name=what]:checked").value, S = current && current.sim;
  let t = "";
  if (S && what === "sim") t = S.drive || S.velocity || S.mecanum || S.ackermann ? "Drive it from a + New terminal: ros2 run teleop_twist_keyboard teleop_twist_keyboard  (Twist on /cmd_vel; ros_gz_bridge carries it to Gazebo's " + (S.drive ? "DiffDrive" : S.mecanum ? "MecanumDrive" : S.ackermann ? "AckermannSteering" : "VelocityControl") + " system)." + (S.mecanum ? " Hold Shift to strafe (U I O J K L M < >)." : "") + (S.velocity && S.velocity.fly ? " t climbs, b descends." : "")
    : S.positions && S.positions.length ? `Move a joint from a + New terminal: ros2 topic pub --once /${S.positions[0].joint}/cmd_pos std_msgs/msg/Float64 "{data: 1.0}"  (Gazebo's JointPositionController moves it).` : "";
  if (S && what === "control" && S.control) t = S.control.controller === "diff_drive_controller" ? "Drive it from a + New terminal (Jazzy's diff_drive_controller takes TwistStamped on its own topic): ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true -r cmd_vel:=/diff_drive_controller/cmd_vel   Check the controllers with: ros2 control list_controllers"
    : `Move the arm from a + New terminal: ros2 topic pub --once /joint_trajectory_controller/joint_trajectory trajectory_msgs/msg/JointTrajectory "{joint_names: [${S.control.arm.map((j) => j.name).join(", ")}], points: [{positions: [${S.control.arm.map((j, i) => (i % 2 ? 0.6 : 0.3).toFixed(1)).join(", ")}], time_from_start: {sec: 3}}]}"   Check the controllers with: ros2 control list_controllers`;
  if (current && current.moveit && (what === "moveit" || what === "moveit_gz")) {
    const M = current.moveit;
    t = `In RViz's MotionPlanning panel: drag the orange marker at ${M.tip} (goal state), pick the pipeline in the Context tab (ompl, pilz_industrial_motion_planner, chomp, stomp) and the planner, then Plan and Execute in the Planning tab.${what === "moveit" ? ` The work cell's obstacles: in a + New terminal, cd ~/ros2_ws && source install/setup.bash && ros2 run ${M.pkg} add_scene_objects.py` : " The table, box and post are already in the Gazebo world and the planning scene."}${M.real ? `  Real robot: ${M.real.connection}; see src/${M.pkg}/README.md.` : ""}`;
  }
  if (current && current.moveit && (what === "moveit" || what === "moveit_gz")) {
    const M = current.moveit;
    t += ` Type a goal instead: the Pose Goal panel on the right of RViz (x, y, z, roll, pitch, yaw), or ros2 run ${M.pkg} pose_goal_commander.py and publish geometry_msgs/msg/PoseStamped on /goal_pose. Jog it live with MoveIt Servo: ros2 launch ${M.pkg} servo.launch.py. Failed plans print move_group's errors in the launch terminal.`;
  }
  if (t && current && (what !== "display")) t += ` Goals in a window (like joint_state_publisher_gui): ros2 run goal_pose_gui goal_pose_gui${current.moveit ? "" : ", plus ros2 run goal_pose_gui pose_follower so that Go drives the robot there"}.`;
  const bu = current && (current.extraPackages || []).find((x) => /_bringup$/.test(x.name));
  if (bu && t) t += ` The real robot: ros2 launch ${bu.name} real.launch.py (needs a hardware license from your course administrator).`;
  if (tip) { tip.textContent = t; tip.hidden = !t; }
  // the workspace's files, one folder per package: click a file to see it with cat (like on Ubuntu)
  const tree = $("tree"); tree.replaceChildren();
  const count = $("tree-count"); if (count) count.textContent = "";
  if (!current) return;
  const order = (files) => Object.keys(files).filter((r) => !String(files[r]).startsWith("@url:")).sort((a, b) => (a.split("/").length - b.split("/").length) || a.localeCompare(b));
  const pkgs = [current, ...(current.extraPackages || [])];
  let total = 0;
  for (const x of pkgs) {
    const rels = order(x.files); total += rels.length;
    const box = document.createElement("details"); box.className = "rvp-pkg"; box.open = x === current;
    const sum = document.createElement("summary"); sum.append(`src/${x.name}/ `);
    const n = document.createElement("span"); n.className = "muted small"; n.textContent = `${rels.length} file${rels.length === 1 ? "" : "s"}${x === current && lf ? `, launch file launch/${lf}` : ""}`; sum.append(n);
    const list = document.createElement("div"); list.className = "rvp-files small";
    for (const rel of rels) {
      const b = document.createElement("button"); b.type = "button"; b.className = "rvp-file"; b.textContent = rel;
      b.title = `Show it in the terminal: cat src/${x.name}/${rel}`;
      b.addEventListener("click", () => { if (term.busy()) term.say("(A launch is running in this tab. Open a + New terminal to look at files while it runs, or stop it with Ctrl+C.)"); else term.run(`cat ~/ros2_ws/src/${x.name}/${rel}`); });
      list.append(b);
    }
    box.append(sum, list); tree.append(box);
  }
  if (count) count.textContent = `(${pkgs.length} packages, ${total} files)`;
}
// goal_pose_gui (a real ROS 2 package): the Goal Pose window and the pose follower, in every robot's workspace
const goalPkg = () => ({ name: "goal_pose_gui", files: { ...PKG_SOURCES.goal_pose_gui } });
async function usePackage(p, label) {
  p.extraPackages = (p.extraPackages || []).filter((x) => x.name !== "goal_pose_gui").concat([goalPkg()]);
  current = p;
  writePackage(p);
  paintCommands();
  paintDetails(p);
  const all = [p.name, ...(p.extraPackages || []).map((x) => x.name)];
  term.say(`(${label}: ${all.length > 1 ? `the packages ${all.join(", ")} are` : `the package ${p.name} is`} in ~/ros2_ws/src. Build, source the workspace and launch: the commands are above the terminal. code ~/ros2_ws opens them all in VS Code.)`);
  for (const n of p.notes || []) term.say(`(${n})`);
}

// ---------------- the robot's details, as RViz and Gazebo will see them
function paintDetails(p) {
  const box = $("details"); box.replaceChildren();
  const files = p.files || {}, main = p.sim ? `urdf/${p.sim.model}_sim.urdf.xacro` : p.mainPath || (p.main ? `urdf/${p.main}` : null);
  let urdf = null;
  try { urdf = expandIn(files, p.name, main); } catch (e) { box.textContent = `Could not read the robot: ${e.message}`; return; }
  if (!urdf) { box.textContent = "No robot file found."; return; }
  const d = sh.graph.robotDetails(urdf);
  if (d.error) { box.textContent = `The URDF does not parse: ${d.error}`; return; }
  const M = d.model, J = Object.values(M.joints), mov = J.filter((j) => j.type !== "fixed");
  const sec = (title, rows) => { const s = document.createElement("div"); s.className = "rvp-dsec"; const h = document.createElement("h3"); h.textContent = title; s.append(h); const ul = document.createElement("ul"); for (const r of rows) { const li = document.createElement("li"); li.textContent = r; ul.append(li); } if (!rows.length) { const li = document.createElement("li"); li.textContent = "none"; ul.append(li); } s.append(ul); return s; };
  const lim = (j) => (j.limit && j.type !== "continuous" ? ` [${(+j.limit.lower).toFixed(2)}, ${(+j.limit.upper).toFixed(2)}]${j.type === "prismatic" ? " m" : " rad"}` : "");
  const senLine = (s) => `${s.name} (${s.type}) on ${s.link}: ${s.topic ? `Gazebo topic /${s.topic.replace(/^\//, "")}` : "default Gazebo topic"}, ${s.rate || "?"} Hz, frame ${s.optical || s.frame || "(model/link/sensor)"}${s.lidar ? `, ${s.lidar.hSamples}x${s.lidar.vSamples} rays, ${s.lidar.min}-${s.lidar.max} m` : ""}${s.camera ? `, ${s.camera.width}x${s.camera.height}, hfov ${(+s.camera.hfov).toFixed(2)} rad` : ""}`;
  box.append(
    Object.assign(document.createElement("p"), { textContent: `Robot "${M.name}": root link ${M.root}, ${Object.keys(M.links).length} links, ${J.length} joints (${mov.length} that move). This is what the launch file's xacro produces, the same text robot_state_publisher publishes on /robot_description.` }),
    sec("Moving joints (actuators)", mov.map((j) => `${j.name}: ${j.type}${j.mimic ? ` (mimics ${j.mimic.joint})` : ""}${lim(j)}, ${j.parent} → ${j.child}`)),
    sec("Gazebo sensors (<gazebo reference> <sensor>)", d.gz.sensors.map(senLine)),
    sec("Gazebo systems (model plugins)", d.gz.plugins.map((x) => x.kind === "diff_drive" ? `DiffDrive: left ${x.left.join(", ")}, right ${x.right.join(", ")}, separation ${x.separation} m, radius ${x.radius} m, cmd ${x.topic || "/model/<name>/cmd_vel"}` : x.kind === "joint_states" ? `JointStatePublisher: ${x.topic || "/world/<world>/model/<name>/joint_state"}` : x.kind === "gz_ros2_control" ? "gz_ros2_control (ros2_control inside Gazebo)" : `${x.file}`)),
    ...(d.gz.classic.length ? [sec("Gazebo Classic plugins (ignored by Gazebo Harmonic)", d.gz.classic.map((c) => `${c.file}${c.topic ? ` (ROS topic ${c.topic})` : ""}`))] : []),
    ...(d.ros2_control.length ? [sec("ros2_control", d.ros2_control.flatMap((r) => [`${r.name}: ${r.plugin || ""}`, ...r.joints.map((j) => `  ${j.name}: command ${j.cmd.join(", ") || "-"}; state ${j.state.join(", ") || "-"}`)]))] : []),
    ...(d.transmissions.length ? [sec("Transmissions", d.transmissions)] : []),
    sec("Links", Object.values(M.links).map((l) => `${l.name}${l.visuals.length ? ` (${l.visuals.map((v) => v.geom.type).join(", ")})` : ""}${l.inertial ? `, ${(+l.inertial.mass).toFixed(3)} kg` : ""}`)));
}
function expandIn(files, pkg, rel) {
  if (!rel || files[rel] === undefined) return null;
  const t = files[rel];
  if (!/<xacro:|xmlns:xacro/.test(t)) return t;
  return xacro(t, { path: `/${pkg}/${rel}`, files: (p) => files[String(p).replace(new RegExp(`^/${pkg}/`), "")], find: (q) => (q === pkg ? `/${pkg}` : undefined) });
}

// ---------------- 1. this window's robot (rviz.html?robot=<id>): only its packages go into the workspace
const ROBOT = new URLSearchParams(location.search).get("robot") || "";
const CFG_KEY = `ros2lab.sim.cfg.${ROBOT}`;   // this robot's own launch settings, kept in this browser
function loadCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
    for (const [name, v] of Object.entries(c)) { const r = document.querySelector(`input[name=${name}][value="${v}"]`); if (r && !r.disabled) r.checked = true; }
  } catch { /* storage off */ }
}
function saveCfg() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify({ what: document.querySelector("input[name=what]:checked").value, lf: document.querySelector("input[name=lf]:checked").value })); } catch { /* storage off */ }
}
async function robotCard(g) {
  const { categoryOf, CATEGORIES } = await import("./sim-catalog.js");
  const cat = categoryOf(g), C = CATEGORIES.find((c) => c.id === cat);
  $("robot-card").classList.add(`c-${cat}`);
  $("robot-cat").textContent = `${C ? C.title : "Robot"}${g.vendor ? ` · ${g.vendor}` : " · ROS2Lab course robot"}`;
  $("robot-name").textContent = g.title;
  const pic = $("robot-pic"), img = document.createElement("img");
  img.alt = g.title; img.width = 400; img.height = 300; img.src = `img/robots/${g.id}.webp`;
  img.addEventListener("error", async () => { try { const { robotPicture } = await import("./robot-thumb.js"); img.src = await robotPicture(g); } catch { img.remove(); } }, { once: true });
  pic.replaceChildren(img);
}
gallery().then(async (list) => {
  if (ROBOT === "own") {
    $("own-card").hidden = false; $("robot-card").hidden = true;
    document.title = "Your robot | Robotic Models Simulator | ROS2Lab";
    $("bench-title").textContent = "Your own robot"; $("crumb-robot").textContent = "Your robot";
    term.say("(Open your package folder or your .urdf / .urdf.xacro and mesh files above: they become a package in ~/ros2_ws/src of this window only.)");
    return;
  }
  const g = list.find((x) => x.id === ROBOT);
  if (!g) { $("bench-title").textContent = "Robot not found"; term.say(`(There is no robot "${ROBOT}" in the catalog. Go back to the Robotic Models Simulator and pick one.)`); return; }
  document.title = `${g.title} | Robotic Models Simulator | ROS2Lab`;
  $("bench-title").textContent = g.title; $("crumb-robot").textContent = g.title;
  robotCard(g);
  const about = $("pkg-about"); about.replaceChildren(document.createTextNode(g.about + " "));
  if (g.source) { const a = document.createElement("a"); a.href = g.source.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = `Source: ${g.source.url.replace(/^https:\/\/github.com\//, "")} (${g.source.license})`; about.append(a); }
  // an official ROS 2 Jazzy workspace from the maker's GitHub repositories, when there is one
  try {
    const { workspaceFor } = await import("./real-launch.js");
    const W = await workspaceFor(g.id);
    if (W) { await openRealWorkspace(g, W); return; }
  } catch (e) { term.say(`(The official workspace of ${g.title} could not load: ${e.message}. Using the practice packages instead.)`); }
  try { const p = await galleryPackage(g); p.mainPath = `urdf/${p.main}`; p.robotId = g.id; await usePackage(p, g.title); loadCfg(); paintCommands(); }
  catch (e) { term.say(`(Could not load ${g.title}: ${e.message})`); }
});

// ---------------- 1b. an official workspace (public/robots/ws/<id>): the makers' real packages, run by the real launch system
async function openRealWorkspace(g, W) {
  const mod = await import("./real-launch.js");
  term.say(`(Loading the official ROS 2 Jazzy workspace of ${g.title}…)`);
  const R = await mod.loadRealWorkspace(sh, W.id, g.id, { onStatus: () => {} });
  const ws = R.json;
  $("gen-card").hidden = true; $("real-card").hidden = false;
  document.querySelector(".rvp-intro").hidden = true;
  const lead = document.querySelector("#bench > .lead");
  if (lead) lead.textContent = `This page has the maker's own ROS 2 Jazzy workspace for ${g.title}, cloned from GitHub at pinned commits. Build it with colcon, source it, and start it with the same ros2 launch commands as on Ubuntu: the real launch files run, and Gazebo, RViz2, ros2_control, Nav2 and MoveIt 2 are ROS2Lab's models of those programs.`;
  $("pkg-about").textContent = `${g.about.replace(/\s*sim(_control)?\.launch\.py[^.]*\./g, "").trim()} `;
  $("real-about").textContent = `${ws.title}. ${ws.repos.length} repositor${ws.repos.length === 1 ? "y" : "ies"} at pinned commits, ${ws.packages.length} packages, in ~/ros2_ws/src.`;
  $("real-repos").replaceChildren(...ws.repos.map((r) => { const li = document.createElement("li"), a = document.createElement("a"); a.href = `${r.url}/tree/${r.commit}`; a.target = "_blank"; a.rel = "noopener"; a.textContent = r.url.replace(/^https:\/\/github.com\//, ""); li.append(a, ` @ ${r.commit.slice(0, 8)} (${r.branch}, ${r.license})`); return li; }));
  // environment the maker's instructions ask for (e.g. TURTLEBOT3_MODEL)
  const envCmds = Object.entries(R.env).map(([k, v]) => `export ${k}=${v}`);
  const base = ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", ...envCmds];
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const mine = (e) => !e.robot || e.robot === g.id;
  const entries = [];
  for (const [kind, v] of Object.entries(ws.entry || {})) {
    if (/note|issues/.test(kind) || kind === "real") continue;
    for (const e of list(v)) if (e && e.cmd && mine(e)) entries.push({ kind, ...e });
  }
  const real = list((ws.entry || {}).real).filter((e) => e && e.cmd && mine(e));
  const button = (e, isReal) => {
    const b = document.createElement("button"); b.type = "button"; b.className = `btn btn-small ${isReal ? "btn-hw" : "btn-white"}`; b.setAttribute("role", "listitem");
    b.replaceChildren(Object.assign(document.createElement("b"), { textContent: e.title || e.kind }), document.createElement("br"), Object.assign(document.createElement("code"), { textContent: e.cmd }));
    b.addEventListener("click", () => runEntry(e, isReal));
    return b;
  };
  $("real-entries").replaceChildren(...entries.map((e) => button(e, false)));
  $("real-hw").replaceChildren(...real.map((e) => button(e, true)));
  $("real-hw-note").textContent = real.length ? "Starts the maker's driver for the real robot. It needs a hardware license from your course administrator, and the robot connected to the computer that runs ROS 2 (use \"Connect to ROS 2 on your Ubuntu computer\" below to see it here)." : "This repository has no driver for a real robot.";
  // the workspace's own notes (what upstream does not provide on Jazzy, known upstream problems)
  const notes = [...list((ws.entry || {}).sim_note), ...list((ws.entry || {}).known_issues), ...list(ws.known_issues)].map((n) => (typeof n === "string" ? n : n && (n.text || n.note || n.title))).filter(Boolean);
  if (notes.length) { const ul = document.createElement("ul"); ul.className = "small muted rvp-notes"; for (const n of notes) { const li = document.createElement("li"); li.textContent = n; ul.append(li); } $("real-entries").after(ul); }
  const U = ws.ubuntu || {};
  $("real-ubuntu").textContent = [...(U.steps || []), ...envCmds, ...(entries[0] ? [entries[0].cmd] : [])].map((c) => `$ ${c}`).join("\n");
  // the real-hardware launches are behind the license gate
  R.realCmds = real.map((e) => e.cmd.replace(/^ros2 launch\s+/, "").split(/\s+/).slice(0, 2).join(" "));
  R.hwGate = () => { const st = cachedLicense(); return licensed(st, g.id) ? { ok: true } : { ok: false, message: licenseMessage(st || { status: "unavailable" }, g.id) }; };
  paintRealTree(R);
  term.say(`(${g.title}: the makers' packages are in ~/ros2_ws/src. Build with colcon build, source install/setup.bash${envCmds.length ? `, ${envCmds.join(", ")}` : ""}, then launch. Pick a command above, or type it.)`);
  function runEntry(e, isReal) {
    if (isReal) { const gate = R.hwGate(); if (!gate.ok) { term.say(`(Real hardware: ${gate.message})`); return; } }
    if (term.busy()) term.newTerminal();   // a launch is running: like on Ubuntu, the next one goes in a new terminal
    const cmds = [...(sh.realWs.built.size ? ["cd ~/ros2_ws", "source install/setup.bash"] : base), ...(sh.realWs.built.size ? envCmds : []), e.cmd];
    for (const c of cmds) term.run(c);
    if (e.then) setTimeout(() => { term.newTerminal(); setTimeout(() => term.runHere(e.then), 400); }, 1500);
  }
}
function paintRealTree(R) {
  const tree = $("tree"); tree.replaceChildren();
  const count = $("tree-count");
  const byRepo = new Map();
  for (const p of R.pkgs.values()) { const repo = p.path.split("/")[1]; if (!byRepo.has(repo)) byRepo.set(repo, []); byRepo.get(repo).push(p); }
  let n = 0;
  for (const [repo, pk] of byRepo) {
    const d = document.createElement("details"), s = document.createElement("summary"); s.textContent = `${repo} (${pk.length} package${pk.length > 1 ? "s" : ""})`; d.append(s);
    const ul = document.createElement("ul"); ul.className = "small";
    for (const p of pk.sort((a, b) => a.name.localeCompare(b.name))) { const li = document.createElement("li"); li.textContent = `${p.name}  (${p.build_type}${(p.exes || []).length ? `, ${p.exes.length} program${p.exes.length > 1 ? "s" : ""}` : ""})`; ul.append(li); n++; }
    d.append(ul); tree.append(d);
  }
  if (count) count.textContent = `(${n} packages; open them in VS Code with: code ~/ros2_ws)`;
}

// ---------------- 2. the student's own package or files
async function openOwn(files) {
  if (!files.length) return;
  const p = await folderPackage(files);
  if (p.error) { term.say(`(${p.error})`); return; }
  await usePackage(p, "Your robot");
}
$("folder").addEventListener("change", (e) => openOwn([...e.target.files]));
$("files").addEventListener("change", (e) => openOwn([...e.target.files]));

// ---------------- 3. launch
document.querySelectorAll("input[name=lf], input[name=what]").forEach((r) => r.addEventListener("change", () => { paintCommands(); saveCfg(); }));
$("go").addEventListener("click", () => {
  if (!current) return;
  term.stopAll();
  for (const c of commands()) term.run(c);
  const v = document.querySelector("#term .term-viz"); if (v) setTimeout(() => v.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
});

// ---------------- a live ROS 2 system through rosbridge (its own RViz and slider windows)
let live = null;   // { viewer, jsp }
const out = $("out"), desk = $("desk");
const say = (t, err = false) => { out.hidden = false; out.className = `rvb-out${err ? " err" : ""}`; out.textContent = t; };
let rb = null, topics = [], model = null;
async function ensureLive() {
  if (live) return live;
  const [{ createRviz }, { createJspWindow }] = await Promise.all([import("./rviz.js"), import("./jsp-window.js")]);
  desk.hidden = false;
  const holder = document.createElement("div"); desk.append(holder);
  const viewer = createRviz(holder, {
    fixedFrame: "base_link", displays: { Grid: true, RobotModel: true, TF: true }, resolve: () => null, topics: () => topics, title: "", externalTf: true, plugins: () => ["rviz_imu_plugin"],
    onSave: (path) => say(`${path} is kept in this page only: ROS2Lab does not download files to your device.`),
    onOpenConfig: () => { const i = document.createElement("input"); i.type = "file"; i.accept = ".rviz,.yaml"; i.onchange = async () => { const f = i.files[0]; if (f) viewer.loadConfig(await f.text(), f.name); }; i.click(); },
    onPublish: (topic, type, msg) => { if (rb) { rb.publish(topic, type, msg); say(`Published a ${type} on ${topic} through rosbridge.`); } },
  });
  const jsp = createJspWindow(desk, { title: "Joint State Publisher", onChange: (v) => { if (rb && $("pubjs").checked) publishJointStates(v); } });
  live = { viewer, jsp };
  return live;
}
const tfEdges = new Map(); let tfPending = false, sensors = {}, topicTimer = null;
function onTF(msg, isStatic) {
  for (const tr of msg.transforms || []) {
    const t = tr.transform.translation, q = tr.transform.rotation, parent = tr.header.frame_id.replace(/^\//, ""), child = tr.child_frame_id.replace(/^\//, "");
    tfEdges.set(child, { parent, child, t: [t.x, t.y, t.z], q: [q.x, q.y, q.z, q.w], static: isStatic });
  }
  if (!tfPending && live) { tfPending = true; requestAnimationFrame(() => { tfPending = false; live.viewer.setExtraEdges([...tfEdges.values()]); }); }
}
function onDescription(text) {
  try { const m = parseURDF(text); model = m; live.viewer.setModel(m); live.jsp.setModel(m); if (!tfEdges.size) live.viewer.setFixedFrame(m.root); say(`Received robot_description: ${m.name} (${Object.keys(m.links).length} links, ${Object.keys(m.joints).length} joints).`); }
  catch (e) { say(`robot_description could not be read: ${e.message}`, true); }
}
function publishJointStates(v) {
  const t = Date.now() / 1000;
  rb.publish("/joint_states", "sensor_msgs/msg/JointState", { header: { stamp: { sec: Math.floor(t), nanosec: Math.floor((t % 1) * 1e9) }, frame_id: "" }, name: Object.keys(v), position: Object.values(v).map(Number), velocity: [], effort: [] });
}
function disconnect() {
  if (rb) { rb.onclose = null; rb.close(); rb = null; }
  clearInterval(topicTimer); tfEdges.clear(); sensors = {}; topics = [];
  if (live) { live.viewer.setExtraEdges([]); live.viewer.setSensors({}); live.viewer.setMarkers([]); live.viewer.update({ topicData: new Map() }); }
  $("connect").textContent = "Connect";
}
// ---------------- the hardware license (real robots only; simulation needs none)
licenseStatus().then(paintLicense);
function paintLicense(st) {
  const box = $("hwlic"); if (!box) return;
  const ok = licensed(st);
  box.className = `notice ${ok ? "ok" : ""}`;
  box.replaceChildren();
  const p = document.createElement("p"); p.style.margin = "0 0 6px";
  p.textContent = ok ? `Hardware license active${st.admin ? " (instructor)" : ""}: ${(st.robots || []).join(", ")}${st.validUntil ? `, until ${new Date(st.validUntil).toLocaleDateString()}` : ""}.` : licenseMessage(st);
  box.append(p);
  if (!ok && ["none", "rejected", "expired", "revoked"].includes(st.status)) {
    const robot = document.createElement("input"); robot.value = current && current.robotId ? current.robotId : ROBOT && ROBOT !== "own" ? ROBOT : ""; robot.size = 14; robot.setAttribute("aria-label", "Robot id");
    const why = document.createElement("textarea"); why.rows = 2; why.style.width = "100%"; why.placeholder = "Which robot (model, serial if known), where it is, and what you will do with it"; why.setAttribute("aria-label", "Purpose");
    const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-small"; b.textContent = "Ask for a hardware license";
    b.onclick = async () => { b.disabled = true; try { await requestLicense([robot.value.trim()], why.value.trim()); paintLicense(await licenseStatus(true)); } catch (e) { b.disabled = false; p.textContent = String(e.message || e).replace(/^.*?:\s*/, ""); } };
    const row = document.createElement("div"); row.className = "rvp-row"; row.append("Robot: ", robot, b);
    box.append(why, row);
  }
}
$("connect").addEventListener("click", async () => {
  if (rb) { disconnect(); say("Disconnected."); return; }
  const st = await licenseStatus(true); paintLicense(st);
  if (!licensed(st)) { say(`${licenseMessage(st)} (Simulation in the terminal above needs no license.)`, true); return; }
  const url = $("url").value.trim();
  say(`Connecting to ${url} …`);
  try {
    const c = new Rosbridge(url); await c.connect();
    await ensureLive();
    rb = c; $("connect").textContent = "Disconnect";
    rb.onclose = () => { say("The connection to rosbridge closed.", true); rb = null; $("connect").textContent = "Connect"; };
    live.viewer.setExternalTf(true); live.viewer.setModel(null); model = null;
    rb.subscribe("/tf", "tf2_msgs/msg/TFMessage", (m) => onTF(m, false));
    rb.subscribe("/tf_static", "tf2_msgs/msg/TFMessage", (m) => onTF(m, true));
    rb.subscribe("/robot_description", "std_msgs/msg/String", (m) => onDescription(m.data));
    rb.subscribe("/visualization_marker", "visualization_msgs/msg/Marker", (m) => live.viewer.addMarkers([{ ...m, __topic: "/visualization_marker" }]));
    rb.subscribe("/visualization_marker_array", "visualization_msgs/msg/MarkerArray", (m) => live.viewer.addMarkers((m.markers || []).map((x) => ({ ...x, __topic: "/visualization_marker_array" }))));
    // every display's topic (and a camera's camera_info), subscribed like RViz does when a display is added
    const liveData = new Map(), counts = new Map(), started = performance.now();
    const follow = () => {
      if (!rb || !live) return;
      const want = live.viewer.subscriptions().filter(([, t]) => LIVE_TYPES.includes(t));
      for (const [topic, type] of want) {
        const extra = type === "sensor_msgs/msg/Image" ? [[topic.replace(/\/[^/]*$/, "") + "/camera_info", "sensor_msgs/msg/CameraInfo"]] : [];
        for (const [tp, ty] of [[topic, type], ...extra]) {
          if (rb.subs.has(tp)) continue;
          rb.subscribe(tp, ty, (m) => { const d = convert(ty, m); if (!d) return; const n = (counts.get(tp) || 0) + 1; counts.set(tp, n); liveData.set(tp, { ...d, type: ty, count: n, rate: n / ((performance.now() - started) / 1000) }); }, THROTTLE[ty] ? { throttle_rate: THROTTLE[ty] } : {});
        }
      }
    };
    follow();
    const liveTimer = setInterval(() => { if (!rb) { clearInterval(liveTimer); return; } follow(); live.viewer.update({ topicData: liveData }); }, 200);
    // robot_description is also a parameter of robot_state_publisher (works even if the topic message was missed)
    rb.call("/robot_state_publisher/get_parameters", "rcl_interfaces/srv/GetParameters", { names: ["robot_description"] }).then((v) => { const s = v && v.values && v.values[0] && v.values[0].string_value; if (s && !model) onDescription(s); }).catch(() => {});
    const loadTopics = () => rb && rb.call("/rosapi/topics", "rosapi_msgs/srv/Topics").then((v) => { topics = (v.topics || []).map((n, i) => ({ name: n, type: (v.types || [])[i] || "" })); if (live) live.viewer.setExtraEdges([...tfEdges.values()]); }).catch(() => {});
    loadTopics(); topicTimer = setInterval(loadTopics, 5000);
    live.viewer.setTitle(url);
    say(`Connected to ${url}. Waiting for /robot_description and /tf … (launch your robot on Ubuntu if nothing appears)`);
  } catch (e) {
    say(`Could not connect to ${url}: ${e.message}.\nOn Ubuntu, run: ros2 launch rosbridge_server rosbridge_websocket_launch.xml\nThen open this page on the same computer (the address must be localhost).`, true);
  }
});
