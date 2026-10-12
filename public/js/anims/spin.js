// rclpy.spin(): a loop that waits for events (timer ticks, messages) and runs one callback at a time.
import { frame, svg, box, packet, pulse } from "./frame.js";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage;
  let queue, slow, tick, ticker, running, stats;
  const exec = box(250, 200, 160, 70, "rclpy.spin()", { cls: "pub", sub: "waiting…" });
  const qG = svg("g");
  const clock = svg("g", { transform: "translate(70 80)" }, svg("circle", { r: 40, class: "an-clock" }), svg("line", { x1: 0, y1: 0, x2: 0, y2: -30, class: "an-hand" }), svg("text", { y: 62, class: "an-s", text: "timer: every 0.5 s" }));
  const radio = box(510, 50, 120, 60, "📡 /scan", { cls: "sub", sub: "messages" });

  function build() {
    f.restart(); clearInterval(ticker); queue = []; slow = false; tick = 0; running = false; stats = { done: 0, late: 0 }; f.clearLog();
    S.replaceChildren(svg("text", { x: 330, y: 30, class: "an-lbl", text: "waiting line (queue)" }), svg("rect", { x: 170, y: 40, width: 320, height: 60, rx: 12, class: "an-queue" }), qG, clock, radio, exec);
    paintQ();
    f.say("`rclpy.spin(node)` is a loop that **waits** for events. Each timer tick or arriving message joins the **queue**, and spin runs **one callback at a time**. Press **Start spinning**.");
  }
  function paintQ() {
    qG.replaceChildren(...queue.slice(0, 5).map((q, i) => { const p = packet(q, q.startsWith("timer") ? "req" : "data"); p.setAttribute("transform", `translate(${220 + i * 62} 70)`); return p; }));
    if (queue.length > 5) qG.append(svg("text", { x: 480, y: 120, class: "an-s", text: `+${queue.length - 5} more waiting` }));
  }
  async function worker(g) {
    running = true;
    while (true) {
      if (!queue.length) { exec.setSub("waiting…"); await f.wait(120, g); continue; }
      const job = queue.shift(); paintQ();
      exec.setSub(`running ${job}`); pulse(exec);
      f.logLine(`spin → ${job === "timer" ? "timer_callback()" : "scan_callback(msg)"}${slow && job === "timer" ? "  (sleeping 2 s!)" : ""}`, slow && job === "timer" ? "warn" : "");
      await f.wait(slow && job === "timer" ? 2000 : 350, g);
      stats.done++;
      if (queue.length > 4) { stats.late++; f.say(`The queue is growing (**${queue.length} waiting**). Messages arrive late and the robot reacts to **old** data. Never use \`time.sleep()\` or long loops inside a callback!`, "no"); }
    }
  }
  function start() {
    if (running) return;
    const g = f.gen;
    f.play(worker);
    ticker = setInterval(() => {
      if (g !== f.gen || !f.root.isConnected) { clearInterval(ticker); return; }
      tick++;
      clock.querySelector(".an-hand").setAttribute("transform", `rotate(${tick * 45})`);
      if (tick % 2 === 0) { queue.push("timer"); pulse(clock); }
      if (tick % 3 === 0) { queue.push("scan"); pulse(radio); }
      paintQ();
    }, 250);
    f.say("Timer ticks and /scan messages arrive. spin picks the **next job**, runs its callback quickly, and goes back to waiting. Your node never calls these callbacks itself: **spin** does.");
  }
  f.button("Start spinning", start, "");
  f.button("Make timer_callback slow", () => { slow = !slow; f.say(slow ? "timer_callback now contains `time.sleep(2)`. Watch the queue..." : "Fast again: callbacks finish quickly and the queue stays short.", slow ? "no" : "ok"); });
  f.button("Reset", build);
  build();
}
