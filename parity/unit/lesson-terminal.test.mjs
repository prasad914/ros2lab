// Site terminal vs the real lesson fixtures (parity/fixtures/lessons/<lesson>/term<N>.json, captured on Ubuntu 24.04 +
// Jazzy with parity/scripts/lessons/run_lesson_terms.py). Each test runs the lesson's own solution commands in the
// site Shell (Node, no browser) and compares with the real step output. Node log lines are compared without the
// real timestamp (the site prints none, AUDIT_V2 #26).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Shell } from "../../public/js/terminal-sim.js";

const root = new URL("../../", import.meta.url);
const course = JSON.parse(readFileSync(new URL("content/course-content.json", root), "utf8").replace(/^﻿/, ""));
const block = (lesson, term) => {
  for (const m of course.modules) for (const l of m.lessons) if (l.id === lesson) return l.blocks.filter((b) => b.t === "term" && b.tasks && b.tasks.length)[term - 1];
  throw new Error(`no lesson ${lesson}`);
};
const fixture = (lesson, term) => JSON.parse(readFileSync(new URL(`parity/fixtures/lessons/${lesson}/term${term}.json`, root), "utf8"));
const realStep = (lesson, term, cmd, last = false) => {
  const all = fixture(lesson, term).steps.filter((x) => x.kind === "cmd" && x.cmd === cmd), s = last ? all[all.length - 1] : all[0];
  if (!s) throw new Error(`${lesson} term${term}: no real step "${cmd}"`);
  return s;
};
const realLines = (step) => String(step.out || "").split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^(\[\w+\]) \[\d+\.\d+\] /, "$1 "));
// runs every solution command of the block in one Shell (tabs share one Shell on the site), returns cmd -> lines of
// its last run; {nano, replace} steps get the same first-occurrence replacement as run_lesson_terms.py
const runSolutions = (lesson, term, extra = []) => {
  const b = block(lesson, term), sh = new Shell(b), out = new Map();
  for (const c of b.tasks.flatMap((t) => [].concat(t.sol)).concat(extra)) {
    if (c && c.nano) { const f = sh.node(sh.abs(c.nano)); if (f) f.content = f.content.replace(...(c.replace || ["", ""])); continue; }
    if (typeof c !== "string") continue;
    const r = sh.run(c);
    out.set(c, (r.lines || []).filter((l) => l.cls !== "hint").map((l) => l.text));
  }
  return { sh, out };
};

describe("N10: a TRANSIENT_LOCAL message reaches a late subscriber (AUDIT_V2 #41)", () => {
  it("late_listener prints the latched map status at once, as on real", () => {
    const want = realLines(realStep("N10", 1, "ros2 run chiku_control late_listener"))[0];
    expect(want).toBe('[INFO] [late_listener]: I joined late but still got: "map of the warehouse is ready"');
    const { out } = runSolutions("N10", 1);
    expect(out.get("ros2 run chiku_control late_listener")).toContain(want);
  });
});

// real ros2cli output for one command from an investigation file: the lines between "## $ <cmd>" and "exit=N"
const realInvestigation = (file, cmd) => {
  const txt = readFileSync(new URL(`parity/fixtures/lessons/_investigations/${file}`, root), "utf8").split("\n");
  const i = txt.indexOf(`## $ ${cmd}`); if (i < 0) throw new Error(`${file}: no "${cmd}"`);
  const j = txt.findIndex((l, k) => k > i && /^exit=/.test(l));
  return { lines: txt.slice(i + 1, j).filter((l) => l.trim()), exit: Number(txt[j].slice(5)) };
};

describe("SetPen with a bare off key fails as on real (AUDIT_V2 #40)", () => {
  const bare = 'ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 4, off: 0}"';
  const quoted = `ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: 255, g: 0, b: 0, width: 4, 'off': 0}"`;
  it("bare off: 0 prints the real error and no request", () => {
    const real = realInvestigation("setpen_off_forms.txt", bare);
    expect(real.exit).toBe(1);
    const { out } = runSolutions("D4", 2, [bare]);
    expect(out.get(bare)).toEqual(real.lines);
  });
  it("'off': 0 still makes the request", () => {
    const real = realInvestigation("setpen_off_forms.txt", quoted);
    const { out } = runSolutions("D4", 2, [quoted]);
    expect(out.get(quoted)).toContain(real.lines.find((l) => l.startsWith("requester:")));
  });
  it("topic pub: an unquoted off key fails the same way (rosidl set_message_fields, yaml_nonstring_keys.txt)", () => {
    const txt = readFileSync(new URL("parity/fixtures/lessons/_investigations/yaml_nonstring_keys.txt", root), "utf8").split("\n");
    const want = txt[txt.indexOf("## Twist {linear: {x: 1.0}, off: 0}") + 2];
    const cmd = 'ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 1.0}, off: 0}"';
    const { out } = runSolutions("D4", 2, [cmd]);
    expect(out.get(cmd)[0]).toBe(want);
  });
});

describe("N19: node info of the C++ TF broadcaster (AUDIT_V2 #21, N19 row)", () => {
  it("lists the subscription /turtle1/pose built from the turtlename parameter, and the /tf publisher", () => {
    const cmd = "ros2 node info /turtle_tf_broadcaster";
    const real = realLines(realStep("N19", 1, cmd));
    expect(real).toContain("    /turtle1/pose: turtlesim/msg/Pose");
    expect(real).toContain("    /tf: tf2_msgs/msg/TFMessage");
    const { out } = runSolutions("N19", 1);
    expect(out.get(cmd).filter((l) => l.trim())).toEqual(real);
  });
});

describe("robot_state_publisher startup prints Robot initialized, not one 'got segment' per link (AUDIT_V2 #14)", () => {
  for (const lesson of ["XT5", "RV1"]) it(`${lesson} task 1`, () => {
    const cmd = block(lesson, 1).tasks[0].sol;
    const real = realLines(realStep(lesson, 1, cmd));
    expect(real).toEqual(["[INFO] [robot_state_publisher]: Robot initialized"]);
    const { out } = runSolutions(lesson, 1);
    expect(out.get(cmd)).toEqual(real);
  });
});

describe("joint_state_publisher(_gui) startup lines and logger as on real (AUDIT_V2 #14)", () => {
  for (const [lesson, cmd] of [["XT5", "ros2 run joint_state_publisher_gui joint_state_publisher_gui"], ["RV1", "ros2 run joint_state_publisher joint_state_publisher"]]) it(`${lesson}: ${cmd}`, () => {
    const real = realLines(realStep(lesson, 1, cmd));
    const { out } = runSolutions(lesson, 1);
    expect(out.get(cmd).filter((l) => /^\[(INFO|WARN|ERROR)\]/.test(l))).toEqual(real);
  });
  it("XT7: launch output of joint_state_publisher_gui (after the CMakeLists fix)", () => {
    const cmd = "ros2 launch my_robot_description display.launch.py", jsp = (l) => /^\[joint_state_publisher/.test(l);
    const real = fixture("XT7", 1).steps.filter((x) => x.kind === "cmd" && x.cmd === cmd).pop().out.split(/\r?\n/).filter(jsp)
      .map((l) => l.replace(/ \[\d+\.\d+\] /, " "));
    expect(real.length).toBeGreaterThan(3);
    const { out } = runSolutions("XT7", 1);
    expect(out.get(cmd).filter(jsp).map((l) => l.replace(/ \[\d+\.\d+\] /, " "))).toEqual(real.slice(0, 4));
  });
});
