// Small shared pieces for the Week 6 and 7 robot animations (plain SVG drawing, sliders).
import { el, svg } from "./frame.js";
export function slider(f, text, min, max, step, value, fmt = (v) => v) {
  const inp = el("input", { type: "range", min, max, step, value, "aria-label": text });
  const out = el("b", { text: fmt(Number(value)) });
  inp.addEventListener("input", () => { out.textContent = fmt(Number(inp.value)); });
  f.extra.append(el("label", { class: "anim-field wide" }, text + " ", inp, out));
  return { get v() { return Number(inp.value); }, set v(x) { inp.value = x; out.textContent = fmt(Number(x)); }, on(fn) { inp.addEventListener("input", fn); }, inp };
}
export const line = (x1, y1, x2, y2, stroke = "#1f2937", w = 2, extra = {}) => svg("line", { x1, y1, x2, y2, stroke, "stroke-width": w, "stroke-linecap": "round", ...extra });
export const dot = (cx, cy, r, fill = "#1f2937", extra = {}) => svg("circle", { cx, cy, r, fill, ...extra });
export const txt = (x, y, text, extra = {}) => svg("text", { x, y, "font-size": 13, fill: "#1f2937", text, ...extra });
export const poly = (pts, stroke = "#7c3aed", w = 2.5, extra = {}) => svg("polyline", { points: pts.map((p) => p.join(",")).join(" "), fill: "none", stroke, "stroke-width": w, "stroke-linejoin": "round", ...extra });
export function grid(S, W, H, step, ox, oy) {
  const g = svg("g", {});
  for (let x = ox % step; x < W; x += step) g.append(line(x, 0, x, H, "#cbd5e1", 0.6));
  for (let y = oy % step; y < H; y += step) g.append(line(0, y, W, y, "#cbd5e1", 0.6));
  g.append(line(ox, 0, ox, H, "#94a3b8", 1.2), line(0, oy, W, oy, "#94a3b8", 1.2));
  S.append(g);
}
export function robotIcon(x, y, th, k = 1, color = "#475569") {
  const g = svg("g", { transform: `translate(${x} ${y}) rotate(${-th * 180 / Math.PI})` });
  g.append(svg("rect", { x: -18 * k, y: -14 * k, width: 36 * k, height: 28 * k, rx: 6, fill: color, stroke: "#0f172a", "stroke-width": 2 }),
    svg("rect", { x: -10 * k, y: -19 * k, width: 20 * k, height: 6 * k, rx: 2, fill: "#0f172a" }), svg("rect", { x: -10 * k, y: 13 * k, width: 20 * k, height: 6 * k, rx: 2, fill: "#0f172a" }),
    line(0, 0, 24 * k, 0, "#ef4444", 3));
  return g;
}
export function ik2(l1, l2, x, y, up) {
  const c2 = (x * x + y * y - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  if (c2 > 1 || c2 < -1) return null;
  const q2 = (up ? -1 : 1) * Math.acos(c2);
  return [Math.atan2(y, x) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2)), q2, c2];
}
export const deg = (r) => (r * 180 / Math.PI).toFixed(1) + "°";
