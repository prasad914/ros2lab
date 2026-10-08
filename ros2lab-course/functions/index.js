// ROS2Lab MOOC server code (Cloud Functions for Firebase, 2nd gen).
// Everything security-critical happens here, where students cannot change it.
const { setGlobalOptions } = require("firebase-functions/v2/options");
const identity = require("firebase-functions/v2/identity");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const crypto = require("node:crypto");

const cfg = require("./config");
const engine = require("./engine");
const projects = require("./projects");

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: cfg.REGION, maxInstances: 10 });

// =====================================================================
// 1) SIGN-UP AND SIGN-IN GATE (open registration, manual ID approval)
// =====================================================================
// New accounts start as "pending". The instructor approves or rejects each
// student after checking the uploaded college ID card (reviewRegistration).
exports.beforecreated = identity.beforeUserCreated((event) => {
  const email = String((event.data && event.data.email) || "").toLowerCase();
  if (!email) throw new identity.HttpsError("invalid-argument", "An email address is required.");
  const domain = email.split("@")[1] || "";
  if (cfg.BLOCKED_EMAIL_DOMAINS.includes(domain)) {
    throw new identity.HttpsError("permission-denied", "Please register with your personal or college email, not a temporary email service.");
  }
  return { customClaims: { status: "pending" } };
});

// Instructors listed in config.js become admins once their email is verified.
// For everyone else nothing changes here (returning nothing keeps their claims).
exports.beforesignedin = identity.beforeUserSignedIn((event) => {
  const user = event.data || {};
  const email = String(user.email || "").toLowerCase();
  if (user.emailVerified === true && cfg.ADMIN_EMAILS.includes(email)) {
    return { customClaims: { ...(user.customClaims || {}), admin: true, status: "approved" } };
  }
  return undefined;
});

// =====================================================================
// Helpers
// =====================================================================
const CALL_OPTS = { enforceAppCheck: cfg.ENFORCE_APP_CHECK, timeoutSeconds: 30, memory: "256MiB" };
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

function requireVerified(req) {
  const t = req.auth && req.auth.token;
  if (!t) throw new HttpsError("unauthenticated", "Please log in first.");
  if (t.email_verified !== true) throw new HttpsError("permission-denied", "Please verify your email address first.");
  return req.auth.uid;
}
// Course access: approved AND inside the access window (instructors always).
function accessOk(t) {
  if (t.admin === true) return true;
  return t.status === "approved" && (typeof t.accessUntil !== "number" || t.accessUntil > Date.now());
}
// Approved students with time left (and instructors) only.
function requireMember(req) {
  const uid = requireVerified(req);
  const t = req.auth.token;
  if (t.status === "expired" || t.status === "cancelled" || (t.status === "approved" && !accessOk(t))) {
    throw new HttpsError("permission-denied", "Your course access has ended. Log in again to see your options.");
  }
  if (!accessOk(t)) throw new HttpsError("permission-denied", "Your registration has not been approved yet.");
  return uid;
}
const DAY_MS = 86400000;
// Custom claims without the access date (for pending / rejected / expired accounts).
const baseClaims = (claims) => { const { accessUntil, lifetime, ...rest } = claims || {}; return rest; };

// Registrations used so far (the first registration counts as 1).
const regsUsed = (u) => (u && (u.registrationCount || (u.everApproved ? 1 : 0))) || 0;
const MAX_REGISTRATIONS = 1 + cfg.MAX_REREGISTRATIONS;     // first registration + re-registrations

// Give (or renew) course access: exactly ACCESS_DAYS x 24 hours from this moment.
// Also records the first registration (email, name, college) once, for the instructor.
async function grantAccess(uid, extra = {}) {
  const rec = await getAuth().getUser(uid);
  const ref = db.doc(`users/${uid}`);
  const u = (await ref.get()).data() || {};
  const now = Date.now();
  const accessUntil = now + cfg.ACCESS_DAYS * DAY_MS;
  const { registrationCount: countOverride, ...rest } = extra;
  const count = countOverride || regsUsed(u) + 1;
  await getAuth().setCustomUserClaims(uid, { ...baseClaims(rec.customClaims), status: "approved", accessUntil });
  const keepExt = u.extensionRequest && regsUsed(u) === 1 && !u.firstExtension ? { firstExtension: u.extensionRequest } : {};
  const firstReg = u.firstRegistration || {
    email: u.email || rec.email || "", fullName: u.fullName || "", institution: u.institution || "",
    approvedAt: Timestamp.fromMillis(now) };
  await ref.set({
    status: "approved", accessStart: Timestamp.fromMillis(now), accessUntil: Timestamp.fromMillis(accessUntil),
    everApproved: true, registrationCount: count, reregistration: false, expiredAt: null, cancelledAt: null,
    rejectReason: null, extensionUsed: false, extensionDays: 0, extensionRequest: FieldValue.delete(), firstRegistration: firstReg, ...keepExt, ...rest,
  }, { merge: true });
  if (rec.email || u.email) await ledgerRef(rec.email || u.email).set({ registrations: count, firstRegistration: firstReg, lastUid: uid, updatedAt: Timestamp.now() }, { merge: true });
  return accessUntil;
}

// Registration ledger, one per email address (key: SHA-256 of the lower-case email).
// It survives account deletion, so deleting an account and signing up again with the
// same email does not reset the registration count or the first-registration record.
function ledgerRef(email) {
  // asha.rao+2@gmail.com and asharao@gmail.com are the same mailbox: count them once.
  let [local, domain] = String(email || "").trim().toLowerCase().split("@");
  local = (local || "").split("+")[0];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  const key = crypto.createHash("sha256").update(`${local}@${domain || ""}`).digest("hex");
  return db.doc(`regLedger/${key}`);
}
// Before a first registration: carry over an earlier record for the same email.
async function adoptLedger(uid, email, ref, u) {
  if (u.everApproved === true || !email) return u;
  const l = await ledgerRef(email).get();
  if (!l.exists || !(l.data().registrations > 0)) return u;
  const carry = { everApproved: true, registrationCount: l.data().registrations, firstRegistration: l.data().firstRegistration || null };
  await ref.update(carry);
  return { ...u, ...carry };
}
async function setStatusClaim(uid, status) {
  const rec = await getAuth().getUser(uid);
  await getAuth().setCustomUserClaims(uid, { ...baseClaims(rec.customClaims), status });
}

