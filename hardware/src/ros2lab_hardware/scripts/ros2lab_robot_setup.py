#!/usr/bin/env python3
"""ros2lab_robot_setup: everything a course robot needs to run on real hardware, generated from its URDF.

  ros2 run ros2lab_hardware ros2lab_robot_setup --urdf robot.urdf --type diff --board esp32 --out ./out
  ros2 run ros2lab_hardware ros2lab_robot_setup --package chiku_description --type diff        (uses urdf/<name>.urdf.xacro)

Writes into --out (default ./ros2lab_<robot>):
  <robot>.ros2_control.xacro   the <ros2_control> block (hardware_type:=mock|gz|real) to include in the URDF
  controllers.yaml             controller_manager + controllers (joint_state_broadcaster, trajectory / drive controller)
  robot_config.h               the firmware configuration (copy to firmware/ros2lab_bridge/ and flash)
  WIRING.md                    which joint goes to which pin / channel

Robot types: arm, diff, mecanum, ackermann, legged (quadruped, hexapod, humanoid), mobile_manipulator, legged_manipulator.
Boards: esp32 (DevKitC; servos on a PCA9685, up to 2 DC motors) or mega (Arduino Mega 2560; up to 4 DC motors).
Check every pin against your own wiring before powering the motors.
"""
import argparse
import math
import os
import secrets
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

TYPES = ('arm', 'diff', 'mecanum', 'ackermann', 'legged', 'mobile_manipulator', 'legged_manipulator')

# default wiring: the pins the generated firmware uses (see hardware/SPECS.md for the parts)
PINS = {
    'esp32': {
        'motors': [  # TB6612FNG: PWM, IN1, IN2; encoder A, B (any input with pull-up)
            dict(driver='TB6612', pwm=25, b=26, c=27, ea=18, eb=19),
            dict(driver='TB6612', pwm=33, b=32, c=4, ea=16, eb=17),
        ],
        'servo_pins': [],                  # ESP32: every servo goes through the PCA9685 (I2C SDA 21, SCL 22)
        'pca_channels': 32,                # two PCA9685 boards: 0x40 and 0x41
        'baud': 921600,
        'sts': dict(port='Serial2', rx=13, tx=14),   # Feetech bus (via a half-duplex bus-servo adapter)
    },
    'mega': {
        'motors': [  # TB6612FNG / L298N: PWM, IN1, IN2; encoder A on an interrupt pin (2, 3, 18, 19), B any pin
            dict(driver='TB6612', pwm=5, b=22, c=23, ea=2, eb=30),
            dict(driver='TB6612', pwm=6, b=24, c=25, ea=3, eb=31),
            dict(driver='TB6612', pwm=7, b=26, c=27, ea=18, eb=32),
            dict(driver='TB6612', pwm=8, b=28, c=29, ea=19, eb=33),
        ],
        'servo_pins': [9, 10, 11, 12, 13, 34, 35, 36, 37, 38, 39, 40],   # Servo library (up to 12 on timer 5)
        'pca_channels': 32,
        'baud': 500000,                    # 16 MHz AVR: 500 kbit/s is exact (115200 is 2 % off and too slow for 100 Hz)
        'sts': dict(port='Serial2', rx=17, tx=16),   # RX2 17, TX2 16
    },
}
# DC motor: a 12 V gear motor with a Hall encoder (e.g. JGB37-520, 11 lines, 1:30): 11 x 2 x 30 counts per output turn
DEFAULT_MOTOR = dict(counts_per_rev=660.0, kp=0.08, ki=0.6, kd=0.0, max_vel=20.0)
# hobby servo (MG996R): 500..2500 us over its 180 deg travel, centre 1500 us = 0 rad; speed about 5 rad/s at no load
DEFAULT_SERVO = dict(us_min=500, us_max=2500, travel=math.pi, max_speed=5.0)   # travel: pi for a 180 deg servo, 4.712 for 270 deg


def xacro_to_urdf(path):
    out = subprocess.run(['xacro', path], capture_output=True, text=True, check=True)
    return out.stdout


