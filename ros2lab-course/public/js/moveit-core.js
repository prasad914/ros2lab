// MoveIt 2 for the practice terminal: the parts of move_group that plan a motion, written in plain JavaScript so they
// run in the browser and in Node (tools/test-moveit.mjs). Nothing here needs three.js or the DOM.
//
//   KinematicModel      forward kinematics of the URDF tree, planning groups (chains), Jacobian, KDL-like IK
//   collision model     every link is covered by spheres fitted to its collision meshes (or visual meshes);
//                       world objects are boxes, cylinders and spheres (moveit_msgs/CollisionObject primitives)
//   ACM                 the SRDF <disable_collisions> pairs: Adjacent, Never (sampled like MoveIt Setup Assistant),
//                       Default (in collision at the default pose)
//   planning pipelines  ompl (RRTConnect, RRT, RRT*, PRM, ... + path simplification),
//                       pilz_industrial_motion_planner (PTP, LIN, CIRC), chomp, stomp
//   adapters            CheckStartStateBounds, CheckStartStateCollision, ValidateSolution,
//                       AddTimeOptimalParameterization (time stamps from joint_limits.yaml)
// MoveIt error codes are the real moveit_msgs/msg/MoveItErrorCodes values.

export const ERR = { SUCCESS: 1, FAILURE: 99999, PLANNING_FAILED: -1, INVALID_MOTION_PLAN: -2, CONTROL_FAILED: -4, TIMED_OUT: -6, PREEMPTED: -7,
  START_STATE_IN_COLLISION: -10, GOAL_IN_COLLISION: -12, GOAL_CONSTRAINTS_VIOLATED: -14, INVALID_GROUP_NAME: -15, INVALID_GOAL_CONSTRAINTS: -16,
  INVALID_ROBOT_STATE: -17, START_STATE_INVALID: -26, GOAL_STATE_INVALID: -27, NO_IK_SOLUTION: -31 };
export const ERR_NAME = Object.fromEntries(Object.entries(ERR).map(([k, v]) => [v, k]));

// ---------------------------------------------------------------- 3x4 transforms (row-major rotation | translation)
const I3 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
function mul(A, B) {
  return [
    A[0] * B[0] + A[1] * B[4] + A[2] * B[8], A[0] * B[1] + A[1] * B[5] + A[2] * B[9], A[0] * B[2] + A[1] * B[6] + A[2] * B[10], A[0] * B[3] + A[1] * B[7] + A[2] * B[11] + A[3],
    A[4] * B[0] + A[5] * B[4] + A[6] * B[8], A[4] * B[1] + A[5] * B[5] + A[6] * B[9], A[4] * B[2] + A[5] * B[6] + A[6] * B[10], A[4] * B[3] + A[5] * B[7] + A[6] * B[11] + A[7],
    A[8] * B[0] + A[9] * B[4] + A[10] * B[8], A[8] * B[1] + A[9] * B[5] + A[10] * B[9], A[8] * B[2] + A[9] * B[6] + A[10] * B[10], A[8] * B[3] + A[9] * B[7] + A[10] * B[11] + A[11]];
}
const apply = (T, p) => [T[0] * p[0] + T[1] * p[1] + T[2] * p[2] + T[3], T[4] * p[0] + T[5] * p[1] + T[6] * p[2] + T[7], T[8] * p[0] + T[9] * p[1] + T[10] * p[2] + T[11]];
const rotv = (T, v) => [T[0] * v[0] + T[1] * v[1] + T[2] * v[2], T[4] * v[0] + T[5] * v[1] + T[6] * v[2], T[8] * v[0] + T[9] * v[1] + T[10] * v[2]];
function inv(T) { const R = [T[0], T[4], T[8], T[1], T[5], T[9], T[2], T[6], T[10]]; const t = [-(R[0] * T[3] + R[1] * T[7] + R[2] * T[11]), -(R[3] * T[3] + R[4] * T[7] + R[5] * T[11]), -(R[6] * T[3] + R[7] * T[7] + R[8] * T[11])]; return [R[0], R[1], R[2], t[0], R[3], R[4], R[5], t[1], R[6], R[7], R[8], t[2]]; }
export function fromRPY(xyz, rpy) {
  const [r, p, y] = rpy, cr = Math.cos(r), sr = Math.sin(r), cp = Math.cos(p), sp = Math.sin(p), cy = Math.cos(y), sy = Math.sin(y);
  return [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr, xyz[0], sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr, xyz[1], -sp, cp * sr, cp * cr, xyz[2]];
}
function axisAngle(a, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, [x, y, z] = a;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0, t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0, t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0];
}
export function fromQuat(t, q) {
  const [x, y, z, w] = q, n = Math.hypot(x, y, z, w) || 1, X = x / n, Y = y / n, Z = z / n, W = w / n;
  return [1 - 2 * (Y * Y + Z * Z), 2 * (X * Y - Z * W), 2 * (X * Z + Y * W), t[0], 2 * (X * Y + Z * W), 1 - 2 * (X * X + Z * Z), 2 * (Y * Z - X * W), t[1], 2 * (X * Z - Y * W), 2 * (Y * Z + X * W), 1 - 2 * (X * X + Y * Y), t[2]];
}
export function toQuat(T) {
  const m00 = T[0], m11 = T[5], m22 = T[10], tr = m00 + m11 + m22; let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (T[9] - T[6]) / s; y = (T[2] - T[8]) / s; z = (T[4] - T[1]) / s; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (T[9] - T[6]) / s; x = 0.25 * s; y = (T[1] + T[4]) / s; z = (T[2] + T[8]) / s; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (T[2] - T[8]) / s; x = (T[1] + T[4]) / s; y = 0.25 * s; z = (T[6] + T[9]) / s; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (T[4] - T[1]) / s; x = (T[2] + T[8]) / s; y = (T[6] + T[9]) / s; z = 0.25 * s; }
  return [x, y, z, w];
}
export const poseOf = (T) => ({ t: [T[3], T[7], T[11]], q: toQuat(T) });
// rotation error (axis * angle) taking R_cur to R_goal, in the base frame
function rotErr(C, G) {
  const R = [G[0] * C[0] + G[1] * C[1] + G[2] * C[2], G[0] * C[4] + G[1] * C[5] + G[2] * C[6], G[0] * C[8] + G[1] * C[9] + G[2] * C[10],
    G[4] * C[0] + G[5] * C[1] + G[6] * C[2], G[4] * C[4] + G[5] * C[5] + G[6] * C[6], G[4] * C[8] + G[5] * C[9] + G[6] * C[10],
    G[8] * C[0] + G[9] * C[1] + G[10] * C[2], G[8] * C[4] + G[9] * C[5] + G[10] * C[6], G[8] * C[8] + G[9] * C[9] + G[10] * C[10]];   // R = G * C^T
  const c = Math.max(-1, Math.min(1, (R[0] + R[4] + R[8] - 1) / 2)), ang = Math.acos(c), v = [R[7] - R[5], R[2] - R[6], R[3] - R[1]];
  if (ang < 1e-9) return [0, 0, 0];
  const s = Math.sin(ang);
  if (Math.abs(s) < 1e-6) {   // 180 degrees: axis from the diagonal
    const ax = [Math.sqrt(Math.max(0, (R[0] + 1) / 2)), Math.sqrt(Math.max(0, (R[4] + 1) / 2)), Math.sqrt(Math.max(0, (R[8] + 1) / 2))];
    if (R[1] < 0) ax[1] = -ax[1]; if (R[2] < 0) ax[2] = -ax[2];
    return ax.map((a) => a * ang);
  }
  return v.map((x) => (x / (2 * s)) * ang);
}

