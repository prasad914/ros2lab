// The home page's Gazebo: a TurtleBot3 Burger in the course's practice world, with the same parts the Robotic Models
// Simulator uses: the URDF and meshes from turtlebot3_description, the Rapier physics (walls stop it, the ball and the
// cardboard box get pushed) and a 360-ray lidar cast into the world. It drives itself around the obstacles until the
// visitor takes the wheel. Loaded only when its section scrolls into view; it pauses when out of sight.
import * as THREE from "../vendor/three/three.module.js";
import { OrbitControls } from "../vendor/three/controls/OrbitControls.js";
import { GzSim } from "./gz-sim.js";
import { parseWorld } from "./gz-sdf.js";
import { worldSdf } from "./rviz-sim.js";
import { parseURDF } from "./urdf-core.js";
import { GzPhysics, loadRapier } from "./gz-physics.js";

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const resolve = (fn) => { const m = String(fn).match(/^package:\/\/([\w-]+)\/(.+)$/); return m ? `/robots/${m[1]}/${m[2]}` : null; };
// TurtleBot3's LDS-01 as turtlebot3_gazebo declares it: 360 samples, 0.12 to 3.5 m, on base_scan
const LIDAR = { link: "base_scan", pose: [0, 0, 0, 0, 0, 0], lidar: { hSamples: 360, vSamples: 1, hMin: 0, hMax: 6.28, vMin: 0, vMax: 0, min: 0.12, max: 3.5, noise: 0.01, resolution: 0.015 } };
const MAX_V = 0.22, MAX_W = 2.84;   // the Burger's limits (turtlebot3_teleop)

