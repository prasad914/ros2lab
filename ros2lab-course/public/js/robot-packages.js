// The rest of a robot's ROS 2 workspace, next to <robot>_description (and <robot>_moveit_config for arms), laid out like the
// makers' own repositories (ur_robot_driver / turtlebot3 / kortex: description, gazebo, bringup, moveit_config):
//   <id>_gazebo    the simulation: launch/gazebo.launch.py starts Gazebo with the robot, its sensors, ros_gz_bridge and its
//                  controllers (it includes the description's sim_control / sim launch, or the MoveIt config's gazebo launch)
//   <id>_bringup   the purchased robot: launch/real.launch.py starts the maker's driver (+ MoveIt / RViz), launch/sim.launch.py
//                  the same robot in Gazebo; config/hardware.yaml (connection and data-sheet values), udev rules, the driver
//                  install script, and the course's hardware-license rule (real hardware needs the administrator's license)
import { realFor } from "./real-robot.js";

// Data-sheet values (makers' published specifications; check your own robot's manual before relying on a number)
export const SPECS = {
  ur5e: { maker: "Universal Robots", dof: 6, payload_kg: 5.0, reach_m: 0.85, weight_kg: 20.6, repeatability_mm: 0.03, max_tcp_speed_mps: 1.0, joint_speed_dps: 180, controller: "CB / e-Series control box", ip_rating: "IP54" },
  fr3: { maker: "Franka Robotics", dof: 7, payload_kg: 3.0, reach_m: 0.855, weight_kg: 17.8, repeatability_mm: 0.1, max_tcp_speed_mps: 2.0, control_rate_hz: 1000, controller: "FR3 Control (FCI over Ethernet, PREEMPT_RT kernel)" },
  gen3: { maker: "Kinova", dof: 7, payload_kg: 4.0, reach_m: 0.902, weight_kg: 8.2, repeatability_mm: 0.1, max_tcp_speed_mps: 0.5, controller: "integrated (base controller), Kortex API over Ethernet" },
  xarm6: { maker: "UFACTORY", dof: 6, payload_kg: 5.0, reach_m: 0.7, weight_kg: 12.2, repeatability_mm: 0.1, max_tcp_speed_mps: 1.0, controller: "xArm control box (Ethernet)" },
  lite6: { maker: "UFACTORY", dof: 6, payload_kg: 0.6, reach_m: 0.44, weight_kg: 7.2, repeatability_mm: 0.5, max_tcp_speed_mps: 0.5, controller: "Lite 6 control box (Ethernet)" },
  cr5: { maker: "Dobot", dof: 6, payload_kg: 5.0, reach_m: 0.9, weight_kg: 25.0, repeatability_mm: 0.02, max_tcp_speed_mps: 3.0, controller: "CC162 control cabinet (TCP/IP)" },
  magician: { maker: "Dobot", dof: 4, payload_kg: 0.5, reach_m: 0.32, weight_kg: 3.4, repeatability_mm: 0.2, controller: "built-in, USB serial" },
  so101: { maker: "The Robot Studio / Hugging Face LeRobot", dof: 6, payload_kg: 0.2, reach_m: 0.3, servos: "6 x Feetech STS3215 (bus servos, 1 Mbps)", controller: "Waveshare / Feetech bus-servo board on USB" },
  wx250s: { maker: "Trossen Robotics", dof: 6, payload_kg: 0.25, reach_m: 0.65, weight_kg: 2.4, servos: "DYNAMIXEL XM430 / XL430", controller: "U2D2 (USB) + power hub" },
  irb120: { maker: "ABB", dof: 6, payload_kg: 3.0, reach_m: 0.58, weight_kg: 25.0, repeatability_mm: 0.01, controller: "IRC5 Compact (RWS + EGM options)" },
  kr6: { maker: "KUKA", dof: 6, payload_kg: 6.0, reach_m: 0.901, weight_kg: 52.0, repeatability_mm: 0.03, controller: "KR C4 compact (RSI option)" },
  lrmate: { maker: "FANUC", dof: 6, payload_kg: 7.0, reach_m: 0.717, weight_kg: 25.0, repeatability_mm: 0.01, controller: "R-30iB Mate Plus (J519 Stream Motion, R912 Remote Motion)" },
  tb3_burger: { maker: "ROBOTIS", drive: "differential", max_linear_mps: 0.22, max_angular_rps: 2.84, weight_kg: 1.0, payload_kg: 15, sensors: "360° LiDAR (LDS-01/02), IMU (OpenCR)", computer: "Raspberry Pi 4 + OpenCR 1.0", battery: "LiPo 11.1 V 1800 mAh", motors: "2 x DYNAMIXEL XL430-W250" },
  tb3_waffle: { maker: "ROBOTIS", drive: "differential", max_linear_mps: 0.26, max_angular_rps: 1.82, weight_kg: 1.8, payload_kg: 30, sensors: "360° LiDAR (LDS-01/02), camera, IMU (OpenCR)", computer: "Raspberry Pi 4 + OpenCR 1.0", battery: "LiPo 11.1 V 1800 mAh", motors: "2 x DYNAMIXEL XM430-W210" },
  scout: { maker: "AgileX", drive: "4-wheel skid steer", max_linear_mps: 1.5, weight_kg: 62, payload_kg: 50, battery: "24 V 30 Ah", bus: "CAN 500 kbit/s" },
  go2: { maker: "Unitree", drive: "quadruped (12 DOF)", weight_kg: 15, sensors: "4D LiDAR L1, camera, IMU", link: "Ethernet 192.168.123.0/24 (robot 192.168.123.161)", middleware: "CycloneDDS (rmw_cyclonedds_cpp)" },
  g1: { maker: "Unitree", drive: "humanoid (23 to 43 DOF; 29 DOF EDU)", weight_kg: 35, height_m: 1.32, sensors: "MID-360 LiDAR, depth camera, IMU", link: "Ethernet 192.168.123.0/24", middleware: "CycloneDDS (rmw_cyclonedds_cpp)" },
  h1: { maker: "Unitree", drive: "humanoid", weight_kg: 47, height_m: 1.8, sensors: "MID-360 LiDAR, depth camera, IMU", link: "Ethernet 192.168.123.0/24", middleware: "CycloneDDS (rmw_cyclonedds_cpp)" },
  spot: { maker: "Boston Dynamics", drive: "quadruped", weight_kg: 32.7, payload_kg: 14, max_linear_mps: 1.6, runtime_min: 90, link: "Wi-Fi access point or Ethernet (Spot SDK)" },
  crazyflie: { maker: "Bitcraze", drive: "quadrotor", weight_kg: 0.027, payload_kg: 0.015, flight_time_min: 7, link: "Crazyradio PA (2.4 GHz, USB)" },
};
// udev rules for the robots that plug into USB (from the makers' setup guides)
const UDEV = {
  tb3: `# OpenCR (TurtleBot3) and the LDS lidar: from turtlebot3_bringup create_udev_rules
ATTRS{idVendor}=="0483", ATTRS{idProduct}=="5740", ENV{ID_MM_DEVICE_IGNORE}="1", MODE:="0666"
ATTRS{idVendor}=="fff1", ATTRS{idProduct}=="ff48", ENV{ID_MM_DEVICE_IGNORE}="1", MODE:="0666"
ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", ENV{ID_MM_DEVICE_IGNORE}="1", MODE:="0666"
`,
  crazyflie: `# Crazyradio PA and Crazyflie over USB (Bitcraze)
SUBSYSTEM=="usb", ATTRS{idVendor}=="1915", ATTRS{idProduct}=="7777", MODE="0664", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="5740", MODE="0664", GROUP="plugdev"
`,
  wx250s: `# U2D2 (DYNAMIXEL) for Interbotix arms: /dev/ttyDXL, low latency
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6014", ENV{ID_MM_DEVICE_IGNORE}="1", ATTR{device/latency_timer}="1", SYMLINK+="ttyDXL"
`,
  so101: `# Feetech / Waveshare bus-servo board (CH343) for the SO-101: /dev/ttySO101
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="55d3", MODE="0666", GROUP="dialout", SYMLINK+="ttySO101"
`,
  magician: `# Dobot Magician (CP210x USB serial): /dev/ttyDobot
SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", MODE="0666", GROUP="dialout", SYMLINK+="ttyDobot"
`,
};
const udevFor = (id) => (/^tb3_/.test(id) ? UDEV.tb3 : UDEV[id] || null);

