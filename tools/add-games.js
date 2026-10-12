// One-time script: adds mini-game blocks and "go deeper" links to content/course-content.json.
// Safe to run twice (it skips lessons that already have them). Run from the project folder: node tools/add-games.js
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "content", "course-content.json");
const course = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
const lessons = Object.fromEntries(course.modules.flatMap((m) => m.lessons.map((l) => [l.id, l])));

const L = {
  linuxJourney: { title: "Linux Journey", url: "https://labex.io/linuxjourney", note: "short, playful terminal lessons with quizzes" },
  ubuntuCli: { title: "Ubuntu: the Linux command line for beginners", url: "https://ubuntu.com/tutorials/command-line-for-beginners", note: "the official walk-through" },
  pyTut: { title: "The official Python tutorial", url: "https://docs.python.org/3/tutorial/", note: "chapters 3 to 5 match Days 3 to 5" },
  cs50p: { title: "CS50's Introduction to Programming with Python", url: "https://cs50.harvard.edu/python/", note: "free Harvard video lectures" },
  learncpp: { title: "LearnCpp.com", url: "https://www.learncpp.com/", note: "the best free modern C++ tutorial; chapters 0 to 8 are enough for ROS 2" },
  articulated: { title: "Articulated Robotics: Getting ready for ROS", url: "https://articulatedrobotics.xyz/tutorials/ready-for-ros/ros-overview/", note: "a friendly big-picture overview" },
  rbeTopic: { title: "The Robotics Back-End: What is a ROS topic?", url: "https://roboticsbackend.com/what-is-a-ros-topic/", note: "the radio-station explanation" },
  jazzyTut: { title: "Official ROS 2 Jazzy tutorials", url: "https://docs.ros.org/en/jazzy/Tutorials.html", note: "your next step after this course; do them in order" },
  turtlesim: { title: "Using turtlesim, ros2 and rqt", url: "https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools/Introducing-Turtlesim/Introducing-Turtlesim.html", note: "your first real ROS 2 session" },
  cheat: { title: "ROS 2 command cheat sheet", url: "https://github.com/ubuntu-robotics/ros2_cheats_sheet", note: "every ros2 command on one page" },
};

const has = (l, t, id) => l.blocks.some((b) => b.t === t && (!id || b.id === id));
const before = (l, type) => { const i = l.blocks.findIndex((b) => b.t === type); return i < 0 ? l.blocks.length : i; };
function addGame(id, game, where, extra = {}) {
  const l = lessons[id]; if (!l || has(l, "game", game)) return;
  l.blocks.splice(before(l, where), 0, { t: "game", id: game, ...extra });
  console.log(`  ${id}: game ${game}`);
}
function addLinks(id, items) {
  const l = lessons[id]; if (!l || has(l, "links")) return;
  l.blocks.push({ t: "links", label: "Go deeper (free resources)", items });
  console.log(`  ${id}: links`);
}

addGame("A2", "paths", "mcq", { intro: "Now practise with a game: guide Chiku through the folders using only `cd`." });
addGame("B8", "radio", "mcq", { intro: "A real robot runs many nodes that talk on topics. Before the quick checks, tune some topics yourself." });
addGame("C4", "pizza", "recap", { bonus: true, intro: "Topics are one of **three** ways ROS 2 nodes talk. The other two are **services** and **actions**. Play to feel the difference; you will meet them in the official tutorials." });
addGame("C4", "tsa", "recap", { bonus: true });
addGame("A7", "source", "mcq", { intro: "Time to practise `source` with several terminals at once." });
addGame("R2", "turtle", "recap", { bonus: true, intro: "Rehearse your first turtlesim session here. Every command works the same way on your own Ubuntu computer." });

addLinks("A1", [L.linuxJourney, L.ubuntuCli]);
addLinks("P1", [L.pyTut, L.cs50p]);
addLinks("C1", [L.learncpp]);
addLinks("B8", [L.articulated, L.rbeTopic]);
addLinks("R4", [L.jazzyTut, L.turtlesim, L.cheat]);

// Firestore cannot store arrays inside arrays: stop if any slipped in.
(function scan(v, p) {
  if (Array.isArray(v)) v.forEach((x, i) => { if (Array.isArray(x)) throw new Error(`Nested array at ${p}[${i}]`); scan(x, `${p}[${i}]`); });
  else if (v && typeof v === "object") for (const k of Object.keys(v)) scan(v[k], `${p}.${k}`);
})(course, "root");

fs.writeFileSync(file, JSON.stringify(course, null, 2) + "\n", "utf8");
console.log("Done. Upload content/course-content.json again from Instructor > Course content.");
