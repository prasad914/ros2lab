// Hand-drawn pictures for the games: a small scene for each game's tile on the Playground, a one-line glyph,
// and the rubber stamp a player earns. Static SVG strings (no user text goes into them).
const Z = "var(--axis-z, #2F6BD8)", Y = "var(--axis-y, #2E9B57)", X = "var(--axis-x, #D9473B)", INK = "var(--ink, #17212F)";

// each game's ink colour: the goal rule, the stamp and the tile accent use it
export const INKS = { paths: "#2F6BD8", radio: "#C8372C", pizza: "#B5650F", tsa: "#6C4FE0", source: "#2E8A52", turtle: "#4556FF" };

const SCENES = {
  // a transit map: three coloured lines leave the root station; a robot waits at one stop, a flag at another
  paths: `<path d="M20 24H66q10 0 10 10v28q0 10 10 10h56" stroke="${Z}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M20 24v34q0 10 10 10h18" stroke="${Y}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M76 24h58" stroke="${X}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="0 0"/>
    <g fill="#fff" stroke="${INK}" stroke-width="2"><circle cx="20" cy="24" r="6"/><circle cx="76" cy="24" r="5"/><circle cx="134" cy="24" r="5"/><circle cx="76" cy="46" r="5"/><circle cx="108" cy="72" r="5"/><circle cx="142" cy="72" r="5"/><circle cx="48" cy="68" r="5"/></g>
    <circle cx="76" cy="46" r="7" fill="var(--sun, #FFC83D)" stroke="${INK}" stroke-width="2"/>
    <path d="M142 72V50" stroke="${INK}" stroke-width="2"/><path d="M142 50h12l-3 5 3 5h-12z" fill="${INK}"/>`,
  // a radio receiver: cream dial window, ticks, a red needle on its station, two knobs and a grille
  radio: `<rect x="10" y="12" width="140" height="74" rx="12" fill="var(--night, #1A2230)"/>
    <rect x="20" y="22" width="120" height="30" rx="5" fill="#FFF4D6" stroke="#0E141E" stroke-width="2"/>
    <g stroke="${INK}" stroke-width="1.6">${[30, 42, 54, 66, 78, 90, 102, 114, 126].map((x, i) => `<line x1="${x}" y1="${i % 2 ? 44 : 40}" x2="${x}" y2="48"/>`).join("")}</g>
    <line x1="90" y1="25" x2="90" y2="50" stroke="${X}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="36" cy="70" r="9" fill="#2E3A4F" stroke="#5E6B80" stroke-width="2"/><line x1="36" y1="70" x2="36" y2="63" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <circle cx="124" cy="70" r="9" fill="#2E3A4F" stroke="#5E6B80" stroke-width="2"/><line x1="124" y1="70" x2="130" y2="66" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <g fill="#55627A">${[60, 68, 76, 84, 92, 100].map((x) => `<circle cx="${x}" cy="66" r="1.6"/><circle cx="${x}" cy="74" r="1.6"/>`).join("")}</g>`,
  // an order ticket clipped to the kitchen rail, with a five-stop progress line
  pizza: `<line x1="8" y1="12" x2="152" y2="12" stroke="#9AA6B6" stroke-width="4" stroke-linecap="round"/>
    <path d="M46 10h68v72l-5.6 6-5.6-6-5.6 6-5.6-6-5.6 6-5.6-6-5.6 6-5.6-6-5.6 6-5.6-6-5.6 6-5.6-6z" fill="#FFFDF6" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="72" y="6" width="16" height="10" rx="2" fill="#C9D1DB" stroke="${INK}" stroke-width="1.4"/>
    <g fill="#B9C3D0"><rect x="54" y="24" width="38" height="3.5" rx="1.5"/><rect x="54" y="32" width="50" height="3.5" rx="1.5"/><rect x="54" y="40" width="30" height="3.5" rx="1.5"/></g>
    <line x1="54" y1="58" x2="106" y2="58" stroke="#D6DDE6" stroke-width="2"/><line x1="54" y1="58" x2="82" y2="58" stroke="#B5650F" stroke-width="2.4"/>
    <g stroke="${INK}" stroke-width="1.4">${[54, 67, 80, 93, 106].map((x, i) => `<circle cx="${x}" cy="58" r="3.2" fill="${i < 3 ? "#B5650F" : "#fff"}"/>`).join("")}</g>`,
  // a situation card above three trays: topic, service, action
  tsa: `<g transform="rotate(-5 80 26)"><rect x="50" y="8" width="60" height="36" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
    <g fill="#C9D1DB"><rect x="57" y="16" width="40" height="3" rx="1.5"/><rect x="57" y="23" width="46" height="3" rx="1.5"/><rect x="57" y="30" width="28" height="3" rx="1.5"/></g></g>
    ${[[14, Z], [62, Y], [110, "#C7781A"]].map(([x, c]) => `<path d="M${x} 62v18q0 4 4 4h28q4 0 4-4V62" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><line x1="${x - 3}" y1="62" x2="${x + 39}" y2="62" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`).join("")}
    <rect x="68" y="70" width="24" height="10" rx="1.5" fill="#fff" stroke="${Y}" stroke-width="1.4"/><rect x="70" y="66" width="24" height="10" rx="1.5" fill="#fff" stroke="${Y}" stroke-width="1.4"/>`,
  // a terminal beside the ~/.bashrc scroll, its newest line highlighted
  source: `<rect x="8" y="14" width="92" height="70" rx="7" fill="var(--night, #1A2230)"/>
    <g fill="#3A475C"><circle cx="17" cy="22" r="2.2"/><circle cx="25" cy="22" r="2.2"/><circle cx="33" cy="22" r="2.2"/></g>
    <rect x="16" y="34" width="10" height="4" rx="1" fill="#7EE2B8"/><rect x="30" y="34" width="44" height="4" rx="1" fill="#C9D4E8"/>
    <rect x="16" y="45" width="60" height="4" rx="1" fill="#FF8FA3"/><rect x="16" y="56" width="10" height="4" rx="1" fill="#7EE2B8"/><rect x="30" y="56" width="52" height="4" rx="1" fill="#C9D4E8"/>
    <rect x="16" y="67" width="7" height="8" fill="#FFD66B"/>
    <path d="M112 16h36v66h-36z" fill="#FFFDF6" stroke="${INK}" stroke-width="1.6"/>
    <ellipse cx="130" cy="16" rx="21" ry="5" fill="#F3EBD6" stroke="${INK}" stroke-width="1.6"/><ellipse cx="130" cy="82" rx="21" ry="5" fill="#F3EBD6" stroke="${INK}" stroke-width="1.6"/>
    <g fill="#C9D1DB"><rect x="118" y="28" width="24" height="3" rx="1.5"/><rect x="118" y="36" width="18" height="3" rx="1.5"/><rect x="118" y="44" width="22" height="3" rx="1.5"/></g>
    <rect x="116" y="56" width="28" height="9" rx="2" fill="#FFE7A3"/><rect x="118" y="59" width="22" height="3" rx="1.5" fill="#2E8A52"/>`,
  // the turtlesim window: blue water, a pale trail with one red stroke, the turtle at its end
  turtle: `<rect x="28" y="6" width="104" height="86" rx="6" fill="#2C2C2C"/><circle cx="123" cy="12" r="3" fill="#E95420"/>
    <rect x="31" y="18" width="98" height="71" fill="rgb(69,86,255)"/>
    <path d="M44 78L62 60 82 66 96 44" fill="none" stroke="#B3B8FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M96 44l14 -8" stroke="#FF3B30" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="36" y="64" width="20" height="20" fill="none" stroke="#FFC83D" stroke-width="1.6" stroke-dasharray="3 2"/>
    <g transform="translate(112 35) rotate(-30)"><ellipse cx="7" cy="0" rx="3" ry="2.6" fill="#3FA34D"/><g fill="#3FA34D"><ellipse cx="3" cy="4.5" rx="2.2" ry="1.8"/><ellipse cx="3" cy="-4.5" rx="2.2" ry="1.8"/><ellipse cx="-4" cy="4.5" rx="2.2" ry="1.8"/><ellipse cx="-4" cy="-4.5" rx="2.2" ry="1.8"/></g><ellipse cx="0" cy="0" rx="6" ry="5" fill="#8BC34A" stroke="#1D2B53" stroke-width="1"/></g>`,
};

