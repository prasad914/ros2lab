// ROS2Lab YouTube Short: robots you can simulate in Gazebo, each with its controller.
// Everything is a pure function of time t, so frames can be captured one by one.
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

const W = 1004, H = 718;
export const INTRO = 4, SEG = 4, OUTRO_LEN = 8;

// ---------------------------------------------------------------- math helpers
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const mj = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (6 * t - 15) + 10); };   // minimum-jerk profile
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function keys(K, t) {   // K = [[time, [values]], ...] with minimum-jerk blending between waypoints
  if (t <= K[0][0]) return K[0][1].slice();
  for (let i = 0; i < K.length - 1; i++) {
    const [t0, a] = K[i], [t1, b] = K[i + 1];
    if (t <= t1) { const s = mj((t - t0) / (t1 - t0)); return a.map((v, k) => lerp(v, b[k], s)); }
  }
  return K[K.length - 1][1].slice();
}

// ---------------------------------------------------------------- URDF loading
const stlL = new STLLoader(), daeL = new ColladaLoader();
const assetCache = new Map();
function loadAsset(url, ext) {
  if (!assetCache.has(url)) assetCache.set(url, (async () => {
    if (ext === "stl") return { geo: await stlL.loadAsync(url) };
    if (ext === "dae") { const r = await daeL.loadAsync(url); r.scene.rotation.set(0, 0, 0); return { scene: r.scene }; }   // undo three's Y-up turn: ROS is Z-up
    if (ext === "obj") {
      const txt = await (await fetch(url)).text(), lib = (txt.match(/^mtllib\s+(.+?)\s*$/m) || [])[1], L = new OBJLoader();
      if (lib) { const m = await new MTLLoader().loadAsync(new URL(lib, new URL(url, location.href)).href); m.preload(); L.setMaterials(m); }
      return { scene: L.parse(txt) };
    }
    throw new Error("mesh type " + ext);
  })());
  return assetCache.get(url);
}
const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
function stdMat(color, o = {}) {
  const c = color.clone(); const hsl = {}; c.getHSL(hsl);
  if (hsl.l < 0.03) c.setHSL(hsl.h, hsl.s, 0.03);   // pure black hides the shape: lift it a little
  return new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.48, metalness: o.metal ?? 0.12, map: o.map || null });
}
const kids = (el, tag) => [...el.children].filter((c) => c.tagName === tag);
const nums = (s, d) => (s ? s.trim().split(/\s+/).map(Number) : d);
function setOrigin(obj, el) {
  const xyz = nums(el && el.getAttribute("xyz"), [0, 0, 0]), rpy = nums(el && el.getAttribute("rpy"), [0, 0, 0]);
  obj.position.set(...xyz); obj.quaternion.setFromEuler(new THREE.Euler(rpy[0], rpy[1], rpy[2], "ZYX"));
}

async function loadRobot(id, cfg) {
  const txt = await (await fetch(cfg.urdf)).text();
  const R = new DOMParser().parseFromString(txt, "application/xml").documentElement;
  const gm = {};
  for (const m of kids(R, "material")) { const c = kids(m, "color")[0]; if (c) gm[m.getAttribute("name")] = nums(c.getAttribute("rgba")); }
  const links = {}, jobs = [];
  for (const l of kids(R, "link")) {
    const g = new THREE.Group(); g.name = l.getAttribute("name"); links[g.name] = g;
    for (const v of kids(l, "visual")) {
      const vg = new THREE.Group(); setOrigin(vg, kids(v, "origin")[0]); g.add(vg);
      let rgba = null; const me = kids(v, "material")[0];
      if (me) { const c = kids(me, "color")[0]; rgba = c ? nums(c.getAttribute("rgba")) : gm[me.getAttribute("name")] || null; }
      if (cfg.recolor) { const rc = cfg.recolor(g.name, rgba); if (rc !== undefined) rgba = rc; }
      const geo = kids(v, "geometry")[0], gel = geo && geo.children[0];
      if (gel) jobs.push(buildGeom(gel, rgba, cfg).then((o) => { if (o) vg.add(o); }));
    }
  }
  const joints = {}, children = new Set();
  for (const j of kids(R, "joint")) {
    const name = j.getAttribute("name"), type = j.getAttribute("type");
    const parent = kids(j, "parent")[0].getAttribute("link"), child = kids(j, "child")[0].getAttribute("link");
    const frame = new THREE.Group(); frame.userData.isJointFrame = true; setOrigin(frame, kids(j, "origin")[0]);
    const mover = new THREE.Group(); frame.add(mover);
    links[parent].add(frame); mover.add(links[child]); children.add(child);
    const ax = kids(j, "axis")[0], lim = kids(j, "limit")[0], mim = kids(j, "mimic")[0];
    joints[name] = {
      name, type, mover, value: 0,
      axis: new THREE.Vector3(...nums(ax && ax.getAttribute("xyz"), [1, 0, 0])).normalize(),
      lo: lim && lim.hasAttribute("lower") ? +lim.getAttribute("lower") : null,
      hi: lim && lim.hasAttribute("upper") ? +lim.getAttribute("upper") : null,
      mimic: mim ? { joint: mim.getAttribute("joint"), mul: +(mim.getAttribute("multiplier") || 1), off: +(mim.getAttribute("offset") || 0) } : null,
    };
  }
  const rootName = Object.keys(links).find((n) => !children.has(n));
  const root = new THREE.Group(); root.add(links[rootName]); root.name = id;
  await Promise.all(jobs);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const movable = Object.values(joints).filter((j) => ["revolute", "continuous", "prismatic"].includes(j.type) && !j.mimic);
  const robot = {
    id, cfg, root, links, joints, movable,
    set(vals) {
      for (const [n, v] of Object.entries(vals)) { const j = joints[n]; if (j) j.value = v; }
      for (const j of Object.values(joints)) {
        if (!["revolute", "continuous", "prismatic"].includes(j.type)) continue;
        const v = j.mimic ? (joints[j.mimic.joint] ? joints[j.mimic.joint].value * j.mimic.mul + j.mimic.off : 0) : j.value;
        if (j.type === "prismatic") { j.mover.position.copy(j.axis).multiplyScalar(v); j.mover.quaternion.identity(); }
        else j.mover.quaternion.setFromAxisAngle(j.axis, v);
      }
    },
    setList(names, vals) { const o = {}; names.forEach((n, i) => (o[n] = vals[i])); this.set(o); },
    linkPos(n) { this.root.updateMatrixWorld(true); return new THREE.Vector3().setFromMatrixPosition(links[n].matrixWorld); },
  };
  robot.set({});
  return robot;
}
async function buildGeom(el, rgba, cfg) {
  const col = rgba ? srgb(rgba[0], rgba[1], rgba[2]) : null;
  const mo = cfg.mat || {};
  if (el.tagName === "box") return new THREE.Mesh(new THREE.BoxGeometry(...nums(el.getAttribute("size"))), stdMat(col || srgb(.7, .7, .7), mo));
  if (el.tagName === "sphere") return new THREE.Mesh(new THREE.SphereGeometry(+el.getAttribute("radius"), 32, 20), stdMat(col || srgb(.7, .7, .7), mo));
  if (el.tagName === "cylinder") { const g = new THREE.CylinderGeometry(+el.getAttribute("radius"), +el.getAttribute("radius"), +el.getAttribute("length"), 32); g.rotateX(Math.PI / 2); return new THREE.Mesh(g, stdMat(col || srgb(.7, .7, .7), mo)); }
  if (el.tagName !== "mesh") return null;
  const fn = el.getAttribute("filename"), url = fn.replace("package://", "robots/"), ext = fn.split(".").pop().toLowerCase();
  const holder = new THREE.Group(); holder.scale.set(...nums(el.getAttribute("scale"), [1, 1, 1]));
  const a = await loadAsset(url, ext);
  if (a.geo) { if (!a.geo.attributes.normal) a.geo.computeVertexNormals(); holder.add(new THREE.Mesh(a.geo, stdMat(col || cfg.base || srgb(.75, .75, .78), mo))); }
  else {
    const sc = a.scene.clone(true);
    sc.traverse((o) => {
      if (!o.isMesh) return;
      const conv = (m0) => stdMat(col && !cfg.ownColors ? col : (m0.color ? m0.color.clone() : srgb(.8, .8, .8)), { ...mo, map: col && !cfg.ownColors ? null : m0.map });
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    });
    holder.add(sc);
  }
  return holder;
}

