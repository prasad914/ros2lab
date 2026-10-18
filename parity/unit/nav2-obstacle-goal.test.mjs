// expert_review_2026-10-18 must-fix 4: a goal on or next to an obstacle. Real Nav2 (NavFn, tolerance 0.5) plans to the
// nearest free cell within the tolerance and the goal SUCCEEDS (error_code 0); the site returned 208 before searching.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as C from "../../public/js/nav2-core.js";

const FIX = new URL("../fixtures/", import.meta.url).pathname;
const P = C.parseYaml(readFileSync(`${FIX}_installed/turtlebot3_navigation2/param/burger.yaml`, "utf8"));
const gc = P.global_costmap.global_costmap.ros__parameters, pp = P.planner_server.ros__parameters.GridBased;
const yamlPath = `${FIX}maps/turtlebot3_world.yaml`;
const { grid } = C.loadMap(readFileSync(yamlPath, "utf8"), yamlPath, (p) => new Uint8Array(readFileSync(p)));
const g = C.inflate(C.staticFromGrid(grid, gc.track_unknown_space), gc.robot_radius, gc.inflation_layer.inflation_radius, gc.inflation_layer.cost_scaling_factor);
const result = (dir) => JSON.parse(readFileSync(`${FIX}tb3_burger/nav_robotis/${dir}/result.json`, "utf8"));

describe("NavFn goal on an obstacle (tb3_burger nav_robotis fixtures)", () => {
  for (const dir of ["session_obstacle_goal/goal_obstacle_goal", "session_failure_cases/goal_cylinder_centre"]) {
    const R = result(dir), goal = { x: R.goal_yaml.position.x, y: R.goal_yaml.position.y, yaw: 0 };
    it(`${R.goal_name} (${goal.x}, ${goal.y}): real ${R.status_name} ${R.result.error_code} -> the planner finds a path within ${pp.tolerance} m`, () => {
      expect(R.status_name).toBe("SUCCEEDED");
      expect(g.at(goal.x, goal.y)).toBeGreaterThanOrEqual(C.INSCRIBED);   // the goal cell itself is not passable
      // start: "Begin navigating from current location (0.05, 0.00)" (session_obstacle_goal nav2_goal_lines.txt:362)
      const r = C.planPath(g, { x: 0.05, y: 0.0 }, goal, { kind: "navfn", astar: pp.use_astar, tolerance: pp.tolerance, allowUnknown: pp.allow_unknown });
      expect(r.code).toBeUndefined();
      const end = r.path[r.path.length - 1];
      expect(Math.hypot(end[0] - goal.x, end[1] - goal.y)).toBeLessThanOrEqual(pp.tolerance);
      expect(g.at(end[0], end[1])).toBeLessThan(C.INSCRIBED);
    });
  }
  it("a goal with no free cell within the tolerance fails with the real text", () => {
    const tiny = new C.Grid(40, 40, 0.05, 0, 0, C.LETHAL);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) tiny.data[y * 40 + x] = C.FREE;
    const r = C.planPath(tiny, { x: 0.1, y: 0.1 }, { x: 1.8, y: 1.8, yaw: 0 }, { kind: "navfn", tolerance: 0.5 });
    expect(r.code).toBe(208);
    // planner_failure_lines.txt: GridBased plugin failed to plan from (..) to (..): "Failed to create plan with tolerance of: 0.500000"
    expect(r.message).toBe("Failed to create plan with tolerance of: 0.500000");
  });
});
