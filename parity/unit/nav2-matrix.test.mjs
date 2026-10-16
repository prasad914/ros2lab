import { describe, it, expect } from "vitest";
import * as C from "../../public/js/nav2-core.js";

describe("Nav2 Algorithm & Matrix Parity (Spec S4 / Prompt P4)", () => {
  // Construct a mock costmap grid: 100x100, resolution 0.05, origin [0,0]
  // Free space (value 254), obstacle at center [50, 50] (value 254 = LETHAL/INSCRIBED)
  const createMockGrid = () => {
    const W = 100, H = 100;
    const data = new Uint8Array(W * H).fill(0); // FREE space (0)
    // Draw an obstacle block in the middle
    for (let y = 45; y <= 55; y++) {
      for (let x = 45; x <= 55; x++) {
        data[y * W + x] = 254; // LETHAL
      }
    }
    return {
      w: W,
      h: H,
      res: 0.05,
      origin: [0, 0, 0],
      data,
      toMap(x, y) {
        const mx = Math.floor((x - 0) / 0.05);
        const my = Math.floor((y - 0) / 0.05);
        if (mx < 0 || my < 0 || mx >= W || my >= H) return null;
        return [mx, my];
      },
      toWorld(mx, my) {
        return [mx * 0.05 + 0.025, my * 0.05 + 0.025];
      }
    };
  };

  it("differentiates global planners (NavFn, Smac2D, ThetaStar) for the same start and goal", () => {
    const grid = createMockGrid();
    const start = { x: 0.1, y: 0.1, yaw: 0 };
    const goal = { x: 3.5, y: 3.5, yaw: 0 };

    const rNavfn = C.planPath(grid, start, goal, { kind: "navfn" });
    const rSmac = C.planPath(grid, start, goal, { kind: "smac" });
    const rTheta = C.planPath(grid, start, goal, { kind: "theta" });

    expect(rNavfn.path).toBeDefined();
    expect(rSmac.path).toBeDefined();
    expect(rTheta.path).toBeDefined();

    // ThetaStar any-angle should produce fewer or equal corner points / direct waypoints than grid A*
    expect(rTheta.path.length).toBeLessThanOrEqual(rSmac.path.length);
    // Paths must not be identical across different algorithms
    const navfnStr = JSON.stringify(rNavfn.path.slice(0, 5));
    const smacStr = JSON.stringify(rSmac.path.slice(0, 5));
    expect(navfnStr).not.toEqual(smacStr);
  });

  it("fails planning when goal is in lethal/inscribed obstacle cell, returning error code 208", () => {
    const grid = createMockGrid();
    const start = { x: 0.5, y: 0.5, yaw: 0 };
    // Obstacle is placed at grid cells [45..55, 45..55] -> world [2.25..2.75, 2.25..2.75]
    const obstacleGoal = { x: 2.5, y: 2.5, yaw: 0 };

    const res = C.planPath(grid, start, obstacleGoal, { kind: "navfn", tolerance: 0.0 });
    expect(res.code).toBe(208);
    expect(res.message).toContain("failed to create plan");
  });

  it("RotationShim controller commands pure rotation when heading error > threshold", () => {
    const P = { rotate_to_heading_min_angle: 0.785, rotate_to_heading_angular_vel: 1.0 };
    const st = {
      pose: { x: 0, y: 0, yaw: 0 },
      vel: { vx: 0, wz: 0 },
      dt: 0.1,
      goalPose: { x: 1, y: 1, yaw: Math.PI / 2 }, // heading error ~ 90 deg (1.57 rad > 0.785)
      xyTol: 0.25,
      latched: false,
      localPath: [[1, 1]]
    };

    const cmd = C.rotationShimCommand(P, st);
    expect(cmd.vx).toBe(0);
    expect(cmd.wz).toBeGreaterThan(0);
    expect(cmd.rotating).toBe(true);
  });
});
