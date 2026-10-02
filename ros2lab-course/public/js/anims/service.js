// Services: one request, one response; the client waits. Server must be running.
import { frame, box, wire, packet, label, edge, pulse, el } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 260 });
  const S = f.stage;
  let online = true, busy = false;
  const client = box(30, 90, 170, 80, "Chiku's brain", { cls: "pub", sub: "service client" });
  const server = box(440, 90, 170, 80, "Calculator node", { cls: "sub", sub: "service server" });
  const name = label(320, 72, "/add_two_ints", "an-lbl c");
  const a = el("input", { type: "number", value: "2", min: "-99", max: "99", "aria-label": "a" });
  const b = el("input", { type: "number", value: "3", min: "-99", max: "99", "aria-label": "b" });
  f.extra.append(el("label", { class: "anim-field" }, "request.a = ", a), el("label", { class: "anim-field" }, "request.b = ", b));

  function build() {
    f.restart(); busy = false; f.clearLog();
    S.replaceChildren(wire(edge(client, "r"), edge(server, "l"), "solid"), name, label(320, 118, "request →", "an-lbl"), label(320, 160, "← response", "an-lbl"), client, server);
    paint();
    f.say("A **service** is a question with exactly one answer. Set two numbers, then press **Call the service**.");
  }
  function paint() {
    server.classList.toggle("off", !online);
    server.setSub(online ? "service server" : "(not running)");
    client.setSub(busy ? "waiting…" : "service client");
    client.classList.toggle("wait", busy);
  }
  async function call(g) {
    if (busy) return;
    const x = Math.trunc(Number(a.value) || 0), y = Math.trunc(Number(b.value) || 0);
    busy = true; paint();
    f.logLine(`$ ros2 service call /add_two_ints example_interfaces/srv/AddTwoInts "{a: ${x}, b: ${y}}"`);
    if (!online) {
      f.logLine("waiting for service to become available...", "warn");
      f.say("Nobody is serving **/add_two_ints**, so the client just waits. In real code, `wait_for_service()` is how a client checks first.", "no");
      await f.wait(2200, g); busy = false; paint(); return;
    }
    f.logLine(`requester: making request: example_interfaces.srv.AddTwoInts_Request(a=${x}, b=${y})`);
    const req = packet(`a=${x}, b=${y}`, "req"); S.append(req);
    f.say("The client sends a **request** and then **waits**. It cannot get its answer until the server replies.");
    await f.fly(req, [edge(client, "r")[0] + 40, 112], [edge(server, "l")[0] - 40, 112], 1000, g); req.remove(); pulse(server);
    server.setSub("working…"); f.say("The server's callback runs once for this request: `response.sum = request.a + request.b`.");
    await f.wait(700, g);
    server.setSub("service server");
    const res = packet(`sum=${x + y}`, "res"); S.append(res);
    await f.fly(res, [edge(server, "l")[0] - 40, 148], [edge(client, "r")[0] + 40, 148], 1000, g); res.remove(); pulse(client);
    f.logLine("response:"); f.logLine(`example_interfaces.srv.AddTwoInts_Response(sum=${x + y})`, "ok");
    busy = false; paint();
    f.say(`Done: **one request, one response** (sum = ${x + y}). Use a service for quick jobs that answer right away: spawn a turtle, reset a map, read a setting.`, "ok");
  }
  f.button("Call the service", () => f.play(call), "");
  f.button("Stop / start the server", () => { online = !online; paint(); f.say(online ? "The calculator node is running again." : "The calculator node has stopped. Try calling the service now."); });
  f.button("Reset", () => { online = true; build(); });
  build();
}