def load_urdf(args):
    if args.urdf:
        text = open(args.urdf, encoding='utf-8').read()
        return xacro_to_urdf(args.urdf) if 'xmlns:xacro' in text else text
    from ament_index_python.packages import get_package_share_directory
    share = get_package_share_directory(args.package)
    urdf_dir = os.path.join(share, 'urdf')
    files = sorted(f for f in os.listdir(urdf_dir) if f.endswith(('.urdf.xacro', '.urdf', '.xacro')))
    if not files:
        sys.exit(f'No .urdf / .urdf.xacro in {urdf_dir}')
    main = next((f for f in files if not re.search(r'(gazebo|control|sim|macro|common)', f)), files[0])
    path = os.path.join(urdf_dir, main)
    return xacro_to_urdf(path) if main.endswith('xacro') else open(path, encoding='utf-8').read()


def parse(urdf_text):
    root = ET.fromstring(urdf_text)
    links = {link.get('name'): link for link in root.findall('link')}
    joints = []
    for j in root.findall('joint'):
        if j.get('type') not in ('revolute', 'continuous', 'prismatic') or j.find('mimic') is not None:
            continue
        lim = j.find('limit')
        lo, hi = (-math.pi, math.pi)
        if j.get('type') != 'continuous' and lim is not None:
            lo, hi = float(lim.get('lower', lo)), float(lim.get('upper', hi))
        org = j.find('origin')
        xyz = [float(v) for v in (org.get('xyz', '0 0 0') if org is not None else '0 0 0').split()]
        joints.append(dict(name=j.get('name'), type=j.get('type'), lower=lo, upper=hi, xyz=xyz,
                           child=j.find('child').get('link')))
    children = {j.find('child').get('link') for j in root.findall('joint') if j.find('child') is not None}
    base = next((n for n in links if n not in children), 'base_link')   # the root link: the robot's base frame
    return root.get('name'), joints, links, base


def wheel_radius(links, link_name):
    link = links.get(link_name)
    if link is None:
        return None
    for tag in ('collision', 'visual'):
        for el in link.findall(tag):
            cyl = el.find('geometry/cylinder')
            if cyl is not None:
                return float(cyl.get('radius'))
            sph = el.find('geometry/sphere')
            if sph is not None:
                return float(sph.get('radius'))
    return None


def plan(name, joints, links, kind, board, servo='pwm', sts_ids=None):
    """Which joint is a motor and which a servo, and on which pins."""
    is_wheel = lambda j: j['type'] == 'continuous' or re.search(r'wheel', j['name'])  # noqa: E731
    is_steer = lambda j: re.search(r'steer', j['name'])  # noqa: E731
    wheels = [j for j in joints if is_wheel(j) and not is_steer(j)]
    others = [j for j in joints if j not in wheels]
    if kind in ('diff', 'mecanum', 'ackermann', 'mobile_manipulator') and not wheels:
        sys.exit('No wheel joints found (continuous joints, or names with "wheel")')
    motors, servos, passive = [], [], []
    if kind in ('diff', 'mecanum', 'mobile_manipulator', 'ackermann'):
        motors = [j for j in wheels if not re.search(r'caster', j['name'])]
        servos = [j for j in others if not re.search(r'caster', j['name'])]
        if kind == 'ackermann':
            # rear-wheel drive: the front wheels roll freely on the steering knuckles (passive joints: in ros2_control
            # with a state only, so they still have a TF, but not on the board)
            rear = [j for j in motors if re.search(r'rear|back', j['name'])] or [j for j in motors if j['xyz'][0] < 0]
            if rear:
                passive = [j for j in motors if j not in rear]
                motors = rear
    else:
        servos = others + wheels
    P = PINS[board]
    if len(motors) > len(P['motors']):
        sys.exit(f'{len(motors)} DC motors, but the {board} plan has pins for {len(P["motors"])}: use --board mega')
    out = []
    for i, j in enumerate(motors):
        out.append(dict(joint=j, actuator='motor', pins=P['motors'][i], index=i))
    if servo == 'sts':
        ids = dict(sts_ids or {})
        unknown = set(ids) - {j['name'] for j in servos}
        if unknown:
            sys.exit(f'--sts-ids names joints that are not servos: {", ".join(sorted(unknown))}')
        free = (i for i in range(1, 254) if i not in ids.values())
        for j in servos:
            out.append(dict(joint=j, actuator='sts', bus_id=ids[j['name']] if j['name'] in ids else next(free)))
        return out + [dict(joint=j, actuator='passive') for j in passive]
    use_pca = board == 'esp32' or len(servos) > len(P['servo_pins'])
    if use_pca and len(servos) > P['pca_channels']:
        sys.exit(f'{len(servos)} servos: more than two PCA9685 boards hold')
    for i, j in enumerate(servos):
        out.append(dict(joint=j, actuator='servo', pca=use_pca, channel=i if use_pca else None,
                        pin=None if use_pca else P['servo_pins'][i]))
    return out + [dict(joint=j, actuator='passive') for j in passive]