// ---------------------------------------------------------------- scene (Gazebo-like world)
const view = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
view.insertBefore(renderer.domElement, view.firstChild);

const scene = new THREE.Scene();
{
  const c = document.createElement("canvas"); c.width = 4; c.height = 512;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#93a6bd"); gr.addColorStop(0.55, "#c9d3de"); gr.addColorStop(1, "#e4e9ef");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
}
scene.fog = new THREE.Fog(0xd9e0e8, 9, 34);
const camera = new THREE.PerspectiveCamera(38, W / H, 0.03, 200); camera.up.set(0, 0, 1);

const hemi = new THREE.HemisphereLight(0xffffff, 0x8e949c, 1.0); hemi.position.set(0, 0, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.7); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun, sun.target);
function aimSun(c, size) {
  sun.target.position.copy(c);
  sun.position.copy(c).add(new THREE.Vector3(0.45, -0.6, 1).normalize().multiplyScalar(size * 4 + 2));
  const s = sun.shadow.camera; s.left = s.bottom = -size * 1.6; s.right = s.top = size * 1.6; s.near = 0.01; s.far = size * 10 + 6; s.updateProjectionMatrix();
}

// ground: a Gazebo-like grey plane with a 1 m grid and a faint 10 cm grid, drawn into a mip-mapped texture (no z-fighting)
function gridTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 1024; const g = c.getContext("2d");
  g.fillStyle = "#b4b9c0"; g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = "rgba(70,78,90,0.22)"; for (let i = 1; i < 10; i++) { const x = Math.round(i * 102.4); g.fillRect(x - 1, 0, 2, 1024); g.fillRect(0, x - 1, 1024, 2); }
  g.fillStyle = "rgba(55,62,74,0.75)"; g.fillRect(0, 0, 5, 1024); g.fillRect(0, 0, 1024, 5); g.fillRect(1019, 0, 5, 1024); g.fillRect(0, 1019, 1024, 5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(400, 400);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: .95, metalness: 0 }));
ground.receiveShadow = true; scene.add(ground);

// trails: a faint planned path and the executed part (MoveIt / odometry style)
const lineMats = [];
function mkLine(color, width, opacity) {
  const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest: true, worldUnits: false });
  m.resolution.set(W, H); lineMats.push(m);
  const l = new Line2(new LineGeometry(), m); l.visible = false; l.renderOrder = 2; scene.add(l); return l;
}
const planLine = mkLine(0xffffff, 4, 0.75), execLine = mkLine(0x0fb5a5, 7, 1.0);
function setPath(line, pts) { const g = new LineGeometry(); g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z])); line.geometry.dispose(); line.geometry = g; line.computeLineDistances(); line.visible = true; line.userData.n = pts.length; }
function showPath(line, frac) { const n = line.userData.n || 0; line.geometry.instanceCount = Math.max(0, Math.round((n - 1) * clamp(frac, 0, 1))); }
const tipDot = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x0fb5a5 })); tipDot.visible = false; scene.add(tipDot);

// lidar rays (Gazebo draws gpu_lidar rays when "visualize" is on)
const NRAYS = 180;
const rayGeo = new THREE.BufferGeometry(); rayGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NRAYS * 6), 3));
const rays = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({ color: 0x2f6bff, transparent: true, opacity: 0.28, depthWrite: false })); rays.visible = false; scene.add(rays);
const hitGeo = new THREE.BufferGeometry(); hitGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NRAYS * 3), 3));
const hits = new THREE.Points(hitGeo, new THREE.PointsMaterial({ color: 0xff2b2b, size: 7, sizeAttenuation: false })); hits.visible = false; scene.add(hits);

// world props for the mobile robots (Gazebo's unit shapes)
const props = new THREE.Group(); scene.add(props);
const OBST = [];
function addBox(x, y, sx, sy, sz, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), stdMat(color, { rough: .7 })); m.position.set(x, y, sz / 2); m.castShadow = m.receiveShadow = true; props.add(m);
  OBST.push({ t: "box", x0: x - sx / 2, x1: x + sx / 2, y0: y - sy / 2, y1: y + sy / 2 });
}
function addCyl(x, y, r, h, color) {
  const g = new THREE.CylinderGeometry(r, r, h, 40); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, stdMat(color, { rough: .6 })); m.position.set(x, y, h / 2); m.castShadow = m.receiveShadow = true; props.add(m);
  OBST.push({ t: "cyl", x, y, r });
}
addBox(1.15, 0.55, 0.3, 0.3, 0.3, srgb(.82, .82, .84));
addCyl(0.55, -0.62, 0.12, 0.35, srgb(.93, .55, .2));
addBox(-0.55, 0.7, 0.5, 0.18, 0.25, srgb(.55, .62, .74));
addCyl(-0.75, -0.45, 0.1, 0.3, srgb(.82, .82, .84));
addBox(1.7, -0.5, 0.2, 0.7, 0.3, srgb(.82, .82, .84));
addCyl(1.95, 0.6, 0.14, 0.4, srgb(.93, .55, .2));
props.visible = false;
function rayCast(ox, oy, dx, dy, max) {
  let best = max;
  for (const o of OBST) {
    if (o.t === "cyl") {
      const fx = ox - o.x, fy = oy - o.y, b = fx * dx + fy * dy, c = fx * fx + fy * fy - o.r * o.r, d = b * b - c;
      if (d >= 0) { const s = -b - Math.sqrt(d); if (s > 0 && s < best) best = s; }
    } else {
      let t0 = -Infinity, t1 = Infinity;
      for (const [o0, d0, a, b] of [[ox, dx, o.x0, o.x1], [oy, dy, o.y0, o.y1]]) {
        if (Math.abs(d0) < 1e-9) { if (o0 < a || o0 > b) { t0 = Infinity; } continue; }
        let u0 = (a - o0) / d0, u1 = (b - o0) / d0; if (u0 > u1) [u0, u1] = [u1, u0];
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      }
      if (t0 <= t1 && t0 > 0 && t0 < best) best = t0;
    }
  }
  return best;
}

