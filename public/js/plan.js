// plan.html (Weeks 1–6, the certificate course) and modelling.html (Weeks 7–9, optional): one collapsible card per
// week with its days, lessons and test. Anyone can read the plan (data/course-plan.json: titles only, written by
// tools/build-course-plan.mjs). A signed-in student also sees their progress, read with the portal's own loader
// (course-data.js), so the numbers here and in the Student portal are the same.
import { el } from "./dom.js";
import { paintReg } from "./chrome.js";

const main = document.querySelector("main[data-plan]");
const CORE = main.dataset.plan === "core";
const box = (title, ...kids) => el("div", { class: "ibox" }, el("h3", { text: title }), el("div", { class: "in" }, ...kids));
const shortTitle = (m) => String(m.title || "").replace(/^Week\s*\d+\s*:\s*/i, "");
const weekNo = (m, i) => Number(String(m.short || m.title || "").replace(/^Week\s*(\d+).*$/i, "$1")) || m.week || i + 1;
const NAV_SHORT = { UR: "URDF", XT: "Xacro and TF", RV: "RViz" };   // the prototype's menu labels for Weeks 7–9
const range = (a, b) => (a === b ? `${a}` : `${a}–${b}`);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
// lesson time from the lessons' own minutes (data/course-plan.json), to the nearest half hour; tests and the project are extra
const hours = (ls) => Math.round(ls.reduce((s, l) => s + (l.minutes || 15), 0) / 30) / 2;
const PLAN_MIN = (id) => ((PLAN.modules.find((m) => m.id === id) || {}).lessons || []);

// What you will be able to do (the same outcomes as the home page, index.html): the weeks that teach each one and what
// checks it. Week numbers refer to the weekly tests; "project" points at the marking-scheme line that checks it
// (functions/projects.js RUBRIC). Keep it in step with index.html.
const OUTCOMES = [
  ["Use the Ubuntu terminal to move around, manage files and install software", [1], []],
  ["Write and run short Python programs, and read basic C++", [1, 2], []],
  ["Explain how ROS 2 nodes communicate with topics, services, actions and parameters", [3, 4], []],
  ["Build a ROS 2 package with your own publisher, subscriber and service", [5], ["works", "interfaces", "code"]],
  ["Start two robots with one launch file", [6], ["launch"]],
  ["Use frames, message settings and managed nodes (tf2, QoS, lifecycle)", [6], []],
];

let PLAN = null;

// the weeks of this page, from the public plan or, signed in, from the student's own course data (Firestore)
function weeks(d) {
  if (!d) return PLAN.modules.filter((m) => m.core === CORE).map((m) => ({ ...m, week: m.week, tests: m.tests }));
  return d.mods.filter((m) => (PLAN.rules.coreModules.length ? PLAN.rules.coreModules.includes(m.id) : true) === CORE)
    .map((m, i) => ({
      id: m.id, week: weekNo(m, i), title: m.title, lessons: m.lessons || [],
      tests: d.tests.filter((t) => t.moduleId === m.id).map((t) => ({ id: t.id, title: t.title, minutes: t.totalMinutes || 30, maxAttempts: t.maxAttempts || 2, open: !t.openAt || t.openAt.toMillis() <= Date.now(),
        questions: (t.topics || []).reduce((s, x) => s + (x.count || 0), 0) })),
    }));
}

