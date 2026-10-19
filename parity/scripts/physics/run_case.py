#!/usr/bin/env python3
"""Run one physics baseline case on REAL Gazebo Harmonic, N times, into parity/fixtures/physics/<case>/run<k>/.

Each run: own GZ_PARTITION, ROS_DOMAIN_ID=50 (so stop_reference.sh 50 finds every process), recorder first,
then `gz sim -s -v 4 <world>` started PAUSED, unpaused through /world/<w>/control once the recorder sees the clock,
so no message of the first iteration is lost. The server log is kept as server.log (gitignored) and its engine /
warning / error lines are copied to server_excerpt.txt.
Usage: run_case.py <case> [--runs N]      (cases: see CASES below)
"""
import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
WORLDS = os.path.join(HERE, 'worlds')
OUT = os.path.join(REPO, 'parity', 'fixtures', 'physics')
DOMAIN = '50'


def wrench(world, link, fx=0.0, fy=0.0):
    return dict(type='EntityWrench', topic=f'/world/{world}/wrench',
                msg=f'entity {{ name: "{link}" type: LINK }} wrench {{ force {{ x: {fx} y: {fy} }} }}')


def at(t, d):
    return json.dumps(dict(d, t=t))


def poses(*models):
    return [f'/model/{m}/pose:pose_v' for m in models]


# impulse over one 1 ms step: F = m v0 / dt
CASES = {
    'drop': dict(world='drop', until=4.0, subs=poses('box') + ['/contact/box:contacts']),
    'drop_typebullet': dict(world='drop_typebullet', until=4.0, subs=poses('box') + ['/contact/box:contacts']),
    'restitution_ground1.0': dict(world='restitution_ground1.0', until=4.0,
                                  subs=poses('sphere_e0.0', 'sphere_e0.5', 'sphere_e0.9', 'sphere_e1.0')),
    'restitution_ground0.5': dict(world='restitution_ground0.5', until=4.0,
                                  subs=poses('sphere_e0.0', 'sphere_e0.5', 'sphere_e0.9', 'sphere_e1.0')),
    'collision': dict(world='collision', until=3.0, subs=poses('box_a', 'box_b'),
                      cmds=[at(0.5, wrench('collision', 'box_a::link', fx=1000.0))]),
    'pendulum': dict(world='pendulum', until=10.0, subs=poses('pend_d0', 'pend_d01', 'pend_d1', 'pend_spring') +
                     [f'/joint_state/{m}:model' for m in ('pend_d0', 'pend_d01', 'pend_d1', 'pend_spring')]),
    'noinertial': dict(world='noinertial', until=3.0, subs=poses('box_noinertial', 'box_ref'),
                       cmds=[at(1.5, wrench('noinertial', 'box_noinertial::link', fx=1000.0)),
                             at(1.5, wrench('noinertial', 'box_ref::link', fx=1000.0))],
                       model_info=('box_noinertial', 'box_ref')),
    'joint_limits': dict(world='joint_limits', until=4.0, subs=['/joint_state/arm:model'] + poses('arm'),
                         cmds=[json.dumps(dict(t=0.5, type='Double', topic='/model/arm/joint/j/cmd_force', msg='data: 5.0'))]),
    'slide_aniso': dict(world='slide_aniso', until=4.0, subs=poses('box_x', 'box_y'),
                        cmds=[at(0.5, wrench('slide_aniso', 'box_x::link', fx=2000.0)),
                              at(0.5, wrench('slide_aniso', 'box_y::link', fy=2000.0))]),
    'slide_combine': dict(world='slide_combine', until=4.0, subs=poses('box_lo', 'box_hi'),
                          cmds=[at(0.5, wrench('slide_combine', 'box_lo::link', fx=2000.0)),
                                at(0.5, wrench('slide_combine', 'box_hi::link', fx=2000.0))]),
}
for mu, until in ((0.01, 8.0), (0.1, 2.0), (0.5, 1.5), (1.0, 1.5)):
    CASES[f'slide_mu{mu}'] = dict(world=f'slide_mu{mu}', until=until, subs=poses('box'),
                                  cmds=[at(0.5, wrench(f'slide_mu{mu}', 'box::link', fx=500.0))])
