// Development resolver for the Gazebo loaders: maps the Ubuntu paths a real launch uses
// (/home/student/ros2_ws/install/share/<pkg>/..., /home/student/ros2_ws/install/<pkg>/share/<pkg>/..., /opt/ros/jazzy/share/...)
// onto public/robots/ws/<wsid>/src/** (packages from workspace.json, plus its "alias" table) and public/ros/jazzy/share.zip.
// resolve(path) -> { text } | { bytes } | null, synchronously (Node fs). The coordinator's resolver does the same in the page.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WS = path.join(ROOT, "public/robots/ws");
let share = null;
async function loadShare() {
  if (share) return share;
  const { readZip } = await import("../tools/build-ros-share.mjs");
  share = new Map();
  for (const [n, buf] of readZip(path.join(ROOT, "public/ros/jazzy/share.zip"))) share.set(n, buf);
  return share;
}
export async function makeResolver(wsids = null) {
  const sh = await loadShare();
  const pkgs = new Map(), alias = new Map();
  for (const id of fs.readdirSync(WS)) {
    const f = path.join(WS, id, "workspace.json"); if (!fs.existsSync(f) || (wsids && !wsids.includes(id))) continue;
    const ws = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const p of ws.packages) pkgs.set(p.name, path.join(WS, id, p.path));
    for (const [a, b] of Object.entries(ws.alias || {})) alias.set(path.join(WS, id, a), path.join(WS, id, b));
  }
  const textExt = /\.(sdf|world|urdf|xacro|xml|yaml|yml|config|launch|py|dae|obj|mtl|material|rviz|txt)$/i;
  const out = (file, buf) => (textExt.test(file) ? { text: buf.toString("utf8") } : { bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) });
  const resolve = (p) => {
    const s = String(p).replace(/^file:\/\//, "");
    let m = s.match(/^\/home\/student\/ros2_ws\/install\/(?:([\w-]+)\/)?share\/([\w-]+)\/(.*)$/);
    if (m && pkgs.has(m[2])) {
      let f = path.join(pkgs.get(m[2]), m[3]);
      if (!fs.existsSync(f) && alias.has(f)) f = alias.get(f);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return out(f, fs.readFileSync(f));
      return null;
    }
    m = s.match(/^\/opt\/ros\/jazzy\/(share\/.*)$/);
    if (m && sh.has(m[1])) return out(m[1], sh.get(m[1]));
    return null;
  };
  resolve.pkgs = pkgs;
  return resolve;
}
export const ENV = (extra = {}) => ({ HOME: "/home/student", AMENT_PREFIX_PATH: "/home/student/ros2_ws/install:/opt/ros/jazzy", ...extra });
export function fixture(name) { return JSON.parse(fs.readFileSync(path.join(ROOT, "tests/gz-fixtures", name + ".json"), "utf8")); }
