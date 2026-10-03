// Screenshot deterrent for course pages. No Firebase here.
import { el } from "./dom.js";

// No website can fully stop screenshots (phones and other cameras always can), but this
// blanks the page for common screenshot keys and while the window is not in front
// (snipping tools, screen recorders and app switchers take focus first).
export function screenGuard(report = () => {}) {
  if (document.querySelector(".shield")) return;
  const shield = el("div", { class: "shield", role: "dialog", "aria-modal": "true", hidden: true },
    el("div", { class: "shield-box" }, el("strong", { text: "Course content hidden" }),
      el("p", { text: "Screenshots and screen recording are not allowed on course pages. Click or tap here to continue learning." })));
  document.body.append(shield);
  let timer = null;
  const show = (why, ms) => {
    clearTimeout(timer);
    shield.hidden = false; document.body.classList.add("shielded");
    if (why) report(why);
    if (ms) timer = setTimeout(hide, ms);
  };
  const hide = () => { if (!document.hasFocus()) return; shield.hidden = true; document.body.classList.remove("shielded"); };
  const wipeClipboard = () => { try { navigator.clipboard && navigator.clipboard.writeText(" ").catch(() => {}); } catch { /* ignore */ } };
  const keys = (e) => {
    const k = (e.key || "").toLowerCase();
    const snip = k === "printscreen" || e.code === "PrintScreen" ||
      (e.metaKey && e.shiftKey && ["s", "3", "4", "5", "6"].includes(k)) ||   // Windows Snip (Win+Shift+S), macOS Cmd+Shift+3/4/5
      (e.ctrlKey && e.shiftKey && ["s"].includes(k) && e.altKey);
    if (!snip) return;
    e.preventDefault(); wipeClipboard(); show("screenshot", 2500);
  };
  document.addEventListener("keydown", keys, true);
  document.addEventListener("keyup", (e) => { if ((e.key || "").toLowerCase() === "printscreen") { wipeClipboard(); show("screenshot", 2500); } }, true);
  window.addEventListener("blur", () => show(null));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") show(null); });
  window.addEventListener("focus", () => setTimeout(hide, 150));
  shield.addEventListener("click", () => { shield.hidden = true; document.body.classList.remove("shielded"); });
}

