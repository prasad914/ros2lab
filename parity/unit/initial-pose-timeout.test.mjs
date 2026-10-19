// Phase 1 item 7: global_costmap's initial_transform_timeout counts sim time, like real Nav2: in the readiness
// deadlock capture the bring-up aborted ~57.6 s of sim time (rviz2 stamps 9.000 -> 66.593) but ~98 s of wall time
// after "Activating planner_server" (nav_robotis/readiness_deadlock_2026-10-17/excerpt.txt). The "Timed out waiting
// for transform" lines come at 2 Hz wall (197 lines in that run). While it waits, ROS2Lab says every 10 s of sim time
// to set the pose.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { startNav2Node } from "../../public/js/nav2-sim.js";

const FIX = new URL("../fixtures/", import.meta.url).pathname;
const file = `${FIX}_installed/turtlebot3_navigation2/param/burger.yaml`;
const graph = () => { const nodes = []; return { nodes, nav2NoTimer: true, gz: { time: 0 }, add(kind, name, ns, params) { const n = { kind, name, ns, full: `/${name}`, params: params || {} }; nodes.push(n); return n; }, node(f) { return nodes.find((n) => n.full === f); }, stop() {} }; };
const start = (G, pkg, exe, out) => startNav2Node(G, { pkg, exe, name: exe, ns: "", params: {}, parameter_files: { [file]: readFileSync(file, "utf8") }, remaps: [], args: [], pid: 1, write: (t, s) => out.push([String(t), s]), exit: () => {} });

afterEach(() => vi.useRealTimers());
describe("global_costmap initial_transform_timeout on sim time", () => {
  it("waits 60 s of sim time, not of wall time, and repeats the set-the-pose note every 10 s of sim time", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    const G = graph(), out = [];
    start(G, "nav2_amcl", "amcl", out);
    const ps = start(G, "nav2_planner", "planner_server", out);
    expect(ps.transition("configure")).toBe(true);
    const cm = ps.costmap;
    G.gz.time = 9.0;
    expect(cm.onActivate()).toBe("pending");
    // the simulation runs at half speed: 100 s of wall time are only 50 s of sim time
    for (let i = 1; i <= 200; i++) { vi.advanceTimersByTime(500); G.gz.time = 9.0 + i * 0.25; expect(cm.onActivate()).toBe("pending"); }
    G.gz.time = 9.0 + 60.5;
    expect(cm.onActivate()).toBe(false);
    const text = out.map(([t]) => t).join("");
    expect(text).toContain("[global_costmap.global_costmap]: Failed to activate global_costmap because transform from base_link to map did not become available before timeout");
    expect((text.match(/Timed out waiting for transform from base_link to map/g) || []).length).toBe(201);   // 2 Hz wall
    const notes = out.filter(([t, s]) => s === "hint");
    expect(notes).toHaveLength(6);   // sim 9, 19, 29, 39, 49, 59; none with the abort
    expect(notes[0][0]).toMatch(/^\(ROS2Lab: .*2D Pose Estimate.*60 s of simulation time \(60 s left\)\.\)$/m);
    expect(notes[5][0]).toContain("(10 s left)");
  });
});
