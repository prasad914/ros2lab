#!/usr/bin/env bash
# Real-ROS captures asked for by parity/reports/expert_review_2026-10-18.md (item 1 of the follow-up task).
# Usage: capture_review_items.sh <a|b|c|d|e|f> [domain=41]
#   a  turtlebot3_world.launch.py with TURTLEBOT3_MODEL unset   -> tb3_burger/sensors/errors/no_tb3_model/
#   b  navigation2.launch.py with map:= a missing file (timeout 180) -> tb3_burger/nav_robotis/errors/bad_map_path/
#   c  ros2 topic info /cmd_vel -v while each teleop runs        -> tb3_burger/sensors/teleop/
#   d  ros2 topic hz /map --use-sim-time under slam_toolbox      -> tb3_burger/slam/samples/map_hz_runner.log
#   e  one /imu sample                                           -> tb3_burger/sensors/samples/imu_runner.log
#   f  /odom before/after 6 s of Twist, then TwistStamped, on /cmd_vel -> tb3_burger/sensors/teleop/twist_vs_stamped_runner.log
# Logs are named *runner*.log so parity/scripts/log_excerpts.py writes tracked .txt copies of every line.
# The domain must be empty before and after (checked); the simulators are always stopped with stop_reference.sh.
set -u
ITEM=${1:?a|b|c|d|e|f}; DOMAIN=${2:-41}; PART=review_$DOMAIN
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/domain_procs.sh"
check_empty() {
  local left; left=$(domain_pids "$DOMAIN")
  if [ -n "$left" ]; then echo "domain $DOMAIN not empty ($1): $(echo $left)" >&2; return 1; fi
  echo "domain $DOMAIN empty ($1)"
}
check_empty before || exit 3
source "$HERE/env.sh"
F=parity/fixtures/tb3_burger
stamp() { echo "# $(date -Iseconds) ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART TURTLEBOT3_MODEL=${TURTLEBOT3_MODEL-<unset>}"; }
wait_topic() {  # wait_topic <topic> <secs>
  local i
  for i in $(seq 1 "$2"); do
    ROS_DOMAIN_ID=$DOMAIN ros2 topic list --no-daemon 2>/dev/null | grep -qx "$1" && return 0
    sleep 1
  done
  return 1
}

