# Step 7: expert review fixes (21 Oct 2026)

Branch `ui-redesign`. Commits: `docs: engine merge postponed`, `ros: accept quoted numbers in numeric fields`, `ui: expert review fixes`.

## Review items

"Earlier" = already in place from Prompts 2–6 and checked again here. "Now" = done in this step.

### webdesign.md

| # | Item | Status |
|---|---|---|
| 1 | Home hero one column at 390 | done (earlier) |
| 2 | Focus ring navy on white | done (earlier) |
| 3 | Robot page sideways scroll | done (earlier; `tests/ui-sim.mjs` checks 5 info pages) |
| 4 | Lesson pager one row on phones, reason for disabled Next | done (earlier; `tests/ui-student.mjs`) |
| 5 | Six-token type scale | done (now): 12/14/16/19/24/32 + hero 40 in theme.css, mapped in theme, home, sim, playground, puzzles and app.css; the terminal, RViz, editors, games, animations and the certificate drawing keep their own type |
| 6 | Heading levels | done (now): one h1 and no skipped level on every page; test.html "How this test works" h3 → h2 |
| 7 | Skip link | done (earlier) |
| 8 | Plan pages on phones: no side menu, progress first | done (earlier) |
| 9 | Simulator page length | done (now): first visit shows the TurtleBot3 course robots and "Show all 33 robots"; 5 columns ≥1280 px; 16:10 images and no duplicate TB3 cards (earlier). Tab memory and every hook kept |
| 10 | One filter box with a visible label | done (earlier) |
| 11 | Who runs the site | partly: "About ROS2Lab" footer link to the channel block (now); instructor block skipped (owner decision); contact email skipped, see open points; sample certificate shown (earlier) |
| 12 | One sign-in state per page | done (now verified): `tests/ui-review.mjs` checks every public page signed out and 13 pages signed in (mock Firebase) |

### learner.md

| # | Item | Status |
|---|---|---|
| 1 | Hero on phones | done (earlier) |
| 2 | Copy contradictions | done (earlier) |
| 3 | Free and access | done: "register by 31 Dec 2026 to study free" (earlier, nothing about later, owner decision); portal notice now gives the end date and what happens then |
| 4 | Trust signals | skipped: instructor name and approval time (owner decisions); contact (open point); "Try a free lesson": lessons are served from Firestore to signed-in students only, a public lesson would change access rules. The home practice computer is the free trial |
| 5 | Load weight | partly (now): see Page weight |
| 6 | Practice computer goal | done (earlier: 3 steps, shortcuts in a details box); renaming the command tabs skipped: the labels are in lab.js, which this prompt does not change |
| 7 | Log in as a text link | done (earlier) |
| 8 | Courses page | done (earlier) |
| 9 | Simulator page | done: top line and Under test note (earlier), course robots first (now); plain one-liners per robot skipped: that is new copy for 33 robots, not data |
| 10 | Portal notices | done: units (earlier); "N days this week" with the plan's 5 lesson days a week (now) |
| 11 | Lesson gating text | done (earlier) |
| 12 | Outcomes in plain words | done (earlier) |

### curriculum.md

| # | Item | Status |
|---|---|---|
| 1 | Hours | done (now): hours per week and in total on the plan pages, summed from the lessons' own minutes (Weeks 1–6: 2,850 min, about 47.5 h; Week 5 about 10 h). Test and project time not added: project time is UNKNOWN |
| 2 | SLAM/Nav2 promise | done (earlier) |
| 3 | Outcomes matrix | done (now): plan.html "What you will be able to do", Outcome / Weeks / Checked by (weekly tests, and the project lines of RUBRIC that check it) |
| 4 | Project card | done (now): plan.html "Your project": brief, deliverables, marking table, who marks, resubmissions, all from functions/projects.js and config.js via data/course-plan.json. Marking time UNKNOWN, not stated |
| 5 | Certificate credibility | Verify page (earlier); honour pledge and different papers already on the test page; certificate wording left to Prompt 8 |
| 6 | IN3 "four ways" | done (earlier, owner edit) |
| 7 | Access notice with date and rule | done (now) |
| 8 | "Get approved" | skipped (owner: automatic registration, no approval step); under-18 consent already stated |
| 9 | Before you enrol + syllabus | done (now): home FAQ entry (language, starting level, time, under 18, syllabus); plan.html "Print or save as PDF". Support channel UNKNOWN; price after the founding batch left out (owner) |
| 10 | Sequencing | skipped: needs course-content.json changes |
| 11 | Tests FAQ | done (now), and corrected: the FAQ said answers can be reviewed after each attempt; functions/index.js getReview opens them only after a pass or the last attempt |
| 12 | Portal tests line, finish date at current pace | tests line (earlier); finish date at pace (now) |
| 13 | "Done" needs all tasks | skipped: it would change how progress is saved; the Next reason says how many tasks are left |

