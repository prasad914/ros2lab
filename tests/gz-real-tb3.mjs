// TurtleBot3 (burger in turtlebot3_world, waffle camera) driven with the real launch inputs, in Chromium.
import { runBrowser } from "./gz-real-browser.mjs";
const failed = await runBrowser(["tb3", "waffle"]);
console.log(failed ? `${failed} scenario(s) failed` : "gz-real-tb3: all passed");
process.exit(failed ? 1 : 0);
