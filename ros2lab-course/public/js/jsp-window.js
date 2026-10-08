// joint_state_publisher_gui (ROS 2 Jazzy) in the browser: a copy of joint_state_publisher_gui.py.
// Window "Joint State Publisher": Randomize and Center on top, then a scroll area whose FlowLayout holds one
// widget per free joint: bold Helvetica 9 name + a 45 px value box, and a 200 px QSlider (0..10000) below.
// Behaviour follows the Python code: the box shows "0.00" until its slider first moves, then 3 decimals;
// Center moves each slider to the joint's zero; typed values are clamped to the joint limits.
import { movableJoints } from "./urdf-core.js";
import { jspDefault, loadRvizCss } from "./rviz.js";

const RANGE = 10000, SLIDER_WIDTH = 200, HANDLE = 15, INIT_NUM_SLIDERS = 7;
const DEFAULT_WINDOW_MARGIN = 11, DEFAULT_CHILD_MARGIN = 9, DEFAULT_BTN_HEIGHT = 25, DEFAULT_SLIDER_HEIGHT = 64;
const MIN_WIDTH = SLIDER_WIDTH + DEFAULT_CHILD_MARGIN * 4 + DEFAULT_WINDOW_MARGIN * 2;          // 258
const MIN_HEIGHT = DEFAULT_BTN_HEIGHT * 2 + DEFAULT_WINDOW_MARGIN * 2 + DEFAULT_CHILD_MARGIN * 2; // 90

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};

