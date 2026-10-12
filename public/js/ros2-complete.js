// Bash Tab completion for the practice terminal, the way Ubuntu 24.04 + ROS 2 Jazzy does it:
//  - the first word completes commands on the PATH (ros2 only exists after sourcing /opt/ros/jazzy/setup.bash);
//  - `ros2 ...` arguments complete through argcomplete, which setup.bash registers
//    (share/ros2cli/environment/ros2-argcomplete.bash runs: eval "$(register-python-argcomplete3 ros2)");
//  - `colcon ...` completes when colcon-argcomplete is sourced (Ubuntu: /usr/share/colcon_argcomplete/hook/colcon-argcomplete.bash);
//  - everything else completes file and folder names (cd: folders only).
// One Tab completes the longest common prefix; a second Tab lists the candidates (see doTab in terminal-sim.js).
import { pkgExecutables } from "./ros-graph.js";
import { allIfaces, ifacePackages, normType, hasIface, protoFlow, sectionType, ifacesReady } from "./ros-iface.js";

// ros2 verbs of a Jazzy desktop install (ros2 --help), with their sub-verbs and options
const VERBS = {
  action: { info: ["-t", "--show-types", "-c", "--count"], list: ["-t", "--show-types", "-c", "--count-actions"], send_goal: ["-f", "--feedback"], type: [] },
  bag: { convert: ["-i", "--input", "-o", "--output-options"], info: ["-s", "--storage", "-v", "--verbose"], list: [], play: ["-l", "--loop", "-r", "--rate", "--topics", "-s", "--storage", "--clock", "-d", "--delay", "--start-paused", "--remap"], record: ["-a", "--all", "-o", "--output", "-s", "--storage", "--regex", "-e", "--exclude", "--max-bag-size", "--max-bag-duration", "--compression-mode", "--compression-format", "--use-sim-time", "--topics", "--services"], reindex: [] },
  component: { list: [], load: ["-n", "--node-name", "--node-namespace", "--log-level", "-r", "--remap-rule", "-p", "--parameter", "-e", "--extra-argument"], standalone: [], types: [], unload: [] },
  control: { list_controllers: ["-v", "--verbose", "-c", "--controller-manager"], list_controller_types: ["-c", "--controller-manager"], list_hardware_components: ["-v", "--verbose", "-c", "--controller-manager"], list_hardware_interfaces: ["-c", "--controller-manager"], load_controller: ["--set-state", "-c", "--controller-manager"], reload_controller_libraries: ["--force-kill", "-c", "--controller-manager"], set_controller_state: ["-c", "--controller-manager"], set_hardware_component_state: ["-c", "--controller-manager"], switch_controllers: ["--activate", "--deactivate", "--strict", "--activate-asap", "--switch-timeout", "-c", "--controller-manager"], unload_controller: ["-c", "--controller-manager"], view_controller_chains: ["-c", "--controller-manager"] },
  daemon: { start: ["--debug"], status: [], stop: [] },
  doctor: { "": ["--report", "-r", "--report-failed", "-rf", "--include-warnings", "-iw"] },
  interface: { list: ["-m", "--only-msgs", "-s", "--only-srvs", "-a", "--only-actions"], package: [], packages: ["-m", "--only-msgs", "-s", "--only-srvs", "-a", "--only-actions"], proto: ["--no-quotes"], show: ["--all-comments", "--no-comments"] },
  launch: { "": ["-n", "--noninteractive", "-d", "--debug", "-p", "--print", "--print-description", "-s", "--show-args", "--show-arguments", "-a", "--show-all-subprocesses-output", "--launch-prefix", "--launch-prefix-filter"] },
  lifecycle: { get: ["--include-hidden-nodes"], list: ["-a", "--all"], nodes: ["-a", "--all", "--include-hidden-nodes"], set: [] },
  multicast: { receive: [], send: [] },
  node: { info: ["--include-hidden", "--get-type-description"], list: ["-a", "--all", "-c", "--count-nodes"] },
  param: { delete: [], describe: [], dump: ["--include-hidden-nodes"], get: ["--hide-type", "--include-hidden-nodes"], list: ["--param-prefixes", "--param-type", "--filter"], load: ["--no-use-wildcard"], set: [] },
  pkg: { create: ["--package-format", "--description", "--license", "--destination-directory", "--build-type", "--dependencies", "--maintainer-email", "--maintainer-name", "--node-name", "--library-name"], executables: ["--full-path"], list: [], prefix: ["--share"], xml: ["-t", "--tag"] },
  run: { "": ["--prefix", "--ros-args"] },
  security: { create_enclave: [], create_keystore: [], create_permission: [], generate_artifacts: [], generate_policy: [], list_enclaves: [] },
  service: { call: ["-r", "--rate"], echo: ["--flow-style", "--no-arr", "--no-str", "--csv"], find: ["-c", "--count-services", "--include-hidden-services"], list: ["-t", "--show-types", "-c", "--count-services", "--include-hidden-services"], type: [] },
  topic: { bw: ["-w", "--window"], delay: ["-w", "--window"], echo: ["--once", "--csv", "--field", "--full-length", "-l", "--truncate-length", "--no-arr", "--no-str", "--flow-style", "--lost-messages", "--raw", "--qos-profile", "--qos-depth", "--qos-history", "--qos-reliability", "--qos-durability", "--qos-liveliness"], find: ["-c", "--count-topics", "--include-hidden-topics"], hz: ["-w", "--window", "--filter", "--wall-time"], info: ["-v", "--verbose"], list: ["-t", "--show-types", "-c", "--count-topics", "--include-hidden-topics", "-v", "--verbose"], pub: ["-r", "--rate", "-p", "--print", "-1", "--once", "-t", "--times", "-w", "--wait-matching-subscriptions", "--keep-alive", "-n", "--node-name", "--qos-profile", "--qos-depth", "--qos-history", "--qos-reliability", "--qos-durability"], type: [] },
  wtf: { "": ["--report", "-r", "--report-failed", "-rf"] },
};
const GLOBAL_FLAGS = ["-h", "--help", "--use-python-default-buffering"];
const CONTROL_STATES = ["inactive", "active"];
const QOS_VALUES = { "--qos-reliability": ["system_default", "reliable", "best_effort"], "--qos-durability": ["system_default", "transient_local", "volatile"], "--qos-history": ["system_default", "keep_last", "keep_all"], "--qos-profile": ["unknown", "system_default", "sensor_data", "services_default", "parameters", "parameter_events", "action_status_default"] };
const BUILD_TYPES = ["ament_cmake", "ament_python", "cmake"];
const LICENSES = ["Apache-2.0", "BSL-1.0", "BSD-2.0", "BSD-2-Clause", "BSD-3-Clause", "GPL-3.0-only", "LGPL-3.0-only", "MIT", "MIT-0", "TODO"];

