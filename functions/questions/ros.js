// Week 3 templates: ROS 2 core concepts. Topics: graph (nodes, topics, messages), comm (services,
// parameters, actions), tools (launch, workspaces, TF2, bags and debugging).
const { pick, pickN, int, PKGS, NODE_NAMES, WORKSPACES } = require("./util");
const T = [];
const KINDS = ["topic", "service", "action"];

// ======================= graph =======================
T.push({ id: "R3-RUN", topic: "graph", type: "fill", make(r) {
  const [pkg, exe] = pick(r, [["turtlesim", "turtlesim_node"], ["turtlesim", "turtle_teleop_key"], ["demo_nodes_py", "talker"], ["demo_nodes_py", "listener"], ["demo_nodes_cpp", "talker"]]);
  return { prompt: `Type the command that starts the program \`${exe}\` from the package \`${pkg}\`.`, correct: `ros2 run ${pkg} ${exe}`,
    explain: "The pattern is ros2 run <package> <executable>." };
} });
T.push({ id: "R3-NODEINFO", topic: "graph", type: "mcq", make(r) {
  const n = pick(r, NODE_NAMES);
  return { prompt: `Which command shows every topic, service and action that the running node \`/${n}\` uses?`,
    options: [`ros2 node info /${n}`, `ros2 node list /${n}`, `ros2 topic info /${n}`, `ros2 run ${n}`], correct: `ros2 node info /${n}`,
    explain: "ros2 node info lists a node's subscribers, publishers, service servers and clients, and action servers and clients." };
} });
T.push({ id: "R3-SUBCOUNT", topic: "graph", type: "mcq", make(r) {
  const k = int(r, 2, 5), t = pick(r, ["/scan", "/camera/image", "/odom", "/battery"]);
  return { prompt: `One node publishes on \`${t}\` and ${k} nodes subscribe to \`${t}\`. How many copies of each message are delivered?`,
    options: [String(k), "1", String(k + 1), "0"], correct: String(k),
    explain: "Every subscriber of a topic receives its own copy of every message." };
} });
T.push({ id: "R3-TYPO", topic: "graph", type: "mcq", make(r) {
  const [good, badName] = pick(r, [["/scan", "/Scan"], ["/cmd_vel", "/cmdvel"], ["/camera/image", "/camera_image"], ["/odom", "/odometry"]]);
  return { prompt: `A lidar publishes on \`${good}\`, but your subscriber uses \`${badName}\`. What happens?`,
    options: ["The callback never runs, and no error is shown", "ROS 2 corrects the name automatically", "The program crashes with a name error", "The lidar stops publishing"],
    correct: "The callback never runs, and no error is shown",
    explain: "Topic names must match exactly. A different name is simply a different (empty) topic, so it fails silently." };
} });
T.push({ id: "R3-TWIST", topic: "graph", type: "mcq", make(r) {
  const want = pick(r, ["turn on the spot", "drive straight forward", "reverse"]);
  const right = { "turn on the spot": "linear.x = 0.0, angular.z = 1.0", "drive straight forward": "linear.x = 0.5, angular.z = 0.0", "reverse": "linear.x = -0.3, angular.z = 0.0" }[want];
  return { prompt: `Which Twist message makes a ground robot **${want}**?`,
    options: ["linear.x = 0.0, angular.z = 1.0", "linear.x = 0.5, angular.z = 0.0", "linear.x = -0.3, angular.z = 0.0", "linear.x = 0.0, angular.z = 0.0"], correct: right,
    explain: "linear.x is forward speed (negative = backwards); angular.z is turning speed (positive = left)." };
} });
T.push({ id: "R3-ECHO", topic: "graph", type: "fill", make(r) {
  const t = pick(r, ["/turtle1/pose", "/scan", "/battery", "/chatter", "/odom"]);
  return { prompt: `Type the command that prints the messages arriving on the topic \`${t}\`.`, correct: `ros2 topic echo ${t}`,
    accept: [`ros2 topic echo ${t}`, `ros2 topic echo --once ${t}`, `ros2 topic echo ${t} --once`], explain: "ros2 topic echo subscribes to a topic and prints what arrives." };
} });
T.push({ id: "R3-PUBORDER", topic: "graph", type: "predict", make(r) {
  const t = pick(r, ["chatter", "status", "beep", "battery"]), q = pick(r, [5, 10, 20]);
  return { prompt: "In this line, what is the **topic name**? (Type it exactly as written, without quotes.)", code: `self.pub = self.create_publisher(String, '${t}', ${q})`,
    correct: t, accept: [t, `'${t}'`, `"${t}"`], explain: `create_publisher(message type, topic name, queue size): the topic is ${t} and the queue size is ${q}.` };
} });

