#!/usr/bin/env python3
"""
moveit_capture.py - M1 MoveIt 2 ground truth through the real move_group (/move_action), one arm.

Reads the SRDF and URDF that move_group itself holds (parameters robot_description_semantic / robot_description),
writes srdf_summary.yaml (planning groups with their joints, end effectors, named states) and the URDF joint limits,
then runs MoveGroup goals and saves, per run, runs/<name>/result.json:
  error_code (MoveItErrorCodes value and name), planning_time, planned trajectory (joint names, number of points,
  time_from_start of the last point), /joint_states before and after, wall time of send and result;
and runs/<name>/move_group_lines.txt: the lines of --log stamped between send - 1 s and result + 2 s (wall).
Successful runs (plan + execute): every named state of --group, one joint goal (first joint +0.3 rad from the current
state, inside its limits), one pose goal (--ee-link 0.05 m lower than now, orientation kept).
Failure runs: unreachable pose (10 m away), joint goal outside the joint limits (upper + 0.5 rad), a goal colliding
with a box added through /apply_planning_scene, a wrong planning group name, and execution with the arm controller
deactivated (controller_manager/switch_controller; reactivated afterwards).
OMPL is random: only codes, states, counts and durations are recorded, never paths. Nothing is estimated.
Usage: moveit_capture.py --out DIR --group G --ee-link L --controller C [--log FILE] [--velocity-scaling 0.5]
"""
import argparse
import json
import math
import os
import time
import xml.etree.ElementTree as ET

import rclpy
from controller_manager_msgs.srv import SwitchController
from geometry_msgs.msg import Pose, PoseStamped
from moveit_msgs.action import MoveGroup
from moveit_msgs.msg import (CollisionObject, Constraints, JointConstraint, MoveItErrorCodes, OrientationConstraint,
                             PlanningScene, PositionConstraint, RobotState)
from moveit_msgs.srv import ApplyPlanningScene, GetPositionFK
from rcl_interfaces.msg import ParameterType
from rcl_interfaces.srv import GetParameters, ListParameters
from rclpy.action import ActionClient
from rclpy.node import Node
from sensor_msgs.msg import JointState
from shape_msgs.msg import SolidPrimitive

CODES = {v: k for k, v in MoveItErrorCodes.__dict__.items() if k.isupper() and isinstance(v, int)}


