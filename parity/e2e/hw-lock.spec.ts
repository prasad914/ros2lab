import { test, expect, Page } from "@playwright/test";

// expert_review_robots_2026-10-18 site-wide #1: the real-hardware lock goes by what a launch starts (a non-mock
// hardware plugin, a real driver node, the crazyflie cpp / cflib backend), not by the card's command string.
// The license server is not reachable from the test browser, so every real-hardware path must be locked.
const run = (p: Page, c: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), c);
const screen = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n=====\n"));
async function launch(page: Page, robot: string, cmd: string) {
  await page.goto(`/rviz.html?robot=${robot}`);
  await page.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs && (window as any).__ros2lab?.term, null, { timeout: 60000 });
  const env = await page.evaluate(() => Object.entries((window as any).__ros2lab.sh.realWs.env).map(([k, v]) => `export ${k}=${v}`));
  // robot.launch.py reads LDS_MODEL (the card entry's env)
  for (const c of ["cd ~/ros2_ws", "colcon build --symlink-install", "source install/setup.bash", ...env, ...(robot.startsWith("tb3") ? ["export LDS_MODEL=LDS-02"] : []), cmd]) await run(page, c);
}
const LOCKED: [string, string, RegExp][] = [
  ["ur5e", "ros2 launch ur_robot_driver ur5e.launch.py robot_ip:=192.168.56.101", /\/dashboard_client\b|\/urscript_interface\b/],
  ["fr3", "ros2 launch franka_bringup franka.launch.py robot_type:=fr3 robot_ip:=172.16.0.2", /^\/controller_manager$/],
  ["xarm6", "ros2 launch xarm_planner xarm6_planner_realmove.launch.py robot_ip:=192.168.1.117", /^\/controller_manager$/],
  ["xarm6", "ros2 launch xarm_api xarm6_driver.launch.py robot_ip:=192.168.1.117", /ufactory_driver/],
  ["scout", "ros2 launch scout_base scout_mini_base.launch.py", /scout_base_node/],
  ["crazyflie", "ros2 launch crazyflie_examples keyboard_velmux_launch.py", /crazyflie_server/],
  // the cards' own real-hardware commands stay locked
  ["ur5e", "ros2 launch ur_robot_driver ur_control.launch.py ur_type:=ur5e robot_ip:=192.168.56.101 launch_rviz:=true", /\/dashboard_client\b/],
  ["fr3", "ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=172.16.0.2", /^\/controller_manager$/],
  ["xarm6", "ros2 launch xarm_moveit_config xarm6_moveit_realmove.launch.py robot_ip:=192.168.1.117", /^\/controller_manager$/],
  ["gen3", "ros2 launch kortex_bringup gen3.launch.py robot_ip:=192.168.1.10", /^\/controller_manager$/],
  ["wx250s", "ros2 launch interbotix_xsarm_control xsarm_control.launch.py robot_model:=wx250s", /xs_sdk/],
  ["scout", "ros2 launch scout_base scout_base.launch.py", /scout_base_node/],
  ["crazyflie", "ros2 launch crazyflie launch.py", /crazyflie_server/],
  ["tb3_burger", "ros2 launch turtlebot3_bringup robot.launch.py", /turtlebot3_node|hlds|ld08/],
  ["cr5", "ros2 launch dobot_bringup_v4 dobot_bringup_ros2.launch.py", /dobot_bringup/],
];
for (const [robot, cmd, driver] of LOCKED) {
  test(`hardware lock: ${robot} ${cmd.split(" ").slice(2, 4).join(" ")}`, async ({ page }) => {
    test.setTimeout(240000);
    await launch(page, robot, cmd);
    await page.waitForFunction(() => /real hardware is locked/.test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), null, { timeout: 150000 });
    await page.waitForTimeout(3000);
    const s = await screen(page);
    expect(s).toContain("[ros2lab_hardware_license]");
    expect(s).not.toMatch(/with base class type hardware_interface::SystemInterface does not exist/);
    expect(s).not.toMatch(/Failed to load hardware component/);
    const nodes: string[] = await page.evaluate(() => (window as any).__ros2lab.sh.graph.nodes.map((n: any) => n.full));
    expect(nodes.filter((n) => driver.test(n))).toEqual([]);
    // Phase 1 item 3: stopped before any process starts, the note once, no made-up process exits, nothing left
    expect(s.match(/real hardware is locked/g)).toHaveLength(1);
    expect(s).not.toMatch(/process started with pid/);
    expect(s).not.toMatch(/process has died/);
    expect(s).not.toMatch(/user interrupted with ctrl-c/);
    expect(s).not.toMatch(/You can start planning now!/);
    expect(nodes).toEqual([]);
  });
}
test("hardware lock: ur5e.launch.py leaves no /controller_manager in ros2 node list", async ({ page }) => {
  test.setTimeout(240000);
  await launch(page, "ur5e", "ros2 launch ur_robot_driver ur5e.launch.py robot_ip:=192.168.56.101");
  await page.waitForFunction(() => /real hardware is locked/.test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), null, { timeout: 150000 });
  await page.waitForFunction(() => !(window as any).__ros2lab.term.busy(), null, { timeout: 30000 });
  await page.waitForTimeout(8000);   // a model started by the launch must not come up after it ended
  await run(page, "ros2 node list");
  await page.waitForTimeout(1500);
  const after = (await screen(page)).split("ros2 node list").pop() || "";
  expect(await page.evaluate(() => (window as any).__ros2lab.sh.graph.nodes.map((n: any) => n.full))).toEqual([]);
  expect(after).not.toMatch(/\/controller_manager/);
});
// the same packages with the makers' mock / sim switches need no license
const OPEN: [string, string, RegExp][] = [
  ["ur5e", "ros2 launch ur_robot_driver ur_control.launch.py ur_type:=ur5e robot_ip:=192.168.56.101 use_mock_hardware:=true", /Configured and activated .*joint_state_broadcaster|Successful 'activate' of hardware/],
  ["crazyflie", "ros2 launch crazyflie launch.py backend:=sim rviz:=False", /crazyflie_sim is modelled/],
];
for (const [robot, cmd, ok] of OPEN) {
  test(`no hardware lock: ${robot} ${cmd.split(" ").slice(2, 4).join(" ")} (mock / sim)`, async ({ page }) => {
    test.setTimeout(240000);
    await launch(page, robot, cmd);
    await page.waitForFunction((src) => new RegExp(src).test([...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n")), ok.source, { timeout: 150000 });
    expect(await screen(page)).not.toMatch(/real hardware is locked|ros2lab_hardware_license/);
  });
}