// ---------------------------------------------------------------- kinematics
// model: parseURDF() result. Floating / planar joints count as fixed (as robot_state_publisher and MoveIt's
// default single-group setup treat a robot bolted to the world).
export class KinematicModel {
  constructor(model) {
    this.model = model; this.root = model.root;
    this.order = [];   // links root -> leaves, each with its parent joint
    const walk = (l) => { for (const j of model.childJoints[l] || []) { this.order.push(j); walk(j.child); } };
    walk(model.root);
    this.origin = Object.fromEntries(this.order.map((j) => [j.name, fromRPY(j.origin.xyz, j.origin.rpy)]));
    this.active = this.order.filter((j) => ["revolute", "continuous", "prismatic"].includes(j.type) && !j.mimic).map((j) => j.name);
  }
  jointValue(j, v) { if (j.mimic) return (Number(v[j.mimic.joint]) || 0) * j.mimic.multiplier + j.mimic.offset; return Number(v[j.name]) || 0; }
  jointMat(j, v) {
    const O = this.origin[j.name], x = this.jointValue(j, v);
    if (j.type === "revolute" || j.type === "continuous") return mul(O, axisAngle(j.axis, x));
    if (j.type === "prismatic") { const M = I3(); M[3] = j.axis[0] * x; M[7] = j.axis[1] * x; M[11] = j.axis[2] * x; return mul(O, M); }
    return O;
  }
  // world (root) pose of every link
  fk(values) {
    const P = { [this.root]: I3() };
    for (const j of this.order) P[j.child] = mul(P[j.parent], this.jointMat(j, values));
    return P;
  }
  pathTo(tip, base = this.root) {   // joints from base to tip
    const out = []; let l = tip, g = 0;
    while (l !== base && g++ < 500) { const j = this.model.parentOf[l]; if (!j) return null; out.unshift(j); l = j.parent; }
    return l === base ? out : null;
  }
  // links whose pose depends on none of the given joints (they never move while planning)
  staticLinks(joints) {
    const moving = new Set(), js = new Set(joints);
    for (const j of this.order) if (js.has(j.name) || (j.mimic && js.has(j.mimic.joint)) || moving.has(j.parent)) moving.add(j.child);
    return new Set(Object.keys(this.model.links).filter((l) => !moving.has(l)));
  }
  group(name, base, tip) { return new JointGroup(this, name, base, tip); }
}

// A chain group (like an SRDF <chain base_link tip_link>), with the limits from the URDF and joint_limits.yaml
export class JointGroup {
  constructor(K, name, base, tip, limits = {}) {
    this.K = K; this.name = name; this.base = base; this.tip = tip;
    this.chain = K.pathTo(tip, base) || [];
    this.joints = this.chain.filter((j) => ["revolute", "continuous", "prismatic"].includes(j.type) && !j.mimic).map((j) => j.name);
    const J = (n) => K.model.joints[n];
    this.lower = this.joints.map((n) => (J(n).type === "continuous" ? -Math.PI : J(n).limit ? J(n).limit.lower : -Math.PI));
    this.upper = this.joints.map((n) => (J(n).type === "continuous" ? Math.PI : J(n).limit ? J(n).limit.upper : Math.PI));
    this.setLimits(limits);
  }
  setLimits(limits = {}) {   // joint_limits.yaml: max_velocity / max_acceleration (Pilz and time parameterization need both)
    const J = (n) => this.K.model.joints[n];
    this.vel = this.joints.map((n) => (limits[n] && limits[n].max_velocity) || (J(n).limit && J(n).limit.velocity > 0 ? J(n).limit.velocity : 1.0));
    this.acc = this.joints.map((n) => (limits[n] && limits[n].max_acceleration) || 2 * this.vel[this.joints.indexOf(n)]);
  }
  get dof() { return this.joints.length; }
  vec(values) { return this.joints.map((n) => Number(values[n]) || 0); }
  values(q, base = {}) { const v = { ...base }; this.joints.forEach((n, i) => { v[n] = q[i]; }); return v; }
  clamp(q) { return q.map((x, i) => Math.min(this.upper[i], Math.max(this.lower[i], x))); }
  inBounds(q, eps = 1e-6) { return q.every((x, i) => x >= this.lower[i] - eps && x <= this.upper[i] + eps); }
  random(rng = Math.random) { return this.joints.map((_, i) => this.lower[i] + rng() * (this.upper[i] - this.lower[i])); }
  // tip pose in the base frame of the group, and the joint origins/axes for the Jacobian
  tipFrame(q, base = {}) {
    const v = this.values(q, base); let T = I3(); const axes = [];
    for (const j of this.chain) {
      const M = this.K.jointMat(j, v);
      if (this.joints.includes(j.name)) { const pre = mul(T, this.K.origin[j.name]); axes.push({ p: [pre[3], pre[7], pre[11]], a: rotv(pre, j.axis), prismatic: j.type === "prismatic" }); }
      T = mul(T, M);
    }
    return { T, axes };
  }
  jacobian(q, base = {}) {
    const { T, axes } = this.tipFrame(q, base), pe = [T[3], T[7], T[11]];
    const Jc = axes.map(({ p, a, prismatic }) => (prismatic ? [a[0], a[1], a[2], 0, 0, 0] : [a[1] * (pe[2] - p[2]) - a[2] * (pe[1] - p[1]), a[2] * (pe[0] - p[0]) - a[0] * (pe[2] - p[2]), a[0] * (pe[1] - p[1]) - a[1] * (pe[0] - p[0]), a[0], a[1], a[2]]));
    return { T, Jc };   // Jc[i] = column i (6 values: linear, angular)
  }
}

