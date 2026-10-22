# ROS2Lab redesign: inventory (Prompt 1, read-only)

Branch `ui-redesign`, created from `fix-v2` at 916af89 on 21 Oct 2026. No site file was changed in this step.

## Which design wins (read this first)

- **The final design is v3.** It has a calm white header with a thin bottom rule and quiet grey links, navy primary buttons, white outlined secondary buttons, 12px rounded cards with light borders, a light footer, and Source Sans 3 / Source Code Pro.
- **The README's opening line is out of date.** `docs/redesign/README.md` line 3 still says "plain white university theme (navy menu band, orange actions)". That describes v1/v2.
- **When README text and the CSS files disagree, the CSS wins.** The CSS files apply in this order, and the later file wins:

  1. `prototype/fixes.css` (expert review fixes)
  2. `prototype/calm.css` (v3 calm layer)
  3. `prototype/type.css` (type and spacing)

**Conflicts already found between the layers.** The resolved value is the one to build:

| Rule | fixes.css | calm.css (wins over fixes) | type.css (wins over both) |
|---|---|---|---|
| Header | navy band | white `.top`, `border-bottom:1px solid var(--rule)` | – |
| `#acct .btn-main` (Register / Log in) | white outline on navy | **navy fill, white text**; `#acct .login` is a navy text link | – |
| `.top :focus-visible` | `#F2A65A` | **`var(--navy)`** (the header is white now) | – |
| `footer h2.fh` colour | white | **`var(--text)`** on a `var(--tint)` footer | – |
| `.navlabel` | 3px navy bottom border | **no border**, `padding-bottom:10px` | – |
| `.steps3 li` | square, white | **10px radius, tint background** | – |
| body type | – | 17px / 1.65 | **17px / 1.7; 16.5px under 640px** |
| hero h1 | – | clamp(36px, 4.6vw, 54px) | **clamp(34px, 4.2vw, 50px)** |

The site-wide focus ring (`:focus-visible` 3px `#13315C`, offset 2px) comes from fixes.css and is not overridden.

Two consequences for the prompts:

- **Prompt U.** "Log in (white outline button, not orange)" is v2. In v3 the signed-out header has a "Log in" text link and a navy "Register free" button (calm.css and Prompt 9). Build the v3 version.
- **Prompt 2.** "navy bar, 3px orange bottom border" and "#F2A65A inside the navy header" are also v2. Build v3: a white header and a navy focus ring.

## 0. Starting state

- **No `ui-redesign` branch existed before today.** It was not in the local branches, on `origin`, or in the `ros2lab-robots` worktree.
- **No v1 step had been done.** No branch had `public/css/theme.css`, `public/js/lab.js` or `public/courses.html`, and no commit had a `ui:` or redesign message.
- **This step:** I created `ui-redesign` from `fix-v2` and committed the handoff to `docs/redesign/` (moved up from the unzipped `docs/redesign/ros2lab-redesign/`).

**What is left:** Prompts 1–10 all apply in order. Prompt U has nothing to update.

## 1. Pages in `public/` (16 HTML files)

`public/robots/ws/**` and `public/ros/**` contain no HTML.

**Fonts and CSS on every page:**

- Every page except `certificate.html` loads `css/app.css` and the same Google Fonts link (Atkinson Hyperlegible, JetBrains Mono, Lexend).
- `app.css:1355-1356` (the "V20 visual refresh") overrides the fonts with a local **Ubuntu Sans** (`fonts/UbuntuSans-Var.woff2`) and Ubuntu Sans Mono. `app.css:1` also @imports Google Ubuntu Sans Mono.
- So today the site downloads fonts it does not use.
- The site has a light theme only, with no dark mode.

**Abbreviations in the table:**

- **H-inline:** the `<header class="top">` copied by hand into each file.
- **F-inline:** a footer copied into the HTML.
- **F-js:** the footer built by `footer()` in `js/common.js:207`.

