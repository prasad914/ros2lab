// Student mistakes from expert_review_2026-10-18 (must-fix 3, 5, 6), checked against the real-ROS captures in
// parity/fixtures/tb3_burger/REVIEW_CAPTURES_2026-10-18.md. Faithful error first, beginner hint second.
import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import { FIX, Recorder, openWorld, prepTerm, run, screens, text, waitText } from "./lib";

test.describe.configure({ timeout: 600000 });
const B = path.join(FIX, "tb3_burger");
// "<source line>:<log line>" excerpt -> [level, logger, message] of the lines that match `keep`
function fixtureLines(file: string, keep: RegExp) {
  // the colour codes some loggers print (lifecycle_manager) are not text on a terminal
  return text(file).split("\n").filter((l) => !l.startsWith("#")).map((l) => l.replace(/^\d+:/, "").replace(/\x1b?\[[0-9;]+m/g, ""))
    .map((l) => l.match(/\[(INFO|WARN|ERROR|FATAL)\] (?:\[\d+\.\d+\] )?\[([^\]]+)\]: (.*)$/)).filter((m): m is RegExpMatchArray => !!m && keep.test(m[0]))
    .map((m) => ({ level: m[1], logger: m[2], msg: m[3].replace(/\/home\/prasad/g, "/home/student") }));
}
const hasLine = (screen: string, l: { level: string; logger: string; msg: string }) =>
  screen.split("\n").some((s) => s.includes(`[${l.level}]`) && s.includes(`[${l.logger}]: ${l.msg}`));
async function openPage(p: Page, robot = "tb3_burger") {
  await p.goto(`/rviz.html?robot=${robot}`);
  await p.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  await run(p, "cd ~/ros2_ws"); await run(p, "colcon build --symlink-install"); await run(p, "source install/setup.bash");
}

test("tb3_burger no_tb3_model: turtlebot3_world.launch.py without TURTLEBOT3_MODEL", async ({ page }) => {
  const rec = new Recorder("tb3_burger", "mistakes"), fx = path.join(B, "sensors", "errors", "no_tb3_model", "launch_runner.txt");
  try {
    await openPage(page);
    await run(page, "unset TURTLEBOT3_MODEL");
    await run(page, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
    const want = fixtureLines(fx, /\[launch\]/).filter((l) => l.level !== "INFO" || /verbosity/.test(l.msg));
    await waitText(page, /Caught exception in launch|process started/, 90000);
    await page.waitForTimeout(3000);
    const s = await screens(page);
    for (const l of want) rec.exact(`no_tb3_model: [${l.level}] [${l.logger}]: ${l.msg}`, "line present", hasLine(s, l) ? "line present" : "missing", fx);
    rec.exact("no_tb3_model: no process started", "0 processes", `${(s.match(/process started with pid/g) || []).length} processes`, fx);
    rec.exact("no_tb3_model: hint after the error", "hint names export TURTLEBOT3_MODEL", /export TURTLEBOT3_MODEL=/.test(s.split("Caught exception in launch").slice(1).join("")) ? "hint names export TURTLEBOT3_MODEL" : "no hint", fx);
  } finally { rec.save(); }
});

test("tb3_burger bad_map_path: navigation2.launch.py with a missing map file", async ({ page }) => {
  const rec = new Recorder("tb3_burger", "mistakes_bad_map"), fx = path.join(B, "nav_robotis", "errors", "bad_map_path", "nav2_runner.txt");
  try {
    expect(await openWorld(page, "tb3_burger")).toBe(true);
    await prepTerm(page, "tb3_burger");
    await run(page, "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:=$HOME/map.yaml");
    // fixture lines 63-71: map_server configure fails, lifecycle_manager_localization aborts (5.6 s after start)
    const want = fixtureLines(fx, /\[(map_io|map_server|lifecycle_manager_localization)\]/).filter((l) => /Configuring map_server|Loading yaml|Failed processing|Caught exception|Original error|Callback returned|error state|Failed to change state|Failed to bring up/.test(l.msg));
    await waitText(page, /\[lifecycle_manager_localization\]: Failed to bring up all requested nodes/, 120000);
    await page.waitForTimeout(2000);
    const s = await screens(page);
    for (const l of want) rec.exact(`bad_map_path: [${l.level}] [${l.logger}]: ${l.msg}`, "line present", hasLine(s, l) ? "line present" : "missing", fx);
    rec.exact("bad_map_path: hint after the error", "hint", /\/home\/student\/map\.yaml[\s\S]*(map_saver_cli|does not exist|no file)/.test(s.split("Aborting bringup").slice(1).join("")) ? "hint" : "no hint", fx);
    // the launch does not exit by itself (fixture: killed by timeout 180, exit code 124)
    rec.exact("bad_map_path: launch keeps running", "running", await page.evaluate(() => (window as any).__ros2lab.term.busy()) ? "running" : "exited", fx);
  } finally { rec.save(); }
});

test("tb3_burger nav2_bringup tb3_simulation_launch.py: honest note, no fake failure", async ({ page }) => {
  await openPage(page);
  await run(page, "ros2 launch nav2_bringup tb3_simulation_launch.py headless:=True use_rviz:=False");
  await waitText(page, /not simulated on ROS2Lab yet|Aborting bringup/, 120000);
  await page.waitForTimeout(3000);
  const s = await screens(page);
  expect(s).toContain("not simulated on ROS2Lab yet");
  expect(s).not.toMatch(/Aborting bringup|Failed to activate/);
});

// must-fix 7: what each teleop publishes on /cmd_vel (sensors/teleop/topic_info_cmd_vel_*_runner.txt)
function cmdVelInfo(t: string) {
  const type = (t.match(/^Type: (.*)$/m) || [])[1] || "";
  const pubs: string[] = [];
  for (const b of t.split(/\n(?=Node name: )/)) {
    const n = (b.match(/^Node name: (\S+)/m) || [])[1], ty = (b.match(/^Topic type: (\S+)/m) || [])[1], k = (b.match(/^Endpoint type: (\S+)/m) || [])[1];
    if (n && k === "PUBLISHER") pubs.push(`${n} ${ty}`);
  }
  return { type, pubs: pubs.sort() };
}
test("tb3_burger teleop: /cmd_vel types of teleop_twist_keyboard and turtlebot3_teleop", async ({ page }) => {
  const rec = new Recorder("tb3_burger", "mistakes_teleop");
  try {
    // one fresh page per teleop (the terminal API cannot stop one background terminal)
    for (const [name, cmd] of [["teleop_twist_keyboard", "ros2 run teleop_twist_keyboard teleop_twist_keyboard"], ["teleop_keyboard", "ros2 run turtlebot3_teleop teleop_keyboard"],
      ["teleop_twist_keyboard_stamped", "ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true"]]) {
      const fx = path.join(B, "sensors", "teleop", `topic_info_cmd_vel_${name}_runner.txt`), want = cmdVelInfo(text(fx).split("\n").map((l) => l.replace(/^\d+:/, "")).join("\n"));
      expect(await openWorld(page, "tb3_burger")).toBe(true);
      await prepTerm(page, "tb3_burger"); await run(page, cmd); await page.waitForTimeout(4000);
      await prepTerm(page, "tb3_burger"); await run(page, "ros2 topic info /cmd_vel -v"); await page.waitForTimeout(3000);
      const got = cmdVelInfo((await screens(page)).split("=====").pop()!.split("ros2 topic info /cmd_vel -v").pop()!);
      rec.exact(`${name}: Type line`, want.type, got.type, fx);
      rec.exact(`${name}: publishers`, want.pubs, got.pubs, fx);
    }
  } finally { rec.save(); }
});
