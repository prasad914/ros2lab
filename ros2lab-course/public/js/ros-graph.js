import { parseRvizYaml, rvizDisplays } from "./rviz-yaml.js";
import { rcMethods, parseCtrlMsg } from "./ros-control-graph.js";
import { moveitMethods } from "./ros-moveit.js";
import { gzMethods, GZ_EXES, GZ_NAMES, GZ_PKG_EXES, TELEOP_BANNER, gzIncludePy, gzIncludeXml, gzArgv, nodeArgsPy, takeExpr, pyEval as pyEvalVar } from "./ros-gz.js";
import { urdfGazebo } from "./gz-sdf.js";
import { xacro as runXacro, parseURDF, urdfEdges, checkUrdfText, graphviz, jointValue } from "./urdf-core.js";
// A pretend running ROS 2 system for the practice terminal: nodes, topics, services,
// parameters, actions, bags and workspace packages. Outputs follow the official ROS 2 Jazzy tutorials.
// Used by terminal-sim.js when a lesson's terminal block has "running": [...] (or "graph": true).

const HOME = "/home/student";
const fnum = (n) => (Number.isInteger(n) ? `${n}.0` : String(+n.toFixed(6)));
const hex = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const IFACES = {
  "geometry_msgs/msg/Point": "# This contains the position of a point in free space\nfloat64 x\nfloat64 y\nfloat64 z",
  "sensor_msgs/msg/JointState": "# This is a message that holds data to describe the state of a set of torque controlled joints.\n\nstd_msgs/Header header\n\nstring[] name\nfloat64[] position\nfloat64[] velocity\nfloat64[] effort",
  "nav_msgs/msg/Odometry": "# This represents an estimate of a position and velocity in free space.\n\nstd_msgs/Header header\nstring child_frame_id\ngeometry_msgs/PoseWithCovariance pose\ngeometry_msgs/TwistWithCovariance twist",
  "std_srvs/srv/SetBool": "bool data # e.g. for hardware enabling / disabling\n---\nbool success   # indicate successful run of triggered service\nstring message # informational, e.g. for error messages",
  "std_srvs/srv/Trigger": "---\nbool success   # indicate successful run of triggered service\nstring message # informational, e.g. for error messages",
  "geometry_msgs/msg/Twist": "# This expresses velocity in free space broken into its linear and angular parts.\n\nVector3  linear\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z\nVector3  angular\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z",
  "turtlesim/msg/Pose": "float32 x\nfloat32 y\nfloat32 theta\n\nfloat32 linear_velocity\nfloat32 angular_velocity",
  "turtlesim/msg/Color": "uint8 r\nuint8 g\nuint8 b",
  "std_msgs/msg/String": "# This was originally provided as an example message.\n# It is deprecated as of Foxy\n# It is recommended to create your own semantically meaningful message.\n# However if you would like to continue using this please use the equivalent in example_msgs.\n\nstring data",
  "turtlesim/srv/Spawn": "float32 x\nfloat32 y\nfloat32 theta\nstring name # Optional.  A unique name will be created and returned if this is empty\n---\nstring name",
  "turtlesim/srv/Kill": "string name\n---",
  "turtlesim/srv/SetPen": "uint8 r\nuint8 g\nuint8 b\nuint8 width\nuint8 off\n---",
  "turtlesim/srv/TeleportAbsolute": "float32 x\nfloat32 y\nfloat32 theta\n---",
  "turtlesim/srv/TeleportRelative": "float32 linear\nfloat32 angular\n---",
  "std_srvs/srv/Empty": "---",
  "std_msgs/msg/Float64": "float64 data",
  "geometry_msgs/msg/TwistStamped": "# A twist with reference coordinate frame and timestamp\n\nstd_msgs/Header header\n\tbuiltin_interfaces/Time stamp\n\t\tint32 sec\n\t\tuint32 nanosec\n\tstring frame_id\nTwist twist\n\tVector3  linear\n\t\tfloat64 x\n\t\tfloat64 y\n\t\tfloat64 z\n\tVector3  angular\n\t\tfloat64 x\n\t\tfloat64 y\n\t\tfloat64 z",
  "std_msgs/msg/Float64MultiArray": "# Please look at the MultiArrayLayout message definition for\n# documentation on all multiarrays.\n\nMultiArrayLayout  layout        # specification of data layout\n\tMultiArrayDimension[] dim\n\tuint32 data_offset\nfloat64[]         data          # array of data",
  "trajectory_msgs/msg/JointTrajectory": "# The header is used to specify the coordinate frame and the reference time for\n# the trajectory durations\nstd_msgs/Header header\n\n# The names of the active joints in each trajectory point. These names are\n# ordered and must correspond to the values in each trajectory point.\nstring[] joint_names\n\n# Array of trajectory points, which describe the positions, velocities,\n# accelerations and/or efforts of the joints at each time point.\nJointTrajectoryPoint[] points\n\tfloat64[] positions\n\tfloat64[] velocities\n\tfloat64[] accelerations\n\tfloat64[] effort\n\tbuiltin_interfaces/Duration time_from_start",
  "control_msgs/action/FollowJointTrajectory": "# The trajectory for all revolute, continuous or prismatic joints\ntrajectory_msgs/JointTrajectory trajectory\n...\n---\nint32 error_code\nstring error_string\n---\nstd_msgs/Header header\nstring[] joint_names\ntrajectory_msgs/JointTrajectoryPoint desired\ntrajectory_msgs/JointTrajectoryPoint actual\ntrajectory_msgs/JointTrajectoryPoint error",
  "example_interfaces/srv/AddTwoInts": "int64 a\nint64 b\n---\nint64 sum",
  "turtlesim/action/RotateAbsolute": "# The desired heading in radians\nfloat32 theta\n---\n# The angular displacement in radians to the starting position\nfloat32 delta\n---\n# The remaining rotation in radians\nfloat32 remaining",
  "geometry_msgs/msg/PoseStamped": "# A Pose with reference coordinate frame and timestamp\n\nstd_msgs/Header header\n\tbuiltin_interfaces/Time stamp\n\t\tint32 sec\n\t\tuint32 nanosec\n\tstring frame_id\nPose pose\n\tPoint position\n\t\tfloat64 x\n\t\tfloat64 y\n\t\tfloat64 z\n\tQuaternion orientation\n\t\tfloat64 x 0\n\t\tfloat64 y 0\n\t\tfloat64 z 0\n\t\tfloat64 w 1",
  "geometry_msgs/msg/Pose": "# A representation of pose in free space, composed of position and orientation.\n\nPoint position\n\tfloat64 x\n\tfloat64 y\n\tfloat64 z\nQuaternion orientation\n\tfloat64 x 0\n\tfloat64 y 0\n\tfloat64 z 0\n\tfloat64 w 1",
  "control_msgs/msg/JointJog": "# Used in time-stamping the message.\nstd_msgs/Header header\n\n# Name list of the joints. You don't need to specify all joint of the\n# robot. Joint names are case-sensitive.\nstring[] joint_names\n\n# A position command to the joints relative to the current position.\n# The units depend on the type of joint.\nfloat64[] displacements\n\n# A velocity command to the joints. The units depend on the type of joint.\nfloat64[] velocities\n\n# The desired time duration to make the movement.\nfloat64 duration",
  "moveit_msgs/srv/ServoCommandType": "# The different types of commands that MoveIt Servo accepts.\nint8 JOINT_JOG = 0\nint8 TWIST = 1\nint8 POSE = 2\n\nint8 command_type\n---\nbool success",
  "moveit_msgs/action/MoveGroup": "# Motion planning request to pass to planner\nMotionPlanRequest request\n\n# Planning options\nPlanningOptions planning_options\n---\n# An error code reflecting what went wrong\nMoveItErrorCodes error_code\n...\n---\n# The internal state that the move group action currently is in\nstring state",
  "rcl_interfaces/msg/Log": "##\n## Severity level constants\n##\nuint8 DEBUG=10\nuint8 INFO=20\nuint8 WARN=30\nuint8 ERROR=40\nuint8 FATAL=50\n\nbuiltin_interfaces/Time stamp\nuint8 level\nstring name\nstring msg\nstring file\nstring function\nuint32 line",
};
const PARAM_SRVS = [["describe_parameters", "rcl_interfaces/srv/DescribeParameters"], ["get_parameter_types", "rcl_interfaces/srv/GetParameterTypes"], ["get_parameters", "rcl_interfaces/srv/GetParameters"],
  ["get_type_description", "type_description_interfaces/srv/GetTypeDescription"],   // every Jazzy node offers this one too
  ["list_parameters", "rcl_interfaces/srv/ListParameters"], ["set_parameters", "rcl_interfaces/srv/SetParameters"], ["set_parameters_atomically", "rcl_interfaces/srv/SetParametersAtomically"]];
const QOS = ["qos_overrides./parameter_events.publisher.depth", "qos_overrides./parameter_events.publisher.durability",
  "qos_overrides./parameter_events.publisher.history", "qos_overrides./parameter_events.publisher.reliability"];

// package + executable -> kind of node it starts
const EXES = {
  "chiku_arm ik_node": "arm", "tf2_ros static_transform_publisher": "static_tf", "robot_state_publisher robot_state_publisher": "rsp", "joint_state_publisher joint_state_publisher": "jsp", "joint_state_publisher_gui joint_state_publisher_gui": "jsp_gui", "rviz2 rviz2": "rviz", "rclcpp_components component_container": "container", "chiku_base diffbot": "diffbot", "chiku_mm planner": "mm",
  "turtlesim turtlesim_node": "turtlesim", "turtlesim turtle_teleop_key": "teleop",
  "demo_nodes_py talker": "talker", "demo_nodes_cpp talker": "talker", "demo_nodes_py listener": "listener", "demo_nodes_cpp listener": "listener",
  "demo_nodes_py add_two_ints_server": "adder", "demo_nodes_cpp add_two_ints_server": "adder",
  "turtlesim mimic": "mimic",
  ...GZ_EXES,
  "controller_manager spawner": "spawner", "controller_manager unspawner": "unspawner",
};
const DEFAULT_NAME = { turtlesim: "turtlesim", teleop: "teleop_turtle", talker: "talker", listener: "listener", adder: "add_two_ints_server", mimic: "mimic", arm: "ik_node", diffbot: "diffbot", mm: "mm_planner", container: "ComponentManager", static_tf: "static_transform_publisher", rsp: "robot_state_publisher", jsp: "joint_state_publisher", jsp_gui: "joint_state_publisher_gui", rviz: "rviz2", spawner: "spawner", unspawner: "unspawner", ...GZ_NAMES };
const PKG_EXES = {
  turtlesim: ["draw_square", "mimic", "turtle_teleop_key", "turtlesim_node"],
  demo_nodes_py: ["add_two_ints_client", "add_two_ints_server", "listener", "listener_qos", "talker", "talker_qos"],
  demo_nodes_cpp: ["add_two_ints_client", "add_two_ints_server", "listener", "talker"],
  chiku_arm: ["ik_node"], chiku_base: ["diffbot"], chiku_mm: ["planner"], tf2_ros: ["buffer_server", "static_transform_publisher", "tf2_echo", "tf2_monitor"], robot_state_publisher: ["robot_state_publisher"], joint_state_publisher: ["joint_state_publisher"], joint_state_publisher_gui: ["joint_state_publisher_gui"], rviz2: ["rviz2"], tf2_tools: ["view_frames"], rclcpp_components: ["component_container", "component_container_isolated", "component_container_mt"],
  ...GZ_PKG_EXES,
  controller_manager: ["hardware_spawner", "ros2_control_node", "spawner", "unspawner"],
};

const PEN = () => ({ r: 179, g: 184, b: 255, width: 3, off: 0 });
const newTurtle = (name, x, y, theta) => ({ name, x, y, theta, pen: PEN(), trail: [] });

export class RosGraph {
  constructor(sh, running = []) {
    this.sh = sh;
    this.nodes = [];
    this.bags = {};
    this.lastTwist = null;
    for (const r of running) {
      const kind = typeof r === "string" ? r : r.kind;
      this.add(kind, typeof r === "object" && r.name ? r.name : DEFAULT_NAME[kind], typeof r === "object" && r.ns ? r.ns : "");
    }
  }
  out(t, c) { return this.sh.out(t, c); } err(t) { return this.sh.err(t); } hint(t) { return this.sh.hint(t); }
  lines(text, cls) { return String(text).split("\n").map((t) => this.out(t, cls)); }

  add(kind, name, ns = "", params = {}, remaps = [], dup = false) {
    const n = { kind, name, ns: ns && ns !== "/" ? "/" + ns.replace(/^\/+|\/+$/g, "") : "", params: {}, remaps };
    n.full = `${n.ns}/${name}`;
    const env = (this.sh && this.sh.env) || {};
    n.domain = String(env.ROS_DOMAIN_ID || "0"); n.rmw = env.RMW_IMPLEMENTATION || "rmw_fastrtps_cpp";   // the terminal it started in
    if (kind === "turtlesim") { n.turtles = [newTurtle("turtle1", 5.544445, 5.544445, 0)]; n.params = { background_b: 255, background_g: 86, background_r: 69, holonomic: false }; }
    if (kind === "teleop") n.params = { scale_angular: 2.0, scale_linear: 2.0 };
    if (kind === "teleop_twist") n.params = { stamped: false, frame_id: "", repeat_rate: 0.0, key_timeout: 0.0, speed: 0.5, turn: 1.0 };
    if (kind === "arm") { n.params = { link1_length: 1.0, link2_length: 0.8, elbow_up: false }; n.ptypes = { link1_length: "double", link2_length: "double" }; n.q = [0, 0]; n.target = null; }
    if (kind === "diffbot") { n.params = { wheel_radius: 0.05, wheel_separation: 0.3 }; n.ptypes = { wheel_radius: "double", wheel_separation: "double" }; n.base = { x: 0, y: 0, theta: 0, v: 0, w: 0 }; n.wheels = [0, 0]; n.path = [[0, 0]]; }
    if (kind === "mm") { n.params = { approach_ratio: 0.7 }; n.ptypes = { approach_ratio: "double" }; }
    if (kind === "turtlesim" || kind === "teleop") QOS.forEach((q, i) => { n.params[q] = [1000, "volatile", "keep_last", "reliable"][i]; });
    n.params.start_type_description_service = true;   // every Jazzy node has these two
    n.params.use_sim_time = false;
    for (const [k, v] of Object.entries(params)) if (k in n.params || kind === "custom" || (kind === "rsp" && k === "robot_description")) n.params[k] = v;
    if (!dup) this.nodes = this.nodes.filter((x) => x.full !== n.full);
    this.nodes.push(n);
    return n;
  }
  // DDS discovery: a terminal sees the nodes of its own ROS_DOMAIN_ID only (and none with ROS_AUTOMATIC_DISCOVERY_RANGE=OFF
  // unless they are its own). DDS middlewares (Fast DDS, Cyclone DDS) share one DDS graph on a domain, as in the ROS 2 docs'
  // "Working with multiple RMW implementations"; Zenoh is not DDS, so rmw_zenoh_cpp nodes only see rmw_zenoh_cpp nodes.
  domain() { return String((this.sh.env && this.sh.env.ROS_DOMAIN_ID) || "0"); }
  rmw() { return (this.sh.env && this.sh.env.RMW_IMPLEMENTATION) || "rmw_fastrtps_cpp"; }
  unseen(n) {
    if (n.hidden) return true;
    if ((n.domain || "0") !== this.domain()) return true;
    const fam = (r) => (/zenoh/.test(r) ? "zenoh" : "dds");
    return fam(n.rmw || "rmw_fastrtps_cpp") !== fam(this.rmw());
  }
  node(full) { return this.nodes.find((n) => n.full === full || n.full === "/" + full); }
  has(full) { return !!this.node(full); }
  turtle(name) { for (const n of this.nodes) for (const t of n.turtles || []) if (`${n.ns}/${t.name}` === name || t.name === name) return { n, t }; return null; }

