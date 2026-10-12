// Shared helpers for every page. Builds the DOM safely (no innerHTML with data).
import { screenGuard } from "./guard.js";
import { auth, db, onAuthStateChanged, signOut, getIdTokenResult, reload, doc, getDoc, updateDoc, serverTimestamp } from "./fb.js";
import { CONSENT_VERSION } from "./firebase-config.js";
import { el, rich, toast, passwordBox } from "./dom.js";
export { el, rich, toast, passwordBox };

export const qs = (name) => new URLSearchParams(location.search).get(name);
export const fmtDate = (ts) => {
  const d = ts && typeof ts.toDate === "function" ? ts.toDate() : ts instanceof Date ? ts : ts ? new Date(ts) : null;
  return d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "–";
};

// Turn Firebase errors into plain sentences.
export function friendlyError(err) {
  const raw = String((err && (err.message || err.code)) || err || "");
  const code = String((err && err.code) || "");
  const m = raw.match(/"message":"([^"]+)"/);
  if (m) return m[1];
  const map = {
    "auth/invalid-credential": "Email or password is not correct.",
    "auth/wrong-password": "Email or password is not correct.",
    "auth/user-not-found": "Email or password is not correct.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/email-already-in-use": "This email is already registered. Please log in, or use Forgot password.",
    "auth/weak-password": "Please choose a stronger password: at least 10 characters with letters and numbers.",
    "auth/password-does-not-meet-requirements": "Please choose a stronger password: at least 10 characters with letters and numbers.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "No internet connection. Check your network and try again.",
    "auth/missing-password": "Please enter your password.",
    "auth/requires-recent-login": "Please log in again, then repeat this action.",
  };
  if (map[code]) return map[code];
  if (/network-request-failed|unavailable/.test(raw)) return map["auth/network-request-failed"];
  if (/permission-denied|insufficient permissions/i.test(raw)) return "You don't have access to this yet.";
  if (/unauthorized-domain/.test(raw)) return "This website address is not yet authorised for sign-in (instructor: see SETUP-GUIDE).";
  return raw.replace(/^Firebase:\s*/, "").replace(/\s*\(.*\)\.?$/, "") || "Something went wrong. Please try again.";
}

// One line describing a profile (works for old profiles with semester/USN too).
export function describeProfile(p) {
  if (!p) return "";
  if (p.category === "working") return [p.designation, p.department, p.institution].filter(Boolean).join(", ");
  if (p.category === "student") return [`${p.programme || ""} student`.trim(), p.department, p.institution, p.gradYear ? `passing out ${p.gradYear}` : ""].filter(Boolean).join(", ");
  if (p.category === "graduate") return [`${p.programme || ""} graduate`.trim(), p.department, p.institution, p.gradYear ? `passed out ${p.gradYear}` : ""].filter(Boolean).join(", ");
  return [p.department, p.institution, p.semester ? `semester ${p.semester}` : "", p.usn ? `USN ${p.usn}` : ""].filter(Boolean).join(", ");
}
export const CATEGORY_NAMES = { student: "Student", graduate: "Graduate", working: "Working" };

export async function signOutNow() { await signOut(auth); location.href = "index.html"; }

export function waitForUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (u) => { stop(); resolve(u); });
  });
}

// Where is this person in the journey?
// signedout | verify-email | details | idcard | pending | rejected | expired | approved | admin
export async function getStage(user) {
  if (!user) return { stage: "signedout" };
  await reload(user).catch(() => {});
  let claims = (await getIdTokenResult(user)).claims;
  if (user.emailVerified && claims.email_verified !== true) claims = (await getIdTokenResult(user, true)).claims;
  if (claims.admin === true && claims.email_verified === true) return { stage: "admin", claims, profile: null };
  if (!user.emailVerified) return { stage: "verify-email", claims };
  const snap = await getDoc(doc(db, "users", user.uid));
  const profile = snap.exists() ? snap.data() : null;
  if (!profile) return { stage: "details", claims, profile };
  // The server updates both the profile and the token; refresh a stale token.
  const profUntil = profile.accessUntil && typeof profile.accessUntil.toMillis === "function" ? profile.accessUntil.toMillis() : null;
  if ((profile.status && profile.status !== claims.status) || (profile.lifetimeAccess === true && claims.lifetime !== true)
    || (profile.status === "approved" && profUntil && profUntil !== claims.accessUntil)) claims = (await getIdTokenResult(user, true)).claims;   // e.g. extra time approved
  if (claims.status === "approved" && typeof claims.accessUntil === "number" && claims.accessUntil <= Date.now()) return { stage: "expired", claims, profile };
  if (claims.status === "expired" || claims.status === "cancelled" || profile.status === "cancelled") return { stage: "expired", claims, profile };
  if (claims.status === "approved") return { stage: "approved", claims, profile };
  if (claims.status === "rejected" || profile.status === "rejected") return { stage: "rejected", claims, profile };
  if (!profile.submittedAt) return { stage: "idcard", claims, profile };   // details saved, not yet submitted
  return { stage: "pending", claims, profile };
}

