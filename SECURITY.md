# What ROS2Lab protects, and how far that goes

## Files stay on the site

Students work in a practice workspace that lives in their browser tab. Nothing in the student pages writes a file to
the student's computer:

- No download, export or "save as" anywhere in the terminal, VS Code, RViz, Gazebo or the lessons. The only file
  downloads on the site are for instructors (admin page: registration CSV, project text, certificate image) and the
  student's own certificate.
- Copy, cut and drag out of the terminal and the VS Code editor are blocked (the terminal says why). Paste into the
  workspace editor is blocked too, so work is typed, not pasted (the Python practice page allows paste).
- The VS Code editor shows a faint watermark with the signed-in student's email, so screenshots of course code carry
  their name.

## Real-hardware code needs a license

- Inside ROS2Lab, connecting a real robot (rosbridge from the RViz page, or launching `<robot>_bringup` with
  `hardware_type:=real`, `real.launch.py` or a maker's driver in the terminal) is refused until the course
  administrator approves a hardware license
  (`requestHardwareLicense` / `adminDecideHardwareLicense`, Firestore `hardwareLicenses/{uid}`, readable only by its
  owner and admins). Mock hardware and Gazebo never need one. Packages that a student retypes on their own Ubuntu
  computer cannot be locked by a website: there the license is a course rule, backed by the hidden driver source.
- The C++ driver (`ros2lab_hardware` src/include/test) and the ESP32 / Arduino firmware are **not** in the public
  website. The Cloud Function `getHardwareSources` sends them only to signed-in, approved course members with an
  approved, unexpired hardware license (or instructors), stamps each file with the student's email, and logs every
  read in `auditLog`. Everyone else sees a short note in place of those files.
  Rebuild the bundle with `node tools/embed-packages.mjs` after changing `hardware/`, then deploy hosting and functions.

## The limits (please read)

A web page cannot fully stop a determined user from keeping what it shows: anything displayed can be photographed
or retyped, and browser developer tools can read whatever the page has loaded. The measures above make copying slow,
traceable and against the rules; they are not DRM. Keep anything that must never leave your hands (keys, credentials,
unreleased solutions) out of what the site sends to students, which is why the hardware sources are served per
license instead of with the page.

## Reporting

Report a security problem to the course administrator (the contact on the site's Privacy page), not in a public forum.

## How the website and the server are protected (V22)

The site is Firebase: static pages (Hosting), Firestore (database), Storage (ID card photos, only in
`id-card` mode), Cloud Functions (server code) and Firebase Authentication. There is no SQL database
and no webhook, so "SQL injection" and "webhook signatures" are covered by their Firebase equivalents.

**Who may read and change what (server-side, never the page).**
- `firestore.rules` and `storage.rules` are the row-level security: default deny, every document
  readable only by its owner and/or instructors. Students can write only their own profile details,
  consent and lesson progress, with field lists and limits; `status`, approval, registration counts,
  `returningAfterDeletion`, scores, attempts, projects, certificates and licenses are written only by
  Cloud Functions. Instructor collections (`auditLog`, `deletedAccounts`, `presence`, `visitorDays`)
  are admin-read, server-write. `rateLimits` and `regLedger` are server-only.
- "Admin" is a custom claim set by the server (`beforesignedin`, for verified emails in
  `functions/config.js` `ADMIN_EMAILS`). Every instructor action is a Cloud Function that checks the
  claim again (`requireAdmin`); hiding the admin page is not the protection.
- Every function that takes an id (uid, attemptId, testId) checks that it belongs to the caller or
  that the caller is an instructor.

**Input checks.** All Cloud Functions are created through one wrapper (`callable()` in
`functions/index.js`): the body must be a plain JSON object under a size limit with only the expected
keys, calls without a sign-in are refused, and a rate limit applies. Each field is then read through
`functions/security.js` (typed, length-limited strings, whitelisted enums, ids matched by strict
patterns), so no user input ever becomes a document path, field path or collection name.

**Rate limits.** Per account and function (`RATE_LIMITS` in `functions/config.js`, e.g. 120 answers a
minute, 3 account deletions a day, 5 re-registration requests a day), counted in Firestore
(`rateLimits/…`, shared by all server instances) plus an in-memory first layer. Over the limit the
caller gets "Too many requests". The anonymous visitor counter is limited per IP address in memory only.

**App Check (optional, recommended).** Put a reCAPTCHA Enterprise site key in
`public/js/firebase-config.js` (`RECAPTCHA_ENTERPRISE_SITE_KEY`); the pages then send App Check tokens.
After a few days of clean metrics set `ENFORCE_APP_CHECK = true` in `functions/config.js`. Without a key
the site works as before.

**Browser security.** Pages build the screen with DOM methods (`el()`, `textContent`), never by pasting
names, emails or student text into HTML. `firebase.json` sends a strict Content-Security-Policy
(no `'unsafe-eval'`, no inline scripts or inline event handlers, `object-src 'none'`,
`frame-ancestors 'none'`), HSTS with preload, `nosniff`, `X-Frame-Options: DENY`, COOP/CORP,
`Referrer-Policy` and a restrictive `Permissions-Policy`. `'wasm-unsafe-eval'` stays (WebAssembly for
Python practice and the physics engine). `'unsafe-inline'` stays for styles only (style attributes in the
pages). Trusted Types are not enforced: the Firebase SDK and the 3D/editor code still assign HTML.
- Cloud Functions accept browser calls only from the site's own addresses (`ALLOWED_ORIGINS` in
  `functions/config.js`). Calls carry the sign-in token in a header, never in a cookie, so there is no
  cookie session to forge (no classic CSRF).
- The Firebase web `apiKey` in `firebase-config.js` is public by design (it only identifies the
  project); security comes from the rules, the server checks and App Check. Optionally restrict the key
  to your domains in Google Cloud console → APIs & Services → Credentials (HTTP referrers).
- No source maps are published (`**/*.map` is ignored, no `sourceMappingURL` comments).

**Passwords and sessions.** Firebase Authentication stores only a salted scrypt hash; our code never
stores or logs a password. The registration page asks for 10+ characters with letters and numbers and
refuses common passwords or ones containing the name or email; turn on the matching policy in the console
(see below) so password resets follow it too. The sign-in session is kept by the Firebase SDK in
IndexedDB (students stay signed in; "Log out" ends it). Our code keeps no tokens, roles or personal data
in `localStorage`/`sessionStorage` (only harmless preferences, a project draft on the student's own device,
and an anonymous visitor id). Deleting an account needs a log-in from the last 30 minutes.

**Uploads.** ID card photos: only `idcards/<own uid>/idcard.jpg`, JPEG, 1 KB–2 MB, only while pending or
rejected; only instructors can view them. The server re-checks the size and the real file type from the
first bytes and deletes anything that is not a JPEG. The instructor's signature image is checked the same
way (PNG/JPEG bytes).

**Outbound requests (SSRF).** The server makes no requests to addresses supplied by users. The one link
students submit (project video) is only stored and shown, and must be a public `https://` address (no
local or private network addresses, no cloud metadata server). Any future server-side fetch must pass
`isSafePublicUrl()` in `functions/security.js` with a host allowlist.

**Secrets.** There are no signing keys or API secrets in the repository. If one is ever needed (for
example a webhook secret), keep it in Secret Manager (`defineSecret` in Cloud Functions), never in code
or in `public/`. `functions/security.js` has a timing-safe HMAC-SHA256 verifier ready for a future webhook.
The robot firmware generator makes a new random Wi-Fi password for each robot; the example
`robot_config.h` password must be changed before use.

**Logs.** Server logs contain uids and counts only, never emails, tokens or ID card data.

**Deleted accounts and returning students.** When a student deletes their account (or an instructor
does), the server first writes `deletedAccounts/<hash of the email>`: email, name, uid, registration and
deletion dates, who deleted it and the reason. If the same email (any sign-in method) registers again,
the server marks the registration "returning after deletion" and never approves it automatically, even
in `auto` mode; it waits in Instructor → Registrations.

**Visitor counter.** Each page sends an anonymous heartbeat (a random id kept in the browser, the page
path, whether someone is signed in) when it opens and every 60 s while visible. No IP address, name or
device detail is stored; entries expire after two days.

**Checks.** `node tools/security-check.mjs` (static checks: headers, CSP, source maps, HTML sinks,
secrets, browser storage, wrapper use, default-deny rules) and `cd functions && npm test`.

### Console steps after deploying V22
1. Deploy: `firebase deploy --only hosting,functions,firestore:rules,firestore:indexes` (add `,storage`
   only if Storage is set up, i.e. in `id-card` mode).
2. Firestore TTL policies (Firestore → Time-to-live → Create policy), field `expireAt` for collection
   groups `presence` and `rateLimits`. Or:
   `gcloud firestore fields ttls update expireAt --collection-group=presence --enable-ttl` (same for `rateLimits`).
3. Authentication → Settings → Password policy: enforce, minimum length 10, require a numeric character.
4. Optional: App Check with reCAPTCHA Enterprise (key into `firebase-config.js`, later
   `ENFORCE_APP_CHECK = true`, then Enforce for Firestore and Storage).
5. Optional: restrict the browser API key to your domains (HTTP referrers).
6. HSTS preload: the header already asks for it; submitting `ros2lab.com` at hstspreload.org is optional
   and hard to undo (every subdomain must then serve HTTPS).
