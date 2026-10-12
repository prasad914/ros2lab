// The course robots on real hardware: the same files that `ros2 run ros2lab_hardware ros2lab_robot_setup` writes
// (hardware/src/ros2lab_hardware/scripts/ros2lab_robot_setup.py), made in the browser from the robot's URDF, so the
// workspace shows <id>_bringup with its ros2_control block, controllers, firmware configuration and wiring table.
// Keep this file and the Python generator in step: tests/robot-hw.test.mjs compares their output byte for byte.
import { parseXML } from "./urdf-core.js";

const TYPES = ["arm", "diff", "mecanum", "ackermann", "legged", "mobile_manipulator", "legged_manipulator"];
export const PINS = {
  esp32: {
    motors: [
      { driver: "TB6612", pwm: 25, b: 26, c: 27, ea: 18, eb: 19 },
      { driver: "TB6612", pwm: 33, b: 32, c: 4, ea: 16, eb: 17 },
    ],
    servo_pins: [], pca_channels: 32, baud: 921600, sts: { port: "Serial2", rx: 13, tx: 14 },
  },
  mega: {
    motors: [
      { driver: "TB6612", pwm: 5, b: 22, c: 23, ea: 2, eb: 30 },
      { driver: "TB6612", pwm: 6, b: 24, c: 25, ea: 3, eb: 31 },
      { driver: "TB6612", pwm: 7, b: 26, c: 27, ea: 18, eb: 32 },
      { driver: "TB6612", pwm: 8, b: 28, c: 29, ea: 19, eb: 33 },
    ],
    servo_pins: [9, 10, 11, 12, 13, 34, 35, 36, 37, 38, 39, 40], pca_channels: 32, baud: 500000, sts: { port: "Serial2", rx: 17, tx: 16 },
  },
};
const DEFAULT_MOTOR = { counts_per_rev: 660.0, kp: 0.08, ki: 0.6, kd: 0.0, max_vel: 20.0 };
const DEFAULT_SERVO = { us_min: 500, us_max: 2500, travel: Math.PI, max_speed: 5.0 };   // travel: pi for a 180 deg servo

// the course robots: which kind of hardware each one is (the quadcopter flies with PX4, not with this bridge)
export const COURSE_KIND = {
  arm3: "arm", arm6: "arm", chiku: "diff", chiku_mesh: "diff", mecanum: "mecanum", ackermann: "ackermann",
  quadruped: "legged", hexapod: "legged", humanoid: "legged", mobile_manipulator: "mobile_manipulator", legged_manipulator: "legged_manipulator",
};

// Python's str() of a float and repr() of a list of str, so the output matches the Python generator exactly
const pyf = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const pylist = (a) => `[${a.map((x) => `'${x}'`).join(", ")}]`;
const fx = (v, n) => (Object.is(v, -0) ? "-" : "") + v.toFixed(n);   // Python's f"{v:.3f}" (it keeps the sign of -0.0)

export class HwError extends Error {}