// "ros2 launch PKG FILE a:=b c:=d" -> { pkg, file, args }
function parseLaunch(cmd) {
  const m = String(cmd || "").match(/ros2 launch\s+([\w-]+)\s+([\w.-]+\.launch\.(?:py|xml))((?:\s+[\w-]+:=\S+)*)/);
  if (!m) return null;
  const args = {}; for (const a of m[3].trim().split(/\s+/).filter(Boolean)) { const [k, v] = a.split(":="); args[k] = v; }
  return { pkg: m[1], file: m[2], args };
}
const yamlVal = (v) => (typeof v === "number" ? String(v) : /^[\w./-]+$/.test(String(v)) ? String(v) : JSON.stringify(String(v)));
const pkgXml = (name, desc, deps) => `<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>${name}</name>
  <version>1.0.0</version>
  <description>${desc}</description>
  <maintainer email="student@ros2lab.com">ROS2Lab</maintainer>
  <license>Apache-2.0</license>

  <buildtool_depend>ament_cmake</buildtool_depend>

${deps.map((d) => `  <exec_depend>${d}</exec_depend>`).join("\n")}

  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
`;
const cmake = (name, dirs, programs = []) => `cmake_minimum_required(VERSION 3.10)
project(${name})

find_package(ament_cmake REQUIRED)

install(DIRECTORY ${dirs.join(" ")}
  DESTINATION share/\${PROJECT_NAME})
${programs.length ? `install(PROGRAMS ${programs.join(" ")}
  DESTINATION lib/\${PROJECT_NAME})
