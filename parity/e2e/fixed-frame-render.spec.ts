import { test, expect, Page } from "@playwright/test";

// The RViz Fixed Frame box must show one frame name (Phase 1 item 1). The Qt combo sprites behind the field were
// screenshots of real RViz with "base_link" / "Orbit (rviz_default_plugins)" in them, drawn under every value.
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
const ROBOTS = ["tb3_burger", "tb3_waffle", "ur5e", "fr3", "xarm6", "crazyflie"];

// dark (text) pixels inside the combo's sprite, outside its 4 px frame and its drop-down arrow
async function spriteTextPixels(page: Page, sel: string) {
  return page.evaluate(async (sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const src = getComputedStyle(el).borderImageSource.match(/url\("?([^")]+)"?\)/);
    if (!src) return -1;
    const img = new Image(); img.src = src[1]; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let n = 0;
    for (let y = 2; y < img.height - 2; y++) for (let x = 5; x < img.width - 22; x++) { const i = (y * img.width + x) * 4; if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] < 300) n++; }
    return n;
  }, sel);
}

for (const robot of ROBOTS) for (const width of [1400, 375]) {
  test(`fixed frame box shows one value: ${robot} at ${width} px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width < 600 ? 812 : 900 });
    await page.goto(`/rviz.html?robot=${robot}`);
    await page.waitForFunction(() => !!(window as any).__ros2lab?.term);
    await run(page, "ros2 run rviz2 rviz2");
    const field = page.locator('[data-testid="fixed-frame"]');
    await expect(field).toHaveCount(1, { timeout: 10000 });
    if (width < 600) await page.locator(".rviz .q-hide.l").click();   // a phone opens the hidden left dock
    await field.scrollIntoViewIfNeeded();
    await expect(field).toBeVisible();
    const row = page.locator('.q-row[data-path="g/Fixed Frame"]');
    await row.screenshot({ path: info.outputPath(`fixed-frame-${robot}-${width}.png`) });
    const dom = await field.evaluate((f: HTMLInputElement) => {
      const r = f.getBoundingClientRect(), row = f.closest(".q-row")!;
      const over = [...row.querySelectorAll("*")].filter((e) => e !== f && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
        .map((e) => e.getBoundingClientRect()).filter((b) => b.width && b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top);
      return { value: f.value, overlapping: over.length, combos: row.querySelectorAll(".q-ecombo").length };
    });
    expect(dom.value).not.toBe("");
    expect(dom.combos).toBe(1);
    expect(dom.overlapping).toBe(0);
    expect(await spriteTextPixels(page, '.q-row[data-path="g/Fixed Frame"] .q-ecombo')).toBe(0);
  });
}

test("enum combo sprite (View type) carries no text", async ({ page }) => {
  await page.goto("/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => !!(window as any).__ros2lab?.term);
  await run(page, "ros2 run rviz2 rviz2");
  await expect(page.locator('[data-testid="fixed-frame"]')).toHaveCount(1, { timeout: 10000 });
  await page.evaluate(() => { const e = document.createElement("span"); e.className = "q-ecombo enum"; e.id = "probe-enum"; document.querySelector(".rviz")!.append(e); });
  expect(await spriteTextPixels(page, "#probe-enum")).toBe(0);
});

test("no .rviz file: rviz2 starts on rviz_common/default.rviz's Fixed Frame (/map)", async ({ page }) => {
  await page.goto("/rviz.html?robot=ur5e");
  await page.waitForFunction(() => !!(window as any).__ros2lab?.term);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__ros2lab?.term);
  await run(page, "ros2 run rviz2 rviz2");
  await expect(page.locator('[data-testid="fixed-frame"]')).toHaveValue("map", { timeout: 10000 });
});
