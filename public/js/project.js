// Final project: personal brief, submission (at most 2) and the instructor's marks.
import { db, call, doc, getDoc } from "./fb.js";
import { el, rich, requireMember, friendlyError, footer, fmtDate, toast } from "./common.js";

const main = document.getElementById("main");
const assignProject = call("assignProject");
const submitProject = call("submitProject");
const DRAFT_KEY = (uid) => `ros2lab-project-draft-${uid}`;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

(async () => {
  let ctx;
  try { ctx = await requireMember(); } catch { return; }
  const { user } = ctx;
  const page = (...kids) => main.replaceChildren(el("div", { class: "narrow", style: { padding: "26px 20px 60px", maxWidth: "980px" } }, ...kids), footer());
  try {
    let snap = await getDoc(doc(db, "projects", user.uid));
    if (!snap.exists()) {
      const err = el("p", { class: "notice err", hidden: true });
      const btn = el("button", { class: "btn", type: "button", text: "Give me my project" });
      btn.addEventListener("click", async () => {
        btn.disabled = true; err.hidden = true;
        try { await assignProject(); location.reload(); }
        catch (e) { btn.disabled = false; err.textContent = friendlyError(e); err.hidden = false; }
      });
      return page(el("div", { class: "panel" }, el("h1", { text: "Your final project" }),
        el("p", { text: "When you have finished every lesson, you get your own project: a small ROS 2 package with a brief made just for you. Other students get different robots, numbers and names, so you must do your own work." }),
        el("ul", {}, el("li", { text: "You may submit it at most 2 times." }), el("li", { text: "You need at least 80% for the certificate." }),
          el("li", { text: "Your instructor marks it with the marking scheme shown on the next page, usually within a few working days." })),
        err, btn, el("p", { class: "small muted", style: { marginTop: "14px" } }, el("a", { href: "course.html", text: "Back to my course" }))));
    }
    render(snap.data(), user, page);
  } catch (e) {
    page(el("p", { class: "notice err", text: friendlyError(e) }));
  }
})();

function render(p, user, page) {
  const attempts = p.attempts || [];
  const maxA = p.maxAttempts || 2;
  const canSubmit = p.status === "assigned" || p.status === "needs-resubmit";
  const statusText = {
    assigned: `Not submitted yet. You have ${maxA} submissions.`,
    submitted: "Submitted. Your instructor is marking it; this page shows the marks when they are ready.",
    "needs-resubmit": `Your score was below ${p.passPercent || 80}%. Read the feedback, improve your work and submit again. This is your last submission.`,
    passed: `Passed with ${p.best}%. Well done!`,
    failed: `Not passed: both submissions scored below ${p.passPercent || 80}%. Please contact your instructor.`,
  }[p.status] || p.status;

  const brief = el("section", { class: "panel" },
    el("div", { class: "kicker", text: "Your personal project" }),
    el("h1", { style: { marginTop: "4px" }, text: p.title }),
    el("p", { class: `notice ${p.status === "passed" ? "ok" : p.status === "failed" ? "err" : ""}`, text: statusText }),
    el("p", { text: p.summary }),
    el("h2", { text: "Requirements" }),
    el("ol", { class: "proj-reqs" }, (p.requirements || []).map((r) => el("li", {}, rich(r)))),
    el("h3", { text: "Interfaces you must use" }),
    el("ul", {}, (p.interfaces || []).map((r) => el("li", {}, el("code", { text: r })))),
    el("h3", { text: "What to submit" }),
    el("ul", {}, (p.deliverables || []).map((r) => el("li", { text: r }))),
    el("h3", { text: `How it is marked (pass mark ${p.passPercent || 80}%)` }),
    el("div", { class: "table-wrap" }, el("table", { class: "data" },
      el("thead", {}, el("tr", {}, el("th", { text: "Criterion" }), el("th", { text: "Marks" }))),
      el("tbody", {}, (p.rubric || []).map((c) => el("tr", {}, el("td", { style: { whiteSpace: "normal" }, text: c.label }), el("td", { class: "num", text: c.max })))))),
    el("p", { class: "small muted", text: "You may write your code in Python or C++. Build and test it on your own Ubuntu with ROS 2 Jazzy if you can; otherwise write it carefully from the Week 5 and Week 6 lessons. Your instructor reads and runs every submission." }));

  const history = attempts.length ? el("section", { class: "panel" }, el("h2", { style: { marginTop: 0 }, text: "Your submissions" }),
    attempts.slice().reverse().map((a) => {
      const pass = a.status === "graded" && a.score >= (p.passPercent || 80);
      return el("div", { class: `attempt-card ${a.status === "graded" ? (pass ? "pass" : "fail") : ""}` },
        el("strong", { text: `Submission ${a.no} of ${maxA}` }), el("span", { class: "muted small", text: ` · ${a.language === "cpp" ? "C++" : "Python"} · ${a.files.length} file(s) · ${fmtDate(a.submittedAt)}` }),
        a.status === "graded" ? el("div", {},
          el("p", { style: { margin: "8px 0" } }, el("strong", { text: `Score: ${a.score} / 100` }), pass ? " (passed)" : " (below the pass mark)"),
          el("ul", { class: "small" }, (p.rubric || []).map((c) => el("li", { text: `${c.label}: ${a.scores ? a.scores[c.id] : "–"} / ${c.max}` }))),
          el("p", { style: { whiteSpace: "pre-wrap" } }, el("strong", { text: "Feedback: " }), a.feedback || ""))
          : el("p", { class: "muted", style: { margin: "8px 0 0" }, text: "Waiting for marking." }));
    })) : null;

  page(el("p", { class: "small" }, el("a", { href: "course.html", text: "← Back to my course" })), brief, history, canSubmit ? form(p, user) : null);
}

