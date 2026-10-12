// Workspaces: src -> colcon build -> build/ install/ log/ -> source install/setup.bash (overlay).
import { frame, svg, pulse } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 320 });
  const S = f.stage;
  let st;
  const rowsG = svg("g", { transform: "translate(20 20)" });
  const stack = svg("g", { transform: "translate(380 20)" });
  S.append(svg("text", { x: 140, y: 14, class: "an-lbl", text: "~/ros2_ws" }), rowsG, svg("text", { x: 500, y: 14, class: "an-lbl", text: "what this terminal can see" }), stack);

  function paint() {
    const rows = [["📁 src/", 0, true], ["📁 my_robot/", 1, true], ["📄 package.xml", 2, true], ["📄 setup.py", 2, true], ["📁 my_robot/  (your .py nodes)", 2, true],
      ["📁 build/", 0, st.built], ["📁 install/", 0, st.built], ["📄 setup.bash", 1, st.built], ["📁 log/", 0, st.built]];
    rowsG.replaceChildren(...rows.filter((r) => r[2]).map(([t, d], i) => svg("text", { x: 10 + d * 22, y: 20 + i * 30, class: `an-tree${/build|install|log|setup.bash/.test(t) ? " new" : ""}`, text: t })));
    const layers = [["Ubuntu 24.04", true, "l0"], ["ROS 2 Jazzy  (underlay)", st.ros, "l1"], ["my_robot  (overlay)", st.overlay, "l2"]];
    stack.replaceChildren(...layers.map(([t, on, c], i) => svg("g", { class: `an-layer ${c}${on ? "" : " off"}`, transform: `translate(0 ${200 - i * 64})` },
      svg("rect", { width: 240, height: 54, rx: 10 }), svg("text", { x: 120, y: 26, text: on ? t : `(not loaded) ${t.split("  ")[0]}` }), svg("text", { x: 120, y: 44, class: "an-lbl", text: i === 1 ? "/opt/ros/jazzy" : i === 2 ? "~/ros2_ws/install" : "" }))));
  }
  function reset() {
    f.restart(); f.clearLog(); st = { ros: false, built: false, overlay: false }; paint();
    f.say("A **workspace** is a folder for your own packages. Your code lives in **src/**. Follow the steps from left to right.");
  }
  const cmds = [
    ["source /opt/ros/jazzy/setup.bash", () => { st.ros = true; f.logLine("$ source /opt/ros/jazzy/setup.bash"); f.say("Step 1: load ROS 2 itself, the **underlay**. Now `ros2` and `colcon` work in this terminal."); }],
    ["colcon build", () => {
      f.logLine("$ cd ~/ros2_ws && colcon build");
      if (!st.ros) { f.logLine("colcon: command not found", "err"); f.say("colcon is a ROS 2 tool, so load ROS 2 first (step 1).", "no"); return; }
      st.built = true; f.logLine("Starting >>> my_robot"); f.logLine("Finished <<< my_robot [1.12s]", "ok"); f.logLine("Summary: 1 package finished [1.30s]", "ok");
      f.say("Step 2: **colcon build** (run from the workspace folder, not from src!) reads src/ and creates three folders: **build/** (scratch work), **install/** (the finished result) and **log/**.");
    }],
    ["source install/setup.bash", () => {
      f.logLine("$ source install/setup.bash");
      if (!st.built) { f.logLine("bash: install/setup.bash: No such file or directory", "err"); f.say("There is no install/ folder yet: build first.", "no"); return; }
      st.overlay = true; f.say("Step 3: load your workspace **on top of** ROS 2. This top layer is called an **overlay**. Do it in every new terminal (or add it to ~/.bashrc).");
    }],
    ["ros2 run my_robot patrol", () => {
      f.logLine("$ ros2 run my_robot patrol");
      if (!st.ros) { f.logLine("ros2: command not found", "err"); f.say("ROS 2 is not loaded in this terminal.", "no"); return; }
      if (!st.overlay) { f.logLine("Package 'my_robot' not found", "err"); f.say("ROS 2 can see its own packages, but not yours: you forgot to **source install/setup.bash**. This is the most common beginner error!", "no"); return; }
      f.logLine("[INFO] [patrol]: Chiku is patrolling!", "ok"); f.say("It runs! ROS 2 found **my_robot** because the overlay is loaded. Remember: **build, source, run**.", "ok");
    }],
  ];
  cmds.forEach(([c, fn], i) => f.button(`${i + 1}. ${c}`, () => { fn(); paint(); pulse(stack); }, i === 0 ? "" : "btn-white"));
  f.button("Open a new terminal", () => { st.ros = false; st.overlay = false; paint(); f.logLine("# (new terminal: nothing is loaded)", "warn"); f.say("A new terminal **forgets** everything you sourced. The files in install/ are still there, but you must source again (or put both source lines in ~/.bashrc)."); });
  f.button("Reset", reset);
  reset();
}
