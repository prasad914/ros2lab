// "My course": the student's dashboard with tabs for Overview, Lessons, Tests & scores,
// and Project & certificate.
import { db, auth, call, collection, getDocs, getDoc, doc, query, where, getIdTokenResult } from "./fb.js";
import { el, rich, requireMember, friendlyError, footer, fmtDate, toast, accessInfo } from "./common.js";
import { accessCard, extensionBox } from "./access-ui.js";
import { GAMES } from "./games/registry.js";
import { badges } from "./games/shell.js";

const main = document.getElementById("main");
const PASS_TEST = 60, PASS_PROJECT = 80;
// Weeks that count for lifetime access and the certificate. MUST match CORE_MODULES in
// functions/config.js. Weeks 7 to 9 (UR, XT, RV) are an optional introductory experience (no certificate). [] = every week counts.
const CORE_MODULES = ["W1", "W2", "IN", "W3", "PF", "NP"];
const isCore = (moduleId) => !CORE_MODULES.length || !moduleId || CORE_MODULES.includes(moduleId);
const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);
const pctOf = (r) => (r && r.max ? Math.round((r.best / r.max) * 1000) / 10 : null);

(async () => {
  let ctx;
  try { ctx = await requireMember(); } catch { return; }
  const { user, profile, claims } = ctx;
  try {
    const [modsSnap, progSnap, testsSnap, resSnap, attSnap, projSnap, reqSnap] = await Promise.all([
      getDocs(collection(db, "modules")),
      getDocs(collection(db, "progress", user.uid, "lessonProgress")),
      getDocs(query(collection(db, "tests"), where("published", "==", true))),
      getDocs(query(collection(db, "results"), where("uid", "==", user.uid))),
      getDocs(query(collection(db, "attempts"), where("uid", "==", user.uid))),
      getDoc(doc(db, "projects", user.uid)),
      getDoc(doc(db, "certRequests", user.uid)),
    ]);
    const mods = modsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    const prog = Object.fromEntries(progSnap.docs.map((d) => [d.id, d.data()]));
    const tests = testsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const results = Object.fromEntries(resSnap.docs.map((d) => [d.data().testId, d.data()]));
    const attempts = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const project = projSnap.exists() ? projSnap.data() : null;
    const request = reqSnap.exists() ? reqSnap.data() : null;
    const isDone = (l) => prog[l.id] && prog[l.id].status === "completed";

    const coreMods = mods.filter((m) => isCore(m.id));
    const allLessons = coreMods.flatMap((m) => m.lessons || []);            // core weeks only (what the certificate needs)
    const doneCount = allLessons.filter(isDone).length;
    const nextLesson = allLessons.find((l) => !isDone(l)) || mods.flatMap((m) => m.lessons || []).find((l) => !isDone(l));
    const pct = allLessons.length ? Math.round((doneCount / allLessons.length) * 100) : 0;
    const modOf = Object.fromEntries(mods.map((m) => [m.id, m]));
    const testList = tests.slice().sort((a, b) => (modOf[a.moduleId] ? modOf[a.moduleId].order || 0 : 99) - (modOf[b.moduleId] ? modOf[b.moduleId].order || 0 : 99) || (a.order || 0) - (b.order || 0));
    const testRows = testList.filter((t) => isCore(t.moduleId) && (!t.openAt || t.openAt.toMillis() <= Date.now())).map((t) => ({ t, pct: pctOf(results[t.id]), ok: (pctOf(results[t.id]) ?? -1) >= PASS_TEST }));
    const testsPassed = testRows.filter((x) => x.ok).length;
    const lessonsOk = allLessons.length > 0 && doneCount >= allLessons.length;
    const testsOk = testRows.length > 0 && testsPassed === testRows.length;
    const lifetime = claims.lifetime === true || profile.lifetimeAccess === true;
    const data = { user, profile, claims, mods, coreMods, prog, tests: testList, results, attempts, project, request, allLessons, doneCount, nextLesson, testRows, testsPassed, lessonsOk, testsOk, lifetime, isDone };

    // Everything done on this side but no lifetime yet (the last test just ended): ask the server.
    if (!claims.admin && !lifetime && lessonsOk && testsOk) {
      call("checkCompletion")().then((r) => { if (r.data && r.data.granted) { toast("Lifetime access unlocked!", 5000); getIdTokenResult(auth.currentUser, true).finally(() => setTimeout(() => location.reload(), 1500)); } }).catch(() => {});
    }

    const fill = el("span", { style: { width: pct + "%" } });
    const head = el("div", { class: "dash-head" },
      el("div", {}, el("h1", { style: { marginBottom: "6px" }, text: `Hello, ${(profile.fullName || "there").split(" ")[0]}` }),
        el("p", { class: "muted", style: { margin: 0 }, text: "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes" })),
      el("div", { style: { display: "grid", gap: "10px", justifyItems: "end" } },
        el("div", { class: "meter", title: `${pct}% of lessons done` }, fill),
        nextLesson ? el("a", { class: "btn", href: `lesson.html?id=${encodeURIComponent(nextLesson.id)}`, text: doneCount ? "Continue where you left off" : "Start the first lesson" }) : null));

    // ---- tabs ----
    const TABS = [
      ["overview", "Overview", () => overviewTab(data)],
      ["lessons", "Lessons", () => lessonsTab(data)],
      ["tests", "Tests & scores", () => testsTab(data)],
      ["certificate", "Project & certificate", () => certificateTab(data)],
    ];
    const panel = el("div", { class: "tab-panel", role: "tabpanel", tabindex: "-1" });
    const btns = TABS.map(([id, name]) => el("button", { type: "button", role: "tab", id: `tab-${id}`, "aria-controls": "tabpanel", text: name }));
    panel.id = "tabpanel";
    const show = (id, focus) => {
      const k = TABS.findIndex((t) => t[0] === id);
      const idx = k < 0 ? 0 : k;
      btns.forEach((b, n) => { b.setAttribute("aria-selected", String(n === idx)); b.tabIndex = n === idx ? 0 : -1; });
      panel.setAttribute("aria-labelledby", `tab-${TABS[idx][0]}`);
      panel.replaceChildren(TABS[idx][2]());
      if (location.hash !== `#${TABS[idx][0]}`) history.replaceState(null, "", `#${TABS[idx][0]}`);
      if (focus) btns[idx].focus();
    };
    btns.forEach((b, n) => {
      b.addEventListener("click", () => show(TABS[n][0]));
      b.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(TABS[(n + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length][0], true); }
      });
    });
    window.addEventListener("hashchange", () => show(location.hash.slice(1)));
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("[data-tab]");
      if (a) { e.preventDefault(); show(a.dataset.tab); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });

    main.replaceChildren(el("div", { class: "wrap" }, head, claims.admin ? null : statCards(data),
      el("div", { class: "tabs dash-tabs", role: "tablist", "aria-label": "My course" }, btns), panel), footer());
    show(location.hash.slice(1) || "overview");
  } catch (e) {
    main.replaceChildren(el("div", { class: "narrow" }, el("p", { class: "notice err", style: { marginTop: "32px" }, text: friendlyError(e) })));
  }
})();

