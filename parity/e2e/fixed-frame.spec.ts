import { test, expect } from "@playwright/test";

test.describe("RViz Fixed Frame Parity (Spec S3, Prompt P3)", () => {
  test("combobox exists, has data-testid, aria attributes, is enabled and not covered by overlay", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    // Start RViz
    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    // Locate Fixed Frame combobox
    const combobox = page.locator('[data-testid="fixed-frame"]');
    await expect(combobox).toBeVisible({ timeout: 5000 });

    // Verify ARIA combobox role or attribute
    const role = await combobox.getAttribute("role");
    const ariaAutocomplete = await combobox.getAttribute("aria-autocomplete");
    expect(role === "combobox" || ariaAutocomplete === "list").toBe(true);

    // Verify control is enabled and interactive
    const isInteractive = await combobox.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const disabled = (el as HTMLInputElement).disabled || el.hasAttribute("disabled");
      const readOnly = (el as HTMLInputElement).readOnly || el.hasAttribute("readonly");
      const pointerEvents = style.pointerEvents;
      return !disabled && !readOnly && pointerEvents !== "none";
    });
    expect(isInteractive).toBe(true);

    // Verify control is not covered by an overlay
    const notCovered = await combobox.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      return topEl ? (el === topEl || el.contains(topEl) || topEl.contains(el)) : false;
    });
    expect(notCovered).toBe(true);
  });

  test("options per robot: tb3_burger has robot frames, no camera frames, and map only after SLAM/AMCL", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.tf);

    // Start RViz
    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const ff = await page.evaluate(() => window.__ros2lab.fixedFrame);
    const options = ff.options || [];

    // Core frames from URDF and robot state
    expect(options).toContain("base_link");
    expect(options).toContain("base_footprint");
    expect(options).toContain("base_scan");
    expect(options).toContain("imu_link");
    expect(options).toContain("odom");

    // tb3_burger has NO camera frames (Spec S9)
    const cameraFrames = options.filter((f: string) => f.includes("camera"));
    expect(cameraFrames).toHaveLength(0);

    // map frame must NOT be in options before SLAM or AMCL (Spec S2)
    expect(options).not.toContain("map");

    // Now simulate AMCL / SLAM publishing map -> odom
    await page.evaluate(() => {
      if (window.__ros2lab.tfRegistry) {
        window.__ros2lab.tfRegistry.setTransform("map", "odom", [0, 0, 0], [0, 0, 0, 1], 0, false, "amcl");
      } else if (window.__ros2lab.sh?.graph?.tf) {
        window.__ros2lab.sh.graph.tf.setTransform("map", "odom", [0, 0, 0], [0, 0, 0, 1]);
      }
    });
    await page.waitForTimeout(500);

    const updatedFf = await page.evaluate(() => window.__ros2lab.fixedFrame);
    expect(updatedFf.options).toContain("map");
  });

  test("options per robot: tb3_waffle includes camera frames", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_waffle");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.tf);

    // Start RViz
    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const ff = await page.evaluate(() => window.__ros2lab.fixedFrame);
    const options = ff.options || [];

    // Core frames
    expect(options).toContain("base_link");
    expect(options).toContain("base_footprint");
    expect(options).toContain("base_scan");
    expect(options).toContain("imu_link");

    // Camera frames must exist on waffle (Spec S9)
    const cameraFrames = options.filter((f: string) => f.includes("camera"));
    expect(cameraFrames.length).toBeGreaterThan(0);
  });

  test("selection works: selecting odom updates fixedFrame and config", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const combobox = page.locator('[data-testid="fixed-frame"]');
    await expect(combobox).toBeVisible({ timeout: 5000 });

    // Select odom
    await combobox.fill("odom");
    await combobox.press("Enter");
    await page.waitForTimeout(300);

    const selected = await page.evaluate(() => window.__ros2lab.fixedFrame.selected);
    expect(selected).toBe("odom");
  });

  test("free text works: typing custom_frame commits new fixed frame", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const combobox = page.locator('[data-testid="fixed-frame"]');
    await expect(combobox).toBeVisible({ timeout: 5000 });

    // Type arbitrary custom frame
    await combobox.fill("custom_frame");
    await combobox.press("Enter");
    await page.waitForTimeout(300);

    const selected = await page.evaluate(() => window.__ros2lab.fixedFrame.selected);
    expect(selected).toBe("custom_frame");
  });

  test("unknown frame shows Global Status error text from fixture", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const combobox = page.locator('[data-testid="fixed-frame"]');
    await expect(combobox).toBeVisible({ timeout: 5000 });

    // Set unknown frame
    await combobox.fill("nonexistent_frame");
    await combobox.press("Enter");
    await page.waitForTimeout(500);

    const status = await page.evaluate(() => window.__ros2lab.rvizStatus);
    expect(["Error", "Warning"]).toContain(status.globalStatus);

    // Exact fixture error pattern from ROS 2 Jazzy
    const hasExpectedError = status.displays.some((d: any) =>
      d.messages.some((m: string) => /Frame \[nonexistent_frame\] does not exist|Fixed Frame \[nonexistent_frame\] does not exist/.test(m))
    ) || /Frame \[nonexistent_frame\] does not exist|Fixed Frame \[nonexistent_frame\] does not exist/.test(status.globalStatus);

    const domError = await page.evaluate(() => {
      const gsRow = document.querySelector('.q-row[data-path="gs/Fixed Frame"]');
      return gsRow ? gsRow.textContent : "";
    });

    expect(
      hasExpectedError || /Frame \[nonexistent_frame\] does not exist|Fixed Frame \[nonexistent_frame\] does not exist/.test(domError || "")
    ).toBe(true);
  });

  test("selection persists across page reload via localStorage", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const combobox = page.locator('[data-testid="fixed-frame"]');
    await expect(combobox).toBeVisible({ timeout: 5000 });

    await combobox.fill("base_link");
    await combobox.press("Enter");
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => window.__ros2lab.fixedFrame.selected)).toBe("base_link");

    // Reload page
    await page.reload();
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const reloadedCombobox = page.locator('[data-testid="fixed-frame"]');
    await expect(reloadedCombobox).toBeVisible({ timeout: 5000 });

    const persistedSelected = await page.evaluate(() => window.__ros2lab.fixedFrame.selected);
    expect(persistedSelected).toBe("base_link");
  });

  test("late-joining RViz still sees static transforms (transient-local replay)", async ({ page }) => {
    await page.goto("/rviz.html?robot=tb3_burger");
    await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.tf);

    // Publish a static transform BEFORE rviz2 node starts
    await page.evaluate(() => {
      if (window.__ros2lab.tfRegistry) {
        window.__ros2lab.tfRegistry.setTransform("base_link", "late_static_sensor", [0.1, 0, 0.2], [0, 0, 0, 1], 0, true, "sensor_pub");
      } else if (window.__ros2lab.sh?.graph?.tf) {
        window.__ros2lab.sh.graph.tf.setTransform("base_link", "late_static_sensor", [0.1, 0, 0.2], [0, 0, 0, 1], 0, true, "sensor_pub");
      }
    });

    // Now start RViz (late subscriber)
    await page.evaluate(() => {
      window.__ros2lab.term.run("ros2 run rviz2 rviz2");
    });
    await page.waitForTimeout(1000);

    const options = await page.evaluate(() => window.__ros2lab.fixedFrame.options);
    expect(options).toContain("late_static_sensor");
  });
});
