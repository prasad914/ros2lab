#!/usr/bin/env bash
# /map_metadata QoS and `--once` echo while the slam scenario runs (Phase 1 item 5). Start it first:
#   OUT_DIR=parity/fixtures/tb3_burger/slam_map_metadata parity/scripts/start_reference.sh tb3_burger slam 41 phase1_41
# wait ~45 s, run this, then parity/scripts/stop_reference.sh 41
set -u
source parity/scripts/env.sh
export ROS_DOMAIN_ID=41 GZ_PARTITION=phase1_41
OUT=parity/fixtures/tb3_burger/slam_map_metadata
cap() { local f=$1; shift; { echo "# $(date -Iseconds) ROS_DOMAIN_ID=41 GZ_PARTITION=phase1_41 TURTLEBOT3_MODEL=burger"; echo "# cmd: $*"; "$@" 2>&1; echo "# exit: $?"; } > "$OUT/$f"; }
cap topic_info_map_metadata.txt ros2 topic info /map_metadata -v --no-daemon
cap echo_map_metadata_once.txt timeout 30 ros2 topic echo /map_metadata --once --no-daemon
cap echo_map_metadata_once_volatile.txt timeout 15 ros2 topic echo /map_metadata --once --no-daemon --qos-durability volatile
cap topic_info_map.txt ros2 topic info /map -v --no-daemon
