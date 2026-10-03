// Where ROS 2 sits: build the software stack of a robot one layer at a time.
import { frame, svg, pulse } from "./frame.js";

const LAYERS = [
  ["Hardware", "wheels, motors, lidar, camera, battery", "Chiku's body. Without software it cannot do anything."],
  ["Ubuntu 24.04 (Linux)", "the operating system", "Ubuntu runs programs, stores files and talks to the hardware. This is why Week 1 started with the terminal."],
  ["DDS middleware", "the postal service", "DDS delivers messages between programs, even across Wi-Fi to another computer. You never write DDS code: ROS 2 uses it for you."],
  ["ROS 2 (rclpy / rclcpp)", "nodes, topics, services, actions", "ROS 2 gives you nodes and the three ways to talk. rclpy is the Python library, rclcpp the C++ one. That is why Week 2 taught classes in both."],
  ["Ready-made packages", "Nav2, SLAM, MoveIt, ros2_control", "Thousands of free packages: navigation, map making, arm planning. You reuse them instead of writing everything yourself."],
  ["Your nodes", "patrol, obstacle_stop, deliver", "Your code sits on top and only describes what is special about YOUR robot. Weeks 4 and 5 show how; in Weeks 6 and 7 you write such nodes yourself, in Python and C++."],
];

export function mount(container, meta) {
  const f = frame(container, meta, { height: 330 });
  const S = f.stage;
  let shown = 0;
  function paint() {
    S.replaceChildren(...LAYERS.slice(0, shown).map(([t, s], i) => {
      const g = svg("g", { class: `an-layer l${i % 4}${i === LAYERS.length - 1 ? " top" : ""}`, transform: `translate(${60 + i * 6} ${276 - i * 52})` },
        svg("rect", { width: 520 - i * 12, height: 46, rx: 10 }), svg("text", { x: 16, y: 29, class: "an-t left", text: t }), svg("text", { x: 504 - i * 12, y: 29, class: "an-s right", text: s }));
      if (i === shown - 1) pulse(g);
      return g;
    }));
  }
  f.button("Add the next layer", () => {
    if (shown >= LAYERS.length) { f.say("That is the whole stack. **ROS 2 is not an operating system**: it is a set of libraries and tools that runs on Ubuntu and connects your programs.", "ok"); return; }
    shown++; paint(); f.say(`**${LAYERS[shown - 1][0]}**: ${LAYERS[shown - 1][2]}`);
  }, "");
  f.button("Show all", () => { shown = LAYERS.length; paint(); f.say("From the bottom up: hardware, Ubuntu, DDS, ROS 2, ready-made packages, and **your nodes** on top."); });
  f.button("Reset", () => { shown = 0; paint(); f.say("A robot's software is built in **layers**, like a building. Press **Add the next layer** to build it from the ground up."); });
  f.say("A robot's software is built in **layers**, like a building. Press **Add the next layer** to build it from the ground up.");
}
