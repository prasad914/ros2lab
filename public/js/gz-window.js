// The Gazebo Sim GUI window for the practice terminal: the 3D scene (orbit with the mouse), the play / pause /
// step buttons, simulation time and real-time factor, and the entity tree, like gz sim's default GUI layout.
import * as THREE from "../vendor/three/three.module.js";
import { OrbitControls } from "../vendor/three/controls/OrbitControls.js";

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const fmt = (t) => { const tot = Math.round(t * 1000), s = Math.floor(tot / 1000), ms = tot % 1000; const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60); return `${String(d).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(ms).padStart(3, "0")}`; };

export function createGzWindow(parent, { sim, title = "Gazebo Sim", onPlay, onStep } = {}) {
  const canvasWrap = h("div", { class: "gz-view", tabindex: "0", "aria-label": "Gazebo 3D scene" });
  const playBtn = h("button", { type: "button", class: "gz-play", title: "Run / pause the simulation", "aria-label": "Play" });
  const stepBtn = h("button", { type: "button", class: "gz-step", title: "Step the simulation", "aria-label": "Step", text: "⏭" });
  const simT = h("span", { class: "gz-time" }), realT = h("span", { class: "gz-time" }), rtf = h("span", { class: "gz-rtf" }), iter = h("span", { class: "gz-it" });
  const tree = h("ul", { class: "gz-tree", "aria-label": "Entity tree" });
  const titleEl = h("span", { text: title });
  const qualityBtn = h("button", { type: "button", class: "gz-q", title: "Graphics quality (shadows and reflections)", onclick: () => { quality = quality === "high" ? "standard" : "high"; try { localStorage.setItem("ros2lab.gz.quality", quality); } catch { /* private mode */ } paintQ(); draw(); } });
  const root = h("figure", { class: "gz-win" },
    h("figcaption", {}, h("i"), h("i"), h("i"), titleEl),
    h("div", { class: "gz-body" },
      h("div", { class: "gz-main" }, canvasWrap,
        h("div", { class: "gz-bar" }, playBtn, stepBtn, h("span", { class: "gz-lbl", text: "RTF" }), rtf, h("span", { class: "gz-lbl", text: "Sim time" }), simT, h("span", { class: "gz-lbl", text: "Real time" }), realT, h("span", { class: "gz-lbl", text: "Iterations" }), iter, qualityBtn)),
      h("aside", { class: "gz-side" }, h("div", { class: "gz-sidetitle", text: "Entity Tree" }), tree)));
  parent.append(root);
  let renderer = null, envTex = null;
  // graphics quality: "high" = soft shadows + image-based lighting (Gazebo's ogre2 look), "standard" = faster, for weak laptops and phones
  let quality = (() => { try { return localStorage.getItem("ros2lab.gz.quality") || (matchMedia("(max-width: 700px)").matches ? "standard" : "high"); } catch { return "high"; } })();
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvasWrap.append(renderer.domElement);
    import("../vendor/three/environments/RoomEnvironment.js").then(({ RoomEnvironment }) => {
      if (!renderer) return;
      const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); draw();
    }).catch(() => {});
  } catch { renderer = null; canvasWrap.append(h("p", { class: "notice", text: "3D graphics (WebGL) are not available in this browser." })); }
  const paintQ = () => { qualityBtn.textContent = quality === "high" ? "Graphics: High" : "Graphics: Standard"; if (renderer) renderer.shadowMap.enabled = quality === "high"; };
  paintQ();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.05, 500); cam.up.set(0, 0, 1); cam.position.set(-3.4, -3.2, 2.6);
  const controls = renderer ? new OrbitControls(cam, renderer.domElement) : null;
  if (controls) { controls.target.set(0, 0, 0.3); controls.update(); controls.addEventListener("change", () => draw()); }
  const resize = () => { if (!renderer) return; const w = Math.max(200, canvasWrap.clientWidth), hh = Math.max(160, Math.round(w * 0.5)); renderer.setSize(w, hh, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "auto"; cam.aspect = w / hh; cam.updateProjectionMatrix(); draw(); };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; if (ro) ro.observe(canvasWrap);
  let paused = true, t0 = performance.now(), lastSim = 0, lastWall = performance.now(), rtfVal = 0, its = 0;
  function draw() {
    if (!renderer) return;
    // the environment light belongs to this window's WebGL context: set it only while this window draws
    const hi = quality === "high", sc = sim.scene;
    sc.environment = hi ? envTex : null; if (sim.hemi) sim.hemi.intensity = hi && envTex ? 0.25 : 0.75;
    renderer.render(sc, cam);
    sc.environment = null; if (sim.hemi) sim.hemi.intensity = 0.75;
  }
  playBtn.addEventListener("click", () => onPlay && onPlay(paused));
  stepBtn.addEventListener("click", () => onStep && onStep());
  function paintTree(gz) {
    const names = [...(gz.world.models || []).map((m) => m.name), ...[...gz.models.keys()]];
    const key = names.join("|"); if (tree.dataset.k === key) return; tree.dataset.k = key;
    tree.replaceChildren(h("li", { class: "gz-w", text: gz.world.name }), ...names.map((n) => h("li", { text: n, class: gz.models.has(n) ? "gz-robot" : "" })));
  }
  return {
    root,
    update(gz) {
      paused = gz.paused;
      playBtn.textContent = paused ? "▶" : "⏸"; playBtn.setAttribute("aria-label", paused ? "Play" : "Pause"); playBtn.classList.toggle("on", !paused);
      stepBtn.disabled = !paused;
      const now = performance.now();
      if (now - lastWall > 500) { rtfVal = paused ? 0 : (gz.time - lastSim) / ((now - lastWall) / 1000); lastSim = gz.time; lastWall = now; }
      if (!paused) its += 1;
      simT.textContent = fmt(gz.time); realT.textContent = fmt((now - t0) / 1000); rtf.textContent = `${(rtfVal * 100).toFixed(2)} %`; iter.textContent = String(Math.round(gz.time * 1000));
      titleEl.textContent = `Gazebo Sim  ${gz.world.name}`;
      paintTree(gz);
      draw();
    },
    draw,
    destroy() { if (ro) ro.disconnect(); if (controls) controls.dispose(); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } root.remove(); },
  };
}
