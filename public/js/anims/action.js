// Actions: goal -> accepted -> feedback stream -> result; can be cancelled.
import { frame, box, wire, packet, label, edge, pulse, svg } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 330 });
  const S = f.stage;
  let running = false, cancel = false;
  const client = box(20, 40, 160, 70, "Chiku's brain", { cls: "pub", sub: "action client" });
  const server = box(460, 40, 160, 70, "Navigator", { cls: "sub", sub: "action server" });
  // little map: robot drives from dock to kitchen
  const map = svg("g", { class: "an-map", transform: "translate(60 170)" },
    svg("rect", { width: 520, height: 120, rx: 12 }),
    svg("text", { x: 40, y: 112, class: "an-s", text: "dock" }), svg("text", { x: 470, y: 112, class: "an-s", text: "kitchen" }),
    svg("circle", { cx: 470, cy: 60, r: 18, class: "an-goal" }));
  const robot = svg("g", { class: "an-robot" }, svg("rect", { x: -16, y: -16, width: 32, height: 32, rx: 8 }), svg("circle", { cx: 8, cy: 0, r: 4 }));
  const bar = svg("rect", { x: 60, y: 150, width: 0, height: 8, rx: 4, class: "an-bar" });

  function place(k) { robot.setAttribute("transform", `translate(${100 + k * 430} 230)`); bar.setAttribute("width", 520 * k); }
  function build() {
    f.restart(); running = false; cancel = false; f.clearLog();
    S.replaceChildren(wire(edge(client, "r"), edge(server, "l"), "solid"), label(320, 30, "/navigate_to_pose", "an-lbl c"),
      svg("rect", { x: 60, y: 150, width: 520, height: 8, rx: 4, class: "an-bar-bg" }), bar, map, robot, client, server);
    place(0);
    f.say("An **action** is a long job: you send a **goal**, get **feedback** while it runs, then one **result**. You can also **cancel**. Press **Send goal: go to the kitchen**.");
  }
  async function go(g) {
    if (running) return;
    running = true; cancel = false; place(0);
    f.logLine('$ ros2 action send_goal /navigate_to_pose ... "{goal: kitchen}" --feedback');
    const goal = packet("goal: kitchen", "req"); S.append(goal);
    await f.fly(goal, [edge(client, "r")[0] + 40, 64], [edge(server, "l")[0] - 40, 64], 900, g); goal.remove(); pulse(server);
    f.logLine("Goal accepted with ID: 3f9a1c0e7b2d4e88a1f05c6d2e7b9a14", "ok");
    f.say("1. **Goal** sent and **accepted**. The client does **not** freeze: it can do other work while the robot drives.");
    const total = 4.0;
    for (let i = 1; i <= 8; i++) {
      await f.wait(520, g);
      if (cancel) {
        f.logLine("Goal canceled.", "warn"); f.logLine("Goal finished with status: CANCELED", "warn");
        f.say("You **cancelled** the goal. The server stopped the robot and reported **CANCELED**. A service cannot do this: once asked, you just wait.", "no");
        running = false; return;
      }
      place(i / 8);
      const left = (total * (1 - i / 8)).toFixed(1);
      const fb = packet(`${left} m left`, "fb"); S.append(fb);
      f.fly(fb, [edge(server, "l")[0] - 40, 92], [edge(client, "r")[0] + 40, 92], 500, g).then((n) => n.remove(), () => {});
      f.logLine(`Feedback:\n    distance_remaining: ${left}`);
      if (i === 2) f.say("2. **Feedback** keeps coming: \"3.0 m left\", \"2.5 m left\"... like a pizza-tracking app.");
    }
    await f.wait(500, g);
    const res = packet("result: arrived", "res"); S.append(res);
    await f.fly(res, [edge(server, "l")[0] - 40, 92], [edge(client, "r")[0] + 40, 92], 800, g); res.remove(); pulse(client);
    f.logLine("Result:\n    reached: True", "ok"); f.logLine("Goal finished with status: SUCCEEDED", "ok");
    f.say("3. One **result** at the end: **SUCCEEDED**. Use actions for jobs that take time: driving somewhere, moving an arm, docking to charge.", "ok");
    running = false;
  }
  f.button("Send goal: go to the kitchen", () => f.play(go), "");
  f.button("Cancel goal", () => { if (running) cancel = true; else f.say("Send a goal first, then cancel it halfway."); });
  f.button("Reset", build);
  build();
}
