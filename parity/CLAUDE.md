# ROS2Lab parity kit v2 – rules (imported from the repo's CLAUDE.md with `@parity/CLAUDE.md`)

This repo is the ROS2Lab website (ros2lab.com): a browser emulation of Gazebo + RViz2 + Nav2 + SLAM Toolbox for ROS 2 courses. It is a Firebase Hosting site: pages in `public/`, Cloud Functions in `functions/`.
This machine also has a REAL ROS 2 Jazzy install (Ubuntu 24.04, Gazebo Harmonic). The real install is the ground truth.
Everything belonging to the parity kit lives under `parity/` (plus `.claude/agents/` and `.claude/settings.json`). Do not put parity files anywhere else, and do not move or overwrite the site's own `docs/`, `scripts/`, `tests/`, `ground-truth/` or `UPDATE-*.md` files.

## Golden rules
1. Real ROS 2 Jazzy on this machine is the reference. The website must match it, never the other way round.
2. Order of truth: captured fixtures (`parity/fixtures/`) > installed config files (`parity/fixtures/_installed/`) > `parity/reference/nav2_jazzy_spec.md` > anything else. If the spec disagrees with a fixture or installed file, follow the fixture and update the spec line.
3. Never invent numbers, error strings, topic names, defaults, accuracy figures or statuses. Every claim in a report points to a file produced by a command run on this machine. Unmeasured = PENDING; unconfirmable = UNVERIFIED, with the reason.
4. A thing is "working" only after it was built, launched and seen to work, with evidence files. "Source cloned" or "package installed" is not working.
5. Faithful error first, beginner hint second: the browser shows the same error text real ROS shows, then a short hint.
6. Each robot shows only what the real robot has (tb3_burger has no camera). Non-standard variants carry a visible badge.
7. Never use the website's own robot models or data as a reference for itself.
8. Do not run `sudo`, `apt`, a plain `rosdep install` (it calls sudo), `make install`, `parity/scripts/install_ros_extras.sh` or `parity/scripts/robots_sudo.sh`. Use `rosdep check` / `rosdep install --simulate` to find dependencies, write every command that needs sudo into `parity/scripts/robots_sudo.sh`, and stop once for the instructor. Non-ROS libraries are built inside `~/robots_ws` with colcon.
9. Concept text on course pages stays short (see `parity/reference/concepts.md`).

## Key files
- `parity/KICKOFF_PROMPT.md` – the prompt sequence (P0 … P13)
- `parity/reference/nav2_jazzy_spec.md` – what the site must match (S1 … S14)
- `parity/reference/concepts.md`, `parity/reference/papers.md`
- `parity/mistakes.yaml` – student mistakes to reproduce on both sides
- `parity/playground.md` – games and readiness checks · `parity/thresholds.yaml` – instructor's pass limits (never edit)
- `parity/robots/STATUS.md` – one row per robot with its install status (see below)

## Running the website
- Dev server: `npm run dev` → http://127.0.0.1:8000 (serves `public/`). Reuse it if already running; start it in the background if not.
- Browser tests: Playwright with `parity/playwright.config.ts`, specs in `parity/e2e/`. Read emulator state from `window.__ros2lab`, never from pixels.

## Running real ROS 2
- Every script sources `parity/scripts/env.sh`: ROS 2 Jazzy, then `$TB3_WS` and `$ROBOTS_WS` overlays when set, then moves to the repo root.
- Start simulators HEADLESS and in the BACKGROUND with `parity/scripts/start_reference.sh`; always stop with `parity/scripts/stop_reference.sh <domain>`. Never leave Gazebo running.
- One real simulation at a time unless told otherwise; each run uses its own `ROS_DOMAIN_ID` and `GZ_PARTITION` (given in the task).
- `use_sim_time:=True` everywhere in simulation.
- Evidence: `capture_installed.sh` + `verify_facts.sh` (installed configs), `capture_reference.sh` (snapshot), `record_bag.sh start|stop` (time series, MCAP).

## Robots and their status (`parity/robots/STATUS.md`)
Columns: Robot · Category (mobile / arm) · Source (apt packages, or repo URL + branch + commit) · Built · Verified · Status · Launch command · Evidence.
Status values:
- OFFICIAL-JAZZY – from Jazzy apt packages or the maker's Jazzy branch; built and verified.
- ROS2LAB-PORT – the maker's older (e.g. Humble) code ported by us; built and verified; changes listed in `parity/robots/<robot>/PORTING.md`. Reports say clearly that the website is compared against our port.
- NOT BUILT / NOT VERIFIED – work in progress; never tested for parity.
- FAILED – could not be made to work; the exact blocking error is recorded.
"Verified" means all three evidence files exist in `parity/fixtures/<robot>/install_check/`: controllers active (`ros2 control list_controllers`), topic list, and motion proof (mobile: `/odom` changes under TwistStamped `/cmd_vel`; arm: `/joint_states` changes after a trajectory or MoveIt execution).
Mobile robots (TurtleBot3 models, TurtleBot4, Scout) are judged with the navigation checks. Arms (UR5e, Franka FR3, xArm Lite 6, Interbotix WX250s, Dobot CR5) are NOT judged with navigation checks; they wait for the manipulation prompts (M-series, not in this kit yet).
Order of work: TurtleBot3 first (P3 … P11), then other verified mobile robots.

## Layout under parity/
`fixtures/` real-ROS evidence (never hand-edited) · `browser_out/` what the website produced · `e2e/` Playwright specs · `compare/` comparison code · `reports/` all reports (FAILS.md, MISTAKES.md, COURSE_ISSUES.md, SUMMARY.md, <robot>.md, rviz_parity.md, bugs/) · `robots/` STATUS.md, PORTING.md, scenario scripts · `scripts/` · `reference/`.

## Commits
Small commits, one concern each, with tests. Never push.