case $ITEM in
  a)
    OUT=$F/sensors/errors/no_tb3_model; mkdir -p "$OUT"
    # Run directly (start_reference.sh always exports TURTLEBOT3_MODEL); register the pid like start_reference.sh
    # does so stop_reference.sh cleans up whatever the aborted launch left.
    mkdir -p /tmp/ros2lab_ref
    PIDFILE=/tmp/ros2lab_ref/$DOMAIN-no_tb3_model-$(date +%Y%m%dT%H%M%S)-$$.pids
    {
      stamp
      echo "# cmd: env -u TURTLEBOT3_MODEL timeout 120 xvfb-run -a ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"
      echo "# (runs in the background; this file captures stdout+stderr, then the exit code)"
    } > "$OUT/launch_runner.log"
    ( export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART; unset TURTLEBOT3_MODEL
      setsid timeout 120 xvfb-run -a ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py >> "$OUT/launch_runner.log" 2>&1 &
      echo $! >> "$PIDFILE"; wait $!; echo "# exit code: $?" >> "$OUT/launch_runner.log" )
    ;;
  b)
    OUT=$F/nav_robotis/errors/bad_map_path; mkdir -p "$OUT"
    MISSING=$HOME/map.yaml
    [ -e "$MISSING" ] && { echo "$MISSING exists – pick another missing path" >&2; exit 2; }
    OUT_DIR=$OUT bash "$HERE/start_reference.sh" tb3_burger sensors "$DOMAIN" "$PART" || exit 1
    wait_topic /scan 90 || echo "warning: /scan not seen after 90 s"
    export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART TURTLEBOT3_MODEL=burger
    {
      stamp
      echo "# cmd: timeout 180 ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:=$MISSING"
      echo "# (rviz2 runs on xvfb-run -a; world from start_reference.sh tb3_burger sensors)"
      echo "# start: $(date +%s.%N)"
    } > "$OUT/nav2_runner.log"
    timeout 180 xvfb-run -a ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:="$MISSING" >> "$OUT/nav2_runner.log" 2>&1
    RC=$?
    { echo "# end: $(date +%s.%N)"; echo "# exit code: $RC (124 = killed by timeout 180)"; } >> "$OUT/nav2_runner.log"
    {
      stamp; echo "# ros2 lifecycle get for each nav2 node, after the launch above ended (world still running)"
      for n in map_server amcl planner_server controller_server bt_navigator; do
        echo "## ros2 lifecycle get /$n"; timeout 20 ros2 lifecycle get "/$n" 2>&1
      done
    } > "$OUT/lifecycle_after_runner.log"
    ;;
  c)
    OUT=$F/sensors/teleop; mkdir -p "$OUT"
    OUT_DIR=$OUT/world bash "$HERE/start_reference.sh" tb3_burger sensors "$DOMAIN" "$PART" > /dev/null || exit 1
    wait_topic /cmd_vel 90 || echo "warning: /cmd_vel not seen after 90 s"
    export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART TURTLEBOT3_MODEL=burger
    for V in "teleop_twist_keyboard|teleop_twist_keyboard teleop_twist_keyboard" \
             "teleop_keyboard|turtlebot3_teleop teleop_keyboard" \
             "teleop_twist_keyboard_stamped|teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true"; do
      NAME=${V%%|*}; T=${V#*|}
      LOG=$OUT/topic_info_cmd_vel_${NAME}_runner.log
      # script -qc gives the teleop a TTY (it reads the keyboard with termios); stdin is kept open by sleep.
      ( sleep 40 | script -qc "ros2 run $T" "$OUT/${NAME}_tty_runner.log" > /dev/null 2>&1 ) &
      TPID=$!
      sleep 12
      { stamp; echo "# while: ros2 run $T (under script -qc, started 12 s earlier)"
        echo "# cmd: ros2 topic info /cmd_vel -v --no-daemon"
        timeout 30 ros2 topic info /cmd_vel -v --no-daemon 2>&1
        echo "# cmd: ros2 node list --no-daemon"; timeout 30 ros2 node list --no-daemon 2>&1
      } > "$LOG"
      pkill -TERM -f "ros2 run $T" 2>/dev/null; pkill -TERM -f "lib/$(echo "$T" | cut -d' ' -f1)/$(echo "$T" | cut -d' ' -f2)" 2>/dev/null
      wait $TPID 2>/dev/null
      sleep 3
    done
    ;;
  d)
    OUT=$F/slam/samples; mkdir -p "$OUT"
    OUT_DIR=$F/slam/review_map_hz bash "$HERE/start_reference.sh" tb3_burger slam "$DOMAIN" "$PART" > /dev/null || exit 1
    wait_topic /map 120 || echo "warning: /map not seen after 120 s"
    export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART
    sleep 10
    { stamp; echo "# cmd: timeout -s INT 40 ros2 topic hz /map --use-sim-time   (slam_toolbox online_async, robot standing still)"
      timeout -s INT 40 ros2 topic hz /map --use-sim-time 2>&1; echo "# exit code: $?"
    } > "$OUT/map_hz_runner.log"
    ;;
  e)
    OUT=$F/sensors/samples; mkdir -p "$OUT"
    OUT_DIR=$F/sensors/review_imu bash "$HERE/start_reference.sh" tb3_burger sensors "$DOMAIN" "$PART" > /dev/null || exit 1
    wait_topic /imu 90 || echo "warning: /imu not seen after 90 s"
    export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART
    sleep 5
    { stamp; echo "# cmd: ros2 topic echo /imu --once --no-daemon"
      timeout 30 ros2 topic echo /imu --once --no-daemon 2>&1
      echo "# cmd: ros2 topic info /imu -v --no-daemon"; timeout 30 ros2 topic info /imu -v --no-daemon 2>&1
    } > "$OUT/imu_runner.log"
    ;;
  f)
    OUT=$F/sensors/teleop; mkdir -p "$OUT"
    OUT_DIR=$OUT/world_f bash "$HERE/start_reference.sh" tb3_burger sensors "$DOMAIN" "$PART" > /dev/null || exit 1
    wait_topic /odom 90 || echo "warning: /odom not seen after 90 s"
    export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART
    sleep 5
    pos() { echo "# cmd: ros2 topic echo /odom --once --no-daemon --field pose.pose.position"; timeout 30 ros2 topic echo /odom --once --no-daemon --field pose.pose.position 2>&1; }
    { stamp; pos
      echo "# cmd: timeout -s INT 6 ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.2}}'"
      timeout -s INT 6 ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.2}}' 2>&1 | head -3; sleep 1; pos
      echo "# cmd: timeout -s INT 6 ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/TwistStamped '{twist: {linear: {x: 0.2}}}'"
      timeout -s INT 6 ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/TwistStamped '{twist: {linear: {x: 0.2}}}' 2>&1 | head -3; sleep 1; pos
    } > "$OUT/twist_vs_stamped_runner.log"
    ;;
  *) echo "unknown item $ITEM" >&2; exit 2 ;;
esac

unset ROS_DOMAIN_ID
bash "$HERE/stop_reference.sh" "$DOMAIN"
check_empty after