### Also fixed

- plan.html / modelling.html had the placeholder heading `plan.html0` / `modelling.html0` and `aria-label="plan.html1"` (an earlier templating slip), and the plan showed a stray "null" under "Course plan".
- Form controls used the browser's 13.33px Arial; they use the page font now.

## Page weight (index.html, cold cache, 1440×900, `node tests/page-weight.mjs`)

| | Requests | Transferred |
|---|---|---|
| Before | 53 | 1310.8 KiB (1,342,236 bytes) |
| After | 46 | 1247.8 KiB (1,277,776 bytes) |

Local server, no compression for site files (Firebase Hosting compresses). Changes: certificate.css and its three fonts load when the sample certificate comes near; the robot and game counts (robots/index.json, 40 KB) load when "Why ROS2Lab" comes near. Font families outside the practice computer: Source Sans 3 and Source Code Pro (the certificate drawing keeps its own fonts). The rest is Google Analytics + Firebase (about 470 KB, needed for the header's sign-in state), the practice computer (lab.js 75 KB, Ubuntu fonts about 150 KB) and images that Chrome fetches early despite `loading="lazy"`. lab.js loads only on index.html; the catalogue JS only on rviz.html and robot.html.

## Tests

| Suite | Result |
|---|---|
| Lesson check (`site_lesson_check.mjs`, default set) | 66 of 66 before; 66 of 66 after every commit |
| 45 turtlesim lessons (after the quoted-number fix) | 282 of 282 |
| `tests/ui-review.mjs` (new): every page at 1440 and 390, signed out, and 13 pages signed in | all passed: no sideways scroll, no console errors, one h1, no skipped levels, ≤2 font families, every size on the scale, lazy images with width/height |
| ui-chrome, chrome-sync, ui-sim, ui-portal, ui-student, ui-member, course-plan, lock-hint-catalog, security check, quoted-numbers (new) | pass |
| ui-courses | pass after updating its expected lede to the new "(about N hours)" text |
| ui-home | 1 FAIL "demo after 16 s … teleop running": also fails with this step's changes stashed (lab.js untouched), so not from this step |
| axe-core | not run: neither `axe-core` nor `@axe-core/playwright` is installed, and this step does not install packages |
| Parity suite (`parity/e2e`, 127 tests) | 120 passed, 7 failed |

Parity failures, compared with `master` (there is no local `main`; `origin/main` is an unrelated early commit, so the main line is `master`, which ui-redesign descends from):

| Test | On master | Verdict |
|---|---|---|
| fixtures/nav_robotis tb3_burger | fails | pre-existing |
| fixtures/nav_robotis tb3_waffle | fails | pre-existing |
| fixtures/nav_robotis tb3_waffle_pi | fails | pre-existing |
| fixtures/nav2_bringup tb3_burger graph | fails | pre-existing |
| fixtures/nav2_bringup matrix | fails | pre-existing |
| fixtures/nav2_bringup matrix_dwb_burger | fails | pre-existing |
| fixtures/mapping tb3_waffle cartographer | passes | not a regression: rviz2's topic and subscriptions were missing at capture time; the same test passed when rerun on ui-redesign |

## Open points for the owner

1. Contact: the only contact address in the repo (`CONTACT_EMAIL`, terms, privacy) contains a personal name, so it was not added to the footer. Decide in Prompt 8.
2. UNKNOWN: project marking time, a support channel and its response time, the live Firestore test settings (`totalMinutes`, `maxAttempts`, `review`, `closeAt`). The tests FAQ follows content/course-content.json (`review: afterClose` without `closeAt`).
3. Real Jazzy accepts out-of-range integers (`{r: 300}` for a uint8 in set_message_fields, see the fixture) and truncates `{r: 2.5}` to 2; the site's buildMessage rejects both. Not changed here.
