// Weeks 7-9: describing robots (URDF), xacro, TF, launch, RViz, markers and interactive markers.
const { pick, pickN, int } = require("./util");
const T = [];
const mcq = (id, topic, make) => T.push({ id, topic, type: "mcq", make });
const fill = (id, topic, make) => T.push({ id, topic, type: "fill", make });
const r3 = (x) => Number(x.toFixed(3));
const forms = (x, d = 4) => { const s = new Set(); for (let k = 1; k <= d; k++) { s.add(x.toFixed(k)); s.add(String(Number(x.toFixed(k)))); } s.add(String(x)); return [...s]; };
const ROBOTS = ["chiku", "tinku", "rover_bot", "lab_arm", "delivery_bot", "spider_bot", "dog_bot"];
const LINKS = ["base_link", "upper_arm_link", "forearm_link", "wrist_link", "camera_link", "lidar_link", "left_wheel_link", "gripper_link"];

// ---------------- Week 7: links, geometry, origins (u7link) ----------------
mcq("U-ROOT", "u7link", (r) => {
  const names = pickN(r, LINKS, 4);
  return { prompt: `A URDF has these joints:\n${names[0]} → ${names[1]}\n${names[1]} → ${names[2]}\n${names[0]} → ${names[3]}\n(parent → child). Which link is the root?`,
    options: names, correct: names[0], explain: "The root is the only link that is never a child. Every other link has exactly one parent." };
});
mcq("U-TWOPARENT", "u7link", (r) => {
  const [a, b, c] = pickN(r, LINKS, 3);
  const good = `Error: link '${c}' has two parents`;
  return { prompt: `check_urdf fails on a robot where joint j1 is ${a} → ${c} and joint j2 is ${b} → ${c}. Why?`,
    options: [good, "Two joints may not have the same parent", "The robot has no root link", "Fixed joints cannot be used twice"], correct: good,
    explain: "URDF must be a tree: every link (except the root) has exactly ONE parent joint. Loops and two parents are not allowed." };
});
fill("U-SEAT", "u7link", (r) => {
  const h = pick(r, [0.1, 0.12, 0.15, 0.2, 0.24, 0.3, 0.08]);
  return { prompt: `A box of height ${h} m is drawn centred on its link's origin. What z value in <origin xyz="0 0 z"/> makes its bottom sit exactly on the link's origin? (metres)`,
    correct: String(r3(h / 2)), accept: forms(h / 2), explain: `Shapes are centred on their origin, so lift it by half the height: ${h} / 2 = ${r3(h / 2)} m.` };
});
fill("U-RAD", "u7link", (r) => {
  const d = pick(r, [30, 45, 60, 90, 120, 135, 180, 270]);
  const v = (d * Math.PI) / 180;
  return { prompt: `URDF angles are in radians. A designer wants a ${d}° rotation. What number goes in rpy? (2 decimal places are enough)`,
    correct: v.toFixed(4), accept: forms(v, 4), explain: `radians = degrees × π / 180 = ${d} × 3.1416 / 180 = ${v.toFixed(4)}.` };
});
mcq("U-CYLAXIS", "u7link", (r) => {
  const ax = pick(r, [["X", "0 1.5708 0"], ["Y", "1.5708 0 0"]]);
  const opts = ["0 1.5708 0", "1.5708 0 0", "0 0 1.5708", "0 0 0"];
  return { prompt: `A URDF <cylinder> is drawn along its local Z axis. Which rpy lays a wheel-shaped cylinder so its axis points along ${ax[0]}?`,
    options: opts, correct: ax[1], explain: ax[0] === "Y" ? "A roll of 90° (about X) turns Z towards Y: rpy=\"1.5708 0 0\". This is how wheels are usually drawn." : "A pitch of 90° (about Y) turns Z towards X: rpy=\"0 1.5708 0\"." };
});
mcq("U-GEOM", "u7link", (r) => {
  const g = pick(r, [["box", 'size="0.4 0.2 0.1"'], ["cylinder", 'radius="0.05" length="0.3"'], ["sphere", 'radius="0.04"'], ["mesh", 'filename="package://my_robot_description/meshes/body.stl"']]);
  const all = ['size="0.4 0.2 0.1"', 'radius="0.05" length="0.3"', 'radius="0.04"', 'filename="package://my_robot_description/meshes/body.stl"'];
  return { prompt: `Which attributes belong to a URDF <${g[0]}> geometry?`, options: all, correct: g[1], explain: "box: size; cylinder: radius and length; sphere: radius; mesh: filename (and an optional scale)." };
});
mcq("U-REP105", "u7link", (r) => {
  const q = pick(r, [["base_footprint", "the robot's point on the ground, under base_link"], ["base_link", "a frame fixed to the robot's body"], ["odom", "a world frame that drifts slowly (from wheel odometry)"], ["map", "a fixed world frame used for navigation"]]);
  const all = ["the robot's point on the ground, under base_link", "a frame fixed to the robot's body", "a world frame that drifts slowly (from wheel odometry)", "a fixed world frame used for navigation"];
  return { prompt: `In ROS frame conventions (REP 105), what is ${q[0]}?`, options: all, correct: q[1], explain: "map → odom → base_footprint → base_link. REP 103 also says: x forward, y left, z up, in metres and radians." };
});

