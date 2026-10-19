#!/usr/bin/env bash
# P2b PHASE A – every system dependency the non-TurtleBot3 robots need, for the INSTRUCTOR to run (needs sudo).
# Claude must not run this file. Written 2026-10-18 from (parity/robots/p2b_rosdep/):
#   rosdep check --rosdistro jazzy --from-paths ~/robots_ws/src --ignore-src          -> ALL.check.txt
#   rosdep install --simulate --rosdistro jazzy --from-paths ~/robots_ws/src --ignore-src -y -r -> ALL.simulate.txt
#   and the same per vendor folder (<vendor>.check.txt / <vendor>.simulate.txt).
# Sources checked (URL, branch, commit) are listed in parity/robots/P2B_PHASE_A.md.
set -euo pipefail

# 1. apt cannot read its source list: two entries for packages.ros.org with different Signed-By
#    ("E: Conflicting values set for option Signed-By regarding source http://packages.ros.org/ros2/ubuntu/ noble"):
#    /etc/apt/sources.list.d/ros2.list (manual, signed-by=/usr/share/keyrings/ros-archive-keyring.gpg) and
#    /etc/apt/sources.list.d/ros2.sources -> /usr/share/ros-apt-source/ros2.sources (package ros-apt-source).
#    Keep the ros-apt-source one, remove the manual line. Until this is fixed, apt-cache policy shows nothing, so the
#    package names below could not be confirmed with apt-cache (they are the names rosdep resolved).
sudo rm /etc/apt/sources.list.d/ros2.list
sudo apt-get update

# 2. Confirm every name exists before installing (prints Candidate: none for a wrong name; then stop and tell Claude).
PKGS=(
  # franka (franka_ros2 jazzy): franka_selfcollision, franka_gazebo_hardware, franka_example_controllers
  ros-jazzy-pinocchio
  # franka: franka_bringup, franka_example_controllers (test dependency)
  ros-jazzy-hardware-interface-testing
  # franka: realtime_tools vendored in franka_ros2 (test dependency)
  ros-jazzy-test-msgs
  # franka: franka_description_extensions/franka_mobile_sensors (optional extension, not needed for the FR3 simulation)
  ros-jazzy-sick-safetyscanners2
  # franka: ament linters declared by franka_ros2 packages
  ros-jazzy-ament-cmake-clang-format
  ros-jazzy-ament-cmake-clang-tidy
  # gen3 (ros2_kortex jazzy): kortex_description and kortex_moveit_config (twist / reset-fault controllers)
  ros-jazzy-picknik-twist-controller
  ros-jazzy-picknik-reset-fault-controller
  # gen3 gripper (ros2_robotiq_gripper main): robotiq_driver, robotiq_hardware_tests (linter)
  ros-jazzy-ament-clang-tidy
  # crazyflie (crazyswarm2 main): crazyflie_server_py, crazyflie_server_cpp
  ros-jazzy-motion-capture-tracking-interfaces
)
apt-cache policy "${PKGS[@]}" | grep -E "^[a-z]|Candidate"
sudo apt-get install -y "${PKGS[@]}"

# 3. Everything rosdep can still resolve (should then report nothing new). Keys skipped because they have no rosdep
#    definition on Jazzy and are not needed for simulation (each listed in P2B_PHASE_A.md with its package):
#    catkin (ugv_sdk ROS 1 build branch), serial (robotiq_driver, real gripper), olv_module_descriptions and
#    zed_wrapper (franka optional extensions), gazebo_ros / gazebo_ros2_control (Interbotix Gazebo Classic sim: needs a
#    port to Gazebo Harmonic, not an apt package), interbotix_xs_sdk / interbotix_moveit_interface /
#    interbotix_xsarm_perception (packages in the cloned Interbotix repos that are COLCON_IGNOREd).
rosdep install --rosdistro jazzy --from-paths ~/robots_ws/src --ignore-src -y -r \
  --skip-keys "catkin serial olv_module_descriptions zed_wrapper gazebo_ros gazebo_ros2_control interbotix_xs_sdk interbotix_moveit_interface interbotix_xsarm_perception"
