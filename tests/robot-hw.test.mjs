// The browser's robot-hw.js and the Python ros2lab_robot_setup must write the same files for the same URDF.
//   node tests/robot-hw.test.mjs [urdf folder]     (needs the site on http://localhost:8080 and python3)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const here = new URL("..", import.meta.url).pathname;
const gen = join(here, "hardware/src/ros2lab_hardware/scripts/ros2lab_robot_setup.py");
const extra = process.argv[2];
const R = join(here, "public/robots");
const cases = [
  { urdf: `${R}/turtlebot3_description/urdf/turtlebot3_burger.urdf`, kind: "diff", board: "mega", imu: true },
  { urdf: `${R}/turtlebot3_description/urdf/turtlebot3_waffle.urdf`, kind: "diff", board: "esp32", wifi: true },
  { urdf: `${R}/so101_description/urdf/so101.urdf`, kind: "arm", board: "esp32", imu: true },
  { urdf: `${R}/so101_description/urdf/so101.urdf`, kind: "arm", board: "mega" },
  { urdf: `${R}/so101_description/urdf/so101.urdf`, kind: "arm", board: "esp32", servo: "sts", stsIds: { shoulder_pan: 1, gripper: 6 } },
  ...(extra ? readdirSync(extra).filter((f) => f.endsWith(".urdf")).map((f) => ({ urdf: join(extra, f), kind: f.replace(".urdf", "").replace(/^quadruped$/, "legged"), board: f.startsWith("ackermann") ? "esp32" : "mega", imu: true, wifi: f.startsWith("ackermann") })) : []),
];
const b = await chromium.launch(); const p = await b.newPage();
await p.goto("http://localhost:8080/404.html");
let ok = 0, bad = 0;
for (const c of cases) {
  const out = mkdtempSync(join(tmpdir(), "hw-"));
  const args = [gen, "--urdf", c.urdf, "--type", c.kind, "--board", c.board, "--out", out, ...(c.imu ? ["--imu"] : []), ...(c.wifi ? ["--wifi", "--wifi-pass", "fixed-test-pass"] : []),
    ...(c.servo ? ["--servo", c.servo] : []), ...(c.stsIds ? ["--sts-ids", Object.entries(c.stsIds).map(([k, v]) => `${k}=${v}`).join(",")] : [])];
  execFileSync("python3", args, { stdio: "pipe" });
  const js = await p.evaluate(async ({ text, c }) => { const m = await import("/js/robot-hw.js"); return m.robotSetup(text, { ...c, wifiPass: c.wifi ? "fixed-test-pass" : null }).files; }, { text: readFileSync(c.urdf, "utf8"), c });
  for (const f of readdirSync(out)) {
    const py = readFileSync(join(out, f), "utf8");
    if (js[f] === py) { ok++; continue; }
    bad++;
    const a = py.split("\n"), bj = (js[f] || "").split("\n"), i = a.findIndex((x, k) => x !== bj[k]);
    console.log(`DIFF ${c.urdf.split("/").pop()} ${c.kind}/${c.board} ${f} line ${i + 1}\n  py: ${a[i]}\n  js: ${bj[i]}`);
  }
}
await b.close();
console.log(`${ok} files identical, ${bad} different`);
process.exit(bad ? 1 : 0);