// ---------------- Week 7: joints (u7joint) ----------------
mcq("U-JTYPE", "u7joint", (r) => {
  const c = pick(r, [["a wheel that spins forever", "continuous"], ["an elbow that bends between -2 and 2 rad", "revolute"], ["a gripper finger that slides 4 cm", "prismatic"], ["a camera bolted to the body", "fixed"], ["a lift that moves up and down", "prismatic"], ["a ceiling-fan blade", "continuous"], ["a laptop hinge", "revolute"]]);
  return { prompt: `Which joint type fits ${c[0]}?`, options: ["fixed", "revolute", "continuous", "prismatic"], correct: c[1],
    explain: "fixed: no motion; revolute: rotation with limits; continuous: rotation without limits; prismatic: sliding with limits." };
});
mcq("U-LIMIT", "u7joint", (r) => {
  const j = pick(r, ["shoulder_joint", "elbow_joint", "lift_joint", "finger_joint"]);
  const t = j === "lift_joint" || j === "finger_joint" ? "prismatic" : "revolute";
  return { prompt: `check_urdf says: "Joint [${j}] is of type REVOLUTE or PRISMATIC but it does not specify limits". The joint is ${t}. What must you add?`,
    options: ['<limit lower="..." upper="..." effort="..." velocity="..."/>', '<axis xyz="0 0 1"/>', '<dynamics damping="0.1"/>', '<mimic joint="..."/>'], correct: '<limit lower="..." upper="..." effort="..." velocity="..."/>',
    explain: "Revolute and prismatic joints need a <limit> with lower, upper, effort and velocity. Continuous joints do not." };
});
mcq("U-MIMIC", "u7joint", (r) => {
  const m = pick(r, [1, -1, 2, 0.5]), v = pick(r, [0.01, 0.02, 0.03, 0.04]);
  const good = r3(m * v);
  return { prompt: `right_finger_joint has <mimic joint="left_finger_joint" multiplier="${m}" offset="0"/>. The left finger is at ${v} m. Where is the right finger?`,
    options: [...new Set([String(good), String(r3(v + 0.01)), String(r3(-good)), "0", String(r3(v * 3))])].slice(0, 4), correct: String(good),
    explain: `mimic: value = multiplier × other + offset = ${m} × ${v} + 0 = ${good}. joint_state_publisher shows NO slider for a mimic joint.` };
});
mcq("U-FRAME", "u7joint", () => ({ prompt: "Where is a child link's frame (its origin) in URDF?",
  options: ["At the joint's origin: the child frame IS the joint frame", "At the centre of the child's visual shape", "At the parent link's origin", "At the root link"], correct: "At the joint's origin: the child frame IS the joint frame",
  explain: "Put the joint origin at the real hinge. Use the visual's own <origin> only to shift the drawing inside the link." }));
