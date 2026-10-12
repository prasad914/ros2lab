// Browser test of the ROS 2 launch runtime (public/js/launch-runtime.js + launch-worker.js + ros/launch-runtime/py.zip).
// Real Jazzy launch files run in Chromium; Pyodide is served from a local copy (PYODIDE_DIR) in place of jsdelivr and
// every site response gets the CSP of firebase.json, so the test also proves the runtime works under the site's CSP.
//
//   node tests/launch-runtime.mjs            (needs the static server on :8080, see V23 notes)
//   ONLY=tb3,nav2 node tests/launch-runtime.mjs
//
// Sources: R2L_UP (default /home/claude/v23/up: launch, ros_gz, turtlebot3*) and R2L_EXTRA (navigation2, moveit2,
// launch_param_builder, Universal_Robots_ROS2_Description/_Driver; cloned there if missing).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import os from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = process.env.SITE || "http://localhost:8080";
const PYO = process.env.PYODIDE_DIR || "/tmp/claude-0/pyo/pyodide";
const UP = process.env.R2L_UP || "/home/claude/v23/up";
const EXTRA = process.env.R2L_EXTRA || join(os.tmpdir(), "r2l-launch-test-src");
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const CSP = JSON.parse(readFileSync(join(ROOT, "firebase.json"), "utf8")).hosting.headers
  .find((h) => h.source === "**").headers.find((h) => h.key === "Content-Security-Policy").value;

// ------------------------------------------------------------------------------------------- sources
const REPOS = {
  navigation2: { url: "https://github.com/ros-navigation/navigation2", branch: "jazzy", sparse: ["nav2_bringup", "nav2_common"] },
  moveit2: { url: "https://github.com/moveit/moveit2", branch: "jazzy", sparse: ["moveit_configs_utils"] },
  launch_param_builder: { url: "https://github.com/PickNikRobotics/launch_param_builder", branch: "main" },
  Universal_Robots_ROS2_Description: { url: "https://github.com/UniversalRobots/Universal_Robots_ROS2_Description", branch: "jazzy" },
  Universal_Robots_ROS2_Driver: { url: "https://github.com/UniversalRobots/Universal_Robots_ROS2_Driver", branch: "jazzy", sparse: ["ur_moveit_config", "ur_robot_driver"] },
};
function repo(name) {
  const dir = join(EXTRA, name);
  if (!existsSync(join(dir, ".git"))) {
    const r = REPOS[name];
    console.log(`cloning ${r.url} (${r.branch}) into ${dir}`);
    execFileSync("git", ["clone", "-q", "--depth", "1", ...(r.sparse ? ["--filter=blob:none", "--sparse"] : []), "-b", r.branch, r.url, dir]);
    if (r.sparse) execFileSync("git", ["-C", dir, "sparse-checkout", "set", ...r.sparse]);
  }
  return dir;
}

const BINARY = /\.(dae|stl|obj|png|jpe?g|pgm|gif|bmp|tif|STL|DAE|glb|gltf|ttf|pdf|zip|so|a)$/;
function treeFiles(dir, prefixInPkg = "", { skipDirs = ["test", ".git", "__pycache__", "doc", "docs", "src", "include"] } = {}) {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) { if (!skipDirs.includes(n)) walk(p); continue; }
      if (BINARY.test(n) || st.size > 3e6) continue;
      let rel = prefixInPkg + relative(dir, p);
      let text = readFileSync(p, "utf8");
      if (rel.endsWith(".launch.py.in")) { rel = rel.slice(0, -3); text = text.replace(/@GZ_SIM_VER@/g, "8"); }  // CMake configure_file
      out.push([rel, text]);
    }
  };
  walk(dir);
  return out;
}
const pkgShare = (name, dir) => treeFiles(dir, `share/${name}/`);
const pyModule = (mod, dir) => treeFiles(dir, `python/${mod}/`, { skipDirs: ["__pycache__", "test"] });

