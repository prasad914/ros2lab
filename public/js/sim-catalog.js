// The robot catalog of the Robotic Models Simulator: the gallery robots by category, each with its picture. A robot
// opens in this window (rviz.html?robot=<id>) with a workspace of its own, so two robots never share packages.
import { gallery } from "./rviz-block.js";

export const CATEGORIES = [
  { id: "manipulator", title: "Manipulators", blurb: "Arms on a fixed base: plan with MoveIt 2, pick and place, follow trajectories." },
  { id: "mobile", title: "Mobile robots", blurb: "Wheeled robots: differential, car-like and mecanum drives with lidar, camera and IMU." },
  { id: "legged", title: "Legged robots and humanoids", blurb: "Quadrupeds, a hexapod and humanoids: many joints, a floating base." },
  { id: "drone", title: "Drones", blurb: "Multirotors that fly in Gazebo with velocity control." },
  { id: "hybrid", title: "Hybrid robots", blurb: "An arm on a mobile base or on legs: navigation and manipulation in one robot." },
];
// robots listed before index.json had a category
const GUESS = [[/arm|ur5|fr3|gen3|xarm|lite6|cr5|magician|so101|wx250|irb|kr6|lrmate/, "manipulator"], [/manipulator/, "hybrid"], [/quad.*copter|crazyflie|drone/, "drone"], [/quadruped|hexapod|humanoid|go2|g1|h1|spot|legged/, "legged"]];
export const categoryOf = (g) => g.category || (GUESS.find(([re]) => re.test(g.id)) || [, "mobile"])[1];

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};

// a robot opens in this same window (rviz.html?robot=<id>); each robot still has its own workspace, so two robots
// never share packages. Ctrl/Cmd/middle click still lets the browser open a tab.
export function openRobot(id, ev) {
  if (ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1)) return;
  if (ev) ev.preventDefault();
  location.href = `rviz.html?robot=${encodeURIComponent(id)}`;
}

let OFFICIAL = new Set();   // gallery ids with an official ROS 2 Jazzy workspace (public/robots/ws/index.json)
const facts = (g) => {
  const out = [];
  if (OFFICIAL.has(g.id)) out.push("Official Jazzy workspace");
  if (g.vendor) out.push(g.vendor); else out.push("ROS2Lab course robot");
  if (g.moveit) out.push("MoveIt 2");
  out.push(g.category === "manipulator" || /arm/.test(g.id) ? "Gazebo + ros2_control" : "Gazebo sensors");
  return out;
};
const firstSentence = (t) => { const m = String(t || "").match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(t || "")).trim(); };

// pictures: the shipped one, else drawn here once (one at a time, when the card scrolls into view)
let queue = Promise.resolve();
function picture(g) {
  const fig = h("div", { class: "cat-pic" });
  const img = h("img", { src: `img/robots/${g.id}.webp`, alt: `${g.title}`, loading: "lazy", width: "400", height: "300", decoding: "async" });
  img.addEventListener("error", () => {
    img.remove(); fig.classList.add("drawing"); fig.append(h("span", { class: "cat-pic-wait", text: "Drawing the robot…" }));
    const io = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return; io.disconnect();
      queue = queue.then(async () => {
        try { const { robotPicture } = await import("./robot-thumb.js"); const url = await robotPicture(g); fig.replaceChildren(h("img", { src: url, alt: g.title, width: "400", height: "300" })); }
        catch { fig.replaceChildren(h("span", { class: "cat-pic-wait", text: g.title })); }
        fig.classList.remove("drawing");
      });
    }, { rootMargin: "200px" });
    io.observe(fig);
  }, { once: true });
  fig.append(img);
  return fig;
}

function card(g) {
  const cat = categoryOf(g);
  const a = h("a", { class: `cat-card c-${cat}`, href: `rviz.html?robot=${encodeURIComponent(g.id)}`, "data-id": g.id, onclick: (e) => openRobot(g.id, e), "aria-label": `${g.title}: open the simulator` },
    picture(g),
    h("div", { class: "cat-body" },
      h("h3", { text: g.title }),
      h("p", { class: "cat-about", text: firstSentence(g.about) }),
      h("ul", { class: "cat-facts" }, ...facts(g).map((f) => h("li", { text: f })))),
    h("span", { class: "cat-open", "aria-hidden": "true", text: "Open →" }));
  a.dataset.search = `${g.title} ${g.vendor || ""} ${g.id} ${g.about || ""} ${cat}`.toLowerCase();
  return a;
}