mcq("U-AXIS", "u7joint", (r) => {
  const c = pick(r, [["a wheel on a robot whose x points forward", "0 1 0"], ["a turret that turns left and right", "0 0 1"], ["a lift that moves straight up", "0 0 1"], ["a pan joint on a camera mast", "0 0 1"]]);
  return { prompt: `Which <axis xyz> fits ${c[0]}?`, options: ["1 0 0", "0 1 0", "0 0 1", "0 0 0"], correct: c[1], explain: "The axis is written in the joint's own frame. Wheels spin about y (sideways); turning left/right is about z (up)." };
});
fill("U-SLIDERS", "u7joint", (r) => {
  const rev = int(r, 2, 6), pri = int(r, 1, 2), mim = int(r, 0, Math.min(1, pri)), fix = int(r, 1, 4), con = int(r, 0, 4);
  const n = rev + pri + con - mim;
  return { prompt: `A robot has ${rev} revolute, ${con} continuous, ${pri} prismatic (${mim} of them uses <mimic>) and ${fix} fixed joints. How many sliders does joint_state_publisher_gui show?`,
    correct: String(n), explain: `One slider per moving joint, but none for fixed joints or mimic joints: ${rev} + ${con} + ${pri} − ${mim} = ${n}.` };
});

// ---------------- Week 7: collision and inertia (u7inertia) ----------------
fill("U-IBOX", "u7inertia", (r) => {
  const m = pick(r, [2, 3, 4, 5, 6]), x = pick(r, [0.4, 0.5, 0.6]), y = pick(r, [0.2, 0.3]), z = pick(r, [0.1, 0.15, 0.2]);
  const v = (m * (x * x + y * y)) / 12;
  return { prompt: `A solid box: mass ${m} kg, size x=${x}, y=${y}, z=${z} m. What is izz = m(x² + y²)/12? (kg·m², 4 decimal places)`,
    correct: v.toFixed(4), accept: forms(v, 5), explain: `izz = ${m} × (${x}² + ${y}²) / 12 = ${m} × ${r3(x * x + y * y)} / 12 = ${v.toFixed(5)} kg·m².` };
});
fill("U-ICYL", "u7inertia", (r) => {
  const m = pick(r, [0.2, 0.4, 0.5, 1.0]), rr = pick(r, [0.05, 0.08, 0.1]);
  const v = (m * rr * rr) / 2;
  return { prompt: `A wheel is a solid cylinder: mass ${m} kg, radius ${rr} m. What is izz = m r² / 2 (about its own axis)? (kg·m², 5 decimal places)`,
    correct: v.toFixed(5), accept: forms(v, 6), explain: `izz = ${m} × ${rr}² / 2 = ${v.toFixed(6)} kg·m².` };
});
mcq("U-WHYCOL", "u7inertia", (r) => {
  const q = pick(r, [["<collision>", "the shape physics uses for touching and bumping, usually simpler than the visual"], ["<visual>", "the shape you see drawn in RViz"], ["<inertial>", "mass and inertia, used by a physics simulator such as Gazebo"]]);
  const all = ["the shape physics uses for touching and bumping, usually simpler than the visual", "the shape you see drawn in RViz", "mass and inertia, used by a physics simulator such as Gazebo", "the colour of the link"];
  return { prompt: `What is ${q[0]} in a URDF link?`, options: all, correct: q[1], explain: "visual = looks, collision = touch (keep it simple: boxes, cylinders, spheres), inertial = how hard it is to push and spin." };
});
mcq("U-RVIZINERTIA", "u7inertia", () => ({ prompt: "Your robot has no <inertial> tags. What happens?",
  options: ["RViz shows it fine, but a physics simulator like Gazebo cannot simulate it properly", "RViz refuses to show it", "check_urdf fails", "robot_state_publisher crashes"], correct: "RViz shows it fine, but a physics simulator like Gazebo cannot simulate it properly",
  explain: "RViz only draws shapes at TF poses. Simulators integrate forces, so every moving link needs mass and inertia." }));

