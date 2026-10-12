// Week 3 "Introduction to ROS": platforms, objectives, components, ecosystem, history,
// versions, ROS 1 vs ROS 2, middleware, DDS, domains and QoS.
const { pick, pickN, int } = require("./util");
const T = [];
const mcq = (id, topic, make) => T.push({ id, topic, type: "mcq", make });

// ---------------- platform: why a framework, objectives, components, ecosystem ----------------
mcq("I-NEED", "platform", (r) => {
  const part = pick(r, ["LiDAR", "camera", "IMU", "motor driver"]), user = pick(r, ["path planner", "map builder", "obstacle detector"]);
  return { prompt: `Chiku gets a new brand of ${part}. Thanks to ROS, the ${user} code does not change at all. Which benefit of a robot software framework is this?`,
    options: ["Hardware abstraction (standard messages)", "Faster CPU", "Real-time guarantees", "Cheaper hardware"], correct: "Hardware abstraction (standard messages)",
    explain: "The new driver still publishes the same standard message type, so the programs that use the data don't change." };
});
mcq("I-MECH", "platform", (r) => {
  const [s, a] = pick(r, [["stream laser scans 10 times per second", "Topic"], ["ask once for the battery level and get one answer", "Service"],
    ["drive to the kitchen, report progress, and allow cancelling", "Action"], ["store the robot's maximum speed so it can be changed", "Parameter"],
    ["stream camera images to two viewers", "Topic"], ["spawn a new turtle in turtlesim", "Service"], ["dock to the charger, which takes 40 seconds", "Action"]]);
  return { prompt: `Which ROS communication method fits best: ${s}?`, options: ["Topic", "Service", "Action", "Parameter"], correct: a,
    explain: "Topics stream data, services answer one quick question, actions run long jobs with feedback and cancel, parameters store settings." };
});
mcq("I-TOOL", "platform", (r) => {
  const [job, tool] = pick(r, [["record topic data and play it back later", "ros2 bag"], ["see the robot, laser scans and maps in 3-D", "rviz2"],
    ["install the system packages a ROS package depends on", "rosdep"], ["build all packages in a workspace", "colcon"], ["start many nodes with one command", "ros2 launch"]]);
  const all = ["ros2 bag", "rviz2", "rosdep", "colcon", "ros2 launch"], drop = pick(r, all.filter((x) => x !== tool));
  return { prompt: `Which tool would you use to ${job}?`, options: all.filter((x) => x !== drop),
    correct: tool, explain: "ros2 bag records/replays, rviz2 visualises, rosdep installs dependencies, colcon builds, ros2 launch starts many nodes." };
});
mcq("I-GOAL", "platform", (r) => {
  const [goal, desc] = pick(r, [["Thin", "algorithms live in normal libraries with small ROS wrappers"], ["Peer-to-peer", "programs talk directly to each other"],
    ["Multi-lingual", "nodes can be written in C++, Python and other languages"], ["Tools-based", "many small tools instead of one giant program"]]);
  return { prompt: `Which original ROS design goal means: "${desc}"?`, options: ["Thin", "Peer-to-peer", "Multi-lingual", "Tools-based"], correct: goal,
    explain: "The first ROS paper (2009) listed: peer-to-peer, tools-based, multi-lingual, thin, and free and open source." };
});
mcq("I-ROS2GOAL", "platform", (r) => {
  const [sc, g] = pick(r, [["a fleet of 20 delivery robots in one hospital", "Multiple robots"], ["a robot arm controller that must react every millisecond", "Real-time systems"],
    ["a rover talking to Earth over a slow, lossy link", "Non-ideal networks"], ["sensors running on small microcontrollers", "Small embedded platforms"]]);
  return { prompt: `ROS 2 was redesigned for new kinds of robots. "${sc}" matches which ROS 2 design goal?`, options: ["Multiple robots", "Real-time systems", "Non-ideal networks", "Small embedded platforms"],
    correct: g, explain: "ROS 2's goals: multiple robots, small embedded platforms, real-time systems, non-ideal networks, production use." };
});
mcq("I-ECO", "platform", (r) => {
  const [what, ans] = pick(r, [["the simulator recommended with ROS 2 Jazzy", "Gazebo Harmonic"], ["the navigation stack for mobile robots", "Nav2"],
    ["motion planning for robot arms", "MoveIt 2"], ["ROS 2 on microcontrollers", "micro-ROS"]]);
  return { prompt: `Which ecosystem project is ${what}?`, options: ["Gazebo Harmonic", "Nav2", "MoveIt 2", "micro-ROS"], correct: ans,
    explain: "Gazebo simulates, Nav2 navigates, MoveIt 2 plans arm motion, micro-ROS runs on microcontrollers." };
});
mcq("I-NOTOS", "platform", (r) => ({ prompt: "Which sentence about ROS is TRUE?",
  options: ["ROS is middleware plus tools and libraries that runs on an operating system like Ubuntu", "ROS is an operating system that replaces Ubuntu", "ROS is a programming language", "ROS only works with one robot brand"],
  correct: "ROS is middleware plus tools and libraries that runs on an operating system like Ubuntu", explain: "Despite its name, ROS runs ON an operating system; it is a framework, not an OS." }));

