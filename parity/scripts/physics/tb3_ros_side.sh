#!/usr/bin/env bash
# ROS side of the TB3 burger sensors/odom (REAL): gz server with parity/scripts/physics/worlds/tb3_sensors_wall.sdf
# (installed burger model) + ros_gz_bridge parameter_bridge with the INSTALLED turtlebot3_burger_bridge.yaml (the
# same bridge spawn_turtlebot3.launch.py starts). Captures topic types, QoS, rates, frame ids, covariances.
# Domain 50. Usage: tb3_ros_side.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/../env.sh"
source parity/scripts/domain_procs.sh
[ -n "$(domain_pids 50)" ] && { echo "domain 50 busy"; exit 3; }
OUT=parity/fixtures/physics/tb3_ros_side; rm -rf $OUT; mkdir -p $OUT
TB3=/opt/ros/jazzy/share/turtlebot3_gazebo
E="env ROS_DOMAIN_ID=50 GZ_PARTITION=phys50_rosside GZ_IP=127.0.0.1 GZ_SIM_RESOURCE_PATH=$TB3/models"
$E setsid gz sim -s -r -v 4 --headless-rendering $HERE/worlds/tb3_sensors_wall.sdf > $OUT/gz_server.log 2>&1 &
$E setsid ros2 run ros_gz_bridge parameter_bridge --ros-args -p config_file:=$TB3/params/turtlebot3_burger_bridge.yaml \
  -p use_sim_time:=true > $OUT/bridge.log 2>&1 &
sleep 15
{
  echo "# REAL: gz sim (tb3_sensors_wall.sdf, installed burger model) + parameter_bridge with $TB3/params/turtlebot3_burger_bridge.yaml"
  echo "# date $(date -Iseconds)"
  for c in "ros2 topic list -t" "ros2 topic info -v /scan" "ros2 topic info -v /imu" "ros2 topic info -v /odom" \
           "ros2 topic info -v /cmd_vel" "ros2 topic info -v /tf" "ros2 topic info -v /clock"; do
    echo "## \$ $c"; $E timeout 20 $c 2>&1
  done
  for t in /imu /odom /scan /joint_states /tf /clock; do
    echo "## \$ ros2 topic hz $t   (12 s wall, then Ctrl+C)"; $E timeout -s INT 12 ros2 topic hz $t 2>&1 | tail -6
  done
  echo "## \$ ros2 topic echo --once /imu"; $E timeout 20 ros2 topic echo --once /imu 2>&1
  echo "## \$ ros2 topic echo --once /odom"; $E timeout 20 ros2 topic echo --once /odom 2>&1
  echo "## \$ ros2 topic echo --once /joint_states"; $E timeout 20 ros2 topic echo --once /joint_states 2>&1
  echo "## \$ ros2 topic echo --once /tf"; $E timeout 20 ros2 topic echo --once /tf 2>&1
  echo "## \$ ros2 topic echo --once /scan --no-arr"; $E timeout 20 ros2 topic echo --once /scan --no-arr 2>&1
  echo "## \$ ros2 topic echo --once /scan --field ranges (first 400 chars)"; $E timeout 20 ros2 topic echo --once /scan --field ranges 2>&1 | head -c 400; echo
} > $OUT/ros_side.txt 2>&1
# 1000 bridged /imu samples (orientation noise? covariance?)
$E timeout -s INT 15 ros2 topic echo /imu --csv > $OUT/imu_bridged.csv 2>&1
bash parity/scripts/stop_reference.sh 50 > $OUT/stop.txt 2>&1
grep -n "physics\|engine\|Error\|Warn\|render" $OUT/gz_server.log | head -80 > $OUT/gz_server_excerpt.txt
echo done; wc -l $OUT/imu_bridged.csv