// ---------------------------------------------------------------- robots
const RAD = Math.PI / 180;
const CFG = {
  ur5e: { urdf: "robots/ur_description/urdf/ur5e.urdf" },
  tb3_waffle: { urdf: "robots/turtlebot3_description/urdf/turtlebot3_waffle.urdf" },
  go2: { urdf: "robots/go2_description/urdf/go2.urdf", ownColors: true },
  fr3: { urdf: "robots/franka_description/urdf/fr3.urdf" },
  g1: { urdf: "robots/g1_description/urdf/g1_29dof.urdf" },
  scout: { urdf: "robots/scout_description/urdf/scout_v2.urdf" },
  kr6: { urdf: "robots/kuka_kr6_support/urdf/kr6r900sixx.urdf" },
  spot: { urdf: "robots/spot_description/urdf/spot.urdf" },
  crazyflie: { urdf: "robots/crazyflie_description/urdf/crazyflie.urdf" },
  so101: { urdf: "robots/so101_description/urdf/so101.urdf" },
  gen3: { urdf: "robots/kortex_description/urdf/gen3.urdf" },
  h1: { urdf: "robots/h1_description/urdf/h1.urdf", recolor: (link, rgba) => (rgba && rgba[0] < 0.2 ? [0.2, 0.21, 0.23, 1] : undefined) },
};
const R = {};

