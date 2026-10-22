// "My course": the student's dashboard with tabs for Overview, Lessons, Tests & scores,
// and Project & certificate.
import { auth, call, getIdTokenResult } from "./fb.js";
import { el, rich, requireMember, friendlyError, footer, fmtDate, toast, accessInfo } from "./common.js";
import { accessCard, extensionBox } from "./access-ui.js";
import { GAMES } from "./games/registry.js";
import { badges } from "./games/shell.js";
import { PASS_TEST, PASS_PROJECT, isCore, pctOf, loadCourse } from "./course-data.js";

const main = document.getElementById("main");
const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : null);

(async () => {
  let ctx;
  try { ctx = await requireMember(); } catch { return; }
  const { profile, claims } = ctx;
  try {
    const data = await loadCourse(ctx);
    const { lifetime, lessonsOk, testsOk, nextLesson, doneCount, allLessons } = data;
    const pct = allLessons.length ? Math.round((doneCount / allLessons.length) * 100) : 0;

    // Everything done on this side but no lifetime yet (the last test just ended): ask the server.
    if (!claims.admin && !lifetime && lessonsOk && testsOk) {
      call("checkCompletion")().then((r) => { if (r.data && r.data.granted) { toast("Lifetime access unlocked!", 5000); getIdTokenResult(auth.currentUser, true).finally(() => setTimeout(() => location.reload(), 1500)); } }).catch(() => {});
    }

    const fill = el("span", { style: { width: pct + "%" } });
    const head = el("div", { class: "pagehead" }, el("div", { class: "wrap" },
      el("p", { class: "crumbs" }, el("a", { href: "index.html", text: "Home" }), " › Student portal"),
      el("div", { class: "dash-head" },
        el("div", {}, el("h1", { text: `Hello, ${(profile.fullName || "there").split(" ")[0]}` }),
          el("p", { class: "lede", text: "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes" })),
        el("div", { class: "head-meter" }, el("div", { class: "meter", title: `${pct}% of lessons done` }, fill), el("span", { class: "meta", text: `${pct}% of lessons done` })))));

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

    main.classList.add("v3portal");
    main.replaceChildren(head, el("div", { class: "wrap" }, claims.admin ? null : statCards(data),
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
const weekNo = (m, i) => Number(String(m.short || m.title || "").replace(/^Week\s*(\d+).*$/i, "$1")) || m.week || i + 1;
const modOfLesson = (d, l) => d.mods.findIndex((m) => (m.lessons || []).some((x) => x.id === l.id));

function overviewTab(d) {
  const admin = d.claims.admin;
  return el("div", { class: "pv-grid" },
    el("div", { class: "pv-main" },
      admin ? el("p", { class: "alert", text: "Instructor view: this is what students see. You have no access period." }) : null,
      nextStep(d), testsLine(d), myCourses(d),
      admin ? null : milestones(d), arcade(), usefulLinks()),
    el("aside", { class: "pv-aside", "aria-label": "Access and notices" },
      admin ? null : accessCard(d.profile, d.claims), admin ? null : extensionBox(d.profile, d.claims, { compact: true }), notices(d)));
}

// "Continue where you left off": the next lesson with its week and day, or the next step once the lessons are done.
function nextStep(d) {
  let title, text, action;
  const first = (d.profile.fullName || "there").split(" ")[0];
  if (d.nextLesson) {
    const k = modOfLesson(d, d.nextLesson), l = d.nextLesson;
    title = d.doneCount ? `Welcome back, ${first}. Continue where you left off` : `Welcome, ${first}. Start here`;
    text = `${k >= 0 ? `Week ${weekNo(d.mods[k], k)}, ` : ""}${l.day ? `Day ${l.day}: ` : ""}${l.title}`;
    action = el("a", { class: "btn btn-main", href: `lesson.html?id=${encodeURIComponent(l.id)}`, text: d.doneCount ? "Continue" : "Start the first lesson" });
  } else if (!d.testsOk && d.testRows.length) {
    const t = d.testRows.find((x) => !x.ok);
    title = "Next: pass your tests"; text = `${t.t.title}: ${t.pct == null ? "not taken yet" : `best so far ${t.pct}%`}. You need at least ${PASS_TEST}%.`;
    action = el("a", { class: "btn btn-main", href: "#tests", "data-tab": "tests", text: "Go to my tests" });
  } else if (!d.project || d.project.status !== "passed") {
    title = "Next: your project"; text = `Score at least ${PASS_PROJECT}% in your personal project to earn the certificate.`;
    action = el("a", { class: "btn btn-main", href: "project.html", text: d.project ? "Open my project" : "Get my project" });
  } else if (!d.profile.certificateId) {
    title = "Next: your certificate"; text = "Everything is done. Apply for your certificate; your instructor signs it.";
    action = el("a", { class: "btn btn-main", href: "#certificate", "data-tab": "certificate", text: "Apply for my certificate" });
  } else {
    title = "Course complete 🎉"; text = "You finished the course and earned your certificate. Revise any lesson whenever you like.";
    action = el("a", { class: "btn btn-main", href: `certificate.html?id=${encodeURIComponent(d.profile.certificateId)}`, text: "Open my certificate" });
  }
  return el("section", { class: "welcome next-step" }, el("div", {}, el("p", { class: "meta", text: title }), el("h2", {}, rich(text))), action);
}

// Per core week: the test result, or when the test opens. Everything comes from d (tests, results, lesson progress).
function testFacts(d) {
  const facts = [];
  d.coreMods.forEach((m) => {
    const k = d.mods.indexOf(m), left = (m.lessons || []).filter((l) => !d.isDone(l)).length;
    for (const t of d.tests.filter((x) => x.moduleId === m.id)) {
      const p = pctOf(d.results[t.id]), shown = t.showScore !== false;
      const wk = `Week ${weekNo(m, k)}`;
      if (p != null && p >= PASS_TEST) facts.push({ wk, text: shown ? `${p}% ✓` : "passed ✓", state: "pass" });
      else if (p != null) facts.push({ wk, text: shown ? `best so far ${p}%` : "not passed yet", state: "try" });
      else if (t.openAt && t.openAt.toMillis() > Date.now()) facts.push({ wk, text: `opens ${fmtDate(t.openAt)}`, state: "wait" });
      else if (left && t.requireLessons) facts.push({ wk, text: `test opens after ${left} more lesson${left === 1 ? "" : "s"}`, state: "wait", left });
    }
  });
  return facts;
}

function testsLine(d) {
  const facts = testFacts(d);
  const shown = facts.filter((f) => f.state !== "wait").concat(facts.filter((f) => f.state === "wait").slice(0, 1));   // results, plus the next test that is waiting
  if (!shown.length) return null;
  return el("p", { class: "testsline" }, "Tests: ", shown.flatMap((f, i) => [i ? " · " : null,
    f.state === "wait" ? `${f.wk} ${f.text.replace(/^test /, "")}` : el("span", {}, `${f.wk} `, el("b", { text: f.text }))]));
}

function myCourses(d) {
  const optional = d.mods.filter((m) => !isCore(m.id)), optLessons = optional.flatMap((m) => m.lessons || []), optDone = optLessons.filter(d.isDone).length;
  const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);
  const card = (cls, label, title, href, n, t, meta) => el("a", { class: `card ${cls}`, href },
    el("span", { class: `lbl ${cls === "c-cert" ? "cert" : "lopt"}`, text: label }), el("h3", { text: title }),
    el("div", { class: "bar-meter", role: "img", "aria-label": `${pct(n, t)}% of lessons done` }, el("i", { style: { width: `${pct(n, t)}%` } })), el("span", { class: "meta", text: meta }));
  return el("section", { "aria-labelledby": "mc-h" }, el("h2", { id: "mc-h", text: "My courses" }),
    el("div", { class: "cards" },
      card("c-cert", "Certificate", "Certificate course", "plan.html", d.doneCount, d.allLessons.length, `${d.doneCount} of ${d.allLessons.length} lessons · ${d.testsPassed} of ${d.testRows.length} tests passed`),
      optLessons.length ? card("c-opt", "Optional", "Robot modelling & RViz", "modelling.html", optDone, optLessons.length,
        optDone ? `${optDone} of ${optLessons.length} lessons · not part of the certificate` : "Not started · not part of the certificate") : null));
}

function usefulLinks() {
  return el("section", { "aria-labelledby": "ul-h" }, el("h2", { id: "ul-h", text: "Useful links" }),
    el("div", { class: "links" },
      el("a", { href: "#tests", "data-tab": "tests", text: "Tests and scores" }), el("a", { href: "plan.html#req", text: "Certificate requirements" }),
      el("a", { href: "rviz.html", text: "Robot simulator" }), el("a", { href: "playground.html", text: "Playground" }), el("a", { href: "index.html#faq", text: "Help and questions" })));
}

function notices(d) {
  const items = [];
  const note = (big, small, title, text) => el("div", { class: "note" }, el("div", { class: "n" }, el("b", { text: big }), small ? el("small", { text: small }) : null), el("div", {}, el("b", { text: title }), el("br"), el("span", { class: "meta", text })));
  const info = d.claims.admin ? null : accessInfo(d.profile, d.claims);
  if (info && info.lifetime) items.push(note("∞", null, "Lifetime access", "The course stays open for you to revise whenever you like."));
  else if (info) items.push(info.ended ? note("0", "days", "Access period", "Your access period has ended.")
    : note(String(info.daysLeft), info.daysLeft === 1 ? "day" : "days", "Access period", `${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"} left: finish Weeks 1 to 6 and pass their tests by ${fmtDate(new Date(info.until))} to keep lifetime access. If not, the registration closes then.`));
  // at the student's own pace so far (lessons done ÷ days since the start): when the Weeks 1–6 lessons would be done
  const leftL = d.allLessons.length - d.doneCount;
  if (info && !info.lifetime && !info.ended && d.doneCount && leftL > 0) {
    const perDay = d.doneCount / info.dayNo, at = Date.now() + Math.ceil(leftL / perDay) * 86400000;
    items.push(note(String(leftL), leftL === 1 ? "lesson" : "lessons", "At your pace",
      `${leftL} lesson${leftL === 1 ? "" : "s"} of Weeks 1 to 6 left. At ${perDay >= 10 ? Math.round(perDay) : Math.round(perDay * 10) / 10} a day you finish them around ${fmtDate(new Date(at))}${at > info.until ? ", after your access ends: speed up a little" : ""}.`));
  }
  const w = testFacts(d).find((f) => f.state === "wait" && f.left);
  if (w) items.push(note(String(w.left), w.left === 1 ? "lesson" : "lessons", `${w.wk} test`, `${w.left} lesson${w.left === 1 ? "" : "s"} left before your ${w.wk} test opens.`));
  if (!d.claims.admin && d.request && d.request.status === "pending") items.push(note("✓", null, "Certificate", "Applied. Waiting for your instructor's signature."));
  if (!items.length) return null;
  return el("section", { class: "ibox notices" }, el("h3", { text: "Notices" }), el("div", { class: "in" }, items));
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
// The same week cards as plan.html (theme.css .wkcard): Done / Started / Next, the week's tests inside the card.
function lessonsTab(d) {
  const nextId = d.nextLesson ? d.nextLesson.id : null;
  const cards = d.mods.map((m, k) => {
    const lessons = m.lessons || [];
    const mDone = lessons.filter(d.isDone).length;
    const current = lessons.some((l) => l.id === nextId);
    const days = lessons.map((l) => l.day).filter(Boolean);
    const rows = [];
    let day = null;
    for (const l of lessons) {
      if (l.day && l.day !== day) { day = l.day; rows.push(el("li", { class: "dayh" }, el("b", { text: `Day ${l.day}` }), l.dayTitle ? ` · ${l.dayTitle}` : "")); }
      const p = d.prog[l.id], done = d.isDone(l);
      const meta = done ? "Done" : l.id === nextId ? "Next" : p ? "Started" : `${l.minutes || 15} min`;
      rows.push(el("li", { class: `les${done ? " done" : ""}${l.id === nextId ? " next" : ""}` },
        el("span", {}, el("a", { href: `lesson.html?id=${encodeURIComponent(l.id)}`, text: l.title }), l.summary ? el("span", { class: "sub" }, rich(l.summary)) : null),
        el("span", { class: "m", text: meta })));
    }
    const badge = mDone === lessons.length && mDone ? el("span", { class: "badge ok", text: "✓ Done" })
      : mDone ? el("span", { class: "badge now", text: `${mDone} of ${lessons.length} done` }) : el("span", { class: "badge todo", text: "Not started" });
    const tests = d.tests.filter((t) => t.moduleId === m.id).map((t) => testRow(t, d.results[t.id], d.attempts.filter((a) => a.testId === t.id), mDone === lessons.length, Number((d.profile.extraAttempts || {})[t.id]) || 0));
    return el("details", { class: `wkcard${current ? " current" : ""}`, "data-mod": m.id, open: current || (!nextId && k === 0) || null },
      el("summary", {}, el("span", { class: "num", text: `Week ${weekNo(m, k)}` }),
        el("span", { class: "t" }, String(m.title || "").replace(/^Week\s*\d+\s*:\s*/i, ""), el("span", { class: "s", text: `${days.length ? `Days ${days[0]}–${days[days.length - 1]} · ` : ""}${lessons.length} lessons` })), badge),
      el("div", { class: "wk-intro" }, m.description ? el("p", {}, rich(m.description)) : null,
        isCore(m.id) ? null : el("span", { class: "lbl lopt", text: "Introductory experience: not part of the certificate" })),
      el("ul", { class: "lessons" }, rows), tests.length ? el("div", { class: "wk-tests" }, tests) : null);
  });
  return el("div", { class: "pv-weeks" }, cards.length ? cards
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
      el("div", { class: "table-wrap tablewrap" }, el("table", { class: "data score-table" },
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
