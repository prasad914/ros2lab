// Interactive learning blocks: code tracer, matching, sorting, spot-the-bug, think-first and flashcards.
// All data is plain objects and lists (Firestore cannot store lists inside lists).
import { el, rich } from "./dom.js";

const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const fbBox = () => el("div", { class: "fb", hidden: true, "aria-live": "polite" });
const say = (fb, kind, head, text) => { fb.className = `fb ${kind}`; fb.replaceChildren(el("strong", { text: head }), rich(text || "")); fb.hidden = false; };

// each kind of puzzle has its own small drawing and ink (css/games/puzzles.css, linked once)
(function linkCss() {
  if (typeof document === "undefined") return;
  const href = new URL("../css/games/puzzles.css", import.meta.url).href;
  if ([...document.querySelectorAll("link[rel=stylesheet]")].some((l) => l.href === href)) return;
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href }));
})();
const GLYPH = {
  trace: '<path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/><path d="M12 9v6" stroke-width="2.6"/>',
  match: '<circle cx="5" cy="7" r="2.2"/><circle cx="19" cy="17" r="2.2"/><circle cx="5" cy="17" r="2.2"/><circle cx="19" cy="7" r="2.2"/><path d="M7.2 7.6l9.6 8.8M7.2 16.4l9.6-8.8"/>',
  sort: '<rect x="8" y="2.5" width="8" height="5" rx="1"/><path d="M2.5 12v6h6v-6M15.5 12v6h6v-6M12 8.5v3"/>',
  bug: '<ellipse cx="12" cy="14" rx="5" ry="6"/><path d="M12 8v12M9 6.5L7.5 4M15 6.5L16.5 4M7 12H3.5M7 16l-3 1.5M17 12h3.5M17 16l3 1.5"/>',
  think: '<path d="M9 17h6M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3.5z"/>',
  cards: '<rect x="3" y="6" width="12" height="15" rx="1.5" transform="rotate(-8 9 13)"/><rect x="9" y="3.5" width="12" height="15" rx="1.5"/>',
};
function card(kind, title, sub, ...body) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  g.setAttribute("viewBox", "0 0 24 24"); g.setAttribute("aria-hidden", "true"); g.setAttribute("class", "pzl-glyph");
  g.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPH[kind] || ""}</g>`;
  return el("section", { class: `pzl pzl-${kind}` }, el("div", { class: "pzl-head" }, el("span", { class: "pzl-kind" }, g, el("span", { text: title })), sub ? el("span", { class: "muted pzl-sub", text: sub }) : null), el("div", { class: "pzl-body" }, ...body));
}

// ---------- trace: step through code and watch the variables ----------
// { t: "trace", title, lang, code, steps: [{ line: 1, vars: { x: "3" }, out: "text printed at this step", note: "what happens" }] }
export function trace(b) {
  const lines = String(b.code).split("\n");
  const steps = b.steps || [];
  let i = -1, timer = null;
  const codeEl = el("ol", { class: "tr-code" }, lines.map((l) => el("li", {}, el("code", { text: l || " " }))));
  const varsEl = el("table", { class: "tr-vars" });
  const outEl = el("pre", { class: "tr-out" });
  const note = el("div", { class: "tr-note", "aria-live": "polite" });
  const count = el("span", { class: "muted small" });
  const prev = el("button", { type: "button", class: "btn btn-white btn-small", text: "◀ Back" });
  const next = el("button", { type: "button", class: "btn btn-small", text: "Step ▶" });
  const auto = el("button", { type: "button", class: "btn btn-white btn-small", text: "Play" });
  const reset = el("button", { type: "button", class: "btn btn-white btn-small", text: "Restart" });
  function paint() {
    const s = steps[i] || null;
    [...codeEl.children].forEach((li, k) => { li.classList.toggle("now", !!s && s.line === k + 1); li.classList.toggle("ran", steps.slice(0, i + 1).some((x) => x.line === k + 1)); });
    const prevVars = (steps[i - 1] && steps[i - 1].vars) || {};
    const vars = (s && s.vars) || {};
    const keys = Object.keys(vars);
    varsEl.replaceChildren(el("tr", {}, el("th", { text: "variable" }), el("th", { text: "value" })),
      ...(keys.length ? keys.map((k) => el("tr", { class: prevVars[k] !== vars[k] ? "changed" : "" }, el("td", {}, el("code", { text: k })), el("td", {}, el("code", { text: String(vars[k]) }))))
        : [el("tr", {}, el("td", { colspan: "2", class: "muted", text: i < 0 ? "Press Step to start." : "(no variables yet)" }))]));
    outEl.textContent = steps.slice(0, i + 1).map((x) => x.out).filter((x) => x != null && x !== "").join("\n") || " ";
    note.replaceChildren(rich(s ? s.note || "" : (b.intro || "Press **Step** to run the program one line at a time. The yellow line is the one running now.")));
    count.textContent = `step ${Math.max(0, i + 1)} of ${steps.length}`;
    prev.disabled = i < 0; next.disabled = i >= steps.length - 1;
    if (i >= steps.length - 1 && timer) { clearInterval(timer); timer = null; auto.textContent = "Play"; }
  }
  prev.addEventListener("click", () => { i = Math.max(-1, i - 1); paint(); });
  next.addEventListener("click", () => { i = Math.min(steps.length - 1, i + 1); paint(); });
  reset.addEventListener("click", () => { clearInterval(timer); timer = null; auto.textContent = "Play"; i = -1; paint(); });
  auto.addEventListener("click", () => {
    if (timer) { clearInterval(timer); timer = null; auto.textContent = "Play"; return; }
    if (i >= steps.length - 1) i = -1;
    auto.textContent = "Pause";
    timer = setInterval(() => { if (!codeEl.isConnected) { clearInterval(timer); return; } i++; paint(); }, 1400);
  });
  paint();
  return card("trace", "Step through the code", b.title || "", el("div", { class: "tr-grid" }, el("div", {}, codeEl), el("div", { class: "tr-side" },
    el("div", { class: "tr-label", text: "Memory" }), varsEl, el("div", { class: "tr-label", text: "Output" }), outEl)), note,
    el("div", { class: "tr-ctrl" }, prev, next, auto, reset, count));
}

// ---------- match: tap a left item, then its partner ----------
// { t: "match", q, pairs: [{ a: "term", b: "meaning" }], why }
export function match(b, done) {
  const pairs = b.pairs || [];
  const left = shuffle(pairs.map((p, i) => ({ i, text: p.a })));
  const right = shuffle(pairs.map((p, i) => ({ i, text: p.b })));
  let pick = null, solved = 0;
  const fb = fbBox();
  const btn = (side, it) => {
    const x = el("button", { type: "button", class: `mt-item ${side}` }, rich(it.text));
    x.addEventListener("click", () => {
      if (x.classList.contains("ok")) return;
      if (side === "l") { colL.querySelectorAll(".sel").forEach((n) => n.classList.remove("sel")); pick = { it, x }; x.classList.add("sel"); return; }
      if (!pick) { say(fb, "no", "First ", "tap an item in the left column, then its partner on the right."); return; }
      if (pick.it.i === it.i) {
        const n = ++solved;
        [pick.x, x].forEach((e) => { e.classList.remove("sel"); e.classList.add("ok"); e.disabled = true; e.dataset.n = n; });
        pick = null;
        if (solved === pairs.length) { say(fb, "ok", "All matched. ", b.why); done(); } else fb.hidden = true;
      } else {
        x.classList.add("bad"); setTimeout(() => x.classList.remove("bad"), 500);
        say(fb, "no", "Not a pair. ", b.hint || "Read both again and try another one.");
      }
    });
    return x;
  };
  const colL = el("div", { class: "mt-col" }, left.map((it) => btn("l", it)));
  const colR = el("div", { class: "mt-col" }, right.map((it) => btn("r", it)));
  return card("match", "Match the pairs", "tap left, then right", el("div", { class: "check-q" }, rich(b.q || "Match each item with its partner.")), el("div", { class: "mt-grid" }, colL, colR), fb);
}

// ---------- sort: put each card in the right bucket ----------
// { t: "sort", q, buckets: ["Topic", "Service", "Action"], items: [{ text, bucket: 0, why }], why }
export function sort(b, done) {
  const items = shuffle((b.items || []).map((it, i) => ({ ...it, i })));
  let pick = null, placed = 0;
  const fb = fbBox();
  const pool = el("div", { class: "st-pool" });
  const bins = (b.buckets || []).map((name, k) => {
    const list = el("div", { class: "st-list" });
    const bin = el("button", { type: "button", class: "st-bin" }, el("span", { class: "st-name", text: name }), list);
    bin.addEventListener("click", () => drop(k, bin, list));
    bin.addEventListener("dragover", (e) => { e.preventDefault(); bin.classList.add("over"); });
    bin.addEventListener("dragleave", () => bin.classList.remove("over"));
    bin.addEventListener("drop", (e) => { e.preventDefault(); bin.classList.remove("over"); drop(k, bin, list); });
    return bin;
  });
  const chips = items.map((it) => {
    const c = el("span", { class: "st-chip", role: "button", tabindex: "0", draggable: "true" }, rich(it.text));
    const choose = () => {
      if (c.classList.contains("ok")) return;   // placed cards are done; a tap on one counts as a tap on its box
      pool.querySelectorAll(".sel").forEach((n) => n.classList.remove("sel")); pick = { it, c }; c.classList.add("sel");
    };
    c.addEventListener("click", choose);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    c.addEventListener("dragstart", choose);
    pool.append(c); return c;
  });
  function drop(k, bin, list) {
    if (!pick || pick.c.classList.contains("ok")) { say(fb, "no", "First ", "tap a card, then tap the box it belongs in."); return; }
    if (pick.it.bucket === k) {
      pick.c.classList.remove("sel"); pick.c.classList.add("ok"); pick.c.removeAttribute("draggable"); pick.c.tabIndex = -1; list.append(pick.c);
      say(fb, "ok", "Yes. ", pick.it.why || ""); pick = null; placed++;
      if (placed === chips.length) { say(fb, "ok", "All sorted. ", b.why || ""); done(); }
    } else {
      bin.classList.add("bad"); setTimeout(() => bin.classList.remove("bad"), 500);
      say(fb, "no", "Not that one. ", pick.it.hint || b.hint || "Think about how long the job takes and whether an answer comes back.");
    }
  }
  return card("sort", "Sort it out", "tap a card, then a box", el("div", { class: "check-q" }, rich(b.q || "Put each card in the right box.")), pool,
    el("div", { class: "st-bins", style: { gridTemplateColumns: `repeat(${bins.length}, 1fr)` } }, bins), fb);
}

// ---------- bug: tap the line with the mistake ----------
// { t: "bug", q, lang, code, line: 3, why, hint, fix }
export function bug(b, done) {
  const fb = fbBox();
  let over = false;
  const list = el("ol", { class: "bg-code" }, String(b.code).split("\n").map((l, k) => {
    const li = el("li", {}, el("button", { type: "button" }, el("code", { text: l || " " })));
    li.firstChild.addEventListener("click", () => {
      if (over) return;
      if (k + 1 === b.line) {
        over = true; li.classList.add("ok");
        say(fb, "ok", "Found it. ", b.why);
        if (b.fix) fb.append(el("div", { class: "bg-fix" }, el("span", { class: "small muted", text: "Fixed line: " }), el("code", { text: b.fix })));
        list.querySelectorAll("button").forEach((x) => (x.disabled = true)); done();
      } else { li.classList.add("bad"); say(fb, "no", "That line is fine. ", b.hint || "Look for a missing symbol, a wrong name or a wrong order."); }
    });
    return li;
  }));
  return card("bug", "Spot the bug", "tap the wrong line", el("div", { class: "check-q" }, rich(b.q || "This code has one mistake. Tap the line that is wrong.")), list, fb);
}

// ---------- think: predict first, then reveal (not graded) ----------
// { t: "think", q, answer, code }
export function think(b) {
  const ans = el("div", { class: "th-ans", hidden: true }, rich(b.answer));
  const btn = el("button", { type: "button", class: "btn btn-white btn-small", text: "I have a guess. Show me." });
  btn.addEventListener("click", () => { ans.hidden = false; btn.hidden = true; });
  return card("think", "Think first", "guess before you look", el("div", { class: "check-q" }, rich(b.q)), b.code ? el("pre", { class: "code", text: b.code }) : null, btn, ans);
}

// ---------- cards: flip cards for revision (not graded) ----------
// { t: "cards", title, items: [{ front, back }] }
export function cards(b) {
  const grid = el("div", { class: "fc-grid" }, (b.items || []).map((it) => {
    const c = el("button", { type: "button", class: "fc", "aria-pressed": "false" },
      el("span", { class: "fc-front" }, rich(it.front)), el("span", { class: "fc-back" }, rich(it.back)));
    c.addEventListener("click", () => { const on = c.classList.toggle("flip"); c.setAttribute("aria-pressed", on ? "true" : "false"); });
    return c;
  }));
  return card("cards", b.title || "Flashcards", "tap a card to flip it", grid);
}