// ---------------------------------------------------------------- IK (KDL-style damped least squares with random restarts,
// like kdl_kinematics_plugin: search until the timeout, joint limits respected, the closest solution to the seed wins)
export function solveIK(G, goalT, { seed, base = {}, positionOnly = false, attempts = 40, iterations = 120, tol = 1e-4, rotTol = 1e-3, valid = null, rng = Math.random } = {}) {
  const n = G.dof; if (!n) return null;
  let best = null, bestD = Infinity;
  const tryFrom = (q0) => {
    let q = q0.slice(), lambda = 0.05;
    for (let it = 0; it < iterations; it++) {
      const { T, Jc } = G.jacobian(q, base);
      const ep = [goalT[3] - T[3], goalT[7] - T[7], goalT[11] - T[11]];
      const er = positionOnly ? [0, 0, 0] : rotErr(T, goalT);
      const pn = Math.hypot(...ep), rn = Math.hypot(...er);
      if (pn < tol && (positionOnly || rn < rotTol)) return q;
      // e = J dq, solve (J J^T + l^2 I) y = e, dq = J^T y   (rows: 3 or 6)
      const rows = positionOnly ? 3 : 6, e = positionOnly ? ep : [...ep, ...er.map((x) => x * 0.7)];
      const JJ = Array.from({ length: rows }, (_, r) => Array.from({ length: rows }, (_, c) => { let s = 0; for (let k = 0; k < n; k++) s += Jc[k][r] * Jc[k][c] * (r >= 3 ? 0.7 : 1) * (c >= 3 ? 0.7 : 1); return s + (r === c ? lambda * lambda : 0); }));
      const y = solveLin(JJ, e); if (!y) return null;
      let dq = Array.from({ length: n }, (_, k) => { let s = 0; for (let r = 0; r < rows; r++) s += Jc[k][r] * (r >= 3 ? 0.7 : 1) * y[r]; return s; });
      const m = Math.max(...dq.map(Math.abs)); if (m > 0.3) dq = dq.map((x) => (x * 0.3) / m);
      q = G.clamp(q.map((x, k) => x + dq[k]));
    }
    return null;
  };
  const seed0 = seed ? G.clamp(seed) : G.vec(base);
  for (let a = 0; a < attempts; a++) {
    const q0 = a === 0 ? seed0 : a < 4 ? G.clamp(seed0.map((x, i) => x + (rng() - 0.5) * 0.6 * a)) : G.random(rng);
    const q = tryFrom(q0);
    if (!q) continue;
    if (valid && !valid(q)) continue;
    const d = q.reduce((s, x, i) => s + (x - seed0[i]) ** 2, 0);
    if (d < bestD) { bestD = d; best = q; }
    if (a < 4) break;   // a solution near the seed: take it (consistent interactive-marker dragging)
  }
  return best;
}
function solveLin(A, b) {   // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// ---------------------------------------------------------------- link geometry -> spheres
// Points (in the link frame) on a link's collision shapes; meshes are read with readMesh(filename) -> [[x,y,z]...]
export async function linkPoints(model, readMesh, { useVisual = "fallback" } = {}) {
  const out = {};
  for (const l of Object.values(model.links)) {
    const shapes = l.collisions.length && useVisual !== "always" ? l.collisions : l.visuals;
    const pts = [];
    for (const s of shapes) {
      const M = fromRPY(s.origin.xyz, s.origin.rpy), g = s.geom;
      let local = [];
      if (g.type === "box") { const [a, b, c] = g.size.map((x) => x / 2); for (let i = 0; i < 300; i++) { const p = [(Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * b, (Math.random() * 2 - 1) * c]; const k = Math.floor(Math.random() * 3); p[k] = Math.sign(p[k] || 1) * [a, b, c][k]; local.push(p); } }
      else if (g.type === "cylinder") { for (let i = 0; i < 300; i++) { const t = Math.random() * 2 * Math.PI, z = (Math.random() * 2 - 1) * g.length / 2, rr = i % 3 ? g.radius : g.radius * Math.sqrt(Math.random()); local.push([rr * Math.cos(t), rr * Math.sin(t), i % 3 ? z : Math.sign(z || 1) * g.length / 2]); } }
      else if (g.type === "sphere") local.push({ sphere: g.radius });
      else if (g.type === "mesh") { try { const raw = await readMesh(g.filename); const sc = g.scale || [1, 1, 1]; local = (raw || []).map((p) => [p[0] * sc[0], p[1] * sc[1], p[2] * sc[2]]); } catch { local = []; } }
      for (const p of local) pts.push(p.sphere ? { c: apply(M, [0, 0, 0]), r: p.sphere } : apply(M, p));
    }
    out[l.name] = pts;
  }
  return out;
}
// A few spheres that cover a point cloud (k-means; each radius reaches its farthest point). Small padding like MoveIt's
// default link padding is added by the caller.
export function fitSpheres(points, { maxSpheres = 8, minRadius = 0.005 } = {}) {
  const fixed = points.filter((p) => p.c), P = points.filter((p) => Array.isArray(p));
  const out = fixed.map((p) => ({ c: p.c, r: p.r }));
  if (!P.length) return out;
  let pts = P; if (pts.length > 3000) { const step = pts.length / 3000; pts = Array.from({ length: 3000 }, (_, i) => P[Math.floor(i * step)]); }
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  const ext = hi.map((h, k) => h - lo[k]).sort((a, b) => b - a), thick = Math.max(ext[1], 1e-3);
  const k = Math.max(1, Math.min(maxSpheres, Math.round(ext[0] / thick * 2.2) + (ext[1] > 2.2 * ext[2] ? 1 : 0)));
  // init: spread along the longest axis
  const ax = [0, 1, 2].reduce((b, i) => (hi[i] - lo[i] > hi[b] - lo[b] ? i : b), 0);
  let C = Array.from({ length: k }, (_, i) => { const c = lo.map((v, j) => (v + hi[j]) / 2); c[ax] = lo[ax] + ((i + 0.5) / k) * (hi[ax] - lo[ax]); return c; });
  let assign = new Array(pts.length).fill(0);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < pts.length; i++) { let b = 0, bd = Infinity; for (let c = 0; c < k; c++) { const d = (pts[i][0] - C[c][0]) ** 2 + (pts[i][1] - C[c][1]) ** 2 + (pts[i][2] - C[c][2]) ** 2; if (d < bd) { bd = d; b = c; } } assign[i] = b; }
    const S = C.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => { const s = S[assign[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    C = C.map((c, i) => (S[i][3] ? [S[i][0] / S[i][3], S[i][1] / S[i][3], S[i][2] / S[i][3]] : c));
  }
  const R = C.map(() => 0);
  pts.forEach((p, i) => { const c = C[assign[i]]; R[assign[i]] = Math.max(R[assign[i]], Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])); });
  C.forEach((c, i) => { if (R[i] > 0 || pts.some((_, j) => assign[j] === i)) out.push({ c, r: Math.max(minRadius, R[i]) }); });
  return out;
}
export function linkSpheres(points, opts) { return Object.fromEntries(Object.entries(points).map(([l, p]) => [l, fitSpheres(p, opts)])); }

// ---------------------------------------------------------------- mesh files -> points (STL binary/ASCII, COLLADA, OBJ)
// dae / obj are text; stl may be an ArrayBuffer. Units: COLLADA <unit meter>, nodes' <matrix>/<translate>/<rotate>/<scale>.
export function meshPointsFrom(data, ext) {
  ext = String(ext).toLowerCase();
  if (ext === "stl") return stlPoints(data);
  if (ext === "obj") { const t = typeof data === "string" ? data : new TextDecoder().decode(data); return [...t.matchAll(/^v\s+(\S+)\s+(\S+)\s+(\S+)/gm)].map((m) => [+m[1], +m[2], +m[3]]); }
  if (ext === "dae") return daePoints(typeof data === "string" ? data : new TextDecoder().decode(data));
  return [];
}
function stlPoints(data) {
  const buf = data instanceof ArrayBuffer ? data : data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : null;
  if (buf && buf.byteLength >= 84) {
    const dv = new DataView(buf), n = dv.getUint32(80, true);
    if (84 + n * 50 === buf.byteLength) {
      const out = []; const step = Math.max(1, Math.floor(n / 4000));
      for (let i = 0; i < n; i += step) for (let v = 0; v < 3; v++) { const o = 84 + i * 50 + 12 + v * 12; out.push([dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)]); }
      return out;
    }
  }
  const t = typeof data === "string" ? data : new TextDecoder().decode(buf || data);
  return [...t.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map((m) => [+m[1], +m[2], +m[3]]);
}
function daePoints(text) {
  const unit = Number((text.match(/<unit\b[^>]*meter="([^"]+)"/) || [, 1])[1]) || 1;
  const yUp = /<up_axis>\s*Y_UP\s*<\/up_axis>/.test(text);
  // geometry id -> positions
  const geo = {};
  for (const g of text.matchAll(/<geometry\b[^>]*id="([^"]+)"[\s\S]*?<\/geometry>/g)) {
    const body = g[0];
    const posSrc = (body.match(/<vertices\b[\s\S]*?<input\b[^>]*semantic="POSITION"[^>]*source="#([^"]+)"/) || [])[1];
    let arr = null;
    for (const s of body.matchAll(/<source\b[^>]*id="([^"]+)"[\s\S]*?<\/source>/g)) if (!posSrc || s[1] === posSrc) { const fa = s[0].match(/<float_array[^>]*>([\s\S]*?)<\/float_array>/); if (fa) { arr = fa[1].trim().split(/\s+/).map(Number); break; } }
    if (!arr) continue;
    const pts = []; const step = Math.max(1, Math.floor(arr.length / 3 / 3000));
    for (let i = 0; i + 2 < arr.length; i += 3 * step) pts.push([arr[i], arr[i + 1], arr[i + 2]]);
    geo[g[1]] = pts;
  }
  // visual scene: walk nodes with their transforms
  const out = [];
  const scene = (text.match(/<library_visual_scenes>([\s\S]*?)<\/library_visual_scenes>/) || [])[1];
  const nodeMat = (head) => {
    let M = I3();
    for (const m of head.matchAll(/<(matrix|translate|rotate|scale)\b[^>]*>([^<]*)<\/\1>/g)) {
      const v = m[2].trim().split(/\s+/).map(Number);
      if (m[1] === "matrix") M = mul(M, [v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11]]);
      else if (m[1] === "translate") M = mul(M, [1, 0, 0, v[0], 0, 1, 0, v[1], 0, 0, 1, v[2]]);
      else if (m[1] === "rotate") M = mul(M, axisAngle([v[0], v[1], v[2]].map((x, _, a) => x / (Math.hypot(...a) || 1)), (v[3] * Math.PI) / 180));
      else if (m[1] === "scale") M = mul(M, [v[0], 0, 0, 0, 0, v[1], 0, 0, 0, 0, v[2], 0]);
    }
    return M;
  };
  if (scene) {
    // a small tokenizer: <node ...> opens, </node> closes, transforms and instance_geometry belong to the innermost node
    const stack = [I3()]; let pending = "";
    const re = /<node\b[^>]*>|<\/node>|<instance_geometry\b[^>]*url="#([^"]+)"|<(matrix|translate|rotate|scale)\b[^>]*>[^<]*<\/\2>/g; let m;
    let cur = I3(), headDone = true;
    while ((m = re.exec(scene))) {
      const tok = m[0];
      if (tok.startsWith("<node")) { stack.push(cur); headDone = false; pending = ""; continue; }
      if (tok === "</node>") { cur = stack.pop(); continue; }
      if (m[2]) { pending = tok; cur = mul(cur, nodeMat(pending)); continue; }
      if (m[1] && geo[m[1]]) for (const p of geo[m[1]]) out.push(apply(cur, p));
    }
    void headDone;
  }
  const pts = out.length ? out : Object.values(geo).flat();
  return pts.map((p) => { const q = yUp ? [p[0], -p[2], p[1]] : p; return [q[0] * unit, q[1] * unit, q[2] * unit]; });
}

