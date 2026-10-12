// A studio picture of a gallery robot: its URDF meshes with their own materials, physically based light from a soft
// room environment, a key light with a contact shadow on an invisible floor, and a three-quarter view from the front.
// Used offline (tools/render-robots.mjs makes public/img/robots/<id>.webp) and in the browser for robots that have no
// picture yet (the course robots), so that every card looks the same.
import * as THREE from "../vendor/three/three.module.js";
import { GzSim } from "./gz-sim.js";
import { parseURDF } from "./urdf-core.js";

// the joints from base to tip, in order (for the arm's "ready" pose)
function chain(model, base, tip) {
  const out = [];
  for (let l = tip; l && l !== base;) {
    const j = Object.values(model.joints).find((x) => x.child === l);
    if (!j) break;
    if (j.type !== "fixed" && !j.mimic) out.unshift(j.name);
    l = j.parent;
  }
  return out;
}

// a pose that shows the robot well: arms in their "ready" pose, grippers open; everything else at zero
export function showPose(model, g) {
  const v = {};
  const M = g.moveit;
  const within = (j, x) => !j.limit || j.type === "continuous" || (x >= j.limit.lower && x <= j.limit.upper);
  if (M && M.base && M.tip) {
    // the arm's working pose (home): the "ready" pose of many makers is straight up, which says little in a picture
    const js = chain(model, M.base, M.tip), pose = M.home || M.ready || [];
    js.forEach((n, i) => { if (pose[i] !== undefined && within(model.joints[n], pose[i])) v[n] = pose[i]; });
    for (const n of M.gripper || []) { const j = model.joints[n]; if (j && j.limit) v[n] = j.limit.upper * 0.7 + j.limit.lower * 0.3; }
  }
  // four- and six-legged robots stand with bent knees
  if (g.category === "legged" && !/humanoid|g1|h1/.test(g.id)) {
    for (const j of Object.values(model.joints)) {
      if (j.type === "fixed" || j.mimic) continue;
      const n = j.name.toLowerCase(), want = /thigh|hip_y|upper_leg|femur/.test(n) ? 0.75 : /calf|knee|lower_leg|tibia/.test(n) ? 1.45 : null;
      if (want === null) continue;
      v[j.name] = within(j, want) ? want : within(j, -want) ? -want : v[j.name];
    }
  }
  for (const [n, x] of Object.entries(g.thumbPose || {})) v[n] = x;
  return v;
}

const resolveMesh = (fn) => { const m = String(fn).match(/^package:\/\/([\w-]+)\/(.+)$/); return m ? `/robots/${m[1]}/${m[2]}` : null; };

