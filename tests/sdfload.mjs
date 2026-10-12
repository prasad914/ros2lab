// Gazebo loads a URDF the way libsdformat converts it: links without mass are left out (with sdformat's warnings),
// a robot without <collision> falls through the floor, a robot spawned in the air drops onto its wheels.
import assert from "node:assert/strict";
import { open } from "./lib.mjs";
const { b, p, errs } = await open("rviz.html?robot=own");
await p.evaluate(() => window.__ros2lab.term.runHere("gz sim -r empty.sdf")); await p.waitForTimeout(2500);
const I = (m) => `<inertial><mass value="${m}"/><inertia ixx="0.01" ixy="0" ixz="0" iyy="0.01" iyz="0" izz="0.01"/></inertial>`;
const box = `<geometry><box size="0.3 0.2 0.1"/></geometry>`, cyl = `<geometry><cylinder radius="0.05" length="0.03"/></geometry>`;
const robot = ({ wheelInertial = true, collisions = true } = {}) => `<robot name="t">
 <link name="base_link"><visual>${box}</visual>${collisions ? `<collision>${box}</collision>` : ""}${I(2)}</link>
 ${["l", "r"].map((s, i) => `<link name="${s}_wheel"><visual><origin rpy="1.5708 0 0"/>${cyl}</visual>${collisions ? `<collision><origin rpy="1.5708 0 0"/>${cyl}</collision>` : ""}${wheelInertial ? I(0.1) : ""}</link>
 <joint name="${s}_joint" type="continuous"><parent link="base_link"/><child link="${s}_wheel"/><origin xyz="0 ${i ? -0.12 : 0.12} 0"/><axis xyz="0 1 0"/></joint>`).join("\n")}
 <gazebo><plugin filename="gz-sim-diff-drive-system" name="gz::sim::systems::DiffDrive"><left_joint>l_joint</left_joint><right_joint>r_joint</right_joint><wheel_separation>0.24</wheel_separation><wheel_radius>0.05</wheel_radius></plugin></gazebo>
</robot>`;
const spawn = (name, urdf, z) => p.evaluate(({ name, urdf, z }) => { const g = window.__ros2lab.sh.graph; const r = g.gzCreate(["-string", urdf, "-name", name, "-z", String(z)]); return { fail: !!r.fail, gzErr: r.gzErr, hint: r.hint }; }, { name, urdf, z });
const state = (name) => p.evaluate((name) => { const m = window.__ros2lab.sh.graph.gz.models.get(name); return { z: m.pose.z, links: Object.keys(m.model.links), stalled: m.gazebo.plugins.some((q) => q.stalled) }; }, name);

const a = await spawn("good", robot(), 0.5);
assert.ok(!a.fail && !a.hint, JSON.stringify(a));
const c = await spawn("nomass", robot({ wheelInertial: false }), 0);
console.log(c.gzErr.join("\n")); console.log("hint:", c.hint);
assert.ok(c.gzErr.some((l) => l.startsWith("Warning [parser_urdf.cc:2777] Error Code 19: Msg: urdf2sdf: link[l_wheel] is not modeled in sdf.")));
assert.ok(c.gzErr.some((l) => /Failed to find left joint \[l_joint\] for model \[nomass\]/.test(l)));
const d = await spawn("nocoll", robot({ collisions: false }), 0.2);
console.log("hint:", d.hint);
await p.waitForTimeout(3000);
const [sa, sc, sd] = [await state("good"), await state("nomass"), await state("nocoll")];
console.log({ sa, sc, sd });
assert.ok(Math.abs(sa.z - 0.05) < 0.01, "dropped onto its wheels (radius 0.05)");
assert.deepEqual(sc.links, ["base_link"]); assert.ok(sc.stalled);
assert.ok(sd.z < -1, "fell through the floor");
// the stalled drive does not move, the good one does
// (gz topic pub -t /model/NAME/cmd_vel: the DiffDrive keeps the last command)
await p.evaluate(() => { for (const m of window.__ros2lab.sh.graph.gz.models.values()) m.cmd = { vx: 0.3, vy: 0, vz: 0, wz: 0 }; });
await p.waitForTimeout(2200);
const moved = await p.evaluate(() => Object.fromEntries([...window.__ros2lab.sh.graph.gz.models.values()].map((m) => [m.name, +m.pose.x.toFixed(2)])));
console.log("x after driving:", moved);
assert.ok(moved.good > 0.1 && moved.nomass === 0);
console.log("ERRS", errs); assert.equal(errs.length, 0);
console.log("sdfload ok");
await b.close();
