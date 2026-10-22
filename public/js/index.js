import { el } from "./dom.js";

// ---------- edit these when things change ----------
const OFFER_END = new Date("2026-12-31T23:59:59+05:30");          // founding batch: free until this moment (IST)
const YOUTUBE_CHANNEL_URL = "";                                     // paste your channel link, e.g. https://www.youtube.com/@YourHandle
const VIDEOS = [                                                     // your videos, shown under "Who teaches this" once the channel link is set
  { id: "-tL0dp7Kloc", title: "What is ROS 2?" },
  { id: "Gl-4h24-dBg", title: "Your first ROS 2 workspace and node" },
  { id: "gMnB15pdLvw", title: "Publishers and subscribers" },
];
// The practice computer (#try) is js/lab.js, a classic script loaded only on this page.

// load a stylesheet once (the sample certificate's CSS and fonts are fetched only when its section comes near)
const sheet = (href) => new Promise((res) => {
  if (document.querySelector(`link[href="${href}"]`)) return res();
  document.head.append(el("link", { rel: "stylesheet", href, onload: res, onerror: res }));
});
// run once when a section comes near the screen (keeps the first load small)
const near = (node, fn, margin = "400px") => { if (node) new IntersectionObserver((e, obs) => { if (!e[0].isIntersecting) return; obs.disconnect(); fn(); }, { rootMargin: margin }).observe(node); };

// Why ROS2Lab: the counts come from the data, not from the page text
near(document.getElementById("why"), async () => {
  try {
    const robots = await (await fetch("robots/index.json")).json();
    const n = document.getElementById("n-robots");
    if (n && Array.isArray(robots) && robots.length) { n.textContent = `${robots.length} `; n.parentElement.lastChild.textContent = "robots to explore"; }
  } catch { /* offline: the heading reads "Robots to explore" */ }
  try {
    const [{ GAMES }, { ANIMS }] = await Promise.all([import("./games/registry.js"), import("./anims/registry.js")]);
    const games = GAMES.filter((g) => g.load).length, anims = ANIMS.length;   // games without load() are locked placeholders
    const p = document.getElementById("n-play");
    if (p) p.textContent = `${games} short games with badges and ${anims} animations that show each idea before you type it.`;
  } catch { /* the sentence without numbers stays */ }
});

// Offer: after the deadline, remove the "register by 31 Dec" lines
if (Date.now() > OFFER_END) document.querySelectorAll("[data-offer]").forEach((n) => n.remove());

