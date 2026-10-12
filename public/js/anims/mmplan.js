// Mobile manipulator: drive the base close enough, then solve the arm IK in the base frame.
import { frame, svg } from "./frame.js";
import { line, dot, txt, poly, grid, robotIcon, ik2, deg } from "./kit7.js";
export function mount(container, meta) {
  const f = frame(container, meta, { height: 320 });
  const S = f.stage, k = 55, OX = 60, OY = 260, X = (x) => OX + x * k, Y = (y) => OY - y * k;
  const l1 = 0.6, l2 = 0.5, reach = l1 + l2;
  let B, goal = [7.5, 3.2], q = [Math.PI / 2, 0], path, phase;
  function reset() { B = { x: 0.5, y: 0.5, th: 0 }; path = [[X(B.x), Y(B.y)]]; q = [Math.PI / 2, 0]; phase = ""; draw(); f.say("**Click** to place a goal (red X), then press **Plan and go**. The base drives until the goal is inside the arm's reach, then the arm finishes the job."); }
  function draw(lines = []) {
    S.replaceChildren(); grid(S, 640, 320, k, OX, OY);
    S.append(poly(path, "#7c3aed", 3), svg("circle", { cx: X(B.x), cy: Y(B.y), r: reach * k, fill: "rgba(59,130,246,.08)", stroke: "#3b82f6", "stroke-dasharray": "5 5" }), robotIcon(X(B.x), Y(B.y), B.th, 1.1));
    const a0 = B.th + q[0], j = [B.x + l1 * Math.cos(a0), B.y + l1 * Math.sin(a0)], e = [j[0] + l2 * Math.cos(a0 + q[1]), j[1] + l2 * Math.sin(a0 + q[1])];
    S.append(line(X(B.x), Y(B.y), X(j[0]), Y(j[1]), "#f59e0b", 7), line(X(j[0]), Y(j[1]), X(e[0]), Y(e[1]), "#0ea5e9", 6), dot(X(e[0]), Y(e[1]), 4, "#16a34a"));
    S.append(line(X(goal[0]) - 7, Y(goal[1]) - 7, X(goal[0]) + 7, Y(goal[1]) + 7, "#dc2626", 3), line(X(goal[0]) + 7, Y(goal[1]) - 7, X(goal[0]) - 7, Y(goal[1]) + 7, "#dc2626", 3));
    lines.forEach((t, i) => S.append(txt(330, 22 + i * 20, t, { "font-size": 12, "font-family": "monospace" })));
  }
  S.addEventListener("click", (ev) => { const r = S.getBoundingClientRect(), sx = (ev.clientX - r.left) * 640 / r.width, sy = (ev.clientY - r.top) * 320 / r.height; goal = [(sx - OX) / k, (OY - sy) / k]; f.restart(); draw(); f.say(`Goal at (${goal[0].toFixed(1)}, ${goal[1].toFixed(1)}) in the **odom** frame. Press **Plan and go**.`); });
  async function go(g) {
    const dx = goal[0] - B.x, dy = goal[1] - B.y, d = Math.hypot(dx, dy), stop = reach * 0.7;
    const log = [`1. goal is ${d.toFixed(2)} m away, reach ${reach.toFixed(2)} m`];
    if (d > stop) {
      let turn = Math.atan2(dy, dx) - B.th; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      log.push(`2. turn ${turn.toFixed(2)} rad, drive ${(d - stop).toFixed(2)} m`); f.say("Step 1 and 2: the base **turns** toward the goal and **drives** until the goal is 70% of the reach away.");
      for (let i = 0; i < 20; i++) { B.th += turn / 20; draw(log); await f.wait(30, g); }
      const n = Math.ceil((d - stop) / 0.08);
      for (let i = 0; i < n; i++) { const s = (d - stop) / n; B.x += Math.cos(B.th) * s; B.y += Math.sin(B.th) * s; path.push([X(B.x), Y(B.y)]); draw(log); await f.wait(30, g); }
    } else log.push("2. already within reach: base stays");
    const c = Math.cos(-B.th), s = Math.sin(-B.th), lx = c * (goal[0] - B.x) - s * (goal[1] - B.y), ly = s * (goal[0] - B.x) + c * (goal[1] - B.y);
    log.push(`3. goal in base_link = (${lx.toFixed(2)}, ${ly.toFixed(2)})`);
    const sol = ik2(l1, l2, lx, ly, false);
    if (!sol) { draw(log); f.say("The goal is too close to the base for this arm. A real planner would back up a little.", "no"); return; }
    log.push(`4. IK: q1=${deg(sol[0])}, q2=${deg(sol[1])}`);
    const q0 = q.slice();
    for (let i = 1; i <= 20; i++) { q = [q0[0] + (sol[0] - q0[0]) * i / 20, q0[1] + (sol[1] - q0[1]) * i / 20]; draw(log); await f.wait(35, g); }
    f.say("Step 3 and 4: the goal is turned into the **base_link frame** (subtract the base position, rotate by −θ), then the **2-link IK** gives the joint angles. Done!", "ok");
  }
  f.button("Plan and go", () => f.play(go), "btn-primary");
  f.button("Reset", () => { f.restart(); reset(); });
  reset();
}
