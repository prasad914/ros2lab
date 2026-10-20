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
const realStep = (lesson, term, cmd) => {
  const s = fixture(lesson, term).steps.find((x) => x.kind === "cmd" && x.cmd === cmd);
  if (!s) throw new Error(`${lesson} term${term}: no real step "${cmd}"`);
  return s;
};
const realLines = (step) => String(step.out || "").split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^(\[\w+\]) \[\d+\.\d+\] /, "$1 "));
// runs every solution command of the block in one Shell (tabs share one Shell on the site), returns cmd -> lines
const runSolutions = (lesson, term, extra = []) => {
  const b = block(lesson, term), sh = new Shell(b), out = new Map();
  for (const c of b.tasks.flatMap((t) => [].concat(t.sol)).filter((c) => typeof c === "string").concat(extra)) {
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

