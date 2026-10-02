// Topic, Service or Action? A quick card sort with an explanation for every answer.
import { el, rich } from "../dom.js";
import { shell, shuffle } from "./shell.js";

const CARDS = [
  ["The lidar sends 10 laser scans every second to anyone who needs them.", "topic", "A continuous stream that many nodes may read is a **topic**."],
  ["Ask the battery node once: 'What is your charge right now?'", "service", "One question, one quick answer: a **service**."],
  ["Drive Chiku to the kitchen, 20 metres away, reporting progress on the way.", "action", "A long task with progress reports that may be cancelled is an **action**."],
  ["The camera streams 30 images per second to the screen and the detector.", "topic", "A stream to many readers is a **topic**."],
  ["Reset the robot's odometry (position counter) to zero.", "service", "A quick command that finishes immediately and replies 'done' is a **service**."],
  ["Rotate the robot arm to pick up a box, and stop if a person walks in.", "action", "It takes time, you want feedback, and you need to cancel it: an **action**."],
  ["The teleop keyboard keeps sending speed commands to the wheels.", "topic", "Speed commands on `/cmd_vel` are a continuous **topic**."],
  ["Spawn a second turtle in turtlesim at x = 2, y = 2.", "service", "turtlesim's `/spawn` is a **service**: one request, one reply with the new turtle's name."],
  ["Build a map of the whole floor while the robot explores for 10 minutes.", "action", "A long-running job with feedback is an **action**."],
  ["Every node announces log messages so you can read them in rqt_console.", "topic", "`/rosout` is a **topic** that collects logs from every node."],
];
const LABEL = { topic: "Topic", service: "Service", action: "Action" };
const PASS = 8;

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: `Read each situation and choose how the nodes should talk. Get **${PASS} of ${CARDS.length}** right to earn the badge.` }, opts);
  const top = el("div", { class: "ts-top" });
  const card = el("div", { class: "ts-card", "aria-live": "polite" });
  const btns = el("div", { class: "ts-btns" });
  const nextBtn = el("button", { class: "btn btn-small", type: "button", text: "Next situation", hidden: true });
  const legend = el("div", { class: "ts-legend small" },
    el("span", {}, el("b", { text: "Topic" }), " = radio station: a stream, many listeners"),
    el("span", {}, el("b", { text: "Service" }), " = counter order: ask once, wait for one reply"),
    el("span", {}, el("b", { text: "Action" }), " = tracked delivery: goal, feedback, result, cancel"));
  g.stage.append(top, card, btns, nextBtn, legend);

  let deck, i, score, streak;
  const choose = (pick) => {
    const [, ans, why] = deck[i];
    btns.querySelectorAll("button").forEach((b) => { b.disabled = true; if (b.dataset.k === ans) b.classList.add("right"); else if (b.dataset.k === pick) b.classList.add("wrong"); });
    if (pick === ans) { score++; streak++; g.say((streak >= 3 ? `🔥 ${streak} in a row. ` : "Correct. ") + why, "ok"); }
    else { streak = 0; g.say(`Not this time: it's a **${LABEL[ans]}**. ${why}`, "no"); }
    nextBtn.hidden = false; nextBtn.textContent = i === deck.length - 1 ? "See my score" : "Next situation"; nextBtn.focus();
    paintTop();
  };
  const paintTop = () => { top.textContent = `Situation ${Math.min(i + 1, deck.length)} of ${deck.length}, score ${score}`; };
  function show() {
    paintTop();
    card.replaceChildren(rich(deck[i][0]));
    btns.replaceChildren(...["topic", "service", "action"].map((k) => el("button", { class: "opt ts-opt", type: "button", "data-k": k, text: LABEL[k], onclick: () => choose(k) })));
    nextBtn.hidden = true; g.clear();
  }
  nextBtn.addEventListener("click", () => {
    i++;
    if (i < deck.length) return show();
    btns.replaceChildren(); nextBtn.hidden = true;
    if (score >= PASS) { card.textContent = `You scored ${score} of ${deck.length}.`; g.clear(); g.win("You can tell streams, quick questions and long tasks apart. That is the first design decision in every ROS 2 system.", "ros2 topic list\nros2 service list\nros2 action list"); }
    else { card.textContent = `You scored ${score} of ${deck.length}. You need ${PASS}. Read the three lines below once more and press Start again.`; g.say("Tip: is it a **stream**, a **quick question**, or a **long job with progress**?", "no"); }
  });
  function start() { deck = shuffle(CARDS); i = 0; score = 0; streak = 0; show(); }
  g.onRestart(start);
  start();
}
