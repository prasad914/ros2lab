// Gazebo Harmonic files for a robot description package, written the way ROS 2 Jazzy projects do it
// (turtlebot3_simulations jazzy, gz_ros2_control_demos, gazebosim.org "ROS 2 integration"):
//   urdf/<robot>.gazebo.xacro      <gazebo reference="link"><sensor ...> blocks, DiffDrive / JointStatePublisher systems
//   urdf/<robot>_sim.urdf.xacro    the robot + its Gazebo tags (+ optical frames for cameras)
//   worlds/<pkg>_world.sdf         a small room; loads the Physics, Sensors (ogre2) and Imu systems
//   config/gz_bridge.yaml          ros_gz_bridge: which Gazebo topics reach ROS 2 (and /cmd_vel back)
//   launch/sim.launch.py / .xml    gz_sim.launch.py + robot_state_publisher + ros_gz_sim create + parameter_bridge + rviz2
//   rviz/sim.rviz                  RobotModel, TF, and one display per sensor
import { parseURDF, urdfEdges, framePoses } from "./urdf-core.js";
import { sensorTopics as sensorTopicsFor } from "./gz-sdf.js";
import { ros2ControlXacro, controllersYaml, parseRos2Control } from "./ros2-control.js";

const q = (v) => String(Math.round(v * 1e6) / 1e6);
const OPTICAL_RPY = "1.570796 -1.570796 0";   // a sensor (x forward, z up) inside an optical-convention link (z forward, y down)

