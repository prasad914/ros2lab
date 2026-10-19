#!/usr/bin/env bash
# Shared helper. Source it, do not run it.
# domain_pids <ros_domain_id>: prints the pid of every process of this user whose environment
# has ROS_DOMAIN_ID=<id>, one per line. A run is found even after it has left its process group.
# Call it before the caller exports ROS_DOMAIN_ID, or the caller's own shell would match.
domain_pids() {
  local domain=$1 p
  for p in $(pgrep -u "$(id -u)" 2>/dev/null); do
    [ "$p" = "$$" ] && continue
    tr '\0' '\n' 2>/dev/null < "/proc/$p/environ" | grep -qx "ROS_DOMAIN_ID=$domain" && echo "$p"
  done
  return 0
}
