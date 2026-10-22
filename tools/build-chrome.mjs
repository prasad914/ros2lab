#!/usr/bin/env node
// The one site header and footer (design v3), stamped into every page in public/*.html.
// The site has no build step, so the header and footer are written into each HTML file between marker comments.
// They work before any JS runs (no flash, no layout shift). js/chrome.js adds the behaviour: burger menu, search,
// the signed-in state in #who, and --top-h.
//   node tools/build-chrome.mjs           rewrite the pages
//   node tools/build-chrome.mjs --check   exit 1 if any page is out of date (tests/chrome-sync.test.mjs)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");

// which header link is the current page
const SECTION = {
  "index.html": "home",
  "courses.html": "courses", "plan.html": "courses", "modelling.html": "courses",
  "rviz.html": "simulator", "robot.html": "simulator",
  "playground.html": "playground",
  "course.html": "portal", "lesson.html": "portal", "test.html": "portal", "project.html": "portal", "account.html": "portal",
};
const NAV = [
  ["home", "index.html", "Home"],
  ["courses", "courses.html", "Courses"],
  ["simulator", "rviz.html", "Simulator"],
  ["playground", "playground.html", "Playground"],
  ["portal", "course.html", "Student portal"],
  ["help", "index.html#faq", "Help"],
];
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">';
const OLD_FONTS = "family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Lexend:wght@500;600;700";

function header(file, base) {
  const cur = SECTION[file];
  const links = NAV.map(([id, href, text]) =>
    `      <li><a href="${base}${href}"${id === cur ? ' aria-current="page"' : ""}>${text}</a></li>`).join("\n");
  return `<!-- site-header: written by tools/build-chrome.mjs, edit it there -->
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
  <a class="brand" href="${base}index.html" aria-label="ROS2Lab home"><img src="${base}img/logo-axes.svg" alt="" width="34" height="34"><span><b>ROS2Lab</b><small>Robotics &amp; ROS 2 Lab</small></span></a>
  <nav id="nav" aria-label="Main">
    <ul>
${links}
      <li class="nav-reg"><a href="${base}register.html">Register free</a></li>
    </ul>
    <form class="search" role="search" action="${base}index.html">
      <input id="site-q" name="q" type="search" list="site-pages" placeholder="Search, e.g. Week 4" aria-label="Search the site" autocomplete="off">
      <button type="submit" aria-label="Search"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="2"/></svg></button>
      <datalist id="site-pages"></datalist>
    </form>
  </nav>
  <div class="top-right" id="who"><a class="login" href="${base}signin.html">Log in</a><a class="btn btn-main" href="${base}register.html">Register free</a></div>
  <button class="burger" type="button" aria-controls="nav" aria-expanded="false" aria-label="Menu"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" stroke-width="2"/></svg></button>
</div></header>
<!-- /site-header -->`;
}

function footer(base) {
  return `<!-- site-footer: written by tools/build-chrome.mjs, edit it there -->
<footer class="site-foot"><div class="wrap">
  <div><h2 class="fh">ROS2Lab · Robotics &amp; ROS 2 Lab</h2><p>Online robotics courses for beginners, with a terminal, simulator and RViz in the browser.</p>
    <a class="chan" id="yt-foot" href="https://youtu.be/-tL0dp7Kloc" target="_blank" rel="noopener"><img src="${base}img/logo-axes.svg" alt="" width="28" height="28" loading="lazy">From the Robotics &amp; ROS 2 Lab YouTube channel</a></div>
  <div><h2 class="fh">Courses</h2><a href="${base}courses.html">All courses</a><a href="${base}plan.html">Certificate course</a><a href="${base}modelling.html">Robot modelling &amp; RViz</a></div>
  <div><h2 class="fh">Students</h2><a href="${base}course.html">Student portal</a><a href="${base}rviz.html">Simulator</a><a href="${base}playground.html">Playground</a><a href="${base}certificate.html">Verify a certificate</a></div>
  <div><h2 class="fh">About</h2><a href="${base}index.html#channel">About ROS2Lab</a><a href="${base}index.html#faq">Help</a><a href="${base}terms.html">Terms of Use</a><a href="${base}privacy.html">Privacy notice</a></div>
  <div class="bottom"><span>© 2026 Robotics &amp; ROS 2 Lab</span><span>ROS 2 Jazzy · Gazebo Harmonic</span></div>
</div></footer>
<!-- /site-footer -->`;
}