// ======================= comm =======================
T.push({ id: "R3-CHOOSE", topic: "comm", type: "mcq", make(r) {
  const [job, kind] = pick(r, [["stream laser distances 10 times per second", "topic"], ["ask once for the robot's serial number", "service"], ["drive to room 204 and report progress", "action"],
    ["send camera images continuously", "topic"], ["reset the map, with a reply when done", "service"], ["move the arm to a pick position (takes 10 s, may be cancelled)", "action"], ["publish the battery level every second", "topic"], ["dock at the charger with progress updates", "action"]]);
  return { prompt: `Which way of talking fits best? The robot must **${job}**.`, options: [...KINDS, "parameter"], correct: kind,
    explain: "Streams use topics, quick questions use services, long jobs with feedback and cancel use actions." };
} });
T.push({ id: "R3-SRVCALL", topic: "comm", type: "fill", make(r) {
  const x = int(r, 1, 9), y = int(r, 1, 9);
  return { prompt: `Type the command that calls the service \`/spawn\` (type \`turtlesim/srv/Spawn\`) to make a turtle at x = ${x}, y = ${y}, theta = 0, with an empty name. Use the values \`"{x: ${x}, y: ${y}, theta: 0.0, name: ''}"\`.`,
    correct: `ros2 service call /spawn turtlesim/srv/Spawn "{x: ${x}, y: ${y}, theta: 0.0, name: ''}"`,
    accept: [`ros2 service call /spawn turtlesim/srv/Spawn "{x: ${x}, y: ${y}, theta: 0.0, name: ''}"`, `ros2 service call /spawn turtlesim/srv/Spawn '{x: ${x}, y: ${y}, theta: 0.0, name: ""}'`],
    explain: "ros2 service call <service> <type> \"<request values>\"." };
} });
T.push({ id: "R3-SRVRETURN", topic: "comm", type: "mcq", make(r) {
  const a = int(r, 1, 9), b = int(r, 1, 9);
  return { prompt: `A client sends \`AddTwoInts.Request(a=${a}, b=${b})\` to this server. What must the callback do so the client gets the answer?`,
    code: "def add(self, request, response):\n    response.sum = request.a + request.b\n    ____",
    options: ["return response", "return request", "self.publish(response)", "print(response)"], correct: "return response",
    explain: `The server fills the response (sum = ${a + b}) and must return it; the returned response goes back to the client.` };
} });
T.push({ id: "R3-PARAMSET", topic: "comm", type: "fill", make(r) {
  const n = pick(r, NODE_NAMES), [p, v] = pick(r, [["max_speed", "0.3"], ["stop_distance", "0.5"], ["robot_name", "Chiku"], ["use_camera", "false"]]);
  return { prompt: `Type the command that changes the parameter \`${p}\` of the running node \`/${n}\` to \`${v}\`.`, correct: `ros2 param set /${n} ${p} ${v}`,
    explain: "ros2 param set <node> <parameter> <value> changes a setting while the node runs." };
} });
T.push({ id: "R3-PARAMCODE", topic: "comm", type: "mcq", make(r) {
  const [p, d] = pick(r, [["max_speed", "0.5"], ["stop_distance", "0.4"], ["robot_name", "'Chiku'"], ["blink_period", "1.0"]]);
  return { prompt: `Inside \`__init__\`, which line creates a parameter \`${p}\` with the default value ${d}?`,
    options: [`self.declare_parameter('${p}', ${d})`, `self.get_parameter('${p}', ${d})`, `self.${p} = parameter(${d})`, `self.create_parameter('${p}', ${d})`], correct: `self.declare_parameter('${p}', ${d})`,
    explain: "declare_parameter(name, default) creates the parameter; get_parameter(name).value reads it." };
} });
T.push({ id: "R3-ACTPARTS", topic: "comm", type: "order", make(r) {
  const job = pick(r, ["drive to the kitchen", "rotate to face north", "dock at the charger", "pick up the parcel"]);
  return { prompt: `Put the parts of an action in the order they happen when a robot is asked to **${job}**.`,
    items: ["The client sends a goal", "The server accepts the goal", "The server sends feedback while working", "The server sends the result"],
    explain: "Goal, accepted, feedback (many times), then one result. The client may cancel before the result." };
} });
T.push({ id: "R3-ACTCANCEL", topic: "comm", type: "mcq", make(r) {
  return { prompt: "What can an **action** client do that a **service** client cannot?", options: ["Receive feedback while waiting and cancel the job", "Send a request", "Receive a reply", "Use a message type"],
    correct: "Receive feedback while waiting and cancel the job", explain: "Both send a request and get a result; only actions stream feedback and can be cancelled." };
} });

