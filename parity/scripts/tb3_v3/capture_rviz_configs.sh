#!/usr/bin/env bash
# Night 2, Part 5: real rviz2 with the TurtleBot3 configs, as installed:
#   turtlebot3_navigation2/rviz/tb3_navigation2.rviz, turtlebot3_cartographer/rviz/tb3_cartographer.rviz,
#   turtlebot3_description/rviz/model.rviz
# Each: Xvfb :<display> 4300x1100 (tb3_navigation2.rviz puts its window at X 2630), `rviz2 -d <copy of the file>` (nothing else running on its ROS_DOMAIN_ID), screenshot
# after 20 s, Ctrl+S (rviz2 writes the config it holds back to the copy = its saved config), stdout. Fast DDS.
# Writes parity/fixtures/tb3_jazzy_v3/rviz/<name>/ {installed.rviz, saved.rviz, screenshot.png, rviz2_stdout.txt, runner.txt}
# tb3_navigation2.rviz: its nav2_rviz_plugins/Selector panel blocks the window until controller_server, planner_server and
# smoother_server answer (alone it never draws: rviz2_stdout_alone.txt), so that one is captured with the TB3 world and
# Nav2 running (start_reference.sh tb3_burger nav_robotis_default, initial pose at the spawn pose; that launch's own
# rviz2 runs on its own xvfb display) and a second rviz2 on our display.
# Usage: capture_rviz_configs.sh [domain=62] [display=:57] [names...]
set -u
DOMAIN=${1:-62}; DISP=${2:-:57}; shift 2 2>/dev/null; ONLY=${*:-"tb3_navigation2 tb3_cartographer model"}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/../env.sh"
OUT=parity/fixtures/tb3_jazzy_v3/rviz; mkdir -p "$OUT"
XCTL=parity/scripts/rviz/xctl.py
env -u ROS_DOMAIN_ID Xvfb "$DISP" -screen 0 4300x1100x24 -nolisten tcp > /dev/null 2>&1 &   # not a domain process (stop_reference.sh)
XP=$!; sleep 2
for f in turtlebot3_navigation2/rviz/tb3_navigation2.rviz turtlebot3_cartographer/rviz/tb3_cartographer.rviz turtlebot3_description/rviz/model.rviz; do
  name=$(basename "$f" .rviz); case " $ONLY " in *" $name "*) ;; *) continue;; esac
  d=$OUT/$name; keep=""; [ -f "$d/rviz2_stdout_alone.txt" ] && keep=$(mktemp) && cp "$d/rviz2_stdout_alone.txt" "$keep"
  rm -rf "$d"; mkdir -p "$d"; [ -n "$keep" ] && mv "$keep" "$d/rviz2_stdout_alone.txt"
  NAV=""
  if [ "$name" = tb3_navigation2 ]; then
    bash parity/scripts/stop_reference.sh "$DOMAIN" > /dev/null 2>&1
    OUT_DIR=ground-truth/tb3/tb3_burger/rviz_nav bash parity/scripts/start_reference.sh tb3_burger nav_robotis_default "$DOMAIN" "ref$DOMAIN" > "$d/start_reference.txt" 2>&1
    export TURTLEBOT3_MODEL=burger GZ_PARTITION=ref$DOMAIN; NAV=1
    for i in $(seq 120); do grep -q "lifecycle_manager_navigation\]: .*Configuring" ground-truth/tb3/tb3_burger/rviz_nav/logs/nav2.log 2>/dev/null && break; sleep 1; done; sleep 8
    ROS_DOMAIN_ID=$DOMAIN python3 "$HERE/nav_probe.py" pose --x -2.0 --y -0.5 --yaw 0.0 --secs 90 > "$d/initial_pose.json" 2>/dev/null
    for i in $(seq 120); do grep -q "lifecycle_manager_navigation\]: .*Managed nodes are active" ground-truth/tb3/tb3_burger/rviz_nav/logs/nav2.log 2>/dev/null && break; sleep 1; done; sleep 5
  fi
  export ROS_DOMAIN_ID=$DOMAIN   # only now: start_reference.sh refuses a domain with running processes (this shell included)
  src=/opt/ros/jazzy/share/$f; cp "$src" "$d/installed.rviz"
  work=$(mktemp -d); cp "$src" "$work/$name.rviz"; chmod u+w "$work/$name.rviz"
  { echo "# $(date -Iseconds) capture_rviz_configs.sh $DOMAIN $DISP  (git $(git rev-parse --short HEAD), $RMW_IMPLEMENTATION, rviz2 $(dpkg-query -W -f='${Version}' ros-jazzy-rviz2))"
    [ "$name" = tb3_navigation2 ] && echo "with: start_reference.sh tb3_burger nav_robotis_default $DOMAIN (world + navigation2.launch.py), initial pose (-2.0, -0.5, 0), both lifecycle managers active"
    echo "DISPLAY=$DISP HOME=$work rviz2 -d $work/$name.rviz   (copy of $src); screenshot after 20 s; Ctrl+S; copy back as saved.rviz"; } > "$d/runner.txt"
  DISPLAY=$DISP HOME=$work setsid rviz2 -d "$work/$name.rviz" > "$d/rviz2_stdout.txt" 2>&1 &
  RP=$!
  sleep 20
  read -r GX GY GW GH < <(python3 -c "import yaml,sys;g=yaml.safe_load(open(sys.argv[1]))['Window Geometry'];print(g['X'],g['Y'],g['Width'],g['Height'])" "$src")
  python3 "$XCTL" "$DISP" shot "$d/screenshot.png" "$GX" "$GY" "$GW" "$GH"   # the window, as its Window Geometry places it
  python3 "$XCTL" "$DISP" click $((GX + GW / 2)) $((GY + GH / 2)); sleep 0.5
  python3 "$XCTL" "$DISP" key ctrl+s; sleep 3
  cp "$work/$name.rviz" "$d/saved.rviz"
  kill -INT "$RP" 2>/dev/null; sleep 2; kill "$RP" 2>/dev/null; sleep 1
  pgrep -f "[r]viz2 -d $work" > /dev/null && pkill -9 -f "[r]viz2 -d $work"
  rm -rf "$work"
  [ -n "$NAV" ] && bash parity/scripts/stop_reference.sh "$DOMAIN" > "$d/stop.txt" 2>&1
  echo "done $name: $(wc -l < "$d/saved.rviz") lines saved, cmp installed: $(cmp -s "$d/installed.rviz" "$d/saved.rviz" && echo same || echo differs)"
done
kill "$XP" 2>/dev/null
