// Every page carries the current shared header and footer (tools/build-chrome.mjs), with the hooks JS and tests read.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stamp, pages } from "../tools/build-chrome.mjs";

const pub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
for (const file of pages()) {
  const html = readFileSync(path.join(pub, file), "utf8");
  assert.equal(stamp(file, html), html, `${file}: header/footer out of date; run node tools/build-chrome.mjs`);
  const body = html.slice(html.indexOf("<body"));
  assert.match(body, /^<body[^>]*>\n<!-- site-header[^\n]*\n<a class="skip" href="#main">/, `${file}: skip link first`);
  assert.equal((html.match(/<header class="top">/g) || []).length, 1, `${file}: one header.top`);
  assert.equal((html.match(/<main id="main"/g) || []).length, 1, `${file}: one main#main`);
  assert.equal((html.match(/id="who"/g) || []).length, 1, `${file}: one #who`);
  assert.equal((html.match(/<footer class="site-foot">/g) || []).length, 1, `${file}: one footer`);
  assert.match(html, /js\/chrome\.js/, `${file}: loads js/chrome.js`);
  assert.doesNotMatch(html, /js\/who\.js/, `${file}: who.js is gone`);
}
console.log(`chrome-sync: ${pages().length} pages ok`);