| File | Purpose | Extra CSS | JS | Header | Footer |
|---|---|---|---|---|---|
| index.html | Home / landing | certificate.css, home.css | modes.js, index.js | H-inline, Site nav | F-inline (:407) |
| course.html | Student portal ("My course") | – | course.js | H-inline, Student nav | F-js |
| lesson.html | Lesson | – | lesson.js → lesson-render.js → terminal-sim.js | H-inline, Student nav | F-js |
| test.html | Test | – | test.js | H-inline, no nav | F-js |
| project.html | My project | – | project.js | H-inline, Student nav | F-js |
| account.html | My account | – | account.js | H-inline, Student nav | F-js |
| register.html | Register | – | register.js | H-inline, no nav | none |
| signin.html | Log in | – | signin.js | H-inline, no nav | none |
| certificate.html | Certificate / verify | **certificate.css only (no app.css)** | certificate.js | **no `header.top`**, its own `.bar` + `#actions` | none |
| admin.html | Instructor dashboard | certificate.css | admin.js | H-inline, no nav | none |
| playground.html | Games + concept lab | playground.css | playground.js, who.js | H-inline, Site nav | F-inline |
| resources.html | Free resources | – | who.js | H-inline, Site nav | F-inline |
| rviz.html | Robot catalogue + simulator workbench | sim.css (+ rviz.css injected by rviz.js:21) | sim-entry.js, who.js | H-inline, Site nav | F-inline (short) |
| privacy.html | Privacy notice | – | modes.js, who.js | H-inline, no nav | F-inline (short) |
| terms.html | Terms of Use | – | modes.js, who.js | H-inline, no nav | F-inline (short) |
| 404.html | Not found | – (absolute `/css/app.css`) | /js/who.js | H-inline, no nav | none |

CSS that JS injects at runtime:

- `rviz.css` (rviz.js:21)
- `vscode.css` (vscode.js:10)
- `css/games/<id>.css` (games/shell.js:60)
- `css/games/puzzles.css` (puzzles.js:12)
- `css/games/lab.css` (anims/frame.js:10)

**Name clash:** `css/games/lab.css` already exists (the concept-animation frame), and the prompts want a new `public/css/lab.css`. They are different paths, but they are easy to confuse. See the file plan.

**There is no include mechanism today.**

- The header is copied by hand into 15 pages, with different nav sets and a hand-written `aria-current` on each.
- Footers come from 3 sources: inline footers with different links, `footer()` in common.js, and no footer at all.

**Shared JS today:**

- **`who.js`** (21 lines) sets `--top-h` from `header.top` and fills `#who` on public pages.
- **`index.js:120-138`** has its own copy of that logic for the home page.
- **`renderWho()`** at `common.js:157` fills `#who` on member pages.
- **`modes.js`** removes `[data-mode]` elements that do not match `REGISTRATION_MODE`.

**Search:** there is no site-wide search and no suggestion UI. The only search inputs are:

- the catalogue filter `#cat-q` (rviz.html:36, sim-catalog.js:105)
- two admin table filters
- VS Code clone search

## 2. Selectors that JS and tests depend on

### Main hooks by page

| Selector | Owner | Use |
|---|---|---|
| `#main` | signin, account, admin, course, lesson, project, register, test, certificate .js | the whole page is rendered into it (`replaceChildren`) |
| `#who`, `header.top` | who.js, index.js, common.js | auth slot, header height → `--top-h` |
| `#actions` | certificate.js:7 | certificate buttons |
| `#signin-slot #hero-turtle #home-gazebo #gz-start #gz-status #gz-robots #offer #final-offer #yt-channel #yt-foot #yt-videos #cert-sample #hero-graph #lab-tabs #lab-stage #demo-game #game-links` | index.js:15-132 | home page mount points |
| `#pick #stage #game-meta #shelf #anim-pick #anim-stage a[data-id]` | playground.js | game and animation pickers |
| `#catalog #bench #cat-tabs #cat-list #cat-q .cat-sec[data-cat] .cat-card[data-search] .cat-own` | sim-entry.js, sim-catalog.js | catalogue |
| ~30 ids in rviz.html (`connect robot-card pkg-about bench-title tree go crumb-robot term real-* own-card gen-card desk cmds …`) | rviz-page.js:22+ | simulator workbench (out of scope for the redesign) |
| `input[name=lf]`, `input[name=what]` | rviz-page.js | launch options |
| `[data-tab]` | course.js:95 | portal tabs |
| `[data-mode]` | modes.js:3 | registration-mode text |
| `.opt .right .wrong`, `fb.className = "fb ok"/"fb no"` | lesson-render.js, test.js | quiz feedback |