// ---------------------------------------------------------------- collision checking
// objects: [{ id, type: "box"|"cylinder"|"sphere", dims: [...] (box: x y z, cylinder: height radius, sphere: radius), pose: 3x4 }]
// (the dims order of shape_msgs/SolidPrimitive: CYLINDER_HEIGHT=0, CYLINDER_RADIUS=1)
export function objectDistance(o, p) {   // signed distance from point p to the object's surface (negative inside)
  const Ti = o.inv || (o.inv = inv(o.pose)); const l = apply(Ti, p);
  if (o.type === "sphere") return Math.hypot(...l) - o.dims[0];
  if (o.type === "box") {
    const q = [Math.abs(l[0]) - o.dims[0] / 2, Math.abs(l[1]) - o.dims[1] / 2, Math.abs(l[2]) - o.dims[2] / 2];
    const outside = Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)), inside = Math.min(Math.max(q[0], q[1], q[2]), 0);
    return outside + inside;
  }
  if (o.type === "cylinder") {
    const dr = Math.hypot(l[0], l[1]) - o.dims[1], dz = Math.abs(l[2]) - o.dims[0] / 2;
    return Math.min(Math.max(dr, dz), 0) + Math.hypot(Math.max(dr, 0), Math.max(dz, 0));
  }
  return Infinity;
}
export class CollisionModel {
  // spheres: link -> [{c, r}] in the link frame; acm: Set of "a|b" pairs whose collisions are ignored (SRDF disable_collisions)
  constructor(K, spheres, { acm = new Set(), padding = 0.0, group = null } = {}) {
    this.K = K; this.spheres = spheres; this.acm = acm; this.padding = padding; this.objects = []; this.attached = {};
    this.links = Object.keys(spheres).filter((l) => spheres[l] && spheres[l].length);
    this.setGroup(group);
  }
  setGroup(G) {
    this.G = G;
    this.static = G ? this.K.staticLinks(G.joints) : new Set();
    // self-collision pairs that can change while this group moves
    const L = this.links; this.pairs = [];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (this.allowed(a, b)) continue;
      if (this.static.has(a) && this.static.has(b)) continue;
      this.pairs.push([a, b]);
    }
    this.moving = L.filter((l) => !this.static.has(l));
  }
  allowed(a, b) { return this.acm.has(`${a}|${b}`) || this.acm.has(`${b}|${a}`); }
  setObjects(list) { this.objects = (list || []).map((o) => ({ ...o, inv: null })); }
  worldSpheres(P, links) {
    const W = {};
    for (const l of links) { const T = P[l]; if (!T) continue; W[l] = this.spheres[l].map((s) => ({ c: apply(T, s.c), r: s.r + this.padding })); }
    return W;
  }
  // first contact, or null. full: every link (start/goal checks); otherwise only links the group moves
  contact(values, { full = false } = {}) {
    const P = this.K.fk(values), links = full ? this.links : this.moving;
    const W = this.worldSpheres(P, full ? this.links : [...new Set([...this.moving, ...this.pairs.flat()])]);
    for (const l of links) {
      const S = W[l]; if (!S) continue;
      for (const o of this.objects) { if (this.allowed(l, o.id)) continue; for (const s of S) if (objectDistance(o, s.c) < s.r) return { a: l, b: o.id, typeB: "Object" }; }
    }
    for (const [a, b] of this.pairs) {
      const A = W[a], B = W[b]; if (!A || !B) continue;
      for (const s of A) for (const t of B) { const d = Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1], s.c[2] - t.c[2]); if (d < s.r + t.r) return { a, b, typeB: "Robot link" }; }
    }
    return null;
  }
  valid(values) { return !this.contact(values); }
  // obstacle clearance (signed) of every moving sphere; for CHOMP / STOMP costs
  clearances(values) {
    const P = this.K.fk(values), W = this.worldSpheres(P, this.moving), out = [];
    for (const l of this.moving) for (const s of W[l] || []) { let d = Infinity; for (const o of this.objects) if (!this.allowed(l, o.id)) d = Math.min(d, objectDistance(o, s.c) - s.r); out.push(d); }
    for (const [a, b] of this.pairs) { const A = W[a], B = W[b]; if (!A || !B) continue; for (const s of A) for (const t of B) out.push(Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1], s.c[2] - t.c[2]) - s.r - t.r); }
    return out;
  }
}
export const contactText = (c) => `Found a contact between '${c.a}' (type 'Robot link') and '${c.b}' (type '${c.typeB}'), which constitutes a collision. Contact information is not stored.`;

// SRDF <disable_collisions>: like MoveIt Setup Assistant's "Self-Collisions" step (adjacent links, links in collision
// in the default pose, and links never in collision over N random samples)
export function computeACM(K, spheres, { samples = 3000, rng = Math.random, defaults = {} } = {}) {
  const links = Object.keys(spheres).filter((l) => spheres[l].length);
  const out = [], seen = new Set(), add = (a, b, reason) => { const k = a < b ? `${a}|${b}` : `${b}|${a}`; if (seen.has(k)) return; seen.add(k); out.push({ link1: a, link2: b, reason }); };
  // adjacent: parent / child links (fixed joints are merged like MSA does: links joined by a fixed joint count as one)
  const merged = (l) => { let c = l, g = 0; while (K.model.parentOf[c] && K.model.parentOf[c].type === "fixed" && g++ < 100) c = K.model.parentOf[c].parent; return c; };
  for (const j of K.order) add(j.parent, j.child, "Adjacent");
  for (const a of Object.keys(K.model.links)) for (const b of Object.keys(K.model.links)) if (a < b && merged(a) === merged(b)) add(a, b, "Adjacent");
  for (const j of K.order) if (j.type !== "fixed") { const pa = merged(j.parent); for (const b of Object.keys(K.model.links)) if (merged(b) === pa) add(b, j.child, "Adjacent"); }
  const hit = (W, a, b) => W[a] && W[b] && W[a].some((s) => W[b].some((t) => Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1], s.c[2] - t.c[2]) < s.r + t.r));
  const world = (v) => { const P = K.fk(v), W = {}; for (const l of links) W[l] = spheres[l].map((s) => ({ c: apply(P[l], s.c), r: s.r })); return W; };
  for (const d of Array.isArray(defaults) ? defaults : [defaults]) {   // the default pose and the named poses (home, ready ...)
    const W0 = world(d);
    for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) if (hit(W0, links[i], links[j])) add(links[i], links[j], "Default");
  }
  const count = new Map();
  const act = K.active.map((n) => K.model.joints[n]);
  for (let s = 0; s < samples; s++) {
    const v = {}; for (const j of act) { const lo = j.limit ? j.limit.lower : -Math.PI, hi = j.limit ? j.limit.upper : Math.PI; v[j.name] = lo + rng() * (hi - lo); }
    const W = world(v);
    for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) if (hit(W, links[i], links[j])) { const k = `${links[i]}|${links[j]}`; count.set(k, (count.get(k) || 0) + 1); }
  }
  for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) { const c = count.get(`${links[i]}|${links[j]}`) || 0; if (!c) add(links[i], links[j], "Never"); else if (c > 0.95 * samples) add(links[i], links[j], "Always"); }
  return out;
}

