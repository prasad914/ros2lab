// Parameters: named settings of one node, changed while it runs.
import { frame, svg, el, pulse } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 280 });
  const S = f.stage;
  const P = { background_r: 69, background_g: 86, background_b: 255 };
  const win = svg("rect", { x: 30, y: 30, width: 300, height: 220, rx: 10, class: "an-tsim" });
  const turtle = svg("text", { x: 180, y: 150, class: "an-turtle", text: "🐢" });
  const node = svg("g", { class: "an-box sub", transform: "translate(380 40)" }, svg("rect", { width: 230, height: 200, rx: 12 }),
    svg("text", { x: 115, y: 30, class: "an-t", text: "/turtlesim" }), svg("text", { x: 115, y: 50, class: "an-s", text: "parameters" }));
  const rows = Object.keys(P).map((k, i) => {
    const t = svg("text", { x: 20, y: 90 + i * 34, class: "an-param" });
    node.append(t); return [k, t];
  });
  S.append(win, turtle, svg("text", { x: 180, y: 22, class: "an-lbl", text: "turtlesim window" }), node);
  const sliders = Object.keys(P).map((k) => {
    const s = el("input", { type: "range", min: "0", max: "255", value: String(P[k]), "aria-label": k });
    s.addEventListener("input", () => set(k, Number(s.value), false));
    s.addEventListener("change", () => set(k, Number(s.value), true));
    f.extra.append(el("label", { class: "anim-field wide" }, el("code", { text: k }), s));
    return [k, s];
  });
  function paint() {
    win.style.fill = `rgb(${P.background_r},${P.background_g},${P.background_b})`;
    rows.forEach(([k, t]) => { t.textContent = `${k}: ${P[k]}`; });
  }
  function set(k, v, announce) {
    P[k] = v; paint();
    if (!announce) return;
    f.logLine(`$ ros2 param set /turtlesim ${k} ${v}`); f.logLine("Set parameter successful", "ok");
    pulse(node);
    f.say(`You changed **${k}** to **${v}** while the node kept running. No code was edited and nothing was rebuilt. That is what parameters are for: **settings** such as colours, speeds, limits and file names.`, "ok");
  }
  f.button("ros2 param list", () => { f.logLine("$ ros2 param list"); f.logLine("/turtlesim:"); Object.keys(P).forEach((k) => f.logLine(`  ${k}`)); f.logLine("  use_sim_time"); f.say("`ros2 param list` shows every setting of every running node, grouped by node."); }, "");
  f.button("ros2 param get background_g", () => { f.logLine("$ ros2 param get /turtlesim background_g"); f.logLine(`Integer value is: ${P.background_g}`, "ok"); f.say("`ros2 param get` reads one setting of one node."); });
  f.button("Make it sunset orange", () => { [["background_r", 255], ["background_g", 140], ["background_b", 40]].forEach(([k, v]) => { sliders.find((s) => s[0] === k)[1].value = v; set(k, v, true); }); });
  f.button("Reset", () => { Object.assign(P, { background_r: 69, background_g: 86, background_b: 255 }); sliders.forEach(([k, s]) => { s.value = P[k]; }); f.clearLog(); paint(); intro(); });
  const intro = () => f.say("A node can have **parameters**: named settings. Drag a slider (or press a button) to change turtlesim's background colour **while it runs**.");
  paint(); intro();
}
