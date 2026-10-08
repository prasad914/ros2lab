// Registration: account -> verify email -> college details -> ID card -> approval.
import {
  auth, db, storage, call, createUserWithEmailAndPassword, sendEmailVerification, updateProfile, reload, getIdTokenResult,
  doc, setDoc, updateDoc, serverTimestamp, onSnapshot, storageRef, uploadBytes, deleteField,
} from "./fb.js";
import { el, rich, toast, friendlyError, waitForUser, getStage, renderWho, signOutNow, describeProfile, fmtDate, passwordBox, regsUsed, MAX_REGISTRATIONS } from "./common.js";
import { CONSENT_VERSION, CONTACT_EMAIL, REGISTRATION_MODE } from "./firebase-config.js";

const main = document.getElementById("main");
const MODE = REGISTRATION_MODE;   // "id-card" | "manual" | "auto"
const STEPS = MODE === "id-card" ? ["Create account", "Verify email", "Your details", "College ID card", "Approval"]
  : MODE === "manual" ? ["Create account", "Verify email", "Your details", "Approval"]
  : ["Create account", "Verify email", "Your details"];
const LAST = STEPS.length - 1;
const DEPARTMENTS = ["Robotics and Artificial Intelligence", "Artificial Intelligence and Machine Learning", "Computer Science",
  "Electronics and Communication", "Electrical and Electronics", "Mechanical", "Mechatronics", "Information Science", "Other"];
const submitForReview = call("submitForReview");
const requestReregistration = call("requestReregistration");
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
  if (st.stage === "admin") return frame(LAST, el("h1", { text: "You are the instructor" }), el("a", { class: "btn", href: "admin.html", text: "Open the instructor dashboard" }));
  if (st.stage === "approved") { location.replace("course.html"); return; }
  ({ signedout: createAccount, "verify-email": verifyEmail, details: detailsForm, idcard: idCard, rejected: idCard, pending: pending, expired: expiredView })[st.stage](user, st);
}

// ---------- step 1 ----------
function createAccount() {
  const name = el("input", { id: "r-name", autocomplete: "name", maxlength: "80", required: true });
  const email = el("input", { id: "r-email", type: "email", autocomplete: "email", required: true });
  const pw = el("input", { id: "r-pw", type: "password", autocomplete: "new-password", minlength: "10", required: true });
  const pw2 = el("input", { id: "r-pw2", type: "password", autocomplete: "new-password", required: true });
  const agree = el("input", { type: "checkbox", id: "r-agree" });
  const match = el("small", { class: "muted", "aria-live": "polite" });
  const showMatch = () => { match.textContent = !pw2.value ? "" : pw.value === pw2.value ? "✓ The passwords match." : "The passwords do not match yet."; match.className = pw2.value && pw.value === pw2.value ? "ok-text" : "muted"; };
  pw.addEventListener("input", showMatch); pw2.addEventListener("input", showMatch);
  const err = notice();
  const btn = el("button", { class: "btn", type: "submit", text: "Create my account" });
  const form = el("form", { novalidate: true },
    el("h1", { text: "Register for ROS2Lab" }),
    el("p", { class: "muted", text: MODE === "id-card" ? "The course is free for students with a valid college ID card. Registration takes about 5 minutes; keep your college ID card ready." : "Free for students, graduates, faculty, research scholars and engineers. Registration takes about 3 minutes." }),
    field(MODE === "id-card" ? "Full name (as on your college ID card)" : "Full name (as it should appear on your certificate)", name),
    field("Email address", email, "Use an email you can open now. We send a verification link to it."),
    el("div", { class: "form-row" }, el("label", { for: "r-pw", text: "Password" }), passwordBox(pw), el("small", { class: "muted", text: "At least 10 characters, with letters and numbers. Press Show to check what you typed." })),
    el("div", { class: "form-row" }, el("label", { for: "r-pw2", text: "Type the password again" }), passwordBox(pw2), match),
    el("label", { class: "consent", for: "r-agree" }, agree, el("span", {}, "I agree to the ", el("a", { href: "terms.html", target: "_blank", rel: "noopener", text: "Terms of Use" }), " and the ",
      el("a", { href: "privacy.html", target: "_blank", rel: "noopener", text: "Privacy Notice" }), ".")),
    err, el("div", { class: "q-actions" }, btn, el("a", { href: "signin.html", text: "Already registered? Log in" })));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); showErr(err, "");
    const n = name.value.trim().replace(/\s+/g, " ");
    if (n.length < 2) return showErr(err, "Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) return showErr(err, "Please enter a valid email address.");
    if (pw.value.length < 10 || !/[A-Za-z]/.test(pw.value) || !/[0-9]/.test(pw.value)) return showErr(err, "Password: at least 10 characters, with letters and numbers.");
    if (pw.value !== pw2.value) return showErr(err, "The two passwords are not the same.");
    if (!agree.checked) return showErr(err, "Please tick the box to accept the Terms of Use and the Privacy Notice.");
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
    el("p", { class: "small", style: { marginTop: "18px" } }, "Typed the wrong email? ", el("a", { href: "#", onclick: (e) => { e.preventDefault(); signOutNow(); }, text: "Log out and register again" }), "."));
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
const PROGRAMMES = ["BE / BTech", "ME / MTech", "MSc", "MCA", "PhD", "Diploma", "BSc", "Other"];
const DESIGNATIONS = ["Faculty / Lecturer", "Research scholar", "Research assistant / project staff", "Lab instructor", "Engineer (industry)", "Software developer", "Other"];