### FRAGILE (read by tests, compared as exact strings, or built by concatenation). Keep these exactly.

| # | Hook | Written at | Read by |
|---|---|---|---|
| 1 | `.term-tasks li` with **`className === "done"`** (exact) | terminal-sim.js:2052 (`"done"` / `"now"` / `""`); box at :1463-1464 | parity/scripts/lessons/site_lesson_check.mjs:36 |
| 2 | `.tmr-pane[data-term]` + inner `.term-input-row input`, `.term-screen .line`, `.term-proc button` | terminal-sim.js:1811 | site_lesson_check.mjs:32-108 (10 places) |
| 3 | `.q-row` (class concatenated with ` sel`/` dis`/` bold`/` ic`) + `data-path` | rviz.js:1376 | tests/test-rviz-nav2-tools.mjs, tests/real-arms-audit.mjs:136, parity/e2e/fixed-frame*.spec.ts, rviz-property-click.spec.ts, site_lesson_check.mjs:44-49 |
| 4 | `data-testid="fixed-frame"` | rviz.js:1410 | fixed-frame specs, site_lesson_check.mjs:40 |
| 5 | `header.top` | every page except certificate.html | who.js:4, **parity/e2e/phone-layout.spec.ts:8** |
| 6 | `#who a[href='signin.html']` (relative href) | inline `#who` markup | phone-layout.spec.ts:15, 25 |
| 7 | `#term .term-title`, `.term` | rviz.html + terminal-sim | phone-layout.spec.ts:31, 33 |
| 8 | `.pg-meta .pg-stage .pf-term .pg-pick .pg-tile .pg-main .pg-intro`, `.pg-tile[href="#id"].done` (class concatenated) | playground.js:38 | phone-layout.spec.ts:43-45, tests/games-layout.mjs, games-basics.mjs:30, playground-games.spec.ts |
| 9 | `#stage`, `#anim-pick a[data-id].on`, `#anim-stage` | playground.html/js | playground-games.spec.ts:60-81, games-layout.mjs:58-64 |
| 10 | `.game[data-game] .game-stage`, `.game-win`, `.game-fb`, `.game-head .btn` | games/shell.js:20-38 | games-basics.mjs, games-layout.mjs |
| 11 | `.pz-missions li.done` | games/pizza.js:58 | games-basics.mjs:63, 66 |
| 12 | `.hg3-hud .hg3-view .hg3-pad button[aria-label=Back] .hg3-auto #gz-status` | home-gazebo.js, index.html | tests/home-gazebo.mjs:53-101 |
| 13 | `#robot-card [data-badges]`, `#real-entries button`, `#real-hw`, `#real-card` | rviz-page.js:607, 664-682 | validation-labels.spec.ts, lock-hint-catalog.spec.ts:39 |
| 14 | `.cat-card[data-id] .cat-facts li` | sim-catalog.js | lock-hint-catalog.spec.ts:25-26 |
| 15 | `#main` | member pages; the harness builds its own `<main id="main">` | every member page, site_lesson_check.mjs:27-29 |
| 16 | `#who` | **3 code paths** (who.js:7, index.js:132, common.js:158) | phone-layout spec |
| 17 | `.term-done`, `.term-viz` | terminal-sim.js:1465, 1479 | site_lesson_check.mjs:37, 113; rviz-page.js:738 |
| 18 | `.lesson-top { top: 64px }` | app.css:140 | – (hard-coded header height; breaks if the header changes, use `--top-h`) |

