import { db, collection, getDocs, query, where } from "./fb.js";
import { el, rich, requireMember, friendlyError, footer, fmtDate } from "./common.js";
import { GAMES } from "./games/registry.js";
import { badges } from "./games/shell.js";

const main = document.getElementById("main");

(async () => {
  let ctx;
  try { ctx = await requireMember(); } catch { return; }
  const { user, profile } = ctx;
  try {
    const [modsSnap, progSnap, testsSnap, resSnap, attSnap] = await Promise.all([
      getDocs(collection(db, "modules")),
      getDocs(collection(db, "progress", user.uid, "lessonProgress")),
      getDocs(query(collection(db, "tests"), where("published", "==", true))),
      getDocs(query(collection(db, "results"), where("uid", "==", user.uid))),
      getDocs(query(collection(db, "attempts"), where("uid", "==", user.uid))),
    ]);
    const mods = modsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    const prog = Object.fromEntries(progSnap.docs.map((d) => [d.id, d.data()]));
    const tests = testsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const results = Object.fromEntries(resSnap.docs.map((d) => [d.data().testId, d.data()]));
    const attempts = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const allLessons = mods.flatMap((m) => m.lessons || []);
    const doneCount = allLessons.filter((l) => prog[l.id] && prog[l.id].status === "completed").length;
    const nextLesson = allLessons.find((l) => !prog[l.id] || prog[l.id].status !== "completed");
    const pct = allLessons.length ? Math.round((doneCount / allLessons.length) * 100) : 0;
    const fill = el("span"); fill.style.width = pct + "%";

    const head = el("div", { class: "dash-head" },
      el("div", {}, el("h1", { style: { marginBottom: "6px" }, text: `Hello, ${(profile.fullName || "there").split(" ")[0]}` }),
        el("p", { class: "muted", style: { margin: 0 }, text: `${doneCount} of ${allLessons.length} lessons completed` })),
      el("div", { style: { display: "grid", gap: "10px", justifyItems: "end" } },
        el("div", { class: "meter", title: `${pct}% done` }, fill),
        nextLesson ? el("a", { class: "btn", href: `lesson.html?id=${encodeURIComponent(nextLesson.id)}`, text: doneCount ? "Continue where you left off" : "Start the first lesson" }) : null));

    const moduleEls = mods.map((m) => {
      const lessons = m.lessons || [];
      const mDone = lessons.filter((l) => prog[l.id] && prog[l.id].status === "completed").length;
      let lastDay = null;
      const rows = lessons.flatMap((l, i) => {
        const head = l.day && l.day !== lastDay ? el("li", { class: "day-head", text: `Day ${l.day}${l.dayTitle ? `: ${l.dayTitle}` : ""}` }) : null;
        lastDay = l.day || lastDay;
        const p = prog[l.id];
        const state = p && p.status === "completed" ? "done" : p ? "going" : "new";
        const isNext = nextLesson && nextLesson.id === l.id;
        const row = el("li", {}, el("a", { class: `lesson-row${state === "done" ? " is-done" : ""}${isNext ? " is-next" : ""}`, href: `lesson.html?id=${encodeURIComponent(l.id)}` },
          el("span", { class: "num", text: state === "done" ? "✓" : String(i + 1) }),
          el("span", {}, el("span", { class: "t", text: l.title }), el("br"), el("span", { class: "s" }, rich(l.summary || ""))),
          el("span", { class: `chip ${state === "done" ? "done" : state === "going" ? "going" : ""}`, text: state === "done" ? "Done" : state === "going" ? "Started" : isNext ? "Up next" : `${l.minutes || 15} min` })));
        return head ? [head, row] : [row];
      });
      const testEls = tests.filter((t) => t.moduleId === m.id).sort((a, b) => (a.order || 0) - (b.order || 0)).map((t) => testRow(t, results[t.id], attempts.filter((a) => a.testId === t.id), mDone === lessons.length));
      return el("section", { class: "module", "data-mod": m.id },
        el("div", { class: "module-head" }, el("div", {}, el("h2", { text: m.title }), el("p", {}, rich(m.description || ""))),
          el("span", { class: `chip ${mDone === lessons.length && lessons.length ? "done" : ""}`, text: `${mDone}/${lessons.length} lessons` })),
        el("ul", { class: "lessons" }, rows), ...testEls);
    });

    main.replaceChildren(el("div", { class: "wrap" }, head, arcade(), el("div", { class: "stack" },
      moduleEls.length ? moduleEls : el("div", { class: "panel" }, el("h2", { text: "No lessons yet" }), el("p", { text: "Your instructor has not published the course content yet. Please check back soon." })))),
      footer());
  } catch (e) {
    main.replaceChildren(el("div", { class: "narrow" }, el("p", { class: "notice err", style: { marginTop: "32px" }, text: friendlyError(e) })));
  }
})();

