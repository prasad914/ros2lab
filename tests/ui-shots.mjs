// Viewport screenshots (not full page) of the main pages for the redesign reports, with the mock Firebase for the
// member pages (course.html, lesson IN3, test.html).
//   OUT=<dir> node tests/ui-shots.mjs [1440,390]      (site on localhost:8080; BASE=… to change; PAGES=index,terms to pick)
import { chromium } from "@playwright/test";
import { tmpdir } from "node:os";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:8080";
const OUT = process.env.OUT || path.join(tmpdir(), "ros2lab-shots");
const WIDTHS = (process.argv[2] || "1440,390").split(",").map(Number);
mkdirSync(OUT, { recursive: true });
const course = JSON.parse(readFileSync(path.join(root, "content/course-content.json"), "utf8").replace(/^﻿/, ""));
const LESSONS = {};
for (const m of course.modules) for (const l of m.lessons) LESSONS[l.id] = { ...l, moduleId: m.id };
const ALL = [
  ["index", "index.html"], ["courses", "courses.html"], ["plan", "plan.html"], ["rviz", "rviz.html"],
  ["course", "course.html", { mock: true, wait: ".dash-tabs button" }],
  ["lesson-IN3", "lesson.html?id=IN3", { mock: true, lessons: { IN3: LESSONS.IN3 }, wait: ".lesson-body .tmr-pane input" }],
  ["test", "test.html?id=testW1", { mock: true }],
  ["terms", "terms.html"],
];
const pick = process.env.PAGES ? process.env.PAGES.split(",") : null;
const browser = await chromium.launch();
for (const w of WIDTHS) for (const [name, url, o = {}] of ALL) {
  if (pick && !pick.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  if (o.mock) await ctx.route("**/js/fb.js", (r) => r.fulfill({ path: path.join(root, "tests/fixtures/mock-fb.js"), contentType: "text/javascript" }));
  if (o.lessons) await ctx.addInitScript((L) => { window.__MOCK_LESSONS = L; }, o.lessons);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${url}`, { waitUntil: "load" });
  if (o.wait) await page.waitForSelector(o.wait, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `${name}-${w}.png`) });
  console.log(`${name}-${w}.png`);
  await ctx.close();
}
await browser.close();