**Rules for the redesign:**

- Keep `header.top` and `#who` (including a relative `signin.html` link when signed out).
- Keep `#main` on member pages. The skip link must point at the same `<main id="main">`; do not add a second `#main`.
- Do not add classes to `.term-tasks li`.
- Restyle the playground, games and catalogue by CSS around the existing classes.
- `certificate.html` has no `header.top`, so the shared header needs its own decision there.

## 3. Practice terminal: lesson engine vs `docs/redesign/lab/lab.js`

**Lesson engine:**

- lesson.html → lesson.js → lesson-render.js → `mountTerminal()` (terminal-sim.js:1456) → `RosGraph` (ros-graph.js).
- Size: terminal-sim.js 2533 lines + ros-graph.js 2492, plus ros-iface, ros2-complete, ros-gz, urdf-core and more.
- How tasks tick: `afterCommand()` (terminal-sim.js:2162) → `Shell.check()` (:1408-1453), in order. The check keys used most in course-content.json are `cmd` (294), `outputHas` (162) and `rosNode` (48).

**lab.js:** a 638-line self-contained IIFE with its own small interface tables, turtlesim only, and no tasks.

| Feature | Lesson engine | lab.js |
|---|---|---|
| Splits Shift+Ctrl+O/E, Alt+arrows | yes (TS:2025, 2030) | yes (LJ:277-281) |
| Tabs | yes, keys + menu (TS:1922, 2025) | menu only (LJ:243) |
| Right-click menu | yes, fuller (TS:1982-2015) | yes (LJ:250) |
| Resize / zoom | yes | no |
| Turtlesim | canvas, step + 700 ms tween, several windows | live 16 ms loop, draggable window, wall warning, colour sensor |
| teleop keys | arrows only (RG:992) | arrows + g b v c d e r t, f, q |
| Teleop banner | **upper case `G|B|V|C|D|E|R|T` … `'F'` … `'Q'` (RG:932)**, wrong | lower case, correct |
| rqt_graph | **hint text only (TS:1008)** | live SVG window |
| `-r from:=to` | parsed; teleop ignores it (RG:998) | applied to teleop |
| `-p name:=value` | yes | yes (turtlesim) |
| Pipes | `| grep -i -v -c -E -F -w -A -B`, head, tail, wc, sort | `| grep [-i]` only |
| `-t/--show-types` (topic/service/action list) | yes | yes |
| `topic echo --once` | canned 3 samples | live |
| `topic echo -1` | **not handled** | **not handled** |
| `topic pub` without `-1` | 3 messages then `^C` | publishes until Ctrl+C |
| param list/get/set/dump/describe | yes, + load | yes, + delete |
| service call | any real .srv (ros-iface) | turtlesim + std_srvs |
| action send_goal rotate_absolute | instant, 4 invented feedback lines, always SUCCEEDED (RG:752-760) | live, feedback ~120 ms, real ABORTED |
| Missing-argument errors | **`usage: …` strings (RG:306, 322; TS:1223)**; argparse text only for topic pub, action send_goal, interface show | argparse text (`needArgs`) |
| `topic type` / `service type`, unknown name | **prints a warning / error (RG:329, 592)** | prints nothing |
| node info blank line after empty section | **missing (RG:309)** | yes |
| Gazebo, RViz, MoveIt, Nav2, ros2_control, launch, colcon, nano, VS Code | yes | no |
| Debug handle | returned object only (`window.__ros2labMP`) | `window.__lab` |

### reviews/ros.md items against the lesson engine

