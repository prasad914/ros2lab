// A small stand-in for Gazebo Harmonic (gz sim) in the browser: the world from an SDF file, spawned robots with
// their URDF meshes, the DiffDrive and JointStatePublisher systems, and the sensors a URDF declares.
// Sensors work like gz-sensors: gpu_lidar casts rays (LaserScan + PointCloudPacked), camera renders the world from
// the sensor's pose (Image + CameraInfo), depth / rgbd cameras add depth and points, imu reports orientation,
// angular velocity and linear acceleration (gravity included). Rendering sensors only run when the world loads
// gz-sim-sensors-system, the IMU only with gz-sim-imu-system, as in real Gazebo.
import * as THREE from "../vendor/three/three.module.js";
import { STLLoader } from "../vendor/three/loaders/STLLoader.js";
import { urdfEdges, framePoses, qRPY } from "./urdf-core.js";
import { worldHas, sensorTopics, sensorFrame } from "./gz-sdf.js";

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const Q = (q) => new THREE.Quaternion(q[0], q[1], q[2], q[3]);
const poseMat = (t, q) => new THREE.Matrix4().compose(V(t), Q(q), new THREE.Vector3(1, 1, 1));
const rpyMat = (p) => poseMat([p[0], p[1], p[2]], qRPY(p[3] || 0, p[4] || 0, p[5] || 0));
// three.js camera axes (-Z forward, +Y up) expressed in a ROS sensor frame (+X forward, +Z up)
const CAM_FIX = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));