// ---- arms: MoveIt-style pick and place. Waypoints are Cartesian; a small IK turns them into joint
//      waypoints, and the joint_trajectory_controller-like interpolation (minimum jerk) runs between them.
const _p = new THREE.Vector3(), _z = new THREE.Vector3();
function fkTip(r, names, q, tip) { r.setList(names, q); r.root.updateMatrixWorld(true); const m = r.links[tip].matrixWorld; return { p: _p.setFromMatrixPosition(m).clone(), z: _z.setFromMatrixColumn(m, 2).normalize().clone() }; }
function solve6(A, b) {   // Gaussian elimination
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r2 = c + 1; r2 < n; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[piv][c])) piv = r2;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r2 = 0; r2 < n; r2++) { if (r2 === c) continue; const f = M[r2][c] / M[c][c]; for (let k = c; k <= n; k++) M[r2][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}
function ik(r, names, tip, q0, P, D, wo) {
  let q = q0.slice(); const n = q.length, h = 1e-4, lam2 = 0.0004;
  const res = (qq) => { const s = fkTip(r, names, qq, tip); return [s.p.x - P.x, s.p.y - P.y, s.p.z - P.z, wo * (s.z.x - D.x), wo * (s.z.y - D.y), wo * (s.z.z - D.z)]; };
  let f = res(q);
  for (let it = 0; it < 300 && Math.hypot(...f) > 2e-5; it++) {
    const J = [[], [], [], [], [], []];
    for (let j = 0; j < n; j++) { const qq = q.slice(); qq[j] += h; const g = res(qq); for (let i = 0; i < 6; i++) J[i][j] = (g[i] - f[i]) / h; }
    const A = J.map((ri, i) => J.map((rk, k) => ri.reduce((s2, v, m) => s2 + v * rk[m], 0) + (i === k ? lam2 : 0)));
    const y = solve6(A, f);
    let dq = Array.from({ length: n }, (_, j) => -J.reduce((s2, ri, i) => s2 + ri[j] * y[i], 0));
    const nn = Math.hypot(...dq); if (nn > 0.25) dq = dq.map((v) => (v * 0.25) / nn);
    q = q.map((v, j) => { const jt = r.joints[names[j]]; let w = v + dq[j]; if (jt.lo != null && jt.hi != null && jt.hi > jt.lo) w = clamp(w, jt.lo + 0.01, jt.hi - 0.01); return w; });
    f = res(q);
  }
  return { q, err: Math.hypot(f[0], f[1], f[2]), oerr: Math.hypot(f[3], f[4], f[5]) / (wo || 1) };
}
const ARMS = {
  ur5e: { names: ["shoulder_pan_joint", "shoulder_lift_joint", "elbow_joint", "wrist_1_joint", "wrist_2_joint", "wrist_3_joint"], tip: "tool0",
    home: [0, -1.57, 1.57, -1.57, -1.57, 0], pick: [0.42, 0.3], place: [0.42, -0.3], cube: 0.05, hover: 0.2 },
  fr3: { names: ["fr3_joint1", "fr3_joint2", "fr3_joint3", "fr3_joint4", "fr3_joint5", "fr3_joint6", "fr3_joint7"], tip: "fr3_hand_tcp",
    home: [0, -0.785, 0, -2.356, 0, 1.571, 0.785], pick: [0.5, 0.25], place: [0.5, -0.25], cube: 0.045, hover: 0.2, grip: { joint: "fr3_finger_joint1", open: 0.04, close: 0.0225 } },
  kr6: { names: ["joint_a1", "joint_a2", "joint_a3", "joint_a4", "joint_a5", "joint_a6"], tip: "tool0",
    home: [0, -1.57, 1.57, 0, 1.57, 0], pick: [0.6, 0.3], place: [0.6, -0.3], cube: 0.06, hover: 0.25 },
  so101: { names: ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll"], tip: "gripper_frame_link",
    home: [0, -1.0, 1.0, 0.6, 0], pick: [0.2, 0.09], place: [0.2, -0.09], cube: 0.025, hover: 0.05, wo: 0.05, grip: { joint: "gripper", open: 1.0, close: 0.25 } },
  gen3: { names: ["joint_1", "joint_2", "joint_3", "joint_4", "joint_5", "joint_6", "joint_7"], tip: "end_effector_link",
    home: [0, 0.26, 3.14, -2.27, 0, 0.96, 1.57], pick: [0.5, 0.25], place: [0.5, -0.25], cube: 0.05, hover: 0.22 },
};
const TL = { g0: 0.2, ap: 0.85, p: 1.2, grasp: 1.38, up: 1.7, al: 2.55, l: 2.9, rel: 3.05, up2: 3.4, end: 4.0 };
function planArm(id) {
  const a = ARMS[id], r = R[id], D = new THREE.Vector3(0, 0, -1), wo = a.wo ?? 0.35, gap = 0.004;
  const z = a.cube + gap, V = (xy, dz) => new THREE.Vector3(xy[0], xy[1], z + dz);
  const s1 = ik(r, a.names, a.tip, a.home, V(a.pick, a.hover), D, wo);
  const s2 = ik(r, a.names, a.tip, s1.q, V(a.pick, 0), D, wo);
  const s3 = ik(r, a.names, a.tip, s1.q, V(a.place, a.hover), D, wo);
  const s4 = ik(r, a.names, a.tip, s3.q, V(a.place, 0), D, wo);
  a.err = [s1, s2, s3, s4].map((s) => `${(s.err * 1000).toFixed(1)}mm/${s.oerr.toFixed(2)}`).join(" ");
  const G = a.grip, o = G ? G.open : 0, c = G ? G.close : 0;
  a.K = [[0, [...a.home, o]], [TL.g0, [...a.home, o]], [TL.ap, [...s1.q, o]], [TL.p, [...s2.q, o]], [TL.grasp, [...s2.q, c]], [TL.up, [...s1.q, c]],
    [TL.al, [...s3.q, c]], [TL.l, [...s4.q, c]], [TL.rel, [...s4.q, o]], [TL.up2, [...s3.q, o]], [TL.end, [...a.home, o]]];
  // where the cube rests before the grasp and after the release
  const cube = (q) => { const f = fkTip(r, a.names, q, a.tip); return f.p.add(f.z.multiplyScalar(a.cube / 2 + gap)); };
  a.cubeA = cube(s2.q); a.cubeB = cube(s4.q); a.cubeA.z = a.cubeB.z = a.cube / 2;
  r.setList(a.names, a.home);
}
function armPose(id, r, u) {
  const a = ARMS[id], v = keys(a.K, u);
  r.setList(a.names, v.slice(0, a.names.length));
  if (a.grip) r.set({ [a.grip.joint]: v[a.names.length] });
}

function armIdle(id, r, u) {
  const a = ARMS[id], w = (2 * Math.PI) / SEG;
  r.setList(a.names, a.home.map((v, k) => v + (k === 0 ? 0.4 * Math.sin(u * w) : k === 1 ? 0.12 * Math.sin(u * w * 2) : k === a.names.length - 1 ? 0.6 * Math.sin(u * w) : 0)));
  if (a.grip) r.set({ [a.grip.joint]: a.grip.open });
}

// ---- mobile robots: velocity commands integrated into odometry
function drivePath(cmd, dur = SEG, dt = 1 / 600) {
  const P = []; let x = 0, y = 0, th = 0, d = 0;
  for (let t = 0; t <= dur + 1e-9; t += dt) { const [v, w] = cmd(t); P.push({ t, x, y, th, v, w, d }); x += v * Math.cos(th) * dt; y += v * Math.sin(th) * dt; th += w * dt; d += v * dt; }
  return P;
}
const sample = (P, t) => P[clamp(Math.round(t * 600), 0, P.length - 1)];
const TB_PATH = drivePath((t) => [0.26 * smooth(t / 0.4), 1.3 * Math.sin(t * 1.55 + 0.2)]);
const SC_PATH = drivePath((t) => [1.3 * smooth(t / 0.7), 0.55 * Math.sin(t * 1.2 + 0.4)]);

// ---- legged robots: joint trajectories (stand up, then step in place)
const LEGS = ["FL", "FR", "RL", "RR"];
function go2Pose(u, lineup) {
  const o = {};
  const up = lineup ? 1 : smooth((u - 0.15) / 0.9);
  LEGS.forEach((L, i) => {
    let th = lerp(1.25, 0.8, up), ca = lerp(-2.65, -1.5, up);
    if (lineup || u > 1.15) {
      const tt = lineup ? u : u - 1.15, ph = (tt / 0.42 + (i === 0 || i === 3 ? 0 : 0.5)) % 1;
      const sw = ph < 0.5 ? Math.sin(ph * 2 * Math.PI) : 0;
      th += 0.28 * sw; ca -= 0.6 * sw;
    }
    o[`${L}_hip_joint`] = 0; o[`${L}_thigh_joint`] = th; o[`${L}_calf_joint`] = ca;
  });
  return o;
}
const SPOT = ["front_left", "front_right", "rear_left", "rear_right"];
function spotPose(u, lineup) {
  const o = {};
  const up = lineup ? 1 : smooth((u - 0.15) / 1.0);
  const sway = lineup || u < 1.3 ? 0 : Math.sin((u - 1.3) * 5.2) * smooth((u - 1.3) / 0.3) * (u < 2.6 ? 1 : 0);
  SPOT.forEach((L, i) => {
    const left = i % 2 === 0;
    let hy = lerp(1.35, 0.8, up), kn = lerp(-2.6, -1.55, up), hx = 0.16 * sway * (left ? 1 : -1);
    if (lineup || u > 2.6) {
      const tt = lineup ? u : u - 2.6, ph = (tt / 0.45 + (i === 0 || i === 3 ? 0 : 0.5)) % 1;
      const sw = ph < 0.5 ? Math.sin(ph * 2 * Math.PI) : 0;
      hy += 0.3 * sw; kn -= 0.6 * sw;
    }
    o[`${L}_hip_x`] = hx; o[`${L}_hip_y`] = hy; o[`${L}_knee`] = kn;
  });
  return o;
}
function g1Pose(u) {   // squats with the arms raised forward
  const s = 0.5 - 0.5 * Math.cos(clamp(u - 0.15, 0, 10) * 2 * Math.PI / 1.85);
  const hp = -0.62 * s - 0.05, kn = 1.2 * s + 0.1;
  return {
    left_hip_pitch_joint: hp, right_hip_pitch_joint: hp, left_knee_joint: kn, right_knee_joint: kn,
    left_ankle_pitch_joint: -(hp + kn), right_ankle_pitch_joint: -(hp + kn),
    waist_yaw_joint: 0.18 * Math.sin(u * 1.7),
    left_shoulder_pitch_joint: -1.45 * s + 0.1, right_shoulder_pitch_joint: -1.45 * s + 0.1,
    left_shoulder_roll_joint: 0.18, right_shoulder_roll_joint: -0.18, left_elbow_joint: lerp(1.0, 1.45, s), right_elbow_joint: lerp(1.0, 1.45, s),
  };
}
function h1Pose(u) {   // marching on the spot, arms swinging
  const go = smooth((u - 0.2) / 0.4);
  const ph = clamp(u - 0.2, 0, 99) * 2 * Math.PI / 1.0;
  const lL = Math.max(0, Math.sin(ph)) * go, lR = Math.max(0, -Math.sin(ph)) * go;
  const lift = (l) => ({ hp: -0.8 * l - 0.12, kn: 1.4 * l + 0.24 });
  const a = lift(lL), b = lift(lR);
  return {
    left_hip_pitch_joint: a.hp, left_knee_joint: a.kn, left_ankle_joint: -(a.hp + a.kn),
    right_hip_pitch_joint: b.hp, right_knee_joint: b.kn, right_ankle_joint: -(b.hp + b.kn),
    torso_joint: 0.12 * Math.sin(ph) * go,
    left_shoulder_pitch_joint: 0.6 * Math.sin(ph) * go, right_shoulder_pitch_joint: -0.6 * Math.sin(ph) * go,
    left_shoulder_roll_joint: 0.18, right_shoulder_roll_joint: -0.18, left_elbow_joint: 0.9, right_elbow_joint: 0.9,
  };
}
// drone: take off, then a figure-eight
function cfPose(u, lineup) {
  if (lineup) return { x: 0, y: 0, z: 0.45 + 0.03 * Math.sin(u * 3), roll: 0, pitch: 0, yaw: u * 0.6, vx: 0, vy: 0, vz: 0 };
  const to = smooth(u / 0.9), f = smooth((u - 0.6) / 0.6), w = 2 * Math.PI / 3.2, s = clamp(u - 0.6, 0, 99);
  const x = 0.32 * Math.sin(w * s) * f, y = 0.18 * Math.sin(2 * w * s) * f, z = lerp(0.015, 0.42, to) + 0.04 * Math.sin(w * s * 1.5) * f;
  const vx = 0.32 * w * Math.cos(w * s) * f, vy = 0.36 * w * Math.cos(2 * w * s) * f, vz = u < 0.9 ? 0.405 * 6 * (u / 0.9) * (1 - u / 0.9) / 0.9 : 0.06 * w * 1.5 * Math.cos(w * s * 1.5) * f;
  return { x, y, z, roll: -vy * 0.25, pitch: vx * 0.25, yaw: 0, vx, vy, vz };
}

// ---------------------------------------------------------------- the 12 shots
const C = { teal: "#2DD4BF", blue: "#4C8DF6", grape: "#9B7BFF", red: "#F0566B", sun: "#FFC83D", green: "#3DD68C" };
const ICON = {
  traj: () => `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#0f1523" stroke-width="3.5" stroke-linecap="round"><path d="M5 31 C 13 31, 13 9, 21 9 S 29 27, 35 13"/><circle cx="5" cy="31" r="3.5" fill="#0f1523"/><circle cx="21" cy="9" r="3.5" fill="#0f1523"/><circle cx="35" cy="13" r="3.5" fill="#0f1523"/></svg>`,
  diff: () => `<svg width="42" height="42" viewBox="0 0 42 42" fill="none" stroke="#0f1523" stroke-width="3.5" stroke-linecap="round"><rect x="10" y="9" width="22" height="24" rx="5"/><rect x="3" y="13" width="6" height="16" rx="2" fill="#0f1523"/><rect x="33" y="13" width="6" height="16" rx="2" fill="#0f1523"/><path d="M21 27 V15 M16 19 L21 14 L26 19"/></svg>`,
  prop: () => `<svg width="42" height="42" viewBox="0 0 42 42" fill="none" stroke="#0f1523" stroke-width="3.5" stroke-linecap="round"><path d="M12 12 L30 30 M30 12 L12 30"/><circle cx="10" cy="10" r="6"/><circle cx="32" cy="10" r="6"/><circle cx="10" cy="32" r="6"/><circle cx="32" cy="32" r="6"/></svg>`,
};
const twistCmd = (topic, x, z) => `ros2 topic pub ${topic} geometry_msgs/msg/TwistStamped "{twist: {linear: {x: ${x}}, angular: {z: ${z}}}}"`;
export const SHOTS = [
  { id: "ur5e", cat: "Cobot arm", cc: C.teal, name: "Universal Robots UR5e", spec: "<b>6 DOF</b> · 5 kg payload · 850 mm reach",
    ctl: "joint_trajectory_controller", plus: "+ MoveIt 2", icon: "traj", ro: "joints", cmd: "ros2 launch ur5e_bringup sim.launch.py", arm: true,
    cam: { t: [0.3, 0, 0.26], d: 1.75, el: 24, az: [-42, -12] } },
  { id: "tb3_waffle", cat: "Mobile robot", cc: C.blue, name: "TurtleBot3 Waffle", spec: "<b>Diff drive</b> · 0.26 m/s · 360° LiDAR",
    ctl: "diff_drive_controller", plus: "+ LiDAR /scan", icon: "diff", ro: "twist", topic: "/diff_drive_controller/cmd_vel", path: TB_PATH,
    cmd: twistCmd("/diff_drive_controller/cmd_vel", 0.26, 0.8), wheels: { r: 0.033, L: ["wheel_left_joint"], R: ["wheel_right_joint"], sep: 0.287 }, lidar: "base_scan",
    cam: { follow: true, d: 1.9, el: 52, az: [-125, -85], lift: 0.05 } },
  { id: "go2", cat: "Quadruped", cc: C.grape, name: "Unitree Go2", spec: "<b>12 DOF</b> · 15 kg · 4D LiDAR L1",
    ctl: "joint_trajectory_controller", plus: "12 joints", icon: "traj", ro: "joints", cmd: "ros2 launch go2_bringup sim.launch.py",
    pose: (r, u) => r.set(go2Pose(u)), snap: ["FL_foot", "FR_foot", "RL_foot", "RR_foot", "FL_calf", "FR_calf", "RL_calf", "RR_calf", "base"], cam: { t: [0, 0, 0.2], d: 1.4, el: 15, az: [-38, -12] } },
  { id: "fr3", cat: "Research arm", cc: C.teal, name: "Franka Research 3", spec: "<b>7 DOF</b> · 3 kg payload · 855 mm reach",
    ctl: "joint_trajectory_controller", plus: "+ Franka Hand", icon: "traj", ro: "joints", cmd: "ros2 launch fr3_bringup sim.launch.py", arm: true,
    cam: { t: [0.32, 0, 0.3], d: 1.8, el: 24, az: [-42, -12] } },
  { id: "g1", cat: "Humanoid", cc: C.red, name: "Unitree G1", spec: "<b>29 DOF</b> · 1.32 m tall · 35 kg",
    ctl: "joint_trajectory_controller", plus: "29 joints", icon: "traj", ro: "joints", cmd: "ros2 launch g1_bringup sim.launch.py",
    pose: (r, u) => r.set(g1Pose(u)), snap: ["left_ankle_roll_link", "right_ankle_roll_link"], cam: { t: [0, 0, 0.62], d: 2.3, el: 9, az: [-42, -14] } },
  { id: "scout", cat: "Outdoor UGV", cc: C.blue, name: "AgileX Scout V2", spec: "<b>Skid steer</b> · 1.5 m/s · 50 kg payload",
    ctl: "diff_drive_controller", plus: "4 wheels", icon: "diff", ro: "twist", topic: "/diff_drive_controller/cmd_vel", path: SC_PATH,
    cmd: twistCmd("/diff_drive_controller/cmd_vel", 1.3, 0.5), wheels: { r: 0.16459, L: ["front_left_wheel", "rear_left_wheel"], R: ["front_right_wheel", "rear_right_wheel"], sep: 0.583 },
    cam: { follow: true, d: 3.0, el: 24, az: [-135, -95], lift: 0.2 } },
  { id: "kr6", cat: "Industrial arm", cc: C.sun, name: "KUKA KR 6 R900 sixx", spec: "<b>6 DOF</b> · 6 kg payload · 901 mm reach",
    ctl: "joint_trajectory_controller", plus: "+ MoveIt 2", icon: "traj", ro: "joints", cmd: "ros2 launch kr6_bringup sim.launch.py", arm: true,
    cam: { t: [0.38, 0, 0.36], d: 2.1, el: 24, az: [-40, -10] } },
  { id: "spot", cat: "Quadruped", cc: C.grape, name: "Boston Dynamics Spot", spec: "<b>12 DOF</b> · 32.7 kg · 14 kg payload",
    ctl: "joint_trajectory_controller", plus: "12 joints", icon: "traj", ro: "joints", cmd: "ros2 launch spot_bringup sim.launch.py",
    pose: (r, u) => r.set(spotPose(u)), snap: ["front_left_lower_leg", "front_right_lower_leg", "rear_left_lower_leg", "rear_right_lower_leg", "body"], cam: { t: [0, 0, 0.33], d: 2.2, el: 15, az: [-40, -14] } },
  { id: "crazyflie", cat: "Nano drone", cc: C.green, name: "Bitcraze Crazyflie 2.1", spec: "<b>27 g</b> · 7 min flight · quadrotor",
    ctl: "VelocityControl", plus: "gz-sim plugin", icon: "prop", ro: "drone", topic: "/cmd_vel", cmd: 'ros2 topic pub /cmd_vel geometry_msgs/msg/Twist "{linear: {z: 0.5}}"',
    cam: { t: [0, 0, 0.3], d: 0.8, el: 22, az: [-62, -38], chase: 0.6 } },
  { id: "so101", cat: "Desktop arm", cc: C.teal, name: "SO-101 (LeRobot)", spec: "<b>5 DOF + gripper</b> · STS3215 servos",
    ctl: "joint_trajectory_controller", plus: "+ MoveIt 2", icon: "traj", ro: "joints", cmd: "ros2 launch so101_bringup sim.launch.py", arm: true,
    cam: { t: [0.14, 0, 0.08], d: 0.72, el: 26, az: [-42, -12] } },
  { id: "gen3", cat: "Cobot arm", cc: C.teal, name: "Kinova Gen3", spec: "<b>7 DOF</b> · 4 kg payload · 902 mm reach",
    ctl: "joint_trajectory_controller", plus: "+ MoveIt 2", icon: "traj", ro: "joints", cmd: "ros2 launch gen3_bringup sim.launch.py", arm: true,
    cam: { t: [0.32, 0, 0.3], d: 1.8, el: 24, az: [-40, -10] } },
  { id: "h1", cat: "Humanoid", cc: C.red, name: "Unitree H1", spec: "<b>19 DOF</b> · 1.8 m tall · 47 kg",
    ctl: "joint_trajectory_controller", plus: "19 joints", icon: "traj", ro: "joints", cmd: "ros2 launch h1_bringup sim.launch.py",
    pose: (r, u) => r.set(h1Pose(u)), snap: ["left_ankle_link", "right_ankle_link"], cam: { t: [0, 0, 0.88], d: 3.0, el: 8, az: [-40, -12] } },
];
export const N = SHOTS.length, OUTRO = INTRO + N * SEG, TOTAL = OUTRO + OUTRO_LEN;

// ---------------------------------------------------------------- posing
const _box = new THREE.Box3(), _b2 = new THREE.Box3();
function snapToGround(r, names) {
  r.root.updateMatrixWorld(true);
  _box.makeEmpty();
  for (const n of names) {
    const l = r.links[n]; if (!l) continue;
    for (const vg of l.children) { if (vg.userData.isJointFrame) continue; _b2.makeEmpty(); _b2.expandByObject(vg, true); _box.union(_b2); }
  }
  if (!_box.isEmpty()) r.root.position.z -= _box.min.z;
}
function wheelSpin(r, wh, d, th) {   // wheel angles from odometry: left/right travel differ by sep*heading
  const o = {}; for (const n of wh.L) o[n] = (d - th * wh.sep / 2) / wh.r; for (const n of wh.R) o[n] = (d + th * wh.sep / 2) / wh.r; r.set(o);
}
// pose a robot for shot time u; returns extra state for the readouts
function poseRobot(s, r, u, lineup = false) {
  r.root.position.set(0, 0, 0); r.root.rotation.set(0, 0, 0);
  if (s.id === "crazyflie") {
    const p = cfPose(u, lineup); r.root.position.set(p.x, p.y, p.z); r.root.rotation.set(p.roll, p.pitch, p.yaw, "ZYX"); return p;
  }
  if (s.path) {
    const p = sample(s.path, lineup ? 0 : u);
    if (!lineup) { r.root.position.set(p.x, p.y, 0); r.root.rotation.set(0, 0, p.th); }
    r.root.position.z = r.zOff || 0;
    wheelSpin(r, s.wheels, lineup ? u * 0.15 : p.d, lineup ? 0 : p.th); return p;
  }
  if (s.arm) { if (lineup) armIdle(s.id, r, u); else armPose(s.id, r, u); }
  else if (s.id === "go2") r.set(go2Pose(u, lineup));
  else if (s.id === "spot") r.set(spotPose(u, lineup));
  else if (s.pose) s.pose(r, u);
  if (s.snap) snapToGround(r, s.snap);
  return null;
}

// ---------------------------------------------------------------- overlay
const $ = (id) => document.getElementById(id);
const prog = $("prog"); prog.innerHTML = SHOTS.map(() => "<i><b></b></i>").join("");
const progB = [...prog.querySelectorAll("b")];
const fmtT = (t) => { const s = Math.floor(t), ms = Math.round((t - s) * 1000); return `00:00:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`; };
let builtFor = -1;
function buildInfo(i) {
  const s = SHOTS[i];
  $("cnt").innerHTML = `${String(i + 1).padStart(2, "0")}<span>/${N}</span>`;
  $("cat").textContent = s.cat; $("cat").style.background = s.cc;
  $("rname").textContent = s.name; $("spec").innerHTML = s.spec;
  $("cico").innerHTML = ICON[s.icon](); $("cico").style.background = s.cc;
  $("cval").textContent = s.ctl; $("cval").style.color = s.cc;
  $("cplus").textContent = s.plus; $("cplus").style.color = s.cc; $("cplus").style.borderColor = s.cc;
  const ro = $("ro");
  if (s.ro === "joints") {
    const n = R[s.id].movable.length;
    ro.innerHTML = `<div class="ro-h"><span><b>/joint_states</b> · sensor_msgs/JointState</span><span><b>${n}</b> joints · 100 Hz</span></div><div class="bars">${"<i><b></b></i>".repeat(n)}</div>`;
    ro.querySelectorAll(".bars b").forEach((b) => (b.style.background = s.cc));
  } else {
    const ks = s.ro === "drone" ? ["linear.x", "linear.y", "linear.z"] : ["linear.x", "angular.z"];
    ro.innerHTML = `<div class="ro-h"><span><b>${s.topic}</b> · geometry_msgs/${s.ro === "drone" ? "Twist" : "TwistStamped"}</span><span>${s.ro === "drone" ? "10 Hz" : "20 Hz"}</span></div><div class="tw">${ks.map((k) => `<div><div class="k">${k}<b>0.00</b></div><div class="g"><b></b></div></div>`).join("")}</div>`;
    ro.querySelectorAll(".g b").forEach((b) => (b.style.background = s.cc));
  }
  builtFor = i;
}
function enter(el, u, delay, dist = 34) { const k = easeOut((u - delay) / 0.35); el.style.opacity = k; el.style.transform = `translateY(${(1 - k) * dist}px)`; }
function updateReadout(s, u, st) {
  const ro = $("ro");
  if (s.ro === "joints") {
    const bs = ro.querySelectorAll(".bars b");
    R[s.id].movable.forEach((j, k) => {
      const lim = j.type === "prismatic" ? Math.max(Math.abs(j.lo || 0), Math.abs(j.hi || 0)) || 1 : j.lo != null && j.hi != null && j.hi > j.lo ? Math.min(Math.max(Math.abs(j.lo), Math.abs(j.hi)), Math.PI) : Math.PI;
      const v = clamp(j.value / (lim || 1), -1, 1), h = Math.max(Math.abs(v) * 50, 3);
      const b = bs[k]; b.style.height = h + "%"; b.style.top = v >= 0 ? 50 - h + "%" : "50%";
    });
  } else {
    const vals = s.ro === "drone" ? [st.vx, st.vy, st.vz] : [st.v, st.w];
    const max = s.ro === "drone" ? [1, 1, 1] : [s.id === "scout" ? 1.5 : 0.26, s.id === "scout" ? 1.0 : 1.82];
    ro.querySelectorAll(".tw > div").forEach((d, k) => {
      const v = vals[k] || 0, f = clamp(v / max[k], -1, 1);
      d.querySelector(".k b").textContent = (v < 0 ? "−" : "") + Math.abs(v).toFixed(2);
      const g = d.querySelector(".g b"); g.style.left = (f >= 0 ? 50 : 50 + f * 50) + "%"; g.style.width = Math.abs(f) * 50 + "%";
    });
  }
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function updateTerm(cmd, u, start = 0.2, dur = 1.1) {
  const n = Math.round(clamp((u - start) / dur, 0, 1) * cmd.length), shown = cmd.slice(0, n), max = 58;
  const vis = shown.length > max ? "…" + shown.slice(shown.length - max + 1) : shown;
  $("term").innerHTML = `<span class="p">$</span> ${esc(vis)}<span class="c" style="opacity:${n < cmd.length || Math.floor(u * 2.5) % 2 === 0 ? 1 : 0}"></span>`;
}

// ---------------------------------------------------------------- camera helpers
function orbit(target, d, azDeg, elDeg) {
  const az = azDeg * RAD, el = elDeg * RAD;
  camera.position.set(target.x + d * Math.cos(el) * Math.cos(az), target.y + d * Math.cos(el) * Math.sin(az), target.z + d * Math.sin(el));
  camera.lookAt(target);
}

// ---------------------------------------------------------------- pick-and-place cube and target pad
const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: srgb(0.94, 0.34, 0.42), roughness: 0.45, metalness: 0.05 }));
cubeMesh.castShadow = cubeMesh.receiveShadow = true; cubeMesh.visible = false; scene.add(cubeMesh);
const padMesh = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.85, depthWrite: false }));
padMesh.position.z = 0.002; padMesh.visible = false; scene.add(padMesh);
function placeCube(s, r, u) {
  const a = ARMS[s.id]; cubeMesh.visible = padMesh.visible = true; cubeMesh.scale.setScalar(a.cube);
  padMesh.position.set(a.cubeB.x, a.cubeB.y, 0.002); padMesh.scale.setScalar(a.cube * 1.05);
  padMesh.material.opacity = 0.85 * (1 - smooth((u - TL.rel) / 0.3)) + 0.15;
  if (u < TL.grasp) { cubeMesh.position.copy(a.cubeA); cubeMesh.quaternion.identity(); }
  else if (u < TL.rel) {
    r.root.updateMatrixWorld(true); const m = r.links[a.tip].matrixWorld;
    cubeMesh.position.setFromMatrixPosition(m).add(new THREE.Vector3().setFromMatrixColumn(m, 2).normalize().multiplyScalar(a.cube / 2 + 0.004));
    cubeMesh.quaternion.setFromRotationMatrix(m);
  } else { cubeMesh.position.copy(a.cubeB); r.root.updateMatrixWorld(true); cubeMesh.quaternion.setFromRotationMatrix(r.links[a.tip].matrixWorld); const e = new THREE.Euler().setFromQuaternion(cubeMesh.quaternion, "ZYX"); cubeMesh.rotation.set(0, 0, e.z); }
}