const GLYPHS = {
  paths: `<path d="M4 6h6q3 0 3 3v6q0 3 3 3h4"/><circle cx="4" cy="6" r="2" fill="currentColor"/><circle cx="13" cy="12" r="2"/><circle cx="20" cy="18" r="2"/>`,
  radio: `<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M6 14h12M7 11v3M10 12v2M13 11v3M16 12v2"/><path d="M14 9v7" stroke-width="2.4"/><path d="M8 7l7-4"/>`,
  pizza: `<path d="M6 3h12v16l-2 2-2-2-2 2-2-2-2 2-2-2z"/><path d="M9 8h6M9 11h4M9 15h6"/>`,
  tsa: `<rect x="8" y="2.5" width="9" height="6" rx="1" transform="rotate(-6 12 5)"/><path d="M2.5 13v5h5v-5M9.5 13v5h5v-5M16.5 13v5h5v-5"/>`,
  source: `<rect x="2.5" y="4" width="13" height="16" rx="2"/><path d="M5.5 9l2.5 2-2.5 2M9.5 15h3"/><path d="M18 5h3.5v14H18"/><path d="M18 9h2M18 12h2M18 15h2"/>`,
  turtle: `<ellipse cx="11" cy="12" rx="6" ry="5"/><circle cx="19" cy="12" r="2"/><path d="M7 7l-1.5-2M15 7l1.5-2M7 17l-1.5 2M15 17l1.5 2M5 12H2.5"/><path d="M8 10l6 4M14 10l-6 4"/>`,
};

