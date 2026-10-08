import { db, storage, call, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, collectionGroup, writeBatch, Timestamp, query, where, storageRef, getBlob, serverTimestamp } from "./fb.js";
import { el, requireMember, friendlyError, fmtDate, toast, describeProfile, CATEGORY_NAMES, accessInfo, regsUsed, MAX_REGISTRATIONS } from "./common.js";
import { REGISTRATION_MODE } from "./firebase-config.js";
import { renderCertificate } from "./cert-render.js";

const main = document.getElementById("main");
const voidAttempt = call("adminVoidAttempt");
const decideExtension = call("adminDecideExtension");
const decideHardware = call("adminDecideHardwareLicense");
const MAX_EXTENSION_DAYS = 30;
const gradeProject = call("adminGradeProject");
const grantProjectAttempt = call("adminGrantProjectAttempt");
const grantTestAttempt = call("adminGrantTestAttempt");

// Why a student may be stuck (shown in the Students table and the student's details).
function needsHelp(r) {
  const out = [];
  for (const t of DATA.testList.filter((x) => x.published)) {
    const used = r.attempts.filter((a) => a.testId === t.id && a.status !== "voided").length;
    const allowed = (t.maxAttempts || 1) + (Number((r.profile.extraAttempts || {})[t.id]) || 0);
    const res = r.results[t.id];
    const pct = res && res.max ? (res.best / res.max) * 100 : 0;
    if (used >= allowed && pct < 60) out.push(`${t.title}: no attempts left, best ${Math.round(pct)}%`);
  }
  if (r.project && r.project.status === "failed") out.push("Project failed twice");
  if (r.project && r.project.status === "submitted") out.push("Project waiting for your marks");
  const info = r.status === "approved" ? accessInfo(r.profile, {}) : null;
  if (info && !info.lifetime && !info.ended && info.daysLeft <= 7) out.push(`Access ends in ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"}`);
  if (r.profile.extensionRequest && r.profile.extensionRequest.status === "pending") out.push("Asked for extra time");
  return out;
}
const signCertificate = call("adminSignCertificate");
const returnCertRequest = call("adminReturnCertificateRequest");
let DATA = null;

