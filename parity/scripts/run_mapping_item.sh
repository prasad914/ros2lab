#!/usr/bin/env bash
# Step C mapping capture for one robot + mapper on domain 41 / partition ref41: start, coverage drive,
# capture_reference, /map + /map_updates QoS, map->odom echo, map_saver_cli, stop, goals check, and a
# nav2_map_server load of the saved map to compare /map with check_goals_on_map.py. Checks that no
# ROS_DOMAIN_ID=41 process is alive before start and after every stop.
# Usage: run_mapping_item.sh <robot> <slam|cartographer>
set -u
ROBOT=$1; SCEN=$2; D=41; P=ref41
cd "$(dirname "$0")/../.." || exit 1
OUT=parity/fixtures/$ROBOT/$SCEN; MAPD=$OUT/map
source parity/scripts/domain_procs.sh
say() { echo "[$(date +%T)] $*"; }
empty_check() { local l; l=$(domain_pids $D); if [ -n "$l" ]; then say "DOMAIN $D NOT EMPTY ($1): $l"; ps -o pid,cmd -p $(echo $l | tr ' ' ,); exit 9; fi; say "domain $D empty ($1)"; }

empty_check "before start"
# Replace this item's old tracked snapshot (bags/ and logs are untracked and left alone).
git ls-files -z "$OUT" | xargs -0 -r rm -f
rm -rf "$MAPD"

say "start_reference.sh $ROBOT $SCEN $D $P"
parity/scripts/start_reference.sh "$ROBOT" "$SCEN" $D $P || exit 1

( source parity/scripts/env.sh; export ROS_DOMAIN_ID=$D
  seen=0   # /map must be listed in two consecutive polls (graph discovery can flicker right after start)
  for i in $(seq 1 60); do
    if ros2 topic list 2>/dev/null | grep -qx /map; then seen=$((seen + 1)); [ $seen -ge 2 ] && break; else seen=0; fi
    sleep 3
  done
  [ $seen -ge 2 ] || { echo "no /map after 180 s"; exit 1; }
  say "/map present; coverage drive 180 sim s (wall limit 3600 s)"
  timeout -k 5 3700 python3 parity/scripts/drive_coverage.py 180 3600 > "$OUT/logs/drive_coverage.log" 2>&1
  sleep 5
  say "capture_reference.sh"
  parity/scripts/capture_reference.sh "$ROBOT" "$SCEN" $D
  timeout -k 2s 10 ros2 topic info -v /map         > "$OUT/qos/map.txt" 2>&1
  timeout -k 2s 10 ros2 topic info -v /map_updates > "$OUT/qos/map_updates.txt" 2>&1
  timeout -k 2s 6 ros2 run tf2_ros tf2_echo map odom > "$OUT/tf_echo_map_odom.txt" 2>&1
  mkdir -p "$MAPD"
  say "map_saver_cli"
  timeout -k 2s 30 ros2 run nav2_map_server map_saver_cli -f "$MAPD/map" --ros-args -p use_sim_time:=True > "$MAPD/map_saver.log" 2>&1
  echo "map_saver_cli exit=$?" >> "$MAPD/map_saver.log"
) 2>&1
say "stop_reference.sh $D"
parity/scripts/stop_reference.sh $D
empty_check "after stop"

[ -f "$MAPD/map.yaml" ] || { say "NO MAP SAVED"; exit 2; }
python3 parity/scripts/check_goals_on_map.py parity/fixtures/goals.yaml "$MAPD/map.yaml" > "$MAPD/goals_check.md"

say "map_server verification"
( source parity/scripts/env.sh; export ROS_DOMAIN_ID=$D GZ_PARTITION=$P
  setsid ros2 run nav2_map_server map_server --ros-args -p yaml_filename:="$PWD/$MAPD/map.yaml" > "$MAPD/map_server.log" 2>&1 &
  for i in $(seq 1 20); do ros2 node list 2>/dev/null | grep -qx /map_server && break; sleep 1; done
  { echo "\$ ros2 lifecycle set /map_server configure"; timeout 15 ros2 lifecycle set /map_server configure
    echo "\$ ros2 lifecycle set /map_server activate";  timeout 15 ros2 lifecycle set /map_server activate
    echo "\$ ros2 lifecycle get /map_server";           timeout 10 ros2 lifecycle get /map_server; } > "$MAPD/map_server_lifecycle.txt" 2>&1
  timeout -k 2s 20 ros2 topic echo --once --full-length --qos-durability transient_local --qos-reliability reliable /map > "$MAPD/map_server_map_echo.yaml" 2>&1
  { echo "nav2_map_server $(dpkg-query -W -f='${Version}' ros-jazzy-nav2-map-server)"
    echo "command: ros2 run nav2_map_server map_server --ros-args -p yaml_filename:=$MAPD/map.yaml; lifecycle configure + activate"
    echo "echo: ros2 topic echo --once --full-length --qos-durability transient_local --qos-reliability reliable /map (raw: map_server_map_echo.yaml)"
    echo
    python3 parity/scripts/compare_goals_mapserver.py parity/fixtures/goals.yaml "$MAPD/map_server_map_echo.yaml" "$MAPD/goals_check.md"; } > "$MAPD/goals_check_mapserver.txt" 2>&1
)
parity/scripts/stop_reference.sh $D
empty_check "after map_server stop"
say "DONE $ROBOT $SCEN"