// ---------- the five numbers at the top ----------
function statCards(d) {
  const info = accessInfo(d.profile, d.claims);
  const ps = d.project ? d.project.status : null;
  const card = (cls, big, label, sub, tab) => el("a", { class: `stat ${cls}`, href: `#${tab}`, "data-tab": tab },
    el("b", { text: big }), el("span", { class: "stat-label", text: label }), sub ? el("span", { class: "stat-sub", text: sub }) : null);
  return el("div", { class: "stats" },
    info ? card(info.lifetime ? "ok" : info.daysLeft <= 10 ? "warn" : "", info.lifetime ? "∞" : String(info.daysLeft), info.lifetime ? "Lifetime access" : info.daysLeft === 1 ? "day left" : "days left",
      info.lifetime ? "Course completed" : `Day ${info.dayNo} of ${info.totalDays}`, "overview") : null,
    card(d.lessonsOk ? "ok" : "", `${d.doneCount}/${d.allLessons.length}`, "lessons done", d.lessonsOk ? "Weeks 1 to 6 done" : "Weeks 1 to 6", "lessons"),
    card(d.testsOk ? "ok" : "", `${d.testsPassed}/${d.testRows.length}`, "tests passed", `Weeks 1 to 6 · pass mark ${PASS_TEST}%`, "tests"),
    card(ps === "passed" ? "ok" : "", ps === "passed" ? `${d.project.best}%` : ps === "submitted" ? "⏳" : ps ? "📝" : "–", "project",
      ps === "passed" ? "Passed" : ps === "submitted" ? "Being marked" : ps ? "In progress" : d.lessonsOk ? "Ready to start" : "After the lessons", "certificate"),
    card(d.profile.certificateId ? "ok" : "", d.profile.certificateId ? "🎓" : "–", "certificate",
      d.profile.certificateId ? "Ready to download" : d.request && d.request.status === "pending" ? "Waiting for signature" : "Not yet", "certificate"));
}