// ---------------- the robot's Gazebo tags ----------------
function sensorXml(s) {
  const head = `  <gazebo reference="${s.link}">\n    <sensor name="${s.name}" type="${s.type}">\n      <pose>0 0 0 ${s.opticalLink ? OPTICAL_RPY : "0 0 0"}</pose>\n      <always_on>true</always_on>\n      <visualize>true</visualize>\n      <update_rate>${s.rate}</update_rate>\n      <topic>${s.topic}</topic>\n      <gz_frame_id>${s.frame || s.link}</gz_frame_id>\n`;
  const tail = "    </sensor>\n  </gazebo>\n";
  if (s.type === "gpu_lidar") {
    const [hs, hmin, hmax] = s.h, [vs, vmin, vmax] = s.v || [1, 0, 0];
    return head + `      <lidar>
        <scan>
          <horizontal>
            <samples>${hs}</samples>
            <resolution>1</resolution>
            <min_angle>${q(hmin)}</min_angle>
            <max_angle>${q(hmax)}</max_angle>
          </horizontal>
          <vertical>
            <samples>${vs}</samples>
            <resolution>1</resolution>
            <min_angle>${q(vmin)}</min_angle>
            <max_angle>${q(vmax)}</max_angle>
          </vertical>
        </scan>
        <range>
          <min>${s.range[0]}</min>
          <max>${s.range[1]}</max>
          <resolution>${s.res ?? 0.01}</resolution>
        </range>
        <noise>
          <type>gaussian</type>
          <mean>0.0</mean>
          <stddev>${s.noise ?? 0.01}</stddev>
        </noise>
      </lidar>
` + tail;
  }
  if (s.type === "camera" || s.type === "rgbd_camera" || s.type === "depth_camera") {
    const [hfov, w, h, near, far] = s.cam;
    return head.replace(/(<gz_frame_id>[^<]*<\/gz_frame_id>\n)/, `$1      <camera>\n        <optical_frame_id>${s.optical}</optical_frame_id>\n`) + `        <horizontal_fov>${hfov}</horizontal_fov>
        <image>
          <width>${w}</width>
          <height>${h}</height>
          <format>R8G8B8</format>
        </image>
        <clip>
          <near>${near}</near>
          <far>${far}</far>
        </clip>
${s.type !== "camera" ? `        <depth_camera>\n          <clip>\n            <near>${near}</near>\n            <far>${far}</far>\n          </clip>\n        </depth_camera>\n` : ""}        <noise>
          <type>gaussian</type>
          <mean>0.0</mean>
          <stddev>0.007</stddev>
        </noise>
      </camera>
` + tail;
  }
  if (s.type === "imu") return head + `      <imu>
        <angular_velocity>
          <x><noise type="gaussian"><mean>0.0</mean><stddev>2e-4</stddev></noise></x>
          <y><noise type="gaussian"><mean>0.0</mean><stddev>2e-4</stddev></noise></y>
          <z><noise type="gaussian"><mean>0.0</mean><stddev>2e-4</stddev></noise></z>
        </angular_velocity>
        <linear_acceleration>
          <x><noise type="gaussian"><mean>0.0</mean><stddev>1.7e-2</stddev></noise></x>
          <y><noise type="gaussian"><mean>0.0</mean><stddev>1.7e-2</stddev></noise></y>
          <z><noise type="gaussian"><mean>0.0</mean><stddev>1.7e-2</stddev></noise></z>
        </linear_acceleration>
      </imu>
` + tail;
  return "";
}
export function gazeboXacro(sim) {
  let s = `<?xml version="1.0"?>
<!-- Gazebo Harmonic (gz sim 8) tags for ${sim.robot}. gz sim reads them when ros_gz_sim create spawns the URDF.
     Sensors publish on Gazebo topics (<topic>); config/gz_bridge.yaml brings them to ROS 2.
     <gz_frame_id> sets header.frame_id, so RViz can place the data with TF.
     Camera and lidar sensors only run if the world loads gz-sim-sensors-system; the IMU needs gz-sim-imu-system. -->
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">

`;
  for (const sen of sim.sensors) s += sensorXml(sen) + "\n";
  if (sim.drive) {
    const d = sim.drive;
    s += `  <!-- differential drive: /cmd_vel in, /odom and the odom -> ${sim.base} transform out -->
  <gazebo>
    <plugin filename="gz-sim-diff-drive-system" name="gz::sim::systems::DiffDrive">
${d.left.map((j) => `      <left_joint>${j}</left_joint>\n`).join("")}${d.right.map((j) => `      <right_joint>${j}</right_joint>\n`).join("")}      <wheel_separation>${d.separation}</wheel_separation>
      <wheel_radius>${d.radius}</wheel_radius>
      <max_linear_acceleration>1.0</max_linear_acceleration>
      <topic>cmd_vel</topic>
      <odom_topic>odom</odom_topic>
      <tf_topic>tf</tf_topic>
      <frame_id>odom</frame_id>
      <child_frame_id>${sim.base}</child_frame_id>
      <odom_publish_frequency>30</odom_publish_frequency>
    </plugin>
  </gazebo>

`;
  }
  if (sim.velocity) {
    s += `  <!-- ${sim.velocity.note || "This robot walks with its maker's own locomotion controller, which is not part of this course."}
       For driving practice, Gazebo's VelocityControl system moves the whole body from /cmd_vel (geometry_msgs/msg/Twist, bridged),
       and OdometryPublisher reports where it went (/odom and odom -> ${sim.base}). Real limits: about ${sim.velocity.maxV} m/s and ${sim.velocity.maxW} rad/s. -->
  <gazebo>
    <plugin filename="gz-sim-velocity-control-system" name="gz::sim::systems::VelocityControl">
      <topic>cmd_vel</topic>
    </plugin>
    <plugin filename="gz-sim-odometry-publisher-system" name="gz::sim::systems::OdometryPublisher">
      <odom_frame>odom</odom_frame>
      <robot_base_frame>${sim.base}</robot_base_frame>
      <odom_topic>odom</odom_topic>
      <tf_topic>tf</tf_topic>
      <odom_publish_frequency>30</odom_publish_frequency>
      <dimensions>2</dimensions>
    </plugin>
  </gazebo>

`;
  }
  for (const j of sim.positions || []) s += `  <!-- ${j.joint}: a position controller (the actuator). Publish the goal angle on /${j.joint}/cmd_pos (std_msgs/msg/Float64) -->
  <gazebo>
    <plugin filename="gz-sim-joint-position-controller-system" name="gz::sim::systems::JointPositionController">
      <joint_name>${j.joint}</joint_name>
      <topic>${j.joint}/cmd_pos</topic>
      <p_gain>100</p_gain>
      <d_gain>10</d_gain>
      <initial_position>${j.initial}</initial_position>
    </plugin>
  </gazebo>

`;
  s += `  <!-- the position of every joint, for robot_state_publisher (bridged to /joint_states) -->
  <gazebo>
    <plugin filename="gz-sim-joint-state-publisher-system" name="gz::sim::systems::JointStatePublisher">
      <topic>joint_states</topic>
    </plugin>
  </gazebo>
</robot>
`;
  return s;
}
export function simXacro(pkg, sim, mainFile) {
  const opt = sim.sensors.filter((x) => x.addOptical);
  return `<?xml version="1.0"?>
<!-- ${sim.robot} for Gazebo: the description from ${mainFile}, plus its sensors and Gazebo systems -->
<robot name="${sim.robot}" xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:include filename="$(find ${pkg})/urdf/${mainFile}"/>
  <xacro:include filename="$(find ${pkg})/urdf/${sim.model}.gazebo.xacro"/>
${opt.map((x) => `
  <!-- camera images use the optical convention (z forward, x right, y down): a frame for header.frame_id -->
  <link name="${x.optical}"/>
  <joint name="${x.optical}_joint" type="fixed">
    <parent link="${x.link}"/>
    <child link="${x.optical}"/>
    <origin xyz="0 0 0" rpy="-1.570796 0 -1.570796"/>
  </joint>
`).join("")}</robot>
`;
}

