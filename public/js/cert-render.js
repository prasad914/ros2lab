// Draws a ROS2Lab certificate from its record. Used by the public certificate page
// and by the instructor's preview before signing.
import { el, svg } from "./dom.js";
import qrcode from "./vendor/qrcode.js";

const toDate = (t) => (t && typeof t.toDate === "function" ? t.toDate() : t ? new Date(t) : null);
const fmt = (t) => { const d = toDate(t); return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "–"; };
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

// ---------- the channel logo (ROS coordinate frame), drawn as vectors ----------
let uid = 0;
export function logoSvg(cls = "") {
  const id = `r2lg${++uid}`;
  const arrow = (fill, transform) => svg("g", { fill, transform }, svg("rect", { x: -20, y: -154, width: 40, height: 154 }), svg("polygon", { points: "-44,-150 44,-150 0,-222" }));
  return svg("svg", { class: cls, viewBox: "0 0 600 600", role: "img", "aria-label": "Robotics & ROS 2 Lab logo" },
    svg("defs", {}, svg("radialGradient", { id, cx: "50%", cy: "45%", r: "70%" }, svg("stop", { offset: "0", "stop-color": "#2E333D" }), svg("stop", { offset: "1", "stop-color": "#1F242A" }))),
    svg("rect", { width: 600, height: 600, rx: 120, fill: `url(#${id})` }),
    svg("g", { transform: "translate(300 370)" },
      arrow("#4A8DF8", ""), arrow("#46B35A", "rotate(-109.8) scale(0.96)"), arrow("#E5494D", "rotate(109.8) scale(0.96)"),
      svg("circle", { r: 29, fill: "#EFF0F4" })));
}