// ---------- Overview ----------
function overviewTab(d) {
  return el("div", { class: "stack" },
    d.claims.admin ? el("p", { class: "notice", text: "Instructor view: this is what students see. You have no access period." }) : accessCard(d.profile, d.claims),
    nextStep(d),
    d.claims.admin ? null : milestones(d),
    d.claims.admin ? null : extensionBox(d.profile, d.claims, { compact: true }),
    arcade());
}

function nextStep(d) {
  let title, text, action;
  if (d.nextLesson) {
    title = d.doneCount ? "Next lesson" : "Start here";
    text = d.nextLesson.title;
    action = el("a", { class: "btn", href: `lesson.html?id=${encodeURIComponent(d.nextLesson.id)}`, text: d.doneCount ? "Continue" : "Start the first lesson" });
  } else if (!d.testsOk && d.testRows.length) {
    const t = d.testRows.find((x) => !x.ok);
    title = "Next: pass your tests"; text = `${t.t.title}: ${t.pct == null ? "not taken yet" : `best so far ${t.pct}%`}. You need at least ${PASS_TEST}%.`;
    action = el("a", { class: "btn", href: "#tests", "data-tab": "tests", text: "Go to my tests" });
  } else if (!d.project || d.project.status !== "passed") {
    title = "Next: your project"; text = `Score at least ${PASS_PROJECT}% in your personal project to earn the certificate.`;
    action = el("a", { class: "btn", href: "project.html", text: d.project ? "Open my project" : "Get my project" });
  } else if (!d.profile.certificateId) {
    title = "Next: your certificate"; text = "Everything is done. Apply for your certificate; your instructor signs it.";
    action = el("a", { class: "btn", href: "#certificate", "data-tab": "certificate", text: "Apply for my certificate" });
  } else {
    title = "Course complete 🎉"; text = "You finished the course and earned your certificate. Revise any lesson whenever you like.";
    action = el("a", { class: "btn", href: `certificate.html?id=${encodeURIComponent(d.profile.certificateId)}`, text: "Open my certificate" });
  }
  return el("section", { class: "panel next-step" }, el("div", {}, el("span", { class: "eyebrow", text: title }), el("h2", { style: { margin: "4px 0 0" } }, rich(text))), action);
}