// launch files of installed (apt) packages that this practice computer can start
export const INSTALLED_LAUNCH = {
  turtlesim: ["multisim.launch.py"],
  demo_nodes_cpp: ["talker_listener_launch.py", "talker_listener_launch.xml", "talker_listener_launch.yaml"],
  urdf_tutorial: ["display.launch.py"], urdf_launch: ["display.launch.py"],
  turtlebot3_gazebo: ["empty_world.launch.py", "turtlebot3_world.launch.py", "turtlebot3_house.launch.py"],
  turtlebot3_cartographer: ["cartographer.launch.py"], turtlebot3_bringup: ["robot.launch.py"],
  nav2_bringup: ["tb3_simulation_launch.py"], slam_toolbox: ["online_async_launch.py"],
  moveit_resources_panda_moveit_config: ["demo.launch.py"],
  gz_ros2_control_demos: ["cart_example_position.launch.py"],
  ur_robot_driver: ["ur_control.launch.py"], kortex_bringup: ["gen3.launch.py", "kortex_control.launch.py"], franka_bringup: ["franka.launch.py"],
  xarm_controller: ["xarm6_control_rviz_display.launch.py"], interbotix_xsarm_control: ["xsarm_control.launch.py"], abb_bringup: ["abb_control.launch.py"],
  kuka_rsi_driver: ["startup.launch.py"], scout_base: ["scout_base.launch.py"], spot_driver: ["spot_driver.launch.py"], crazyflie: ["launch.py"],
  rosbridge_server: ["rosbridge_websocket_launch.xml"],
};