// the few DOM calls used below, on urdf-core's parseXML (Node has no DOMParser: tools/export-ws.mjs)
class MiniDomParser {
  parseFromString(text) {
    const seen = new WeakMap();
    const wrap = (n) => { if (!seen.has(n)) seen.set(n, { nodeType: n.tag === "#text" ? 3 : 1, tagName: n.tag, get childNodes() { return n.children.map(wrap); }, getAttribute: (k) => (k in n.attrs ? n.attrs[k] : null), hasAttribute: (k) => k in n.attrs }); return seen.get(n); };
    return { documentElement: wrap(parseXML(text)) };
  }
}
export function parseUrdfHw(text, DP = globalThis.DOMParser || MiniDomParser) {
  const doc = new DP().parseFromString(text, "application/xml");
  const root = doc.documentElement;
  const kids = (el, tag) => [...el.childNodes].filter((n) => n.nodeType === 1 && n.tagName === tag);
  const links = {}; for (const l of kids(root, "link")) links[l.getAttribute("name")] = l;
  const joints = [];
  for (const j of kids(root, "joint")) {
    const type = j.getAttribute("type");
    if (!["revolute", "continuous", "prismatic"].includes(type) || kids(j, "mimic").length) continue;
    const lim = kids(j, "limit")[0];
    let lo = -Math.PI, hi = Math.PI;
    if (type !== "continuous" && lim) {
      if (lim.hasAttribute("lower")) lo = parseFloat(lim.getAttribute("lower"));
      if (lim.hasAttribute("upper")) hi = parseFloat(lim.getAttribute("upper"));
    }
    const org = kids(j, "origin")[0];
    const xyz = ((org && org.getAttribute("xyz")) || "0 0 0").trim().split(/\s+/).map(Number);
    joints.push({ name: j.getAttribute("name"), type, lower: lo, upper: hi, xyz, child: kids(j, "child")[0].getAttribute("link") });
  }
  const children = new Set(kids(root, "joint").map((j) => (kids(j, "child")[0] || { getAttribute: () => null }).getAttribute("link")));
  const base = Object.keys(links).find((n) => !children.has(n)) || "base_link";   // the root link: the robot's base frame
  return { robot: root.getAttribute("name"), joints, links, kids, base };
}

function wheelRadius(P, linkName) {
  const link = P.links[linkName]; if (!link) return null;
  for (const tag of ["collision", "visual"]) {
    for (const el of P.kids(link, tag)) {
      const g = P.kids(el, "geometry")[0]; if (!g) continue;
      const c = P.kids(g, "cylinder")[0] || P.kids(g, "sphere")[0];
      if (c) return parseFloat(c.getAttribute("radius"));
    }
  }
  return null;
}

export function hwPlan(P, kind, board, servo = "pwm", stsIds = {}) {
  if (!TYPES.includes(kind)) throw new HwError(`unknown robot type ${kind}`);
  const isWheel = (j) => j.type === "continuous" || /wheel/.test(j.name), isSteer = (j) => /steer/.test(j.name);
  const wheels = P.joints.filter((j) => isWheel(j) && !isSteer(j)), others = P.joints.filter((j) => !wheels.includes(j));
  if (["diff", "mecanum", "ackermann", "mobile_manipulator"].includes(kind) && !wheels.length) throw new HwError('No wheel joints found (continuous joints, or names with "wheel")');
  let motors = [], servos = [], passive = [];
  if (["diff", "mecanum", "mobile_manipulator", "ackermann"].includes(kind)) {
    motors = wheels.filter((j) => !/caster/.test(j.name));
    servos = others.filter((j) => !/caster/.test(j.name));
    if (kind === "ackermann") {
      let rear = motors.filter((j) => /rear|back/.test(j.name)); if (!rear.length) rear = motors.filter((j) => j.xyz[0] < 0);
      if (rear.length) { passive = motors.filter((j) => !rear.includes(j)); motors = rear; }   // front wheels roll freely
    }
  } else servos = [...others, ...wheels];
  const B = PINS[board];
  if (motors.length > B.motors.length) throw new HwError(`${motors.length} DC motors, but the ${board} plan has pins for ${B.motors.length}: use --board mega`);
  const out = motors.map((j, i) => ({ joint: j, actuator: "motor", pins: B.motors[i], index: i }));
  if (servo === "sts") {
    const used = new Set(Object.values(stsIds)); let next = 1;
    for (const j of servos) {
      let id = stsIds[j.name];
      if (id === undefined) { while (used.has(next)) next++; id = next++; }
      out.push({ joint: j, actuator: "sts", bus_id: id });
    }
    return [...out, ...passive.map((j) => ({ joint: j, actuator: "passive" }))];
  }
  const usePca = board === "esp32" || servos.length > B.servo_pins.length;
  if (usePca && servos.length > B.pca_channels) throw new HwError(`${servos.length} servos: more than two PCA9685 boards hold`);
  servos.forEach((j, i) => out.push({ joint: j, actuator: "servo", pca: usePca, channel: usePca ? i : null, pin: usePca ? null : B.servo_pins[i] }));
  return [...out, ...passive.map((j) => ({ joint: j, actuator: "passive" }))];
}