// Use on every course page. Returns { user, claims, profile } or redirects.
export async function requireMember({ admin = false } = {}) {
  const user = await waitForUser();
  if (!user) { location.replace("signin.html"); throw new Error("not signed in"); }
  const st = await getStage(user);
  if (st.stage !== "approved" && st.stage !== "admin") { location.replace("register.html"); throw new Error("not approved"); }
  if (admin && st.stage !== "admin") {
    document.body.replaceChildren(el("div", { class: "narrow" }, el("div", { class: "panel", style: { marginTop: "40px" } },
      el("h1", { text: "Instructor access only" }), el("p", { text: "This page is for the course instructor." }),
      el("a", { class: "btn", href: "course.html", text: "Go to my course" }))));
    throw new Error("not admin");
  }
  const profile = st.stage === "admin"
    ? { fullName: user.displayName || "Instructor", institution: "", category: "working" }
    : st.profile;
  renderWho(user, profile, st.claims);
  if (st.stage !== "admin") await ensureConsent(user, profile);
  return { user, claims: st.claims, profile };
}

// ---------- access period (one place, so every page shows the same numbers) ----------
const DAY = 86400000;
const toMs = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : v instanceof Date ? v.getTime() : null);
// Day N of M and days left are counted from the server's start date, not from this
// device's clock alone, so a fresh 60-day registration always shows "60 days left"
// (a phone clock a few minutes behind used to show 61).
export function accessInfo(profile, claims) {
  profile = profile || {}; claims = claims || {};
  if (claims.lifetime === true || profile.lifetimeAccess === true) return { lifetime: true };
  const until = toMs(profile.accessUntil) || (typeof claims.accessUntil === "number" ? claims.accessUntil : null);   // the profile holds the server's latest date
  if (!until) return null;
  const extDays = Number(profile.extensionDays) || 0;
  const start = toMs(profile.accessStart) || until - (60 + extDays) * DAY;
  const totalDays = Math.max(1, Math.round((until - start) / DAY));
  const now = Date.now();
  const msLeft = Math.max(0, until - now);
  const dayNo = Math.min(totalDays, Math.max(1, Math.floor((now - start) / DAY) + 1));
  const daysLeft = msLeft <= 0 ? 0 : Math.max(1, Math.min(totalDays - dayNo + 1, Math.ceil(msLeft / DAY)));
  return { lifetime: false, start, until, totalDays, dayNo, daysLeft, msLeft, extDays, ended: msLeft <= 0,
    hoursLeft: Math.ceil(msLeft / 3600000), usedPct: Math.max(0, Math.min(100, Math.round(((now - start) / (until - start)) * 100))) };
}
export const fmtDay = (ms) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const MAX_REGISTRATIONS = 3;                 // first registration + 2 re-registrations
export const regsUsed = (p) => (p && (p.registrationCount || (p.everApproved ? 1 : 0))) || 0;