// ---------------- history and versions ----------------
const ROS2 = [["Ardent Apalone", 2017], ["Bouncy Bolson", 2018], ["Crystal Clemmys", 2018], ["Dashing Diademata", 2019], ["Eloquent Elusor", 2019],
  ["Foxy Fitzroy", 2020], ["Galactic Geochelone", 2021], ["Humble Hawksbill", 2022], ["Iron Irwini", 2023], ["Jazzy Jalisco", 2024], ["Kilted Kaiju", 2025], ["Lyrical Luth", 2026]];
mcq("I-LTS", "history", (r) => {
  const y = int(r, 2022, 2032);
  const lts = y % 2 === 0;
  const correct = lts ? `LTS, supported until about May ${y + 5}` : "Not LTS, supported for about 1.5 years";
  return { prompt: `Since 2022, ROS 2 releases come out every May. A release from May ${y}: is it a long-term support (LTS) release?`,
    options: [`LTS, supported until about May ${y + 5}`, "Not LTS, supported for about 1.5 years", `LTS, supported until about May ${y + 2}`, "Every release is supported for 10 years"],
    correct, explain: "Even-year releases are LTS with 5 years of support; odd-year releases get about 1.5 years." };
});
mcq("I-UBU", "history", (r) => {
  const [d, u] = pick(r, [["Jazzy", "Ubuntu 24.04"], ["Humble", "Ubuntu 22.04"], ["Lyrical", "Ubuntu 26.04"], ["Kilted", "Ubuntu 24.04"], ["Foxy", "Ubuntu 20.04"]]);
  return { prompt: `ROS 2 ${d} is made for which Ubuntu version?`, options: ["Ubuntu 20.04", "Ubuntu 22.04", "Ubuntu 24.04", "Ubuntu 26.04"], correct: u,
    explain: "Each ROS 2 release targets one Ubuntu LTS. An odd-year release shares the Ubuntu of the LTS before it (Jazzy and Kilted both use 24.04)." };
});
mcq("I-NEXT", "history", (r) => {
  const i = int(r, 0, ROS2.length - 2);
  const ans = ROS2[i + 1][0];
  const opts = [ans, ...pickN(r, ROS2.filter((x) => x[0] !== ans && x[0] !== ROS2[i][0]).map((x) => x[0]), 3)];
  return { prompt: `ROS 2 versions are named in alphabetical order. Which release came right after ${ROS2[i][0]}?`, options: opts, correct: ans,
    explain: "Names go A, B, C, ... (Ardent, Bouncy, Crystal, ... Jazzy, Kilted, Lyrical), each an adjective plus a turtle." };
});
T.push({ id: "I-ORDER", topic: "history", type: "order", make(r) {
  const ev = [["Willow Garage starts working on ROS", 2007], ["First distribution, Box Turtle", 2010], ["OSRF is founded", 2012], ["First ROS 2 release, Ardent", 2017],
    ["The Open Source Robotics Alliance (OSRA) starts", 2024], ["ROS 1 reaches end of life", 2025]];
  const pickd = pickN(r, ev, 4).sort((a, b) => a[1] - b[1]);
  return { prompt: "Put these events from the history of ROS in order, oldest first.", items: pickd.map((e) => e[0]), explain: pickd.map((e) => `${e[1]}: ${e[0]}`).join("; ") + "." };
} });
mcq("I-EOL", "history", (r) => ({ prompt: "Why should a new robot project in 2026 use ROS 2 rather than ROS 1?",
  options: ["ROS 1 (Noetic) reached end of life in May 2025", "ROS 1 never had topics", "ROS 2 does not need Linux", "ROS 1 is only for drones"],
  correct: "ROS 1 (Noetic) reached end of life in May 2025", explain: "Noetic, the last ROS 1, stopped receiving updates on 31 May 2025." }));
