#!/usr/bin/env bash
# ROS2Lab parity kit – unattended overnight run of P2 audit + P5 … P13 (TurtleBot3 only).
# Start from the repo root, inside tmux or with nohup (see the instructions you were given).
# Each step is a fresh, non-interactive Claude Code session (like /clear), so one bad step cannot poison the next.
# Claude Code's deny rules in .claude/settings.json (sudo, apt, git push, robots_sudo.sh …) still apply.

set -u
cd "$(git rev-parse --show-toplevel)" || { echo "Run this inside ~/ros2lab-course"; exit 1; }

MODEL="${MODEL:-opus}"                       # pinned model; override with MODEL=sonnet bash parity/scripts/overnight.sh
LOGDIR="$HOME/parity_overnight_logs/$(date +%F_%H%M)"
REPORT="parity/reports/OVERNIGHT.md"
RETRIES="${RETRIES:-3}"                                    # per step, for usage limits / network errors
WAIT_MIN="${WAIT_MIN:-20}"                                  # minutes to wait before a retry
FIX_ROUNDS="${FIX_ROUNDS:-2}"                # how many times to repeat P9 (parity runs) + P11 (fixes)
mkdir -p "$LOGDIR" parity/reports

# Extra tools Claude may use without asking (everything else that would prompt is denied in -p mode).
ALLOWED='Bash(node *),Bash(python3 *),Bash(npx *),Bash(npm install *),Bash(npm run *),Bash(git apply *),Bash(git rm *),Bash(git mv *),Bash(git add *),Bash(git commit *),Bash(git worktree *),Bash(git merge *),Bash(source *),Bash(timeout *),Bash(sleep *),Bash(xvfb-run *),Bash(ros2 *),Bash(gz *),Bash(bash parity/scripts/*),Bash(colcon *)'

# --- safety checks before starting ---------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Commit or stash first:"; git status --short; exit 1
fi
if env | grep -q '^ANTHROPIC_DEFAULT_.*=auto/'; then
  echo "An OmniRoute 'auto/' model mapping is set in this terminal. Open a plain terminal (claude logged in to claude.ai) and run again."; exit 1
fi
command -v claude >/dev/null || { echo "claude not found in PATH"; exit 1; }

START_BRANCH=$(git branch --show-current)
RUN_BRANCH="overnight-$(date +%F-%H%M)"
git switch -c "$RUN_BRANCH" || exit 1

{
  echo ""
  echo "# Overnight run $(date '+%F %H:%M') on branch $RUN_BRANCH (from $START_BRANCH, model $MODEL)"
  echo "Logs: $LOGDIR"
} >> "$REPORT"
git add "$REPORT" && git commit -q -m "Overnight run started on $RUN_BRANCH"

PREAMBLE='UNATTENDED OVERNIGHT RUN – nobody can answer questions or approve anything tonight; decide and act yourself.
Read CLAUDE.md and parity/CLAUDE.md first and follow them strictly: real ROS 2 Jazzy on this machine is the truth; never run sudo/apt; never push; never invent numbers, error strings, defaults or statuses (unmeasured = PENDING, unconfirmable = UNVERIFIED with the reason); every claim points to a file produced on this machine; never use the website'"'"'s own data as a reference for itself; never delete or overwrite the site'"'"'s own files outside what the step needs.
Scope tonight: TurtleBot3 models only (tb3_burger, tb3_waffle, tb3_waffle_pi). Other robots are not verified yet (P2b/P2c have not run) – skip them, do not edit their files, and say so in the report.
When a choice is unclear, take the option closest to real ROS 2 Jazzy behaviour and write the decision down.
Work in parts. After each part passes its tests, commit that part alone with a clear message (never push). Never leave work uncommitted at the end.
If something is blocked (needs sudo, a missing package, a denied permission, a real-ROS run that fails twice), write the exact error under this step in parity/reports/OVERNIGHT.md and continue with the next part instead of stopping.
Real simulations: one at a time, headless, with the domain/partition given in the prompt; always stop them with bash parity/scripts/stop_reference.sh <domain>.
Before you finish: stop every simulation, run the parity Playwright tests (npx playwright test -c parity/playwright.config.ts) and the unit tests (npx vitest run parity/unit), then append to parity/reports/OVERNIGHT.md under a heading with this step name: commits made, tests passed/failed (numbers from the actual run), and items still PENDING / UNVERIFIED / FAILED. Commit that report update.'

stop_sims() {
  for d in 41 42 43 44 45 46 47; do bash parity/scripts/stop_reference.sh "$d" >/dev/null 2>&1; done
}

