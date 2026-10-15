# ROS2Lab parity kit v2 – what changed today and how to restart

Claude Code runs on your Ubuntu 24.04 + ROS 2 Jazzy machine, records what real ROS 2 does, tests the ROS2Lab website the same way, compares the two and fixes the website. Version 2 folds in every correction made during 15 Oct 2026.

## 1. What changed from v1 to v2

| # | Change | Why |
|---|---|---|
| 1 | Everything now lives in `parity/` (plus `.claude/agents/` and `.claude/settings.json`) | v1 copied `CLAUDE.md`, `KICKOFF_PROMPT.md`, `REQUIREMENTS.md`, `README.md`, `docs/`, `scripts/` and `tests/` into the repo root, where your site already had files with those names; they could be overwritten or mixed |
| 2 | Your `CLAUDE.md` only gains one line: `@parity/CLAUDE.md` | Keeps your own instructions intact |
| 3 | Website start command fixed: `npm run dev` → http://127.0.0.1:8000 | The site is a static Firebase Hosting site (`public/`); it had no `dev` script |
| 4 | Parity browser tests use their own `parity/playwright.config.ts` | Your repo already has Playwright tests; the two must not mix |
| 5 | Permissions: sudo blocked even inside scripts; `install_ros_extras.sh` and `robots_sudo.sh` denied by name | In v1, `bash scripts/*` let Claude start a script that calls sudo |
| 6 | One shared `parity/scripts/env.sh` sources ROS 2 Jazzy, `TB3_WS` and `ROBOTS_WS` | Source-built robots in `~/robots_ws` must be visible to every script |
| 7 | `parity/scripts/install_ros_extras.sh` (you run it) installs every needed apt package that exists for Jazzy and lists the rest | One step instead of guessing package names |
| 8 | P2 now includes the TF check (no `map` frame without SLAM/AMCL), the goal check against the saved map, the 10 navigation runs and the planner × controller runs | The first P2 run skipped steps 4–5 and had a suspicious TF tree and unchecked goals |
| 9 | New P2b: install or port every other robot, strict rules | Robots were marked OFFICIAL-JAZZY before they were built or seen to move; the Dobot model came from the website itself; Scout's launch was a hardware driver |
| 10 | `parity/robots/STATUS.md` has Built and Verified columns; a robot is only OFFICIAL-JAZZY or ROS2LAB-PORT with saved evidence (controllers active, topic list, motion) | "Cloned" or "installed" is not "working" |
| 11 | New P2c: ground truth for other verified mobile robots (TurtleBot4, Scout) | They need the same evidence as TurtleBot3 before parity tests |
| 12 | Arms (UR5e, Franka FR3, xArm Lite 6, Interbotix WX250s, Dobot CR5) stop after P2b | Navigation checks don't apply to arms; manipulation prompts come later |
| 13 | Prompts P3–P13 only test robots with Verified = yes, and reports show each robot's status label | No parity claims for unverified robots or ports presented as official |
| 14 | P2b works in two phases: Phase A clones every robot and collects ALL missing system dependencies into one `robots_sudo.sh` (one stop for you); Phase B builds and verifies one robot at a time and moves on if a robot is blocked | The first robots run stopped after 1.5 hours on one missing dependency at a time (libasio-dev for Scout, libfranka for Franka) |
| 15 | Non-ROS libraries such as libfranka are built inside `~/robots_ws` with colcon; `rosdep install --simulate`, `git submodule`, `apt-cache` allowed; plain `rosdep install` and `make install` denied | Claude's libfranka build was blocked, and a plain `rosdep install` would call sudo |

Upstream facts checked today: Franka `franka_ros2` and `xarm_ros2` both have official Jazzy branches. Dobot's official ROS 2 repo supports Humble only, so the CR5 must be a ROS2LAB-PORT built from Dobot's files. An official Interbotix Jazzy branch could not be confirmed; P2b must prove it with `git ls-remote`.

## 2. Where your repo is now (attempt 1)

- v1 kit files are mixed into the repo root and `docs/`, `scripts/`, `tests/`.
- `package.json` has the `dev` script (keep it).
- P0 ran; P2 ran partly (sensors, SLAM, map, goals – goals not checked; navigation and planner runs missing).
- `~/robots_ws` has clones for Scout, Franka, xArm, Interbotix and a Dobot setup; most were never built or verified.
- `docs/robots/STATUS.md` claims more than was proven.

Nothing here is lost: step B below saves it on a branch.

## 3. Restart, step by step

**A. Stop everything.** Exit Claude Code (`/exit`). Then: `pkill -f "gz sim"; pkill -f ros2` (stops any leftover simulations).

**B. Save attempt 1 on its own branch:**
```bash
cd ~/ros2lab-course
git add -A && git commit -m "Parity attempt 1 (v1 kit) - archived"
git branch parity-attempt1
git log --oneline -15
```
Find the last commit made **before** the v1 kit was copied in (usually just before "Add ROS2Lab parity kit"). That is your baseline.