export class GzSim {
  constructor({ resolve } = {}) {
    this.resolve = resolve || ((u) => u);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0.8, 0.8, 0.8);   // gz's default grey sky in the GUI and in camera images
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-3, -2, 8); this.scene.add(sun);
    this.worldG = new THREE.Group(); this.scene.add(this.worldG);
    this.worldMeshes = [];
    this.robots = new Map();
    this.time = 0; this.running = false; this.world = null;
    this.ray = new THREE.Raycaster();
    this.meshCache = new Map();
  }
  // ---------------- world ----------------
  load(world) {
    this.world = world; this.worldG.clear(); this.worldMeshes = [];
    for (const m of world.models) {
      const M = rpyMat(m.pose || [0, 0, 0, 0, 0, 0]);
      for (const s of m.shapes || []) {
        let geo;
        if (s.type === "box") geo = new THREE.BoxGeometry(...s.size);
        else if (s.type === "cylinder") { geo = new THREE.CylinderGeometry(s.radius, s.radius, s.length, 32); geo.rotateX(Math.PI / 2); }
        else if (s.type === "sphere") geo = new THREE.SphereGeometry(s.radius, 32, 16);
        else if (s.type === "plane") geo = new THREE.PlaneGeometry(s.size[0], s.size[1]);
        else continue;
        const c = s.color || [0.7, 0.7, 0.7, 1];
        const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(c[0], c[1], c[2]), side: s.type === "plane" ? THREE.DoubleSide : THREE.FrontSide }));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(M).multiply(rpyMat(s.linkPose || [0, 0, 0, 0, 0, 0])).multiply(rpyMat(s.pose || [0, 0, 0, 0, 0, 0]));
        mesh.userData.plane = s.type === "plane";
        this.worldG.add(mesh); this.worldMeshes.push(mesh);
      }
    }
    if (world.models.some((m) => m.shapes && m.shapes.some((s) => s.type === "plane"))) {
      const grid = new THREE.GridHelper(20, 20, 0x999999, 0xaaaaaa); grid.rotation.x = Math.PI / 2; grid.position.z = 0.001; this.worldG.add(grid);
    }
    this.worldG.updateMatrixWorld(true);
  }
  hasSystem(sys) { return !!this.world && worldHas(this.world, sys); }
  // ---------------- robots ----------------
  spawn({ name, model, gazebo, pose = [0, 0, 0, 0, 0, 0] }) {
    const g = new THREE.Group(); this.scene.add(g);
    const r = { name, model, gazebo, g, links: new Map(), joints: {}, base: { x: pose[0], y: pose[1], z: pose[2], yaw: pose[5] || 0, roll: pose[3] || 0, pitch: pose[4] || 0 },
      start: { x: pose[0], y: pose[1], yaw: pose[5] || 0 }, cmd: { vx: 0, wz: 0 }, cmdAt: 0, msgs: {} };
    for (const j of Object.values(model.joints)) if (!["fixed", "floating", "planar"].includes(j.type) && !j.mimic) r.joints[j.name] = 0;
    for (const l of Object.values(model.links)) {
      const lg = new THREE.Group(); lg.matrixAutoUpdate = false;
      const rgba = (l.visuals.find((v) => v.rgba) || {}).rgba;
      for (const v of l.visuals) { const o = this.shape(v.geom, v.rgba || rgba); if (!o) continue; o.applyMatrix4(rpyMat([...v.origin.xyz, ...v.origin.rpy])); lg.add(o); }
      g.add(lg); r.links.set(l.name, lg);
    }
    this.robots.set(name, r);
    this.place(r);
    return r;
  }
  remove(name) { const r = this.robots.get(name); if (r) { this.scene.remove(r.g); this.robots.delete(name); } }
  shape(geom, rgba) {
    const mat = new THREE.MeshLambertMaterial({ color: rgba ? new THREE.Color(rgba[0], rgba[1], rgba[2]) : new THREE.Color(0.7, 0.7, 0.7) });
    if (geom.type === "box") return new THREE.Mesh(new THREE.BoxGeometry(...geom.size), mat);
    if (geom.type === "sphere") return new THREE.Mesh(new THREE.SphereGeometry(geom.radius, 24, 16), mat);
    if (geom.type === "cylinder") { const c = new THREE.CylinderGeometry(geom.radius, geom.radius, geom.length, 24); c.rotateX(Math.PI / 2); return new THREE.Mesh(c, mat); }
    if (geom.type !== "mesh") return null;
    const holder = new THREE.Group(); holder.scale.set(...geom.scale);
    const url = this.resolve(geom.filename), ext = String(geom.filename).split(".").pop().toLowerCase();
    if (!url) return holder;
    this.loadMesh(url, ext).then((res) => {
      if (res.geo) holder.add(new THREE.Mesh(res.geo, mat));
      else { const sc = res.scene.clone(true); const wrap = new THREE.Group(); if (ext === "dae") wrap.rotation.x = Math.PI / 2;
        sc.traverse((o) => { if (o.isMesh && (rgba || !res.own)) o.material = mat; }); wrap.add(sc); holder.add(wrap); }
    }).catch(() => {});
    return holder;
  }
  loadMesh(url, ext) {
    const key = ext + "|" + url;
    if (!this.meshCache.has(key)) this.meshCache.set(key, (async () => {
      if (ext === "stl") return { geo: await new STLLoader().loadAsync(url) };
      if (ext === "dae") { const { ColladaLoader } = await import("../vendor/three/loaders/ColladaLoader.js"); const c = await new ColladaLoader().loadAsync(url); return { scene: c.scene, own: true }; }
      if (ext === "obj") {
        const { OBJLoader } = await import("../vendor/three/loaders/OBJLoader.js"); const txt = await (await fetch(url)).text(); const lib = (txt.match(/^mtllib\s+(.+?)\s*$/m) || [])[1]; const L = new OBJLoader(); let own = false;
        if (lib) { try { const { MTLLoader } = await import("../vendor/three/loaders/MTLLoader.js"); const m = await new MTLLoader().loadAsync(new URL(lib, new URL(url, location.href)).href); m.preload(); L.setMaterials(m); own = true; } catch { /* no materials */ } }
        return { scene: L.parse(txt), own };
      }
      throw new Error("unsupported mesh");
    })());
    return this.meshCache.get(key);
  }
  basePose(r) { return poseMat([r.base.x, r.base.y, r.base.z], qRPY(r.base.roll, r.base.pitch, r.base.yaw)); }
  linkPoses(r) { return framePoses(urdfEdges(r.model, r.joints, true), r.model.root).poses; }
  place(r) {
    const B = this.basePose(r), P = this.linkPoses(r);
    for (const [name, lg] of r.links) { const T = P[name]; if (!T) continue; lg.matrix.copy(B).multiply(poseMat(T.t, T.q)); }
    r.g.updateMatrixWorld(true);
  }
  linkWorld(r, link) { const T = this.linkPoses(r)[link]; return T ? this.basePose(r).multiply(poseMat(T.t, T.q)) : null; }
  // ---------------- follow the simulation state kept by the practice ROS graph (ros-gz.js) ----------------
  sync(gz) {
    if (!gz) { if (this.world) { this.worldG.clear(); this.worldMeshes = []; this.world = null; } for (const n of [...this.robots.keys()]) this.remove(n); return; }
    if (this.world !== gz.world) this.load(gz.world);
    for (const n of [...this.robots.keys()]) if (!gz.models.has(n) || this.robots.get(n).model !== gz.models.get(n).model) this.remove(n);
    for (const m of gz.models.values()) {
      let r = this.robots.get(m.name);
      if (!r) r = this.spawn({ name: m.name, model: m.model, gazebo: m.gazebo, pose: [m.pose.x, m.pose.y, m.pose.z, m.pose.roll, m.pose.pitch, m.pose.yaw] });
      Object.assign(r.base, { x: m.pose.x, y: m.pose.y, z: m.pose.z, roll: m.pose.roll, pitch: m.pose.pitch, yaw: m.pose.yaw });
      r.joints = m.joints; r.cmd = m.cmd;
      this.place(r);
    }
    this.time = gz.time;
  }
  // ---------------- sensors ----------------
  sensorWorld(r, sen) { const L = this.linkWorld(r, sen.link); return L ? L.multiply(rpyMat(sen.pose || [0, 0, 0, 0, 0, 0])) : null; }
  canRun(sen) { return sen.type === "imu" ? this.hasSystem("imu-system") : ["gpu_lidar", "gpu_ray", "camera", "depth_camera", "depth", "rgbd_camera", "rgbd"].includes(sen.type) ? this.hasSystem("sensors-system") : false; }
  castRays(M, dirs, min, max) {   // distance along each sensor-frame direction to the world (Infinity when nothing within range)
    const o = new THREE.Vector3().setFromMatrixPosition(M), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(M));
    this.ray.near = min; this.ray.far = max;
    return dirs.map((d) => { this.ray.set(o, V(d).applyQuaternion(q).normalize()); const hit = this.ray.intersectObjects(this.worldMeshes, false)[0]; return hit ? hit.distance : Infinity; });
  }
  lidar(r, sen) {
    const L = sen.lidar, M = this.sensorWorld(r, sen); if (!M) return null;
    const hs = Math.max(1, Math.min(L.hSamples, 720)), vs = Math.max(1, Math.min(L.vSamples, 32));
    const hStep = hs > 1 ? (L.hMax - L.hMin) / (hs - 1) : 0, vStep = vs > 1 ? (L.vMax - L.vMin) / (vs - 1) : 0;
    const dirs = [], angles = [];
    for (let v = 0; v < vs; v++) for (let h = 0; h < hs; h++) { const a = L.hMin + h * hStep, e = L.vMin + v * vStep; dirs.push([Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)]); angles.push([a, e]); }
    const d = this.castRays(M, dirs, L.min, L.max);
    if (L.noise > 0) for (let i = 0; i < d.length; i++) if (Number.isFinite(d[i])) {   // <noise type="gaussian"> and the range <resolution>, as gz-sensors applies them
      const g = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
      let x = d[i] + g * L.noise; if (L.resolution > 0) x = Math.round(x / L.resolution) * L.resolution;
      d[i] = Math.min(L.max, Math.max(L.min, x));
    }
    const mid = vs > 1 ? Math.floor((vs - 1) / 2) : 0;   // the LaserScan is the middle ring
    const ranges = d.slice(mid * hs, mid * hs + hs);
    const points = []; d.forEach((x, i) => { if (Number.isFinite(x)) points.push(dirs[i].map((c) => c * x)); });
    return { scan: { angle_min: L.hMin, angle_max: L.hMax, angle_increment: hStep, range_min: L.min, range_max: L.max, ranges }, points };
  }
  ensureRenderer() {
    if (!this.renderer) {
      const canvas = document.createElement("canvas");
      try { this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); } catch { this.renderer = null; }
    }
    return this.renderer;
  }
  camera(r, sen, wantColorFor) {
    const C = sen.camera, M = this.sensorWorld(r, sen); if (!M) return null;
    const w = Math.max(16, Math.min(C.width, 320)), h = Math.max(12, Math.round((w * C.height) / C.width));
    const out = { width: C.width, height: C.height, hfov: C.hfov };
    const renderer = this.ensureRenderer();
    if (renderer) {
      const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(C.hfov / 2) * (h / w))), w / h, C.near, C.far);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(); M.decompose(p, q, new THREE.Vector3());
      cam.position.copy(p); cam.quaternion.copy(q).multiply(CAM_FIX); cam.updateMatrixWorld(true);
      const rt = sen._rt && sen._rt.width === w && sen._rt.height === h ? sen._rt : (sen._rt = new THREE.WebGLRenderTarget(w, h));
      renderer.setRenderTarget(rt); renderer.render(this.scene, cam); renderer.setRenderTarget(null);
      const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
      const canvas = sen._canvas || (sen._canvas = document.createElement("canvas")); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d"), img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // WebGL rows are bottom-up
      ctx.putImageData(img, 0, 0); out.canvas = canvas; out.pixels = img.data; out.w = w; out.h = h;
    }
    if (wantColorFor) {   // depth: a ray per pixel of a coarse grid; colour from the image (rgbd) for the point cloud
      const gw = 64, gh = Math.max(8, Math.round((gw * C.height) / C.width)), tanH = Math.tan(C.hfov / 2), tanV = tanH * (C.height / C.width);
      const dirs = []; for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) dirs.push([1, -((x + 0.5) / gw * 2 - 1) * tanH, -((y + 0.5) / gh * 2 - 1) * tanV]);
      const d = this.castRays(M, dirs, C.near, C.far);
      const points = [], colors = [], depth = [];
      d.forEach((len, i) => {
        const dir = new THREE.Vector3(...dirs[i]).normalize(), range = len * dir.x;   // depth = distance along the optical axis
        depth.push(Number.isFinite(len) ? range : Infinity);
        if (!Number.isFinite(len)) return;
        points.push([dir.x * len, dir.y * len, dir.z * len]);
        if (out.pixels) { const px = Math.min(out.w - 1, Math.floor(((i % gw) + 0.5) / gw * out.w)), py = Math.min(out.h - 1, Math.floor((Math.floor(i / gw) + 0.5) / gh * out.h)), k = (py * out.w + px) * 4; colors.push([out.pixels[k] / 255, out.pixels[k + 1] / 255, out.pixels[k + 2] / 255]); }
      });
      Object.assign(out, { points, colors: colors.length ? colors : null, depth, depthW: gw, depthH: gh });
    }
    return out;
  }
  imu(r, sen) {
    const M = this.sensorWorld(r, sen); if (!M) return null;
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(M));
    const g = new THREE.Vector3(0, 0, 9.80665).applyQuaternion(q.clone().invert());   // an accelerometer at rest measures +g upwards
    const w = new THREE.Vector3(0, 0, r.cmd.wz).applyQuaternion(q.clone().invert());
    const n = () => (Math.random() - 0.5) * 0.004;
    return { orientation: [q.x, q.y, q.z, q.w], angular_velocity: [w.x + n(), w.y + n(), w.z + n()], linear_acceleration: [g.x + n(), g.y + n(), g.z + n()] };
  }
  // gz topics this simulation publishes right now: [{ topic, type, robot, sensor, kind }]
  gzTopics() {
    const out = [{ topic: "/clock", type: "gz.msgs.Clock" }, { topic: "/stats", type: "gz.msgs.WorldStatistics" }];
    if (!this.world) return out;
    for (const r of this.robots.values()) {
      for (const sen of r.gazebo.sensors) {
        if (!this.canRun(sen)) continue;
        for (const [topic, type, kind] of sensorTopics(sen, this.world.name, r.name)) out.push({ topic, type, robot: r.name, sensor: sen, kind, frame: kind === "image" || kind === "info" || kind === "depth" ? (sen.optical || sensorFrame(sen, r.name)) : sensorFrame(sen, r.name) });
      }
      for (const p of r.gazebo.plugins) {
        if (p.kind === "diff_drive") {
          const t = (x, d) => (x ? (x.startsWith("/") ? x : "/" + x) : d);
          out.push({ topic: t(p.odomTopic, `/model/${r.name}/odometry`), type: "gz.msgs.Odometry", robot: r.name, kind: "odom", plugin: p },
            { topic: t(p.tfTopic, `/model/${r.name}/tf`), type: "gz.msgs.Pose_V", robot: r.name, kind: "tf", plugin: p },
            { topic: t(p.topic, `/model/${r.name}/cmd_vel`), type: "gz.msgs.Twist", robot: r.name, kind: "cmd_vel", plugin: p, sub: true });
        }
        if (p.kind === "joint_states") out.push({ topic: p.topic ? (p.topic.startsWith("/") ? p.topic : "/" + p.topic) : `/world/${this.world.name}/model/${r.name}/joint_state`, type: "gz.msgs.Model", robot: r.name, kind: "joints" });
      }
    }
    return out;
  }
}
