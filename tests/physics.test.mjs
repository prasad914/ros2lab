// Unit tests of the physics module (node): free fall, a pendulum-free box push, a wall stop, an arm knocking a box.
import { loadRapier, GzPhysics } from "../public/js/gz-physics.js";
import { parseURDF } from "../public/js/urdf-core.js";
const R = await loadRapier();
let fails = 0; const ok = (c, m) => { console.log(`${c ? "OK  " : "FAIL"} ${m}`); if (!c) fails++; };
const ground = { name: "ground_plane", static: true, pose: [0, 0, 0, 0, 0, 0], shapes: [{ type: "plane", size: [100, 100] }] };
// 1. free fall of a 1 kg ball from 10 m: z(1 s) = 10 - g/2
{
  const P = new GzPhysics(R, { gravity: [0, 0, -9.81], physics: { step: 0.001 }, models: [{ name: "ball", static: false, mass: 1, pose: [0, 0, 10, 0, 0, 0], shapes: [{ type: "sphere", radius: 0.1 }] }] });
  for (let i = 0; i < 20; i++) P.step(0.05);
  const z = P.dynPoses().ball.z, ex = 10 - 9.81 / 2;
  ok(Math.abs(z - ex) / (10 - ex) < 0.01, `free fall z=${z.toFixed(3)} expected ${ex.toFixed(3)} (within 1 %)`);
}
// 2. a ball dropped on the ground comes to rest on it
{
  const P = new GzPhysics(R, { gravity: [0, 0, -9.8], physics: { step: 0.001 }, models: [ground, { name: "ball", static: false, mass: 0.45, restitution: 0.6, pose: [0, 0, 1, 0, 0, 0], shapes: [{ type: "sphere", radius: 0.2 }] }] });
  for (let i = 0; i < 200; i++) P.step(0.05);
  const z = P.dynPoses().ball.z; ok(Math.abs(z - 0.2) < 0.02, `ball rests on the ground at z=${z.toFixed(3)} (radius 0.2)`);
}
// a small round robot (TurtleBot-like) as the graph keeps it
const urdf = `<robot name="bot"><link name="base_footprint"/><link name="base_link"><collision><origin xyz="0 0 0.08" rpy="0 0 0"/><geometry><cylinder radius="0.1" length="0.14"/></geometry></collision><inertial><mass value="1"/><inertia ixx="0.01" iyy="0.01" izz="0.01" ixy="0" ixz="0" iyz="0"/></inertial></link><joint name="j" type="fixed"><parent link="base_footprint"/><child link="base_link"/></joint></robot>`;
const bot = () => ({ name: "bot", model: parseURDF(urdf), joints: {}, pose: { x: 0, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0 } });
function drive(P, m, vx, secs) { for (let t = 0; t < secs; t += 0.05) { const mv = P.moveBase(m, vx * 0.05, 0, 0); m.pose.x += mv.dx; m.pose.y += mv.dy; P.syncLinks(m); P.step(0.05); } }
// 3. a wall stops the robot
{
  const P = new GzPhysics(R, { gravity: [0, 0, -9.8], models: [ground, { name: "wall", static: true, pose: [1, 0, 0.5, 0, 0, 0], shapes: [{ type: "box", size: [0.2, 4, 1] }] }] });
  const m = bot(); drive(P, m, 0.3, 6);
  ok(m.pose.x < 0.9 && m.pose.x > 0.6, `the wall at x=0.9 stops the robot: x=${m.pose.x.toFixed(3)}`);
}
// 4. a light box gets pushed
{
  const P = new GzPhysics(R, { gravity: [0, 0, -9.8], models: [ground, { name: "box", static: false, mass: 0.3, mu: 0.5, pose: [0.6, 0, 0.15, 0, 0, 0], shapes: [{ type: "box", size: [0.3, 0.3, 0.3] }] }] });
  const m = bot(); for (let i = 0; i < 20; i++) P.step(0.05);
  const x0 = P.dynPoses().box.x; drive(P, m, 0.3, 5);
  const x1 = P.dynPoses().box.x;
  ok(x1 - x0 > 0.5, `the robot pushed the box from x=${x0.toFixed(2)} to x=${x1.toFixed(2)} (robot at ${m.pose.x.toFixed(2)})`);
}
// 5. a box pushed against a wall is not squeezed into it: the robot stops
{
  const P = new GzPhysics(R, { gravity: [0, 0, -9.8], models: [ground, { name: "wall", static: true, pose: [1.5, 0, 0.5, 0, 0, 0], shapes: [{ type: "box", size: [0.2, 4, 1] }] }, { name: "box", static: false, mass: 0.3, mu: 0.5, pose: [0.6, 0, 0.15, 0, 0, 0], shapes: [{ type: "box", size: [0.3, 0.3, 0.3] }] }] });
  const m = bot(); for (let i = 0; i < 20; i++) P.step(0.05);
  drive(P, m, 0.3, 10);
  const bx = P.dynPoses().box.x;
  ok(bx < 1.4 - 0.15 + 0.02 && bx > 1.1 && m.pose.x < bx - 0.24, `the box stops at the wall (box x=${bx.toFixed(3)}, wall face 1.4, robot x=${m.pose.x.toFixed(3)})`);
}
// 6. no tunneling: 2 m/s in 0.1 s frames into a 0.1 m wall
{
  const P = new GzPhysics(R, { gravity: [0, 0, -9.8], models: [ground, { name: "wall", static: true, pose: [1, 0, 0.5, 0, 0, 0], shapes: [{ type: "box", size: [0.1, 4, 1] }] }] });
  const m = bot();
  for (let t = 0; t < 2; t += 0.1) { const mv = P.moveBase(m, 2 * 0.1, 0, 0); m.pose.x += mv.dx; m.pose.y += mv.dy; P.syncLinks(m); P.step(0.1); }
  ok(m.pose.x < 0.86, `2 m/s does not tunnel through a 10 cm wall: x=${m.pose.x.toFixed(3)}`);
}
// 7. a wheeled (non-holonomic) robot driving into a wall at an angle stops; a holonomic one slides along it
for (const slide of [false, true]) {
  const P = new GzPhysics(R, { gravity: [0, 0, -9.8], models: [ground, { name: "wall", static: true, pose: [1, 0, 0.5, 0, 0, 0], shapes: [{ type: "box", size: [0.2, 6, 1] }] }] });
  const m = bot(), yaw = 0.6; m.pose.yaw = yaw;
  for (let t = 0; t < 8; t += 0.05) { const mv = P.moveBase(m, 0.3 * Math.cos(yaw) * 0.05, 0.3 * Math.sin(yaw) * 0.05, 0, yaw, slide); m.pose.x += mv.dx; m.pose.y += mv.dy; P.syncLinks(m); P.step(0.05); }
  ok(m.pose.x < 0.9 && (slide ? m.pose.y > 1.2 : Math.abs(m.pose.y - m.pose.x * Math.tan(yaw)) < 0.03), `${slide ? "holonomic" : "diff drive"} at 0.6 rad into a wall: x=${m.pose.x.toFixed(2)} y=${m.pose.y.toFixed(2)} (${slide ? "slides along it" : "stops on its heading line"})`);
}
// 8. a robot whose body reaches into the ground plane (a legged robot or a drone spawned at z=0) can still turn
{
  const P = new GzPhysics(R, { gravity: [0, 0, -9.8], models: [ground] });
  const m = { name: "dog", model: parseURDF(`<robot name="dog"><link name="base_link"><collision><geometry><box size="0.4 0.2 0.1"/></geometry></collision><inertial><mass value="5"/><inertia ixx="0.02" iyy="0.07" izz="0.08" ixy="0" ixz="0" iyz="0"/></inertial></link></robot>`), joints: {}, pose: { x: 0, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0 } };
  P.moveBase(m, 0, 0, 0, 0); P.syncLinks(m); P.step(0.05);
  const mv = P.moveBase(m, 0, 0, 0, 0.5);
  ok(Math.abs(mv.yaw - 0.5) < 1e-9, `a body touching the ground plane turns: yaw=${mv.yaw}`);
}
// 9. continuous arm joints of a mobile manipulator are not wheels: the arm is not part of the chassis box
{
  const mm = parseURDF(`<robot name="mm"><link name="base_link"><collision><origin xyz="0 0 0.1"/><geometry><box size="0.4 0.3 0.1"/></geometry></collision></link>
  ${["l", "r"].map((s, i) => `<link name="${s}"><collision><origin rpy="1.5708 0 0"/><geometry><cylinder radius="0.05" length="0.03"/></geometry></collision></link><joint name="${s}_j" type="continuous"><parent link="base_link"/><child link="${s}"/><origin xyz="0 ${i ? -0.17 : 0.17} 0.05"/><axis xyz="0 1 0"/></joint>`).join("")}
  <link name="arm"><collision><origin xyz="0 0 0.3"/><geometry><cylinder radius="0.03" length="0.6"/></geometry></collision></link><joint name="arm_j" type="continuous"><parent link="base_link"/><child link="arm"/><origin xyz="0 0 0.15"/><axis xyz="0 0 1"/></joint></robot>`);
  const C = GzPhysics.prototype.chassis.call(null, mm);
  ok(C && C.hi[2] < 0.2 && Math.abs(C.lo[2]) < 1e-6, `chassis of a mobile manipulator: z ${C && C.lo[2].toFixed(3)}..${C && C.hi[2].toFixed(3)} (wheels in, arm out)`);
}
console.log(fails ? `${fails} FAILED` : "All physics tests passed");
process.exit(fails ? 1 : 0);
