// "My account": profile, registration and access details, extra time, password, log out, delete.
import { auth, call, sendPasswordResetEmail } from "./fb.js";
import { el, friendlyError, waitForUser, getStage, renderWho, signOutNow, describeProfile, fmtDate, footer, accessInfo, fmtDay, regsUsed, MAX_REGISTRATIONS, CATEGORY_NAMES, ensureConsent } from "./common.js";
import { accessCard, extensionBox } from "./access-ui.js";
import { CONTACT_EMAIL } from "./firebase-config.js";

const main = document.getElementById("main");

const STAGE_TEXT = {
  approved: ["Active", "approved"], admin: ["Instructor", "approved"], pending: ["Waiting for approval", "pending"],
  rejected: ["Needs attention", "rejected"], expired: ["Cancelled", "rejected"], idcard: ["Registration not finished", "pending"],
  details: ["Registration not finished", "pending"], "verify-email": ["Email not verified yet", "pending"],
};

const facts = (rows) => el("dl", { class: "facts" }, rows.filter(Boolean).flatMap(([k, v]) => [el("dt", { text: k }), el("dd", {}, v)]));

(async () => {
  const user = await waitForUser();
  if (!user) { location.replace("signin.html?next=account.html"); return; }
  let st;
  try { st = await getStage(user); }
  catch (e) { main.replaceChildren(el("div", { class: "narrow" }, el("p", { class: "notice err", style: { marginTop: "32px" }, text: friendlyError(e) }))); return; }
  const p = st.profile || {};
  renderWho(user, st.stage === "admin" ? { fullName: user.displayName || "Instructor" } : p, st.claims);
  if (st.profile && st.stage !== "admin") await ensureConsent(user, st.profile);
  let [label, chipCls] = STAGE_TEXT[st.stage] || [st.stage, "pending"];
  if (st.stage === "expired" && p.status === "approved") label = "Access period ended";
  const info = st.stage === "approved" ? accessInfo(p, st.claims) : null;
  const lifetime = info && info.lifetime;
  const used = regsUsed(p);
  const left = Math.max(0, MAX_REGISTRATIONS - Math.max(1, used));

  // ---- profile ----
  const profileCard = el("section", { class: "panel" },
    el("h2", { text: "Profile" }),
    facts([
      ["Name", p.fullName || user.displayName || "–"],
      ["Email", user.email],
      p.category ? ["Category", CATEGORY_NAMES[p.category] || p.category] : null,
      p.institution ? [p.category === "working" ? "Institution / company" : "College", p.institution] : null,
      describeProfile(p) ? ["Details", describeProfile(p)] : null,
      p.createdAt ? ["Account created", fmtDate(p.createdAt)] : null,
    ]),
    st.stage === "approved"
      ? el("p", { class: "small muted", text: `Your details are locked while your course is active (your certificate uses the name above). To correct a mistake, email ${CONTACT_EMAIL}.` })
      : st.stage !== "admin" ? el("a", { class: "btn btn-white btn-small", href: "register.html", text: "Correct or finish my details" }) : null);

  // ---- registration ----
  const fr = p.firstRegistration;
  const regCard = st.stage === "admin" ? null : el("section", { class: "panel" },
    el("div", { class: "card-head" }, el("h2", { text: "Registration" }), el("span", { class: `chip status-chip ${chipCls}`, text: label })),
    facts([
      ["Registration", used <= 1 ? (used ? "First registration" : "Not approved yet") : `Re-registration ${used - 1} of ${MAX_REGISTRATIONS - 1}`],
      used ? ["Re-registrations left", `${left} of ${MAX_REGISTRATIONS - 1}`] : null,
      info && !lifetime ? ["Access period", `${fmtDay(info.start)} to ${fmtDate(new Date(info.until))}`] : null,
      info && !lifetime ? ["Days left", info.ended ? "0 (ended)" : `${info.daysLeft} (day ${info.dayNo} of ${info.totalDays})`] : null,
      lifetime ? ["Access", "Lifetime (course completed in time)"] : null,
      st.stage === "expired" && p.cancelledAt ? ["Cancelled on", fmtDate(p.cancelledAt)] : null,
      used <= 1 && info && !lifetime ? ["Extra time", p.extensionUsed ? `${p.extensionDays} days given (used)` : p.extensionRequest ? `Request ${p.extensionRequest.status}` : "Not requested (one request allowed)"] : null,
    ]),
    fr ? el("details", { class: "first-reg" }, el("summary", { text: "Record of your first registration" }),
      facts([["Name", fr.fullName || "–"], ["Email", fr.email || "–"], ["College / institution", fr.institution || "–"], ["Approved on", fmtDate(fr.approvedAt)]]),
      el("p", { class: "small muted", text: "This record is kept for the registration rules and does not change when you edit your details." })) : null,
    el("div", { class: "q-actions" },
      st.stage === "approved" ? el("a", { class: "btn", href: "course.html", text: "Go to my course" })
        : el("a", { class: "btn", href: "register.html", text: st.stage === "expired" ? "See re-registration options" : "Continue my registration" })));

  // ---- certificate ----
  const certCard = p.certificateId ? el("section", { class: "panel" }, el("h2", { text: "Certificate" }),
    el("p", { text: "Your certificate is valid for 2 years and anyone can verify it online." }),
    el("a", { class: "btn", href: `certificate.html?id=${encodeURIComponent(p.certificateId)}`, text: "Open and download my certificate" })) : null;

  // ---- security ----
  const resetMsg = el("p", { class: "notice ok", hidden: true, role: "status" });
  const resetBtn = el("button", { class: "btn btn-white", type: "button", text: "Email me a password reset link" });
  resetBtn.addEventListener("click", async () => {
    resetBtn.disabled = true;
    try { await sendPasswordResetEmail(auth, user.email); resetMsg.textContent = `A reset link was sent to ${user.email}. Check your inbox and Spam folder.`; }
    catch (e) { resetMsg.textContent = friendlyError(e); resetMsg.className = "notice err"; }
    resetMsg.hidden = false;
  });
  const secCard = el("section", { class: "panel" }, el("h2", { text: "Password and log in" }),
    el("p", { class: "muted", text: "To change your password, we email you a secure link." }), resetMsg,
    el("div", { class: "q-actions" }, resetBtn, el("button", { class: "btn btn-white", type: "button", onclick: signOutNow, text: "Log out" })));

  // ---- delete ----
  const confirmBox = el("input", { id: "del-confirm", placeholder: "Type DELETE", autocomplete: "off" });
  const delErr = el("p", { class: "notice err", hidden: true, role: "alert" });
  const del = el("button", { class: "btn btn-danger", type: "button", text: "Delete my account and data" });
  del.addEventListener("click", async () => {
    if (confirmBox.value.trim() !== "DELETE") { delErr.textContent = "Type DELETE in the box to confirm."; delErr.hidden = false; return; }
    del.disabled = true;
    try { await call("deleteMyAccount")(); await auth.signOut(); location.href = "signin.html?deleted=1"; }
    catch (e) { del.disabled = false; delErr.textContent = friendlyError(e); delErr.hidden = false; }
  });
  const delCard = st.stage === "admin" ? null : el("details", { class: "panel danger-zone" },
    el("summary", { text: "Delete my account" }),
    el("p", { text: "This permanently deletes your account, your details, your lesson progress, your test results, your project and your certificate (it will no longer verify)." }),
    el("p", { class: "small muted", text: "A short registration record (your email, the name and college of your first registration, and how many times you registered) is kept so that the registration limits still apply if you register again." }),
    el("div", { class: "form-row" }, el("label", { for: "del-confirm", text: "To confirm, type DELETE" }), confirmBox), delErr, del);

  main.replaceChildren(el("div", { class: "wrap account" },
    el("div", { class: "dash-head" }, el("div", {}, el("h1", { style: { marginBottom: "6px" }, text: "My account" }),
      el("p", { class: "muted", style: { margin: 0 }, text: p.fullName ? `${p.fullName} · ${user.email}` : user.email }))),
    el("div", { class: "account-grid" },
      el("div", { class: "stack" }, info ? accessCard(p, st.claims) : null, regCard, info ? extensionBox(p, st.claims) : null, certCard),
      el("div", { class: "stack" }, profileCard, secCard, delCard))), footer());
})();