// Gazebo: a TurtleBot3 in the practice world. It starts by itself on a computer when the section scrolls into view;
// on a phone, with data saving or with reduced motion on, it waits for the button (about 3 MB to download, compressed).
(() => {
  const box = document.getElementById("home-gazebo"), btn = document.getElementById("gz-start"), status = document.getElementById("gz-status");
  if (!box || !btn) return;
  let started = false;
  const start = async () => {
    if (started) return; started = true; btn.disabled = true; btn.textContent = "Loading…";
    try {
      const { mountHomeGazebo } = await import("./home-gazebo.js");
      window.__homeGz = await mountHomeGazebo(box, { onStatus: (t) => { if (status && t) status.textContent = t; } });
    } catch (e) {
      // the poster is back in place: say why, in a way the visitor can act on
      btn.textContent = "Try again"; btn.disabled = false; started = false;
      if (e && e.message === "webgl") { btn.hidden = true; if (status) status.textContent = "This browser has 3D graphics (WebGL) turned off, so Gazebo cannot run here. Turn on hardware acceleration in its settings, or try another browser."; }
      else if (status) status.textContent = "Gazebo could not load. Check your connection and try again, or open the simulator.";
    }
  };
  btn.addEventListener("click", start);
  const light = (navigator.connection && navigator.connection.saveData) || matchMedia("(max-width: 700px)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!light) new IntersectionObserver((e, obs) => { if (!e[0].isIntersecting) return; obs.disconnect(); start(); }, { rootMargin: "120px" }).observe(box);
  // a few of the simulator's robots, each opening in its own window there
  const strip = document.getElementById("gz-robots");
  if (strip) strip.replaceChildren(...[["ur5e", "UR5e"], ["fr3", "Franka FR3"], ["go2", "Unitree Go2"], ["spot", "Spot"], ["g1", "Unitree G1"], ["crazyflie", "Crazyflie"], ["kr6", "KUKA KR 6"], ["tb3_waffle", "TurtleBot3"]].map(([id, name]) =>
    el("li", {}, el("a", { href: `rviz.html?robot=${id}`, title: `${name}: open it in the simulator` }, el("img", { src: `img/robots/${id}.webp`, alt: "", width: "120", height: "90", loading: "lazy" }), el("span", { text: name })))));
})();

// YouTube: only once the channel link is set. Thumbnails first; the player loads only when tapped (fast on mobile data)
(() => {
  if (!YOUTUBE_CHANNEL_URL) return;
  ["yt-channel", "yt-foot"].forEach((id) => { const a = document.getElementById(id); if (a) a.href = YOUTUBE_CHANNEL_URL; });
  const box = document.getElementById("yt-videos");
  if (!box) return;
  box.hidden = false;
  box.replaceChildren(...VIDEOS.map((v, i) => {
    const btn = el("button", { type: "button", class: `lp-video${i === 0 ? " big" : ""}`, "aria-label": `Play: ${v.title}` },
      el("img", { src: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, alt: "", loading: "lazy", width: "480", height: "360" }),
      el("span", { class: "lp-play", "aria-hidden": "true" }), el("span", { class: "lp-vtitle", text: v.title }));
    btn.addEventListener("click", () => {
      btn.replaceWith(el("div", { class: `lp-video${i === 0 ? " big" : ""} playing` }, el("iframe", {
        src: `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`, title: v.title, allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true, loading: "lazy" })));
    });
    return btn;
  }));
})();

// Sample certificate, drawn with the site's own renderer when the section scrolls into view
(() => {
  const host = document.getElementById("cert-mini");
  if (!host) return;
  new IntersectionObserver(async (entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    const [{ renderCertificate }] = await Promise.all([import("./cert-render.js"), sheet("css/certificate.css"),
      sheet("https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap")]);
    const now = new Date(), until = new Date(now); until.setFullYear(until.getFullYear() + 2);
    const reg = new Date(now.getTime() - 45 * 86400000);
    const sig = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90"><path d="M10 62 C 30 20, 45 20, 52 58 S 70 80, 82 40 S 104 18, 112 52 S 132 70, 146 38 S 168 30, 176 56 S 200 66, 214 40 S 240 36, 252 50 L 290 46" fill="none" stroke="#1D2B53" stroke-width="3" stroke-linecap="round"/><path d="M30 76 L 270 70" stroke="#1D2B53" stroke-width="2"/></svg>');
    host.replaceChildren(renderCertificate({
      certId: "R2L-2026-SAMPLE0001", name: "Your Name Here", about: "Your programme, department and college, or your designation and workplace",
      registeredAt: reg, issuedAt: now, validUntil: until, course: "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes",
      modules: ["Week 1: Talk to the robot's computer", "Week 2: Build the robot's brain", "Week 3: Introduction to ROS", "Week 4: Speak ROS 2", "Week 5: ROS programming fundamentals", "Week 6: Writing your own ROS 2 nodes"],
      tests: [[16, 20], [13, 16], [12, 15], [14, 18], [13, 16], [15, 16]].map(([b, m], i) => ({ title: `Week ${i + 1} test`, best: b, max: m, pct: (b / m) * 100 })),
      testAverage: 82, projectTitle: "Your personal capstone project", projectScore: 88,
      signature: sig, instructor: "Robotics & ROS 2 Lab", instructorTitle: "Course team, ROS2Lab",   // docs/redesign/certificate/CHANGES.md item 4
    }, { sample: true, verifyUrl: "https://www.ros2lab.com/certificate.html" }));
  }, { rootMargin: "300px" }).observe(host);
})();

// Signed-in students see "Continue the course" instead of "Register free": js/chrome.js paintReg().
