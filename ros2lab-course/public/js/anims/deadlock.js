// Why client.call() inside a callback freezes a node, and how call_async() avoids it.
import { frame, box, packet, label, edge, pulse } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 270 });
  const S = f.stage;
  let E, Qb, Sv;
  function draw() {
    E = box(30, 30, 220, 80, "executor", { cls: "pub", sub: "1 worker: free" });
    Qb = box(30, 170, 220, 64, "waiting callbacks", { sub: "(empty)" });
    Sv = box(430, 90, 180, 70, "calculator node", { cls: "sub", sub: "service server" });
    S.replaceChildren(E, Qb, Sv, label(140, 155, "inbox ↓", "an-lbl"));
  }
  async function story(g, useAsync) {
    draw(); f.clearLog();
    f.say("Every second, a **timer callback** runs. The executor's **only worker** picks it up.");
    E.setSub("1 worker: running timer_callback"); E.classList.add("wait"); await f.wait(900, g);
    f.logLine(useAsync ? "future = self.cli.call_async(request)" : "response = self.cli.call(request)   # waits here…");
    const req = packet("a=2, b=3", "req"); S.append(req); await f.fly(req, edge(E, "r"), edge(Sv, "l"), 900, g); req.remove(); pulse(Sv);
    if (useAsync) {
      E.setSub("1 worker: free"); E.classList.remove("wait");
      f.say("With **call_async()**, the callback **finishes immediately** and the worker is free again.");
    } else f.say("With **call()**, the callback **stops and waits** for the answer. The only worker is stuck inside it.", "no");
    await f.wait(700, g);
    const res = packet("sum=5", "res"); S.append(res); await f.fly(res, edge(Sv, "l"), [140, 202], 900, g); res.remove();
    Qb.setSub("response for the client ✉"); pulse(Qb);
    if (!useAsync) {
      E.setSub("1 worker: stuck in call()");
      f.say("**Deadlock!** The answer is waiting in the inbox, but delivering it needs the worker, and the worker is waiting for the answer. The node freezes forever. **Never call() inside a callback.**", "no");
      f.logLine("(nothing happens… forever)", "warn"); return;
    }
    await f.wait(500, g); Qb.setSub("(empty)"); E.setSub("1 worker: running done-callback"); await f.wait(800, g);
    f.logLine("[INFO] [asker]: sum = 5", "ok"); E.setSub("1 worker: free");
    f.say("The free worker picks up the response and runs the **done-callback**: `sum = 5`. Use **call_async()** with `future.add_done_callback(...)`.", "ok");
  }
  f.button("Use call()", () => f.play((g) => story(g, false)), "");
  f.button("Use call_async()", () => f.play((g) => story(g, true)), "");
  f.button("Reset", () => { f.restart(); draw(); f.clearLog(); f.say("Compare the two buttons. One freezes the robot; one doesn't."); });
  draw(); f.say("A node asks a calculator node for **2 + 3** from inside its timer callback. Compare **call()** and **call_async()**.");
}
