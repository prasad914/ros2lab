// Pizza Tracker: a service blocks until the answer comes; an action gives feedback and can be cancelled.
import { el } from "../dom.js";
import { shell, sleep } from "./shell.js";

const STAGES = [
  [600, 10, "Goal accepted: order #%n"],
  [1500, 30, "Feedback: dough rolled"],
  [1600, 55, "Feedback: in the oven"],
  [1500, 75, "Feedback: packed"],
  [1600, 92, "Feedback: on the way, 2 km"],
  [1200, 100, "Result: delivered! 🍕"],
];

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: "Finish the three missions. Watch what you can and cannot do while you wait." }, opts);
  let st;

  const missions = el("ol", { class: "pz-missions" });
  const counterBtn = el("button", { class: "btn btn-small", type: "button", text: "Order at the counter" });
  const counterOut = el("div", { class: "pz-out", "aria-live": "polite" });
  const appBtn = el("button", { class: "btn btn-small", type: "button", text: "Send goal: order on the app" });
  const cancelBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "Cancel order", disabled: true });
  const bar = el("span");
  const feed = el("ol", { class: "pz-feed", "aria-live": "polite" });
  const waveBtn = el("button", { class: "btn btn-white btn-small", type: "button", text: "👋 Wave to your friend" });
  const waveOut = el("div", { class: "pz-out small" });

  g.stage.append(missions, el("div", { class: "pz-grid" },
    el("div", { class: "pz-card" },
      el("h4", { text: "Counter order = a service" }),
      el("p", { class: "small muted", text: "One request, one response. You stand at the counter until the pizza is handed over." }),
      counterBtn, counterOut),
    el("div", { class: "pz-card" },
      el("h4", { text: "App order = an action" }),
      el("p", { class: "small muted", text: "Send a goal, get feedback while it runs, receive a result. You can cancel any time." }),
      el("div", { class: "pz-btns" }, appBtn, cancelBtn),
      el("div", { class: "meter pz-meter" }, bar), feed),
    el("div", { class: "pz-card pz-friend" },
      el("h4", { text: "Meanwhile…" }),
      el("p", { class: "small muted", text: "Your friend is across the room. Can you wave while you wait for food?" }),
      waveBtn, waveOut)));

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
    feed.replaceChildren(); bar.style.width = "0%";
    let waved = st.waves;
    for (const [ms, pct, text] of STAGES) {
      await sleep(ms);
      if (run !== st.run) return;
      if (st.cancelled) break;
      bar.style.width = pct + "%";
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
    waveOut.textContent = st.actionRunning ? `You waved ${st.waves} time${st.waves > 1 ? "s" : ""} while the pizza is on its way. 🙌` : `You waved ${st.waves} time${st.waves > 1 ? "s" : ""}.`;
  });

  function start() {
    st = { run: (st?.run || 0) + 1, done: {}, orders: 0, waves: 0, actionRunning: false, cancelled: false, won: false };
    counterBtn.disabled = false; appBtn.disabled = false; cancelBtn.disabled = true; waveBtn.disabled = false;
    counterOut.textContent = ""; waveOut.textContent = ""; feed.replaceChildren(); bar.style.width = "0%";
    paintMissions();
  }
  g.onRestart(start);
  start();
}