def ros2_control_xacro(name, plan_, imu, board):
    lines = [
        '<?xml version="1.0"?>',
        f'<!-- {name}: ros2_control for mock / Gazebo / the real robot (ros2lab_hardware). Generated by ros2lab_robot_setup. -->',
        '<robot xmlns:xacro="http://www.ros.org/wiki/xacro">',
        '  <xacro:arg name="hardware_type" default="mock"/>',
        '  <xacro:arg name="transport" default="serial"/>',
        '  <xacro:arg name="device" default="/dev/ros2lab_mcu"/>',
        '  <xacro:arg name="host" default="192.168.4.1"/>',
        '  <xacro:include filename="$(find ros2lab_hardware)/config/bridge.ros2_control.xacro"/>',
        f'  <xacro:ros2lab_system name="{name}" hardware_type="$(arg hardware_type)" transport="$(arg transport)" '
        f'device="$(arg device)" baud="{PINS[board]["baud"]}" host="$(arg host)" robot_id="{name}">',
        '    <interfaces>',
    ]
    for p in plan_:
        j = p['joint']
        if p['actuator'] == 'passive':   # state only: robot_state_publisher still gets its TF
            lines += [f'      <joint name="{j["name"]}">', '        <state_interface name="position"/>', '      </joint>']
            continue
        cmd = 'velocity' if p['actuator'] == 'motor' else 'position'
        init = '' if cmd == 'velocity' else f'<param name="initial_value">{0.0 if j["lower"] <= 0 <= j["upper"] else (j["lower"] + j["upper"]) / 2:.3f}</param>'
        lines.append(f'      <joint name="{j["name"]}">')
        lines.append(f'        <command_interface name="{cmd}"/>')
        lines.append(f'        <state_interface name="position">{init}</state_interface>')
        lines.append('        <state_interface name="velocity"/>')
        lines.append('      </joint>')
    if imu:
        lines.append('      <sensor name="imu">')
        for f in ('orientation.x', 'orientation.y', 'orientation.z', 'orientation.w', 'angular_velocity.x', 'angular_velocity.y',
                  'angular_velocity.z', 'linear_acceleration.x', 'linear_acceleration.y', 'linear_acceleration.z'):
            lines.append(f'        <state_interface name="{f}"/>')
        lines.append('      </sensor>')
    lines += ['    </interfaces>', '  </xacro:ros2lab_system>', '</robot>', '']
    return '\n'.join(lines)


