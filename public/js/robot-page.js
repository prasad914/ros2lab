// robot.html?id=<id>: the info page of one robot of the Robot simulator. Everything shown is read from
// robots/index.json and robots/ws/index.json (js/robot-info.js); "Open in the simulator" goes to rviz.html?robot=<id>.
import { h, loadRobots, statusOf, statusBadge, sensorsOf, speedOf, noteOf, hasGazebo, picture } from "./robot-info.js";
import { CATEGORIES, categoryOf } from "./sim-catalog.js";

const id = new URLSearchParams(location.search).get("id") || "";
const root = document.getElementById("rb"), crumbs = document.getElementById("rb-crumbs");
const link = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer", text });
const code = (t) => h("code", { text: t });
const homeLinks = () => [h("a", { href: "index.html", text: "Home" }), " › ", h("a", { href: "rviz.html", text: "Robot simulator" })];

function notFound() {
  document.title = "Robot not found | ROS2Lab";
  crumbs.replaceChildren(...homeLinks(), " › Robot not found");
  root.classList.add("rb-none");
  root.replaceChildren(h("div", { class: "rbinfo" },
    h("h1", { text: "Robot not found" }),
    h("p", { text: id ? "There is no robot called “" + id + "” in the simulator." : "No robot was chosen." }),
    h("p", {}, h("a", { class: "btn btn-main", href: "rviz.html", text: "Back to the Robot simulator" }))));
}

function render(g, data) {
  const cat = CATEGORIES.find((c) => c.id === categoryOf(g));
  const catTitle = cat ? cat.title : "Robots";
  document.title = `${g.title} | Robot simulator | ROS2Lab`;
  crumbs.replaceChildren(...homeLinks(), " › ", h("a", { href: `rviz.html#${cat ? cat.id : ""}`, text: catTitle }));
  const sens = sensorsOf(g), speed = speedOf(g), note = noteOf(g);
  const rows = [
    ["Type", catTitle],
    ["Made by", g.vendor || "ROS2Lab (course robot)"],
    ["Fixed frame", g.fixedFrame && code(g.fixedFrame)],
    ["Description file", g.file && code(g.file)],
    ["Package", g.pkg && code(g.pkg)],
    ["Gazebo", hasGazebo(g, data) ? "Yes" : "Not in this simulator"],
    ["MoveIt 2", g.moveit ? "Yes" : null],
    ["Max speed", speed && speed[0] != null ? `${speed[0]} m/s, ${speed[1]} rad/s` : null],
    ["Sensors", sens.length ? h("span", {}, ...sens.flatMap((s, i) => [i ? h("br") : null, s.name || s.type, " ", h("span", { class: "mut" }, `(${s.type}${s.topic ? ", " : ""}`, s.topic ? code("/" + s.topic) : null, ")")])) : null],
    ["Sensors and speeds from", g.specs && g.specs.source && link(g.specs.source, g.specs.source.replace(/^https:\/\//, ""))],
    ["Source", g.source && g.source.url && h("span", {}, link(g.source.url, g.source.url.replace("https://github.com/", "")), g.source.license ? ` · ${g.source.license}` : "")],
  ].filter(([, v]) => v);
  const url = `rviz.html?robot=${encodeURIComponent(g.id)}`;
  const test = statusOf(g) !== "course";
  root.replaceChildren(
    h("div", { class: "rbpic" }, picture(g, "rbimg")),
    h("div", { class: "rbinfo" },
      statusBadge(g),
      h("h1", { text: g.title }),
      h("p", { class: "rblede", text: g.about }),
      note ? h("p", { class: "rbnote", text: note }) : null,
      h("div", { class: "rbact" }, h("a", { class: "btn btn-main", href: url, text: "Open in the simulator" }), h("a", { class: "btn btn-sec", href: "rviz.html", text: "All robots" })),
      test ? h("p", { class: "rbwarn" }, h("b", { text: "Under test. " }), `This robot opens in RViz${hasGazebo(g, data) ? " and Gazebo" : ""}, but it is not used in the course lessons yet.`) : null,
      h("dl", { class: "rbdl" }, ...rows.flatMap(([k, v]) => [h("dt", { text: k }), h("dd", {}, v)])),
      g.real && g.real.length ? [h("h2", { text: "Real robots like this" }), h("ul", { class: "rreal" }, ...g.real.map((x) => h("li", {}, link(x.url, x.title))))] : null));
}

const data = await loadRobots();
const g = data.list.find((x) => x.id === id);
if (g) render(g, data); else notFound();
