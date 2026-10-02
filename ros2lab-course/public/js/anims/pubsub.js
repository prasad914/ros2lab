// Topics: one publisher, many subscribers, matched by exact topic name.
import { frame, box, wire, packet, label, edge, pulse, svg } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 320 });
  const S = f.stage;
  let subs, stream = null, n = 0;

  const pub = box(20, 130, 130, 60, "Lidar node", { cls: "pub", sub: "publisher" });
  const bus = svg("g", { class: "an-bus" }, svg("rect", { x: 210, y: 140, width: 130, height: 40, rx: 20 }), svg("text", { x: 275, y: 165, text: "/scan" }));
  const SUBS = [
    { name: "Obstacle stop", topic: "/scan" },
    { name: "Map builder", topic: "/scan" },
    { name: "Data logger", topic: "/scan" },
    { name: "Camera viewer", topic: "/camera/image" },
  ];

  function build() {
    f.restart(); clearInterval(stream); stream = null; n = 0; f.clearLog();
    S.replaceChildren(label(275, 128, "topic", "an-lbl c"));
    const slots = [20, 95, 170, 245];
    subs = SUBS.map((s, i) => ({ ...s, active: i < 2 || i === 3, got: 0, bx: box(470, slots[i], 150, 56, s.name, { cls: "sub", sub: s.topic }) }));
    S.append(wire(edge(pub, "r"), [210, 160], "solid"));
    subs.forEach((s) => { s.wire = wire([340, 160], edge(s.bx, "l")); S.append(s.wire); });
    S.append(bus, pub, ...subs.map((s) => s.bx));
    paint();
    f.say("The **Lidar node** publishes laser readings on the topic **/scan**. Press **Publish one message** and watch who receives it.");
  }
  function paint() {
    subs.forEach((s) => {
      const listening = s.active && s.topic === "/scan";
      s.bx.style.opacity = s.active ? 1 : .35;
      s.bx.classList.toggle("off", !listening);
      s.wire.classList.toggle("dead", !listening);
      s.bx.setSub(s.active ? `${s.topic}${s.got ? `  ✓${s.got}` : ""}` : "(not running)");
    });
  }
  async function publish(g) {
    n++;
    const msg = `ranges #${n}`;
    f.logLine(`[lidar] publishing on /scan: ${msg}`);
    const p = packet(msg, "data"); S.append(p);
    await f.fly(p, edge(pub, "r"), [275, 160], 650, g); p.remove(); pulse(bus);
    const targets = subs.filter((s) => s.active && s.topic === "/scan");
    await Promise.all(targets.map(async (s) => {
      const c = packet(msg, "data"); S.append(c);
      await f.fly(c, [340, 160], edge(s.bx, "l"), 700, g); c.remove();
      s.got++; pulse(s.bx); f.logLine(`[${s.name.toLowerCase().replace(/ /g, "_")}] heard ${msg}`, "ok");
    }));
    paint();
    const deaf = subs.filter((s) => s.active && s.topic !== "/scan").map((s) => s.name);
    f.say(`One message, **${targets.length} copies**: every node subscribed to exactly **/scan** got it.${deaf.length ? ` ${deaf.join(", ")} listens to a different topic, so it got nothing.` : ""} The lidar never knew who was listening.`, "ok");
  }

  f.button("Publish one message", () => f.play(publish), "");
  const auto = f.button("Stream (10 Hz style)", () => {
    if (stream) { clearInterval(stream); stream = null; auto.textContent = "Stream (10 Hz style)"; return; }
    auto.textContent = "Stop stream";
    const g = f.gen;
    stream = setInterval(() => { if (!f.root.isConnected || g !== f.gen) { clearInterval(stream); return; } f.play(publish); }, 900);
    f.say("A real lidar publishes again and again, about 10 times a second. Topics are made for **streams** like this.");
  });
  f.button("Start the Data logger", () => {
    const s = subs[2]; s.active = !s.active; paint();
    f.say(s.active ? "A new subscriber joined **while the lidar kept running**. Nobody had to change or restart the lidar. That is why ROS 2 programs are easy to extend." : "The logger stopped. The lidar does not care: it keeps publishing.");
  });
  f.button("Typo: map builder uses /Scan", () => {
    const s = subs[1]; s.topic = s.topic === "/scan" ? "/Scan" : "/scan"; paint();
    f.say(s.topic === "/Scan" ? "Topic names are **case-sensitive**. **/Scan** is a different, empty topic, so the map builder now hears silence. No error is printed: this is a classic beginner bug." : "Fixed: the map builder is back on **/scan**.", s.topic === "/Scan" ? "no" : "ok");
  });
  f.button("Reset", build);
  build();
}
