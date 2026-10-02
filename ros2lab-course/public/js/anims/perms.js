// Permissions: toggle r/w/x for owner, group, others; see ls -l text, the number and chmod.
import { frame, el, rich } from "./frame.js";

const WHO = ["owner (you)", "group", "others"];
const BITS = [["r", "read", 4], ["w", "write", 2], ["x", "run", 1]];
const TARGETS = [
  { text: "Make **patrol.py** runnable by everyone, but writable only by you.", mode: "755" },
  { text: "A private notes file: only you can read and write it. Nobody can run it.", mode: "600" },
  { text: "A normal text file: you read and write, everyone else may only read.", mode: "644" },
];

export function mount(container, meta) {
  const f = frame(container, meta, { height: 10 });
  f.stage.parentElement.hidden = true;
  let m = [[true, true, false], [true, false, false], [true, false, false]];
  let t = 0;
  const grid = el("div", { class: "perm-grid" });
  const lsOut = el("code", { class: "perm-ls" });
  const num = el("code", { class: "perm-num" });
  const task = el("div", { class: "perm-task" });
  f.extra.append(task, grid, el("div", { class: "anim-row" }, el("span", { text: "ls -l shows: " }), lsOut, el("span", { text: "  chmod number: " }), num));
  function digits() { return m.map((r) => r.reduce((s, on, i) => s + (on ? BITS[i][2] : 0), 0)).join(""); }
  function paint() {
    grid.replaceChildren(el("span"), ...BITS.map(([, w]) => el("b", { text: w })),
      ...m.flatMap((r, wi) => [el("b", { class: "perm-who", text: WHO[wi] }), ...r.map((on, bi) => el("button", {
        type: "button", class: `perm-bit${on ? " on" : ""}`, "aria-pressed": on ? "true" : "false", "aria-label": `${WHO[wi]} ${BITS[bi][1]}`,
        text: on ? BITS[bi][0] : "-", onclick: () => { m[wi][bi] = !m[wi][bi]; paint(); check(); } }))]));
    lsOut.textContent = `-${m.map((r) => r.map((on, i) => (on ? BITS[i][0] : "-")).join("")).join("")}  student student  patrol.py`;
    num.textContent = digits();
    task.replaceChildren(el("b", { text: `Puzzle ${t + 1} of ${TARGETS.length}: ` }), rich(TARGETS[t].text));
  }
  function check() {
    const d = digits();
    if (d !== TARGETS[t].mode) { f.say(`Each digit adds up **r = 4, w = 2, x = 1**. Right now: owner ${d[0]}, group ${d[1]}, others ${d[2]}.`); return; }
    f.logLine(`$ chmod ${d} patrol.py`, "ok");
    if (t < TARGETS.length - 1) { f.say(`Correct: **chmod ${d}**. Next puzzle!`, "ok"); t++; paint(); }
    else f.say(`All three solved. **755** (programs), **644** (normal files) and **600** (private files) are the numbers you will meet most. \`chmod +x file\` is the easy way to add x for everyone.`, "ok");
  }
  f.button("chmod +x (add run for everyone)", () => { m.forEach((r) => { r[2] = true; }); paint(); check(); });
  f.button("Reset", () => { m = [[true, true, false], [true, false, false], [true, false, false]]; t = 0; f.clearLog(); paint(); f.say("Tap the letters to switch each permission on or off. Solve the puzzles."); });
  paint();
  f.say("Every file has 3 groups of 3 switches: **who** (owner, group, others) and **what** (read, write, run). Tap them to solve the puzzle.");
}
