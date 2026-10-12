// Nav2 + SLAM models in Chromium (Playwright), with RViz2 screenshots:
//   TurtleBot3 burger in turtlebot3_world (the Gazebo agent's real-launch harness), Nav2 models with the real
//   turtlebot3_navigation2 burger.yaml + map.yaml (tests/nav2-lib.mjs scenarios), and the practice RViz2 loading the
//   REAL tb3_navigation2.rviz / tb3_cartographer.rviz (map, costmaps, plan, particle cloud, footprint, Navigation 2 panel).
// Usage: node tests/nav2.mjs   (static server on :8080; screenshots in tests/out/nav2-*.png)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { makeResolver, fixture } from "./gz-resolver.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE = process.env.R2L_BASE || "http://localhost:8080";
const OUT = path.join(ROOT, "tests/out"); fs.mkdirSync(OUT, { recursive: true });
const resolve = await makeResolver();
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => { errors.push(e.message); console.log("pageerror:", e.message); });
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 300)); });
await page.route(`${BASE}/__gztests/**`, (route) => { const f = path.join(ROOT, "tests", new URL(route.request().url()).pathname.replace(/^\/__gztests\//, "")); route.fulfill({ status: fs.existsSync(f) ? 200 : 404, contentType: "text/javascript", body: fs.existsSync(f) ? fs.readFileSync(f) : "" }); });
await page.exposeFunction("gzResolveFile", (p) => { const r = resolve(p); if (!r) return null; return r.text != null ? { text: r.text } : { b64: Buffer.from(r.bytes).toString("base64") }; });
await page.exposeFunction("gzFixture", (n) => fixture(n));
await page.exposeFunction("nav2Shot", async (name) => { await page.screenshot({ path: path.join(OUT, `nav2-${name}.png`) }); return true; });
await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded" });
const res = await page.evaluate(async () => {
  const J = "/js/";
  const harness = await import("/__gztests/gz-harness.mjs"), lib = await import("/__gztests/gz-real-lib.mjs"), N = await import("/__gztests/nav2-lib.mjs");
  const mods = { sdformat: await import(J + "gz-sdformat.js"), cli: await import(J + "gz-cli.js"), rosgz: await import(J + "ros-gz.js"), rc: await import(J + "ros-control-graph.js"), physics: await import(J + "gz-physics.js"), harness, lib, nav2: await import(J + "nav2-sim.js"), core: await import(J + "nav2-core.js") };
  const R = await import(J + "rviz.js"), U = await import(J + "urdf-core.js");
  const fx = {};
  const io = { resolve: async (p) => { const r = await window.gzResolveFile(p); if (!r) return null; if (r.text != null) return r; const b = atob(r.b64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return { bytes: u }; }, fixture: (n) => fx[n], yamlIndentless: true };
  fx["tb3_burger-1"] = await window.gzFixture("tb3_burger-1");
  // an RViz2 window like the simulator page's, fed the way the coordinator will (gzTopicData + nav2TopicData + tf edges)
  document.body.replaceChildren(); document.body.style.margin = "0";
  R.loadRvizCss();
  const box = document.createElement("div"); box.style.cssText = "position:fixed;inset:0;width:1400px;height:900px;background:#fff"; document.body.append(box);
  const shots = {};
  async function showRviz(S, cfgPath, name, checks) {
    box.replaceChildren();
    const G = S.G || S.L.G, cfg = (await io.resolve(cfgPath)).text;
    const viewer = R.createRviz(box, { plugins: () => ["nav2_rviz_plugins", "rviz_default_plugins", "slam_toolbox"], nav2: mods.nav2.nav2Panel(G), resolve: (u) => String(u).replace(/^package:\/\/turtlebot3_gazebo\/models\/turtlebot3_common\/meshes\//, "package://turtlebot3_description/meshes/").replace(/^package:\/\/turtlebot3_description\//, "/robots/ws/turtlebot3/src/turtlebot3/turtlebot3_description/").replace(/^package:\/\/turtlebot3_gazebo\//, "/robots/ws/turtlebot3/src/turtlebot3_simulations/turtlebot3_gazebo/"), topics: () => [{ name: "/robot_description", type: "std_msgs/msg/String", pubs: 1, publishers: 1 }] });
    viewer.loadConfig(cfg, cfgPath.split("/").pop());
    const rsp = fx["tb3_burger-1"].procs.find((p) => /robot_state_publisher/.test(p.cmd[0]));
    const urdf = harness.rspUrdf(rsp); viewer.setModel(U.parseURDF(urdf));
    const td = mods.nav2.nav2TopicData(G), scan = G.nav2.scan();
    if (scan) td.set("/scan", { type: "sensor_msgs/msg/LaserScan", count: 10, rate: 5, qos: "Best Effort", frame: scan.frame, ranges: scan.ranges, angle_min: scan.angle_min, angle_increment: scan.angle_increment, range_min: scan.range_min, range_max: scan.range_max });
    viewer.update({ edges: [...G.gzTfEdges(), ...mods.nav2.nav2TfEdges(G)], joints: G.gzJoints(), have: true, topicData: td });
    await new Promise((r) => setTimeout(r, 1500));
    viewer.update({ topicData: td });
    await new Promise((r) => setTimeout(r, 300));
    const st = viewer.state();
    shots[name] = { displays: st.displayList.map((d) => `${d.type}:${d.enabled}`), status: st.status, frames: st.frames, tools: [...box.querySelectorAll(".q-tool[data-tool]")].map((b) => b.textContent), panels: viewer.panels(), panelText: (box.querySelector(".rv-nav2") || {}).textContent || "", failed: [...box.querySelectorAll(".q-tree *")].map((e) => e.textContent).filter((t) => /could not be loaded/.test(t)).slice(0, 3) };
    if (checks) shots[name].extra = checks(viewer);
    await window.nav2Shot(name);
    viewer.destroy();
  }
  const out = [];
  const nav = await N.nav2Scenario(mods, io, { onRviz: (S) => showRviz(S, "/home/student/ros2_ws/install/turtlebot3_navigation2/share/turtlebot3_navigation2/rviz/tb3_navigation2.rviz", "navigation", (v) => ({ particles: v.displays("ParticleCloud").map((d) => d.status.map((x) => x.join(":"))), maps: v.displays("Map").map((d) => `${d.name}|${d.props["Color Scheme"]}|${d.props.Topic}|${d.status.map((x) => x[1]).join(",")}`) })) });
  out.push({ w: "nav", pass: nav.pass, checks: nav.checks.map((c) => ({ name: c.name, ok: c.ok, info: c.ok ? null : JSON.stringify(c.info) })) });
  const slam = await N.slamScenario(mods, io, { onRviz: (S) => showRviz(S, "/home/student/ros2_ws/install/turtlebot3_cartographer/share/turtlebot3_cartographer/rviz/tb3_cartographer.rviz", "slam") });
  out.push({ w: "slam", pass: slam.pass, checks: slam.checks.map((c) => ({ name: c.name, ok: c.ok, info: c.ok ? null : JSON.stringify(c.info) })) });
  // nav2_default_view.rviz from nav2_bringup (share.zip) and a config with a plugin class that is not installed
  box.replaceChildren();
  const v2 = R.createRviz(box, { plugins: () => [] });
  v2.loadConfig((await io.resolve("/opt/ros/jazzy/share/nav2_bringup/rviz/nav2_default_view.rviz")).text, "nav2_default_view.rviz");
  await new Promise((r) => setTimeout(r, 300)); v2.update({});
  const st2 = v2.state();
  shots.noPlugins = { failed: st2.status.filter((s) => /could not be loaded/.test(s)), panelErr: (box.querySelector(".rv-panel-err") || {}).textContent || "", tools: [...box.querySelectorAll(".q-tool[data-tool]")].map((b) => b.textContent) };
  v2.destroy();
  return { out, shots };
});
let failed = 0;
const ok = (w, name, cond, info) => { console.log(`${cond ? "ok  " : "FAIL"} [chromium] ${w}: ${name}${cond ? "" : "  " + String(JSON.stringify(info)).slice(0, 900)}`); if (!cond) failed++; };
for (const r of res.out) for (const c of r.checks) ok(r.w, c.name, c.ok, c.info);
const S = res.shots;
ok("rviz", "tb3_navigation2.rviz: every display class loads (Map x4, ParticleCloud, Polygon, Path ...)", S.navigation && !S.navigation.failed.length && ["Map:true", "ParticleCloud:true", "Path:true", "Polygon:true", "LaserScan:true", "RobotModel:false"].every((d) => S.navigation.displays.includes(d)), S.navigation);
ok("rviz", "tools of the file: Nav2 Goal, 2D Pose Estimate, Publish Point", S.navigation && ["2D Pose Estimate", "Nav2 Goal", "Publish Point"].every((t) => S.navigation.tools.includes(t)), S.navigation && S.navigation.tools);
ok("rviz", "Navigation 2 panel: navigation / localization active", S.navigation && S.navigation.panels.includes("nav2_rviz_plugins/Navigation 2") && /Navigation:active/.test(S.navigation.panelText.replace(/\s+/g, "")) && /Localization:active/.test(S.navigation.panelText.replace(/\s+/g, "")), S.navigation && S.navigation.panelText);
ok("rviz", "Map displays: map + global/local costmap with the costmap colour scheme, data received", S.navigation && S.navigation.extra.maps.filter((m) => /Map OK/.test(m)).length >= 3 && S.navigation.extra.maps.some((m) => /costmap\|\/global_costmap\/costmap/.test(m)), S.navigation && S.navigation.extra.maps);
ok("rviz", "frames map / odom / base_footprint / base_scan", S.navigation && ["map", "odom", "base_footprint", "base_scan"].every((f) => S.navigation.frames.includes(f)), S.navigation && S.navigation.frames);
ok("rviz", "tb3_cartographer.rviz loads (Map, PoseArray, Odometry ...)", S.slam && !S.slam.failed.length && S.slam.displays.includes("Map:true"), S.slam);
ok("rviz", "without nav2_rviz_plugins: RViz2's error for the display and the panel", S.noPlugins.failed.some((s) => /The class required for this display, 'nav2_rviz_plugins\/ParticleCloud', could not be loaded\./.test(s)) && /The class required for this panel, 'nav2_rviz_plugins\/Navigation 2', could not be loaded\./.test(S.noPlugins.panelErr) && !S.noPlugins.tools.includes("Nav2 Goal"), S.noPlugins);
ok("page", "no page errors", errors.length === 0, errors);
await browser.close();
console.log(failed ? `nav2: ${failed} check(s) failed` : "nav2: all passed (screenshots in tests/out/nav2-*.png)");
process.exit(failed ? 1 : 0);
