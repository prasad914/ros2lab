// A student's course state, read the same way by the portal (course.js) and the plan pages (plan.js):
// modules and lessons, lesson progress, tests and best scores, attempts, project and certificate request.
import { db, collection, getDocs, getDoc, doc, query, where } from "./fb.js";

export const PASS_TEST = 60, PASS_PROJECT = 80;
// Weeks that count for lifetime access and the certificate. MUST match CORE_MODULES in
// functions/config.js. Weeks 7 to 9 (UR, XT, RV) are an optional introductory experience (no certificate). [] = every week counts.
export const CORE_MODULES = ["W1", "W2", "IN", "W3", "PF", "NP"];
export const isCore = (moduleId) => !CORE_MODULES.length || !moduleId || CORE_MODULES.includes(moduleId);
export const pctOf = (r) => (r && r.max ? Math.round((r.best / r.max) * 1000) / 10 : null);

export async function loadCourse({ user, profile, claims }) {
  const [modsSnap, progSnap, testsSnap, resSnap, attSnap, projSnap, reqSnap] = await Promise.all([
    getDocs(collection(db, "modules")),
    getDocs(collection(db, "progress", user.uid, "lessonProgress")),
    getDocs(query(collection(db, "tests"), where("published", "==", true))),
    getDocs(query(collection(db, "results"), where("uid", "==", user.uid))),
    getDocs(query(collection(db, "attempts"), where("uid", "==", user.uid))),
    getDoc(doc(db, "projects", user.uid)),
    getDoc(doc(db, "certRequests", user.uid)),
  ]);
  const mods = modsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  const prog = Object.fromEntries(progSnap.docs.map((d) => [d.id, d.data()]));
  const tests = testsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const results = Object.fromEntries(resSnap.docs.map((d) => [d.data().testId, d.data()]));
  const attempts = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const project = projSnap.exists() ? projSnap.data() : null;
  const request = reqSnap.exists() ? reqSnap.data() : null;
  const isDone = (l) => prog[l.id] && prog[l.id].status === "completed";

  const coreMods = mods.filter((m) => isCore(m.id));
  const allLessons = coreMods.flatMap((m) => m.lessons || []);            // core weeks only (what the certificate needs)
  const doneCount = allLessons.filter(isDone).length;
  const nextLesson = allLessons.find((l) => !isDone(l)) || mods.flatMap((m) => m.lessons || []).find((l) => !isDone(l));
  const modOf = Object.fromEntries(mods.map((m) => [m.id, m]));
  const testList = tests.slice().sort((a, b) => (modOf[a.moduleId] ? modOf[a.moduleId].order || 0 : 99) - (modOf[b.moduleId] ? modOf[b.moduleId].order || 0 : 99) || (a.order || 0) - (b.order || 0));
  const testRows = testList.filter((t) => isCore(t.moduleId) && (!t.openAt || t.openAt.toMillis() <= Date.now())).map((t) => ({ t, pct: pctOf(results[t.id]), ok: (pctOf(results[t.id]) ?? -1) >= PASS_TEST }));
  const testsPassed = testRows.filter((x) => x.ok).length;
  const lessonsOk = allLessons.length > 0 && doneCount >= allLessons.length;
  const testsOk = testRows.length > 0 && testsPassed === testRows.length;
  const lifetime = claims.lifetime === true || profile.lifetimeAccess === true;
  return { user, profile, claims, mods, coreMods, prog, tests: testList, results, attempts, project, request, allLessons, doneCount, nextLesson, testRows, testsPassed, lessonsOk, testsOk, lifetime, isDone };
}
