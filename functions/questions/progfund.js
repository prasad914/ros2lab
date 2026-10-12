// Week 5 "ROS Programming Fundamentals": packages and nodes, custom interfaces,
// services, actions, parameters and launch files (Python and C++).
const { pick, pickN, int } = require("./util");
const T = [];
const mcq = (id, topic, make) => T.push({ id, topic, type: "mcq", make });
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const PKGS = ["chiku_py", "chiku_cpp", "robot_brain", "lab_nodes", "delivery_bot"];
const NODES = ["speed_driver", "circle_driver", "pose_monitor", "status_publisher", "switchable_driver", "battery_monitor"];
const nums = (x, d) => { const s = x.toFixed(d), t = String(Number(s)); return [...new Set([s, t, t.includes(".") ? t : t + ".0"])]; };

// ---------------- packages and nodes ----------------
mcq("F-CREATE", "pkg", (r) => {
  const py = r() < 0.5, name = pick(r, PKGS), dep = py ? "rclpy" : "rclcpp";
  const good = `ros2 pkg create --build-type ${py ? "ament_python" : "ament_cmake"} ${name} --dependencies ${dep}`;
  return { prompt: `Which command creates a ${py ? "Python" : "C++"} package called ${name} that depends on ${dep}?`,
    options: [good, `ros2 pkg create --build-type ${py ? "ament_cmake" : "ament_python"} ${name} --dependencies ${dep}`, `ros2 pkg new ${name} --lang ${py ? "python" : "cpp"}`, `colcon create ${name}`],
    correct: good, explain: "Python packages use ament_python; C++ packages use ament_cmake." };
});
mcq("F-ENTRY", "pkg", (r) => {
  const pkg = pick(r, PKGS), file = pick(r, ["talker", "battery_node", "speed_node", "countdown_server"]), exe = pick(r, [file, file.replace("_node", ""), "start_" + file]);
  const good = `'${exe} = ${pkg}.${file}:main',`;
  return { prompt: `In ${pkg}/setup.py, which entry_points line lets you run \`ros2 run ${pkg} ${exe}\`, using the main() in ${pkg}/${file}.py?`,
    options: [good, `'${exe} = ${file}.py:main',`, `'${pkg}.${file} = ${exe}',`, `'${exe} = main:${file}',`], correct: good,
    explain: "Format: 'executable_name = package_name.file_name:function'. The left side is what you type after ros2 run." };
});
mcq("F-SELECT", "pkg", (r) => {
  const pkg = pick(r, PKGS);
  return { prompt: `You changed only the package ${pkg}. Which command builds just that package?`, options: [`colcon build --packages-select ${pkg}`, `colcon build ${pkg}`, `ros2 build ${pkg}`, `make ${pkg}`],
    correct: `colcon build --packages-select ${pkg}`, explain: "Run it from the workspace folder, then source install/setup.bash again." };
});
mcq("F-LINK", "pkg", (r) => {
  const exe = pick(r, ["talker", "listener", "battery_pub", "add_server"]), msgp = pick(r, ["std_msgs", "example_interfaces", "my_robot_interfaces"]);
  const good = `target_link_libraries(${exe} rclcpp::rclcpp \${${msgp}_TARGETS})`;
  return { prompt: `In CMakeLists.txt for ROS 2 Jazzy, which line links the executable ${exe} to rclcpp and ${msgp} in the recommended modern style?`,
    options: [good, `link(${exe} rclcpp ${msgp})`, `include_directories(${exe} ${msgp})`, `add_executable(${exe} ${msgp})`], correct: good,
    explain: "target_link_libraries with rclcpp::rclcpp and ${pkg}_TARGETS. You may also see ament_target_dependencies(...), which works in Jazzy but is deprecated from Kilted." };
});
mcq("F-SPIN", "pkg", (r) => ({ prompt: "A node has a timer, but its timer callback never runs. What is the most likely mistake in main()?",
  options: ["rclpy.spin(node) is missing", "rclpy.init() is called", "The class inherits from Node", "The node has a name"], correct: "rclpy.spin(node) is missing",
  explain: "spin() keeps the node alive and runs its callbacks. Without it, main() ends immediately." }));
