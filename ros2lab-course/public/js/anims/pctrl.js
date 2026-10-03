// Go-to-goal with a P-controller: v = Kv * distance, w = Kw * heading error. Watch the turtle curve in.
import { frame, svg } from "./frame.js";
import { slider, line, dot, txt, poly, robotIcon } from "./kit7.js";
export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage, k = 300 / 11.1, X = (x) => 170 + x * k, Y = (y) => 300 - y * k;
  const kv = slider(f, "Kv (speed gain)", 0.2, 3, 0.1, 1.0, (v) => v.toFixed(1));
  const kw = slider(f, "Kw (turn gain)", 0.5, 8, 0.5, 4.0, (v) => v.toFixed(1));
  let goal = [8.5, 8.5], pose, path;
  function reset() { pose = { x: 2, y: 2, th: 0 }; path = [[X(2), Y(2)]]; draw("Click inside the square to move the **goal**, then press **Drive**."); }
  function draw(msg, info) {
    S.replaceChildren(svg("rect", { x: 170, y: 0, width: 300, height: 300, fill: "#4556ff", opacity: 0.9 }));
    S.append(poly(path, "#c7d2fe", 2.5), dot(X(goal[0]), Y(goal[1]), 9, "none", { stroke: "#fde047", "stroke-width": 3 }), dot(X(goal[0]), Y(goal[1]), 3, "#fde047"), robotIcon(X(pose.x), Y(pose.y), pose.th, 0.7, "#7cc36b"));
    const dx = goal[0] - pose.x, dy = goal[1] - pose.y, d = Math.hypot(dx, dy);
    let e = Math.atan2(dy, dx) - pose.th; e = Math.atan2(Math.sin(e), Math.cos(e));
    const L = [`distance  d = √(dx²+dy²) = ${d.toFixed(2)} m`, `heading error e = ${e.toFixed(2)} rad`, `linear.x  = Kv·d = ${(kv.v * d).toFixed(2)}`, `angular.z = Kw·e = ${(kw.v * e).toFixed(2)}`];
    L.forEach((t, i) => S.append(txt(484, 40 + i * 26, t, { "font-size": 12 })));
    S.append(txt(8, 40, "Every 0.1 s the node:", { "font-weight": 700 }), ...["1. reads /turtle1/pose", "2. computes d and e", "3. publishes a Twist", "4. stops when d < 0.1"].map((t, i) => txt(8, 66 + i * 24, t)));
    if (info) S.append(txt(8, 280, info, { fill: "#16a34a", "font-weight": 700 }));
    if (msg) f.say(msg);
  }
  S.addEventListener("click", (ev) => { const r = S.getBoundingClientRect(), sx = (ev.clientX - r.left) * 640 / r.width, sy = (ev.clientY - r.top) * 300 / r.height; if (sx < 170 || sx > 470) return; goal = [(sx - 170) / k, (300 - sy) / k]; f.restart(); draw(`New goal at (${goal[0].toFixed(1)}, ${goal[1].toFixed(1)}). Press **Drive**.`); });
  async function drive(g) {
    for (let i = 0; i < 400; i++) {
      const dx = goal[0] - pose.x, dy = goal[1] - pose.y, d = Math.hypot(dx, dy);
      let e = Math.atan2(dy, dx) - pose.th; e = Math.atan2(Math.sin(e), Math.cos(e));
      if (d < 0.1) { draw(`Goal reached in **${(i * 0.1).toFixed(1)} s**. Try a bigger **Kw**: the turtle turns first, then drives straight. A small Kw gives wide curves.`, "goal reached!"); f.say(`Goal reached in **${(i * 0.1).toFixed(1)} s**. Try a bigger **Kw** (turns first) or a small one (wide curves). Too big a Kv overshoots.`, "ok"); return; }
      const v = Math.min(kv.v * d, 3), w = Math.max(-6, Math.min(6, kw.v * e));
      for (let s = 0; s < 10; s++) { pose.th += w * 0.01; pose.x += Math.cos(pose.th) * v * 0.01; pose.y += Math.sin(pose.th) * v * 0.01; }
      pose.x = Math.max(0, Math.min(11.1, pose.x)); pose.y = Math.max(0, Math.min(11.1, pose.y));
      path.push([X(pose.x), Y(pose.y)]); draw(); await f.wait(50, g);
    }
    f.say("The turtle did not get there in 40 s. A tiny gain makes it very slow: raise Kv.", "no");
  }
  f.button("Drive", () => f.play(drive), "btn-primary");
  f.button("Reset", () => { f.restart(); reset(); });
  reset();
}
