// A practice copy of Visual Studio Code (Dark Modern look): Explorer, tabs, editor, panel with a terminal, status bar.
// It edits files in the simulated workspace through a small file-system adapter, so the terminal sees every change.
import { el } from "./dom.js";

let cmPromise = null;
const loadCM = () => (cmPromise ||= import("../vendor/codemirror/codemirror.js"));
let cssDone = false;
function loadCss() {
  if (cssDone) return; cssDone = true;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = new URL("../css/vscode.css", import.meta.url).href; document.head.append(l);
}

// ---------- icons (simple line drawings in the style of VS Code's codicons) ----------
const SVG = "http://www.w3.org/2000/svg";
function icon(body, size = 24, vb = 24) {
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", `0 0 ${vb} ${vb}`); s.setAttribute("width", size); s.setAttribute("height", size); s.setAttribute("aria-hidden", "true");
  s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", vb === 24 ? "1.5" : "1.1"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("stroke-linecap", "round");
  s.innerHTML = body; return s;
}
const I = {
  files: '<path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5V7"/><path d="M9 7h6l4 4v9.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 8 20.5V8.5A1.5 1.5 0 0 1 9.5 7z"/><path d="M15 7v4h4"/>',
  search: '<circle cx="14" cy="10" r="5.5"/><path d="M10 14l-6 6"/>',
  search16: '<circle cx="9.5" cy="6.5" r="4"/><path d="M6.6 9.4L2.5 13.5"/>',
  scm: '<circle cx="7" cy="5" r="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 7v10M17 10c0 4-10 3-10 7"/>',
  debug: '<path d="M8 5l12 7-12 7z"/><circle cx="6" cy="17" r="3"/><path d="M6 14v-1M3.5 17h-1M6 20v1"/>',
  ext: '<rect x="3" y="11" width="6" height="6"/><rect x="9" y="11" width="6" height="6"/><rect x="3" y="17" width="6" height="0.01"/><rect x="9" y="5" width="6" height="6"/><rect x="15.5" y="3.5" width="5.5" height="5.5" transform="rotate(10 18 6)"/><path d="M3 17v4h12v-4"/>',
  account: '<circle cx="12" cy="9" r="4"/><path d="M4.5 20c1.5-3.5 4.5-5 7.5-5s6 1.5 7.5 5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  newFile: '<path d="M9.5 2.5H4.5v11h7V5z"/><path d="M9.5 2.5V5h2"/><path d="M12.5 10v4M10.5 12h4"/>',
  newFolder: '<path d="M1.5 4h4l1 1h6v3"/><path d="M1.5 4v8h7"/><path d="M12.5 10v4M10.5 12h4"/>',
  refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.5"/><path d="M12 1.8V4.8H9"/>',
  collapse: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M5.5 8h5"/>',
  chevR: '<path d="M6 4l4 4-4 4"/>',
  chevD: '<path d="M4 6l4 4 4-4"/>',
  more: '<circle cx="3.5" cy="8" r=".6"/><circle cx="8" cy="8" r=".6"/><circle cx="12.5" cy="8" r=".6"/>',
  run: '<path d="M4.5 2.5l9 5.5-9 5.5z"/>',
  split: '<rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M8 2.5v11"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  trash: '<path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
  max: '<path d="M4 10l4-4 4 4"/>',
  bell: '<path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z"/><path d="M6.5 14a1.5 1.5 0 0 0 3 0"/>',
  remote: '<path d="M2 6l3 3-3 3M14 4l-3 3 3 3"/>',
  err: '<circle cx="8" cy="8" r="5.5"/><path d="M6 6l4 4M10 6l-4 4"/>',
  warn: '<path d="M8 2.5l6 11H2z"/><path d="M8 7v3M8 11.8v.2"/>',
  layoutSide: '<rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M5.5 2.5v11"/>',
  layoutPanel: '<rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M1.5 9.5h13"/>',
};
const ic16 = (k) => icon(I[k], 16, 16);

// file icon colours (Seti theme, as VS Code ships it)
function fileBadge(name) {
  const n = name.toLowerCase(), ext = n.includes(".") ? n.split(".").pop() : "";
  const b = (t, c) => el("span", { class: "vsc-fi", style: { color: c }, text: t });
  if (n === "cmakelists.txt") return b("▲", "#6d8086");
  if (n === "package.xml") return b("</>", "#e37933");
  if (n === "license" || n === "license.txt") return b("⚖", "#cbcb41");
  if (n === "setup.cfg") return b("⚙", "#6d8086");
  if (n.endsWith(".launch.py") || ext === "py") return b("py", "#519aba");
  if (n.endsWith(".launch.xml") || ["xml", "urdf", "xacro", "sdf", "world", "rviz"].includes(ext)) return b("</>", ext === "rviz" ? "#a074c4" : "#e37933");
  if (["yaml", "yml"].includes(ext)) return b("!", "#a074c4");
  if (ext === "json") return b("{}", "#cbcb41");
  if (["cpp", "cc", "cxx"].includes(ext)) return b("C++", "#519aba");
  if (["hpp", "h"].includes(ext)) return b("h", "#a074c4");
  if (ext === "md") return b("M↓", "#519aba");
  if (["msg", "srv", "action"].includes(ext)) return b("≡", "#8dc149");
  if (["stl", "dae", "obj", "png", "jpg"].includes(ext)) return b("◆", "#a074c4");
  if (ext === "sh" || ext === "bash") return b("$", "#8dc149");
  return b("≡", "#6d8086");
}
function langOf(name) {
  const n = name.toLowerCase(), ext = n.includes(".") ? n.split(".").pop() : "";
  if (ext === "py") return { id: "python", label: "Python" };
  if (["xml", "urdf", "xacro", "sdf", "world", "launch"].includes(ext)) return { id: "xml", label: "XML" };
  if (["yaml", "yml", "rviz"].includes(ext)) return { id: "yaml", label: "YAML" };
  if (ext === "json") return { id: "json", label: "JSON" };
  if (["cpp", "cc", "cxx", "hpp", "h", "c"].includes(ext)) return { id: "cpp", label: "C++" };
  if (n === "cmakelists.txt") return { id: "cmake", label: "CMake" };
  if (ext === "md") return { id: "md", label: "Markdown" };
  if (["sh", "bash"].includes(ext) || n === ".bashrc") return { id: "sh", label: "Shell Script" };
  if (["msg", "srv", "action"].includes(ext)) return { id: "msg", label: "ROS Interface" };
  return { id: "text", label: "Plain Text" };
}
const parentOf = (p) => (p === "/" ? "/" : p.replace(/\/[^/]+$/, "") || "/");
const baseName = (p) => p.split("/").filter(Boolean).pop() || "/";