` : ""}
ament_package()
`;
const includeLaunch = (pkg, file, args = {}, extraDecl = "") => `import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription${extraDecl ? ", DeclareLaunchArgument" : ""}
from launch.launch_description_sources import PythonLaunchDescriptionSource


def generate_launch_description():
    return LaunchDescription([${extraDecl}
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(get_package_share_directory('${pkg}'), 'launch', '${file}'))${Object.keys(args).length ? `,
            launch_arguments={${Object.entries(args).map(([k, v]) => `'${k}': '${v}'`).join(", ")}}.items()` : ""}),
    ])
`;

// ---------------- <id>_gazebo ----------------
export function gazeboPackage(g, descPkg, { sim, moveitPkg }) {
  const name = `${g.id}_gazebo`;
  const target = moveitPkg ? { pkg: moveitPkg, file: "gazebo.launch.py", what: "Gazebo + gz_ros2_control + MoveIt 2 (move_group, RViz MotionPlanning) and the work cell" }
    : sim && sim.control ? { pkg: descPkg, file: "sim_control.launch.py", what: `Gazebo + gz_ros2_control (${sim.control.controller || "controllers"}), sensors through ros_gz_bridge, RViz` }
      : sim ? { pkg: descPkg, file: "sim.launch.py", what: "Gazebo with the robot's Gazebo systems and sensors, ros_gz_bridge, RViz" } : null;
  if (!target) return null;
  const files = {
    "package.xml": pkgXml(name, `${g.title}: Gazebo (Harmonic) simulation bringup: ${target.what}`, [descPkg, ...(moveitPkg ? [moveitPkg] : []), "ros_gz_sim", "ros_gz_bridge", "gz_ros2_control", "controller_manager", "robot_state_publisher", "rviz2"]),
    "CMakeLists.txt": cmake(name, ["launch"]),
    "launch/gazebo.launch.py": `# ${g.title} in Gazebo: ${target.what}.
# ros2 launch ${name} gazebo.launch.py
# It starts ${target.pkg}/launch/${target.file}: the same nodes, controllers and topics as the real robot's bringup.
` + includeLaunch(target.pkg, target.file),
    "README.md": `# ${name}

\`ros2 launch ${name} gazebo.launch.py\` starts ${g.title} in Gazebo Harmonic: ${target.what}.

| Package | What it has |
|---|---|
| \`${descPkg}\` | URDF / xacro, meshes, the Gazebo world, ros_gz_bridge and controller configs, RViz configs |
| \`${name}\` | this simulation bringup |
${moveitPkg ? `| \`${moveitPkg}\` | MoveIt 2 (OMPL, Pilz, CHOMP, STOMP), Servo, pose goals |\n` : ""}| \`${g.id}_bringup\` | the real robot (driver, hardware config, udev rules); needs a hardware license |
`,
  };
  return { name, files, launches: ["gazebo.launch.py"] };
}