// Deletes a student's lessons progress, test attempts, scores and project (not the account).
async function resetCourseData(uid) {
  await db.recursiveDelete(db.doc(`progress/${uid}`));
  const atts = await db.collection("attempts").where("uid", "==", uid).get();
  for (const a of atts.docs) { await db.recursiveDelete(a.ref); await db.doc(`attemptKeys/${a.id}`).delete(); }
  const res = await db.collection("results").where("uid", "==", uid).get();
  for (const r of res.docs) await r.ref.delete();
  await db.doc(`projects/${uid}`).delete();
}
function isAdminReq(req) { return !!(req.auth && req.auth.token && req.auth.token.admin === true); }
function requireAdmin(req) {
  requireMember(req);
  if (!isAdminReq(req)) throw new HttpsError("permission-denied", "Instructor access only.");
  return req.auth.uid;
}
const ms = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : null);
const fmtIST = (ts) => new Date(ms(ts)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const fillGaps = (arr, n) => Array.from({ length: Math.max(arr.length, n) }, (_, i) => (arr[i] === undefined ? null : arr[i]));

// Extra attempts the instructor gave this student for one test.
const extraAttemptsFor = (profile, testId) => Math.max(0, Number(((profile && profile.extraAttempts) || {})[testId]) || 0);

// Writes the result summary. Caller must have read resultSnap inside the same transaction.
function writeResult(tx, resultRef, resultSnap, attempt, score, max, now) {
  const prev = resultSnap.exists ? resultSnap.data() : {};
  tx.set(resultRef, {
    uid: attempt.uid, testId: attempt.testId, moduleId: attempt.moduleId || null,
    last: score, best: Math.max(score, typeof prev.best === "number" ? prev.best : 0), max,
    attemptsSubmitted: (prev.attemptsSubmitted || 0) + 1, updatedAt: now,
  });
}

function finalizeInTx(tx, aRef, a, kRef, k, resultRef, resultSnap, now) {
  const answers = fillGaps(k.answers || [], a.total);
  const { score, max } = engine.computeScore(k.questions, answers);
  tx.update(kRef, { answers });
  tx.update(aRef, { status: "submitted", currentIndex: a.total, score, maxScore: max, submittedAt: now });
  writeResult(tx, resultRef, resultSnap, a, score, max, now);
  return { score, max };
}

// =====================================================================
// 2) START (or RESUME) A TEST
// =====================================================================
exports.startAttempt = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  const testId = String((req.data && req.data.testId) || "");
  if (!ID_RE.test(testId)) throw new HttpsError("invalid-argument", "Unknown test.");

  const testSnap = await db.doc(`tests/${testId}`).get();
  const test = testSnap.data();
  if (!test || (test.published !== true && !isAdminReq(req))) throw new HttpsError("not-found", "This test is not available.");
  const now = Timestamp.now();
  if (test.openAt && now.toMillis() < ms(test.openAt)) throw new HttpsError("failed-precondition", `This test opens on ${fmtIST(test.openAt)}.`);
  if (test.closeAt && now.toMillis() > ms(test.closeAt)) throw new HttpsError("failed-precondition", `This test closed on ${fmtIST(test.closeAt)}.`);

  const admin = isAdminReq(req); // the instructor may preview any test
  const profile = await db.doc(`users/${uid}`).get();
  if (!profile.exists && !admin) throw new HttpsError("failed-precondition", "Please complete your student profile first.");

  if (test.requireLessons && test.moduleId && !admin) {
    const mod = (await db.doc(`modules/${test.moduleId}`).get()).data();
    const ids = (mod && mod.lessonIds) || [];
    if (ids.length) {
      const snaps = await db.getAll(...ids.map((id) => db.doc(`progress/${uid}/lessonProgress/${id}`)));
      const left = snaps.filter((s) => !s.exists || s.data().status !== "completed").length;
      if (left > 0) throw new HttpsError("failed-precondition", `Finish all lessons in this module first (${left} left).`);
    }
  }

  return db.runTransaction(async (tx) => {
    // ---- all reads first ----
    const prior = await tx.get(db.collection("attempts").where("uid", "==", uid).where("testId", "==", testId));
    const running = prior.docs.find((d) => d.data().status === "in_progress");
    const resultRef = db.doc(`results/${uid}_${testId}`);
    let runningKey = null, resultSnap = null;
    if (running) {
      runningKey = (await tx.get(db.doc(`attemptKeys/${running.id}`))).data();
      resultSnap = await tx.get(resultRef);
    }

    // ---- resume an unfinished attempt ----
    if (running) {
      const a = running.data();
      if (now.toMillis() <= ms(a.deadline)) {
        const q = runningKey.questions[a.currentIndex];
        const remaining = Math.max(0, Math.round(q.seconds - (now.toMillis() - ms(a.currentShownAt)) / 1000));
        return { attemptId: running.id, resumed: true, deadline: ms(a.deadline), serverNow: now.toMillis(),
                 question: engine.publicView(q, a.currentIndex, a.total, remaining) };
      }
      finalizeInTx(tx, running.ref, a, db.doc(`attemptKeys/${running.id}`), runningKey, resultRef, resultSnap, now);
    }

    const used = prior.docs.filter((d) => d.data().status !== "voided").length;
    const allowedAttempts = (test.maxAttempts || 1) + extraAttemptsFor(profile.exists ? profile.data() : {}, testId);
    if (used >= allowedAttempts) {
      throw new HttpsError("resource-exhausted", `You have used all ${allowedAttempts} attempt(s) for this test. If you need another attempt, ask your instructor.`);
    }

    // ---- build a brand-new, unique paper ----
    const aRef = db.collection("attempts").doc();
    const seed = crypto.randomBytes(16).toString("hex");
    const questions = engine.buildPaper(test.topics || [], seed);
    if (!questions.length) throw new HttpsError("failed-precondition", "This test has no questions yet.");
    let deadlineMs = now.toMillis() + (test.totalMinutes || 30) * 60000;
    if (test.closeAt) deadlineMs = Math.min(deadlineMs, ms(test.closeAt));
    const deadline = Timestamp.fromMillis(deadlineMs);

    tx.set(aRef, {
      uid, testId, moduleId: test.moduleId || null, email: req.auth.token.email || "",
      attemptNo: used + 1, startedAt: now, deadline, currentIndex: 0, currentShownAt: now,
      total: questions.length, status: "in_progress", showScore: test.showScore !== false,
      userAgent: String((req.rawRequest && req.rawRequest.get("user-agent")) || "").slice(0, 160),
    });
    tx.set(db.doc(`attemptKeys/${aRef.id}`), { uid, testId, seed, questions, answers: [] });

    return { attemptId: aRef.id, resumed: false, deadline: deadlineMs, serverNow: now.toMillis(),
             question: engine.publicView(questions[0], 0, questions.length, questions[0].seconds) };
  });
});

// =====================================================================
// 3) SUBMIT ONE ANSWER (no going back; server checks the timer)
// =====================================================================
exports.submitAnswer = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  const out = await submitAnswerTx(req, uid);
  if (out.done && !out.alreadySubmitted) await maybeLifetime(uid, req.auth.token).catch((e) => logger.warn(`lifetime check: ${e.message}`));
  return out;
});
async function submitAnswerTx(req, uid) {
  const d = req.data || {};
  const attemptId = String(d.attemptId || "");
  const index = Number(d.index);
  if (!ID_RE.test(attemptId) || !Number.isInteger(index) || index < 0) throw new HttpsError("invalid-argument", "Bad request.");

  return db.runTransaction(async (tx) => {
    const aRef = db.doc(`attempts/${attemptId}`), kRef = db.doc(`attemptKeys/${attemptId}`);
    const aSnap = await tx.get(aRef);
    const a = aSnap.data();
    if (!a || a.uid !== uid) throw new HttpsError("permission-denied", "This is not your attempt.");
    if (a.status !== "in_progress") return { done: true, alreadySubmitted: true };
    const kSnap = await tx.get(kRef);
    const resultRef = db.doc(`results/${uid}_${a.testId}`);
    const resultSnap = await tx.get(resultRef);
    const k = kSnap.data();

    if (index !== a.currentIndex) {
      throw new HttpsError("failed-precondition", "That question was already answered. Reload the page to continue.");
    }
    const now = Timestamp.now();
    const q = k.questions[index];
    const elapsed = now.toMillis() - ms(a.currentShownAt);
    const grace = cfg.NETWORK_GRACE_SECONDS * 1000;
    const late = elapsed > q.seconds * 1000 + grace || now.toMillis() > ms(a.deadline) + grace;
    const given = engine.sanitizeAnswer(q, d.answer);

    const answers = (k.answers || []).slice();
    answers[index] = { given, late, ms: elapsed, at: now };
    const next = index + 1;

    if (next >= a.total || now.toMillis() > ms(a.deadline) + grace) {
      k.answers = answers;
      const { score, max } = finalizeInTx(tx, aRef, a, kRef, k, resultRef, resultSnap, now);
      return { done: true, score: a.showScore ? score : null, maxScore: a.showScore ? max : null };
    }
    tx.update(kRef, { answers: fillGaps(answers, next) });
    tx.update(aRef, { currentIndex: next, currentShownAt: now });
    const nq = k.questions[next];
    return { done: false, deadline: ms(a.deadline), serverNow: now.toMillis(),
             question: engine.publicView(nq, next, a.total, nq.seconds) };
  });
}

