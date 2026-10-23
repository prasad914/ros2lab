// The robot catalog of the Robotic Models Simulator (rviz.html without ?robot=): the TurtleBot3 course robots, then the
// gallery robots by category. A card opens the robot info page (robot.html?id=<id>); its button opens the workbench
// (rviz.html?robot=<id>), where each robot has a workspace of its own, so two robots never share packages.
import { h, firstSentence, loadRobots, statusOf, statusBadge, isLegacy, sensorsOf, sensorKind, facts, picture } from "./robot-info.js";

export const CATEGORIES = [
  { id: "mobile", title: "Mobile robots", blurb: "Wheeled robots: differential, car-like and mecanum drives with lidar, camera and IMU." },
  { id: "manipulator", title: "Manipulators", blurb: "Arms on a fixed base: plan with MoveIt 2, pick and place, follow trajectories." },
  { id: "legged", title: "Legged robots and humanoids", blurb: "Quadrupeds, a hexapod and humanoids: many joints, a floating base." },
  { id: "drone", title: "Drones", blurb: "Multirotors with velocity control." },
  { id: "hybrid", title: "Hybrid robots", blurb: "An arm on a mobile base or on legs: navigation and manipulation in one robot." },
];
// robots listed before index.json had a category
const GUESS = [[/arm|ur5|fr3|gen3|xarm|lite6|cr5|magician|so101|wx250|irb|kr6|lrmate/, "manipulator"], [/manipulator/, "hybrid"], [/quad.*copter|crazyflie|drone/, "drone"], [/quadruped|hexapod|humanoid|go2|g1|h1|spot|legged/, "legged"]];
export const categoryOf = (g) => g.category || (GUESS.find(([re]) => re.test(g.id)) || [, "mobile"])[1];

// a robot opens in this same window (rviz.html?robot=<id>); each robot still has its own workspace, so two robots
// never share packages. Ctrl/Cmd/middle click still lets the browser open a tab.
export function openRobot(id, ev) {
  if (ev && (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1)) return;
  if (ev) ev.preventDefault();
  location.href = `rviz.html?robot=${encodeURIComponent(id)}`;
}

const shortTitle = (c) => c.title.replace(" and humanoids", " & humanoids");
const TB3 = ["tb3_burger", "tb3_waffle", "tb3_waffle_pi"];
const infoUrl = (id) => `robot.html?id=${encodeURIComponent(id)}`;

function card(g, data) {
  const cat = categoryOf(g);
  const sens = sensorsOf(g);
  const a = h("a", { class: `cat-card c-${cat}`, href: infoUrl(g.id), "data-id": g.id, "aria-label": `${g.title}: robot information` },
    picture(g),
    h("div", { class: "cat-body" },
      h("span", { class: "cat-st" }, statusBadge(g)),
      h("h3", { text: g.title }),
      h("p", { class: "cat-about", text: firstSentence(g.about) }),
      h("ul", { class: "cat-facts" }, ...facts(g, data).map((f) => h("li", { text: f })))),
    h("span", { class: "cat-open", "aria-hidden": "true", text: "Open →" }));
  a.dataset.search = `${g.title} ${g.vendor || ""} ${g.id} ${g.about || ""} ${cat} ${statusOf(g) === "active" ? (isLegacy(g) ? "course robot legacy" : "course robot") : "under test"} ${sens.map((s) => `${s.name || ""} ${s.type || ""} ${sensorKind(s)}`).join(" ")}`.toLowerCase();
  return a;
}

