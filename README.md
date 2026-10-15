# ROS2Lab parity kit for Claude Code

Lets Claude Code, running in a terminal on your Ubuntu 24.04 + ROS 2 Jazzy machine, compare every ROS2Lab website feature with real ROS 2 Jazzy using subagents, rebuild what is missing, and fix what does not match. `REQUIREMENTS.md` maps every request from our conversation to the file or prompt that handles it.

## How it works

```
real ROS 2 Jazzy (headless Gazebo, Nav2, SLAM)      ROS2Lab website (Playwright, headless Chromium)
        │  ros-reference agent                              │  web-tester agent
        ▼                                                   ▼
 tests/fixtures/<robot>/<scenario>/   ──►  parity-judge  ◄──  tests/browser_out/<robot>/<scenario>/
 tests/fixtures/_installed/ (configs)        │
                                   docs/parity/*.md (PASS / FAIL / PENDING)
                                              │
                    emulator-fixer (one FAIL each, in its own git worktree)
 student-persona agents make course mistakes on both sides · course-ui-reviewer checks each robot page
```

## What is in the kit

| Path | Purpose |
|---|---|
| CLAUDE.md | Rules Claude Code reads every session (real Jazzy is truth, no invented numbers, faithful errors) |
| KICKOFF_PROMPT.md | Prompts P0–P13, pasted one at a time |
| REQUIREMENTS.md | Checklist: each of your requests → where it is handled |
| docs/reference/nav2_jazzy_spec.md | Everything the site must match (architecture, TF, Fixed Frame, tools, Nav2, costmaps, AMCL, SLAM, sensors, RViz, tool inventory, UI hierarchy, robot combos, metrics) with [VERIFY] marks |
| docs/reference/concepts.md | Short student concept cards |
| docs/reference/papers.md | Papers from the research, with gaps |
| tests/mistakes.yaml | 27 student mistakes with persona, level, how to reproduce, what the browser must do |
| docs/parity/playground.md | 15 games with learning goals, readiness checks, scoring |
| docs/parity/thresholds.yaml | Your pass limits (fill in before P9) |
| .claude/agents/ | ros-reference, web-tester, parity-judge, student-persona, course-ui-reviewer, emulator-fixer |
| .claude/settings.json | Pre-approved commands; blocks sudo, apt, git push |
| scripts/ | check_env, capture_installed, verify_facts, start/stop_reference, capture_reference, record_bag |

## One-time setup (you, not Claude)

1. Install Claude Code on the Ubuntu machine: `curl -fsSL https://claude.ai/install.sh | bash`, open a new terminal, run `claude --version`. Needs a Pro, Max, Team, Enterprise or Console account.
2. Install the reference stack. Start with:
   `sudo apt install ros-jazzy-desktop ros-jazzy-ros-gz ros-jazzy-navigation2 ros-jazzy-nav2-bringup ros-jazzy-nav2-minimal-tb* ros-jazzy-slam-toolbox ros-jazzy-turtlebot3* ros-jazzy-rosbag2-storage-mcap xvfb`
   then run `bash scripts/check_env.sh` – it prints the exact command for anything still missing (required and optional, e.g. TurtleBot4, docking, cartographer).
   If you build TurtleBot3 from source as the ROBOTIS guide does, `export TB3_WS=~/turtlebot3_ws` before starting `claude`; every script then sources it.
3. Copy this kit's `CLAUDE.md`, `REQUIREMENTS.md`, `KICKOFF_PROMPT.md`, `.claude/`, `scripts/`, `tests/` and `docs/` into the root of the website repo. Merge with any existing `CLAUDE.md` or `.claude/settings.json` instead of overwriting.
4. `chmod +x scripts/*.sh`; in the website repo `npm install` and `npx playwright install chromium`.
5. Make sure the repo is a git repository with a clean working tree (the fixer uses git worktrees).
6. Before P9, fill in `docs/parity/thresholds.yaml` (leave `null` to get raw numbers only).

## Run

```
cd ~/ros2lab-website
export TB3_WS=~/turtlebot3_ws   # only if TurtleBot3 is built from source
claude
```
Paste P0 from `KICKOFF_PROMPT.md`, read its report, then continue with P1, P2, …

## Things to know

- **Text, not pictures:** comparisons use topics, types, QoS, TF, params, error text, paths, trajectories, costmaps and AMCL data from files. Screen-only RViz messages are marked UNVERIFIED.
- **One real simulation at a time** by default, to avoid CPU/GPU contention skewing timings. Separate `ROS_DOMAIN_ID`/`GZ_PARTITION` values keep runs apart.
- **Stochastic parts (AMCL, MPPI)** are repeated (default 10 runs) and reported as mean ± sd.
- **Usage:** every subagent uses your Claude plan's usage; P2, P6, P9–P11 use the most. Run them when the machine can work unattended.
- **Not confirmed by me:** the scripts have been syntax-checked but not run on a real Jazzy machine. Launch arguments for the ROBOTIS packages, whether Gazebo starts paused for TB4, and the [VERIFY] items in the spec are checked by P0 on your machine.
