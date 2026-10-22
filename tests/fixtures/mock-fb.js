// A stand-in for public/js/fb.js in browser tests (served by Playwright's page.route in place of js/fb.js).
// There is no test account or Firebase emulator wired into the site, so the signed-in pages are tested with this:
// one approved student whose progress is MOCK below. Only the calls the pages make are modelled.
import { CONSENT_VERSION } from "/js/firebase-config.js";
const plan = await (await fetch("/data/course-plan.json")).json();
const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const NOW = Date.now(), DAY = 86400000;

// the student: Weeks 1–2 done, Week 3 (IN) lessons IN1 + IN2 done and IN3 started; Week 1 test 12/15, Week 2 test 8/15
export const MOCK = {
  done: [...plan.modules[0].lessons, ...plan.modules[1].lessons].map((l) => l.id).concat(["IN1", "IN2"]),
  started: ["IN3"],
  results: { testW1: [12, 15], testW2: [8, 15] },
};
const W = typeof window !== "undefined" ? window : {};
const user = { uid: "mockStudent0000000001", email: "student@example.com", displayName: "Test Student", emailVerified: true };
const claims = { status: "approved", accessUntil: NOW + 40 * DAY, email_verified: true };
// window.__MOCK_SIGNED_OUT: nobody is logged in (signin.html, register.html); window.__MOCK_ADMIN: the instructor (admin.html)
if (W.__MOCK_ADMIN) { claims.admin = true; user.displayName = "Instructor"; }
const DOCS = {
  [`users/${user.uid}`]: { fullName: "Test Student", status: "approved", accessStart: ts(NOW - 20 * DAY), accessUntil: ts(NOW + 40 * DAY), consentVersion: CONSENT_VERSION },
};
// Scenarios for the portal comparison: a test sets window.__MOCK_SCENARIO before the page loads (default: the student above).
const SC = (typeof window !== "undefined" && window.__MOCK_SCENARIO) || "default";
const allIds = plan.modules.filter((m) => m.core).flatMap((m) => m.lessons.map((l) => l.id));
if (SC !== "default") {
  MOCK.done = SC === "optional-started" ? allIds.concat(["UR1", "UR2"]) : SC === "fresh" ? [] : allIds;
  MOCK.started = [];
  MOCK.results = SC === "fresh" ? {} : Object.fromEntries(plan.modules.filter((m) => m.core).map((m) => [m.tests[0].id, [m.tests[0].questions - 1, m.tests[0].questions]]));
  if (SC === "tests-failed") MOCK.results.testNP = [5, 16];
}
if (SC === "lifetime" || SC === "certified") claims.lifetime = true;
const submitted = (testId, score, max, at) => ({ id: `att_${testId}_${at}`, uid: user.uid, testId, status: "submitted", score, maxScore: max, submittedAt: ts(NOW - at * DAY) });
const PROJECTS = {
  "project-assigned": { status: "assigned", title: "Warehouse patrol robot", attempts: [], maxAttempts: 2, best: 0 },
  "project-resubmit": { status: "needs-resubmit", title: "Warehouse patrol robot", attempts: [{}], maxAttempts: 2, best: 72 },
  "project-submitted": { status: "submitted", title: "Warehouse patrol robot", attempts: [{}], maxAttempts: 2, best: 0 },
  "applied": { status: "passed", title: "Warehouse patrol robot", attempts: [{}], maxAttempts: 2, best: 88 },
  "certified": { status: "passed", title: "Warehouse patrol robot", attempts: [{}], maxAttempts: 2, best: 91 },
};
if (PROJECTS[SC]) DOCS[`projects/${user.uid}`] = PROJECTS[SC];
if (SC === "applied") DOCS[`certRequests/${user.uid}`] = { status: "pending", requestedAt: ts(NOW - DAY) };
if (SC === "certified") { DOCS[`users/${user.uid}`].certificateId = "R2L-2026-MOCK000001"; DOCS[`users/${user.uid}`].lifetimeAccess = true; DOCS[`users/${user.uid}`].lifetimeSince = ts(NOW - 3 * DAY); }
if (SC === "low-days") { claims.accessUntil = NOW + 3 * DAY; DOCS[`users/${user.uid}`].accessUntil = ts(NOW + 3 * DAY); }
const COLS = {
  modules: plan.modules.map((m) => ({ id: m.id, title: m.title, short: `Week ${m.week}`, order: m.order, description: m.description, lessonIds: m.lessons.map((l) => l.id), lessons: m.lessons })),
  [`progress/${user.uid}/lessonProgress`]: [
    ...MOCK.done.map((id) => ({ id, status: "completed", completedAt: ts(NOW - DAY) })),
    ...MOCK.started.map((id) => ({ id, status: "started" })),
  ],
  tests: plan.modules.flatMap((m) => m.tests.map((t, i) => ({ id: t.id, title: t.title, moduleId: m.id, order: m.order * 10 + i, published: true, openAt: ts(NOW - 30 * DAY),
    totalMinutes: t.minutes, maxAttempts: t.maxAttempts, topics: [{ topic: "mock", count: t.questions }] }))),
  results: Object.entries(MOCK.results).map(([testId, [best, max]]) => ({ id: `${user.uid}_${testId}`, uid: user.uid, testId, best, max })),
  attempts: SC === "default" || SC === "fresh" ? [] : Object.keys(MOCK.results).flatMap((t, i) => [submitted(t, MOCK.results[t][0] - 2, MOCK.results[t][1], 20 - i), submitted(t, MOCK.results[t][0], MOCK.results[t][1], 10 - (i % 5))]),
};

