// Renders the gallery pictures public/img/robots/<id>.webp with public/js/robot-thumb.js (the same code the browser
// uses for robots without a picture). Needs the site on http://localhost:8080 and Playwright:
//   npx http-server public -p 8080 -c-1 -s &  node tools/render-robots.mjs [robot-id ...]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = new URL("../public/img/robots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const index = JSON.parse(readFileSync(new URL("../public/robots/index.json", import.meta.url)));
const want = process.argv.slice(2);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await p.goto("http://localhost:8080/404.html");
for (const g of index) {
  if (want.length && !want.includes(g.id)) continue;
  const t0 = Date.now();
  const res = await p.evaluate(async (g) => {
    try {
      const [{ renderRobot }, { galleryUrdf }] = await Promise.all([import("/js/robot-thumb.js"), import("/js/rviz-pkg.js")]);
      const { urdf } = await galleryUrdf(g, async () => []);
      if (!urdf) return { err: "no URDF in this copy" };
      // one renderer for every picture (its room light is made once; a new WebGL context per robot is slow)
      const THREE = await import("/vendor/three/three.module.js");
      window.__thumbR = window.__thumbR || new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      return { url: await renderRobot(g, urdf, { width: 800, height: 600, quality: 0.88, renderer: window.__thumbR }) };
    } catch (e) { return { err: String(e.message || e) }; }
  }, g);
  if (res.err) { console.log(`--  ${g.id}: ${res.err}`); continue; }
  const buf = Buffer.from(res.url.split(",")[1], "base64");
  writeFileSync(`${OUT}${g.id}.webp`, buf);
  console.log(`ok  ${g.id}: ${(buf.length / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await b.close();