// ---------- quick problems: things beginners trip over, checked as you type ----------
function findProblems(text, lang) {
  const out = [];
  if (lang === "python") {
    const lines = text.split("\n"), stack = [];
    let pos = 0, inStr = null, triple = false;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (/^\t+/.test(line) && lines.some((x) => /^ +\S/.test(x))) out.push({ line: li, sev: "error", msg: "Inconsistent use of tabs and spaces in indentation (Pylance)" });
      const kw = line.match(/^\s*(def|class|if|elif|else|for|while|try|except|finally|with)\b(.*)$/);
      if (kw && !inStr && stack.length === 0) {
        const rest = line.replace(/#.*$/, "").trimEnd();
        if (!rest.endsWith(":") && !rest.endsWith("\\") && !/[([{,]$/.test(rest)) out.push({ line: li, sev: "error", msg: `Expected ":" (Pylance)` });
      }
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
          if (c === "\\") { i++; continue; }
          if (triple ? line.startsWith(inStr.repeat(3), i) : c === inStr) { if (triple) i += 2; inStr = null; triple = false; }
          continue;
        }
        if (c === "#") break;
        if (c === '"' || c === "'") { if (line.startsWith(c.repeat(3), i)) { inStr = c; triple = true; i += 2; } else inStr = c; continue; }
        if ("([{".includes(c)) stack.push({ c, line: li });
        else if (")]}".includes(c)) {
          const top = stack.pop();
          if (!top || "([{".indexOf(top.c) !== ")]}".indexOf(c)) { out.push({ line: li, sev: "error", msg: `"${c}" was not opened (Pylance)` }); if (top) stack.push(top); }
        }
      }
      if (inStr && !triple) { out.push({ line: li, sev: "error", msg: "String literal is unterminated (Pylance)" }); inStr = null; }
      pos += line.length + 1;
    }
    for (const s of stack) out.push({ line: s.line, sev: "error", msg: `"${s.c}" was not closed (Pylance)` });
    if (/^\s*import rclpy|^\s*from rclpy/m.test(text) === false && /\brclpy\./.test(text)) out.push({ line: text.split("\n").findIndex((l) => /\brclpy\./.test(l)), sev: "warning", msg: '"rclpy" is not defined (Pylance)' });
  } else if (lang === "xml" && text.trim()) {
    try {
      const doc = new DOMParser().parseFromString(text, "application/xml");
      const pe = doc.querySelector("parsererror");
      if (pe) { const m = pe.textContent.match(/line (\d+)/i); out.push({ line: m ? Math.max(0, Number(m[1]) - 1) : 0, sev: "error", msg: (pe.textContent.split("\n").find((x) => /error/i.test(x)) || "XML is not well-formed").trim().slice(0, 160) + " (XML)" }); }
    } catch { /* ignore */ }
  }
  return out;
}

// ---------- the editor theme: VS Code "Dark Modern" ----------
function makeTheme(cm) {
  const { EditorView, HighlightStyle, syntaxHighlighting, tags: t } = cm;
  const theme = EditorView.theme({
    "&": { color: "#CCCCCC", backgroundColor: "#1F1F1F", height: "100%", fontSize: "14px" },
    ".cm-scroller": { fontFamily: "Consolas, 'Droid Sans Mono', 'DejaVu Sans Mono', 'Ubuntu Mono', monospace", lineHeight: "19px" },
    ".cm-content": { caretColor: "#AEAFAD", padding: "0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#AEAFAD", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "#264F78 !important" },
    ".cm-activeLine": { backgroundColor: "transparent", boxShadow: "inset 0 0 0 2px #282828" },
    ".cm-gutters": { backgroundColor: "#1F1F1F", color: "#6E7681", border: "none" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#CCCCCC" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 18px", minWidth: "42px" },
    ".cm-foldGutter .cm-gutterElement": { color: "#C5C5C5", padding: "0 4px" },
    ".cm-matchingBracket": { backgroundColor: "rgba(0,100,0,.1)", outline: "1px solid #888" },
    ".cm-selectionMatch": { backgroundColor: "rgba(173,214,255,.15)" },
    ".cm-searchMatch": { backgroundColor: "rgba(234,92,0,.33)" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#9E6A03" },
    ".cm-tooltip": { backgroundColor: "#202020", color: "#CCCCCC", border: "1px solid #454545" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#04395E", color: "#FFFFFF" },
    ".cm-panels": { backgroundColor: "#202020", color: "#CCCCCC" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid #2B2B2B" },
    ".cm-panel input, .cm-panel button": { backgroundColor: "#313131", color: "#CCCCCC", border: "1px solid #3C3C3C" },
    ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy #F14C4C", textUnderlineOffset: "3px" },
    ".cm-lintRange-warning": { backgroundImage: "none", textDecoration: "underline wavy #CCA700", textUnderlineOffset: "3px" },
    ".cm-gutter-lint": { width: "8px" },
  }, { dark: true });
  const hl = HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "#C586C0" },
    { tag: [t.definitionKeyword, t.self, t.bool, t.null, t.atom], color: "#569CD6" },
    { tag: [t.function(t.variableName), t.function(t.definition(t.variableName)), t.function(t.propertyName)], color: "#DCDCAA" },
    { tag: [t.className, t.definition(t.className), t.typeName, t.namespace], color: "#4EC9B0" },
    { tag: [t.string, t.special(t.string), t.attributeValue], color: "#CE9178" },
    { tag: [t.number, t.integer, t.float], color: "#B5CEA8" },
    { tag: [t.comment, t.lineComment, t.blockComment], color: "#6A9955" },
    { tag: [t.variableName, t.propertyName, t.attributeName, t.labelName], color: "#9CDCFE" },
    { tag: [t.tagName, t.angleBracket], color: "#569CD6" },
    { tag: [t.operator, t.punctuation, t.separator], color: "#D4D4D4" },
    { tag: [t.meta, t.processingInstruction, t.documentMeta], color: "#C586C0" },
    { tag: t.escape, color: "#D7BA7D" },
    { tag: t.heading, color: "#569CD6", fontWeight: "bold" },
    { tag: t.invalid, color: "#F44747" },
  ]);
  return [theme, syntaxHighlighting(hl)];
}

/**
 * createVsCode(host, opts)
 * opts.fs:      { list(dir) -> [{name, dir}], read(p) -> string|null, write(p, text) -> null | "error", mkdir(p), remove(p), rename(a, b), isDir(p), isFile(p) }
 * opts.root:    folder shown in the Explorer, e.g. /home/student/ros2_ws
 * opts.open:    files to open at start
 * opts.terminal: element to show in the TERMINAL panel (optional)
 * opts.onRun(path): the Run button (optional)
 * opts.onClose(): the window's close button / File > Exit
 * opts.allowPaste: let the student paste
 */
export async function createVsCode(host, opts = {}) {
  loadCss();
  const cm = await loadCM();
  const fs = opts.fs, root = opts.root;
  const label = (opts.rootLabel || baseName(root)).toUpperCase();
  const files = new Map();   // path -> { state, saved, dirty, lang }
  let current = null, expanded = new Set([root]), selected = null, panelTab = opts.terminal ? "TERMINAL" : "PROBLEMS", view = null, sideView = null, wrap = false;
  for (const p of opts.expand || []) { let q = p; while (q.length >= root.length) { expanded.add(q); q = parentOf(q); if (q === "/") break; } }

  // ----- skeleton -----
  const menuNames = ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"];
  const menus = el("div", { class: "vsc-menus", role: "menubar" }, menuNames.map((n) => el("button", { type: "button", role: "menuitem", class: "vsc-menu", "data-menu": n, text: n })));
  const center = el("button", { type: "button", class: "vsc-cc", title: "Search files by name (Ctrl+P)" }, ic16("search16"), el("span", { text: baseName(root) }));
  const closeWin = el("button", { type: "button", class: "vsc-wb cls", title: "Close VS Code", "aria-label": "Close VS Code" }, ic16("close"));
  const titleBar = el("div", { class: "vsc-title" },
    el("span", { class: "vsc-logo", "aria-hidden": "true" }, icon('<path d="M17.5 2.5l4 2v15l-4 2L7 12zM17.5 2.5L2.5 14l2 1.6L17.5 7.2M17.5 21.5L2.5 10l2-1.6 13 8.4" stroke-width="1.4"/>', 18)),
    menus, el("div", { class: "vsc-ccwrap" }, center),
    el("div", { class: "vsc-wbtns" },
      el("button", { type: "button", class: "vsc-wb", title: "Toggle Primary Side Bar (Ctrl+B)", "aria-label": "Toggle side bar", onclick: () => toggleSide() }, ic16("layoutSide")),
      el("button", { type: "button", class: "vsc-wb", title: "Toggle Panel (Ctrl+J)", "aria-label": "Toggle panel", onclick: () => togglePanel() }, ic16("layoutPanel")),
      opts.onClose ? closeWin : null));
  const actBtns = [["files", "Explorer (Ctrl+Shift+E)", I.files], ["search", "Search (Ctrl+Shift+F)", I.search], ["scm", "Source Control (Ctrl+Shift+G)", I.scm], ["debug", "Run and Debug (Ctrl+Shift+D)", I.debug], ["ext", "Extensions (Ctrl+Shift+X)", I.ext]]
    .map(([id, title, d]) => { const b = el("button", { type: "button", class: "vsc-ab", "data-view": id, title, "aria-label": title.replace(/ \(.*/, "") }, icon(d)); b.addEventListener("click", () => showSide(id)); return b; });
  const actBar = el("div", { class: "vsc-act" }, el("div", { class: "vsc-act-top" }, actBtns),
    el("div", { class: "vsc-act-bot" }, el("button", { type: "button", class: "vsc-ab", title: "Accounts", "aria-label": "Accounts" }, icon(I.account)), el("button", { type: "button", class: "vsc-ab", title: "Manage", "aria-label": "Manage" }, icon(I.gear))));
  const side = el("div", { class: "vsc-side" });
  const sash = el("div", { class: "vsc-sash", role: "separator", "aria-orientation": "vertical", "aria-label": "Resize side bar" });
  const tabsRow = el("div", { class: "vsc-tabs", role: "tablist" });
  const runBtn = el("button", { type: "button", class: "vsc-ea", title: "Run Python File", "aria-label": "Run Python File" }, ic16("run"));
  const editorActions = el("div", { class: "vsc-eacts" }, runBtn, el("button", { type: "button", class: "vsc-ea", title: "Split Editor Right", "aria-label": "Split editor", disabled: true }, ic16("split")), el("button", { type: "button", class: "vsc-ea", title: "More Actions...", "aria-label": "More actions", onclick: (e) => openMenu("Editor", e.currentTarget) }, ic16("more")));
  const tabsBar = el("div", { class: "vsc-tabbar" }, tabsRow, editorActions);
  const crumbs = el("div", { class: "vsc-crumbs" });
  const edHost = el("div", { class: "vsc-ed" });
  const welcome = el("div", { class: "vsc-welcome" }, el("div", { class: "vsc-wlogo", "aria-hidden": "true" }, icon('<path d="M17.5 2.5l4 2v15l-4 2L7 12zM17.5 2.5L2.5 14l2 1.6L17.5 7.2M17.5 21.5L2.5 10l2-1.6 13 8.4" stroke-width=".7"/>', 120)),
    el("dl", {}, ["Show All Commands", "Ctrl + Shift + P", "Go to File", "Ctrl + P", "Find in Files", "Ctrl + Shift + F", "Toggle Terminal", "Ctrl + `"].map((x, i) => el(i % 2 ? "dd" : "dt", { text: x }))),
    el("p", { class: "vsc-wtip", text: "Click a file in the Explorer on the left to open it." }));
  const ptabNames = ["PROBLEMS", "OUTPUT", "DEBUG CONSOLE", "TERMINAL", "PORTS"];
  const ptabs = el("div", { class: "vsc-ptabs", role: "tablist" }, ptabNames.map((n) => { const b = el("button", { type: "button", role: "tab", class: "vsc-ptab", "data-tab": n }, el("span", { text: n }), n === "PROBLEMS" ? el("span", { class: "vsc-badge", hidden: true }) : null); b.addEventListener("click", () => showPanel(n)); return b; }));
  const pacts = el("div", { class: "vsc-pacts" },
    el("button", { type: "button", class: "vsc-ea", title: "New Terminal (Ctrl+Shift+`)", "aria-label": "New terminal", onclick: () => showPanel("TERMINAL") }, ic16("plus")),
    el("button", { type: "button", class: "vsc-ea", title: "Maximize Panel Size", "aria-label": "Maximize panel", onclick: () => { panel.classList.toggle("big"); } }, ic16("max")),
    el("button", { type: "button", class: "vsc-ea", title: "Hide Panel (Ctrl+J)", "aria-label": "Hide panel", onclick: () => togglePanel(false) }, ic16("close")));
  const pbody = el("div", { class: "vsc-pbody" });
  const termSlot = el("div", { class: "vsc-term", hidden: true });
  const outBox = el("div", { class: "vsc-out", hidden: true });
  const probBox = el("div", { class: "vsc-probs", hidden: true });
  const simpleBox = el("div", { class: "vsc-pmsg", hidden: true });
  pbody.append(probBox, outBox, simpleBox, termSlot);
  const psash = el("div", { class: "vsc-psash", role: "separator", "aria-orientation": "horizontal", "aria-label": "Resize panel" });
  const panel = el("div", { class: "vsc-panel" }, psash, el("div", { class: "vsc-phead" }, ptabs, pacts), pbody);
  const centerCol = el("div", { class: "vsc-center" }, tabsBar, crumbs, edHost, welcome, panel);
  const stLeft = el("div", { class: "vsc-st-l" },
    el("span", { class: "vsc-remote", title: "Open a Remote Window" }, ic16("remote")),
    el("span", { class: "vsc-si vsc-errs", title: "No Problems" }, ic16("err"), el("span", { class: "n-e", text: "0" }), ic16("warn"), el("span", { class: "n-w", text: "0" })));
  const stPos = el("span", { class: "vsc-si", text: "" }), stLang = el("span", { class: "vsc-si", text: "" }), stPy = el("span", { class: "vsc-si", text: "" });
  const stRight = el("div", { class: "vsc-st-r" }, stPos, el("span", { class: "vsc-si fx", text: "Spaces: 4" }), el("span", { class: "vsc-si fx", text: "UTF-8" }), el("span", { class: "vsc-si fx", text: "LF" }), stLang, stPy, el("span", { class: "vsc-si", title: "Notifications" }, ic16("bell")));
  const status = el("div", { class: "vsc-status" }, stLeft, stRight);
  const main = el("div", { class: "vsc-main" }, actBar, side, sash, centerCol);
  const rootEl = el("div", { class: "vsc", role: "application", "aria-label": "Visual Studio Code (practice copy)", tabindex: "-1" }, titleBar, main, status);
  // clicks on plain areas keep the keyboard inside VS Code (so Ctrl+P, Ctrl+B... work, not the page's own keys)
  rootEl.addEventListener("mousedown", (e) => { if (!e.target.closest("input, textarea, button, .cm-editor, [tabindex], .tmr-pane, .py-term")) setTimeout(() => { if (!rootEl.contains(document.activeElement) || document.activeElement === document.body) rootEl.focus({ preventScroll: true }); }, 0); });
  host.append(rootEl);
  if (opts.terminal) termSlot.append(opts.terminal);

  // ----- the editor -----
  const theme = makeTheme(cm);
  const langExt = (id) => ({ python: cm.python(), xml: cm.xml(), yaml: cm.yaml(), json: cm.json(), cpp: cm.cpp() }[id] || []);
  const lintLines = (state, lang) => findProblems(state.doc.toString(), lang).filter((p) => p.line >= 0 && p.line < state.doc.lines).map((p) => { const ln = state.doc.line(p.line + 1); const from = ln.from + (ln.text.length - ln.text.trimStart().length); return { from, to: Math.max(from + 1, ln.to), severity: p.sev, message: p.msg }; });
  const blockClip = (e) => { if (opts.allowPaste) return false; e.preventDefault(); return true; };   // the page shows its own "turned off" message
  function makeState(text, path) {
    const lang = langOf(baseName(path)).id;
    return cm.EditorState.create({
      doc: text,
      extensions: [
        cm.lineNumbers(), cm.highlightActiveLineGutter(), cm.highlightSpecialChars(), cm.history(), cm.foldGutter(), cm.drawSelection(), cm.dropCursor(),
        cm.EditorState.allowMultipleSelections.of(true), cm.indentOnInput(), cm.bracketMatching(), cm.closeBrackets(), cm.autocompletion(), cm.rectangularSelection(),
        cm.highlightActiveLine(), cm.highlightSelectionMatches(), cm.indentUnit.of("    "), cm.EditorState.tabSize.of(4), cm.lintGutter(),
        cm.linter((v) => lintLines(v.state, lang), { delay: 400 }),
        cm.keymap.of([...cm.closeBracketsKeymap, ...cm.defaultKeymap, ...cm.searchKeymap, ...cm.historyKeymap, ...cm.foldKeymap, ...cm.completionKeymap, cm.indentWithTab, { key: "Mod-/", run: cm.toggleComment }]),
        wrapComp.of(wrap ? cm.EditorView.lineWrapping : []),
        langExt(lang), theme,
        cm.EditorView.domEventHandlers({ paste: blockClip, copy: blockClip, cut: blockClip }),
        cm.EditorView.updateListener.of((u) => { if (u.docChanged) markDirty(); if (u.docChanged || u.selectionSet) paintStatus(); }),
      ],
    });
  }
  const wrapComp = new cm.Compartment();
  view = new cm.EditorView({ parent: edHost });

  // ----- explorer -----
  const tree = el("div", { class: "vsc-tree", role: "tree", "aria-label": "Files Explorer", tabindex: "0" });
  function renderTree() {
    const rows = [];
    const walk = (dir, depth) => {
      const items = fs.list(dir).slice().sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, "en", { sensitivity: "base" }) : a.dir ? -1 : 1));
      for (const it of items) {
        if (it.name === "." || it.name === "..") continue;
        const p = dir === "/" ? "/" + it.name : `${dir}/${it.name}`, open = expanded.has(p);
        const row = el("div", { class: "vsc-row" + (p === selected ? " sel" : "") + (current === p ? " act" : ""), role: "treeitem", tabindex: "-1", "aria-level": String(depth + 1), "aria-expanded": it.dir ? String(open) : null, "data-path": p, style: { paddingLeft: `${8 + depth * 8}px` } },
          el("span", { class: "vsc-guides", style: { width: `${depth * 8}px` } }),
          it.dir ? el("span", { class: "vsc-chev" }, ic16(open ? "chevD" : "chevR")) : el("span", { class: "vsc-chev" }),
          it.dir ? null : fileBadge(it.name), el("span", { class: "vsc-name", text: it.name }),
          files.get(p) && files.get(p).dirty ? el("span", { class: "vsc-dot", text: "M" }) : null);
        row.addEventListener("click", () => { selected = p; if (it.dir) { if (open) expanded.delete(p); else expanded.add(p); renderTree(); tree.focus({ preventScroll: true }); } else { openFile(p); } });
        row.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); selected = p; renderTree(); openCtx(e.clientX, e.clientY, p, it.dir); });
        rows.push(row);
        if (it.dir && open) walk(p, depth + 1);
      }
    };
    if (expanded.has(root)) walk(root, 0);
    tree.replaceChildren(...rows);
    if (!rows.length && expanded.has(root)) tree.append(el("div", { class: "vsc-empty", text: "This folder is empty. Use the New File button above, or create a package in the terminal." }));
  }
  const secHead = el("div", { class: "vsc-sec" },
    el("button", { type: "button", class: "vsc-sectitle", "aria-expanded": "true", onclick: () => { if (expanded.has(root)) expanded.delete(root); else expanded.add(root); renderTree(); secHead.querySelector(".vsc-sectitle").replaceChildren(ic16(expanded.has(root) ? "chevD" : "chevR"), el("span", { text: label })); } }, ic16("chevD"), el("span", { text: label })),
    el("span", { class: "vsc-secacts" },
      el("button", { type: "button", class: "vsc-ea", title: "New File...", "aria-label": "New file", onclick: () => newEntry(false) }, ic16("newFile")),
      el("button", { type: "button", class: "vsc-ea", title: "New Folder...", "aria-label": "New folder", onclick: () => newEntry(true) }, ic16("newFolder")),
      el("button", { type: "button", class: "vsc-ea", title: "Refresh Explorer", "aria-label": "Refresh explorer", onclick: () => refresh() }, ic16("refresh")),
      el("button", { type: "button", class: "vsc-ea", title: "Collapse Folders in Explorer", "aria-label": "Collapse folders", onclick: () => { expanded = new Set([root]); renderTree(); } }, ic16("collapse"))));
  const explorer = el("div", { class: "vsc-view" }, el("div", { class: "vsc-vhead" }, el("span", { text: "EXPLORER" }), el("button", { type: "button", class: "vsc-ea", title: "Views and More Actions...", "aria-label": "More" }, ic16("more"))), secHead, tree,
    el("div", { class: "vsc-sec dim" }, ic16("chevR"), el("span", { text: "OUTLINE" })), el("div", { class: "vsc-sec dim" }, ic16("chevR"), el("span", { text: "TIMELINE" })));

  // search view
  const sInput = el("input", { type: "text", class: "vsc-input", placeholder: "Search", "aria-label": "Search in files", spellcheck: "false" });
  const sResults = el("div", { class: "vsc-sres" });
  sInput.addEventListener("input", () => runSearch());
  function allFiles(dir = root, acc = []) {
    for (const it of fs.list(dir)) { const p = `${dir}/${it.name}`; if (it.dir) { if (!/^(build|install|log|\.git)$/.test(it.name) || dir !== root) allFiles(p, acc); } else acc.push(p); }
    return acc;
  }
  function runSearch() {
    const q = sInput.value; sResults.replaceChildren();
    if (!q) return;
    let n = 0;
    for (const p of allFiles()) {
      const txt = files.get(p) ? files.get(p).state.doc.toString() : fs.read(p);
      if (txt == null || txt.startsWith("@url:") || txt.startsWith("#cpp-binary")) continue;
      const hits = txt.split("\n").map((l, i) => [l, i]).filter(([l]) => l.toLowerCase().includes(q.toLowerCase()));
      if (!hits.length) continue;
      sResults.append(el("div", { class: "vsc-sfile" }, fileBadge(baseName(p)), el("b", { text: baseName(p) }), el("span", { class: "dim", text: " " + p.slice(root.length + 1, -baseName(p).length - 1) }), el("span", { class: "vsc-badge", text: String(hits.length) })));
      for (const [l, i] of hits.slice(0, 50)) { n++; const r = el("button", { type: "button", class: "vsc-sline", text: l.trim().slice(0, 120) }); r.addEventListener("click", () => openFile(p, i)); sResults.append(r); }
    }
    if (!n) sResults.append(el("p", { class: "dim", text: "No results found." }));
  }
  const searchView = el("div", { class: "vsc-view" }, el("div", { class: "vsc-vhead" }, el("span", { text: "SEARCH" })), el("div", { class: "vsc-pad" }, sInput), sResults);
  const scmView = el("div", { class: "vsc-view" }, el("div", { class: "vsc-vhead" }, el("span", { text: "SOURCE CONTROL" })),
    el("div", { class: "vsc-pad" }, el("p", { text: "The folder currently open doesn't have a git repository. You can initialize a repository which will enable source control features powered by Git." }), el("button", { type: "button", class: "vsc-primary", disabled: true, text: "Initialize Repository" }), el("p", { class: "dim", text: "(Git is covered later. In this practice copy the button does nothing.)" })));
  const debugView = el("div", { class: "vsc-view" }, el("div", { class: "vsc-vhead" }, el("span", { text: "RUN AND DEBUG" })),
    el("div", { class: "vsc-pad" }, el("button", { type: "button", class: "vsc-primary", text: "Run and Debug", onclick: () => runCurrent() }), el("p", { text: "Runs the Python file that is open, in the terminal below. For ROS 2 nodes inside a package, build with colcon and use ros2 run instead." })));
  const extList = [["Python", "Microsoft", "Python language support: IntelliSense (Pylance), debugging, linting."], ["Pylance", "Microsoft", "A performant, feature-rich language server for Python."], ["C/C++", "Microsoft", "C/C++ IntelliSense, debugging and code browsing."], ["CMake Tools", "Microsoft", "Extended CMake support in Visual Studio Code."], ["XML", "Red Hat", "XML language support (used for package.xml, URDF and launch files)."], ["YAML", "Red Hat", "YAML language support (used for parameter files)."], ["ROS", "Microsoft", "Develop Robot Operating System (ROS) applications."]];
  const extView = el("div", { class: "vsc-view" }, el("div", { class: "vsc-vhead" }, el("span", { text: "EXTENSIONS" })), el("div", { class: "vsc-pad" }, el("input", { type: "text", class: "vsc-input", placeholder: "Search Extensions in Marketplace", "aria-label": "Search extensions", disabled: true })),
    el("div", { class: "vsc-sec" }, ic16("chevD"), el("span", { text: "INSTALLED" }), el("span", { class: "vsc-badge", text: String(extList.length) })),
    extList.map(([n, by, about]) => el("div", { class: "vsc-ext" }, el("div", { class: "vsc-exticon", text: n.slice(0, 2) }), el("div", {}, el("b", { text: n }), el("div", { class: "dim", text: about }), el("div", { class: "vsc-by", text: by })))));
  const views = { files: explorer, search: searchView, scm: scmView, debug: debugView, ext: extView };
  function showSide(id, force) {
    if (!force && sideView === id && !rootEl.classList.contains("noside")) { toggleSide(false); return; }
    sideView = id; rootEl.classList.remove("noside");
    side.replaceChildren(views[id]);
    actBtns.forEach((b) => b.classList.toggle("on", b.dataset.view === id));
    if (id === "search") setTimeout(() => sInput.focus(), 0);
  }
  function toggleSide(on) { const hide = on === undefined ? !rootEl.classList.contains("noside") : !on; rootEl.classList.toggle("noside", hide); actBtns.forEach((b) => b.classList.toggle("on", !hide && b.dataset.view === sideView)); }
  function togglePanel(on) { const hide = on === undefined ? !rootEl.classList.contains("nopanel") : !on; rootEl.classList.toggle("nopanel", hide); if (!hide) showPanel(panelTab); }

  // ----- files: open / save / close -----
  function tabFor(p) {
    const f = files.get(p), name = baseName(p);
    const x = el("button", { type: "button", class: "vsc-tx", title: "Close (Ctrl+W)", "aria-label": `Close ${name}` }, f.dirty ? el("span", { class: "vsc-txdot" }) : ic16("close"));
    const t = el("div", { class: "vsc-tab" + (p === current ? " on" : "") + (f.dirty ? " dirty" : ""), role: "tab", "aria-selected": String(p === current), title: p, tabindex: "0" }, fileBadge(name), el("span", { class: "vsc-tname", text: name }), x);
    t.addEventListener("click", (e) => { if (e.target.closest(".vsc-tx")) closeFile(p); else openFile(p); });
    t.addEventListener("auxclick", (e) => { if (e.button === 1) closeFile(p); });
    return t;
  }
  function paintTabs() {
    tabsRow.replaceChildren(...[...files.keys()].map(tabFor));
    const has = !!current;
    edHost.hidden = !has; welcome.hidden = has; crumbs.hidden = !has; editorActions.hidden = !has;
    runBtn.hidden = !(current && langOf(baseName(current)).id === "python");
    if (has) {
      const rel = current.startsWith(root + "/") ? current.slice(root.length + 1).split("/") : current.split("/").filter(Boolean);
      crumbs.replaceChildren(...rel.flatMap((s, i) => [i ? el("span", { class: "vsc-csep" }, ic16("chevR")) : null, i === rel.length - 1 ? fileBadge(s) : null, el("span", { text: s })]).filter(Boolean));
    }
    paintStatus();
  }
  function paintStatus() {
    if (!current) { stPos.textContent = ""; stLang.textContent = ""; stPy.textContent = ""; return; }
    const st = view.state, h = st.selection.main.head, ln = st.doc.lineAt(h);
    const sel = st.selection.main.to - st.selection.main.from;
    stPos.textContent = `Ln ${ln.number}, Col ${h - ln.from + 1}` + (sel ? ` (${sel} selected)` : "");
    const lg = langOf(baseName(current));
    stLang.textContent = lg.label === "Python" ? "{ } Python" : lg.label;
    stPy.textContent = lg.id === "python" ? "3.12.3 64-bit" : "";
    const probs = findProblems(st.doc.toString(), lg.id);
    const ne = probs.filter((p) => p.sev === "error").length, nw = probs.length - ne;
    stLeft.querySelector(".n-e").textContent = String(ne); stLeft.querySelector(".n-w").textContent = String(nw);
    const badge = ptabs.querySelector(".vsc-badge"); badge.hidden = !probs.length; badge.textContent = String(probs.length);
    if (panelTab === "PROBLEMS") paintProblems(probs);
  }
  function paintProblems(probs) {
    probBox.replaceChildren();
    if (!current || !probs.length) { probBox.append(el("p", { class: "dim", text: "No problems have been detected in the workspace." })); return; }
    probBox.append(el("div", { class: "vsc-pfile" }, ic16("chevD"), fileBadge(baseName(current)), el("b", { text: baseName(current) }), el("span", { class: "dim", text: " " + parentOf(current).replace(root, "").replace(/^\//, "") }), el("span", { class: "vsc-badge", text: String(probs.length) })));
    for (const p of probs) {
      const r = el("button", { type: "button", class: "vsc-prob " + p.sev }, ic16(p.sev === "error" ? "err" : "warn"), el("span", { text: p.msg }), el("span", { class: "dim", text: ` [Ln ${p.line + 1}]` }));
      r.addEventListener("click", () => openFile(current, p.line));
      probBox.append(r);
    }
  }
  function openFile(p, line) {
    if (!fs.isFile(p)) return false;
    if (current && files.has(current)) files.get(current).state = view.state;
    if (!files.has(p)) {
      const txt = fs.read(p) ?? "";
      if (txt.startsWith("@url:") || txt.startsWith("#cpp-binary")) { output(`[info] ${baseName(p)} is a binary file and cannot be shown in the text editor.`); return false; }
      files.set(p, { state: makeState(txt, p), saved: txt, dirty: false });
    }
    current = p; selected = p;
    view.setState(files.get(p).state);
    let q = parentOf(p); while (q.startsWith(root) && q.length >= root.length) { expanded.add(q); if (q === root) break; q = parentOf(q); }
    paintTabs(); renderTree();
    if (line != null && line >= 0) { const L = view.state.doc.line(Math.min(view.state.doc.lines, line + 1)); view.dispatch({ selection: { anchor: L.from }, scrollIntoView: true }); }
    setTimeout(() => view.focus(), 0);
    return true;
  }
  function markDirty() {
    const f = current && files.get(current); if (!f) return;
    const d = view.state.doc.toString() !== f.saved;
    if (d !== f.dirty) { f.dirty = d; f.state = view.state; paintTabs(); renderTree(); }
  }
  function save(p = current) {
    const f = p && files.get(p); if (!f) return false;
    if (p === current) f.state = view.state;
    const txt = f.state.doc.toString();
    const err = fs.write(p, txt);
    if (err) { output(`[error] ${err}`); notify(err, true); return false; }
    f.saved = txt; f.dirty = false;
    paintTabs(); renderTree();
    opts.onSave && opts.onSave(p, txt);
    return true;
  }
  function saveAll() { for (const [p, f] of files) if (f.dirty) save(p); }
  function closeFile(p) {
    const f = files.get(p); if (!f) return;
    if (f.dirty && !confirmBox(`Do you want to save the changes you made to ${baseName(p)}?`, () => { save(p); closeFile(p); }, () => { f.dirty = false; closeFile(p); })) return;
    const keys = [...files.keys()], i = keys.indexOf(p);
    files.delete(p);
    if (current === p) { current = null; const next = keys[i + 1] || keys[i - 1]; if (next && files.has(next)) openFile(next); else { paintTabs(); renderTree(); } }
    else { paintTabs(); renderTree(); }
  }
  function confirmBox(msg, onSave, onDiscard) {
    const dlg = el("div", { class: "vsc-dialog", role: "alertdialog", "aria-label": msg },
      el("div", { class: "vsc-dmsg" }, ic16("warn"), el("div", {}, el("b", { text: msg }), el("p", { text: "Your changes will be lost if you don't save them." }))),
      el("div", { class: "vsc-dbtns" },
        el("button", { type: "button", class: "vsc-primary", text: "Save", onclick: () => { dlg.remove(); onSave(); } }),
        el("button", { type: "button", class: "vsc-secondary", text: "Don't Save", onclick: () => { dlg.remove(); onDiscard(); } }),
        el("button", { type: "button", class: "vsc-secondary", text: "Cancel", onclick: () => dlg.remove() })));
    rootEl.append(dlg); dlg.querySelector("button").focus();
    return false;
  }
  function notify(msg, isErr) {
    const n = el("div", { class: "vsc-toast" + (isErr ? " err" : "") }, ic16(isErr ? "err" : "bell"), el("span", { text: msg }), el("button", { type: "button", class: "vsc-ea", "aria-label": "Close notification", onclick: () => n.remove() }, ic16("close")));
    rootEl.append(n); setTimeout(() => n.remove(), 5000);
  }
  function output(line) { outBox.append(el("div", { text: `${new Date().toTimeString().slice(0, 8)} ${line}` })); }

  // new file / folder with an inline name box, like VS Code
  function newEntry(isDir, base) {
    let dir = base || (selected ? (fs.isDir(selected) ? selected : parentOf(selected)) : root);
    if (!dir.startsWith(root)) dir = root;
    expanded.add(dir); renderTree();
    const input = el("input", { type: "text", class: "vsc-newname", "aria-label": isDir ? "New folder name" : "New file name", spellcheck: "false" });
    const depth = dir === root ? 0 : dir.slice(root.length + 1).split("/").length;
    const row = el("div", { class: "vsc-row editing", style: { paddingLeft: `${8 + depth * 8}px` } }, el("span", { class: "vsc-chev" }, isDir ? ic16("chevR") : null), isDir ? null : el("span", { class: "vsc-fi", text: "≡" }), input);
    const anchor = tree.querySelector(`[data-path="${CSS.escape(dir)}"]`);
    if (anchor) anchor.after(row); else tree.prepend(row);
    input.focus();
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      const name = input.value.trim(); row.remove();
      if (!ok || !name) { renderTree(); return; }
      if (/[\\]/.test(name) || name.split("/").some((x) => x === ".." )) { notify("That name is not allowed.", true); renderTree(); return; }
      const p = `${dir}/${name}`;
      if (fs.isFile(p) || fs.isDir(p)) { notify(`A file or folder ${name} already exists at this location. Please choose a different name.`, true); renderTree(); return; }
      const err = isDir ? fs.mkdir(p) : fs.write(p, "");
      if (err) { notify(err, true); renderTree(); return; }
      output(`[info] Created ${p.replace(root + "/", "")}`);
      if (isDir) { expanded.add(p); selected = p; renderTree(); } else openFile(p);
    };
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") finish(true); else if (e.key === "Escape") finish(false); });
    input.addEventListener("blur", () => finish(true));
  }
  function renameEntry(p) {
    const row = tree.querySelector(`[data-path="${CSS.escape(p)}"]`); if (!row) return;
    const nameEl = row.querySelector(".vsc-name");
    const input = el("input", { type: "text", class: "vsc-newname", value: baseName(p), "aria-label": "New name", spellcheck: "false" });
    nameEl.replaceWith(input); input.focus(); input.setSelectionRange(0, baseName(p).replace(/\.[^.]+$/, "").length || baseName(p).length);
    let done = false;
    const finish = (ok) => {
      if (done) return; done = true;
      const name = input.value.trim();
      if (ok && name && name !== baseName(p) && !name.includes("/")) {
        const q = `${parentOf(p)}/${name}`;
        const err = fs.rename(p, q);
        if (err) notify(err, true);
        else {
          for (const k of [...files.keys()]) if (k === p || k.startsWith(p + "/")) { const nk = q + k.slice(p.length); files.set(nk, files.get(k)); files.delete(k); if (current === k) current = nk; }
          selected = q;
        }
      }
      paintTabs(); renderTree();
    };
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") finish(true); else if (e.key === "Escape") finish(false); });
    input.addEventListener("blur", () => finish(true));
  }
  function deleteEntry(p) {
    const dlg = el("div", { class: "vsc-dialog", role: "alertdialog" },
      el("div", { class: "vsc-dmsg" }, ic16("warn"), el("div", {}, el("b", { text: `Are you sure you want to delete '${baseName(p)}'${fs.isDir(p) ? " and its contents" : ""}?` }), el("p", { text: "This cannot be undone in the practice workspace." }))),
      el("div", { class: "vsc-dbtns" },
        el("button", { type: "button", class: "vsc-primary", text: "Delete", onclick: () => { dlg.remove(); const err = fs.remove(p); if (err) { notify(err, true); return; } for (const k of [...files.keys()]) if (k === p || k.startsWith(p + "/")) { files.delete(k); if (current === k) current = null; } if (!current && files.size) openFile([...files.keys()][0]); paintTabs(); renderTree(); } }),
        el("button", { type: "button", class: "vsc-secondary", text: "Cancel", onclick: () => dlg.remove() })));
    rootEl.append(dlg); dlg.querySelector("button").focus();
  }

  // ----- menus -----
  let menuEl = null;
  function closeMenus() { if (menuEl) { menuEl.remove(); menuEl = null; } menus.querySelectorAll(".open").forEach((b) => b.classList.remove("open")); document.removeEventListener("pointerdown", outside, true); }
  function outside(e) { if (menuEl && !menuEl.contains(e.target) && !e.target.closest(".vsc-menu")) closeMenus(); }
  function showMenuAt(items, x, y) {
    closeMenus();
    menuEl = el("div", { class: "vsc-mbox", role: "menu" }, items.map((it) => it === "-" ? el("div", { class: "vsc-msep", role: "separator" }) :
      el("button", { type: "button", role: "menuitem", class: "vsc-mi", disabled: it.disabled || null, onclick: () => { closeMenus(); it.run(); } }, el("span", { class: "vsc-mck", text: it.on ? "✓" : "" }), el("span", { class: "vsc-ml", text: it.label }), el("span", { class: "vsc-mk", text: it.key || "" }))));
    document.body.append(menuEl);
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.max(2, Math.min(x, innerWidth - r.width - 4)) + "px";
    menuEl.style.top = Math.max(2, Math.min(y, innerHeight - r.height - 4)) + "px";
    document.addEventListener("pointerdown", outside, true);
    menuEl.addEventListener("keydown", (e) => {
      const list = [...menuEl.querySelectorAll(".vsc-mi:not([disabled])")], i = list.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); closeMenus(); view.focus(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = list.length; list[(i + (e.key === "ArrowDown" ? 1 : n - 1) + n) % n].focus(); }
    });
    menuEl.querySelector(".vsc-mi:not([disabled])")?.focus();
  }
  const MENU = {
    File: () => [{ label: "New File...", key: "Ctrl+Alt+Win+N", run: () => { showSide("files"); newEntry(false); } }, { label: "New Folder...", run: () => { showSide("files"); newEntry(true); } }, "-",
      { label: "Save", key: "Ctrl+S", run: () => save(), disabled: !current }, { label: "Save All", run: saveAll, disabled: ![...files.values()].some((f) => f.dirty) }, "-",
      { label: "Auto Save", run: () => { autoSave = !autoSave; }, on: autoSave }, "-", { label: "Revert File", run: () => { if (!current) return; const f = files.get(current); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: f.saved } }); }, disabled: !current }, { label: "Close Editor", key: "Ctrl+W", run: () => current && closeFile(current), disabled: !current },
      ...(opts.onClose ? ["-", { label: "Exit", run: () => tryClose() }] : [])],
    Edit: () => [{ label: "Undo", key: "Ctrl+Z", run: () => runCm("undo"), disabled: !current }, { label: "Redo", key: "Ctrl+Y", run: () => runCm("redo"), disabled: !current }, "-",
      { label: "Find", key: "Ctrl+F", run: () => { view.focus(); cm.openSearchPanel(view); }, disabled: !current }, { label: "Find in Files", key: "Ctrl+Shift+F", run: () => showSide("search") }, "-",
      { label: "Toggle Line Comment", key: "Ctrl+/", run: () => { cm.toggleComment(view); view.focus(); }, disabled: !current }],
    Selection: () => [{ label: "Select All", key: "Ctrl+A", run: () => { view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } }); view.focus(); }, disabled: !current }],
    View: () => [{ label: "Explorer", key: "Ctrl+Shift+E", run: () => showSide("files") }, { label: "Search", key: "Ctrl+Shift+F", run: () => showSide("search") }, { label: "Source Control", key: "Ctrl+Shift+G", run: () => showSide("scm") }, { label: "Run", key: "Ctrl+Shift+D", run: () => showSide("debug") }, { label: "Extensions", key: "Ctrl+Shift+X", run: () => showSide("ext") }, "-",
      { label: "Problems", key: "Ctrl+Shift+M", run: () => { togglePanel(true); showPanel("PROBLEMS"); } }, { label: "Output", run: () => { togglePanel(true); showPanel("OUTPUT"); } }, { label: "Terminal", key: "Ctrl+`", run: () => { togglePanel(true); showPanel("TERMINAL"); } }, "-",
      { label: "Word Wrap", key: "Alt+Z", on: wrap, run: toggleWrap }],
    Go: () => [{ label: "Go to File...", key: "Ctrl+P", run: quickOpen }, { label: "Go to Line/Column...", key: "Ctrl+G", run: goLine, disabled: !current }],
    Run: () => [{ label: "Run Without Debugging", key: "Ctrl+F5", run: runCurrent, disabled: !(current && langOf(baseName(current)).id === "python") }],
    Terminal: () => [{ label: "New Terminal", key: "Ctrl+Shift+`", run: () => { togglePanel(true); showPanel("TERMINAL"); } }, { label: "Run Active File", run: runCurrent, disabled: !(current && langOf(baseName(current)).id === "python") }],
    Help: () => [{ label: "About", run: () => notify("Practice copy of Visual Studio Code for ROS2Lab. It edits the files of your practice workspace. The real VS Code is free from code.visualstudio.com.") }],
    Editor: () => [{ label: "Close All", run: () => { for (const p of [...files.keys()]) closeFile(p); } }, { label: "Word Wrap", on: wrap, run: toggleWrap }],
  };
  let autoSave = false;
  function runCm(name) { cm[name](view); view.focus(); }
  function toggleWrap() {
    wrap = !wrap;
    const eff = wrapComp.reconfigure(wrap ? cm.EditorView.lineWrapping : []);
    view.dispatch({ effects: eff });
    for (const [p, f] of files) f.state = p === current ? view.state : f.state.update({ effects: eff }).state;
  }
  function openMenu(name, anchor) { const r = anchor.getBoundingClientRect(); showMenuAt(MENU[name](), r.left, r.bottom + 2); if (anchor.classList.contains("vsc-menu")) anchor.classList.add("open"); }
  menus.addEventListener("click", (e) => { const b = e.target.closest(".vsc-menu"); if (!b) return; if (b.classList.contains("open")) closeMenus(); else openMenu(b.dataset.menu, b); });
  menus.addEventListener("pointerover", (e) => { const b = e.target.closest(".vsc-menu"); if (b && menuEl && !b.classList.contains("open") && menus.querySelector(".open")) openMenu(b.dataset.menu, b); });
  function openCtx(x, y, p, isDir) {
    showMenuAt([{ label: "New File...", run: () => newEntry(false, isDir ? p : parentOf(p)) }, { label: "New Folder...", run: () => newEntry(true, isDir ? p : parentOf(p)) }, "-",
      ...(isDir ? [] : [{ label: "Open", run: () => openFile(p) }]), { label: "Copy Path", run: () => { notify(p); } }, { label: "Copy Relative Path", run: () => notify(p.replace(root + "/", "")) }, "-",
      { label: "Rename...", key: "F2", run: () => renameEntry(p) }, { label: "Delete", key: "Delete", run: () => deleteEntry(p) }], x, y);
  }
  function quickOpen() {
    closeMenus();
    const input = el("input", { type: "text", class: "vsc-input", placeholder: "Search files by name", "aria-label": "Go to file", spellcheck: "false" });
    const list = el("div", { class: "vsc-qlist", role: "listbox" });
    const box = el("div", { class: "vsc-quick" }, input, list);
    const paint = () => {
      const q = input.value.toLowerCase();
      const hits = allFiles().filter((p) => p.toLowerCase().includes(q)).slice(0, 12);
      list.replaceChildren(...hits.map((p, i) => { const b = el("button", { type: "button", role: "option", class: "vsc-qi" + (i === 0 ? " on" : "") }, fileBadge(baseName(p)), el("span", { text: baseName(p) }), el("span", { class: "dim", text: " " + parentOf(p).replace(root, "").replace(/^\//, "") })); b.addEventListener("click", () => { box.remove(); openFile(p); }); return b; }));
      if (!hits.length) list.append(el("p", { class: "dim", text: "No matching results" }));
    };
    input.addEventListener("input", paint);
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { box.remove(); view.focus(); } else if (e.key === "Enter") { const f = list.querySelector(".vsc-qi"); if (f) f.click(); } });
    input.addEventListener("blur", () => setTimeout(() => box.remove(), 150));
    rootEl.append(box); paint(); input.focus();
  }
  function goLine() {
    const input = el("input", { type: "text", class: "vsc-input", placeholder: `Type a line number between 1 and ${view.state.doc.lines} to navigate to.`, "aria-label": "Go to line" });
    const box = el("div", { class: "vsc-quick" }, input);
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { box.remove(); view.focus(); } else if (e.key === "Enter") { const n = parseInt(input.value, 10); box.remove(); if (n > 0) openFile(current, n - 1); } });
    input.addEventListener("blur", () => setTimeout(() => box.remove(), 150));
    rootEl.append(box); input.focus();
  }

  // ----- panel -----
  function showPanel(n) {
    panelTab = n;
    ptabs.querySelectorAll(".vsc-ptab").forEach((b) => { b.classList.toggle("on", b.dataset.tab === n); b.setAttribute("aria-selected", String(b.dataset.tab === n)); });
    probBox.hidden = n !== "PROBLEMS"; outBox.hidden = n !== "OUTPUT"; termSlot.hidden = n !== "TERMINAL"; simpleBox.hidden = !["DEBUG CONSOLE", "PORTS"].includes(n);
    if (n === "DEBUG CONSOLE") simpleBox.textContent = "Please start a debug session to evaluate expressions";
    if (n === "PORTS") simpleBox.textContent = "No forwarded ports. Forward a port to access your running services locally.";
    if (n === "PROBLEMS") paintStatus();
    if (n === "TERMINAL" && opts.onTerminalShown) opts.onTerminalShown();
  }
  function runCurrent() {
    if (!current) return;
    if (files.get(current).dirty) save(current);
    togglePanel(true); showPanel("TERMINAL");
    opts.onRun && opts.onRun(current);
  }
  runBtn.addEventListener("click", runCurrent);
  closeWin.addEventListener("click", () => tryClose());
  function tryClose() {
    const dirty = [...files.entries()].filter(([, f]) => f.dirty);
    if (!dirty.length) { opts.onClose && opts.onClose(); return; }
    confirmBox(`Do you want to save the changes to ${dirty.length} file${dirty.length > 1 ? "s" : ""}?`, () => { saveAll(); opts.onClose && opts.onClose(); }, () => { opts.onClose && opts.onClose(); });
  }
  center.addEventListener("click", quickOpen);

  // ----- resizing -----
  const drag = (handle, onMove) => handle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add("drag");
    const mv = (ev) => onMove(ev), up = () => { handle.classList.remove("drag"); handle.removeEventListener("pointermove", mv); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", mv); handle.addEventListener("pointerup", up);
  });
  drag(sash, (ev) => { const r = main.getBoundingClientRect(); side.style.width = Math.max(150, Math.min(r.width * 0.6, ev.clientX - r.left - 48)) + "px"; });
  drag(psash, (ev) => { const r = centerCol.getBoundingClientRect(); panel.style.height = Math.max(90, Math.min(r.height - 80, r.bottom - ev.clientY)) + "px"; });

  // ----- keyboard: VS Code shortcuts. Stop them here so the page's own key blocking does not see them. -----
  rootEl.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    let act = null;
    if (ctrl && !e.shiftKey && k === "s") act = () => save();
    else if (ctrl && e.shiftKey && k === "s") act = saveAll;
    else if (ctrl && !e.shiftKey && k === "p") act = quickOpen;
    else if (ctrl && !e.shiftKey && k === "b") act = () => toggleSide();
    else if (ctrl && !e.shiftKey && k === "j") act = () => togglePanel();
    else if (ctrl && k === "`") act = () => { togglePanel(true); showPanel("TERMINAL"); };
    else if (ctrl && e.shiftKey && k === "e") act = () => showSide("files", true);
    else if (ctrl && e.shiftKey && k === "f") act = () => showSide("search", true);
    else if (ctrl && e.shiftKey && k === "m") act = () => { togglePanel(true); showPanel("PROBLEMS"); };
    else if (ctrl && !e.shiftKey && k === "g" && current) act = goLine;
    else if (e.altKey && !ctrl && k === "z") act = toggleWrap;
    else if (e.key === "F5") act = runCurrent;
    else if (e.key === "F2" && selected && !e.target.closest(".cm-editor")) act = () => renameEntry(selected);
    else if (e.key === "Delete" && selected && e.target.closest(".vsc-tree")) act = () => deleteEntry(selected);
    if (ctrl && e.shiftKey && ["i", "j", "c"].includes(k) && !act) return;
    if (act) { e.preventDefault(); e.stopPropagation(); act(); }
  });
  rootEl.addEventListener("contextmenu", (e) => { if (e.target.closest(".cm-editor")) { e.preventDefault(); e.stopPropagation(); showMenuAt([{ label: "Go to Line/Column...", key: "Ctrl+G", run: goLine }, "-", { label: "Toggle Line Comment", key: "Ctrl+/", run: () => cm.toggleComment(view) }, { label: "Find", key: "Ctrl+F", run: () => cm.openSearchPanel(view) }, "-", { label: "Run Python File in Terminal", run: runCurrent, disabled: !(current && langOf(baseName(current)).id === "python") }], e.clientX, e.clientY); } });
  setInterval(() => { if (autoSave && rootEl.isConnected) for (const [p, f] of files) if (f.dirty) save(p); }, 1500);

  // ----- start -----
  function refresh() {
    // a file changed outside the editor (terminal, nano): reload it if the student has no unsaved edits
    for (const [p, f] of [...files]) {
      if (!fs.isFile(p)) { files.delete(p); if (current === p) current = null; continue; }
      const disk = fs.read(p) ?? "";
      if (!f.dirty && disk !== f.saved) { f.saved = disk; f.state = makeState(disk, p); if (p === current) view.setState(f.state); }
    }
    if (!current && files.size) openFile([...files.keys()][0]); else { paintTabs(); renderTree(); }
  }
  showSide("files"); showPanel(panelTab);
  if (opts.narrow ?? (host.clientWidth && host.clientWidth < 600)) toggleSide(false);
  renderTree(); paintTabs();
  for (const p of opts.open || []) openFile(p);
  return {
    el: rootEl, open: openFile, refresh, save, saveAll, showPanel, focus: () => view.focus(),
    setTerminal: (node) => { termSlot.replaceChildren(node); },
    current: () => current, dirty: () => [...files.values()].some((f) => f.dirty),
    text: (p = current) => (files.get(p) ? (p === current ? view.state : files.get(p).state).doc.toString() : null),
    setText: (txt, p = current) => { if (p !== current) openFile(p); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: txt } }); },
    output, notify,
    destroy: () => { closeMenus(); view.destroy(); rootEl.remove(); },
  };
}

