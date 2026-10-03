// From a .msg file to Python and C++ code: what colcon build + rosidl generate, and what breaks it.
import { frame, box, packet, edge, pulse, el } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 260 });
  const S = f.stage;
  let bug = "none", F, G, outs;
  const src = () => ["# BatteryStatus.msg", "string robot_name", bug === "name" ? "float32 Voltage" : "float32 voltage", "float32 percentage", "bool is_charging"];
  const file = el("pre", { class: "anim-file" });
  f.extra.append(file);
  function draw() {
    file.textContent = src().join("\n") + (bug === "cmake" ? "\n\n# CMakeLists.txt: rosidl_generate_interfaces(...) line is MISSING" : "\n\n# CMakeLists.txt: rosidl_generate_interfaces(${PROJECT_NAME} \"msg/BatteryStatus.msg\")");
    F = box(20, 90, 150, 70, "BatteryStatus.msg", { sub: "4 fields" });
    G = box(230, 90, 160, 70, "rosidl generator", { cls: "pub", sub: "runs in colcon build" });
    outs = [box(450, 10, 175, 60, "Python class", { cls: "off", sub: "from …msg import BatteryStatus" }),
      box(450, 95, 175, 60, "C++ header", { cls: "off", sub: "battery_status.hpp" }),
      box(450, 180, 175, 60, "DDS type", { cls: "off", sub: "for the network" })];
    S.replaceChildren(F, G, ...outs);
  }
  async function build(g) {
    draw(); f.clearLog(); f.logLine("$ colcon build --packages-select my_robot_interfaces");
    if (bug === "cmake") {
      f.logLine("Finished <<< my_robot_interfaces [2.1s]"); f.logLine("$ ros2 interface show my_robot_interfaces/msg/BatteryStatus"); f.logLine("Unknown package 'my_robot_interfaces'", "warn");
      f.say("The build \"works\", but **nothing is generated**: CMake was never told to run rosidl. The `.msg` file just sits there.", "no"); return;
    }
    const p = packet(".msg"); S.append(p); await f.fly(p, edge(F, "r"), edge(G, "l"), 800, g); p.remove(); pulse(G);
    if (bug === "name") {
      G.classList.add("bad"); G.setSub("ERROR");
      f.logLine("rosidl_adapter.parser.InvalidResourceName: 'Voltage' is an invalid field name.", "warn");
      f.say("Build **fails**: field names must be **lowercase with underscores** (snake_case). `Voltage` → `voltage`.", "no"); return;
    }
    f.say("rosidl reads the 4 fields and **writes code for you** in every language.");
    for (const o of outs) { const q = packet("code"); S.append(q); await f.fly(q, edge(G, "r"), edge(o, "l"), 600, g); q.remove(); o.classList.remove("off"); pulse(o); }
    f.logLine("Finished <<< my_robot_interfaces [6.3s]", "ok");
    f.say("Done! Python imports `BatteryStatus`, C++ includes `battery_status.hpp` (CamelCase becomes snake_case), and DDS can send it. **You only wrote 4 lines.**", "ok");
  }
  f.button("colcon build", () => f.play(build), "");
  f.button("Break: capital field name", () => { f.restart(); bug = "name"; draw(); f.say("A field is now called **Voltage**. Press **colcon build**."); });
  f.button("Break: forget rosidl in CMake", () => { f.restart(); bug = "cmake"; draw(); f.say("The `rosidl_generate_interfaces` line is missing. Press **colcon build**."); });
  f.button("Fix everything", () => { f.restart(); bug = "none"; draw(); f.say("All correct again."); });
  draw(); f.say("You write a tiny `.msg` file. Press **colcon build** to see what ROS 2 makes from it.");
}