T.push({ id: "F-MAINORDER", topic: "pkg", type: "order", make(r) {
  const cls = pick(r, ["Talker", "BatteryNode", "SpeedNode"]);
  return { prompt: "Put the lines of a Python ROS 2 main() in the correct order.", items: ["rclpy.init(args=args)", `node = ${cls}()`, "rclpy.spin(node)", "node.destroy_node()", "rclpy.shutdown()"],
    explain: "Start ROS 2, create the node, spin it, then clean up." };
} });

// ---------------- custom interfaces ----------------
mcq("F-HEADER", "iface", (r) => {
  const t = pick(r, ["BatteryStatus", "RobotPose", "SetSpeed", "LedColor", "ArmCommand"]), k = t === "SetSpeed" ? "srv" : "msg", pkg = "my_robot_interfaces";
  const good = `#include "${pkg}/${k}/${snake(t)}.hpp"`;
  return { prompt: `Which C++ include gives you the interface ${pkg}/${k}/${t}?`, options: [good, `#include "${pkg}/${k}/${t}.hpp"`, `#include "${pkg}/${t}.${k}"`, `#include <${t}>`], correct: good,
    explain: "The header name is the CamelCase type name converted to snake_case." };
});
mcq("F-FIELD", "iface", (r) => {
  const good = pick(r, ["battery_level", "max_speed", "is_charging", "robot_name", "left_wheel"]);
  const bad = pickN(r, ["batteryLevel", "Max_Speed", "is__charging", "robot_name_", "2nd_wheel", "LeftWheel"], 3);
  return { prompt: "Which of these is a VALID field name in a .msg file?", options: [good, ...bad], correct: good,
    explain: "Field names: lowercase letters, numbers and single underscores; start with a letter; no double underscore; don't end with an underscore." };
});
mcq("F-SEP", "iface", (r) => {
  const [k, n] = pick(r, [["msg", "0"], ["srv", "1"], ["action", "2"]]);
  return { prompt: `How many lines containing only --- does a .${k} file need?`, options: ["0", "1", "2", "3"], correct: n,
    explain: ".msg: none. .srv: one (request --- response). .action: two (goal --- result --- feedback)." };
});
mcq("F-GROUP", "iface", (r) => ({ prompt: "Which line must an interfaces package have in its package.xml?", options: ["<member_of_group>rosidl_interface_packages</member_of_group>",
  "<depend>turtlesim</depend>", "<build_type>ament_python</build_type>", "<license>MIT</license>"], correct: "<member_of_group>rosidl_interface_packages</member_of_group>",
  explain: "Together with the rosidl_default_generators build tool and rosidl_default_runtime, it marks the package as an interfaces package." }));
mcq("F-IFTYPE", "iface", (r) => ({ prompt: "Which kind of package must hold your .msg/.srv/.action files, even if your nodes are in Python?",
  options: ["An ament_cmake package (code generation runs through CMake)", "An ament_python package", "Any folder outside the workspace", "The /opt/ros/jazzy folder"],
  correct: "An ament_cmake package (code generation runs through CMake)", explain: "Best practice: a separate my_robot_interfaces package built with ament_cmake." }));
mcq("F-SECTION", "iface", (r) => {
  const [part, ans] = pick(r, [["the goal", "the first section"], ["the result", "the middle section"], ["the feedback", "the last section"]]);
  return { prompt: `In a .action file, where does ${part} go?`, options: ["the first section", "the middle section", "the last section", "a separate file"], correct: ans,
    explain: "Order in a .action file: goal --- result --- feedback." };
});
mcq("F-PYIMPORT", "iface", (r) => {
  const [t, k] = pick(r, [["BatteryStatus", "msg"], ["SetSpeed", "srv"], ["Countdown", "action"]]);
  const good = `from my_robot_interfaces.${k} import ${t}`;
  return { prompt: `How do you import my_robot_interfaces/${k}/${t} in Python?`, options: [good, `import my_robot_interfaces/${k}/${t}`, `from my_robot_interfaces import ${t}`, `from ${k}.${t} import my_robot_interfaces`],
    correct: good, explain: "from <package>.<msg|srv|action> import <TypeName>" };
});

// ---------------- services and actions ----------------
mcq("F-ASYNC", "srvact", (r) => ({ prompt: "Inside a timer callback, a node calls client.call(request) and the node freezes forever. Why?",
  options: ["The executor is busy running this callback, so it can never process the response (deadlock)", "The server is too slow", "Services cannot be used in Python", "The request was too big"],
  correct: "The executor is busy running this callback, so it can never process the response (deadlock)", explain: "Use call_async() with a done-callback instead of call() inside callbacks." }));
