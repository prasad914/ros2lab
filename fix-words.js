// fix-words.js
// Converts "words" block items from [word, meaning] arrays to {w, m} objects
// (Firestore cannot store arrays inside arrays) and updates lesson-render.js
// so it displays both the old and the new form.
// Run from the project folder:   node fix-words.js

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const jsonPath = path.join(root, "content", "course-content.json");
const jsPath = path.join(root, "public", "js", "lesson-render.js");

for (const p of [jsonPath, jsPath]) {
  if (!fs.existsSync(p)) {
    console.error("Not found: " + p + "\nRun this from C:\\ros2lab-course");
    process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");

// ---------- 1. Convert the course content ----------
const raw = fs.readFileSync(jsonPath, "utf8");
const hadBom = raw.charCodeAt(0) === 0xfeff;
const course = JSON.parse(hadBom ? raw.slice(1) : raw);

const notWords = [];
let blocksConverted = 0;
let pairsConverted = 0;

(course.modules || []).forEach((m, mi) =>
  (m.lessons || []).forEach((l, li) =>
    (l.blocks || []).forEach((b, bi) => {
      if (!Array.isArray(b.items) || !b.items.some(Array.isArray)) return;
      const where = `modules[${mi}].lessons[${li}].blocks[${bi}]`;
      if (b.t !== "words") { notWords.push(`${where} (type "${b.t}")`); return; }
      b.items = b.items.map((it) => {
        if (!Array.isArray(it)) return it;
        if (it.length !== 2) console.warn(`Warning: ${where} has a row with ${it.length} values; keeping the first two.`);
        pairsConverted++;
        return { w: String(it[0]), m: String(it[1]) };
      });
      blocksConverted++;
    })));

if (notWords.length) {
  console.error("Nested arrays found in blocks that are not \"words\" blocks. Nothing was changed:");
  notWords.forEach((w) => console.error("  " + w));
  process.exit(1);
}

// Final safety scan: no array may remain directly inside another array
const left = [];
(function scan(v, p) {
  if (Array.isArray(v)) v.forEach((x, i) => { if (Array.isArray(x)) left.push(`${p}[${i}]`); scan(x, `${p}[${i}]`); });
  else if (v && typeof v === "object") for (const k of Object.keys(v)) scan(v[k], `${p}.${k}`);
})(course, "root");
if (left.length) {
  console.error("Nested arrays still present. Nothing was changed:");
  left.forEach((w) => console.error("  " + w));
  process.exit(1);
}

// ---------- 2. Update the lesson renderer ----------
let js = fs.readFileSync(jsPath, "utf8");
const oldStr = '.map(([w, m]) => el("li", {}, el("strong", { text: w }), ": ", rich(m)))';
const newStr = '.map((it) => { const [w, m] = Array.isArray(it) ? it : [it.w, it.m]; return el("li", {}, el("strong", { text: w }), ": ", rich(m)); })';

let jsChanged = false;
if (js.includes(newStr)) {
  console.log("lesson-render.js: already updated, skipped.");
} else {
  const count = js.split(oldStr).length - 1;
  if (count !== 1) {
    console.error(`lesson-render.js: expected the "words" line once, found it ${count} times. Nothing was changed.`);
    process.exit(1);
  }
  js = js.replace(oldStr, newStr);
  jsChanged = true;
}

// ---------- 3. Back up and write ----------
if (blocksConverted) {
  fs.copyFileSync(jsonPath, `${jsonPath}.${stamp}.bak`);
  fs.writeFileSync(jsonPath, (hadBom ? "\ufeff" : "") + JSON.stringify(course, null, 2) + "\n", "utf8");
}
if (jsChanged) {
  fs.copyFileSync(jsPath, `${jsPath}.${stamp}.bak`);
  fs.writeFileSync(jsPath, js, "utf8");
}

console.log(`course-content.json: ${blocksConverted} "words" blocks, ${pairsConverted} pairs converted.`);
if (jsChanged) console.log("lesson-render.js: updated.");
if (blocksConverted || jsChanged) console.log(`Backups saved with the suffix .${stamp}.bak`);
console.log("Done. Next: firebase deploy --only hosting, then upload course-content.json again.");
