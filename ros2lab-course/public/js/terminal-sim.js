// A safe, simulated Ubuntu terminal for practice. Nothing here touches a real computer.
import { el, rich } from "./dom.js";
import { RosGraph, pkgCreate, findPackages, pkgExecutables } from "./ros-graph.js";

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
  "ros-jazzy-ros-gz": { repo: true, ros: ["ros_gz_sim", "ros_gz_bridge"], cmd: ["gz"], about: "Gazebo Harmonic simulator connected to ROS 2" },
  "ros-jazzy-ros2-control": { repo: true, ros: ["controller_manager"], about: "ros2_control framework" },
  "ros-jazzy-ros2-controllers": { repo: true, ros: ["diff_drive_controller", "joint_trajectory_controller"], about: "Standard controllers" },
  "ros-jazzy-gz-ros2-control": { repo: true, ros: ["gz_ros2_control"], about: "ros2_control inside Gazebo" },
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
const DEFAULT_ROS = ["turtlesim", "demo_nodes_py", "demo_nodes_cpp", "rclpy", "std_msgs", "rqt"];
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
  "add-apt-repository", "curl", "dpkg", "rosdep", "colcon", "gz", "g++", "rqt_graph", "rviz2"];

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
    this.env = { ...BASE_ENV, ...(s.env || {}) };
    this.sourced = false;
    this.rosPkgs = new Set(s.bareRos ? ["rclpy", "std_msgs"] : DEFAULT_ROS);
    this.cmds = new Set(COMMANDS.filter((c) => !["tree", "colcon", "rosdep", "gz", "vcs", "curl", "add-apt-repository"].includes(c)));
    this.cmds.add("curl"); this.cmds.add("add-apt-repository");
    this.rosRepo = true; this.rosInstalled = true; this.updatedAfterRepo = true;
    this.rosdepInit = false; this.rosdepUpdated = false; this.aptDone = new Set();
    if (s.fresh) {   // a brand-new Ubuntu 24.04: no ROS 2 yet
      for (const k of [...this.fs.keys()]) if (k === "/opt/ros" || k.startsWith("/opt/ros/")) this.fs.delete(k);
      this.rosPkgs = new Set(); this.rosRepo = false; this.rosInstalled = false; this.updatedAfterRepo = false;
      this.cmds.delete("curl"); this.cmds.delete("add-apt-repository");
    }
    for (const c of s.cmds || []) this.cmds.add(c);
    this.aptUpdated = false;
    this.sudoTold = false;
    // a pretend running ROS 2 system (nodes in "other terminals"), and packages built with colcon
    this.graph = Array.isArray(s.running) || s.graph ? new RosGraph(this, s.running || []) : null;
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
    const line = rawLine.trim();
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
        if (r.clear || r.nano || this.lastError) return this.result(all, r);
      }
      return this.result(all);
    }
    this.history.push(line);
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
      if (res.clear || res.nano) break;
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
        return { lines: this.runFile(plain[0], false) };
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
  execMore(cmd, rest, plain, flags, root) {
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
        if (plain[0] !== "sim") return { lines: [this.out("usage: gz sim <world.sdf>")] };
        return { lines: [this.hint(`(Practice terminal: Gazebo Harmonic would open a 3D window showing ${plain[1] || "an empty world"}.)`)] };
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
        if (!(b in ws.exes)) return [this.err("No executable found"), this.hint(`See the programs in this package with: ros2 pkg executables ${a}`)];
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
    if (sub === "launch") { const r = this.graph && this.rosPkgs.has(a) ? this.graph.launch(a, b) : null; return r || this.ros2Launch(a, b); }
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
  check(c, lastCmd) {
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

  const taskItems = tasks.map((t, i) => el("li", {}, el("span", { class: "box", text: String(i + 1) }), el("span", {}, rich(t.do))));
  const taskBox = tasks.length ? el("div", { class: "term-tasks" }, el("ol", {}, taskItems)) : null;
  const screen = el("div", { class: "term-screen", role: "log", "aria-live": "polite" });
  const input = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Type a command and press Enter" });
  const promptSpan = el("span", { class: "pr" });
  const inputRow = el("div", { class: "term-input-row" }, promptSpan, input);
  const doneBox = el("div", { class: "term-done", hidden: true, text: "All steps done. Well done!" });
  const screenWrap = el("div", { style: { position: "relative" } }, screen);

  const tools = el("div", { class: "term-tools" },
    el("button", { type: "button", text: "Tab", title: "Complete a name (same as the Tab key)", onclick: () => { doTab(); input.focus(); } }),
    el("button", { type: "button", text: "↑ Last command", onclick: () => { histUp(); input.focus(); } }),
    tasks.length ? el("button", { type: "button", text: "Show a hint", onclick: showHint }) : null,
    spec.newTerminal ? el("button", { type: "button", text: "Open a new terminal", onclick: newTerm }) : null,
    el("button", { type: "button", text: "Start again", onclick: resetAll }),
  );
  const root = el("div", { class: "term" },
    el("div", { class: "term-title" }, el("i"), el("i"), el("i"), el("span", { text: spec.title || "Practice terminal" })),
    taskBox, screenWrap, tools, doneBox);
  container.append(root);

  function promptText() { return [el("span", { text: `${USER}@${HOST}:` }), el("b", { text: sh.prettyCwd() }), document.createTextNode("$ ")]; }
  function paintPrompt() { promptSpan.replaceChildren(...promptText()); }
  function addLine(l) {
    if (l.segs) { screen.insertBefore(el("div", { class: "line" }, ...l.segs.flatMap((s, i) => [i ? "  " : "", el("span", { class: s.c || null, text: s.t })])), inputRow); return; }
    screen.insertBefore(el("div", { class: "line" + (l.cls ? " " + l.cls : ""), text: l.text }), inputRow);
  }
  function echoCommand(cmd) { screen.insertBefore(el("div", { class: "line" }, el("span", { class: "pr" }, ...promptText()), cmd), inputRow); }
  function scroll() { screen.scrollTop = screen.scrollHeight; }
  function paintTasks() {
    taskItems.forEach((li, i) => { li.className = i < step ? "done" : i === step && !finished ? "now" : ""; li.querySelector(".box").textContent = i < step ? "✓" : String(i + 1); });
  }

  function run(cmd) {
    echoCommand(cmd);
    const res = sh.run(cmd);
    if (res.clear) { [...screen.querySelectorAll(".line")].forEach((n) => n.remove()); }
    res.lines.forEach(addLine);
    if (res.nano) openNano(res.nano);
    afterCommand(cmd);
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
  function histUp() { if (!sh.history.length) return; histPos = histPos < 0 ? sh.history.length - 1 : Math.max(0, histPos - 1); input.value = sh.history[histPos]; }
  function doTab() {
    const r = sh.complete(input.value);
    if (r.line != null) input.value = r.line;
    else if (r.options && r.options.length > 1) { echoCommand(input.value); addLine({ text: r.options.join("  ") }); scroll(); }
  }
  function newTerm() {
    sh.newTerminal();
    [...screen.querySelectorAll(".line")].forEach((n) => n.remove());
    addLine({ text: "(A new terminal window opened. It started fresh and ran ~/.bashrc.)", cls: "hint" });
    afterCommand("");
  }
  function resetAll() {
    sh.reset(); step = 0; finished = false; doneBox.hidden = true; histPos = -1;
    [...screen.querySelectorAll(".line")].forEach((n) => n.remove());
    if (spec.intro) addLine({ text: spec.intro, cls: "hint" });
    paintTasks(); paintPrompt(); input.value = ""; input.focus({ preventScroll: true });
  }

  function openNano({ path, name, content, root: asRoot }) {
    input.disabled = true;
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
    const close = () => { box.remove(); input.disabled = false; addLine({ text: `(closed nano: ${name})`, cls: "hint" }); afterCommand(`nano ${name}`); input.focus(); };
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
    screenWrap.append(box);
    ta.focus();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); const v = input.value; input.value = ""; histPos = -1; run(v); }
    else if (e.key === "ArrowUp") { e.preventDefault(); histUp(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (histPos >= 0) { histPos++; input.value = histPos < sh.history.length ? sh.history[histPos] : ""; if (histPos >= sh.history.length) histPos = -1; } }
    else if (e.key === "Tab") { e.preventDefault(); doTab(); }
    else if (e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); echoCommand(input.value + "^C"); input.value = ""; scroll(); }
    else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); [...screen.querySelectorAll(".line")].forEach((n) => n.remove()); }
  });
  if (spec.allowPaste) input.addEventListener("paste", (e) => e.stopPropagation());   // page-wide paste blocking skips this terminal
  screen.addEventListener("click", () => { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); });
  screen.append(inputRow);
  if (spec.intro) addLine({ text: spec.intro, cls: "hint" });
  paintTasks(); paintPrompt();
  return { shell: sh, isDone: () => finished };
}
