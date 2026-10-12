// Extra templates for the 2-week course: apt, Python from zero, C++, ROS 2 install/lab.
const { pick, pickN, int, ROBOT_NAMES, PYFILES } = require("./util");
const q3 = (s) => [s, `"${s}"`, `'${s}'`];
const T = [];

// ======================= apt (Day 2) =======================
T.push({ id: "A-APT-SEARCH", topic: "apt", type: "mcq", make(r) {
  const w = pick(r, ["turtlesim", "teleop", "navigation2", "moveit", "slam"]);
  return { prompt: `Which command lists the packages whose names or descriptions contain \`${w}\`?`,
    options: [`apt search ${w}`, `apt find ${w}`, `sudo apt install ${w}`, `ls ${w}`], correct: `apt search ${w}`,
    explain: "apt search looks through the list of available software. It does not install anything." };
} });
T.push({ id: "A-APT-UPDATE", topic: "apt", type: "mcq", make(r) {
  const before = pick(r, ["ros-jazzy-turtlesim", "ros-jazzy-navigation2", "ros-jazzy-moveit", "ros-jazzy-ros-gz"]);
  return { prompt: `Before installing \`${before}\` on a new computer, you run \`sudo apt update\`. What does it do?`,
    options: ["Refreshes the list of available software; it installs nothing", "Installs every available update", "Installs ROS 2", "Restarts the computer"],
    correct: "Refreshes the list of available software; it installs nothing",
    explain: "update refreshes the catalogue. install (or upgrade) actually changes the software on the computer." };
} });

// ======================= Python from zero: py1 (Day 3) =======================
T.push({ id: "P1-FSTRING", topic: "py1", type: "predict", make(r) {
  const n = pick(r, ROBOT_NAMES), b = int(r, 20, 99), word = pick(r, ["battery", "charge", "power"]);
  const out = `${n} has ${b}% ${word}`;
  return { prompt: "What does this program print?", code: `name = "${n}"\nlevel = ${b}\nprint(f"{name} has {level}% ${word}")`,
    correct: out, accept: q3(out), explain: "In an f-string, {name} and {level} are replaced by the values stored in those variables." };
} });
T.push({ id: "P1-TYPE", topic: "py1", type: "mcq", make(r) {
  const [v, t] = pick(r, [["3.75", "float"], ["42", "int"], ['"42"', "str"], ["True", "bool"], ["0.5", "float"], ['"Chitti"', "str"], ["-7", "int"]]);
  return { prompt: `What is the type of this value in Python: \`${v}\`?`, options: ["int", "float", "str", "bool"], correct: t,
    explain: "int = whole number, float = number with a decimal point, str = text in quotes, bool = True or False." };
} });
T.push({ id: "P1-CONVERT", topic: "py1", type: "predict", make(r) {
  const a = int(r, 2, 9), b = int(r, 1, 9);
  if (r() < 0.5) return { prompt: "What does this program print?", code: `x = "${a}"\ny = int(x) + ${b}\nprint(y)`, correct: String(a + b),
    explain: `int("${a}") turns the text "${a}" into the number ${a}, so y = ${a} + ${b}.` };
  return { prompt: "What does this program print? (Careful: look at the quotes.)", code: `x = "${a}"\nprint(x + "${b}")`, correct: `${a}${b}`, accept: q3(`${a}${b}`),
    explain: `Both values are text, so + joins them: "${a}" + "${b}" = "${a}${b}". input() also gives text, which is why we use int() or float().` };
} });

