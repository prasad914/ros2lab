import { el } from "./dom.js";
import { GAMES, gameById, mountGame } from "./games/registry.js";
import { badges } from "./games/shell.js";
import { ANIMS, animById, mountAnim } from "./anims/registry.js";

const pick = document.getElementById("pick");
const stage = document.getElementById("stage");
const shelf = document.getElementById("shelf");

function paintShelf() {
  const got = badges();
  shelf.replaceChildren(...GAMES.map((g) => el("div", { class: `shelf-badge${got[g.id] ? " got" : ""}`, title: got[g.id] ? `${g.badge}: earned` : `${g.badge}: not earned yet` },
    el("span", { class: "sb-icon", "aria-hidden": "true", text: g.badgeIcon }), el("span", { class: "sb-name", text: g.badge }))));
  const n = GAMES.filter((g) => got[g.id]).length;
  shelf.append(el("p", { class: "shelf-count", text: n === GAMES.length ? "All six badges. You are ready for real ROS 2!" : `${n} of ${GAMES.length} badges earned` }));
}

function paintPick(active) {
  const got = badges();
  pick.replaceChildren(...GAMES.map((g) => el("a", { href: `#${g.id}`, class: `pg-tile${g.id === active ? " on" : ""}`, "aria-current": g.id === active ? "true" : null },
    el("span", { class: "pg-icon", "aria-hidden": "true", text: g.badgeIcon }),
    el("span", { class: "pg-text" }, el("b", { text: g.title }), el("span", { class: "small", text: g.concept })),
    el("span", { class: "pg-when small", text: got[g.id] ? "✓ Done" : `Week ${g.week}` }))));
}

// Concept lab: animation tiles; #lab-<id> opens one directly
const animPick = document.getElementById("anim-pick"), animStage = document.getElementById("anim-stage");
function showAnim(id, scroll) {
  animPick.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.dataset.id === id));
  mountAnim(animStage, id).then(() => { if (scroll) animStage.scrollIntoView({ block: "start", behavior: "smooth" }); });
}
animPick.replaceChildren(...ANIMS.map((a) => el("a", { href: `#lab-${a.id}`, class: "pg-tile", "data-id": a.id },
  el("span", { class: "pg-icon", "aria-hidden": "true", text: "▶" }),
  el("span", { class: "pg-text" }, el("b", { text: a.title }), el("span", { class: "small", text: a.concept })),
  el("span", { class: "pg-when small", text: `Week ${a.week}` }))));

async function show() {
  const lab = location.hash.match(/^#lab-(\w+)$/);
  if (lab && animById(lab[1])) { showAnim(lab[1], true); if (stage.childElementCount) return; }
  const id = gameById(location.hash.slice(1)) ? location.hash.slice(1) : GAMES[0].id;
  paintPick(id);
  stage.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
  await mountGame(stage, id, { onWin: () => { paintShelf(); paintPick(id); } });
  if (location.hash && !lab) stage.scrollIntoView({ block: "start", behavior: "smooth" });
}
new IntersectionObserver((entries, obs) => { if (!entries[0].isIntersecting) return; obs.disconnect(); if (!animStage.childElementCount) showAnim("pubsub", false); }, { rootMargin: "100px" }).observe(animStage);
addEventListener("hashchange", show);
paintShelf();
show();
