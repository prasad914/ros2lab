// expert_review_2026-10-18 should-fix: collision_monitor setup log lines. Real (tb3_burger nav_robotis,
// navigation2.launch.py with burger.yaml): no "Creating" line after the lifecycle banner, then on configure the
// lines of nav_robotis/logs/nav2.log:275-282 in this order.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { startNav2Node } from "../../public/js/nav2-sim.js";

const FIX = new URL("../fixtures/", import.meta.url).pathname;
const real = readFileSync(`${FIX}tb3_burger/nav_robotis/logs/nav2.log`, "utf8").split("\n").slice(146, 282)
  .filter((l) => /\[collision_monitor\]: /.test(l)).map((l) => l.replace(/^.*\[collision_monitor\]: /, ""));
const graph = () => { const nodes = []; return { nodes, add(kind, name, ns, params) { const n = { kind, name, ns, full: `/${name}`, params: params || {} }; nodes.push(n); return n; }, node(f) { return nodes.find((n) => n.full === f); }, stop() {} }; };
describe("collision_monitor setup lines (burger.yaml)", () => {
  it("match nav2.log:147-282", () => {
    const out = [], file = `${FIX}_installed/turtlebot3_navigation2/param/burger.yaml`;
    const m = startNav2Node(graph(), { pkg: "nav2_collision_monitor", exe: "collision_monitor", name: "collision_monitor", ns: "", params: {}, parameter_files: { [file]: readFileSync(file, "utf8") }, remaps: [], args: [], pid: 1, write: (t) => out.push(String(t)), exit: () => {} });
    m.transition("configure");
    const got = out.flatMap((t) => t.split("\n")).filter((l) => /\[collision_monitor\]: /.test(l)).map((l) => l.replace(/^.*\[collision_monitor\]: /, ""));
    expect(real[0]).toBe("");   // the banner's first line
    expect(got.filter((l) => l !== "")).toEqual(real.filter((l) => l !== ""));
  });
});