// ---------- splitting the line the way readline / argcomplete does ----------
function splitLine(line) {
  const words = []; let cur = "", q = null, start = 0, has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === "'" || c === '"') { if (!has) start = i; q = c; has = true; continue; }
    if (c === " " || c === "\t") { if (has) words.push(cur); cur = ""; has = false; continue; }
    if (!has) start = i;
    cur += c; has = true;
  }
  return { words, cur: has ? cur : "", start: has ? start : line.length, quote: q };
}
// the command that a word belongs to: after |, &&, ;, sudo, time
function commandWords(words) {
  let i = 0;
  for (let k = 0; k < words.length; k++) if (["|", "&&", ";", "||"].includes(words[k])) i = k + 1;
  let w = words.slice(i);
  while (w.length && ["sudo", "time", "nohup"].includes(w[0])) w = w.slice(1);
  return w;
}

// ---------- the candidates for the word being typed ----------
export function candidates(sh, line) {
  const { words, cur, quote } = splitLine(line);
  const cw = commandWords(words);
  const cmd = cw[0];
  if (!cmd && !/^[./~]/.test(cur)) return { list: commandNames(sh, cur), kind: "cmd" };
  if (!cmd) return { list: fileNames(sh, cur, { exec: true }), kind: "file" };
  if (cmd === "ros2") {
    if (!sh.sourced || !sh.argcomplete) return { list: fileNames(sh, cur), kind: "file" };   // no completion registered for ros2 yet
    return { list: ros2Candidates(sh, cw.slice(1), cur), kind: "ros2", quote };
  }
  if (cmd === "colcon" && sh.colconComplete) return { list: colconCandidates(sh, cw.slice(1), cur), kind: "colcon" };
  if (cmd === "cd" || cmd === "rmdir" || cmd === "pushd") return { list: fileNames(sh, cur, { dirsOnly: true }), kind: "file" };
  if ((cmd === "apt" || cmd === "apt-get") && cw.length >= 2 && ["install", "remove", "show", "purge"].includes(cw[1])) return { list: (sh.aptNames ? sh.aptNames() : []).filter((n) => n.startsWith(cur)), kind: "word" };
  if ((cmd === "apt" || cmd === "apt-get") && cw.length === 1) return { list: ["autoremove", "full-upgrade", "install", "list", "purge", "reinstall", "remove", "search", "show", "update", "upgrade"].filter((x) => x.startsWith(cur)), kind: "word" };
  if ((cmd === "export" || cmd === "unset") && !cur.includes("=")) return { list: Object.keys(sh.env).filter((k) => k.startsWith(cur)).sort(), kind: "word" };
  if (cur.startsWith("$")) return { list: Object.keys(sh.env).filter((k) => k.startsWith(cur.slice(1))).map((k) => "$" + k).sort(), kind: "word" };
  if (cmd === "code" || cmd === "nano" || cmd === "cat" || cmd === "source" || cmd === "." || cmd === "python3" || cmd === "bash" || true) return { list: fileNames(sh, cur), kind: "file" };
  return { list: [], kind: "file" };
}

