// Night 2, Part 5: the TurtleBot3 RViz configs on the site against real rviz2
// (parity/fixtures/tb3_jazzy_v3/rviz/<name>/saved.rviz: what rviz2 writes back with Ctrl+S after loading the installed
// file; capture_rviz_configs.sh). Each config is opened by the launch file that uses it, like a student does; the site's
// own File > Save Config text (viewer.configText()) is compared item by item: global options, every display (group
// path, class, name, enabled, topic and its QoS, key properties), tools (class, topic), panels (class, name), the
// current view (class and scalars). State-dependent parts (TF Frames / Tree, RobotModel Links, tree height, window
// geometry) are not compared. The site screenshot is saved next to the real one for the report.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FIX, ROOT, openWorld, prepTerm, run, waitText, yaml } from "./fixtures/lib";

const robot = "tb3_burger";
const OUTD = path.join(ROOT, "parity", "browser_out", "tb3_night2", "rviz");
// the key properties compared besides class, name, enabled state and topics (default-valued properties that one side
// writes and the other leaves out are not compared)
const KEY = new Set(["Alpha", "Color", "Color Scheme", "Color Transformer", "Style", "Size (m)", "Size (Pixels)", "Line Style", "Line Width", "Buffer Length", "Draw Behind", "Description Source", "Shape"]);
const scal = (v: any) => v === null || ["string", "number", "boolean"].includes(typeof v);
/** a .rviz document -> sorted "kind | key | value" items */
function items(cfg: any): string[] {
  const out: string[] = [], vm = cfg["Visualization Manager"] || {};
  for (const [k, v] of Object.entries<any>(vm["Global Options"] || {})) out.push(`global | ${k} | ${v}`);
  const QOS = new Set(["Value", "Depth", "Durability Policy", "History Policy", "Reliability Policy"]);
  const topic = (pre: string, t: any) => { if (t && typeof t === "object") { for (const [k, v] of Object.entries<any>(t)) if (scal(v) && QOS.has(k)) out.push(`${pre} | ${k} | ${v}`); } else if (t !== undefined) out.push(`${pre} | Value | ${t}`); };
  const walk = (list: any[], at: string) => (list || []).forEach((d: any) => {
    const id = `display ${at}/${d.Name}`;
    out.push(`${id} | Class | ${d.Class}`, `${id} | Enabled | ${d.Enabled ?? d.Value}`);
    for (const [k, v] of Object.entries<any>(d)) if (scal(v) && KEY.has(k)) out.push(`${id} | ${k} | ${v}`);
    if (d.Topic !== undefined) topic(`${id} topic`, typeof d.Topic === "object" ? d.Topic : { Value: d.Topic });
    if (d["Update Topic"] !== undefined) topic(`${id} update topic`, typeof d["Update Topic"] === "object" ? d["Update Topic"] : { Value: d["Update Topic"] });
    if (Array.isArray(d.Displays)) walk(d.Displays, `${at}/${d.Name}`);
  });
  walk(vm.Displays, "");
  (vm.Tools || []).forEach((t: any, i: number) => { out.push(`tool ${i} | Class | ${t.Class}`); if (t.Topic) topic(`tool ${i} topic`, typeof t.Topic === "object" ? t.Topic : { Value: t.Topic }); });
  (cfg.Panels || []).forEach((p: any) => out.push(`panel | ${p.Class} | ${p.Name}`));
  const cur = (vm.Views || {}).Current || {};
  for (const [k, v] of Object.entries<any>(cur)) if (scal(v) && k !== "Near Clip Distance") out.push(`view | ${k} | ${typeof v === "number" ? Number(v).toPrecision(6) : v}`);
  if (cur["Focal Point"]) for (const a of ["X", "Y", "Z"]) out.push(`view | Focal Point ${a} | ${Number(cur["Focal Point"][a]).toPrecision(6)}`);
  return [...new Set(out)].sort();
}

const CASES: { name: string; launch: string; ready: RegExp; nav?: boolean }[] = [
  { name: "tb3_navigation2", launch: "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True", ready: /Activating planner_server/, nav: true },
  { name: "tb3_cartographer", launch: "ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True", ready: /cartographer_node/ },
  { name: "model", launch: "ros2 launch turtlebot3_bringup rviz2.launch.py", ready: /rviz2/ },
];
for (const c of CASES) {
  test(`${robot}: RViz config ${c.name}.rviz matches real rviz2`, async ({ page }) => {
    test.setTimeout(600000);
    expect(await openWorld(page, robot)).toBe(true);
    await prepTerm(page, robot);
    await run(page, c.launch);
    expect(await waitText(page, c.ready, 180000)).toBe(true);
    await page.waitForFunction((n) => { const v = (window as any).__ros2lab; return v.viewer && String(v.sh.viz.configName || "").endsWith(`${n}.rviz`); }, c.name, { timeout: 120000 });
    await page.waitForTimeout(5000);
    const site = await page.evaluate(() => (window as any).__ros2lab.viewer.configText());
    fs.mkdirSync(OUTD, { recursive: true });
    const siteFile = path.join(OUTD, `${c.name}.site.rviz`);
    fs.writeFileSync(siteFile, site);
    const win = page.locator(".q-window").first();
    await win.scrollIntoViewIfNeeded().catch(() => {});
    await win.screenshot({ path: path.join(OUTD, `${c.name}.site.png`) }).catch(() => page.screenshot({ path: path.join(OUTD, `${c.name}.site.png`) }));
    const real = items(yaml(path.join(FIX, "tb3_jazzy_v3", "rviz", c.name, "saved.rviz"))), mine = items(yaml(siteFile));
    const missing = real.filter((x) => !mine.includes(x)), extra = mine.filter((x) => !real.includes(x));
    fs.writeFileSync(path.join(OUTD, `${c.name}.diff.json`), JSON.stringify({ real: real.length, site: mine.length, missing, extra }, null, 1));
    expect.soft(missing, `${c.name}: items of real rviz2's saved config missing on the site`).toEqual([]);
    expect.soft(extra, `${c.name}: items only in the site's saved config`).toEqual([]);
  });
}