function render(d) {
  const W = weeks(d);
  const pass = PLAN.rules.passTestPercent;
  const lessonsAll = W.flatMap((w) => w.lessons);
  const done = (l) => !!(d && d.isDone(l));
  const nextId = d ? (lessonsAll.find((l) => !done(l)) || {}).id : null;
  const current = d ? W.find((w) => w.lessons.some((l) => l.id === nextId)) : null;

  // lede: from the data, so the numbers never drift from the content
  const nTests = W.reduce((s, w) => s + w.tests.length, 0);
  const wk = range(W[0].week, W[W.length - 1].week);
  const hoursAll = hours(W.flatMap((w) => PLAN_MIN(w.id)));
  document.getElementById("plan-lede").textContent = CORE
    ? `Weeks ${wk} · ${lessonsAll.length} lessons (about ${hoursAll} hours) · ${nTests} weekly tests · 1 project · certificate valid ${PLAN.rules.certValidYears} years`
    : `Optional module · Weeks ${wk} · ${lessonsAll.length} lessons (about ${hoursAll} hours) · ${nTests} optional tests`;

  // ---- left menu ----
  const nav = document.getElementById("plan-nav");
  nav.replaceChildren(...[el("p", { class: "navlabel", text: "Weeks" }), ...W.map((w) => {
    const n = w.lessons.filter(done).length, all = d && n === w.lessons.length && n > 0;
    return el("a", { href: `#wk${w.week}`, class: all ? "done" : "", "aria-current": current === w ? "step" : null },
      CORE ? `Week ${w.week}` : `Week ${w.week} · ${NAV_SHORT[w.id] || shortTitle(w)}`, d && !all && n ? el("small", { text: `${n}/${w.lessons.length}` }) : d && all ? el("small", { text: "Done" }) : null);
  }), CORE ? el("a", { href: "#req", text: "Requirements" }) : null,
  CORE ? el("a", { href: "modelling.html", text: "Weeks 7–9 (optional)" }) : el("a", { href: "plan.html", text: "Certificate course" })].filter(Boolean));

  // ---- week cards: open the week in the address (#wk4), else the student's current week, else the first ----
  const hashWeek = W.find((w) => location.hash === `#wk${w.week}`);
  const openWeek = hashWeek || current || W[0];
  const cards = W.map((w) => {
    const days = w.lessons.map((l) => l.day).filter(Boolean);
    const h = hours(w.lessons.map((l) => ({ ...l, minutes: l.minutes || (PLAN_MIN(w.id).find((x) => x.id === l.id) || {}).minutes })));
    const n = w.lessons.filter(done).length;
    const badge = !d ? null : n === w.lessons.length && n ? el("span", { class: "badge ok", text: "✓ Done" })
      : n ? el("span", { class: "badge now", text: `${n} of ${w.lessons.length} done` }) : el("span", { class: "badge todo", text: "Not started" });
    const rows = [];
    let day = null;
    for (const l of w.lessons) {
      if (l.day && l.day !== day) { day = l.day; rows.push(el("li", { class: "dayh" }, el("b", { text: `Day ${l.day}` }), l.dayTitle ? ` · ${l.dayTitle}` : "")); }
      const p = d && d.prog[l.id];
      const meta = !d ? `${l.minutes || 15} min` : done(l) ? "Done" : l.id === nextId ? "Next" : p ? "Started" : `${l.minutes || 15} min`;
      rows.push(el("li", { class: `les${done(l) ? " done" : ""}${l.id === nextId ? " next" : ""}` },
        el("a", { href: `lesson.html?id=${encodeURIComponent(l.id)}`, text: l.title }), el("span", { class: "m", text: meta })));
    }
    for (const t of w.tests) rows.push(testRow(t, d, pass));
    if (!w.tests.length) rows.push(el("li", { class: "test" }, el("span", { class: "tt", text: "Test" }), el("span", { class: "m", text: "Not published yet" })));
    return el("details", { class: `wkcard${current === w ? " current" : ""}`, id: `wk${w.week}`, open: w === openWeek || null },
      el("summary", {}, el("span", { class: "num", text: `Week ${w.week}` }),
        el("span", { class: "t", text: shortTitle(w) }, el("span", { class: "s", text: `${days.length ? `Days ${range(days[0], days[days.length - 1])} · ` : ""}${plural(w.lessons.length, "lesson")} · about ${h} h` })), badge),
      el("ul", {}, rows));
  });
  document.getElementById("plan-weeks").replaceChildren(...[
    el("div", { class: "plan-h" }, el("h2", { text: CORE ? "Course plan" : "Module plan" }),
      el("button", { type: "button", class: "btn btn-sec btn-small", onclick: () => { openAll(); print(); } }, "Print or save as PDF")),
    CORE ? null : el("div", { class: "intro2" }, el("div", {}, el("h3", { text: "What you will build" }),
      el("p", { text: "Chiku, the course’s two-wheeled robot, written link by link in URDF. Then robot arms, viewed and moved in RViz." })),
      el("img", { src: "img/robots/chiku.webp", alt: "Chiku robot model", width: "800", height: "600", loading: "lazy" })),
    ...cards, CORE ? outcomes(W) : null, CORE ? projectCard() : null].filter(Boolean));

  // ---- right column ----
  document.getElementById("plan-aside").replaceChildren(...(d ? progressBoxes(d, W, lessonsAll, done, nextId, current) : signedOutBoxes()));
  paintReg();
  openHash(false);
}

