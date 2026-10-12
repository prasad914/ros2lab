// <id>_bringup for the course robots (arm3, arm6, chiku, mecanum, ackermann, quadruped, hexapod, humanoid, mobile and
// legged manipulators): the robot built by the student, with an ESP32 or Arduino Mega running the ROS2Lab bridge firmware
// and a Jetson running ros2_control with the ros2lab_hardware/BridgeSystem plugin (hardware/src/ros2lab_hardware).
// The hardware files come from robot-hw.js, the browser twin of `ros2 run ros2lab_hardware ros2lab_robot_setup`.
//   ros2 launch <id>_bringup bringup.launch.py hardware_type:=mock   fake hardware (mock_components), no license
//   ros2 launch <id>_bringup bringup.launch.py hardware_type:=gz     Gazebo Harmonic
//   ros2 launch <id>_bringup bringup.launch.py hardware_type:=real   the board over USB or Wi-Fi (hardware license)
import { robotSetup, COURSE_KIND, PINS } from "./robot-hw.js";
import { bringupSelector } from "./robot-packages.js";
import { sourcesFor } from "./hw-sources.js";

// per robot: board and options (4 DC motors need the Mega; moving robots get an IMU and the ESP32's Wi-Fi)
const OPTIONS = {
  mecanum: { board: "mega", imu: true },
  chiku: { board: "esp32", imu: true, wifi: true }, chiku_mesh: { board: "esp32", imu: true, wifi: true },
  ackermann: { board: "esp32", imu: true, wifi: true }, mobile_manipulator: { board: "esp32", imu: true, wifi: true },
  quadruped: { board: "esp32", imu: true, wifi: true }, hexapod: { board: "esp32", imu: true, wifi: true },
  humanoid: { board: "esp32", imu: true, wifi: true }, legged_manipulator: { board: "esp32", imu: true, wifi: true },
};
const TF_REMAPS = ["mecanum_drive_controller", "ackermann_steering_controller"];

export function isCourseRobot(g) { return !!COURSE_KIND[g.id]; }

function controllersOf(yaml) {
  const m = String(yaml).match(/controller_manager:\n {2}ros__parameters:\n([\s\S]*?)\n\n/);
  return m ? [...m[1].matchAll(/^ {4}(\w+):\n {6}type:/gm)].map((x) => x[1]) : ["joint_state_broadcaster"];
}

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

