// Classes and objects: one blueprint, many robots, each with its own values. self = "this robot".
import { frame, svg, el, pulse } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage;
  let robots;
  const bp = svg("g", { class: "an-blueprint", transform: "translate(20 30)" }, svg("rect", { width: 236, height: 230, rx: 12 }),
    ...["class Robot:", "  def __init__(self, name):", "    self.name = name", "    self.battery = 100", "", "  def drive(self):", "    self.battery -= 10"]
      .map((t, i) => svg("text", { x: 12, y: 30 + i * 26, class: "mono", text: t })));
  const name = el("input", { type: "text", value: "Chiku", maxlength: "8", "aria-label": "robot name" });
  f.extra.append(el("label", { class: "anim-field" }, "name = ", name));
  const tray = svg("g");
  S.append(svg("text", { x: 138, y: 20, class: "an-lbl", text: "the class (blueprint)" }), svg("text", { x: 450, y: 20, class: "an-lbl", text: "objects (real robots)" }), bp, tray);

  function paint() {
    tray.replaceChildren(...robots.map((r, i) => {
      const g = svg("g", { class: `an-obj${r.flash ? " an-pulse" : ""}`, transform: `translate(${272 + (i % 3) * 122} ${40 + Math.floor(i / 3) * 130})` },
        svg("rect", { width: 116, height: 110, rx: 10 }), svg("text", { x: 58, y: 24, class: "an-t", text: `🤖 ${r.var}` }),
        svg("text", { x: 8, y: 54, class: "mono", text: `name: "${r.name}"` }), svg("text", { x: 10, y: 78, class: "mono", text: `battery: ${r.battery}` }),
        svg("rect", { x: 10, y: 88, width: 95 * r.battery / 100, height: 8, rx: 4, class: "an-bar" }));
      r.flash = false; return g;
    }));
  }
  function make() {
    if (robots.length >= 6) { f.say("Six robots is enough for one screen. Press Reset to start again."); return; }
    const n = (name.value || "Robo").replace(/[^\w ]/g, "").slice(0, 8) || "Robo";
    const v = `r${robots.length + 1}`;
    robots.push({ var: v, name: n, battery: 100, flash: true }); paint(); pulse(bp);
    f.logLine(`>>> ${v} = Robot("${n}")`);
    f.say(`\`${v} = Robot("${n}")\` used the blueprint to build a **new object**. Inside \`__init__\`, **self** was this new robot, so \`self.name = name\` gave **${v}** its own name. ${robots.length > 1 ? "Every object keeps **its own** values." : "Build another one with a different name."}`, "ok");
  }
  function drive() {
    if (!robots.length) { f.say("Build a robot first."); return; }
    const r = robots[0]; r.battery = Math.max(0, r.battery - 10); r.flash = true; paint();
    f.logLine(`>>> ${r.var}.drive()`);
    f.say(`\`${r.var}.drive()\` ran the method with **self = ${r.var}**, so only **${r.name}'s** battery went down. ${robots.length > 1 ? "The other robots did not change." : ""}`, "ok");
  }
  f.button("Build a robot: Robot(name)", make, "");
  f.button("r1.drive()", drive);
  f.button("Reset", () => { robots = []; f.clearLog(); paint(); intro(); });
  const intro = () => f.say("A **class** is a blueprint. It is not a robot yet. Type a name and press **Build a robot** to make an **object** from it.");
  robots = []; paint(); intro();
}
