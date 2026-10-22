# Overnight report: parts A0 to E (21 Oct 2026)

Branch `ui-redesign`. Nothing was pushed or deployed; no `sudo`/`apt`; `content/course-content.json`, Firestore data,
`terminal-sim.js`, `ros-graph.js` and `lab.js` were not changed. Every hook listed in the prompt (`.term-tasks li`
"done", `.tmr-pane[data-term]`, `.q-row`, `header.top`, `#who`, `#yt-foot`, `.lesson-top`) is unchanged.

| Part | Status | Commit |
|---|---|---|
| A0 Larger type | done | `1b3c1a2 ui: larger, more legible type scale` |
| A Layout tweaks | done | `5ecc091 ui: wider reading column, capped demo height` |
| B Channel and certificate | done | `3c74956 ui: channel branding and certificate refinements` |
| C Calm style and Playground | done | `ddfc138 ui: calm style check and playground` (+ a lede-width fix in the E commit) |
| D Spacing and Why section | done | `127091a ui: spacing and Why section check` |
| E Final checks | done | `docs: merge checklist` (MERGE_CHECKLIST.md, the lede fix, the script defaults), then `docs: overnight report` |

No part was skipped.

## Lesson check (`parity/scripts/lessons/site_lesson_check.mjs`, default set)

| When | Ticks |
|---|---|
| Baseline before A0 | 66 of 66 (D4 ×2, D13, F12, F15, N10, N18, N19, N23, XT5, RV1; every block "ALL DONE") |
| After A0 | 66 of 66 |
| After A | 66 of 66 |
| Final (E) | 66 of 66 |

The baseline run was still going when the first A0 token edit was saved (the harness loads only `app.css`); the 66 of
66 matches STEP7_REPORT, and lesson ticking does not depend on CSS.

## Part A0: larger type

**Before / after (theme.css tokens; app.css carries the same copy):**

| Token | Before, every width | Phone < 640 | Tablet 640–1023 | Desktop ≥ 1024 | ≥ 1920 |
|---|---|---|---|---|---|
| `--fs-xs` | 12 | 13 | 13 | 13 | 13 |
| `--fs-sm` | 14 | 15 | 15 | 15 | 15 |
| `--fs-base` (body) | 16 (18 from 1920) | 17 | 17 | 18 | 19 |
| `--fs-lg` | 19 (21 from 1920) | 19 | 20 | 21 | 21 |
| `--fs-xl` | 24 (27 from 1920) | 23 | 24 | 26 | 26 |
| `--fs-2xl` | 32 (36 from 1920) | 29 | 32 | 36 | 36 |
| `--fs-hero` | 40 (45 from 1920) | 34 | 40 | 48 | 48 |
| Body line-height | 1.7 | 1.6 | 1.6 | 1.6 | 1.6 |
| Headings line-height | 1.08–1.35 | 1.2–1.25 | | | |
| Lesson terminal | 14.4 (.9rem) | 14 | 15 | 15 | 15 |
| Code blocks (`pre.code`) | 14 | 14 | 15 | 15 | 15 |
| Practice computer (home) | 15; 13.5 under 760 | 14 under 760 | 15 | 15 | 15 |

All sizes in px. The step 7a "from 1920px" rule was replaced by the single `--fs-base: 19px` rule.

- Nothing below 13px on site pages: every badge, chip, kicker, count and footer line already used a token, so they move
  to 13px with `--fs-xs` (ui-review checks every visible text size against the scale and passed).
- Phones: buttons and form fields inside `main`, the header and the footer use `--fs-base` (17px); the terminals,
  practice computer, games, workbench and Gazebo controls keep their own sizes.
- **Terminal columns** (Ubuntu Mono 15px, measured): 125 columns in the lesson main column at 1440, 108 at 1280, 77 at
  1024. 80 columns fit at 1440; at 1024 a single pane has 77 (15px kept, as the prompt says).
- **Header nav** at 961, 1024, 1180, 1280 and 1440: the six links on one row, no label wraps, the header row does not
  overflow; the search box is hidden 961–1120px by the existing rule. The link gap and font were not changed.
- **Lesson Previous / Next bar** at 390: Previous and Next on one row, the reason line above it.
- `tests/ui-review.mjs` SCALE: was one set `[12, 14, 16, 19, 24, 32, 40]`; now per checked width:
  1440 → `[13, 15, 18, 21, 26, 36, 48]`, 390 → `[13, 15, 17, 19, 23, 29, 34]`. `pre.code` joins the "own type" list
  (it is 15/14px by item 4).
