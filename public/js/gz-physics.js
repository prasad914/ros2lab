// Rigid-body physics for the practice Gazebo, with the Rapier engine (Apache-2.0, vendor/rapier):
//  - the world's <collision> shapes: static models are fixed bodies; models with mass (<static>false</static> and an
//    <inertial>) are dynamic: they fall under the world's <gravity>, slide with their <mu> friction and bounce with
//    their restitution, as in Gazebo's physics system;
//  - each robot's base is moved by its drive system (DiffDrive, MecanumDrive, AckermannSteering, VelocityControl)
//    through a kinematic character controller: walls and fixed objects stop it, light objects get pushed;
//  - each robot link with a box / cylinder / sphere collision follows the joints as a kinematic body, so an arm
//    can knock a dynamic box over.
// Step size and real-time factor come from the world's <physics> (default 1 ms, as gz-sim's default_physics).
import { urdfEdges, framePoses, qRPY } from "./urdf-core.js";

let RAPIER = null, loading = null;
export function loadRapier() {
  if (RAPIER) return Promise.resolve(RAPIER);
  if (!loading) loading = import("../vendor/rapier/rapier.mjs").then(async (m) => { const R = m.default || m; await R.init(); RAPIER = R; return R; });
  return loading;
}
export const rapierReady = () => !!RAPIER;

// ---------- small pose helpers (position + quaternion [x, y, z, w]) ----------
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qrot = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2]; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
const compose = (A, B) => ({ t: A.t.map((x, i) => x + qrot(A.q, B.t)[i]), q: qmul(A.q, B.q) });
const pose6 = (p) => ({ t: [p[0] || 0, p[1] || 0, p[2] || 0], q: qRPY(p[3] || 0, p[4] || 0, p[5] || 0) });
const CYL_Z = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const quatYaw = (y) => ({ x: 0, y: 0, z: Math.sin(y / 2), w: Math.cos(y / 2) });   // Rapier cylinders lie along Y; SDF / URDF cylinders along Z

// the wheel joints a drive system names (DiffDrive, MecanumDrive, AckermannSteering), for chassis()
export function driveWheels(m) {
  const out = new Set();
  for (const p of (m.gazebo && m.gazebo.plugins) || []) for (const j of [...(p.left || []), ...(p.right || []), p.fl, p.fr, p.rl, p.rr, ...(p.wheels || [])]) if (j) out.add(j);
  return out.size ? out : null;
}