function milestones(d) {
  const items = [];
  const reg = (d.profile.registrationCount || 1) > 1 ? `Re-registered (registration ${d.profile.registrationCount})` : "Registration approved";
  items.push({ label: reg, at: ms(d.profile.accessStart), done: true });
  for (const m of d.coreMods) {
    const ls = m.lessons || [];
    if (!ls.length) continue;
    const done = ls.every(d.isDone);
    const at = done ? Math.max(...ls.map((l) => ms(d.prog[l.id].completedAt) || 0)) || null : null;
    const n = ls.filter(d.isDone).length;
    items.push({ label: `${m.title}: all lessons done`, at, done, sub: done ? null : `${n} of ${ls.length} lessons` });
    for (const x of d.testRows.filter((y) => y.t.moduleId === m.id)) testItem(x);
  }
  for (const x of d.testRows.filter((y) => !d.mods.some((m) => m.id === y.t.moduleId))) testItem(x);
  function testItem(x) {
    const pass = d.attempts.filter((a) => a.testId === x.t.id && a.status === "submitted" && a.maxScore && a.score / a.maxScore * 100 >= PASS_TEST)
      .sort((a, b) => ms(a.submittedAt) - ms(b.submittedAt))[0];
    items.push({ label: x.ok ? `${x.t.title} passed` : `Pass the ${x.t.title} (${PASS_TEST}% or more)`, at: pass ? ms(pass.submittedAt) : null, done: x.ok, sub: x.ok ? `Best ${x.pct}%` : x.pct == null ? "Not taken yet" : `Best so far ${x.pct}%` });
  }
  const adv = d.mods.filter((m) => !isCore(m.id)).flatMap((m) => m.lessons || []);
  if (adv.length) {
    const n = adv.filter(d.isDone).length;
    items.push({ label: "Weeks 7 to 9, introductory experience (optional)", at: null, done: n === adv.length, sub: `${n} of ${adv.length} lessons · not part of the certificate` });
  }
  if (d.lifetime) items.push({ label: "Lifetime access unlocked", at: ms(d.profile.lifetimeSince), done: true });
  const pOk = d.project && d.project.status === "passed";
  items.push({ label: pOk ? "Project passed" : `Pass your project (${PASS_PROJECT}% or more)`, at: null, done: pOk, sub: pOk ? `${d.project.best}%` : null });
  items.push({ label: "Certificate issued", at: null, done: !!d.profile.certificateId });
  const doneN = items.filter((i) => i.done).length;
  return el("section", { class: "panel" },
    el("div", { class: "card-head" }, el("h2", { text: "Milestones" }), el("span", { class: "chip", text: `${doneN} of ${items.length}` })),
    el("ol", { class: "timeline" }, items.map((i) => el("li", { class: i.done ? "done" : "" },
      el("span", { class: "dot", "aria-hidden": "true", text: i.done ? "✓" : "" }),
      el("div", {}, el("b", { text: i.label }), el("span", { class: "small muted", text: [i.done && i.at ? new Date(i.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null, i.sub, i.done ? null : "to do"].filter(Boolean).join(" · ") }))))));
}

// ---------- Lessons ----------
function lessonsTab(d) {
  const moduleEls = d.mods.map((m) => {
    const lessons = m.lessons || [];
    const mDone = lessons.filter(d.isDone).length;
    let lastDay = null;
    const rows = lessons.flatMap((l, i) => {
      const dh = l.day && l.day !== lastDay ? el("li", { class: "day-head", text: `Day ${l.day}${l.dayTitle ? `: ${l.dayTitle}` : ""}` }) : null;
      lastDay = l.day || lastDay;
      const p = d.prog[l.id];
      const state = p && p.status === "completed" ? "done" : p ? "going" : "new";
      const isNext = d.nextLesson && d.nextLesson.id === l.id;
      const row = el("li", {}, el("a", { class: `lesson-row${state === "done" ? " is-done" : ""}${isNext ? " is-next" : ""}`, href: `lesson.html?id=${encodeURIComponent(l.id)}` },
        el("span", { class: "num", text: state === "done" ? "✓" : String(i + 1) }),
        el("span", {}, el("span", { class: "t", text: l.title }), el("br"), el("span", { class: "s" }, rich(l.summary || ""))),
        el("span", { class: `chip ${state === "done" ? "done" : state === "going" ? "going" : ""}`, text: state === "done" ? "Done" : state === "going" ? "Started" : isNext ? "Up next" : `${l.minutes || 15} min` })));
      return dh ? [dh, row] : [row];
    });
    const testEls = d.tests.filter((t) => t.moduleId === m.id).map((t) => testRow(t, d.results[t.id], d.attempts.filter((a) => a.testId === t.id), mDone === lessons.length, Number((d.profile.extraAttempts || {})[t.id]) || 0));
    return el("section", { class: "module", "data-mod": m.id },
      el("div", { class: "module-head" }, el("div", {}, el("h2", { text: m.title }), el("p", {}, rich(m.description || "")),
        isCore(m.id) ? null : el("span", { class: "chip going", text: "Introductory experience: not part of the certificate" })),
        el("span", { class: `chip ${mDone === lessons.length && lessons.length ? "done" : ""}`, text: `${mDone}/${lessons.length} lessons` })),
      el("ul", { class: "lessons" }, rows), ...testEls);
  });
  return el("div", { class: "stack" }, moduleEls.length ? moduleEls
    : el("div", { class: "panel" }, el("h2", { text: "No lessons yet" }), el("p", { text: "Your instructor has not published the course content yet. Please check back soon." })));
}

// ---------- Tests & scores ----------
function testsTab(d) {
  if (!d.tests.length) return el("div", { class: "panel" }, el("h2", { text: "No tests yet" }), el("p", { text: "Tests appear here when your instructor publishes them." }));
  const now = Date.now();
  const rows = d.tests.map((t) => {
    const r = d.results[t.id];
    const atts = d.attempts.filter((a) => a.testId === t.id);
    const used = atts.filter((a) => a.status !== "voided").length;
    const allowed = (t.maxAttempts || 1) + (Number((d.profile.extraAttempts || {})[t.id]) || 0);
    const p = pctOf(r);
    const last = atts.filter((a) => a.status === "submitted").sort((a, b) => ms(b.submittedAt) - ms(a.submittedAt))[0];
    const notYet = t.openAt && t.openAt.toMillis() > now;
    const status = notYet ? ["Opens later", "locked"] : p != null && p >= PASS_TEST ? ["Passed", "done"] : used ? ["Not passed yet", "going"] : ["Not taken", ""];
    const hide = t.showScore === false;
    return el("tr", {},
      el("td", {}, el("b", { text: t.title }), el("div", { class: "small muted", text: `${(d.mods.find((m) => m.id === t.moduleId) || {}).title || ""}${isCore(t.moduleId) ? "" : " (optional)"}` })),
      el("td", {}, el("span", { class: `chip ${status[1]}`, text: status[0] })),
      el("td", { class: "num", text: r && !hide ? `${r.best}/${r.max}` : "–" }),
      el("td", { class: "num", text: p != null && !hide ? `${p}%` : "–" }),
      el("td", { class: "num", text: `${used} of ${allowed}` }),
      el("td", { text: last ? fmtDate(last.submittedAt) : "–" }));
  });
  const passed = d.testRows.filter((x) => x.ok).length;
  return el("div", { class: "stack" },
    el("section", { class: "panel" },
      el("div", { class: "card-head" }, el("h2", { text: "Test scores" }), el("span", { class: `chip ${d.testsOk ? "done" : ""}`, text: `${passed} of ${d.testRows.length} passed` })),
      el("p", { class: "small muted", text: `Your best attempt counts. You need ${PASS_TEST}% in every test of Weeks 1 to 6; the Week 7 to 9 tests are optional. Tests are self-paced: take each one when you have finished its lessons, before your access period ends.` }),
      el("div", { class: "table-wrap" }, el("table", { class: "data score-table" },
        el("thead", {}, el("tr", {}, ["Test", "Status", "Best score", "Percent", "Attempts", "Last attempt"].map((h) => el("th", { scope: "col", text: h })))),
        el("tbody", {}, rows)))),
    el("section", { class: "panel" }, el("h2", { text: "Take or review a test" }),
      d.tests.map((t) => {
        const m = d.mods.find((x) => x.id === t.moduleId);
        const lessonsDone = m ? (m.lessons || []).every(d.isDone) : true;
        return testRow(t, d.results[t.id], d.attempts.filter((a) => a.testId === t.id), lessonsDone, Number((d.profile.extraAttempts || {})[t.id]) || 0);
      })));
}

// ---------- Project & certificate ----------
function certificateTab(d) {
  if (d.claims.admin) return el("p", { class: "notice", text: "Instructor accounts do not have a project or certificate." });
  return journey(d);
}

function testRow(t, result, atts, lessonsDone, extra = 0) {
  const now = Date.now();
  const open = (!t.openAt || t.openAt.toMillis() <= now) && (!t.closeAt || t.closeAt.toMillis() > now);
  const used = atts.filter((a) => a.status !== "voided").length;
  const allowed = (t.maxAttempts || 1) + extra;
  const left = Math.max(0, allowed - used);
  const pct = result && result.max ? (result.best / result.max) * 100 : null;
  const running = atts.find((a) => a.status === "in_progress");
  const lastDone = atts.filter((a) => a.status === "submitted").sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis())[0];
  let status = "";
  if (t.openAt && t.openAt.toMillis() > now) status = `Opens ${fmtDate(t.openAt)}`;
  else if (t.closeAt && t.closeAt.toMillis() <= now) status = `Closed ${fmtDate(t.closeAt)}`;
  else status = `${t.closeAt ? `Open until ${fmtDate(t.closeAt)}. ` : ""}${left} of ${allowed} attempt${allowed > 1 ? "s" : ""} left. Pass mark 60%.`;
  if (open && left === 0 && !(pct >= 60) && used > 0) status = `All ${allowed} attempts used without reaching 60%. Ask your instructor for another attempt.`;
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
      el("p", { text: n ? `${n} of ${GAMES.length} game badges earned. Replay any game to practise.` : "Six mini-games and 27 concept animations, one for each big idea. They also appear inside the lessons." })),
    el("div", { class: "shelf" }, GAMES.map((g) => el("div", { class: `shelf-badge${got[g.id] ? " got" : ""}`, title: g.badge },
      el("span", { class: "sb-icon", "aria-hidden": "true", text: g.badgeIcon }), el("span", { class: "sb-name", text: g.badge })))),
    el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
      el("a", { class: "btn btn-ghost btn-small", href: "playground.html", text: "Open the Playground" }),
      el("a", { class: "btn btn-ghost btn-small", href: "playground.html#lab", text: "Concept lab" })));
}

