import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
// FIX=1: serve tests/fixtures/robots/<path> for /robots/<path> (stand-ins for course robot files missing in this copy)
const FIXDIR = new URL("./fixtures/robots/", import.meta.url).pathname;
export async function open(page = "rviz.html") {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  await p.addInitScript(() => { try { localStorage.setItem("ros2lab.dev.underTest", "open"); } catch { /* no storage */ } });   // under-test robots too (robot-info.js)
  if (process.env.FIX) await p.route("**/robots/**", (r) => { const rel = new URL(r.request().url()).pathname.replace(/^\/robots\//, ""); const f = FIXDIR + rel; return existsSync(f) ? r.fulfill({ body: readFileSync(f), contentType: "text/plain" }) : r.continue(); });
  if (process.env.LIC) {   // pretend: signed in as an instructor, and getHardwareSources answers from functions/hw-sources.json
    const hw = readFileSync(new URL("../functions/hw-sources.json", import.meta.url), "utf8");
    await p.route("**/js/fb.js", async (r) => {
      const real = readFileSync(new URL("../public/js/fb.js", import.meta.url), "utf8")
        .replace("export const auth = { currentUser: null };", "export const auth = { currentUser: { uid: 'u1', email: 'tester@example.com' } };")
        .replace("export const getIdTokenResult = async () => ({ claims: {} });", "export const getIdTokenResult = async () => ({ claims: { admin: true } });")
        .replace("export const call = async (name) => { throw new Error(`stub: ${name} not available locally`); };", `export const call = (name) => async () => (name === "getHardwareSources" ? { data: { files: ${hw}, watermark: "tester@example.com" } } : {});`);
      return r.fulfill({ body: real, contentType: "text/javascript" });
    });
  }
  const errs = []; p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 3).join("\n")));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });
  await p.goto("http://localhost:8080/" + page); await p.waitForTimeout(1500);
  return { b, p, errs };
}
export async function pick(p, robot) { await p.goto(`http://localhost:8080/rviz.html?robot=${robot}`); await p.waitForTimeout(Number(process.env.PW || 2500)); }
export async function run(p, cmd, wait = 600) {
  const before = await p.evaluate(() => document.querySelectorAll(".term-screen").length);
  await p.evaluate((c) => window.__ros2lab.term.run(c), cmd); await p.waitForTimeout(wait);
}
export async function screen(p) { return p.evaluate(() => { const s = [...document.querySelectorAll(".term-screen")]; return s.map((x) => x.innerText).join("\n=====\n"); }); }
export async function lastScreen(p, n = 40) { const t = await screen(p); return t.split("\n").slice(-n).join("\n"); }
export async function tab(p, text, times = 1) {
  const inp = p.locator(".term-screen input:visible").last();
  await inp.click(); await inp.fill(text);
  for (let i = 0; i < times; i++) { await inp.press("Tab"); await p.waitForTimeout(150); }
  return { value: await inp.inputValue(), screen: await lastScreen(p, 6) };
}