export function ros2ControlXacro(name, plan, imu, board) {
  const L = [
    '<?xml version="1.0"?>',
    `<!-- ${name}: ros2_control for mock / Gazebo / the real robot (ros2lab_hardware). Generated by ros2lab_robot_setup. -->`,
    '<robot xmlns:xacro="http://www.ros.org/wiki/xacro">',
    '  <xacro:arg name="hardware_type" default="mock"/>',
    '  <xacro:arg name="transport" default="serial"/>',
    '  <xacro:arg name="device" default="/dev/ros2lab_mcu"/>',
    '  <xacro:arg name="host" default="192.168.4.1"/>',
    '  <xacro:include filename="$(find ros2lab_hardware)/config/bridge.ros2_control.xacro"/>',
    `  <xacro:ros2lab_system name="${name}" hardware_type="$(arg hardware_type)" transport="$(arg transport)" device="$(arg device)" baud="${PINS[board].baud}" host="$(arg host)" robot_id="${name}">`,
    "    <interfaces>",
  ];
  for (const p of plan) {
    if (p.actuator === "passive") { L.push(`      <joint name="${p.joint.name}">`, '        <state_interface name="position"/>', "      </joint>"); continue; }   // state only: still a TF
    const j = p.joint, cmd = p.actuator === "motor" ? "velocity" : "position";
    const init = cmd === "velocity" ? "" : `<param name="initial_value">${fx(j.lower <= 0 && 0 <= j.upper ? 0 : (j.lower + j.upper) / 2, 3)}</param>`;
    L.push(`      <joint name="${j.name}">`, `        <command_interface name="${cmd}"/>`, `        <state_interface name="position">${init}</state_interface>`, '        <state_interface name="velocity"/>', "      </joint>");
  }
  if (imu) {
    L.push('      <sensor name="imu">');
    for (const f of ["orientation.x", "orientation.y", "orientation.z", "orientation.w", "angular_velocity.x", "angular_velocity.y", "angular_velocity.z", "linear_acceleration.x", "linear_acceleration.y", "linear_acceleration.z"]) L.push(`        <state_interface name="${f}"/>`);
    L.push("      </sensor>");
  }
  L.push("    </interfaces>", "  </xacro:ros2lab_system>", "</robot>", "");
  return L.join("\n");
}

