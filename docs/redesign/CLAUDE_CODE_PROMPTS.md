# ROS2Lab redesign: Claude Code prompts (v2)

Run these one at a time in Claude Code inside `~/ros2lab-course`. Wait for each to finish, check its report and screenshots, then paste the next.

**Before you start:** unzip `ros2lab-redesign.zip` so the folder sits at `~/ros2lab-course/docs/redesign/` (replace the old v1 folder if you have it). Commit your current work first.

- **New to the redesign?** Run Prompts 1 → 10 in order.
- **Already ran some v1 prompts?** Run **Prompt U** first. It applies the v2 changes to whatever exists, then carry on from the next prompt you had not run.

Every prompt starts with the same RULES block.

---

## Prompt U: update an existing redesign branch to v2

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: docs/redesign/ now holds design v2 (read docs/redesign/README.md and the four files in docs/redesign/reviews/). Bring the ui-redesign branch up to v2.
1. git log on ui-redesign: list which v1 steps are already done (theme/header/footer, home, course pages, portal/lesson, other pages).
2. Header: remove the Courses dropdown everywhere. "Courses" becomes a plain link to a new Courses page (Prompt 4 step 1). "Simulator" links to rviz.html (the robot catalogue). Keep Home, Student portal, Help, search, Log in (white outline button, not orange).
3. Replace public/js/lab.js, public/css/lab.css and the lab markup with docs/redesign/lab/* if the home practice computer is already in. Section id is "try" (the inner div keeps id="lab"). Add the 3-step guide and the "Keyboard shortcuts" details from docs/redesign/prototype/home.html.
4. Apply docs/redesign/prototype/fixes.css rules to theme.css (focus ring, skip link, nav labels as <p class="navlabel">, footer headings h2.fh, week chevrons, mobile hero one column, mobile pager, 40px tap targets).
5. Apply the copy changes from docs/redesign/prototype/home.html (1–2 hours a day, "Nothing to install to start", "simulated robot", outcomes with week tags, SLAM/Nav2 sentence, mobile sticky bar text, channel byline and "Who teaches this" block).
6. Then run whichever of Prompts 4, 4b, 5, 7 are still to do.
7. Report what changed and which prompts are left.
```

---

## Prompt 1: inventory (read-only)

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Read-only inventory before a site redesign. Do not change any site file in this step.
1. git status; confirm the working tree is clean. Create branch ui-redesign from fix-v2 (or reuse it if it exists).
2. Read docs/redesign/README.md, open docs/redesign/prototype/ros2lab-campus.src.html, docs/redesign/lab/*, docs/redesign/sim/* and docs/redesign/reviews/*.md. This is the approved design and its review.
3. List every page in public/ (file, purpose, which JS and CSS it loads).
4. List the selectors that JS reads or writes (grep querySelector, getElementById, classList, className, dataset in public/**/*.js). Mark the fragile ones.
5. Describe the existing terminal / ROS emulator and compare it with docs/redesign/lab/lab.js (splits, tabs, context menu, teleop, rqt_graph, remaps -r/-p, | grep, param/service/action coverage).
6. Describe how rviz.html shows the robot catalogue (js/sim-entry.js, js/sim-catalog.js, robots/index.json, robots/ws/index.json) and how ?robot=<id> opens a workbench. Compare with docs/redesign/sim/sim.js.
7. Note how CORE_MODULES (W1,W2,IN,W3,PF,NP = weeks 1–6) and UR,XT,RV (weeks 7–9) are used for course pages and certificate checks.
8. Write docs/redesign/INVENTORY.md with all of this and a file plan (theme.css, shared header/footer, courses.html, course.html, modelling.html, robot info page, where lab.js lives). Recommend one ROS engine long term.
9. Commit "docs: redesign inventory". Report the summary and any UNKNOWNs.
```

---

## Prompt 2: theme, header and footer on every page

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Apply the approved university theme site-wide. Visual source of truth: docs/redesign/prototype/ros2lab-campus.src.html (+ prototype/fixes.css).
1. Create public/css/theme.css with the :root tokens, base type, buttons, header, search, footer, breadcrumbs, side menu (.sidenav with <p class="navlabel">), boxes, badges (.st-ok course robot, .st-test under test), tables, alerts, skip link and focus ring (navy #13315C on white, #F2A65A inside the navy header). Single light theme. Google Fonts: Source Sans 3, Source Code Pro.
2. One shared header: navy bar, 3px orange bottom border, ROS2Lab axes logo on its DARK background (never white), links Home · Courses (plain link to courses.html, NO dropdown) · Simulator (rviz.html) · Student portal · Help, search box with page/week suggestions, Log in as a white outline button / avatar when signed in (existing auth code). Burger menu under 960px. First element on every page: <a class="skip" href="#main">Skip to content</a>; <main id="main">.
3. One shared footer as in the prototype (headings are h2.fh). Footer "Courses" column: All courses, Certificate course, Robot modelling & RViz.
4. Use the include method the project already uses; if there is none, a tiny JS include. Say which.
5. Remove only old CSS that theme.css replaces; keep any rule JS depends on.
6. Playwright at 1440 and 390 on every page: no horizontal scroll, no console errors, keyboard works (Tab, Enter, Escape). Screenshots to docs/redesign/shots/step2/.
7. Commit "ui: theme, header, footer". Report.
```

