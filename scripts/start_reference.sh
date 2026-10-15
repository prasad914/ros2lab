#!/usr/bin/env bash
# Start a REAL ROS 2 Jazzy reference run, headless, in the background.
# Usage: start_reference.sh <robot> <scenario> <ros_domain_id> <gz_partition>
#   robot:    tb3_burger | tb3_waffle | tb3_waffle_pi | tb4
#   scenario (TB3): sensors | slam | cartographer | nav_robotis | nav2_bringup | nav2_bringup_slam
#   scenario (TB4): tb4_slam_nav | tb4_nav2_bringup
# Optional env: TB3_WS=<path to a source-built turtlebot3 workspace>, MAP=<map yaml>
set -eu
ROBOT=${1:?robot}; SCEN=${2:?scenario}; DOMAIN=${3:?domain id}; PART=${4:?gz partition}

set +u
source /opt/ros/jazzy/setup.bash
if [ -n "${TB3_WS:-}" ] && [ -f "$TB3_WS/install/setup.bash" ]; then source "$TB3_WS/install/setup.bash"; fi
set -u
export ROS_DOMAIN_ID=$DOMAIN GZ_PARTITION=$PART
case $ROBOT in tb3_*) export TURTLEBOT3_MODEL=${ROBOT#tb3_} ;; esac   # burger | waffle | waffle_pi

OUT=tests/fixtures/$ROBOT/$SCEN; LOG=$OUT/logs
mkdir -p "$LOG"
PIDFILE=/tmp/ros2lab_ref_$DOMAIN.pids; : > "$PIDFILE"

# Each command gets its own process group so stop_reference.sh can kill everything.
bg() { local name=$1; shift; setsid "$@" > "$LOG/$name.log" 2>&1 & echo $! >> "$PIDFILE"; }

# ROBOTIS launch files open the Gazebo GUI; run them on a virtual display.
TB3_WORLD="xvfb-run -a ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py"
MAP=${MAP:-$PWD/tests/fixtures/maps/turtlebot3_world.yaml}
need_map() { [ -f "$MAP" ] || { echo "No map at $MAP – run the slam scenario and save a map first (map_saver_cli)"; exit 2; }; }

case $SCEN in
  sensors)
    bg gazebo $TB3_WORLD ;;
  slam)
    bg gazebo $TB3_WORLD; sleep 15
    bg slam ros2 launch slam_toolbox online_async_launch.py use_sim_time:=True ;;
  cartographer)
    bg gazebo $TB3_WORLD; sleep 15
    bg carto xvfb-run -a ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True ;;
  nav_robotis)
    need_map
    bg gazebo $TB3_WORLD; sleep 15
    bg nav2 xvfb-run -a ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:="$MAP" ;;
  nav2_bringup)
    # Nav2's own TB3 demo; its robot model (nav2_minimal_tb3_sim) may differ from TURTLEBOT3_MODEL.
    bg nav2demo ros2 launch nav2_bringup tb3_simulation_launch.py headless:=True use_rviz:=False ;;
  nav2_bringup_slam)
    bg nav2demo ros2 launch nav2_bringup tb3_simulation_launch.py headless:=True use_rviz:=False slam:=True ;;
  tb4_slam_nav)
    bg tb4 xvfb-run -a ros2 launch turtlebot4_gz_bringup turtlebot4_gz.launch.py slam:=true nav2:=true rviz:=false ;;
  tb4_nav2_bringup)
    bg nav2demo ros2 launch nav2_bringup tb4_simulation_launch.py headless:=True use_rviz:=False ;;
  *) echo "unknown scenario $SCEN"; exit 2 ;;
esac

{
  echo "robot=$ROBOT scenario=$SCEN domain=$DOMAIN partition=$PART model=${TURTLEBOT3_MODEL:-n/a}"
  echo "date=$(date -Iseconds)"
  echo "ros_distro=$ROS_DISTRO tb3_ws=${TB3_WS:-none}"
  dpkg-query -W -f='${Package} ${Version}\n' 'ros-jazzy-nav2-*' 'ros-jazzy-turtlebot*' 'ros-jazzy-slam-toolbox' 'ros-jazzy-ros-gz*' 2>/dev/null
} > "$OUT/run_info.txt"
echo "Started $SCEN for $ROBOT on domain $DOMAIN. Logs: $LOG  PIDs: $PIDFILE"
echo "Note: TB4 Gazebo may start paused – if /clock does not advance, unpause it (gz service on the world control service) and record that in run_info.txt."