// ---------------------------------------------------------------- path helpers
const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function motionValid(check, a, b, step) { const n = Math.max(1, Math.ceil(dist(a, b) / step)); for (let i = 1; i <= n; i++) if (!check(lerp(a, b, i / n))) return false; return true; }
function pathLength(P) { let s = 0; for (let i = 1; i < P.length; i++) s += dist(P[i - 1], P[i]); return s; }
function densify(P, step) { const out = [P[0]]; for (let i = 1; i < P.length; i++) { const n = Math.max(1, Math.ceil(dist(P[i - 1], P[i]) / step)); for (let k = 1; k <= n; k++) out.push(lerp(P[i - 1], P[i], k / n)); } return out; }
// OMPL PathSimplifier: reduceVertices (shortcutting) + smoothBSpline, keeping every segment valid
function simplify(P, check, step, rng, deadline) {
  let path = P.map((x) => x.slice());
  for (let it = 0; it < 200 && path.length > 2 && now() < deadline; it++) {
    const i = Math.floor(rng() * (path.length - 2)), j = i + 2 + Math.floor(rng() * (path.length - i - 2));
    if (j >= path.length) continue;
    if (motionValid(check, path[i], path[j], step)) path = [...path.slice(0, i + 1), ...path.slice(j)];
  }
  for (let pass = 0; pass < 3 && path.length > 2; pass++) {   // B-spline smoothing: move interior points toward their neighbours' mid-point
    const np = path.map((x) => x.slice());
    for (let i = 1; i < path.length - 1; i++) { const m = lerp(path[i - 1], path[i + 1], 0.5), c = lerp(path[i], m, 0.5); if (check(c) && motionValid(check, np[i - 1], c, step) && motionValid(check, c, path[i + 1], step)) np[i] = c; }
    path = np;
  }
  return path;
}
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

// ---------------------------------------------------------------- OMPL planners (joint space)
function nearest(tree, q) { let b = 0, bd = Infinity; for (let i = 0; i < tree.length; i++) { const d = dist(tree[i].q, q); if (d < bd) { bd = d; b = i; } } return b; }
function rrtConnect(G, start, goal, check, { range, step, deadline, rng }) {
  const A = [{ q: start, p: -1 }], B = [{ q: goal, p: -1 }];
  const extend = (T, q) => { const n = nearest(T, q), d = dist(T[n].q, q), qn = d > range ? lerp(T[n].q, q, range / d) : q; if (!check(qn) || !motionValid(check, T[n].q, qn, step)) return -1; T.push({ q: qn, p: n }); return dist(qn, q) < 1e-9 ? 2 : 1; };
  const connect = (T, q) => { let r; do { r = extend(T, q); } while (r === 1); return r; };
  const trace = (T, i) => { const out = []; while (i >= 0) { out.push(T[i].q); i = T[i].p; } return out; };
  let a = A, b = B, swapped = false;
  while (now() < deadline) {
    const qr = G.random(rng);
    if (extend(a, qr) !== -1) {
      const qnew = a[a.length - 1].q;
      if (connect(b, qnew) === 2) { const pa = trace(a, a.length - 1).reverse(), pb = trace(b, b.length - 1); const path = [...pa, ...pb.slice(1)]; return swapped ? path.reverse() : path; }
    }
    [a, b] = [b, a]; swapped = !swapped;
  }
  return null;
}
function rrt(G, start, goal, check, { range, step, deadline, rng, goalBias = 0.05 }) {
  const T = [{ q: start, p: -1 }];
  while (now() < deadline) {
    const qr = rng() < goalBias ? goal : G.random(rng);
    const n = nearest(T, qr), d = dist(T[n].q, qr), qn = d > range ? lerp(T[n].q, qr, range / d) : qr;
    if (!check(qn) || !motionValid(check, T[n].q, qn, step)) continue;
    T.push({ q: qn, p: n });
    if (dist(qn, goal) < range && motionValid(check, qn, goal, step)) { const out = [goal]; let i = T.length - 1; while (i >= 0) { out.push(T[i].q); i = T[i].p; } return out.reverse(); }
  }
  return null;
}
function rrtStar(G, start, goal, check, { range, step, deadline, rng }) {   // optimizing: keeps improving until the planning time is used
  const T = [{ q: start, p: -1, c: 0 }]; let goalNode = -1;
  const dim = G.dof, gamma = 2 * Math.pow(1 + 1 / dim, 1 / dim) * range * 2;
  while (now() < deadline) {
    const qr = rng() < 0.05 ? goal : G.random(rng);
    const n = nearest(T, qr), d = dist(T[n].q, qr), qn = d > range ? lerp(T[n].q, qr, range / d) : qr;
    if (!check(qn) || !motionValid(check, T[n].q, qn, step)) continue;
    const rad = Math.min(range * 3, gamma * Math.pow(Math.log(T.length + 1) / (T.length + 1), 1 / dim));
    const near = []; for (let i = 0; i < T.length; i++) if (dist(T[i].q, qn) < rad) near.push(i);
    let best = n, bc = T[n].c + dist(T[n].q, qn);
    for (const i of near) { const c = T[i].c + dist(T[i].q, qn); if (c < bc && motionValid(check, T[i].q, qn, step)) { bc = c; best = i; } }
    T.push({ q: qn, p: best, c: bc }); const k = T.length - 1;
    for (const i of near) { const c = bc + dist(qn, T[i].q); if (c < T[i].c && motionValid(check, qn, T[i].q, step)) { T[i].p = k; T[i].c = c; } }
    if (dist(qn, goal) < range && motionValid(check, qn, goal, step)) { const c = bc + dist(qn, goal); if (goalNode < 0 || c < T[goalNode].c) { T.push({ q: goal, p: k, c }); goalNode = T.length - 1; } }
  }
  if (goalNode < 0) return null;
  const out = []; let i = goalNode; while (i >= 0) { out.push(T[i].q); i = T[i].p; } return out.reverse();
}
function anytime(G, start, goal, check, o) {   // optimizing planners: keep improving the best solution until the time is used
  let best = null, bestL = Infinity;
  while (now() < o.deadline) {
    const p = rrtConnect(G, start, goal, check, { ...o, deadline: Math.min(o.deadline, now() + Math.max(0.2, (o.deadline - now()) / 2)) });
    if (!p) { if (best) break; continue; }
    const s = simplify(p, check, o.step, o.rng, Math.min(o.deadline, now() + 0.15)), L = pathLength(s);
    if (L < bestL) { best = s; bestL = L; }
  }
  return best;
}
function prm(G, start, goal, check, { range, step, deadline, rng }) {
  const V = [start, goal], E = [[], []], k = 10;
  const connectNode = (i) => { const ds = V.map((q, j) => [j, dist(q, V[i])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, k); for (const [j, d] of ds) if (d < range * 4 && motionValid(check, V[i], V[j], step)) { E[i].push([j, d]); E[j].push([i, d]); } };
  connectNode(0); connectNode(1);
  const search = () => {   // Dijkstra 0 -> 1
    const D = V.map(() => Infinity), P = V.map(() => -1), done = new Set(); D[0] = 0;
    for (;;) { let u = -1, bd = Infinity; for (let i = 0; i < V.length; i++) if (!done.has(i) && D[i] < bd) { bd = D[i]; u = i; } if (u < 0) return null; if (u === 1) break; done.add(u); for (const [v, w] of E[u]) if (D[u] + w < D[v]) { D[v] = D[u] + w; P[v] = u; } }
    const out = []; let i = 1; while (i >= 0) { out.push(V[i]); i = P[i]; } return out.reverse();
  };
  while (now() < deadline) {
    for (let s = 0; s < 20; s++) { const q = G.random(rng); if (!check(q)) continue; V.push(q); E.push([]); connectNode(V.length - 1); }
    const p = search(); if (p) return p;
  }
  return null;
}
// planner ids that MoveIt Setup Assistant writes into ompl_planning.yaml, and the algorithm each one runs here
export const OMPL_PLANNERS = ["AnytimePathShortening", "SBL", "EST", "LBKPIECE", "BKPIECE", "KPIECE", "RRT", "RRTConnect", "RRTstar", "TRRT", "PRM", "PRMstar", "FMT", "BFMT", "PDST", "STRIDE", "BiTRRT", "LBTRRT", "BiEST", "ProjEST", "LazyPRM", "LazyPRMstar", "SPARS", "SPARStwo"];
const OMPL_ALGO = { RRTConnect: rrtConnect, BKPIECE: rrtConnect, LBKPIECE: rrtConnect, SBL: rrtConnect, BiEST: rrtConnect, BiTRRT: rrtConnect, AnytimePathShortening: rrtConnect,
  RRT: rrt, KPIECE: rrt, EST: rrt, ProjEST: rrt, PDST: rrt, STRIDE: rrt, TRRT: rrt,
  RRTstar: anytime, LBTRRT: anytime, FMT: anytime, BFMT: anytime,
  PRM: prm, PRMstar: anytime, LazyPRM: prm, LazyPRMstar: anytime, SPARS: prm, SPARStwo: prm };
void rrtStar;
const OPTIMIZING = new Set(["RRTstar", "PRMstar", "LazyPRMstar", "FMT", "BFMT", "LBTRRT", "AnytimePathShortening", "SPARS", "SPARStwo"]);

// ---------------------------------------------------------------- time parameterization
// AddTimeOptimalParameterization: velocity and acceleration limits (scaled) along the path, forward/backward passes
export function timeParameterize(G, path, { velScale = 0.1, accScale = 0.1, resample = 0.02 } = {}) {
  const P = densify(path, resample);
  const vmax = G.vel.map((v) => v * Math.max(1e-3, Math.min(1, velScale))), amax = G.acc.map((a) => a * Math.max(1e-3, Math.min(1, accScale)));
  const n = P.length; if (n < 2) return [{ positions: P[0], velocities: P[0].map(() => 0), accelerations: P[0].map(() => 0), t: 0 }];
  // speed along the path parameter s (per segment): ds = |dq|; joint velocity = (dq/ds) * sdot
  const seg = []; for (let i = 1; i < n; i++) { const d = P[i].map((x, k) => x - P[i - 1][k]); const L = Math.hypot(...d) || 1e-9; seg.push({ L, u: d.map((x) => x / L) }); }
  const sdMax = seg.map(({ u }) => Math.min(...u.map((x, k) => (Math.abs(x) > 1e-9 ? vmax[k] / Math.abs(x) : Infinity))));
  const aS = seg.map(({ u }) => Math.min(...u.map((x, k) => (Math.abs(x) > 1e-9 ? amax[k] / Math.abs(x) : Infinity))));
  const v = new Array(n).fill(0);
  for (let i = 1; i < n; i++) v[i] = Math.min(sdMax[i - 1], i < n - 1 ? sdMax[i] : 0, Math.sqrt(v[i - 1] ** 2 + 2 * aS[i - 1] * seg[i - 1].L));
  v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * aS[i] * seg[i].L));
  v[0] = 0;
  const out = []; let t = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) { const avg = (v[i] + v[i - 1]) / 2; t += seg[i - 1].L / Math.max(avg, 1e-4); }
    const u = seg[Math.min(i, n - 2)].u;
    out.push({ positions: P[i], velocities: u.map((x) => x * v[i]), accelerations: P[i].map(() => 0), t });
  }
  for (let i = 1; i < n - 1; i++) { const dt = out[i + 1].t - out[i - 1].t; out[i].accelerations = out[i].velocities.map((_, k) => (out[i + 1].velocities[k] - out[i - 1].velocities[k]) / (dt || 1)); }
  return out;
}

