#!/usr/bin/env bash
# Checks that the real ROS 2 Jazzy reference stack is installed. Installs nothing.
set +u
source /opt/ros/jazzy/setup.bash 2>/dev/null || { echo "MISSING: /opt/ros/jazzy (ROS 2 Jazzy not installed)"; exit 1; }
set -u
if [ -n "${TB3_WS:-}" ] && [ -f "$TB3_WS/install/setup.bash" ]; then source "$TB3_WS/install/setup.bash"; echo "sourced TB3_WS=$TB3_WS"; fi

missing=(); optional_missing=()
need_pkg() { ros2 pkg prefix "$1" >/dev/null 2>&1 || missing+=("$1"); }
want_pkg() { ros2 pkg prefix "$1" >/dev/null 2>&1 || optional_missing+=("$1"); }

# Required for TurtleBot3 parity
for p in ros_gz_sim ros_gz_bridge ros_gz_image robot_state_publisher xacro \
         turtlebot3_gazebo turtlebot3_description turtlebot3_navigation2 turtlebot3_cartographer turtlebot3_teleop \
         nav2_bringup nav2_amcl nav2_map_server nav2_planner nav2_controller nav2_costmap_2d \
         nav2_bt_navigator nav2_behaviors nav2_smoother nav2_waypoint_follower \
         nav2_velocity_smoother nav2_collision_monitor nav2_lifecycle_manager \
         nav2_navfn_planner nav2_smac_planner nav2_theta_star_planner \
         nav2_mppi_controller nav2_dwb_controller nav2_regulated_pure_pursuit_controller nav2_rotation_shim_controller \
         nav2_rviz_plugins nav2_simple_commander nav2_minimal_tb3_sim \
         slam_toolbox tf2_tools rosbag2_storage_mcap rviz2 rviz_default_plugins ; do
  need_pkg "$p"
done
# Optional (used by later prompts if present)
for p in nav2_graceful_controller opennav_docking nav2_route nav2_loopback_sim cartographer_ros \
         robot_localization teleop_twist_keyboard turtlebot4_gz_bringup turtlebot4_navigation \
         rosbridge_server foxglove_bridge depthimage_to_laserscan pointcloud_to_laserscan rqt_tf_tree rqt_image_view ; do
  want_pkg "$p"
done

for c in gz xvfb-run node npx git; do
  command -v "$c" >/dev/null 2>&1 || missing+=("command:$c")
done

echo "ROS_DISTRO=${ROS_DISTRO:-unset}  TURTLEBOT3_MODEL=${TURTLEBOT3_MODEL:-unset}  ROS_DOMAIN_ID=${ROS_DOMAIN_ID:-unset}"
gz sim --versions 2>/dev/null | head -1 | sed 's/^/gz sim version: /'

if [ ${#optional_missing[@]} -gt 0 ]; then
  echo "OPTIONAL not installed (features depending on them will be marked UNVERIFIED):"
  printf '  %s\n' "${optional_missing[@]}"
fi

if [ ${#missing[@]} -eq 0 ]; then
  echo "OK: all required packages and commands found"
  exit 0
fi

echo "MISSING (required):"; printf '  %s\n' "${missing[@]}"
pkgs=$(printf '%s\n' "${missing[@]}" | grep -v '^command:' | tr '_' '-' | sed 's/^/ros-jazzy-/' | tr '\n' ' ')
[ -n "$pkgs" ] && echo "Instructor: run ->  sudo apt install $pkgs"
printf '%s\n' "${missing[@]}" | grep -q 'command:xvfb-run' && echo "Instructor: run ->  sudo apt install xvfb"
printf '%s\n' "${missing[@]}" | grep -qE 'command:(node|npx)' && echo "Instructor: install Node.js 20+ for the website and Playwright"
echo "(Package names follow the ros-jazzy-<name> pattern; confirm with apt-cache policy if one is not found.)"
exit 1
