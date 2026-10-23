// What the robot catalogue (sim-catalog.js) and the robot info page (robot-page.js) both say about a robot. Everything
// comes from public/robots/index.json and public/robots/ws/index.json; nothing is written here by hand.

export const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};

export const firstSentence = (t) => { const m = String(t || "").match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(t || "")).trim(); };
const getJson = (url, fallback) => fetch(url).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback);

// the robots, and which of them have an official Jazzy workspace / a Gazebo simulation
export async function loadRobots() {
  const [list, ws] = await Promise.all([getJson("/robots/index.json", []), getJson("/robots/ws/index.json", { workspaces: {} })]);
  const spaces = Object.values(ws.workspaces || {});
  return {
    list,
    official: new Set(spaces.flatMap((w) => w.robots || [])),
    noGazebo: new Set(spaces.filter((w) => w.gazebo === false).flatMap((w) => w.robots || [])),
  };
}

// "active" for the robots the course uses (public/robots/course-required.json, written into index.json by
// tools/apply-robot-status.mjs); every other robot is under test, also when the field is missing
export const statusOf = (g) => (g.status === "active" ? "active" : "under_test");

// sensors: [{ name, type, topic }] from the Gazebo setup (sim) or the Waffle Pi's published specs
export const sensorsOf = (g) => (g.sim && g.sim.sensors) || (g.specs && g.specs.sensors) || [];
export const speedOf = (g) => {
  const s = g.sim || {}, p = g.specs || {};
  if (s.maxLinear != null) return [s.maxLinear, s.maxAngular];
  if (p.maxLinear != null) return [p.maxLinear, p.maxAngular];
  if (s.velocity && s.velocity.maxV != null) return [s.velocity.maxV, s.velocity.maxW];
  return null;
};
export const noteOf = (g) => (g.sim && (g.sim.note || (g.sim.velocity && g.sim.velocity.note))) || "";
export const hasGazebo = (g, data) => !data.noGazebo.has(g.id);

// the chips on a card
export function facts(g, data) {
  const out = [];
  if (data.official.has(g.id)) out.push("Official Jazzy workspace");
  out.push(g.vendor || "ROS2Lab course robot");
  if (g.moveit) out.push("MoveIt 2");
  const arm = g.category === "manipulator";
  if (hasGazebo(g, data)) out.push(arm ? "Gazebo + ros2_control" : sensorsOf(g).length ? "Gazebo sensors" : "Gazebo");
  else if (arm) out.push("ros2_control");
  return out;
}

export const statusBadge = (g) => statusOf(g) === "active" ? h("span", { class: "st st-ok", text: "Course robot" }) : h("span", { class: "st st-test", text: "Under test" });

// the picture: the shipped one, else drawn once from the URDF when the card scrolls into view (one at a time)
let queue = Promise.resolve();
export function picture(g, cls = "cat-pic") {
  const fig = h("div", { class: cls });
  const img = h("img", { src: `img/robots/${g.id}.webp`, alt: g.title, loading: "lazy", width: "400", height: "300", decoding: "async" });
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

// "lidar", "camera", "IMU": the short name of a sensor for a line of text
export const sensorKind = (s) => ({ gpu_lidar: "lidar", lidar: "lidar", camera: "camera", rgbd_camera: "depth camera", depth_camera: "depth camera", imu: "IMU" }[s.type] || s.name || s.type);
