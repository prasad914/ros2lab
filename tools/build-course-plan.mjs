#!/usr/bin/env node
// The public course plan: week, day and lesson titles, the tests' sizes, and the course rules, for courses.html,
// plan.html and modelling.html (pages anyone can open, before logging in).
// Lesson bodies, summaries and test questions stay in Firestore (login required); only the outline is written here.
// Sources: content/course-content.json (weeks, lessons, tests), functions/config.js (rules, certificate title) and
// functions/projects.js (the project's marking scheme, deliverables and number of project types).
//   node tools/build-course-plan.mjs           write public/data/course-plan.json
//   node tools/build-course-plan.mjs --check   exit 1 if the file is out of date (tests/course-plan.test.mjs)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "data", "course-plan.json");

export function buildPlan() {
  const content = JSON.parse(readFileSync(path.join(root, "content", "course-content.json"), "utf8"));
  const req = createRequire(import.meta.url);
  const cfg = req(path.join(root, "functions", "config.js"));
  const proj = req(path.join(root, "functions", "projects.js"));
  const core = cfg.CORE_MODULES || [];
  const tests = content.tests || [];
  return {
    note: "Written by tools/build-course-plan.mjs from content/course-content.json and functions/config.js. Do not edit.",
    rules: {
      coreModules: core, passTestPercent: cfg.PASS_TEST_PERCENT, passProjectPercent: cfg.PASS_PROJECT_PERCENT,
      projectMaxAttempts: cfg.PROJECT_MAX_ATTEMPTS, certValidYears: cfg.CERT_VALID_YEARS, certCourseTitle: cfg.CERT_COURSE_TITLE,
      accessDays: cfg.ACCESS_DAYS, maxExtensionDays: cfg.MAX_EXTENSION_DAYS, maxReregistrations: cfg.MAX_REREGISTRATIONS,
    },
    project: {
      rubric: proj.RUBRIC.map(({ id, label, max }) => ({ id, label, max })), deliverables: proj.DELIVERABLES, types: proj.TEMPLATES.length,
    },
    modules: content.modules.map((m, i) => ({
      id: m.id, order: m.order ?? i + 1, week: Number(String(m.short || "").replace(/\D/g, "")) || i + 1,
      title: m.title, description: m.description || "", core: !core.length || core.includes(m.id),
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, day: l.day || null, dayTitle: l.dayTitle || "", minutes: l.minutes || 15 })),
      tests: tests.filter((t) => t.moduleId === m.id).map((t) => ({
        id: t.id, title: t.title, questions: (t.topics || []).reduce((s, x) => s + (x.count || 0), 0),
        minutes: t.totalMinutes || 30, maxAttempts: t.maxAttempts || 2,   // the fallbacks admin.js uses on upload
      })),
    })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = `${JSON.stringify(buildPlan(), null, 1)}\n`;
  const old = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (process.argv.includes("--check")) {
    if (next !== old) { console.error("public/data/course-plan.json is out of date. Run: node tools/build-course-plan.mjs"); process.exit(1); }
    console.log("course plan ok");
  } else {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, next);
    console.log(next === old ? "course plan up to date" : "wrote public/data/course-plan.json");
  }
}
