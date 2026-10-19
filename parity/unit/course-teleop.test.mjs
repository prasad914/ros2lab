// expert_review_2026-10-18 must-fix 7: course text about driving the Jazzy TurtleBot3 matches the real captures.
// parity/fixtures/tb3_burger/sensors/teleop: plain teleop_twist_keyboard publishes geometry_msgs/msg/Twist, the
// TurtleBot3 bridge subscribes TwistStamped, and a Twist does not move the robot (twist_vs_stamped_runner.txt);
// turtlebot3_teleop teleop_keyboard and teleop_twist_keyboard -p stamped:=true publish TwistStamped.
// sensors/errors/no_tb3_model: the world launch needs TURTLEBOT3_MODEL.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const course = JSON.parse(readFileSync(new URL("../../content/course-content.json", import.meta.url), "utf8").replace(/^﻿/, ""));
const strings = [];   // [path, text, lesson, block]
(function walk(o, p, lesson, block) {
  if (typeof o === "string") strings.push([p, o, lesson, block]);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) {
    const q = `${p}/${k}`;
    walk(v, q, /\/lessons\/\d+$/.test(q) ? q : lesson, /\/blocks\/\d+$/.test(q) ? q : block);
  }
})(course, "", "", "");
const textOf = (key, i) => strings.filter((x) => x[i] === key).map((x) => x[1]).join("\n");
describe("course text: driving the TurtleBot3 on Jazzy", () => {
  it("never tells students to drive the TurtleBot3 with plain teleop_twist_keyboard", () => {
    // in every lesson that is about the TurtleBot3
    const bad = strings.filter(([, s, lesson]) => /ros2 run teleop_twist_keyboard teleop_twist_keyboard(?![^`]*stamped:=true)/.test(s) && /TurtleBot3/.test(textOf(lesson, 2))).map(([p]) => p);
    expect(bad).toEqual([]);
  });
  it("exports TURTLEBOT3_MODEL wherever it launches turtlebot3_world.launch.py", () => {
    // in the same block (a terminal block's earlier task may export it)
    const bad = strings.filter(([, s, , block]) => /ros2 launch turtlebot3_gazebo turtlebot3_world\.launch\.py/.test(s) && !/TURTLEBOT3_MODEL/.test(textOf(block, 3))).map(([p]) => p);
    expect(bad).toEqual([]);
  });
  it("does not describe RViz page controls that no longer exist", () => {
    const bad = strings.filter(([, s]) => /Type these commands for me|pick \*\*Gazebo simulation\*\*/.test(s)).map(([p]) => p);
    expect(bad).toEqual([]);
  });
});
