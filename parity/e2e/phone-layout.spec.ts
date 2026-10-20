import { test, expect, Page } from "@playwright/test";

// Phase 1 item 6: phone (375 × 812). No horizontal overflow on playground / resources, the sticky site header does not
// cover a terminal's title bar when the page scrolls the terminal into view, tap targets ≥ 44 px (split, tab, Log in).
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const size = (p: Page, sel: string) => p.locator(sel).first().evaluate((e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height }; });
const headerBottom = (p: Page) => p.evaluate(() => document.querySelector("header.top")!.getBoundingClientRect().bottom);

for (const page of ["playground.html", "resources.html"]) {
  test(`${page}: no horizontal overflow, Log in ≥ 44 px`, async ({ page: p }) => {
    await p.goto(`/${page}`);
    await p.waitForTimeout(1500);
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const login = await size(p, "#who a[href='signin.html']");
    expect(login.w).toBeGreaterThanOrEqual(44);
    expect(login.h).toBeGreaterThanOrEqual(44);
  });
}

test("rviz page: terminal title below the sticky header, split / tab / Log in ≥ 44 px", async ({ page: p }) => {
  await p.goto("/rviz.html?robot=tb3_burger");
  await p.waitForFunction(() => !!(window as any).__ros2lab?.term);
  await p.waitForTimeout(1000);
  for (const sel of ["#who a[href='signin.html']", "button[aria-label^='Split vertically']", "button[aria-label^='Split horizontally']", "button[aria-label='Open a new Terminator tab']"]) {
    const s = await size(p, sel);
    expect(s.w, sel).toBeGreaterThanOrEqual(44);
    expect(s.h, sel).toBeGreaterThanOrEqual(44);
  }
  // what the page does when a command starts (rviz-page.js) and what a student's tap on a link to #term does
  await p.evaluate(() => document.querySelector("#term .term-title")!.closest(".term")!.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(300);
  const title = await p.evaluate(() => document.querySelector("#term .term-title")!.getBoundingClientRect().top);
  expect(title).toBeGreaterThanOrEqual(await headerBottom(p));
});

test("playground: opening a game scrolls its title bar below the sticky header", async ({ page: p }) => {
  // a student taps a game on the loaded page (fonts loaded: the header has its final height)
  await p.goto("/playground.html");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.evaluate(() => { location.hash = "#paths"; });
  await p.waitForSelector(".pg-stage .pf-term", { timeout: 20000 });
  await p.waitForTimeout(2500);   // playground.js scrolls the game's bar (.pg-meta) to the top, smoothly
  const meta = await p.evaluate(() => document.querySelector(".pg-meta")!.getBoundingClientRect().top);
  expect(meta).toBeGreaterThanOrEqual(await headerBottom(p));
});
