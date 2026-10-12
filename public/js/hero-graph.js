// Landing hero: a live, tappable ROS graph of Chiku the delivery robot.
import { el, svg, reducedMotion } from "./dom.js";

const NODES = {
  camera: { x: 92, y: 92, label: "/camera", pubs: ["/camera/image"], subs: [] },
  lidar: { x: 92, y: 300, label: "/lidar", pubs: ["/scan"], subs: [] },
  brain: { x: 300, y: 196, label: "/chiku_brain", pubs: ["/cmd_vel"], subs: ["/camera/image", "/scan", "/odom"] },
  wheels: { x: 512, y: 300, label: "/wheels", pubs: ["/odom"], subs: ["/cmd_vel"] },
  screen: { x: 512, y: 92, label: "/screen", pubs: [], subs: ["/camera/image"] },
};
const EDGES = [
  { from: "camera", to: "brain", topic: "/camera/image", every: 900, d: "M150 104 C 200 120, 240 140, 262 164" },
  { from: "camera", to: "screen", topic: "/camera/image", every: 900, d: "M150 84 C 260 50, 360 50, 452 84" },
  { from: "lidar", to: "brain", topic: "/scan", every: 600, d: "M150 288 C 200 276, 240 252, 262 228" },
  { from: "brain", to: "wheels", topic: "/cmd_vel", every: 1100, d: "M372 210 C 410 250, 428 284, 450 294" },
  { from: "wheels", to: "brain", topic: "/odom", every: 1400, d: "M486 328 C 420 386, 320 336, 304 230" },
];
const TYPE = { "/camera/image": "sensor_msgs/msg/Image", "/scan": "sensor_msgs/msg/LaserScan", "/cmd_vel": "geometry_msgs/msg/Twist", "/odom": "nav_msgs/msg/Odometry" };
const SAMPLE = {
  "/camera/image": (n) => `header: {frame_id: camera_link}\nheight: 480\nwidth: 640\nencoding: rgb8\ndata: [${(n * 37) % 255}, ${(n * 91) % 255}, …]`,
  "/scan": (n) => `angle_min: -3.14\nangle_max: 3.14\nranges: [${(0.8 + (n % 7) * 0.05).toFixed(2)}, 1.10, 2.35, …]`,
  "/cmd_vel": (n) => `linear:\n  x: ${(0.15 + (n % 4) * 0.05).toFixed(2)}\nangular:\n  z: ${(n % 3 === 0 ? 0.3 : 0).toFixed(1)}`,
  "/odom": (n) => `pose:\n  position:\n    x: ${(n * 0.07).toFixed(2)}\n    y: 0.00`,
};