// ---------------------------------------------------------------- Pilz industrial motion planner
// PTP: every joint starts and stops together; trapezoidal velocity (the slowest joint sets the time)
function pilzPTP(G, start, goal, { velScale, accScale, dt = 0.02 }) {
  const d = goal.map((x, i) => x - start[i]);
  const vm = G.vel.map((v) => v * velScale), am = G.acc.map((a) => a * accScale);
  // time of each joint with a trapezoid (or triangle) profile; the leading axis decides, others are scaled
  const T = d.map((x, i) => { const D = Math.abs(x); if (D < 1e-12) return 0; const ta = vm[i] / am[i]; return D > vm[i] * ta ? D / vm[i] + ta : 2 * Math.sqrt(D / am[i]); });
  const k = T.indexOf(Math.max(...T)), Tt = T[k]; if (Tt < 1e-9) return [{ positions: start, velocities: start.map(() => 0), accelerations: start.map(() => 0), t: 0 }];
  const D = Math.abs(d[k]); let ta = vm[k] / am[k]; if (D <= vm[k] * ta) ta = Tt / 2;
  const vpk = D / (Tt - ta);   // peak speed of the leading axis
  const sOf = (t) => (t < ta ? 0.5 * (vpk / ta) * t * t : t < Tt - ta ? 0.5 * vpk * ta + vpk * (t - ta) : D - 0.5 * (vpk / ta) * (Tt - t) ** 2) / D;
  const vOf = (t) => (t < ta ? (vpk / ta) * t : t < Tt - ta ? vpk : (vpk / ta) * (Tt - t)) / D;
  const out = [];
  for (let t = 0; t < Tt + 1e-9; t += dt) { const s = sOf(Math.min(t, Tt)), sd = vOf(Math.min(t, Tt)); out.push({ positions: start.map((x, i) => x + d[i] * s), velocities: d.map((x) => x * sd), accelerations: d.map(() => 0), t: Math.min(t, Tt) }); }
  if (out[out.length - 1].t < Tt) out.push({ positions: goal.slice(), velocities: goal.map(() => 0), accelerations: goal.map(() => 0), t: Tt });
  return out;
}
// LIN: the tool moves on a straight line (orientation by slerp), Cartesian trapezoid limited by pilz_cartesian_limits.yaml
function slerpRot(A, B, s) { const qa = toQuat(A), qb = toQuat(B); let dot = qa.reduce((x, v, i) => x + v * qb[i], 0); const b = dot < 0 ? qb.map((x) => -x) : qb; dot = Math.abs(dot); let q; if (dot > 0.9995) q = qa.map((x, i) => x + (b[i] - x) * s); else { const th = Math.acos(dot), s0 = Math.sin((1 - s) * th) / Math.sin(th), s1 = Math.sin(s * th) / Math.sin(th); q = qa.map((x, i) => s0 * x + s1 * b[i]); } return fromQuat([0, 0, 0], q); }
function pilzCartesian(G, start, poseAt, totalLen, totalAng, { base, cart, velScale, accScale, dt = 0.02 }) {
  const vt = cart.max_trans_vel * velScale, at = cart.max_trans_acc * accScale, vr = cart.max_rot_vel * velScale, ar = at * (cart.max_rot_vel / cart.max_trans_vel);
  const prof = (D, vm, am) => { if (D < 1e-9) return 0; const ta = vm / am; return D > vm * ta ? D / vm + ta : 2 * Math.sqrt(D / am); };
  const Tt = Math.max(prof(totalLen, vt, at), prof(totalAng, vr, ar), dt);
  const ta = Math.min(Tt / 2, Math.max(vt / at, 1e-3)), vpk = 1 / (Tt - ta);
  const sOf = (t) => (t < ta ? 0.5 * (vpk / ta) * t * t : t < Tt - ta ? 0.5 * vpk * ta + vpk * (t - ta) : 1 - 0.5 * (vpk / ta) * (Tt - t) ** 2);
  const out = []; let q = start.slice();
  for (let t = 0; ; t += dt) {
    const tt = Math.min(t, Tt), s = Math.max(0, Math.min(1, sOf(tt)));
    const qn = solveIK(G, poseAt(s), { seed: q, base, attempts: 3, iterations: 80, positionOnly: cart.positionOnly });
    if (!qn) return { error: ERR.NO_IK_SOLUTION, message: `Failed to compute inverse kinematics for link '${G.tip}' at ${(s * 100).toFixed(0)} % of the path` };
    if (Math.max(...qn.map((x, i) => Math.abs(x - q[i]))) > 0.5) return { error: ERR.PLANNING_FAILED, message: "Joint space jump detected while following the Cartesian path (the robot would flip its configuration)" };
    out.push({ positions: qn, velocities: qn.map(() => 0), accelerations: qn.map(() => 0), t: tt }); q = qn;
    if (tt >= Tt) break;
  }
  for (let i = 1; i < out.length - 1; i++) out[i].velocities = out[i].positions.map((x, k) => (out[i + 1].positions[k] - out[i - 1].positions[k]) / (out[i + 1].t - out[i - 1].t));
  return { points: out };
}