// ---------------- <id>_bringup ----------------
export function bringupPackage(g, descPkg, { moveitPkg, moveitReal, sim }) {
  const name = `${g.id}_bringup`;
  const mob = realFor(g), arm = moveitReal || null;
  if (!mob && !arm) return null;
  const spec = SPECS[g.id] || {};
  const driver = mob ? (mob.include ? { pkg: mob.include.pkg, file: mob.include.file, args: mob.include.args } : null) : parseLaunch(arm.launch);
  const ownMoveit = driver && moveitPkg && driver.pkg === moveitPkg;   // e.g. SO-101: the MoveIt config's real.launch.py is the driver (feetech ros2_control)
  const conn = mob ? mob.connection : arm.connection, install = mob ? mob.install : arm.install, drvName = mob ? mob.driver : arm.driver;
  const udev = udevFor(g.id);
  const hw = {
    robot: g.id, title: g.title, ...spec,
    driver: drvName, install, connection: conn,
    ...(arm && arm.ip ? { robot_ip: arm.ip } : {}), ...(arm && arm.port ? { usb_port: arm.port } : {}),
    ...(arm && arm.controller ? { trajectory_controller: arm.controller } : {}), ...(arm && arm.plugin ? { ros2_control_plugin: arm.plugin } : {}),
    ...(mob && mob.topics ? { topics: mob.topics } : {}), ...(mob && mob.teleop ? { teleop: mob.teleop } : {}),
  };
  const hwYaml = `# ${g.title}: the real robot (from the maker's data sheet and driver documentation; check your robot's manual)
# Used by launch/real.launch.py and as a reference. Connecting needs a hardware license from your course administrator.
${name}:
  ros__parameters:
${Object.entries(hw).map(([k, v]) => `    ${k}: ${yamlVal(v)}`).join("\n")}
`;
  const drvArgs = driver ? Object.entries(driver.args || {}) : [];
  const realPy = `# ros2lab-robot: ${g.id}
# The REAL ${g.title}.  Needs a hardware license from your course administrator (ROS2Lab rule; simulation does not).
# Driver: ${drvName}
# Install once: scripts/install_driver.sh   (${install})
# Connection: ${conn}
#   ros2 launch ${name} real.launch.py${drvArgs.length ? " " + drvArgs.map(([k, v]) => `${k}:=${v}`).join(" ") : ""}${moveitPkg && !ownMoveit ? " use_moveit:=true" : ""}
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, SetEnvironmentVariable
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    args = [
${drvArgs.map(([k, v]) => `        DeclareLaunchArgument('${k}', default_value='${v}'),`).join("\n")}
${moveitPkg && !ownMoveit ? "        DeclareLaunchArgument('use_moveit', default_value='false', description='Also start MoveIt 2 (move_group + RViz) for the real arm'),\n" : ""}    ]
    actions = []
${mob && mob.include && mob.include.env ? Object.entries(mob.include.env(g)).map(([k, v]) => `    actions.append(SetEnvironmentVariable('${k}', os.environ.get('${k}', '${v}')))\n`).join("") : ""}${driver ? `    # the maker's driver (fails with "package '${driver.pkg}' not found" until it is installed: scripts/install_driver.sh)
    actions.append(IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(get_package_share_directory('${driver.pkg}'), 'launch', '${driver.file}')),
        launch_arguments={${drvArgs.map(([k]) => `'${k}': LaunchConfiguration('${k}')`).join(", ")}}.items()))
