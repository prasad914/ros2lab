#!/usr/bin/env python3
"""Record gz-transport topics of a running Gazebo Harmonic world to CSV, and publish timed commands.

Usage: record.py --world W --out DIR --until SIM_SECONDS [--sub TOPIC:KIND ...] [--cmd JSON ...] [--wall-timeout S]
KIND: pose_v | odom | imu | scan | contacts | model | twist
--cmd '{"t": 0.5, "topic": "/world/W/wrench", "type": "EntityWrench", "msg": "<protobuf text>"}'
      published once, when the world clock first reaches t (sim seconds).
Every CSV row carries rx_sim_t (the last world clock heard when the message arrived, +-1 step) and sim_t (the
message header stamp; 0 for PosePublisher's Pose_V in Harmonic); clock.csv has the world clock.
Stops when the world clock reaches --until, or after --wall-timeout seconds of wall time.
"""
import argparse
import json
import os
import threading
import time

from google.protobuf import text_format
from gz.msgs10 import clock_pb2, contacts_pb2, double_pb2, entity_wrench_pb2, imu_pb2, laserscan_pb2, model_pb2
from gz.msgs10 import odometry_pb2, pose_v_pb2, twist_pb2
from gz.transport13 import Node

TYPES = {'EntityWrench': entity_wrench_pb2.EntityWrench, 'Twist': twist_pb2.Twist, 'Double': double_pb2.Double}
KINDS = {'pose_v': pose_v_pb2.Pose_V, 'odom': odometry_pb2.Odometry, 'imu': imu_pb2.IMU, 'scan': laserscan_pb2.LaserScan,
         'contacts': contacts_pb2.Contacts, 'model': model_pb2.Model, 'twist': twist_pb2.Twist}


def stamp(h):
    return h.stamp.sec + h.stamp.nsec * 1e-9


def hdr_data(h):
    return {d.key: list(d.value) for d in h.data}


class Rec:
    def __init__(self, a):
        self.a = a
        os.makedirs(a.out, exist_ok=True)
        self.lock = threading.Lock()
        self.files = {}
        self.sim = 0.0
        self.done = threading.Event()
        self.cmds = sorted((json.loads(c) for c in a.cmd), key=lambda c: c['t'])
        self.sent = []
        self.node = Node()
        self.pubs = {}
        for c in self.cmds:
            if c['topic'] not in self.pubs:
                self.pubs[c['topic']] = self.node.advertise(c['topic'], TYPES[c['type']])
        self.clock_f = open(os.path.join(a.out, 'clock.csv'), 'w')
        self.clock_f.write('sim_t,real_t_wall\n')
        self.node.subscribe(clock_pb2.Clock, f'/world/{a.world}/clock', self.on_clock)
        for s in a.sub:
            topic, kind = s.rsplit(':', 1)
            name = topic.strip('/').replace('/', '__')
            f = open(os.path.join(a.out, f'{name}.csv'), 'w')
            self.files[topic] = f
            f.write('rx_sim_t,' + HEAD[kind] + '\n')
            self.node.subscribe(KINDS[kind], topic, self.cb(topic, kind))

    def on_clock(self, m):
        t = m.sim.sec + m.sim.nsec * 1e-9
        with self.lock:
            self.sim = t
            self.clock_f.write(f'{t:.6f},{time.time():.6f}\n')
            while self.cmds and t >= self.cmds[0]['t']:
                c = self.cmds.pop(0)
                msg = TYPES[c['type']]()
                text_format.Parse(c['msg'], msg)
                ok = self.pubs[c['topic']].publish(msg)
                self.sent.append(dict(c, sent_at_sim=t, wall=time.time(), ok=bool(ok)))
            if t >= self.a.until:
                self.done.set()

    def cb(self, topic, kind):
        f = self.files[topic]

        def on(m):
            rows = ROW[kind](m)
            with self.lock:
                for r in rows:
                    f.write(f'{self.sim:.6f},' + r + '\n')
        return on

    def close(self):
        with self.lock:
            for f in list(self.files.values()) + [self.clock_f]:
                f.close()
        with open(os.path.join(self.a.out, 'commands_sent.json'), 'w') as f:
            json.dump(dict(sent=self.sent, not_sent=self.cmds), f, indent=1)