run_step() {   # run_step <name> <prompt text>
  local name="$1" prompt="$2" attempt rc=1
  for attempt in $(seq 1 "$RETRIES"); do
    echo "[$(date '+%H:%M')] $name – attempt $attempt"
    claude -p "$PREAMBLE

STEP: $name
$prompt" \
      --model "$MODEL" \
      --permission-mode acceptEdits \
      --allowedTools "$ALLOWED" \
      --output-format text > "$LOGDIR/$name.attempt$attempt.log" 2>&1
    rc=$?
    stop_sims
    [ "$rc" -eq 0 ] && break
    echo "[$(date '+%H:%M')] $name failed (exit $rc) – see $LOGDIR/$name.attempt$attempt.log; waiting $WAIT_MIN min"
    sleep $((WAIT_MIN * 60))
  done
  # Keep anything the session left behind, so a power cut cannot lose it.
  if [ -n "$(git status --porcelain)" ]; then
    git add -A && git commit -q -m "WIP: uncommitted work left by overnight step $name (review)"
  fi
  {
    echo ""
    echo "## Runner note – $name: exit $rc at $(date '+%H:%M')"
    git log --oneline -8 | sed 's/^/    /'
  } >> "$REPORT"
  git add "$REPORT" && git commit -q -m "Overnight runner log: $name" || true
}

# --- the steps -------------------------------------------------------------------------------
run_step "P2-audit" 'Audit P2 for the TurtleBot3 models against parity/KICKOFF_PROMPT.md P2 and fill any gap, using the ros-reference subagent, domain 41, partition ref41:
- parity/fixtures/bag_manifest.md must list nav_robotis run1..run10 and every planner x controller pair including the 5 SmacLattice pairs, each with a bag and a runs/<pair>.json result. If a SmacLattice pair only configured but never drove to goal 1, run it now.
- parity/fixtures/tb3_burger/nav_robotis/runs/occupied_goal.json exists with status, error_code and error_msg; the website and parity/e2e/rviz-tools.spec.ts use exactly that code and text.
- No empty file remains in parity/fixtures/tb3_burger/nav_robotis/samples or qos for /plan and /particle_cloud.
- parity/robots/STATUS.md TurtleBot3 rows point to evidence files that exist in parity/fixtures/<model>/install_check/.'

run_step "P5" 'Run prompt P5 from parity/KICKOFF_PROMPT.md for the TurtleBot3 models. TurtleBot4 is not Verified – skip its part. The optional tb3_waffle_depth variant: only if it can be built honestly from the installed waffle model and clearly badged; otherwise skip.'

run_step "P6" 'Run prompt P6 from parity/KICKOFF_PROMPT.md for the TurtleBot3 models.
Before starting: in public/robots/tb3_*/nav2_params.json set each _header to the installed source (/opt/ros/jazzy/share/turtlebot3_navigation2/param/<model>.yaml; tb3_waffle_pi uses waffle_pi.yaml) and the installed version from `dpkg-query -W ros-jazzy-turtlebot3-navigation2`; the values already match the installed files (checked with diff) – re-check with diff and stop with a FAIL note if they do not.'

run_step "P7" 'Run prompt P7 from parity/KICKOFF_PROMPT.md for the TurtleBot3 models (run course-ui-reviewer for tb3_burger, tb3_waffle, tb3_waffle_pi). Keep concept texts short. Do not restructure pages of other robots beyond what the shared component requires; they must keep working.'

run_step "P8" 'Run prompt P8 from parity/KICKOFF_PROMPT.md.'

for round in $(seq 1 "$FIX_ROUNDS"); do
  run_step "P9-round$round" 'Run prompt P9 from parity/KICKOFF_PROMPT.md (Verified mobile robots = the TurtleBot3 models). Do not fix anything in this step.'
  if [ "$round" -eq 1 ]; then
    run_step "P10" 'Run prompt P10 from parity/KICKOFF_PROMPT.md for tb3_burger and tb3_waffle.'
  fi
  run_step "P11-round$round" 'Run prompt P11 from parity/KICKOFF_PROMPT.md. Tonight there is nobody to say "continue": do up to 10 fixes in this step, highest priority first, then summarise what changed and what still fails in parity/reports/OVERNIGHT.md and finish.'
done

run_step "P12" 'Run prompt P12 from parity/KICKOFF_PROMPT.md. Games whose readiness checks are PENDING or FAIL stay locked – that is a correct result, not something to work around.'

run_step "P13" 'Run prompt P13 from parity/KICKOFF_PROMPT.md. In SUMMARY.md the robots other than TurtleBot3 stay "Not yet validated". If the paper search is not available in this session, say so and leave papers.md unchanged.'

echo ""
echo "Finished at $(date '+%H:%M'). Branch: $RUN_BRANCH. Report: $REPORT. Logs: $LOGDIR"
