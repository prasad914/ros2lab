// Drive a robot into the world's walls / objects in Gazebo, with the Gazebo DiffDrive (sim) or with
// gz_ros2_control's diff_drive_controller (sim_control), and check that it stops.
//   FIX=1 node tests/wall.mjs chiku control      node tests/wall.mjs tb3_burger sim
import { open, pick, screen } from "./lib.mjs";
const [robot = "chiku", mode = "control", secs = "20"] = process.argv.slice(2);
const { b, p, errs } = await open(); await pick(p, robot);
const R = async (c, w = 1200) => { await p.evaluate((c) => window.__ros2lab.term.runHere(c), c); await p.waitForTimeout(w); };
const desc = await p.evaluate(() => [...window.__ros2lab.sh.fs.keys()].find((k) => /ros2_ws\/src\/\w+_description\/package\.xml$/.test(k)).split("/")[5]);
await R("cd ~/ros2_ws && colcon build", 2500); await R("source install/setup.bash");
const launch = mode === "bringup" ? `ros2 launch ${desc.replace(/_description$/, "_bringup")} bringup.launch.py hardware_type:=gz` : `ros2 launch ${desc} ${mode === "control" ? "sim_control.launch.py" : "sim.launch.py"}`;
await R(launch, 6000);
const world = await p.evaluate(() => { const g = window.__ros2lab.sh.graph; return g.gz ? g.gz.world.models.map((m) => `${m.name}${m.static ? "" : "(dyn)"}@${(m.pose || []).slice(0, 2).map((v) => (+v).toFixed(2)).join(",")}`) : null; });
console.log("world:", world && world.join(" "));
await p.evaluate(() => window.__ros2lab.term.newTerminal());
const TOPICS = ["/diff_drive_controller/cmd_vel", "/mecanum_drive_controller/reference", "/ackermann_steering_controller/reference"];
const track = [];
for (let i = 0; i < Number(secs); i++) {
  // keep a publisher alive at 4 Hz (controllers stop 0.5 s after the last command)
  for (let k = 0; k < 4; k++) { await p.waitForTimeout(250); await p.evaluate(({ mode, TOPICS }) => { const g = window.__ros2lab.sh.graph; if (mode === "control") { for (const t of TOPICS) g.cmDeliver(t, "geometry_msgs/msg/TwistStamped", { twist: { linear: { x: 0.3, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } } }); } else g.gzTwist("/cmd_vel", { lx: 0.3, ly: 0, lz: 0, ax: 0, ay: 0, az: 0 }); }, { mode, TOPICS }); }
  track.push(await p.evaluate(() => { const g = window.__ros2lab.sh.graph, m = g.gz && [...g.gz.models.values()][0]; return m ? `${m.pose.x.toFixed(2)}${m.bumped ? "*" : ""}${m.airborne ? "^" : ""}` : "-"; }));
}
console.log("x over time (* = blocked, ^ = in the air):", track.join(" "));
const gzlog = await p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => x.innerText).join("\n").split("\n").filter((l) => /urdf2sdf|Wrn|Err\]|Warning \[|Error Code|falls through|left out/.test(l)).slice(0, 12).join("\n"));
const z = await p.evaluate(() => { const g = window.__ros2lab.sh.graph, m = g.gz && [...g.gz.models.values()][0]; return m ? { z: +m.pose.z.toFixed(3), restZ: m.restZ, links: Object.keys(m.model.links).length, urdfLinks: Object.keys(m.urdfModel.links).length } : null; });
console.log("final", JSON.stringify(z));
if (gzlog) console.log(gzlog);
console.log("ERRS", errs);
await b.close();
