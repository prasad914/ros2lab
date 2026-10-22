// The public course plan and the certificate rule (docs/redesign, step 4). Plain Node, no browser:
//   node tests/course-plan.test.mjs
// 1. public/data/course-plan.json is current (tools/build-course-plan.mjs) and its numbers match content + config.
// 2. Certificate eligibility counts CORE_MODULES only: Weeks 7–9 (UR, XT, RV) are not required.
//    The three places that hold the list agree; the server's lessonStatus() and completionCheck() filter by it
//    (functions/index.js is not importable without Firebase, so those two are checked in the source);
//    and the same rule applied to the real content gives 95 required lessons and 6 required tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(root, f), "utf8");
const cfg = createRequire(import.meta.url)(path.join(root, "functions/config.js"));
const content = JSON.parse(read("content/course-content.json"));
const plan = JSON.parse(read("public/data/course-plan.json"));
let n = 0;
const ok = (m) => console.log(`  ok   ${m}`, n++);

assert.equal(spawnSync(process.execPath, [path.join(root, "tools/build-course-plan.mjs"), "--check"]).status, 0, "course-plan.json is out of date: node tools/build-course-plan.mjs");
ok("public/data/course-plan.json is current");

const CORE = ["W1", "W2", "IN", "W3", "PF", "NP"], OPTIONAL = ["UR", "XT", "RV"];
assert.deepEqual(cfg.CORE_MODULES, CORE); ok("functions/config.js CORE_MODULES = Weeks 1–6");
for (const f of ["public/js/course-data.js", "public/js/lesson.js"]) {
  const m = read(f).match(/const CORE_MODULES = (\[[^\]]*\])/);
  assert.deepEqual(JSON.parse(m[1]), CORE, f);
}
ok("course-data.js and lesson.js hold the same list");
assert.deepEqual(plan.rules.coreModules, CORE);
assert.deepEqual(plan.modules.filter((m) => m.core).map((m) => m.id), CORE);
assert.deepEqual(plan.modules.filter((m) => !m.core).map((m) => m.id), OPTIONAL);
ok("plan: Weeks 1–6 are core, UR, XT, RV are not");

// the server's rule, as source: both functions filter by cfg.CORE_MODULES
const idx = read("functions/index.js");
assert(/async function lessonStatus[\s\S]*?cfg\.CORE_MODULES[\s\S]*?core\.includes\(m\.id\)/.test(idx), "lessonStatus must filter modules by CORE_MODULES");
assert(/async function completionCheck[\s\S]*?cfg\.CORE_MODULES\.includes\(t\.data\(\)\.moduleId\)/.test(idx), "completionCheck must filter tests by CORE_MODULES");
ok("server lessonStatus() and completionCheck() filter by CORE_MODULES");

// the same filter applied to the real content
const required = content.modules.filter((m) => cfg.CORE_MODULES.includes(m.id));
const lessons = required.flatMap((m) => m.lessons.map((l) => l.id));
const tests = content.tests.filter((t) => cfg.CORE_MODULES.includes(t.moduleId));
const optional = content.modules.filter((m) => !cfg.CORE_MODULES.includes(m.id));
assert.equal(lessons.length, 95); assert.equal(tests.length, 6);
assert(optional.length === 3 && optional.every((m) => OPTIONAL.includes(m.id)));
for (const m of optional) { assert(!m.lessons.some((l) => lessons.includes(l.id))); }
assert(!content.tests.filter((t) => OPTIONAL.includes(t.moduleId)).some((t) => tests.includes(t)));
ok("required: 95 lessons and 6 tests; the 22 lessons and 3 tests of Weeks 7–9 are not required");
// a student who finished Weeks 1–6 only has every required lesson, with no Week 7–9 progress
const done = new Set(lessons);
assert(lessons.every((id) => done.has(id)) && !optional.flatMap((m) => m.lessons).some((l) => done.has(l.id)));
ok("finishing Weeks 1–6 alone satisfies the lesson rule");

// plan numbers vs content and config
for (const m of content.modules) {
  const p = plan.modules.find((x) => x.id === m.id);
  assert.equal(p.lessons.length, m.lessons.length, m.id);
  const t = content.tests.find((x) => x.moduleId === m.id);
  assert.equal(p.tests[0].questions, t.topics.reduce((s, x) => s + x.count, 0), `${m.id} questions`);
  assert.equal(p.tests[0].minutes, t.totalMinutes, `${m.id} minutes`);
}
assert.equal(plan.rules.certCourseTitle, cfg.CERT_COURSE_TITLE);
ok("plan lessons, questions and minutes match content; certificate title matches config");

// numbers written into the static pages
const courses = read("public/courses.html");
for (const s of [`<dd>${lessons.length}</dd>`, `<dd>${optional.reduce((a, m) => a + m.lessons.length, 0)}</dd>`, cfg.CERT_COURSE_TITLE, `${cfg.PASS_TEST_PERCENT}% to pass`, `${cfg.PASS_PROJECT_PERCENT}% to pass`, `valid ${cfg.CERT_VALID_YEARS} years`, `${cfg.ACCESS_DAYS} days`]) assert(courses.includes(s), `courses.html lacks "${s}"`);
ok("courses.html numbers match content and config");
console.log(`\nall ok (${n})`);
