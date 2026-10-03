// The history of ROS as a train journey, 2007 to 2026.
import { frame, label, packet, svg } from "./frame.js";

const STOPS = [
  [2007, "Willow Garage", "A robotics lab in California, **Willow Garage**, takes over a Stanford robot-software project. The first ROS code is written in **November 2007**."],
  [2010, "Box Turtle", "**ROS 1.0** and the first distribution, **Box Turtle** (March 2010). Willow Garage gives **PR2** robots to 11 research groups, who share their code."],
  [2012, "OSRF", "The non-profit **Open Source Robotics Foundation (OSRF)** is founded to look after ROS and the Gazebo simulator."],
  [2014, "ROS 2 plan", "At ROSCon 2014 the team presents the **next generation of ROS, built on DDS**: the start of ROS 2."],
  [2017, "Ardent", "**Ardent Apalone** (December 2017), the first official ROS 2 release. ROS 1 and ROS 2 now run side by side."],
  [2022, "Intrinsic", "Intrinsic (an Alphabet company) buys OSRF's **commercial** arm. ROS itself stays **free and open source**, looked after by the non-profit OSRF."],
  [2024, "OSRA + Jazzy", "OSRF launches the **Open Source Robotics Alliance (OSRA)** with industry members. **Jazzy Jalisco** (LTS, May 2024) is the version in this course."],
  [2025, "ROS 1 ends", "**Noetic**, the last ROS 1, reaches end of life on **31 May 2025**. From now on, everything new is ROS 2."],
  [2026, "Lyrical", "**Lyrical Luth** (May 2026), a new LTS for Ubuntu 26.04. Jazzy stays supported until **May 2029**."],
];

export function mount(container, meta) {
  const f = frame(container, meta, { height: 230 });
  const S = f.stage;
  const xs = STOPS.map((_, i) => 40 + i * 70);
  let at = 0, train;
  function draw() {
    const kids = [
      svg("line", { x1: 30, y1: 120, x2: xs[7] + 8, y2: 120, class: "an-rail r1" }),
      svg("line", { x1: xs[4], y1: 140, x2: 615, y2: 140, class: "an-rail r2" }),
      label(30, 108, "ROS 1", "an-lbl l"), label(xs[4] + 30, 160, "ROS 2", "an-lbl l"),
      svg("rect", { x: xs[7] + 6, y: 110, width: 8, height: 20, class: "an-stopblock" }),
    ];
    STOPS.forEach(([y, name], i) => {
      kids.push(svg("circle", { cx: xs[i], cy: 120, r: 7, class: `an-stn ${i === at ? "now" : ""}` }),
        label(xs[i], 190, String(y), "an-lbl c"), label(xs[i], 208, name, "an-lbl small"));
    });
    train = packet("🚂 Chiku"); train.setAttribute("transform", `translate(${xs[at]} 82)`);
    S.replaceChildren(...kids, train);
  }
  function show() { f.say(`**${STOPS[at][0]}:** ${STOPS[at][2]}`); }
  async function go(g, to) {
    const from = at; at = to;
    await f.fly(train, [xs[from], 82], [xs[to], 82], 700, g);
    draw(); show();
  }
  f.button("Next stop ▶", () => f.play((g) => go(g, Math.min(STOPS.length - 1, at + 1))), "");
  f.button("◀ Back", () => f.play((g) => go(g, Math.max(0, at - 1))));
  f.button("Back to 2007", () => { f.restart(); at = 0; draw(); show(); });
  draw(); show();
}
