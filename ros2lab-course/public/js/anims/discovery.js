// DDS discovery (hello -> exchange endpoints -> data) and domain IDs.
import { frame, box, wire, packet, label, edge, svg, el } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 290 });
  const S = f.stage;
  const ids = [0, 0, 0].map((v, i) => el("input", { type: "number", value: String(v), min: "0", max: "300", "aria-label": `Domain ID of laptop ${i + 1}` }));
  ids.forEach((inp, i) => f.extra.append(el("label", { class: "anim-field" }, `Laptop ${i + 1}: ROS_DOMAIN_ID=`, inp)));
  const roles = [["Laptop 1", "talker", "pub"], ["Laptop 2", "listener", "sub"], ["Laptop 3", "listener", "sub"]];
  let L = [];
  const dom = (i) => Math.trunc(Number(ids[i].value) || 0);
  function draw() {
    L = roles.map(([n, r, c], i) => box([30, 245, 460][i], 40, 150, 64, n, { cls: c, sub: `${r} · domain ${dom(i)}` }));
    S.replaceChildren(...L, ...L.map((b, i) => label(b.center[0], 128, `port ${7400 + 250 * dom(i)}`, "an-lbl small")));
  }
  async function run(g) {
    draw(); f.clearLog();
    const bad = [0, 1, 2].find((i) => dom(i) < 0 || dom(i) > 232);
    if (bad !== undefined) { f.say(`Laptop ${bad + 1}: domain ${dom(bad)} is **not allowed** (the maximum is 232; on Linux use **0 to 101**).`, "no"); return; }
    const odd = [0, 1, 2].find((i) => dom(i) > 101);
    f.say("**Step 1 (participant discovery):** every laptop shouts **hello, I am here, domain N** on the network.");
    const rings = L.map((b) => svg("circle", { cx: b.center[0], cy: b.center[1], r: 10, class: "an-ripple" }));
    S.prepend(...rings); await f.wait(1300, g); rings.forEach((r) => r.remove());
    const pairs = [[0, 1], [0, 2]].filter(([a, b]) => dom(a) === dom(b));
    if (!pairs.length) { f.say("Nobody is in the **same domain** as the talker, so the hellos are ignored. No connection, no data.", "no"); return; }
    f.say("**Step 2 (endpoint discovery):** laptops in the **same domain** swap cards: \"I write /chatter\", \"I read /chatter\".");
    await Promise.all(pairs.map(([a, b]) => f.fly(Object.assign(S.appendChild(packet("I read /chatter", "req"))), edge(L[b], "b").map((v, k) => v + (k ? 30 : 0)), edge(L[a], "b").map((v, k) => v + (k ? 30 : 0)), 900, g)));
    S.querySelectorAll(".an-pk").forEach((p) => p.remove());
    pairs.forEach(([a, b]) => S.prepend(wire(edge(L[a], "b"), edge(L[b], "b"), "solid")));
    f.say("**Step 3:** matching writer and reader connect, and the messages flow.", "ok");
    for (let k = 1; k <= 2; k++) await Promise.all(pairs.map(([a, b]) => f.fly(S.appendChild(packet(`Hello ${k}`)), [L[a].center[0], 200], [L[b].center[0], 200], 800, g).then((p) => p.remove())));
    const left = [1, 2].filter((b) => dom(b) !== dom(0));
    f.say(`${left.length ? `Laptop ${left.map((x) => x + 1).join(" and ")} is in a **different domain**, so it never sees the talker. ` : "All three share a domain. "}Use a different **ROS_DOMAIN_ID** per lab bench so robots don't control each other.${odd !== undefined ? " (Above 101 can clash with other programs' ports on Linux.)" : ""}`, "ok");
  }
  f.button("Start the nodes", () => f.play(run), "");
  ids.forEach((inp) => inp.addEventListener("change", () => { f.restart(); draw(); }));
  draw(); f.say("Three laptops on the same Wi-Fi. Change a **domain ID**, then press **Start the nodes**. (Port = 7400 + 250 × domain ID.)");
}
