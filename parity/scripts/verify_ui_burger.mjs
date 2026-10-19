import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log("Navigating to rviz.html?robot=tb3_burger...");
  await page.goto("http://127.0.0.1:8000/rviz.html?robot=tb3_burger");
  await page.waitForFunction(() => typeof window !== "undefined" && !!window.__ros2lab?.term);

  // Ensure screenshots dir exists
  const ssDir = path.resolve("/home/prasad/ros2lab-course/parity/reports/screenshots");
  if (!fs.existsSync(ssDir)) {
    fs.mkdirSync(ssDir, { recursive: true });
  }

  // 1280px screenshot
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ssDir, "tb3_burger_1280.png"), fullPage: true });
  console.log("Saved 1280px screenshot.");

  // 375px screenshot (mobile width)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ssDir, "tb3_burger_375.png"), fullPage: true });
  console.log("Saved 375px screenshot.");

  // Check horizontal scroll at 375px and 1280px
  const noHScroll375 = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  console.log("No horizontal scroll at 375px:", noHScroll375);

  await page.setViewportSize({ width: 1280, height: 800 });
  const noHScroll1280 = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  console.log("No horizontal scroll at 1280px:", noHScroll1280);

  // Check camera presence for tb3_burger
  const hasCamera = await page.evaluate(() => {
    const ff = window.__ros2lab.fixedFrame;
    return ff.options.some(f => f.includes("camera"));
  });
  console.log("Has camera frames for tb3_burger (should be false):", hasCamera);

  await browser.close();
  console.log("UI verification complete.");
})();