function detailsForm(user, st, existing, resubmit) {
  const p = existing || {};
  const year = new Date().getFullYear();
  const legacy = existing && !p.category;   // registered before categories existed
  const cat = el("select", { id: "d-cat" },
    el("option", { value: "student", text: "I am studying now (UG, PG or PhD)" }),
    el("option", { value: "graduate", text: "I have finished my studies (not working yet)" }),
    el("option", { value: "working", text: "I am working (faculty, research scholar, research assistant, industry)" }));
  cat.value = p.category || "student";
  const name = el("input", { id: "d-name", maxlength: "80", value: p.fullName || user.displayName || "", autocomplete: "name" });
  const inst = el("input", { id: "d-inst", maxlength: "120", list: "colleges", value: p.institution || "" });
  const colleges = el("datalist", { id: "colleges" });
  const prog = el("select", { id: "d-prog" }, PROGRAMMES.map((x) => el("option", { value: x, text: x })));
  const progOther = el("input", { id: "d-prog-other", maxlength: "40", placeholder: "Your programme", hidden: true });
  if (p.programme) { if (PROGRAMMES.includes(p.programme)) prog.value = p.programme; else { prog.value = "Other"; progOther.value = p.programme; progOther.hidden = false; } }
  prog.addEventListener("change", () => { progOther.hidden = prog.value !== "Other"; });
  const dept = el("select", { id: "d-dept" }, DEPARTMENTS.map((d) => el("option", { value: d, text: d })));
  const deptOther = el("input", { id: "d-dept-other", maxlength: "80", placeholder: "Your department or branch", hidden: true });
  if (p.department) { if (DEPARTMENTS.includes(p.department)) dept.value = p.department; else { dept.value = "Other"; deptOther.value = p.department; deptOther.hidden = false; } }
  dept.addEventListener("change", () => { deptOther.hidden = dept.value !== "Other"; });
  const deptWork = el("input", { id: "d-dept-work", maxlength: "80", value: p.category === "working" ? p.department || "" : "", placeholder: "e.g. Mechanical Engineering, R&D, Automation" });
  const desig = el("input", { id: "d-desig", maxlength: "80", list: "desigs", value: p.designation || "", placeholder: "e.g. Research scholar" });
  const desigs = el("datalist", { id: "desigs" }, DESIGNATIONS.map((x) => el("option", { value: x })));
  const gradOpts = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => el("option", { value: String(hi - i), text: String(hi - i) }));
  const grad = el("select", { id: "d-grad" });
  const agree = el("input", { type: "checkbox", id: "d-agree", checked: !!existing || sessionStorage.getItem("ros2lab-consent") === "1" });

  const instRow = field("College / university", inst);
  const gradRow = field("Year of passing out", grad);
  const studyBox = el("div", {}, field("Programme", prog), progOther, field("Department / branch", dept), deptOther, gradRow);
  const workBox = el("div", {}, field("Designation", desig, "Choose from the list or type your own."), desigs,
    field("Department / team (optional)", deptWork));
  function paintCategory() {
    const c = cat.value;
    studyBox.hidden = c === "working"; workBox.hidden = c !== "working";
    instRow.querySelector("label").textContent = c === "working" ? "Institution or company where you work" : c === "graduate" ? "College / university you graduated from" : "College / university";
    inst.placeholder = c === "working" ? "Full name of your college or company" : "Full name of your college";
    gradRow.querySelector("label").textContent = c === "student" ? "Expected year of passing out" : "Year of passing out";
    const keep = grad.value || String(p.gradYear || "");
    grad.replaceChildren(...(c === "student" ? gradOpts(year - 1, year + 7) : gradOpts(1975, year + 1)));
    grad.value = keep && [...grad.options].some((o) => o.value === keep) ? keep : String(c === "student" ? year + 1 : year);
  }
  cat.addEventListener("change", paintCategory);
  paintCategory();

  const err = notice();
  const btn = el("button", { class: "btn", type: "submit", text: resubmit ? "Save and submit again" : existing ? "Save changes" : MODE === "auto" ? "Save and start the course" : "Save and continue" });
  const form = el("form", { novalidate: true },
    el("h1", { text: resubmit ? "Please check your details again" : existing ? "Correct your details" : "About you" }),
    resubmit && p.rejectReason ? el("div", { class: "notice err" }, el("strong", { text: "Your registration was not approved. " }), p.rejectReason) : null,
    legacy ? el("p", { class: "notice", text: "We now ask whether you are studying, have graduated or are working. Please choose and check your details." }) : null,
    el("p", { class: "muted", text: MODE === "id-card" ? "These must match your college ID card. Your instructor checks them by hand." : MODE === "manual" ? "Your instructor checks these details before approving your registration." : "These help your instructor know who is taking the course." }),
    field("Your full name (printed on your certificate)", name), field("Which describes you best?", cat), instRow, colleges, studyBox, workBox,
    existing ? null : el("label", { class: "consent", for: "d-agree" }, agree, el("span", {}, "I agree to the ", el("a", { href: "terms.html", target: "_blank", rel: "noopener", text: "Terms of Use" }), " and the ", el("a", { href: "privacy.html", target: "_blank", rel: "noopener", text: "Privacy Notice" }), ".")),
    err, el("div", { class: "q-actions" }, btn));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); showErr(err, "");
    const tidy = (v) => v.trim().replace(/\s+/g, " ");
    const c = cat.value;
    const data = { fullName: tidy(name.value), category: c, institution: tidy(inst.value) };
    if (c === "working") {
      data.designation = tidy(desig.value);
      const dw = tidy(deptWork.value);
      if (dw) data.department = dw;
    } else {
      data.programme = tidy(prog.value === "Other" ? progOther.value : prog.value);
      data.department = tidy(dept.value === "Other" ? deptOther.value : dept.value);
      data.gradYear = Number(grad.value);
    }
    if (data.fullName.length < 2) return showErr(err, "Please enter your full name.");
    if (data.institution.length < 2) return showErr(err, c === "working" ? "Please enter the name of your institution or company." : "Please enter your college name.");
    if (c === "working" && data.designation.length < 2) return showErr(err, "Please enter your designation.");
    if (c !== "working" && data.programme.length < 2) return showErr(err, "Please enter your programme.");
    if (c !== "working" && data.department.length < 2) return showErr(err, "Please enter your department or branch.");
    if (!existing && !agree.checked) return showErr(err, "Please tick the box to accept the Terms of Use and the Privacy Notice.");
    btn.disabled = true;
    try {
      const ref = doc(db, "users", user.uid);
      if (existing) {
        // Remove fields that do not apply to the chosen category (and the old semester/USN fields).
        const drop = {};
        for (const k of ["semester", "usn", "programme", "designation", "gradYear", "department"]) if (k in p && !(k in data)) drop[k] = deleteField();
        await updateDoc(ref, { ...data, ...drop });
      } else await setDoc(ref, { ...data, email: user.email, termsAccepted: true, consentVersion: CONSENT_VERSION, consentAt: serverTimestamp(), createdAt: serverTimestamp() });
      if (data.fullName !== user.displayName) await updateProfile(user, { displayName: data.fullName }).catch(() => {});
      if (MODE !== "id-card" && (!existing || st.stage === "rejected")) { await submitForReview(); await getIdTokenResult(user, true); }
      route();
    } catch (e2) {
      btn.disabled = false; showErr(err, friendlyError(e2));
      if (/re-registrations/.test(friendlyError(e2))) { await getIdTokenResult(user, true).catch(() => {}); setTimeout(route, 4000); }
    }
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
      .catch((e) => /re-registrations/.test(friendlyError(e)) ? getIdTokenResult(user, true).then(route) : frame(2, el("h1", { text: "Something went wrong" }), el("p", { class: "notice err", text: friendlyError(e) }), el("button", { class: "btn", type: "button", onclick: route, text: "Try again" })));
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
  const again = p.reregistration === true;
  const statusLine = el("p", { class: "notice", role: "status", text: "Waiting for approval. This page updates by itself." });
  frame(LAST, el("h1", { text: again ? "Your new registration is being checked" : "Thank you! Your registration is being checked" }),
    el("p", { text: again ? "Your instructor will check your request. When it is approved you get a new access period. This usually takes 1 to 2 working days; you can close this page."
      : MODE === "id-card" ? "Your instructor compares your details with your college ID card. This usually takes 1 to 2 working days. You can close this page; log in again later to check." : "Your instructor checks your details. This usually takes 1 to 2 working days. You can close this page; log in again later to check." }),
    statusLine,
    el("h3", { text: "Your details" }),
    el("ul", {}, el("li", { text: p.fullName || "" }), el("li", { text: describeProfile(p) }), el("li", { text: user.email })),
    el("div", { class: "q-actions" }, el("a", { class: "btn btn-white", href: "#", onclick: (e) => { e.preventDefault(); detailsForm(user, st, p); }, text: "Correct my details" })));
  unsub = onSnapshot(doc(db, "users", user.uid), async (snap) => {
    const s = snap.exists() ? snap.data().status : null;
    if (s === "approved" || s === "rejected" || s === "cancelled") { await getIdTokenResult(user, true); toast(s === "approved" ? "Approved! Welcome to the course." : "Your registration needs attention."); route(); }
  });
}