// ---------------- Week 8: xacro (x8xacro) ----------------
fill("X-EXPR", "x8xacro", (r) => {
  const w = pick(r, [0.3, 0.4, 0.36, 0.5]), l = pick(r, [0.04, 0.05, 0.06]);
  const v = w / 2 + l / 2;
  return { prompt: `<xacro:property name="base_w" value="${w}"/> and <xacro:property name="wheel_len" value="${l}"/>.\nWhat does \${base_w/2 + wheel_len/2} become?`,
    correct: String(r3(v)), accept: forms(v), explain: `${w}/2 + ${l}/2 = ${r3(w / 2)} + ${r3(l / 2)} = ${r3(v)}. xacro does the maths when it builds the URDF.` };
});
mcq("X-SUBST", "x8xacro", (r) => {
  const k = pick(r, [["${...}", "a maths expression or a property value"], ["$(arg name)", "an argument given on the command line or in the launch file"], ["$(find pkg)", "the share folder of an installed package"]]);
  const all = ["a maths expression or a property value", "an argument given on the command line or in the launch file", "the share folder of an installed package", "a shell command"];
  return { prompt: `In a xacro file, what does ${k[0]} give you?`, options: all, correct: k[1], explain: "${} is for properties and maths; $(arg) for arguments; $(find pkg) for package paths." };
});
mcq("X-NS", "x8xacro", () => ({ prompt: "xacro prints the <xacro:property> and <xacro:macro> tags unchanged in the output, as if it ignored them. What is missing?",
  options: ['xmlns:xacro="http://www.ros.org/wiki/xacro" in the <robot> tag', "A <link> named base_link", "The .urdf file extension", "source install/setup.bash"], correct: 'xmlns:xacro="http://www.ros.org/wiki/xacro" in the <robot> tag',
  explain: "Without the xacro namespace declaration, the xacro: tags are not recognised." }));
mcq("X-RAW", "x8xacro", () => ({ prompt: "robot_state_publisher reports a parse error, and the robot_description still contains <xacro:macro> tags. What is the fix?",
  options: ["Run the file through xacro first: robot_description:=\"$(xacro robot.urdf.xacro)\"", "Rename the file to .urdf", "Add more links", "Use joint_state_publisher_gui"], correct: "Run the file through xacro first: robot_description:=\"$(xacro robot.urdf.xacro)\"",
  explain: "robot_state_publisher reads plain URDF. xacro turns the .xacro file into URDF (Command(['xacro ', path]) in launch files)." }));
mcq("X-MACROCALL", "x8xacro", (r) => {
  const side = pick(r, ["left", "right", "front", "rear"]), sign = side === "right" || side === "rear" ? -1 : 1;
  const good = `<xacro:wheel side="${side}" y_sign="${sign}"/>`;
  return { prompt: `A macro is defined as <xacro:macro name="wheel" params="side y_sign">. Which line creates the ${side} wheel?`,
    options: [good, `<wheel side="${side}" y_sign="${sign}"/>`, `<xacro:macro name="wheel" side="${side}"/>`, `<xacro:wheel name="${side}"/>`], correct: good, explain: "Call a macro with <xacro:NAME param=\"value\" .../>, one attribute per parameter." };
});
mcq("X-ARG", "x8xacro", (r) => {
  const a = pick(r, ["use_lidar", "use_camera", "with_arm", "add_gripper"]);
  const good = `xacro robot.urdf.xacro ${a}:=false > robot.urdf`;
  return { prompt: `The file has <xacro:arg name="${a}" default="true"/> and <xacro:if value="$(arg ${a})">. Which command builds the robot WITHOUT that part?`,
    options: [good, `xacro robot.urdf.xacro --${a} false > robot.urdf`, `xacro robot.urdf.xacro ${a}=false > robot.urdf`, `check_urdf robot.urdf.xacro ${a}:=false`], correct: good, explain: "Give xacro arguments as name:=value after the file name." };
});

