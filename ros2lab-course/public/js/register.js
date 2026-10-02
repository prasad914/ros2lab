// Registration: account -> verify email -> college details -> ID card -> approval.
import {
  auth, db, storage, call, createUserWithEmailAndPassword, sendEmailVerification, updateProfile, reload, getIdTokenResult,
  doc, setDoc, updateDoc, serverTimestamp, onSnapshot, storageRef, uploadBytes,
} from "./fb.js";
import { el, rich, toast, friendlyError, waitForUser, getStage, renderWho, signOutNow } from "./common.js";
import { CONSENT_VERSION, CONTACT_EMAIL, REGISTRATION_MODE } from "./firebase-config.js";

const main = document.getElementById("main");
const MODE = REGISTRATION_MODE;   // "id-card" | "manual" | "auto"
const STEPS = MODE === "id-card" ? ["Create account", "Verify email", "College details", "College ID card", "Approval"]
  : MODE === "manual" ? ["Create account", "Verify email", "College details", "Approval"]
  : ["Create account", "Verify email", "College details"];
const LAST = STEPS.length - 1;
const DEPARTMENTS = ["Robotics and Artificial Intelligence", "Artificial Intelligence and Machine Learning", "Computer Science",
  "Electronics and Communication", "Electrical and Electronics", "Mechanical", "Mechatronics", "Information Science", "Other"];
const submitForReview = call("submitForReview");
const deleteMyAccount = call("deleteMyAccount");
let unsub = null;

const field = (label, input, help) => el("div", { class: "form-row" }, el("label", { for: input.id, text: label }), input, help ? el("small", { class: "muted", text: help }) : null);
const notice = () => el("p", { class: "notice err", hidden: true, role: "alert" });
const showErr = (n, msg) => { n.textContent = msg; n.hidden = !msg; };

function frame(stepIndex, ...body) {
  const steps = el("ol", { class: "wizard-steps", "aria-label": "Registration steps" },
    STEPS.map((s, i) => el("li", { class: i < stepIndex ? "done" : i === stepIndex ? "now" : "" },
      el("span", { class: "n", text: i < stepIndex ? "✓" : String(i + 1) }), el("span", { text: s }))));
  main.replaceChildren(el("div", { class: "narrow", style: { padding: "26px 20px 60px" } }, steps, el("div", { class: "panel" }, ...body)));
  window.scrollTo(0, 0);
}

async function route() {
  if (unsub) { unsub(); unsub = null; }
  const user = auth.currentUser;
  const st = await getStage(user);
  if (user) renderWho(user, st.profile, st.claims);
  if (location.hash === "#account" && user) return accountView(user, st);
  if (st.stage === "admin") return frame(LAST, el("h1", { text: "You are the instructor" }), el("a", { class: "btn", href: "admin.html", text: "Open the instructor dashboard" }));
  if (st.stage === "approved") { location.replace("course.html"); return; }
  ({ signedout: createAccount, "verify-email": verifyEmail, details: detailsForm, idcard: idCard, rejected: idCard, pending: pending })[st.stage](user, st);
}

