// Topic, Service or Action? A quick card sort with an explanation for every answer.
// An index card with the situation sits above three trays; every answer drops a slip into the tray you chose
// (solid when right, outlined in red when not), so the trays become the record of the round.
import { el, rich } from "../dom.js";
import { shell, shuffle, useCss } from "./shell.js";
import { svgNode } from "./art.js";

useCss("tsa");
const TRAY = {
  topic: ["a stream, many listeners", `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M8 8a5.5 5.5 0 0 0 0 8M16 8a5.5 5.5 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/></g></svg>`],
  service: ["ask once, wait for one reply", `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h14l-3-3M20 15H6l3 3"/></g></svg>`],
  action: ["goal, feedback, result, cancel", `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h3M9 18h3M15 18h2"/><path d="M19 20V5l-1 0"/><path d="M19 5h-6l1.5 2.5L13 10h6"/></g></svg>`],
};

export const CARDS = [
  ["The lidar sends 10 laser scans every second to anyone who needs them.", "topic", "A continuous stream that many nodes may read is a **topic**."],
  ["Ask the battery node once: 'What is your charge right now?'", "service", "One question, one quick answer: a **service**."],
  ["Drive Chiku to the kitchen, 20 metres away, reporting progress on the way.", "action", "A long task with progress reports that may be cancelled is an **action**."],
  ["The camera streams 30 images per second to the screen and the detector.", "topic", "A stream to many readers is a **topic**."],
  ["Reset the robot's odometry (position counter) to zero.", "service", "A quick command that finishes immediately and replies 'done' is a **service**."],
  ["Rotate the robot arm to pick up a box, and stop if a person walks in.", "action", "It takes time, you want feedback, and you need to cancel it: an **action**."],
  ["The teleop keyboard keeps sending speed commands to the wheels.", "topic", "Speed commands on `/cmd_vel` are a continuous **topic**."],
  ["Spawn a second turtle in turtlesim at x = 2, y = 2.", "service", "turtlesim's `/spawn` is a **service**: one request, one reply with the new turtle's name."],
  ["Explore an unknown floor for 10 minutes, reporting how much is mapped, and stop when told to.", "action", "A long job with feedback that can be cancelled is an **action** (exploration servers work this way; the map itself then streams on the `/map` topic)."],
  ["Every node announces log messages so you can read them in rqt_console.", "topic", "`/rosout` is a **topic** that collects logs from every node."],
  ["A TurtleBot3 publishes its wheel odometry 30 times a second for Nav2 and RViz.", "topic", "`/odom` is a **topic**: a steady stream that several nodes read."],
  ["Send the TurtleBot3 to the loading dock and report the distance remaining on the way.", "action", "Nav2's `/navigate_to_pose` is an **action**: a goal, feedback (distance_remaining) and a result."],
  ["Ask MoveIt for the inverse kinematics of one pose: which joint angles reach it?", "service", "MoveIt's `/compute_ik` is a **service**: one request, one answer."],
  ["Move the UR5e along a planned trajectory that takes 4 seconds, and stop it if needed.", "action", "The arm's `follow_joint_trajectory` is an **action**: it runs for a while and can be cancelled."],
  ["The UR5e's joint angles go out 500 times a second to robot_state_publisher.", "topic", "`/joint_states` is a **topic**."],
  ["Switch a robot from joint_trajectory_controller to forward_position_controller.", "service", "The controller manager's `switch_controller` is a **service**: one request, done or failed."],
  ["A Crazyflie's IMU readings stream to the state estimator.", "topic", "IMU data such as `/imu` is a **topic**."],
  ["Turn turtle1 to face north, with feedback about the angle still to go.", "action", "turtlesim's `rotate_absolute` is an **action**."],
  ["Clear Nav2's costmaps once after a door was opened.", "service", "`/global_costmap/clear_entirely_global_costmap` is a **service**."],
  ["The depth camera on the Go2 sends point clouds to the obstacle detector.", "topic", "A PointCloud2 stream is a **topic**."],
];
const ROUND = 10;
const LABEL = { topic: "Topic", service: "Service", action: "Action" };
const PASS = 8;

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: `Read each situation and choose how the nodes should talk. Get **${PASS} of ${ROUND}** right to earn the badge. Each round draws ten situations from twenty.` }, opts);
  const top = el("div", { class: "ts-top" });
  const pips = el("div", { class: "ts-pips", "aria-hidden": "true" });
  const card = el("div", { class: "ts-card", "aria-live": "polite" });
  const cardNo = el("span", { class: "ts-no", "aria-hidden": "true" });
  const desk = el("div", { class: "ts-desk" }, el("div", { class: "ts-index" }, cardNo, card));
  const btns = el("div", { class: "ts-btns" });
  const nextBtn = el("button", { class: "btn btn-small", type: "button", text: "Next situation", hidden: true });
  g.stage.append(el("div", { class: "ts-head" }, top, pips), desk, btns, nextBtn);

  let deck, i, score, streak, marks;
  const trays = Object.fromEntries(Object.keys(LABEL).map((k) => {
    const stack = el("span", { class: "ts-stack", "aria-hidden": "true" });
    const b = el("button", { class: "opt ts-opt", type: "button", "data-k": k, "aria-label": `${LABEL[k]}: ${TRAY[k][0]}`, onclick: () => choose(k) },
      el("span", { class: "ts-tray-top" }, svgNode(TRAY[k][1]), el("b", { text: LABEL[k] })), el("span", { class: "ts-tray-sub", text: TRAY[k][0] }), stack);
    return [k, { b, stack }];
  }));
  btns.replaceChildren(...Object.values(trays).map((t) => t.b));
  const choose = (pick) => {
    const [, ans, why] = deck[i];
    btns.querySelectorAll("button").forEach((b) => { b.disabled = true; if (b.dataset.k === ans) b.classList.add("right"); else if (b.dataset.k === pick) b.classList.add("wrong"); });
    marks[i] = pick === ans ? "ok" : "no";
    trays[pick].stack.append(el("i", { class: pick === ans ? "ok" : "no" }));
    card.parentElement.classList.add("sorted");
    if (pick === ans) { score++; streak++; g.say((streak >= 3 ? `Correct, ${streak} in a row. ` : "Correct. ") + why, "ok"); }
    else { streak = 0; g.say(`Not this time: it's a **${LABEL[ans]}**. ${why}`, "no"); }
    nextBtn.hidden = false; nextBtn.textContent = i === deck.length - 1 ? "See my score" : "Next situation"; nextBtn.focus();
    paintTop();
  };
  const paintTop = () => {
    top.textContent = `Situation ${Math.min(i + 1, deck.length)} of ${deck.length}, score ${score}`;
    pips.replaceChildren(...deck.map((_, k) => el("i", { class: marks[k] || (k === i ? "now" : "") })));
  };
  function show() {
    paintTop();
    card.replaceChildren(rich(deck[i][0]));
    cardNo.textContent = `${i + 1}`;
    const box = card.parentElement; box.classList.remove("sorted"); box.style.setProperty("--tilt", `${[-1.2, .8, -.4, 1.1][i % 4]}deg`);
    Object.values(trays).forEach(({ b }) => { b.disabled = false; b.classList.remove("right", "wrong"); });
    nextBtn.hidden = true; g.clear();
  }
  nextBtn.addEventListener("click", () => {
    i++;
    if (i < deck.length) return show();
    Object.values(trays).forEach(({ b }) => { b.disabled = true; b.classList.remove("right", "wrong"); }); nextBtn.hidden = true; cardNo.textContent = ""; i = deck.length - 1; paintTop();
    if (score >= PASS) { card.textContent = `You scored ${score} of ${deck.length}.`; g.clear(); g.win("You can tell streams, quick questions and long tasks apart. That is the first design decision in every ROS 2 system.", "ros2 topic list\nros2 service list\nros2 action list"); }
    else { card.textContent = `You scored ${score} of ${deck.length}. You need ${PASS}. Look at the three trays once more and press Start again.`; g.say("Tip: is it a **stream**, a **quick question**, or a **long job with progress**?", "no"); }
  });
  function start() { deck = shuffle(CARDS).slice(0, ROUND); i = 0; score = 0; streak = 0; marks = []; Object.values(trays).forEach((t) => t.stack.replaceChildren()); show(); }
  g.onRestart(start);
  start();
}