// The four steps to the certificate.
function journey({ profile, doneCount, allLessons, testRows, testsOk, lessonsOk, project, request }) {
  const total = allLessons.length;
  const tick = (ok) => el("span", { class: `chip ${ok ? "done" : ""}`, text: ok ? "✓ Done" : "To do" });
  const ps = project ? project.status : null;
  const projectOk = ps === "passed";
  const projectText = !project ? (lessonsOk ? "Ready to open: you get your own personal project brief." : "Opens when you finish all lessons.")
    : ps === "assigned" ? `Your project: ${project.title}. Not submitted yet.`
    : ps === "submitted" ? `Submitted (submission ${project.attempts.length} of ${project.maxAttempts || 2}). Waiting for marking.`
    : ps === "needs-resubmit" ? `Scored ${project.best}%: below ${PASS_PROJECT}%. You have one more submission.`
    : ps === "passed" ? `Passed with ${project.best}%.`
    : `Not passed (best ${project.best}%). Contact your instructor.`;

  // Certificate: apply (only when eligible) -> instructor signs -> download.
  const eligible = lessonsOk && testsOk && projectOk;
  const certBox = el("div", { class: "cert-apply" });
  const why = [!lessonsOk ? "finish every lesson" : null, !testsOk ? `score at least ${PASS_TEST}% in every test` : null, !projectOk ? `score at least ${PASS_PROJECT}% in your project` : null].filter(Boolean);
  if (profile.certificateId) {
    certBox.append(el("a", { class: "btn", href: `certificate.html?id=${encodeURIComponent(profile.certificateId)}`, text: "Open and download my certificate" }));
  } else if (request && request.status === "pending") {
    certBox.append(el("p", { class: "notice", style: { margin: 0 } }, el("strong", { text: "Applied. " }), `Your certificate is ready and waiting for your instructor's signature (applied ${fmtDate(request.requestedAt)}). You can download it here once it is signed.`));
  } else {
    const btn = el("button", { class: "btn", type: "button", text: "Apply for my certificate", disabled: !eligible });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { await call("applyForCertificate")(); toast("Applied. Your instructor will sign your certificate.", 5000); setTimeout(() => location.reload(), 1200); }
      catch (e) { toast(friendlyError(e), 8000); btn.disabled = false; }
    });
    certBox.append(...[
      request && request.status === "returned" ? el("p", { class: "notice err", style: { margin: "0 0 10px" } }, el("strong", { text: "Your instructor returned your application: " }), request.note || "", " Apply again when it is fixed.") : null,
      btn, eligible ? null : el("p", { class: "small muted", style: { margin: "8px 0 0" }, text: `Available when you ${why.join(", ")}.` })].filter(Boolean));
  }

  return el("section", { class: "panel journey" },
    el("h2", { style: { marginTop: 0 }, text: profile.certificateId ? "Certificate earned 🎓" : "Your path to the certificate" }),
    el("ol", { class: "journey-steps" },
      el("li", {}, el("div", {}, el("strong", { text: "1. Finish every lesson of Weeks 1 to 6" }), el("div", { class: "small muted", text: `${doneCount} of ${total} lessons done` })), tick(lessonsOk)),
      el("li", {}, el("div", {}, el("strong", { text: `2. Score at least ${PASS_TEST}% in every test of Weeks 1 to 6` }),
        el("div", { class: "small muted", text: testRows.length ? testRows.map((x) => `${x.t.title}: ${x.pct == null ? "not taken" : `${x.pct}%`}`).join(", ") : "No tests published yet." })), tick(testsOk)),
      el("li", {}, el("div", {}, el("strong", { text: `3. Score at least ${PASS_PROJECT}% in your project (2 submissions)` }), el("div", { class: "small muted", text: projectText })),
        el("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
          project || lessonsOk ? el("a", { class: "btn btn-white btn-small", href: "project.html", text: project ? "Open my project" : "Get my project" }) : null, tick(projectOk))),
      el("li", {}, el("div", {}, el("strong", { text: "4. Apply for your certificate" }),
        el("div", { class: "small muted", text: "Your instructor checks and signs it. It is valid for 2 years and anyone can verify it online." })), certBox)),
    el("p", { class: "small muted", style: { margin: "12px 0 0" }, text: "The certificate covers Weeks 1 to 6. Weeks 7 to 9 are an introductory experience: open them any time and try their tests, but they are not part of the certificate." }));
}
