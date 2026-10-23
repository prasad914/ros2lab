// TurtleBot3 motion (Night 1, Part 3): the site's Gazebo model against REAL Gazebo captures on the development PC.
// node tests/tb3-motion.test.mjs   (needs python3; no browser, no server)
// For each case it runs parity/compare/site_tb3_motion.mjs on this checkout's public/ and parity/compare/tb3_motion_fit.py
// on both sides, then checks the quantities below within their tolerances (the limits are written next to each check).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { tb3Kind } from "../public/js/tb3-motion.js";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
let fails = 0, oks = 0;
const check = (ok, what) => { if (ok) oks++; else { fails++; console.log("FAIL", what); } };

// which models get the TurtleBot3 motion: only turtlebot3_gazebo's model.sdf files
check(tb3Kind({ file: "/opt/ros/jazzy/share/turtlebot3_gazebo/models/turtlebot3_burger/model.sdf" }) === "burger", "burger model.sdf");
check(tb3Kind({ uri: "model://turtlebot3_waffle_pi" }) === "waffle_pi", "waffle_pi uri");
check(tb3Kind({ file: "/x/models/turtlebot3_waffle/model.sdf" }) === "waffle", "waffle model.sdf");
check(tb3Kind({ file: "/x/models/turtlebot3_burger_noacc/model.sdf" }) === null, "a copy with another name is not a TurtleBot3");
check(tb3Kind({ file: "/x/vehicle_blue/model.sdf" }) === null, "other robots keep the kinematic drive");

const REAL = `${root}/parity/fixtures/tb3_jazzy_v3/physics`;
const CASES = ["tb3_lin", "tb3_ang", "tb3_stop", "tb3_wall", "tb3wp_lin", "tb3wp_ang"].filter((c) => existsSync(`${REAL}/${c}/case.json`));
check(CASES.length >= 4, `real captures present (${CASES.join(", ")})`);
const out = mkdtempSync(`${tmpdir()}/tb3m-`);
execFileSync("node", [`${root}/parity/compare/site_tb3_motion.mjs`, `${root}/public`, out, ...CASES.map((c) => `${REAL}/${c}`)], { cwd: root, stdio: "ignore" });
const fit = (dirs) => { const j = `${out}/fit_${Math.random().toString(36).slice(2)}.json`; execFileSync("python3", [`${root}/parity/compare/tb3_motion_fit.py`, ...dirs, "--json", j], { cwd: root, stdio: "ignore", maxBuffer: 1 << 26 }); return Object.fromEntries(JSON.parse(readFileSync(j, "utf8")).map((r) => [r.case, r.summary])); };
const real = fit(CASES.map((c) => `${REAL}/${c}`)), site = fit(CASES.map((c) => `${out}/${c}`));
const m = (S, c, k) => S[c] && S[c][k] ? S[c][k].mean : null;
// tolerance: |site - real| <= abs + rel * |real|
const near = (c, k, abs, rel = 0) => { const r = m(real, c, k), s = m(site, c, k); check(r != null && s != null && Math.abs(s - r) <= abs + rel * Math.abs(r), `${c} ${k}: site ${s == null ? "n/a" : s.toFixed(4)} vs real ${r == null ? "n/a" : r.toFixed(4)} (tolerance ${abs}${rel ? ` + ${rel * 100} %` : ""})`); };
for (const c of CASES) {
  if (/lin$/.test(c)) { near(c, "pos_error", 0.01); near(c, "gt_v_t50", 0.05); near(c, "gt_v_t90", 0.1); near(c, "odom_v_t90", 0.05); }
  if (/ang$/.test(c)) { near(c, "yaw_error", 0.1); near(c, "gt_w_t50", 0.1); near(c, "gt_w_t90", 0.15); }
  if (c === "tb3_stop") { near(c, "gt_stop_dist", 0.01); near(c, "odom_stop_dist", 0.01); }
  if (c === "tb3_wall") { near(c, "gt_x_end", 0.02); near(c, "odom_x_end", 0.05, 0.05); }
}
console.log(`tb3-motion: ${oks} ok, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