---

## Prompt 3: home page

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Rebuild the home page to match the "home" view of the prototype, sections in order:
hero (headline, lede, Register free + Try the terminal, ticks) with "Is this course for you?" (below the buttons on mobile) → practice computer (section id "try", 3-step guide, Keyboard shortcuts details) → facts strip → What you will be able to do (each with its week tag) + Projects you will build → Courses (two rows) → Week by week table (class wkt) → Your certificate (with the sample certificate preview) + How to join → "Who teaches this" channel block → Questions → mobile sticky bar "Register by 31 Dec 2026 to study free".
1. Use real image files (docs/redesign/assets/*.webp → public/img/robots/ if not already there), loading="lazy" below the fold. No base64.
2. Practice computer: docs/redesign/lab/lab.html into the page; lab.css and lab.js as public/css/lab.css and public/js/lab.js; Ubuntu + Ubuntu Mono fonts. Load lab.js with type=module or defer only on the home page. Record any output differences from the existing lesson engine in docs/redesign/ENGINE_DIFF.md; do not change the lesson engine yet.
3. Numbers come from the repo: 95 core lessons, 6 tests (15 questions, 35 min, 2 attempts, 60%), project 80%, certificate 2 years, Weeks 7–9 not in the certificate, founding batch free until 31 Dec 2026. If the repo differs, use the repo and report it.
4. Keep window.__lab only behind ?debug=1.
5. Playwright 1440 and 390: wait 16 s on the lab (demo), then run: ros2 node list, ros2 topic list -t, printenv | grep ROS, ros2 param get /turtlesim background_r, ros2 topic echo /turtle1/pose --once, the Spawn call, rqt_graph. No console errors, no horizontal scroll. Screenshots to docs/redesign/shots/step3/.
6. Commit "ui: new home page with practice computer". Report.
```

---

## Prompt 4: Courses page, certificate course page and modelling page

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Three pages matching the prototype views "courses", "course" and "modelling".
1. public/courses.html (new): pagehead "Courses" with Register free; two cards side by side — "ROS 2 from zero" (label WITH CERTIFICATE, Weeks 1–6, facts, buttons See the course plan / Certificate rules) and "Robot modelling & RViz" (label WITHOUT CERTIFICATE, Weeks 7–9, facts, See the module plan); then the Compare table (class keep3 so all 3 columns stay on mobile). Facts from the repo.
2. public/course.html: breadcrumbs Home › Courses › Certificate course; left "Weeks" menu; one collapsible week per CORE_MODULES entry (ids wk1–wk6) with days, lessons (from Firestore content) and the test row; right column progress + certificate requirements from the real progress functions. On mobile hide the left menu and put the progress box first. /course.html#wk4 opens and scrolls to Week 4. Lesson rows show real state ("Done", "2 of 4 tasks", "Next").
3. public/modelling.html: same layout for UR, XT, RV (ids wk7–wk9), orange "Not part of the certificate" alert, practice tests only.
4. Certificate eligibility still counts CORE_MODULES only; add a test that proves Weeks 7–9 are not required.
5. Search suggestions include All courses, each week, Robot simulator, Practice terminal.
6. Playwright 1440 and 390, signed out and signed in (existing test or emulator account; report if none), plus #wk anchors. Screenshots to docs/redesign/shots/step4/.
7. Commit "ui: courses, certificate course and modelling pages". Report.
```

---

## Prompt 4b: Robot simulator catalogue and robot info page

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Restyle the robot catalogue on rviz.html (no ?robot=) to match the prototype "simulator" view, and add a robot info page matching the "robot" view. Do not change the workbench (rviz.html?robot=<id>) or any robot files.
1. Catalogue (js/sim-catalog.js + CSS): pagehead "Robot simulator" with a labelled "Filter robots" box; a featured TurtleBot3 panel (Burger, Waffle, Waffle Pi cards, label COURSE ROBOT); a "New here? Start with TurtleBot3 Burger" line that also explains the Under test badge; tabs All / Mobile robots / Manipulators / Legged robots & humanoids / Drones / Hybrid robots with counts; category sections with cards (image 16:10, status badge, title, first sentence, fact chips); "Your own robot" card (rviz.html?robot=own). In the Mobile section show one card that points to the TurtleBot3 panel instead of repeating the three.
2. Status: add "status": "course" to tb3_burger, tb3_waffle, tb3_waffle_pi and "status": "under_test" to every other entry in public/robots/index.json (this is not course-content.json). The catalogue reads the field; default under_test.
3. Fact chips as in docs/redesign/sim/sim.js facts(): "Official Jazzy workspace" (from robots/ws/index.json), vendor or "ROS2Lab course robot", "MoveIt 2", and "Gazebo + ros2_control" for arms, "Gazebo sensors" only if the robot has sensors, else "Gazebo". Drones blurb: "Multirotors with velocity control."
4. Robot info page (public/robot.html?id=<id>): breadcrumbs Home › Robot simulator › category; big image; status badge; title; full "about"; the sim note; buttons "Open in the simulator" (rviz.html?robot=<id>) and "All robots"; an under-test notice for non-course robots; a spec list (type, made by, fixed frame, description file, package, Gazebo yes/no, MoveIt 2, max speed, sensors with topics, source + licence) and "Real robots like this" links, all read from index.json / ws/index.json. Long links must wrap on mobile.
5. Waffle Pi: index.json has no sim block. Report it; do NOT invent its sensors in index.json. (The prototype shows lidar, Pi camera, IMU, 0.26 m/s, 1.82 rad/s for display only; ask me to confirm.)
6. Playwright 1440 and 390: every tab, the filter ("lidar", "ur5e"), open 5 robot info pages and their workbench links. No horizontal scroll, no console errors. Screenshots to docs/redesign/shots/step4b/.
7. Commit "ui: robot simulator catalogue and robot info page". Report.
```

---

## Prompt 5: student portal, lesson page and the remaining pages

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Restyle the remaining pages, one at a time, commit after each.
1. Student portal: welcome box ("Continue where you stopped · 2 of 4 tasks done" style, real data), a tests line (each passed week's score, and "Week N opens after X more lessons"), My courses cards with real progress, Useful links, This week (study days, "4 days this week"), Notices with units ("X lessons left before your Week N test opens"). Access-period text only from the real rule; if unknown, report UNKNOWN.
2. Lesson page: breadcrumbs, left lesson list (p.navlabel), article, story box, outcomes, terminal styled like Terminator (#C80003 focused title bar with "student@ros2lab: ~", #C0BEBF others, black, #AAAAAA, Ubuntu Mono, bold #8AE234/#729FCF prompt) with tasks beside it, quick check, summary, sticky pager. Next button disabled with a visible reason ("Finish 2 more tasks to unlock Next", aria-describedby). On mobile the pager is one row: ‹ Previous (ellipsis) and Next only. Do NOT change how tasks are detected or ticked.
3. Lesson content wording (only if it is in page templates, not course-content.json): if a lesson says "five ways ROS programs communicate", report it — the reviewers recommend "four ways nodes communicate: topics, services, actions and parameters". Do not edit course-content.json; list the lesson ids for me.
4. Test, project, playground, sign-in/register, account, certificate and verify pages: theme only. Keep every form field name and id.
5. Playwright 1440 and 390 on every page, then a full student flow on the test account: lesson → tasks → test → project page → certificate page. Screenshots to docs/redesign/shots/step5/.
6. Report every page changed and anything you could not check.
```

---

## Prompt 6: ROS emulator accuracy (lessons and home use one engine)

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: docs/redesign/reviews/ros.md lists real-vs-emulated output differences; docs/redesign/lab/lab.js already fixes them. Apply the same fixes to the lesson engine, then plan one engine.
1. For each item in reviews/ros.md, check the lesson engine: -t / --show-types on topic/service/action list; -1 for --once; --ros-args -r from:=to and -p name:=value; | grep [-i] PATTERN; topic/service type of an unknown name prints nothing; "ros2 X Y: error: the following arguments are required: names"; node info blank line after empty sections; teleop banner in lower case (g|b|v|c|d|e|r|t, 'f', 'q'); rotation logs come from [turtlesim] (completed, canceled, "Rotation goal received before a previous goal finished. Aborting previous goal", "Velocity command received during rotation goal. Aborting goal"); wall warning only while pushing (clamp to float32 width); background parameters repaint under the trail (trail kept); field coercion int(255.0), str(5).
2. Fix each one in the lesson engine with a source link (ros2cli / ros_tutorials jazzy branch) in a comment. Anything without a source: UNKNOWN, do not change.
3. Write docs/redesign/ENGINE_PLAN.md for merging into ONE engine (Terminator UI features from lab.js: splits, Alt+arrows, right-click menu, tabs, rqt_graph window, teleop pad). Stop after the plan and wait for my approval before merging.
4. Commit "ros: emulator accuracy fixes". Report every string changed (old → new → source).
```

---

## Prompt 7: expert review items that need code

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Work through docs/redesign/reviews/webdesign.md, learner.md and curriculum.md. Implement every Must and Should item that is code or layout. Take every course rule from the code (functions/config.js, functions/projects.js, the existing index.html FAQ); README 'Owner decisions' says what to leave out (instructor name, approval wait, plans after the founding batch). Do not invent any facts.
Also: type scale to six tokens (12/14/16/19/24/32, hero 40); heading order (no h4 before h1/h2); one sign-in state per page; page weight (images as files, lazy; lab.js and the catalogue JS loaded only on their pages; at most 2 font families outside the lab) — measure first-load size of index.html before and after.
Playwright 1440 and 390 on all pages; axe-core accessibility scan if available (npm package already in the repo? if not, report). Screenshots to docs/redesign/shots/step7/.
Commit "ui: expert review fixes". Report a table: item → done / placeholder / skipped (why).
```

---

## Prompt 8: owner decisions of 21 Oct 2026 (channel, approval, certificate)

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Apply the owner decisions in docs/redesign/README.md ("Owner decisions") and docs/redesign/certificate/CHANGES.md.
1. Remove every personal instructor name from public pages. Present the course as "From the Robotics & ROS 2 Lab YouTube channel" with the dark rounded axes logo (img/logo-axes.svg) and the existing link https://youtu.be/-tL0dp7Kloc: a byline under the home hero and a "Who teaches this" block before the FAQ, as in the prototype.
2. REGISTRATION_MODE is "auto": remove or hide every sentence that mentions waiting for approval (index.html data-mode="id-card manual" lines may stay hidden by the existing mode switch; check they never show in auto mode). Keep the admin approval code for re-registrations and extensions unchanged.
3. Certificate: make exactly the changes listed in docs/redesign/certificate/CHANGES.md (config values, seal text, statement, sample data, Verify page restyle). Do not change the certificate ID format, the Firestore schema or the signing flow. Render the sample at 1440 and 390 and the print preview (A4 landscape) and save screenshots to docs/redesign/shots/step8/.
4. Home and Courses copy must match the site rules: 60 days to finish, lifetime access rule, 1–2 hours a day (~48 h total), tests 15 questions / 35 min / 2 attempts / best score / 60%, personal project up to 2 submissions / 80% / marking scheme 40-15-20-10-15 (read RUBRIC in functions/projects.js, do not retype it by hand), certificate valid 2 years with Verify, LinkedIn and QR. Say nothing about what happens after the founding batch.
5. Playwright: home, courses, certificate.html (no id, a wrong id, the sample), no console errors, no horizontal scroll.
6. Commit "ui: channel branding, auto registration copy, certificate refinements". Report.
```

---

## Prompt 9: calm style layer and the Playground page

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Apply design v3 ("calm": plain, spacious, low noise) and restyle the Playground. Visual source: docs/redesign/prototype/calm.css (it is loaded LAST in the prototype and overrides earlier rules) and the "home" and "playground" views of docs/redesign/prototype/ros2lab-campus.src.html.
1. Merge calm.css into public/css/theme.css (do not keep two competing rule sets). Key points: white header with a thin bottom rule and quiet grey links (current page = navy text + 2px navy underline), "Log in" text link + navy "Register free" button when signed out, navy primary buttons and white outlined secondary buttons with 8px radius, 12px radius cards with light #E6E9EE borders and no coloured top borders, light table headers, pill tabs, 80px section spacing, 54px hero heading, light grey footer.
2. Home: hero = text left + TurtleBot3 Burger image right (hidden under 960px); "Is this course for you?" moves out of the hero into its own section right after the practice computer.
3. Header links: Home · Courses · Simulator · Playground · Student portal · Help. Nav labels never wrap; hide the search box between 961–1120px; burger under 960px.
4. Playground (public/playground.html + js/playground.js): keep every game, the badge card, the concept lab and their hash links (#<gameId>, #lab-<animId>) working exactly as now; only restyle: pagehead, a "Games" grid of the playable games (week · day, title, one line, badge name, Play), the 15 not-validated missions inside a collapsed "Robot missions" section, and the Concept lab as week cards listing each animation's title and concept (docs/redesign/playground/pg.html, pg.js show the layout; pg.json was exported from games/registry.js and anims/registry.js — read the registries, do not copy pg.json).
5. Playwright 1440, 1024 and 390 on every page: no horizontal scroll, no nav wrapping, no console errors; play one game and open one animation on the real Playground. Screenshots to docs/redesign/shots/step9/.
6. Commit "ui: calm style layer and playground". Report.
```

---

## Prompt 10: spacing, section heads and the "Why ROS2Lab" section with real images

```
RULES: Never push, deploy, run firebase deploy, sudo or apt. Never change content/course-content.json or Firestore data. Never invent command output or values; if something is unknown, write UNKNOWN and list it in the report. No secrets in the repo. Work only on branch ui-redesign. Commit after each step with a clear message. Keep every existing id, class and data- attribute that any JS or test reads (for example .term-tasks li with className "done", .tmr-pane[data-term], .q-row); if markup must move, keep those hooks. Stop and report if a step would break a lesson, test, project or certificate flow.

TASK: Apply docs/redesign/prototype/type.css (loaded after calm.css) and the new home section.
1. Fonts stay Source Sans 3 (UI) and Source Code Pro (code); Ubuntu / Ubuntu Mono only inside the practice computer. Body 17px (16.5px on phones), line-height 1.7; hero heading clamp(34px, 4.2vw, 50px); section headings clamp(26px, 2.8vw, 34px); page titles clamp(30px, 3.2vw, 40px).
2. Spacing: every section head is stacked and left aligned (kicker, heading, one line, max 46em); sections 96px apart (64px on phones); grids use 28px gaps; two-column blocks 72px apart.
3. Home: replace "Is this course for you?" with "Why ROS2Lab — Everything you need to start robotics": six cards, each with a medium 16:10 image on top, title, one line and a link where it fits (copy in docs/redesign/prototype/home.html). Use the real images in docs/redesign/assets/why/ (w_free = TurtleBot3 renders, w_lab = the practice computer, w_robots = Spot/UR5e/Go2/Crazyflie renders, w_play = the site's Turtle Commander game, w_code = the same talker node in Python and C++, w_cert = the site's sample certificate) as files in public/img/why/ with loading="lazy", width/height set. When the site changes, re-capture them from the live pages instead of keeping stale screenshots. Then a "Made for" row of pills, one line of conditions, and Register free + Try the terminal first. Take every number from the repo (robots/index.json, games/registry.js, anims/registry.js).
4. Playwright 1440 and 390: no horizontal scroll, no console errors, images load. Screenshots to docs/redesign/shots/step10/.
5. Commit "ui: spacing and Why ROS2Lab section with real images". Report.
```

---

## After each prompt
1. Look at the screenshots in `docs/redesign/shots/`.
2. Open the local preview (`firebase emulators:start` or your usual command) and click through.
3. If something is wrong, tell Claude Code exactly what and where.
4. Merge `ui-redesign` into your main branch only when Prompt 10 passes. You push and deploy yourself.