// lesson pages: a test may set window.__MOCK_LESSONS = { IN3: {...lesson doc} } before the page loads; modules are served by id
for (const [id, l] of Object.entries((typeof window !== "undefined" && window.__MOCK_LESSONS) || {})) DOCS[`lessons/${id}`] = l;
for (const m of COLS.modules) DOCS[`modules/${m.id}`] = m;
for (const t of COLS.tests) DOCS[`tests/${t.id}`] = t;
// window.__MOCK_DOCS = { "path/id": {...} }: extra documents; a value { __ms: <epoch ms> } becomes a Timestamp
const revive = (v) => (v && typeof v === "object" && !Array.isArray(v) ? ("__ms" in v ? ts(v.__ms) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))) : Array.isArray(v) ? v.map(revive) : v);
for (const [k, v] of Object.entries(W.__MOCK_DOCS || {})) DOCS[k] = revive(v);

const snap = (id, data) => ({ id, exists: () => data != null, data: () => data });
const signedIn = !W.__MOCK_SIGNED_OUT;
export const auth = { currentUser: signedIn ? user : null, signOut: async () => {} };
export const db = {};
export const doc = (_db, ...p) => ({ path: p.join("/") });
export const collection = (_db, ...p) => ({ path: p.join("/") });
export const where = (field, op, value) => ({ field, op, value });
export const query = (c, ...w) => ({ path: c.path, where: w });
export const getDoc = async (r) => snap(r.path.split("/").pop(), DOCS[r.path] ?? null);
export const getDocs = async (q) => {
  const rows = (COLS[q.path] || []).filter((r) => (q.where || []).every((w) => r[w.field] === w.value));
  return { docs: rows.map((r) => snap(r.id, r)), size: rows.length, empty: !rows.length };
};
export const onAuthStateChanged = (_a, cb) => { setTimeout(() => cb(signedIn ? user : null), 0); return () => {}; };
export const getIdTokenResult = async () => ({ claims });
export const reload = async () => {};
export const signOut = async () => {};
export const updateDoc = async () => {};
export const setDoc = async () => {};
export const serverTimestamp = () => ts(Date.now());
export const call = (name) => async (data) => { (W.__mockCalls ||= []).push({ name, data: JSON.parse(JSON.stringify(data ?? null)) }); return { data: CALLS[name] ? CALLS[name](data || {}) : {} }; };
export const addDoc = async () => ({ id: "mockDoc" });
export const deleteDoc = async () => {};
export const deleteField = () => null;
export const collectionGroup = (_db, name) => ({ path: name });
export const orderBy = (f, dir) => ({ orderBy: f, dir });
export const limit = (n) => ({ limit: n });
export const getCountFromServer = async (q) => { const n = (await getDocs(q)).size; return { data: () => ({ count: n }) }; };
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });
export const onSnapshot = () => () => {};
export const Timestamp = { now: () => ts(Date.now()), fromDate: (d) => ts(d.getTime()), fromMillis: ts };
export const storage = {};
export const storageRef = (_s, p) => ({ path: p });
export const uploadBytes = async () => {};
export const getBlob = async () => new Blob();
export const sendPasswordResetEmail = async () => {};
export const sendEmailVerification = async () => {};
export const updateProfile = async () => {};
export const signInWithEmailAndPassword = async () => { throw Object.assign(new Error("mock"), { code: "auth/invalid-credential" }); };
export const createUserWithEmailAndPassword = async () => { throw Object.assign(new Error("mock"), { code: "auth/email-already-in-use" }); };

// Tests (test.html): a fixed 15-question quiz, graded here like functions/index.js does (one mark per correct answer).
// The question shapes are the server's (index, total, type, prompt, options, seconds); the keys are this mock's own.
export const QUIZ = Array.from({ length: 15 }, (_, i) => {
  const type = ["mcq", "order", "text", "predict"][i % 4];
  if (type === "mcq") return { type, prompt: `Mock question ${i + 1}: which command lists the running nodes?`, options: ["ros2 topic list", "ros2 node list", "ros2 run", "colcon build"], key: "ros2 node list" };
  if (type === "order") return { type, prompt: `Mock question ${i + 1}: put the steps in order.`, options: ["source install/setup.bash", "colcon build", "ros2 run pkg node"], key: ["colcon build", "source install/setup.bash", "ros2 run pkg node"] };
  return { type, prompt: `Mock question ${i + 1}: type the command that shows the ROS 2 distribution.`, code: type === "predict" ? "echo $ROS_DISTRO" : undefined, key: type === "predict" ? "jazzy" : "printenv ROS_DISTRO" };
});
const quizQ = (i) => { const q = QUIZ[i]; return { index: i, total: QUIZ.length, type: q.type, prompt: q.prompt, code: q.code, options: q.options, seconds: 120 }; };
const right = (q, a) => (Array.isArray(q.key) ? JSON.stringify(a) === JSON.stringify(q.key) : String(a ?? "").trim() === q.key);
const ATT = { answers: [] };
const CALLS = {
  startAttempt: () => { ATT.answers = []; return { attemptId: "att_mock", serverNow: Date.now(), deadline: Date.now() + 35 * 60000, question: quizQ(0) }; },
  submitAnswer: ({ index, answer }) => {
    ATT.answers[index] = answer;
    if (index + 1 < QUIZ.length) return { done: false, serverNow: Date.now(), deadline: Date.now() + 30 * 60000, question: quizQ(index + 1) };
    const score = QUIZ.reduce((s, q, i) => s + (right(q, ATT.answers[i]) ? 1 : 0), 0);
    return { done: true, score, maxScore: QUIZ.length };
  },
};