// ======================= tools =======================
T.push({ id: "R3-LAUNCH", topic: "tools", type: "fill", make(r) {
  const p = pick(r, PKGS), f = pick(r, ["bringup", "robot", "sim", "demo"]);
  return { prompt: `Type the command that starts the launch file \`${f}.launch.py\` from the package \`${p}\`.`, correct: `ros2 launch ${p} ${f}.launch.py`,
    explain: "ros2 launch <package> <launch_file> starts every node in the file." };
} });
T.push({ id: "R3-WSORDER", topic: "tools", type: "order", make(r) {
  const w = pick(r, WORKSPACES), p = pick(r, PKGS);
  return { prompt: `You changed the code of \`${p}\` in \`~/${w}/src\`. Put the steps in order to run your new version.`,
    items: [`cd ~/${w}`, "colcon build", "source install/setup.bash", `ros2 run ${p} main`],
    explain: "Go to the workspace folder (not src), build, load the overlay, run: build, source, run." };
} });
T.push({ id: "R3-NOTFOUND", topic: "tools", type: "mcq", make(r) {
  const p = pick(r, PKGS);
  return { prompt: `You built \`${p}\` with colcon, opened a **new** terminal and typed \`ros2 run ${p} main\`. It says "Package '${p}' not found". What is the fix?`,
    options: ["Run source install/setup.bash in the workspace folder (or add it to ~/.bashrc)", "Reinstall ROS 2", "Rename the package", "Run colcon build inside the src folder"],
    correct: "Run source install/setup.bash in the workspace folder (or add it to ~/.bashrc)", explain: "A new terminal forgets what was sourced. Your workspace overlay must be sourced in every terminal." };
} });
T.push({ id: "R3-PKGCREATE", topic: "tools", type: "fill", make(r) {
  const p = pick(r, PKGS);
  return { prompt: `You are in \`~/ros2_ws/src\`. Type the command that creates a **Python** package called \`${p}\` (use \`--build-type ament_python\`).`,
    correct: `ros2 pkg create --build-type ament_python ${p}`,
    accept: [`ros2 pkg create --build-type ament_python ${p}`, `ros2 pkg create ${p} --build-type ament_python`, `ros2 pkg create --build-type ament_python --license Apache-2.0 ${p}`],
    explain: "ros2 pkg create --build-type ament_python <name> makes package.xml, setup.py, setup.cfg and the code folder." };
} });
T.push({ id: "R3-FRAME", topic: "tools", type: "mcq", make(r) {
  const q = pick(r, [["Which frame is fixed to the building and never moves?", "map"], ["Which frame is the robot's own body (x forward, y left)?", "base_link"], ["Which frame drifts slowly because it comes from counting wheel turns?", "odom"]]);
  return { prompt: q[0], options: ["map", "base_link", "odom", "laser"], correct: q[1], explain: "map is fixed to the world, odom comes from wheel odometry and drifts, base_link is the robot body, laser is the sensor." };
} });
T.push({ id: "R3-BAG", topic: "tools", type: "fill", make(r) {
  const n = pick(r, ["corridor", "test_run", "drive", "lab_demo", "bump"]), t = pick(r, ["/scan", "/cmd_vel", "/odom"]);
  return { prompt: `Type the command that records the topic \`${t}\` into a bag folder named \`${n}\` (use \`-o\`).`, correct: `ros2 bag record -o ${n} ${t}`,
    accept: [`ros2 bag record -o ${n} ${t}`, `ros2 bag record ${t} -o ${n}`, `ros2 bag record --output ${n} ${t}`], explain: "ros2 bag record -o <name> <topics...>; replay later with ros2 bag play <name>." };
} });
T.push({ id: "R3-DEBUGTOOL", topic: "tools", type: "mcq", make(r) {
  const [sym, tool] = pick(r, [["You want to see how fast messages arrive on /scan.", "ros2 topic hz /scan"], ["You want a picture of all nodes and the topics between them.", "rqt_graph"],
    ["A bug happened once in the corridor and you want to replay it at your desk.", "ros2 bag play"], ["You want to see the fields of the message type geometry_msgs/msg/Twist.", "ros2 interface show"]]);
  return { prompt: sym, options: ["ros2 topic hz /scan", "rqt_graph", "ros2 bag play", "ros2 interface show"], correct: tool,
    explain: "hz measures rate, rqt_graph draws the graph, bags record and replay data, interface show prints message definitions." };
} });

module.exports = T;