export function createJspWindow(host, { model = null, values = {}, onChange = () => {}, title = "Joint State Publisher" } = {}) {
  loadRvizCss();
  let M = model, popup = null;
  const ext = { ...values };            // positions set from outside (other publishers, lessons)
  let joints = [];                      // [{ name, min, max, zero, position, slider, text, widget }]
  const main = h("div", { class: "jsp-main" });
  const titleEl = h("span", { class: "rv-wtitle", text: title });
  const wb = (cls, label, fn) => h("button", { type: "button", class: `rv-wb ${cls}`, title: label, "aria-label": label, onclick: fn });
  const bar = h("div", { class: "rv-titlebar" }, h("span", { class: "rv-tbspace" }), titleEl,
    h("span", { class: "rv-wbtns" },
      wb("min", "Minimise", () => win.classList.toggle("min")),
      wb("max", "Open in a separate window", () => popOut()),
      wb("close", "Close", () => win.classList.toggle("min"))));
  const win = h("div", { class: "jsp-win", role: "dialog", "aria-label": title }, bar, main);
  host.append(win);

  // drag the window by its title bar (inside the page)
  let drag = null;
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const r = win.getBoundingClientRect(), hr = host.getBoundingClientRect();
    if (!win.classList.contains("floating")) { win.classList.add("floating"); win.style.left = `${r.left - hr.left}px`; win.style.top = `${r.top - hr.top}px`; }
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const hr = host.getBoundingClientRect();
    win.style.left = `${Math.max(0, Math.min(hr.width - 120, e.clientX - hr.left - drag.dx))}px`;
    win.style.top = `${Math.max(0, e.clientY - hr.top - drag.dy)}px`;
  });
  bar.addEventListener("pointerup", () => { drag = null; });

  const valueToSlider = (v, j) => Math.trunc(((v - j.min) * RANGE) / (j.max - j.min));   // int() in Python truncates
  const sliderToValue = (s, j) => j.min + (j.max - j.min) * (s / RANGE);
  const emit = () => onChange(Object.fromEntries(joints.map((j) => [j.name, j.position])));

  // QSlider (Fusion): groove, blue fill up to the handle centre, 15 px handle
  function makeSlider(j) {
    const groove = h("span", { class: "groove" }), fill = h("span", { class: "fill" }), handle = h("span", { class: "handle" });
    const el = h("span", { class: "jsp-slider", role: "slider", tabindex: "0", "aria-label": j.name, "aria-valuemin": "0", "aria-valuemax": String(RANGE) }, groove, fill, handle);
    let value = RANGE / 2;
    const paint = () => { const x = Math.round((value / RANGE) * (SLIDER_WIDTH - HANDLE)); handle.style.left = `${x}px`; fill.style.width = `${x + Math.ceil(HANDLE / 2)}px`; el.setAttribute("aria-valuenow", String(value)); el.setAttribute("aria-valuetext", j.text.value); };
    const api = {
      el, get value() { return value; },
      setValue(v, silent = false) { v = Math.max(0, Math.min(RANGE, Math.round(v))); if (v === value) return; value = v; paint(); if (!silent) onSliderValueChanged(j); },
      paint,
    };
    let grab = null, repeat = null;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault(); el.focus({ preventScroll: true });
      const r = el.getBoundingClientRect(), hx = r.left + Math.round((value / RANGE) * (SLIDER_WIDTH - HANDLE));
      if (e.clientX >= hx && e.clientX <= hx + HANDLE) { grab = e.clientX - hx; el.classList.add("drag"); el.setPointerCapture(e.pointerId); return; }
      // a click on the groove moves one page step (10) towards the mouse, repeating while held (Qt behaviour)
      const dir = e.clientX < hx ? -1 : 1;
      const stepOnce = () => api.setValue(value + dir * 10);
      stepOnce(); repeat = setTimeout(function again() { stepOnce(); repeat = setTimeout(again, 50); }, 500);
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => { if (grab !== null) { const r = el.getBoundingClientRect(); api.setValue(((e.clientX - grab - r.left) / (SLIDER_WIDTH - HANDLE)) * RANGE); } });
    const end = () => { grab = null; el.classList.remove("drag"); clearTimeout(repeat); repeat = null; };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("keydown", (e) => {
      // Qt's own steps (1 and 10 of 10000) are too fine to be usable from a keyboard: arrows move 0.5% of the
      // range (Shift: the Qt single step), PageUp/PageDown 5%
      const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key];
      if (step) { api.setValue(value + (e.shiftKey ? step : step * 50)); e.preventDefault(); } else if (e.key === "Home") { api.setValue(0); e.preventDefault(); } else if (e.key === "End") { api.setValue(RANGE); e.preventDefault(); }
    });
    el.addEventListener("wheel", (e) => { e.preventDefault(); api.setValue(value + (e.deltaY < 0 ? 3 : -3)); }, { passive: false });   // singleStep x 3 lines per notch
    return api;
  }

  // joint_state_publisher.py: continuous joints get -pi..pi; zero is 0, or the middle when 0 is outside the limits
  function freeJoints(m) {
    return movableJoints(m).map((jt) => {
      const min = jt.limit && jt.type !== "continuous" ? jt.limit.lower : -Math.PI, max = jt.limit && jt.type !== "continuous" ? jt.limit.upper : Math.PI;
      return { name: jt.name, min, max, zero: jspDefault(jt), position: jspDefault(jt) };
    }).filter((j) => j.min !== j.max);
  }

  function onSliderValueChanged(j) {   // onSliderValueChangedOne
    j.position = sliderToValue(j.slider.value, j);
    j.text.value = j.position.toFixed(3);
    j.slider.paint(); emit();
  }
  function onDisplayValueChanged(j) {  // onDisplayValueChangedOne (editable boxes)
    const v = Number(j.text.value.trim());
    if (j.text.value.trim() === "" || !Number.isFinite(v)) { j.text.value = j.position.toFixed(3); return; }
    const c = Math.max(Math.min(v, j.max), j.min);
    j.position = c; j.text.value = c.toFixed(3);
    j.slider.setValue(valueToSlider(c, j), true); j.slider.paint(); emit();
  }
  function centerEvent() { for (const j of joints) j.slider.setValue(valueToSlider(j.zero, j)); }
  function randomizeEvent() { for (const j of joints) j.slider.setValue(valueToSlider(j.min + Math.random() * (j.max - j.min), j)); }

  function initializeSliders() {
    const randBtn = h("button", { type: "button", class: "q-btn", text: "Randomize", onclick: randomizeEvent });
    const ctrBtn = h("button", { type: "button", class: "q-btn", text: "Center", onclick: centerEvent });
    const flow = h("div", { class: "jsp-flow" });
    const scroll = h("div", { class: "jsp-scroll" }, flow);
    main.replaceChildren(randBtn, ctrBtn, scroll);
    if (!M) { joints = []; flow.append(h("p", { class: "jsp-wait", text: "Waiting for robot_description..." })); setMin(0); return; }
    joints = freeJoints(M);
    for (const j of joints) {
      j.text = h("input", { class: "q-line", value: "0.00", spellcheck: "false", "aria-label": `${j.name} position` });
      j.slider = makeSlider(j);
      j.text.addEventListener("keydown", (e) => { if (e.key === "Enter") { onDisplayValueChanged(j); j.text.select(); } e.stopPropagation(); });
      j.text.addEventListener("blur", () => onDisplayValueChanged(j));
      j.widget = h("div", { class: "jsp-joint" }, h("div", { class: "jsp-head" }, h("span", { class: "jsp-name", text: j.name }), j.text), j.slider.el);
      flow.append(j.widget);
      j.slider.paint();
    }
    centerEvent();
    // positions that came from outside (an earlier session or a lesson) win over Center
    for (const j of joints) if (ext[j.name] !== undefined && Number.isFinite(Number(ext[j.name]))) { j.slider.setValue(valueToSlider(Number(ext[j.name]), j)); }
    for (const j of joints) { j.position = sliderToValue(j.slider.value, j); j.text.value = j.position.toFixed(3); j.slider.paint(); }   // the boxes show what is published (also when Center left the slider where it was)
    setMin(joints.length);
    emit();
  }
  function setMin(n) {   // setMinimumSize(MIN_WIDTH, n x 64 + (n + 1) x 9 + MIN_HEIGHT), n at most 7
    const k = Math.min(n, INIT_NUM_SLIDERS);
    win.style.setProperty("--jsp-h", `${k * DEFAULT_SLIDER_HEIGHT + (k + 1) * DEFAULT_CHILD_MARGIN + MIN_HEIGHT}px`);
    win.style.width = `${MIN_WIDTH}px`;
  }

  // a real separate browser window (same site): the widgets move there and come back when it closes
  function popOut() {
    if (popup && !popup.closed) { popup.focus(); return; }
    const hgt = main.getBoundingClientRect().height || 391;
    popup = window.open("", `jsp_${Math.random().toString(36).slice(2, 8)}`, `width=${MIN_WIDTH},height=${Math.round(hgt)},resizable=yes`);
    if (!popup) { titleEl.textContent = `${title} (allow pop-ups to open it in its own window)`; return; }
    const d = popup.document;
    d.open(); d.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body class="jsp-popup"></body></html>`); d.close();
    loadRvizCss(d);
    const holder = d.createElement("div"); holder.className = "jsp-win jsp-in-popup"; d.body.append(holder);
    holder.append(d.adoptNode(main));
    win.classList.add("popped"); titleEl.textContent = `${title} (in its own window)`;
    const back = () => { if (!win.isConnected) return; win.append(document.adoptNode(main)); win.classList.remove("popped"); titleEl.textContent = title; popup = null; };
    popup.addEventListener("pagehide", back);
    const poll = setInterval(() => { if (!popup || popup.closed) { clearInterval(poll); if (popup !== null) back(); } }, 700);
  }

  initializeSliders();
  return {
    setModel(m) { if (m !== M) { M = m; initializeSliders(); } },
    // updateSliders: positions from /joint_states move the sliders (the boxes then show 3 decimals)
    setValues(v) {
      Object.assign(ext, v);
      for (const j of joints) {
        if (v[j.name] === undefined || !Number.isFinite(Number(v[j.name]))) continue;
        const s = valueToSlider(Number(v[j.name]), j);
        if (s === j.slider.value) continue;
        j.slider.setValue(s, true); j.position = sliderToValue(j.slider.value, j); j.text.value = j.position.toFixed(3); j.slider.paint();
      }
    },
    values: () => Object.fromEntries(joints.map((j) => [j.name, j.position])),
    destroy() { if (popup && !popup.closed) popup.close(); win.remove(); },
    root: win,
  };
}
