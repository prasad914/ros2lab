import { open, pick, run, tab, lastScreen } from "./lib.mjs";
const { b, p, errs } = await open(); await pick(p, process.argv[2] || "ur5e");
await run(p, "cd ~/ros2_ws && colcon build", 2500); await run(p, "source install/setup.bash");
const cases = [["ros2 to", 1], ["ros2 ", 2], ["ros2 topic ", 2], ["ros2 launch ur", 2], ["ros2 launch ur5e_moveit_config ", 2], ["ros2 launch ur5e_moveit_config demo", 1], ["ros2 launch ur5e_moveit_config demo.launch.py ", 2], ["ros2 run ur5e_moveit_config ", 2], ["ros2 interface show geometry_msgs/msg/Tw", 2], ["ros2 topic pub /cmd_vel geometry_msgs/msg/Twist ", 1], ["colcon build --packages-select ur5", 2], ["cd sr", 1], ["ros2 pkg prefix ur5e_g", 1], ["ros2 control ", 2], ["complete -p", 0]];
for (const [t, n] of cases) {
  if (n === 0) { await run(p, t); console.log(await lastScreen(p, 3)); continue; }
  const r = await tab(p, t, n);
  console.log(`[${t}] x${n} -> value=${JSON.stringify(r.value)}\n${n > 1 ? r.screen.split("\n").slice(-4).join("\n") : ""}\n`);
}
console.log("ERRS", errs); await b.close();
