// Yaw angle <-> quaternion (z, w) for a robot on the floor.
import { frame, svg } from "./frame.js";
import { slider, line, dot, txt, robotIcon } from "./kit7.js";
export function mount(container, meta) {
  const f = frame(container, meta, { height: 260 });
  const S = f.stage;
  const yaw = slider(f, "yaw θ (degrees)", -180, 180, 5, 90, (v) => v + "°");
  function draw() {
    const th = yaw.v * Math.PI / 180;
    S.replaceChildren(svg("circle", { cx: 140, cy: 130, r: 95, fill: "none", stroke: "#cbd5e1", "stroke-width": 2 }), line(30, 130, 250, 130, "#94a3b8", 1), line(140, 20, 140, 240, "#94a3b8", 1), txt(254, 134, "x"), txt(144, 18, "y"));
    S.append(svg("path", { d: `M ${140 + 40} 130 A 40 40 0 ${Math.abs(th) > Math.PI ? 1 : 0} ${th >= 0 ? 0 : 1} ${140 + 40 * Math.cos(th)} ${130 - 40 * Math.sin(th)}`, fill: "none", stroke: "#f59e0b", "stroke-width": 3 }), robotIcon(140, 130, th, 1.3), dot(140 + 95 * Math.cos(th), 130 - 95 * Math.sin(th), 6, "#ef4444"));
    const z = Math.sin(th / 2), w = Math.cos(th / 2);
    const rows = [`θ = ${yaw.v}° = ${th.toFixed(3)} rad`, "For a robot on the floor (roll = pitch = 0):", `x = 0.0`, `y = 0.0`, `z = sin(θ/2) = ${z.toFixed(3)}`, `w = cos(θ/2) = ${w.toFixed(3)}`, `check: z² + w² = ${(z * z + w * w).toFixed(3)}`, "back to yaw: θ = 2·atan2(z, w)"];
    rows.forEach((t, i) => S.append(txt(320, 34 + i * 26, t, { "font-size": 13, "font-family": "monospace", ...(i === 4 || i === 5 ? { "font-weight": 700, fill: "#7c3aed" } : {}) })));
    f.say(yaw.v === 0 ? "Facing along x: the quaternion is (0, 0, 0, **1**). That is why an \"empty\" orientation has w = 1." : Math.abs(yaw.v) === 180 ? "Facing backwards: z = ±1, w = 0." : `Turning ${yaw.v}° gives z = **${z.toFixed(3)}**, w = **${w.toFixed(3)}**. Odometry nodes put exactly these numbers in pose.orientation.`);
  }
  yaw.on(draw); draw();
}
