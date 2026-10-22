# Merge checklist: `ui-redesign` → `master`

Written 21 Oct 2026 at the end of the overnight run (parts A0–E). Nothing here has been merged, pushed or deployed.
The commands below are for the owner to run.

## 1. What is on the branch

`master` is at `0d77005` (same as `origin/master`) and has no commits that `ui-redesign` lacks, so the merge can be a
fast-forward. `ui-redesign` was branched from `fix-v2`, so `master..ui-redesign` holds **74 commits**: the 42
`fix-v2` commits (simulator parity and content fixes, not yet on `master`) and the 32 redesign commits.

### 1a. From `fix-v2` (42 commits, already reviewed in FIX_V2 / AUDIT_V2)

| Commit | Message |
|---|---|
| 9b51a23 | RViz combo sprites without baked-in text: Fixed Frame box showed 'base_link' under every value (Phase 1 item 1) |
| 118a82b | RViz: Fixed Frame from the loaded .rviz also sets the page frame manager, so Global Status checks the same frame (expert_review_robots MF10) |
| ef5713a | Crazyflie: keyboard_velmux_launch.py is a real-radio launch: not in the lock hint, card button locked and labelled (Phase 1 item 2) |
| 826ba59 | Real-hardware lock before any process starts: no made-up 'process has died' lines, no half-started nodes (Phase 1 item 3) |
| f5d4e70 | Gazebo /imu: covariance diagonals from the model.sdf <noise> stddev, as real ROS prints them (Phase 1 item 4) |
| de3b111 | Fixture: real slam_toolbox /map_metadata QoS (RELIABLE, TRANSIENT_LOCAL) and ros2 topic echo --once (tb3_burger, domain 41) |
| 7f0f509 | slam_toolbox: ros2 topic echo /map_metadata --once gets the latched MapMetaData instead of 'Nobody is publishing' (Phase 1 item 5) |
| 6cc2db5 | Nav2: initial_transform_timeout counts sim time, with a ROS2Lab note to set the initial pose while it waits (Phase 1 item 7) |
| 10e01f5 | Phone (375 px): no sideways page scroll, content scrolled into view stops below the sticky header, 44 px tap targets (Phase 1 item 6) |
| 1924402 | PHASE1_2026-10: fixed / left / why, gate totals, git log |
| 0783a55 | Lesson parity runner: every practice-terminal solution in a real bash on a pty (domain 52), scratch HOME per block |
| 41e075d | Fixtures: real Ubuntu 24.04 + Jazzy output of all 92 practice terminals and 13 lesson code-block command sets (re-captured after the daemon fix) |
| 00acda3 | Physics baseline scripts: generated Harmonic worlds, gz-transport recorder, case runner, UR5e and TB3 ROS-side captures, analysis |
| f4fbb09 | Fixtures: real Gazebo Harmonic physics baseline (24 cases x3, determinism x10, TB3 DiffDrive/sensors, UR5e gz_ros2_control), SUMMARY.md |
| 3397f17 | RViz2 baseline (real rviz2 14.1.24 on Xvfb): Add/By-topic lists, panels, views, default property trees, status texts, tools and topics, MoveIt MotionPlanning tree |
| 4466a47 | Reports: lesson parity weeks 1-3 / 4-6 / 7-9 (real fixtures vs site) and simulation inventory |
| b41c117 | Fixture: XT5/RV1 robot_state_publisher -p robot_description crash is caused by ': ' in the lesson xacro's comment (real Jazzy, with and without line 6) |
| 8fccfb5 | Physics: site vs real report; fix SUMMARY line on bridged /imu covariances (gyro 4e-8, accel 2.89e-4, orientation 0) |
| 3d3ea8c | Physics: collision detector/solver variants (not logged, no measurable change); RViz: view type defaults; RViz site vs real report |
| 4cd127b | AUDIT_V2: decision log, totals A-E, one prioritised difference list (student impact first), owner must-do list |
| 1098883 | Merge parity-v2 into fix-v2 |
| 5497e01 | Content XT5/RV1: chiku.urdf.xacro comment without ': ' so robot_state_publisher -p robot_description starts on real Jazzy |
| a081318 | Content D4/D13/F12: SetPen with 'off' quoted, so ros2 service call works on real Jazzy |
| 6865784 | Content F15: --params-file path that exists (src/chiku_control/config/speed.yaml from ~/ros2_ws) |
| 5ebfa0d | Content N10/N18/N19: load the workspace in the new terminal before running the lesson's own package |
| 6c5bb21 | Content N23: chiku_control declares pytest as its test dependency, so colcon test runs the 6 pytest tests |
| 11c6012 | FIX_V2 report: 5 course-content items fixed with real re-captures; AUDIT_V2 rows marked FIXED |
| ab869ee | fix-v2 local site check: 66/66 lesson tasks tick; site-vs-real differences recorded, AUDIT_V2 rows #40-#45 |
| 3cdc8a9 | AUDIT_V2: P1 row 3 and owner decision 1 match FIX_V2 (N23 cause established; content fixed in 5 commits) |
| 38f6eb6 | Content N4/N8: code blocks run the package that is in the lesson workspace (log_demo from chiku_control, safety_filter from chiku_control_cpp); re-captured on real, domain 52 |
| 68cb6a3 | FIX_V2: part 2 step 0 – checks and baseline gate (real-sweep 53 ok, 3 known BAD) |
| 6fee181 | tests/real-sweep.mjs: exit 1 when an entry is BAD and not in the known-issues list (SIM_INVENTORY #1, #3, #12) |
| 82248bf | Site N10: a TRANSIENT_LOCAL subscriber gets the message a running TRANSIENT_LOCAL publisher already sent (AUDIT_V2 #41) |
| a16d8e6 | Site: ros2 service call / topic pub fail like real on an unquoted off/on/yes/no/null/number key (AUDIT_V2 #40) |
| f00f97f | Site N19: node info of a C++ node lists a topic built from a parameter and the TransformBroadcaster's /tf publisher |
| ad58ea6 | Site: robot_state_publisher starts with 'Robot initialized' (and the kdl root-inertia warning), not one 'got segment' line per link (AUDIT_V2 #14) |
| 56af711 | Site: joint_state_publisher(_gui) prints the real startup lines with the logger joint_state_publisher (AUDIT_V2 #14) |
| f86a41b | Site: rclpy nodes have no /parameter_events subscriber in ros2 node info (AUDIT_V2 #42) |
| b6245b8 | Content XT5 task 8 / RV1 task 5: the RobotModel task ticks only once RViz subscribes /robot_description |
| 65ea3d7 | Site RViz: a single mouse click on a property value keeps its editor open |
| f72793c | site_lesson_check.mjs: set the RobotModel Description Topic with one click, as the lesson says |
| 916af89 | FIX_V2 part 2 report: housekeeping, N4/N8, 6 site terminal fixes, RViz editor fix, #44 left with evidence; AUDIT_V2 rows marked |

### 1b. Redesign (32 commits)

| Commit | Message |
|---|---|
| 3fa1a5b | docs: add redesign handoff (v3) under docs/redesign/ |
| c9f5b96 | docs: redesign inventory |
| 1867742 | content IN3: name the four ways nodes communicate (owner-approved one-time edit) |
| 109fc23 | robots/index.json: Waffle Pi display specs from the ROBOTIS e-Manual |
| 717930e | ui: v3 theme, header, footer |
| b57a57c | content: IN3 wording (four ways nodes communicate) |
| a39780e | ui: v3 home page with practice computer and Why ROS2Lab |
| 7d064de | ui: courses, certificate course plan and modelling pages |
| cc4833d | tests: Student portal check with the mock Firebase, compared with fix-v2's course.js |
| 27043a9 | tests: compare the Student portal with fix-v2 across 11 mock students |
| a3c1f7e | ui: robot simulator catalogue and robot info page |
| f60cc9e | ui: v3 student portal and lesson page |
| 40f210f | fix: restore catalogue hooks on featured TurtleBot3 cards |
| cf2904e | ui: v3 test page (header box, answer cards, sticky timer bar, result box) |
| 2924a02 | ui: v3 project page (status box, brief, marking scheme table with total, feedback) |
| 9b5e364 | ui: v3 account, log in and register forms |
| f176f0a | ui: v3 certificate Verify page (page head with ID + Check, status box, actions) |
| 3c3e8c8 | ui: v3 document style for resources, terms, privacy and 404 (.v3doc) |
| deb0143 | ui: v3 theme on the instructor dashboard (.v3admin) |
| 92005f3 | ui: v3 test, project, account, auth, verify, docs and admin pages |
| af834ef | ros: emulator accuracy fixes |
| a2e1153 | docs: engine merge plan |
| 7d9411d | docs: engine merge postponed |
| e1f664d | ros: accept quoted numbers in numeric fields |
| 581e3ce | ui: expert review fixes |
| 033bfc9 | ui: remove study-days note (owner decision) |
| 7d6127a | ui: wider desktop layout with fluid container |
| 1b3c1a2 | ui: larger, more legible type scale |
| 5ecc091 | ui: wider reading column, capped demo height |
| 3c74956 | ui: channel branding and certificate refinements |
| ddfc138 | ui: calm style check and playground |
| 127091a | ui: spacing and Why section check |

The last two commits are not in the table: `docs: merge checklist` (this file, the Playground lede width fix and the screenshot scripts writing to the temp folder by default) and `docs: overnight report`.

**Files outside `public/` and `docs/` that change on merge:** `functions/config.js` (certificate signer, part B),
`content/course-content.json` (the owner-approved IN3 edit and the fix-v2 content fixes), new and updated tests in
`tests/`, the parity kit under `parity/`. `firestore.rules`, `storage.rules` and `firebase.json` do not change.

## 2. Click through by hand before merging

Use the local site (`cd public && python3 -m http.server 8080`) or a Firebase preview channel (see 3b). Check on a
laptop and on a phone.

1. **Sign up.** Register a new test account: verify the email, fill in the details. Registration is automatic
   (`REGISTRATION_MODE = "auto"`), so no "waiting for approval" page should appear. Check the header switches from
   "Log in / Register free" to your account menu.
2. **A lesson with terminal tasks.** Open the Student portal → Continue, or `lesson.html?id=D4`. Type the task
   commands in the terminal: each task ticks, "Next" opens when all are done, and the progress shows in the portal.
   Check the terminal text size (15px on a laptop, 14px on a phone) and that Shift+Ctrl+O / E splits still work.
3. **A test.** Start a Week 1 test, answer, submit: score, best score and attempts left as before; answers can be
   reviewed only after a pass or the last attempt.
4. **The project page.** `project.html`: brief, marking table (40/15/20/10/15), submission form.
5. **The certificate Verify page.** `certificate.html` with no ID, a wrong ID (same message as before) and a real
   certificate ID: status box, Download PDF (one A4 landscape page), Add to LinkedIn, Copy link. Look at the seal
   ring text and the new statement. Already-issued certificates keep their stored signer; new ones get
   "Robotics & ROS 2 Lab · Course team, ROS2Lab" only after the functions are deployed (3c).
6. **Admin.** `admin.html` as the instructor: student list, test settings, content upload, project marking.
7. **Playground.** Play one game to a badge, open a robot mission (`playground.html#tf_detective`: "Not yet
   validated"), open an animation (`playground.html#lab-pubsub`).
8. **Home.** Practice computer (turtlesim + teleop), Gazebo demo (Start Gazebo; at most about 640px tall on a
   laptop), the sample certificate, the FAQ.

## 3. Merge and deploy (owner runs these; not run overnight)

### 3a. Merge

```bash
cd ~/ros2lab-course
git checkout master
git merge --ff-only ui-redesign      # fast-forward: master had no other commits
git push origin master
```

If you want `master` to stay small, do the screenshot clean-up in section 4 **before** this step.

### 3b. Optional: preview before going live

```bash
firebase hosting:channel:deploy redesign-preview --expires 7d    # a temporary URL; the live site is untouched
```

### 3c. Deploy

```bash
firebase deploy --only hosting       # the site (public/)
firebase deploy --only functions     # functions/config.js changed (certificate signer)
```

`firestore.rules` and `storage.rules` are unchanged, so `firestore:rules,storage` do not need a deploy.
Lessons are served from Firestore: the `content/course-content.json` changes reach students only after
"Upload course content" on the admin page (this keeps the live `totalMinutes` / `maxAttempts`, see STEP7_REPORT).

## 4. Size of `docs/redesign/shots/`

`docs/redesign/shots/` is **126 MB** in the working tree (step 7a alone is 46 MB, step 7 24 MB; the rest 2–9 MB per
step); `docs/redesign/` as a whole is 128 MB. The repository's packed history is 132 MB. Merging the branch as it is
adds these PNGs to `master`'s history for good.

Suggestions, smallest repo first:

1. **Keep the screenshots out of `master`.** Before merging, move `docs/redesign/shots/` to a separate branch or an
   archive (e.g. `tar czf ~/ros2lab-shots-2026-10-21.tgz docs/redesign/shots`), commit `git rm -r docs/redesign/shots`
   on `ui-redesign`, and merge with `git merge --squash ui-redesign` so the PNG blobs in the branch history do not
   reach `master`. (A squash merge loses the per-commit history on `master`; the `ui-redesign` branch keeps it.)
2. **Keep only the latest set.** Keep `stepA0/after`, `step8`, `step9`, `step10` (about 15 MB) and delete the rest.
   This shrinks the tree, but a normal merge still carries the old PNGs in history.
3. **Smaller images in future steps:** viewport-only JPEG or WebP at quality 80 (about a tenth of a full-page PNG),
   or Git LFS for `docs/**/shots/**/*.png`.

`tests/ui-*.mjs` write screenshots only when `SHOTS=` / `OUT=` is set; `tests/ui-member.mjs` always writes to
`docs/redesign/shots/step5b/` and must be followed by `git checkout -- docs/redesign/shots/step5b` (or changed to
write only with `SHOTS=`).
