// A quoted number in a float / int field is converted like real Jazzy (Python float('2') / int('2') inside
// rosidl_runtime_py set_message_fields). Real output: parity/fixtures/lessons/_investigations/yaml_quoted_numbers.txt
// Usage: node tests/quoted-numbers.mjs   (site on BASE, default http://localhost:8080)
import { chromium } from "@playwright/test";
const BASE = process.env.BASE || "http://localhost:8080";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
const block = { t: "term", tasks: [{ do: "x", check: { cmd: "^never$" } }] };
await page.route(BASE + "/__qn.html", (r) => r.fulfill({ contentType: "text/html", body:
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/app.css"></head><body><main id="main"></main>
   <script type="module">import { renderLesson } from "./js/lesson-render.js";
   renderLesson(document.getElementById("main"), ${JSON.stringify({ id: "QN", blocks: [block] })}); window.__ready = true;</script></body></html>` }));
await page.goto(BASE + "/__qn.html");
await page.waitForFunction(() => window.__ready && document.querySelector(".tmr-pane input"), null, { timeout: 30000 });
const run = async (pane, cmd, wait = 1500) => {
  const read = () => page.evaluate((id) => [...document.querySelectorAll(`.tmr-pane[data-term="${id}"] .term-screen .line`)].map((n) => n.textContent), pane);
  const before = (await read()).length;
  const inp = page.locator(`.tmr-pane[data-term="${pane}"] .term-input-row input`);
  await inp.fill(cmd); await inp.press("Enter"); await sleep(wait);
  return (await read()).slice(before + 1).join("\n");
};
let fails = 0;
const expect = (name, out, re, not) => { const ok = re.test(out) && !(not && not.test(out)); if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : `\n${out}`}`); };
await run(1, "source /opt/ros/jazzy/setup.bash", 500);
await run(1, "ros2 run turtlesim turtlesim_node", 2500);
await page.click(".term-tab-add"); await sleep(400);
const p2 = await page.evaluate(() => Math.max(...[...document.querySelectorAll(".tmr-pane")].map((p) => Number(p.dataset.term))));
await run(p2, "source /opt/ros/jazzy/setup.bash", 500);
expect("topic pub float '2'", await run(p2, `ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: '2'}}"`, 2500),
  /linear=geometry_msgs\.msg\.Vector3\(x=2\.0, y=0\.0, z=0\.0\)/, /Failed to populate/);
expect("topic pub float 'abc'", await run(p2, `ros2 topic pub --once /turtle1/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 'abc'}}"`),
  /^Failed to populate field: could not convert string to float: 'abc'$/m);
expect("service call SetPen ints '255'", await run(p2, `ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: '255', g: '0', b: '0', width: '4', 'off': '0'}"`, 2500),
  /turtlesim\.srv\.SetPen_Request\(r=255, g=0, b=0, width=4, off=0\)/, /Failed to populate/);
expect("service call SetPen int '2.5'", await run(p2, `ros2 service call /turtle1/set_pen turtlesim/srv/SetPen "{r: '2.5'}"`),
  /^Failed to populate field: invalid literal for int\(\) with base 10: '2\.5'$/m);
expect("service call Spawn floats '2'", await run(p2, `ros2 service call /spawn turtlesim/srv/Spawn "{x: '2', y: '2', theta: '0.2', name: 'turtle2'}"`, 2500),
  /turtlesim\.srv\.Spawn_Request\(x=2\.0, y=2\.0, theta=0\.2, name='turtle2'\)/, /Failed to populate/);
if (errors.length) { fails++; console.log("page errors:", errors); }
await browser.close();
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
