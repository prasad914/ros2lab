import { el } from "./dom.js";
import { mountHeroGraph } from "./hero-graph.js";
import { mountHeroTurtle } from "./hero-turtle.js";

// ---------- edit these when things change ----------
const OFFER_END = new Date("2026-12-31T23:59:59+05:30");          // founding batch: free until this moment (IST)
const YOUTUBE_CHANNEL_URL = "";                                     // paste your channel link, e.g. https://www.youtube.com/@YourHandle
const VIDEOS = [                                                     // your videos shown on the home page
  { id: "-tL0dp7Kloc", title: "What is ROS 2?" },
  { id: "Gl-4h24-dBg", title: "Your first ROS 2 workspace and node" },
  { id: "gMnB15pdLvw", title: "Publishers and subscribers" },
];

// Hero: drive a turtle with real ROS 2 commands
mountHeroTurtle(document.getElementById("hero-turtle"));

// Offer: show the days left; remove the offer text after the deadline
(() => {
  const days = Math.ceil((OFFER_END - Date.now()) / 86400000);
  const offer = document.getElementById("offer"), fin = document.getElementById("final-offer");
  if (days <= 0) { offer && offer.remove(); if (fin) fin.textContent = "Register today and start with Day 1: the terminal."; return; }
  if (offer && days <= 90) offer.lastElementChild.append(el("b", { class: "lp-days", text: ` (${days} day${days === 1 ? "" : "s"} left)` }));
  if (fin) fin.textContent = `Join the free founding batch (${days} day${days === 1 ? "" : "s"} left) and start with Day 1: the terminal.`;
})();

// YouTube: thumbnails first; the player loads only when tapped (fast on mobile data)
(() => {
  if (YOUTUBE_CHANNEL_URL) ["yt-channel", "yt-foot"].forEach((id) => { const a = document.getElementById(id); if (a) a.href = YOUTUBE_CHANNEL_URL; });
  const box = document.getElementById("yt-videos");
  if (!box) return;
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

// Sample certificate, drawn when the section scrolls into view
(() => {
  const host = document.getElementById("cert-sample");
  if (!host) return;
  new IntersectionObserver(async (entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    const { renderCertificate } = await import("./cert-render.js");
    const now = new Date(), until = new Date(now); until.setFullYear(until.getFullYear() + 2);
    const reg = new Date(now.getTime() - 45 * 86400000);
    const sig = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90"><path d="M10 62 C 30 20, 45 20, 52 58 S 70 80, 82 40 S 104 18, 112 52 S 132 70, 146 38 S 168 30, 176 56 S 200 66, 214 40 S 240 36, 252 50 L 290 46" fill="none" stroke="#1D2B53" stroke-width="3" stroke-linecap="round"/><path d="M30 76 L 270 70" stroke="#1D2B53" stroke-width="2"/></svg>');
    host.replaceChildren(renderCertificate({
      certId: "R2L-2026-SAMPLE0001", name: "Your Name Here", about: "Your programme, department and college, or your designation and workplace",
      registeredAt: reg, issuedAt: now, validUntil: until, course: "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes",
      modules: ["Week 1: Talk to the robot's computer", "Week 2: Build the robot's brain", "Week 3: Introduction to ROS", "Week 4: Speak ROS 2", "Week 5: ROS programming fundamentals", "Week 6: Writing your own ROS 2 nodes"],
      tests: [[16, 20], [13, 16], [12, 15], [14, 18], [13, 16], [15, 16]].map(([b, m], i) => ({ title: `Week ${i + 1} test`, best: b, max: m, pct: (b / m) * 100 })),
      testAverage: 82, projectTitle: "Your personal capstone project", projectScore: 88,
      signature: sig, instructor: "Course Instructor", instructorTitle: "ROS2Lab",
    }, { sample: true, verifyUrl: "https://www.ros2lab.com/certificate.html" }));
  }, { rootMargin: "300px" }).observe(host);
})();
import { GAMES, mountGame } from "./games/registry.js";
import { mountAnim, animById } from "./anims/registry.js";

// Hero: live ROS graph (does not need Firebase, so it always works)
mountHeroGraph(document.getElementById("hero-graph"));

// Concept lab: tabs of live animations, loaded only when the section scrolls into view
const LAB = ["pubsub", "service", "action", "params", "tf", "workspace"];
const labTabs = document.getElementById("lab-tabs"), labStage = document.getElementById("lab-stage");
function showLab(id) {
  labTabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === id ? "true" : "false"));
  mountAnim(labStage, id).catch(() => { labStage.textContent = "This animation could not load. Reload the page to try again."; });
}
labTabs.replaceChildren(...LAB.map((id) => { const a = animById(id); return el("button", { type: "button", class: "lab-tab", "data-id": id, "aria-pressed": "false", onclick: () => showLab(id) }, el("b", { text: a.title.split(":")[0] }), el("span", { class: "small", text: a.concept })); }));
new IntersectionObserver((entries, obs) => { if (!entries[0].isIntersecting) return; obs.disconnect(); showLab(LAB[0]); }, { rootMargin: "200px" }).observe(labStage);

// Playable demo, loaded only when it scrolls into view
const demo = document.getElementById("demo-game");
new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  obs.disconnect();
  mountGame(demo, "radio");
}, { rootMargin: "200px" }).observe(demo);

document.getElementById("game-links").replaceChildren(...GAMES.filter((g) => g.id !== "radio").map((g) =>
  el("li", {}, el("a", { href: `playground.html#${g.id}` }, el("span", { class: "gl-icon", "aria-hidden": "true", text: g.badgeIcon }),
    el("span", {}, el("b", { text: g.title }), el("span", { class: "small muted", text: g.concept }))))));

// Signed-in students see "Continue the course". Loaded last so a slow network never blocks the page.
(async () => {
  try {
    const [{ auth, onAuthStateChanged }, { getStage, signOutNow }] = await Promise.all([import("./fb.js"), import("./common.js")]);
    const slot = document.getElementById("signin-slot");
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const st = await getStage(user);
      const where = st.stage === "admin" ? "admin.html" : st.stage === "approved" ? "course.html" : "register.html";
      const label = st.stage === "admin" ? "Open the instructor dashboard" : st.stage === "approved" ? "Continue the course" : st.stage === "expired" ? "See my registration" : "Continue my registration";
      if (slot) slot.replaceChildren(el("a", { class: "btn", href: where, text: label }),
        el("button", { class: "btn btn-ghost", type: "button", onclick: signOutNow, text: "Log out" }));
      // Header: replace "Log in / Register" with the student's own links.
      const who = document.getElementById("who");
      if (who) who.replaceChildren(...[
        el("a", { class: "btn btn-small", href: where, text: st.stage === "admin" ? "Instructor" : st.stage === "approved" ? "My course" : "My registration" }),
        st.stage === "admin" ? null : el("a", { class: "btn btn-white btn-small", href: "account.html", text: "My account" }),
        el("button", { class: "btn btn-white btn-small", type: "button", onclick: signOutNow, text: "Log out" })].filter(Boolean));
    });
  } catch { /* offline: the Log in and Register buttons still work */ }
})();