export function scene(id) {
  return `<svg class="art-scene" viewBox="0 0 160 96" aria-hidden="true" focusable="false">${SCENES[id] || ""}</svg>`;
}
export function glyph(id, cls = "art-glyph") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${GLYPHS[id] || '<circle cx="12" cy="12" r="6"/>'}</svg>`;
}

// a round rubber stamp: two rings, the badge name along the top arc, the glyph in the middle and the course week below
let uid = 0;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function stamp(meta, { tilt = -8 } = {}) {
  const id = `stp${++uid}`;
  return `<svg class="art-stamp" viewBox="0 0 120 120" aria-hidden="true" focusable="false" style="color:${INKS[meta.id] || "#17212F"}">
    <defs><path id="${id}t" d="M21 60a39 39 0 0 1 78 0"/><path id="${id}b" d="M27 62a33 33 0 0 0 66 0"/>
      <filter id="${id}f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${uid}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.9 0 0 0 1.8" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter></defs>
    <g transform="rotate(${tilt} 60 60)" fill="none" stroke="currentColor" filter="url(#${id}f)">
      <circle cx="60" cy="60" r="55" stroke-width="4.5"/><circle cx="60" cy="60" r="45.5" stroke-width="1.8"/>
      <text font-size="13.5" font-weight="800" letter-spacing=".6" fill="currentColor" stroke="none"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${esc(meta.badge)}</textPath></text>
      <text font-size="10" font-weight="700" letter-spacing=".6" fill="currentColor" stroke="none"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${esc(meta.week > 6 ? "ROS2Lab" : `Week ${meta.week}, ${meta.lesson}`)}</textPath></text>
      <g transform="translate(42 40) scale(1.5)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[meta.id] || ""}</g>
    </g></svg>`;
}

// SVG strings -> a node
export function svgNode(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
