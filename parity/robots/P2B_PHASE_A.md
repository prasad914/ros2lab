# P2b PHASE A – sources and system dependencies (2026-10-18, unattended)

Nothing here is built or verified. Phase B (build + verify, one robot at a time) waits until the instructor has run
`parity/scripts/robots_sudo.sh`. Raw outputs: `parity/robots/p2b_rosdep/` (`ALL.check.txt`, `ALL.simulate.txt`, and per
vendor folder `<vendor>.check.txt`, `<vendor>.simulate.txt`).

## Blocking machine problem

`apt` cannot read its source list:
`E: Conflicting values set for option Signed-By regarding source http://packages.ros.org/ros2/ubuntu/ noble:
/usr/share/keyrings/ros-archive-keyring.gpg != -----BEGIN PGP PUBLIC KEY BLOCK----- …`
Two files point at packages.ros.org: `/etc/apt/sources.list.d/ros2.list` (manual line) and
`/etc/apt/sources.list.d/ros2.sources` → `/usr/share/ros-apt-source/ros2.sources`. Because of this, `apt-cache policy`
printed nothing for every name below, so the apt names are **UNVERIFIED** (they are rosdep's resolution);
`robots_sudo.sh` removes the manual file, runs `apt-get update`, and prints `apt-cache policy` before installing.

## Sources in ~/robots_ws/src

Branches checked with `git ls-remote --heads <url>` on 2026-10-18.

| Folder | URL | Branch | Commit | Note |
|---|---|---|---|---|
| agilex/scout_ros2 | https://github.com/agilexrobotics/scout_ros2.git | origin/jazzy (local branch `jazzy`) | 48f70cbefa74 | earlier clone was on `humble` (bf0110ff); switched to the maker's Jazzy branch |
| ugv_sdk | https://github.com/agilexrobotics/ugv_sdk.git | main | f2704eacdc90 | earlier clone, clean |
| dobot/DOBOT_6Axis_ROS2_V4 | https://github.com/Dobot-Arm/DOBOT_6Axis_ROS2_V4.git | jazzy | 89d47c66a6e0 | cloned now (folder was empty) |
| franka/franka_ros2 | https://github.com/frankaemika/franka_ros2.git | jazzy | 4acc05c01ebf | earlier clone, clean |
| franka/franka_description | https://github.com/frankarobotics/franka_description.git | jazzy | 72baf5bf4e88 | cloned now |
| libfranka | https://github.com/frankaemika/libfranka.git | detached | bfe302e4feb1 | earlier clone, clean |
| interbotix/interbotix_ros_core | https://github.com/Interbotix/interbotix_ros_core.git | jazzy | 41ca7357935b | earlier clone, **37 uncommitted changes** (submodule `interbotix_ros_xseries` deleted in the tree); left untouched, to be checked in phase B |
| interbotix/interbotix_ros_manipulators | https://github.com/Interbotix/interbotix_ros_manipulators.git | jazzy | 01c557d65f78 | earlier clone, clean |
| interbotix/interbotix_ros_toolboxes | https://github.com/Interbotix/interbotix_ros_toolboxes.git | jazzy | 27f7628eb411 | earlier clone, clean |
| kinova/ros2_kortex | https://github.com/Kinovarobotics/ros2_kortex.git | jazzy | 462dab9aa473 | cloned now |
| kinova/ros2_robotiq_gripper | https://github.com/PickNikRobotics/ros2_robotiq_gripper.git | main | a74d007d8f2f | cloned now (gen3 gripper) |
| xarm/xarm_ros2 | https://github.com/xArm-Developer/xarm_ros2.git | jazzy | 3dc2b5e82947 | earlier clone, clean |
| crazyflie/crazyswarm2 | https://github.com/IMRCLab/crazyswarm2.git | main (only branch) | f1e09954f56c | cloned now |

The URLs of the newly cloned repos are the makers' repositories; the site's `public/robots/ws/*/*.repos` were used only
as pointers to them (no site files were used as sources).

## Per robot

| Robot | Source | rosdep result | Missing system packages (robots_sudo.sh) | Not resolvable by apt |
|---|---|---|---|---|
| tb4 | apt (`ros-jazzy-turtlebot4-gz-bringup` 2.0.2 installed) | – | – | – |
| ur5e | apt (`ros-jazzy-ur-simulation-gz` 2.5.0 installed) | – | – | – |
| fr3 | franka_ros2 + franka_description + libfranka | 7 apt keys | pinocchio, hardware-interface-testing, test-msgs, sick-safetyscanners2, ament-cmake-clang-format, ament-cmake-clang-tidy | olv_module_descriptions (franka_mobile_sensors), zed_wrapper (franka_vision_and_manipulation_kit): optional extensions |
| gen3 | ros2_kortex + ros2_robotiq_gripper | 3 apt keys | picknik-twist-controller, picknik-reset-fault-controller, ament-clang-tidy | serial (robotiq_driver, real gripper only) |
| xarm6, lite6 | xarm_ros2 | all satisfied | – | – |
| cr5 | DOBOT_6Axis_ROS2_V4 | all satisfied | – | – |
| wx250s | Interbotix repos | unresolved keys only | – | gazebo_ros, gazebo_ros2_control (interbotix_common_sim, interbotix_xsarm_sim: Gazebo Classic, needs a Harmonic port); interbotix_xs_sdk, interbotix_moveit_interface, interbotix_xsarm_perception (COLCON_IGNOREd in the clones) |
| scout | scout_ros2 (jazzy) + ugv_sdk | unresolved key only | – (libasio-dev, from the ugv_sdk README, is already installed 1:1.28.1-0.2) | catkin (ugv_sdk's ROS 1 build path) |
| crazyflie | crazyswarm2 | 1 apt key | motion-capture-tracking-interfaces | – |
| magician, so101, irb120, kr6, lrmate, go2, g1, h1, spot | not cloned | not run | – | STATUS.md lists no maker repository; finding one was not done in this phase |
| arm3, arm6, chiku, chiku_mesh, quadcopter, quadruped, hexapod, humanoid, mobile_manipulator, legged_manipulator, ackermann, mecanum | ROS2Lab course robots | not applicable | – | no upstream maker workspace exists |

## Instructor step (2026-10-18, reported by the instructor)

The instructor did robots_sudo.sh's steps by hand: `/etc/apt/sources.list.d/ros2.list` moved to `~/ros2.list.bak`,
`apt-get update` clean, the 10 packages installed (0 upgraded, 0 removed), `rosdep install --from-paths
~/robots_ws/src` reported "All required rosdeps installed successfully".
Checked on this machine afterwards: `ros2.list` is gone from sources.list.d and `~/ros2.list.bak` exists;
`apt-cache policy` works again; all 10 packages are installed (`p2b_rosdep/installed_after_sudo.txt`, dpkg-query);
`rosdep check` over ~/robots_ws/src ends with "All system dependencies have been satisfied", the remaining lines are
the keys without a rosdep definition listed above (`p2b_rosdep/ALL.check_after_sudo.txt`).