- New `tests/ui-shots.mjs` (viewport screenshots). Before/after in `docs/redesign/shots/stepA0/{before,after}/`
  (index, courses, plan, rviz, course, lesson IN3, test, terms at 1440 and 390).

## Part A: layout tweaks

- `--read-max: min(760px, 70ch)` from 1024px (was 62ch).
- `tests/ui-widths.mjs`: the longest running-text line limit goes from 82 to **90** characters. With 70ch at 18px
  the longest lines measured 84–88 characters (plan, privacy, terms, resources, account), so 82 failed by design.
- Home Gazebo demo: `max-width: 1080px` from 1024px, centred. Measured: 1440 and 1920 → canvas 1080×607, box
  1080×641 with its title bar; 1024 → 960×574 (narrower than the cap); 390 unchanged (358×303). The canvas keeps its
  16:9 ratio (home-gazebo.js sizes it from the width).

## Part B: channel and certificate

1. Branding was already complete: no personal instructor name on any public page; the home byline, the "Who teaches
   this" block (`#channel`) and the footer link `#yt-foot` (on all 20 pages) show "From the Robotics & ROS 2 Lab
   YouTube channel" with `img/logo-axes.svg` and https://youtu.be/-tL0dp7Kloc. Nothing added.
   The contact address in `terms.html` and `privacy.html` contains a personal name; it is a legal contact, not an
   instructor name, so it was left (standing decision: no contact email in the footer).
2. Auto mode: no first-registration approval wording on the public pages. `register.js` keeps its real texts for
   re-registration and for an account deleted before (both need the administrator). `terms.html` / `privacy.html`
   say "each approved registration … from the moment it is approved"; in auto mode approval is immediate, so this is
   not a wait and was left (legal text).
3. Certificate, `docs/redesign/certificate/CHANGES.md`:
   - item 1: `functions/config.js` `CERT_INSTRUCTOR = "Robotics & ROS 2 Lab"`, `CERT_INSTRUCTOR_TITLE = "Course team,
     ROS2Lab"` (takes effect only after a functions deploy; stored certificates keep their values);
   - item 2: seal ring text "ROBOTICS & ROS 2 LAB • ROS2LAB • ROS 2 JAZZY •". The ring path is 220 units long; the
     old text was already 250 (its end was cut off) and the new one 264. `letter-spacing` 1.6 → 0.55 makes it 218, so
     the whole text shows. Font family and size unchanged. (`textLength` was tried first; Chrome ignored it on this
     textPath.)
   - item 3: the new statement;
   - item 4: the home sample already had the new signer (done earlier);
   - item 5: Verify page checked by ui-member: ID format `R2L-YYYY-XXXXXXXXXX`, messages and LinkedIn URL unchanged.
   Not changed: ID format, Firestore schema, signing flow, the certificate's own fonts and sizes.
   On a phone the scaled drawing is tight at the bottom with the sample's long module names; measured with the old
   and the new statement, the overflow is the same (41px at 390), so it is not from this change.
4. Home and Courses numbers match `functions/config.js` and `RUBRIC` (60 days, one extension up to 30 days, 2
   re-registrations, 60% per test, 2 attempts, best score, 15–16 questions / 35–40 minutes, project 80% with up to 2
   submissions, marking 40/15/20/10/15, certificate 2 years). No change.
5. New `tests/ui-cert-shots.mjs`: home, home sample, courses, certificate.html with no id, a wrong id and the sample
   (mock document with the home sample's data), 1440 and 390, plus the print preview of the sample (A4 landscape, one
   page) as PNG and PDF, in `docs/redesign/shots/step8/`.

## Part C: calm style and Playground

1. calm.css check, measured on 9 pages at 1440: white header with a 1px rule, grey links, navy current link with a 2px
   navy underline, "Log in" link + navy "Register free", navy primary and white outlined secondary buttons, light
   table heads, pill tabs (catalogue, portal), 12px cards with light borders, tint footer: all in place. Two
   differences follow later prototype layers and were kept: `.whyc` 16px radius (type.css) and navy `.cmp` column
   heads (sim/sim.css). No second rule set was added.
