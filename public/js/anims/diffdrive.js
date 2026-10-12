// Differential drive: two wheel speeds -> v and w -> the robot's path, and the odometry numbers.
import { frame, svg } from "./frame.js";
import { slider, txt, poly, grid, robotIcon } from "./kit7.js";
export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage, k = 80, OX = 150, OY = 200, X = (x) => OX + x * k, Y = (y) => OY - y * k;
  const R = 0.05, L = 0.30;
  const wl = slider(f, "left wheel (rad/s)", -10, 10, 0.5, 6, (v) => v.toFixed(1));
  const wr = slider(f, "right wheel (rad/s)", -10, 10, 0.5, 8, (v) => v.toFixed(1));
  let P, path;
  function reset() { P = { x: 0, y: 0, th: 0 }; path = [[X(0), Y(0)]]; draw(); f.say("Set the two wheel speeds and press **Drive 3 s**. Same speeds = straight line; different speeds = a curve; opposite speeds = spin in place."); }
  function draw() {
    S.replaceChildren(); grid(S, 640, 300, k / 2, OX, OY);
    S.append(poly(path, "#7c3aed", 3), robotIcon(X(P.x), Y(P.y), P.th, 1));
    const vl = wl.v * R, vr = wr.v * R, v = (vr + vl) / 2, w = (vr - vl) / L;
    const rows = [`wheel radius r = ${R} m, separation L = ${L} m`, `v_left  = r·ω_l = ${vl.toFixed(2)} m/s`, `v_right = r·ω_r = ${vr.toFixed(2)} m/s`, `v = (v_r + v_l)/2 = ${v.toFixed(3)} m/s`, `ω = (v_r − v_l)/L = ${w.toFixed(3)} rad/s`, "every dt:  θ += ω·dt", "  x += v·cos θ·dt,  y += v·sin θ·dt", `odom: x=${P.x.toFixed(2)} y=${P.y.toFixed(2)} θ=${P.th.toFixed(2)}`];
    rows.forEach((t, i) => S.append(txt(370, 24 + i * 24, t, { "font-size": 12, "font-family": "monospace", ...(i === 7 ? { "font-weight": 700, fill: "#7c3aed" } : {}) })));
  }
  async function drive(g) {
    const vl = wl.v * R, vr = wr.v * R, v = (vr + vl) / 2, w = (vr - vl) / L;
    for (let i = 0; i < 60; i++) { for (let s = 0; s < 5; s++) { P.th += w * 0.01; P.x += Math.cos(P.th) * v * 0.01; P.y += Math.sin(P.th) * v * 0.01; } P.th = Math.atan2(Math.sin(P.th), Math.cos(P.th)); path.push([X(P.x), Y(P.y)]); draw(); await f.wait(40, g); }
    f.say(Math.abs(w) < 1e-6 ? "Equal wheel speeds: ω = 0, so the robot drives **straight**." : Math.abs(v) < 1e-6 ? "Opposite wheel speeds: v = 0, so the robot **spins in place**." : `The robot drove an arc of radius v/ω = **${Math.abs(v / w).toFixed(2)} m**. This is exactly the maths an odometry node does many times per second.`, "ok");
  }
  f.button("Drive 3 s", () => f.play(drive), "btn-primary");
  f.button("Reset", () => { f.restart(); reset(); });
  wl.on(draw); wr.on(draw);
  reset();
}