- **Already correct:**
  - `-t` (#1)
  - background repaint keeps the trail (#5)
  - `topic pub -1` (#9)
  - `printenv | grep ROS` once sourced (#13)
- **Partly correct:**
  - `-r`/`-p` (#2): teleop ignores `-r`.
  - field coercion (#10): SetPen and Spawn are loose; `buildMessage` in ros-iface.js is **UNKNOWN** (not checked).
  - Terminator keys (#14): Ctrl+Tab and Ctrl+Shift+Q are missing.
- **Wrong:**
  - teleop banner case (#8)
  - unknown-name type (#11)
  - missing-argument errors (#12)
  - node info spacing (#17)
- **Not applicable** (the lesson engine has no live loop, rotation keys or demo): #3, #4, #6, #7.

These are Prompt 6 work. I did not fix them here.

**Recommendation: one engine.** Keep **terminal-sim.js + ros-graph.js** as the single engine and port lab.js's strengths into it:

- the live turtlesim loop
- teleop rotation keys and the lowercase banner
- live rotate_absolute with abort
- the rqt_graph window
- streaming echo/pub/hz
- `needArgs` errors, silent unknown types, node info spacing, remap-aware teleop
- a debug handle

**Why this way round:** the lesson engine carries 458 task checks across course-content.json, and the parity harness relies on its `.tmr-pane[data-term]` / `.term-tasks` hooks. It also models Gazebo, MoveIt, Nav2 and the rest. Rebuilding that on lab.js would cost far more than porting about 640 lines of turtlesim behaviour.

**Until then:** Prompt 3 puts lab.js on the home page only, as the prompts say. That means two engines exist side by side for a while.

## 4. Robot catalogue (rviz.html) vs `docs/redesign/sim/`

**How the page works today:**

- **No `?robot=`:** `sim-entry.js:3-7` adds the body class `sim-catalog`, unhides `#catalog` and calls `mountCatalog()` from sim-catalog.js.
- **`?robot=<id>`:** adds `sim-bench`, unhides `#bench` and imports rviz-page.js.
  - `own` → own-robot card (rviz-page.js:624)
  - unknown id → "Robot not found"
  - otherwise → the maker workspace via `workspaceFor(id)`, or the generated package with the badges "ROS2Lab-made config – not from the maker" and "Not yet validated against real ROS 2"

**Data:**

- `robots/index.json`: 33 robots.
  - By category: manipulator 14, mobile 8, legged 7, drone 2, hybrid 2.
  - Every robot has `id, category, title, file, fixedFrame, about, group`. 21 have `vendor/pkg/source`, 14 `moveit`, 12 `real`, and 9 a `sim` block.
  - **No robot has a `status` field.** Sensors exist only as `sim.sensors`.
- `robots/ws/index.json`: 9 workspaces cover 12 official robots. `interbotix`, `crazyswarm2` and `scout` have `gazebo:false`.

**The live catalogue:**

- Category tabs with counts, saved in localStorage `ros2lab.sim.tab`; a `#cat` hash overrides it.
- Substring filter over title, vendor, id, about and category.
- A hero of 4 category tiles.
- Cards link to `rviz.html?robot=<id>` and use the image `img/robots/<id>.webp`, or a drawn thumbnail as fallback.
- `facts()` chips (sim-catalog.js:33-42).

**What the prototype adds:**

- a featured TurtleBot3 panel, with the three TB3 robots replaced in the Mobile grid by one link card
- Mobile listed first
- sensor names in the filter text
- a Course robot / Under test badge
- a plain "Gazebo" chip
- a robot info page (Type, Made by, Fixed frame, Description file, Package, Gazebo, MoveIt 2, Max speed, Sensors + topics, Source + licence, Real robots like this)

`docs/redesign/sim/robots.json` contains **nothing that cannot be derived** from the two index files. I checked every field for all 33 robots.

**New data the prototype needs:**

1. **A status field.** sim.js hard-codes `/^tb3_/`. Prompt 4b adds `"status"` to index.json.
2. **Waffle Pi sensors and speeds.** They exist only in sim.js:12. **tb3_waffle_pi has no `sim` block** (index.json:931-945), although its `about` mentions lidar, camera and IMU. These are display-only until you confirm them.
3. **Image files.** sim.js uses a `{{ROBOT_IMGS}}` placeholder.

## 5. Course modules: CORE_MODULES and Weeks 7–9

**Where the list lives:**

- `functions/config.js:106`: `CORE_MODULES = ["W1","W2","IN","W3","PF","NP"]`. `[]` would make every module count.
- Copies at `public/js/course.js:11-14` ("MUST match", plus `isCore()`) and `public/js/lesson.js:7-8`.
  - lesson.js:64 shows the chip "Introductory experience (Weeks 7 to 9): not part of the certificate".

**Server (functions/index.js):**

- `lessonStatus()` (767-774) counts core lessons only.
- `completionCheck()` (893-908) requires every core lesson done and every open core test at ≥60%. It excludes non-core tests (896-897).
- `certificateCheck()` (939-948) = completionCheck + project `passed`.
- `assignProject()` (776-784) needs every core lesson done.
- Test gating: `requireLessons` + `moduleId` (217-225).

**Client (course.js):**

- `coreMods` → `allLessons` → `pct` (41-45)
- `nextLesson` (44)
- `testRows` (48)
- `journey()` (306-350)

**Lessons come from Firestore** (`modules` with `lessonIds` + `lessons[]`, `lessons/<id>`, `tests`). They are uploaded from `content/course-content.json` on the admin page (admin.js:709, 744-772).

**Existing portal:** `course.html` + `course.js`.

- Header with a progress meter and Continue.
- 5 stat cards.
- 4 tabs: Overview, Lessons, Tests & scores, Project & certificate.
- Lesson rows show "Done", "Started" or "Up next", otherwise "N min".
- **"x of y tasks" is shown only inside the lesson page** (lesson.js:94-96). The new course page needs it per lesson. That means reading lesson blocks (`term.tasks`, `rviz.check`) or adding a field to lessonProgress, which is a design decision for Prompt 4.

**There is no public Courses page.** The public course plan is on index.html (64-72, 117+, 312-317, 375-390).

**Tests:** `tests/*.mjs` do not cover CORE_MODULES. Prompt 4 step 4 adds one.

## 6. Facts from the code for the copy

| Fact | Value | Source |
|---|---|---|
| Core lessons | 95 (W1 15, W2 16, IN 11, W3 14, PF 20, NP 19), Days 1–30 | course-content.json; hard-coded on index.html:68, 312 |
| Optional lessons | 22 (UR 8, XT 7, RV 7), Days 31–45 | course-content.json |
| Tests | 6 count (core); UR, XT, RV are optional | config.js:106 |
| Questions per test | **15 for W1, W2, IN, W3, UR, XT, RV; 16 for PF and NP** | course-content.json `tests[].topics[].count` |
| Minutes per test | **35 for W1, W2, IN, W3; 40 for PF, NP, UR, XT, RV**; fallback 30 | course-content.json; functions/index.js:261 |
| Attempts | 2 (`maxAttempts`); the instructor can grant up to 5 extra | course-content.json; index.js:440 |
| Score that counts | best | index.js:185; course.js:248 |
| Test pass mark | 60% | config.js:91 |
| Project | 2 submissions, pass 80%; RUBRIC works 40, interfaces 15, code 20, launch 10, report 15 | config.js:92-93; functions/projects.js:20-26 |
| Certificate | valid 2 years; title "ROS 2 Fundamentals: From Linux Basics to Your First ROS 2 Nodes" | config.js:96, 100 |
| Access | 60 days; one extension of 1–30 days; at most 2 re-registrations | config.js:71-81 |
| REGISTRATION_MODE | "auto" | config.js:7; public/js/firebase-config.js:22 |
| Founding batch | free if registered by 31 Dec 2026 (`2026-12-31T23:59:59+05:30`) | public/js/index.js:6 |
| Live Firestore values of totalMinutes / maxAttempts | **UNKNOWN** (a re-upload keeps the existing values) | admin.js:759-764 |

**Differences from the prompts and prototype:**

- **"15 questions / 35 min" is not true for every test.** Prompts 3 and 8 and `views2.html:42` say it, but PF and NP have 16 questions and 40 minutes. Copy should say "15–16 questions, 35–40 min", or give the numbers per week.
- **"Practice tests" (views2.html) is not a term the code uses.** Weeks 7–9 tests are real tests that do not count.
- **"Day 45 project" is a lesson** (RV "Mini-project: Chiku the mobile manipulator"), not a graded project.
- **"Five ways ROS programs communicate"** (curriculum review #6) is in lesson **IN3 "The parts of ROS"** (course-content.json:7808). I did not edit course-content.json, as the rules say.

## 7. File plan

| File | Plan |
|---|---|
| `public/css/theme.css` (new) | tokens + base + header + footer + buttons + cards + tables + badges + skip link + focus ring. Built from the prototype `<style>` → fixes.css → calm.css → type.css, **merged into one rule set** (no competing layers). Loaded after app.css on every page; app.css rules are removed only where theme.css replaces them and no JS or test depends on them. Fonts: Source Sans 3 + Source Code Pro (drop the unused Atkinson/Lexend/JetBrains link). |
| `public/js/site-chrome.js` (new) | tiny JS include: renders the one header (Home · Courses · Simulator · Playground · Student portal · Help, search, `#who`) into `header.top` and the one footer, sets `aria-current` from the URL. Keeps `header.top`, `#who`, a relative `signin.html` link and `--top-h`; replaces the 3 `#who` code paths and `footer()` (which becomes a thin wrapper so member pages keep working). The skip link and `<main id="main">` stay as static HTML so they work before JS runs. |
| `public/courses.html` (new) | Courses page (two module cards + compare table). |
| `public/course.html` | Today this is the **student portal**. Prompt 4 wants `course.html` to be the certificate-course plan, and Prompt 5 restyles the portal. **Decision needed:** keep `course.html` as the portal (the safer choice: test.html/admin.html link to it and the header calls it "My course") and put the plan at `public/plan.html` (weeks 1–6) and `public/modelling.html` (weeks 7–9), or move the portal to `portal.html` and update every link. |
| `public/modelling.html` (new) | Weeks 7–9 plan, "Not part of the certificate". |
| `public/robot.html` (new) | robot info page (`?id=`), reads index.json + ws/index.json. |
| `public/js/lab.js`, `public/css/lab.css` (new) | home practice computer, loaded only on index.html. **Name clash** with the existing `css/games/lab.css` (concept-animation frame): different path, so no conflict, but consider `css/practice.css` / `js/practice.js` to avoid confusion. |
| `public/img/robots/*.webp`, `public/img/why/*.webp` | images as files, `loading="lazy"`. |
| `public/robots/index.json` | `"status"` field only (Prompt 4b). |
| certificate.html | gets theme.css + the shared header (it has none today); certificate.css stays for the certificate itself. |

## UNKNOWNs and decisions for you

1. **`course.html` naming:** portal vs certificate-course plan (see the file plan). This is needed before Prompt 4.
2. **Test copy:** PF and NP have 16 questions and 40 minutes, so the prompts' "15 questions / 35 min" is not true for every test. Which wording do you want?
3. **Live Firestore `totalMinutes` / `maxAttempts`:** UNKNOWN; re-uploading content keeps the old values.
4. **Waffle Pi sensors and speeds:** not in index.json. Confirm before Prompt 4b adds them (or leave them out).
5. **`ros-iface.js buildMessage` field coercion** (ros.md #10): not checked, UNKNOWN.
6. **Lesson IN3** says "five ways ROS programs communicate". This is a course-content.json edit for you; I did not make it.
7. **Prompt text vs v3:** Prompts U and 2 describe the v2 navy header and an orange or white-outline Log in. This inventory follows v3 (see the top section).
