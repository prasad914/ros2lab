#!/usr/bin/env bash
# Start/stop an MCAP rosbag of the parity topics while the reference run is being driven.
# Usage: record_bag.sh start <robot> <scenario> <ros_domain_id> [run_label]
#        record_bag.sh stop  <ros_domain_id>
set -u
ACTION=${1:?start|stop}
source "$(dirname "$0")/env.sh"

if [ "$ACTION" = stop ]; then
  DOMAIN=${2:?domain}; P=/tmp/ros2lab_bag_$DOMAIN.pid
  if [ -f "$P" ]; then
    PID=$(cat "$P")
    kill -INT -- "-$PID" 2>/dev/null || true
    kill -INT "$PID" 2>/dev/null || true
    pkill -INT -P "$PID" 2>/dev/null || true
    sleep 3
    # If still alive, try SIGTERM then SIGKILL
    if ps -p "$PID" >/dev/null 2>&1; then
      kill -TERM "$PID" 2>/dev/null || true
      sleep 2
    fi
    rm -f "$P"
  fi
  echo "bag stopped"
  exit 0
fi

ROBOT=${2:?robot}; SCEN=${3:?scenario}; DOMAIN=${4:?domain}; LABEL=${5:-run1}
export ROS_DOMAIN_ID=$DOMAIN
OUT=parity/fixtures/$ROBOT/$SCEN/bags/$LABEL; mkdir -p "$(dirname "$OUT")"; rm -rf "$OUT"
WANT='^/(tf|tf_static|clock|scan|odom|imu|joint_states|camera/image_raw|camera/camera_info|oakd/rgb/preview/image_raw|oakd/rgb/preview/camera_info|oakd/rgb/preview/depth/points|map|map_updates|amcl_pose|particle_cloud|initialpose|goal_pose|plan|plan_smoothed|local_plan|cmd_vel|cmd_vel_nav|cmd_vel_smoothed|global_costmap/costmap|local_costmap/costmap|behavior_tree_log|waypoints|clicked_point)$'
TOPICS=$(ros2 topic list | grep -E "$WANT" | tr '\n' ' ')
[ -n "$TOPICS" ] || { echo "none of the parity topics exist yet"; exit 1; }
# shellcheck disable=SC2086
setsid -w ros2 bag record --use-sim-time -s mcap -e "$WANT" -o "$OUT" > "$OUT.log" 2>&1 &
echo $! > /tmp/ros2lab_bag_$DOMAIN.pid
echo "recording to $OUT (matching $WANT)"