export class GzPhysics {
  constructor(R, world) {
    this.R = R; this.worldDef = world;
    const g = world.gravity || [0, 0, -9.8];
    this.world = new R.World({ x: g[0], y: g[1], z: g[2] });
    this.dt = Math.min(0.01, Math.max(0.0005, (world.physics && world.physics.step) || 0.001));
    this.world.timestep = this.dt;
    this.dyn = new Map();      // model name -> rigid body (dynamic world models)
    this.robots = new Map();   // model name -> { base, collider, ctl, links: Map(link -> body), r, top }
    this.acc = 0;
    this.grounds = new Set();   // collider handles of ground planes
    this.bodies = new Map();    // world model name -> rigid body
    for (const m of world.models || []) this.addWorldModel(m);
  }
  shapeDesc(s, dynamic = false) {
    const R = this.R;
    if (s.type === "box") return R.ColliderDesc.cuboid(s.size[0] / 2, s.size[1] / 2, s.size[2] / 2);
    if (s.type === "sphere") return R.ColliderDesc.ball(s.radius);
    if (s.type === "cylinder") return R.ColliderDesc.cylinder(s.length / 2, s.radius);
    if (s.type === "capsule") return R.ColliderDesc.capsule(s.length / 2, s.radius);
    if (s.type === "cone") return R.ColliderDesc.cone(s.length / 2, s.radius);
    if (s.type === "plane") return R.ColliderDesc.cuboid((s.size ? s.size[0] : 100) / 2, (s.size ? s.size[1] : 100) / 2, 0.05);
    if (s.type === "ellipsoid") { const [a, b, c] = s.radii || [1, 1, 1], pts = []; for (let i = 0; i <= 6; i++) for (let j = 0; j < 12; j++) { const th = (Math.PI * i) / 6, ph = (2 * Math.PI * j) / 12; pts.push(a * Math.sin(th) * Math.cos(ph), b * Math.sin(th) * Math.sin(ph), c * Math.cos(th)); } return R.ColliderDesc.convexHull(new Float32Array(pts)); }
    if (s.type === "mesh" && s.mesh && s.mesh.indices.length >= 3) {
      // static meshes collide as triangle meshes (decimated by gz-mesh.js); moving ones as their convex hull (phones)
      if (dynamic) return R.ColliderDesc.convexHull(s.mesh.positions) || null;
      return R.ColliderDesc.trimesh(s.mesh.positions, s.mesh.indices);
    }
    return null;
  }
  // mesh files load after the world (gz-sdformat.js gzLoadMeshes): add their colliders when they arrive
  refreshMeshes() {
    let n = 0;
    for (const m of this.worldDef.models || []) {
      const body = this.bodies.get(m.name); if (!body) continue;
      for (const s of m.colShapes || m.shapes || []) if (s.type === "mesh" && s.mesh && !s._col) { this.addShape(m, s, body, !m.static && (m.mass || 0) > 0, 1); n++; }
    }
    return n;
  }
  addShape(m, s, body, dynamic, massShare) {
    const d = this.shapeDesc(s, dynamic); if (!d) return null;
    const L = compose(pose6(s.linkPose || []), pose6(s.pose || []));
    if (s.type === "plane") L.t[2] -= 0.05;   // the cuboid's top face is the plane
    const q = s.type === "cylinder" || s.type === "capsule" || s.type === "cone" ? qmul(L.q, CYL_Z) : L.q;
    d.setTranslation(...L.t).setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }).setFriction(Math.min(m.mu ?? 1, 2)).setRestitution(m.restitution || 0);
    if (dynamic) d.setMass(massShare);
    const c = this.world.createCollider(d, body);
    s._col = true;
    if (s.type === "plane") this.grounds.add(c.handle);
    return c;
  }
  // lidar without WebGL: distance along each world-frame ray to the nearest collider of the world (robots excluded)
  castRays(origin, dirs, min, max) {
    const R = this.R, out = new Array(dirs.length);
    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i], ray = new R.Ray({ x: origin[0] + d[0] * min, y: origin[1] + d[1] * min, z: origin[2] + d[2] * min }, { x: d[0], y: d[1], z: d[2] });
      const hit = this.world.castRay(ray, max - min, true, R.QueryFilterFlags.EXCLUDE_SENSORS, 0x00010001);
      out[i] = hit ? min + (hit.timeOfImpact ?? hit.toi) : Infinity;
    }
    return out;
  }
  addWorldModel(m) {
    const R = this.R, P = pose6(m.pose || []);
    const dynamic = !m.static && (m.mass || 0) > 0;
    const body = this.world.createRigidBody((dynamic ? R.RigidBodyDesc.dynamic().setCcdEnabled(true) : R.RigidBodyDesc.fixed())
      .setTranslation(...P.t).setRotation({ x: P.q[0], y: P.q[1], z: P.q[2], w: P.q[3] }));
    this.bodies.set(m.name, body);
    const shapes = m.colShapes || m.shapes || [];
    const volOf = (s) => (s.type === "box" ? s.size[0] * s.size[1] * s.size[2] : s.type === "sphere" ? (4 / 3) * Math.PI * s.radius ** 3 : s.type === "cylinder" || s.type === "capsule" ? Math.PI * s.radius ** 2 * s.length : s.type === "mesh" && s.mesh ? Math.max(1e-6, (s.mesh.hi[0] - s.mesh.lo[0]) * (s.mesh.hi[1] - s.mesh.lo[1]) * (s.mesh.hi[2] - s.mesh.lo[2])) : 0);
    let vol = 0; const vols = shapes.map(volOf); vols.forEach((v) => { vol += v; });
    shapes.forEach((s, i) => this.addShape(m, s, body, dynamic, vol > 0 ? (m.mass * vols[i]) / vol : m.mass / shapes.length));
    if (dynamic) this.dyn.set(m.name, body);
  }

  // ---------- robots ----------
  // The robot's chassis as Gazebo sees it: the <collision> shapes of the root link and of every link joined to it by
  // fixed joints (lumped into one body, as sdformat does) or by wheel joints, at zero joint angles, in the base frame.
  // A wheel joint is a continuous joint named by the drive system (wheels: a Set of joint names), or one whose child
  // has a cylinder / sphere collision touching the lowest level of all such shapes (a continuous joint of an arm on a
  // mobile base is not a wheel). Arms and legs are separate kinematic links (see below).
  // Returns an axis-aligned box around them (lo / hi corners), or null when the chassis has no collision at all;
  // lowAll: the lowest point of every collision of the robot (legs and feet too), for robots without wheels.
  chassis(model, wheels = null) {
    let P; try { P = framePoses(urdfEdges(model, {}, true), model.root).poses; } catch { return null; }
    const bottom = (j) => {
      const l = model.links[j.child], T = P[j.child]; let b = Infinity; if (!l || !T) return b;
      for (const c of l.collisions || []) if (c.geom.type === "cylinder" || c.geom.type === "sphere") b = Math.min(b, T.t[2] + c.origin.xyz[2] - c.geom.radius);
      return b;
    };
    const cont = Object.values(model.joints).filter((j) => j.type === "continuous");
    const lowest = Math.min(Infinity, ...cont.map(bottom));
    const isWheel = (j) => (wheels && wheels.has(j.name)) || (Number.isFinite(bottom(j)) && bottom(j) <= lowest + 0.03);
    const inChassis = new Set([model.root]), stack = [model.root];
    while (stack.length) { const l = stack.pop(); for (const j of Object.values(model.joints)) if (j.parent === l && (j.type === "fixed" || (j.type === "continuous" && isWheel(j))) && !inChassis.has(j.child)) { inChassis.add(j.child); stack.push(j.child); } }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    let any = false, meshOnly = true, lowAll = Infinity, allMesh = true;
    for (const name of Object.keys(model.links)) {
      const l = model.links[name], T = P[name]; if (!l || !T) continue;
      const mine = inChassis.has(name);
      for (const c of l.collisions || []) {
        const g = c.geom;
        let ext;
        if (g.type === "box") ext = g.size.map((v) => v / 2);
        else if (g.type === "cylinder") ext = [g.radius, g.radius, g.length / 2];
        else if (g.type === "sphere") ext = [g.radius, g.radius, g.radius];
        else { ext = [0.08, 0.08, 0.05]; }   // a mesh: its size is not known here (approximate)
        if (g.type !== "mesh") { allMesh = false; if (mine) meshOnly = false; }
        if (mine) any = true;
        const L = compose({ t: T.t, q: T.q }, pose6([...c.origin.xyz, ...c.origin.rpy]));
        // the 8 corners of the shape's local box, into the base frame
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          const w = qrot(L.q, [sx * ext[0], sy * ext[1], sz * ext[2]]);
          if (g.type !== "mesh") lowAll = Math.min(lowAll, L.t[2] + w[2]);
          if (mine) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], L.t[k] + w[k]); hi[k] = Math.max(hi[k], L.t[k] + w[k]); }
        }
      }
    }
    if (!any) return null;
    return { lo, hi, meshOnly, lowAll: allMesh ? null : lowAll };
  }
  footprint(model) {   // the old round footprint, for chassis made only of meshes (their size is unknown here)
    let r = 0.1, top = 0.3;
    for (const l of Object.values(model.links)) for (const c of [...(l.collisions || []), ...(l.visuals || [])]) {
      const g = c.geom, o = c.origin.xyz;
      const e = g.type === "box" ? Math.hypot(g.size[0], g.size[1]) / 2 : g.type === "cylinder" || g.type === "sphere" ? g.radius : 0.05;
      if (l.name === model.root || Math.hypot(o[0], o[1]) < 0.6) r = Math.max(r, Math.min(0.9, Math.hypot(o[0], o[1]) + e));
      top = Math.max(top, Math.min(1.8, o[2] + (g.type === "box" ? g.size[2] / 2 : g.type === "cylinder" ? g.length / 2 : g.radius || 0.05)));
    }
    return { r: Math.min(r, 0.9) * 0.85, top };
  }
  addRobot(m) {
    const R = this.R, C = this.chassis(m.model, driveWheels(m));
    // the base body sits at the robot's pose; its collider is the chassis box, lifted 3 cm off the ground so that only
    // the drive system (the wheels) touches the floor, as in Gazebo
    const base = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(m.pose.x, m.pose.y, m.pose.z).setRotation(quatYaw(m.pose.yaw || 0)));
    let desc, F = null, half = 0, off = [0, 0, 0];
    if (C && !C.meshOnly) {
      const lo = [...C.lo], hi = [...C.hi]; lo[2] = Math.max(lo[2], Math.min(hi[2] - 0.02, lo[2] + 0.03));
      const h = [0, 1, 2].map((k) => Math.max(0.01, (hi[k] - lo[k]) / 2)), c = [0, 1, 2].map((k) => (hi[k] + lo[k]) / 2);
      desc = R.ColliderDesc.cuboid(h[0], h[1], h[2]).setTranslation(c[0], c[1], c[2]);
      half = h[2]; off = c;
    } else {
      F = this.footprint(m.model); half = Math.max(0.03, F.top / 2 - 0.02);
      off = [0, 0, 0.03 + half];
      desc = R.ColliderDesc.cylinder(half, F.r).setTranslation(0, 0, 0.03 + half).setRotation({ x: CYL_Z[0], y: CYL_Z[1], z: CYL_Z[2], w: CYL_Z[3] });
    }
    const collider = this.world.createCollider(desc, base);
    if (!C) collider.setSensor(true);   // no <collision> anywhere: in Gazebo nothing touches it (walls, ground, objects)
    const ctl = this.world.createCharacterController(0.01);
    ctl.setApplyImpulsesToDynamicBodies(false);   // dynamic objects are pushed by the kinematic body itself (contacts), see step()
    ctl.setSlideEnabled(true);
    ctl.enableAutostep(0.02, 0.05, false);
    // links that stick out (arms): kinematic bodies that follow the joints and push dynamic objects
    const links = new Map();
    for (const l of Object.values(m.model.links)) {
      const cols = (l.collisions || []).filter((c) => ["box", "cylinder", "sphere", "capsule"].includes(c.geom.type) || (c.geom.type === "mesh" && c.geom.mesh));   // only <collision> touches things
      if (!cols.length || l.name === m.model.root) continue;
      const b = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
      for (const c of cols) {
        const g = c.geom, d = this.shapeDesc(g, true); if (!d) continue;
        const o = pose6([...c.origin.xyz, ...c.origin.rpy]), q = g.type === "cylinder" || g.type === "capsule" ? qmul(o.q, CYL_Z) : o.q;
        d.setTranslation(...o.t).setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] });
        d.setCollisionGroups(0x00020001);   // links touch the world (group 1), not the robot's own base (group 2)
        this.world.createCollider(d, b);
      }
      links.set(l.name, b);
    }
    collider.setCollisionGroups(0x00020001);
    const rb = { base, collider, ctl, links, half, F, m, off };
    this.robots.set(m.name, rb);
    this.syncLinks(m, true);
    return rb;
  }
  robotMass(model) { return Object.values(model.links).reduce((a, l) => a + (l.inertial ? Number(l.inertial.mass) || 0 : 0), 0); }
  removeRobot(name) { const r = this.robots.get(name); if (!r) return; this.world.removeCharacterController(r.ctl); for (const b of r.links.values()) this.world.removeRigidBody(b); this.world.removeRigidBody(r.base); this.robots.delete(name); }
  // move the robot base by (dx, dy, dz) in the world frame: returns the move that the world allows
  // slide: false for wheeled robots that cannot move sideways (diff drive, Ackermann): against a wall or a box they
  // stop instead of gliding along it (their wheels do not slip sideways); mecanum, legged and flying robots slide.
  moveBase(m, dx, dy, dz, yaw = m.pose.yaw || 0, slide = true) {
    let r = this.robots.get(m.name); if (!r) r = this.addRobot(m);
    r.ctl.setSlideEnabled(slide);
    // turning first: if the turned chassis would overlap a wall, the robot cannot turn there
    const was = m.pose.yaw || 0;
    if (Math.abs(yaw - was) > 1e-9) {
      r.base.setRotation(quatYaw(yaw), true);
      let hit = false;
      const bt = r.base.translation(), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const at = { x: bt.x + cy * r.off[0] - sy * r.off[1], y: bt.y + sy * r.off[0] + cy * r.off[1], z: bt.z + r.off[2] };
      this.world.intersectionsWithShape(at, quatYaw(yaw), r.collider.shape, (col) => { if (this.grounds.has(col.handle)) return true; hit = true; return false; }, this.R.QueryFilterFlags.EXCLUDE_SENSORS | this.R.QueryFilterFlags.EXCLUDE_DYNAMIC, 0x00010001, undefined, r.base);
      if (hit) { yaw = was; r.base.setRotation(quatYaw(was), true); }
    }
    // only fixed things (walls, static models, the ground) stop the base; movable objects are pushed during the steps
    r.ctl.computeColliderMovement(r.collider, { x: dx, y: dy, z: dz }, this.R.QueryFilterFlags.EXCLUDE_SENSORS | this.R.QueryFilterFlags.EXCLUDE_DYNAMIC, 0x00010001);
    const mv0 = r.ctl.computedMovement(), mv = { x: mv0.x, y: mv0.y, z: mv0.z };
    this.pinned(r, mv);
    const want = Math.hypot(dx, dy, dz), got = Math.hypot(mv.x, mv.y, mv.z);
    return { dx: mv.x, dy: mv.y, dz: mv.z, yaw, blocked: want > 1e-6 && got < want * 0.2 };
  }
  // A loose object the robot pushes can only go as far as the walls let it: an object pinned between the robot and a
  // wall stops the robot (in Gazebo the contact forces stall the wheels), instead of being squeezed into the wall.
  // Shortens mv (the horizontal move) in place.
  pinned(r, mv) {
    const R = this.R, L = Math.hypot(mv.x, mv.y); if (L < 1e-6) return;
    const dir = { x: mv.x / L, y: mv.y / L, z: 0 }, F = R.QueryFilterFlags;
    const hit = this.world.castShape(r.collider.translation(), r.collider.rotation(), dir, r.collider.shape, 0, L + 0.01, false, F.EXCLUDE_FIXED | F.EXCLUDE_KINEMATIC | F.EXCLUDE_SENSORS, 0x00010001, r.collider, r.base);
    if (!hit) return;
    const body = hit.collider.parent(); if (!body) return;
    const toi = Math.max(0, hit.time_of_impact ?? hit.toi ?? 0);
    let free = Infinity;
    for (let i = 0; i < body.numColliders(); i++) {
      const c = body.collider(i);
      const h = this.world.castShape(c.translation(), c.rotation(), dir, c.shape, 0, L - toi + 0.01, false, F.EXCLUDE_DYNAMIC | F.EXCLUDE_KINEMATIC | F.EXCLUDE_SENSORS, undefined, c, body, (o) => !this.grounds.has(o.handle));
      if (h) free = Math.min(free, Math.max(0, h.time_of_impact ?? h.toi ?? 0));
    }
    if (toi + free >= L) return;
    const k = Math.max(0, toi + free - 0.002) / L;
    mv.x *= k; mv.y *= k;
  }
  // where the robot base and links are now (after the drive system moved it)
  syncLinks(m, now = false) {
    const r = this.robots.get(m.name); if (!r) return;
    const B = { t: [m.pose.x, m.pose.y, m.pose.z], q: qRPY(m.pose.roll || 0, m.pose.pitch || 0, m.pose.yaw || 0) };
    const bt = r.F ? { x: m.pose.x, y: m.pose.y, z: m.pose.z } : { x: m.pose.x, y: m.pose.y, z: m.pose.z };
    r.targets = r.targets || new Map();
    if (now) { r.base.setTranslation(bt, true); r.base.setRotation(quatYaw(m.pose.yaw || 0), true); } else r.targets.set(r.base, { t: bt, q: quatYaw(m.pose.yaw || 0) });
    if (!r.links.size) return;
    let P;
    try { P = framePoses(urdfEdges(m.model, m.joints, true), m.model.root).poses; } catch { return; }
    for (const [name, b] of r.links) {
      const T = P[name]; if (!T) continue;
      const W = compose(B, { t: T.t, q: T.q }), tr = { x: W.t[0], y: W.t[1], z: W.t[2] }, ro = { x: W.q[0], y: W.q[1], z: W.q[2], w: W.q[3] };
      if (now) { b.setTranslation(tr, true); b.setRotation(ro, true); } else r.targets.set(b, { t: tr, q: ro });
    }
  }
  // advance the world by dt seconds of simulation time, in fixed <max_step_size> steps (at most 200 per call)
  step(dt) {
    this.acc += dt;
    const n = Math.min(200, Math.floor(this.acc / this.dt));
    this.acc = n >= 200 ? 0 : this.acc - n * this.dt;
    // the kinematic bodies (robot bases and links) move to their new pose a little in every sub-step,
    // so that they push objects at their real speed (not in one jump)
    const moves = [];
    for (const r of this.robots.values()) for (const [b, T] of r.targets || []) { const t0 = b.translation(); moves.push({ b, t0: { x: t0.x, y: t0.y, z: t0.z }, T }); if (T.q) b.setNextKinematicRotation(T.q); }
    for (const r of this.robots.values()) if (r.targets) r.targets.clear();
    for (let i = 1; i <= n; i++) {
      const a = i / n;
      for (const { b, t0, T } of moves) b.setNextKinematicTranslation({ x: t0.x + (T.t.x - t0.x) * a, y: t0.y + (T.t.y - t0.y) * a, z: t0.z + (T.t.z - t0.z) * a });
      this.world.step();
    }
    return n;
  }
  // poses of the dynamic world models: name -> { x, y, z, q: [x, y, z, w] }
  dynPoses() {
    const out = {};
    for (const [name, b] of this.dyn) { const t = b.translation(), q = b.rotation(); out[name] = { x: t.x, y: t.y, z: t.z, q: [q.x, q.y, q.z, q.w], v: b.linvel() }; }
    return out;
  }
  destroy() { try { this.world.free(); } catch { /* already freed */ } }
}

