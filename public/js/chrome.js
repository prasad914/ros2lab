// The shared header's behaviour on every page (the markup is stamped into each HTML file by tools/build-chrome.mjs):
// the burger menu, the site search, --top-h for the sticky header, and the one place that fills #who.
// Signed out, #who keeps its static "Log in" + "Register free". Signed in, paintWho() shows the avatar and name with a
// menu (My course / Instructor / My registration, My account, Log out). common.js renderWho() calls paintWho() too.
import { el } from "./dom.js";

const ROOT = "/";   // the site is served from the domain root (Firebase Hosting, npm run dev)

// ---------- sticky header height → --top-h (scroll-padding-top, .lesson-top, .sidenav) ----------
const top = document.querySelector("header.top");
if (top) {
  const set = () => document.documentElement.style.setProperty("--top-h", `${top.offsetHeight}px`);
  set();
  if (typeof ResizeObserver === "function") new ResizeObserver(set).observe(top);
}

// ---------- burger menu (under 960 px) ----------
const nav = document.getElementById("nav"), burger = document.querySelector(".top .burger");
function setNav(open, focusBack) {
  if (!nav || !burger) return;
  nav.classList.toggle("open", open);
  burger.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) { const first = nav.querySelector("a"); if (first) first.focus(); }
  else if (focusBack) burger.focus();
}
if (burger) burger.addEventListener("click", () => setNav(!nav.classList.contains("open")));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (nav && nav.classList.contains("open")) setNav(false, true);
  closeAcct(true);
});
document.addEventListener("click", (e) => {
  if (nav && nav.classList.contains("open") && !e.target.closest("#nav, .top .burger")) setNav(false);
  if (!e.target.closest(".acct")) closeAcct(false);
});

// ---------- search: jump to a page or a week ----------
const PAGES = [
  ["All courses", "courses.html"],
  ["Certificate course (Weeks 1–6)", "plan.html"], ["Robot modelling & RViz (Weeks 7–9)", "modelling.html"],
  ["Week 1: Talk to the robot's computer", "plan.html#wk1"], ["Week 2: Build the robot's brain", "plan.html#wk2"],
  ["Week 3: Introduction to ROS", "plan.html#wk3"], ["Week 4: Speak ROS 2", "plan.html#wk4"],
  ["Week 5: ROS Programming Fundamentals", "plan.html#wk5"], ["Week 6: Writing your own ROS 2 nodes", "plan.html#wk6"],
  ["Week 7: Describe a robot with URDF", "modelling.html#wk7"], ["Week 8: Xacro, meshes and TF", "modelling.html#wk8"],
  ["Week 9: RViz, markers and interactive markers", "modelling.html#wk9"],
  ["Robot simulator", "rviz.html"], ["Playground: games and animations", "playground.html"],
  ["Practice terminal", "index.html#try"], ["Home", "index.html"], ["Student portal", "course.html"], ["My account", "account.html"], ["Verify a certificate", "certificate.html"],
  ["Free resources", "resources.html"], ["Help and questions", "index.html#faq"],
  ["Register", "register.html"], ["Log in", "signin.html"], ["Terms of Use", "terms.html"], ["Privacy notice", "privacy.html"],
];
const form = document.querySelector(".top form.search"), q = document.getElementById("site-q"), list = document.getElementById("site-pages");
if (list) list.replaceChildren(...PAGES.map(([label]) => el("option", { value: label })));
if (form && q) {
  q.addEventListener("input", () => q.setCustomValidity(""));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = q.value.trim().toLowerCase();
    if (!v) return;
    const wk = v.match(/^(?:week|wk|w)\s*(\d)$/);
    const hit = (wk && PAGES.find(([l]) => l.toLowerCase().startsWith(`week ${wk[1]}:`)))
      || PAGES.find(([l]) => l.toLowerCase() === v) || PAGES.find(([l]) => l.toLowerCase().includes(v));
    if (!hit) { q.setCustomValidity(`No page matches "${q.value.trim()}".`); q.reportValidity(); return; }
    location.href = ROOT + hit[1];
  });
}

// ---------- #who: the signed-in state ----------
let acct = null;
function closeAcct(focusBack) {
  if (!acct || acct.menu.hidden) return;
  acct.menu.hidden = true;
  acct.btn.setAttribute("aria-expanded", "false");
  if (focusBack) acct.btn.focus();
}
const STAGE_LINK = {
  admin: ["admin.html", "Instructor dashboard"], approved: ["course.html", "My course"],
  expired: ["register.html", "My registration"],
};

// stage: "admin" | "approved" | "pending" | … (common.js getStage); name/email shown in the menu
export function paintWho({ name, email, stage, admin, signOut }) {
  const slot = document.getElementById("who");
  if (!slot) return;
  const shown = String(name || email || "Signed in").trim();
  const [href, label] = STAGE_LINK[stage] || ["register.html", "My registration"];
  const btn = el("button", { class: "acct-btn", type: "button", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": `Account: ${shown}` },
    el("i", { "aria-hidden": "true", text: shown.charAt(0).toUpperCase() }), el("span", { text: shown.split(/\s+/)[0] }));
  const menu = el("div", { class: "acct-menu", hidden: true },
    el("p", {}, el("b", { text: shown }), email && email !== shown ? email : null),
    el("a", { href: ROOT + href, text: label }),
    admin && stage !== "admin" ? el("a", { href: `${ROOT}admin.html`, text: "Instructor dashboard" }) : null,
    stage === "admin" ? null : el("a", { href: `${ROOT}account.html`, text: "My account" }),
    el("button", { type: "button", text: "Log out", onclick: signOut }));
  btn.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { const first = menu.querySelector("a, button"); if (first) first.focus(); }
  });
  acct = { btn, menu };
  slot.dataset.state = "in";
  slot.replaceChildren(el("div", { class: "acct" }, btn, menu));
}

// "Register free" buttons in the page (<a data-reg>) say what a signed-in visitor does next, and the home page's
// sticky Register bar goes away. Pages that draw such a button later call paintReg() again.
let regStage = null;
const REG_LINK = {
  admin: ["admin.html", "Open the instructor dashboard"], approved: ["course.html", "Continue the course"],
  expired: ["register.html", "See my registration"],
};
export function paintReg(stage = regStage) {
  if (!stage || stage === "signedout") return;
  regStage = stage;
  const [href, label] = REG_LINK[stage] || ["register.html", "Continue my registration"];
  document.querySelectorAll("main [data-reg]").forEach((a) => { a.href = href; a.textContent = label; });
  document.querySelectorAll(".mcta").forEach((b) => { b.hidden = true; });
}

// Public pages learn the state here; member pages also paint it from requireMember() (common.js renderWho).
if (document.getElementById("who")) {
  (async () => {
    try {
      const [{ auth, onAuthStateChanged }, { getStage, signOutNow }] = await Promise.all([import("./fb.js"), import("./common.js")]);
      onAuthStateChanged(auth, async (user) => {
        const slot = document.getElementById("who");
        const reg = document.querySelector("main [data-reg], .mcta");
        if (!user || !slot || (slot.dataset.state === "in" && !reg)) return;
        const st = await getStage(user);
        paintReg(st.stage);
        if (slot.dataset.state === "in") return;
        const p = st.profile || {};
        paintWho({ name: p.fullName || user.displayName, email: user.email, stage: st.stage, admin: !!(st.claims && st.claims.admin), signOut: signOutNow });
      });
    } catch { /* offline: Log in and Register still work */ }
  })();
}
