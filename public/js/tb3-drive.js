// A JS model of ROBOTIS turtlebot3_drive (turtlebot3_simulations/turtlebot3_gazebo/src/turtlebot3_drive.cpp, jazzy
// branch): node turtlebot3_drive_node, a 10 ms wall timer running the obstacle-avoidance state machine on the scan at
// 0, 30 and 330 degrees and the odom yaw, publishing geometry_msgs/msg/Twist on cmd_vel (KeepLast 10); scan with
// SensorDataQoS (best effort), odom KeepLast 10. On Jazzy the TurtleBot3 Gazebo bridge carries TwistStamped on
// /cmd_vel, so this Twist reaches nothing and the robot does not move (parity/fixtures/tb3_jazzy_v3/<robot>/world/motion:
// drive_cmd_vel_info_v.txt has both types, the Gazebo pose is unchanged). The site does not run the compiled program;
// this reproduces what it computes. Installed on RosGraph.prototype.
const DEG2RAD = Math.PI / 180, LINEAR_VELOCITY = 0.3, ANGULAR_VELOCITY = 1.5;
const GET_TB3_DIRECTION = 0, TB3_DRIVE_FORWARD = 1, TB3_RIGHT_TURN = 2, TB3_LEFT_TURN = 3;
const stamp = () => (Date.now() / 1000).toFixed(9);

export const driveMethods = {
  driveInit(n) {
    n.drive = { state: GET_TB3_DIRECTION, scan: [0, 0, 0], pose: 0, prev: 0, published: 0 };
    n.drive.timer = setInterval(() => { try { this.driveStep(n); } catch (e) { console.error(e); } }, 10);
    return [`[INFO] [${stamp()}] [${n.name}]: Turtlebot3 simulation node has been initialised`];
  },
  driveStop(n) { if (n.drive && n.drive.timer) clearInterval(n.drive.timer); if (n.drive) n.drive.timer = null; return [`[INFO] [${stamp()}] [${n.name}]: Turtlebot3 simulation node has been terminated`]; },
  // the newest messages on <ns>/scan and <ns>/odom, as the subscriptions would have them (null: nothing published)
  driveInputs(n) {
    const topic = (t) => `${n.ns}/${t}`, feeds = this.gzRunning && this.gzRunning() ? this.gzFeeds() : new Map();
    let scan = null, yaw = null;
    const fs = feeds.get(topic("scan"));
    if (fs && fs.src.sensor && fs.src.sensor.lidar) scan = this.gzScan(fs.src.model, fs.src.sensor);
    const fo = feeds.get(topic("odom"));
    if (fo && fo.src.kind === "odom") yaw = this.gzOdom(this.gzModel(fo.src.model)).yaw;
    else { const f = this.nodes.find((x) => x.kind === "tb3_fake" && `${x.ns}/odom` === topic("odom") && x.fake); if (f) { if (this.fakeAdvance) this.fakeAdvance(f); yaw = f.fake.th; } }
    return { scan, yaw };
  },
  driveStep(n) {
    if (!this.nodes.includes(n)) { this.driveStop(n); return; }
    const D = n.drive, { scan, yaw } = this.driveInputs(n);
    if (yaw !== null) D.pose = Math.atan2(Math.sin(yaw), Math.cos(yaw));   // tf2 getRPY yaw
    if (scan) [0, 30, 330].forEach((a, i) => { const r = scan.ranges[a]; if (r !== undefined) D.scan[i] = r === Infinity || r === -Infinity ? scan.range_max : r; });
    const pub = (lx, az) => { D.published++; D.last = { lx, az }; this.driveTwist(n, lx, az); };
    const escape = 30.0 * DEG2RAD, fwd = 0.7, side = 0.6;
    switch (D.state) {
      case GET_TB3_DIRECTION:
        if (D.scan[0] > fwd) {
          if (D.scan[1] < side) { D.prev = D.pose; D.state = TB3_RIGHT_TURN; } else if (D.scan[2] < side) { D.prev = D.pose; D.state = TB3_LEFT_TURN; } else D.state = TB3_DRIVE_FORWARD;
        }
        if (D.scan[0] < fwd) { D.prev = D.pose; D.state = TB3_RIGHT_TURN; }
        break;
      case TB3_DRIVE_FORWARD: pub(LINEAR_VELOCITY, 0.0); D.state = GET_TB3_DIRECTION; break;
      case TB3_RIGHT_TURN: if (Math.abs(D.prev - D.pose) >= escape) D.state = GET_TB3_DIRECTION; else pub(0.0, -1 * ANGULAR_VELOCITY); break;
      case TB3_LEFT_TURN: if (Math.abs(D.prev - D.pose) >= escape) D.state = GET_TB3_DIRECTION; else pub(0.0, ANGULAR_VELOCITY); break;
      default: D.state = GET_TB3_DIRECTION;
    }
  },
  // a geometry_msgs/msg/Twist on <ns>/cmd_vel: only a subscriber of that type takes it (a ros_gz_bridge entry of type
  // Twist, turtlebot3_fake_node); the Jazzy TurtleBot3 bridge is TwistStamped and ignores it
  driveTwist(n, lx, az) {
    const topic = `${n.ns}/cmd_vel`;
    if (this.gzTwist) this.gzTwist(topic, { lx, ly: 0, lz: 0, az }, "geometry_msgs/msg/Twist");
    for (const f of this.nodes) if (f.kind === "tb3_fake" && `${f.ns}/cmd_vel` === topic && this.fakeCmd) this.fakeCmd(f, lx, az);
  },
};
