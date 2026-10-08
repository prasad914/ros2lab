// A <robot>_moveit_config package for ROS 2 Jazzy, laid out like the MoveIt Setup Assistant writes it, so the same
// package runs in the practice terminal and on Ubuntu 24.04 with ros-jazzy-moveit:
//   .setup_assistant, package.xml, CMakeLists.txt
//   config/<robot>.urdf.xacro            the description + <ros2_control> (hardware: mock | gazebo | feetech ...)
//   config/<robot>.ros2_control.xacro    joints with position command, position+velocity state, initial values
//   config/<robot>.srdf                  planning groups, named states, end effector, disable_collisions (ACM)
//   config/initial_positions.yaml, joint_limits.yaml (velocity AND acceleration: Pilz and TOTG need both),
//   config/kinematics.yaml (KDL), pilz_cartesian_limits.yaml
//   config/ompl_planning.yaml, pilz_industrial_motion_planner_planning.yaml, chomp_planning.yaml, stomp_planning.yaml
//   config/ros2_controllers.yaml (controller_manager), moveit_controllers.yaml (MoveIt -> FollowJointTrajectory)
//   config/moveit_controllers_real.yaml  the controller names of the maker's driver (real robot)
//   config/moveit.rviz                   RViz with the MotionPlanning display
//   launch/demo.launch.py + the MSA launch files (rsp, move_group, moveit_rviz, spawn_controllers, ...)
//   launch/gazebo.launch.py              Gazebo Harmonic + gz_ros2_control + MoveIt, same scene objects as the world
//   launch/real.launch.py                MoveIt for the real robot (the maker's driver runs the hardware)
//   worlds/<robot>_moveit.sdf, scripts/add_scene_objects.py, README.md
import { OMPL_PLANNERS } from "./moveit-core.js";

const n4 = (v) => String(Math.round(v * 1e4) / 1e4);
// a YAML float that ROS 2 reads as a double: 1 -> "1.0" (an integer here makes move_group abort: "expected [double] got [integer]")
const fl = (v) => { const s = n4(v); return /[.eE]/.test(s) ? s : `${s}.0`; };
const yamlList = (a) => `[${a.join(", ")}]`;

// The obstacles around an arm, scaled to its reach: a table in front, a box on it, a post at the side.
// The same list is written to the Gazebo world, the planning scene script and the browser's planning scene.
export function sceneObjects(reach) {
  const R = Math.max(0.2, reach);
  return [
    { id: "table", type: "box", dims: [0.4 * R, 1.0 * R, 0.25 * R], xyz: [0.68 * R, 0, 0.125 * R], color: "0.55 0.35 0.2" },
    { id: "box_on_table", type: "box", dims: [0.12 * R, 0.12 * R, 0.3 * R], xyz: [0.62 * R, 0, 0.4 * R], color: "0.85 0.15 0.1" },
    { id: "post", type: "cylinder", dims: [0.9 * R, 0.05 * R], xyz: [0.3 * R, 0.55 * R, 0.45 * R], color: "0.1 0.7 0.2" },
  ];
}
// reach: the longest distance from the chain's base to any link of the chain (joints at zero)
export function armReach(K, G) {
  const P = K.fk({}), B = P[G.base] || P[K.root], b = [B[3], B[7], B[11]];
  let r = 0.1; for (const j of G.chain) { const T = P[j.child]; r = Math.max(r, Math.hypot(T[3] - b[0], T[7] - b[1], T[11] - b[2])); }
  return r;
}

export function moveitPackageName(id) { return `${id.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}_moveit_config`; }