// ---------- step 1 ----------
function createAccount() {
  const name = el("input", { id: "r-name", autocomplete: "name", maxlength: "80", required: true });
  const email = el("input", { id: "r-email", type: "email", autocomplete: "email", required: true });
  const pw = el("input", { id: "r-pw", type: "password", autocomplete: "new-password", minlength: "10", required: true });
  const pw2 = el("input", { id: "r-pw2", type: "password", autocomplete: "new-password", required: true });
  const adult = el("input", { type: "checkbox", id: "r-adult" });
  const agree = el("input", { type: "checkbox", id: "r-agree" });
  const err = notice();
  const btn = el("button", { class: "btn", type: "submit", text: "Create my account" });
  const form = el("form", { novalidate: true },
    el("h1", { text: "Register for ROS2Lab" }),
    el("p", { class: "muted", text: MODE === "id-card" ? "The course is free for engineering students with a valid college ID card. Registration takes about 5 minutes; keep your college ID card ready." : "The course is free for engineering students. Registration takes about 3 minutes." }),
    field("Full name (as on your college ID card)", name),
    field("Email address", email, "Use an email you can open now. We send a verification link to it."),
    field("Password", pw, "At least 10 characters, with letters and numbers."),
    field("Type the password again", pw2),
    el("label", { class: "consent", for: "r-adult" }, adult, el("span", { text: "I am 18 years old or older." })),
    el("label", { class: "consent", for: "r-agree" }, agree, el("span", {}, "I have read the ", el("a", { href: "privacy.html", target: "_blank", rel: "noopener", text: "privacy notice" }),
      MODE === "id-card" ? ". I agree that ROS2Lab stores my details, my college ID card photo (until it is checked) and my course progress for running this course." : ". I agree that ROS2Lab stores my details and my course progress for running this course.")),
    err, el("div", { class: "q-actions" }, btn, el("a", { href: "signin.html", text: "Already registered? Sign in" })));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); showErr(err, "");
    const n = name.value.trim().replace(/\s+/g, " ");
    if (n.length < 2) return showErr(err, "Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) return showErr(err, "Please enter a valid email address.");
    if (pw.value.length < 10 || !/[A-Za-z]/.test(pw.value) || !/[0-9]/.test(pw.value)) return showErr(err, "Password: at least 10 characters, with letters and numbers.");
    if (pw.value !== pw2.value) return showErr(err, "The two passwords are not the same.");
    if (!adult.checked || !agree.checked) return showErr(err, "Please tick both boxes to continue.");
    btn.disabled = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.value.trim(), pw.value);
      await updateProfile(cred.user, { displayName: n });
      sessionStorage.setItem("ros2lab-consent", "1");
      await sendEmailVerification(cred.user, { url: `${location.origin}/register.html` });
      route();
    } catch (e2) { btn.disabled = false; showErr(err, friendlyError(e2)); }
  });
  frame(0, form);
  name.focus();
}

// ---------- step 2 ----------
function verifyEmail(user) {
  const err = notice();
  const ok = el("button", { class: "btn", type: "button", text: "I have clicked the link" });
  const again = el("button", { class: "btn btn-white", type: "button", text: "Send the email again" });
  frame(1, el("h1", { text: "Check your email" }),
    el("p", {}, "We sent a verification link to ", el("strong", { text: user.email }), ". Open that email and click the link. Then come back to this page."),
    el("p", { class: "muted small", text: "Can't find it? Look in the Spam or Promotions folder. The link works once." }),
    err, el("div", { class: "q-actions" }, ok, again),
    el("p", { class: "small", style: { marginTop: "18px" } }, "Typed the wrong email? ", el("a", { href: "#", onclick: (e) => { e.preventDefault(); signOutNow(); }, text: "Sign out and register again" }), "."));
  ok.addEventListener("click", async () => {
    await reload(user);
    if (user.emailVerified) { await getIdTokenResult(user, true); route(); }
    else showErr(err, "Your email is not verified yet. Click the link in the email first. It can take a minute to arrive.");
  });
  again.addEventListener("click", async () => {
    again.disabled = true;
    try { await sendEmailVerification(user, { url: `${location.origin}/register.html` }); toast("Email sent again. Check your inbox."); }
    catch (e) { showErr(err, friendlyError(e)); }
    setTimeout(() => { again.disabled = false; }, 30000);
  });
  const timer = setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    await reload(user).catch(() => {});
    if (user.emailVerified) { clearInterval(timer); await getIdTokenResult(user, true); route(); }
  }, 6000);
  setTimeout(() => clearInterval(timer), 15 * 60000);
}

