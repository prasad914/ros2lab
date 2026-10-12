// The real-hardware source code in the practice workspace. Every visitor gets ros2lab_hardware's package files, launch
// file, xacro macro and generator (pkg-sources.js). The C++ driver and the bridge firmware come from the Cloud Function
// getHardwareSources, only with an approved hardware license; until then their files are shown as locked notes.
// Licensed copies carry the student's email in a header line.
import { licenseStatus, licensed } from "./hw-license.js";
import { PKG_SOURCES, LOCKED_SOURCES } from "./pkg-sources.js";

let got = null, mark = "", pending = null;

const comment = (rel) => (/\.(py|cmake|txt|yaml|yml|sh|rules)$/.test(rel) || /CMakeLists/.test(rel) ? "#" : /\.(xml|xacro|launch|urdf)$/.test(rel) ? null : /\.md$/.test(rel) ? "md" : "//");
function header(rel, text) {
  const c = comment(rel);
  if (c === "md") return `<!-- ${text} -->\n`;
  return c ? `${c} ${text}\n` : `<!-- ${text} -->\n`;
}

// the licensed files, or null (no license, signed out, offline); waits at most `ms` (sign-in, license, Cloud Function)
export async function loadHwSources(ms = 10000) {
  if (got) return got;
  if (!pending) {
    pending = (async () => {
      const st = await licenseStatus();
      if (!licensed(st)) return null;
      const { call } = await import("./fb.js");
      const r = await call("getHardwareSources")({});
      mark = String((r.data && r.data.watermark) || "");
      got = (r.data && r.data.files) || null;
      return got;
    })().catch(() => null).finally(() => { pending = null; });
  }
  return Promise.race([pending, new Promise((res) => setTimeout(() => res(null), ms))]);
}

// one package's files: the public ones, plus the licensed ones (watermarked) or locked notes in their place
export function sourcesFor(pkg) {
  const files = { ...(PKG_SOURCES[pkg] || {}) };
  for (const rel of LOCKED_SOURCES[pkg] || []) {
    const text = got && got[pkg] && got[pkg][rel];
    files[rel] = typeof text === "string"
      ? header(rel, `ROS2Lab hardware license: licensed to ${mark || "you"}. For your course robot only; do not share or publish.`) + text
      : header(rel, `${pkg}/${rel}: real-hardware source code.`) + header(rel, "It is shown to students with an approved hardware license from the course administrator") +
        header(rel, "(Robotic Models Simulator → Connect to ROS 2 → Ask for a hardware license). Fake hardware and Gazebo do not need it.");
  }
  return files;
}
export const hwSourcesLicensed = () => !!got;