export function controllersYaml(name, kind, plan, P, imu) {
  const motors = plan.filter((p) => p.actuator === "motor").map((p) => p.joint);
  let servos = plan.filter((p) => p.actuator !== "motor" && p.actuator !== "passive").map((p) => p.joint);
  const ctl = [["joint_state_broadcaster", "joint_state_broadcaster/JointStateBroadcaster"]], body = [];
  if (imu) {
    ctl.push(["imu_sensor_broadcaster", "imu_sensor_broadcaster/IMUSensorBroadcaster"]);
    body.push(`imu_sensor_broadcaster:\n  ros__parameters:\n    sensor_name: imu\n    frame_id: ${P.base}\n`);
  }
  const ys = (js) => js.map((j) => j.xyz[1]);
  if (["diff", "mobile_manipulator"].includes(kind) && motors.length) {
    const left = motors.filter((j) => j.xyz[1] > 0).map((j) => j.name), right = motors.filter((j) => j.xyz[1] <= 0).map((j) => j.name);
    const sep = motors.length > 1 ? Math.max(...ys(motors)) - Math.min(...ys(motors)) : 0.3;
    const r = wheelRadius(P, motors[0].child) || 0.05;
    ctl.push(["diff_drive_controller", "diff_drive_controller/DiffDriveController"]);
    body.push(`diff_drive_controller:
  ros__parameters:
    left_wheel_names: ${pylist(left)}
    right_wheel_names: ${pylist(right)}
    wheel_separation: ${fx(sep, 4)}
    wheel_radius: ${fx(r, 4)}
    publish_rate: 50.0
    odom_frame_id: odom
    base_frame_id: ${P.base}
    enable_odom_tf: true
    cmd_vel_timeout: 0.5
    linear.x.max_velocity: 0.5
    angular.z.max_velocity: 2.0
`);
  }
  if (kind === "mecanum" && motors.length === 4) {
    const [fl, fr, rl, rr] = [...motors].sort((a, b) => (b.xyz[0] - a.xyz[0]) || (b.xyz[1] - a.xyz[1]));
    const r = wheelRadius(P, fl.child) || 0.04, lx = Math.abs(fl.xyz[0]), ly = Math.abs(fl.xyz[1]);
    ctl.push(["mecanum_drive_controller", "mecanum_drive_controller/MecanumDriveController"]);
    body.push(`mecanum_drive_controller:
  ros__parameters:
    reference_timeout: 0.5
    front_left_wheel_command_joint_name: ${fl.name}
    front_right_wheel_command_joint_name: ${fr.name}
    rear_left_wheel_command_joint_name: ${rl.name}
    rear_right_wheel_command_joint_name: ${rr.name}
    kinematics:
      base_frame_offset: {x: 0.0, y: 0.0, theta: 0.0}
      wheels_radius: ${fx(r, 4)}
      sum_of_robot_center_projection_on_X_Y_axis: ${fx(lx + ly, 4)}
    base_frame_id: ${P.base}
    odom_frame_id: odom
`);
  }
  if (kind === "ackermann") {
    const steerJ = servos.filter((j) => /steer/.test(j.name)), steer = steerJ.map((j) => j.name);
    const rightFirst = (js) => [...js].sort((a, b) => a.xyz[1] - b.xyz[1]).map((j) => j.name);   // Jazzy: "right joint, left joint"
    const span = (js) => (js.length > 1 ? Math.max(...ys(js)) - Math.min(...ys(js)) : 0.2);
    const mean = (js) => js.reduce((s, j) => s + j.xyz[0], 0) / js.length;
    const wheelbase = steerJ.length && motors.length ? mean(steerJ) - mean(motors) : 0.3;
    const r = (motors.length ? wheelRadius(P, motors[0].child) : null) || 0.05;
    ctl.push(["ackermann_steering_controller", "ackermann_steering_controller/AckermannSteeringController"]);
    body.push(`ackermann_steering_controller:
  ros__parameters:
    reference_timeout: 0.5
    front_steering: true
    open_loop: false
    velocity_rolling_window_size: 10
    position_feedback: true
    base_frame_id: ${P.base}
    odom_frame_id: odom
    traction_joints_names: ${pylist(rightFirst(motors))}
    steering_joints_names: ${pylist(rightFirst(steerJ))}
    wheelbase: ${fx(Math.abs(wheelbase), 4)}
    traction_track_width: ${fx(span(motors), 4)}
    steering_track_width: ${fx(span(steerJ), 4)}
    traction_wheels_radius: ${fx(r, 4)}
`);
    servos = servos.filter((j) => !steer.includes(j.name));
  }
  if (servos.length) {
    ctl.push(["joint_trajectory_controller", "joint_trajectory_controller/JointTrajectoryController"]);
    body.push("joint_trajectory_controller:\n  ros__parameters:\n    joints:\n" + servos.map((j) => `      - ${j.name}\n`).join("") +
      "    command_interfaces: [position]\n    state_interfaces: [position, velocity]\n    allow_partial_joints_goal: false\n" +
      "    constraints:\n      stopped_velocity_tolerance: 0.05\n      goal_time: 0.0\n");
  }
  const head = "controller_manager:\n  ros__parameters:\n    update_rate: 100\n" + ctl.map(([k, v]) => `    ${k}:\n      type: ${v}\n`).join("");
  return `# ${name}: ros2_control controllers. Generated by ros2lab_robot_setup.\n` + head + "\n" + body.join("\n");
}

