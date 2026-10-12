// every public page at phone width: does anything stick out sideways?
import { chromium } from "@playwright/test";
const pages = ["index.html", "playground.html", "rviz.html", "resources.html", "register.html", "signin.html", "privacy.html", "terms.html", "404.html", "course.html", "account.html", "lesson.html", "project.html"];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 375, height: 800 } });
for (const pg of pages) {
  await p.goto("http://localhost:8080/" + pg); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => { const W = document.documentElement.clientWidth; const wide = [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.right > W + 1 && getComputedStyle(e).position !== "fixed"; }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`); return { sw: document.documentElement.scrollWidth, W, wide }; });
  console.log(`${r.sw > r.W ? "WIDE" : "ok  "} ${pg} ${r.sw}/${r.W} ${r.wide.join(" ")}`);
}
await b.close();
