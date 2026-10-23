#!/usr/bin/env python3
"""Night 1, Part 3.1: run a TurtleBot3 physics case of parity/scripts/physics/run_case.py on REAL Gazebo, recording through
ROS 2 instead of gz-transport's Python binding (python3-gz-transport13 is not installed on this PC and needs sudo).

Per run: own GZ_PARTITION, ROS_DOMAIN_ID 50. `gz sim -s -v 4 <world>` starts PAUSED; ros_gz_bridge maps
  /clock (gz.msgs.Clock -> rosgraph_msgs/Clock), /model/<m>/pose (gz.msgs.Pose_V -> tf2_msgs/TFMessage, PosePublisher),
  /odom (gz.msgs.Odometry -> nav_msgs/Odometry) and /cmd_vel (geometry_msgs/Twist -> gz.msgs.Twist);
this script's rclpy node records them and publishes the case's commands on /cmd_vel once /clock reaches their time;
the world is unpaused through /world/<w>/control (`gz service`) once the node hears /clock.
Output = run_case.py's format: <out>/<case>/run<k>/model__<m>__pose.csv.gz (rx_sim_t,sim_t,name,x,y,z,qx,qy,qz,qw;
sim_t = 0 because Harmonic's PosePublisher leaves the stamp at 0, so analysis uses rx_sim_t = last /clock heard) and
odom.csv (header stamp = sim time). Through the bridge a message arrives a few ms of wall time late (sim time at RTF 1).
Usage: ros_case.py <case> [--runs N] [--out parity/fixtures/tb3_jazzy_v3/physics]
"""
import argparse, gzip, importlib.util, json, os, shutil, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
spec = importlib.util.spec_from_file_location('run_case', os.path.join(REPO, 'parity/scripts/physics/run_case.py'))
RC = importlib.util.module_from_spec(spec); spec.loader.exec_module(RC)
DOMAIN = '50'

RECORDER = r'''
import csv, gzip, json, os, sys, time
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from rosgraph_msgs.msg import Clock
from tf2_msgs.msg import TFMessage
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist
out, until, models, cmds = sys.argv[1], float(sys.argv[2]), json.loads(sys.argv[3]), json.loads(sys.argv[4])
rclpy.init()
n = Node('ros2lab_night1_recorder')
q = QoSProfile(depth=1000, reliability=ReliabilityPolicy.RELIABLE, history=HistoryPolicy.KEEP_LAST)
sim = [None]
rows = {m: [] for m in models}; odom = []
def on_clock(m): sim[0] = m.clock.sec + m.clock.nanosec * 1e-9
n.create_subscription(Clock, '/clock', on_clock, q)
def on_pose(model):
    def f(m):
        for t in m.transforms:
            st = t.header.stamp.sec + t.header.stamp.nanosec * 1e-9
            r, tr = t.transform.rotation, t.transform.translation
            rows[model].append((sim[0] if sim[0] is not None else 0.0, st, t.child_frame_id, tr.x, tr.y, tr.z, r.x, r.y, r.z, r.w))
    return f
for m in models: n.create_subscription(TFMessage, f'/model/{m}/pose', on_pose(m), q)
def on_odom(m):
    p, o, v, w = m.pose.pose.position, m.pose.pose.orientation, m.twist.twist.linear, m.twist.twist.angular
    odom.append((sim[0] if sim[0] is not None else 0.0, m.header.stamp.sec + m.header.stamp.nanosec * 1e-9, m.header.frame_id, m.child_frame_id, p.x, p.y, p.z, o.x, o.y, o.z, o.w, v.x, v.y, v.z, w.x, w.y, w.z))
n.create_subscription(Odometry, '/odom', on_odom, q)
pub = n.create_publisher(Twist, '/cmd_vel', 10)
sent = []
t0 = time.time()
while sim[0] is None and time.time() - t0 < 60: rclpy.spin_once(n, timeout_sec=0.05)
open(os.path.join(out, 'recorder_ready'), 'w').write('clock heard\n')
t0 = time.time()
while (sim[0] or 0.0) < until and time.time() - t0 < until * 4 + 60:
    rclpy.spin_once(n, timeout_sec=0.002)
    for i, c in enumerate(cmds):
        if i not in sent and (sim[0] or 0.0) >= c['t']:
            msg = Twist(); msg.linear.x = c['vx']; msg.angular.z = c['wz']
            for _ in range(3): pub.publish(msg)
            sent.append(i); print(json.dumps(dict(sent_cmd=c, at_sim=sim[0], wall=time.time())), flush=True)
for m, rs in rows.items():
    with gzip.open(os.path.join(out, f'model__{m}__pose.csv.gz'), 'wt') as f:
        f.write('rx_sim_t,sim_t,name,x,y,z,qx,qy,qz,qw\n')
        for r in rs: f.write('%.6f,%.6f,%s,%.9f,%.9f,%.9f,%.9f,%.9f,%.9f,%.9f\n' % r)
with open(os.path.join(out, 'odom.csv'), 'w') as f:
    f.write('rx_sim_t,sim_t,frame_id,child_frame_id,x,y,z,qx,qy,qz,qw,vx,vy,vz,wx,wy,wz\n')
    for r in odom: f.write('%.6f,%.6f,%s,%s,' % r[:4] + ','.join('%.9f' % x for x in r[4:]) + '\n')
print(json.dumps(dict(done=True, sim=sim[0], pose_rows={m: len(r) for m, r in rows.items()}, odom_rows=len(odom))), flush=True)
os._exit(0)
'''


