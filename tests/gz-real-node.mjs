// Runs the gz-real scenarios in Node (fast development loop; the same scenarios run in Chromium with gz-real-tb3.mjs
// and gz-real-arms.mjs). Usage: node tests/gz-real-node.mjs [tb3|waffle|ur5e|fr3|gen3|xarm6|cr5 ...]
import { makeResolver, fixture } from "./gz-resolver.mjs";
import * as harness from "./gz-harness.mjs";
import * as lib from "./gz-real-lib.mjs";
const P = "../public/js/";
const mods = { sdformat: await import(P + "gz-sdformat.js"), cli: await import(P + "gz-cli.js"), rosgz: await import(P + "ros-gz.js"), rc: await import(P + "ros-control-graph.js"), physics: await import(P + "gz-physics.js"), harness };
const resolve = await makeResolver();
// ur_controllers (Universal_Robots_ROS2_Driver) is part of the UR workspace: its ScaledJointTrajectoryController is a
// joint_trajectory_controller with speed scaling (request to the coordinator: add it to ros2-control.js CONTROLLER_TYPES)
const { CONTROLLER_TYPES } = await import(P + "ros2-control.js");
Object.assign(CONTROLLER_TYPES, { "ur_controllers/ScaledJointTrajectoryController": "jtc", "ur_controllers/SpeedScalingStateBroadcaster": "other", "ur_controllers/GPIOController": "other",
  // franka_example_controllers (franka_ros2 workspace): loaded, but their torque laws are not modeled (they command nothing here)
  "franka_example_controllers/JointImpedanceExampleController": "other",
  // picknik_controllers (apt dependency of ros2_kortex): twist / fault-reset controllers, not modeled
  "picknik_twist_controller/PicknikTwistController": "other", "picknik_reset_fault_controller/PicknikResetFaultController": "other" });
const io = { resolve: async (p) => resolve(p), fixture, log: console.log, yamlIndentless: true };
export const ARMS = {
  ur5e: ["ur5e-1", { controller: "scaled_joint_trajectory_controller" }],
  // franka_gazebo_bringup + franka_description (pinned commits): the URDF has two root links (world, base); urdfdom
  // rejects it, so robot_state_publisher and create fail on Ubuntu too
  fr3: ["fr3-2", { expectCreateFail: "two parents|Two root links" }],
  gen3: ["gen3-1", { controller: "joint_trajectory_controller", expectFail: ["robotiq_gripper_controller"] }],
  xarm6: ["xarm6-3", { controller: "xarm6_traj_controller" }],
  lite6: ["lite6-4", { controller: "lite6_traj_controller" }],
  cr5: ["cr5-1", { controller: "cr5_group_controller" }],
};
const want = process.argv.slice(2);
const all = want.length ? want : ["tb3", "waffle", ...Object.keys(ARMS)];
let failed = 0;
for (const w of all) {
  const r = w === "tb3" ? await lib.tb3World(mods, io) : w === "waffle" ? await lib.tb3Waffle(mods, io) : await lib.armHoldAndFollow(mods, io, ARMS[w][0], ARMS[w][1]);
  for (const c of r.checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${w}: ${c.name}${c.ok ? "" : "  " + String(JSON.stringify(c.info)).slice(-900)}`);
  if (!r.pass) failed++;
}
console.log(failed ? `${failed} scenario(s) failed` : "all scenarios passed");
process.exit(failed ? 1 : 0);
