// gz sim / ros_gz_sim create / ros_gz_bridge command lines and bridge config files, read like the real programs read them.
// Run: node tests/gz-cli.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseGzSimArgs, parseCreateArgs, parseBridgeConfigYaml, parseBridgeArgs, bridgeCreateLines, bridgeTypesOk, splitShell } from "../public/js/gz-cli.js";
let n = 0; const ok = (name, f) => { f(); n++; console.log("ok", name); };
const ROOT = new URL("..", import.meta.url).pathname;

ok("gz sim from the launch runtime (shell=True pieces)", () => {
  const a = parseGzSimArgs(["ruby /usr/bin/gz sim", "-r -s -v2 /home/student/ros2_ws/install/share/turtlebot3_gazebo/worlds/turtlebot3_world.world", "--force-version", "8"]);
  assert.equal(a.run, true); assert.equal(a.server, true); assert.equal(a.verbose, 2); assert.equal(a.forceVersion, "8");
  assert.equal(a.file, "/home/student/ros2_ws/install/share/turtlebot3_gazebo/worlds/turtlebot3_world.world");
  assert.equal(a.startsServer, true); assert.equal(a.startsGui, false);
});
ok("gz sim -g: GUI only", () => { const a = parseGzSimArgs("ruby /usr/bin/gz sim -g -v2  --force-version 8"); assert.equal(a.startsServer, false); assert.equal(a.startsGui, true); assert.equal(a.file, null); });
ok("gz sim -v without a level is 3; -v 4; --physics-engine", () => {
  assert.equal(parseGzSimArgs(["gz", "sim", "-v", "empty.sdf"]).verbose, 3);
  const a = parseGzSimArgs("gz sim  -r -v 4 empty.sdf --physics-engine gz-physics-bullet-featherstone-plugin");
  assert.equal(a.verbose, 4); assert.equal(a.file, "empty.sdf"); assert.equal(a.physicsEngine, "gz-physics-bullet-featherstone-plugin");
});
ok("gz sim -z, --iterations, --seed, --render-engine=ogre", () => { const a = parseGzSimArgs("gz sim -z 500 --iterations 10 --seed 3 --render-engine=ogre w.sdf"); assert.deepEqual([a.updateRate, a.iterations, a.seed, a.renderEngine, a.file], [500, 10, 3, "ogre", "w.sdf"]); });
ok("gz sim invalid option / wrong --force-version", () => { assert.match(parseGzSimArgs("gz sim --bogus").error, /invalid option: --bogus/); assert.match(parseGzSimArgs("gz sim --force-version 7").error, /couldn't find version \[7\]/); });
ok("create -file with pose (TurtleBot3)", () => {
  const c = parseCreateArgs(["/opt/ros/jazzy/lib/ros_gz_sim/create", "-name", "burger", "-file", "/x/model.sdf", "-x", "-2.0", "-y", "-0.5", "-z", "0.01", "--ros-args"]);
  assert.equal(c.source, "file"); assert.equal(c.name, "burger"); assert.deepEqual(c.pose, { x: -2, y: -0.5, z: 0.01, R: 0, P: 0, Y: 0 });
});
ok("create -topic, -Y, -allow_renaming, gflags =", () => {
  const c = parseCreateArgs("create -topic robot_description -name UF_ROBOT -x -0.2 -y -0.5 -z 1.021 -Y 1.571 -allow_renaming true --ros-args --params-file /tmp/p");
  assert.equal(c.source, "topic"); assert.equal(c.pose.Y, 1.571); assert.equal(c.allowRenaming, true);
  assert.equal(parseCreateArgs("create --world=empty -string <robot/>").world, "empty");
});
ok("create errors (gflags, create.cpp)", () => {
  assert.match(parseCreateArgs("create -name x").error, /Must specify either -file, -param, -string or -topic/);
  assert.match(parseCreateArgs("create -file a.sdf -x abc").error, /illegal value 'abc' specified for double flag 'x'/);
  assert.match(parseCreateArgs("create -foo 1 -file a").error, /unknown command line flag 'foo'/);
});
ok("TurtleBot3 bridge yaml: 7 entries, TwistStamped cmd_vel ROS_TO_GZ", () => {
  const t = fs.readFileSync(ROOT + "public/robots/ws/turtlebot3/src/turtlebot3_simulations/turtlebot3_gazebo/params/turtlebot3_burger_bridge.yaml", "utf8");
  const y = parseBridgeConfigYaml(t);
  assert.equal(y.errors.length, 0); assert.equal(y.entries.length, 7);
  const cv = y.entries.find((e) => e.ros === "cmd_vel");
  assert.deepEqual([cv.rosType, cv.gzType, cv.dir], ["geometry_msgs/msg/TwistStamped", "gz.msgs.Twist", "ROS_TO_GZ"]);
  assert.ok(bridgeTypesOk(cv.rosType, cv.gzType));
  const L = bridgeCreateLines(y.entries).lines.map((l) => l.text);
  assert.ok(L.includes("Creating ROS->GZ Bridge: [cmd_vel (geometry_msgs/msg/TwistStamped) -> cmd_vel (gz.msgs.Twist)] (Lazy 0)"));
});
ok("bridge yaml errors are bridge_config.cpp's", () => {
  assert.match(parseBridgeConfigYaml("ros_topic_name: a").errors[0], /top level must be a YAML sequence/);
  assert.match(parseBridgeConfigYaml("- ros_topic_name: a\n  gz_type_name: gz.msgs.Clock").errors[0], /both ros_type_name and gz_type_name must be set/);
  assert.match(parseBridgeConfigYaml("- topic_name: a\n  ros_topic_name: b\n  ros_type_name: x/msg/Y\n  gz_type_name: gz.msgs.Y").errors[0], /topic_name and ros_topic_name are mutually exclusive/);
  assert.match(parseBridgeConfigYaml("- topic_name: a\n  ros_type_name: x/msg/Y\n  gz_type_name: gz.msgs.Y\n  direction: UP").errors[0], /invalid direction \[UP\]/);
  assert.match(parseBridgeConfigYaml("- topic_name: a\n  ros_type_name: x/msg/Y\n  gz_type_name: gz.msgs.Y\n  qos_profile: FAST").errors[0], /Invalid QoS profile 'FAST'/);
  assert.match(parseBridgeConfigYaml("", { file: "/x.yaml" }).errors[0], /file empty \[\/x.yaml\]/);
});
ok("bridge yaml: topic_name, lazy, queues, qos, flow style", () => {
  const y = parseBridgeConfigYaml("- {topic_name: /clock, ros_type_name: rosgraph_msgs/msg/Clock, gz_type_name: gz.msgs.Clock, direction: GZ_TO_ROS, lazy: true, publisher_queue: 5, qos_profile: CLOCK}");
  assert.deepEqual([y.entries[0].ros, y.entries[0].gz, y.entries[0].lazy, y.entries[0].publisherQueue, y.entries[0].qos], ["/clock", "/clock", true, 5, "CLOCK"]);
});
ok("parameter_bridge arguments (parameter_bridge.cpp)", () => {
  const r = parseBridgeArgs(["/opt/ros/jazzy/lib/ros_gz_bridge/parameter_bridge", "/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock", "/cmd@geometry_msgs/msg/Twist]gz.msgs.Twist", "/c@std_msgs/msg/String@gz.msgs.StringMsg", "--ros-args", "-p", "lazy:=true"]);
  assert.deepEqual(r.entries.map((e) => e.dir), ["GZ_TO_ROS", "ROS_TO_GZ", "BIDIRECTIONAL"]); assert.equal(r.entries[0].lazy, true);
  assert.equal(parseBridgeArgs(["parameter_bridge", "/x@bad"]).usage, true);
  assert.equal(parseBridgeArgs(["parameter_bridge", "/world/default/control@ros_gz_interfaces/srv/ControlWorld"]).services.length, 1);
  assert.equal(bridgeTypesOk("sensor_msgs/msg/LaserScan", "gz.msgs.Image"), false);
});
ok("shell splitting with quotes", () => assert.deepEqual(splitShell(`a 'b c' "d\\"e" f\\ g`), ["a", "b c", 'd"e', "f g"]));
console.log(`${n} passed`);
