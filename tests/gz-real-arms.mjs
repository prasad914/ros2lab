// UR5e, FR3, Kinova Gen3, xArm6, Lite 6, Dobot CR5 under gz_ros2_control with their real controllers yaml, in Chromium.
import { runBrowser } from "./gz-real-browser.mjs";
const failed = await runBrowser(["ur5e", "fr3", "gen3", "xarm6", "lite6", "cr5"]);
console.log(failed ? `${failed} scenario(s) failed` : "gz-real-arms: all passed");
process.exit(failed ? 1 : 0);
