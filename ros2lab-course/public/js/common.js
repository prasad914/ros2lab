// Shared helpers for every page. Builds the DOM safely (no innerHTML with data).
import { auth, db, onAuthStateChanged, signOut, getIdTokenResult, reload, doc, getDoc } from "./fb.js";
import { el, rich, toast } from "./dom.js";
export { el, rich, toast };

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
    "auth/email-already-in-use": "This email is already registered. Please sign in, or use Forgot password.",
    "auth/weak-password": "Please choose a stronger password: at least 10 characters with letters and numbers.",
    "auth/password-does-not-meet-requirements": "Please choose a stronger password: at least 10 characters with letters and numbers.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "No internet connection. Check your network and try again.",
    "auth/missing-password": "Please enter your password.",
    "auth/requires-recent-login": "Please sign in again, then repeat this action.",
  };
  if (map[code]) return map[code];
  if (/network-request-failed|unavailable/.test(raw)) return map["auth/network-request-failed"];
  if (/permission-denied|insufficient permissions/i.test(raw)) return "You don't have access to this yet.";
  if (/unauthorized-domain/.test(raw)) return "This website address is not yet authorised for sign-in (instructor: see SETUP-GUIDE).";
  return raw.replace(/^Firebase:\s*/, "").replace(/\s*\(.*\)\.?$/, "") || "Something went wrong. Please try again.";
}

export async function signOutNow() { await signOut(auth); location.href = "index.html"; }

export function waitForUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (u) => { stop(); resolve(u); });
  });
}

// Where is this person in the journey?
// signedout | verify-email | details | idcard | pending | rejected | approved | admin
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
  if (profile.status && profile.status !== claims.status) claims = (await getIdTokenResult(user, true)).claims;
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
    ? { fullName: user.displayName || "Instructor", usn: "STAFF", institution: "", semester: null }
    : st.profile;
  renderWho(user, profile, st.claims);
  return { user, claims: st.claims, profile };
}

export function renderWho(user, profile, claims) {
  const slot = document.getElementById("who");
  if (!slot) return;
  slot.replaceChildren(...[
    el("div", { class: "who" }, el("b", { text: (profile && profile.fullName) || user.displayName || "Signed in" }), user.email),
    claims && claims.admin ? el("a", { class: "btn btn-white btn-small", href: "admin.html", text: "Instructor" }) : null,
    el("button", { class: "btn btn-white btn-small", type: "button", onclick: signOutNow, text: "Sign out" }),
  ].filter(Boolean));
}

// ---------- watermark with the student's identity ----------
export function watermark(lines) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  const text = lines.filter(Boolean).map((t, i) => `<text x="10" y="${40 + i * 22}" font-family="sans-serif" font-size="15" fill="#1D2B53">${esc(t)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><g transform="rotate(-18 180 100)">${text}</g></svg>`;
  const div = el("div", { class: "watermark", "aria-hidden": "true" });
  div.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  document.body.append(div);
  return div;
}

// ---------- copy / paste / right-click blocking (a speed bump, logged during tests) ----------
export function protectPage({ onEvent, allowTyping = true } = {}) {
  document.body.classList.add("no-select");
  const report = (type) => { try { onEvent && onEvent(type); } catch { /* ignore */ } };
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
    el("span", { text: "ROS2Lab: a free ROS 2 course for engineering students" }),
    el("a", { href: "privacy.html", text: "Privacy notice" }),
    el("a", { href: "register.html#account", text: "My account" })));
}