// ---------- access ended / registration cancelled ----------
function expiredView(user, st) {
  const p = st.profile || {};
  const err = notice();
  const used = Math.max(1, regsUsed(p));
  const reregsLeft = Math.max(0, MAX_REGISTRATIONS - used);
  const extPending = p.extensionRequest && p.extensionRequest.status === "pending";
  const certBox = p.certificateId ? el("div", { class: "notice ok", style: { margin: "0 0 14px" } }, el("strong", { text: "You earned your certificate. " }),
    el("a", { href: `certificate.html?id=${encodeURIComponent(p.certificateId)}`, text: "Open and download it" }), ".") : null;
  const ended = p.accessUntil ? fmtDate(p.accessUntil) : st.claims && st.claims.accessUntil ? fmtDate(new Date(st.claims.accessUntil)) : "";
  const refused = p.rejectReason && p.status === "cancelled" ? el("p", { class: "notice err" }, el("strong", { text: "Your last request was not approved: " }), p.rejectReason) : null;

  if (extPending && p.status === "approved") {
    return frame(LAST, el("h1", { text: "Your access period has ended" }),
      el("p", { text: `Your 60 days ended${ended ? ` on ${ended}` : ""}. Your request for extra time is waiting for the administrator. If it is approved, the course opens again automatically; if not, your registration is cancelled.` }),
      el("p", { class: "notice", role: "status", text: "Please log in again later to check." }),
      el("div", { class: "q-actions" }, el("a", { class: "btn btn-white", href: "account.html", text: "My account" })));
  }

  const ask = el("button", { class: "btn", type: "button", text: `Request re-registration ${used} of ${MAX_REGISTRATIONS - 1}` });
  ask.addEventListener("click", async () => {
    if (!confirm("Re-registration starts the course afresh: your lessons, test scores and project are cleared, and you get exactly 60 days with no extra time. Send the request?")) return;
    ask.disabled = true; showErr(err, "");
    try { await requestReregistration(); await getIdTokenResult(user, true); route(); }
    catch (e) { ask.disabled = false; showErr(err, friendlyError(e)); if (/re-registrations/.test(friendlyError(e))) ask.remove(); }
  });
  const rules = el("ul", { class: "rules" },
    el("li", { text: "A re-registration starts the course afresh. Your previous lessons, test scores and project are cleared." }),
    el("li", { text: "Each re-registration gives exactly 60 days of access. Extra time is not available." }),
    el("li", { text: "The administrator approves every re-registration request; it is not automatic." }),
    el("li", { text: `You can re-register at most ${MAX_REGISTRATIONS - 1} times. After that, new requests are rejected automatically.` }));
  frame(LAST, el("h1", { text: "Your registration was cancelled" }),
    el("p", {}, `Each registration gives exactly 60 days of course access${ended ? `, and yours ended on ${ended}` : ""}. The course and the tests were not completed in that time, so the registration was cancelled and the course materials are closed.`),
    certBox, refused,
    el("div", { class: "reg-count" },
      el("div", {}, el("b", { text: String(used) }), el("span", { text: `registration${used === 1 ? "" : "s"} used` })),
      el("div", {}, el("b", { text: String(reregsLeft) }), el("span", { text: `re-registration${reregsLeft === 1 ? "" : "s"} left` }))),
    reregsLeft > 0 ? rules : el("p", { class: "notice err" }, el("strong", { text: "No re-registrations left. " }),
      `You have used all ${MAX_REGISTRATIONS - 1} re-registrations, so new requests are rejected automatically. You can still open your certificate (if you earned one) and your account.`),
    err, el("div", { class: "q-actions" }, reregsLeft > 0 ? ask : null,
      reregsLeft > 0 ? el("a", { class: "btn btn-white", href: "#", onclick: (e) => { e.preventDefault(); detailsForm(user, st, p); }, text: "Update my details first" }) : null,
      el("a", { class: "btn btn-white", href: "account.html", text: "My account" })));
}

(async () => {
  if (location.hash === "#account") { location.replace("account.html"); return; }   // old link
  await waitForUser();
  window.addEventListener("hashchange", route);
  route();
})();
