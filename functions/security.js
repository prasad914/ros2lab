// Shared server-side security helpers: input validation, rate limiting, safe URLs,
// file-type sniffing and (for future webhooks) HMAC signature checks.
// Pure Node.js; the Firestore handle is passed in, so everything here can be unit-tested
// without Firebase (see test/security-tests.js).
const crypto = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");

// ---------------------------------------------------------------------------
// 1) Input validation. Every callable reads its input ONLY through these, so a
//    student cannot send objects where strings are expected, choose a field path
//    or collection name, or send huge payloads. Firestore document ids built from
//    input are always matched against a strict pattern first.
// ---------------------------------------------------------------------------
const bad = (msg) => new HttpsError("invalid-argument", msg || "Bad request.");

const RE = {
  uid: /^[A-Za-z0-9]{10,40}$/,            // Firebase Auth uids
  docId: /^[A-Za-z0-9_-]{1,40}$/,          // test ids, attempt ids (Firestore auto ids are 20 chars)
  robot: /^[a-z0-9_]{2,40}$/,
  visitor: /^[a-f0-9]{32}$/,               // anonymous visitor id made by the browser (16 random bytes, hex)
};

// The request body must be a plain JSON object (or empty) and not larger than maxBytes.
function payload(data, { maxBytes = 20000, keys = null } = {}) {
  if (data == null) return {};
  if (typeof data !== "object" || Array.isArray(data)) throw bad();
  let size;
  try { size = Buffer.byteLength(JSON.stringify(data)); } catch { throw bad(); }
  if (size > maxBytes) throw bad("The request is too large.");
  if (keys) for (const k of Object.keys(data)) if (!keys.includes(k)) throw bad();
  return data;
}

