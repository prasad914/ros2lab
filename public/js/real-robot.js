// The real robot: launch/real.launch.py and REAL_ROBOT.md for a description package, so the same package that runs in
// the practice terminal also runs the purchased robot on Ubuntu 24.04 + ROS 2 Jazzy (USB, Ethernet, CAN or Wi-Fi).
// Each robot's maker driver runs the hardware; this package adds robot_state_publisher / RViz with the same displays
// as the simulation. Facts (drivers, ports, topics) checked against the makers' repositories (see REAL.drivers).
// Arms: their <robot>_moveit_config package has real.launch.py (MoveIt + the driver's trajectory controller).

export const REAL = {
  turtlebot3: {
    driver: "turtlebot3_bringup (ROBOTIS, branch jazzy)", install: "sudo apt install ros-jazzy-turtlebot3 ros-jazzy-hls-lfcd-lds-driver ros-jazzy-ld08-driver",
    connection: "On the robot (Raspberry Pi): OpenCR board on USB /dev/ttyACM0, LDS-01 lidar on /dev/ttyUSB0 (LDS-02 is found automatically). The PC talks to it over Wi-Fi: same network and the same ROS_DOMAIN_ID on both (e.g. export ROS_DOMAIN_ID=30).",
    setup: ["sudo usermod -aG dialout $USER   (then log out and in)", "ros2 run turtlebot3_bringup create_udev_rules"],
    env: (g) => [`export TURTLEBOT3_MODEL=${/waffle/.test(g.id) ? "waffle" : "burger"}`, "export LDS_MODEL=LDS-01   (or LDS-02 for robots made since 2022)"],
    launch: "ros2 launch turtlebot3_bringup robot.launch.py usb_port:=/dev/ttyACM0",
    include: { pkg: "turtlebot3_bringup", file: "robot.launch.py", args: { usb_port: "/dev/ttyACM0" }, env: (g) => ({ TURTLEBOT3_MODEL: /waffle/.test(g.id) ? "waffle" : "burger", LDS_MODEL: "LDS-01" }) },
    teleop: "ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args -p stamped:=true   (Jazzy's turtlebot3_node takes geometry_msgs/TwistStamped on /cmd_vel)",
    topics: "/scan (LaserScan), /imu, /odom, /joint_states, /tf, /battery_state",
  },
  scout: {
    driver: "scout_ros2 (AgileX, branch origin/jazzy) + ugv_sdk", install: "git clone https://github.com/agilexrobotics/ugv_sdk.git src/ugv_sdk && git clone -b origin/jazzy https://github.com/agilexrobotics/scout_ros2.git src/scout_ros2 && rosdep install --from-paths src --ignore-src --rosdistro jazzy -y && colcon build",
    connection: "CAN bus through a USB-to-CAN adapter (gs_usb): sudo modprobe gs_usb && sudo ip link set can0 up type can bitrate 500000 (check with: candump can0, from sudo apt install can-utils).",
    setup: ["sudo modprobe gs_usb", "sudo ip link set can0 up type can bitrate 500000"],
    launch: "ros2 launch scout_base scout_base.launch.py port_name:=can0",
    include: { pkg: "scout_base", file: "scout_base.launch.py", args: { port_name: "can0" } },
    teleop: "ros2 run teleop_twist_keyboard teleop_twist_keyboard   (geometry_msgs/Twist on /cmd_vel)",
    topics: "/odom, /tf (odom -> base_link), /scout_status",
  },
  unitree: {
    driver: "unitree_ros2 (Unitree, CycloneDDS; tested by Unitree on Foxy/Humble, builds on Jazzy)", install: "git clone https://github.com/unitreerobotics/unitree_ros2 ~/unitree_ros2 && sudo apt install ros-jazzy-rmw-cyclonedds-cpp ros-jazzy-rosidl-generator-dds-idl libyaml-cpp-dev && cd ~/unitree_ros2/cyclonedds_ws && colcon build",
    connection: "Ethernet cable to the robot: give the PC the static address 192.168.123.99/24, then export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp and CYCLONEDDS_URI with that network card (see ~/unitree_ros2/setup.sh) and source it.",
    setup: ["sudo ip addr add 192.168.123.99/24 dev <your_ethernet_card>", "source ~/unitree_ros2/setup.sh   (sets RMW_IMPLEMENTATION=rmw_cyclonedds_cpp and CYCLONEDDS_URI)"],
    launch: "(no launch file: the robot publishes its DDS topics itself once the network is set up)",
    include: null,
    teleop: "The robot has no /cmd_vel: it walks with its sport mode API (unitree_api/msg/Request on /api/sport/request, Move = api_id 1008). See unitree_ros2/example.",
    topics: "Go2: /utlidar/cloud (PointCloud2), /sportmodestate, /lowstate. G1/H1: /lowstate, /livox/lidar from the head's MID-360 (livox_ros_driver2).",
  },
  spot: {
    driver: "spot_ros2 (Boston Dynamics AI Institute; upstream supports Humble / Ubuntu 22.04)", install: "cd ~/ros2_ws/src && git clone https://github.com/bdaiinstitute/spot_ros2.git && cd spot_ros2 && git submodule init && git submodule update && ./install_spot_ros2.sh && cd ~/ros2_ws && colcon build",
    connection: "Wi-Fi (Spot's access point) or Ethernet. Put hostname, username and password in a config YAML, or export BOSDYN_CLIENT_USERNAME, BOSDYN_CLIENT_PASSWORD and SPOT_IP.",
    setup: ["export SPOT_IP=10.0.0.3", "export BOSDYN_CLIENT_USERNAME=<user>", "export BOSDYN_CLIENT_PASSWORD=<password>"],
    launch: "ros2 launch spot_driver spot_driver.launch.py config_file:=<your spot_ros_config.yaml>",
    include: { pkg: "spot_driver", file: "spot_driver.launch.py", args: {} },
    teleop: "ros2 run teleop_twist_keyboard teleop_twist_keyboard   (geometry_msgs/Twist on cmd_vel; claim and power on first: ros2 service call /claim std_srvs/srv/Trigger && ros2 service call /power_on std_srvs/srv/Trigger && ros2 service call /stand std_srvs/srv/Trigger)",
    topics: "/odometry, /depth/frontleft/image, /camera/frontleft/image, /joint_states, /tf",
  },
  crazyflie: {
    driver: "crazyswarm2 (IMRCLab, Jazzy)", install: "sudo apt install ros-jazzy-crazyflie ros-jazzy-crazyflie-interfaces ros-jazzy-crazyflie-py ros-jazzy-motion-capture-tracking && pip3 install --break-system-packages rowan cflib transforms3d",
    connection: "Crazyradio PA on USB (URI like radio://0/80/2M/E7E7E7E7E7, set in crazyflie/config/crazyflies.yaml). USB rules: SUBSYSTEM==\"usb\", ATTRS{idVendor}==\"1915\", ATTRS{idProduct}==\"7777\", MODE=\"0664\", GROUP=\"plugdev\" in /etc/udev/rules.d/99-bitcraze.rules, and sudo usermod -aG plugdev $USER.",
    setup: ["sudo groupadd plugdev; sudo usermod -aG plugdev $USER", "write /etc/udev/rules.d/99-bitcraze.rules (see the connection line), then: sudo udevadm control --reload-rules && sudo udevadm trigger"],
    launch: "ros2 launch crazyflie launch.py backend:=cflib mocap:=False",
    include: { pkg: "crazyflie", file: "launch.py", args: { backend: "cflib", mocap: "False" } },
    teleop: "ros2 run crazyflie_examples hello_world  (takeoff / land); velocity: geometry_msgs/Twist on /cf231/cmd_vel_legacy",
    topics: "/cf231/pose, /cf231/odom, /tf",
  },
};
export function realFor(g) {
  if (/^tb3_/.test(g.id)) return REAL.turtlebot3;
  if (g.id === "scout") return REAL.scout;
  if (["go2", "g1", "h1"].includes(g.id)) return REAL.unitree;
  if (g.id === "spot") return REAL.spot;
  if (g.id === "crazyflie") return REAL.crazyflie;
  return null;
}