// ---------- step 3 ----------
function detailsForm(user, st, existing, resubmit) {
  const p = existing || {};
  const year = new Date().getFullYear();
  const name = el("input", { id: "d-name", maxlength: "80", value: p.fullName || user.displayName || "" });
  const inst = el("input", { id: "d-inst", maxlength: "120", list: "colleges", value: p.institution || "", placeholder: "e.g. NMAM Institute of Technology, Nitte" });
  const colleges = el("datalist", { id: "colleges" }, el("option", { value: "NMAM Institute of Technology, Nitte" }));
  const dept = el("select", { id: "d-dept" }, DEPARTMENTS.map((d) => el("option", { value: d, text: d })));
  const deptOther = el("input", { id: "d-dept-other", maxlength: "80", placeholder: "Your department", hidden: true });
  if (p.department) { if (DEPARTMENTS.includes(p.department)) dept.value = p.department; else { dept.value = "Other"; deptOther.value = p.department; deptOther.hidden = false; } }
  dept.addEventListener("change", () => { deptOther.hidden = dept.value !== "Other"; });
  const sem = el("select", { id: "d-sem" }, Array.from({ length: 10 }, (_, i) => el("option", { value: String(i + 1), text: `Semester ${i + 1}` })));
  sem.value = String(p.semester || 5);
  const usn = el("input", { id: "d-usn", maxlength: "25", value: p.usn || "", placeholder: "e.g. 4NM22RI001", autocapitalize: "characters" });
  const grad = el("select", { id: "d-grad" }, Array.from({ length: 8 }, (_, i) => el("option", { value: String(year - 1 + i), text: String(year - 1 + i) })));
  grad.value = String(p.gradYear || year + 1);
  const adult = el("input", { type: "checkbox", id: "d-adult", checked: !!existing || sessionStorage.getItem("ros2lab-consent") === "1" });
  const err = notice();
  const btn = el("button", { class: "btn", type: "submit", text: resubmit ? "Save and submit again" : existing ? "Save changes" : MODE === "auto" ? "Save and start the course" : "Save and continue" });
  const form = el("form", { novalidate: true },
    el("h1", { text: resubmit ? "Please check your details again" : existing ? "Correct your details" : "Your college details" }),
    resubmit && p.rejectReason ? el("div", { class: "notice err" }, el("strong", { text: "Your registration was not approved. " }), p.rejectReason) : null,
    el("p", { class: "muted", text: MODE === "id-card" ? "These must match your college ID card. Your instructor checks them by hand." : MODE === "manual" ? "Your instructor checks these details before approving your registration." : "These help your instructor know who is taking the course." }),
    field("Full name (as on your ID card)", name), field("College / institution", inst), colleges,
    field("Department", dept), deptOther, field("Current semester", sem),
    field("USN / university registration number", usn, "Letters and numbers only, as printed on your ID card."),
    field("Year of passing out (graduation year)", grad),
    existing ? null : el("label", { class: "consent", for: "d-adult" }, adult, el("span", {}, "I am 18 or older and I agree to the ", el("a", { href: "privacy.html", target: "_blank", rel: "noopener", text: "privacy notice" }), ".")),
    err, el("div", { class: "q-actions" }, btn));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); showErr(err, "");
    const data = {
      fullName: name.value.trim().replace(/\s+/g, " "), institution: inst.value.trim().replace(/\s+/g, " "),
      department: (dept.value === "Other" ? deptOther.value : dept.value).trim(), semester: Number(sem.value),
      usn: usn.value.trim().toUpperCase().replace(/\s+/g, ""), gradYear: Number(grad.value),
    };
    if (data.fullName.length < 2) return showErr(err, "Please enter your full name.");
    if (data.institution.length < 2) return showErr(err, "Please enter your college name.");
    if (data.department.length < 2) return showErr(err, "Please enter your department.");
    if (!/^[A-Z0-9/-]{3,25}$/.test(data.usn)) return showErr(err, "USN: 3 to 25 letters and numbers (no spaces).");
    if (!existing && !adult.checked) return showErr(err, "Please tick the box to continue.");
    btn.disabled = true;
    try {
      const ref = doc(db, "users", user.uid);
      if (existing) await updateDoc(ref, data);
      else await setDoc(ref, { ...data, email: user.email, adultDeclared: true, consentVersion: CONSENT_VERSION, consentAt: serverTimestamp(), createdAt: serverTimestamp() });
      if (data.fullName !== user.displayName) await updateProfile(user, { displayName: data.fullName }).catch(() => {});
      if (MODE !== "id-card" && (!existing || st.stage === "rejected")) { await submitForReview(); await getIdTokenResult(user, true); }
      route();
    } catch (e2) { btn.disabled = false; showErr(err, friendlyError(e2)); }
  });
  frame(2, form);
}