export async function mountCatalog() {
  const data = await loadRobots();
  const list = data.list;
  const tabs = document.getElementById("cat-tabs"), box = document.getElementById("cat-list"), q = document.getElementById("cat-q"), feat = document.getElementById("cat-feat");
  const by = new Map(CATEGORIES.map((c) => [c.id, []]));
  for (const g of list) { const c = categoryOf(g); if (!by.has(c)) by.set(c, []); by.get(c).push(g); }
  // the course's own robots first in each category, then the makers' robots
  for (const arr of by.values()) arr.sort((a, b) => (!!a.vendor - !!b.vendor));

  // the featured TurtleBot3 panel: the three course robots
  const tb3 = TB3.map((id) => list.find((g) => g.id === id)).filter(Boolean);
  feat.dataset.search = `turtlebot3 tb3 course robot ${tb3.map((g) => `${g.title} ${sensorsOf(g).map(sensorKind).join(" ")}`).join(" ")}`.toLowerCase();
  feat.querySelector(".feat-r").replaceChildren(...tb3.map((g) => {
    const kinds = [...new Set(sensorsOf(g).map(sensorKind))];
    return h("a", { class: "fcard cat-card", href: infoUrl(g.id), "data-id": g.id },
      picture(g, "fpic"),
      h("b", { text: g.title.replace("TurtleBot3 ", "") }),
      isLegacy(g) ? statusBadge(g) : null,
      h("span", { text: kinds.length ? `Sensors: ${kinds.join(", ")}` : "Sensors: UNKNOWN" }),
      h("ul", { class: "cat-facts" }, ...facts(g, data).map((f) => h("li", { text: f }))));
  }));

  const tbRef = () => {
    const a = h("a", { class: "cat-card tbref", href: "#cat-feat", "aria-label": "TurtleBot3 Burger, Waffle and Waffle Pi: shown at the top of this page" },
      h("div", { class: "cat-body" },
        h("span", { class: "cat-st" }, h("span", { class: "st st-ok", text: "Course robot" })),
        h("h3", { text: "TurtleBot3 Burger, Waffle and Waffle Pi" }),
        h("p", { class: "cat-about", text: "The course robots are shown at the top of this page." })),
      h("span", { class: "cat-open", "aria-hidden": "true", text: "Go there ↑" }));
    a.dataset.search = feat.dataset.search;
    a.addEventListener("click", (e) => { e.preventDefault(); feat.scrollIntoView({ block: "start", behavior: "smooth" }); feat.focus({ preventScroll: true }); });
    return a;
  };
  const sections = CATEGORIES.filter((c) => by.get(c.id).length).map((c) => h("section", { class: `cat-sec c-${c.id}`, id: `cat-${c.id}`, "data-cat": c.id, "aria-labelledby": `cat-h-${c.id}` },
    h("header", { class: "cat-sec-head" }, h("h2", { id: `cat-h-${c.id}`, text: shortTitle(c) }), h("span", { class: "cat-count", text: `${by.get(c.id).length}` }), h("p", { class: "muted small", text: c.blurb })),
    h("div", { class: "cat-grid" }, ...by.get(c.id).filter((g) => !TB3.includes(g.id)).map((g) => card(g, data)), c.id === "mobile" ? tbRef() : null)));
  const own = h("section", { class: "cat-sec c-own", "data-cat": "own" },
    h("header", { class: "cat-sec-head" }, h("h2", { text: "Your own robot" }), h("p", { class: "muted small", text: "Open your .urdf / .urdf.xacro and mesh files, or a package folder, with a workspace of its own. Nothing is uploaded: the files stay on your computer." })),
    h("div", { class: "cat-grid" }, h("a", { class: "cat-card cat-own", href: "rviz.html?robot=own", onclick: (e) => openRobot("own", e) },
      h("div", { class: "cat-pic cat-pic-own", "aria-hidden": "true" }, h("span", { text: "</>" })),
      h("div", { class: "cat-body" }, h("h3", { text: "My robot package" }), h("p", { class: "cat-about", text: "Your URDF, built and launched like the others." })),
      h("span", { class: "cat-open", "aria-hidden": "true", text: "Open →" }))));
  box.replaceChildren(...sections, own);

  // the category tabs filter the list; "All" shows every section. A first visit shows only the course robots (the
  // TurtleBot3 panel) with a "Show all" button (docs/redesign/reviews/webdesign.md #9); typing a filter searches them all.
  let active = "course";
  const more = h("p", { class: "cat-more" }, h("button", { type: "button", class: "btn btn-sec", onclick: () => { active = "all"; paint(true); tabs.querySelector("button[data-cat=all]").focus(); } }, `Show all ${list.length} robots`));
  box.before(more);
  const tabBtn = (id, title, n) => h("button", { type: "button", class: "cat-tab", "data-cat": id, "aria-pressed": id === active ? "true" : "false", onclick: () => { active = id; paint(true); } }, title, n != null ? h("span", { class: "cat-n", text: String(n) }) : null);
  tabs.replaceChildren(tabBtn("all", "All", list.length), ...CATEGORIES.filter((c) => by.get(c.id).length).map((c) => tabBtn(c.id, shortTitle(c), by.get(c.id).length)));
  const paint = (save) => {
    const term = (q.value || "").trim().toLowerCase();
    const only = active === "course" && !term;
    more.hidden = !only; box.hidden = only;
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.cat === active ? "true" : "false"));
    feat.hidden = !!term && !feat.dataset.search.includes(term);
    for (const s of box.querySelectorAll(".cat-sec")) {
      let shown = 0;
      for (const c of s.querySelectorAll(".cat-card")) { const ok = !term || (c.dataset.search || "").includes(term) || c.classList.contains("cat-own"); c.hidden = !ok; shown += ok && !c.classList.contains("cat-own") ? 1 : 0; }
      s.hidden = !(active === "all" || active === "course" || s.dataset.cat === active || (s.dataset.cat === "own" && active === "all")) || (term && !shown && s.dataset.cat !== "own");
    }
    if (save) try { localStorage.setItem("ros2lab.sim.tab", active); } catch { /* off */ }
  };
  q.addEventListener("input", () => paint());
  try { const t = localStorage.getItem("ros2lab.sim.tab"); if (t && (t === "all" || by.has(t))) active = t; } catch { /* off */ }
  const hash = location.hash.replace("#", ""); if (by.has(hash)) active = hash;
  paint();
  if (typeof window !== "undefined") {
    if (window.__ros2lab) window.__ros2lab.catalog = { list, openRobot };
    else window.__ros2lab = { catalog: { list, openRobot } };
  }
}