def controllers_yaml(name, kind, plan_, links, imu, base='base_link'):  # noqa: C901
    motors = [p['joint'] for p in plan_ if p['actuator'] == 'motor']
    servos = [p['joint'] for p in plan_ if p['actuator'] not in ('motor', 'passive')]
    ctl = {'joint_state_broadcaster': 'joint_state_broadcaster/JointStateBroadcaster'}
    body = []
    if imu:
        ctl['imu_sensor_broadcaster'] = 'imu_sensor_broadcaster/IMUSensorBroadcaster'
        body.append(f'imu_sensor_broadcaster:\n  ros__parameters:\n    sensor_name: imu\n    frame_id: {base}\n')
    if kind in ('diff', 'mobile_manipulator') and motors:
        left = [j['name'] for j in motors if j['xyz'][1] > 0]
        right = [j['name'] for j in motors if j['xyz'][1] <= 0]
        sep = (max(j['xyz'][1] for j in motors) - min(j['xyz'][1] for j in motors)) if len(motors) > 1 else 0.3
        r = wheel_radius(links, motors[0]['child']) or 0.05
        ctl['diff_drive_controller'] = 'diff_drive_controller/DiffDriveController'
        body.append(f'''diff_drive_controller:
  ros__parameters:
    left_wheel_names: {left}
    right_wheel_names: {right}
    wheel_separation: {sep:.4f}
    wheel_radius: {r:.4f}
    publish_rate: 50.0
    odom_frame_id: odom
    base_frame_id: {base}
    enable_odom_tf: true
    cmd_vel_timeout: 0.5
    linear.x.max_velocity: 0.5
    angular.z.max_velocity: 2.0
''')
    if kind == 'mecanum' and len(motors) == 4:
        order = sorted(motors, key=lambda j: (-j['xyz'][0], -j['xyz'][1]))   # front left, front right, rear left, rear right
        fl, fr, rl, rr = order[0], order[1], order[2], order[3]
        r = wheel_radius(links, fl['child']) or 0.04
        lx, ly = abs(fl['xyz'][0]), abs(fl['xyz'][1])
        ctl['mecanum_drive_controller'] = 'mecanum_drive_controller/MecanumDriveController'
        body.append(f'''mecanum_drive_controller:
  ros__parameters:
    reference_timeout: 0.5
    front_left_wheel_command_joint_name: {fl['name']}
    front_right_wheel_command_joint_name: {fr['name']}
    rear_left_wheel_command_joint_name: {rl['name']}
    rear_right_wheel_command_joint_name: {rr['name']}
    kinematics:
      base_frame_offset: {{x: 0.0, y: 0.0, theta: 0.0}}
      wheels_radius: {r:.4f}
      sum_of_robot_center_projection_on_X_Y_axis: {lx + ly:.4f}
    base_frame_id: {base}
    odom_frame_id: odom
''')
    if kind == 'ackermann':
        steer_j = [j for j in servos if re.search(r'steer', j['name'])]
        steer = [j['name'] for j in steer_j]
        right_first = lambda js: [j['name'] for j in sorted(js, key=lambda j: j['xyz'][1])]  # noqa: E731
        span = lambda js: (max(j['xyz'][1] for j in js) - min(j['xyz'][1] for j in js)) if len(js) > 1 else 0.2  # noqa: E731
        wheelbase = (sum(j['xyz'][0] for j in steer_j) / len(steer_j) - sum(j['xyz'][0] for j in motors) / len(motors)) if steer_j and motors else 0.3
        r = (wheel_radius(links, motors[0]['child']) if motors else None) or 0.05
        ctl['ackermann_steering_controller'] = 'ackermann_steering_controller/AckermannSteeringController'
        body.append(f'''ackermann_steering_controller:
  ros__parameters:
    reference_timeout: 0.5
    front_steering: true
    open_loop: false
    velocity_rolling_window_size: 10
    position_feedback: true
    base_frame_id: {base}
    odom_frame_id: odom
    traction_joints_names: {right_first(motors)}
    steering_joints_names: {right_first(steer_j)}
    wheelbase: {abs(wheelbase):.4f}
    traction_track_width: {span(motors):.4f}
    steering_track_width: {span(steer_j):.4f}
    traction_wheels_radius: {r:.4f}
''')
        servos = [j for j in servos if j['name'] not in steer]
    if servos:
        ctl['joint_trajectory_controller'] = 'joint_trajectory_controller/JointTrajectoryController'
        body.append('joint_trajectory_controller:\n  ros__parameters:\n    joints:\n' + ''.join(f'      - {j["name"]}\n' for j in servos) +
                    '    command_interfaces: [position]\n    state_interfaces: [position, velocity]\n    allow_partial_joints_goal: false\n'
                    '    constraints:\n      stopped_velocity_tolerance: 0.05\n      goal_time: 0.0\n')
    head = 'controller_manager:\n  ros__parameters:\n    update_rate: 100\n' + ''.join(f'    {k}:\n      type: {v}\n' for k, v in ctl.items())
    return f'# {name}: ros2_control controllers. Generated by ros2lab_robot_setup.\n' + head + '\n' + '\n'.join(body)


