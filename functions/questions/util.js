// Helpers for building randomized ("parameterised") questions.
// r is a random-number function returning 0 <= x < 1 (seeded per student attempt).

function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const pickN = (r, arr, n) => shuffle(arr, r).slice(0, n);
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// Word lists used to make every student's question different.
const USERS = ["asha", "kiran", "rahul", "divya", "sneha", "arjun", "meera", "rohan", "nikhil",
  "priya", "varun", "ananya", "karthik", "pooja", "suresh", "lavanya", "deepak", "shreya"];
const WORKSPACES = ["ros2_ws", "robot_ws", "dev_ws", "lab_ws", "nav_ws", "bot_ws", "rover_ws", "arm_ws"];
const PKGS = ["my_robot", "line_follower", "wall_avoider", "rover_drive", "arm_control",
  "camera_view", "sensor_reader", "obstacle_stop"];
const FOLDERS = ["maps", "photos", "logs", "configs", "scripts", "notes", "models", "data"];
const PYFILES = ["move.py", "hello_robot.py", "talker.py", "sensor.py", "drive.py", "blink.py",
  "count.py", "scan_reader.py", "patrol.py", "beep.py"];
const TEXTFILES = ["notes.txt", "readme.txt", "todo.txt", "log.txt", "ideas.txt", "points.txt"];
const CLASSES = ["Rover", "Drone", "Robot", "Arm", "Car", "Bot", "Turtle", "Boat", "Crane", "Tractor"];
const ROBOT_NAMES = ["Chiku", "Tinku", "Bolt", "Raju", "Mitra", "Spark", "Nova", "Pixel", "Ravi", "Zippy"];
const TOPICS = ["chatter", "cmd_vel", "scan", "battery", "camera", "odom", "status", "beep"];
const METHODS = ["move", "stop", "beep", "turn_left", "turn_right", "charge", "blink", "report"];
const NODE_NAMES = ["wall_avoider", "line_follower", "battery_monitor", "patrol_node",
  "camera_reader", "speed_control", "obstacle_stop", "greeter"];

module.exports = {
  shuffle, pick, pickN, int,
  USERS, WORKSPACES, PKGS, FOLDERS, PYFILES, TEXTFILES, CLASSES, ROBOT_NAMES,
  TOPICS, METHODS, NODE_NAMES,
};