// =====================================================================
// 4) REVIEW ANSWERS (only when the test settings allow it)
// =====================================================================
exports.getReview = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  const attemptId = String((req.data && req.data.attemptId) || "");
  if (!ID_RE.test(attemptId)) throw new HttpsError("invalid-argument", "Bad request.");
  const a = (await db.doc(`attempts/${attemptId}`).get()).data();
  if (!a || (a.uid !== uid && !isAdminReq(req))) throw new HttpsError("permission-denied", "Not your attempt.");
  if (a.status !== "submitted") throw new HttpsError("failed-precondition", "Finish the test first.");
  const test = (await db.doc(`tests/${a.testId}`).get()).data() || {};
  const now = Date.now();
  let allowed = isAdminReq(req) || test.review === "immediate" ||
    (test.review === "afterClose" && test.closeAt && now > ms(test.closeAt));
  // Self-paced default: answers open once the student has passed or has no attempts left
  // (so a second attempt is never taken with the answers of the first in hand).
  // An "afterClose" test without a closing date behaves the same way.
  const selfPaced = test.review === "afterAttempts" || (test.review === "afterClose" && !test.closeAt);
  if (!allowed && selfPaced) {
    const [res, prof, mine] = await Promise.all([db.doc(`results/${a.uid}_${a.testId}`).get(), db.doc(`users/${a.uid}`).get(),
      db.collection("attempts").where("uid", "==", a.uid).where("testId", "==", a.testId).get()]);
    const r = res.exists ? res.data() : null;
    const passed = r && r.max && (r.best / r.max) * 100 >= cfg.PASS_TEST_PERCENT;
    const used = mine.docs.filter((d) => d.data().status !== "voided").length;
    const left = (test.maxAttempts || 1) + extraAttemptsFor(prof.data(), a.testId) - used;
    allowed = !!passed || left <= 0;
  }
  if (!allowed) {
    const when = selfPaced ? ` once you pass (${cfg.PASS_TEST_PERCENT}% or more) or have used all your attempts`
      : test.review === "afterClose" && test.closeAt ? ` after the test closes on ${fmtIST(test.closeAt)}` : " later by your instructor";
    throw new HttpsError("failed-precondition", `Answers will be shown${when}.`);
  }
  const k = (await db.doc(`attemptKeys/${attemptId}`).get()).data();
  return {
    score: a.score, maxScore: a.maxScore,
    items: k.questions.map((q, i) => {
      const ans = k.answers[i] || null;
      return {
        prompt: q.prompt, code: q.code, type: q.type, options: q.options,
        yourAnswer: ans ? ans.given : null, late: ans ? ans.late : false,
        correctAnswer: q.type === "order" ? q.correct.split("\n") : q.correct,
        isCorrect: !!(ans && !ans.late && engine.isCorrect(q, ans.given)),
        explain: q.explain,
      };
    }),
  };
});

// =====================================================================
// 5) AUTO-CLOSE attempts whose time ran out (student closed the tab)
// =====================================================================
exports.closeExpiredAttempts = onSchedule({ schedule: "every 15 minutes", timeZone: "Asia/Kolkata" }, async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - cfg.NETWORK_GRACE_SECONDS * 1000);
  const snap = await db.collection("attempts").where("status", "==", "in_progress").where("deadline", "<", cutoff).limit(200).get();
  let closed = 0;
  for (const doc of snap.docs) {
    await db.runTransaction(async (tx) => {
      const aSnap = await tx.get(doc.ref);
      const a = aSnap.data();
      if (!a || a.status !== "in_progress") return;
      const kRef = db.doc(`attemptKeys/${doc.id}`);
      const k = (await tx.get(kRef)).data();
      const resultRef = db.doc(`results/${a.uid}_${a.testId}`);
      const resultSnap = await tx.get(resultRef);
      finalizeInTx(tx, doc.ref, a, kRef, k, resultRef, resultSnap, Timestamp.now());
      closed++;
    });
    await maybeLifetime(doc.data().uid).catch(() => {});
  }
  if (closed) logger.info(`Closed ${closed} expired attempt(s).`);
});

// =====================================================================
// 6) INSTRUCTOR TOOL: cancel ("void") an attempt, e.g. after a power cut,
//    so the student gets that attempt back. Recomputes the student's result.
// =====================================================================
exports.adminVoidAttempt = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const attemptId = String((req.data && req.data.attemptId) || "");
  if (!ID_RE.test(attemptId)) throw new HttpsError("invalid-argument", "Bad request.");
  const aRef = db.doc(`attempts/${attemptId}`);
  const a = (await aRef.get()).data();
  if (!a) throw new HttpsError("not-found", "Attempt not found.");
  await aRef.update({ status: "voided", voidedAt: Timestamp.now(), voidedBy: req.auth.token.email || "" });

  const rest = await db.collection("attempts").where("uid", "==", a.uid).where("testId", "==", a.testId).get();
  const submitted = rest.docs.map((d) => d.data()).filter((x) => x.status === "submitted")
    .sort((x, y) => ms(x.submittedAt) - ms(y.submittedAt));
  const resultRef = db.doc(`results/${a.uid}_${a.testId}`);
  if (!submitted.length) {
    await resultRef.delete();
  } else {
    const last = submitted[submitted.length - 1];
    await resultRef.set({
      uid: a.uid, testId: a.testId, moduleId: a.moduleId || null,
      last: last.score, best: Math.max(...submitted.map((x) => x.score)), max: last.maxScore,
      attemptsSubmitted: submitted.length, updatedAt: Timestamp.now(),
    });
  }
  return { ok: true };
});

// Instructor: give one student one more attempt at one test (e.g. used both attempts below the pass mark).
exports.adminGrantTestAttempt = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const uid = String((req.data && req.data.uid) || ""), testId = String((req.data && req.data.testId) || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid) || !ID_RE.test(testId)) throw new HttpsError("invalid-argument", "Bad request.");
  const ref = db.doc(`users/${uid}`);
  const u = (await ref.get()).data();
  if (!u) throw new HttpsError("not-found", "Student not found.");
  const n = extraAttemptsFor(u, testId) + 1;
  if (n > 5) throw new HttpsError("failed-precondition", "This student already has 5 extra attempts for this test.");
  await ref.set({ extraAttempts: { [testId]: n } }, { merge: true });
  await db.collection("auditLog").add({ uid, decision: `extra-attempt-${testId}`, by: req.auth.token.email || req.auth.uid, at: FieldValue.serverTimestamp() });
  return { extra: n };
});

