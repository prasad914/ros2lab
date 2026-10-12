// Module A: Ubuntu terminal question templates.
// Each template's make(r) returns ONE randomized question for one student.
// Fields: prompt (text, `code` allowed), code (optional block), options (mcq),
// items (order: in the CORRECT order), correct, accept (text answers), explain.
const { pick, pickN, int, USERS, WORKSPACES, PKGS, FOLDERS, PYFILES, TEXTFILES } = require("./util");

const parent = (p) => p.replace(/\/[^/]+$/, "") || "/";
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const withSlash = (p) => [p, p + "/"];

const T = [];

// ======================= topic: nav (moving around) =======================
T.push({
  id: "A-NAV-PWD", topic: "nav", type: "predict",
  make(r) {
    const u = pick(r, USERS), w = pick(r, WORKSPACES), p = pick(r, PKGS);
    const home = `/home/${u}`;
    let start, cwd, lines = [];
    if (r() < 0.6) {
      start = cwd = `${home}/${w}/src/${p}`;
      const ups = int(r, 1, 3);
      for (let i = 0; i < ups; i++) { lines.push("cd .."); cwd = parent(cwd); }
      if (cwd === `${home}/${w}`) { const d = pick(r, ["build", "install", "log"]); lines.push(`cd ${d}`); cwd += `/${d}`; }
      else if (cwd === home) { const d = pick(r, ["Documents", "Downloads", "Desktop"]); lines.push(`cd ${d}`); cwd += `/${d}`; }
    } else {
      start = "/opt/ros/jazzy";
      lines = ["cd ~", `cd ${w}/src`];
      cwd = `${home}/${w}/src`;
    }
    return {
      prompt: `You are logged in as **${u}**. Your terminal is in \`${start}\`. You type the commands below, one by one. What does the last command, \`pwd\`, print?`,
      code: [...lines, "pwd"].join("\n"),
      correct: cwd, accept: withSlash(cwd),
      explain: `\`cd ..\` goes up one folder, \`cd name\` goes into a folder, and \`~\` means your home folder (${home}). Following the steps ends in ${cwd}.`,
    };
  },
});

T.push({
  id: "A-NAV-CD", topic: "nav", type: "mcq",
  make(r) {
    const u = pick(r, USERS), w = pick(r, WORKSPACES);
    return {
      prompt: `You are in \`/home/${u}\`. Which command takes you into \`/home/${u}/${w}/src\`?`,
      options: [`cd ${w}/src`, `cd /${w}/src`, `cd src/${w}`, `cd ${w} src`],
      correct: `cd ${w}/src`,
      explain: `From /home/${u}, the relative path ${w}/src means "go into ${w}, then into src". A path starting with / starts from the very top of the disk instead.`,
    };
  },
});

T.push({
  id: "A-NAV-ABS", topic: "nav", type: "mcq",
  make(r) {
    const u = pick(r, USERS), w = pick(r, WORKSPACES), f = pick(r, FOLDERS), py = pick(r, PYFILES);
    return {
      prompt: "Which one is an **absolute path** (a full address that starts from the top folder of the computer)?",
      options: [`/home/${u}/${w}`, `${w}/src`, `../${f}`, `./${py}`],
      correct: `/home/${u}/${w}`,
      explain: "Absolute paths always start with / (the top folder). The others are relative: they depend on where you are now.",
    };
  },
});

T.push({
  id: "A-NAV-UP", topic: "nav", type: "fill",
  make(r) {
    const u = pick(r, USERS), w = pick(r, WORKSPACES), p = pick(r, PKGS);
    const target = `/home/${u}/${w}`;
    return {
      prompt: `You are in \`/home/${u}/${w}/src/${p}\`. Type **one** command that takes you to \`${target}\`.`,
      correct: "cd ../..",
      accept: ["cd ../..", "cd ../../", ...withSlash(`cd ${target}`), ...withSlash(`cd ~/${w}`)],
      explain: `Each .. means "one folder up". Two of them (cd ../..) go from ${p} to src, then to ${w}. Typing the full path cd ${target} also works.`,
    };
  },
});

