// usage: node render.mjs <firstFrame> <endFrame(exclusive)> <out.mp4>   (30 fps, 1080x1920)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
const [a, b, out] = process.argv.slice(2); const first = +a, end = +b, FPS = 30;
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(FPS), out], { stdio: ["pipe", "inherit", "inherit"] });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://127.0.0.1:8765/index.html");
await page.waitForFunction(() => window.READY || window.BOOT_ERROR, null, { timeout: 300000 });
const t0 = Date.now();
for (let i = first; i < end; i++) {
  await page.evaluate((t) => window.frame(t), i / FPS);
  const buf = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if ((i - first) % 60 === 0) console.log(`${out}: frame ${i} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`${out}: done ${end - first} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