const between = (a, b) => new RegExp(`${a}[\\s\\S]*?${b}`);
const HEAD_RE = between("<!-- site-header", "<!-- /site-header -->");
const FOOT_RE = between("<!-- site-footer", "<!-- /site-footer -->");

export function stamp(file, html) {
  const base = file === "404.html" ? "/" : "";   // 404.html is served at any path
  let s = html;
  // fonts: Source Sans 3 + Source Code Pro replace Atkinson Hyperlegible, JetBrains Mono and Lexend
  s = s.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Atkinson[^"]*" rel="stylesheet">/, (m) => {
    const rest = m.slice(m.indexOf(OLD_FONTS) + OLD_FONTS.length).replace(/" rel="stylesheet">$/, "");
    return rest.startsWith("&family=")
      ? `${FONTS}\n<link href="https://fonts.googleapis.com/css2?${rest.slice(1)}" rel="stylesheet">`
      : FONTS;
  });
  if (!s.includes("family=Source+Sans+3")) s = s.replace(/(<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>)/, `$1\n${FONTS}`);
  // theme.css after every other stylesheet in <head>
  if (!s.includes("css/theme.css")) {
    const head = s.slice(0, s.indexOf("</head>"));
    const last = Math.max(head.lastIndexOf('<link rel="stylesheet"'), head.lastIndexOf("<link href=\"https://fonts.googleapis.com"));
    const end = s.indexOf(">", last) + 1;
    s = `${s.slice(0, end)}\n<link rel="stylesheet" href="${base}css/theme.css">${s.slice(end)}`;
  }
  // header: replace the stamped one, or the page's old <header class="top">, or certificate.html's brand bar
  const h = header(file, base);
  if (HEAD_RE.test(s)) s = s.replace(HEAD_RE, h);
  else if (/<header class="top">[\s\S]*?<\/header>/.test(s)) s = s.replace(/<header class="top">[\s\S]*?<\/header>/, h);
  else s = s.replace(/(<body[^>]*>)\n?/, `$1\n${h}\n`);
  // <main id="main"> (the skip link's target)
  s = s.replace(/<main(?![^>]*\bid=)([^>]*)>/, '<main id="main"$1>');
  // footer: replace the stamped one or the page's old footer; pages without one get it after </main>
  const f = footer(base);
  if (FOOT_RE.test(s)) s = s.replace(FOOT_RE, f);
  else if (/<footer class="site-foot">[\s\S]*?<\/footer>/.test(s)) s = s.replace(/<footer class="site-foot">[\s\S]*?<\/footer>/, f);
  else s = s.replace(/<\/main>\n?/, `</main>\n${f}\n`);
  // behaviour: js/chrome.js replaces js/who.js
  s = s.replace(/<script type="module" src="\/?js\/who\.js"><\/script>\n?/, "");
  if (!s.includes("js/chrome.js")) s = s.replace(/<\/body>/, `<script type="module" src="${base}js/chrome.js"></script>\n</body>`);
  return s;
}

export const pages = () => readdirSync(pub).filter((f) => f.endsWith(".html")).sort();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const stale = [];
  for (const file of pages()) {
    const p = path.join(pub, file), old = readFileSync(p, "utf8"), next = stamp(file, old);
    if (next !== old) { stale.push(file); if (!check) writeFileSync(p, next); }
  }
  if (check) {
    if (stale.length) { console.error(`Header/footer out of date in: ${stale.join(", ")}. Run: node tools/build-chrome.mjs`); process.exit(1); }
    console.log(`chrome ok: ${pages().length} pages`);
  } else console.log(stale.length ? `stamped: ${stale.join(", ")}` : "all pages up to date");
}