class Cap(Node):
    def __init__(self, a):
        super().__init__('parity_moveit_capture')
        self.a = a
        self.js = None
        self.create_subscription(JointState, '/joint_states', lambda m: setattr(self, 'js', m), 10)
        self.ac = ActionClient(self, MoveGroup, '/move_action')

    def spin_until(self, pred, secs):
        t0 = time.time()
        while time.time() - t0 < secs:
            rclpy.spin_once(self, timeout_sec=0.05)
            if pred():
                return True
        return pred()

    def call(self, cli, req, secs=30.0):
        if not cli.wait_for_service(timeout_sec=secs):
            return None
        f = cli.call_async(req)
        self.spin_until(f.done, secs)
        return f.result() if f.done() else None

    def param(self, node, name):
        r = self.call(self.create_client(GetParameters, f'{node}/get_parameters'), GetParameters.Request(names=[name]))
        return r.values[0].string_value if r and r.values else ''

    def dump_params(self, node):
        """All parameters of a node through its ListParameters / GetParameters services (ros2 param dump returned {}
        for /move_group on this machine). Values as Python types; byte arrays as lists."""
        lr = self.call(self.create_client(ListParameters, f'{node}/list_parameters'), ListParameters.Request(depth=0), 60)
        names = list(lr.result.names) if lr else []
        out = {}
        cli = self.create_client(GetParameters, f'{node}/get_parameters')
        F = {ParameterType.PARAMETER_BOOL: 'bool_value', ParameterType.PARAMETER_INTEGER: 'integer_value',
             ParameterType.PARAMETER_DOUBLE: 'double_value', ParameterType.PARAMETER_STRING: 'string_value',
             ParameterType.PARAMETER_BYTE_ARRAY: 'byte_array_value', ParameterType.PARAMETER_BOOL_ARRAY: 'bool_array_value',
             ParameterType.PARAMETER_INTEGER_ARRAY: 'integer_array_value', ParameterType.PARAMETER_DOUBLE_ARRAY: 'double_array_value',
             ParameterType.PARAMETER_STRING_ARRAY: 'string_array_value'}
        for i in range(0, len(names), 50):
            chunk = names[i:i + 50]
            r = self.call(cli, GetParameters.Request(names=chunk), 60)
            for nm, v in zip(chunk, r.values if r else []):
                f = F.get(v.type)
                val = getattr(v, f) if f else None
                out[nm] = list(val) if isinstance(val, (list, tuple)) or (f and f.endswith('array_value')) else val
        return out

    def latched(self, topic, secs=30.0):
        """One message of a transient_local std_msgs/String topic (robot_description, robot_description_semantic)."""
        from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
        from std_msgs.msg import String
        box = []
        q = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL, reliability=ReliabilityPolicy.RELIABLE)
        sub = self.create_subscription(String, topic, lambda m: box.append(m.data), q)
        self.spin_until(lambda: bool(box), secs)
        self.destroy_subscription(sub)
        return box[0] if box else ''

    def joints_now(self):
        self.js = None
        self.spin_until(lambda: self.js is not None, 10)
        return dict(zip(self.js.name, self.js.position)) if self.js else {}

    def fk(self, link, joints):
        req = GetPositionFK.Request()
        req.header.frame_id = self.frame
        req.fk_link_names = [link]
        req.robot_state.joint_state.name = list(joints)
        req.robot_state.joint_state.position = [float(v) for v in joints.values()]
        r = self.call(self.create_client(GetPositionFK, '/compute_fk'), req)
        return r.pose_stamped[0] if r and r.pose_stamped else None

    def scene(self, objs):
        ps = PlanningScene(is_diff=True)
        ps.world.collision_objects = objs
        r = self.call(self.create_client(ApplyPlanningScene, '/apply_planning_scene'), ApplyPlanningScene.Request(scene=ps))
        return bool(r and r.success)

    def switch(self, activate, deactivate):
        req = SwitchController.Request(activate_controllers=activate, deactivate_controllers=deactivate,
                                       strictness=SwitchController.Request.STRICT)
        r = self.call(self.create_client(SwitchController, '/controller_manager/switch_controller'), req)
        return bool(r and r.ok)

    def goal(self, group, joints=None, pose=None, plan_only=False):
        g = MoveGroup.Goal()
        r = g.request
        r.group_name = group
        r.num_planning_attempts = 1
        r.allowed_planning_time = 5.0
        r.max_velocity_scaling_factor = self.a.velocity_scaling
        r.max_acceleration_scaling_factor = self.a.velocity_scaling
        r.start_state.is_diff = True
        c = Constraints()
        for j, v in (joints or {}).items():
            c.joint_constraints.append(JointConstraint(joint_name=j, position=float(v), tolerance_above=0.001,
                                                       tolerance_below=0.001, weight=1.0))
        if pose is not None:
            pc = PositionConstraint(link_name=self.a.ee_link, weight=1.0)
            pc.header.frame_id = pose.header.frame_id
            box = SolidPrimitive(type=SolidPrimitive.SPHERE, dimensions=[0.005])
            pc.constraint_region.primitives.append(box)
            pc.constraint_region.primitive_poses.append(pose.pose)
            oc = OrientationConstraint(link_name=self.a.ee_link, orientation=pose.pose.orientation, weight=1.0,
                                       absolute_x_axis_tolerance=0.01, absolute_y_axis_tolerance=0.01,
                                       absolute_z_axis_tolerance=0.01)
            oc.header.frame_id = pose.header.frame_id
            c.position_constraints.append(pc)
            c.orientation_constraints.append(oc)
        r.goal_constraints.append(c)
        g.planning_options.plan_only = plan_only
        return g

    def run(self, name, goal, note=''):
        d = os.path.join(self.a.out, 'runs', name)
        os.makedirs(d, exist_ok=True)
        before = self.joints_now()
        res = {'name': name, 'note': note, 'group': goal.request.group_name, 'plan_only': goal.planning_options.plan_only,
               'velocity_scaling': goal.request.max_velocity_scaling_factor,
               'goal_joints': {c.joint_name: c.position for c in goal.request.goal_constraints[0].joint_constraints},
               'goal_pose': None, 'joint_states_before': before}
        if goal.request.goal_constraints[0].position_constraints:
            p = goal.request.goal_constraints[0].position_constraints[0]
            pp, q = p.constraint_region.primitive_poses[0], goal.request.goal_constraints[0].orientation_constraints[0].orientation
            res['goal_pose'] = {'frame': p.header.frame_id, 'link': p.link_name, 'position': [pp.position.x, pp.position.y, pp.position.z],
                                'orientation_xyzw': [q.x, q.y, q.z, q.w]}
        res['send_wall'] = time.time()
        gf = self.ac.send_goal_async(goal)
        self.spin_until(gf.done, 30)
        gh = gf.result() if gf.done() else None
        res['accepted'] = bool(gh and gh.accepted)
        if gh and gh.accepted:
            rf = gh.get_result_async()
            self.spin_until(rf.done, 120)
            if rf.done():
                rr = rf.result().result
                res['status'] = rf.result().status
                res['error_code'] = rr.error_code.val
                res['error_code_name'] = CODES.get(rr.error_code.val, '?')
                res['error_message'] = getattr(rr.error_code, 'message', '')
                res['planning_time'] = rr.planning_time
                jt = rr.planned_trajectory.joint_trajectory
                last = jt.points[-1].time_from_start if jt.points else None
                res['trajectory'] = {'joint_names': list(jt.joint_names), 'points': len(jt.points),
                                     'last_time_from_start': last.sec + last.nanosec * 1e-9 if last else None}
            else:
                res['error'] = 'no result within 120 s'
        res['result_wall'] = time.time()
        time.sleep(1.0)
        res['joint_states_after'] = self.joints_now()
        json.dump(res, open(os.path.join(d, 'result.json'), 'w'), indent=2)
        if self.a.log and os.path.exists(self.a.log):
            write_excerpt(d, res, self.a.log)
        print(f"{name}: accepted={res['accepted']} error_code={res.get('error_code')} {res.get('error_code_name', '')}"
              f" points={res.get('trajectory', {}).get('points')}", flush=True)
        return res