// ---------- guilloche: fine interlaced curves, the "security paper" look ----------
function rosettePaths(cx, cy, r0, amp, lobes, copies, steps = 360) {
  const out = [];
  for (let k = 0; k < copies; k++) {
    const ph = (k / copies) * Math.PI * 2 / lobes;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const r = r0 + amp * Math.sin(lobes * t + ph * lobes) + amp * 0.35 * Math.sin((lobes * 3) * t - ph);
      d += `${i ? "L" : "M"}${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
    }
    out.push(d + "Z");
  }
  return out;
}
// A wavy ribbon that runs round the navy frame (A4 units: 297 x 210 mm).
function frameRibbon(inset, amp, waves, phase) {
  const W = 297, H = 210, x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
  const per = 2 * ((x1 - x0) + (y1 - y0));
  let d = "";
  const N = 900;
  for (let i = 0; i <= N; i++) {
    let s = (i / N) * per, x, y, nx, ny;
    if (s < x1 - x0) { x = x0 + s; y = y0; nx = 0; ny = 1; }
    else if ((s -= x1 - x0) < y1 - y0) { x = x1; y = y0 + s; nx = -1; ny = 0; }
    else if ((s -= y1 - y0) < x1 - x0) { x = x1 - s; y = y1; nx = 0; ny = -1; }
    else { s -= x1 - x0; x = x0; y = y1 - s; nx = 1; ny = 0; }
    const o = amp * Math.sin((i / N) * waves * Math.PI * 2 + phase);
    d += `${i ? "L" : "M"}${(x + nx * o).toFixed(2)} ${(y + ny * o).toFixed(2)}`;
  }
  return d;
}
function backgroundArt() {
  const g = svg("svg", { class: "r2c-art", viewBox: "0 0 297 210", preserveAspectRatio: "none", "aria-hidden": "true" });
  for (let k = 0; k < 4; k++) g.append(svg("path", { d: frameRibbon(3.3, 1.15, 120, k * Math.PI / 2), fill: "none", stroke: "#D4AF37", "stroke-width": 0.16, opacity: 0.75 }));
  return g;
}
// Faint watermark on the ivory sheet: a large rosette and circuit traces in two corners.
function sheetArt() {
  const g = svg("svg", { class: "r2c-wm", viewBox: "0 0 293 206", preserveAspectRatio: "none", "aria-hidden": "true" });
  for (const d of rosettePaths(146, 92, 52, 7, 18, 10)) g.append(svg("path", { d, fill: "none", stroke: "#0B1D3A", "stroke-width": 0.18, opacity: 0.07 }));
  for (const d of rosettePaths(146, 92, 36, 4, 12, 8)) g.append(svg("path", { d, fill: "none", stroke: "#B08D3A", "stroke-width": 0.16, opacity: 0.12 }));
  const trace = (pts) => svg("polyline", { points: pts, fill: "none", stroke: "#0B1D3A", "stroke-width": 0.35, opacity: 0.09 });
  const via = (x, y) => svg("circle", { cx: x, cy: y, r: 0.9, fill: "none", stroke: "#0B1D3A", "stroke-width": 0.35, opacity: 0.12 });
  [["293,62 280,62 274,68 274,84", 274, 84], ["293,72 284,72 284,96", 284, 96], ["293,104 279,104 273,98 266,98", 266, 98],
   ["0,62 13,62 19,68 19,84", 19, 84], ["0,72 9,72 9,96", 9, 96], ["0,104 14,104 20,98 27,98", 27, 98]]
    .forEach(([p, x, y]) => g.append(trace(p), via(x, y)));
  return g;
}
// Gold seal: guilloche rosette, ring text and the logo.
function seal() {
  const id = `r2sl${++uid}`;
  const g = svg("svg", { class: "r2c-seal", viewBox: "0 0 120 120", "aria-hidden": "true" });
  for (const d of rosettePaths(60, 60, 52, 4, 24, 6, 480)) g.append(svg("path", { d, fill: "none", stroke: "#B08D3A", "stroke-width": 0.45 }));
  g.append(svg("circle", { cx: 60, cy: 60, r: 44, fill: "#0B1D3A" }), svg("circle", { cx: 60, cy: 60, r: 42.5, fill: "none", stroke: "#D4AF37", "stroke-width": 0.8 }),
    svg("circle", { cx: 60, cy: 60, r: 27, fill: "none", stroke: "#D4AF37", "stroke-width": 0.6 }),
    svg("defs", {}, svg("path", { id, d: "M60 60 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" })));
  const t = svg("text", { "font-family": "Cinzel, serif", "font-size": 7.4, "font-weight": 700, fill: "#D4AF37", "letter-spacing": 1.6 });
  t.append(svg("textPath", { href: `#${id}`, startOffset: "0" }, "ROS2LAB • VERIFIED • ROS 2 JAZZY •"));
  g.append(t);
  const logo = logoSvg();
  logo.setAttribute("x", "41"); logo.setAttribute("y", "41"); logo.setAttribute("width", "38"); logo.setAttribute("height", "38");
  g.append(logo);
  return g;
}

function qrSvg(text) {
  const q = qrcode(0, "M");
  q.addData(text); q.make();
  const n = q.getModuleCount();
  const s = svg("svg", { viewBox: `0 0 ${n} ${n}`, "shape-rendering": "crispEdges", role: "img", "aria-label": "QR code that opens the verification page" });
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  s.append(svg("path", { d, fill: "#0B1D3A" }));
  return s;
}

const shortTest = (title, i) => { const m = /(\d+)/.exec(title || ""); return m ? `Week ${m[1]}` : `Test ${i + 1}`; };
const splitModule = (m, i) => { const x = /^\s*week\s*(\d+)\s*[:,.\-–]\s*(.+)$/i.exec(m || ""); return x ? [`W${x[1]}`, x[2]] : [`${i + 1}`, m]; };

export function renderCertificate(c, { preview = false, sample = false, verifyUrl = "" } = {}) {
  const name = c.name || "";
  const nameSize = name.length > 34 ? 3.9 : name.length > 24 ? 4.6 : 5.4;
  const tests = c.tests || [];
  const mods = c.modules || [];
  const weeks = mods.filter((m) => /^\s*week\s*\d+/i.test(m)).length;
  const length = weeks && WORDS[weeks] ? `${WORDS[weeks]}-week ` : "";
  const cols = Math.min(tests.length + (tests.length > 1 ? 1 : 0), 7) || 1;

  const strip = el("div", { class: "r2c-strip", style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } },
    tests.map((t, i) => el("div", { class: "r2c-cell" }, el("small", { text: shortTest(t.title, i) }), el("strong", { text: `${Math.round(t.pct)}%` }), el("span", { text: `${t.best} / ${t.max}` }))),
    tests.length > 1 && c.testAverage != null ? el("div", { class: "r2c-cell avg" }, el("small", { text: "Average" }), el("strong", { text: `${c.testAverage}%` }), el("span", { text: "all tests" })) : null);

  return el("div", { class: "r2c", role: "img", "aria-label": `ROS2Lab certificate of completion for ${name}` },
    backgroundArt(),
    el("div", { class: "r2c-sheet" },
      sheetArt(),
      el("div", { class: "r2c-head" },
        el("div", { class: "r2c-brand" }, logoSvg(), el("div", { class: "r2c-word" }, "ROS2Lab", el("small", { text: "Robotics & ROS 2 Lab" }))),
        el("div", { class: "r2c-id" }, "Certificate ID", el("b", { text: c.certId || "Given on signing" }))),
      el("div", { class: "r2c-hero" },
        el("h2", { class: "r2c-title", text: "Certificate of Completion" }),
        el("div", { class: "r2c-rule" }, el("i")),
        el("p", { class: "r2c-lead", text: "This is to certify that" }),
        el("div", { class: "r2c-name", style: { fontSize: `${nameSize}cqw` }, text: name }),
        c.about ? el("p", { class: "r2c-about", text: c.about }) : null,
        el("p", { class: "r2c-stmt" }, `has successfully completed the ${length}online course`,
          el("strong", { text: c.course }),
          "offered by ROS2Lab, having passed all graded assessments and an individually assigned capstone project.")),
      el("div", { class: "r2c-band" },
        el("div", { class: "r2c-card" }, el("h3", { class: "r2c-h", text: "Course modules" }),
          el("ul", { class: "r2c-mods" }, mods.map((m, i) => { const [k, t] = splitModule(m, i); return el("li", {}, el("b", { text: k }), el("span", { text: t })); }))),
        el("div", { class: "r2c-card" }, el("h3", { class: "r2c-h", text: "Assessment record" }), strip,
          el("p", { class: "r2c-note", text: `Best score in each weekly test (pass mark ${c.passTest || 60}%). Capstone pass mark ${c.passProject || 80}%.` })),
        el("div", { class: "r2c-card r2c-cap" }, el("h3", { class: "r2c-h", text: "Capstone project" }),
          el("p", { text: c.projectTitle || "" }),
          el("div", { class: "r2c-badge" }, el("div", {}, el("strong", { text: String(c.projectScore ?? "") }), el("span", { text: "out of 100" }))))),
      el("div", { class: "r2c-foot" },
        el("div", { class: "r2c-dates" },
          el("div", {}, "Registered on ", el("b", { text: fmt(c.registeredAt) })),
          el("div", {}, "Issued on ", el("b", { text: preview ? "the day you sign" : fmt(c.issuedAt) })),
          el("div", {}, "Valid until ", el("b", { text: preview ? "2 years after signing" : fmt(c.validUntil) }))),
        el("div", { class: "r2c-sig" },
          c.signature ? el("img", { src: c.signature, alt: `Signature of ${c.instructor}` }) : el("div", { class: "await", text: "Awaiting signature" }),
          el("div", { class: "line", text: c.instructor }), el("small", { text: c.instructorTitle })),
        seal(),
        el("div", { class: "r2c-verify" },
          el("p", { text: "Computer-generated certificate. Scan the code to check that it is genuine and still valid." }),
          verifyUrl ? el("div", { class: "r2c-qr" }, qrSvg(verifyUrl)) : null))),
    preview || sample ? el("div", { class: "r2c-preview", text: preview ? "Preview" : "Sample" }) : null);
}
