# One practice-terminal engine (Prompt 6 plan)

## Owner decision (21 Oct 2026)

**Postponed** until the redesign is finished and launched. Do not start the merge before then.

Answers for later (the open questions at the end of this file):

1. The home page keeps ROS 2 already sourced.
2. Use the real 80-column usage text everywhere.
3. `printenv` matches real Jazzy; the site hint lines stay.

**Status: plan only, waiting for the owner's approval. Nothing below has been done.**

Today two engines run turtlesim on the site:

| | Lesson engine | Home page practice computer |
|---|---|---|
| Files | `public/js/terminal-sim.js` (2534 lines), `public/js/ros-graph.js` (2541), rendered by `lesson-render.js`; also used by `rviz-page.js` (Robot simulator) | `public/js/lab.js` (641, classic script, IIFE), `public/css/lab.css` (102); copy of `docs/redesign/lab/lab.js` |
| Used by | every lesson terminal block (508 tasks: `cmd` 296, `outputHas` 163, `rosNode` 48, …), the parity lesson harness, the simulator workbench (`rviz.html?robot=…`) | `index.html` only (`#try`) |
| Models | turtlesim, demo nodes, student packages, colcon, launch, Gazebo, ros2_control, MoveIt 2, Nav2, SLAM, RViz, nano, VS Code | turtlesim only |
| Output | DOM nodes with `textContent` (no HTML from data) | HTML strings written with `innerHTML`, escaped by `esc()` |

## Decision

**`terminal-sim.js` + `ros-graph.js` stay and become the only engine. `lab.js` is retired** after its strengths are ported.

Why this way round:

- The lesson engine carries every lesson task check, the parity hooks (`.tmr-pane[data-term]`, `.term-tasks li` className `"done"`, `.term-done`, `.term-viz`) and every non-turtlesim model.
- It already has most of the Terminator UI: splits (Shift+Ctrl+O/E), Alt+arrows, tabs, zoom, resize, the right-click menu and the teleop key pad.
- It writes text with `textContent`. `lab.js` writes HTML strings, which SECURITY.md rule "no innerHTML with data" would force us to rewrite anyway.

## What moves from lab.js into the lesson engine

