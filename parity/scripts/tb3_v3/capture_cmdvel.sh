#!/usr/bin/env bash
# Night 2, Part 3: the Nav2 velocity chain during one goal on real ROS 2 (this PC), TurtleBot3 profile.
#   headless EGL turtlebot3_world + navigation2.launch.py use_sim_time:=True (start_reference.sh nav_robotis_default),
#   initial pose at the spawn pose (-2.0, -0.5, 0), then the goal of capture_nav.sh (0.5, 1.45) while cmdvel_probe.py
#   records /cmd_vel_nav, /cmd_vel_smoothed, /cmd_vel and /odom (values, wall and sim time).
# Writes parity/fixtures/tb3_jazzy_v3/<robot>/nav_cmdvel/ (chain.csv, goal/result.json, topic info -v, params).
# Usage: capture_cmdvel.sh <tb3_burger|tb3_waffle_pi|tb3_waffle> <domain>
set -u
ROBOT=${1:?robot}; DOMAIN=${2:?domain}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/../env.sh"
OUT=parity/fixtures/tb3_jazzy_v3/$ROBOT/nav_cmdvel; RAW=ground-truth/tb3/$ROBOT/nav_cmdvel
rm -rf "$OUT" "$RAW"; mkdir -p "$OUT" "$RAW"
OUT_DIR=$RAW bash parity/scripts/start_reference.sh "$ROBOT" nav_robotis_default "$DOMAIN" "ref$DOMAIN" || exit 1
export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=ref$DOMAIN TURTLEBOT3_MODEL=${ROBOT#tb3_}
NAVLOG=$RAW/logs/nav2.log
{ echo "# $(date -Iseconds) capture_cmdvel.sh $ROBOT $DOMAIN  (git $(git rev-parse --short HEAD), $RMW_IMPLEMENTATION)"
  echo "bash parity/scripts/tb3_v3/capture_cmdvel.sh $ROBOT $DOMAIN"
  echo "world: ros2 launch parity/scripts/launch/tb3_world_headless.launch.py; nav2 (15 s later): xvfb-run -a ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True"
  echo "goal (0.5, 1.45, yaw 0) in map: nav_probe.py goal; recorder: cmdvel_probe.py"
} > "$OUT/runner.txt"
waitlog() { local re=$1 secs=$2 t=0; while [ "$t" -lt "$secs" ]; do grep -qE "$re" "$NAVLOG" 2>/dev/null && return 0; sleep 1; t=$((t+1)); done; return 1; }
waitlog 'lifecycle_manager_navigation\]: .*Configuring' 120 || echo "no 'Configuring' line in 120 s" >> "$OUT/notes.txt"
sleep 8
python3 "$HERE/nav_probe.py" pose --x -2.0 --y -0.5 --yaw 0.0 --secs 90 > "$OUT/initial_pose.json" 2>"$RAW/pose_probe.err"
waitlog 'lifecycle_manager_navigation\]: .*Managed nodes are active' 180 || echo "navigation not active within 180 s after the initial pose" >> "$OUT/notes.txt"
sleep 5
for np in "controller_server FollowPath.max_vel_x" "controller_server FollowPath.max_speed_xy" "controller_server FollowPath.max_vel_theta" "controller_server controller_frequency" \
          "velocity_smoother max_velocity" "velocity_smoother max_accel" "velocity_smoother smoothing_frequency" "velocity_smoother enable_stamped_cmd_vel" \
          "collision_monitor enable_stamped_cmd_vel" "behavior_server enable_stamped_cmd_vel" "docking_server enable_stamped_cmd_vel" "controller_server enable_stamped_cmd_vel"; do
  set -- $np; echo "$1 $2: $(timeout 15 ros2 param get /$1 $2 2>&1 | tr '\n' ' ')"; done > "$OUT/params.txt"
python3 "$HERE/nav_probe.py" rtf --secs 10 > "$OUT/rtf.json" 2>/dev/null
setsid python3 "$HERE/cmdvel_probe.py" --out "$OUT/chain.csv" --secs 300 > "$RAW/cmdvel_probe.log" 2>&1 &
CP=$!
sleep 3
python3 "$HERE/nav_probe.py" goal --x 0.5 --y 1.45 --yaw 0.0 --out "$OUT/goal" --timeout 240 > "$RAW/goal_probe.log" 2>&1
sleep 3
kill -INT "$CP" 2>/dev/null; sleep 2; kill "$CP" 2>/dev/null
for t in /cmd_vel /cmd_vel_nav /cmd_vel_smoothed; do timeout 20 ros2 topic info -v "$t" > "$OUT/topic_info_v_${t#/}.txt" 2>&1; done
bash parity/scripts/stop_reference.sh "$DOMAIN" > "$OUT/stop.txt" 2>&1
echo "done: $OUT"
