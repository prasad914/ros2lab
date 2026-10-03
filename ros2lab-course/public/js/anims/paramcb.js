// Parameter callbacks: type check, then the on-set "gatekeeper", then the post-set reaction.
import { frame, box, packet, label, edge, pulse, el } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 240 });
  const S = f.stage;
  const val = el("input", { type: "text", value: "1.2", size: "6", "aria-label": "New value" });
  f.extra.append(el("label", { class: "anim-field" }, "ros2 param set /chiku_speed max_speed ", val));
  let current = 0.5, CLI, T, Gk, N;
  function draw() {
    CLI = box(10, 80, 120, 64, "terminal", { sub: "ros2 param set" });
    T = box(160, 80, 120, 64, "type check", { sub: "must be double" });
    Gk = box(310, 80, 140, 64, "on-set callback", { cls: "pub", sub: "max_speed ≤ 1.5 ?" });
    N = box(480, 80, 150, 64, "chiku_speed", { cls: "sub", sub: `max_speed = ${current}` });
    S.replaceChildren(CLI, T, Gk, N, label(320, 200, "", "an-lbl c"));
  }
  async function set(g) {
    draw(); f.clearLog();
    const raw = val.value.trim();
    f.logLine(`$ ros2 param set /chiku_speed max_speed ${raw}`);
    const p = packet(raw || "?"); S.append(p);
    await f.fly(p, edge(CLI, "r"), edge(T, "l"), 600, g);
    const isDouble = /^-?\d+\.\d*$/.test(raw) || /^-?\d*\.\d+$/.test(raw);
    if (!isDouble) {
      p.remove(); T.classList.add("bad");
      const kind = /^-?\d+$/.test(raw) ? "integer" : "string";
      f.logLine(`Setting parameter failed: Wrong parameter type, parameter {max_speed} is of type {double}, setting it to {${kind}} is not allowed.`, "warn");
      f.say(/^-?\d+$/.test(raw) ? `\`${raw}\` is an **integer**, but max_speed was declared as a **double**. Type **${raw}.0** instead.` : "That is not a number at all.", "no"); return;
    }
    await f.fly(p, edge(T, "r"), edge(Gk, "l"), 600, g); pulse(Gk);
    const v = Number(raw);
    if (v > 1.5) {
      p.remove(); Gk.classList.add("bad"); Gk.setSub("REJECTED");
      f.logLine("Setting parameter failed: max_speed must be <= 1.5", "warn");
      f.say(`The **on-set callback** checks the rule and returns \`SetParametersResult(successful=False, reason=...)\`. The value stays **${current}**.`, "no"); return;
    }
    await f.fly(p, edge(Gk, "r"), edge(N, "l"), 600, g); p.remove();
    current = v; N.setSub(`max_speed = ${current}`); pulse(N);
    f.logLine("Set parameter successful", "ok");
    S.querySelector(".an-lbl.c").textContent = `post-set callback: "Chiku now drives at ${current} m/s"`;
    f.say("Accepted! The new value is stored, then the **post-set callback** runs so the node can react (for example, change its speed).", "ok");
  }
  f.button("Press Enter", () => f.play(set), "");
  f.button("Reset", () => { f.restart(); current = 0.5; val.value = "1.2"; draw(); f.clearLog(); f.say("max_speed is back to 0.5."); });
  draw(); f.say("Try **1.2**, then **3.0**, then **2** (without .0). Watch where each value gets stopped.");
}
