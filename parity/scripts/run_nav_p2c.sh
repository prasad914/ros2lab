#!/usr/bin/env bash
# P2c navigation session for a non-TurtleBot3 robot: start parity/robots/<robot>/scenarios/p2c_nav.sh, wait for the
# localization lifecycle, publish the goals file's start pose until /amcl_pose arrives, wait for the navigation
# lifecycle, optionally undock (TurtleBot4 workflow), optional snapshot + frame check, then every goal of the goals
# file in order through send_goal_capture.py, stop, and check the domain is empty before start and after stop.
# Usage: run_nav_p2c.sh <robot> <run_label> <domain> <partition> <goals.yaml> <map.yaml> [snapshot] [undock]
#        [base_frame=<frame>]
# Out: parity/fixtures/<robot>/p2c_nav/<run_label>/ (run_info.txt, logs/ (gitignored *.log), snapshot/, frame_check.txt,
# goal_<name>/ per goal, session.txt). ROS_DOMAIN_ID is set only on the ROS commands, never exported here.
set -u
ROBOT=$1 RUN=$2 D=$3 P=$4 GOALS=$5 MAP=$6; shift 6
SNAP=0 UNDOCK=0 BASE=base_footprint
for a in "$@"; do case $a in snapshot) SNAP=1 ;; undock) UNDOCK=1 ;; base_frame=*) BASE=${a#base_frame=} ;; *) echo "unknown option $a"; exit 2 ;; esac; done
cd "$(dirname "$0")/../.." || exit 1
source parity/scripts/domain_procs.sh
S=parity/fixtures/$ROBOT/p2c_nav/$RUN; mkdir -p "$S"
say() { echo "[$(date -Iseconds)] $*" | tee -a "$S/session.txt"; }
R() { ( source parity/scripts/env.sh >/dev/null; export ROS_DOMAIN_ID=$D GZ_PARTITION=$P; "$@" ); }
[ -z "$(domain_pids $D)" ] || { say "domain $D not empty before start: $(domain_pids $D)"; exit 9; }
say "domain $D empty before start"
OUT_DIR=$S bash parity/scripts/start_reference.sh "$ROBOT" p2c_nav "$D" "$P" >> "$S/session.txt" 2>&1 || exit 1
rc=0
R python3 parity/scripts/wait_nav_ready.py --limit 600 --managers lifecycle_manager_localization --localize \
  --localize-limit 300 --goals-yaml "$GOALS" >> "$S/session.txt" 2>&1 || { say "NOT READY (localization)"; rc=1; }
[ $rc = 0 ] && { R python3 parity/scripts/wait_nav_ready.py --limit 600 --managers lifecycle_manager_navigation \
  --goals-yaml "$GOALS" >> "$S/session.txt" 2>&1 || { say "NOT READY (navigation)"; rc=1; }; }
if [ $rc = 0 ] && [ $SNAP = 1 ]; then
  say "frame_check.py"
  R python3 parity/scripts/frame_check.py --map "$MAP" --out "$S/frame_check.txt" --goals-yaml "$GOALS" \
    --base-frame "$BASE" --control-dx 1.0 --control-dy 1.0 --limit 180 >> "$S/session.txt" 2>&1
  say "capture_reference.sh snapshot"
  OUT_DIR=$S/snapshot R bash parity/scripts/capture_reference.sh "$ROBOT" p2c_nav "$D" >> "$S/session.txt" 2>&1
fi
if [ $rc = 0 ] && [ $UNDOCK = 1 ]; then
  say "undock"
  R timeout 300 ros2 action send_goal /undock irobot_create_msgs/action/Undock "{}" > "$S/undock.txt" 2>&1
  say "undock exit $?"
fi
if [ $rc = 0 ]; then
  for g in $(python3 -c "import yaml,sys;print(' '.join(yaml.safe_load(open(sys.argv[1]))['goals']))" "$GOALS"); do
    say "send $g"
    R python3 parity/scripts/send_goal_capture.py --goal "$g" --goals-yaml "$GOALS" --timeout 300 --out-dir "$S/goal_$g" >> "$S/session.txt" 2>&1
    say "$g: $(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('status_name'), (d.get('result') or {}).get('error_code'), d.get('duration_sim_s'))" "$S/goal_$g/result.json" 2>&1)"
  done
fi
say "stop_reference.sh $D"
env -u ROS_DOMAIN_ID bash parity/scripts/stop_reference.sh "$D" >> "$S/session.txt" 2>&1
[ -z "$(domain_pids $D)" ] && say "domain $D empty after stop" || say "domain $D NOT empty after stop"
python3 parity/scripts/log_excerpts.py "$S" >> "$S/session.txt" 2>&1 || true
