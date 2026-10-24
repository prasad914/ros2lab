#!/usr/bin/env bash
# Night 2, Part 4: Nav2 result error codes on real ROS 2 (this PC), TurtleBot3 profile (navigation2.launch.py, the
# shipped map, which is centred on the world origin: map frame = Gazebo world frame).
#   one bring-up: headless EGL turtlebot3_world + navigation2.launch.py use_sim_time:=True (start_reference.sh
#   nav_robotis_default), initial pose at the spawn pose (-2.0, -0.5, 0), then the cases in this order, each sent with
#   `ros2 action send_goal /navigate_to_pose ...` like a student, and a goal back to the spawn pose between cases:
#     outside_map   (12.0, 12.0)   the map covers -10.0 .. 9.2 m in x and y (map.yaml origin -10, 384 px at 0.05 m)
#     in_obstacle   ( 0.0,  0.0)   centre of the central cylinder (map.pgm: occupied ring at 0.15 m, unknown inside)
#     unreachable   ( 3.5,  0.0)   unknown space outside the outer wall (occupied at x 2.40 on y 0), inside the map
#     blocked       ( 0.5,  1.45)  after a static box ring (inner half-size 0.35 m) is spawned around the robot
# Per case: the CLI output (status line, error_code, error_msg), wall and sim time from accept to result, the Nav2 log
# lines written during the goal, the amcl pose before. Writes parity/fixtures/tb3_jazzy_v3/<robot>/nav_errors/.
# Usage: capture_errors.sh <tb3_burger> <domain>
set -u
ROBOT=${1:?robot}; DOMAIN=${2:?domain}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/../env.sh"
OUT=parity/fixtures/tb3_jazzy_v3/$ROBOT/nav_errors; RAW=ground-truth/tb3/$ROBOT/nav_errors
rm -rf "$OUT" "$RAW"; mkdir -p "$OUT" "$RAW"
OUT_DIR=$RAW bash parity/scripts/start_reference.sh "$ROBOT" nav_robotis_default "$DOMAIN" "ref$DOMAIN" || exit 1
export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=ref$DOMAIN TURTLEBOT3_MODEL=${ROBOT#tb3_}
NAVLOG=$RAW/logs/nav2.log
setsid python3 "$HERE/nav_probe.py" clock --out "$RAW/clock.csv" --secs 2400 > "$RAW/clock_probe.log" 2>&1 &
{ echo "# $(date -Iseconds) capture_errors.sh $ROBOT $DOMAIN  (git $(git rev-parse --short HEAD))"
  echo "bash parity/scripts/tb3_v3/capture_errors.sh $ROBOT $DOMAIN"
  echo "world: ros2 launch parity/scripts/launch/tb3_world_headless.launch.py   (REF_RENDER=egl, TURTLEBOT3_MODEL=${ROBOT#tb3_})"
  echo "nav2 (15 s later): xvfb-run -a ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True"
  echo "goals: ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \"{pose: {header: {frame_id: map}, pose: {position: {x: X, y: Y}, orientation: {w: 1.0}}}}\""
} > "$OUT/runner.txt"
waitlog() { local re=$1 secs=$2 t=0; while [ "$t" -lt "$secs" ]; do grep -qE "$re" "$NAVLOG" 2>/dev/null && return 0; sleep 1; t=$((t+1)); done; return 1; }
simat() { python3 - "$RAW/clock.csv" "$1" <<'EOF'
import csv, sys
rows = [(float(r['wall_epoch']), float(r['sim'])) for r in csv.DictReader(open(sys.argv[1]))]
w = float(sys.argv[2]); best = min(rows, key=lambda r: abs(r[0] - w)) if rows else None
print('' if best is None else f"{best[1] + (w - best[0]):.3f}")
EOF
}
amcl() { timeout 15 ros2 topic echo --once --qos-durability transient_local --qos-reliability reliable /amcl_pose geometry_msgs/msg/PoseWithCovarianceStamped --field pose.pose 2>&1 | head -12; }
goal() {   # goal <case> <x> <y> <timeout s>
  local c=$1 x=$2 y=$3 to=$4 d=$OUT/$1; mkdir -p "$d"
  amcl > "$d/amcl_pose_before.txt"
  local l0; l0=$(wc -l < "$NAVLOG")
  local w0; w0=$(date +%s.%N)
  timeout "$to" ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
    "{pose: {header: {frame_id: map}, pose: {position: {x: $x, y: $y}, orientation: {w: 1.0}}}}" > "$d/send_goal.txt" 2>&1
  local rc=$? w1; w1=$(date +%s.%N)
  sleep 2
  sed -n "$((l0 + 1)),\$p" "$NAVLOG" > "$d/nav2_log_during_goal.txt"
  { echo "case=$c goal_x=$x goal_y=$y frame=map"; echo "cli_exit=$rc"
    echo "wall_start=$w0 wall_end=$w1 wall_s=$(python3 -c "print(round($w1-$w0,3))")"
    local s0 s1; s0=$(simat "$w0"); s1=$(simat "$w1"); echo "sim_start=$s0 sim_end=$s1 sim_s=$(python3 -c "print(round($s1-$s0,3))" 2>/dev/null)"
  } > "$d/timing.txt"
  echo "$c: $(grep -E 'Goal finished with status' "$d/send_goal.txt") $(tr '\n' ' ' < "$d/timing.txt")"
}
home() { timeout 240 ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: -2.0, y: -0.5}, orientation: {w: 1.0}}}}" > "$OUT/$1/return_home.txt" 2>&1; }

