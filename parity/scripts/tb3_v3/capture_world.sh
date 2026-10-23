#!/usr/bin/env bash
# Night 1, Part 2.C (teleop, turtlebot3_drive, burger_cam) and 2.D (sensors, TF) on real ROS 2 (this PC).
# World: turtlebot3_world, headless EGL (parity/scripts/launch/tb3_world_headless.launch.py, render_mode.md).
# Usage: capture_world.sh <tb3_burger|tb3_waffle|tb3_waffle_pi|tb3_burger_cam> <domain>
# Writes parity/fixtures/tb3_jazzy_v3/<robot>/world/ ; logs in ground-truth/tb3/<robot>/world/ (gitignored).
# Motion is judged from the Gazebo model pose (`gz model -m <model> -p`), never from /cmd_vel alone.
set -u
ROBOT=${1:?robot}; DOMAIN=${2:?domain}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/../env.sh"
OUT=parity/fixtures/tb3_jazzy_v3/$ROBOT/world; RAW=ground-truth/tb3/$ROBOT/world
rm -rf "$OUT" "$RAW"; mkdir -p "$OUT/samples" "$OUT/motion" "$RAW"
OUT_DIR=$RAW bash parity/scripts/start_reference.sh "$ROBOT" sensors "$DOMAIN" "ref$DOMAIN" || exit 1
MODEL=${ROBOT#tb3_}
export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=ref$DOMAIN TURTLEBOT3_MODEL=$MODEL
{ echo "# $(date -Iseconds) capture_world.sh $ROBOT $DOMAIN  (git $(git rev-parse --short HEAD))"
  echo "bash parity/scripts/tb3_v3/capture_world.sh $ROBOT $DOMAIN"
  echo "world: ros2 launch parity/scripts/launch/tb3_world_headless.launch.py   (REF_RENDER=egl, TURTLEBOT3_MODEL=$MODEL)"
  echo "per topic: ros2 topic info -v; timeout -s INT 12 ros2 topic hz; ros2 topic echo --once --full-length (samples/; image_raw: --no-arr)"
  echo "tf: ros2 run tf2_tools view_frames (in samples/); ros2 topic echo --once /tf_static"
  echo "teleop: parity/scripts/tb3_v3/teleop_pty.py --keys wwwww --hold 6 (ros2 run turtlebot3_teleop teleop_keyboard on a pty)"
  echo "drive: ros2 run turtlebot3_gazebo turtlebot3_drive for 12 s"
  echo "motion: gz model -m $MODEL -p before / after"
} > "$OUT/runner.txt"
sleep 20
python3 "$HERE/nav_probe.py" rtf --secs 10 > "$OUT/rtf.json" 2>/dev/null
timeout 30 ros2 node list > "$OUT/node_list.txt" 2>&1
timeout 30 ros2 topic list -t > "$OUT/topic_list_t.txt" 2>&1
TOPICS="/scan /imu /odom /joint_states /tf /clock"
case $MODEL in waffle|waffle_pi|burger_cam) TOPICS="$TOPICS /camera/image_raw /camera/camera_info" ;; esac
for t in $TOPICS; do f=$(echo "${t#/}" | tr / _)
  timeout 20 ros2 topic info -v "$t" > "$OUT/samples/info_v_$f.txt" 2>&1
  case $t in /camera/image_raw) timeout 20 ros2 topic echo --once --no-arr "$t" > "$OUT/samples/echo_once_$f.txt" 2>&1 ;;
             /clock|/tf) : ;;
             *) timeout 20 ros2 topic echo --once --full-length "$t" > "$OUT/samples/echo_once_$f.txt" 2>&1 ;; esac
done
HZ=""; for t in $TOPICS; do f=$(echo "${t#/}" | tr / _); ( timeout -s INT 12 ros2 topic hz "$t" > "$OUT/samples/hz_$f.txt" 2>&1 ) & HZ="$HZ $!"; done; wait $HZ
timeout 20 ros2 topic echo --once /tf_static > "$OUT/samples/echo_once_tf_static.txt" 2>&1
( cd "$OUT/samples" && timeout 40 ros2 run tf2_tools view_frames > view_frames.txt 2>&1; rm -f frames_*.pdf )
python3 - "$OUT/samples/echo_once_scan.txt" > "$OUT/samples/scan_summary.txt" <<'EOF'
import sys, yaml, math
d = yaml.safe_load(open(sys.argv[1]).read().split('\n---')[0])
r = d['ranges']; fin = [x for x in r if isinstance(x, (int, float)) and math.isfinite(x)]
print(f"frame_id={d['header']['frame_id']} n={len(r)} angle_min={d['angle_min']} angle_max={d['angle_max']} angle_increment={d['angle_increment']}")
print(f"range_min={d['range_min']} range_max={d['range_max']} scan_time={d['scan_time']} time_increment={d['time_increment']}")
print(f"finite={len(fin)} inf={sum(1 for x in r if x == float('inf') or x == '.inf')} nan={sum(1 for x in r if isinstance(x, float) and math.isnan(x))} min_finite={min(fin) if fin else None} max_finite={max(fin) if fin else None}")
EOF
pose() { timeout 20 gz model -m "$MODEL" -p 2>&1; }
# 2.C teleop: does /cmd_vel from turtlebot3_teleop move the robot? (pose before / after, from Gazebo)
pose > "$OUT/motion/teleop_pose_before.txt"
python3 "$HERE/teleop_pty.py" --keys wwwww --hold 6 --log "$OUT/motion/teleop_terminal.txt" > "$OUT/motion/teleop_run.txt" 2>&1 &
TP=$!; sleep 6
timeout 20 ros2 topic info -v /cmd_vel > "$OUT/motion/teleop_cmd_vel_info_v.txt" 2>&1
wait $TP
pose > "$OUT/motion/teleop_pose_after.txt"
# 2.C turtlebot3_drive
pose > "$OUT/motion/drive_pose_before.txt"
setsid ros2 run turtlebot3_gazebo turtlebot3_drive > "$OUT/motion/drive_terminal.txt" 2>&1 &
DP=$!; sleep 4
timeout 20 ros2 topic info -v /cmd_vel > "$OUT/motion/drive_cmd_vel_info_v.txt" 2>&1
sleep 8
pose > "$OUT/motion/drive_pose_after.txt"
kill -INT -- -$DP 2>/dev/null; sleep 2; kill -KILL -- -$DP 2>/dev/null
cp "$RAW/run_info.txt" "$OUT/run_info.txt" 2>/dev/null
bash parity/scripts/stop_reference.sh "$DOMAIN" > "$OUT/stop.txt" 2>&1
echo "done: $OUT"
