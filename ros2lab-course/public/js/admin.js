import { db, storage, call, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, collectionGroup, writeBatch, Timestamp, query, where, storageRef, getBlob } from "./fb.js";
import { el, requireMember, friendlyError, fmtDate, toast } from "./common.js";
import { REGISTRATION_MODE } from "./firebase-config.js";

const main = document.getElementById("main");
const voidAttempt = call("adminVoidAttempt");
let DATA = null;

(async () => {
  try { await requireMember({ admin: true }); } catch { return; }
  const tabs = [...(REGISTRATION_MODE === "auto" ? [] : ["Registrations"]), "Students", "Tests", "Course content", "Help"];
  const bar = el("div", { class: "tabs", role: "tablist" });
  const view = el("div");
  tabs.forEach((t, i) => {
    const b = el("button", { type: "button", role: "tab", "aria-selected": i === 0 ? "true" : "false", text: t });
    b.addEventListener("click", () => { bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", "false")); b.setAttribute("aria-selected", "true"); show(t); });
    bar.append(b);
  });
  main.replaceChildren(el("div", { class: "wrap" }, el("h1", { style: { marginTop: "28px" }, text: "Instructor dashboard" }), bar, view));
  async function show(t) {
    view.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
    try {
      if (t === "Registrations") view.replaceChildren(await registrationsView());
      else if (t === "Students") { await load(); view.replaceChildren(studentsView()); }
      else if (t === "Tests") { await load(); view.replaceChildren(testsView()); }
      else if (t === "Course content") view.replaceChildren(contentView());
      else view.replaceChildren(helpView());
    } catch (e) { view.replaceChildren(el("p", { class: "notice err", text: friendlyError(e) })); }
  }
  show(tabs[0]);
})();

// ---------------- data ----------------
async function load(force = false) {
  if (DATA && !force) return DATA;
  const [users, prog, results, attempts, events, modules, tests] = await Promise.all([
    getDocs(collection(db, "users")), getDocs(collectionGroup(db, "lessonProgress")), getDocs(collection(db, "results")),
    getDocs(collection(db, "attempts")), getDocs(collectionGroup(db, "integrityEvents")), getDocs(collection(db, "modules")), getDocs(collection(db, "tests")),
  ]);
  const mods = modules.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  const lessonList = mods.flatMap((m) => (m.lessons || []).map((l) => ({ ...l, moduleId: m.id })));
  const testList = tests.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  const atts = attempts.docs.map((d) => ({ id: d.id, ...d.data() }));
  const evByAttempt = {};
  for (const e of events.docs) { const aid = e.ref.parent.parent.id; (evByAttempt[aid] = evByAttempt[aid] || []).push(e.data()); }
  const progByUser = {};
  for (const p of prog.docs) { const uid = p.ref.parent.parent.id; (progByUser[uid] = progByUser[uid] || {})[p.id] = p.data(); }
  const resByUser = {};
  for (const r of results.docs) { const x = r.data(); (resByUser[x.uid] = resByUser[x.uid] || {})[x.testId] = x; }
  const rows = users.docs.map((u) => {
    const d = u.data(), uid = u.id, p = progByUser[uid] || {};
    const myAtts = atts.filter((a) => a.uid === uid);
    const flags = myAtts.reduce((s, a) => s + (evByAttempt[a.id] || []).length, 0);
    const last = Object.values(p).reduce((m, x) => Math.max(m, x.lastUpdate ? x.lastUpdate.toMillis() : 0), 0);
    return {
      uid, name: d.fullName || "", usn: d.usn, semester: d.semester, institution: d.institution || "", department: d.department || "", gradYear: d.gradYear || "", status: d.status || "not submitted", email: d.email, joined: d.createdAt,
      lessonsDone: Object.values(p).filter((x) => x.status === "completed").length,
      minutes: Math.round(Object.values(p).reduce((s, x) => s + (x.activeSeconds || 0), 0) / 60),
      lastActive: last ? new Date(last) : null, flags, progress: p, attempts: myAtts, results: resByUser[uid] || {},
    };
  });
  DATA = { rows, lessonList, testList, mods, evByAttempt };
  return DATA;
}

// ---------------- registrations (ID card review) ----------------
const reviewRegistration = call("reviewRegistration");
const REJECT_REASONS = [
  "The photo is not clear enough to read. Please take a sharper photo in good light.",
  "This is not a college ID card. Please upload your college ID card only.",
  "The name or USN does not match the ID card. Please correct your details or upload the right card.",
  "The ID card has expired. Please upload your current college ID card.",
  "Other (type the reason below)",
];
async function registrationsView() {
  const filter = el("select", { "aria-label": "Show" }, ["pending", "rejected", "approved"].map((x) => el("option", { value: x, text: x === "pending" ? "Waiting for review" : x === "rejected" ? "Rejected" : "Approved" })));
  const list = el("div", { class: "stack" });
  const count = el("span", { class: "muted small" });
  async function paint() {
    list.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
    const snap = await getDocs(query(collection(db, "users"), where("status", "==", filter.value)));
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .sort((x, y) => ((x.submittedAt && x.submittedAt.toMillis()) || 0) - ((y.submittedAt && y.submittedAt.toMillis()) || 0));
    count.textContent = `${users.length} ${filter.value === "pending" ? "waiting" : filter.value}`;
    if (!users.length) { list.replaceChildren(el("p", { class: "notice ok", text: filter.value === "pending" ? "No registrations are waiting. Well done!" : "None." })); return; }
    list.replaceChildren(...users.slice(0, 25).map((u) => card(u)));
    if (users.length > 25) list.append(el("p", { class: "muted", text: `Showing the oldest 25 of ${users.length}. Review these, then the next ones appear.` }));
  }
  function card(u) {
    const withId = REGISTRATION_MODE === "id-card";
    const box = withId ? el("div", { class: "id-box" }, el("span", { class: "muted", text: u.status === "pending" ? "Loading ID card…" : "ID card photo already deleted after review" })) : null;
    if (withId && u.status === "pending") {
      getBlob(storageRef(storage, `idcards/${u.uid}/idcard.jpg`)).then((b) => {
        const img = el("img", { alt: `College ID card of ${u.fullName}` });
        img.src = URL.createObjectURL(b);
        box.replaceChildren(img);
      }).catch(() => box.replaceChildren(el("span", { class: "muted", text: "No ID card photo found." })));
    }
    const reason = el("select", { "aria-label": "Reason for rejecting" }, REJECT_REASONS.map((r) => el("option", { value: r, text: r.length > 60 ? r.slice(0, 57) + "…" : r })));
    const other = el("input", { placeholder: "Reason shown to the student", maxlength: "300", hidden: true });
    reason.addEventListener("change", () => { other.hidden = !reason.value.startsWith("Other"); });
    const approve = el("button", { class: "btn btn-small", type: "button", text: "Approve" });
    const reject = el("button", { class: "btn btn-danger btn-small", type: "button", text: "Reject" });
    const node = el("section", { class: `panel reg-card${withId ? "" : " no-id"}` }, box, el("div", {},
      el("h3", { style: { marginTop: 0 }, text: u.fullName }),
      el("dl", {},
        el("dt", { text: "College" }), el("dd", { text: u.institution }),
        el("dt", { text: "Department" }), el("dd", { text: u.department }),
        el("dt", { text: "Semester" }), el("dd", { text: String(u.semester) }),
        el("dt", { text: "USN" }), el("dd", { text: u.usn }),
        el("dt", { text: "Passing out" }), el("dd", { text: String(u.gradYear) }),
        el("dt", { text: "Email" }), el("dd", { text: u.email }),
        el("dt", { text: "Submitted" }), el("dd", { text: `${fmtDate(u.submittedAt)} (${withId ? "upload" : "submission"} ${u.submissions || 1} of 3)` }),
        u.rejectReason ? el("dt", { text: "Reason" }) : null, u.rejectReason ? el("dd", { text: u.rejectReason }) : null),
      u.status === "pending" ? el("p", { class: "small muted", text: withId ? "Check: the name, college, photo and validity date on the card match the details above, and the card is current." : "Check: the college, department, USN and year of passing out look genuine. If unsure, email the student before approving." }) : null,
      u.status === "pending" ? el("div", { class: "reg-actions" }, approve, reason, other, reject) : null));
    const decide = async (decision) => {
      const why = decision === "rejected" ? (reason.value.startsWith("Other") ? other.value.trim() : reason.value) : "";
      if (decision === "rejected" && !why) { toast("Please type a reason for rejecting."); return; }
      approve.disabled = reject.disabled = true;
      try {
        await reviewRegistration({ uid: u.uid, decision, reason: why });
        DATA = null;
        node.replaceChildren(el("p", { class: `notice ${decision === "approved" ? "ok" : "err"}`, text: `${u.fullName}: ${decision}.${withId ? " The ID card photo was deleted." : ""}` }));
      } catch (e) { approve.disabled = reject.disabled = false; toast(friendlyError(e), 6000); }
    };
    approve.addEventListener("click", () => decide("approved"));
    reject.addEventListener("click", () => decide("rejected"));
    return node;
  }
  filter.addEventListener("change", paint);
  const reload = el("button", { class: "btn btn-white btn-small", type: "button", text: "Reload", onclick: paint });
  await paint();
  return el("div", {}, el("div", { class: "toolbar" }, filter, reload, count),
    el("p", { class: "small muted", text: REGISTRATION_MODE === "id-card" ? "Approving gives the student access to the course immediately. Each ID card photo is deleted as soon as you approve or reject." : "Approving gives the student access to the course immediately." }), list);
}

// ---------------- students ----------------
function studentsView() {
  const { rows, lessonList, testList } = DATA;
  const search = el("input", { type: "search", placeholder: "Search name, USN or email", "aria-label": "Search students" });
  const sem = el("select", { "aria-label": "Semester" }, el("option", { value: "", text: "All semesters" }), ...Array.from({ length: 10 }, (_, i) => el("option", { value: String(i + 1), text: `Semester ${i + 1}` })));
  const st = el("select", { "aria-label": "Registration status" }, ["approved", "pending", "rejected", "not submitted", "all"].map((x) => el("option", { value: x, text: x === "all" ? "All registrations" : `Status: ${x}` })));
  const refresh = el("button", { class: "btn btn-white btn-small", type: "button", text: "Reload data" });
  const csv = el("button", { class: "btn btn-small", type: "button", text: "Download CSV" });
  const csvAtt = el("button", { class: "btn btn-white btn-small", type: "button", text: "Download attempts CSV" });
  const cols = [
    ["Name", (r) => r.name], ["College", (r) => r.institution], ["Dept", (r) => r.department], ["Sem", (r) => r.semester], ["USN", (r) => r.usn], ["Pass-out", (r) => r.gradYear],
    ["Lessons", (r) => r.lessonsDone, `of ${lessonList.length}`], ["Study min", (r) => r.minutes], ["Last active", (r) => (r.lastActive ? r.lastActive.getTime() : 0)],
    ...testList.map((t) => [t.moduleId ? `Test ${t.moduleId}` : t.title, (r) => (r.results[t.id] ? r.results[t.id].best : -1), "best", t.title]),
    ["Flags", (r) => r.flags], ["Email", (r) => r.email],
  ];
  let sortI = 0, asc = true;
  const tbody = el("tbody");
  const thead = el("thead", {}, el("tr", {}, cols.map(([h, , sub, full], i) => el("th", { scope: "col", title: full ? `${full} (click to sort)` : "Click to sort", onclick: () => { asc = sortI === i ? !asc : true; sortI = i; paint(); } }, h, sub ? el("span", { class: "muted small", text: ` (${sub})` }) : null))));
  const count = el("span", { class: "muted small" });
  function filtered() {
    const q = search.value.trim().toLowerCase();
    return rows.filter((r) => (st.value === "all" || r.status === st.value) && (!sem.value || String(r.semester) === sem.value) && (!q || `${r.name} ${r.usn} ${r.email} ${r.institution}`.toLowerCase().includes(q)));
  }
  function paint() {
    const list = filtered().sort((a, b) => { const x = cols[sortI][1](a), y = cols[sortI][1](b); return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); });
    count.textContent = `${list.length} student${list.length === 1 ? "" : "s"}`;
    tbody.replaceChildren(...list.map((r) => el("tr", { style: { cursor: "pointer" }, onclick: () => studentDialog(r) },
      el("td", { text: r.name }), el("td", { text: r.institution }), el("td", { text: r.department }), el("td", { class: "num", text: r.semester }), el("td", { text: r.usn }), el("td", { class: "num", text: r.gradYear }),
      el("td", { class: "num", text: r.lessonsDone }), el("td", { class: "num", text: r.minutes }), el("td", { text: r.lastActive ? fmtDate(r.lastActive) : "–" }),
      ...testList.map((t) => { const x = r.results[t.id]; return el("td", { class: "num", text: x ? `${x.best}/${x.max}` : "–" }); }),
      el("td", { class: `num ${r.flags ? "flag" : ""}`, text: r.flags }), el("td", { text: r.email }))));
  }
  search.addEventListener("input", paint); sem.addEventListener("change", paint); st.addEventListener("change", paint);
  refresh.addEventListener("click", async () => { await load(true); document.querySelector('[role="tab"][aria-selected="true"]').click(); });
  csv.addEventListener("click", () => downloadCsv("ros2lab-students.csv", [cols.map((c) => c[3] || c[0]),
    ...filtered().map((r) => [r.name, r.institution, r.department, r.semester, r.usn, r.gradYear, r.lessonsDone, r.minutes, r.lastActive ? r.lastActive.toISOString() : "",
      ...testList.map((t) => (r.results[t.id] ? `${r.results[t.id].best}/${r.results[t.id].max}` : "")), r.flags, r.email])]));
  csvAtt.addEventListener("click", () => downloadCsv("ros2lab-attempts.csv", [["Name", "USN", "Email", "Test", "Attempt", "Status", "Score", "Max", "Started", "Submitted", "Flags"],
    ...rows.flatMap((r) => r.attempts.map((a) => [r.name, r.usn, r.email, (testList.find((t) => t.id === a.testId) || {}).title || a.testId, a.attemptNo, a.status,
      a.score ?? "", a.maxScore ?? "", a.startedAt ? a.startedAt.toDate().toISOString() : "", a.submittedAt ? a.submittedAt.toDate().toISOString() : "", (DATA.evByAttempt[a.id] || []).length]))]));
  paint();
  return el("div", {},
    el("div", { class: "toolbar" }, search, st, sem, refresh, csv, csvAtt, count),
    el("p", { class: "small muted", text: "Click a student to see lessons, test attempts, answers and the activity log. Flags count tab switches, paste/copy attempts and similar events during tests: use them to start a conversation, never as proof on their own." }),
    el("div", { class: "table-wrap" }, el("table", { class: "data" }, thead, tbody)));
}

function dialog(title, ...body) {
  const close = el("button", { class: "btn btn-white btn-small", type: "button", text: "Close" });
  const box = el("div", { class: "panel dialog", style: { width: "min(980px, 100%)" } }, el("div", { class: "toolbar", style: { justifyContent: "space-between" } }, el("h2", { style: { margin: 0 }, text: title }), close), ...body);
  const ov = el("div", { class: "overlay" }, box);
  close.addEventListener("click", () => ov.remove());
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  document.body.append(ov);
  return ov;
}

function studentDialog(r) {
  const { lessonList, testList } = DATA;
  const lessons = el("table", { class: "data" }, el("thead", {}, el("tr", {}, ["Lesson", "Status", "Study min", "Completed"].map((h) => el("th", { text: h })))),
    el("tbody", {}, lessonList.map((l) => { const p = r.progress[l.id]; return el("tr", {}, el("td", { text: l.title }), el("td", { text: p ? p.status : "not opened" }),
      el("td", { class: "num", text: p ? Math.round((p.activeSeconds || 0) / 60) : 0 }), el("td", { text: p && p.completedAt ? fmtDate(p.completedAt) : "–" })); })));
  const attempts = el("table", { class: "data" }, el("thead", {}, el("tr", {}, ["Test", "#", "Started", "Status", "Score", "Flags", ""].map((h) => el("th", { text: h })))),
    el("tbody", {}, r.attempts.sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis()).map((a) => el("tr", {},
      el("td", { text: (testList.find((t) => t.id === a.testId) || {}).title || a.testId }), el("td", { class: "num", text: a.attemptNo }),
      el("td", { text: fmtDate(a.startedAt) }), el("td", { text: a.status }), el("td", { class: "num", text: a.score != null ? `${a.score}/${a.maxScore}` : "–" }),
      el("td", { class: `num ${(DATA.evByAttempt[a.id] || []).length ? "flag" : ""}`, text: (DATA.evByAttempt[a.id] || []).length }),
      el("td", {}, el("button", { class: "btn btn-white btn-small", type: "button", text: "View", onclick: () => attemptDialog(r, a) }), " ",
        a.status !== "voided" ? el("button", { class: "btn btn-danger btn-small", type: "button", text: "Cancel attempt", onclick: async () => {
          if (!confirm(`Cancel attempt ${a.attemptNo} for ${r.name}? The student gets this attempt back, and the score is recalculated.`)) return;
          try { await voidAttempt({ attemptId: a.id }); toast("Attempt cancelled. Reload data to see the change."); } catch (e) { toast(friendlyError(e), 6000); }
        } }) : null)))));
  dialog(`${r.name} (${r.usn})`, el("p", { class: "muted", text: `${r.email}. ${r.institution}, ${r.department}, semester ${r.semester}, passing out ${r.gradYear}. Registered ${fmtDate(r.joined)}; status: ${r.status}.` }),
    el("h3", { text: "Lessons" }), el("div", { class: "table-wrap" }, lessons),
    el("h3", { style: { marginTop: "20px" }, text: "Test attempts" }), r.attempts.length ? el("div", { class: "table-wrap" }, attempts) : el("p", { class: "muted", text: "No test attempts yet." }));
}