T.push({
  id: "A-NAV-LS", topic: "nav", type: "mcq",
  make(r) {
    if (r() < 0.5) {
      return {
        prompt: "Which command lists the files in the current folder **including hidden files** (names that start with a dot, like `.bashrc`)?",
        options: ["ls -a", "ls", "cd -a", "pwd -a"],
        correct: "ls -a",
        explain: "-a means \"all\". Plain ls hides names that begin with a dot.",
      };
    }
    return {
      prompt: "Which command lists files **with details** such as permissions, owner and size?",
      options: ["ls -l", "ls -a", "cd -l", "pwd -l"],
      correct: "ls -l",
      explain: "-l means \"long format\": one file per line with permissions, owner, size and date.",
    };
  },
});

T.push({
  id: "A-NAV-CASE", topic: "nav", type: "mcq",
  make(r) {
    const f = pick(r, FOLDERS);
    return {
      prompt: `\`ls\` shows a folder named \`${cap(f)}\`, but \`cd ${f}\` says "No such file or directory". Why?`,
      options: [
        `Linux treats capital and small letters as different, so ${f} and ${cap(f)} are different names`,
        "The folder is hidden, so cd cannot see it",
        "You must use sudo to enter any folder",
        "cd only works with absolute paths",
      ],
      correct: `Linux treats capital and small letters as different, so ${f} and ${cap(f)} are different names`,
      explain: `Linux is case-sensitive. Type cd ${cap(f)} exactly as ls shows it (Tab completion helps).`,
    };
  },
});

// ======================= topic: files =======================
T.push({
  id: "A-FILE-MKDIR", topic: "files", type: "fill",
  make(r) {
    const u = pick(r, USERS), w = pick(r, WORKSPACES);
    const variants = [`${w}/src`, `~/${w}/src`, `/home/${u}/${w}/src`, `./${w}/src`];
    return {
      prompt: `You are in \`/home/${u}\`. The folder \`${w}\` does **not** exist yet. Type one command that creates \`/home/${u}/${w}/src\` (both folders at once).`,
      correct: `mkdir -p ${w}/src`,
      accept: variants.flatMap((v) => withSlash(`mkdir -p ${v}`)),
      explain: "mkdir -p creates every missing folder along the path. Without -p, mkdir fails because the parent folder does not exist.",
    };
  },
});

T.push({
  id: "A-FILE-CP", topic: "files", type: "mcq",
  make(r) {
    const [d, dest] = pickN(r, FOLDERS, 2);
    const backup = `${d}_backup`;
    const target = r() < 0.5 ? backup : `${dest}/${d}`;
    return {
      prompt: `Which command copies the folder \`${d}\` **with everything inside it** to \`${target}\`?`,
      options: [`cp -r ${d} ${target}`, `cp ${d} ${target}`, `mv -r ${d} ${target}`, `copy ${d} ${target}`],
      correct: `cp -r ${d} ${target}`,
      explain: "cp copies. For a folder you need -r (recursive) so it copies everything inside. mv would move, not copy, and 'copy' is not a Linux command.",
    };
  },
});

T.push({
  id: "A-FILE-MV", topic: "files", type: "mcq",
  make(r) {
    const [a, b] = pickN(r, PYFILES, 2);
    return {
      prompt: `How do you **rename** the file \`${a}\` to \`${b}\`?`,
      options: [`mv ${a} ${b}`, `cp ${a} ${b}`, `rename ${a}`, `rm ${a} ${b}`],
      correct: `mv ${a} ${b}`,
      explain: "mv means move. Moving a file to a new name in the same folder renames it. cp would leave two copies.",
    };
  },
});

T.push({
  id: "A-FILE-RM", topic: "files", type: "mcq",
  make(r) {
    const d = pick(r, FOLDERS);
    return {
      prompt: `Which command deletes the folder \`${d}\` **and everything inside it**? (Careful: Linux has no recycle bin.)`,
      options: [`rm -r ${d}`, `rm ${d}`, `del ${d}`, `rm -p ${d}`],
      correct: `rm -r ${d}`,
      explain: `rm alone refuses to delete folders ("Is a directory"). rm -r removes the folder and its contents. Double-check the name first!`,
    };
  },
});

