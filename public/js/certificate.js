// Public certificate page: shows a signed certificate by its ID, which also proves it is genuine.
import { db, doc, getDoc } from "./fb.js";
import { el } from "./dom.js";
import { renderCertificate } from "./cert-render.js";

const main = document.getElementById("main");
const actions = document.getElementById("actions");
const ID_RE = /^R2L-\d{4}-[A-Z0-9]{10}$/;
const id = (new URLSearchParams(location.search).get("id") || "").trim().toUpperCase();

// The page head (as the prototype's "certificate" view): title, the ID field and Check, on every state of the page.
function head() {
  const input = el("input", { id: "cid", placeholder: "R2L-2026-XXXXXXXXXX", maxlength: "20", value: id, autocomplete: "off", spellcheck: "false" });
  const form = el("form", { class: "lookup verify" },
    el("label", { for: "cid", text: "Certificate ID" }),
    el("div", {}, input, el("button", { class: "btn", type: "submit", text: "Check" })));
  form.addEventListener("submit", (e) => { e.preventDefault(); location.search = `?id=${encodeURIComponent(input.value.trim().toUpperCase())}`; });
  return el("div", { class: "pagehead" }, el("div", { class: "wrap" },
    el("p", { class: "crumbs" }, el("a", { href: "index.html", text: "Home" }), " › Verify a certificate"),
    el("h1", { text: "Verify a certificate" }),
    el("p", { class: "lede", text: "Enter the certificate ID printed at the top right of the certificate, or scan its QR code." }),
    form));
}

function lookup(msg) {
  main.replaceChildren(head(), msg ? el("div", { class: "wrap certpage" }, el("p", { class: "status err", text: msg })) : null);
}

(async () => {
  if (!id) return lookup("");
  if (!ID_RE.test(id)) return lookup("This does not look like a ROS2Lab certificate ID.");
  let c;
  try {
    const snap = await getDoc(doc(db, "certificates", id));
    if (!snap.exists()) return lookup(`No certificate with the ID ${id} exists in our records.`);
    c = snap.data();
  } catch { return lookup("Could not check the certificate right now. Please try again."); }

  const url = `${location.origin}/certificate.html?id=${encodeURIComponent(c.certId)}`;
  const issued = c.issuedAt.toDate();
  const until = c.validUntil ? c.validUntil.toDate() : new Date(new Date(issued).setFullYear(issued.getFullYear() + 2));
  const d = (x) => x.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const valid = until.getTime() > Date.now();
  document.title = `${c.name}: ROS2Lab certificate`;

  const li = new URL("https://www.linkedin.com/profile/add");
  Object.entries({ startTask: "CERTIFICATION_NAME", name: c.course, organizationName: "ROS2Lab", issueYear: issued.getFullYear(), issueMonth: issued.getMonth() + 1,
    expirationYear: until.getFullYear(), expirationMonth: until.getMonth() + 1, certUrl: url, certId: c.certId })
    .forEach(([k, v]) => li.searchParams.set(k, String(v)));
  actions.replaceChildren(
    el("button", { class: "btn", type: "button", text: "Download PDF", onclick: () => window.print() }),
    el("a", { class: "btn btn-white white", href: li.toString(), target: "_blank", rel: "noopener", text: "Add to LinkedIn" }),
    el("button", { class: "btn btn-white white", type: "button", text: "Copy link", onclick: async (e) => {
      try { await navigator.clipboard.writeText(url); e.target.textContent = "Link copied"; } catch { prompt("Copy this link:", url); }
    } }));
  main.replaceChildren(head(), el("div", { class: "wrap certpage" },
    el("p", { class: `status ${valid ? "" : "err"}` },
      el("strong", { text: valid ? "Genuine and valid. " : "Genuine, but expired. " }),
      valid ? `Issued by ROS2Lab to ${c.name} on ${d(issued)}, valid until ${d(until)}.` : `Issued by ROS2Lab to ${c.name} on ${d(issued)}; it expired on ${d(until)}.`),
    actions,
    el("div", { class: "wrapc" }, renderCertificate(c, { verifyUrl: url })),
    el("p", { class: "hint", text: "To save as PDF, press Download PDF and choose Save as PDF (landscape)." })));
})();