// the outcomes matrix (docs/redesign/reviews/curriculum.md #3)
function outcomes(W) {
  const testOf = (n) => { const w = W.find((x) => x.week === n); return w && w.tests[0] ? w.tests[0].title : `Week ${n} test`; };
  const rub = Object.fromEntries(PLAN.project.rubric.map((r) => [r.id, r]));
  return el("section", { class: "outc", "aria-labelledby": "outc-h" }, el("h2", { id: "outc-h", text: "What you will be able to do" }),
    el("div", { class: "tablewrap" }, el("table", { class: "tbl keep3" },
      el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Outcome" }), el("th", { scope: "col", text: "Weeks" }), el("th", { scope: "col", text: "Checked by" }))),
      el("tbody", {}, ...OUTCOMES.map(([o, wks, proj]) => el("tr", {}, el("td", { text: o }),
        el("td", { text: wks.length > 1 ? `${wks[0]}–${wks[wks.length - 1]}` : String(wks[0]) }),
        el("td", {}, [...wks.map(testOf), ...(proj.length ? [`Project (${proj.map((id) => `${id} ${rub[id].max}`).join(", ")} marks)`] : [])].join(" · "))))))));
}

// the personal project: what, what to hand in, how it is marked and by whom, resubmissions (curriculum.md #4).
// Everything comes from functions/config.js and functions/projects.js through data/course-plan.json.
function projectCard() {
  const r = PLAN.rules, p = PLAN.project, total = p.rubric.reduce((s, x) => s + x.max, 0);
  return el("section", { class: "projc", id: "project", "aria-labelledby": "proj-h" }, el("h2", { id: "proj-h", text: "Your project" }),
    el("p", { text: `When every lesson of Weeks 1–6 is done, the Student portal gives you your own project brief: a small ROS 2 package, one of ${p.types} project types, filled in with names and numbers chosen for you. Write it in Python or C++.` }),
    el("h3", { text: "What you hand in" }), el("ul", {}, ...p.deliverables.map((x) => el("li", { text: x }))),
    el("h3", { text: "How it is marked" }),
    el("div", { class: "tablewrap" }, el("table", { class: "tbl rubric" },
      el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Part" }), el("th", { scope: "col", text: "Marks" }))),
      el("tbody", {}, ...p.rubric.map((x) => el("tr", {}, el("td", { text: x.label }), el("td", { text: String(x.max) }))),
        el("tr", { class: "tot" }, el("th", { scope: "row", text: `Total · ${r.passProjectPercent} passes` }), el("td", { text: String(total) }))))),
    el("p", { text: `Your instructor marks each submission with this scheme and writes feedback. Up to ${r.projectMaxAttempts} submissions: if the first scores below ${r.passProjectPercent}, you improve it and submit again. If a genuine problem spoils a submission (for example a wrong file), your instructor can allow one more.` }));
}

// printing (or "Save as PDF") shows every week open
function openAll() { document.querySelectorAll("#plan-weeks details").forEach((x) => { x.open = true; }); }
addEventListener("beforeprint", openAll);

function testRow(t, d, pass) {
  const facts = `${t.questions} questions · ${t.minutes} min · ${plural(t.maxAttempts, "attempt")}`;
  let state = CORE ? `${pass}% to pass` : "Does not count";
  if (d) {
    const r = d.results[t.id], pct = r && r.max ? Math.round((r.best / r.max) * 1000) / 10 : null;
    state = !t.open ? "Opens later" : pct == null ? "Not taken" : pct >= pass ? `Passed · best ${pct}%` : `Best so far ${pct}%`;
  }
  return el("li", { class: "test" }, el("span", { class: "tt" }, el("b", { text: t.title }), el("small", { text: facts })),
    el("span", { class: "m" }, d ? el("a", { href: "course.html#tests", text: state }) : state));
}

function signedOutBoxes() {
  const r = PLAN.rules;
  return [
    box("Register free", el("p", { text: "Lessons, tests and the certificate open after you register and log in. Your progress shows here." }),
      el("a", { class: "btn btn-main", href: "register.html", "data-reg": "", text: "Register free" }),
      el("p", { class: "meta" }, "Already registered? ", el("a", { href: "signin.html", text: "Log in" }))),
    CORE ? el("div", { class: "ibox", id: "req" }, el("h3", { text: "Certificate requirements" }), el("div", { class: "in" }, el("ol", { class: "reqs" },
      req(false, "Finish all lessons of Weeks 1–6"), req(false, `Score ${r.passTestPercent}% or more on each weekly test`, "Best score counts"),
      req(false, `Score ${r.passProjectPercent}% or more on your project`, `Up to ${r.projectMaxAttempts} submissions`),
      req(false, "Apply for the certificate", el("span", {}, `Issued online, valid ${r.certValidYears} years · `, el("a", { href: "certificate.html", text: "sample" }))))))
      : box("Not part of the certificate", el("p", { class: "meta", text: "Its tests do not count for the certificate or lifetime access. Weeks 1–6 are the certificate course." }),
        el("a", { class: "arrow", href: "plan.html", text: "Certificate course plan" })),
  ];
}

