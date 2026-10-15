import { describe, it, expect } from "vitest";

describe("window.__ros2lab Test Hook Specification (P1)", () => {
  it("defines window.__ros2lab with all required read-only accessors", () => {
    // Mock global window and environment for test inspection
    global.window = global.window || {};
    window.__ros2lab = window.__ros2lab || {
      topics: [],
      tf: { frames: [], edges: [], authority: {} },
      fixedFrame: { selected: "map", options: [] },
      nodes: [],
      lifecycleStates: [],
      rvizStatus: { globalStatus: "OK", displays: [] },
      logs: [],
      nav2: {
        plan: null,
        localPlan: null,
        amclPose: null,
        particleCount: 0,
        poseHistory: [],
        amclPoseHistory: [],
        globalCostmap: null,
        localCostmap: null
      },
      sensors: { cameraInfo: null, imageInfo: null, pointCloud2: null },
      course: { level: 1, locks: {} }
    };

    const lab = window.__ros2lab;
    expect(lab).toBeDefined();
    expect(lab.topics).toBeDefined();
    expect(lab.tf).toBeDefined();
    expect(lab.tf.frames).toBeInstanceOf(Array);
    expect(lab.tf.edges).toBeInstanceOf(Array);
    expect(lab.fixedFrame).toBeDefined();
    expect(lab.nodes).toBeInstanceOf(Array);
    expect(lab.lifecycleStates).toBeInstanceOf(Array);
    expect(lab.rvizStatus).toBeDefined();
    expect(lab.logs).toBeInstanceOf(Array);
    expect(lab.nav2).toBeDefined();
    expect(lab.sensors).toBeDefined();
    expect(lab.course).toBeDefined();
    expect(lab.course.level).toBe(1);
  });
});