export function newPassword() {
  const a = new Uint8Array(9); globalThis.crypto.getRandomValues(a);
  return "r2l-" + btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function firmwareConfig(name, plan, board, imu, wifi, wifiPass) {
  const B = PINS[board];
  const L = [`// robot_config.h for ${name} (${board}): generated by ros2lab_robot_setup. Check every pin against your wiring.`,
    "#pragma once", '#include "bridge_core.h"', '#include "actuators.h"', '#include "imu.h"', "",
    `#define ROBOT_ID "${name}"`, `#define BRIDGE_BAUD ${B.baud}`];
  if (wifi && board === "esp32") L.push("#define WIFI_AP                     // the robot makes its own Wi-Fi; remove for the lab network", `#define WIFI_SSID "${name}_robot"`,
    `#define WIFI_PASS "${wifiPass || newPassword()}"   // made for this robot; the Jetson joins with it`, "#define UDP_PORT 8888");
  L.push("");
  const servos = plan.filter((p) => p.actuator === "servo"), sts = plan.filter((p) => p.actuator === "sts");
  if (servos.some((p) => p.pca)) L.push("static bridge::Pca9685 pca0(0x40), pca1(0x41);");
  if (sts.length) L.push(`static bridge::StsBus sts(${B.sts.port});   // Feetech STS3215 bus, 1 Mbit/s`);
  if (plan.some((p) => p.actuator === "motor")) L.push(`static const bridge::MotorTuning MOTOR = {${pyf(DEFAULT_MOTOR.counts_per_rev)}f, ${pyf(DEFAULT_MOTOR.kp)}f, ${pyf(DEFAULT_MOTOR.ki)}f, ` +
    `${pyf(DEFAULT_MOTOR.kd)}f, ${pyf(DEFAULT_MOTOR.max_vel)}f, false, false};   // counts/rev, kp, ki, kd, max rad/s, position mode, invert`);
  L.push("", "static void robot_setup(bridge::Actuator ** a, uint8_t & n, bridge::Imu *& imu)", "{");
  if (servos.some((p) => p.pca)) L.push("  pca0.begin();" + (servos.some((p) => (p.channel || 0) >= 16) ? "\n  pca1.begin();" : ""));
  if (sts.length) L.push(`  sts.begin(${B.sts.rx}, ${B.sts.tx});`);
  L.push("  n = 0;");
  for (const p of plan) {
    const j = p.joint, v = j.name.replace(/\W/g, "_");
    if (p.actuator === "sts") {
      L.push(`  static bridge::StsServo s_${v}(sts, ${p.bus_id}, 2048, 1, ${fx(j.lower, 3)}f, ${fx(j.upper, 3)}f);   // ${j.name}: raw 2048 = 0 rad; calibrate the offset per servo`, `  a[n++] = &s_${v};`);
    } else if (p.actuator === "motor") {
      const m = p.pins;
      L.push(`  static bridge::DcMotor m${p.index}(${p.index}, {bridge::Driver::${m.driver}, ${m.pwm}, ${m.b}, ${m.c}, ${m.ea}, ${m.eb}}, MOTOR);   // ${j.name}`, `  a[n++] = &m${p.index};`);
    } else if (p.actuator === "servo") {
      const half = DEFAULT_SERVO.travel / 2;   // a joint cannot go past the servo's own travel
      const lo = Math.max(j.lower, -half), hi = Math.min(j.upper, half);
      const rng = `{${DEFAULT_SERVO.us_min}, ${DEFAULT_SERVO.us_max}, ${fx(DEFAULT_SERVO.travel, 4)}f, ${fx(lo, 3)}f, ${fx(hi, 3)}f, ${pyf(DEFAULT_SERVO.max_speed)}f, false, 0.0f}`;
      const init = lo <= 0 && 0 <= hi ? 0 : (lo + hi) / 2;
      if (p.pca) L.push(`  static bridge::ServoPca9685 s_${v}(${p.channel < 16 ? "pca0" : "pca1"}, ${p.channel % 16}, ${rng}, ${fx(init, 3)}f);   // ${j.name}`);
      else L.push(`  static bridge::ServoPwm s_${v}(${p.pin}, ${rng}, ${fx(init, 3)}f);   // ${j.name}`);
      L.push(`  a[n++] = &s_${v};`);
    }
  }
  if (imu) L.push("  static bridge::Mpu6050 mpu;   // or bridge::Bno055 bno; (I2C)", "  imu = &mpu;");
  else L.push("  imu = 0;   // no IMU on this board (add one: --imu)");
  L.push("}", "");
  return L.join("\n");
}

export function wiringMd(name, plan, board, imu) {
  const rows = plan.map((p) => {
    const j = p.joint.name;
    if (p.actuator === "motor") { const m = p.pins; return `| ${j} | DC motor + encoder (${m.driver}) | PWM ${m.pwm}, IN1 ${m.b}, IN2 ${m.c} | encoder A ${m.ea}, B ${m.eb} |`; }
    if (p.actuator === "sts") return `| ${j} | Feetech STS3215 bus servo | bus ID ${p.bus_id} | position + speed (bus) |`;
    if (p.actuator === "passive") return `| ${j} | none (rolls freely) | - | - |`;
    if (p.pca) return `| ${j} | servo | PCA9685 ${p.channel < 16 ? "0x40" : "0x41"} channel ${p.channel % 16} | - |`;
    return `| ${j} | servo | pin ${p.pin} | - |`;
  });
  const i2c = board === "esp32" ? "SDA 21, SCL 22" : "SDA 20, SCL 21";
  const parts = [...(plan.some((p) => p.pca) ? ["PCA9685 servo board(s) (0x40, 0x41)"] : []), ...(imu ? ["IMU (MPU-6050 0x68 or BNO055 0x28)"] : [])];
  const i2cNote = parts.length ? `I2C (${i2c}): ${parts.join(", ")}.\n` : "";
  const S = PINS[board].sts;
  const stsNote = plan.some((p) => p.actuator === "sts") ? `Feetech bus: board ${S.port} (RX ${S.rx}, TX ${S.tx}) to a half-duplex bus-servo adapter (Waveshare Bus Servo ` +
    "Adapter or the Feetech FE-URT-1 in TTL mode), 1 Mbit/s; servo supply 7.4 V (or 12 V for the 12 V STS3215). " +
    "Give every servo its ID first (Feetech FD software, one servo on the bus at a time), then set each offset so " +
    "that the URDF zero pose reads 0 rad.\n" : "";
  return `# ${name}: wiring (${board})

| Joint | Actuator | Output | Feedback |
|---|---|---|---|
${rows.join("\n")}

${i2cNote}${stsNote}
Power: servos and motors from their own battery / regulator (never from the board's 5 V pin); connect all grounds.
Joint order = the order of the <ros2_control> block = the order in robot_config.h. Do not reorder one without the other.
`;
}

// all four files, as the Python generator writes them
export function robotSetup(urdfText, { kind, board = "esp32", servo = "pwm", stsIds = {}, imu = false, wifi = false, wifiPass = null, name = null, DP } = {}) {
  const P = parseUrdfHw(urdfText, DP);
  const n = name || P.robot, plan = hwPlan(P, kind, board, servo, stsIds);
  return {
    name: n, plan,
    files: {
      [`${n}.ros2_control.xacro`]: ros2ControlXacro(n, plan, imu, board),
      "controllers.yaml": controllersYaml(n, kind, plan, P, imu),
      "robot_config.h": firmwareConfig(n, plan, board, imu, wifi, wifiPass),
      "WIRING.md": wiringMd(n, plan, board, imu),
    },
  };
}
