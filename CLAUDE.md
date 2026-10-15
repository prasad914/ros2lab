# ROS2Lab – parity testing rules (read every session)

This repo is the ROS2Lab website: a browser emulation of Gazebo + RViz2 + Nav2 + SLAM Toolbox for ROS 2 courses.
This machine also has a REAL ROS 2 Jazzy install (Ubuntu 24.04, Gazebo Harmonic). The real install is the ground truth.

## Golden rules
1. Real ROS 2 Jazzy on this machine is the reference. The website must match it, never the other way round.
2. Order of truth: captured fixtures (tests/fixtures/) > installed config files (tests/fixtures/_installed/) > docs/reference/nav2_jazzy_spec.md > anything else. If the spec disagrees with a fixture or installed file, follow the fixture and update the spec line.
3. Never invent numbers, error strings, topic names, defaults or accuracy figures. Every claim in a report must point to a file produced by a command run on this machine. Unmeasured = PENDING; unconfirmable = UNVERIFIED, with the reason.
4. Faithful error first, beginner hint second: the browser shows the same error text real ROS shows, then a short hint.
5. Each robot shows only what the real robot has (e.g. tb3_burger has no camera). Non-standard variants carry a visible badge.
6. Do not run `sudo`, `apt`, or change system files. If a package is missing, stop and list the exact `sudo apt install ...` command for the instructor.
7. Concept text on course pages stays short (see docs/reference/concepts.md) – no long paragraphs.

## Key files
- docs/reference/nav2_jazzy_spec.md – what the site must match (S1 architecture … S14 metrics)
- docs/reference/concepts.md – short concept cards · docs/reference/papers.md – references
- tests/mistakes.yaml – student mistakes to reproduce on both sides
- docs/parity/playground.md – games and their readiness checks · docs/parity/thresholds.yaml – instructor's pass limits (never edit)
- KICKOFF_PROMPT.md – the prompt sequence P0–P13

## Running real ROS 2 (reference side)
- Scripts source `/opt/ros/jazzy/setup.bash`, and `$TB3_WS/install/setup.bash` if TB3_WS is set (source-built TurtleBot3).
- Start simulators HEADLESS and in the BACKGROUND via `scripts/start_reference.sh`; stop with `scripts/stop_reference.sh`. Never leave Gazebo running after a task.
- One real simulation at a time unless the task says otherwise. Each run uses its own `ROS_DOMAIN_ID` and `GZ_PARTITION` (given in the task).
- `use_sim_time:=True` everywhere in simulation.
- Evidence: `scripts/capture_installed.sh` + `scripts/verify_facts.sh` (installed configs and facts), `scripts/capture_reference.sh` (snapshot), `scripts/record_bag.sh start|stop` (time series, MCAP).

## Running the website (browser side)
- Start the dev server with the repo's usual command (see package.json); reuse it if already running.
- Test with Playwright (headless Chromium) and vitest. Emulator state is read from `window.__ros2lab`, not from pixels.

## Layout
- `tests/fixtures/<robot>/<scenario>/` – evidence from real Jazzy (never hand-edit)
- `tests/browser_out/<robot>/<scenario>/` – what the browser produced
- `tests/e2e/`, `tests/parity/`, `tests/reports/`
- `docs/parity/<robot>.md`, `FAILS.md`, `MISTAKES.md`, `COURSE_ISSUES.md`, `SUMMARY.md`

## Robots in scope
tb3_burger, tb3_waffle, tb3_waffle_pi first; tb4 if its packages are installed; any other robot on the site only after its real Jazzy packages and launch are confirmed on this machine (otherwise mark it UNVERIFIED and do not claim parity).

## Commits
Small commits, one concern each, with tests. Do not push.
@parity/CLAUDE.md
