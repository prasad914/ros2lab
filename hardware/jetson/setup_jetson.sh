#!/usr/bin/env bash
# Set up a Jetson (Orin Nano / NX / AGX) as a ROS2Lab robot computer.
#   JetPack 7.x (Ubuntu 24.04): ROS 2 Jazzy from the official apt repository (this script).
#   JetPack 6.x (Ubuntu 22.04): Jazzy does not install natively; use the container: ./jazzy_container.sh
# Review before running. Run as the normal user (it asks for sudo).
set -euo pipefail
. /etc/os-release
if [ "${VERSION_CODENAME}" != "noble" ]; then
  echo "This is Ubuntu ${VERSION_ID} (${VERSION_CODENAME}). ROS 2 Jazzy needs Ubuntu 24.04 (JetPack 7.x)."
  echo "On JetPack 6 use ./jazzy_container.sh instead."; exit 1
fi
sudo apt update && sudo apt install -y software-properties-common curl
sudo add-apt-repository -y universe
# the ROS 2 apt source package (docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html)
ROS_APT_SOURCE_VERSION=$(curl -s https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest | grep -F "tag_name" | awk -F\" '{print $4}')
curl -L -o /tmp/ros2-apt-source.deb "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ROS_APT_SOURCE_VERSION}/ros2-apt-source_${ROS_APT_SOURCE_VERSION}.${VERSION_CODENAME}_all.deb"
sudo dpkg -i /tmp/ros2-apt-source.deb
sudo apt update
sudo apt install -y ros-jazzy-ros-base ros-dev-tools \
  ros-jazzy-ros2-control ros-jazzy-ros2-controllers ros-jazzy-imu-sensor-broadcaster \
  ros-jazzy-xacro ros-jazzy-robot-state-publisher ros-jazzy-joint-state-publisher \
  ros-jazzy-rmw-cyclonedds-cpp ros-jazzy-navigation2 ros-jazzy-nav2-bringup ros-jazzy-slam-toolbox \
  ros-jazzy-moveit ros-jazzy-python-qt-binding ros-jazzy-rosbridge-server
sudo rosdep init 2>/dev/null || true
rosdep update
# serial ports without sudo, and the stable /dev/ros2lab_mcu name
sudo usermod -aG dialout "$USER"
HERE=$(cd "$(dirname "$0")" && pwd)
sudo cp "$HERE/../src/ros2lab_hardware/udev/99-ros2lab-mcu.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
echo "If the board's USB chip is a CP2102 or FTDI (lidars use the same chips), put its serial number in"
echo "/etc/udev/rules.d/99-ros2lab-mcu.rules: udevadm info -a -n /dev/ttyUSB0 | grep '{serial}' | head -1"
# middleware: Cyclone DDS, robot traffic only on this machine unless you need other computers
grep -q "RMW_IMPLEMENTATION" ~/.bashrc || cat >> ~/.bashrc <<'RC'
source /opt/ros/jazzy/setup.bash
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
export ROS_DOMAIN_ID=${ROS_DOMAIN_ID:-7}
# export ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST   # uncomment to keep ROS 2 traffic on the Jetson only
[ -f ~/ros2_ws/install/setup.bash ] && source ~/ros2_ws/install/setup.bash
RC
# full performance (fan and clocks); MAXN on Orin
sudo nvpmodel -m 0 || true
sudo jetson_clocks || true
echo "Done. Log out and in (dialout group), then build ~/ros2_ws: colcon build --symlink-install"
