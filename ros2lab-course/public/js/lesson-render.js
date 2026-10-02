// Builds a lesson page from content blocks. No Firebase here.
import { el, rich } from "./dom.js";
import { mountTerminal } from "./terminal-sim.js";
import { mountPython } from "./pyrun.js";
import { mountGame, gameById } from "./games/registry.js";
import { mountAnim } from "./anims/registry.js";
import { trace, match, sort, bug, think, cards } from "./puzzles.js";

const LETTERS = "ABCDEFGH";
const shuffleCopy = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const norm = (s) => String(s ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim().replace(/\s*\|\s*/g, " | ").replace(/\s+/g, " ");

export function renderLesson(root, lesson, { onChange } = {}) {
  const activities = [];
  const track = () => { const a = { done: false }; activities.push(a); return () => { if (!a.done) { a.done = true; onChange && onChange(status()); } }; };
  const status = () => ({ total: activities.length, done: activities.filter((a) => a.done).length });

  let checkNo = 0;
  for (const b of lesson.blocks || []) {
    switch (b.t) {
      case "h": root.append(el("h2", {}, rich(b.text))); break;
      case "p": root.append(el("p", {}, rich(b.text))); break;
      case "list": root.append(el("ul", {}, (b.items || []).map((i) => el("li", {}, rich(i))))); break;
      case "steps": root.append(el("ol", { class: "steps-list" }, (b.items || []).map((i) => el("li", {}, rich(i))))); break;
      case "analogy": case "tip": case "warn": case "story": case "goal":
        root.append(el("div", { class: `callout ${b.t}` },
          el("span", { class: "label", text: b.label || { analogy: "Think of it like this", tip: "Good to know", warn: "Be careful", story: "Today's story", goal: "By the end of this lesson you can" }[b.t] }),
          b.items ? el("ul", { style: { margin: 0, paddingLeft: "1.2em" } }, b.items.map((i) => el("li", {}, rich(i)))) : el("p", {}, rich(b.text))));
        break;
      case "twin":
        root.append(el("div", { class: "twin" }, [b.left, b.right].map((side) => el("div", {},
          el("div", { class: "twin-label", text: side.label }), codeBlock(side.code, side.lang)))));
        break;
      case "checklist": {
        const done = track();
        const boxes = (b.items || []).map((it, i) => {
          const id = `cl-${Math.random().toString(36).slice(2, 8)}-${i}`;
          return el("li", {}, el("input", { type: "checkbox", id }), el("label", { class: "cl-text", for: id }, rich(it)));
        });
        const list = el("ul", {}, boxes);
        list.addEventListener("change", () => { if (boxes.every((li) => li.querySelector("input").checked)) done(); });
        root.append(el("section", { class: "checklist" }, el("h3", { text: b.title || "Checklist" }), list));
        break;
      }
      case "words":
        root.append(el("div", { class: "callout" }, el("span", { class: "label", text: b.label || "New words" }),
          el("ul", { style: { margin: 0, paddingLeft: "1.2em" } }, (b.items || []).map((it) => { const [w, m] = Array.isArray(it) ? it : [it.w, it.m]; return el("li", {}, el("strong", { text: w }), ": ", rich(m)); }))));
        break;
      case "code": {
        root.append(codeBlock(b.text, b.lang, b.copy));
        if (b.out) root.append(el("div", { class: "figure-out", text: b.out }));
        break;
      }
      case "recap":
        root.append(el("div", { class: "recap" }, el("h3", { text: b.title || "Remember" }), el("ul", {}, (b.items || []).map((i) => el("li", {}, el("span", {}, rich(i)))))));
        break;
      case "term": {
        const done = b.tasks && b.tasks.length ? track() : null;
        const slot = el("div");
        root.append(slot);
        mountTerminal(slot, b, { onComplete: done });
        break;
      }
      case "py": {
        const done = b.expect != null || b.contains ? track() : null;
        const slot = el("div");
        root.append(slot);
        mountPython(slot, b, { onComplete: done });
        break;
      }
      case "game": {
        // { t: "game", id: "radio", bonus: true, intro: "..." }. A bonus game does not block lesson completion.
        const done = b.bonus ? null : track();
        const meta = gameById(b.id);
        const slot = el("div");
        root.append(el("section", { class: "lesson-game" },
          b.intro ? el("p", {}, rich(b.intro)) : null,
          b.bonus ? el("div", { class: "bonus-note", text: `Bonus game${meta ? `: ${meta.title}` : ""} (optional, but fun)` }) : null, slot));
        mountGame(slot, b.id, { onWin: done || undefined }).catch(() => { slot.textContent = "This game could not load. Reload the page to try again."; done && done(); });
        break;
      }
      case "links":
        // { t: "links", label: "Go deeper", items: [{ title, url, note }] }
        root.append(el("aside", { class: "links-box" }, el("span", { class: "label", text: b.label || "Go deeper (free resources)" }),
          el("ul", {}, (b.items || []).filter((it) => /^https:\/\//.test(it.url || "")).map((it) => el("li", {},
            el("a", { href: it.url, target: "_blank", rel: "noopener", text: it.title }), it.note ? el("span", { class: "small" }, " ", rich(it.note)) : null)))));
        break;
      case "anim": {
        // { t: "anim", id: "pubsub", intro: "..." }. Animations never block lesson completion.
        const slot = el("div");
        root.append(el("section", { class: "lesson-anim" }, b.intro ? el("p", {}, rich(b.intro)) : null, slot));
        mountAnim(slot, b.id).catch(() => { slot.textContent = "This animation could not load. Reload the page to try again."; });
        break;
      }
      case "trace": root.append(trace(b)); break;
      case "think": root.append(think(b)); break;
      case "cards": root.append(cards(b)); break;
      case "match": root.append(match(b, track())); break;
      case "sort": root.append(sort(b, track())); break;
      case "bug": root.append(bug(b, track())); break;
      case "mcq": root.append(mcq(b, ++checkNo, track())); break;
      case "fill": root.append(fill(b, ++checkNo, track())); break;
      case "order": root.append(order(b, ++checkNo, track())); break;
      default: break;
    }
  }
  return status;
}

