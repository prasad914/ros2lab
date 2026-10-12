// Pizza Tracker: a service blocks until the answer comes; an action gives feedback and can be cancelled.
// Drawn as a kitchen pass: three order tickets clipped to a rail. The counter ticket blocks; the app ticket
// prints its feedback line by line under a six-stop tracker; the third ticket is your friend across the room.
import { el } from "../dom.js";
import { shell, sleep, useCss } from "./shell.js";

useCss("pizza");

const STAGES = [
  [600, 10, "Goal accepted: order #%n"],
  [1500, 30, "Feedback: dough rolled"],
  [1600, 55, "Feedback: in the oven"],
  [1500, 75, "Feedback: packed"],
  [1600, 92, "Feedback: on the way, 2 km"],
  [1200, 100, "Result: delivered!"],
];

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: "Finish the three missions. Watch what you can and cannot do while you wait." }, opts);
  let st;

  const missions = el("ol", { class: "pz-missions" });
  const counterBtn = el("button", { class: "btn btn-small", type: "button", text: "Order at the counter" });
  const counterOut = el("div", { class: "pz-out", "aria-live": "polite" });
  const appBtn = el("button", { class: "btn btn-small", type: "button", text: "Send goal: order on the app" });
  const cancelBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "Cancel order", disabled: true });
  const bar = el("span", { class: "pz-fill" });
  const feed = el("ol", { class: "pz-feed", "aria-live": "polite" });
  const waveBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "Wave to your friend" });
  const waveOut = el("div", { class: "pz-out small" });

  const stops = STAGES.map(([, pct]) => el("i", { "data-pct": String(pct) }));
  const track = (pct) => { bar.style.width = `${Math.max(0, pct - 10) / 90 * 100}%`; stops.forEach((d) => d.classList.toggle("on", pct >= +d.dataset.pct)); };
  const ticket = (cls, no, title, kind, ...body) => el("div", { class: `pz-card pz-ticket ${cls}` },
    el("span", { class: "pz-clip", "aria-hidden": "true" }),
    el("div", { class: "pz-thead" }, el("span", { class: "pz-no", text: no }), el("span", { class: "pz-kind", text: kind })),
    el("h4", { text: title }), ...body);
  g.stage.append(el("div", { class: "pz-board" }, el("span", { class: "pz-board-k", text: "Your missions" }), missions),
    el("div", { class: "pz-pass" }, el("span", { class: "pz-rail", "aria-hidden": "true" }), el("div", { class: "pz-grid" },
      ticket("pz-counter", "Ticket 1", "Counter order", "a service",
        el("p", { class: "small muted", text: "One request, one response. You stand at the counter until the pizza is handed over." }),
        counterBtn, counterOut),
      ticket("pz-app", "Ticket 2", "App order", "an action",
        el("p", { class: "small muted", text: "Send a goal, get feedback while it runs, receive a result. You can cancel any time." }),
        el("div", { class: "pz-btns" }, appBtn, cancelBtn),
        el("div", { class: "pz-track", "aria-hidden": "true" }, el("span", { class: "pz-line" }, bar), ...stops), feed),
      ticket("pz-friend", "Meanwhile", "Your friend", "across the room",
        el("p", { class: "small muted", text: "Your friend is across the room. Can you wave while you wait for food?" }),
        waveBtn, waveOut))));

  const MISSIONS = [
    ["service", "Order a pizza at the counter. While you wait, try to wave to your friend."],
    ["action", "Order on the app and wait until it is delivered. Wave while it is on the way."],
    ["cancel", "Order on the app again, then cancel it before it arrives."],
  ];

  function paintMissions() {
    missions.replaceChildren(...MISSIONS.map(([k, t]) => el("li", { class: st.done[k] ? "done" : "" }, el("span", { class: "box", text: st.done[k] ? "✓" : "" }), el("span", { text: t }))));
    if (MISSIONS.every(([k]) => st.done[k]) && !st.won) {
      st.won = true;
      g.win("A **service** blocks: the caller waits for one response. An **action** runs a long task, sends **feedback** while it works, ends with a **result**, and can be **cancelled**. Robots use actions for things like navigating to a goal.",
        "ros2 service list\nros2 action list\nros2 action send_goal /turtle1/rotate_absolute turtlesim/action/RotateAbsolute \"{theta: 1.57}\" --feedback");
    }
  }

  counterBtn.addEventListener("click", async () => {
    const run = st.run;
    counterBtn.disabled = true; appBtn.disabled = true; waveBtn.disabled = true;
    waveOut.textContent = "You can't wave: you're stuck at the counter waiting for the response.";
    counterOut.textContent = "Request sent. Waiting… (the caller is blocked)";
    await sleep(3000);
    if (run !== st.run) return;
    counterOut.textContent = "Response: here is your pizza ✔";
    counterBtn.disabled = false; appBtn.disabled = st.actionRunning; waveBtn.disabled = false;
    waveOut.textContent = "Free again.";
    st.done.service = true;
    g.say("That was a **service call**: you could do nothing else until the response arrived.", "ok");
    paintMissions();
  });

  appBtn.addEventListener("click", async () => {
    const run = st.run;
    const n = ++st.orders;
    st.actionRunning = true; st.cancelled = false;
    appBtn.disabled = true; counterBtn.disabled = true; cancelBtn.disabled = false;
    feed.replaceChildren(); track(0);
    let waved = st.waves;
    for (const [ms, pct, text] of STAGES) {
      await sleep(ms);
      if (run !== st.run) return;
      if (st.cancelled) break;
      track(pct);
      feed.append(el("li", { text: text.replace("%n", n) }));
    }
    if (run !== st.run) return;
    st.actionRunning = false;
    appBtn.disabled = false; counterBtn.disabled = false; cancelBtn.disabled = true;
    if (st.cancelled) {
      feed.append(el("li", { class: "pz-cancel", text: "Result: goal cancelled. No pizza, no charge." }));
      if (st.orders >= 1) st.done.cancel = true;
      g.say("You cancelled a running action. Robots do this when, for example, a new navigation goal replaces the old one.", "ok");
    } else {
      st.done.action = true;
      g.say(st.waves > waved ? "Delivered, and you waved while it was on the way: an action doesn't block you." : "Delivered! Next time, try waving while the order is on the way.", "ok");
    }
    paintMissions();
  });

  cancelBtn.addEventListener("click", () => { st.cancelled = true; cancelBtn.disabled = true; feed.append(el("li", { text: "Cancel request sent…" })); });

  waveBtn.addEventListener("click", () => {
    st.waves++;
    waveOut.textContent = st.actionRunning ? `You waved ${st.waves} time${st.waves > 1 ? "s" : ""} while the pizza is on its way.` : `You waved ${st.waves} time${st.waves > 1 ? "s" : ""}.`;
  });

  function start() {
    st = { run: (st?.run || 0) + 1, done: {}, orders: 0, waves: 0, actionRunning: false, cancelled: false, won: false };
    counterBtn.disabled = false; appBtn.disabled = false; cancelBtn.disabled = true; waveBtn.disabled = false;
    counterOut.textContent = ""; waveOut.textContent = ""; feed.replaceChildren(); track(0);
    paintMissions();
  }
  g.onRestart(start);
  start();
}
