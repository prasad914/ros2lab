// DOM helpers with no Firebase dependency (safe to use anywhere).
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

// Text with **bold** and `code` -> safe DOM fragment.
export function rich(text) {
  const frag = document.createDocumentFragment();
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`|(?<![\w*])\*[^*\s][^*]*?[^*\s]\*(?![\w*])|(?<![\w*])\*[^*\s]\*(?![\w*]))/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) frag.append(el("strong", {}, rich(p.slice(2, -2))));   // **bold**, may hold `code`
    else if (p.startsWith("`") && p.endsWith("`")) frag.append(el("code", { text: p.slice(1, -1) }));
    else if (p.startsWith("*") && p.endsWith("*") && p.length > 2) frag.append(el("em", {}, rich(p.slice(1, -1))));   // *emphasis*
    else frag.append(document.createTextNode(p));
  }
  return frag;
}

// Password box with a Show / Hide button, so people can check what they typed.
export function passwordBox(input) {
  const btn = el("button", { type: "button", class: "pw-eye", "aria-label": "Show password", "aria-pressed": "false", text: "Show" });
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Hide" : "Show";
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    input.focus();
  });
  return el("div", { class: "pw-wrap" }, input, btn);
}

export function toast(msg, ms = 3500) {
  const t = el("div", { class: "toast", role: "status", text: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}


// SVG elements (same style as el()).
const SVGNS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
