// Packs the text files of each official robot workspace (public/robots/ws/<wsid>/src/...) into one JSON file,
// public/robots/ws/<wsid>/text.json = { "src/<repo>/<pkg>/<file>": "<text>", ... }, so a robot's simulator page loads
// its sources with one request. Meshes (.dae/.stl/.obj) and images stay separate files, fetched only when drawn.
//   node tools/build-ws-bundles.mjs           (rerun after tools/fetch-workspaces.mjs)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
const ROOT = new URL("../public/robots/ws/", import.meta.url).pathname;
const MESH = /\.(dae|stl|obj|ply|png|jpe?g|gif|bmp|tga|pgm|webp|glb|gltf|blend|psd|ttf|pdf|zip|so|a|bin)$/i;
for (const id of readdirSync(ROOT)) {
  const wf = `${ROOT}${id}/workspace.json`; if (!existsSync(wf)) continue;
  const ws = JSON.parse(readFileSync(wf, "utf8"));
  const out = {};
  for (const rel of ws.text || []) { if (MESH.test(rel)) continue; const f = `${ROOT}${id}/${rel}`; if (existsSync(f)) out[rel] = readFileSync(f, "utf8"); }
  const s = JSON.stringify(out);
  writeFileSync(`${ROOT}${id}/text.json`, s);
  console.log(`${id}: ${Object.keys(out).length} text files, ${(s.length / 1e6).toFixed(2)} MB`);
}
