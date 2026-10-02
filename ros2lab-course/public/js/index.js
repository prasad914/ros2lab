import { el } from "./dom.js";
import { mountHeroGraph } from "./hero-graph.js";
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
      const label = st.stage === "admin" ? "Open the instructor dashboard" : st.stage === "approved" ? "Continue the course" : "Continue my registration";
      slot.replaceChildren(el("a", { class: "btn", href: where, text: label }),
        el("button", { class: "btn btn-ghost", type: "button", onclick: signOutNow, text: "Sign out" }));
    });
  } catch { /* offline: the Register and Sign in buttons still work */ }
})();