// ======================= py2 (Day 4) =======================
T.push({ id: "P2-FORCOUNT", topic: "py2", type: "predict", make(r) {
  const n = int(r, 2, 6), w = pick(r, ["beep", "blink", "step"]);
  return { prompt: `How many times does this program print \`${w}\`? (Type a number.)`, code: `for i in range(${n}):\n    print("${w}")`,
    correct: String(n), explain: `range(${n}) gives ${Array.from({ length: n }, (_, i) => i).join(", ")}: that is ${n} numbers, so the loop runs ${n} times.` };
} });
T.push({ id: "P2-WHILE", topic: "py2", type: "predict", make(r) {
  const n = int(r, 3, 5);
  const out = Array.from({ length: n }, (_, i) => n - i).join(" ");
  return { prompt: "What does this program print? (Type the numbers separated by spaces.)", code: `count = ${n}\nwhile count > 0:\n    print(count)\n    count = count - 1`,
    correct: out, explain: `It prints ${n}, then keeps subtracting 1 while count is above 0: ${out}.` };
} });
T.push({ id: "P2-ELIF", topic: "py2", type: "predict", make(r) {
  const d = pick(r, [0.2, 0.4, 0.7, 0.9, 1.5, 2.0]);
  const out = d < 0.5 ? "STOP" : d < 1.0 ? "SLOW" : "GO";
  return { prompt: "What does this program print?", code: `distance = ${d}\nif distance < 0.5:\n    print("STOP")\nelif distance < 1.0:\n    print("SLOW")\nelse:\n    print("GO")`,
    correct: out, accept: q3(out), explain: `Python checks the tests from top to bottom and runs only the first one that is True. For ${d}, that gives ${out}.` };
} });
T.push({ id: "P2-BREAK", topic: "py2", type: "predict", make(r) {
  const vals = pickN(r, [1.2, 0.9, 0.8, 1.5, 0.3, 0.4, 2.0, 0.2], 5);
  const hit = vals.find((v) => v < 0.5);
  const list = hit === undefined ? [...vals.slice(0, 4), 0.1] : vals;
  const first = list.find((v) => v < 0.5);
  return { prompt: "The robot reads distances one by one. What does this program print?", code: `readings = [${list.join(", ")}]\nfor d in readings:\n    if d < 0.5:\n        print(d)\n        break`,
    correct: String(first), explain: `The loop stops (break) at the first reading below 0.5, which is ${first}.` };
} });

// ======================= py3 (Day 5) =======================
T.push({ id: "P3-DICT", topic: "py3", type: "predict", make(r) {
  const vals = { front: pick(r, [0.8, 1.2, 2.5]), left: pick(r, [0.3, 0.6, 0.9]), right: pick(r, [1.1, 0.4, 0.7]) };
  const k = pick(r, ["front", "left", "right"]);
  return { prompt: "What does this program print?", code: `sensor = {"front": ${vals.front}, "left": ${vals.left}, "right": ${vals.right}}\nprint(sensor["${k}"])`,
    correct: String(vals[k]), explain: `A dictionary looks up a value by its name (key). sensor["${k}"] is ${vals[k]}.` };
} });
T.push({ id: "P3-LEN", topic: "py3", type: "predict", make(r) {
  const n = int(r, 2, 4), k = int(r, 1, 2);
  const start = pickN(r, ["A", "B", "C", "D", "E"], n).map((x) => `"${x}"`);
  const adds = Array.from({ length: k }, (_, i) => `waypoints.append("W${i + 1}")`).join("\n");
  return { prompt: "What does this program print?", code: `waypoints = [${start.join(", ")}]\n${adds}\nprint(len(waypoints))`,
    correct: String(n + k), explain: `The list starts with ${n} items and append adds ${k} more: ${n + k}. len() counts the items.` };
} });
T.push({ id: "P3-RETURN", topic: "py3", type: "predict", make(r) {
  const limit = pick(r, [0.5, 1.0]), d = pick(r, [0.2, 0.7, 1.4, 0.5, 1.0]);
  const out = d > limit ? "True" : "False";
  return { prompt: "What does this program print?", code: `def is_safe(distance):\n    return distance > ${limit}\n\nprint(is_safe(${d}))`,
    correct: out, explain: `is_safe returns the result of ${d} > ${limit}, which is ${out}.` };
} });

