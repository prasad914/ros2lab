// expert_review_2026-10-18 should-fix: `ros2 param get /slam_toolbox max_laser_range` printed "Integer value is: 20";
// the real dump (parity/fixtures/tb3_burger/slam/params/slam_toolbox.yaml) has max_laser_range: 20.0 and
// map_update_interval: 5.0 (doubles). A float written in a parameter file stays a double.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as C from "../../public/js/nav2-core.js";

const dump = readFileSync(new URL("../fixtures/tb3_burger/slam/params/slam_toolbox.yaml", import.meta.url), "utf8");

describe("parameter types from YAML files", () => {
  const D = C.doubleParams([dump], "slam_toolbox");
  it("floats written as 20.0 / 5.0 are doubles", () => {
    expect(D.has("max_laser_range")).toBe(true);
    expect(D.has("map_update_interval")).toBe(true);
    expect(D.has("coarse_angle_resolution")).toBe(true);
  });
  it("integers, strings and booleans are not", () => {
    for (const k of ["scan_buffer_size", "min_pass_through", "base_frame", "check_min_dist_and_heading_precisely"]) expect(D.has(k), k).toBe(false);
  });
  it("only the named node's ros__parameters count, nested keys are dotted", () => {
    const y = "other:\n  ros__parameters:\n    a: 1.0\nslam_toolbox:\n  ros__parameters:\n    b: 2\n    inner:\n      c: 3.5\n";
    expect([...C.doubleParams([y], "slam_toolbox")].sort()).toEqual(["inner.c"]);
    expect([...C.doubleParams(["/**:\n  ros__parameters:\n    d: 1.0\n"], "slam_toolbox")]).toEqual(["d"]);
  });
});
