// Path Finder: practise cd with absolute and relative paths. The folder tree is drawn as a transit map:
// / is the central station, each top-level folder is a coloured line, Chiku rides to the station with the flag.
import { el } from "../dom.js";
import { shell, useCss } from "./shell.js";

useCss("paths");

const HOME = "/home/student";
const TREE = {
  name: "/", kids: [
    { name: "home", kids: [{ name: "student", kids: [
      { name: "Desktop", kids: [] },
      { name: "Documents", kids: [{ name: "notes", kids: [] }] },
      { name: "ros2_ws", kids: [{ name: "src", kids: [{ name: "my_robot", kids: [] }] }, { name: "install", kids: [] }] },
    ] }] },
    { name: "opt", kids: [{ name: "ros", kids: [{ name: "jazzy", kids: [] }] }] },
    { name: "tmp", kids: [] },
  ],
};

const ROUNDS = [
  { from: HOME, to: `${HOME}/Documents`, tip: "The folder is right inside where Chiku stands. Just name it." },
  { from: `${HOME}/Documents`, to: `${HOME}/ros2_ws/src`, tip: "Go up one level with `..` first, then down: `cd ../ros2_ws/src`." },
  { from: `${HOME}/ros2_ws/src/my_robot`, to: HOME, tip: "The shortest way home is `cd ~` (or just `cd` on its own)." },
  { from: HOME, to: "/opt/ros/jazzy", tip: "This is far away. Start from the root with an absolute path: `cd /opt/...`" },
  { from: "/opt/ros/jazzy", to: `${HOME}/ros2_ws/install`, tip: "Use `~` as a shortcut for /home/student, then go down." },
];

const allDirs = new Set();
(function walk(n, p) { allDirs.add(p); for (const k of n.kids) walk(k, p === "/" ? `/${k.name}` : `${p}/${k.name}`); })(TREE, "/");

const pretty = (p) => (p === HOME ? "~" : p.startsWith(HOME + "/") ? "~" + p.slice(HOME.length) : p);

function resolve(cwd, arg) {
  if (arg === undefined || arg === "" || arg === "~") return HOME;
  let parts;
  if (arg.startsWith("/")) parts = [];
  else if (arg === "~" || arg.startsWith("~/")) { parts = HOME.split("/").filter(Boolean); arg = arg.slice(1); }
  else parts = cwd.split("/").filter(Boolean);
  for (const seg of arg.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop(); else parts.push(seg);
  }
  return "/" + parts.join("/");
}

// the tree as rows of a transit map: each top-level folder is its own coloured line
const ROW = 30, STEP = 22, X0 = 12;
const LINES = { home: "var(--axis-z)", opt: "var(--axis-y)", tmp: "var(--axis-x)" };
const ROWS = [];
(function flat(n, path, depth, line, parent) {
  const me = { name: n.name, path, depth, line, parent, i: ROWS.length };
  ROWS.push(me);
  for (const k of n.kids) flat(k, path === "/" ? `/${k.name}` : `${path}/${k.name}`, depth + 1, depth === 0 ? k.name : line, me);
})(TREE, "/", 0, null, null);
const sx = (r) => X0 + r.depth * STEP, sy = (r) => r.i * ROW + ROW / 2;
const colour = (r) => LINES[r.line] || "var(--ink)";

