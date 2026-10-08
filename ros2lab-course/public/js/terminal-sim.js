// A safe, simulated Ubuntu terminal for practice. Nothing here touches a real computer.
import { el, rich } from "./dom.js";
import { RosGraph, pkgCreate, findPackages, pkgExecutables, parseNodeCode } from "./ros-graph.js";
import { parseFlowYaml } from "./urdf-core.js";

const HOME = "/home/student";
const USER = "student";
const HOST = "ros2lab";
const BASE_DIRS = ["/", "/home", HOME, `${HOME}/Desktop`, `${HOME}/Documents`, `${HOME}/Downloads`, `${HOME}/Music`,
  `${HOME}/Pictures`, "/opt", "/opt/ros", "/opt/ros/jazzy", "/opt/ros/jazzy/bin", "/opt/ros/jazzy/share", "/usr",
  "/usr/bin", "/etc", "/tmp", "/var"];
const BASE_FILES = {
  [`${HOME}/.bashrc`]: "# ~/.bashrc runs every time you open a new terminal\nalias ll='ls -alF'\n",
  [`${HOME}/.profile`]: "# ~/.profile\n",
  "/opt/ros/jazzy/setup.bash": "# Loads ROS 2 Jazzy into this terminal\n",
  "/etc/hostname": "ros2lab\n",
};
const BASE_ENV = { HOME, USER, SHELL: "/bin/bash", LANG: "en_IN.UTF-8", PWD: HOME,
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" };
const ROS_ENV = { ROS_DISTRO: "jazzy", ROS_VERSION: "2", ROS_PYTHON_VERSION: "3", AMENT_PREFIX_PATH: "/opt/ros/jazzy",
  PYTHONPATH: "/opt/ros/jazzy/lib/python3.12/site-packages" };
// apt package -> what it provides. "repo" = needs the ROS 2 package source (ros2-apt-source).
const APT = {
  "locales": { about: "Language and region settings" },
  "software-properties-common": { cmd: ["add-apt-repository"], about: "Tools to manage software sources" },
  "curl": { cmd: ["curl"], about: "Download files from the internet" },
  "tree": { cmd: ["tree"], about: "Shows folders as a tree" },
  "htop": { cmd: ["htop"], about: "Interactive process viewer" },
  "git": { cmd: ["git"], about: "Version control system" },
  "build-essential": { cmd: ["g++", "make"], about: "C and C++ compilers" },
  "python3-pip": { cmd: ["pip"], about: "Python package installer" },
  "ros-dev-tools": { repo: true, cmd: ["colcon", "rosdep", "vcs"], about: "ROS 2 developer tools: colcon, rosdep, vcstool" },
  "python3-colcon-common-extensions": { repo: true, cmd: ["colcon"], about: "colcon build tool" },
  "python3-rosdep": { repo: true, cmd: ["rosdep"], about: "Installs package dependencies" },
  "python3-vcstool": { repo: true, cmd: ["vcs"], about: "Downloads many repositories at once" },
  "ros-jazzy-desktop": { repo: true, desktop: true, ros: ["turtlesim", "demo_nodes_py", "demo_nodes_cpp", "rclpy", "rclcpp", "std_msgs", "rqt", "rviz2", "tf2_tools"], about: "ROS 2 Jazzy desktop: core, RViz, rqt, demos" },
  "ros-jazzy-turtlesim": { repo: true, ros: ["turtlesim"], about: "Turtlesim is a tool made for teaching ROS and ROS packages" },
  "ros-jazzy-demo-nodes-py": { repo: true, ros: ["demo_nodes_py"], about: "Python demo nodes (talker and listener)" },
  "ros-jazzy-demo-nodes-cpp": { repo: true, ros: ["demo_nodes_cpp"], about: "C++ demo nodes (talker and listener)" },
  "ros-jazzy-teleop-twist-keyboard": { repo: true, ros: ["teleop_twist_keyboard"], about: "Drive a robot with your keyboard" },
  "ros-jazzy-rqt": { repo: true, ros: ["rqt"], about: "Graphical tools for ROS 2" },
  "ros-jazzy-robot-state-publisher": { repo: true, ros: ["robot_state_publisher"], about: "Publishes the robot's shape (TF) from its URDF" },
  "ros-jazzy-joint-state-publisher-gui": { repo: true, ros: ["joint_state_publisher_gui"], about: "Sliders to move robot joints" },
  "ros-jazzy-xacro": { repo: true, ros: ["xacro"], about: "Macros for robot description files" },
  "ros-jazzy-tf2-tools": { repo: true, ros: ["tf2_tools"], about: "Tools to inspect coordinate frames" },
  "ros-jazzy-ros-gz": { repo: true, ros: ["ros_gz_sim", "ros_gz_bridge", "ros_gz_image"], cmd: ["gz"], about: "Gazebo Harmonic simulator connected to ROS 2" },
  "ros-jazzy-rviz-imu-plugin": { repo: true, ros: ["rviz_imu_plugin"], about: "RViz display for sensor_msgs/Imu (from imu_tools)" },
  "ros-jazzy-ros2-control": { repo: true, ros: ["controller_manager", "ros2controlcli", "hardware_interface"], about: "ros2_control framework (controller_manager, ros2 control)" },
  "ros-jazzy-ros2-controllers": { repo: true, ros: ["diff_drive_controller", "joint_trajectory_controller", "joint_state_broadcaster", "forward_command_controller", "position_controllers", "velocity_controllers"], about: "Standard controllers" },
  "ros-jazzy-gz-ros2-control": { repo: true, ros: ["gz_ros2_control", "controller_manager", "ros2controlcli", "hardware_interface"], about: "ros2_control inside Gazebo (gz_ros2_control-system plugin)" },
  "ros-jazzy-gz-ros2-control-demos": { repo: true, ros: ["gz_ros2_control_demos"], about: "ros2_control demo robots in Gazebo" },
  "ros-jazzy-navigation2": { repo: true, ros: ["nav2_bt_navigator", "nav2_controller", "nav2_planner"], about: "Nav2 navigation stack" },
  "ros-jazzy-nav2-bringup": { repo: true, ros: ["nav2_bringup"], about: "Launch files to start Nav2" },
  "ros-jazzy-nav2-minimal-tb3-sim": { repo: true, ros: ["nav2_minimal_tb3_sim"], about: "TurtleBot3 simulation used by the Nav2 demo" },
  "ros-jazzy-nav2-minimal-tb4-sim": { repo: true, ros: ["nav2_minimal_tb4_sim"], about: "TurtleBot4 simulation used by Nav2 demos" },
  "ros-jazzy-slam-toolbox": { repo: true, ros: ["slam_toolbox"], about: "Builds maps (SLAM)" },
  "ros-jazzy-robot-localization": { repo: true, ros: ["robot_localization"], about: "Sensor fusion for robot position" },
  "ros-jazzy-cartographer-ros": { repo: true, ros: ["cartographer_ros"], about: "Cartographer SLAM" },
  "ros-jazzy-turtlebot3": { repo: true, ros: ["turtlebot3", "turtlebot3_bringup", "turtlebot3_navigation2", "turtlebot3_cartographer"], about: "TurtleBot3 robot packages" },
  "ros-jazzy-turtlebot3-gazebo": { repo: true, ros: ["turtlebot3_gazebo"], about: "TurtleBot3 worlds for Gazebo" },
  "ros-jazzy-turtlebot3-msgs": { repo: true, ros: ["turtlebot3_msgs"], about: "TurtleBot3 messages" },
  "ros-jazzy-moveit": { repo: true, ros: ["moveit_ros_planning", "moveit_ros_move_group"], about: "MoveIt 2 motion planning for robot arms" },
  "ros-jazzy-moveit-resources-panda-moveit-config": { repo: true, ros: ["moveit_resources_panda_moveit_config"], about: "Ready-made MoveIt demo with the Panda arm" },
  "ros-jazzy-ur-description": { repo: true, ros: ["ur_description"], about: "Universal Robots arm models" },
  "ros-jazzy-rmw-cyclonedds-cpp": { repo: true, ros: ["rmw_cyclonedds_cpp"], about: "Cyclone DDS middleware" },
};
const DEFAULT_ROS = ["turtlesim", "demo_nodes_py", "demo_nodes_cpp", "rclpy", "std_msgs", "rqt", "rclcpp", "rclcpp_components", "geometry_msgs", "sensor_msgs", "std_srvs", "robot_state_publisher", "joint_state_publisher", "joint_state_publisher_gui", "rviz2", "urdf", "urdf_tutorial", "urdf_launch", "xacro", "tf2_ros", "tf2_tools", "visualization_msgs", "interactive_markers"];
const HELP = {
  ls: "Usage: ls [OPTION]... [FILE]...\n  -a   show hidden files (names starting with .)\n  -l   long list: permissions, owner, size, date",
  cd: "cd [folder]   go into a folder.  cd ..  goes up.  cd ~  goes home.",
  mkdir: "Usage: mkdir [-p] FOLDER...\n  -p   also create missing parent folders",
  cp: "Usage: cp [-r] SOURCE DEST\n  -r   copy folders with everything inside",
  mv: "Usage: mv SOURCE DEST   (move or rename)",
  rm: "Usage: rm [-r] [-f] FILE...\n  -r   remove folders and their contents\n  -f   never ask, ignore missing files",
  chmod: "Usage: chmod MODE FILE   e.g. chmod +x run.py",
  apt: "Usage: apt update | apt install PACKAGE | apt search WORD   (use sudo for update/install)",
  ros2: "usage: ros2 <command> ...\n  run      Run a program from a package\n  topic    Look at topics (list, echo)\n  node     Look at nodes (list)\n  pkg      Look at packages (list)",
};
const COMMANDS = ["pwd", "ls", "cd", "mkdir", "touch", "cat", "head", "tail", "echo", "cp", "mv", "rm", "rmdir", "chmod",
  "clear", "whoami", "hostname", "date", "history", "export", "unset", "printenv", "env", "source", "sudo", "apt", "apt-get",
  "ros2", "python3", "nano", "grep", "wc", "help", "man", "exit", "tree", "locale", "locale-gen", "update-locale",
  "add-apt-repository", "curl", "dpkg", "rosdep", "colcon", "gz", "g++", "rqt_graph", "rviz2", "lsb_release", "uname", "nproc", "free", "df", "code", "snap"];

const normPath = (p) => {
  const parts = [];
  for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") parts.pop(); else parts.push(s); }
  return "/" + parts.join("/");
};
const parentOf = (p) => (p === "/" ? "/" : p.replace(/\/[^/]+$/, "") || "/");
const baseName = (p) => p.split("/").filter(Boolean).pop() || "/";
const sortNames = (a, b) => a.replace(/^\./, "").localeCompare(b.replace(/^\./, ""), "en", { sensitivity: "base" });

// ========================= the shell (logic only) =========================
export class Shell {
  constructor(spec = {}) {
    this.spec = spec;
    this.reset();
  }

  reset() {
    const s = this.spec;
    this.fs = new Map();
    this.cwd = HOME;
    for (const d of BASE_DIRS) this.fs.set(d, { type: "d", mode: "rwxr-xr-x" });
    for (const [p, c] of Object.entries(BASE_FILES)) this.fs.set(p, { type: "f", mode: "rw-r--r--", content: c });
    const fsSpec = s.fs || {};
    for (const d of fsSpec.dirs || []) this.mkdirP(this.abs(d));
    for (const [p, c] of Object.entries(fsSpec.files || {})) {
      const ap = this.abs(p); this.mkdirP(parentOf(ap));
      this.fs.set(ap, { type: "f", mode: "rw-r--r--", content: c });
    }
    for (const p of fsSpec.exec || []) { const n = this.fs.get(this.abs(p)); if (n) n.mode = "rwxr-xr-x"; }
    this.cwd = s.start ? this.abs(s.start) : HOME;
    this.env = { ...BASE_ENV, PWD: this.cwd, ...(s.env || {}) };
    this.sourced = false;
    this.rosPkgs = new Set(s.bareRos ? ["rclpy", "std_msgs"] : DEFAULT_ROS);
    this.cmds = new Set(COMMANDS.filter((c) => !["tree", "colcon", "rosdep", "gz", "vcs", "curl", "add-apt-repository"].includes(c)));
    this.cmds.add("curl"); this.cmds.add("add-apt-repository");
    this.rosRepo = true; this.rosInstalled = true; this.updatedAfterRepo = true;
    this.rosdepInit = false; this.rosdepUpdated = false; this.aptDone = new Set();
    this.viz = { fixedFrame: "map", displays: { Grid: true }, joints: {}, markers: [], jsPub: false }; this.substs = {};
    if (s.fresh) {   // a brand-new Ubuntu 24.04: no ROS 2 yet
      for (const k of [...this.fs.keys()]) if (k === "/opt/ros" || k.startsWith("/opt/ros/")) this.fs.delete(k);
      this.rosPkgs = new Set(); this.rosRepo = false; this.rosInstalled = false; this.updatedAfterRepo = false;
      this.cmds.delete("curl"); this.cmds.delete("add-apt-repository"); this.cmds.delete("code");
    }
    for (const c of s.cmds || []) this.cmds.add(c);
    for (const p of s.rosPkgs || []) this.rosPkgs.add(p);
    this.aptUpdated = false;
    this.sudoTold = false;
    // a pretend running ROS 2 system (nodes in "other terminals"), and packages built with colcon
    this.graph = new RosGraph(this, s.running || []);   // every practice terminal has a live (pretend) ROS 2 graph
    this.installs = {};
    this.wsPkgs = new Map();
    this.history = [];
    this.lastOutput = "";
    this.lastError = false;
    if (s.sourced) this.applySource();
  }

  abs(p) {
    if (!p || p === "~") return HOME;
    if (p.startsWith("~/")) return normPath(HOME + "/" + p.slice(2));
    if (p.startsWith("/")) return normPath(p);
    return normPath(this.cwd + "/" + p);
  }
  node(p) { return this.fs.get(p); }
  isDir(p) { const n = this.fs.get(p); return !!n && n.type === "d"; }
  isFile(p) { const n = this.fs.get(p); return !!n && n.type === "f"; }
  children(dir) {
    const out = [];
    for (const k of this.fs.keys()) if (k !== dir && parentOf(k) === dir) out.push(baseName(k));
    return out.sort(sortNames);
  }
  writable(p, root) { return root || p === HOME || p.startsWith(HOME + "/") || p.startsWith("/tmp"); }
  mkdirP(p) {
    const parts = p.split("/").filter(Boolean);
    let cur = "";
    for (const part of parts) { cur += "/" + part; if (!this.fs.has(cur)) this.fs.set(cur, { type: "d", mode: "rwxr-xr-x" }); }
  }
  prettyCwd() { return this.cwd === HOME ? "~" : this.cwd.startsWith(HOME + "/") ? "~" + this.cwd.slice(HOME.length) : this.cwd; }
  applySource() { this.sourced = true; Object.assign(this.env, ROS_ENV); }

  // Opens a "new terminal": forgets exports and sourcing, then runs ~/.bashrc
  newTerminal() {
    this.env = { ...BASE_ENV, ...(this.spec.env || {}) };
    this.sourced = false;
    this.cwd = HOME;
    const rc = this.node(`${HOME}/.bashrc`);
    if (rc) this.runRcText(rc.content || "");
  }
  runRcText(text) {
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^(?:source|\.)\s+(\S+)/);
      if (m) { this.doSource(m[1], true); continue; }
      const e = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (e) this.env[e[1]] = e[2].replace(/^["']|["']$/g, "");
    }
  }

  // ---------- parsing ----------
  tokenize(line) {
    const tokens = [];
    let cur = "", mode = null, has = false;
    const push = () => { if (has) tokens.push(cur); cur = ""; has = false; };
    const expand = (s) => s.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_, n) => this.env[n] ?? "");
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (mode === "'") { if (c === "'") mode = null; else cur += c; continue; }
      if (mode === '"') {
        if (c === '"') mode = null;
        else if (c === "$") { const m = line.slice(i).match(/^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/); if (m) { cur += this.env[m[1]] ?? ""; i += m[0].length - 1; } else cur += c; }
        else cur += c;
        continue;
      }
      if (c === "'" || c === '"') { mode = c; has = true; continue; }
      if (c === " " || c === "\t") { push(); continue; }
      if (c === "|") { push(); tokens.push({ op: "|" }); continue; }
      if (c === ">") { push(); if (line[i + 1] === ">") { tokens.push({ op: ">>" }); i++; } else tokens.push({ op: ">" }); continue; }
      if (c === "$") {
        const m = line.slice(i).match(/^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/);
        if (m) { cur += expand(m[0]); i += m[0].length - 1; has = true; continue; }
      }
      cur += c; has = true;
    }
    push();
    return tokens;
  }

  // ---------- run one command line; returns { lines, clear?, nano? } ----------
  run(rawLine) {
    let line = rawLine.trim();
    this.lastError = false;
    if (!line) return { lines: [] };
    // a && b: run b only if a worked
    if (/\s&&\s/.test(line) && !/["'][^"']*&&[^"']*["']/.test(line)) {
      this.history.push(line);
      const all = [];
      for (const part of line.split(/\s+&&\s+/)) {
        const r = this.run(part);
        this.history.pop();
        all.push(...r.lines);
        if (r.clear || r.nano || r.code || r.python || this.lastError) return this.result(all, r);
      }
      return this.result(all);
    }
    this.history.push(line);
    if (/\$\((xacro|cat)\s/.test(line)) { const r = this.substitute(line); if (r.err) return this.result(r.err); line = r.line; }
    const special = this.specialLine(line);
    if (special) return this.result(special);
    const tokens = this.tokenize(line);
    const segments = [[]];
    let redirect = null;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (typeof t === "object" && t.op === "|") segments.push([]);
      else if (typeof t === "object") { redirect = { append: t.op === ">>", target: tokens[i + 1] }; i++; }
      else segments[segments.length - 1].push(t);
    }
    if (redirect && typeof redirect.target !== "string") return this.result([this.err("bash: syntax error near unexpected token `newline'")]);
    let res = this.exec(segments[0], false);
    for (const seg of segments.slice(1)) {
      if (res.clear || res.nano || res.code || res.python) break;
      res = { lines: this.filter(seg, res.lines) };
    }
    if (redirect) {
      const p = this.abs(redirect.target);
      if (!this.isDir(parentOf(p))) return this.result([this.err(`bash: ${redirect.target}: No such file or directory`)]);
      if (this.isDir(p)) return this.result([this.err(`bash: ${redirect.target}: Is a directory`)]);
      if (!this.writable(p, false)) return this.result([this.err(`bash: ${redirect.target}: Permission denied`)]);
      const text = res.lines.filter((l) => l.cls !== "err" && l.cls !== "hint").map((l) => l.text).join("\n") + "\n";
      const old = this.isFile(p) ? this.node(p).content || "" : "";
      this.fs.set(p, { type: "f", mode: this.isFile(p) ? this.node(p).mode : "rw-r--r--", content: redirect.append ? old + text : text });
      res = { lines: res.lines.filter((l) => l.cls === "err" || l.cls === "hint") };
    }
    return this.result(res.lines, res);
  }
  result(lines, extra = {}) {
    this.lastOutput = lines.map((l) => l.text).join("\n");
    this.lastError = lines.some((l) => l.cls === "err");
    return { ...extra, lines };
  }
  out(text, cls) { return { text, cls }; }
  err(text) { return { text, cls: "err" }; }
  hint(text) { return { text, cls: "hint" }; }

  filter(args, lines) {
    const [cmd, ...rest] = args;
    const text = lines.filter((l) => l.cls !== "hint");
    if (cmd === "grep") {
      const flags = rest.filter((a) => a.startsWith("-")).join("");
      const pat = rest.find((a) => !a.startsWith("-"));
      if (!pat) return [this.err("Usage: grep PATTERN")];
      const ic = flags.includes("i");
      return text.filter((l) => (ic ? l.text.toLowerCase().includes(pat.toLowerCase()) : l.text.includes(pat)));
    }
    if (cmd === "head" || cmd === "tail") {
      const n = this.countArg(rest, 10);
      return cmd === "head" ? text.slice(0, n) : text.slice(-n);
    }
    if (cmd === "wc" && rest.includes("-l")) return [this.out(String(text.length))];
    if (cmd === "sort") return text.slice().sort((a, b) => a.text.localeCompare(b.text));
    return [this.err(`${cmd}: in this practice terminal, only grep, head, tail, wc -l and sort can be used after |`)];
  }
  countArg(args, dflt) {
    const i = args.indexOf("-n");
    if (i >= 0 && /^\d+$/.test(args[i + 1] || "")) return Number(args[i + 1]);
    const m = args.find((a) => /^-\d+$/.test(a));
    return m ? Number(m.slice(1)) : dflt;
  }

  exec(args, root) {
    if (!args.length) return { lines: [] };
    const [cmd, ...rest] = args;
    const flags = rest.filter((a) => /^-[A-Za-z]+$/.test(a)).map((a) => a.slice(1)).join("");
    const plain = rest.filter((a) => !/^-[A-Za-z]+$/.test(a) && !/^-\d+$/.test(a));
    if (rest.includes("--help") && HELP[cmd === "apt-get" ? "apt" : cmd]) return { lines: [this.out(HELP[cmd === "apt-get" ? "apt" : cmd])] };
    const L = [];

    // run a file directly: ./file.py or /path/file
    if (cmd.includes("/")) return { lines: this.runFile(cmd, true) };

    switch (cmd) {
      case "pwd": return { lines: [this.out(this.cwd)] };
      case "whoami": return { lines: [this.out(root ? "root" : USER)] };
      case "hostname": return { lines: [this.out(HOST)] };
      case "lsb_release": return { lines: ["No LSB modules are available.", "Distributor ID:\tUbuntu", "Description:\tUbuntu 24.04.1 LTS", "Release:\t24.04", "Codename:\tnoble"].map((t) => this.out(t)) };
      case "uname": return { lines: [this.out(flags.includes("a") ? `Linux ${HOST} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux` : flags.includes("r") ? "6.8.0-45-generic" : "Linux")] };
      case "nproc": return { lines: [this.out("8")] };
      case "free": return { lines: ["               total        used        free      shared  buff/cache   available", "Mem:            15Gi       3.1Gi       9.2Gi       412Mi       3.4Gi        12Gi", "Swap:          4.0Gi          0B       4.0Gi"].map((t) => this.out(t)) };
      case "df": return { lines: ["Filesystem      Size  Used Avail Use% Mounted on", "/dev/sda2       234G   38G  184G  18% /", "tmpfs           7.7G     0  7.7G   0% /dev/shm"].map((t) => this.out(t)) };
      case "date": return { lines: [this.out(new Date().toString().replace(/ GMT.*$/, " IST"))] };
      case "clear": return { lines: [], clear: true };
      case "exit": return { lines: [this.hint("This practice terminal stays open. Use \"Start again\" to reset it.")] };
      case "help": case "man":
        return { lines: [this.out("Commands you can practise here:"), this.out(COMMANDS.filter((c) => this.cmds.has(c)).join("  ")),
          this.hint("Tip: most commands show help with --help, for example: ls --help")] };
      case "history": return { lines: this.history.map((h, i) => this.out(`${String(i + 1).padStart(5)}  ${h}`)) };

      case "cd": {
        if (plain.length > 1) return { lines: [this.err("bash: cd: too many arguments")] };
        const target = plain[0] ?? "~";
        const p = this.abs(target);
        if (!this.fs.has(p)) return { lines: [this.err(`bash: cd: ${target}: No such file or directory`), ...this.caseHint(target)] };
        if (!this.isDir(p)) return { lines: [this.err(`bash: cd: ${target}: Not a directory`)] };
        this.cwd = p; this.env.PWD = p;
        return { lines: [] };
      }

      case "ls": {
        const all = flags.includes("a"), long = flags.includes("l");
        const targets = plain.length ? plain : ["."];
        for (const t of targets) {
          const p = this.abs(t);
          if (!this.fs.has(p)) { L.push(this.err(`ls: cannot access '${t}': No such file or directory`)); continue; }
          if (targets.length > 1 && this.isDir(p)) L.push(this.out(`${t}:`));
          let names = this.isDir(p) ? this.children(p) : [t];
          if (this.isDir(p) && !all) names = names.filter((n) => !n.startsWith("."));
          if (this.isDir(p) && all) names = [".", "..", ...names];
          const full = (n) => (this.isDir(p) ? (n === "." ? p : n === ".." ? parentOf(p) : `${p === "/" ? "" : p}/${n}`) : p);
          if (long) {
            for (const n of names) {
              const nd = this.node(full(n)) || { type: "d", mode: "rwxr-xr-x" };
              const size = nd.type === "d" ? 4096 : (nd.content || "").length;
              L.push({ text: `${nd.type === "d" ? "d" : "-"}${nd.mode} 1 ${USER} ${USER} ${String(size).padStart(5)} Oct  2 10:15 ${n}`,
                cls: nd.type === "d" ? "dir" : nd.mode[2] === "x" ? "exe" : undefined });
            }
          } else if (names.length) {
            L.push({ text: names.join("  "), segs: names.map((n) => {
              const nd = this.node(full(n));
              return { t: n, c: !nd || nd.type === "d" ? "dir" : nd.mode[2] === "x" ? "exe" : "" };
            }) });
          }
        }
        return { lines: L };
      }

      case "mkdir": {
        if (!plain.length) return { lines: [this.err("mkdir: missing operand")] };
        const parents = flags.includes("p");
        for (const a of plain) {
          const p = this.abs(a);
          if (this.fs.has(p)) { if (!(parents && this.isDir(p))) L.push(this.err(`mkdir: cannot create directory ‘${a}’: File exists`)); continue; }
          if (!this.writable(p, root)) { L.push(this.err(`mkdir: cannot create directory ‘${a}’: Permission denied`)); continue; }
          if (!this.isDir(parentOf(p)) && !parents) { L.push(this.err(`mkdir: cannot create directory ‘${a}’: No such file or directory`)); L.push(this.hint("Tip: mkdir -p also creates the missing parent folders.")); continue; }
          this.mkdirP(p);
        }
        return { lines: L };
      }

      case "touch": {
        if (!plain.length) return { lines: [this.err("touch: missing file operand")] };
        for (const a of plain) {
          const p = this.abs(a);
          if (this.fs.has(p)) continue;
          if (!this.isDir(parentOf(p))) { L.push(this.err(`touch: cannot touch '${a}': No such file or directory`)); continue; }
          if (!this.writable(p, root)) { L.push(this.err(`touch: cannot touch '${a}': Permission denied`)); continue; }
          this.fs.set(p, { type: "f", mode: "rw-r--r--", content: "" });
        }
        return { lines: L };
      }

      case "cat": {
        if (!plain.length) return { lines: [this.hint("cat needs a file name, for example: cat notes.txt")] };
        for (const a of plain) {
          const p = this.abs(a);
          if (!this.fs.has(p)) L.push(this.err(`cat: ${a}: No such file or directory`));
          else if (this.isDir(p)) L.push(this.err(`cat: ${a}: Is a directory`));
          else for (const t of (this.node(p).content || "").replace(/\n$/, "").split("\n")) if (this.node(p).content) L.push(this.out(t));
        }
        return { lines: L };
      }

      case "head": case "tail": {
        const n = this.countArg(rest, 10);
        const file = plain.find((a) => !/^\d+$/.test(a));
        if (!file) return { lines: [this.err(`${cmd}: missing file name`)] };
        const p = this.abs(file);
        if (!this.isFile(p)) return { lines: [this.err(`${cmd}: cannot open '${file}' for reading: No such file or directory`)] };
        const all = (this.node(p).content || "").replace(/\n$/, "").split("\n");
        return { lines: (cmd === "head" ? all.slice(0, n) : all.slice(-n)).map((t) => this.out(t)) };
      }

      case "echo": return { lines: [this.out(rest.filter((a) => a !== "-e").join(" "))] };

      case "cp": case "mv": {
        if (plain.length < 2) return { lines: [this.err(`${cmd}: missing destination file operand`)] };
        const [srcA, dstA] = plain;
        const src = this.abs(srcA);
        if (!this.fs.has(src)) return { lines: [this.err(`${cmd}: cannot stat '${srcA}': No such file or directory`)] };
        if (cmd === "cp" && this.isDir(src) && !flags.includes("r") && !flags.includes("R")) return { lines: [this.err(`cp: -r not specified; omitting directory '${srcA}'`), this.hint("Tip: use cp -r to copy a folder.")] };
        let dst = this.abs(dstA);
        if (this.isDir(dst)) dst = `${dst === "/" ? "" : dst}/${baseName(src)}`;
        if (!this.isDir(parentOf(dst))) return { lines: [this.err(`${cmd}: cannot create '${dstA}': No such file or directory`)] };
        if (!this.writable(dst, root) || (cmd === "mv" && !this.writable(src, root))) return { lines: [this.err(`${cmd}: cannot create '${dstA}': Permission denied`)] };
        if (dst === src || dst.startsWith(src + "/")) return { lines: [this.err(`${cmd}: cannot copy a folder into itself`)] };
        const moves = [...this.fs.entries()].filter(([k]) => k === src || k.startsWith(src + "/"));
        for (const [k, v] of moves) this.fs.set(dst + k.slice(src.length), { ...v });
        if (cmd === "mv") for (const [k] of moves) this.fs.delete(k);
        if (cmd === "mv" && (this.cwd === src || this.cwd.startsWith(src + "/"))) this.cwd = dst;
        return { lines: [] };
      }

      case "rm": {
        const recursive = /[rR]/.test(flags), force = flags.includes("f");
        if (!plain.length) return { lines: [this.err("rm: missing operand")] };
        for (const a of plain) {
          const p = this.abs(a);
          if (p === "/" || p === HOME || p === "/home" || HOME.startsWith(p + "/")) { L.push(this.hint(`Blocked: that would delete ${p === "/" ? "the whole computer" : "your home folder"}. Always double-check rm commands!`)); continue; }
          if (!this.fs.has(p)) { if (!force) L.push(this.err(`rm: cannot remove '${a}': No such file or directory`)); continue; }
          if (this.isDir(p) && !recursive) { L.push(this.err(`rm: cannot remove '${a}': Is a directory`)); L.push(this.hint("Tip: rm -r removes a folder and everything inside it.")); continue; }
          if (!this.writable(p, root)) { L.push(this.err(`rm: cannot remove '${a}': Permission denied`)); continue; }
          for (const k of [...this.fs.keys()]) if (k === p || k.startsWith(p + "/")) this.fs.delete(k);
          if (this.cwd === p || this.cwd.startsWith(p + "/")) this.cwd = parentOf(p);
        }
        return { lines: L };
      }

      case "rmdir": {
        for (const a of plain) {
          const p = this.abs(a);
          if (!this.isDir(p)) L.push(this.err(`rmdir: failed to remove '${a}': No such file or directory`));
          else if (this.children(p).length) L.push(this.err(`rmdir: failed to remove '${a}': Directory not empty`));
          else this.fs.delete(p);
        }
        return { lines: L };
      }

      case "chmod": {
        const [mode, file] = rest;
        if (!mode || !file) return { lines: [this.err("chmod: missing operand"), this.hint("Example: chmod +x hello.py")] };
        const p = this.abs(file);
        if (!this.fs.has(p)) return { lines: [this.err(`chmod: cannot access '${file}': No such file or directory`)] };
        if (!this.writable(p, root)) return { lines: [this.err(`chmod: changing permissions of '${file}': Operation not permitted`)] };
        const nd = this.node(p);
        if (/^[0-7]{3}$/.test(mode)) {
          nd.mode = mode.split("").map((d) => { const n = Number(d); return (n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-"); }).join("");
        } else {
          const m = mode.match(/^([ugoa]*)([+-])([rwx]+)$/);
          if (!m) return { lines: [this.err(`chmod: invalid mode: ‘${mode}’`)] };
          const who = m[1] === "" || m[1].includes("a") ? "ugo" : m[1];
          const arr = nd.mode.split("");
          for (const w of who) {
            const off = { u: 0, g: 3, o: 6 }[w];
            for (const perm of m[3]) { const i = off + { r: 0, w: 1, x: 2 }[perm]; arr[i] = m[2] === "+" ? perm : "-"; }
          }
          nd.mode = arr.join("");
        }
        return { lines: [] };
      }

      case "export": {
        if (!rest.length) return { lines: Object.keys(this.env).sort().map((k) => this.out(`declare -x ${k}="${this.env[k]}"`)) };
        for (const a of rest) {
          const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
          if (m) this.env[m[1]] = m[2];
          else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(a)) L.push(this.err(`bash: export: \`${a}': not a valid identifier`));
        }
        return { lines: L };
      }
      case "unset": for (const a of rest) delete this.env[a]; return { lines: [] };
      case "printenv":
        if (plain.length) return { lines: plain.filter((n) => n in this.env).map((n) => this.out(this.env[n])) };
        return { lines: Object.keys(this.env).sort().map((k) => this.out(`${k}=${this.env[k]}`)) };
      case "env": return { lines: Object.keys(this.env).sort().map((k) => this.out(`${k}=${this.env[k]}`)) };

      case "source": case ".": {
        if (!plain.length) return { lines: [this.err("bash: source: filename argument required")] };
        return { lines: this.doSource(plain[0], false) };
      }

      case "sudo": {
        if (!rest.length) return { lines: [this.err("usage: sudo command")] };
        if (!this.sudoTold) { this.sudoTold = true; L.push(this.out(`[sudo] password for ${USER}:`), this.hint("(Practice terminal: no password needed here. On a real computer, type your password; nothing shows while you type.)")); }
        const r = this.exec(rest, true);
        return { ...r, lines: [...L, ...r.lines] };
      }

      case "apt": case "apt-get": return { lines: this.apt(rest, root) };
      case "ros2": return { lines: this.ros2(rest) };
      case "python3": case "python": {
        if (cmd === "python") return { lines: [this.err("Command 'python' not found, did you mean:"), this.out("  command 'python3' from deb python3"), this.hint("On Ubuntu, type python3")] };
        if (!plain.length) return { lines: [this.out("Python 3.12.3"), this.hint("Interactive Python is not available in this terminal. Use the Python playground in the Python lessons.")] };
        const ran = this.runFile(plain[0], false);
        return Array.isArray(ran) ? { lines: ran } : { lines: [], python: ran.python };
      }
      case "code": {   // Visual Studio Code (the practice copy opens above the terminal)
        if (!this.cmds.has("code")) return { lines: [this.err("Command 'code' not found, but can be installed with:"), this.out(""), this.out("sudo snap install code --classic")] };
        if (root) return { lines: [this.out("You are trying to start Visual Studio Code as a super user which isn't recommended. If this was intended, please add the argument `--no-sandbox` and specify an alternate user data directory using the `--user-data-dir` argument."), this.hint("Run code without sudo. Files you own open fine.")] };
        if (rest.includes("--version") || rest.includes("-v")) return { lines: [this.out("1.105.1"), this.out("7d842fb85a0275a4a8e4d7e040d2625abbf7f084"), this.out("x64")] };
        const target = plain[0] ? this.abs(plain[0]) : this.cwd;
        if (this.isDir(target)) return { lines: [], code: { dir: target, file: null } };
        if (!this.isDir(parentOf(target))) return { lines: [this.err(`The path '${plain[0]}' does not exist.`)] };
        // a file: show it inside its workspace if it is in one (…/src/<pkg>/…), else in its own folder
        let dir = parentOf(target);
        const ws = target.match(/^(.*?_ws)(\/|$)/) || target.match(/^(.*?\/ros2_ws)(\/|$)/);
        if (ws && this.isDir(ws[1])) dir = ws[1];
        return { lines: [], code: { dir, file: target } };
      }
      case "snap": {
        if (plain[0] === "install" && plain.includes("code")) {
          if (!root) return { lines: [this.err("error: access denied (try with sudo)")] };
          if (!rest.includes("--classic")) return { lines: [this.err("error: This revision of snap \"code\" was published using classic confinement and thus may perform"), this.err("       arbitrary system changes outside of the security sandbox that snaps are usually confined to,"), this.err("       which may put your system at risk."), this.out(""), this.out("       If you understand and want to proceed repeat the command including --classic.")] };
          this.cmds.add("code");
          return { lines: [this.out("code 1.105.1 from Visual Studio Code (vscode\u2713) installed")] };
        }
        if (plain[0] === "list") return { lines: [this.out("Name      Version   Rev    Tracking       Publisher   Notes"), ...(this.cmds.has("code") ? [this.out("code      1.105.1   210    latest/stable  vscode\u2713     classic")] : []), this.out("core22    20250923  2133   latest/stable  canonical\u2713  base")] };
        return { lines: [this.out("Usage: snap install <name> [--classic] | snap list")] };
      }
      case "nano": {
        if (!plain.length) return { lines: [this.hint("Give nano a file name, for example: nano notes.txt")] };
        const p = this.abs(plain[0]);
        if (this.isDir(p)) return { lines: [this.err(`"${plain[0]}" is a directory`)] };
        if (!this.isDir(parentOf(p))) return { lines: [this.err(`Directory '${parentOf(p)}' does not exist`)] };
        return { lines: [], nano: { path: p, name: plain[0], content: this.isFile(p) ? this.node(p).content || "" : "", root } };
      }
      case "grep": {
        const pat = plain[0], files = plain.slice(1);
        if (!pat || !files.length) return { lines: [this.err("Usage: grep PATTERN FILE")] };
        for (const f of files) {
          const p = this.abs(f);
          if (!this.isFile(p)) { L.push(this.err(`grep: ${f}: No such file or directory`)); continue; }
          for (const t of (this.node(p).content || "").split("\n")) if (t.includes(pat)) L.push(this.out(files.length > 1 ? `${f}:${t}` : t));
        }
        return { lines: L };
      }
      case "wc": {
        const f = plain[0];
        if (!f) return { lines: [this.err("wc: missing file")] };
        const p = this.abs(f);
        if (!this.isFile(p)) return { lines: [this.err(`wc: ${f}: No such file or directory`)] };
        return { lines: [this.out(`${(this.node(p).content || "").split("\n").filter((x, i, a) => i < a.length - 1 || x).length} ${f}`)] };
      }
      case "tree": {
        if (!this.cmds.has("tree")) return { lines: [this.err("Command 'tree' not found, but can be installed with:"), this.out(""), this.out("sudo apt install tree")] };
        const start = this.abs(plain[0] || ".");
        const walk = (dir, pre) => this.children(dir).filter((n) => !n.startsWith(".")).forEach((n, i, arr) => {
          const last = i === arr.length - 1, p = `${dir === "/" ? "" : dir}/${n}`;
          L.push({ text: `${pre}${last ? "└── " : "├── "}${n}`, cls: this.isDir(p) ? "dir" : undefined });
          if (this.isDir(p)) walk(p, pre + (last ? "    " : "│   "));
        });
        L.push({ text: plain[0] || ".", cls: "dir" }); walk(start, "");
        return { lines: L };
      }
    }
    const more = this.execMore(cmd, rest, plain, flags, root);
    if (more) return more;
    // not a known command
    const lines = [this.err(`${cmd}: command not found`)];
    if (/^cd\.\.?$/.test(cmd)) lines.push(this.hint("Did you mean cd .. (with a space)?"));
    else if (COMMANDS.includes(cmd.toLowerCase())) lines.push(this.hint(`Commands are case-sensitive. Try ${cmd.toLowerCase()}`));
    else if (this.isFile(this.abs(cmd))) lines.push(this.hint(`To run a file in this folder, type ./${cmd}  (or python3 ${cmd})`));
    return { lines };
  }

  // Lines the tokenizer cannot handle ($( ) in the official install commands), simulated as a whole.
  specialLine(line) {
    const noCurl = () => [this.err("Command 'curl' not found, but can be installed with:"), this.out(""), this.out("sudo apt install curl")];
    if (/^export\s+ROS_APT_SOURCE_VERSION=\$\(curl\b.*ros-apt-source/.test(line)) {
      if (!this.cmds.has("curl")) return noCurl();
      this.env.ROS_APT_SOURCE_VERSION = "1.1.0";
      return [this.hint("(Practice terminal: the newest ros-apt-source version number was looked up on GitHub. See it with: echo $ROS_APT_SOURCE_VERSION)")];
    }
    const m = line.match(/^curl\s.*-o\s+(\S+)\s.*ros-apt-source/);
    if (m) {
      if (!this.cmds.has("curl")) return noCurl();
      if (!this.env.ROS_APT_SOURCE_VERSION) return [this.err("curl: (22) The requested URL returned error: 404"), this.hint("The version number is empty. Run the export ROS_APT_SOURCE_VERSION=... line first.")];
      const p = this.abs(m[1].replace(/^["']|["']$/g, ""));
      if (!this.isDir(parentOf(p))) return [this.err("curl: (23) Failure writing output to destination")];
      this.fs.set(p, { type: "f", mode: "rw-r--r--", content: "(ros2-apt-source package)" });
      return [this.out("  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current"), this.out("100  6012  100  6012    0     0  19500      0 --:--:-- --:--:-- --:--:-- 19500")];
    }
    return null;
  }

  // Extra commands for installing ROS 2 and setting up the lab.
  // $(xacro file) and $(cat file) inside a command: the text is passed on as one value
  substitute(line) {
    let k = Object.keys(this.substs).length, err = null;
    const out = line.replace(/(["']?)\$\((xacro|cat)\s+([^)]*)\)\1/g, (m, q, cmd, argstr) => {
      const parts = argstr.trim().split(/\s+/), file = parts[0], args = {};
      parts.slice(1).forEach((p) => { const mm = p.match(/^([\w-]+):=(.*)$/); if (mm) args[mm[1]] = mm[2]; });
      let text;
      if (cmd === "cat") { const p = this.abs(file || ""); if (!this.isFile(p)) { err = [this.err(`cat: ${file}: No such file or directory`)]; return m; } text = this.node(p).content || ""; }
      else {
        if (!this.sourced) { err = [this.err("xacro: command not found"), this.hint("xacro comes with ROS 2. Run: source /opt/ros/jazzy/setup.bash")]; return m; }
        if (!this.graph) this.graph = new RosGraph(this, []);
        const r = this.graph.expandXacroFile(this.abs(file || ""), args);
        if (r.err) { err = [this.err(r.err)]; return m; }
        text = r.text;
      }
      const key = `@SUBST${k++}@`; this.substs[key] = text; return key;
    });
    return err ? { err } : { line: out };
  }
  // ros2 topic pub ... visualization_msgs/msg/Marker "{...}"  or  sensor_msgs/msg/JointState "{name: [...], position: [...]}"
  vizPub(args) {
    const ti = args.findIndex((a) => /^(visualization_msgs\/msg\/Marker|sensor_msgs\/msg\/JointState)$/.test(a));
    if (ti < 0) return null;
    const type = args[ti], topic = args.slice(2, ti).filter((a) => !a.startsWith("-") && !/^\d+$/.test(a)).pop() || "", yaml = args[ti + 1] || "{}";
    let msg;
    try { msg = parseFlowYaml(yaml); if (!msg || typeof msg !== "object" || Array.isArray(msg)) throw new Error("not a dictionary"); }
    catch (e) { return [this.err("The passed value needs to be a dictionary in YAML format"), this.hint(`Check the braces, colons and commas: ${e.message}`)]; }
    const once = args.includes("--once") || args.includes("-1");
    if (type === "sensor_msgs/msg/JointState") {
      const names = msg.name || [], pos = msg.position || [];
      if (!Array.isArray(names) || !Array.isArray(pos) || names.length !== pos.length) return [this.err("name and position must be lists of the same length, e.g. {name: [elbow_joint], position: [1.0]}")];
      names.forEach((n, i) => { this.viz.joints[n] = Number(pos[i]); });
      this.viz.jsPub = true;
      return [this.out("publisher: beginning loop"), this.out(`publishing #1: sensor_msgs.msg.JointState(header=..., name=[${names.map((n) => `'${n}'`).join(", ")}], position=[${pos.join(", ")}], velocity=[], effort=[])`), ...(once ? [] : [this.out("^C")]),
        this.hint("robot_state_publisher turned these joint values into new TF transforms. (Running joint_state_publisher at the same time would overwrite them.)")];
    }
    const shown = this.graph && this.graph.nodes.some((n) => n.kind === "rviz");
    const abs = topic.startsWith("/") ? topic : "/" + topic;
    const line = `publishing #1: visualization_msgs.msg.Marker(header=std_msgs.msg.Header(frame_id='${(msg.header && msg.header.frame_id) || ""}'), ns='${msg.ns || ""}', id=${msg.id || 0}, type=${msg.type || 0}, action=${msg.action || 0}, ...)`;
    if (once && !this.vizSubscribed(abs)) {   // Jazzy: --once waits for a matching subscription before it publishes
      this.viz.pending = [...(this.viz.pending || []).filter((p) => !(p.topic === abs && p.msg.ns === msg.ns && p.msg.id === msg.id)), { topic: abs, msg: { ...msg, __topic: topic }, line }];
      return [this.out("Waiting for at least 1 matching subscription(s)..."), this.hint(shown ? `(ros2 topic pub --once waits until something subscribes to ${abs}. In RViz, Add a Marker display and set its Topic to ${abs} (a new Marker display starts with an empty Topic). The message goes out as soon as RViz subscribes.)` : `(Nothing subscribes to ${abs}, so --once keeps waiting. Start rviz2 and add a Marker display with Topic ${abs}.)`)];
    }
    this.viz.markers.push({ ...msg, __topic: topic });
    return [this.out("publisher: beginning loop"), this.out(`publishing #1: visualization_msgs.msg.Marker(header=std_msgs.msg.Header(frame_id='${(msg.header && msg.header.frame_id) || ""}'), ns='${msg.ns || ""}', id=${msg.id || 0}, type=${msg.type || 0}, action=${msg.action || 0}, ...)`), ...(once ? [] : [this.out("^C")]),
      this.hint(shown ? (this.viz.displays.Marker ? "Look at RViz below." : "RViz shows markers only after you Add a Marker display (topic /visualization_marker).") : "RViz is not running, so nobody draws this marker yet.")];
  }

  // does RViz subscribe to this topic? (a Marker display also takes <topic>_array)
  vizSubscribed(topic) {
    const f = this.viz.subsFn, subs = f ? f() : null;
    if (subs) return subs.some(([t, type]) => t === topic || (type === "visualization_msgs/msg/Marker" && t + "_array" === topic));
    return (this.viz.topics || []).includes(topic);
  }
  // messages waiting for a subscriber (ros2 topic pub --once): sent when RViz subscribes
  flushPending() {
    const out = [];
    for (const p of this.viz.pending || []) if (this.vizSubscribed(p.topic)) { this.viz.markers.push(p.msg); out.push("publisher: beginning loop", p.line); p.sent = true; }
    this.viz.pending = (this.viz.pending || []).filter((p) => !p.sent);
    return out;
  }

  execMore(cmd, rest, plain, flags, root) {
    if (cmd === "xacro") {
      if (!this.sourced) return { lines: [this.err("Command 'xacro' not found"), this.hint("xacro comes with ROS 2. Run: source /opt/ros/jazzy/setup.bash")] };
      if (!plain[0]) return { lines: [this.err("usage: xacro [options] input_file [mapping:=value ...]")] };
      if (!this.graph) this.graph = new RosGraph(this, []);
      const args = {}; plain.slice(1).forEach((p) => { const m = p.match(/^([\w-]+):=(.*)$/); if (m) args[m[1]] = m[2]; });
      const r = this.graph.expandXacroFile(this.abs(plain[0]), args);
      if (r.err) return { lines: [this.err(r.err)] };
      return { lines: r.text.replace(/\n$/, "").split("\n").map((t) => this.out(t)) };
    }
    if (cmd === "check_urdf") { if (!this.graph) this.graph = new RosGraph(this, []); return { lines: this.graph.checkUrdf(plain[0]) }; }
    if (cmd === "urdf_to_graphviz" || cmd === "urdf_to_graphiz") { if (!this.graph) this.graph = new RosGraph(this, []); return { lines: this.graph.urdfToGraphviz(plain[0], plain[1]) }; }
    if (cmd === "rviz2") {
      if (!this.sourced) return { lines: [this.err("Command 'rviz2' not found"), this.hint("Run: source /opt/ros/jazzy/setup.bash")] };
      if (!this.graph) this.graph = new RosGraph(this, []);
      return { lines: this.graph.start("rviz2", "rviz2", rest) || [] };
    }
    const need = (c, pkg) => (this.cmds.has(c) ? null : { lines: [this.err(`Command '${c}' not found, but can be installed with:`), this.out(""), this.out(`sudo apt install ${pkg}`)] });
    switch (cmd) {
      case "locale":
        return { lines: ["LANG=en_US.UTF-8", "LANGUAGE=", 'LC_CTYPE="en_US.UTF-8"', "LC_ALL="].map((t) => this.out(t)) };
      case "locale-gen":
        if (!root) return { lines: [this.err("Error: must be run as root"), this.hint("Try: sudo locale-gen en_US en_US.UTF-8")] };
        return { lines: [this.out("Generating locales (this might take a while)..."), this.out("  en_US.UTF-8... done"), this.out("Generation complete.")] };
      case "update-locale":
        if (!root) return { lines: [this.err("update-locale: Unable to write /etc/default/locale: Permission denied"), this.hint("Put sudo in front.")] };
        this.localeSet = true;
        return { lines: [] };
      case "add-apt-repository": {
        const n = need("add-apt-repository", "software-properties-common"); if (n) return n;
        if (!root) return { lines: [this.err("Error: must run as root"), this.hint("Try: sudo add-apt-repository universe")] };
        if (plain[0] !== "universe") return { lines: [this.hint("In this course we only need: sudo add-apt-repository universe")] };
        this.universe = true;
        return { lines: [this.out("Adding component(s) 'universe' to all repositories."), this.out("Reading package lists... Done")] };
      }
      case "curl": {
        const n = need("curl", "curl"); if (n) return n;
        return { lines: [this.hint("(Practice terminal: there is no internet here. The lesson's install commands are simulated.)")] };
      }
      case "dpkg": {
        if (!flags.includes("i")) return { lines: [this.hint("In this course we use dpkg only like this: sudo dpkg -i file.deb")] };
        if (!root) return { lines: [this.err("dpkg: error: requested operation requires superuser privilege")] };
        const f = plain[0], p = f ? this.abs(f) : "";
        if (!f || !this.isFile(p)) return { lines: [this.err(`dpkg: error: cannot access archive '${f || ""}': No such file or directory`)] };
        if (!/ros2-apt-source/.test(p)) return { lines: [this.out(`Unpacking ${baseName(p)} ...`)] };
        this.rosRepo = true; this.updatedAfterRepo = false;
        const v = this.env.ROS_APT_SOURCE_VERSION || "1.1.0";
        return { lines: ["Selecting previously unselected package ros2-apt-source.", "Preparing to unpack .../ros2-apt-source.deb ...",
          `Unpacking ros2-apt-source (${v}~noble) ...`, `Setting up ros2-apt-source (${v}~noble) ...`].map((t) => this.out(t)) };
      }
      case "rosdep": {
        const n = need("rosdep", "python3-rosdep"); if (n) return n;
        const sub = plain[0];
        if (sub === "init") {
          if (!root) return { lines: [this.err("ERROR: cannot create /etc/ros/rosdep/sources.list.d/20-default.list: [Errno 13] Permission denied"), this.hint("rosdep init needs sudo: sudo rosdep init")] };
          if (this.rosdepInit) return { lines: [this.err("ERROR: default sources list file already exists:"), this.err("\t/etc/ros/rosdep/sources.list.d/20-default.list"), this.err("Please delete if you wish to re-initialize"), this.hint("That is fine: it was done once already. Just run rosdep update.")] };
          this.rosdepInit = true; this.mkdirP("/etc/ros/rosdep/sources.list.d");
          this.fs.set("/etc/ros/rosdep/sources.list.d/20-default.list", { type: "f", mode: "rw-r--r--", content: "# rosdep sources\n" });
          return { lines: ["Wrote /etc/ros/rosdep/sources.list.d/20-default.list", "Recommended: please run", "", "\trosdep update"].map((t) => this.out(t)) };
        }
        if (sub === "update") {
          if (!this.rosdepInit) return { lines: [this.err("ERROR: no sources directory exists on the system meaning rosdep has not yet been initialized."), this.hint("Run sudo rosdep init first.")] };
          const L = root ? [this.out("Warning: running 'rosdep update' as root is not recommended."), this.hint("Next time, run rosdep update WITHOUT sudo.")] : [];
          this.rosdepUpdated = true;
          return { lines: [...L, this.out("reading in sources list data from /etc/ros/rosdep/sources.list.d"),
            this.out("Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/base.yaml"),
            this.out("Hit https://raw.githubusercontent.com/ros/rosdistro/master/rosdep/python.yaml"),
            this.out(`updated cache in ${HOME}/.ros/rosdep/sources.cache`)] };
        }
        if (sub === "install") {
          if (!this.rosdepUpdated) return { lines: [this.err("ERROR: your rosdep installation has not been initialized yet."), this.hint("Run sudo rosdep init and then rosdep update first.")] };
          return { lines: [this.out("#All required rosdeps installed successfully")] };
        }
        return { lines: [this.out("Usage: rosdep init | rosdep update | rosdep install --from-paths src -y --ignore-src")] };
      }
      case "colcon": {
        const n = need("colcon", "python3-colcon-common-extensions"); if (n) return n;
        if (plain[0] === "test" || plain[0] === "test-result") return { lines: this.colconTest(plain[0], rest) };
        if (plain[0] !== "build") return { lines: [this.out("usage: colcon build [--symlink-install]")] };
        if (!this.sourced) return { lines: [this.err("colcon build: ROS 2 is not loaded in this terminal"), this.hint("Run source /opt/ros/jazzy/setup.bash first.")] };
        const L = [];
        if (baseName(this.cwd) === "src") L.push(this.hint("Careful: you are inside src. colcon build belongs in the workspace folder (cd .. first)."));
        else if (!this.isDir(`${this.cwd === "/" ? "" : this.cwd}/src`)) L.push(this.hint("There is no src folder here. Is this your workspace folder?"));
        const ws = this.cwd === "/" ? "" : this.cwd;
        for (const d of ["build", "install", "log"]) this.mkdirP(`${ws}/${d}`);
        this.fs.set(`${ws}/install/setup.bash`, { type: "f", mode: "rw-r--r--", content: "# workspace overlay\n" });
        this.fs.set(`${ws}/install/local_setup.bash`, { type: "f", mode: "rw-r--r--", content: "# workspace overlay (this workspace only)\n" });
        let pkgs = findPackages(this, this.cwd);
        const sel = rest.indexOf("--packages-select");
        if (sel >= 0) pkgs = pkgs.filter((p) => rest.slice(sel + 1).includes(p.name));
        const failed = pkgs.filter((p) => p.errors && p.errors.length);
        if (failed.length) {
          const ok = pkgs.filter((p) => !failed.includes(p));
          this.installs[`${ws}/install`] = [...(this.installs[`${ws}/install`] || []).filter((p) => !ok.some((q) => q.name === p.name)), ...ok];
          for (const p of ok) this.mkdirP(`${ws}/install/${p.name}`);
          for (const p of pkgs) L.push(this.out(`Starting >>> ${p.name}`));
          for (const p of ok) L.push(this.out(`Finished <<< ${p.name} [1.02s]`));
          for (const p of failed) { L.push(this.err(`--- stderr: ${p.name}`), ...p.errors.map((e) => this.err(e)), this.err("---"), this.err(`Failed   <<< ${p.name} [1.37s, exited with code 1]`)); }
          L.push(this.out(""), this.out(`Summary: ${ok.length} package${ok.length === 1 ? "" : "s"} finished [1.6s]`), this.err(`  ${failed.length} package${failed.length === 1 ? "" : "s"} failed: ${failed.map((p) => p.name).join(" ")}`));
          L.push(this.hint("Read the first error line under --- stderr. Fix the file, then run colcon build again."));
          return { lines: L };
        }
        this.installs[`${ws}/install`] = [...(this.installs[`${ws}/install`] || []).filter((p) => !pkgs.some((q) => q.name === p.name)), ...pkgs];
        for (const p of pkgs) this.mkdirP(`${ws}/install/${p.name}`);
        const t = (i) => (0.9 + i * 0.37).toFixed(2);
        pkgs.forEach((p, i) => L.push(this.out(`Starting >>> ${p.name}`)));
        pkgs.forEach((p, i) => L.push(this.out(`Finished <<< ${p.name} [${t(i)}s]`)));
        if (pkgs.length) L.push(this.out(""));
        L.push(this.out(`Summary: ${pkgs.length} package${pkgs.length === 1 ? "" : "s"} finished [${t(pkgs.length)}s]`));
        if (pkgs.length) L.push(this.hint("Built. Now load the workspace in this terminal: source install/setup.bash"));
        return { lines: L };
      }
      case "gz": {
        const n = need("gz", "ros-jazzy-ros-gz"); if (n) return n;
        if (rest[0] === "sim") {
          if (rest.includes("--help") || rest.includes("-h")) return { lines: ["Usage: gz sim [options] [file]", "  -r            Run simulation on start.", "  -s            Run only the server (headless mode).", "  -g            Run only the GUI.", "  -v [arg]      Adjust the level of console output (0~4). Default 1.", "  --render-engine [arg]  ogre or ogre2 (default)."].map((t) => this.out(t)) };
          const r = this.graph.gzSim(rest.slice(1));
          if (r.err) return { lines: r.err.map((t) => this.err(t)) };
          this.graph.lastStarted = [r.node.full];
          return { lines: [...r.lines.map((t) => this.out(t)), this.hint(`(Gazebo opened: world "${this.graph.gz.world.name}"${this.graph.gz.paused ? ", paused. Press ▶ in its window, or start it with gz sim -r ..." : ", running"}. It keeps this terminal busy, like on Ubuntu.)`)] };
        }
        const r = this.graph.gzCli(rest);
        if (r) return r;
        return { lines: [this.out("usage: gz sim <world.sdf>")] };
      }
      case "rqt_graph": case "rviz2":
        if (!this.sourced) return { lines: [this.err(`${cmd}: command not found`), this.hint("Load ROS 2 first: source /opt/ros/jazzy/setup.bash")] };
        return { lines: [this.hint(`(Practice terminal: the ${cmd === "rviz2" ? "RViz 3D viewer" : "rqt graph window"} would open here.)`)] };
      case "g++":
        return { lines: this.compileCpp(rest) };
    }
    return null;
  }

  // A tiny pretend C++ compiler: checks the most common beginner mistakes.
  compileCpp(args) {
    const src = args.find((a) => a.endsWith(".cpp"));
    const oi = args.indexOf("-o");
    const outName = oi >= 0 ? args[oi + 1] : "a.out";
    if (!src) return [this.err("g++: fatal error: no input files"), this.out("compilation terminated.")];
    const p = this.abs(src);
    if (!this.isFile(p)) return [this.err(`cc1plus: fatal error: ${src}: No such file or directory`), this.out("compilation terminated.")];
    const code = this.node(p).content || "";
    const lines = code.split("\n");
    if (/std::cout/.test(code) && !/#include\s*<iostream>/.test(code)) return [this.err(`${src}: error: 'cout' is not a member of 'std'`), this.hint("Add #include <iostream> at the top of the file.")];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].replace(/\/\/.*$/, "").trim();
      if (!t || t.startsWith("#")) continue;
      if (/^(std::cout|return\b|int |double |bool |std::string |auto )/.test(t) && !/[;{}]$/.test(t) && !/^(int|double|bool|auto)\s+\w+\s*\(.*\)\s*$/.test(t)) {
        const next = lines.slice(i + 1).map((x) => x.trim()).find(Boolean) || "}";
        return [this.err(`${src}:${i + 1}:${t.length + 1}: error: expected ';' before '${next.split(/[\s(;]/)[0]}'`), this.hint(`Line ${i + 1} needs a semicolon ; at the end.`)];
      }
    }
    if (!/int\s+main\s*\(/.test(code)) return [this.err("/usr/bin/ld: (.text+0x1b): undefined reference to `main'"), this.err("collect2: error: ld returned 1 exit status"), this.hint("Every C++ program needs an int main() function.")];
    this.fs.set(this.abs(outName), { type: "f", mode: "rwxr-xr-x", content: `#cpp-binary\n${code}` });
    return [];
  }

  // Runs a compiled practice program: variables, std::cout and simple for loops.
  runCpp(source) {
    const vars = {};
    const val = (x) => {
      x = x.trim();
      const s = x.match(/^"(.*)"$/); if (s) return s[1];
      if (/^-?\d+(\.\d+)?$/.test(x)) return Number(x);
      if (x === "true" || x === "false") return x === "true" ? 1 : 0;
      const op = x.match(/^(\w+)\s*([+\-*/])\s*(\w+(?:\.\d+)?)$/);
      if (op) { const a = Number(val(op[1])), b = Number(val(op[3])); return { "+": a + b, "-": a - b, "*": a * b, "/": b ? (Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b) : NaN }[op[2]]; }
      return x in vars ? vars[x] : x;
    };
    const out = [];
    let buf = "";
    const cout = (stmt) => {
      for (const part of stmt.replace(/^std::cout\s*<</, "").replace(/;\s*$/, "").split("<<")) {
        const t = part.trim();
        if (t === "std::endl" || t === '"\\n"') { out.push(buf); buf = ""; }
        else buf += String(val(t));
      }
    };
    const body = String(source).split("\n").map((l) => l.replace(/\/\/.*$/, "").trim());
    for (let i = 0; i < body.length; i++) {
      const t = body[i];
      const decl = t.match(/^(?:int|double|float|bool|auto|std::string)\s+(\w+)\s*=\s*(.+);$/);
      const assign = t.match(/^(\w+)\s*(\+|-)?=\s*(.+);$/);
      const loop = t.match(/^for\s*\(\s*int\s+(\w+)\s*=\s*(-?\d+)\s*;\s*\w+\s*(<|<=)\s*(\w+)\s*;\s*\w+\+\+\s*\)\s*\{$/);
      if (decl) vars[decl[1]] = val(decl[2]);
      else if (loop) {
        const inner = [];
        while (++i < body.length && body[i] !== "}") inner.push(body[i]);
        const end = Number(val(loop[4])) + (loop[3] === "<=" ? 1 : 0);
        for (let k = Number(loop[2]); k < end && k < 1000; k++) { vars[loop[1]] = k; inner.filter((x) => x.startsWith("std::cout")).forEach(cout); }
      } else if (t.startsWith("std::cout")) cout(t);
      else if (assign && assign[1] in vars) vars[assign[1]] = assign[2] ? val(`${assign[1]} ${assign[2]} ${assign[3]}`) : val(assign[3]);
    }
    if (buf) out.push(buf);
    return out.map((t) => this.out(t));
  }

  caseHint(target) {
    const p = this.abs(target), dir = parentOf(p), name = baseName(p);
    const match = this.isDir(dir) && this.children(dir).find((n) => n.toLowerCase() === name.toLowerCase() && n !== name);
    return match ? [this.hint(`Linux is case-sensitive: did you mean ${match}?`)] : [];
  }

  doSource(arg, quiet) {
    const p = this.abs(arg);
    if (!this.isFile(p)) return quiet ? [] : [this.err(`bash: ${arg}: No such file or directory`)];
    if (/\/install\/(local_)?setup\.bash$/.test(p)) {
      for (const pk of this.installs[parentOf(p)] || []) { this.wsPkgs.set(pk.name, pk); this.rosPkgs.add(pk.name); }
      this.applySource(); return [];
    }
    if (p === "/opt/ros/jazzy/setup.bash") { this.applySource(); return []; }
    if (p === `${HOME}/.bashrc`) { this.runRcText(this.node(p).content || ""); return []; }
    this.runRcText(this.node(p).content || "");
    return [];
  }

  apt(args, root) {
    const [sub, ...pkgs] = args.filter((a) => a !== "-y");
    const lockErr = (what) => [
      this.err(`E: Could not open lock file ${what} - open (13: Permission denied)`),
      this.err(`E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?`),
      this.hint("Installing changes the system, so it needs administrator rights: put sudo in front."),
    ];
    if (!sub) return [this.out(HELP.apt)];
    if (sub === "update") {
      if (!root) return [this.err("E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)"), this.err("E: Unable to lock directory /var/lib/apt/lists/"), this.hint("Try: sudo apt update")];
      this.aptUpdated = true;
      if (this.rosRepo) this.updatedAfterRepo = true;
      return [this.out("Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease"), ...(this.rosRepo ? [this.out("Get:2 http://packages.ros.org/ros2/ubuntu noble InRelease")] : []),
        this.out("Reading package lists... Done"), this.out("Building dependency tree... Done"), this.out("All packages are up to date.")];
    }
    if (sub === "upgrade") {
      if (!root) return lockErr("/var/lib/dpkg/lock-frontend");
      return [this.out("Reading package lists... Done"), this.out("Calculating upgrade... Done"), this.out("0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.")];
    }
    if (sub === "install") {
      if (!pkgs.length) return [this.err("E: No packages given. Example: sudo apt install ros-jazzy-turtlesim")];
      if (!root) return lockErr("/var/lib/dpkg/lock-frontend");
      const L = [this.out("Reading package lists... Done"), this.out("Building dependency tree... Done")];
      const names = pkgs.flatMap((n) => (n.endsWith("*") ? Object.keys(APT).filter((k) => k.startsWith(n.slice(0, -1))) : [n]));
      if (!names.length) return [this.err(`E: Unable to locate package ${pkgs[0]}`)];
      for (const name of names) {
        const info = APT[name];
        if (info && info.repo && !(this.rosRepo && this.updatedAfterRepo)) {
          L.push(this.err(`E: Unable to locate package ${name}`));
          L.push(this.hint(this.rosRepo ? "The ROS 2 package source was just added: run sudo apt update first." : "Ubuntu cannot find ROS 2 packages yet. Add the ROS 2 package source (ros2-apt-source) and run sudo apt update."));
          continue;
        }
        if (!info) { L.push(this.err(`E: Unable to locate package ${name}`)); if (/_/.test(name)) L.push(this.hint("apt package names use - (dashes), for example ros-jazzy-demo-nodes-py")); continue; }
        const ros = info.ros || [], cmds = info.cmd || [];
        const have = (info.desktop ? this.rosInstalled : true) && ros.every((p) => this.rosPkgs.has(p)) && cmds.every((c) => this.cmds.has(c)) && (ros.length || cmds.length || this.aptDone.has(name));
        if (have) { L.push(this.out(`${name} is already the newest version.`)); continue; }
        ros.forEach((p) => this.rosPkgs.add(p)); cmds.forEach((c) => this.cmds.add(c)); this.aptDone.add(name);
        if (info.desktop) {
          this.rosInstalled = true;
          for (const d of ["/opt/ros", "/opt/ros/jazzy", "/opt/ros/jazzy/bin", "/opt/ros/jazzy/share"]) this.fs.set(d, { type: "d", mode: "rwxr-xr-x" });
          this.fs.set("/opt/ros/jazzy/setup.bash", { type: "f", mode: "rw-r--r--", content: "# Loads ROS 2 Jazzy into this terminal\n" });
          L.push(this.out("The following NEW packages will be installed:"), this.out("  ros-jazzy-desktop and about 1,500 more packages"),
            this.hint("(On a real computer this downloads a few GB and takes 10 to 40 minutes. Keep the laptop plugged in.)"), this.out("Setting up ros-jazzy-desktop ..."));
        } else {
          L.push(this.out("The following NEW packages will be installed:"), this.out(`  ${name}`), this.out(`Setting up ${name} ...`));
        }
      }
      return L;
    }
    if (sub === "search") {
      const w = (pkgs[0] || "").toLowerCase();
      const hits = Object.entries(APT).filter(([n, i]) => n.includes(w) || i.about.toLowerCase().includes(w));
      if (!hits.length) return [this.out("Sorting... Done"), this.out("Full Text Search... Done")];
      return [this.out("Sorting... Done"), this.out("Full Text Search... Done"), ...hits.flatMap(([n, i]) => [{ text: `${n}/noble`, cls: "exe" }, this.out(`  ${i.about}`), this.out("")])];
    }
    return [this.err(`E: Invalid operation ${sub}`)];
  }

  ros2(args) {
    if (!this.sourced) return [this.err("ros2: command not found"), this.hint("This terminal has not loaded ROS 2 yet. Load it with: source /opt/ros/jazzy/setup.bash")];
    const [sub, a, b] = args;
    if (!sub || sub === "--help" || sub === "-h") return [this.out(HELP.ros2)];
    if (sub === "pkg" && a === "create") return pkgCreate(this, args.slice(2));
    if (sub === "control") return this.graph ? this.graph.ros2Control(args.slice(1)) : [this.err("Could not contact service /controller_manager/list_controllers")];
    if (sub === "pkg" && a === "executables") {
      if (!b) return [this.err("usage: ros2 pkg executables <package_name>")];
      const ws = this.wsPkgs.get(b);
      const ex = ws ? Object.keys(ws.exes) : this.rosPkgs.has(b) ? pkgExecutables(b) || [] : null;
      return ex ? ex.map((e) => this.out(`${b} ${e}`)) : [this.err(`Package not found`)];
    }
    if (sub === "run") {
      if (!a || !b) return [this.err("usage: ros2 run <package_name> <executable_name>")];
      const ws = this.wsPkgs.get(a);
      if (ws) {
        if (ws.notRunnable && b in ws.notRunnable) return [this.err("No executable found"), this.hint(ws.notRunnable[b])];
        if (!(b in ws.exes)) return [this.err("No executable found"), this.hint(`See the programs in this package with: ros2 pkg executables ${a}`)];
        if (this.graph && /^add_scene_objects\.py$/.test(b)) return this.graph.mgSceneScript(ws);   // a MoveIt config's planning scene script
        const info = ws.infos && ws.infos[b];
        if (info && info.node && this.graph) return this.graph.startCustom(a, b, info, ws.exes[b], args.slice(3));
        return ws.exes[b].length ? ws.exes[b].map((t) => this.out(t)) : [this.hint("(The program ran but printed nothing.)")];
      }
      if (this.graph && this.rosPkgs.has(a)) { const r = this.graph.start(a, b, args.slice(3)); if (r) return r; }
      if (!this.rosPkgs.has(a)) return [this.err(`Package '${a}' not found`), this.hint("Is it installed (sudo apt install ros-jazzy-...)? Is the name spelled with _ underscores?")];
      const runs = {
        "turtlesim turtlesim_node": ["[INFO] [turtlesim]: Starting turtlesim with node name /turtlesim", "[INFO] [turtlesim]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]"],
        "demo_nodes_py talker": [1, 2, 3, 4, 5].map((i) => `[INFO] [talker]: Publishing: "Hello World: ${i}"`),
        "demo_nodes_cpp talker": [1, 2, 3, 4, 5].map((i) => `[INFO] [talker]: Publishing: 'Hello World: ${i}'`),
        "demo_nodes_py listener": [1, 2, 3].map((i) => `[INFO] [listener]: I heard: [Hello World: ${i}]`),
        "demo_nodes_cpp listener": [1, 2, 3].map((i) => `[INFO] [listener]: I heard: [Hello World: ${i}]`),
        "teleop_twist_keyboard teleop_twist_keyboard": ["This node takes keypresses from the keyboard and publishes them", "as Twist messages. Moving around:  u i o / j k l / m , ."],
        "turtlesim turtle_teleop_key": ["Reading from keyboard", "---------------------------", "Use arrow keys to move the turtle."],
        "tf2_tools view_frames": ["[INFO] [view_frames]: Listening to tf data for 5.0 seconds...", "[INFO] [view_frames]: Generating graph in frames.pdf file..."],
      };
      const lines = runs[`${a} ${b}`];
      if (!lines) return [this.err(`No executable found`), this.hint(`Check the program name. For example: ros2 run ${a} talker`)];
      const extra = a.endsWith("listener") || b === "listener" ? " (In a real computer the listener prints only while a talker is running in another terminal.)" : "";
      return [...lines.map((t) => this.out(t)), this.out("^C"), this.hint(`Practice terminal stopped the program for you. On a real computer it keeps running until you press Ctrl+C.${extra}`)];
    }
    if (sub === "launch" && (a === "urdf_tutorial" || a === "urdf_launch")) { if (!this.graph) this.graph = new RosGraph(this, []); return this.graph.vizLaunch(a, b, args.slice(3)); }
    if (sub === "topic" && a === "pub") { const r = this.vizPub(args); if (r) return r; }
    if (sub === "topic" && a === "echo" && ["/goal_pose", "/clicked_point", "/initialpose"].includes(args[2]) && this.graph && this.graph.nodes.some((n) => n.kind === "rviz")) {
      const p = (this.viz.published || {})[args[2]];
      if (!p) return [this.hint(`(Waiting for a message on ${args[2]}. In RViz, pick the ${args[2] === "/goal_pose" ? "2D Goal Pose" : args[2] === "/clicked_point" ? "Publish Point" : "2D Pose Estimate"} tool and click in the 3D view, then run this command again.)`)];
      const yaml = (o, ind = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? [`${ind}${k}:`, ...yaml(v, ind + "  ")] : [`${ind}${k}: ${Array.isArray(v) ? (v.length > 6 ? "\n" + v.map((x) => `${ind}- ${x}`).join("\n") : "[" + v.join(", ") + "]") : typeof v === "string" ? v : k === "sec" || k === "nanosec" ? v : Number.isInteger(v) ? v.toFixed(1) : String(Number(Number(v).toFixed(9)))}`]));
      return [...yaml(p.msg).flatMap((l) => l.split("\n")).map((t) => this.out(t)), this.out("---")];
    }
    if (sub === "launch") {
      if (this.wsPkgs.has(a)) { if (!this.graph) this.graph = new RosGraph(this, []); return this.graph.launchUser(this.wsPkgs.get(a), b, args.slice(3)); }
      const r = this.graph && this.rosPkgs.has(a) ? this.graph.launch(a, b) : null; return r || this.ros2Launch(a, b);
    }
    if (this.graph) { const r = this.graph.run(args); if (r) return r; }
    if (sub === "topic" && a === "list") return [this.out("/parameter_events"), this.out("/rosout")];
    if (sub === "topic" && a === "echo") return [this.out(`WARNING: topic [${b || "/chatter"}] does not appear to be published yet`), this.hint("Nothing is publishing in this practice terminal. In a real lab, start a talker in another terminal first.")];
    if (sub === "node" && a === "list") return [this.hint("(No nodes are running in this practice terminal. Real output would list one node per line, like /talker.)")];
    if (sub === "pkg" && a === "list") return [...this.rosPkgs].sort().map((p) => this.out(p));
    if (["service", "param", "action", "interface", "bag", "doctor"].includes(sub)) return [this.hint(`(This practice terminal has no running ROS 2 system for "ros2 ${sub}". The Week 3 lessons have terminals where it works.)`)];
    return [this.err(`ros2: unknown command '${args.join(" ")}'.`), this.hint("Try: ros2 --help")];
  }

  ros2Launch(pkg, file) {
    if (!pkg || !file) return [this.err("usage: ros2 launch <package_name> <launch_file>")];
    if (!this.rosPkgs.has(pkg)) return [this.err(`Package '${pkg}' not found: "package '${pkg}' not found, searching: ['/opt/ros/jazzy']"`), this.hint("Install it with apt (the apt name uses dashes: ros-jazzy-...), then source again.")];
    const start = (names) => ["[INFO] [launch]: All log files can be found below /home/student/.ros/log", ...names.map((n, i) => `[INFO] [${n}-${i + 1}]: process started with pid [${4100 + i * 7}]`)];
    const K = {
      "turtlebot3_gazebo turtlebot3_world.launch.py": { model: true, lines: start(["gz", "robot_state_publisher", "ros_gz_bridge", "create"]), hint: "Gazebo would open with a TurtleBot3 in the TurtleBot3 world. Drive it from a second terminal with teleop_twist_keyboard." },
      "turtlebot3_gazebo empty_world.launch.py": { model: true, lines: start(["gz", "robot_state_publisher", "ros_gz_bridge", "create"]), hint: "Gazebo would open with a TurtleBot3 in an empty world." },
      "turtlebot3_cartographer cartographer.launch.py": { model: true, lines: start(["cartographer_node", "cartographer_occupancy_grid_node", "rviz2"]), hint: "RViz would open and draw a map while you drive the robot." },
      "nav2_bringup tb3_simulation_launch.py": { also: "nav2_minimal_tb3_sim", lines: start(["gz", "robot_state_publisher", "map_server", "amcl", "controller_server", "planner_server", "bt_navigator", "rviz2"]), hint: "Gazebo and RViz would open. In RViz click 2D Pose Estimate (where the robot is), then Nav2 Goal (where it should go)." },
      "moveit_resources_panda_moveit_config demo.launch.py": { lines: start(["robot_state_publisher", "ros2_control_node", "move_group", "rviz2"]), hint: "RViz would open with the Panda robot arm. Drag the arm's target, then press Plan & Execute." },
      "gz_ros2_control_demos cart_example_position.launch.py": { lines: start(["gz", "robot_state_publisher", "ros2_control_node", "spawner"]), hint: "Gazebo would show a small cart moved by a ros2_control position controller." },
      "slam_toolbox online_async_launch.py": { lines: start(["async_slam_toolbox_node"]), hint: "slam_toolbox would build a map from the robot's laser scans." },
    };
    const k = K[`${pkg} ${file}`];
    if (!k) return [this.err(`file '${file}' was not found in the share directory of package '${pkg}' at '/opt/ros/jazzy/share/${pkg}'`)];
    if (k.also && !this.rosPkgs.has(k.also)) return [this.err(`Package '${k.also}' not found`), this.hint("Install the Nav2 demo robots: sudo apt install ros-jazzy-nav2-minimal-tb3-sim")];
    if (k.model && !this.env.TURTLEBOT3_MODEL) return [this.out(start([])[0]), this.err("[ERROR] [launch]: Caught exception in launch (see debug for traceback): 'TURTLEBOT3_MODEL'"), this.hint("The TurtleBot3 launch files need to know which robot to use: export TURTLEBOT3_MODEL=burger")];
    return [...k.lines.map((t) => this.out(t)), this.out("^C"), this.hint(`Practice terminal: ${k.hint} On a real computer it keeps running until you press Ctrl+C.`)];
  }

  runFile(arg, direct) {
    const p = this.abs(arg);
    const shown = direct ? `bash: ${arg}` : `python3: can't open file '${p}'`;
    if (!this.fs.has(p)) return [this.err(direct ? `${shown}: No such file or directory` : `${shown}: [Errno 2] No such file or directory`)];
    if (this.isDir(p)) return [this.err(`${direct ? shown : "python3"}: Is a directory`)];
    const nd = this.node(p);
    if (direct && nd.mode[2] !== "x") return [this.err(`${shown}: Permission denied`), this.hint(`The file is not executable yet. Try: chmod +x ${baseName(p)}`)];
    if ((nd.content || "").startsWith("#cpp-binary\n")) return direct ? this.runCpp(nd.content.slice(12)) : [this.err(`python3: ${arg} is a compiled C++ program. Run it with ./${baseName(p)}`)];
    const code = nd.content || "";
    if (!direct && /^\s*(import rclpy|from rclpy)/m.test(code)) {   // a ROS 2 node run straight from its file (python3 my_node.py)
      if (!this.sourced) return [this.err("Traceback (most recent call last):"), this.err(`  File "${p}", line ${code.split("\n").findIndex((l) => /rclpy/.test(l)) + 1}, in <module>`), this.err(`    ${(code.split("\n").find((l) => /rclpy/.test(l)) || "import rclpy").trim()}`), this.err("ModuleNotFoundError: No module named 'rclpy'"), this.hint("rclpy comes with ROS 2. Load it first: source /opt/ros/jazzy/setup.bash")];
      const info = parseNodeCode(code, "python");
      if (info.node && this.graph && /\bmain\s*\(/.test(code) && /__main__/.test(code)) {
        const prints = [...code.matchAll(/print\(\s*(["'])(.*?)\1\s*\)/g)].map((x) => x[2]);
        return this.graph.startCustom("", baseName(p), info, prints.concat(info.logs), []);
      }
      if (info.node && !/__main__/.test(code)) return [this.hint("(Nothing happened: the file defines main() but never calls it. Add  if __name__ == '__main__': main()  at the end, or run it with ros2 run after colcon build.)")];
    }
    // anything more than plain print("text") lines really runs (in the browser page, through Pyodide)
    const plainOnly = code.split("\n").every((l) => !l.trim() || /^\s*#/.test(l) || /^\s*print\(\s*(["']).*\1\s*\)\s*$/.test(l));
    if (!direct && !plainOnly && typeof window !== "undefined") return { python: { code, path: p } };
    const out = [];
    for (const raw of (nd.content || "").split("\n")) {
      const m = raw.match(/^\s*print\(\s*(["'])(.*)\1\s*\)\s*$/) || raw.match(/^\s*echo\s+["']?(.*?)["']?\s*$/);
      if (m) out.push(this.out(m.length === 3 ? m[2] : m[1]));
    }
    if (!out.length && !(nd.content || "").trim()) return [this.hint("(The file is empty, so nothing happened.)")];
    return out;
  }

  // Tab completion of the last word
  complete(line) {
    const m = line.match(/^(.*?)(\S*)$/);
    const before = m[1], word = m[2];
    if (!before.trim()) {
      const opts = COMMANDS.filter((c) => c.startsWith(word));
      return opts.length === 1 ? { line: before + opts[0] + " " } : { options: opts };
    }
    const slash = word.lastIndexOf("/");
    const dirPart = slash >= 0 ? word.slice(0, slash + 1) : "";
    const namePart = slash >= 0 ? word.slice(slash + 1) : word;
    const dir = this.abs(dirPart || ".");
    if (!this.isDir(dir)) return { options: [] };
    const opts = this.children(dir).filter((n) => n.startsWith(namePart) && (namePart.startsWith(".") || !n.startsWith(".")));
    if (opts.length === 1) {
      const full = `${dir === "/" ? "" : dir}/${opts[0]}`;
      return { line: before + dirPart + opts[0] + (this.isDir(full) ? "/" : " ") };
    }
    if (opts.length > 1) {
      let common = opts[0];
      for (const o of opts) while (!o.startsWith(common)) common = common.slice(0, -1);
      if (common.length > namePart.length) return { line: before + dirPart + common };
    }
    return { options: opts };
  }

  // ---------- task checking ----------
  // colcon test / colcon test-result: count the tests that the packages' test files define
  colconTest(verb, rest) {
    if (!this.sourced) return [this.err("colcon: ROS 2 is not loaded in this terminal"), this.hint("Run source /opt/ros/jazzy/setup.bash first.")];
    const ws = this.cwd === "/" ? "" : this.cwd;
    let pkgs = findPackages(this, this.cwd);
    const sel = rest.indexOf("--packages-select");
    if (sel >= 0) pkgs = pkgs.filter((p) => rest.slice(sel + 1).includes(p.name));
    const count = (p) => {
      const out = [];
      for (const [path, n] of this.fs) {
        if (n.type !== "f" || !path.startsWith(`${p.dir}/test/`)) continue;
        const code = n.content || "";
        if (p.type === "ament_python" && /\/test_\w+\.py$/.test(path)) {
          let total = 0;
          const lines = code.split("\n");
          lines.forEach((l, i) => {
            if (!/^def test_/.test(l)) return;
            let k = 1;
            for (let j = i - 1; j >= 0 && /^@/.test(lines[j]); j--) { const m = lines[j].match(/parametrize\(\s*(['"])[^'"]*\1\s*,\s*\[(.*)\]\s*\)/); if (m) k *= (m[2].match(/\(/g) || []).length || m[2].split(",").length; }
            total += k;
          });
          out.push({ file: `build/${p.name}/pytest.xml`, n: total });
        }
        if (p.type === "ament_cmake" && /\.cpp$/.test(path)) {
          const cm = (this.fs.get(`${p.dir}/CMakeLists.txt`) || {}).content || "";
          const name = baseName(path).replace(/\.cpp$/, "");
          if (new RegExp(`ament_add_gtest\\(\\s*\\w+\\s+test/${name}\\.cpp`).test(cm)) {
            if (!out.some((o) => /Test\.xml$/.test(o.file))) out.push({ file: `build/${p.name}/Testing/20261012-0930/Test.xml`, n: 1 });   // CTest's own summary file
            out.push({ file: `build/${p.name}/test_results/${p.name}/${name}.gtest.xml`, n: (code.match(/^TEST\(/gm) || []).length });
          }
        }
      }
      return out;
    };
    if (verb === "test") {
      if (!pkgs.length) return [this.out("Summary: 0 packages finished [0.2s]")];
      if (pkgs.some((p) => !this.isDir(`${ws}/build/${p.name}`) && !this.isDir(`${ws}/install/${p.name}`))) return [this.err("Build the packages first: colcon build"), this.hint("colcon test runs the tests of packages that were already built.")];
      this.testsRun = pkgs.map((p) => p.name);
      return [...pkgs.map((p) => this.out(`Starting >>> ${p.name}`)), ...pkgs.map((p, i) => this.out(`Finished <<< ${p.name} [${(1.1 + i * 0.6).toFixed(2)}s]`)), this.out(""), this.out(`Summary: ${pkgs.length} package${pkgs.length === 1 ? "" : "s"} finished [${(1.4 + pkgs.length * 0.6).toFixed(1)}s]`)];
    }
    const ran = findPackages(this, this.cwd).filter((p) => (this.testsRun || []).includes(p.name));
    const files = ran.flatMap(count);
    if (!files.length) return [this.out("Summary: 0 tests, 0 errors, 0 failures, 0 skipped"), this.hint("Run colcon test first.")];
    const tot = files.reduce((a, f) => a + f.n, 0);
    const all = rest.includes("--all");
    return [...(all ? files.map((f) => this.out(`${f.file}: ${f.n} test${f.n === 1 ? "" : "s"}, 0 errors, 0 failures, 0 skipped`)).concat([this.out("")]) : []), this.out(`Summary: ${tot} tests, 0 errors, 0 failures, 0 skipped`), ...(all ? [] : [this.hint("Only failures are listed one by one. Add --all to see every result file.")])];
  }
  check(c, lastCmd) {
    if (c.viz) {
      const v = this.viz, z = c.viz, g = this.graph;
      if (z.rviz && !(g && g.nodes.some((n) => n.kind === "rviz"))) return false;
      if (z.gui && !(g && g.nodes.some((n) => n.kind === "jsp_gui"))) return false;
      if (z.robot && !(g && g.robotModel())) return false;
      if (z.fixedFrame && v.fixedFrame !== z.fixedFrame) return false;
      if (z.displays && ![].concat(z.displays).every((d) => v.displays[d])) return false;
      if (z.joint) for (const [k, val] of Object.entries(z.joint)) { const cur = v.joints[k]; if (cur === undefined || (val === "moved" ? Math.abs(cur) < 0.05 : Math.abs(cur - val) > 0.05)) return false; }
      if (z.markers && v.markers.length < z.markers) return false;
      if (z.subscribed && !this.vizSubscribed(z.subscribed)) return false;
      if (z.saved && !this.isFile(this.abs(z.saved))) return false;
      if (z.published && !(v.published && v.published[z.published])) return false;
      if (z.frame && !(g && g.tfTree().some((e) => e.child === z.frame || e.parent === z.frame))) return false;
      if (Object.keys(c).length === 1) return true;
    }
    if (!c) return false;
    const norm = (s) => String(s).trim().replace(/\s+/g, " ");
    if (c.cmd && !new RegExp(c.cmd).test(norm(lastCmd))) return false;
    if (c.cwd && this.cwd !== this.abs(c.cwd)) return false;
    for (const p of [].concat(c.exists || [])) if (!this.fs.has(this.abs(p))) return false;
    for (const p of [].concat(c.dir || [])) if (!this.isDir(this.abs(p))) return false;
    for (const p of [].concat(c.file || [])) if (!this.isFile(this.abs(p))) return false;
    for (const p of [].concat(c.missing || [])) if (this.fs.has(this.abs(p))) return false;
    for (const p of [].concat(c.exec || [])) { const n = this.node(this.abs(p)); if (!n || n.mode[2] !== "x") return false; }
    if (c.fileHas && !(this.isFile(this.abs(c.fileHas.path)) && (this.node(this.abs(c.fileHas.path)).content || "").includes(c.fileHas.text))) return false;
    if (c.env) for (const [k, v] of Object.entries(c.env)) if (this.env[k] !== String(v)) return false;
    if (c.sourced === true && !this.sourced) return false;
    if (c.sourced === false && this.sourced) return false;
    if (c.rosPkg && ![].concat(c.rosPkg).every((x) => this.rosPkgs.has(x))) return false;
    if (c.hasCmd && ![].concat(c.hasCmd).every((x) => this.cmds.has(x))) return false;
    if (c.rosRepo && !this.rosRepo) return false;
    if (c.rosInstalled && !this.rosInstalled) return false;
    if (c.rosdepUpdated && !this.rosdepUpdated) return false;
    if (c.aptUpdated && !this.aptUpdated) return false;
    if (c.outputHas && !this.lastOutput.includes(c.outputHas)) return false;
    if (c.ok && this.lastError) return false;
    if (c.rosNode && !(this.graph && [].concat(c.rosNode).every((x) => this.graph.has(x)))) return false;
    if (c.iface && !(this.graph && [].concat(c.iface).every((x) => x in this.graph.allIfaces()))) return false;
    if (c.topicExists && !(this.graph && [].concat(c.topicExists).every((x) => this.graph.topics().has(x)))) return false;
    if (c.turtle && !(this.graph && [].concat(c.turtle).every((x) => this.graph.turtle(x)))) return false;
    if (c.param) { const n = this.graph && this.graph.node(c.param.node); if (!n || String(n.params[c.param.name]) !== String(c.param.value)) return false; }
    if (c.wsPkg && ![].concat(c.wsPkg).every((x) => this.wsPkgs.has(x))) return false;
    return true;
  }
}

// ========================= the on-screen terminal =========================
export function mountTerminal(container, spec, { onComplete } = {}) {
  const sh = new Shell(spec);
  const tasks = spec.tasks || [];
  let step = 0, histPos = -1, finished = false;
  const MAX_TABS = 6;   // terminals (Terminator panes) in all tabs together

  const taskItems = tasks.map((t, i) => el("li", {}, el("span", { class: "box", text: String(i + 1) }), el("span", {}, rich(t.do))));
  const taskBox = tasks.length ? el("div", { class: "term-tasks" }, el("ol", {}, taskItems)) : null;
  const doneBox = el("div", { class: "term-done", hidden: true, text: "All steps done. Well done!" });
  // Terminator look: one window, split into panes. Each pane has a title bar (red = the one you type in).
  const tabBar = el("div", { class: "tmr-tabs", role: "tablist", "aria-label": "Terminator tabs", hidden: true });
  const addTabBtn = el("button", { type: "button", class: "term-tab-add", title: "Open another terminal next to this one (Terminator: Ctrl+Shift+E splits right, Ctrl+Shift+O splits down)", text: "+ New terminal" });
  const ico = (d) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("aria-hidden", "true"); s.innerHTML = d; return s; };
  const splitRBtn = el("button", { type: "button", class: "tmr-btn", title: "Split Vertically: new terminal on the right (Ctrl+Shift+E)", "aria-label": "Split vertically (new terminal on the right)" },
    ico('<rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="none" stroke="currentColor"/><path d="M8 2.5v11" stroke="currentColor"/>'));
  const splitDBtn = el("button", { type: "button", class: "tmr-btn", title: "Split Horizontally: new terminal below (Ctrl+Shift+O)", "aria-label": "Split horizontally (new terminal below)" },
    ico('<rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="none" stroke="currentColor"/><path d="M1.5 8h13" stroke="currentColor"/>'));
  const tabNewBtn = el("button", { type: "button", class: "tmr-btn", title: "Open Tab: a new Terminator tab (Ctrl+Shift+T)", "aria-label": "Open a new Terminator tab" },
    ico('<path d="M1.5 13.5v-9h5l1-2h5.5v11z" fill="none" stroke="currentColor"/><path d="M8 7v4M6 9h4" stroke="currentColor"/>'));
  const winTitle = el("span", { class: "tmr-wtitle", text: `${USER}@${HOST}: ~` });
  const screens = el("div", { class: "tmr-layout term-screens" });
  const simPanel = el("div", { class: "tsim-panel", hidden: true });
  const vizPanel = el("div", { class: "term-viz rv-desk", hidden: true });
  let viewer = null, jspWin = null, vizLoading = false, jspLoading = false, vizMod = null, lastModel, lastErr;
  const rvizHolder = el("div", { class: "desk-rviz" });
  const gzHolder = el("div", { class: "desk-gz" });
  vizPanel.append(gzHolder, rvizHolder);
  // package://pkg/<folder>/<file> -> the package's INSTALLED share folder (like RViz's resource retriever); file:///abs/path too
  const resolveMesh = (url) => {
    const str = String(url), at = (c) => { const m = String(c ?? "").match(/^@url:(.+)$/); return m ? m[1] : null; };
    let m = str.match(/^package:\/\/([\w-]+)\/([^/]+)\/(.+)$/);
    if (m) { const pk = sh.wsPkgs && sh.wsPkgs.get(m[1]), inst = pk && pk[m[2]]; const c = inst && (inst[m[3]] ?? inst[m[3].split("/").pop()]); return c === undefined ? null : at(c); }
    m = str.match(/^file:\/\/(\/.+)$/) || str.match(/^(\/.+)$/);
    if (m) { const n = sh.node(m[1]); return n && n.type === "f" ? at(n.content) : null; }
    return null;
  };

  function vizChanged(ch) {
    if (ch.fixedFrame) sh.viz.fixedFrame = ch.fixedFrame;
    if (ch.displays) sh.viz.displays = ch.displays;
    if (ch.joints) sh.viz.joints = { ...sh.viz.joints, ...ch.joints };
    deliverPending();
    afterCommand("");
  }
  function deliverPending() {   // a waiting "ros2 topic pub --once" publishes as soon as RViz subscribes
    const sent = sh.flushPending();
    if (sent.length) { const t = tabs.find((x) => !x.proc && x !== active) || active; sent.forEach((l) => addLine({ text: l }, t)); addLine({ text: "(RViz subscribed, so the waiting ros2 topic pub --once sent its message.)", cls: "hint" }, t); if (viewer) viewer.setMarkers(sh.viz.markers); }
  }
  function saveConfig(path, text) {
    const p = sh.abs(path || "my_config.rviz");
    sh.mkdirP(p.replace(/\/[^/]*$/, ""));
    sh.fs.set(p, { type: "f", mode: "rw-r--r--", content: text });
    addLine({ text: `(RViz saved its setup to ${path}.)`, cls: "hint" }); scroll();
    afterCommand("");
  }
  function rvizPublished(topic, type, msg) {
    sh.viz.published = sh.viz.published || {};
    sh.viz.published[topic] = { type, msg };
    if (sh.graph) sh.graph.lastPub = { topic, type };
    addLine({ text: `(RViz published a ${type.split("/").pop()} on ${topic}. Try: ros2 topic echo ${topic})`, cls: "hint" }); scroll();
    afterCommand("");
  }
  function paintViz() {
    const g = sh.graph;
    const rvizOn = !!(g && g.nodes.some((n) => n.kind === "rviz")), guiOn = !!(g && g.nodes.some((n) => n.kind === "jsp_gui"));
    const gzOn = !!(g && g.gzRunning());
    vizPanel.hidden = !(rvizOn || guiOn || gzOn);
    paintGz();
    const model = g ? g.robotModel() : null, err = g ? g.robotModelError() : null;
    if (model && vizMod && model !== lastModel) for (const j of Object.values(model.joints)) if (j.type !== "fixed" && !j.mimic && sh.viz.joints[j.name] === undefined) sh.viz.joints[j.name] = vizMod.jspDefault(j);
    // RViz window
    if (!rvizOn && viewer) { viewer.destroy(); viewer = null; lastModel = undefined; }
    if (rvizOn && !viewer && !vizLoading) {
      vizLoading = true;
      import("./rviz.js").then((mod) => {
        vizLoading = false; vizMod = mod;
        viewer = mod.createRviz(rvizHolder, { fixedFrame: sh.viz.fixedFrame, displays: sh.viz.displays, resolve: resolveMesh, onChange: vizChanged, onSave: saveConfig, savePath: spec.rvizSave || "~/my_config.rviz", plugins: () => [...sh.rosPkgs].filter((p) => /^(rviz_|moveit_rviz_plugin$)/.test(p)), onLog: (t) => { const rz = sh.graph.nodes.find((n) => n.kind === "rviz"); if (rz) { (sh.graph.notices = sh.graph.notices || []).push({ node: rz.full, text: t, cls: "warn-line" }); flushNotices(); } },
          configName: sh.viz.configName || "", topics: () => (sh.graph ? [...sh.graph.topics()].map(([name, t]) => ({ name, type: t.type, pubs: t.by.pubs.length })) : []), onPublish: rvizPublished });
        if (sh.viz.configText) viewer.loadConfig(sh.viz.configText, sh.viz.configName);
        sh.viz.subsFn = () => (viewer ? viewer.subscriptions() : null);
        deliverPending();
        paintViz();
      }).catch((e) => { vizLoading = false; rvizHolder.replaceChildren(el("p", { class: "notice err", text: "The 3D viewer could not load: " + e.message })); });
    }
    // joint_state_publisher_gui window (a separate window, also without RViz)
    if (!guiOn && jspWin) { jspWin.destroy(); jspWin = null; }
    if (guiOn && !jspWin && !jspLoading) {
      jspLoading = true;
      Promise.all([import("./jsp-window.js"), import("./rviz.js")]).then(([jm, rm]) => {
        jspLoading = false; vizMod = rm;
        jspWin = jm.createJspWindow(vizPanel, { model, values: sh.viz.joints, onChange: (v) => { sh.viz.joints = { ...sh.viz.joints, ...v }; if (viewer) viewer.setJoints(v, sh.graph.statesAvailable()); afterCommand(""); } });
        paintViz();
      });
    }
    if (jspWin) jspWin.setModel(model);
    if (!viewer) return;
    if (model !== lastModel || err !== lastErr) { lastModel = model; lastErr = err; viewer.setModel(model, err); }
    viewer.setDisplays(sh.viz.displays);
    viewer.setFixedFrame(sh.viz.fixedFrame);
    viewer.setExtraEdges(g.extraTfEdges());
    viewer.setJoints(g.jointValues(), g.statesAvailable());
    viewer.setMarkers(sh.viz.markers);
    if (gzOn) viewer.update({ topicData: gzTopicData() });
    paintMoveit();
  }
  // ---------- MoveIt: the MotionPlanning panel in RViz, and the mock hardware's clock (demo.launch.py) ----------
  let mp = null, mpLoading = false, mpFor = null, mockTimer = null, mockLast = 0;
  function paintMoveit() {
    const g = sh.graph, mg = g && g.mg && g.node(g.mg.node) ? g.mg : null;
    const want = !!(mg && viewer && viewer.displays("MotionPlanning").some((d) => d.enabled));
    if (mp && (!want || mpFor !== mg)) { mp.destroy(); mp = null; mpFor = null; }
    if (want && !mp && !mpLoading) { mpLoading = true; import("./moveit-rviz.js").then((m) => { mpLoading = false; if (!viewer || !g.mg || g.mg !== mg) return; mp = m.attachMotionPlanning(viewer, mg); mpFor = mg; window.__ros2labMP = mp; }).catch((e) => { mpLoading = false; console.error(e); }); }
    const mock = g && g.mockModelList ? g.mockModelList().length > 0 : false;
    if (mock && !mockTimer) { mockLast = performance.now(); mockTimer = setInterval(mockTick, 50); }
    if (!mock && mockTimer) { clearInterval(mockTimer); mockTimer = null; }
  }
  function mockTick() {
    const g = sh.graph;
    if (!root.isConnected || !g.mockModelList().length) { clearInterval(mockTimer); mockTimer = null; paintViz(); return; }
    const now = performance.now(), dt = Math.min(0.1, (now - mockLast) / 1000); mockLast = now;
    g.mockStep(dt);
    if (viewer) viewer.update({ edges: g.extraTfEdges(), joints: g.jointValues(), have: g.statesAvailable() });
  }

  // ---------- Gazebo (gz sim): its window, the simulation clock, and the sensor data ros_gz_bridge brings to ROS ----------
  let gzs = null, gzWin = null, gzLoading = false, gzMods = null, gzTimer = null, gzLast = 0;
  const gzCache = new Map();   // "<model>/<sensor>" -> latest sensor output
  const senKey = (src) => `${src.model}/${src.sensor ? src.sensor.name : src.kind}`;
  function paintGz() {
    const g = sh.graph;
    if (!g || !g.gzRunning()) {
      if (gzWin) { gzWin.destroy(); gzWin = null; }
      if (gzs) gzs.sync(null);
      gzCache.clear(); clearInterval(gzTimer); gzTimer = null; return;
    }
    if (!gzs) {
      if (!gzLoading) { gzLoading = true; Promise.all([import("./gz-sim.js"), import("./gz-window.js")]).then(([a, b]) => { gzMods = { createGzWindow: b.createGzWindow }; gzs = new a.GzSim({ resolve: resolveMesh }); gzLoading = false; paintGz(); }).catch((e) => { gzLoading = false; gzHolder.replaceChildren(el("p", { class: "notice err", text: "The Gazebo view could not load: " + e.message })); }); }
      return;
    }
    gzs.sync(g.gz);
    if (g.gz.gui && !gzWin) gzWin = gzMods.createGzWindow(gzHolder, { sim: gzs, onPlay: () => { g.gz.paused = !g.gz.paused; paintGz(); }, onStep: () => { g.gz.paused = false; g.gzStep(0.001); g.gz.paused = true; senseAll(true); paintGz(); } });
    if (gzWin) gzWin.update(g.gz);
    if (!gzTimer) { gzLast = performance.now(); gzTimer = setInterval(gzTick, 50); }
  }
  function gzTick() {
    const g = sh.graph;
    if (!root.isConnected || !g.gzRunning()) { clearInterval(gzTimer); gzTimer = null; paintViz(); return; }
    const now = performance.now(), dt = Math.min(0.1, (now - gzLast) / 1000); gzLast = now;
    const moved = g.gzStep(dt);
    if (g.mg) g.mg.poll();
    gzs.sync(g.gz);
    senseAll(false);
    if (gzWin) gzWin.update(g.gz);
    if (viewer) viewer.update({ edges: g.extraTfEdges(), joints: g.jointValues(), have: g.statesAvailable(), topicData: gzTopicData(), rosTime: rvizTime() });
    if (moved && jspWin && !g.nodes.some((n) => n.kind === "jsp_gui")) { /* the GUI shows its own sliders only */ }
  }
  // run each sensor at its update rate (capped for the browser) while the simulation runs; the World needs the Sensors / Imu systems
  function senseAll(force) {
    const g = sh.graph; if (!gzs || !g.gzRunning() || (g.gz.paused && !force)) return;
    const t = g.gz.time;
    for (const r of gzs.robots.values()) for (const sen of r.gazebo.sensors) {
      if (!gzs.canRun(sen)) continue;
      const key = `${r.name}/${sen.name}`, c = gzCache.get(key) || { t: -1, n: 0 };
      const cap = /camera|depth|rgbd/.test(sen.type) ? 6 : sen.type === "imu" ? 30 : 10, rate = Math.min(cap, sen.rate || cap);
      if (!force && c.t >= 0 && t - c.t < 1 / rate) continue;
      let out = null;
      try {
        if (sen.type === "gpu_lidar" || sen.type === "gpu_ray") out = gzs.lidar(r, sen);
        else if (sen.type === "camera") out = gzs.camera(r, sen, false);
        else if (/depth|rgbd/.test(sen.type)) out = gzs.camera(r, sen, true);
        else if (sen.type === "imu") out = gzs.imu(r, sen);
      } catch (e) { out = null; }
      if (out) gzCache.set(key, { ...out, t, n: c.n + 1 });
    }
  }
  const OPT = (p) => [-p[1], -p[2], p[0]];   // sensor frame (x forward) -> optical frame (z forward, y down)
  function gzTopicData() {
    const g = sh.graph, m = new Map(); if (!g.gzRunning()) return m;
    const run = !g.gz.paused;
    for (const [ros, f] of g.gzFeeds()) {
      const s = f.src, c = s.sensor ? gzCache.get(senKey(s)) : null, rate = run ? s.rate || 0 : 0, count = Math.max(1, Math.floor(g.gz.time * (s.rate || 1)));
      const base = { type: f.rosType, count, rate };
      const optical = s.sensor && s.sensor.optical;
      if (s.kind === "scan" && c && c.scan) m.set(ros, { ...base, frame: s.frame, ...c.scan });
      else if (s.kind === "points" && c && c.points) m.set(ros, { ...base, frame: optical || s.frame, points: optical ? c.points.map(OPT) : c.points, colors: c.colors || null });
      else if (s.kind === "image" && c && c.canvas) m.set(ros, { ...base, frame: optical || s.frame, canvas: c.canvas });
      else if (s.kind === "depth" && c && c.depth) m.set(ros, { ...base, frame: optical || s.frame, depth: c.depth, depthW: c.depthW, depthH: c.depthH });
      else if (s.kind === "info") { const C = s.sensor.camera, fx = C.width / 2 / Math.tan(C.hfov / 2); m.set(ros, { ...base, frame: optical || s.frame, width: C.width, height: C.height, K: [fx, 0, C.width / 2, 0, fx, C.height / 2, 0, 0, 1] }); }
      else if (s.kind === "imu" && c && c.orientation) m.set(ros, { ...base, frame: s.frame, orientation: c.orientation, angular_velocity: c.angular_velocity, linear_acceleration: c.linear_acceleration });
      else if (s.kind === "odom") { const mm = g.gzModel(s.model), o = g.gzOdom(mm); m.set(ros, { ...base, frame: s.plugin.frame || `${mm.name}/odom`, pose: [o.x, o.y, o.yaw] }); }
    }
    return m;
  }
  function rvizTime() {   // use_sim_time: RViz's ROS Time is the Gazebo clock (if /clock is bridged), else 0
    const g = sh.graph, rz = g.nodes.find((n) => n.kind === "rviz");
    if (!rz || rz.params.use_sim_time !== true) return null;
    return [...g.gzFeeds().values()].some((f) => f.src.kind === "clock") ? g.gz.time : 0;
  }
  sh.gzProbe = (src) => {
    const c = gzCache.get(senKey(src)); if (!c) return null;
    if (src.kind === "scan") return c.scan ? { ranges: c.scan.ranges, angle_increment: c.scan.angle_increment } : null;
    if (src.kind === "imu") return c.orientation ? c : null;
    if (src.kind === "image" && c.pixels) { const b = []; for (let i = 0; i < c.pixels.length && b.length < 129; i += 4) b.push(c.pixels[i], c.pixels[i + 1], c.pixels[i + 2]); return { bytes: b.slice(0, 129) }; }
    if (src.kind === "depth" && c.depth) { const f = new Float32Array(c.depth.slice(0, 33).map((x) => (Number.isFinite(x) ? x : Infinity))); return { bytes: [...new Uint8Array(f.buffer)] }; }
    if (src.kind === "points") return { count: (c.points || []).length };
    return null;
  };

  const tools = el("div", { class: "term-tools" },
    el("button", { type: "button", text: "Tab", title: "Complete a name (same as the Tab key)", onclick: () => { doTab(); focusInput(); } }),
    el("button", { type: "button", text: "↑ Last command", onclick: () => { histUp(); focusInput(); } }),
    tasks.length ? el("button", { type: "button", text: "Show a hint", onclick: showHint }) : null,
    spec.newTerminal ? el("button", { type: "button", text: "Open a new terminal", onclick: () => newTab(true) }) : null,
    spec.ide ? el("button", { type: "button", class: "tt-vscode", text: "Open VS Code", title: "Types code <your workspace> in the terminal: VS Code opens the workspace folder", onclick: () => {
      if (!active || active.proc) return;
      const m = sh.cwd.match(/^(.*?_ws)(\/|$)/);
      run(m ? `code ${pretty(m[1])}` : "code .");
    } }) : null,
    el("button", { type: "button", text: "Start again", onclick: resetAll }),
  );
  const ideBox = el("div", { class: "term-ide", hidden: true });
  const root = el("div", { class: "term tmr" },
    el("div", { class: "term-title tmr-head" }, el("span", { class: "tmr-lesson", text: spec.title || "Practice terminal" }), winTitle,
      el("span", { class: "tmr-wbtns", "aria-hidden": "true" }, el("i", { class: "min" }), el("i", { class: "max" }), el("i", { class: "cls" }))),
    taskBox,
    el("div", { class: "term-tabrow tmr-bar" }, tabBar, el("span", { class: "tmr-help", text: "Right-click a terminal for the Terminator menu" }), splitRBtn, splitDBtn, tabNewBtn, addTabBtn),
    ideBox, simPanel, screens, tools, vizPanel, doneBox);
  container.append(root);

  // ---------- terminals (Terminator panes): each has its own folder, settings, history and screen; files and ROS graph are shared ----------
  // Panes live in a split tree per Terminator tab: a leaf is { t }, a split is { dir: "row" | "col", ratio, a, b }.
  let tabs = [], active = null, tabSeq = 0, groups = [], shownGroup = null, zoomed = null, zoomBig = false, menu = null;
  const pretty = (p) => (p === HOME ? "~" : p.startsWith(HOME + "/") ? "~" + p.slice(HOME.length) : p);
  const saveState = (t) => { t.state = { cwd: sh.cwd, env: { ...sh.env }, sourced: sh.sourced, history: sh.history.slice() }; };
  const loadState = (t) => { Object.assign(sh, { cwd: t.state.cwd, env: { ...t.state.env }, sourced: t.state.sourced, history: t.state.history.slice() }); };
  function makeTab(fresh) {
    const t = { id: ++tabSeq, proc: null, keys: null };
    t.screen = el("div", { class: "term-screen", role: "log", "aria-live": "polite" });
    t.input = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": `Terminal ${t.id}: type a command and press Enter` });
    t.prompt = el("span", { class: "pr" });
    t.inputRow = el("div", { class: "term-input-row" }, t.prompt, t.input);
    t.procBar = el("div", { class: "term-proc", hidden: true });
    t.screen.append(t.inputRow);
    t.input.addEventListener("keydown", (e) => onKey(e, t));
    if (spec.allowPaste) t.input.addEventListener("paste", (e) => e.stopPropagation());   // page-wide paste blocking skips this terminal
    t.screen.tabIndex = -1;   // a busy terminal (a node is running) still takes keys: Ctrl+C, teleop arrows
    t.titleText = el("span", { class: "tmr-ttext" });
    t.titleProc = el("span", { class: "tmr-tproc" });
    t.closeBtn = el("button", { type: "button", class: "tmr-tclose", title: "Close this terminal (Ctrl+Shift+W)", "aria-label": `Close terminal ${t.id}`, text: "×" });
    t.closeBtn.addEventListener("click", (e) => { e.stopPropagation(); closeTab(t); });
    t.title = el("div", { class: "tmr-ptitle" }, el("span", { class: "tmr-gicon", "aria-hidden": "true" }), t.titleText, t.titleProc, t.closeBtn);
    t.pane = el("div", { class: "tmr-pane", "data-term": String(t.id) }, t.title, t.screen);
    t.pane.addEventListener("pointerdown", (e) => { if (e.button === 0 && t !== active && !e.target.closest(".tmr-tclose")) switchTo(t); });
    t.pane.addEventListener("click", (e) => { if (t === active && !window.getSelection().toString() && !e.target.closest("button, input, textarea, .nano")) focusInput(); });
    t.pane.addEventListener("contextmenu", (e) => { e.preventDefault(); if (t !== active) switchTo(t); openMenu(e.clientX, e.clientY); });
    // the tab button is kept for pages that look for it; Terminator itself shows no tab per pane
    t.tabBtn = el("button", { type: "button", role: "tab", class: "term-tab", hidden: true }, el("span", { class: "tt-name" }), el("span", { class: "tt-x", text: "×" }));
    if (fresh) {
      if (active) saveState(active);
      sh.newTerminal();
      if (spec.sourced && !sh.sourced) sh.applySource();   // lessons that start "sourced" act as if ~/.bashrc loads ROS 2
      saveState(t); if (active) loadState(active);
    }
    else saveState(t);
    t.prompt.replaceChildren(...promptText(t.state.cwd));
    tabs.push(t);
    return t;
  }
  const firstLeaf = (n) => (n.t ? n.t : firstLeaf(n.a));
  function newGroup(t) {
    const g = { root: null, last: t };
    t.leaf = { t, p: null }; g.root = t.leaf; t.group = g; groups.push(g);
    return g;
  }
  function splitPane(t, dir) {
    const nt = makeTab(true), old = t.leaf, parent = old.p;
    const sp = { dir, ratio: 0.5, a: old, b: null, p: parent };
    nt.leaf = { t: nt, p: sp }; nt.group = t.group; sp.b = nt.leaf; old.p = sp;
    if (!parent) t.group.root = sp; else if (parent.a === old) parent.a = sp; else parent.b = sp;
    zoomed = null;
    return nt;
  }
  function removeLeaf(t) {
    const lf = t.leaf, sp = lf.p, g = t.group;
    if (!sp) { groups = groups.filter((x) => x !== g); return; }
    const other = sp.a === lf ? sp.b : sp.a, gp = sp.p;
    other.p = gp;
    if (!gp) g.root = other; else if (gp.a === sp) gp.a = other; else gp.b = other;
    if (g.last === t) g.last = firstLeaf(g.root);
  }
  function build(node) {
    if (node.t) return node.t.pane;
    const A = el("div", { class: "tmr-cell" }, build(node.a)), B = el("div", { class: "tmr-cell" }, build(node.b));
    const handle = el("div", { class: "tmr-handle", role: "separator", "aria-orientation": node.dir === "row" ? "vertical" : "horizontal", "aria-label": "Drag to resize the terminals" });
    const box = el("div", { class: `tmr-split ${node.dir}` }, A, handle, B);
    node.apply = () => { A.style.flex = `${node.ratio} 1 0`; B.style.flex = `${1 - node.ratio} 1 0`; };
    node.apply();
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add("drag");
      const r = box.getBoundingClientRect();
      const move = (ev) => { const f = node.dir === "row" ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height; node.ratio = Math.min(0.88, Math.max(0.12, f)); node.apply(); };
      const up = () => { handle.classList.remove("drag"); handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up); };
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
    });
    return box;
  }
  function layout() {
    const g = active && !active.group.ide ? active.group : shownGroup && groups.includes(shownGroup) ? shownGroup : groups[0];
    if (!g) return;
    shownGroup = g;
    screens.replaceChildren(zoomed && zoomed.group === g ? zoomed.pane : build(g.root));
    screens.classList.toggle("is-split", !!g.root.dir && !zoomed);
    screens.classList.toggle("zoom-big", !!(zoomed && zoomBig));
    paintTabs();
    for (const t of tabs) if (t.pane.isConnected) scroll(t);
  }
  function paneTitle(t) { return `${USER}@${HOST}: ${pretty(t === active ? sh.cwd : t.state.cwd)}`; }
  function paintTabs() {
    tabs.forEach((t, k) => {
      const on = t === active;
      t.pane.classList.toggle("on", on);
      t.titleText.textContent = paneTitle(t);
      t.titleProc.textContent = t.proc ? t.proc.label : "";
      t.closeBtn.hidden = paneCount() < 2;
      t.tabBtn.querySelector(".tt-name").textContent = `${k + 1}: ${t.proc ? t.proc.label : "bash"}`;
    });
    tabBar.replaceChildren(...groups.map((g, k) => {
      const lead = g.last && tabs.includes(g.last) ? g.last : firstLeaf(g.root);
      const b = el("button", { type: "button", role: "tab", class: "tmr-tab" + (g === shownGroup ? " on" : ""), "aria-selected": g === shownGroup ? "true" : "false" },
        el("span", { text: `${k + 1}: ${paneTitle(lead)}` }));
      b.addEventListener("click", () => switchTo(lead));
      return b;
    }));
    tabBar.hidden = groups.length < 2;
    const full = paneCount() >= MAX_TABS;
    for (const b of [addTabBtn, splitRBtn, splitDBtn, tabNewBtn]) b.disabled = full;
    if (active) winTitle.textContent = paneTitle(active);
  }
  function switchTo(t) {
    if (t === active) { focusInput(); return; }
    if (active) saveState(active);
    const regroup = !t.group.ide && (t.group !== shownGroup || (zoomed && zoomed !== t));
    if (zoomed && zoomed !== t) zoomed = null;
    active = t; t.group.last = t; loadState(t); histPos = -1;
    if (regroup) layout(); else paintTabs();
    paintPrompt(); scroll(); focusInput();
  }
  function paneCount() { return tabs.filter((t) => !(t.group && t.group.ide)).length; }
  function tooMany() { addLine({ text: `(At most ${MAX_TABS} terminals here. Close one with the × on its title bar first.)`, cls: "hint" }); scroll(); }
  // "+ New terminal" (or a split): a new pane next to the one you are in
  function newTab(fromButton, dir) {
    if (paneCount() >= MAX_TABS) { tooMany(); return; }
    const base = active && !active.group.ide ? active : shownGroup && groups.includes(shownGroup) ? (shownGroup.last && tabs.includes(shownGroup.last) ? shownGroup.last : firstLeaf(shownGroup.root)) : firstLeaf(groups[0].root);
    if (base !== active) switchTo(base);
    if (!dir) { const r = base.pane.getBoundingClientRect(); dir = r.width > 1.5 * r.height ? "row" : "col"; }
    if (dir === "row" && screens.clientWidth && screens.clientWidth < 520) dir = "col";   // phones: stack them
    const t = splitPane(base, dir);
    layout();
    switchTo(t);
    addLine({ text: fromButton === true ? "(A new terminal window opened. It started fresh and ran ~/.bashrc.)" : sh.sourced ? "(New terminal. ~/.bashrc already loaded ROS 2 here, so you can type ros2 commands straight away.)" : "(New terminal. It started fresh: folder, exports and sourcing are back to default. Files and running nodes are shared.)", cls: "hint" });
    afterCommand("");
  }
  function newGroupTab() {
    if (paneCount() >= MAX_TABS) { tooMany(); return; }
    const t = makeTab(true);
    newGroup(t); zoomed = null;
    switchTo(t);
    addLine({ text: "(New Terminator tab. Click the tabs at the top to switch. Files and running nodes are shared.)", cls: "hint" });
    afterCommand("");
  }
  function closeTab(t) {
    if (t && t.group.ide) { closeIde(); return; }
    if (!t || paneCount() < 2) return;
    if (t.proc) stopProc(t, true);
    removeLeaf(t);
    tabs = tabs.filter((x) => x !== t);
    if (zoomed === t) zoomed = null;
    if (active === t) {
      active = null;
      const g = groups.includes(t.group) ? t.group : groups[Math.max(0, groups.length - 1)];
      switchTo(g.last && tabs.includes(g.last) ? g.last : firstLeaf(g.root));
    }
    layout(); focusInput();
    paintSim();
  }
  function zoom(big) {
    if (zoomed) { zoomed = null; zoomBig = false; }
    else if (active.group.root.dir) { zoomed = active; zoomBig = big; }
    layout(); focusInput();
  }
  function focusDir(dir) {
    if (!active) return;
    const r0 = active.pane.getBoundingClientRect(), c0 = [(r0.left + r0.right) / 2, (r0.top + r0.bottom) / 2];
    let best = null, bd = Infinity;
    for (const t of tabs) {
      if (t === active || !t.pane.isConnected || t.group !== active.group) continue;
      const r = t.pane.getBoundingClientRect();
      const ok = dir === "left" ? r.right <= r0.left + 4 : dir === "right" ? r.left >= r0.right - 4 : dir === "up" ? r.bottom <= r0.top + 4 : r.top >= r0.bottom - 4;
      if (!ok) continue;
      const d = Math.hypot((r.left + r.right) / 2 - c0[0], (r.top + r.bottom) / 2 - c0[1]);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) switchTo(best);
  }
  function resizeDir(dir) {   // Ctrl+Shift+Arrow moves the nearest divider
    const want = dir === "left" || dir === "right" ? "row" : "col";
    let n = active && active.leaf.p;
    while (n && n.dir !== want) n = n.p;
    if (!n || !n.apply) return;
    n.ratio = Math.min(0.88, Math.max(0.12, n.ratio + (dir === "right" || dir === "down" ? 0.05 : -0.05))); n.apply();
  }
  const selText = () => { const s = window.getSelection(); return s && root.contains(s.anchorNode) ? s.toString() : ""; };
  function copySel() { const txt = selText(); if (txt && navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {}); focusInput(); }
  function pasteClip() {
    if (!active || active.proc) return;
    if (!spec.allowPaste) { addLine({ text: "(Pasting is turned off in this lesson. Type it yourself: typing helps you remember.)", cls: "hint" }); scroll(); return; }
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    navigator.clipboard.readText().then((txt) => { const one = String(txt).split(/\r?\n/)[0]; const i = active.input; i.setRangeText(one, i.selectionStart, i.selectionEnd, "end"); focusInput(); }).catch(() => {});
  }
  function closeMenu() { if (!menu) return; menu.remove(); menu = null; document.removeEventListener("pointerdown", outside, true); }
  function outside(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
  function openMenu(x, y) {
    closeMenu();
    const full = paneCount() >= MAX_TABS, split = !!(active && active.group.root.dir);
    const item = (label, key, fn, o = {}) => el("button", { type: "button", role: o.check ? "menuitemcheckbox" : "menuitem", class: "tmr-mi", disabled: o.disabled || null, "aria-checked": o.check ? String(!!o.on) : null,
      onclick: () => { closeMenu(); fn(); } }, el("span", { class: "tmr-mk", text: o.check && o.on ? "✓" : "" }), el("span", { class: "tmr-ml", text: label }), el("kbd", { text: key || "" }));
    const sep = () => el("div", { class: "tmr-sep", role: "separator" });
    menu = el("div", { class: "tmr-menu", role: "menu", "aria-label": "Terminator menu" },
      item("Copy", "Shift+Ctrl+C", copySel, { disabled: !selText() }),
      item("Paste", "Shift+Ctrl+V", pasteClip, { disabled: !!(active && active.proc) }),
      sep(),
      item("Split Horizontally", "Shift+Ctrl+O", () => newTab(false, "col"), { disabled: full }),
      item("Split Vertically", "Shift+Ctrl+E", () => newTab(false, "row"), { disabled: full }),
      item("Open Tab", "Shift+Ctrl+T", newGroupTab, { disabled: full }),
      sep(),
      item("Close", "Shift+Ctrl+W", () => closeTab(active), { disabled: paneCount() < 2 && !(active && active.group.ide) }),
      sep(),
      zoomed ? item("Restore all terminals", "Shift+Ctrl+X", () => zoom(false)) : item("Zoom terminal", "Shift+Ctrl+Z", () => zoom(true), { disabled: !split }),
      zoomed ? null : item("Maximise terminal", "Shift+Ctrl+X", () => zoom(false), { disabled: !split }),
      sep(),
      item("Show scrollbar", "", () => { root.classList.toggle("tmr-noscroll"); focusInput(); }, { check: true, on: !root.classList.contains("tmr-noscroll") }),
      item("Clear (like Ctrl+L)", "Ctrl+L", () => { [...active.screen.querySelectorAll(".line")].forEach((n) => n.remove()); focusInput(); }));
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + "px";
    menu.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + "px";
    document.addEventListener("pointerdown", outside, true);
    const items = () => [...menu.querySelectorAll(".tmr-mi:not([disabled])")];
    menu.addEventListener("keydown", (e) => {
      const list = items(), i = list.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); closeMenu(); focusInput(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = list.length; list[(i + (e.key === "ArrowDown" ? 1 : n - 1) + n) % n].focus(); }
    });
    items()[0]?.focus();
  }
  addTabBtn.addEventListener("click", () => newTab(false));
  splitRBtn.addEventListener("click", () => newTab(false, "row"));
  splitDBtn.addEventListener("click", () => newTab(false, "col"));
  tabNewBtn.addEventListener("click", () => newGroupTab());
  // Terminator keyboard shortcuts (the browser keeps Ctrl+Shift+T and Ctrl+Shift+W for itself, so the buttons and menu do those too)
  root.addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA" || !active || e.target.closest(".vsc")) return;   // VS Code has its own shortcuts
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      const act = { o: () => newTab(false, "col"), e: () => newTab(false, "row"), t: newGroupTab, w: () => closeTab(active), x: () => zoom(false), z: () => zoom(true), c: copySel, v: pasteClip,
        ArrowLeft: () => resizeDir("left"), ArrowRight: () => resizeDir("right"), ArrowUp: () => resizeDir("up"), ArrowDown: () => resizeDir("down") }[k];
      if (act) { e.preventDefault(); e.stopPropagation(); act(); }
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      const d = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
      if (d) { e.preventDefault(); e.stopPropagation(); focusDir(d); }
    }
  }, true);

  // ---------- screen helpers (always the active tab, unless a tab is given) ----------
  const focusInput = () => { if (active && !active.proc && !active.input.disabled) active.input.focus({ preventScroll: true }); else if (active && (active.proc || active.pyBusy)) active.screen.focus({ preventScroll: true }); };
  function promptText(cwd) { return [el("span", { text: `${USER}@${HOST}:` }), el("b", { text: cwd ? pretty(cwd) : sh.prettyCwd() }), document.createTextNode("$ ")]; }
  function paintPrompt() { if (active) { active.prompt.replaceChildren(...promptText()); paintTabs(); } }
  function addLine(l, t = active) {
    const before = t.proc ? t.procBar : t.inputRow;
    let node;
    if (l.segs) node = el("div", { class: "line" }, ...l.segs.flatMap((sg, i) => [i ? "  " : "", el("span", { class: sg.c || null, text: sg.t })]));
    else node = el("div", { class: "line" + (l.cls ? " " + l.cls : ""), text: l.text });
    t.screen.insertBefore(node, before);
    const lines = t.screen.querySelectorAll(".line");
    if (lines.length > 400) lines[0].remove();
  }
  function echoCommand(cmd) { active.screen.insertBefore(el("div", { class: "line" }, el("span", { class: "pr" }, ...promptText()), cmd), active.inputRow); }
  function scroll(t = active) { t.screen.scrollTop = t.screen.scrollHeight; }
  function paintTasks() {
    taskItems.forEach((li, i) => { li.className = i < step ? "done" : i === step && !finished ? "now" : ""; li.querySelector(".box").textContent = i < step ? "✓" : String(i + 1); });
  }

  // ---------- running commands ----------
  function run(cmd) {
    echoCommand(cmd);
    sh.graph.lastStarted = null;
    const res = sh.run(cmd);
    if (res.clear) { [...active.screen.querySelectorAll(".line")].forEach((n) => n.remove()); }
    const started = sh.graph.lastStarted;
    sh.graph.lastStarted = null;
    res.lines.filter((l) => !(started && l.cls === "hint" && /^\(Practice terminal: .* (keeps running|They keep running)/.test(l.text || "") || started && /^\(Two turtlesim windows/.test(l.text || ""))).forEach((l) => addLine(l));
    if (res.nano) openNano(res.nano);
    if (res.code) openIde(res.code);
    if (started && started.length) { startProc(active, started, cmd); focusInput(); }
    if (res.python) runPython(active, res.python, cmd);
    afterCommand(cmd);
    paintSim();
    if (ide && !res.code) ide.refresh();   // the terminal may have changed files the editor shows
  }

  // a real Python traceback shows only the student's own frames, with the source line under each
  function cleanTraceback(err, code, path) {
    const src = code.split("\n"), out = [];
    const lines = err.replace(/\n$/, "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], f = l.match(/^\s*File "([^"]+)", line (\d+)(.*)$/);
      if (f) {
        const mine = f[1] === "<exec>" || /case\.py$/.test(f[1]);
        while (i + 1 < lines.length && /^\s{4,}/.test(lines[i + 1]) && !/^\s*File "/.test(lines[i + 1])) i++;   // its code / ^^^ lines
        if (!mine) continue;
        const n = Number(f[2]);
        out.push(`  File "${path}", line ${n}${f[3]}`);
        if (src[n - 1] && src[n - 1].trim()) out.push(`    ${src[n - 1].trim()}`);
        continue;
      }
      out.push(l);
    }
    return out;
  }
  // ---------- python3 FILE: ordinary Python really runs (Pyodide, the same engine as the Python exercises) ----------
  async function runPython(t, { code, path }, cmd) {
    t.pyBusy = true; t.inputRow.hidden = true; focusInput();
    const status = el("div", { class: "line hint", text: "" });
    t.screen.insertBefore(status, t.inputRow);
    try {
      const { runPythonCode } = await import("./pyrun.js");
      const r = await runPythonCode(code, { onStatus: (txt) => { status.textContent = /Starting/.test(txt) ? `(${txt})` : ""; } });
      status.remove();
      const outLines = r.text.replace(/\n$/, "").split("\n").filter((l) => !l.startsWith("@@VIZ "));
      if (r.text) outLines.forEach((l) => addLine({ text: l }, t));
      if (r.err) { cleanTraceback(r.err, code, path).forEach((l) => addLine({ text: l, cls: "err" }, t)); if (/EOFError/.test(r.err)) addLine({ text: "(input() needs someone typing at a real keyboard. In this practice terminal, give the values in the code instead.)", cls: "hint" }, t); }
      sh.lastOutput = r.text; sh.lastError = !!r.err;
    } catch (e) { status.remove(); addLine({ text: `(Python could not start here: ${e.message})`, cls: "err" }, t); }
    t.pyBusy = false; t.inputRow.hidden = false;
    if (t === active) { paintPrompt(); scroll(); focusInput(); } else scroll(t);
    afterCommand(cmd);
  }

  // ---------- VS Code: "code ." opens the practice copy above the terminal, with its own terminal panel ----------
  let ide = null, ideRoot = null, idePane = null, ideLoading = false;
  async function openIde({ dir, file }) {
    const from = active;
    if (ide && ideRoot === dir) { if (file) { if (!sh.isFile(file)) sh.fs.set(file, { type: "f", mode: "rw-rw-r--", content: "" }); ide.refresh(); ide.open(file); } ideBox.scrollIntoView({ block: "nearest" }); return; }
    if (ideLoading) return;
    ideLoading = true;
    addLine({ text: "(VS Code is opening above this terminal…)", cls: "hint" }, from); scroll(from);
    try {
      const { createVsCode, shellFs } = await import("./vscode.js");
      if (ide) closeIde(true);
      if (file && !sh.isFile(file)) sh.fs.set(file, { type: "f", mode: "rw-rw-r--", content: "" });
      // VS Code's own terminal panel: one more terminal that starts in the opened folder
      idePane = makeTab(true);
      idePane.group = { ide: true, root: null, last: idePane }; idePane.leaf = { t: idePane, p: null }; idePane.group.root = idePane.leaf;
      idePane.state.cwd = dir; idePane.state.env.PWD = dir;
      idePane.prompt.replaceChildren(...promptText(dir));
      ideRoot = dir; ideBox.hidden = false; ideBox.replaceChildren();
      ide = await createVsCode(ideBox, {
        fs: shellFs(sh), root: dir, open: file ? [file] : [], expand: file ? [file] : [], allowPaste: !!spec.allowPaste,
        terminal: idePane ? idePane.pane : null,
        onSave: () => { afterCommand(""); },
        onRun: (p) => { if (!idePane || idePane.pyBusy) return; switchTo(idePane); if (idePane.proc) stopProc(idePane); run(`python3 ${p}`); },
        onTerminalShown: () => { if (idePane) scroll(idePane); },
        onClose: () => closeIde(),
      });
      if (idePane) { addLine({ text: `(This is VS Code's terminal. It starts in ${pretty(dir)}.)`, cls: "hint" }, idePane); paintPrompt(); }
      paintTabs();
      ideBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (e) {
      addLine({ text: `(VS Code could not open here: ${e.message}. Use nano instead: nano FILE)`, cls: "err" }, from);
    } finally { ideLoading = false; afterCommand(""); }
  }
  function closeIde(quiet) {
    if (!ide) return;
    ide.destroy(); ide = null; ideRoot = null; ideBox.hidden = true;
    if (idePane) {
      const t = idePane; idePane = null;
      if (t.proc) stopProc(t, true);
      tabs = tabs.filter((x) => x !== t); t.pane.remove();
      if (active === t) { active = null; const g = shownGroup && groups.includes(shownGroup) ? shownGroup : groups[0]; switchTo(g.last && tabs.includes(g.last) ? g.last : firstLeaf(g.root)); }
    }
    paintTabs();
    if (!quiet) { addLine({ text: "(VS Code closed.)", cls: "hint" }); scroll(); focusInput(); }
  }
  function afterCommand(cmd) {
    while (!finished && step < tasks.length && sh.check(tasks[step].check, cmd)) {
      step++;
      if (step >= tasks.length) { finished = true; doneBox.hidden = false; onComplete && onComplete(); }
    }
    paintTasks(); paintPrompt(); scroll();
  }
  function showHint() {
    if (finished || !tasks[step]) return;
    addLine({ text: "Hint: " + (tasks[step].hint || "Read step " + (step + 1) + " again carefully."), cls: "hint" }); scroll();
  }
  function histUp() { if (!sh.history.length || !active || active.proc) return; histPos = histPos < 0 ? sh.history.length - 1 : Math.max(0, histPos - 1); active.input.value = sh.history[histPos]; }
  function doTab() {
    if (!active || active.proc) return;
    const r = sh.complete(active.input.value);
    if (r.line != null) active.input.value = r.line;
    else if (r.options && r.options.length > 1) { echoCommand(active.input.value); addLine({ text: r.options.join("  ") }); scroll(); }
  }

  // ---------- foreground processes: a node keeps its terminal busy until Ctrl+C ----------
  function startProc(t, fulls, cmd) {
    const kinds = fulls.map((f) => (sh.graph.node(f) || {}).kind);
    const label = cmd.split(/\s+/)[2] === "launch" || cmd.split(/\s+/)[1] === "launch" ? "ros2 launch" : (cmd.split(/\s+/)[3] || fulls[0]).replace(/^.*\//, "");
    t.proc = { fulls, kinds, label, count: 0 };
    if (kinds.includes("talker")) chat = Math.max(chat, 3);   // the start-up lines already showed messages 1 to 3
    t.inputRow.hidden = true;
    const stopBtn = el("button", { type: "button", class: "btn btn-small", text: "Ctrl+C  (stop it)", onclick: () => { stopProc(t); focusInput(); } });
    const kids = [el("span", { class: "tp-dot", "aria-hidden": "true" }),
      el("span", { class: "tp-text" }, el("b", { text: fulls.join(", ") }), " is running in this terminal. ", el("span", { class: "muted", text: "Real ROS 2 works the same way: open a " }), el("b", { text: "+ New terminal" }), el("span", { class: "muted", text: " to type more commands." })), stopBtn];
    t.procBar.replaceChildren(...kids);
    if (kinds.includes("teleop_twist")) {
      const k = (key, txt) => el("button", { type: "button", class: "tk-key", "aria-label": `Key ${key}`, text: txt || key, onclick: () => { twistKey(t, key); } });
      t.keys = el("div", { class: "tele-keys" }, el("span", { class: "small", text: "Press the keys (or type them while this terminal is selected): i forward, , back, j / l turn, k stop, q / z faster / slower" }),
        el("div", { class: "tk-grid3" }, ...["u", "i", "o", "j", "k", "l", "m", ",", "."].map((x) => k(x))),
        el("span", { class: "small", text: "Holonomic (Shift): U I O / J K L / M < >   ·   t up, b down (drones)" }),
        el("div", { class: "tk-grid3" }, ...["U", "I", "O", "J", "K", "L", "M", "<", ">"].map((x) => k(x))),
        el("div", { class: "tk-grid3" }, k("t"), k("b")));
      t.keys.dataset.twist = "1";
      t.procBar.append(t.keys);
    }
    if (kinds.includes("teleop")) {
      const k = (dir, txt) => el("button", { type: "button", class: "tk-key", "aria-label": `Arrow ${dir}`, text: txt, onclick: () => { teleKey(t, dir); } });
      t.keys = el("div", { class: "tele-keys" }, el("span", { class: "small", text: "Drive (or use your arrow keys while this terminal is selected):" }),
        el("div", { class: "tk-grid" }, el("span"), k("up", "↑"), el("span"), k("left", "←"), k("down", "↓"), k("right", "→")));
      t.procBar.append(t.keys);
    }
    t.procBar.hidden = false;
    t.screen.insertBefore(t.procBar, t.inputRow);   // node output goes above the bar; the prompt comes back below it
    paintTabs();
  }
  function stopProc(t, quiet) {
    if (!t.proc) return;
    if (!quiet) {
      addLine({ text: "^C[INFO] [rclcpp]: signal_handler(signum=2)" }, t);
      if (t.proc.fulls.length > 1) { addLine({ text: "[WARNING] [launch]: user interrupted with ctrl-c (SIGINT)" }, t); t.proc.fulls.forEach((f, i) => { const nd = sh.graph.node(f) || {}; addLine({ text: `[INFO] [${nd.procName || `${f.split("/").pop()}-${i + 1}`}]: process has finished cleanly [pid ${nd.pid || 4321 + i}]` }, t); }); }
    }
    // teleop_twist_keyboard publishes a zero twist when it exits (its finally: block), so the robot stops
    for (const f of t.proc.fulls) { const nd = sh.graph.node(f); if (nd && nd.kind === "teleop_twist" && nd.lastV && (nd.lastV.lx || nd.lastV.az)) sh.graph.teleopTwistKey(f, "k"); }
    t.proc.fulls.forEach((f) => sh.graph.stop(f));
    t.proc = null; t.keys = null;
    t.procBar.hidden = true; t.procBar.remove(); t.inputRow.hidden = false;
    paintTabs(); paintSim();
    if (t === active) { paintPrompt(); scroll(); }
    afterCommand("");
  }
  function twistKey(t, key) {
    const full = t.proc && t.proc.fulls.find((f) => (sh.graph.node(f) || {}).kind === "teleop_twist"); if (!full) return;
    const r = sh.graph.teleopTwistKey(full, key);
    if (r && r.line) addLine({ text: r.line }, t);
    else if (r && r.driven.length && r.timeout && !t.warnedTimeout) { t.warnedTimeout = true; addLine({ text: `(diff_drive_controller stops the wheels ${r.timeout} s after the last command (cmd_vel_timeout). Hold the key down to keep driving, or start teleop with -p repeat_rate:=10.0 so it repeats the last key.)`, cls: "hint" }, t); }
    else if (r && !r.driven.length && !t.warnedTwist) {
      t.warnedTwist = true;
      const g = sh.graph;
      const msg = r.note ? `(${r.note})`
        : r.cmTopics && r.cmTopics.length ? `(Nothing moves: this robot uses ros2_control. diff_drive_controller listens on ${r.cmTopics[0]} for geometry_msgs/msg/TwistStamped, but this teleop publishes a plain Twist on ${r.v.topic}. Stop it (Ctrl+C) and run: ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true -r cmd_vel:=${r.cmTopics[0]})`
        : r.stamped && g.gzRunning() ? `(teleop publishes TwistStamped on ${r.v.topic}, but no controller listens there. List the controllers' topics with: ros2 topic list)`
        : g.gzRunning() ? `(teleop_twist_keyboard publishes on ${r.v.topic}, but nothing carries it into Gazebo: no ros_gz_bridge entry for ${r.v.topic} and no ros2_control controller on it, so nothing moves.)`
        : `(teleop_twist_keyboard publishes on ${r.v.topic}, but nothing subscribes to it yet. Start the simulation first.)`;
      addLine({ text: msg, cls: "hint" }, t);
    }
    scroll(t); paintSim(true);
  }
  function teleKey(t, dir) {
    const hit = sh.graph.teleopKey(t.proc.fulls.find((f) => (sh.graph.node(f) || {}).kind === "teleop"), dir);
    if (!hit) addLine({ text: "[WARN] [teleop_turtle]: no turtle is listening on /turtle1/cmd_vel. Start turtlesim in another terminal.", cls: "hint" }, t);
    paintSim(true); scroll(t);
  }
  // live output: talkers publish and listeners hear, once per second
  let chat = 0;
  const ticker = setInterval(() => {
    if (!root.isConnected) { clearInterval(ticker); return; }
    if (sh.graph.tickCustom()) paintSim(true);
    const talking = sh.graph.nodes.some((n) => n.kind === "talker");
    if (!talking) return;
    chat++;
    for (const t of tabs) {
      if (!t.proc) continue;
      t.proc.fulls.forEach((f) => {
        const n = sh.graph.node(f); if (!n) return;
        if (n.kind === "talker") addLine({ text: `[INFO] [${n.name}]: Publishing: 'Hello World: ${chat}'` }, t);
        if (n.kind === "listener") addLine({ text: `[INFO] [${n.name}]: I heard: [Hello World: ${chat}]` }, t);
      });
      if (t === active || t.screen.scrollHeight - t.screen.scrollTop < t.screen.clientHeight + 60) scroll(t);
    }
  }, 1000);

  function flushNotices() {
    const q = sh.graph.notices || []; sh.graph.notices = [];
    for (const nt of q) { const t = tabs.find((x) => x.proc && x.proc.fulls.includes(nt.node)); if (t) { addLine({ text: nt.text, cls: nt.cls || (/\[(WARN|ERROR)\]/.test(nt.text) ? "warn-line" : "") }, t); scroll(t); } }
  }

  // ---------- the TurtleSim window(s) ----------
  const W = 11.088889, SIZE = 250;
  const sims = new Map();   // node full name -> { box, canvas, shown: {turtle: {x,y,theta}} }
  function paintSim(animate) {
    paintViz();
    flushNotices();
    const live = sh.graph.turtlesims();
    for (const [full, s] of sims) if (!live.some((n) => n.full === full)) { s.box.remove(); sims.delete(full); }
    for (const n of live) {
      if (!sims.has(n.full)) {
        const canvas = el("canvas", { width: SIZE * 2, height: SIZE * 2, "aria-label": `TurtleSim window for ${n.full}`, role: "img" });
        canvas.style.width = canvas.style.height = SIZE + "px";
        const box = el("figure", { class: "tsim-win" }, el("figcaption", {}, el("i"), el("i"), el("i"), el("span", { text: `TurtleSim  ${n.full}` })), canvas);
        simPanel.append(box);
        sims.set(n.full, { box, canvas, shown: {} });
      }
      drawSim(n, sims.get(n.full), animate);
    }
    const bots = sh.graph.robots();
    for (const [full, s] of robs) if (!bots.some((n) => n.full === full)) { s.box.remove(); robs.delete(full); }
    for (const n of bots) {
      if (!robs.has(n.full)) {
        const canvas = el("canvas", { width: SIZE * 2, height: SIZE * 2, "aria-label": `Robot window for ${n.full}`, role: "img" });
        canvas.style.width = canvas.style.height = SIZE + "px";
        const box = el("figure", { class: "tsim-win" }, el("figcaption", {}, el("i"), el("i"), el("i"), el("span", { text: sh.graph.vkind(n) === "arm" ? `2-link arm  ${n.full}` : `Mobile base (odom view)  ${n.full}` })), canvas);
        simPanel.append(box);
        robs.set(n.full, { box, canvas });
      }
      drawRobot(n, robs.get(n.full).canvas);
    }
    simPanel.hidden = live.length === 0 && bots.length === 0;
  }
  const robs = new Map();
  function drawRobot(n, canvas) {
    const ctx = canvas.getContext("2d"), S = SIZE * 2;
    const vk = sh.graph.vkind(n), arm = sh.graph.nodes.find((x) => sh.graph.vkind(x) === "arm");
    const span = vk === "arm" ? (n.params.link1_length + n.params.link2_length) * 1.15 : 3;
    let cx = 0, cy = 0;
    if (vk === "diffbot") { cx = n.base.x; cy = n.base.y; }
    const k = S / (2 * span), X = (x) => S / 2 + (x - cx) * k, Y = (y) => S / 2 - (y - cy) * k;
    ctx.fillStyle = "#0f1720"; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1;
    const step = span > 2.5 ? 1 : 0.25;
    for (let g = Math.floor((cx - span) / step) * step; g <= cx + span; g += step) { ctx.beginPath(); ctx.moveTo(X(g), 0); ctx.lineTo(X(g), S); ctx.stroke(); }
    for (let g = Math.floor((cy - span) / step) * step; g <= cy + span; g += step) { ctx.beginPath(); ctx.moveTo(0, Y(g)); ctx.lineTo(S, Y(g)); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), S); ctx.moveTo(0, Y(0)); ctx.lineTo(S, Y(0)); ctx.stroke();
    ctx.font = "20px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.7)";
    const drawArm = (ox, oy, oth, A) => {
      const l1 = A.params.link1_length, l2 = A.params.link2_length, q = A.q;
      const j1 = [ox + l1 * Math.cos(oth + q[0]), oy + l1 * Math.sin(oth + q[0])], e = [j1[0] + l2 * Math.cos(oth + q[0] + q[1]), j1[1] + l2 * Math.sin(oth + q[0] + q[1])];
      ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(120,180,255,.35)"; ctx.beginPath(); ctx.arc(X(ox), Y(oy), (l1 + l2) * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineCap = "round"; ctx.lineWidth = 14; ctx.strokeStyle = "#f59e0b"; ctx.beginPath(); ctx.moveTo(X(ox), Y(oy)); ctx.lineTo(X(j1[0]), Y(j1[1])); ctx.stroke();
      ctx.strokeStyle = "#38bdf8"; ctx.beginPath(); ctx.moveTo(X(j1[0]), Y(j1[1])); ctx.lineTo(X(e[0]), Y(e[1])); ctx.stroke();
      ctx.fillStyle = "#e5e7eb"; for (const [px, py] of [[ox, oy], j1]) { ctx.beginPath(); ctx.arc(X(px), Y(py), 9, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(X(e[0]), Y(e[1]), 8, 0, Math.PI * 2); ctx.fill();
      if (A.target) {
        const tx = ox + Math.cos(oth) * A.target[0] - Math.sin(oth) * A.target[1], ty = oy + Math.sin(oth) * A.target[0] + Math.cos(oth) * A.target[1];
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(tx) - 9, Y(ty) - 9); ctx.lineTo(X(tx) + 9, Y(ty) + 9); ctx.moveTo(X(tx) + 9, Y(ty) - 9); ctx.lineTo(X(tx) - 9, Y(ty) + 9); ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillText(`q1=${(q[0] * 180 / Math.PI).toFixed(1)}°  q2=${(q[1] * 180 / Math.PI).toFixed(1)}°`, 14, S - 16);
    };
    if (vk === "arm") { ctx.fillText("base_link frame (metres)", 14, 28); drawArm(0, 0, 0, n); return; }
    const b = n.base;
    const T = n.truth;
    if (T && Math.hypot(T.x - b.x, T.y - b.y) > 0.02) {   // odometry has drifted: show where the robot REALLY is
      ctx.setLineDash([8, 6]); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.beginPath(); T.path.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(X(T.x), Y(T.y), 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillText("dashed = real path, purple = odometry", 14, S - 40);
    }
    ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 3; ctx.beginPath(); n.path.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
    ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.rotate(-b.theta);
    const L = 0.36 * k, Wd = 0.3 * k;
    ctx.fillStyle = "#475569"; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
    ctx.fillStyle = "#111827"; ctx.fillRect(-L * 0.3, -Wd / 2 - 8, L * 0.6, 10); ctx.fillRect(-L * 0.3, Wd / 2 - 2, L * 0.6, 10);
    ctx.strokeStyle = "#f87171"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.7, 0); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillText(`odom: x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} θ=${b.theta.toFixed(2)} rad`, 14, 28);
    if (arm && arm.world) drawArm(b.x, b.y, b.theta, arm);
  }
  function drawSim(n, s, animate) {
    const ctx = s.canvas.getContext("2d"), k = (SIZE * 2) / W;
    const X = (x) => x * k, Y = (y) => (W - y) * k;
    const frame = (blend) => {
      const P = n.params;
      ctx.fillStyle = `rgb(${P.background_r},${P.background_g},${P.background_b})`;
      ctx.fillRect(0, 0, SIZE * 2, SIZE * 2);
      for (const t of n.turtles) for (const seg of t.trail || []) {
        ctx.strokeStyle = `rgb(${seg.r},${seg.g},${seg.b})`; ctx.lineWidth = Math.max(1, seg.width) * 1.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); seg.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
      }
      for (const t of n.turtles) {
        const from = s.shown[t.name] || t;
        const lerp = (a, b) => a + (b - a) * blend;
        let dth = t.theta - from.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
        const x = lerp(from.x, t.x), y = lerp(from.y, t.y), th = from.theta + dth * blend;
        drawTurtle(ctx, X(x), Y(y), th, k);
        ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = "22px sans-serif"; ctx.fillText(t.name, X(x) + 26, Y(y) - 22);
      }
    };
    const done = () => { n.turtles.forEach((t) => { s.shown[t.name] = { x: t.x, y: t.y, theta: t.theta }; }); };
    const moved = n.turtles.some((t) => { const o = s.shown[t.name]; return o && (o.x !== t.x || o.y !== t.y || o.theta !== t.theta); });
    if (!animate && !moved || matchMedia("(prefers-reduced-motion: reduce)").matches) { frame(1); done(); return; }
    const t0 = performance.now(), ms = 700;
    const stepA = (now) => { const b = Math.min(1, (now - t0) / ms); frame(b); if (b < 1 && s.canvas.isConnected) requestAnimationFrame(stepA); else done(); };
    requestAnimationFrame(stepA);
  }
  function drawTurtle(ctx, x, y, th, k) {
    const r = k * 0.32;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-th);
    ctx.fillStyle = "#3f8f3a"; ctx.strokeStyle = "#1f3d1c"; ctx.lineWidth = 3;
    for (const [lx, ly] of [[0.55, 0.55], [0.55, -0.55], [-0.55, 0.55], [-0.55, -0.55]]) { ctx.beginPath(); ctx.ellipse(lx * r, ly * r, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(r * 0.95, 0, r * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#7cc36b"; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#2d6a27"; ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0); ctx.stroke();
    ctx.restore();
  }

  // ---------- keyboard ----------
  function onKey(e, t) {
    const input = t.input;
    if (e.key === "Enter") { e.preventDefault(); const v = input.value; input.value = ""; histPos = -1; run(v); }
    else if (e.key === "ArrowUp") { e.preventDefault(); histUp(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (histPos >= 0) { histPos++; input.value = histPos < sh.history.length ? sh.history[histPos] : ""; if (histPos >= sh.history.length) histPos = -1; } }
    else if (e.key === "Tab") { e.preventDefault(); doTab(); }
    else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); echoCommand(input.value + "^C"); input.value = ""; histPos = -1; scroll(); }
    else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); [...t.screen.querySelectorAll(".line")].forEach((n) => n.remove()); }
  }
  // while a node runs, keys go to it: Ctrl+C stops it, arrows drive teleop
  root.addEventListener("keydown", (e) => {
    const t = active;
    if (!t || !t.proc || e.target.tagName === "TEXTAREA" || e.altKey || e.shiftKey) return;
    if (e.target.closest(".vsc") && !e.target.closest(".tmr-pane")) return;   // typing in the VS Code editor
    if (e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); stopProc(t); focusInput(); return; }
    if (t.keys && t.keys.dataset.twist && !e.ctrlKey && !e.metaKey && e.key.length === 1) { e.preventDefault(); twistKey(t, e.key); return; }   // u i o j k l m , . move; q z w x e c change speed; anything else stops
    const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
    if (dir && t.keys && !t.keys.dataset.twist) { e.preventDefault(); teleKey(t, dir); }
  });

  function resetAll() {
    if (ide) { ide.destroy(); ide = null; ideRoot = null; ideBox.hidden = true; idePane = null; }
    tabs.forEach((t) => { t.pane.remove(); });
    tabs = []; active = null; groups = []; zoomed = null; closeMenu();
    sh.reset(); step = 0; finished = false; doneBox.hidden = true; histPos = -1;
    const first = makeTab(false); newGroup(first); switchTo(first);
    if (spec.intro) addLine({ text: spec.intro, cls: "hint" });
    paintTasks(); paintPrompt(); paintSim(); focusInput();
  }

  function openNano({ path, name, content, root: asRoot }) {
    const t = active;
    t.input.disabled = true;
    const ta = el("textarea", { spellcheck: "false", "aria-label": `Editing ${name}` });
    ta.value = content;
    const bar = el("div", { class: "nano-bar", text: `GNU nano 7.2     ${name}` });
    const status = el("span", { text: "" });
    let saved = content, asking = false;
    const save = () => {
      if (!sh.writable(path, asRoot)) { status.textContent = "[ Error writing: Permission denied ]"; return; }
      sh.fs.set(path, { type: "f", mode: sh.isFile(path) ? sh.node(path).mode : "rw-r--r--", content: ta.value.endsWith("\n") || !ta.value ? ta.value : ta.value + "\n" });
      saved = ta.value; status.textContent = `[ Wrote ${ta.value.split("\n").filter((x, i, a) => i < a.length - 1 || x).length} lines ]`;
    };
    const close = () => { box.remove(); t.input.disabled = false; addLine({ text: `(closed nano: ${name})`, cls: "hint" }, t); afterCommand(`nano ${name}`); if (ide) ide.refresh(); t.input.focus(); };
    const exit = () => {
      if (ta.value === saved) return close();
      asking = true; status.textContent = "Save changes? Press Y for yes or N for no.";
    };
    ta.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (asking) { e.preventDefault(); if (k === "y") { save(); close(); } else if (k === "n") close(); return; }
      if (e.ctrlKey && k === "o") { e.preventDefault(); save(); }
      else if (e.ctrlKey && k === "x") { e.preventDefault(); exit(); }
      else if (e.key === "Tab") { e.preventDefault(); ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end"); }
    });
    const keys = el("div", { class: "nano-keys" },
      el("button", { type: "button", text: "^O Save", onclick: () => { save(); ta.focus(); } }),
      el("button", { type: "button", text: "^X Exit", onclick: () => { exit(); ta.focus(); } }), status);
    const box = el("div", { class: "nano" }, bar, ta, keys);
    box.addEventListener("click", (e) => { if (!e.target.closest("button, textarea")) ta.focus(); });
    t.pane.append(box);
    ta.focus();
  }

  const first = makeTab(false);
  newGroup(first);
  switchTo(first);
  if (spec.intro) addLine({ text: spec.intro, cls: "hint" });
  paintTasks(); paintPrompt(); paintSim();
  // for pages that drive the terminal (the RViz page): type a command as if the student did, print a note, Ctrl+C everything
  return {
    shell: sh, isDone: () => finished,
    run: (cmd) => { if (!active) return; if (active.proc) stopProc(active); run(cmd); },
    say: (text) => { addLine({ text, cls: "hint" }); scroll(); },
    stopAll: () => { for (const t of tabs) if (t.proc) stopProc(t); },
    busy: () => tabs.some((t) => t.proc),
    focus: () => focusInput(),
  };
}
