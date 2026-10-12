#!/usr/bin/env node
// Brings each robot's REAL official ROS 2 Jazzy workspace from GitHub into the site:
//   public/robots/ws/<wsid>/src/<repo>/<pkg>/...   the packages, copied unmodified from pinned commits
//   public/robots/ws/<wsid>/workspace.json          contract: see /home/claude/v23/notes/V23-CONTEXT.md
//   public/robots/ws/<wsid>/<wsid>.repos            vcs-tool file (pinned commits) for a real Ubuntu 24.04 machine
//
// What is copied: every package of every listed repository (package.xml, CMakeLists/setup.py, launch, config, urdf,
// xacro, srdf, yaml, rviz, worlds, model.sdf/config, msg/srv/action, C++/Python sources, LICENSE/NOTICE files), minus
// docs/, test/, .github/, CI and images. Mesh/texture files (stl, dae, obj, png ...) are copied only when a robot
// description or world the site uses refers to them: references are found by expanding the gallery robots' xacro
// files with the REAL xacro and by following model:// / package:// URIs in the worlds and models the entries launch.
// Byte-identical mesh copies inside one workspace are stored once and listed in workspace.json "alias".
//
// Usage: node tools/fetch-workspaces.mjs [wsid ...] [--cache DIR] [--latest]
//   --latest  only prints the current head commit of every pinned branch (to update PINS below by hand)
// Needs git + python3 (PyYAML) and the pure-python xacro + ament_index_python sources (R2L_PYTHONPATH, default:
// /home/claude/v23/up/xacro:/home/claude/v23/up/ament_index/ament_index_python).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { scanPackage, walk, git, sha1, ROOT, parsePackageXml } from "./build-ros-share.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CACHE = path.resolve(opt("--cache", process.env.R2L_WS_CACHE || path.join(os.tmpdir(), "ros2lab-ws-cache")));
const OUT = path.join(ROOT, "public/robots/ws");
export const R2L_PYTHONPATH = process.env.R2L_PYTHONPATH ||
  "/home/claude/v23/up/xacro:/home/claude/v23/up/ament_index/ament_index_python";

const GH = (r) => `https://github.com/${r}.git`;
// ---------------------------------------------------------------------------------------------------------------
// Pinned repositories (branch = the official Jazzy branch; commit = head of that branch on 2026-10-11)
// ---------------------------------------------------------------------------------------------------------------
const R = {
  turtlebot3: { url: GH("ROBOTIS-GIT/turtlebot3"), branch: "jazzy", commit: "0c0be84e3f5c3194fb2adea8426a58a96060eab5", license: "Apache-2.0" },
  turtlebot3_msgs: { url: GH("ROBOTIS-GIT/turtlebot3_msgs"), branch: "jazzy", commit: "9209e01b4708cf3ca5610b01dfc9586d3c7889d8", license: "Apache-2.0" },
  turtlebot3_simulations: { url: GH("ROBOTIS-GIT/turtlebot3_simulations"), branch: "jazzy", commit: "45633014a14e8f438495b532a723e4ad45cbbd31", license: "Apache-2.0" },
  DynamixelSDK: { url: GH("ROBOTIS-GIT/DynamixelSDK"), branch: "jazzy", commit: "516ae8632c593d7c84afd2bdee2a2fac965305cc", license: "Apache-2.0" },
  hls_lfcd_lds_driver: { url: GH("ROBOTIS-GIT/hls_lfcd_lds_driver"), branch: "jazzy", commit: "6a80b3f1535d1cc05b860085c3d55bff1f7e90bd", license: "BSD-3-Clause" },
  ld08_driver: { url: GH("ROBOTIS-GIT/ld08_driver"), branch: "jazzy", commit: "00dba810a0fe5579b5062c71030c1e3c79a4c5f4", license: "Apache-2.0" },
  coin_d4_driver: { url: GH("ROBOTIS-GIT/coin_d4_driver"), branch: "jazzy", commit: "79d183324729f0c1881f11ef431b6384c1aef957", license: "Apache-2.0" },
  Universal_Robots_ROS2_Description: { url: GH("UniversalRobots/Universal_Robots_ROS2_Description"), branch: "jazzy", commit: "6b639c2efd9f4f12da858a72cf1a9e40da365ed8", license: "BSD-3-Clause (ur15/ur18/ur20/ur30/ur8long meshes: UR Terms and Conditions for Use of Graphical Documentation)" },
  Universal_Robots_ROS2_GZ_Simulation: { url: GH("UniversalRobots/Universal_Robots_ROS2_GZ_Simulation"), branch: "jazzy", commit: "3600c68c5fd658a2cfc4aff20a0c3bd83a10f1b8", license: "BSD-3-Clause" },
  Universal_Robots_ROS2_Driver: { url: GH("UniversalRobots/Universal_Robots_ROS2_Driver"), branch: "jazzy", commit: "f6997bd4a0eee8d58198b696caf034009ab4de1e", license: "BSD-3-Clause" },
  franka_description: { url: GH("frankarobotics/franka_description"), branch: "jazzy", commit: "72baf5bf4e88eaec27f0eb61be1b20a001abf2ab", license: "Apache-2.0" },
  franka_ros2: { url: GH("frankarobotics/franka_ros2"), branch: "jazzy", commit: "4acc05c01ebfcdf916ee6b3df966df0ad7b2f9ec", license: "Apache-2.0" },
  ros2_kortex: { url: GH("Kinovarobotics/ros2_kortex"), branch: "jazzy", commit: "462dab9aa4732d733be55e1846530dd920c7c7d3", license: "BSD-3-Clause" },
  ros2_robotiq_gripper: { url: GH("PickNikRobotics/ros2_robotiq_gripper"), branch: "main", commit: "a74d007d8f2f06dc6a503ad21038ba869d4999a6", license: "BSD-3-Clause" },
  xarm_ros2: { url: GH("xArm-Developer/xarm_ros2"), branch: "jazzy", commit: "3dc2b5e8294758d96b54b15fa5920d581b7cbb3d", license: "BSD-3-Clause" },
  interbotix_ros_manipulators: { url: GH("Interbotix/interbotix_ros_manipulators"), branch: "jazzy", commit: "01c557d65f781697c3a05bffebafbd3404e03eab", license: "BSD-3-Clause" },
  interbotix_ros_core: { url: GH("Interbotix/interbotix_ros_core"), branch: "jazzy", commit: "41ca7357935bb06b3f21f518ad5b0a88529ba395", license: "BSD-3-Clause" },
  interbotix_ros_toolboxes: { url: GH("Interbotix/interbotix_ros_toolboxes"), branch: "jazzy", commit: "27f7628eb4116e1b5179e6b5a1c44a0f95d0389f", license: "BSD-3-Clause" },
  DOBOT_6Axis_ROS2_V4: { url: GH("Dobot-Arm/DOBOT_6Axis_ROS2_V4"), branch: "jazzy", commit: "1b493da8d319bd558c61f9bf95f440f68c19bc5c", license: "MIT" },
  crazyswarm2: { url: GH("IMRCLab/crazyswarm2"), branch: "main", commit: "f1e09954f56cd08e7d9aff5e13dc9a68795914a3", license: "MIT" },
  scout_ros2: { url: GH("agilexrobotics/scout_ros2"), branch: "origin/jazzy", commit: "48f70cbefa74b94d4442ed1a4ac9237a088abbb7", license: "Apache-2.0 (LICENSE file; package.xml says BSD)" },
};
// Repositories a real build also needs but which the site does not ship (C/C++ SDKs, git submodules, libfranka ...)
const EXTRA_REPOS = {
  libfranka: { url: GH("frankarobotics/libfranka"), version: "0.20.5", why: "C++ client library for franka_hardware (real FR3); from franka_ros2/dependency.repos" },
  ugv_sdk: { url: GH("agilexrobotics/ugv_sdk"), version: "main", why: "CAN SDK needed by scout_base (real Scout); from scout_ros2 README" },
};

