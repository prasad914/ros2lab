// ROS 1 needed a master (roscore) to find each other; ROS 2 discovers automatically.
import { frame, box, wire, packet, label, edge, pulse, svg } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 280 });
  const S = f.stage;
  let mode = "ros1", masterOn = true, A, B, C, M;
  function draw() {
    A = box(30, 30, 150, 60, "camera", { cls: "pub", sub: "publishes /image" });
    B = box(460, 30, 150, 60, "viewer", { cls: "sub", sub: "wants /image" });
    C = box(460, 190, 150, 60, "planner", { cls: "sub", sub: "wants /image" });
    const kids = [];
    if (mode === "ros1") {
      M = box(245, 160, 150, 64, "roscore", { cls: masterOn ? "" : "off", sub: masterOn ? "the master" : "(stopped)" });
      kids.push(wire(edge(A, "b"), edge(M, "l"), "solid"), wire(edge(B, "b"), edge(M, "r"), "solid"), M);
    }
    S.replaceChildren(...kids, A, B, C);
  }
  async function fly(g, text, a, b, cls = "") { const p = packet(text, cls); S.append(p); await f.fly(p, a, b, 800, g); p.remove(); }
  async function ros1(g) {
    draw(); f.clearLog();
    if (!masterOn) {
      f.say("The master is stopped. The planner asks **where is /image?**, but nobody can answer. In ROS 1, **no master = no new connections**.", "no");
      await fly(g, "where is /image?", edge(C, "l"), [330, 230], "req"); C.setSub("can't find anyone ?"); return;
    }
    f.say("1. The camera tells the master: **I publish /image**.");
    await fly(g, "I publish /image", edge(A, "b"), M.center, "req"); pulse(M);
    f.say("2. The viewer asks the master: **who publishes /image?** The master replies with the camera's address.");
    await fly(g, "who has /image?", edge(B, "b"), M.center, "req"); await fly(g, "camera @ 10.0.0.5", M.center, edge(B, "b"), "res");
    f.say("3. Now the data goes **directly** from camera to viewer. The master only helped them **find** each other.", "ok");
    for (let i = 1; i <= 2; i++) await fly(g, `image ${i}`, edge(A, "r"), edge(B, "l"));
  }
  async function ros2(g) {
    draw(); f.say("ROS 2 has **no master**. Every node announces itself on the network (\"hello, I publish /image\").");
    const rings = [A, B, C].map((n) => svg("circle", { cx: n.center[0], cy: n.center[1], r: 10, class: "an-ripple" }));
    S.prepend(...rings); await f.wait(1300, g);
    rings.forEach((r) => r.remove());
    S.prepend(wire(edge(A, "r"), edge(B, "l"), "solid"), wire(edge(A, "b"), edge(C, "l"), "solid"));
    f.say("Matching nodes connect **automatically**: the viewer and the planner both found the camera. Data flows directly.", "ok");
    for (let i = 1; i <= 2; i++) { await Promise.all([fly(g, `image ${i}`, edge(A, "r"), edge(B, "l")), fly(g, `image ${i}`, edge(A, "b"), edge(C, "l"))]); }
    B.classList.add("off"); B.setSub("(unplugged)");
    f.say("Unplug the viewer: the others **keep working**. There is no single computer that everything depends on.", "ok");
    await fly(g, "image 3", edge(A, "b"), edge(C, "l"));
  }
  f.button("ROS 1: with roscore", () => { f.restart(); mode = "ros1"; f.play(ros1); }, "");
  f.button("Stop roscore", () => { f.restart(); mode = "ros1"; masterOn = !masterOn; f.play(ros1); });
  f.button("ROS 2: no master", () => { f.restart(); mode = "ros2"; f.play(ros2); }, "");
  draw(); f.say("Press **ROS 1: with roscore** to see how ROS 1 nodes found each other, then compare with ROS 2.");
}
