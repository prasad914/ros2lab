#!/usr/bin/env node
// Static security checks for the ROS2Lab site. Run from the project folder:
//   node tools/security-check.mjs
// Exits with code 1 when a check fails. No network, no Firebase needed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const problems = [];
const fail = (msg) => problems.push(msg);
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) continue;
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};

// 1) Security headers and CSP
const fb = JSON.parse(read("firebase.json"));
const headers = Object.fromEntries(fb.hosting.headers.find((h) => h.source === "**").headers.map((h) => [h.key, h.value]));
const csp = headers["Content-Security-Policy"] || "";
if (/'unsafe-eval'/.test(csp)) fail("CSP allows 'unsafe-eval'");
for (const need of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "default-src 'self'", "script-src-attr 'none'"]) if (!csp.includes(need)) fail(`CSP lacks ${need}`);
if (/script-src[^;]*'unsafe-inline'/.test(csp)) fail("CSP script-src allows 'unsafe-inline'");
if (!/max-age=\d{8,}/.test(headers["Strict-Transport-Security"] || "")) fail("HSTS missing or short");
for (const k of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy"]) if (!headers[k]) fail(`header ${k} missing`);
if (!fb.hosting.ignore.includes("**/*.map")) fail("hosting.ignore must exclude **/*.map");

// 2) No source maps shipped
const pub = walk(join(root, "public"));
for (const f of pub) {
  if (f.endsWith(".map")) fail(`source map in public: ${relative(root, f)}`);
  if (/\.(m?js|css)$/.test(f) && /sourceMappingURL=/.test(readFileSync(f, "utf8"))) fail(`sourceMappingURL comment: ${relative(root, f)}`);
}

// 3) HTML sinks: only files whose HTML strings are fixed text or escaped (reviewed by hand).
const SINK = /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML\(|document\.write\(|\bnew Function\(|[^.\w]eval\(/;
const REVIEWED = new Set(["public/js/rviz.js", "public/js/vscode.js", "public/js/terminal-sim.js", "public/js/games/art.js", "public/js/puzzles.js", "public/js/lab.js"]);   // fixed SVG/HTML text or esc() only
for (const f of pub.filter((x) => /public\/js\/.*\.m?js$/.test(x) && !x.includes("/vendor/"))) {
  const rel = relative(root, f);
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (SINK.test(line) && !REVIEWED.has(rel)) fail(`HTML/eval sink ${rel}:${i + 1}`);
  });
}

// 4) Secrets: only the public Firebase web config key may appear in the website files.
const SECRET = /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|"private_key"|client_secret|sk_live_|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30}|xox[bp]-/;
for (const f of [...pub, ...walk(join(root, "functions")), ...walk(join(root, "tools"))].filter((x) => /\.(m?js|json|html|txt|md|py|h|cpp|ino)$/.test(x))) {
  if (f.endsWith("security-check.mjs") || f.includes("/public/vendor/")) continue;   // vendor bundles hold base64 WebAssembly
  const text = readFileSync(f, "utf8");
  if (SECRET.test(text)) fail(`possible secret in ${relative(root, f)}`);
  const keys = text.match(/AIza[0-9A-Za-z_-]{35}/g) || [];
  if (keys.length && !f.endsWith("firebase-config.js")) fail(`Google API key outside firebase-config.js: ${relative(root, f)}`);
}

// 5) Browser storage: no tokens, roles or personal data written by our code.
for (const f of pub.filter((x) => /public\/js\/.*\.js$/.test(x) && !x.includes("/vendor/"))) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (/(local|session)Storage\.setItem\([^)]*(token|role|admin|claim|email|password|uid\b)/i.test(line)) fail(`sensitive browser storage ${relative(root, f)}:${i + 1}`);
  });
}

// 6) Server: every callable goes through the guarded wrapper; nothing decodes tokens by hand; logs carry no emails.
const idx = read("functions/index.js");
if ((idx.match(/\bonCall\(/g) || []).length !== 1) fail("functions/index.js: callables must be created with callable(), not onCall()");
if (/jwt|jsonwebtoken|atob\(|split\("\."\)\[1\]/.test(idx)) fail("functions/index.js: manual token decoding");
if (/logger\.\w+\([^)]*(email|token|password)/i.test(idx)) fail("functions/index.js: logs may contain personal data or tokens");
if (/\bfetch\(|https?\.request\(|axios/.test(idx)) fail("functions/index.js: outbound request found: check it with isSafePublicUrl()");

// 7) Rules end with default deny
const rules = read("firestore.rules");
if (!/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/.test(rules)) fail("firestore.rules: default-deny rule missing");
for (const c of ["deletedAccounts", "presence", "visitorDays"]) if (!new RegExp(`match /${c}/\\{\\w+\\}\\s*\\{\\s*allow read: if isAdmin\\(\\);\\s*allow write: if false;`).test(rules)) fail(`firestore.rules: ${c} must be admin-read, server-write`);
if (!/match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;/.test(read("storage.rules"))) fail("storage.rules: default-deny rule missing");

if (problems.length) { console.error(`Security check: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`); process.exit(1); }
console.log("Security check: all static checks passed.");