// ---------- new Terms / Privacy Notice version: ask once ----------
export function ensureConsent(user, profile) {
  if (!profile || profile.consentVersion === CONSENT_VERSION) return Promise.resolve();
  return new Promise((resolve) => {
    const box = el("input", { type: "checkbox", id: "re-agree" });
    const btn = el("button", { class: "btn", type: "button", text: "Continue", disabled: true });
    const err = el("p", { class: "notice err", hidden: true, style: { margin: "10px 0 0" } });
    box.addEventListener("change", () => { btn.disabled = !box.checked; });
    const ov = el("div", { class: "overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "re-title" },
      el("div", { class: "panel dialog" },
        el("h2", { id: "re-title", style: { marginTop: 0 }, text: "We have updated our terms" }),
        el("p", {}, "Please read the updated ", el("a", { href: "terms.html", target: "_blank", rel: "noopener", text: "Terms of Use" }), " and ",
          el("a", { href: "privacy.html", target: "_blank", rel: "noopener", text: "Privacy Notice" }),
          ". They explain the 60-day access period, the one-time extra time, cancellation and re-registration."),
        el("label", { class: "consent", for: "re-agree" }, box, el("span", { text: "I agree to the Terms of Use and the Privacy Notice." })),
        el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" } }, btn,
          el("button", { class: "btn btn-white", type: "button", onclick: signOutNow, text: "Log out" })), err));
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await updateDoc(doc(db, "users", user.uid), { consentVersion: CONSENT_VERSION, consentAt: serverTimestamp(), termsAccepted: true });
        profile.consentVersion = CONSENT_VERSION;
        ov.remove(); resolve();
      } catch (e) { err.hidden = false; err.textContent = friendlyError(e); btn.disabled = false; }
    });
    document.body.append(ov);
    box.focus();
  });
}

export function renderWho(user, profile, claims) {
  const slot = document.getElementById("who");
  if (!slot) return;
  slot.replaceChildren(...[
    el("div", { class: "who" }, el("b", { text: (profile && profile.fullName) || user.displayName || "Signed in" }), user.email),
    claims && claims.admin ? el("a", { class: "btn btn-white btn-small", href: "admin.html", text: "Instructor" }) : null,
    el("button", { class: "btn btn-white btn-small", type: "button", onclick: signOutNow, text: "Log out" }),
  ].filter(Boolean));
}

// ---------- watermark with the student's identity ----------
// Websites cannot block phone screenshots, so every course page carries the
// student's name and email: a leaked screenshot shows who took it.
export function watermark(lines) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  const text = lines.filter(Boolean).map((t, i) => `<text x="10" y="${34 + i * 20}" font-family="sans-serif" font-size="14" fill="#1D2B53">${esc(t)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="170"><g transform="rotate(-18 150 85)">${text}</g></svg>`;
  const div = el("div", { class: "watermark", "aria-hidden": "true" });
  div.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  if (matchMedia("(pointer: coarse)").matches) div.classList.add("watermark-touch");
  document.body.append(div);
  // Put it back if someone removes it with developer tools.
  new MutationObserver(() => { if (!div.isConnected) document.body.append(div); div.style.display = ""; div.hidden = false; })
    .observe(document.body, { childList: true });
  new MutationObserver(() => { if (div.style.display || div.hidden) { div.style.display = ""; div.hidden = false; } })
    .observe(div, { attributes: true });
  return div;
}
export const watermarkLines = (user, profile) => [(profile && profile.fullName) || user.displayName || "", user.email, new Date().toLocaleDateString("en-IN")];

// ---------- copy / paste / right-click blocking (a speed bump, logged during tests) ----------
export function protectPage({ onEvent, allowTyping = true } = {}) {
  document.body.classList.add("no-select");
  const report = (type) => { try { onEvent && onEvent(type); } catch { /* ignore */ } };
  screenGuard(report);
  const block = (type, msg) => (e) => { e.preventDefault(); report(type); if (msg) toast(msg, 2500); };
  document.addEventListener("copy", block("copy", "Copying is turned off on course pages."));
  document.addEventListener("cut", block("copy", "Copying is turned off on course pages."));
  document.addEventListener("paste", block("paste", "Pasting is turned off. Type it yourself: typing helps you remember."));
  document.addEventListener("contextmenu", block("contextmenu"));
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === "F12" || (ctrl && e.shiftKey && ["i", "j", "c"].includes(k)) || (ctrl && k === "u")) { e.preventDefault(); report("devtools-key"); }
    else if (ctrl && (k === "p" || k === "s")) { e.preventDefault(); report(k === "p" ? "print" : "copy"); }
    else if (ctrl && !allowTyping && ["c", "x", "v", "a"].includes(k)) { e.preventDefault(); }
  });
}

export function footer() {
  return el("footer", { class: "site-foot" }, el("div", { class: "wrap" },
    el("span", { text: "ROS2Lab: a free ROS 2 course for students and engineers" }),
    el("span", { class: "credit", text: "Developed by the Robotics and ROS2 lab Channel" }),
    el("a", { href: "terms.html", text: "Terms of Use" }),
    el("a", { href: "privacy.html", text: "Privacy notice" }),
    el("a", { href: "account.html", text: "My account" })));
}