mcq("I-WHO", "history", (r) => {
  const [q, a] = pick(r, [["created ROS and the PR2 robot (from 2007)", "Willow Garage"], ["is the non-profit that has looked after ROS since 2012", "OSRF (Open Robotics)"],
    ["was launched in 2024 to govern ROS with industry members", "OSRA"]]);
  return { prompt: `Which organisation ${q}?`, options: ["Willow Garage", "OSRF (Open Robotics)", "OSRA", "NASA"], correct: a,
    explain: "Willow Garage started ROS; OSRF (Open Robotics) stewards it; OSRA, launched by OSRF in 2024, governs it with members." };
});

// ---------------- ROS 1 vs ROS 2, middleware ----------------
mcq("I-R1R2", "r1r2", (r) => {
  const [f, a] = pick(r, [["How do nodes find each other in ROS 2?", "Automatic discovery through DDS (no master)"], ["Which tool builds ROS 2 workspaces?", "colcon"],
    ["Which Python version does ROS 2 use?", "Python 3 only"], ["Where are parameters stored in ROS 2?", "In each node"], ["Which feature is NEW in ROS 2?", "Quality of Service (QoS) settings"]]);
  const all = { "How do nodes find each other in ROS 2?": ["Automatic discovery through DDS (no master)", "They ask roscore", "They read a shared text file", "They use Bluetooth"],
    "Which tool builds ROS 2 workspaces?": ["colcon", "catkin_make", "rosmake", "make only"], "Which Python version does ROS 2 use?": ["Python 3 only", "Python 2 only", "Both 2 and 3", "No Python"],
    "Where are parameters stored in ROS 2?": ["In each node", "On the master's parameter server", "In a database", "On the internet"],
    "Which feature is NEW in ROS 2?": ["Quality of Service (QoS) settings", "Topics", "Messages", "Publishers"] };
  return { prompt: f, options: all[f], correct: a, explain: "ROS 2 has no master, builds with colcon, uses Python 3, stores parameters per node and adds QoS." };
});
mcq("I-MASTER", "r1r2", (r) => ({ prompt: "In ROS 1, what happened when roscore (the master) stopped?",
  options: ["New nodes could no longer find each other", "All data was deleted", "The robot rebooted", "Nothing, ROS 1 had no master"],
  correct: "New nodes could no longer find each other", explain: "The ROS 1 master only helped nodes find each other. Without it, no new connections could be made. ROS 2 removed this single point of failure." }));
mcq("I-DATAPATH", "r1r2", (r) => ({ prompt: "In ROS 1, did topic DATA travel through the master?",
  options: ["No, data went directly between nodes; the master only helped them find each other", "Yes, every message went through the master", "Only images went through the master", "Data was emailed"],
  correct: "No, data went directly between nodes; the master only helped them find each other", explain: "A common misunderstanding: the master was a phone book, not a post office." }));
T.push({ id: "I-STACK", topic: "r1r2", type: "order", make(r) {
  const lang = pick(r, ["rclpy", "rclcpp"]);
  return { prompt: `Put the ROS 2 layers in order, from your code (top) down to the network.`, items: ["Your node", lang, "rcl", "rmw", "DDS implementation (e.g. Fast DDS)"],
    explain: `Your code calls ${lang}, which uses the shared C core rcl, which talks to the middleware through the rmw plug.` };
} });
mcq("I-RMWVAR", "r1r2", (r) => {
  const v = pick(r, ["rmw_cyclonedds_cpp", "rmw_fastrtps_cpp", "rmw_connextdds"]);
  return { prompt: `Which environment variable switches a terminal's ROS 2 middleware to ${v}?`, options: ["RMW_IMPLEMENTATION", "ROS_DOMAIN_ID", "ROS_DISTRO", "AMENT_PREFIX_PATH"], correct: "RMW_IMPLEMENTATION",
    explain: `export RMW_IMPLEMENTATION=${v}. Your code does not change; use the same middleware on every computer.` };
});
mcq("I-PATTERN", "r1r2", (r) => {
  const [s, a] = pick(r, [["FM radio: one station, anyone tuned in hears it", "Publish/subscribe"], ["a phone call: one asks, one answers", "Request/response"],
    ["a school announcement speaker heard in every classroom", "Publish/subscribe"], ["asking the railway enquiry counter one question", "Request/response"]]);
  return { prompt: `Which communication pattern is like ${s}?`, options: ["Publish/subscribe", "Request/response", "Parameter setting", "Launch file"], correct: a, explain: "Topics are publish/subscribe (one-to-many); services are request/response." };
});