function commandNames(sh, cur) {
  const names = new Set([...sh.cmds, "cat", "ls", "cd", "echo", "grep", "which", "jobs", "fg", "kill", "bash", "printenv", "complete", "type", "alias"]);
  if (sh.sourced) for (const c of ["ros2", "rviz2", "rqt", "rqt_graph", "xacro", "check_urdf", "urdf_to_graphviz", "gz", "rosdep", "colcon", "register-python-argcomplete3", "ros2bag", "ign"]) if (sh.cmds.has(c) || c === "ros2" || c === "register-python-argcomplete3") names.add(c);
  if (!sh.sourced) { names.delete("ros2"); names.delete("rviz2"); }
  for (const a of Object.keys(sh.aliases || {})) names.add(a);
  return [...names].filter((c) => c.startsWith(cur)).sort();
}

// file and folder names (folders end with /), relative to the shell's current folder; ~ works
export function fileNames(sh, cur, { dirsOnly = false } = {}) {
  const home = sh.env.HOME || "/home/student";
  const typed = cur.replace(/^~(?=\/|$)/, home);
  const slash = typed.lastIndexOf("/");
  const dirPart = slash >= 0 ? typed.slice(0, slash + 1) : "", namePart = slash >= 0 ? typed.slice(slash + 1) : typed;
  const dir = sh.abs(dirPart || ".");
  if (!sh.isDir(dir)) return [];
  const shownDir = slash >= 0 ? cur.slice(0, cur.lastIndexOf("/") + 1) : "";
  return sh.children(dir).filter((n) => n.startsWith(namePart) && (namePart.startsWith(".") || !n.startsWith(".")))
    .map((n) => { const full = `${dir === "/" ? "" : dir}/${n}`, d = sh.isDir(full); return d ? `${shownDir}${n}/` : dirsOnly ? null : `${shownDir}${n}`; })
    .filter(Boolean);
}

