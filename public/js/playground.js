import { el } from "./dom.js";
import { GAMES, LEVELS, NOT_VALIDATED, gameById, mountGame } from "./games/registry.js";
import { badges } from "./games/shell.js";
import { scene, glyph, stamp, svgNode, INKS } from "./games/art.js";
import { ANIMS, animById, mountAnim } from "./anims/registry.js";

const pick = document.getElementById("pick");
const stage = document.getElementById("stage");
const metaBar = document.getElementById("game-meta");
const card = document.getElementById("shelf");
const LAST_KEY = "ros2lab-pg-last";
const DEFAULT_GAME = GAMES[0].id;

// per-viewer conveniences only (badges live in games/shell.js): the last game opened
const lastGame = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };
const rememberGame = (id) => { try { localStorage.setItem(LAST_KEY, id); } catch { /* storage off */ } };
const where = (g) => (g.week > 6 ? "with the Simulator" : `Week ${g.week}, ${g.lesson}`);
const tilts = [-9, 6, -4, 10, -7, 3];

// the badge card: one slot per playable game (placeholders without a game have no badge yet); an earned badge is a
// rubber stamp in the game's ink, the rest are outlines
const PLAYABLE = GAMES.filter((g) => g.load);
function paintCard() {
  const got = badges(), n = PLAYABLE.filter((g) => got[g.id]).length;
  card.replaceChildren(
    el("div", { class: "pg-card-head" }, el("b", { text: "Badge card" }), el("span", { text: `${n} of ${PLAYABLE.length}` })),
    el("ul", { class: "pg-slots" }, PLAYABLE.map((g, k) => el("li", { class: `pg-slot${got[g.id] ? " got" : ""}`, title: `${g.badge}: ${got[g.id] ? "earned" : "not earned yet"}`, style: `color: ${INKS[g.id]}` },
      got[g.id] ? svgNode(stamp(g, { tilt: tilts[k % tilts.length] })) : el("span", { class: "pg-slot-empty" }, svgNode(glyph(g.id))),
      el("span", { class: "pg-slot-name", text: g.badge }),
      el("span", { class: "sr-only", text: got[g.id] ? " (earned)" : " (not earned yet)" })))),
    el("p", { class: "pg-card-note", text: n === PLAYABLE.length ? "Every stamp collected. You are ready for real ROS 2 on Ubuntu." : "Win a game to stamp its badge. Badges are saved in this browser." }));
}

// the collection, in course order: the playable games as cards (week · day, title, one line, badge, Play), then the
// locked robot missions in a collapsed "Robot missions" section (opened when the hash names one of them)
function paintPick(active) {
  const got = badges();
  const tile = (g) => el("li", {},
    el("a", { href: `#${g.id}`, class: `pg-tile${g.id === active ? " on" : ""}${got[g.id] ? " done" : ""}`, style: `--g-ink: ${INKS[g.id]}`, "aria-current": g.id === active ? "true" : null,
      "aria-label": `${g.title}. ${g.concept}. ${g.load ? `${where(g)}, ${LEVELS[g.level]}, about ${g.minutes} minutes` : `Locked: ${NOT_VALIDATED}`}${got[g.id] ? ". Badge earned" : ""}` },
      g.load ? el("span", { class: "pg-art" }, svgNode(scene(g.id))) : null,
      el("span", { class: "pg-text" },
        el("span", { class: "pg-where", "aria-hidden": "true", text: `${g.week > 6 ? "With the Simulator" : `Week ${g.week}`} · ${g.lesson}` }),
        el("b", { text: g.title }), el("span", { class: "pg-concept", text: g.blurb || g.concept }),
        g.load ? el("span", { class: "pg-badge", "aria-hidden": "true", text: `Badge: ${g.badge}` })
          : el("span", { class: "st st-test pg-lock", "aria-hidden": "true", text: NOT_VALIDATED })),
      g.load ? el("span", { class: "pg-play", "aria-hidden": "true", text: "Play ›" }) : null,
      got[g.id] ? el("span", { class: "pg-done", "aria-hidden": "true" }, svgNode(glyph(g.id))) : null));
  const locked = GAMES.filter((g) => !g.load);
  const wasOpen = !!pick.querySelector("details.pg-more[open]");
  pick.replaceChildren(el("ul", { class: "pg-row" }, PLAYABLE.map(tile)),
    locked.length ? el("details", { class: "pg-more", open: wasOpen || locked.some((g) => g.id === active) },
      el("summary", {}, "Robot missions ", el("span", { class: "meta", text: `(${locked.length}, not yet validated)` })),
      el("p", { class: "meta", text: "Each mission opens when it has a real game that passed its tests against real ROS 2. Until then it is marked “Not yet validated”." }),
      el("ul", { class: "pg-row locked" }, locked.map(tile))) : null);
}

