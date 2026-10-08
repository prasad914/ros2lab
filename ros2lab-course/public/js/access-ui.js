// Access-period widgets shared by "My course" and "My account".
import { call } from "./fb.js";
import { el, toast, friendlyError, fmtDate, accessInfo, fmtDay, regsUsed, MAX_REGISTRATIONS } from "./common.js";
import { CONTACT_EMAIL } from "./firebase-config.js";

const MAX_EXTENSION_DAYS = 30;

// Round countdown: days left inside a ring that empties as the days pass.
export function countdownRing(info) {
  const r = 52, c = 2 * Math.PI * r;
  const left = info.lifetime ? 1 : Math.max(0, 1 - info.usedPct / 100);
  const NS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 120 120"); s.setAttribute("class", "ring"); s.setAttribute("aria-hidden", "true");
  const mk = (cls, extra = {}) => { const n = document.createElementNS(NS, "circle"); n.setAttribute("cx", "60"); n.setAttribute("cy", "60"); n.setAttribute("r", String(r)); n.setAttribute("class", cls); for (const [k, v] of Object.entries(extra)) n.setAttribute(k, v); return n; };
  s.append(mk("ring-bg"), mk(`ring-fg${!info.lifetime && info.daysLeft <= 10 ? " low" : ""}`, { "stroke-dasharray": `${c * left} ${c}`, transform: "rotate(-90 60 60)" }));
  const big = info.lifetime ? "∞" : String(info.daysLeft);
  const small = info.lifetime ? "lifetime" : info.daysLeft === 1 ? "day left" : "days left";
  return el("div", { class: "ring-box" }, s, el("div", { class: "ring-text" }, el("b", { text: big }), el("span", { text: small })));
}

// The access card: ring + dates + plain-language rule.
export function accessCard(profile, claims) {
  const info = accessInfo(profile, claims);
  if (!info) return null;
  if (info.lifetime) {
    return el("section", { class: "panel access-card ok" }, countdownRing(info),
      el("div", {}, el("h2", { text: "Lifetime access" }),
        el("p", { text: "You finished every lesson and passed every test in time, so the course stays open for you to revise whenever you like." })));
  }
  const lastDay = info.daysLeft <= 1 && !info.ended;
  return el("section", { class: `panel access-card${info.daysLeft <= 10 ? " warn" : ""}` }, countdownRing(info),
    el("div", {},
      el("h2", { text: info.ended ? "Your access period has ended" : lastDay ? `Last day: about ${info.hoursLeft} hour${info.hoursLeft === 1 ? "" : "s"} left` : `Day ${info.dayNo} of ${info.totalDays}` }),
      el("p", { class: "access-dates" },
        el("span", {}, "Started ", el("b", { text: fmtDay(info.start) })),
        el("span", {}, "Ends ", el("b", { text: fmtDate(new Date(info.until)) })),
        info.extDays ? el("span", { class: "chip going", text: `+${info.extDays} days extra time included` }) : null),
      el("div", { class: "meter wide", title: `${info.usedPct}% of your time used` }, el("span", { style: { width: `${info.usedPct}%` } })),
      el("p", { class: "small muted", style: { margin: "8px 0 0" }, text: "Finish every lesson of Weeks 1 to 6 and score at least 60% in each of their tests before the end date to keep the course for life (Weeks 7 to 9 are optional). If the course is not finished in time, the registration is cancelled automatically and the course materials close." })));
}

// What the student may do about extra time, and the request form.
export function extensionBox(profile, claims, { compact = false } = {}) {
  const info = accessInfo(profile, claims);
  if (!info || info.lifetime) return null;
  const req = profile.extensionRequest || null;
  const first = regsUsed(profile) <= 1;
  const wrap = el("section", { class: "panel ext-box" }, el("h2", { text: "Need more time?" }));
  if (!first) {
    wrap.append(el("p", { text: "This is a re-registration, so it has exactly 60 days. Extra time is not available in a re-registration." }));
    return compact ? null : wrap;
  }
  if (profile.extensionUsed === true || (req && req.status === "approved")) {
    wrap.append(el("p", { class: "notice ok", style: { margin: 0 } }, el("strong", { text: "Extra time approved. " }),
      `${profile.extensionDays || (req && req.days) || ""} days were added to your access period. This was your one extension; no more extra time can be given.`,
      req && req.note ? el("span", {}, el("br"), `Note from the administrator: ${req.note}`) : null));
    return wrap;
  }
  if (req && req.status === "pending") {
    wrap.append(el("p", { class: "notice", style: { margin: 0 } }, el("strong", { text: "Request sent. " }),
      `You asked for extra time on ${fmtDate(req.requestedAt)}. The administrator will approve or refuse it. You keep studying in the meantime.`));
    return wrap;
  }
  if (req && req.status === "rejected") {
    wrap.append(el("p", { class: "notice err", style: { margin: 0 } }, el("strong", { text: "Request for extra time not approved. " }),
      req.note ? `Note from the administrator: ${req.note}. ` : "", "Please finish the course before your end date."));
    return wrap;
  }
  if (info.ended) return null;
  // Eligible: show the rule and a short form.
  const reason = el("textarea", { id: "ext-reason", rows: "3", maxlength: "500", placeholder: "For example: my semester exams run until 20 December, so I need about two more weeks to finish the tests." });
  const count = el("small", { class: "muted", text: "0 / 500" });
  const err = el("p", { class: "notice err", hidden: true, role: "alert" });
  const btn = el("button", { class: "btn", type: "button", text: "Request extra time" });
  reason.addEventListener("input", () => { count.textContent = `${reason.value.trim().length} / 500`; });
  btn.addEventListener("click", async () => {
    const text = reason.value.trim();
    err.hidden = true;
    if (text.length < 15) { err.textContent = "Please explain in at least 15 characters why you need extra time."; err.hidden = false; return; }
    if (!confirm("You can ask for extra time only once. Send this request?")) return;
    btn.disabled = true;
    try { await call("requestExtension")({ reason: text }); toast("Request sent to the administrator.", 5000); setTimeout(() => location.reload(), 1200); }
    catch (e) { err.textContent = friendlyError(e); err.hidden = false; btn.disabled = false; }
  });
  const form = el("div", { class: "ext-form", hidden: compact },
    el("div", { class: "form-row" }, el("label", { for: "ext-reason", text: "Why do you need extra time?" }), reason, count), err, btn);
  wrap.append(...[
    el("p", { text: `You can ask once, in your first registration only, for up to ${MAX_EXTENSION_DAYS} extra days. The administrator approves or refuses the request; extra time is not guaranteed. Ask before your access period ends.` }),
    compact ? el("button", { class: "btn btn-white btn-small", type: "button", text: "Ask for extra time", onclick: (e) => { e.target.remove(); form.hidden = false; reason.focus(); } }) : null,
    form].filter(Boolean));
  return wrap;
}

// Registration history summary (used on My account).
export function registrationFacts(profile) {
  const used = regsUsed(profile);
  const left = Math.max(0, MAX_REGISTRATIONS - Math.max(1, used));
  const rows = [
    ["Registration", used <= 1 ? "First registration" : `Re-registration ${used - 1} of ${MAX_REGISTRATIONS - 1}`],
    ["Re-registrations left", String(left)],
  ];
  return { rows, used, left, contact: CONTACT_EMAIL };
}
