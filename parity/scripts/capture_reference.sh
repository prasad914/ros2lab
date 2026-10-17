#!/usr/bin/env bash
# Snapshot ground-truth evidence from a running reference stack (graph, QoS, rates, params, TF, lifecycle).
# For time-series data (paths, trajectories, costmaps) use parity/scripts/record_bag.sh start/stop around the actions.
# Usage: capture_reference.sh <robot> <scenario> <ros_domain_id>
# Optional env: OUT_DIR=<dir> (default parity/fixtures/<robot>/<scenario>)
set -u
ROBOT=${1:?robot}; SCEN=${2:?scenario}; DOMAIN=${3:?domain id}
source "$(dirname "$0")/env.sh"
export ROS_DOMAIN_ID=$DOMAIN
OUT=${OUT_DIR:-parity/fixtures/$ROBOT/$SCEN}; mkdir -p "$OUT/qos" "$OUT/params" "$OUT/errors"

ros2 topic list -t   > "$OUT/topic_list.txt"
ros2 node list       > "$OUT/node_list.txt"
ros2 action list -t  > "$OUT/action_list.txt"
ros2 service list -t > "$OUT/service_list.txt"

# QoS (reliability/durability/depth) and publisher/subscriber counts per topic
while read -r topic _; do
  f=$(echo "$topic" | sed 's#^/##; s#/#__#g')
  timeout -k 2s 10 ros2 topic info -v "$topic" > "$OUT/qos/$f.txt" 2>&1
done < <(ros2 topic list)

# Message rates for the sensor and nav topics that exist
for t in /scan /odom /imu /camera/image_raw /camera/camera_info /oakd/rgb/preview/image_raw /oakd/rgb/preview/depth/points /tf /map /plan /cmd_vel /particle_cloud /global_costmap/costmap /local_costmap/costmap; do
  if grep -q "^$t " "$OUT/topic_list.txt"; then
    f=$(echo "$t" | sed 's#^/##; s#/#__#g')
    timeout -k 2s 12 ros2 topic hz "$t" --window 50 > "$OUT/qos/${f}_hz.txt" 2>&1
  fi
done

# Parameters of every node (Nav2 defaults, AMCL, costmaps, SLAM)
while read -r node; do
  f=$(echo "$node" | sed 's#^/##; s#/#__#g')
  timeout -k 2s 20 ros2 param dump "$node" > "$OUT/params/$f.yaml" 2>&1
done < "$OUT/node_list.txt"

# TF tree (view_frames writes frames_<date>.gv/.pdf into the cwd)
( cd "$OUT" && timeout -k 2s 15 ros2 run tf2_tools view_frames > view_frames.log 2>&1 )

# Lifecycle states of Nav2 nodes, if any
for n in $(grep -E 'amcl|map_server|planner_server|controller_server|bt_navigator|behavior_server|smoother_server|velocity_smoother|collision_monitor|waypoint_follower' "$OUT/node_list.txt"); do
  echo "$n: $(timeout -k 2s 5 ros2 lifecycle get "$n" 2>&1)"
done > "$OUT/lifecycle.txt"

# One message of each latched / slow topic, for exact field comparison
mkdir -p "$OUT/samples"
for t in /robot_description /camera/camera_info /oakd/rgb/preview/camera_info /map /amcl_pose /plan; do
  if grep -q "^$t " "$OUT/topic_list.txt"; then
    f=$(echo "$t" | sed 's#^/##; s#/#__#g')
    timeout -k 2s 15 ros2 topic echo --once --qos-durability transient_local --qos-reliability reliable "$t" > "$OUT/samples/$f.yaml" 2>&1 \
      || timeout -k 2s 15 ros2 topic echo --once "$t" > "$OUT/samples/$f.yaml" 2>&1
  fi
done
echo "Captured snapshot to $OUT"