for th in (10, 15, 30, 45):
    CASES[f'incline_{th}'] = dict(world=f'incline_{th}', until=2.5, subs=poses('sphere', 'cylinder', 'box_frictionless'))
# TurtleBot3 burger (installed model): step commands on /cmd_vel (gz.msgs.Twist), ground truth = model pose
TW = lambda vx=0.0, wz=0.0: json.dumps(dict(t=1.0, type='Twist', topic='/cmd_vel', msg=f'linear {{ x: {vx} }} angular {{ z: {wz} }}'))
for name, world in (('tb3_lin', 'tb3_drive'), ('tb3_lin_noacc', 'tb3_drive_noacc')):
    CASES[name] = dict(world=world, until=11.0, subs=poses('burger') + ['/odom:odom'], cmds=[TW(vx=0.2)], tb3=True)
for name, world in (('tb3_ang', 'tb3_drive'), ('tb3_ang_noacc', 'tb3_drive_noacc')):
    CASES[name] = dict(world=world, until=11.0, subs=poses('burger') + ['/odom:odom'], cmds=[TW(wz=1.0)], tb3=True)
CASES['tb3_push'] = dict(world='tb3_push', until=9.0, subs=poses('burger', 'light_box') + ['/odom:odom'], cmds=[TW(vx=0.2)], tb3=True)
for w in ('tb3_sensors_empty', 'tb3_sensors_wall'):
    CASES[w] = dict(world=w, until=62.0, subs=['/scan:scan', '/imu:imu'] + poses('burger'), tb3=True,
                    server_extra=['--headless-rendering'])
CASES['determinism'] = dict(world='determinism', until=3.0, subs=poses('base_box', 'tilted'), iterations=3000)


def env_for(part):
    e = dict(os.environ)
    e.update(ROS_DOMAIN_ID=DOMAIN, GZ_PARTITION=part, GZ_IP='127.0.0.1')
    tb3 = '/opt/ros/jazzy/share/turtlebot3_gazebo/models'
    e['GZ_SIM_RESOURCE_PATH'] = ':'.join(x for x in (tb3, os.path.join(HERE, 'models'), e.get('GZ_SIM_RESOURCE_PATH', '')) if x)
    return e


def wait_file(p, secs):
    t0 = time.time()
    while time.time() - t0 < secs:
        if os.path.exists(p):
            return True
        time.sleep(0.1)
    return False


def clock_rows(p):
    try:
        return sum(1 for _ in open(p)) - 1
    except OSError:
        return 0