mcq("F-RETURN", "srvact", (r) => ({ prompt: "A Python service callback computes response.sum but the client never gets an answer. What is missing at the end of the callback?",
  options: ["return response", "rclpy.spin(self)", "print(response)", "self.destroy_node()"], correct: "return response", explain: "A Python service callback must return the response object." }));
T.push({ id: "F-CALL", topic: "srvact", type: "predict", make(r) {
  const a = int(r, 2, 40), b = int(r, 2, 40);
  return { prompt: `The add_two_ints server is running. What number appears after sum= when you run:\nros2 service call /add_two_ints example_interfaces/srv/AddTwoInts "{a: ${a}, b: ${b}}"`,
    correct: String(a + b), explain: `The response is example_interfaces.srv.AddTwoInts_Response(sum=${a + b}).` };
} });
mcq("F-SUCCEED", "srvact", (r) => ({ prompt: "A Python action server's execute callback returns a result but never calls goal_handle.succeed(). What status does the goal finish with?",
  options: ["ABORTED (with a warning)", "SUCCEEDED", "CANCELED", "It runs forever"], correct: "ABORTED (with a warning)", explain: "Set the final state (succeed(), abort() or canceled()) before returning the result." }));
mcq("F-SRVORACT", "srvact", (r) => {
  const [s, a] = pick(r, [["reset the odometry to zero (instant)", "Service"], ["rotate the turtle to 90° and report the remaining angle", "Action"],
    ["get the current map once", "Service"], ["arm moves to pick up a box (10 s), cancel if a person comes near", "Action"]]);
  return { prompt: `Service or action: ${s}?`, options: ["Service", "Action", "Topic", "Parameter"], correct: a, explain: "Quick question with one answer: service. Long job with progress or cancelling: action." };
});

// ---------------- parameters and launch files ----------------
mcq("F-YAMLKEY", "paramlaunch", (r) => ({ prompt: "In a ROS 2 parameter YAML file, which key must come right under the node name?",
  options: ["ros__parameters:", "ros_parameters:", "parameters:", "params:"], correct: "ros__parameters:", explain: "Two underscores: ros__parameters. With any other spelling, the values are not used." }));
mcq("F-PTYPE", "paramlaunch", (r) => {
  const v = int(r, 2, 9);
  return { prompt: `max_speed was declared with the default 0.5. What happens with: ros2 param set /chiku_speed max_speed ${v}`,
    options: [`It fails: ${v} is an integer but max_speed is a double (type ${v}.0)`, "It works", "The node crashes", "max_speed becomes 0"], correct: `It fails: ${v} is an integer but max_speed is a double (type ${v}.0)`,
    explain: "A parameter keeps the type it was declared with. 0.5 is a double, so write the new value with a decimal point." };
});
mcq("F-PARAMSFILE", "paramlaunch", (r) => {
  const f = pick(r, ["chiku_params.yaml", "robot.yaml", "lab_params.yaml"]);
  return { prompt: `Which command starts a node with the parameters from ${f}?`,
    options: [`ros2 run chiku_py speed_node --ros-args --params-file ${f}`, `ros2 run chiku_py speed_node ${f}`, `ros2 param load ${f}`, `ros2 run chiku_py speed_node --yaml ${f}`],
    correct: `ros2 run chiku_py speed_node --ros-args --params-file ${f}`, explain: "--ros-args starts the ROS arguments; --params-file loads a YAML file at startup." };
});
mcq("F-INSTALL", "paramlaunch", (r) => {
  const cpp = r() < 0.5;
  const good = cpp ? "install(DIRECTORY launch DESTINATION share/${PROJECT_NAME})" : "(os.path.join('share', package_name, 'launch'), glob('launch/*')),";
  return { prompt: `ros2 launch says the launch file "was not found in the share directory". Which line is missing from the ${cpp ? "CMakeLists.txt" : "setup.py data_files"}?`,
    options: [good, "rclpy.spin(node)", "find_package(ament_cmake REQUIRED)", "<depend>rclpy</depend>"], correct: good, explain: "Launch files must be INSTALLED into share/<package>; then build and source again." };
});


