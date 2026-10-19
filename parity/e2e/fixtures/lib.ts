// Fixture parity helpers (step F): read the COMMITTED real-ROS fixtures, drive the website like a student, compare
// with window.__ros2lab, and record one row per item in parity/browser_out/fixture_parity/<robot>/<scenario>.json.
// Exact items are PASS/FAIL (a FAIL fails the test through expect.soft). Numeric items use parity/thresholds.yaml when
// it has a limit for them, else PENDING-THRESHOLD with both values. Nothing here is a hand-copied expected value.
import { expect, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "..", "..", "..");
export const FIX = path.join(ROOT, "parity", "fixtures");
export const OUT = path.join(ROOT, "parity", "browser_out", "fixture_parity");
export const ROBOTS = ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"] as const;
export const MODEL: Record<string, string> = { tb3_burger: "burger", tb3_waffle: "waffle", tb3_waffle_pi: "waffle_pi" };

export const rel = (p: string) => path.relative(ROOT, p);
export const exists = (p: string) => fs.existsSync(p);
export const text = (p: string) => fs.readFileSync(p, "utf8");

/** YAML (or JSON) file -> object, parsed by PyYAML so the fixture is read exactly as the capture scripts wrote it. */
export function yaml(p: string): any {
  const out = execFileSync("python3", ["-I", "-c",
    "import json,sys,yaml\nprint(json.dumps(list(yaml.safe_load_all(open(sys.argv[1])))))", p], { encoding: "utf8" });
  const docs = JSON.parse(out).filter((d: any) => d !== null);
  return docs[0];
}

/** `ros2 topic list -t` output -> [{name, type}] */
export function topicList(p: string): { name: string; type: string }[] {
  return text(p).split("\n").map((l) => l.match(/^(\/\S*) \[(.+)\]$/)).filter(Boolean)
    .map((m) => ({ name: m![1], type: m![2] }));
}