export async function mountCatalog() {
  const [list, wsIdx] = await Promise.all([gallery(), fetch("/robots/ws/index.json").then((r) => (r.ok ? r.json() : { workspaces: {} })).catch(() => ({ workspaces: {} }))]);
  OFFICIAL = new Set(Object.values(wsIdx.workspaces || {}).flatMap((w) => w.robots || []));
  const tabs = document.getElementById("cat-tabs"), box = document.getElementById("cat-list"), q = document.getElementById("cat-q");
  const by = new Map(CATEGORIES.map((c) => [c.id, []]));
  for (const g of list) { const c = categoryOf(g); if (!by.has(c)) by.set(c, []); by.get(c).push(g); }
  // the course's own robots first in each category, then the makers' robots
  for (const arr of by.values()) arr.sort((a, b) => (!!a.vendor - !!b.vendor));
  const sections = CATEGORIES.filter((c) => by.get(c.id).length).map((c) => h("section", { class: `cat-sec c-${c.id}`, id: `cat-${c.id}`, "data-cat": c.id, "aria-labelledby": `cat-h-${c.id}` },
    h("header", { class: "cat-sec-head" }, h("h2", { id: `cat-h-${c.id}`, text: c.title }), h("span", { class: "cat-count", text: `${by.get(c.id).length}` }), h("p", { class: "muted small", text: c.blurb })),
    h("div", { class: "cat-grid" }, ...by.get(c.id).map(card))));
  const own = h("section", { class: "cat-sec c-own", "data-cat": "own" },
    h("header", { class: "cat-sec-head" }, h("h2", { text: "Your own robot" }), h("p", { class: "muted small", text: "Open your .urdf / .urdf.xacro and mesh files, or a package folder, with a workspace of its own. Nothing is uploaded: the files stay on your computer." })),
    h("div", { class: "cat-grid" }, h("a", { class: "cat-card cat-own", href: "rviz.html?robot=own", onclick: (e) => openRobot("own", e) },
      h("div", { class: "cat-pic cat-pic-own", "aria-hidden": "true" }, h("span", { text: "</>" })),
      h("div", { class: "cat-body" }, h("h3", { text: "My robot package" }), h("p", { class: "cat-about", text: "Your URDF, built and launched like the others." })),
      h("span", { class: "cat-open", "aria-hidden": "true", text: "Open →" }))));
  box.replaceChildren(...sections, own);
  // the category tabs filter the list; "All" shows every section
  let active = "all";
  const tabBtn = (id, title, n) => h("button", { type: "button", class: "cat-tab", "data-cat": id, "aria-pressed": id === active ? "true" : "false", onclick: () => { active = id; paint(); } }, title, n != null ? h("span", { class: "cat-n", text: String(n) }) : null);
  tabs.replaceChildren(tabBtn("all", "All", list.length), ...CATEGORIES.filter((c) => by.get(c.id).length).map((c) => tabBtn(c.id, c.title.replace(" and humanoids", " & humanoids"), by.get(c.id).length)));
  const paint = () => {
    const term = (q.value || "").trim().toLowerCase();
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.cat === active ? "true" : "false"));
    for (const s of box.querySelectorAll(".cat-sec")) {
      let shown = 0;
      for (const c of s.querySelectorAll(".cat-card")) { const ok = !term || (c.dataset.search || "").includes(term) || c.classList.contains("cat-own"); c.hidden = !ok; shown += ok && !c.classList.contains("cat-own") ? 1 : 0; }
      s.hidden = !(active === "all" || s.dataset.cat === active || (s.dataset.cat === "own" && active === "all")) || (term && !shown && s.dataset.cat !== "own");
    }
    try { localStorage.setItem("ros2lab.sim.tab", active); } catch { /* off */ }
  };
  q.addEventListener("input", paint);
  // the hero: one robot of each kind; a tile shows that category
  const head = document.querySelector(".cat-head");
  if (head && !head.querySelector(".cat-hero")) {
    const pickOne = (cat, pref) => (by.get(cat) || []).find((g) => g.id === pref) || (by.get(cat) || []).find((g) => g.vendor) || (by.get(cat) || [])[0];
    const tiles = [["manipulator", "ur5e"], ["mobile", "tb3_burger"], ["legged", "spot"], ["drone", "crazyflie"]].map(([cat, pref]) => [CATEGORIES.find((c) => c.id === cat), pickOne(cat, pref)]).filter(([, g]) => g);
    head.append(h("div", { class: "cat-hero" }, ...tiles.map(([c, g]) => h("button", { type: "button", class: `cat-hero-tile c-${c.id}`, "aria-label": `Show ${c.title}`, onclick: () => { active = c.id; q.value = ""; paint(); document.getElementById("cat-list").scrollIntoView({ block: "start", behavior: "smooth" }); } },
      h("img", { src: `img/robots/${g.id}.webp`, alt: "", width: "400", height: "300", decoding: "async", onerror: (e) => { e.target.remove(); } }),
      h("span", { text: c.title.replace(" and humanoids", "") })))));
  }
  try { const t = localStorage.getItem("ros2lab.sim.tab"); if (t && (t === "all" || by.has(t))) active = t; } catch { /* off */ }
  const hash = location.hash.replace("#", ""); if (by.has(hash)) active = hash;
  paint();
  window.__ros2lab = { catalog: { list, openRobot } };
}
