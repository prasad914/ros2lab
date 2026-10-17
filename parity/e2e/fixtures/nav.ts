// Nav2 helpers for the fixture specs: log lines of the real excerpts, goals, initial pose, parameters.
import { Page } from "@playwright/test";
import path from "node:path";
import { FIX, Recorder, flatten, prepTerm, run, screens, text, yaml } from "./lib";

export const GOALS = yaml(path.join(FIX, "goals.yaml"));
export const SITE_MAP = "/home/student/parity_maps/turtlebot3_world.yaml";

export type LogLine = { level: string; logger: string; msg: string; src: string };
/** "<n>:[proc] [LEVEL] [stamp] [logger]: msg" lines of a committed excerpt (nav2_goal_lines.txt, excerpt.txt). */
export function logLines(file: string): LogLine[] {
  return text(file).split("\n").map((l) => l.match(/^(\d+):.*?\[(INFO|WARN|ERROR|FATAL)\] \[[\d.]+\] \[([^\]]+)\]: (.*)$/))
    .filter(Boolean).map((m) => ({ level: m![2], logger: m![3], msg: m![4].replace(/\x1b\[[0-9;]*m/g, ""), src: `${file}:${m![1]}` }));
}
export const stamp = (file: string, src: string) => Number((text(file).split("\n").find((l) => l.startsWith(src.split(":").pop() + ":")) || "").match(/\[(\d+\.\d+)\]/)?.[1]);
/** thresholds.yaml error_text_match: exact_or_normalised – robot positions inside the text are normalised. */
export const normalise = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\((-?\d+\.\d+), (-?\d+\.\d+)\)/g, "(X, Y)").trim();
/** The site prints "[LEVEL] [stamp] [logger]: msg" in the launch terminal; true if the same line (normalised) is there. */
export function siteHasLine(screen: string, l: LogLine): boolean {
  const want = `[${l.level}]`, tail = `[${l.logger}]: ${normalise(l.msg)}`;
  return screen.split("\n").some((s) => s.includes(want) && normalise(s).endsWith(tail));
}
export function checkLines(rec: Recorder, screen: string, file: string, lines: LogLine[], label: string) {
  for (const l of lines) {
    rec.exact(`${label}: [${l.level}] [${l.logger}] ${l.msg.slice(0, 90)}`, `${l.level} ${l.logger}: ${normalise(l.msg)}`,
      siteHasLine(screen, l) ? `${l.level} ${l.logger}: ${normalise(l.msg)}` : "not printed", file);
  }
}

/** Publish the goals.yaml start pose on /initialpose (what the reference scripts do before navigation). */
export async function setInitialPose(p: Page, robot: string) {
  const s = GOALS.start_pose, o = s.orientation;
  await prepTerm(p, robot);
  await run(p, `ros2 topic pub --once /initialpose geometry_msgs/msg/PoseWithCovarianceStamped "{header: {frame_id: ${s.frame_id}}, pose: {pose: {position: {x: ${s.position.x}, y: ${s.position.y}, z: ${s.position.z}}, orientation: {x: ${o.x}, y: ${o.y}, z: ${o.z}, w: ${o.w}}}, covariance: [${s.covariance.join(", ")}]}}"`);
}

export type GoalResult = { status: string | null; error_code: number | null; error_msg: string | null; screen: string };
/** ros2 action send_goal /navigate_to_pose in a new terminal; waits for "Goal finished with status". */
export async function sendGoal(p: Page, robot: string, g: { x: number; y: number; z?: number; w?: number }, ms = 240000): Promise<GoalResult> {
  await prepTerm(p, robot);
  const before = (await screens(p)).split("\n=====\n").length;
  await run(p, `ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose "{pose: {header: {frame_id: map}, pose: {position: {x: ${g.x}, y: ${g.y}, z: 0.0}, orientation: {z: ${g.z ?? 0}, w: ${g.w ?? 1}}}}}"`);
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < ms) {
    const all = (await screens(p)).split("\n=====\n");
    last = all[before - 1] ?? all[all.length - 1];
    if (/Goal finished with status: \w+/.test(last)) break;
    await p.waitForTimeout(1000);
  }
  const st = last.match(/Goal finished with status: (\w+)/);
  const ec = [...last.matchAll(/error_code: (\d+)/g)].pop();
  const em = [...last.matchAll(/error_msg: '?([^'\n]*)'?/g)].pop();
  return { status: st ? st[1] : null, error_code: ec ? Number(ec[1]) : null, error_msg: em ? em[1] : null, screen: last };
}

/** Installed params file -> { "/node": {flat params} } (nested "local_costmap: local_costmap:" -> /local_costmap/local_costmap). */
export function paramsByNode(file: string): Record<string, Record<string, any>> {
  const y = yaml(file), out: Record<string, Record<string, any>> = {};
  for (const [k, v] of Object.entries<any>(y)) {
    if (v?.ros__parameters) out[`/${k}`] = flatten(v.ros__parameters);
    else for (const [k2, v2] of Object.entries<any>(v || {})) if (v2?.ros__parameters) out[`/${k}/${k2}`] = flatten(v2.ros__parameters);
  }
  return out;
}
export const sameValue = (a: any, b: any) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : JSON.stringify(a) === JSON.stringify(b));