export type Endpoint = { node: string; kind: "PUBLISHER" | "SUBSCRIPTION"; reliability: string; durability: string };
/** `ros2 topic info -v` output -> {type, endpoints}; null when the file says the topic is unknown. */
export function topicInfo(p: string): { type: string; endpoints: Endpoint[]; unknown: boolean } {
  const t = text(p);
  if (/Unknown topic/.test(t)) return { type: "", endpoints: [], unknown: true };
  const type = (t.match(/^Type: (.+)$/m) || [])[1] || "";
  const endpoints: Endpoint[] = [];
  for (const block of t.split(/\n(?=Node name: )/).slice(1)) {
    const g = (re: RegExp) => (block.match(re) || [])[1] || "";
    const ns = g(/^Node namespace: (.+)$/m).replace(/^\/+|\/+$/g, "");
    endpoints.push({ node: (ns ? ns + "/" : "") + g(/^Node name: (.+)$/m), kind: g(/^Endpoint type: (.+)$/m) as any,
      reliability: g(/^\s+Reliability: (.+)$/m), durability: g(/^\s+Durability: (.+)$/m) });
  }
  return { type, endpoints, unknown: false };
}
/** Tool nodes of the capture (ros2cli daemon, ros2 topic info/echo, rosbag2) are not part of the robot's graph. */
export const isToolNode = (n: string) => /^_ros2cli|^ros2cli|^_NODE_NAME_UNKNOWN_|^rosbag2_recorder/.test(n.replace(/^\//, ""));

/** Node names with a per-process suffix (launch_ros_<pid>, transform_listener_impl_<address>) compared by role. */
export const roleName = (n: string) => n.replace(/^launch_ros_\d+$/, "launch_ros_<pid>").replace(/^transform_listener_impl_[0-9a-f]+$/, "transform_listener_impl_<id>");

/** view_frames .gv -> sorted "parent -> child" edges */
export function gvEdges(p: string): string[] {
  return [...text(p).matchAll(/^"([^"]+)" -> "([^"]+)"\[/gm)].map((m) => `${m[1]} -> ${m[2]}`).sort();
}
export function framesFile(dir: string): string | null {
  if (!exists(dir)) return null;
  const f = fs.readdirSync(dir).filter((x) => /^frames_.*\.gv$/.test(x)).sort().pop();
  return f ? path.join(dir, f) : null;
}

/** Leaf keys of a nested object as "a.b.c" -> value (arrays are leaves), like ROS 2 parameter names. */
export function flatten(o: any, prefix = "", out: Record<string, any> = {}): Record<string, any> {
  for (const [k, v] of Object.entries(o || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out); else out[key] = v;
  }
  return out;
}

export const thresholds: Record<string, any> = yaml(path.join(ROOT, "parity", "thresholds.yaml")) || {};

type Row = { item: string; kind: "exact" | "numeric"; status: string; expected: any; actual: any; fixture: string; note?: string };

/** Collects the items of one robot x scenario and writes them to browser_out. */
export class Recorder {
  rows: Row[] = [];
  constructor(public robot: string, public scenario: string) {}
  exact(item: string, expected: any, actual: any, fixture: string, pass?: boolean, note?: string) {
    const ok = pass ?? JSON.stringify(expected) === JSON.stringify(actual);
    this.rows.push({ item, kind: "exact", status: ok ? "PASS" : "FAIL", expected, actual, fixture: rel(fixture), note });
    expect.soft(ok, `${this.robot}/${this.scenario}: ${item}\nexpected ${JSON.stringify(expected)}\nactual   ${JSON.stringify(actual)}\nfixture ${rel(fixture)}`).toBe(true);
  }
  /** limitKey: the thresholds.yaml key that would judge this value; check(limit) -> pass when a limit exists. */
  numeric(item: string, expected: any, actual: any, fixture: string, limitKey?: string, check?: (limit: any) => boolean, note?: string) {
    const limit = limitKey ? thresholds[limitKey] : null;
    if (limit === null || limit === undefined || !check) {
      this.rows.push({ item, kind: "numeric", status: "PENDING-THRESHOLD", expected, actual, fixture: rel(fixture),
        note: note ?? (limitKey ? `thresholds.yaml ${limitKey}: null` : "no thresholds.yaml key for this value") });
      return;
    }
    const ok = check(limit);
    this.rows.push({ item, kind: "numeric", status: ok ? "PASS" : "FAIL", expected, actual, fixture: rel(fixture), note: `${limitKey}: ${limit}` });
    expect.soft(ok, `${this.robot}/${this.scenario}: ${item} (${limitKey} ${limit})`).toBe(true);
  }
  /** An item that could not be compared (no fixture for this robot, or the site could not reach the state). */
  pending(item: string, why: string, fixture = "") {
    this.rows.push({ item, kind: "exact", status: "NOT-VALIDATED", expected: null, actual: null, fixture: fixture && rel(fixture), note: why });
  }
  save() {
    const dir = path.join(OUT, this.robot);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${this.scenario}.json`), JSON.stringify({ robot: this.robot, scenario: this.scenario,
      captured: new Date().toISOString(), rows: this.rows }, null, 2) + "\n");
  }
}

// ---------------------------------------------------------------- driving the website
export const run = (p: Page, cmd: string) => p.evaluate((c) => (window as any).__ros2lab.term.run(c), cmd);
export const screens = (p: Page) => p.evaluate(() => [...document.querySelectorAll(".term-screen")].map((x) => (x as HTMLElement).innerText).join("\n=====\n"));
export async function waitText(p: Page, re: RegExp, ms = 60000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (re.test(await screens(p))) return true; await p.waitForTimeout(500); }
  return false;
}
/** A terminal set up like the reference machine: the workspace sourced and TURTLEBOT3_MODEL exported. */
export async function prepTerm(p: Page, robot: string, newTerminal = true) {
  if (newTerminal) await p.evaluate(() => (window as any).__ros2lab.term.newTerminal());
  for (const c of ["cd ~/ros2_ws", "source install/setup.bash", `export TURTLEBOT3_MODEL=${MODEL[robot]}`]) await run(p, c);
}
/** Open the robot page, build the official workspace once, and start the TurtleBot3 world like start_reference.sh. */
/** Returns true once the spawn (create) process finished; false (with the terminal text in lastScreen) otherwise. */
export let lastScreen = "";
export async function openWorld(p: Page, robot: string) {
  await p.goto(`/rviz.html?robot=${robot}`);
  // the official ROBOTIS workspace (sh.realWs); a robot page without it still gets the same commands, like a student
  await p.waitForFunction(() => (window as any).__ros2lab?.sh?.realWs, null, { timeout: 60000 }).catch(() => {});
  await p.waitForFunction(() => !!(window as any).__ros2lab?.term, null, { timeout: 30000 });
  await run(p, "cd ~/ros2_ws");
  await run(p, "colcon build --symlink-install");
  await prepTerm(p, robot, false);
  await run(p, "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py");
  const ok = await waitText(p, /\[create-\d+\]: process has finished cleanly/, 120000);
  lastScreen = (await screens(p)).split("\n").filter((l) => l.trim()).slice(-6).join(" | ");
  return ok;
}
/** Copy a committed fixture file onto the website's file system (what `map:=<path>` reads on the reference machine). */
export async function putFile(p: Page, dest: string, src: string) {
  const bytes = [...fs.readFileSync(src)];
  await p.evaluate(({ dest, bytes }) => {
    const sh = (window as any).__ros2lab.sh, u8 = new Uint8Array(bytes);
    sh.mkdirP(dest.replace(/\/[^/]*$/, ""));
    const isText = !/\.pgm$/.test(dest);
    sh.fs.set(dest, { type: "f", mode: "rw-r--r--", content: isText ? new TextDecoder().decode(u8) : `(binary PGM image, ${u8.length} bytes)`, bytes: isText ? undefined : u8 });
  }, { dest, bytes });
}

/** window.__ros2lab state used by the comparisons. */
export async function siteState(p: Page) {
  return p.evaluate(() => {
    const r = (window as any).__ros2lab;
    return {
      topics: r.topics.map((t: any) => ({ name: t.name, type: t.type,
        endpoints: [...t.publishers, ...t.subscribers].map((e: any) => ({ node: String(e.node).replace(/^\//, ""), kind: e.endpoint_type,
          reliability: String(e.qos.raw).split("/")[0], durability: String(e.qos.raw).split("/")[1] })) })),
      edges: r.tf.edges.map((e: any) => `${e.parent} -> ${e.child}`).sort(),
      nodes: r.nodes.map((n: any) => ({ full: n.full, params: n.params })),
      lifecycle: r.lifecycleStates.map((l: any) => ({ node: l.node, state: l.state })),
      sensors: { cameraInfo: r.sensors.cameraInfo, imageInfo: r.sensors.imageInfo },
    };
  });
}

/** Topic list + types and the QoS files of one fixture snapshot directory against the site. */
export function compareGraph(rec: Recorder, site: Awaited<ReturnType<typeof siteState>>, dir: string, opts: { topicFile?: string } = {}) {
  const tl = opts.topicFile || path.join(dir, "topic_list.txt");
  if (exists(tl)) {
    const exp = topicList(tl).map((t) => `${t.name} [${t.type}]`).sort();
    const act = site.topics.map((t) => `${t.name} [${t.type}]`).sort();
    const missing = exp.filter((x) => !act.includes(x)), extra = act.filter((x) => !exp.includes(x));
    rec.exact("topics + types", exp.length + " topics", act.length + " topics", tl, !missing.length && !extra.length,
      missing.length || extra.length ? `missing on site: ${missing.join(", ") || "none"}; extra on site: ${extra.join(", ") || "none"}` : undefined);
  } else rec.pending("topics + types", "no topic_list.txt fixture", tl);
  const qdir = path.join(dir, "qos");
  if (!exists(qdir)) return;
  for (const f of fs.readdirSync(qdir).filter((x) => x.endsWith(".txt") && !x.endsWith("_hz.txt")).sort()) {
    const fx = path.join(qdir, f), info = topicInfo(fx);
    const topic = "/" + f.replace(/\.txt$/, "").replace(/__/g, "/");
    const st = site.topics.find((t) => t.name === topic);
    if (info.unknown) {
      // "Unknown topic" for a topic the same snapshot's topic list has is a capture gap (ROS 2 daemon), not absence
      if (exists(tl) && topicList(tl).some((t) => t.name === topic)) { rec.pending(`QoS ${topic}`, `capture gap: ${rel(fx)} says Unknown topic, ${rel(tl)} lists it`, fx); continue; }
      rec.exact(`QoS ${topic}: topic absent`, "absent", st ? "present" : "absent", fx); continue;
    }
    const key = (e: Endpoint) => `${e.kind} ${roleName(e.node)} ${e.reliability}/${e.durability}`;
    const exp = [...new Set(info.endpoints.filter((e) => !isToolNode(e.node)).map(key))].sort();
    const act = [...new Set((st?.endpoints || []).filter((e: Endpoint) => !isToolNode(e.node)).map(key))].sort();
    rec.exact(`QoS ${topic}`, exp, act, fx);
  }
}