2. Header: Home · Courses · Simulator · Playground · Student portal · Help; one row from 961px on every page, burger
   below 960px (tests/ui-pages.mjs).
3. Playground restyled as `docs/redesign/playground/pg.html`:
   - page head (crumbs, h1, lede; the `.pg-intro` text "The 15 robot missions after them are locked…" kept);
   - Games: one card per playable game (week · day, title, one line from `blurb`, badge, Play ›), the badge card
     beside them (below on phones);
   - the 15 not-validated missions in a collapsed "Robot missions (15, not yet validated)" section, opened
     automatically when the hash names a mission, and kept open across repaints;
   - the open game (`.pg-meta`, `#stage`) as before; the Concept lab as week cards with the animation below.
   - Data from `games/registry.js` and `anims/registry.js` (pg.json not copied). Every `.pg-tile` (all 21 stay inside
     `.pg-pick`), `.on`/`.done`, `#stage`, `#anim-pick a[data-id].on`, `#anim-stage` and the `#<gameId>` /
     `#lab-<animId>` links work as before. Game stages keep their own sizes.
   - Fix found in E: the lede was 110 characters wide (theme.css `.pagehead .lede` won); now 58ch.
4. `tests/ui-pages.mjs` (new): all 20 pages + portal, lesson IN3 and test (mock) at 1440, 1024 and 390: no sideways
   scroll, nav on one row or behind the burger, no console errors; Path Finder opened from `#paths` and a step played;
   the Topics animation opened from `#lab-pubsub` and its first button pressed. Screenshots in
   `docs/redesign/shots/step9/`.

## Part D: spacing and Why section

1. Section heads were already stacked and left aligned (kicker, heading, one line); home sections 96px top and
   bottom (64px on phones). Changed: practice-computer steps gap 8 → 12px; robot thumbnails under the Gazebo demo
   8 → 16px (4 → 8px on phones). A0 tokens kept.
2. Why ROS2Lab: six cards, six images in `public/img/why/` (640×400 WebP, `loading="lazy"`, width/height set), all
   load; counts from the data: 33 robots (`robots/index.json`), 6 games (`games/registry.js`, playable ones) and 27
   animations (`anims/registry.js`). Nothing missing.
3. New `tests/ui-why.mjs`, 1440 and 390: passed; screenshots in `docs/redesign/shots/step10/`.

## Part E: suite results (final run, after part D)

| Suite | Result |
|---|---|
| Lesson check | 66 of 66 |
| ui-chrome | all checks passed |
| chrome-sync | 20 pages ok |
| ui-home | all ok |
| ui-courses | all ok |
| ui-sim | ALL OK |
| ui-portal | all ok |
| ui-student | all ok |
| ui-member | all passed (its step5b screenshots were restored with `git checkout`) |
| ui-review | all passed |
| ui-widths | 5 FAILED in the first final run (playground lede 110 characters at 1024–2560); fixed; rerun: all passed |
| course-plan | all ok (9) |
| quoted-numbers | all passed |
| lock-hint-catalog + playground-games + phone-layout (parity/e2e) | 12 passed |
| security check | all static checks passed |
| ui-pages (new) | all passed; rerun after the lede fix: all passed |
| ui-cert-shots (new), ui-why (new), games-basics | all passed |
| games-layout | FAILS, before and after part C identically: it expects 6 games in the registry (there are 21 with the missions) and then times out waiting for a game stage on the first locked mission. Pre-existing, not changed |
| Nav2 parity suite | skipped, as the prompt says |

## UNKNOWN / open

- UNKNOWN: whether real certificates drawn on phones with long module names need a layout change (the drawing is
  the printed A4 layout and was not changed; see B3).
- Still open from STEP7_REPORT: a contact address without a personal name; project marking time; a support channel;
  the live Firestore test settings.
- The new screenshot scripts now default to the system temp folder (`ros2lab-shots`) when `OUT` is not given. The
  first final run wrote 26 screenshots to a `shots/` folder in the repo root (removed); a copy from the last
  `ui-why` check is in `/tmp/ros2lab-shots` (removing it was not permitted in this session).
- `tests/ui-member.mjs` always rewrites `docs/redesign/shots/step5b/`; restore with `git checkout` after running it.

See `docs/redesign/MERGE_CHECKLIST.md` for the commit list, the hand checks, the merge and deploy commands and the
screenshot size note (126 MB).
