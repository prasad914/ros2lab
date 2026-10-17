#!/usr/bin/env bash
# run_nav_trials.sh - Execute sequential Nav2 navigation trials with bag recording.
# Usage: run_nav_trials.sh [start_run] [end_run]
set -euo pipefail

START=${1:-1}
END=${2:-10}
DOMAIN=41
ROBOT=tb3_burger
SCEN=nav_robotis
PART=ref41
READY_LIMIT=${READY_LIMIT:-300}        # wall-clock seconds for Nav2 to come up
LOCALIZE_LIMIT=${LOCALIZE_LIMIT:-120}  # wall-clock seconds for /amcl_pose after /initialpose
FAILED=""

source "$(dirname "$0")/env.sh"
export ROS_DOMAIN_ID=$DOMAIN

mkdir -p "parity/fixtures/$ROBOT/$SCEN/bags" "parity/fixtures/$ROBOT/$SCEN/runs"

for i in $(seq "$START" "$END"); do
  LABEL="run$i"
  echo "=========================================================="
  echo "Starting Navigation Trial: $LABEL (Domain: $DOMAIN, $(date -Iseconds))"
  echo "=========================================================="

  # 1. Stop any existing reference stack (stop_reference.sh itself waits until the domain is empty)
  bash parity/scripts/stop_reference.sh "$DOMAIN" || true

  # 2. Start clean reference stack and wait until Nav2 is up (clock, navigate_to_pose, lifecycle managers active)
  bash parity/scripts/start_reference.sh "$ROBOT" "$SCEN" "$DOMAIN" "$PART"
  if ! python3 parity/scripts/wait_nav_ready.py --limit "$READY_LIMIT"; then
    echo "ERROR: Nav2 not ready for $LABEL within $READY_LIMIT s wall (see above); skipping this run"
    FAILED="$FAILED $LABEL"; bash parity/scripts/stop_reference.sh "$DOMAIN" || true; continue
  fi

  # 3. Start rosbag recording. Settle 2 s: the recorder subscribes after discovery and there is no ready signal.
  bash parity/scripts/record_bag.sh start "$ROBOT" "$SCEN" "$DOMAIN" "$LABEL"
  sleep 2

  # 4. Localize (publish start_pose until /amcl_pose arrives), inside the bag, then drive all 5 goals
  if ! python3 parity/scripts/wait_nav_ready.py --limit "$READY_LIMIT" --localize --localize-limit "$LOCALIZE_LIMIT"; then
    echo "ERROR: robot not localized for $LABEL within $LOCALIZE_LIMIT s wall (no /amcl_pose); skipping this run"
    FAILED="$FAILED $LABEL"
  else
    echo "Driving 5 goals for $LABEL..."
    python3 parity/scripts/drive_goals.py --all-goals --skip-init-pose --run-label "$LABEL" || echo "Warning: drive_goals exited with non-zero code for $LABEL"
  fi

  # 5. Stop rosbag recording (record_bag.sh stop waits for the recorder to exit)
  echo "Stopping bag recording for $LABEL..."
  bash parity/scripts/record_bag.sh stop "$DOMAIN"

  # 6. Stop reference stack
  echo "Stopping reference simulation for $LABEL..."
  bash parity/scripts/stop_reference.sh "$DOMAIN" || true

  echo "Completed Navigation Trial: $LABEL"
  echo ""
done

if [ -n "$FAILED" ]; then
  echo "Navigation trials $START to $END finished; NOT READY (skipped):$FAILED"
  exit 1
fi
echo "All navigation trials $START to $END completed successfully!"
