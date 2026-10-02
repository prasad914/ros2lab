# ROS2Lab v3: how to update www.ros2lab.com

v3 turns the two-week course into **"ROS 2 from zero, in three weeks"**. It adds a whole new **Week 3: Speak ROS 2** (13 lessons, Days 11 to 15) that teaches the core ROS 2 concepts hands-on, a new **"Start here"** lesson, **13 interactive concept animations**, **six new puzzle types**, a practice terminal with a **live (simulated) ROS 2 graph**, and a **Week 3 test**. Student accounts, progress and test results are not touched.

## What is new

| Where | What changed |
|---|---|
| Week 3 (new module `W3`) | D1 What ROS 2 really is · D2 Nodes · D3 Topics · D4 Messages · D5 Write a publisher and subscriber · D6 Services · D7 Parameters · D8 Actions · D9 Launch files · D10 Packages and workspaces · D11 TF2 frames · D12 Debugging toolbox · D13 Mini-project |
| Week 1 | New first lesson **A0 Start here** (10 min). Every existing lesson gained an interactive part: folder-tree animation and path sorting (A2), command matching (A3, A6), permission-switch puzzle (A5), think-first boxes (A4), step-through code tracers (P1, P2, P3), spot-the-bug (P2) |
| Week 2 | Class-to-object animation (B2), `__init__` tracer (B3), spot-the-bug (B4, B8, C1), what-does-spin-do animation (B7), topic animation preview (B8), C++ loop tracer (C2), C++/Python matching (C3, C4), flashcards (R1, R4), think-first boxes (B5, R2, A7) |
| Practice terminal | With `"running": [...]` it simulates nodes running in other terminals: `ros2 node / topic / service / param / action / interface / bag / doctor`, `ros2 pkg create`, `colcon build` that finds real packages, and `ros2 run` of your own built package. Outputs follow the official ROS 2 Jazzy tutorials |
| Python playground | The practice rclpy now also has services (`create_service`, `create_client`, `call_async`), parameters (`declare_parameter`, `get_parameter`, start-up values from the lesson), `geometry_msgs` Twist and a pretend turtle that drives with your `/turtle1/cmd_vel` messages |
| Home page | "Three weeks", the 15-day route with a Week 3 line, a tabbed **Concept lab** of live animations, and a 6-step "How every lesson works" strip |
| Playground | New **Concept lab** section with all 13 animations (`playground.html#lab-pubsub`, `#lab-tf`, ...) |
| Week 3 test | 15 questions from 21 new templates (topics `graph`, `comm`, `tools`); every student gets a different paper |

## New lesson blocks (for `content/course-content.json`)

```
{ "t": "anim", "id": "pubsub", "intro": "optional sentence" }          ids: pathtree perms blueprint spin layers pubsub twist service params action launch workspace tf
{ "t": "trace", "title": "...", "lang": "python", "code": "...", "steps": [ { "line": 1, "vars": { "x": "3" }, "out": "printed text", "note": "what happens" } ] }
{ "t": "match", "q": "...", "pairs": [ { "a": "left", "b": "right" } ], "why": "...", "hint": "..." }
{ "t": "sort", "q": "...", "buckets": ["Topic", "Service"], "items": [ { "text": "...", "bucket": 0, "why": "..." } ], "why": "..." }
{ "t": "bug", "q": "...", "lang": "python", "code": "...", "line": 3, "why": "...", "fix": "corrected line", "hint": "..." }
{ "t": "think", "q": "question", "answer": "shown after the student guesses" }
{ "t": "cards", "title": "...", "items": [ { "front": "...", "back": "..." } ] }
{ "t": "term", "running": ["turtlesim", "teleop"], "sourced": true, ... }   running kinds: turtlesim teleop talker listener adder
{ "t": "py", ..., "params": { "max_speed": 0.8 }, "notContains": ["text that must not appear"] }
```

`match`, `sort` and `bug` count as practice parts (students must finish them). `anim`, `trace`, `think` and `cards` are optional. New terminal checks: `rosNode`, `turtle`, `param`, `wsPkg`.

## Step by step (Command Prompt)

**1. Back up the current folder.**
```
xcopy C:\ros2lab-course C:\ros2lab-course-backup /E /I /H /Y
```

**2. Copy the new files in.** Unzip the v3 zip and copy these into `C:\ros2lab-course`, choosing **Replace the files in the destination**:
```
public\                      (all website files, including js\anims, js\puzzles.js, js\ros-graph.js)
content\course-content.json
functions\questions\         (adds ros.js and the updated index.js)
functions\test\run-tests.js
tools\
README.md  COURSE-OUTLINE.md  UPDATE-GUIDE.md
```
Your `public\js\firebase-config.js` and `functions\config.js` in this zip are the files you sent. If you changed them since, keep your newer copies.

**3. Check everything on your laptop.**
```
cd C:\ros2lab-course
node tools\check-content.mjs
cd functions
npm test
cd ..
npx http-server -c-1 -p 8080
```
`check-content` replays every practice-terminal solution and runs every Python solution (it needs Python 3 installed). `npm test` checks all 98 question templates. Then open in Chrome (Ctrl+C in Command Prompt when done):
- http://localhost:8080/public/index.html (home page with the concept lab)
- http://localhost:8080/public/playground.html#lab (all 13 animations)
- http://localhost:8080/tools/preview.html?id=A0 then D1 to D13 (the new lessons)

**4. Publish to a private test address (preview channel).**
```
firebase hosting:channel:deploy v3 --expires 7d
```
Open the printed address on your laptop **and your phone**.

**5. Publish the website and the server code.** The Week 3 test needs the new question templates on the server, so this time deploy **functions** too:
```
firebase deploy --only hosting,functions
```
Do **not** run a plain `firebase deploy`. Database and storage rules did not change.

**6. Upload the new course content.** Open the site, then **Instructor → Course content →** choose `content\course-content.json` **→ Upload**. It reports 3 modules, 38 lessons and 3 tests. Existing test dates and settings are kept.

**7. Publish the Week 3 test.** New tests start **unpublished**. In **Instructor → Tests**, open "Week 3 test: ROS 2 core concepts", set its open and close dates, and publish it when your students reach Day 15.

**8. Check it.** Press **Ctrl+Shift+R** on each page to skip old cached files. Open My course, lesson A0, and lessons D2, D5 and D13. Students who completed lessons keep their progress; A0 and Week 3 appear as new lessons.

**9. If something is wrong, roll back.** Firebase console → **Hosting → Release history** → the release before today → **⋮ → Rollback**. To roll back the lessons too, upload the `course-content.json` from `C:\ros2lab-course-backup\content`. Roll back functions by deploying from the backup folder: `cd C:\ros2lab-course-backup && firebase deploy --only functions`.

**10. Tidy up after a week.**
```
firebase hosting:channel:delete v3
```

## www.ros2lab.com

Updating the site never touches DNS. Keep the Firebase **TXT** record in GoDaddy permanently, and do not turn on GoDaddy **Forwarding**.

Note: the public GitHub repository `prasad914/ros2lab` also has a `CNAME` file for www.ros2lab.com (GitHub Pages). Only one service can answer for the domain: if www.ros2lab.com should be the Firebase course, remove the custom domain from the GitHub Pages settings (or delete that `CNAME` file).
