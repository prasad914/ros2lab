import { chromium } from "@playwright/test";
const pages = (process.env.PAGES || "index.html,course.html,rviz.html,playground.html,resources.html,lesson.html").split(",");
const b = await chromium.launch();
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: w > 500 ? 900 : 844 } });
  for (const pg of pages) {
    await p.goto("http://localhost:8080/" + pg); await p.waitForTimeout(1800);
    await p.screenshot({ path: `/tmp/claude-0/shot-${pg.replace(".html", "")}-${w}.png`, fullPage: !!process.env.FULL });
  }
  await p.close();
}
await b.close(); console.log("ok");