function mapSvg() {
  const W = X0 + Math.max(...ROWS.map((r) => r.depth)) * STEP + 12, H = ROWS.length * ROW;
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
  s.setAttribute("class", "pf-lines"); s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("aria-hidden", "true");
  const track = (d, stroke) => { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); p.setAttribute("stroke", stroke); p.setAttribute("class", "pf-track"); s.append(p); };
  // the trunk under "/" is neutral ink; each line takes its colour from the bend where it leaves the trunk
  const kids = ROWS.filter((r) => r.parent && r.parent.depth === 0), last = kids[kids.length - 1];
  track(`M${sx(ROWS[0])} ${sy(ROWS[0])}V${sy(last) - 8}`, "var(--ink)");
  for (const r of ROWS) {
    if (!r.parent) continue;
    const px = sx(r.parent), py = sy(r.parent), cx = sx(r), cy = sy(r), q = 8;
    track(r.parent.depth === 0 ? `M${px} ${cy - q}Q${px} ${cy} ${px + q} ${cy}H${cx}` : `M${px} ${py}V${cy - q}Q${px} ${cy} ${px + q} ${cy}H${cx}`, colour(r));
  }
  for (const r of ROWS) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", sx(r)); c.setAttribute("cy", sy(r)); c.setAttribute("r", r.depth === 0 ? 6 : 4.5);
    c.setAttribute("stroke", colour(r)); c.setAttribute("class", "pf-stop"); c.dataset.path = r.path;
    s.append(c);
  }
  return s;
}

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: "Chiku the robot rides the folder map. Type a `cd` command that takes Chiku to the station with the flag, and press Enter." }, opts);
  let round = 0, cwd = ROUNDS[0].from, misses = 0;

  const rowsBox = el("div", { class: "pf-rows", role: "tree", "aria-label": "Folder tree" });
  const me = el("span", { class: "pf-me", "aria-hidden": "true" });
  const flag = el("span", { class: "pf-flag", "aria-hidden": "true" });
  const treeBox = el("div", { class: "pf-tree pf-map" }, mapSvg(), me, flag, rowsBox);
  const prompt = el("span", { class: "pf-prompt" });
  const input = el("input", { type: "text", class: "pf-input", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Type a cd command" });
  const go = el("button", { class: "btn btn-small", type: "button", text: "Run" });
  const holes = el("span", { class: "pf-holes", "aria-hidden": "true" });
  const tripN = el("b", { class: "pf-tripn" });
  const from = el("code", { class: "pf-from" }), to = el("code", { class: "pf-to" });
  const roundLabel = el("div", { class: "pf-round pf-ticket" },
    el("div", { class: "pf-stub" }, tripN, holes),
    el("div", { class: "pf-fare" }, el("span", { class: "pf-k", text: "From" }), from, el("span", { class: "pf-k", text: "To" }), to));
  const legend = el("ul", { class: "pf-legend", "aria-label": "Shortcuts" },
    el("li", {}, el("code", { text: ".." }), " one station back towards /"),
    el("li", {}, el("code", { text: "~" }), " home: /home/student"),
    el("li", {}, el("code", { text: "/" }), " start from the root"));
  g.stage.append(el("div", { class: "pf-wrap" }, treeBox, el("div", { class: "pf-side" }, roundLabel, legend)),
    el("div", { class: "pf-term" }, el("div", { class: "pf-line" }, prompt, input), go));

  function paint() {
    const target = ROUNDS[round]?.to;
    rowsBox.replaceChildren(...ROWS.map((r) => {
      const here = r.path === cwd, goal = r.path === target;
      return el("div", { class: `pf-row${here ? " here" : ""}${goal ? " target" : ""}`, role: "treeitem", "aria-level": String(r.depth + 1), style: { paddingLeft: `${sx(r) + 16}px` } },
        el("span", { class: "pf-name", text: r.name === "/" ? "/" : r.name + "/" }),
        r.depth === 0 ? el("span", { class: "pf-note", text: "root" }) : null,
        here ? el("span", { class: "pf-tag me", text: "Chiku" }) : null,
        goal ? el("span", { class: "pf-tag goal", text: "goal" }) : null);
    }));
    rowsBox.querySelectorAll(".pf-row").forEach((row, k) => row.style.setProperty("--line", colour(ROWS[k])));
    const at = ROWS.find((r) => r.path === cwd), aim = ROWS.find((r) => r.path === target);
    me.style.transform = `translate(${sx(at)}px, ${sy(at)}px)`;
    flag.hidden = !aim;
    if (aim) flag.style.transform = `translate(${sx(aim)}px, ${sy(aim)}px)`;
    prompt.replaceChildren(el("span", { class: "pf-u", text: "student@ros2lab" }), ":", el("span", { class: "pf-p", text: pretty(cwd) }), "$ ");
    tripN.textContent = round < ROUNDS.length ? `Trip ${round + 1} of ${ROUNDS.length}` : "All trips done";
    holes.replaceChildren(...ROUNDS.map((_, k) => el("i", { class: k < round ? "punched" : "" })));
    from.textContent = pretty(cwd);
    to.textContent = round < ROUNDS.length ? pretty(target) : "home again";
    roundLabel.setAttribute("aria-label", round < ROUNDS.length ? `Trip ${round + 1} of ${ROUNDS.length}: from ${pretty(cwd)} to ${pretty(target)}` : "All trips done");
  }
  function run() {
    const raw = input.value.trim();
    if (!raw) return;
    const m = raw.match(/^cd(?:\s+(\S+))?\s*$/);
    if (!m) { g.say(`Start with **cd** (change directory), a space, then the path. For example: \`cd Documents\``, "no"); return; }
    const dest = resolve(cwd, m[1]);
    if (!allDirs.has(dest)) {
      misses++;
      g.say(`bash: cd: ${m[1]}: No such file or directory. Folder names must match exactly, including capital letters.${misses >= 2 ? " Hint: " + ROUNDS[round].tip : ""}`, "no");
      return;
    }
    if (dest !== ROUNDS[round].to) {
      misses++;
      g.say(`That is a real folder, but it takes Chiku to **${pretty(dest)}**, not ${pretty(ROUNDS[round].to)}.${misses >= 2 ? " Hint: " + ROUNDS[round].tip : ""}`, "no");
      return;
    }
    cwd = dest; misses = 0; input.value = "";
    round++;
    if (round < ROUNDS.length) {
      cwd = ROUNDS[round].from;
      g.say(`Correct! \`${raw}\` worked. Next trip: Chiku has moved to ${pretty(cwd)}.`, "ok");
      paint();
    } else {
      paint();
      g.clear();
      g.win("You used relative paths, `..`, `~` and absolute paths. That is everything you need to move around a ROS 2 workspace.", "cd ~/ros2_ws/src\npwd");
    }
  }

  go.addEventListener("click", run);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } });
  g.onRestart(() => { round = 0; cwd = ROUNDS[0].from; misses = 0; input.value = ""; paint(); });
  paint();
}