export function realLaunchPy(pkg, g, r, urdfFile, rvizFile) {
  const inc = r.include;
  return `# ros2lab-robot: ${g.id}
# The REAL ${g.title}.
# Driver: ${r.driver}
# Install once: ${r.install}
# Connection: ${r.connection}
${(r.setup || []).map((x) => `#   ${x}`).join("\n")}
# Then: ros2 launch ${pkg} real.launch.py
${inc ? `# This starts the maker's driver (${inc.pkg} ${inc.file}) and RViz with the same displays as the simulation.` : "# The robot publishes its own topics; this starts robot_state_publisher (for the TF tree) and RViz."}
# Drive it: ${r.teleop}
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument${inc ? ", IncludeLaunchDescription, SetEnvironmentVariable" : ""}
${inc ? "from launch.launch_description_sources import PythonLaunchDescriptionSource\n" : ""}from launch.conditions import IfCondition
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    pkg_share = get_package_share_directory('${pkg}')
    rviz = LaunchConfiguration('rviz')
    actions = [
        DeclareLaunchArgument('rviz', default_value='true', description='Open RViz on this computer'),
    ]
${inc ? `${Object.entries((inc.env && inc.env(g)) || {}).map(([k, v]) => `    actions.append(SetEnvironmentVariable('${k}', os.environ.get('${k}', '${v}')))`).join("\n")}
    # the maker's driver (fails with "package '${inc.pkg}' not found" until it is installed: see the lines above)
    actions.append(IncludeLaunchDescription(
        PythonLaunchDescriptionSource(os.path.join(get_package_share_directory('${inc.pkg}'), 'launch', '${inc.file}')),
        launch_arguments={${Object.entries(inc.args).map(([k, v]) => `'${k}': '${v}'`).join(", ")}}.items()))
` : `    # the robot's TF tree from this package's URDF (the robot itself publishes joint states and sensor data)
    actions.append(Node(package='robot_state_publisher', executable='robot_state_publisher',
                        parameters=[{'robot_description': ParameterValue(Command(['xacro ', os.path.join(pkg_share, 'urdf', '${urdfFile}')]), value_type=str)}]))
`}    actions.append(Node(package='rviz2', executable='rviz2', name='rviz2', output='screen',
                        arguments=['-d', os.path.join(pkg_share, 'rviz', '${rvizFile}')],
                        condition=IfCondition(rviz)))
    return LaunchDescription(actions)
`;
}

export function realReadme(pkg, g, r) {
  return `# ${g.title}: the real robot (ROS 2 Jazzy, Ubuntu 24.04)

| | |
|---|---|
| Driver | ${r.driver} |
| Install | \`${r.install}\` |
| Connection | ${r.connection} |
| Start the robot | \`${r.launch}\` |
| Or, with RViz | \`ros2 launch ${pkg} real.launch.py\` |
| Drive / command it | ${r.teleop} |
| Topics | ${r.topics} |

${(r.setup || []).length ? `One-time setup:\n\n${r.setup.map((x) => `- \`${x}\``).join("\n")}\n` : ""}${r.env ? `\nEnvironment (put it in ~/.bashrc):\n\n${r.env(g).map((x) => `- \`${x}\``).join("\n")}\n` : ""}
The simulation in this package (\`sim.launch.py\`, \`sim_control.launch.py\`) uses the same topic names where the real
driver does (/scan, /imu, /odom, /cmd_vel), so RViz configs and your own nodes work on both. Start slowly, keep the
robot's emergency stop in reach, and test new code in the simulation first.
`;
}