// ---------- step 4 ----------
async function makeJpeg(file) {
  if (!/^image\//.test(file.type)) throw new Error("Please choose a photo (JPG or PNG). PDFs are not accepted.");
  if (file.size > 15 * 1024 * 1024) throw new Error("This photo is larger than 15 MB. Please take a new photo.");
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("This photo format cannot be read. Please take a JPG photo."); }
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  if (Math.max(w, h) < 400) throw new Error("This photo is too small to read. Please take a closer, clearer photo.");
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size < 1.9 * 1024 * 1024) return blob;   // re-encoding also removes hidden photo data (EXIF/GPS)
  }
  throw new Error("Could not make the photo small enough. Please take a closer photo.");
}

function idCard(user, st) {
  if (MODE !== "id-card") {
    if (st.stage === "rejected") return detailsForm(user, st, st.profile, true);
    frame(2, el("h1", { text: "Finishing your registration…" }));
    submitForReview().then(() => getIdTokenResult(user, true)).then(route)
      .catch((e) => frame(2, el("h1", { text: "Something went wrong" }), el("p", { class: "notice err", text: friendlyError(e) }), el("button", { class: "btn", type: "button", onclick: route, text: "Try again" })));
    return;
  }
  const rejected = st.stage === "rejected";
  const p = st.profile || {};
  const usedUp = rejected && (p.submissions || 0) >= 3;
  const input = el("input", { type: "file", id: "id-file", accept: "image/*", capture: "environment" });
  const preview = el("img", { class: "id-preview", alt: "Preview of your ID card photo", hidden: true });
  const err = notice();
  const btn = el("button", { class: "btn", type: "button", text: "Upload and submit for approval", disabled: true });
  let blob = null;
  input.addEventListener("change", async () => {
    showErr(err, ""); btn.disabled = true; preview.hidden = true; blob = null;
    const f = input.files && input.files[0];
    if (!f) return;
    try { blob = await makeJpeg(f); preview.src = URL.createObjectURL(blob); preview.hidden = false; btn.disabled = false; }
    catch (e) { showErr(err, e.message); }
  });
  btn.addEventListener("click", async () => {
    if (!blob) return;
    btn.disabled = true; btn.textContent = "Uploading…";
    try {
      await getIdTokenResult(user, true);
      await uploadBytes(storageRef(storage, `idcards/${user.uid}/idcard.jpg`), blob, { contentType: "image/jpeg" });
      await submitForReview();
      await getIdTokenResult(user, true);
      route();
    } catch (e) { btn.disabled = false; btn.textContent = "Upload and submit for approval"; showErr(err, friendlyError(e)); }
  });
  frame(3,
    el("h1", { text: rejected ? "Please upload your ID card again" : "Upload your college ID card" }),
    rejected ? el("div", { class: "notice err" }, el("strong", { text: "Your last upload was not approved. " }), p.rejectReason || "") : null,
    usedUp ? el("p", { class: "notice", text: `You have used all 3 uploads. Please email ${CONTACT_EMAIL} for help.` }) : null,
    el("p", { text: "Take a clear photo of the front of your current college ID card, in good light, with nothing covering it." }),
    el("ul", { class: "rules" },
      el("li", {}, rich("Your **name, college name, photo and validity date** must be readable.")),
      el("li", {}, rich("You may cover your **home address, phone number, blood group and any barcode or QR code**.")),
      el("li", {}, rich("**Do not upload Aadhaar, PAN, a driving licence or a passport.** Only the college ID card is accepted."))),
    el("p", { class: "small muted", text: "The photo is resized on your device and stored privately. Only the instructor can see it, and it is deleted as soon as your registration is checked (at the latest after 30 days)." }),
    usedUp ? null : el("div", { class: "form-row" }, el("label", { for: "id-file", text: "Choose or take a photo" }), input),
    preview, err,
    usedUp ? null : el("div", { class: "q-actions" }, btn, el("a", { href: "#", onclick: (e) => { e.preventDefault(); detailsForm(user, st, p); }, text: "Correct my college details" })));
}