// ---------------- Week 8: TF (x8tf) ----------------
mcq("X-RSP", "x8tf", () => ({ prompt: "Which node turns the URDF and /joint_states into TF transforms?",
  options: ["robot_state_publisher", "joint_state_publisher", "rviz2", "static_transform_publisher"], correct: "robot_state_publisher",
  explain: "robot_state_publisher reads robot_description, listens to /joint_states and publishes /tf (moving joints) and /tf_static (fixed joints)." }));
mcq("X-NOJS", "x8tf", (r) => {
  const l = pick(r, ["left_wheel_link", "upper_arm_link", "forearm_link", "front_left_thigh_link"]);
  return { prompt: `RViz shows: "No transform from [${l}] to [base_link]". The fixed parts of the robot are drawn. What is missing?`,
    options: ["joint_state_publisher (or joint_state_publisher_gui) is not running", "The fixed frame must be map", "The link has no colour", "rviz2 needs to be restarted"], correct: "joint_state_publisher (or joint_state_publisher_gui) is not running",
    explain: "Fixed joints go to /tf_static, but moving joints need joint values on /joint_states before robot_state_publisher can publish them." };
});
mcq("X-STATIC", "x8tf", (r) => {
  const x = pick(r, [0.1, 0.2, 0.3]), p = pick(r, ["base_link", "base_footprint"]), c = pick(r, ["camera_link", "lidar_link", "imu_link"]);
  const good = `ros2 run tf2_ros static_transform_publisher --x ${x} --frame-id ${p} --child-frame-id ${c}`;
  return { prompt: `Which command (ROS 2 Jazzy style) publishes ${c} ${x} m in front of ${p}?`,
    options: [good, `ros2 run tf2_ros static_transform_publisher ${x} 0 0 0 0 0 ${c} ${p}`, `ros2 run tf2_ros tf2_echo ${p} ${c} --x ${x}`, `ros2 topic pub /tf ${p} ${c} ${x}`], correct: good,
    explain: "Use named flags: --x --y --z --roll --pitch --yaw --frame-id (parent) --child-frame-id (child). Missing values are 0. The old positional form is deprecated." };
});
mcq("X-ECHO", "x8tf", () => ({ prompt: "Which command prints where one frame is, as seen from another, once per second?",
  options: ["ros2 run tf2_ros tf2_echo base_link lidar_link", "ros2 run tf2_tools view_frames", "ros2 topic list", "check_urdf robot.urdf"], correct: "ros2 run tf2_ros tf2_echo base_link lidar_link",
  explain: "tf2_echo prints translation and rotation. view_frames saves a PDF of the whole TF tree." }));
T.push({ id: "X-PIPE", topic: "x8tf", type: "order", make() {
  return { prompt: "Put the URDF-to-RViz pipeline in order.", items: ["robot.urdf.xacro (your file)", "xacro (expands it into plain URDF)", "robot_state_publisher (+ /joint_states)", "/tf and /tf_static", "RViz2 (RobotModel and TF displays)"],
    explain: "xacro → URDF text → robot_state_publisher computes TF from it and the joint values → RViz draws the links at those TF poses." };
} });
fill("X-ECHOZ", "x8tf", (r) => {
  const wheel = pick(r, [0.06, 0.07, 0.08, 0.1]), h = pick(r, [0.12, 0.15, 0.2]), extra = pick(r, [0.02, 0.03]);
  const z = wheel + h + extra;
  return { prompt: `base_joint lifts base_link ${wheel} m above base_footprint. lidar_joint puts lidar_link ${r3(h + extra)} m above base_link. What z does tf2_echo base_footprint lidar_link print? (metres)`,
    correct: String(r3(z)), accept: forms(z), explain: `Frames add up along the tree: ${wheel} + ${r3(h + extra)} = ${r3(z)} m.` };
});

