# Resume notes (project paused 22 Oct 2026)

## 1. Current state

- **master** is at `b4ae6bd` "ROS2Lab redesign v3": the squash of `ui-redesign` on top of `0d77005`. It is **local only,
  not pushed**: `origin/master` is still `0d77005` (`git branch -vv` shows "ahead 1").
- **fix/after-merge** (this branch) is `master` + `da2754e` "dev: local server sends Cache-Control: no-cache"
  (`tools/dev-server.py`, `npm run dev` uses it), + this file. Not merged into master yet.
- **ui-redesign** keeps the full redesign history (77 commits since `0d77005`), local only. The screenshots are in its
  history (`docs/redesign/shots/`, up to `d750fe8`); its tip `3d89ef8` removes them and adds them to `.gitignore`.
- **Nothing is deployed.** The live site (Firebase project `ros2lab`) still runs the pre-redesign version.
- Reports: `docs/redesign/OVERNIGHT_REPORT.md`, `docs/redesign/MERGE_CHECKLIST.md` (hand checks, deploy notes).

## 2. Next steps when you return

1. Start the dev server: `npm run dev` (serves `public/` on http://localhost:8000 with `Cache-Control: no-cache`).
2. Open a **private window** (no old cache) on http://localhost:8000: log in with a real account and open the Student
   portal (`course.html`). Also try a lesson with terminal tasks, a test, the project page and `certificate.html`
   (the list in MERGE_CHECKLIST.md section 2). If anything stays on "Loading…", open the console (F12) and note the
   red error line.
3. If it works, merge the fix into master:
   ```bash
   git checkout master
   git merge --ff-only fix/after-merge
   ```
4. Check what the server side changed since the live version:
   ```bash
   git diff --stat 0d77005 HEAD -- functions firestore.rules storage.rules firebase.json
   ```
   On 22 Oct this showed only `functions/config.js | 5 +++--` (the certificate signer, "Robotics & ROS 2 Lab" /
   "Course team, ROS2Lab"); rules and firebase.json unchanged.
5. Push: `git push origin master`
6. Deploy the site: `firebase deploy --only hosting`
7. Then the functions, if step 4 still lists `functions/` (it did on 22 Oct): `firebase deploy --only functions`.
   Rules only if step 4 lists them: `firebase deploy --only firestore:rules,storage`.
8. The content changes in `content/course-content.json` reach students only after "Upload course content" on the
   admin page.

## 3. Open items

- `tests/games-layout.mjs` is out of date: it expects 6 games in `games/registry.js` (there are 21 with the 15 locked
  missions) and then times out on the first locked mission. It failed the same way before and after the Playground
  restyle.
- The small certificate drawing (home sample, Verify page on phones) is tight at the bottom with long module names;
  the A4 print is fine. Not caused by the new statement (same overflow with the old one).
- The engine merge (lesson terminal + home practice computer into one engine) is postponed; see
  `docs/redesign/ENGINE_PLAN.md`.
- Test scripts default to `localhost:8080`; that server is stopped. Run them with `BASE=http://localhost:8000`
  (the lesson check `parity/scripts/lessons/site_lesson_check.mjs` already uses 8000).
- `tests/ui-member.mjs` always writes screenshots to `docs/redesign/shots/step5b/` (now gitignored, so harmless).
- The robot project is on branch `robots-p2b` in the worktree `/home/prasad/ros2lab-robots`; resume it after the
  deploy.

## 4. Branches and worktrees (22 Oct 2026, before this commit)

`git worktree list`:

```
/home/prasad/ros2lab-course  da2754e [fix/after-merge]
/home/prasad/ros2lab-robots  848765c [robots-p2b]
```

Uncommitted changes (`git -C <path> status --short`):

| Worktree | Uncommitted changes |
|---|---|
| /home/prasad/ros2lab-course | none (clean) |
| /home/prasad/ros2lab-robots | none (clean) |

`git branch -vv`:

```
  fix-v2                           916af89 FIX_V2 part 2 report: housekeeping, N4/N8, 6 site terminal fixes, RViz editor fix, #44 left with evidence; AUDIT_V2 rows marked
* fix/after-merge                  da2754e dev: local server sends Cache-Control: no-cache
  master                           b4ae6bd [origin/master: ahead 1] ROS2Lab redesign v3
  overnight-2026-10-16-2139        d710c43 Complete P2-audit for TurtleBot3 models and update overnight report
  overnight-2026-10-16-2147        9c9b815 Update overnight script to use model sonnet
  overnight-2026-10-16-2154        68c8931 Overnight runner log: P13
  parity-attempt1                  7997ec5 Add ROS2Lab parity kit v2
  parity-clean                     9bee3e3 Commit remaining SmacLattice configs, runs, and navigation trial outputs for overnight run
  parity-fixes                     8817707 OVERNIGHT_2026-10-19: owner list item 5 (shell && / ; launch) marked fixed
  parity-kit                       cec1c42 P0: Complete pre-flight check, verify installed Jazzy facts, site map and robot status
  parity-v2                        4cd127b [origin/parity-v2] AUDIT_V2: decision log, totals A-E, one prioritised difference list (student impact first), owner must-do list
  review-2026-10-17                ff7cb5e [origin/review-2026-10-17] fixture_parity: site goal results near obstacles vary between runs; OVERNIGHT_FG item 2 result
  robots-2026-10-17-005000         99b976d Robots run started on robots-2026-10-17-005000
+ robots-p2b                       848765c (/home/prasad/ros2lab-robots) _installed/interbotix_xsarm_moveit/SOURCE.txt as written by run_moveit_m1.sh for the wx250s recapture (source at port commit 86951bf; copied config files unchanged)
  ui-redesign                      3d89ef8 docs: drop screenshots from the repo
  worktree-agent-abda37bd5d7fd9825 d33bd28 Fix P11-round2 TurtleBot3 Waffle Pi catalog
  worktree-agent-afe856755c7b6d6bb af2de7b Fix P11-round2 shell env assignments
```