def firmware_config(name, plan_, board, imu, wifi, wifi_pass=None):
    P = PINS[board]
    lines = [f'// robot_config.h for {name} ({board}): generated by ros2lab_robot_setup. Check every pin against your wiring.',
             '#pragma once', '#include "bridge_core.h"', '#include "actuators.h"', '#include "imu.h"', '',
             f'#define ROBOT_ID "{name}"', f'#define BRIDGE_BAUD {P["baud"]}']
    if wifi and board == 'esp32':
        lines += ['#define WIFI_AP                     // the robot makes its own Wi-Fi; remove for the lab network', f'#define WIFI_SSID "{name}_robot"',
                  f'#define WIFI_PASS "{wifi_pass or new_password()}"   // made for this robot; the Jetson joins with it', '#define UDP_PORT 8888']
    lines.append('')
    servos = [p for p in plan_ if p['actuator'] == 'servo']
    sts = [p for p in plan_ if p['actuator'] == 'sts']
    if any(p.get('pca') for p in servos):
        lines.append('static bridge::Pca9685 pca0(0x40), pca1(0x41);')
    if sts:
        lines.append(f'static bridge::StsBus sts({P["sts"]["port"]});   // Feetech STS3215 bus, 1 Mbit/s')
    if any(p['actuator'] == 'motor' for p in plan_):
        lines.append(f'static const bridge::MotorTuning MOTOR = {{{DEFAULT_MOTOR["counts_per_rev"]}f, {DEFAULT_MOTOR["kp"]}f, {DEFAULT_MOTOR["ki"]}f, '
                     f'{DEFAULT_MOTOR["kd"]}f, {DEFAULT_MOTOR["max_vel"]}f, false, false}};   // counts/rev, kp, ki, kd, max rad/s, position mode, invert')
    lines.append('')
    lines.append('static void robot_setup(bridge::Actuator ** a, uint8_t & n, bridge::Imu *& imu)')
    lines.append('{')
    if any(p.get('pca') for p in servos):
        lines.append('  pca0.begin();' + ('\n  pca1.begin();' if any((p.get('channel') or 0) >= 16 for p in servos) else ''))
    if sts:
        lines.append(f'  sts.begin({P["sts"]["rx"]}, {P["sts"]["tx"]});')
    lines.append('  n = 0;')
    for p in plan_:
        j = p['joint']
        if p['actuator'] == 'sts':
            var = re.sub(r'\W', '_', j['name'])
            lo, hi = j['lower'], j['upper']
            lines.append(f'  static bridge::StsServo s_{var}(sts, {p["bus_id"]}, 2048, 1, {lo:.3f}f, {hi:.3f}f);   // {j["name"]}: '
                         'raw 2048 = 0 rad; calibrate the offset per servo')
            lines.append(f'  a[n++] = &s_{var};')
        elif p['actuator'] == 'motor':
            m = p['pins']
            pins = f'{{bridge::Driver::{m["driver"]}, {m["pwm"]}, {m["b"]}, {m["c"]}, {m["ea"]}, {m["eb"]}}}'
            lines.append(f'  static bridge::DcMotor m{p["index"]}({p["index"]}, {pins}, MOTOR);   // {j["name"]}')
            lines.append(f'  a[n++] = &m{p["index"]};')
        elif p['actuator'] == 'servo':
            half = DEFAULT_SERVO['travel'] / 2   # a joint cannot go past the servo's own travel
            lo, hi = max(j['lower'], -half), min(j['upper'], half)
            rng = (f'{{{DEFAULT_SERVO["us_min"]}, {DEFAULT_SERVO["us_max"]}, {DEFAULT_SERVO["travel"]:.4f}f, {lo:.3f}f, {hi:.3f}f, '
                   f'{DEFAULT_SERVO["max_speed"]}f, false, 0.0f}}')
            init = 0.0 if lo <= 0 <= hi else (lo + hi) / 2
            var = re.sub(r'\W', '_', j['name'])
            if p['pca']:
                board_ = 'pca0' if p['channel'] < 16 else 'pca1'
                lines.append(f'  static bridge::ServoPca9685 s_{var}({board_}, {p["channel"] % 16}, {rng}, {init:.3f}f);   // {j["name"]}')
            else:
                lines.append(f'  static bridge::ServoPwm s_{var}({p["pin"]}, {rng}, {init:.3f}f);   // {j["name"]}')
            lines.append(f'  a[n++] = &s_{var};')
    if imu:
        lines.append('  static bridge::Mpu6050 mpu;   // or bridge::Bno055 bno; (I2C)')
        lines.append('  imu = &mpu;')
    else:
        lines.append('  imu = 0;   // no IMU on this board (add one: --imu)')
    lines.append('}')
    lines.append('')
    return '\n'.join(lines)


def new_password():
    return 'r2l-' + secrets.token_urlsafe(9)


def i2c_note(plan_, i2c, imu):
    parts = (['PCA9685 servo board(s) (0x40, 0x41)'] if any(p.get('pca') for p in plan_) else []) + \
        (['IMU (MPU-6050 0x68 or BNO055 0x28)'] if imu else [])
    return f'I2C ({i2c}): {", ".join(parts)}.\n' if parts else ''


def sts_note(plan_, board):
    if not any(p['actuator'] == 'sts' for p in plan_):
        return ''
    b = PINS[board]['sts']
    return (f'Feetech bus: board {b["port"]} (RX {b["rx"]}, TX {b["tx"]}) to a half-duplex bus-servo adapter (Waveshare Bus Servo '
            'Adapter or the Feetech FE-URT-1 in TTL mode), 1 Mbit/s; servo supply 7.4 V (or 12 V for the 12 V STS3215). '
            'Give every servo its ID first (Feetech FD software, one servo on the bus at a time), then set each offset so '
            'that the URDF zero pose reads 0 rad.\n')


