// TF: the same point described in different coordinate frames (map, base_link, laser).
import { frame, svg, el } from "./frame.js";

const SCALE = 50;   // pixels per metre
const O = [60, 280]; // map origin on screen

export function mount(container, meta) {
  const f = frame(container, meta, { height: 320 });
  const S = f.stage;
  const R = { x: 2.0, y: 1.5, yaw: 30 };
  const LASER = { x: 0.3, y: 0 };      // laser mounted 0.3 m in front of the robot centre
  const BOX = { x: 1.2, y: 0.4 };       // obstacle as seen by the laser
  const scr = (x, y) => [O[0] + x * SCALE, O[1] - y * SCALE];

  function axes(cls, name, len = 40) {
    return svg("g", { class: `an-axes ${cls}` }, svg("line", { x1: 0, y1: 0, x2: len, y2: 0, class: "ax" }), svg("line", { x1: 0, y1: 0, x2: 0, y2: -len, class: "ay" }),
      name === "map" ? svg("text", { x: 4, y: 16, class: "an-s", text: name }) : null);
  }
  const grid = svg("g", { class: "an-grid" });
  for (let i = 0; i <= 11; i++) grid.append(svg("line", { x1: O[0] + i * SCALE, y1: 20, x2: O[0] + i * SCALE, y2: O[1] }));
  for (let j = 0; j <= 5; j++) grid.append(svg("line", { x1: O[0], y1: O[1] - j * SCALE, x2: O[0] + 11 * SCALE, y2: O[1] - j * SCALE }));
  const mapAx = axes("map", "map", 50); mapAx.setAttribute("transform", `translate(${O[0]} ${O[1]})`);
  const robot = svg("g", { class: "an-robot" }, svg("rect", { x: -20, y: -16, width: 40, height: 32, rx: 8 }), axes("base", "base_link", 34));
  const laser = svg("g", {}, svg("circle", { r: 6, class: "an-laser" }), axes("laser", "laser", 24));
  robot.append(laser); laser.setAttribute("transform", `translate(${LASER.x * SCALE} 0)`);
  const ray = svg("line", { class: "an-ray" });
  const box = svg("rect", { width: 16, height: 16, x: -8, y: -8, class: "an-obst" });
  S.append(grid, mapAx, ray, box, robot);

  const out = el("div", { class: "anim-tf" });
  f.extra.append(out);
  const sliders = [["x", 0.5, 9.5, 0.1, "m"], ["y", 0.5, 4.5, 0.1, "m"], ["yaw", -180, 180, 5, "°"]].map(([k, lo, hi, st, u]) => {
    const s = el("input", { type: "range", min: String(lo), max: String(hi), step: String(st), value: String(R[k]), "aria-label": `robot ${k}` });
    const v = el("b");
    s.addEventListener("input", () => { R[k] = Number(s.value); paint(); });
    f.extra.append(el("label", { class: "anim-field wide" }, el("span", { text: `robot ${k}` }), s, v));
    return [k, s, v, u];
  });
  function paint() {
    const th = R.yaw * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    const [rx, ry] = scr(R.x, R.y);
    robot.setAttribute("transform", `translate(${rx} ${ry}) rotate(${-R.yaw})`);
    // obstacle in base_link = laser offset + reading; in map = rotate + translate
    const bx = LASER.x + BOX.x, by = LASER.y + BOX.y;
    const mx = R.x + c * bx - s * by, my = R.y + s * bx + c * by;
    const lx = R.x + c * LASER.x, ly = R.y + s * LASER.x;
    const [px, py] = scr(mx, my), [qx, qy] = scr(lx, ly);
    box.setAttribute("transform", `translate(${px} ${py})`);
    Object.entries({ x1: qx, y1: qy, x2: px, y2: py }).forEach(([k, v]) => ray.setAttribute(k, v));
    sliders.forEach(([k, , v, u]) => { v.textContent = `${R[k]}${u}`; });
    const fmt = (a, b) => `(${a.toFixed(2)}, ${b.toFixed(2)})`;
    out.replaceChildren(
      el("div", {}, el("span", { class: "tf-dot laser" }), "In the ", el("b", { text: "laser" }), " frame: ", el("code", { text: fmt(BOX.x, BOX.y) })),
      el("div", {}, el("span", { class: "tf-dot base" }), "In the ", el("b", { text: "base_link" }), " frame: ", el("code", { text: fmt(bx, by) })),
      el("div", {}, el("span", { class: "tf-dot map" }), "In the ", el("b", { text: "map" }), " frame: ", el("code", { text: fmt(mx, my) })));
  }
  f.button("Drive forward 1 m", () => { const th = R.yaw * Math.PI / 180; R.x = Math.min(9.5, Math.max(.5, +(R.x + Math.cos(th)).toFixed(1))); R.y = Math.min(4.5, Math.max(.5, +(R.y + Math.sin(th)).toFixed(1))); sync(); f.say("The robot moved, the obstacle did not. Its **laser** and **base_link** numbers stay the same, but the **map** numbers change because the robot is somewhere else now. TF does this maths for you."); }, "");
  f.button("Turn left 45°", () => { R.yaw = ((R.yaw + 45 + 180) % 360) - 180; sync(); f.say("Turning changes how the robot's axes point, so the same obstacle gets new **map** coordinates."); });
  f.button("Reset", () => { Object.assign(R, { x: 2.0, y: 1.5, yaw: 30 }); sync(); intro(); });
  function sync() { sliders.forEach(([k, s]) => { s.value = R[k]; }); paint(); }
  const intro = () => f.say("Every part of a robot has its own **coordinate frame** (red arrow = x forward, green = y left). The laser sees an obstacle **1.2 m ahead**. Where is it on the **map**? Move the robot with the sliders and watch all three answers.");
  paint(); intro();
}