// ---------------- the world ----------------
const box = (name, [x, y, z], [sx, sy, sz], rgb, yaw = 0) => `    <model name="${name}">
      <static>true</static>
      <pose>${x} ${y} ${z} 0 0 ${yaw}</pose>
      <link name="link">
        <collision name="collision"><geometry><box><size>${sx} ${sy} ${sz}</size></box></geometry></collision>
        <visual name="visual">
          <geometry><box><size>${sx} ${sy} ${sz}</size></box></geometry>
          <material><ambient>${rgb} 1</ambient><diffuse>${rgb} 1</diffuse></material>
        </visual>
      </link>
    </model>
`;
const cyl = (name, [x, y, z], r, l, rgb) => `    <model name="${name}">
      <static>true</static>
      <pose>${x} ${y} ${z} 0 0 0</pose>
      <link name="link">
        <collision name="collision"><geometry><cylinder><radius>${r}</radius><length>${l}</length></cylinder></geometry></collision>
        <visual name="visual">
          <geometry><cylinder><radius>${r}</radius><length>${l}</length></cylinder></geometry>
          <material><ambient>${rgb} 1</ambient><diffuse>${rgb} 1</diffuse></material>
        </visual>
      </link>
    </model>
`;
const sph = (name, [x, y, z], r, rgb) => `    <model name="${name}">
      <static>true</static>
      <pose>${x} ${y} ${z} 0 0 0</pose>
      <link name="link">
        <collision name="collision"><geometry><sphere><radius>${r}</radius></sphere></geometry></collision>
        <visual name="visual">
          <geometry><sphere><radius>${r}</radius></sphere></geometry>
          <material><ambient>${rgb} 1</ambient><diffuse>${rgb} 1</diffuse></material>
        </visual>
      </link>
    </model>
`;
export function worldSdf(name, scale = 1) {
  const k = (v) => q(v * scale), W = 4 * scale, H = 1.0 * Math.max(0.6, scale);
  return `<?xml version="1.0" ?>
<!-- A small room for sensor practice. The plugins are the Gazebo systems: without Sensors, cameras and
     lidars stay silent; without Imu, the IMU does too (gz-sim's own empty.sdf has neither). -->
<sdf version="1.9">
  <world name="${name}">
    <physics name="1ms" type="ignored">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
    </physics>
    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"/>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"/>
    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors">
      <render_engine>ogre2</render_engine>
    </plugin>
    <plugin filename="gz-sim-imu-system" name="gz::sim::systems::Imu"/>

    <gravity>0 0 -9.8</gravity>
    <include><uri>https://fuel.gazebosim.org/1.0/OpenRobotics/models/Sun</uri></include>
    <include><uri>https://fuel.gazebosim.org/1.0/OpenRobotics/models/Ground Plane</uri></include>

${box("wall_north", [0, W, H / 2], [2 * W + 0.2, 0.2, H], "0.85 0.85 0.8")}${box("wall_south", [0, -W, H / 2], [2 * W + 0.2, 0.2, H], "0.85 0.85 0.8")}${box("wall_east", [W, 0, H / 2], [0.2, 2 * W, H], "0.8 0.8 0.75")}${box("wall_west", [-W, 0, H / 2], [0.2, 2 * W, H], "0.8 0.8 0.75")}${box("red_box", [k(1.6), k(0.6), k(0.25)], [k(0.5), k(0.5), k(0.5)], "0.85 0.15 0.1", 0.4)}${box("blue_box", [k(-1.4), k(1.5), k(0.3)], [k(0.8), k(0.4), k(0.6)], "0.1 0.3 0.85", -0.3)}${cyl("green_pillar", [k(1.2), k(-1.4), k(0.5)], k(0.2), k(1.0), "0.1 0.7 0.2")}${cyl("yellow_drum", [k(-1.6), k(-1.2), k(0.3)], k(0.3), k(0.6), "0.95 0.8 0.1")}${sph("orange_ball", [k(2.4), k(-0.4), k(0.2)], k(0.2), "1.0 0.5 0.0")}${box("shelf", [k(-2.8), k(0), k(0.45)], [k(0.4), k(1.6), k(0.9)], "0.55 0.35 0.2")}  </world>
</sdf>
`;
}

// ---------------- ros_gz_bridge ----------------
export function bridgeYaml(sim) {
  const e = (ros, gz, rt, gt, dir) => `- ros_topic_name: "${ros}"\n  gz_topic_name: "${gz}"\n  ros_type_name: "${rt}"\n  gz_type_name: "${gt}"\n  direction: ${dir}\n`;
  let s = `# ros_gz_bridge: Gazebo topics <-> ROS 2 topics. GZ_TO_ROS = Gazebo publishes, ROS 2 receives.
# The types must match pairs ros_gz_bridge knows (sensor_msgs/msg/LaserScan <-> gz.msgs.LaserScan ...).
${e("/clock", "/clock", "rosgraph_msgs/msg/Clock", "gz.msgs.Clock", "GZ_TO_ROS")}${e("/joint_states", "/joint_states", "sensor_msgs/msg/JointState", "gz.msgs.Model", "GZ_TO_ROS")}`;
  for (const j of sim.positions || []) s += e(`/${j.joint}/cmd_pos`, `/${j.joint}/cmd_pos`, "std_msgs/msg/Float64", "gz.msgs.Double", "ROS_TO_GZ");
  if (sim.drive || sim.velocity) s += e("/cmd_vel", "/cmd_vel", "geometry_msgs/msg/Twist", "gz.msgs.Twist", "ROS_TO_GZ") + e("/odom", "/odom", "nav_msgs/msg/Odometry", "gz.msgs.Odometry", "GZ_TO_ROS") + e("/tf", "/tf", "tf2_msgs/msg/TFMessage", "gz.msgs.Pose_V", "GZ_TO_ROS");
  for (const x of sim.sensors) {
    const t = "/" + x.topic;
    if (x.type === "gpu_lidar") { s += e(t, t, "sensor_msgs/msg/LaserScan", "gz.msgs.LaserScan", "GZ_TO_ROS"); if ((x.v || [1])[0] > 1) s += e(x.rosCloud ? "/" + x.rosCloud : `${t}/points`, `${t}/points`, "sensor_msgs/msg/PointCloud2", "gz.msgs.PointCloudPacked", "GZ_TO_ROS"); }
    if (x.type === "camera") { const info = t.replace(/\/[^/]*$/, "") + "/camera_info"; s += e(t, t, "sensor_msgs/msg/Image", "gz.msgs.Image", "GZ_TO_ROS") + e(info, info, "sensor_msgs/msg/CameraInfo", "gz.msgs.CameraInfo", "GZ_TO_ROS"); }
    if (x.type === "rgbd_camera") for (const [sub, rt, gt] of [["image", "sensor_msgs/msg/Image", "gz.msgs.Image"], ["depth_image", "sensor_msgs/msg/Image", "gz.msgs.Image"], ["points", "sensor_msgs/msg/PointCloud2", "gz.msgs.PointCloudPacked"], ["camera_info", "sensor_msgs/msg/CameraInfo", "gz.msgs.CameraInfo"]]) s += e(`${t}/${sub}`, `${t}/${sub}`, rt, gt, "GZ_TO_ROS");
    if (x.type === "imu") s += e(t, t, "sensor_msgs/msg/Imu", "gz.msgs.IMU", "GZ_TO_ROS");
  }
  return s;
}

