#!/usr/bin/env bash
# run_nav_session.sh - One nav_robotis session: start, wait for Nav2 and localize, capture, send goals, stop.
# Usage: run_nav_session.sh <robot> <goal|session name> [snapshot] [cmdvel] [point:<name>:<x>:<y> ...]
#   without point: options the goals.yaml goal <goal> is sent; with them, those map points are sent in order instead
#   snapshot: capture_reference.sh snapshot and which nav2 params yaml the launch loaded
#   cmdvel:   ros2 topic info /cmd_vel -v (with the daemon, and --no-daemon before and after the goal),
#             ros2 interface show nav2_msgs/action/NavigateToPose
# Out: parity/fixtures/<robot>/nav_robotis/session_<goal|name>/ (run_info.txt, logs/, snapshot/, goal_<goal>/ per goal)
# Each goal's result and feedback come from send_goal_capture.py; log_excerpts.py writes its planner_server /
# controller_server / bt_navigator lines (wall time send - 1 s to result + 3 s) and collision_monitor's lines as .txt.
set -u
ROBOT=${1:?robot}; GOAL=${2:?goal}; shift 2
DOMAIN=41; PART=ref41; SCEN=nav_robotis
SNAP=0; CMDVEL=0; POINTS=()
for a in "$@"; do case $a in
  snapshot) SNAP=1 ;; cmdvel) CMDVEL=1 ;;
  point:*:*:*) POINTS+=("${a#point:}") ;;
  *) echo "unknown option $a"; exit 2 ;;
esac; done
cd "$(dirname "$0")/../.."
source parity/scripts/domain_procs.sh
S=parity/fixtures/$ROBOT/$SCEN/session_$GOAL
mkdir -p "$S"
say() { echo "[$(date -Iseconds)] $*"; }

bash parity/scripts/stop_reference.sh $DOMAIN
[ -z "$(domain_pids $DOMAIN)" ] || { say "domain $DOMAIN not empty before start"; exit 1; }
say "start_reference.sh $ROBOT $SCEN $DOMAIN $PART (OUT_DIR=$S)"
OUT_DIR=$S bash parity/scripts/start_reference.sh "$ROBOT" "$SCEN" $DOMAIN $PART || exit 1

(
  source parity/scripts/env.sh; export ROS_DOMAIN_ID=$DOMAIN
  # Localize first: the navigation lifecycle (planner_server's global costmap) waits for AMCL's map frame
  python3 parity/scripts/wait_nav_ready.py --limit 300 --managers lifecycle_manager_localization --localize \
    --localize-limit 120 || { say "NOT READY (localization)"; exit 1; }
  python3 parity/scripts/wait_nav_ready.py --limit 300 --managers lifecycle_manager_navigation || { say "NOT READY (navigation)"; exit 1; }

  if [ $SNAP = 1 ]; then
    say "capture_reference.sh snapshot"
    OUT_DIR=$S/snapshot bash parity/scripts/capture_reference.sh "$ROBOT" "$SCEN" $DOMAIN
    # Which params yaml: navigation2.launch.py picks param/<TURTLEBOT3_MODEL>.yaml (installed source below)
    L=$(ros2 pkg prefix turtlebot3_navigation2)/share/turtlebot3_navigation2
    {
      echo "# processes of domain $DOMAIN running navigation2.launch.py / nav2 (pid, TURTLEBOT3_MODEL, args)"
      for p in $(domain_pids $DOMAIN); do
        args=$(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null)
        case $args in *navigation2.launch.py*|*nav2_container*|*params-file*)
          echo "$p TURTLEBOT3_MODEL=$(tr '\0' '\n' < /proc/$p/environ | sed -n 's/^TURTLEBOT3_MODEL=//p') $args" ;;
        esac
      done
      echo; echo "# $L/launch/navigation2.launch.py lines 27-56"
      sed -n '27,56{=;p}' "$L/launch/navigation2.launch.py" | paste - - | sed 's/^/L/'
      echo; echo "# sha256 of the installed param files"
      sha256sum "$L"/param/*.yaml
      echo; echo "# robot_radius (burger.yaml 0.1, waffle.yaml and waffle_pi.yaml 0.15), from the running nodes"
      for n in /local_costmap/local_costmap /global_costmap/global_costmap; do
        echo "$n robot_radius: $(timeout -k 2s 10 ros2 param get $n robot_radius 2>&1)"
      done
    } > "$S/params_file.txt" 2>&1
  fi

  if [ $CMDVEL = 1 ]; then
    say "/cmd_vel info and NavigateToPose interface"
    timeout -k 2s 15 ros2 topic info /cmd_vel -v > "$S/cmd_vel_info.txt" 2>&1
    # Also without the ROS 2 daemon (direct discovery for 5 s): the daemon's graph can lag behind a fresh launch
    timeout -k 2s 30 ros2 topic info /cmd_vel -v --no-daemon --spin-time 5 > "$S/cmd_vel_info_no_daemon.txt" 2>&1
    timeout -k 2s 30 ros2 topic list -t --no-daemon --spin-time 5 > "$S/topic_list_no_daemon.txt" 2>&1
    timeout -k 2s 15 ros2 interface show nav2_msgs/action/NavigateToPose > "$S/NavigateToPose_interface.txt" 2>&1
  fi

  GRC=0
  if [ ${#POINTS[@]} -eq 0 ]; then
    say "send $GOAL"
    python3 parity/scripts/send_goal_capture.py --goal "$GOAL" --out-dir "$S/goal_$GOAL" || GRC=1
  fi
  for pt in "${POINTS[@]}"; do
    IFS=: read -r n x y <<< "$pt"
    say "send point $n ($x, $y)"
    python3 parity/scripts/send_goal_capture.py --name "$n" --x "$x" --y "$y" --out-dir "$S/goal_$n" || GRC=1
  done
  if [ $CMDVEL = 1 ]; then
    timeout -k 2s 30 ros2 topic info /cmd_vel -v --no-daemon --spin-time 5 > "$S/cmd_vel_info_no_daemon_after_goal.txt" 2>&1
  fi
  exit $GRC
)
RC=$?

say "stop_reference.sh $DOMAIN"
bash parity/scripts/stop_reference.sh $DOMAIN
[ -z "$(domain_pids $DOMAIN)" ] && say "domain $DOMAIN empty after stop" || say "domain $DOMAIN NOT empty after stop"

grep -a '\[collision_monitor\]' "$S/logs/nav2.log" > "$S/collision_monitor.log" || true
python3 parity/scripts/log_excerpts.py "$S" || true   # tracked .txt excerpts of the *.log files
exit $RC
