import { open, pick, run, lastScreen, tab } from "./lib.mjs";
const robots = process.argv.slice(2).length ? process.argv.slice(2) : ["ur5e", "tb3_burger", "chiku", "quadcopter", "go2", "arm6"];
for (const r of robots) {
  const { b, p, errs } = await open();
  await pick(p, r);
  console.log(`\n######## ${r}`);
  await run(p, "cd ~/ros2_ws && colcon build", 2500);
  await run(p, "source install/setup.bash");
  console.log("TAB ros2 to ->", JSON.stringify(await tab(p, "ros2 to")));
  console.log("TAB2 ros2 launch  ->", JSON.stringify(await tab(p, "ros2 launch ", 2)));
  console.log("TAB ros2 launch pkg ->", JSON.stringify(await tab(p, `ros2 launch ${r}_`, 2)));
  await run(p, "ros2 pkg list | grep " + r.split("_")[0]);
  console.log(await lastScreen(p, 8));
  await run(p, "code ~/ros2_ws", 2500);
  const tree = await p.evaluate(() => [...document.querySelectorAll(".vsc-tree, .vsc-explorer, [class*=vsc] [role=tree]")].map((x) => x.innerText.slice(0, 600)).join("|"));
  console.log("VSCODE TREE:", tree.replace(/\n/g, " / "));
  console.log("ERRS", errs.join("\n"));
  await b.close();
}
