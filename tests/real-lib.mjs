// Helpers for the official-workspace tests: Chromium with Pyodide routed to the local copy (the site loads it from
// cdn.jsdelivr.net), a robot page, commands typed in the terminal, and the terminal's text.
import { chromium } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
const PYO = process.env.PYODIDE_DIR || "/tmp/claude-0/pyo/pyodide/";
export async function openRobot(id, { webgl = false } = {}) {
  const b = await chromium.launch({ args: webgl ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : [] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
  // offline test machines keep a local copy of Pyodide; with internet access (no local copy) it loads from the CDN as on the site
  if (existsSync(PYO)) await ctx.route("https://cdn.jsdelivr.net/npm/pyodide@314.0.7/**", (r) => { const p = PYO + new URL(r.request().url()).pathname.split("/").pop(); if (!existsSync(p)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ body: readFileSync(p), contentType: p.endsWith(".wasm") ? "application/wasm" : /js$/.test(p) ? "text/javascript" : "application/octet-stream", headers: { "access-control-allow-origin": "*" } }); });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  p.on("console", (m) => { if (process.env.CONSOLE) console.log("[console]", m.type(), m.text().slice(0, 300)); if (m.type() === "error" && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(`http://localhost:8080/rviz.html?robot=${id}`);
  await p.waitForFunction(() => window.__ros2lab && window.__ros2lab.sh && window.__ros2lab.sh.realWs, null, { timeout: 60000 });
  return { b, p, errs };
}
export const run = (p, cmd) => p.evaluate((c) => window.__ros2lab.term.run(c), cmd);
export const screens = (p) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => x.innerText));
export const newTerm = (p) => p.evaluate(() => window.__ros2lab.term.newTerminal());
export const graph = (p, fn, arg) => p.evaluate(fn, arg);
export async function waitText(p, re, ms = 60000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = (await screens(p)).join("\n"); if (re.test(s)) return true; await p.waitForTimeout(500); } return false; }
