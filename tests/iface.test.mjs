import fs from "fs";
import * as I from "../public/js/ros-iface.js";
I.setIfaces(JSON.parse(fs.readFileSync("public/robots/ros-ifaces.json")));
console.log(I.showLines("geometry_msgs/msg/Twist").join("\n"));
console.log(I.showLines("sensor_msgs/msg/JointState").join("\n"));
console.log(I.protoBlock("geometry_msgs/msg/PoseStamped").join("\n"));
console.log(I.protoFlow("geometry_msgs/msg/TwistStamped"));
const m = I.buildMessage("geometry_msgs/msg/TwistStamped", I.parseYaml("{header: auto, twist: {linear: {x: 0.3}, angular: {z: 0.5}}}"), { now: () => ({ sec: 12, nanosec: 5 }) });
console.log(I.pyRepr("geometry_msgs/msg/TwistStamped", m));
console.log(I.echoLines("geometry_msgs/msg/TwistStamped", m).join("\n"));
try { I.buildMessage("geometry_msgs/msg/Twist", I.parseYaml("{linear: {q: 1}}")); } catch (e) { console.log("ERR", e.message); }
try { I.buildMessage("geometry_msgs/msg/Twist", I.parseYaml("linear: {x: 1}")); console.log("ok noBrace"); } catch (e) { console.log("ERR", e.message); }
console.log(JSON.stringify(I.parseYaml("linear:\n  x: 0.5\nangular:\n  z: 1")));
const jt = I.buildMessage("trajectory_msgs/msg/JointTrajectory", I.parseYaml("{joint_names: [a, b], points: [{positions: [0.5, -0.3], time_from_start: {sec: 2}}]}"));
console.log(I.pyRepr("trajectory_msgs/msg/JointTrajectory", jt));
console.log(I.echoLines("trajectory_msgs/msg/JointTrajectory", jt).join("\n"));
const st = I.sectionType("nav2_msgs/action/NavigateToPose", "goal"); console.log(st.type, I.protoFlow(st));
console.log(I.showLines("turtlesim/srv/Spawn").join("\n"));