// ---------------- Week 8: description package and launch (x8launch) ----------------
mcq("X-INSTALL", "x8launch", (r) => {
  const dir = pick(r, ["urdf", "meshes", "rviz", "launch"]);
  return { prompt: `ros2 launch fails with "file not found" for a file in the ${dir}/ folder of your ament_cmake description package, although the file exists in src. What is missing?`,
    options: [`install(DIRECTORY ${dir} DESTINATION share/\${PROJECT_NAME}/) in CMakeLists.txt (then build and source again)`, `A setup.py entry point for ${dir}`, `<exec_depend>${dir}</exec_depend>`, "A colcon test"], correct: `install(DIRECTORY ${dir} DESTINATION share/\${PROJECT_NAME}/) in CMakeLists.txt (then build and source again)`,
    explain: "Launch files read the INSTALLED share folder. Folders are copied there only if CMakeLists.txt installs them." };
});
mcq("X-VALUETYPE", "x8launch", () => ({ prompt: "Why is the robot_description in a Python launch file wrapped as ParameterValue(Command(['xacro ', path]), value_type=str)?",
  options: ["So launch passes the URDF text as a plain string instead of trying to read it as YAML", "So xacro runs faster", "Because RViz needs it", "So the file is installed"], correct: "So launch passes the URDF text as a plain string instead of trying to read it as YAML",
  explain: "Without value_type=str, launch may try to parse the long XML text as YAML and fail." }));
mcq("X-SPACE", "x8launch", () => ({ prompt: "Command(['xacro', model_path]) fails with a strange 'command not found' style error. What is wrong?",
  options: ["There is no space after 'xacro', so the two parts join into one word", "xacro must be written XACRO", "Command needs three parts", "model_path must be absolute"], correct: "There is no space after 'xacro', so the two parts join into one word",
  explain: "Command joins its parts as text: write ['xacro ', model_path] with a space after xacro." }));
mcq("X-PKGURI", "x8launch", (r) => {
  const pkg = pick(r, ["my_robot_description", "chiku_description", "arm_description"]);
  return { prompt: `RViz shows "Could not load resource [package://${pkg}/meshes/body.stl]". Which is NOT a possible cause?`,
    options: ["The joint has no <dynamics> tag", "The meshes folder is not installed", `The package name in the URI is not exactly ${pkg}`, "The workspace was not sourced after building"], correct: "The joint has no <dynamics> tag",
    explain: "package:// is looked up in the installed share folder of that package. Install the meshes folder, spell the package name exactly, build and source." };
});
mcq("X-SCALE", "x8launch", () => ({ prompt: "Your STL mesh, exported from CAD, appears 1000 times too big in RViz. What is the fix?",
  options: ['scale="0.001 0.001 0.001" on the <mesh> (the CAD file is in millimetres)', 'scale="1000 1000 1000"', "Use a <box> instead of a mesh", "Change the fixed frame"], correct: 'scale="0.001 0.001 0.001" on the <mesh> (the CAD file is in millimetres)',
  explain: "URDF uses metres. Many CAD tools export millimetres, so scale by 0.001." }));
mcq("X-GUIARG", "x8launch", () => ({ prompt: "A display launch file starts joint_state_publisher_gui with condition=IfCondition(gui) and joint_state_publisher with UnlessCondition(gui). What does `ros2 launch my_robot_description display.launch.py gui:=false` start?",
  options: ["joint_state_publisher (no slider window)", "joint_state_publisher_gui", "both of them", "neither of them"], correct: "joint_state_publisher (no slider window)",
  explain: "IfCondition runs a node when the value is true; UnlessCondition runs it when the value is false." }));