// =====================================================================
// 7) REGISTRATION: student submits the uploaded college ID card for review
// =====================================================================
const idPath = (uid) => `idcards/${uid}/idcard.jpg`;

exports.submitForReview = onCall(CALL_OPTS, async (req) => {
  const uid = requireVerified(req);
  const userRec = await getAuth().getUser(uid);
  const claims = userRec.customClaims || {};
  if (accessOk(claims)) return { status: "approved" };
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Please fill in your details first.");
  const prev = await adoptLedger(uid, userRec.email, ref, snap.data());
  if ((prev.submissions || 0) >= cfg.MAX_ID_SUBMISSIONS && claims.status === "rejected") {
    throw new HttpsError("resource-exhausted", "You have used all your submissions. Please email the course instructor.");
  }
  // Anyone who already had access once (an expired or re-registering student)
  // always waits for the instructor, whatever the registration mode...
  if (prev.everApproved === true || claims.status === "expired" || claims.status === "cancelled" || claims.status === "approved") {
    return reregistrationRequest(uid, claims, ref, prev);
  }
  const mode = cfg.REGISTRATION_MODE;
  if (mode === "id-card") {
    let meta;
    try { [meta] = await getStorage().bucket().file(idPath(uid)).getMetadata(); }
    catch { throw new HttpsError("failed-precondition", "We could not find your ID card photo. Please upload it again."); }
    if (Number(meta.size) > 2 * 1024 * 1024 || meta.contentType !== "image/jpeg") {
      throw new HttpsError("invalid-argument", "The ID card photo must be a JPEG image smaller than 2 MB.");
    }
  }
  // "auto": approved straight away. "id-card" and "manual": wait for the instructor.
  await ref.update({
    idUploaded: mode === "id-card", submittedAt: FieldValue.serverTimestamp(),
    submissions: FieldValue.increment(1), rejectReason: null,
  });
  if (mode === "auto") {
    await grantAccess(uid, { reviewedBy: "automatic", reviewedAt: FieldValue.serverTimestamp() });
    return { status: "approved" };
  }
  await setStatusClaim(uid, "pending");
  await ref.update({ status: "pending" });
  return { status: "pending" };
});

// A student whose registration was cancelled asks to register again. The request always
// waits for the instructor; after MAX_REREGISTRATIONS re-registrations it is refused automatically.
async function reregistrationRequest(uid, claims, ref, u) {
  if (u.lifetimeAccess === true) return { status: "approved" };
  // Time just ran out but the hourly job has not run yet: end the registration properly first
  // (a request for extra time that is still waiting must be decided by the administrator).
  if (u.status === "approved") {
    const r = await checkAccessEnd(await ref.get(), Date.now());
    if (r === "lifetime") return { status: "approved", lifetime: true };
    if (r === "waiting") throw new HttpsError("failed-precondition", "Your request for extra time is still waiting for the administrator.");
    if (r !== "cancelled") throw new HttpsError("failed-precondition", "Your registration is still active.");
    u = (await ref.get()).data();
  }
  if (regsUsed(u) >= MAX_REGISTRATIONS) {
    if (u.status !== "cancelled") await setStatusClaim(uid, "cancelled");
    await ref.update({ reregRefusedAt: Timestamp.now(), status: "cancelled", reregistration: false });
    await db.collection("auditLog").add({ uid, decision: "reregistration-refused-limit", by: "automatic", at: FieldValue.serverTimestamp() });
    throw new HttpsError("resource-exhausted", `You have already used all ${cfg.MAX_REREGISTRATIONS} re-registrations, so this request is rejected automatically.`);
  }
  await setStatusClaim(uid, "pending");
  await ref.update({ status: "pending", reregistration: true, submittedAt: FieldValue.serverTimestamp(), reregRequestedAt: Timestamp.now(), rejectReason: null });
  await db.collection("auditLog").add({ uid, decision: "reregistration-requested", by: "self", at: FieldValue.serverTimestamp() });
  return { status: "pending" };
}

exports.requestReregistration = onCall(CALL_OPTS, async (req) => {
  const uid = requireVerified(req);
  const claims = (await getAuth().getUser(uid)).customClaims || {};
  if (accessOk(claims)) return { status: "approved" };
  if (claims.status === "pending") return { status: "pending" };
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().everApproved !== true) throw new HttpsError("failed-precondition", "Please complete your registration first.");
  return reregistrationRequest(uid, claims, ref, snap.data());
});

