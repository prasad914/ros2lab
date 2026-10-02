import { db, call, doc, getDoc, getDocs, collection, query, where, addDoc, serverTimestamp } from "./fb.js";
import { el, rich, qs, requireMember, watermark, protectPage, friendlyError, footer, fmtDate, toast } from "./common.js";

const main = document.getElementById("main");
const startAttempt = call("startAttempt"), submitAnswer = call("submitAnswer"), getReview = call("getReview");
const LETTERS = "ABCDEFGH";

let attemptId = null, current = null, inTest = false, busy = false;
let qTimer = null, qEndsAt = 0, testEndsAt = 0, clockOffset = 0, answerGetter = null;
const sentAt = {}; let eventCount = 0;

function screen(...kids) { main.replaceChildren(el("div", { class: "narrow" }, el("div", { class: "panel test-card" }, ...kids)), footer()); }

function logEvent(type) {
  if (!inTest || !attemptId || eventCount >= 80) return;
  const now = Date.now();
  if (sentAt[type] && now - sentAt[type] < 3000) return;
  sentAt[type] = now; eventCount++;
  addDoc(collection(db, "attempts", attemptId, "integrityEvents"), { type, at: serverTimestamp(), q: current ? current.index : 0 }).catch(() => {});
}

(async () => {
  let ctx;
  try { ctx = await requireMember(); } catch { return; }
  const { user, profile, claims } = ctx;
  protectPage({ onEvent: (t) => logEvent(t) });
  watermark([user.email, profile.usn, new Date().toLocaleString("en-IN")]);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") logEvent("hidden");
    else if (inTest) toast("You left the test page. This was recorded for your instructor.", 4000);
  });
  window.addEventListener("blur", () => logEvent("blur"));
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) logEvent("fullscreen-exit"); });
  window.addEventListener("beforeunload", (e) => { if (inTest) { e.preventDefault(); e.returnValue = ""; } });

  const reviewId = qs("review");
  if (reviewId) return showReview(reviewId);
  const id = qs("id");
  if (!id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return screen(el("h1", { text: "Test not found" }), el("a", { class: "btn", href: "course.html", text: "Back to course" }));
  try {
    const t = await getDoc(doc(db, "tests", id));
    if (!t.exists() || (t.data().published !== true && claims.admin !== true)) return screen(el("h1", { text: "This test is not available" }), el("a", { class: "btn", href: "course.html", text: "Back to course" }));
    const atts = (await getDocs(query(collection(db, "attempts"), where("uid", "==", user.uid)))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.testId === id);
    showIntro(id, t.data(), atts);
  } catch (e) { screen(el("p", { class: "notice err", text: friendlyError(e) })); }
})();

function showIntro(id, test, atts) {
  const n = (test.topics || []).reduce((s, x) => s + (x.count || 0), 0);
  const used = atts.filter((a) => a.status !== "voided").length;
  const running = atts.find((a) => a.status === "in_progress");
  const left = Math.max(0, (test.maxAttempts || 1) - used);
  const agree = el("input", { type: "checkbox", id: "agree" });
  const go = el("button", { class: "btn", type: "button", text: running ? "Continue my test" : "Start the test", disabled: true });
  const err = el("p", { class: "notice err", hidden: true });
  agree.addEventListener("change", () => { go.disabled = !agree.checked; });
  go.addEventListener("click", () => begin(id, go, err));
  screen(
    el("h1", { text: test.title }),
    test.description ? el("p", {}, rich(test.description)) : null,
    el("p", { class: "muted", text: `${n} questions, up to ${test.totalMinutes || 30} minutes. Open until ${fmtDate(test.closeAt)}.` }),
    el("h3", { text: "How this test works" }),
    el("ul", { class: "rules" },
      el("li", { text: "You see one question at a time. You cannot go back to earlier questions." }),
      el("li", { text: "Each question has its own timer. When it reaches zero, your answer is saved and the next question appears." }),
      el("li", { text: "Every student gets different questions, so sharing answers does not help." }),
      el("li", { text: "Copy, paste and right-click are turned off. Switching to other apps or tabs is recorded and shown to your instructor." }),
      el("li", { text: running ? "You have a test in progress. Continuing keeps the same questions and timer." : `You have ${left} of ${test.maxAttempts || 1} attempt${(test.maxAttempts || 1) > 1 ? "s" : ""} left. Your best score counts.` })),
    el("label", { class: "consent", for: "agree" }, agree, el("span", { text: "I will answer on my own, without help from other people, websites or AI tools." })),
    err,
    el("div", { class: "q-actions" }, (left > 0 || running) ? go : el("span", { class: "chip locked", text: "No attempts left" }), el("a", { class: "btn btn-white", href: "course.html", text: "Back to course" })));
}