STAMP = __import__('re').compile(r'\[(\d{9,}\.\d+)\]')


def write_excerpt(d, res, log):
    """move_group / moveit lines of the launch log stamped send - 1 s .. result + 2 s (wall) -> move_group_lines.txt"""
    lo, hi = res['send_wall'] - 1.0, res['result_wall'] + 2.0
    out = []
    for i, l in enumerate(open(log, errors='replace'), 1):
        if '[move_group' not in l and 'moveit' not in l.lower():
            continue
        m = STAMP.search(l)
        if m and lo <= float(m.group(1)) <= hi:
            out.append(f'{i}:{l.rstrip()}')
    with open(os.path.join(d, 'move_group_lines.txt'), 'w') as f:
        f.write(f'# lines of {os.path.relpath(log)} (gitignored) with [move_group or moveit, stamped wall {lo:.3f} .. {hi:.3f}\n')
        f.write('\n'.join(out) + '\n')


def parse_srdf(text):
    root = ET.fromstring(text)
    groups = {}
    for g in root.findall('group'):
        groups[g.get('name')] = {'joints': [j.get('name') for j in g.findall('joint')],
                                 'chains': [{'base': c.get('base_link'), 'tip': c.get('tip_link')} for c in g.findall('chain')],
                                 'links': [l.get('name') for l in g.findall('link')],
                                 'subgroups': [s.get('name') for s in g.findall('group')]}
    states = [{'name': s.get('name'), 'group': s.get('group'),
               'joints': {j.get('name'): float(j.get('value').split()[0]) for j in s.findall('joint')}}
              for s in root.findall('group_state')]
    ees = [{'name': e.get('name'), 'parent_link': e.get('parent_link'), 'group': e.get('group'),
            'parent_group': e.get('parent_group')} for e in root.findall('end_effector')]
    vj = [{'name': v.get('name'), 'type': v.get('type'), 'parent': v.get('parent_frame'), 'child': v.get('child_link')}
          for v in root.findall('virtual_joint')]
    return {'robot': root.get('name'), 'groups': groups, 'group_states': states, 'end_effectors': ees, 'virtual_joints': vj}