def p7(p):
    return f'{p.position.x:.9f},{p.position.y:.9f},{p.position.z:.9f},{p.orientation.x:.9f},{p.orientation.y:.9f},{p.orientation.z:.9f},{p.orientation.w:.9f}'


HEAD = {
    'pose_v': 'sim_t,name,x,y,z,qx,qy,qz,qw',
    'odom': 'sim_t,frame_id,child_frame_id,x,y,z,qx,qy,qz,qw,vx,vy,vz,wx,wy,wz',
    'imu': 'sim_t,frame_id,qx,qy,qz,qw,wx,wy,wz,ax,ay,az',
    'scan': 'sim_t,frame_id,angle_min,angle_max,angle_step,range_min,range_max,count,ranges',
    'contacts': 'sim_t,n_contacts,collision1,collision2,n_points,depths,pos_z',
    'model': 'sim_t,joint,position,velocity,force',
    'twist': 'sim_t,vx,vy,vz,wx,wy,wz',
}


def r_pose_v(m):
    t = stamp(m.header)
    return [f'{t:.6f},{p.name},{p7(p)}' for p in m.pose]


def r_odom(m):
    d = hdr_data(m.header)
    v = m.twist
    return [f"{stamp(m.header):.6f},{'|'.join(d.get('frame_id', []))},{'|'.join(d.get('child_frame_id', []))},{p7(m.pose)},"
            f'{v.linear.x:.9f},{v.linear.y:.9f},{v.linear.z:.9f},{v.angular.x:.9f},{v.angular.y:.9f},{v.angular.z:.9f}']


def r_imu(m):
    d = hdr_data(m.header)
    o, w, a = m.orientation, m.angular_velocity, m.linear_acceleration
    return [f"{stamp(m.header):.6f},{'|'.join(d.get('frame_id', []))},{o.x:.9f},{o.y:.9f},{o.z:.9f},{o.w:.9f},"
            f'{w.x:.9f},{w.y:.9f},{w.z:.9f},{a.x:.9f},{a.y:.9f},{a.z:.9f}']


def r_scan(m):
    d = hdr_data(m.header)
    return [f"{stamp(m.header):.6f},{'|'.join(d.get('frame_id', []))},{m.angle_min:.9f},{m.angle_max:.9f},{m.angle_step:.9f},"
            f"{m.range_min},{m.range_max},{m.count},{' '.join(repr(x) for x in m.ranges)}"]


def r_contacts(m):
    t = stamp(m.header)
    if not m.contact:
        return [f'{t:.6f},0,,,0,,']
    out = []
    for c in m.contact:
        out.append(f"{t:.6f},{len(m.contact)},{c.collision1.name},{c.collision2.name},{len(c.position)},"
                   f"{' '.join(f'{x:.9g}' for x in c.depth)},{' '.join(f'{p.z:.9g}' for p in c.position)}")
    return out


def r_model(m):
    t = stamp(m.header)
    return [f'{t:.6f},{j.name},{j.axis1.position:.9f},{j.axis1.velocity:.9f},{j.axis1.force:.9f}' for j in m.joint]


def r_twist(m):
    return [f'{stamp(m.header):.6f},{m.linear.x},{m.linear.y},{m.linear.z},{m.angular.x},{m.angular.y},{m.angular.z}']


ROW = {'pose_v': r_pose_v, 'odom': r_odom, 'imu': r_imu, 'scan': r_scan, 'contacts': r_contacts, 'model': r_model, 'twist': r_twist}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--world', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--until', type=float, required=True)
    ap.add_argument('--sub', action='append', default=[])
    ap.add_argument('--cmd', action='append', default=[])
    ap.add_argument('--wall-timeout', type=float, default=600)
    a = ap.parse_args()
    r = Rec(a)
    open(os.path.join(a.out, 'recorder_ready'), 'w').write(str(time.time()))
    r.done.wait(a.wall_timeout)
    time.sleep(0.2)
    r.close()
    print(f'recorder: stopped at sim {r.sim:.3f} s ({"until reached" if r.done.is_set() else "wall timeout"})', flush=True)
    os._exit(0)   # gz-transport's finalizer aborts the interpreter at normal exit


if __name__ == '__main__':
    main()