// the room light is a PMREM render target, which belongs to the WebGL context that made it: make it for each renderer
const envs = new WeakMap();
let roomP = null;
export async function renderRobot(g, urdfText, { width = 640, height = 480, renderer = null, type = "image/webp", quality = 0.9 } = {}) {
  const model = parseURDF(urdfText);
  const own = !renderer;
  const R = renderer || new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(width, height, false);
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.setClearColor(0x000000, 0);
  const sim = new GzSim({ resolve: resolveMesh });
  sim.scene.background = null;
  const r = sim.spawn({ name: g.id, model, gazebo: { plugins: [], sensors: [] }, pose: [0, 0, 0, 0, 0, 0] });
  Object.assign(r.joints, showPose(model, g));
  sim.place(r);
  await Promise.allSettled([...sim.meshCache.values()]);
  await new Promise((res) => setTimeout(res, 30));   // meshes are added to the scene when their promise resolves
  sim.place(r);
  // a light exported inside a Collada mesh (the Dobot Magician's has a Blender point light) is not part of the robot
  { const drop = []; r.g.traverse((o) => { if (o.isLight || o.isCamera) drop.push(o); }); for (const o of drop) o.removeFromParent(); }
  // light: the soft room (image-based light) + a warm key light from the front left + a cool rim from behind
  if (!roomP) roomP = import("../vendor/three/environments/RoomEnvironment.js").then((m) => m.RoomEnvironment).catch(() => null);
  const Room = await roomP;
  let env = envs.get(R) || null;
  if (!env && Room) { const pm = new THREE.PMREMGenerator(R); const room = new Room(); env = pm.fromScene(room, 0.04).texture; pm.dispose(); room.traverse((o) => o.geometry && o.geometry.dispose()); if (!own) envs.set(R, env); }
  sim.scene.environment = env; sim.scene.environmentIntensity = 0.55; sim.hemi.intensity = env ? 0.35 : 0.9;
  sim.sun.visible = false;
  const box = new THREE.Box3().setFromObject(r.g);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.2, -0.2, 0), new THREE.Vector3(0.2, 0.2, 0.4));
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 0.05);
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
  key.position.set(c.x + span * 1.6, c.y - span * 1.2, c.z + span * 2.4); key.target.position.copy(c);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -span * 1.5, right: span * 1.5, top: span * 1.5, bottom: -span * 1.5, near: 0.01, far: span * 8 });
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.1); rim.position.set(c.x - span * 2, c.y + span * 1.5, c.z + span); rim.target.position.copy(c);
  sim.scene.add(key, key.target, rim, rim.target);
  // the contact shadow: an invisible floor under the robot that only shows shadows
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 8, span * 8), new THREE.ShadowMaterial({ opacity: 0.28 }));
  floor.position.set(c.x, c.y, box.min.z - 0.0005); floor.receiveShadow = true; sim.scene.add(floor);
  // a three-quarter view from the front right, a little above
  const fov = 30, cam = new THREE.PerspectiveCamera(fov, width / height, span / 100, span * 40); cam.up.set(0, 0, 1);
  const az = (g.thumbView && g.thumbView.az) ?? -0.62, el = (g.thumbView && g.thumbView.el) ?? 0.36;
  // move in until the robot's box fills the picture (with a margin), then centre it
  // points of the robot's surface (a sample of the mesh vertices): the silhouette, not the box around it
  const corners = [];
  r.g.updateMatrixWorld(true);
  r.g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step) corners.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
  });
  if (!corners.length) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el));
  const place = (d, at) => { cam.position.copy(at).addScaledVector(dir, d); cam.lookAt(at); cam.updateMatrixWorld(); };
  let at = c.clone(), d = span * 4;
  for (let it = 0; it < 4; it++) {
    place(d, at);
    let lo = new THREE.Vector2(Infinity, Infinity), hi = new THREE.Vector2(-Infinity, -Infinity);
    for (const p of corners) { const q = p.clone().project(cam); lo.min(new THREE.Vector2(q.x, q.y)); hi.max(new THREE.Vector2(q.x, q.y)); }
    const fill = Math.max((hi.x - lo.x) / 2 / 0.8, (hi.y - lo.y) / 2 / 0.84);   // the robot fills about 80 % of the width, 84 % of the height
    // shift the aim so the box is centred on screen, then scale the distance
    const mid = new THREE.Vector3((hi.x + lo.x) / 2, (hi.y + lo.y) / 2, 0.5).unproject(cam), toMid = mid.sub(cam.position).normalize();
    const aimDist = cam.position.distanceTo(at);
    at = cam.position.clone().addScaledVector(toMid, aimDist);
    d *= fill;
  }
  place(d, at);
  R.render(sim.scene, cam);
  const url = R.domElement.toDataURL(type, quality);
  sim.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  if (own) { if (env) env.dispose(); R.dispose(); R.forceContextLoss && R.forceContextLoss(); }
  return url;
}

// a picture for a gallery robot in the browser: the shipped one, or one made here once (kept in this browser)
export async function robotPicture(g) {
  const key = `ros2lab.thumb.v1.${g.id}`;
  try { const c = localStorage.getItem(key); if (c) return c; } catch { /* storage off */ }
  const { galleryUrdf } = await import("./rviz-pkg.js");
  const { urdf } = await galleryUrdf(g, async () => []);
  if (!urdf) throw new Error("no URDF");
  const url = await renderRobot(g, urdf, { width: 480, height: 360, quality: 0.85 });
  try { localStorage.setItem(key, url); } catch { /* full or off: draw it again next time */ }
  return url;
}