| # | Feature (lab.js) | Goes to | Notes |
|---|---|---|---|
| 1 | Live turtlesim: 16 ms loop, `Math.fround` poses, wall warning on every tick while pushing, colour sensor from the pixel under the turtle | new `public/js/turtlesim-live.js` (model) used by `ros-graph.js`; drawing stays in `terminal-sim.js` `drawSim()` | Replaces `RosGraph.move()`'s instant 1 s step and the 700 ms tween. Keep a separate background layer under the path layer (already true in `drawSim`). |
| 2 | Teleop rotation keys `g b v c d e r t`, `f` (cancel), `q` (quit) | `RosGraph.teleopKey()` + the teleop key pad in `terminal-sim.js` | Banner is already fixed (this step). |
| 3 | Live `rotate_absolute`: feedback about every 120 ms, `[turtlesim]` logs "Rotation goal completed successfully" / "Rotation goal canceled" / "Rotation goal received before a previous goal finished. Aborting previous goal" / "Velocity command received during rotation goal. Aborting goal", ABORTED with the running delta | `ros-graph.js` `cmdAction` → an `asyncJob` (the same mechanism Nav2 goals already use) | Strings from turtlesim `turtle.cpp` (jazzy), confirmed in the installed binary. |
| 4 | Streaming `topic echo` / `topic pub` (without `--once`) / `topic hz` until Ctrl+C | `asyncJob` in `ros-graph.js` | Removes the site lines "Practice terminal stopped echo for you…" and "Practice terminal stopped after 3 messages…". |
| 5 | `rqt_graph` window (live SVG of nodes and topics) | new `public/js/rqt-graph-win.js`, opened like the other windows (`goal-pose`, RViz) | Build the SVG with `createElementNS` + `textContent`, not `innerHTML`. |
| 6 | Float32 pose values in echo (`x: 5.544444561004639`) | `ros-graph.js` `samples()` | lab.js matches real Jazzy here (ENGINE_DIFF row 3). |
| 7 | Ctrl+Shift+Q, Ctrl+Tab | `terminal-sim.js` `onKey()` | The lesson engine already has the rest (ros.md #14). |
| 8 | The desktop around the terminal: Ubuntu top bar, Terminator frame and title colours, draggable TurtleSim window, Play demo, Reset, command chips | new `public/js/practice-desktop.js` that calls `mountTerminal(container, spec)` with a home-page spec | `practice-desktop.js` owns only layout and the demo script; every command goes through the engine. |
| 9 | "ROS 2 already sourced" (lab.js acts as if `~/.bashrc` sources Jazzy) | a spec flag, e.g. `spec.bashrcSourced: true` → `sh.sourced = true` in every new pane | Lessons keep requiring `source` (44 tasks check `sourced`). |
| 10 | `window.__lab` debug handle (only with `?debug=1`) | `practice-desktop.js` exposes the same names over the engine (`run`, `panes`, `sim`, `stopDemo`, `split`, `sigint`, `focused`) | Keeps `tests/ui-home.mjs` and `tests/engine-diff.mjs` working during the change. |

Nothing moves the other way: lab.js has nothing the lesson engine needs for Gazebo, MoveIt, Nav2 or the tasks.

After the move: delete `public/js/lab.js` and `public/css/lab.css`, load `practice-desktop.js` (ES module) on `index.html`, and keep `docs/redesign/lab/` as the read-only reference.

## Risks for lesson task checks

`Shell.check()` reads `lastOutput` once, in `afterCommand()`, right after the command returns. Anything that turns an instant answer into a live one can stop a task from ticking.

| Risk | Tasks affected | How to avoid it |
|---|---|---|
| Live `rotate_absolute` (1 rad/s) ends after the command returns, so `SUCCEEDED` is not in `lastOutput` at check time | IN3 1, D8 3 (`outputHas: "SUCCEEDED"`); F13/F14 use the student's own action server, not turtlesim | When an `asyncJob` ends, append its lines to `lastOutput` and run `check()` again for the current task. Add this before making anything live. |
| Streaming `topic pub` without `--once` | 9 tasks `outputHas: "publishing #1"` (D4, D9, D13); most use `--once` | Same re-check on every streamed line, so `publishing #1` ticks as soon as it prints. |
| Streaming `topic echo` without `--once` | 6 tasks `outputHas: "theta"`, F3/F4/F10 `x: 1.0` / `z: 1.0` (all typed with `--once`, but students may omit it) | Same re-check on streamed lines. |
| Live turtle motion changes the pose at check time | 7 `turtle` checks, D4/D8 pose read-outs | `turtle` checks only test that a turtle exists; numbers are not checked. Run site_lesson_check over every turtlesim lesson (list below) and compare. |
| Float32 echo values | `outputHas: "2.0"` (F17/F19/F20) reads `param get`, not echo; no task matches a 6-decimal pose | None found. Re-check with the lesson run. |
| Hint lines that disappear (spawn hint, background hint, "stopped echo") | No task matches them (searched `course-content.json`) | None. |
| Ctrl+C / Enter while a live job runs in another pane of the same tab | Lessons with several terminals (`.tmr-pane[data-term]`) | Jobs belong to a pane, never to the page; `site_lesson_check.mjs` drives panes by `data-term`. |
| The simulator workbench (`rviz.html`) also mounts this engine | every `tests/real-*.mjs` suite | Turtlesim changes are behind turtlesim node kinds; run the real-* suites. |

Hooks that must not change: `.term-tasks li` className exactly `"done"`/`"now"`/`""`, `.tmr-pane[data-term]` with `.term-input-row input`, `.term-screen .line`, `.term-proc button`, `.term-done`, `.term-viz`, `#main`.

## Tests that prove nothing broke

Run before the merge (baseline) and after every step; numbers must not drop.

1. `node parity/scripts/lessons/site_lesson_check.mjs out.json` → 66 of 66 (this step's baseline).
2. The same script over every lesson with a turtlesim terminal: `A6,R4,IN1,IN3,IN4,IN7,D2,D3,D4,D6,D7,D7b,D8,D9,D12,D13,F3,F4,F5,F6,F7,F8,F9,F10,F11,F12,F13,F14,F15,F16,F17,F18,F19,F20,N5,N7b,N8,N10,N17b,N18,N19,N20,N22,N22b,N24b` (45 lessons; result of this step in the Prompt 6 report).
3. `node tests/engine-diff.mjs` → then rewritten to compare the one engine with the captures in `parity/fixtures/` and `parity/fixtures/cli/` (two engines no longer exist).
4. `node tests/ui-home.mjs`, `node tests/ui-student.mjs`, `node tests/ui-chrome.mjs`, `node tests/chrome-sync.test.mjs`.
5. `node tests/real-tb3.mjs`, `node tests/real-mobile-audit.mjs`, `node tests/real-sweep.mjs` (the workbench uses the same engine).
6. `npx playwright test -c parity/playwright.config.ts parity/e2e/review-should-fix.spec.ts parity/e2e/phone-layout.spec.ts`.
7. `node tools/security-check.mjs`.
8. New: `tests/turtlesim-live.mjs`: rotation goal success/cancel/abort logs and ABORTED delta, wall warning only while pushing, `-r` remap on teleop, background change keeps the trail, `rqt_graph` opens and Ctrl+C closes it, streamed `publishing #1` ticks a task.

## Order of work and time estimate

| Step | Work | Estimate |
|---|---|---|
| 1 | Re-check on streamed / async output (`afterCommand` for jobs) + test | 0.5 day |
| 2 | `turtlesim-live.js` model, drawing, wall warning, colour sensor, float32 echo | 2 days |
| 3 | Live `rotate_absolute`, teleop rotation keys, the four `[turtlesim]` logs | 1 day |
| 4 | Streaming echo / pub / hz | 1 day |
| 5 | rqt_graph window | 1 day |
| 6 | `practice-desktop.js` on the home page (desktop, demo, Reset, chips, `__lab` handle, `bashrcSourced`), remove lab.js / lab.css | 1.5 days |
| 7 | Full test run (list above), fixes, screenshots | 1.5 days |
| | **Total** | **about 8.5 working days** |

Each step is one commit and must pass tests 1–2 and 7 before the next starts.

## Open questions for the owner

1. Should the home page keep "ROS 2 already sourced" (lab.js today) while lessons require `source`? This plan says yes (flag per page).
2. The argparse usage text is now printed as real Jazzy prints it at 80 columns (`parity/fixtures/cli/argparse_missing_args.txt`). lab.js prints it on one line. The merged engine will use the 80-column text everywhere unless you prefer otherwise.
3. Remaining differences from real that are outside Prompt 6 and stay as they are until you decide: `printenv | grep ROS` order (ENGINE_DIFF row 2), and site hint lines after `service call /spawn` and `param set background_*`.
