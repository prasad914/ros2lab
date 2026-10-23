#!/usr/bin/env bash
# Records the installed versions verbatim into parity/fixtures/tb3_jazzy_v3/versions.txt (no sudo, read-only).
source "$(dirname "$0")/../env.sh"
out=parity/fixtures/tb3_jazzy_v3/versions.txt
{
  echo "# captured $(date -Iseconds) on $(hostname)"
  echo "## lsb_release -ds"; lsb_release -ds
  echo "## uname -r"; uname -r
  echo "## dpkg -l turtlebot3* nav2* navigation2 slam_toolbox cartographer* ros-gz* opennav* gz-*-vendor"
  dpkg -l 'ros-jazzy-turtlebot3*' 'ros-jazzy-nav2*' 'ros-jazzy-navigation2' 'ros-jazzy-slam-toolbox' 'ros-jazzy-cartographer*' 'ros-jazzy-ros-gz*' 'ros-jazzy-opennav*' 'ros-jazzy-gz-*-vendor' 2>&1 | grep -E '^ii' | awk '{print $2, $3}'
  echo "## dpkg -l ros-jazzy-nav2-docking"; dpkg -l ros-jazzy-nav2-docking 2>&1 | tail -1
  echo "## which gz"; which gz
  echo "## gz sim --versions"; gz sim --versions
  echo "## TB3_WS=${TB3_WS:-<unset>} ROBOTS_WS=${ROBOTS_WS:-<unset>}"
  echo "## TURTLEBOT3_MODEL=${TURTLEBOT3_MODEL:-<unset>}"
} > "$out" 2>&1
echo "wrote $out"