// ---------------------------------------------------------------- CHOMP (covariant functional gradient descent)
function chomp(G, start, goal, CM, base, params, deadline, step = 0.01) {
  const N = 40, dof = G.dof, P = { max_iterations: 200, max_iterations_after_collision_free: 5, smoothness_cost_weight: 0.1, obstacle_cost_weight: 1.0, learning_rate: 0.01, joint_update_limit: 0.1, collision_clearance: 0.2, collision_threshold: 0.07, ...params };
  // initial trajectory: quintic spline from start to goal ("quintic-spline" initialization)
  let X = Array.from({ length: N }, (_, i) => { const s = i / (N - 1), b = 10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5; return lerp(start, goal, b); });
  const eps = P.collision_clearance;
  const cost = (q) => { let c = 0; for (const d of CM.clearances(G.values(q, base))) { if (d < 0) c += -d + eps / 2; else if (d < eps) c += (d - eps) ** 2 / (2 * eps); } return c; };
  // A = K^T K with K the finite-difference acceleration matrix over interior points: A^-1 via dense inverse (N small)
  const n = N - 2, A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) { A[i][i] = 6; if (i > 0) A[i][i - 1] = A[i - 1][i] = -4; if (i > 1) A[i][i - 2] = A[i - 2][i] = 1; }
  const Ainv = invert(A);
  let afterFree = 0, it = 0, lastFree = null;
  for (; it < P.max_iterations && now() < deadline; it++) {
    const colliding = X.some((q, i) => i > 0 && !motionValid((x) => CM.valid(G.values(x, base)), X[i - 1], q, step));
    if (!colliding) { lastFree = X.map((x) => x.slice()); if (++afterFree > P.max_iterations_after_collision_free) break; }
    const grad = Array.from({ length: n }, () => new Array(dof).fill(0));
    for (let i = 1; i < N - 1; i++) {
      for (let k = 0; k < dof; k++) {
        const h = 1e-3, a = X[i].slice(), b = X[i].slice(); a[k] += h; b[k] -= h;
        const og = (cost(a) - cost(b)) / (2 * h);
        const acc = X[i - 1][k] - 2 * X[i][k] + X[i + 1][k];   // smoothness gradient (acceleration)
        grad[i - 1][k] = P.obstacle_cost_weight * og - P.smoothness_cost_weight * acc * 10;
      }
    }
    for (let k = 0; k < dof; k++) {
      for (let i = 0; i < n; i++) {
        let u = 0; for (let j = 0; j < n; j++) u += Ainv[i][j] * grad[j][k];
        const step = Math.max(-P.joint_update_limit, Math.min(P.joint_update_limit, -P.learning_rate * u * 50));
        X[i + 1][k] = Math.min(G.upper[k], Math.max(G.lower[k], X[i + 1][k] + step));
      }
    }
  }
  if (!lastFree) return { error: ERR.PLANNING_FAILED, message: `CHOMP: the trajectory still collides after ${it} iterations ("Terminated after ${it} iterations, using path from iteration ..."). Use OMPL as a pre-planner, or move the goal.` };
  return { path: lastFree, iterations: it };
}
function invert(M) { const n = M.length, A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; const d = A[c][c]; for (let k = 0; k < 2 * n; k++) A[c][k] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f) for (let k = 0; k < 2 * n; k++) A[r][k] -= f * A[c][k]; } } return A.map((r) => r.slice(n)); }

// ---------------------------------------------------------------- STOMP (stochastic trajectory optimization)
function stomp(G, start, goal, CM, base, params, deadline, rng, step = 0.01) {
  const P = { num_timesteps: 60, num_iterations: 40, num_iterations_after_valid: 0, num_rollouts: 30, max_rollouts: 30, exponentiated_cost_sensitivity: 0.8, control_cost_weight: 0.1, delta_t: 0.1, ...params };
  const N = P.num_timesteps, dof = G.dof, K = Math.max(4, Math.min(P.num_rollouts, 30));
  let X = Array.from({ length: N }, (_, i) => lerp(start, goal, i / (N - 1)));   // linear initialization
  // smoothing: noise drawn with covariance R^-1 (R = finite-difference acceleration); approximated by a Gaussian
  // kernel smoothing of white noise, which gives the same smooth, zero-at-the-ends rollouts
  const smoothNoise = (sd) => { const w = Array.from({ length: N }, () => gauss(rng) * sd); const out = new Array(N).fill(0); const kw = 6; for (let i = 1; i < N - 1; i++) { let s = 0, z = 0; for (let j = -kw; j <= kw; j++) { const k = i + j; if (k < 0 || k >= N) continue; const g = Math.exp(-(j * j) / (2 * 9)); s += g * w[k]; z += g; } out[i] = (s / z) * Math.sin((Math.PI * i) / (N - 1)); } return out; };
  const stateCost = (q) => { let c = 0; for (const d of CM.clearances(G.values(q, base))) if (d < 0.05) c += (0.05 - d) * 10; return c; };
  const trajValid = (T) => T.every((q, i) => i === 0 || motionValid((x) => CM.valid(G.values(x, base)), T[i - 1], q, step));
  let validIters = 0, it = 0;
  for (; it < P.num_iterations && now() < deadline; it++) {
    if (trajValid(X) && validIters++ >= P.num_iterations_after_valid) return { path: X, iterations: it };
    const roll = [];
    for (let r = 0; r < K; r++) {
      const eps = Array.from({ length: dof }, (_, k) => smoothNoise(0.15 * (G.upper[k] - G.lower[k] > 10 ? 1 : (G.upper[k] - G.lower[k]) / 4)));
      const T = X.map((q, i) => G.clamp(q.map((x, k) => x + eps[k][i])));
      const S = T.map(stateCost);
      roll.push({ eps, S });
    }
    // per time step: probability-weighted noise (exponentiated, normalized costs)
    const upd = Array.from({ length: dof }, () => new Array(N).fill(0));
    for (let i = 1; i < N - 1; i++) {
      const c = roll.map((r) => r.S[i] + P.control_cost_weight * r.eps.reduce((s, e) => s + e[i] * e[i], 0));
      const lo = Math.min(...c), hi = Math.max(...c), h = 10 * P.exponentiated_cost_sensitivity;
      const w = c.map((x) => Math.exp((-h * (x - lo)) / (hi - lo || 1))), z = w.reduce((a, b) => a + b, 0);
      for (let k = 0; k < dof; k++) upd[k][i] = roll.reduce((s, r, j) => s + (w[j] / z) * r.eps[k][i], 0);
    }
    X = X.map((q, i) => (i === 0 || i === N - 1 ? q : G.clamp(q.map((x, k) => x + upd[k][i]))));
  }
  if (trajValid(X)) return { path: X, iterations: it };
  return { error: ERR.PLANNING_FAILED, message: `STOMP: no valid trajectory after ${it} iterations ("STOMP failed to find a collision-free solution")` };
}
function gauss(rng) { return Math.sqrt(-2 * Math.log(rng() || 1e-12)) * Math.cos(2 * Math.PI * rng()); }

