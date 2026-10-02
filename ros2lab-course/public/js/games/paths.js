// Path Finder: practise cd with absolute and relative paths on a folder tree.
import { el } from "../dom.js";
import { shell } from "./shell.js";

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

export function mount(container, meta, opts) {
  const g = shell(container, { ...meta, goal: "Chiku the robot needs to reach the 🏁 folder. Type a `cd` command and press Enter." }, opts);
  let round = 0, cwd = ROUNDS[0].from, misses = 0;

  const treeBox = el("div", { class: "pf-tree", role: "tree", "aria-label": "Folder tree" });
  const prompt = el("span", { class: "pf-prompt" });
  const input = el("input", { type: "text", class: "pf-input", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Type a cd command" });
  const go = el("button", { class: "btn btn-small", type: "button", text: "Run" });
  const roundLabel = el("div", { class: "pf-round" });
  g.stage.append(roundLabel, treeBox, el("div", { class: "pf-term" }, el("div", { class: "pf-line" }, prompt, input), go));

  function node(n, path, depth) {
    const here = path === cwd, target = path === ROUNDS[round]?.to;
    const row = el("div", { class: `pf-row${here ? " here" : ""}${target ? " target" : ""}`, role: "treeitem", style: { paddingLeft: `${depth * 18 + 6}px` } },
      el("span", { class: "pf-icon", "aria-hidden": "true", text: n.kids.length ? "▾" : "▸" }),
      el("span", { class: "pf-name", text: n.name === "/" ? "/  (root)" : n.name + "/" }),
      here ? el("span", { class: "pf-tag me", text: "🤖 Chiku" }) : null,
      target ? el("span", { class: "pf-tag goal", text: "🏁 goal" }) : null);
    return [row, ...n.kids.flatMap((k) => node(k, path === "/" ? `/${k.name}` : `${path}/${k.name}`, depth + 1))];
  }

  function paint() {
    treeBox.replaceChildren(...node(TREE, "/", 0));
    prompt.textContent = `student@ros2lab:${pretty(cwd)}$ `;
    roundLabel.textContent = round < ROUNDS.length ? `Trip ${round + 1} of ${ROUNDS.length}: from ${pretty(cwd)} to ${pretty(ROUNDS[round].to)}` : "All trips done";
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
