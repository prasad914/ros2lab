// Checks every question template and the grading logic. Run: npm test (inside functions/)
const assert = require("node:assert");
const crypto = require("node:crypto");
const engine = require("../engine");
const { TEMPLATES } = require("../questions");

let checked = 0;
for (const tpl of TEMPLATES) {
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const r = engine.makeRng(`${tpl.id}-${i}`);
    const q = engine.instantiate(tpl, r);
    assert(q.prompt && q.prompt.length > 10, `${tpl.id}: empty prompt`);
    assert(q.explain && q.explain.length > 10, `${tpl.id}: missing explanation`);
    if (q.type === "mcq") {
      assert.strictEqual(q.options.length, 4, `${tpl.id}: needs 4 options`);
      assert(q.options.includes(q.correct), `${tpl.id}: correct not in options`);
      assert.strictEqual(new Set(q.options).size, 4, `${tpl.id}: duplicate options`);
    }
    if (q.type === "order") {
      assert(q.options.length >= 3, `${tpl.id}: order needs 3+ items`);
      assert.strictEqual(new Set(q.options).size, q.options.length, `${tpl.id}: duplicate order items`);
      assert.notStrictEqual(q.options.join("\n"), q.correct, `${tpl.id}: order shown already solved`);
    }
    // correct answer must be graded correct; obviously wrong must be graded wrong
    const right = q.type === "order" ? q.correct.split("\n") : q.correct;
    assert(engine.isCorrect(q, engine.sanitizeAnswer(q, right)), `${tpl.id}: correct answer graded wrong: ${q.correct}`);
    const wrong = q.type === "mcq" ? q.options.find((o) => o !== q.correct) : q.type === "order" ? q.options : "zzz wrong";
    assert(!engine.isCorrect(q, engine.sanitizeAnswer(q, wrong)), `${tpl.id}: wrong answer graded correct`);
    seen.add(q.prompt + "|" + (q.code || "") + "|" + (q.options || []).join(","));
    checked++;
  }
  if (seen.size < 3) console.log(`  note: ${tpl.id} has only ${seen.size} distinct versions`);
}
console.log(`Templates: ${TEMPLATES.length}, instances checked: ${checked}`);

// Papers for 200 students: all different, and little overlap between any two students
const TESTS = {
  W1: [{ topic: "nav", count: 3 }, { topic: "files", count: 3 }, { topic: "perm", count: 2 }, { topic: "apt", count: 1 },
       { topic: "py1", count: 2 }, { topic: "py2", count: 2 }, { topic: "py3", count: 2 }],
  W2: [{ topic: "oop1", count: 3 }, { topic: "oop2", count: 3 }, { topic: "rosread", count: 2 }, { topic: "cpp", count: 3 },
       { topic: "env", count: 2 }, { topic: "lab", count: 2 }],
  W3: [{ topic: "graph", count: 5 }, { topic: "comm", count: 5 }, { topic: "tools", count: 5 }],
  IN: [{ topic: "platform", count: 4 }, { topic: "history", count: 4 }, { topic: "r1r2", count: 3 }, { topic: "dds", count: 4 }],
  PF: [{ topic: "pkg", count: 3 }, { topic: "pubsub", count: 3 }, { topic: "iface", count: 3 }, { topic: "srvact", count: 4 }, { topic: "paramlaunch", count: 3 }],
  NP: [{ topic: "n6time", count: 4 }, { topic: "n6loop", count: 6 }, { topic: "n6struct", count: 6 }],
  UR: [{ topic: "u7link", count: 6 }, { topic: "u7joint", count: 5 }, { topic: "u7inertia", count: 4 }],
  XT: [{ topic: "x8xacro", count: 5 }, { topic: "x8tf", count: 5 }, { topic: "x8launch", count: 5 }],
  RV: [{ topic: "r9rviz", count: 5 }, { topic: "r9marker", count: 6 }, { topic: "r9imarker", count: 4 }],
};
for (const [name, topics] of Object.entries(TESTS)) {
  const papers = Array.from({ length: 200 }, () => engine.buildPaper(topics, crypto.randomBytes(16).toString("hex")));
  const sig = (q) => q.prompt + "|" + (q.code || "") + "|" + (q.options || []).join(",");
  const distinct = new Set(papers.map((p) => p.map(sig).join("#"))).size;
  let totalSame = 0, pairs = 0, maxSame = 0;
  for (let i = 0; i < papers.length; i++) for (let j = i + 1; j < papers.length; j++) {
    const a = new Set(papers[i].map(sig));
    const same = papers[j].filter((q) => a.has(sig(q))).length;
    totalSame += same; pairs++; maxSame = Math.max(maxSame, same);
  }
  // grading: all-correct = full marks, all-blank = 0, late answers score 0
  const p = papers[0];
  const allRight = p.map((q) => ({ given: engine.sanitizeAnswer(q, q.type === "order" ? q.correct.split("\n") : q.correct), late: false }));
  assert.deepStrictEqual(engine.computeScore(p, allRight), { score: p.length, max: p.length });
  assert.strictEqual(engine.computeScore(p, p.map(() => null)).score, 0);
  assert.strictEqual(engine.computeScore(p, allRight.map((a) => ({ ...a, late: true }))).score, 0);
  console.log(`Test ${name}: ${papers[0].length} questions, ${distinct}/200 papers different, ` +
    `identical questions shared by two students: average ${(totalSame / pairs).toFixed(2)}, worst ${maxSame}`);
}

// Typing tolerance checks
const q = { type: "fill", accept: ["printenv | grep ROS"], correct: "printenv | grep ROS" };
assert(engine.isCorrect(q, "  printenv|grep   ROS "));
assert(!engine.isCorrect(q, "printenv | grep ros"));
assert.strictEqual(engine.sanitizeAnswer({ type: "mcq", options: ["a", "b"] }, "c"), null);
// ---------- Final projects: every brief is complete, and briefs differ between students ----------
{
  const projects = require("../projects");
  const briefs = new Set();
  for (let i = 0; i < 3000; i++) {
    const p = projects.buildProject(`student-${i}`);
    assert(p.title && p.summary && p.requirements.length >= 5, `project ${p.templateId}: incomplete brief`);
    assert(p.requirements.every((x) => typeof x === "string" && x.length > 20 && !/undefined|NaN/.test(x)), `project ${p.templateId}: bad requirement`);
    assert.strictEqual(p.rubric.reduce((s, c) => s + c.max, 0), 100, "rubric must total 100");
    briefs.add(JSON.stringify(p.requirements));
  }
  assert(briefs.size > 2500, `projects too similar: only ${briefs.size} different briefs in 3000`);
  console.log(`Projects: ${projects.TEMPLATES.length} templates, ${briefs.size} different briefs for 3000 students`);
}
// ---------- Security helpers and callable guards (separate process: it loads index.js) ----------
{
  const { spawnSync } = require("node:child_process");
  const r = spawnSync(process.execPath, [require("node:path").join(__dirname, "security-tests.js")], { stdio: "inherit", timeout: 120000 });
  assert.strictEqual(r.status, 0, "security tests failed");
}
console.log("All checks passed.");