// ---------- ROS 2 ----------
function allPackages(sh) { return [...new Set([...sh.rosPkgs, ...sh.visibleWs().keys()])].sort(); }
function exesOf(sh, pkg) {
  const ws = sh.visibleWs().get(pkg);
  if (ws) return Object.keys(ws.exes || {}).sort();
  return sh.rosPkgs.has(pkg) ? [...(pkgExecutables(pkg) || [])].sort() : [];
}
function launchFilesOf(sh, pkg) {
  const ws = sh.visibleWs().get(pkg);
  if (ws) return Object.keys(ws.launch || {}).map((f) => f.split("/").pop()).filter((f) => /(\.launch\.(py|xml|yaml|yml)|_launch\.(py|xml|yaml)|launch\.py)$/.test(f)).sort();
  return sh.rosPkgs.has(pkg) ? [...(INSTALLED_LAUNCH[pkg] || [])] : [];
}
function launchArgsOf(sh, pkg, file) {
  const ws = sh.visibleWs().get(pkg);
  let text = "";
  if (ws) { const k = Object.keys(ws.launch || {}).find((f) => f.split("/").pop() === file); text = k ? String(ws.launch[k]) : ""; }
  const names = new Set();
  for (const m of text.matchAll(/DeclareLaunchArgument\(\s*(?:name\s*=\s*)?['"](\w+)['"]/g)) names.add(m[1]);
  for (const m of text.matchAll(/<arg\s+name="(\w+)"/g)) names.add(m[1]);
  if (!ws) for (const a of { ur_control: ["ur_type", "robot_ip", "use_mock_hardware", "launch_rviz", "headless_mode"], gen3: ["robot_ip", "use_fake_hardware", "dof", "gripper", "launch_rviz"], franka: ["robot_ip", "use_fake_hardware", "arm_id", "load_gripper"], xsarm_control: ["robot_model", "use_sim", "use_rviz"], tb3_simulation_launch: ["headless", "use_rviz", "slam"], gz_sim: ["gz_args"], display: ["model", "gui"], robot: ["usb_port", "use_sim_time"] }[file.replace(/(\.launch)?\.(py|xml|yaml)$/, "").replace(/_launch$/, "")] || []) names.add(a);
  return [...names].map((n) => `${n}:=`);
}
function topicNames(sh) { return sh.graph ? [...sh.graph.topics().keys()] : ["/parameter_events", "/rosout"]; }
function nodeNames(sh) { return sh.graph ? sh.graph.nodes.filter((n) => !sh.graph.unseen(n)).map((n) => n.full).sort() : []; }
function serviceNames(sh) { return sh.graph ? [...sh.graph.collect(["srvs"]).keys()] : []; }
function serviceType(sh, name) { const s = sh.graph ? sh.graph.collect(["srvs"]).get(name) : null; return s ? s.type : null; }
function actionNames(sh) { return sh.graph ? [...sh.graph.collect(["acts"]).keys()] : []; }
function actionType(sh, name) { const s = sh.graph ? sh.graph.collect(["acts"]).get(name) : null; return s ? s.type : null; }
function paramNames(sh, node) { const n = sh.graph && sh.graph.node(node); return n ? Object.keys(n.params || {}).sort() : []; }
function controllerNames(sh) {
  if (!sh.graph || !sh.graph.cmModels) return [];
  return [...new Set(sh.graph.cmModels().flatMap((m) => [...m.cm.controllers.keys()]))].sort();
}
function ifaceList(sh, kind) {
  const ws = [...sh.visibleWs().values()].flatMap((p) => Object.keys(p.ifaces || {}));
  const all = [...new Set([...(ifacesReady() ? allIfaces() : []), ...Object.keys(sh.graph ? sh.graph.allIfaces() : {}), ...ws])];
  return all.filter((t) => !kind || t.split("/")[1] === kind).sort();
}
const quoteProto = (p) => `"${p}"`;

function ros2Candidates(sh, args, cur) {
  // args: the words after "ros2" that are complete; cur: the word being typed
  const verb = args[0];
  if (!verb) return [...Object.keys(VERBS), ...(cur.startsWith("-") ? GLOBAL_FLAGS : [])].filter((v) => v.startsWith(cur) && (v !== "control" || sh.hasPkg("ros2controlcli") || sh.hasPkg("controller_manager"))).sort();
  const V = VERBS[verb]; if (!V) return [];
  const prev = args[args.length - 1];
  if (QOS_VALUES[prev]) return QOS_VALUES[prev].filter((x) => x.startsWith(cur));
  if (verb === "run" || verb === "launch") {
    const pos = args.slice(1).filter((x, i, a) => !x.startsWith("-") && !(i > 0 && ["--prefix", "--launch-prefix"].includes(a[i - 1])));
    if (cur.startsWith("-")) return V[""].filter((f) => f.startsWith(cur));
    if (args.includes("--ros-args")) return ["-r", "--remap", "-p", "--param", "--params-file", "--log-level", "-e", "--enclave", "--"].filter((f) => f.startsWith(cur));
    if (pos.length === 0) return allPackages(sh).filter((p) => p.startsWith(cur));
    if (pos.length === 1) return (verb === "run" ? exesOf(sh, pos[0]) : launchFilesOf(sh, pos[0])).filter((x) => x.startsWith(cur));
    if (verb === "launch") return launchArgsOf(sh, pos[0], pos[1]).filter((x) => x.startsWith(cur) && !args.some((a) => a.startsWith(x)));
    return [];
  }
  if (Object.keys(V).length === 1 && V[""]) return V[""].filter((f) => f.startsWith(cur));
  const sub = args[1];
  if (!sub) return Object.keys(V).filter((s) => s.startsWith(cur)).sort();
  const flags = V[sub]; if (!flags) return [];
  if (cur.startsWith("-")) return [...flags, "-h", "--help"].filter((f) => f.startsWith(cur));
  const pos = args.slice(2).filter((x, i, a) => !x.startsWith("-") && !(i > 0 && /^(-r|--rate|-t|--times|-w|--window|-n|--node-name|--qos-\w+|--field|-l|--truncate-length|--param-type|--filter|--controller-manager|-c|--output|-o|--set-state|--build-type|--license|--dependencies|--node-name|--library-name|--destination-directory|--description|--maintainer-email|--maintainer-name|--package-format|--switch-timeout)$/.test(a[i - 1]) && !/^\d/.test(x)));
  const after = (k) => pos.length === k;
  const match = (list) => list.filter((x) => String(x).startsWith(cur));
  if (prev === "--build-type") return match(BUILD_TYPES);
  if (prev === "--license") return match(LICENSES);
  switch (`${verb} ${sub}`) {
    case "topic echo": case "topic info": case "topic hz": case "topic bw": case "topic delay": case "topic type":
      return after(0) ? match(topicNames(sh)) : verb === "topic" && sub === "echo" && after(1) ? match(ifaceList(sh, "msg")) : [];
    case "topic find": return after(0) ? match(ifaceList(sh, "msg")) : [];
    case "topic pub": {
      if (after(0)) return match(topicNames(sh));
      if (after(1)) { const T = sh.graph && sh.graph.topics().get(pos[0]); const known = T ? [T.type] : []; return match([...new Set([...known, ...ifaceList(sh, "msg")])]); }
      if (after(2)) { const t = normType(pos[1]); return hasIface(t) ? [quoteProto(protoFlow(t))].filter((x) => x.startsWith(cur) || x.slice(1).startsWith(cur.replace(/^["']/, ""))) : []; }
      return [];
    }
    case "service call": case "service type": case "service echo": {
      if (after(0)) return match(serviceNames(sh));
      if (sub !== "call") return [];
      if (after(1)) { const t = serviceType(sh, pos[0]); return match(t ? [t] : ifaceList(sh, "srv")); }
      if (after(2)) { const st = sectionType(normType(pos[1], "srv"), "request"); return st ? [quoteProto(protoFlow(st))].filter((x) => x.startsWith(cur) || x.slice(1).startsWith(cur.replace(/^["']/, ""))) : []; }
      return [];
    }
    case "service find": return after(0) ? match(ifaceList(sh, "srv")) : [];
    case "action info": case "action type": return after(0) ? match(actionNames(sh)) : [];
    case "action send_goal": {
      if (after(0)) return match(actionNames(sh));
      if (after(1)) { const t = actionType(sh, pos[0]); return match(t ? [t] : ifaceList(sh, "action")); }
      if (after(2)) { const st = sectionType(normType(pos[1], "action"), "goal"); return st ? [quoteProto(protoFlow(st))].filter((x) => x.startsWith(cur) || x.slice(1).startsWith(cur.replace(/^["']/, ""))) : []; }
      return [];
    }
    case "node info": return after(0) ? match(nodeNames(sh)) : [];
    case "param list": case "param dump": return after(0) ? match(nodeNames(sh)) : [];
    case "param get": case "param set": case "param describe": case "param delete":
      return after(0) ? match(nodeNames(sh)) : after(1) ? match(paramNames(sh, pos[0])) : [];
    case "param load": return after(0) ? match(nodeNames(sh)) : after(1) ? fileNames(sh, cur) : [];
    case "interface show": case "interface proto": return after(0) ? match(ifaceList(sh)) : [];
    case "interface package": return after(0) ? match([...new Set([...(ifacesReady() ? ifacePackages() : []), ...ifaceList(sh).map((t) => t.split("/")[0])])].sort()) : [];
    case "pkg executables": case "pkg prefix": case "pkg xml": return after(0) ? match(allPackages(sh)) : [];
    case "pkg create": return [];
    case "bag play": case "bag info": case "bag reindex": return after(0) ? fileNames(sh, cur, { dirsOnly: true }) : [];
    case "bag record": return match(topicNames(sh));
    case "lifecycle get": case "lifecycle list": case "lifecycle set": return after(0) ? match(nodeNames(sh)) : sub === "set" && after(1) ? match(["configure", "activate", "deactivate", "cleanup", "shutdown"]) : [];
    case "component list": case "component load": case "component unload": return after(0) ? match(nodeNames(sh).filter((n) => /container|Component|manager/i.test(n))) : [];
    case "control switch_controllers": return match(controllerNames(sh));
    case "control set_controller_state": return after(0) ? match(controllerNames(sh)) : after(1) ? match(CONTROL_STATES) : [];
    case "control load_controller": case "control unload_controller": return after(0) ? match(controllerNames(sh)) : [];
    case "control set_hardware_component_state": return after(1) ? match(["unconfigured", "inactive", "active", "finalized"]) : [];
    default: return [];
  }
}

// ---------- colcon (colcon-argcomplete) ----------
const COLCON = { build: ["--packages-select", "--packages-up-to", "--packages-skip", "--packages-ignore", "--symlink-install", "--merge-install", "--parallel-workers", "--executor", "--event-handlers", "--cmake-args", "--cmake-clean-cache", "--cmake-force-configure", "--allow-overriding", "--continue-on-error", "--base-paths", "--build-base", "--install-base", "--mixin"],
  test: ["--packages-select", "--packages-up-to", "--ctest-args", "--pytest-args", "--event-handlers", "--retest-until-fail", "--return-code-on-test-failure"], "test-result": ["--all", "--verbose", "--test-result-base", "--result-files-only"],
  list: ["--names-only", "--paths-only", "--topological-order", "--packages-select"], graph: ["--dot", "--density"], info: [], clean: [], metadata: [], mixin: [], version_check: [], "extension-points": [], extensions: [] };
function colconCandidates(sh, args, cur) {
  if (!args.length) return Object.keys(COLCON).filter((v) => v.startsWith(cur)).sort();
  const flags = COLCON[args[0]] || [];
  if (cur.startsWith("-")) return [...flags, "-h", "--help", "--log-base", "--log-level"].filter((f) => f.startsWith(cur));
  const last = [...args].reverse().find((a) => a.startsWith("-"));
  if (last && /^--packages-(select|up-to|skip|ignore)$/.test(last)) {
    const ws = sh.findWsPackages ? sh.findWsPackages() : [];
    return ws.filter((n) => n.startsWith(cur) && !args.includes(n));
  }
  if (last === "--event-handlers") return ["console_cohesion+", "console_direct+", "console_start_end+", "desktop_notification-", "status-", "summary+"].filter((x) => x.startsWith(cur));
  if (last === "--executor") return ["parallel", "sequential"].filter((x) => x.startsWith(cur));
  return fileNames(sh, cur);
}

// ---------- what one Tab press does ----------
// returns { line } (the new input) or { options, line? } (several candidates: listed on the second Tab)
export function tabComplete(sh, line) {
  const { cur, start, quote } = splitLine(line);
  const { list, kind } = candidates(sh, line);
  const uniq = [...new Set(list)];
  if (!uniq.length) return { options: [] };
  const typed = quote ? cur : cur;
  const head = line.slice(0, start);
  const finish = (w) => {
    const isDir = kind === "file" && w.endsWith("/");
    const isArgEq = w.endsWith(":=") || w.endsWith("=");
    const isProto = /^"\{/.test(w);
    const needsQuote = !isProto && /[\s{}[\]]/.test(w);
    const shown = needsQuote ? `'${w}'` : quote && !isProto ? `${quote}${w}${quote}` : w;
    return head + shown + (isDir || isArgEq ? "" : " ");
  };
  if (uniq.length === 1) return { line: finish(uniq[0]) };
  let common = uniq[0];
  for (const o of uniq) while (!o.startsWith(common)) common = common.slice(0, -1);
  const out = { options: uniq.map((o) => (kind === "file" ? o.split("/").filter(Boolean).pop() + (o.endsWith("/") ? "/" : "") : o)) };
  if (common.length > typed.length) out.line = head + (quote ? quote : "") + common;
  return out;
}