// The Shell's file system (a Map of path -> {type, content}) seen through the adapter createVsCode expects.
export function shellFs(sh) {
  const HOME = "/home/student";
  const ok = (p) => sh.writable(p);
  return {
    list: (dir) => sh.children(dir).map((name) => ({ name, dir: sh.isDir(dir === "/" ? "/" + name : `${dir}/${name}`) })),
    read: (p) => (sh.isFile(p) ? sh.node(p).content || "" : null),
    isDir: (p) => sh.isDir(p), isFile: (p) => sh.isFile(p),
    write: (p, text) => {
      if (!ok(p)) return `Failed to save '${p.split("/").pop()}': Insufficient permissions. Select 'Retry as Sudo' to retry as superuser. (In this practice copy: files outside ${HOME} need sudo in the terminal.)`;
      if (!sh.isDir(parentOf(p))) return `Unable to write file '${p}' (Unknown (FileSystemError): Error: ENOENT: no such file or directory)`;
      const old = sh.node(p);
      sh.fs.set(p, { type: "f", mode: old && old.mode ? old.mode : "rw-rw-r--", content: text });
      return null;
    },
    mkdir: (p) => { if (!ok(p)) return "Permission denied"; sh.mkdirP(p); return null; },
    remove: (p) => { if (!ok(p)) return "Permission denied"; for (const k of [...sh.fs.keys()]) if (k === p || k.startsWith(p + "/")) sh.fs.delete(k); return null; },
    rename: (a, b) => {
      if (!ok(a) || !ok(b)) return "Permission denied";
      if (sh.fs.has(b)) return `A file or folder ${b.split("/").pop()} already exists at this location.`;
      for (const k of [...sh.fs.keys()].sort()) if (k === a || k.startsWith(a + "/")) { sh.fs.set(b + k.slice(a.length), sh.fs.get(k)); sh.fs.delete(k); }
      return null;
    },
  };
}