function controlLaunch(g, name, hw, controllers, mode, rviz) {
  const real = mode === "real";
  const tfOdom = controllers.some((c) => TF_REMAPS.includes(c));   // their odom -> base_link goes to ~/tf_odometry
  return `${real ? `# ros2lab-robot: ${g.id}\n` : ""}# ${g.title}: ros2_control with ${real ? "the real robot: ros2lab_hardware/BridgeSystem talks to the ESP32 / Arduino board" : "fake hardware (mock_components/GenericSystem: every command is echoed back as the joint state)"}.
${real ? `# Needs a hardware license from your course administrator (ROS2Lab rule; mock and Gazebo do not).
#   ros2 launch ${name} real.launch.py                                   USB: /dev/ros2lab_mcu (udev rule of ros2lab_hardware)
#   ros2 launch ${name} real.launch.py transport:=udp host:=192.168.4.1   ESP32 over Wi-Fi (its own access point)
` : `#   ros2 launch ${name} mock.launch.py
`}# Controllers (config/controllers.yaml): ${controllers.join(", ")}
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument${rviz ? "\nfrom launch.conditions import IfCondition" : ""}
from launch.substitutions import Command, LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    robot_description = ParameterValue(Command([
        'xacro ', PathJoinSubstitution([FindPackageShare('${name}'), 'urdf', '${g.id}_hw.urdf.xacro']),
        ' hardware_type:=${mode}'${real ? `,
        ' transport:=', LaunchConfiguration('transport'),
        ' device:=', LaunchConfiguration('device'),
        ' host:=', LaunchConfiguration('host')` : ""}]), value_type=str)
    controllers_file = PathJoinSubstitution([FindPackageShare('${name}'), 'config', 'controllers.yaml'])
    return LaunchDescription([
${rviz ? `        DeclareLaunchArgument('rviz', default_value='${real ? "false" : "true"}', description='Open RViz${real ? " (on the Jetson only with a screen; else run rviz2 on your PC, same ROS_DOMAIN_ID)" : ""}'),
` : ""}${real ? `        DeclareLaunchArgument('transport', default_value='serial', choices=['serial', 'udp'], description='serial: USB cable; udp: Wi-Fi'),
        DeclareLaunchArgument('device', default_value='/dev/ros2lab_mcu', description='USB serial device of the board'),
        DeclareLaunchArgument('host', default_value='192.168.4.1', description="The board's IP address (Wi-Fi)"),
` : ""}        Node(package='robot_state_publisher', executable='robot_state_publisher', output='screen',
             parameters=[{'robot_description': robot_description}]),
        Node(package='controller_manager', executable='ros2_control_node', output='screen',
             parameters=[controllers_file]),
        Node(package='controller_manager', executable='spawner', output='screen',
             arguments=[${controllers.map((c) => `'${c}'`).join(", ")}, '--controller-manager', '/controller_manager'${tfOdom ? ", '--controller-ros-args', '-r ~/tf_odometry:=/tf'" : ""}]),
${rviz ? `        Node(package='rviz2', executable='rviz2', name='rviz2', output='screen',
             arguments=['-d', PathJoinSubstitution([FindPackageShare('${name}'), 'rviz', 'bringup.rviz'])],
             condition=IfCondition(LaunchConfiguration('rviz'))),
` : ""}    ])
`;
}

/**
 * @param g          the robot from robots/index.json
 * @param descPkg    its description package name
 * @param o.urdf     the expanded URDF (no xacro left), o.main the main URDF file in descPkg/urdf
 * @param o.moveitPkg  arms: the MoveIt config (hardware_type:=mock runs its demo.launch.py, with MoveIt)
 * @param o.gzTarget [pkg, file] for hardware_type:=gz
 */
export function courseBringupPackage(g, descPkg, { urdf, main, moveitPkg, gzTarget, rviz }) {
  const kind = COURSE_KIND[g.id]; if (!kind || !urdf) return null;
  const name = `${g.id}_bringup`, opt = { board: "esp32", ...(OPTIONS[g.id] || {}) };
  const hw = robotSetup(urdf, { kind, name: g.id, ...opt });
  const ctl = controllersOf(hw.files["controllers.yaml"]);
  const motors = hw.plan.filter((p) => p.actuator === "motor").length, servos = hw.plan.length - motors;
  const robotName = (String(urdf).match(/<robot\b[^>]*\bname\s*=\s*"([^"]+)"/) || [])[1] || g.id;
  const fw = sourcesFor("ros2lab_firmware");   // the sketch: licensed source, or locked notes
  const files = {
    "package.xml": pkgXml(name, `${g.title}: the real robot (ESP32 / Arduino board with the ROS2Lab bridge firmware, ros2lab_hardware on a Jetson), mock hardware and Gazebo bringup`,
      [descPkg, "ros2lab_hardware", ...(moveitPkg ? [moveitPkg] : []), "xacro", "robot_state_publisher", "controller_manager", ...(rviz ? ["rviz2"] : []), ...ctl]),   // each controller name is also its package name
    "CMakeLists.txt": `cmake_minimum_required(VERSION 3.10)
project(${name})

find_package(ament_cmake REQUIRED)

# firmware/ is not installed: it is the sketch to flash on the board (Arduino IDE)
install(DIRECTORY launch config urdf${rviz ? " rviz" : ""}
  DESTINATION share/\${PROJECT_NAME})

ament_package()
`,
    [`urdf/${g.id}_hw.urdf.xacro`]: `<?xml version="1.0"?>
<!-- ${g.title} with its <ros2_control> block: the course URDF from ${descPkg} plus config/${g.id}.ros2_control.xacro.
     xacro args: hardware_type:=mock|gz|real  transport:=serial|udp  device:=/dev/ros2lab_mcu  host:=192.168.4.1 -->
<robot name="${robotName}" xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:include filename="$(find ${descPkg})/urdf/${main}"/>
  <xacro:include filename="$(find ${name})/config/${g.id}.ros2_control.xacro"/>
</robot>
`,
    [`config/${g.id}.ros2_control.xacro`]: hw.files[`${g.id}.ros2_control.xacro`],
    "config/controllers.yaml": hw.files["controllers.yaml"],
    "launch/mock.launch.py": controlLaunch(g, name, hw, ctl, "mock", !!rviz),
    "launch/real.launch.py": controlLaunch(g, name, hw, ctl, "real", !!rviz),
    ...(rviz ? { "rviz/bringup.rviz": rviz } : {}),
    "launch/bringup.launch.py": bringupSelector(g, name, { mock: moveitPkg ? [moveitPkg, "demo.launch.py"] : [name, "mock.launch.py"], gz: gzTarget }),
    "firmware/WIRING.md": hw.files["WIRING.md"],
    ...Object.fromEntries(Object.entries(fw).filter(([f]) => /^ros2lab_bridge\//.test(f)).map(([f, t]) => [`firmware/${f}`, t])),
    "firmware/ros2lab_bridge/robot_config.h": hw.files["robot_config.h"],
    "HARDWARE_LICENSE.md": `# Hardware license

ROS2Lab lets you connect a real robot only with a **hardware license from your course administrator**.
Ask for it on the Robotic Models Simulator page (Connect to ROS 2 on your Ubuntu computer → Ask for a hardware license): name the
robot (${g.id}) and what you will do with it. Until it is approved, ROS2Lab's terminal refuses
\`ros2 launch ${name} real.launch.py\`, and the driver and firmware source stay hidden in your workspace. (On your
own Jetson ROS 2 itself cannot be locked: the license is the course's rule for using real robots.) Fake hardware
(\`hardware_type:=mock\`) and Gazebo (\`hardware_type:=gz\`) never need a license.
`,
    "README.md": `# ${name}: build the real ${g.title}

| | |
|---|---|
| Computer | NVIDIA Jetson (JetPack 7 = Ubuntu 24.04 + ROS 2 Jazzy), or any Ubuntu 24.04 PC |
| Board | ${opt.board === "mega" ? "Arduino Mega 2560 (USB serial 115200 baud)" : `ESP32 DevKitC (USB serial 921600 baud${opt.wifi ? ", or Wi-Fi UDP 8888 on its own access point" : ""})`} |
| Actuators | ${motors ? `${motors} DC gear motor${motors > 1 ? "s" : ""} with Hall encoders (TB6612FNG drivers)` : ""}${motors && servos ? ", " : ""}${servos ? `${servos} servo${servos > 1 ? "s" : ""} (${opt.board === "esp32" ? "PCA9685 16-channel boards, I2C" : servos > PINS.mega.servo_pins.length ? "PCA9685" : "board pins"})` : ""} |
| IMU | ${opt.imu ? "MPU-6050 or BNO055 on I2C (imu_sensor_broadcaster → /imu_sensor_broadcaster/imu)" : "none"} |
| Controllers | ${ctl.join(", ")} |

## Run it

| What | Command |
|---|---|
| Fake hardware | \`ros2 launch ${name} bringup.launch.py hardware_type:=mock\` |
| Gazebo | ${gzTarget ? `\`ros2 launch ${name} bringup.launch.py hardware_type:=gz\`` : "-"} |
| The real robot (USB) | \`ros2 launch ${name} bringup.launch.py hardware_type:=real\` (hardware license) |
| The real robot (Wi-Fi) | \`ros2 launch ${name} real.launch.py transport:=udp host:=192.168.4.1\` |
| Test the board without ROS | \`ros2 run ros2lab_hardware bridge_probe serial /dev/ros2lab_mcu ${PINS[opt.board].baud}\` |
${gzTarget && !/control/.test(gzTarget[1]) && ["diff", "mecanum", "ackermann", "mobile_manipulator"].includes(kind) ? `
In Gazebo (\`hardware_type:=gz\`, ${gzTarget[0]}/launch/${gzTarget[1]}) the base is driven by Gazebo's own drive system:
publish \`geometry_msgs/msg/Twist\` on \`/cmd_vel\` (ros_gz_bridge carries it into Gazebo). With mock and real hardware
the ros2_control controllers of \`config/controllers.yaml\` drive it instead, and they take \`geometry_msgs/msg/TwistStamped\`
(ROS 2 Jazzy) on their own topic (\`ros2 topic list -t\` shows it).
` : ""}
## Build it