export function mountHeroGraph(host) {
  const root = svg("svg", { viewBox: "0 0 600 400", class: "hg-svg", role: "group", "aria-label": "A ROS 2 graph of Chiku the robot. Tap a node or a topic." });
  const defs = svg("defs", {}, svg("marker", { id: "hg-arrow", viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" },
    svg("path", { d: "M0 0 L10 5 L0 10 z", class: "hg-arrowhead" })));
  root.append(defs);
  // RViz-style grid
  const grid = svg("g", { class: "hg-grid", "aria-hidden": "true" });
  for (let x = 0; x <= 600; x += 40) grid.append(svg("line", { x1: x, y1: 0, x2: x, y2: 400 }));
  for (let y = 0; y <= 400; y += 40) grid.append(svg("line", { x1: 0, y1: y, x2: 600, y2: y }));
  root.append(grid);
  // TF axis triad
  root.append(svg("g", { class: "hg-tf", transform: "translate(24 376)", "aria-hidden": "true" },
    svg("line", { x1: 0, y1: 0, x2: 34, y2: 0, class: "tf-x" }), svg("line", { x1: 0, y1: 0, x2: 0, y2: -34, class: "tf-y" }),
    svg("circle", { r: 4, class: "tf-z" }), svg("text", { x: 38, y: 4, text: "x" }), svg("text", { x: -4, y: -40, text: "y" })));

  const edgeLayer = svg("g"), packetLayer = svg("g", { "aria-hidden": "true" }), nodeLayer = svg("g");
  root.append(edgeLayer, packetLayer, nodeLayer);

  const out = el("pre", { class: "hg-out", "aria-live": "polite" });
  const outHead = el("div", { class: "hg-out-head" });
  host.replaceChildren(el("div", { class: "hg-stage" }, root), el("div", { class: "hg-term" }, outHead, out));

  let focus = null, counts = {};
  const paths = EDGES.map((e, i) => {
    const p = svg("path", { d: e.d, class: "hg-edge", "marker-end": "url(#hg-arrow)" });
    edgeLayer.append(p);
    return { ...e, el: p, len: 0, i };
  });
  // topic labels (one per topic, placed near the first edge carrying it)
  const LABEL_AT = { "/camera/image": [300, 46], "/scan": [176, 258], "/cmd_vel": [440, 236], "/odom": [372, 372] };
  for (const [topic, [x, y]] of Object.entries(LABEL_AT)) {
    const w = topic.length * 8.2 + 18;
    const g = svg("g", { class: "hg-topic", tabindex: "0", role: "button", "aria-label": `Echo topic ${topic}`, transform: `translate(${x - w / 2} ${y - 13})` },
      svg("rect", { width: w, height: 26, rx: 13 }), svg("text", { x: w / 2, y: 17.5, "text-anchor": "middle", text: topic }));
    g.addEventListener("click", () => select({ topic }));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select({ topic }); } });
    edgeLayer.append(g);
  }
  for (const [id, n] of Object.entries(NODES)) {
    const w = id === "brain" ? 140 : 116;
    const g = svg("g", { class: `hg-node${id === "brain" ? " brain" : ""}`, tabindex: "0", role: "button", "aria-label": `Show info for node ${n.label}`, transform: `translate(${n.x - w / 2} ${n.y - 24})` },
      svg("rect", { width: w, height: 48, rx: 10 }), svg("circle", { class: "hg-beat", cx: 14, cy: 24, r: 4 }),
      svg("text", { x: w / 2 + 6, y: 29, "text-anchor": "middle", text: n.label }));
    g.addEventListener("click", () => select({ node: id }));
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select({ node: id }); } });
    n.el = g;
    nodeLayer.append(g);
  }

  function select(s) {
    focus = s;
    nodeLayer.querySelectorAll(".hg-node").forEach((g) => g.classList.remove("sel"));
    edgeLayer.querySelectorAll(".hg-topic").forEach((g) => g.classList.toggle("sel", !!s.topic && g.getAttribute("aria-label").endsWith(s.topic)));
    paths.forEach((p) => p.el.classList.toggle("hot", !!s.topic && p.topic === s.topic));
    if (s.node) {
      const n = NODES[s.node];
      n.el.classList.add("sel");
      paths.forEach((p) => p.el.classList.toggle("hot", p.from === s.node || p.to === s.node));
      outHead.textContent = `$ ros2 node info ${n.label}`;
      out.textContent = `${n.label}\n  Subscribers:\n${n.subs.map((t) => `    ${t}: ${TYPE[t]}`).join("\n") || "    (none)"}\n  Publishers:\n${n.pubs.map((t) => `    ${t}: ${TYPE[t]}`).join("\n") || "    (none)"}`;
    } else {
      outHead.textContent = `$ ros2 topic echo ${s.topic}`;
      out.textContent = SAMPLE[s.topic](counts[s.topic] || 0) + "\n---";
    }
  }
  function idle() { outHead.textContent = "$ ros2 node list"; out.textContent = Object.values(NODES).map((n) => n.label).join("\n") + "\n\nTap a node or a topic in the graph."; }
  idle();

  // packets
  const packets = [];
  const still = reducedMotion();
  paths.forEach((p) => { p.len = p.el.getTotalLength(); p.next = performance.now() + Math.random() * p.every; });
  if (still) paths.forEach((p) => { const pt = p.el.getPointAtLength(p.len * 0.55); packetLayer.append(svg("circle", { cx: pt.x, cy: pt.y, r: 5, class: "hg-packet" })); });

  let visible = true, last = performance.now();
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(root);
  function arrive(p) {
    counts[p.topic] = (counts[p.topic] || 0) + 1;
    const n = NODES[p.to].el;
    n.classList.remove("rx"); void n.getBBox(); n.classList.add("rx");
    if (focus && focus.topic === p.topic) out.textContent = SAMPLE[p.topic](counts[p.topic]) + "\n---";
  }
  function frame(now) {
    if (!host.isConnected) return;
    const dt = now - last; last = now;
    if (visible && document.visibilityState === "visible") {
      if (still) {
        paths.forEach((p) => { if (now >= p.next) { p.next = now + p.every * 1.5; arrive(p); } });
      } else {
        paths.forEach((p) => {
          if (now >= p.next) { p.next = now + p.every; const c = svg("circle", { r: 5, class: "hg-packet" }); packetLayer.append(c); packets.push({ p, t: 0, c }); }
        });
        for (let i = packets.length - 1; i >= 0; i--) {
          const k = packets[i];
          k.t += dt / 1300;
          if (k.t >= 1) { k.c.remove(); packets.splice(i, 1); arrive(k.p); continue; }
          const pt = k.p.el.getPointAtLength(k.p.len * k.t);
          k.c.setAttribute("cx", pt.x); k.c.setAttribute("cy", pt.y);
        }
      }
    } else paths.forEach((p) => { p.next = now + p.every; });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
