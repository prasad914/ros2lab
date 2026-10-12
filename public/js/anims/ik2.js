// 2-link arm inverse kinematics: click a target, see the law of cosines give the joint angles.
import { frame, svg } from "./frame.js";
import { slider, line, dot, txt, grid, ik2, deg } from "./kit7.js";
export function mount(container, meta) {
  const f = frame(container, meta, { height: 320 });
  const S = f.stage, k = 110, OX = 200, OY = 230, X = (x) => OX + x * k, Y = (y) => OY - y * k;
  const a = slider(f, "link1 length (m)", 0.4, 1.2, 0.05, 1.0, (v) => v.toFixed(2));
  const b = slider(f, "link2 length (m)", 0.3, 1.2, 0.05, 0.8, (v) => v.toFixed(2));
  let up = false, T = [1.2, 0.8], q = [0, 0];
  const upBtn = f.button("Elbow: down", () => { up = !up; upBtn.textContent = up ? "Elbow: up" : "Elbow: down"; solve(); });
  f.button("Fold home (0, 0)", () => { q = [0, 0]; draw(null); f.say("Both joints at 0 rad: the arm points straight along x. Click anywhere to give it a target."); });
  function draw(sol) {
    S.replaceChildren(); grid(S, 640, 320, k / 4, OX, OY);
    const l1 = a.v, l2 = b.v;
    S.append(svg("circle", { cx: OX, cy: OY, r: (l1 + l2) * k, fill: "rgba(59,130,246,.06)", stroke: "#3b82f6", "stroke-dasharray": "6 6" }));
    if (Math.abs(l1 - l2) > 0.01) S.append(svg("circle", { cx: OX, cy: OY, r: Math.abs(l1 - l2) * k, fill: "rgba(239,68,68,.08)", stroke: "#ef4444", "stroke-dasharray": "4 4" }));
    const j = [l1 * Math.cos(q[0]), l1 * Math.sin(q[0])], e = [j[0] + l2 * Math.cos(q[0] + q[1]), j[1] + l2 * Math.sin(q[0] + q[1])];
    S.append(line(X(0), Y(0), X(j[0]), Y(j[1]), "#f59e0b", 12), line(X(j[0]), Y(j[1]), X(e[0]), Y(e[1]), "#0ea5e9", 10), dot(X(0), Y(0), 8, "#0f172a"), dot(X(j[0]), Y(j[1]), 7, "#0f172a"), dot(X(e[0]), Y(e[1]), 6, "#16a34a"));
    S.append(line(X(T[0]) - 7, Y(T[1]) - 7, X(T[0]) + 7, Y(T[1]) + 7, "#dc2626", 3), line(X(T[0]) + 7, Y(T[1]) - 7, X(T[0]) - 7, Y(T[1]) + 7, "#dc2626", 3));
    const L = sol ? [`target (x, y) = (${T[0].toFixed(2)}, ${T[1].toFixed(2)})`, `d² = x² + y² = ${(T[0] ** 2 + T[1] ** 2).toFixed(3)}`, `cos q2 = (d² − l1² − l2²) / (2·l1·l2) = ${sol[2].toFixed(3)}`, `q2 = ${up ? "−" : "+"}acos(…) = ${q[1].toFixed(3)} rad (${deg(q[1])})`, `q1 = atan2(y,x) − atan2(l2·sin q2, l1 + l2·cos q2)`, `   = ${q[0].toFixed(3)} rad (${deg(q[0])})`] : [`target (x, y) = (${T[0].toFixed(2)}, ${T[1].toFixed(2)})`];
    L.forEach((t, i) => S.append(txt(390, 24 + i * 22, t, { "font-size": 12, "font-family": "monospace" })));
  }
  function solve() {
    const sol = ik2(a.v, b.v, T[0], T[1], up);
    if (!sol) { draw(null); const d = Math.hypot(T[0], T[1]); f.say(d > a.v + b.v ? `**Out of reach.** The target is ${d.toFixed(2)} m away, but the arm is only ${(a.v + b.v).toFixed(2)} m long (blue circle). cos q2 would be bigger than 1.` : `**Too close.** Points inside the red circle (closer than |l1 − l2| = ${Math.abs(a.v - b.v).toFixed(2)} m) cannot be reached.`, "no"); return; }
    q = [sol[0], sol[1]]; draw(sol);
    f.say(`Shoulder **${deg(q[0])}**, elbow **${deg(q[1])}**. The green tip lands exactly on the red X. Press **Elbow** to see the *other* solution that reaches the same point.`, "ok");
  }
  S.addEventListener("click", (ev) => { const r = S.getBoundingClientRect(), sx = (ev.clientX - r.left) * 640 / r.width, sy = (ev.clientY - r.top) * 320 / r.height; T = [(sx - OX) / k, (OY - sy) / k]; solve(); });
  a.on(solve); b.on(solve);
  draw(null); f.say("**Click anywhere** to place a target (red X). The node solves IK and moves the arm. Points outside the blue circle are out of reach.");
}
