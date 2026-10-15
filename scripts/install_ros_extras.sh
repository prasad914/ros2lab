#!/usr/bin/env bash
# Installs every listed ROS 2 Jazzy package that exists in apt; reports the rest.
set -u
sudo apt update

want=(
  # core of the kit
  ros-jazzy-ros-gz ros-jazzy-navigation2 ros-jazzy-nav2-bringup ros-jazzy-slam-toolbox
  ros-jazzy-rosbag2-storage-mcap ros-jazzy-tf2-tools ros-jazzy-xacro xvfb
  # optional navigation extras
  ros-jazzy-nav2-graceful-controller ros-jazzy-opennav-docking ros-jazzy-nav2-route
  ros-jazzy-nav2-loopback-sim ros-jazzy-cartographer-ros ros-jazzy-robot-localization
  ros-jazzy-teleop-twist-keyboard ros-jazzy-rosbridge-server ros-jazzy-foxglove-bridge
  ros-jazzy-depthimage-to-laserscan ros-jazzy-pointcloud-to-laserscan
  ros-jazzy-rqt-tf-tree ros-jazzy-rqt-image-view ros-jazzy-rqt-graph
  # TurtleBot4
  ros-jazzy-turtlebot4-simulator ros-jazzy-turtlebot4-desktop ros-jazzy-turtlebot4-navigation
  # arms (only needed later, for manipulation checks)
  ros-jazzy-moveit ros-jazzy-ur ros-jazzy-ur-simulation-gz ros-jazzy-franka-description
)
# every TurtleBot3 and Nav2 minimal-sim package that exists
mapfile -t extra < <(apt-cache pkgnames ros-jazzy-turtlebot3; apt-cache pkgnames ros-jazzy-nav2-minimal-tb)
want+=("${extra[@]}")

ok=(); missing=()
for p in "${want[@]}"; do
  if apt-cache show "$p" >/dev/null 2>&1; then ok+=("$p"); else missing+=("$p"); fi
done

sudo apt install -y "${ok[@]}"
echo
echo "Installed or already present: ${#ok[@]} packages"
echo "Not available in apt for Jazzy (need a source build, or a different name):"
printf '  %s\n' "${missing[@]}"
