import { test, expect, Page } from "@playwright/test";

// expert_review_robots_2026-10-18 site-wide #2 / #3 and expert_review_2026-10-18 should-fix "RViz pages":
// a robot without a passing fixture suite (public/js/games/fixture-status.js) says "Not yet validated against real
// ROS 2" on its card, launch buttons and real-hardware buttons; TB3 labels only the items without fixtures;
// workspace.json's honesty text is on the card; ROS2Lab-generated packages say so on the card.
const UNVAL = "Not yet validated against real ROS 2";
async function open(page: Page, robot: string) {
  await page.goto(`/rviz.html?robot=${robot}`);
  await page.waitForFunction(() => (window as any).__ros2lab?.term, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector("#robot-card [data-badges]") !== null, null, { timeout: 60000 });
}
const buttons = (p: Page, sel: string) => p.$$eval(`${sel} button`, (bs) => bs.map((b) => (b as HTMLElement).innerText.replace(/\s+/g, " ")));
for (const robot of ["ur5e", "scout", "crazyflie", "fr3"]) {
  test(`${robot}: card, launch and real-hardware buttons say "${UNVAL}"; honesty text on the card`, async ({ page }) => {
    await open(page, robot);
    await page.waitForFunction(() => document.querySelectorAll("#real-entries button").length > 0, null, { timeout: 60000 });
    expect(await page.locator("#robot-card").innerText()).toContain(UNVAL);
    for (const b of [...(await buttons(page, "#real-entries")), ...(await buttons(page, "#real-hw"))]) expect(b).toContain(UNVAL);
    const honesty: string = await page.evaluate(() => (window as any).__ros2lab.sh.realWs.json.honesty);
    expect(honesty.length).toBeGreaterThan(40);
    expect((await page.locator("#real-card").innerText()).replace(/\s+/g, " ")).toContain(honesty.replace(/\s+/g, " ").slice(0, 120));
  });
}
test("tb3_burger: no robot-level label; only the items without fixtures are labelled", async ({ page }) => {
  await open(page, "tb3_burger");
  await page.waitForFunction(() => document.querySelectorAll("#real-entries button").length > 0, null, { timeout: 60000 });
  expect(await page.locator("#robot-card").innerText()).not.toContain(UNVAL);
  const all = [...(await buttons(page, "#real-entries")), ...(await buttons(page, "#real-hw"))];
  const labelled = (re: RegExp) => all.filter((b) => re.test(b)).map((b) => b.includes(UNVAL));
  for (const re of [/empty_world\.launch\.py/, /turtlebot3_house\.launch\.py/, /rviz2\.launch\.py/, /turtlebot3_fake_node/, /robot\.launch\.py/]) expect(labelled(re)).toEqual([true]);
  for (const re of [/turtlebot3_world\.launch\.py/, /cartographer\.launch\.py/, /map_saver_cli/, /teleop_keyboard/]) expect(labelled(re)).toEqual([false]);
  expect(labelled(/navigation2\.launch\.py/)).toEqual([false, false]);
});
for (const robot of ["so101", "magician", "go2", "arm6"]) {
  test(`${robot}: ROS2Lab-made config label and "${UNVAL}" on the card`, async ({ page }) => {
    await open(page, robot);
    const t = await page.locator("#robot-card").innerText();
    expect(t).toContain("ROS2Lab-made config – not from the maker");
    expect(t).toContain(UNVAL);
  });
}
test("ur5e (maker's workspace): no ROS2Lab-made label", async ({ page }) => {
  await open(page, "ur5e");
  expect(await page.locator("#robot-card").innerText()).not.toContain("ROS2Lab-made config");
});
