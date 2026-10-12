// Messages: build a geometry_msgs/msg/Twist and see the path it would make the turtle drive.
import { frame, svg, el } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage;
  const V = { lx: 1.0, az: 0.0 };
  const path = svg("path", { class: "an-path" });
  const turtle = svg("text", { class: "an-turtle", text: "🐢" });
  const yaml = svg("g", { transform: "translate(350 34)" });
  S.append(svg("rect", { x: 20, y: 20, width: 300, height: 260, rx: 10, class: "an-tsim" }), path, turtle, yaml);
  let timer = null;

  const sl = [["lx", "linear.x (forward speed, m/s)", -2, 2, .1], ["az", "angular.z (turn speed, rad/s)", -2, 2, .1]].map(([k, t, lo, hi, st]) => {
    const s = el("input", { type: "range", min: String(lo), max: String(hi), step: String(st), value: String(V[k]), "aria-label": t });
    const v = el("b");
    s.addEventListener("input", () => { V[k] = Number(s.value); paint(); });
    f.extra.append(el("label", { class: "anim-field wide" }, el("span", { text: t }), s, v));
    return [k, s, v];
  });
  function trace() {   // integrate 3 seconds of motion from the centre, heading right
    let x = 170, y = 150, th = 0; const pts = [[x, y]];
    for (let i = 0; i < 90; i++) { th += V.az * 3 / 90; x += Math.cos(th) * V.lx * 3 / 90 * 40; y -= Math.sin(th) * V.lx * 3 / 90 * 40; pts.push([x, y]); }
    return pts;
  }
  function paint() {
    const pts = trace();
    path.setAttribute("d", "M" + pts.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join(" L"));
    sl.forEach(([k, , v]) => { v.textContent = V[k].toFixed(1); });
    const lines = ["$ ros2 interface show", "    geometry_msgs/msg/Twist", "Vector3  linear", "    float64 x", "    float64 y", "    float64 z", "Vector3  angular", "    float64 x", "    float64 y", "    float64 z", "",
      "# your message:", `linear:  {x: ${V.lx.toFixed(1)}, y: 0.0, z: 0.0}`, `angular: {x: 0.0, y: 0.0, z: ${V.az.toFixed(1)}}`];
    yaml.replaceChildren(...lines.map((t, i) => svg("text", { x: 0, y: i * 19, class: `mono${i > 10 ? " b" : i < 2 ? " dim" : ""}`, text: t })));
    const [x, y] = pts[0]; turtle.setAttribute("x", x - 12); turtle.setAttribute("y", y + 8);
    const what = V.lx === 0 && V.az === 0 ? "stand still" : V.lx === 0 ? "spin on the spot" : V.az === 0 ? (V.lx > 0 ? "drive straight forward" : "reverse in a straight line") : "drive in a curve (a circle if you keep sending it)";
    f.say(`This **Twist** message says: forward **${V.lx.toFixed(1)} m/s**, turn **${V.az.toFixed(1)} rad/s**. The turtle would **${what}**. A message is just a box of named fields; its **type** says which fields.`);
  }
  async function drive() {
    clearInterval(timer);
    const pts = trace(); let i = 0;
    f.logLine(`$ ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: ${V.lx.toFixed(1)}}, angular: {z: ${V.az.toFixed(1)}}}"`);
    f.logLine("publishing #1: geometry_msgs.msg.Twist(...)", "ok");
    timer = setInterval(() => {
      if (!f.root.isConnected || i >= pts.length) { clearInterval(timer); return; }
      turtle.setAttribute("x", pts[i][0] - 12); turtle.setAttribute("y", pts[i][1] + 8); i += 2;
    }, 30);
  }
  f.button("Publish it to /turtle1/cmd_vel", drive, "");
  f.button("Circle", () => { V.lx = 1.0; V.az = 1.0; sync(); });
  f.button("Spin", () => { V.lx = 0; V.az = 1.8; sync(); });
  f.button("Straight", () => { V.lx = 1.5; V.az = 0; sync(); });
  function sync() { sl.forEach(([k, s]) => { s.value = V[k]; }); paint(); }
  paint();
}
