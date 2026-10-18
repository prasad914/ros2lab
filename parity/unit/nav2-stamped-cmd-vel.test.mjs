// expert_review_robots_2026-10-18 TB4 #4 / A5: Nav2 Jazzy's enable_stamped_cmd_vel defaults to false
// (nav2_util twist_publisher.hpp). The cmd_vel type of every Nav2 server comes from the loaded params file:
// turtlebot3_navigation2 burger.yaml sets it true (TwistStamped, tb3_burger/nav_robotis/params/controller_server.yaml:97);
// nav2_bringup's nav2_params.yaml does not set it -> Boolean value is: False, plain Twist
// (tb3_burger/nav2_bringup/matrix/Smac2D_RotationShimRPP/cmd_vel_params.txt).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { startNav2Node } from "../../public/js/nav2-sim.js";

const FIX = new URL("../fixtures/", import.meta.url).pathname;
// the installed nav2_bringup params file, as the site ships it (public/ros/jazzy/share.zip)
const NAV2_PARAMS = execFileSync("unzip", ["-p", new URL("../../public/ros/jazzy/share.zip", import.meta.url).pathname, "share/nav2_bringup/params/nav2_params.yaml"], { encoding: "utf8" });
function graph() {
  const nodes = [];
  return { nodes, add(kind, name, ns, params, remaps) { const n = { kind, name, ns, full: `${ns ? "/" + ns : ""}/${name}`, params: params || {}, remaps }; nodes.push(n); return n; }, node(f) { return nodes.find((n) => n.full === f); }, stop() {} };
}
const types = (file, text = readFileSync(file, "utf8")) => {
  const g = graph(), out = {};
  for (const [pkg, exe] of [["nav2_controller", "controller_server"], ["nav2_behaviors", "behavior_server"], ["nav2_velocity_smoother", "velocity_smoother"], ["nav2_collision_monitor", "collision_monitor"]]) {
    const m = startNav2Node(g, { pkg, exe, name: exe, ns: "", params: {}, parameter_files: { [file]: text }, remaps: [], args: [], pid: 1, write: () => {}, exit: () => {} });
    const I = m.n.info; out[exe] = [...I.pubs, ...I.subs].filter(([t]) => /cmd_vel/.test(t)).map(([t, ty]) => `${t} ${ty}`);
    out[exe + ":param"] = m.n.params.enable_stamped_cmd_vel;
  }
  return out;
};
describe("Nav2 enable_stamped_cmd_vel from the loaded params file", () => {
  it("turtlebot3_navigation2 burger.yaml (enable_stamped_cmd_vel: true) -> TwistStamped", () => {
    const t = types(`${FIX}_installed/turtlebot3_navigation2/param/burger.yaml`);
    expect(t.controller_server).toContain("cmd_vel geometry_msgs/msg/TwistStamped");
    expect(t.velocity_smoother.every((x) => /TwistStamped$/.test(x))).toBe(true);
  });
  it("nav2_bringup nav2_params.yaml (no key) -> plain Twist, parameter false", () => {
    const t = types("/opt/ros/jazzy/share/nav2_bringup/params/nav2_params.yaml", NAV2_PARAMS);
    for (const k of ["controller_server", "behavior_server", "velocity_smoother", "collision_monitor"]) {
      expect(t[k].length).toBeGreaterThan(0);
      expect(t[k].every((x) => / geometry_msgs\/msg\/Twist$/.test(x))).toBe(true);
    }
    expect(t["controller_server:param"]).toBe(false);
  });
});