// ---------------------------------------------------------------- the planning pipeline (move_group's plan request)
// req: { pipeline: "ompl"|"pilz_industrial_motion_planner"|"chomp"|"stomp", planner_id, group (JointGroup), start (joint vector),
//        goal: joint vector, base (values of joints outside the group), CM (CollisionModel), allowed_planning_time,
//        max_velocity_scaling_factor, max_acceleration_scaling_factor, cartesianLimits, params (pipeline yaml) }
export function plan(req) {
  const t0 = now(), G = req.group, CM = req.CM, base = req.base || {}, rng = req.rng || Math.random;
  const velScale = Math.max(1e-3, Math.min(1, req.max_velocity_scaling_factor ?? 0.1)), accScale = Math.max(1e-3, Math.min(1, req.max_acceleration_scaling_factor ?? 0.1));
  const fail = (code, message) => ({ ok: false, error_code: code, error: ERR_NAME[code] || String(code), message, planning_time: now() - t0 });
  const start = req.start.slice(), goal = req.goal.slice();
  // request adapters
  if (!G.inBounds(start, 0.1)) return fail(ERR.START_STATE_INVALID, "Start state is out of the joint limits (CheckStartStateBounds)");
  const sc = CM.contact(G.values(start, base), { full: true });
  if (sc) return fail(ERR.START_STATE_IN_COLLISION, `Start state appears to be in collision with respect to group ${G.name}. ${contactText(sc)}`);
  if (!G.inBounds(goal)) return fail(ERR.INVALID_GOAL_CONSTRAINTS, "The goal state is outside the joint limits");
  const gc = CM.contact(G.values(goal, base), { full: true });
  if (gc) return fail(ERR.GOAL_IN_COLLISION, `Goal state in collision: ${contactText(gc)} (OMPL: "Unable to sample any valid states for goal tree")`);
  const check = (q) => CM.valid(G.values(q, base));
  const range = Math.max(0.05, 0.2 * Math.sqrt(G.joints.reduce((s, _, i) => s + (Math.min(G.upper[i] - G.lower[i], 2 * Math.PI)) ** 2, 0)) / 3);
  const step = Math.max(0.005, 0.005 * Math.sqrt(G.joints.reduce((s, _, i) => s + Math.min(G.upper[i] - G.lower[i], 2 * Math.PI) ** 2, 0)));   // longest_valid_segment_fraction 0.005
  const time = Math.max(0.2, req.allowed_planning_time ?? 5);
  const pstep = step / 2;   // the planners check motions twice as finely as ValidateSolution does afterwards
  let points = null, info = {};
  const pipeline = req.pipeline || "ompl";
  if (pipeline === "ompl") {
    const id = String(req.planner_id || "RRTConnect").replace(/kConfigDefault$/, "") || "RRTConnect";
    const algo = OMPL_ALGO[id] || rrtConnect;
    const budget = OPTIMIZING.has(id) ? Math.min(time, 1.5) : time;
    const deadline = t0 + budget;
    let path = null;
    const attempts = Math.max(1, req.num_planning_attempts || 1);
    for (let a = 0; a < attempts && !path && now() < deadline; a++) path = (motionValid(check, start, goal, pstep) && !OPTIMIZING.has(id)) ? [start, goal] : algo(G, start, goal, check, { range, step: pstep, deadline, rng });
    if (!path) return fail(ERR.TIMED_OUT, `${id}: no solution found after ${budget.toFixed(3)} seconds ("Unable to solve the planning problem")`);
    const simple = simplify(path, check, pstep, rng, now() + 0.3);
    points = timeParameterize(G, simple, { velScale, accScale });
    info = { planner: id, states: path.length, simplified: simple.length };
  } else if (pipeline === "pilz_industrial_motion_planner") {
    const id = (req.planner_id || "PTP").toUpperCase();
    if (id === "PTP") points = pilzPTP(G, start, goal, { velScale, accScale });
    else if (id === "LIN" || id === "CIRC") {
      const A = G.tipFrame(start, base).T, B = G.tipFrame(goal, base).T;
      const cart = { max_trans_vel: 1.0, max_trans_acc: 2.25, max_trans_dec: -5, max_rot_vel: 1.57, ...(req.cartesianLimits || {}), positionOnly: !!req.positionOnly };
      const pa = [A[3], A[7], A[11]], pb = [B[3], B[7], B[11]];
      if (id === "CIRC") {
        const aux = req.circAux;   // { interim: [x,y,z] } or { center: [x,y,z] } (a path constraint named "interim" / "center")
        if (!aux) return fail(ERR.INVALID_GOAL_CONSTRAINTS, "CIRC needs a path constraint: an 'interim' or a 'center' point (moveit_msgs/Constraints position_constraints with link_name = the tool and name 'interim' or 'center'). The RViz MotionPlanning panel cannot set it: use PTP or LIN here, or send the request from a node.");
        const circ = circleThrough(pa, pb, aux); if (circ.error) return fail(ERR.INVALID_GOAL_CONSTRAINTS, circ.error);
        const angTot = rotAngle(A, B);
        const r = pilzCartesian(G, start, (s) => { const T = slerpRot(A, B, s); const p = circ.at(s); T[3] = p[0]; T[7] = p[1]; T[11] = p[2]; return T; }, circ.length, angTot, { base, cart, velScale, accScale });
        if (r.error) return fail(r.error, r.message); points = r.points;
      } else {
        const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]), angTot = rotAngle(A, B);
        const r = pilzCartesian(G, start, (s) => { const T = slerpRot(A, B, s); T[3] = pa[0] + (pb[0] - pa[0]) * s; T[7] = pa[1] + (pb[1] - pa[1]) * s; T[11] = pa[2] + (pb[2] - pa[2]) * s; return T; }, len, angTot, { base, cart, velScale, accScale });
        if (r.error) return fail(r.error, r.message); points = r.points;
      }
    } else return fail(ERR.PLANNING_FAILED, `Pilz: unknown planner id '${id}' (PTP, LIN or CIRC)`);
    info = { planner: id };
  } else if (pipeline === "chomp") {
    const r = chomp(G, start, goal, CM, base, req.params || {}, t0 + Math.min(time, 10), pstep);
    if (r.error) return fail(r.error, r.message);
    points = timeParameterize(G, r.path, { velScale, accScale }); info = { planner: "CHOMP", iterations: r.iterations };
  } else if (pipeline === "stomp") {
    const r = stomp(G, start, goal, CM, base, req.params || {}, t0 + time, rng, pstep);
    if (r.error) return fail(r.error, r.message);
    points = timeParameterize(G, r.path, { velScale, accScale }); info = { planner: "STOMP", iterations: r.iterations };
  } else return fail(ERR.PLANNING_FAILED, `Planning pipeline '${pipeline}' is not loaded (check the planning_pipelines parameter of move_group)`);
  // ValidateSolution (response adapter): collision check every state of the result, finer than the planner's own check
  for (let i = 1; i < points.length; i++) {
    const seg = densify([points[i - 1].positions, points[i].positions], step);
    for (const q of seg) { const c = CM.contact(G.values(q, base)); if (c) return fail(ERR.INVALID_MOTION_PLAN, `Computed path is not valid. Invalid states at index locations: [ ${i} ] out of ${points.length}. Explanations follow in command line. ${contactText(c)}`); }
  }
  return { ok: true, error_code: ERR.SUCCESS, error: "SUCCESS", planning_time: now() - t0, trajectory: { joint_names: G.joints.slice(), points }, duration: points[points.length - 1].t, ...info };
}
function rotAngle(A, B) { return Math.hypot(...rotErr(A, B)); }
function circleThrough(a, b, aux) {
  const sub = (x, y) => x.map((v, i) => v - y[i]), add = (x, y) => x.map((v, i) => v + y[i]), sc = (x, s) => x.map((v) => v * s), dot = (x, y) => x.reduce((s, v, i) => s + v * y[i], 0), cross = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], nrm = (x) => sc(x, 1 / (Math.hypot(...x) || 1));
  let c;
  if (aux.center) { c = aux.center; if (Math.abs(Math.hypot(...sub(a, c)) - Math.hypot(...sub(b, c))) > 1e-3) return { error: "CIRC: start and goal are not the same distance from the center" }; }
  else { const m = aux.interim, ab = sub(b, a), am = sub(m, a), n = cross(ab, am); const nn = dot(n, n); if (nn < 1e-12) return { error: "CIRC: interim point is on the line from start to goal" }; c = add(a, sc(add(sc(cross(n, ab), dot(am, am)), sc(cross(am, n), dot(ab, ab))), 1 / (2 * nn))); }
  const r = Math.hypot(...sub(a, c)), u = nrm(sub(a, c)), n0 = aux.interim ? nrm(cross(sub(a, c), sub(aux.interim, c))) : nrm(cross(sub(a, c), sub(b, c))), v = cross(n0, u);
  const vb = sub(b, c); let ang = Math.atan2(dot(vb, v), dot(vb, u)); if (ang <= 0) ang += 2 * Math.PI;
  return { length: r * ang, at: (s) => add(c, add(sc(u, r * Math.cos(ang * s)), sc(v, r * Math.sin(ang * s)))) };
}

// sample a trajectory at time t (linear interpolation between points) -> joint vector
export function sampleTrajectory(points, t) {
  if (t <= 0) return points[0].positions; const last = points[points.length - 1]; if (t >= last.t) return last.positions;
  let i = 1; while (points[i].t < t) i++; const a = points[i - 1], b = points[i], s = (t - a.t) / (b.t - a.t || 1);
  return a.positions.map((x, k) => x + (b.positions[k] - x) * s);
}
export { inv as invTransform, mul as mulTransform, apply as applyTransform };