// ---------- joint dynamics of arms (gz_ros2_control, JointPositionController, free joints) ----------
// gz-physics (DART) integrates the full articulated body; here every movable joint is integrated on its own with
// the exact static gravity torque of everything below it and the effective inertia of that subtree about its axis
// (coupling between joints is ignored). Actuation follows what the Gazebo systems command:
//   position (gz_ros2_control): joint velocity command v = position_proportional_gain * update_rate * (q_cmd - q),
//     enforced by the physics up to the joint's <limit effort>, as gz_system.cpp does (JointVelocityCmd);
//   velocity: v = command, up to the effort limit;  effort: tau = clamp(command, +-effort);
//   hold (gz_ros2_control hold_joints, default true): velocity command 0 (the joint stays where it is);
//   free: nothing holds the joint: gravity, <dynamics damping> and the joint limits decide (the arm falls).
const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] };
const qrotv = (q, v) => qrot(q, v);
/** Per movable joint: gravity torque (N m or N), effective inertia, world axis and origin, for joint values q. */
export function jointGravity(model, q, { gravity = [0, 0, -9.80665], base = { t: [0, 0, 0], q: [0, 0, 0, 1] } } = {}) {
  let P; try { P = framePoses(urdfEdges(model, q, true), model.root).poses; } catch { return {}; }
  const W = (n) => (P[n] ? compose(base, { t: P[n].t, q: P[n].q }) : null);
  const kidsOf = {}; for (const j of Object.values(model.joints)) (kidsOf[j.parent] = kidsOf[j.parent] || []).push(j);
  const subtree = (l, out = []) => { out.push(l); for (const j of kidsOf[l] || []) subtree(j.child, out); return out; };
  const com = {};
  for (const [n, l] of Object.entries(model.links)) {
    const T = W(n); if (!T || !l.inertial || !(l.inertial.mass > 0)) continue;
    const o = l.inertial.origin || { xyz: [0, 0, 0], rpy: [0, 0, 0] };
    const C = compose(T, pose6([...o.xyz, ...o.rpy]));
    com[n] = { m: l.inertial.mass, c: C.t, q: C.q, I: l.inertial.inertia || [0, 0, 0, 0, 0, 0] };
  }
  const out = {};
  for (const j of Object.values(model.joints)) {
    if (!["revolute", "continuous", "prismatic"].includes(j.type) || j.mimic) continue;
    const T = W(j.child); if (!T) continue;
    const a = qrotv(T.q, j.axis), p = T.t;
    let tau = 0, I = 0;
    for (const l of subtree(j.child)) {
      const b = com[l]; if (!b) continue;
      if (j.type === "prismatic") { tau += b.m * v3.dot(gravity, a); I += b.m; continue; }
      const r = v3.sub(b.c, p);
      tau += v3.dot(v3.cross(r, gravity.map((g) => g * b.m)), a);
      const ra = v3.cross(a, r); I += b.m * v3.dot(ra, ra);
      const al = qrotv([-b.q[0], -b.q[1], -b.q[2], b.q[3]], a), [xx, xy, xz, yy, yz, zz] = b.I;   // rotational inertia about the axis
      I += xx * al[0] * al[0] + yy * al[1] * al[1] + zz * al[2] * al[2] + 2 * (xy * al[0] * al[1] + xz * al[0] * al[2] + yz * al[1] * al[2]);
    }
    out[j.name] = { tau, I: Math.max(I, 1e-4), axis: a, origin: p };
  }
  return out;
}
/** Advance the arm joints by dt. state: { q: {joint: value}, qd: {joint: velocity} } (changed in place).
 *  modes: { joint: { mode: "position"|"velocity"|"effort"|"hold"|"free", value, gain } }. Joints not in modes are left alone.
 *  Returns { tau: gravity torques, saturated: [joints whose effort limit could not hold them] }. */
