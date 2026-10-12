// Security checks that run without Firebase: input validation, rate limiting, safe URLs,
// file sniffing, webhook signatures, and the callable wrapper's early refusals.
// Run: node test/security-tests.js   (also run by test/run-tests.js)
const assert = require("node:assert");
const crypto = require("node:crypto");
const sec = require("../security");

const throwsCode = async (fn, code) => {
  try { await fn(); } catch (e) { assert.strictEqual(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`); return; }
  assert.fail(`expected an error with code ${code}`);
};

(async () => {
  // ---------- payload / validators ----------
  assert.deepStrictEqual(sec.payload(undefined), {});
  assert.deepStrictEqual(sec.payload(null), {});
  await throwsCode(() => sec.payload("x"), "invalid-argument");
  await throwsCode(() => sec.payload([1, 2]), "invalid-argument");
  await throwsCode(() => sec.payload({ a: "x".repeat(30000) }), "invalid-argument");
  await throwsCode(() => sec.payload({ testId: "W1", __proto__x: 1 }, { keys: ["testId"] }), "invalid-argument");
  assert.deepStrictEqual(sec.payload({ testId: "W1" }, { keys: ["testId"] }), { testId: "W1" });

  assert.strictEqual(sec.docId("W1"), "W1");
  for (const badId of [{}, [], "../users/x", "a/b", "", "x".repeat(41), "users/abc", "a b", null, true])
    await throwsCode(() => sec.docId(badId), "invalid-argument");
  assert.strictEqual(sec.uid("AbCdEf0123456789xyz0"), "AbCdEf0123456789xyz0");
  await throwsCode(() => sec.uid("short"), "invalid-argument");
  await throwsCode(() => sec.uid("abc_def-ghi.jklmnop"), "invalid-argument");
  assert.strictEqual(sec.int(5, { min: 1, max: 9 }), 5);
  assert.strictEqual(sec.int("7", { min: 1, max: 9 }), 7);
  for (const v of [0, 10, 1.5, "1e3", NaN, null, {}, [3]]) await throwsCode(() => sec.int(v, { min: 1, max: 9 }), "invalid-argument");
  assert.strictEqual(sec.oneOf("approved", ["approved", "rejected"]), "approved");
  await throwsCode(() => sec.oneOf({ toString: () => "approved" }, ["approved"]), "invalid-argument");
  assert.strictEqual(sec.str("  a   b  ", { min: 1, max: 10, collapse: true }), "a b");
  assert.strictEqual(sec.str("ab\u0000c", { max: 10 }), "abc");
  await throwsCode(() => sec.str({ a: 1 }, { min: 1 }), "invalid-argument");
  await throwsCode(() => sec.str("x".repeat(11), { max: 10 }), "invalid-argument");
  assert.strictEqual(sec.clip("x".repeat(400), 300).length, 300);
  await throwsCode(() => sec.clip({}), "invalid-argument");
  assert.deepStrictEqual(sec.strList(["arm6", "arm6", "BAD!", 3, "chiku"], { re: /^[a-z0-9_]{2,40}$/ }), ["arm6", "chiku"]);
  assert.deepStrictEqual(sec.strList("arm6", { re: /^[a-z0-9_]{2,40}$/, single: true }), ["arm6"]);
  assert.deepStrictEqual(sec.strList({ $gt: "" }, { re: /^[a-z0-9_]{2,40}$/, single: true }), []);

  // ---------- e-mail keys (same mailbox = same key; compatible with the old ledger keys) ----------
  assert.strictEqual(sec.emailKey("Asha.Rao+2@GoogleMail.com"), sec.emailKey("asharao@gmail.com"));
  assert.notStrictEqual(sec.emailKey("asha.rao@college.edu"), sec.emailKey("asharao@college.edu"));
  const oldKey = (email) => { let [l, d] = String(email).trim().toLowerCase().split("@"); l = (l || "").split("+")[0]; if (d === "googlemail.com") d = "gmail.com"; if (d === "gmail.com") l = l.replace(/\./g, ""); return crypto.createHash("sha256").update(`${l}@${d || ""}`).digest("hex"); };
  for (const e of ["a.b+c@gmail.com", "X@Y.org", "p.q@college.ac.in"]) assert.strictEqual(sec.emailKey(e), oldKey(e));

  // ---------- rate limiter (fake Firestore) ----------
  const store = new Map();
  const fakeDb = {
    doc: (p) => ({ path: p }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
      set: (ref, v) => store.set(ref.path, { ...(store.get(ref.path) || {}), ...v }),
    }),
  };
  const t0 = 1_800_000_000_000;
  for (let i = 0; i < 3; i++) await sec.rateLimit(fakeDb, { name: "deleteMyAccount", who: "uidA", limit: 3, windowSec: 86400, now: t0 + i });
  await throwsCode(() => sec.rateLimit(fakeDb, { name: "deleteMyAccount", who: "uidA", limit: 3, windowSec: 86400, now: t0 + 10 }), "resource-exhausted");
  await sec.rateLimit(fakeDb, { name: "deleteMyAccount", who: "uidB", limit: 3, windowSec: 86400, now: t0 });   // other caller unaffected
  await sec.rateLimit(fakeDb, { name: "deleteMyAccount", who: "uidA", limit: 3, windowSec: 86400, now: t0 + 2 * 86400000 });   // next window
  const docKey = [...store.keys()][0];
  assert(/^rateLimits\/deleteMyAccount_uidA_\d+$/.test(docKey), docKey);
  assert(store.get(docKey).expireAt instanceof Date, "rate-limit documents carry expireAt for the TTL policy");
  await sec.rateLimit(fakeDb, { name: "x", who: "../../users/evil", limit: 5, windowSec: 60, now: t0 });
  assert(![...store.keys()].some((k) => k.includes("..") || k.split("/").length !== 2), "caller ids cannot change the document path");
  // in-memory layer
  let ok = 0;
  for (let i = 0; i < 10; i++) if (sec.memHit("flood", 4, 60, t0)) ok++;
  assert.strictEqual(ok, 4);

  // ---------- client IP (last X-Forwarded-For entry; never stored, only hashed) ----------
  assert.strictEqual(sec.clientIp({ headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" } }), "203.0.113.9");
  assert.strictEqual(sec.ipHash({ headers: { "x-forwarded-for": "203.0.113.9" } }, "s").length, 32);
  assert(!sec.ipHash({ headers: { "x-forwarded-for": "203.0.113.9" } }, "s").includes("203"));

  // ---------- SSRF guard ----------
  const good = ["https://www.youtube.com/watch?v=abc", "https://drive.google.com/file/d/x/view", "https://youtu.be/xyz"];
  const badUrls = ["http://www.youtube.com/", "https://localhost/", "https://127.0.0.1/", "https://169.254.169.254/computeMetadata/v1/",
    "https://metadata.google.internal/", "https://10.0.0.5/", "https://192.168.1.1/", "https://[::1]/", "https://2130706433/",
    "https://0x7f000001/", "https://user:pass@example.com/", "https://example.com:8443/", "javascript:alert(1)", "file:///etc/passwd",
    "https://intranet/", "https://printer.local/", "https://8.8.8.8/", "ftp://example.com/", "https://" + "a".repeat(300) + ".com/"];
  for (const u of good) assert(sec.isSafePublicUrl(u), `should allow ${u}`);
  for (const u of badUrls) assert(!sec.isSafePublicUrl(u), `should refuse ${u}`);
  assert(!sec.isSafePublicUrl("https://evil.com/", { allowHosts: ["youtube.com"] }));
  assert(sec.isSafePublicUrl("https://m.youtube.com/x", { allowHosts: ["youtube.com"] }));

  // ---------- file sniffing ----------
  assert.strictEqual(sec.sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "image/jpeg");
  assert.strictEqual(sec.sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), "image/png");
  assert.strictEqual(sec.sniffImage(Buffer.from("<html><script>")), null);
  assert.strictEqual(sec.sniffImage(null), null);
  const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64")}`;
  assert(sec.dataUrlImageOk(png, 1000));
  assert(!sec.dataUrlImageOk(`data:image/png;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`, 1000));
  assert(!sec.dataUrlImageOk(png.replace("image/png", "image/jpeg"), 1000));
  assert(!sec.dataUrlImageOk(png, 3));

  // ---------- webhook HMAC helper ----------
  const body = Buffer.from('{"id":"evt_1"}');
  const now = 1_800_000_000_000, ts = Math.floor(now / 1000);
  const sig = crypto.createHmac("sha256", "s3cret").update(Buffer.concat([Buffer.from(`${ts}.`), body])).digest("hex");
  assert(sec.verifyHmacSignature(body, `sha256=${sig}`, "s3cret", { timestamp: ts, now }));
  assert(!sec.verifyHmacSignature(body, `sha256=${sig}`, "wrong", { timestamp: ts, now }));
  assert(!sec.verifyHmacSignature(Buffer.from('{"id":"evt_2"}'), `sha256=${sig}`, "s3cret", { timestamp: ts, now }));
  assert(!sec.verifyHmacSignature(body, `sha256=${sig}`, "s3cret", { timestamp: ts, now: now + 3600 * 1000 }), "old signatures are refused");
  assert(!sec.verifyHmacSignature(body, "sha256=abc", "s3cret", { timestamp: ts, now }));
  assert(!sec.verifyHmacSignature(body, "", "s3cret"));
  const plain = crypto.createHmac("sha256", "k").update(body).digest("hex");
  assert(sec.verifyHmacSignature(body, plain, "k"));

  // ---------- page paths for the visitor counter ----------
  assert.strictEqual(sec.pagePath("/lesson.html?id=W1-1#x"), "/lesson.html");
  assert.strictEqual(sec.pagePath("/<script>"), "/other");
  assert.strictEqual(sec.pagePath({}), "/other");

  // ---------- callable wrapper: refusals that happen before any database access ----------
  // Point Firestore at a closed local port so nothing can reach a real project.
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:1";
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-ros2lab";
  const fns = require("../index");
  const callables = Object.entries(fns).filter(([, f]) => f && f.__endpoint && f.__endpoint.callableTrigger);
  assert(callables.length >= 20, "callables found");
  for (const [name, f] of callables) {
    // Every callable refuses junk bodies, and (except the visitor heartbeat) calls without a sign-in.
    await throwsCode(() => f.run({ data: "not an object", auth: null, rawRequest: { headers: {} } }), "invalid-argument");
    if (name !== "heartbeat") await throwsCode(() => f.run({ data: {}, auth: null, rawRequest: { headers: {} } }), "unauthenticated");
  }
  await throwsCode(() => fns.heartbeat.run({ data: { v: "not-hex", p: "/" }, auth: null, rawRequest: { headers: {} } }), "invalid-argument");
  await throwsCode(() => fns.heartbeat.run({ data: { v: "a".repeat(32), p: "/", extra: 1 }, auth: null, rawRequest: { headers: {} } }), "invalid-argument");
  await throwsCode(() => fns.startAttempt.run({ data: { testId: "W1", field: "status" }, auth: { uid: "AbCdEf0123456789xyz0", token: {} }, rawRequest: { headers: {} } }), "invalid-argument");
  console.log(`Security: validators, rate limiter, SSRF guard, file sniffing, HMAC helper and ${callables.length} callables checked.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
