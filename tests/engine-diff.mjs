// The same turtlesim commands in the two practice terminals: the lesson engine (terminal-sim.js + ros-graph.js,
// rendered like a lesson with lesson-render.js) and the home page's practice computer (js/lab.js). Writes both outputs
// side by side as JSON, for docs/redesign/ENGINE_DIFF.md. Neither engine is changed.
//   node tests/engine-diff.mjs [out.json]      (site on localhost:8080; BASE=… to change)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const BASE = process.env.BASE || "http://localhost:8080", OUT = process.argv[2] || "engine-diff.json";
const CMDS = [
  "ros2 node list", "ros2 topic list -t", "printenv | grep ROS", "ros2 param get /turtlesim background_r",
  "ros2 topic echo /turtle1/pose --once",
  "ros2 service call /spawn turtlesim/srv/Spawn \"{x: 2, y: 2, theta: 0.2, name: ''}\"",
  "ros2 node info /turtlesim", "ros2 service list -t", "ros2 action list -t", "ros2 topic info /turtle1/cmd_vel",
  "ros2 interface show turtlesim/srv/Spawn", "ros2 param set /turtlesim background_r 150", "ros2 topic type /nope",
  "ros2 node info", "ros2 topic echo /turtle1/pose -1", "rqt_graph",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const course = JSON.parse(readFileSync(root + "content/course-content.json", "utf8").replace(/^\uFEFF/, ""));
const block = course.modules.flatMap((m) => m.lessons).find((l) => l.id === "IN1").blocks.find((b) => b.t === "term");
const browser = await chromium.launch();
const result = { lesson: {}, lab: {} };

// lesson engine: three terminals, as a student opens them in a lesson
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.route(BASE + "/__lesson_harness.html", (route) => route.fulfill({ contentType: "text/html", body:
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/app.css"></head><body><main id="main"></main>
     <script type="module">import { renderLesson } from "./js/lesson-render.js"; renderLesson(document.getElementById("main"), JSON.parse(document.getElementById("L").textContent)); window.__ready = true;</script>
     <script type="application/json" id="L">${JSON.stringify({ id: "IN1", blocks: [block] }).replace(/</g, "\\u003c")}</script></body></html>` }));
  await page.goto(BASE + "/__lesson_harness.html");
  await page.waitForFunction(() => window.__ready && document.querySelector(".tmr-pane input"));
  const lines = (id) => page.evaluate((id) => [...document.querySelectorAll(`.tmr-pane[data-term="${id}"] .term-screen .line`)].map((n) => n.textContent), id);
  const type = async (id, cmd, wait = 1500) => {
    const n = (await lines(id)).length;
    const inp = page.locator(`.tmr-pane[data-term="${id}"] .term-input-row input`);
    await inp.fill(cmd); await inp.press("Enter"); await sleep(wait);
    return (await lines(id)).slice(n);
  };
  await type(1, "source /opt/ros/jazzy/setup.bash", 300); await type(1, "ros2 run turtlesim turtlesim_node", 800);
  await page.click(".term-tab-add"); await sleep(400);
  await type(2, "source /opt/ros/jazzy/setup.bash", 300); await type(2, "ros2 run turtlesim turtle_teleop_key", 800);
  await page.click(".term-tab-add"); await sleep(400);
  await type(3, "source /opt/ros/jazzy/setup.bash", 300);
  for (const c of CMDS) result.lesson[c] = (await type(3, c)).join("\n");
  await page.close();
}

// practice computer: Reset, then the same three terminals
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/index.html?debug=1");
  await page.evaluate(() => window.__lab.stopDemo());
  await page.click("#reset-btn"); await sleep(300);
  const out = () => page.evaluate(() => document.querySelector("#lab .tpane.focus .tout").textContent);
  const type = async (cmd, wait = 1500) => {
    const n = (await out()).length;
    await page.keyboard.type(cmd); await page.keyboard.press("Enter"); await sleep(wait);
    return (await out()).slice(n).replace(/\n$/, "").split("\n").slice(1).join("\n");   // drop the prompt line
  };
  await page.evaluate(() => window.__lab.focused().key.focus());
  await type("ros2 run turtlesim turtlesim_node", 800);
  await page.click("#split-v"); await type("ros2 run turtlesim turtle_teleop_key", 800);
  await page.click("#split-h");
  for (const c of CMDS) {
    result.lab[c] = await type(c);
    if (c.endsWith(" -1")) {   // still printing: stop it as a student would, and keep the first message
      await page.keyboard.press("Control+c"); await sleep(300);
      result.lab[c] = result.lab[c].split("\n---\n")[0] + "\n---\n… (keeps printing until Ctrl+C)";
    }
  }
  await page.close();
}
await browser.close();
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`wrote ${OUT}`);