waitlog 'lifecycle_manager_navigation\]: .*Configuring' 120 || echo "no 'Configuring' line in 120 s" >> "$OUT/notes.txt"
sleep 8
python3 "$HERE/nav_probe.py" pose --x -2.0 --y -0.5 --yaw 0.0 --secs 90 > "$OUT/initial_pose.json" 2>"$RAW/pose_probe.err"
waitlog 'lifecycle_manager_navigation\]: .*Managed nodes are active' 180 || echo "navigation not active within 180 s after the initial pose" >> "$OUT/notes.txt"
sleep 5
python3 "$HERE/nav_probe.py" rtf --secs 10 > "$OUT/rtf.json" 2>/dev/null
timeout 15 ros2 param get /bt_navigator error_code_names > "$OUT/bt_navigator_error_code_names.txt" 2>&1
goal outside_map 12.0 12.0 300; home outside_map
goal in_obstacle 0.0 0.0 400;   home in_obstacle
goal unreachable 3.5 0.0 400;   home unreachable
# blocked: a static ring of four boxes around the robot's Gazebo pose (inner half-size 0.35 m, 0.05 m walls, 0.3 m high)
mkdir -p "$OUT/blocked"
gz model -m "${ROBOT#tb3_}" -p > "$OUT/blocked/gz_pose_before.txt" 2>&1
read -r RX RY < <(python3 - "$OUT/blocked/gz_pose_before.txt" <<'EOF'
import re, sys
t = open(sys.argv[1]).read(); m = re.search(r'\[\s*([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)\s*\]', t)
print(m.group(1), m.group(2)) if m else print('-2.0 -0.5')
EOF
)
box() { echo "<collision name='c$1'><pose>$2 $3 0.15 0 0 0</pose><geometry><box><size>$4 $5 0.3</size></box></geometry></collision><visual name='v$1'><pose>$2 $3 0.15 0 0 0</pose><geometry><box><size>$4 $5 0.3</size></box></geometry></visual>"; }
SDF="<sdf version='1.8'><model name='blocker'><static>true</static><link name='ring'>$(box 1 0.375 0 0.05 0.8)$(box 2 -0.375 0 0.05 0.8)$(box 3 0 0.375 0.8 0.05)$(box 4 0 -0.375 0.8 0.05)</link></model></sdf>"
echo "$SDF" > "$OUT/blocked/blocker.sdf"
timeout 60 ros2 run ros_gz_sim create -world default -name blocker -string "$SDF" -x "$RX" -y "$RY" -z 0.0 > "$OUT/blocked/spawn.txt" 2>&1
echo "ring centre (Gazebo) x=$RX y=$RY" >> "$OUT/blocked/spawn.txt"
sleep 5
goal blocked 0.5 1.45 600
grep -nE 'bt_navigator|Goal|goal|error|Error|ERROR|WARN|Aborting|failed|Failed|Running|Exceeded|Collision|progress|valid' "$NAVLOG" > "$OUT/nav2_log_excerpt_all.txt"
cp "$RAW/clock.csv" "$OUT/clock.csv"
bash parity/scripts/stop_reference.sh "$DOMAIN" > "$OUT/stop.txt" 2>&1
echo "done: $OUT"