(async () => {
  try { await requireMember({ admin: true }); } catch { return; }
  const tabs = ["Registrations", "Extra time", "Hardware licenses", "Students", "Projects", "Certificates", "Tests", "Course content", "Help"];
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
      else if (t === "Extra time") view.replaceChildren(await extensionsView());
      else if (t === "Hardware licenses") view.replaceChildren(await hardwareView());
      else if (t === "Students") { await load(); view.replaceChildren(studentsView()); }
      else if (t === "Projects") { await load(); view.replaceChildren(projectsView()); }
      else if (t === "Certificates") view.replaceChildren(await certificatesView());
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
  const [users, prog, results, attempts, events, modules, tests, projects] = await Promise.all([
    getDocs(collection(db, "users")), getDocs(collectionGroup(db, "lessonProgress")), getDocs(collection(db, "results")),
    getDocs(collection(db, "attempts")), getDocs(collectionGroup(db, "integrityEvents")), getDocs(collection(db, "modules")), getDocs(collection(db, "tests")),
    getDocs(collection(db, "projects")),
  ]);
  const projByUser = Object.fromEntries(projects.docs.map((d) => [d.id, d.data()]));
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
      uid, name: d.fullName || "", category: CATEGORY_NAMES[d.category] || (d.usn ? "Student (old form)" : ""), about: describeProfile(d), institution: d.institution || "",
      status: d.status || "not submitted", email: d.email, joined: d.createdAt, profile: d,
      accessUntil: d.accessUntil ? d.accessUntil.toDate() : null, regCount: d.registrationCount || (d.everApproved ? 1 : 0),
      project: projByUser[uid] || null, certificateId: d.certificateId || "",
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
const REJECT_REASONS = REGISTRATION_MODE !== "id-card" ? [
  "This looks like a second account. Please use the account of your first registration.",
  "Please email the instructor first to explain why you could not finish in your earlier registration.",
  "The details do not look genuine. Please correct your name and college.",
  "Other (type the reason below)",
] : [
  "The photo is not clear enough to read. Please take a sharper photo in good light.",
  "This is not a college ID card. Please upload your college ID card only.",
  "The name or USN does not match the ID card. Please correct your details or upload the right card.",
  "The ID card has expired. Please upload your current college ID card.",
  "Other (type the reason below)",
];
async function registrationsView() {
  const filter = el("select", { "aria-label": "Show" }, ["pending", "cancelled", "rejected", "approved", "expired"].map((x) => el("option", { value: x, text: x === "pending" ? "Waiting for review" : x === "cancelled" ? "Cancelled (time up)" : x === "rejected" ? "Rejected" : x === "expired" ? "Access ended (older)" : "Approved" })));
  const list = el("div", { class: "stack" });
  const count = el("span", { class: "muted small" });
  let dupes = () => [];
  async function paint() {
    list.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
    const snap = await getDocs(query(collection(db, "users"), where("status", "==", filter.value)));
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .sort((x, y) => ((x.submittedAt && x.submittedAt.toMillis()) || 0) - ((y.submittedAt && y.submittedAt.toMillis()) || 0));
    count.textContent = `${users.length} ${filter.value === "pending" ? "waiting" : filter.value}`;
    if (!users.length) { list.replaceChildren(el("p", { class: "notice ok", text: filter.value === "pending" ? "No registrations are waiting. Well done!" : "None." })); return; }
    // Other accounts with the same name and college (a possible second account).
    const all = await load().then((dd) => dd.rows).catch(() => []);
    const key = (n, c) => `${String(n || "").trim().toLowerCase().replace(/\s+/g, " ")}|${String(c || "").trim().toLowerCase().replace(/\s+/g, " ")}`;
    const byKey = {};
    for (const r of all) for (const k of new Set([key(r.name, r.institution), r.profile.firstRegistration ? key(r.profile.firstRegistration.fullName, r.profile.firstRegistration.institution) : null].filter(Boolean))) (byKey[k] = byKey[k] || []).push(r);
    dupes = (u) => (byKey[key(u.fullName, u.institution)] || []).filter((r) => r.uid !== u.uid);
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
    const isRereg = u.everApproved === true;
    const used = regsUsed(u);
    const limitHit = isRereg && used >= MAX_REGISTRATIONS;
    const fr = u.firstRegistration;
    const others = dupes(u);
    const reject = el("button", { class: "btn btn-danger btn-small", type: "button", text: "Reject" });
    const node = el("section", { class: `panel reg-card${withId ? "" : " no-id"}` }, box, el("div", {},
      el("h3", { style: { marginTop: 0 }, text: u.fullName }),
      isRereg && u.status === "pending" ? el("p", { class: `notice${limitHit ? " err" : ""}`, text: limitHit ? `This student has already used all ${MAX_REGISTRATIONS - 1} re-registrations, so it cannot be approved.`
        : `Re-registration ${used} of ${MAX_REGISTRATIONS - 1}. Approving starts the course afresh: old lessons, test scores and project are cleared, and the student gets exactly 60 days with no extra time.${u.certificateId ? ` Already certified: ${u.certificateId}.` : ""}` }) : null,
      fr ? el("p", { class: "small", style: { background: "var(--paper)", padding: "8px 10px", borderRadius: "8px" } }, el("strong", { text: "First registration: " }),
        `${fr.fullName || "–"}, ${fr.institution || "–"}, ${fr.email || "–"} (approved ${fmtDate(fr.approvedAt)})`) : null,
      others.length ? el("p", { class: "notice err small" }, el("strong", { text: "Possible second account: " }),
        others.slice(0, 3).map((r) => `${r.email} (${r.status}, ${r.regCount} registration${r.regCount === 1 ? "" : "s"})`).join("; ")) : null,
      el("dl", {},
        el("dt", { text: "Category" }), el("dd", { text: CATEGORY_NAMES[u.category] || "Student (old form)" }),
        el("dt", { text: u.category === "working" ? "Works at" : "College" }), el("dd", { text: u.institution }),
        el("dt", { text: "Details" }), el("dd", { text: describeProfile(u) }),
        el("dt", { text: "Email" }), el("dd", { text: u.email }),
        el("dt", { text: "Submitted" }), el("dd", { text: `${fmtDate(u.submittedAt)} (${withId ? "upload" : "submission"} ${u.submissions || 1} of 3)` }),
        u.rejectReason ? el("dt", { text: "Reason" }) : null, u.rejectReason ? el("dd", { text: u.rejectReason }) : null),
      u.status === "pending" ? el("p", { class: "small muted", text: withId ? "Check: the name, college, photo and validity date on the card match the details above, and the card is current." : "Check: the institution and details look genuine. If unsure, email the student before approving." }) : null,
      u.status === "pending" ? el("div", { class: "reg-actions" }, limitHit ? null : approve, reason, other, reject) : null));
    const decide = async (decision) => {
      const why = decision === "rejected" ? (reason.value.startsWith("Other") ? other.value.trim() : reason.value) : "";
      if (decision === "rejected" && !why) { toast("Please type a reason for rejecting."); return; }
      approve.disabled = reject.disabled = true;
      try {
        if (decision === "approved" && isRereg && !confirm(`Approve re-registration ${used} of ${MAX_REGISTRATIONS - 1} for ${u.fullName}? Their old progress, test attempts and project are deleted and a new 60-day period starts now.`)) { approve.disabled = reject.disabled = false; return; }
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
    el("p", { class: "small muted", text: `${REGISTRATION_MODE === "auto" ? "New students are approved automatically; this list shows students whose registration was cancelled and who ask to register again. " : ""}Approving gives exactly 60 days of course access from now. A re-registration always starts afresh, and each student can re-register at most ${MAX_REGISTRATIONS - 1} times (further requests are refused automatically). Rejecting a re-registration request leaves the registration cancelled and does not count.${REGISTRATION_MODE === "id-card" ? " Each ID card photo is deleted as soon as you approve or reject." : ""}` }), list);
}

// ---------------- students ----------------
function studentsView() {
  const { rows, lessonList, testList } = DATA;
  const search = el("input", { type: "search", placeholder: "Search name, institution or email", "aria-label": "Search students" });
  const sem = el("select", { "aria-label": "Category" }, el("option", { value: "", text: "All categories" }), ...Object.values(CATEGORY_NAMES).map((c) => el("option", { value: c, text: c })));
  const st = el("select", { "aria-label": "Registration status" }, ["approved", "cancelled", "pending", "rejected", "expired", "not submitted", "all"].map((x) => el("option", { value: x, text: x === "all" ? "All registrations" : x === "expired" ? "Status: access ended (older)" : `Status: ${x}` })));
  const projText = (r) => (r.project ? `${r.project.status === "passed" ? "passed" : r.project.status === "submitted" ? "to mark" : r.project.status === "failed" ? "failed" : r.project.status === "needs-resubmit" ? "resubmit" : "assigned"}${r.project.best ? ` ${r.project.best}%` : ""}` : "–");
  const daysLeft = (r) => { if (r.profile.lifetimeAccess) return 99999; if (r.status !== "approved") return null; const i = accessInfo(r.profile, {}); return i ? i.daysLeft : null; };
  const refresh = el("button", { class: "btn btn-white btn-small", type: "button", text: "Reload data" });
  const csv = el("button", { class: "btn btn-small", type: "button", text: "Download CSV" });
  const csvAtt = el("button", { class: "btn btn-white btn-small", type: "button", text: "Download attempts CSV" });
  const cols = [
    ["Name", (r) => r.name], ["Category", (r) => r.category], ["Institution", (r) => r.institution], ["Days left", (r) => daysLeft(r) ?? -999, "access"],
    ["Lessons", (r) => r.lessonsDone, `of ${lessonList.length}`], ["Study min", (r) => r.minutes], ["Last active", (r) => (r.lastActive ? r.lastActive.getTime() : 0)],
    ...testList.map((t) => [t.moduleId ? `Test ${t.moduleId}` : t.title, (r) => (r.results[t.id] ? r.results[t.id].best : -1), "best", t.title]),
    ["Project", (r) => (r.project ? r.project.best || 0 : -1)], ["Certificate", (r) => r.certificateId], ["Needs help", (r) => needsHelp(r).length], ["Flags", (r) => r.flags], ["Email", (r) => r.email],
  ];
  let sortI = 0, asc = true;
  const tbody = el("tbody");
  const thead = el("thead", {}, el("tr", {}, cols.map(([h, , sub, full], i) => el("th", { scope: "col", title: full ? `${full} (click to sort)` : "Click to sort", onclick: () => { asc = sortI === i ? !asc : true; sortI = i; paint(); } }, h, sub ? el("span", { class: "muted small", text: ` (${sub})` }) : null))));
  const count = el("span", { class: "muted small" });
  function filtered() {
    const q = search.value.trim().toLowerCase();
    return rows.filter((r) => (st.value === "all" || r.status === st.value) && (!sem.value || r.category === sem.value) && (!q || `${r.name} ${r.email} ${r.institution}`.toLowerCase().includes(q)));
  }
  function paint() {
    const list = filtered().sort((a, b) => { const x = cols[sortI][1](a), y = cols[sortI][1](b); return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); });
    count.textContent = `${list.length} student${list.length === 1 ? "" : "s"}`;
    tbody.replaceChildren(...list.map((r) => el("tr", { style: { cursor: "pointer" }, onclick: () => studentDialog(r) },
      el("td", { text: r.name }), el("td", { text: r.category }), el("td", { text: r.institution }),
      el("td", { class: `num ${daysLeft(r) != null && daysLeft(r) <= 7 ? "flag" : ""}`, text: daysLeft(r) == null ? "–" : daysLeft(r) === 99999 ? "lifetime" : daysLeft(r) <= 0 ? "ended" : daysLeft(r) }),
      el("td", { class: "num", text: r.lessonsDone }), el("td", { class: "num", text: r.minutes }), el("td", { text: r.lastActive ? fmtDate(r.lastActive) : "–" }),
      ...testList.map((t) => { const x = r.results[t.id]; return el("td", { class: "num", text: x ? `${x.best}/${x.max}` : "–" }); }),
      el("td", { text: projText(r) }), el("td", { text: r.certificateId || "–" }),
      (() => { const h = needsHelp(r); return el("td", { class: h.length ? "flag" : "", title: h.join("\n"), style: { whiteSpace: "normal", minWidth: "160px" }, text: h.length ? h.join("; ") : "–" }); })(),
      el("td", { class: `num ${r.flags ? "flag" : ""}`, text: r.flags }), el("td", { text: r.email }))));
  }
  search.addEventListener("input", paint); sem.addEventListener("change", paint); st.addEventListener("change", paint);
  refresh.addEventListener("click", async () => { await load(true); document.querySelector('[role="tab"][aria-selected="true"]').click(); });
  csv.addEventListener("click", () => downloadCsv("ros2lab-students.csv", [cols.map((c) => c[3] || c[0]),
    ...filtered().map((r) => [r.name, r.category, r.institution, r.profile.lifetimeAccess ? "lifetime" : r.accessUntil ? r.accessUntil.toISOString().slice(0, 10) : "", r.lessonsDone, r.minutes, r.lastActive ? r.lastActive.toISOString() : "",
      ...testList.map((t) => (r.results[t.id] ? `${r.results[t.id].best}/${r.results[t.id].max}` : "")), projText(r), r.certificateId, needsHelp(r).join("; "), r.flags, r.email])]));
  csvAtt.addEventListener("click", () => downloadCsv("ros2lab-attempts.csv", [["Name", "Institution", "Email", "Test", "Attempt", "Status", "Score", "Max", "Started", "Submitted", "Flags"],
    ...rows.flatMap((r) => r.attempts.map((a) => [r.name, r.institution, r.email, (testList.find((t) => t.id === a.testId) || {}).title || a.testId, a.attemptNo, a.status,
      a.score ?? "", a.maxScore ?? "", a.startedAt ? a.startedAt.toDate().toISOString() : "", a.submittedAt ? a.submittedAt.toDate().toISOString() : "", (DATA.evByAttempt[a.id] || []).length]))]));
  paint();
  return el("div", {},
    el("div", { class: "toolbar" }, search, st, sem, refresh, csv, csvAtt, count),
    el("p", { class: "small muted", text: "Click a student to see lessons, test attempts, answers, the project and the registration history. Days left counts the current 60-day period (plus any extra time). Flags count tab switches, paste/copy attempts and similar events during tests: use them to start a conversation, never as proof on their own." }),
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
  const testTable = el("table", { class: "data" }, el("thead", {}, el("tr", {}, ["Test", "Best", "Attempts used", ""].map((h) => el("th", { text: h })))),
    el("tbody", {}, DATA.testList.filter((t) => t.published).map((t) => {
      const used = r.attempts.filter((a) => a.testId === t.id && a.status !== "voided").length;
      const extra = Number((r.profile.extraAttempts || {})[t.id]) || 0;
      const res = r.results[t.id];
      const btn = el("button", { class: "btn btn-white btn-small", type: "button", text: "+1 attempt", onclick: async (e) => {
        if (!confirm(`Give ${r.name} one more attempt at ${t.title}?`)) return;
        e.target.disabled = true;
        try { await grantTestAttempt({ uid: r.uid, testId: t.id }); toast("Done. The student can take the test once more.", 5000); DATA = null; }
        catch (err) { e.target.disabled = false; toast(friendlyError(err), 6000); }
      } });
      return el("tr", {}, el("td", { text: t.title }), el("td", { class: "num", text: res ? `${res.best}/${res.max} (${Math.round((res.best / res.max) * 100)}%)` : "–" }),
        el("td", { class: "num", text: `${used} of ${(t.maxAttempts || 1) + extra}${extra ? ` (incl. ${extra} extra)` : ""}` }), el("td", {}, btn));
    })));
  const help = needsHelp(r);
  dialog(`${r.name}`, el("p", { class: "muted", text: `${r.email}. ${r.about}. Registered ${fmtDate(r.joined)}; status: ${r.status}.` }),
    help.length ? el("div", { class: "notice err" }, el("strong", { text: "Needs help: " }), help.join("; ")) : null,
    el("h3", { text: "Tests" }), el("div", { class: "table-wrap" }, testTable),
    el("h3", { text: "Registration" }), registrationSummary(r.profile),
    r.profile.extensionRequest && r.profile.extensionRequest.status === "pending" && r.status === "approved" ? extensionDecision(r.profile, r.uid) : null,
    el("p", {}, el("strong", { text: "Project: " }), r.project ? `${r.project.title} (${r.project.status}${r.project.best ? `, best ${r.project.best}%` : ""})` : "not started",
      r.certificateId ? el("span", {}, " · Certificate ", el("a", { href: `certificate.html?id=${r.certificateId}`, target: "_blank", rel: "noopener", text: r.certificateId })) : null),
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

// ---------------- projects (marking) ----------------
function projectsView() {
  const all = DATA.rows.filter((r) => r.project);
  const filter = el("select", { "aria-label": "Show" }, [["submitted", "Waiting for marking"], ["needs-resubmit", "Waiting for 2nd submission"], ["assigned", "Not submitted yet"], ["passed", "Passed"], ["failed", "Failed"], ["all", "All projects"]]
    .map(([v, t]) => el("option", { value: v, text: t })));
  const list = el("div", { class: "stack" });
  const count = el("span", { class: "muted small" });
  function paint() {
    const rows = all.filter((r) => filter.value === "all" || r.project.status === filter.value)
      .sort((a, b) => ((a.project.lastSubmittedAt && a.project.lastSubmittedAt.toMillis()) || 0) - ((b.project.lastSubmittedAt && b.project.lastSubmittedAt.toMillis()) || 0));
    count.textContent = `${rows.length} project${rows.length === 1 ? "" : "s"}`;
    list.replaceChildren(...(rows.length ? rows.map(projectCard) : [el("p", { class: "notice ok", text: filter.value === "submitted" ? "Nothing waiting for marking." : "None." })]));
  }
  filter.addEventListener("change", paint);
  paint();
  return el("div", {}, el("div", { class: "toolbar" }, filter, count,
    el("button", { class: "btn btn-white btn-small", type: "button", text: "Reload data", onclick: async () => { await load(true); document.querySelector('[role="tab"][aria-selected="true"]').click(); } })),
    el("p", { class: "small muted", text: "Oldest submissions first. Read the code and report (and run it on your ROS 2 Jazzy machine if needed), give marks for each criterion and write feedback. 80 or more passes. Students who have also passed every test can then apply for the certificate, which you sign in the Certificates tab." }),
    list);
}

function projectCard(r) {
  const p = r.project;
  const atts = p.attempts || [];
  const last = atts[atts.length - 1];
  const head = el("div", { class: "toolbar", style: { justifyContent: "space-between" } },
    el("div", {}, el("h3", { style: { margin: 0 }, text: `${r.name}: ${p.title}` }),
      el("div", { class: "small muted", text: `${r.email} · ${p.status} · ${atts.length} of ${p.maxAttempts || 2} submissions${p.best ? ` · best ${p.best}%` : ""}` })));
  const body = el("div", { hidden: true });
  const toggle = el("button", { class: "btn btn-white btn-small", type: "button", text: "Open" });
  toggle.addEventListener("click", () => { body.hidden = !body.hidden; toggle.textContent = body.hidden ? "Open" : "Close"; if (!body.childElementCount) fill(); });
  head.append(toggle);
  function fill() {
    body.append(
      el("details", {}, el("summary", { text: "Brief given to the student" }), el("p", { text: p.summary }), el("ol", {}, (p.requirements || []).map((x) => el("li", { text: x })))),
      ...atts.map((a) => el("div", { class: `attempt-card ${a.status === "graded" ? (a.score >= (p.passPercent || 80) ? "pass" : "fail") : ""}` },
        el("strong", { text: `Submission ${a.no} · ${a.language === "cpp" ? "C++" : "Python"} · ${fmtDate(a.submittedAt)}${a.status === "graded" ? ` · ${a.score}/100` : " · not marked"}` }),
        el("h4", { text: "Report" }), el("pre", { class: "code code-view", text: a.report }),
        a.output ? el("details", {}, el("summary", { text: "Terminal output" }), el("pre", { class: "code code-view", text: a.output })) : null,
        a.videoUrl ? el("p", {}, "Video: ", el("a", { href: a.videoUrl, target: "_blank", rel: "noopener noreferrer", text: a.videoUrl })) : null,
        ...a.files.map((f) => el("details", {}, el("summary", { text: `${f.name} (${f.content.split("\n").length} lines)` }), el("pre", { class: "code code-view", text: f.content }))),
        el("button", { class: "btn btn-white btn-small", type: "button", text: "Download all files (.txt)", onclick: () => {
          const txt = a.files.map((f) => `===== ${f.name} =====\n${f.content}\n`).join("\n") + `\n===== REPORT =====\n${a.report}\n`;
          const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
          const link = el("a", { href: URL.createObjectURL(blob), download: `${r.name.replace(/[^A-Za-z0-9]+/g, "_")}_project_${a.no}.txt` });
          document.body.append(link); link.click(); link.remove();
        } }),
        a.status === "graded" ? el("p", { style: { whiteSpace: "pre-wrap" } }, el("strong", { text: "Feedback given: " }), a.feedback) : null)));
    if (p.status === "submitted" && last) {
      const inputs = {};
      const total = el("strong", { text: "0 / 100" });
      const recalc = () => { total.textContent = `${Object.values(inputs).reduce((s2, i) => s2 + (Number(i.value) || 0), 0)} / 100`; };
      const grid = el("div", { class: "rubric-grid" }, (p.rubric || []).flatMap((c) => {
        inputs[c.id] = el("input", { type: "number", min: "0", max: String(c.max), step: "1", "aria-label": c.label, oninput: recalc });
        return [el("label", { text: `${c.label} (max ${c.max})` }), inputs[c.id]];
      }));
      const fb = el("textarea", { class: "proj-text report", placeholder: "Feedback for the student: what works, what is missing, what to fix." });
      const save = el("button", { class: "btn", type: "button", text: "Save marks" });
      save.addEventListener("click", async () => {
        const scores = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, Number(i.value)]));
        const sum = Object.values(scores).reduce((a2, b) => a2 + b, 0);
        if (!confirm(`Save ${sum}/100 for ${r.name}? ${sum >= (p.passPercent || 80) ? "This passes." : atts.length >= (p.maxAttempts || 2) ? "This is the last submission: the project will be marked failed." : "The student can submit once more."}`)) return;
        save.disabled = true;
        try {
          const res = (await gradeProject({ uid: r.uid, scores, feedback: fb.value })).data;
          toast(`Saved: ${res.total}/100 (${res.status}).`, 7000);
          DATA = null;
          body.replaceChildren(el("p", { class: "notice ok", text: `Marked ${res.total}/100: ${res.status}.${res.status === "passed" ? " The student can now apply for the certificate if all tests are passed." : ""}` }));
        } catch (e) { save.disabled = false; toast(friendlyError(e), 7000); }
      });
      body.append(el("section", { class: "panel", style: { marginTop: "12px" } }, el("h3", { style: { marginTop: 0 }, text: `Mark submission ${last.no}` }), grid,
        el("p", {}, "Total: ", total), fb, el("div", { class: "q-actions" }, save)));
    }
    if (p.status === "failed") {
      body.append(el("button", { class: "btn btn-white btn-small", type: "button", text: "Allow one more submission", onclick: async (e) => {
        if (!confirm(`Allow ${r.name} one extra project submission? Use this only for a genuine problem.`)) return;
        e.target.disabled = true;
        try { await grantProjectAttempt({ uid: r.uid }); toast("Done. The student can submit once more."); DATA = null; } catch (err) { e.target.disabled = false; toast(friendlyError(err), 6000); }
      } }));
    }
  }
  return el("section", { class: "panel" }, head, body);
}

// ---------------- certificates (apply -> sign -> download) ----------------
// Turns a photo or scan of a signature into a small PNG with a see-through background.
async function signatureFromFile(file) {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error("Choose a PNG or JPG image of your signature.");
  if (file.size > 8 * 1024 * 1024) throw new Error("The image is larger than 8 MB.");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(bmp, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), px = img.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, light = (px[i] + px[i + 1] + px[i + 2]) / 3;
    if (light > 200) px[i + 3] = 0;                                  // paper -> transparent
    else { px[i + 3] = Math.min(255, Math.round((215 - light) * 3)); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error("No signature found in this image. Sign in dark ink on white paper.");
  g.putImageData(img, 0, 0);
  const pad = 6, cw = x1 - x0 + 1 + 2 * pad, ch = y1 - y0 + 1 + 2 * pad;
  const k = Math.min(1, 600 / cw, 200 / ch);
  const out = document.createElement("canvas"); out.width = Math.round(cw * k); out.height = Math.round(ch * k);
  out.getContext("2d").drawImage(c, x0 - pad, y0 - pad, cw, ch, 0, 0, out.width, out.height);
  const url = out.toDataURL("image/png");
  if (url.length > 290000) throw new Error("The signature image is still too large. Crop it closer to the signature.");
  return url;
}

async function certificatesView() {
  const sigSnap = await getDoc(doc(db, "settings", "signature")).catch(() => null);
  let saved = sigSnap && sigSnap.exists() ? sigSnap.data().image : null;
  const savedImg = el("img", { alt: "Your saved signature", style: { maxHeight: "70px", maxWidth: "280px", background: "#fff", border: "1px solid #C9D5E8", padding: "6px" }, hidden: !saved });
  if (saved) savedImg.src = saved;
  const savedNote = el("span", { class: "muted small", text: saved ? "Used for every certificate unless you choose another image on a request." : "No signature saved yet." });
  const pick = el("input", { type: "file", accept: "image/png,image/jpeg", "aria-label": "Signature image" });
  pick.addEventListener("change", async () => {
    try {
      const url = await signatureFromFile(pick.files[0]);
      await setDoc(doc(db, "settings", "signature"), { image: url, updatedAt: serverTimestamp() });
      saved = url; savedImg.src = url; savedImg.hidden = false; savedNote.textContent = "Saved. Used for every certificate unless you choose another image on a request.";
      toast("Signature saved.");
      paint();
    } catch (e) { toast(e.message || friendlyError(e), 7000); }
  });

  const filter = el("select", { "aria-label": "Show" }, [["pending", "Waiting for my signature"], ["issued", "Signed and issued"], ["returned", "Returned to the student"]].map(([v, t]) => el("option", { value: v, text: t })));
  const list = el("div", { class: "stack" });
  const count = el("span", { class: "muted small" });
  let all = [];
  async function reload() {
    all = (await getDocs(collection(db, "certRequests"))).docs.map((d) => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => a.requestedAt.toMillis() - b.requestedAt.toMillis());
    paint();
  }
  function paint() {
    const rows = all.filter((r) => r.status === filter.value);
    count.textContent = `${rows.length} ${filter.value === "pending" ? "waiting" : filter.value}`;
    list.replaceChildren(...(rows.length ? rows.map(card) : [el("p", { class: "notice ok", text: filter.value === "pending" ? "No certificates are waiting for your signature." : "None." })]));
  }
  function card(r) {
    if (r.status !== "pending") {
      return el("section", { class: "panel" }, el("h3", { style: { marginTop: 0 }, text: r.name }),
        el("p", { class: "small muted", text: `${r.email}. Applied ${fmtDate(r.requestedAt)}.${r.signedAt ? ` Signed ${fmtDate(r.signedAt)}.` : ""}${r.note ? ` Note: ${r.note}` : ""}` }),
        r.certificateId ? el("a", { class: "btn btn-white btn-small", href: `certificate.html?id=${r.certificateId}`, target: "_blank", rel: "noopener", text: `Open ${r.certificateId}` }) : null);
    }
    let sig = saved;
    const name = el("input", { value: r.name, maxlength: "80", "aria-label": "Name printed on the certificate" });
    const holder = el("div", { style: { maxWidth: "900px", margin: "10px 0" } });
    const draw = () => holder.replaceChildren(renderCertificate({ ...r, name: name.value.trim() || r.name, signature: sig }, { preview: true }));
    name.addEventListener("input", draw);
    const own = el("input", { type: "file", accept: "image/png,image/jpeg", "aria-label": "Signature for this certificate" });
    own.addEventListener("change", async () => { try { sig = await signatureFromFile(own.files[0]); draw(); } catch (e) { toast(e.message, 7000); } });
    const sign = el("button", { class: "btn", type: "button", text: "Endorse with my signature and issue" });
    sign.addEventListener("click", async () => {
      if (!sig) { toast("Upload your signature first (top of this page, or for this certificate)."); return; }
      if (!confirm(`Sign and issue the certificate for ${name.value.trim() || r.name}? The student can download it straight away, and it is valid for 2 years.`)) return;
      sign.disabled = true;
      try {
        const res = (await signCertificate({ uid: r.uid, signature: sig, name: name.value.trim() !== r.name ? name.value.trim() : "" })).data;
        toast(`Issued ${res.certificateId}.`, 6000);
        await reload();
      } catch (e) { sign.disabled = false; toast(friendlyError(e), 7000); }
    });
    const note = el("input", { placeholder: "Reason, shown to the student (e.g. spelling of your name)", maxlength: "300", style: { minWidth: "320px" } });
    const back = el("button", { class: "btn btn-danger btn-small", type: "button", text: "Return to the student" });
    back.addEventListener("click", async () => {
      if (note.value.trim().length < 5) { toast("Write a short reason first."); return; }
      back.disabled = true;
      try { await returnCertRequest({ uid: r.uid, note: note.value.trim() }); toast("Returned."); await reload(); } catch (e) { back.disabled = false; toast(friendlyError(e), 7000); }
    });
    draw();
    return el("section", { class: "panel" },
      el("h3", { style: { marginTop: 0 }, text: r.name }),
      el("p", { class: "small muted", text: `${r.email}. Applied ${fmtDate(r.requestedAt)}. Marks and modules were filled in automatically from the records. Check the preview, correct the name if needed, then sign.` }),
      el("div", { class: "grid-form" }, el("div", { class: "form-row" }, el("label", { text: "Name on the certificate" }), name),
        el("div", { class: "form-row" }, el("label", { text: "A different signature for this certificate (optional)" }), own)),
      holder,
      el("div", { class: "q-actions" }, sign),
      el("div", { class: "toolbar", style: { marginTop: "10px" } }, note, back));
  }
  filter.addEventListener("change", paint);
  await reload();
  return el("div", {},
    el("section", { class: "panel" }, el("h2", { style: { marginTop: 0 }, text: "Your signature" }),
      el("p", { class: "small", text: "Sign in dark ink on plain white paper, take a clear photo or scan, and upload it. The paper background is removed automatically. It is stored privately and shown only on certificates you sign." }),
      el("div", { class: "toolbar" }, savedImg, savedNote), el("div", { class: "form-row" }, el("label", { text: saved ? "Replace my saved signature" : "Upload my signature" }), pick)),
    el("div", { class: "toolbar" }, filter, count, el("button", { class: "btn btn-white btn-small", type: "button", text: "Reload", onclick: reload })),
    el("p", { class: "small muted", text: "Students can apply only after finishing every lesson, scoring at least 60% in every test and at least 80% in the project. Signing issues the certificate with a unique ID, valid for 2 years; the student downloads it from their course page." }),
    list);
}

// ---------------- tests ----------------
const toLocal = (ts) => { if (!ts) return ""; const d = ts.toDate(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function testsView() {
  if (!DATA.testList.length) return el("p", { class: "notice", text: "No tests yet. Upload the course content file in the Course content tab first." });
  // One click: every test always open, unlocked by finishing the week, answers after a pass or the last attempt.
  const selfPaced = el("button", { class: "btn", type: "button", text: "Set up all tests for self-paced learning" });
  selfPaced.addEventListener("click", async () => {
    if (!confirm("For ALL tests: open now, never close, published, unlock only after the week's lessons, and show answers once a student passes or has used all attempts. Continue?")) return;
    selfPaced.disabled = true;
    try {
      const now = Timestamp.now();
      for (const t of DATA.testList) {
        await updateDoc(doc(db, "tests", t.id), {
          published: true, closeAt: null, requireLessons: true,
          openAt: t.openAt && t.openAt.toMillis() < now.toMillis() ? t.openAt : now,
          review: !t.review || t.review === "afterClose" ? "afterAttempts" : t.review,
        });
      }
      toast("All tests are now self-paced.", 5000);
      await load(true); document.querySelector('[role="tab"][aria-selected="true"]').click();
    } catch (e) { selfPaced.disabled = false; toast(friendlyError(e), 7000); }
  });
  const problems = (t) => {
    const p = [];
    if (!t.published) p.push("Not published: students cannot see it, and it does not count for lifetime access or certificates.");
    if (t.openAt && t.openAt.toMillis() > Date.now()) p.push(`Opens in the future (${fmtDate(t.openAt)}): students who finish the week must wait.`);
    if (t.closeAt) p.push(`Closes on ${fmtDate(t.closeAt)}: students who register later (60-day access) may not be able to take it, and then can never get lifetime access or a certificate. Leave Closes empty for a self-paced course.`);
    if (t.review === "afterClose" && !t.closeAt) p.push("Answers are set to show \"after the test closes\" but it never closes: they will show once a student passes or uses all attempts.");
    return p;
  };
  return el("div", { class: "stack" },
    el("section", { class: "panel" }, el("h2", { style: { marginTop: 0 }, text: "Self-paced course" }),
      el("p", { text: "Students register on different days and each has 60 days, so tests should not have closing dates. This button sets every test to: open now, never close, published, unlocked when the student finishes that week's lessons, answers shown after a pass or the last attempt." }),
      selfPaced),
    DATA.testList.map((t) => {
    const f = {
      title: el("input", { value: t.title || "" }), published: el("input", { type: "checkbox" }),
      openAt: el("input", { type: "datetime-local", value: toLocal(t.openAt) }), closeAt: el("input", { type: "datetime-local", value: toLocal(t.closeAt) }),
      totalMinutes: el("input", { type: "number", min: "5", max: "180", value: t.totalMinutes || 30 }), maxAttempts: el("input", { type: "number", min: "1", max: "10", value: t.maxAttempts || 2 }),
      review: el("select", {}, el("option", { value: "afterAttempts", text: "After a pass or the last attempt (recommended)" }), el("option", { value: "afterClose", text: "After the test closes" }), el("option", { value: "immediate", text: "Immediately after submitting" }), el("option", { value: "never", text: "Never" })),
      showScore: el("input", { type: "checkbox" }), requireLessons: el("input", { type: "checkbox" }),
    };
    f.published.checked = !!t.published; f.showScore.checked = t.showScore !== false; f.requireLessons.checked = !!t.requireLessons; f.review.value = t.review || "afterAttempts";
    const row = (label, input) => el("div", { class: "form-row" }, el("label", { text: label }), input);
    const save = el("button", { class: "btn", type: "button", text: "Save test settings" });
    const n = (t.topics || []).reduce((s, x) => s + x.count, 0);
    save.addEventListener("click", async () => {
      try {
        if (!f.openAt.value) throw new Error("Please set the opening date.");
        const openAt = new Date(f.openAt.value), closeAt = f.closeAt.value ? new Date(f.closeAt.value) : null;
        if (closeAt && closeAt <= openAt) throw new Error("The closing time must be after the opening time.");
        if (f.review.value === "afterClose" && !closeAt) throw new Error("\"After the test closes\" needs a closing date. Choose \"After a pass or the last attempt\" instead.");
        await updateDoc(doc(db, "tests", t.id), {
          title: f.title.value.trim() || t.title, published: f.published.checked, openAt: Timestamp.fromDate(openAt), closeAt: closeAt ? Timestamp.fromDate(closeAt) : null,
          totalMinutes: Math.max(5, Number(f.totalMinutes.value) || 30), maxAttempts: Math.max(1, Number(f.maxAttempts.value) || 1),
          review: f.review.value, showScore: f.showScore.checked, requireLessons: f.requireLessons.checked,
        });
        toast("Test settings saved.");
        await load(true); document.querySelector('[role="tab"][aria-selected="true"]').click();
      } catch (e) { toast(friendlyError(e), 6000); }
    });
    return el("section", { class: "panel" }, el("h2", { text: t.title }),
      el("p", { class: "muted", text: `${n} questions per student, drawn from these topics: ${(t.topics || []).map((x) => `${x.topic} (${x.count})`).join(", ")}.` }),
      problems(t).length ? el("div", { class: "notice err" }, el("strong", { text: "Check this: " }), el("ul", { style: { margin: "6px 0 0" } }, problems(t).map((x) => el("li", { text: x })))) : el("p", { class: "notice ok", text: "Ready for self-paced students." }),
      el("div", { class: "grid-form" }, row("Title", f.title), row("Opens (your local time)", f.openAt), row("Closes (leave empty: never closes)", f.closeAt), row("Time limit (minutes)", f.totalMinutes),
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
      else await setDoc(ref, { ...base, published: false, openAt: Timestamp.now(), closeAt: null,
        totalMinutes: t.totalMinutes || 30, maxAttempts: t.maxAttempts || 2, review: t.review || "afterAttempts", showScore: t.showScore !== false, requireLessons: t.requireLessons !== false });
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
      el("li", { text: "Registrations: approve or reject new students (and, in id-card mode, check the ID card). Students whose 60-day access ended and who ask to register again always appear here, even in auto mode. A re-registration always starts afresh, and a student can re-register at most 2 times." }),
      el("li", { text: "Access: each approval gives exactly 60 days. If a student has not finished the core lessons and tests (Weeks 1 to 6) by the end, the registration is cancelled automatically (checked every hour) and the course closes for them." }),
      el("li", { text: "Extra time: in their first registration only, a student may ask once for extra time. Approve 1 to 30 days (added to the original end date) or refuse it in the Extra time tab. Re-registrations never get extra time." }),
      el("li", { text: "Projects: every student gets a personal project after finishing all lessons, with at most 2 submissions. Mark it in the Projects tab; 80 or more passes." }),
      el("li", { text: "Lifetime access: students who finish every lesson of Weeks 1 to 6 and score at least 60% in each of their tests within their 60 days keep the course for life (Weeks 7 to 9 are optional; see CORE_MODULES in functions/config.js). The Students table shows lifetime." }),
      el("li", { text: "Certificates: students apply after finishing every lesson, every test at 60% or more and the project at 80% or more. You check the automatic preview and sign it in the Certificates tab; then they can download it. It is valid for 2 years, and anyone can check it at certificate.html." }),
      el("li", { text: "Students: sorted table of every student. Click a row for details. Download CSV opens in Excel or Google Sheets." }),
      el("li", { text: "Flags: events recorded during tests (leaving the page, copy/paste attempts). They are clues, not proof. A phone notification can also cause one." }),
      el("li", { text: "Cancel attempt: use when a student lost power or internet. They get that attempt back." }),
      el("li", { text: "Tests: this course is self-paced, so press \"Set up all tests for self-paced learning\" once: tests stay open, unlock when a student finishes that week's lessons, and show answers after a pass or the last attempt. Each test shows a red box if a setting could block students." }),
      el("li", { text: "Needs help (Students table): students who used all attempts below 60%, failed the project, have a project waiting for marks, or have 7 days or fewer of access. Open the student to give +1 test attempt or an extra project submission." }),
      el("li", { text: "Course content: upload course-content.json after you edit lessons. Question templates live in functions/questions/ and need firebase deploy --only functions." }),
      el("li", { text: "Data loads once per visit to save database reads. Use Reload data to refresh." })));
}

function downloadCsv(name, rows) {
  const cell = (v) => { let s = v == null ? "" : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
}

// ---------------- extra time ----------------
function registrationSummary(u) {
  const info = u.status === "approved" ? accessInfo(u, {}) : null;
  const fr = u.firstRegistration;
  const used = regsUsed(u);
  const rows = [
    ["Registration", used <= 1 ? (used ? "First registration" : "Not approved yet") : `Re-registration ${used - 1} of ${MAX_REGISTRATIONS - 1}`],
    ["Access", u.lifetimeAccess ? `Lifetime since ${fmtDate(u.lifetimeSince)}` : info ? `${fmtDate(info.start)} to ${fmtDate(new Date(info.until))} (${info.ended ? "ended" : `day ${info.dayNo} of ${info.totalDays}, ${info.daysLeft} left`})` : u.status === "cancelled" ? `Cancelled ${fmtDate(u.cancelledAt)}` : "–"],
    ["Extra time", u.extensionUsed ? `${u.extensionDays} days given` : u.extensionRequest ? `Request ${u.extensionRequest.status}` : "None"],
    u.firstExtension ? ["Extra time (first registration)", u.firstExtension.status === "approved" ? `${u.firstExtension.days} days given` : `Request ${u.firstExtension.status}`] : null,
    fr ? ["First registration", `${fr.fullName || "–"}, ${fr.institution || "–"}, ${fr.email || "–"} (approved ${fmtDate(fr.approvedAt)})`] : null,
  ].filter(Boolean);
  return el("dl", { class: "facts" }, rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]));
}

function extensionDecision(u, uid, onDone) {
  const req = u.extensionRequest;
  const days = el("input", { type: "number", min: "1", max: String(MAX_EXTENSION_DAYS), value: String(MAX_EXTENSION_DAYS), style: { width: "5em" }, "aria-label": "Days of extra time" });
  const note = el("input", { placeholder: "Note to the student (optional)", maxlength: "300", style: { flex: "1 1 220px" } });
  const ok = el("button", { class: "btn btn-small", type: "button", text: "Approve" });
  const no = el("button", { class: "btn btn-danger btn-small", type: "button", text: "Refuse" });
  const box = el("div", { class: "notice" },
    el("p", { style: { margin: "0 0 8px" } }, el("strong", { text: `Asked for extra time on ${fmtDate(req.requestedAt)}: ` }), req.reason),
    el("div", { class: "reg-actions" }, el("label", {}, "Days ", days), ok, note, no));
  const go = async (approve) => {
    const n = Number(days.value);
    if (approve && (!Number.isInteger(n) || n < 1 || n > MAX_EXTENSION_DAYS)) { toast(`Choose 1 to ${MAX_EXTENSION_DAYS} days.`); return; }
    if (!confirm(approve ? `Give ${u.fullName} ${n} extra day${n === 1 ? "" : "s"}? This is their one and only extension.` : `Refuse extra time for ${u.fullName}? If the course is not finished by the end date, the registration is cancelled.`)) return;
    ok.disabled = no.disabled = true;
    try {
      const res = await decideExtension({ uid, approve, days: approve ? n : undefined, note: note.value.trim() });
      DATA = null;
      box.replaceChildren(el("p", { style: { margin: 0 }, text: approve ? `Approved: access now until ${fmtDate(new Date(res.data.accessUntil))}.` : "Refused. The student sees your note." }));
      if (onDone) onDone();
    } catch (e) { ok.disabled = no.disabled = false; toast(friendlyError(e), 6000); }
  };
  ok.addEventListener("click", () => go(true));
  no.addEventListener("click", () => go(false));
  return box;
}

async function extensionsView() {
  const filter = el("select", { "aria-label": "Show" }, ["pending", "approved", "rejected"].map((x) => el("option", { value: x, text: x === "pending" ? "Waiting for a decision" : x === "approved" ? "Approved" : "Refused" })));
  const list = el("div", { class: "stack" });
  const count = el("span", { class: "muted small" });
  async function paint() {
    list.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
    const [snap, dd] = await Promise.all([getDocs(query(collection(db, "users"), where("extensionRequest.status", "==", filter.value))), load().catch(() => null)]);
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => u.extensionRequest && u.extensionRequest.status === filter.value)
      .sort((x, y) => ((x.extensionRequest.requestedAt && x.extensionRequest.requestedAt.toMillis()) || 0) - ((y.extensionRequest.requestedAt && y.extensionRequest.requestedAt.toMillis()) || 0));
    count.textContent = `${users.length} request${users.length === 1 ? "" : "s"}`;
    if (!users.length) { list.replaceChildren(el("p", { class: "notice ok", text: filter.value === "pending" ? "No requests for extra time are waiting." : "None." })); return; }
    list.replaceChildren(...users.map((u) => {
      const row = dd ? dd.rows.find((r) => r.uid === u.uid) : null;
      const req = u.extensionRequest;
      const testsPassed = row ? DATA.testList.filter((t) => t.published).filter((t) => { const x = row.results[t.id]; return x && x.max && x.best / x.max >= 0.6; }).length : null;
      return el("section", { class: "panel" },
        el("div", { class: "card-head" }, el("h3", { style: { margin: 0 }, text: u.fullName }), el("span", { class: "muted small", text: u.email })),
        el("p", { class: "small muted", text: describeProfile(u) }),
        row ? el("p", { class: "small", text: `Progress: ${row.lessonsDone} of ${DATA.lessonList.length} lessons, ${testsPassed} of ${DATA.testList.filter((t) => t.published).length} tests passed, last active ${row.lastActive ? fmtDate(row.lastActive) : "never"}.` }) : null,
        registrationSummary(u),
        req.status === "pending" && u.status === "approved" ? extensionDecision(u, u.uid, null)
          : el("p", { class: `notice ${req.status === "approved" ? "ok" : req.status === "rejected" ? "err" : ""}` },
            el("strong", { text: `${req.status === "pending" ? "Registration no longer active" : req.status === "approved" ? `Approved ${req.days} days` : "Refused"}${req.decidedAt ? ` on ${fmtDate(req.decidedAt)}` : ""}. ` }),
            `Reason given: ${req.reason}`, req.note ? ` Note: ${req.note}` : ""));
    }));
  }
  filter.addEventListener("change", paint);
  const reload = el("button", { class: "btn btn-white btn-small", type: "button", text: "Reload", onclick: paint });
  await paint();
  return el("div", {}, el("div", { class: "toolbar" }, filter, reload, count),
    el("p", { class: "small muted", text: `Students may ask once, in their first registration only, for extra time. You can give 1 to ${MAX_EXTENSION_DAYS} days; they are added to the original end date. If you refuse after the end date has passed, the registration is cancelled at once.` }), list);
}

// ---------------- real-hardware licenses (connecting a purchased robot from ROS2Lab) ----------------
async function hardwareView() {
  const filter = el("select", { "aria-label": "Show" }, ["pending", "approved", "rejected", "revoked"].map((x) => el("option", { value: x, text: x === "pending" ? "Waiting for a decision" : x[0].toUpperCase() + x.slice(1) })));
  const list = el("div", { class: "stack" });
  const count = el("span", { class: "muted small" });
  async function paint() {
    list.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
    const snap = await getDocs(query(collection(db, "hardwareLicenses"), where("status", "==", filter.value)));
    const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => ((a.requestedAt && a.requestedAt.toMillis()) || 0) - ((b.requestedAt && b.requestedAt.toMillis()) || 0));
    count.textContent = `${rows.length} license${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) { list.replaceChildren(el("p", { class: "notice ok", text: filter.value === "pending" ? "No hardware license requests are waiting." : "None." })); return; }
    list.replaceChildren(...rows.map((r) => {
      const days = el("input", { type: "number", min: "1", max: "365", value: "90", style: { width: "5em" }, "aria-label": "Days" });
      const robots = el("input", { value: (r.robots || []).join(", "), style: { flex: "1 1 200px" }, "aria-label": "Robots (comma separated, or all)" });
      const note = el("input", { placeholder: "Note to the student (optional)", maxlength: "300", style: { flex: "1 1 220px" } });
      const box = el("div", { class: "reg-actions" });
      const act = async (action) => {
        if (!confirm(action === "approve" ? `Give ${r.fullName || r.email} a hardware license for ${robots.value || "these robots"} for ${days.value} days?` : `${action === "reject" ? "Refuse" : "Revoke"} the hardware license of ${r.fullName || r.email}?`)) return;
        try {
          const res = await decideHardware({ uid: r.uid, action, days: Number(days.value), robots: robots.value.split(",").map((x) => x.trim()).filter(Boolean), note: note.value.trim() });
          box.replaceChildren(el("p", { class: "notice ok", text: action === "approve" ? `Approved. License key ${res.data.key}.` : "Done." }));
        } catch (e) { toast(friendlyError(e), 6000); }
      };
      if (r.status === "pending") box.append(el("label", {}, "Days ", days), robots, note, el("button", { class: "btn btn-small", type: "button", text: "Approve", onclick: () => act("approve") }), el("button", { class: "btn btn-danger btn-small", type: "button", text: "Refuse", onclick: () => act("reject") }));
      else if (r.status === "approved") box.append(note, el("button", { class: "btn btn-danger btn-small", type: "button", text: "Revoke", onclick: () => act("revoke") }));
      return el("section", { class: "panel" },
        el("div", { class: "card-head" }, el("h3", { style: { margin: 0 }, text: r.fullName || r.email || r.uid }), el("span", { class: "muted small", text: r.email || "" })),
        el("p", { class: "small" }, el("strong", { text: "Robots: " }), (r.robots || []).join(", ") || "–"),
        el("p", { class: "small" }, el("strong", { text: "Purpose: " }), r.purpose || "–"),
        el("p", { class: "small muted", text: `Asked ${fmtDate(r.requestedAt)}${r.decidedAt ? ` · decided ${fmtDate(r.decidedAt)} by ${r.decidedBy}` : ""}${r.validUntil ? ` · valid until ${fmtDate(r.validUntil)}` : ""}${r.key ? ` · key ${r.key}` : ""}${r.note ? ` · note: ${r.note}` : ""}` }),
        box);
    }));
  }
  filter.addEventListener("change", paint);
  await paint();
  return el("div", {}, el("div", { class: "toolbar" }, filter, el("button", { class: "btn btn-white btn-small", type: "button", text: "Reload", onclick: paint }), count),
    el("p", { class: "small muted", text: "Students need a hardware license before ROS2Lab connects to a real robot (rosbridge on the RViz page, or a *_bringup / real.launch.py launch in the practice terminal). Simulation never needs one. Give it for the robots they will use (or all), for 1 to 365 days; you can revoke it at any time." }), list);
}