// fixture package r2l_test (installed in a colcon workspace overlay)
const FIX = {
  "share/r2l_test/package.xml": `<?xml version="1.0"?>\n<package format="3"><name>r2l_test</name><version>0.0.1</version><description>launch runtime fixtures</description><maintainer email="info@ros2lab.com">ROS2Lab</maintainer><license>Apache-2.0</license></package>\n`,
  "share/r2l_test/launch/talk.launch.xml": `<launch>
  <arg name="ns" default="demo" description="namespace for the talker"/>
  <arg name="rate"/>
  <set_env name="R2L_XML_ENV" value="xml-$(var ns)"/>
  <group>
    <push_ros_namespace namespace="$(var ns)"/>
    <set_remap from="chatter" to="chat2"/>
    <node pkg="demo_nodes_cpp" exec="talker" name="talker" output="screen">
      <param name="rate" value="$(var rate)"/>
      <remap from="a" to="b"/>
    </node>
  </group>
  <include file="$(find-pkg-share r2l_test)/launch/listen.launch.yaml"/>
</launch>
`,
  "share/r2l_test/launch/listen.launch.yaml": `launch:
- arg: {name: who, default: "yaml"}
- node: {pkg: demo_nodes_cpp, exec: listener, name: "listener_$(var who)", param: [{name: x, value: 3.5}]}
`,
  "share/r2l_test/urdf/bot.urdf.xacro": `<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="bot">
  <xacro:arg name="prefix" default=""/>
  <xacro:property name="r" value="0.1"/>
  <xacro:include filename="$(find r2l_test)/urdf/part.xacro"/>
  <link name="$(arg prefix)base"><visual><geometry><cylinder radius="\${r*2}" length="0.1"/></geometry></visual></link>
  <xacro:wheel name="left"/>
</robot>
`,
  "share/r2l_test/urdf/part.xacro": `<?xml version="1.0"?>
<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:macro name="wheel" params="name"><link name="\${name}_wheel"/></xacro:macro></robot>
`,
  "share/r2l_test/launch/chain.launch.py": `from launch import LaunchDescription
from launch.actions import ExecuteProcess, RegisterEventHandler, TimerAction, LogInfo, SetEnvironmentVariable, AppendEnvironmentVariable, OpaqueFunction
from launch.event_handlers import OnProcessExit, OnProcessStart
from launch.substitutions import Command, FindExecutable, PathJoinSubstitution, PythonExpression, EqualsSubstitution
from launch.conditions import IfCondition, UnlessCondition
from launch_ros.actions import Node, SetParameter
from launch_ros.substitutions import FindPackageShare
from launch_ros.parameter_descriptions import ParameterValue

def generate_launch_description():
    xacro_file = PathJoinSubstitution([FindPackageShare("r2l_test"), "urdf", "bot.urdf.xacro"])
    desc = ParameterValue(Command([PathJoinSubstitution([FindExecutable(name="xacro")]), " ", xacro_file, " prefix:=r2l_"]), value_type=str)
    rsp = Node(package="robot_state_publisher", executable="robot_state_publisher", parameters=[{"robot_description": desc}], output="screen")
    create = Node(package="ros_gz_sim", executable="create", arguments=["-topic", "robot_description", "-name", "bot"], output="screen")
    spawner = Node(package="controller_manager", executable="spawner", arguments=["joint_state_broadcaster"])
    return LaunchDescription([
        SetEnvironmentVariable("R2L_A", "1"),
        AppendEnvironmentVariable("GZ_SIM_RESOURCE_PATH", "/opt/r2l/models"),
        SetParameter(name="use_sim_time", value=True),
        rsp, create,
        RegisterEventHandler(OnProcessExit(target_action=create, on_exit=[LogInfo(msg="create exited"), spawner])),
        RegisterEventHandler(OnProcessStart(target_action=rsp, on_start=[LogInfo(msg="rsp started")])),
        TimerAction(period=0.5, actions=[LogInfo(msg=PythonExpression(["'timer ' + str(", "1+1", ")"]))]),
        LogInfo(msg="eq", condition=IfCondition(EqualsSubstitution("a", "a"))),
        LogInfo(msg="never", condition=UnlessCondition("true")),
        OpaqueFunction(function=lambda ctx: [LogInfo(msg="opaque " + ctx.environment.get("R2L_A", "?"))]),
    ])
`,
  "share/r2l_test/launch/errors.launch.py": `from launch import LaunchDescription
from launch.actions import ExecuteProcess, LogInfo
from launch.substitutions import Command
def generate_launch_description():
    return LaunchDescription([ExecuteProcess(cmd=["no_such_program", "--x"], output="screen")])
`,
  "share/r2l_test/launch/cmd_fail.launch.py": `from launch import LaunchDescription
from launch.actions import LogInfo
from launch.substitutions import Command
def generate_launch_description():
    return LaunchDescription([LogInfo(msg=Command("some_tool --version"))])
`,
  "share/r2l_test/launch/comp.launch.py": `from launch import LaunchDescription
from launch_ros.actions import ComposableNodeContainer, LoadComposableNodes, LifecycleNode
from launch_ros.descriptions import ComposableNode
from launch_ros.event_handlers import OnStateTransition
from launch.actions import RegisterEventHandler, LogInfo
def generate_launch_description():
    c = ComposableNodeContainer(name="my_container", namespace="", package="rclcpp_components", executable="component_container",
        composable_node_descriptions=[ComposableNode(package="composition", plugin="composition::Talker", name="talker", parameters=[{"a": 1}], remappings=[("chatter", "c2")])], output="screen")
    load = LoadComposableNodes(target_container="my_container", composable_node_descriptions=[ComposableNode(package="composition", plugin="composition::Listener", name="listener", namespace="ns1")])
    lc = LifecycleNode(package="lifecycle", executable="lifecycle_talker", name="lc_talker", namespace="", autostart=True, output="screen")
    on_active = RegisterEventHandler(OnStateTransition(target_lifecycle_node=lc, goal_state="active", entities=[LogInfo(msg="lc_talker is active")]))
    return LaunchDescription([c, load, on_active, lc])
`,
};

