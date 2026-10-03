// Inside an action: 3 services (send_goal, cancel_goal, get_result) + 2 topics (feedback, status), and the goal states.
import { frame, box, packet, label, svg, pulse } from "./frame.js";

const LANES = [["send_goal", "service"], ["get_result", "service"], ["cancel_goal", "service"], ["feedback", "topic"], ["status", "topic"]];
const STATES = ["ACCEPTED", "EXECUTING", "CANCELING", "SUCCEEDED", "CANCELED", "ABORTED"];

export function mount(container, meta) {
  const f = frame(container, meta, { height: 300 });
  const S = f.stage;
  let C, V, st = {};
  const ly = (i) => 32 + i * 36;
  function draw() {
    C = box(10, 30, 120, 175, "client", { cls: "pub", sub: "countdown" });
    V = box(510, 30, 120, 175, "server", { cls: "sub", sub: "countdown" });
    const kids = [C, V];
    LANES.forEach(([n, k], i) => kids.push(svg("line", { x1: 135, y1: ly(i) + 8, x2: 505, y2: ly(i) + 8, class: `an-wire ${k === "topic" ? "" : "solid"}` }),
      label(320, ly(i) + 3, `/countdown/_action/${n}  (${k})`, "an-lbl small")));
    st = {};
    STATES.forEach((s, i) => { const g = svg("g", { class: "an-state" }, svg("rect", { x: 12 + i * 104, y: 240, width: 98, height: 30, rx: 8 }), svg("text", { x: 61 + i * 104, y: 260, text: s })); st[s] = g; kids.push(g); });
    kids.push(label(320, 232, "goal state", "an-lbl small"));
    S.replaceChildren(...kids);
  }
  const state = (s) => { Object.values(st).forEach((g) => g.classList.remove("now")); st[s].classList.add("now"); };
  async function lane(g, i, text, toServer, cls) { const p = packet(text, cls); S.append(p); await f.fly(p, [toServer ? 160 : 480, ly(i) + 8], [toServer ? 480 : 160, ly(i) + 8], 750, g); p.remove(); pulse(toServer ? V : C); }
  async function run(g, cancel) {
    draw(); f.clearLog();
    f.logLine("$ ros2 action send_goal --feedback /countdown my_robot_interfaces/action/Countdown \"{start_from: 3}\"");
    f.say("1. The client sends the **goal** on the `send_goal` **service** and gets an answer: accepted or rejected.");
    await lane(g, 0, "goal: start_from 3", true, "req"); await lane(g, 0, "accepted ✓", false, "res"); state("ACCEPTED"); f.logLine("Goal accepted with ID: 5c1f…");
    f.say("2. The client immediately asks for the **result** on `get_result`. That request now **waits** until the job is done.");
    const wait = packet("waiting for result…", "req"); S.append(wait); await f.fly(wait, [160, ly(1) + 8], [440, ly(1) + 8], 750, g);
    state("EXECUTING"); await lane(g, 4, "status: EXECUTING", false);
    for (const n of [3, 2, 1]) {
      f.say(`3. While working, the server streams **feedback** on the \`feedback\` **topic**: current = ${n}.`);
      await lane(g, 3, `current: ${n}`, false, "fb"); f.logLine(`Feedback:\n    current: ${n}`);
      if (cancel && n === 2) {
        f.say("The user presses **cancel**: a request goes on the `cancel_goal` **service**. The goal becomes **CANCELING**, then **CANCELED**.", "no");
        await lane(g, 2, "cancel please", true, "req"); state("CANCELING"); await lane(g, 4, "status: CANCELING", false); await f.wait(400, g);
        state("CANCELED"); wait.remove(); await lane(g, 1, "result: stopped at 2", false, "res");
        f.logLine("Goal finished with status: CANCELED", "warn"); return;
      }
    }
    state("SUCCEEDED"); wait.remove(); await lane(g, 4, "status: SUCCEEDED", false);
    await lane(g, 1, "result: Lift-off!", false, "res");
    f.logLine("Result:\n    message: Lift-off!"); f.logLine("Goal finished with status: SUCCEEDED", "ok");
    f.say("4. Done: the **result** comes back on `get_result`. **One action = 3 services + 2 topics**, all created for you by ROS 2.", "ok");
  }
  f.button("Send goal", () => f.play((g) => run(g, false)), "");
  f.button("Send goal, then cancel", () => f.play((g) => run(g, true)));
  draw(); f.say("An action looks simple from outside (goal → feedback → result). Press **Send goal** to see what happens underneath.");
}