// ---------------- Week 9: RViz (r9rviz) ----------------
mcq("R-MAPERR", "r9rviz", (r) => {
  const f = pick(r, ["base_link", "base_footprint", "odom"]);
  return { prompt: `You start rviz2 for a robot. Global Status says "Frame [map] does not exist". robot_state_publisher publishes ${f} and its children. What do you do?`,
    options: [`Set Fixed Frame to ${f}`, "Restart robot_state_publisher", "Add a Grid display", "Delete the map"], correct: `Set Fixed Frame to ${f}`,
    explain: "RViz starts with Fixed Frame = map. Choose a frame that exists and does not move relative to what you want to see." };
});
mcq("R-DISPLAY", "r9rviz", (r) => {
  const c = pick(r, [["the robot's links drawn from the URDF", "RobotModel"], ["the frames as small axes with their names", "TF"], ["the lines of a 2D laser scanner", "LaserScan"], ["a 3D point cloud from a depth camera", "PointCloud2"], ["an occupancy-grid map", "Map"], ["shapes that your node publishes", "MarkerArray"]]);
  return { prompt: `Which RViz display shows ${c[0]}?`, options: [c[1], ...pickN(r, ["RobotModel", "TF", "LaserScan", "PointCloud2", "Map", "MarkerArray"].filter((x) => x !== c[1]), 3)], correct: c[1],
    explain: "Add displays with the Add button, choose the topic, and check the display's status." };
});
mcq("R-QOS", "r9rviz", () => ({ prompt: "A LaserScan display shows nothing, and its status says no messages are received. `ros2 topic info -v /scan` shows the publisher uses BEST_EFFORT reliability. What do you change?",
  options: ["Set the display's Reliability Policy to Best Effort", "Set Fixed Frame to map", "Increase the point size", "Restart RViz"], correct: "Set the display's Reliability Policy to Best Effort",
  explain: "A Reliable subscriber does not match a Best Effort publisher. Many sensor drivers publish Best Effort." }));
mcq("R-SAVE", "r9rviz", () => ({ prompt: "How do you make RViz open with your displays and Fixed Frame every time from a launch file?",
  options: ["Save the setup (File → Save Config As) into the package's rviz/ folder, install it, and start rviz2 with -d <that file>", "Type the displays into the URDF", "Add them to package.xml", "RViz always remembers by itself"], correct: "Save the setup (File → Save Config As) into the package's rviz/ folder, install it, and start rviz2 with -d <that file>",
  explain: "A .rviz file is a small YAML file listing the displays and options. Pass it with arguments=['-d', path]." }));
mcq("R-FIXED", "r9rviz", () => ({ prompt: "Chiku drives forward. With Fixed Frame = odom the robot moves across the grid. What do you see with Fixed Frame = base_link?",
  options: ["The robot stays still and the world slides past it", "Exactly the same picture", "Nothing at all", "The robot moves twice as fast"], correct: "The robot stays still and the world slides past it",
  explain: "Everything is drawn relative to the fixed frame. If the fixed frame moves with the robot, the robot looks still." }));

// ---------------- Week 9: markers (r9marker) ----------------
mcq("R-MTYPE", "r9marker", (r) => {
  const c = pick(r, [["a path joining waypoints", "LINE_STRIP"], ["a label that always faces the camera", "TEXT_VIEW_FACING"], ["many identical balls in one marker", "SPHERE_LIST"], ["a direction to move", "ARROW"], ["a round warning zone on the floor", "CYLINDER"], ["a box around an obstacle", "CUBE"]]);
  const all = ["LINE_STRIP", "TEXT_VIEW_FACING", "SPHERE_LIST", "ARROW", "CYLINDER", "CUBE"];
  return { prompt: `Which visualization_msgs/Marker type draws ${c[0]}?`, options: [c[1], ...pickN(r, all.filter((x) => x !== c[1]), 3)], correct: c[1],
    explain: "Shapes: ARROW, CUBE, SPHERE, CYLINDER. Lists: LINE_STRIP, LINE_LIST, CUBE_LIST, SPHERE_LIST, POINTS. Also TEXT_VIEW_FACING, MESH_RESOURCE, TRIANGLE_LIST (and ARROW_STRIP in Jazzy)." };
});
mcq("R-ALPHA", "r9marker", (r) => {
  const col = pick(r, ["r", "g", "b"]);
  return { prompt: `A node publishes a Marker with color.${col} = 1.0 and correct scale and frame, but nothing appears in RViz. What is the most likely mistake?`,
    options: ["color.a (alpha) is still 0, so the marker is fully transparent", "The marker id is 0", "The ns is empty", "The lifetime is 0"], correct: "color.a (alpha) is still 0, so the marker is fully transparent",
    explain: "Colour values default to 0, including alpha. Always set color.a = 1.0. (lifetime 0 means 'forever', which is fine.)" };
});
mcq("R-ID", "r9marker", () => ({ prompt: "A node publishes 5 waypoint SPHERE markers, all with ns='wp' and id=0. RViz shows only one sphere. Why?",
  options: ["ns + id identify a marker, so each new one replaced the previous one", "RViz can only show one sphere", "SPHERE needs points", "The frame is wrong"], correct: "ns + id identify a marker, so each new one replaced the previous one",
  explain: "Give each marker a different id (or use one SPHERE_LIST marker with 5 points)." }));