// Text: must be a string (numbers are accepted and converted), trimmed, length-checked.
function str(v, { min = 0, max = 300, trim = true, collapse = false, re = null, msg = null, optional = false } = {}) {
  if (v == null || v === "") {
    if (optional || min === 0) return "";
    throw bad(msg);
  }
  if (typeof v !== "string" && typeof v !== "number") throw bad(msg);
  let s = String(v);
  if (trim) s = s.trim();
  if (collapse) s = s.replace(/\s+/g, " ");
  // Control characters (except tab and newlines) never belong in our text fields.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (s.length < min || s.length > max) throw bad(msg);
  if (re && !re.test(s)) throw bad(msg);
  return s;
}
// Like str() but cuts long text instead of refusing it (for free-text notes).
function clip(v, max = 300) {
  if (v == null) return "";
  if (typeof v !== "string" && typeof v !== "number") throw bad();
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
function int(v, { min = -Infinity, max = Infinity, msg = null } = {}) {
  const n = typeof v === "string" && /^-?\d{1,9}$/.test(v.trim()) ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) throw bad(msg);
  return n;
}
function oneOf(v, list, msg = null) {
  if (typeof v !== "string" || !list.includes(v)) throw bad(msg);
  return v;
}
const uid = (v) => str(v, { min: 10, max: 40, re: RE.uid });
const docId = (v, msg) => str(v, { min: 1, max: 40, re: RE.docId, msg });
function strList(v, { re, maxItems = 20, single = false } = {}) {
  const arr = Array.isArray(v) ? v : single && v != null ? [v] : [];
  return [...new Set(arr.filter((x) => typeof x === "string").map((x) => x.trim()).filter((x) => re.test(x)))].slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// 2) E-mail keys. "asha.rao+2@gmail.com" and "asharao@gmail.com" are the same mailbox.
//    Used for the registration ledger and the deleted-accounts list (document id = hash,
//    so no e-mail address ever appears in a document path or URL).
// ---------------------------------------------------------------------------
function normalEmail(email) {
  let [local, domain] = String(email || "").trim().toLowerCase().split("@");
  local = (local || "").split("+")[0];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain || ""}`;
}
const emailKey = (email) => crypto.createHash("sha256").update(normalEmail(email)).digest("hex");

// ---------------------------------------------------------------------------
// 3) Rate limiting.
//    Layer 1: an in-memory counter per server instance (free, stops floods early).
//    Layer 2: a Firestore counter shared by all instances, one document per
//             (function, caller, time window): rateLimits/{fn}_{who}_{window}.
//             Documents carry expireAt, so a Firestore TTL policy deletes them.
// ---------------------------------------------------------------------------
const mem = new Map();
function memHit(key, limit, windowSec, now = Date.now()) {
  const bucket = Math.floor(now / (windowSec * 1000));
  const k = `${key}|${bucket}`;
  const n = (mem.get(k) || 0) + 1;
  mem.set(k, n);
  if (mem.size > 20000) {               // forget old windows
    for (const old of mem.keys()) { if (!old.endsWith(`|${bucket}`)) mem.delete(old); if (mem.size < 10000) break; }
  }
  return n <= limit;
}
const tooMany = (windowSec) => new HttpsError("resource-exhausted",
  `Too many requests. Please wait ${windowSec >= 3600 ? (windowSec >= 86400 ? "until tomorrow" : "an hour") : windowSec > 60 ? "a few minutes" : "a minute"} and try again.`);

// who: a uid, or a hashed IP address. Throws resource-exhausted when over the limit.
async function rateLimit(db, { name, who, limit, windowSec, now = Date.now(), store = true }) {
  const key = `${name}_${String(who).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64)}`;
  // The in-memory layer allows a little more than the shared one, so it only catches floods.
  if (!memHit(key, Math.ceil(limit * 1.5) + 2, windowSec, now)) throw tooMany(windowSec);
  if (!store || !db) return;
  const bucket = Math.floor(now / (windowSec * 1000));
  const ref = db.doc(`rateLimits/${key}_${bucket}`);
  const expireAt = new Date((bucket + 1) * windowSec * 1000 + 3600 * 1000);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const n = snap.exists ? Number(snap.data().count) || 0 : 0;
    if (n >= limit) throw tooMany(windowSec);
    tx.set(ref, { count: n + 1, fn: name, expireAt }, { merge: true });
  });
}

// The caller's IP address, for limits on calls without an account. Cloud Run appends the
// real client address as the LAST X-Forwarded-For entry (earlier entries can be typed by
// the client), so the last one is used. Only a salted hash is ever stored, never the IP.
function clientIp(rawRequest) {
  if (!rawRequest) return "unknown";
  const h = rawRequest.headers || {};
  const xff = String(h["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : String(rawRequest.ip || (rawRequest.socket && rawRequest.socket.remoteAddress) || "unknown");
}
function ipHash(rawRequest, salt) {
  const day = new Date().toISOString().slice(0, 10);      // the hash changes every day
  return crypto.createHmac("sha256", String(salt || "ros2lab")).update(`${day}|${clientIp(rawRequest)}`).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// 4) Safe outbound URLs (SSRF guard). The server code makes NO outbound requests to
//    user-supplied addresses today. Links students submit (project video) are only
//    stored and shown to the instructor; they are still checked here so that a link
//    can never point at the instructor's local network or a cloud metadata server.
//    Any future server-side fetch of a user URL MUST pass isSafePublicUrl() first and
//    should use an allowlist of hosts.
// ---------------------------------------------------------------------------
function privateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224 || (a === 198 && (b === 18 || b === 19));
}
function isSafePublicUrl(value, { allowHosts = null, maxLength = 300 } = {}) {
  if (typeof value !== "string" || !value || value.length > maxLength) return false;
  let u;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".")) return false;                                    // "localhost", "intranet"
  if (host.startsWith("[") || host.includes(":")) return false;                      // IPv6 literals
  if (/^\d+$/.test(host) || /^0x/i.test(host) || privateIPv4(host)) return false;    // decimal / hex / private IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;                            // no bare IP addresses at all
  if (/(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/.test(host)) return false;
  if (host === "metadata.google.internal" || host === "metadata") return false;
  if (allowHosts && !allowHosts.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 5) File type by content ("magic bytes"), not by the name or the declared type.
// ---------------------------------------------------------------------------
function sniffImage(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  return null;
}
// data:image/png;base64,... -> checks that the bytes really are that image type.
function dataUrlImageOk(dataUrl, maxBytes) {
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return false;
  const bytes = Buffer.from(m[2], "base64");
  return bytes.length > 0 && bytes.length <= maxBytes && sniffImage(bytes) === m[1];
}

// ---------------------------------------------------------------------------
// 6) Webhook signatures. ROS2Lab has NO webhooks today. If one is ever added (payment
//    provider, form service...), it must be an onRequest function that:
//      - reads the RAW body (req.rawBody), never a re-serialised JSON object,
//      - keeps the shared secret in Secret Manager: defineSecret("WEBHOOK_SECRET"),
//      - calls verifyHmacSignature(req.rawBody, req.get("X-Signature"), secret.value(),
//        { timestamp: req.get("X-Timestamp") }) and returns 401 when it is false,
//      - treats every event id as single-use (store processed ids) to stop replays.
// ---------------------------------------------------------------------------
function verifyHmacSignature(rawBody, signature, secret, { timestamp = null, toleranceSec = 300, now = Date.now(), prefix = "sha256=" } = {}) {
  if (!secret || !signature || rawBody == null) return false;
  let signed = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  if (timestamp != null) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSec) return false;
    signed = Buffer.concat([Buffer.from(`${ts}.`), signed]);
  }
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  const given = String(signature).startsWith(prefix) ? String(signature).slice(prefix.length) : String(signature);
  const a = Buffer.from(expected, "utf8"), b = Buffer.from(given.toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// A page path for the visitor counter: path only (no query, no fragment), known characters only.
function pagePath(v) {
  const s = typeof v === "string" ? v.split(/[?#]/)[0].slice(0, 80) : "";
  return /^\/[A-Za-z0-9/_.-]*$/.test(s) ? s : "/other";
}

module.exports = {
  RE, bad, payload, str, clip, int, oneOf, uid, docId, strList,
  normalEmail, emailKey, rateLimit, memHit, clientIp, ipHash,
  isSafePublicUrl, sniffImage, dataUrlImageOk, verifyHmacSignature, pagePath,
};
