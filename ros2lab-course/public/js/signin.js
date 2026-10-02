import { auth, signInWithEmailAndPassword, sendPasswordResetEmail } from "./fb.js";
import { el, friendlyError, waitForUser, getStage, qs } from "./common.js";

const main = document.getElementById("main");
const go = async (user) => {
  const st = await getStage(user);
  location.replace(st.stage === "admin" ? "admin.html" : st.stage === "approved" ? "course.html" : "register.html");
};

(async () => {
  const user = await waitForUser();
  if (user) return go(user);
  const email = el("input", { id: "s-email", type: "email", autocomplete: "email", required: true });
  const pw = el("input", { id: "s-pw", type: "password", autocomplete: "current-password", required: true });
  const err = el("p", { class: "notice err", hidden: true, role: "alert" });
  const info = el("p", { class: "notice ok", hidden: true, role: "status" });
  const btn = el("button", { class: "btn", type: "submit", text: "Sign in" });
  const forgot = el("button", { class: "linklike", type: "button", text: "Forgot password?" });
  const form = el("form", { class: "panel", novalidate: true },
    el("h1", { text: "Sign in" }),
    qs("deleted") ? el("p", { class: "notice ok", text: "Your account and data were deleted." }) : null,
    el("div", { class: "form-row" }, el("label", { for: "s-email", text: "Email address" }), email),
    el("div", { class: "form-row" }, el("label", { for: "s-pw", text: "Password" }), pw),
    err, info,
    el("div", { class: "q-actions" }, btn, forgot),
    el("p", { style: { marginTop: "18px" } }, "New here? ", el("a", { href: "register.html", text: "Register for the course" }), "."));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); err.hidden = true; info.hidden = true; btn.disabled = true;
    try { const cred = await signInWithEmailAndPassword(auth, email.value.trim(), pw.value); await go(cred.user); }
    catch (e2) { err.textContent = friendlyError(e2); err.hidden = false; btn.disabled = false; }
  });
  forgot.addEventListener("click", async () => {
    err.hidden = true; info.hidden = true;
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { err.textContent = "Type your email address above first, then press Forgot password."; err.hidden = false; return; }
    try { await sendPasswordResetEmail(auth, email.value.trim()); } catch { /* same message either way */ }
    info.textContent = "If this email is registered, a password reset link is on its way. Check your inbox and Spam folder."; info.hidden = false;
  });
  main.replaceChildren(el("div", { class: "narrow", style: { padding: "40px 20px 60px", maxWidth: "560px" } }, form));
  email.focus();
})();
