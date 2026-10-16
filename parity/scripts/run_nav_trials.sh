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

source "$(dirname "$0")/env.sh"
export ROS_DOMAIN_ID=$DOMAIN

mkdir -p "parity/fixtures/$ROBOT/$SCEN/bags" "parity/fixtures/$ROBOT/$SCEN/runs"

for i in $(seq "$START" "$END"); do
  LABEL="run$i"
  echo "=========================================================="
  echo "Starting Navigation Trial: $LABEL (Domain: $DOMAIN, $(date -Iseconds))"
  echo "=========================================================="

  # 1. Stop any existing reference stack
  bash parity/scripts/stop_reference.sh "$DOMAIN" || true
  sleep 3

  # 2. Start clean reference stack
  bash parity/scripts/start_reference.sh "$ROBOT" "$SCEN" "$DOMAIN" "$PART"
  echo "Waiting 15s for Gazebo and Nav2 startup..."
  sleep 15

  # 3. Start rosbag recording
  bash parity/scripts/record_bag.sh start "$ROBOT" "$SCEN" "$DOMAIN" "$LABEL"
  sleep 2

  # 4. Run drive_goals.py across all 5 goals
  echo "Driving 5 goals for $LABEL..."
  python3 parity/scripts/drive_goals.py --all-goals --run-label "$LABEL" || echo "Warning: drive_goals exited with non-zero code for $LABEL"

  # 5. Stop rosbag recording
  echo "Stopping bag recording for $LABEL..."
  bash parity/scripts/record_bag.sh stop "$DOMAIN"
  sleep 3

  # 6. Stop reference stack
  echo "Stopping reference simulation for $LABEL..."
  bash parity/scripts/stop_reference.sh "$DOMAIN" || true
  sleep 3

  echo "Completed Navigation Trial: $LABEL"
  echo ""
done

echo "All navigation trials $START to $END completed successfully!"