// ======================= C++ (Days 8-9) =======================
T.push({ id: "C-COUT", topic: "cpp", type: "predict", make(r) {
  const s = int(r, 2, 9), w = pick(r, ["Speed", "Battery", "Count"]);
  return { prompt: "What does this C++ program print?", code: `#include <iostream>\n\nint main() {\n  int value = ${s};\n  std::cout << "${w}: " << value << std::endl;\n  return 0;\n}`,
    correct: `${w}: ${s}`, accept: q3(`${w}: ${s}`), explain: "std::cout prints each piece joined by <<, and std::endl ends the line." };
} });
T.push({ id: "C-TYPE", topic: "cpp", type: "mcq", make(r) {
  const [what, t] = pick(r, [["the speed 0.75 metres per second", "double"], ["the number of wheels (4)", "int"], ["the robot's name", "std::string"], ["whether the battery is low", "bool"]]);
  return { prompt: `In C++, which type should store ${what}?`, options: ["int", "double", "std::string", "bool"], correct: t,
    explain: "int for whole numbers, double for decimals, std::string for text, bool for true/false. C++ needs the type written before the variable name." };
} });
T.push({ id: "C-SEMI", topic: "cpp", type: "mcq", make(r) {
  const line = int(r, 4, 7);
  return { prompt: `\`g++\` says: \`hello.cpp:${line}:42: error: expected ';' before 'return'\`. What is the most likely fix?`,
    options: [`Add a semicolon ; at the end of line ${line}`, "Run the program with python3", "Add sudo before g++", "Rename the file to hello.py"],
    correct: `Add a semicolon ; at the end of line ${line}`, explain: "Every C++ statement ends with a semicolon. The error points to the line where it was expected." };
} });
T.push({ id: "C-LOOP", topic: "cpp", type: "predict", make(r) {
  const n = int(r, 3, 6);
  return { prompt: "How many lines does this C++ program print? (Type a number.)", code: `for (int i = 0; i < ${n}; i++) {\n  std::cout << "Step " << i << std::endl;\n}`,
    correct: String(n), explain: `i takes the values 0 to ${n - 1}: that is ${n} times, just like Python's range(${n}).` };
} });
T.push({ id: "C-PRIVATE", topic: "cpp", type: "mcq", make(r) {
  const f = pick(r, ["battery_", "speed_", "name_"]);
  return { prompt: `\`${f}\` is declared under \`private:\` in class \`Robot\`. In \`main()\`, which line gives a compile error?`,
    code: `Robot r("Chitti");\nr.move(2);          // move() is public\nstd::cout << r.${f};`,
    options: [`std::cout << r.${f};`, `Robot r("Chitti");`, "r.move(2);", "None of them"], correct: `std::cout << r.${f};`,
    explain: "private members can only be used inside the class's own functions. Code outside the class must use public functions." };
} });
T.push({ id: "C-TWIN", topic: "cpp", type: "mcq", make(r) {
  const [cpp, py] = pick(r, [
    ['MinimalPublisher() : Node("minimal_publisher")', "super().__init__('minimal_publisher')"],
    ["class MinimalPublisher : public rclcpp::Node", "class MinimalPublisher(Node):"],
    ["rclcpp::spin(std::make_shared<MinimalPublisher>());", "rclpy.spin(node)"],
  ]);
  const all = ["super().__init__('minimal_publisher')", "class MinimalPublisher(Node):", "rclpy.spin(node)", "self.i += 1"];
  return { prompt: `Which Python line does the same job as this C++ (rclcpp) line?`, code: cpp, options: all, correct: py,
    explain: "rclpy and rclcpp nodes have the same structure: inherit from Node, call the parent constructor with the node name, then spin." };
} });
T.push({ id: "C-BUILD", topic: "cpp", type: "order", make(r) {
  const f = pick(r, ["hello", "robot", "drive", "count"]);
  return { prompt: "Put the steps in order to create and run a C++ program on Ubuntu.",
    items: [`nano ${f}.cpp`, `g++ ${f}.cpp -o ${f}`, `./${f}`],
    explain: "Write the source file, compile it into a program with g++, then run the program." };
} });