async function attemptDialog(r, a) {
  const holder = el("div", {}, el("p", { class: "muted", text: "Loading…" }));
  dialog(`${r.name}: attempt ${a.attemptNo}`, holder);
  try {
    const k = (await getDoc(doc(db, "attemptKeys", a.id))).data();
    const evs = (DATA.evByAttempt[a.id] || []).slice().sort((x, y) => x.at.toMillis() - y.at.toMillis());
    const names = { hidden: "left the page (switched tab/app)", blur: "window lost focus", copy: "tried to copy", paste: "tried to paste", contextmenu: "right-click", "fullscreen-exit": "left full screen", "devtools-key": "pressed a developer-tools key", print: "tried to print", screenshot: "pressed a screenshot key" };
    holder.replaceChildren(
      el("p", { text: `Status: ${a.status}. Score: ${a.score != null ? `${a.score}/${a.maxScore}` : "–"}. Started ${fmtDate(a.startedAt)}${a.submittedAt ? `, submitted ${fmtDate(a.submittedAt)}` : ""}.` }),
      el("div", { class: "table-wrap" }, el("table", { class: "data" },
        el("thead", {}, el("tr", {}, ["#", "Question", "Student answer", "Correct answer", "Result", "Time (s)"].map((h) => el("th", { text: h })))),
        el("tbody", {}, k.questions.map((q, i) => { const ans = (k.answers || [])[i];
          const ok = ans && !ans.late && ans.given != null && (q.type === "mcq" || q.type === "order" ? ans.given === q.correct : (q.accept || []).some((x) => x.trim().replace(/\s+/g, " ") === String(ans.given).trim().replace(/\s+/g, " ")));
          return el("tr", {}, el("td", { class: "num", text: i + 1 }),
            el("td", { style: { whiteSpace: "normal", minWidth: "260px" } }, el("div", { text: q.prompt.replace(/\*\*|`/g, "") }), q.code ? el("pre", { class: "code", style: { fontSize: ".8rem", marginTop: "6px" }, text: q.code }) : null),
            el("td", { style: { whiteSpace: "pre-wrap" }, text: ans && ans.given != null ? ans.given : "(none)" }),
            el("td", { style: { whiteSpace: "pre-wrap" }, text: q.correct }),
            el("td", { text: ans && ans.late ? "late" : ok ? "correct" : "wrong" }),
            el("td", { class: "num", text: ans && ans.ms ? Math.round(ans.ms / 1000) : "–" })); })))),
      el("h3", { style: { marginTop: "18px" }, text: `Activity log (${evs.length})` }),
      evs.length ? el("ul", {}, evs.map((e) => el("li", { text: `${fmtDate(e.at)}: question ${e.q + 1}, ${names[e.type] || e.type}` }))) : el("p", { class: "muted", text: "Nothing unusual was recorded." }),
      el("p", { class: "small muted", text: "Note: a phone notification or a slow network can also cause \"window lost focus\". Very fast correct answers plus many page switches are worth a short viva." }));
  } catch (e) { holder.replaceChildren(el("p", { class: "notice err", text: friendlyError(e) })); }
}

// ---------------- tests ----------------
const toLocal = (ts) => { if (!ts) return ""; const d = ts.toDate(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function testsView() {
  if (!DATA.testList.length) return el("p", { class: "notice", text: "No tests yet. Upload the course content file in the Course content tab first." });
  return el("div", { class: "stack" }, DATA.testList.map((t) => {
    const f = {
      title: el("input", { value: t.title || "" }), published: el("input", { type: "checkbox" }),
      openAt: el("input", { type: "datetime-local", value: toLocal(t.openAt) }), closeAt: el("input", { type: "datetime-local", value: toLocal(t.closeAt) }),
      totalMinutes: el("input", { type: "number", min: "5", max: "180", value: t.totalMinutes || 30 }), maxAttempts: el("input", { type: "number", min: "1", max: "10", value: t.maxAttempts || 2 }),
      review: el("select", {}, el("option", { value: "afterClose", text: "After the test closes" }), el("option", { value: "immediate", text: "Immediately after submitting" }), el("option", { value: "never", text: "Never" })),
      showScore: el("input", { type: "checkbox" }), requireLessons: el("input", { type: "checkbox" }),
    };
    f.published.checked = !!t.published; f.showScore.checked = t.showScore !== false; f.requireLessons.checked = !!t.requireLessons; f.review.value = t.review || "afterClose";
    const row = (label, input) => el("div", { class: "form-row" }, el("label", { text: label }), input);
    const save = el("button", { class: "btn", type: "button", text: "Save test settings" });
    const n = (t.topics || []).reduce((s, x) => s + x.count, 0);
    save.addEventListener("click", async () => {
      try {
        if (!f.openAt.value || !f.closeAt.value) throw new Error("Please set both the opening and closing date.");
        const openAt = new Date(f.openAt.value), closeAt = new Date(f.closeAt.value);
        if (closeAt <= openAt) throw new Error("The closing time must be after the opening time.");
        await updateDoc(doc(db, "tests", t.id), {
          title: f.title.value.trim() || t.title, published: f.published.checked, openAt: Timestamp.fromDate(openAt), closeAt: Timestamp.fromDate(closeAt),
          totalMinutes: Math.max(5, Number(f.totalMinutes.value) || 30), maxAttempts: Math.max(1, Number(f.maxAttempts.value) || 1),
          review: f.review.value, showScore: f.showScore.checked, requireLessons: f.requireLessons.checked,
        });
        toast("Test settings saved.");
      } catch (e) { toast(friendlyError(e), 6000); }
    });
    return el("section", { class: "panel" }, el("h2", { text: t.title }),
      el("p", { class: "muted", text: `${n} questions per student, drawn from these topics: ${(t.topics || []).map((x) => `${x.topic} (${x.count})`).join(", ")}.` }),
      el("div", { class: "grid-form" }, row("Title", f.title), row("Opens (your local time)", f.openAt), row("Closes", f.closeAt), row("Time limit (minutes)", f.totalMinutes),
        row("Attempts allowed", f.maxAttempts), row("Show correct answers", f.review)),
      el("div", { class: "toolbar", style: { marginTop: "6px" } },
        el("label", { class: "consent" }, f.published, " Published (students can see it)"),
        el("label", { class: "consent" }, f.showScore, " Show score after submitting"),
        el("label", { class: "consent" }, f.requireLessons, " Students must finish the module's lessons first")),
      save);
  }));
}

// ---------------- content upload ----------------
function contentView() {
  const file = el("input", { type: "file", accept: "application/json,.json" });
  const out = el("div");
  file.addEventListener("change", async () => {
    out.replaceChildren();
    try {
      const data = JSON.parse(await file.files[0].text());
      const problems = validate(data);
      if (problems.length) { out.append(el("div", { class: "notice err" }, el("strong", { text: "The file has problems:" }), el("ul", {}, problems.slice(0, 20).map((p) => el("li", { text: p }))))); return; }
      const nL = data.modules.reduce((s, m) => s + m.lessons.length, 0);
      const go = el("button", { class: "btn", type: "button", text: `Upload ${data.modules.length} modules, ${nL} lessons and ${(data.tests || []).length} tests` });
      go.addEventListener("click", () => upload(data, go, out));
      out.append(el("p", { class: "notice ok", text: "The file looks good." }), go);
    } catch (e) { out.append(el("p", { class: "notice err", text: `Could not read the file: ${e.message}` })); }
  });
  return el("div", { class: "panel" }, el("h2", { text: "Upload course content" }),
    el("p", { text: "Choose the course-content.json file from your project folder. Lessons and module lists are replaced with the file's version. Existing test dates and settings are kept; new tests start unpublished." }),
    file, out);
}
const ID = /^[A-Za-z0-9_-]{1,40}$/;
function validate(d) {
  const p = [];
  if (!d || !Array.isArray(d.modules)) return ["The file must contain a \"modules\" list."];
  const ids = new Set();
  d.modules.forEach((m, i) => {
    if (!ID.test(m.id || "")) p.push(`Module ${i + 1}: bad id`);
    if (!m.title) p.push(`Module ${m.id}: missing title`);
    if (!Array.isArray(m.lessons) || !m.lessons.length) p.push(`Module ${m.id}: no lessons`);
    (m.lessons || []).forEach((l) => {
      if (!ID.test(l.id || "")) p.push(`Lesson in ${m.id}: bad id "${l.id}"`);
      if (ids.has(l.id)) p.push(`Duplicate lesson id ${l.id}`); ids.add(l.id);
      if (!Array.isArray(l.blocks) || !l.blocks.length) p.push(`Lesson ${l.id}: no blocks`);
      if (JSON.stringify(l).length > 900000) p.push(`Lesson ${l.id}: too large`);
      const nested = firestoreProblem(l.blocks, "blocks");
      if (nested) p.push(`Lesson ${l.id}: ${nested}`);
    });
  });
  (d.tests || []).forEach((t) => { if (!ID.test(t.id || "")) p.push(`Test: bad id "${t.id}"`); if (!Array.isArray(t.topics)) p.push(`Test ${t.id}: missing topics`); });
  return p;
}
// Firestore cannot store a list directly inside another list, or empty (undefined) values.
function firestoreProblem(v, path, inList = false) {
  if (v === undefined) return `empty value at ${path} (Firestore cannot store undefined)`;
  if (Array.isArray(v)) {
    if (inList) return `a list inside a list at ${path} (Firestore cannot store this; use objects like {"w": ..., "m": ...})`;
    for (let i = 0; i < v.length; i++) { const r = firestoreProblem(v[i], `${path}[${i}]`, true); if (r) return r; }
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) { const r = firestoreProblem(x, `${path}.${k}`); if (r) return r; }
  }
  return null;
}
async function upload(d, btn, out) {
  btn.disabled = true;
  try {
    const batch = writeBatch(db);
    d.modules.forEach((m, mi) => {
      batch.set(doc(db, "modules", m.id), {
        title: m.title, short: m.short || m.title, description: m.description || "", order: m.order ?? mi + 1,
        lessonIds: m.lessons.map((l) => l.id), lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes || 15, summary: l.summary || "", day: l.day || null, dayTitle: l.dayTitle || "" })),
      });
      m.lessons.forEach((l, li) => batch.set(doc(db, "lessons", l.id), {
        moduleId: m.id, order: li + 1, title: l.title, minutes: l.minutes || 15, summary: l.summary || "", blocks: l.blocks,
      }));
    });
    await batch.commit();
    for (const [ti, t] of (d.tests || []).entries()) {
      const ref = doc(db, "tests", t.id);
      const snap = await getDoc(ref);
      const base = { title: t.title, description: t.description || "", moduleId: t.moduleId || null, topics: t.topics, order: t.order ?? ti + 1 };
      if (snap.exists()) await updateDoc(ref, base);
      else await setDoc(ref, { ...base, published: false, openAt: Timestamp.now(), closeAt: Timestamp.fromMillis(Date.now() + 30 * 86400000),
        totalMinutes: t.totalMinutes || 30, maxAttempts: t.maxAttempts || 2, review: t.review || "afterClose", showScore: t.showScore !== false, requireLessons: t.requireLessons !== false });
    }
    // Remove content that is no longer in the file; old tests are only unpublished (their results stay).
    const keepMods = new Set(d.modules.map((m) => m.id)), keepLessons = new Set(d.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    const keepTests = new Set((d.tests || []).map((t) => t.id));
    let removed = 0;
    for (const s of (await getDocs(collection(db, "modules"))).docs) if (!keepMods.has(s.id)) { await deleteDoc(s.ref); removed++; }
    for (const s of (await getDocs(collection(db, "lessons"))).docs) if (!keepLessons.has(s.id)) { await deleteDoc(s.ref); removed++; }
    for (const s of (await getDocs(collection(db, "tests"))).docs) if (!keepTests.has(s.id) && s.data().published) await updateDoc(s.ref, { published: false });
    DATA = null;
    out.append(el("p", { class: "notice ok", text: `Uploaded.${removed ? ` ${removed} old module(s)/lesson(s) removed.` : ""} Students see the new content immediately. Open the Tests tab to set dates and publish tests.` }));
  } catch (e) { out.append(el("p", { class: "notice err", text: friendlyError(e) })); btn.disabled = false; }
}

// ---------------- help ----------------
function helpView() {
  return el("div", { class: "panel" }, el("h2", { text: "Quick help" }),
    el("ul", {},
      el("li", { text: "Registrations: check each ID card against the student's details, then Approve or Reject with a reason. The photo is deleted after your decision." }),
      el("li", { text: "Students: sorted table of every student. Click a row for details. Download CSV opens in Excel or Google Sheets." }),
      el("li", { text: "Flags: events recorded during tests (leaving the page, copy/paste attempts). They are clues, not proof. A phone notification can also cause one." }),
      el("li", { text: "Cancel attempt: use when a student lost power or internet. They get that attempt back." }),
      el("li", { text: "Tests: set opening and closing times, number of attempts and whether students see answers. Remember to tick Published." }),
      el("li", { text: "Course content: upload course-content.json after you edit lessons. Question templates live in functions/questions/ and need firebase deploy --only functions." }),
      el("li", { text: "Data loads once per visit to save database reads. Use Reload data to refresh." })));
}

function downloadCsv(name, rows) {
  const cell = (v) => { let s = v == null ? "" : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
}
