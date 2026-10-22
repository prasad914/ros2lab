#!/usr/bin/env bash
# UR5e under gz_ros2_control (installed ur_simulation_gz), REAL Gazebo Harmonic, headless, domain 50.
# Usage: ur5e_case.sh traj <runs>
#        ur5e_case.sh step <update_rate> <position_proportional_gain> <runs>
# The step mode uses a COPY of ur_simulation_gz/config/ur_controllers.yaml with update_rate changed and
#   gz_ros_control: ros__parameters: position_proportional_gain: <gain>
# appended (the parameter gz_ros2_control's GazeboSimSystem reads; it logs "The position_proportional_gain has been set to").
set -u
MODE=${1:?traj|step}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/../env.sh"            # ROS 2 Jazzy, cd to repo root
source parity/scripts/domain_procs.sh
DOMAIN=50
[ -n "$(domain_pids $DOMAIN)" ] && { echo "domain $DOMAIN busy: $(domain_pids $DOMAIN)"; exit 3; }
# ROS_DOMAIN_ID is set per command (E), not exported: stop_reference.sh kills every process that has it
SRC=/opt/ros/jazzy/share/ur_simulation_gz/config/ur_controllers.yaml
if [ "$MODE" = traj ]; then
  RUNS=${2:-3}; CASE=ur5e_traj; CTRL=joint_trajectory_controller; CFG=$SRC; SECS=8
else
  RATE=${2:?update_rate}; GAIN=${3:?gain}; RUNS=${4:-3}; CASE=ur5e_step_r${RATE}_g${GAIN}; CTRL=forward_position_controller; SECS=3
  mkdir -p parity/fixtures/physics/$CASE
  CFG=$PWD/parity/fixtures/physics/$CASE/ur_controllers.yaml
  sed "s/^    update_rate: 500  # Hz/    update_rate: $RATE  # Hz (ROS2Lab physics baseline; installed file: 500)/" $SRC > $CFG
  printf '\n# ROS2Lab physics baseline: gz_ros2_control position command gain\ngz_ros_control:\n  ros__parameters:\n    position_proportional_gain: %s\n' "$GAIN" >> $CFG
fi
OUTC=parity/fixtures/physics/$CASE; mkdir -p $OUTC
for k in $(seq 1 $RUNS); do
  OUT=$OUTC/run$k; rm -rf $OUT; mkdir -p $OUT
  E="env ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=phys50_${CASE}_$k"
  $E setsid ros2 launch ur_simulation_gz ur_sim_control.launch.py ur_type:=ur5e launch_rviz:=false gazebo_gui:=false \
    initial_joint_controller:=$CTRL controllers_file:=$CFG > $OUT/launch.log 2>&1 &
  LP=$!
  # wait for the controller to be active
  for _ in $(seq 1 90); do
    $E ros2 control list_controllers 2>/dev/null | grep -q "$CTRL .*active" && break; sleep 1
  done
  $E ros2 control list_controllers > $OUT/controllers.txt 2>&1
  $E python3 parity/scripts/physics/ur5e_record.py $MODE $OUT --secs $SECS > $OUT/recorder.txt 2>&1
  $E ros2 param get /gz_ros_control position_proportional_gain > $OUT/gain_param.txt 2>&1
  kill -TERM -- -$LP 2>/dev/null; sleep 5; kill -KILL -- -$LP 2>/dev/null
  bash parity/scripts/stop_reference.sh $DOMAIN > $OUT/stop.txt 2>&1
  grep -n "position_proportional_gain\|update_rate\|ERROR\|WARN\|Loaded\|physics" $OUT/launch.log | head -60 > $OUT/launch_excerpt.txt
  echo "$CASE run$k done: $(wc -l < $OUT/joint_states.csv) joint_states rows"
done