T.push({
  id: "A-FILE-LS", topic: "files", type: "predict",
  make(r) {
    const d = pick(r, FOLDERS);
    // choose two files with different first letters so alphabetical order is clear
    let a, b;
    do { [a, b] = pickN(r, PYFILES, 2); } while (a[0] === b[0]);
    const sorted = [a, b].sort();
    return {
      prompt: `You start in an empty folder and type the commands below. What does the last command, \`ls\`, print? (Type the names separated by a space.)`,
      code: [`mkdir ${d}`, `cd ${d}`, `touch ${a} ${b}`, "ls"].join("\n"),
      correct: sorted.join("  "),
      accept: [sorted.join(" ")],
      explain: `touch creates empty files. ls lists the folder's contents in alphabetical order: ${sorted.join(" then ")}.`,
    };
  },
});

T.push({
  id: "A-FILE-TAIL", topic: "files", type: "mcq",
  make(r) {
    const n = int(r, 3, 15), f = pick(r, TEXTFILES);
    return {
      prompt: `Which command shows only the **last ${n} lines** of \`${f}\`?`,
      options: [`tail -n ${n} ${f}`, `head -n ${n} ${f}`, `cat -n ${n} ${f}`, `ls -n ${n} ${f}`],
      correct: `tail -n ${n} ${f}`,
      explain: "tail shows the end of a file and head shows the beginning. -n chooses how many lines.",
    };
  },
});

// ======================= topic: perm (permissions and sudo) =======================
T.push({
  id: "A-PERM-CHMOD", topic: "perm", type: "fill",
  make(r) {
    const f = pick(r, PYFILES);
    const forms = ["+x", "u+x", "a+x", "ug+x", "755", "775", "744", "700", "777"];
    return {
      prompt: `Running \`./${f}\` prints "Permission denied". Type the command that makes \`${f}\` **executable**.`,
      correct: `chmod +x ${f}`,
      accept: forms.flatMap((m) => [`chmod ${m} ${f}`, `chmod ${m} ./${f}`]),
      explain: `chmod +x adds the "execute" permission. After that, ./${f} can run.`,
    };
  },
});

T.push({
  id: "A-PERM-RWX", topic: "perm", type: "mcq",
  make(r) {
    const u = pick(r, USERS), f = pick(r, PYFILES);
    const perms = [["rwxr-xr-x", true], ["rw-r--r--", false], ["rwx------", true], ["rw-rw-r--", false],
      ["r--r--r--", false], ["rwxrwxr-x", true], ["rw-r-xr-x", false]];
    const [perm, yes] = pick(r, perms);
    const YES = "Yes. The owner's part (the first rwx group) contains x";
    const NO = "No. The owner's part (the first rwx group) has no x";
    return {
      prompt: `\`ls -l\` shows the line below. Can the **owner** (${u}) run this file as a program?`,
      code: `-${perm} 1 ${u} ${u} 512 Oct  2 10:15 ${f}`,
      options: [YES, NO, "Only folders can be run, never files", "You cannot tell anything from ls -l"],
      correct: yes ? YES : NO,
      explain: `After the first character, letters come in three groups: owner, group, others. The owner's group here is ${perm.slice(0, 3)}, ${yes ? "which includes x (execute)" : "which has no x (execute)"}.`,
    };
  },
});

T.push({
  id: "A-PERM-SUDO", topic: "perm", type: "mcq",
  make(r) {
    const pkg = pick(r, ["ros-jazzy-turtlesim", "ros-jazzy-demo-nodes-py", "ros-jazzy-teleop-twist-keyboard", "ros-jazzy-rqt", "tree", "htop"]);
    return {
      prompt: `You typed \`apt install ${pkg}\` and saw: "Unable to acquire the dpkg frontend lock … are you root?". What should you type instead?`,
      options: [`sudo apt install ${pkg}`, `apt install ${pkg} --root`, "chmod +x apt", `root apt install ${pkg}`],
      correct: `sudo apt install ${pkg}`,
      explain: "Installing software changes the system, so it needs administrator rights. sudo runs one command as administrator (it asks for your password).",
    };
  },
});