**C. Start a clean branch from the baseline:**
```bash
git checkout -b parity-v2 <baseline-commit-id>
npm pkg set scripts.dev="python3 -m http.server 8000 --directory public"
```
This brings back your own `CLAUDE.md`, `README.md`, `scripts/`, `tests/` and `docs/` exactly as they were. If you cannot find a baseline (the kit was copied before the first commit), stay on your current branch and ask Claude in step F to remove the v1 files listed in section 5.

**D. Add kit v2:**
```bash
cd ~/Downloads && unzip -o ros2lab-parity-kit-v2.zip
cd ~/ros2lab-course
cp -r ~/Downloads/ros2lab-parity-kit-v2/parity .
mkdir -p .claude/agents
cp ~/Downloads/ros2lab-parity-kit-v2/.claude/agents/*.md .claude/agents/
cp ~/Downloads/ros2lab-parity-kit-v2/.claude/settings.json .claude/settings.json   # if you already had one, merge by hand instead
echo '@parity/CLAUDE.md' >> CLAUDE.md
chmod +x parity/scripts/*.sh
printf 'parity/fixtures/**/bags/\nparity/browser_out/\nparity/compare/exports/\n' >> .gitignore
git add -A && git commit -m "Add ROS2Lab parity kit v2"
```

**E. Install packages (you, not Claude):**
```bash
bash parity/scripts/install_ros_extras.sh            # add --no-arms to skip MoveIt/UR for now
echo 'export ROBOTS_WS=~/robots_ws' >> ~/.bashrc     # keep the existing clones
source ~/.bashrc
bash parity/scripts/check_env.sh                     # must end with OK
```

**F. Run the prompts.** Terminal 1: `npm run dev` (leave it running). Terminal 2: `claude`, accept the trust prompt, type `@` and check the six agents are listed. Then for each prompt: `/clear`, then
`Read parity/KICKOFF_PROMPT.md and run prompt P0 exactly as written.` (then P1, P2, P2b, P2c, P3 … P13).

| After | Check before going on |
|---|---|
| P0 | `parity/reference/verify_results.md`, `parity/reports/00-site-map.md`, `parity/robots/STATUS.md` (TurtleBot3 rows only filled) |
| P1 | Diff adds read-only hooks and `parity/playwright.config.ts` only |
| P2 | Six numbered results; no `map` frame in sensors TF; `parity/fixtures/goals_check.md`; bag list incl. run1..run10 and planner × controller labels |
| P2b | After each robot: its STATUS row with Built, Verified, launch command and three evidence files; run the launch command yourself once |
| P2c | Fixtures for each verified mobile robot |
| P3 … P13 | As in the How-to-Run guide |

When Claude stops and asks you to run `parity/scripts/robots_sudo.sh`, read it (`cat`), run it yourself, then type `Done, continue P2b.`

## 4. Files in this kit

| Path | Purpose |
|---|---|
| `parity/CLAUDE.md` | Rules Claude reads every session |
| `parity/KICKOFF_PROMPT.md` | Prompts P0, P1, P2, P2b, P2c, P3 … P13 |
| `parity/REQUIREMENTS.md` | Every request → where it is handled |
| `parity/reference/` | Target spec S1–S14, concept cards, papers |
| `parity/mistakes.yaml` | 27 student mistakes |
| `parity/playground.md`, `parity/thresholds.yaml` | Games; your pass limits |
| `parity/scripts/` | env, check_env, install_ros_extras (you), capture_installed, verify_facts, start/stop_reference, capture_reference, record_bag |
| `parity/fixtures/`, `browser_out/`, `e2e/`, `compare/`, `reports/`, `robots/` | Filled by the prompts |
| `.claude/agents/` | ros-reference, web-tester, parity-judge, student-persona, course-ui-reviewer, emulator-fixer |
| `.claude/settings.json` | Allowed and denied commands |

## 5. v1 files to remove if you cannot use a baseline commit

Only these came from kit v1 (check each with `git log --oneline -- <path>` before deleting; anything older than the kit is yours):
`KICKOFF_PROMPT.md`, `REQUIREMENTS.md`, the kit's `README.md` and `CLAUDE.md` content, `scripts/check_env.sh`, `scripts/capture_installed.sh`, `scripts/verify_facts.sh`, `scripts/start_reference.sh`, `scripts/stop_reference.sh`, `scripts/capture_reference.sh`, `scripts/record_bag.sh`, `scripts/install_ros_extras.sh`, `scripts/robots_sudo.sh`, `tests/mistakes.yaml`, `tests/fixtures/`, `docs/parity/`, `docs/reference/nav2_jazzy_spec.md`, `docs/reference/concepts.md`, `docs/reference/papers.md`, `docs/reference/verify_results.md`, `docs/robots/`, `docs/prompts/`.
