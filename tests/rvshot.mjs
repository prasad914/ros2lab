import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto("http://localhost:8080/rviz.html"); await p.waitForTimeout(1200);
  await p.goto(`http://localhost:8080/rviz.html?robot=${process.env.R || "ur5e"}`); await p.waitForTimeout(3000);
  await p.screenshot({ path: `/tmp/claude-0/rv-${w}.png`, fullPage: true });
  await p.close();
}
await b.close();