export async function mountHomeGazebo(host, { onStatus } = {}) {
  const say = (t) => onStatus && onStatus(t);
  // ---------------- the window
  const view = h("div", { class: "hg3-view", tabindex: "0", "aria-label": "Gazebo 3D view: drag to orbit, scroll to zoom; arrow keys or W A S D drive the robot" });
  const hud = h("pre", { class: "hg3-hud", "aria-live": "off" });
  const auto = h("button", { type: "button", class: "hg3-auto on", "aria-pressed": "true", text: "Auto-drive" });
  const pad = h("div", { class: "hg3-pad", role: "group", "aria-label": "Drive the robot" },
    ...[["↑", 1, 0, "Forward"], ["←", 0, 1, "Turn left"], ["■", 0, 0, "Stop"], ["→", 0, -1, "Turn right"], ["↓", -1, 0, "Back"]].map(([t, v, w, label]) => h("button", { type: "button", "data-v": v, "data-w": w, "aria-label": label, text: t })));
  const title = h("span", { class: "hg3-title", text: "Gazebo Sim · turtlebot3_burger · ros2lab_world" });
  const timeEl = h("span", { class: "hg3-time", text: "0.0 s" });
  const root = h("figure", { class: "hg3" }, h("figcaption", { class: "hg3-bar" }, h("span", { class: "hg3-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")), title, timeEl),
    h("div", { class: "hg3-stage" }, view, hud, h("div", { class: "hg3-ctl" }, auto, pad)));
  const poster = [...host.childNodes];
  host.replaceChildren(root);
  try { return await build(); } catch (e) { host.replaceChildren(...poster); throw e; }
  async function build() {
  say("Loading Gazebo: the world, the TurtleBot3 meshes and the physics engine…");

  // ---------------- the world and the robot (the same files the course's simulator launches)
  const world = parseWorld(worldSdf("ros2lab_world", 0.62));
  const res = await fetch("/robots/turtlebot3_description/urdf/turtlebot3_burger.urdf");
  if (!res.ok) throw new Error(`urdf ${res.status}`);
  const urdf = await res.text();
  const model = parseURDF(urdf);
  const sim = new GzSim({ resolve });
  sim.load(world);
  const m = { name: "turtlebot3_burger", model, gazebo: { plugins: [], sensors: [] }, pose: { x: -0.3, y: -1.75, z: 0, roll: 0, pitch: 0, yaw: 0.35 }, joints: {}, cmd: { vx: 0, wz: 0 }, sdf: { collisions: 5 } };
  for (const j of Object.values(model.joints)) if (j.type !== "fixed") m.joints[j.name] = 0;
  const r = sim.spawn({ name: m.name, model, gazebo: m.gazebo, pose: [m.pose.x, m.pose.y, 0, 0, 0, m.pose.yaw] });
  let phys = null;
  try { phys = new GzPhysics(await loadRapier(), world); } catch { phys = null; }   // without WebAssembly: walls still stop it (below)

  // ---------------- rendering, like the simulator's Gazebo window
  let renderer, level = 0;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = !matchMedia("(max-width: 700px)").matches; renderer.shadowMap.type = THREE.PCFShadowMap;
    view.append(renderer.domElement);
  } catch { if (phys) phys.destroy(); throw new Error("webgl"); }
  import("../vendor/three/environments/RoomEnvironment.js").then(({ RoomEnvironment }) => { if (level >= 3) return; const pm = new THREE.PMREMGenerator(renderer); sim.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); sim.hemi.intensity = 0.3; }).catch(() => {});
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 100); cam.up.set(0, 0, 1);
  const controls = new OrbitControls(cam, renderer.domElement); controls.target.set(m.pose.x, m.pose.y, 0.08); controls.enableDamping = true; controls.maxPolarAngle = 1.45; controls.minDistance = 0.6; controls.maxDistance = 9; controls.update();
  // a chase camera: behind the robot and a little above, kept inside the room so the walls never hide it
  const camSpot = () => { const c = Math.cos(m.pose.yaw), sn = Math.sin(m.pose.yaw), lim = 2.2; return new THREE.Vector3(Math.max(-lim, Math.min(lim, m.pose.x - c * 0.95)), Math.max(-lim, Math.min(lim, m.pose.y - sn * 0.95)), 0.62); };
  const aimSpot = () => new THREE.Vector3(m.pose.x + Math.cos(m.pose.yaw) * 0.45, m.pose.y + Math.sin(m.pose.yaw) * 0.45, 0.06);
  cam.position.copy(camSpot()); controls.target.copy(aimSpot()); controls.update();
  let userCam = false; controls.addEventListener("start", () => { userCam = true; });
  // the lidar rays, drawn like Gazebo's <visualize>true</visualize>
  const rayGeo = new THREE.BufferGeometry(); rayGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(90 * 6), 3));   // every 4th ray is drawn
  const rays = new THREE.LineSegments(rayGeo, new THREE.LineBasicMaterial({ color: 0x4a7dff, transparent: true, opacity: 0.22, depthWrite: false })); rays.frustumCulled = false; sim.scene.add(rays);
  const hitGeo = new THREE.BufferGeometry(); hitGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(360 * 3), 3));
  const hits = new THREE.Points(hitGeo, new THREE.PointsMaterial({ color: 0xff4d4d, size: 0.035 })); hits.frustumCulled = false; sim.scene.add(hits);
  const resize = () => { const w = Math.max(240, view.clientWidth), hh = Math.round(w * (w < 560 ? 0.75 : 0.5625)); renderer.setSize(w, hh, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "auto"; cam.aspect = w / hh; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(view); resize();

  // ---------------- driving: the visitor's teleop, or a wander behaviour that reads the scan
  let autoOn = true, manual = { v: 0, w: 0, until: 0 }, scan = null, t = 0, turnDir = 1, stuck = 0;
  const setAuto = (on) => { autoOn = on; auto.classList.toggle("on", on); auto.setAttribute("aria-pressed", String(on)); };
  auto.addEventListener("click", () => setAuto(!autoOn));
  const drive = (v, w) => { setAuto(false); manual = { v: v * MAX_V, w: w * 1.2, until: t + 0.6 }; };
  pad.addEventListener("pointerdown", (e) => { const b = e.target.closest("button"); if (!b) return; drive(Number(b.dataset.v), Number(b.dataset.w)); b.setPointerCapture && b.setPointerCapture(e.pointerId); const hold = setInterval(() => { manual.until = t + 0.3; }, 150); const up = () => { clearInterval(hold); b.removeEventListener("pointerup", up); b.removeEventListener("pointercancel", up); }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); });
  const KEYS = { ArrowUp: [1, 0], w: [1, 0], ArrowDown: [-1, 0], s: [-1, 0], ArrowLeft: [0, 1], a: [0, 1], ArrowRight: [0, -1], d: [0, -1], " ": [0, 0] };
  view.addEventListener("keydown", (e) => { const k = KEYS[e.key] || KEYS[e.key.toLowerCase()]; if (!k) return; e.preventDefault(); drive(k[0], k[1]); });
  function wander() {
    if (!scan) return { v: MAX_V * 0.8, w: 0 };
    const R = scan.ranges, n = R.length, at = (deg) => R[((Math.round(deg) % n) + n) % n];
    const sector = (a, b) => { let mn = Infinity; for (let d = a; d <= b; d++) mn = Math.min(mn, at(d)); return mn; };
    const front = sector(-25, 25), left = sector(25, 80), right = sector(-80, -25);
    if (front < 0.45) { if (stuck <= 0) turnDir = left > right ? 1 : -1; stuck = 0.6; return { v: 0, w: turnDir * 1.4 }; }
    if (stuck > 0) { stuck -= 1 / 60; return { v: 0.02, w: turnDir * 1.2 }; }
    const bias = Math.max(-1, Math.min(1, (Math.min(left, 2) - Math.min(right, 2)) * 0.9));
    return { v: Math.min(MAX_V, 0.08 + 0.12 * Math.min(1, (front - 0.45) / 1.0)), w: bias * 0.7 + Math.sin(t * 0.37) * 0.25 };
  }
  // a wall check without the physics engine (no WebAssembly)
  const blockedNoPhys = (nx, ny) => world.models.some((w) => w.static !== false && (w.shapes || []).some((s) => { if (s.type === "plane") return false; const p = w.pose || [0, 0, 0]; const hx = s.type === "box" ? s.size[0] / 2 : s.radius, hy = s.type === "box" ? s.size[1] / 2 : s.radius; return Math.abs(nx - p[0]) < hx + 0.1 && Math.abs(ny - p[1]) < hy + 0.1; }));

  // ---------------- the loop: physics at 1 ms steps (the world's <max_step_size>), sensors at 10 Hz
  let visible = true, raf = 0, prev = 0, scanAt = 0, cmd = { v: 0, w: 0 };
  // a slow graphics chip (or none: software rendering) gets a lighter picture instead of a slide show:
  // first no shadows and 1 px per pixel, then fewer pixels, then no reflections
  let slow = 0, frames = 0, spent = 0;
  const lighten = () => {
    level++;
    if (level === 1) { renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; sim.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((mm) => { mm.needsUpdate = true; }); }); }
    if (level === 2) renderer.setPixelRatio(0.6);
    if (level === 3) { sim.scene.environment = null; sim.hemi.intensity = 0.75; }
    resize();
  };
  function frame(now) {
    raf = 0;
    const real = prev ? (now - prev) / 1000 : 0.016;
    if (prev && level < 3 && real < 1) { frames++; spent += real; if (real > 0.045) slow++; if (spent > 1.5 && frames >= 4) { if (slow > frames / 2) lighten(); frames = 0; slow = 0; spent = 0; } }
    const dt = Math.min(0.05, real); prev = now; t += dt;
    cmd = manual.until > t ? manual : autoOn ? wander() : { v: 0, w: 0 };
    const v = cmd.v, w = Math.max(-MAX_W, Math.min(MAX_W, cmd.w));
    const yaw = m.pose.yaw + w * dt, dx = v * Math.cos(yaw) * dt, dy = v * Math.sin(yaw) * dt;
    if (phys) { const mv = phys.moveBase(m, dx, dy, 0, yaw); m.pose.yaw = mv.yaw; m.pose.x += mv.dx; m.pose.y += mv.dy; if (mv.blocked && autoOn) stuck = 0.8; }
    else { m.pose.yaw = yaw; if (!blockedNoPhys(m.pose.x + dx * 8, m.pose.y + dy * 8)) { m.pose.x += dx; m.pose.y += dy; } else if (autoOn) stuck = 0.8; }
    // the wheels turn with the robot (r = 0.033 m, separation 0.160 m)
    m.joints.wheel_left_joint = (m.joints.wheel_left_joint || 0) + ((v - (w * 0.16) / 2) / 0.033) * dt;
    m.joints.wheel_right_joint = (m.joints.wheel_right_joint || 0) + ((v + (w * 0.16) / 2) / 0.033) * dt;
    if (phys) { phys.syncLinks(m); phys.step(dt); const dyn = phys.dynPoses(); for (const [name, P] of Object.entries(dyn)) { const g = sim.modelGroups.get(name); if (g) { g.matrix.compose(new THREE.Vector3(P.x, P.y, P.z), new THREE.Quaternion(...P.q), new THREE.Vector3(1, 1, 1)); g.matrixWorldNeedsUpdate = true; } } }
    Object.assign(r.base, { x: m.pose.x, y: m.pose.y, z: 0, yaw: m.pose.yaw }); r.joints = m.joints; sim.place(r);
    if (t - scanAt > 0.1) {
      scanAt = t; sim.worldG.updateMatrixWorld(true);
      const res = sim.lidar(r, LIDAR);
      if (res) {
        scan = res.scan;
        const M = sim.sensorWorld(r, LIDAR), o = new THREE.Vector3().setFromMatrixPosition(M), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(M));
        const P = rayGeo.attributes.position.array, H = hitGeo.attributes.position.array;
        scan.ranges.forEach((d, i) => {
          const a = scan.angle_min + i * scan.angle_increment, len = Number.isFinite(d) ? d : scan.range_max;
          const e = new THREE.Vector3(Math.cos(a) * len, Math.sin(a) * len, 0).applyQuaternion(q).add(o);
          if (i % 4 === 0) P.set([o.x, o.y, o.z, e.x, e.y, e.z], (i / 4) * 6);
          if (Number.isFinite(d)) H.set([e.x, e.y, e.z], i * 3); else H.set([0, 0, -10], i * 3);
        });
        rayGeo.attributes.position.needsUpdate = true; hitGeo.attributes.position.needsUpdate = true;
      }
      const R = scan ? scan.ranges : [], front = R.length ? Math.min(...[...R.slice(0, 20), ...R.slice(-20)].filter(Number.isFinite)) : NaN;
      hud.textContent = `$ ros2 topic echo /cmd_vel\nlinear.x:  ${v.toFixed(2)}  angular.z: ${w.toFixed(2)}\n$ ros2 topic echo /scan   (front)\nrange: ${Number.isFinite(front) ? front.toFixed(2) + " m" : "inf"}\n${autoOn ? "auto-drive: on" : "you are driving"}`;
      timeEl.textContent = `${t.toFixed(1)} s`;
    }
    // the camera follows the robot gently until the visitor moves it
    if (!userCam) { const k = 1 - Math.pow(0.04, dt); controls.target.lerp(aimSpot(), k); cam.position.lerp(camSpot(), k * 0.8); }
    controls.update();
    renderer.render(sim.scene, cam);
    if (visible) raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf) { prev = 0; raf = requestAnimationFrame(frame); } }, { threshold: 0.01 });
  io.observe(root);
  await Promise.allSettled([...sim.meshCache.values()]);
  say("");
  raf = requestAnimationFrame(frame);
  return {
    destroy() { visible = false; io.disconnect(); ro.disconnect(); controls.dispose(); renderer.dispose(); if (phys) phys.destroy(); root.remove(); },
    state: () => ({ x: m.pose.x, y: m.pose.y, yaw: m.pose.yaw, t, auto: autoOn, scan: !!scan, level, running: !!raf, physics: !!phys }),
  };
  }
}
