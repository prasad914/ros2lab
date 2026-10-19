#!/usr/bin/env bash
# Copy the INSTALLED config files that define real Jazzy behaviour into parity/fixtures/_installed/.
# These are the source of truth for params, bridge topics, sensors and RViz defaults.
set -u
source "$(dirname "$0")/env.sh"
OUT=parity/fixtures/_installed; mkdir -p "$OUT"

share() { local p; p=$(ros2 pkg prefix "$1" 2>/dev/null) && echo "$p/share/$1"; }

copy_glob() {  # <package> <relative glob> <dest subdir>
  local s; s=$(share "$1") || { echo "not installed: $1" >> "$OUT/missing.txt"; return; }
  mkdir -p "$OUT/$3"
  # shellcheck disable=SC2086
  for f in $s/$2; do [ -e "$f" ] && cp -r "$f" "$OUT/$3/"; done
}

: > "$OUT/missing.txt"
copy_glob nav2_bringup          'params/*.yaml'          nav2_bringup/params
copy_glob nav2_bringup          'rviz/*.rviz'            nav2_bringup/rviz
copy_glob nav2_bringup          'launch/*.py'            nav2_bringup/launch
copy_glob turtlebot3_navigation2 'param/*'               turtlebot3_navigation2/param
copy_glob turtlebot3_navigation2 'rviz/*'                turtlebot3_navigation2/rviz
copy_glob turtlebot3_gazebo     'params/*'               turtlebot3_gazebo/params
copy_glob turtlebot3_gazebo     'launch/*.py'            turtlebot3_gazebo/launch
copy_glob turtlebot3_gazebo     'models/turtlebot3_*'    turtlebot3_gazebo/models
copy_glob turtlebot3_description 'urdf/*'                turtlebot3_description/urdf
copy_glob turtlebot3_cartographer 'config/*'             turtlebot3_cartographer/config
copy_glob slam_toolbox          'config/*.yaml'          slam_toolbox/config
copy_glob nav2_minimal_tb3_sim  'urdf/*'                 nav2_minimal_tb3_sim/urdf
copy_glob nav2_minimal_tb3_sim  'configs/*'              nav2_minimal_tb3_sim/configs
copy_glob rviz_default_plugins  'plugins_description.xml' rviz_default_plugins
copy_glob rviz_default_plugins  '*.xml'                  rviz_default_plugins
copy_glob nav2_rviz_plugins     '*.xml'                  nav2_rviz_plugins
copy_glob turtlebot4_gz_bringup 'config/*'               turtlebot4_gz_bringup/config
copy_glob turtlebot4_navigation 'config/*'               turtlebot4_navigation/config

ros2 pkg list > "$OUT/ros2_pkg_list.txt"
dpkg-query -W -f='${Package} ${Version}\n' 'ros-jazzy-*' 2>/dev/null > "$OUT/dpkg_versions.txt"
gz sim --versions > "$OUT/gz_version.txt" 2>&1
echo "Copied installed files to $OUT (see missing.txt for packages not installed)"
