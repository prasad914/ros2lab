import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from "./fb.js";
import { el, rich, qs, requireMember, watermark, watermarkLines, protectPage, friendlyError, footer } from "./common.js";
import { renderLesson } from "./lesson-render.js";

const main = document.getElementById("main");
const MIN_SECONDS = 60;
// Weeks 7 to 9 are an introductory experience, outside the certificate. MUST match CORE_MODULES in course.js / functions/config.js.
const CORE_MODULES = ["W1", "W2", "IN", "W3", "PF", "NP"];

function fail(msg) {
  main.replaceChildren(el("div", { class: "narrow" }, el("div", { class: "panel", style: { marginTop: "32px" } },
    el("h1", { text: "Lesson not available" }), el("p", { text: msg }), el("a", { class: "btn", href: "course.html", text: "Back to course" }))));
}

(async () => {
  let ctx;
  try { ctx = await requireMember(); } catch { return; }
  const { user, profile } = ctx;
  protectPage();
  watermark(watermarkLines(user, profile));

  const id = qs("id");
  if (!id || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return fail("This link is incomplete.");
  let lesson, mod, prog;
  const pref = doc(db, "progress", user.uid, "lessonProgress", id);
  try {
    const ls = await getDoc(doc(db, "lessons", id));
    if (!ls.exists()) return fail("This lesson has not been published yet.");
    lesson = ls.data();
    mod = (await getDoc(doc(db, "modules", lesson.moduleId))).data() || { lessons: [] };
    const ps = await getDoc(pref);
    if (ps.exists()) prog = ps.data();
    else {
      await setDoc(pref, { status: "started", activeSeconds: 0, firstOpenedAt: serverTimestamp(), lastUpdate: serverTimestamp() });
      prog = { status: "started", activeSeconds: 0, lastUpdate: null };
    }
  } catch (e) { return fail(friendlyError(e)); }

  const list = mod.lessons || [];
  const pos = list.findIndex((l) => l.id === id);
  const prev = pos > 0 ? list[pos - 1] : null;
  const next = pos >= 0 && pos < list.length - 1 ? list[pos + 1] : null;
  document.title = `${lesson.title} | ROS2Lab`;

  // ---------- layout ----------
  const core = CORE_MODULES.includes(lesson.moduleId);
  const wk = Number(String(mod.short || mod.title || "").replace(/^Week\s*(\d+).*$/i, "$1")) || mod.week || null;
  const day = pos >= 0 ? list[pos].day : null;
  const crumbs = el("div", { class: "pagehead" }, el("div", { class: "wrap" }, el("p", { class: "crumbs" },
    el("a", { href: "index.html", text: "Home" }), " › ", el("a", { href: core ? "plan.html" : "modelling.html", text: core ? "Certificate course" : "Robot modelling & RViz" }),
    wk ? [" › ", el("a", { href: `${core ? "plan.html" : "modelling.html"}#wk${wk}`, text: `Week ${wk}` })] : null, " › ", lesson.title)));
  const meterFill = el("span");
  const meterText = el("span", { class: "muted small" });
  const top = el("div", { class: "lesson-top" }, el("div", { class: "narrow" },
    el("a", { href: "course.html", text: "Back to course" }),
    el("div", { class: "meter", title: "Practice activities done" }, meterFill), meterText));
  const body = el("div", { class: "lesson-body" });
  const completeMsg = el("p", { style: { margin: 0 } });
  const completeBtn = el("button", { class: "btn", type: "button", text: "Mark lesson complete", disabled: true });
  const completeBar = el("div", { class: "complete-bar" }, el("div", {}, el("h3", { style: { margin: 0 }, text: "Finish this lesson" }), completeMsg), completeBtn);

  // left list: this week's lessons, ticked once the student's progress has loaded (a failed read just leaves the list unticked)
  const doneIds = new Set(prog.status === "completed" ? [id] : []);
  const navLabel = el("p", { class: "navlabel", text: mod.title || mod.short || "This week" });
  const navMeter = el("div", { class: "side-prog", hidden: true });
  const sideNav = el("nav", { class: "sidenav", "aria-label": `${mod.short || mod.title || "Week"} lessons` });
  const paintNav = () => {
    sideNav.replaceChildren(navLabel, ...list.map((l) => el("a", { href: `lesson.html?id=${encodeURIComponent(l.id)}`, class: doneIds.has(l.id) ? "done" : null, "aria-current": l.id === id ? "page" : null, text: l.title })), navMeter);
    const n = list.filter((l) => doneIds.has(l.id)).length;
    navMeter.hidden = !list.length;
    navMeter.replaceChildren(el("span", { class: "meta", text: `${n} of ${list.length} lessons done` }), el("div", { class: "bar-meter", role: "img", "aria-label": `${list.length ? Math.round((n / list.length) * 100) : 0}% of this week's lessons done` }, el("i", { style: { width: `${list.length ? Math.round((n / list.length) * 100) : 0}%` } })));
  };
  paintNav();
  getDocs(collection(db, "progress", user.uid, "lessonProgress")).then((snap) => {
    snap.docs.forEach((d) => { if (d.data().status === "completed") doneIds.add(d.id); });
    paintNav();
  }).catch(() => {});

  // sticky Previous / Next bar. Next stays a link (the site has never locked it); while tasks are open the bar says why the lesson is not complete yet.
  const nextWhy = el("span", { class: "why", id: "nextwhy" });
  const prevLink = prev ? el("a", { class: "lprev", href: `lesson.html?id=${encodeURIComponent(prev.id)}`, title: prev.title }, el("span", { "aria-hidden": "true", text: "‹ " }), el("span", { class: "lt", text: `Previous: ${prev.title}` })) : el("span", { class: "lprev" });
  const nextLink = next ? el("a", { class: "btn btn-main", href: `lesson.html?id=${encodeURIComponent(next.id)}`, "aria-describedby": "nextwhy", title: next.title }, el("span", { class: "lt", text: `Next: ${next.title}` }), el("span", { "aria-hidden": "true", text: "›" }))
    : el("a", { class: "btn btn-main", href: "course.html", "aria-describedby": "nextwhy", text: "Back to course" });
  const nav = el("div", { class: "pager" }, el("div", { class: "wrap" }, prevLink, nextWhy, nextLink));

  main.classList.add("v3lesson");
  main.replaceChildren(crumbs, top,
    el("div", { class: "wrap" }, el("div", { class: "lessonwrap" }, sideNav,
      el("article", { class: "article", "data-mod": lesson.moduleId },
        el("header", { class: "lesson-hero" },
          el("p", { class: "meta kicker-line", text: `${mod.short || mod.title || ""}: lesson ${pos + 1} of ${list.length}${day ? ` · Day ${day}` : ""}` }),
          el("h1", { text: lesson.title }),
          core ? null : el("p", { class: "chip going", style: { display: "inline-block", margin: "0 0 8px" }, text: "Introductory experience (Weeks 7 to 9): not part of the certificate" }),
          lesson.summary ? el("p", { class: "lead lede" }, rich(lesson.summary)) : null,
          el("p", { class: "small muted", text: `About ${lesson.minutes || 15} minutes. Do the practice parts; they are where the learning happens.` })),
        body, completeBar))),
    nav, footer());

  // ---------- render blocks + activity tracking ----------
  let activity = { total: 0, done: 0 };
  const status = renderLesson(body, lesson, { onChange: (s) => { activity = s; paint(); } });
  activity = status();

  // ---------- study-time tracking (counts only while the page is visible and in use) ----------
  let saved = prog.activeSeconds || 0, pending = 0, lastActive = Date.now(), flushing = false;
  let lastFlush = prog.lastUpdate && prog.lastUpdate.toMillis ? prog.lastUpdate.toMillis() : Date.now();
  let completed = prog.status === "completed";
  ["pointermove", "keydown", "scroll", "touchstart", "click", "input"].forEach((ev) => addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastActive < 120000) pending++;
    flush();
  }, 1000);
  async function flush() {
    if (flushing || pending <= 0 || Date.now() - lastFlush < 58000) return;
    flushing = true;
    const add = Math.min(pending, 75);
    try {
      await updateDoc(pref, { activeSeconds: saved + add, lastUpdate: serverTimestamp() });
      saved += add; pending -= add; paint();
    } catch { /* will retry */ }
    lastFlush = Date.now(); flushing = false;
  }

  function paint() {
    const pct = activity.total ? Math.round((activity.done / activity.total) * 100) : 100;
    meterFill.style.width = pct + "%";
    meterText.textContent = activity.total ? `${activity.done} of ${activity.total} practice parts` : "";
    const open = completed ? 0 : activity.total - activity.done;
    nextWhy.textContent = open > 0 ? `Finish ${open} more task${open > 1 ? "s" : ""} to complete this lesson` : completed ? "Lesson complete" : "All tasks done. Mark the lesson complete above.";
    if (completed) {
      completeBtn.disabled = true; completeBtn.textContent = "Lesson completed";
      completeMsg.replaceChildren(document.createTextNode("Well done! "), next ? el("a", { href: `lesson.html?id=${encodeURIComponent(next.id)}`, text: `Go to the next lesson: ${next.title}` }) : el("a", { href: "course.html", text: "Back to the course page" }));
      return;
    }
    const left = activity.total - activity.done;
    if (left > 0) { completeBtn.disabled = true; completeMsg.textContent = `Finish the ${left} practice part${left > 1 ? "s" : ""} above to complete this lesson.`; }
    else if (saved < MIN_SECONDS) { completeBtn.disabled = true; completeMsg.textContent = "Almost there. Read through the recap once more; you can complete the lesson in a moment."; }
    else { completeBtn.disabled = false; completeMsg.textContent = "All practice done. Mark the lesson complete to save your progress."; }
  }
  completeBtn.addEventListener("click", async () => {
    completeBtn.disabled = true;
    try {
      await updateDoc(pref, { status: "completed", completedAt: serverTimestamp(), lastUpdate: serverTimestamp() });
      completed = true; doneIds.add(id); paintNav(); lastFlush = Date.now(); paint();
    } catch (e) { completeMsg.textContent = friendlyError(e); completeBtn.disabled = false; }
  });
  paint();
})();