// ---------------- DDS, domains and QoS ----------------
const REL = ["RELIABLE", "BEST_EFFORT"], DUR = ["VOLATILE", "TRANSIENT_LOCAL"];
mcq("I-QOSMATCH", "dds", (r) => {
  const pr = pick(r, REL), sr = pick(r, REL), pd = pick(r, DUR), sd = pick(r, DUR);
  const relBad = pr === "BEST_EFFORT" && sr === "RELIABLE", durBad = pd === "VOLATILE" && sd === "TRANSIENT_LOCAL";
  const correct = relBad ? "No: reliability is incompatible" : durBad ? "No: durability is incompatible" : "Yes, they connect";
  return { prompt: `A publisher offers ${pr} + ${pd}. A subscriber requests ${sr} + ${sd}. Will they connect?`,
    options: ["Yes, they connect", "No: reliability is incompatible", "No: durability is incompatible", "Only on Windows"], correct,
    explain: "The publisher must offer at least what the subscriber requests. BEST_EFFORT cannot serve a RELIABLE request; VOLATILE cannot serve a TRANSIENT_LOCAL request." };
});
T.push({ id: "I-PORT", topic: "dds", type: "predict", make(r) {
  const d = int(r, 0, 101);
  return { prompt: `DDS discovery uses multicast port 7400 + 250 × domain ID. Which port does ROS_DOMAIN_ID=${d} use? (Type the number.)`, correct: String(7400 + 250 * d),
    explain: `7400 + 250 × ${d} = ${7400 + 250 * d}. Different domain IDs use different ports, which is why they can't see each other.` };
} });
mcq("I-DOMAIN", "dds", (r) => {
  const a = int(r, 1, 101), same = r() < 0.5, b = same ? a : (a % 100) + 1;
  return { prompt: `Laptop A runs a talker with ROS_DOMAIN_ID=${a}. Laptop B on the same Wi-Fi runs a listener with ROS_DOMAIN_ID=${b}. What happens?`,
    options: ["The listener hears the talker", "The listener hears nothing", "Both laptops crash", "The talker switches domains automatically"],
    correct: same ? "The listener hears the talker" : "The listener hears nothing", explain: "Only participants in the same domain discover each other." };
});
mcq("I-DOMAINSAFE", "dds", (r) => ({ prompt: "Which ROS_DOMAIN_ID values are the safe choice on Linux?", options: ["0 to 101", "0 to 1000", "Only 0", "Any number"],
  correct: "0 to 101", explain: "Up to 232 is possible, but above 101 can clash with other programs' ports on Linux. Give each lab bench its own number between 1 and 101." }));
mcq("I-QOSPROFILE", "dds", (r) => {
  const [what, a] = pick(r, [["cameras and LiDAR (fast data where a lost message is OK)", "BEST_EFFORT"], ["robot commands that must arrive", "RELIABLE"]]);
  return { prompt: `Which reliability setting is usually used for ${what}?`, options: ["RELIABLE", "BEST_EFFORT", "TRANSIENT_LOCAL", "KEEP_ALL"], correct: a,
    explain: "Sensor data uses best effort (no waiting for resends); important commands use reliable." };
});
mcq("I-LATE", "dds", (r) => ({ prompt: "A map server publishes the map once at startup. A planner starts 1 minute later and still receives that map. Which QoS makes this possible?",
  options: ["TRANSIENT_LOCAL durability on both sides", "BEST_EFFORT reliability", "VOLATILE durability", "A bigger depth on the subscriber only"],
  correct: "TRANSIENT_LOCAL durability on both sides", explain: "Transient-local publishers keep their last messages for late-joining subscribers that also ask for transient-local." }));
mcq("I-DDSWORD", "dds", (r) => {
  const [w, d] = pick(r, [["SPDP", "the first discovery step: participants announce themselves"], ["SEDP", "the second discovery step: they exchange their readers and writers"],
    ["RTPS", "the standard wire protocol that DDS sends over the network"], ["DataWriter", "the DDS object behind a ROS publisher"]]);
  return { prompt: `In DDS, what is ${w}?`, options: ["the first discovery step: participants announce themselves", "the second discovery step: they exchange their readers and writers",
    "the standard wire protocol that DDS sends over the network", "the DDS object behind a ROS publisher"], correct: d, explain: `${w}: ${d}.` };
});
mcq("I-DEFAULT", "dds", (r) => ({ prompt: "Which middleware does ROS 2 Jazzy use if you do not choose one?", options: ["eProsima Fast DDS", "Eclipse Cyclone DDS", "Zenoh", "RTI Connext"],
  correct: "eProsima Fast DDS", explain: "Fast DDS (rmw_fastrtps_cpp) is the default in Jazzy; Cyclone DDS and Connext are also fully supported." }));

module.exports = T;