// ---------------- launch files ----------------
export function simLaunchPy(pkg, sim) {
  return `import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    pkg_share = get_package_share_directory('${pkg}')
    ros_gz_sim = get_package_share_directory('ros_gz_sim')

    world = os.path.join(pkg_share, 'worlds', '${sim.world}')
    model = os.path.join(pkg_share, 'urdf', '${sim.model}_sim.urdf.xacro')
    bridge_config = os.path.join(pkg_share, 'config', 'gz_bridge.yaml')
    rviz_config = os.path.join(pkg_share, 'rviz', 'sim.rviz')

    use_sim_time = LaunchConfiguration('use_sim_time')
    robot_description = ParameterValue(Command(['xacro ', model]), value_type=str)

    return LaunchDescription([
        DeclareLaunchArgument('use_sim_time', default_value='true',
                              description='Use the Gazebo clock (/clock)'),

        # Gazebo Harmonic: -r starts the simulation running (without it, press play)
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(ros_gz_sim, 'launch', 'gz_sim.launch.py')),
            launch_arguments={'gz_args': ['-r -v 1 ', world]}.items(),
        ),

        Node(package='robot_state_publisher', executable='robot_state_publisher',
             parameters=[{'robot_description': robot_description, 'use_sim_time': use_sim_time}]),

        # put the robot from /robot_description into the Gazebo world
        Node(package='ros_gz_sim', executable='create', output='screen',
             arguments=['-topic', 'robot_description', '-name', '${sim.name}', '-z', '${q(sim.z)}']),

        # Gazebo topics -> ROS 2 topics (and /cmd_vel back), from config/gz_bridge.yaml
        Node(package='ros_gz_bridge', executable='parameter_bridge', output='screen',
             parameters=[{'config_file': bridge_config, 'use_sim_time': use_sim_time}]),

        Node(package='rviz2', executable='rviz2', name='rviz2', output='screen',
             arguments=['-d', rviz_config],
             parameters=[{'use_sim_time': use_sim_time}]),
    ])
`;
}
export function simLaunchXml(pkg, sim) {
  return `<launch>
  <arg name="use_sim_time" default="true"/>
  <let name="model" value="$(find-pkg-share ${pkg})/urdf/${sim.model}_sim.urdf.xacro"/>

  <!-- Gazebo Harmonic: -r starts the simulation running (without it, press play) -->
  <include file="$(find-pkg-share ros_gz_sim)/launch/gz_sim.launch.py">
    <arg name="gz_args" value="-r -v 1 $(find-pkg-share ${pkg})/worlds/${sim.world}"/>
  </include>

  <node pkg="robot_state_publisher" exec="robot_state_publisher">
    <param name="robot_description" value="$(command 'xacro $(var model)')" type="str"/>
    <param name="use_sim_time" value="$(var use_sim_time)"/>
  </node>

  <!-- put the robot from /robot_description into the Gazebo world -->
  <node pkg="ros_gz_sim" exec="create" output="screen" args="-topic robot_description -name ${sim.name} -z ${q(sim.z)}"/>

  <!-- Gazebo topics -> ROS 2 topics (and /cmd_vel back) -->
  <node pkg="ros_gz_bridge" exec="parameter_bridge" output="screen">
    <param name="config_file" value="$(find-pkg-share ${pkg})/config/gz_bridge.yaml"/>
    <param name="use_sim_time" value="$(var use_sim_time)"/>
  </node>

  <node pkg="rviz2" exec="rviz2" name="rviz2" output="screen" args="-d $(find-pkg-share ${pkg})/rviz/sim.rviz">
    <param name="use_sim_time" value="$(var use_sim_time)"/>
  </node>
</launch>
`;
}