// ------------------------------------------------------------------------------------------- harness
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : "\n      " + String(detail).slice(0, 1500).replace(/\n/g, "\n      ")}`); };
const want = (k) => !ONLY || ONLY.has(k);

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route("https://cdn.jsdelivr.net/npm/pyodide@314.0.7/**", (r) => {
  const p = join(PYO, new URL(r.request().url()).pathname.split("/").pop());
  if (!existsSync(p)) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ body: readFileSync(p), headers: { "access-control-allow-origin": "*", "content-type":
    p.endsWith(".wasm") ? "application/wasm" : /\.m?js$/.test(p) ? "text/javascript" : p.endsWith(".json") ? "application/json" : "application/octet-stream" } });
});
await ctx.route(`${SITE}/**`, async (r) => {   // the site's security headers, as firebase.json serves them
  const res = await r.fetch();
  return r.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": CSP, "cross-origin-opener-policy": "same-origin" } });
});
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|ERR_NAME|net::ERR/.test(m.text())) pageErrors.push(m.text()); if (process.env.DEBUG) console.log("[page]", m.text().slice(0, 400)); });
await page.goto(`${SITE}/404.html`);

// boot
const boot = await page.evaluate(async () => {
  const t0 = performance.now();
  const statuses = [];
  const mod = await import("/js/launch-runtime.js");
  window.rt = await mod.getLaunchRuntime({ onStatus: (s) => statuses.push(s.text) });
  return { ms: Math.round(performance.now() - t0), statuses: [...new Set(statuses)], stats: window.rt.stats, timings: window.rt.slots[0].timings };
});
console.log("first load:", boot.ms, "ms", JSON.stringify(boot.timings), "\nstatus:", boot.statuses.join(" | "));
check("boot: runtime loads under the site CSP", boot.ms > 0 && boot.stats.zipBytes > 0, JSON.stringify(boot));
check("boot: status reports '… N MB'", boot.statuses.some((s) => /Loading the ROS 2 launch system… \d+ MB/.test(s)), boot.statuses.join("\n"));

// in-page helper: run a launch with a scripted host
await page.evaluate(() => {
  window.runLaunch = (argv, o = {}) => new Promise((resolve) => {
    const out = [], procs = [], signals = [], loads = [], lifecycles = [], exits = [];
    const t0 = performance.now();
    let job;
    const exe = (info) => info.cmd.join(" ");
    const policy = o.signals;
    job = window.rt.launch(argv, {
      env: o.env, cwd: o.cwd, pid: o.pid,
      onOutput: (t, s) => out.push((s === "err" ? "E| " : "") + t),
      onProcess: (info) => {
        procs.push(info);
        for (const [k, ms] of Object.entries(o.exitAfter || {})) if (exe(info).includes(k)) setTimeout(() => job.exit(info.pid, 0), ms);
        for (const [k, text] of Object.entries(o.print || {})) if (exe(info).includes(k)) setTimeout(() => job.write(info.pid, text), 50);
      },
      onSignal: policy ? (pid, sig) => {
        signals.push([pid, sig]);
        const info = procs.find((p) => p.pid === pid);
        const cmd = info ? exe(info) : "";
        if (sig === 2 && !(policy.ignoreInt || []).some((k) => cmd.includes(k))) {
          const rc = Object.entries(policy.rc || {}).find(([k]) => cmd.includes(k))?.[1] ?? 0;
          setTimeout(() => job.exit(pid, rc), 30);
        }
        if (sig === 15 && !(policy.ignoreTerm || []).some((k) => cmd.includes(k))) setTimeout(() => job.exit(pid, -15), 30);
      } : undefined,
      onLoadComposable: (req) => { loads.push(req); return o.loadFail && req.nodes[0].name === o.loadFail ? { success: false, error_message: "plugin not found" } : undefined; },
      onLifecycle: (req) => { lifecycles.push(req); },
      onExit: (pid, rc) => exits.push([pid, rc]),
    });
    if (o.ctrlcAfter != null) setTimeout(() => job.ctrlC(), o.ctrlcAfter);
    job.done.then((code) => resolve({ code, out: out.join(""), procs, signals, loads, lifecycles, exits, ms: Math.round(performance.now() - t0), pid: job.pid }));
  });
});
const runLaunch = (argv, o) => page.evaluate(([a, b]) => window.runLaunch(a, b), [argv, o]);

// ------------------------------------------------------------------------------------------- mounts
const tMount = Date.now();
const jazzy = [
  ...pkgShare("turtlebot3_gazebo", join(UP, "turtlebot3_simulations/turtlebot3_gazebo")),
  ...pkgShare("turtlebot3_description", join(UP, "turtlebot3/turtlebot3_description")),
  ...pkgShare("ros_gz_sim", join(UP, "ros_gz/ros_gz_sim")),
  ...pkgShare("ros_gz_bridge", join(UP, "ros_gz/ros_gz_bridge")),
  ...pkgShare("ros_gz_image", join(UP, "ros_gz/ros_gz_image")),
  ...pyModule("ros_gz_sim", join(UP, "ros_gz/ros_gz_sim/ros_gz_sim")),
];
const EXES = {
  turtlebot3_gazebo: [], turtlebot3_description: [], ros_gz_sim: ["create", "gzserver", "remove"], ros_gz_bridge: ["parameter_bridge"],
  ros_gz_image: ["image_bridge"], robot_state_publisher: ["robot_state_publisher"], controller_manager: ["spawner", "ros2_control_node"],
  rclcpp_components: ["component_container", "component_container_isolated", "component_container_mt"], composition: [],
  demo_nodes_cpp: ["talker", "listener"], lifecycle: ["lifecycle_talker"], rviz2: ["rviz2"], tf2_ros: ["static_transform_publisher"],
  nav2_amcl: ["amcl"], nav2_behaviors: ["behavior_server"], nav2_bt_navigator: ["bt_navigator"], nav2_collision_monitor: ["collision_monitor"],
  nav2_controller: ["controller_server"], nav2_lifecycle_manager: ["lifecycle_manager"], nav2_map_server: ["map_server", "map_saver_server", "map_saver_cli"],
  nav2_planner: ["planner_server"], nav2_route: ["route_server"], nav2_smoother: ["smoother_server"], nav2_velocity_smoother: ["velocity_smoother"],
  nav2_waypoint_follower: ["waypoint_follower"], opennav_docking: ["opennav_docking"], nav2_bringup: [], nav2_common: [],
  moveit_configs_utils: [], moveit_ros_move_group: ["move_group"], moveit_servo: ["servo_node"], ur_description: [], ur_moveit_config: [],
  ur_robot_driver: ["wait_for_robot_description", "ur_ros2_control_node"],
};
let extraOk = true;
try {
  const nav2 = repo("navigation2"), moveit = repo("moveit2"), lpb = repo("launch_param_builder");
  const urd = repo("Universal_Robots_ROS2_Description"), urdrv = repo("Universal_Robots_ROS2_Driver");
  jazzy.push(...pkgShare("nav2_bringup", join(nav2, "nav2_bringup")), ...pyModule("nav2_common", join(nav2, "nav2_common/nav2_common")),
    ...pkgShare("nav2_common", join(nav2, "nav2_common")),
    ...pkgShare("moveit_configs_utils", join(moveit, "moveit_configs_utils")), ...pyModule("moveit_configs_utils", join(moveit, "moveit_configs_utils/moveit_configs_utils")),
    ...pyModule("launch_param_builder", join(lpb, "launch_param_builder")),
    ...pkgShare("ur_description", urd), ...pkgShare("ur_moveit_config", join(urdrv, "ur_moveit_config")), ...pkgShare("ur_robot_driver", join(urdrv, "ur_robot_driver")));
} catch (e) { extraOk = false; console.log("extra repos unavailable:", e.message); }
const mountInfo = await page.evaluate(async ([files, exes, fix]) => {
  const t0 = performance.now();
  await window.rt.mount("/opt/ros/jazzy", files);
  const pk = Object.fromEntries(Object.entries(exes).map(([k, v]) => [k, { exes: v }]));
  await window.rt.registerPackages("/opt/ros/jazzy", pk);
  await window.rt.mount("/home/student/ros2_ws/install/r2l_test", Object.entries(fix));
  await window.rt.registerPackages("/home/student/ros2_ws/install/r2l_test", { r2l_test: { exes: [] } });
  return { ms: Math.round(performance.now() - t0) };
}, [jazzy, EXES, FIX]);
console.log(`mounted ${jazzy.length} files (${(JSON.stringify(jazzy).length / 1048576).toFixed(1)} MB) in ${mountInfo.ms} ms (node side ${Date.now() - tMount} ms)`);
const ENV = { TURTLEBOT3_MODEL: "burger", AMENT_PREFIX_PATH: "/home/student/ros2_ws/install/r2l_test:/opt/ros/jazzy" };

// ------------------------------------------------------------------------------------------- cases
if (want("tb3")) {
  const r = await runLaunch(["turtlebot3_gazebo", "turtlebot3_world.launch.py"], { env: ENV, exitAfter: { "ros_gz_sim/create": 400 }, ctrlcAfter: 2500 });
  console.log("---- tb3 world output ----\n" + r.out);
  const lines = r.out.split("\n");
  check("tb3: log dir + verbosity lines", /^\[INFO\] \[launch\]: All log files can be found below \/home\/student\/\.ros\/log\/\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d-\d+-ros2lab-\d+$/.test(lines[0]) && lines[1] === "[INFO] [launch]: Default logging verbosity is set to INFO", lines.slice(0, 2).join("\n"));
  const order = ["gazebo-1", "gazebo-2", "create-3", "parameter_bridge-4", "robot_state_publisher-5"];
  check("tb3: processes start in launch order with consecutive pids",
    order.every((n, i) => lines.some((l) => l === `[INFO] [${n}]: process started with pid [${r.pid + 1 + i}]`)), r.out);
  const create = r.procs.find((p) => p.name === "create-3");
  check("tb3: create exits -> 'process has finished cleanly'", create && r.out.includes(`[INFO] [create-3]: process has finished cleanly [pid ${create.pid}]`));
  const gz = r.procs.find((p) => p.name === "gazebo-1");
  check("tb3: gz sim server cmd (ruby gz sim -r -s -v2 world)", gz && /^ruby \/usr\/bin\/gz sim -r -s -v2 \/opt\/ros\/jazzy\/share\/turtlebot3_gazebo\/worlds\/turtlebot3_world\.world/.test(gz.cmd.join(" ")) && gz.shell, gz && gz.cmd.join(" "));
  check("tb3: GZ_SIM_RESOURCE_PATH reaches gz sim env", gz && /turtlebot3_gazebo|\/opt\/ros\/jazzy\/share/.test(gz.env.GZ_SIM_RESOURCE_PATH || ""), gz && gz.env.GZ_SIM_RESOURCE_PATH);
  const create3 = create && create.cmd.join(" ");
  check("tb3: spawn cmd args (-name burger -file model.sdf -x -2.0 -y -0.5)", create3 && create3.includes("-name burger -file /opt/ros/jazzy/share/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf -x -2.0 -y -0.5 -z 0.01"), create3);
  const rsp = r.procs.find((p) => p.name === "robot_state_publisher-5");
  const pf = rsp && Object.values(rsp.files).join("\n");
  check("tb3: robot_state_publisher params file has robot_description + use_sim_time", pf && pf.includes("robot_description:") && /use_sim_time: true/.test(pf), pf && pf.slice(0, 300));
  check("tb3: TURTLEBOT3_MODEL from the terminal env", rsp && rsp.env.TURTLEBOT3_MODEL === "burger" && r.out.includes("urdf_file_name : turtlebot3_burger.urdf"));
  const tail = lines.slice(lines.findIndex((l) => l.includes("user interrupted")));
  check("tb3: Ctrl+C sequence", tail[0] === "[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)" &&
    ["gazebo-1", "gazebo-2", "parameter_bridge-4", "robot_state_publisher-5"].every((n) => tail.some((l) => l.startsWith(`[INFO] [${n}]: process has finished cleanly`))) && r.code === 0, tail.join("\n") + "\ncode " + r.code);
  check("tb3: onExit for every process (create rc 0, others rc 0 after Ctrl+C)", r.exits.length === 5 && r.exits.every(([, rc]) => rc === 0) && r.exits[0][0] === create.pid, JSON.stringify(r.exits));
  console.log(`tb3 launch: ${r.ms} ms (incl. 2.5 s before Ctrl+C)`);
}

if (want("signals")) {
  // host-controlled exits: gz returns -2 on SIGINT, robot_state_publisher ignores SIGINT and SIGTERM -> SIGKILL
  const r = await runLaunch(["turtlebot3_gazebo", "turtlebot3_world.launch.py"], { env: ENV, exitAfter: { "ros_gz_sim/create": 300 }, ctrlcAfter: 1200,
    signals: { rc: { "gz sim": -2 }, ignoreInt: ["robot_state_publisher"], ignoreTerm: ["robot_state_publisher"] } });
  const out = r.out;
  console.log("---- escalation output (tail) ----\n" + out.split("\n").slice(-10).join("\n"));
  const rsp = r.procs.find((p) => p.name === "robot_state_publisher-5");
  check("signals: host gets SIGINT for every running process", r.signals.filter(([, s]) => s === 2).length >= 4, JSON.stringify(r.signals));
  check("signals: exit code -2 -> 'process has died'", /\[ERROR\] \[gazebo-1\]: process has died \[pid \d+, exit code -2, cmd 'ruby \/usr\/bin\/gz sim -r -s -v2 /.test(out), out);
  check("signals: SIGINT -> SIGTERM escalation after 5 s", out.includes("[ERROR] [robot_state_publisher-5]: process[robot_state_publisher-5] failed to terminate '5' seconds after receiving 'SIGINT', escalating to 'SIGTERM'\n[INFO] [robot_state_publisher-5]: sending signal 'SIGTERM' to process[robot_state_publisher-5]"), out);
  check("signals: onExit reports -9 for the killed process", r.exits.some(([p, rc]) => p === (rsp && rsp.pid) && rc === -9), JSON.stringify(r.exits));
  check("signals: SIGTERM -> SIGKILL escalation", out.includes("[ERROR] [robot_state_publisher-5]: process[robot_state_publisher-5] failed to terminate '10.0' seconds after receiving 'SIGTERM', escalating to 'SIGKILL'\n[INFO] [robot_state_publisher-5]: sending signal 'SIGKILL' to process[robot_state_publisher-5]") &&
    out.includes(`[ERROR] [robot_state_publisher-5]: process has died [pid ${rsp && rsp.pid}, exit code -9`), out);
}

if (want("cli")) {
  const sa = await page.evaluate(([env]) => window.rt.run(["ros2", "launch", "turtlebot3_gazebo", "turtlebot3_world.launch.py", "--show-args"], { env }), [ENV]);
  const expected = "\n    'x_pose':\n        Specify namespace of the robot\n        (default: '0.0')\n\n    'y_pose':\n        Specify namespace of the robot\n        (default: '0.0')\n\n    'use_sim_time':\n        Use simulation (Gazebo) clock if true\n        (default: 'false')\n";
  // the real -s also lists the arguments declared by included launch files (gz_sim.launch.py) and shows what the
  // launch files print while being loaded (robot_state_publisher.launch.py prints urdf_file_name)
  check("cli: ros2 launch -s (exact format)", sa.code === 0 && sa.stdout.startsWith("Arguments (pass arguments as '<name>:=<value>'):\nurdf_file_name : turtlebot3_burger.urdf\n\n    'gz_args':\n        Arguments to be passed to Gazebo Sim\n        (default: '')\n") && sa.stdout.endsWith(expected), JSON.stringify(sa).slice(0, 2000));
  const sx = await page.evaluate(([env]) => window.rt.run(["ros2", "launch", "r2l_test", "talk.launch.xml", "-s"], { env }), [ENV]);
  check("cli: -s on an XML launch file", sx.code === 0 && sx.stdout.includes("    'ns':\n        namespace for the talker\n        (default: 'demo')") && sx.stdout.includes("    'rate':\n        no description given\n"), sx.stdout);
  const np = await runLaunch(["no_such_pkg", "x.launch.py"], { env: ENV });
  check("cli: unknown package error", np.code === 1 && np.out.trim() === `E| Package 'no_such_pkg' not found: "package 'no_such_pkg' not found, searching: ['/home/student/ros2_ws/install/r2l_test', '/opt/ros/jazzy']"`, np.out);
  const nf = await runLaunch(["turtlebot3_gazebo", "nope.launch.py"], { env: ENV });
  check("cli: unknown launch file error", nf.code === 1 && nf.out.trim() === "E| file 'nope.launch.py' was not found in the share directory of package 'turtlebot3_gazebo' which is at '/opt/ros/jazzy/share/turtlebot3_gazebo'", nf.out);
  const ma = await runLaunch(["r2l_test", "talk.launch.xml"], { env: ENV });
  check("cli: missing required argument", ma.code === 1 && ma.out.includes("[ERROR] [launch]: Caught exception in launch (see debug for traceback): Included launch description missing required argument 'rate' (description: 'no description given'), given: []"), ma.out);
  const bad = await runLaunch(["r2l_test", "talk.launch.xml", "rate"], { env: ENV });
  check("cli: malformed launch argument", bad.code === 1 && bad.out.includes("malformed launch argument 'rate', expected format '<name>:=<value>'"), bad.out);
  const us = await runLaunch(["ros2", "launch"], { env: ENV });
  check("cli: argparse usage error (exit 2)", us.code === 2 && us.out.includes("ros2 launch: error: the following arguments are required: package_name"), us.out);
  const pp = await page.evaluate(([env]) => window.rt.run(["ros2", "pkg", "prefix", "r2l_test"], { env }), [ENV]);
  check("cli: ros2 pkg prefix (overlay workspace)", pp.code === 0 && pp.stdout.trim() === "/home/student/ros2_ws/install/r2l_test", JSON.stringify(pp));
  const pe = await page.evaluate(([env]) => window.rt.run(["ros2", "pkg", "executables", "ros_gz_sim"], { env }), [ENV]);
  check("cli: ros2 pkg executables", pe.stdout === "ros_gz_sim create\nros_gz_sim gzserver\nros_gz_sim remove\n", JSON.stringify(pe));
  const dbg = await runLaunch(["ros2", "launch", "-d", "r2l_test", "listen.launch.yaml"], { env: ENV, ctrlcAfter: 800 });
  check("cli: ros2 launch -d (debug output)", dbg.code === 0 && dbg.out.includes("[DEBUG] [launch]: ") && dbg.out.includes("[INFO] [listener-1]: process started with pid"), dbg.out.slice(0, 1500));
  const fp = await runLaunch(["/home/student/ros2_ws/install/r2l_test/share/r2l_test/launch/listen.launch.yaml", "who:=path"], { env: ENV, ctrlcAfter: 800 });
  check("cli: ros2 launch <file path> (YAML) with args", fp.code === 0 && fp.procs.length === 1 && fp.procs[0].cmd.includes("__node:=listener_path"), fp.out);
}

if (want("xml")) {
  const r = await runLaunch(["r2l_test", "talk.launch.xml", "rate:=5", "ns:=robot1"], { env: ENV, ctrlcAfter: 1000, print: { "demo_nodes_cpp/talker": "[INFO] [1700000000.000000000] [robot1.talker]: Publishing: 'Hello World: 1'" } });
  const t = r.procs.find((p) => p.name === "talker-1");
  const cmd = t && t.cmd.join(" ");
  check("xml: node cmd with namespace, global SetRemap and remap", cmd && cmd.includes("-r __node:=talker -r __ns:=/robot1") && cmd.includes("-r chatter:=chat2") && cmd.includes("-r a:=b"), cmd);
  check("xml: param file contents sent in info.files", t && Object.values(t.files).some((v) => v === "/robot1/talker:\n  ros__parameters:\n    rate: 5\n"), t && JSON.stringify(t.files));
  check("xml: set_env reaches process env", t && t.env.R2L_XML_ENV === "xml-robot1");
  check("xml: included YAML launch file node", r.procs.some((p) => p.name === "listener-2" && p.cmd.includes("__node:=listener_yaml")), r.out);
  check("xml: process output gets the [name-N] prefix", r.out.includes("[talker-1] [INFO] [1700000000.000000000] [robot1.talker]: Publishing: 'Hello World: 1'"), r.out);
  check("xml: info.ros", t && t.ros && t.ros.package === "demo_nodes_cpp" && t.ros.executable === "talker" && t.ros.fqn === "/robot1/talker", t && JSON.stringify(t.ros));
}

if (want("xacro")) {
  const r = await runLaunch(["r2l_test", "chain.launch.py"], { env: ENV, exitAfter: { "ros_gz_sim/create": 300, spawner: 300 }, ctrlcAfter: 1800 });
  console.log("---- chain output ----\n" + r.out);
  const rsp = r.procs.find((p) => p.name.startsWith("robot_state_publisher"));
  const pf = rsp && Object.values(rsp.files).join("\n");
  check("xacro: Command(xacro) robot_description (real xacro, $(find), args)", pf && pf.includes("r2l_base") && pf.includes("left_wheel") && pf.includes('radius=\\"0.2\\"'), pf && pf.slice(0, 600));
  check("xacro: SetParameter -> -p use_sim_time:=True in cmd", rsp && rsp.cmd.join(" ").includes("--ros-args -p use_sim_time:=True"), rsp && rsp.cmd.join(" ").slice(0, 300));
  check("xacro: OnProcessExit chain (create exits -> spawner starts)", r.out.includes("[INFO] [launch.user]: create exited") && r.procs.some((p) => p.name.startsWith("spawner")) &&
    r.out.indexOf("create-2]: process has finished cleanly") < r.out.indexOf("[spawner-3]: process started"), r.out);
  check("xacro: OnProcessStart, TimerAction, PythonExpression, conditions, OpaqueFunction",
    ["rsp started", "timer 2", "eq", "opaque 1"].every((m) => r.out.includes(`[INFO] [launch.user]: ${m}\n`)) && !r.out.includes("never"), r.out);
  check("xacro: SetEnvironmentVariable / AppendEnvironmentVariable in env", rsp && rsp.env.R2L_A === "1" && (rsp.env.GZ_SIM_RESOURCE_PATH || "").endsWith("/opt/r2l/models"), rsp && JSON.stringify({ a: rsp.env.R2L_A, g: rsp.env.GZ_SIM_RESOURCE_PATH }));
  const x = await page.evaluate(([env]) => window.rt.xacro("/home/student/ros2_ws/install/r2l_test/share/r2l_test/urdf/bot.urdf.xacro", ["prefix:=a_"], { env }), [ENV]);
  check("xacro: rt.xacro()", x.urdf && x.urdf.includes('<link name="a_base">'), JSON.stringify(x).slice(0, 400));
  const xe = await page.evaluate(() => window.rt.xacro("/opt/ros/jazzy/share/nothing.urdf.xacro", []));
  check("xacro: rt.xacro() error", xe.error && /No such file or directory/.test(xe.error) && xe.code === 2, JSON.stringify(xe));
  if (extraOk) {
    const t0 = Date.now();
    const ur = await page.evaluate(() => window.rt.xacro("/opt/ros/jazzy/share/ur_description/urdf/ur.urdf.xacro", ["ur_type:=ur5e", "name:=ur"]));
    check("xacro: ur_description ur.urdf.xacro (ur5e)", ur.urdf && (ur.urdf.match(/<link /g) || []).length >= 10 && ur.urdf.includes("wrist_3_link"), JSON.stringify(ur).slice(0, 600));
    console.log(`ur5e xacro: ${Date.now() - t0} ms, ${ur.urdf ? ur.urdf.length : 0} chars`);
  }
  const ep = await runLaunch(["r2l_test", "errors.launch.py"], { env: ENV });
  check("errors: missing executable in ExecuteProcess", ep.out.includes("[ERROR] [no_such_program-1]: exception occurred while executing process:") && ep.out.includes("FileNotFoundError: [Errno 2] No such file or directory: 'no_such_program'"), ep.out);
  const cf = await runLaunch(["r2l_test", "cmd_fail.launch.py"], { env: ENV });
  check("errors: Command() with a program that cannot run", cf.code === 1 && cf.out.includes("[ERROR] [launch]: Caught exception in launch (see debug for traceback): file not found: [Errno 2] No such file or directory: 'some_tool'"), cf.out);
}

if (want("comp")) {
  const r = await runLaunch(["r2l_test", "comp.launch.py"], { env: ENV, ctrlcAfter: 2000, loadFail: "listener" });
  console.log("---- composition output ----\n" + r.out);
  check("comp: container process started", r.procs.some((p) => p.name === "component_container-1" && p.ros.container && p.ros.fqn === "/my_container"));
  check("comp: onLoadComposable gets package/plugin/name/params/remaps", r.loads.length === 2 && r.loads[0].container === "/my_container" &&
    JSON.stringify(r.loads[0].nodes[0]).includes('"package":"composition","plugin":"composition::Talker","name":"talker","namespace":"/","remappings":["chatter:=c2"],"parameters":{"a":1}'), JSON.stringify(r.loads));
  check("comp: 'Loaded node' (real message)", r.out.includes("[INFO] [launch_ros.actions.load_composable_nodes]: Loaded node '/talker' in container '/my_container'"), r.out);
  check("comp: host failure -> 'Failed to load node'", r.out.includes("[ERROR] [launch_ros.actions.load_composable_nodes]: Failed to load node 'listener' of type 'composition::Listener' in container 'my_container': plugin not found"), r.out);
  check("comp: LifecycleNode autostart -> configure + activate, OnStateTransition fires", r.lifecycles.map((l) => l.transition).join(",") === "configure,activate" && r.out.includes("[INFO] [launch.user]: lc_talker is active"), JSON.stringify(r.lifecycles) + r.out);
}

if (want("nav2") && extraOk) {
  const r = await runLaunch(["nav2_bringup", "bringup_launch.py", "map:=/opt/ros/jazzy/share/nav2_bringup/maps/tb3_sandbox.yaml", "use_sim_time:=True"], { env: ENV, ctrlcAfter: 5000 });
  console.log("---- nav2 bringup (composition) output ----\n" + r.out.split("\n").slice(0, 8).join("\n") + "\n...");
  const names = r.loads.map((l) => l.nodes[0].name);
  check("nav2: component_container_isolated nav2_container started", r.procs.length === 1 && r.procs[0].cmd.join(" ").includes("rclcpp_components/component_container_isolated") && r.procs[0].ros.fqn === "/nav2_container", r.procs.map((p) => p.cmd.join(" ")).join("\n"));
  const expectNodes = ["map_server", "amcl", "lifecycle_manager_localization", "controller_server", "smoother_server", "planner_server", "behavior_server", "bt_navigator", "waypoint_follower", "velocity_smoother", "collision_monitor", "docking_server", "lifecycle_manager_navigation"];
  check("nav2: all Nav2 servers loaded into /nav2_container", expectNodes.every((n) => names.includes(n)) && expectNodes.every((n) => r.out.includes(`Loaded node '/${n}' in container '/nav2_container'`)), names.join(","));
  const ctl = r.loads.find((l) => l.nodes[0].name === "controller_server")?.nodes[0];
  check("nav2: controller_server params from nav2_params.yaml (RewrittenYaml) + remaps", ctl && ctl.plugin === "nav2_controller::ControllerServer" && ctl.parameters.use_sim_time === true &&
    ctl.parameters.controller_frequency === 20.0 && ctl.parameters["FollowPath.plugin"] && ctl.remappings.includes("cmd_vel:=cmd_vel_nav"), JSON.stringify(ctl).slice(0, 800));
  const ms = r.loads.find((l) => l.nodes[0].name === "map_server")?.nodes[0];
  check("nav2: map_server yaml_filename from the map:= argument", ms && ms.parameters.yaml_filename === "/opt/ros/jazzy/share/nav2_bringup/maps/tb3_sandbox.yaml", JSON.stringify(ms).slice(0, 400));
  const r2 = await runLaunch(["nav2_bringup", "navigation_launch.py", "use_composition:=False"], { env: ENV, ctrlcAfter: 1500 });
  const cs = r2.procs.find((p) => p.cmd[0].endsWith("nav2_controller/controller_server"));
  check("nav2: use_composition:=False -> separate processes with params files", cs && Object.keys(cs.files).length >= 1 && Object.values(cs.files).some((t) => t.includes("controller_server:")), r2.out.slice(0, 1500));
}

if (want("moveit") && extraOk) {
  const r = await runLaunch(["ur_moveit_config", "ur_moveit.launch.py", "ur_type:=ur5e", "launch_rviz:=true"], { env: ENV, exitAfter: { wait_for_robot_description: 300 }, ctrlcAfter: 3000 });
  console.log("---- ur_moveit output ----\n" + r.out);
  const mg = r.procs.find((p) => p.cmd[0].endsWith("moveit_ros_move_group/move_group"));
  const files = mg ? Object.values(mg.files).join("\n") : "";
  check("moveit: MoveItConfigsBuilder (ur_moveit_config) -> move_group after wait_for_robot_description exits", mg && r.out.indexOf("wait_for_robot_description-1]: process has finished cleanly") < r.out.indexOf("[move_group-2]: process started"), r.out);
  check("moveit: move_group params: SRDF (xacro'd, ur5e), kinematics, planning pipelines", files.includes("robot_description_semantic") && files.includes("ur_manipulator") && files.includes("robot_description_kinematics") && files.includes("planning_pipelines"), files.slice(0, 1500));
  check("moveit: rviz2 with moveit.rviz", r.procs.some((p) => p.cmd.join(" ").includes("rviz2 -d /opt/ros/jazzy/share/ur_moveit_config/config/moveit.rviz")), r.procs.map((p) => p.cmd.join(" ")).join("\n"));
}

if (want("concurrent")) {
  const warm = await page.evaluate(async () => { const t0 = performance.now(); await window.rt.prewarm(); return Math.round(performance.now() - t0); });
  console.log(`second worker (prewarm incl. replay of all mounts): ${warm} ms`);
  const [a, b] = await page.evaluate(([env]) => Promise.all([
    window.runLaunch(["turtlebot3_gazebo", "turtlebot3_world.launch.py"], { env: { ...env, TURTLEBOT3_MODEL: "waffle" }, exitAfter: { "ros_gz_sim/create": 300 }, ctrlcAfter: 2500 }),
    window.runLaunch(["r2l_test", "talk.launch.xml", "rate:=2"], { env, ctrlcAfter: 2000 }),
  ]), [ENV]);
  const pa = a.procs.map((p) => p.pid), pb = b.procs.map((p) => p.pid);
  check("concurrent: two launches run at the same time (2 workers)", a.code === 0 && b.code === 0 && (await page.evaluate(() => window.rt.slots.length)) >= 2, `${a.code} ${b.code}`);
  check("concurrent: pids unique across jobs", pa.every((p) => !pb.includes(p)) && a.pid !== b.pid, JSON.stringify([pa, pb]));
  check("concurrent: each job has its own env and process numbering", a.procs.some((p) => p.name === "create-3" && p.env.TURTLEBOT3_MODEL === "waffle") && b.procs.some((p) => p.name === "talker-1" && !p.env.R2L_A),
    JSON.stringify([a.procs.map((p) => p.name), b.procs.map((p) => p.name)]));
  check("concurrent: waffle adds the image bridge", a.procs.some((p) => p.name === "image_bridge-5"), a.out);
}

check("no page errors", pageErrors.filter((e) => !/favicon|404/.test(e)).length === 0, pageErrors.join("\n"));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
