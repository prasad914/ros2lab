import fs from "fs"; import * as I from "../public/js/ros-iface.js";
const db = JSON.parse(fs.readFileSync("public/robots/ros-ifaces.json")); I.setIfaces(db);
const missing = new Map();
for (const t of Object.keys(db)) { const d = I.definition(t); for (const sec of d.sections) for (const f of sec.fields) if (f.type.includes("/") && !(f.type in db)) missing.set(f.type, (missing.get(f.type) || []).concat(t)); }
console.log(missing.size ? [...missing].map(([k, v]) => `${k} <- ${v.slice(0, 2).join(", ")}`).join("\n") : "all nested types present");