// ---------------- timers, publishers and subscribers (Python and C++) ----------------
mcq("F-SUBORDER", "pubsub", (r) => {
  const py = r() < 0.5, t = pick(r, ["Pose", "Twist", "BatteryStatus"]), topic = pick(r, ["/turtle1/pose", "/turtle1/cmd_vel", "chiku/battery"]);
  const good = py ? `self.create_subscription(${t}, '${topic}', self.on_msg, 10)` : `create_subscription<${t}>("${topic}", 10, std::bind(&Node::on_msg, this, std::placeholders::_1))`;
  const bad = py ? [`self.create_subscription('${topic}', ${t}, 10, self.on_msg)`, `self.create_subscription(${t}, '${topic}', self.on_msg(), 10)`, `self.subscribe(${t}, '${topic}')`]
    : [`create_subscription<${t}>(10, "${topic}", std::bind(&Node::on_msg, this))`, `create_subscription("${topic}", ${t}, 10)`, `create_subscription<${t}>("${topic}", std::bind(&Node::on_msg, this, std::placeholders::_1))`];
  return { prompt: `Which ${py ? "Python" : "C++"} line subscribes to ${topic} correctly?`, options: [good, ...bad], correct: good,
    explain: py ? "Python: type, topic, callback (no brackets), queue size." : "C++: the type in < >, then topic, queue size, and a callback with a placeholder for the message." };
});
mcq("F-ARROW", "pubsub", (r) => {
  const [code, good] = pick(r, [["pub_->publish(msg);", "pub_ is a shared pointer, so its methods are called with ->"], ["msg.linear.x = 1.0;", "msg is a normal object, so its fields use a dot"],
    ["timer_->cancel();", "timer_ is a shared pointer, so its methods are called with ->"], ["request->data", "request is a shared pointer, so its fields are read with ->"]]);
  const all = ["pub_ is a shared pointer, so its methods are called with ->", "msg is a normal object, so its fields use a dot", "timer_ is a shared pointer, so its methods are called with ->", "request is a shared pointer, so its fields are read with ->"];
  return { prompt: `Why is this C++ line written this way? ${code}`, options: [good, ...pickN(r, all.filter((x) => x !== good), 2), "C++ always uses -> for everything"], correct: good,
    explain: "Pointer (SharedPtr): ->. Normal object: a dot. Namespace: ::" };
});
mcq("F-PUBTOPIC", "pubsub", (r) => {
  const wrong = pick(r, ["cmd_vel", "/turtle/cmd_vel", "/turtle1/cmd_vell", "turtle1_cmd_vel"]);
  const good = "Nothing moves, with no error: turtlesim listens on /turtle1/cmd_vel, a different topic";
  return { prompt: `A driver node publishes its Twist on "${wrong}". turtlesim is running. What happens?`, options: [good, "The turtle moves anyway", "ROS 2 prints an error and stops the node", "turtlesim crashes"], correct: good,
    explain: "Topic names must match exactly. Check with ros2 topic info /turtle1/cmd_vel: the publisher count shows who really talks there." };
});
mcq("F-LOCALTIMER", "pubsub", (r) => ({ prompt: "A C++ node creates its timer as `auto timer = create_wall_timer(100ms, ...);` inside the constructor. The callback never runs. Why?",
  options: ["timer is a local variable: it is destroyed when the constructor ends", "100ms is too fast", "auto is not allowed in ROS 2", "create_wall_timer only works in main()"], correct: "timer is a local variable: it is destroyed when the constructor ends",
  explain: "Keep timers, publishers, subscriptions and services in member variables (timer_, pub_, ...)." }));