// ---------- step 5 ----------
function pending(user, st) {
  const p = st.profile || {};
  const statusLine = el("p", { class: "notice", role: "status", text: "Waiting for approval. This page updates by itself." });
  frame(LAST, el("h1", { text: "Thank you! Your registration is being checked" }),
    el("p", { text: MODE === "id-card" ? "Your instructor compares your details with your college ID card. This usually takes 1 to 2 working days. You can close this page; sign in again later to check." : "Your instructor checks your details. This usually takes 1 to 2 working days. You can close this page; sign in again later to check." }),
    statusLine,
    el("h3", { text: "Your details" }),
    el("ul", {}, el("li", { text: `${p.fullName}, ${p.department}` }), el("li", { text: `${p.institution}, semester ${p.semester}, passing out ${p.gradYear}` }), el("li", { text: `USN ${p.usn}` }), el("li", { text: user.email })),
    el("div", { class: "q-actions" }, el("a", { class: "btn btn-white", href: "#", onclick: (e) => { e.preventDefault(); detailsForm(user, st, p); }, text: "Correct my details" })));
  unsub = onSnapshot(doc(db, "users", user.uid), async (snap) => {
    const s = snap.exists() ? snap.data().status : null;
    if (s === "approved" || s === "rejected") { await getIdTokenResult(user, true); toast(s === "approved" ? "Approved! Welcome to the course." : "Your registration needs attention."); route(); }
  });
}

// ---------- account ----------
function accountView(user, st) {
  const p = st.profile || {};
  const confirmBox = el("input", { id: "del-confirm", placeholder: "Type DELETE", autocomplete: "off" });
  const err = notice();
  const del = el("button", { class: "btn btn-danger", type: "button", text: "Delete my account and data" });
  del.addEventListener("click", async () => {
    if (confirmBox.value.trim() !== "DELETE") return showErr(err, "Type DELETE in the box to confirm.");
    del.disabled = true;
    try { await deleteMyAccount(); await auth.signOut(); location.href = "signin.html?deleted=1"; }
    catch (e) { del.disabled = false; showErr(err, friendlyError(e)); }
  });
  main.replaceChildren(el("div", { class: "narrow", style: { padding: "26px 20px 60px" } }, el("div", { class: "panel" },
    el("h1", { text: "My account" }),
    el("p", {}, el("strong", { text: p.fullName || user.displayName || "" }), el("br"), user.email),
    p.institution ? el("p", { class: "muted", text: `${p.institution}, ${p.department}, semester ${p.semester}, USN ${p.usn}` }) : null,
    el("p", { text: `Registration status: ${st.stage === "approved" ? "approved" : st.stage === "admin" ? "instructor" : st.stage.replace("-", " ")}` }),
    el("div", { class: "q-actions" }, st.stage === "approved" ? el("a", { class: "btn", href: "course.html", text: "Go to my course" }) : el("a", { class: "btn", href: "register.html", text: "Continue registration" }),
      el("button", { class: "btn btn-white", type: "button", onclick: signOutNow, text: "Sign out" })),
    el("h2", { style: { marginTop: "30px" }, text: "Delete my account" }),
    el("p", { text: "This permanently deletes your account, your details, your ID card photo (if any), your lesson progress and your test results." }),
    field("To confirm, type DELETE", confirmBox), err, del)));
}

(async () => {
  await waitForUser();
  window.addEventListener("hashchange", route);
  route();
})();
