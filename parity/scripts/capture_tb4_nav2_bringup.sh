#!/usr/bin/env bash
# B5 (overnight 2026-10-19): real `ros2 launch nav2_bringup tb4_simulation_launch.py headless:=True` (Nav2's own
# TurtleBot 4 demo, ros-jazzy-nav2-minimal-tb4-sim) under `timeout 300`, on its own ROS_DOMAIN_ID / GZ_PARTITION.
# Records: the full launch log, whether ros_gz_sim create spawned the robot (its lines + gz model list), every
# ERROR / FATAL line, lifecycle states and node / topic lists at 150 s and 270 s. Domain empty before and after.
# Usage: capture_tb4_nav2_bringup.sh <domain> <partition> <out_dir>
set -u
D=${1:?domain} P=${2:?partition} OUT=${3:?out dir}
cd "$(dirname "$0")/../.." || exit 1
source parity/scripts/domain_procs.sh
say() { echo "[$(date +%T)] $*"; }
[ -z "$(domain_pids $D)" ] || { say "domain $D not empty before start"; exit 9; }
mkdir -p "$OUT" /tmp/ros2lab_ref
R() { ( source parity/scripts/env.sh >/dev/null; export ROS_DOMAIN_ID=$D GZ_PARTITION=$P; "$@" ); }
CMD="ros2 launch nav2_bringup tb4_simulation_launch.py headless:=True"
{ echo "date=$(date -Iseconds)"; echo "domain=$D partition=$P"; echo "cmd=timeout 300 $CMD"
  for p in ros-jazzy-nav2-bringup ros-jazzy-nav2-minimal-tb4-sim ros-jazzy-nav2-minimal-tb4-description ros-jazzy-ros-gz-sim; do dpkg-query -W -f='${Package} ${Version}\n' "$p" 2>/dev/null; done
  echo "git_commit=$(git rev-parse HEAD)"; } > "$OUT/run_info.txt"
( source parity/scripts/env.sh >/dev/null; export ROS_DOMAIN_ID=$D GZ_PARTITION=$P RCUTILS_LOGGING_BUFFERED_STREAM=0
  cd "$OUT" && exec setsid timeout 300 $CMD ) > "$OUT/launch_log.txt" 2>&1 &
LP=$!; echo $LP > /tmp/ros2lab_ref/$D-tb4_nav2_bringup-$(date +%Y%m%dT%H%M%S).pids
say "launch pid $LP"
snap() {
  local t=$1 f="$OUT/at_${1}s"; mkdir -p "$f"
  { echo "# ros2 node list --no-daemon --spin-time 5"; R timeout 30 ros2 node list --no-daemon --spin-time 5; } > "$f/node_list.txt" 2>&1
  { echo "# ros2 topic list -t --no-daemon --spin-time 5"; R timeout 30 ros2 topic list -t --no-daemon --spin-time 5; } > "$f/topic_list.txt" 2>&1
  { echo "# ros2 lifecycle get <node> for each node of ros2 lifecycle nodes"; for n in $(R timeout 30 ros2 lifecycle nodes 2>/dev/null); do echo "$n: $(R timeout 20 ros2 lifecycle get "$n" 2>&1 | tr '\n' ' ')"; done; } > "$f/lifecycle.txt" 2>&1
  { echo "# gz model --list (GZ_PARTITION=$P)"; R timeout 30 gz model --list; } > "$f/gz_models.txt" 2>&1
  { echo "# ros2 topic echo --once /odom (timeout 20)"; R timeout 20 ros2 topic echo --once /odom --no-daemon 2>&1 | head -30; } > "$f/odom_once.txt" 2>&1
  say "snapshot ${t}s done"
}
sleep 150; snap 150
sleep 100; snap 270
wait $LP; rc=$?
echo "launch_exit=$rc (124 = stopped by timeout 300)" >> "$OUT/run_info.txt"
say "launch exit $rc"
grep -n "\[create-[0-9]*\]\|\[ros_gz_sim\]" "$OUT/launch_log.txt" > "$OUT/create_lines.txt"
grep -nE "\[(ERROR|FATAL)\]|ERROR:|unknown command line flag|process has died" "$OUT/launch_log.txt" > "$OUT/error_lines.txt"
env -u ROS_DOMAIN_ID bash parity/scripts/stop_reference.sh "$D"
[ -z "$(domain_pids $D)" ] && say "domain $D empty after stop" || say "domain $D NOT empty after stop"