// =====================================================================
// 8) REGISTRATION: instructor approves or rejects (ID image is then deleted)
// =====================================================================
exports.reviewRegistration = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const d = req.data || {};
  const uid = String(d.uid || "");
  const decision = String(d.decision || "");
  const reason = String(d.reason || "").trim().slice(0, 300);
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid) || !["approved", "rejected"].includes(decision)) throw new HttpsError("invalid-argument", "Bad request.");
  if (decision === "rejected" && !reason) throw new HttpsError("invalid-argument", "Please give a reason for rejecting.");
  const by = req.auth.token.email || req.auth.uid;
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) throw new HttpsError("not-found", "Student not found.");
  const isRereg = u.everApproved === true;
  const fresh = isRereg;   // a re-registration always starts the course afresh
  if (u.status !== "pending") throw new HttpsError("failed-precondition", "This registration is not waiting for approval.");
  if (decision === "approved" && isRereg && regsUsed(u) >= MAX_REGISTRATIONS) {
    throw new HttpsError("failed-precondition", `This student has already used all ${cfg.MAX_REREGISTRATIONS} re-registrations.`);
  }
  if (decision === "approved") {
    if (fresh) {
      await resetCourseData(uid);
      await db.doc(`users/${uid}`).set({ extraAttempts: FieldValue.delete() }, { merge: true });
      const cr = await db.doc(`certRequests/${uid}`).get();
      if (cr.exists && cr.data().status !== "issued") await cr.ref.delete();
    }
    await grantAccess(uid, { idUploaded: false, reviewedBy: by, reviewedAt: FieldValue.serverTimestamp() });
  } else if (isRereg) {
    // A refused re-registration leaves the registration cancelled; the student may ask again (it does not count).
    await setStatusClaim(uid, "cancelled");
    await db.doc(`users/${uid}`).set({ status: "cancelled", reregistration: false, rejectReason: reason, reviewedBy: by, reviewedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await setStatusClaim(uid, "rejected");
    await db.doc(`users/${uid}`).set({ status: "rejected", rejectReason: reason, idUploaded: false, reviewedBy: by, reviewedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await db.collection("auditLog").add({ uid, decision, fresh, reason: reason || null, by, at: FieldValue.serverTimestamp() });
  if (cfg.REGISTRATION_MODE === "id-card") await getStorage().bucket().file(idPath(uid)).delete({ ignoreNotFound: true }).catch(() => {});
  return { ok: true };
});

// =====================================================================
// 9) PRIVACY: a student can delete their account and all their data
// =====================================================================
exports.deleteMyAccount = onCall(CALL_OPTS, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please log in first.");
  const uid = req.auth.uid;
  if (req.auth.token.admin === true) throw new HttpsError("failed-precondition", "Instructor accounts cannot be deleted here.");
  if (cfg.REGISTRATION_MODE === "id-card") await getStorage().bucket().file(idPath(uid)).delete({ ignoreNotFound: true }).catch(() => {});
  await resetCourseData(uid);
  const prof = (await db.doc(`users/${uid}`).get()).data() || {};
  if (prof.certificateId) await db.doc(`certificates/${prof.certificateId}`).delete();
  await db.doc(`certRequests/${uid}`).delete();
  await db.doc(`users/${uid}`).delete();
  await db.collection("auditLog").add({ uid, decision: "account-deleted", by: "self", at: FieldValue.serverTimestamp() });
  await getAuth().deleteUser(uid);
  return { ok: true };
});

// =====================================================================
// 10) PRIVACY: ID card photos never stay longer than ID_CARD_MAX_DAYS
// =====================================================================
exports.purgeOldIdCards = onSchedule({ schedule: "every day 03:00", timeZone: "Asia/Kolkata" }, async () => {
  if (cfg.REGISTRATION_MODE !== "id-card") return;   // no ID card photos are stored in the other modes
  const cutoff = Date.now() - cfg.ID_CARD_MAX_DAYS * 86400000;
  const [files] = await getStorage().bucket().getFiles({ prefix: "idcards/" });
  let n = 0;
  for (const f of files) {
    if (new Date(f.metadata.timeCreated).getTime() > cutoff) continue;
    const uid = f.name.split("/")[1];
    await f.delete({ ignoreNotFound: true });
    try {
      const rec = await getAuth().getUser(uid);
      if ((rec.customClaims || {}).status === "pending") {
        await getAuth().setCustomUserClaims(uid, { ...(rec.customClaims || {}), status: "rejected" });
        await db.doc(`users/${uid}`).set({ status: "rejected", idUploaded: false,
          rejectReason: `Your ID card was not reviewed within ${cfg.ID_CARD_MAX_DAYS} days, so it was deleted. Please upload it again.` }, { merge: true });
      }
    } catch { /* user deleted */ }
    n++;
  }
  if (n) logger.info(`Deleted ${n} old ID card photo(s).`);
});

// =====================================================================
// 11) ACCESS PERIOD: exactly ACCESS_DAYS, at most one extension, then cancellation
// =====================================================================
// Access stops the moment the end date passes (the date is in the student's sign-in
// token, checked by the rules and the server). These jobs then mark the registration
// "cancelled", or give lifetime access to students who finished everything in time.
async function checkAccessEnd(d, now) {
  const u = d.data();
  if (u.status !== "approved" || u.lifetimeAccess === true) return "skip";
  if (!u.accessUntil) {                                   // approved before access periods existed
    await grantAccess(d.id, { registrationCount: u.registrationCount || 1 });
    return "started";
  }
  if (ms(u.accessUntil) > now) return "skip";
  if ((await completionCheck(d.id)).complete) { await grantLifetime(d.id); return "lifetime"; }
  if (u.extensionRequest && u.extensionRequest.status === "pending") return "waiting";   // the instructor decides first
  await setStatusClaim(d.id, "cancelled");
  await d.ref.update({ status: "cancelled", cancelledAt: Timestamp.now(), reregistration: false });
  await db.collection("auditLog").add({ uid: d.id, decision: "registration-cancelled-time-up", by: "automatic", at: FieldValue.serverTimestamp() });
  return "cancelled";
}
async function sweep(docs) {
  const now = Date.now(), count = {};
  for (const d of docs) {
    try { const r = await checkAccessEnd(d, now); count[r] = (count[r] || 0) + 1; }
    catch (e) { logger.warn(`Access check failed for ${d.id}: ${e.message}`); }
  }
  delete count.skip;
  if (Object.keys(count).length) logger.info(`Access check: ${JSON.stringify(count)}`);
}
// Every hour: registrations whose time is up.
exports.endAccessHourly = onSchedule({ schedule: "every 60 minutes", timeZone: "Asia/Kolkata" }, async () => {
  const snap = await db.collection("users").where("status", "==", "approved").where("accessUntil", "<=", Timestamp.now()).get();
  await sweep(snap.docs);
});
// Every night: everyone approved (also gives older students without a date their period).
exports.expireAccess = onSchedule({ schedule: "every day 00:30", timeZone: "Asia/Kolkata" }, async () => {
  const snap = await db.collection("users").where("status", "==", "approved").get();
  await sweep(snap.docs);
});

// Student: ask once for extra time (first registration only, before the period ends).
exports.requestExtension = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  if (isAdminReq(req)) throw new HttpsError("failed-precondition", "Instructor accounts have no access period.");
  const reason = String((req.data && req.data.reason) || "").trim().replace(/\s+/g, " ");
  if (reason.length < 15 || reason.length > 500) throw new HttpsError("invalid-argument", "Please explain in 15 to 500 characters why you need extra time.");
  const ref = db.doc(`users/${uid}`);
  const u = (await ref.get()).data() || {};
  if (u.lifetimeAccess === true) throw new HttpsError("failed-precondition", "You already have lifetime access.");
  if (regsUsed(u) > 1) throw new HttpsError("failed-precondition", "Extra time is available only in the first registration.");
  if (u.extensionUsed === true) throw new HttpsError("failed-precondition", "You have already received your one extension.");
  if (u.extensionRequest && u.extensionRequest.status === "pending") return { status: "pending" };
  if (u.extensionRequest && u.extensionRequest.status === "rejected") throw new HttpsError("failed-precondition", "Your request for extra time was already answered.");
  await ref.update({ extensionRequest: { status: "pending", reason, requestedAt: Timestamp.now() } });
  await db.collection("auditLog").add({ uid, decision: "extension-requested", by: "self", at: FieldValue.serverTimestamp() });
  return { status: "pending" };
});

// Instructor: approve (1 to MAX_EXTENSION_DAYS days, added to the original end date) or refuse.
exports.adminDecideExtension = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const d = req.data || {};
  const uid = String(d.uid || "");
  const approve = d.approve === true;
  const days = Number(d.days);
  const note = String(d.note || "").trim().slice(0, 300);
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) throw new HttpsError("invalid-argument", "Bad request.");
  if (approve && (!Number.isInteger(days) || days < 1 || days > cfg.MAX_EXTENSION_DAYS)) throw new HttpsError("invalid-argument", `Choose 1 to ${cfg.MAX_EXTENSION_DAYS} days.`);
  const ref = db.doc(`users/${uid}`);
  const u = (await ref.get()).data();
  if (!u || !u.extensionRequest || u.extensionRequest.status !== "pending") throw new HttpsError("failed-precondition", "There is no request for extra time from this student.");
  if (u.status !== "approved") throw new HttpsError("failed-precondition", "This registration is no longer active.");
  const by = req.auth.token.email || req.auth.uid;
  if (approve) {
    if (u.extensionUsed === true || regsUsed(u) > 1) throw new HttpsError("failed-precondition", "This student cannot receive extra time.");
    const accessUntil = ms(u.accessUntil) + days * DAY_MS;
    const rec = await getAuth().getUser(uid);
    await getAuth().setCustomUserClaims(uid, { ...baseClaims(rec.customClaims), status: "approved", accessUntil });
    await ref.update({ accessUntil: Timestamp.fromMillis(accessUntil), extensionUsed: true, extensionDays: days,
      extensionRequest: { ...u.extensionRequest, status: "approved", days, note, decidedAt: Timestamp.now(), decidedBy: by } });
    await db.collection("auditLog").add({ uid, decision: `extension-approved-${days}d`, by, at: FieldValue.serverTimestamp() });
    if (accessUntil <= Date.now()) await checkAccessEnd(await ref.get(), Date.now());   // granted too late to help
    return { accessUntil };
  }
  await ref.update({ extensionRequest: { ...u.extensionRequest, status: "rejected", note, decidedAt: Timestamp.now(), decidedBy: by } });
  await db.collection("auditLog").add({ uid, decision: "extension-rejected", reason: note || null, by, at: FieldValue.serverTimestamp() });
  if (ms(u.accessUntil) <= Date.now()) await checkAccessEnd(await ref.get(), Date.now());   // time already up: cancel now
  return { ok: true };
});

