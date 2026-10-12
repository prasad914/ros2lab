// Source It! Each terminal starts empty; `source` loads toolboxes into that terminal only; ~/.bashrc runs in every new one.
// Drawn as an Ubuntu terminal (aubergine, tabs in the header bar) beside a stack of layers (Ubuntu at the
// bottom, the ROS 2 underlay, your workspace overlay on top) and the end of ~/.bashrc on a paper scroll.
import { el } from "../dom.js";
import { shell, useCss } from "./shell.js";

useCss("source");
const RC = ["# ~/.bashrc: executed by bash(1) for non-login shells.", "…", "alias ll='ls -alF'", "alias la='ls -A'", "if ! shopt -oq posix; then", "  . /usr/share/bash-completion/bash_completion", "fi"];

const JAZZY = "source /opt/ros/jazzy/setup.bash";
const CMDS = [
  JAZZY,
  "colcon build",
  "source install/setup.bash",
  "ros2 run demo_nodes_py talker",
  "ros2 run my_robot chiku_node",
  `echo "${JAZZY}" >> ~/.bashrc`,
];

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: "Complete the three missions by running commands in the terminals. Every terminal is a fresh start, just like on Ubuntu." }, opts);
  let st;

  const missions = el("ol", { class: "pz-missions" });
  const tabs = el("div", { class: "so-tabs", role: "tablist" });
  const newTab = el("button", { class: "so-new", type: "button", text: "+ New terminal" });
  const screen = el("div", { class: "so-screen", "aria-live": "polite" });
  const belt = el("div", { class: "so-belt", "aria-label": "Toolboxes loaded in this terminal" });
  const rc = el("pre", { class: "so-rc", "aria-label": "The last lines of ~/.bashrc" });
  const chips = el("div", { class: "so-chips" });
  g.stage.append(missions, el("div", { class: "so-wrap" },
    el("div", { class: "so-term" }, el("div", { class: "so-bar" }, tabs, newTab), screen),
    el("div", { class: "so-side" }, el("div", { class: "rd-label", text: "Loaded in this terminal" }), belt,
      el("div", { class: "so-scroll" }, el("div", { class: "rd-label so-rc-name", text: "~/.bashrc" }), rc))),
    el("div", { class: "rd-label", text: "Tap a command to run it in the active terminal" }), chips);

  const MISSIONS = [
    ["talker", "Run the ROS 2 demo talker in Terminal 1."],
    ["mine", "Build your workspace and run your own node: my_robot chiku_node."],
    ["auto", "Make ROS 2 load by itself in every new terminal, then run the talker in a new terminal without typing source."],
  ];

  const term = () => st.terms[st.active];
  const log = (cls, text) => { term().log.push([cls, text]); };

  function run(cmd) {
    const t = term();
    log("cmd", cmd);
    if (cmd === JAZZY) { t.layers.add("jazzy"); log("", ""); }
    else if (cmd === "colcon build") {
      if (!t.layers.has("jazzy")) log("err", 'Starting >>> my_robot\n--- stderr: my_robot\nCMake Error at CMakeLists.txt:9 (find_package):\n  By not providing "Findament_cmake.cmake" in CMAKE_MODULE_PATH this project\n  has asked CMake to find a package configuration file provided by\n  "ament_cmake", but CMake did not find one.\n---\nFailed   <<< my_robot [0.41s, exited with code 1]\n\nSummary: 0 packages finished [0.62s]\n  1 package failed: my_robot\n(CMake cannot find ament_cmake: ROS 2 is not sourced in this terminal.)');
      else { st.built = true; log("out", "Starting >>> my_robot\nFinished <<< my_robot [1.21s]\n\nSummary: 1 package finished [1.45s]"); }
    } else if (cmd === "source install/setup.bash") {
      if (!st.built) log("err", "bash: install/setup.bash: No such file or directory\n(The install folder appears only after colcon build.)");
      else if (!t.layers.has("jazzy")) { t.layers.add("ws"); t.layers.add("jazzy"); log("out", "(Your workspace's setup also loads ROS 2 underneath it.)"); }
      else t.layers.add("ws");
    } else if (cmd.startsWith("ros2 run demo_nodes_py")) {
      if (!t.layers.has("jazzy")) log("err", "ros2: command not found");
      else {
        { const t0 = Date.now() / 1000; log("out", `[INFO] [${t0.toFixed(9)}] [talker]: Publishing: "Hello World: 1"\n[INFO] [${(t0 + 1).toFixed(9)}] [talker]: Publishing: "Hello World: 2"`); }
        if (st.active === 0) st.done.talker = true;
        if (st.active > 0 && t.fromRc) st.done.auto = true;
      }
    } else if (cmd.startsWith("ros2 run my_robot")) {
      if (!t.layers.has("jazzy")) log("err", "ros2: command not found");
      else if (!t.layers.has("ws")) log("err", "Package 'my_robot' not found\n(ROS 2 is loaded, but your own workspace is not. Which file loads it?)");
      else { log("out", `[INFO] [${(Date.now() / 1000).toFixed(9)}] [chiku_node]: Chiku is awake and ready to deliver!`); st.done.mine = true; }
    } else if (cmd.startsWith("echo")) {
      if (st.rc) log("out", "(That line is already in ~/.bashrc. Adding it twice is harmless but untidy.)");
      else { st.rc = true; log("out", "(Added to ~/.bashrc. It runs in every NEW terminal, not this one.)"); }
    }
    paint();
  }

  function addTerm() {
    if (st.terms.length >= 4) { g.say("Four terminals is plenty for this game.", "info"); return; }
    const t = { log: [], layers: new Set(), fromRc: false };
    if (st.rc) { t.layers.add("jazzy"); t.fromRc = true; t.log.push(["out", "(~/.bashrc ran: ROS 2 Jazzy loaded automatically)"]); }
    else t.log.push(["out", "(A brand-new terminal. Nothing from the other terminals is loaded here.)"]);
    st.terms.push(t); st.active = st.terms.length - 1;
    paint();
  }

  function paint() {
    tabs.replaceChildren(...st.terms.map((t, i) => el("button", { type: "button", role: "tab", class: "so-tab", "aria-selected": String(i === st.active), text: `Terminal ${i + 1}`, onclick: () => { st.active = i; paint(); } })));
    const t = term();
    screen.replaceChildren(...t.log.flatMap(([cls, text]) => cls === "cmd"
      ? [el("div", { class: "so-line" }, el("span", { class: "so-pr" }, el("span", { class: "so-u", text: "student@ros2lab" }), ":", el("span", { class: "so-p", text: "~/ros2_ws" }), "$ "), text)]
      : text ? [el("div", { class: `so-line ${cls}`, text })] : []));
    screen.scrollTop = screen.scrollHeight;
    belt.replaceChildren(
      el("div", { class: "so-layer on base" }, el("b", { text: "Ubuntu" }), el("span", { text: "ls, cd, apt… always there" })),
      el("div", { class: `so-layer jazzy${t.layers.has("jazzy") ? " on" : ""}` }, el("b", { text: "ROS 2 Jazzy" }), el("span", { text: "underlay: ros2, demo nodes" })),
      el("div", { class: `so-layer ws${t.layers.has("ws") ? " on" : ""}` }, el("b", { text: "~/ros2_ws" }), el("span", { text: "overlay: your own packages" })));
    rc.replaceChildren(...RC.map((l) => el("span", { class: "so-rcl", text: l })), st.rc ? el("span", { class: "so-rcl new", text: JAZZY }) : el("span", { class: "so-rcl empty", text: " " }));
    missions.replaceChildren(...MISSIONS.map(([k, txt]) => el("li", { class: st.done[k] ? "done" : "" }, el("span", { class: "box", text: st.done[k] ? "✓" : "" }), el("span", { text: txt }))));
    if (MISSIONS.every(([k]) => st.done[k]) && !st.won) {
      st.won = true;
      g.win("`source` loads tools into **one** terminal. Your workspace is an **overlay** on top of ROS 2, and `~/.bashrc` runs in every new terminal so you never forget the underlay.",
        `${JAZZY}\ncd ~/ros2_ws && colcon build\nsource install/setup.bash\necho "${JAZZY}" >> ~/.bashrc`);
    }
  }

  chips.replaceChildren(...CMDS.map((c) => el("button", { type: "button", class: "so-chip", onclick: () => run(c) }, el("span", { class: "so-dollar", "aria-hidden": "true", text: "$" }), c)));
  newTab.addEventListener("click", addTerm);
  function start() { st = { terms: [], active: 0, built: false, rc: false, done: {}, won: false }; addTerm(); g.clear(); }
  g.onRestart(start);
  start();
}
