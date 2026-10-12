// Test engine: builds a unique paper per student and grades answers.
// Pure functions (no database), so they can be unit-tested.
const crypto = require("node:crypto");
const { shuffle } = require("./questions/util");
const { TEMPLATES } = require("./questions");

const DEFAULT_SECONDS = { mcq: 75, predict: 90, fill: 120, order: 150 };

// Reproducible random numbers from a seed (stored privately with the attempt for audits).
function makeRng(seedHex) {
  let state = crypto.createHash("sha256").update(String(seedHex)).digest();
  let i = 0;
  return () => {
    if (i + 4 > state.length) { state = crypto.createHash("sha256").update(state).digest(); i = 0; }
    const v = state.readUInt32BE(i); i += 4;
    return v / 4294967296;
  };
}

function instantiate(tpl, r) {
  const q = tpl.make(r);
  const out = {
    templateId: tpl.id, topic: tpl.topic, type: tpl.type,
    prompt: q.prompt, code: q.code || null, explain: q.explain || "",
    seconds: q.seconds || DEFAULT_SECONDS[tpl.type], points: q.points || 1,
    options: null, correct: null, accept: null,
  };
  if (tpl.type === "mcq") {
    if (!q.options.includes(q.correct)) throw new Error(`${tpl.id}: correct option missing`);
    if (new Set(q.options).size !== q.options.length) throw new Error(`${tpl.id}: duplicate options`);
    out.options = shuffle(q.options, r);
    out.correct = q.correct;
  } else if (tpl.type === "order") {
    let opts = shuffle(q.items, r);
    for (let k = 0; k < 6 && opts.join("\n") === q.items.join("\n"); k++) opts = shuffle(q.items, r);
    out.options = opts;
    out.correct = q.items.join("\n");
  } else {
    out.correct = q.correct;
    out.accept = Array.from(new Set([q.correct, ...(q.accept || [])]));
  }
  return out;
}

// topics: [{ topic: "nav", count: 3 }, ...]
function buildPaper(topics, seedHex) {
  const r = makeRng(seedHex);
  const questions = [];
  for (const { topic, count } of topics) {
    const pool = TEMPLATES.filter((t) => t.topic === topic && !t.retired);
    if (pool.length < count) throw new Error(`Topic ${topic} has only ${pool.length} templates (needs ${count})`);
    for (const tpl of shuffle(pool, r).slice(0, count)) questions.push(instantiate(tpl, r));
  }
  return shuffle(questions, r);
}

// Normalise typed answers so harmless differences (spaces, curly quotes) don't matter.
function norm(s) {
  return String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .trim()
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+/g, " ")
    .replace(/;$/, "");
}

// Accept only well-formed answers; anything else becomes null (= unanswered).
function sanitizeAnswer(q, answer) {
  if (q.type === "mcq") return typeof answer === "string" && q.options.includes(answer) ? answer : null;
  if (q.type === "order") {
    if (!Array.isArray(answer) || answer.length !== q.options.length) return null;
    if (!answer.every((x) => typeof x === "string" && q.options.includes(x))) return null;
    if (new Set(answer).size !== answer.length) return null;
    return answer.join("\n");
  }
  if (typeof answer !== "string") return null;
  const t = answer.slice(0, 300);
  return t.trim() === "" ? null : t;
}

function isCorrect(q, given) {
  if (given == null) return false;
  if (q.type === "mcq" || q.type === "order") return given === q.correct;
  const g = norm(given);
  return (q.accept || [q.correct]).some((a) => norm(a) === g);
}

function computeScore(questions, answers) {
  let score = 0, max = 0;
  questions.forEach((q, i) => {
    max += q.points || 1;
    const a = answers[i];
    if (a && !a.late && isCorrect(q, a.given)) score += q.points || 1;
  });
  return { score, max };
}

// What the student's browser is allowed to see: never the answer.
function publicView(q, index, total, remaining) {
  return { index, total, type: q.type, prompt: q.prompt, code: q.code, options: q.options, seconds: q.seconds, remaining };
}

module.exports = { makeRng, buildPaper, instantiate, sanitizeAnswer, isCorrect, computeScore, publicView, norm, DEFAULT_SECONDS };
