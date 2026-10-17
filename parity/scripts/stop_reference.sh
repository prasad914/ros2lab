#!/usr/bin/env bash
# Stop every run started by start_reference.sh for one ROS_DOMAIN_ID, then check that nothing is left.
# Usage: stop_reference.sh <ros_domain_id>
# Each run has its own pid file in /tmp/ros2lab_ref/. The pid files are removed only when no process
# with that ROS_DOMAIN_ID is still alive; otherwise they are kept and the script exits 1.
set -u
DOMAIN=${1:?domain id}
RUN_DIR=/tmp/ros2lab_ref
source "$(dirname "$0")/domain_procs.sh"

shopt -s nullglob
RUN_FILES=("$RUN_DIR/$DOMAIN"-*.pids)
if [ ${#RUN_FILES[@]} -eq 0 ] && [ -z "$(domain_pids "$DOMAIN")" ]; then
  echo "nothing running for domain $DOMAIN"
  exit 0
fi

# Process-group leaders from every run file (setsid makes each leader's pid its group id).
LEADERS=$(cat "${RUN_FILES[@]}" 2>/dev/null | sort -u)

signal_all() {
  local sig=$1 pid
  for pid in $LEADERS; do kill "-$sig" -- "-$pid" 2>/dev/null; done
  for pid in $(domain_pids "$DOMAIN"); do kill "-$sig" "$pid" 2>/dev/null; done
}

# TERM first. Background children ignore SIGINT in a non-interactive shell, so INT is not used.
signal_all TERM
for _ in $(seq 1 10); do
  [ -z "$(domain_pids "$DOMAIN")" ] && break
  sleep 1
done
if [ -n "$(domain_pids "$DOMAIN")" ]; then
  signal_all KILL
  # The kernel can take a few seconds to reap killed processes (Gazebo, many DDS threads).
  for _ in $(seq 1 10); do
    [ -z "$(domain_pids "$DOMAIN")" ] && break
    sleep 1
  done
fi

LEFT=$(domain_pids "$DOMAIN")
if [ -n "$LEFT" ]; then
  echo "domain $DOMAIN still has processes after KILL: $(echo $LEFT). Pid files kept in $RUN_DIR." >&2
  exit 1
fi
rm -f "${RUN_FILES[@]}"
echo "stopped domain $DOMAIN; no processes with ROS_DOMAIN_ID=$DOMAIN remain"