  // ---------- the ROS graph, computed from the running nodes ----------
  endpoints(n) {
    const p = (s) => `${n.ns}/${s}`;
    const e = { pubs: [["/parameter_events", "rcl_interfaces/msg/ParameterEvent"], ["/rosout", "rcl_interfaces/msg/Log"]], subs: [["/parameter_events", "rcl_interfaces/msg/ParameterEvent"]],
      srvs: PARAM_SRVS.map(([s, t]) => [`${n.full}/${s}`, t]), cli: [], acts: [], actc: [] };
    if (n.info) { const r = (x) => (x.startsWith("/") ? x : x.startsWith("~/") ? `${n.full}/${x.slice(2)}` : p(x)); for (const k of ["pubs", "subs", "srvs", "cli", "acts", "actc"]) for (const [nm, t] of n.info[k]) e[k].push([r(nm), t]); }
    if (n.kind === "arm") { e.subs.push([p("target_point"), "geometry_msgs/msg/Point"]); e.pubs.push([p("joint_states"), "sensor_msgs/msg/JointState"], [p("end_effector"), "geometry_msgs/msg/Point"]); e.srvs.push([p("arm/home"), "std_srvs/srv/Trigger"]); }
    if (n.kind === "diffbot") { e.subs.push([p("cmd_vel"), "geometry_msgs/msg/Twist"]); e.pubs.push([p("odom"), "nav_msgs/msg/Odometry"], [p("ground_truth"), "nav_msgs/msg/Odometry"], [p("wheel_states"), "sensor_msgs/msg/JointState"], ["/tf", "tf2_msgs/msg/TFMessage"]); }
    if (n.kind === "mm") { e.subs.push([p("goal_point"), "geometry_msgs/msg/Point"]); e.pubs.push([p("cmd_vel"), "geometry_msgs/msg/Twist"], [p("target_point"), "geometry_msgs/msg/Point"]); }
    if (n.kind === "turtlesim") {
      e.srvs.push([p("clear"), "std_srvs/srv/Empty"], [p("kill"), "turtlesim/srv/Kill"], [p("reset"), "std_srvs/srv/Empty"], [p("spawn"), "turtlesim/srv/Spawn"]);
      for (const t of n.turtles) {
        e.subs.push([p(`${t.name}/cmd_vel`), "geometry_msgs/msg/Twist"]);
        e.pubs.push([p(`${t.name}/color_sensor`), "turtlesim/msg/Color"], [p(`${t.name}/pose`), "turtlesim/msg/Pose"]);
        e.srvs.push([p(`${t.name}/set_pen`), "turtlesim/srv/SetPen"], [p(`${t.name}/teleport_absolute`), "turtlesim/srv/TeleportAbsolute"], [p(`${t.name}/teleport_relative`), "turtlesim/srv/TeleportRelative"]);
        e.acts.push([p(`${t.name}/rotate_absolute`), "turtlesim/action/RotateAbsolute"]);
      }
    }
    if (n.kind === "teleop") { e.pubs.push([p("turtle1/cmd_vel"), "geometry_msgs/msg/Twist"]); e.actc.push([p("turtle1/rotate_absolute"), "turtlesim/action/RotateAbsolute"]); }
    if (n.kind === "talker") e.pubs.push([p("chatter"), "std_msgs/msg/String"]);
    if (n.kind === "listener") e.subs.push([p("chatter"), "std_msgs/msg/String"]);
    if (n.kind === "adder") e.srvs.push([p("add_two_ints"), "example_interfaces/srv/AddTwoInts"]);
    if (n.kind === "static_tf") e.pubs.push(["/tf_static", "tf2_msgs/msg/TFMessage"]);
    if (n.kind === "jsp" || n.kind === "jsp_gui") { e.pubs.push([p("joint_states"), "sensor_msgs/msg/JointState"]); e.subs.push([p("robot_description"), "std_msgs/msg/String"]); }
    if (n.kind === "rviz" && this.sh.viz && this.sh.viz.subsFn && this.sh.viz.subsFn()) { const seen = new Set(); for (const x of this.sh.viz.subsFn()) if (!seen.has(x[0])) { seen.add(x[0]); e.subs.push(x); } e.pubs.push(["/clicked_point", "geometry_msgs/msg/PointStamped"], ["/goal_pose", "geometry_msgs/msg/PoseStamped"], ["/initialpose", "geometry_msgs/msg/PoseWithCovarianceStamped"]); }
    else if (n.kind === "rviz") { e.subs.push(["/tf", "tf2_msgs/msg/TFMessage"], ["/tf_static", "tf2_msgs/msg/TFMessage"], ["/robot_description", "std_msgs/msg/String"]); if (this.sh.viz) { if (this.sh.viz.displays.Marker) e.subs.push(["/visualization_marker", "visualization_msgs/msg/Marker"]); if (this.sh.viz.displays.MarkerArray) e.subs.push(["/visualization_marker_array", "visualization_msgs/msg/MarkerArray"]); } e.pubs.push(["/clicked_point", "geometry_msgs/msg/PointStamped"], ["/goal_pose", "geometry_msgs/msg/PoseStamped"], ["/initialpose", "geometry_msgs/msg/PoseWithCovarianceStamped"]); }
    if (n.kind === "rsp") { e.subs.push([p("joint_states"), "sensor_msgs/msg/JointState"]); e.pubs.push(["/tf", "tf2_msgs/msg/TFMessage"], ["/tf_static", "tf2_msgs/msg/TFMessage"], [p("robot_description"), "std_msgs/msg/String"]); }
    if (n.kind === "container") e.srvs.push([`${n.full}/_container/load_node`, "composition_interfaces/srv/LoadNode"], [`${n.full}/_container/unload_node`, "composition_interfaces/srv/UnloadNode"], [`${n.full}/_container/list_nodes`, "composition_interfaces/srv/ListNodes"]);
    if (n.kind === "gz_bridge" || n.kind === "gz_image") for (const b of n.bridge || []) { if (b.broken) continue; if (b.dir !== "ROS_TO_GZ") e.pubs.push([b.ros, b.rosType]); if (b.dir !== "GZ_TO_ROS") e.subs.push([b.ros, b.rosType]); }
    if (n.kind === "pubcli" && n.pub) e.pubs.push([n.pub.topic, n.pub.type]);
    if (n.kind === "teleop_twist") e.pubs.push([p("cmd_vel"), n.params.stamped === true || n.params.stamped === "true" ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist"]);
    if ((n.kind === "cm" || n.kind === "ctrl") && n.cm) { const x = n.cm.endpointsFor(n.kind === "cm" ? null : n.ctrl); e.pubs.push(...x.pubs); e.subs.push(...x.subs); e.srvs.push(...x.srvs); e.acts.push(...x.acts); }
    if (n.kind === "mimic") { e.subs.push([p("input/pose"), "turtlesim/msg/Pose"]); e.pubs.push([p("output/cmd_vel"), "geometry_msgs/msg/Twist"]); }
    this.mgEndpoints(n, e);
    if (n.remaps && n.remaps.length) {
      const res = (x) => (x.startsWith("/") ? x : `${n.ns}/${x}`);
      for (const k of Object.keys(e)) e[k] = e[k].map(([nm, t]) => { const r = n.remaps.find(([f]) => res(f) === nm); return [r ? res(r[1]) : nm, t]; });
    }
    for (const k of Object.keys(e)) e[k].sort((a, b) => a[0].localeCompare(b[0]));
    return e;
  }
  collect(kinds) {
    const m = new Map();
    for (const n of this.nodes) { if (this.unseen(n)) continue; const e = this.endpoints(n); for (const k of kinds) for (const [name, type] of e[k]) { if (!m.has(name)) m.set(name, { type, by: { pubs: [], subs: [], srvs: [], cli: [], acts: [], actc: [] } }); m.get(name).by[k].push(n.full); } }
    return new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }
  topics() { const t = this.collect(["pubs", "subs"]); if (this.lastPub && !t.has(this.lastPub.topic)) t.set(this.lastPub.topic, { type: this.lastPub.type, by: { pubs: [], subs: [] } }); return t; }

  // ros2 doctor / ros2 doctor --report (ros2doctor, Jazzy)
  doctor(args) {
    const env = this.sh.env, rmw = this.rmw();
    if (!args.some((x) => x === "--report" || x === "-r")) {
      const warn = [];
      if (env.ROS_LOCALHOST_ONLY) warn.push("UserWarning: ROS_LOCALHOST_ONLY is deprecated but still honored if it is enabled. Use ROS_AUTOMATIC_DISCOVERY_RANGE and ROS_STATIC_PEERS instead.");
      return [...warn.map((w) => this.out(`/opt/ros/jazzy/lib/python3.12/site-packages/ros2doctor/api/network.py: ${w}`)), this.out(`All 5 checks passed`)];
    }
    const sec = (t, rows) => [this.out(""), this.out(`   ${t}`), ...rows.map(([k, v]) => this.out(`${k.padStart(28)} : ${v}`))];
    const T = this.topics();
    return [
      ...sec("NETWORK CONFIGURATION", [["inet", "127.0.0.1"], ["inet4", "['127.0.0.1']"], ["inet6", "['::1']"], ["netmask", "255.0.0.0"], ["device", "lo"], ["flags", "73<UP,LOOPBACK,RUNNING>"], ["mtu", "65536"], ["inet", "192.168.1.23"], ["device", "wlp2s0"], ["flags", "4163<UP,BROADCAST,RUNNING,MULTICAST>"], ["mtu", "1500"]]),
      ...sec("PACKAGE VERSIONS", [["rclpy", "required=7.1.5, local=7.1.5"], ["rclcpp", "required=28.1.10, local=28.1.10"], ["rmw_cyclonedds_cpp", "required=3.0.2, local=3.0.2"], ["rmw_fastrtps_cpp", "required=8.4.2, local=8.4.2"], ["moveit_ros_move_group", "required=2.12.3, local=2.12.3"], ["gz_ros2_control", "required=1.2.13, local=1.2.13"]]),
      ...sec("PLATFORM INFORMATION", [["system", "Linux"], ["platform info", "Linux-6.8.0-45-generic-x86_64-with-glibc2.39"], ["release", "6.8.0-45-generic"], ["processor", "x86_64"]]),
      ...sec("QOS COMPATIBILITY LIST", [["compatibility status", "No publisher/subscriber pairs found"]]),
      ...sec("RMW MIDDLEWARE", [["middleware name", rmw]]),
      ...sec("ROS 2 INFORMATION", [["distribution name", "jazzy"], ["distribution type", "ros2"], ["distribution status", "active"], ["release platforms", "{'debian': ['bookworm'], 'rhel': ['9'], 'ubuntu': ['noble']}"]]),
      ...sec("TOPIC LIST", T.size ? [...T.entries()].flatMap(([name, t]) => [["topic", name], ["publisher count", String(t.by.pubs.length)], ["subscriber count", String(t.by.subs.length)]]) : [["topic", "none"], ["publisher count", "0"], ["subscriber count", "0"]]),
      this.out(""), this.out(`   ENVIRONMENT`), ...["ROS_DOMAIN_ID", "RMW_IMPLEMENTATION", "ROS_AUTOMATIC_DISCOVERY_RANGE", "ROS_STATIC_PEERS", "CYCLONEDDS_URI", "FASTRTPS_DEFAULT_PROFILES_FILE"].filter((k) => env[k] !== undefined).map((k) => this.out(`${k.padStart(28)} : ${env[k]}`)),
    ];
  }

  // ---------- ros2 <sub> ... ----------
  run(args) {
    const [sub, a] = args;
    const rest = args.slice(2);
    switch (sub) {
      case "node": return this.cmdNode(a, rest);
      case "topic": return this.cmdTopic(a, rest);
      case "service": return this.cmdService(a, rest);
      case "param": return this.cmdParam(a, rest);
      case "action": return this.cmdAction(a, rest);
      case "interface": return this.cmdInterface(a, rest);
      case "bag": return this.cmdBag(a, rest);
      case "doctor": return this.doctor(args.slice(1));
      case "lifecycle": return this.cmdLifecycle(a, rest);
      case "component": return this.cmdComponent(a, rest);
      case "daemon": {
        if (a === "stop") { this.daemonOff = true; return [this.out("The daemon has been stopped")]; }
        if (a === "start") { const was = this.daemonOff; this.daemonOff = false; return [this.out(was ? "The daemon has been started" : "The daemon is already running")]; }
        if (a === "status") return [this.out(this.daemonOff ? "The daemon is not running" : "The daemon is running")];
        return [this.err("usage: ros2 daemon start | stop | status")];
      }
      default: return null;
    }
  }
  noNodes() {
    const other = this.nodes.filter((n) => !n.hidden && this.unseen(n));
    if (other.length) { const n = other[0]; return [this.hint(`(No nodes on this terminal's network. ${other.length} node${other.length > 1 ? "s run" : " runs"} with ROS_DOMAIN_ID=${n.domain} and RMW_IMPLEMENTATION=${n.rmw}, but this terminal has ROS_DOMAIN_ID=${this.domain()} and ${this.rmw()}: use the same values in every terminal, e.g. export ROS_DOMAIN_ID=${n.domain}${n.rmw !== "rmw_fastrtps_cpp" ? ` RMW_IMPLEMENTATION=${n.rmw}` : ""}. Put them in ~/.bashrc so every new terminal gets them.)`)]; }
    return [this.hint("(No nodes are running. Start one first, for example: ros2 run turtlesim turtlesim_node)")];
  }

  cmdNode(a, rest) {
    if (a === "list") return this.nodes.some((n) => !this.unseen(n)) ? (() => { const L = this.nodes.filter((n) => !this.unseen(n)).map((n) => n.full).sort(); return new Set(L).size < L.length ? ["WARNING: Be aware that there are nodes in the graph that share an exact name, which can have unintended side effects.", ...L] : L; })().map((t) => this.out(t)) : this.noNodes();
    if (a === "info") {
      const n = this.node(rest[0] || "");
      if (!rest[0]) return [this.err("usage: ros2 node info <node_name>")];
      if (!n) return [this.err(`Unable to find node '${rest[0]}'`), this.hint("Node names start with /. See them with: ros2 node list")];
      const e = this.endpoints(n);
      const sec = (title, list) => [this.out(`  ${title}:`), ...list.map(([x, t]) => this.out(`    ${x}: ${t}`))];
      return [this.out(n.full), ...sec("Subscribers", e.subs), ...sec("Publishers", e.pubs), ...sec("Service Servers", e.srvs), ...sec("Service Clients", e.cli), ...sec("Action Servers", e.acts), ...sec("Action Clients", e.actc)];
    }
    return [this.err("usage: ros2 node list | ros2 node info <node_name>")];
  }

  cmdTopic(a, rest) {
    const T = this.topics();
    const flags = rest.filter((x) => x.startsWith("-"));
    const pos = rest.filter((x) => !x.startsWith("-"));
    const showT = flags.includes("-t") || rest.includes("--show-types");
    if (a === "list") { const E = [...T.entries()]; if (!E.length) E.push(["/parameter_events", { type: "rcl_interfaces/msg/ParameterEvent" }], ["/rosout", { type: "rcl_interfaces/msg/Log" }]); return E.map(([k, v]) => this.out(showT ? `${k} [${v.type}]` : k)); }   // the ros2 CLI daemon itself publishes these two
    const name = pos[0];
    const need = () => (name ? null : [this.err(`usage: ros2 topic ${a} <topic_name>`)]);
    if (a === "find") { const hits = [...T.entries()].filter(([, v]) => v.type === name).map(([k]) => this.out(k)); return hits; }
    if (a === "pub") return this.topicPub(rest);
    const bad = need(); if (bad) return bad;
    const t = T.get(name);
    if (!t) return [this.out(`WARNING: topic [${name}] does not appear to be published yet`), this.hint(`Nobody uses ${name}. Check the spelling (names are case-sensitive) with: ros2 topic list`)];
    if (a === "type") return [this.out(t.type)];
    if (a === "info" && (flags.includes("-v") || flags.includes("--verbose"))) {
      const L = [`Type: ${t.type}`, "", `Publisher count: ${t.by.pubs.length}`, ""];
      const ep = (who, kind) => { const nm = who.split("/").pop(), ns = who.slice(0, who.length - nm.length - 1) || "/";
        L.push(`Node name: ${nm}`, `Node namespace: ${ns}`, `Topic type: ${t.type}`, "Topic type hash: RIHS01_…", `Endpoint type: ${kind}`, `GID: ${hex().match(/../g).slice(0, 16).join(".")}`,
          "QoS profile:", "  Reliability: RELIABLE", "  History (Depth): UNKNOWN", "  Durability: VOLATILE", "  Lifespan: Infinite", "  Deadline: Infinite", "  Liveliness: AUTOMATIC", "  Liveliness lease duration: Infinite", ""); };
      t.by.pubs.forEach((w) => ep(w, "PUBLISHER"));
      L.push(`Subscription count: ${t.by.subs.length}`, "");
      t.by.subs.forEach((w) => ep(w, "SUBSCRIPTION"));
      return L.map((x) => this.out(x));
    }
    if (a === "info") return [this.out(`Type: ${t.type}`), this.out(`Publisher count: ${t.by.pubs.length}`), this.out(`Subscription count: ${t.by.subs.length}`)];
    if (a === "hz") {
      if (!t.by.pubs.length) return [this.out(`WARNING: topic [${name}] does not appear to be published yet`)];
      const gr = this.gzRunning() && !this.gz.paused ? this.gzRate(name) || this.cmRate(name) : null;
      const rate = gr ? gr : /pose|color_sensor/.test(name) ? 62.5 : name.endsWith("chatter") ? 1 : null;
      if (!rate) return [this.hint(`(Nothing is published on ${name} right now, so there is no rate to measure.)`)];
      const lines = [0, 1].map((i) => `average rate: ${(rate + (i ? 0.004 : -0.002)).toFixed(3)}\n\tmin: ${(1 / rate - 0.001).toFixed(3)}s max: ${(1 / rate + 0.001).toFixed(3)}s std dev: 0.00041s window: ${Math.round(rate * (i + 1))}`).join("\n");
      return [...this.lines(lines), this.out("^C"), this.hint(`About ${rate} messages per second. On a real computer it keeps measuring until you press Ctrl+C.`)];
    }
    if (a === "echo") {
      const once = rest.includes("--once");
      let msgs = this.samples(name, t);
      const fi = rest.indexOf("--field");
      if (msgs && fi >= 0 && rest[fi + 1]) {   // --field a.b.c: only that part of each message
        const path = rest[fi + 1].split(".");
        const pick = (txt) => {
          let lines = String(txt).split("\n");
          for (const key of path) {
            const i = lines.findIndex((l) => l.startsWith(key + ":"));
            if (i < 0) return null;
            const head = lines[i].slice(key.length + 1).trim();
            if (head) return [head];
            const body = []; for (let j = i + 1; j < lines.length && (lines[j].startsWith(" ") || lines[j].startsWith("- ")); j++) body.push(lines[j]);
            const ind = Math.min(...body.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
            lines = body.map((l) => l.slice(Number.isFinite(ind) ? ind : 0));
          }
          return lines;
        };
        const got = msgs.map((m) => pick(m));
        if (got.some((g) => !g)) return [this.err(`Invalid field '${rest[fi + 1]}': '${t.type}' has no field like that. See the fields with: ros2 interface show ${t.type}`)];
        msgs = got.map((g) => g.join("\n"));
      }
      if (!msgs) return [this.hint(`(Nobody is publishing on ${name} right now, so echo just waits. ${name.endsWith("cmd_vel") ? "Drive the turtle: press arrow keys in the teleop window, or publish with ros2 topic pub." : ""})`), this.out("^C")];
      const n = once ? 1 : msgs.length;
      return [...msgs.slice(0, n).flatMap((m) => this.lines(m + "\n---")), ...(once ? [] : [this.out("^C"), this.hint("Practice terminal stopped echo for you. On a real computer it keeps printing until you press Ctrl+C.")])];
    }
    return [this.err(`ros2 topic: unknown command '${a}'`), this.hint("Try: list, echo, info, type, hz, pub, find")];
  }
  samples(name, t) {
    if (t.type === "turtlesim/msg/Pose") { const hit = this.turtle(name.replace(/\/pose$/, "")); if (!hit) return null; const p = hit.t; return [0, 1, 2].map(() => `x: ${fnum(p.x)}\ny: ${fnum(p.y)}\ntheta: ${fnum(p.theta)}\nlinear_velocity: 0.0\nangular_velocity: 0.0`); }
    if (t.type === "turtlesim/msg/Color") { const hit = this.turtle(name.replace(/\/color_sensor$/, "")); const P = hit ? hit.n.params : { background_r: 69, background_g: 86, background_b: 255 }; return [0, 1, 2].map(() => `r: ${P.background_r}\ng: ${P.background_g}\nb: ${P.background_b}`); }
    const cms = this.gzRunning() ? this.cmSample(name) : null; if (cms) return cms;
    const gzs = this.gzRunning() ? this.gzSample(name) : null; if (gzs) return gzs;
    const ur = this.urdfSample(name, t); if (ur) return ur;
    if (t.type === "std_msgs/msg/String" && t.by.pubs.length) { this.chat = (this.chat || 0) + 3; return [3, 2, 1].map((k) => `data: 'Hello World: ${this.chat - k}'`); }
    if (t.type === "geometry_msgs/msg/Twist" && this.lastTwist && this.lastTwist.topic === name) { const v = this.lastTwist; return [0, 1, 2].map(() => `linear:\n  x: ${fnum(v.lx)}\n  y: 0.0\n  z: 0.0\nangular:\n  x: 0.0\n  y: 0.0\n  z: ${fnum(v.az)}`); }
    if (t.type === "geometry_msgs/msg/Twist") {      // a student node driving a turtle: show what it sends right now
      const n = this.nodes.find((x) => x.kind === "custom" && x.info && this.endpoints(x).pubs.some(([nm]) => nm === name));
      const I = n && n.info;
      const v = !I ? null : I.twist ? I.twist : I.paramTwist ? { lx: Number(n.params[I.paramTwist.lx]) || 0, az: I.paramTwist.az ? Number(n.params[I.paramTwist.az]) || 0 : 0 }
        : I.switchTwist ? (n.flags && n.flags[I.setbool.flag] ? I.switchTwist : { lx: 0, az: 0 }) : null;
      if (v) { const f = (x) => (I.lang === "cpp" ? fnum(x) : fnum(x)); return [0, 1, 2].map(() => `linear:\n  x: ${f(v.lx)}\n  y: 0.0\n  z: 0.0\nangular:\n  x: 0.0\n  y: 0.0\n  z: ${f(v.az)}`); }
    }
    const kin = this.kinSample(name, t); if (kin) return kin;
    const cus = this.customSample(name, t); if (cus) return cus;
    if (name === "/rosout" && this.nodes.length) return [`stamp:\n  sec: 1727860000\n  nanosec: 0\nlevel: 20\nname: ${this.nodes[0].name}\nmsg: Starting ${this.nodes[0].name}`];
    return null;
  }
  num(yaml, key, dflt = 0) { const m = String(yaml).match(new RegExp(`(?:^|[{,\\s])${key}:\\s*(-?[\\d.]+(?:e-?\\d+)?)`)); return m ? Number(m[1]) : dflt; }
  str(yaml, key) { const m = String(yaml).match(new RegExp(`${key}:\\s*['"]?([^'",}]*)['"]?`)); return m ? m[1].trim() : ""; }

  topicPub(rest) {
    const once = rest.some((x) => x === "--once" || x === "-1");
    const pos = [];
    for (let i = 0; i < rest.length; i++) { const x = rest[i]; if (/^(-r|--rate|-t|--times|-w|--wait-matching-subscriptions)$/.test(x)) { i++; continue; } if (!x.startsWith("-")) pos.push(x); }
    const [topic, type, yaml = "{}"] = pos;
    if (!topic || !type) return [this.err("usage: ros2 topic pub <topic_name> <message_type> '<values>'")];
    const full = type.includes("/msg/") ? type : type.replace("/", "/msg/");
    if (!IFACES[full] || !/msg/.test(full)) return [this.err(`The passed message type is invalid`), this.hint("Message types look like geometry_msgs/msg/Twist or std_msgs/msg/String.")];
    const T = this.topics().get(topic);
    if (T && T.type !== full && (T.by.pubs.length || T.by.subs.length)) return [this.err(`Error: topic ${topic} has type ${T.type}, not ${full}`), this.hint(`Check the type with: ros2 topic type ${topic}`)];
    this.lastPub = { topic, type: full };
    let repr = "", relayNote = null;
    const mv = ["geometry_msgs/msg/TwistStamped", "geometry_msgs/msg/PoseStamped", "control_msgs/msg/JointJog"].includes(full) ? this.moveitTopic(topic, full, yaml, once) : null;
    if (mv) {
      const ri = rest.findIndex((x) => x === "-r" || x === "--rate"), rate = ri >= 0 ? Number(rest[ri + 1]) || 1 : 1;
      const L = [this.out("publisher: beginning loop"), this.out(`publishing #1: ${full.replace(/\//g, ".")}(...)`), this.out("")];
      if (mv.servo && !once) {   // a stream to servo_node keeps running until Ctrl+C
        const pn = this.add("pubcli", `_ros2cli_${4300 + Math.floor(Math.random() * 900)}`, "", {}); pn.hidden = true;
        pn.pub = { topic, type: full, msg: mv.msg, rate, servo: mv.servo }; this.lastStarted = [pn.full];
        L.push(this.hint(`(${mv.note} Practice terminal: this keeps publishing ${rate} time${rate === 1 ? "" : "s"} per second until Ctrl+C, like on Ubuntu.)`));
        return L;
      }
      if (!once) L.push(this.out(`publishing #2: ${full.replace(/\//g, ".")}(...)`), this.out(""), this.out("^C"));
      L.push(this.hint(`(${mv.note})`));
      return L;
    }
    if (full === "geometry_msgs/msg/Twist") {
      const lin = (String(yaml).match(/linear:\s*\{([^}]*)\}/) || [, ""])[1], ang = (String(yaml).match(/angular:\s*\{([^}]*)\}/) || [, ""])[1];
      const v = { lx: this.num(lin, "x"), ly: this.num(lin, "y"), az: this.num(ang, "z"), topic };
      this.lastTwist = v;
      repr = `geometry_msgs.msg.Twist(linear=geometry_msgs.msg.Vector3(x=${fnum(v.lx)}, y=${fnum(v.ly)}, z=0.0), angular=geometry_msgs.msg.Vector3(x=0.0, y=0.0, z=${fnum(v.az)}))`;
      const hit = this.turtle(topic.replace(/\/cmd_vel$/, ""));
      if (hit && topic.endsWith("/cmd_vel")) this.move(hit.t, v.lx, v.az, once ? 1 : 3);
      for (const n of this.nodes.filter((m) => m.kind === "custom" && this.subscribes(m, topic, "Twist") && this.endpoints(m).pubs.some(([nm]) => nm.endsWith("/wheel_commands")))) {
        const R = typeof n.params.wheel_radius === "number" ? n.params.wheel_radius : 0.05, L = typeof n.params.wheel_separation === "number" ? n.params.wheel_separation : 0.3, mx = typeof n.params.max_wheel_speed === "number" ? n.params.max_wheel_speed : 20;
        let l = (v.lx - v.az * L / 2) / R, r = (v.lx + v.az * L / 2) / R; const big = Math.max(Math.abs(l), Math.abs(r));
        if (big > mx) { l *= mx / big; r *= mx / big; this.note(n, `[WARN] [${n.name}]: wheel speed limited`); }
        n.wcmd = [l, r];
      }
      const relayed = this.relayTwist(topic, v, once ? 1 : 3);
      if (relayed) { relayNote = `(Your ${relayed.n.name} node passed the command on${relayed.lx !== v.lx ? `, limited to linear.x=${fnum(relayed.lx)}` : ""}${relayed.stopped ? ", and stopped the turtle near the wall" : ""}. ${relayed.hit.t.name} is now at x=${relayed.hit.t.x.toFixed(2)}, y=${relayed.hit.t.y.toFixed(2)}.)`; }
      const listens = this.nodes.some((m) => m.kind === "custom" && this.subscribes(m, topic, "Twist") && !/\/turtle\d*\//.test(topic));
      const bot = this.nodes.find((n) => (n.kind === "diffbot" && `${n.ns}/cmd_vel` === topic) || (n.kind === "custom" && this.vkind(n) === "diffbot" && listens));
      if (bot) this.driveBot(bot, v.lx, v.az, once ? 1 : 3);
      const driven = this.gzTwist(topic, v);
      if (driven.length) relayNote = `(ros_gz_bridge passed the command to Gazebo, and the DiffDrive system of ${driven.join(", ")} now drives at ${fnum(v.lx)} m/s, ${fnum(v.az)} rad/s. Gazebo keeps using the last command: publish zeros to stop.${this.gz.paused ? " The simulation is paused: press ▶ in the Gazebo window." : ""})`;
      else if (this.gzRunning() && this.cmModels().some((m) => m.cm.hasActive("diff"))) relayNote = `(Nothing moves: this robot is driven by ros2_control, and diff_drive_controller listens on ${this.cmModels().map((m) => [...m.cm.controllers.values()].filter((c) => c.kind === "diff").map((c) => m.cm.topicOf(c.name, "cmd_vel"))).flat().join(", ")} for geometry_msgs/msg/TwistStamped (ROS 2 Jazzy), not on ${topic} for Twist. Publish a TwistStamped there, or run teleop with: --ros-args -p stamped:=true -r cmd_vel:=/diff_drive_controller/cmd_vel)`;
      else if (this.gzRunning() && !this.bridges().some((b) => b.ros === topic && b.dir !== "GZ_TO_ROS")) relayNote = `(Gazebo is running, but no ROS->GZ bridge carries ${topic} into Gazebo, so the robot does not move. Bridge it: ${topic}@geometry_msgs/msg/Twist]gz.msgs.Twist)`;
    } else if (full === "geometry_msgs/msg/TwistStamped" || full === "std_msgs/msg/Float64MultiArray" || full === "trajectory_msgs/msg/JointTrajectory") {
      const msg = parseCtrlMsg(full, yaml);
      if (full === "geometry_msgs/msg/TwistStamped") { const tw = msg.twist; repr = `geometry_msgs.msg.TwistStamped(header=std_msgs.msg.Header(stamp=builtin_interfaces.msg.Time(sec=0, nanosec=0), frame_id='${msg.frame || ""}'), twist=geometry_msgs.msg.Twist(linear=geometry_msgs.msg.Vector3(x=${fnum(tw.linear.x)}, y=${fnum(tw.linear.y)}, z=${fnum(tw.linear.z)}), angular=geometry_msgs.msg.Vector3(x=${fnum(tw.angular.x)}, y=${fnum(tw.angular.y)}, z=${fnum(tw.angular.z)})))`; }
      else if (full === "std_msgs/msg/Float64MultiArray") repr = `std_msgs.msg.Float64MultiArray(layout=std_msgs.msg.MultiArrayLayout(dim=[], data_offset=0), data=[${msg.data.map(fnum).join(", ")}])`;
      else repr = `trajectory_msgs.msg.JointTrajectory(header=std_msgs.msg.Header(stamp=builtin_interfaces.msg.Time(sec=0, nanosec=0), frame_id=''), joint_names=[${msg.joint_names.map((x) => `'${x}'`).join(", ")}], points=[${msg.points.map((pt) => `trajectory_msgs.msg.JointTrajectoryPoint(positions=[${pt.positions.map(fnum).join(", ")}], velocities=[], accelerations=[], effort=[], time_from_start=builtin_interfaces.msg.Duration(sec=${pt.time_from_start.sec}, nanosec=${pt.time_from_start.nanosec}))`).join(", ")}])`;
      const got = this.cmDeliver(topic, full, msg);
      const used = got.filter((g) => g.used), notes = got.filter((g) => g.note).map((g) => g.note);
      if (used.length) {
        const u = used[0], c = u.model.cm.controllers.get(u.controller);
        relayNote = c.kind === "diff" ? `(${u.controller} received it and turns the wheels of ${u.model.name}: ${fnum(msg.twist.linear.x)} m/s, ${fnum(msg.twist.angular.z)} rad/s. It stops again ${fnum(Number(c.params.cmd_vel_timeout) || 0.5)} s after the last command (cmd_vel_timeout), so keep publishing, e.g. ros2 topic pub --rate 10 ...${this.gz.paused ? " The simulation is paused: press ▶." : ""})`
          : c.kind === "jtc" ? `(${u.controller} accepted the trajectory: ${u.model.name} moves its joints over ${fnum(Math.max(...msg.points.map((pt) => pt.time_from_start.sec + pt.time_from_start.nanosec * 1e-9)))} s. Watch Gazebo and RViz.)`
          : `(${u.controller} sets the joints of ${u.model.name}. Watch Gazebo and RViz.)`;
      } else if (notes.length) relayNote = `(${notes[0]})`;
      else if (this.gzRunning() && this.cmModels().length) relayNote = `(Nothing subscribes to ${topic}. The controllers listen on: ${[...new Set(this.cmModels().flatMap((m) => m.cm.endpoints().subs.map((x) => `${x[0]} [${x[1].split("/").pop()}]`)))].join(", ") || "nothing yet: spawn the controllers first"}.)`;
    } else if (full === "sensor_msgs/msg/JointState") {
      const list = (k) => ((String(yaml).match(new RegExp(`${k}:\\s*\\[([^\\]]*)\\]`)) || [, ""])[1]).split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      const names = list("name"), pos = list("position").map(Number);
      repr = `sensor_msgs.msg.JointState(header=std_msgs.msg.Header(stamp=builtin_interfaces.msg.Time(sec=0, nanosec=0), frame_id=''), name=[${names.map((x) => `'${x}'`).join(", ")}], position=[${pos.map(fnum).join(", ")}], velocity=[], effort=[])`;
      const J = Object.fromEntries(names.map((nm, i) => [nm, pos[i]]));
      for (const n of this.nodes.filter((m) => this.vkind(m) === "fk" && this.subscribes(m, topic, "JointState"))) {
        if ("shoulder_joint" in J && "elbow_joint" in J) { n.fkq = [J.shoulder_joint, J.elbow_joint]; const l1 = typeof n.params.link1_length === "number" ? n.params.link1_length : 1, l2 = typeof n.params.link2_length === "number" ? n.params.link2_length : 0.8, e = fk2(l1, l2, n.fkq); this.note(n, `[INFO] [${n.name}]: tip at x=${e[0].toFixed(3)} y=${e[1].toFixed(3)}`); }
      }
    } else if (full === "std_msgs/msg/Float64") {
      const v = this.num(yaml, "data");
      repr = `std_msgs.msg.Float64(data=${fnum(v)})`;
      const hit = this.gzFloat(topic, v);
      if (hit.length) relayNote = `(ros_gz_bridge passed it to Gazebo: the JointPositionController moves ${hit.join(", ")} to ${fnum(v)} rad. Watch Gazebo and RViz.${this.gz.paused ? " The simulation is paused: press ▶." : ""})`;
    } else if (full === "geometry_msgs/msg/Point") {
      const P = { x: this.num(yaml, "x"), y: this.num(yaml, "y"), z: this.num(yaml, "z") };
      repr = `geometry_msgs.msg.Point(x=${fnum(P.x)}, y=${fnum(P.y)}, z=${fnum(P.z)})`;
      this.onPoint(topic, P);
    } else if (full === "std_msgs/msg/String") repr = `std_msgs.msg.String(data='${this.str(yaml, "data")}')`;
    else repr = `${full.replace(/\//g, ".")}()`;
    const L = [this.out("publisher: beginning loop")];
    const ri = rest.findIndex((x) => x === "-r" || x === "--rate"), rate = ri >= 0 ? Number(rest[ri + 1]) || 1 : 1;
    // a stream of commands to a ros2_control controller keeps running until Ctrl+C (the controller needs it: cmd_vel_timeout)
    if (!once && this.gzRunning() && this.cmModels().some((m) => [...m.cm.controllers.values()].some((c) => c.state === "active" && m.cm.endpoints(c.name).subs.some(([nm, ty]) => nm === topic && ty === full)))) {
      const pn = this.add("pubcli", `_ros2cli_${4300 + Math.floor(Math.random() * 900)}`, "", {}); pn.hidden = true;
      pn.pub = { topic, type: full, msg: parseCtrlMsg(full, yaml), rate };
      this.lastStarted = [pn.full];
      L.push(this.out(`publishing #1: ${repr}`), this.out(""));
      if (relayNote) L.push(this.hint(relayNote.replace(/, so keep publishing, e\.g\. ros2 topic pub --rate 10 \.\.\./, ". This publisher keeps it fed.")));
      L.push(this.hint(`(Practice terminal: this keeps publishing ${rate} time${rate === 1 ? "" : "s"} per second until you press Ctrl+C, like on Ubuntu.)`));
      return L;
    }
    for (let i = 1; i <= (once ? 1 : 3); i++) L.push(this.out(`publishing #${i}: ${repr}`), this.out(""));
    if (!once) L.push(this.out("^C"), this.hint(`Practice terminal stopped after 3 messages. On a real computer, ros2 topic pub keeps publishing ${rate} time${rate === 1 ? "" : "s"} per second until Ctrl+C. Use --once to send just one.`));
    const hit = this.turtle(topic.replace(/\/cmd_vel$/, ""));
    if (relayNote) L.push(this.hint(relayNote));
    if (hit) { const t = hit.t; L.push(this.hint(`(The turtle moved. ${t.name} is now at x=${t.x.toFixed(2)}, y=${t.y.toFixed(2)}, facing ${t.theta.toFixed(2)} rad. Check with: ros2 topic echo --once ${hit.n.ns}/${t.name}/pose)`)); }
    else if (T && !T.by.subs.length) L.push(this.hint(`(Nobody subscribes to ${topic}, so nobody hears these messages.)`));
    else if (!T) L.push(this.hint(`(${topic} is a brand-new topic that nobody listens to. Was that a typo?)`));
    return L;
  }
  // drawing: each segment remembers the pen it was drawn with
  draw(t, pts) {
    if (!t.pen || t.pen.off) return;
    t.trail = t.trail || [];
    t.trail.push({ pts, r: t.pen.r, g: t.pen.g, b: t.pen.b, width: t.pen.width || 3 });
    if (t.trail.length > 400) t.trail.shift();
    this.version = (this.version || 0) + 1;
  }
  move(t, v, w, secs) {
    const pts = [[t.x, t.y]];
    let hit = null;
    for (let s = 0; s < secs * 20; s++) {
      t.theta += w / 20; t.x += Math.cos(t.theta) * v / 20; t.y += Math.sin(t.theta) * v / 20;
      if (!hit && (t.x < 0 || t.y < 0 || t.x > 11.088889 || t.y > 11.088889)) hit = `[WARN] [turtlesim]: Oh no! I hit the wall! (Clamping from [x=${t.x.toFixed(6)}, y=${t.y.toFixed(6)}])`;
      t.x = Math.min(11.088889, Math.max(0, t.x)); t.y = Math.min(11.088889, Math.max(0, t.y));
      pts.push([t.x, t.y]);
    }
    if (hit) { const owner = this.nodes.find((n) => (n.turtles || []).includes(t)); (this.notices = this.notices || []).push({ node: owner ? owner.full : "", text: owner ? hit.replace("[turtlesim]", `[${owner.name}]`) : hit }); }
    if (v) this.draw(t, pts);
    this.version = (this.version || 0) + 1;
    t.x = +Math.min(11.088889, Math.max(0, t.x)).toFixed(6); t.y = +Math.min(11.088889, Math.max(0, t.y)).toFixed(6);
    t.theta = +Math.atan2(Math.sin(t.theta), Math.cos(t.theta)).toFixed(6);
  }

  cmdService(a, rest) {
    const S = this.collect(["srvs"]);
    const showT = rest.includes("-t") || rest.includes("--show-types");
    const pos = rest.filter((x) => !x.startsWith("-"));
    if (a === "list") return S.size ? [...S.entries()].map(([k, v]) => this.out(showT ? `${k} [${v.type}]` : k)) : this.noNodes();
    if (a === "find") return [...S.entries()].filter(([, v]) => v.type === pos[0]).map(([k]) => this.out(k));
    const name = pos[0];
    if (!name) return [this.err(`usage: ros2 service ${a || "list"} <service_name>`)];
    const s = S.get(name);
    if (a === "type") return s ? [this.out(s.type)] : [this.err(`Unable to find service '${name}'`)];
    if (a === "info") return s ? [this.out(`Type: ${s.type}`), this.out("Clients count: 0"), this.out(`Services count: ${s.by.srvs.length}`)] : [this.err(`Unable to find service '${name}'`)];
    if (a !== "call") return [this.err(`ros2 service: unknown command '${a}'`), this.hint("Try: list, type, find, info, call")];
    const type = pos[1], yaml = pos.slice(2).join(" ") || "{}";
    if (!type) return [this.err("usage: ros2 service call <service_name> <service_type> [values]"), this.hint(s ? `This service's type is ${s.type}` : "Find the type with: ros2 service type <service_name>")];
    if (!s) return [this.out("waiting for service to become available..."), this.out("^C"), this.hint(`Nobody offers ${name}, so the call waits forever. Check the name with: ros2 service list`)];
    if (s.type !== type) return [this.err(`The passed service type is invalid`), this.hint(`${name} has type ${s.type}`)];
    const owner = this.node(s.by.srvs[0]);
    const pyT = type.replace("/srv/", ".srv.").replace(/\//g, ".");
    const req = (fields) => `requester: making request: ${pyT}_Request(${fields})`;
    const res = (fields) => [this.out(""), this.out("response:"), this.out(`${pyT}_Response(${fields})`), this.out("")];
    if (owner && owner.kind === "servo") { const r = this.servoService(name, yaml, req, res); if (r) return r; }
    if (owner && owner.kind === "custom") return this.customService(owner, type, yaml, req, res);
    const base = name.split("/").pop();
    if (base === "spawn") {
      const x = this.num(yaml, "x"), y = this.num(yaml, "y"), th = this.num(yaml, "theta");
      let nm = this.str(yaml, "name");
      if (nm && owner.turtles.some((t) => t.name === nm)) return [this.out(req(`x=${fnum(x)}, y=${fnum(y)}, theta=${fnum(th)}, name='${nm}'`)), this.err(`[ERROR] [${owner.name}]: A turtle named [${nm}] already exists`)];
      if (!nm) { let k = 2; while (owner.turtles.some((t) => t.name === `turtle${k}`)) k++; nm = `turtle${k}`; }
      owner.turtles.push(newTurtle(nm, x, y, th));
      return [this.out(req(`x=${fnum(x)}, y=${fnum(y)}, theta=${fnum(th)}, name='${this.str(yaml, "name")}'`)), ...res(`name='${nm}'`), this.hint(`(A new turtle, ${nm}, appeared. It brings its own topics: see ros2 topic list)`)];
    }
    if (base === "kill") { const nm = this.str(yaml, "name"); const i = owner.turtles.findIndex((t) => t.name === nm); if (i < 0) return [this.out(req(`name='${nm}'`)), this.err(`[ERROR] [${owner.name}]: Tried to kill turtle [${nm}], which does not exist`)]; owner.turtles.splice(i, 1); return [this.out(req(`name='${nm}'`)), ...res("")]; }
    if (base === "reset") { owner.turtles = [newTurtle("turtle1", 5.544445, 5.544445, 0)]; return [this.out(req("")), ...res(""), this.hint("(Every turtle was removed and turtle1 was put back in the middle.)")]; }
    if (base === "clear") { owner.turtles.forEach((t) => { t.trail = []; }); this.version = (this.version || 0) + 1; return [this.out(req("")), ...res(""), this.hint("(The turtle's drawn lines were wiped away.)")]; }
    if (base === "home" && name.endsWith("arm/home")) { const arm = this.nodes.find((n) => n.kind === "arm"); if (arm) { arm.q = [0, 0]; arm.target = null; this.note(arm, `[INFO] [${arm.name}]: Going home: shoulder=0.0, elbow=0.0`); } return [this.out(req("")), ...res("success=True, message='Arm is at home (0, 0)'")]; }
    if (base === "add_two_ints") { const A = Math.trunc(this.num(yaml, "a")), B = Math.trunc(this.num(yaml, "b")); return [this.out(req(`a=${A}, b=${B}`)), ...res(`sum=${A + B}`)]; }
    if (base === "teleport_absolute") { const hit = this.turtle(name.replace(/\/teleport_absolute$/, "")); const x = this.num(yaml, "x"), y = this.num(yaml, "y"), th = this.num(yaml, "theta"); this.draw(hit.t, [[hit.t.x, hit.t.y], [x, y]]); Object.assign(hit.t, { x, y, theta: th }); return [this.out(req(`x=${fnum(x)}, y=${fnum(y)}, theta=${fnum(th)}`)), ...res("")]; }
    if (base === "set_pen") {
      const hit = this.turtle(name.replace(/\/set_pen$/, ""));
      if (hit) hit.t.pen = { r: Math.trunc(this.num(yaml, "r")), g: Math.trunc(this.num(yaml, "g")), b: Math.trunc(this.num(yaml, "b")), width: Math.trunc(this.num(yaml, "width", 3)) || 1, off: Math.trunc(this.num(yaml, "off")) };
      const f = ["r", "g", "b", "width", "off"].map((k) => `${k}=${Math.trunc(this.num(yaml, k))}`).join(", "); return [this.out(req(f)), ...res("")]; }
    if (base.endsWith("parameters") || base.endsWith("parameter_types")) return [this.hint("(Parameter services are easier to use through ros2 param list / get / set.)")];
    return [this.out(req("")), ...res("")];
  }

  cmdParam(a, rest) {
    const pos = rest.filter((x) => !x.startsWith("--"));
    const fmtVal = (v) => (Array.isArray(v) && v.some((x) => typeof x === "string") ? ["String array", `[${v.map((x) => `'${x}'`).join(", ")}]`] : Array.isArray(v) ? ["Double array", `array('d', [${v.map(fnum).join(", ")}])`] : typeof v === "boolean" ? ["Boolean", v ? "True" : "False"] : typeof v === "string" ? ["String", v] : Number.isInteger(v) ? ["Integer", v] : ["Double", fnum(v)]);
    if (a === "list") {
      const list = pos[0] ? [this.node(pos[0])].filter(Boolean) : this.nodes.slice().sort((x, y) => x.full.localeCompare(y.full));
      if (pos[0] && !list.length) return [this.err(`Node not found`)];
      if (!list.length) return this.noNodes();
      return list.flatMap((n) => [this.out(`${n.full}:`), ...Object.keys(n.params).sort().map((k) => this.out(`  ${k}`))]);
    }
    const n = this.node(pos[0] || "");
    if (!pos[0]) return [this.err(`usage: ros2 param ${a || "list"} <node_name> ...`)];
    if (!n) return [this.err("Node not found"), this.hint("See the running nodes with: ros2 node list")];
    if (a === "get") {
      if (!pos[1]) return [this.err("usage: ros2 param get <node_name> <parameter_name>")];
      if (!(pos[1] in n.params)) return [this.out("Parameter not set.")];
      const v = n.params[pos[1]], isD = typeof v === "number" && ((n.kind === "teleop" && pos[1].startsWith("scale")) || (n.ptypes && n.ptypes[pos[1]] === "double"));
      const [t, s] = isD ? ["Double", fnum(v)] : fmtVal(v);
      return [this.out(`${t} value is: ${s}`)];
    }
    if (a === "set") {
      const [, k, raw] = pos;
      if (!k || raw == null) return [this.err("usage: ros2 param set <node_name> <parameter_name> <value>")];
      if (!(k in n.params)) return [this.out(`Setting parameter failed: parameter '${k}' cannot be set because it was not declared`)];
      if (k.startsWith("qos_overrides")) return [this.out(`Setting parameter failed: parameter '${k}' cannot be set because it is read-only`)];
      const old = n.params[k];
      if (n.ptypes && n.ptypes[k]) {
        const nv = raw === "true" || raw === "True" ? true : raw === "false" || raw === "False" ? false : /^-?\d+$/.test(raw) || /^-?\d*\.\d+$/.test(raw) || /^-?\d+\.\d*$/.test(raw) ? Number(raw) : raw;
        const nk = typeof nv === "boolean" ? "bool" : typeof nv === "string" ? "string" : /^-?\d+$/.test(raw) ? "integer" : "double";
        if (nk !== n.ptypes[k] && !(n.ptypes[k] === "double" && nk === "integer" && n.kind !== "custom")) {
          const PYT = { double: "Type.DOUBLE", integer: "Type.INTEGER", string: "Type.STRING", bool: "Type.BOOL" };
          if (n.info && n.info.lang === "python") return [this.out(`Setting parameter failed: Wrong parameter type, expected '${PYT[n.ptypes[k]]}' got '${PYT[nk]}'`)];
          return [this.out(`Setting parameter failed: Wrong parameter type, parameter {${k}} is of type {${n.ptypes[k]}}, setting it to {${nk}} is not allowed.`)];
        }
        const why = n.info ? this.paramRule(n, k, nv) : null;
        if (why) return [this.out(`Setting parameter failed: ${why}`)];
        n.params[k] = nv;
        if (n.info && n.info.paramLog) this.note(n, `[INFO] [${n.name}]: ${k} changed to ${n.info.lang === "cpp" ? (typeof nv === "number" ? nv.toFixed(6) : String(nv)) : String(nv)}`);
        return [this.out("Set parameter successful")];
      }
      let v = raw === "true" || raw === "True" ? true : raw === "false" || raw === "False" ? false : /^-?\d+$/.test(raw) ? Number(raw) : /^-?\d*\.\d+$/.test(raw) ? Number(raw) : raw;
      const kind = (x, key = k) => (typeof x === "boolean" ? "bool" : typeof x === "string" ? "string" : Number.isInteger(x) && !(n.kind === "teleop") && !(n.ptypes && n.ptypes[key] === "double") ? "integer" : "double");
      if (kind(old) !== kind(v) && !(kind(old) === "double" && typeof v === "number")) return [this.out(`Setting parameter failed: Wrong parameter type, parameter {${k}} is of type {${kind(old)}}, setting it to {${kind(v)}} is not allowed.`)];
      if (k.startsWith("background_") && (v < 0 || v > 255)) return [this.out(`Setting parameter failed: Parameter {${k}} doesn't comply with integer range.`)];
      n.params[k] = v;
      return [this.out("Set parameter successful"), ...(k.startsWith("background_") ? [this.hint(`(The turtlesim window background is now rgb(${n.params.background_r}, ${n.params.background_g}, ${n.params.background_b}).)`)] : [])];
    }
    if (a === "describe") {
      const k = pos[1]; if (!k) return [this.err("usage: ros2 param describe <node_name> <parameter_name>")];
      if (!(k in n.params)) return [this.out(`Parameter not set: ${k}`)];
      const v = n.params[k], I = n.info || {}, ty = n.ptypes && n.ptypes[k] ? n.ptypes[k] : typeof v === "boolean" ? "bool" : typeof v === "string" ? "string" : Number.isInteger(v) && !(n.kind === "teleop") ? "integer" : "double";
      const L = [`Parameter name: ${k}`, `  Type: ${ty === "bool" ? "boolean" : Array.isArray(v) ? "double array" : ty}`];
      if (I.descs && I.descs[k]) L.push(`  Description: ${I.descs[k]}`);
      L.push("  Constraints:");
      if ((I.readOnly || []).includes(k) || k.startsWith("qos_overrides")) L.push("    Read only: true");
      if (I.ranges && I.ranges[k]) L.push(`    Min value: ${fnum(I.ranges[k][0])}`, `    Max value: ${fnum(I.ranges[k][1])}`);
      return L.map((t) => this.out(t));
    }
    if (a === "dump") {
      const P = n.params;
      const y = [`${n.full}:`, "  ros__parameters:"];
      const keys = Object.keys(P).filter((k) => !k.startsWith("qos")); if (Object.keys(P).some((q) => q.startsWith("qos"))) keys.push("qos_overrides");
      for (const k of keys.sort()) { if (k === "qos_overrides") y.push("    qos_overrides:", "      /parameter_events:", "        publisher:", "          depth: 1000", "          durability: volatile", "          history: keep_last", "          reliability: reliable"); else if (Array.isArray(P[k])) y.push(`    ${k}:`, ...P[k].map((v) => `    - ${typeof v === "number" ? fnum(v) : v}`)); else y.push(`    ${k}: ${P[k]}`); }
      return y.map((t) => this.out(t));
    }
    if (a === "load") {
      const p = this.sh.abs(pos[1] || "");
      if (!this.sh.isFile(p)) return [this.err(`Error: file ${pos[1]} does not exist`)];
      const L = [];
      for (const m of (this.sh.node(p).content || "").matchAll(/^\s+(\w+):\s*([^\s:]+)\s*$/gm)) {
        if (m[1] in n.params && !m[1].startsWith("qos")) { const v = /^-?\d+$/.test(m[2]) && !(n.ptypes && n.ptypes[m[1]] === "double") ? Number(m[2]) : /^-?\d*\.?\d+(e-?\d+)?$/.test(m[2]) ? Number(m[2]) : m[2] === "true" ? true : m[2] === "false" ? false : m[2]; n.params[m[1]] = v; L.push(this.out(`Set parameter ${m[1]} successful`)); }
      }
      return L.length ? L : [this.hint("(No matching parameters found in that file.)")];
    }
    return [this.err(`ros2 param: unknown command '${a}'`), this.hint("Try: list, get, set, dump, load")];
  }

  cmdAction(a, rest) {
    const A = this.collect(["acts", "actc"]);
    const showT = rest.includes("-t") || rest.includes("--show-types");
    const pos = rest.filter((x) => !x.startsWith("-"));
    const servers = [...A.entries()].filter(([, v]) => v.by.acts.length);
    if (a === "list") return servers.map(([k, v]) => this.out(showT ? `${k} [${v.type}]` : k));
    const name = pos[0], s = A.get(name || "");
    if (!name) return [this.err(`usage: ros2 action ${a || "list"} <action_name>`)];
    if (a === "type") return s ? [this.out(s.type)] : [this.err(`Unable to find action '${name}'`)];
    if (a === "info") return s ? [this.out(`Action: ${name}`), this.out(`Action clients: ${s.by.actc.length}`), ...s.by.actc.map((c) => this.out(`    ${c}`)), this.out(`Action servers: ${s.by.acts.length}`), ...s.by.acts.map((c) => this.out(`    ${c}`))] : [this.err(`Unable to find action '${name}'`)];
    if (a !== "send_goal") return [this.err(`ros2 action: unknown command '${a}'`), this.hint("Try: list, info, type, send_goal")];
    const type = pos[1], yaml = pos.slice(2).join(" ");
    if (!type || !yaml) return [this.err("usage: ros2 action send_goal <action_name> <action_type> <goal>")];
    if (!s || !s.by.acts.length) return [this.out("Waiting for an action server to become available..."), this.out("^C"), this.hint(`Nobody serves ${name}. Check with: ros2 action list`)];
    if (type !== s.type) return [this.err("The passed action type is invalid"), this.hint(`${name} has type ${s.type}`)];
    const own = this.node(s.by.acts[0]);
    if (own && own.kind === "custom") return this.customAction(own, name, type, yaml, rest);
    if (type === "control_msgs/action/FollowJointTrajectory") { const r = this.fjtAction(name, yaml, rest); if (r) return r; }
    if (type === "moveit_msgs/action/MoveGroup") return [this.out("Waiting for an action server to become available..."), this.out("Sending goal:"), this.out("     request: ..."), this.out(""), this.out(`Goal accepted with ID: ${hex()}`), this.out(""), this.hint("(A MoveGroup goal is a whole MotionPlanRequest: easier from code. Use the RViz MotionPlanning panel, the Pose Goal panel, or ros2 run <robot>_moveit_config pose_goal_commander.py with /goal_pose.)")];
    const hit = this.turtle(name.replace(/\/rotate_absolute$/, ""));
    if (!hit) return [this.out("Waiting for an action server to become available..."), this.out(`Goal accepted with ID: ${hex()}`), this.out(""), this.out("Goal finished with status: SUCCEEDED")];
    const goal = this.num(yaml, "theta"), start = hit.t.theta, diff = goal - start;
    const L = [this.out("Waiting for an action server to become available..."), this.out("Sending goal:"), this.out(`     theta: ${goal}`), this.out(""), this.out(`Goal accepted with ID: ${hex()}`), this.out("")];
    if (rest.includes("--feedback") || rest.includes("-f")) for (let k = 0; k < 4; k++) L.push(this.out("Feedback:"), this.out(`    remaining: ${fnum(+(diff * (1 - k * 0.3)).toFixed(6))}`), this.out(""));
    hit.t.theta = +goal.toFixed(6);
    L.push(this.out("Result:"), this.out(`    delta: ${fnum(+(-diff + 0.002 * Math.sign(-diff || 1)).toFixed(6))}`), this.out(""), this.out("Goal finished with status: SUCCEEDED"));
    return L;
  }

  allIfaces() { const all = { ...IFACES }; for (const pk of this.sh.wsPkgs ? this.sh.wsPkgs.values() : []) Object.assign(all, pk.ifaces || {}); return all; }
  cmdInterface(a, rest) {
    const IF = this.allIfaces();
    if (a === "show") {
      const n = rest[0] || "";
      const full = IF[n] ? n : n.split("/").length === 2 ? Object.keys(IF).find((k) => k.replace(/\/(msg|srv|action)\//, "/") === n) : null;
      if (!full) {
        const pkg = n.split("/")[0];
        if (!Object.keys(IF).some((k) => k.startsWith(pkg + "/"))) return [this.err(`Unknown package '${pkg}'`), this.hint("Did you build it with colcon and run source install/setup.bash in this terminal?")];
        return [this.err(`Could not find the interface '${n}'`), this.hint("Interface names look like geometry_msgs/msg/Twist, turtlesim/srv/Spawn or turtlesim/action/RotateAbsolute.")];
      }
      return this.lines(IF[full]);
    }
    if (a === "package") {
      const keys = Object.keys(IF).filter((k) => k.startsWith((rest[0] || "") + "/"));
      return keys.length ? keys.map((k) => this.out(k)) : [this.err(`Unknown package '${rest[0] || ""}'`)];
    }
    if (a === "list") return ["Messages:", ...Object.keys(IFACES).filter((k) => k.includes("/msg/")).map((k) => "    " + k), "Services:", ...Object.keys(IFACES).filter((k) => k.includes("/srv/")).map((k) => "    " + k), "Actions:", ...Object.keys(IFACES).filter((k) => k.includes("/action/")).map((k) => "    " + k)].map((t) => this.out(t));
    return [this.err("usage: ros2 interface show <type>  |  ros2 interface list")];
  }

  cmdBag(a, rest) {
    const sh = this.sh;
    if (a === "record") {
      let name = null; const topics = [];
      for (let i = 0; i < rest.length; i++) { if (rest[i] === "-o" || rest[i] === "--output") { name = rest[++i]; continue; } if (!rest[i].startsWith("-")) topics.push(rest[i]); }
      const all = rest.includes("-a") || rest.includes("--all");
      const T = this.topics();
      const rec = all ? [...T.keys()] : topics;
      if (!rec.length) return [this.err("Need to specify one or more topics, or use -a to record all topics")];
      const d = new Date(), pad = (x) => String(x).padStart(2, "0");
      name = name || `rosbag2_${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}-${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
      const dir = sh.abs(name);
      if (sh.fs.has(dir)) return [this.err(`[ERROR] [rosbag2_storage]: Output folder '${name}' already exists.`), this.hint("Choose another name with -o, or delete the old folder.")];
      sh.mkdirP(dir);
      sh.fs.set(`${dir}/metadata.yaml`, { type: "f", mode: "rw-r--r--", content: "rosbag2_bagfile_information:\n  version: 9\n  storage_identifier: mcap\n" });
      sh.fs.set(`${dir}/${name}_0.mcap`, { type: "f", mode: "rw-r--r--", content: "(binary)" });
      this.bags[dir] = rec.map((t) => ({ t, type: (T.get(t) || { type: "geometry_msgs/msg/Twist" }).type, count: /pose|color/.test(t) ? 1250 : t.endsWith("cmd_vel") ? 9 : 20 }));
      return [this.out("[INFO] [rosbag2_recorder]: Press SPACE for pausing/resuming"), this.out("[INFO] [rosbag2_recorder]: Listening for topics..."),
        ...rec.map((t) => this.out(`[INFO] [rosbag2_recorder]: Subscribed to topic '${t}'`)), this.out("[INFO] [rosbag2_recorder]: Recording..."),
        this.out("[INFO] [rosbag2_recorder]: All requested topics are subscribed. Stopping discovery..."), this.out("^C"),
        this.hint(`Practice terminal: recorded about 20 seconds, then stopped (on a real computer: Ctrl+C). The bag is the folder ${name}/`)];
    }
    const name = rest.find((x) => !x.startsWith("-"));
    const dir = name ? sh.abs(name) : "";
    const bag = this.bags[dir];
    if ((a === "info" || a === "play") && !bag) return [this.err(`[ERROR] [ros2bag]: No storage could be initialized from the inputs: '${name || ""}'`), this.hint("Give the bag folder name. Record one first with: ros2 bag record -o my_bag /turtle1/cmd_vel")];
    if (a === "info") {
      const total = bag.reduce((s, b) => s + b.count, 0);
      return [`Files:             ${baseName(dir)}_0.mcap`, "Bag size:          48.3 KiB", "Storage id:        mcap", "ROS Distro:        jazzy", "Duration:          20.012s",
        "Start:             Oct  2 2026 10:15:04.120 (1790921104.120)", "End:               Oct  2 2026 10:15:24.132 (1790921124.132)", `Messages:          ${total}`,
        ...bag.map((b, i) => `${i ? "                   " : "Topic information: "}Topic: ${b.t} | Type: ${b.type} | Count: ${b.count} | Serialization Format: cdr`),
        "Service:           0"].map((t) => this.out(t));
    }
    if (a === "play") {
      const tw = bag.find((b) => b.t.endsWith("cmd_vel"));
      if (tw) { const hit = this.turtle(tw.t.replace(/\/cmd_vel$/, "")); if (hit) this.move(hit.t, 2, 1.2, 3); }
      return [this.out("[INFO] [rosbag2_player]: Set rate to 1"), this.out("[INFO] [rosbag2_player]: Adding keyboard callbacks."), this.out("[INFO] [rosbag2_player]: Press SPACE for Pause/Resume"),
        this.out("[INFO] [rosbag2_player]: Playback until timestamp: -1"), this.hint(`(The recorded messages were published again, exactly as they happened.${tw ? " The turtle repeated the same drive!" : ""})`)];
    }
    return [this.err("usage: ros2 bag record | info | play")];
  }

  // ros2 run in a terminal with a live graph: the node keeps running "in another terminal"
  start(pkg, exe, extra) {
    if (`${pkg} ${exe}` === "tf2_tools view_frames") return this.viewFrames();
    if (/^add_scene_objects\.py$/.test(exe) && this.sh.wsPkgs && this.sh.wsPkgs.get(pkg)) return this.mgSceneScript(this.sh.wsPkgs.get(pkg));
    if (/^pose_goal_commander\.py$/.test(exe) && this.sh.wsPkgs && this.sh.wsPkgs.get(pkg)) return this.mgPoseGoalNode(this.sh.wsPkgs.get(pkg), extra);
    if (`${pkg} ${exe}` === "tf2_ros tf2_echo") return this.tfEcho(extra.filter((x) => !x.startsWith("-"))[0], extra.filter((x) => !x.startsWith("-"))[1]);
    const kind = EXES[`${pkg} ${exe}`];
    if (!kind) return null;
    let name = DEFAULT_NAME[kind], ns = "", pfile = null;
    const params = {}, remaps = [];
    for (let i = 0; i < extra.length; i++) {
      if (extra[i] === "-r" || extra[i] === "--remap") { const [k, v] = (extra[++i] || "").split(":="); if (k === "__node" || k === "__name") name = v; else if (k === "__ns") ns = v; else if (k && v) remaps.push([k, v]); }
      if (extra[i] === "-p" || extra[i] === "--param") { const raw = extra[++i] || "", cut = raw.indexOf(":="), k = raw.slice(0, cut < 0 ? raw.length : cut), v = cut < 0 ? "" : raw.slice(cut + 2); params[k] = /^@SUBST\d+@$/.test(v) ? (this.sh.substs || {})[v] : /^-?\d*\.?\d+$/.test(v || "") ? Number(v) : v === "true" ? true : v === "false" ? false : v; }
      if (extra[i] === "--params-file") pfile = extra[++i];
    }
    const pre = [];
    if (pfile !== null) {
      const fp = this.sh.abs(pfile || "");
      if (!this.sh.isFile(fp)) return [this.err(`[ERROR] [rcl]: Failed to parse global arguments: Couldn't parse params file: '--params-file ${pfile}'. Error: Error opening YAML file, at ./src/parse.c`), this.hint("Check the path to the YAML file (use ls).")];
      const y = parseParamsYaml(this.sh.node(fp).content || "");
      y.warn.forEach((w) => pre.push(this.hint(w)));
      const full = `${ns ? "/" + ns.replace(/^\//, "") : ""}/${name}`;
      for (const [key, body] of Object.entries(y.tree)) if (key === "/**" || key === full) for (const [k, v] of Object.entries(body)) params[k] = plainValue(v);
    }
    if (kind === "spawner" || kind === "unspawner") {   // loads, configures and activates controllers, then exits
      if (kind === "unspawner") { const nm = extra.filter((x) => !String(x).startsWith("-"))[0]; return this.ros2Control(["switch_controllers", "--deactivate", nm]).concat(this.ros2Control(["unload_controller", nm])); }
      const r = this.spawnerRun(extra);
      return [...r.lines, ...(r.hint ? [this.hint(`(${r.hint})`)] : []), ...(r.fail ? [] : [this.hint("(spawner has finished, as on Ubuntu: the controller now runs inside Gazebo's controller_manager. Check with: ros2 control list_controllers)")])];
    }
    if (kind === "gz_create") {   // spawns the robot into Gazebo and exits
      const argv = extra.slice(0, extra.includes("--ros-args") ? extra.indexOf("--ros-args") : extra.length);
      const r = this.gzCreate(argv);
      if (r.gzErr && r.gzErr.length && this.gz) (this.notices = this.notices || []).push(...r.gzErr.map((t) => ({ node: this.gz.node, text: t })));
      if (r.gzInfo && r.gzInfo.length && this.gz) (this.notices = this.notices || []).push(...r.gzInfo.map((t) => ({ node: this.gz.node, text: t, cls: "" })));
      return [...r.lines.map((t) => (/\[ERROR\]/.test(t) ? this.err(t) : this.out(t))), ...(r.hint ? [this.hint(`(${r.hint})`)] : []), ...(r.fail ? [] : [this.hint(`(${r.model.name} is now in the Gazebo world${this.gz.paused ? ". The simulation is paused: press ▶ in the Gazebo window" : ""}. create has finished, as on Ubuntu: the robot stays in Gazebo.)`)])];
    }
    const dupWarn = `[WARN] [rcl.logging_rosout]: Publisher already registered for node name: '${name}'. If this is due to multiple nodes with the same name then all logs for the logger named '${name}' will go out over the existing publisher. As soon as any node with that name is destructed it will unregister the publisher, preventing any further logs for that name from being published on the rosout topic.`;
    const dup = (kind === "gz_bridge" || kind === "gz_image") && this.has(`${ns ? "/" + ns.replace(/^\//, "") : ""}/${name}`);   // a second bridge in another terminal: ROS 2 starts it anyway
    if (dup) pre.push(this.out(dupWarn));
    if (!dup && this.has(`${ns ? "/" + ns.replace(/^\//, "") : ""}/${name}`)) return [this.out(`[WARN] [rcl.logging_rosout]: Publisher already registered for node name: '${name}'. If this is due to multiple nodes with the same name then all logs for the logger named '${name}' will go out over the existing publisher. As soon as any node with that name is destructed it will unregister the publisher, preventing any further logs for that name from being published on the rosout topic.`), this.hint("Two nodes with the same name confuse ROS 2. Give the second one a new name with --ros-args --remap __node:=another_name")];
    if (kind === "static_tf") {
      const arg = (k, d = 0) => { const i = extra.indexOf(`--${k}`); return i >= 0 ? extra[i + 1] : d; };
      const posArgs = extra.filter((x) => !String(x).startsWith("-"));
      if (!extra.includes("--frame-id") && (posArgs.length === 8 || posArgs.length === 9) && posArgs.slice(0, posArgs.length - 2).every((x) => /^-?\d*\.?\d+$/.test(x))) {   // old positional style
        const v = posArgs.map(Number), n9 = posArgs.length === 9;
        name = `static_transform_publisher_${hex().slice(0, 8)}`;
        const st = this.add("static_tf", name, ns, {});
        const q = n9 ? [v[3], v[4], v[5], v[6]] : qRPY(v[5], v[4], v[3]);
        st.tf = { parent: posArgs[posArgs.length - 2], child: posArgs[posArgs.length - 1], t: [v[0], v[1], v[2]], q };
        this.lastStarted = [st.full];
        return [this.out(`[WARN] [${name}]: Old-style arguments are deprecated; see --help for new-style arguments`), this.out(`[INFO] [${name}]: Spinning until stopped - publishing transform`),
          this.out(`translation: ('${(+st.tf.t[0]).toFixed(6)}', '${(+st.tf.t[1]).toFixed(6)}', '${(+st.tf.t[2]).toFixed(6)}')`), this.out(`rotation: ('${q[0].toFixed(6)}', '${q[1].toFixed(6)}', '${q[2].toFixed(6)}', '${q[3].toFixed(6)}')`),
          this.out(`from '${st.tf.parent}' to '${st.tf.child}'`), this.hint("Careful: the old order is x y z YAW PITCH ROLL parent child (yaw first!). Prefer the named --x ... --frame-id ... style.")];
      }
      if (!extra.includes("--frame-id") || !extra.includes("--child-frame-id")) return [this.err("usage: ros2 run tf2_ros static_transform_publisher --x X --y Y --z Z --yaw Y --pitch P --roll R --frame-id PARENT --child-frame-id CHILD")];
      name = `static_transform_publisher_${hex().slice(0, 8)}`;
      const st = this.add("static_tf", name, ns, {});
      st.tf = { parent: arg("frame-id"), child: arg("child-frame-id"), t: [Number(arg("x")), Number(arg("y")), Number(arg("z"))], q: qRPY(Number(arg("roll")), Number(arg("pitch")), Number(arg("yaw"))) };
      this.lastStarted = [st.full];
      return [this.out(`[INFO] [${name}]: Spinning until stopped - publishing transform`), this.out(`translation: ('${(+st.tf.t[0]).toFixed(6)}', '${(+st.tf.t[1]).toFixed(6)}', '${(+st.tf.t[2]).toFixed(6)}')`), this.out(`rotation: ('${st.tf.q[0].toFixed(6)}', '${st.tf.q[1].toFixed(6)}', '${st.tf.q[2].toFixed(6)}', '${st.tf.q[3].toFixed(6)}')`), this.out(`from '${st.tf.parent}' to '${st.tf.child}'`)];
    }
    if (kind === "rviz") { const di = extra.indexOf("-d"); const r = this.rvizConfig(di >= 0 ? extra[di + 1] : null); if (r) pre.push(...r); }
    const n = this.add(kind, name, ns, params, remaps, dup);
    this.lastStarted = [n.full];
    if (kind === "gz_bridge" || kind === "gz_image") {
      const argv = extra.slice(0, extra.includes("--ros-args") ? extra.indexOf("--ros-args") : extra.length);
      if (kind === "gz_image") { n.bridge = argv.filter((x) => !x.startsWith("-")).map((t) => ({ ros: t.startsWith("/") ? t : "/" + t, gz: t.startsWith("/") ? t : "/" + t, rosType: "sensor_msgs/msg/Image", gzType: "gz.msgs.Image", dir: "GZ_TO_ROS" })); return [...pre, this.hint(`(Practice terminal: ${n.full} now keeps running.)`)]; }
      const r = this.bridgeEntries(argv, params);
      if (r.err) { this.nodes = this.nodes.filter((x) => x !== n); this.lastStarted = null; return [...pre, this.err(r.err)]; }
      n.bridge = r.entries; n.bridgeBad = r.bad;
      return [...pre, ...this.bridgeLines(n).map((t) => (/\[(ERROR|WARN)\]/.test(t) ? this.err(t) : this.out(t))), this.hint(`(Practice terminal: ${n.full} now keeps running and carries messages between Gazebo and ROS 2.)`)];
    }
    if (kind === "teleop_twist") { n.speed = Number(n.params.speed) || 0.5; n.turn = Number(n.params.turn) || 1.0; const st = n.params.stamped === true || n.params.stamped === "true"; const tp = (this.endpoints(n).pubs.find(([, t]) => /Twist/.test(t)) || [])[0]; return [...pre, ...this.lines(TELEOP_BANNER), this.hint(`(Practice terminal: press the keys below, or type them while this terminal is selected. It publishes geometry_msgs/msg/${st ? "TwistStamped" : "Twist"} on ${tp}.)`)]; }
    const L = {
      jsp: kind !== "jsp" ? [] : this.rspNode() ? [] : ["[WARN] [joint_state_publisher]: Waiting for robot_description to be published on the robot_description topic..."],
      jsp_gui: kind !== "jsp_gui" ? [] : this.rspNode() ? ["[INFO] [joint_state_publisher_gui]: Centering", "(A window with one slider per moving joint opened below the terminal.)"] : ["[WARN] [joint_state_publisher_gui]: Waiting for robot_description to be published on the robot_description topic..."],
      rviz: kind !== "rviz" ? [] : ["[INFO] [rviz2]: Stereo is NOT SUPPORTED", "[INFO] [rviz2]: OpenGl version: 4.6 (GLSL 4.6)", "(The RViz2 window opened below the terminal.)"],
      turtlesim: [`[INFO] [${name}]: Starting turtlesim with node name ${n.full}`, `[INFO] [${name}]: Spawning turtle [turtle1] at x=[5.544445], y=[5.544445], theta=[0.000000]`],
      teleop: ["Reading from keyboard", "---------------------------", "Use arrow keys to move the turtle.", "Use G|B|V|C|D|E|R|T keys to rotate to absolute orientations. 'F' to cancel a rotation.", "'Q' to quit."],
      talker: [1, 2, 3].map((i) => `[INFO] [${name}]: Publishing: 'Hello World: ${i}'`),
      listener: this.has("/talker") ? [1, 2, 3].map((i) => `[INFO] [${name}]: I heard: [Hello World: ${i}]`) : [],
      adder: [],
      arm: kind !== "arm" ? [] : [`[INFO] [${name}]: 2-link arm IK node ready: link1=${fnum(n.params.link1_length)} m, link2=${fnum(n.params.link2_length)} m, reach=${fnum(n.params.link1_length + n.params.link2_length)} m`, `[INFO] [${name}]: Waiting for targets on ${n.ns}/target_point`],
      diffbot: kind !== "diffbot" ? [] : [`[INFO] [${name}]: Differential-drive base ready: wheel_radius=${fnum(n.params.wheel_radius)} m, wheel_separation=${fnum(n.params.wheel_separation)} m`, `[INFO] [${name}]: Publishing ${n.ns}/odom and the transform odom -> base_link`],
      container: [],
      rsp: kind !== "rsp" ? [] : (n.params.robot_description ? this.rspMessages(n) : ["[ERROR] [robot_state_publisher]: No robot_description parameter: give it the URDF text, for example from a launch file"]),
      static_tf: kind !== "static_tf" ? [] : ["[INFO] [static_transform_publisher]: Spinning until stopped - publishing transform"],
      mm: kind !== "mm" ? [] : [`[INFO] [${name}]: Mobile manipulator planner ready. Send a goal on ${n.ns}/goal_point`],
    }[kind];
    return [...pre, ...L.map((t) => this.out(t)), this.hint(`(Practice terminal: ${n.full} now keeps running in the background, as if in its own terminal window. Keep typing ros2 commands here to look at it.)`)];
  }
  startCustom(pkg, exe, info, lines, extra) {
    let name = info.node, ns = "";
    const params = { ...info.params }, remaps = [];
    for (let i = 0; i < extra.length; i++) {
      if (extra[i] === "-r" || extra[i] === "--remap") { const [k, v] = (extra[++i] || "").split(":="); if (k === "__node" || k === "__name") name = v; else if (k === "__ns") ns = v; else if (k && v) remaps.push([k, v]); }
      if (extra[i] === "-p" || extra[i] === "--param") { const raw = extra[++i] || "", cut = raw.indexOf(":="), k = raw.slice(0, cut < 0 ? raw.length : cut), v = cut < 0 ? "" : raw.slice(cut + 2); params[k] = /^@SUBST\d+@$/.test(v) ? (this.sh.substs || {})[v] : /^-?\d*\.?\d+$/.test(v || "") ? Number(v) : v === "true" ? true : v === "false" ? false : v; }
      if (extra[i] === "--params-file") { const fp = this.sh.abs(extra[++i] || ""); if (this.sh.isFile(fp)) { const y = parseParamsYaml(this.sh.node(fp).content || ""); for (const [key, body] of Object.entries(y.tree)) if (key === "/**" || key.replace(/^\//, "") === name) for (const [k, v] of Object.entries(body)) params[k] = plainValue(v); } }
    }
    const full = `${ns ? "/" + ns.replace(/^\//, "") : ""}/${name}`;
    if (this.has(full)) return [this.out(`[WARN] [rcl.logging_rosout]: Publisher already registered for node name: '${name}'.`), this.hint("Two nodes with the same name confuse ROS 2. Give the second one a new name with --ros-args --remap __node:=another_name")];
    const n = this.add("custom", name, ns, params, remaps);
    n.info = info;
    if (info.lang === "cpp") QOS.forEach((q, i) => { n.params[q] = [1000, "volatile", "keep_last", "reliable"][i]; });   // rclcpp nodes list these too
    if (info.cli.some(([, t]) => /Spawn$/.test(t)) && !/\bspin\s*\(/.test(info.code || "")) {   // a service-client program: calls turtlesim, prints, ends
      n.ptypes = {};
      const out = this.runServiceClient(n, info);
      this.nodes = this.nodes.filter((x) => x !== n);
      return out;
    }
    if (info.actc.length && !info.acts.length) {   // a client program: it sends its goal, prints, and ends
      n.ptypes = {};
      const out = this.runActionClient(n, lines.map((t) => this.out(t)));
      this.nodes = this.nodes.filter((x) => x !== n);
      return out;
    } n.ptypes = { ...Object.fromEntries(Object.entries(n.params).map(([k, v]) => [k, typeof v === "boolean" ? "bool" : typeof v === "string" ? "string" : Number.isInteger(v) ? "integer" : "double"])), ...info.ptypes };
    this.lastStarted = [n.full];
    const shown = this.renderLogs(n, lines);
    return [...shown.map((t) => this.out(t.replace(`[${info.node}]`, `[${name}]`))), this.hint(`(Practice terminal: your node ${n.full} now keeps running. Open a new terminal tab and look at it with ros2 node info ${n.full})`)];
  }
  launch(pkg, file) {
    if (`${pkg} ${file}` !== "turtlesim multisim.launch.py") return null;
    this.add("turtlesim", "sim", "turtlesim1"); this.add("turtlesim", "sim", "turtlesim2");
    this.lastStarted = ["/turtlesim1/sim", "/turtlesim2/sim"];
    return [this.out("[INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-02-10-15-04-120000-ros2lab-4321"), this.out("[INFO] [launch]: Default logging verbosity is set to INFO"),
      this.out("[INFO] [turtlesim_node-1]: process started with pid [4330]"), this.out("[INFO] [turtlesim_node-2]: process started with pid [4332]"),
      this.hint("(Two turtlesim windows opened, in the namespaces /turtlesim1 and /turtlesim2. They keep running in the background. Try: ros2 node list)")];
  }
}

RosGraph.prototype.stop = function (full) {
  if (this.gz && this.gz.node === full) { this.gz = null; this.nodes = this.nodes.filter((n) => n.kind !== "cm" && n.kind !== "ctrl"); }   // closing Gazebo removes its world, robots and controllers
  const same = this.nodes.filter((n) => n.full === full);
  if (same.length > 1) { const last = same[same.length - 1]; this.nodes = this.nodes.filter((n) => n !== last); }   // two nodes with one name: Ctrl+C stops one of them
  else this.nodes = this.nodes.filter((n) => n.full !== full);
  this.version = (this.version || 0) + 1;
};
// One key press in turtle_teleop_key: publish one Twist on <ns>/turtle1/cmd_vel
RosGraph.prototype.teleopKey = function (teleFull, key) {
  const tele = this.node(teleFull);
  if (!tele) return null;
  const lin = Number(tele.params.scale_linear) || 2, ang = Number(tele.params.scale_angular) || 2;
  const v = { up: [lin, 0], down: [-lin, 0], left: [0, ang], right: [0, -ang] }[key];
  if (!v) return null;
  const topic = `${tele.ns}/turtle1/cmd_vel`;
  this.lastTwist = { lx: v[0], ly: 0, az: v[1], topic };
  const hit = this.turtle(`${tele.ns}/turtle1`);
  if (hit) this.move(hit.t, v[0], v[1], 1);
  return hit;
};
// ---------- Week 7 robots: a 2-link arm IK node, a differential-drive base, a mobile-manipulator planner ----------
const r2 = (x) => Math.round(x * 100) / 100;
export function ik2(l1, l2, x, y, elbowUp) {
  const d2 = x * x + y * y, c2 = (d2 - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  if (c2 > 1 + 1e-9 || c2 < -1 - 1e-9) return null;
  const q2 = (elbowUp ? -1 : 1) * Math.acos(Math.max(-1, Math.min(1, c2)));
  const q1 = Math.atan2(y, x) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
  return [Math.atan2(Math.sin(q1), Math.cos(q1)), q2];
}
const fk2 = (l1, l2, q) => [l1 * Math.cos(q[0]) + l2 * Math.cos(q[0] + q[1]), l1 * Math.sin(q[0]) + l2 * Math.sin(q[0] + q[1])];
RosGraph.prototype.note = function (n, text, cls) { (this.notices = this.notices || []).push({ node: n.full, text, cls }); };
// a student's kinematics node behaves like the matching practice robot: "arm" (IK), "fk", "diffbot" (odometry), "mm" (planner)
RosGraph.prototype.vkind = function (n) {
  if (n.kind !== "custom" || !n.info) return n.kind;
  const e = this.endpoints(n), has = (arr, name, type) => arr.some(([nm, t]) => nm.endsWith(name) && String(t).endsWith(type));
  if (has(e.subs, "/goal_point", "Point")) return "mm";
  if ((has(e.subs, "/target_point", "Point") && has(e.pubs, "/joint_states", "JointState")) || e.srvs.some(([, t]) => /MoveArm$/.test(t))) { this.ensureArm(n); return "arm"; }
  if (has(e.pubs, "/odom", "Odometry")) { this.ensureBot(n); return "diffbot"; }
  if (has(e.subs, "/joint_states", "JointState") && has(e.pubs, "/end_effector", "Point")) return "fk";
  return null;
};
RosGraph.prototype.ensureArm = function (n) {
  n.q = n.q || [0, 0];
  for (const [k, v] of [["link1_length", 1.0], ["link2_length", 0.8]]) if (typeof n.params[k] !== "number") n.params[k] = v;
};
RosGraph.prototype.ensureBot = function (n) {
  if (!n.base) { n.base = { x: 0, y: 0, theta: 0, v: 0, w: 0 }; n.wheels = [0, 0]; n.path = [[0, 0]]; }
  for (const [k, v] of [["wheel_radius", 0.05], ["wheel_separation", 0.3]]) if (typeof n.params[k] !== "number") n.params[k] = v;
};
RosGraph.prototype.subscribes = function (n, topic, type) { return n.kind === "custom" ? this.endpoints(n).subs.some(([nm, t]) => nm === topic && String(t).endsWith(type)) : false; };
RosGraph.prototype.armSolve = function (arm, P) {
  const { link1_length: l1, link2_length: l2, elbow_up: up } = arm.params;
  arm.target = [P.x, P.y];
  const q = ik2(l1, l2, P.x, P.y, up === true || up === "true");
  const custom = arm.kind === "custom", traj = custom && /moving in/.test(arm.info.code || "");
  if (!q) { this.note(arm, traj ? `[WARN] [${arm.name}]: out of reach` : custom ? `[WARN] [${arm.name}]: Target (${P.x.toFixed(2)}, ${P.y.toFixed(2)}) is out of reach: distance ${Math.hypot(P.x, P.y).toFixed(2)} m, reach ${(l1 + l2).toFixed(2)} m` : `[WARN] [${arm.name}]: Target (${fnum(P.x)}, ${fnum(P.y)}) is out of reach: distance ${Math.hypot(P.x, P.y).toFixed(2)} m, reach ${(l1 + l2).toFixed(2)} m (and at least ${Math.abs(l1 - l2).toFixed(2)} m)`); return false; }
  const before = arm.q || [0, 0];
  arm.q = q;
  const e = fk2(l1, l2, q), deg = (r) => (r * 180 / Math.PI).toFixed(1);
  if (traj) {
    const big = Math.max(Math.abs(q[0] - before[0]), Math.abs(q[1] - before[1])), ms = typeof arm.params.max_joint_speed === "number" ? arm.params.max_joint_speed : 1;
    this.note(arm, `[INFO] [${arm.name}]: moving in ${Math.max(1.5 * big / ms, 0.2).toFixed(2)} s`);
    this.note(arm, `[INFO] [${arm.name}]: arrived: ${deg(q[0])} deg, ${deg(q[1])} deg`);
  } else this.note(arm, `[INFO] [${arm.name}]: IK solution: shoulder=${q[0].toFixed(3)} rad (${deg(q[0])} deg), elbow=${q[1].toFixed(3)} rad (${deg(q[1])} deg)${custom ? "" : ` -> end effector (${e[0].toFixed(2)}, ${e[1].toFixed(2)})`}`);
  this.version = (this.version || 0) + 1;
  return true;
};
RosGraph.prototype.driveBot = function (bot, v, w, secs) {
  const b = bot.base, R = bot.params.wheel_radius, L = bot.params.wheel_separation;
  // the wheels turn as the controller asks (using the parameters); the real robot moves with the TRUE wheel size.
  // odometry (b) believes the parameters, so wrong parameters make the estimate drift away from the truth (bot.truth).
  const wl = (v - w * L / 2) / R, wr = (v + w * L / 2) / R, vt = (wr + wl) / 2 * 0.05, wt = (wr - wl) * 0.05 / 0.3;
  bot.truth = bot.truth || { x: b.x, y: b.y, theta: b.theta, path: [[b.x, b.y]] };
  const T = bot.truth;
  for (let s = 0; s < secs * 20; s++) { b.theta += w / 20; b.x += Math.cos(b.theta) * v / 20; b.y += Math.sin(b.theta) * v / 20; bot.path.push([b.x, b.y]); T.theta += wt / 20; T.x += Math.cos(T.theta) * vt / 20; T.y += Math.sin(T.theta) * vt / 20; T.path.push([T.x, T.y]); }
  b.theta = Math.atan2(Math.sin(b.theta), Math.cos(b.theta)); b.v = v; b.w = w;
  bot.wheels[0] += (v - w * L / 2) / R * secs; bot.wheels[1] += (v + w * L / 2) / R * secs;
  if (bot.path.length > 2000) bot.path.splice(0, bot.path.length - 2000);
  this.version = (this.version || 0) + 1;
};
RosGraph.prototype.onPoint = function (topic, P) {
  for (const arm of this.nodes.filter((n) => (n.kind === "arm" && `${n.ns}/target_point` === topic) || (this.vkind(n) === "arm" && this.subscribes(n, topic, "Point")))) this.armSolve(arm, P);
  const mm = this.nodes.find((n) => (n.kind === "mm" && `${n.ns}/goal_point` === topic) || (this.vkind(n) === "mm" && this.subscribes(n, topic, "Point")));
  if (!mm) return;
  const bot = this.nodes.find((n) => this.vkind(n) === "diffbot"), arm2 = this.nodes.find((n) => this.vkind(n) === "arm");
  if (mm.kind === "custom") return this.mmCustom(mm, P, bot, arm2);
  if (!bot || !arm2) { this.note(mm, `[ERROR] [${mm.name}]: I need both the base (chiku_base diffbot) and the arm (chiku_arm ik_node) running.`); return; }
  const b = bot.base, reach = arm2.params.link1_length + arm2.params.link2_length;
  const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy);
  this.note(mm, `[INFO] [${mm.name}]: Goal (${fnum(P.x)}, ${fnum(P.y)}) is ${d.toFixed(2)} m from the base; arm reach is ${reach.toFixed(2)} m.`);
  const keep = reach * (Number(mm.params.approach_ratio) || 0.7);
  if (d > keep) {
    const heading = Math.atan2(dy, dx); let turn = heading - b.theta; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const drive = d - keep;
    this.note(mm, `[INFO] [${mm.name}]: Step 1: turn ${turn.toFixed(2)} rad, then drive ${drive.toFixed(2)} m (publishing on /cmd_vel).`);
    this.driveBot(bot, 0, turn, 1); this.driveBot(bot, drive, 0, 1);
  } else this.note(mm, `[INFO] [${mm.name}]: Step 1: the goal is already within reach, the base stays where it is.`);
  const c = Math.cos(-b.theta), s = Math.sin(-b.theta), lx = c * (P.x - b.x) - s * (P.y - b.y), ly = s * (P.x - b.x) + c * (P.y - b.y);
  this.note(mm, `[INFO] [${mm.name}]: Step 2: goal in base_link frame = (${lx.toFixed(2)}, ${ly.toFixed(2)}); sending it to ${arm2.ns}/target_point.`);
  arm2.world = true;
  if (this.armSolve(arm2, { x: lx, y: ly })) this.note(mm, `[INFO] [${mm.name}]: Done: base at (${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.theta.toFixed(2)} rad), arm reaching the goal.`);
};
RosGraph.prototype.mmCustom = function (mm, P, bot, arm) {
  const l1 = typeof mm.params.link1_length === "number" ? mm.params.link1_length : 1, l2 = typeof mm.params.link2_length === "number" ? mm.params.link2_length : 0.8;
  const stop = (typeof mm.params.approach_ratio === "number" ? mm.params.approach_ratio : 0.7) * (l1 + l2);
  this.note(mm, `[INFO] [${mm.name}]: New goal (${P.x.toFixed(2)}, ${P.y.toFixed(2)})`);
  if (!bot) { this.note(mm, `[INFO] [${mm.name}]: (no /odom yet: start the base nodes, then send the goal again)`); return; }
  const b = bot.base, toBase = () => { const c = Math.cos(-b.theta), s = Math.sin(-b.theta); return [c * (P.x - b.x) - s * (P.y - b.y), s * (P.x - b.x) + c * (P.y - b.y)]; };
  let [lx, ly] = toBase(), d = Math.hypot(lx, ly);
  if (d > stop) {
    this.driveBot(bot, 0, Math.atan2(ly, lx), 1);
    [lx, ly] = toBase(); d = Math.hypot(lx, ly);
    this.note(mm, `[INFO] [${mm.name}]: Facing the goal, driving ${(d - stop).toFixed(2)} m`);
    this.driveBot(bot, d - stop, 0, 1);
    [lx, ly] = toBase();
  }
  this.note(mm, `[INFO] [${mm.name}]: Within reach: arm target in base_link = (${lx.toFixed(2)}, ${ly.toFixed(2)})`);
  if (arm) { arm.world = true; this.armSolve(arm, { x: lx, y: ly }); }
};
// ros2 topic echo for the URDF pipeline: robot_state_publisher's /robot_description, /tf_static and /tf,
// and joint_state_publisher(_gui)'s /joint_states (the slider values)
RosGraph.prototype.urdfSample = function (name, t) {
  const rsp = this.nodes.find((n) => n.kind === "rsp" && n.params.robot_description);
  const by = (k) => t.by.pubs.some((f) => (this.node(f) || {}).kind === k);
  const sec = Math.floor(Date.now() / 1000), stamp = (i = 0) => `  stamp:\n    sec: ${sec}\n    nanosec: ${123456789 + i * 1000}`;
  const model = rsp ? this.robotModel() : null, values = (this.sh.viz && this.sh.viz.joints) || {};
  const f = (x) => { const v = Math.round(x * 1e6) / 1e6; return Number.isInteger(v) ? v.toFixed(1) : String(v); };
  if (t.type === "std_msgs/msg/String" && by("rsp") && rsp) return [`data: ${JSON.stringify(String(rsp.params.robot_description))}`];
  if (t.type === "sensor_msgs/msg/JointState" && (by("jsp") || by("jsp_gui")) && model) {
    const js = Object.values(model.joints).filter((j) => j.type !== "fixed");
    return [0, 1].map((i) => `header:\n${stamp(i)}\n  frame_id: ''\nname:\n${js.map((j) => `- ${j.name}`).join("\n")}\nposition:\n${js.map((j) => `- ${f(jointValue(model, values, j))}`).join("\n")}\nvelocity: []\neffort: []`);
  }
  if (t.type === "tf2_msgs/msg/TFMessage" && by("rsp") && model) {
    const stat = name === "/tf_static", edges = urdfEdges(model, values, this.statesAvailable()).filter((e) => e.static === stat);
    if (!edges.length) return null;
    const tr = (e) => `- header:\n  ${stamp().replace(/\n/g, "\n  ")}\n    frame_id: ${e.parent}\n  child_frame_id: ${e.child}\n  transform:\n    translation:\n      x: ${f(e.t[0])}\n      y: ${f(e.t[1])}\n      z: ${f(e.t[2])}\n    rotation:\n      x: ${f(e.q[0])}\n      y: ${f(e.q[1])}\n      z: ${f(e.q[2])}\n      w: ${f(e.q[3])}`;
    const msg = `transforms:\n${edges.map(tr).join("\n")}`;
    return stat ? [msg] : [msg, msg];
  }
  return null;
};
RosGraph.prototype.kinSample = function (name, t) {
  const yamlHeader = (frame) => `header:\n  stamp:\n    sec: 1790921104\n    nanosec: 120000000\n  frame_id: ${frame}`;
  if (t.type === "sensor_msgs/msg/JointState") {
    const arm = this.nodes.find((n) => (n.kind === "arm" && `${n.ns}/joint_states` === name) || (this.vkind(n) === "arm" && n.kind === "custom" && this.endpoints(n).pubs.some(([nm]) => nm === name)));
    if (arm) return [`${yamlHeader("''")}\nname:\n- shoulder_joint\n- elbow_joint\nposition:\n- ${arm.q[0].toFixed(6)}\n- ${arm.q[1].toFixed(6)}\nvelocity: []\neffort: []`];
    const dd = this.nodes.find((n) => n.wcmd && this.endpoints(n).pubs.some(([nm]) => nm === name));
    if (dd) return [`${yamlHeader("''")}\nname:\n- left_wheel_joint\n- right_wheel_joint\nposition: []\nvelocity:\n- ${dd.wcmd[0].toFixed(6)}\n- ${dd.wcmd[1].toFixed(6)}\neffort: []`];
    const bot = this.nodes.find((n) => n.kind === "diffbot" && `${n.ns}/wheel_states` === name);
    if (bot) return [`${yamlHeader("''")}\nname:\n- left_wheel_joint\n- right_wheel_joint\nposition:\n- ${bot.wheels[0].toFixed(6)}\n- ${bot.wheels[1].toFixed(6)}\nvelocity: []\neffort: []`];
  }
  if (t.type === "geometry_msgs/msg/Point") {
    const fkn = this.nodes.find((n) => this.vkind(n) === "fk" && n.fkq && this.endpoints(n).pubs.some(([nm]) => nm === name));
    if (fkn) { const e = fk2(typeof fkn.params.link1_length === "number" ? fkn.params.link1_length : 1, typeof fkn.params.link2_length === "number" ? fkn.params.link2_length : 0.8, fkn.fkq); return [`x: ${e[0].toFixed(6)}\ny: ${e[1].toFixed(6)}\nz: 0.0`]; }
    let arm = this.nodes.find((n) => n.kind === "arm" && `${n.ns}/end_effector` === name);
    if (!arm && this.nodes.some((n) => this.vkind(n) === "fk" && this.endpoints(n).pubs.some(([nm]) => nm === name))) arm = this.nodes.find((n) => this.vkind(n) === "arm");
    if (arm) { const e = fk2(arm.params.link1_length, arm.params.link2_length, arm.q); return [`x: ${e[0].toFixed(6)}\ny: ${e[1].toFixed(6)}\nz: 0.0`]; }
  }
  if (t.type === "nav_msgs/msg/Odometry") {
    const gt = this.nodes.find((n) => n.kind === "diffbot" && `${n.ns}/ground_truth` === name);
    const bot = gt || this.nodes.find((n) => (n.kind === "diffbot" && `${n.ns}/odom` === name) || (n.kind === "custom" && this.vkind(n) === "diffbot" && this.endpoints(n).pubs.some(([nm]) => nm === name)));
    if (bot) { const b = gt ? (bot.truth ? { x: bot.truth.x, y: bot.truth.y, theta: bot.truth.theta, v: bot.base.v, w: bot.base.w } : bot.base) : bot.base; return [`${yamlHeader("odom")}\nchild_frame_id: base_link\npose:\n  pose:\n    position:\n      x: ${b.x.toFixed(6)}\n      y: ${b.y.toFixed(6)}\n      z: 0.0\n    orientation:\n      x: 0.0\n      y: 0.0\n      z: ${Math.sin(b.theta / 2).toFixed(6)}\n      w: ${Math.cos(b.theta / 2).toFixed(6)}\n  covariance: [0.0, ...]\ntwist:\n  twist:\n    linear:\n      x: ${fnum(r2(b.v))}\n      y: 0.0\n      z: 0.0\n    angular:\n      x: 0.0\n      y: 0.0\n      z: ${fnum(r2(b.w))}\n  covariance: [0.0, ...]`]; }
  }
  return null;
};
// student nodes that publish a fixed Twist from a timer drive the turtle once per second
RosGraph.prototype.tickCustom = function () {
  let moved = this.tickExtras();
  for (const n of this.nodes) {
    if (n.kind === "custom" && n.info && !n.info.twist && this.closedLoop(n)) moved = true;
    if (n.kind === "custom" && n.info && n.info.switchTwist && n.flags && n.flags[n.info.setbool.flag]) {
      const out = this.endpoints(n).pubs.find(([nm, t]) => /Twist$/.test(t) && nm.endsWith("/cmd_vel")); const hit = out && this.turtle(out[0].replace(/\/cmd_vel$/, ""));
      if (hit) { this.move(hit.t, n.info.switchTwist.lx, n.info.switchTwist.az, 1); moved = true; }
    }
    if (n.kind !== "custom" || !n.info || !n.info.twist) continue;
    for (const [nm, t] of this.endpoints(n).pubs) {
      if (t !== "geometry_msgs/msg/Twist" && t !== "Twist") continue;
      const hit = nm.endsWith("/cmd_vel") ? this.turtle(nm.replace(/\/cmd_vel$/, "")) : null;
      if (hit) { this.move(hit.t, n.info.twist.lx, n.info.twist.az, 1); moved = true; }
      const bot = this.nodes.find((b) => b.kind === "diffbot" && `${b.ns}/cmd_vel` === nm);
      if (bot) { this.driveBot(bot, n.info.twist.lx, n.info.twist.az, 1); moved = true; }
    }
  }
  return moved;
};
// a student node that reads a turtle's pose and publishes its cmd_vel, with goal_x/goal_y or waypoints parameters:
// simulate its P-controller (kv, kw) for one second
RosGraph.prototype.closedLoop = function (n) {
  const e = this.endpoints(n), P = n.params;
  const pub = e.pubs.find(([nm, t]) => /Twist$/.test(t) && nm.endsWith("/cmd_vel")), sub = e.subs.find(([nm, t]) => /Pose$/.test(t) && nm.endsWith("/pose"));
  if (!pub || !sub || pub[0].replace(/\/cmd_vel$/, "") !== sub[0].replace(/\/pose$/, "")) return false;
  const hit = this.turtle(pub[0].replace(/\/cmd_vel$/, "")); if (!hit) return false;
  let goal = null;
  if (n.goal) goal = n.goal;
  else if (typeof P.goal_x === "number" && typeof P.goal_y === "number") goal = [P.goal_x, P.goal_y];
  else if (Array.isArray(P.waypoints) && P.waypoints.length >= 2) { const k = n.wp || 0; goal = [P.waypoints[2 * k], P.waypoints[2 * k + 1]]; }
  if (!goal || (n.flags && n.flags.paused)) return false;
  const key = goal.join(",");
  if (n.reached === key && !Array.isArray(P.waypoints)) return false;
  const kv = typeof P.kv === "number" ? P.kv : 1, kw = typeof P.kw === "number" ? P.kw : 4, t = hit.t;
  for (let s = 0; s < 20; s++) {
    const dx = goal[0] - t.x, dy = goal[1] - t.y, d = Math.hypot(dx, dy);
    if (d < (Array.isArray(P.waypoints) ? 0.15 : 0.1)) {
      if (Array.isArray(P.waypoints)) { n.wp = ((n.wp || 0) + 1) % (P.waypoints.length / 2 | 0); const g = [P.waypoints[2 * n.wp], P.waypoints[2 * n.wp + 1]]; this.note(n, `[INFO] [${n.name}]: reached waypoint, next is (${fnum(g[0])}, ${fnum(g[1])})`); }
      else if (n.goal) { n.goal = null; this.note(n, `[INFO] [${n.name}]: arrived`); }
      else { n.reached = key; this.note(n, `[INFO] [${n.name}]: Goal reached: x=${t.x.toFixed(2)} y=${t.y.toFixed(2)}`); }
      break;
    }
    let err = Math.atan2(dy, dx) - t.theta; err = Math.atan2(Math.sin(err), Math.cos(err));
    this.move(t, Math.min(kv * d, 2), kw * err, 0.05);
  }
  return true;
};
// a student node that subscribes to one Twist topic and republishes to a turtle (a filter): forward the command,
// limited by max_speed and stopped near the walls when a margin parameter exists
RosGraph.prototype.relayTwist = function (topic, v, secs) {
  let moved = null;
  for (const n of this.nodes) {
    if (n.kind !== "custom" || !n.info) continue;
    const e = this.endpoints(n);
    if (!e.subs.some(([nm, t]) => nm === topic && /Twist$/.test(t))) continue;
    const out = e.pubs.find(([nm, t]) => /Twist$/.test(t) && nm !== topic && nm.endsWith("/cmd_vel"));
    const hit = out && this.turtle(out[0].replace(/\/cmd_vel$/, ""));
    if (!hit) continue;
    const lim = typeof n.params.max_speed === "number" ? n.params.max_speed : Infinity, m = typeof n.params.margin === "number" ? n.params.margin : null;
    let lx = Math.max(-lim, Math.min(lim, v.lx)), stopped = false;
    const first = lx;
    for (let s = 0; s < secs * 20; s++) {
      const t = hit.t, near = m !== null && (t.x < m || t.y < m || t.x > 11 - m || t.y > 11 - m);
      if (near && lx > 0) { if (!n.warned) this.note(n, `[WARN] [${n.name}]: Too close to a wall: only turning is allowed`); n.warned = true; lx = 0; stopped = true; }
      this.move(t, lx, v.az, 0.05);
    }
    moved = { n, hit, lx: first, stopped };
  }
  return moved;
};
// what `ros2 topic echo` shows for a topic published by a student node: the message fields with default values
RosGraph.prototype.customSample = function (name, t) {
  const n = this.nodes.find((x) => x.kind === "custom" && x.info && this.endpoints(x).pubs.some(([nm]) => nm === name));
  if (!n) return null;
  const def = this.allIfaces()[t.type];
  if (!def) return null;
  const code = n.info.code || "";
  const pose = (() => { const s = this.endpoints(n).subs.find(([nm, ty]) => /Pose$/.test(ty)); const h = s && this.turtle(s[0].replace(/\/pose$/, "")); return h ? h.t : null; })();
  const names = (code.match(/\.name\s*=\s*[\[{]([^\]}]*)[\]}]/) || [, ""])[1].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  const strVal = (f) => { const m = code.match(new RegExp(`\\.${f}\\s*=\\s*["']([^"']*)["']`)); return !m || !m[1] ? "''" : /: |^[\d\-'"{\[]|^(true|false|null)$/i.test(m[1]) ? `'${m[1]}'` : m[1]; };
  const L = [];
  for (const raw of def.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim(); if (!line || line === "---") continue;
    const [type, field] = line.split(/\s+/); if (!field || /=/.test(line)) continue;
    if (/^std_msgs\/Header$|^Header$/.test(type)) { L.push("header:", "  stamp:", "    sec: 1790921104", "    nanosec: 120000000", "  frame_id: ''"); continue; }
    if (/\[\]$/.test(type)) { const vals = field === "name" ? names : field === "position" || field === "velocity" ? names.map(() => "0.0") : []; L.push(vals.length ? `${field}:` : `${field}: []`, ...vals.map((v) => `- ${v}`)); continue; }
    if (type === "string") { L.push(`${field}: ${strVal(field)}`); continue; }
    if (type === "bool") { L.push(`${field}: false`); continue; }
    if (/^float/.test(type)) { const lv = n.level === undefined ? 100 : n.level; const v = n.info.battery && field === "percentage" ? fnum(+lv.toFixed(6)) : n.info.battery && field === "voltage" ? fnum(+(10 + 2.6 * lv / 100).toFixed(6)) : pose && (field === "x" || field === "y") ? fnum(+pose[field].toFixed(6)) : "0.0"; L.push(`${field}: ${v}`); continue; }
    if (/int/.test(type)) { L.push(`${field}: 0`); continue; }
  }
  return L.length ? [L.join("\n")] : null;
};
// request/response fields of a .srv (or goal/result/feedback of an .action) from its definition
RosGraph.prototype.fieldsOf = function (type, part) {
  const def = this.allIfaces()[type]; if (!def) return [];
  const sec = def.split(/^---\s*$/m)[part] || "";
  return sec.split("\n").map((l) => l.replace(/#.*$/, "").trim()).filter((l) => l && !/=/.test(l)).map((l) => { const [t, f] = l.split(/\s+/); return { t, f }; });
};
RosGraph.prototype.fmtField = function (t, v) { return t === "bool" ? (v ? "True" : "False") : t === "string" ? `'${v}'` : /^float/.test(t) ? fnum(+(+v).toFixed(6)) : String(Math.trunc(+v || 0)); };
RosGraph.prototype.customService = function (n, type, yaml, req, res) {
  const rq = this.fieldsOf(type, 0), rs = this.fieldsOf(type, 1);
  const val = {};
  for (const { t, f } of rq) val[f] = t === "bool" ? /true/i.test(this.str(yaml, f)) : t === "string" ? this.str(yaml, f) : this.num(yaml, f);
  const reqText = req(rq.map(({ t, f }) => `${f}=${this.fmtField(t, val[f])}`).join(", "));
  const out = Object.fromEntries(rs.map(({ t, f }) => [f, t === "bool" ? false : t === "string" ? "" : 0]));
  const cpp = n.info.lang === "cpp", num = (x) => (cpp ? (+x).toFixed(6) : fnum(+x));
  const L = [this.out(reqText)];
  if (n.info.setbool && "data" in val) {
    (n.flags = n.flags || {})[n.info.setbool.flag] = val.data;
    out.success = true; out.message = val.data ? n.info.setbool.on : n.info.setbool.off;
  } else if (/\/GoTo$/.test(type)) {
    const ok = val.x >= 0.5 && val.x <= 10.5 && val.y >= 0.5 && val.y <= 10.5;
    out.success = ok;
    out.message = ok ? `driving to (${num(val.x)}, ${num(val.y)})` : cpp ? "outside the safe area 0.5..10.5" : `(${num(val.x)}, ${num(val.y)}) is outside the safe area 0.5..10.5`;
    if (ok) { n.goal = [val.x, val.y]; this.note(n, `[INFO] [${n.name}]: ${out.message}`); }
  } else if (/\/MoveArm$/.test(type)) {
    const l1 = typeof n.params.link1_length === "number" ? n.params.link1_length : 1, l2 = typeof n.params.link2_length === "number" ? n.params.link2_length : 0.8;
    const q = ik2(l1, l2, val.x, val.y, false);
    if (!q) { out.success = false; out.message = `(${val.x.toFixed(2)}, ${val.y.toFixed(2)}) is out of reach (reach ${(l1 + l2).toFixed(2)} m)`; }
    else { out.success = true; out.shoulder = q[0]; out.elbow = q[1]; out.message = `moving: shoulder ${(q[0] * 180 / Math.PI).toFixed(1)} deg, elbow ${(q[1] * 180 / Math.PI).toFixed(1)} deg`; n.q = q; }
    this.note(n, `[INFO] [${n.name}]: ${out.message}`);
  } else if ("success" in out) {
    out.success = true;
    const lit = (n.info.code || "").match(/(?:response|res)(?:\.|->)message\s*=\s*["']([^"']*)["']/); if (lit && "message" in out && !/data/.test(rq.map((x) => x.f).join())) out.message = lit[1];
    if (n.info.battery && /Trigger$/.test(type)) { n.level = 100; n.bwarned = false; this.note(n, `[INFO] [${n.name}]: Recharged to 100 %`); }
  }
  return [...L, ...res(rs.map(({ t, f }) => `${f}=${this.fmtField(t, out[f])}`).join(", "))];
};
RosGraph.prototype.customAction = function (n, name, type, yaml, rest) {
  const gf = this.fieldsOf(type, 0), rf = this.fieldsOf(type, 1), ff = this.fieldsOf(type, 2);
  const g = Object.fromEntries(gf.map(({ f }) => [f, this.num(yaml, f)]));
  const L = [this.out("Waiting for an action server to become available..."), this.out("Sending goal:"), ...gf.map(({ t, f }, i) => this.out(`${i ? "" : "     "}${f}: ${this.fmtField(t, g[f])}`)), this.out("")];
  if (/\/DriveDistance$/.test(type)) {
    if (!(g.distance > 0) || !(g.speed > 0 && g.speed <= 2)) { this.note(n, `[WARN] [${n.name}]: Rejected: distance must be > 0 and speed in (0, 2]`); return [...L, this.out("Goal was rejected.")]; }
    L.push(this.out(`Goal accepted with ID: ${hex()}`), this.out(""));
    if (rest.includes("--feedback") || rest.includes("-f")) for (let k = 1; k <= 4; k++) L.push(this.out("Feedback:"), this.out(`    remaining: ${fnum(+(g.distance * (1 - k / 4)).toFixed(6))}`), this.out(""));
    const out = this.endpoints(n).pubs.find(([nm, t]) => /Twist$/.test(t) && nm.endsWith("/cmd_vel")); const hit = out && this.turtle(out[0].replace(/\/cmd_vel$/, ""));
    if (hit) this.move(hit.t, g.distance, 0, 1);
    this.note(n, `[INFO] [${n.name}]: Done: drove ${g.distance.toFixed(2)} m`);
    L.push(this.out("Result:"), this.out(`    distance_driven: ${fnum(g.distance)}`), this.out(""), this.out("Goal finished with status: SUCCEEDED"));
    if (hit) L.push(this.hint(`(${hit.t.name} drove ${fnum(g.distance)} m and is now at x=${hit.t.x.toFixed(2)}, y=${hit.t.y.toFixed(2)}.)`));
    return L;
  }
  L.push(this.out(`Goal accepted with ID: ${hex()}`), this.out(""), this.out("Result:"), ...rf.map(({ t, f }) => this.out(`    ${f}: ${this.fmtField(t, 0)}`)), this.out(""), this.out("Goal finished with status: SUCCEEDED"));
  return L;
};
RosGraph.prototype.paramRule = function (n, k, v) {
  const I = n.info, cpp = I.lang === "cpp";
  if (I.readOnly.includes(k)) return cpp ? `parameter '${k}' cannot be set because it is read-only` : `Trying to set a read-only parameter: ${k}.`;
  if (I.ranges[k] && typeof v === "number" && (v < I.ranges[k][0] || v > I.ranges[k][1])) return cpp ? `Parameter {${k}} doesn't comply with floating point range.` : `Parameter ${k} out of range Min: ${fnum(I.ranges[k][0])}, Max: ${fnum(I.ranges[k][1])}, value: ${fnum(v)}`;
  for (const r of I.rules) if (r.name === k && typeof v === "number" && Math.abs(v) > r.max) return r.reason;
  return null;
};
RosGraph.prototype.tickExtras = function () {
  let moved = false;
  for (const n of this.nodes) {
    if (n.kind !== "custom" || !n.info) continue;
    const I = n.info;
    if (I.paramTwist) {
      const out = this.endpoints(n).pubs.find(([nm, t]) => /Twist$/.test(t) && nm.endsWith("/cmd_vel")); const hit = out && this.turtle(out[0].replace(/\/cmd_vel$/, ""));
      if (hit) { this.move(hit.t, Number(n.params[I.paramTwist.lx]) || 0, I.paramTwist.az ? Number(n.params[I.paramTwist.az]) || 0 : 0, 1); moved = true; }
    }
    if (I.battery) {
      const s = this.endpoints(n).subs.find(([nm, ty]) => /Pose$/.test(ty)); const h = s && this.turtle(s[0].replace(/\/pose$/, ""));
      if (n.level === undefined) n.level = 100;
      if (h) {
        if (n.blast) n.level = Math.max(0, n.level - Math.hypot(h.t.x - n.blast[0], h.t.y - n.blast[1]) * (Number(n.params.drain_per_metre) || 0));
        n.blast = [h.t.x, h.t.y];
      }
      const low = Number(n.params.low_level); if (n.level < low && !n.bwarned) { this.note(n, `[WARN] [${n.name}]: Battery low: ${n.level.toFixed(1)} %. Please recharge!`); n.bwarned = true; }
    }
    if (I.square && !(n.sq && n.sq.done)) {   // run the state machine for one second of ticks
      const out = this.endpoints(n).pubs.find(([nm, t]) => /Twist$/.test(t) && nm.endsWith("/cmd_vel")); const hit = out && this.turtle(out[0].replace(/\/cmd_vel$/, ""));
      const q = I.square, st = n.sq = n.sq || { state: "FORWARD", ticks: 0, sides: 0, done: false };
      if (hit) for (let k = 0; k < Math.round(1 / q.dt) && !st.done; k++) {
        st.ticks++;
        if (st.state === "FORWARD") { this.move(hit.t, q.lx, 0, q.dt); if (st.ticks >= q.fwd) { st.state = "TURN"; st.ticks = 0; } }
        else { this.move(hit.t, 0, q.az, q.dt); if (st.ticks >= q.turn) { st.state = "FORWARD"; st.ticks = 0; st.sides++; this.note(n, `[INFO] [${n.name}]: side ${st.sides} done`); } }
        if (st.sides === q.sides) { this.note(n, `[INFO] [${n.name}]: Square finished!`); st.done = true; }
      }
      if (hit) moved = true;
    }
    if (I.lifecycle && n.lstate === "active" && I.lcTwist) {
      const out = this.endpoints(n).pubs.find(([nm, t]) => /Twist$/.test(t) && nm.endsWith("/cmd_vel")); const hit = out && this.turtle(out[0].replace(/\/cmd_vel$/, ""));
      if (hit) { this.move(hit.t, I.lcTwist.lx, I.lcTwist.az, 1); moved = true; }
    }
    if (I.follow) {
      const sim = this.nodes.find((x) => x.kind === "turtlesim"); if (!sim) continue;
      const spawnCli = I.cli.some(([nm]) => /spawn$/.test(nm));
      let me = this.turtle(I.follow.me), tg = this.turtle(I.follow.target);
      if (!me && spawnCli && sim) { sim.turtles.push(newTurtle(I.follow.me, 1, 1, 0)); this.note(sim, `[INFO] [${sim.name}]: Spawning turtle [${I.follow.me}] at x=[1.000000], y=[1.000000], theta=[0.000000]`); me = this.turtle(I.follow.me); moved = true; continue; }
      if (!me || !tg) continue;
      const casters = this.nodes.filter((x) => x.kind === "custom" && x.info && x.info.broadcaster).map((x) => String(x.params.turtlename || "turtle1"));
      if (!casters.includes(I.follow.me) || !casters.includes(I.follow.target)) { if (!n.tfWarned) this.note(n, `[INFO] [${n.name}]: Could not transform ${I.follow.target} to ${I.follow.me}: "${casters.includes(I.follow.me) ? I.follow.target : I.follow.me}" passed to lookupTransform argument ${casters.includes(I.follow.me) ? "source_frame" : "target_frame"} does not exist.`); n.tfWarned = true; continue; }
      for (let s = 0; s < 20; s++) {
        const a = me.t, b = tg.t, dx = b.x - a.x, dy = b.y - a.y, c = Math.cos(-a.theta), si = Math.sin(-a.theta);
        const lx = c * dx - si * dy, ly = si * dx + c * dy;
        this.move(a, I.follow.kv * Math.hypot(lx, ly), I.follow.kw * Math.atan2(ly, lx), 0.05);
      }
      moved = true;
    }
  }
  return moved;
};
// a student service-client program (spawn_client, turtle_artist): spawn a turtle, maybe set its pen and teleport it around, print, exit
RosGraph.prototype.runServiceClient = function (n, info) {
  const code = info.code || "", cpp = info.lang === "cpp", log = (lvl, t) => this.out(`[${lvl}] [${n.name}]: ${t}`);
  const sim = this.nodes.find((x) => x.kind === "turtlesim");
  if (!sim) return [log("INFO", "waiting for /spawn ... is turtlesim running?"), log("INFO", "waiting for /spawn ... is turtlesim running?"), this.out("^C"), this.hint("(The client waits for the /spawn service forever. Start turtlesim first, then run the client again.)")];
  const num = (k) => { const m = code.match(new RegExp(`Spawn\\.Request\\([^)]*\\b${k}\\s*=\\s*(-?[\\d.]+)`)) || code.match(new RegExp(`\\w+(?:->|\\.)${k}\\s*=\\s*(-?[\\d.]+)f?\\s*[;\\n]`)); return m ? Number(m[1]) : 0; };
  const nm = (code.match(/Spawn\.Request\([^)]*name\s*=\s*['"](\w*)['"]/) || code.match(/->name\s*=\s*"(\w*)"/) || code.match(/\.name\s*=\s*['"](\w*)['"]/) || [, ""])[1];
  const x = num("x"), y = num("y"), th = num("theta");
  const L = [];
  let name = nm;
  if (nm && sim.turtles.some((t) => t.name === nm)) { this.note(sim, `[ERROR] [${sim.name}]: A turtle named [${nm}] already exists`); name = ""; }
  else { if (!name) { let k = 2; while (sim.turtles.some((t) => t.name === `turtle${k}`)) k++; name = `turtle${k}`; } sim.turtles.push(newTurtle(name, x, y, th)); this.note(sim, `[INFO] [${sim.name}]: Spawning turtle [${name}] at x=[${x.toFixed(6)}], y=[${y.toFixed(6)}], theta=[${th.toFixed(6)}]`); }
  const said = (code.match(/(?:info\(\s*f?['"]|RCLCPP_INFO\([^"]*")([^'"{%]*?(?:spawned|made a turtle called)[^'"{%]*)/) || [, "spawned "])[1].trim();
  L.push(log("INFO", `${said} ${name}`));
  const t = sim.turtles.find((q) => q.name === (name || nm));
  const pen = code.match(/SetPen\.Request\(\s*r\s*=\s*(\d+),\s*g\s*=\s*(\d+),\s*b\s*=\s*(\d+),\s*width\s*=\s*(\d+)/) || code.match(/->r\s*=\s*(\d+);\s*\w+->g\s*=\s*(\d+);\s*\w+->b\s*=\s*(\d+);\s*\w+->width\s*=\s*(\d+)/);
  if (t && pen) t.pen = { r: +pen[1], g: +pen[2], b: +pen[3], width: +pen[4] || 1, off: 0 };
  const list = code.match(/for\s+\w+\s*,\s*\w+\s+in\s+\[([^\]]*)\]/) || code.match(/corners\s*=\s*\{([^;]*)\};/);
  if (t && list) for (const m of list[1].matchAll(/[({]\s*(-?[\d.]+)f?\s*,\s*(-?[\d.]+)f?\s*[)}]/g)) {
    const cx = +m[1], cy = +m[2]; this.draw(t, [[t.x, t.y], [cx, cy]]); Object.assign(t, { x: cx, y: cy, theta: 0 });
    L.push(log("INFO", `line to (${cpp ? cx.toFixed(1) : fnum(cx)}, ${cpp ? cy.toFixed(1) : fnum(cy)})`));
  }
  this.version = (this.version || 0) + 1;
  L.push(this.hint(name ? `(Your client program asked turtlesim for a turtle called ${name}, printed the answer and ended. Look at the TurtleSim window and at: ros2 service list)` : "(turtlesim refused: that name is already taken, so the answer's name is empty. Its own terminal shows an ERROR line. Change request.name and build again.)"));
  return L;
};
// a student action client (drive_distance_client): send the goal to the server, print what the client logs, then exit
RosGraph.prototype.runActionClient = function (n, lines) {
  const I = n.info, P = n.params, cpp = I.lang === "cpp";
  const [aname] = I.actc[0], full = aname.startsWith("/") ? aname : `${n.ns}/${aname}`;
  const srv = this.nodes.find((x) => x !== n && x.info && this.endpoints(x).acts.some(([nm]) => nm === full));
  const log = (t) => this.out(`[INFO] [${n.name}]: ${t}`);
  if (!srv) return [...lines, this.hint(`(Your client waits for the action server ${full}. Start the server in another terminal first.)`)];
  const d = Number(P.distance), sp = Number(P.speed), cancel = Number(P.cancel_after) || 0;
  const L = [log(`Sending goal: ${d.toFixed(1)} m at ${sp.toFixed(1)} m/s`)];
  if (!(d > 0) || !(sp > 0 && sp <= 2)) { this.note(srv, `[WARN] [${srv.name}]: Rejected: distance must be > 0 and speed in (0, 2]`); return [...L, this.out(`[WARN] [${n.name}]: Goal rejected`)]; }
  L.push(log("Goal accepted"));
  const steps = Math.round(d / (sp * 0.1)), stop = cancel > 0 ? Math.min(steps, Math.round(cancel / 0.1) + 1) : steps;
  let driven = 0;
  for (let k = 1; k <= stop; k++) { driven = Math.min(d, k * sp * 0.1); if (k % Math.max(1, Math.round(steps / 6)) === 0 || k === stop) L.push(log(`remaining: ${(d - driven).toFixed(2)} m`)); }
  if (cancel > 0 && stop < steps) L.push(log("Changed my mind: cancelling"));
  const out = this.endpoints(srv).pubs.find(([nm, t]) => /Twist$/.test(t) && nm.endsWith("/cmd_vel")); const hit = out && this.turtle(out[0].replace(/\/cmd_vel$/, ""));
  if (hit) this.move(hit.t, driven, 0, 1);
  const status = cancel > 0 && stop < steps ? 5 : 4;
  this.note(srv, status === 4 ? `[INFO] [${srv.name}]: Done: drove ${driven.toFixed(2)} m` : `[INFO] [${srv.name}]: Cancel requested`);
  L.push(log(`Result: drove ${driven.toFixed(2)} m (${cpp ? "code" : "status"} ${status})`));
  return L;
};
const LC_ID = { unconfigured: 1, inactive: 2, active: 3, finalized: 4 };
const LC_MOVES = { unconfigured: [["configure", 1, "inactive"], ["shutdown", 5, "finalized"]], inactive: [["cleanup", 2, "unconfigured"], ["activate", 3, "active"], ["shutdown", 6, "finalized"]], active: [["deactivate", 4, "inactive"], ["shutdown", 7, "finalized"]], finalized: [] };
RosGraph.prototype.cmdLifecycle = function (a, rest) {
  const lc = this.nodes.filter((n) => n.info && n.info.lifecycle);
  if (a === "nodes") return lc.map((n) => this.out(n.full));
  const n = this.node(rest[0] || "");
  if (!n) return [this.err(`Node not found`)];
  if (!(n.info && n.info.lifecycle)) return [this.err(`Node ${n.full} is not a managed node (it has no lifecycle)`)];
  n.lstate = n.lstate || "unconfigured";
  if (a === "get") return [this.out(`${n.lstate} [${LC_ID[n.lstate]}]`)];
  if (a === "list") return LC_MOVES[n.lstate].flatMap(([t, id, goal]) => [this.out(`- ${t} [${id}]`), this.out(`\tStart: ${n.lstate}`), this.out(`\tGoal: ${goal === "finalized" ? "shuttingdown" : { inactive: t === "configure" ? "configuring" : "deactivating", active: "activating", unconfigured: "cleaningup" }[goal]}`)]);
  if (a === "set") {
    const mv = LC_MOVES[n.lstate].find(([t]) => t === rest[1]);
    if (!mv) return [this.out("Unknown transition requested, available ones are:"), ...LC_MOVES[n.lstate].map(([t, id]) => this.out(`- ${t} [${id}]`))];
    n.lstate = mv[2];
    if (n.info.lcLogs[mv[0]]) this.note(n, `[INFO] [${n.name}]: ${n.info.lcLogs[mv[0]]}`);
    return [this.out("Transitioning successful")];
  }
  return [this.err(`ros2 lifecycle: unknown command '${a}'`), this.hint("Try: nodes, get, list, set")];
};
RosGraph.prototype.cmdComponent = function (a, rest) {
  const conts = this.nodes.filter((n) => n.kind === "container");
  const comps = () => { const all = {}; for (const pk of this.sh.wsPkgs ? this.sh.wsPkgs.values() : []) for (const [cls, inf] of Object.entries(pk.components || {})) all[cls] = { pkg: pk.name, inf }; return all; };
  if (a === "types") { const by = {}; for (const [cls, c] of Object.entries(comps())) (by[c.pkg] = by[c.pkg] || []).push(cls); return Object.entries(by).flatMap(([pk, cl]) => [this.out(pk), ...cl.map((c) => this.out(`  ${c}`))]); }
  if (a === "list") return conts.flatMap((c) => [this.out(c.full), ...(c.loaded || []).map((x, i) => this.out(`  ${i + 1}  ${x}`))]);
  const cont = this.node(rest[0] || "");
  if (a === "load") {
    if (!cont || cont.kind !== "container") return [this.err(`Unable to find component manager node '${rest[0] || ""}'`), this.hint("Start one first: ros2 run rclcpp_components component_container")];
    const c = comps()[rest[2] || ""];
    if (!c || c.pkg !== rest[1]) return [this.err(`Failed to load component: Failed to find class with the requested plugin name '${rest[2] || ""}' in the loaded library`), this.hint("List what is available with: ros2 component types (and source the workspace)")];
    const n = this.add("custom", c.inf.node || "component", "", { ...c.inf.params });
    n.info = c.inf; n.ptypes = { ...c.inf.ptypes };
    cont.loaded = [...(cont.loaded || []), n.full];
    if (c.inf.logs[0]) this.note(cont, c.inf.logs[0]);
    return [this.out(`Loaded component ${cont.loaded.length} into '${cont.full}' container node as '${n.full}'`)];
  }
  if (a === "unload") {
    if (!cont || cont.kind !== "container") return [this.err(`Unable to find component manager node '${rest[0] || ""}'`)];
    const id = Number(rest[1]), full = (cont.loaded || [])[id - 1];
    if (!full) return [this.err(`Failed to unload component ${rest[1]} from '${cont.full}' container node`)];
    this.nodes = this.nodes.filter((x) => x.full !== full); cont.loaded[id - 1] = null; cont.loaded = cont.loaded.filter(Boolean);
    return [this.out(`Unloaded component ${id} from '${cont.full}' container node`)];
  }
  return [this.err(`ros2 component: unknown command '${a}'`), this.hint("Try: types, list, load, unload")];
};
// fill "…" in a student node's start-up log lines with the real parameter values, where the code makes that possible
RosGraph.prototype.renderLogs = function (n, lines) {
  const I = n.info, P = n.params, out = lines.slice();
  const val = (k, fmt) => { const v = P[k]; if (v === undefined) return null; if (typeof v === "number") { const m = fmt && fmt.match(/\.(\d+)f/); return m ? v.toFixed(+m[1]) : I.lang === "cpp" ? String(v) : fnum(v); } return String(v); };
  const logIdx = out.map((t, i) => (/^\[(INFO|WARN|ERROR)\]/.test(t) ? i : -1)).filter((i) => i >= 0);
  if (I.lang === "python" && I.tpl) I.tpl.forEach((t, k) => {
    const i = logIdx[k]; if (i === undefined) return;
    let ok = true;
    const text = t.py.replace(/\{([^}:]+)(?::([^}]*))?\}/g, (all, expr, fmt) => {
      expr = expr.trim();
      const keyOf = (x) => { x = x.trim(); const gp = x.match(/^self\.get_parameter\(\s*['"](\w+)['"]\)\.value$/); return gp ? gp[1] : I.pyVars[x] || (x.startsWith("self.") && x.slice(5) in P ? x.slice(5) : null); };
      const parts = expr.split("+");
      if (parts.length === 2 && keyOf(parts[0]) && keyOf(parts[1])) { const a = Number(P[keyOf(parts[0])]), b = Number(P[keyOf(parts[1])]); const m = fmt && fmt.match(/\.(\d+)f/); return m ? (a + b).toFixed(+m[1]) : fnum(+(a + b).toFixed(10)); }
      const key = keyOf(expr);
      const v = key ? val(key, fmt) : null; if (v === null) { ok = false; return "…"; } return v;
    });
    if (ok) out[i] = out[i].replace(/\]: .*$/, `]: ${text}`);
  });
  if (I.lang === "cpp" && I.ctpl) I.ctpl.forEach((t, k) => {
    const i = logIdx[k]; if (i === undefined || !/%/.test(t.fmt)) return;
    let a = 0, ok = true;
    const text = t.fmt.replace(/%%/g, "\u0000").replace(/%[-.\d]*[lz]*([sdfiu])/g, (all, ty) => {
      const arg = t.args[a++] || "";
      const keyOf = (x) => { x = x.trim().replace(/\.c_str\(\)$/, ""); const g = x.match(/get_parameter\(\s*"(\w+)"\s*\)/); return g ? g[1] : I.cVars[x] || null; };
      const sum = arg.split("+");
      if (sum.length === 2 && keyOf(sum[0]) && keyOf(sum[1])) { const m = all.match(/\.(\d+)f/); const tot = Number(P[keyOf(sum[0])]) + Number(P[keyOf(sum[1])]); return m ? tot.toFixed(+m[1]) : String(tot); }
      const key = keyOf(arg);
      const v = key ? val(key, all) : null; if (v === null) { ok = false; return "…"; }
      return ty === "f" && !/\.\d+f/.test(all) ? Number(v).toFixed(6) : v;
    }).replace(/\u0000/g, "%");
    if (ok) out[i] = out[i].replace(/\]: .*$/, `]: ${text}`);
  });
  return out;
};
// ---------- a small tf2: frames from static publishers, robot_state_publisher + arm, odometry, turtle broadcasters ----------
function qRPY(r, p, y) { const cr = Math.cos(r / 2), sr = Math.sin(r / 2), cp = Math.cos(p / 2), sp = Math.sin(p / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2); return [sr * cp * cy - cr * sp * sy, cr * sp * cy + sr * cp * sy, cr * cp * sy - sr * sp * cy, cr * cp * cy + sr * sp * sy]; }
function qMul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
function qRot(q, v) { const p = qMul(qMul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [p[0], p[1], p[2]]; }
const tMul = (A, B) => { const r = qRot(A.q, B.t); return { t: [A.t[0] + r[0], A.t[1] + r[1], A.t[2] + r[2]], q: qMul(A.q, B.q) }; };
const tInv = (A) => { const qi = [-A.q[0], -A.q[1], -A.q[2], A.q[3]], r = qRot(qi, A.t); return { t: [-r[0], -r[1], -r[2]], q: qi }; };
export function urdfLinks(text) { return [...String(text).matchAll(/<link\s+name="([^"]+)"/g)].map((m) => m[1]); }
RosGraph.prototype.tfTree = function () {
  const E = [];
  for (const n of this.nodes) {
    if (n.kind === "static_tf" && n.tf) E.push({ ...n.tf });
    const vk = this.vkind(n);
    if (vk === "diffbot" && n.base) E.push({ parent: "odom", child: "base_link", t: [n.base.x, n.base.y, 0], q: qRPY(0, 0, n.base.theta) });
    if (n.kind === "custom" && n.info && n.info.broadcaster) { const nm = String(n.params.turtlename || "turtle1"), h = this.turtle(nm); if (h) E.push({ parent: "world", child: nm, t: [h.t.x, h.t.y, 0], q: qRPY(0, 0, h.t.theta) }); }
  }
  if (this.gzRunning()) E.push(...this.gzTfEdges(), ...this.cmTfEdges());
  const rsp = this.nodes.find((n) => n.kind === "rsp" && n.params.robot_description), arm = this.nodes.find((n) => this.vkind(n) === "arm");
  const model = rsp && !arm ? this.robotModel() : null;
  if (model) { E.push(...urdfEdges(model, this.jointValues(), this.statesAvailable()).map((e) => ({ parent: e.parent, child: e.child, t: e.t, q: e.q }))); return E; }
  if (rsp) {
    const q = arm ? arm.q : [0, 0], L1 = arm ? arm.params.link1_length : 1, L2 = arm ? arm.params.link2_length : 0.8;
    E.push({ parent: "base_link", child: "link1", t: [0, 0, 0.05], q: qRPY(0, 0, q[0]) }, { parent: "link1", child: "link2", t: [L1, 0, 0], q: qRPY(0, 0, q[1]) }, { parent: "link2", child: "tool", t: [L2, 0, 0], q: [0, 0, 0, 1] });
  }
  return E;
};
RosGraph.prototype.tfLookup = function (target, source) {
  const E = this.tfTree(), up = (f) => { const path = []; let cur = f, guard = 0; while (guard++ < 20) { const e = E.find((x) => x.child === cur); if (!e) break; path.push(e); cur = e.parent; } return { root: cur, path }; };
  const known = (f) => E.some((e) => e.child === f || e.parent === f);
  if (!known(target)) return { err: `Invalid frame ID "${target}" passed to canTransform argument target_frame - frame does not exist` };
  if (!known(source)) return { err: `Invalid frame ID "${source}" passed to canTransform argument source_frame - frame does not exist` };
  const a = up(target), b = up(source);
  if (a.root !== b.root) return { err: `Could not find a connection between '${target}' and '${source}' because they are not part of the same tree.Tf has two or more unconnected trees.` };
  const toRoot = (pth) => pth.reduceRight((acc, e) => tMul(acc, { t: e.t, q: e.q }), { t: [0, 0, 0], q: [0, 0, 0, 1] });
  return { T: tMul(tInv(toRoot(a.path)), toRoot(b.path)) };
};
RosGraph.prototype.tfEcho = function (target, source) {
  if (!target || !source) return [this.err("usage: ros2 run tf2_ros tf2_echo <source_frame> <target_frame>"), this.hint("Example: ros2 run tf2_ros tf2_echo world turtle1")];
  const r = this.tfLookup(target, source);
  if (r.err) return [this.out(`[INFO] [tf2_echo]: Waiting for transform ${target} ->  ${source}: ${r.err}`), this.out("^C"), this.hint("tf2_echo waits until both frames exist. Start the node that broadcasts them.")];
  const { t, q } = r.T, f = (x) => (Math.abs(x) < 5e-4 ? (x < 0 ? "-0.000" : "0.000") : x.toFixed(3));
  const roll = Math.atan2(2 * (q[3] * q[0] + q[1] * q[2]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])), pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (q[3] * q[1] - q[2] * q[0])))), yaw = Math.atan2(2 * (q[3] * q[2] + q[0] * q[1]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
  const ex = qRot(q, [1, 0, 0]), ey = qRot(q, [0, 1, 0]), ez = qRot(q, [0, 0, 1]);
  const pad = (x) => (x.startsWith("-") ? "" : " ") + x;
  const block = (k) => [`At time 1790921${104 + k}.120000000`, `- Translation: [${t.map(f).join(", ")}]`, `- Rotation: in Quaternion (xyzw) [${q.map(f).join(", ")}]`, `- Rotation: in RPY (radian) [${[roll, pitch, yaw].map(f).join(", ")}]`, `- Rotation: in RPY (degree) [${[roll, pitch, yaw].map((x) => f(x * 180 / Math.PI)).join(", ")}]`, "- Matrix:",
    ...[0, 1, 2].map((i) => ` ${[ex[i], ey[i], ez[i], t[i]].map((x) => pad(f(x))).join(" ")}`), "  0.000  0.000  0.000  1.000"];
  return [...block(0), ...block(1)].map((x) => this.out(x)).concat([this.out("^C"), this.hint(`(tf2_echo prints ${source} as seen from ${target} once per second until Ctrl+C.)`)]);
};
RosGraph.prototype.robots = function () { return this.nodes.filter((n) => ["arm", "diffbot"].includes(this.vkind(n))); };

RosGraph.prototype.turtlesims = function () { return this.nodes.filter((n) => n.kind === "turtlesim"); };

const baseName = (p) => p.split("/").filter(Boolean).pop() || "/";
export const pkgExecutables = (pkg) => PKG_EXES[pkg] || null;

// ---------- reads a student's node source (Python or C++) to find its name, topics, services, parameters and first log lines ----------
// a node "drives by itself" only if a timer publishes fixed numbers and nothing is conditional
function constantTwist(code) {
  if (/Lifecycle/.test(code)) return false;
  const body = code.replace(/if\s+__name__\s*==/g, "").replace(/\s#.*$/gm, "").replace(/\/\/.*$/gm, "");
  const all = (re) => (body.match(re) || []).length;
  const lin = all(/\.linear\.x\s*=[^=]/g), ang = all(/\.angular\.z\s*=[^=]/g);
  const linN = all(/\.linear\.x\s*=\s*-?\d*\.?\d+\s*[;\n]/g), angN = all(/\.angular\.z\s*=\s*-?\d*\.?\d+\s*[;\n]/g);
  return /create_(wall_)?timer\s*[<(]/.test(body) && (lin + ang) > 0 && lin === linN && ang === angN && lin <= 1 && ang <= 1 && !/\bif\b|\?/.test(body.replace(/#.*$/gm, "").replace(/\/\/.*$/gm, ""));
}
export function parseNodeCode(code, lang) {
  const info = { node: null, pubs: [], subs: [], srvs: [], cli: [], acts: [], actc: [], params: {}, ptypes: {}, logs: [], code };
  const clean = code.replace(lang === "python" ? /^\s*#.*$/gm : /\/\/.*$/gm, "");
  const lit = (v) => { v = v.trim(); const arr = v.match(/^[\[{]([-\d.,\s]*)[\]}]$/); if (arr) return arr[1].split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)); if (/^(True|true)$/.test(v)) return true; if (/^(False|false)$/.test(v)) return false; if (/^-?\d+$/.test(v)) return Number(v); if (/^-?\d*\.\d+(e-?\d+)?$|^-?\d+\.$/.test(v)) return Number(v); const m = v.match(/^["'](.*)["']$/); return m ? m[1] : null; };
  const fl = lang === "python" ? clean.match(/self\.(\w+)\s*=\s*request\.data/) : clean.match(/(\w+)\s*=\s*req(?:uest)?->data/);
  if (fl) {
    const v = fl[1].replace(/\W/g, "");
    const mm = lang === "python" ? clean.match(new RegExp(`['"]([\\w ]+)['"] if self\\.${v} else ['"]([\\w ]+)['"]`)) : clean.match(new RegExp(`${v}\\s*\\?\\s*"([\\w ]+)"\\s*:\\s*"([\\w ]+)"`));
    info.setbool = { flag: v.replace(/_$/, ""), on: mm ? mm[1] : "", off: mm ? mm[2] : "" };
    const lx = clean.match(/\.linear\.x\s*=\s*(-?\d*\.?\d+)/), az = clean.match(/\.angular\.z\s*=\s*(-?\d*\.?\d+)/);
    if (/enable/.test(v) && (lx || az)) info.switchTwist = { lx: lx ? Number(lx[1]) : 0, az: az ? Number(az[1]) : 0 };
  }
  info.lang = lang;
  if (lang === "python") {
    const types = {};
    for (const m of clean.matchAll(/from[ \t]+(\w+)\.(msg|srv|action)[ \t]+import[ \t]+(\([^)]*\)|[\w \t,]+)/g)) for (const t of m[3].replace(/[()]/g, "").split(",").map((x) => x.trim()).filter(Boolean)) types[t.split(/\s+as\s+/).pop()] = `${m[1]}/${m[2]}/${t.split(/\s+as\s+/)[0]}`;
    const T = (x) => types[x] || x;
    const nm = clean.match(/super\(\)\.__init__\(\s*(?:node_name\s*=\s*)?["']([\w]+)["']/) || clean.match(/Node\(\s*["']([\w]+)["']/); if (nm) info.node = nm[1];
    for (const m of clean.matchAll(/create_publisher\(\s*(\w+)\s*,\s*["']([\w/~]+)["']/g)) info.pubs.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/create_subscription\(\s*(\w+)\s*,\s*["']([\w/~]+)["']/g)) info.subs.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/create_service\(\s*(\w+)\s*,\s*["']([\w/~]+)["']/g)) info.srvs.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/create_client\(\s*(\w+)\s*,\s*["']([\w/~]+)["']/g)) info.cli.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/ActionServer\(\s*\w+\s*,\s*(\w+)\s*,\s*["']([\w/~]+)["']/g)) info.acts.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/ActionClient\(\s*\w+\s*,\s*(\w+)\s*,\s*["']([\w/~]+)["']/g)) info.actc.push([m[2], T(m[1])]);
    const lx = clean.match(/\.linear\.x\s*=\s*(-?\d*\.?\d+)/), az = clean.match(/\.angular\.z\s*=\s*(-?\d*\.?\d+)/);
    if (constantTwist(clean)) info.twist = { lx: lx ? Number(lx[1]) : 0, az: az ? Number(az[1]) : 0 };
    for (const m of clean.matchAll(/declare_parameter\(\s*["'](\w+)["']\s*(?:,\s*(\[[^\]]*\]|[^,)]+))?/g)) { const v = m[2] === undefined ? null : lit(m[2]); info.params[m[1]] = v === null ? "" : v; if (typeof v === "number" && /\./.test(m[2])) info.ptypes[m[1]] = "double"; }
    const a0 = clean.search(/super\(\)\.__init__\(/), a1 = a0 < 0 ? -1 : clean.slice(a0).search(/\n    def |\ndef /);
    const ctorPy = a0 < 0 ? "" : clean.slice(a0, a1 < 0 ? undefined : a0 + a1);
    info.pyVars = {};
    for (const m of clean.matchAll(/(self\.\w+|\b\w+)\s*=\s*self\.(?:get_parameter|declare_parameter)\(\s*['"](\w+)['"][^)]*\)\.value/g)) info.pyVars[m[1].replace(/^self\./, "self.")] = m[2];
    for (const m of clean.matchAll(/(self\.\w+)\s*=\s*self\.get_parameter\(\s*['"](\w+)['"]\)\.value/g)) info.pyVars[m[1]] = m[2];
    info.tpl = [];
    for (const m of ctorPy.matchAll(/get_logger\(\)\.(info|warn|warning|error)\(\s*(f?)(["'])(.*?)\3/g)) if (m[2] && info.tpl.length < 3) info.tpl.push({ i: info.tpl.length, py: m[4] });
    for (const m of ctorPy.matchAll(/get_logger\(\)\.(info|warn|warning|error)\(\s*(f?)(["'])(.*?)\3/g)) if (info.logs.length < 3) info.logs.push(`[${m[1] === "info" ? "INFO" : m[1] === "error" ? "ERROR" : "WARN"}] [${info.node || "node"}]: ${m[2] ? m[4].replace(/\{[^}]*\}/g, "…") : m[4]}`);
  } else {
    const alias = {};
    for (const m of clean.matchAll(/using\s+(\w+)\s*=\s*([\w:]+)\s*;/g)) alias[m[1]] = m[2];
    for (const m of clean.matchAll(/using\s+((?:\w+::)+)(\w+)\s*;/g)) alias[m[2]] = m[1] + m[2];
    const T = (x) => { x = alias[x.trim()] || x.trim(); const m = x.match(/^(\w+)::(msg|srv|action)::(\w+)$/); return m ? `${m[1]}/${m[2]}/${m[3]}` : x; };
    const nm = clean.match(/(?:rclcpp::)?Node\(\s*"(\w+)"/) || clean.match(/make_shared<rclcpp::Node>\(\s*"(\w+)"/) || clean.match(/Node::make_shared\(\s*"(\w+)"/); if (nm) info.node = nm[1];
    for (const m of clean.matchAll(/create_publisher<\s*([\w:]+)\s*>\(\s*"([\w/~]+)"/g)) info.pubs.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/create_subscription<\s*([\w:]+)\s*>\(\s*"([\w/~]+)"/g)) info.subs.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/create_service<\s*([\w:]+)\s*>\(\s*"([\w/~]+)"/g)) info.srvs.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/create_client<\s*([\w:]+)\s*>\(\s*"([\w/~]+)"/g)) info.cli.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/rclcpp_action::create_server<\s*([\w:]+)\s*>\(\s*[\w>-]+\s*,\s*"([\w/~]+)"/g)) info.acts.push([m[2], T(m[1])]);
    for (const m of clean.matchAll(/rclcpp_action::create_client<\s*([\w:]+)\s*>\(\s*[\w>-]+\s*,\s*"([\w/~]+)"/g)) info.actc.push([m[2], T(m[1])]);
    const lx = clean.match(/\.linear\.x\s*=\s*(-?\d*\.?\d+)/), az = clean.match(/\.angular\.z\s*=\s*(-?\d*\.?\d+)/);
    if (constantTwist(clean)) info.twist = { lx: lx ? Number(lx[1]) : 0, az: az ? Number(az[1]) : 0 };
    for (const m of clean.matchAll(/declare_parameter(?:<\s*([\w:<>]+?)\s*>)?\(\s*"(\w+)"\s*(?:,\s*(\{[^}]*\}|[^,)]+))?/g)) { const v = m[3] === undefined ? null : lit(m[3]); info.params[m[2]] = v === null ? "" : v; if (m[1] === "double" || (typeof v === "number" && /\./.test(m[3]))) info.ptypes[m[2]] = "double"; }
    const c0 = clean.search(/:\s*(?:rclcpp::|rclcpp_lifecycle::)?(?:Node|LifecycleNode)\(/), c1 = c0 < 0 ? -1 : clean.slice(c0).search(/\n  }\n/);
    const main0 = clean.search(/int\s+main\s*\(/);
    const ctorC = (c0 >= 0 ? clean.slice(c0, c1 < 0 ? undefined : c0 + c1) : main0 >= 0 ? clean.slice(main0) : "").replace(/\[(this|&|=)[^\]]*\]\s*\([^)]*\)\s*(->\s*\w+\s*)?\{[\s\S]*?\n\s*\}\)/g, "");
    info.cVars = {};
    for (const m of clean.matchAll(/(\w+_?)\s*=\s*declare_parameter(?:<[^>]*>)?\(\s*"(\w+)"/g)) info.cVars[m[1]] = m[2];
    for (const m of clean.matchAll(/(\w+_?)\s*=\s*get_parameter\(\s*"(\w+)"\s*\)/g)) info.cVars[m[1]] = m[2];
    info.ctpl = [];
    for (const m of ctorC.matchAll(/RCLCPP_(?:INFO|WARN|ERROR)(?:_ONCE)?\(\s*[^,]+,\s*"((?:[^"\\]|\\.)*)"((?:\s*,\s*[^;]+?)*)\);/g)) if (info.ctpl.length < 3) info.ctpl.push({ fmt: m[1], args: m[2].split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean) });
    for (const m of ctorC.matchAll(/RCLCPP_(INFO|WARN|ERROR)(?:_ONCE|_THROTTLE)?\(\s*[^,]+,\s*(?:[^,"]+,\s*\d+\s*,\s*)?"((?:[^"\\]|\\.)*)"/g)) if (info.logs.length < 3) info.logs.push(`[${m[1]}] [${info.node || "node"}]: ${m[2].replace(/%[-.\d]*[lz]*[sdfiu]/g, "…").replace(/%%/g, "%")}`);
  }
  // parameter descriptors (read_only, floating point range) and simple "reject" rules in an on-set callback
  info.readOnly = []; info.ranges = {}; info.rules = []; info.descs = {};
  for (const m of clean.matchAll(/declare_parameter(?:<[^>]*>)?\(\s*["'](\w+)["']([\s\S]*?)(?=\n\s*\n|self\.declare_parameter|declare_parameter\(|\n\s{4}\w+_?\s*=|$)/g)) {
    const body = m[2];
    if (/read_only\s*=\s*True/.test(body)) info.readOnly.push(m[1]);
    const ds = body.match(/description\s*=\s*(['"])(.*?)\1/); if (ds) info.descs[m[1]] = ds[2];
    const r = body.match(/from_value\s*=\s*(-?[\d.]+)\s*,\s*to_value\s*=\s*(-?[\d.]+)/); if (r) info.ranges[m[1]] = [Number(r[1]), Number(r[2])];
    const d = body.match(/^\s*,\s*[^,]+,\s*(\w+)\s*\)/); if (d) info[`desc_${m[1]}`] = d[1];
  }
  if (lang === "cpp") {
    for (const m of clean.matchAll(/(\w+)\.description\s*=\s*"([^"]*)";/g)) { const dm = clean.match(new RegExp(`declare_parameter\\(\\s*"(\\w+)"[^;]*\\b${m[1]}\\s*\\)`)); if (dm) info.descs[dm[1]] = m[2]; }
    for (const m of clean.matchAll(/(\w+)\.read_only\s*=\s*true/g)) { const dm = clean.match(new RegExp(`declare_parameter\\(\\s*"(\\w+)"[^;]*\\b${m[1]}\\s*\\)`)); if (dm) info.readOnly.push(dm[1]); }
    const fr = clean.match(/(\w+)\.from_value\s*=\s*(-?[\d.]+);\s*\n\s*\1\.to_value\s*=\s*(-?[\d.]+);\s*\n\s*(\w+)\.floating_point_range/);
    if (fr) { const dm = clean.match(new RegExp(`declare_parameter\\(\\s*"(\\w+)"[^;]*\\b${fr[4]}\\s*\\)`)); if (dm) info.ranges[dm[1]] = [Number(fr[2]), Number(fr[3])]; }
  }
  for (const m of clean.matchAll(/p\.name\s*==\s*'(\w+)'\s*and\s*abs\(p\.value\)\s*>\s*([\d.]+):\s*\n\s*return SetParametersResult\(successful=False,\s*reason='([^']*)'\)/g)) info.rules.push({ name: m[1], max: Number(m[2]), reason: m[3] });
  for (const m of clean.matchAll(/p\.get_name\(\)\s*==\s*"(\w+)"\s*&&\s*std::fabs\(p\.as_double\(\)\)\s*>\s*([\d.]+)\)\s*\{[^}]*?reason\s*=\s*"([^"]*)"/g)) info.rules.push({ name: m[1], max: Number(m[2]), reason: m[3] });
  info.paramLog = /changed to/.test(clean);
  // a Twist whose fields come from parameters (lx = self.speed): the node drives with the current parameter values
  const pl = clean.match(/\.linear\.x\s*=\s*(?:self\.)?(\w+?)_?\s*[;\n]/), pa = clean.match(/\.angular\.z\s*=\s*(?:self\.)?(\w+?)_?\s*[;\n]/);
  if (pl && pl[1] in info.params) info.paramTwist = { lx: pl[1], az: pa && pa[1] in info.params ? pa[1] : null };
  // a tf2 follower: lookup_transform('turtle2', 'turtle1', ...) then publish to /turtle2/cmd_vel
  const lk = clean.match(/lookup_?[Tt]ransform\(\s*["'](\w+)["']\s*,\s*["'](\w+)["']/);
  if (lk) { const kw = clean.match(/angular\.z\s*=\s*([\d.]+)\s*\*\s*(?:math|std)\W+atan2/), kv = clean.match(/linear\.x\s*=\s*([\d.]+)\s*\*\s*(?:math|std)\W+hypot/); info.follow = { me: lk[1], target: lk[2], kw: kw ? Number(kw[1]) : 1, kv: kv ? Number(kv[1]) : 0.5 }; }
  // a driving state machine (square_driver): FORWARD for N ticks, TURN for M ticks, K sides
  if (/FORWARD/.test(clean) && /TURN/.test(clean) && /create_(wall_)?timer/.test(clean)) {
    const ev = (e) => { const x = e.replace(/math\.pi|M_PI/g, String(Math.PI)).replace(/\s/g, ""); return /^[\d.+\-*/()]+$/.test(x) ? Function(`return (${x});`)() : NaN; };
    const lx = clean.match(/\.linear\.x\s*=\s*([^;\n#]+)/), az = clean.match(/\.angular\.z\s*=\s*([^;\n#]+)/);
    const ticks = [...clean.matchAll(/ticks_?\s*>=\s*(\d+)/g)].map((m) => +m[1]), sides = clean.match(/sides_?\s*==\s*(\d+)/);
    const period = (clean.match(/create_timer\(\s*([\d.]+)/) || [, null])[1] || ((clean.match(/create_wall_timer\(\s*(\d+)ms/) || [, 100])[1] / 1000);
    if (lx && az && ticks.length >= 2 && sides) info.square = { lx: ev(lx[1]), az: ev(az[1]), fwd: ticks[0], turn: ticks[1], sides: +sides[1], dt: Number(period) || 0.1 };
  }
  info.broadcaster = /TransformBroadcaster/.test(clean);
  // a pretend battery (Week 5 mini-project): drains with the distance its turtle drives
  info.battery = /drain_per_metre/.test(clean) && /BatteryStatus/.test(clean);
  info.lifecycle = /LifecycleNode/.test(clean);
  if (info.lifecycle) {
    info.logs = [];      // a managed node prints nothing until someone configures it
    const lx = clean.match(/\.linear\.x\s*=\s*(-?\d*\.?\d+)/), az = clean.match(/\.angular\.z\s*=\s*(-?\d*\.?\d+)/);
    info.lcTwist = { lx: lx ? Number(lx[1]) : 0, az: az ? Number(az[1]) : 0 };
    info.lcLogs = {};
    for (const st of ["configure", "activate", "deactivate", "cleanup", "shutdown"]) {
      const at = clean.search(new RegExp(`on_${st}\\s*\\(`)); if (at < 0) continue;
      const m = clean.slice(at, at + 600).match(lang === "python" ? /get_logger\(\)\.info\(\s*['"]([^'"]*)['"]/ : /RCLCPP_INFO\([^,]+,\s*"([^"]*)"/);
      if (m) info.lcLogs[st] = m[1];
    }
  }
  return info;
}

// ---------- ros2 pkg create (writes the real file layout into the practice file system) ----------
export function pkgCreate(sh, args) {
  let build = "ament_cmake", license = null, node = null; const deps = []; let name = null;
  for (let i = 0; i < args.length; i++) {
    const x = args[i];
    if (x === "--build-type") build = args[++i];
    else if (x === "--license") license = args[++i];
    else if (x === "--node-name") node = args[++i];
    else if (x === "--dependencies") { while (args[i + 1] && !args[i + 1].startsWith("--")) deps.push(args[++i]); }
    else if (!x.startsWith("-")) name = x;
  }
  if (!name) return [sh.err("usage: ros2 pkg create [--build-type ament_python] [--license Apache-2.0] [--node-name my_node] <package_name>")];
  if (!/^[a-z][a-z0-9_]*$/.test(name)) return [sh.err(`Package name '${name}' must start with a lower-case letter and contain only lower-case letters, numbers and underscores.`)];
  if (!["ament_cmake", "ament_python"].includes(build)) return [sh.err(`--build-type must be ament_cmake or ament_python`)];
  const base = sh.cwd === "/" ? "" : sh.cwd, dir = `${base}/${name}`;
  if (sh.fs.has(dir)) return [sh.err(`Aborted!\nThe directory already exists: ./${name}\nEither remove the directory or choose a different destination directory or package name`)];
  if (!sh.writable(dir, false)) return [sh.err(`[Errno 13] Permission denied: './${name}'`)];
  const f = (p, c = "") => { sh.mkdirP(p.replace(/\/[^/]+$/, "")); sh.fs.set(p, { type: "f", mode: "rw-r--r--", content: c }); };
  const L = ["going to create a new package", `package name: ${name}`, `destination directory: ${sh.cwd}`, "package format: 3", "version: 0.0.0",
    "description: TODO: Package description", "maintainer: ['student <student@todo.todo>']", `licenses: ['${license || "TODO: License declaration"}']`, `build type: ${build}`,
    `dependencies: [${deps.map((d) => `'${d}'`).join(", ")}]`, ...(node ? [`node_name: ${node}`] : []), `creating folder ./${name}`, `creating ./${name}/package.xml`];
  sh.mkdirP(dir);
  const lic = license || "TODO: License declaration", py = build === "ament_python";
  const testDeps = py ? ["ament_copyright", "ament_flake8", "ament_pep257", "python3-pytest"] : ["ament_lint_auto", "ament_lint_common"];
  f(`${dir}/package.xml`, `<?xml version="1.0"?>\n<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>\n<package format="3">\n  <name>${name}</name>\n  <version>0.0.0</version>\n  <description>TODO: Package description</description>\n  <maintainer email="student@todo.todo">student</maintainer>\n  <license>${lic}</license>\n\n`
    + (py ? "" : "  <buildtool_depend>ament_cmake</buildtool_depend>\n\n") + (deps.length ? deps.map((d) => `  <depend>${d}</depend>\n`).join("") + "\n" : "")
    + testDeps.map((d) => `  <test_depend>${d}</test_depend>\n`).join("") + `\n  <export>\n    <build_type>${build}</build_type>\n  </export>\n</package>\n`);
  if (license) f(`${dir}/LICENSE`, `\n                                 ${license === "Apache-2.0" ? "Apache License\n                           Version 2.0, January 2004" : license}\n`);
  const LINT = "if(BUILD_TESTING)\n  find_package(ament_lint_auto REQUIRED)\n  # the following line skips the linter which checks for copyrights\n  # comment the line when a copyright and license is added to all source files\n  set(ament_cmake_copyright_FOUND TRUE)\n  # the following line skips cpplint (only works in a git repo)\n  # comment the line when this package is in a git repo and when\n  # a copyright and license is added to all source files\n  set(ament_cmake_cpplint_FOUND TRUE)\n  ament_lint_auto_find_test_dependencies()\nendif()\n\nament_package()\n";
  if (py) {
    L.push("creating source folder", `creating folder ./${name}/${name}`, `creating ./${name}/setup.py`, `creating ./${name}/setup.cfg`, `creating folder ./${name}/resource`, `creating ./${name}/resource/${name}`, `creating ./${name}/${name}/__init__.py`, `creating folder ./${name}/test`, `creating ./${name}/test/test_copyright.py`, `creating ./${name}/test/test_flake8.py`, `creating ./${name}/test/test_pep257.py`);
    f(`${dir}/setup.py`, `from setuptools import find_packages, setup\n\npackage_name = '${name}'\n\nsetup(\n    name=package_name,\n    version='0.0.0',\n    packages=find_packages(exclude=['test']),\n    data_files=[\n        ('share/ament_index/resource_index/packages',\n            ['resource/' + package_name]),\n        ('share/' + package_name, ['package.xml']),\n    ],\n    install_requires=['setuptools'],\n    zip_safe=True,\n    maintainer='student',\n    maintainer_email='student@todo.todo',\n    description='TODO: Package description',\n    license='${lic}',\n    extras_require={\n        'test': [\n            'pytest',\n        ],\n    },\n    entry_points={\n        'console_scripts': [\n${node ? `            '${node} = ${name}.${node}:main'\n` : ""}        ],\n    },\n)\n`);
    f(`${dir}/setup.cfg`, `[develop]\nscript_dir=$base/lib/${name}\n[install]\ninstall_scripts=$base/lib/${name}\n`);
    f(`${dir}/resource/${name}`); f(`${dir}/${name}/__init__.py`);
    ["test_copyright.py", "test_flake8.py", "test_pep257.py"].forEach((t) => f(`${dir}/test/${t}`, "# test\n"));
    if (node) { L.push(`creating ./${name}/${name}/${node}.py`); f(`${dir}/${name}/${node}.py`, `def main():\n    print('Hi from ${name}.')\n\n\nif __name__ == '__main__':\n    main()\n`); }
  } else {
    L.push("creating source and include folder", `creating folder ./${name}/src`, `creating folder ./${name}/include/${name}`, `creating ./${name}/CMakeLists.txt`);
    sh.mkdirP(`${dir}/src`); sh.mkdirP(`${dir}/include/${name}`);
    let cm = `cmake_minimum_required(VERSION 3.8)\nproject(${name})\n\nif(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")\n  add_compile_options(-Wall -Wextra -Wpedantic)\nendif()\n\n# find dependencies\nfind_package(ament_cmake REQUIRED)\n`;
    cm += deps.length ? deps.map((d) => `find_package(${d} REQUIRED)\n`).join("") : "# uncomment the following section in order to fill in\n# further dependencies manually.\n# find_package(<dependency> REQUIRED)\n";
    if (node) cm += `\nadd_executable(${node} src/${node}.cpp)\ntarget_include_directories(${node} PUBLIC\n  $<BUILD_INTERFACE:\${CMAKE_CURRENT_SOURCE_DIR}/include>\n  $<INSTALL_INTERFACE:include/\${PROJECT_NAME}>)\ntarget_compile_features(${node} PUBLIC c_std_99 cxx_std_17)  # Require C99 and C++17\n`
      + (deps.length ? `ament_target_dependencies(\n  ${node}\n${deps.map((d) => `  "${d}"\n`).join("")})\n` : "") + `\ninstall(TARGETS ${node}\n  DESTINATION lib/\${PROJECT_NAME})\n`;
    f(`${dir}/CMakeLists.txt`, cm + "\n" + LINT);
    if (node) { L.push(`creating ./${name}/src/${node}.cpp`); f(`${dir}/src/${node}.cpp`, `#include <cstdio>\n\nint main(int argc, char ** argv)\n{\n  (void) argc;\n  (void) argv;\n\n  printf("hello world ${name} package\\n");\n  return 0;\n}\n`); }
  }
  const out = L.map((t) => sh.out(t));
  if (!/\/src$/.test(sh.cwd)) out.push(sh.hint("Packages normally go inside the src folder of a workspace, for example ~/ros2_ws/src."));
  return out;
}

// Finds packages (folders with package.xml) under <ws>/src, for colcon build.
export function findPackages(sh, ws) {
  const src = `${ws === "/" ? "" : ws}/src`;
  const pk = [];
  for (const [p, n] of sh.fs) {
    if (n.type !== "f" || !p.startsWith(src + "/") || !p.endsWith("/package.xml")) continue;
    const dir = p.slice(0, -"/package.xml".length);
    const xml = n.content || "";
    const name = (xml.match(/<name>([^<]+)<\/name>/) || [, baseName(dir)])[1];
    const type = /ament_python/.test(xml) ? "ament_python" : "ament_cmake";
    const exes = {}, infos = {}, notRunnable = {}, components = {};
    if (type === "ament_python") {
      const setup = (sh.fs.get(`${dir}/setup.py`) || {}).content || "";
      for (const m of setup.matchAll(/'(\w+)\s*=\s*([\w.]+):main'/g)) {
        const file = `${dir}/${m[2].replace(/\./g, "/")}.py`;
        const code = (sh.fs.get(file) || {}).content || "";
        const info = parseNodeCode(code, "python");
        exes[m[1]] = [...code.matchAll(/print\(\s*(["'])(.*?)\1\s*\)/g)].map((x) => x[2]).concat(info.logs);
        infos[m[1]] = info;
      }
    } else {
      const cm = ((sh.fs.get(`${dir}/CMakeLists.txt`) || {}).content || "").replace(/#.*$/gm, "");
      const adds = [...cm.matchAll(/add_executable\(\s*([\w-]+)\s+([\w/.-]+\.cpp)/g)];
      if (adds.length) {
        const inst = [...cm.matchAll(/install\(\s*TARGETS([^)]*)/g)].map((m) => m[1]).join(" ");
        for (const [, exe, file] of adds) {
          const code = (sh.fs.get(`${dir}/${file}`) || {}).content;
          if (code === undefined) { notRunnable[exe] = `CMake Error: Cannot find source file: ${file} (add_executable(${exe} ...))`; continue; }
          if (!new RegExp(`\\b${exe}\\b`).test(inst)) { notRunnable[exe] = `${exe} was built but not installed: add it to install(TARGETS ... DESTINATION lib/\${PROJECT_NAME})`; continue; }
          const info = parseNodeCode(code, "cpp"), m = code.match(/printf\("([^"\\]*)/);
          exes[exe] = (m ? [m[1]] : []).concat(info.logs); infos[exe] = info;
        }
      }
      for (const m of cm.matchAll(/rclcpp_components_register_nodes\(\s*(\w+)\s+"([\w:]+)"/g)) {
        const lib = cm.match(new RegExp(`add_library\\(\\s*${m[1]}\\s+SHARED\\s+([\\w/.-]+\\.cpp)`));
        const code = lib ? (sh.fs.get(`${dir}/${lib[1]}`) || {}).content : undefined;
        if (code !== undefined) components[m[2]] = parseNodeCode(code, "cpp");
      }
      // scripts installed as programs: install(PROGRAMS scripts/x.py DESTINATION lib/${PROJECT_NAME})
      for (const m of cm.matchAll(/install\s*\(\s*PROGRAMS([^)]*?)DESTINATION\s+lib\/\$\{PROJECT_NAME\}/g)) for (const f of m[1].trim().split(/\s+/)) if (sh.fs.has(`${dir}/${f}`)) exes[baseName(f)] = [];
      if (!adds.length) for (const [q, f] of sh.fs) if (q.startsWith(`${dir}/src/`) && q.endsWith(".cpp") && !/RCLCPP_COMPONENTS_REGISTER_NODE/.test(f.content || "")) { const m = (f.content || "").match(/printf\("([^"\\]*)/); exes[baseName(q).replace(/\.cpp$/, "")] = m ? [m[1]] : []; }
    }
    pk.push({ name, type, exes, infos, notRunnable, components, dir, ...packageExtras(sh, dir, name, type, xml) });
  }
  return pk.sort((a, b) => a.name.localeCompare(b.name));
}

// =====================================================================================
// Week 5 additions: custom interfaces (rosidl), installed launch/config files, YAML
// parameter files, user launch files (XML and Python) with namespaces, remaps, params.
// =====================================================================================
const PRIM = ["bool", "byte", "char", "float32", "float64", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "string", "wstring"];
const KNOWN_MSG_PKGS = ["std_msgs", "geometry_msgs", "sensor_msgs", "builtin_interfaces", "nav_msgs", "action_msgs", "turtlesim"];
const FIELD_RE = /^(?!.*__)(?!.*_$)[a-z][a-z0-9_]*$/;
const near = (t) => PRIM.find((p) => p !== t && p.length === t.length && [...p].sort().join("") === [...t].sort().join(""));

function checkIfaceText(text, kind, pkg, localTypes, file) {
  const errs = [];
  const parts = text.split(/^---[ \t]*$/m);
  const want = { msg: 1, srv: 2, action: 3 }[kind];
  if (parts.length !== want) errs.push(`${file}: a .${kind} file needs exactly ${want - 1} line(s) with --- (found ${parts.length - 1})`);
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (!line || line === "---") return;
    const m = line.match(/^(\S+)\s+([^\s=]+)\s*(=\s*.+|\s+.+)?$/);
    if (!m) { errs.push(`${file}:${i + 1}: invalid line '${raw.trim()}' (expected: type name)`); return; }
    const [, type, name, rest] = m;
    const base = type.replace(/\[[^\]]*\]$/, "").replace(/<=\d+$/, "");
    const known = PRIM.includes(base) || localTypes.includes(base) ||
      (/^[a-z][a-z0-9_]*\/(msg\/)?[A-Z]\w*$/.test(base) && (KNOWN_MSG_PKGS.includes(base.split("/")[0]) || base.split("/")[0] === pkg));
    if (!known) errs.push(`${file}:${i + 1}: '${base}' is not a known type${near(base) ? ` (did you mean '${near(base)}'?)` : ""}`);
    if (rest && rest.trim().startsWith("=")) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) errs.push(`${file}:${i + 1}: constant '${name}' must be UPPER_CASE`);
    } else if (!FIELD_RE.test(name)) {
      errs.push(`rosidl_adapter.parser.InvalidResourceName: '${name}' is an invalid field name. It should have the pattern '^(?!.*__)(?!.*_$)[a-z][a-z0-9_]*$'`);
    }
  });
  return errs;
}

// Called by findPackages for every package: generated interfaces, installed launch and config files.
export function packageExtras(sh, dir, name, type, xml) {
  const files = (sub, ext, deep) => [...sh.fs].filter(([p, n]) => n.type === "f" && p.startsWith(`${dir}/${sub}/`) && (!ext || p.endsWith(ext)) && (deep || !p.slice(dir.length + sub.length + 2).includes("/")));
  const out = { ifaces: {}, errors: [], launch: {}, config: {}, urdf: {} };
  const cm = type === "ament_cmake" ? ((sh.fs.get(`${dir}/CMakeLists.txt`) || {}).content || "") : "";
  const setup = type === "ament_python" ? ((sh.fs.get(`${dir}/setup.py`) || {}).content || "") : "";
  // ---- interfaces ----
  const all = ["msg", "srv", "action"].flatMap((k) => files(k, "." + k).map(([p, n]) => ({ k, p, rel: p.slice(dir.length + 1), text: n.content || "" })));
  const gen = cm.match(/rosidl_generate_interfaces\s*\(([\s\S]*?)\)/);
  if (type === "ament_cmake" && gen) {
    if (!/find_package\s*\(\s*rosidl_default_generators\s+REQUIRED\s*\)/.test(cm)) {
      const ln = cm.slice(0, gen.index).split("\n").length;
      out.errors.push(`CMake Error at CMakeLists.txt:${ln} (rosidl_generate_interfaces):`, `  Unknown CMake command "rosidl_generate_interfaces".`);
      return out;
    }
    if (!/<member_of_group>\s*rosidl_interface_packages\s*<\/member_of_group>/.test(xml)) {
      out.errors.push("CMake Error: Packages installing interfaces must include '<member_of_group>rosidl_interface_packages</member_of_group>' in their package.xml");
      return out;
    }
    const listed = [...gen[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((x) => /\.(msg|srv|action)$/.test(x));
    const localTypes = all.map((f) => f.rel.split("/").pop().replace(/\.\w+$/, ""));
    for (const rel of listed) {
      const f = all.find((x) => x.rel === rel);
      if (!f) { out.errors.push(`CMake Error: rosidl_generate_interfaces() the passed file '${rel}' doesn't exist`); continue; }
      const short = rel.split("/").pop().replace(/\.\w+$/, "");
      if (!/^[A-Z][A-Za-z0-9]*$/.test(short)) { out.errors.push(`rosidl_adapter.parser.InvalidResourceName: '${short}' is an invalid ${f.k} name. It should have the pattern '^[A-Z][A-Za-z0-9]*$' (CamelCase, no underscores)`); continue; }
      const e = checkIfaceText(f.text, f.k, name, localTypes, rel);
      if (e.length) out.errors.push(...e); else out.ifaces[`${name}/${f.k}/${short}`] = f.text.replace(/\s+$/, "");
    }
  }
  // ---- launch and config files (only if an install rule copies them) ----
  const extraDirs = type === "ament_cmake" ? [...cm.matchAll(/install\s*\(\s*DIRECTORY([^)]*?)DESTINATION\s+share\/\$\{PROJECT_NAME\}/g)].flatMap((m) => m[1].trim().split(/\s+/).map((d) => d.replace(/\/$/, ""))).filter((d) => /^[\w-]+$/.test(d)) : [];
  for (const sub of [...new Set(["launch", "config", "urdf", "meshes", "rviz", ...extraDirs])]) {
    const installed = type === "ament_cmake"
      ? new RegExp(`install\\s*\\(\\s*DIRECTORY[^)]*\\b${sub}\\b[^)]*DESTINATION\\s+share/\\$\\{PROJECT_NAME\\}`).test(cm)
      : new RegExp(`glob\\(\\s*['"]${sub}/\\*`).test(setup);
    if (!out[sub]) out[sub] = {};
    // install(DIRECTORY ...) copies the whole folder, sub-folders too (meshes/visual/base.stl -> key "visual/base.stl")
    if (installed) for (const [p, n] of files(sub, null, true)) out[sub][p.slice(dir.length + sub.length + 2)] = n.content || "";
  }
  return out;
}

// Tiny YAML reader for ROS 2 parameter files: { "node_or_/**": { param: value } }
export function parseParamsYaml(text) {
  const warn = [];
  if (/\t/.test(text)) return { tree: {}, warn: ["YAML error: the file contains a Tab. YAML only allows spaces."] };
  const root = {}; const stack = [{ ind: -1, obj: root }];
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const ind = line.length - line.trimStart().length;
    const m = line.trim().match(/^("?[^":]+"?|'[^']+'):\s*(.*)$/);
    if (!m) continue;
    while (stack.length > 1 && ind <= stack[stack.length - 1].ind) stack.pop();
    const key = m[1].replace(/^["']|["']$/g, ""), v = m[2];
    const parent = stack[stack.length - 1].obj;
    if (v === "") { parent[key] = {}; stack.push({ ind, obj: parent[key] }); }
    else parent[key] = yamlValue(v);
  }
  const tree = {};
  for (const [k, body] of Object.entries(root)) {
    if (!body || typeof body !== "object" || !("ros__parameters" in body)) { warn.push(`(practice) '${k}' has no 'ros__parameters' key, so these values are not used as parameters. It needs TWO underscores: ros__parameters`); continue; }
    tree[k === "/**" ? "/**" : "/" + k.replace(/^\//, "")] = body.ros__parameters;
  }
  return { tree, warn };
}
export function yamlValue(v) {
  v = String(v).trim();
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+(e-?\d+)?$/i.test(v) || /^-?\d+\.\d*$/.test(v)) return { __double: Number(v) };
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map((x) => yamlValue(x)).filter((x) => x !== "");
  return v.replace(/^["']|["']$/g, "");
}
export const plainValue = (v) => (Array.isArray(v) ? v.map(plainValue) : v && typeof v === "object" && "__double" in v ? v.__double : v);

// ---------- launch file readers ----------
function attrs(s) { const o = {}; for (const m of String(s).matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) o[m[1]] = m[2]; return o; }
export function readLaunchXml(text, cli) {
  if (!/<launch\b[^>]*>[\s\S]*<\/launch>/.test(text)) return { error: "Caught exception when trying to load file of format [xml]: the file must start with <launch> and end with </launch>" };
  const vals = {};
  for (const m of text.replace(/<include\b[^>]*?(?:\/>|>[\s\S]*?<\/include>)/g, "").matchAll(/<arg\b([^>]*?)\/?>/g)) {   // <arg> inside <include> passes a value, it declares nothing
    const a = attrs(m[1]); if (!a.name) continue;
    if (a.name in cli) vals[a.name] = cli[a.name];
    else if ("default" in a) vals[a.name] = a.default;
    else return { error: `Required launch argument "${a.name}" (description: "no description given") was not provided` };
  }
  for (const m of text.matchAll(/<let\b([^>]*?)\/?>/g)) { const a = attrs(m[1]); if (a.name) vals[a.name] = String(a.value || "").replace(/\$\(var ([\w-]+)\)/g, (_, k) => vals[k] ?? "").replace(/\$\(find-pkg-share ([\w-]+)\)/g, "$FINDSHARE:$1"); }

  let bad = null;
  const sub = (s) => String(s ?? "").replace(/\$\(var ([\w-]+)\)/g, (_, k) => (k in vals ? vals[k] : (bad = bad || `launch configuration '${k}' does not exist`, ""))).replace(/\$\(find-pkg-share ([\w-]+)\)/g, "$FINDSHARE:$1");
  const nodes = [];
  for (const m of text.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const a = attrs(m[1]); const body = m[2] || "";
    if ("if" in a && !/^(true|1)$/i.test(sub(a.if))) continue;
    if ("unless" in a && /^(true|1)$/i.test(sub(a.unless))) continue;
    const n = { pkg: sub(a.pkg), exec: sub(a.exec), name: sub(a.name), ns: sub(a.namespace), params: {}, files: [], remaps: [] };
    if (a.args) n.args = sub(a.args).trim().split(/\s+/).filter(Boolean);
    for (const p of body.matchAll(/<param\b([^>]*?)\/?>/g)) { const pa = attrs(p[1]); if (pa.from) n.files.push(sub(pa.from)); else if (pa.name) n.params[pa.name] = yamlValue(sub(pa.value)); }
    for (const r of body.matchAll(/<remap\b([^>]*?)\/?>/g)) { const ra = attrs(r[1]); n.remaps.push([sub(ra.from), sub(ra.to)]); }
    nodes.push(n);
  }
  const gzInc = gzIncludeXml(text, sub);
  return bad ? { error: bad } : { nodes, vals, gz: gzInc };
}
export function readLaunchPy(text, cli) {
  if (!/def\s+generate_launch_description\s*\(/.test(text)) return { error: "InvalidPythonLaunchFileError: launch file does not contain the required function 'generate_launch_description()'" };
  const vals = {};
  for (const m of text.matchAll(/DeclareLaunchArgument\(\s*['"]([\w-]+)['"](?:\s*,\s*default_value\s*=\s*['"]([^'"]*)['"])?/g)) {
    if (m[1] in cli) vals[m[1]] = cli[m[1]]; else if (m[2] !== undefined) vals[m[1]] = m[2]; else if (/^\s*,\s*default_value\s*=/.test(text.slice(m.index + m[0].length))) vals[m[1]] = "(computed default)";
    else return { error: `Required launch argument "${m[1]}" (description: "no description given") was not provided` };
  }
  const lcVar = {}, fileVar = {};
  for (const m of text.matchAll(/^\s*(\w+)\s*=\s*LaunchConfiguration\(\s*['"]([\w-]+)['"]\s*\)/gm)) lcVar[m[1]] = m[2];
  const shareRe = /os\.path\.join\(\s*get_package_share_directory\(\s*['"](\w+)['"]\s*\)\s*,\s*['"](\w+)['"]\s*,\s*['"]([\w.]+)['"]\s*\)/;
  for (const m of text.matchAll(new RegExp(`^\\s*(\\w+)\\s*=\\s*${shareRe.source}`, "gm"))) fileVar[m[1]] = `$FINDSHARE:${m[2]}/${m[3]}/${m[4]}`;
  const str = (s) => { if (!s) return ""; const q = s.match(/^['"]([^'"]*)['"]$/); if (q) return q[1]; const lc = s.match(/LaunchConfiguration\(\s*['"]([\w-]+)['"]\s*\)/); if (lc) return vals[lc[1]] ?? ""; if (s.trim() in lcVar) return vals[lcVar[s.trim()]] ?? ""; return s.trim(); };
  const nodes = [];
  let i = 0;
  while ((i = text.indexOf("Node(", i)) >= 0) {
    if (/\w/.test(text[i - 1] || "")) { i += 5; continue; }
    let d = 0, j = i + 4;
    for (; j < text.length; j++) { if (text[j] === "(") d++; else if (text[j] === ")" && --d === 0) break; }
    const body = text.slice(i + 5, j); i = j;
    const kw = (k) => { const m = body.match(new RegExp(`\\b${k}\\s*=\\s*('[^']*'|"[^"]*"|LaunchConfiguration\\([^)]*\\))`)); return m ? str(m[1]) : ""; };
    const n = { pkg: kw("package"), exec: kw("executable"), name: kw("name"), ns: kw("namespace"), params: {}, files: [], remaps: [] };
    const na = nodeArgsPy(body, text, vals); if (na) n.args = na.flatMap((x) => (/^-\S* /.test(x) ? x.split(/\s+/) : [x])).filter((x) => x !== "");
    const rd = body.match(/['"]robot_description['"]\s*:\s*(\w+)/); if (rd) n.rdVar = rd[1];
    const cond = body.match(/condition\s*=\s*(If|Unless)Condition\(\s*LaunchConfiguration\(\s*['"]([\w-]+)['"]\s*\)\s*\)/);
    if (cond) { const on = /^(true|1)$/i.test(String(vals[cond[2]])); if (cond[1] === "If" ? !on : on) continue; }
    const pi = body.search(/parameters\s*=\s*\[/), pm = pi < 0 ? null : [null, takeExpr(body, body.indexOf("[", pi)).replace(/^\[|\]$/g, "")];
    if (pm) for (const tok of pm[1].split(",").map((x) => x.trim())) { if (tok in fileVar) n.files.push(fileVar[tok]); const sm = tok.match(shareRe); if (sm) n.files.push(`$FINDSHARE:${sm[1]}/${sm[2]}/${sm[3]}`); }
    if (pm) for (const km of pm[1].matchAll(/['"]([\w.]+)['"]\s*:\s*/g)) {   // {'name': value}: a literal, a LaunchConfiguration, a variable or a path expression
      const ex = takeExpr(pm[1], km.index + km[0].length);
      let v;
      if (ex in lcVar || /^['"]/.test(ex) || /^LaunchConfiguration/.test(ex)) v = str(ex);
      else if (/^(True|False|None|-?[\d.]+(e-?\d+)?)$/i.test(ex)) v = ex;
      else { const r = pyEvalVar(ex, text, vals); v = r === "" ? ex.split("(")[0] : r; }
      n.params[km[1]] = yamlValue(v);
    }
    const rm = body.match(/remappings\s*=\s*\[([\s\S]*?)\]\s*(,|$)/);
    if (rm) for (const r of rm[1].matchAll(/\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g)) n.remaps.push([r[1], r[2]]);
    nodes.push(n);
  }
  const shareVar = {};
  for (const m of text.matchAll(/^\s*(\w+)\s*=\s*get_package_share_directory\(\s*['"](\w+)['"]\s*\)/gm)) shareVar[m[1]] = m[2];
  const includes = [];
  for (const m of text.matchAll(/IncludeLaunchDescription\(\s*(?:Python|XML|AnyLaunch)?\w*LaunchDescriptionSource\(\s*os\.path\.join\(\s*(\w+|get_package_share_directory\(\s*['"](\w+)['"]\s*\))\s*,\s*['"]launch['"]\s*,\s*['"]([\w.]+)['"]\s*\)/g)) includes.push({ pkg: m[2] || shareVar[m[1]], file: m[3] });
  return { nodes, vals, includes, gz: gzIncludePy(text, vals) };
}

// ros2 launch <workspace package> <file> [arg:=value ...]
// like ros2 launch: if the launch fails part-way, every process it already started is shut down again
// A maker's real-robot driver started from a launch file: it tries to reach the robot over USB, Ethernet, CAN or Wi-Fi.
// The practice computer has no robot attached, so it reports what the real driver prints when the robot is not there.
RosGraph.prototype.driverLaunch = function (inc, text, cli) {
  const arg = (k, d) => cli[k] || (String(text).match(new RegExp(`DeclareLaunchArgument\\(\\s*['"]${k}['"]\\s*,\\s*default_value\\s*=\\s*['"]([^'"]*)['"]`)) || [])[1] || d;
  const ip = arg("robot_ip", arg("rws_ip", arg("client_ip", ""))), port = arg("usb_port", arg("port_name", "")), now = () => (Date.now() / 1000).toFixed(9);
  const L = [this.out("[INFO] [launch]: All log files can be found below /home/student/.ros/log"), this.out("[INFO] [launch]: Default logging verbosity is set to INFO")];
  const P = { ur_robot_driver: ["ur_ros2_control_node", () => [`[ERROR] [${now()}] [UR_Client_Library:]: Failed to connect to robot on IP ${ip || "192.168.56.101"}. Please check that the robot is booted and reachable on ${ip || "192.168.56.101"}. Retrying in 10 seconds`]],
    kortex_bringup: ["ros2_control_node", () => [`[ERROR] [${now()}] [KortexMultiInterfaceHardware]: Connection to the robot at ${ip || "192.168.1.10"} failed: kError (TCP connection timeout)`]],
    franka_bringup: ["ros2_control_node", () => [`[ERROR] [${now()}] [franka_hardware]: libfranka: Connection error: Connection timeout (robot ${ip || "172.16.0.3"}; is FCI activated in Desk?)`]],
    turtlebot3_bringup: ["turtlebot3_ros", () => [`[ERROR] [${now()}] [turtlebot3_node]: Failed to open the port(${port || "/dev/ttyACM0"})! Is the OpenCR board connected? (ls /dev/ttyACM*)`]],
    scout_base: ["scout_base_node", () => [`[ERROR] [${now()}] [scout_base_node]: Failed to setup CAN port ${port || "can0"}: No such device (is the USB-to-CAN adapter plugged in and can0 up?)`]],
    crazyflie: ["crazyflie_server", () => [`[ERROR] [${now()}] [crazyflie_server]: No Crazyradio dongle found (lsusb | grep 1915:7777)`]],
    spot_driver: ["spot_ros2", () => [`[ERROR] [${now()}] [spot_ros2]: Failed to authenticate with Spot at ${cli.hostname || "10.0.0.3"}: RetryableUnavailableError (robot not reachable)`]],
  };
  const d = P[inc.pkg] || ["driver_node", () => [`[ERROR] [${now()}] [${inc.pkg}]: Could not connect to the robot${ip ? ` at ${ip}` : port ? ` on ${port}` : ""}: no answer (is it powered on, cabled and on the same network?)`]];
  L.push(this.out(`[INFO] [${d[0]}-1]: process started with pid [7311]`), ...d[1]().map((t) => this.err(`[${d[0]}-1] ${t}`)), this.err(`[ERROR] [${d[0]}-1]: process has died [pid 7311, exit code 1]`),
    this.hint(`(${inc.pkg} is installed and licensed, and it tried to reach the robot: no ${port ? "USB / serial device" : "robot"} answers from this practice computer. On your Ubuntu computer, cabled to the robot, the same command starts it.)`));
  return L;
};
RosGraph.prototype.launchUser = function (pk, file, extra = []) {
  const before = new Set(this.nodes), gzBefore = this.gz;
  this.lastStarted = null;
  const out = this.launchUserInner(pk, file, extra);
  if (!this.lastStarted) { this.nodes = this.nodes.filter((n) => before.has(n)); if (this.gz && this.gz !== gzBefore) this.gz = gzBefore && before.has(this.node(gzBefore.node)) ? gzBefore : null; }
  return out;
};
RosGraph.prototype.launchUserInner = function (pk, file, extra = []) {
  const sh = this.sh, share = `${HOME}/ros2_ws/install/${pk.name}/share/${pk.name}`;
  const text = (pk.launch || {})[file];
  if (text === undefined) {
    const inSrc = [...sh.fs.keys()].some((p) => p === `${pk.dir}/launch/${file}`);
    return [this.err(`file '${file}' was not found in the share directory of package '${pk.name}' at '${share}'`),
      this.hint(inSrc ? "The file exists in src, but it was never INSTALLED. Add the install rule (CMakeLists.txt: install(DIRECTORY launch ...) or setup.py: data_files), then colcon build and source again." : "Check the file name, and that it is inside the package's launch folder.")];
  }
  const cli = {}; for (const x of extra) { const m = String(x).match(/^([\w-]+):=(.*)$/); if (m) cli[m[1]] = m[2]; }
  const kindOf = /\.py$/.test(file) ? "py" : /\.xml$/.test(file) ? "xml" : null;
  // real hardware: a robot's bringup / real.launch.py talks to the purchased robot, which needs the administrator's license
  const realHw = (/_bringup$/.test(pk.name) && /^(real|bringup|driver|hardware)/.test(file)) || /^real\.launch\.(py|xml)$/.test(file) || (/_bringup$/.test(pk.name) && /mode:=real|use_sim:=false/.test(extra.join(" ")));
  if (realHw && !extra.includes("--show-args") && sh.spec && sh.spec.hardwareGate) {
    const base = pk.name.replace(/_(bringup|moveit_config|description|gazebo)$/, ""), robot = (text.match(/# ros2lab-robot:\s*([\w-]+)/) || [])[1];
    const gate = sh.spec.hardwareGate([robot, base].filter(Boolean));
    if (!gate.ok) return [this.out("[INFO] [launch]: Default logging verbosity is set to INFO"), this.err(`[ERROR] [ros2lab_hardware_license]: ${gate.message}`), this.err("[ERROR] [launch]: real hardware is locked: nothing was started"),
      this.hint("(Simulation needs no license: use sim.launch.py / gazebo.launch.py / demo.launch.py. For the real robot, ask your course administrator for a hardware license: RViz page → Connect to ROS 2 → Ask for a hardware license.)")];
  }
  if (extra.includes("--show-args")) {
    const decl = kindOf === "xml" ? [...text.matchAll(/<arg\b([^>]*?)\/?>/g)].map((m) => attrs(m[1])) : [...text.matchAll(/DeclareLaunchArgument\(\s*['"]([\w-]+)['"](?:\s*,\s*default_value\s*=\s*['"]([^'"]*)['"])?/g)].map((m) => ({ name: m[1], default: m[2] }));
    return decl.length ? ["Arguments (pass arguments as '<name>:=<value>'):", ""].concat(...decl.map((a) => [`    '${a.name}':`, "        no description given", a.default !== undefined ? `        (default: '${a.default}')` : "", ""])).filter((x, i, arr) => x !== "" || arr[i - 1] !== "").map((t) => this.out(t)) : [this.out("No arguments.")];
  }
  // a MoveIt config package (MoveItConfigsBuilder / moveit_configs_utils launch files): move_group, RViz MotionPlanning, ros2_control
  if (kindOf === "py" && this.isMoveitLaunch(text)) return this.launchMoveit(pk, file, cli, text);
  const r = kindOf === "py" ? readLaunchPy(text, cli) : kindOf === "xml" ? readLaunchXml(text, cli) : { error: "the practice terminal reads .launch.xml and .launch.py files" };
  if (!r.error && !r.gz && !(r.nodes || []).length && (r.includes || []).length === 1 && r.includes[0].file !== "gz_sim.launch.py") {   // a wrapper (e.g. <robot>_bringup sim.launch.py): run the included file
    const inc = r.includes[0], ip = sh.wsPkgs && sh.wsPkgs.get(inc.pkg);
    if (ip && (ip.launch || {})[inc.file] !== undefined) return this.launchUserInner(ip, inc.file, [...extra, ...Object.entries(inc.args || {}).map(([k, v]) => `${k}:=${v}`)]);
  }
  for (const inc of (r.includes || [])) {      // IncludeLaunchDescription: read the other launch file and start its nodes too
    if (inc.file === "gz_sim.launch.py") continue;   // Gazebo itself (r.gz)
    const ip = sh.wsPkgs && sh.wsPkgs.get(inc.pkg), itext = ip && (ip.launch || {})[inc.file];
    if (itext === undefined && !ip && sh.rosPkgs.has(inc.pkg)) return this.driverLaunch(inc, text, cli);   // a maker's driver (installed from apt / source)
    if (itext === undefined) return [this.out(`[INFO] [launch]: Default logging verbosity is set to INFO`), this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): file '${inc.file}' was not found in the share directory of package '${inc.pkg}'`)];
    const ir = /\.xml$/.test(inc.file) ? readLaunchXml(itext, {}) : readLaunchPy(itext, {});
    if (!ir.error) { r.nodes = [...ir.nodes, ...r.nodes]; r.gz = r.gz || ir.gz; }
  }
  const L = [this.out(`[INFO] [launch]: All log files can be found below ${HOME}/.ros/log/2026-10-12-09-30-00-000000-ros2lab-4300`), this.out("[INFO] [launch]: Default logging verbosity is set to INFO")];
  if (r.error) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): ${r.error}`)];
  let count = 0;
  const post = [], fulls = [], t0 = Date.now(); let tick = 0; const stamp = () => { const us = t0 * 1000 + 213 + (tick++) * 41; return `${Math.floor(us / 1e6)}.${String(us % 1e6).padStart(6, "0")}${String(457 + tick * 7).slice(-3).padStart(3, "0")}`; };   // node output comes after all the "process started" lines, like ros2 launch
  {   // gui:=true/false picks joint_state_publisher_gui or joint_state_publisher (IfCondition / UnlessCondition)
    const hasG = r.nodes.some((x) => x.pkg === "joint_state_publisher_gui"), hasP = r.nodes.some((x) => x.pkg === "joint_state_publisher");
    if (hasG && hasP) { const gui = String((r.vals || {}).gui ?? cli.gui ?? "true") !== "false"; r.nodes = r.nodes.filter((x) => x.pkg !== (gui ? "joint_state_publisher" : "joint_state_publisher_gui")); }
  }
  const creates = [], spawns = [];
  if (r.gz) {   // IncludeLaunchDescription(ros_gz_sim gz_sim.launch.py, gz_args=...): Gazebo itself
    if (!sh.rosPkgs.has("ros_gz_sim")) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): "package 'ros_gz_sim' not found, searching: ['/opt/ros/jazzy']"`), this.hint("Install Gazebo for ROS 2: sudo apt install ros-jazzy-ros-gz")];
    const tag = "ruby $(which gz) sim-1";
    const g = this.gzSim(gzArgv(r.gz.args), { tag });
    if (g.err) { post.push(...g.err.map((t) => this.err(t))); count++; L.push(this.out(`[INFO] [${tag}]: process started with pid [${4300 + count * 7}]`)); post.push(this.err(`[ERROR] [${tag}]: process has died [pid ${4300 + count * 7}, exit code 255, cmd 'ruby $(which gz) sim ${r.gz.args}']`)); }
    else { count++; g.node.pid = 4300 + count * 7; g.node.procName = tag; fulls.push(g.node.full); L.push(this.out(`[INFO] [${tag}]: process started with pid [${g.node.pid}]`)); post.push(...g.lines.map((t) => this.out(t))); }
  }
  for (const n of r.nodes) {
    const ws = sh.wsPkgs && sh.wsPkgs.get(n.pkg);
    const kind = EXES[`${n.pkg} ${n.exec}`] || (ws && n.exec in ws.exes ? "custom" : null);
    if (kind && !ws && /^(ros_gz_|teleop_twist_keyboard$)/.test(n.pkg) && !sh.rosPkgs.has(n.pkg)) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): "package '${n.pkg}' not found, searching: ['/opt/ros/jazzy']"`), this.hint(`Install it: sudo apt install ros-jazzy-${n.pkg.startsWith("ros_gz") ? "ros-gz" : n.pkg.replace(/_/g, "-")}`)];
    if (kind === "gz_create") { count++; const tag = `${n.exec}-${count}`, pid = 4300 + count * 7; L.push(this.out(`[INFO] [${tag}]: process started with pid [${pid}]`)); creates.push({ n, tag, pid }); continue; }
    if (kind === "spawner") { count++; const tag = `spawner-${count}`, pid = 4300 + count * 7; L.push(this.out(`[INFO] [${tag}]: process started with pid [${pid}]`)); spawns.push({ n, tag, pid }); continue; }
    if (!kind) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): executable '${n.exec}' not found on the libexec directory '/opt/ros/jazzy/lib/${n.pkg}'`)];
    const name = n.name || DEFAULT_NAME[kind] || n.exec;
    const ns = n.ns ? "/" + n.ns.replace(/^\/+|\/+$/g, "") : "";
    const full = `${ns}/${name}`, params = {};
    for (const f of n.files) {
      const m = f.match(/^\$FINDSHARE:([\w-]+)\/config\/(.+)$/);
      const content = m ? (sh.wsPkgs.get(m[1]) ? (sh.wsPkgs.get(m[1]).config || {})[m[2]] : undefined) : (sh.node(sh.abs(f)) || {}).content;
      if (content === undefined) return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): parameter file '${f.replace(/^\$FINDSHARE:([\w-]+)/, `${HOME}/ros2_ws/install/$1/share/$1`)}' was not found (was the config folder installed?)`)];
      const y = parseParamsYaml(content); y.warn.forEach((w) => L.push(this.hint(w)));
      for (const [key, body] of Object.entries(y.tree)) if (key === "/**" || key === full) Object.assign(params, body);
    }
    Object.assign(params, n.params);
    const node = this.add(kind, name, ns, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, plainValue(v)])), n.remaps);
    if (kind === "static_tf" && n.args) { const g = (k) => { const i = n.args.indexOf(`--${k}`); return i >= 0 ? n.args[i + 1] : 0; }; node.tf = { parent: g("frame-id"), child: g("child-frame-id"), t: [Number(g("x")), Number(g("y")), Number(g("z"))], q: qRPY(Number(g("roll")), Number(g("pitch")), Number(g("yaw"))) }; }
    if (kind === "rsp" && (n.rdVar || !node.params.robot_description || /\$\(command|xacro/.test(String(node.params.robot_description)))) {
      // model:=<file> on the command line replaces the default model file (Command(['xacro ', model]))
      const over = cli.model && !/^\$|^\(/.test(cli.model) ? this.expandXacroFile(sh.abs(cli.model.replace(/^\$PWD/, sh.cwd))) : null;
      const d = over ? (over.err ? { err: over.err } : { text: over.text }) : this.launchDescription(pk, text, n);
      if (d.err) { this.nodes = this.nodes.filter((x) => x !== node); return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): ${d.err}`)]; }
      node.params.robot_description = d.text;
      const tag = `robot_state_publisher-${count + 1}`;
      post.push(...this.rspMessages(node).map((t) => (/\[ERROR\]/.test(t) ? this.err : this.out).call(this, `[${tag}] ${t.replace(/^\[(INFO|ERROR|WARN)\] \[robot_state_publisher\]/, `[$1] [${stamp()}] [robot_state_publisher]`)}`)));
    }
    if (kind === "rviz") {
      const m = text.match(/['"]rviz['"]\s*,\s*['"]([\w.-]+\.rviz)['"]/) || text.match(/rviz\/([\w.-]+\.rviz)/);
      if (this.sh.viz) { this.sh.viz.displays = { Grid: true }; this.sh.viz.fixedFrame = "map"; }
      const tag = `rviz2-${count + 1}`;
      post.push(this.out(`[${tag}] [INFO] [${stamp()}] [rviz2]: Stereo is NOT SUPPORTED`), this.out(`[${tag}] [INFO] [${stamp()}] [rviz2]: OpenGl version: 4.6 (GLSL 4.6)`), this.out(`[${tag}] [INFO] [${stamp()}] [rviz2]: Stereo is NOT SUPPORTED`));
      if (m) { const content = (pk.rviz || {})[m[1]], full = `${HOME}/ros2_ws/install/${pk.name}/share/${pk.name}/rviz/${m[1]}`; const rr = content === undefined ? [this.err(`[${tag}] [ERROR] [${stamp()}] [rviz2]: Could not load config file '${full}' (is the rviz folder installed?). RViz opened with its default setup.`)] : this.rvizConfig(null, content); if (rr) post.push(...rr); if (content !== undefined && this.sh.viz) this.sh.viz.configName = full; }
    }
    if (kind === "custom" && ws.infos && ws.infos[n.exec]) { const inf = ws.infos[n.exec]; node.info = inf; for (const [k, v] of Object.entries(inf.params)) if (!(k in node.params)) node.params[k] = v; if (inf.lang === "cpp") QOS.forEach((q, i) => { node.params[q] = [1000, "volatile", "keep_last", "reliable"][i]; }); }
    if (kind === "custom") node.ptypes = { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v && typeof v === "object" ? "double" : typeof v === "boolean" ? "bool" : typeof v === "string" ? "string" : "integer"])), ...((node.info && node.info.ptypes) || {}) };
    if (kind === "jsp_gui" || kind === "jsp") post.push(this.out(`[${n.exec}-${count + 1}] [INFO] [${stamp()}] [${n.exec}]: Waiting for robot_description to be published on the robot_description topic...`));
    if (kind === "gz_bridge" || kind === "gz_image") {
      if (kind === "gz_image") node.bridge = (n.args || []).filter((x) => !x.startsWith("-")).map((t) => ({ ros: t.startsWith("/") ? t : "/" + t, gz: t.startsWith("/") ? t : "/" + t, rosType: "sensor_msgs/msg/Image", gzType: "gz.msgs.Image", dir: "GZ_TO_ROS" }));
      else {
        const br = this.bridgeEntries(n.args || [], { config_file: params.config_file !== undefined ? plainValue(params.config_file) : undefined });
        if (br.err) { this.nodes = this.nodes.filter((x) => x !== node); return [...L, this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): ${br.err.replace(/^\[ERROR\] \[ros_gz_bridge\]: /, "")}`)]; }
        node.bridge = br.entries; node.bridgeBad = br.bad;
        post.push(...this.bridgeLines(node, `${n.exec}-${count + 1}`).map((t) => (/\[(ERROR|WARN)\]/.test(t) ? this.err(t) : this.out(t))));
      }
    }
    if (kind === "teleop_twist") { node.speed = 0.5; node.turn = 1.0; }
    count++; fulls.push(node.full); node.pid = 4300 + count * 7; node.procName = `${n.exec}-${count}`;
    L.push(this.out(`[INFO] [${node.procName}]: process started with pid [${node.pid}]`));
  }
  for (const c of creates) {   // ros_gz_sim create runs once robot_state_publisher publishes /robot_description, spawns, and exits
    const cr = this.gzCreate(c.n.args || [], { tag: c.tag });
    post.push(...cr.lines.map((t) => (/\[ERROR\]/.test(t) ? this.err(t) : this.out(t))));
    if (cr.gzErr) post.push(...cr.gzErr.map((t) => this.err(`[ruby $(which gz) sim-1] ${t}`)));
    if (cr.gzInfo) post.push(...cr.gzInfo.map((t) => this.out(`[ruby $(which gz) sim-1] ${t}`)));
    if (!cr.waiting) post.push(cr.fail ? this.err(`[ERROR] [${c.tag}]: process has died [pid ${c.pid}, exit code 255, cmd '/opt/ros/jazzy/lib/ros_gz_sim/create ${(c.n.args || []).join(" ")}']`) : this.out(`[INFO] [${c.tag}]: process has finished cleanly [pid ${c.pid}]`));
    if (cr.hint) post.push(this.hint(`(${cr.hint})`));
    if (cr.cmHint) post.push(this.hint(`(${cr.cmHint})`));
  }
  for (const c of spawns) {   // controller_manager spawner: waits for the controller_manager inside Gazebo, loads + activates, exits
    if (!sh.rosPkgs.has("controller_manager")) { post.push(this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): "package 'controller_manager' not found, searching: ['/opt/ros/jazzy']"`)); continue; }
    const sr = this.spawnerRun(c.n.args || [], { tag: c.tag, inline: true });
    post.push(...sr.lines);
    if (sr.gzLines) post.push(...sr.gzLines.map((t) => (/\[(ERROR|WARN)\]/.test(t) ? this.err : this.out).call(this, `[ruby $(which gz) sim-1] ${t}`)));
    post.push(sr.fail ? this.err(`[ERROR] [${c.tag}]: process has died [pid ${c.pid}, exit code 1, cmd '/opt/ros/jazzy/lib/controller_manager/spawner ${(c.n.args || []).join(" ")} --ros-args']`) : this.out(`[INFO] [${c.tag}]: process has finished cleanly [pid ${c.pid}]`));
    if (sr.hint) post.push(this.hint(`(${sr.hint})`));
  }
  if (!this.gzRunning()) {   // a description with Gazebo sensors, shown without Gazebo: nothing publishes their topics
    const rsp = this.nodes.find((x) => x.kind === "rsp" && fulls.includes(x.full));
    if (rsp) { const gzd = urdfGazebo(String(rsp.params.robot_description || "")); if (gzd.sensors.length) post.push(this.hint(`(This robot declares ${gzd.sensors.length} Gazebo sensor${gzd.sensors.length > 1 ? "s" : ""}: ${gzd.sensors.map((x) => `${x.name} (${x.type})`).join(", ")}. ${file} starts no Gazebo, so their topics have no data, as on Ubuntu. Launch the simulation (sim.launch.py) to see scans, images and IMU data in RViz.)`)); }
  }
  if (this.gzRunning()) {   // the robot's Gazebo sensors and what reaches ROS: say what is missing, like the questions people ask on Robotics Stack Exchange
    const feeds = this.gzFeeds();
    for (const m of this.gz.models.values()) for (const sen of m.gazebo.sensors) {
      const sys = sen.type === "imu" ? "imu-system" : "sensors-system";
      if (!this.gzTopicList().some((t) => t.sensor === sen)) { if (!/^(ray|lidar)$/.test(sen.type)) post.push(this.hint(`(Sensor ${sen.name} (${sen.type}) on ${sen.link}: the world has no gz-sim-${sys} plugin, so Gazebo does not run it and nothing is published.)`)); continue; }
      const bridged = [...feeds.values()].some((f) => f.src.sensor === sen);
      if (!bridged) post.push(this.hint(`(Sensor ${sen.name} publishes on Gazebo topics (gz topic -l) but no ros_gz_bridge entry maps them, so ROS 2 and RViz cannot see it.)`));
    }
  }
  L.push(...post);
  this.lastStarted = fulls;   // like a real ros2 launch, the terminal stays busy until Ctrl+C
  return L;
};


// ===================== URDF + RViz practice (Weeks 7-9) =====================
RosGraph.prototype.rspNode = function () { return this.nodes.find((n) => n.kind === "rsp"); };
RosGraph.prototype.robotModel = function () {
  const n = this.nodes.find((x) => x.kind === "rsp" && x.params.robot_description);
  if (!n) return null;
  const txt = String(n.params.robot_description);
  if (n._modelSrc !== txt) { n._modelSrc = txt; try { n._model = parseURDF(txt); n._modelErr = null; } catch (e) { n._model = null; n._modelErr = e.message; } }
  return n._model;
};
RosGraph.prototype.robotModelError = function () { const n = this.nodes.find((x) => x.kind === "rsp" && x.params.robot_description); if (!n) return null; this.robotModel(); return n._modelErr || null; };
RosGraph.prototype.statesAvailable = function () { return this.nodes.some((n) => n.kind === "jsp" || n.kind === "jsp_gui") || !!(this.sh.viz && this.sh.viz.jsPub) || !!(this.gzRunning() && this.gzJoints()) || !!(this.mockModelList().length && this.cmJoints()); };
// /joint_states as robot_state_publisher hears it: the sliders, ros2 topic pub, or Gazebo's JointStatePublisher system
RosGraph.prototype.jointValues = function () { const J = { ...(this.sh.viz ? this.sh.viz.joints : {}) }; const g = this.gzRunning() && !this.nodes.some((n) => n.kind === "jsp" || n.kind === "jsp_gui") ? this.gzJoints() : this.mockModelList().length ? this.cmJoints() : null; return g ? { ...J, ...g } : J; };
RosGraph.prototype.rspMessages = function (n) {
  const txt = String(n.params.robot_description);
  if (/^\s*<\?xml[^>]*>\s*<robot[\s\S]*xmlns:xacro|<xacro:/.test(txt)) return ["[ERROR] [robot_state_publisher]: Failed to parse robot description: it still contains <xacro:...> tags. Run it through xacro first: -p robot_description:=\"$(xacro file.urdf.xacro)\""];
  try { const m = parseURDF(txt); return [...Object.values(m.joints).filter((j) => j.type === "floating" || j.type === "planar").map((j) => `[WARN] [kdl_parser]: Converting unknown joint type of joint '${j.name}' into a fixed joint`), ...Object.keys(m.links).sort().map((l) => `[INFO] [robot_state_publisher]: got segment ${l}`)]; }
  catch (e) { return ["[ERROR] [robot_state_publisher]: Failed to parse robot description using: urdf_xml_parser/URDFXMLParser", `[ERROR] [robot_state_publisher]: ${e.message.replace(/^Error:\s*/, "")}`]; }
};
// ros2 run tf2_tools view_frames
RosGraph.prototype.viewFrames = function () {
  const E = this.tfTree();
  const stamp = "2026-10-12_09.30.00";
  const lines = ["[INFO] [view_frames]: Listening to tf data for 5.0 seconds..."];
  if (!E.length) return [...lines.map((t) => this.out(t)), this.out("[INFO] [view_frames]: Generating graph in frames.pdf file..."), this.out(`[INFO] [view_frames]: Result:tf2_msgs.srv.FrameGraph_Response(frame_yaml='[]')`), this.hint("No TF frames are being published. Start robot_state_publisher (and joint_state_publisher) or a static_transform_publisher first.")];
  const gv = "digraph G {\n" + E.map((e) => `"${e.parent}" -> "${e.child}"[label="Broadcaster: default_authority"];`).join("\n") + "\n}\n";
  const dir = this.sh.cwd;
  this.sh.fs.set(`${dir}/frames_${stamp}.gv`, { type: "f", mode: "rw-r--r--", content: gv });
  this.sh.fs.set(`${dir}/frames_${stamp}.pdf`, { type: "f", mode: "rw-r--r--", content: "%PDF-1.4 (a drawing of the TF tree: open it with a PDF viewer)\n" + gv });
  const kids = {}; E.forEach((e) => (kids[e.parent] = kids[e.parent] || []).push(e.child));
  const roots = [...new Set(E.map((e) => e.parent))].filter((p) => !E.some((e) => e.child === p));
  const tree = []; const rec = (f, depth) => { tree.push(depth ? "   ".repeat(depth - 1) + "└─ " + f : f); (kids[f] || []).sort().forEach((c) => rec(c, depth + 1)); };
  roots.forEach((r) => rec(r, 0));
  return [...lines, "[INFO] [view_frames]: Generating graph in frames.pdf file..."].map((t) => this.out(t))
    .concat([this.out(`[INFO] [view_frames]: Result:tf2_msgs.srv.FrameGraph_Response(frame_yaml="${E.slice(0, 2).map((e) => `${e.child}: \\n  parent: '${e.parent}'`).join(" ")} ...")`),
      this.hint(`Created frames_${stamp}.pdf and frames_${stamp}.gv in this folder. The PDF shows this tree:`), ...tree.map((t) => this.hint("  " + t))]);
};
// read a .rviz config: Fixed Frame and the list of displays
RosGraph.prototype.rvizConfig = function (path, text) {
  const viz = this.sh.viz;
  if (!viz) return null;
  if (!path && !text) { viz.fixedFrame = viz.fixedFrame || "map"; viz.configText = null; viz.configName = ""; return null; }
  let content = text;
  if (content === undefined) { const fp = this.sh.abs(path); content = this.sh.isFile(fp) ? this.sh.node(fp).content : undefined; }
  if (content === undefined) return [this.out(`[ERROR] [rviz2]: Could not load config file '${path}': file not found. RViz opened with its default (empty) setup.`)];
  const cfg = parseRvizYaml(content), go = (cfg && cfg["Visualization Manager"] && cfg["Visualization Manager"]["Global Options"]) || {};
  const ff = go["Fixed Frame"] ? String(go["Fixed Frame"]).replace(/^\//, "") : null;
  const ds = {};
  for (const { cls, item } of rvizDisplays(cfg)) { const t = cls.split("/").pop(); if (t) ds[t] = ds[t] || (item.Enabled ?? item.Value) !== false; }
  if (ff) viz.fixedFrame = ff;
  if (Object.keys(ds).length) viz.displays = ds;
  viz.configText = content; viz.configName = path || "urdf_config.rviz";
  return null;
};
// start the three classic URDF-viewing nodes for a description text
RosGraph.prototype.startDisplay = function (urdfText, { gui = true, rvizCfg = null, cfgText, label }) {
  const out = [];
  const rsp = this.add("rsp", "robot_state_publisher", "", { robot_description: urdfText });
  const jsp = this.add(gui ? "jsp_gui" : "jsp", gui ? "joint_state_publisher_gui" : "joint_state_publisher", "", {});
  if (this.sh.viz) { this.sh.viz.displays = { Grid: true, RobotModel: true, TF: true }; }
  if (this.sh.viz) { this.sh.viz.configText = null; this.sh.viz.configName = ""; }
  const rz = this.add("rviz", "rviz2", "", {});
  try { const m = parseURDF(urdfText); if (this.sh.viz && !rvizCfg && !cfgText) this.sh.viz.fixedFrame = m.root; } catch (e) { /* shown by RViz status */ }
  if (rvizCfg || cfgText !== undefined) { const r = this.rvizConfig(rvizCfg, cfgText); if (r) out.push(...r); }
  this.lastStarted = [rsp.full, jsp.full, rz.full];
  return [
    this.out(`[INFO] [launch]: All log files can be found below /home/student/.ros/log/2026-10-12-09-30-00-000000-ros2lab-4321`),
    this.out("[INFO] [launch]: Default logging verbosity is set to INFO"),
    this.out("[INFO] [robot_state_publisher-1]: process started with pid [4321]"),
    this.out(`[INFO] [${gui ? "joint_state_publisher_gui" : "joint_state_publisher"}-2]: process started with pid [4322]`),
    this.out("[INFO] [rviz2-3]: process started with pid [4323]"),
    ...this.rspMessages(rsp).map((t) => this.out(t.replace("[robot_state_publisher]", "[robot_state_publisher-1] [INFO] [robot_state_publisher]").replace("[INFO] [robot_state_publisher-1] [INFO]", "[robot_state_publisher-1] [INFO]"))),
    ...out,
    this.hint(`(${label || "The robot"} opened in RViz below the terminal${gui ? ", with the joint sliders" : ""}. Press Ctrl+C to stop all three nodes.)`)];
};
// ros2 launch urdf_tutorial display.launch.py model:=...  |  ros2 launch urdf_launch display.launch.py urdf_package:=... urdf_package_path:=...
RosGraph.prototype.vizLaunch = function (pkg, file, args) {
  const sh = this.sh, cli = {};
  for (const a of args) { const m = String(a).match(/^([\w-]+):=(.*)$/); if (m) cli[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  if (file !== "display.launch.py" && !(pkg === "urdf_launch" && file === "description.launch.py")) return [this.err(`file '${file}' was not found in the share directory of package '${pkg}' at '/opt/ros/jazzy/share/${pkg}'`)];
  let path, label;
  if (pkg === "urdf_tutorial") {
    if (!cli.model) return [this.err("[ERROR] [launch]: Caught exception in launch (see debug for traceback): ... model:=<path to your .urdf or .urdf.xacro> is needed"), this.hint("Example: ros2 launch urdf_tutorial display.launch.py model:=$PWD/01_box.urdf")];
    path = sh.abs(cli.model.replace(/^\$PWD/, sh.cwd));
    if (!sh.isFile(path)) return [this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): file not found: ${cli.model}`), this.hint("A relative model path is looked for inside the urdf_tutorial package. Use the full path, for example model:=$PWD/my_robot.urdf")];
    label = path.split("/").pop();
  } else {
    const pk = sh.wsPkgs && sh.wsPkgs.get(cli.urdf_package);
    if (!cli.urdf_package || !cli.urdf_package_path) return [this.err("[ERROR] [launch]: urdf_launch needs urdf_package:=<package> and urdf_package_path:=<path inside it>")];
    if (!pk) return [this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): "package '${cli.urdf_package}' not found, searching: ['/opt/ros/jazzy']"`)];
    const [dir, ...rest] = cli.urdf_package_path.split("/");
    const content = pk[dir] && pk[dir][rest.join("/")];
    if (content === undefined) return [this.err(`[ERROR] [launch]: file '${cli.urdf_package_path}' was not found in package '${cli.urdf_package}' (was the ${dir} folder installed?)`)];
    path = `${pk.dir}/${cli.urdf_package_path}`; label = cli.urdf_package_path.split("/").pop();
    if (!sh.isFile(path)) { sh.mkdirP(path.replace(/\/[^/]*$/, "")); sh.fs.set(path, { type: "f", mode: "rw-r--r--", content }); }
  }
  const r = this.expandXacroFile(path, cli);
  if (r.err) return [this.out("[INFO] [launch]: Default logging verbosity is set to INFO"), this.err(`[ERROR] [launch]: Caught exception in launch (see debug for traceback): ${r.err}`)];
  const gui = (cli.gui ?? cli.jsp_gui ?? "true") !== "false";
  if (file === "description.launch.py") { const n = this.add("rsp", "robot_state_publisher", "", { robot_description: r.text }); this.lastStarted = [n.full]; return [this.out("[INFO] [robot_state_publisher-1]: process started with pid [4321]"), ...this.rspMessages(n).map((t) => this.out(t))]; }
  return this.startDisplay(r.text, { gui, label });
};
// xacro a file of the practice file system (includes relative to it, $(find pkg) -> installed share)
RosGraph.prototype.expandXacroFile = function (path, args = {}) {
  const sh = this.sh;
  const files = (p) => { const n = sh.node(p); return n && n.type === "f" ? n.content || "" : undefined; };
  const find = (pkg) => { const pk = sh.wsPkgs && sh.wsPkgs.get(pkg); return pk ? pk.dir : (["urdf_tutorial", "xacro"].includes(pkg) ? `/opt/ros/jazzy/share/${pkg}` : undefined); };
  const text = files(path);
  if (text === undefined) return { err: `No such file or directory: ${path}` };
  if (!/<xacro:|xmlns:xacro/.test(text) && !path.endsWith(".xacro")) return { text };
  try { return { text: runXacro(text, { args, files, find, path }) }; } catch (e) { return { err: `xacro: error: ${e.message}` }; }
};
RosGraph.prototype.checkUrdf = function (path) {
  const sh = this.sh, p = sh.abs(path || "");
  if (!path) return [this.err("Usage: check_urdf <urdf_file>")];
  if (!sh.isFile(p)) return [this.err(`Could not open file [${path}] for parsing.`)];
  const txt = sh.node(p).content || "";
  if (/<xacro:/.test(txt)) return [this.err("Error:   Error document empty (the file still contains <xacro:...> tags)"), this.hint(`check_urdf reads plain URDF. First run: xacro ${path} > ${path.replace(/\.xacro$/, "").replace(/\.urdf$/, "")}.urdf  then check that file.`)];
  try { const m = parseURDF(txt); return [...checkUrdfText(m).map((t) => this.out(t)), ...m.warnings.map((w) => this.hint("Warning: " + w))]; }
  catch (e) { return [this.err(e.message), this.err("ERROR: Model Parsing the xml failed")]; }
};
RosGraph.prototype.urdfToGraphviz = function (path, name) {
  const sh = this.sh, p = sh.abs(path || "");
  if (!path || !sh.isFile(p)) return [this.err(`Usage: urdf_to_graphviz input.xml [OUTPUT]  (file not found: ${path || ""})`)];
  let m; try { m = parseURDF(sh.node(p).content || ""); } catch (e) { return [this.err(e.message), this.err("ERROR: Model Parsing the xml failed")]; }
  const base = name || m.name;
  sh.fs.set(sh.abs(`${base}.gv`), { type: "f", mode: "rw-r--r--", content: graphviz(m) });
  sh.fs.set(sh.abs(`${base}.pdf`), { type: "f", mode: "rw-r--r--", content: "%PDF-1.4 (the link/joint tree as a picture)\n" + graphviz(m) });
  return [this.out(`Created file ${base}.gv`), this.out(`Created file ${base}.pdf`), this.hint(`The PDF draws links as boxes and joints as ovals (with their xyz and rpy). ${Object.keys(m.links).length} links, ${Object.keys(m.joints).length} joints.`)];
};
// extra TF edges for RViz that do NOT come from the URDF (static publishers, odometry...)
RosGraph.prototype.extraTfEdges = function () {
  const model = this.robotModel();
  const urdfChildren = new Set(model ? Object.values(model.joints).map((j) => j.child) : []);
  return this.tfTree().filter((e) => !urdfChildren.has(e.child));
};

// robot_description for robot_state_publisher started by a workspace launch file (xacro of an installed urdf file)
RosGraph.prototype.launchDescription = function (pk, text, n) {
  const sh = this.sh;
  const pv = JSON.stringify(n.params || {});
  const fileM = text.match(/['"]urdf['"]\s*,\s*['"]([\w.-]+\.(?:urdf\.xacro|xacro|urdf))['"]/) || pv.match(/urdf\/([\w.-]+\.(?:urdf\.xacro|xacro|urdf))/) || text.match(/urdf\/([\w.-]+\.(?:urdf\.xacro|xacro|urdf))/);
  if (!fileM) { const first = Object.entries(pk.urdf || {})[0]; if (first) return { text: first[1] }; return { err: "could not find which URDF file this launch file uses (expected something like PathJoinSubstitution([pkg, 'urdf', 'my_robot.urdf.xacro']))" }; }
  const pkgM = text.match(/FindPackageShare\(\s*['"]([\w-]+)['"]\s*\)/) || text.match(/get_package_share_directory\(\s*['"]([\w-]+)['"]\s*\)/) || text.match(/\$\(find-pkg-share ([\w-]+)\)/) || pv.match(/\$FINDSHARE:([\w-]+)/);
  const tp = pkgM ? sh.wsPkgs && sh.wsPkgs.get(pkgM[1]) : pk;
  if (!tp) return { err: `"package '${pkgM[1]}' not found, searching: ['/opt/ros/jazzy']"` };
  const content = (tp.urdf || {})[fileM[1]];
  if (content === undefined) return { err: `file '${HOME}/ros2_ws/install/${tp.name}/share/${tp.name}/urdf/${fileM[1]}' not found. Is the urdf folder installed (install(DIRECTORY urdf ...) in CMakeLists.txt), and did you colcon build and source again?` };
  if (!/<xacro:|xmlns:xacro/.test(content)) return { text: content };
  const files = (p) => { const nd = sh.node(p); return nd && nd.type === "f" ? nd.content || "" : undefined; };
  const find = (pkg) => { const x = sh.wsPkgs && sh.wsPkgs.get(pkg); return x ? x.dir : undefined; };
  try { return { text: runXacro(content, { files, find, path: `${tp.dir}/urdf/${fileM[1]}` }) }; } catch (e) { return { err: `xacro: error: ${e.message}` }; }
};

Object.assign(RosGraph.prototype, gzMethods);
Object.assign(RosGraph.prototype, rcMethods);
Object.assign(RosGraph.prototype, moveitMethods);
// teleop_twist_keyboard: one key press publishes one Twist on /cmd_vel
RosGraph.prototype.teleopTwistKey = function (full, key) {
  const n = this.node(full); if (!n) return null;
  const k = String(key);
  if ("qzwxec".includes(k) && k.length === 1) {
    const f = { q: [1.1, 1.1], z: [0.9, 0.9], w: [1.1, 1], x: [0.9, 1], e: [1, 1.1], c: [1, 0.9] }[k];
    n.speed *= f[0]; n.turn *= f[1];
    return { line: `currently:\tspeed ${+n.speed.toFixed(6)}\tturn ${+n.turn.toFixed(6)} ` };
  }
  // teleop_twist_keyboard moveBindings (x, y, z, th): lower case drives, Shift (upper case) strafes, t / b go up / down
  const b = { i: [1, 0, 0, 0], o: [1, 0, 0, -1], j: [0, 0, 0, 1], l: [0, 0, 0, -1], u: [1, 0, 0, 1], ",": [-1, 0, 0, 0], ".": [-1, 0, 0, 1], m: [-1, 0, 0, -1],
    O: [1, -1, 0, 0], I: [1, 0, 0, 0], J: [0, 1, 0, 0], L: [0, -1, 0, 0], U: [1, 1, 0, 0], "<": [-1, 0, 0, 0], ">": [-1, -1, 0, 0], M: [-1, 1, 0, 0], t: [0, 0, 1, 0], b: [0, 0, -1, 0] }[k] || [0, 0, 0, 0];
  const stamped = n.params.stamped === true || n.params.stamped === "true";
  const type = stamped ? "geometry_msgs/msg/TwistStamped" : "geometry_msgs/msg/Twist";
  const topic = (this.endpoints(n).pubs.find(([, t]) => t === type) || [`${n.ns}/cmd_vel`])[0];   // cmd_vel, after --ros-args -r cmd_vel:=...
  const v = { lx: b[0] * n.speed, ly: b[1] * n.speed, lz: b[2] * n.speed, az: b[3] * n.turn, topic };
  this.lastTwist = v; n.lastV = v; n.lastTopic = topic; n.stampedOut = stamped;
  if (stamped) {
    const got = this.cmDeliver(topic, type, { twist: { linear: { x: v.lx, y: v.ly, z: v.lz }, angular: { z: v.az } } });
    const used = got.filter((g) => g.used);
    const c = used.length ? used[0].model.cm.controllers.get(used[0].controller) : null;
    return { v, driven: used.map((g) => g.model.name), note: got.find((g) => g.note) ? got.find((g) => g.note).note : null, timeout: c && c.kind === "diff" && !(Number(n.params.repeat_rate) > 0) ? Number(c.params.cmd_vel_timeout) || 0.5 : null, stamped };
  }
  const driven = this.gzTwist(v.topic, v);
  const cmTopics = this.cmModels().flatMap((m) => [...m.cm.controllers.values()].filter((c) => c.kind === "diff" && c.state === "active").map((c) => m.cm.topicOf(c.name, "cmd_vel")));
  return { v, driven, cmTopics, stamped };
};