// Code with grey comments; optional Copy button (used for real install commands).
function codeBlock(text, lang, copy) {
  const pre = el("pre", { class: "code", "aria-label": lang === "bash" ? "Terminal commands" : "Code" });
  const cm = lang === "cpp" ? "  //" : "  #";
  for (const line of String(text).split("\n")) {
    const at = line.indexOf(cm);
    if (at > 0) pre.append(document.createTextNode(line.slice(0, at)), el("span", { class: "cm", text: line.slice(at) }), "\n");
    else pre.append(document.createTextNode(line + "\n"));
  }
  if (!copy) return pre;
  const btn = el("button", { class: "copy-btn", type: "button", text: "Copy" });
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(String(text)); btn.textContent = "Copied"; }
    catch { btn.textContent = "Select and type it"; }
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  });
  return el("div", { class: "code-wrap" }, pre, btn);
}

function checkShell(no, title, body) {
  return el("section", { class: "check" }, el("div", { class: "check-head" }, el("span", { text: `Quick check ${no}` }), el("span", { class: "muted", text: title || "" })), body);
}

function mcq(b, no, done) {
  const fb = el("div", { class: "fb", hidden: true, "aria-live": "polite" });
  const opts = el("div", { class: "opts" });
  const order = b.options.map((o, i) => ({ o, i }));
  order.forEach(({ o, i }, k) => {
    const btn = el("button", { class: "opt", type: "button" }, el("span", { class: "k", text: LETTERS[k] }), el("span", {}, rich(o)));
    btn.addEventListener("click", () => {
      if (i === b.answer) {
        btn.classList.add("right");
        opts.querySelectorAll(".opt").forEach((x) => (x.disabled = true));
        fb.className = "fb ok"; fb.replaceChildren(el("strong", { text: "Correct. " }), rich(b.why || "")); fb.hidden = false;
        done();
      } else {
        btn.classList.add("wrong"); btn.disabled = true;
        fb.className = "fb no"; fb.replaceChildren(el("strong", { text: "Not quite. " }), rich((b.hints && b.hints[i]) || b.hint || "Read the question again and try another answer.")); fb.hidden = false;
      }
    });
    opts.append(btn);
  });
  return checkShell(no, "Choose one answer", el("div", { class: "check-body" }, el("div", { class: "check-q" }, rich(b.q)), b.code ? el("pre", { class: "code", text: b.code }) : null, opts, fb));
}