def chain_joints(text, base, tip):
    """Movable joints on the URDF path base -> tip (what an SRDF <chain> group contains), in order from the base."""
    root = ET.fromstring(text)
    by_child = {j.find('child').get('link'): j for j in root.findall('joint')}
    path, link = [], tip
    while link != base and link in by_child:
        j = by_child[link]
        if j.get('type') in ('revolute', 'prismatic', 'continuous'):
            path.append(j.get('name'))
        link = j.find('parent').get('link')
    return list(reversed(path)) if link == base else []


def urdf_limits(text):
    root = ET.fromstring(text)
    out = {}
    for j in root.findall('joint'):
        lim = j.find('limit')
        if j.get('type') in ('revolute', 'prismatic', 'continuous') and lim is not None:
            out[j.get('name')] = {k: float(lim.get(k)) for k in ('lower', 'upper', 'velocity', 'effort') if lim.get(k) is not None}
            out[j.get('name')]['type'] = j.get('type')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--group', required=True)
    ap.add_argument('--ee-link', required=True)
    ap.add_argument('--controller', required=True)
    ap.add_argument('--log', default='')
    ap.add_argument('--velocity-scaling', type=float, default=0.5)
    ap.add_argument('--skip', default='', help='comma-separated run names to skip')
    ap.add_argument('--excerpts-only', action='store_true', help='only rewrite move_group_lines.txt of the runs in --out')
    a = ap.parse_args()
    if a.excerpts_only:
        for name in sorted(os.listdir(os.path.join(a.out, 'runs'))):
            d = os.path.join(a.out, 'runs', name)
            write_excerpt(d, json.load(open(os.path.join(d, 'result.json'))), a.log)
        return 0
    os.makedirs(a.out, exist_ok=True)
    rclpy.init()
    n = Cap(a)
    skip = set(filter(None, a.skip.split(',')))
    srdf, urdf = n.param('/move_group', 'robot_description_semantic'), n.param('/move_group', 'robot_description')
    src = 'parameters robot_description_semantic / robot_description of /move_group'
    if not srdf or not urdf:   # move_group also publishes both on latched topics
        srdf, urdf = n.latched('/robot_description_semantic'), n.latched('/robot_description')
        src = 'latched topics /robot_description_semantic and /robot_description'
    print(f'SRDF/URDF from {src}', flush=True)
    if not srdf or not urdf:
        print('ERROR: /move_group has no robot_description_semantic / robot_description parameter')
        return 2
    P = n.dump_params('/move_group')
    P = {k: (v if not (isinstance(v, str) and len(v) > 2000) else f'<{len(v)} characters, see srdf_summary.yaml / the source package>') for k, v in P.items()}
    import yaml as _y
    _y.safe_dump({'source': 'rclpy ListParameters + GetParameters on /move_group', 'count': len(P), 'parameters': P},
                 open(os.path.join(a.out, 'move_group_params_rclpy.yaml'), 'w'), sort_keys=True)
    print(f'/move_group parameters: {len(P)}', flush=True)
    S = parse_srdf(srdf)
    L = urdf_limits(urdf)
    n.frame = next((v['parent'] for v in S['virtual_joints']), None) or ''   # empty: move_group answers in its model frame
    import yaml
    yaml.safe_dump({'source': src, **S},
                   open(os.path.join(a.out, 'srdf_summary.yaml'), 'w'), sort_keys=False)
    yaml.safe_dump(L, open(os.path.join(a.out, 'urdf_joint_limits.yaml'), 'w'), sort_keys=True)
    if not n.ac.wait_for_server(timeout_sec=60):
        print('ERROR: /move_action not available')
        return 2
    G = S['groups'].get(a.group, {})
    gj = [j for j in G.get('joints', []) if j in L]
    for c in G.get('chains', []):
        gj += [j for j in chain_joints(urdf, c['base'], c['tip']) if j not in gj]
    if not gj:
        print(f'ERROR: no joints found for group {a.group}')
        return 2
    print(f'group {a.group} joints {gj}; frame {n.frame}', flush=True)
    # successful runs
    for st in [s for s in S['group_states'] if s['group'] == a.group]:
        if f"state_{st['name']}" not in skip:
            n.run(f"state_{st['name']}", n.goal(a.group, joints=st['joints']), 'named state from the SRDF, plan + execute')
    cur = n.joints_now()
    j0 = gj[0]
    tgt = {j: cur[j] for j in gj}
    tgt[j0] = cur[j0] + 0.3
    if 'upper' in L[j0] and tgt[j0] > L[j0]['upper']:
        tgt[j0] = cur[j0] - 0.3
    n.run('joint_goal', n.goal(a.group, joints=tgt), f'{j0} {cur[j0]:+.4f} -> {tgt[j0]:+.4f}, others held, plan + execute')
    cur = n.joints_now()
    ps = n.fk(a.ee_link, {j: cur[j] for j in cur})
    if ps:
        ps.pose.position.z -= 0.05
        n.run('pose_goal', n.goal(a.group, pose=ps), f'{a.ee_link} 0.05 m lower than the current pose, orientation kept')
        far = PoseStamped()
        far.header = ps.header
        far.pose = Pose()
        far.pose.position.x, far.pose.position.y, far.pose.position.z = ps.pose.position.x + 10.0, ps.pose.position.y, ps.pose.position.z
        far.pose.orientation = ps.pose.orientation
        n.run('fail_unreachable_pose', n.goal(a.group, pose=far), f'{a.ee_link} 10 m beyond the current pose in x')
    else:
        print('compute_fk failed: pose_goal and fail_unreachable_pose not run', flush=True)
    cur = n.joints_now()
    bad = {j: cur[j] for j in gj}
    if 'upper' in L[j0]:
        bad[j0] = L[j0]['upper'] + 0.5
        n.run('fail_joint_outside_limits', n.goal(a.group, joints=bad, plan_only=True),
              f'{j0} = URDF upper limit {L[j0]["upper"]} + 0.5 rad, plan only (MoveIt may clamp it to the bound)')
    states = [s for s in S['group_states'] if s['group'] == a.group]

    def reset(tag):   # back to the first named state, so a failure case starts from a valid state
        if states:
            n.run(f'reset_{tag}', n.goal(a.group, joints=states[0]['joints']), f"back to named state {states[0]['name']}")
    reset('before_collision')
    cur = n.joints_now()
    # collision: a box around the end effector position of a joint goal, then plan to that goal
    tgt2 = {j: cur[j] for j in gj}
    tgt2[j0] = cur[j0] + 0.4 if not ('upper' in L[j0] and cur[j0] + 0.4 > L[j0]['upper']) else cur[j0] - 0.4
    pe = n.fk(a.ee_link, {**cur, **tgt2})
    if pe:
        box = CollisionObject(id='parity_box', operation=CollisionObject.ADD)
        box.header = pe.header
        box.primitives.append(SolidPrimitive(type=SolidPrimitive.BOX, dimensions=[0.2, 0.2, 0.2]))
        box.primitive_poses.append(pe.pose)
        added = n.scene([box])
        r = n.run('fail_goal_in_collision', n.goal(a.group, joints=tgt2),
                  f'box 0.2 m around {a.ee_link} at the goal, added through /apply_planning_scene (success={added})')
        n.scene([CollisionObject(id='parity_box', operation=CollisionObject.REMOVE, header=pe.header)])
    reset('before_wrong_group')
    cur = n.joints_now()
    n.run('fail_wrong_group', n.goal('parity_no_such_group', joints={j: cur[j] for j in gj}), 'group name that the SRDF does not have')
    reset('before_controller_inactive')
    off = n.switch([], [a.controller])
    cur = n.joints_now()
    tgt3 = {j: cur[j] for j in gj}
    tgt3[j0] = cur[j0] + 0.2 if not ('upper' in L[j0] and cur[j0] + 0.2 > L[j0]['upper']) else cur[j0] - 0.2
    n.run('fail_controller_inactive', n.goal(a.group, joints=tgt3), f'{a.controller} deactivated with switch_controller (ok={off})')
    on = n.switch([a.controller], [])
    print(f'controller {a.controller} reactivated: {on}', flush=True)
    n.destroy_node()
    rclpy.shutdown()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