T.push({
  id: "A-PERM-DIR", topic: "perm", type: "mcq",
  make(r) {
    const u = pick(r, USERS), d = pick(r, FOLDERS);
    return {
      prompt: "In the `ls -l` line below, the first character is `d`. What does that tell you?",
      code: `drwxr-xr-x 2 ${u} ${u} 4096 Oct  2 10:15 ${d}`,
      options: ["It is a folder (directory)", "It is a deleted file", "It is a downloaded file", "It is a file you are not allowed to open"],
      correct: "It is a folder (directory)",
      explain: "d means directory (folder). A normal file shows - as the first character.",
    };
  },
});

// ======================= topic: aptenv (installing, environment, source) =======================
const PKG_RUN = [
  ["ros-jazzy-turtlesim", "ros2 run turtlesim turtlesim_node"],
  ["ros-jazzy-demo-nodes-py", "ros2 run demo_nodes_py talker"],
  ["ros-jazzy-demo-nodes-cpp", "ros2 run demo_nodes_cpp listener"],
  ["ros-jazzy-teleop-twist-keyboard", "ros2 run teleop_twist_keyboard teleop_twist_keyboard"],
];

T.push({
  id: "A-APT-ORDER", topic: "apt", type: "order",
  make(r) {
    const [pkg, run] = pick(r, PKG_RUN);
    return {
      prompt: "Put these steps in the correct order to install a ROS 2 package and run it in a fresh terminal.",
      items: ["sudo apt update", `sudo apt install ${pkg}`, "source /opt/ros/jazzy/setup.bash", run],
      explain: "First refresh the list of software (update), then install, then load ROS 2 into this terminal (source), and only then run the program.",
    };
  },
});

T.push({
  id: "A-ENV-ECHO", topic: "env", type: "mcq",
  make(r) {
    const n = int(r, 1, 99);
    const sameTerminal = r() < 0.5;
    const EMPTY = "Nothing (just an empty line)";
    return {
      prompt: sameTerminal
        ? "You type the two commands below in the **same** terminal. What does the second one print?"
        : "You type the first command, then **close the terminal and open a new one**, and type the second command there. What does it print?",
      code: `export ROS_DOMAIN_ID=${n}\necho $ROS_DOMAIN_ID`,
      options: [String(n), EMPTY, "ROS_DOMAIN_ID", "$ROS_DOMAIN_ID"],
      correct: sameTerminal ? String(n) : EMPTY,
      explain: sameTerminal
        ? `export stores the value ${n}, and echo $NAME prints a variable's value.`
        : "export only lasts for the terminal where you typed it. A new terminal starts fresh, so the variable is empty (unless you put the export line in ~/.bashrc).",
    };
  },
});

T.push({
  id: "A-ENV-SOURCE", topic: "env", type: "mcq",
  make(r) {
    const cmd = pick(r, ["ros2 topic list", "ros2 node list", "ros2 run demo_nodes_py talker", "ros2 --help"]);
    return {
      prompt: `You opened a **new** terminal and typed \`${cmd}\`. It says "ros2: command not found", even though ROS 2 Jazzy is installed. What is the fix?`,
      options: ["source /opt/ros/jazzy/setup.bash", `sudo ${cmd}`, "chmod +x ros2", "sudo apt update"],
      correct: "source /opt/ros/jazzy/setup.bash",
      explain: "source loads ROS 2's settings into the current terminal. Each new terminal needs it (or add the line to ~/.bashrc).",
    };
  },
});