// ---------------- RViz ----------------
const topicQ = (t, rel = "Best Effort") => `      Topic:\n        Depth: 5\n        Durability Policy: Volatile\n        History Policy: Keep Last\n        Reliability Policy: ${rel}\n        Value: ${t}`;
export function simDisplays(sim) {
  const D = [];
  for (const x of sim.sensors) {
    const t = "/" + x.topic;
    if (x.type === "gpu_lidar") {
      D.push(`    - Alpha: 1\n      Autocompute Intensity Bounds: true\n      Class: rviz_default_plugins/LaserScan\n      Color: 255; 255; 255\n      Color Transformer: Intensity\n      Decay Time: 0\n      Enabled: true\n      Name: LaserScan\n      Position Transformer: XYZ\n      Selectable: true\n      Size (Pixels): 3\n      Size (m): ${x.v && x.v[0] > 1 ? 0.03 : 0.05}\n      Style: Flat Squares\n${topicQ(t)}\n      Use Fixed Frame: true\n      Use rainbow: true\n      Value: true`);
      if (x.v && x.v[0] > 1) D.push(`    - Alpha: 1\n      Autocompute Intensity Bounds: true\n      Axis: Z\n      Class: rviz_default_plugins/PointCloud2\n      Color Transformer: AxisColor\n      Decay Time: 0\n      Enabled: true\n      Name: PointCloud2 (${x.name})\n      Position Transformer: XYZ\n      Selectable: true\n      Size (Pixels): 3\n      Size (m): 0.03\n      Style: Flat Squares\n${topicQ(x.rosCloud ? "/" + x.rosCloud : t + "/points")}\n      Use Fixed Frame: true\n      Use rainbow: true\n      Value: true`);
    }
    if (x.type === "camera") D.push(`    - Class: rviz_default_plugins/Image\n      Enabled: true\n      Max Value: 1\n      Median window: 5\n      Min Value: 0\n      Name: Image\n      Normalize Range: true\n${topicQ(t)}\n      Value: true`);
    if (x.type === "rgbd_camera") {
      D.push(`    - Class: rviz_default_plugins/Image\n      Enabled: true\n      Max Value: 1\n      Median window: 5\n      Min Value: 0\n      Name: Image (${x.name})\n      Normalize Range: true\n${topicQ(t + "/image")}\n      Value: true`);
      D.push(`    - Alpha: 1\n      Class: rviz_default_plugins/PointCloud2\n      Color Transformer: RGB8\n      Decay Time: 0\n      Enabled: true\n      Name: PointCloud2 (${x.name})\n      Position Transformer: XYZ\n      Selectable: true\n      Size (Pixels): 3\n      Size (m): 0.02\n      Style: Flat Squares\n${topicQ(t + "/points")}\n      Use Fixed Frame: true\n      Value: true`);
    }
    if (x.type === "imu") D.push(`    - Acceleration properties:\n        Acc. vector alpha: 1\n        Acc. vector color: 255; 0; 0\n        Acc. vector scale: 0.05\n        Derotate acceleration: true\n        Enable acceleration: false\n      Axes properties:\n        Axes scale: 0.3\n        Enable axes: true\n      Box properties:\n        Box alpha: 1\n        Box color: 255; 0; 0\n        Enable box: false\n        x_scale: 1\n        y_scale: 1\n        z_scale: 1\n      Class: rviz_imu_plugin/Imu\n      Enabled: true\n      Name: Imu\n${topicQ(t)}\n      Value: true\n      fixed_frame_orientation: true`);
  }
  if (sim.drive || sim.velocity || sim.odomTopic) D.push(`    - Angle Tolerance: 0.1\n      Class: rviz_default_plugins/Odometry\n      Covariance:\n        Orientation:\n          Alpha: 0.5\n          Color: 255; 255; 127\n          Color Style: Unique\n          Frame: Local\n          Offset: 1\n          Scale: 1\n          Value: true\n        Position:\n          Alpha: 0.3\n          Color: 204; 51; 204\n          Scale: 1\n          Value: true\n        Value: false\n      Enabled: true\n      Keep: 50\n      Name: Odometry\n      Position Tolerance: 0.1\n      Shape:\n        Alpha: 1\n        Axes Length: 1\n        Axes Radius: 0.1\n        Color: 255; 25; 0\n        Head Length: 0.06\n        Head Radius: 0.02\n        Shaft Length: 0.2\n        Shaft Radius: 0.01\n        Value: Arrow\n${topicQ(sim.odomTopic || "/odom")}\n      Value: true`);
  return D.join("\n");
}

// Spawn height: lift the robot so its lowest link frame (feet, wheels) touches the ground
export function spawnHeight(urdfText, extra = 0) {
  try {
    const m = parseURDF(urdfText), P = framePoses(urdfEdges(m, {}, true), m.root).poses;
    let lo = 0;
    for (const l of Object.values(m.links)) { const T = P[l.name]; if (!T) continue; let r = 0; for (const c of l.collisions || []) if (c.geom.type === "sphere") r = Math.max(r, c.geom.radius); else if (c.geom.type === "cylinder") r = Math.max(r, c.geom.radius); lo = Math.min(lo, T.t[2] - r); }
    return Math.max(0, -lo) + extra;
  } catch { return 0.05; }
}

