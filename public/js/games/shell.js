// Shared frame for every mini-game: title, goal, stage, feedback and the win screen (a rubber stamp).
// The frame stays quiet; each game's stage carries its own picture (css/games/<id>.css).
import { el, rich } from "../dom.js";
import { INKS, stamp, svgNode } from "./art.js";

const BADGE_KEY = "ros2lab-badges";

export function badges() {
  try { return JSON.parse(localStorage.getItem(BADGE_KEY) || "{}"); } catch { return {}; }
}
function saveBadge(id) {
  try { const b = badges(); b[id] = Date.now(); localStorage.setItem(BADGE_KEY, JSON.stringify(b)); } catch { /* storage off */ }
}

// meta: { id, title, concept, badge, goal }
// returns { stage, say(text, kind), win(text, command), setGoal(text), onRestart(fn) }
export function shell(container, meta, { onWin } = {}) {
  useCss("shell");
  const stage = el("div", { class: "game-stage" });
  const fb = el("div", { class: "game-fb", "aria-live": "polite" });
  const goal = el("p", { class: "game-goal" }, rich(meta.goal || ""));
  const restart = el("button", { class: "btn btn-white btn-small", type: "button", text: "Start again" });
  const winBox = el("div", { class: "game-win", hidden: true });
  const root = el("section", { class: "game", "data-game": meta.id, style: `--g-ink: ${INKS[meta.id] || "var(--ink)"}` },
    el("header", { class: "game-head" },
      el("div", {}, el("h3", { text: meta.title }), el("span", { class: "game-concept", text: meta.concept })),
      restart),
    goal, stage, fb, winBox);
  container.replaceChildren(root);

  let restartFn = null;
  let won = false;
  restart.addEventListener("click", () => { winBox.hidden = true; fb.replaceChildren(); fb.className = "game-fb"; won = false; restartFn && restartFn(); });

  return {
    root, stage,
    say(text, kind = "info") { fb.className = `game-fb ${kind}`; fb.replaceChildren(rich(text)); },
    clear() { fb.className = "game-fb"; fb.replaceChildren(); },
    setGoal(text) { goal.replaceChildren(rich(text)); },
    onRestart(fn) { restartFn = fn; },
    win(text, command) {
      if (won) return;
      won = true;
      saveBadge(meta.id);
      winBox.replaceChildren(
        el("div", { class: "game-badge game-stamp", "aria-hidden": "true" }, svgNode(stamp(meta))),
        el("div", {},
          el("strong", { text: `Badge earned: ${meta.badge}` }),
          el("p", {}, rich(text)),
          command ? el("div", {}, el("span", { class: "small muted", text: "Try it in a real terminal:" }), el("pre", { class: "code game-cmd", text: command })) : null));
      winBox.hidden = false;
      winBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
      onWin && onWin();
    },
  };
}

// a game's own stylesheet (css/games/<id>.css), linked once
export function useCss(id) {
  const href = new URL(`../../css/games/${id}.css`, import.meta.url).href;
  if ([...document.querySelectorAll("link[rel=stylesheet]")].some((l) => l.href === href)) return;
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
}
export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// small helpers shared by games
export const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