T.push({
  id: "A-ENV-APPEND", topic: "env", type: "mcq",
  make(r) {
    const w = pick(r, WORKSPACES);
    const file = pick(r, ["/opt/ros/jazzy/setup.bash", `~/${w}/install/setup.bash`]);
    const good = `echo "source ${file}" >> ~/.bashrc`;
    return {
      prompt: `You want every new terminal to run \`source ${file}\` automatically. Which command adds that line to the **end** of \`~/.bashrc\` without deleting what is already there?`,
      options: [good, `echo "source ${file}" > ~/.bashrc`, `source ~/.bashrc >> ${file}`, `cat ~/.bashrc > ${file}`],
      correct: good,
      explain: ">> adds to the end of a file. A single > replaces the whole file, which would erase your existing ~/.bashrc settings.",
    };
  },
});

T.push({
  id: "A-ENV-GREP", topic: "env", type: "fill",
  make(r) {
    const kw = pick(r, ["ROS", "DOMAIN", "DISTRO"]);
    return {
      prompt: `Type one command that shows **only** the environment variables whose line contains the word \`${kw}\`.`,
      correct: `printenv | grep ${kw}`,
      accept: [`printenv | grep ${kw}`, `env | grep ${kw}`],
      explain: `printenv lists all variables. The | (pipe) sends that list into grep ${kw}, which keeps only matching lines.`,
    };
  },
});

// ======================= topic: run (running programs, reading output) =======================
T.push({
  id: "A-RUN-STOP", topic: "lab", type: "mcq",
  make(r) {
    const run = pick(r, ["ros2 run demo_nodes_py talker", "ros2 run turtlesim turtlesim_node", "ros2 topic echo /chatter", "ros2 run demo_nodes_cpp listener"]);
    return {
      prompt: `You started \`${run}\`. It keeps printing messages forever. How do you stop it?`,
      options: ["Press Ctrl+C in that terminal", "Press Ctrl+S", "Type exit while it is printing", "Press Ctrl+V"],
      correct: "Press Ctrl+C in that terminal",
      explain: "Ctrl+C stops (interrupts) the running program in that terminal. It is the most used shortcut in ROS 2.",
    };
  },
});

T.push({
  id: "A-RUN-PIPE", topic: "lab", type: "fill",
  make(r) {
    const kw = pick(r, ["cmd_vel", "scan", "odom", "camera", "battery", "chatter"]);
    return {
      prompt: `Type one command that lists the ROS 2 topics but shows **only** those whose names contain \`${kw}\`.`,
      correct: `ros2 topic list | grep ${kw}`,
      accept: [`ros2 topic list | grep ${kw}`],
      explain: `ros2 topic list prints all topics; | grep ${kw} filters them.`,
    };
  },
});

T.push({
  id: "A-RUN-PY", topic: "py1", type: "fill",
  make(r) {
    const f = pick(r, PYFILES);
    return {
      prompt: `The file \`${f}\` is in your current folder. Type the command that runs it with **Python 3**.`,
      correct: `python3 ${f}`,
      accept: [`python3 ${f}`, `python3 ./${f}`],
      explain: "python3 followed by the file name runs a Python program.",
    };
  },
});

T.push({
  id: "A-RUN-DOT", topic: "perm", type: "mcq",
  make(r) {
    const f = pick(r, PYFILES);
    return {
      prompt: `\`${f}\` is executable (it has x) and is in your current folder. Which command runs it **directly**?`,
      options: [`./${f}`, `${f}`, `run ${f}`, `cd ${f}`],
      correct: `./${f}`,
      explain: "./ means \"this folder\". Linux does not look in the current folder by itself, so typing just the name says \"command not found\".",
    };
  },
});

T.push({
  id: "A-RUN-NOTFOUND", topic: "lab", type: "mcq",
  make(r) {
    const pkg = pick(r, ["turtlesim", "demo_nodes_py", "teleop_twist_keyboard", "demo_nodes_cpp"]);
    return {
      prompt: `\`ros2 run ${pkg} …\` prints "Package '${pkg}' not found". What is the most likely reason?`,
      options: [
        "The package is not installed, or this terminal was not sourced",
        "The robot is switched off",
        "The file needs chmod +x first",
        "ros2 must be typed in capital letters",
      ],
      correct: "The package is not installed, or this terminal was not sourced",
      explain: "ROS 2 can only find packages that are installed and loaded into the terminal with source.",
    };
  },
});

module.exports = T;