// ---------------- actions: DriveDistance ----------------
T.push({ id: "F-DRIVEFB", topic: "srvact", type: "predict", make(r) {
  const [d, s] = pick(r, [[1.0, 0.5], [2.0, 0.5], [1.0, 1.0], [2.0, 1.0], [1.5, 0.5]]), n = Math.round(d / (s * 0.1));
  return { prompt: `The drive_distance_server drives in steps of 0.1 s and publishes one feedback message after each step. How many feedback messages does the goal {distance: ${d}, speed: ${s}} produce? (Type a number.)`,
    correct: String(n), explain: `Each step drives ${s} x 0.1 = ${+(s * 0.1).toFixed(2)} m, so ${d} m takes ${d} / ${+(s * 0.1).toFixed(2)} = ${n} steps, one feedback each.` };
} });
mcq("F-SENDGOAL", "srvact", (r) => {
  const d = pick(r, ["1.0", "2.0", "3.0"]), s = pick(r, ["0.5", "1.0"]);
  const good = `ros2 action send_goal --feedback /chiku/drive_distance my_robot_interfaces/action/DriveDistance "{distance: ${d}, speed: ${s}}"`;
  return { prompt: `Which command sends the goal distance ${d} m at ${s} m/s AND shows the feedback?`,
    options: [good, `ros2 service call /chiku/drive_distance my_robot_interfaces/action/DriveDistance "{distance: ${d}, speed: ${s}}"`, `ros2 topic pub /chiku/drive_distance my_robot_interfaces/action/DriveDistance "{distance: ${d}, speed: ${s}}"`, `ros2 action send_goal /chiku/drive_distance "{distance: ${d}}" --show`],
    correct: good, explain: "ros2 action send_goal NAME TYPE GOAL, with --feedback before the name to print the feedback." };
});
mcq("F-THREAD", "srvact", (r) => ({ prompt: "In a C++ action server, why does handle_accepted start execute() in a new std::thread?",
  options: ["So handle_accepted returns at once and the node can still receive cancel requests and run other callbacks", "Because threads make the robot drive faster", "Because rclcpp forbids functions longer than 10 lines", "To save memory"],
  correct: "So handle_accepted returns at once and the node can still receive cancel requests and run other callbacks", explain: "A callback that runs for seconds blocks the executor. The Python server uses a MultiThreadedExecutor for the same reason." }));

// ---------------- parameters and launch (Week 5 level) ----------------
mcq("F-CPPGET", "paramlaunch", (r) => {
  const [decl, getter] = pick(r, [["declare_parameter(\"speed\", 1.0)", ".as_double()"], ["declare_parameter(\"robot_name\", \"chiku\")", ".as_string()"], ["declare_parameter(\"enabled\", true)", ".as_bool()"], ["declare_parameter(\"laps\", 3)", ".as_int()"]]);
  return { prompt: `A C++ node does ${decl}. Which getter reads it without an exception?`, options: [getter, ...[".as_double()", ".as_string()", ".as_bool()", ".as_int()"].filter((x) => x !== getter)], correct: getter,
    explain: "The default value fixes the type; the getter must match it, or rclcpp throws ParameterTypeException." };
});
mcq("F-LIVE", "paramlaunch", (r) => ({ prompt: "ros2 param set /speed_driver speed 2.0 says \"Set parameter successful\", but the robot keeps its old speed. What is the most likely reason?",
  options: ["The node read the parameter only once in its constructor and keeps using that old copy", "The parameter has the wrong name", "Parameters can only be set from YAML", "The node must be rebuilt"], correct: "The node read the parameter only once in its constructor and keeps using that old copy",
  explain: "Read the parameter where you use it (for example in the timer callback), or react to changes in a parameter callback (Week 6)." }));
mcq("F-LAUNCHEXE", "paramlaunch", (r) => {
  const exe = pick(r, ["speed_driver", "pose_monitor", "battery_monitor"]);
  const good = `Node(package='chiku_control', executable='${exe}')`;
  return { prompt: `setup.py has the entry point '${exe} = chiku_control.${exe}:main'. Which launch action starts it?`, options: [good, `Node(package='chiku_control', executable='${exe}.py')`, `Node(package='${exe}', executable='chiku_control')`, `Node(name='${exe}')`], correct: good,
    explain: "executable= is the program name from the entry point (C++: from add_executable), without .py." };
});
mcq("F-XMLPARAM", "paramlaunch", (r) => {
  const [k, v] = pick(r, [["speed", "2.0"], ["turn", "1.0"], ["drain_per_metre", "4.0"]]);
  const good = `<param name="${k}" value="${v}"/>`;
  return { prompt: `Inside an XML <node> tag, which line sets the parameter ${k} to ${v}?`, options: [good, `<param ${k}="${v}"/>`, `<arg name="${k}" default="${v}"/>`, `${k}: ${v}`], correct: good,
    explain: "<param name=... value=.../> sets a node parameter. <arg> declares a launch argument (Week 6)." };
});