// Every Gazebo file of a sim package. spec: index.json "sim" entry; urdfText: the plain robot (to place it)
export function simFiles(pkg, mainFile, spec, urdfText, view) {
  const sim = { ...spec, robot: spec.robot || spec.model, name: spec.name || spec.model, world: `${pkg.replace(/_description$|_support$/, "")}_world.sdf`, base: spec.base || "base_link" };
  sim.sensors = (spec.sensors || []).map((s) => ({ ...s, optical: s.optical || (s.type !== "camera" && s.type !== "rgbd_camera" ? null : s.opticalLink ? s.link : `${s.link}_optical_frame`), addOptical: (s.type === "camera" || s.type === "rgbd_camera") && !s.opticalLink && !s.optical }));
  if (sim.z === undefined) sim.z = spawnHeight(urdfText, 0.01);
  return {
    sim,
    files: {
      [`urdf/${sim.model}.gazebo.xacro`]: gazeboXacro(sim),
      [`urdf/${sim.model}_sim.urdf.xacro`]: simXacro(pkg, sim, mainFile),
      [`worlds/${sim.world}`]: worldSdf(sim.world.replace(/\.sdf$/, ""), spec.worldScale || 1),
      "config/gz_bridge.yaml": bridgeYaml(sim),
      "launch/sim.launch.py": simLaunchPy(pkg, sim),
      "launch/sim.launch.xml": simLaunchXml(pkg, sim),
    },
    displays: simDisplays(sim),
    fixedFrame: sim.drive || sim.velocity ? "odom" : spec.fixedFrame || null,
    control: spec.control ? controlFiles(pkg, mainFile, sim, urdfText) : null,
  };
}

// A student's own robot: its Gazebo sensors and systems are already in the URDF (<gazebo> tags), so only the
// world, the bridge, the launch files and an RViz config are added, built from what the URDF declares.
export function simFromUrdf(pkg, mainFile, gz, model, urdfText) {
  const world = `${pkg.replace(/_description$/, "")}_world`, name = gz.robot, R = [];
  const e = (ros, gzT, rt, gt, dir) => R.push({ ros, gz: gzT, rt, gt, dir });
  e("/clock", "/clock", "rosgraph_msgs/msg/Clock", "gz.msgs.Clock", "GZ_TO_ROS");
  const D = [], sensors = [];
  for (const sen of gz.sensors) {
    if (!/^(gpu_lidar|gpu_ray|camera|depth_camera|depth|rgbd_camera|rgbd|imu)$/.test(sen.type)) continue;
    sensors.push(sen);
    for (const [t, gt, kind] of sensorTopicsFor(sen, world, name)) {
      const ros = sen.topic ? t : `/${sen.name}/${kind === "info" ? "camera_info" : kind}`;   // a default (scoped) Gazebo topic gets a short ROS name
      const rt = { "gz.msgs.LaserScan": "sensor_msgs/msg/LaserScan", "gz.msgs.PointCloudPacked": "sensor_msgs/msg/PointCloud2", "gz.msgs.Image": "sensor_msgs/msg/Image", "gz.msgs.CameraInfo": "sensor_msgs/msg/CameraInfo", "gz.msgs.IMU": "sensor_msgs/msg/Imu" }[gt];
      e(ros, t, rt, gt, "GZ_TO_ROS");
      const T = topicQ(ros);
      if (kind === "scan") D.push(`    - Class: rviz_default_plugins/LaserScan\n      Color Transformer: Intensity\n      Enabled: true\n      Name: LaserScan (${sen.name})\n      Size (m): 0.03\n      Style: Flat Squares\n${T}\n      Value: true`);
      if (kind === "points") D.push(`    - Class: rviz_default_plugins/PointCloud2\n      Color Transformer: ${/rgbd/.test(sen.type) ? "RGB8" : "AxisColor"}\n      Enabled: true\n      Name: PointCloud2 (${sen.name})\n      Size (m): 0.02\n      Style: Flat Squares\n${T}\n      Value: true`);
      if (kind === "image") D.push(`    - Class: rviz_default_plugins/Image\n      Enabled: true\n      Name: Image (${sen.name})\n      Normalize Range: true\n${T}\n      Value: true`);
      if (kind === "imu") D.push(`    - Class: rviz_imu_plugin/Imu\n      Enabled: true\n      Name: Imu (${sen.name})\n${T}\n      Value: true\n      Axes properties:\n        Axes scale: 0.3\n        Enable axes: true`);
    }
  }
  let fixed = model.root;
  for (const p of gz.plugins) {
    if (p.kind === "diff_drive") {
      const cmd = slashT(p.topic) || `/model/${name}/cmd_vel`, od = slashT(p.odomTopic) || `/model/${name}/odometry`, tf = slashT(p.tfTopic) || `/model/${name}/tf`;
      e("/cmd_vel", cmd, "geometry_msgs/msg/Twist", "gz.msgs.Twist", "ROS_TO_GZ"); e("/odom", od, "nav_msgs/msg/Odometry", "gz.msgs.Odometry", "GZ_TO_ROS"); e("/tf", tf, "tf2_msgs/msg/TFMessage", "gz.msgs.Pose_V", "GZ_TO_ROS");
      fixed = p.frame || `${name}/odom`;
      D.push(`    - Class: rviz_default_plugins/Odometry\n      Enabled: true\n      Keep: 50\n      Name: Odometry\n      Shape:\n        Head Length: 0.06\n        Head Radius: 0.02\n        Shaft Length: 0.2\n        Shaft Radius: 0.01\n        Value: Arrow\n${topicQ("/odom")}\n      Value: true`);
    }
    if (p.kind === "joint_states") e("/joint_states", slashT(p.topic) || `/world/${world}/model/${name}/joint_state`, "sensor_msgs/msg/JointState", "gz.msgs.Model", "GZ_TO_ROS");
    if (p.kind === "joint_position") e(`/${p.joint}/cmd_pos`, slashT(p.topic) || `/model/${name}/joint/${p.joint}/0/cmd_pos`, "std_msgs/msg/Float64", "gz.msgs.Double", "ROS_TO_GZ");
  }
  const yaml = "# ros_gz_bridge for " + name + ": generated from the <gazebo> tags of " + mainFile + "\n" + R.map((x) => `- ros_topic_name: "${x.ros}"\n  gz_topic_name: "${x.gz}"\n  ros_type_name: "${x.rt}"\n  gz_type_name: "${x.gt}"\n  direction: ${x.dir}\n`).join("");
  const sim = { model: mainFile.replace(/\.urdf(\.xacro)?$|\.xacro$/, ""), name, world: `${world}.sdf`, z: spawnHeight(urdfText, 0.01) };
  const py = simLaunchPy(pkg, sim).replace(`os.path.join(pkg_share, 'urdf', '${sim.model}_sim.urdf.xacro')`, `os.path.join(pkg_share, 'urdf', '${mainFile}')`);
  const xml = simLaunchXml(pkg, sim).replace(`/urdf/${sim.model}_sim.urdf.xacro`, `/urdf/${mainFile}`);
  return {
    files: { [`worlds/${world}.sdf`]: worldSdf(world), "config/gz_bridge.yaml": yaml, "launch/sim.launch.py": py, "launch/sim.launch.xml": xml },
    displays: D.join("\n"), fixedFrame: fixed, sensors, classic: gz.classic,
  };
}
const slashT = (t) => (t ? (t.startsWith("/") ? t : "/" + t) : null);

