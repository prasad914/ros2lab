// QoS matchmaker: does this publisher/subscriber pair connect? Plus late joiners and lossy Wi-Fi.
import { frame, box, wire, packet, label, edge, pulse, el } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 250 });
  const S = f.stage;
  const sel = (name, opts) => el("select", { "aria-label": name }, opts.map((o) => el("option", { value: o, text: o })));
  const pr = sel("Publisher reliability", ["RELIABLE", "BEST_EFFORT"]), pd = sel("Publisher durability", ["VOLATILE", "TRANSIENT_LOCAL"]);
  const sr = sel("Subscriber reliability", ["RELIABLE", "BEST_EFFORT"]), sd = sel("Subscriber durability", ["VOLATILE", "TRANSIENT_LOCAL"]);
  f.extra.append(el("div", { class: "anim-row" }, el("b", { text: "Publisher offers: " }), pr, pd), el("div", { class: "anim-row" }, el("b", { text: "Subscriber requests: " }), sr, sd));
  let P, Q, rows;
  function draw(subVisible = true) {
    P = box(30, 70, 170, 70, "camera", { cls: "pub", sub: `${pr.value} · ${pd.value === "VOLATILE" ? "VOLATILE" : "TRANSIENT"}` });
    Q = box(440, 70, 170, 70, "viewer", { cls: subVisible ? "sub" : "sub off", sub: subVisible ? `${sr.value} · ${sd.value === "VOLATILE" ? "VOLATILE" : "TRANSIENT"}` : "(not started yet)" });
    rows = [label(320, 40, "", "an-lbl c"), label(320, 190, "", "an-lbl"), label(320, 212, "", "an-lbl")];
    S.replaceChildren(wire(edge(P, "r"), edge(Q, "l")), P, Q, ...rows);
  }
  const relOk = () => !(pr.value === "BEST_EFFORT" && sr.value === "RELIABLE");
  const durOk = () => !(pd.value === "VOLATILE" && sd.value === "TRANSIENT_LOCAL");
  async function judge(g) {
    draw(); f.clearLog();
    rows[0].textContent = "Chiku the judge checks each rule…";
    await f.wait(500, g); rows[1].textContent = `Reliability: offer ${pr.value} vs request ${sr.value}  ${relOk() ? "✓" : "✗"}`;
    await f.wait(700, g); rows[2].textContent = `Durability: offer ${pd.value} vs request ${sd.value}  ${durOk() ? "✓" : "✗"}`;
    await f.wait(600, g);
    if (relOk() && durOk()) {
      rows[0].textContent = "compatible: connected";
      f.say("Every rule passes: the publisher **offers at least** what the subscriber **requests**. Messages flow.", "ok");
      for (let i = 1; i <= 3; i++) { const p = packet(`frame ${i}`); S.append(p); await f.fly(p, [edge(P, "r")[0] + 30, 105], [edge(Q, "l")[0] - 30, 105], 700, g); p.remove(); pulse(Q); }
    } else {
      rows[0].textContent = "incompatible: NOT connected";
      const why = relOk() ? "DURABILITY" : "RELIABILITY";
      f.logLine(`[WARN] [viewer]: New publisher discovered on topic '/image', offering incompatible QoS. No messages will be received from it. Last incompatible policy: ${why}`, "warn");
      f.say(`The subscriber asks for **more** than the publisher offers (${why}). ROS 2 **silently sends nothing**, apart from a warning. This is a top reason why "my nodes don't talk".`, "no");
      const p = packet("frame 1", "bad"); S.append(p); await f.fly(p, [edge(P, "r")[0] + 30, 105], [320, 105], 700, g); await f.wait(500, g); p.remove();
    }
  }
  async function late(g) {
    draw(false); f.clearLog();
    f.say("The publisher sends **map v1** before any subscriber exists…");
    const p = packet("map v1"); S.append(p); await f.fly(p, [edge(P, "r")[0] + 30, 105], [320, 105], 700, g); p.remove();
    await f.wait(400, g); draw(true);
    if (relOk() && durOk() && pd.value === "TRANSIENT_LOCAL" && sd.value === "TRANSIENT_LOCAL") {
      f.say("…the subscriber starts late. Both use **TRANSIENT_LOCAL**, so the publisher kept the last message and hands it over now.", "ok");
      const q = packet("map v1"); S.append(q); await f.fly(q, [edge(P, "r")[0] + 30, 105], [edge(Q, "l")[0] - 30, 105], 800, g); q.remove(); pulse(Q);
    } else f.say("…the subscriber starts late and gets **nothing**: with **VOLATILE**, old messages are not kept for late joiners. Set **both** durabilities to TRANSIENT_LOCAL and try again.", "no");
  }
  async function lossy(g) {
    draw(); f.clearLog();
    if (!(relOk() && durOk())) { f.say("First make the pair compatible, then test the lossy Wi-Fi.", "no"); return; }
    const reliable = pr.value === "RELIABLE" && sr.value === "RELIABLE";
    f.say(reliable ? "Weak Wi-Fi with **RELIABLE**: a lost message is **sent again**, so it arrives late but it arrives." : "Weak Wi-Fi with **BEST_EFFORT**: a lost message is simply **gone**, and the next ones stay on time. Good for camera images.");
    for (let i = 1; i <= 4; i++) {
      const p = packet(`msg ${i}`); S.append(p);
      if (i === 2) { await f.fly(p, [edge(P, "r")[0] + 30, 105], [320, 150], 600, g); p.classList.add("bad"); await f.wait(300, g); p.remove();
        if (reliable) { f.logLine("msg 2 lost → sent again"); const r = packet("msg 2 again", "req"); S.append(r); await f.fly(r, [edge(P, "r")[0] + 30, 105], [edge(Q, "l")[0] - 30, 105], 700, g); r.remove(); }
        else f.logLine("msg 2 lost → skipped"); continue; }
      await f.fly(p, [edge(P, "r")[0] + 30, 105], [edge(Q, "l")[0] - 30, 105], 600, g); p.remove(); pulse(Q);
    }
  }
  [pr, pd, sr, sd].forEach((s) => s.addEventListener("change", () => { f.restart(); draw(); f.say("Settings changed. Press **Check and send**."); }));
  f.button("Check and send", () => f.play(judge), "");
  f.button("Late joiner test", () => f.play(late));
  f.button("Lossy Wi-Fi test", () => f.play(lossy));
  draw(); f.say("Pick the QoS each side uses, then press **Check and send**. The rule: **the publisher must offer at least what the subscriber requests.**");
}
