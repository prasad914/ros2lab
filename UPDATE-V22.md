# ROS2Lab update V22: security hardening, visitor counter, deleted accounts, playground cleanup

V22 sits on top of V21 (V20 + the V21 update you deployed). Lessons, tests and `content/` are unchanged.
Robot workspaces from the makers' GitHub repositories, Nav2 and MoveIt 2 come in V23.

## Deploy

1. Copy the files of this update over the project (same paths).
2. **Delete the files that were removed**. Copying over does not delete them. Run `bash tools/v22-remove-old-files.sh`
   from the project folder, or delete them by hand (list below).
3. `cd functions && npm install && cd ..`
4. `firebase deploy --only hosting,functions,firestore:rules,firestore:indexes,storage`
   (leave out `storage` if you don't use id-card mode).
5. In the Firebase / Google Cloud console:
   - **Firestore → TTL policies:** add a policy on the field `expireAt` for the collection groups `presence` and
     `rateLimits` (old visitor and rate-limit entries are then deleted automatically).
   - **Authentication → Settings → Password policy:** enforce; minimum length 10; require a number.
   - Optional, recommended: **App Check** with a reCAPTCHA Enterprise key. Put the site key in
     `public/js/firebase-config.js` (`RECAPTCHA_ENTERPRISE_SITE_KEY`). After a few days of clean metrics set
     `ENFORCE_APP_CHECK = true` in `functions/config.js`, deploy functions, and press Enforce for Firestore and Storage.
   - Optional: restrict the browser API key to your domains (APIs & Services → Credentials → HTTP referrers).
   - If you add a new domain, add it to `ALLOWED_ORIGINS` in `functions/config.js` (now: www.ros2lab.com,
     ros2lab.com, ros2lab.web.app, ros2lab.firebaseapp.com and preview channels).
6. Before going live, open a preview channel (`firebase hosting:channel:deploy v22`). Check sign-in, registration, a
   test, the Python practice and the Simulator there.

## Security (details in SECURITY.md)

| Your checklist | What V22 does |
|---|---|
| SQL injection | There is no SQL database. The Firestore equivalent is covered: every Cloud Function checks the type and length of each field and accepts only known keys and values (`functions/security.js`). User input never becomes a document path. |
| Cross-site scripting | Pages build the screen with `textContent`/DOM methods. The Content-Security-Policy no longer allows `'unsafe-eval'` and blocks inline scripts and inline event handlers (`script-src-attr 'none'`). Python practice was tested working under the new policy. |
| CSRF | Calls carry the sign-in token in a header, not a cookie, so there is no cookie session to forge. Cloud Functions also accept browser calls only from your own domains. |
| File upload validation | ID card photos are checked by their actual bytes on the server, not only by their declared type: JPEG only, 1 KB–2 MB, own folder only. The signature image is checked the same way. |
| SSRF | The server never fetches user-supplied addresses. The project video link must be a public `https://` address (no private or local network, no cloud metadata server). |
| Broken object-level authorization | Every function taking an id checks it belongs to the caller or that the caller is an admin. Deleting an account now also removes its hardware licence. |
| Rate limiting | Per account and per function (`RATE_LIMITS` in `functions/config.js`, e.g. 120 answers a minute, 3 account deletions a day). Over the limit: "Too many requests". |
| Password hashing | Firebase Authentication stores only a salted scrypt hash. Registration now requires 10+ characters with letters and numbers, and refuses common passwords and ones containing the name or email. |
| Multi-factor authentication | Skipped for now, as you decided. |
| Server-side permissions | Admin actions run only in Cloud Functions that check the admin claim set by the server. |
| RLS | Firestore and Storage rules: default deny, owner or admin only, field lists for what students may write. The new collections are admin-read, server-write. |
| JWT secrets | Firebase signs and checks the sign-in tokens. Nothing in our code decodes tokens by hand. |
| API secrets server-side | No secrets in the repository or in `public/`. The Firebase web `apiKey` is public by design. Future secrets go in Secret Manager (`defineSecret`). |
| Tokens in localStorage | The sign-in session is kept by the Firebase SDK in IndexedDB. Our code stores no tokens, roles or personal data in localStorage. |
| Default credentials | The robot firmware now refuses to build with the example Wi-Fi password `change-this-password`, or with one shorter than 8 characters. The generator already makes a random one per robot. |
| CORS / security headers | CORS limited to your domains. HSTS with `preload`, wider Permissions-Policy, `Origin-Agent-Cluster`, `media-src` and `manifest-src` added to the strict CSP. |
| Webhook signatures | The site has no webhooks. A timing-safe HMAC-SHA256 verifier is ready in `functions/security.js` for when you add one. |
| Exposed source maps | None are published. The `sourceMappingURL` comment in the vendored physics engine is removed. |
| Sensitive data in logs | Server logs hold uids and counts only, never emails, tokens or ID card data. |
| Vulnerable dependencies | firebase-admin 14.5.0 and firebase-functions 7.4.0 are the current releases. The web SDK stays on 12.19.0, the latest 12.x (13.0.0 is a week old and changes only AI Logic, which the site doesn't use). Pyodide 314.0.7 is current. |

New checks you can run: `cd functions && node test/run-tests.js` (now includes `test/security-tests.js`) and
`node tools/security-check.mjs`.

## Admin screen

- **Live visitors:** how many people are on the site now (last 2 minutes) and unique visitors today. The strip refreshes
  every 30 seconds. Each open, visible page sends an anonymous signal about once a minute: a random id with no name,
  the page path, and whether the visitor is signed in. No IP address is stored, and entries expire after two days. The
  privacy page explains this.
- **Deleted accounts:** a separate tab with its own link (`admin.html#deleted`). It shows email, name, dates, who
  deleted the account and the reason, with a CSV download. `admin.html#students` links straight to the registered
  students.
- **Admins can delete an account** (with a reason). The account is recorded in Deleted accounts in the same way.
- **Students who come back after deleting their account:** if the same email registers again (email or Google
  sign-in), the server never approves it automatically. The registration waits for you and is labelled "Returning
  after deletion on <date>". You approve or reject it as usual. Students see a short notice saying so.
- Deleting your own account now needs a log-in from the last 30 minutes. Students can give a reason.

## Playground

- The six robot-mission games (Lidar Detective, Warehouse Run, Frame Builder, Drone Hover, Controller Bring-up, Pick
  and Place) have been removed, as you asked. So have the two that were being prepared (QoS Detective, Turn the
  Corner).
- The six remaining games are redesigned, each with its own look:
  - **Paths:** a transit map of the folder tree.
  - **Radio:** tuned radio dials for topics.
  - **Pizza:** order tickets on a kitchen rail, for services and actions.
  - **Topic, Service or Action?:** index cards sorted into three trays.
  - **Source It:** an Ubuntu terminal next to a stack of layers and a `~/.bashrc` scroll.
  - **TurtleSim:** the turtlesim window next to a notebook of missions.
- Winning a game presses a stamp, and a badge card collects them.
- Lesson puzzles and the animation frames got the same treatment. Game names, links and lesson embeds are unchanged.
- Fixed: opening a "Concept lab" link showed the publish/subscribe animation instead of the chosen one.
- The messages in Source It and TurtleSim now match what ROS 2 Jazzy prints.

## Robotic Models Simulator and Gazebo

- **Robots open in the same window.** Each robot still has its own workspace with only its own packages; the
  breadcrumb takes you back to the list.
- **Pictures for the course robots** (arm3, arm6, chiku, quadruped and the rest) are now shipped, so the list no longer
  draws them in the browser. All 32 pictures were re-rendered with better framing.
- **Collisions added to the course robots** that lacked them: hexapod legs, humanoid limbs, Ackermann steering
  links, quadcopter motors and camera. They now touch the world as in Gazebo.
- **Physics fixes:**
  - A legged robot or drone spawned at ground level can turn again.
  - A robot spawned partly in the ground is pushed out.
  - On a mobile manipulator, the arm's joints are no longer mistaken for wheels.
- `tools/check-gazebo.mjs` now also warns about invalid inertia, as Gazebo's own check does.
- Verified with the real course files: Chiku (ros2_control, `TwistStamped` on `/diff_drive_controller/cmd_vel`) stops
  at the wall at x = 3.64 m, and TurtleBot3 (Gazebo DiffDrive) at 3.85 m. All 32 robots build, launch and run with no
  errors (`node tests/sweep.mjs`).

## Files removed in V22 (delete them from your project)

```
public/js/games/lidar.js        public/css/games/lidar.css
public/js/games/warehouse.js    public/css/games/warehouse.css
public/js/games/tftree.js       public/css/games/tftree.css
public/js/games/hover.js        public/css/games/hover.css
public/js/games/controllers.js  public/css/games/controllers.css
public/js/games/pickplace.js    public/css/games/pickplace.css
tests/games-lidar-hover.mjs  tests/games-warehouse-tftree.mjs  tests/games-controllers-pickplace.mjs
```

## Developer checks

With the site on http://localhost:8080:

- `node tests/sweep.mjs`
- `node tests/physics.test.mjs`
- `node tests/wall.mjs chiku control 40`
- `node tests/wall-term.mjs`
- `node tests/games-basics.mjs`
- `node tests/games-layout.mjs`
- `node tests/home-gazebo.mjs`
- `node tools/check-gazebo.mjs`
- `cd functions && node test/run-tests.js`
- `node tools/security-check.mjs`