mcq("R-LINESCALE", "r9marker", () => ({ prompt: "For a LINE_STRIP marker, which scale field sets the line width?",
  options: ["scale.x", "scale.y", "scale.z", "all three"], correct: "scale.x",
  explain: "LINE_STRIP and LINE_LIST use only scale.x (width). TEXT_VIEW_FACING uses only scale.z (text height)." }));
mcq("R-DELETEALL", "r9marker", () => ({ prompt: "Which action removes ALL markers your node published, in one message?",
  options: ["action = DELETEALL (3)", "action = DELETE (2)", "action = ADD (0) with alpha 0", "publishing an empty string"], correct: "action = DELETEALL (3)",
  explain: "ADD (0) creates or updates, DELETE (2) removes one ns/id, DELETEALL (3) clears everything." }));
fill("R-WIDTH", "r9marker", (r) => {
  const n = int(r, 3, 9);
  return { prompt: `A LINE_STRIP marker has ${n} points. How many straight line segments does RViz draw?`, correct: String(n - 1), explain: `A strip joins neighbours: ${n} points → ${n - 1} segments. (A LINE_LIST would draw ${Math.floor(n / 2)}: one per pair.)` };
});

// ---------------- Week 9: interactive markers (r9imarker) ----------------
mcq("R-APPLY", "r9imarker", () => ({ prompt: "Your InteractiveMarkerServer node inserts a marker, but nothing appears in RViz. What did you most likely forget?",
  options: ["server.applyChanges()", "server.spin()", "rclpy.shutdown()", "A MarkerArray publisher"], correct: "server.applyChanges()",
  explain: "insert(), setPose() and erase() are only sent to RViz when you call applyChanges()." }));
mcq("R-MODE", "r9imarker", (r) => {
  const c = pick(r, [["drag a goal around on the floor", "MOVE_PLANE"], ["turn a goal's heading", "ROTATE_AXIS"], ["slide a marker along one line", "MOVE_AXIS"], ["move a target freely in 3D", "MOVE_3D"], ["click it like a button", "BUTTON"], ["right-click for a list of commands", "MENU"]]);
  const all = ["MOVE_PLANE", "ROTATE_AXIS", "MOVE_AXIS", "MOVE_3D", "BUTTON", "MENU"];
  return { prompt: `Which InteractiveMarkerControl interaction_mode lets the user ${c[0]}?`, options: [c[1], ...pickN(r, all.filter((x) => x !== c[1]), 3)], correct: c[1],
    explain: "The control's orientation sets the axis (its x axis) or, for MOVE_PLANE, the plane's normal." };
});
mcq("R-FEEDBACK", "r9imarker", () => ({ prompt: "In the feedback callback, which event tells you the user has finished dragging?",
  options: ["MOUSE_UP", "POSE_UPDATE", "KEEP_ALIVE", "MENU_SELECT"], correct: "MOUSE_UP",
  explain: "POSE_UPDATE arrives many times while dragging; MOUSE_UP once when the mouse is released. MENU_SELECT is for menu clicks." }));
mcq("R-IMNS", "r9imarker", (r) => {
  const ns = pick(r, ["chiku_goal", "arm_target", "goal_marker", "drop_zone"]);
  return { prompt: `The node runs InteractiveMarkerServer(node, '${ns}'). What do you set in RViz's InteractiveMarkers display?`,
    options: [`Interactive Markers Namespace: /${ns}`, "Topic: /visualization_marker", "Fixed Frame: interactive", `Marker topic: /${ns}/markers`], correct: `Interactive Markers Namespace: /${ns}`,
    explain: "The display connects to the server by its namespace, then shows its markers and sends feedback back." };
});

module.exports = T;