// =====================================================================
// 12) FINAL PROJECT: one personal project per student, at most 2 submissions
// =====================================================================
async function lessonStatus(uid) {
  const mods = await db.collection("modules").get();
  const core = cfg.CORE_MODULES || [];
  const ids = mods.docs.filter((m) => !core.length || core.includes(m.id)).flatMap((m) => m.data().lessonIds || []);
  if (!ids.length) return { total: 0, done: 0 };
  const snaps = await db.getAll(...ids.map((id) => db.doc(`progress/${uid}/lessonProgress/${id}`)));
  return { total: ids.length, done: snaps.filter((s) => s.exists && s.data().status === "completed").length };
}

exports.assignProject = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  const ref = db.doc(`projects/${uid}`);
  if ((await ref.get()).exists) return { ok: true };
  if (!isAdminReq(req)) {
    const ls = await lessonStatus(uid);
    if (ls.done < ls.total) throw new HttpsError("failed-precondition", `Finish all lessons first (${ls.total - ls.done} left).`);
  }
  const prof = (await db.doc(`users/${uid}`).get()).data() || {};
  const seed = crypto.randomBytes(16).toString("hex");
  const p = projects.buildProject(seed);
  try {
    await ref.create({
      uid, email: req.auth.token.email || "", name: prof.fullName || "", ...p, seed,
      assignedAt: Timestamp.now(), status: "assigned", best: 0, attempts: [],
      maxAttempts: cfg.PROJECT_MAX_ATTEMPTS, passPercent: cfg.PASS_PROJECT_PERCENT,
    });
  } catch (e) {
    if (e.code !== 6) throw e;   // 6 = ALREADY_EXISTS: assigned by a parallel call
  }
  return { ok: true };
});