export function stepJointDynamics(model, state, modes, dt, opts = {}) {
  const sub = Math.max(1, Math.ceil(dt / (opts.maxStep || 0.002))), h = dt / sub, sat = new Set();
  let G = {};
  for (let k = 0; k < sub; k++) {
    G = jointGravity(model, state.q, opts);
    for (const [name, md] of Object.entries(modes)) {
      const j = model.joints[name], g = G[name]; if (!j || !g) continue;
      const lim = j.limit || {}, E = Number.isFinite(lim.effort) && lim.effort > 0 ? lim.effort : Infinity, vmax = Number.isFinite(lim.velocity) && lim.velocity > 0 ? lim.velocity : Infinity;
      const damp = j.damping || 0, I = g.I + (opts.armature || 0.005);
      let qd = state.qd[name] || 0, q = state.q[name] || 0;
      const motor = (vt) => {   // a velocity constraint the physics enforces with at most E
        vt = Math.max(-vmax, Math.min(vmax, vt));
        const need = (I * (vt - qd)) / h - g.tau + damp * qd;
        if (Math.abs(need) <= E) return vt;
        sat.add(name);
        return qd + (h * (Math.sign(need) * E + g.tau - damp * qd)) / I;
      };
      if (md.mode === "position") qd = motor((md.gain ?? 10) * ((md.value ?? q) - q));
      else if (md.mode === "velocity") qd = motor(md.value || 0);
      else if (md.mode === "hold") qd = motor(md.value !== undefined ? 10 * (md.value - q) : 0);
      else if (md.mode === "effort") { const tau = Math.max(-E, Math.min(E, md.value || 0)); qd = (qd + (h * (tau + g.tau)) / I) / (1 + (h * damp) / I); }
      else if (md.mode === "pid") { const u = Math.max(md.cmdMin ?? -1000, Math.min(md.cmdMax ?? 1000, (md.p ?? 1) * ((md.value ?? q) - q) - (md.d ?? 0.01) * qd)); const tau = Math.max(-E, Math.min(E, u)); qd = (qd + (h * (tau + g.tau)) / I) / (1 + (h * damp) / I); }
      else qd = (qd + (h * g.tau) / I) / (1 + (h * damp) / I);   // free: gravity and damping only
      q += qd * h;
      if (j.type === "revolute" || j.type === "prismatic") { if (q < lim.lower) { q = lim.lower; if (qd < 0) qd = 0; } if (q > lim.upper) { q = lim.upper; if (qd > 0) qd = 0; } }
      state.q[name] = q; state.qd[name] = qd;
    }
    for (const j of Object.values(model.joints)) if (j.mimic && j.mimic.joint in state.q && j.name in state.q) state.q[j.name] = state.q[j.mimic.joint] * j.mimic.multiplier + j.mimic.offset;
  }
  return { tau: Object.fromEntries(Object.entries(G).map(([k, v]) => [k, v.tau])), saturated: [...sat] };
}