async function begin(id, btn, err) {
  btn.disabled = true; err.hidden = true;
  try {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS && document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen().catch(() => {});
    const res = (await startAttempt({ testId: id })).data;
    attemptId = res.attemptId; inTest = true;
    clockOffset = res.serverNow - Date.now();
    testEndsAt = res.deadline;
    showQuestion(res.question);
  } catch (e) { err.textContent = friendlyError(e); err.hidden = false; btn.disabled = false; }
}

function showQuestion(q) {
  current = q; busy = false;
  const saveBtn = el("button", { class: "btn", type: "button", text: q.index === q.total - 1 ? "Submit and finish" : "Save and next" });
  const timerText = el("span", { class: "timer", "aria-live": "off" });
  const bar = el("span"); const qbar = el("div", { class: "q-bar" }, bar);
  const totalLeft = el("span", { class: "small muted" });
  const err = el("p", { class: "notice err", hidden: true });

  let widget;
  if (q.type === "mcq") {
    let chosen = null;
    const opts = el("div", { class: "opts", role: "radiogroup" });
    q.options.forEach((o, i) => {
      const b = el("button", { class: "opt", type: "button", role: "radio", "aria-checked": "false" }, el("span", { class: "k", text: LETTERS[i] }), el("span", {}, rich(o)));
      b.addEventListener("click", () => { chosen = o; opts.querySelectorAll(".opt").forEach((x) => { x.classList.remove("right"); x.setAttribute("aria-checked", "false"); }); b.classList.add("right"); b.setAttribute("aria-checked", "true"); });
      opts.append(b);
    });
    widget = opts; answerGetter = () => chosen;
  } else if (q.type === "order") {
    const items = q.options.slice();
    const list = el("ol", { class: "order-list" });
    const paint = () => list.replaceChildren(...items.map((it, i) => el("li", {}, el("span", { class: "t" }, rich(it)),
      el("button", { type: "button", "aria-label": "Move up", disabled: i === 0, text: "↑", onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; paint(); } }),
      el("button", { type: "button", "aria-label": "Move down", disabled: i === items.length - 1, text: "↓", onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; paint(); } }))));
    paint(); widget = el("div", {}, el("p", { class: "small muted", text: "Use ↑ and ↓ to put the lines in the right order." }), list);
    answerGetter = () => items.slice();
  } else {
    const input = el("input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Your answer", placeholder: q.type === "predict" ? "Type exactly what is printed" : "Type your answer" });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } });
    widget = el("div", { class: "text-answer" }, input); answerGetter = () => input.value;
    setTimeout(() => input.focus(), 50);
  }

  main.replaceChildren(el("div", { class: "narrow" }, el("div", { class: "panel test-card" },
    el("div", { class: "q-top" }, el("span", { text: `Question ${q.index + 1} of ${q.total}` }), timerText),
    qbar,
    el("div", { class: "q-prompt" }, rich(q.prompt)),
    q.code ? el("pre", { class: "code", style: { marginBottom: "16px" }, text: q.code }) : null,
    widget, err,
    el("div", { class: "q-actions" }, saveBtn, totalLeft))));

  qEndsAt = Date.now() + (q.remaining ?? q.seconds) * 1000;
  clearInterval(qTimer);
  const tick = () => {
    const left = Math.max(0, Math.ceil((qEndsAt - Date.now()) / 1000));
    timerText.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`;
    timerText.classList.toggle("low", left <= 15);
    bar.style.width = `${Math.max(0, Math.min(100, (left / q.seconds) * 100))}%`;
    const tl = Math.max(0, Math.round((testEndsAt - (Date.now() + clockOffset)) / 1000));
    totalLeft.textContent = `Whole test ends in ${Math.floor(tl / 60)} min ${tl % 60} s`;
    if (left <= 0 || tl <= 0) send(true);
  };
  tick(); qTimer = setInterval(tick, 500);
  saveBtn.addEventListener("click", () => send(false));

  async function send(auto) {
    if (busy) return;
    busy = true; saveBtn.disabled = true; clearInterval(qTimer);
    if (auto) toast("Time is up for this question. Your answer was saved.", 2500);
    try {
      const res = (await submitAnswer({ attemptId, index: q.index, answer: answerGetter() })).data;
      if (res.done) return finish(res);
      clockOffset = res.serverNow - Date.now(); testEndsAt = res.deadline;
      showQuestion(res.question);
    } catch (e) {
      const msg = friendlyError(e);
      if (/already answered/i.test(msg)) {
        try { const r = (await startAttempt({ testId: qs("id") })).data; attemptId = r.attemptId; return showQuestion(r.question); } catch (e2) { err.textContent = friendlyError(e2); }
      } else err.textContent = `${msg} Press the button to try again.`;
      err.hidden = false; busy = false; saveBtn.disabled = false;
    }
  }
}

function finish(res) {
  inTest = false; clearInterval(qTimer);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  screen(
    el("h1", { text: "Test submitted" }),
    res.score != null ? el("p", { style: { fontSize: "1.4rem" } }, "Your score: ", el("strong", { text: `${res.score} out of ${res.maxScore}` })) : el("p", { text: "Your answers are saved. Your instructor will share the scores." }),
    el("p", { class: "muted", text: "Correct answers and explanations appear under \"See answers\" on the course page when your instructor allows it." }),
    el("div", { class: "q-actions" }, el("a", { class: "btn", href: "course.html", text: "Back to course" }),
      el("a", { class: "btn btn-white", href: `test.html?review=${encodeURIComponent(attemptId)}`, text: "See answers" })));
}

async function showReview(id) {
  screen(el("p", { class: "muted", text: "Loading your answers…" }));
  try {
    const r = (await getReview({ attemptId: id })).data;
    const items = r.items.map((it, i) => el("div", { class: `review-item ${it.isCorrect ? "ok" : "no"}` },
      el("p", { class: "small muted", style: { margin: 0 }, text: `Question ${i + 1}: ${it.isCorrect ? "correct" : it.late ? "answered after the timer ended" : "not correct"}` }),
      el("div", { class: "q-prompt", style: { fontSize: "1.05rem" } }, rich(it.prompt)),
      it.code ? el("pre", { class: "code", text: it.code }) : null,
      el("p", { style: { marginTop: "10px" } }, el("strong", { text: "Your answer: " }), el("code", { text: it.yourAnswer == null ? "(no answer)" : String(it.yourAnswer).replace(/\n/g, "  →  ") })),
      el("p", {}, el("strong", { text: "Correct answer: " }), el("code", { text: Array.isArray(it.correctAnswer) ? it.correctAnswer.join("  →  ") : it.correctAnswer })),
      el("p", { style: { margin: 0 } }, el("strong", { text: "Why: " }), rich(it.explain))));
    screen(el("h1", { text: "Your answers" }), el("p", { style: { fontSize: "1.2rem" } }, "Score: ", el("strong", { text: `${r.score} out of ${r.maxScore}` })),
      el("div", { class: "stack" }, items), el("div", { class: "q-actions" }, el("a", { class: "btn", href: "course.html", text: "Back to course" })));
  } catch (e) {
    screen(el("h1", { text: "Answers not available yet" }), el("p", { text: friendlyError(e) }), el("a", { class: "btn", href: "course.html", text: "Back to course" }));
  }
}
