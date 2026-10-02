// Shared frame for the concept animations: a stage (SVG), a caption that narrates
// each step in plain English, a small log, and buttons. No Firebase here.
import { el, svg, rich, reducedMotion } from "../dom.js";

export { el, svg, rich };

// meta: { id, title, concept }, opts: { height, width }
export function frame(container, meta, { width = 640, height = 300 } = {}) {
  const stage = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "anim-svg", role: "img", "aria-label": meta.title });
  const caption = el("div", { class: "anim-cap", "aria-live": "polite" });
  const controls = el("div", { class: "anim-ctrl" });
  const extra = el("div", { class: "anim-extra" });
  const log = el("pre", { class: "anim-log", hidden: true, "aria-label": "What a terminal would show" });
  const root = el("section", { class: "anim", "data-anim": meta.id },
    el("header", { class: "anim-head" },
      el("span", { class: "anim-tag", text: "Watch it work" }),
      el("h3", { text: meta.title }),
      meta.concept ? el("span", { class: "anim-concept", text: meta.concept }) : null),
    el("div", { class: "anim-stage" }, stage), caption, extra, controls, log);
  container.replaceChildren(root);

  let gen = 0;   // bumps on restart, so old async steps stop quietly
  const alive = () => root.isConnected;
  const api = {
    root, stage, controls, extra, log, width, height,
    get gen() { return gen; },
    restart() { gen++; return gen; },
    say(text, kind = "") { caption.className = `anim-cap ${kind}`; caption.replaceChildren(rich(text)); },
    button(text, onclick, cls = "") {
      const b = el("button", { type: "button", class: `btn btn-small ${cls || "btn-white"}`, text, onclick });
      controls.append(b); return b;
    },
    logLine(text, cls) {
      log.hidden = false;
      log.append(el("span", { class: cls || null, text: text + "\n" }));
      while (log.childNodes.length > 14) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    },
    clearLog() { log.replaceChildren(); log.hidden = true; },
    // wait that rejects (silently ends the sequence) when restarted or removed
    async wait(ms, g = gen) {
      await new Promise((r) => setTimeout(r, reducedMotion() ? Math.min(ms, 120) : ms));
      if (g !== gen || !alive()) throw STOP;
    },
    // move a packet (an SVG <g>) from a to b; resolves when it arrives
    fly(node, a, b, ms = 900, g = gen) {
      return new Promise((resolve, reject) => {
        if (reducedMotion()) ms = 60;
        const t0 = performance.now();
        const step = (t) => {
          if (g !== gen || !alive()) { node.remove(); reject(STOP); return; }
          const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          node.setAttribute("transform", `translate(${a[0] + (b[0] - a[0]) * e} ${a[1] + (b[1] - a[1]) * e})`);
          if (k < 1) requestAnimationFrame(step); else resolve(node);
        };
        requestAnimationFrame(step);
      });
    },
    // run an async story; STOP is swallowed
    async play(fn) { const g = gen; try { await fn(g); } catch (e) { if (e !== STOP) throw e; } },
  };
  return api;
}

export const STOP = Symbol("stop");

// ---- small SVG builders ----
export function box(x, y, w, h, label, { cls = "", sub = "", icon = "" } = {}) {
  const g = svg("g", { class: `an-box ${cls}`, transform: `translate(${x} ${y})` },
    svg("rect", { width: w, height: h, rx: 10 }),
    svg("text", { x: w / 2, y: sub ? h / 2 - 3 : h / 2 + 5, class: "an-t", text: (icon ? icon + " " : "") + label }));
  if (sub) g.append(svg("text", { x: w / 2, y: h / 2 + 15, class: "an-s", text: sub }));
  g.center = [x + w / 2, y + h / 2]; g.x = x; g.y = y; g.w = w; g.h = h;
  g.setSub = (t) => { let s = g.querySelector(".an-s"); if (!s) { s = svg("text", { x: w / 2, y: h / 2 + 15, class: "an-s" }); g.append(s); g.querySelector(".an-t").setAttribute("y", h / 2 - 3); } s.textContent = t; };
  return g;
}
export function wire(a, b, cls = "") { return svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: `an-wire ${cls}` }); }
export function packet(label, cls = "") {
  const w = Math.max(28, label.length * 7.2 + 16);
  return svg("g", { class: `an-pk ${cls}` }, svg("rect", { x: -w / 2, y: -12, width: w, height: 24, rx: 12 }), svg("text", { y: 4.5, text: label }));
}
export function label(x, y, text, cls = "an-lbl") { return svg("text", { x, y, class: cls, text }); }
export const edge = (bx, side) => side === "r" ? [bx.x + bx.w, bx.y + bx.h / 2] : side === "l" ? [bx.x, bx.y + bx.h / 2] : side === "t" ? [bx.x + bx.w / 2, bx.y] : [bx.x + bx.w / 2, bx.y + bx.h];
export function pulse(node) { node.classList.remove("an-pulse"); void node.getBBox?.(); node.classList.add("an-pulse"); setTimeout(() => node.classList.remove("an-pulse"), 700); }
