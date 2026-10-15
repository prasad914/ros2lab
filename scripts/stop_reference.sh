#!/usr/bin/env bash
# Stop every process started by start_reference.sh for one ROS_DOMAIN_ID.
# Usage: stop_reference.sh <ros_domain_id>
DOMAIN=${1:?domain id}
PIDFILE=/tmp/ros2lab_ref_$DOMAIN.pids
[ -f "$PIDFILE" ] || { echo "nothing running for domain $DOMAIN"; exit 0; }
while read -r pid; do
  [ -n "$pid" ] && kill -INT -- "-$pid" 2>/dev/null
done < "$PIDFILE"
sleep 5
while read -r pid; do
  [ -n "$pid" ] && kill -KILL -- "-$pid" 2>/dev/null
done < "$PIDFILE"
rm -f "$PIDFILE"
echo "stopped domain $DOMAIN"