// ---------------------------------------------------------------- lineup for the intro and the outro
const ROWS = [{ y: 0.5, ids: ["ur5e", "fr3", "g1", "h1", "kr6", "gen3"] }, { y: -0.85, ids: ["so101", "tb3_waffle", "go2", "crazyflie", "spot", "scout"] }];
const LINEUP = ROWS.flatMap((row) => row.ids);
const lineX = {}, lineY = {};
const FACE = -Math.PI / 2;   // the robots turn to face the camera
function lineupPose(id, u) {
  const s = SHOTS.find((q) => q.id === id), r = R[id];
  poseRobot(s, r, u, true);
  r.root.position.x = r.root.position.y = 0; r.root.rotation.z += FACE;
}
function layoutLineup() {
  let width = 0;
  for (const row of ROWS) {
    let x = 0; const xs = {};
    for (const id of row.ids) {
      const r = R[id]; lineupPose(id, 0); r.root.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(r.root), w = Math.max(b.max.x - b.min.x, 0.2), cx = (b.max.x + b.min.x) / 2;
      xs[id] = x + w / 2 - cx; x += w + 0.38;
    }
    x -= 0.38; width = Math.max(width, x);
    for (const id of row.ids) { lineX[id] = xs[id] - x / 2; lineY[id] = row.y; }
  }
  lineX._len = width;
}