function fill(b, no, done) {
  const input = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Your answer", placeholder: b.placeholder || "Type your answer" });
  const btn = el("button", { class: "btn btn-small", type: "button", text: "Check" });
  const fb = el("div", { class: "fb", hidden: true, "aria-live": "polite" });
  let tries = 0;
  const reveal = el("button", { class: "btn btn-white btn-small", type: "button", text: "Show me the answer", hidden: true });
  const check = () => {
    const ok = [].concat(b.accept).some((a) => norm(a) === norm(input.value));
    tries++;
    if (ok) {
      input.disabled = true; btn.disabled = true; reveal.hidden = true;
      fb.className = "fb ok"; fb.replaceChildren(el("strong", { text: "Correct. " }), rich(b.why || "")); fb.hidden = false; done();
    } else {
      fb.className = "fb no"; fb.replaceChildren(el("strong", { text: "Not yet. " }), rich(b.hint || "Check spaces and spelling, then try again.")); fb.hidden = false;
      if (tries >= 3) reveal.hidden = false;
    }
  };
  btn.addEventListener("click", check);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  reveal.addEventListener("click", () => {
    input.value = [].concat(b.accept)[0]; input.disabled = true; btn.disabled = true; reveal.hidden = true;
    fb.className = "fb ok"; fb.replaceChildren(el("strong", { text: "Answer: " }), el("code", { text: [].concat(b.accept)[0] }), document.createTextNode(". "), rich(b.why || "")); fb.hidden = false; done();
  });
  return checkShell(no, "Type the answer", el("div", { class: "check-body" }, el("div", { class: "check-q" }, rich(b.q)), b.code ? el("pre", { class: "code", text: b.code }) : null,
    el("div", { class: "text-answer" }, input, btn, reveal), fb));
}

function order(b, no, done) {
  let items = shuffleCopy(b.items);
  for (let k = 0; k < 5 && items.join("|") === b.items.join("|"); k++) items = shuffleCopy(b.items);
  const list = el("ol", { class: "order-list" });
  const fb = el("div", { class: "fb", hidden: true, "aria-live": "polite" });
  const btn = el("button", { class: "btn btn-small", type: "button", text: "Check order" });
  const paint = () => {
    list.replaceChildren(...items.map((it, i) => el("li", {},
      el("span", { class: "t" }, rich(it)),
      el("button", { type: "button", "aria-label": "Move up", disabled: i === 0 || btn.disabled, text: "↑", onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; paint(); } }),
      el("button", { type: "button", "aria-label": "Move down", disabled: i === items.length - 1 || btn.disabled, text: "↓", onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; paint(); } }))));
  };
  btn.addEventListener("click", () => {
    if (items.join("|") === b.items.join("|")) {
      btn.disabled = true; paint();
      fb.className = "fb ok"; fb.replaceChildren(el("strong", { text: "Correct order. " }), rich(b.why || "")); fb.hidden = false; done();
    } else {
      const firstWrong = items.findIndex((x, i) => x !== b.items[i]);
      fb.className = "fb no"; fb.replaceChildren(el("strong", { text: "Not yet. " }), document.createTextNode(`Line ${firstWrong + 1} is not in the right place. `), rich(b.hint || "")); fb.hidden = false;
    }
  });
  paint();
  return checkShell(no, "Put in order with ↑ ↓", el("div", { class: "check-body" }, el("div", { class: "check-q" }, rich(b.q)), list, btn, fb));
}