// above the game: where it sits in the course, how long it takes, and the neighbours
function paintMeta(g) {
  const i = GAMES.indexOf(g), prev = GAMES[i - 1], next = GAMES[i + 1];
  metaBar.replaceChildren(
    el("dl", { class: "pg-facts" },
      el("div", {}, el("dt", { text: "In the course" }), el("dd", { text: where(g) })),
      el("div", {}, el("dt", { text: "Level" }), el("dd", { text: LEVELS[g.level] })),
      el("div", {}, el("dt", { text: "Time" }), el("dd", { text: `about ${g.minutes} min` })),
      el("div", {}, el("dt", { text: "Badge" }), el("dd", { text: g.badge }))),
    el("nav", { class: "pg-meta-nav", "aria-label": "Other games" },
      prev ? el("a", { class: "btn btn-white btn-small", href: `#${prev.id}`, "aria-label": `Previous game: ${prev.title}` }, el("span", { "aria-hidden": "true", text: "←" }), el("span", { text: prev.title })) : null,
      next ? el("a", { class: "btn btn-white btn-small", href: `#${next.id}`, "aria-label": `Next game: ${next.title}` }, el("span", { text: next.title }), el("span", { "aria-hidden": "true", text: "→" })) : null));
}

// Concept lab: the animations grouped by course week; #lab-<id> opens one directly
const animPick = document.getElementById("anim-pick"), animStage = document.getElementById("anim-stage");
let labChosen = false;
function showAnim(id, scroll) {
  labChosen = true;
  animPick.querySelectorAll("a").forEach((a) => { const on = a.dataset.id === id; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  mountAnim(animStage, id).then(() => { if (scroll) animStage.scrollIntoView({ block: "start", behavior: "smooth" }); });
}
const weeks = [...new Set(ANIMS.map((a) => a.week))].sort((a, b) => a - b);
animPick.replaceChildren(...weeks.map((w) => el("section", { class: "lab-week" },
  el("h3", { text: `Week ${w}` }),
  el("ul", {}, ANIMS.filter((a) => a.week === w).map((a) => el("li", {}, el("a", { href: `#lab-${a.id}`, class: "lab-link", "data-id": a.id },
    el("b", { text: a.title }), el("span", { text: a.concept }))))))));

let mounted = null;
async function show() {
  const lab = location.hash.match(/^#lab-(\w+)$/);
  if (lab && animById(lab[1])) { showAnim(lab[1], true); if (stage.childElementCount) return; }
  const fromHash = gameById(location.hash.slice(1));
  const id = fromHash ? fromHash.id : gameById(lastGame()) ? lastGame() : DEFAULT_GAME;
  const g = gameById(id);
  paintPick(id);
  if (mounted === id && stage.childElementCount) return;
  mounted = id;
  rememberGame(id);
  paintMeta(g);
  stage.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
  await mountGame(stage, id, { onWin: () => { paintCard(); paintPick(id); } });
  if (fromHash) metaBar.scrollIntoView({ block: "start", behavior: "smooth" });
}
new IntersectionObserver((entries, obs) => { if (!entries[0].isIntersecting) return; obs.disconnect(); if (!labChosen) showAnim("pubsub", false); }, { rootMargin: "100px" }).observe(animStage);
addEventListener("hashchange", show);
paintCard();
show();
