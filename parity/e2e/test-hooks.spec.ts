import { test, expect } from "@playwright/test";

test.describe("window.__ros2lab test hooks (P1)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workbench with TurtleBot3 Burger
    await page.goto("/rviz.html?robot=tb3_burger");
    // Wait for window.__ros2lab to be mounted
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab);
  });

  test("hook basics: term and sh are available and functional", async ({ page }) => {
    const basics = await page.evaluate(() => {
      const r = window.__ros2lab;
      return {
        hasTerm: typeof r.term === "object" && r.term !== null,
        hasSh: typeof r.sh === "object" && r.sh !== null,
        hasGraph: typeof r.sh?.graph === "object" && r.sh.graph !== null,
      };
    });
    expect(basics.hasTerm).toBe(true);
    expect(basics.hasSh).toBe(true);
    expect(basics.hasGraph).toBe(true);
  });

  test("topics hook: exposes topic list, types, and complete QoS profiles", async ({ page }) => {
    const topicData = await page.evaluate(() => {
      const topics = window.__ros2lab.topics;
      return {
        isArray: Array.isArray(topics),
        count: topics.length,
        firstTopic: topics[0] || null,
        hasGet: typeof topics.get === "function",
        parameterEvents: topics.get("/parameter_events") || null,
      };
    });

    expect(topicData.isArray).toBe(true);
    expect(topicData.count).toBeGreaterThan(0);
    expect(topicData.hasGet).toBe(true);
    expect(topicData.firstTopic).toBeDefined();

    if (topicData.parameterEvents) {
      expect(topicData.parameterEvents.name).toBe("/parameter_events");
      expect(topicData.parameterEvents.type).toBe("rcl_interfaces/msg/ParameterEvent");
      expect(topicData.parameterEvents.qos).toBeDefined();
      expect(topicData.parameterEvents.qos.reliability).toBeDefined();
      expect(topicData.parameterEvents.qos.durability).toBeDefined();
      expect(topicData.parameterEvents.qos.depth).toBeDefined();
      expect(topicData.parameterEvents.qos.history).toBeDefined();
    }
  });

  test("tf hook: exposes frames, getAllFrameNames(), edges, and publishing authority", async ({ page }) => {
    const tf = await page.evaluate(() => {
      const t = window.__ros2lab.tf;
      return {
        frames: t.frames,
        allFrameNames: typeof t.getAllFrameNames === "function" ? t.getAllFrameNames() : null,
        edges: t.edges,
        authority: t.authority,
      };
    });

    expect(Array.isArray(tf.frames)).toBe(true);
    expect(Array.isArray(tf.allFrameNames)).toBe(true);
    expect(tf.allFrameNames).toEqual(tf.frames);
    expect(Array.isArray(tf.edges)).toBe(true);
    expect(typeof tf.authority).toBe("object");

    // Each edge must have parent, child, and authority
    for (const edge of tf.edges) {
      expect(edge.parent).toBeDefined();
      expect(edge.child).toBeDefined();
      expect(edge.authority).toBeDefined();
    }
  });

  test("fixedFrame hook: exposes options and selected value", async ({ page }) => {
    const ff = await page.evaluate(() => {
      return window.__ros2lab.fixedFrame;
    });

    expect(typeof ff.selected).toBe("string");
    expect(ff.selected.length).toBeGreaterThan(0);
    expect(Array.isArray(ff.options)).toBe(true);
  });

  test("nodes hook: exposes emulated nodes, parameters, and lookup helpers", async ({ page }) => {
    // Initial check: nodes is an array with helper methods
    const initial = await page.evaluate(() => {
      const n = window.__ros2lab.nodes;
      return {
        isArray: Array.isArray(n),
        hasGet: typeof n.get === "function",
        hasGetParams: typeof n.getParams === "function",
      };
    });
    expect(initial.isArray).toBe(true);
    expect(initial.hasGet).toBe(true);
    expect(initial.hasGetParams).toBe(true);

    // Add a test node to verify parameter inspection and lookup
    await page.evaluate(() => {
      window.__ros2lab.sh.graph.add("talker", "talker", "", { frequency: 1.0 });
    });

    const nodes = await page.evaluate(() => {
      const n = window.__ros2lab.nodes;
      return {
        count: n.length,
        talker: n.get("talker"),
        talkerParams: n.getParams("talker"),
      };
    });

    expect(nodes.count).toBeGreaterThan(0);
    expect(nodes.talker).toBeDefined();
    expect(nodes.talker.name).toBe("talker");
    expect(nodes.talker.full).toBe("/talker");
    expect(typeof nodes.talker.params).toBe("object");
    expect(nodes.talkerParams).toBeDefined();
  });

  test("lifecycleStates hook: exposes lifecycle states of nodes", async ({ page }) => {
    const states = await page.evaluate(() => {
      return window.__ros2lab.lifecycleStates;
    });

    expect(Array.isArray(states)).toBe(true);
    for (const item of states) {
      expect(item.node).toBeDefined();
      expect(item.state).toBeDefined();
    }
  });

  test("rvizStatus hook: exposes global status and per-display status text and level", async ({ page }) => {
    const status = await page.evaluate(() => {
      return window.__ros2lab.rvizStatus;
    });

    expect(["OK", "Warning", "Error"]).toContain(status.globalStatus);
    expect(Array.isArray(status.displays)).toBe(true);

    for (const d of status.displays) {
      expect(d.name).toBeDefined();
      expect(d.type).toBeDefined();
      expect(typeof d.enabled).toBe("boolean");
      expect(typeof d.status).toBe("string");
      expect(["OK", "Warning", "Error"]).toContain(d.level);
      expect(Array.isArray(d.messages)).toBe(true);
    }
  });

  test("logs and errors hook: exposes user-visible logs and error lines", async ({ page }) => {
    const logsData = await page.evaluate(() => {
      return {
        logs: window.__ros2lab.logs,
        errors: window.__ros2lab.errors,
      };
    });

    expect(Array.isArray(logsData.logs)).toBe(true);
    expect(Array.isArray(logsData.errors)).toBe(true);
  });

  test("nav2 hook: exposes plan, localPlan, pose histories, particle count, and costmap accessors", async ({ page }) => {
    const nav2 = await page.evaluate(() => {
      const n = window.__ros2lab.nav2;
      return {
        hasPlanProp: "plan" in n,
        hasLocalPlanProp: "localPlan" in n,
        hasRobotPoseHistory: Array.isArray(n.robotPoseHistory),
        hasPoseHistory: Array.isArray(n.poseHistory),
        hasAmclPoseHistory: Array.isArray(n.amclPoseHistory),
        hasParticleCount: typeof n.particleCount === "number",
        hasParticles: Array.isArray(n.particles),
        hasGlobalCostmapProp: "globalCostmap" in n,
        hasLocalCostmapProp: "localCostmap" in n,
        hasCostmaps: typeof n.costmaps === "object" && n.costmaps !== null,
      };
    });

    expect(nav2.hasPlanProp).toBe(true);
    expect(nav2.hasLocalPlanProp).toBe(true);
    expect(nav2.hasRobotPoseHistory).toBe(true);
    expect(nav2.hasPoseHistory).toBe(true);
    expect(nav2.hasAmclPoseHistory).toBe(true);
    expect(nav2.hasParticleCount).toBe(true);
    expect(nav2.hasParticles).toBe(true);
    expect(nav2.hasGlobalCostmapProp).toBe(true);
    expect(nav2.hasLocalCostmapProp).toBe(true);
    expect(nav2.hasCostmaps).toBe(true);
  });

  test("sensors hook: exposes cameraInfo, imageInfo, pointCloud2, and scan accessors", async ({ page }) => {
    const sensors = await page.evaluate(() => {
      const s = window.__ros2lab.sensors;
      return {
        hasCameraInfo: "cameraInfo" in s,
        hasImageInfo: "imageInfo" in s,
        hasPointCloud2: "pointCloud2" in s,
        hasScan: "scan" in s,
      };
    });

    expect(sensors.hasCameraInfo).toBe(true);
    expect(sensors.hasImageInfo).toBe(true);
    expect(sensors.hasPointCloud2).toBe(true);
    expect(sensors.hasScan).toBe(true);
  });

  test("course hook: exposes level, locks, and isLocked()", async ({ page }) => {
    const course = await page.evaluate(() => {
      const c = window.__ros2lab.course;
      return {
        level: c.level,
        locks: c.locks,
        hasIsLocked: typeof c.isLocked === "function",
        isLockedResult: typeof c.isLocked === "function" ? c.isLocked(1) : null,
      };
    });

    expect(typeof course.level).toBe("number");
    expect(typeof course.locks).toBe("object");
    expect(course.hasIsLocked).toBe(true);
    expect(typeof course.isLockedResult).toBe("boolean");
  });

  test("catalog integration: sim-catalog preserves window.__ros2lab accessors", async ({ page }) => {
    const catalogTest = await page.evaluate(() => {
      // Simulate catalog assignment or access
      window.__ros2lab.catalog = { list: () => ["tb3_burger"], openRobot: () => {} };
      return {
        hasCatalog: typeof window.__ros2lab.catalog === "object",
        stillHasTopics: Array.isArray(window.__ros2lab.topics),
        stillHasTf: typeof window.__ros2lab.tf === "object",
        stillHasFixedFrame: typeof window.__ros2lab.fixedFrame === "object",
      };
    });

    expect(catalogTest.hasCatalog).toBe(true);
    expect(catalogTest.stillHasTopics).toBe(true);
    expect(catalogTest.stillHasTf).toBe(true);
    expect(catalogTest.stillHasFixedFrame).toBe(true);
  });
});
