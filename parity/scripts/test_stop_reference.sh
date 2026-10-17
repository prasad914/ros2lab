#!/usr/bin/env bash
# Process-level test for start_reference.sh's refusal and stop_reference.sh's cleanup.
# Uses a throwaway ROS_DOMAIN_ID and plain sleep processes, not ROS or Gazebo.
# Usage: test_stop_reference.sh   (exit 0 = pass)
set -u
DOMAIN=97
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/domain_procs.sh"

if [ -n "$(domain_pids "$DOMAIN")" ]; then
  echo "SKIP: domain $DOMAIN is in use; pick another test domain" >&2
  exit 2
fi

RUN_DIR=/tmp/ros2lab_ref
mkdir -p "$RUN_DIR"
PIDFILE=$RUN_DIR/$DOMAIN-test-$(date +%Y%m%dT%H%M%S)-$$.pids
fail() { echo "FAIL: $*" >&2; domain_pids "$DOMAIN" | xargs -r kill -KILL 2>/dev/null; rm -f "$PIDFILE"; exit 1; }

# A fake run: a group leader, a child in its group, and a grandchild that leaves the group with setsid.
ROS_DOMAIN_ID=$DOMAIN setsid bash -c 'sleep 600 & setsid sleep 601 & wait' >/dev/null 2>&1 &
echo $! >> "$PIDFILE"
sleep 1

N=$(domain_pids "$DOMAIN" | wc -l)
echo "processes on domain $DOMAIN before stop: $N"
[ "$N" -ge 3 ] || fail "expected the leader, child and grandchild (>= 3), got $N"

# start_reference.sh must refuse to start on this busy domain.
"$HERE/start_reference.sh" tb3_burger sensors "$DOMAIN" ref$DOMAIN >/dev/null 2>&1
RC=$?
echo "start on busy domain exit code: $RC"
[ "$RC" -eq 3 ] || fail "start should exit 3 on a busy domain, got $RC"

# stop must kill the group and the grandchild, and remove only the pid file it has verified clear.
"$HERE/stop_reference.sh" "$DOMAIN" || fail "stop_reference.sh exited $?"
LEFT=$(domain_pids "$DOMAIN")
[ -z "$LEFT" ] || fail "processes left after stop: $LEFT"
[ ! -e "$PIDFILE" ] || fail "pid file kept although domain is clear"

echo "PASS: start refused on a busy domain, stop killed the group and the grandchild, pid file removed"