// ---------------- the same robot driven by ros2_control (gz_ros2_control + controllers), the other common Jazzy way ----------------
//   urdf/<model>_control.gazebo.xacro   sensors + <ros2_control> (GazeboSimSystem) + the gz_ros2_control-system plugin
//   config/controllers.yaml             controller_manager update rate, joint_state_broadcaster, diff_drive_controller / joint_trajectory_controller
//   config/gz_bridge_control.yaml       only /clock and the sensors: commands and joint states go through ros2_control, not the bridge
//   launch/sim_control.launch.py/.xml   + the spawner nodes
export function controlFiles(pkg, mainFile, sim, urdfText) {
  let arm = null;
  if (!sim.drive) {
    try {
      const m = parseURDF(urdfText), init = Object.fromEntries((sim.positions || []).map((j) => [j.joint, Number(j.initial) || 0]));
      arm = Object.values(m.joints).filter((j) => ["revolute", "continuous", "prismatic"].includes(j.type) && !j.mimic).map((j) => ({ name: j.name, initial: init[j.name] || 0 }));
    } catch { arm = []; }
    if (!arm.length) return null;
  }
  const d = sim.drive, ctrl = d ? "diff_drive_controller" : "joint_trajectory_controller";
  // a vendor URDF that already has <ros2_control> for the real robot (e.g. kortex_driver/KortexMultiInterfaceHardware):
  // like the vendor's sim_gazebo:=true option, keep its joints and swap the hardware plugin for gz_ros2_control/GazeboSimSystem
  const own = /<ros2_control\b/.test(urdfText || "");
  if (own && arm) { const P = parseRos2Control(urdfText); const pos = new Set(P.systems.flatMap((x) => x.joints.filter((j) => j.command.some((c) => c.name === "position")).map((j) => j.name))); arm = arm.filter((j) => pos.has(j.name)); }
  let gzUrdf = null;
  if (own) gzUrdf = String(urdfText).replace(/<hardware>[\s\S]*?<\/hardware>/g, "<hardware>\n      <!-- simulation: Gazebo's joints are the hardware (the real robot uses its vendor driver here) -->\n      <plugin>gz_ros2_control/GazeboSimSystem</plugin>\n    </hardware>");
  const plugin = `  <gazebo>\n    <plugin filename="gz_ros2_control-system" name="gz_ros2_control::GazeboSimROS2ControlPlugin">\n      <parameters>$(find ${pkg})/config/controllers.yaml</parameters>\n    </plugin>\n  </gazebo>`;
  const rc = own ? `  <!-- <ros2_control> is in urdf/${sim.model}_gz.urdf (the vendor's block, with GazeboSimSystem as hardware) -->\n${plugin}` : ros2ControlXacro({ wheels: d ? [...d.left, ...d.right] : null, arm, ns: pkg });
  const sensors = sim.sensors.map(sensorXml).join("\n");
  const gzx = `<?xml version="1.0"?>
<!-- ${sim.robot} in Gazebo, driven by ros2_control (ROS 2 Jazzy + Gazebo Harmonic):
     1. <ros2_control> lists every joint the controllers may command, with its command and state interfaces,
        and the hardware plugin gz_ros2_control/GazeboSimSystem (the Gazebo joints are the "hardware").
     2. The gz_ros2_control-system plugin starts controller_manager inside Gazebo with config/controllers.yaml.
     3. launch/sim_control.launch.py runs the spawners: they load, configure and activate the controllers.
     ${d ? "4. diff_drive_controller listens on /diff_drive_controller/cmd_vel for geometry_msgs/msg/TwistStamped (Jazzy)." : "4. joint_trajectory_controller takes trajectories on /joint_trajectory_controller/joint_trajectory (and the follow_joint_trajectory action)."} -->
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">

${sensors}
${rc}
</robot>
`;
  const opt = sim.sensors.filter((x) => x.addOptical);
  const top = `<?xml version="1.0"?>
<!-- ${sim.robot} for Gazebo with ros2_control: the description from ${mainFile}, its sensors, and <ros2_control> -->
<robot name="${sim.robot}" xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:include filename="$(find ${pkg})/urdf/${own ? `${sim.model}_gz.urdf` : mainFile}"/>
  <xacro:include filename="$(find ${pkg})/urdf/${sim.model}_control.gazebo.xacro"/>
${opt.map((x) => `
  <link name="${x.optical}"/>
  <joint name="${x.optical}_joint" type="fixed">
    <parent link="${x.link}"/>
    <child link="${x.optical}"/>
    <origin xyz="0 0 0" rpy="-1.570796 0 -1.570796"/>
  </joint>
`).join("")}</robot>
`;
  const yaml = controllersYaml(d ? { wheels: { left: d.left, right: d.right }, separation: d.separation, radius: d.radius, base: sim.base } : { arm });
  const bridge = bridgeYaml({ ...sim, drive: null, velocity: null, positions: [] }).replace(/- ros_topic_name: "\/joint_states"\n[\s\S]*?direction: GZ_TO_ROS\n/, "").replace("# ros_gz_bridge:", "# ros_gz_bridge (ros2_control version): only the clock and the sensors. Commands, odometry and joint states\n# come from ros2_control controllers, which are ROS nodes already.\n# ros_gz_bridge:");
  const spawnPy = `        # ros2_control: gz_ros2_control started controller_manager inside Gazebo. Each spawner waits for it,
        # then loads, configures and activates one controller, and exits.
        Node(package='controller_manager', executable='spawner',
             arguments=['joint_state_broadcaster']),
        Node(package='controller_manager', executable='spawner',
             arguments=['${ctrl}']),

`;
  const py = simLaunchPy(pkg, sim).replace(`'${sim.model}_sim.urdf.xacro'`, `'${sim.model}_control.urdf.xacro'`).replace("'gz_bridge.yaml'", "'gz_bridge_control.yaml'").replace("'sim.rviz'", "'sim_control.rviz'")
    .replace("# Gazebo topics -> ROS 2 topics (and /cmd_vel back), from config/gz_bridge.yaml", "# Gazebo topics -> ROS 2 topics: /clock and the sensors (config/gz_bridge_control.yaml)")
    .replace("        Node(package='rviz2'", spawnPy + "        Node(package='rviz2'");
  const spawnXml = `  <!-- ros2_control: each spawner waits for controller_manager (inside Gazebo), loads, configures and activates one controller -->
  <node pkg="controller_manager" exec="spawner" args="joint_state_broadcaster"/>
  <node pkg="controller_manager" exec="spawner" args="${ctrl}"/>

`;
  const xml = simLaunchXml(pkg, sim).replace(`/urdf/${sim.model}_sim.urdf.xacro`, `/urdf/${sim.model}_control.urdf.xacro`).replace("/config/gz_bridge.yaml", "/config/gz_bridge_control.yaml").replace("/rviz/sim.rviz", "/rviz/sim_control.rviz")
    .replace("<!-- Gazebo topics -> ROS 2 topics (and /cmd_vel back) -->", "<!-- Gazebo topics -> ROS 2 topics: /clock and the sensors -->").replace('  <node pkg="rviz2"', spawnXml + '  <node pkg="rviz2"');
  return {
    files: {
      [`urdf/${sim.model}_control.gazebo.xacro`]: gzx, [`urdf/${sim.model}_control.urdf.xacro`]: top,
      ...(gzUrdf ? { [`urdf/${sim.model}_gz.urdf`]: gzUrdf } : {}),
      "config/controllers.yaml": yaml, "config/gz_bridge_control.yaml": bridge,
      "launch/sim_control.launch.py": py, "launch/sim_control.launch.xml": xml,
    },
    displays: simDisplays({ ...sim, drive: null, velocity: null, odomTopic: d ? "/diff_drive_controller/odom" : null }),
    controller: ctrl, arm,
    fixedFrame: d ? "odom" : null,
  };
}
