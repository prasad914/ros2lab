#!/usr/bin/env bash
# Night 1, Part 2.B/2.C: the site's nav#1 entry on real ROS 2 (this PC), one robot, one mode.
#   turtlebot3_world (headless EGL world, parity/reports/render_mode.md) + navigation2.launch.py use_sim_time:=True
#   (the map turtlebot3_navigation2 ships; no map:= argument, like the site's command).
# Usage: capture_nav.sh <tb3_burger|tb3_waffle|tb3_waffle_pi> <domain> <nopose|pose>
#   nopose: graph 25 s after Nav2 starts, then wait (no initial pose) until bringup aborts or 300 s; times the wait.
#   pose:   graph before the initial pose, initial pose at the spawn pose (-2.0, -0.5, 0) in the map frame, graph
#           once lifecycle_manager_navigation is active, then one goal with /cmd_vel* topic info -v and hz during it.
# Writes parity/fixtures/tb3_jazzy_v3/<robot>/nav_<mode>/ ; full logs in ground-truth/tb3/<robot>/nav_<mode>/ (gitignored).
set -u
ROBOT=${1:?robot}; DOMAIN=${2:?domain}; MODE=${3:?nopose|pose}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/../env.sh"
OUT=parity/fixtures/tb3_jazzy_v3/$ROBOT/nav_$MODE; RAW=ground-truth/tb3/$ROBOT/nav_$MODE
rm -rf "$OUT" "$RAW"; mkdir -p "$OUT" "$RAW"
OUT_DIR=$RAW bash parity/scripts/start_reference.sh "$ROBOT" nav_robotis_default "$DOMAIN" "ref$DOMAIN" || exit 1
export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=ref$DOMAIN TURTLEBOT3_MODEL=${ROBOT#tb3_}
NAVLOG=$RAW/logs/nav2.log
setsid python3 "$HERE/nav_probe.py" clock --out "$RAW/clock.csv" --secs 900 > "$RAW/clock_probe.log" 2>&1 &
T0=$(date +%s.%N)
{ echo "# $(date -Iseconds) capture_nav.sh $ROBOT $DOMAIN $MODE  (git $(git rev-parse --short HEAD))"
  echo "bash parity/scripts/tb3_v3/capture_nav.sh $ROBOT $DOMAIN $MODE"
  echo "world: ros2 launch parity/scripts/launch/tb3_world_headless.launch.py   (REF_RENDER=egl, TURTLEBOT3_MODEL=${ROBOT#tb3_})"
  echo "nav2 (15 s later): xvfb-run -a ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True"
} > "$OUT/runner.txt"
since() { python3 -c "import sys;print(round($(date +%s.%N)-$T0,1))"; }
simnow() { tail -1 "$RAW/clock.csv" 2>/dev/null | cut -d, -f2; }
waitlog() { local re=$1 secs=$2 t=0; while [ "$t" -lt "$secs" ]; do grep -qE "$re" "$NAVLOG" 2>/dev/null && return 0; sleep 1; t=$((t+1)); done; return 1; }
snap() {
  local d=$OUT/$1; mkdir -p "$d"
  echo "wall_since_start=$(since) sim=$(simnow) date=$(date -Iseconds)" > "$d/when.txt"
  timeout 30 ros2 node list > "$d/node_list.txt" 2>&1
  timeout 30 ros2 topic list -t > "$d/topic_list_t.txt" 2>&1
  timeout 30 ros2 service list -t > "$d/service_list_t.txt" 2>&1
  timeout 30 ros2 action list -t > "$d/action_list_t.txt" 2>&1
  timeout 30 ros2 lifecycle nodes > "$d/lifecycle_nodes.txt" 2>&1
  local i=0 n p pids=""
  for n in $(grep '^/' "$d/lifecycle_nodes.txt"); do i=$((i+1)); ( echo "$n: $(timeout 15 ros2 lifecycle get "$n" 2>&1 | tr '\n' ' ')" > "$d/.lc_$(printf %03d $i)" ) & pids="$pids $!"; done
  for p in error_code_names error_code_name_prefixes; do ( timeout 15 ros2 param get /bt_navigator "$p" > "$d/bt_navigator_$p.txt" 2>&1; echo "exit=$?" >> "$d/bt_navigator_$p.txt" ) & pids="$pids $!"; done
  wait $pids   # not the clock probe
  cat "$d"/.lc_* > "$d/lifecycle_states.txt" 2>/dev/null; rm -f "$d"/.lc_*
  for n in route_server docking_server smoother_server collision_detector collision_monitor velocity_smoother waypoint_follower behavior_server; do
    if grep -qx "/$n" "$d/node_list.txt"; then echo "$n: present"; else echo "$n: absent"; fi; done > "$d/servers_present.txt"
}
echo "waiting for Nav2 to start (log: $NAVLOG)"
waitlog 'lifecycle_manager_navigation\]: .*Configuring' 120 || echo "no 'Configuring' line from lifecycle_manager_navigation in 120 s" >> "$OUT/notes.txt"
# the bringup gives up ~60 s after the global costmap starts waiting for map->base_link, so the "before" snapshot
# (about 15 s) and the initial pose must both happen well inside that window
sleep 8
if [ "$MODE" = nopose ]; then
  python3 "$HERE/nav_probe.py" rtf --secs 10 > "$OUT/rtf.json" 2>/dev/null
  snap before_pose
  # how long the bringup waits without an initial pose (ends with "Aborting bringup" in Jazzy, or the cap)
  waitlog 'lifecycle_manager_navigation\]: (Failed to bring up all requested nodes|.*Managed nodes are active)' 300 || echo "lifecycle_manager_navigation neither aborted nor active within 300 s after the snapshot" >> "$OUT/notes.txt"
  sleep 3
  snap after_wait
else
  snap before_pose
  python3 "$HERE/nav_probe.py" pose --x -2.0 --y -0.5 --yaw 0.0 --secs 90 > "$OUT/initial_pose.json" 2>"$RAW/pose_probe.err"
  waitlog 'lifecycle_manager_navigation\]: .*Managed nodes are active' 180 || echo "lifecycle_manager_navigation not active within 180 s after the initial pose" >> "$OUT/notes.txt"
  sleep 3
  python3 "$HERE/nav_probe.py" rtf --secs 10 > "$OUT/rtf.json" 2>/dev/null
  snap after_pose
  # QoS of every topic (ros2 topic info -v), 8 at a time
  mkdir -p "$OUT/after_pose/qos"
  awk '{print $1}' "$OUT/after_pose/topic_list_t.txt" | grep '^/' | xargs -P 8 -I{} sh -c 'f=$(echo "{}" | sed "s|^/||; s|/|__|g"); timeout 30 ros2 topic info -v "{}" > "'"$OUT"'/after_pose/qos/$f.txt" 2>&1'
  # 2.C: one goal (goals.yaml goal2 moved into this map's frame: spawn (-2.0, -0.5) + (2.50, 1.95)); topics during it
  mkdir -p "$OUT/goal"
  python3 "$HERE/nav_probe.py" goal --x 0.5 --y 1.45 --yaw 0.0 --out "$OUT/goal" --timeout 240 > "$RAW/goal_probe.log" 2>&1 &
  GP=$!
  sleep 4
  for t in /cmd_vel /cmd_vel_nav /cmd_vel_smoothed; do f=${t#/}; timeout 20 ros2 topic info -v "$t" > "$OUT/goal/topic_info_v_$f.txt" 2>&1; done
  HZ=""; for t in /cmd_vel /cmd_vel_nav /cmd_vel_smoothed; do f=${t#/}; ( timeout -s INT 12 ros2 topic hz "$t" > "$OUT/goal/topic_hz_$f.txt" 2>&1 ) & HZ="$HZ $!"; done
  wait $GP $HZ
fi
grep -nE 'Creating|Configuring|Activating|Managed nodes are active|Failed|Aborting|Timed out waiting for transform|Please set the initial pose|initial_transform_timeout|ERROR|FATAL|process has died' "$NAVLOG" | head -400 > "$OUT/nav2_log_excerpt.txt"
echo "timed_out_lines=$(grep -c 'Timed out waiting for transform' "$NAVLOG") please_set_initial_pose_lines=$(grep -c 'Please set the initial pose' "$NAVLOG")" >> "$OUT/nav2_log_excerpt.txt"
cp "$RAW/clock.csv" "$OUT/clock.csv"
cp "$RAW/run_info.txt" "$OUT/run_info.txt" 2>/dev/null
bash parity/scripts/stop_reference.sh "$DOMAIN" > "$OUT/stop.txt" 2>&1
echo "done: $OUT"