// ---------------------------------------------------------------- frame
let pathFor = -1;
function prepPaths(i) {
  const s = SHOTS[i], r = R[s.id];
  planLine.userData.n = execLine.userData.n = 0;
  const pts = [];
  if (s.arm) { const a = ARMS[s.id]; for (let k = 0; k <= 200; k++) { poseRobot(s, r, (k / 200) * SEG); r.root.updateMatrixWorld(true); const m = r.links[a.tip].matrixWorld; pts.push(new THREE.Vector3().setFromMatrixPosition(m)); } }
  else if (s.path) for (let k = 0; k <= 160; k++) { const p = sample(s.path, (k / 160) * SEG); pts.push(new THREE.Vector3(p.x, p.y, 0.006)); }
  else if (s.id === "crazyflie") for (let k = 0; k <= 200; k++) { const p = cfPose((k / 200) * SEG); pts.push(new THREE.Vector3(p.x, p.y, p.z)); }
  if (pts.length) { setPath(planLine, pts); setPath(execLine, pts); }
  pathFor = i;
}

export function frame(t) {
  const shot = t < INTRO ? -1 : t >= OUTRO ? N : Math.floor((t - INTRO) / SEG);
  const lineup = shot < 0 || shot >= N;
  for (const id in R) R[id].root.visible = false;
  props.visible = rays.visible = hits.visible = false;
  planLine.visible = execLine.visible = tipDot.visible = cubeMesh.visible = padMesh.visible = false;

  // ---------- overlay common
  $("simt").textContent = fmtT(t);
  $("rtf").textContent = (99.7 + 0.25 * Math.sin(t * 2.3) + 0.1 * Math.sin(t * 7.1)).toFixed(1) + " %";
  progB.forEach((b, k) => (b.style.width = (shot > k ? 100 : shot === k ? clamp((t - INTRO - k * SEG) / SEG, 0, 1) * 100 : 0) + "%"));
  $("hook").style.display = shot < 0 ? "" : "none";
  $("info").style.display = !lineup ? "" : "none";
  $("outro").style.display = shot >= N ? "" : "none";

  if (lineup) {
    const u = shot < 0 ? t : t - OUTRO;
    for (const id of LINEUP) { const r = R[id]; lineupPose(id, (u + LINEUP.indexOf(id) * 0.37) % SEG); r.root.position.x += lineX[id]; r.root.position.y += lineY[id]; r.root.visible = true; }
    const L = lineX._len;
    if (shot < 0) {   // intro: start close on the small robots, pull back to the whole group
      const k = smooth(t / INTRO), x0 = lineX.so101;
      const tgt = new THREE.Vector3(lerp(x0 + 0.5, 0.12, k), lerp(-0.85, -0.1, k), lerp(0.14, 0.6, k));
      orbit(tgt, lerp(1.25, 6.1, Math.pow(k, 1.3)), lerp(-58, -90, k), lerp(10, 13, k));
      aimSun(new THREE.Vector3(0, 0, 0), L * 0.65);
      const hk = $("hook").children;
      // the headline is on screen from frame one (it pops in scale), the other lines follow
      hk[0].style.opacity = 1; enter(hk[1], t, 0.15); enter(hk[2], t, 0.4);
      hk[0].style.transform = `scale(${1 + 0.12 * (1 - easeOut(t / 0.4)) + 0.035 * Math.sin(t * 4)})`; hk[0].style.transformOrigin = "left center";
    } else {          // outro: pull back to show every robot
      const k = smooth(u / OUTRO_LEN);
      const tgt = new THREE.Vector3(0.1, -0.1, 0.55);
      orbit(tgt, lerp(6.2, 5.4, k), lerp(-95, -85, k), lerp(13, 16, k));
      aimSun(tgt, L * 0.65);
      const oc = $("outro").children;
      enter(oc[0], u, 0.0); enter(oc[1], u, 0.3); enter(oc[2], u, 0.6, 50); enter(oc[3], u, 0.9);
      const pulse = 1 + 0.035 * Math.max(0, Math.sin((u - 1.0) * 4.2));
      oc[2].style.transform += ` scale(${u > 1.0 ? pulse : 1})`; oc[2].style.transformOrigin = "left center";
    }
    $("world").textContent = "ros2lab_robots.sdf";
    $("flash").style.opacity = shot >= N ? Math.max(0, 0.8 - u / 0.2) : 0;
    renderer.render(scene, camera);
    return;
  }

  // ---------- one robot
  const s = SHOTS[shot], r = R[s.id], u = t - INTRO - shot * SEG;
  if (builtFor !== shot) buildInfo(shot);
  if (pathFor !== shot) prepPaths(shot);
  r.root.visible = true;
  const st = poseRobot(s, r, u);
  $("world").textContent = s.path ? "obstacles.sdf" : "empty.sdf";

  // trails
  if (planLine.userData.n) {
    planLine.visible = execLine.visible = true;
    showPath(execLine, u / SEG); showPath(planLine, 1);
    planLine.material.opacity = 0.6 * (1 - smooth((u - 3.2) / 0.8)) + 0.15;
  }
  if (s.arm) { placeCube(s, r, u); tipDot.visible = true; tipDot.position.copy(r.linkPos(ARMS[s.id].tip)); tipDot.scale.setScalar(s.id === "so101" ? 0.006 : 0.013); }
  if (s.path) props.visible = s.id === "tb3_waffle";

  // camera
  const c = s.cam, k = smooth(u / SEG);
  let tgt;
  if (c.follow) tgt = new THREE.Vector3(st.x, st.y, c.lift || 0.1);
  else if (c.chase) tgt = new THREE.Vector3(c.t[0] + st.x * c.chase, c.t[1] + st.y * c.chase, lerp(c.t[2], st.z, c.chase));
  else tgt = new THREE.Vector3(...c.t);
  const push = 1 + 0.1 * (1 - easeOut(u / 0.6));
  orbit(tgt, c.d * push, lerp(c.az[0], c.az[1], k), c.el);
  aimSun(tgt, c.d * 0.7);

  // lidar
  if (s.lidar) {
    r.root.updateMatrixWorld(true);
    const o = new THREE.Vector3().setFromMatrixPosition(r.links[s.lidar].matrixWorld);
    const P = rayGeo.attributes.position.array, Q = hitGeo.attributes.position.array;
    for (let k2 = 0; k2 < NRAYS; k2++) {
      const a = (k2 / NRAYS) * 2 * Math.PI, dx = Math.cos(a), dy = Math.sin(a), d = rayCast(o.x, o.y, dx, dy, 3.5);
      P.set([o.x, o.y, o.z, o.x + dx * d, o.y + dy * d, o.z], k2 * 6);
      if (d < 3.5) Q.set([o.x + dx * d, o.y + dy * d, o.z], k2 * 3); else Q.set([0, 0, -10], k2 * 3);
    }
    rayGeo.attributes.position.needsUpdate = hitGeo.attributes.position.needsUpdate = true;
    rays.visible = hits.visible = true;
  }

  // overlay
  const ch = [$("info").querySelector(".row1"), $("rname"), $("spec"), $("ctl"), $("ro"), $("term")];
  ch.forEach((el, k2) => enter(el, u, 0.04 + k2 * 0.06));
  updateReadout(s, u, st || {});
  updateTerm(s.cmd, u);
  $("flash").style.opacity = Math.max(0, 0.75 - u / 0.16);

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- boot
async function boot() {
  await document.fonts.ready;
  await Promise.all(Object.entries(CFG).map(async ([id, cfg]) => { R[id] = await loadRobot(id, cfg); scene.add(R[id].root); R[id].root.visible = false; }));
  for (const id of ["tb3_waffle", "scout"]) { const r = R[id]; r.root.updateMatrixWorld(true); r.zOff = -new THREE.Box3().setFromObject(r.root).min.z; }
  for (const id in ARMS) planArm(id);
  layoutLineup();
  window.frame = frame;
  window.META = { TOTAL, INTRO, SEG, N };
  window.R = R; window.THREE = THREE; window.SHOTS = SHOTS; window.ARMS = ARMS; window.__dbg = { camera, renderer, scene, orbit };
  const q = new URLSearchParams(location.search);
  frame(q.has("t") ? +q.get("t") : 0);
  window.READY = true;
}
boot().catch((e) => { window.BOOT_ERROR = String(e && e.stack || e); console.error(e); });