def wiring_md(name, plan_, board, imu):
    rows = []
    for p in plan_:
        j = p['joint']['name']
        if p['actuator'] == 'motor':
            m = p['pins']
            rows.append(f'| {j} | DC motor + encoder ({m["driver"]}) | PWM {m["pwm"]}, IN1 {m["b"]}, IN2 {m["c"]} | encoder A {m["ea"]}, B {m["eb"]} |')
        elif p['actuator'] == 'sts':
            rows.append(f'| {j} | Feetech STS3215 bus servo | bus ID {p["bus_id"]} | position + speed (bus) |')
        elif p['actuator'] == 'passive':
            rows.append(f'| {j} | none (rolls freely) | - | - |')
        elif p['pca']:
            rows.append(f'| {j} | servo | PCA9685 {"0x40" if p["channel"] < 16 else "0x41"} channel {p["channel"] % 16} | - |')
        else:
            rows.append(f'| {j} | servo | pin {p["pin"]} | - |')
    i2c = 'SDA 21, SCL 22' if board == 'esp32' else 'SDA 20, SCL 21'
    return f'''# {name}: wiring ({board})

| Joint | Actuator | Output | Feedback |
|---|---|---|---|
{chr(10).join(rows)}

{i2c_note(plan_, i2c, imu)}{sts_note(plan_, board)}
Power: servos and motors from their own battery / regulator (never from the board's 5 V pin); connect all grounds.
Joint order = the order of the <ros2_control> block = the order in robot_config.h. Do not reorder one without the other.
'''


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--urdf', help='a .urdf or .urdf.xacro file')
    src.add_argument('--package', help='a description package (its urdf/ folder)')
    ap.add_argument('--type', required=True, choices=TYPES)
    ap.add_argument('--board', default='esp32', choices=sorted(PINS))
    ap.add_argument('--servo', default='pwm', choices=('pwm', 'sts'),
                    help='pwm: hobby servos (PCA9685 or board pins); sts: Feetech STS3215 serial bus servos')
    ap.add_argument('--sts-ids', default='', help='bus IDs, e.g. shoulder_pan=1,shoulder_lift=2 (default: 1, 2, ... in joint order)')
    ap.add_argument('--imu', action='store_true', help='the board has an IMU (MPU-6050 / BNO055)')
    ap.add_argument('--wifi', action='store_true', help='ESP32: talk over Wi-Fi (UDP) as well as USB')
    ap.add_argument('--wifi-pass', help='ESP32 Wi-Fi password (default: a new random one)')
    ap.add_argument('--name', help='robot id (default: the URDF robot name)')
    ap.add_argument('--out', help='output folder')
    a = ap.parse_args()
    urdf = load_urdf(a)
    robot, joints, links, base = parse(urdf)
    name = a.name or robot
    try:
        ids = {k.strip(): int(v) for k, v in (x.split('=') for x in a.sts_ids.split(',') if x.strip())}
    except ValueError:
        sys.exit('--sts-ids: use joint=id pairs, e.g. shoulder_pan=1,shoulder_lift=2')
    plan_ = plan(name, joints, links, a.type, a.board, a.servo, ids)
    out = a.out or f'ros2lab_{name}'
    os.makedirs(out, exist_ok=True)
    files = {f'{name}.ros2_control.xacro': ros2_control_xacro(name, plan_, a.imu, a.board),
             'controllers.yaml': controllers_yaml(name, a.type, plan_, links, a.imu, base),
             'robot_config.h': firmware_config(name, plan_, a.board, a.imu, a.wifi, a.wifi_pass),
             'WIRING.md': wiring_md(name, plan_, a.board, a.imu)}
    for f, text in files.items():
        with open(os.path.join(out, f), 'w', encoding='utf-8') as fh:
            fh.write(text)
    print(f'{name}: {sum(p["actuator"] == "motor" for p in plan_)} DC motors, {sum(p["actuator"] in ("servo", "sts") for p in plan_)} servos'
          f'{", %d passive joints" % sum(p["actuator"] == "passive" for p in plan_) if any(p["actuator"] == "passive" for p in plan_) else ""} -> {out}/')
    for f in files:
        print(f'  {f}')


if __name__ == '__main__':
    main()
