// ROS 2 versions: support periods, the LTS rule, and "today".
import { frame, label, svg } from "./frame.js";

const D = [
  ["Humble Hawksbill", 2022.4, 2027.4, true, "22.04", "May 2022", "May 2027"],
  ["Iron Irwini", 2023.4, 2024.95, false, "22.04", "May 2023", "Dec 2024"],
  ["Jazzy Jalisco", 2024.4, 2029.4, true, "24.04", "May 2024", "May 2029"],
  ["Kilted Kaiju", 2025.4, 2026.95, false, "24.04", "May 2025", "Dec 2026"],
  ["Lyrical Luth", 2026.4, 2031.4, true, "26.04", "May 2026", "May 2031"],
];
const TODAY = 2026.76;

export function mount(container, meta) {
  const f = frame(container, meta, { height: 250 });
  const S = f.stage;
  const x = (yr) => 150 + (yr - 2022) * 50;
  let sel = 2;
  function draw() {
    const kids = [];
    for (let y = 2022; y <= 2031; y++) kids.push(svg("line", { x1: x(y), y1: 20, x2: x(y), y2: 205, class: "an-gridline" }), label(x(y), 225, String(y), "an-lbl small"));
    D.forEach(([n, a, b, lts], i) => {
      const yy = 30 + i * 35;
      kids.push(label(140, yy + 17, n.split(" ")[0], "an-lbl r"),
        svg("rect", { x: x(a), y: yy, width: x(b) - x(a), height: 24, rx: 6, class: `an-span ${lts ? "lts" : ""} ${i === sel ? "sel" : ""}` }),
        label(x(a) + 8, yy + 17, lts ? "LTS · 5 years" : "1.5 years", "an-lbl in"));
    });
    kids.push(svg("line", { x1: x(TODAY), y1: 18, x2: x(TODAY), y2: 208, class: "an-today" }), label(x(TODAY), 14, "today", "an-lbl c"));
    S.replaceChildren(...kids);
  }
  function show() {
    const [n, , , lts, ub, rel, eol] = D[sel];
    f.say(`**${n}**: released ${rel}, for **Ubuntu ${ub}**, supported until **${eol}**. ${lts ? "Released in an **even** year, so it is an **LTS** (long-term support, 5 years)." : "Released in an **odd** year, so it is supported for only about **1.5 years**."}${sel === 2 ? " This is the version used in this course." : ""}`, lts ? "ok" : "");
  }
  D.forEach(([n], i) => f.button(n.split(" ")[0], () => { sel = i; draw(); show(); }, i === 2 ? "" : ""));
  draw(); show();
}