const STD_STEPS = (wsid, extra = [], pre = []) => [
  "sudo apt install python3-vcstool python3-colcon-common-extensions python3-rosdep",
  "mkdir -p ~/ros2_ws/src && cd ~/ros2_ws",
  `vcs import --recursive src < ${wsid}.repos`,
  ...pre,
  "source /opt/ros/jazzy/setup.bash",
  "sudo rosdep init 2>/dev/null; rosdep update",
  "rosdep install --from-paths src --ignore-src -r -y --rosdistro jazzy",
  ...extra,
  "colcon build --symlink-install",
  "source install/setup.bash",
];

// ---------------------------------------------------------------------------------------------------------------
// Workspaces
//   repos[].packages: package dirs inside the repo ("*" = every package.xml found in the repo)
//   gallery[robot]: xacro run that produces the URDF the gallery shows (package-relative file + args)
//   meshRoots: extra xacro runs / world+model files whose mesh references must be shipped
// ---------------------------------------------------------------------------------------------------------------
export const WORKSPACES = {
  turtlebot3: {
    title: "TurtleBot3 (ROBOTIS) - ROS 2 Jazzy",
    robots: ["tb3_burger", "tb3_waffle"],
    env: { tb3_burger: { TURTLEBOT3_MODEL: "burger" }, tb3_waffle: { TURTLEBOT3_MODEL: "waffle" } },
    repos: [
      { name: "turtlebot3", packages: "*" },
      { name: "turtlebot3_msgs", packages: "*" },
      { name: "turtlebot3_simulations", packages: "*" },
      { name: "DynamixelSDK", packages: ["ros/dynamixel_sdk", "ros/dynamixel_sdk_custom_interfaces", "ros/dynamixel_sdk_examples"] },
      { name: "hls_lfcd_lds_driver", packages: "*" },
      { name: "ld08_driver", packages: "*" },
      { name: "coin_d4_driver", packages: "*" },
    ],
    gallery: {
      tb3_burger: { pkg: "turtlebot3_description", file: "urdf/turtlebot3_burger.urdf", args: [] },
      tb3_waffle: { pkg: "turtlebot3_description", file: "urdf/turtlebot3_waffle.urdf", args: [] },
    },
    meshRoots: [
      { pkg: "turtlebot3_gazebo", file: "urdf/turtlebot3_burger.urdf" },
      { pkg: "turtlebot3_gazebo", file: "urdf/turtlebot3_waffle.urdf" },
      { pkg: "turtlebot3_gazebo", file: "models/turtlebot3_burger/model.sdf" },
      { pkg: "turtlebot3_gazebo", file: "models/turtlebot3_waffle/model.sdf" },
      { pkg: "turtlebot3_gazebo", file: "worlds/empty_world.world" },
      { pkg: "turtlebot3_gazebo", file: "worlds/turtlebot3_world.world" },
      { pkg: "turtlebot3_gazebo", file: "worlds/turtlebot3_house.world" },
    ],
    entry: {
      sim: [
        { title: "Gazebo: TurtleBot3 World", cmd: "ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py" },
        { title: "Gazebo: empty world", cmd: "ros2 launch turtlebot3_gazebo empty_world.launch.py" },
        { title: "Gazebo: TurtleBot3 House", cmd: "ros2 launch turtlebot3_gazebo turtlebot3_house.launch.py" },
      ],
      slam: [{ title: "SLAM with Cartographer (run with a Gazebo world)", cmd: "ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True" }],
      map_save: { title: "Save the map", cmd: "ros2 run nav2_map_server map_saver_cli -f ~/map" },
      nav: [{ title: "Navigation2 with a saved map (run with a Gazebo world)", cmd: "ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True map:=$HOME/map.yaml" }],
      teleop: { title: "Keyboard teleoperation", cmd: "ros2 run turtlebot3_teleop teleop_keyboard" },
      rviz: { title: "Robot model in RViz", cmd: "ros2 launch turtlebot3_bringup rviz2.launch.py" },
      fake: { title: "Fake node (no physics) + RViz", cmd: "ros2 launch turtlebot3_fake_node turtlebot3_fake_node.launch.py" },
      real: {
        title: "Real TurtleBot3 (run on the robot's Raspberry Pi)",
        cmd: "ros2 launch turtlebot3_bringup robot.launch.py",
        env: { LDS_MODEL: "LDS-02" },
        needs: "a TurtleBot3 with OpenCR board and LDS-01/02/03 lidar",
        notes: "Set LDS_MODEL to LDS-01, LDS-02 or LDS-03 to match the lidar, and TURTLEBOT3_MODEL to burger or waffle. Run teleop/SLAM/Nav2 on the remote PC with the same ROS_DOMAIN_ID.",
      },
    },
    ubuntu: { steps: STD_STEPS("turtlebot3") },
  },

  ur: {
    title: "Universal Robots UR5e - ROS 2 Jazzy",
    robots: ["ur5e"],
    env: {},
    repos: [
      { name: "Universal_Robots_ROS2_Description", packages: "*" },
      { name: "Universal_Robots_ROS2_GZ_Simulation", packages: "*" },
      { name: "Universal_Robots_ROS2_Driver", packages: "*" },
    ],
    gallery: { ur5e: { pkg: "ur_description", file: "urdf/ur.urdf.xacro", args: ["ur_type:=ur5e", "name:=ur5e"] } },
    meshRoots: [
      { pkg: "ur_simulation_gz", file: "urdf/ur_gz.urdf.xacro", args: ["ur_type:=ur5e", "name:=ur"] },
    ],
    entry: {
      sim: [{ title: "Gazebo + ros2_control", cmd: "ros2 launch ur_simulation_gz ur_sim_control.launch.py ur_type:=ur5e" }],
      moveit: [
        { title: "Gazebo + MoveIt 2", cmd: "ros2 launch ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e" },
        { title: "MoveIt 2 with mock hardware (start the mock driver first)", cmd: "ros2 launch ur_robot_driver ur_control.launch.py ur_type:=ur5e robot_ip:=yyy.yyy.yyy.yyy use_mock_hardware:=true launch_rviz:=false", then: "ros2 launch ur_moveit_config ur_moveit.launch.py ur_type:=ur5e launch_rviz:=true" },
      ],
      example: { title: "Example trajectory (with the Gazebo sim running)", cmd: "ros2 run ur_robot_driver example_move.py" },
      rviz: { title: "Robot model in RViz", cmd: "ros2 launch ur_description view_ur.launch.py ur_type:=ur5e" },
      real: {
        title: "Real UR5e (ur_robot_driver)",
        cmd: "ros2 launch ur_robot_driver ur_control.launch.py ur_type:=ur5e robot_ip:=192.168.56.101 launch_rviz:=true",
        then: "ros2 launch ur_moveit_config ur_moveit.launch.py ur_type:=ur5e launch_rviz:=true",
        needs: "a UR5e (PolyScope 5.x) with the External Control URCap installed",
        notes: "Use the robot's IP address; install the externalcontrol URCap from ur_robot_driver/resources and start the program on the teach pendant. URSim works too: ros2 run ur_client_library start_ursim.sh -m ur5e",
      },
    },
    ubuntu: { steps: STD_STEPS("ur") },
  },

  franka: {
    title: "Franka Research 3 (FR3) - ROS 2 Jazzy",
    robots: ["fr3"],
    env: {},
    repos: [
      { name: "franka_description", packages: "*" },
      { name: "franka_ros2", packages: "*" },
    ],
    gallery: { fr3: { pkg: "franka_description", file: "robots/fr3/fr3.urdf.xacro", args: [] } },
    meshRoots: [
      { pkg: "franka_gazebo_bringup", file: "urdf/franka_arm.gazebo.xacro", args: ["robot_type:=fr3", "hand:=true", "ee_id:=franka_hand", "gazebo_effort:=true"] },
    ],
    entry: {
      sim: [
        { title: "Gazebo: show the FR3", cmd: "ros2 launch franka_gazebo_bringup visualize_franka_robot.launch.py" },
        { title: "Gazebo: joint impedance example controller", cmd: "ros2 launch franka_gazebo_bringup gazebo_franka_arm_example_controller.launch.py load_gripper:=true franka_hand:='franka_hand' controller:='joint_impedance_example_controller'" },
      ],
      moveit: [{ title: "MoveIt 2 with fake hardware", cmd: "ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=dont-care use_fake_hardware:=true" }],
      rviz: { title: "Robot model in RViz", cmd: "ros2 launch franka_description visualize_franka.launch.py robot_type:=fr3" },
      real: {
        title: "Real FR3 (franka_hardware + libfranka)",
        cmd: "ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=<fci-ip>",
        then: "ros2 launch franka_bringup example.launch.py controller_names:=move_to_start_example_controller",
        needs: "an FR3 with the Franka Control Interface (FCI) feature, a real-time kernel and libfranka 0.20.5",
        notes: "Set the robot IP in franka_bringup/config/franka.config.yaml for example.launch.py.",
      },
    },
    extraRepos: ["libfranka"],
    ubuntu: { steps: STD_STEPS("franka") },
  },

  kortex: {
    title: "Kinova Gen3 7-DoF - ROS 2 Jazzy",
    robots: ["gen3"],
    env: {},
    repos: [
      { name: "ros2_kortex", packages: "*" },
      { name: "ros2_robotiq_gripper", packages: "*" },
    ],
    gallery: {
      gen3: { pkg: "kortex_description", file: "robots/kinova.urdf.xacro",
        args: ["robot_ip:=xxx.yyy.zzz.www", "name:=gen3", "arm:=gen3", "dof:=7", "vision:=false", "prefix:=", "sim_gazebo:=false", "gripper:="] },
    },
    meshRoots: [
      { pkg: "kortex_description", file: "robots/kinova.urdf.xacro", args: ["robot_ip:=xxx.yyy.zzz.www", "name:=gen3", "arm:=gen3", "dof:=7", "vision:=false", "prefix:=", "sim_gazebo:=true", "gripper:=robotiq_2f_85"] },
    ],
    entry: {
      sim: [{ title: "Gazebo + ros2_control (Gen3 7-DoF)", cmd: "ros2 launch kortex_bringup kortex_sim_control.launch.py use_sim_time:=true launch_rviz:=false" }],
      moveit: [
        { title: "Gazebo + MoveIt 2 (Gen3 + Robotiq 2F-85)", cmd: "ros2 launch kinova_gen3_7dof_robotiq_2f_85_moveit_config sim.launch.py use_sim_time:=true" },
        { title: "MoveIt 2 with fake hardware", cmd: "ros2 launch kinova_gen3_7dof_robotiq_2f_85_moveit_config robot.launch.py robot_ip:=yyy.yyy.yyy.yyy use_fake_hardware:=true" },
      ],
      rviz: { title: "Robot model in RViz", cmd: "ros2 launch kortex_description view_robot.launch.py" },
      fake: { title: "ros2_control with fake hardware", cmd: "ros2 launch kortex_bringup gen3.launch.py robot_ip:=yyy.yyy.yyy.yyy use_fake_hardware:=true" },
      real: {
        title: "Real Gen3 (kortex_driver)",
        cmd: "ros2 launch kortex_bringup gen3.launch.py robot_ip:=192.168.1.10",
        then: "ros2 launch kinova_gen3_7dof_robotiq_2f_85_moveit_config robot.launch.py robot_ip:=192.168.1.10",
        needs: "a Kinova Gen3 arm on the network (the Kortex API is downloaded by kortex_api at build time)",
        notes: "Default IP of the arm is 192.168.1.10.",
      },
    },
    known_issues: ["kortex_description/robots/gen3_robotiq_2f_85.xacro (not used by any launch file) fails in xacro on the jazzy branch: 'Invalid parameter sim' for macro load_robot."],
    ubuntu: { steps: STD_STEPS("kortex") },
  },

  xarm: {
    title: "UFACTORY xArm6 and Lite 6 - ROS 2 Jazzy",
    robots: ["xarm6", "lite6"],
    env: {},
    repos: [{ name: "xarm_ros2", packages: "*" }],
    gallery: {
      xarm6: { pkg: "xarm_description", file: "urdf/xarm_device.urdf.xacro", args: ["dof:=6", "robot_type:=xarm"] },
      lite6: { pkg: "xarm_description", file: "urdf/xarm_device.urdf.xacro", args: ["dof:=6", "robot_type:=lite"] },
    },
    meshRoots: [
      { pkg: "xarm_description", file: "urdf/xarm_device.urdf.xacro", args: ["dof:=6", "robot_type:=xarm", "add_gripper:=true"] },
      { pkg: "xarm_description", file: "urdf/xarm_device.urdf.xacro", args: ["dof:=6", "robot_type:=lite", "add_gripper:=true"] },
      { pkg: "xarm_gazebo", file: "worlds/table_gz.world" },
    ],
    entry: {
      sim: [
        { robot: "xarm6", title: "Gazebo: xArm6 beside a table", cmd: "ros2 launch xarm_gazebo xarm6_beside_table_gazebo.launch.py" },
        { robot: "lite6", title: "Gazebo: Lite 6 beside a table", cmd: "ros2 launch xarm_gazebo lite6_beside_table_gazebo.launch.py" },
      ],
      moveit: [
        { robot: "xarm6", title: "MoveIt 2 (fake controllers)", cmd: "ros2 launch xarm_moveit_config xarm6_moveit_fake.launch.py" },
        { robot: "xarm6", title: "Gazebo + MoveIt 2", cmd: "ros2 launch xarm_moveit_config xarm6_moveit_gazebo.launch.py" },
        { robot: "lite6", title: "MoveIt 2 (fake controllers)", cmd: "ros2 launch xarm_moveit_config lite6_moveit_fake.launch.py" },
        { robot: "lite6", title: "Gazebo + MoveIt 2", cmd: "ros2 launch xarm_moveit_config lite6_moveit_gazebo.launch.py" },
      ],
      rviz: [
        { robot: "xarm6", title: "Robot model in RViz", cmd: "ros2 launch xarm_description xarm6_rviz_display.launch.py" },
        { robot: "lite6", title: "Robot model in RViz", cmd: "ros2 launch xarm_description lite6_rviz_display.launch.py" },
      ],
      real: [
        { robot: "xarm6", title: "Real xArm6 + MoveIt 2", cmd: "ros2 launch xarm_moveit_config xarm6_moveit_realmove.launch.py robot_ip:=192.168.1.117",
          needs: "an xArm6 controller on the network", notes: "Use the controller's IP. Driver only: ros2 launch xarm_api xarm6_driver.launch.py robot_ip:=192.168.1.117" },
        { robot: "lite6", title: "Real Lite 6 + MoveIt 2", cmd: "ros2 launch xarm_moveit_config lite6_moveit_realmove.launch.py robot_ip:=192.168.1.161",
          needs: "a Lite 6 controller on the network", notes: "Use the controller's IP. Driver only: ros2 launch xarm_api lite6_driver.launch.py robot_ip:=192.168.1.161" },
      ],
    },
    ubuntu: { steps: STD_STEPS("xarm", ["cd src/xarm_ros2 && git submodule update --init --remote && cd ../.."]) },
  },

  interbotix: {
    title: "Trossen/Interbotix WidowX 250 s - ROS 2 Jazzy",
    robots: ["wx250s"],
    env: {},
    repos: [
      { name: "interbotix_ros_manipulators", packages: "*" },
      { name: "interbotix_ros_core", packages: "*" },
      { name: "interbotix_ros_toolboxes", packages: "*" },
    ],
    // the official installer (interbotix_ros_xsarms/install/amd64/xsarm_amd64_install.sh) deletes these COLCON_IGNORE files
    unignore: ["interbotix_ros_core/interbotix_ros_xseries", "interbotix_ros_toolboxes/interbotix_common_toolbox/interbotix_moveit_interface",
      "interbotix_ros_toolboxes/interbotix_common_toolbox/interbotix_moveit_interface_msgs"],
    gallery: { wx250s: { pkg: "interbotix_xsarm_descriptions", file: "urdf/wx250s.urdf.xacro", args: [] } },
    meshRoots: [],
    entry: {
      sim: [],
      sim_note: "The jazzy branch only has a Gazebo Classic launch file (interbotix_xsarm_sim xsarm_gz_classic.launch.py); Gazebo Classic does not exist for ROS 2 Jazzy / Ubuntu 24.04, so there is no official Gazebo (Harmonic) simulation.",
      moveit: [{ title: "MoveIt 2 with fake hardware", cmd: "ros2 launch interbotix_xsarm_moveit xsarm_moveit.launch.py robot_model:=wx250s hardware_type:=fake" }],
      rviz: { title: "Robot model in RViz", cmd: "ros2 launch interbotix_xsarm_descriptions xsarm_description.launch.py robot_model:=wx250s use_joint_pub_gui:=true" },
      fake: { title: "Control stack with fake hardware", cmd: "ros2 launch interbotix_xsarm_control xsarm_control.launch.py robot_model:=wx250s hardware_type:=fake" },
      real: {
        title: "Real WidowX 250 s (interbotix_xs_sdk)",
        cmd: "ros2 launch interbotix_xsarm_control xsarm_control.launch.py robot_model:=wx250s",
        then: "ros2 launch interbotix_xsarm_moveit xsarm_moveit.launch.py robot_model:=wx250s hardware_type:=actual",
        needs: "a WidowX 250 s on USB (U2D2) with the udev rules from interbotix_xs_sdk",
        notes: "interbotix_ros_core needs its git submodules (dynamixel_workbench_toolbox, interbotix_xs_driver): vcs import --recursive fetches them.",
      },
    },
    ubuntu: { steps: STD_STEPS("interbotix", [], [
      "rm src/interbotix_ros_core/interbotix_ros_xseries/COLCON_IGNORE src/interbotix_ros_toolboxes/interbotix_common_toolbox/interbotix_moveit_interface/COLCON_IGNORE src/interbotix_ros_toolboxes/interbotix_common_toolbox/interbotix_moveit_interface_msgs/COLCON_IGNORE",
      "sudo cp src/interbotix_ros_core/interbotix_ros_xseries/interbotix_xs_sdk/99-interbotix-udev.rules /etc/udev/rules.d/ && sudo udevadm control --reload-rules && sudo udevadm trigger",
    ]) },
  },

  dobot: {
    title: "Dobot CR5 (DOBOT_6Axis_ROS2_V4) - ROS 2 Jazzy",
    robots: ["cr5"],
    env: { DOBOT_TYPE: "cr5" },
    repos: [{ name: "DOBOT_6Axis_ROS2_V4", packages: "*" }],
    gallery: { cr5: { pkg: "cra_description", file: "urdf/cr5_robot.xacro", args: [] } },
    meshRoots: [{ pkg: "dobot_rviz", file: "urdf/cr5_robot.urdf" }],
    entry: {
      sim: [{ title: "Gazebo simulation", cmd: "ros2 launch dobot_gazebo dobot_gazebo.launch.py" }],
      moveit: [
        { title: "Gazebo + MoveIt 2", cmd: "ros2 launch dobot_gazebo sim.launch.py" },
        { title: "MoveIt 2 virtual simulation (no Gazebo)", cmd: "ros2 launch dobot_moveit moveit_demo.launch.py" },
      ],
      rviz: { title: "Robot model in RViz", cmd: "ros2 launch dobot_rviz dobot_rviz.launch.py" },
      real: {
        title: "Real CR5 (TCP/IP driver) + MoveIt 2",
        cmd: "ros2 launch dobot_bringup_v4 dobot_bringup_ros2.launch.py",
        then: "ros2 launch dobot_moveit dobot_moveit.launch.py",
        env: { IP_address: "192.168.5.1" },
        needs: "a Dobot CR5 (V4 controller firmware) on the same subnet",
        notes: "export DOBOT_TYPE=cr5 and export IP_address=<robot IP> first. Demo: ros2 run dobot_demo demo",
      },
    },
    ubuntu: { steps: STD_STEPS("dobot", ["echo 'export DOBOT_TYPE=cr5' >> ~/.bashrc"]) },
  },

  crazyswarm2: {
    title: "Bitcraze Crazyflie (Crazyswarm2) - ROS 2 Jazzy",
    robots: ["crazyflie"],
    env: {},
    repos: [{ name: "crazyswarm2", packages: "*" }],
    gallery: { crazyflie: { pkg: "crazyflie_description", file: "urdf/crazyflie_description.urdf", args: [] } },
    meshRoots: [],
    entry: {
      sim: [{ title: "Crazyswarm2 software-in-the-loop simulation (crazyflie_sim, RViz)", cmd: "ros2 launch crazyflie launch.py backend:=sim", then: "ros2 run crazyflie_examples hello_world --ros-args -p use_sim_time:=True" }],
      sim_note: "Crazyswarm2's simulator is its own Python node (crazyflie_sim), not Gazebo. Bitcraze's Gazebo Harmonic model (bitcraze/crazyflie-simulation) is not a ROS 2 package and its ROS bridge (knmcguire/ros_gz_crazyflie) is a personal Humble demo, so there is no official ROS 2 Jazzy + Gazebo launch.",
      teleop: { title: "Keyboard velocity control (needs crazyflie launch running)", cmd: "ros2 launch crazyflie_examples keyboard_velmux_launch.py" },
      real: {
        title: "Real Crazyflie (Crazyradio)",
        cmd: "ros2 launch crazyflie launch.py",
        then: "ros2 run crazyflie_examples hello_world",
        needs: "a Crazyflie 2.x and a Crazyradio PA/2.0 (and cflib installed with pip)",
        notes: "Edit crazyflie/config/crazyflies.yaml with the radio URI of each drone.",
      },
    },
    ubuntu: { steps: STD_STEPS("crazyswarm2", ["pip install cflib transforms3d   # see crazyswarm2 docs: installation"]) },
  },

  scout: {
    title: "AgileX Scout - ROS 2 Jazzy",
    robots: ["scout"],
    env: {},
    repos: [{ name: "scout_ros2", packages: "*" }],
    gallery: { scout: { pkg: "scout_description", file: "urdf/scout_v2.xacro", args: [] } },
    meshRoots: [{ pkg: "scout_description", file: "urdf/scout_v2.urdf" }],
    entry: {
      sim: [],
      sim_note: "The official jazzy branch has no Gazebo package.",
      rviz: { title: "Robot model (robot_state_publisher)", cmd: "ros2 launch scout_description scout_base_description.launch.py" },
      real: {
        title: "Real Scout (CAN)",
        cmd: "ros2 launch scout_base scout_base.launch.py",
        then: "ros2 run teleop_twist_keyboard teleop_twist_keyboard",
        needs: "an AgileX Scout connected with a CAN adapter (can0 up at 500k)",
        notes: "Needs ugv_sdk in the workspace (included in scout.repos).",
      },
    },
    extraRepos: ["ugv_sdk"],
    known_issues: ["Upstream bug on the jazzy branch: scout_v2.xacro refers to package://scout_description/meshes/scout_v2/*.dae and scout_v2.urdf to package://robot_description/meshes/scout_v2/*.dae, but the meshes are in scout_description/meshes/ (no scout_v2/ folder). RViz on a real machine shows no meshes either, so the 20 MB of unreferenced meshes are not shipped."],
    ubuntu: { steps: STD_STEPS("scout", ["sudo ip link set can0 up type can bitrate 500000   # on the robot computer"]) },
  },
};