// ======================= ROS 2 install and lab (Day 10) =======================
T.push({ id: "L-GZ", topic: "lab", type: "mcq", make(r) {
  return { prompt: "Which package connects ROS 2 Jazzy with the Gazebo Harmonic simulator?",
    options: ["ros-jazzy-ros-gz", "ros-jazzy-gazebo-ros-pkgs", "gazebo11", "ros-jazzy-turtlesim"], correct: "ros-jazzy-ros-gz",
    explain: "Jazzy uses the new Gazebo (Harmonic) through ros_gz. The old Gazebo Classic packages are not available for Jazzy." };
} });
T.push({ id: "L-TB3", topic: "lab", type: "mcq", make(r) {
  const m = pick(r, ["burger", "waffle", "waffle_pi"]);
  return { prompt: "`ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py` fails with `KeyError: 'TURTLEBOT3_MODEL'`. What is the fix?",
    options: [`export TURTLEBOT3_MODEL=${m}`, "sudo apt update", "chmod +x turtlebot3_world.launch.py", "rosdep init"], correct: `export TURTLEBOT3_MODEL=${m}`,
    explain: "The TurtleBot3 launch files read the robot model from an environment variable. Add the export line to ~/.bashrc to make it permanent." };
} });
T.push({ id: "L-DOMAIN", topic: "lab", type: "mcq", make(r) {
  const n = int(r, 1, 50);
  return { prompt: "In the lab, your teleop keys also move your neighbour's simulated robot. What should each student do?",
    options: [`Use a different ROS_DOMAIN_ID, for example export ROS_DOMAIN_ID=${n}`, "Reinstall ROS 2", "Turn off the Wi-Fi", "Use sudo for every ros2 command"],
    correct: `Use a different ROS_DOMAIN_ID, for example export ROS_DOMAIN_ID=${n}`,
    explain: "Computers on the same network share ROS 2 topics unless they use different domain IDs." };
} });
T.push({ id: "L-COLCON", topic: "lab", type: "mcq", make(r) {
  const ws = pick(r, ["ros2_ws", "lab_ws", "robot_ws"]);
  return { prompt: `Your workspace is \`~/${ws}\` with your packages inside \`~/${ws}/src\`. Where do you run \`colcon build\`?`,
    options: [`In ~/${ws} (the workspace folder)`, `In ~/${ws}/src`, "In /opt/ros/jazzy", "In any folder; it does not matter"],
    correct: `In ~/${ws} (the workspace folder)`,
    explain: "colcon build runs in the workspace root. It creates build, install and log next to src." };
} });
T.push({ id: "L-ROSDEP", topic: "lab", type: "mcq", make(r) {
  return { prompt: "What does `rosdep install --from-paths src -y --ignore-src` do?",
    options: ["Installs the system packages that the packages in src need", "Deletes the src folder", "Builds the workspace", "Updates Ubuntu to a new version"],
    correct: "Installs the system packages that the packages in src need",
    explain: "rosdep reads each package's list of dependencies and installs the missing ones with apt." };
} });
T.push({ id: "L-INSTALL", topic: "lab", type: "order", make(r) {
  const extra = pick(r, ["ros-jazzy-desktop", "ros-jazzy-desktop"]);
  return { prompt: "Put the main ROS 2 Jazzy installation steps in the correct order.",
    items: ["Set up a UTF-8 locale", "Enable the Ubuntu universe repository", "Install the ros2-apt-source package", `sudo apt update, then sudo apt install ${extra}`, "source /opt/ros/jazzy/setup.bash"],
    explain: "Prepare Ubuntu (locale, universe), add the ROS 2 package source, install, then load ROS 2 into the terminal." };
} });

module.exports = T;