const FILE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.\-/]{0,79}$/;
exports.submitProject = onCall({ ...CALL_OPTS, memory: "512MiB" }, async (req) => {
  const uid = requireMember(req);
  const d = req.data || {};
  const language = d.language === "cpp" ? "cpp" : d.language === "python" ? "python" : null;
  if (!language) throw new HttpsError("invalid-argument", "Choose Python or C++.");
  const files = Array.isArray(d.files) ? d.files : [];
  if (files.length < 1 || files.length > 15) throw new HttpsError("invalid-argument", "Add 1 to 15 files.");
  const names = new Set();
  let total = 0;
  const clean = files.map((f) => {
    const name = String((f && f.name) || "").trim(), content = String((f && f.content) || "");
    if (!FILE_RE.test(name) || name.includes("..")) throw new HttpsError("invalid-argument", `File name not allowed: "${name.slice(0, 40)}". Use letters, numbers, _ - . and /.`);
    if (names.has(name)) throw new HttpsError("invalid-argument", `The file ${name} is listed twice.`);
    names.add(name);
    if (!content.trim()) throw new HttpsError("invalid-argument", `The file ${name} is empty.`);
    if (content.length > 40000) throw new HttpsError("invalid-argument", `The file ${name} is too long (40,000 characters at most).`);
    total += content.length;
    return { name, content };
  });
  if (total > 150000) throw new HttpsError("invalid-argument", "All files together are too long (150,000 characters at most).");
  const report = String(d.report || "").trim();
  if (report.length < 150 || report.length > 6000) throw new HttpsError("invalid-argument", "The report must be 150 to 6,000 characters.");
  const output = String(d.output || "").slice(0, 10000);
  let videoUrl = String(d.videoUrl || "").trim();
  if (videoUrl) {
    let u;
    try { u = new URL(videoUrl); } catch { throw new HttpsError("invalid-argument", "The video link is not a valid web address."); }
    if (u.protocol !== "https:" || videoUrl.length > 300) throw new HttpsError("invalid-argument", "The video link must start with https:// (300 characters at most).");
    videoUrl = u.toString();
  }
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`projects/${uid}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("failed-precondition", "Open your project page first.");
    const p = snap.data();
    if (p.status === "submitted") throw new HttpsError("failed-precondition", "Your last submission is still being marked.");
    if (p.status === "passed") throw new HttpsError("failed-precondition", "You have already passed the project.");
    const attempts = p.attempts || [];
    const maxA = p.maxAttempts || cfg.PROJECT_MAX_ATTEMPTS;
    if (attempts.length >= maxA) throw new HttpsError("resource-exhausted", `You have used all ${maxA} of your project submissions.`);
    attempts.push({ no: attempts.length + 1, language, files: clean, report, output, videoUrl, submittedAt: Timestamp.now(), status: "submitted" });
    tx.update(ref, { attempts, status: "submitted", lastSubmittedAt: Timestamp.now() });
    return { ok: true, attemptNo: attempts.length };
  });
});

exports.adminGradeProject = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const d = req.data || {};
  const uid = String(d.uid || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) throw new HttpsError("invalid-argument", "Bad request.");
  const feedback = String(d.feedback || "").trim().slice(0, 3000);
  if (feedback.length < 10) throw new HttpsError("invalid-argument", "Please write some feedback for the student.");
  const scores = {};
  let total = 0;
  for (const c of projects.RUBRIC) {
    const v = Number(d.scores && d.scores[c.id]);
    if (!Number.isInteger(v) || v < 0 || v > c.max) throw new HttpsError("invalid-argument", `${c.label}: give 0 to ${c.max} marks.`);
    scores[c.id] = v; total += v;
  }
  const by = req.auth.token.email || req.auth.uid;
  const result = await db.runTransaction(async (tx) => {
    const ref = db.doc(`projects/${uid}`);
    const p = (await tx.get(ref)).data();
    if (!p || p.status !== "submitted") throw new HttpsError("failed-precondition", "There is no submission waiting to be marked.");
    const attempts = p.attempts || [];
    const last = attempts[attempts.length - 1];
    Object.assign(last, { status: "graded", score: total, scores, feedback, gradedAt: Timestamp.now(), gradedBy: by });
    const passed = total >= cfg.PASS_PROJECT_PERCENT;
    const status = passed ? "passed" : attempts.length >= (p.maxAttempts || cfg.PROJECT_MAX_ATTEMPTS) ? "failed" : "needs-resubmit";
    tx.update(ref, { attempts, status, best: Math.max(p.best || 0, total) });
    return { status, total };
  });
  await db.collection("auditLog").add({ uid, decision: `project-${result.status}-${result.total}`, by, at: FieldValue.serverTimestamp() });
  return result;
});

// Instructor: allow one more project submission (only for genuine problems, e.g. a wrong file).
exports.adminGrantProjectAttempt = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const uid = String((req.data && req.data.uid) || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) throw new HttpsError("invalid-argument", "Bad request.");
  const ref = db.doc(`projects/${uid}`);
  const p = (await ref.get()).data();
  if (!p || p.status !== "failed") throw new HttpsError("failed-precondition", "Only a failed project can get an extra submission.");
  await ref.update({ status: "needs-resubmit", maxAttempts: (p.maxAttempts || cfg.PROJECT_MAX_ATTEMPTS) + 1 });
  await db.collection("auditLog").add({ uid, decision: "project-extra-attempt", by: req.auth.token.email || req.auth.uid, at: FieldValue.serverTimestamp() });
  return { ok: true };
});

// =====================================================================
// 13) LIFETIME ACCESS: every lesson done and every test passed in time
// =====================================================================
// "Complete" = all lessons marked complete and the best score in every published
// test at least PASS_TEST_PERCENT. Work is only possible while access is open, so a
// complete student always finished inside the access window.
async function completionCheck(uid) {
  const [ls, testsSnap] = await Promise.all([lessonStatus(uid), db.collection("tests").where("published", "==", true).get()]);
  const nowMs = Date.now();
  const tests = testsSnap.docs.filter((t) => !t.data().openAt || ms(t.data().openAt) <= nowMs)   // not-yet-open tests do not count
    .filter((t) => !(cfg.CORE_MODULES || []).length || !t.data().moduleId || cfg.CORE_MODULES.includes(t.data().moduleId))   // advanced-track tests do not count
    .map((t) => ({ id: t.id, title: t.data().title || t.id, order: t.data().order || 0, moduleId: t.data().moduleId || null }))
    .sort((a, b) => a.order - b.order);
  const resSnaps = tests.length ? await db.getAll(...tests.map((t) => db.doc(`results/${uid}_${t.id}`))) : [];
  const testRows = tests.map((t, i) => {
    const r = resSnaps[i].exists ? resSnaps[i].data() : null;
    const pct = r && r.max ? Math.round((r.best / r.max) * 1000) / 10 : 0;
    return { id: t.id, title: t.title, best: r ? r.best : 0, max: r ? r.max : 0, pct, ok: !!r && pct >= cfg.PASS_TEST_PERCENT };
  });
  // At least one test must be open: finishing the lessons alone never gives lifetime access.
  return { complete: ls.total > 0 && ls.done >= ls.total && testRows.length > 0 && testRows.every((t) => t.ok), lessons: ls, tests: testRows };
}

async function grantLifetime(uid) {
  const rec = await getAuth().getUser(uid);
  await getAuth().setCustomUserClaims(uid, { ...baseClaims(rec.customClaims), status: "approved", lifetime: true });
  await db.doc(`users/${uid}`).set({ status: "approved", lifetimeAccess: true, lifetimeSince: Timestamp.now(), accessUntil: null, expiredAt: null }, { merge: true });
  await db.collection("auditLog").add({ uid, decision: "lifetime-access", by: "automatic", at: FieldValue.serverTimestamp() });
}

// Called after a test ends; cheap exit when the student already has lifetime access.
async function maybeLifetime(uid, token) {
  if (token && (token.lifetime === true || token.admin === true)) return false;
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.lifetimeAccess === true || u.everApproved !== true || u.status !== "approved") return false;
  if (!(await completionCheck(uid)).complete) return false;
  await grantLifetime(uid);
  return true;
}

// Student's course page asks this when everything looks complete on their side.
exports.checkCompletion = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  if (isAdminReq(req)) return { lifetime: false };
  const granted = await maybeLifetime(uid, req.auth.token);
  const u = (await db.doc(`users/${uid}`).get()).data() || {};
  return { lifetime: u.lifetimeAccess === true, granted };
});

// =====================================================================
// 14) CERTIFICATES: student applies -> instructor signs -> student downloads
// =====================================================================
async function certificateCheck(uid) {
  const [c, projSnap] = await Promise.all([completionCheck(uid), db.doc(`projects/${uid}`).get()]);
  const p = projSnap.exists ? projSnap.data() : null;
  const project = { status: p ? p.status : "not-started", best: p ? p.best || 0 : 0, title: p ? p.title : "" };
  const missing = [];
  if (c.lessons.done < c.lessons.total) missing.push(`Finish all lessons (${c.lessons.total - c.lessons.done} left).`);
  c.tests.filter((t) => !t.ok).forEach((t) => missing.push(`${t.title}: score at least ${cfg.PASS_TEST_PERCENT}% (best so far ${t.pct}%).`));
  if (project.status !== "passed") missing.push(`Pass your project with at least ${cfg.PASS_PROJECT_PERCENT}%.`);
  return { eligible: missing.length === 0 && c.lessons.total > 0, missing, lessons: c.lessons, tests: c.tests, project };
}

function describeProfile(p) {
  if (p.category === "working") return [p.designation, p.department, p.institution].filter(Boolean).join(", ");
  if (p.category === "student") return [`${p.programme || ""} student`.trim(), p.department, p.institution].filter(Boolean).join(", ");
  if (p.category === "graduate") return [`${p.programme || ""} graduate`.trim(), p.department, p.institution].filter(Boolean).join(", ");
  return [p.department, p.institution].filter(Boolean).join(", ");
}

// Student applies. Everything printed on the certificate is filled in here
// automatically from the records; the instructor only checks and signs.
exports.applyForCertificate = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  if (isAdminReq(req)) throw new HttpsError("failed-precondition", "Instructor accounts do not get certificates.");
  const ref = db.doc(`certRequests/${uid}`);
  const prev = (await ref.get()).data();
  if (prev && (prev.status === "pending" || prev.status === "issued")) return { status: prev.status, certificateId: prev.certificateId || null };
  const e = await certificateCheck(uid);
  if (!e.eligible) throw new HttpsError("failed-precondition", `Not yet: ${e.missing.join(" ")}`);
  const u = (await db.doc(`users/${uid}`).get()).data() || {};
  const mods = (await db.collection("modules").get()).docs.map((m) => m.data()).sort((a, b) => (a.order || 0) - (b.order || 0));
  await ref.set({
    uid, email: u.email || req.auth.token.email || "", status: "pending", requestedAt: Timestamp.now(),
    name: u.fullName || "", about: describeProfile(u), registeredAt: u.createdAt || u.accessStart || Timestamp.now(),
    course: cfg.CERT_COURSE_TITLE, modules: mods.map((m) => m.title || "").filter(Boolean),
    tests: e.tests.map((t) => ({ title: t.title, best: t.best, max: t.max, pct: t.pct })),
    testAverage: e.tests.length ? Math.round(e.tests.reduce((s2, t) => s2 + t.pct, 0) / e.tests.length) : null,
    projectTitle: e.project.title, projectScore: e.project.best,
    instructor: cfg.CERT_INSTRUCTOR, instructorTitle: cfg.CERT_INSTRUCTOR_TITLE,
  });
  await db.collection("auditLog").add({ uid, decision: "certificate-requested", by: "self", at: FieldValue.serverTimestamp() });
  // Finishing the project also means the lessons and tests are complete: make sure access is lifelong.
  await maybeLifetime(uid, req.auth.token).catch(() => {});
  return { status: "pending" };
});

const CERT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCertId() {
  const b = crypto.randomBytes(10);
  let s2 = "";
  for (let i = 0; i < 10; i++) s2 += CERT_ALPHABET[b[i] % CERT_ALPHABET.length];
  return `R2L-${new Date().getFullYear()}-${s2}`;
}
const SIG_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

// Instructor endorses one request with a signature image; the certificate becomes downloadable.
exports.adminSignCertificate = onCall({ ...CALL_OPTS, memory: "512MiB" }, async (req) => {
  requireAdmin(req);
  const d = req.data || {};
  const uid = String(d.uid || "");
  const signature = String(d.signature || "");
  const name = String(d.name || "").trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) throw new HttpsError("invalid-argument", "Bad request.");
  if (!SIG_RE.test(signature) || signature.length > 300000) throw new HttpsError("invalid-argument", "Upload your signature as a PNG or JPEG image (under 200 KB).");
  if (name && (name.length < 2 || name.length > 80)) throw new HttpsError("invalid-argument", "The name must be 2 to 80 characters.");
  const by = req.auth.token.email || req.auth.uid;
  const certId = await db.runTransaction(async (tx) => {
    const rRef = db.doc(`certRequests/${uid}`), uRef = db.doc(`users/${uid}`);
    const r = (await tx.get(rRef)).data();
    const u = (await tx.get(uRef)).data();
    if (!r || r.status !== "pending") throw new HttpsError("failed-precondition", "There is no certificate request waiting for this student.");
    if (!u) throw new HttpsError("failed-precondition", "Student profile not found.");
    const id = newCertId();
    const signedAt = Timestamp.now();
    const validUntil = new Date(signedAt.toMillis());
    validUntil.setFullYear(validUntil.getFullYear() + cfg.CERT_VALID_YEARS);
    tx.set(db.doc(`certificates/${id}`), {
      certId: id, name: name || r.name, about: r.about, registeredAt: r.registeredAt, course: r.course, modules: r.modules,
      tests: r.tests, testAverage: r.testAverage, projectTitle: r.projectTitle, projectScore: r.projectScore,
      issuedAt: signedAt, validUntil: Timestamp.fromDate(validUntil), signature,
      instructor: cfg.CERT_INSTRUCTOR, instructorTitle: cfg.CERT_INSTRUCTOR_TITLE,
      passTest: cfg.PASS_TEST_PERCENT, passProject: cfg.PASS_PROJECT_PERCENT,
    });
    tx.update(rRef, { status: "issued", certificateId: id, signedAt, signedBy: by, ...(name ? { name } : {}) });
    tx.update(uRef, { certificateId: id, certifiedAt: signedAt });
    return id;
  });
  await db.collection("auditLog").add({ uid, decision: `certificate-signed-${certId}`, by, at: FieldValue.serverTimestamp() });
  return { certificateId: certId };
});

// Instructor sends a request back (e.g. a wrong name); the student can apply again.
exports.adminReturnCertificateRequest = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const uid = String((req.data && req.data.uid) || "");
  const note = String((req.data && req.data.note) || "").trim().slice(0, 300);
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid) || note.length < 5) throw new HttpsError("invalid-argument", "Please write a short note for the student.");
  const ref = db.doc(`certRequests/${uid}`);
  const r = (await ref.get()).data();
  if (!r || r.status !== "pending") throw new HttpsError("failed-precondition", "No pending request.");
  await ref.update({ status: "returned", note, returnedAt: Timestamp.now() });
  await db.collection("auditLog").add({ uid, decision: "certificate-returned", reason: note, by: req.auth.token.email || req.auth.uid, at: FieldValue.serverTimestamp() });
  return { ok: true };
});

// =====================================================================
// 14) REAL-HARDWARE LICENSE: students ask, the course administrator decides
// =====================================================================
// Connecting a real robot (rosbridge from the RViz page, or launching a *_bringup / real.launch.py) needs a
// license. hardwareLicenses/{uid} is written only here: { status: pending|approved|rejected|revoked, robots,
// purpose, requestedAt, decidedAt, decidedBy, validUntil, note, key }.
const HW_ROBOTS = /^[a-z0-9_]{2,40}$/;
exports.requestHardwareLicense = onCall(CALL_OPTS, async (req) => {
  const uid = requireMember(req);
  const d = req.data || {};
  const robots = [...new Set((Array.isArray(d.robots) ? d.robots : [d.robot]).map((x) => String(x || "").trim()).filter((x) => HW_ROBOTS.test(x)))].slice(0, 20);
  const purpose = String(d.purpose || "").trim().replace(/\s+/g, " ");
  if (!robots.length) throw new HttpsError("invalid-argument", "Name the robot you want to connect.");
  if (purpose.length < 15 || purpose.length > 600) throw new HttpsError("invalid-argument", "Describe in 15 to 600 characters which robot you will connect, where, and what for.");
  const ref = db.doc(`hardwareLicenses/${uid}`);
  const cur = (await ref.get()).data();
  if (cur && cur.status === "pending") return { status: "pending" };
  if (cur && cur.status === "approved" && (!cur.validUntil || ms(cur.validUntil) > Date.now()) && robots.every((r) => (cur.robots || []).includes(r) || (cur.robots || []).includes("all"))) return { status: "approved" };
  const u = (await db.doc(`users/${uid}`).get()).data() || {};
  await ref.set({ status: "pending", robots, purpose, fullName: u.fullName || "", email: req.auth.token.email || "", requestedAt: Timestamp.now(), previous: cur ? cur.status : null });
  await db.collection("auditLog").add({ uid, decision: "hardware-license-requested", robots, by: "self", at: FieldValue.serverTimestamp() });
  return { status: "pending" };
});

// Instructor: approve (for some robots or "all", for 1 to 365 days), refuse, or revoke.
exports.adminDecideHardwareLicense = onCall(CALL_OPTS, async (req) => {
  requireAdmin(req);
  const d = req.data || {};
  const uid = String(d.uid || "");
  if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) throw new HttpsError("invalid-argument", "Bad request.");
  const action = String(d.action || "");
  if (!["approve", "reject", "revoke"].includes(action)) throw new HttpsError("invalid-argument", "Bad request.");
  const note = String(d.note || "").trim().slice(0, 300);
  const ref = db.doc(`hardwareLicenses/${uid}`);
  const cur = (await ref.get()).data();
  if (!cur) throw new HttpsError("failed-precondition", "This student has not asked for a hardware license.");
  const by = req.auth.token.email || req.auth.uid;
  if (action === "approve") {
    const days = Number(d.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new HttpsError("invalid-argument", "Choose 1 to 365 days.");
    const robots = (Array.isArray(d.robots) && d.robots.length ? d.robots : cur.robots || []).map(String).filter((x) => x === "all" || HW_ROBOTS.test(x)).slice(0, 40);
    const key = `ROS2LAB-HW-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    await ref.update({ status: "approved", robots, validUntil: Timestamp.fromMillis(Date.now() + days * DAY_MS), note, key, decidedAt: Timestamp.now(), decidedBy: by });
    await db.collection("auditLog").add({ uid, decision: `hardware-license-approved-${days}d`, robots, by, at: FieldValue.serverTimestamp() });
    return { status: "approved", key };
  }
  await ref.update({ status: action === "reject" ? "rejected" : "revoked", note, decidedAt: Timestamp.now(), decidedBy: by });
  await db.collection("auditLog").add({ uid, decision: `hardware-license-${action}ed`, by, at: FieldValue.serverTimestamp() });
  return { status: action === "reject" ? "rejected" : "revoked" };
});