// ---------------------------------------------------------------------------------------------------------------
const EXCLUDE_DIRS = new Set(["doc", "docs", "test", "tests", ".github", ".git", ".gitlab", ".circleci", "images", "image", "img",
  "docker", ".devcontainer", ".vscode", "__pycache__", "build", "install", "log"]);
const ASSET_EXT = new Set([".stl", ".dae", ".obj", ".mtl", ".ply", ".glb", ".gltf", ".3ds", ".fbx", ".png", ".jpg", ".jpeg",
  ".tga", ".bmp", ".gif", ".svg", ".tif", ".tiff", ".ktx", ".hdr", ".pdf", ".mp4", ".webm", ".webp", ".psd", ".blend", ".zip",
  ".tar", ".gz", ".bag", ".db3", ".mcap", ".urcap", ".so", ".a", ".bin", ".exe", ".dll", ".pyc", ".skp", ".step", ".stp", ".igs", ".iges", ".xcf", ".ico"]);
const MAX_TEXT = 1.5 * 1024 * 1024;
const isLicense = (f) => /^(licen[cs]e|copying|notice)(\.[a-z]+)?$/i.test(path.basename(f));

export function ensureClone(name, info) {
  const dir = path.join(CACHE, name);
  if (fs.existsSync(path.join(dir, ".git"))) {
    try { if (git(["-C", dir, "rev-parse", "HEAD"]) === info.commit) return dir; } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  git(["-C", dir, "init", "-q"]);
  git(["-C", dir, "remote", "add", "origin", info.url]);
  git(["-C", dir, "fetch", "-q", "--depth", "1", "origin", info.commit]);
  git(["-C", dir, "checkout", "-q", "FETCH_HEAD"]);
  return dir;
}

function findPackageDirs(repoDir, unignore = new Set()) {
  const out = [];
  (function rec(d) {
    const ign = fs.existsSync(path.join(d, "COLCON_IGNORE")) || fs.existsSync(path.join(d, "AMENT_IGNORE"));
    if (ign && !unignore.has(path.join(path.basename(repoDir), path.relative(repoDir, d)))) return;
    if (fs.existsSync(path.join(d, "package.xml"))) { out.push(d); return; }
    for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory() && !EXCLUDE_DIRS.has(e.name) && !e.name.startsWith(".")) rec(path.join(d, e.name));
  })(repoDir);
  return out;
}

