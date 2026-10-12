// Folder tree with a "you are here" pin: watch cd move through absolute and relative paths.
import { frame, svg, el } from "./frame.js";

const TREE = [
  ["/", null], ["/home", "/"], ["/home/student", "/home"], ["/home/student/Documents", "/home/student"], ["/home/student/ros2_ws", "/home/student"],
  ["/home/student/ros2_ws/src", "/home/student/ros2_ws"], ["/opt", "/"], ["/opt/ros", "/opt"], ["/opt/ros/jazzy", "/opt/ros"],
];
const HOME = "/home/student";

export function mount(container, meta) {
  const f = frame(container, meta, { height: 330 });
  const S = f.stage;
  const pos = {};
  // simple layout: depth = x, order = y
  const kids = (p) => TREE.filter((t) => t[1] === p).map((t) => t[0]);
  let row = 0;
  (function lay(p, d) { pos[p] = [24 + d * 120, 26 + row * 34]; row++; kids(p).forEach((k) => lay(k, d + 1)); })("/", 0);
  const nameOf = (p) => (p === "/" ? "/" : p.split("/").pop());
  const lines = TREE.filter((t) => t[1]).map(([p, par]) => svg("path", { d: `M${pos[par][0] + 8} ${pos[par][1] + 8} V${pos[p][1]} H${pos[p][0] - 4}`, class: "an-treeline" }));
  const labels = Object.fromEntries(TREE.map(([p]) => [p, svg("text", { x: pos[p][0], y: pos[p][1] + 5, class: "an-tree", text: `📁 ${nameOf(p)}${p === HOME ? "  (~)" : ""}` })]));
  const pin = svg("g", { class: "an-pin" }, svg("circle", { r: 9 }), svg("text", { y: 4, text: "★" }));
  S.append(...lines, ...Object.values(labels), pin);

  let cwd = HOME;
  const pwd = el("code", { class: "anim-pwd" });
  const input = el("input", { type: "text", placeholder: "type a cd command, e.g. cd ros2_ws", autocapitalize: "off", spellcheck: "false", "aria-label": "cd command" });
  const go = el("button", { type: "button", class: "btn btn-small", text: "Run" });
  f.extra.append(el("div", { class: "anim-row" }, el("span", { text: "pwd → " }), pwd), el("div", { class: "anim-row" }, input, go));

  function place(animate) {
    const [x, y] = pos[cwd];
    pin.style.transition = animate ? "transform .5s ease" : "none";
    pin.style.transform = `translate(${x - 14}px, ${y}px)`;
    Object.entries(labels).forEach(([p, t]) => t.classList.toggle("here", p === cwd));
    pwd.textContent = cwd;
  }
  function resolve(arg) {
    if (!arg || arg === "~") return HOME;
    let base = arg.startsWith("/") ? "/" : arg.startsWith("~/") ? HOME : cwd;
    const parts = (arg.startsWith("~/") ? arg.slice(2) : arg).split("/").filter(Boolean);
    let cur = base;
    for (const s of parts) {
      if (s === ".") continue;
      if (s === "..") { cur = cur === "/" ? "/" : cur.replace(/\/[^/]+$/, "") || "/"; continue; }
      cur = cur === "/" ? `/${s}` : `${cur}/${s}`;
    }
    return cur;
  }
  function cd(cmd) {
    const m = cmd.trim().match(/^cd(?:\s+(\S+))?$/);
    if (!m) { f.say("Type a **cd** command, for example `cd ..` or `cd /opt/ros/jazzy`.", "no"); return; }
    const arg = m[1], target = resolve(arg);
    f.logLine(`student@ros2lab:${cwd.startsWith(HOME) ? "~" + cwd.slice(HOME.length) : cwd}$ ${cmd.trim()}`);
    if (!pos[target]) { f.logLine(`bash: cd: ${arg}: No such file or directory`, "err"); f.say(`There is no folder **${target}** in this tree. Check the spelling, and whether you meant an absolute path (starting with /) or a relative one.`, "no"); return; }
    const from = cwd; cwd = target; place(true);
    const kind = !arg || arg === "~" ? "**cd** alone (or **cd ~**) always goes **home**." : arg.startsWith("/") ? "This is an **absolute** path: it starts with **/**, so it works from anywhere." : arg.startsWith("~/") ? "**~/** means \"start from my home folder\", so this works from anywhere." : arg.includes("..") ? "**..** means \"the folder above\". This is a **relative** path: it depends on where you are." : "This is a **relative** path: it starts from where you are now.";
    f.say(`Moved from **${from}** to **${target}**. ${kind}`, "ok");
  }
  go.addEventListener("click", () => { cd(input.value || "cd"); input.value = ""; input.focus(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go.click(); } });
  ["cd Documents", "cd ..", "cd ros2_ws/src", "cd /opt/ros/jazzy", "cd ~"].forEach((c) => f.button(c, () => cd(c)));
  f.button("Reset", () => { cwd = HOME; f.clearLog(); place(false); intro(); });
  const intro = () => f.say("The ★ shows **where you are** (the folder `pwd` prints). Press a cd button, or type your own, and watch the star move.");
  place(false); intro();
}
