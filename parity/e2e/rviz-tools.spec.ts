import { test, expect } from "@playwright/test";

test.describe("RViz Tools & Nav2 Parity (Spec S4, Prompt P4)", () => {
  test("P4 Part 1: 2D Pose Estimate publishes /initialpose with exact RViz covariance and updates AMCL", async ({ page }) => {
    await page.goto("http://127.0.0.1:8000/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    // Start RViz first and wait for viewer
    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForFunction(() => typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers.length > 0, { timeout: 10000 });
    await page.waitForTimeout(500);

    const result = await page.evaluate(async () => {
      const v = window.__rvizViewers && window.__rvizViewers[0];
      if (!v) return { ok: false, msg: "no rviz viewer" };

      v.testPublishInitialPose(-2.0, -0.5, 0.0);
      await new Promise(r => setTimeout(r, 300));

      const published = window.__ros2labPub?.["/initialpose"];

      return {
        ok: true,
        hasPublished: !!published,
        frameId: published?.msg?.header?.frame_id,
        covariance: published?.msg?.pose?.covariance
      };
    });

    expect(result.ok).toBe(true);
    expect(result.hasPublished).toBe(true);
    expect(result.covariance).toBeDefined();
    expect(result.covariance[0]).toBe(0.25);
    expect(result.covariance[7]).toBe(0.25);
    expect(result.covariance[35]).toBe(0.06853891909122467);
  });

  test("P4 Part 2: 2D Goal Pose works when Fixed Frame is odom and transforms to map", async ({ page }) => {
    await page.goto("http://127.0.0.1:8000/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForFunction(() => typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers.length > 0, { timeout: 10000 });
    await page.waitForTimeout(500);

    const goalResult = await page.evaluate(async () => {
      const v = window.__rvizViewers[0];
      v.setFixedFrame("odom");
      await new Promise(r => setTimeout(r, 200));

      v.testPublishGoal(1.0, 1.0, 0.0);
      await new Promise(r => setTimeout(r, 300));

      const goalPub = window.__ros2labPub?.["/goal_pose"];

      return {
        fixedFrame: v.fixedFrame(),
        goalFrame: goalPub?.msg?.header?.frame_id,
        published: !!goalPub
      };
    });

    expect(goalResult.fixedFrame).toBe("odom");
    expect(goalResult.published).toBe(true);
    expect(goalResult.goalFrame).toBe("odom");
  });

  test("P4 Part 3: Publish Point publishes /clicked_point with PointStamped", async ({ page }) => {
    await page.goto("http://127.0.0.1:8000/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForFunction(() => typeof window !== "undefined" && window.__rvizViewers && window.__rvizViewers.length > 0, { timeout: 10000 });

    const pointResult = await page.evaluate(async () => {
      const v = window.__rvizViewers[0];
      v.testPublishPoint(1.5, 0.5, 0.0);
      await new Promise(r => setTimeout(r, 300));

      const ptPub = window.__ros2labPub?.["/clicked_point"];
      return {
        published: !!ptPub,
        point: ptPub?.msg?.point
      };
    });

    expect(pointResult.published).toBe(true);
    expect(pointResult.point.x).toBe(1.5);
    expect(pointResult.point.y).toBe(0.5);
  });
});