// ---------------- moved here from the Week 6 file (Week 5 now teaches these) ----------------
mcq("N-RATE", "pubsub", (r) => {
  const [period, hz] = pick(r, [["0.1", "10"], ["0.5", "2"], ["0.02", "50"], ["0.05", "20"], ["0.25", "4"]]);
  return { prompt: `A Python timer is created with self.create_timer(${period}, self.on_timer). How many times per second does on_timer run?`,
    options: [hz, period, String(Number(hz) * 2), String(Math.max(1, Number(hz) / 2))].filter((v, i, a) => a.indexOf(v) === i).concat(["1000", "60"]).slice(0, 4), correct: hz,
    explain: `rate = 1 / period = 1 / ${period} = ${hz} Hz.` };
});
mcq("N-CPPTIMER", "pubsub", (r) => {
  const [hz, ms] = pick(r, [["10", "100ms"], ["2", "500ms"], ["20", "50ms"], ["1", "1s"], ["50", "20ms"]]);
  const good = `create_wall_timer(${ms}, std::bind(&Node::cb, this))`;
  const others = ["100ms", "500ms", "50ms", "1s", "20ms", "10ms"].filter((x) => x !== ms);
  return { prompt: `Which C++ line creates a timer that fires ${hz} time(s) per second? (with using namespace std::chrono_literals)`,
    options: [good, ...pickN(r, others, 3).map((x) => `create_wall_timer(${x}, std::bind(&Node::cb, this))`)], correct: good, explain: `${hz} Hz means a period of ${ms}.` };
});
T.push({ id: "N-TWISTRADIUS", topic: "pubsub", type: "fill", make(r) {
  const [v, w] = pick(r, [[1.0, 0.5], [1.5, 0.5], [2.0, 0.8], [0.6, 0.4], [1.0, 0.25]]), rad = Number((v / w).toFixed(3));
  return { prompt: `A timer publishes linear.x = ${v} and angular.z = ${w}. What is the radius of the circle the turtle drives? (metres)`,
    correct: String(rad), accept: nums(rad, 1).concat(nums(rad, 2)), explain: `radius = v / w = ${v} / ${w} = ${rad} m.` };
} });
mcq("N-NOEXE", "pkg", (r) => {
  const lang = pick(r, ["C++", "Python"]), exe = pick(r, NODES);
  const good = lang === "C++" ? `install(TARGETS ${exe} DESTINATION lib/\${PROJECT_NAME}) is missing in CMakeLists.txt` : `the entry point '${exe} = pkg.${exe}:main' is missing in setup.py`;
  return { prompt: `The ${lang} package builds, but ros2 run says "No executable found" for ${exe}. What is the most likely cause?`,
    options: [good, "the node forgot to call spin()", "ROS 2 is not installed", "the node name is too long"], correct: good,
    explain: "ros2 run only finds programs that were INSTALLED into install/<pkg>/lib/<pkg>." };
});
mcq("N-DEPEND", "pkg", (r) => {
  const dep = pick(r, ["turtlesim", "geometry_msgs", "sensor_msgs", "nav_msgs", "my_robot_interfaces"]);
  const good = `package.xml (<depend>${dep}</depend>) and CMakeLists.txt (find_package + target_link_libraries)`;
  return { prompt: `A C++ node now #includes a header from ${dep}. Which files must change?`, options: [good, "only CMakeLists.txt", "only package.xml", "setup.py and package.xml"], correct: good,
    explain: "package.xml declares the dependency; CMakeLists.txt finds it and links it." };
});
mcq("N-SRVFILE", "iface", (r) => {
  const good = "float64 x\nfloat64 y\n---\nbool success\nstring message";
  return { prompt: "Which is a valid GoTo.srv (request x, y; response success, message)?", options: [good, "float64 x\nfloat64 y\n--\nbool success\nstring message", "float64 X\nfloat64 Y\n---\nbool Success", "float64 x, y\n---\nbool success"], correct: good,
    explain: "Request, a line with exactly three dashes, then the response. Field names are lower_case." };
});
mcq("N-SRVCPP", "srvact", (r) => ({ prompt: "What is the return type of a C++ service callback in rclcpp?", options: ["void", "bool", "the Response type", "int"], correct: "void",
  explain: "void cb(const std::shared_ptr<T::Request> req, std::shared_ptr<T::Response> res): fill res in place." }));
mcq("N-ACTIONEND", "srvact", (r) => {
  const [code, name] = pick(r, [["4", "SUCCEEDED"], ["5", "CANCELED"], ["6", "ABORTED"]]);
  return { prompt: `An action result arrives with status ${code}. What does it mean?`, options: [name, ...["SUCCEEDED", "CANCELED", "ABORTED", "ACCEPTED"].filter((x) => x !== name).slice(0, 3)], correct: name,
    explain: "action_msgs/GoalStatus: 4 SUCCEEDED, 5 CANCELED, 6 ABORTED." };
});

module.exports = T;