function testRow(t, result, atts, lessonsDone) {
  const now = Date.now();
  const open = (!t.openAt || t.openAt.toMillis() <= now) && (!t.closeAt || t.closeAt.toMillis() > now);
  const used = atts.filter((a) => a.status !== "voided").length;
  const left = Math.max(0, (t.maxAttempts || 1) - used);
  const running = atts.find((a) => a.status === "in_progress");
  const lastDone = atts.filter((a) => a.status === "submitted").sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis())[0];
  let status = "";
  if (t.openAt && t.openAt.toMillis() > now) status = `Opens ${fmtDate(t.openAt)}`;
  else if (t.closeAt && t.closeAt.toMillis() <= now) status = `Closed ${fmtDate(t.closeAt)}`;
  else status = `Open until ${fmtDate(t.closeAt)}. ${left} of ${t.maxAttempts || 1} attempt${(t.maxAttempts || 1) > 1 ? "s" : ""} left.`;
  const score = result && typeof result.best === "number" && t.showScore !== false ? `Best score: ${result.best}/${result.max}` : null;
  let action;
  if (running && open) action = el("a", { class: "btn btn-small", href: `test.html?id=${encodeURIComponent(t.id)}`, text: "Continue the test" });
  else if (open && left > 0 && (lessonsDone || !t.requireLessons)) action = el("a", { class: "btn btn-small", href: `test.html?id=${encodeURIComponent(t.id)}`, text: used ? "Try again" : "Take the test" });
  else if (open && left > 0) action = el("span", { class: "chip locked", text: "Finish all lessons to unlock" });
  else action = null;
  const review = lastDone ? el("a", { class: "btn btn-white btn-small", href: `test.html?review=${encodeURIComponent(lastDone.id)}`, text: "See answers" }) : null;
  return el("div", { class: "test-row" },
    el("div", {}, el("h3", { text: t.title }), el("div", { class: "small muted", text: status }), score ? el("div", { class: "small", text: score }) : null),
    el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, review, action));
}

// Badges from the mini-games (saved on this device) and a link to the Playground.
function arcade() {
  const got = badges();
  const n = GAMES.filter((g) => got[g.id]).length;
  return el("section", { class: "arcade" },
    el("div", {}, el("h2", { text: "Playground" }),
      el("p", { text: n ? `${n} of ${GAMES.length} game badges earned. Replay any game to practise.` : "Six mini-games and 13 concept animations, one for each big idea. They also appear inside the lessons." })),
    el("div", { class: "shelf" }, GAMES.map((g) => el("div", { class: `shelf-badge${got[g.id] ? " got" : ""}`, title: g.badge },
      el("span", { class: "sb-icon", "aria-hidden": "true", text: g.badgeIcon }), el("span", { class: "sb-name", text: g.badge })))),
    el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
      el("a", { class: "btn btn-ghost btn-small", href: "playground.html", text: "Open the Playground" }),
      el("a", { class: "btn btn-ghost btn-small", href: "playground.html#lab", text: "Concept lab" })));
}