function isText(buf) {
  if (buf.includes(0)) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(buf); return true; } catch { return false; }
}

/** Isolated colcon-style prefix: <tmp>/install/<pkg>/share/<pkg> -> package source dir. */
export function makePrefix(tmp, pkgDirs) {
  const prefixes = [];
  for (const d of pkgDirs) {
    const name = parsePackageXml(fs.readFileSync(path.join(d, "package.xml"), "utf8")).name;
    const pfx = path.join(tmp, "install", name);
    fs.mkdirSync(path.join(pfx, "share/ament_index/resource_index/packages"), { recursive: true });
    fs.writeFileSync(path.join(pfx, "share/ament_index/resource_index/packages", name), "");
    const link = path.join(pfx, "share", name);
    if (!fs.existsSync(link)) fs.symlinkSync(path.resolve(d), link);
    prefixes.push(pfx);
  }
  return prefixes;
}

export function runXacro(file, xargs, ampp, env = {}) {
  const py = "import sys,xacro; sys.argv=['xacro']+sys.argv[1:]; xacro.main()";
  try {
    const out = execFileSync("python3", ["-c", py, file, ...xargs], {
      encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env, PYTHONPATH: R2L_PYTHONPATH, AMENT_PREFIX_PATH: ampp },
    });
    return { urdf: out };
  } catch (e) { return { error: String(e.stderr || e.message) }; }
}

