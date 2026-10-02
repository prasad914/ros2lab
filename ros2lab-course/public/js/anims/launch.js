// Launch files: start many nodes, with their settings, from one command.
import { frame, svg, box, pulse } from "./frame.js";

const NODES = [
  { name: "lidar_driver", cmd: "ros2 run chiku_bringup lidar_driver" },
  { name: "motor_driver", cmd: "ros2 run chiku_bringup motor_driver" },
  { name: "obstacle_stop", cmd: "ros2 run chiku_brain obstacle_stop --ros-args -p stop_distance:=0.4" },
  { name: "battery_monitor", cmd: "ros2 run chiku_brain battery_monitor" },
];

export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage;
  let busy = false;
  function build() {
    f.restart(); busy = false; f.clearLog();
    S.replaceChildren(svg("text", { x: 160, y: 24, class: "an-lbl", text: "the hard way: one terminal per node" }),
      svg("text", { x: 480, y: 24, class: "an-lbl", text: "running nodes" }));
    f.say("Chiku needs **4 nodes** running together. Try starting them **the hard way**, then **with a launch file**.");
  }
  function term(i, text) {
    const g = svg("g", { class: "an-term", transform: `translate(${14 + (i % 2) * 150} ${40 + Math.floor(i / 2) * 120})` },
      svg("rect", { width: 140, height: 104, rx: 8 }), svg("rect", { width: 140, height: 16, rx: 8, class: "bar" }),
      svg("text", { x: 8, y: 34, class: "mono", text: "$ ros2 run …" }), svg("text", { x: 8, y: 54, class: "mono dim", text: text }));
    S.append(g); return g;
  }
  function nodeBox(i) { const b = box(380, 40 + i * 58, 200, 46, NODES[i].name, { cls: "sub" }); S.append(b); pulse(b); return b; }
  async function hard(g) {
    if (busy) return; build(); busy = true;
    for (let i = 0; i < NODES.length; i++) {
      f.say(`Terminal ${i + 1}: open a new terminal, **source** ROS 2, type \`${NODES[i].cmd}\`. ${i === 2 ? "Do not forget its `stop_distance` setting!" : ""}`);
      f.logLine(`# terminal ${i + 1}`); f.logLine(`$ ${NODES[i].cmd}`);
      term(i, NODES[i].name); await f.wait(1300, g); nodeBox(i); await f.wait(300, g);
    }
    f.say("It works, but: **4 terminals**, 4 commands to type correctly, every single time. One typo and the robot misbehaves. There must be a better way...", "no");
    busy = false;
  }
  async function easy(g) {
    if (busy) return; build(); busy = true;
    const file = svg("g", { class: "an-file", transform: "translate(30 60)" }, svg("rect", { width: 260, height: 190, rx: 10 }),
      svg("text", { x: 12, y: 24, class: "mono b", text: "chiku.launch.py" }),
      ...NODES.map((n, i) => svg("text", { x: 12, y: 54 + i * 30, class: "mono", text: `Node(executable='${n.name}')` })));
    S.append(file);
    f.logLine("$ ros2 launch chiku_bringup chiku.launch.py");
    f.say("One command: `ros2 launch chiku_bringup chiku.launch.py`. The launch file lists every node and its settings.");
    await f.wait(900, g);
    for (let i = 0; i < NODES.length; i++) { nodeBox(i); f.logLine(`[INFO] [${NODES[i].name}-${i + 1}]: process started with pid [${4200 + i * 9}]`, "ok"); await f.wait(220, g); }
    f.say("**All four nodes** started together, with the right settings, from **one terminal**. Press **Ctrl+C** once and they all stop together too. Real robots (TurtleBot3, Nav2, MoveIt) are always started with launch files.", "ok");
    busy = false;
  }
  f.button("Start them the hard way", () => f.play(hard), "");
  f.button("Start with a launch file", () => f.play(easy), "");
  f.button("Reset", build);
  build();
}