// spec: index.json "moveit" entry; ctx: { id, title, descPkg, descFile, model, urdfText, acm: [{link1, link2, reason}], G (JointGroup), objects }
export function moveitConfigFiles(spec, ctx) {
  const { id, title, descPkg, model } = ctx;
  const pkg = moveitPackageName(id), robot = id;
  const G = ctx.G, arm = G.joints, grip = (spec.gripper || []).filter((j) => model.joints[j]);
  const all = [...arm, ...grip];
  const group = spec.group || "arm", ggroup = spec.gripperGroup || "gripper";
  const home = arm.map((_, i) => (spec.home && spec.home[i] !== undefined ? spec.home[i] : 0));
  const ready = arm.map((_, i) => (spec.ready && spec.ready[i] !== undefined ? spec.ready[i] : 0));
  const clampJ = (n, v) => { const j = model.joints[n]; return j.limit && j.type !== "continuous" ? Math.min(j.limit.upper, Math.max(j.limit.lower, v)) : v; };
  const init = Object.fromEntries([...arm.map((n, i) => [n, clampJ(n, home[i])]), ...grip.map((n) => [n, clampJ(n, (spec.close || [0])[0])])]);
  const armMax = Math.max(0, ...arm.map((n) => (model.joints[n].limit && model.joints[n].limit.velocity) || 0));
  const vel = (n) => { const j = model.joints[n]; const v = j.limit && j.limit.velocity > 0 ? j.limit.velocity : spec.vel || armMax || 1.0; return Math.min(v, spec.vel || v); };
  const own = /<ros2_control\b/.test(ctx.urdfText || "");   // the maker's URDF already has <ros2_control> for its own driver
  const descRef = own ? `$(find ${pkg})/config/${robot}_description.urdf` : `$(find ${descPkg})/urdf/${ctx.descFile}`;
  const needWorld = model.root !== "world";
  const real = spec.real || null;
  const hw = spec.real && spec.real.plugin === "feetech_ros2_driver/FeetechHardwareInterface" ? "feetech" : null;
  const objects = ctx.objects || [];
  const files = {};

  files[".setup_assistant"] = `moveit_setup_assistant_config:
  urdf:
    package: ${pkg}
    relative_path: config/${robot}.urdf.xacro
  srdf:
    relative_path: config/${robot}.srdf
  package_settings:
    author_name: student
    author_email: student@ros2lab.com
    generated_timestamp: 0
  control_xacro:
    command:
      - position
    state:
      - position
      - velocity
  modified_urdf:
    xacros:
      - control_xacro
`;

  files["package.xml"] = `<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>${pkg}</name>
  <version>0.1.0</version>
  <description>MoveIt 2 configuration for ${title}: planning with OMPL, Pilz, CHOMP and STOMP; mock hardware, Gazebo Harmonic and the real robot</description>
  <maintainer email="student@ros2lab.com">student</maintainer>
  <license>BSD-3-Clause</license>

  <buildtool_depend>ament_cmake</buildtool_depend>

  <exec_depend>${descPkg}</exec_depend>
  <exec_depend>moveit_ros_move_group</exec_depend>
  <exec_depend>moveit_kinematics</exec_depend>
  <exec_depend>moveit_planners</exec_depend>
  <exec_depend>moveit_planners_ompl</exec_depend>
  <exec_depend>moveit_planners_chomp</exec_depend>
  <exec_depend>moveit_planners_stomp</exec_depend>
  <exec_depend>pilz_industrial_motion_planner</exec_depend>
  <exec_depend>moveit_simple_controller_manager</exec_depend>
  <exec_depend>moveit_ros_visualization</exec_depend>
  <exec_depend>moveit_ros_warehouse</exec_depend>
  <exec_depend>moveit_configs_utils</exec_depend>
  <exec_depend>moveit_setup_assistant</exec_depend>
  <exec_depend>warehouse_ros_sqlite</exec_depend>
  <exec_depend>controller_manager</exec_depend>
  <exec_depend>joint_state_broadcaster</exec_depend>
  <exec_depend>joint_trajectory_controller</exec_depend>
  <exec_depend>gz_ros2_control</exec_depend>
  <exec_depend>ros_gz_sim</exec_depend>
  <exec_depend>ros_gz_bridge</exec_depend>
  <exec_depend>robot_state_publisher</exec_depend>
  <exec_depend>joint_state_publisher</exec_depend>
  <exec_depend>joint_state_publisher_gui</exec_depend>
  <exec_depend>tf2_ros</exec_depend>
  <exec_depend>rviz2</exec_depend>
  <exec_depend>rviz_common</exec_depend>
  <exec_depend>rviz_default_plugins</exec_depend>
  <exec_depend>xacro</exec_depend>
  <exec_depend>rclpy</exec_depend>
  <exec_depend>moveit_msgs</exec_depend>
  <exec_depend>shape_msgs</exec_depend>
  <exec_depend>geometry_msgs</exec_depend>
${hw === "feetech" ? "  <exec_depend>feetech_ros2_driver</exec_depend>\n" : ""}
  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
`;

  files["CMakeLists.txt"] = `cmake_minimum_required(VERSION 3.22)
project(${pkg})

find_package(ament_cmake REQUIRED)

ament_package()

install(DIRECTORY launch config worlds DESTINATION share/\${PROJECT_NAME}
  PATTERN "setup_assistant.launch" EXCLUDE)
install(FILES .setup_assistant README.md DESTINATION share/\${PROJECT_NAME})
install(PROGRAMS scripts/add_scene_objects.py DESTINATION lib/\${PROJECT_NAME})
`;

  // ---------------- URDF with ros2_control
  const jointXml = (n) => `    <joint name="${n}">
      <command_interface name="position"/>
      <state_interface name="position">
        <param name="initial_value">\${initial_positions['${n}']}</param>
      </state_interface>
      <state_interface name="velocity"/>${hw === "feetech" ? `
      <xacro:if value="\${hardware == 'feetech'}">
        <param name="id">${(real.ids || {})[n] ?? 0}</param>
      </xacro:if>` : ""}
    </joint>`;
  files[`config/${robot}.ros2_control.xacro`] = `<?xml version="1.0"?>
<!-- ros2_control for ${title}: every joint MoveIt moves has a position command and position + velocity states.
     hardware:=mock     mock_components/GenericSystem (demo.launch.py: the joints follow the commands exactly)
     hardware:=gazebo   gz_ros2_control/GazeboSimSystem (gazebo.launch.py: Gazebo's joints are the hardware)${hw === "feetech" ? "\n     hardware:=feetech  feetech_ros2_driver/FeetechHardwareInterface (the real servos on usb_port)" : ""} -->
<robot xmlns:xacro="http://www.ros.org/wiki/xacro">
  <xacro:macro name="${robot}_ros2_control" params="name initial_positions_file hardware usb_port">
    <xacro:property name="initial_positions" value="\${xacro.load_yaml(initial_positions_file)['initial_positions']}"/>
    <ros2_control name="\${name}" type="system">
      <hardware>
        <xacro:if value="\${hardware == 'mock'}">
          <plugin>mock_components/GenericSystem</plugin>
        </xacro:if>
        <xacro:if value="\${hardware == 'gazebo'}">
          <plugin>gz_ros2_control/GazeboSimSystem</plugin>
        </xacro:if>${hw === "feetech" ? `
        <xacro:if value="\${hardware == 'feetech'}">
          <plugin>feetech_ros2_driver/FeetechHardwareInterface</plugin>
          <param name="usb_port">\${usb_port}</param>
        </xacro:if>` : ""}
      </hardware>
${all.map(jointXml).join("\n")}
    </ros2_control>
  </xacro:macro>
</robot>
`;
  files[`config/${robot}.urdf.xacro`] = `<?xml version="1.0"?>
<!-- ${title} for MoveIt: the robot description, fixed to the world, with its ros2_control block -->
<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="${model.name}">
  <xacro:arg name="initial_positions_file" default="$(find ${pkg})/config/initial_positions.yaml"/>
  <xacro:arg name="hardware" default="mock"/>
  <xacro:arg name="usb_port" default="${(real && real.port) || "/dev/ttyACM0"}"/>

  <xacro:include filename="${descRef}"/>
${needWorld ? `
  <!-- the robot stands on the world origin (Gazebo keeps a link called "world" fixed) -->
  <link name="world"/>
  <joint name="world_to_${model.root.replace(/\W/g, "_")}" type="fixed">
    <parent link="world"/>
    <child link="${model.root}"/>
    <origin xyz="0 0 0" rpy="0 0 0"/>
  </joint>
` : ""}
  <xacro:include filename="$(find ${pkg})/config/${robot}.ros2_control.xacro"/>
  <xacro:${robot}_ros2_control name="${robot}_system" initial_positions_file="$(arg initial_positions_file)" hardware="$(arg hardware)" usb_port="$(arg usb_port)"/>

  <xacro:if value="\${'$(arg hardware)' == 'gazebo'}">
    <gazebo>
      <plugin filename="gz_ros2_control-system" name="gz_ros2_control::GazeboSimROS2ControlPlugin">
        <parameters>$(find ${pkg})/config/ros2_controllers.yaml</parameters>
      </plugin>
    </gazebo>
  </xacro:if>
</robot>
`;
  if (own) files[`config/${robot}_description.urdf`] = String(ctx.urdfText).replace(/<ros2_control\b[\s\S]*?<\/ros2_control>\s*/g, "").replace(/<gazebo>\s*<plugin[^>]*ros2_control[\s\S]*?<\/gazebo>\s*/g, "");

  files["config/initial_positions.yaml"] = `# Default initial positions for ${robot}'s ros2_control fake system\n\ninitial_positions:\n${Object.entries(init).map(([n, v]) => `  ${n}: ${fl(v)}`).join("\n")}\n`;

  // ---------------- SRDF
  const pairs = (ctx.acm || []).slice().sort((a, b) => (a.link1 + a.link2).localeCompare(b.link1 + b.link2));
  files[`config/${robot}.srdf`] = `<?xml version="1.0" encoding="UTF-8"?>
<!--This does not replace URDF, and is not an extension of URDF.
    This is a format for representing semantic information about the robot structure.
    A URDF file must exist for this robot as well, where the joints and the links that are referenced are defined
-->
<robot name="${model.name}">
    <!--GROUPS: Representation of a set of joints and links. This can be useful for specifying DOF to plan for, defining arms, end effectors, etc-->
    <group name="${group}">
        <chain base_link="${G.base}" tip_link="${G.tip}"/>
    </group>
${grip.length ? `    <group name="${ggroup}">
${grip.map((j) => `        <joint name="${j}"/>`).join("\n")}
    </group>
` : ""}    <!--GROUP STATES: Purpose: Define a named state for a particular group, in terms of joint values. This is useful to define states like 'folded arms'-->
    <group_state name="home" group="${group}">
${arm.map((n, i) => `        <joint name="${n}" value="${n4(clampJ(n, home[i]))}"/>`).join("\n")}
    </group_state>
    <group_state name="ready" group="${group}">
${arm.map((n, i) => `        <joint name="${n}" value="${n4(clampJ(n, ready[i]))}"/>`).join("\n")}
    </group_state>
${grip.length ? `    <group_state name="open" group="${ggroup}">
${grip.map((n, i) => `        <joint name="${n}" value="${n4(clampJ(n, (spec.open || [])[i] ?? 0.02))}"/>`).join("\n")}
    </group_state>
    <group_state name="close" group="${ggroup}">
${grip.map((n, i) => `        <joint name="${n}" value="${n4(clampJ(n, (spec.close || [])[i] ?? 0))}"/>`).join("\n")}
    </group_state>
    <!--END EFFECTOR: Purpose: Represent information about an end effector.-->
    <end_effector name="hand" parent_link="${G.tip}" group="${ggroup}" parent_group="${group}"/>
` : ""}${Object.values(model.joints).filter((j) => j.mimic && all.includes(j.mimic.joint)).map((j) => `    <passive_joint name="${j.name}"/>\n`).join("")}    <!--DISABLE COLLISIONS: By default it is assumed that any link of the robot could potentially come into collision with any other link in the robot. This tag disables collision checking between a specified pair of links. -->
${pairs.map((p) => `    <disable_collisions link1="${p.link1}" link2="${p.link2}" reason="${p.reason}"/>`).join("\n")}
</robot>
`;

  // ---------------- kinematics, limits
  files["config/kinematics.yaml"] = `${group}:
  kinematics_solver: kdl_kinematics_plugin/KDLKinematicsPlugin
  kinematics_solver_search_resolution: 0.0050000000000000001
  kinematics_solver_timeout: 0.0050000000000000001
${G.dof < 6 || spec.positionOnly ? "  position_only_ik: true   # fewer than 6 joints: reach the position, let the orientation follow\n" : ""}`;
  files["config/joint_limits.yaml"] = `# joint_limits.yaml allows the dynamics properties specified in the URDF to be overwritten or augmented as needed

# For beginners, we downscale velocity and acceleration limits.
# You can always specify higher scaling factors (<= 1.0) in your motion requests.  # Increase the values below to 1.0 to always move at maximum speed.
default_velocity_scaling_factor: 0.1
default_acceleration_scaling_factor: 0.1

# Specific joint properties can be changed with the keys [max_position, min_position, max_velocity, max_acceleration]
# Joint limits can be turned off with [has_velocity_limits, has_acceleration_limits]
# Pilz (PTP, LIN, CIRC) and the time parameterization need acceleration limits, so they are set for every joint.
joint_limits:
${all.map((n) => `  ${n}:\n    has_velocity_limits: true\n    max_velocity: ${fl(vel(n))}\n    has_acceleration_limits: true\n    max_acceleration: ${fl(Math.min(vel(n) * 2, 15))}`).join("\n")}
`;
  files["config/pilz_cartesian_limits.yaml"] = `# Limits for the Pilz planner (LIN and CIRC: the tool's Cartesian speed)
cartesian_limits:
  max_trans_vel: 1.0
  max_trans_acc: 2.25
  max_trans_dec: -5.0
  max_rot_vel: 1.57
`;
  // ---------------- planning pipelines (same keys as moveit_configs_utils/default_configs)
  const req = `request_adapters:
  - default_planning_request_adapters/ResolveConstraintFrames
  - default_planning_request_adapters/ValidateWorkspaceBounds
  - default_planning_request_adapters/CheckStartStateBounds
  - default_planning_request_adapters/CheckStartStateCollision`;
  files["config/ompl_planning.yaml"] = `planning_plugins:
  - ompl_interface/OMPLPlanner
# The order of the elements in the adapter corresponds to the order they are processed by the motion planning pipeline.
${req}
response_adapters:
  - default_planning_response_adapters/AddTimeOptimalParameterization
  - default_planning_response_adapters/ValidateSolution
  - default_planning_response_adapters/DisplayMotionPath
planner_configs:
${OMPL_PLANNERS.map((p) => `  ${p}kConfigDefault:\n    type: geometric::${p}`).join("\n")}
${group}:
  default_planner_config: RRTConnectkConfigDefault
  planner_configs:
${OMPL_PLANNERS.map((p) => `    - ${p}kConfigDefault`).join("\n")}
  projection_evaluator: joints(${arm.slice(0, 2).join(",")})
  longest_valid_segment_fraction: 0.005
${grip.length ? `${ggroup}:
  planner_configs:
${OMPL_PLANNERS.map((p) => `    - ${p}kConfigDefault`).join("\n")}
` : ""}`;
  files["config/pilz_industrial_motion_planner_planning.yaml"] = `planning_plugins:
  - pilz_industrial_motion_planner/CommandPlanner
default_planner_config: PTP
${req}
response_adapters:
  - default_planning_response_adapters/ValidateSolution
  - default_planning_response_adapters/DisplayMotionPath
capabilities: >-
    pilz_industrial_motion_planner/MoveGroupSequenceAction
    pilz_industrial_motion_planner/MoveGroupSequenceService
`;
  files["config/chomp_planning.yaml"] = `planning_plugins:
  - chomp_interface/CHOMPPlanner
enable_failure_recovery: true
# The order of the elements in the adapter corresponds to the order they are processed by the motion planning pipeline.
${req}
response_adapters:
  - default_planning_response_adapters/AddTimeOptimalParameterization
  - default_planning_response_adapters/ValidateSolution
  - default_planning_response_adapters/DisplayMotionPath

ridge_factor: 0.01
planning_time_limit: 10.0
max_iterations: 200
max_iterations_after_collision_free: 5
smoothness_cost_weight: 0.1
obstacle_cost_weight: 1.0
learning_rate: 0.01
smoothness_cost_velocity: 0.0
smoothness_cost_acceleration: 1.0
smoothness_cost_jerk: 0.0
use_pseudo_inverse: false
pseudo_inverse_ridge_factor: 1e-4
joint_update_limit: 0.1
collision_clearance: 0.2
collision_threshold: 0.07
use_stochastic_descent: true
trajectory_initialization_method: "quintic-spline"
`;
  files["config/stomp_planning.yaml"] = `planning_plugins:
  - stomp_moveit/StompPlanner
${req}
response_adapters:
  - default_planning_response_adapters/AddTimeOptimalParameterization
  - default_planning_response_adapters/ValidateSolution
  - default_planning_response_adapters/DisplayMotionPath

stomp_moveit:
  num_timesteps: 60
  num_iterations: 40
  num_iterations_after_valid: 0
  num_rollouts: 30
  max_rollouts: 30
  exponentiated_cost_sensitivity: 0.8
  control_cost_weight: 0.1
  delta_t: 0.1
`;
  // ---------------- controllers
  const armCtl = "arm_controller", gripCtl = "gripper_controller";
  files["config/ros2_controllers.yaml"] = `# This config file is used by ros2_control (mock hardware, Gazebo's gz_ros2_control${hw ? ", the real servos" : ""})
controller_manager:
  ros__parameters:
    update_rate: 100  # Hz

    ${armCtl}:
      type: joint_trajectory_controller/JointTrajectoryController

${grip.length ? `    ${gripCtl}:\n      type: joint_trajectory_controller/JointTrajectoryController\n\n` : ""}    joint_state_broadcaster:
      type: joint_state_broadcaster/JointStateBroadcaster

${armCtl}:
  ros__parameters:
    joints:
${arm.map((n) => `      - ${n}`).join("\n")}
    command_interfaces:
      - position
    state_interfaces:
      - position
      - velocity
    allow_nonzero_velocity_at_trajectory_end: true
${grip.length ? `${gripCtl}:
  ros__parameters:
    joints:
${grip.map((n) => `      - ${n}`).join("\n")}
    command_interfaces:
      - position
    state_interfaces:
      - position
      - velocity
    allow_nonzero_velocity_at_trajectory_end: true
` : ""}`;
  const mctl = (names) => `# MoveIt uses this configuration for controller management

moveit_controller_manager: moveit_simple_controller_manager/MoveItSimpleControllerManager

moveit_simple_controller_manager:
  controller_names:
${names.map(([c]) => `    - ${c}`).join("\n")}

${names.map(([c, joints, def]) => `  ${c}:
    type: FollowJointTrajectory
    action_ns: follow_joint_trajectory
    default: ${def ? "true" : "false"}
    joints:
${joints.map((n) => `      - ${n}`).join("\n")}`).join("\n")}
`;
  files["config/moveit_controllers.yaml"] = mctl([[armCtl, arm, true], ...(grip.length ? [[gripCtl, grip, false]] : [])]);
  if (real && real.controller) files["config/moveit_controllers_real.yaml"] = `# The real ${title}: the maker's driver runs the hardware and this trajectory controller.\n# ${real.driver}\n` + mctl([[real.controller, arm, true]]).replace(/^# MoveIt uses this configuration for controller management\n\n/, "");

  files["config/moveit.rviz"] = moveitRviz(group, objects.length ? "world" : model.root, ctx.view);

  // ---------------- launch files (MoveIt Setup Assistant's set, using moveit_configs_utils)
  const builder = `MoveItConfigsBuilder("${robot}", package_name="${pkg}")`;
  const pipelines = `.planning_pipelines(pipelines=["ompl", "pilz_industrial_motion_planner", "chomp", "stomp"], default_planning_pipeline="ompl")`;
  const simple = (fn) => `from moveit_configs_utils import MoveItConfigsBuilder
from moveit_configs_utils.launches import ${fn}


def generate_launch_description():
    moveit_config = ${builder}${pipelines}.to_moveit_configs()
    return ${fn}(moveit_config)
`;
  files["launch/demo.launch.py"] = simple("generate_demo_launch");
  files["launch/move_group.launch.py"] = simple("generate_move_group_launch");
  files["launch/moveit_rviz.launch.py"] = simple("generate_moveit_rviz_launch");
  files["launch/rsp.launch.py"] = simple("generate_rsp_launch");
  files["launch/setup_assistant.launch.py"] = simple("generate_setup_assistant_launch");
  files["launch/spawn_controllers.launch.py"] = simple("generate_spawn_controllers_launch");
  files["launch/static_virtual_joint_tfs.launch.py"] = simple("generate_static_virtual_joint_tfs_launch");
  files["launch/warehouse_db.launch.py"] = simple("generate_warehouse_db_launch");
  files["launch/gazebo.launch.py"] = gazeboLaunch(pkg, robot, builder, pipelines, armCtl, grip.length ? gripCtl : null, descPkg);
  files["launch/real.launch.py"] = realLaunch(pkg, robot, builder, pipelines, real, hw, armCtl, grip.length ? gripCtl : null);
  files[`worlds/${robot}_moveit.sdf`] = moveitWorld(`${robot}_moveit`, objects);
  files["scripts/add_scene_objects.py"] = sceneScript(objects);
  files["README.md"] = readme(pkg, robot, title, descPkg, real, hw, group, grip.length ? ggroup : null);
  return { name: pkg, files, group, gripperGroup: grip.length ? ggroup : null, arm, grip, home, ready, init, armCtl, gripCtl: grip.length ? gripCtl : null, objects };
}

function gazeboLaunch(pkg, robot, builder, pipelines, armCtl, gripCtl, descPkg) {
  return `# MoveIt 2 + Gazebo Harmonic: gz_ros2_control runs the joints in Gazebo, MoveIt plans and executes on them.
#   ros2 launch ${pkg} gazebo.launch.py
# The planning scene gets the same obstacles as the Gazebo world (scripts/add_scene_objects.py).
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import AppendEnvironmentVariable, DeclareLaunchArgument, IncludeLaunchDescription, RegisterEventHandler
from launch.event_handlers import OnProcessExit
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    pkg_share = get_package_share_directory('${pkg}')
    world = os.path.join(pkg_share, 'worlds', '${robot}_moveit.sdf')
    moveit_config = (
        ${builder}
        .robot_description(mappings={"hardware": "gazebo"})
        ${pipelines}
        .to_moveit_configs()
    )
    use_rviz = LaunchConfiguration('use_rviz')
    sim_time = {'use_sim_time': True}

    robot_state_publisher = Node(
        package='robot_state_publisher', executable='robot_state_publisher', output='both',
        parameters=[moveit_config.robot_description, sim_time])
    spawn_robot = Node(
        package='ros_gz_sim', executable='create', output='screen',
        arguments=['-topic', 'robot_description', '-name', '${robot}', '-z', '0.0'])
    # one spawner for all controllers (Jazzy: parallel spawners compete for the spawner lock)
    controllers = Node(
        package='controller_manager', executable='spawner', output='screen',
        arguments=['joint_state_broadcaster', '${armCtl}'${gripCtl ? `, '${gripCtl}'` : ""},
                   '--controller-manager', '/controller_manager', '--controller-manager-timeout', '120'])
    move_group = Node(
        package='moveit_ros_move_group', executable='move_group', output='screen',
        parameters=[moveit_config.to_dict(), sim_time])
    rviz = Node(
        package='rviz2', executable='rviz2', name='rviz2', output='log',
        arguments=['-d', os.path.join(pkg_share, 'config', 'moveit.rviz')],
        parameters=[moveit_config.robot_description, moveit_config.robot_description_semantic,
                    moveit_config.planning_pipelines, moveit_config.robot_description_kinematics,
                    moveit_config.joint_limits, sim_time],
        condition=IfCondition(use_rviz))
    scene = Node(package='${pkg}', executable='add_scene_objects.py', output='screen', parameters=[sim_time])

    return LaunchDescription([
        DeclareLaunchArgument('use_rviz', default_value='true'),
        # Gazebo finds the meshes (model://${descPkg}/meshes/...) through GZ_SIM_RESOURCE_PATH
        AppendEnvironmentVariable('GZ_SIM_RESOURCE_PATH', os.path.dirname(get_package_share_directory('${descPkg}'))),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(get_package_share_directory('ros_gz_sim'), 'launch', 'gz_sim.launch.py')),
            launch_arguments={'gz_args': ['-r -v 1 ', world], 'on_exit_shutdown': 'true'}.items()),
        Node(package='ros_gz_bridge', executable='parameter_bridge', output='screen',
             arguments=['/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock']),
        robot_state_publisher,
        spawn_robot,
        # start the controllers once the robot is in Gazebo (gz_ros2_control starts controller_manager then)
        RegisterEventHandler(OnProcessExit(target_action=spawn_robot, on_exit=[controllers])),
        RegisterEventHandler(OnProcessExit(target_action=controllers, on_exit=[move_group, scene])),
        rviz,
    ])
`;
}

function realLaunch(pkg, robot, builder, pipelines, real, hw, armCtl, gripCtl) {
  if (hw === "feetech") return `# The real robot over USB: ros2_control talks to the Feetech servos (feetech_ros2_driver), MoveIt plans and executes.
#   sudo apt install ros-jazzy-feetech-ros2-driver      (once)
#   sudo usermod -aG dialout $USER                        (once, then log out and in)
#   ros2 launch ${pkg} real.launch.py usb_port:=/dev/ttyACM0
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def launch_setup(context):
    port = LaunchConfiguration('usb_port').perform(context)
    moveit_config = (
        ${builder}
        .robot_description(mappings={"hardware": "feetech", "usb_port": port})
        ${pipelines}
        .to_moveit_configs()
    )
    return [
        Node(package='robot_state_publisher', executable='robot_state_publisher', output='both',
             parameters=[moveit_config.robot_description]),
        Node(package='controller_manager', executable='ros2_control_node', output='screen',
             parameters=[str(moveit_config.package_path / 'config/ros2_controllers.yaml')],
             remappings=[('/controller_manager/robot_description', '/robot_description')]),
        Node(package='controller_manager', executable='spawner', output='screen',
             arguments=['joint_state_broadcaster', '${armCtl}'${gripCtl ? `, '${gripCtl}'` : ""}]),
        Node(package='moveit_ros_move_group', executable='move_group', output='screen',
             parameters=[moveit_config.to_dict()]),
        Node(package='rviz2', executable='rviz2', output='log',
             arguments=['-d', str(moveit_config.package_path / 'config/moveit.rviz')],
             parameters=[moveit_config.robot_description, moveit_config.robot_description_semantic,
                         moveit_config.planning_pipelines, moveit_config.robot_description_kinematics,
                         moveit_config.joint_limits]),
    ]


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('usb_port', default_value='${(real && real.port) || "/dev/ttyACM0"}'),
        OpaqueFunction(function=launch_setup),
    ])
`;
  const ctl = real && real.controller;
  return `# MoveIt 2 for the REAL ${robot}.
# 1. In one terminal start the maker's driver (it runs ros2_control, publishes /joint_states and runs the
#    trajectory controller on the robot):
#      ${real ? real.launch : "(no ROS 2 driver is known for this robot)"}
# 2. In a second terminal:
#      ros2 launch ${pkg} real.launch.py
# MoveIt then sends its plans to ${ctl ? `/${ctl}/follow_joint_trajectory` : "(no FollowJointTrajectory controller: plan only)"}.
# Connection: ${real ? real.connection : "-"}
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    pkg_share = get_package_share_directory('${pkg}')
    moveit_config = (
        ${builder}
        ${pipelines}
${ctl ? `        .trajectory_execution(file_path="config/moveit_controllers_real.yaml")\n` : ""}        .to_moveit_configs()
    )
    return LaunchDescription([
        DeclareLaunchArgument('add_scene_objects', default_value='false',
                              description='true: add the practice obstacles (table, box, post) to the planning scene'),
        Node(package='moveit_ros_move_group', executable='move_group', output='screen',
             parameters=[moveit_config.to_dict(), {'allow_trajectory_execution': ${ctl ? "True" : "False"}}]),
        Node(package='rviz2', executable='rviz2', output='log',
             arguments=['-d', os.path.join(pkg_share, 'config', 'moveit.rviz')],
             parameters=[moveit_config.robot_description, moveit_config.robot_description_semantic,
                         moveit_config.planning_pipelines, moveit_config.robot_description_kinematics,
                         moveit_config.joint_limits]),
        Node(package='${pkg}', executable='add_scene_objects.py', output='screen',
             condition=IfCondition(LaunchConfiguration('add_scene_objects'))),
    ])
`;
}

function moveitWorld(name, objects) {
  const shape = (o) => (o.type === "box" ? `<box><size>${o.dims.map(n4).join(" ")}</size></box>` : o.type === "cylinder" ? `<cylinder><radius>${n4(o.dims[1])}</radius><length>${n4(o.dims[0])}</length></cylinder>` : `<sphere><radius>${n4(o.dims[0])}</radius></sphere>`);
  return `<?xml version="1.0" ?>
<!-- The arm's work cell. The same objects are added to MoveIt's planning scene by scripts/add_scene_objects.py,
     so the planners avoid what Gazebo shows. Sun and ground are written out: no download from fuel.gazebosim.org. -->
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
    <gravity>0 0 -9.8</gravity>
    <light type="directional" name="sun">
      <cast_shadows>true</cast_shadows>
      <pose>0 0 10 0 0 0</pose>
      <diffuse>0.8 0.8 0.8 1</diffuse>
      <specular>0.2 0.2 0.2 1</specular>
      <direction>-0.5 0.1 -0.9</direction>
    </light>
    <model name="ground_plane">
      <static>true</static>
      <link name="link">
        <collision name="collision"><geometry><plane><normal>0 0 1</normal><size>100 100</size></plane></geometry></collision>
        <visual name="visual">
          <geometry><plane><normal>0 0 1</normal><size>100 100</size></plane></geometry>
          <material><ambient>0.8 0.8 0.8 1</ambient><diffuse>0.8 0.8 0.8 1</diffuse></material>
        </visual>
      </link>
    </model>
${objects.map((o) => `    <model name="${o.id}">
      <static>true</static>
      <pose>${o.xyz.map(n4).join(" ")} 0 0 0</pose>
      <link name="link">
        <collision name="collision"><geometry>${shape(o)}</geometry></collision>
        <visual name="visual">
          <geometry>${shape(o)}</geometry>
          <material><ambient>${o.color} 1</ambient><diffuse>${o.color} 1</diffuse></material>
        </visual>
      </link>
    </model>
`).join("")}  </world>
</sdf>
`;
}

function sceneScript(objects) {
  return `#!/usr/bin/env python3
"""Adds the work cell's obstacles to MoveIt's planning scene (the same ones the Gazebo world shows).

Calls move_group's /apply_planning_scene service with moveit_msgs/CollisionObject primitives. After this,
RViz's MotionPlanning display shows them in green and every planner (OMPL, Pilz, CHOMP, STOMP) avoids them.
  ros2 run <this package> add_scene_objects.py
"""
import rclpy
from geometry_msgs.msg import Pose
from moveit_msgs.msg import CollisionObject, PlanningScene
from moveit_msgs.srv import ApplyPlanningScene
from rclpy.node import Node
from shape_msgs.msg import SolidPrimitive

FRAME = 'world'
# id, primitive, dimensions (box: x y z, cylinder: height radius, sphere: radius), position x y z
OBJECTS = [
${objects.map((o) => `    ('${o.id}', SolidPrimitive.${o.type.toUpperCase()}, [${o.dims.map(n4).join(", ")}], [${o.xyz.map(n4).join(", ")}]),`).join("\n")}
]


def main():
    rclpy.init()
    node = Node('add_scene_objects')
    client = node.create_client(ApplyPlanningScene, '/apply_planning_scene')
    while not client.wait_for_service(timeout_sec=2.0):
        node.get_logger().info('waiting for move_group (/apply_planning_scene) ...')
    scene = PlanningScene(is_diff=True)
    for name, kind, dims, xyz in OBJECTS:
        obj = CollisionObject()
        obj.header.frame_id = FRAME
        obj.id = name
        obj.primitives.append(SolidPrimitive(type=kind, dimensions=[float(d) for d in dims]))
        pose = Pose()
        pose.position.x, pose.position.y, pose.position.z = (float(v) for v in xyz)
        pose.orientation.w = 1.0
        obj.primitive_poses.append(pose)
        obj.operation = CollisionObject.ADD
        scene.world.collision_objects.append(obj)
    future = client.call_async(ApplyPlanningScene.Request(scene=scene))
    rclpy.spin_until_future_complete(node, future, timeout_sec=30.0)
    ok = future.result() is not None and future.result().success
    node.get_logger().info(f"planning scene: {'added' if ok else 'FAILED to add'} {', '.join(o[0] for o in OBJECTS)}")
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
`;
}

export function moveitRviz(group, fixed, view) {
  const v = view || { distance: 2.5, focal: [0.3, 0, 0.3], yaw: 0.785398, pitch: 0.5 };
  return `Panels:
  - Class: rviz_common/Displays
    Help Height: 78
    Name: Displays
    Property Tree Widget:
      Expanded:
        - /MotionPlanning1
      Splitter Ratio: 0.5
    Tree Height: 400
  - Class: rviz_common/Views
    Expanded:
      - /Current View1
    Name: Views
    Splitter Ratio: 0.5
Visualization Manager:
  Class: ""
  Displays:
    - Alpha: 0.5
      Cell Size: 1
      Class: rviz_default_plugins/Grid
      Color: 160; 160; 164
      Enabled: true
      Name: Grid
      Plane: XY
      Plane Cell Count: 10
      Reference Frame: <Fixed Frame>
      Value: true
    - Acceleration_Scaling_Factor: 0.1
      Class: moveit_rviz_plugin/MotionPlanning
      Enabled: true
      Move Group Namespace: ""
      MoveIt_Allow_Approximate_IK: false
      MoveIt_Allow_External_Program: false
      MoveIt_Allow_Replanning: false
      MoveIt_Allow_Sensor_Positioning: false
      MoveIt_Planning_Attempts: 10
      MoveIt_Planning_Time: 5
      MoveIt_Use_Cartesian_Path: false
      MoveIt_Use_Constraint_Aware_IK: false
      MoveIt_Workspace:
        Center:
          X: 0
          Y: 0
          Z: 0
        Size:
          X: 2
          Y: 2
          Z: 2
      Name: MotionPlanning
      Planned Path:
        Color Enabled: false
        Interrupt Display: false
        Loop Animation: false
        Robot Alpha: 0.5
        Robot Color: 150; 50; 150
        Show Robot Collision: false
        Show Robot Visual: true
        Show Trail: false
        State Display Time: 3x
        Trail Step Size: 1
        Trajectory Topic: /display_planned_path
        Use Sim Time: false
      Planning Metrics:
        Payload: 1
        Show Joint Torques: false
        Show Manipulability: false
        Show Manipulability Index: false
        Show Weight Limit: false
        TextHeight: 0.07999999821186066
      Planning Request:
        Colliding Link Color: 255; 0; 0
        Goal State Alpha: 1
        Goal State Color: 250; 128; 0
        Interactive Marker Size: 0
        Joint Violation Color: 255; 0; 255
        Planning Group: ${group}
        Query Goal State: true
        Query Start State: false
        Show Workspace: false
        Start State Alpha: 1
        Start State Color: 0; 255; 0
      Planning Scene Topic: /monitored_planning_scene
      Robot Description: robot_description
      Scene Geometry:
        Scene Alpha: 0.8999999761581421
        Scene Color: 50; 230; 50
        Scene Display Time: 0.009999999776482582
        Show Scene Geometry: true
        Voxel Coloring: Z-Axis
        Voxel Rendering: Occupied Voxels
      Scene Robot:
        Attached Body Color: 150; 50; 150
        Robot Alpha: 1
        Show Robot Collision: false
        Show Robot Visual: true
      Value: true
      Velocity_Scaling_Factor: 0.1
  Enabled: true
  Global Options:
    Background Color: 48; 48; 48
    Fixed Frame: ${fixed}
    Frame Rate: 30
  Name: root
  Tools:
    - Class: rviz_default_plugins/Interact
      Hide Inactive Objects: true
    - Class: rviz_default_plugins/MoveCamera
    - Class: rviz_default_plugins/Select
    - Class: rviz_default_plugins/FocusCamera
    - Class: rviz_default_plugins/Measure
      Line color: 128; 128; 0
  Transformation:
    Current:
      Class: rviz_default_plugins/TF
  Value: true
  Views:
    Current:
      Class: rviz_default_plugins/Orbit
      Distance: ${n4(v.distance)}
      Focal Point:
        X: ${n4(v.focal[0])}
        Y: ${n4(v.focal[1])}
        Z: ${n4(v.focal[2])}
      Focal Shape Fixed Size: true
      Focal Shape Size: 0.05000000074505806
      Invert Z Axis: false
      Name: Current View
      Near Clip Distance: 0.009999999776482582
      Pitch: ${n4(v.pitch)}
      Target Frame: <Fixed Frame>
      Value: Orbit (rviz_default_plugins)
      Yaw: ${n4(v.yaw)}
    Saved: ~
Window Geometry:
  Height: 975
  Hide Left Dock: false
  Hide Right Dock: false
  MotionPlanning:
    collapsed: false
  Width: 1400
`;
}

function readme(pkg, robot, title, descPkg, real, hw, group, ggroup) {
  return `# ${pkg}

MoveIt 2 (ROS 2 Jazzy) configuration for **${title}**, generated by ROS2Lab in the layout of the MoveIt Setup Assistant.
It plans for the group \`${group}\`${ggroup ? ` and the gripper group \`${ggroup}\`` : ""} with four planning pipelines:
**OMPL** (RRTConnect by default, and every other OMPL planner), **Pilz** (PTP, LIN, CIRC), **CHOMP** and **STOMP**.

## Install (Ubuntu 24.04, ROS 2 Jazzy)

\`\`\`bash
sudo apt install ros-jazzy-moveit ros-jazzy-moveit-planners-chomp ros-jazzy-moveit-planners-stomp \\
  ros-jazzy-pilz-industrial-motion-planner ros-jazzy-ros2-control ros-jazzy-ros2-controllers \\
  ros-jazzy-gz-ros2-control ros-jazzy-ros-gz ros-jazzy-warehouse-ros-sqlite
cd ~/ros2_ws && colcon build --packages-select ${descPkg} ${pkg} && source install/setup.bash
\`\`\`

## Run

| What | Command |
|---|---|
| MoveIt with mock hardware (no robot, no Gazebo) | \`ros2 launch ${pkg} demo.launch.py\` |
| MoveIt + Gazebo Harmonic (gz_ros2_control), obstacles in the world and the planning scene | \`ros2 launch ${pkg} gazebo.launch.py\` |
| MoveIt for the real robot | see below |

In RViz: drag the orange interactive marker at the tool to set a goal, choose the planning pipeline in the
**Context** tab (ompl / pilz_industrial_motion_planner / chomp / stomp) and the planner (e.g. RRTConnect, PTP, LIN),
then press **Plan** and **Execute** (or **Plan & Execute**) in the **Planning** tab. Pilz PTP and LIN do not avoid
obstacles: if the straight motion would hit something, the plan is rejected ("Found a contact between ...") and OMPL,
CHOMP or STOMP will go around it.

## The real robot

${real ? `- Driver: ${real.driver}
- Install: \`${real.install}\`
- Connection: ${real.connection}
${hw === "feetech" ? `- Start: \`ros2 launch ${pkg} real.launch.py usb_port:=${real.port || "/dev/ttyACM0"}\` (this package runs ros2_control with feetech_ros2_driver; set the servo ids in config/${robot}.ros2_control.xacro)` : `- Terminal 1 (the driver): \`${real.launch}\`
- Terminal 2 (MoveIt): \`ros2 launch ${pkg} real.launch.py\`${real.controller ? ` (plans are executed by \`/${real.controller}/follow_joint_trajectory\`)` : " (this driver has no FollowJointTrajectory action: MoveIt plans; send the result with the driver's own interface)"}`}
- Keep the emergency stop in reach, start with low velocity scaling (0.1), and check every plan in RViz before you press Execute.` : "No ROS 2 Jazzy driver is known for this robot: use demo.launch.py or gazebo.launch.py."}
`;
}

// ---------------- the arm's MoveIt model: kinematics, planning group, collision spheres and the ACM ----------------
// pre: a saved { spheres, acm } (public/robots/moveit/<id>.json, made by tools/moveit-precompute.mjs), or null to
// compute it now from the meshes (readMesh(filename) -> points), as for a student's own robot.
import { KinematicModel, JointGroup, linkPoints, linkSpheres, computeACM, CollisionModel, fromRPY } from "./moveit-core.js";
export async function moveitModel(model, spec, { pre = null, readMesh = async () => [], samples = 2000 } = {}) {
  const K = new KinematicModel(model);
  const tip = spec.tip || guessTip(model), base = spec.base || model.root;
  const G = new JointGroup(K, spec.group || "arm", base, tip);
  if (spec.vel) G.setLimits(Object.fromEntries(G.joints.map((n) => [n, { max_velocity: Math.min(spec.vel, (model.joints[n].limit && model.joints[n].limit.velocity) || spec.vel) || spec.vel }])));
  let spheres = pre && pre.spheres, acm = pre && pre.acm;
  if (!spheres) spheres = linkSpheres(await linkPoints(model, readMesh));
  if (!acm) { const named = (v) => (v ? G.values(G.clamp(v)) : {}); acm = computeACM(K, spheres, { samples, defaults: [{}, named(spec.home), named(spec.ready)] }); }
  return { K, G, spheres, acm, reach: armReach(K, G) };
}
// a robot without a "moveit" entry: the end of the longest chain of moving joints (gripper fingers excluded)
export function guessTip(model) {
  const depth = (l) => { let d = 0, c = l; while (model.parentOf[c]) { const j = model.parentOf[c]; if (j.type !== "fixed" && !j.mimic && j.type !== "prismatic") d++; c = j.parent; } return d; };
  const links = Object.keys(model.links);
  const best = Math.max(...links.map(depth));
  const cands = links.filter((l) => depth(l) === best);
  return cands.find((l) => /tool0|tcp|ee|eef|end_effector|flange|tool/i.test(l)) || cands.sort((a, b) => a.length - b.length)[0];
}

// The work cell for this arm: sceneObjects() scaled to its reach, each object pushed away from the robot until it is at
// least 10 % of the reach clear of the arm at its home and ready poses (the time parameterization blends corners, so a
// plan that starts right next to an obstacle could be cut into it).
export function placeScene(mm, spec) {
  const { K, G, spheres, acm, reach } = mm;
  const CM = new CollisionModel(K, spheres, { acm: new Set(acm.map((x) => `${x.link1}|${x.link2}`)), group: G });
  const poses = [spec.home, spec.ready].filter(Boolean).map((v) => G.values(G.clamp(G.joints.map((_, i) => v[i] ?? 0))));
  const objs = sceneObjects(reach);
  for (const o of objs) {
    const dir = Math.hypot(o.xyz[0], o.xyz[1]) > 1e-6 ? [o.xyz[0] / Math.hypot(o.xyz[0], o.xyz[1]), o.xyz[1] / Math.hypot(o.xyz[0], o.xyz[1])] : [1, 0];
    for (let k = 0; k < 40; k++) {
      CM.setObjects([{ id: o.id, type: o.type, dims: o.dims, pose: fromRPY(o.xyz, [0, 0, 0]) }]);
      const clear = Math.min(...poses.map((v) => Math.min(...CM.clearances(v).slice(0, CM.moving.reduce((s, l) => s + (CM.spheres[l] || []).length, 0)))));
      if (!(clear < 0.1 * reach)) break;
      o.xyz = [o.xyz[0] + dir[0] * 0.03 * reach, o.xyz[1] + dir[1] * 0.03 * reach, o.xyz[2]];
    }
    o.xyz = o.xyz.map((x) => Math.round(x * 1e4) / 1e4);
  }
  return objs;
}
