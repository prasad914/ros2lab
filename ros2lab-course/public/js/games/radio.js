// Tune the Radio: topics are matched by exact name; one publisher, many subscribers.
import { el } from "../dom.js";
import { shell } from "./shell.js";

const PUBS = [
  { topic: "/camera/image", who: "Camera node", icon: "📷", every: 1300, msg: (n) => `Image #${n}: 640×480 pixels` },
  { topic: "/scan", who: "Lidar node", icon: "📡", every: 1000, msg: (n) => `ranges: [${(1 + (n % 5) * 0.1).toFixed(1)}, 0.9, 2.4 …]` },
  { topic: "/cmd_vel", who: "Teleop node", icon: "🎮", every: 1600, msg: (n) => `linear.x: ${(0.1 + (n % 3) * 0.05).toFixed(2)}  angular.z: 0.00` },
];
const SUBS = [
  { who: "Screen", needs: "/camera/image", icon: "🖥️", job: "shows what the camera sees" },
  { who: "Obstacle detector", needs: "/scan", icon: "🚧", job: "stops Chiku before walls" },
  { who: "Data logger", needs: "/scan", icon: "💾", job: "records the laser data" },
  { who: "Wheel motors", needs: "/cmd_vel", icon: "⚙️", job: "turn speed commands into motion" },
];
const DIAL = ["(not tuned)", "/camera/image", "/camera_image", "/scan", "/Scan", "/cmd_vel", "/cmdvel"];
const NEAR = { "/camera_image": "/camera/image", "/Scan": "/scan", "/cmdvel": "/cmd_vel" };

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: "Each robot part below needs data. Turn its dial to the topic that carries that data. Messages only arrive when the topic name matches **exactly**." }, opts);
  let state, timers = [];

  const pubRow = el("div", { class: "rd-pubs" });
  const subRow = el("div", { class: "rd-subs" });
  const list = el("pre", { class: "rd-list", "aria-label": "Live output of ros2 topic list" });
  g.stage.append(el("div", { class: "rd-label", text: "Publishers (broadcasting)" }), pubRow,
    el("div", { class: "rd-air", "aria-hidden": "true" }),
    el("div", { class: "rd-label", text: "Subscribers (tune each one)" }), subRow,
    el("details", { class: "rd-details" }, el("summary", { text: "What does ros2 topic list show right now?" }), list));

  const pubEls = PUBS.map((p) => {
    const card = el("div", { class: "rd-pub" }, el("span", { class: "rd-icon", text: p.icon }),
      el("div", {}, el("b", { text: p.who }), el("code", { text: p.topic })), el("span", { class: "rd-wave", "aria-hidden": "true" }));
    pubRow.append(card);
    return card;
  });

  const subEls = SUBS.map((s, i) => {
    const name = el("code", { class: "rd-name" });
    const count = el("span", { class: "rd-count" });
    const last = el("div", { class: "rd-last" });
    const prev = el("button", { type: "button", class: "rd-btn", "aria-label": `Previous topic for ${s.who}`, text: "◀" });
    const next = el("button", { type: "button", class: "rd-btn", "aria-label": `Next topic for ${s.who}`, text: "▶" });
    const card = el("div", { class: "rd-sub" },
      el("div", { class: "rd-sub-top" }, el("span", { class: "rd-icon", text: s.icon }), el("div", {}, el("b", { text: s.who }), el("span", { class: "small muted", text: s.job })), count),
      el("div", { class: "rd-dial" }, prev, name, next), last);
    prev.addEventListener("click", () => turn(i, -1));
    next.addEventListener("click", () => turn(i, +1));
    subRow.append(card);
    return { card, name, count, last };
  });

  function turn(i, d) {
    const st = state.subs[i];
    st.dial = (st.dial + d + DIAL.length) % DIAL.length;
    st.got = 0;
    const t = DIAL[st.dial];
    if (NEAR[t]) g.say(`**${t}** is not **${NEAR[t]}**. ROS 2 matches topics by their exact name, so this typo makes a brand-new empty topic. Nothing will arrive.`, "no");
    else if (t !== "(not tuned)" && t !== SUBS[i].needs) g.say(`${SUBS[i].who} is now listening to **${t}**, but that data is not what it needs.`, "no");
    else g.clear();
    paint();
  }

  function paint() {
    state.subs.forEach((st, i) => {
      const t = DIAL[st.dial];
      const e = subEls[i];
      e.name.textContent = t;
      e.card.classList.toggle("ok", t === SUBS[i].needs && st.got > 0);
      e.count.textContent = st.got ? `${st.got} received` : t === "(not tuned)" ? "" : "silence…";
      if (!st.got) e.last.textContent = t === "(not tuned)" ? "Not subscribed to anything yet." : "Waiting for messages…";
    });
    const topics = new Set(PUBS.map((p) => p.topic));
    state.subs.forEach((st) => { const t = DIAL[st.dial]; if (t !== "(not tuned)") topics.add(t); });
    list.textContent = `$ ros2 topic list\n${[...topics].sort().join("\n")}\n/parameter_events\n/rosout`;
  }

  function publish(pi) {
    if (!g.root.isConnected) { stop(); return; }
    const p = PUBS[pi];
    const n = ++state.sent[pi];
    pubEls[pi].classList.remove("tx"); void pubEls[pi].offsetWidth; pubEls[pi].classList.add("tx");
    state.subs.forEach((st, i) => {
      if (DIAL[st.dial] !== p.topic) return;
      st.got++;
      const e = subEls[i];
      e.last.textContent = p.msg(n);
      e.card.classList.remove("rx"); void e.card.offsetWidth; e.card.classList.add("rx");
    });
    paint();
    check();
  }

  function check() {
    if (state.done) return;
    const allRight = state.subs.every((st, i) => DIAL[st.dial] === SUBS[i].needs && st.got >= 2);
    if (allRight) {
      state.done = true;
      g.clear();
      g.win("Every part gets its data. Notice that the obstacle detector **and** the logger both received every `/scan` message: one publisher, many subscribers, and nobody needed to know who else was listening.",
        "ros2 topic list\nros2 topic echo /scan\nros2 topic info /scan");
    }
  }

  function stop() { timers.forEach(clearInterval); timers = []; }
  function start() {
    stop();
    state = { subs: SUBS.map(() => ({ dial: 0, got: 0 })), sent: PUBS.map(() => 0), done: false };
    paint();
    timers = PUBS.map((p, i) => setInterval(() => publish(i), p.every));
  }
  g.onRestart(start);
  start();
}