const URI_RE = /(package|model|file):\/\/([^"'<>\s]+)/g;

async function buildWorkspace(wsid, cfg) {
  console.log(`\n=== ${wsid}`);
  const wsOut = path.join(OUT, wsid);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `r2lws-${wsid}-`));
  // 1. clones + packages
  const repoInfos = [];
  const pkgs = []; // {name, repo, dir (abs src), rel (ws-relative dest), scan}
  for (const r of cfg.repos) {
    const info = R[r.name];
    const dir = ensureClone(r.name, info);
    repoInfos.push({ name: r.name, dir, ...info });
    const dirs = r.packages === "*" ? findPackageDirs(dir, new Set(cfg.unignore || [])) : r.packages.map((p) => path.join(dir, p));
    for (const d of dirs) {
      const name = parsePackageXml(fs.readFileSync(path.join(d, "package.xml"), "utf8")).name;
      pkgs.push({ name, repo: r.name, dir: d, rel: path.join("src", r.name, path.relative(dir, d)).replace(/\/$/, "") });
    }
  }
  const byName = Object.fromEntries(pkgs.map((p) => [p.name, p]));
  const ampp = makePrefix(tmp, pkgs.map((p) => p.dir)).join(":");
  // 2. reference discovery
  const wanted = new Set(); // absolute source paths of asset files to ship
  const missing = new Set();
  const modelDirs = {}; // model name -> abs dir (any "models/<name>/model.config" in the workspace packages)
  for (const p of pkgs) for (const f of walk(p.dir)) if (path.basename(f) === "model.config") modelDirs[path.basename(path.dirname(f))] = path.join(p.dir, path.dirname(f));
  const pkgOfPrefix = (abs) => { const m = abs.match(/\/install\/([^/]+)\/share\/\1\/(.*)$/); return m ? path.join(byName[m[1]].dir, m[2]) : null; };
  const resolveUri = (scheme, rest, baseDir) => {
    if (scheme === "package") { const [pk, ...r] = rest.split("/"); return byName[pk] ? path.join(byName[pk].dir, r.join("/")) : null; }
    if (scheme === "model") { const [m, ...r] = rest.split("/"); return modelDirs[m] ? path.join(modelDirs[m], r.join("/")) : null; }
    if (scheme === "file") { const abs = "/" + rest.replace(/^\/+/, ""); if (abs.startsWith(tmp)) return pkgOfPrefix(abs); return null; }
    return null;
  };
  const seen = new Set();
  const follow = (absFile, depth = 0) => {
    if (!absFile || seen.has(absFile) || depth > 6) return; seen.add(absFile);
    if (!fs.existsSync(absFile)) { missing.add(absFile); return; }
    const ext = path.extname(absFile).toLowerCase();
    if (ASSET_EXT.has(ext)) wanted.add(absFile);
    if (fs.statSync(absFile).size > 40e6) return;
    const text = [".dae", ".obj", ".mtl", ".sdf", ".world", ".urdf", ".xacro", ".config", ".gltf"].includes(ext) ? fs.readFileSync(absFile, "utf8") : null;
    if (!text) return;
    if (ext === ".dae") { for (const m of text.matchAll(/<init_from>\s*([^<\s]+)\s*<\/init_from>/g)) if (/\.(png|jpe?g|tga|bmp|gif|tiff?)$/i.test(m[1])) follow(path.resolve(path.dirname(absFile), decodeURI(m[1]).replace(/^file:\/\//, "")), depth + 1); return; }
    if (ext === ".obj") { for (const m of text.matchAll(/^mtllib\s+(.+)$/gm)) follow(path.resolve(path.dirname(absFile), m[1].trim()), depth + 1); return; }
    if (ext === ".mtl") { for (const m of text.matchAll(/^\s*map_\w+\s+(?:-\S+\s+\S+\s+)*(\S+)\s*$/gm)) follow(path.resolve(path.dirname(absFile), m[1]), depth + 1); return; }
    if (ext === ".gltf") { for (const m of text.matchAll(/"uri"\s*:\s*"([^"]+)"/g)) if (!m[1].startsWith("data:")) follow(path.resolve(path.dirname(absFile), m[1]), depth + 1); return; }
    if (ext === ".config") return;
    for (const m of text.matchAll(URI_RE)) {
      const t = resolveUri(m[1], m[2], path.dirname(absFile));
      if (t === null) continue;
      if (m[1] === "model" && !m[2].includes("/")) { follow(path.join(t, "model.sdf"), depth + 1); continue; }
      follow(t, depth + 1);
    }
    if (ext === ".sdf" || ext === ".world") {
      for (const m of text.matchAll(/<uri>\s*([^<\s]+)\s*<\/uri>/g)) {
        if (/^(package|model|file|https?):/.test(m[1])) continue;
        follow(path.resolve(path.dirname(absFile), m[1]), depth + 1);
      }
    }
  };
  const gallery = {};
  const runs = [...Object.entries(cfg.gallery).map(([robot, g]) => ({ robot, ...g })), ...(cfg.meshRoots || [])];
  for (const g of runs) {
    const p = byName[g.pkg]; if (!p) throw new Error(`${wsid}: package ${g.pkg} not in workspace`);
    const abs = path.join(p.dir, g.file);
    const isXacroRun = g.args !== undefined || /\.xacro$/.test(g.file);
    if (isXacroRun) {
      const env = Object.assign({}, cfg.env && !cfg.env[g.robot] ? cfg.env : {}, (cfg.env || {})[g.robot] || {});
      const r = runXacro(abs, g.args || [], ampp, env);
      if (r.error) { console.log(`  xacro FAILED ${g.pkg}/${g.file} ${(g.args || []).join(" ")}\n${r.error.slice(-600)}`); if (g.robot) gallery[g.robot] = { ...g, error: r.error.slice(-600) }; continue; }
      const f = path.join(tmp, `gen-${Math.random().toString(36).slice(2)}.urdf`);
      fs.writeFileSync(f, r.urdf);
      // references inside the generated URDF
      for (const m of r.urdf.matchAll(URI_RE)) { const t = resolveUri(m[1], m[2]); if (t) follow(t); else if (m[1] !== "file") missing.add(m[0]); }
      if (g.robot) gallery[g.robot] = { package: g.pkg, file: g.file, args: g.args || [] };
    } else follow(abs);
  }
  for (const m of missing) console.log("  MISSING reference:", m.replace(CACHE + "/", ""));

  // 3. copy
  fs.rmSync(path.join(wsOut, "src"), { recursive: true, force: true });
  fs.mkdirSync(wsOut, { recursive: true });
  const files = [], text = [], alias = {}, hashToRel = {};
  let bytes = 0, assetBytes = 0;
  const skipped = { big: [], assets: 0 };
  const copy = (absSrc, rel) => {
    const buf = fs.readFileSync(absSrc);
    const isAsset = ASSET_EXT.has(path.extname(absSrc).toLowerCase());
    if (isAsset && buf.length > 64 * 1024) {
      const h = sha1(buf);
      if (hashToRel[h]) { alias[rel] = hashToRel[h]; return; }
      hashToRel[h] = rel;
    }
    const dst = path.join(wsOut, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, buf);
    if (fs.statSync(absSrc).mode & 0o111) fs.chmodSync(dst, 0o755);
    files.push(rel); if (isText(buf)) text.push(rel);
    bytes += buf.length; if (isAsset) assetBytes += buf.length;
  };
  // repo-level LICENSE / NOTICE / README
  for (const ri of repoInfos) {
    for (const f of fs.readdirSync(ri.dir)) {
      const abs = path.join(ri.dir, f);
      if (fs.statSync(abs).isFile() && (isLicense(f) || /^readme(\.md|\.rst)?$/i.test(f))) copy(abs, path.join("src", ri.name, f));
    }
  }
  const packages = [];
  for (const p of pkgs) {
    for (const f of walk(p.dir)) {
      const parts = f.split("/");
      if (parts.slice(0, -1).some((s) => EXCLUDE_DIRS.has(s))) continue;
      const abs = path.join(p.dir, f);
      const rel = path.join(p.rel, f);
      if (isLicense(f)) { copy(abs, rel); continue; }
      if (/^(COLCON|AMENT)_IGNORE$/.test(path.basename(f)) && (cfg.unignore || []).includes(path.join(p.repo, path.relative(repoInfos.find((x) => x.name === p.repo).dir, path.join(p.dir, path.dirname(f)))))) continue;
      const ext = path.extname(f).toLowerCase();
      if (ASSET_EXT.has(ext)) { if (wanted.has(abs)) copy(abs, rel); else skipped.assets++; continue; }
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) continue;
      if (st.size > MAX_TEXT) { skipped.big.push(rel); continue; }
      const buf = fs.readFileSync(abs);
      // occupancy-grid maps (map.yaml + map.pgm) are data the launch files load: always ship them
      if (!isText(buf) && !(/\.(pgm|ppm)$/i.test(f) && st.size < 4e6)) { skipped.big.push(rel + " (binary)"); continue; }
      copy(abs, rel);
    }
    const scan = scanPackage(p.dir);
    const entry = { name: p.name, path: p.rel, build_type: scan.build_type, version: scan.version, exes: scan.exes };
    if (Object.keys(scan.py).length) entry.py = Object.fromEntries(Object.entries(scan.py).map(([m, d]) => [m, path.join(p.rel, d)]));
    const deps = [...new Set([...(scan.deps.depend || []), ...(scan.deps.exec_depend || []), ...(scan.deps.build_depend || []), ...(scan.deps.buildtool_depend || []), ...(scan.deps.build_export_depend || [])])].sort();
    entry.deps = deps;
    packages.push(entry);
  }
  // 4. repos file
  const reposYaml = ["repositories:"];
  for (const ri of repoInfos) reposYaml.push(`  ${ri.name}:`, "    type: git", `    url: ${ri.url}`, `    version: ${ri.commit}   # ${ri.branch}`);
  for (const x of cfg.extraRepos || []) { const e = EXTRA_REPOS[x]; reposYaml.push(`  ${x}:`, "    type: git", `    url: ${e.url}`, `    version: ${e.version}   # ${e.why}`); }
  fs.writeFileSync(path.join(wsOut, `${wsid}.repos`), reposYaml.join("\n") + "\n");
  // 5. workspace.json
  for (const k of Object.keys(gallery)) {
    const g = gallery[k]; if (g.error) continue;
    const pk = byName[g.package];
    g.cmd = `xacro ${path.join("$(ros2 pkg prefix " + g.package + ")", "share", g.package, g.file)}${g.args.length ? " " + g.args.join(" ") : ""}`;
    g.src = path.join(pk.rel, g.file);
    g.urdf = `generated/${k}.urdf`;
  }
  const ws = {
    id: wsid, title: cfg.title, distro: "jazzy", robots: cfg.robots, env: cfg.env || {},
    repos: repoInfos.map((ri) => ({ name: ri.name, url: ri.url.replace(/\.git$/, ""), branch: ri.branch, commit: ri.commit, license: ri.license, path: `src/${ri.name}` })),
    extra_repos: (cfg.extraRepos || []).map((x) => ({ name: x, url: EXTRA_REPOS[x].url.replace(/\.git$/, ""), version: EXTRA_REPOS[x].version, why: EXTRA_REPOS[x].why, shipped: false })),
    packages: packages.sort((a, b) => a.name.localeCompare(b.name)),
    gallery,
    entry: cfg.entry,
    ...(cfg.known_issues ? { known_issues: cfg.known_issues } : {}),
    ubuntu: { repos_file: `${wsid}.repos`, steps: cfg.ubuntu.steps },
    honesty: "The site runs these real launch files, YAML, URDF/xacro and SDF files in the browser and models the programs they start (gz sim, controller_manager, move_group, Nav2 servers ...) in JavaScript. It cannot run the compiled C++ nodes. On a real Ubuntu 24.04 + ROS 2 Jazzy machine the same workspace builds and runs with the steps below.",
    pruned: "Only the mesh/texture files used by the robots and worlds listed in 'gallery' and the entries are shipped (vcs import gets the complete repositories).",
    alias,
    files: files.sort(),
    text: text.sort(),
    stats: { files: files.length, bytes, asset_bytes: assetBytes, aliased: Object.keys(alias).length, unused_assets_not_shipped: skipped.assets, skipped_large_or_binary: skipped.big },
    generated: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(path.join(wsOut, "workspace.json"), JSON.stringify(ws, null, 1) + "\n");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`  ${packages.length} packages, ${files.length} files, ${(bytes / 1e6).toFixed(2)} MB (meshes ${(assetBytes / 1e6).toFixed(2)} MB), ${Object.keys(alias).length} aliases, ${skipped.assets} unused assets skipped`);
  if (skipped.big.length) console.log("  skipped (large/binary):", skipped.big.slice(0, 20).join(", "));
  return ws;
}

async function main() {
  if (args.includes("--latest")) {
    for (const [name, info] of Object.entries(R)) {
      const head = git(["ls-remote", info.url, `refs/heads/${info.branch}`]).split(/\s/)[0];
      console.log(`${name.padEnd(36)} ${info.branch.padEnd(14)} pinned ${info.commit.slice(0, 10)} head ${head.slice(0, 10)}${head === info.commit ? "" : "  (newer)"}`);
    }
    return;
  }
  fs.mkdirSync(CACHE, { recursive: true });
  const only = args.filter((a) => !a.startsWith("--") && !Object.values({ c: opt("--cache") }).includes(a));
  const ids = only.length ? only : Object.keys(WORKSPACES);
  const summary = [];
  for (const id of ids) {
    const ws = await buildWorkspace(id, WORKSPACES[id]);
    summary.push({ id, bytes: ws.stats.bytes, files: ws.stats.files });
  }
  // index of workspaces (for the coordinator / gallery)
  const index = {};
  for (const id of Object.keys(WORKSPACES)) {
    const f = path.join(OUT, id, "workspace.json");
    if (!fs.existsSync(f)) continue;
    const ws = JSON.parse(fs.readFileSync(f, "utf8"));
    index[id] = { title: ws.title, robots: ws.robots, bytes: ws.stats.bytes, files: ws.stats.files };
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ distro: "jazzy", workspaces: index }, null, 1) + "\n");
  const total = Object.values(index).reduce((s, w) => s + w.bytes, 0);
  console.log(`\nTOTAL ${(total / 1e6).toFixed(2)} MB in ${Object.keys(index).length} workspaces`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