function req(ok, text, sub) {
  return el("li", { class: ok ? "ok" : "" }, el("span", { class: "c", "aria-hidden": "true", text: ok ? "✓" : "" }),
    el("span", {}, ok ? el("span", { class: "sr-only", text: "Done: " }) : null, text, sub ? el("small", {}, sub) : null));
}

function progressBoxes(d, W, lessonsAll, done, nextId, current) {
  const n = lessonsAll.filter(done).length, pct = lessonsAll.length ? Math.round((n / lessonsAll.length) * 100) : 0;
  const next = lessonsAll.find((l) => l.id === nextId);
  const prog = box("Your progress", el("div", { class: "meta", text: `${n} of ${lessonsAll.length} lessons · ${pct}%` }),
    el("div", { class: "bar-meter", role: "img", "aria-label": `${pct}% of lessons done` }, el("i", { style: { width: `${pct}%` } })),
    next ? el("a", { class: "btn btn-main wide", href: `lesson.html?id=${encodeURIComponent(next.id)}`, text: n ? `Continue Week ${current.week}` : `Start Week ${current.week}` })
      : el("p", { class: "meta", text: CORE ? "Every lesson of Weeks 1–6 is done." : "Every lesson of Weeks 7–9 is done." }),
    el("a", { class: "arrow", href: "course.html", text: "Student portal" }));
  if (!CORE) {
    const ts = W.flatMap((w) => w.tests), passed = ts.filter((t) => { const r = d.results[t.id]; return r && r.max && (r.best / r.max) * 100 >= PLAN.rules.passTestPercent; }).length;
    return [prog, box("Not part of the certificate", el("p", { class: "meta", text: `${passed} of ${ts.length} optional tests passed. They do not count for the certificate or lifetime access.` }))];
  }
  if (d.claims.admin) return [prog, box("Certificate requirements", el("p", { class: "meta", text: "Instructor accounts do not have a project or certificate." }))];
  const ps = d.project ? d.project.status : null, projectOk = ps === "passed";
  const projSub = !d.project ? (d.lessonsOk ? "Ready to open" : "Opens after the lessons") : ps === "passed" ? `Passed with ${d.project.best}%`
    : ps === "submitted" ? "Being marked" : ps === "needs-resubmit" ? `Scored ${d.project.best}%: one more submission` : ps === "assigned" ? "Not submitted yet" : `Best ${d.project.best}%`;
  const cert = d.profile.certificateId ? "Issued" : d.request && d.request.status === "pending" ? "Applied: waiting for the signature" : `Valid ${PLAN.rules.certValidYears} years once issued`;
  return [prog, el("div", { class: "ibox", id: "req" }, el("h3", { text: "Certificate requirements" }), el("div", { class: "in" },
    el("ol", { class: "reqs" },
      req(d.lessonsOk, "Finish all lessons", `${d.doneCount} of ${d.allLessons.length}`),
      req(d.testsOk, `Score ${PLAN.rules.passTestPercent}% or more on each weekly test`, `${d.testsPassed} of ${d.testRows.length} open tests passed`),
      req(projectOk, `Score ${PLAN.rules.passProjectPercent}% or more on your project`, projSub),
      req(!!d.profile.certificateId, "Apply for the certificate", cert)),
    el("a", { class: "btn btn-sec wide", href: "course.html#certificate", text: d.profile.certificateId ? "Open my certificate" : "Project & certificate" })))];
}

// /plan.html#wk4 opens Week 4 and scrolls to it; #req scrolls to the requirements
function openHash(smooth) {
  const id = location.hash.slice(1);
  if (!/^(wk\d+|req)$/.test(id)) return;
  const t = document.getElementById(id);
  if (!t) return;
  if (t.tagName === "DETAILS") t.open = true;
  t.scrollIntoView({ behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto", block: "start" });
}
addEventListener("hashchange", () => openHash(true));

(async () => {
  try {
    PLAN = await (await fetch("data/course-plan.json")).json();
    render(null);
  } catch {
    document.getElementById("plan-status").textContent = "The plan could not load. Check your connection and reload the page.";
    return;
  }
  // signed in and registered: the student's own progress
  try {
    const [{ auth, onAuthStateChanged }, { getStage }, { loadCourse }] = await Promise.all([import("./fb.js"), import("./common.js"), import("./course-data.js")]);
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const st = await getStage(user);
      if (st.stage !== "approved" && st.stage !== "admin") return;   // the register box's button says what to do next (chrome.js)
      const d = await loadCourse({ user, profile: st.profile || {}, claims: st.claims || {} });
      render(d);
    });
  } catch { /* offline or Firebase blocked: the plan without progress stays */ }
})();