function form(p, user) {
  const attempts = p.attempts || [];
  const maxA = p.maxAttempts || 2;
  const draft = store.get(DRAFT_KEY(user.uid)) || {};
  const lang = el("select", { id: "p-lang" }, el("option", { value: "python", text: "Python (rclpy)" }), el("option", { value: "cpp", text: "C++ (rclcpp)" }));
  lang.value = draft.language || "python";
  const files = el("div");
  const addFile = (name = "", content = "") => {
    const n = el("input", { maxlength: "80", value: name, placeholder: "path/inside/package, e.g. launch/my.launch.py", "aria-label": "File name", style: { width: "100%" } });
    const t = el("textarea", { spellcheck: "false", "aria-label": "File content", placeholder: "Paste or type the whole file here" });
    t.value = content;
    const rm = el("button", { class: "btn btn-white btn-small", type: "button", text: "Remove" });
    const card = el("div", { class: "file-card" }, el("div", { style: { display: "flex", gap: "8px", marginBottom: "8px" } }, n, rm), t);
    rm.addEventListener("click", () => { card.remove(); save(); });
    n.addEventListener("input", save); t.addEventListener("input", save);
    files.append(card);
  };
  const report = el("textarea", { class: "proj-text report", id: "p-report", maxlength: "6000", placeholder: "How do your nodes work together? Which node publishes, subscribes or serves what? Which commands build and run it?" });
  report.value = draft.report || "";
  const count = el("small", { class: "muted" });
  const output = el("textarea", { class: "proj-text", id: "p-output", maxlength: "10000", placeholder: "Optional: paste the terminal output of a real run" });
  output.value = draft.output || "";
  const video = el("input", { id: "p-video", type: "url", maxlength: "300", placeholder: "Optional: https://youtu.be/... or a Google Drive link", value: draft.videoUrl || "" });
  function collect() {
    return {
      language: lang.value, report: report.value, output: output.value, videoUrl: video.value.trim(),
      files: [...files.querySelectorAll(".file-card")].map((c) => ({ name: c.querySelector("input").value.trim(), content: c.querySelector("textarea").value })),
    };
  }
  function save() { store.set(DRAFT_KEY(user.uid), collect()); count.textContent = `${report.value.trim().length} / 6000 characters (at least 150)`; }
  [lang, report, output, video].forEach((x) => x.addEventListener("input", save));
  (draft.files && draft.files.length ? draft.files : [{ name: "package.xml" }, { name: "" }, { name: "" }]).forEach((f) => addFile(f.name, f.content || ""));
  save();
  const more = el("button", { class: "btn btn-white btn-small", type: "button", text: "+ Add another file", onclick: () => addFile() });
  const err = el("p", { class: "notice err", hidden: true, role: "alert" });
  const go = el("button", { class: "btn", type: "button", text: `Submit (submission ${attempts.length + 1} of ${maxA})` });
  go.addEventListener("click", async () => {
    err.hidden = true;
    const d = collect();
    d.files = d.files.filter((f) => f.name || f.content.trim());
    if (!d.files.length) { err.textContent = "Add at least one file."; err.hidden = false; return; }
    if (d.report.trim().length < 150) { err.textContent = "The report needs at least 150 characters."; err.hidden = false; return; }
    if (!confirm(`Submit now? This uses submission ${attempts.length + 1} of ${maxA}, and you cannot change it afterwards.`)) return;
    go.disabled = true; go.textContent = "Submitting…";
    try {
      await submitProject(d);
      store.del(DRAFT_KEY(user.uid));
      toast("Submitted. Your instructor will mark it.");
      setTimeout(() => location.reload(), 900);
    } catch (e) { go.disabled = false; go.textContent = `Submit (submission ${attempts.length + 1} of ${maxA})`; err.textContent = friendlyError(e); err.hidden = false; }
  });
  return el("section", { class: "panel" },
    el("h2", { style: { marginTop: 0 }, text: attempts.length ? "Submit your improved project" : "Submit your project" }),
    el("p", { class: "small muted", text: "Your work is saved on this device as you type, so you can come back later. Nothing is sent until you press Submit." }),
    el("div", { class: "form-row" }, el("label", { for: "p-lang", text: "Language" }), lang),
    el("h3", { text: "Files (up to 15)" }), el("p", { class: "small muted", text: "One box per file. Use the path inside your package as the name, e.g. setup.py, launch/patrol.launch.py, config/patrol.yaml." }),
    files, more,
    el("div", { class: "form-row", style: { marginTop: "18px" } }, el("label", { for: "p-report", text: "Report" }), report, count),
    el("div", { class: "form-row" }, el("label", { for: "p-output", text: "Terminal output (optional)" }), output),
    el("div", { class: "form-row" }, el("label", { for: "p-video", text: "Demo video link (optional)" }), video),
    err, el("div", { class: "q-actions" }, go));
}