1. Wire the board as \`firmware/WIRING.md\` says. Motors and servos get their own battery; all grounds are joined.
2. Open \`firmware/ros2lab_bridge/ros2lab_bridge.ino\` in the Arduino IDE (board: ${opt.board === "mega" ? "Arduino Mega or Mega 2560; library Servo" : "ESP32 Dev Module, Arduino-ESP32 core 3.x"}) and upload.
   \`robot_config.h\` is already made for this robot (\`ros2 run ros2lab_hardware ros2lab_robot_setup\` writes the same file).
3. On the Jetson: \`sudo cp $(ros2 pkg prefix ros2lab_hardware)/share/ros2lab_hardware/udev/99-ros2lab-mcu.rules /etc/udev/rules.d/\`,
   \`sudo udevadm control --reload-rules && sudo udevadm trigger\`, \`sudo usermod -aG dialout $USER\` (log in again).
4. Lift the robot (or clear the arm's space), then start it with \`hardware_type:=real\`. The motors only move after the
   driver sends ENABLE, and the board stops them 500 ms after the last command.

Check every pin, servo range and the encoder counts (\`MOTOR\` in robot_config.h: 660 counts per wheel turn for an
11-line encoder on a 1:30 gearbox) against your own parts before powering the motors.
`,
  };
  return { name, files, launches: ["bringup.launch.py", "mock.launch.py", "real.launch.py"], hw: { kind, ...opt, controllers: ctl } };
}

// ros2lab_hardware itself (the C++ driver package from hardware/src), shown read-only in the course robots' workspace
export function hardwarePackage() {
  const files = sourcesFor("ros2lab_hardware"); if (!files["package.xml"]) return null;
  return { name: "ros2lab_hardware", files, launches: ["bridge.launch.py"] };
}