` : `    # this robot has no driver launch file: it publishes its own topics once the network is set up (see config/hardware.yaml)
    actions.append(IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(get_package_share_directory('${descPkg}'), 'launch', 'real.launch.py'))))
`}${moveitPkg && !ownMoveit ? `    # MoveIt 2 for the real arm: move_group + RViz, executing through the driver's ${arm && arm.controller ? arm.controller : "trajectory controller"}
    actions.append(IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(get_package_share_directory('${moveitPkg}'), 'launch', 'real.launch.py')),
        condition=IfCondition(LaunchConfiguration('use_moveit'))))
` : ""}    return LaunchDescription(args + actions)
`;
  const simTarget = moveitPkg ? [moveitPkg, "gazebo.launch.py"] : sim && sim.control ? [descPkg, "sim_control.launch.py"] : sim ? [descPkg, "sim.launch.py"] : null;
  const files = {
    "package.xml": pkgXml(name, `${g.title}: bringup for the real robot (${drvName}) and for its simulation`, [descPkg, ...(moveitPkg ? [moveitPkg] : []), ...(driver && driver.pkg !== moveitPkg ? [driver.pkg] : []), "robot_state_publisher", "rviz2"]),
    "CMakeLists.txt": cmake(name, ["launch", "config", ...(udev ? ["udev"] : [])], ["scripts/install_driver.sh"]),
    "launch/real.launch.py": realPy,
    ...(simTarget ? { "launch/sim.launch.py": `# ${g.title} in simulation, with the same topics and controllers as real.launch.py: no license needed.\n` + includeLaunch(simTarget[0], simTarget[1]) } : {}),
    "config/hardware.yaml": hwYaml,
    ...(udev ? { [`udev/99-${g.id.replace(/_/g, "-")}.rules`]: udev } : {}),
    "scripts/install_driver.sh": `#!/usr/bin/env bash
# Install the driver for the real ${g.title} on Ubuntu 24.04 + ROS 2 Jazzy (run from your workspace folder).
set -e
${install.replace(/ && /g, "\n")}
${udev ? `sudo cp "$(ros2 pkg prefix ${name})/share/${name}/udev/99-${g.id.replace(/_/g, "-")}.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
` : ""}${/USB|serial|tty/i.test(conn) ? "sudo usermod -aG dialout $USER   # log out and in once\n" : ""}echo "Driver installed. Ask your course administrator for the ROS2Lab hardware license before connecting the robot."
`,
    "HARDWARE_LICENSE.md": `# Hardware license

ROS2Lab lets you connect a real robot only with a **hardware license from your course administrator**.
Ask for it on the RViz page (Connect to ROS 2 on your Ubuntu computer → Ask for a hardware license): name the
robot (${g.id}) and what you will do with it. Until it is approved, \`ros2 launch ${name} real.launch.py\` and
the rosbridge connection stay locked. Simulation (\`ros2 launch ${name} sim.launch.py\`) never needs a license.
`,
    "README.md": `# ${name}: the real ${g.title}

| | |
|---|---|
| Driver | ${drvName} |
| Install | \`ros2 run ${name} install_driver.sh\` (or: \`${install}\`) |
| Connection | ${conn} |
| Real robot | \`ros2 launch ${name} real.launch.py\`${moveitPkg && !ownMoveit ? " (add \`use_moveit:=true\` for MoveIt 2)" : ""} |
| Simulation | ${simTarget ? `\`ros2 launch ${name} sim.launch.py\`` : "-"} |
| Specifications | \`config/hardware.yaml\` |
${udev ? `| USB rules | \`udev/99-${g.id.replace(/_/g, "-")}.rules\` |\n` : ""}
**A hardware license from your course administrator is required before connecting the real robot** (see
HARDWARE_LICENSE.md). Start slowly, keep the emergency stop in reach, and test new code in simulation first.
`,
  };
  return { name, files, launches: ["real.launch.py", ...(simTarget ? ["sim.launch.py"] : [])], driver };
}