def gz(args, env, timeout=10):
    try:
        return subprocess.run(['gz'] + args, env=env, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        return subprocess.CompletedProcess(e.cmd, -1, e.stdout or '', 'TIMEOUT')


def run_once(case, k, cfg, root_out):
    world = cfg['world']
    out = os.path.join(root_out, f'run{k}')
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)
    part = f'phys50_{case}_{k}_{os.getpid()}'
    env = env_for(part)
    rec_cmd = [sys.executable, os.path.join(HERE, 'record.py'), '--world', world, '--out', out, '--until', str(cfg['until']),
               '--wall-timeout', str(cfg['until'] * 4 + 60)]
    for s in cfg.get('subs', []):
        rec_cmd += ['--sub', s]
    for c in cfg.get('cmds', []):
        rec_cmd += ['--cmd', c]
    rec = subprocess.Popen(rec_cmd, env=env, stdout=open(os.path.join(out, 'recorder.txt'), 'w'), stderr=subprocess.STDOUT,
                           start_new_session=True)
    wait_file(os.path.join(out, 'recorder_ready'), 30)
    srv_cmd = ['gz', 'sim', '-s', '-v', '4'] + cfg.get('server_extra', [])
    if cfg.get('iterations'):
        srv_cmd += ['--iterations', str(cfg['iterations'])]
    srv_cmd.append(os.path.join(WORLDS, f'{world}.sdf'))
    srv = subprocess.Popen(srv_cmd, env=env, stdout=open(os.path.join(out, 'server.log'), 'w'), stderr=subprocess.STDOUT,
                           start_new_session=True)
    # paused until the recorder hears the clock
    t0 = time.time()
    while clock_rows(os.path.join(out, 'clock.csv')) < 1 and time.time() - t0 < 60:
        time.sleep(0.2)
    time.sleep(1.0)
    info = {}
    if cfg.get('model_info'):
        for m in cfg['model_info']:
            r = gz(['model', '-m', m, '-l'], env, 20)
            info[m] = (r.stdout or '') + (r.stderr or '')
    r = gz(['service', '-s', f'/world/{world}/control', '--reqtype', 'gz.msgs.WorldControl', '--reptype', 'gz.msgs.Boolean',
            '--timeout', '5000', '--req', 'pause: false'], env, 15)
    unpause = (r.stdout or '').strip() + (r.stderr or '').strip()
    wall0 = time.time()
    try:
        rec.wait(timeout=cfg['until'] * 4 + 90)
    except subprocess.TimeoutExpired:
        os.killpg(rec.pid, signal.SIGKILL)
    wall = time.time() - wall0
    if cfg.get('iterations'):
        try:
            srv.wait(timeout=60)
        except subprocess.TimeoutExpired:
            pass
    srv_exit = srv.poll()
    for p in (srv, rec):
        try:
            os.killpg(p.pid, signal.SIGTERM)
        except OSError:
            pass
    time.sleep(1.5)
    for p in (srv, rec):
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except OSError:
            pass
    log = re.sub(r'\x1b\[[0-9;]*m', '', open(os.path.join(out, 'server.log'), errors='replace').read()).splitlines()
    keep = [f'{i + 1}:{l}' for i, l in enumerate(log) if re.search(
        r'physics|engine|Physics|dart|bullet|tpe|warn|Warn|WARN|err|Err|ERR|inertia|Inertia|mass|Mass|step size|Loading|Loaded|solver|collision detector|iterations', l)]
    with open(os.path.join(out, 'server_excerpt.txt'), 'w') as f:
        f.write(f'# lines of server.log (gitignored) matching engine/warning/error keywords; <line>:<text>\n')
        f.write('\n'.join(keep[:400]) + '\n')
    meta = dict(case=case, run=k, world_file=f'parity/scripts/physics/worlds/{world}.sdf', gz_partition=part,
                ros_domain_id=DOMAIN, server_cmd=' '.join(srv_cmd), unpause_reply=unpause, wall_seconds_after_unpause=round(wall, 2),
                server_exit=srv_exit, model_info=info, date=time.strftime('%Y-%m-%dT%H:%M:%S%z'))
    with open(os.path.join(out, 'run_meta.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    os.remove(os.path.join(out, 'recorder_ready'))
    # gzip the big CSVs (1 kHz)
    for fn in os.listdir(out):
        if fn.endswith('.csv') and os.path.getsize(os.path.join(out, fn)) > 200_000:
            subprocess.run(['gzip', '-f', '-n', os.path.join(out, fn)])
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('case')
    ap.add_argument('--runs', type=int, default=3)
    a = ap.parse_args()
    cfg = CASES[a.case]
    root_out = os.path.join(OUT, a.case)
    os.makedirs(root_out, exist_ok=True)
    shutil.copy(os.path.join(WORLDS, f"{cfg['world']}.sdf"), os.path.join(root_out, 'world.sdf'))
    with open(os.path.join(root_out, 'case.json'), 'w') as f:
        json.dump(dict(cfg, case=a.case), f, indent=1)
    for k in range(1, a.runs + 1):
        m = run_once(a.case, k, cfg, root_out)
        print(f"{a.case} run{k}: wall {m['wall_seconds_after_unpause']} s, unpause '{m['unpause_reply']}', exit {m['server_exit']}", flush=True)


if __name__ == '__main__':
    main()
