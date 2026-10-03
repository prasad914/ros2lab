// The ROS 2 layer cake: your code -> rclpy/rclcpp -> rcl -> rmw -> DDS -> network, and back up.
import { frame, label, packet, svg, el } from "./frame.js";

const LAYERS = [["Your node (Python or C++)", "top"], ["rclpy / rclcpp", "l1"], ["rcl (written in C)", "l2"], ["rmw: the plug", "l3"], ["DDS", "l0"]];

export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage;
  const vendor = el("select", { "aria-label": "Middleware" }, ["Fast DDS (default in Jazzy)", "Cyclone DDS", "RTI Connext", "Zenoh (not DDS)"].map((v) => el("option", { value: v, text: v })));
  f.extra.append(el("label", { class: "anim-field" }, "Middleware: ", vendor));
  const lx = [30, 370], ly = (i) => 18 + i * 44;
  function draw() {
    const v = vendor.value.split(" (")[0];
    const kids = [];
    for (const [k, x0] of lx.entries()) {
      kids.push(label(x0 + 120, 12, k ? "Computer 2 (listener)" : "Computer 1 (talker)", "an-lbl"));
      LAYERS.forEach(([n, c], i) => kids.push(svg("g", { class: `an-layer ${c}` }, svg("rect", { x: x0, y: ly(i), width: 240, height: 38, rx: 8 }),
        svg("text", { x: x0 + 120, y: ly(i) + 24, text: i === 4 ? v : n }))));
    }
    kids.push(svg("rect", { x: 30, y: 250, width: 580, height: 32, rx: 8, class: "an-net" }), label(320, 271, "network (UDP / Wi-Fi / shared memory)", "an-lbl"));
    S.replaceChildren(...kids);
  }
  async function send(g) {
    draw();
    const p = packet("Hello Chiku"); S.append(p);
    const steps = ["Your code calls **publish()**.", "**rclpy/rclcpp** turns it into a ROS message.", "**rcl** is the shared core used by every language.",
      "**rmw** is a standard plug: the layers above never need to know which middleware is below.", `**${vendor.value.split(" (")[0]}** packs the message and sends it on the network.`];
    for (let i = 0; i < 5; i++) { f.say(steps[i]); await f.fly(p, [150, ly(i) + 19], [150, ly(i + 1) + 19 > 250 ? 266 : ly(i + 1) + 19], 650, g); }
    await f.fly(p, [150, 266], [490, 266], 900, g);
    for (let i = 4; i >= 0; i--) await f.fly(p, [490, i === 4 ? 266 : ly(i + 1) + 19], [490, ly(i) + 19], 500, g);
    f.say(`The message climbs up Computer 2's layers into the listener's callback. Change the middleware and press **Send** again: **your code stays exactly the same**. (Both computers must use the same middleware.)`, "ok");
  }
  vendor.addEventListener("change", () => { f.restart(); draw(); f.say(`Middleware switched to **${vendor.value.split(" (")[0]}**. In a real terminal: \`export RMW_IMPLEMENTATION=...\`. Press **Send**.`); });
  f.button("Send a message", () => f.play(send), "");
  draw(); f.say("A ROS 2 program sits on **layers**, like floors in a building. Press **Send a message** and watch it travel.");
}