def run_once(case, k, cfg, root_out):
    world = cfg['world']
    out = os.path.join(root_out, f'run{k}')
    if os.path.exists(out): shutil.rmtree(out)
    os.makedirs(out)
    env = RC.env_for(f'n1_{case}_{k}_{os.getpid()}')
    env['ROS_DOMAIN_ID'] = DOMAIN
    models = [s.split('/')[2] for s in cfg.get('subs', []) if s.endswith(':pose_v')]
    cmds = []
    for c in cfg.get('cmds', []):
        d = json.loads(c)
        if d.get('type') != 'Twist': raise SystemExit(f'{case}: only Twist commands are supported here')
        vx = float(d['msg'].split('linear { x: ')[1].split(' ')[0]) if 'linear { x:' in d['msg'] else 0.0
        wz = float(d['msg'].split('angular { z: ')[1].split(' ')[0]) if 'angular { z:' in d['msg'] else 0.0
        cmds.append(dict(t=d['t'], vx=vx, wz=wz))
    procs = []
    sp = lambda cmd, log: procs.append(subprocess.Popen(cmd, env=env, stdout=open(os.path.join(out, log), 'w'), stderr=subprocess.STDOUT, start_new_session=True)) or procs[-1]
    srv = sp(['gz', 'sim', '-s', '-v', '4', os.path.join(RC.WORLDS, f'{world}.sdf')], 'server.log')
    bargs = ['/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock', '/odom@nav_msgs/msg/Odometry[gz.msgs.Odometry', '/cmd_vel@geometry_msgs/msg/Twist]gz.msgs.Twist']
    bargs += [f'/model/{m}/pose@tf2_msgs/msg/TFMessage[gz.msgs.Pose_V' for m in models]
    sp(['ros2', 'run', 'ros_gz_bridge', 'parameter_bridge'] + bargs, 'bridge.log')
    rec = sp([sys.executable, '-c', RECORDER, out, str(cfg['until']), json.dumps(models), json.dumps(cmds)], 'recorder.txt')
    RC.wait_file(os.path.join(out, 'recorder_ready'), 60)
    time.sleep(1.0)
    r = RC.gz(['service', '-s', f'/world/{world}/control', '--reqtype', 'gz.msgs.WorldControl', '--reptype', 'gz.msgs.Boolean',
               '--timeout', '5000', '--req', 'pause: false'], env, 15)
    unpause = (r.stdout or '').strip() + (r.stderr or '').strip()
    w0 = time.time()
    try: rec.wait(timeout=cfg['until'] * 4 + 90)
    except subprocess.TimeoutExpired: os.killpg(rec.pid, signal.SIGKILL)
    wall = time.time() - w0
    for p in procs:
        try: os.killpg(p.pid, signal.SIGTERM)
        except ProcessLookupError: pass
    time.sleep(2)
    for p in procs:
        try: os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError: pass
    ex = [l for l in open(os.path.join(out, 'server.log'), errors='replace') if any(k in l for k in ('Loaded [gz::physics', 'Error', 'Warn', 'Err]'))]
    open(os.path.join(out, 'server_excerpt.txt'), 'w').writelines(ex[:60])
    meta = dict(case=case, run=k, world=world, until=cfg['until'], recorder='ROS 2 (ros_gz_bridge + rclpy), ros_case.py', ros_domain_id=DOMAIN,
                unpause_reply=unpause, wall_seconds_after_unpause=round(wall, 2), commands=cmds)
    json.dump(meta, open(os.path.join(out, 'run_meta.json'), 'w'), indent=1)
    return meta


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('case'); ap.add_argument('--runs', type=int, default=3)
    ap.add_argument('--out', default=os.path.join(REPO, 'parity/fixtures/tb3_jazzy_v3/physics'))
    a = ap.parse_args()
    cfg = RC.CASES[a.case]
    root = os.path.join(a.out, a.case); os.makedirs(root, exist_ok=True)
    json.dump(dict(cfg, case=a.case), open(os.path.join(root, 'case.json'), 'w'), indent=1)
    shutil.copy(os.path.join(RC.WORLDS, f"{cfg['world']}.sdf"), os.path.join(root, 'world.sdf'))
    for k in range(1, a.runs + 1):
        m = run_once(a.case, k, cfg, root)
        print(f"{a.case} run{k}: wall {m['wall_seconds_after_unpause']} s, unpause '{m['unpause_reply']}'", flush=True)


if __name__ == '__main__':
    main()
