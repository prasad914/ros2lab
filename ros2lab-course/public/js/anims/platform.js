// Why robots need a software platform: tangled point-to-point code vs one standard "bus".
import { frame, box, wire, label, pulse, svg } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage;
  const P = [["Camera", 30, 18], ["LiDAR", 250, 18], ["Motors", 470, 18], ["Planner", 90, 222], ["Screen", 300, 222]];
  let mode = "tangle", brand = 1, tools = false, boxes = [], wires = [];
  function render() {
    boxes = P.map(([n, x, y]) => box(x, y, 140, 56, n, { cls: n === "LiDAR" ? "pub" : "", sub: n === "LiDAR" ? `brand ${brand}` : "" }));
    wires = []; const kids = [];
    if (mode === "tangle") {
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const w = wire(boxes[i].center, boxes[j].center, "solid"); w.dataset.ends = `${i},${j}`; wires.push(w);
      }
      kids.push(...wires, label(560, 280, "10 custom connections", "an-lbl"));
    } else {
      kids.push(svg("g", { class: "an-bus" }, svg("rect", { x: 20, y: 133, width: 600, height: 34, rx: 10 }), svg("text", { x: 320, y: 156, text: "ROS 2: standard messages" })));
      for (const [i, b] of boxes.entries()) { const w = wire(b.center, [b.center[0], 150], "solid"); w.dataset.ends = `${i}`; wires.push(w); }
      if (tools) { const t = box(500, 222, 130, 56, "Free tools", { cls: "sub", sub: "RViz · rqt · bag" }); boxes.push(t); wires.push(wire(t.center, [565, 150], "solid")); }
      kids.unshift(...wires);
    }
    S.replaceChildren(...kids, ...boxes);
  }
  function reset() {
    f.restart(); mode = "tangle"; brand = 1; tools = false; render();
    f.say("Chiku has five programs. **Without a framework**, every program is wired to every other one with its own custom code.");
  }
  async function swap(g) {
    brand++; boxes[1].setSub(`brand ${brand}`); pulse(boxes[1]);
    const hit = wires.filter((w) => w.dataset.ends.split(",").includes("1"));
    hit.forEach((w) => w.classList.add("bad"));
    f.say(mode === "tangle"
      ? `New LiDAR brand! **${hit.length} connections** break, and the programmers must rewrite them all.`
      : "New LiDAR brand! Only **its own driver** changes: it still publishes the same standard `LaserScan` message, so nothing else is touched.", mode === "tangle" ? "no" : "ok");
    await f.wait(1600, g); hit.forEach((w) => w.classList.remove("bad"));
  }
  f.button("Swap the LiDAR brand", () => f.play(swap), "");
  f.button("Use a framework (ROS)", () => { f.restart(); mode = "bus"; render(); f.say("With **ROS**, every program talks through one shared set of **standard messages**. Each program has just one connection."); });
  f.button("Add free tools", () => {
    if (mode !== "bus") { f.say("Tools like RViz only work when everyone speaks the same standard messages. Switch to the framework first.", "no"); return; }
    tools = true; render(); f.say("Because the messages are standard, ready-made **tools** (3-D viewer, recorder, graphs) work with **every** ROS robot for free.", "ok");
  });
  f.button("Reset", reset);
  reset();
}
